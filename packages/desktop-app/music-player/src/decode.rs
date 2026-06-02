//! Decoding: turn an audio file on disk into interleaved `f32` PCM samples.
//!
//! One demux path (symphonia probes the container and demuxes packets) feeds
//! two decode paths: symphonia's own decoders for FLAC/WAV/MP3/Vorbis/AAC/ALAC,
//! and the `opus` crate (libopus) for Opus, because the symphonia 0.6 meta-crate
//! exposes no Opus decoder (the `symphonia-codec-opus` crate exists but is not
//! wired into the `all` feature set). `open()` picks the path; both implement
//! `Source`.

// What:     `use std::fs::File;` brings the file-handle type into scope. `File`
//           is an owning handle to an open OS file; dropping it closes the file.
// Why:      We open the audio file and hand the handle to symphonia's stream.
// TS map:   no direct type; closest is a `fs.FileHandle` from `fs/promises`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { open as fsOpen } from "node:fs/promises";
// ```
use std::fs::File;

// What:     `use std::path::Path;` imports the borrowed filesystem-path type.
//           `Path` is an unsized, borrowed view of a path (sibling: `PathBuf`,
//           the owned, growable version, like `&str` vs `String`).
// Why:      `open`/`decode_all` take `&Path` because they only read the path,
//           they do not need to own it.
// TS map:   just `string` — TS models paths as plain strings.
//
// In TS you'd write (pseudocode):
// ```ts
// type Path = string;
// ```
use std::path::Path;

// What:     `use symphonia::core::codecs::audio::{AudioDecoder, AudioDecoderOptions};`
//           imports decode machinery from the 0.6 `audio` codec sub-module:
//           `AudioDecoder` (the trait every audio decoder implements; was the
//           un-prefixed `Decoder` in 0.5, renamed because 0.6 also has video and
//           subtitle decoder traits), `AudioDecoderOptions` (decoder knobs; we use
//           defaults, which keep gapless playback on; was `DecoderOptions` in 0.5).
// Why:      `SymphoniaSource` holds a `Box<dyn AudioDecoder>` and builds it with
//           default options.
// TS map:   importing two named exports from one module.
//
// In TS you'd write (pseudocode):
// ```ts
// import { AudioDecoder, AudioDecoderOptions } from "symphonia/codecs/audio";
// ```
use symphonia::core::codecs::audio::{AudioDecoder, AudioDecoderOptions};

// What:     `use symphonia::core::codecs::audio::well_known::CODEC_ID_OPUS;` imports
//           the Opus codec id constant (an `AudioCodecId`, a newtype around `u32`,
//           value 0x1001). In 0.5 this was the top-level `CODEC_TYPE_OPUS`; 0.6
//           moved well-known codec ids into a `well_known` sub-module and made each
//           codec family (audio/video/subtitle) its own id type.
// Why:      We compare the track's codec id against it to route Opus to libopus.
// TS map:   `import { CODEC_ID_OPUS } from "symphonia/codecs/audio/wellKnown";`
//
// In TS you'd write (pseudocode):
// ```ts
// import { CODEC_ID_OPUS } from "symphonia/codecs/audio/wellKnown";
// ```
use symphonia::core::codecs::audio::well_known::CODEC_ID_OPUS;

// What:     `use symphonia::core::errors::Error;` imports symphonia's own error
//           enum (IoError, DecodeError, ResetRequired, ...). Same path and variants
//           as 0.5.
// Why:      We match its variants to skip a bad packet apart from real failures.
// TS map:   a tagged-union error type from the library.
//
// In TS you'd write (pseudocode):
// ```ts
// import { SymphoniaError } from "symphonia/errors";
// ```
use symphonia::core::errors::Error;

// What:     `use symphonia::core::formats::probe::Hint;` imports a struct that gives
//           the prober a hint (like the file extension) to speed format detection.
//           In 0.5 this lived at `symphonia::core::probe::Hint`; 0.6 moved the whole
//           `probe` module under `formats`.
// Why:      We pass the file extension so probing is fast and reliable.
// TS map:   a small options object carrying `{ extension?: string }`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Hint } from "symphonia/formats/probe";
// ```
use symphonia::core::formats::probe::Hint;

// What:     `use symphonia::core::formats::{...};` imports demuxer types:
//           `FormatOptions` (demux knobs, defaults), `FormatReader` (the trait a
//           demuxed container implements: lists tracks, yields packets), `SeekMode`
//           (Accurate vs Coarse), `SeekTo` (where to seek: by time or by frame),
//           `Track` (one track's id + codec params + timing), `TrackType` (audio /
//           video / subtitle, used to ask for the first audio track).
// Why:      We probe into a `FormatReader`, pick the first audio `Track`, pull
//           packets, and seek by absolute frame.
// TS map:   named imports describing a container reader.
//
// In TS you'd write (pseudocode):
// ```ts
// import { FormatOptions, FormatReader, SeekMode, SeekTo, Track, TrackType } from "symphonia/formats";
// ```
use symphonia::core::formats::{
    FormatOptions, FormatReader, SeekMode, SeekTo, Track, TrackType,
};

// What:     `use symphonia::core::io::MediaSourceStream;` imports the buffered
//           stream wrapper symphonia reads bytes from.
// Why:      symphonia's probe takes a `MediaSourceStream`, not a raw `File`.
// TS map:   a `ReadableStream`-like adapter around the file.
//
// In TS you'd write (pseudocode):
// ```ts
// import { MediaSourceStream } from "symphonia/io";
// ```
use symphonia::core::io::MediaSourceStream;

// What:     `use symphonia::core::meta::MetadataOptions;` imports the tag/meta
//           reader knobs (we pass defaults; we ignore tags entirely).
// Why:      The probe call requires a `MetadataOptions` argument.
// TS map:   an options object we leave at defaults.
//
// In TS you'd write (pseudocode):
// ```ts
// import { MetadataOptions } from "symphonia/meta";
// ```
use symphonia::core::meta::MetadataOptions;

// What:     `use symphonia::core::units::{Duration, Timestamp};` imports symphonia's
//           0.6 timeline new-types. `Timestamp` wraps an `i64` count of timebase
//           ticks (for these audio formats one tick = one frame at the sample rate);
//           `Duration` wraps a `u64` span of the same ticks. In 0.5 `TimeStamp` was a
//           bare `u64` alias; 0.6 made both real types that force checked/saturating
//           arithmetic. Sibling you might expect for seeking: `Time` (seconds), which
//           we deliberately do NOT use, because `SeekTo::Time` maps second 0 to frame
//           0, and Ogg/Opus streams start at a non-zero frame (the encoder pre-skip),
//           so "seek to 0 seconds" gets rejected as out-of-range; we seek by absolute
//           frame instead (see `seek_format`).
// Why:      `SeekTo::Timestamp` needs a `Timestamp`; `Timestamp::saturating_add` adds
//           a `Duration`, which lets us offset the stream's start frame so "the
//           beginning" lands on the real first frame rather than the invalid frame 0.
// TS map:   `type Timestamp = number; type Duration = number;` (counts of frames).
//
// In TS you'd write (pseudocode):
// ```ts
// import { Duration, Timestamp } from "symphonia/units";
// ```
use symphonia::core::units::{Duration, Timestamp};

// What:     `use crate::error::PlayerError;` imports our one app-wide error
//           type. `crate::` means "from the root of this crate" (sibling form:
//           `super::` = parent module, `self::` = current module).
// Why:      Every fallible function here returns `PlayerError`.
// TS map:   `import { PlayerError } from "../error";` (absolute-from-root).
//
// In TS you'd write (pseudocode):
// ```ts
// import { PlayerError } from "@/error";
// ```
use crate::error::PlayerError;

// What:     `use crate::opus::OpusSource;` imports the Opus-specific decoder
//           source defined in our sibling `opus.rs` module.
// Why:      `open()` constructs an `OpusSource` when the track is Opus.
// TS map:   `import { OpusSource } from "./opus";`
//
// In TS you'd write (pseudocode):
// ```ts
// import { OpusSource } from "./opus";
// ```
use crate::opus::OpusSource;

