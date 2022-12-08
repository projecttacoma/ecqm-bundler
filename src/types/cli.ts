import { ImprovementNotation, ScoringCode } from './measure';

export interface CLIOptions {
  /* Values with defaults */
  out: string;
  interactive: boolean;
  debug: boolean;
  improvementNotation: ImprovementNotation;
  scoringCode: ScoringCode;
  basis: string;
  deps: string[];
  translatorUrl: string;
  canonicalBase: string;
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

  /* Population References */

  numerIpopRef?: string;
  denomIpopRef?: string;
}
