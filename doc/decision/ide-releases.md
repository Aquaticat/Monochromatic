# Release the IDE from CI as GitHub pre-releases

## Status

Accepted 2026-10-22.
Owner-authorized:
the owner asked for GitHub releases CI ("Please setup gh releases CI") and chose the IDE and the nested compositor as
the products to release.
This document covers the IDE (`package/desktop-app/ide`,
program `monochromatic-ide`);
the compositor has its own workflow and document.
The first real release is a separate act that needs the owner's go-ahead (see the consequences).

## Context

Before this,
the IDE had no release path.
`mise run //package/desktop-app/ide:install` puts a locally built `dist/monochromatic-ide` into `~/.local/bin`,
`package/desktop-app/ide/Cargo.toml` has `publish = false`,
and nothing built the program anywhere but the owner's machine.

The owner's answers,
as the agent that built this received them:

- The release shape follows the music player's,
  which the owner already accepted (`doc/decision/music-player-releases.md`,
  workflow `.github/workflows/music-player-release.yml`):
  a version change merged to `main` triggers a run,
  a manual dispatch has a `dry-run` input that defaults to true,
  every file is attested,
  and one release job creates the release with every asset in a single `gh release create`.
- Every release is a pre-release,
  because the project is under active development.
- Platform:
  Linux x86_64 only for now.
  The program needs a Wayland session and a Vulkan driver for a hardware GPU (`package/desktop-app/ide/README.md`,
  sections "Renderer and GPU" and "What the host provides").
- The released file is the single executable that the `bundle` task writes,
  with its notices.

Facts that constrain the design:

- Releases are immutable in this repository.
  A published release can never receive a replacement or an extra file,
  so a bad release is fixed only by a higher version (`doc/decision/music-player-releases.md`,
  "Safety against a bad first release").
- The version `0.1.0` was in `main` before the workflow existed,
  so no push will release it.
- The repository has an allowed-actions list.
  Every action the workflow uses is used by `music-player-release.yml` at the same commit,
  and the pinned `jdx/mise-action` version is the same.
- A GitHub-hosted runner has no display and no GPU.
  The IDE refuses CPU Vulkan adapters (`src/gpu_device.rs`,
  README section "Renderer and GPU"),
  so no check on a runner can open its window.
- The repository's `mise.lock` pins one Rust toolchain for every package,
  a dated nightly.
  The IDE builds in a container whose Rust is the stable toolchain,
  and nothing in the package builds it with that nightly.

## Decision

### Trigger and versions

`.github/workflows/ide-release.yml` runs on a push to `main` that changes `package/desktop-app/ide/Cargo.toml`,
and on `workflow_dispatch` with a `dry-run` boolean that defaults to true.
The detect job is the music player's detect job with the IDE's manifest:
it compares the `[package]` `version` before and after the push and builds only when it changed.
The version must be plain `MAJOR.MINOR.PATCH`,
and a push may not lower it (compared with `sort --version-sort`,
so `0.9.0` to `0.10.0` is an increase).
The music player's cap of 99 on minor and patch is not carried over:
it exists for the Android `versionCode`.

The tag is `ide-v<version>`.
If it already exists,
the release is skipped with a notice and the run succeeds;
the release job checks again right before creating the release.
A run is real only on `main`,
from a push or from a dispatch with `dry-run` false;
a real dispatch from any other ref fails.
A dry run builds,
packages,
verifies and uploads workflow artifacts that expire after one day,
prints the `gh release create` command and the notes,
and skips attestation,
the tag and the release.
The concurrency group is `ide-release` with `cancel-in-progress: false`,
so runs queue.
Top-level `permissions` is `{}`;
the detect job reads contents,
the build and checksums jobs also write attestations and the id token,
and only the release job can write contents.

The detect step was run against scratch repositories for these cases,
and each behaved as described here:
a push with a bump,
with the same version,
with a lower version,
with a suffix,
with a manifest absent before the push and with a zero `before`,
and a dispatch on a branch and on `main`,
with and without an existing tag.