// What:     `#[derive(Clone, Copy, Debug)]` auto-generates three traits:
//           `Clone` (explicit duplication), `Copy` (cheap implicit bitwise
//           copy on assignment, since every field is a plain number), `Debug`
//           (`{:?}` printing).
// Why:      `Copy` lets us return an `AudioSpec` by value freely without
//           ownership ceremony; `Debug` helps tests print mismatches.
// TS map:   plain object literals are always copied-by-reference in TS; here
//           the values are tiny and copied by value.
//
// In TS you'd write (pseudocode):
// ```ts
// // no decorator; just an interface below
// ```
#[derive(Clone, Copy, Debug)]
// What:     `pub struct AudioSpec { ... }` declares a public record describing
//           a decoded stream's shape. Fields:
//           - `rate: u32`. Unsigned 32-bit integer of samples-per-second
//             (e.g. 44100, 48000). Siblings a reader might expect: `u16` (too
//             small, 48000 > 65535? no, but 96000/192000 overflow `u16`),
//             `u64`/`usize` (overkill), `i32` (rate is never negative).
//           - `channels: u16`. Channel count (1 = mono, 2 = stereo). Siblings:
//             `u8` (would fit, but `u16` is the conventional audio-API width),
//             `usize` (that's for memory indexing, not a small fixed count),
//             `u32` (more range than any real layout needs).
//           - `duration_secs: f64`. Track length in seconds as a 64-bit float.
//             Sibling: `f32` (too coarse for long tracks: at f32, a 1-hour
//             track loses sub-second precision), `u64` frames (the UI thinks in
//             seconds, not frames), `Duration` (we standardised on bare f64
//             seconds across the engine).
// Why:      Callers (engine, UI, tests) need rate + channels to configure
//           PipeWire and the seek/position bar's total length.
// TS map:   `type AudioSpec = { rate: number; channels: number; durationSecs: number };`
//
// In TS you'd write (pseudocode):
// ```ts
// type AudioSpec = { rate: number; channels: number; durationSecs: number };
// ```
pub struct AudioSpec {
    // What:     samples per second; see the struct comment for the type choice.
    // Why:      PipeWire needs the native rate to set up the stream.
    // TS map:   `rate: number`.
    pub rate: u32,
    // What:     channel count; see the struct comment for the type choice.
    // Why:      Interleaving and PipeWire layout both need the channel count.
    // TS map:   `channels: number`.
    pub channels: u16,
    // What:     total seconds; see the struct comment for the type choice.
    // Why:      The seek bar's maximum and the "x:xx / y:yy" label use it.
    // TS map:   `durationSecs: number`.
    pub duration_secs: f64,
}

// What:     `pub trait Source: Send { ... }` declares an interface (`trait`)
//           that any decode source must implement. `: Send` is a SUPERTRAIT
//           bound meaning "values of this type are safe to move to another
//           thread". Sibling bound: `Sync` ("safe to share by reference across
//           threads") which we do NOT require, because only one thread (the
//           engine) ever touches a `Source`.
// Why:      The engine runs on its own thread and owns the active source, so
//           the source must be `Send`. The trait lets symphonia and Opus
//           sources be used interchangeably behind `Box<dyn Source>`.
// TS map:   `interface Source { ... }` — but TS has no thread-safety marker.
//
// In TS you'd write (pseudocode):
// ```ts
// interface Source {
//   spec(): AudioSpec;
//   nextChunk(): number[];   // empty array means EOF
//   seek(secs: number): void;
// }
// ```
pub trait Source: Send {
    // What:     `fn spec(&self) -> AudioSpec;` a method signature (no body, the
    //           implementor provides it). `&self` borrows the source read-only.
    // Why:      Callers query rate/channels/duration without consuming it.
    // TS map:   `spec(): AudioSpec;`
    fn spec(&self) -> AudioSpec;

    // What:     `fn next_chunk(&mut self) -> Result<Vec<f32>, PlayerError>;`.
    //           `&mut self` = exclusive borrow (decoding advances internal
    //           state). `Vec<f32>` is an owned, growable array of 32-bit floats
    //           (sibling: `&[f32]` borrowed slice, `[f32; N]` fixed array); we
    //           return owned so the caller can keep it past this call. An EMPTY
    //           `Vec` is the agreed signal for end-of-stream.
    // Why:      Pull the next block of interleaved samples, or learn we are done.
    // TS map:   `nextChunk(): number[];  // [] means EOF`
    fn next_chunk(&mut self) -> Result<Vec<f32>, PlayerError>;

    // What:     `fn seek(&mut self, secs: f64) -> Result<(), PlayerError>;`.
    //           `Result<(), E>` means "succeeds with no value, or fails with E";
    //           `()` is the empty/unit type (like `void`).
    // Why:      Jump playback to a position in seconds.
    // TS map:   `seek(secs: number): void;` (throwing on failure)
    fn seek(&mut self, secs: f64) -> Result<(), PlayerError>;
}

