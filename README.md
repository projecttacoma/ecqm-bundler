# ecqm-bundler

CLI for bundling CQL files as an eCQM FHIR Bundle.

# Installation

The CLI can be globally installed through npm:

``` bash
npm install -g ecqm-bundler
```

# Usage

For bundling with CQL files as input, you must have an instance of the [cql-translation-service](https://github.com/cqframework/cql-translation-service) running somewhere.

Bundling is also supported with JSON ELM content directly. See [Bundling from ELM Content](#bundling-from-elm-content)

## Basic Usage

### Individual Dependency List

``` bash
ecqm-bundler -c /path/to/main/cql/file.cql --deps /path/to/dep1.cql /path/to/dep2.cql -v /path/to/valueset/directory
```

### Dependency Directory

``` bash
ecqm-bundler -c /path/to/main/cql/file.cql --deps-directory /path/to/deps/directory -v /path/to/valueset/directory
```

**NOTE**: It is okay for the dependency directory to include more CQL files that won't be used. The bundler will parse the CQL content to identify all of the libaries
that need to be included with the translation request, and will omit any CQL files that aren't included somewhere in the dependency tree starting from the
main CQL file

### Bundling from ELM Content

``` bash
ecqm-bundler -e /path/to/main/elm/file.json --deps-directory /path/to/deps/directory -v /path/to/valueset/directory
```

This will forego the CQL translation and bundle the libraries with the ELM content provided.

## Advanced Usage/Features

### Customizing Measure Properties

Current Measure resource customizations include the [Measure Improvement Notation](http://hl7.org/fhir/us/cqfmeasures/2021May/StructureDefinition-measure-cqfm-definitions.html#Measure.improvementNotation) and the
[Measure Scoring Code](http://hl7.org/fhir/us/cqfmeasures/2021May/StructureDefinition-measure-cqfm-definitions.html#Measure.scoring):

``` bash
ecqm-bundler -c /path/to/main/cql/file.cql --deps-directory /path/to/deps/directory -v /path/to/valueset/directory --scoring-code "proportion" --improvement-notation "negative"
```

### ValueSet Resolution

By default, the bundler will look in the directory specified by `-v/--valueset` for any JSON files that have a `url` property which matches what is included by any pieces of the CQL logic.
You can disable this behavior with the `--no-valuesets` option, but note that the resulting eCQM FHIR Bundle may not yield proper calculation results due to lack of ValueSet resources:

``` bash
ecqm-bundler -c /path/to/main/cql/file.cql --deps-directory /path/to/deps/directory --no-valuesets
```

### Customizing Population Expressions

The bundler will add [population group criteria](http://hl7.org/fhir/us/cqfmeasures/2021May/StructureDefinition-measure-cqfm-definitions.html#Measure.group) to the Measure resource, which references specific CQL expressions that identify
the relevant eCQM population. By default, it uses "Numerator", "Denominator", and "Initial Population" as the expression definition names. These can be customized with the `-n/--numer, -d/--denom, -i/--ipop` options respectively:

``` bash
ecqm-bundler -c /path/to/main/cql/file.cql --deps-directory /path/to/deps/directory -v /path/to/valueset/directory -n "numer def" -d "denom def" -i "ipop def"
```

### Customizing Canonical URLs

By default, the bundler just uses an `example.com` URL as the base canonical URL for the resources (e.g. `http://example.com/Measure/measure-123`). This can be customized using the `--canonical-base` option:

``` bash
ecqm-bundler -c /path/to/main/cql/file.cql --deps-directory /path/to/deps/directory -v /path/to/valueset/directory --canonical-base "http://example.com/other/canonical/base"
```

### Debugging

Debug mode will write all of the ELM content to a file in the `./debug` directory, which it will create. This is useful for inspecting the contents of translated CQL before it gets
base64 encoded onto a FHIR Library resource.

To enable, use `--debug` as an option in the CLI amongst the other options

## Full List of Options

```
Usage: ecqm-bundler [options]

Options:
  -c, --cql-file <path>
  -e,--elm-file <path>
  --debug                                Enable debug mode to write contents to a ./debug directory (default: false)
  --deps <deps...>                       List of CQL or ELM dependency files of the main file (default: [])
  --deps-directory <path>                Directory containing all dependent CQL or ELM files
  -n,--numer <expr>                      Numerator expression name of measure (default: "Numerator")
  -i,--ipop <expr>                       Numerator expression name of measure (default: "Initial Population")
  -d,--denom <expr>                      Denominator expression name of measure (default: "Denominator")
  -o, --out <path>                       Path to output file (default: "./measure-bundle.json")
  -v, --valuesets <path>                 Path to directory containing necessary valueset resource
  --no-valuesets                         Disable valueset detection and bundling
  -u, --translator-url <url>             URL of cql translation service to use (default: "http://localhost:8080/cql/translator")
  --canonical-base <url>                 Base URL to use for the canonical URLs of library and measure resources (default: "http://example.com")
  -i, --improvement-notation <notation>  Measure's improvement notation (choices: "positive", "negative", default: "positive")
  -s, --scoring-code <scoring>           Measure's scoring code (choices: "proportion", "ratio", "continuous-variable", "cohort", default: "proportion")
  -h, --help                             display help for command
```

# Simple Example

See the `example` directory for example inputs and outputs to `ecqm-bundler`. The `example-measure-bundle.json` file in this directory was generated using the following command:

``` bash
ecqm-bundler -c example/cql/MainLib.cql --deps-directory example/cql -v example/valuesets
```
