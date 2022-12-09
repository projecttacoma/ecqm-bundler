import { findReferencedPopulation, makeSimplePopulationCriteria } from '../../src/cli/populations';
import { GroupPopulationCriteria, PopulationInfo } from '../../src/types/measure';

describe('makeSimplePopulationCriteria', () => {
  it('should return object with population key and simple value', () => {
    expect(makeSimplePopulationCriteria('numerator', 'numer')).toEqual<GroupPopulationCriteria>({
      numerator: {
        id: expect.any(String),
        criteriaExpression: 'numer'
      }
    });
  });

  it('should return array of objects with keys and simple values for array type', () => {
    expect(
      makeSimplePopulationCriteria('initial-population', ['ipp1', 'ipp2'])
    ).toEqual<GroupPopulationCriteria>({
      'initial-population': [
        {
          id: expect.any(String),
          criteriaExpression: 'ipp1'
        },
        {
          id: expect.any(String),
          criteriaExpression: 'ipp2'
        }
      ]
    });
  });
});

describe('findReferencedPopulation', () => {
  it('should return null for no population criteria', () => {
    expect(findReferencedPopulation('DOESNOTEXIST', {})).toBeNull();
  });

  it('should find non-array population by expression', () => {
    const numeratorPopInfo: PopulationInfo = {
      id: 'test-id',
      criteriaExpression: 'numer'
    };

    const popCriteria: GroupPopulationCriteria = {
      numerator: numeratorPopInfo
    };

    expect(findReferencedPopulation('numer', popCriteria)).toEqual(numeratorPopInfo);
  });

  it('should find array population by expression', () => {
    const ipp1: PopulationInfo = {
      id: 'test-id-1',
      criteriaExpression: 'ipp1'
    };

    const ipp2: PopulationInfo = {
      id: 'test-id-2',
      criteriaExpression: 'ipp2'
    };

    const popCriteria: GroupPopulationCriteria = {
      'initial-population': [ipp1, ipp2]
    };

    expect(findReferencedPopulation('ipp1', popCriteria)).toEqual(ipp1);
    expect(findReferencedPopulation('ipp2', popCriteria)).toEqual(ipp2);
  });

  it('should return null for no matching non-array population', () => {
    const numeratorPopInfo: PopulationInfo = {
      id: 'test-id',
      criteriaExpression: 'numer'
    };

    const popCriteria: GroupPopulationCriteria = {
      numerator: numeratorPopInfo
    };

    expect(findReferencedPopulation('DOESNOTEXIST', popCriteria)).toBeNull();
  });

  it('should return null for no matching array population', () => {
    const ipp1: PopulationInfo = {
      id: 'test-id-1',
      criteriaExpression: 'ipp1'
    };

    const ipp2: PopulationInfo = {
      id: 'test-id-2',
      criteriaExpression: 'ipp2'
    };

    const popCriteria: GroupPopulationCriteria = {
      'initial-population': [ipp1, ipp2]
    };

    expect(findReferencedPopulation('DOESNOTEXIST', popCriteria)).toBeNull();
  });
});
