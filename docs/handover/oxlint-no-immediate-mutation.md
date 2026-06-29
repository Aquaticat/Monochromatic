# Oxlint no-immediate-mutation handover

## User request

Implement the oxlint `unicorn/no-immediate-mutation` replacement work:

- Document the upstream oxlint behavior under `docs/troubleshooting/` using the troubleshooting-doc process.
- Auto-prototype the Rust-side upstream behavior in a fresh `/tmp/agent` clone.
- Disable oxlint's built-in `unicorn/no-immediate-mutation` rule in repo config.
- Add a custom `no-restricted-syntax/no-immediate-mutation` rule that preserves the efficient Set/Map clone-plus-mutate pattern.
- Keep this handover updated for auto-compaction recovery.

## Required skills

- `troubleshooting-doc`,
   because this is an external oxlint behavior diagnosis and needs the required source trace,
  verification catalogs,
   workarounds,
   upstream filing decision,
   and Rust prototype evidence.
- `testing-practices`,
   because the no-restricted-syntax plugin tests use `@monochromatic-dev/module-test/ts`.
- `code-review`,
   for final implementation review before reporting completion.

## Important repo rules in play

- Use `mise run` for repo package builds,
   lint,
   type checks,
   and tests.
- Do not touch unrelated external worktree changes.
   `git status --short` showed only `mise.lock` modified before main edits,
  and that file was not touched by this work.
- Commit scoped changes eagerly with explicit pathspecs once a meaningful checkpoint is ready.
- Troubleshooting docs must include source citations,
   reproductions,
   workarounds,
   and upstream filing artifact decisions.

## Current evidence and decisions

- Installed repo oxlint version checked via `node_modules/oxlint/package.json`:
   `1.71.0`.
- Oxc upstream docs for `unicorn/no-immediate-mutation` say auto-fix is planned but not implemented.
- A scratch local invocation showed `oxlint --fix --allow all --warn unicorn/no-immediate-mutation` reports
  `const nextSeen = new Set(seen); nextSeen.add(variable);` and leaves the file unchanged.
- Upstream `eslint-plugin-unicorn` docs state its version of the rule is fixable.
- Upstream oxlint source was cloned under `/tmp/agent/oxc-no-immediate-mutation-prototype.ufNRqZu4` for the Rust prototype.
- Fresh clone origin and commit were verified:
  - origin:
     `https://github.com/oxc-project/oxc.git`
  - commit:
     `d8c6b550c8802cc68f8e404f279cdc603692b3b6`
  - commit subject:
     `fix(linter/unicorn/custom-error-definition): handle non-ascii class names (#23939)`
- Prototype intent:
   skip reports for `new Set(existing); set.add(value)` and
  `new Map(existing); map.set(key, value)` when folding the mutation into the initializer would require
  `[...existing, value]` or `[...existing, [key, value]]`.
- Desired behavior:
  - still report `new Set([a]); set.add(b)` and `new Map([[a, b]]); map.set(c, d)`.
  - still report `new Set(); set.add(b)` and `new Map(); map.set(c, d)`.
  - allow `new Set(existing); set.add(b)` and `new Map(existing); map.set(c, d)`.

## Upstream Rust prototype status

Prototype file edited in disposable clone:

- `/tmp/agent/oxc-no-immediate-mutation-prototype.ufNRqZu4/crates/oxc_linter/src/rules/unicorn/no_immediate_mutation.rs`

Prototype changes made:

- Changed `InitType::Set` and `InitType::Map` to carry `needs_spread_temp: bool`.
- Added `collection_init_needs_spread_temp` helper.
- Suppressed `Set.add` and `Map.set` diagnostics when `needs_spread_temp` is true.
- Added pass cases for `new Set(existingSet); set.add(3)` and `new Map(existingMap); map.set("bar", 2)`.

Prototype verification command started with process tool:

```bash
# /tmp/agent/oxc-no-immediate-mutation-prototype.ufNRqZu4
cargo test --package oxc_linter no_immediate_mutation::test
```

The first process exited with code `101` because `/tmp` hit a disk-quota failure while compiling `oxc_linter`:

```text
rustc-LLVM ERROR: IO failure on output stream: Disk quota exceeded
error: could not compile `oxc_linter` (lib test)
```

The clone's `target/` directory was removed and the verification was rerun with
`CARGO_TARGET_DIR=/var/home/user/temp/oxc-no-immediate-mutation-target`.
That second process completed successfully:

```text
running 1 test
test rules::unicorn::no_immediate_mutation::test ... ok

test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 1162 filtered out; finished in 0.09s
```

## Main worktree status

New main-worktree file written but not yet verified:

- `packages/oxlint-plugins/no-restricted-syntax/src/rules/no-immediate-mutation.ts`

The draft custom rule currently:

- Visits `ExpressionStatement` nodes.
- Looks at the immediate previous sibling statement in `Program`,
   `BlockStatement`,
   `StaticBlock`,
   or `SwitchCase` bodies.
- Classifies previous `const x = []`,
   `x = []`,
   object literals,
   `new Set`,
   `new WeakSet`,
   `new Map`,
   and `new WeakMap` initializers.
- Reports immediate array `push` and `unshift`,
   object property assignment,
   `Object.assign`,
   Set `add`,
   and Map `set`.
- Allows Set/Map clone-plus-mutate when the constructor has exactly one non-array-literal iterable argument.

The custom rule was wired into:

- `packages/oxlint-plugins/no-restricted-syntax/src/index.ts`
- `packages/test-fixture/oxlint-no-restricted-syntax/.oxlintrc.fixture.json`
- `packages/config/oxlint/src/rules/restriction.ts`
- `packages/oxlint-plugins/no-restricted-syntax/src/oxlint-no-restricted-syntax.unit.test.ts`
- `packages/test-fixture/oxlint-no-restricted-syntax/src/invalid/no-immediate-mutation.ts`
- `packages/test-fixture/oxlint-no-restricted-syntax/src/valid/no-immediate-mutation.ts`

Implementation was split across:

- `packages/oxlint-plugins/no-restricted-syntax/src/rules/no-immediate-mutation.ts`
- `packages/oxlint-plugins/no-restricted-syntax/src/rules/no-immediate-mutation.syntax.ts`

Repo commit `079cef1aa` records this checkpoint.

## Next steps

1. Run markdown lint or formatting for the new troubleshooting and handover docs.
2. Re-run final package verification after documentation edits if any source files change.
3. Commit `docs/troubleshooting/oxlint-no-immediate-mutation-set-clone.md`,
   `docs/troubleshooting/oxlint-no-immediate-mutation-set-clone.patch`,
    and this updated handover.
4. Keep avoiding unrelated `mise.lock`,
    which remains modified by external work.
5. Before final response,
    audit that the troubleshooting doc,
    custom plugin rule,
    config change,
    tests,
   and commits are all present and verified.

## Keep updated

Update this file after each major change,
 especially after:

- Rust prototype verification result.
- Main plugin wiring.
- Test fixture changes.
- Troubleshooting doc creation.
- Verification command results.
- Commits.
