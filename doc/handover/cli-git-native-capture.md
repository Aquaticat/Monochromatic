# cli-git native capture lane

## Scope

Lane `capture` ports slice 5 of `doc/handover/cli-git-native-transactions.md`
into `package/git-policy/cli/src/native/`:
invocation capture,
the capture store lock and sequence allocation,
`captured.json`,
the shadow repository,
private indexes and selection modes,
and native preparation writing `prepared.json`.

Branch `feat/cli-git-native-capture`, based on `feat/cli-git-native-transactions` at `0faec78d77`.
Paths below are relative to `package/git-policy/cli/` unless repository-relative.

The commit refusal (`Unported::CommitTransaction`) stays in place,
and no production entry point calls the new API.

## Inventory before this lane

Pre-existing and reused without change:

- `private_storage.rs`: private file writes, exclusive synced writes, no-follow regular reads, tree removal.
- `capture_records.rs`: `CapturedRecord` with encode and read of `captured.json`,
  landed-capture records, recording after landing, pruning.
  The writer of `captured.json` is missing and is added by this lane.
- `capture_store.rs`: store paths, `read_next_capture_sequence`, `parse_sequence`, `ensure_capture_store`,
  `read_worktree_id`, bounded store reads.
  The capture lock, identity creation and sequence write are missing.
- `shadow_git.rs`: `shadow_repository_path`, `shadow_request`, `REPOSITORY_REDIRECT_VARIABLES`,
  `remove_shadow_repository`.
  Shadow creation is missing.
- `conclusion_cleanup.rs`: conclusion file-name constants, `resolve_pseudoref`, `is_store_held`,
  `same_tree`, and the landing-side cleanup.
  The preparation-time copy into the shadow is missing.
- `candidate_private_index.rs`: `PrivateIndex`, a candidate-prediction copy that tolerates an absent index.
  Its copy semantics differ from the incumbent's `copyIndexFile`, which fails on an absent source,
  so this lane writes its own strict copy instead of reusing it.
- `owner_lock.rs`, `transaction_registry.rs`, `transaction_journal.rs`, `transaction_journal_encode.rs`:
  reused for the capture lock, the transaction directory and the `PreparedRecord` shape.
- `transaction_git.rs`: the captured runner.
  It has no inherited-stdio mode, so this lane adds one in its own module.
- `forwarding.rs` `git_command`: reused to build real-Git commands.

Missing and added by this lane: invocation layout and base capture,
the capture-order lock and identity and sequence write,
the `captured.json` writer,
shadow config, links, refs and conclusion copy,
the private commit index with its selection modes,
pathspec file materialization,
the argument transforms of `privateExplicitCommitArgs`, `privateSelectionCommitArgs`,
`resolvePrivateCommitArgs`, `splitCommitInvocation` and `withoutAllFlag`,
native preparation with the hook seam, and `prepared.json`.

## Commits

None yet.

## Deviations from the plan

The plan names the acceptance tests "Binary".
The brief forbids wiring the commit path,
so the acceptance tests drive this lane's public API in-process against the container's Git 2.56.0.

## Choices open to veto

None yet.
