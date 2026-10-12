# Native end-to-end lane: the incumbent's e2e suite against the native executable

Branch `feat/cli-git-native-e2e`, based on the transactions head `13f60ef1b1`.
This file holds the current state only; when the state changes, replace the text instead of appending.

## State in one paragraph

The incumbent's end-to-end suite (`package/git-policy/cli/e2e`) now runs unchanged against the native executable
with `E2E_WRAPPER=native`.
All 38 catalog scenarios were run on Git 2.55.0 with seed 1: one passes vacuously, two skip by design, and 35 fail
because the commit path is still refused (`Unported::CommitTransaction`, exit 2).
No failure has another root cause.
The non-commit commands that the scenarios send through the wrapper behave identically in the incumbent and the
native executable (25 of 25 commands agree).
When the refusal is removed, the suite is run with the commands under "Commit-path run".

## What was built

Commits on this branch, in order (all touch only `package/git-policy/cli/e2e`, `bin/e2e-native-container.mjs` and
`mise.toml`; nothing under `src/native/`):

- `ef646ed87e`: `e2e/wrapper-selection-fixture.ts` (the selector), `e2e/repository-fixture.ts` reads it,
  `e2e/concurrent-e2e-consumer.ts` prints and verifies the selection,
  `bin/e2e-native-container.mjs`, and the mise tasks.
- `51a72ff4a0`: `e2e/README.md` documents the native tasks.
- `7957ab7129` and `d20e70c57e`: the surface probe (`e2e/wrapper-surface-probe.ts`,
  `e2e/wrapper-surface-steps-fixture.ts`) and the `surface` subcommand.

### The selector

- `E2E_WRAPPER` is `incumbent` (default, also when unset or empty) or `native`; any other value throws
  `WrapperSelectionError`.
  `WRAPPER_BIN` in `e2e/repository-fixture.ts` is the only place the wrapper directory enters a scenario: it is the
  first `PATH` entry of every wrapper run.
  Scenarios, the invariant checker and the report are untouched.
- Before the first scenario the consumer opens the selected `git` and checks that it is an ELF executable (native) or a
  `#!` script (incumbent), then prints `wrapper=<kind> <path> (<kind of program>)`.
  A run labelled native can therefore never drive the TypeScript wrapper.
- Unit test `e2e/wrapper-selection.unit.test.ts` (6 checks across 2 `describe` blocks) passes under `node`; the
  rejecting checks were proven to fail when an expectation is flipped.
  `mise run //package/git-policy/cli:lint:oxlint:paths` reports 0 warnings and 0 errors for every added or changed
  file, and `lint:types` reports no error under `e2e/` or `bin/` (the package's other `src/*.unit.test.ts` errors come
  from a missing `dist/`, unrelated).

### The native image

- `mise run //package/git-policy/cli:test:e2e:concurrent:native:image` runs `bin/e2e-native-container.mjs image`.
  Stage one compiles the release `cli-git-native` from a mount-free snapshot of this checkout in
  `docker.io/library/rust:1.97-bookworm` (offline, vendored, `--locked`, 2 GiB).
  Stage two starts from `localhost/cli-git-concurrent-e2e:latest` and links the executable as `/opt/native/bin/git`.
- Why bookworm: the end-to-end image is `node:24.11.0-slim` on Debian 12,
  so the executable must not need a newer glibc; the native gate image is Debian 13.
  The image has no `/usr/bin/git`, so the native wrapper finds the scenario's Git (`/opt/git/<version>/bin`) only
  through `PATH` order, exactly as the incumbent does.
- The base image `localhost/cli-git-concurrent-e2e:latest` is built by the existing
  `test:e2e:concurrent:image` task (needs `pack:npm`); the native image task does not build it and fails with that
  instruction when it is missing.
- Image built for the runs below: `localhost/cli-git-concurrent-e2e-native:e2e`, id `1d843b0f655c`,
  compiled from the `src/native` of `13f60ef1b1`.
  Repeating the image task with unchanged sources hits the layer cache; the run task depends on it.

### The surface probe