### The build runs the repository's mise tasks in podman

The runner runs `mise run //package/desktop-app/ide:bundle`,
the flow developers use,
and not a native `cargo build`.
The reasons are in the tasks themselves:

- `build` depends on `runtime` and `notices` (`package/desktop-app/ide/mise.toml`,
  the `depends` of `[tasks.build]`).
  `build.rs` stops the build when the prepared runtime directory is missing (`build.rs`,
  the message "Prepare it with `mise run //package/desktop-app/ide:runtime`").
- `runtime` fetches the Helix grammars at the pinned revision and compiles them in the container,
  with network;
  `notices` runs `cargo-about` 0.9.2,
  which exists only inside the image (`package/desktop-app/ide/Containerfile`,
  the `cargo install ... --version 0.9.2 cargo-about` line,
  and the task's version check).
  Every one of those tasks runs through `runBounded` and podman.
  A native cargo build would have to reimplement `runtime` and `notices` outside mise,
  and the result would be a flow nobody has run.
- The music player's Alpine job already runs podman 4.9.3 on `ubuntu-24.04` with `--memory` and `--cpus` (run
  39785231437,
  job `build-desktop-musl (x64 ...)`:
  `podman version 4.9.3`,
  and a release build of 25 min 10 s with `--memory=12g --cpus=4`).

The steps are:

1. Build the base image with `mise run //package/desktop-app/terminal:image`.
   The IDE image is `FROM localhost/monochromatic/terminal` (`package/desktop-app/ide/Containerfile`,
   line 2),
   and the tasks build the IDE image on demand but not its base.
2. Build the IDE image with `mise run //package/desktop-app/ide:image`.
3. Run a bounded container once to print `rustc --version --verbose`,
   `cargo --version` and `cargo-about --version`,
   with the same kinds of limits the tasks pass (memory,
   CPUs,
   processes,
   open files).
   The Alpine job proves `--memory` and `--cpus` on this runner image;
   `--pids-limit` and `--ulimit` were not proven,
   and this step makes them fail early and not an hour into the build.
4. Run `mise run //package/desktop-app/ide:bundle`.
   `MISE_JOBS=1` runs one task at a time
   (`mise run --help` of mise 2026.10.0 lists `--jobs` with `[env: MISE_JOBS]`),
   because the container bound applies per container and not per task graph.
   `IDE_CONTAINER_CPUS=4` and `IDE_CONTAINER_MEMORY=12g` replace the default 90 percent share
   (`package/desktop-app/ide/bin/container-bounds.ts`),
   as the Alpine job's `BUILD_CPUS` and `BUILD_MEMORY` do,
   so the runner keeps room for podman and the runner processes.

The `build` task passes no `--locked` to cargo.
The workflow fails the job if `git diff` shows a change in `package/desktop-app/ide/Cargo.lock` or in any tracked
file after the build,
so a dependency change the build made on its own never ships.

The Rust toolchain of the release is whatever `stable` was when the image was built
(`package/desktop-app/terminal/Containerfile`,
the `--default-toolchain stable` line),
not the `mise.lock` nightly.
`mise.lock` supplies node,
which runs the task scripts (`mise install node`).
The job prints the toolchain and passes the `rustc --version` line to the release notes,
so each release names its compiler.
This conflicts with the instruction to read the toolchain from `mise.lock` as the music player job does,
and the conflict is resolved for the tested flow:
changing the container's toolchain changes what every developer builds with and belongs to its own decision.

### Gates before upload

All of these run on the runner before anything is uploaded or attested:

- The executable prints exactly `monochromatic-ide <version>` for `--version` with an empty environment.
  The output format was read from the installed binary (`monochromatic-ide 0.1.0`) and from `bin/inspect-bundle.ts`,
  which expects `monochromatic-ide <major>.<minor>.<patch>`.
  `--version` exits before the program touches a display or a home folder (README,
  "Project startup").
