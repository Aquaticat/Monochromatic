# cli-git native integration

## Purpose and how to respond

This branch integrates the lanes of the native commit path (`package/git-policy/cli/src/native/`) and wires
`git commit` to the full transaction, so the native executable replaces the incumbent TypeScript wrapper.
Branch `feat/cli-git-native-integration`, worktree `.claude/worktrees/cli-git-lane-integration`,
created from the transactions head `fd26b74a99`.
Paths starting with `src/`, `bin/` or `e2e/` are relative to `package/git-policy/cli/`;
every other path is repository-relative.

Respond by merging the branch into `main` and by vetoing any item under `Choices open to veto`.

## State

Merged into this branch, in order:

- `main` (merge `30cdbc2311`): the dependent-version wiring and the `mise.lock` revision 2 upgrade.
  Resolution edits inside that merge commit: both sides kept in the fuzz crate, `Cargo.toml`, `mise.toml` and the
  test module lists; the frontier tests dropped the `*_NEEDS` constants that main removed with the two wired policies;
  `commit_convergence.rs` builds `EventPath::from_git_bytes` (main's event path type);
  the dead helpers `content_refused` and `manual_push_refused` were removed from `wrapped_command_tests.rs`;
  `commit_transaction_tests.rs` got the `return` that the Clippy `implicit_return` lint demands.
- `feat/cli-git-native-landing` (merge `d3a14689e5`): slice 7a.
- `feat/cli-git-native-post-landing` (merge `cda16d1341`): slice 7b.
- `feat/cli-git-native-config` (merge `1bc75f16fd`): `cli-git.config.jsonc` and the differential.
- `feat/cli-git-native-e2e` (merge `280d30e425`): the `E2E_WRAPPER` selector, merged at its committed head
  `51a72ff4a0`; its evidence doc did not exist then, so it is merged again when it does.

Native `cargo check --all-targets` passed on the main merge; Clippy passed on it after the edits above.

## Work in progress

Slice 8 remainder, slice 9 wiring, differential JSONL, the end-to-end suite and the gates.
