export const scoringCodes = ['proportion', 'ratio', 'continuous-variable', 'cohort'] as const;

export type ScoringCode = typeof scoringCodes[number];

export const improvementNotation = ['increase', 'decrease'] as const;

export type ImprovementNotation = typeof improvementNotation[number];

export const measurePopulations = [
  'initial-population',
  'numerator',
  'numerator-exclusion',
  'denominator',
  'denominator-exclusion',
  'denominator-exception',
  'measure-population',
  'measure-population-exclusion',
  'measure-observation'
] as const;

export type MeasurePopulation = typeof measurePopulations[number];

export interface PopulationInfo {
  id: string;
  criteriaExpression: string;
  observingPopId?: string;
}

export type SinglePopulationCriteria = Omit<
  Record<MeasurePopulation, PopulationInfo>,
  'measure-observation' | 'initial-population'
>;

export type MultiPopulationCriteria = {
  'measure-observation': PopulationInfo[];
  'initial-population': PopulationInfo[];
};

export type SingleOrMultiPopulationCriteria<T extends string | string[]> = T extends string[]
  ? Partial<MultiPopulationCriteria>
  : Partial<SinglePopulationCriteria>;

export type GroupPopulationCriteria = Partial<SinglePopulationCriteria & MultiPopulationCriteria>;

export interface GroupInfo {
  scoring: ScoringCode;
  improvementNotation: ImprovementNotation;
  populationBasis: string;
  populationCriteria: GroupPopulationCriteria;
}