`e2e/wrapper-surface-probe.ts` runs 25 non-commit commands that the scenarios send through the wrapper (and a few that
policies may refuse) in a disposable linked-worktree repository, once per wrapper in the same image, and the driver
compares exit code, arguments and output with object IDs masked.
The two runs are sequential because both relabel the `e2e/` mount privately (`:Z`); concurrent containers contest it.

## Rerun commands

All from the repository root, through the host slot limiter (four slots shared with the other lanes; a mutation
campaign can hold every slot for hours, so a heavy command may wait).
`GIT_POLICY_NATIVE_IMAGE_TAG` names the image tag; use one value per worktree.

```sh
# repository root: build the native end-to-end image (cached when src/native is unchanged)
GIT_POLICY_NATIVE_IMAGE_TAG=e2e node "${HOME}/temp/agent/gate-slot.ts" \
  mise run //package/git-policy/cli:test:e2e:concurrent:native:image

# repository root: the whole catalog on Git 2.55.0, the result in this document
GIT_POLICY_NATIVE_IMAGE_TAG=e2e node "${HOME}/temp/agent/gate-slot.ts" \
  mise run //package/git-policy/cli:test:e2e:concurrent:native --seed 1 --git 2.55.0

# repository root: the non-commit commands, incumbent against native
GIT_POLICY_NATIVE_IMAGE_TAG=e2e node "${HOME}/temp/agent/gate-slot.ts" \
  mise run //package/git-policy/cli:test:e2e:concurrent:native:surface
```

The incumbent control (default selector, packed incumbent from the existing image, same bounds as the task):

```sh
# package/git-policy/cli
node "${HOME}/temp/agent/gate-slot.ts" podman run --memory=2g --cpus=2 --rm --network=none \
  --env E2E_SEED=1 --env E2E_GIT_VERSIONS=2.55.0 \
  --env E2E_SCENARIOS=baseline-explicit-commit,baseline-checker-positive-control,baseline-sigkill-post-commit \
  --volume "$PWD/e2e:/fixture/e2e:ro,Z" --volume "$PWD/../../module/caught-value:/fixture/caught-value:ro,Z" \
  localhost/cli-git-concurrent-e2e:latest node /fixture/e2e/concurrent-e2e-consumer.ts
```

## Results on the refused commit path

Seed 1, Git 2.55.0, 38 scenarios (the catalog has 38; the "about 70" in the transactions document counts `name:`
fields of expectations, not scenarios; with three Git versions it is 114 runs).
Wall time of the full run including the cached image step: 65 s
(nothing waits for a hook that never starts, so no scenario hit its 180 s timeout).
Native workload digests equal the incumbent's for the three scenarios both ran (`f5c1d30bb33a` for
`baseline-explicit-commit`, `520136487c60` for `baseline-sigkill-post-commit`, `52025dfc1bc6` for
`baseline-checker-positive-control`), so the seeded workload does not depend on the wrapper.

Root cause class of every failure below is "scenario needs commit path": the first wrapper `git commit` exits 2 with
`cli-git: the commit transaction that every git commit except a dry run goes through is not implemented in this native
development executable`.
No failure is a native bug outside the commit path and none is a harness gap.

### Pass

- `branch-switch-during-commit`: passes vacuously.
  Its expectation is that the branch switch and the held commit do not both exit 0.
  The switch exits 0 (the surface probe shows it identical to the incumbent) and the commit exits 2, so the
  expectation holds without testing anything.
  It needs the commit path to mean anything.

### Skipped

- `replay-unavailable-fails-fast` and `replay-unavailable-disjoint-burst`: by design they run only on Git 2.39.5
  (`replayPlumbing: 'absent'`); on 2.55.0 the harness skips them.
  See "Git floor" for why the native executable never runs them.

### Fail, needs the commit path (first failing assertion)

Baseline commit fixture: `baseline-explicit-commit`, `baseline-index-commit`, `baseline-trace-sequential`
fail `all-commits-succeed` (the first commit exited 2).

Baseline amend fixture: `baseline-amend`, `baseline-lint-staged` fail `all-commits-succeed`.

