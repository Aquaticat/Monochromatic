# cli-git and unified-linter implementation

## Authority

Implementation authorized on 2026-10-04 by the user's "Do it."
The user subsequently selected a simple handwritten merge inside the linter for now.
Do not wait for the deepmerge fork or implement a separate merge package.
The accepted scope is in
[`cli-git-rust-implementation.md`](../planning/cli-git-rust-implementation.md)
and
[`unified-linter.md`](../planning/unified-linter.md).

## Work queue

- [ ] Unified-linter foundation: JSONC schema, ordered merge, command interface, and artifact tests.
- [ ] Unified-linter Rust and Markdown/MDX rules, processors, fix mapping, and consumer parity.
- [ ] Forbidden-strings structured embedding interface, standalone parity, and integration fuzzing.
- [ ] Rust cli-git configuration, Git resolution/argv, static policies, and management commands.
- [ ] Rust cli-git transactions, hooks, locks, replay, recovery, worktree copy, and auto-push.
- [ ] Container integration, mutation testing, fuzzing, platform checks, and release-artifact performance gates.
- [ ] Coordinated native installation, consumer migration, documentation, and retirement of old implementations.

Each item needs its own passing evidence before completion.
Current production tools remain active until cutover.
The first crates.io publication still needs explicit user approval.

## Prerequisites and evidence

- Rust JSONC prerequisite:
  `mise run //package/rust-module/jsonc-edit:test:debug` passed on 2026-10-04.
- Latest Git:
  the official `https://git-scm.com/downloads` page reports 2.56.0;
  the official `git/git` tag list corroborates `v2.56.0`.
  Use that exact stable release for the initial latest-only container fixture.
- The deepmerge fork exists as `Aquaticat/deepmerge-ts`,
  and the repository has the public JSON corpus in `package/module/deepmerge-ts.fuzz/src/json-case.ts`.
  Fork work is unnecessary after the user's handwritten-merge instruction.
  Do not read or copy its embargoed `*.local.*` findings into public artifacts.

## Completed slices

The handwritten merge is implemented in `package/linter/monochromatic-lint/src/config_merge.rs`.
It uses the parser's value model,
merges every key's full input group together,
concatenates arrays,
preserves first-seen key order,
and selects the last value on any kind mismatch.
The public JSON corpus is copied from the existing sidecar;
no generic deepmerge package is added.

Verification:

- `mise run //package/linter/monochromatic-lint:lint:types` passed.
- `mise run //package/linter/monochromatic-lint:test:container` passed in a mount-free,
  network-disabled 2 GiB / 2 CPU container.
- Tests include the independent corpus,
  a wrong-pairwise-fold positive control,
  and the parser's 512-container limit.
- The first comment-ownership fixture failed because comments after a comma on the same line belong to the preceding value.
  The fixture now uses separate lines and asserts that the intended final comment is present before testing ownership.

Mutation and fuzz gates are not yet implemented;
this is an implementation slice,
not package completion.

## Current step

Add JSONC schema validation and configuration lookup.
Reject duplicate keys and invalid data before invoking the merge;
preserve the accepted nearest-config and ordered-block semantics.
