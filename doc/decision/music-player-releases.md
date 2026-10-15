# Release the music player from CI as GitHub pre-releases

## Status

Accepted 2026-10-14.
Owner-authorized: the owner asked for the release automation and answered the design questions below
in the session that built it.
The first real release is a separate act that needs the owner's go-ahead (see the consequences).

## Context

The owner asked for GitHub CI to release the music player automatically and put `.exe`, `.dmg`,
the Linux files and an `.apk` in GitHub releases.
Before this, the product had no release path:
`package/music-player/android-app` signed its release APK with the debug key,
`doc/decision/desktop-app-code-signing.md` described a manual, off-CI signing chain whose credentials do not exist yet
and deferred `.dmg` installers,
and the package README said "build from source".

The owner's answers to the design questions:

- Trigger and release shape follow the existing crate publication in `.github/workflows/cargo-publish.yml`:
  a version change merged to `main` triggers a run, a manual dispatch has a dry-run input that defaults to true,
  every file is attested, and one release job creates the release.
- Android: the owner generates a release keystore and stores it as repository secrets.
  Windows and macOS ship unsigned.
- Every release is a pre-release, because the README says the project is under active development.

Facts that constrain the design:

- Releases are immutable in this repository.
  A published release can never receive a replacement or an extra file,
  so a bad release is fixed only by a higher version (`doc/decision/forbidden-strings-windows-arm64-release-target.md`
  records the same lesson).
- The repository is public, so GitHub-hosted runners, including `windows-11-arm`, are free.
- No Windows, macOS or real-device Android build has ever been run by the project.
  Only the Linux x86_64 desktop build has been run, and the Android app has run on emulators.
- The package is planned to move to its own repository (`doc/planning/music-player-repository-extraction.md`),
  but has not moved.
  The workflow lives in this monorepo for now, and the README says so.
- The repository pins one Rust toolchain for every package in `mise.lock`:
  a dated nightly, chosen for the fuzzing crates, not because the music player needs nightly.

## Decision

### Trigger and versions

`.github/workflows/music-player-release.yml` runs on a push to `main` that changes
`package/music-player/desktop-app/Cargo.toml` or `package/music-player/android-app/rust/Cargo.toml`,
and on `workflow_dispatch` with a `dry-run` boolean that defaults to true.
Its detect job compares the version before and after the push,
as `cargo-publish.yml` does.

The product has one version.
Its single source is the `[package]` `version` of `package/music-player/desktop-app/Cargo.toml`.
The Android Gradle build reads that file:
`versionName` is the version and `versionCode` is `major * 10000 + minor * 100 + patch`,
so the two Android values cannot be edited to disagree, and the code never decreases while the version never decreases.
The detect job fails loudly when:

- the version is not plain `MAJOR.MINOR.PATCH` with minor and patch at most 99
  (a suffix would give two versions one code);
- the Android native crate's manifest carries a different version
  (the one place the Android side still states a version, and the one a person forgets to bump);
- a push lowers the version.

After the build, the Android job checks with `aapt2 dump badging` that the APK carries the computed
package name, `versionName` and `versionCode`.

The tag is `music-player-v<version>`.
If it already exists, the real release is skipped with a notice and the run succeeds:
a tag is never overwritten, and the release job re-checks the tag right before creating it.

### Safety against a bad first release

A run is real only when it is on `main` and is a push, or a dispatch with `dry-run` false.
The detect job computes `dry_run` once from the event and the ref,
refuses a real dispatch from any other ref,
and every later job reads that single output.
The workflow never relies on an empty `inputs.dry-run` to mean "real", unlike `cargo-publish.yml`:
on a push event that input is empty,
so `!inputs.dry-run` would be true on any branch that gained a push trigger.

A dry run builds, packages, verifies and signs everything,
uploads workflow artifacts that expire after one day,
and runs the release job's shell with `gh release create` replaced by a printed command,
so the command, tag, asset list and notes are visible without releasing.
It skips attestation and creates no tag and no release.

