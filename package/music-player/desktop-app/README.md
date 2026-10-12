# music-player

A minimal native music player built with the Slint GUI toolkit.
 On Linux it pairs a Wayland window with a native
PipeWire client;
 on macOS (Apple Silicon) and Windows it pairs a winit window with the OS audio engine through
cpal (CoreAudio on macOS,
 WASAPI on Windows).
 The window layer is winit on every platform,
 so only the audio
backend differs by target.
 Scope is deliberately small:
 a single watched Source Root and broad codec coverage.

## Scope

- Output:
   the platform's native stack.
   Linux uses a Wayland window (no X11 fallback) and PipeWire audio (no
  ALSA/PulseAudio backends);
   macOS and Windows use a winit window and the OS audio engine via cpal (CoreAudio on
  macOS,
   WASAPI on Windows).
   The window is winit on every platform,
   so only the audio backend is platform-specific.
- Source:
   a single Source Root directory.
   The queue is whatever audio files exist under that root (subfolders scanned recursively),
   re-derived from disk rather than built up by hand;
   opening a folder makes it the new Source Root.
   The root is watched while the app runs,
   so files added,
   removed,
   or renamed on disk are reflected live by a debounced rescan,
   and that same rescan on launch self-corrects the restored queue.
- Transport:
   play/pause,
   seek,
   volume,
   next/prev,
   a three-state shuffle (off,
   within page,
   all),
   and a
  "repeat track" toggle.
- Playback scope:
   the shuffle mode also chooses what playback loops over.
   Off and within-page confine playback to
  the current page (the track's top-level folder,
   or its A-Z/`#` letter bucket for a root-level track);
   off plays
  the page in load order,
   within-page shuffles it.
   All spans the whole queue,
   shuffled.
   When "repeat track" is
  off,
   reaching the end of the scope loops the scope (the page,
   or the whole queue);
   when on,
   the current track
  replays at its natural end,
   while a manual next/prev still moves within the scope.
   This deliberately cannot
  express non-shuffle with whole-queue repeat:
   when playing in order,
   playback stays inside the current folder
  rather than jumping to another artist once the folder ends.
- Metadata:
   filesystem path only.
   The queue list shows each track's path relative to the loaded folder (folder
  plus filename),
   with no tag parsing and no album art.
   The seek bar's position and duration come from the
  decoder (frame count over sample rate),
   not from tags.
- Sample rate:
   each track is opened at its own native rate,
   and the OS audio server resamples to the device
  (PipeWire on Linux,
   CoreAudio on macOS,
   WASAPI on Windows),
   so the player itself never resamples.
   Gapless
  playback is permanently out of scope.
- Output safety:
   per-track true-peak normalization,
   always on.
   Each track's true (inter-sample) peak is
  measured by oversampling,
   and the track plays at a single constant gain that brings that peak down to a
  -1 dBTP ceiling (the EBU R128 / ATSC A/85 true-peak ceiling).
   Normalization is attenuate-only:
   tracks already
  below the ceiling are left untouched,
   and a quiet track is never boosted (which would risk a sudden loud
  level).
   A hard clamp to the valid range backstops measurement error and any residual overshoot.
- Peak cache:
   measuring a true peak means decoding the whole file,
   so each result is memoized on disk under the
  config directory,
   keyed by an opaque fingerprint (a hash of path,
   size,
   and modified-time).
   The file stores
  only `fingerprint -> peak` pairs;
   no filename,
   path,
   or tag is ever written,
   so it reveals nothing about the
  library.
   On every queue load (an Open or the launch-time auto-load),
   a background thread pre-measures the queue's non-current tracks into the cache,
   skipping any already cached,
   so re-opening a known folder does little work.
  The current track uses a one-second swap strategy on a cache miss:
   start measuring it on a dedicated worker,
   wait up to one second when playback is about to start,
   then play with the temporary -1 dBTP ceiling gain if measurement is still pending.
  When the measured gain lands,
   future decoded samples swap to it;
   already-buffered fallback-gain samples are not flushed.

## Codecs

One demux path (symphonia) feeds two decode paths:

- symphonia decoders:
   FLAC,
   WAV/PCM,
   MP3,
   Vorbis (Ogg),
   AAC-LC and ALAC (MP4),
   ADPCM,
   AIFF.
- libopus (the `opus` crate) for Opus,
   fed raw packets from symphonia's Ogg demuxer.
   symphonia 0.5's own Opus
  decoder is an empty stub,
   so the dedicated library handles it.

Per-codec decode is covered by one test each over the committed `fixture/` tones.

## Layout

The crate is a library plus a thin binary so the pure logic is unit-testable without audio or a GUI.

- `src/lib.rs`:
   module root.
- `src/command.rs`:
   the UI-to-engine `Command` and engine-to-UI `Update` message enums,
   plus `RepeatMode`.
- `src/queue.rs`:
   the play-queue model (load order,
   the current scope's playback order,
   cursor,
   shuffle mode,
  repeat-track flag),
   with a seedable PRNG for deterministic shuffle tests.
   The playback scope is the current
  track's page (off and within-page,
   computed via `pagination`) or the whole queue (all),
   and it always loops;
  there is no stop-at-end mode.
   `display_paths` builds the UI list as each track's path relative to the queue's
  common root (via `relpath`).
- `src/session.rs`:
   save and restore of the last session under the platform config directory,
   pruning tracks
  whose files moved or are not audio files (and remapping the saved cursor onto the survivors).
- `src/error.rs`:
   `PlayerError`,
   the single error type all fallible functions return.
- `src/decode.rs`:
   probing and decoding to interleaved `f32` PCM behind a `Source` trait (`AudioSpec`,
   `open`).
- `src/opus.rs`:
   the libopus `Source` for Opus.
- `src/output_pipewire.rs` and `src/output_cpal.rs`:
   the audio-output boundary,
   selected by target in
  `lib.rs` (PipeWire on Linux;
   cpal on every non-Linux target,
   driving CoreAudio on macOS and WASAPI on
  Windows).
   Both expose the identical `Output` surface (`new`,
   `set_playing`,
   `reconfigure`);
   `reconfigure`
  builds an output stream at a track's native format and returns the producer half of a lock-free ring buffer.
  Everything outside this boundary is platform-agnostic and only ever touches that producer,
   so adding the cpal
  backend changed no engine,
   controller,
   or decode code.
