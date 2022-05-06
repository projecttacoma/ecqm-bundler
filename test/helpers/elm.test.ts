import {
  findELMByIdentifier,
  getAllDependencyInfo,
  getDependencyInfo,
  getValueSetInfo
} from '../../src/helpers/elm';
import simpleLibraryELM from '../fixtures/SimpleLibrary.json';
import simpleLibraryDependencyELM from '../fixtures/SimpleLibraryDependency.json';

describe('getDependencyInfo', () => {
  it('should return [] for library with no dependencies', () => {
    expect(getDependencyInfo(simpleLibraryDependencyELM)).toEqual([]);
  });

  it('should resolve dependency in library', () => {
    expect(getDependencyInfo(simpleLibraryELM)).toEqual([
      {
        id: simpleLibraryDependencyELM.library.identifier.id,
        version: simpleLibraryDependencyELM.library.identifier.version
      }
    ]);
  });
});

describe('getAllDependencyInfo', () => {
  it('should combine dependencies into one list', () => {
    expect(getAllDependencyInfo([simpleLibraryELM, simpleLibraryDependencyELM])).toEqual([
      {
        id: simpleLibraryDependencyELM.library.identifier.id,
        version: simpleLibraryDependencyELM.library.identifier.version
      }
    ]);
  });
});

describe('findELMByIdentifier', () => {
  const allELM = [simpleLibraryELM, simpleLibraryDependencyELM];

  it('should return elm by id', () => {
    expect(findELMByIdentifier({ id: simpleLibraryELM.library.identifier.id }, allELM)).toEqual(
      simpleLibraryELM
    );
  });

  it('should return elm by id and version', () => {
    expect(
      findELMByIdentifier(
        {
          id: simpleLibraryELM.library.identifier.id,
          version: simpleLibraryELM.library.identifier.version
        },
        allELM
      )
    ).toEqual(simpleLibraryELM);
  });

  it('should return null for no matching elm', () => {
    expect(
      findELMByIdentifier(
        {
          id: 'notreal'
        },
        allELM
      )
    ).toBeNull();
  });

  it('should return null for no elm', () => {
    expect(
      findELMByIdentifier(
        {
          id: 'notreal'
        },
        []
      )
    ).toBeNull();
  });
});

describe('getValueSetInfo', () => {
  it('should return [] for no valuesets', () => {
    expect(getValueSetInfo(simpleLibraryDependencyELM)).toEqual([]);
  });

  it('should return proper vs for library with valueset def', () => {
    expect(getValueSetInfo(simpleLibraryELM)).toEqual(['http://example.com/example-vs']);
  });
});
