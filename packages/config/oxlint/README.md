# @monochromatic-dev/config-oxlint

Shared oxlint configuration for Monochromatic repositories,
exported as a typed `OxlintConfig` object from `oxlint.config.ts`.

## Usage

The root `oxlint.config.ts` imports and re-exports the shared config:

```typescript
// oxlint.config.ts (monorepo root)
import { defineConfig } from 'oxlint';
import base from '@monochromatic-dev/config-oxlint';

export default defineConfig({ ...base });
```

Uses spread instead of `extends` because `extends` only merges rules --
top-level fields like `categories`, `env`, `ignorePatterns`, `overrides`,
and `plugins` are not inherited through `extends`.

## Structure

```
src/
  index.ts          -- composes all rules, overrides, and config shape
  overrides.ts      -- file-pattern overrides (.d.ts, .test.ts, .config.*, etc.)
  rules/
    tsdoc.ts        -- tsdoc jsPlugin rule severity configuration
    correctness.ts  -- correctness, typescript, jest suppression, perf rules
    restriction.ts  -- restriction rules and no-disable enforcement
    style.ts        -- style and pedantic rules
```

## jsPlugin resolution

oxlint's Rust resolver doesn't understand pnpm workspace package names,
so `jsPlugins` entries use `import.meta.resolve()` to convert package
names to absolute filesystem paths at config evaluation time (Node.js
handles workspace resolution). This keeps the config portable without
hardcoding relative paths.

## Root-only options

`options.typeAware` cannot live in the config file because oxlint treats
any config found via upward directory walk as "nested" (not root).
The `--type-aware` flag is passed via the CLI in the mise task template
`lint:oxlint` instead.

## Related packages

- **@monochromatic-dev/config-oxlint-tsdoc** -- jsPlugin providing TSDoc validation rules
- **@monochromatic-dev/config-oxlint-no-restricted-syntax** -- jsPlugin for banned syntax patterns
- **@monochromatic-dev/config-oxlint-stylistic** -- jsPlugin for one-item-per-line formatting

These are JS plugins (`jsPlugins`), not config packages. They implement rule
logic; this package configures rule severity and options. All three are
declared as dependencies of this package and resolved via `import.meta.resolve()`.
