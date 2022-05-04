import { getMainLibraryId } from '../../src/helpers/cql';

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
