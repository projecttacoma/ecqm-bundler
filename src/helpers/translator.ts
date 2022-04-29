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
        errors.push(a as object);
      }
    });
  }

  return errors;
}

export async function getELM(cqlPaths: string[], translatorUrl: string): Promise<any[]> {
  try {
    const client = new Client(`${translatorUrl}?annotations=true&locators=true`);
    const librariesOrError = await translateCQL(cqlPaths, client);

    if (librariesOrError instanceof Error) throw librariesOrError;

    const allELM: any[] = [];
    Object.values(librariesOrError).forEach(elm => {
      const errors = processErrors(elm as any);
      if (errors.length === 0) {
        allELM.push(elm as any);
      } else {
        console.error('Error translating to ELM');
        console.error(errors);
        process.exit(1);
      }
    });

    return allELM;
  } catch (e: any) {
    console.error(`HTTP error translating CQL: ${e.message}`);
    console.error(e.stack);
    process.exit(1);
  }
}
