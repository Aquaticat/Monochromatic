# Handover: fuzzing for file-enforcer

Living document for the "add fuzzing to file-enforcer" work. Update it as
each target lands and as findings surface.

## Goal

Add property-based fuzzing across every parsing and transforming surface in
this package, to prove the parsers never crash uncaught, round-trip, and
preserve their documented invariants. Driven by `fast-check`. The explicit
ask: surface and fix any unexpected or undocumented behavior, including in
the TOML wrappers even though they bottom out in upstream
`@monochromatic-dev/module-toml-edit`.

## Decisions

- TypeScript package, so the Rust `cargo-fuzz` precedent does not apply;
  use `fast-check` property tests (the repo's TS precedent is
  `packages/module/test/src/format-error.property.unit.test.ts`).
- One layer, env-parameterized (not two separate file sets). Each
  `*.property.unit.test.ts` inlines its arbitraries and runs through the
  normal harness with bounded `numRuns`; the same files become the deep
  campaign when run with a time budget. Shared run plan lives in
  `src/fuzz-budget.ts`.
- Seed policy: random (broadest coverage). A discovered counterexample is
  reproduced from the printed seed and pinned as a fast-check `examples`
  entry on the offending property.
- Runtime: node. node v26 runs the `.ts` test files directly (native type
  stripping) and the module-test harness runs under it; node exits non-zero
  on failure. Run tests and scripts with `node`, not `bun`.
- Imports: from sibling source `.ts` (this package's established test
  convention; it lets the tests reach internal helpers not in the public
  index). Internal helpers needed by tests are `export`ed at file level only,
  never added to `src/index.ts`.

## How to run

Bounded (normal) mode, one file:

```bash
node packages/dev-script/file-enforcer/src/pipeline/json.property.unit.test.ts
```

Campaign mode (per-property time budget in ms):

```bash
FILE_ENFORCER_FUZZ_BUDGET_MS=60000 node packages/dev-script/file-enforcer/src/pipeline/json.property.unit.test.ts
```

On failure, fast-check prints `{ seed, path }` and the shrunk
`Counterexample`. Reproduce, fix, then pin the counterexample as an
`examples` entry on that property.

## Findings (bugs the fuzzer surfaced)

### 1. json.ts: special-key (`__proto__`) assignment footgun (fixed)

`mergeFlatJson`, `mergeObjectDefaults`, and `omitJsonKey` built results with
bracket assignment (`updated[key] = value`, `updated[key] ??= value`). For
the key `__proto__`, that routes through the `Object.prototype` setter
instead of creating an own property, silently dropping the key. JSON parsed
from config/settings can legally carry a `__proto__` key, so this lost data
(and was prototype-manipulation adjacent).

Fix: added `setOwnJsonValue` (uses `Object.defineProperty`, always an own
enumerable data property) and route all dynamic-key writes through it;
read existing union members through an `Object.hasOwn` guard so inherited
members of special keys never leak in. Verified no prototype pollution.

### 2. json.ts: `mergeObjectDefaults` clobbered explicit null (fixed)

The TSDoc and existing unit test say it adds defaults "only where absent,
preserving existing values," but the `??=` implementation also overwrote an
existing `null` (nullish). Counterexample: `base {"":null}, defaults {"":""}`
yielded `""`, not `null`.

Fix: fill only when the key is genuinely absent (`!Object.hasOwn`), so an
explicit `null`/`false` is preserved. Aligns implementation with the
documented contract; existing unit test still passes.

## Status

Done:

- fast-check devDependency added (`catalog:`), resolves for the package.
- `src/fuzz-budget.ts` shared run plan (bounded vs campaign via
  `FILE_ENFORCER_FUZZ_BUDGET_MS`).
- `src/jetbrains/options-dir.ts`: `parseVersionParts`, `compareVersionParts`,
  and the `NOT_A_MATCHING_PRODUCT` sentinel exported at file level (not in
  index) for the upcoming property test.
- `src/pipeline/json.property.unit.test.ts` written and green under node;
  source bugs 1 and 2 fixed and verified; existing `json.unit.test.ts` still
  green.

Remaining:

- Property tests: glob (`io/glob.ts`), registry (`package/registry-parse.ts`),
  XML coding (`pipeline/xml-coding.ts`), TOML (`pipeline/toml.ts`), XML
  entries (`pipeline/xml.ts`), JetBrains versions (`jetbrains/options-dir.ts`).
- `fuzz` mise task (node, container-isolated, sets the budget env).
- Decision doc `docs/decisions/file-enforcer-fuzzing.md` (no AGENTS.md
  pointer, per user).
- Full verify: lint, types, all property files under node, falsifiability
  check, campaign smoke.

## Files

Created:

- `src/fuzz-budget.ts`
- `src/pipeline/json.property.unit.test.ts`
- `HANDOVER.fuzzing.md` (this file)

Modified:

- `package.json` (fast-check devDependency)
- `src/pipeline/json.ts` (findings 1 and 2)
- `src/jetbrains/options-dir.ts` (file-level exports)
