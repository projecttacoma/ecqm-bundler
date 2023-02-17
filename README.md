# ecqm-bundler

CLI for bundling CQL files as an eCQM FHIR Bundle.

- [Basic Measure Bundle Generation from CQL](#basic-usage)
  - [Customizing Population Expressions](#customizing-population-expressions)
  - [Dealing with CQL Dependencies](#dependencies)
  - [Customizing Measure Properties](#customizing-measure-properties)
  - [Supplemental Data Elements](#supplemental-data-elements)
  - [Risk Adjustment Variables](#risk-adjustment-variables)
  - [ValueSet Resolution](#valueset-resolution)
  - [Customizing Canonical URLs](#customizing-canonical-urls)
  - [Bundling from ELM Content](#bundling-from-elm-content)
- [Advanced Usage](#advanced-usagefeatures)
  - [Interactive Mode](#interactive-mode)
  - [Multiple Initial Populations](#multiple-initial-populations)
  - [Multiple Measure Observations](#multiple-measure-observations)
  - [Multiple Measure Groups](#multiple-measure-groups)
  - [Composite Measures](#composite-measures)

# Installation

The CLI can be globally installed through npm:

```bash
npm install -g ecqm-bundler
```

# Usage

`ecqm-bundler` can do the following:

- Bundle a new measure from CQL or ELM (most common)
  - `ecqm-bundler generate --help`
- Combine the groups of existing measure bundles into one
  - `ecqm-bundler combine-groups --help`
  - See [section on combining measure groups](#multiple-measure-groups)
- Create a composite measure from existing measure bundles
  - `ecqm-bundler make-composite --help`
  - See [section on Composite Measures](#composite-measures)

For bundling with CQL files as input, you must have an instance of the [cql-translation-service](https://github.com/cqframework/cql-translation-service) running somewhere, e.g.:

```bash
docker run -d -p 8080:8080 cqframework/cql-translation-service:latest
```

Bundling is also supported with JSON ELM content directly. See [Bundling from ELM Content](#bundling-from-elm-content)

## Basic Usage

```bash
ecqm-bundler generate -c /path/to/main/cql/file.cql -v /path/to/valueset/directory --ipop <ipp-cql-expression> --numer <numer-cql-expression> --denom <denom-cql-expression>
```

**NOTE**: Based on the scoring code provided, the CLI will enforce the constraints listed in [Table 3-1 of the cqf measures IG](https://build.fhir.org/ig/HL7/cqf-measures/measure-conformance.html#criteria-names). This means that you _must_ specify the minimum
valid population expressions for your Measure's scoring type.

This behavior can be disabled using the `--disable-constraints` CLI option.

### Customizing Population Expressions

The bundler will add [population group criteria](http://hl7.org/fhir/us/cqfmeasures/2021May/StructureDefinition-measure-cqfm-definitions.html#Measure.group) to the Measure resource, which references specific CQL/ELM expressions that identify
the relevant eCQM population. These can be customized with the following CLI options:

```
--ipop <expr>                      "initial-population" expression name of measure
--numer <expr>                     "numerator" expression name of measure
--numex <expr>                     "numerator-exclusion" expression name of measure
--denom <expr>                     "denominator" expression name of measure
--denex <expr>                     "denominator-exclusion" expression name of measure
--denexcep <expr>                  "denominator-exception" expression name of measure
--msrpopl <expr>                   "measure-population"  expression name of measure
--msrpoplex <expr>                 "measure-population-exclusion" expression name of measure
--msrobs <expr>                    "measure-observation" expression name of measure
```

```bash
ecqm-bundler generate -c /path/to/main/cql/file.cql --deps-directory /path/to/deps/directory -v /path/to/valueset/directory --numer "numer def" --denom "denom def" --ipop "ipop def"
```

### Dependencies

If your CQL depends on other cql (i.e. it uses an `include <otherlib> ...` statement, that CQL must be passed in to the CLI as well via either the `--deps` or `--deps-directory` arguments:

#### Individual Dependency List

```bash
ecqm-bundler generate -c /path/to/main/cql/file.cql --deps /path/to/dep1.cql /path/to/dep2.cql -v /path/to/valueset/directory --ipop <ipp-cql-expression> --numer <numer-cql-expression> --denom <denom-cql-expression>
```

#### Dependency Directory

```bash
ecqm-bundler generate -c /path/to/main/cql/file.cql --deps-directory /path/to/deps/directory -v /path/to/valueset/directory --ipop <ipp-cql-expression> --numer <numer-cql-expression> --denom <denom-cql-expression>
```

**NOTE**: It is okay for the dependency directory to include more CQL files that won't be used. The bundler will parse the CQL content to identify all of the libaries
that need to be included with the translation request, and will omit any CQL files that aren't included somewhere in the dependency tree starting from the
main CQL file

### Customizing Measure Properties

Current Measure resource customizations include the [Measure Improvement Notation](https://build.fhir.org/ig/HL7/cqf-measures/StructureDefinition-cqfm-improvementNotation.html), [Population Basis](https://build.fhir.org/ig/HL7/cqf-measures/StructureDefinition-cqfm-populationBasis.html)
and the [Measure Scoring Code](https://build.fhir.org/ig/HL7/cqf-measures/StructureDefinition-cqfm-scoring.html):

```bash
ecqm-bundler generate -c /path/to/main/cql/file.cql --deps-directory /path/to/deps/directory -v /path/to/valueset/directory --scoring-code proportion --improvement-notation increase --basis boolean <...>
```

### Supplemental Data Elements

To add [Supplemental Data Elements (SDEs)](https://build.fhir.org/ig/HL7/cqf-measures/measure-conformance.html#supplemental-data-elements) to a Measure, simply include expression name(s) using the `--sde` flag:

```bash
ecqm-bundler generate <...> --sde "SDE 1 Expression Name" "SDE 2 Expression Name" "..."
```

### Risk Adjustment Variables

To add [Risk Adjustment Variables](https://build.fhir.org/ig/HL7/cqf-measures/measure-conformance.html#risk-adjustment) to a Measure, simply include expression name(s) using the `--raf` flag:

```bash
ecqm-bundler generate <...> --raf "RAF 1 Expression Name" "RAF 2 Expression Name" "..."
```

### ValueSet Resolution

By default, the bundler will look in the directory specified by `-v/--valueset` for any JSON files that have a `url` property which matches what is included by any pieces of the CQL logic.
You can disable this behavior with the `--no-valuesets` option, but note that the resulting eCQM FHIR Bundle may not yield proper calculation results due to lack of ValueSet resources:

```bash
ecqm-bundler generate -c /path/to/main/cql/file.cql --deps-directory /path/to/deps/directory --no-valuesets <...>
```

### Customizing Canonical URLs

By default, the bundler just uses an `example.com` URL as the base canonical URL for the resources (e.g. `http://example.com/Measure/measure-123`). This can be customized using the `--canonical-base` option:

```bash
ecqm-bundler generate -c /path/to/main/cql/file.cql --deps-directory /path/to/deps/directory -v /path/to/valueset/directory --canonical-base "http://example.com/other/canonical/base" <...>
```

### Bundling from ELM Content

```bash
ecqm-bundler generate -e /path/to/main/elm/file.json --deps-directory /path/to/deps/directory -v /path/to/valueset/directory <...>
```

This will forego the CQL translation and bundle the libraries with the ELM content provided.

## Advanced Usage/Features

:warning: Highly experimental. Use only if you know exactly what you're doing and why :warning:

### Interactive Mode

**NOTE**: Currently only supported when using CQL as the input

The `ecqm-bundler` CLI also allows for more complex configuration of a measure bundle using the "interactive" mode:

```bash
ecqm-bundler generate <...> --interactive
```

This will create an interactive prompt where you can construct a more complex measure. For example:

- Measures with multiple population groups
- Measures with multiple initial populations
  - Allows for specifying which initial population the numerator or denominator draw from
- Measures with multiple measure observations
  - Allows for specifying which population an observation references

Interactive mode is highly recommended for constructing complex measures. If you are in an environment where keyboard input is not an option (e.g. in a script), continue to the below sections

### Multiple Initial Populations

**NOTE**: This is only allowed when using `--scoring-code ratio`

The CLI supports multiple initial populations by passing in multiple values to the `--ipop` flag

```bash
ecqm-bundler generate <...> --scoring-code ratio --ipop ipp1 ipp2 <...>
```

In the case of multiple initial populations, the numerator and denominator populations must specify which initial population they draw from. This can be done with the
`--numer-ipop-ref` and `--denom-ipop-ref` options respectively.

**IMPORTANT**: The values for these flags _must_ match one of the expressions used with the `--ipop` flag. Otherwise, the CLI will throw an error.

```bash
ecqm-bundler generate <...> --scoring-code ratio --ipop ipp1 ipp2 --numer numer --numer-ipop-ref ipp1 --denom denom --denom-ipop-ref ipp2
```

### Multiple Measure Observations

In the case of multiple measure observations, use the `--detailed-msrobs` flag. The CLI accepts a string of the format `<observation-function-name>|<observing-population-expression>`. This allows for `n` many measure observations that reference any population that has already been provided.

**IMPORTANT**: The values for `<observing-population-expression>` _must_ match one of the expressions provided with any of the other population expression CLI flags.

```bash
ecqm-bundler generate --ipop ipp --numer numer --denom denom --detailed-msrobs "obs1|numer" "obs2|denom"
```

The above command would generate a measure group where there are two measure observations: `obs1`, which is a CQL function that observes results from the `numer` population, and `obs2`, which is a CQL function that observes results from the `denom` population

### Multiple Measure Groups

:warning: Only use this feature if [interactive mode](#interactive-mode) is not a viable solution due to limitations of the environment that `ecqm-bundler` is being used in :warning:

:warning: Please be very careful if you use this feature :warning:

Due to limitations of command line interfaces, generating a measure with `n` many groups in one invocation is not feasible. To solve this, `ecqm-bundler` also comes with a `combine-groups` command that takes the groups of previously created bundles and combines them into one

:warning: This assumes that the only difference amongst the bundles is the measure group. Everything else (valuesets, library names, etc.) must be exactly the same for this feature to work properly :warning:

```bash
ecqm-bundler combine-bundles /path/to/bundle1.json /path/to/bundle2.json /path/to/bundle3.json ... --out combined.json
```

This will generate a new bundle `combined.json` where the groups of the measure resources in `bundle1.json`, `bundle2.json`, and `bundle3.json` are combined into one measure group array.

```
Usage: ecqm-bundler combine-groups [options] <path...>

Combine the groups in the measure resources of two different bundles into one

Options:
  --output <path>  Path to output file (default: "./combined.json")
  -h, --help       display help for command
```

### Composite Measures

:warning: Highly experimental. Use only if you know exactly what you're doing and why :warning:

Similar to combining Measure groups, `ecqm-bundler` comes with a `make-composite` command that will generate a [Composite Measure](https://build.fhir.org/ig/HL7/cqf-measures/composite-measures.html) that composes existing bundles already created with the `generate` command

```bash
ecqm-bundler make-composite /path/to/bundle1.json /path/to/bundle2.json /path/to/bundle3.json ... --composite-scoring <scoring> --out composite.json
```

This will generate a new bundle `composite.json` whose main measure is a composite measure that references the measures that it is composed of in the `relatedArtifact` list

To customize the group ID or weight of one of the components, use the `--detailed-component` option, and be sure to follow the proper string format. For example:

```bash
ecqm-bundler make-composite <...> --detailed-component "MyMeasure#group-1" # just measure and group
ecqm-bundler make-composite <...> --detailed-component "MyMeasure|1.0.0#group-1" # measure version and group
ecqm-bundler make-composite <...> --detailed-component "MyMeasure#group-1#0.1" # measure group and weight
ecqm-bundler make-composite <...> --detailed-component "MyMeasure##0.1" # just measure and weight
```

Note that the measure identifying info is required, but group ID and weight are both optional.

:warning: Use of this option will override the autodetection of canonicals that happens in the component measures. Please ensure that the measure identifying info you provide matches the canonical in the corresponding measure resource :warning:

```
Usage: ecqm-bundler make-composite [options] <path...>

Combine a set of measures into a composite measure

Options:
  --composite-scoring <scoring>  Composite scoring method of the measure (choices: "opportunity", "all-or-nothing", "linear", "weighted", default: "all-or-nothing")
  --detailed-component <component...>  Specify measure components with specific group IDs or weights. Format "measureId(|version)?(#groupId)?(#weight)?" (e.g. "measure|1.0.0#group-2#0.1") (default: [])
  -h, --help                     display help for command
```

## Debugging

Debug mode will write all of the ELM content to a file in the `./debug` directory, which it will create. This is useful for inspecting the contents of translated CQL before it gets
base64 encoded onto a FHIR Library resource.

To enable, use `--debug` as an option in the CLI amongst the other options

## Full List of Options

For all commands, the following options are shared:

```
Usage: ecqm-bundler [options] [command]

Options:
  -V, --version                       output the version number
  -o, --out <path>                    Path to output file (default: "./measure-bundle.json")
  --canonical-base <url>              Base URL to use for the canonical URLs of library and measure resources (default: "http://example.com")
  --measure-version <version>         Version of the measure resource
  --improvement-notation <notation>   Measure's improvement notation (choices: "increase", "decrease", default: "increase")
  -h, --help                          display help for command
```

For the subcommands:

```
Usage: ecqm-bundler generate [options]

Options:
  -i, --interactive               Create Bundle in interactive mode (allows for complex values) (default: false)
  -c, --cql-file <path>
  -e,--elm-file <path>
  --debug                         Enable debug mode to write contents to a ./debug directory (default: false)
  --deps <deps...>                List of CQL or ELM dependency files of the main file (default: [])
  --deps-directory <path>         Directory containing all dependent CQL or ELM files
  --ipop <expr...>                "initial-Population" expression name(s) of measure (enter multiple values for a multiple ipp ratio measure)
  --numer <expr>                  "numerator" expression name of measure
  --numer-ipop-ref <expr>         expression name of the "initial-population" that the numerator draws from
  --numex <expr>                  "numerator-exclusion" expression name of measure
  --denom <expr>                  "denominator" expression name of measure
  --denom-ipop-ref <expr>         expression name of the "initial-population" that the denominator draws from
  --denex <expr>                  "denominator-exclusion" expression name of measure
  --denexcep <expr>               "denominator-exception" expression name of measure
  --msrpopl <expr>                "measure-population"  expression name of measure
  --msrpoplex <expr>              "measure-population-exclusion" expression name of measure
  --msrobs <expr...>              "measure-observation" expression name of measure (enter multiple values for a measure with multiple observations)
  --detailed-msrobs <expr...>     Specify measure-observation(s) that reference another population. Must be of the format "<observation-function-name>|<observing-population-expression>" (default: [])
  -v, --valuesets <path>          Path to directory containing necessary valueset resource
  --no-valuesets                  Disable valueset detection and bundling
  -u, --translator-url <url>      URL of cql translation service to use (default: "http://localhost:8080/cql/translator")
  -s, --scoring-code <scoring>    Measure's scoring code (choices: "proportion", "ratio", "continuous-variable", "cohort", "composite", default: "proportion")
  -b, --basis <population-basis>  Measure's population basis (default: "boolean")
  --disable-constraints           Bypass the population constraints defined for the given measure scoring code (useful for debugging)
  -h, --help                      display help for command
```

```
Usage: index combine-groups [options] <path...>

Combine the groups in the measure resources of two different bundles into one

Options:
  -h, --help  display help for command

```

```
Usage: ecqm-bundler make-composite [options] <path...>

Combine a set of measures into a composite measure

Options:
  --composite-scoring <scoring>  Composite scoring method of the measure (choices: "opportunity", "all-or-nothing", "linear", "weighted", default: "all-or-nothing")
  -h, --help                     display help for command
```

# Simple Example

See the `example` directory for example inputs and outputs to `ecqm-bundler`. The `example-measure-bundle.json` file in this directory was generated using the following command:

```bash
ecqm-bundler generate -c example/cql/MainLib.cql --deps-directory example/cql -v example/valuesets --ipop "Initial Population" --denom "Denominator" --numer "Numerator" -o example/example-measure-bundle.json
```