// What:     `pub fn open(path: &Path) -> Result<Box<dyn Source>, PlayerError>`.
//           `Box<dyn Source>` is an owning pointer to a heap value whose
//           concrete type is erased to "something implementing `Source`"
//           (dynamic dispatch). Siblings: `Rc<dyn Source>` / `Arc<dyn Source>`
//           are SHARED pointers; we use `Box` because exactly one owner (the
//           engine) holds the source.
// Why:      Probe the file, find its audio track, and return the right kind of
//           decoder without the caller caring which.
// TS map:   `function open(path: string): Source` (returns an interface value).
//
// In TS you'd write (pseudocode):
// ```ts
// function open(path: string): Source { ... }
// ```
pub fn open(path: &Path) -> Result<Box<dyn Source>, PlayerError> {
    // What:     `File::open(path)?`. `File::open` returns `Result<File, io::Error>`;
    //           the `?` operator UNWRAPS the `Ok` value, or RETURNS the error
    //           early (converting it to `PlayerError` via our `From` impl).
    // Why:      Get an OS handle to the audio file, or bail with an i/o error.
    // TS map:   `const file = await fsOpen(path);` (a throw replaces `?`).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const file = await fsOpen(path);
    // ```
    let file = File::open(path)?;

    // What:     `MediaSourceStream::new(Box::new(file), Default::default())`.
    //           `Box::new(file)` heap-allocates the file and erases it to the
    //           `MediaSource` trait object the stream wants. `Default::default()`
    //           builds the default options struct (type inferred from the arg).
    // Why:      symphonia reads bytes through this buffered stream wrapper.
    // TS map:   `const mss = new MediaSourceStream(file, {});`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const mss = new MediaSourceStream(file, {});
    // ```
    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    // What:     `let mut hint = Hint::new();`. `Hint::new()` is a constructor
    //           returning an empty hint. `mut` marks the binding mutable so we
    //           can add the extension below.
    // Why:      A starting point to tell the prober the file's extension.
    // TS map:   `const hint = new Hint();` (we mutate it next).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const hint = new Hint();
    // ```
    let mut hint = Hint::new();

    // What:     `if let Some(ext) = path.extension().and_then(|e| e.to_str())`.
    //           `path.extension()` returns `Option<&OsStr>` (the extension, or
    //           `None`). `.and_then(|e| e.to_str())` runs the closure only if
    //           present; `e.to_str()` converts the OS string to `Option<&str>`
    //           (fails on non-UTF-8). `if let Some(ext) = ...` runs the body
    //           only when both succeeded, binding the inner `&str` to `ext`.
    //           `|e| e.to_str()` is a closure (anonymous function) of one arg.
    // Why:      Feed the extension as a hint so probing is fast/reliable.
    // TS map:   `const ext = path.split(".").pop(); if (ext) { ... }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const ext = extname(path).replace(/^\./, "");
    // if (ext) hint.withExtension(ext);
    // ```
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        // What:     `hint.with_extension(ext);` records the extension on the hint.
        // Why:      Gives the prober a strong signal of the container format.
        // TS map:   `hint.withExtension(ext);`
        hint.with_extension(ext);
    }

    // What:     `symphonia::default::get_probe().probe(&hint, mss, FormatOptions::default(),
    //           MetadataOptions::default())?`. `get_probe()` returns the global format
    //           prober; `.probe(...)` sniffs the stream and returns
    //           `Result<Box<dyn FormatReader>>` (in 0.5 this was `.format(...)`
    //           returning a `ProbeResult` you then unwrapped via `.format`; 0.6 hands
    //           the reader back directly). `&hint` lends the hint read-only; `mss` is
    //           MOVED in (the stream is consumed); the option structs are now passed
    //           BY VALUE (0.5 took `&` references). Trailing `?` unwraps or returns.
    // Why:      Detect the container and obtain a demuxer for it.
    // TS map:   `const format = getProbe().probe(hint, mss, {}, {});`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const format = getProbe().probe(hint, mss, {}, {});
    // ```
    let format = symphonia::default::get_probe().probe(
        &hint,
        mss,
        FormatOptions::default(),
        MetadataOptions::default(),
    )?;

    // What:     a BLOCK expression `{ ... }` that produces a `(u32, bool, Track)`
    //           tuple and binds it to `(track_id, is_opus, track)`. The block scopes
    //           the immutable borrow of `format` (from `.first_track_known_codec()`)
    //           so it ends before we move `format` into the source below.
    // Why:      Read the track id, decide if it is Opus, and clone the track, then
    //           release the borrow so `format` is free to move.
    // TS map:   `const { trackId, isOpus, track } = (() => { ... })();`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const [trackId, isOpus, track] = (() => {
    //   const t = format.firstTrackKnownCodec(TrackType.Audio);
    //   if (!t) throw new PlayerError.Unsupported("no audio track");
    //   const audio = t.codecParams?.audio();
    //   if (!audio) throw new PlayerError.Unsupported("track has no audio codec parameters");
    //   return [t.id, audio.codec === CODEC_ID_OPUS, structuredClone(t)];
    // })();
    // ```
    let (track_id, is_opus, track) = {
        // What:     `format.first_track_known_codec(TrackType::Audio)`. A 0.6
        //           `FormatReader` helper: returns `Option<&Track>` for the first
        //           AUDIO track whose codec id is known (non-null). This replaces the
        //           0.5 `tracks().iter().find(|t| t.codec_params.codec != CODEC_TYPE_NULL)`.
        // Why:      Locate the first decodable audio track.
        // TS map:   `format.firstTrackKnownCodec(TrackType.Audio)`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const track = format.firstTrackKnownCodec(TrackType.Audio);
        // ```
        let track = format
            .first_track_known_codec(TrackType::Audio)
            // What:     `.ok_or_else(|| PlayerError::Unsupported(...))?`. Converts the
            //           `Option<&Track>` into a `Result`: `Some(x)` -> `Ok(x)`,
            //           `None` -> `Err(closure())`. `.to_string()` makes an OWNED
            //           `String` from the `&str` literal. Trailing `?` unwraps the
            //           `&Track` or returns the error.
            // Why:      A file with no audio track is unsupported; report it.
            // TS map:   `if (!track) throw new PlayerError.Unsupported("no audio track");`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // if (!track) throw new PlayerError.Unsupported("no audio track");
            // ```
            .ok_or_else(|| PlayerError::Unsupported("no audio track".to_string()))?;

        // What:     `track.codec_params.as_ref().and_then(|cp| cp.audio())`. In 0.6
        //           `Track::codec_params` is `Option<CodecParameters>` (an enum over
        //           audio/video/subtitle); `.as_ref()` turns `&Option<_>` into
        //           `Option<&CodecParameters>`; `.and_then(|cp| cp.audio())` maps it to
        //           `Option<&AudioCodecParameters>` (the audio variant) via the closure
        //           `|cp| cp.audio()`. `.ok_or_else(...)?` unwraps or errors.
        // Why:      We need the audio codec id to decide whether this is Opus.
        // TS map:   `const audio = track.codecParams?.audio(); if (!audio) throw ...;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const audio = track.codecParams?.audio();
        // if (!audio) throw new PlayerError.Unsupported("track has no audio codec parameters");
        // ```
        let audio_params = track
            .codec_params
            .as_ref()
            .and_then(|cp| cp.audio())
            .ok_or_else(|| {
                PlayerError::Unsupported("track has no audio codec parameters".to_string())
            })?;

        // What:     `(track.id, audio_params.codec == CODEC_ID_OPUS, track.clone())`.
        //           `track.id` is a `u32` (Copy). `audio_params.codec == CODEC_ID_OPUS`
        //           compares the `AudioCodecId` new-types (both `Copy`, `Eq`).
        //           `track.clone()` DEEP-COPIES the `Track` (id + codec params + timing)
        //           so it outlives the `format` borrow. Tail expression -> block value.
        // Why:      We need an owned `Track` (carrying delay/num_frames/start_ts and the
        //           audio params) to hand the source after we move `format`.
        // TS map:   `[track.id, audio.codec === CODEC_ID_OPUS, structuredClone(track)]`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return [track.id, audio.codec === CODEC_ID_OPUS, structuredClone(track)];
        // ```
        (track.id, audio_params.codec == CODEC_ID_OPUS, track.clone())
    };

    // What:     `if is_opus { ... } else { ... }`. Branch on the Opus flag computed
    //           above (the `track`/`format` borrow has ended, so `format` can move).
    // Why:      Opus needs the libopus path; everything else uses symphonia.
    // TS map:   `if (isOpus) { ... } else { ... }`
    if is_opus {
        // What:     `OpusSource::new(format, track, track_id)?`. Calls the Opus source
        //           constructor, MOVING `format` and the owned `track` into it. `?`
        //           unwraps or returns the error.
        // Why:      Build the libopus-backed source.
        // TS map:   `const source = OpusSource.create(format, track, trackId);`
        let source = OpusSource::new(format, track, track_id)?;

        // What:     `Ok(Box::new(source))`. `Box::new(source)` heap-allocates and
        //           erases the concrete type to `dyn Source`; `Ok(...)` wraps it
        //           as the success value. Tail expression -> returned.
        // Why:      Hand back the boxed trait object on success.
        // TS map:   `return source;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return source;
        // ```
        Ok(Box::new(source))
    } else {
        // What:     `SymphoniaSource::new(format, track, track_id)?`. Builds the
        //           symphonia-decoder source, moving `format`/`track` in.
        // Why:      Decode FLAC/WAV/MP3/Vorbis/AAC/ALAC with symphonia.
        // TS map:   `const source = SymphoniaSource.create(format, track, trackId);`
        let source = SymphoniaSource::new(format, track, track_id)?;

        // What:     `Ok(Box::new(source))`. Same boxing/wrapping as above.
        // Why:      Return the boxed trait object.
        // TS map:   `return source;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return source;
        // ```
        Ok(Box::new(source))
    }
}

