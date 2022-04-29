import { ELMIdentification, findELMByIdentifier } from './elm';

export enum ImprovementNotation {
  POSITIVE = 'positive',
  NEGATIVE = 'negative'
}

export enum Scoring {
  PROPORTION = 'proportion',
  RATIO = 'ratio',
  CV = 'continuous-variable',
  COHORT = 'cohort'
}

export function generateMeasureResource(
  measureId: string,
  libraryId: string,
  improvementNotation: ImprovementNotation,
  scoringCode: Scoring,
  canonicalBase: string
): fhir4.Measure {
  return {
    resourceType: 'Measure',
    id: measureId,
    url: `${canonicalBase}/Measure/${measureId}`,
    status: 'draft',
    library: [`Library/${libraryId}`],
    improvementNotation: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/measure-improvement-notation',
          code: improvementNotation === ImprovementNotation.POSITIVE ? 'increase' : 'decrease'
        }
      ]
    },
    scoring: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/measure-scoring',
          code: scoringCode
        }
      ]
    }
  };
}

export function generateLibraryResource(
  libraryId: string,
  elm: any,
  canonicalBase: string
): fhir4.Library {
  return {
    resourceType: 'Library',
    id: libraryId,
    url: `${canonicalBase}/Library/${libraryId}`,
    version: elm.library.identifier.version || '0.0.1',
    type: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/library-type',
          code: 'logic-library'
        }
      ]
    },
    status: 'draft',
    content: [
      {
        contentType: 'application/elm+json',
        data: Buffer.from(JSON.stringify(elm)).toString('base64')
      }
    ]
  };
}

export function generateRelatedArtifact(display: string, resource: string): fhir4.RelatedArtifact {
  return {
    type: 'depends-on',
    display,
    resource
  };
}

export function generateLibraryRelatedArtifact(
  identifier: ELMIdentification,
  allELM: any[]
): fhir4.RelatedArtifact {
  const matchingELM = findELMByIdentifier(identifier, allELM);

  if (!matchingELM) {
    console.error(`Could not locate main library ELM for ${identifier.id}|${identifier.version}`);
    process.exit(1);
  }

  return generateRelatedArtifact(
    `Library ${identifier.id}`,
    `http://example.com/Library/${identifier.id}${
      identifier.version ? `|${identifier.version}` : ''
    }`
  );
}

export function generateValueSetRelatedArtifact(url: string): fhir4.RelatedArtifact {
  return generateRelatedArtifact(`ValueSet ${url}`, url);
}

export function generateMeasureBundle(resources: fhir4.FhirResource[]): fhir4.Bundle {
  return {
    resourceType: 'Bundle',
    type: 'transaction',
    entry: resources.map(r => ({
      resource: r,
      request: {
        method: 'PUT',
        url: `${r.resourceType}/${r.id}`
      }
    }))
  };
}
