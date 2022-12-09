import { v4 as uuidv4 } from 'uuid';
import {
  GroupPopulationCriteria,
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

export function findReferencedPopulation(
  targetCriteriaExpression: string,
  allPopulationCriteria: GroupPopulationCriteria
): PopulationInfo | null {
  const matchingPopEntry = Object.values(allPopulationCriteria).find(populationInfo => {
    if (Array.isArray(populationInfo)) {
      return populationInfo.some(pi => pi.criteriaExpression === targetCriteriaExpression);
    } else {
      return populationInfo.criteriaExpression === targetCriteriaExpression;
    }
  });

  if (!matchingPopEntry) {
    return null;
  }

  const matchingPop = Array.isArray(matchingPopEntry)
    ? matchingPopEntry.find(op => op.criteriaExpression === targetCriteriaExpression)
    : matchingPopEntry;

  if (!matchingPop) {
    return null;
  }

  return matchingPop;
}
