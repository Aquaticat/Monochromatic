# config-oxlint-tsdoc

Oxlint JS plugin providing TSDoc validation rules adapted from eslint-plugin-jsdoc's recommended-typescript config.
Uses `@microsoft/tsdoc` for authoritative comment parsing.

## Motivation

eslint-plugin-jsdoc only runs inside ESLint, which is slow and cannot participate in oxlint's single-pass architecture.
This plugin reimplements the recommended-typescript ruleset as an oxlint JS plugin,
adapting all rules to conform to TSDoc (not JSDoc) conventions used in the monorepo.

## Usage

Reference the package in `oxlint.config.ts`:

```typescript
// oxlint.config.ts
import { defineConfig, } from 'oxlint';
export default defineConfig({
  jsPlugins: ['@monochromatic-dev/config-oxlint-tsdoc',],
},);
```

All rules are enabled by default at `"warn"` severity with `recommended: true`.

## Rules

### Presence

- **require-tsdoc**: requires TSDoc comments on module-level documentable declarations
  (functions, classes, interfaces, type aliases, enums, variables, properties, enum members, getters, setters);
  skips VariableDeclaration nodes inside function bodies

### Structural formatting

- **check-alignment**: enforces consistent asterisk alignment in multiline TSDoc blocks
- **multiline-blocks**: requires multiline format for TSDoc comments containing tags
- **no-multi-asterisks**: disallows `** text` lines (doubled leading asterisks)
- **tag-lines**: requires blank comment lines before block tags
- **empty-tags**: enforces that modifier tags (`@public`, `@readonly`, `@override`, etc.) have no content
- **escape-inline-tags**: detects unescaped `*/` inside comment content

### Tag validation

- **check-tag-names**: validates that tags are recognized TSDoc standard tags;
  reports JSDoc-only tags with migration suggestions;
  skips fenced code blocks and backtick-wrapped inline code
- **check-access**: detects conflicting access modifier tags
- **valid-types**: reports TSDoc parse errors from the `@microsoft/tsdoc` parser
- **no-types**: disallows JSDoc-style `{Type}` annotations in TSDoc

### Parameter documentation

- **check-param-names**: validates `@param` names against the function signature;
  allows property names from destructured parameters
- **require-param**: requires `@param` tags for all function parameters
- **require-param-name**: requires every `@param` tag to specify a parameter name
- **require-param-description**: requires descriptions on `@param` tags

### Return documentation

- **require-returns**: requires `@returns` tag for functions with non-void return types;
  skips constructors and setters
- **require-returns-check**: reports `@returns` on void functions
- **require-returns-description**: requires descriptions on `@returns` tags

### Yield documentation

- **require-yields**: requires `@yields` tag for generator functions
- **require-yields-check**: reports `@yields` on non-generator functions

## Ignored files

Files matching these extensions are skipped by all rules:
`.test.ts`, `.spec.ts`, `.bench.ts`, `.js`, `.d.ts`, `.mjs`, `.cjs`, `.d.mts`, `.d.cts`

## Source files

- `index.ts`: plugin entry point; assembles all rules into the oxlint plugin object
- `tsdoc-utils.ts`: shared TSDoc parsing, comment lookup, parameter extraction utilities
- `rules/require-tsdoc.ts`: require-tsdoc rule with scope-depth tracking
- `rules/structural.ts`: structural formatting rules (alignment, multiline, asterisks, tag spacing, escaping)
- `rules/tag-validation.ts`: tag name validation, access checks, parse error reporting, type annotation detection
- `rules/params.ts`: parameter documentation rules
- `rules/returns.ts`: return documentation rules
- `rules/yields.ts`: yield documentation rules

## Tests

23 fixture-based tests covering all rules:

```bash
mise run test:unit -- --filter oxlint-tsdoc
```

Test fixtures live in `packages/test-fixture/oxlint-tsdoc/src/` with `valid/` and `invalid/` directories.
