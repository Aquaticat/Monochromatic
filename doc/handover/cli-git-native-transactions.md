# cli-git native commit transactions

## Purpose and how to respond

This branch ports the commit path of the incumbent TypeScript Git policy wrapper
(`package/git-policy/cli`, outside `src/native`) into the native Rust wrapper under `src/native/`:
owner locks with process-birth identity,
the transaction registry and journal,
recovery,
the real index lock and foreign-lock evidence,
index-writer coordination,
hook dispatch and the hook lock,
capture,
the shadow repository,
private preparation and policy convergence,
the landing critical section,
replay with subsumption and capture order,
the starvation reservation,
post-landing completion,
the post-commit lifecycle,
auto-push,
signal handling,
and the linked-worktree ignored-state copy.

Branch `feat/cli-git-native-transactions`,
worktree `.claude/worktrees/cli-git-transactions`,
created from `main` at `5ae6619c8`.
Paths starting with `src/`,
`bin/`,
`e2e/`
or `SPEC.md` are relative to `package/git-policy/cli/`;
every other path is repository-relative.

The behavior to reproduce is in `doc/planning/cli-git-rust-behavior-ledger.md`
(sections `Commit transactions`, `Locks`, `Durable formats`, `Linked-worktree ignored-state copy`, `Auto-push`)
and in `SPEC.md` section `Transaction protocol`.
The settled decisions are in `doc/handover/cli-git-rust-implementation.md`,
section `User decisions 2026-10-05`.

Work is recorded slice by slice as it lands,
so an interruption loses little.
Respond by merging the branch into `main`
and by vetoing any item under `Choices open to veto`.

## Status

Slices 0 to 2 are done, apart from the slice 2 fuzz smoke campaign;
slice 3 is next.
A real commit is still refused.

## Slice plan

Each slice ends with its tests,
the container gate
(`GIT_POLICY_NATIVE_IMAGE_TAG=transactions mise run //package/git-policy/cli:native:test:container`),
a commit,
and a progress entry under `Progress`.
The order follows dependencies:
what both wrapper versions must agree on comes first,
recovery comes before landing because every landing-lock acquisition first recovers dead landings,
and the phase markers land with the landing slice so its crash tests can run.

A real commit stays refused (`Unported::CommitTransaction`) until slice 9 passes.
Leftover-state refusal shrinks in two steps:
after slice 2 dead transactions are recovered and only live ones still refuse a guarded command;
after slice 3 a guarded command waits on the landing lock like the incumbent and live transactions stop refusing it.

### Slice 0, interoperability image and harness

The gate image has Git 2.56.0 and no Node;
the host has Node and Git 2.55.0,
and the native wrapper's version check refuses commits below 2.56.0.
Every incumbent-facing proof therefore runs in one more image:
the gate's Git 2.56.0 base,
the Node executable copied from `docker.io/library/node:24-trixie-slim` (same Debian release),
the packed incumbent installed at build time,
and the native executable built from the branch.
A `mise` task in `package/git-policy/cli/mise.toml` builds it and runs a named driver inside it,
bounded with `--memory=2g --cpus=2 --init --network=none`.

Acceptance:
inside the image,
`node` runs,
`/usr/bin/git --version` is 2.56.0,
the incumbent commits once in a disposable repository,
and the native executable answers `--version` through `PATH`.

### Slice 1, durable formats, process identity and owner locks

Modules:
private file input and output (exclusive no-follow creation, mode `0600` files, `0700` directories,
file and directory sync, no-follow reads that refuse links and non-regular files);
JSON record reading and writing in the incumbent's field order;
random tokens and UUIDs;
process-birth identity (`linux:` field 22 of `/proc/<pid>/stat` with states `Z` and `X` as exited;
`darwin:` the output of `ps -o lstart= -p <pid>` under `LC_ALL=C`; `win32:` the start time as .NET ticks);
the owner-lock record (schema version 1);
owner-lock acquisition by rename-published directory with dead-owner retirement, release by rename-then-delete,
and the 20 ms unbounded wait.

Acceptance tests:

- Unit:
  record parsing accepts every incumbent-written record and rejects truncated, oversized, wrong-schema,
  mistyped and empty-field records;
  writing reproduces the incumbent's bytes for the same field values;
  the Linux identity parser handles command names holding spaces and `)`;
  the Windows tick conversion and the macOS command line are reproduced from the incumbent's formatting code.
- Process:
  a held lock blocks a second acquirer until release;
  a lock whose owner died, a lock owned by an unreaped zombie and a lock whose PID names a younger process are retired;
  a release whose lock changed owner fails.
- Interoperability, in the slice 0 image:
  the incumbent's `resolveProcessBirthIdentity` and the native identity agree byte for byte for live PIDs;
  a lock taken by the incumbent blocks the native acquirer and the reverse;
  each retires the other's dead lock.
- Fuzz:
  a target over the owner-lock record parser and the `/proc/<pid>/stat` parser.

### Slice 2, registry, journal, leases and recovery

Modules:
the transaction owner record (schema version 2);
the registry (staging names, publication by rename, retirement by rename);
every journal record of schema version 2 and its strict parser;
the preparation, landing and worktree-copy lease formats;
the capture store records needed by recovery (landed-capture records and pruning);
startup recovery:
live owners skipped,
dead owners without a landing record discarded with their `.keep` files, reservation and shadow repository,
dead owners with a landing record recovered under the landing lock
(unlanded attempt discarded, interrupted index install completed from the recorded post-index,
completed install recognized, reflog nonce evidence before `ref-updated.json`,
`index.lock` removed only by recorded device and inode, conclusion cleanup and added-path completions),
malformed state failing closed with the path named,
a dead reservation retired,
the legacy `cli-git-transaction` directory stopping with instructions to run the previous executable once.
Recovery runs at startup before configuration loading,
also before read-only commands that already ran the location query,
and costs one directory read and no Git process on an empty registry.

Acceptance tests:

- Unit:
  every journal record kind round-trips;
  the parser fails closed on truncated, oversized, wrong-schema and mistyped records and leaves their bytes in place.
- Interoperability, in the slice 0 image:
  the incumbent is killed with `CLI_GIT_TEST_ONLY_PHASE_SIGNAL` at each of `capture-locked`, `preparation-done`,
  `landing-locked`, `objects-migrated`, `ref-updated` and `index-installed`;
  the native wrapper then runs `git status`;
  afterwards the commit either landed whole or not at all,
  the real index matches,
  and no shadow repository, transaction directory, lock, `.keep` or landed-capture record remains.
- Binary:
  a published directory without a valid owner record exits 2, names the path and keeps its contents;
  the read-only fast path still starts at most the location query
  (`policy::read_only_commands_start_at_most_the_location_query`).
- Fuzz:
  a target over every journal record parser.

### Slice 3, real index lock, foreign-lock evidence and index-writer coordination

Modules:
the Git version check (2.56.0 or newer, once before work that needs it);
lock PID file reading in Git's `core.lockfilePid` format;
foreign `index.lock` evidence (device, inode, ctime; PID file with start-time comparison;
open holders by device and inode through `/proc/<pid>/fd`);
the classification and the wait (unbounded for a proven owner with one stderr line,
quadratic backoff with jitter up to `indexLock.unprovenOwnerTimeoutMs` otherwise,
then `index-lock-unproven-owner` with exit 2);
the real index lock with its journaled identity;
the landing lock with recovery before every acquisition;
index-writer classification and coordination with `CLI_GIT_LANDING_LEASE`, waiting for Git as a child;
the direct fix holding the landing lock.

Acceptance tests:

- Process:
  a native `git commit` waiting in its editor holds `index.lock` and the wrapper waits without limit, naming it;
  a PID file naming an exited process and a lock without a PID file end with `index-lock-unproven-owner`
  after the budget,
  the lock left in place.
- Binary:
  `git add` waits while the landing lock is held and then succeeds;
  `git rebase --exec 'git add -- b.txt'` through the wrapper does not deadlock;
  live transactions no longer refuse `git add`.
- Interoperability:
  a landing lock held by the incumbent makes a native `git add` wait, and the reverse.
- Fuzz:
  a target over the lock PID file parser and the `/proc/<pid>/stat` start-time reader.

