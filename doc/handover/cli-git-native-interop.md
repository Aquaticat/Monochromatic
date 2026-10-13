# cli-git native interoperability matrix

Evidence for the trailing gate "old-and-new wrapper interop matrix" of
`doc/handover/cli-git-rust-implementation.md`.
Paths starting with `src/`, `bin/` or `native-interop/` are relative to `package/git-policy/cli/`;
every other path is repository-relative.

Terms:
the incumbent is the retired TypeScript wrapper, built from the pinned last revision
`f4fc1fa213ece65672e4314983a75266837892f9`;
native is the release `cli-git-native` (crate version 0.1.2) built from this branch's checkout.

## Decision and end state

The user decided that the matrix runs once, its results are recorded here, and everything that can build or run the
incumbent is then deleted, so that the old wrapper cannot be found or used.
The branch therefore ends in this order:
the provisioning step and the drivers (the evidence), this document (the results),
and then one commit per deletion.

What stays after the deletions:

- `native-interop/old-format-fixtures.mjs` and `native-interop/fixture/`:
  records the incumbent wrote, kept as plain files, which the native wrapper must read.
- `bin/interop-native-container.mjs` and `mise run //package/git-policy/cli:native:interop`,
  reduced to an image with real Git 2.56.0, Node and the release native wrapper.

What is deleted and where it can be read:
the incumbent builder `bin/provision-incumbent.mjs`, the incumbent steps of the image runner, and every driver that
starts the incumbent (`smoke`, `owner-locks`, `phase-recovery`, `hook-dispatch`, `capture-differential`,
`crash-matrix`, `lock-waits`, `mixed-concurrency`, `capture-fixtures`).
All of them exist at commit `89f7e54313`, the last commit before this document.
Rerunning anything below starts from that commit (see `Rerun commands`).

## Incumbent provisioning

`bin/provision-incumbent.mjs` rebuilt the incumbent on demand, the way it was built before the retirement:

1. `git worktree add --detach` of the pinned revision under `${HOME}/temp/agent`.
2. `pnpm install --frozen-lockfile --prefer-offline --filter '@monochromatic-dev/git-policy-cli...'`.
3. The pinned revision's own `pack:npm` task (the rolldown bundle `dist/final/node/index.mjs`, then `pnpm pack`).
4. `npm install --ignore-scripts` of that tarball into a staging directory, the layout the end-to-end image once
   carried as `/opt/cli-git`.
5. The worktree is removed with its administrative entry, whether provisioning passed or failed.

The image runner copied the staging directory to `/opt/cli-git`.
The provisioned incumbent for this run:
tarball SHA-256 `425b7c1f2771dafb7f5bf41e9be40c3efb12ce39c04b6ad9884ce1e7e1c03e49`,
`dist/final/node/index.mjs` SHA-256 `60d98632f603ef811aa613803b189fc3aba37e0207e7cefd1494cf91fb05cb3e`,
built with Node 26.11.1, pnpm 12.11.2 and npm 11.20.0 on the host and run under Node 24.21.0 in the image.
No TypeScript entered the repository; the build output sat under the ignored `target/verification/`.

## Environment

Image `localhost/git-policy-native-interop:interop`: the gate's Git 2.56.0 base, Node 24.21.0,
`/opt/cli-git/node_modules/.bin/git` (the incumbent), `/opt/native/bin/git` (the release native wrapper),
run as user 1000 with `--rm --init --network=none --memory=2g --cpus=2`.
Each driver started both wrappers through `PATH` order inside disposable repositories under `/work/scratch`.
The container gate of the native changes (image `fb852ab7c300`) passed:
1663 unit tests (5 ignored), 118 binary-level tests (1 ignored), the candidate consumer, and Clippy.

## Results per combination

Counts are checks that passed and failed in the final run.
A driver prints one `ok:` or `FAIL:` line per check and keeps going after a failure, so no combination hides another.

Crash recovery across wrappers (`crash-matrix.mjs`, 580 passed, 0 failed):
the writer commits and kills itself at each of `capture-locked`, `preparation-done`, `landing-locked`,
`objects-migrated`, `ref-updated` and `index-installed`;
the reader then recovers through a read-only command in one repository and through a commit of its own in another.
All four writer and reader pairings pass:
incumbent to native, native to incumbent, and the two same-wrapper controls.
After each recovery the dead commit landed whole (from `ref-updated` on) or not at all,
the real index matched `HEAD`, the worktree kept the edit, `git fsck` was clean, and no transaction directory,
shadow repository, `index.lock`, `.keep` or landed-capture record remained.
Both wrappers then landed follow-up commits, and no stale lock directory remained after them.
A lock directory of a dead holder stays after a command that takes no lock (`status`, an `add` that needs no landing)
in both wrappers alike; the next lock-taking command retires it, so the driver allows it only for such commands.

Lock waits with real commits on both sides (`lock-waits.mjs`, 84 passed, 0 failed):
a holder paused at `capture-locked` or `landing-locked` makes a commit, and for `landing-locked` an `add`, of the other
wrapper wait for the whole blocked window and then finish after the release, with both commits on the branch and the
staged path installed.
A dead holder killed at either phase does not block an `add` of the other wrapper.
All four pairings pass.

