# Music Player

Music Player is a native,
local-first player for people whose music library is already organised in folders.
It treats the directory tree and filenames as the library,
so an existing collection stays navigable without requiring tags,
albums,
artwork,
a server,
or an import step.

Status:
under active development.
Pre-release builds are published for download,
and the source is there to build.

Version `0.1.0` builds a Slint desktop application and a Jetpack Compose Android application.
They provide corresponding product behaviour through separate platform implementations and share true-peak metering.
Their platform UIs,
storage access,
and audio output remain native to each platform.

## Contents

- [What works today](#what-works-today)
- [Gallery](#gallery)
- [Design record](#design-record)
- [Install](#install)
- [Build from source](#build-from-source)
- [Architecture](#architecture)
- [Contributing](#contributing)
- [Related documentation](#related-documentation)

## What works today

### Library sources

A desktop library is a source root and the audio files beneath it.
Desktop recursively enumerates that root and derives each displayed row from its relative path.
Desktop watches the root while the app runs and applies the files that were added,
removed,
or renamed after a short quiet time.
It saves the root,
the selected track,
the position,
the playback mode,
and the two template texts,
but not the queue,
so a relaunch rebuilds the queue from disk.

An Android library is either a selected Storage Access Framework tree or the device-wide MediaStore collection.
The selected tree is recursive.
MediaStore queries the operating system's indexed collection rather than walking one source-root directory.
Choosing a folder through the Storage Access Framework gives that persisted folder grant priority,
including when that folder is empty.
Both Android sources preserve source-relative display paths while using opaque content URIs for playback.
Android follows its source without a user action:
a `ContentObserver` watches the MediaStore audio collection,
and a library from a folder grant is read again when the app returns to the front.

The MediaStore source admits only rows Android marks as music.
An audio-looking file whose MediaStore row lacks that classification is not part of this source,
even if its filename has an otherwise accepted extension.
Choosing a Storage Access Framework tree instead filters by the player's extension allowlist.

A library is always open.
When no session is stored,
desktop opens the operating system's music folder,
and an empty folder shows an explicit empty state.
Neither app has a refresh or re-analysis action:
the library and the true-peak measurements follow the files by themselves.

The current UI has no tag-derived browser,
facets,
artist view,
album view,
or album art.
Folder names and filenames are the visible library data.

### Browsing folders

A top-level directory is one folder in the folder list.
Tracks directly in the root are listed under virtual folders named `A` through `Z` and `#`,
chosen by the first letter of the filename.
Folders sort before the letter folders,
ignoring case,
and `#` comes last.
Directories below a folder appear as subfolder headers with their track counts in that folder's track list.
Deeper directories remain visible in a track's relative path.

A window 600 pixels wide or wider (600 dp on Android) shows two panes:
the folder list with the transport deck on one side,
and the selected folder's tracks on the other.
Each pane scrolls on its own.
A narrower window shows one pane,
with a folder button in the header that opens the folder list over the track list while the deck stays in view.
The folder list carries a rail that jumps by letter.

Desktop rows show a title cleaned from the filename,
without the extension and without text that every file of the folder starts with,
and a supporting line.
The supporting line is the track length and the true peak by default.
The Settings page edits it.

### Search

Search opens from the header button,
from `Ctrl+F`,
and on desktop from a double tap of `Shift`.
It is its own page with one header that holds Back,
the query,
and Clear.
Folders and tracks appear in one list ranked by relevance,
and the matching text is highlighted.
Matches start at the beginning of a word in a name.

Search answers from an in-memory index in each app and stays usable while a scan is still adding tracks:
the open results update in place and keep the query,
the caret,
and the scroll position.

### Playback

Both applications provide selection,
play and pause,
previous and next,
seeking,
and light and dark appearance.
Neither has a volume control in the app:
the operating system's mixer sets the level.
The transport deck shows the playing track with its folder,
the seek bar,
and the playback mode.

On both platforms,
clicking or tapping a track row that is not the current track selects it and leaves it paused,
and any track that was playing stops (D124).
Clicking or tapping the current row toggles play and pause,
which also starts a track restored from the last session.
On Android a track that failed to open stays selected and the next tap tries it again;
on desktop selecting an unreadable file reports it and moves the selection to the next playable file.
`Enter` on the focused row does the same.
The Play item of the track menu and a Search result start a track at once.

One playback mode of four applies on both platforms,
and the app saves it:

- Repeat replays the current track.
- In order plays the selected folder in name order and stops at its end,
  with the first track of that folder loaded and paused.
- Shuffle the folder shuffles the folder on screen.
- Shuffle all shuffles the whole library.

A manual Next at the last track still wraps to the first.

The Storage Access Framework source accepts these filename suffixes:
`flac`,
`wav`,
`wave`,
`mp3`,
`ogg`,
`oga`,
`opus`,
`m4a`,
`m4b`,
`mp4`,
`aac`,
`aiff`,
`aif`,
and `aifc`.
Desktop folder scans use the same list.
This extension recognition filters a library source.
It is not a decoder-support claim.
The MediaStore source relies on Android's music classification instead.

Desktop decodes FLAC,
WAV and PCM,
MP3,
Vorbis in Ogg,
Opus,
AAC-LC,
ALAC,
ADPCM,
and AIFF.
It opens each track at its native sample rate and leaves device resampling to PipeWire,
CoreAudio,
or WASAPI.

### Track menu and keyboard

Every track row has a menu with six rows:
Play,
Start shuffle from here,
File details,
Show in file manager,
Copy filename,
and Move to trash.
On desktop a right click opens it at the pointer,
and with a keyboard the `Menu` key or `Alt+Enter` opens it on the focused row.
On Android a long press opens it,
and the same two keys work with an attached keyboard.
Every row has an access letter,
drawn underlined,
that runs the row while the menu is open.
Desktop shows a row's shortcut beside it when the row has one.

Nearly every action has a keyboard shortcut,
chosen as JetBrains would choose it (D106).
Desktop draws a small key badge on each control that the held modifiers trigger,
after the modifiers have been held for 300 ms.
Keyboard focus draws a ring around the element and changes nothing else about it (D117).
The tables of keys are in [`desktop-app/README.md`](desktop-app/README.md#keyboard) and
[`android-app/README.md`](android-app/README.md#keyboard-and-focus).

### Settings

Settings lists two templates,
Track rows and Playing track,
which shape the supporting line of a track row and the line under the playing track's title.
The template language has fields and formatting functions,
and a preview shows the result for the tracks of the open library.
A window that is wide enough for two panes (the player's width test) shows the list on one side and the selected
template's editor on the other,
so selecting a row never navigates.
A narrower window shows the list,
and a row opens that template's editor page.
The page is drawn on the one canvas color,
pure white in light and pure black in dark.

### Appearance

Both apps follow the operating system's light or dark setting and its accent color.
The accent is the only color taken from the platform:
every other color is derived from it in OKLCH (D108),
and every text role is fitted to WCAG AA contrast on the surfaces it is drawn on.
Without an accent the root is the baseline `#4E5E8B`.
Dark uses a pure black canvas and light a pure white one.

### Audio safety

Playback targets attenuate-only true-peak normalisation to a `-1 dBTP` ceiling.
A track that already fits under that ceiling is not boosted.
The shared [`truepeak-core`](truepeak-core) crate owns meter and gain calculations used by both applications.

True-peak analysis is automatic and not optional.
It never shows an in-app banner (D107).
On Linux desktop it reports progress as a Plasma job on KDE,
or else as one freedesktop notification replaced in place,
and with neither it runs without an indicator.
Android posts a progress notification,
and runs without one if the notification permission is declined.
macOS and Windows have no indicator yet.
Desktop stores opaque peak-cache fingerprints rather than filenames,
paths,
or tags.
It measures non-current tracks in a background sweep and uses a bounded current-track measurement path.

### Platform integration

The desktop build uses Slint with winit on every desktop target.
Linux targets Wayland and uses PipeWire,
with no ALSA or PulseAudio backend.
macOS targets Apple Silicon and uses CoreAudio.
Windows targets `x86_64` and `arm64` and uses WASAPI through cpal.
Only the Linux `x86_64` build has been run by the project;
the other desktop targets are built by CI and have not been tested on their platform.

The desktop source implements LauncherEntry D-Bus taskbar progress on Linux and native taskbar progress on Windows.
These shell integrations are best-effort and are not shown in the gallery.

The Android build declares API 26 as its minimum SDK and API 36 as its target SDK.
Its Kotlin layer owns permissions,
MediaStore and Storage Access Framework access,
persistence,
a MediaSession,
audio focus,
and foreground-service lifecycle.
Its Rust engine decodes,
measures true peak,
and drives AAudio.
Background playback is available through Android media controls,
including the notification and lock screen.
The first launch asks for audio access before the library is read.
If access is declined,
the app says so and offers to open a folder instead.

## Gallery

The gallery has a desktop section and an Android section.
Each says how its captures were taken.

### Desktop

Every capture is a screenshot of the release build in the repository's nested Wayland compositor,
taken with the session helpers of [`desktop-e2e`](desktop-e2e).
Audio went to a private PipeWire null sink,
and the app and the compositor ran in their own systemd user unit.
The library is synthetic:
invented artist folders and track names with generated tones.
The accent is `#4E5E8B`,
and the PNGs were stripped of capture metadata.
Captures hold the application window only,
with no system bars or notifications.
The only paths visible are synthetic and relative to the library.

#### Two panes

Wide windows show the folder list and the transport deck on one side,
and the selected folder's tracks on the other.
The playing track has bold text,
a soft fill,
and a bar on its leading edge,
so it does not rely on color alone.
The mode group under the seek bar offers Repeat,
In order,
Shuffle the folder,
and Shuffle all.

![Two-pane window in light appearance with a playing track](https://monochromatic-lfs.aquaticat.workers.dev/b5403787cf65072d0d2c9cfe18009016e35fb4632d8008642481377af9d4af10/package/music-player/asset/readme/desktop-two-pane-light.png)

![Two-pane window in dark appearance with a playing track](https://monochromatic-lfs.aquaticat.workers.dev/531d61ba09fe7eb7d514a3b49c813884b31df36890fec730a195fa29d1fb0be4/package/music-player/asset/readme/desktop-two-pane-dark.png)

#### Search

Search covers the track pane.
The query `lan` finds a loose track,
a folder,
and a track with its parent folder,
each with the matching text highlighted.
The ring on the first result shows keyboard focus.

![Search results for a query in light appearance](https://monochromatic-lfs.aquaticat.workers.dev/31bce84b95e2d27efc5a081447eab47f75d585fef0634faff8ac5b435afa6399/package/music-player/asset/readme/desktop-search-light.png)

![Search results for a query in dark appearance](https://monochromatic-lfs.aquaticat.workers.dev/3a69f0b9b347366cb600654e5210f891585f5e3eee92b640f90e911be4f85da5/package/music-player/asset/readme/desktop-search-dark.png)

#### Settings

The Track rows template is selected when Settings opens.
Its editor,
a preview from the open library,
and the list of insertable fields fill the second pane.

![Settings with the Track rows template in light appearance](https://monochromatic-lfs.aquaticat.workers.dev/2aebcf0a532bd80b74b94f8a3080f7dd4e25c0ffa8f7facb949e32d54f230c6e/package/music-player/asset/readme/desktop-settings-light.png)

![Settings with the Track rows template in dark appearance](https://monochromatic-lfs.aquaticat.workers.dev/eb725dda5b69c22394904bf5cf10c27c10dc812d92d1f8a39a5680b754632277/package/music-player/asset/readme/desktop-settings-dark.png)

#### Track menu and key hints

The menu was opened on the playing row with the `Menu` key.
Each row has an underlined access letter,
and the rows that have a shortcut show it.

![Track menu opened with the keyboard in light appearance](https://monochromatic-lfs.aquaticat.workers.dev/d0225b90acf06c3f0e925cd568bee8c15e30ac616828fe9e6dc49d24cf426e06/package/music-player/asset/readme/desktop-menu-light.png)

![Track menu opened with the keyboard in dark appearance](https://monochromatic-lfs.aquaticat.workers.dev/f3e68dda2676018e3a6412c5e8490ebe6c77ddc537edf77cb81dfa70a8aa91bb/package/music-player/asset/readme/desktop-menu-dark.png)

Holding `Ctrl` shows a badge on each control that a `Ctrl` chord triggers:
`F` on Search,
`G` on the playing track's title,
`M` on the mode group,
and `Left` and `Right` on previous and next.
The ring on the track row shows keyboard focus.

![Key hint badges while Ctrl is held](https://monochromatic-lfs.aquaticat.workers.dev/7a2a9c6a23db12b2a8cdea1deaae9f6f29643c7f1e7aafff72d13ede839cc26e/package/music-player/asset/readme/desktop-hints-dark.png)

#### Narrow window

A window narrower than 600 pixels shows one pane.
The header carries the folder button with a caret,
Search,
the Open folder button,
and Settings.

![Narrow window with the track list and the deck in dark appearance](https://monochromatic-lfs.aquaticat.workers.dev/c598228affe2e3ab81231eb27bf56a7f8ff4266e31bbe2b9f74b0344ec720865/package/music-player/asset/readme/desktop-narrow-player-dark.png)

The folder button opens the folder list in place of the track list,
and the deck stays in view.

![Narrow window with the folder list open in light appearance](https://monochromatic-lfs.aquaticat.workers.dev/bda22d27984c754117e63e8a0be1fb0f8283512b39fef7691ccb8ed832f64fe4/package/music-player/asset/readme/desktop-narrow-folders-light.png)

#### Empty library

A folder without playable audio says so and offers to open a different folder.

![Empty library state in light appearance](https://monochromatic-lfs.aquaticat.workers.dev/c40cbdc76be430bc7b22468051e6aff8f469d6bf8caf27bb941dfbf0b897d27d/package/music-player/asset/readme/desktop-empty-light.png)

### Android

Every capture is a screenshot of the debug build of this checkout.
It ran on an Android Emulator 37.2.12.0 with the Pixel 9 Pro Fold virtual device on Android 17 (API 37),
using the host GPU and no audio device.
Keys were sent to the emulator with `adb shell input`.
The library is the device-wide MediaStore collection,
and it holds only generated files:
invented artist folders and track names with generated tones.
The accent comes from the system accent of the emulator's wallpaper,
not from the baseline `#4E5E8B`.
Captures hold the app area only:
the status bar and the gesture bar are cropped away,
so no clock,
notification,
or carrier name appears.
The cover display captures are 1080 pixels wide and the inner display captures are 2076 pixels wide,
the widths of the two panels.
The PNGs were stripped of capture metadata.
The only paths visible are synthetic and relative to the library.

#### Cover display

On the closed foldable the app has one pane.
The folder button in the header opens the folder list in place of the track list,
and the deck stays in view.
The letter rail at the left jumps between letters,
and the selected folder,
`Aster Vale`,
is underlined.
The line under the playing title reads `4 of 9` with the track's true peak.

![Cover display with the folder list open in light appearance](https://monochromatic-lfs.aquaticat.workers.dev/b89584991247b2e50442be03eae3d7ffb3a3bb5300a3d71e83f7cf3fe8286291/package/music-player/asset/readme/android-cover-library-light.png)

With the folder list closed,
the track list fills the display above the deck.
Rows sit under their subfolder headings with a track count,
and each row shows its duration and true peak.
The playing track has bold text and a soft fill,
and the deck shows a pause control.
The mode group offers Repeat,
In order,
Shuffle Aster Vale (its name is shortened to fit),
and Shuffle all,
with a check mark on In order.

![Cover display with the track list and the deck in dark appearance](https://monochromatic-lfs.aquaticat.workers.dev/1d589fe188ecc82d9cbd80c744b36ce52a083b82cfb419ddedf2a008805df1bf/package/music-player/asset/readme/android-cover-player-dark.png)

Search is its own page with one header that holds Back,
the query,
and Clear.
The query `lan` finds a loose track,
a folder,
and a track with its parent folder,
each with the matching text highlighted.
The header, the status strip and the results share one tone,
a thin divider closes the header,
and each result keeps its glyph in a round tonal disc.
The on-screen keyboard was closed before the capture so that the results fill the display.

![Search results for a query on the cover display in light appearance](https://monochromatic-lfs.aquaticat.workers.dev/b83ee72ae828794c5aa7b8ae7b471d232440f11417517328930db95d2b39a736/package/music-player/asset/readme/android-cover-search-light.png)

The menu was opened on the playing row with the `Menu` key,
after `Alt+2` had focused the track list.
A ring just inside the edges of the row and a ring around Start shuffle from here show keyboard focus,
which the `Down` and `Up` keys move through the six rows.
Rings appear only while the keyboard drives focus,
and no other capture in this Android section shows one.
Each row has an underlined access letter,
and Move to trash has a red label and a trash icon.

![Track menu opened with the keyboard on the cover display in dark appearance](https://monochromatic-lfs.aquaticat.workers.dev/98007d69d82c56fdf7d154d21279e0a020ab660e29cf49f16d8049ffb2b834e8/package/music-player/asset/readme/android-cover-menu-dark.png)

On the cover display Settings is a single pane.
It lists the two templates,
Track rows and Playing track,
each with a preview line.

![Settings on the cover display in light appearance](https://monochromatic-lfs.aquaticat.workers.dev/38060578083a8d54d0789ac615244bdddaaf8e8add7fb05c9e3f6c1296b703d1/package/music-player/asset/readme/android-cover-settings-light.png)

#### Inner display

Unfolded,
the left pane holds the folder list with the deck beneath it,
and the right pane holds the tracks of the selected folder under their subfolder headings.
The playing track has bold text and a soft fill,
and the mode group wraps to two rows.

![Inner display with two panes in light appearance and a playing track](https://monochromatic-lfs.aquaticat.workers.dev/120a5d39518743b6d91e935507c9ce2202dc01108ed2341f62cee6ae30f29860/package/music-player/asset/readme/android-inner-two-pane-light.png)

![Inner display with two panes in dark appearance and a playing track](https://monochromatic-lfs.aquaticat.workers.dev/4384c24aa25790016829801c5e13c7b8ef6d631b9aadbdd476d1b9c219e4d30d/package/music-player/asset/readme/android-inner-two-pane-dark.png)

On the inner display Settings keeps the template list on the left with Track rows selected.
The right pane shows that template's preview from the open library,
its template text,
and the fields that can be inserted,
each with an example value and its `mi(...)` name.

![Settings with the Track rows template on the inner display in dark appearance](https://monochromatic-lfs.aquaticat.workers.dev/d09cd01cfc17b434647a0cf10a59b0e70646e737d670501d8a44d61075dd3174/package/music-player/asset/readme/android-inner-settings-dark.png)

## Design record

The accepted interface decisions,
the candidates behind them,
and the open questions live in the [`design`](design) package,
with the decision history in [`design/decisions.md`](design/decisions.md).
Folders and filenames stay canonical.
Metadata browsing,
tag-derived facets,
and album art remain outside the product (D19).

The scale the design targets is about 1,000 folders (D30) and a library of 1,000,000 tracks.
[`desktop-app/README.md`](desktop-app/README.md#search-and-scale) records the measurements taken on desktop at 1,000,000
tracks,
and `ScaleSearchTest` in the Android app's unit tests builds a library of 1,000,000 tracks for its search index.
Those numbers come from that README and that test,
and this README does not restate them as guarantees.

### Shared core direction

[`PROPOSAL.shared-core.md`](PROPOSAL.shared-core.md) describes the proposed migration to a shared Rust domain core with
thin desktop and Android adapters.
Only the shared true-peak meter and gain math have migrated so far.
Queueing,
pagination,
session handling,
decoding,
output,
and platform integration still have platform-specific implementations.

## Install

Pre-release builds are attached to the GitHub releases of
[`Aquaticat/Monochromatic`](https://github.com/Aquaticat/Monochromatic/releases),
because this package still lives in that repository.
Look for a release titled `Music Player <version> (pre-release)` with a tag named `music-player-v<version>`;
the same page lists releases of other packages.
If it lists no Music Player release yet,
[build from source](#build-from-source).

Every release is a pre-release,
because the project is under active development.
A release holds one file per platform and a `SHA256SUMS` file:

- Windows: `music-player-<version>-windows-x64.exe` and `music-player-<version>-windows-arm64.exe`.
- macOS: `music-player-<version>-macos-arm64.dmg`, for Apple silicon Macs only.
  Intel Macs have no download: build from source.
- Linux: `music-player-<version>-linux-x64.tar.gz` and `music-player-<version>-linux-arm64.tar.gz`.
- Android: `music-player-<version>-android.apk`.

### What has been tested

The project has run the Linux `x86_64` build on Wayland with PipeWire,
and the Android app on emulators.
Every other file is built by CI, not yet tested on this platform:
CI starts each desktop program once with `--version` and does nothing more.
No build has run on a real Android device, on macOS or on Windows.
Treat those downloads as unverified and report what you find as issues.

### Windows

Download the `.exe` that matches your processor and run it.
It is one standalone program that needs no installer and no Visual C++ runtime.
It is not signed with a developer identity,
so SmartScreen may show "Windows protected your PC":
choose "More info",
then "Run anyway".
The program takes one optional folder or file to open: `music-player.exe C:\Music`.

### macOS

Open the `.dmg` and drag Music Player to Applications.
The app is not notarized by Apple and has only an ad-hoc signature (no developer identity),
so the first launch needs your confirmation:

1.  Try to open Music Player once.
    macOS shows a warning and does not start it.
2.  Open System Settings, go to Privacy & Security, scroll down and click "Open Anyway".
3.  Click "Open" when the warning appears again.

macOS remembers the choice after that.
These are the steps in [Apple's guide](https://support.apple.com/en-us/102445).
The app needs macOS 11 or newer.

### Linux

Extract the archive and run `bin/music-player`,
or follow `INSTALL.txt` inside it to add a menu entry and an icon for your user.
It needs a Wayland or X11 session,
PipeWire,
fontconfig,
and a CPU with AES instructions.
The program is built on Ubuntu 24.04 and needs a glibc of that age or newer.
There is no AppImage:
the program links PipeWire from the host,
so an AppImage would depend on the host as much as the archive does.

### Android

Download the `.apk` on the device,
open it,
and allow installing from that app when Android asks.
It needs Android 8.0 (API 26) or newer,
and the `arm64-v8a` or `x86_64` instruction set.

The APK is signed with the project's release key,
and an update installs over it only if it carries the same key.
The certificate's SHA-256 fingerprint is
`9de6e9a475f182c36f2513179fd4b14763b0e00fe068c9b8f3e6f08103616926`;
compare it with `apksigner verify --print-certs <file>.apk`.
A debug build made from source uses a different key,
so Android refuses to update one into the other:
uninstall first.

### Verify a download

Every file is attested with GitHub build provenance,
which binds its exact bytes to the workflow run that built it:

```bash
# Fails if the file was changed after the workflow built it.
gh attestation verify <file> --repo Aquaticat/Monochromatic

# Compare against the checksum file attached to the release.
sha256sum --check --ignore-missing SHA256SUMS
```

The runbook [`doc/runbook/release-the-music-player.md`](../../doc/runbook/release-the-music-player.md)
describes how releases are made,
and [`doc/decision/music-player-releases.md`](../../doc/decision/music-player-releases.md) records why.

## Build from source

[Mise](https://mise.jdx.dev/) owns the supported build,
 test,
 lint,
 install,
 and run commands.
Run these commands from the repository root.

### Desktop

```bash
# Build a release binary.
mise run //package/music-player/desktop-app:build

# Run against a folder, which becomes the source root.
mise run //package/music-player/desktop-app:run -- path/to/music-folder

# Run desktop unit and UI-binding tests.
mise run //package/music-player/desktop-app:test
```

Linux builds use host development libraries when available and otherwise use the package's Fedora container.
The application itself runs on the host session.
 Linux requires Wayland and PipeWire.
 macOS builds target Apple
Silicon,
 and Windows builds target `x86_64`;
 both build natively.
The desktop application accepts one optional file or directory path;
 a file selects its parent directory.
Pass `--start-playing` only when automatic playback on launch is required.

See [`desktop-app/README.md`](desktop-app/README.md) for platform prerequisites,
 codecs,
 container behaviour,
session locations,
 build verification,
 and signing work.

### Android

```bash
# Provision the repository-managed Android tools and required SDK components.
mise install
mise run prepare:android

# Assemble and install the debug app on a connected device or emulator.
mise run //package/music-player/android-app:install

# Run pure Kotlin unit tests.
mise run //package/music-player/android-app:test:unit
```

The Android build produces `arm64-v8a` and `x86_64` native libraries.
Use an API 26 or later device or emulator.
 The first application launch requests audio-library permission.

See [`android-app/README.md`](android-app/README.md) for native-build details,
 release builds,
 instrumented
tests,
 non-destructive device testing,
 lint commands,
 and control-sizing guidance.

### Shared true-peak core

```bash
mise run //package/music-player/truepeak-core:test
mise run //package/music-player/truepeak-core:lint:clippy
```

[`truepeak-core/README.md`](truepeak-core/README.md) explains its policy identity,
 cache boundary,
 public
surface,
 and staged migration status.
 [`truepeak-core.bench/README.md`](truepeak-core.bench/README.md) documents
the corpus evaluation used to choose the current shared policy.

## Architecture

### Desktop application

[`desktop-app`](desktop-app) is a Rust library plus a thin binary.
The Slint UI sends commands to an engine worker thread,
 which owns queue state,
 decoding,
 output,
 session
reconciliation,
 and peak-cache interaction.
 A single-producer,
 single-consumer ring buffer separates that
worker from the audio callback.

The desktop Source Root is recursive and watched.
The folders and the rows of the selected one come from a page index that the window state builds once per queue,
and the queue builds the same index to scope In order and Shuffle the folder to one folder.

### Android application

[`android-app`](android-app) is a Gradle application with a nested Rust `cdylib`.
Jetpack Compose renders the interface.
 Kotlin owns Android-specific file access,
 persisted folder grants,
MediaSession integration,
 activity and service lifecycle,
 background work,
 and user preferences.
 Kotlin passes
media file descriptors and coarse commands across JNI;
 decoded audio and realtime buffers stay in Rust.

`PlaybackService` owns the player controller,
 so audio can continue when the activity is recreated or
backgrounded.
 `LibrarySource` selects a live persisted Storage Access Framework tree before falling back to
MediaStore,
 ensuring foreground playback and background peak work see the same library identity.

### Shared true-peak core

[`truepeak-core`](truepeak-core) holds the streaming true-peak meter,
 gain math,
 source contract,
window-placement math,
 and versioned policy identity.
The shared core keeps meter and gain calculations aligned while leaving platform source access and higher-level
playback policy at their appropriate boundaries.

## Contributing

Start with the child README for the component you are changing,
 then run its narrow test and lint tasks through
Mise.
 The package boundaries are deliberate:

- Change desktop UI,
   filesystem watching,
   desktop output,
   or desktop session behaviour in
  [`desktop-app`](desktop-app).
- Change Android Compose UI,
   Android services,
   media sources,
   permissions,
   or Kotlin queue behaviour in
  [`android-app`](android-app).
- Change shared peak measurement or gain math in [`truepeak-core`](truepeak-core),
   with its tests and corpus
  evaluation considered together.
- Keep platform behaviour distinct until the shared-core migration explicitly moves ownership.
- Change exploratory interface decisions and visual candidates in [`design`](design),
   then update its handover as the work proceeds.

Use synthetic audio and folder names when creating visual fixtures.
The desktop captures in the gallery come from the session helpers of [`desktop-e2e`](desktop-e2e),
which play into a private null sink.
The method of this gallery, and the facts for retaking the Android gallery, are in
[`doc/handover/music-player-readme-and-gallery.md`](../../doc/handover/music-player-readme-and-gallery.md).

## Related documentation

- [Android port decision](../../doc/decision/music-player-android-port.md)
- [Source Root session decision](../../doc/decision/music-player-session-source-root.md)
- [Live-update rescan decision](../../doc/decision/music-player-live-update-rescan.md)
- [Just-in-time shuffle decision](../../doc/decision/music-player-jit-shuffle.md)
- [Shared true-peak planning](../../doc/planning/music-player-shared-truepeak-core.md)
- [True-peak integration handover](../../doc/handover/music-player-truepeak-core-integration.md)
- [Shared-core proposal](PROPOSAL.shared-core.md)

## License

Music Player is licensed under the [GNU Lesser General Public License, version 3 or later](../../LICENSE).

### Third-party icons

The Settings rows of both apps carry Material Symbols icons.
They come from the [`google/material-design-icons`](https://github.com/google/material-design-icons) repository,
which is licensed under the Apache License,
Version 2.0 (`LICENSES/Apache-2.0.txt` at the repository root).
Each icon is the Outlined style at weight 400,
grade 0 and optical size 24,
unfilled,
from `symbols/web/<name>/materialsymbolsoutlined/<name>_24px.svg`
at commit `49d4db35df873165d6bd6ba09b063c7dafbac2f4`:

- `queue_music`,
  for the Track rows template.
- `play_circle`,
  for the Playing track template.

Each app embeds the path data as vector code,
with no icon font and no network access at run time.
The Android copy is `android-app/app/src/main/kotlin/dev/monochromatic/musicplayer/SettingsIcons.kt`.
The desktop copy is in `desktop-app/ui/settings.slint`.
