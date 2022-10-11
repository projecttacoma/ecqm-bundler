library DependentLib version '0.0.1'

using FHIR version '4.0.1'

include FHIRHelpers version '4.0.1'

valueset "Example ValueSet": 'http://example.com/ValueSet/example'

context Patient

define "Example Encounter":
  [Encounter: "Example ValueSet"] E where E.status = 'finished'

define "Example Procedure":
  [Procedure: "Example ValueSet"] P where P.status = 'completed'
