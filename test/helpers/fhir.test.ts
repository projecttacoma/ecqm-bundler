import { generateMeasureResource, ImprovementNotation, Scoring } from '../../src/helpers/fhir';

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
