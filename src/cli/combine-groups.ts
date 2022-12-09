export function combineGroups(bundles: fhir4.Bundle[]) {
  const bundle1Length = bundles[0].entry?.length;

  if (!bundle1Length) {
    throw new Error(`No entry found on bundle`);
  }

  if (!bundles.every(b => b.entry?.length === bundle1Length)) {
    throw new Error('Measure bundles must have the same number of resources');
  }

  const allMeasureEntries = bundles
    .map(b => b.entry?.find(e => e.resource?.resourceType === 'Measure'))
    .filter(e => e != null) as fhir4.BundleEntry[];

  if (allMeasureEntries.length != bundles.length) {
    throw new Error(`Bundle missing a Measure resource`);
  }

  const measures = allMeasureEntries.map(e => e.resource) as fhir4.Measure[];

  let newGroup: fhir4.MeasureGroup[] = [];

  measures.forEach(m => {
    newGroup = newGroup.concat(m.group ?? []);
  });

  const newMeasure: fhir4.Measure = {
    ...measures[0],
    group: newGroup
  };

  const newBundleEntry = bundles[0].entry?.map(e => {
    if (e.resource?.resourceType === 'Measure') {
      return { resource: newMeasure, request: e.request };
    }

    return e;
  });

  const newBundle: fhir4.Bundle = {
    ...bundles[0],
    entry: newBundleEntry
  };

  return newBundle;
}