Baseline hook fixture: `baseline-hooks-hookdir`, `baseline-hooks-config`, `baseline-ssh-signing` fail
`all-commits-succeed`; `baseline-sigkill-post-commit` fails `follow-up-commit-succeeds`;
`baseline-checker-positive-control` fails `positive-control` (the checker's planted violations differ because the
wrapper commit that should land exited 2).

Concurrent paths fixture: `concurrent-disjoint-paths`, `concurrent-trace-replay` fail `all-commits-succeed`.

Shared file fixture: `shared-file-non-overlapping-hunks` fails `all-commits-succeed`; `shared-file-overlapping-hunks`
fails `one-lands`.

Subsumption fixture: `shared-file-adjacent-edits` fails `all-commits-succeed`.

Index writer fixture: `interleaved-index-writers` fails `all-commits-succeed`.
Its `git add` runs through the native wrapper succeeded; the checker reports no staged-entry violation.

Hooked fixture: `hooks-hookdir-concurrent`, `hooks-config-concurrent`, `ssh-signing-concurrent`,
`lint-staged-stash-concurrent` fail `all-commits-succeed`.

Amend and switch fixture: `amend-during-commits` fails `bystanders-succeed`.

Reservation fixture: `reservation-after-lost-races` fails `all-commits-succeed`.

Lock and GC fixture: `foreign-index-lock-holder`, `gc-prune-during-commits` fail `all-commits-succeed`.
The foreign real-Git commit in `foreign-index-lock-holder` exits 0.

Foreign unproven fixture: `foreign-index-lock-unproven` fails
`bystanders-land-or-report-unproven-owner` (each agent exited 2 without the `index-lock-unproven-owner` finding).

Sigkill fixture: `sigkill-pre-commit`, `sigkill-prepare-commit-msg`, `sigkill-commit-msg`, `sigkill-post-commit`,
`sigkill-offset` fail `bystander-succeeds`.
The `recovery status` (`git status --short`, must succeed) exits 0 through the native wrapper.

Phase kill fixture: `sigkill-phase-preparation-done`, `sigkill-phase-landing-locked`,
`sigkill-phase-objects-migrated`, `sigkill-phase-ref-updated`, `sigkill-phase-index-installed` fail
`victim-reached-phase` (the victim settled before the phase marker; the marker is not implemented, see below).

## Non-commit surface: no native bug found

The incumbent in this comparison and in the control run is the build baked into
`localhost/cli-git-concurrent-e2e:latest` (image id `1d29d429cddf`, created 2026-09-26), whose
`dist/final/node/index.mjs` has sha256 `8103d0848e168b52654e32a80a940de21535972033499f2e124eb451b09a944a`;
it is not rebuilt from `13f60ef1b1`, so a difference introduced into the incumbent after that date is not covered.

`test:e2e:concurrent:native:surface`: 25 of 25 commands agree between that incumbent and the native executable on
exit code, arguments and output (Git 2.55.0, linked worktree).
The commands: `status --short` (clean, modified, after checkout, after apply), `add -- <path>`,
`diff --staged --name-only -z --diff-filter=ACMR`, `diff --binary --unified=0 ... --staged`, `stash create`,
`stash store --quiet --message`, `stash list --format`, `stash drop --quiet`, `checkout --force -- <path>`,
`apply -v --whitespace=nowarn --recount --unidiff-zero`, `switch side`, `switch <branch>`, `gc --quiet --prune=now`,
`push`, `rev-parse --abbrev-ref HEAD`, `log --oneline --max-count=1`, `branch --list`, `config --get`,
`commit --dry-run --short`, and `add --all` (exit 1 in both: the bulk-add policy), `reset --hard`, `clean --force`.
The comparator can detect a difference: with object IDs unmasked it reported `stash store`, `log` and `reset --hard`
as different (the output carries IDs that differ between two containers), so the probe masks seven and forty digit
hexadecimal tokens that hold a decimal digit.
Unexercised: hook-nested wrapper calls (they need a commit), Git older than 2.55.0, Windows.

## Incumbent control

