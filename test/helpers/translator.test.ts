import path from 'path';
import { Client } from 'cql-translation-service-client';
import simpleLibraryELM from '../fixtures/SimpleLibrary.json';
import simpleLibraryDependencyELM from '../fixtures/SimpleLibraryDependency.json';
import { getELM, TranslationResuls } from '../../src/helpers/translator';

const MOCK_URL = 'http://example.com';

const SIMPLE_LIBRARY_CQL_PATH = path.join(__dirname, '../fixtures/SimpleLibrary.cql');
const SIMPLE_LIBRARY_DEPENDENCY_CQL_PATH = path.join(
  __dirname,
  '../fixtures/SimpleLibraryDependency.cql'
);

describe('getELM', () => {
  const convertCQLSpy = jest.spyOn(Client.prototype, 'convertCQL');
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return array of elm with proper response', async () => {
    convertCQLSpy.mockReturnValueOnce(
      Promise.resolve({
        [simpleLibraryELM.library.identifier.id]: simpleLibraryELM,
        [simpleLibraryDependencyELM.library.identifier.id]: simpleLibraryDependencyELM
      })
    );

    const [results, errors] = await getELM(
      [SIMPLE_LIBRARY_CQL_PATH, SIMPLE_LIBRARY_DEPENDENCY_CQL_PATH],
      MOCK_URL,
      simpleLibraryELM.library.identifier.id
    );

    expect(errors).toBeNull();
    expect(results).not.toBeNull();

    const translationResults = results as TranslationResuls;
    expect(translationResults.elm).toEqual([simpleLibraryELM, simpleLibraryDependencyELM]);

    expect(translationResults.cqlLookup).toHaveProperty('SimpleLibrary');
    expect(translationResults.cqlLookup).toHaveProperty('SimpleLibraryDependency');
  });

  it('should throw http error when encountered', async () => {
    convertCQLSpy.mockReturnValueOnce(new Error('http error') as any); // cql-translator-client types are wrong. The function can return an error

    await expect(() =>
      getELM(
        [SIMPLE_LIBRARY_CQL_PATH, SIMPLE_LIBRARY_DEPENDENCY_CQL_PATH],
        MOCK_URL,
        simpleLibraryELM.library.identifier.id
      )
    ).rejects.toThrow();
  });

  it('should return translator errors when encountered', async () => {
    convertCQLSpy.mockReturnValueOnce(
      Promise.resolve({
        [simpleLibraryELM.library.identifier.id]: {
          library: {
            annotation: [
              {
                errorSeverity: 'error'
              }
            ]
          }
        } as any
      })
    );

    const [results, errors] = await getELM(
      [SIMPLE_LIBRARY_CQL_PATH],
      MOCK_URL,
      simpleLibraryELM.library.identifier.id
    );

    expect(results).toBeNull();
    expect(errors).toEqual([
      {
        errorSeverity: 'error'
      }
    ]);
  });
});