- `src/playback.rs`:
   device-free playback helpers,
   kept apart so they are unit-testable:
   the per-sample
  gain-and-clamp stage,
   frame-to-seconds conversion,
   recursive folder expansion,
   and the audio-file test.
  Folder scans enqueue only files whose extension is in the audio allowlist (flac,
   wav/wave,
   mp3,
   ogg/oga,
  opus,
   m4a/m4b/mp4,
   aac,
   aiff/aif/aifc),
   so cover art,
   playlists,
   and system files (`.DS_Store`,
   `.nomedia`,
  `.database_uuid`,
   and other dotfiles) never enter the queue.
- `src/truepeak.rs`:
   streaming true-peak measurement.
   It oversamples each channel ~4x with a cubic
  (Catmull-Rom) interpolation to estimate inter-sample peaks at constant memory,
   and turns a measured peak into
  the attenuate-only normalization gain.
- `src/peakcache.rs`:
   the persistent peak cache.
   It computes the opaque fingerprint,
   loads and saves the
  `fingerprint -> peak` map atomically (write a temp file,
   then rename),
   and exposes get/insert.
- `src/measure.rs`:
   background measurement orchestration.
   `spawn_queue_measurement` runs the detached background sweep over a queue's non-current tracks,
   gently
  (a short sleep between measurements) and never cancelled.
   The sweep thread first drops itself to the platform's
  lowest scheduling tier so its CPU-bound decoding never competes with the audio thread or the UI:
   Linux
  `SCHED_IDLE`,
   macOS background QoS (`pthread_set_qos_class_self_np`),
   and Windows `THREAD_PRIORITY_IDLE`,
   with a
  no-op on any other target.
- `src/sweep_gate.rs`:
   the pause gate of the background sweep (D107).
   Every sweep worker asks the gate for admission before it claims the next track,
   so Pause stops new claims, a track already being decoded finishes, Resume wakes the parked workers,
   and closing the gate at shutdown releases them.
- `src/analysis_notification_logic.rs`, `src/analysis_notification_wire.rs`, `src/analysis_notification.rs`:
   the true-peak analysis indicator (D107), which replaced the in-app banner.
   On KDE it is a Plasma job (`org.kde.kuiserver`) with a native Pause button;
   elsewhere it is one freedesktop notification replaced in place; with neither, analysis runs without an indicator.
   The logic file holds the pure rules (rate limit of two updates a second, skipping repeats, pause and dismissal),
   the wire file holds the D-Bus messages (Linux only),
   and the handle runs them on its own thread so the window and the sweep workers never wait on the bus.
   Protocol facts and pitfalls: `doc/troubleshooting/plasma-job-view-progress-protocol.md`.
- `src/peak_swap.rs`:
   current-track peak swap orchestration.
   Cache hits return the measured gain immediately;
   cache misses set the temporary ceiling gain,
   spawn a current-track worker,
   and expose a pending result that the controller polls before decoding.
- `src/controller.rs`:
   the playback state machine (state struct,
   command handling,
   background-measurement
  kickoff).
   It owns the queue,
   the active decoder,
   the output,
   and the shared peak cache.
- `src/controller_audio.rs`:
   the second `impl Controller` block (loading,
   gain resolution,
   audio pumping,
  position reporting),
   split out to keep each file within the line budget.
- `src/engine.rs`:
   the worker-thread front door.
   `Engine::spawn` starts the background thread;
   `run` builds a
  `Controller` and drives it from the command channel.
- `src/pagination.rs`:
   pure queue pagination on two axes.
   `paginate` groups each track's relative display path:
  a track in a subfolder gets a page per top-level folder under the loaded root (one level only;
   the label is
  that folder,
   with deeper nesting shown in the row path),
   and a track at the loaded root gets a first-letter
  page (the 26 English letters A-Z,
   case-insensitive,
   plus a `#` catch-all for digits,
   symbols,
   CJK,
   and
  non-English letters).
   Pages sort folder-pages-first (case-insensitively by label,
   so lowercase-led folder
  names like `daniwellP` and `r-906` interleave with the capitalized names instead of trailing after `Zedd`),
  then A-Z,
   then `#`.
   `page_of_index` finds the page
  holding a given track.
   No GUI or audio,
   so it is unit-tested directly.
- `src/relpath.rs`:
   pure relative-path display.
   `relative_display_paths` strips the longest common directory
  prefix shared by all queued tracks (always leaving at least the filename),
   so the UI shows `Artist/Album/01.flac`
  rather than the full absolute path,
   or just `01.flac` when the whole queue is one folder.
   No I/O,
   so it is
  unit-tested directly.
- `src/identity.rs`:
   the single source of truth for the platform identity strings (the Wayland app id,
   the macOS
  `CFBundleIdentifier`,
   and the config-dir reverse-DNS triple),
   so the three platforms' names cannot drift.
   The
  three reverse-DNS roots differ on purpose;
   a unit test asserts the macOS `Info.plist` and the Linux `.desktop`
  file still carry the centralized values.
- `src/launcher.rs`:
   Linux desktop-shell integration.
   `set_window_app_id` is a winit window-attributes hook that
  stamps the Wayland app id (`monochromatic.music-player`);
   `Launcher` emits the
  `com.canonical.Unity.LauncherEntry` `Update` signal on the session bus to drive the taskbar progress
  (fraction = position / duration,
   hidden when paused).
   Both are best-effort:
   no session bus or an unsupporting
  shell silently disables progress.
   KDE Plasma renders it natively;
   GNOME needs Dash-to-Dock.
   Both are Linux-only
  and compile to no-ops on macOS and Windows,
   where the Wayland app id and the D-Bus signal have no analogue.
  Windows still gets a taskbar progress bar,
   driven natively through the `ITaskbarList3` COM interface in
  `src/ui_progress.rs` (the Windows counterpart to the Linux LauncherEntry signal);
   macOS has no dock progress
  API,
   so there the taskbar progress is genuinely a no-op.
- `src/main.rs`:
   builds the Slint window,
   spawns the engine,
   and wires callbacks to commands and updates to
  properties.
   It installs the winit backend with the app-id hook before creating the window,
   creates the
  `Launcher`,
   and pushes taskbar progress from each position/play-state update.
   It also derives the pagination
  view (tabs and the visible page) from the full queue at the property edge,
   so the engine and queue model stay
  unaware of pagination.