The version `0.1.0` was already in `main` before the workflow existed,
so no push will release it.
Its first release is a real dispatch from `main` after a green dry run on `main`,
and the owner decides when.

### Files

One release holds, with `<version>` filled in:

- Windows: `music-player-<version>-windows-x64.exe` and `music-player-<version>-windows-arm64.exe`,
  native builds on `windows-2025` and `windows-11-arm`.
  The `.exe` is the whole program: Slint renders without extra files, and the C runtime is linked in statically
  (`+crt-static` in `package/music-player/desktop-app/.cargo/config.toml`),
  so a clean machine needs no Visual C++ Redistributable.
  The job lists the DLLs the executable imports and fails if a Visual C++ runtime DLL is among them.
  The icon is embedded by the existing `build.rs`.
- macOS: `music-player-<version>-macos-arm64.dmg` and `music-player-<version>-macos-x64.dmg`,
  native builds on `macos-15` and `macos-15-intel`.
  Each holds `Music Player.app`, assembled by the repository's own `bundle:macos` task from `macos/Info.plist`
  (bundle id `dev.monochromatic.musicplayer`, version, icon, high-resolution flag) and `asset/music-player.icns`,
  plus an `Applications` link.
  The bundle gets an ad-hoc signature (`codesign --sign -`), which is no developer identity:
  it is not notarized, so Gatekeeper asks for confirmation on the first launch.
  This extends `desktop-app-code-signing.md`, which deferred `.dmg` installers until the signing chain was proven;
  the owner chose unsigned installers now.
  The ad-hoc signature is an addition of this change that the owner may veto.
- Linux: `music-player-<version>-linux-x64.tar.gz` and `music-player-<version>-linux-arm64.tar.gz`,
  native builds on `ubuntu-24.04` and `ubuntu-24.04-arm`.
  Each holds `bin/music-player`, the launcher file, `share/icons/hicolor/scalable/apps/music-player.svg`,
  an `INSTALL.txt` and the license, in a reproducible tar stream.
  The icon is the repository's `asset/icon.svg`, which calls itself a placeholder;
  no designed icon exists, and none was invented.
  No AppImage is shipped:
  the program links `libpipewire` and `libfontconfig` from the host,
  and bundling PipeWire's client library and its plugins is the part that cannot be validated across distributions
  from this project's single Linux machine,
  so an AppImage without them is the archive with a different wrapper and one with them is untested.
  The question can be reopened with a distribution test matrix.
- Android: `music-player-<version>-android.apk`, signed with the release key,
  holding the `arm64-v8a` and `x86_64` native libraries.
- `SHA256SUMS`, produced by a job that runs only after every build succeeded.

### Build mechanics

- The Rust toolchain is read from `mise.lock` in each job and installed with `rustup`,
  so the release never drifts from what the repository builds with,
  and one mechanism works on all six platforms.
  The Android job installs Rust, JDK 21, the Android command-line tools and `cargo-ndk` with mise (versions from
  `mise.lock`), installs the SDK components with the repository's `prepare:android` task, and builds with the existing
  `build:release` task.
- The Linux jobs install the minimal development packages found by building:
  `pkg-config clang libclang-dev cmake libpipewire-0.3-dev libspa-0.2-dev libfontconfig1-dev libfreetype-dev`.
  Windowing and GL libraries are loaded at run time and need no headers.
- Every build uses `cargo build --release --locked` (and Gradle without its build cache).
  No cache is restored or saved, and mise's tool cache is off:
  a release is built cold so that the attested bytes cannot depend on an earlier run.
  The cost is a longer run, which a release can afford.
- Each desktop binary is started with `--version` on its own runner, and the output must be the product version.
  This is the only run any non-Linux binary gets.
- `.cargo/config.toml` gained `+aes` entries for `aarch64-unknown-linux-gnu` and `aarch64-pc-windows-msvc`,
  which `gxhash` requires on every target,
  and `+crt-static` for both Windows targets.
  A CPU without AES instructions fails with an illegal instruction, as the existing comments there record.

