# music-player

A minimal native music player for Linux, built with the Slint GUI toolkit and a native PipeWire client.
Scope is deliberately small: Wayland and PipeWire only, an ad-hoc play queue, and broad codec coverage.

## Scope

- Output: Wayland for the window, PipeWire for audio. No X11 fallback, no ALSA/PulseAudio backends.
- Source: an ad-hoc queue. Opening a folder replaces the queue with the audio files found under it, scanning
  subfolders recursively. Command-line file or folder arguments are expanded the same way.
- Transport: play/pause, seek, volume, next/prev, a three-state shuffle (off, within page, all), and a
  "repeat track" toggle.
- Playback scope: the shuffle mode also chooses what playback loops over. Off and within-page confine playback to
  the current page (the track's top-level folder, or its A-Z/`#` letter bucket for a root-level track); off plays
  the page in load order, within-page shuffles it. All spans the whole queue, shuffled. When "repeat track" is
  off, reaching the end of the scope loops the scope (the page, or the whole queue); when on, the current track
  replays at its natural end, while a manual next/prev still moves within the scope. This deliberately cannot
  express non-shuffle with whole-queue repeat: when playing in order, playback stays inside the current folder
  rather than jumping to another artist once the folder ends.
- Metadata: filesystem path only. The queue list shows each track's path relative to the loaded folder (folder
  plus filename), with no tag parsing and no album art. The seek bar's position and duration come from the
  decoder (frame count over sample rate), not from tags.
- Sample rate: each track is declared to PipeWire at its own native rate, and PipeWire resamples to the device.
  Gapless playback is permanently out of scope.
- Output safety: per-track true-peak normalization, always on. Each track's true (inter-sample) peak is
  measured by oversampling, and the track plays at a single constant gain that brings that peak down to a
  -1 dBTP ceiling (the EBU R128 / ATSC A/85 true-peak ceiling). Normalization is attenuate-only: tracks already
  below the ceiling are left untouched, and a quiet track is never boosted (which would risk a sudden loud
  level). A hard clamp to the valid range backstops measurement error and any residual overshoot.
- Peak cache: measuring a true peak means decoding the whole file, so each result is memoized on disk under the
  config directory, keyed by an opaque fingerprint (a hash of path, size, and modified-time). The file stores
  only `fingerprint -> peak` pairs; no filename, path, or tag is ever written, so it reveals nothing about the
  library. On every queue load (an Open or the launch-time auto-load), a background thread pre-measures all the
  queue's tracks into the cache, skipping any already cached, so re-opening a known folder does little work.
  The currently loading track is measured synchronously (a cache miss decodes it before playback) so it plays
  at the correct gain from the first sample; this is the per-track-normalization cost on first encounter.

## Codecs

One demux path (symphonia) feeds two decode paths:

- symphonia decoders: FLAC, WAV/PCM, MP3, Vorbis (Ogg), AAC-LC and ALAC (MP4), ADPCM, AIFF.
- libopus (the `opus` crate) for Opus, fed raw packets from symphonia's Ogg demuxer. symphonia 0.5's own Opus
  decoder is an empty stub, so the dedicated library handles it.

Per-codec decode is covered by one test each over the committed `fixtures/` tones.

## Layout

The crate is a library plus a thin binary so the pure logic is unit-testable without audio or a GUI.

- `src/lib.rs`: module root.
- `src/command.rs`: the UI-to-engine `Command` and engine-to-UI `Update` message enums, plus `RepeatMode`.
- `src/queue.rs`: the play-queue model (load order, the current scope's playback order, cursor, shuffle mode,
  repeat-track flag), with a seedable PRNG for deterministic shuffle tests. The playback scope is the current
  track's page (off and within-page, computed via `pagination`) or the whole queue (all), and it always loops;
  there is no stop-at-end mode. `display_paths` builds the UI list as each track's path relative to the queue's
  common root (via `relpath`).
- `src/session.rs`: save and restore of the last session under the platform config directory, pruning tracks
  whose files moved or are not audio files (and remapping the saved cursor onto the survivors).