// What:     `pub(crate) fn seek_format(format: &mut dyn FormatReader, track_id: u32,
//           secs: f64) -> Result<(), PlayerError>`. Reposition a demuxer to a
//           wall-clock offset, expressed as SECONDS FROM THE AUDIBLE START, by
//           converting it to an ABSOLUTE frame timestamp the container accepts.
//           `&mut dyn FormatReader` is a mutable borrow of any demuxer (we lend it,
//           the caller keeps ownership; sibling `Box<dyn FormatReader>` would take
//           ownership, which we do not want here).
// Why:      `SeekTo::Time { time: 0s }` maps to frame 0, but Ogg/Opus streams begin
//           at a non-zero frame (the encoder pre-skip becomes the track's
//           `start_ts`), so seeking to "0 seconds" was rejected with
//           "requested seek timestamp is out-of-range for stream" whenever the user
//           dragged the bar to the very beginning. Adding `start_ts` makes second 0
//           land on the real first audible frame. Shared by both decode paths
//           (`SymphoniaSource` here and `OpusSource` in `opus.rs`) so the fix and the
//           timeline math live in exactly one place.
// TS map:   `function seekFormat(format: FormatReader, trackId: number, secs: number): void`
//
// In TS you'd write (pseudocode):
// ```ts
// function seekFormat(format, trackId, secs) {
//   const track = format.tracks().find((t) => t.id === trackId);
//   if (!track) throw new Error("seek: track not found");
//   const startTs = track.startTs;            // 0.6: timing lives on Track
//   const nFrames = track.numFrames;          // 0.6: was track.codecParams.nFrames
//   const sampleRate = track.codecParams?.audio()?.sampleRate;
//   if (sampleRate == null) throw new Error("seek: unknown sample rate");
//   const offset = Math.round(Math.max(0, secs) * sampleRate);
//   let ts = startTs + offset;
//   if (nFrames != null) ts = Math.min(ts, startTs + nFrames);
//   format.seek("accurate", { ts, trackId });
// }
// ```
pub(crate) fn seek_format(
    format: &mut dyn FormatReader,
    track_id: u32,
    secs: f64,
) -> Result<(), PlayerError> {
    // What:     `format.tracks().iter().find(|t| t.id == track_id)`. `tracks()`
    //           borrows the demuxer's track list (`&[Track]`, a borrowed slice;
    //           siblings `Vec<Track>`/`[Track; N]` would be owned/fixed-size);
    //           `.iter()` makes a read-only cursor over it; `.find(|t| ...)` returns
    //           the first track whose `id` matches, as `Option<&Track>`. The closure
    //           `|t| t.id == track_id` takes each track by reference `t` and compares
    //           its `id` field. `.ok_or_else(|| ...)` turns `None` into our error.
    //           `?` unwraps the `Some` or returns the error.
    // Why:      We need this track's timeline parameters; a missing id means the
    //           caller passed a stale track, which is a real failure.
    // TS map:   `const track = format.tracks().find((t) => t.id === trackId);
    //            if (!track) throw new Error("seek: track not found");`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const track = format.tracks().find((t) => t.id === trackId);
    // if (!track) throw new Error("seek: track not found");
    // ```
    let track = format
        .tracks()
        .iter()
        .find(|t| t.id == track_id)
        .ok_or_else(|| PlayerError::Unsupported("seek: track not found".to_string()))?;

    // What:     `let start_ts: Timestamp = track.start_ts;`. Copy the track's
    //           first-frame timestamp out of the borrowed track. In 0.6 timing lives
    //           directly on `Track` (was `codec_params.start_ts` in 0.5). `Timestamp`
    //           is a `Copy` new-type around `i64` (sibling `Time` would be seconds,
    //           which we are avoiding).
    // Why:      For Ogg/Opus this is the pre-skip frame; adding it shifts our
    //           "seconds from audible start" onto the container's absolute timeline.
    // TS map:   `const startTs = track.startTs;`
    let start_ts: Timestamp = track.start_ts;

    // What:     `let rate = track.codec_params.as_ref().and_then(|cp| cp.audio())
    //           .and_then(|a| a.sample_rate).ok_or_else(|| ...)?;`. Dig the sample rate
    //           out of the optional audio codec params: `.as_ref()` borrows the
    //           `Option<CodecParameters>`, `.and_then(|cp| cp.audio())` selects the
    //           audio variant (`Option<&AudioCodecParameters>`), `.and_then(|a|
    //           a.sample_rate)` reads its `Option<u32>` rate. `.ok_or_else(|| ...)`
    //           turns any `None` along the way into our error; `?` unwraps.
    // Why:      We convert seconds to frames with the rate; without it the seek target
    //           is undefined, so failing loudly beats guessing.
    // TS map:   `const rate = track.codecParams?.audio()?.sampleRate; if (rate == null) throw ...;`
    let rate = track
        .codec_params
        .as_ref()
        .and_then(|cp| cp.audio())
        .and_then(|a| a.sample_rate)
        .ok_or_else(|| PlayerError::Unsupported("seek: unknown sample rate".to_string()))?;

    // What:     `let n_frames = track.num_frames;`. Copy the optional total audible
    //           frame count (`Option<u64>`; `Some(n)` if the container knew the length,
    //           `None` otherwise). In 0.6 this is `Track::num_frames` (was
    //           `codec_params.n_frames` in 0.5).
    // Why:      Used below to clamp the seek so we never ask for a frame past the end.
    //           This is the last read of `track`, so the borrow of `format` ends here
    //           and the mutable `format.seek(...)` below is allowed.
    // TS map:   `const nFrames = track.numFrames;`
    let n_frames = track.num_frames;

    // What:     `let secs_clamped = if secs > 0.0 { secs } else { 0.0 };`. Floor the
    //           requested offset at zero.
    // Why:      The slider's minimum is 0, but a stray negative would make the
    //           frame-count cast below saturate oddly; clamping keeps it well-defined.
    // TS map:   `const secsClamped = Math.max(0, secs);`
    let secs_clamped = if secs > 0.0 { secs } else { 0.0 };

    // What:     `let offset_frames = (secs_clamped * f64::from(rate)).round() as u64;`.
    //           `f64::from(rate)` widens the `u32` rate to `f64` losslessly; the
    //           multiply gives a fractional frame count; `.round()` picks the nearest
    //           whole frame; `as u64` truncates the now-integral float to a frame
    //           count (a float-to-int `as` cast saturates at 0 / `u64::MAX` instead of
    //           wrapping).
    // Why:      Convert "seconds from start" into "frames from start".
    // TS map:   `const offsetFrames = Math.round(secsClamped * rate);`
    let offset_frames = (secs_clamped * f64::from(rate)).round() as u64;

    // What:     `let mut target_ts: Timestamp = start_ts.saturating_add(Duration::new(offset_frames));`.
    //           `mut` because we may clamp it below. `Duration::new(offset_frames)`
    //           wraps the `u64` frame offset as a `Duration` (0.6 forces typed timeline
    //           arithmetic). `Timestamp::saturating_add(Duration)` adds without
    //           overflowing (caps instead of wrapping; sibling `checked_add` would
    //           return `Option` instead).
    // Why:      The absolute frame to seek to is the stream's start plus our offset.
    // TS map:   `let targetTs = startTs + offsetFrames;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let targetTs = startTs + offsetFrames;
    // ```
    let mut target_ts: Timestamp = start_ts.saturating_add(Duration::new(offset_frames));

    // What:     `if let Some(n_frames) = n_frames { ... }`. Run the block only when the
    //           total length is known, binding the inner `u64` to `n_frames`.
    // Why:      Only clamp when we actually know where the end is.
    // TS map:   `if (nFrames != null) { ... }`
    if let Some(n_frames) = n_frames {
        // What:     `let max_ts = start_ts.saturating_add(Duration::new(n_frames));`.
        //           The last valid absolute frame is the start plus the audible length;
        //           `Duration::new(n_frames)` wraps the `u64` count as a `Duration`.
        // Why:      Compute the upper bound the demuxer will accept.
        // TS map:   `const maxTs = startTs + nFrames;`
        let max_ts = start_ts.saturating_add(Duration::new(n_frames));

        // What:     `if target_ts > max_ts { target_ts = max_ts; }`. `Timestamp` derives
        //           `Ord`, so `>` compares the wrapped `i64`s directly. Pull the target
        //           back to the end if rounding pushed it past the final frame.
        // Why:      Seeking one frame past the end would itself be out-of-range; the
        //           slider's maximum equals the duration, so this guards that edge.
        // TS map:   `if (targetTs > maxTs) targetTs = maxTs;`
        if target_ts > max_ts {
            target_ts = max_ts;
        }
    }

    // What:     `format.seek(SeekMode::Accurate, SeekTo::Timestamp { ts: target_ts,
    //           track_id })?`. `SeekMode::Accurate` lands exactly (sibling `Coarse` is
    //           fast but approximate). `SeekTo::Timestamp { ... }` seeks by an absolute
    //           timestamp (sibling `SeekTo::Time` seeks by seconds, which is what caused
    //           the out-of-range bug). `seek` returns `Result<SeekedTo>`; we discard the
    //           `SeekedTo` (the `;`) and let `?` convert/propagate any symphonia error.
    // Why:      Perform the actual reposition at the corrected absolute frame.
    // TS map:   `format.seek("accurate", { ts: targetTs, trackId });`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // format.seek("accurate", { ts: targetTs, trackId });
    // ```
    format.seek(
        SeekMode::Accurate,
        SeekTo::Timestamp {
            ts: target_ts,
            track_id,
        },
    )?;

    // What:     `Ok(())`. Wrap the unit value `()` as success. Tail -> return.
    // Why:      Seek succeeded; there is no value to hand back.
    // TS map:   `return;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return;
    // ```
    Ok(())
}

