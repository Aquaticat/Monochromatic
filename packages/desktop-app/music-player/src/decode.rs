//! Decoding: turn an audio file on disk into interleaved `f32` PCM samples.
//!
//! One demux path (symphonia probes the container and demuxes packets) feeds
//! two decode paths: symphonia's own decoders for FLAC/WAV/MP3/Vorbis/AAC/ALAC,
//! and the `opus` crate (libopus) for Opus, because symphonia 0.5's Opus
//! decoder is an empty stub. `open()` picks the path; both implement `Source`.

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

// What:     `use std::io::ErrorKind;` imports the enum that classifies I/O
//           errors (NotFound, PermissionDenied, UnexpectedEof, ...).
// Why:      End-of-stream shows up as an I/O error of kind `UnexpectedEof`;
//           we match on that to stop decoding cleanly instead of erroring.
// TS map:   like checking `err.code === "EOF"` on a Node error object.
//
// In TS you'd write (pseudocode):
// ```ts
// // compare err.code against a string constant
// ```
use std::io::ErrorKind;

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

// What:     `use symphonia::core::audio::SampleBuffer;` imports a helper that
//           converts symphonia's internal planar audio buffer into a flat,
//           interleaved sample array of a chosen type (here `f32`).
// Why:      PipeWire and our pipeline want interleaved `f32`; this does it.
// TS map:   a class that flattens `[[L,L,L],[R,R,R]]` into `[L,R,L,R,L,R]`.
//
// In TS you'd write (pseudocode):
// ```ts
// class SampleBuffer { /* holds Float32Array */ }
// ```
use symphonia::core::audio::SampleBuffer;

// What:     `use symphonia::core::codecs::{...};` imports decoder machinery:
//           `CodecParameters` (a description of a track's codec: rate,
//           channels, frame count), `Decoder` (the trait every decoder
//           implements), `DecoderOptions` (knobs, we use defaults),
//           `CODEC_TYPE_NULL` (the "no codec / data track" sentinel),
//           `CODEC_TYPE_OPUS` (the Opus codec id, value 0x1005).
// Why:      We read params, build a decoder, and recognise Opus to route it.
// TS map:   importing several named exports from one module.
//
// In TS you'd write (pseudocode):
// ```ts
// import { CodecParameters, Decoder, DecoderOptions, CODEC_TYPE_NULL, CODEC_TYPE_OPUS } from "symphonia/codecs";
// ```
use symphonia::core::codecs::{
    CodecParameters, Decoder, DecoderOptions, CODEC_TYPE_NULL, CODEC_TYPE_OPUS,
};

// What:     `use symphonia::core::errors::Error;` imports symphonia's own error
//           enum (IoError, DecodeError, ResetRequired, ...).
// Why:      We match its variants to tell "end of file" and "skip this packet"
//           apart from real failures.
// TS map:   a tagged-union error type from the library.
//
// In TS you'd write (pseudocode):
// ```ts
// import { SymphoniaError } from "symphonia/errors";
// ```
use symphonia::core::errors::Error;

// What:     `use symphonia::core::formats::{...};` imports demuxer types:
//           `FormatOptions` (demux knobs, defaults), `FormatReader` (the trait
//           a demuxed container implements: lists tracks, yields packets),
//           `SeekMode` (Accurate vs Coarse), `SeekTo` (where to seek: by time
//           or by frame).
// Why:      We probe into a `FormatReader`, pull packets, and seek by time.
// TS map:   named imports describing a container reader.
//
// In TS you'd write (pseudocode):
// ```ts
// import { FormatOptions, FormatReader, SeekMode, SeekTo } from "symphonia/formats";
// ```
use symphonia::core::formats::{FormatOptions, FormatReader, SeekMode, SeekTo};

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
// Why:      The probe call requires a `&MetadataOptions` argument.
// TS map:   an options object we leave at defaults.
//
// In TS you'd write (pseudocode):
// ```ts
// import { MetadataOptions } from "symphonia/meta";
// ```
use symphonia::core::meta::MetadataOptions;

