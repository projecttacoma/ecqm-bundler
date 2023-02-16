#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { Command, Option } from 'commander';
import { getELM } from './helpers/translator';
import {
  generateLibraryResource,
  generateMeasureBundle,
  generateMeasureResource,
  generateLibraryRelatedArtifact,
  generateValueSetRelatedArtifact,
  generateCompositeMeasureResource
} from './helpers/fhir';
import {
  findELMByIdentifier,
  getAllDependencyInfo,
  getDependencyInfo,
  getValueSetInfo
} from './helpers/elm';
import { getMainLibraryId } from './helpers/cql';
import logger from './helpers/logger';
import {
  CompositeScoring,
  compositeScoringCodes,
  GroupInfo,
  GroupPopulationCriteria,
  improvementNotation,
  MeasureBundle,
  scoringCodes
} from './types/measure';
import {
  BaseOpts,
  CLIOptions,
  DetailedCompositeMeasureComponent,
  DetailedMeasureObservationOption
} from './types/cli';
import { getPopulationConstraintErrors } from './helpers/ecqm';
import { collectInteractiveInput } from './cli/interactive';
import { findReferencedPopulation, makeSimplePopulationCriteria } from './cli/populations';
import { combineGroups } from './cli/combine-groups';

const program = new Command();

program.version('v0.3.0');

program
  .command('generate', { isDefault: true })
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
  .option(
    '--ipop <expr...>',
    '"initial-Population" expression name(s) of measure (enter multiple values for a multiple ipp ratio measure)'
  )
  .option('--numer <expr>', '"numerator" expression name of measure')
  .option(
    '--numer-ipop-ref <expr>',
    'expression name of the "initial-population" that the numerator draws from'
  )
  .option('--numex <expr>', '"numerator-exclusion" expression name of measure')
  .option('--denom <expr>', '"denominator" expression name of measure')
  .option(
    '--denom-ipop-ref <expr>',
    'expression name of the "initial-population" that the denominator draws from'
  )
  .option('--denex <expr>', '"denominator-exclusion" expression name of measure')
  .option('--denexcep <expr>', '"denominator-exception" expression name of measure')
  .option('--msrpopl <expr>', '"measure-population"  expression name of measure')
  .option('--msrpoplex <expr>', '"measure-population-exclusion" expression name of measure')
  .option(
    '--msrobs <expr...>',
    '"measure-observation" expression name of measure (enter multiple values for a measure with multiple observations)'
  )
  .option(
    '--detailed-msrobs <expr...>',
    'Specify measure-observation(s) that reference another population. Must be of the format "<observation-function-name>|<observing-population-expression>"',
    (val, current: DetailedMeasureObservationOption[]) => {
      if (!val.includes('|')) {
        logger.error(
          '--detailed-msrobs must be of the format <observation-function-name>|<observing-population-expression>'
        );
        program.help();
      }

      const [obsExpression, observingExpression] = val.split('|');
      return current.concat([
        {
          expression: obsExpression,
          observingPopulationExpression: observingExpression
        }
      ]);
    },
    []
  )
  .option('-v, --valuesets <path>', 'Path to directory containing necessary valueset resource')
  .option('--no-valuesets', 'Disable valueset detection and bundling')
  .option(
    '-u, --translator-url <url>',
    'URL of cql translation service to use',
    'http://localhost:8080/cql/translator'
  )
  .addOption(
    new Option('-s, --scoring-code <scoring>', "Measure's scoring code")
      .choices(scoringCodes)
      .default('proportion')
  )
  .option('-b, --basis <population-basis>', "Measure's population basis", 'boolean')
  .option(
    '--disable-constraints',
    'Bypass the population constraints defined for the given measure scoring code (useful for debugging)'
  )
  .action((opts: CLIOptions) => {
    const baseOpts = program.opts() as BaseOpts;
    main(opts, baseOpts).then(bundle => {
      fs.writeFileSync(baseOpts.out, JSON.stringify(bundle, null, 2), 'utf8');
      logger.info(`Wrote file to ${baseOpts.out}`);
    });
  });

program
  .command('combine-groups')
  .description('Combine the groups in the measure resources of two different bundles into one')
  .argument('<path...>')
  .action((paths: string[]) => {
    logger.info(`Combining measure groups of ${paths}`);

    try {
      const baseOpts = program.opts() as BaseOpts;
      const bundles = paths.map(p => JSON.parse(fs.readFileSync(p, 'utf8')) as MeasureBundle);
      const newBundle = combineGroups(bundles);

      fs.writeFileSync(baseOpts.out, JSON.stringify(newBundle, null, 2));
      logger.info(`Wrote file to ${baseOpts.out}`);
    } catch (e) {
      if (e instanceof Error) {
        logger.error(e.message);
        process.exit(1);
      }
    }

    process.exit(0);
  });