// What:     `struct SymphoniaSource { ... }`. A record holding the live decode
//           state for a non-Opus track.
// Why:      Bundles the demuxer + decoder + reusable buffer so `next_chunk`/
//           `seek` can advance them.
// TS map:   `class SymphoniaSource implements Source { ... }`
struct SymphoniaSource {
    // What:     `format: Box<dyn FormatReader>`. An owning, heap, type-erased
    //           demuxer. (Sibling pointers `Rc`/`Arc` would be shared; this is
    //           single-owner.)
    // Why:      We pull packets from it each `next_chunk`.
    // TS map:   `format: FormatReader;`
    format: Box<dyn FormatReader>,
    // What:     `decoder: Box<dyn AudioDecoder>`. Owning, heap, type-erased audio
    //           decoder (0.6 renamed the 0.5 `Decoder` trait to `AudioDecoder`).
    // Why:      Turns packets into PCM audio buffers.
    // TS map:   `decoder: AudioDecoder;`
    decoder: Box<dyn AudioDecoder>,
    // What:     `track_id: u32`. The id of the track we decode (a packet stream
    //           may interleave several tracks). `u32` because symphonia ids are
    //           `u32` (sibling `usize` would force casts against the API).
    // Why:      Skip packets that belong to other tracks.
    // TS map:   `trackId: number;`
    track_id: u32,
    // What:     `spec: AudioSpec`. The cached rate/channels/duration. NOTE: for
    //           some codecs (AAC/ALAC in MP4) the channel count is unknown until
    //           the first packet is decoded, so `new` refreshes this after priming.
    // Why:      `spec()` returns it without recomputing.
    // TS map:   `spec: AudioSpec;`
    spec: AudioSpec,
    // What:     `pending: Option<Vec<f32>>`. The first decoded chunk, buffered by
    //           `new` while priming. `Some(chunk)` until the first `next_chunk`
    //           consumes it, then `None`.
    // Why:      Priming decodes one packet early (to learn the real spec) and
    //           must not lose that first audio block.
    // TS map:   `pending: number[] | null;`
    pending: Option<Vec<f32>>,
    // What:     `n_frames: Option<u64>`. Total decoded frames the container
    //           reported, if known (`u64` because frame counts of long tracks
    //           exceed `u32`; sibling `usize` would vary by platform width).
    // Why:      Duration is recomputed (`n_frames / rate`) after priming reveals
    //           the true rate.
    // TS map:   `nFrames: number | null;`
    n_frames: Option<u64>,
}

// What:     `impl SymphoniaSource { ... }`. An inherent-method block (methods
//           tied to the type itself, not to a trait).
// Why:      Holds the `new` constructor.
// TS map:   the non-interface methods of the class.
impl SymphoniaSource {
    // What:     `fn new(format: Box<dyn FormatReader>, track: Track,
    //           track_id: u32) -> Result<Self, PlayerError>`. `Self` is the type
    //           being impl'd (`SymphoniaSource`). Takes ownership of `format` and the
    //           owned `track` (0.6 moved timing onto `Track`, so we keep the whole
    //           track instead of just the codec params).
    // Why:      Build a decoder from the track's audio params and cache the spec.
    // TS map:   `static create(format, track, trackId): SymphoniaSource`
    fn new(
        format: Box<dyn FormatReader>,
        track: Track,
        track_id: u32,
    ) -> Result<Self, PlayerError> {
        // What:     `let audio_params = track.codec_params.as_ref().and_then(|cp|
        //           cp.audio()).ok_or_else(|| ...)?;`. Dig the audio codec params out of
        //           the optional `CodecParameters` enum: `.as_ref()` borrows the
        //           `Option`, `.and_then(|cp| cp.audio())` selects the audio variant.
        //           `.ok_or_else(...)` turns `None` into our error; `?` unwraps to a
        //           `&AudioCodecParameters`.
        // Why:      `make_audio_decoder` and the initial spec both read from it.
        // TS map:   `const audio = track.codecParams?.audio(); if (!audio) throw ...;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const audio = track.codecParams?.audio();
        // if (!audio) throw new PlayerError.Unsupported("track has no audio codec parameters");
        // ```
        let audio_params = track
            .codec_params
            .as_ref()
            .and_then(|cp| cp.audio())
            .ok_or_else(|| {
                PlayerError::Unsupported("track has no audio codec parameters".to_string())
            })?;

        // What:     `symphonia::default::get_codecs().make_audio_decoder(audio_params,
        //           &AudioDecoderOptions::default())?`. `get_codecs()` returns the global
        //           codec registry; `.make_audio_decoder` builds a `Box<dyn AudioDecoder>`
        //           for these audio params (0.5 had a single `.make(&CodecParameters, ...)`;
        //           0.6 split it per codec family). `audio_params` is already a borrow;
        //           `&AudioDecoderOptions::default()` lends default options. `?` unwraps.
        // Why:      Obtain a concrete decoder for this codec.
        // TS map:   `const decoder = getCodecs().makeAudioDecoder(audio, {});`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const decoder = getCodecs().makeAudioDecoder(audio, {});
        // ```
        let decoder = symphonia::default::get_codecs()
            .make_audio_decoder(audio_params, &AudioDecoderOptions::default())?;

        // What:     `audio_params.sample_rate.unwrap_or(0)`. `sample_rate` is
        //           `Option<u32>`; `.unwrap_or(0)` yields the inner value or `0`
        //           if absent. (Sibling `.unwrap_or_else(|| ...)` defers the
        //           default; ours is a constant so `unwrap_or` is enough.)
        // Why:      An initial rate; priming below refreshes it from the decoder.
        // TS map:   `const rate = audio.sampleRate ?? 0;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const rate = audio.sampleRate ?? 0;
        // ```
        let rate = audio_params.sample_rate.unwrap_or(0);

        // What:     `match &audio_params.channels { Some(c) => c.count(), None => 0 }`.
        //           Pattern-match the borrowed `&Option<Channels>` (we match on `&...`
        //           so `c` is a `&Channels`, leaving `audio_params` intact): if present,
        //           `c.count()` returns the channel count as `usize`; else `0`.
        // Why:      An initial count; for AAC/ALAC it is `None` here and priming
        //           below fills it from the first decoded frame.
        // TS map:   `const channels = audio.channels ? audio.channels.count() : 0;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const channels = audio.channels ? audio.channels.count() : 0;
        // ```
        let channels = match &audio_params.channels {
            // What:     `Some(c) => c.count()`. Binds the inner `Channels` by reference
            //           to `c` and calls `.count()` (returns `usize`).
            // Why:      Real channel count when known.
            // TS map:   `case present: return c.count();`
            Some(c) => c.count(),
            // What:     `None => 0`. The absent case yields zero.
            // Why:      Unknown layout -> 0 (refreshed after priming).
            // TS map:   `default: return 0;`
            None => 0,
        };

        // What:     `let n_frames = track.num_frames;`. Copy the optional total frame
        //           count off the track (Copy `Option<u64>`). Done before the struct
        //           literal so the `audio_params` borrow of `track` is free to end.
        // Why:      Duration is computed from it after priming reveals the true rate.
        // TS map:   `const nFrames = track.numFrames;`
        let n_frames = track.num_frames;

        // What:     `let spec = AudioSpec { rate, channels: channels as u16, duration_secs: 0.0 };`.
        //           Struct literal; `channels as u16` narrows the `usize` count to
        //           our `u16` field. `duration_secs` starts `0.0` and is set after
        //           priming reveals the true rate.
        // Why:      An initial spec; the priming step finalises rate/channels/duration.
        // TS map:   `const spec = { rate, channels, durationSecs: 0 };`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const spec = { rate, channels, durationSecs: 0 };
        // ```
        let spec = AudioSpec {
            rate,
            channels: channels as u16,
            duration_secs: 0.0,
        };

        // What:     `let mut source = SymphoniaSource { ... };`. Build the struct
        //           (moving fields in), `pending` starts empty, `n_frames` from the
        //           container. `mut` because priming below mutates it. NOT wrapped in
        //           `Ok` yet: we prime first.
        // Why:      We need a live `source` to call `decode_next_raw` on for priming.
        // TS map:   `const source = new SymphoniaSource(format, decoder, trackId, spec, null, nFrames);`
        let mut source = SymphoniaSource {
            format,
            decoder,
            track_id,
            spec,
            pending: None,
            n_frames,
        };

        // What:     `let first = source.decode_next_raw()?;`. Decode the first
        //           audible chunk now. This advances the demuxer/decoder and, as a
        //           side effect, refreshes `source.spec.rate`/`channels` from the
        //           decoded frame's true signal spec. `?` propagates errors.
        // Why:      Learn the real channel count (AAC/ALAC report it only after the
        //           first decode) and capture the first audio block.
        // TS map:   `const first = source.decodeNextRaw();`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const first = source.decodeNextRaw();
        // ```
        let first = source.decode_next_raw()?;

        // What:     `let duration_secs = match (source.n_frames, source.spec.rate) { ... };`.
        //           Now that priming set the true rate, compute seconds.
        // Why:      Duration needs the accurate rate, available only post-priming.
        // TS map:   `const durationSecs = source.nFrames != null && source.spec.rate ? source.nFrames / source.spec.rate : 0;`
        let duration_secs = match (source.n_frames, source.spec.rate) {
            // What:     `(Some(n), r) if r > 0 => n as f64 / r as f64`. Frame count
            //           present AND rate positive; cast both to f64 before dividing.
            // Why:      seconds = frames / frames-per-second.
            // TS map:   `return nFrames / rate;`
            (Some(n), r) if r > 0 => n as f64 / r as f64,
            // What:     `_ => 0.0`. Otherwise unknown duration.
            // Why:      Avoid divide-by-zero / unknown.
            // TS map:   `return 0;`
            _ => 0.0,
        };

        // What:     `source.spec.duration_secs = duration_secs;`. Store the computed
        //           length on the cached spec.
        // Why:      The seek bar's maximum comes from here.
        // TS map:   `source.spec.durationSecs = durationSecs;`
        source.spec.duration_secs = duration_secs;

        // What:     `source.pending = Some(first);`. Stash the primed first chunk so
        //           `next_chunk` hands it out before pulling new packets. `Some(...)`
        //           wraps the value into the `Option` field.
        // Why:      Do not lose the first audio block we decoded during priming.
        // TS map:   `source.pending = first;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // source.pending = first;
        // ```
        source.pending = Some(first);

        // What:     `Ok(source)`. Wrap the primed source as success. Tail -> return.
        // Why:      Hand back the ready source.
        // TS map:   `return source;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return source;
        // ```
        Ok(source)
    }

