import { combineGroups } from '../../src/cli/combine-groups';

describe('combineGroups', () => {
  it('should deep combine the groups of two bundles', () => {
    const g1: fhir4.MeasureGroup = {
      id: 'group-1',
      population: [
        {
          criteria: {
            language: 'text/cql',
            expression: 'group-1-expr'
          }
        }
      ]
    };

    const g2: fhir4.MeasureGroup = {
      id: 'group-2',
      population: [
        {
          criteria: {
            language: 'text/cql',
            expression: 'group-2-expr'
          }
        }
      ]
    };

    const b1Entry: fhir4.BundleEntry = {
      resource: {
        resourceType: 'Measure',
        status: 'unknown',
        group: [g1]
      }
    };

    const b2Entry: fhir4.BundleEntry = {
      resource: {
        resourceType: 'Measure',
        status: 'unknown',
        group: [g2]
      }
    };

    const bundles: fhir4.Bundle[] = [
      {
        resourceType: 'Bundle',
        type: 'collection',
        entry: [b1Entry]
      },
      {
        resourceType: 'Bundle',
        type: 'collection',
        entry: [b2Entry]
      }
    ];

    const combined = combineGroups(bundles);
    expect(combined.entry).toHaveLength(1);
    expect(combined.entry).toEqual(
      expect.arrayContaining<fhir4.BundleEntry>([
        {
          resource: {
            resourceType: 'Measure',
            status: 'unknown',
            group: [g1, g2]
          }
        }
      ])
    );
  });

  it('should throw error when a bundle does has no resources', () => {
    expect(() =>
      combineGroups([
        {
          resourceType: 'Bundle',
          type: 'collection'
        }
      ])
    ).toThrowError(/no entry found/i);
  });

  it('should throw error when a bundles differ in resource count', () => {
    expect(() =>
      combineGroups([
        {
          resourceType: 'Bundle',
          type: 'collection',
          entry: [
            {
              resource: {
                resourceType: 'Measure',
                status: 'unknown'
              }
            }
          ]
        },
        {
          resourceType: 'Bundle',
          type: 'collection',
          entry: []
        }
      ])
    ).toThrowError(/measure bundles must have the same number of resources/i);
  });

  it('should throw error when a bundle does not have a measure resource', () => {
    expect(() =>
      combineGroups([
        {
          resourceType: 'Bundle',
          type: 'collection',
          entry: [
            {
              resource: {
                resourceType: 'Patient'
              }
            }
          ]
        }
      ])
    ).toThrowError(/bundle missing a measure resource/i);
  });
});
