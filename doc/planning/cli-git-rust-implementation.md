# cli-git Rust implementation proposal

## Authority and scope

The user confirmed the scope in
[`cli-git-rust-rewrite.md`](cli-git-rust-rewrite.md)
and asked to see the implementation approach before code changes.
This document proposes that approach;
it does not authorize starting product changes.
The language choice is settled.
The expanded 2.x policy catalog is excluded.

## Shape

Build a Rust library and a thin `git` executable under the existing
`package/git-policy/cli` ownership.
Use internal modules rather than introducing a crate for every responsibility.
Keep the TypeScript executable available until the Rust replacement passes the consumer contracts.
Do not introduce a permanent TypeScript bridge,
a daemon,
or a general plugin runtime.

The executable remains a Git wrapper,
not a replacement Git implementation.
Keep native Git responsible for object storage,
refs,
hooks,
signing,
transport,
editors,
filters,
and sequencer behavior.
Preserve Git argument bytes and operating-system path representations;
do not reconstruct commands as shell strings or require every path to be UTF-8.
Port Git-specific token classification rather than handing all Git arguments to an unrelated option grammar.

## Module responsibilities

### Configuration

Read repository-root `cli-git.config.jsonc` through
`package/rust-module/jsonc-edit`.
Validate the document into typed settings for the compiled-in policy registry and existing concurrency controls.
Report unknown keys,
unknown policy IDs,
ambiguous duplicate settings,
and invalid values as configuration errors.

There are no imports,
callbacks,
plugin package names,
command arrays,
or executable-path overrides.
Repository settings can disable policies or change permitted severities without consent.
Do not add a personal policy floor or replace trust prompts with another approval mechanism.

Delete executable-config discovery,
bundling,
stored-code evaluation,
consent,
and trust-registry management.
Keep the command-classification fast path:
operations that need no policy configuration must not initialize the policy engines.
Keep transaction and worktree recovery even where their present implementation imports helpers from `trust/`.
Move retained helpers according to responsibility,
not their old directory name.

### Git operations and candidate content

Port real-Git resolution,
wrapper-self exclusion,
platform-specific executable lookup,
child environment,
signals,
and exit handling into Rust.
Do not call the TypeScript resolver from the Rust executable.
The TypeScript resolver used by other consumers needs corresponding native-wrapper recognition at cutover.

Expose immutable candidate versions and lazy,
batched Git facts internally.
Read committed or staged candidate bytes,
not whatever happens to be in the live worktree.
Reuse object reads and path metadata within one candidate version;
invalidate affected facts after a fix or replay.
Avoid a Git process per file or per historical blob.

### Built-in policies and scanner integration

Use a fixed typed registry of shipped policies with stable ordering,
validated options,
structured findings,
and bounded fixing passes.
Preserve `check`,
`fix`,
manual-push checks,
JSONL events,
stream routing,
and exit-code semantics.

Initial coverage is the existing required behavior:

- root,
  linked-worktree,
  branch-worktree,
  explicit-add,
  and final-newline policies;
- fixed atomic-push,
  commit-only,
  and status-hint transforms;
- forbidden-strings;
- forbidden-root-context and dependent-version propagation;
- current commit-time Markdown normalization.

Link the existing forbidden-strings Rust library into cli-git.
Add a library interface that accepts candidate identity,
logical pathname,
and exact bytes,
and returns structured redacted findings.
Route the standalone scanner CLI through the same core;
do not fork the rule engine or change its exit contract.

Preserve pathname scanning,
content scanning,
rule identities,
redaction,
file-selection semantics,
fail-closed errors,
and the engine-panic guard.
Load the rules once per invocation when scanning is enabled,
and reuse them across candidates and valid repeated policy passes.
Retain the existing validated runtime-rule cache and built-in precompiled rules.
A replay that changes a declared input invalidates the corresponding policy result.

This removes the current scanner integration's temporary content files,
scanner child process,
and parsing of rendered stderr.
It is a concrete execution-path change,
not a quantified speedup claim.

### Markdown integration and ownership

Port only the required commit-time rule behavior,
not the whole Markdown linter or expanded catalog.
The accepted
[`unified-linter.md`](../handover/unified-linter.md)
plan already owns the standalone Rust Markdown replacement;
coordinate the reusable implementation with that owner instead of creating a second Markdown engine.
That implementation is planned,
not an already available dependency.

The native-parser audit and current offset troubleshooting are starting evidence,
not permission to copy stale byte/UTF-16 conversion code.
Preserve the selected LFS-image rule's findings and localized edits,
including astral Unicode and BOM fixtures.
Keep malformed-input behavior bounded.
If hard parser interruption requires process isolation,
use a fixed shipped worker over a batch,
not a repository-selected program or one Node process per file.
The parser audit records malformed-MDX hangs;
do not place unbounded parsing inside a commit's critical section.

