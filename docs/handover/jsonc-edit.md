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

- 2026-06-30:
  worktree created, toolchain installed, decision doc written, task list set up.
  Scaffolding next.

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
