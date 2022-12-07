#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { Command, Option } from 'commander';
import { v4 as uuidv4 } from 'uuid';
import { getELM } from './helpers/translator';
import {
  generateLibraryResource,
  generateMeasureBundle,
  generateMeasureResource,
  generateLibraryRelatedArtifact,
  generateValueSetRelatedArtifact
} from './helpers/fhir';
import {
  findELMByIdentifier,
  getAllDependencyInfo,
  getDependencyInfo,
  getValueSetInfo
} from './helpers/elm';
import { extractDefinesFromCQL, getMainLibraryId } from './helpers/cql';
import logger from './helpers/logger';
import {
  GroupInfo,
  improvementNotation,
  ImprovementNotation,
  MeasurePopulation,
  measurePopulations,
  PopulationInfo,
  ScoringCode,
  scoringCodes
} from './types/measure';
import { CLIOptions } from './types/cli';

const program = new Command();

program
  .option(
    '-i, --interactive',
    'Create Bundle in interactive mode (allows for complex values)',
    false
  )
  .option('-c, --cql-file <path>')
  .option('-e,--elm-file <path>')
  .option('--debug', 'Enable debug mode to write contents to a ./debug directory', false)
  .addOption(
    new Option('--deps <deps...>', 'List of CQL or ELM dependency files of the main file').default(
      []
    )
  )
  .option('--deps-directory <path>', 'Directory containing all dependent CQL or ELM files')
  .option('--ipop <expr>', 'Initial Population expression name of measure')
  .option('--numer <expr>', '"numerator" expression name of measure')
  .option('--numex <expr>', '"numerator-exclusion" expression name of measure')
  .option('--denom <expr>', '"denominator" expression name of measure')
  .option('--denex <expr>', '"denominator-exclusion" expression name of measure')
  .option('--denexcep <expr>', '"denominator-exception" expression name of measure')
  .option('--msrpopl <expr>', '"measure-population"  expression name of measure')
  .option('--msrpoplex <expr>', '"measure-population-exclusion" expression name of measure')
  .option('--msrobs <expr>', '"measure-observation" expression name of measure')
  .option('-o, --out <path>', 'Path to output file', './measure-bundle.json')
  .option('-v, --valuesets <path>', 'Path to directory containing necessary valueset resource')
  .option('--no-valuesets', 'Disable valueset detection and bundling')
  .option(
    '-u, --translator-url <url>',
    'URL of cql translation service to use',
    'http://localhost:8080/cql/translator'
  )
  .option(
    '--canonical-base <url>',
    'Base URL to use for the canonical URLs of library and measure resources',
    'http://example.com'
  )
  .addOption(
    new Option('--improvement-notation <notation>', "Measure's improvement notation")
      .choices(improvementNotation)
      .default('increase')
  )
  .addOption(
    new Option('-s, --scoring-code <scoring>', "Measure's scoring code")
      .choices(scoringCodes)
      .default('proportion')
  )
  .option('-b, --basis <population-basis>', "Measure's population basis", 'boolean')
  .parse(process.argv);

const opts = program.opts() as CLIOptions;

if (opts.elmFile && opts.cqlFile) {
  logger.error('ERROR: Cannot use both -c/--cql-file and -e/--elm-file\n');
  program.help();
}

if (!(opts.elmFile || opts.cqlFile)) {
  logger.error('ERROR: Must specify one of -c/--cql-file or -e/--elm-file\n');
  program.help();
}

if (opts.deps.length !== 0 && opts.depsDirectory) {
  logger.error('ERROR: Must specify only one of -d/--deps and --deps-directory\n');
  program.help();
}

if (opts.valuesets === false) {
  logger.warn(
    'Configured bundler to not resolve ValueSet resources. Resulting Bundle may be incomplete'
  );
}

let deps: string[] = [];

logger.info('Gathering dependencies');

if (opts.deps.length > 0) {
  deps = opts.deps.map((d: string) => path.resolve(d));
} else if (opts.depsDirectory) {
  const depsBasePath = path.resolve(opts.depsDirectory);
  deps = fs
    .readdirSync(opts.depsDirectory)
    .filter(f => {
      if (opts.elmFile) {
        return path.extname(f) === '.json' && f !== path.basename(opts.elmFile);
      } else if (opts.cqlFile) {
        return path.extname(f) === '.cql' && f !== path.basename(opts.cqlFile);
      } else {
        return false;
      }
    })
    .map(f => path.join(depsBasePath, f));
}

logger.info(`Successfully gathered ${deps.length} dependencies`);

const EXPR_SKIP_CHOICE = 'SKIP';