Incumbent holds, native recovers (`phase-recovery.mjs`, 80 checks, passed) and the lock and identity probes
(`owner-locks.mjs`, 15 checks, passed): the incumbent's capture lock identity equals the native identity byte for byte,
the native acquirer finds a live incumbent lock busy and retires a dead one,
and the incumbent's dispatcher waits for and retires a native hook lock.

Hook dispatch and the hook lock (`hook-dispatch.mjs`, 13 checks, passed):
each wrapper's dispatcher blocks the other's until release, hook runs serialize in order,
the incumbent nested in a native dispatcher and the reverse accept the preparation lease,
and a tampered lease is refused in both directions.

Old-format fixtures (`old-format-fixtures.mjs`, 41 passed, 0 failed, native only, see `Old-format fixtures`).

Mixed concurrency (`mixed-concurrency.mjs`, seeds 1 to 3):
three scenarios per seed, with the wrappers assigned to workers in a seeded order.

- `disjoint` (ten workers: eight committing their own file twice, two running `add` and `status`):
  passed for every seed and every wrapper assignment.
- `hooked` (six workers through a shared `pre-commit` hook): hook runs never overlapped, in any seed.
  Replays after a lost landing race run the hook again, so there are more hook runs than commits.
- `killed` (six workers, one killed at a seeded phase): fails in the mixed assignment, see the first open finding.

Totals with the same seeds:
mixed 187 passed and 2 failed in the last run (the failures vary from run to run),
native only 189 passed and 0 failed, incumbent only 189 passed and 0 failed.

Repeated `killed` runs with the victim killed at `landing-locked` (seed 2, 60 repetitions each):
native only 1037 passed and 0 failed;
incumbent only 1037 passed and 0 failed;
mixed 998 passed and 39 failed, with a survivor failing in 19 of the 60 repetitions
(19 incumbent survivor exits and 1 native survivor exit).
A second batch of 40 mixed repetitions with debug output on had a survivor fail in 22, and a native survivor exited 2
in 3 of those.
Seeds 4 to 25 for the `killed` scenario: mixed 374 passed and 0 failed, native only (seeds 4 to 20) 289 and 0,
incumbent only 369 passed and 5 failed (two incumbent exceptions, listed under the incumbent-only findings).

Not run: `capture-differential.mjs` after the retirement (it prints the incumbent's trees for comparison with
native unit tests that already hold those trees), Git 2.55.0, macOS and Windows,
and any run longer than the repetitions above.

## Defects in the native wrapper, fixed

Both were found by the `killed` scenario of `mixed-concurrency.mjs` (seed 2) and fixed with controls written first.
Each control failed before its fix and passes after it.

- Retiring a transaction directory failed when another recoverer had already retired it:
  a native survivor exited 2 with `retiring the transaction directory ... No such file or directory`.
  `remove_transaction_directory` in `src/native/transaction_registry.rs` now treats a missing directory as retired.
  Control: `removing_a_directory_a_peer_already_retired_succeeds`.
  The earlier assertion that a missing registry directory cannot be retired was removed because it encoded the defect.
  Commit `fa671c2bd3`.
- Releasing an index lock failed when another recoverer released it between the existence probe and the identity lookup:
  a native survivor exited 2 with `the landing reservation failed: ... unable to resolve the filesystem identity for
  .../index.lock`.
  `release_owned_lock` in `src/native/recovery_files.rs` now reports a lock that is gone as absent,
  and also when the removal itself finds it gone; a lock that still exists but cannot be identified stays an error.
  Controls: `a_lock_released_by_a_peer_mid_release_is_absent` (two races, through a replaceable identity mechanism)
  and `an_unidentifiable_lock_is_still_an_error`.
  Commits `e2606bca07` and `89f7e54313` (Clippy findings in the controls).

## Open findings

Cross-wrapper recovery without mutual exclusion, not fixed.
Scenario: a native worker is killed at `landing-locked`, holding the landing lock and the real `index.lock`;
five survivors, a mix of both wrappers, recover its dead transaction while they commit.
The merged timeline of a failing run (the driver prints it with `--verbose`) showed this order:

1. A native survivor recovered the dead landing, released the dead worker's `index.lock`, and started landing its own
   commit, which created a new `index.lock`.
2. An incumbent survivor that had classified the same owner as dead earlier then logged `released owned lock
   .../index.lock` and removed the shadow repository of the same dead transaction, three milliseconds later.
3. The native survivor's landing failed with `opening the index lock ... failed: No such file or directory`
   (or `protecting .../index.lock failed`), exit status 2, and left its own transaction behind.
4. Every later command of either wrapper in that repository failed with the same error, because the left transaction
   has a landed commit and an index install that needs a lock that no longer exists.
   The repository was whole (`git fsck` clean) but wedged until the state is removed by hand.