### Slice 4, hook dispatch and the hook lock

Modules:
the dispatch plan (`plan.json`: hooks path, user-disabled events, caller config parameters in Git's `sq_quote` form,
real Git, worktree root, preparation lease, hook lock, lock skip);
hook entries as symbolic links named after the hook on Unix and `<hook>.exe` hard links or copies on Windows;
the dispatcher entered by the start name inside a transaction's `hooks` directory beside a `plan.json`,
recognized nowhere else;
the hook lock at `<git-common-dir>/cli-git/hook.lock`;
the preparation lease and its validation by nested invocations.
The executable passes its start name to the library;
`main.rs` no longer discards it.

Acceptance tests:

- Probe first:
  Git 2.56.0 starts a `core.hooksPath` hook that is a symbolic link with the link's path as its start name.
- Binary:
  a hookdir hook and a `hook.<name>.command` hook each run once;
  a hook in a subdirectory sees the right top level and an absolute `GIT_WORK_TREE`;
  a failing hook propagates its status;
  two dispatches serialize by default and overlap with `hooks.concurrentCommits: true`;
  the same executable started under a hook name outside a transaction's `hooks` directory behaves as `git`.
- Interoperability:
  the hook lock taken by the incumbent's dispatcher blocks the native dispatcher and the reverse;
  the incumbent nested in a native dispatcher accepts the preparation lease and the reverse.

### Slice 5, capture, shadow repository and private preparation

Modules:
invocation capture (symbolic `HEAD`, compare-and-swap target, conclusion kind, root, directories, real index,
ref format, nonce, base after the next capture sequence);
the capture store and lock, `captured.json`, sequence allocation;
the shadow repository (alternates, `packed-refs` or reftable snapshot, generated `config`, links and copies,
conclusion state);
private indexes and selection modes (explicit-path, index, include, interactive and patch,
pathspec files including stdin and NUL forms, timestamp-preserving copies);
native preparation (`git commit` in the shadow with the dispatcher, `prepared.json`).

Acceptance tests:

- Binary, landing still refused:
  preparation leaves real refs, index and worktree bytes unchanged;
  the shadow `HEAD`, `@{upstream}`,
  an `includeIf "onbranch:"` value and `git rev-parse --git-dir` seen by a hook match the incumbent;
  a failing `commit-msg` hook propagates Git's exit code and leaves no shadow repository.
- Differential:
  the private index of each selection mode equals the incumbent's for the same invocation.

### Slice 6, preparation policy convergence

Modules:
policies over the private index through the existing engine and candidate layer;
patch application with `git apply --cached --3way` and the bounded convergence loop;
added paths and their admission rule;
hook-staged changes;
`commit-normalization/no-change`;
the convergence snapshots.

Acceptance tests:

- Binary:
  a `final-newline` correction lands in the prepared tree;
  a `pre-commit` hook that reformats and re-stages a selected file is kept;
  an added path that fails the admission rule ends in `patch-conflict`.
- Differential:
  JSONL events of each case equal the incumbent's.

### Slice 7, landing, object migration, real index at landing, post-landing and phase markers

Modules:
the phase markers (`CLI_GIT_TEST_ONLY_PHASE_SIGNAL`, in the release executable);
the landing loop without replay:
reservation check, landing lock, real `index.lock`, branch-switch and head-moved checks,
object migration into a kept pack, the post-index against the then-current real index, `landing-<n>.json`,
compare-and-swap with the nonce reflog message, `ref-updated.json`, `.keep` removal, owner-preserving install,
`index-installed`, conclusion cleanup;
post-landing completion:
added-path worktree copies, shadow and transaction removal, automatic maintenance, `post-commit` under the hook lock,
capture-record pruning.

Acceptance tests:

- Crash, against the native executable:
  a kill at every phase marker and at each hook point,
  followed by `git status` under the native wrapper and under the incumbent,
  leaves the repository as `Recovery` in the ledger states.
- Binary:
  the reflog nonce appears once in the branch and `HEAD` reflogs;
  a branch switch between preparation and landing gives `concurrent-commit/branch-switched` with exit 1;
  a staged path of a second process survives the landing.

### Slice 8, replay, subsumption, capture order, revalidation and the reservation

