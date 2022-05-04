import fs from 'fs';
import path from 'path';
import { getELM } from '../../src/helpers/translator';

const TRANSLATOR_URL = 'http://localhost:8080/cql/translator';

const simpleLibraryCQL = path.join(__dirname, './SimpleLibrary.cql');
const simpleLibraryDependencyCQL = path.join(__dirname, './SimpleLibraryDependency.cql');

getELM([simpleLibraryCQL, simpleLibraryDependencyCQL], TRANSLATOR_URL, 'SimpleLibrary')
  .then(([elm, errors]) => {
    if (elm == null || errors != null) {
      throw new Error(`Error translating ELM: ${JSON.stringify(errors)}`);
    }

    elm.forEach(lib => {
      const p = path.join(__dirname, `./${lib.library.identifier.id}.json`);
      fs.writeFileSync(p, JSON.stringify(lib, null, 2), 'utf8');

      console.log(`Wrote ELM JSON to ${p}`);
    });
  })
  .catch(e => {
    console.error(`Error generating test data: ${e.message}`);
  });
