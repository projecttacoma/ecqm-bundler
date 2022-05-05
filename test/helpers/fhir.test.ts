/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  combineURLs,
  generateLibraryResource,
  generateMeasureResource,
  ImprovementNotation,
  Scoring
} from '../../src/helpers/fhir';

describe('generateMeasureResource', () => {
  it('should generate proper positive improvement measure resource with inputs', () => {
    const measure = generateMeasureResource(
      'measure',
      'library',
      ImprovementNotation.POSITIVE,
      Scoring.PROPORTION,
      'http://example.com',
      {
        'initial-population': 'Initial Population',
        numerator: 'Numerator',
        denominator: 'Denominator'
      }
    );

    expect(measure).toBeDefined();
    expect(measure.resourceType).toEqual('Measure');
    expect(measure.id).toEqual('measure');
    expect(measure.url).toEqual('http://example.com/Measure/measure');
    expect(measure.library).toEqual(['Library/library']);
    expect(measure.improvementNotation).toEqual({
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/measure-improvement-notation',
          code: 'increase'
        }
      ]
    });
    expect(measure.scoring).toEqual({
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/measure-scoring',
          code: 'proportion'
        }
      ]
    });
    expect(measure.group).toEqual([
      {
        population: [
          {
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
              expression: 'Initial Population'
            }
          },
          {
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
              expression: 'Denominator'
            }
          },

          {
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
              expression: 'Numerator'
            }
          }
        ]
      }
    ]);
  });

  it('should generate proper negative improvement measure resource with inputs', () => {
    const measure = generateMeasureResource(
      'measure',
      'library',
      ImprovementNotation.NEGATIVE,
      Scoring.PROPORTION,
      'http://example.com',
      {
        'initial-population': 'Initial Population',
        numerator: 'Numerator',
        denominator: 'Denominator'
      }
    );

    expect(measure).toBeDefined();
    expect(measure.improvementNotation).toEqual({
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/measure-improvement-notation',
          code: 'decrease'
        }
      ]
    });
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
      'http://example.com'
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
      'http://example.com'
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
      'http://example.com'
    );

    expect(lib.content).toBeDefined();
    expect(lib.content).toHaveLength(1);
    expect(lib.content![0].contentType).toEqual('application/elm+json');
    expect(typeof lib.content![0].data).toEqual('string');
  });
});