Modules:
replay with `git merge-tree --write-tree --merge-base`, raw-object rewriting, signed rebuild with `commit-tree -S`;
shared-path listing, subsumption (strict reverse application, one-sided extension, binary detection),
the synthetic merge base;
capture order over the first-parent history and landed-capture records;
revalidation (replayed index, shadow `HEAD` move, policy re-run, `pre-commit` re-run);
the starvation reservation.

Acceptance tests:

- Unit:
  the cases of `SPEC.md` lines 3716 to 3727;
  the strict reverse check agrees with `git apply --reverse --check` on seeded inputs.
- Binary:
  non-overlapping hunks replay with `landing-race-lost` and `commit-replayed`;
  overlapping hunks fail with `concurrent-commit/replay-conflict`, exit 1,
  and a prepared commit `git cherry-pick` accepts;
  a reservation is granted after the configured lost races.

### Slice 9, commit path enabled: post-commit lifecycle and auto-push

Modules:
the transaction boundary that turns the commit refusal into the transaction;
the post-commit policy lifecycle over the landed delta;
auto-push with branch keys, last-pushed records, single flight and joins, and failure reporting.

Acceptance tests:

- The refusal frontier test for commits is replaced by transaction tests;
  the planted control "commit refusal frontier" is retargeted.
- End to end in the slice 0 image:
  the incumbent's `e2e/` scenarios driven against the native executable,
  including every `sigkill-phase-*` scenario.
- Concurrency in the slice 0 image:
  several commits racing in one disposable repository with the native wrapper,
  with the incumbent,
  and with both mixed;
  every commit lands once or fails with a stated finding,
  none is lost or interleaved.
- Differential:
  exit status, JSONL events, resulting commit, index and worktree against the incumbent for ordinary commits.
- Timing:
  native and incumbent wall time of a one-file commit, after the run-to-run spread on unchanged input.

### Slice 10, signals

Catch `SIGINT`, `SIGTERM`, `SIGHUP` and `SIGQUIT` while waiting for Git;
relay to Git only when the sender was a process, not the terminal;
wait for Git, release locks, remove the transaction;
exit 128 plus the signal number when Git was ended by a signal.
This needs `sigaction` with signal details, which the standard library lacks;
`libc` is already in the wrapper's lockfile.

Acceptance tests:
`kill -TERM <wrapper>` during a held `pre-commit` ends Git, leaves no transaction and exits 143;
a signal from the terminal is not relayed twice.

### Slice 11, linked-worktree ignored-state copy

Applicability and bypass,
created-worktree detection,
ignored-state selection,
copy-on-write staging,
installation with exact existing-entry checks and rollback,
journals and the install log,
the settlement lock,
crash recovery,
and the summary line.

Acceptance tests:
the ledger's consumer tests for each entry of `Linked-worktree ignored-state copy`,
and journals written by the incumbent recovered by the native wrapper and the reverse.

### Closing gates

Mutation over every added or changed file with 0 missed and 0 timeouts,
fuzz smoke runs with planted-defect controls,
and the final gate,
each recorded under its own section.

## Progress

### Slice 0

Commit `bb08b1cf7` (the harness) after the plan in `8a30e90c0`.
`bin/interop-native-container.mjs` builds `localhost/git-policy-native-interop:<tag>`
from the gate's Git 2.56.0 base image,
copies `/usr/local/bin/node` from `docker.io/library/node:24-trixie-slim` (Node 24.21.0),
copies `/opt/cli-git` (the packed incumbent and its installed dependencies)
from `localhost/cli-git-concurrent-e2e:latest`,
replaces its `dist/final/node/index.mjs` with the main checkout's build
(SHA-256 `a418ca48f202850cbda6943efe8eaaad02488c16aad5d9e7321ea10af22894cd`,
the bytes the installed `git` runs),
and builds the native executable and the library's release test binary from the snapshot.
The native executable is `git` only through `/opt/native/bin` inside the image.
Drivers are `.mjs` files under `native-interop/`,
run as `mise run //package/git-policy/cli:native:interop -- <driver>`,
under `--rm --init --network=none --memory=2g --cpus=2`.