### Attestation and checksums

Every uploaded file, including `SHA256SUMS`, is attested with `actions/attest-build-provenance`
on the exact bytes uploaded, in the job that built it (or computed the checksums).
Only those jobs hold `id-token: write` and `attestations: write`.
The release job holds `contents: write`, and nothing else does.
The release notes say how to run `gh attestation verify`.

### Android signing

The release key is a PKCS12 keystore with an RSA 4096 key,
alias `music-player-release`,
valid 36500 days,
with a neutral subject (`CN=Music Player release, O=Monochromatic`) that names no person.
It was generated on 2026-10-14 with `keytool` and a random password from the operating system,
and stored as four repository secrets:
`MUSIC_PLAYER_KEYSTORE_BASE64`,
`MUSIC_PLAYER_KEYSTORE_PASSWORD`,
`MUSIC_PLAYER_KEY_ALIAS`,
and `MUSIC_PLAYER_KEY_PASSWORD`.
A backup of the keystore and a text file with the alias and password is in `~/.local/share/music-player-release-keys`
on the maintainer's machine, for the owner to copy into the password manager.

`app/build.gradle.kts` has a `release` signing config that reads the four values from the environment or Gradle
properties.
Without them the release APK is still debug-signed, exactly as before.
With only some of them, or with `MUSIC_PLAYER_REQUIRE_RELEASE_SIGNING=true` and none, the build fails.

The workflow reads the secrets in one step of the Android job,
and only for runs on `main`.
It writes the keystore to `RUNNER_TEMP` and deletes it in a step that always runs.
Every other ref signs with a throwaway key generated for that run, with a masked random password.
On a real release the job also fails unless the APK's certificate SHA-256 equals the fingerprint written in the
workflow, so a throwaway-signed or debug-signed APK can never be published.
Dry runs on `main` sign with the real key, so the signing path is proven before a real release;
the file is a workflow artifact that expires after one day.

## Consequences

- The first real release of a version is permanent.
  A broken release can be fixed only by a higher version, and its tag stays reserved.
  The dry run on `main` and a read of its log are the guard;
  the runbook `doc/runbook/release-the-music-player.md` says how.
- Windows and macOS builds are unsigned.
  Windows SmartScreen and macOS Gatekeeper warn on the first launch,
  and the notes and the README tell users the steps.
  Signing both is possible later with the chain in `desktop-app-code-signing.md`.
- Only the Linux x86_64 build has been run by the project.
  Releases and the README say "built by CI, not yet tested on this platform" for the rest,
  and CI starts each desktop binary with `--version` and nothing more.
- Losing the Android key means installed copies can no longer be updated.
  The key lives in the repository secrets, which cannot be read back, and in the backup.
  The backup must be copied into the password manager; rotation and loss are covered in the runbook.
- The repository-level secrets are visible to any workflow with write access to the repository.
  Restricting them to a protected environment limited to `main` would close that,
  and was not requested.
- Two version-bearing manifests must be bumped together,
  and their lock files refreshed with `cargo update --workspace`,
  because the release builds with `--locked`.
- The repository's pinned Rust is a floating nightly recorded as a date in `mise.lock`.
  A date that Rust no longer serves would fail the build until `mise.lock` moves on.
- Releases are built from the workflow's commit, which is in the monorepo today.
  After the repository extraction the workflow, the secrets and the tag prefix must move with the package.
- Bundled Rust crates carry their own licenses, and no third-party notice file is generated yet.
  The archives ship the project license only.

## Alternatives rejected

- Release-please or another tool that opens version pull requests:
  the existing crate publication shows the repository's convention is a hand-edited version,
  and the owner chose to follow it.
- Cross-compiling the macOS and Windows binaries from Linux:
  fragile SDK linking (`desktop-app-code-signing.md`); native runners exist for every target and are free here.
- An environment-scoped secret store:
  the owner asked for repository secrets; see the consequences.
- A cache for compiled dependencies:
  rejected for releases because it could change the attested bytes and the saving does not matter for a release.
