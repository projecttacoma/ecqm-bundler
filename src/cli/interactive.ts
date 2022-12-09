import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { extractDefinesFromCQL } from '../helpers/cql';
import {
  GroupInfo,
  improvementNotation,
  ImprovementNotation,
  measurePopulations,
  ScoringCode,
  scoringCodes
} from '../types/measure';

const EXPR_SKIP_CHOICE = 'SKIP';

export async function collectInteractiveInput(mainCQLPath: string): Promise<GroupInfo[]> {
  const { default: inquirer } = await import('inquirer');
  const mainCQL = fs.readFileSync(mainCQLPath, 'utf8');

  const expressionNames = extractDefinesFromCQL(mainCQL);

  const allGroupInfo: GroupInfo[] = [];

  const { numberOfGroups } = await inquirer.prompt<{ numberOfGroups: number }>({
    name: 'numberOfGroups',
    type: 'number',
    message: 'Enter number of Groups in the Measure',
    default: 1
  });

  for (let i = 0; i < numberOfGroups; i++) {
    const selectedGroupExpressions = [...expressionNames];
    const group = `Group ${i + 1}`;

    const { scoring, measureImprovementNotation, populationBasis, numMeasureObs } =
      await inquirer.prompt<{
        scoring: ScoringCode;
        measureImprovementNotation: ImprovementNotation;
        populationBasis: string;
        numMeasureObs: number;
      }>([
        {
          name: 'scoring',
          type: 'list',
          message: `Enter ${group} scoring code`,
          choices: scoringCodes
        },
        {
          name: 'measureImprovementNotation',
          type: 'list',
          message: `Enter ${group} improvement notation`,
          choices: improvementNotation
        },
        {
          name: 'populationBasis',
          type: 'input',
          message: `Enter ${group} population basis (see https://build.fhir.org/ig/HL7/cqf-measures/StructureDefinition-cqfm-populationBasis.html for more info)`,
          default: 'boolean'
        },
        {
          name: 'numMeasureObs',
          type: 'number',
          message: `Enter ${group} number of "measure-observation"s`,
          default: 0
        }
      ]);

    const groupInfo: GroupInfo = {
      scoring,
      improvementNotation: measureImprovementNotation,
      populationBasis,
      populationCriteria: {}
    };

    let numIPPs = 1;
    if (scoring === 'ratio') {
      const { numIPPsChoice } = await inquirer.prompt<{ numIPPsChoice: number }>({
        name: 'numIPPsChoice',
        type: 'number',
        message: `Enter ${group} number of "initial-population"s`,
        default: 1
      });

      numIPPs = numIPPsChoice;
    }

    for (const popCode of measurePopulations) {
      if (selectedGroupExpressions.length === 0) continue;

      if (popCode === 'initial-population') {
        for (let j = 0; j < numIPPs; j++) {
          const { criteriaExpression } = await inquirer.prompt<{
            criteriaExpression: string;
          }>({
            name: 'criteriaExpression',
            type: 'list',
            message: `${group} "${popCode}" ${j + 1} expression`,
            choices: selectedGroupExpressions
          });

          if (groupInfo.populationCriteria['initial-population']) {
            groupInfo.populationCriteria['initial-population'].push({
              id: uuidv4(),
              criteriaExpression
            });
          } else {
            groupInfo.populationCriteria['initial-population'] = [
              {
                id: uuidv4(),
                criteriaExpression
              }
            ];
          }

          selectedGroupExpressions.splice(selectedGroupExpressions.indexOf(criteriaExpression), 1);
        }
      } else if (popCode === 'measure-observation') {
        for (let j = 0; j < numMeasureObs; j++) {
          const { measureObsCriteriaExpression } = await inquirer.prompt<{
            measureObsCriteriaExpression: string;
          }>({
            name: 'measureObsCriteriaExpression',
            type: 'list',
            message: `${group} "${popCode}" expression`,
            choices: [EXPR_SKIP_CHOICE].concat(selectedGroupExpressions)
          });

          if (measureObsCriteriaExpression !== EXPR_SKIP_CHOICE) {
            const { observingPopExpression } = await inquirer.prompt<{
              observingPopExpression: string;
            }>({
              name: 'observingPopExpression',
              type: 'list',
              message: `${group} "${popCode}" ${measureObsCriteriaExpression} observing population`,
              choices: expressionNames
            });

            const observingPops = Object.values(groupInfo.populationCriteria).find(gi => {
              if (Array.isArray(gi)) {
                return gi.some(g => g.criteriaExpression === observingPopExpression);
              }

              return gi.criteriaExpression === observingPopExpression;
            });

            if (!observingPops) {
              throw new Error(`Could not find population ${observingPopExpression} in group`);
            }

            const observingPop = Array.isArray(observingPops)
              ? observingPops.find(op => op.criteriaExpression === observingPopExpression)
              : observingPops;

            if (!observingPop) {
              throw new Error(`Could not find population ${observingPopExpression} in group`);
            }

            if (groupInfo.populationCriteria['measure-observation']) {
              groupInfo.populationCriteria['measure-observation'].push({
                id: uuidv4(),
                criteriaExpression: measureObsCriteriaExpression,
                observingPopId: observingPop.id
              });
            } else {
              groupInfo.populationCriteria['measure-observation'] = [
                {
                  id: uuidv4(),
                  criteriaExpression: measureObsCriteriaExpression,
                  observingPopId: observingPop.id
                }
              ];
            }

            selectedGroupExpressions.splice(
              selectedGroupExpressions.indexOf(measureObsCriteriaExpression),
              1
            );
          }
        }
      } else {
        const { criteriaExpression } = await inquirer.prompt<{
          criteriaExpression: string;
        }>({
          name: 'criteriaExpression',
          type: 'list',
          message: `${group} "${popCode}" expression`,
          choices: [EXPR_SKIP_CHOICE].concat(selectedGroupExpressions)
        });

        if (criteriaExpression !== EXPR_SKIP_CHOICE) {
          groupInfo.populationCriteria[popCode] = { id: uuidv4(), criteriaExpression };
          selectedGroupExpressions.splice(selectedGroupExpressions.indexOf(criteriaExpression), 1);
        }
      }

      if (scoring === 'ratio' && numIPPs > 1) {
        if (popCode === 'numerator' || popCode === 'denominator') {
          if (!groupInfo.populationCriteria['initial-population']) {
            throw new Error(
              `Could not detect initial-population entries to draw from for ratio measure with multipe IPPs`
            );
          }

          const { observingPopExpression } = await inquirer.prompt<{
            observingPopExpression: string;
          }>({
            name: 'observingPopExpression',
            type: 'list',
            message: `${group} initial-population that "${popCode}" draws from`,
            choices: groupInfo.populationCriteria['initial-population'].map(
              p => p.criteriaExpression
            )
          });

          const observingPopId = groupInfo.populationCriteria['initial-population'].find(
            p => p.criteriaExpression === observingPopExpression
          )?.id;

          if (!observingPopId) {
            throw new Error(`Could not find population ${observingPopExpression} in group`);
          }

          const gi = groupInfo.populationCriteria[popCode];
          if (!gi) {
            throw new Error(
              `Trying to set a criteria reference on ${popCode}, but no criteriaExpression was defined for it`
            );
          }

          gi.observingPopId = observingPopId;
        }
      }
    }

    allGroupInfo.push(groupInfo);
  }

  return allGroupInfo;
}