- `src/error.rs`: `PlayerError`, the single error type all fallible functions return.
- `src/decode.rs`: probing and decoding to interleaved `f32` PCM behind a `Source` trait (`AudioSpec`, `open`).
- `src/opus.rs`: the libopus `Source` for Opus.
- `src/output.rs`: the PipeWire FFI boundary. It owns the thread loop, context, and core, and `reconfigure`
  builds an output stream at a track's native format, returning the producer half of a lock-free ring buffer.
- `src/playback.rs`: device-free playback helpers, kept apart so they are unit-testable: the per-sample
  gain-and-clamp stage, frame-to-seconds conversion, recursive folder expansion, and the audio-file test.
  Folder scans enqueue only files whose extension is in the audio allowlist (flac, wav/wave, mp3, ogg/oga,
  opus, m4a/m4b/mp4, aac, aiff/aif/aifc), so cover art, playlists, and system files (`.DS_Store`, `.nomedia`,
  `.database_uuid`, and other dotfiles) never enter the queue.
- `src/truepeak.rs`: streaming true-peak measurement. It oversamples each channel ~4x with a cubic
  (Catmull-Rom) interpolation to estimate inter-sample peaks at constant memory, and turns a measured peak into
  the attenuate-only normalization gain.
- `src/peakcache.rs`: the persistent peak cache. It computes the opaque fingerprint, loads and saves the
  `fingerprint -> peak` map atomically (write a temp file, then rename), and exposes get/insert.
- `src/measure.rs`: measurement orchestration. `resolve_track_gain` returns a track's gain from the cache or
  measures it now on a miss; `spawn_queue_measurement` runs the detached background sweep over a queue, gently
  (a short sleep between measurements) and never cancelled.
- `src/controller.rs`: the playback state machine (state struct, command handling, background-measurement
  kickoff). It owns the queue, the active decoder, the output, and the shared peak cache.
- `src/controller_audio.rs`: the second `impl Controller` block (loading, gain resolution, audio pumping,
  position reporting), split out to keep each file within the line budget.
- `src/engine.rs`: the worker-thread front door. `Engine::spawn` starts the background thread; `run` builds a
  `Controller` and drives it from the command channel.
- `src/pagination.rs`: pure queue pagination on two axes. `paginate` groups each track's relative display path:
  a track in a subfolder gets a page per top-level folder under the loaded root (one level only; the label is
  that folder, with deeper nesting shown in the row path), and a track at the loaded root gets a first-letter
  page (the 26 English letters A-Z, case-insensitive, plus a `#` catch-all for digits, symbols, CJK, and
  non-English letters). Pages sort folder-pages-first (case-insensitively by label, so lowercase-led folder
  names like `daniwellP` and `r-906` interleave with the capitalized names instead of trailing after `Zedd`),
  then A-Z, then `#`. `page_of_index` finds the page
  holding a given track. No GUI or audio, so it is unit-tested directly.
- `src/relpath.rs`: pure relative-path display. `relative_display_paths` strips the longest common directory
  prefix shared by all queued tracks (always leaving at least the filename), so the UI shows `Artist/Album/01.flac`
  rather than the full absolute path, or just `01.flac` when the whole queue is one folder. No I/O, so it is
  unit-tested directly.
- `src/launcher.rs`: desktop-shell integration. `set_window_app_id` is a winit window-attributes hook that
  stamps the Wayland app id (`monochromatic.music-player`); `Launcher` emits the
  `com.canonical.Unity.LauncherEntry` `Update` signal on the session bus to drive the OS taskbar progress
  (fraction = position / duration, hidden when paused). Both are best-effort: no session bus or an unsupporting
  shell silently disables progress. KDE Plasma renders it natively; GNOME needs Dash-to-Dock.
- `src/main.rs`: builds the Slint window, spawns the engine, and wires callbacks to commands and updates to
  properties. It installs the winit backend with the app-id hook before creating the window, creates the
  `Launcher`, and pushes taskbar progress from each position/play-state update. It also derives the pagination
  view (tabs and the visible page) from the full queue at the property edge, so the engine and queue model stay
  unaware of pagination.