The smoke driver passed:
real Git is 2.56.0,
Node is 24.21.0,
the incumbent landed a commit,
and the native wrapper forwarded `--version`.

### Slice 1

Commits `9e5337ce3` and `133ca67b2` (a Clippy fix).
Modules:
`private_storage.rs`,
`json_record.rs`,
`random_id.rs`,
`js_text.rs`,
`process_identity.rs`,
`owner_lock_record.rs`,
`owner_lock.rs`.

Gate:
every test passed (637 unit tests, 39 binary-level tests, the candidate consumer),
then Clippy failed on `manual_range_contains` in `json_record.rs`;
the fix is committed and the next gate covers it.

Interoperability (`native-interop/owner-locks.mjs`, evidence `target/verification/interop-c2oSt5`).
The first run ended during the image build (step 14 of 21) with exit 1 and no diagnostic in its log;
the rerun on the same snapshot passed:

- An incumbent paused at `capture-locked` holds its capture lock;
  the native identity of its PID is `linux:4248886`,
  the string the incumbent wrote into both the lock record and the transaction owner record.
- The native acquirer found that live lock busy and left it untouched;
  the released incumbent commit landed.
- An incumbent killed at `landing-locked` left its landing lock;
  the native acquirer retired it and took the lock.
- A native probe holding the hook lock made the incumbent's hook dispatcher wait;
  after the release the incumbent ran its hook once and landed.
- A native probe killed while holding the hook lock left a record with its PID and a `linux:` identity;
  the incumbent retired it and landed.

Measured facts recorded for later slices:

- The Bash tool's processes share one 8 GB cgroup (`claude-code-bash`) with other sessions' commands;
  a host `cargo check` of this crate died there with no diagnostic at the default parallelism
  and passed with `CARGO_BUILD_JOBS=4`.
- The incumbent prints warnings as `[warn] [<ISO time>] [cli-git] <message>`.

### Slice 2

Commits `359807798`, `06d92ef04`, `f51a46758`, `d74fa16e2` and `e0435222c`.
Modules:
`transaction_owner.rs`,
`transaction_registry.rs`,
`transaction_journal.rs` with `_encode` and `_parse`,
`transaction_lease.rs`,
`iso_time.rs`,
`filesystem_identity.rs`,
`transaction_git.rs`,
`recovery_files.rs`,
`recovery_evidence.rs`,
`recovery_reflog.rs`,
`recovery_completion.rs`,
`pack_keep.rs`,
`shadow_git.rs`,
`conclusion_cleanup.rs`,
`capture_store.rs`,
`capture_records.rs`,
`blob_batch.rs`,
`worktree_completion.rs`,
`recovery_inspect.rs`,
`recovery_landing.rs`,
`recovery_scan.rs`,
`commit_recovery.rs`,
`transaction_gate.rs`.
`diagnostic_log.rs` now writes the incumbent's line format,
`[<level>] [<ISO time>] [cli-git] [<tag>] <message>`.

Behavior now:
every guarded, read-only and direct command that reads the repository location
recovers dead transactions first, oldest first,
taking the landing lock for dead landings.
A live transaction still refuses guarded and direct commands
(`Unported::TransactionRecovery`),
because index writers do not coordinate with landings before slice 3;
read-only commands go on beside it.
A malformed registry stops any of them with exit 2 and a `content-unavailable` event naming the path,
and keeps the files.
The legacy `cli-git-transaction` directory stops with the owner's message.
`pending_state.rs` keeps only interrupted worktree copies.
An empty registry costs one directory read and no Git process;
the read-only fast-path test
(`policy::read_only_commands_start_at_most_the_location_query`) still passes.

Gate at `d74fa16e2`:
755 unit tests passed and 2 ignored,
39 binary-level tests,
the candidate consumer,
Clippy clean, exit 0.
On the host (Git 2.55.0) the same suite has 10 unit and 4 binary-level failures,
all comparisons with Git 2.56.0 output.
`d74fa16e2` added two methods to `RepositoryFacts`;
the fuzz sidecar's `FixedFacts` lacked them until `e0435222c`,
so the sidecar does not build at `d74fa16e2`.