    // What:     `fn decode_next_raw(&mut self) -> Result<Vec<f32>, PlayerError>`. A
    //           PRIVATE helper (no `pub`): pull packets until one decodes to a
    //           non-empty interleaved block, returning it; an empty `Vec` means
    //           true end-of-stream. Also refreshes `self.spec.rate`/`channels` from
    //           each decoded frame's actual audio spec.
    // Why:      Shared by `new` (priming) and `next_chunk` so the decode loop is
    //           written once.
    // TS map:   `private decodeNextRaw(): number[]  // [] means EOF`
    fn decode_next_raw(&mut self) -> Result<Vec<f32>, PlayerError> {
        // What:     `loop { ... }`. Infinite loop; we `return` out. Needed because
        //           some packets are other tracks, fail to decode, or decode to
        //           zero frames (priming) and must be skipped.
        // Why:      Keep pulling until we get audible samples or hit EOF.
        // TS map:   `while (true) { ... }`
        loop {
            // What:     `let packet = match self.format.next_packet() { ... };`. In 0.6
            //           `next_packet` returns `Result<Option<Packet>>`: `Ok(Some(p))` is
            //           a packet, `Ok(None)` is clean end-of-stream (0.5 signalled EOF
            //           via an `UnexpectedEof` IoError, which is now always an error).
            // Why:      Get a packet, handling end-of-stream cleanly.
            // TS map:   `const p = format.nextPacket(); if (p == null) return [];`
            let packet = match self.format.next_packet() {
                // What:     `Ok(Some(p)) => p`. A packet was produced; unwrap it.
                // Why:      Something to consider.
                // TS map:   `if (p != null) packet = p;`
                Ok(Some(p)) => p,
                // What:     `Ok(None) => return Ok(Vec::new())`. End of stream -> empty
                //           Vec (our EOF signal to callers).
                // Why:      Normal end of file.
                // TS map:   `if (p == null) return [];`
                Ok(None) => return Ok(Vec::new()),
                // What:     `Err(Error::ResetRequired) => return Ok(Vec::new())`.
                // Why:      Treat reset-required (e.g. chained Ogg) as end-of-track.
                // TS map:   `if (e.kind === "ResetRequired") return [];`
                Err(Error::ResetRequired) => return Ok(Vec::new()),
                // What:     `Err(e) => return Err(e.into())`. Convert+propagate.
                // Why:      Surface genuine demux failures.
                // TS map:   `throw toPlayerError(e);`
                Err(e) => return Err(e.into()),
            };

            // What:     `if packet.track_id != self.track_id { continue; }`. Skip
            //           packets from other tracks. In 0.6 `track_id` is a public FIELD
            //           (0.5 had a `track_id()` getter, now removed).
            // Why:      Containers can interleave multiple tracks.
            // TS map:   `if (packet.trackId !== this.trackId) continue;`
            if packet.track_id != self.track_id {
                continue;
            }

            // What:     `match self.decoder.decode(&packet) { ... }`. Decode the
            //           packet; `&packet` lends it read-only. Returns a
            //           `GenericAudioBufferRef` (an enum over sample formats) borrowing
            //           the decoder.
            // Why:      Turn the packet into PCM, handling skippable errors.
            // TS map:   `let audio; try { audio = decoder.decode(packet); } catch (e) { ... }`
            match self.decoder.decode(&packet) {
                // What:     `Ok(decoded) => { ... }`. `decoded` is the decoded buffer
                //           reference (borrows the decoder).
                // Why:      Refresh the spec and copy out interleaved f32.
                // TS map:   `case ok(decoded): ...`
                Ok(decoded) => {
                    // What:     `let spec = decoded.spec();`. `.spec()` returns
                    //           `&AudioSpec` (0.5's `SignalSpec` was replaced by
                    //           `AudioSpec`). Borrows `decoded` read-only.
                    // Why:      The decoder's true rate/channels live here.
                    // TS map:   `const spec = decoded.spec();`
                    let spec = decoded.spec();

                    // What:     `self.spec.rate = spec.rate();`. `.rate()` reads the
                    //           sample rate (0.5 exposed a `rate` field; 0.6 uses a
                    //           getter). Assigns into `self.spec` (disjoint from
                    //           `self.decoder`, which `decoded` borrows).
                    // Why:      codec-header rate may be missing/wrong; trust the decode.
                    // TS map:   `this.spec.rate = spec.rate();`
                    self.spec.rate = spec.rate();

                    // What:     `self.spec.channels = spec.channels().count() as u16;`.
                    //           `.channels()` returns `&Channels`; `.count()` -> `usize`;
                    //           `as u16` narrows to our field.
                    // Why:      Fills the channel count AAC/ALAC omit at probe time.
                    // TS map:   `this.spec.channels = spec.channels().count();`
                    self.spec.channels = spec.channels().count() as u16;

                    // What:     `let mut out: Vec<f32> = Vec::new();`. A fresh growable
                    //           f32 buffer. Explicit type annotation so the copy below
                    //           infers `Sout = f32`.
                    // Why:      The owned interleaved block we will return; replacing
                    //           0.5's reused `SampleBuffer` (0.6 has no `SampleBuffer`).
                    // TS map:   `const out: number[] = [];`
                    let mut out: Vec<f32> = Vec::new();

                    // What:     `decoded.copy_to_vec_interleaved(&mut out);`. Copies the
                    //           planar samples into `out` as interleaved f32, RESIZING
                    //           `out` to the exact interleaved length first (so a stale
                    //           length cannot leak through). `&mut out` lends it mutably.
                    // Why:      Produce `[L,R,L,R,...]` in one call (0.5 needed a
                    //           `SampleBuffer` + `copy_interleaved_ref` + `samples()`).
                    // TS map:   `out = decoded.copyToVecInterleaved();`
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // decoded.copyToVecInterleaved(out);
                    // ```
                    decoded.copy_to_vec_interleaved(&mut out);

                    // What:     `if out.is_empty() { continue; }`. A 0-frame packet
                    //           (e.g. Vorbis priming) yields nothing; fetch the next
                    //           packet instead of signalling EOF.
                    // Why:      An empty return means EOF to callers; do not confuse
                    //           a priming packet with end-of-stream.
                    // TS map:   `if (out.length === 0) continue;`
                    if out.is_empty() {
                        continue;
                    }

                    // What:     `return Ok(out);`. Wrap the owned interleaved samples as
                    //           success and return (moves `out`, no extra copy).
                    // Why:      Hand back owned interleaved samples.
                    // TS map:   `return out;`
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // return out;
                    // ```
                    return Ok(out);
                }
                // What:     `Err(Error::DecodeError(_)) => continue`. Skip one bad
                //           packet (the `_` ignores the message).
                // Why:      One corrupt packet should not kill playback.
                // TS map:   `if (e.kind === "DecodeError") continue;`
                Err(Error::DecodeError(_)) => continue,
                // What:     `Err(Error::IoError(_)) => continue`. A packet that failed
                //           to decode due to an I/O error is skipped (per the 0.6
                //           decode-loop guidance); true EOF now arrives as `Ok(None)`.
                // Why:      Robustness against partial packets.
                // TS map:   `if (e.kind === "IoError") continue;`
                Err(Error::IoError(_)) => continue,
                // What:     `Err(e) => return Err(e.into())`. Fatal: convert+propagate.
                // Why:      Surface genuine decoder failures.
                // TS map:   `throw toPlayerError(e);`
                Err(e) => return Err(e.into()),
            }
        }
    }
}

