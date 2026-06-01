# music-player

A minimal native music player for Linux, built with the Slint GUI toolkit and a native PipeWire client.
Scope is deliberately small: Wayland and PipeWire only, an ad-hoc play queue, and broad codec coverage.

## Scope

- Output: Wayland for the window, PipeWire for audio. No X11 fallback, no ALSA/PulseAudio backends.
- Source: an ad-hoc queue. Opening a folder replaces the queue with the audio files found under it, scanning
  subfolders recursively. Command-line file or folder arguments are expanded the same way.
- Transport: play/pause, seek, volume, next/prev, shuffle, and repeat (off, all, one).
- Metadata: filename only. No tag parsing and no album art. The seek bar's position and duration come from the
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
- `src/queue.rs`: the play-queue model (load order, shuffle order, cursor, repeat), with a seedable PRNG for
  deterministic shuffle tests.
- `src/session.rs`: save and restore of the last session under the platform config directory, pruning files that moved.
- `src/error.rs`: `PlayerError`, the single error type all fallible functions return.
- `src/decode.rs`: probing and decoding to interleaved `f32` PCM behind a `Source` trait (`AudioSpec`, `open`).
- `src/opus.rs`: the libopus `Source` for Opus.
- `src/output.rs`: the PipeWire FFI boundary. It owns the thread loop, context, and core, and `reconfigure`
  builds an output stream at a track's native format, returning the producer half of a lock-free ring buffer.
- `src/playback.rs`: device-free playback helpers, kept apart so they are unit-testable: the per-sample
  gain-and-clamp stage, frame-to-seconds conversion, and recursive folder-to-file expansion.
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
- `src/main.rs`: builds the Slint window, spawns the engine, and wires callbacks to commands and updates to
  properties.
- `ui/app.slint`: the window markup (seek bar, transport row, volume slider, queue list). The playing track is
  the highlighted row in the list; there is no separate now-playing title.

Three threads cooperate: the Slint event loop (UI), the engine controller thread, and PipeWire's own realtime
thread. The UI and engine talk over a command channel; updates return via `slint::invoke_from_event_loop`. The
engine and the realtime callback share audio through a single-producer/single-consumer ring buffer.

## Build environment

The host is an immutable-style Fedora without the PipeWire, Opus, and clang development headers, so all cargo work
runs inside a Fedora container defined by `Containerfile`. The image carries the build toolchain and the GUI/audio
runtime libraries; the `run` task passes the host Wayland, PipeWire, and D-Bus sockets and the DRI render node into
the container so the window and audio reach the host session. The `run` task also uses `--userns=keep-id` so the
container runs under the host uid: the D-Bus session bus authenticates with SASL EXTERNAL, which checks the asserted
uid against the socket peer credential, and the dark/light theme watcher and the portal file picker (both using
zbus) are rejected otherwise. See `docs/troubleshooting/podman-dbus-external-keep-id.md`.

The image installs `google-noto-sans-cjk-fonts`. Slint 1.16's femtovg renderer lays out text with parley and
fontique with system fonts enabled, which falls back per script to a system font for glyphs the primary font
lacks; without a CJK font in the container, Japanese, Chinese, and Korean filenames render as blank boxes.

The source comments follow the repository's `dum-dum-non-ts` convention: every concept-introducing line carries a
plain-English explanation and a TypeScript translation, because the maintainer reads TypeScript fluently and Rust
less so.

## Commands

All commands run through mise tasks, which wrap `podman run`. Run them from this package directory, or prefix with
the package path from the repository root.

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

# run the GUI against the host Wayland + PipeWire (optional file/folder args)
mise run //packages/desktop-app/music-player:run -- path/to/song.flac path/to/folder

# regenerate the per-codec test fixtures with host ffmpeg (rarely needed)
mise run //packages/desktop-app/music-player:gen:fixtures
```

The binary also accepts file and folder paths as command-line arguments, which are enqueued and played on launch.
The Open button uses the XDG desktop portal folder picker, and a chosen folder is scanned recursively. Individual
files can be enqueued through command-line arguments (the portal cannot offer files and folders in one dialog).

## Session

On exit the engine saves the queue (file paths), current index, position, volume, and shuffle/repeat mode to a
JSON file under the platform config directory (`$XDG_CONFIG_HOME/music-player` on Linux). The `run` task sets
`XDG_CONFIG_HOME` to a `music-player-config` named volume so the session persists across runs and is not written
into the bind-mounted source tree. On launch, when no file
arguments are given, the saved session is restored: the queue, settings, and current track are reinstated and the
track is loaded paused at the saved position, with files that have since moved pruned out. Command-line path
arguments take precedence over a saved session. When no arguments are given and no queue remains to restore (none
was stored, or every saved file has since moved and was pruned away), the user's music directory is auto-loaded
paused, so the queue is populated without playing. The directory is resolved from `XDG_MUSIC_DIR`, then the XDG
user-dirs file, then the `xdg-user-dir MUSIC` command; if none yields an existing directory the queue starts empty.
The containerized `run` task bind-mounts the host music directory read-only and exports `XDG_MUSIC_DIR`, since the
music files and the user-dirs file are not otherwise visible inside the container.
