# cli-git native capture lane

## Scope

Lane `capture` ports slice 5 of `doc/handover/cli-git-native-transactions.md`
into `package/git-policy/cli/src/native/`:
invocation capture,
the capture-order lock, identity and sequence,
`captured.json`,
the shadow repository (config, alternates, links, refs, conclusion copy),
the private commit index with its selection modes,
pathspec-file materialization (file, newline and NUL records, standard input),
the commit argument transforms,
and native preparation (native `git commit` in the shadow, `prepared.json`, shadow removal on failure).

Branch `feat/cli-git-native-capture`, based on `feat/cli-git-native-transactions` at `0faec78d77`.
Paths below are relative to `package/git-policy/cli/` unless repository-relative.
The commit refusal (`Unported::CommitTransaction`) stays in place,
and no production entry point calls the new API.

## Inventory before this lane

Pre-existing and reused without change:

- `private_storage.rs`: private file writes, exclusive synced writes, no-follow regular reads, tree removal.
- `capture_records.rs`: `CapturedRecord` encode and read of `captured.json`, landed-capture records, pruning.
- `capture_store.rs`: store paths, `read_next_capture_sequence`, `ensure_capture_store`, bounded store reads.
- `shadow_git.rs`: `shadow_repository_path`, `shadow_request`, `REPOSITORY_REDIRECT_VARIABLES`,
  `remove_shadow_repository`.
- `conclusion_cleanup.rs`: conclusion names, `resolve_pseudoref`, `is_store_held`, the landing-side cleanup.
- `candidate_private_index.rs`: candidate-prediction copy that tolerates an absent index.
  Its semantics differ from the incumbent's `copyIndexFile`, which fails on an absent source,
  so this lane wrote its own strict copy.
- `owner_lock.rs`, `transaction_registry.rs`, `transaction_journal.rs`, `transaction_journal_encode.rs`,
  `transaction_journal_parse.rs`: reused for the lock, the transaction directory,
  the journal enums and the `PreparedRecord` encoder and parser.
- `forwarding.rs` `git_command`: reused for real-Git commands with an overlay.

Missing and added by this lane:
the invocation layout and base (`capture_invocation.rs`),
the capture-order lock, identity, sequence write, listing and `captured.json` writer (`capture_order.rs`),
shadow config (`shadow_config.rs`), links (`shadow_links.rs`), refs (`shadow_refs.rs`),
conclusion copy (`conclusion_copy.rs`), creation (`shadow_create.rs`),
argument transforms (`commit_args.rs`), the private index (`commit_index.rs`),
and native preparation (`commit_preparation.rs`).
`transaction_git.rs` has no inherited-stdio mode, so the two inherited runs (native commit and
interactive selection) build their commands through `forwarding::git_command` in their own modules.

## Commits

- `802a5e907c` inventory and scope.
- `b08758d1c0` invocation layout and base.
- `4726c5f985` capture lock, identity, sequence and listing.
- `401f4055fc` progress notes and the Git 2.55.0 runs.
- `bcd708f19d` shadow config and repository format.
- `8de05c2e48` shadow links.
- `858173a878` shadow refs.
- `9a70a28fad` shadow creation and conclusion copy.
- `c9b89a6005` commit argument transforms.
- `7f1a9b12c5` private commit index and selection modes.
- `4682ef8348` native preparation and `prepared.json`.
- `1869bad39b` lint fixes in the capture modules.
- `09c4ca20e7` incumbent differential tests and the capture-differential driver.
- scoping commit after `09c4ca20e7` (test block scoping only).

## Tests

Unit test counts per module, all run with `mise run //package/git-policy/cli:native:test:host -- <filter>`
against host Git 2.55.0:

- `capture_invocation`: 8.
- `capture_order`: 13.
- `shadow_config`: 6.
- `shadow_links`: 3.
- `shadow_refs`: 7.
- `shadow_create` and `conclusion_copy`: 10.
- `commit_args`: 9.
- `commit_index`: 18, including the incumbent differential tests.
- `commit_preparation`: 6, including the acceptance tests of preparation.

