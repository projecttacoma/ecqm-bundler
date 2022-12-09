import { v4 as uuidv4 } from 'uuid';
import {
  MeasurePopulation,
  PopulationInfo,
  SingleOrMultiPopulationCriteria
} from '../types/measure';

export function makeSimplePopulationCriteria<T extends string | string[]>(
  popCode: MeasurePopulation,
  criteriaExpression: T
): SingleOrMultiPopulationCriteria<T> {
  if (Array.isArray(criteriaExpression)) {
    return {
      [popCode]: criteriaExpression.map(ce => {
        const criteria: PopulationInfo = {
          id: uuidv4(),
          criteriaExpression: ce
        };

        return criteria;
      })
    };
  }

  const criteria: PopulationInfo = {
    id: uuidv4(),
    criteriaExpression
  };

  return {
    [popCode]: criteria
  };
}