- `ui/app.slint`: the window markup (seek bar, volume slider, one combined control row holding the Open button,
  a plain-HTML-styled three-state shuffle radio group, the prev/play-pause/next transport buttons, and the
  "repeat track" checkbox, and a shared scroll region holding the page-tab bar and the
  queue list). The control row is a FlexboxLayout: the four groups spread across the row with at least 48px
  between them (a 48px taffy column gap plus space-between), and wrap onto more rows when the window is too
  narrow to fit them. The
  queue is paginated on two axes: a track in a subfolder gets a page per top-level folder under the loaded root
  (one level only; the tab is that folder), and a track at the loaded root gets a first-letter page (A-Z plus a
  `#` catch-all). Each tab shows one page. The page-tab bar and the selected page's track rows stay in one
  Flickable with one scrollbar, but their shared content is a wrapping FlexboxLayout: when their minimum widths
  fit, the complete page grid and selected track list sit beside each other; when they do not fit, flex wrapping
  returns them to the vertical tab-then-list order without an explicit breakpoint. The full page grid remains
  visible, so late-alphabet artists stay discoverable. The shared Flickable still lets page navigation and track
  rows scroll away together, driven by a prominent custom scrollbar in a right-hand gutter, since the default
  std-widgets scrollbar is a near-invisible hairline. Scrolling is animated by the
  Flickable itself: touchpad and touchscreen gestures fling with momentum, and mouse-wheel notches ease in over a
  short duration rather than snapping. The wheel animation needs the pinned Slint 1.17 revision (it is absent from
  the 1.16 releases); see `docs/troubleshooting/slint-flickable-smooth-scroll.md`. Rows show each track's path
  relative to the loaded root (so deeper nesting stays
  visible). The highlighted row is both the currently selected and the playing track, and the view follows it
  across track changes, so there is no separate now-playing title. A single click on an unselected row selects
  it (Rust loads it paused, pausing whatever was playing); a click on the already-highlighted row toggles
  play/pause. "Double click to play" falls out for free (first click selects, second toggles to play), so no
  real double-click handling is needed. The window title shows the playing track's list path (the same
  `folder/.../file` string the queue row shows) while audio plays, and reverts to "Music Player" when paused.
  The custom controls (radio group, checkbox, scrollbar, row highlight) take their colours from the Slint system
  palette rather than hardcoded values, so they follow the OS accent colour
  and the light/dark theme: the highlighted row and the checked checkbox use the accent, the same as the active
  page tab's primary button.

## Page navigation UX choices

The player keeps page navigation and tracks in one shared Flickable and uses responsive flex wrapping for the two
regions. This preserves the everything-shown-at-once browsing model when the viewport has room, keeps every page
button discoverable, and avoids separate scroll positions.

Rejected alternatives:

- Auto-collapse after each page click: rejected because collapsing content above the track list changes the shared
  scroll geometry immediately after selection, which risks surprising jumps.
- Height-capped page navigation plus `More pages`: rejected because hidden overflow makes late-alphabet artists
  such as Y and Z less discoverable.
- Text-link index: rejected because it weakens the button affordance used by active and inactive page tabs.
- Visible `Tracks` skip button: rejected because a skip link mixed into the page grid looks like a page despite
  not being one; focus-only skip links remain an accessibility pattern, not the primary navigation here.
- Permanent separate scroll containers: rejected because separate panes would keep page navigation consuming space
  while the track list scrolls, and would introduce an extra scroll position in a compact player.
- Breakpoint-specific layouts: rejected because Slint flex constraints can express the desired transition through
  minimum widths and wrapping, keeping the layout rule local to the two content regions.

Three threads cooperate: the Slint event loop (UI), the engine controller thread, and PipeWire's own realtime
thread. The UI and engine talk over a command channel; updates return via `slint::invoke_from_event_loop`. The
engine and the realtime callback share audio through a single-producer/single-consumer ring buffer.

## Build environment

The host is an immutable-style Fedora without the PipeWire, Opus, and clang development headers, so all cargo
builds, checks, clippy, and tests run inside a Fedora container defined by `Containerfile`, which carries the
build toolchain plus the GUI/audio runtime libraries. The `run` task, by contrast, BUILDS the release binary in
the container but RUNS it directly on the host: the container-built binary (Fedora 41 glibc) links only against
runtime libraries already present on the host (Fedora 44+), so it executes natively and integrates with the host
Wayland, PipeWire, D-Bus, and KDE taskbar without socket passthrough or uid juggling. The Rust toolchain comes
from rustup (current stable), not Fedora's `rust` package, because the Slint dependency is pinned to a git master
revision (1.17.0-dev) that needs rustc 1.92 or newer; see the `slint` dependency comment in `Cargo.toml` and
`docs/troubleshooting/slint-flickable-smooth-scroll.md`.

