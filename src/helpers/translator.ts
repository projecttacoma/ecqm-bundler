import fs from 'fs';
import translationService, { Client } from 'cql-translation-service-client';
import { getMainLibraryId } from './cql';

export function getCQLInfo(cqlFiles: string[]): translationService.CqlLibraries {
  const info: translationService.CqlLibraries = {};

  cqlFiles.forEach(f => {
    const cql = fs.readFileSync(f, 'utf8');
    const libraryId = getMainLibraryId(cql);

    if (libraryId) {
      info[libraryId] = { cql };
    }
  });

  return info;
}

export function resolveDependencies(
  mainCqlContent: string,
  allCql: translationService.CqlLibraries
): string[] {
  const res: string[] = [];
  const re = /^include ([a-zA-Z0-9_]+)( version .*)?/gm;
  let includes;
  while ((includes = re.exec(mainCqlContent))) {
    const libraryId = includes[1];

    res.push(libraryId);
    if (allCql[libraryId]) {
      res.push(...resolveDependencies(allCql[libraryId].cql, allCql));
    }
  }

  return res;
}

async function translateCQL(
  paths: string[],
  client: Client,
  mainLibraryId: string
): Promise<{ elm: any; cql: Record<string, string> }> {
  const cqlRequestBody = getCQLInfo(paths);

  const usedDependencyIds = [
    ...new Set(resolveDependencies(cqlRequestBody[mainLibraryId].cql, cqlRequestBody))
  ];

  const cqlReturn: Record<string, string> = {};

  // Only include cql files that are explicitly included by the dependency chain
  Object.keys(cqlRequestBody).forEach(k => {
    if (k !== mainLibraryId && !usedDependencyIds.includes(k)) {
      delete cqlRequestBody[k];
    } else {
      cqlReturn[k] = cqlRequestBody[k].cql;
    }
  });

  const elmOrError = await client.convertCQL(cqlRequestBody);

  if (elmOrError instanceof Error) throw elmOrError;

  return { elm: elmOrError, cql: cqlReturn };
}

function processErrors(elm: any): any[] {
  const errors: object[] = [];

  // Check annotations for errors. If no annotations, no errors
  if (elm.library.annotation) {
    elm.library.annotation.forEach((a: any) => {
      if (a.errorSeverity === 'error') {
        errors.push(a);
      }
    });
  }

  return errors;
}

export interface TranslationResuls {
  elm: any[];
  cqlLookup: Record<string, string>;
}

export async function getELM(
  cqlPaths: string[],
  translatorUrl: string,
  mainLibraryId: string
): Promise<[TranslationResuls | null, any[] | null]> {
  const client = new Client(`${translatorUrl}?annotations=true&locators=true`);
  const { elm: libraries, cql } = await translateCQL(cqlPaths, client, mainLibraryId);

  const allELM: any[] = [];
  for (const key in libraries) {
    const elm = libraries[key];
    const errors = processErrors(elm);
    if (errors.length === 0) {
      allELM.push(elm);
    } else {
      return [null, errors];
    }
  }

  return [{ elm: allELM, cqlLookup: cql }, null];
}