function makeSimplePopulationCriteria(
  popCode: MeasurePopulation,
  criteriaExpression: string,
  asArray = false
) {
  const criteria: PopulationInfo = {
    id: uuidv4(),
    criteriaExpression
  };

  return {
    [popCode]: asArray ? [criteria] : criteria
  };
}

async function main() {
  const { default: inquirer } = await import('inquirer');
  const allGroupInfo: GroupInfo[] = [];
  if (opts.interactive) {
    if (opts.elmFile) {
      logger.error('ERROR: Interactive mode is only supported with CQL files');
      program.help();
    }

    const mainCQLPath = path.resolve(opts.cqlFile as string);
    const mainCQL = fs.readFileSync(mainCQLPath, 'utf8');

    const expressionNames = extractDefinesFromCQL(mainCQL);

    const { numberOfGroups } = await inquirer.prompt<{ numberOfGroups: number }>({
      name: 'numberOfGroups',
      type: 'number',
      message: 'Enter number of Groups in the Measure',
      default: 1
    });

    for (let i = 0; i < numberOfGroups; i++) {
      const selectedGroupExpressions = [...expressionNames];
      const group = `Group ${i + 1}`;

      const { scoring, measureImprovementNotation, populationBasis, numMeasureObs } =
        await inquirer.prompt<{
          scoring: ScoringCode;
          measureImprovementNotation: ImprovementNotation;
          populationBasis: string;
          numMeasureObs: number;
        }>([
          {
            name: 'scoring',
            type: 'list',
            message: `Enter ${group} scoring code`,
            choices: scoringCodes
          },
          {
            name: 'measureImprovementNotation',
            type: 'list',
            message: `Enter ${group} improvement notation`,
            choices: improvementNotation
          },
          {
            name: 'populationBasis',
            type: 'input',
            message: `Enter ${group} population basis (see https://build.fhir.org/ig/HL7/cqf-measures/StructureDefinition-cqfm-populationBasis.html for more info)`,
            default: 'boolean'
          },
          {
            name: 'numMeasureObs',
            type: 'number',
            message: `Enter ${group} number of "measure-observation"s`,
            default: 0
          }
        ]);

      const groupInfo: GroupInfo = {
        scoring,
        improvementNotation: measureImprovementNotation,
        populationBasis,
        populationCriteria: {}
      };

      let numIPPs = 1;
      if (scoring === 'ratio') {
        const { numIPPsChoice } = await inquirer.prompt<{ numIPPsChoice: number }>({
          name: 'numIPPsChoice',
          type: 'number',
          message: `Enter ${group} number of "initial-population"s`,
          default: 1
        });

        numIPPs = numIPPsChoice;
      }

      for (const popCode of measurePopulations) {
        if (selectedGroupExpressions.length === 0) continue;

        if (popCode === 'initial-population') {
          for (let j = 0; j < numIPPs; j++) {
            const { criteriaExpression } = await inquirer.prompt<{
              criteriaExpression: string;
            }>({
              name: 'criteriaExpression',
              type: 'list',
              message: `${group} "${popCode}" ${j + 1} expression`,
              choices: selectedGroupExpressions
            });

            if (groupInfo.populationCriteria['initial-population']) {
              groupInfo.populationCriteria['initial-population'].push({
                id: uuidv4(),
                criteriaExpression
              });
            } else {
              groupInfo.populationCriteria['initial-population'] = [
                {
                  id: uuidv4(),
                  criteriaExpression
                }
              ];
            }

            selectedGroupExpressions.splice(
              selectedGroupExpressions.indexOf(criteriaExpression),
              1
            );
          }
        } else if (popCode === 'measure-observation') {
          for (let j = 0; j < numMeasureObs; j++) {
            const { measureObsCriteriaExpression } = await inquirer.prompt<{
              measureObsCriteriaExpression: string;
            }>({
              name: 'measureObsCriteriaExpression',
              type: 'list',
              message: `${group} "${popCode}" expression`,
              choices: [EXPR_SKIP_CHOICE].concat(selectedGroupExpressions)
            });

            if (measureObsCriteriaExpression !== EXPR_SKIP_CHOICE) {
              const { observingPopExpression } = await inquirer.prompt<{
                observingPopExpression: string;
              }>({
                name: 'observingPopExpression',
                type: 'list',
                message: `${group} "${popCode}" ${measureObsCriteriaExpression} observing population`,
                choices: expressionNames
              });

              const observingPops = Object.values(groupInfo.populationCriteria).find(gi => {
                if (Array.isArray(gi)) {
                  return gi.some(g => g.criteriaExpression === observingPopExpression);
                }

                return gi.criteriaExpression === observingPopExpression;
              });

              if (!observingPops) {
                logger.error(`ERROR: Could not find population ${observingPopExpression} in group`);
                process.exit(1);
              }

              const observingPop = Array.isArray(observingPops)
                ? observingPops.find(op => op.criteriaExpression === observingPopExpression)
                : observingPops;

              if (!observingPop) {
                logger.error(`ERROR: Could not find population ${observingPopExpression} in group`);
                process.exit(1);
              }

              if (groupInfo.populationCriteria['measure-observation']) {
                groupInfo.populationCriteria['measure-observation'].push({
                  id: uuidv4(),
                  criteriaExpression: measureObsCriteriaExpression,
                  observingPopId: observingPop.id
                });
              } else {
                groupInfo.populationCriteria['measure-observation'] = [
                  {
                    id: uuidv4(),
                    criteriaExpression: measureObsCriteriaExpression,
                    observingPopId: observingPop.id
                  }
                ];
              }

              selectedGroupExpressions.splice(
                selectedGroupExpressions.indexOf(measureObsCriteriaExpression),
                1
              );
            }
          }
        } else {
          const { criteriaExpression } = await inquirer.prompt<{
            criteriaExpression: string;
          }>({
            name: 'criteriaExpression',
            type: 'list',
            message: `${group} "${popCode}" expression`,
            choices: [EXPR_SKIP_CHOICE].concat(selectedGroupExpressions)
          });

          if (criteriaExpression !== EXPR_SKIP_CHOICE) {
            groupInfo.populationCriteria[popCode] = { id: uuidv4(), criteriaExpression };
            selectedGroupExpressions.splice(
              selectedGroupExpressions.indexOf(criteriaExpression),
              1
            );
          }
        }

        if (scoring === 'ratio' && numIPPs > 1) {
          if (popCode === 'numerator' || popCode === 'denominator') {
            if (!groupInfo.populationCriteria['initial-population']) {
              logger.error(
                `ERROR: could not detect initial-population entries to draw from for ratio measure with multipe IPPs`
              );
              process.exit(1);
            }

            const { observingPopExpression } = await inquirer.prompt<{
              observingPopExpression: string;
            }>({
              name: 'observingPopExpression',
              type: 'list',
              message: `${group} initial-population that "${popCode}" draws from`,
              choices: groupInfo.populationCriteria['initial-population'].map(
                p => p.criteriaExpression
              )
            });

            const observingPopId = groupInfo.populationCriteria['initial-population'].find(
              p => p.criteriaExpression === observingPopExpression
            )?.id;

            if (!observingPopId) {
              logger.error(`ERROR: Could not find population ${observingPopExpression} in group`);
              process.exit(1);
            }

            const gi = groupInfo.populationCriteria[popCode];
            if (!gi) {
              logger.error(
                `ERROR: trying to set a criteria reference on ${popCode}, but no criteriaExpression was defined for it`
              );
              process.exit(1);
            }

            gi.observingPopId = observingPopId;
          }
        }
      }

      allGroupInfo.push(groupInfo);
    }
  } else {
    const groupInfo: GroupInfo = {
      populationBasis: opts.basis,
      improvementNotation: opts.improvementNotation,
      scoring: opts.scoringCode,
      populationCriteria: {
        ...(opts.ipop && makeSimplePopulationCriteria('initial-population', opts.ipop, true)),
        ...(opts.numer && makeSimplePopulationCriteria('numerator', opts.numer)),
        ...(opts.numex && makeSimplePopulationCriteria('numerator-exclusion', opts.numex)),
        ...(opts.denom && makeSimplePopulationCriteria('denominator', opts.denom)),
        ...(opts.denex && makeSimplePopulationCriteria('denominator-exclusion', opts.denex)),
        ...(opts.denexcep && makeSimplePopulationCriteria('denominator-exception', opts.denexcep)),
        ...(opts.msrpopl && makeSimplePopulationCriteria('measure-population', opts.msrpopl)),
        ...(opts.msrpoplex &&
          makeSimplePopulationCriteria('measure-population-exclusion', opts.msrpoplex)),
        ...(opts.msrobs && makeSimplePopulationCriteria('measure-observation', opts.msrobs, true))
      }
    };

    allGroupInfo.push(groupInfo);
  }

  let elm: any[];
  let cqlLookup: Record<string, string> = {};
  let mainLibraryId: string | null = null;
  if (opts.elmFile) {
    const mainELM = JSON.parse(fs.readFileSync(path.resolve(opts.elmFile), 'utf8'));

    mainLibraryId = mainELM.library.identifier.id;

    if (!mainLibraryId) {
      logger.error(`Could not locate main library ID in ${opts.elmFile}`);
      process.exit(1);
    }

    elm = [mainELM, ...deps.map(d => JSON.parse(fs.readFileSync(path.resolve(d), 'utf8')))];
  } else {
    const mainCQLPath = path.resolve(opts.cqlFile as string);
    const allCQL = [mainCQLPath, ...deps];

    logger.info(`Using ${mainCQLPath} as main library`);

    mainLibraryId = getMainLibraryId(fs.readFileSync(mainCQLPath, 'utf8'));

    if (!mainLibraryId) {
      logger.error(`Could not locate main library ID in ${opts.cqlFile}`);
      process.exit(1);
    }

    try {
      logger.info('Translating all CQL');
      const [result, errors] = await getELM(allCQL, opts.translatorUrl, mainLibraryId);

      if (result == null) {
        logger.error('Error translating CQL:');
        console.error(errors);
        process.exit(1);
      }
      elm = result.elm;
      cqlLookup = result.cqlLookup;
    } catch (e: any) {
      logger.error(`HTTP error translating CQL: ${e.message}`);
      console.error(e.stack);

      if (e.response?.data) {
        console.log(e.response.data);
      }

      process.exit(1);
    }
  }

  if (opts.debug === true) {
    if (!fs.existsSync('./debug')) {
      fs.mkdirSync('./debug');
    }
    elm.forEach(e => {
      fs.writeFileSync(
        `./debug/${e.library.identifier.id}.json`,
        JSON.stringify(e, null, 2),
        'utf8'
      );
    });
  }

  const mainLibELM = findELMByIdentifier(
    {
      id: mainLibraryId
    },
    elm
  );

  if (!mainLibELM) {
    console.error(`Could not locate main library ELM for ${mainLibraryId}`);
    process.exit(1);
  }

  const libraryFHIRId = `library-${mainLibraryId}`;
  const library = generateLibraryResource(libraryFHIRId, mainLibELM, opts.canonicalBase, cqlLookup);

  const measureFHIRId = `measure-${mainLibraryId}`;

  const measure = generateMeasureResource(
    measureFHIRId,
    libraryFHIRId,
    opts.canonicalBase,
    allGroupInfo
  );

  logger.info('Resolving dependencies/relatedArtifact');

  const mainLibDeps = getDependencyInfo(mainLibELM);

  library.relatedArtifact = [
    ...mainLibDeps.map(dep => generateLibraryRelatedArtifact(dep, elm, opts.canonicalBase)),
    ...getValueSetInfo(mainLibELM).map(vs => generateValueSetRelatedArtifact(vs))
  ];

  const allUsedDependencies = [...new Set(getAllDependencyInfo(elm).map(e => e.id))];

  const remainingDeps = elm.filter(e => allUsedDependencies.includes(e.library.identifier.id));

  const depLibraries = remainingDeps.map(d => ({
    ...generateLibraryResource(
      `library-${d.library.identifier.id}`,
      d,
      opts.canonicalBase,
      cqlLookup
    ),
    relatedArtifact: [
      ...getDependencyInfo(d).map(dep =>
        generateLibraryRelatedArtifact(dep, remainingDeps, opts.canonicalBase)
      ),
      ...getValueSetInfo(d).map(vs => generateValueSetRelatedArtifact(vs))
    ]
  }));

  const vsResources: fhir4.ValueSet[] = [];

  if (opts.valuesets !== false) {
    logger.info(`Resolving ValueSets`);
    const allValueSets = elm.map(e => getValueSetInfo(e)).flat();

    if (allValueSets.length > 0) {
      if (!opts.valuesets) {
        logger.error(
          `Library ${mainLibraryId} uses valuesets, but -v/--valuesets directory not provided`
        );
        logger.info('To disable ValueSet resolution, use --no-valuesets');
        program.help();
      }

      const vsBasePath = path.resolve(opts.valuesets as string);

      fs.readdirSync(vsBasePath).forEach(f => {
        if (path.extname(f) === '.json') {
          const vs = JSON.parse(
            fs.readFileSync(path.join(vsBasePath, f), 'utf8')
          ) as fhir4.ValueSet;
          if (vs.url && allValueSets.includes(vs.url)) {
            logger.info(`Found ValueSet ${vs.url}`);
            vsResources.push(vs);
          }
        }
      });
    }
  }

  return generateMeasureBundle([measure, library, ...depLibraries, ...vsResources]);
}

main().then(bundle => {
  fs.writeFileSync(opts.out, JSON.stringify(bundle, null, 2), 'utf8');
  logger.info(`Wrote file to ${opts.out}`);
});
