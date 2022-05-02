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
import { findELMByIdentifier, getDependencyInfo, getValueSetInfo } from './helpers/elm';
import { getMainLibraryId } from './helpers/cql';
import logger from './helpers/logger';

const program = new Command();

program
  .requiredOption('-c, --cql-file <path>')
  .addOption(
    new Option('--deps <deps...>', 'List of CQL dependency files of the main file').default([])
  )
  .option('--deps-directory <path>', 'Directory containing all dependent CQL files')
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

if (opts.deps.length !== 0 && opts.depsDirectory) {
  console.error('ERROR: Must specify only one of -d/--deps and --deps-directory\n');
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
    .filter(f => path.extname(f) === '.cql' && f !== path.basename(opts.cqlFile))
    .map(f => path.join(depsBasePath, f));
}

logger.info(`Successfully gathered ${deps.length} dependencies`);

const mainCQLPath = path.resolve(opts.cqlFile);
const allCQL = [mainCQLPath, ...deps];

logger.info(`Using ${mainCQLPath} as main library`);

async function main(): Promise<fhir4.Bundle> {
  const mainLibraryId = getMainLibraryId(fs.readFileSync(mainCQLPath, 'utf8'));
  let elm: any[];
  try {
    logger.info('Translating all CQL');
    const [result, errors] = await getELM(allCQL, opts.translatorUrl);

    if (result == null) {
      logger.error('Error translating CQL:');
      console.error(errors);
      process.exit(1);
    }
    elm = result;
  } catch (e: any) {
    logger.error(`HTTP error translating CQL: ${e.message}`);
    console.error(e.stack);

    if (e.response?.data) {
      console.log(e.response.data);
    }

    process.exit(1);
  }

  if (!mainLibraryId) {
    logger.error(`Could not locate main library ID in ${mainCQLPath}`);
    process.exit(1);
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
  const library = generateLibraryResource(libraryFHIRId, mainLibELM, opts.canonicalBase);

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
    ...mainLibDeps.map(dep => generateLibraryRelatedArtifact(dep, elm)),
    ...getValueSetInfo(mainLibELM).map(vs => generateValueSetRelatedArtifact(vs))
  ];

  const remainingDeps = elm.filter(e => e.library.identifier.id !== mainLibraryId);

  const depLibraries = remainingDeps.map(d => ({
    ...generateLibraryResource(`library-${d.library.identifier.id}`, d, opts.canonicalBase),
    relatedArtifact: [
      ...getDependencyInfo(d).map(dep => generateLibraryRelatedArtifact(dep, remainingDeps)),
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
