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
  ImprovementNotation,
  Scoring,
  generateValueSetRelatedArtifact,
  PopulationCode
} from './helpers/fhir';
import {
  findELMByIdentifier,
  getAllDependencyInfo,
  getDependencyInfo,
  getValueSetInfo
} from './helpers/elm';
import { getMainLibraryId } from './helpers/cql';
import logger from './helpers/logger';

const program = new Command();

program
  .option('-c, --cql-file <path>')
  .option('-e,--elm-file <path>')
  .option('--debug', 'Enable debug mode to write contents to a ./debug directory', false)
  .addOption(
    new Option('--deps <deps...>', 'List of CQL or ELM dependency files of the main file').default(
      []
    )
  )
  .option('--deps-directory <path>', 'Directory containing all dependent CQL or ELM files')
  .option('-n,--numer <expr>', 'Numerator expression name of measure', 'Numerator')
  .option('-i,--ipop <expr>', 'Numerator expression name of measure', 'Initial Population')
  .option('-d,--denom <expr>', 'Denominator expression name of measure', 'Denominator')
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
    new Option('-i, --improvement-notation <notation>', "Measure's improvement notation")
      .choices(Object.values(ImprovementNotation))
      .default(ImprovementNotation.POSITIVE)
  )
  .addOption(
    new Option('-s, --scoring-code <scoring>', "Measure's scoring code")
      .choices(Object.values(Scoring))
      .default(Scoring.PROPORTION)
  )
  .parse(process.argv);

const opts = program.opts();

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
      } else {
        return path.extname(f) === '.cql' && f !== path.basename(opts.cqlFile);
      }
    })
    .map(f => path.join(depsBasePath, f));
}

logger.info(`Successfully gathered ${deps.length} dependencies`);

async function main(): Promise<fhir4.Bundle> {
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
    const mainCQLPath = path.resolve(opts.cqlFile);
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
    opts.improvementNotation,
    opts.scoringCode,
    opts.canonicalBase,
    {
      [PopulationCode.IPOP]: opts.ipop,
      [PopulationCode.NUMER]: opts.numer,
      [PopulationCode.DENOM]: opts.denom
    }
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

      const vsBasePath = path.resolve(opts.valuesets);

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
