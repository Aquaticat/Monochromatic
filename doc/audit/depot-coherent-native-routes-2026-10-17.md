# Coherent native and desktop replay routes

The trial-only routes are clean, pushed, and ready for the common complete-graph orchestrator.
They have not been dispatched.
The [route evidence](depot-coherent-native-routes-2026-10-17.evidence.json)
retains provider-verified workflow bytes, exact source and harness hashes, matrices, and local controls.

## Frozen route references

### Native macOS and Windows

- Ref: `trial/depot-coherent-native-20261017`.
- Harness: `65ffc5cc26e794a8317d404a9db25dcc2e9daec2`.
- Workflow: `.github/workflows/music-player-windows.yml`.
- Workflow name: `depot-complete-native-hosts`.
- Inputs: `cohort_id`, `manifest_sha256`, `requested_at`, `source_head`, `hosts`.

Dispatch historical source `cb95cf6d785c3073c192b95f0632cdae7b910894` with `hosts=both`
for `windows-2025` and `macos-15-intel`.
Dispatch desktop source `3434eaa455d569c18b52cf15100f77f9db251d21` with `hosts=macos`.
Build and Clippy call the original package tasks.
The existing nextest adapter inserts only `--no-fail-fast` in memory and emits original/adapted task hashes.

### Original desktop Windows variants

- Ref: `trial/depot-coherent-windows-20261017`.
- Harness: `c8abb557b6fb8444cc65a5892802d9aab01d1130`.
- Workflow: `.github/workflows/music-player-windows.yml`.
- Workflow name: `depot-complete-windows-test-recovery`.
- Inputs: `cohort_id`, `manifest_sha256`, `requested_at`.

Source checkout is fixed to `3434eaa455d569c18b52cf15100f77f9db251d21`.
The original `msvc-x64`, `msvc-arm64`, and `gnu-x64-ucrt64` matrix is preserved.
Independent nextest runs after successful test compilation even when a consumer assertion fails.
The original PowerShell file-redirection assertion is unchanged.
Independent merged-stream and uncaptured-console steps run the original subprobe bodies and retain separate JSON records.
Uncaptured completion alone is insufficient: its own provider step log must contain the exact expected version line.

### Original Alpine architectures

- Ref: `trial/depot-coherent-alpine-20261017`.
- Harness: `707162e5b43edf04703c9e28bf905ba6eb3fc45e`.
- Workflow: `.github/workflows/music-player-alpine.yml`.
- Workflow name: `music-player-alpine`.
- Inputs: `cohort_id`, `manifest_sha256`, `requested_at`.

Source checkout is fixed to `3434eaa455d569c18b52cf15100f77f9db251d21`.
Both `x86_64` and `aarch64` routes preserve the original container build, no-fail-fast tests,
app and compositor builds, and no-server, ALSA, and PipeWire smoke command.
Trial-only prerequisite conditions let app and compositor builds continue after test assertion failure.
Staging requires both builds, and smoke requires staged binaries.
Each internal smoke scenario still requires actual outcome evidence.

## Provenance and local verification

Every route records source `HEAD`, clean tracked status, source tree, and applicable Cargo manifest/lock,
tool, task, and container input hashes before and after consumers.
The shared cohort identifier, manifest digest, request instant, and dispatched harness revision must also match.
These records are separate from the native in-memory nextest overlay.

Four real-source before/after pairs passed, with every input hash independently compared against Git.
Disposable controls rejected a wrong source, wrong harness, missing manifest digest,
tracked source mutation, and a tampered retained input hash.
All original consumer command bodies remain present in order.
Targeted YAML/TOML formatting checks passed.

Disposable PowerShell controls exercised both copied subprobe bodies in an immutable official container.
Actual cgroup limits were `2147483648` memory bytes and `200000 100000` CPU quota/period.
The merged positive passed and its wrong-version control failed.
The uncaptured positive emitted the expected line.
Its wrong-version control also exited successfully but failed stdout acceptance,
proving that command completion cannot substitute for output evidence.
These Linux fixture controls do not establish Windows GUI console behavior.
The shared cloud replay must verify the exact source binary at that boundary.

## Clippy comparison

The native route invokes `//package/music-player/desktop-app:lint:clippy` directly.
Its command is `cargo clippy --release --all-targets -- -D warnings`.
GHA run `38847322559`, log line `2888`, records the same command.
Linux runs `km2xkxwpjs` and `63r0kzrsmn` passed their exact-source Clippy tasks.
The macOS and Windows `implicit_return` failures remain recorded in issue `#372`.
Matching command flags do not establish a platform cause.

## Complete-graph acceptance

Freeze one complete manifest covering the other selected routes as well as these routes before dispatch.
Use the same `cohort_id`, `manifest_sha256`, and `requested_at` for every request.
Verify remote refs and actual provider harness/source identities against that manifest.
Retain artifact digests, all selected test identities or real compilation blockers,
each independent consumer result, provider intervals, and allocation.
Measure the shared request interval through the last required terminal outcome.

Historical failures remain valid observations.
Development runs and successful repeats support diagnosis but cannot be combined into complete-graph latency.
No application source fixes are included.