// What:     `use symphonia::core::probe::Hint;` imports a struct that gives the
//           prober a hint (like the file extension) to speed format detection.
// Why:      We pass the file extension so probing is fast and reliable.
// TS map:   a small options object carrying `{ extension?: string }`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Hint } from "symphonia/probe";
// ```
use symphonia::core::probe::Hint;

// What:     `use symphonia::core::units::Time;` imports symphonia's time type
//           (seconds + fractional seconds) used for seeking.
// Why:      `SeekTo::Time` needs a `Time`; `Time::from(f64_seconds)` builds one.
// TS map:   a wrapper around a `number` of seconds.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Time } from "symphonia/units";
// ```
use symphonia::core::units::Time;

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

    // What:     `symphonia::default::get_probe().format(&hint, mss, &..., &...)?`.
    //           `get_probe()` returns the global format prober; `.format(...)`
    //           sniffs the stream and returns `Result<ProbeResult>`. `&hint`
    //           lends the hint read-only; `mss` is MOVED in (the stream is
    //           consumed); `&FormatOptions::default()` and
    //           `&MetadataOptions::default()` lend default option structs.
    //           Trailing `?` unwraps or returns the error.
    // Why:      Detect the container and obtain a demuxer for it.
    // TS map:   `const probed = getProbe().format(hint, mss, {}, {});`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const probed = getProbe().format(hint, mss, {}, {});
    // ```
    let probed = symphonia::default::get_probe().format(
        &hint,
        mss,
        &FormatOptions::default(),
        &MetadataOptions::default(),
    )?;

    // What:     `let format = probed.format;`. Moves the `Box<dyn FormatReader>`
    //           out of the probe result into a local. (No `mut` needed yet; we
    //           only read tracks before moving it into a source.)
    // Why:      The demuxer we will hand to whichever source we build.
    // TS map:   `const format = probed.format;`
    let format = probed.format;

    // What:     a BLOCK expression `{ ... }` that produces a `(u32, CodecParameters)`
    //           tuple and binds it to `(track_id, params)`. The block scopes the
    //           immutable borrow of `format` (from `.tracks()`) so it ends
    //           before we move `format` into the source below.
    // Why:      Read the track id and copy its codec params, then release the
    //           borrow so `format` is free to move.
    // TS map:   `const { trackId, params } = (() => { ... return {...}; })();`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const [trackId, params] = (() => {
    //   const track = format.tracks().find(t => t.codecParams.codec !== CODEC_TYPE_NULL);
    //   if (!track) throw new PlayerError.Unsupported("no audio track");
    //   return [track.id, structuredClone(track.codecParams)];
    // })();
    // ```
    let (track_id, params) = {
        // What:     `format.tracks().iter().find(|t| ...)`. `.tracks()` returns
        //           `&[Track]` (a borrowed slice). `.iter()` makes an iterator of
        //           `&Track`. `.find(|t| ...)` returns the first `Some(&Track)`
        //           whose closure is true, else `None`. `|t| t.codec_params.codec
        //           != CODEC_TYPE_NULL` keeps real audio tracks (skips data/null
        //           tracks).
        // Why:      Locate the first actual audio track to decode.
        // TS map:   `tracks.find(t => t.codecParams.codec !== CODEC_TYPE_NULL)`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const track = tracks.find(t => t.codecParams.codec !== CODEC_TYPE_NULL);
        // ```
        let track = format
            .tracks()
            .iter()
            .find(|t| t.codec_params.codec != CODEC_TYPE_NULL)
            // What:     `.ok_or_else(|| PlayerError::Unsupported(...))?`. Converts
            //           the `Option<&Track>` into a `Result`: `Some(x)` -> `Ok(x)`,
            //           `None` -> `Err(closure())`. The closure builds the error
            //           lazily (only if `None`). `.to_string()` makes an OWNED
            //           `String` from the `&str` literal (the error must own it).
            //           Trailing `?` unwraps the `&Track` or returns the error.
            // Why:      A file with no audio track is unsupported; report it.
            // TS map:   `if (!track) throw new PlayerError.Unsupported("no audio track");`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // if (!track) throw new PlayerError.Unsupported("no audio track");
            // ```
            .ok_or_else(|| PlayerError::Unsupported("no audio track".to_string()))?;

        // What:     `(track.id, track.codec_params.clone())`. A tuple: `track.id`
        //           is a `u32` (Copy, so just read). `.clone()` DEEP-COPIES the
        //           `CodecParameters` so the copy outlives the `format` borrow.
        //           Tail expression of the block -> the block's value.
        // Why:      We need an owned copy of the params; the borrowed `&Track`
        //           cannot survive moving `format`.
        // TS map:   `[track.id, structuredClone(track.codecParams)]`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return [track.id, structuredClone(track.codecParams)];
        // ```
        (track.id, track.codec_params.clone())
    };

    // What:     `if params.codec == CODEC_TYPE_OPUS { ... } else { ... }`. Compare
    //           the track's codec id against the Opus constant.
    // Why:      Opus needs the libopus path; everything else uses symphonia.
    // TS map:   `if (params.codec === CODEC_TYPE_OPUS) { ... } else { ... }`
    if params.codec == CODEC_TYPE_OPUS {
        // What:     `OpusSource::new(format, params, track_id)?`. Calls the Opus
        //           source constructor, MOVING `format` and `params` into it.
        //           `?` unwraps or returns the error.
        // Why:      Build the libopus-backed source.
        // TS map:   `const source = OpusSource.create(format, params, trackId);`
        let source = OpusSource::new(format, params, track_id)?;

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
        // What:     `SymphoniaSource::new(format, params, track_id)?`. Builds the
        //           symphonia-decoder source, moving `format`/`params` in.
        // Why:      Decode FLAC/WAV/MP3/Vorbis/AAC/ALAC with symphonia.
        // TS map:   `const source = SymphoniaSource.create(format, params, trackId);`
        let source = SymphoniaSource::new(format, params, track_id)?;

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
    // What:     `decoder: Box<dyn Decoder>`. Owning, heap, type-erased decoder.
    // Why:      Turns packets into PCM audio buffers.
    // TS map:   `decoder: Decoder;`
    decoder: Box<dyn Decoder>,
    // What:     `track_id: u32`. The id of the track we decode (a packet stream
    //           may interleave several tracks). `u32` because symphonia ids are
    //           `u32` (sibling `usize` would force casts against the API).
    // Why:      Skip packets that belong to other tracks.
    // TS map:   `trackId: number;`
    track_id: u32,
    // What:     `sample_buf: Option<SampleBuffer<f32>>`. `Option<T>` = "maybe a
    //           T": `Some(buf)` once allocated, `None` before the first decode.
    //           We delay allocation until we know the buffer capacity.
    // Why:      Reuse one interleaving buffer across calls instead of allocating
    //           per packet; grow it only if a packet is larger.
    // TS map:   `sampleBuf: SampleBuffer | null;`
    sample_buf: Option<SampleBuffer<f32>>,
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
    // What:     `fn new(format: Box<dyn FormatReader>, params: CodecParameters,
    //           track_id: u32) -> Result<Self, PlayerError>`. `Self` is the type
    //           being impl'd (`SymphoniaSource`). Takes ownership of `format`
    //           and `params`.
    // Why:      Build a decoder from the params and cache the spec.
    // TS map:   `static create(format, params, trackId): SymphoniaSource`
    fn new(
        format: Box<dyn FormatReader>,
        params: CodecParameters,
        track_id: u32,
    ) -> Result<Self, PlayerError> {
        // What:     `symphonia::default::get_codecs().make(&params, &DecoderOptions::default())?`.
        //           `get_codecs()` returns the global decoder registry; `.make`
        //           builds a `Box<dyn Decoder>` for these params. `&params`
        //           lends the params read-only; `&DecoderOptions::default()`
        //           lends default options. `?` unwraps or returns the error.
        // Why:      Obtain a concrete decoder for this codec.
        // TS map:   `const decoder = getCodecs().make(params, {});`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const decoder = getCodecs().make(params, {});
        // ```
        let decoder = symphonia::default::get_codecs().make(&params, &DecoderOptions::default())?;

        // What:     `params.sample_rate.unwrap_or(0)`. `sample_rate` is
        //           `Option<u32>`; `.unwrap_or(0)` yields the inner value or `0`
        //           if absent. (Sibling `.unwrap_or_else(|| ...)` defers the
        //           default; ours is a constant so `unwrap_or` is enough.)
        // Why:      An initial rate; priming below refreshes it from the decoder.
        // TS map:   `const rate = params.sampleRate ?? 0;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const rate = params.sampleRate ?? 0;
        // ```
        let rate = params.sample_rate.unwrap_or(0);

        // What:     `match params.channels { Some(c) => c.count(), None => 0 }`.
        //           Pattern-match the `Option<Channels>`: if present, `c.count()`
        //           returns the channel count as `usize`; else `0`.
        // Why:      An initial count; for AAC/ALAC it is `None` here and priming
        //           below fills it from the first decoded frame.
        // TS map:   `const channels = params.channels ? params.channels.count() : 0;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const channels = params.channels ? params.channels.count() : 0;
        // ```
        let channels = match params.channels {
            // What:     `Some(c) => c.count()`. Binds the inner `Channels` to `c`
            //           and calls `.count()` (returns `usize`).
            // Why:      Real channel count when known.
            // TS map:   `case present: return c.count();`
            Some(c) => c.count(),
            // What:     `None => 0`. The absent case yields zero.
            // Why:      Unknown layout -> 0 (refreshed after priming).
            // TS map:   `default: return 0;`
            None => 0,
        };

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
        //           (moving fields in), `sample_buf`/`pending` start empty,
        //           `n_frames` from the container. `mut` because priming below
        //           mutates it. NOT wrapped in `Ok` yet: we prime first.
        // Why:      We need a live `source` to call `decode_next_raw` on for priming.
        // TS map:   `const source = new SymphoniaSource(format, decoder, trackId, null, spec, null, params.nFrames);`
        let mut source = SymphoniaSource {
            format,
            decoder,
            track_id,
            sample_buf: None,
            spec,
            pending: None,
            n_frames: params.n_frames,
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
    //           each decoded frame's actual signal spec.
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
            // What:     `let packet = match self.format.next_packet() { ... };`.
            //           Demux the next packet, mapping EOF/reset to an empty Vec.
            // Why:      Get a packet, handling end-of-stream cleanly.
            // TS map:   `let packet; try { packet = format.nextPacket(); } catch (e) { if (isEof(e)) return []; throw e; }`
            let packet = match self.format.next_packet() {
                // What:     `Ok(p) => p`. Unwrap the packet.
                // Why:      Something to consider.
                // TS map:   `packet = p;`
                Ok(p) => p,
                // What:     EOF -> empty Vec (our EOF signal).
                // Why:      Normal end of file.
                // TS map:   `if (e.kind === "UnexpectedEof") return [];`
                Err(Error::IoError(e)) if e.kind() == ErrorKind::UnexpectedEof => {
                    return Ok(Vec::new())
                }
                // What:     `Err(Error::ResetRequired) => return Ok(Vec::new())`.
                // Why:      Treat reset-required as end-of-track.
                // TS map:   `if (e.kind === "ResetRequired") return [];`
                Err(Error::ResetRequired) => return Ok(Vec::new()),
                // What:     `Err(e) => return Err(e.into())`. Convert+propagate.
                // Why:      Surface genuine demux failures.
                // TS map:   `throw toPlayerError(e);`
                Err(e) => return Err(e.into()),
            };

            // What:     `if packet.track_id() != self.track_id { continue; }`. Skip
            //           packets from other tracks.
            // Why:      Containers can interleave multiple tracks.
            // TS map:   `if (packet.trackId() !== this.trackId) continue;`
            if packet.track_id() != self.track_id {
                continue;
            }

            // What:     `match self.decoder.decode(&packet) { ... }`. Decode the
            //           packet; `&packet` lends it read-only.
            // Why:      Turn the packet into PCM, handling skippable errors.
            // TS map:   `let audio; try { audio = decoder.decode(packet); } catch (e) { ... }`
            match self.decoder.decode(&packet) {
                // What:     `Ok(audio_buf) => { ... }`. `audio_buf` is the decoded
                //           planar buffer (borrowed from the decoder).
                // Why:      Convert to interleaved f32.
                // TS map:   `case ok(audioBuf): ...`
                Ok(audio_buf) => {
                    // What:     `let capacity = audio_buf.capacity();`. Frame
                    //           capacity (`usize`), read before moving `audio_buf`.
                    // Why:      Size the interleaving buffer.
                    // TS map:   `const capacity = audioBuf.capacity();`
                    let capacity = audio_buf.capacity();

                    // What:     `let signal_spec = *audio_buf.spec();`. `.spec()`
                    //           returns `&SignalSpec`; `*` derefs+copies it (Copy).
                    // Why:      Owned spec for the SampleBuffer and to refresh ours.
                    // TS map:   `const signalSpec = { ...audioBuf.spec() };`
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // const signalSpec = { ...audioBuf.spec() };
                    // ```
                    let signal_spec = *audio_buf.spec();

                    // What:     `self.spec.rate = signal_spec.rate;`. Overwrite the
                    //           cached rate with the decoder's true rate. (Disjoint
                    //           field from `self.decoder`, so allowed while
                    //           `audio_buf` borrows the decoder.)
                    // Why:      codec-header rate may be missing/wrong; trust the decode.
                    // TS map:   `this.spec.rate = signalSpec.rate;`
                    self.spec.rate = signal_spec.rate;

                    // What:     `self.spec.channels = signal_spec.channels.count() as u16;`.
                    //           `.count()` -> `usize`; `as u16` narrows to our field.
                    // Why:      Fills the channel count AAC/ALAC omit at probe time.
                    // TS map:   `this.spec.channels = signalSpec.channels.count();`
                    self.spec.channels = signal_spec.channels.count() as u16;

                    // What:     `let need_new = match &self.sample_buf { ... };`.
                    //           Decide whether to (re)allocate the interleaving buffer.
                    // Why:      Allocate once, grow only when a packet is bigger.
                    // TS map:   `const needNew = this.sampleBuf == null || this.sampleBuf.capacity() < capacity;`
                    let need_new = match &self.sample_buf {
                        // What:     `Some(b) => b.capacity() < capacity`. Reallocate
                        //           only if the existing buffer is too small.
                        // Why:      Grow on demand.
                        // TS map:   `return b.capacity() < capacity;`
                        Some(b) => b.capacity() < capacity,
                        // What:     `None => true`. No buffer yet.
                        // Why:      First decode.
                        // TS map:   `return true;`
                        None => true,
                    };

                    // What:     `if need_new { self.sample_buf = Some(SampleBuffer::<f32>::new(capacity as u64, signal_spec)); }`.
                    //           Allocate a flat f32 buffer; `capacity as u64` widens
                    //           `usize` to the `Duration = u64` the API wants.
                    // Why:      Ensure a big-enough interleaving buffer.
                    // TS map:   `if (needNew) this.sampleBuf = new SampleBuffer(capacity, signalSpec);`
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // if (needNew) this.sampleBuf = new SampleBuffer(capacity, signalSpec);
                    // ```
                    if need_new {
                        self.sample_buf =
                            Some(SampleBuffer::<f32>::new(capacity as u64, signal_spec));
                    }

                    // What:     `let buf = match self.sample_buf.as_mut() { ... };`.
                    //           `.as_mut()` -> `Option<&mut SampleBuffer>`.
                    // Why:      Mutable handle to the (now present) buffer.
                    // TS map:   `const buf = this.sampleBuf!;`
                    let buf = match self.sample_buf.as_mut() {
                        // What:     `Some(b) => b`. Unwrap the mutable reference.
                        // Why:      We just ensured it exists.
                        // TS map:   `buf = this.sampleBuf;`
                        Some(b) => b,
                        // What:     `None => return Err(...)`. Defensive: unreachable.
                        // Why:      Never proceed on an impossible state.
                        // TS map:   `throw new PlayerError.Audio("sample buffer missing");`
                        None => {
                            return Err(PlayerError::Audio(
                                "sample buffer missing after allocation".to_string(),
                            ))
                        }
                    };

                    // What:     `buf.copy_interleaved_ref(audio_buf);`. MOVES
                    //           `audio_buf` in; writes planar samples interleaved.
                    // Why:      Produce `[L,R,L,R,...]`.
                    // TS map:   `buf.copyInterleavedRef(audioBuf);`
                    buf.copy_interleaved_ref(audio_buf);

                    // What:     `let samples = buf.samples();`. Borrowed `&[f32]` of
                    //           the valid interleaved range just written.
                    // Why:      Inspect length before deciding to return or skip.
                    // TS map:   `const samples = buf.samples();`
                    let samples = buf.samples();

                    // What:     `if samples.is_empty() { continue; }`. A 0-frame
                    //           packet (e.g. Vorbis priming) yields nothing; fetch
                    //           the next packet instead of signalling EOF.
                    // Why:      An empty return means EOF to callers; do not confuse
                    //           a priming packet with end-of-stream.
                    // TS map:   `if (samples.length === 0) continue;`
                    if samples.is_empty() {
                        continue;
                    }

                    // What:     `return Ok(samples.to_vec());`. `.to_vec()` COPIES
                    //           the slice into an owned `Vec<f32>`; `Ok(...)` wraps.
                    // Why:      Hand back owned interleaved samples.
                    // TS map:   `return Array.from(samples);`
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // return Array.from(samples);
                    // ```
                    return Ok(samples.to_vec());
                }
                // What:     `Err(Error::DecodeError(_)) => continue`. Skip one bad
                //           packet (the `_` ignores the message).
                // Why:      One corrupt packet should not kill playback.
                // TS map:   `if (e.kind === "DecodeError") continue;`
                Err(Error::DecodeError(_)) => continue,
                // What:     EOF from the decoder -> end-of-track.
                // Why:      Stop cleanly.
                // TS map:   `if (e.kind === "UnexpectedEof") return [];`
                Err(Error::IoError(e)) if e.kind() == ErrorKind::UnexpectedEof => {
                    return Ok(Vec::new())
                }
                // What:     `Err(Error::IoError(_)) => continue`. Transient I/O: skip.
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
        // What:     `self.format.seek(SeekMode::Accurate, SeekTo::Time { time:
        //           Time::from(secs), track_id: Some(self.track_id) })?`.
        //           `SeekMode::Accurate` = land exactly (sibling `Coarse` = fast
        //           but approximate). `SeekTo::Time { ... }` seeks by time;
        //           `Time::from(secs)` converts our f64 seconds; `Some(self.track_id)`
        //           wraps the track id in `Option` (sibling `None` = "any track").
        //           `?` unwraps/returns.
        // Why:      Reposition the stream precisely at `secs`.
        // TS map:   `format.seek("accurate", { time: secs, trackId: this.trackId });`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // format.seek("accurate", { time: secs, trackId: this.trackId });
        // ```
        self.format.seek(
            SeekMode::Accurate,
            SeekTo::Time {
                time: Time::from(secs),
                track_id: Some(self.track_id),
            },
        )?;

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
