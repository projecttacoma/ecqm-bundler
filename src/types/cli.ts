import { ImprovementNotation, ScoringCode } from './measure';

export interface DetailedMeasureObservationOption {
  expression: string;
  observingPopulationExpression: string;
}

export interface DetailedCompositeMeasureComponent {
  measureSlug: string;
  groupId?: string;
  weight?: number;
}

export interface BaseOpts {
  out: string;
  improvementNotation: ImprovementNotation;
  canonicalBase: string;
  measureVersion?: string;
}

export interface CLIOptions {
  /* Values with defaults */
  interactive: boolean;
  debug: boolean;
  scoringCode: ScoringCode;
  basis: string;
  deps: string[];
  translatorUrl: string;
  /* -------------------- */
  cqlFile?: string;
  elmFile?: string;
  depsDirectory?: string;
  ipop?: string[];
  numer?: string;
  numex?: string;
  denom?: string;
  denex?: string;
  denexcep?: string;
  msrpopl?: string;
  msrpoplex?: string;
  msrobs?: string[];
  valuesets?: string | boolean;
  disableConstraints?: boolean;

  /* Population References */

  numerIpopRef?: string;
  denomIpopRef?: string;
  detailedMsrobs?: DetailedMeasureObservationOption[];
}
