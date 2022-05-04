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

async function translateCQL(paths: string[], client: Client, mainLibraryId: string): Promise<any> {
  const cqlRequestBody = getCQLInfo(paths);

  const usedDependencyIds = [
    ...new Set(resolveDependencies(cqlRequestBody[mainLibraryId].cql, cqlRequestBody))
  ];

  // Only include cql files that are explicitly included by the dependency chain
  Object.keys(cqlRequestBody).forEach(k => {
    if (k !== mainLibraryId && !usedDependencyIds.includes(k)) {
      delete cqlRequestBody[k];
    }
  });

  const elm = await client.convertCQL(cqlRequestBody);
  return elm;
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

export async function getELM(
  cqlPaths: string[],
  translatorUrl: string,
  mainLibraryId: string
): Promise<[any[] | null, any[] | null]> {
  const client = new Client(`${translatorUrl}?annotations=true&locators=true`);
  const librariesOrError = await translateCQL(cqlPaths, client, mainLibraryId);

  if (librariesOrError instanceof Error) throw librariesOrError;

  const allELM: any[] = [];
  for (const key in librariesOrError) {
    const elm = librariesOrError[key];
    const errors = processErrors(elm as any);
    if (errors.length === 0) {
      allELM.push(elm as any);
    } else {
      return [null, errors];
    }
  }

  return [allELM, null];
}