- `ui/app.slint`:
   the window markup (seek bar,
   volume slider,
   one combined control row holding Settings then Open,
  a plain-HTML-styled three-state shuffle radio group,
   the prev/play-pause/next transport buttons,
   and the
  "repeat track" checkbox,
   and the scrolling queue area holding the page-tab bar and the
  queue list).
   The control row is a FlexboxLayout:
   the four groups spread across the row with at least 48px
  between them (a 48px taffy column gap plus space-between),
   and wrap onto more rows when the window is too
  narrow to fit them.
   The
  queue is paginated on two axes:
   a track in a subfolder gets a page per top-level folder under the loaded root
  (one level only;
   the tab is that folder),
   and a track at the loaded root gets a first-letter page (A-Z plus a
  `#` catch-all).
   Each tab shows one page.
   Wide windows show the complete page grid beside the selected page's
  rows as two independent scroll containers,
   each with its own Flickable and scrollbar,
   so a long track list
  scrolls without moving the tab bar and a tall tab grid scrolls without moving the list.
   Narrow windows collapse
  them into the original vertical tab-then-list order under one shared Flickable and scrollbar.
   The switch is an
  explicit width breakpoint,
   because the
  breakpointless wrapping `FlexboxLayout` root created a Slint `Flickable` layout-info loop on Slint 1.17;
   see `../../../doc/troubleshooting/slint-flickable-flexbox-layout-loop.md`.
   The full page grid remains
  visible,
   so late-alphabet artists stay discoverable.
   Page selectors default to wrapping Chromium-like tabs.
   Their labels use `10px` inline padding on each side,
   half the earlier `20px` inset.
   Persisted style integers retain their stable mapping,
   and unknown values still fall back to radio controls.
   Each style has one centralized `included` toggle in `src/ui_page_style.rs` `BUILD_STYLES`.
   Settings lists only included styles,
   and disabled persisted selections resolve safely without renumbering values.
   `../../../doc/runbook/music-player-page-control-styles.md` documents matching desktop and Android changes.
   Settings also offers flat multi-row Material Design 1 tabs with selected underlines,
   joined content-width segmented buttons,
   raised content-width Chromium-like tabs,
   reflective hardware caps with a runtime-accent LED state over one full-width machined plate,
   and the previous rounded buttons.
   Segmented sections and visible outlines stay fitted to label content;
   unused row width remains transparent and unframed.
   LED caps remain content-width,
   while their shared backplate always fills the available page-control width.
   In the light scene,
   the `#f7f8fa` plate remains visibly lighter than the `#eceef1` page ground.
   LED legends use at least the normal body-label size,
   matching labels such as Volume.
   Active legends remain white,
   so selected fills stay dark enough for clear contrast across runtime accents and ambient scenes.
   Independent OKLCH lightness and chroma mixing retains most available accent chroma,
   keeping selected backgrounds vibrant.
   Every application color operation uses OKLCH,
   including alpha changes and operations outside LED controls.
   The choice applies immediately and persists across launches.
   Each wide page-selector FlexboxLayout pins `align-content` and
  `cross-axis-alignment` to start (both default to stretch),
   so its controls keep their natural size instead of inflating to fill the taller list column.
   Each scroll region is driven by a prominent custom
  scrollbar in a right-hand gutter,
   since the default
  std-widgets scrollbar is a near-invisible hairline.
   Scrolling is animated by the
  Flickable itself:
   touchpad and touchscreen gestures fling with momentum,
   and mouse-wheel notches ease in over a
  short duration rather than snapping.
   The wheel animation is why the app depends on Slint 1.17 or newer (it is absent from
  the 1.16 releases);
   see `../../../doc/troubleshooting/slint-flickable-smooth-scroll.md`.
   Rows show each track's path
  relative to the loaded root (so deeper nesting stays
  visible).
   The highlighted row is both the currently selected and the playing track,
   and the view follows it
  across track changes,
   so there is no separate now-playing title.
   A single click on an unselected row selects
  it (Rust loads it paused,
   pausing whatever was playing);
   a click on the already-highlighted row toggles
  play/pause.
   "Double click to play" falls out for free (first click selects,
   second toggles to play),
   so no
  real double-click handling is needed.
   The window title shows the playing track's list path (the same
  `folder/.../file` string the queue row shows) while audio plays,
   and reverts to "Music Player" when paused.
  The custom controls take their colours from the `Theme` roles in `ui/theme.slint`
   rather than hardcoded values,
   so they follow the OS accent colour
  and the light/dark theme (see "Theme colours").
  Seek-bar movement and platform taskbar progress updates (KDE LauncherEntry on Linux,
   ITaskbarList3 on Windows)
  are debounced through the same Rust helper,
   while play/pause state still emits immediately.
   This prevents
  sub-second or zero-duration tracks from flickering the on-screen progress bar or flashing an empty taskbar
  progress indicator.

## Isolated visual verification

Never change the host desktop environment's global theme to test this app.
Run theme-dependent and other isolated GUI checks inside the repo-owned compositor at
`package/cli/nested-wayland-session`.
If that compositor cannot provide a required test feature,
add the feature to `nested-wayland-session` rather than mutating host-wide desktop settings.
Restore any app-local fixture state after capture.

## Theme colours

