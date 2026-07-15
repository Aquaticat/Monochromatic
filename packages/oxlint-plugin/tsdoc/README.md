# config-oxlint-tsdoc

Oxlint JS plugin providing TSDoc validation rules adapted from eslint-plugin-jsdoc's recommended-typescript config.
Uses an in-house TSDoc comment scanner;
 no external dependency on `@microsoft/tsdoc`.
A bounded process-local cache shares one parsed model for each exact comment body across participating rules.

## Motivation

eslint-plugin-jsdoc only runs inside ESLint,
 which is slow and cannot participate in oxlint's single-pass architecture.
This plugin reimplements the recommended-typescript ruleset as an oxlint JS plugin,
adapting all rules to conform to TSDoc (not JSDoc) conventions used in the monorepo.

## Usage

Reference the package in `oxlint.config.ts`:

```typescript
// oxlint.config.ts
import { defineConfig, } from 'oxlint';
export default defineConfig({
  jsPlugins: ['@monochromatic-dev/oxlint-plugin-tsdoc',],
},);
```

Each rule advertises `recommended: true`.
Configure severity in the consuming oxlint config.
The shared `@monochromatic-dev/config-oxlint` package enables the TSDoc rules it uses
and keeps the yield rules off because `@yields` is not part of TSDoc.

The package default export resolves to the prebuilt,
 self-contained
`dist/final/node/index.mjs` (run `mise run //packages/oxlint-plugin/tsdoc:build` first).
TypeScript source is available at the `/ts` subpath (`/ts/*` for individual files) for
development.

## Rules

### Presence

- **require-tsdoc**:
   requires TSDoc comments on documentable declarations at module,
  function,
   and block scope
  (functions,
   classes,
   interfaces,
   type aliases,
   enums,
   variables,
   properties,
   enum members,
   getters,
   setters);
  skips for-loop binding declarations
- **require-example**:
   requires exported functions to include an `@example` tag unless `@inheritDoc` or `@internal`
  makes the example requirement inappropriate

### Structural formatting

- **check-alignment**:
   enforces consistent asterisk alignment in multiline TSDoc blocks
- **multiline-blocks**:
   requires multiline format for all TSDoc comments and auto-fixes single-line blocks
- **no-multi-asterisks**:
   disallows `** text` lines (doubled leading asterisks)
- **tag-lines**:
   requires blank comment lines before block tags
- **empty-tags**:
   enforces that modifier tags (`@public`,
   `@readonly`,
   `@override`,
   etc.) have no content
- **escape-inline-tags**:
   detects unescaped `*/` inside comment content

### Tag validation

- **check-tag-names**:
   validates that tags are recognized TSDoc standard tags;
  reports JSDoc-only tags with migration suggestions;
  skips fenced code blocks and backtick-wrapped inline code
- **check-access**:
   detects conflicting access modifier tags
- **valid-types**:
   reports best-effort structural problems from the in-house scanner
  (`@param` tag missing its hyphen separator,
   unclosed `{@link`,
   empty `{@link}`)
- **no-types**:
   disallows JSDoc-style `{Type}` annotations in TSDoc

### Parameter documentation

- **check-param-names**:
   validates `@param` names against the function signature;
  allows property names from destructured parameters
- **require-param**:
   requires `@param` tags for all function parameters
- **require-param-name**:
   requires every `@param` tag to specify a parameter name
- **require-param-description**:
   requires descriptions on `@param` tags

### Mutation contracts

- **check-mutates**:
  validates each project-specific `@mutates parameterName - description` block;
  reports missing targets,
  unknown callable parameters,
  duplicate targets,
  and missing descriptions;
  accepts named parameters and destructured binding names

`@mutates` means that a callable may cause caller-observable state changes through state reachable from the named
parameter.
It is a repeatable custom block tag,
not a standard TSDoc tag.
This plugin recognizes and validates the tag directly.

External tools using [`@microsoft/tsdoc`][microsoft-tsdoc] must register it before parsing comments:

```typescript
import {
  TSDocConfiguration,
  TSDocTagDefinition,
  TSDocTagSyntaxKind,
} from '@microsoft/tsdoc';

const configuration = new TSDocConfiguration();
const mutatesTag = new TSDocTagDefinition({
  tagName: '@mutates',
  syntaxKind: TSDocTagSyntaxKind.BlockTag,
  allowMultiple: true,
});
configuration.addTagDefinition(mutatesTag);
configuration.setSupportForTag(mutatesTag, true);
```