program
  .command('make-composite')
  .description('Combine a set of measures into a composite measure')
  .addOption(
    new Option('--composite-scoring <scoring>', 'Composite scoring method of the measure')
      .choices(compositeScoringCodes)
      .default('all-or-nothing')
  )
  .option(
    '--detailed-component <component...>',
    'Specify measure components with specific group IDs or weights. Format "measureId(|version)?(#groupId)?(#weight)?" (e.g. "measure|1.0.0#group-2#0.1")',
    (val, current: DetailedCompositeMeasureComponent[]) => {
      const [measureSlug, groupId, weight] = val.split('#');
      return current.concat([
        {
          measureSlug,
          ...(groupId &&
            groupId !== '' && {
              groupId: groupId
            }),
          ...(weight && { weight: parseFloat(weight) })
        }
      ]);
    },
    []
  )
  .argument('<path...>')
  .action(
    (
      paths: string[],
      opts: {
        compositeScoring: CompositeScoring;
        detailedComponent: DetailedCompositeMeasureComponent[];
      }
    ) => {
      logger.info(`Making ${paths} into a composite measure bundle`);
      const baseOpts = program.opts() as BaseOpts;

      try {
        const bundles = paths.map(p => JSON.parse(fs.readFileSync(p, 'utf8')) as MeasureBundle);

        const measures = bundles.flatMap(
          b => b.entry?.find(e => e.resource?.resourceType === 'Measure')?.resource as fhir4.Measure
        );

        const components =
          opts.detailedComponent.length === 0
            ? measures.map((m, i) => ({ measureSlug: m.id || `measure-${i}` }))
            : opts.detailedComponent;

        const compositeMeausureResource = generateCompositeMeasureResource(
          `measure-composite-${measures.map(m => m.id ?? '').join('')}`,
          baseOpts.canonicalBase,
          baseOpts.improvementNotation,
          opts.compositeScoring,
          components,
          baseOpts.measureVersion
        );

        const uniqueSubEntries = bundles
          .flatMap(b => b.entry ?? [])
          .filter((e, i, self) => self.findIndex(e2 => e2.resource?.url === e.resource?.url) === i);

        const newBundle: MeasureBundle = {
          resourceType: 'Bundle',
          type: 'transaction',
          entry: [
            {
              resource: compositeMeausureResource,
              request: {
                method: 'PUT',
                url: `/Measure/${compositeMeausureResource.id}`
              }
            },
            ...uniqueSubEntries
          ]
        };

        fs.writeFileSync(baseOpts.out, JSON.stringify(newBundle, null, 2));
        logger.info(`Wrote file to ${baseOpts.out}`);
      } catch (e) {
        if (e instanceof Error) {
          logger.error(e.message);
          process.exit(1);
        }
      }

      process.exit(0);
    }
  );

program
  .option('-o, --out <path>', 'Path to output file', './measure-bundle.json')
  .option(
    '--canonical-base <url>',
    'Base URL to use for the canonical URLs of library and measure resources',
    'http://example.com'
  )
  .option('--measure-version <version>', 'Version of the measure resource')
  .addOption(
    new Option('--improvement-notation <notation>', "Measure's improvement notation")
      .choices(improvementNotation)
      .default('increase')
  );

program.parse(process.argv);

