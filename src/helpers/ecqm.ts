import { GroupInfo, MeasurePopulation } from '../types/measure';

/*
 * See table 3-1 here: https://build.fhir.org/ig/HL7/cqf-measures/measure-conformance.html#criteria-names
 */
export function getPopulationConstraintErrors(groupInfoList: GroupInfo[]): string[] {
  const errors: string[] = [];
  groupInfoList.forEach((groupInfo, i) => {
    const groupDisplay = `Group ${i + 1}`;
    let requiredPopulations: MeasurePopulation[] = [];
    let disallowedPopulations: MeasurePopulation[] = [];

    switch (groupInfo.scoring) {
      case 'proportion':
        requiredPopulations = ['initial-population', 'denominator', 'numerator'];
        disallowedPopulations = ['measure-population', 'measure-population-exclusion'];
        break;
      case 'ratio':
        requiredPopulations = ['initial-population', 'denominator', 'numerator'];
        disallowedPopulations = [
          'denominator-exception',
          'measure-population',
          'measure-population-exclusion'
        ];
        break;
      case 'continuous-variable':
        requiredPopulations = ['initial-population', 'measure-population'];
        disallowedPopulations = [
          'denominator',
          'denominator-exclusion',
          'denominator-exception',
          'numerator',
          'numerator-exclusion'
        ];
        break;
      case 'cohort':
        requiredPopulations = ['initial-population'];
        disallowedPopulations = [
          'denominator',
          'denominator-exclusion',
          'denominator-exception',
          'numerator',
          'numerator-exclusion',
          'measure-population',
          'measure-population-exclusion'
        ];
        break;
      default:
        break;
    }

    const providedPopulations = Object.keys(groupInfo.populationCriteria) as MeasurePopulation[];

    const disallowedPopulationViolations = providedPopulations.filter(p =>
      disallowedPopulations.includes(p)
    );

    if (disallowedPopulationViolations.length > 0) {
      errors.push(
        `${groupDisplay}: ${disallowedPopulationViolations} not permitted when using scoring "${groupInfo.scoring}"`
      );
    }

    const missingRequiredPopulations = requiredPopulations.filter(
      rp => !providedPopulations.includes(rp)
    );

    if (missingRequiredPopulations.length > 0) {
      errors.push(
        `${groupDisplay}: ${missingRequiredPopulations} required when using scoring "${groupInfo.scoring}"`
      );
    }
  });

  return errors;
}