The container gate (`GIT_POLICY_NATIVE_IMAGE_TAG=capture`, Git 2.56.0) ran the whole library suite:
933 passed, 2 ignored, 0 failed, on commit `09c4ca20e7`.
The image is `localhost/git-policy-native-test:capture`, id `7387f9314cab`.

Tests were written after the implementation for the first modules (`capture_invocation`, `capture_order`,
`shadow_config`, `shadow_links`, `shadow_refs`, `shadow_create`, `conclusion_copy`, `commit_args`,
`commit_index`, `commit_preparation`), each commit holding both.
The brief asked for tests first, so this is a deviation recorded here.

## Acceptance tests

- Preparation leaves real refs, index and worktree bytes unchanged:
  `commit_preparation::tests::preparation_leaves_real_refs_index_and_worktree_unchanged`.
- Shadow `HEAD`, `@{upstream}`, an `includeIf "onbranch:"` value and `git rev-parse --git-dir` seen by a hook:
  the shadow answers are tested in `shadow_create::tests`, and a real pre-commit hook observes them in
  `commit_preparation::tests::a_hook_sees_the_shadow_head_upstream_include_and_git_dir`.
  The incumbent's own hook records the same four values through `native-interop/capture-differential.mjs`
  (`hook head=base upstream=origin/main onbranch=onbranch gitdir=.../cli-git/shadow/<transaction>`).
- A failing `commit-msg` hook propagates Git's exit code and leaves no shadow repository:
  `commit_preparation::tests::a_failing_commit_msg_hook_propagates_the_exit_code_and_removes_the_shadow`.
- Differential private index per selection mode:
  `commit_index::tests::private_index_trees_match_the_incumbent_for_each_selection`,
  `index_mode_trees_match_the_incumbent`, and `pathspec_file_trees_match_the_incumbent`.
  The expected trees are the incumbent's committed trees, recorded by
  `native-interop/capture-differential.mjs` in the interop image (Git 2.56.0), and the native tests pass
  on the host Git 2.55.0 and in the container gate.
  Seven selections match: explicit path, index plain, tracked (`-a`), include (`-i`),
  pathspec file with newline records, pathspec file with NUL records, and pathspec file from standard input.
  Each expected tree is `4f40a1ec2c64780454051d9d363c6870a6ef2f6e` (one file) or
  `efe77971c159b0a29a5d97e7169b8c35fa33a1f1` (two files).
  Interactive and patch selection are not compared: the incumbent refuses a non-terminal run.
  The incumbent's `commit-only` policy also refuses a plain `git commit` without a pathspec,
  so the index scenarios use `--no-only`.

## Git versions

The host `/usr/bin/git` is 2.55.0, and the lane's tests run against it as well as the container's 2.56.0.
Probed on 2.55.0: `reftable` repositories, `--object-format=sha256` repositories,
`config --list --null` output of a valueless extension (`extensions.worktreeconfig`, lowercase, no value line),
and the hook probe below.
Pre-existing test `git_metadata::tests::queries_capture_output_and_exit_state` asserts `git version 2.56.0`,
so it fails on the host (2.55.0). It is not in this lane's files.

## Probe: `hook.<event>.enabled=false` and `core.hooksPath` on Git 2.55.0

With `core.hooksPath` set to a plain directory holding a failing `commit-msg`,
`-c hook.commit-msg.enabled=false` does not suppress the script on Git 2.55.0:
the hook runs and the commit fails with exit 1 in both cases.
The seam still passes the incumbent's silenced events to native commit, as the incumbent does.
The container's Git 2.56.0 was not probed for this, and it is part of the trailing differential work.

## Deviations from the plan

- The plan calls the acceptance tests "Binary".
  The brief forbids wiring the commit path, so the acceptance tests drive this lane's public API in-process.
- The mode decision of `runCommitTransaction` (which mode, `stagedAll`, `readOnlySelection`) is not ported.
  It belongs to the orchestration slice, and the differential tests pass the mode directly.
- `prepared.json` takes `committed_paths`, `added_paths` and `selected_worktree_paths` from the caller.
  The incumbent fills them from the policy pass and hook changes, which are later slices.