- The dynamic section lists exactly `ld-linux-x86-64.so.2 libc.so.6 libfontconfig.so.1 libgcc_s.so.1 libm.so.6` and
  the newest glibc symbol version is at most 2.39.
  Both were measured on the installed binary on 2026-10-22.
  `INSTALL.txt` and the README state those requirements,
  so a build that needs more fails until they are updated.
- `mise run //package/desktop-app/ide:inspect:no-software-renderer`:
  Slint's software renderer is not linked.
- `inspect:bundle` with the checks `inventory`,
  `license-texts` and `crate-licenses`:
  the executable embeds every runtime file and license text byte for byte,
  `--licenses` prints them in full,
  and every linked crate has a license text.
- After packaging,
  the archive is extracted and its program must print the version,
  equal the built executable,
  print notices equal to the notices file,
  and the launcher entry must pass `desktop-file-validate`.

```sh
# The inspect:bundle gate of the workflow: file, runtime directory, and the checks that need no window.
mise run //package/desktop-app/ide:inspect:bundle \
  dist/monochromatic-ide target/release/runtime inventory,license-texts,crate-licenses
```

Local results are in the section "Checks run before landing".

### Checks left out, and why

- The seven other `inspect:bundle` checks (`lone-copy-highlights`,
  `later-start-reuses-cache`,
  `damaged-cache-rebuilt`,
  `shadowing-query-ignored`,
  `concurrent-first-starts`,
  `damaged-embedded-part-reported`,
  `old-cache-folders-removed`) start the program in the nested compositor.
  They demand a Wayland session (`WAYLAND_DISPLAY`) and the `monochromatic-nested-wayland-session` tool,
  and the program refuses a CPU Vulkan adapter,
  so none can run on a runner.
  `old-cache-folders-removed` fails the display on purpose and needs no compositor,
  but nothing established that the program reaches its cache tidy without a GPU,
  so it is not in the list.
  A dry run on a runner can show it;
  adding it then is a one-word change.
- The test suites (`test`,
  `test:native`,
  `test:annotations-native`,
  and the rest) and `lint:clippy` and `lint:release`:
  they compile the debug profile again (the local debug target directory is 23 GB,
  the release one 3.5 GB),
  and the native ones render on the hardware GPU with `/dev/dri`.
  They are the development gate,
  run before a change lands,
  and not part of a release.
- `inspect:bundle-guards`:
  it damages copies and observes the checks fail,
  which proves the checks and not the executable.
- No window is ever opened in CI.
  The runbook therefore has the maintainer start the archive of a dry run on a Wayland machine with a GPU before a
  real release.

### Files

One release holds three files:

- `ide-<version>-linux-x64.tar.gz`,
  native build on `ubuntu-24.04`.
  It holds `bin/monochromatic-ide` (the `bundle` task's executable,
  about 92 MB;
  grammars,
  queries and license texts are embedded,
  so nothing sits beside it),
  `share/applications/monochromatic.ide.desktop` (the file the `install` task installs,
  unchanged,
  with its stock icon name),
  `LICENSE`,
  `LICENSES/` (the application's two license texts),
  `THIRD-PARTY-LICENSES.txt` and `INSTALL.txt`.
  The tar stream has fixed order,
  modes,
  owner and timestamps,
  as the music player's.
- `ide-<version>-third-party-licenses.txt`,
  the license notices as a file of their own.
- `SHA256SUMS`,
  computed by a job that runs only after the build succeeded.

All three are attested in a real run.
Workflow artifacts are named `asset-linux-x64`,
`asset-third-party-licenses` and `checksums`,
so the music player's pattern `asset-*` collects the assets.
The checksums job fails unless the asset set is exactly the two expected names.

### License notices

The IDE has no separate notices job.
The executable embeds its notices and prints them with `--licenses` (README,
"What the executable carries" and "Rust crate license texts"):
the application's license texts,
both font notices,
Helix's license,
a notice for every bundled grammar,
and the license text of every Rust crate that `cargo-about` collected during the build.
The workflow writes the notices file from the executable that passed `inspect:bundle`
(`env --ignore-environment dist/monochromatic-ide --licenses`),
so the shipped notices are the embedded ones,
not a second copy that could drift.
The archive carries the same bytes as `THIRD-PARTY-LICENSES.txt`,
and the archive check compares them.

Slint is used under `GPL-3.0-only` (`about.toml`,
and README "Choices made by default and open to veto").
That is a recorded default open to the owner's veto,
not an owner decision,
and the release now publishes the result.
The release notes say it in plain words and point at the source tree of the tag.
The Slint royalty-free attribution that the music player's notes carry (the `#MadeWithSlint` badge) is not used,
because the IDE does not use that license.

### No caches

The workflow caches nothing.
The container image,
the `ide-cargo` volume and the target directory are fresh in every run,
as in the music player's Alpine jobs (`doc/decision/music-player-releases.md`,
"Build mechanics").
The repository's cache budget was at its cap when this was written (`doc/decision/ci-caching.md`),
a release runs once per version,
and a cold build cannot carry a stale artifact into attested bytes.
This is a deviation from the owner's wish for caching in general,
and the owner may veto it;
the cold time that a cache would be measured against is in "First dry run".

### Runner disk

The build needs the base image (2.05 GB locally),
the IDE image (2.25 GB),
the release target directory (3.5 GB locally),
a debug build of the `ide-runtime` helper,
the cargo volume and the grammar sources.
That debug build is also a time cost:
the `runtime` task compiles every dependency in the dev profile
(optimized by `[profile.dev.package."*"]`)
before the release build compiles them again,
and the measured total of the whole `bundle` task is in "First dry run".
A step removes the preinstalled Android SDK,
.NET,
GHC and CodeQL directories,
which the job does not use,
and prints `df` before and after that step,
after the image build and after the bundle.
The first dry run showed that the runner had 85 GB free before the step,
so the step may be dropped.

## First dry run

The workflow was dispatched on `main` as a dry run on 2026-10-22 (run 39832705367).
The `build` job took 15 min 37 s from set-up to the failing step.
It passed every step up to the renderer gate,
and failed there (see "The renderer gate on a fresh cargo volume").
Measured on that run:

- Podman 4.9.3,
  mise 2026.10.9,
  node 26.12.0,
  and the image's `rustc 1.99.1 (58cf8f9c3 2026-10-13)`,
  `cargo 1.99.1` and `cargo-about 0.9.2`.
- Step times:
  base image 1 min 04 s,
  IDE image 1 min 30 s,
  `bundle` 10 min 26 s (the task printed `Finished in 625.54s`),
  against 25 min 10 s for the music player's Alpine release build.
  The container bound was 4 CPUs,
  12g memory,
  1024 processes and 4096 open files.
- The bounded container with `--pids-limit=1024` and `--ulimit nofile=4096:4096` ran,
  so rootless podman on the runner accepts those limits.
- Disk on `/` (145 GB):
  85 GB available at the start,
  104 GB after the step that removes the preinstalled SDKs (it freed 18 GB and took 1 min 50 s),
  101 GB after the images,
  96 GB after `bundle`.
  The build itself used about 8 GB,
  so the removal step was not needed on this image.
  It stays until a second run confirms the figures,
  and the owner may drop it.
- The `--version` check printed `monochromatic-ide 0.1.0`.
  The dynamic section was exactly `ld-linux-x86-64.so.2 libc.so.6 libfontconfig.so.1 libgcc_s.so.1 libm.so.6`
  and the newest glibc symbol version was 2.39,
  as measured on the installed binary.
- The tracked-files check passed,
  so the build did not rewrite `Cargo.lock`.