Interoperability (`native-interop/phase-recovery.mjs`, evidence `target/verification/interop-zGaVqG`):
the incumbent committed `a.txt` and killed itself at each of
`capture-locked`, `preparation-done`, `landing-locked`, `objects-migrated`, `ref-updated` and `index-installed`;
the native `git status` then exited 0 each time.
Afterwards the commit had not landed for the first four phases and had landed whole for the last two,
the real index equaled `HEAD`,
the worktree kept the edit,
and no transaction directory, shadow repository, `index.lock`, `.keep` or landed-capture record was left;
the incumbent then landed a follow-up commit in the same repository.
For `ref-updated` the native recovery installed the recorded post-index
(the dead incumbent had not).

Fuzz (`package/git-policy/cli.fuzz`):
targets `owner_records` and `transaction_records`,
with generator controls (26 sidecar controls pass on the host)
and five planted defects.
The planted-defect run and the 30-second smoke campaign are recorded once they finish.

## Dependencies

Added to `package/git-policy/cli/Cargo.toml`, all already in the lockfile:

- `serde_json`, already linked through the forbidden-strings scanner:
  JSON records with `JSON.parse` semantics (last duplicate key wins, numbers as doubles)
  and `JSON.stringify` string escaping.
- `getrandom`, already linked through `tempfile`:
  random bytes for `randomUUID`-shaped tokens and transaction IDs.
- `libc` (Unix only), already in the lockfile:
  `kill(pid, 0)`, `O_NOFOLLOW`, `O_NONBLOCK`, error numbers, and later `sigaction`.

`mise run //package/git-policy/cli:native:lock:scanner` added exactly these three edges to
`package/git-policy/cli/Cargo.lock`;
`mise run //package/git-policy/cli.fuzz:lock:subject` added the same three to the sidecar's lockfile.
file-enforcer left both manifests as edited;
the `mise.toml` and `package/config/pnpr/config.yaml` it rewrote were unrelated drift of this
environment and were discarded.

## Choices open to veto

### Windows ownership and identity

Windows birth identities use the incumbent's PowerShell command unchanged,
and private files and directories get no Windows ACLs
(the incumbent applies them through PowerShell in `src/trust/registry-io.ts`).
Neither was run on Windows here.
The Windows filesystem identity keeps the PowerShell volume serial
but not the incumbent's fallback to Node's device number,
which the Rust standard library exposes only through an unstable interface;
without the serial no identity is recorded and the landing that needs one stops.

### Recovery failures and the exit code

Every recovery failure is a `content-unavailable` engine failure with exit 2.
The incumbent reports its own recovery errors that way
but lets an operating-system error or a `TypeError` escape as a plain message with exit 1.
A malformed owner record of a published directory names the directory,
where the incumbent's message names none.

### Stricter reads than the incumbent

- Attempt numbers in `landing-<n>.json` and `index-lock-<n>.json` must be ASCII digits;
  the incumbent reads them with `Number`, which also accepts a sign, whitespace, exponents and `0x`.
  Neither wrapper writes those spellings.
- Owner records and recovery files are read without following a link and only up to a size limit
  (64 KiB for owner lock records, 2 GiB for recovery files, 256 MiB for capture-store files);
  the incumbent follows a link for owner lock records and reads any size.

### Recovery visits a directory once

When one dead landing takes the landing lock,
every dead transaction that entered the landing critical section is recovered under it,
and the later pass no longer visits those directories.
The incumbent visits them a second time and fails reading the removed directory.

### Git input through a file

Bytes for a Git child's standard input are written to a private, already unlinked file
in the temporary directory instead of a pipe,
so a child that writes before reading all its input cannot deadlock against this process.

### Recovery's Git commands replay the global options

Recovery runs Git with the invocation's global options (`-C`, `--git-dir`, `-c`),
as the native location query does.
The incumbent runs them in the effective directory without those options.
The two differ only for invocations that select a repository with `--git-dir` or `--work-tree`.

### Numbers serde_json reads differently

`serde_json` without its `float_roundtrip` feature reads `9007199254740991.0` as 9007199254740990;
`JSON.parse` reads 9007199254740991.
Neither wrapper writes fractional spellings of integers.
