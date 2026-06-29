# Oxlint no-immediate-mutation handover

## User request

Implement the oxlint `unicorn/no-immediate-mutation` replacement work:

- Document the upstream oxlint behavior under `docs/troubleshooting/` using the troubleshooting-doc process.
- Auto-prototype the Rust-side upstream behavior in a fresh `/tmp/agent` clone.
- Disable oxlint's built-in `unicorn/no-immediate-mutation` rule in repo config.
- Add a custom `no-restricted-syntax/no-immediate-mutation` rule that preserves the efficient Set/Map clone-plus-mutate pattern.
- Keep this handover updated for auto-compaction recovery.

## Required skills

- `troubleshooting-doc`, because this is an external oxlint behavior diagnosis and needs the required source trace,
  verification catalogs, workarounds, upstream filing decision, and Rust prototype evidence.
- `testing-practices`, because the no-restricted-syntax plugin tests use `@monochromatic-dev/module-test/ts`.
- `code-review`, for final implementation review before reporting completion.

## Important repo rules in play

- Use `mise run` for repo package builds, lint, type checks, and tests.
- Do not touch unrelated external worktree changes. `git status --short` showed only `mise.lock` modified before main edits,
  and that file was not touched by this work.
- Commit scoped changes eagerly with explicit pathspecs once a meaningful checkpoint is ready.
- Troubleshooting docs must include source citations, reproductions, workarounds, and upstream filing artifact decisions.

## Current evidence and decisions

- Installed repo oxlint version checked via `node_modules/oxlint/package.json`: `1.71.0`.
- Oxc upstream docs for `unicorn/no-immediate-mutation` say auto-fix is planned but not implemented.
- A scratch local invocation showed `oxlint --fix --allow all --warn unicorn/no-immediate-mutation` reports
  `const nextSeen = new Set(seen); nextSeen.add(variable);` and leaves the file unchanged.
- Upstream `eslint-plugin-unicorn` docs state its version of the rule is fixable.
- Upstream oxlint source was cloned under `/tmp/agent/oxc-no-immediate-mutation-prototype.ufNRqZu4` for the Rust prototype.
- Fresh clone origin and commit were verified:
  - origin: `https://github.com/oxc-project/oxc.git`
  - commit: `d8c6b550c8802cc68f8e404f279cdc603692b3b6`
  - commit subject: `fix(linter/unicorn/custom-error-definition): handle non-ascii class names (#23939)`
- Prototype intent: skip reports for `new Set(existing); set.add(value)` and
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

The process exited with code `101`. The failure output still needs inspection with:

```text
process output proc_1
```

or by reading the process log files from the process tool.

## Main worktree status

New main-worktree file written but not yet verified:

- `packages/oxlint-plugins/no-restricted-syntax/src/rules/no-immediate-mutation.ts`

The draft custom rule currently:

- Visits `ExpressionStatement` nodes.
- Looks at the immediate previous sibling statement in `Program`, `BlockStatement`, `StaticBlock`, or `SwitchCase` bodies.
- Classifies previous `const x = []`, `x = []`, object literals, `new Set`, `new WeakSet`, `new Map`, and `new WeakMap` initializers.
- Reports immediate array `push` and `unshift`, object property assignment, `Object.assign`, Set `add`, and Map `set`.
- Allows Set/Map clone-plus-mutate when the constructor has exactly one non-array-literal iterable argument.

This file has not yet been wired into:

- `packages/oxlint-plugins/no-restricted-syntax/src/index.ts`
- `packages/test-fixture/oxlint-no-restricted-syntax/.oxlintrc.fixture.json`
- `packages/config/oxlint/src/rules/restriction.ts` or `style.ts`
- fixture files and unit tests

## Next steps

1. Inspect the failed Rust prototype process output and fix the prototype if needed.
2. Re-run the targeted upstream Rust prototype test until it proves failure becomes pass and existing literal cases still fail.
3. Save the prototype diff or patch details for the troubleshooting doc.
4. Finish wiring `noImmediateMutation` into the plugin index and fixture config.
5. Disable built-in `unicorn/no-immediate-mutation` in repo config and enable `no-restricted-syntax/no-immediate-mutation` at the intended severity.
6. Add invalid and valid fixtures for the new rule.
7. Add focused unit assertions for the Set/Map clone exception and literal initializer reports.
8. Run package verification with `mise run //packages/oxlint-plugins/no-restricted-syntax:lint:types`,
   `mise run //packages/oxlint-plugins/no-restricted-syntax:lint:oxlint`, and the package unit test task.
9. Write `docs/troubleshooting/oxlint-no-immediate-mutation-set-clone.md` with full required sections.
10. Commit scoped paths with Conventional Commit messages, avoiding unrelated `mise.lock`.

## Keep updated

Update this file after each major change, especially after:

- Rust prototype verification result.
- Main plugin wiring.
- Test fixture changes.
- Troubleshooting doc creation.
- Verification command results.
- Commits.
