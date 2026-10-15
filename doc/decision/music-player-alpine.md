# The desktop music player runs on Alpine Linux as a dynamically linked musl build

## Status

Accepted 2026-10-14.

## Context

The requirement from the user: "Our app must run on Alpine."
The app is the desktop music player, `package/music-player/desktop-app` (Rust and Slint).
Before this decision its Linux build targeted glibc only.
Alpine differs from the Fedora target in four ways that matter here:

- It uses musl libc, not glibc, and ships its own Rust toolchain whose host triple is `x86_64-alpine-linux-musl`
  (`aarch64-alpine-linux-musl` on arm64).
- Packages come from apk, and a plain install has no systemd or logind, so nothing creates `XDG_RUNTIME_DIR`.
- No sound server runs by default: no PipeWire and no PulseAudio.
- No desktop portal and no notification daemon are installed by default.

Android is out of scope.
Everything below was run, not recalled: Alpine 3.24.2 (`docker.io/library/alpine`, index digest
`sha256:294b683cb724975bec92580e1e685676bd4b50bda910ddb8c51d4cabeaec77e6`, the stable release on 2026-10-14),
rustc 1.96.1 from Alpine's own package, podman 5.8.7 on an x86_64 host, and the architecture-native GitHub runners
for x86_64 and aarch64.

## Decision

The Linux musl target is a dynamically linked build made with Alpine's own Rust toolchain,
with the `alsa-fallback` cargo feature on,
and it is guarded in CI on x86_64 and aarch64 by `.github/workflows/music-player-alpine.yml`.

### Static versus dynamic

A fully static musl binary is rejected.
Two measurements decide it.

The static link fails.
`RUSTFLAGS="-C target-feature=+aes,+crt-static" cargo build --target x86_64-alpine-linux-musl` compiles every crate
and then fails at the final link:

```text
// log excerpt: /home/user/temp/agent/alp/static-1.log, 2026-10-14
ld: cannot find -lfontconfig: No such file or directory
ld: cannot find -lfreetype: No such file or directory
ld: cannot find -lpipewire-0.3: No such file or directory
```

Alpine ships no static `libfontconfig.a`, `libfreetype.a` or `libpipewire-0.3.a`, and the `pipewire` crate links the
PipeWire client library, which itself loads its SPA plugins at run time.

A static musl program cannot open a shared library even if the link had worked.
A four-line C program that calls `dlopen("libwayland-client.so.0")` printed:

- statically linked (`gcc -static`):
  `Dynamic loading not supported`
- dynamically linked, same source, same container:
  `loaded`

winit and Slint open `libwayland-client`, `libxkbcommon`, the X11 libraries and EGL with `dlopen`,
so a static binary could never create a window.
Alpine's `rustc` already defaults to a dynamic musl link,
so no flag is needed: `-C target-feature=-crt-static` is the default there,
and the dynamic build is the one every measurement below uses.
The consequence is that the binary runs only on musl systems with the runtime packages listed below,
which is the requirement.

### Rust toolchain

Alpine's own `rust` and `cargo` (1.96.1) are used, not a musl-hosted rustup toolchain.
The repository pins no toolchain file for this package, Slint 1.18 needs a recent stable,
and the Alpine package builds natively on both architectures with no download from outside the Alpine mirrors.
Alpine's `rustc` has the host triple `x86_64-alpine-linux-musl`,
a different name from rustup's `x86_64-unknown-linux-musl`.

### Code changes the build and run revealed

Each was found by running the Alpine build or the app, not by reading.

1. `gxhash` refuses to compile without the `aes` target feature.
   `package/music-player/desktop-app/.cargo/config.toml` listed only gnu, macOS and Windows triples,
   so an Alpine build stopped with `Gxhash requires aes and sse2 intrinsics`.
   One `[target.'cfg(all(target_os = "linux", target_env = "musl"))']` table now adds `-C target-feature=+aes`,
   which matches every musl Linux triple including both Alpine host triples.
   The cache fingerprint is identical across architectures: the same 11 inputs gave the same 11 hashes on x86_64
   and aarch64 (aarch64 under qemu), so a peak cache written on one architecture reads on the other.
