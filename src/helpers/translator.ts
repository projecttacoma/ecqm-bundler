import fs from 'fs';
import path from 'path';
import translationService, { Client } from 'cql-translation-service-client';

async function translateCQL(paths: string[], client: Client): Promise<any> {
  const cqlRequestBody: translationService.CqlLibraries = {};

  paths.forEach(f => {
    cqlRequestBody[path.basename(f, '.cql')] = {
      cql: fs.readFileSync(f, 'utf8')
    };
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
  translatorUrl: string
): Promise<[any[] | null, any[] | null]> {
  const client = new Client(`${translatorUrl}?annotations=true&locators=true`);
  const librariesOrError = await translateCQL(cqlPaths, client);

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