Registration makes the reference parser accept repeatable blocks.
Consumers must preserve the block text and interpret the first token as the parameter target followed by a hyphen and
author-written rationale.
The API shape is verified against `@microsoft/tsdoc` 0.16.0's
[`TSDocConfiguration`][tsdoc-configuration] and [`TSDocTagDefinition`][tsdoc-tag-definition] declarations.

### Return documentation

- **require-returns**:
   requires `@returns` tag for functions with non-void return types;
  skips constructors and setters
- **require-returns-check**:
   reports `@returns` on void functions
- **require-returns-description**:
   requires descriptions on `@returns` tags

### Yield documentation

These rules are available in the plugin for compatibility testing,
but the shared config keeps them off because `@yields` is not part of TSDoc.

- **require-yields**:
   requires `@yields` tag for generator functions
- **require-yields-check**:
   reports `@yields` on non-generator functions

## Ignored files

Files matching these extensions are skipped by all rules:
`.test.ts`,
 `.spec.ts`,
 `.bench.ts`,
 `.js`,
 `.d.ts`,
 `.mjs`,
 `.cjs`,
 `.d.mts`,
 `.d.cts`

## Source files

- `index.ts`:
   plugin entry point;
   assembles all rules into the oxlint plugin object
- `ast-access.ts`:
   untyped AST guards,
   record helpers,
   and parameter binding unwrap logic
- `comment-text.ts`:
   leaf text-scanning primitives (line normalization,
   tag/code scanning)
- `tsdoc-comments.ts`:
   comment lookup,
   TSDoc block parsing,
   and parse-result assembly
- `tsdoc-blocks.ts`:
   in-house scanner producing parsed `@param`,
  `@mutates`,
  and `@returns` models
- `tsdoc-params.ts`,
  `tsdoc-destructured.ts`,
  and `tsdoc-params-returns.ts`:
   function signature,
   destructured parameter,
   return,
   and generator helpers
- `tsdoc-structural-messages.ts`:
   best-effort structural diagnostics for `valid-types`
- `tsdoc-doc-model.ts`:
   parsed doc-model and message types
- `tsdoc-utils.ts`:
   compatibility barrel for rules that need shared TSDoc helpers
- `rule/tsdoc-visitors.ts`:
   shared visitor factories,
   ignored-file handling,
   and report-location helpers
- `rule/require-tsdoc.ts` and `rule/require-example.ts`:
   presence rules for declarations and exported function examples
- `rule/params.ts`,
  `rule/mutates.ts`,
  `rule/returns.ts`,
  and `rule/yields.ts`:
   callable documentation rules
- `rule/structural.ts` and `rule/tag-validation.ts`:
   aggregate entry points for structural and tag-validation rules
- `rule/asterisk-validation.ts`,
  `rule/structural-tags.ts`,
  `rule/empty-tags.ts`,
  `rule/tag-escaping.ts`,
  `rule/tag-names.ts`,
  `rule/tag-types.ts`,
  `rule/type-annotations.ts`,
  and `rule/jsdoc-map.ts`:
   focused helpers behind the aggregate structural and tag-validation rules

## Tests

Fixture-based integration tests cover all plugin rules,
and focused unit tests cover the scanner and text helpers:

```bash
mise run buildAndTest -- packages/oxlint-plugin/tsdoc/src/oxlint-tsdoc.unit.test.ts
mise run //packages/oxlint-plugin/tsdoc:test:unit
```

Test fixtures live in `packages/test-fixture/oxlint-tsdoc/src/` with `valid/` and `invalid/` directories.

[microsoft-tsdoc]: https://tsdoc.org/pages/packages/tsdoc/
[tsdoc-configuration]: https://cdn.jsdelivr.net/npm/@microsoft/tsdoc@0.16.0/lib/configuration/TSDocConfiguration.d.ts
[tsdoc-tag-definition]: https://cdn.jsdelivr.net/npm/@microsoft/tsdoc@0.16.0/lib/configuration/TSDocTagDefinition.d.ts