2. The background sweep silently stayed at normal priority.
   musl's `sched_setscheduler` always returns -1 with errno 38 (ENOSYS), measured with a C program;
   the raw system call returns 0 in the same container.
   `src/measure.rs` now calls the system call directly, which has the same per-thread meaning on glibc and musl,
   zeroes `sched_param` (the struct literal does not compile on musl, which has extra `sched_ss_*` fields),
   and logs the OS error if the call fails.
   A test reads the scheduling policy back from the kernel.
3. Linux audio was PipeWire only.
   With no PipeWire daemon the engine logged `audio init failed; degrading to silent mode` and played nothing,
   and on Alpine no daemon runs by default.
   A new cargo feature `alsa-fallback` (off by default, so every other Linux build is unchanged) makes
   `output::Output` try PipeWire first and the default ALSA device second, through cpal and the existing
   `output_cpal.rs` (`src/output_linux.rs`).
   The Alpine build turns it on.
4. The window said nothing when no audio output could be opened.
   The engine now sends `Update::AudioUnavailable` and the window shows a message that names PipeWire and ALSA
   and says to restart the player.
5. `output_cpal.rs` failed the repository's `implicit_return` clippy rule once it compiled on Linux,
   so its five implicit returns are explicit.

One finding needs a prerequisite, not a code change.
With fontconfig present but no font installed, `fontique` panics (`NoMatch`) the first time text is laid out.
It failed 227 of the UI tests and the app at startup, and it is not Alpine specific, but a minimal Alpine has no font.
Installing any font fixes it (`font-dejavu` is the small one), so the runtime list below includes one.

### Runtime packages

The list a person installs to run the app on a Wayland desktop:

```sh
apk add fontconfig font-dejavu pipewire-libs libgcc wayland-libs-client libxkbcommon \
  mesa-egl mesa-gles mesa-dri-gallium alsa-lib
```

Why each is there is written beside the `runtime` stage of `package/music-player/desktop-app/Containerfile.alpine`,
and the `smoke` stage builds on exactly this set.
The binary's direct dependencies are `libfontconfig`, `libpipewire-0.3`, `libgcc_s` and musl;
the rest are opened at run time.
Beyond this list a person needs a compositor, and for sound either PipeWire with a session manager
(`apk add pipewire wireplumber`) or an ALSA device.
Optional: `dbus` for a session bus (notifications, appearance), and `zenity` for the folder chooser.

### What was run in Alpine, with what result