What is established:
the sequence above in the logs of three runs;
that native-only and incumbent-only sets of the same seed pass 60 of 60 times while the mixed set had a survivor fail in
19 of 60 and 22 of 40 repetitions (most of those failures are incumbent exits; the native exit status 2 was seen in 4
repetitions of 100).
What is not established: why the incumbent was not excluded by the landing lock while the native survivor held it,
and whether the incumbent's release matched the new lock by an inode number that the filesystem reused.
Both wrappers use the same read-then-rename retirement of a dead owner's lock directory
(`retireDeadLock` in the incumbent, `retire_dead_lock` in `src/native/owner_lock.rs`),
whose restore after a displaced live lock can fail when a third party publishes in between;
that window is the leading hypothesis and no control exercises it.
The incumbent has been removed from every `PATH`, so a mixed fleet no longer exists.
A native-only reproduction was not found in 60 repetitions with the victim at `landing-locked` and 17 further seeds.

Incumbent-only findings (the incumbent is retired and not fixed):
concurrent recovery of one dead transaction made an incumbent survivor exit 1 with
`ENOENT: ... rename .../cli-git-transactions/<id> -> ....retired` (incumbent only, seed 12; mixed, seed 2) and with
`ENOENT ... scandir .../cli-git-transactions/<id>` (incumbent only, seed 18);
an incumbent hook dispatcher exited 1 with `ESRCH: no such process, read` inside its process birth identity reader
(mixed `hooked`, seed 3), which left that worker's commit unlanded.
The native wrapper reads `/proc` records through a path that maps `ESRCH` to an exited process
(`src/native/process_identity.rs`).

## Old-format fixtures

`native-interop/capture-fixtures.mjs` (deleted with the incumbent) wrote the incumbent's state into eight repositories:
`phase-<phase>` for the six phases (the incumbent killed itself there), `completed` (two finished commits, which
leave the capture store and landed-capture records) and `hook-lock-dead` (the incumbent killed while its `pre-commit`
hook ran, which leaves a dead hook lock).
They are kept under `native-interop/fixture/<name>/` as plain files:
every `.git` directory is stored as `dot-git`, because a repository cannot track a path named `.git`;
symbolic links of the incumbent's shadow repositories are listed in `links.tsv` of the fixture and recreated on restore;
directories that hold nothing are recreated on restore.
Each fixture restores to the absolute path it was captured at, since its records name absolute paths.
The commit hook's final-newline fixer changed seven files of the captured set (six driver marker files and
`objects/info/packs` of Git itself); no record written by the incumbent differs from its capture.

`old-format-fixtures.mjs` restores each fixture in the image and runs only the native wrapper:

- `phase-capture-locked`, `phase-preparation-done`:
  `git status` recovers the transaction, the commit did not land, the real index equals `HEAD`, `git fsck` is clean,
  and a native commit lands.
- `phase-landing-locked`, `phase-objects-migrated`, `phase-ref-updated`, `phase-index-installed`:
  the records name device and inode numbers of files the incumbent created, and a restored copy has other numbers,
  so full recovery cannot be asserted statically.
  The native wrapper must read every record and either recover or refuse with its identity-changed message,
  never with a message about an unreadable record, and the repository must stay whole.
  The live pairings of `crash-matrix.mjs` above prove full recovery of these four phases.
  Observed: `landing-locked` and `objects-migrated` recover `git status` and leave the incumbent's `index.lock`
  alone because its identity differs; `ref-updated` and `index-installed` refuse with
  `Commit transaction file link identity changed`.
- `completed`: a native commit lands over the incumbent's capture store and advances the sequence.
- `hook-lock-dead`: a native commit retires the dead hook lock, runs the hook once and lands.

## Rerun commands

The incumbent exists only in history, so a rerun starts from the last commit that still builds it:

```sh
# Throwaway worktree of the last commit that holds the provisioning step and every driver.
git worktree add --detach "${HOME}/temp/agent/interop-rerun" 89f7e54313
# Build the incumbent from the pinned revision, then run a driver (about 10 minutes for the first image build).
cd -- "${HOME}/temp/agent/interop-rerun/package/git-policy/cli"
GIT_POLICY_NATIVE_IMAGE_TAG=interop node "${HOME}/temp/agent/gate-slot.ts" \
  mise run //package/git-policy/cli:native:interop -- crash-matrix
# Other drivers: lock-waits, mixed-concurrency [--wrappers=native|incumbent] [--only=killed] [--verbose] [seeds],
# owner-locks, phase-recovery, hook-dispatch, old-format-fixtures.
```

The fixture reader needs no incumbent and runs from any later commit that keeps
`native-interop/old-format-fixtures.mjs`:

```sh
GIT_POLICY_NATIVE_IMAGE_TAG=interop node "${HOME}/temp/agent/gate-slot.ts" \
  mise run //package/git-policy/cli:native:interop -- old-format-fixtures
```

## Trailing gates

The matrix and the old-format fixtures are done.
The long fuzz campaigns, non-core mutation, the `pathBytes` field, the Windows checks and the release-artifact
performance gates are separate items of `doc/handover/cli-git-rust-implementation.md`.