### Commit transactions and recovery

Port the transaction state machine and durable protocol explicitly.
Typed states represent capture,
private preparation,
policy convergence,
landing,
replay,
and post-landing completion.

Preserve:

- private indexes and shadow repositories;
- hook,
  editor,
  signing,
  and branch identity behavior;
- compare-and-swap landing,
  replay,
  policy read sets,
  capture ordering,
  and starvation reservations;
- protection of pending objects and post-landing automatic maintenance;
- real index and worktree isolation;
- process-birth-aware locks,
  foreign-lock evidence,
  and cancellation;
- durable recovery after interruption;
- current auto-push completion and failure reporting.

Keep the existing journal and lock formats where practical during the first release,
with cross-version fixture verification.
Do not silently discard old transaction state or invent fresh empty state when recovery is required.
Do not intentionally switch wrapper versions during a live transaction.
If a state cannot be read safely,
fail with an actionable recovery diagnostic rather than guessing or deleting it.

Retain capability probes and degradation paths for older Git versions.
Do not replace feature probing with an assumed minimum version.

### Linked-worktree state

Port worktree-copy as its own lifecycle module,
including ignored-state selection,
copy-on-write requests,
exact existing-entry checks,
journals,
containment validation,
and crash recovery.
Preserve the main-worktree bypass and the distinction between worktree settlement locks and commit landing locks.
The trust subsystem's removal does not remove these locks or journals.

## Implementation sequence and verification

1.  Freeze a behavior ledger from `package/git-policy/cli/SPEC.md` and the accepted platform and concurrency decisions.
    Mark executable-config and plugin-authoring behavior as intentionally retired.
    Every retained responsibility receives a Rust owner and a consumer-level test.
2.  Add the Rust crate,
    direct executable entry,
    JSONC loader,
    Git resolver/forwarding,
    diagnostics,
    and package-scoped build/lint/test tasks.
    Verify exact forwarding and self-recursion prevention before mutating Git operations.
3.  Expose and test the scanner's structured library interface.
    Add the shipped policy registry and the existing policy implementations.
    Verify planted findings,
    clean controls,
    candidate-byte isolation,
    redaction,
    fixing convergence,
    and direct `check`/`fix`.
4.  Port transaction,
    locking,
    hook dispatch,
    replay,
    worktree-copy,
    recovery,
    and push behavior.
    Exercise crash points and concurrent actors,
    not only successful sequential commits.
5.  Run the existing end-to-end scenarios against the Rust executable,
    adapting the driver rather than reproducing its logic in a new harness.
    Use equivalent disposable repositories for semantic comparisons with the incumbent and native Git.
    This verifies behavior,
    not whether to rewrite.
6.  Package and verify the installed native executable,
    then perform the coordinated cutover.
    Delete the retired TypeScript implementation and authoring surface only after their consumers have moved.

The existing concurrent end-to-end environment includes Git 2.39.5,
2.40.0,
and 2.55.0.
Keep its degradation scenarios and the existing Linux,
macOS,
and Windows consumer coverage.
Tests cover argument syntax,
non-UTF-8 and adversarial names,
partial staging,
policy failures,
hooks,
signed commits,
amend/sequencer conclusions,
concurrent races,
interruption,
recovery,
and worktree state.
Do not blindly preserve an incumbent bug merely because differential output matches it;
the accepted behavior and named regressions are the oracle.

Measure the release Rust artifact at the real command interface as an acceptance check.
Verify benchmark reach with positive controls,
report local processing separately from remote push latency,
and never substitute earlier shell return for completing required work.
Do not restart the canceled incumbent profiling campaign.

## Cutover

Build and verify the native artifact before changing command resolution.
Use an explicit native path in disposable tests until the shadowing install is verified.
The installed `git` launcher resolves directly to the native executable,
not to a Node process that starts it.
Keep standalone forbidden-strings available for its other consumers.

Update together:

- root cli-git configuration;
- package tasks and installed-bin wiring;
- real-Git resolver self-exclusion,
  including its surviving TypeScript consumers;
- file-enforcer-owned scanner/build integration where the ownership changes;
- CI,
  README,
  and the surviving management-command documentation.

Legacy `.ts` or `.mjs` configuration gets an explicit migration diagnostic,
not execution or silent ignoring.
Translate this repository's inspected config directly;
do not build a general program-to-JSONC converter.
Retired trust commands explain that JSONC no longer requires code-execution approval.
Old trust records remain inert rather than being deleted automatically.
Keep the previous executable available for rollback until native installation and recovery checks pass.