async function main(opts: CLIOptions, baseOpts: BaseOpts) {
  if (opts.elmFile && opts.cqlFile) {
    logger.error('Cannot use both -c/--cql-file and -e/--elm-file\n');
    program.help();
  }

  if (!(opts.elmFile || opts.cqlFile)) {
    logger.error('Must specify one of -c/--cql-file or -e/--elm-file\n');
    program.help();
  }

  if (opts.deps.length !== 0 && opts.depsDirectory) {
    logger.error('Must specify only one of -d/--deps and --deps-directory\n');
    program.help();
  }

  if (opts.valuesets === false) {
    logger.warn(
      'Configured bundler to not resolve ValueSet resources. Resulting Bundle may be incomplete'
    );
  }

  if (opts.ipop && opts.ipop.length > 1 && opts.scoringCode !== 'ratio') {
    logger.error(
      'Multiple initial-populations are only supported when using --scoring-code "ratio"'
    );
    program.help();
  }

  if (opts.interactive && opts.elmFile) {
    logger.error('Interactive mode is only supported with CQL files');
    program.help();
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
  let allGroupInfo: GroupInfo[] = [];
  if (opts.interactive) {
    try {
      const mainCQLPath = path.resolve(opts.cqlFile as string);
      allGroupInfo = await collectInteractiveInput(mainCQLPath);
    } catch (e) {
      if (e instanceof Error) {
        logger.error(e.message);
        process.exit(1);
      }
    }
  } else {
    const popCriteria: GroupPopulationCriteria = {
      ...(opts.ipop && makeSimplePopulationCriteria('initial-population', opts.ipop)),
      ...(opts.numer && makeSimplePopulationCriteria('numerator', opts.numer)),
      ...(opts.numex && makeSimplePopulationCriteria('numerator-exclusion', opts.numex)),
      ...(opts.denom && makeSimplePopulationCriteria('denominator', opts.denom)),
      ...(opts.denex && makeSimplePopulationCriteria('denominator-exclusion', opts.denex)),
      ...(opts.denexcep && makeSimplePopulationCriteria('denominator-exception', opts.denexcep)),
      ...(opts.msrpopl && makeSimplePopulationCriteria('measure-population', opts.msrpopl)),
      ...(opts.msrpoplex &&
        makeSimplePopulationCriteria('measure-population-exclusion', opts.msrpoplex)),
      ...(opts.msrobs && makeSimplePopulationCriteria('measure-observation', opts.msrobs)),
      ...(opts.detailedMsrobs &&
        opts.detailedMsrobs.length > 0 &&
        makeSimplePopulationCriteria(
          'measure-observation',
          opts.detailedMsrobs.map(obs => obs.expression)
        ))
    };

    if (!opts.disableConstraints && Object.keys(popCriteria).length === 0) {
      logger.error(
        `Must specify at least 1 population expression (e.g. --ipop "Initial Population")`
      );
      program.help();
    }

    if (popCriteria['initial-population'] && popCriteria.numerator && opts.numerIpopRef) {
      const matchingIpop = popCriteria['initial-population'].find(
        ip => ip.criteriaExpression === opts.numerIpopRef
      );

      if (!matchingIpop) {
        logger.error(
          `Could not find initial-population "${opts.numerIpopRef}" referenced by numerator`
        );
        process.exit(1);
      }

      popCriteria.numerator.observingPopId = matchingIpop.id;
    }

    if (popCriteria['initial-population'] && popCriteria.denominator && opts.denomIpopRef) {
      const matchingIpop = popCriteria['initial-population'].find(
        ip => ip.criteriaExpression === opts.denomIpopRef
      );

      if (!matchingIpop) {
        logger.error(
          `Could not find initial-population "${opts.denomIpopRef}" referenced by denominator`
        );
        process.exit(1);
      }

      popCriteria.denominator.observingPopId = matchingIpop.id;
    }

    if (opts.detailedMsrobs && opts.detailedMsrobs.length > 0) {
      opts.detailedMsrobs.forEach(obs => {
        const observingPop = findReferencedPopulation(
          obs.observingPopulationExpression,
          popCriteria
        );

        if (!observingPop) {
          logger.error(
            `Could not find population "${obs.observingPopulationExpression}" referenced by measure-observation "${obs.expression}"`
          );
          process.exit(1);
        }

        // Skip any measure observation entries that have already been processed
        const msrObsEntry = popCriteria['measure-observation']?.find(
          mo => mo.criteriaExpression === obs.expression && !mo.observingPopId
        );

        if (!msrObsEntry) {
          logger.error(`Could not find measure observation "${obs.expression}" in group`);
          process.exit(1);
        }

        msrObsEntry.observingPopId = observingPop.id;
      });
    }

    const groupInfo: GroupInfo = {
      populationBasis: opts.basis,
      improvementNotation: baseOpts.improvementNotation,
      scoring: opts.scoringCode,
      populationCriteria: popCriteria
    };

    allGroupInfo.push(groupInfo);
  }

  if (!opts.disableConstraints) {
    const populationConstraintErrors = getPopulationConstraintErrors(allGroupInfo);

    if (populationConstraintErrors.length > 0) {
      populationConstraintErrors.forEach(errMsg => logger.error(`${errMsg}`));
      program.help();
    }
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
  const library = generateLibraryResource(
    libraryFHIRId,
    mainLibELM,
    baseOpts.canonicalBase,
    cqlLookup
  );

  const measureFHIRId = `measure-${mainLibraryId}`;

  const measure = generateMeasureResource(
    measureFHIRId,
    libraryFHIRId,
    baseOpts.canonicalBase,
    allGroupInfo,
    baseOpts.measureVersion
  );

  logger.info('Resolving dependencies/relatedArtifact');

  const mainLibDeps = getDependencyInfo(mainLibELM);

  library.relatedArtifact = [
    ...mainLibDeps.map(dep => generateLibraryRelatedArtifact(dep, elm, baseOpts.canonicalBase)),
    ...getValueSetInfo(mainLibELM).map(vs => generateValueSetRelatedArtifact(vs))
  ];

  const allUsedDependencies = [...new Set(getAllDependencyInfo(elm).map(e => e.id))];

  const remainingDeps = elm.filter(e => allUsedDependencies.includes(e.library.identifier.id));

  const depLibraries = remainingDeps.map(d => ({
    ...generateLibraryResource(
      `library-${d.library.identifier.id}`,
      d,
      baseOpts.canonicalBase,
      cqlLookup
    ),
    relatedArtifact: [
      ...getDependencyInfo(d).map(dep =>
        generateLibraryRelatedArtifact(dep, remainingDeps, baseOpts.canonicalBase)
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

      if (vsResources.length !== allValueSets.length) {
        const resolvedValueSetUrls = vsResources.map(vs => vs.url);

        const missingUrls = allValueSets.filter(u => !resolvedValueSetUrls.includes(u));

        logger.error(
          `Detected ValueSet(s) ${missingUrls} used by the library but could not be resolved in ${opts.valuesets}`
        );
        process.exit(1);
      }
    }
  }

  return generateMeasureBundle([measure, library, ...depLibraries, ...vsResources]);
}