The window, input, audio and notification checks ran inside Alpine containers with explicit podman bounds
(`--memory=3g --cpus=4`), with the app hosted in this repository's nested compositor
(`package/cli/nested-wayland-session`, built from source on Alpine, headless, `--gpu software`, so Mesa's llvmpipe).
The library was invented tones, never a person's own files.

- Start: the binary prints its normal startup logs.
  Without a display it fails with winit's message (`neither WAYLAND_DISPLAY nor WAYLAND_SOCKET nor DISPLAY is set`).
- Window: the compositor's screenshot shows the full UI at 1280x720: folder rail, track list, transport.
  A click sent through the compositor's control socket on "Open folder" showed the chooser message below.
- PipeWire: with `pipewire` and `wireplumber` started in the container and a null sink,
  the app's stream `music-player` (`Stream/Output/Audio`) was linked to the sink and running,
  and a recording of the sink's monitor held a 440.0 Hz tone for 8.4 seconds.
- ALSA fallback: with `PIPEWIRE_CORE` moved so the app's PipeWire connection fails, the log said
  `PipeWire is unavailable; trying the default ALSA device` then `audio output: the default ALSA device`,
  and the stream (`alsa_playback.music-player`) reached the null sink through `pipewire-alsa`,
  recorded as 439.9 Hz.
  A free-running `null` ALSA PCM (no clock) drains the ring buffer far faster than real time and the capture it
  produced held only zeros; the paced device above is the evidence for the ALSA path.
- No audio device at all: the app starts, logs one warning, and the window shows
  "No sound output is available, so nothing will be heard. Start a sound server such as PipeWire, or set up an ALSA
  sound card, then restart the player."
- Notifications: with no notification service the app logs one warning (`analysis progress indicator unavailable`)
  and runs.
  With the compositor's recording service (`--notifications freedesktop`), the Notify calls were captured:
  "Cannot play a file" for a corrupt file, and the "Analyzing true peak" progress from 0 of 3 to 3 of 3.
- Folder chooser: with no desktop portal and no `zenity`, "Open folder" shows
  "This computer has no folder chooser for the player to open. Install zenity, or start the player with a folder:
  music-player /path/to/music".
  After `apk add zenity` the click opened a real `zenity` folder chooser as a second window of the compositor.
- State on disk: the session (`session.json`) and the peak cache (`decisions.db`) are written under
  `$XDG_CONFIG_HOME/musicplayer`, with `XDG_CACHE_HOME` and `XDG_DATA_HOME` pointed at throwaway directories.
- The X11 path was not tested: the repository's compositor hosts Wayland clients only.

Unit tests inside Alpine: `cargo nextest run --features alsa-fallback`, 1410 run, 1410 passed, 1 skipped.
The host baseline on glibc is 1406 passed, 1 skipped, before the four tests this change adds.
The notification tests need `dbus-daemon` (apk `dbus`) and the UI tests need a font.

### The compositor needed no change

`monochromatic-nested-wayland-session` 0.6.0 built unmodified on Alpine (musl, both architectures in CI),
started headless without a GPU or a seat, and offered every control the checks used:
`screenshot`, `click`, `windows`, `notification-log`, `ping`, `quit`.
Its socket lives under `XDG_RUNTIME_DIR` like any other.
It needs `mesa-egl mesa-gles mesa-dri-gallium wayland-libs-server libdrm libxkbcommon` at run time.
No version bump is needed.

### Continuous integration

`.github/workflows/music-player-alpine.yml` runs on pull requests and on pushes to main that touch the player, its
true-peak core, the compositor or the workflow, and on manual dispatch.
Each architecture runs natively (`ubuntu-latest` and `ubuntu-24.04-arm`) and:

1. builds `Containerfile.alpine` (targets `build` and `smoke`),
2. runs the nextest suite with `--features alsa-fallback`,
3. builds the app and builds the compositor from source in the container,
4. runs `music-player-smoke` in the `smoke` image: three scenarios (no audio, ALSA, PipeWire), each asserting the
   first screen was drawn, no panic, a non-blank screenshot, and the audio line for that scenario.

Caching: `CARGO_HOME`, the app target directory and the compositor target directory are bind-mounted from
`.ci-cache`, restored with `actions/cache/restore` and saved with `actions/cache/save`, only from runs on main or
manual dispatch.
The key is the runner architecture, the Alpine `rustc` version with a hash of the `-dev` package versions, and the
two lockfile hashes.
The restore key is the same without the lockfile hash, so a changed lockfile rebuilds only the crates that changed.
`CARGO_INCREMENTAL=0` and `CARGO_PROFILE_DEV_DEBUG=0` keep the entries lean.
The local equivalent is `mise run //package/music-player/desktop-app:test:alpine`.

## Release artifact the release workflow should add

A separate release workflow (`.github/workflows/music-player-release.yml`, not edited here) should add an Alpine job
next to the glibc Linux job.
Artifact names: `music-player-<version>-linux-musl-x86_64.tar.gz` and `music-player-<version>-linux-musl-aarch64.tar.gz`,
where `<version>` is the `version` in `package/music-player/desktop-app/Cargo.toml`.
Each archive holds one directory of the same name containing `music-player` and the license texts from `LICENSES`.

Job steps, run once per architecture on `ubuntu-latest` (x86_64) and `ubuntu-24.04-arm` (aarch64), with
`permissions: contents: read, id-token: write, attestations: write`:

1. Checkout with `actions/checkout`, `persist-credentials: false`.
2. Build the image:
   `podman build --target build --tag music-player-alpine-build --file package/music-player/desktop-app/Containerfile.alpine "$(mktemp -d)"`.
3. Build in the container with the shipping profile (thin LTO, stripped) and the feature:
   `podman run --rm --memory=12g --cpus=4 --security-opt label=disable --volume "$PWD/package/music-player:/src:ro"`
   `--volume "$RUNNER_TEMP/cargo:/cargo" --volume "$RUNNER_TEMP/target:/target" --env CARGO_HOME=/cargo`
   `--env CARGO_TARGET_DIR=/target --env SLINT_ENABLE_EXPERIMENTAL_FEATURES=1 --workdir /src/desktop-app`
   `music-player-alpine-build cargo build --release --locked --features alsa-fallback`.
4. Verify the libraries, not just the link: build the `runtime` stage
   (`podman build --target runtime --tag music-player-alpine-runtime ...`) and run
   `music-player --version` in it with the binary bind-mounted, which fails if the runtime package list is short.
5. Optionally run the smoke test (the `smoke` image) against the release binary.
6. Package: copy the binary and `package/music-player/desktop-app/LICENSES/*` into
   `music-player-<version>-linux-musl-<arch>/`, then `tar --create --gzip --file music-player-<version>-linux-musl-<arch>.tar.gz`.
7. Attest with `actions/attest-build-provenance`, `subject-path` the tarball.
8. Upload with `actions/upload-artifact`, name `music-player-<version>-linux-musl-<arch>`.

The release notes should say: needs Alpine 3.24 or newer on musl, x86_64 or aarch64, and one line to install:
`apk add fontconfig font-dejavu pipewire-libs libgcc wayland-libs-client libxkbcommon mesa-egl mesa-gles mesa-dri-gallium alsa-lib`.
They should also say that without PipeWire the player uses the default ALSA device, and that an aarch64 CPU must have
the ARM crypto extension (see the consequences).

## Consequences

- The musl binary runs only on musl systems with the listed packages; a glibc binary does not run on Alpine and the
  reverse. Each architecture needs its own build, which the release job above does natively.
- The musl build needs a CPU with AES acceleration: x86_64 AES-NI, or the ARM crypto extension on aarch64.
  `gxhash` has no software fallback, so a CPU without it fails with an illegal instruction at run time.
  A Raspberry Pi 3 or 4 does not have the ARM crypto extension.
  This was not run on such a device, and the same limit already applies to every other `gxhash` build.
- Without a portal or `zenity` there is no native folder chooser.
  The app says so in the window and the folder can be passed on the command line.
- The ALSA fallback is behind a cargo feature, so the glibc Linux build is unchanged and still PipeWire only.
  Enabling the feature for glibc Linux is a separate decision (it adds `libasound` as a link-time dependency).
- Notifications and appearance need a D-Bus session bus, which minimal Alpine lacks;
  without one the app logs a warning and runs.
- `XDG_RUNTIME_DIR` must exist for Wayland and PipeWire.
  Alpine creates it with `elogind` or by hand: `mkdir -p /tmp/xdg-runtime && chmod 700 /tmp/xdg-runtime` and export it.
- `cargo clippy` on Alpine's stable 1.96.1 reports `manual_range_contains` in `src/oklch.rs`,
  a rule the repository's nightly host toolchain does not flag; the Alpine guard therefore runs tests and builds,
  not clippy, and the lint was not loosened.
- Not verified: real Alpine hardware, other desktops and compositors (only this repository's compositor was used),
  Alpine edge, postmarketOS, the X11 path, and Raspberry Pi class CPUs.
