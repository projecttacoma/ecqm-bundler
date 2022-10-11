library MainLib version '0.0.1'

using FHIR version '4.0.1'

include FHIRHelpers version '4.0.1'
include DependentLib version '0.0.1'

context Patient

define "Initial Population":
  exists DependentLib."Example Encounter"

define "Denominator":
  "Initial Population"

define "Numerator":
  exists DependentLib."Example Procedure"
