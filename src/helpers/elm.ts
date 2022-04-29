export interface ELMIdentification {
  id: string;
  version?: string;
}

export function getDependencyInfo(elm: any): ELMIdentification[] {
  if (elm.library.includes?.def) {
    const deps: ELMIdentification[] = elm.library.includes.def.map((i: any) => ({
      id: i.path,
      ...(i.version ? { version: i.version } : {})
    }));

    return deps.filter(
      (d, i) =>
        deps.findIndex(
          dep => dep.id === d.id && (dep.version ? dep.version === d.version : true)
        ) === i
    );
  }

  return [];
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
