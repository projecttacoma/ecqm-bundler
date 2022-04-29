import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';
import translationService, { Client } from 'cql-translation-service-client';

dotenv.config();

const client = new Client(`${process.env.TRANSLATOR_URL}?annotations=true&locators=true`);

async function translateCQL(paths: string[]): Promise<any> {
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

export async function getELM(cqlPaths: string[]): Promise<any[]> {
  try {
    const librariesOrError = await translateCQL(cqlPaths);

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

export function getMainLibraryId(cql: string): string | null {
  const re = /library ([a-zA-Z0-9_]+)( version .*)?/g;

  const matches = re.exec(cql);

  if (matches) {
    return matches[1];
  }

  return null;
}
