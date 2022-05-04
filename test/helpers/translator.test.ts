import path from 'path';
import { Client } from 'cql-translation-service-client';
import simpleLibraryELM from '../fixtures/SimpleLibrary.json';
import simpleLibraryDependencyELM from '../fixtures/SimpleLibraryDependency.json';
import { getELM } from '../../src/helpers/translator';

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

    const [elm, errors] = await getELM(
      [SIMPLE_LIBRARY_CQL_PATH, SIMPLE_LIBRARY_DEPENDENCY_CQL_PATH],
      MOCK_URL,
      simpleLibraryELM.library.identifier.id
    );

    expect(errors).toBeNull();
    expect(elm).toEqual([simpleLibraryELM, simpleLibraryDependencyELM]);
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

    const [elm, errors] = await getELM(
      [SIMPLE_LIBRARY_CQL_PATH],
      MOCK_URL,
      simpleLibraryELM.library.identifier.id
    );

    expect(elm).toBeNull();
    expect(errors).toEqual([
      {
        errorSeverity: 'error'
      }
    ]);
  });
});
