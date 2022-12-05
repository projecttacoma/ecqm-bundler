import { extractDefinesFromCQL, getMainLibraryId } from '../../src/helpers/cql';

describe('getMainLibraryId', () => {
  it('should return null for no library definition', () => {
    expect(getMainLibraryId('')).toBeNull();
  });

  it('should match library with version', () => {
    const libraryId = 'EXAMPLE';
    const cql = `
      library ${libraryId} version '1.0.0'

      using FHIR version 4.0.1
    `.trim();

    expect(getMainLibraryId(cql)).toEqual(libraryId);
  });

  it('should match library without version', () => {
    const libraryId = 'EXAMPLE';
    const cql = `
      library ${libraryId}

      using FHIR version 4.0.1
    `.trim();

    expect(getMainLibraryId(cql)).toEqual(libraryId);
  });
});

describe('extractDefinesFromCQL', () => {
  it('should return all quoted expression defs', () => {
    const snippet = `
      define "def1":
        true

      define "def2":
        true
    `;

    expect(extractDefinesFromCQL(snippet)).toEqual(['def1', 'def2']);
  });

  it('should return all non-quoted expression defs', () => {
    const snippet = `
      define def1:
        true

      define def2:
        true
    `;

    expect(extractDefinesFromCQL(snippet)).toEqual(['def1', 'def2']);
  });

  it('should return all function defs', () => {
    const snippet = `
      define function fun1():
        true

      define function fun2(arg List<Interval>):
        true
    `;

    expect(extractDefinesFromCQL(snippet)).toEqual(['fun1', 'fun2']);
  });
});
