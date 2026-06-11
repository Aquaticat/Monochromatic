# TOML edit fuzzing

Decision record for the property-based fuzzing of
`@monochromatic-dev/module-toml-edit` (issue #198). This file grows as the work
lands; it currently covers the method, the unstable seam exports, and the bugs
found so far. The full implementation plan and status live at
`packages/module/toml-edit/HANDOVER.fuzzing.md`.

## Method

The suite is property-based, built on `fast-check` and the
`@monochromatic-dev/module-test` harness, and runs under node (node v26 runs the
`.ts` files directly). The same `*.property.unit.test.ts` files serve two layers:
a bounded run in the normal unit suite, and a time-budgeted campaign through the
package `fuzz` task (`TOML_EDIT_FUZZ_BUDGET_MS`). See
`packages/module/toml-edit/src/fuzz-budget.ts`.

Every property file imports the built package entry point
(`@monochromatic-dev/module-toml-edit`), not sibling source, so the suite tests
the shipped artifact across the consumer boundary. The `fuzz` task therefore
builds before running.

The oracle stack so far:

- A semantic-equality oracle (`packages/module/toml-edit/src/fuzz/equality.ts`)
  over the parser's `getStaticTOMLValue` projection.
- Grammar-complete generators for every value, key, and document shape
  (`packages/module/toml-edit/src/fuzz/arb-*.ts`), with an independent string
  escaper (`packages/module/toml-edit/src/fuzz/escape.ts`) so generator encoding
  never reuses the emitter under test.
- Structure-aware corruption mutators
  (`packages/module/toml-edit/src/fuzz/mutators.ts`).
- A corpus loader (`packages/module/toml-edit/src/fuzz/corpus.ts`): committed
  fixtures always, live repository discovery only in campaign mode, with curated
  fixture sets and secret-looking paths excluded.

## Unstable seam exports

Property files exercise internal encoders and emitters through the built artifact
rather than sibling source imports. Where a seam is not part of the public API,
it is re-exported from `packages/module/toml-edit/src/index.ts` with an
underscore prefix: `_encodeKey`, `_jsValueToTomlText`, `_emitContentNode`,
`_emitStringValue`, and `_spliceEmit`.

These exports carry no compatibility promise. They exist for observability and
fuzzing, their signatures may change without a major version bump, and
application code must not depend on them. The underscore prefix is the marker.
Each export is documented at its declaration in `index.ts` and in the package
README.

## Bugs found and fixed

- `parseTomlEdit` leaked a raw `RangeError` on pathologically deep `[` or `{`
  nesting (a stack overflow escaping the `ParseError`-only catch). Fixed by
  wrapping every non-`ParseError` throw from the parser as `TomlEditError`; the
  totality property pins the regression.
- `emitStringValue` escaped only the named control escapes, emitting other
  control scalars (NUL, U+001F, U+007F) raw and producing invalid TOML. Fixed by
  escaping every control scalar below U+0020 plus U+007F as `\uXXXX`, in both
  single-line and multiline basic strings; the emitter property pins the
  regression.

## Deferred

- A kind-aware tagged-JSON value model, the `toml-test` conformance harness, and
  a differential parser oracle are tracked in the implementation plan.
- The reusable fuzz-target checklist lands with the coverage gate.
- Mutation testing remains a follow-up.