// What:     `impl Source for SymphoniaSource { ... }`. Implements our `Source`
//           interface for this type.
// Why:      So `open()` can return it as `Box<dyn Source>`.
// TS map:   `class SymphoniaSource implements Source { ... }`
impl Source for SymphoniaSource {
    // What:     `fn spec(&self) -> AudioSpec { self.spec }`. Read-only borrow;
    //           returns a COPY of the cached spec (`AudioSpec` is `Copy`).
    // Why:      Hand callers the stream shape.
    // TS map:   `spec(): AudioSpec { return this.spec; }`
    fn spec(&self) -> AudioSpec {
        // What:     `self.spec` as the tail expression -> returned by value (copy).
        // Why:      Return the cached spec.
        // TS map:   `return this.spec;`
        self.spec
    }

    // What:     `fn next_chunk(&mut self) -> Result<Vec<f32>, PlayerError>`.
    //           Exclusive borrow; advances the demuxer/decoder by one packet.
    // Why:      Produce the next block of interleaved samples (or EOF).
    // TS map:   `nextChunk(): number[]`
    fn next_chunk(&mut self) -> Result<Vec<f32>, PlayerError> {
        // What:     `if let Some(chunk) = self.pending.take() { return Ok(chunk); }`.
        //           `.take()` REPLACES `self.pending` with `None` and returns its
        //           previous value as an `Option`. `if let Some(chunk) = ...` runs
        //           only when a buffered chunk exists, binding it to `chunk`.
        // Why:      The first call hands out the chunk decoded during priming
        //           (in `new`) before pulling any further packets.
        // TS map:   `if (this.pending != null) { const c = this.pending; this.pending = null; return c; }`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (this.pending != null) { const c = this.pending; this.pending = null; return c; }
        // ```
        if let Some(chunk) = self.pending.take() {
            // What:     `return Ok(chunk);`. Wrap the buffered chunk as success.
            // Why:      Deliver the primed first block.
            // TS map:   `return chunk;`
            return Ok(chunk);
        }

        // What:     `self.decode_next_raw()`. Tail expression: delegate to the
        //           shared decode loop (defined in the inherent impl above), which
        //           pulls/decodes the next audible block or signals EOF.
        // Why:      All steady-state decoding goes through one place.
        // TS map:   `return this.decodeNextRaw();`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return this.decodeNextRaw();
        // ```
        self.decode_next_raw()
    }

    // What:     `fn seek(&mut self, secs: f64) -> Result<(), PlayerError>`.
    //           Jump the demuxer to a time, then reset the decoder.
    // Why:      Implement the seek control.
    // TS map:   `seek(secs: number): void`
    fn seek(&mut self, secs: f64) -> Result<(), PlayerError> {
        // What:     `seek_format(self.format.as_mut(), self.track_id, secs)?`. Call the
        //           shared helper (defined above this struct). `self.format` is a
        //           `Box<dyn FormatReader>` (an owned, heap demuxer); `.as_mut()`
        //           reborrows it as a `&mut dyn FormatReader` so the helper can seek it
        //           without taking ownership. `?` unwraps the `Ok` or returns the
        //           error.
        // Why:      The helper converts our "seconds from audible start" into the
        //           container's absolute frame timestamp (adding the stream's
        //           `start_ts`), so dragging the bar to the very beginning seeks to the
        //           real first frame instead of the invalid frame 0.
        // TS map:   `seekFormat(this.format, this.trackId, secs);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // seekFormat(this.format, this.trackId, secs);
        // ```
        seek_format(self.format.as_mut(), self.track_id, secs)?;

        // What:     `self.decoder.reset();`. Clears the decoder's internal state
        //           so it does not emit stale samples from before the seek.
        // Why:      Required after a demuxer seek for correct output.
        // TS map:   `this.decoder.reset();`
        self.decoder.reset();

        // What:     `self.pending = None;`. Drop any buffered primed chunk; after a
        //           seek it belongs to the pre-seek position.
        // Why:      Avoid replaying the start of the track when seeking before the
        //           first `next_chunk` consumed the primed chunk.
        // TS map:   `this.pending = null;`
        self.pending = None;

        // What:     `Ok(())`. Wrap the unit value `()` as success. Tail -> return.
        // Why:      Seek succeeded with no value to return.
        // TS map:   `return;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return;
        // ```
        Ok(())
    }
}

// What:     `#[cfg(test)]`. A conditional-compilation attribute: the module
//           below is compiled ONLY for `cargo test`, never in the shipped binary.
// Why:      Keep test-only helpers and tests out of release builds.
// TS map:   like a block guarded by `if (process.env.NODE_ENV === "test")`,
//           but resolved at compile time and fully stripped otherwise.
#[cfg(test)]
// What:     `mod tests { ... }`. A nested module named `tests`.
// Why:      Conventional place for a file's unit tests.
// TS map:   `describe("decode", () => { ... })`.
mod tests {
    // What:     `use super::*;`. Import everything from the PARENT module (this
    //           file) into the test module. `super` = one level up.
    // Why:      So tests can call `decode_all`, name `AudioSpec`, etc.
    // TS map:   importing the module under test.
    use super::*;

    // What:     `fn decode_all(path: &Path) -> Result<(AudioSpec, Vec<f32>), PlayerError>`.
    //           A TEST HELPER that opens a file and drains it fully to one big
    //           interleaved `Vec<f32>`, returning it with the spec. Defined
    //           inside `#[cfg(test)]` so it never ships.
    // Why:      Lets each codec test assert on the full decoded output simply.
    // TS map:   `function decodeAll(path: string): [AudioSpec, number[]]`
    fn decode_all(path: &Path) -> Result<(AudioSpec, Vec<f32>), PlayerError> {
        // What:     `let mut source = open(path)?;`. Open the file; `mut` because
        //           draining mutates the source. `?` unwraps/returns.
        // Why:      Get a decoder for the file.
        // TS map:   `const source = open(path);`
        let mut source = open(path)?;

        // What:     `let spec = source.spec();`. Snapshot the stream shape.
        // Why:      Return it alongside the samples.
        // TS map:   `const spec = source.spec();`
        let spec = source.spec();

        // What:     `let mut all: Vec<f32> = Vec::new();`. An empty, growable f32
        //           array we will extend with each chunk. Explicit type annotation
        //           because it starts empty (type cannot be inferred yet).
        // Why:      Accumulate all decoded samples.
        // TS map:   `const all: number[] = [];`
        let mut all: Vec<f32> = Vec::new();

        // What:     `loop { ... }`. Repeat until we see the empty-Vec EOF signal.
        // Why:      Pull every chunk to the end.
        // TS map:   `while (true) { ... }`
        loop {
            // What:     `let chunk = source.next_chunk()?;`. Decode one block; `?`
            //           propagates a real error.
            // Why:      Advance through the stream.
            // TS map:   `const chunk = source.nextChunk();`
            let chunk = source.next_chunk()?;

            // What:     `if chunk.is_empty() { break; }`. Empty chunk == EOF; `break`
            //           exits the loop.
            // Why:      Stop at end of stream.
            // TS map:   `if (chunk.length === 0) break;`
            if chunk.is_empty() {
                break;
            }

            // What:     `all.extend(chunk);`. Append all elements of `chunk` to
            //           `all`, MOVING `chunk`'s contents in.
            // Why:      Build the full sample vector.
            // TS map:   `all.push(...chunk);`
            all.extend(chunk);
        }

        // What:     `Ok((spec, all))`. Wrap a tuple of the spec and samples as
        //           success. Tail -> return.
        // Why:      Hand both back to the test.
        // TS map:   `return [spec, all];`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return [spec, all];
        // ```
        Ok((spec, all))
    }