The operating system's accent colour is the theme root (A3, D108), and it is the only thing taken from the platform.
Slint reports it through `SlintInternal.accent-color`: the XDG portal `org.freedesktop.appearance` `accent-color` on
Linux (live, through the portal's `SettingChanged` signal), DWM colorization on Windows and `NSColor` accent on macOS.
A transparent accent (alpha 0) means none is available, and the root is then the Fold capture baseline `#4E5E8B`.
`SlintInternal` needs Slint's experimental-features switch (`SLINT_ENABLE_EXPERIMENTAL_FEATURES`), which the package
`mise.toml` and the repo `.cargo/config.toml` already set.

Every other colour is derived from the root in OKLCH by `src/theme_roles.rs` (math in `src/oklch.rs`):
each role has a lightness target, a chroma share and a hue offset, converted to sRGB with chroma reduction at constant
lightness and hue (a binary search, never per-channel clipping, which would shift the hue).
Text roles are then moved in lightness until WCAG AA holds on every surface they are drawn on and under the hover layer,
so contrast holds for any accent.
The dark canvas, the rail seam and the deck stay the fixed neutrals of D41, the light canvas stays white,
and the error roles are constants that follow no accent.
Hover and pressed fills of the selected segment and the search match fill (D59) are OKLCH roles too;
state layers over a surface stay alpha-only.
The Rust side (`src/ui_theme.rs`) writes both schemes into `Theme.dark-roles` and `Theme.light-roles` at startup and
again whenever the accent changes; the light or dark choice stays inside Slint.
The literals in `ui/theme.slint` are the baseline roles, so a Slint viewer without Rust still renders the baseline;
a test fails when they differ from the derivation and says what to paste.
No `.slint` file may call `mix`, `brighter`, `darker` or `transparentize` (a test scans for them).

## Settings page

Settings (`ui/settings.slint`, D87, D99, D109, D110) lists the two templates, Track rows and Playing track, under a
Templates heading.
The whole page is drawn on the one canvas colour (pure white in light, pure black in dark): no page tint, card fill,
header band, border or divider line, so the header, the heading and the rows are separated by spacing alone.
Only state carries a fill: the hover and pressed layers, the 40 px icon circle (the secondary container role) and the
selected row's pill.
`src/settings_layout.rs` holds the layout numbers as pure functions,
and the window tests compare the real layout with them.

The window decides the form with the same 600 px switch as the player.
Below 600 px Settings is one full-width page with no maximum column width and no centering:
a 16 px side margin, rows 72 px tall with a 40 px circular icon at x = 32 px from the window edge and the title at
x = 84 px, 2 px between rows and 16 px above the group heading, and the header with Back.
A tap on a row opens that template's editor page, and Back on the editor page returns to the list.
From 600 px Settings is two panes.
The list pane takes the default split ratio 0.3636 of the window width, rounded to a pixel, and the editor pane takes
the rest, with only the ordinary 16 px insets (a desktop has no crease).
The left pane is the list above, and the right pane shows the selected row's editor in place, so selecting never
navigates and nothing moves: the selected row is a filled pill in the secondary container role with a bold title (two
channels), the title's box is sized by a hidden bold copy, and the new content fades in over 150 ms.
Slint 1.18 exposes no reduced-motion setting (searched in its 1.18.1 crates), so the fade is always that short.
While Settings is open the player layouts are hidden, so nothing of the player shows through the fade.
The first row is selected when Settings opens.
Up, Down, Home and End move through the rows (selection follows in the wide form, and the single form shows the focused
row with the hover layer), and Enter or Space activates the focused row.
Back (the header arrow) and Escape close Settings in both forms.
Escape closes Settings only while Settings is the visible page and no template line is being edited.
Closing Settings, or selecting the other row, applies and saves the valid drafts.
Widening the window on an editor page continues that editor in the right pane.

The row icons are Material Symbols Outlined (weight 400, grade 0, 24 px, unfilled) `queue_music` and `play_circle`
from [google/material-design-icons][material-icons], commit `49d4db35df873165d6bd6ba09b063c7dafbac2f4`
(`symbols/web/queue_music/materialsymbolsoutlined/queue_music_24px.svg` and
`symbols/web/play_circle/materialsymbolsoutlined/play_circle_24px.svg`).
They are embedded as Slint `Path` commands in `ui/settings.slint`, with no icon font and no network access at run time.
The SVG files use a `viewBox` of `0 -960 960 960`; the embedded data is the same outline moved onto a 24 by 24 grid
(x / 40 and (y + 960) / 40) in explicit absolute `M`, `L`, `Q` and `Z` commands, with a matching `viewbox` of 24.
The files close each contour with a line back to its start before `Z`, which Slint's femtovg renderer draws as a wrong
shape (the three bars of `queue_music` became one blob), so that redundant line is dropped; a test pins the form of the
data.
The icons are licensed under the Apache License 2.0.
The text is `LICENSES/Apache-2.0.txt` in this package, next to the font license, and the same file sits at the
repository root.

[material-icons]: https://github.com/google/material-design-icons

## Search and scale

A library of 1,000 artists and 1,000,000 tracks is normal operation, so Search, the scan and the window projection are
built to cost the size of what is shown or typed, not the size of the library.
This section describes the pieces; the decisions behind them are D47 to D74 (Search behavior), D103, D111 (Search while
the scan runs) and D112 (the in-memory index).

### The Search index

`search_index.rs` holds one entry per track: the display path and the normalized title, each in one shared text buffer
with end offsets (`search_index_text.rs`), and the title's length in UTF-16 units.
Two buckets, by first character and by first two characters of every word, list the tracks a term can match.
A query takes the smallest bucket among its terms, tiers each member with an allocation-free byte search at word
starts, keeps the best five hundred in the order the replaced matcher used (tier, length, collation key, path, folder
before track, position), and only then builds rows with highlights and parent context.
`search_index_rank.rs` computes collation keys lazily, only for the entries tied at the cut.
A bucket of 32,768 members or more is tiered by four threads and joined in order, which returns the same list.
The top five hundred of every first character is cached per character, and the cache is merged with the tracks
appended since, so it is exact at every moment (`search_index_top.rs`); an answer is never stale.
Normalization is unchanged: NFKD, combining marks removed, lowercase, trimmed by the Kotlin whitespace rule.

`search_service.rs` owns the index behind a read-write lock and three threads.
The query thread answers the newest query and drops the ones typed over, and never runs on the window thread.
The stream thread appends scan batches, and the warmer thread refreshes the one-character caches after a quiet moment.
Batches are normalized and bucketed outside the lock, and only the push runs under the write lock, which waits for
readers in short polls instead of blocking a keystroke.
Every batch signals a refresh, throttled to one answer every 120 ms, so an open Search page updates in place.

The old matcher is kept as `search_results_oracle.rs` (test builds only) and is the oracle for the index.
Tests compare tier, kind, name, library index, count, truncated flag and highlight ranges on hostile queries, on
seeded random libraries, on libraries that grow between batches, and on generated libraries.

### Searching while the scan runs

`scan_stream.rs` walks the root like `expand_paths` and reports every 5,000 tracks (the first after 150 ms) as
`Update::ScanBatch`, which `main.rs` hands to the stream thread.
Search therefore answers from the first batch, and results arrive in place while the scan continues.
`apply_answer` in `ui_search_apply.rs` keeps the query, the caret and the scroll position, edits one rows model in
place, and anchors the list (`ui_search_anchor.rs`) so the first visible row keeps its place when a better match is
inserted above it.
A tap resolves its row in the list last shown, not in a new search.
A query that matches nothing says the library is still being scanned until the scan completes (D69).
Browse rows still wait for the whole walk, because pages need every name.

The walk uses the file type of each directory entry and calls `is_file` only for symlinks.
A `stat` per file made the walk of 1,000,000 files take 10.6 seconds instead of 1.4 on a warm cache, and 55 seconds on
the one cold run measured.
The file watcher registers its recursive watch on its own thread (28 to 45 seconds at 1,000,000 files, where it used to
run before the walk on the engine thread) and ignores open and close events, which the walk itself raises.
When a registration ends it asks for one rescan, which catches a change made while it ran.
The queue itself takes its names and page index from one pass each: `Queue::set_tracks` went from 2.2 seconds to 0.5
at 1,000,000 tracks.

### The window projection

`ScreenState` keeps the names as one shared list and a page index (`page_index.rs`) built once per queue generation.
A projection reads only the selected page, looks up measures only for that page, and shares names instead of cloning
them.
The sweep reports measures in chunks that are written in place; a projection is requested only when a chunk touches the
selected page, and at most four times a second.

### Numbers

All numbers are release builds on a shared 16-core host whose load average stayed near 40, so they are upper bounds.
At 1,000,000 tracks the index builds in about 0.2 seconds from the names and holds 136 MiB, the slowest push under the
write lock is about 4 ms, and a query of one letter takes about 2 ms.
Queries of two to eight characters take 5 to 8 ms on the generated library, and 4 to 8 ms on 1,000,000 realistic names.
Typed into the running app at 1,000,000 tracks while the scan was still running, a keystroke took 4 to 9 ms from the
key to the applied rows (compute 4 to 7 ms, apply under 1 ms).
The window projection of a page of 970 tracks takes about 3 ms.
A page of 30,000 loose tracks takes about 80 ms, because a projection is linear in the selected page, at about 2.8
microseconds per row; the row template is parsed once per template and not once per row.

### Tests at scale

The scale tests run in the normal `mise run //package/music-player/desktop-app:test` suite, including 1,000,000 tracks.
`scale_library_tests.rs` generates the library; debug builds repeat a 100,000-track base so the suite stays short.
`search_scale_tests.rs` times the index and `scale_tests.rs` times the window stages, each at 1,000, 10,000, 100,000
and 1,000,000 tracks, and both print the median with the minimum and maximum of five runs in release builds.
Run them with `--release` and `--no-capture` to read the numbers.

## Keyboard

The keyboard map and the focus model are decision D106 (extending D102) in `package/music-player/design/decisions.md`.
`src/keymap_bindings.rs` holds the whole table (`BINDINGS`) and the pure classifier in `src/keymap.rs` reads it, so the
key hint badges, the tooltips and the menu rows draw their texts from the same rows.
Control is Ctrl on Windows and Linux; on macOS the primary modifier is Command (`held_modifiers` in `src/ui_keys.rs`
swaps the two because Slint reports them swapped there).

### Bindings

Playback, anywhere on the player page (Space also works with the track list, the folder list or a button focused;
on a focused button Space and Enter press that button instead):

- Space toggles play and pause.
- Ctrl+Left and Ctrl+Right go to the previous and the next track (macOS: Command+Shift+[ and Command+Shift+]).
- Alt+Left and Alt+Right seek 10 s back and forward; with Shift, 60 s. A held key repeats.
- Ctrl+M cycles the playback mode; Ctrl+Shift+1 to 4 pick Repeat, In order, Shuffle folder and Shuffle all.
- Ctrl+Home restarts the track.

Browsing:

- Ctrl+F opens Search; double Shift opens it too (two Shift taps, the second released within 400 ms of the first
  press, on the player page only).
- Ctrl+Alt+S opens Settings (macOS: Command+,).
- Ctrl+O opens the folder picker (on the folded layout the picker overlay; on the two-pane layout it focuses the
  folder list); Ctrl+Shift+O asks for the system folder dialog.
- Alt+1 and Alt+2 focus the folder list and the track list.
- Alt+Up and Alt+Down show the previous and the next folder; Ctrl+G reveals the playing track (macOS: Command+L) and
  Ctrl+Shift+G shows the playing track's folder.
- F5 rescans the library; Ctrl+Q quits.

In a focused list:

- Up, Down, Home, End, PageUp and PageDown move the ring; Enter plays the row (on the playing row it pauses) or shows
  the folder.
- In the folder list a letter jumps to the first folder starting with it, and Left and Right move like Up and Down.
- On a track row: Menu or Shift+F10 opens the row menu, Delete moves the file to the trash, Ctrl+Shift+C copies the
  file name, Ctrl+Shift+E shows the file in the file manager, Alt+Enter shows details, Ctrl+Shift+F5 re-analyses it.
  While the menu is open Up, Down and Enter choose a row, and Escape closes it.

Pages:

- Escape closes the innermost thing: the track menu, the folder picker overlay, then the page (Search, Settings).
- In Settings the template line's first Escape returns to its list row and the second leaves Settings; on the
  single-form editor page Escape returns to the Settings list. Ctrl+Enter applies the template and Ctrl+Shift+Backspace
  resets it. Ctrl+F and double Shift do nothing in Settings.
- In the Search field bare keys are text; Up and Down still move through the results and Enter opens one.

### Focus model

Tab and Shift+Tab walk the folder picker (the Open pill; on the folded layout the folder trigger first), the folder and
track lists, the deck controls (seek bar, Previous, Play, Next, mode group), then Search and Settings, and wrap; no
element traps the keyboard. Every focusable element draws a 2 px `primary` ring plus its state layer, only while the
keyboard is in use: a key press turns the ring on and a pointer press turns it off.

### Key hint badges

Holding modifiers for 300 ms shows a small badge (the key letter) on each control that the held set triggers;
holding more modifiers narrows the badges to the chords of exactly that set; releasing hides them. The badges take no
pointer input and move no content; they are drawn from `Theme` roles.

### Known limits

- F5, F10 and Menu cannot be pressed through the nested compositor 0.3.0 (`err unknown key`); the window tests press
  them, and the end-to-end run marks them as not injectable.
- Ctrl+Shift+3 and 4 may be taken by the screenshot shortcuts of macOS, and the digit chords assume a layout where
  Shift+digit gives the usual symbol; neither is verified here, and the macOS and Windows key mapping is untested.

### End-to-end run

`mise run //package/music-player/desktop-app:test:e2e` builds the release binary, then hosts it in the nested
compositor 0.3.0 with scratch XDG directories and a generated library (the 1k scale library plus tone tracks), and
presses every shortcut as a real key event. It plays into its own PipeWire null sink (checked by node id against
every output stream of the app, and stops at once if one links elsewhere), never touches another player process, and
prints one pass, fail or not-injectable line per shortcut. State is read from the app's `ui_state` log lines, from
screenshots and from files; `E2E_ONLY` (a check id or group prefix), `E2E_OUT` (default `target/e2e`, with
screenshots and `e2e-summary.json`), `E2E_TMP` and `E2E_LIBRARY_GENERATOR` tune it. Run it alone.

## Environment overrides

`MUSIC_PLAYER_COLOR_SCHEME` forces the window's color scheme.
Set it to `light` or `dark`.
Leave it unset to follow the operating system's scheme.
Any other value is logged and ignored, so the window follows the system.
Verification runs use it to capture both schemes without changing the host's theme.

`MUSIC_PLAYER_ACCENT` replaces the system accent as the theme root.
Set it to six hex digits such as `6060C0` or `#6060C0`.
Leave it unset to follow the system accent.
Any other value is logged and ignored.
It sets `Theme.accent-override`, which previews and tests can also set (transparent follows the system).
Verification runs use it to capture several accents without changing the host's theme.

`MUSIC_PLAYER_SCAN_PAUSE_MS` makes the folder scan pause that many milliseconds after each reported batch.
Leave it unset for normal speed; any value that is not a whole number is ignored.
Verification runs use it to type into Search while the scan is still running.

## Typeface

The window draws its text in Inter Variable, bundled from `ui/fonts/InterVariable.ttf`
and registered by the `import` at the top of `ui/app_window.slint`,
so Latin text looks the same on every machine.
Inter has no CJK glyphs, so Japanese and other scripts still fall back to a system font.
Inter is licensed under the SIL Open Font License 1.1 (`LICENSES/OFL-1.1.txt`).
Text sizes are the logical pixel sizes in `ui/theme.slint`, and main text is 16px.
The template editor's code fields keep `Noto Sans Mono`.

## Page navigation UX choices

Wide windows show the full page-control grid beside the selected page's rows as two independent scroll containers,
so the page grid and the track list scroll separately;
 narrow windows keep the original vertical tab-then-list
order under one shared Flickable.
 This preserves the everything-shown-at-once browsing model when the viewport has
room and keeps every page button discoverable.

Rejected alternatives:

- Auto-collapse after each page click:
   rejected because collapsing content above the track list changes the shared
  scroll geometry immediately after selection,
   which risks surprising jumps.
- Height-capped page navigation plus `More pages`:
   rejected because hidden overflow makes late-alphabet artists
  such as Y and Z less discoverable.
- Text-link index:
   rejected because it weakens the button affordance used by active and inactive page tabs.
- Visible `Tracks` skip button:
   rejected because a skip link mixed into the page grid looks like a page despite
  not being one;
   focus-only skip links remain an accessibility pattern,
   not the primary navigation here.
- Separate scroll containers in the narrow layout too:
   rejected because two panes in a compact window would keep
  page navigation consuming vertical space while the track list scrolls,
   and would add a second scroll position in
  a small player.
   Wide windows do split into two independent scroll containers,
   where the horizontal room makes the
  separate panes worthwhile.
- Breakpointless wrapping `FlexboxLayout` inside `Flickable`:
   rejected after source-auditing Slint's 1.17 layout path,
   because `Flickable` forwards preferred width from layout children and wrapped flex cross-axis layout
  needs the assigned width.
   This produced binding-loop warnings and runtime `Recursion detected` panics.
   The
  current breakpoint keeps the wide and narrow geometries explicit while preserving complete page-button
  discoverability.

Three threads cooperate:
 the Slint event loop (UI),
 the engine controller thread,
 and PipeWire's own realtime
thread.
 The UI and engine talk over a command channel;
 updates return via `slint::invoke_from_event_loop`.
 The
engine and the realtime callback share audio through a single-producer/single-consumer ring buffer.

## Build environment

Cargo work runs on the host when the native development libraries are present,
 and falls back to the Fedora
container defined by `Containerfile` otherwise.
 Each task evaluates a `host_ok` predicate (cargo on PATH plus
`pkg-config --exists libpipewire-0.3 fontconfig freetype2`);
 when all resolve it builds natively,
 and when
any is missing it runs the identical cargo command in podman.
 On an immutable-style Fedora the host libraries are
layered with:

```bash
rpm-ostree install pipewire-devel fontconfig-devel freetype-devel
```

libopus is not layered:
 the `opus` crate is pinned to the opusic-sys backend,
 which compiles libopus 1.6.1 from
source via CMake,
 so the host needs `cmake` (provided by the repo-wide mise `aqua:Kitware/CMake` tool) and a
generator (the host's system `make`) rather than a system libopus.
 The container installs `cmake`/`ninja-build`
itself (it cannot see host mise tools).
 The runtime GUI/audio libraries (mesa,
 wayland,
 libxkbcommon,
 fontconfig,
freetype) and a CJK font ship with a KDE desktop already,
 and libclang for the bindgen step is present via the
layered LLVM.
 The `run` task always
RUNS the binary directly on the host so the window,
 audio,
 D-Bus,
 and KDE taskbar use the host session natively;
a container-built binary (Fedora 41 glibc) still links only against runtime libraries present on the host
(Fedora 44+),
 so the fallback path executes natively too.
 The Rust toolchain comes from the repo-wide mise `rust`
tool on the host and from rustup (current stable) in the container,
 not Fedora's `rust` package,
 because Slint 1.17.0 needs rustc 1.92 or newer;
 see the `slint`
dependency comment in `Cargo.toml` and `../../../doc/troubleshooting/slint-flickable-smooth-scroll.md`.

The `*:container` tasks force the podman path regardless of host libraries,
 so the container build stays
asserted even on a fully provisioned host;
 `verify:container` is the umbrella assertion (image,
 build,
 clippy,
test in the container).

For OS taskbar progress,
 the `run` task installs two files onto the host before launching:
 the freshly built
binary into `~/.local/bin/music-player`,
 and `share/applications/monochromatic.music-player.desktop` into
`~/.local/share/applications`.
 The binary install is what makes the `.desktop` launcher work from the shell:
 its
`Exec=music-player` is resolved on the systemd user PATH (which includes `~/.local/bin` but not this package's
`target/release`),
 so launching from KDE without the install fails with "binary not found".
 Installing both means
the KDE launcher and `mise run` exercise the exact same binary.
 With the `.desktop` present,
 the shell can resolve
`application://monochromatic.music-player.desktop`.
 The window's Wayland app id is stamped to
`monochromatic.music-player` (matching the file's `StartupWMClass`) by a winit window-attributes hook,
 and the
`com.canonical.Unity.LauncherEntry` `Update` signal (carrying `progress` and `progress-visible`) is emitted on the
host session bus.
 KDE Plasma renders the progress natively;
 GNOME needs Dash-to-Dock;
 other shells silently
ignore it.
 A freshly installed `.desktop` file may need one login cycle before the shell associates it.

The same Slint XDG-portal watcher that supplies the dark/light colour scheme also reads
`org.freedesktop.appearance accent-color` and live-updates on change.
 The app reads that accent through `SlintInternal.accent-color` (not through the Slint palette,
 which keeps only its own lightness) and derives every theme colour from it in OKLCH, see "Theme colours" above.
 When the desktop environment or portal exposes no accent-color setting,
 Slint reports a transparent accent and the app uses its Fold baseline root instead,
 so the feature degrades gracefully rather than failing.

The image installs `google-noto-sans-cjk-fonts`.
 Slint 1.16's femtovg renderer lays out text with parley and
fontique with system fonts enabled,
 which falls back per script to a system font for glyphs the primary font
lacks;
 without a CJK font in the container,
 Japanese,
 Chinese,
 and Korean filenames render as blank boxes.

The source comments follow the repository's `dum-dum-non-ts` convention:
 every concept-introducing line carries a
plain-English explanation and a TypeScript translation,
 because the maintainer reads TypeScript fluently and Rust
less so.

### macOS (Apple Silicon)

On macOS every mise task takes a native cargo branch first (`process.platform !== 'linux'`):
 no pkg-config or
PipeWire probe,
 no podman fallback (a Linux container cannot produce a macOS binary),
 and no Linux bindgen env.
The audio backend is CoreAudio via cpal (`src/output_cpal.rs`,
 shared with the Windows WASAPI path),
 the window is
AppKit via winit,
 and the Wayland app id and the LauncherEntry taskbar progress compile to no-ops (macOS exposes no
dock progress API).
 The background measurement sweep drops itself to background QoS rather than Linux `SCHED_IDLE`,
through `libc`'s `pthread_set_qos_class_self_np`.

Prerequisites on a bare machine:

- A Rust toolchain with `cargo` on PATH.
   Homebrew's `rustup` (`brew install rustup`) is keg-only:
   the
  `cargo`/`rustc` proxies live in `$(brew --prefix rustup)/bin` (`/opt/homebrew/opt/rustup/bin`),
   which is not on
  PATH by default,
   and `~/.cargo/bin` is never created.
   Add that keg bin to PATH as the formula caveat says
  (`echo 'export PATH="$(brew --prefix rustup)/bin:$PATH"' >> ~/.zshrc`),
   then `rustup default stable`.
   Note that
  `rustup run <toolchain> cargo build` does NOT work here (rustup looks for `rustc` in the uncreated
  `~/.cargo/bin`);
   see `../../../doc/troubleshooting/homebrew-rustup-keg-only-proxies.md`.
- `cmake` plus the Command Line Tools C compiler.
   The `opus` crate is pinned to the opusic-sys backend,
   which
  compiles libopus 1.6.1 from source via CMake (no system libopus needed).
   The repo's mise `aqua:Kitware/CMake`
  tool provides `cmake`;
   `brew install cmake` also works.
   CMake uses the system `make` generator.
   bindgen uses
  the Command Line Tools' libclang automatically,
   so no `LIBCLANG_PATH` is needed.

Always build on the external `/Volumes/MacData` disk,
 never under `~` on the internal disk.
 The Apple Silicon
machine's internal disk is only about 251 GB and is mostly consumed by macOS and its data volume (roughly 76 GB
free as of 2026-06),
 so a Rust `target/` directory or a synced verification tree will fill it.
 The external
`/Volumes/MacData` volume is far larger (about 477 GB,
 370 GB free),
 so put the checkout,
 the build,
 and any
synced tree there,
 for example `/Volumes/MacData/music-player-verify`.
 Point cargo at it explicitly when the
source is elsewhere with `CARGO_TARGET_DIR=/Volumes/MacData/<name>/target`.

If the GPU OpenGL path misbehaves,
 force the software renderer with `SLINT_BACKEND=winit-software`.

### Windows (x86_64, MSVC)

On Windows every mise task takes the same native cargo branch as macOS (`process.platform !== 'linux'`):
 no
pkg-config or PipeWire probe,
 no podman fallback (a Linux container cannot produce a Windows binary),
 and no
Linux bindgen env.
 The audio backend is WASAPI via cpal (`src/output_cpal.rs`,
 shared with the macOS CoreAudio
path),
 the window is Win32 via winit,
 and the Wayland app id compiles to a no-op.
 The Linux D-Bus LauncherEntry
also compiles to a no-op,
 but the taskbar progress bar is driven natively through the `ITaskbarList3` COM interface
in `src/ui_progress.rs`,
 and the background measurement sweep uses `THREAD_PRIORITY_IDLE`.
 The `windows` crate
(pinned to 0.62) supplies both,
 unified with the same `windows` version cpal 0.18 and the Slint stack already pull.

The build targets `x86_64-pc-windows-msvc` and links with LLVM's `lld-link.exe` (pinned for that target in
`.cargo/config.toml`),
 not the default MSVC `link.exe`.
 Prerequisites on a bare machine:

- Rustup with the msvc host and a nightly toolchain (`rustup toolchain install nightly`),
   matching the Linux and
  macOS builds.
   `cargo` and `rustc` land on PATH under `%USERPROFILE%\.cargo\bin`.
- Visual Studio (or Build Tools) with the Desktop C++ workload,
   for the MSVC CRT and Windows SDK import
  libraries that `lld-link` links against.
   rustc discovers them automatically and passes them as `/LIBPATH:`.
- `cmake` on PATH.
   The `opus` crate is pinned to the opusic-sys backend,
   which builds libopus 1.6.1 from source
  through the cmake crate (cmake drives the MSVC C compiler from Visual Studio).
   libopus 1.6.1's
  `cmake_minimum_required` is 3.16,
   so CMake 4.
  x configures it with no `CMAKE_POLICY_VERSION_MINIMUM` override.
- LLVM on PATH.
   `lld-link.exe` ships in LLVM's `bin` directory (`C:\Program Files\LLVM\bin`),
   which the LLVM
  installer does not add to PATH by default;
   add it so the linker resolves.
- `cargo-nextest` for the `test` task (the repo installs it as a mise tool,
   so `mise run ...:test` finds it).

mise runs task logic through node eval on Windows too (a per-task `shell = "node --input-type=module-typescript -e"`),
 so the
`mise run //package/music-player/desktop-app:...` commands below work unchanged.
 If the GPU OpenGL path
misbehaves,
 force the software renderer with `SLINT_BACKEND=winit-software`.

See `HANDOVER.windows-toolchain-and-check.md` for the step-by-step toolchain setup and the window/audio check.

## Commands

All commands run through mise tasks.
 On Linux,
 build,
 lint,
 and test run on the host when the dev libraries are
present and fall back to `podman run` otherwise;
 on macOS and Windows they always build natively with cargo (see
the platform subsections above).
 `run` builds the same way and then executes the binary directly.
 Run them from
this package directory,
 or prefix with the package path from the repository root.

```bash
# build the container image (only needed for the container path; the host
# fallback also builds it automatically when missing)
mise run //package/music-player/desktop-app:image

# compile checks (host if dev libs present, else container)
mise run //package/music-player/desktop-app:lint          # cargo check
mise run //package/music-player/desktop-app:lint:clippy   # clippy, warnings denied

# tests (queue, session, decode-per-codec)
mise run //package/music-player/desktop-app:test

# release build
mise run //package/music-player/desktop-app:build

# keyboard end-to-end run in the nested compositor (builds first)
mise run //package/music-player/desktop-app:test:e2e

# build, install to ~/.local/bin + ~/.local/share/applications,
# then run the GUI on the host (optional single folder or file arg)
mise run //package/music-player/desktop-app:run -- path/to/folder

# force the container path (asserts the container build still works on any host)
mise run //package/music-player/desktop-app:verify:container

# regenerate the per-codec test fixtures with host ffmpeg (rarely needed)
mise run //package/music-player/desktop-app:gen:fixtures
```

The binary also accepts a single optional path argument:
 a folder becomes the Source Root,
 and a file makes its parent folder the Source Root with that file preselected.
 A second positional argument is a parse error.
The argument loads paused;
 pass `--start-playing` to begin playback immediately instead.
 It is the only way to make the player auto-play on launch,
 so without it (and on every launch with no path) the app opens paused and waits for the play button.
The Open button uses the XDG desktop portal folder picker,
 and a chosen folder becomes the new Source Root,
 scanned recursively;
 a folder opened this way also loads paused.
 The picker offers folders only,
 so preselecting a single file is available only from the command line.
Argument parsing uses the `clap` crate,
 so `--help` and `--version` are available.

## Distribution and signing

For distribution outside the app stores,
 the macOS build ships as a signed,
 notarized `.app` and the Windows build
as an Authenticode-signed `.exe`.
 Each binary is built on its own operating system (the Mach-O on the Mac,
 the
`.exe` on Windows,
 as in the platform subsections above),
 then bundled and signed from the Linux box:
 `rcodesign`
signs and notarizes the macOS app,
 and `osslsigncode` (in `Containerfile.sign`) signs the Windows exe.
Cross-compiling the GUI from Linux is out of scope,
 so only the signing is cross-platform.
 The signing identity is
a registered organization,
 so the maintainer's legal name does not appear in the public signature.

The per-OS binary is copied into `dist/` (gitignored) after building,
 then:

```bash
# macOS: assemble the .app, sign it, then notarize + staple it
mise run //package/music-player/desktop-app:bundle:macos
mise run //package/music-player/desktop-app:sign:macos
mise run //package/music-player/desktop-app:notarize:macos

# Windows: Authenticode-sign the exe (osslsigncode in the sign container)
mise run //package/music-player/desktop-app:sign:windows

# self-signed end-to-end smoke test of the whole pipeline (no real credentials)
mise run //package/music-player/desktop-app:verify:signing

# regenerate the app icon (.icns + .ico) after editing asset/icon.svg
mise run //package/music-player/desktop-app:gen:icons
```

Each sign task reads its real credentials from environment variables and falls back to a throwaway self-signed
identity when they are unset,
 so the pipeline runs today;
 self-signed artifacts are not distributable.
 Acquiring
the real credentials is a one-time human task documented in `HANDOVER.macos-signing-credentials.md` and
`HANDOVER.windows-signing-credentials.md`.
 The design and the rejected alternatives are recorded in
`../../../doc/decisions/desktop-app-code-signing.md`.

## Session

On exit the engine saves the Source Root path,
 the Selected Track path (if one was selected),
 the playback position,
 volume,
 shuffle mode,
 repeat-track flag,
 and page-control style to a JSON file under the platform config directory (`$XDG_CONFIG_HOME/musicplayer` on Linux,
`~/Library/Application Support/dev.monochromatic.musicplayer` on macOS,
 the roaming AppData config directory on
Windows,
 all resolved by the `directories` crate).
It deliberately does not save the queue or a current index:
 the queue is re-derived from the Source Root,
 so only the root and the chosen track need persisting,
 and an older session file written by a previous version (carrying a queue and index) degrades gracefully,
 its unknown fields ignored and its missing ones defaulted.
Because `run` executes on the host,
 this is the real `~/.config/musicplayer`,
 persisting naturally across runs.
On launch,
 when no path
argument is given,
 the saved session is restored by re-scanning the saved Source Root to rebuild the queue from what is on disk now,
 reselecting the saved track by path when it still exists,
 and loading paused at the saved position.
 That launch rescan is the restore auto-correction:
 files added,
 removed,
 or renamed since the last run self-correct without a stale entry surviving.
 A command-line path takes precedence over a saved session.
 When the saved Source Root is missing or is no longer a directory,
 the user's music directory is restored instead (carrying the saved settings but no selection),
 so the queue is populated without playing.
 The directory is resolved from `XDG_MUSIC_DIR`,
 then the XDG
user-dirs file,
 then the `xdg-user-dir MUSIC` command;
 running on the host,
 these resolve directly,
 so no
bind-mount or `XDG_MUSIC_DIR` injection is needed.
 On macOS the `directories` crate resolves `~/Music`
directly,
 and the `xdg-user-dir` step simply falls through (that command does not exist there).
 On Windows the
`directories` crate resolves the Music known-folder (`%USERPROFILE%\Music`) directly,
 and the `xdg-user-dir`
fallback is compiled out entirely (it is gated `#[cfg(unix)]`).
