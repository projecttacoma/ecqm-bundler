import {
  combineURLs,
  generateLibraryResource,
  generateMeasureResource
} from '../../src/helpers/fhir';

describe('generateMeasureResource', () => {
  it('should generate proper positive improvement measure resource with inputs', () => {
    const measure = generateMeasureResource('measure', 'library', 'http://example.com', [
      {
        scoring: 'proportion',
        populationBasis: 'boolean',
        improvementNotation: 'increase',
        populationCriteria: {
          'initial-population': [
            {
              id: 'test-ipp-id',
              criteriaExpression: 'ipp'
            }
          ],
          denominator: {
            id: 'test-denom-id',
            criteriaExpression: 'denom'
          },
          numerator: {
            id: 'test-numer-id',
            criteriaExpression: 'numer'
          }
        }
      }
    ]);

    expect(measure).toBeDefined();
    expect(measure.resourceType).toEqual('Measure');
    expect(measure.id).toEqual('measure');
    expect(measure.url).toEqual('http://example.com/Measure/measure');
    expect(measure.library).toEqual(['Library/library']);
    expect(measure.group).toEqual([
      {
        id: expect.any(String),
        extension: [
          {
            url: 'http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/cqfm-populationBasis',
            valueCode: 'boolean'
          },
          {
            url: 'http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/cqfm-improvementNotation',
            valueCodeableConcept: {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/measure-improvement-notation',
                  code: 'increase'
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
                  code: 'proportion'
                }
              ]
            }
          }
        ],

        population: [
          {
            id: 'test-ipp-id',
            code: {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/measure-population',
                  code: 'initial-population'
                }
              ]
            },
            criteria: {
              language: 'text/cql',
              expression: 'ipp'
            }
          },
          {
            id: 'test-denom-id',
            code: {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/measure-population',
                  code: 'denominator'
                }
              ]
            },
            criteria: {
              language: 'text/cql',
              expression: 'denom'
            }
          },
          {
            id: 'test-numer-id',
            code: {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/measure-population',
                  code: 'numerator'
                }
              ]
            },
            criteria: {
              language: 'text/cql',
              expression: 'numer'
            }
          }
        ]
      }
    ]);
  });
});

describe('combineURLs', () => {
  it('should join urls with slashes', () => {
    expect(combineURLs('http://example.com/', '/test')).toEqual('http://example.com/test');
  });

  it('should join urls a missing slash', () => {
    expect(combineURLs('http://example.com', 'test')).toEqual('http://example.com/test');
  });

  it('should join urls a with a slug already present', () => {
    expect(combineURLs('http://example.com/slug', '/test')).toEqual('http://example.com/slug/test');
  });

  it('should persist url with no relative slug', () => {
    expect(combineURLs('http://example.com/slug')).toEqual('http://example.com/slug');
  });
});

describe('generateLibraryResource', () => {
  it('should generate proper basic info', () => {
    const lib = generateLibraryResource(
      'library',
      {
        library: {
          identifier: {
            version: '1.0.0'
          }
        }
      },
      'http://example.com',
      {}
    );

    expect(lib.url).toEqual('http://example.com/Library/library');
    expect(lib.version).toEqual('1.0.0');
    expect(lib.type).toEqual({
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/library-type',
          code: 'logic-library'
        }
      ]
    });
    expect(lib.content).toBeDefined();
  });

  it('should omit version from a library with no version', () => {
    const lib = generateLibraryResource(
      'library',
      {
        library: {
          identifier: {}
        }
      },
      'http://example.com',
      {}
    );

    expect(lib.version).toBeUndefined();
  });

  it('should encode ELM json', () => {
    const lib = generateLibraryResource(
      'library',
      {
        library: {
          identifier: {}
        }
      },
      'http://example.com',
      {}
    );

    expect(lib.content).toBeDefined();
    expect(lib.content).toEqual(
      expect.arrayContaining([
        {
          contentType: 'application/elm+json',
          data: expect.any(String)
        }
      ])
    );
  });
});
