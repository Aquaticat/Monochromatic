# Handover: splitting JSONC out of module-es into module-jsonc-edit

Living status doc.
Updated as the package is scaffolded and implemented.

## Goal

Extract the hand-written comment-preserving JSONC parser from
`packages-paused/module/es` into a new active package `packages/module/jsonc-edit`
(`private: true`), and build a full read, edit, and write API on top, shaped after
`packages/module/toml-edit`.
Performance is an explicit goal (the native `JSON.parse` fast-path).

## Where this work lives

- Worktree:
  `/var/home/user/worktrees/jsonc-edit` on branch `feat/jsonc-edit`.
- The whole feature lives on that branch;
  merge to `main` when ready.

## Decisions (locked)

See `docs/decisions/jsonc-edit-parser-foundation.md` for the full rationale.
Summary:

- Keep the hand-written parser (clean rewrite), do not adopt a library.
  Every surveyed library fails a reason-for-existence:
  merged per-key and per-value comment model, `JSON.parse` fast-path, zero-dep,
  run-everywhere (no WebAssembly), branded types.
- Write model:
  canonical rebuild from the structured tree, comments as first-class data.
  No source ranges, no splice mode.
  Raw scalar tokens preserved for unedited values;
  duplicate keys preserved losslessly.
- API:
  immutable `JsoncEditState`, named free-functions with a `jsonc` prefix.
  The `$` / namespace export style is dropped.
- Comment API:
  attached model (`jsoncGetComment` / `jsoncSetComment` for a value's comment,
  `jsoncGetKeyComment` / `jsoncSetKeyComment` for a key's comment).
- Tests:
  full `toml-edit` parity (unit, fast-check fuzz, STB adversarial boundaries, real-world
  corpus, V8 coverage-baseline gate, a curated JSONC conformance harness).
- es cleanup:
  delete the `t object/t jsonc` subtree plus the t-string and t-boolean jsonc type bits
  from `module-es`, and drop the jsonc namespaces from its barrels.

## Public API (target)

- `parseJsoncEdit`, `jsoncStringify`
- `jsoncGet`, `jsoncGetValue`, `jsoncHas`, `jsoncKeys`, `jsoncSet`, `jsoncDelete`
- `jsoncGetComment`, `jsoncSetComment`, `jsoncGetKeyComment`, `jsoncSetKeyComment`

## How to run (in the worktree)

```bash
# from /var/home/user/worktrees/jsonc-edit
mise i                                            # install pinned toolchain (done once)
mise run //packages/module/jsonc-edit:build
mise run //packages/module/jsonc-edit:lint:oxlint
mise run //packages/module/jsonc-edit:lint:types
mise run //packages/module/jsonc-edit:test:unit
mise run //packages/module/jsonc-edit:fuzz
mise run //packages/module/jsonc-edit:test:conformance
```

## Status

Progress (newest first):

- 2026-06-30 (later):
  Package scaffolded and building. Value model (`comment.ts`, `brand.ts`,
  `value.ts`) done, type-checks and lints clean. Parser core written:
  `errors.ts`, `merge-comments.ts`, `scan.ts`, `parse-trivia.ts`, `parse.ts`,
  `parse-jsonc.ts`. The parser type-checks but does NOT yet pass oxlint:
  it is written in an imperative cursor style that violates the repo's
  functional rules. Committed as WIP. Lint remediation is the next step,
  before the serializer.
- 2026-06-30:
  worktree created, toolchain installed, decision doc written, task list set up.

## Lint remediation plan for the parser core

The parser logic is correct and type-checks; only its style needs reshaping to
satisfy these rules (learned from the rule sources and fixtures):

- `no-restricted-syntax/no-function-root-let`:
  a root-level `let` is allowed only in the "helper shape" where the function
  ends with `return <thatIdentifier>`. Otherwise move the cursor into a
  `for (let cursor = start; cursor < source.length; )` init (empty increment,
  advance inside), which is not a function-root `let`. Accumulators (`comment`,
  `commaSeen`) should become a `const` array pushed to in the loop, then reduced
  or derived at the single return.
- `no-restricted-syntax/no-nullish-union` (shortcode `l`):
  no `T | undefined` or `T | null` annotations. Use `?:` optionals, plain `T`,
  or a `Symbol` sentinel. So `TriviaScan`, `TrailingScan`, `ScalarScan`, and the
  helper params that read `comment?: JsoncComment | undefined` drop the
  `| undefined`; locals typed `X | undefined` get restructured away (collect into
  a `const` array, conditionally include the property at return so no `undefined`
  is ever assigned to an optional).
- `eslint(init-declarations)`:
  every binding initialized at declaration.
- `exactOptionalPropertyTypes`:
  never assign `undefined` to an optional property; build the return object with
  the property present only when defined (`length === 0 ? { end } : { comment, end }`).

Concretely, restructure `scan.ts` (`scanString`, `scanNumber`),
`parse-trivia.ts` (`skipTrivia`, `captureTrailing`), and the loops in `parse.ts`
to the for-init-cursor plus const-accumulator shape. Also one file trips
`max-lines` (300 code lines): split `parse.ts` (move `closeArray`/`closeRecord`
and the entry helpers to a sibling, keep the mutually-recursive
`parseValue`/`parseArray`/`parseRecord`/`parseEntry` together).

## Task map

Tracked in the session task list.
Phases:
decision doc (done),
this handover (living),
scaffold,
types,
parser rewrite,
serializer,
edit API,
comment API,
tests,
fuzz,
conformance,
coverage gate,
benchmarks,
es cleanup,
final verify.

## Source of truth for behavior

The original parser and its tests under
`packages-paused/module/es/src/types/t object/t jsonc/` are the behavioral spec.
The rewrite preserves their invariants;
it does not preserve their structure or style.

## Open implementation notes

- The value model needs raw scalar text on nodes so canonical emit can preserve
  author formatting (`1.0` stays `1.0`) for unedited values.
- `fastPath.ts` and a few siblings exceed the 300-line `max-lines` budget;
  split on the way in, do not carry the violation over.
- Benchmarks compare against `jsonc-eslint-parser` and `jsonc-parser`
  (devDependencies of this package).