- The reachable test phase hook (`reachTransactionPhase('capture-locked')`) is not ported.
  The capture lock waits silently (`SilentWait`) instead of logging the wait.
- Windows links: the incumbent uses junctions, which the standard library cannot create.
  This port uses directory symbolic links and file copies in `cfg(windows)` branches,
  and the Windows branches are not tested on Windows here.
- Windows private directories and files get no ACLs; the incumbent applies them through PowerShell.
- The hook dispatcher is not built here.
  `PreparationHooks` (directory and silenced events) is the seam, and the tests pass a plain directory
  and the incumbent's silenced list copied into the test.

## Choices open to veto

- A missing real index is an error when the private index is copied, as in the incumbent's `copyFile`.
  The candidate-prediction copy, which returns absent, is left unchanged.
- `PreparationHooks` is a struct parameter, not a trait, so the hooks lane can construct it directly.
- The `prepared.json` list fields come from the caller until the policy pass exists.

## Trailing gates

The coordinator's update moves these gates behind the cutover.
They were not run in this lane:

- The full old-and-new wrapper interop matrix.
  Only the one-direction differential (the incumbent writes, the native private index reads)
  was run, through `native-interop/capture-differential.mjs`.
- Long fuzz campaigns.
  This lane adds no fuzz target; the existing targets are not extended.
- The non-UTF-8 path field gate.
  Latin-1 path decoding is covered by `capture_order::tests::paths_decode_as_latin1_bytes`, and the
  remaining non-UTF-8 field checks are trailing.

## Gate results

- Container test gate: passes for every test, with 933 library tests passing on commit `09c4ca20e7`.
- Container Clippy (part of the same task): fails on files this lane did not change,
  which already fail on the base commit `0faec78d77`:
  `src/native/entry_tests.rs:114` (`forward_after` is never used),
  `src/native/index_lock_wait_tests.rs:190` and `:201` (missing `return`),
  and `src/native/index_writer_coordination_tests.rs:192` (`match` replaceable by `?`).
  The lane's own files pass Clippy with these lines excluded.
  These need fixing on the base branch, outside this lane.

## Mutation

Mutation runs with `mise run //package/git-policy/cli:native:mutation:scoped -- --file src/native/<file>.rs`
over the ten source files this lane added or changed:
`capture_invocation.rs`, `capture_order.rs`, `shadow_config.rs`, `shadow_links.rs`, `shadow_refs.rs`,
`conclusion_copy.rs`, `shadow_create.rs`, `commit_args.rs`, `commit_index.rs`, `commit_preparation.rs`.
`--list` counted 263 mutants.
The run was started as systemd user unit `cli-git-capture-mutation` with `MemoryMax=12G`,
through the slot limiter.
Result: blocked, zero mutants tested.
The first attempt used no `GIT_POLICY_NATIVE_IMAGE_TAG` and picked another lane's image, so it was stopped.
The second run (`systemd-run --user --unit=cli-git-capture-mutation3`, working directory set to this worktree,
`env GIT_POLICY_NATIVE_IMAGE_TAG=capture`) ran all nine planted controls, and each was noticed.
Its unmutated baseline then failed, so cargo-mutants tested no mutant (`cargo test failed in an unmutated tree`).
The baseline run timed out at 101 seconds against the script's 90-second `--timeout`,
and the test `index_lock_holders::tests::a_real_child_holding_the_lock_is_found_on_linux` failed in the same run.
That test belongs to another lane, and it waits ten seconds for a child's `/proc` descriptor,
so it is sensitive to host load. The host load average was 59 on 16 CPUs at the time.
The gate itself passed its library tests under the same image.

To rerun when the host is idle:
`systemd-run --user --unit=<name> --collect --property=MemoryMax=12G --working-directory=<worktree>`
`node <gate-slot> env GIT_POLICY_NATIVE_IMAGE_TAG=capture mise run //package/git-policy/cli:native:mutation:scoped -- --file src/native/<file>.rs ...`
with the ten files listed above. The mutation run has not produced any caught, missed, unviable or timed-out result yet.