For OS taskbar progress, the `run` task installs two files onto the host before launching: the freshly built
binary into `~/.local/bin/music-player`, and `share/applications/monochromatic.music-player.desktop` into
`~/.local/share/applications`. The binary install is what makes the `.desktop` launcher work from the shell: its
`Exec=music-player` is resolved on the systemd user PATH (which includes `~/.local/bin` but not this package's
`target/release`), so launching from KDE without the install fails with "binary not found". Installing both means
the KDE launcher and `mise run` exercise the exact same binary. With the `.desktop` present, the shell can resolve
`application://monochromatic.music-player.desktop`. The window's Wayland app id is stamped to
`monochromatic.music-player` (matching the file's `StartupWMClass`) by a winit window-attributes hook, and the
`com.canonical.Unity.LauncherEntry` `Update` signal (carrying `progress` and `progress-visible`) is emitted on the
host session bus. KDE Plasma renders the progress natively; GNOME needs Dash-to-Dock; other shells silently
ignore it. A freshly installed `.desktop` file may need one login cycle before the shell associates it.

The same Slint XDG-portal watcher that supplies the dark/light colour scheme also reads
`org.freedesktop.appearance accent-color` and live-updates on change, so the UI follows the system accent colour
through the Slint palette with no extra wiring. When the desktop environment or portal exposes no accent-color
setting, Slint falls back to its default accent, so the feature degrades gracefully rather than failing.

The image installs `google-noto-sans-cjk-fonts`. Slint 1.16's femtovg renderer lays out text with parley and
fontique with system fonts enabled, which falls back per script to a system font for glyphs the primary font
lacks; without a CJK font in the container, Japanese, Chinese, and Korean filenames render as blank boxes.

The source comments follow the repository's `dum-dum-non-ts` convention: every concept-introducing line carries a
plain-English explanation and a TypeScript translation, because the maintainer reads TypeScript fluently and Rust
less so.

## Commands

All commands run through mise tasks. Build, lint, and test wrap `podman run`; `run` builds in the container and
then executes the binary on the host. Run them from this package directory, or prefix with the package path from
the repository root.

```bash
# build the container image (after editing the Containerfile)
mise run //packages/desktop-app/music-player:image

# compile checks
mise run //packages/desktop-app/music-player:lint          # cargo check
mise run //packages/desktop-app/music-player:lint:clippy   # clippy, warnings denied

# tests (queue, session, decode-per-codec)
mise run //packages/desktop-app/music-player:test

# release build
mise run //packages/desktop-app/music-player:build

# build in the container, install to ~/.local/bin + ~/.local/share/applications,
# then run the GUI on the host (optional file/folder args)
mise run //packages/desktop-app/music-player:run -- path/to/song.flac path/to/folder

# regenerate the per-codec test fixtures with host ffmpeg (rarely needed)
mise run //packages/desktop-app/music-player:gen:fixtures
```

The binary also accepts file and folder paths as command-line arguments, which are enqueued and played on launch.
The Open button uses the XDG desktop portal folder picker, and a chosen folder is scanned recursively. Individual
files can be enqueued through command-line arguments (the portal cannot offer files and folders in one dialog).

## Session

On exit the engine saves the queue (file paths), current index, position, volume, shuffle mode, and the
repeat-track flag to a JSON file under the platform config directory (`$XDG_CONFIG_HOME/music-player` on Linux).
Because `run` executes on the host, this is the real `~/.config/music-player`, persisting naturally across runs.
On launch, when no file
arguments are given, the saved session is restored: the queue, settings, and current track are reinstated and the
track is loaded paused at the saved position, with files that have since moved pruned out. Command-line path
arguments take precedence over a saved session. When no arguments are given and no queue remains to restore (none
was stored, or every saved file has since moved and was pruned away), the user's music directory is auto-loaded
paused, so the queue is populated without playing. The directory is resolved from `XDG_MUSIC_DIR`, then the XDG
user-dirs file, then the `xdg-user-dir MUSIC` command; running on the host, these resolve directly, so no
bind-mount or `XDG_MUSIC_DIR` injection is needed.