    // What:     `fn check_fixture(name: &str)`. Shared assertion routine: decode
    //           a fixture file and check the output is sane.
    // Why:      One body reused by every per-codec test below.
    // TS map:   `function checkFixture(name: string): void`
    fn check_fixture(name: &str) {
        // What:     `let path = Path::new("fixtures").join(name);`. `Path::new`
        //           borrows a `&str` as a `&Path`; `.join(name)` returns an owned
        //           `PathBuf` ("fixtures/<name>").
        // Why:      Build the path to the committed test file.
        // TS map:   `const path = join("fixtures", name);`
        let path = Path::new("fixtures").join(name);

        // What:     `let (spec, samples) = decode_all(&path).expect(...)`. Call the
        //           helper (lending `&path`); `.expect(msg)` UNWRAPS `Ok`, or
        //           PANICS with `msg` on `Err` (panicking fails the test). The
        //           tuple is destructured into `spec` and `samples`.
        // Why:      Decode the fixture or fail loudly with context.
        // TS map:   `const [spec, samples] = decodeAll(path); // throws on error`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const [spec, samples] = decodeAll(path);
        // ```
        let (spec, samples) = decode_all(&path).expect("fixture should decode");

        // What:     `assert!(spec.rate > 0, ...)`. `assert!(cond, msg)` panics
        //           (fails the test) if `cond` is false.
        // Why:      A real stream must report a positive sample rate.
        // TS map:   `expect(spec.rate).toBeGreaterThan(0);`
        assert!(spec.rate > 0, "{name}: rate should be positive");

        // What:     `assert!(spec.channels >= 1, ...)`. At least one channel.
        // Why:      Every audio stream has >= 1 channel.
        // TS map:   `expect(spec.channels).toBeGreaterThanOrEqual(1);`
        assert!(spec.channels >= 1, "{name}: should have >=1 channel");

        // What:     `assert!(!samples.is_empty(), ...)`. `!` negates; require some
        //           decoded samples.
        // Why:      A 0.3s tone must decode to non-empty PCM.
        // TS map:   `expect(samples.length).toBeGreaterThan(0);`
        assert!(!samples.is_empty(), "{name}: should decode some samples");

        // What:     `assert_eq!(samples.len() % spec.channels as usize, 0, ...)`.
        //           `assert_eq!(a, b)` panics unless `a == b`. `samples.len()` is
        //           `usize`; `spec.channels as usize` widens `u16` to `usize`; `%`
        //           is modulo. Interleaved data length must be a whole number of
        //           frames.
        // Why:      Catch interleaving/channel-count mismatches.
        // TS map:   `expect(samples.length % spec.channels).toBe(0);`
        assert_eq!(
            samples.len() % spec.channels as usize,
            0,
            "{name}: interleaved length should be a multiple of channels"
        );
    }

    // What:     `#[test]`. Marks the next function as a test case.
    // Why:      `cargo test` runs every `#[test]` function.
    // TS map:   `it("...", () => { ... })`.
    #[test]
    // What:     `fn decodes_wav() { check_fixture("tone.wav"); }`. WAV/PCM path.
    // Why:      Verify the PCM decoder.
    // TS map:   `it("decodes wav", () => checkFixture("tone.wav"));`
    fn decodes_wav() {
        check_fixture("tone.wav");
    }

    // What:     `#[test]` FLAC path.
    // Why:      Verify the FLAC decoder.
    // TS map:   `it("decodes flac", ...)`
    #[test]
    fn decodes_flac() {
        check_fixture("tone.flac");
    }

    // What:     `#[test]` MP3 path.
    // Why:      Verify the MP3 decoder.
    // TS map:   `it("decodes mp3", ...)`
    #[test]
    fn decodes_mp3() {
        check_fixture("tone.mp3");
    }

    // What:     `#[test]` Vorbis (in Ogg) path.
    // Why:      Verify the Vorbis decoder.
    // TS map:   `it("decodes ogg/vorbis", ...)`
    #[test]
    fn decodes_ogg_vorbis() {
        check_fixture("tone.ogg");
    }

    // What:     `#[test]` Opus path (routes through `opus.rs`, libopus).
    // Why:      Verify the Opus decode path end to end.
    // TS map:   `it("decodes opus", ...)`
    #[test]
    fn decodes_opus() {
        check_fixture("tone.opus");
    }

    // What:     `#[test]` regression for seeking to the very beginning of an Ogg/Opus
    //           stream whose first audio frame is NOT frame 0.
    // Why:      `fixtures/offset.opus` is an Opus file remuxed with a +0.5s timestamp
    //           offset, so its track `start_ts` is non-zero (~23352 frames). The old
    //           seek used `SeekTo::Time { 0s }`, which maps to frame 0; the Ogg
    //           demuxer rejects any frame below `start_ts` with
    //           "requested seek timestamp is out-of-range for stream", so dragging the
    //           bar to the beginning errored. The fix (`seek_format`) seeks to
    //           `start_ts + 0`, the real first frame. This test fails (the original
    //           bug) if the seek is ever reverted to `SeekTo::Time`.
    // TS map:   `it("seeks to start of an offset opus stream", ...)`
    #[test]
    fn seek_to_start_of_offset_opus_succeeds() {
        // What:     `let path = Path::new("fixtures").join("offset.opus");`. Build the
        //           path to the committed offset fixture (see `gen:fixtures`).
        // Why:      This is the only fixture with a non-zero start frame.
        // TS map:   `const path = join("fixtures", "offset.opus");`
        let path = Path::new("fixtures").join("offset.opus");

        // What:     `let mut source = open(&path).expect("offset.opus should open");`.
        //           `open(&path)` lends the path and returns `Result<Box<dyn Source>>`;
        //           `.expect(msg)` unwraps `Ok` or panics (failing the test). `mut`
        //           because seeking and decoding mutate the source.
        // Why:      Drive the real decode path the player uses, not a hand-rolled one.
        // TS map:   `const source = open(path); // throws on error`
        let mut source = open(&path).expect("offset.opus should open");

        // What:     `source.seek(0.0).expect(...)`. Seek to second 0 (the beginning),
        //           unwrapping the `Result<(), PlayerError>` and panicking on error.
        // Why:      This is the exact action that errored before the fix; it must now
        //           succeed.
        // TS map:   `source.seek(0); // must not throw`
        source
            .seek(0.0)
            .expect("seek to the beginning must not be out-of-range");

        // What:     `let chunk = source.next_chunk().expect(...)`. Pull one decoded
        //           block after the seek, unwrapping the `Result<Vec<f32>>`.
        // Why:      Confirm the post-seek position is actually decodable, not just that
        //           `seek` returned `Ok`.
        // TS map:   `const chunk = source.nextChunk(); // throws on error`
        let chunk = source
            .next_chunk()
            .expect("decoding after seek-to-start should yield samples");

        // What:     `assert!(!chunk.is_empty(), ...)`. `!` negates; require a non-empty
        //           block.
        // Why:      An empty first block would mean the seek landed at end-of-stream.
        // TS map:   `expect(chunk.length).toBeGreaterThan(0);`
        assert!(
            !chunk.is_empty(),
            "first chunk after seeking to the start should not be empty"
        );
    }

    // What:     `#[test]` AAC-LC (in MP4) path.
    // Why:      Verify the AAC decoder.
    // TS map:   `it("decodes aac", ...)`
    #[test]
    fn decodes_aac() {
        check_fixture("tone.aac.m4a");
    }

    // What:     `#[test]` ALAC (in MP4) path.
    // Why:      Verify the ALAC decoder.
    // TS map:   `it("decodes alac", ...)`
    #[test]
    fn decodes_alac() {
        check_fixture("tone.alac.m4a");
    }
}
