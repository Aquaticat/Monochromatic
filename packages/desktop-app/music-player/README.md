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
- `src/engine.rs`: the controller thread. It owns the queue, the active decoder, and the output, turns commands
  into playback, applies volume as PCM gain, auto-advances at track end, and emits position and state updates.
- `src/main.rs`: builds the Slint window, spawns the engine, and wires callbacks to commands and updates to
  properties.
- `ui/app.slint`: the window markup (now-playing label, seek bar, transport row, volume slider, queue list).

Three threads cooperate: the Slint event loop (UI), the engine controller thread, and PipeWire's own realtime
thread. The UI and engine talk over a command channel; updates return via `slint::invoke_from_event_loop`. The
engine and the realtime callback share audio through a single-producer/single-consumer ring buffer.

## Build environment

The host is an immutable-style Fedora without the PipeWire, Opus, and clang development headers, so all cargo work
runs inside a Fedora container defined by `Containerfile`. The image carries the build toolchain and the GUI/audio
runtime libraries; the `run` task passes the host Wayland, PipeWire, and D-Bus sockets and the DRI render node into
the container so the window and audio reach the host session.

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
JSON file under the platform config directory (`$XDG_CONFIG_HOME/music-player` on Linux). On launch, when no file
arguments are given, the saved session is restored: the queue, settings, and current track are reinstated and the
track is loaded paused at the saved position, with files that have since moved pruned out. Command-line path
arguments take precedence over a saved session.
