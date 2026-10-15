# Depot Alpine compilation trial

This isolated trial moves the release compilation into the remote image build.
It reuses the production Alpine toolchain and runtime stages from `../Containerfile.alpine`.
It exports a disposable executable,
toolchain information,
and the executable's version output;
it does not publish a release or registry image.

## Execution

Set `DEPOT_PROJECT_ID` to the dedicated trial project before invoking
`mise run //package/music-player/desktop-app:trial:depot:build`.
`DEPOT_TRIAL_RUN` optionally labels an execution;
the task otherwise supplies a timestamp.
Each distinct label forces Cargo to execute while preserving its registry and target caches.
`BUILD_JOBS` defaults to `4` to match the compilation concurrency of the reference GitHub job.
The remote Cargo invocation has a 1,800-second execution limit.

Artifacts appear in `../target/depot-trial/`.
The adjacent `../target/depot-trial-metadata.json` records the Depot build identifier.
`mise run //package/music-player/desktop-app:trial:depot:inspect` prints the resolved build without running it.

Use the same `DEPOT_TRIAL_RUN` value to measure an image-layer cache hit separately from a warm Cargo execution.
Set `REQUIRE_FAILURE=1` to require a visible build failure after the verified artifact stage.
This failure control is expected to return a nonzero command status.

`TRIAL_LOG_VERSION=0.4.33` asks Cargo to regenerate the disposable container's lockfile
with that transitive dependency version.
The exported `Cargo.lock` records the resolved graph;
the checked-in lockfile stays unchanged.
`TRIAL_LINKER=mold` installs Alpine's packaged linker and selects it through GCC for a toolchain invalidation probe.
Its version appears in `toolchain.txt`.
This probe checks rebuilding and executable compatibility;
it is not a linker-only performance comparison.

## Interpretation

An unchanged repetition first establishes ordinary timing variation.
Source,
dependency,
and toolchain changes require separate runs before claiming cache correctness across those changes.
The version invocation runs inside the production runtime stage,
so a missing runtime library prevents artifact export.
It does not replace the graphical or audio interaction suites.
Remote builder CPU and memory capacity can differ from GitHub's;
Cargo concurrency alone is not hardware equivalence.
