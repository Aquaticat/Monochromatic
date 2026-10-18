# Ship third-party license notices with every music player release

## Status

Accepted 2026-10-15,
for the parts the agent was asked to decide (the tooling,
the allow-lists and where the
notices go).
Two choices were made by default and stay open to the owner's veto:
the Slint license this project uses (GPL-3.0-only,
see [Slint](#slint)),
and the source offer for the desktop programs (see [Open decisions](#open-decisions)).
The in-app surface waits for a design decision (see [In-app surface](#in-app-surface)).

## Context

`.github/workflows/music-player-release.yml` (decision:
`music-player-releases.md`) released the desktop programs and
the Android APK with no third-party license notices.
Before this change:

- The Linux and Alpine archives held `LICENSE` (the LGPL-3.0 text) and nothing else about licenses;
  the LGPL is a set of additional permissions on top of the GPL version 3,
  and the GPL text was not shipped.
- The Windows executables,
  the disk image and the APK carried no license text at all.
- Every desktop program links about 350 to 440 third-party Rust crates (MIT,
  Apache-2.0,
  BSD,
  MPL-2.0,
  Slint and
  others),
  the Rust standard library,
  the bundled Inter typeface (SIL OFL 1.1) and the Material Symbols icons
  (Apache-2.0).
  The Windows GNU program also links the MinGW-w64 runtime statically.
- The APK contains 121 Android library artifacts (Compose,
  Media3,
  WorkManager,
  Kotlin,
  Guava and their
  dependencies) and a native library with about 194 Rust crates and libopus.

Most of those licenses ask that their copyright notice and license text travel with every binary copy
(MIT,
BSD,
ISC,
Zlib,
Boost,
OFL),
the Apache License 2.0 also asks for the license text and any NOTICE file
(section 4),
and the GPL and the LGPL ask for their own text.

## Decision

### Slint

The desktop programs are built with Slint 1.18.1,
whose crates declare
`GPL-3.0-only OR LicenseRef-Slint-Royalty-free-2.0 OR LicenseRef-Slint-Software-3.0`
(the `LICENSES/` folder of the `slint` crate).
Nothing in `package/music-player` chose one of the three before this decision.
This decision uses Slint under **GPL-3.0-only**,
the same default the IDE package chose on 2026-10-06
(`package/desktop-app/ide/about.toml`),
open to the owner's veto.

What GPL-3.0-only means for the releases:

- The program's own code stays LGPL-3.0-or-later.
  LGPL-3.0-or-later code may be combined with GPL-3.0 code,
  and the combined desktop program is distributed under the
  GPL version 3.
  The release notes and the notice files say so.
- Every other license in a desktop program must be compatible with the GPL version 3.
  That is what the desktop allow-list encodes (see [Allow-lists](#allow-lists)).
- The GPL text must accompany each program:
  the notice file carries it twice,
  once as the text the LGPL supplements and
  once as the license of the Slint crates.
- Section 6 asks for the Corresponding Source.
  The release notes point to the tagged tree of the same repository,
  and each crate's notice names the exact
  crates.io version.
  crates.io keeps published versions,
  but its usage policy lets an owner delete a crate under narrow conditions
  (published less than 72 hours ago,
  or a single owner,
  fewer than 1,000 downloads a month and no reverse dependencies;
  in exceptional cases on request to the crates.io team),
  and the GPL keeps the distributor responsible for the source staying available.
  Whether to attach a vendored source archive to each release is an [open decision](#open-decisions).

The alternatives Slint offers,
and why they are not the default:

- Royalty-free license 2.0,
  attribution option (a):
  show the `AboutSlint` widget in an About screen reachable from the
  top-level menu,
  or in a splash screen.
  The accepted design has neither (see [In-app surface](#in-app-surface)),
  so this option is not available without a
  new design decision.
- Royalty-free license 2.0,
  attribution option (b):
  show the Slint attribution badge on a public web page,
  preferably
  where the binaries are downloaded.
  The release notes could carry it.
  It would keep the desktop programs under the LGPL and drop the GPL obligations above,
  at the price of a badge in
  every release.
  The owner can choose it;
  the change is one line in the notes,
  removing `GPL-3.0-only` from `desktop-app/about.toml`
  (the Slint crates then resolve to `LicenseRef-Slint-Royalty-free-2.0`,
  which has to be added there) and the intro
  text of `desktop-app/bin/third-party-notices.mjs`.
- Slint Software License 3.0 (commercial):
  a paid license;
  not considered.

### Tooling

- Rust crates (both apps):
  **cargo-about 0.9.2**,
  the tool the IDE package already uses
  (`package/desktop-app/ide/about.toml`;
  its README records the vetting).
  It runs from the repository's mise tools (`cargo:cargo-about` in `mise.no-env.toml`,
  the version in `mise.lock`),
  so no new crate enters either app.
  `--frozen --fail` reads only local sources and stops on a license outside the accepted list or one it cannot
  determine.
- Android libraries:
  **licensee 1.14.1** (`app.cash.licensee`,
  Apache-2.0).
  It reads the license of every artifact of the release runtime classpath from its Maven metadata,
  offline,
  fails `licenseeAndroidRelease` on a license outside its allow-list,
  and writes `artifacts.json`.
  It was run against this build's AGP 9.4.1 and Gradle 9.8.1 before adoption:
  it listed 121 artifacts,
  exactly the 124 `group:artifact` entries of `:app:dependencies --configuration
  releaseRuntimeClasspath` minus the three BOMs,
  all Apache-2.0,
  and with `allow("MIT")` in place of `allow("Apache-2.0")` it failed with 121 errors.
- NOTICE files of the Android libraries:
  a Gradle task in `app/build.gradle.kts` (`collectAndroidLibraryNotices`)
  reads the Java resources of the release libraries.
  APK packaging drops `META-INF/NOTICE*`,
  so without it the Apache section 4(d) notice of kotlinx.coroutines (shipped
  inside `androidx.concurrent:concurrent-futures-ktx`) would be lost.
  It found that one NOTICE file among 84 library archives;
  a scan of the archives in the Gradle cache found the same.
  That scan covered all 121 libraries licensee lists:
  83 have their own `.aar` or `.jar`,
  and 38 are Kotlin Multiplatform modules whose Android files are the `-android` or `-jvm` variant,
  each opened together with the `classes.jar` and `libs/*.jar` inside every `.aar`.
- One script writes both notice files:
  `package/music-player/desktop-app/bin/third-party-notices.mjs`,
  run by the `notices` mise task of each app.

### What a notice file holds

In order:

1. The program's own license:
   the LGPL-3.0 text (repository `LICENSE`) and the GPL-3.0 text it supplements.
2. Assets:
   the Inter typeface with its OFL 1.1 notice (desktop only) and the Material Symbols icons with the
   Apache-2.0 text.
3. The Rust standard library:
   the notice the pinned toolchain ships (`share/doc/rust/COPYRIGHT-library.html`,
   part of
   the `rustc` component),
   converted to text.
4. Desktop only:
   the MinGW-w64 runtime (Zope Public License 2.1 text,
   `desktop-app/notices/mingw-w64-runtime.txt`,
   from mingw-w64 13.0.0) and winpthreads (`desktop-app/notices/winpthreads.txt`,
   from
   `mingw-w64-libraries/winpthreads/COPYING`),
   which only the Windows GNU program links.
   libgcc is under the GCC Runtime Library Exception,
   which asks for no notice.
5. Android only:
   the Android libraries by license,
   with each `group:artifact:version`,
   the license text,
   and the
   collected NOTICE files.
6. Every Rust crate,
   one entry per distinct license text,
   with the crates it covers by name and version and whether
   the text came from the crate's own file or is the standard SPDX text.

One desktop file covers every desktop target (the `targets` list of `desktop-app/about.toml`,
with the
`alsa-fallback` feature of the Alpine builds),
so a program's notice also names crates only another platform links.
That over-inclusion is harmless;
the reverse cannot happen,
because the script checks every target.

### Allow-lists

Desktop (`package/music-player/desktop-app/about.toml`),
in the order cargo-about prefers for a crate offered under
several licenses:
MIT,
Apache-2.0,
ISC,
BSD-2-Clause,
BSD-3-Clause,
Zlib,
Unicode-3.0,
BSL-1.0,
MPL-2.0,
CC0-1.0,
Unlicense,
GPL-3.0-only.
Each is compatible with the GPL version 3,
which the desktop programs are distributed under:

- The Free Software Foundation's license list calls MIT (Expat),
  ISC,
  the 2- and 3-clause BSD licenses,
  zlib,
  the Unicode License v3,
  the Boost Software License,
  CC0 and the Unlicense lax permissive licenses compatible with
  the GPL.
- Apache-2.0 is compatible with the GPL version 3 (not version 2).
- MPL-2.0 is compatible through its section 3.3 unless a file is marked "Incompatible With Secondary Licenses".
- GPL-3.0-only is Slint's.

MIT is first because the crates' own MIT files carry the copyright lines that license asks to reproduce
(the IDE measured the same ordering against Apache-2.0 first and BSD-3-Clause first).
GPL-2.0-only,
the SSPL,
and licenses with field-of-use or non-commercial limits can never be added.
`cfg_block` (through Turso) declares only `license-file = "LICENSE"`;
the file is the Apache-2.0 short notice,
and a `clarify` entry with the file's SHA-256 records that,
so a changed file stops the task for review.

Android native crates (`package/music-player/android-app/rust/about.toml`):
the same list without GPL-3.0-only.
The APK contains no Slint and stays LGPL-3.0-or-later,
so every entry must be compatible with the LGPL version 3;
a GPL-only crate would turn the APK into a GPL work,
which needs a decision first.

Android libraries (`licensee` block in `android-app/app/build.gradle.kts`):
Apache-2.0 only.
Every library in the release classpath uses it,
and the notices script holds its full text.
Adding a license needs both a compatibility check against LGPL-3.0-or-later and its text in the script (an MIT library,
for example,
needs its own copyright line,
which Maven metadata does not carry).

### Where the notices go

- Every desktop program embeds the desktop file:
  `build.rs` copies the file named by
  `MUSIC_PLAYER_THIRD_PARTY_LICENSES` into the build,
  `src/licenses.rs` embeds it,
  and `music-player --licenses` prints
  it and exits without opening a window.
  A build without the variable embeds a short note that names the task,
  so development builds need no cargo-about;
  with `MUSIC_PLAYER_REQUIRE_THIRD_PARTY_LICENSES=true` (the release workflow) a missing file fails the build.
- The Linux and Alpine archives hold it as `THIRD-PARTY-LICENSES.txt` next to `LICENSE`.
- The disk image holds it beside the app and inside the bundle (`Contents/Resources/THIRD-PARTY-LICENSES.txt`,
  sealed by the ad-hoc signature),
  plus `LICENSE.txt`.
- The Windows programs are single files,
  so their notices are the embedded copy and a release file of their own,
  `music-player-<version>-desktop-third-party-licenses.txt`.
  The embedded copy reaches a Windows user only from a terminal:
  a double-click opens no console,
  and PowerShell's `>` leaves an empty file for a GUI-subsystem program
  (`doc/decision/music-player-windows-gui-subsystem.md`),
  so the README and the release notes name `| Out-File`,
  `cmd.exe` redirection and the release file.
  The release workflow's check runs `--licenses` under bash.
- The APK holds the Android file as `assets/THIRD-PARTY-LICENSES.txt`
  (`ThirdPartyLicensesAssetTask` in `app/build.gradle.kts`,
  release variant only),
  and it is the release file `music-player-<version>-android-third-party-licenses.txt`.
- Both release files are attested and listed in `SHA256SUMS` like every other file.

### Release workflow

- The `notices` job runs once on Ubuntu before the desktop jobs:
  it installs Rust,
  node and cargo-about from `mise.lock`,
  runs the desktop `notices` task,
  and uploads the file.
  It caches the cargo registry downloads (nothing is compiled).
- The desktop and Alpine jobs download it,
  build with the two variables set,
  check that `--licenses` prints it byte for
  byte and names `slint`,
  `symphonia`,
  `twox-hash` and `turso_core` (plus `windows` on Windows,
  `cpal` and `alsa` on
  Alpine),
  and package it.
- The Android job installs cargo-about with cargo-ndk,
  runs the Android `notices` task (licensee,
  the NOTICE
  collector,
  cargo-about),
  builds with `MUSIC_PLAYER_REQUIRE_THIRD_PARTY_LICENSES=true`,
  checks that the APK's asset
  equals the file and names Media3,
  Material3,
  symphonia,
  twox-hash and opusic-sys,
  and ships the file.

### In-app surface

The accepted design (`package/music-player/design/decisions.md`) names every Settings row
(D87 left the page empty;
D97,
D99 and the "Auto-play on select" record define the three rows it has now)
and has no About screen,
no menu entry and no splash screen.
Adding a Licenses row or an About screen would be new UI that no decision accepted,
so this change adds none.
The notices are reachable through `--licenses`,
the release files,
the archives and the APK asset.
An in-app surface (a Licenses or About row in Settings that shows the embedded text) needs a design decision;
it is
also what Slint's royalty-free option (a) would need.

## Measurements

Taken on 2026-10-15 at the branch `feat/music-player-license-notices`:

- Desktop:
  cargo-about covered 570 crates in 253 license texts.
  Third-party crates linked per target (`cargo tree --edges normal,no-proc-macro --features alsa-fallback`,
  path crates
  left out):
  438 on x86_64 Linux glibc and musl,
  437 on aarch64 Linux glibc and musl,
  362 on aarch64 macOS,
  350 on
  x86_64 Windows MSVC and GNU,
  348 on aarch64 Windows;
  501 across all targets,
  every one of them in the notices.
  The other 69 crates cargo-about lists are reached only through procedural macros.
  With procedural-macro edges,
  `cargo tree` names 576 crates across the targets;
  the 8 of those that cargo-about
  leaves out (rayon,
  rayon-core,
  crossbeam-deque,
  rspolib,
  natord,
  snafu,
  snafu-derive,
  toml_writer) are compile-time
  dependencies of procedural macros,
  none linked.
  The file was 1,998,225 bytes then and is 2,004,190 bytes on 2026-10-18 after merging `main`;
  the Rust standard library notice is about 1.4 MB of it.
- Android native:
  232 crates in 118 license texts;
  193 linked on aarch64,
  194 on x86_64,
  all covered.
  The APK's file is 1,748,650 bytes.
- Positive controls:
  removing `GPL-3.0-only` from the desktop allow-list made cargo-about exit 1 naming the Slint
  crates;
  `allow("MIT")` alone made `licenseeAndroidRelease` fail;
  a desktop build with
  `MUSIC_PLAYER_REQUIRE_THIRD_PARTY_LICENSES=true` and no file failed in `build.rs`.

Re-run on 2026-10-18 at the branch head after merging `main` (each number from a command run that day):

- Desktop: the `notices` task covered 570 crates in 253 license texts.
  `cargo tree --edges normal,no-proc-macro --features alsa-fallback --target x86_64-unknown-linux-gnu` names 440
  lines, 2 of them path crates (`music-player`, `truepeak-core`), so 438 third-party crates, all in the file
  (the task reports 438 for that target).
  The union over the eight targets is 501 and, with procedural-macro edges, 576; the only ones of those 576 that
  the file lacks are the 8 compile-time dependencies of procedural macros named in the 2026-10-15 measurement
  (rayon, rayon-core, crossbeam-deque, rspolib, natord, snafu, snafu-derive, toml_writer).
  `twox-hash 2.1.5`, `slint 1.18.1`, `symphonia 0.6.1` and `turso_core 0.8.2` are entries of the file.
- A debug build with the file embedded prints it byte for byte with `--licenses` (2,004,190 bytes), also into a closed
  pipe with exit status 0.
  Removing `GPL-3.0-only` from a copy of `about.toml` made cargo-about exit 1 with
  `failed to satisfy license requirements` for the Slint crates.
  Building with `MUSIC_PLAYER_REQUIRE_THIRD_PARTY_LICENSES=true` and no file failed in `build.rs`.
- Android: `:app:dependencies --configuration releaseRuntimeClasspath` lists 124 `group:artifact` entries and
  `artifacts.json` of `licenseeAndroidRelease` (forced to rerun) 121, all Apache-2.0; the three missing are
  `compose-bom`, `kotlinx-coroutines-bom` and `kotlinx-serialization-bom`.
  With `allow("MIT")` in place of `allow("Apache-2.0")` the task failed.
  The notice file (1,748,650 bytes) names `media3-session`, `material3`, `kotlinx-coroutines-core`, `guava`,
  `work-runtime`, `symphonia`, `twox-hash` and `opusic-sys`; the NOTICE collector read 1 file from 84 libraries.
  The desktop and Android verification tasks passed on that head:
  1,466 nextest tests (1 skipped), clippy and `lint:slint` clean, detekt and `lintDebug` clean,
  1,289 Android unit tests with 0 failures in 127 result files.

## Consequences

- A dependency update that brings in a license outside an allow-list fails the release (and the `notices` tasks) until
  someone reviews it.
- Every desktop binary grows by the size of the notice file (about 2 MB) and the APK by about 1.7 MB.
- A local `mise run //package/music-player/desktop-app:build` embeds the short note,
  not the notices;
  run the
  `notices` task and set `MUSIC_PLAYER_THIRD_PARTY_LICENSES` to get them.
- The desktop release path depends on one more job,
  which runs before the build jobs.

## Open decisions

- Slint license:
  keep GPL-3.0-only (the desktop programs are GPL-3.0 combined works) or switch to the royalty-free
  license with the attribution badge in the release notes (programs stay LGPL).
- Source offer for GPL-3.0:
  rely on the tagged tree plus crates.io,
  or attach a `cargo vendor` archive of the exact
  crate sources to every release.
- In-app surface:
  whether Settings (both apps) gets a Licenses or About row;
  needs a design decision.

## Alternatives rejected

- cargo-deny `licenses`:
  checks licenses against an allow-list but writes no notice file;
  cargo-about does both,
  and
  the repository already uses it.
- cargo-bundle-licenses:
  writes a license list but has no allow-list failure and is not used in the repository.
- A committed,
  generated notice file checked by a task:
  it would avoid the extra job,
  but every dependency update
  would have to regenerate a 2 MB file in the same commit,
  and the release would fail on a stale one.
- Generating the notices in every desktop job:
  cargo-about would have to run on six runners and inside the Alpine
  container;
  one Linux run covers every target.
- AboutLibraries 15.3.0 (Android):
  run on the same build,
  its strict mode also failed on a disallowed license,
  but it
  merges the per-platform artifacts (86 entries against licensee's 121),
  fetches license texts from the network unless
  `offlineMode` is set (and then has none),
  and adds `res/raw/aboutlibraries.json` for a UI library this app does not
  use.
  licensee is offline by design and lists exactly what the classpath contains.
- Google's oss-licenses-plugin:
  no allow-list failure,
  and showing its output needs the Play services
  `play-services-oss-licenses` library and its activity,
  which the design does not have.
