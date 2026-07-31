# @monochromatic-dev/oxlint-plugin-test-import

Oxlint JS plugin keeping test files pointed at the artifact their package ships.

The convention it enforces is empirical,
 not aesthetic.
Defects have previously survived the whole test suite by existing only in built output,
so a module tested through its source proves nothing about what consumers actually load.

## Rules

- **require-eventual-artifact**:
   bans a test file from importing its own package's source
   instead of the built artifact that package ships

## Why this cannot be configuration

Oxlint ships `no-restricted-imports` natively,
 and it can ban relative specifiers with negated allowances.
It matches specifier strings with no per-file package context,
 though,
so it cannot tell a package's own `/ts` subpath from a sibling package's `/ts` subpath.
Banning `@monochromatic-dev/*/ts` outright would reject the sanctioned cross-package channel
along with the harness imports every test file makes.

## What counts as an eventual artifact

An import target qualifies when either condition holds.

- Its resolved,
   normalized path lies under `<package-root>/dist/final`.
   Substring matching would accept `src/dist/final/fake.ts`,
   so containment is checked after normalization.
- It lies inside a directory the owning package declares as a shipping entry,
   through `exports` (excluding the `./ts` and `./ts/*` keys),
   `main`,
   or `bin`.

Two clauses narrow the second condition.

- Targets under `src/` are discarded.
   A package naming its own source as a runtime entry is misconfigured,
   and honouring it would bless exactly the imports this rule exists to reject.
- The bare `dist` root never counts as a shipping directory.
   A single asset entry such as `./dist/Face-Regular.otf` would otherwise make all of `dist/temp` eventual.

Directory granularity,
 rather than exact-file matching,
 is what admits bundler siblings.
A package declaring `main: dist/app/main.mjs` ships all of `dist/app`,
so its tests may import `../dist/app/strip.js`.

## What the rule checks

The rule inspects every static `import` declaration,
 including `import type`,
in files matching `**/*.{test,bench}.ts`.

- Relative specifier landing inside an eventual directory:
   allowed
- Relative specifier landing anywhere else:
   reported,
   unless the target matches the fixture allowlist
- The owning package's own bare name:
   allowed,
   since it resolves through the exports map,
   which is the one import form that exercises the export map itself
- The owning package's own `/ts` subpath:
   reported
- Any other package,
   including its `/ts` subpath:
   ignored

Specifier resolution is purely lexical.
Nothing is read from disk and no extension probing happens,
so a specifier naming a not-yet-built artifact classifies identically before and after a build.

## Exemptions

Test-only fixtures and support modules are not package behavior.
The `fixturePatterns` option holds globs naming them.
Matching runs against resolved target paths,
 never raw specifier text.

Allowlisted modules are themselves subject to the rule.
Without that,
 a test could import a permitted module that re-exports straight from source,
bypassing the rule with no change to the test's own import.

That second consequence is why every glob must identify test-only code by name alone.
A glob catching package behavior fails twice over:
it exempts real behavior from tests,
and it reports ordinary source for importing its own siblings.
`*-helpers.ts` and `*-harness.ts` are absent from the defaults for exactly that reason.
Measured across this repository,
all 22 files carrying those suffixes are imported by package behavior
and none are test-only;
the suffix describes what a module does,
 not who may load it.

A package declaring no build task in its `mise.toml` is exempt entirely.
Such a package ships no artifact,
 so the rule is vacuous there rather than merely inconvenient.
The exemption self-heals:
adding a build task re-arms the rule with no change to this plugin.

## Forms not checked

Dynamic `import()`,
 `require()`,
 and `export ... from` are out of scope,
so `await import('./toml-set.ts')` remains a legal bypass.
Adding the dynamic form later is a small change.

## Configuration

```typescript
// oxlint.config.ts
import { defineConfig } from 'oxlint';

export default defineConfig({
  jsPlugins: ['@monochromatic-dev/oxlint-plugin-test-import'],
  rules: {
    'test-import/require-eventual-artifact': 'error',
  },
});
```

The `fixturePatterns` option replaces the default glob list rather than extending it.

```typescript
// oxlint.config.ts
export default defineConfig({
  rules: {
    'test-import/require-eventual-artifact': [
      'error',
      { fixturePatterns: ['**/fixture.*', '**/test-support.ts', '**/support/**'] },
    ],
  },
});
```

## Design record

`doc/planning/oxlint-test-import-eventual-artifact.md` holds the decisions behind this rule,
the alternatives considered and rejected,
and the migration measurements.
