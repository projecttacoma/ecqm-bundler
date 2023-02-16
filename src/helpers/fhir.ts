import { v4 as uuidv4 } from 'uuid';
import { DetailedCompositeMeasureComponent } from '../types/cli';
import {
  CompositeScoring,
  GroupInfo,
  ImprovementNotation,
  MeasureBundle,
  MeasureBundleResourceType
} from '../types/measure';
import { ELMIdentification, findELMByIdentifier } from './elm';
import logger from './logger';

export function combineURLs(baseURL: string, relativeURL?: string) {
  return relativeURL
    ? baseURL.replace(/\/+$/, '') + '/' + relativeURL.replace(/^\/+/, '')
    : baseURL;
}

function getPopulationArray(groupInfo: GroupInfo) {
  const populations: fhir4.MeasureGroupPopulation[] = [];
  Object.entries(groupInfo.populationCriteria).forEach(([popCode, info]) => {
    if (Array.isArray(info)) {
      const observations = info.map(inf => {
        const p: fhir4.MeasureGroupPopulation = {
          id: inf.id,
          code: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/measure-population',
                code: popCode
              }
            ]
          },
          criteria: {
            language: 'text/cql-identifier',
            expression: inf.criteriaExpression
          }
        };

        if (inf.observingPopId) {
          p.extension = [
            {
              url: 'http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/cqfm-criteriaReference',
              valueString: inf.observingPopId
            }
          ];
        }

        return p;
      });

      populations.push(...observations);
    } else {
      const p: fhir4.MeasureGroupPopulation = {
        id: info.id,
        code: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/measure-population',
              code: popCode
            }
          ]
        },
        criteria: {
          language: 'text/cql-identifier',
          expression: info.criteriaExpression
        }
      };

      if (info.observingPopId) {
        p.extension = [
          {
            url: 'http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/cqfm-criteriaReference',
            valueString: info.observingPopId
          }
        ];
      }

      populations.push(p);
    }
  });

  return populations;
}

export function generateCompositeMeasureResource(
  measureId: string,
  canonicalBase: string,
  improvementNotation: ImprovementNotation,
  compositeScoring: CompositeScoring,
  components: DetailedCompositeMeasureComponent[],
  measureVersion?: string
): fhir4.Measure {
  logger.info(`Creating Measure/${measureId}`);

  return {
    resourceType: 'Measure',
    id: measureId,
    ...(measureVersion && { version: measureVersion }),
    url: combineURLs(canonicalBase, `/Measure/${measureId}`),
    status: 'draft',
    improvementNotation: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/measure-improvement-notation',
          code: improvementNotation
        }
      ]
    },
    scoring: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/measure-scoring',
          code: 'composite',
          display: 'Composite'
        }
      ]
    },
    compositeScoring: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/composite-measure-scoring',
          code: compositeScoring
        }
      ]
    },
    relatedArtifact: components.map(c => makeCompositeRelatedArtifact(c, canonicalBase))
  };
}

function makeCompositeRelatedArtifact(
  componentInfo: DetailedCompositeMeasureComponent,
  canonicalBase: string
): fhir4.RelatedArtifact {
  const ra: fhir4.RelatedArtifact = {
    type: 'composed-of',
    display: componentInfo.measureSlug,
    resource: combineURLs(canonicalBase, `/Measure/${componentInfo.measureSlug}`)
  };

  if (componentInfo.groupId || componentInfo.weight) {
    ra.extension = [];

    if (componentInfo.groupId) {
      ra.extension.push({
        url: 'http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/cqfm-groupId',
        valueString: componentInfo.groupId
      });
    }

    if (componentInfo.weight) {
      ra.extension.push({
        url: 'http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/cqfm-weight',
        valueDecimal: componentInfo.weight
      });
    }
  }

  return ra;
}

export function generateMeasureResource(
  measureId: string,
  libraryId: string,
  canonicalBase: string,
  groupInfo: GroupInfo[],
  measureVersion?: string
): fhir4.Measure {
  logger.info(`Creating Measure/${measureId}`);

  return {
    resourceType: 'Measure',
    id: measureId,
    ...(measureVersion && { version: measureVersion }),
    url: combineURLs(canonicalBase, `/Measure/${measureId}`),
    status: 'draft',
    library: [combineURLs(canonicalBase, `/Library/${libraryId}`)],
    group: groupInfo.map(gi => {
      const group: fhir4.MeasureGroup = {
        id: uuidv4(),
        extension: [
          {
            url: 'http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/cqfm-populationBasis',
            valueCode: gi.populationBasis
          },
          {
            url: 'http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/cqfm-improvementNotation',
            valueCodeableConcept: {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/measure-improvement-notation',
                  code: gi.improvementNotation
                }
              ]
            }
          },
          {
            url: 'http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/cqfm-scoring',
            valueCodeableConcept: {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/measure-scoring',
                  code: gi.scoring
                }
              ]
            }
          }
        ],
        population: getPopulationArray(gi)
      };

      return group;
    })
  };
}

export function generateLibraryResource(
  libraryId: string,
  elm: any,
  canonicalBase: string,
  cqlLookup: Record<string, string>
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
        contentType: 'text/cql',
        data: Buffer.from(cqlLookup[elm.library.identifier.id] || '').toString('base64')
      },
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

export function generateMeasureBundle(resources: MeasureBundleResourceType[]): MeasureBundle {
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