### The renderer gate on a fresh cargo volume

`mise run //package/desktop-app/ide:inspect:no-software-renderer` stopped with
`no matching package named async-net found`,
required by `i-slint-backend-testing v1.18.1`,
and cargo's note that `--frozen` is offline mode.
The cause is the second positive control of the task,
`--features slint/mcp`.
It enables a feature that no build of the package uses,
so its crates (`async-net` among them) are not in `Cargo.lock` and `cargo fetch` never resolves them.
`--frozen` cannot download registry index entries,
and the volume on the runner is new in every run,
while the author's long-lived `ide-cargo` volume already held the entries from earlier work.
The `--all-features` request and the `slint/renderer-software` control resolved offline without trouble.

Reproduced locally on 2026-10-22 with the bound at 2 GiB and 2 CPUs for the probes:
after `cargo fetch` on a new volume,
the `slint/mcp` request failed with the same message under cargo 1.99.1,
the runner's version;
the whole task chain `bundle`,
then the gate,
on another new volume failed at the same command.
On that volume,
`cargo fetch` again and `cargo metadata --locked --all-features` with the network did not help,
and `cargo tree --locked` with the network and the same arguments did,
after which the offline command passed.

The fix is in the task,
not in the workflow:
`inspect:no-software-renderer` now makes one pass per request with the network on and `--locked`
(the same lock file,
nothing written) before its offline checks.
A workflow step would have to repeat the task's feature list,
and a developer with a new volume would hit the same failure.
The checks themselves are unchanged and still run offline with `--frozen`,
so the gate is neither dropped nor weakened.
If the network is down the pass reports that it was skipped,
and the offline checks use the entries the volume holds.
The task ran on a new volume in the failing state,
passed,
and printed its success line (the software renderer is not linked,
and both controls reach it).

## Checks run before landing

All of these ran on the author's machine on 2026-10-22,
against the installed `monochromatic-ide 0.1.0` (91,945,952 bytes,
a copy of it as `dist/monochromatic-ide` of the worktree) because a release build was not repeated:

- `actionlint` 1.7.12 and `zizmor` 1.31.1 (`--offline`,
  also `--pedantic`) on `.github/workflows/ide-release.yml`:
  no findings except the informational `anonymous-definition` on unnamed jobs,
  which the music player's workflow has as well.
- The YAML parses with the repository's `yaml` package,
  and the shell steps were extracted and run with `bash -e`:
  version smoke test,
  library and glibc check (newest symbol version 2.39),
  notices file (11,241 lines,
  581,554 bytes,
  first line `Monochromatic IDE 0.1.0 carries these 238 license and notice texts`),
  packaging,
  archive check (the extracted program prints `monochromatic-ide 0.1.0`),
  asset set and `SHA256SUMS`,
  release notes,
  and the dry-run `gh release create` command.
  The archive was 23,441,579 bytes.
  The gates were also made to fail on purpose:
  a wrong version,
  a glibc floor of 2.38,
  and a different executable.
- `mise run //package/desktop-app/ide:inspect:no-software-renderer` passed.
- After the fix of "The renderer gate on a fresh cargo volume",
  the gate chain was run against a real build from a new cargo volume
  (the `bundle` task through a wrapper that named another volume and the runner's cargo 1.99.1,
  8 CPUs and 24g memory;
  5 min 6 s):
  the tracked-files check,
  the `--version` check,
  the library and glibc check (newest symbol 2.39),
  `inspect:bundle` with the three window-free checks (1,255 embedded files,
  449 crates covered),
  the notices file (581,554 bytes),
  the packaging (23,457,136 bytes),
  the archive check,
  and the checksums step all passed.
- The version-bump procedure of the runbook was run on a scratch copy of the package with the version set to `0.1.1`:
  the `cargo fetch` of the `fetch` task,
  run in the build image,
  changed exactly one line of `Cargo.lock`
  (the `ide` entry from `0.1.0` to `0.1.1`).
