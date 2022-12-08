import { getPopulationConstraintErrors } from '../../src/helpers/ecqm';
import { GroupInfo } from '../../src/types/measure';

describe('enforcePopulationConstraints', () => {
  describe('proportion', () => {
    it('should accept ipp, denom, denex, denexcep, numer, and numex', () => {
      const groupInfo: GroupInfo = {
        scoring: 'proportion',
        populationBasis: 'boolean',
        improvementNotation: 'increase',
        populationCriteria: {
          'initial-population': [{ id: 'test-id', criteriaExpression: '' }],
          denominator: { id: 'test-id', criteriaExpression: '' },
          'denominator-exception': { id: 'test-id', criteriaExpression: '' },
          'denominator-exclusion': { id: 'test-id', criteriaExpression: '' },
          numerator: { id: 'test-id', criteriaExpression: '' },
          'numerator-exclusion': { id: 'test-id', criteriaExpression: '' }
        }
      };

      const errors = getPopulationConstraintErrors([groupInfo]);

      expect(errors).toHaveLength(0);
    });

    it('should require ipp, denom, and numer', () => {
      const groupInfo: GroupInfo = {
        scoring: 'proportion',
        populationBasis: 'boolean',
        improvementNotation: 'increase',
        populationCriteria: {}
      };

      const errors = getPopulationConstraintErrors([groupInfo]);

      expect(errors).toEqual(
        expect.arrayContaining([
          expect.stringMatching(
            'initial-population,denominator,numerator required when using scoring "proportion"'
          )
        ])
      );
    });

    it('should disallow msrpopl and msrpoplex', () => {
      const groupInfo: GroupInfo = {
        scoring: 'proportion',
        populationBasis: 'boolean',
        improvementNotation: 'increase',
        populationCriteria: {
          'measure-population': { id: 'test-id', criteriaExpression: '' },
          'measure-population-exclusion': { id: 'test-id', criteriaExpression: '' }
        }
      };

      const errors = getPopulationConstraintErrors([groupInfo]);

      expect(errors).toEqual(
        expect.arrayContaining([
          expect.stringMatching(
            'measure-population,measure-population-exclusion not permitted when using scoring "proportion"'
          )
        ])
      );
    });
  });

  describe('ratio', () => {
    it('should accept ipp, denom, denex, numer, and numex', () => {
      const groupInfo: GroupInfo = {
        scoring: 'ratio',
        populationBasis: 'boolean',
        improvementNotation: 'increase',
        populationCriteria: {
          'initial-population': [{ id: 'test-id', criteriaExpression: '' }],
          denominator: { id: 'test-id', criteriaExpression: '' },
          'denominator-exclusion': { id: 'test-id', criteriaExpression: '' },
          numerator: { id: 'test-id', criteriaExpression: '' },
          'numerator-exclusion': { id: 'test-id', criteriaExpression: '' }
        }
      };

      const errors = getPopulationConstraintErrors([groupInfo]);

      expect(errors).toHaveLength(0);
    });

    it('should require ipp, denom, and numer', () => {
      const groupInfo: GroupInfo = {
        scoring: 'ratio',
        populationBasis: 'boolean',
        improvementNotation: 'increase',
        populationCriteria: {}
      };

      const errors = getPopulationConstraintErrors([groupInfo]);

      expect(errors).toEqual(
        expect.arrayContaining([
          expect.stringMatching(
            'initial-population,denominator,numerator required when using scoring "ratio"'
          )
        ])
      );
    });

    it('should disallow denexcep, msrpopl and msrpoplex', () => {
      const groupInfo: GroupInfo = {
        scoring: 'ratio',
        populationBasis: 'boolean',
        improvementNotation: 'increase',
        populationCriteria: {
          'denominator-exception': { id: 'test-id', criteriaExpression: '' },
          'measure-population': { id: 'test-id', criteriaExpression: '' },
          'measure-population-exclusion': { id: 'test-id', criteriaExpression: '' }
        }
      };

      const errors = getPopulationConstraintErrors([groupInfo]);

      expect(errors).toEqual(
        expect.arrayContaining([
          expect.stringMatching(
            'denominator-exception,measure-population,measure-population-exclusion not permitted when using scoring "ratio"'
          )
        ])
      );
    });
  });

  describe('continuous-variable', () => {
    it('should accept ipp, msrpopl, and msrpoplex', () => {
      const groupInfo: GroupInfo = {
        scoring: 'continuous-variable',
        populationBasis: 'boolean',
        improvementNotation: 'increase',
        populationCriteria: {
          'initial-population': [{ id: 'test-id', criteriaExpression: '' }],
          'measure-population': { id: 'test-id', criteriaExpression: '' },
          'measure-population-exclusion': { id: 'test-id', criteriaExpression: '' }
        }
      };

      const errors = getPopulationConstraintErrors([groupInfo]);

      expect(errors).toHaveLength(0);
    });

    it('should require ipp and msrpopl', () => {
      const groupInfo: GroupInfo = {
        scoring: 'continuous-variable',
        populationBasis: 'boolean',
        improvementNotation: 'increase',
        populationCriteria: {}
      };

      const errors = getPopulationConstraintErrors([groupInfo]);

      expect(errors).toEqual(
        expect.arrayContaining([
          expect.stringMatching(
            'initial-population,measure-population required when using scoring "continuous-variable"'
          )
        ])
      );
    });

    it('should disallow denom, denex, denexcep, numer, numex', () => {
      const groupInfo: GroupInfo = {
        scoring: 'continuous-variable',
        populationBasis: 'boolean',
        improvementNotation: 'increase',
        populationCriteria: {
          denominator: { id: 'test-id', criteriaExpression: '' },
          'denominator-exception': { id: 'test-id', criteriaExpression: '' },
          'denominator-exclusion': { id: 'test-id', criteriaExpression: '' },
          numerator: { id: 'test-id', criteriaExpression: '' },
          'numerator-exclusion': { id: 'test-id', criteriaExpression: '' }
        }
      };

      const errors = getPopulationConstraintErrors([groupInfo]);

      expect(errors).toEqual(
        expect.arrayContaining([
          expect.stringMatching(
            'denominator,denominator-exception,denominator-exclusion,numerator,numerator-exclusion not permitted when using scoring "continuous-variable"'
          )
        ])
      );
    });
  });

  describe('cohort', () => {
    it('should accept ipp', () => {
      const groupInfo: GroupInfo = {
        scoring: 'cohort',
        populationBasis: 'boolean',
        improvementNotation: 'increase',
        populationCriteria: {
          'initial-population': [{ id: 'test-id', criteriaExpression: '' }]
        }
      };

      const errors = getPopulationConstraintErrors([groupInfo]);

      expect(errors).toHaveLength(0);
    });

    it('should require ipp', () => {
      const groupInfo: GroupInfo = {
        scoring: 'cohort',
        populationBasis: 'boolean',
        improvementNotation: 'increase',
        populationCriteria: {}
      };

      const errors = getPopulationConstraintErrors([groupInfo]);

      expect(errors).toEqual(
        expect.arrayContaining([
          expect.stringMatching('initial-population required when using scoring "cohort"')
        ])
      );
    });

    it('should disallow denom, denex, denexcep, numer, numex, msrpopl, msrpoplex', () => {
      const groupInfo: GroupInfo = {
        scoring: 'cohort',
        populationBasis: 'boolean',
        improvementNotation: 'increase',
        populationCriteria: {
          denominator: { id: 'test-id', criteriaExpression: '' },
          'denominator-exception': { id: 'test-id', criteriaExpression: '' },
          'denominator-exclusion': { id: 'test-id', criteriaExpression: '' },
          numerator: { id: 'test-id', criteriaExpression: '' },
          'numerator-exclusion': { id: 'test-id', criteriaExpression: '' },
          'measure-population': { id: 'test-id', criteriaExpression: '' },
          'measure-population-exclusion': { id: 'test-id', criteriaExpression: '' }
        }
      };

      const errors = getPopulationConstraintErrors([groupInfo]);

      expect(errors).toEqual(
        expect.arrayContaining([
          expect.stringMatching(
            'denominator,denominator-exception,denominator-exclusion,numerator,numerator-exclusion,measure-population,measure-population-exclusion not permitted when using scoring "cohort"'
          )
        ])
      );
    });
  });
});
