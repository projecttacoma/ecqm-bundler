export interface ELMIdentification {
  id: string;
  version?: string;
}

export function getDependencyInfo(mainELM: any, allELM: any[]): ELMIdentification[] {
  const deps: ELMIdentification[] = [];
  if (mainELM.library.includes?.def) {
    mainELM.library.includes.def.forEach((def: any) => {
      deps.push({
        id: def.path,
        ...(def.version ? { version: def.version } : {})
      });

      const dep = allELM.find(
        e =>
          e.library.identifier.id === def.path &&
          (def.version ? def.version === e.library.identifier.version : true)
      );

      if (!dep) {
        throw new Error(
          `Could not resolve dependency ${def.path}|${def.version} in dependency array`
        );
      }

      deps.push(...getDependencyInfo(dep, allELM));
    });
  }

  return deps;
}

export function findELMByIdentifier(identifier: ELMIdentification, elm: any[]): any {
  return elm.find(e => {
    let criteria = e.library.identifier.id === identifier.id;

    if (identifier.version) {
      criteria = criteria && e.library.identifier.version === identifier.version;
    }

    return criteria;
  });
}

export function getValueSetInfo(elm: any): string[] {
  if (elm.library.valueSets?.def) {
    return [...new Set(elm.library.valueSets.def.map((v: any) => v.id))] as string[];
  }

  return [];
}