- `mise run //package/desktop-app/ide:lint` and the markdown lint (`monochromatic-lint`) of the three documents
  written here passed after the findings in the README section were fixed.
- The `inspect:bundle` command of the block in "Gates before upload" passed with 3 of 10 checks in 15.39 s:
  1,255 embedded files,
  27 grammars,
  392 linked crates,
  and 449 crates covered by license texts.

## Not verified locally

Only a real runner can prove these.
The first dry run (section "First dry run") proved the build and the first three gates,
and stopped at the fourth:

- The steps after "Check that no software renderer is linked" have not run on a runner:
  "Check the single executable" (`inspect:bundle` with `usage`-style task arguments under mise 2026.10.9,
  which worked with mise 2026.10.0 and no `usage` on `PATH`),
  the notices file,
  the packaging,
  and the archive check.
  Their shell was run locally against a build from a fresh cargo volume (section "Checks run before landing").
- Attestation,
  the artifact upload and download steps,
  the checksums job,
  and the `gh release create` call itself.
  The release step is the music player's,
  which has run successfully many times,
  but the IDE's workflow has not got that far.
- Whether the `old-cache-folders-removed` check can run on a runner.

## Consequences

- The first real release of a version is permanent.
  A broken release can be fixed only by a higher version,
  and its tag stays reserved.
  The dry run on `main` and a read of its log are the guard,
  and `doc/runbook/release-the-ide.md` says how.
- Version `0.1.0` is already in `main`,
  so the first release needs a dispatch from `main` with `dry-run` false,
  after a green dry run on `main`,
  and the owner's go-ahead.
  A dispatch can only find the workflow after it is merged to `main`,
  so the first dry run happens after the merge.
- A version bump needs a refreshed `Cargo.lock`.
  The build has no `--locked`,
  and the workflow's lock check fails when the build rewrites the lock file.
- The release is not reproducible bit for bit,
  and a day's change in Fedora 41,
  `stable` Rust,
  the Zig download or `cargo-nextest` `latest` can fail or alter a build with no repository change.
  The image installs them unpinned (`package/desktop-app/terminal/Containerfile`).
  Pinning them changes what developers build with and is a separate decision.
- The Rust toolchain of a release is not the `mise.lock` nightly.
  Each release names its compiler in the notes.
- The release job's checks open no window.
  A program that builds and passes every gate but cannot start on a GPU would still ship.
  The runbook asks for a start of the dry run's archive on the Wayland machine first.
- Only Linux x86_64 on glibc 2.39 or newer is built.
  There is no Windows,
  macOS,
  arm64 or musl build,
  and the notes say so.
- The licensing of the shipped bytes (Slint under `GPL-3.0-only` inside a package whose manifest says
  `LGPL-3.0-or-later`) is now published.
  The owner should confirm the choice before the first real release.
- The `jdx/mise-action` pin is shared with the music player;
  a person updates it (`doc/runbook/release-the-music-player.md`,
  "The mise version pin").
- Cold builds cost run time on every release:
  15 min 37 s for the `build` job up to the renderer gate in the first dry run.

## Alternatives rejected

- A native `cargo build` on the runner with the `mise.lock` toolchain:
  it needs Ubuntu equivalents of the Fedora packages and a re-implementation of `runtime` and `notices` outside mise,
  and it has never been run for this package.
- Building the executable once in a separate job and checking it in another:
  there is one platform and one build,
  and a second job would repeat the container image build.
- Shipping the notices only inside the archive:
  the music player ships them as a file of their own so that a person can read them without extracting 23 MB.
- Adding the window checks with a software Vulkan adapter on the runner:
  the program refuses CPU adapters on purpose (owner decision of 2026-10-19),
  and a check that needs a switch that production lacks proves something other than the release.
- An AppImage or a deb package:
  the program is one executable,
  as the music player's Linux archive is,
  and a package manager install has no tested distribution matrix behind it.
