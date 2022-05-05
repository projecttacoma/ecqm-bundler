import { ELMIdentification, findELMByIdentifier } from './elm';
import logger from './logger';

export enum ImprovementNotation {
  POSITIVE = 'positive',
  NEGATIVE = 'negative'
}

export enum Scoring {
  PROPORTION = 'proportion',
  RATIO = 'ratio',
  CV = 'continuous-variable',
  COHORT = 'cohort'
}

export enum PopulationCode {
  IPOP = 'initial-population',
  NUMER = 'numerator',
  DENOM = 'denominator'
}

export function combineURLs(baseURL: string, relativeURL?: string) {
  return relativeURL
    ? baseURL.replace(/\/+$/, '') + '/' + relativeURL.replace(/^\/+/, '')
    : baseURL;
}

export function generateMeasureResource(
  measureId: string,
  libraryId: string,
  improvementNotation: ImprovementNotation,
  scoringCode: Scoring,
  canonicalBase: string,
  populationCodes: { [key in PopulationCode]: string }
): fhir4.Measure {
  logger.info(`Creating Measure/${measureId}`);

  return {
    resourceType: 'Measure',
    id: measureId,
    url: combineURLs(canonicalBase, `/Measure/${measureId}`),
    status: 'draft',
    library: [`Library/${libraryId}`],
    improvementNotation: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/measure-improvement-notation',
          code: improvementNotation === ImprovementNotation.POSITIVE ? 'increase' : 'decrease'
        }
      ]
    },
    scoring: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/measure-scoring',
          code: scoringCode
        }
      ]
    },
    group: [
      {
        population: [
          {
            code: {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/measure-population',
                  code: PopulationCode.IPOP
                }
              ]
            },
            criteria: {
              language: 'text/cql',
              expression: populationCodes[PopulationCode.IPOP]
            }
          },
          {
            code: {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/measure-population',
                  code: PopulationCode.DENOM
                }
              ]
            },
            criteria: {
              language: 'text/cql',
              expression: populationCodes[PopulationCode.DENOM]
            }
          },

          {
            code: {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/measure-population',
                  code: PopulationCode.NUMER
                }
              ]
            },
            criteria: {
              language: 'text/cql',
              expression: populationCodes[PopulationCode.NUMER]
            }
          }
        ]
      }
    ]
  };
}

export function generateLibraryResource(
  libraryId: string,
  elm: any,
  canonicalBase: string
): fhir4.Library {
  logger.info(`Creating Library/${libraryId}`);
  return {
    resourceType: 'Library',
    id: libraryId,
    url: combineURLs(canonicalBase, `/Library/${libraryId}`),
    ...(elm.library.identifier.version ? { version: elm.library.identifier.version } : {}),
    type: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/library-type',
          code: 'logic-library'
        }
      ]
    },
    status: 'draft',
    content: [
      {
        contentType: 'application/elm+json',
        data: Buffer.from(JSON.stringify(elm)).toString('base64')
      }
    ]
  };
}

export function generateRelatedArtifact(display: string, resource: string): fhir4.RelatedArtifact {
  return {
    type: 'depends-on',
    display,
    resource
  };
}

export function generateLibraryRelatedArtifact(
  identifier: ELMIdentification,
  allELM: any[],
  canonicalBase: string
): fhir4.RelatedArtifact {
  const matchingELM = findELMByIdentifier(identifier, allELM);

  if (!matchingELM) {
    throw new Error(`Could not locate main library ELM for ${identifier.id}|${identifier.version}`);
  }

  return generateRelatedArtifact(
    `Library ${identifier.id}`,
    combineURLs(
      canonicalBase,
      `/Library/library-${identifier.id}${identifier.version ? `|${identifier.version}` : ''}`
    )
  );
}

export function generateValueSetRelatedArtifact(url: string): fhir4.RelatedArtifact {
  return generateRelatedArtifact(`ValueSet ${url}`, url);
}

export function generateMeasureBundle(resources: fhir4.FhirResource[]): fhir4.Bundle {
  return {
    resourceType: 'Bundle',
    type: 'transaction',
    entry: resources.map(r => ({
      resource: r,
      request: {
        method: 'PUT',
        url: `${r.resourceType}/${r.id}`
      }
    }))
  };
}