The default selector still drives the incumbent: `baseline-explicit-commit`, `baseline-sigkill-post-commit` and
`baseline-checker-positive-control` pass on Git 2.55.0 with seed 1
(`wrapper=incumbent /opt/cli-git/node_modules/.bin/git (Node script)`), the last one detecting its five planted
violations.
The packed incumbent in that run is the one baked into `localhost/cli-git-concurrent-e2e:latest`; the `e2e/` code
under test is the mounted working copy.

## Facts for the integrator

### Git floor: the native suite runs on Git 2.55.0 only

The native minimum is Git 2.55.0 (user decision of 2026-10-10 in `~/temp/agent/lane-brief.md`;
`MINIMUM_GIT_VERSION` in `src/native/git_version.rs`).
The executable therefore refuses Git 2.39.5 and 2.40.0, observed on a real invocation in the native image
(`git add -- added.txt` in a repository made by `/opt/git/2.39.5/bin/git`): exit 2 with the engine failure
`cli-git: real Git at /opt/git/2.39.5/bin/git reports version 2.39.5; commits, hooks and the locks that coordinate
with them need Git 2.55.0 or newer. Nothing was run. Upgrade Git, then run the command again.`
So on those two versions the harness's own first wrapper command fails and the scenarios fail in setup
(`baseline-explicit-commit` and `baseline-index-commit` observed, seed 1).
Consequences: runs on 2.39.5 and 2.40.0 and both `replay-unavailable-*` scenarios (they prove degradation on 2.39.5)
are out of scope for the native executable.
The sentence in `doc/handover/cli-git-native-transactions.md` ("the native executable must degrade on Git 2.39.5 the
way the incumbent does") conflicts with the settled floor and should be corrected there; this lane does not edit that
file.
`doc/handover/cli-git-rust-implementation.md` has no decision about Git older than 2.55.0 (searched for `2.39`,
`2.40` and `degrad`).

### Phase markers are not implemented

`rg CLI_GIT_TEST_ONLY_PHASE_SIGNAL src/native` finds nothing.
The five `sigkill-phase-*` scenarios and the `race-lost` pause in `reservation-after-lost-races` need the landing
lane to implement the incumbent's protocol: the variable value `<phase>:kill`, `<phase>:kill:<directory>` and
`<phase>:pause:<directory>`; `<directory>/<phase>.reached` written at the phase; `<directory>/<phase>.release` waited
for under `pause`; `race-lost-<n>.reached` and `race-lost-<n>.release` for the occurrence; a malformed value fails the
invocation.
The phases in order: `capture-locked`, `preparation-done`, `landing-locked`, `objects-migrated`, `ref-updated`,
`index-installed`, and `race-lost` (the scenarios use all but `capture-locked`).
Whether the variable reaches hooks and nested wrapper calls is not checked by this lane; the incumbent's does, and a
scenario arms it only on commits whose hooks start no nested commit.

### Not yet done, needs the commit path

The slice 9 differential (JSONL events of each scenario against the incumbent on the same seed) and the concurrency
runs with both wrappers mixed.
The seeds and workload digests already agree between wrappers, so the comparison needs only the commit path.

## Commit-path run

Which scenarios need it, grouped by fixture file under `package/git-policy/cli/e2e` (every scenario below, all 36
non-skipped ones on 2.55.0; none can pass without it except the vacuous one):

- `scenario-baseline-commit-fixture.ts`: `baseline-explicit-commit`, `baseline-index-commit`,
  `baseline-trace-sequential`.
- `scenario-baseline-amend-fixture.ts`: `baseline-amend`, `baseline-lint-staged`.
- `scenario-baseline-hook-fixture.ts`: `baseline-hooks-hookdir`, `baseline-hooks-config`, `baseline-ssh-signing`,
  `baseline-sigkill-post-commit`, `baseline-checker-positive-control`.
- `scenario-concurrent-paths-fixture.ts`: `concurrent-disjoint-paths`, `concurrent-trace-replay`.
- `scenario-shared-file-fixture.ts`: `shared-file-non-overlapping-hunks`, `shared-file-overlapping-hunks`.
- `scenario-subsumption-fixture.ts`: `shared-file-adjacent-edits`.
- `scenario-index-writer-fixture.ts`: `interleaved-index-writers`.
- `scenario-hooked-fixture.ts`: `hooks-hookdir-concurrent`, `hooks-config-concurrent`, `ssh-signing-concurrent`,
  `lint-staged-stash-concurrent`.
- `scenario-amend-switch-fixture.ts`: `amend-during-commits`, `branch-switch-during-commit`.
- `scenario-reservation-fixture.ts`: `reservation-after-lost-races` (also needs the `race-lost` markers).
- `scenario-lock-gc-fixture.ts`: `foreign-index-lock-holder`, `gc-prune-during-commits`.
- `scenario-foreign-unproven-fixture.ts`: `foreign-index-lock-unproven`.
- `scenario-sigkill-fixture.ts`: `sigkill-pre-commit`, `sigkill-prepare-commit-msg`, `sigkill-commit-msg`,
  `sigkill-post-commit`, `sigkill-offset`.
- `scenario-phase-kill-fixture.ts`: `sigkill-phase-preparation-done`, `sigkill-phase-landing-locked`,
  `sigkill-phase-objects-migrated`, `sigkill-phase-ref-updated`, `sigkill-phase-index-installed`
  (also need the phase markers).
- `scenario-replay-degradation-fixture.ts`: `replay-unavailable-fails-fast`, `replay-unavailable-disjoint-burst`
  (Git 2.39.5 only; out of scope for the native executable, see "Git floor").

The command that runs all of them once the refusal is removed and the image is rebuilt from the merged sources
(a full run takes far longer than today's 65 s, so start it as its own unit with a memory cap and wait for its log):

```sh
# repository root
systemd-run --user --unit=e2e-native-full --collect --property=MemoryMax=3G \
  --setenv=PATH="$PATH" --setenv=HOME="$HOME" --setenv=GIT_POLICY_NATIVE_IMAGE_TAG=e2e \
  --working-directory="$PWD" --property=StandardOutput=file:"$HOME/temp/agent/e2e-native-full.log" \
  --property=StandardError=file:"$HOME/temp/agent/e2e-native-full.log" \
  node "$HOME/temp/agent/gate-slot.ts" \
  mise run //package/git-policy/cli:test:e2e:concurrent:native --seed 1 --git 2.55.0
```

Only the sigkill-phase scenarios (needs the phase markers):

```sh
# repository root
GIT_POLICY_NATIVE_IMAGE_TAG=e2e node "${HOME}/temp/agent/gate-slot.ts" \
  mise run //package/git-policy/cli:test:e2e:concurrent:native --seed 1 --git 2.55.0 \
  --scenario sigkill-phase-preparation-done,sigkill-phase-landing-locked,sigkill-phase-objects-migrated,sigkill-phase-ref-updated,sigkill-phase-index-installed
```

Git 2.39.5 and 2.40.0 stay out of the native runs (see "Git floor").
The task exits non-zero when any scenario fails or errors; every run prints its seed first, so a failure replays with
the same `--seed`.

## Choices open to veto

- The native image is built on top of `localhost/cli-git-concurrent-e2e:latest` instead of rebuilding Git from source,
  so Node and the three Git builds are exactly the incumbent run's.
  The cost is that the base image must exist and holds an incumbent that the native runs never put on `PATH`.
- The executable is compiled in `rust:1.97-bookworm`, not in the native gate image (Debian 13), to match the
  runtime glibc.
  The gate stays the authority for Clippy and unit tests.
- `bin/e2e-native-container.mjs` copies the snapshot file list of `bin/test-native-container.mjs` and
  `bin/interop-native-container.mjs` (a third copy); extracting one shared function would touch scripts other lanes
  edit, so it is left for the integrator.
- The seed 1 run covers one interleaving of the free-running scenarios; the commit-path run should add seeds 2 and 3
  as the incumbent's README does.

## Trailing gates

No gate was skipped by this lane.
`native:test:container` and `native:clippy` were not run because nothing under `src/native/` changed; this lane's
container evidence is the native end-to-end image `1d843b0f655c` (base `1d29d429cddf`).
Mutation testing, planted controls and fuzz targets do not apply: the lane adds test harness code and no
`src/native` code.
