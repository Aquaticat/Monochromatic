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
- The from-scratch encoders had the same control-character gap on a different
  code path: `encodeStringWithStyle` (used when `tomlSet` writes a fresh string)
  and `encodeKey` (used for any quoted key) escaped only the named escapes,
  emitting NUL, U+001F, U+007F, and bare newlines raw. The toml-test encoder
  cases surfaced it. Fixed by extracting the exhaustive escaper to a shared
  `basic-escape.ts` and delegating all three call sites (`emit-value-string.ts`,
  `value-encoders.ts`, `keys.ts`); the emit-seams property pins the regression.
- `parseTomlEdit` accepted a bare carriage return (a lone `CR` not part of
  `CRLF`), which TOML forbids everywhere, including inside multiline strings.
  toml-eslint-parser inherits the laxity. Fixed in a pre-parse scan that rejects
  any `CR` not followed by `LF`; the toml-test `invalid/control/*-cr` cases and a
  pinned parser-property example pin the regression.

## Newline policy

`parseTomlEdit` normalizes `CRLF` to `LF` before parsing and holds the normalized
source in the state, so the splice, comment-range, and emission paths only ever
reason about single-byte `LF` newlines. The conversion is announced with a
`warn`-level log (suppressible via `WARN=false`, a mechanism added to
`@monochromatic-dev/module-logger` for machine-protocol consumers whose output
streams must stay clean). A bare `CR` is rejected rather than normalized, so the
policy stays spec-correct: only valid `CRLF` is rewritten. The trade-off is that a
`CRLF` document no longer round-trips byte-identically; it round-trips as `LF` by
design.

The policy is symmetric on output: the canonical builder's `lineBreak` option
(formerly `'\n' | '\r\n'`) was dropped, so canonical emission only ever writes
`LF`. No caller requested `CRLF` output, and keeping an opt-in knob that
re-introduces the line ending the parser refuses to round-trip was the asymmetry
the normalization set out to remove. The package is now `LF`-only end to end,
which is what lets `splice.ts` and `comments.ts` reason about a single-byte
newline without any `CR` branch.

## Conformance (phase 6)

Package-local node adapters under `packages/module/toml-edit/src/conformance/`
satisfy the upstream `toml-test` runner's decoder (TOML to tagged JSON) and
encoder (tagged JSON to TOML) interfaces, exercising the built package across the
consumer boundary:

- The decoder gates acceptance through `parseTomlEdit`, validates UTF-8 strictly
  at the byte boundary (a fatal `TextDecoder` rejects the malformed-byte and
  surrogate corpus cases), and walks the parse-time AST into a kind-aware tagged
  model (the converter deferred from phase 2): integers use the node's exact
  `bigint`, offset datetimes normalize to an RFC 3339 instant, and local
  datetimes pad in a seconds field the runner's layout requires.
- The encoder rebuilds via `emptyTomlEdit` plus `tomlSet`, so the package's
  emission path is what the runner reparses and compares; integers use a `bigint`
  wrapper and the three local datetime kinds use tagged wrappers a `Date` cannot
  distinguish.
- The `test:conformance` task acquires the runner through mise's `github:` backend
  at `latest` (a deliberate moving oracle, not pinned; mise verifies the release
  attestation and SLSA provenance, and the task logs the resolved version) and
  runs both adapters for TOML 1.0 and 1.1 under `WARN=false`. Both versions pass
  every valid, encoder, and invalid case with no allow-list.

## Bugs found and deferred

The stateful edit-model property surfaced two deeper edit-machinery defects that
need resolver-level changes (making set and delete aware of pending insertions),
so they are tracked as a follow-up in #252 rather than fixed in this scope:

- Repeated path-create set at the same parse-time-absent path emits a duplicate
  key (invalid TOML), because the resolver reads only the parse-time AST.
- Delete of an implicit dotted-key parent removes it from delta-aware reads but
  not from the serialized bytes.

The stateful property reparses between operations and stays on single top-level
segments, so it does not exercise these edges.

## Deferred

- A differential parser oracle (BurntSushi via the Go `toml-test` tools) is
  tracked in the implementation plan as phase 7.
- A V8 coverage gate and the reusable fuzz-target checklist land with phase 8.
- Mutation testing remains a follow-up.
