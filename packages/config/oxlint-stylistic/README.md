# @monochromatic-dev/config-oxlint-stylistic

Oxlint JS plugin enforcing one-item-per-line formatting across all multi-element TypeScript constructs.

Each rule fires when 2 or more items share a source line and auto-fixes by placing every item on its own line
with consistent indentation.
Works alongside dprint's `preferHanging: "always"` setting, which formats multi-line items correctly
but does not force them to be multi-line.

## Rules

All rules are auto-fixable via `oxlint --fix`.

- **param-per-line** -- each function parameter on its own line (declarations, expressions, arrows)
- **argument-per-line** -- each function call argument on its own line (`CallExpression`, `NewExpression`)
- **array-element-per-line** -- each array literal element on its own line
- **object-property-per-line** -- each object literal property on its own line
- **import-per-line** -- each named import specifier on its own line
- **export-per-line** -- each named export specifier on its own line
- **type-property-per-line** -- each type literal or interface member on its own line
- **tuple-per-line** -- each tuple type element on its own line
- **destructure-per-line** -- each destructured property on its own line

## Usage

Reference the package in `oxlint.config.ts`:

```typescript
// oxlint.config.ts
import { defineConfig, } from 'oxlint';
export default defineConfig({
  jsPlugins: ['@monochromatic-dev/config-oxlint-stylistic',],
},);
```

## Design decisions

**Union/intersection types excluded** -- a `union-per-line` rule was prototyped but dropped.
Inline type assertions like `Span & Record<string, unknown>` and `T | null | undefined`
generated too much noise to be worth enforcing.

**Minimum 2 items** -- single-item constructs are never flagged.
An array with one element or a function with one parameter stays on one line.

**Shared implementation** -- all rules delegate to `checkItemsPerLine` in the utility layer.
Each rule's visitor only extracts the relevant container and items from the AST,
keeping rule files minimal.

## Source files

- `index.ts` -- plugin entry point; assembles all rules into the oxlint plugin object
- `rules/` -- one file per rule, each exporting a `CreateOnceRule`
- `utility/item-per-line.ts` -- shared detection and reporting logic
- `utility/item-per-line-fix.ts` -- shared autofix logic (indentation detection, content rebuild)
- `utility/needs-fix.ts` -- line-sharing detection between items and container delimiters
- `utility/delimiter.ts` -- opening/closing delimiter scanning
- `utility/range.ts` -- `rangeOf` and `at` helpers for untyped AST node access

## Tests

Fixture-based tests covering all 9 rules plus autofix verification:

```bash
mise run test:unit -- --filter oxlint-stylistic
```

Test fixtures live in `packages/test-fixture/oxlint-stylistic/src/` with `valid/` and `invalid/` directories.
