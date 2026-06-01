//! Opus decode path. symphonia 0.5 demuxes Ogg/Opus (parsing `OpusHead`,
//! reporting the pre-skip in `codec_params.delay`, and yielding raw Opus
//! packets) but its own Opus decoder is an empty stub, so we feed those raw
//! packets to libopus through the `opus` crate. Output is always 48 kHz.

// What:     `use std::io::ErrorKind;` imports the I/O error classifier enum.
// Why:      End-of-stream is an `IoError` of kind `UnexpectedEof`; we match it.
// TS map:   comparing `err.code === "EOF"`.
//
// In TS you'd write (pseudocode):
// ```ts
// // compare err.code to a string
// ```
use std::io::ErrorKind;

// What:     `use symphonia::core::codecs::CodecParameters;` imports the struct
//           describing a track's codec (channels, frame count, pre-skip delay).
// Why:      `new` reads channels/delay/frame-count from it.
// TS map:   `import { CodecParameters } from "symphonia/codecs";`
//
// In TS you'd write (pseudocode):
// ```ts
// import { CodecParameters } from "symphonia/codecs";
// ```
use symphonia::core::codecs::CodecParameters;

// What:     `use symphonia::core::errors::Error;` imports symphonia's error enum.
// Why:      We match its `IoError`/`ResetRequired` variants to detect EOF.
// TS map:   `import { SymphoniaError } from "symphonia/errors";`
//
// In TS you'd write (pseudocode):
// ```ts
// import { SymphoniaError } from "symphonia/errors";
// ```
use symphonia::core::errors::Error;

// What:     `use symphonia::core::formats::{FormatReader, SeekMode, SeekTo};`.
//           `FormatReader` = the demuxer trait; `SeekMode`/`SeekTo` = how/where
//           to seek.
// Why:      We hold a demuxer and seek by time.
// TS map:   `import { FormatReader, SeekMode, SeekTo } from "symphonia/formats";`
//
// In TS you'd write (pseudocode):
// ```ts
// import { FormatReader, SeekMode, SeekTo } from "symphonia/formats";
// ```
use symphonia::core::formats::{FormatReader, SeekMode, SeekTo};

// What:     `use symphonia::core::units::Time;` imports the seconds-based time type.
// Why:      `SeekTo::Time` needs a `Time`, built via `Time::from(f64)`.
// TS map:   `import { Time } from "symphonia/units";`
//
// In TS you'd write (pseudocode):
// ```ts
// import { Time } from "symphonia/units";
// ```
use symphonia::core::units::Time;

// What:     `use crate::decode::{AudioSpec, Source};` imports our spec record and
//           the `Source` interface from the sibling `decode.rs` module.
// Why:      `OpusSource` returns an `AudioSpec` and implements `Source`.
// TS map:   `import { AudioSpec, Source } from "./decode";`
//
// In TS you'd write (pseudocode):
// ```ts
// import { AudioSpec, Source } from "./decode";
// ```
use crate::decode::{AudioSpec, Source};

// What:     `use crate::error::PlayerError;` imports our app-wide error type.
// Why:      Every fallible method here returns `PlayerError`.
// TS map:   `import { PlayerError } from "../error";`
//
// In TS you'd write (pseudocode):
// ```ts
// import { PlayerError } from "@/error";
// ```
use crate::error::PlayerError;

// What:     `const OPUS_RATE: u32 = 48_000;`. A named compile-time constant: the
//           fixed output sample rate libopus always decodes to. `u32` matches
//           `AudioSpec.rate` and the opus API; the `_` in `48_000` is a digit
//           separator (purely cosmetic).
// Why:      Opus is defined to output 48 kHz; naming it avoids a magic number.
// TS map:   `const OPUS_RATE = 48_000;`
const OPUS_RATE: u32 = 48_000;

// What:     `const MAX_FRAMES_PER_CHANNEL: usize = 5760;`. The largest number of
//           samples per channel a single Opus packet can decode to (a 120 ms
//           frame at 48 kHz = 0.120 * 48000 = 5760). `usize` because it sizes a
//           buffer (memory length), which is what `usize` is for.
// Why:      We pre-allocate a scratch buffer big enough for any packet so
//           `decode_float` never overflows it.
// TS map:   `const MAX_FRAMES_PER_CHANNEL = 5760;`
const MAX_FRAMES_PER_CHANNEL: usize = 5760;

// What:     `const STEREO: usize = 2;`. Named constant for the stereo channel
//           count, used to branch mono vs stereo. `usize` to compare against the
//           `usize` channel count without a cast.
// Why:      Avoid a bare `2` literal when classifying the layout.
// TS map:   `const STEREO = 2;`
const STEREO: usize = 2;

// What:     `const MONO: usize = 1;`. Named constant for the mono channel count.
// Why:      Avoid a bare `1` literal when classifying the layout.
// TS map:   `const MONO = 1;`
const MONO: usize = 1;

// What:     `pub struct OpusSource { ... }`. The live Opus decode state.
// Why:      Bundles the demuxer, libopus decoder, and reusable scratch so the
//           `Source` methods can advance them.
// TS map:   `class OpusSource implements Source { ... }`
pub struct OpusSource {
    // What:     `format: Box<dyn FormatReader>`. Owning, heap, type-erased Ogg
    //           demuxer (single owner; not the shared `Rc`/`Arc`).
    // Why:      Source of raw Opus packets.
    // TS map:   `format: FormatReader;`
    format: Box<dyn FormatReader>,
    // What:     `decoder: opus::Decoder`. The libopus decoder VALUE (owned by
    //           this struct, not boxed: it is a concrete type, not a trait object).
    // Why:      Decodes each Opus packet to f32 PCM.
    // TS map:   `decoder: OpusDecoder;`
    decoder: opus::Decoder,
    // What:     `track_id: u32`. Id of the Opus track (matches `u32` symphonia ids).
    // Why:      Skip packets from other tracks.
    // TS map:   `trackId: number;`
    track_id: u32,
    // What:     `channels: usize`. Channel count kept as `usize` (1 or 2) for
    //           buffer math (frames * channels) without casts.
    // Why:      Slice the decoded output and size the scratch buffer.
    // TS map:   `channels: number;`
    channels: usize,
    // What:     `spec: AudioSpec`. Cached rate(=48000)/channels/duration.
    // Why:      `spec()` returns it directly.
    // TS map:   `spec: AudioSpec;`
    spec: AudioSpec,
    // What:     `scratch: Vec<f32>`. A reusable owned f32 buffer libopus writes
    //           into each call (sized `MAX_FRAMES_PER_CHANNEL * channels`).
    // Why:      Avoid allocating a fresh buffer per packet.
    // TS map:   `scratch: Float32Array;`
    scratch: Vec<f32>,
    // What:     `pre_skip: usize`. Remaining encoder-delay frames-per-channel to
    //           discard at the very start (Opus prepends silence/priming).
    // Why:      Dropping them avoids a click and aligns playback to t=0.
    // TS map:   `preSkip: number;`
    pre_skip: usize,
}

// What:     `impl OpusSource { ... }`. Inherent methods (the constructor).
// Why:      Holds `new`.
// TS map:   the static/non-interface methods of the class.
impl OpusSource {
    // What:     `pub fn new(format: Box<dyn FormatReader>, params: CodecParameters,
    //           track_id: u32) -> Result<Self, PlayerError>`. Takes ownership of
    //           the demuxer and params; builds a libopus decoder.
    // Why:      Set up Opus decoding for this track, rejecting >2 channels.
    // TS map:   `static create(format, params, trackId): OpusSource`
    pub fn new(
        format: Box<dyn FormatReader>,
        params: CodecParameters,
        track_id: u32,
    ) -> Result<Self, PlayerError> {
        // What:     `let channels = match params.channels { ... };`. Pattern-match
        //           the `Option<Channels>` to a numeric count, erroring if absent.
        // Why:      We must know the layout to configure libopus.
        // TS map:   `const channels = params.channels?.count(); if (channels == null) throw ...;`
        let channels = match params.channels {
            // What:     `Some(c) => c.count()`. Present: `.count()` -> `usize`.
            // Why:      Real channel count.
            // TS map:   `channels = c.count();`
            Some(c) => c.count(),
            // What:     `None => return Err(PlayerError::Unsupported(...))`. Missing
            //           layout: `.to_string()` makes an owned message; return early.
            // Why:      Cannot decode without knowing channels.
            // TS map:   `throw new PlayerError.Unsupported("opus: unknown channels");`
            None => {
                return Err(PlayerError::Unsupported(
                    "opus: unknown channel layout".to_string(),
                ))
            }
        };

        // What:     `let opus_channels = match channels { ... };`. Map the numeric
        //           count to libopus's `Channels` enum, rejecting anything else.
        // Why:      libopus's API takes the enum, not a number.
        // TS map:   `const opusChannels = channels === 1 ? Mono : channels === 2 ? Stereo : (() => { throw ... })();`
        let opus_channels = match channels {
            // What:     `MONO => opus::Channels::Mono`. The `Channels::Mono` enum
            //           variant (a unit constructor, value 1).
            // Why:      One channel.
            // TS map:   `case 1: return Channels.Mono;`
            MONO => opus::Channels::Mono,
            // What:     `STEREO => opus::Channels::Stereo`. The stereo variant (2).
            // Why:      Two channels.
            // TS map:   `case 2: return Channels.Stereo;`
            STEREO => opus::Channels::Stereo,
            // What:     `other => return Err(PlayerError::Unsupported(format!(...)))`.
            //           Bind the unmatched count to `other`; `format!` builds an
            //           owned `String` with it interpolated (`{other}`); return early.
            // Why:      We only support mono/stereo (no surround) in this toy player.
            // TS map:   `throw new PlayerError.Unsupported(`opus: ${other} channels`);`
            other => {
                return Err(PlayerError::Unsupported(format!(
                    "opus: {other} channels (only mono/stereo supported)"
                )))
            }
        };

        // What:     `let decoder = opus::Decoder::new(OPUS_RATE, opus_channels)?;`.
        //           Constructs the libopus decoder at 48 kHz for the layout. `?`
        //           converts an `opus::Error` to `PlayerError` and returns on fail.
        // Why:      The decoder we feed packets to.
        // TS map:   `const decoder = new OpusDecoder(OPUS_RATE, opusChannels);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const decoder = new OpusDecoder(OPUS_RATE, opusChannels);
        // ```
        let decoder = opus::Decoder::new(OPUS_RATE, opus_channels)?;

        // What:     `let pre_skip = params.delay.unwrap_or(0) as usize;`. `delay`
        //           is `Option<u32>` (the pre-skip the Ogg mapper read from
        //           `OpusHead`); `.unwrap_or(0)` defaults to 0; `as usize` widens
        //           to the buffer-math type.
        // Why:      Number of priming frames-per-channel to discard at the start.
        // TS map:   `const preSkip = params.delay ?? 0;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const preSkip = params.delay ?? 0;
        // ```
        let pre_skip = params.delay.unwrap_or(0) as usize;

        // What:     `let duration_secs = match params.n_frames { ... };`. Compute
        //           seconds from the total frame count (always at 48 kHz for Opus).
        // Why:      The seek bar needs the track length.
        // TS map:   `const durationSecs = params.nFrames != null ? params.nFrames / 48000 : 0;`
        let duration_secs = match params.n_frames {
            // What:     `Some(n) => n as f64 / OPUS_RATE as f64`. Cast both to f64
            //           before dividing (integer division would truncate).
            // Why:      seconds = frames / 48000.
            // TS map:   `return n / 48000;`
            Some(n) => n as f64 / OPUS_RATE as f64,
            // What:     `None => 0.0`. Unknown frame count -> unknown duration.
            // Why:      Avoid guessing.
            // TS map:   `return 0;`
            None => 0.0,
        };

        // What:     `let spec = AudioSpec { rate: OPUS_RATE, channels: channels as u16,
        //           duration_secs };`. Build the public spec; `channels as u16`
        //           narrows the `usize` count to the `u16` field.
        // Why:      Report 48 kHz + layout + length to callers.
        // TS map:   `const spec = { rate: OPUS_RATE, channels, durationSecs };`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const spec = { rate: OPUS_RATE, channels, durationSecs };
        // ```
        let spec = AudioSpec {
            rate: OPUS_RATE,
            channels: channels as u16,
            duration_secs,
        };

        // What:     `let scratch = vec![0.0f32; MAX_FRAMES_PER_CHANNEL * channels];`.
        //           The `vec![value; count]` macro builds a `Vec<f32>` of `count`
        //           copies of `0.0f32` (the `f32` suffix fixes the float type).
        // Why:      A buffer guaranteed large enough for one decoded Opus packet.
        // TS map:   `const scratch = new Float32Array(MAX_FRAMES_PER_CHANNEL * channels);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const scratch = new Float32Array(MAX_FRAMES_PER_CHANNEL * channels);
        // ```
        let scratch = vec![0.0f32; MAX_FRAMES_PER_CHANNEL * channels];

        // What:     `Ok(OpusSource { format, decoder, track_id, channels, spec,
        //           scratch, pre_skip })`. Build the struct (field shorthand for
        //           same-named locals) and wrap in `Ok`. Tail -> return.
        // Why:      Return the ready Opus source.
        // TS map:   `return new OpusSource(format, decoder, trackId, channels, spec, scratch, preSkip);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return new OpusSource(format, decoder, trackId, channels, spec, scratch, preSkip);
        // ```
        Ok(OpusSource {
            format,
            decoder,
            track_id,
            channels,
            spec,
            scratch,
            pre_skip,
        })
    }
}

// What:     `impl Source for OpusSource { ... }`. Implements the shared interface.
// Why:      So `open()` can return it as `Box<dyn Source>`.
// TS map:   `class OpusSource implements Source { ... }`
impl Source for OpusSource {
    // What:     `fn spec(&self) -> AudioSpec { self.spec }`. Returns a copy of the
    //           cached spec (`AudioSpec` is `Copy`).
    // Why:      Report the stream shape.
    // TS map:   `spec(): AudioSpec { return this.spec; }`
    fn spec(&self) -> AudioSpec {
        // What:     `self.spec` tail expression -> returned by value (copy).
        // Why:      Hand back the spec.
        // TS map:   `return this.spec;`
        self.spec
    }

    // What:     `fn next_chunk(&mut self) -> Result<Vec<f32>, PlayerError>`. Pulls
    //           the next Opus packet and decodes it to interleaved f32.
    // Why:      Produce the next PCM block (or EOF).
    // TS map:   `nextChunk(): number[]`
    fn next_chunk(&mut self) -> Result<Vec<f32>, PlayerError> {
        // What:     `loop { ... }`. Repeat because some packets are other tracks
        //           or get fully consumed by pre-skip and yield nothing.
        // Why:      Keep going until we have audible samples or hit EOF.
        // TS map:   `while (true) { ... }`
        loop {
            // What:     `let packet = match self.format.next_packet() { ... };`.
            //           Demux the next packet, mapping EOF/reset to an empty Vec.
            // Why:      Get a raw Opus packet, handling end-of-stream.
            // TS map:   `let packet; try { packet = format.nextPacket(); } catch (e) { if (isEof(e)) return []; throw e; }`
            let packet = match self.format.next_packet() {
                // What:     `Ok(p) => p`. Unwrap the packet on success.
                // Why:      We have something to decode.
                // TS map:   `packet = p;`
                Ok(p) => p,
                // What:     `Err(Error::IoError(e)) if e.kind() == ErrorKind::UnexpectedEof
                //           => return Ok(Vec::new())`. EOF -> empty Vec (our signal).
                // Why:      End of file -> stop cleanly.
                // TS map:   `if (e.kind === "UnexpectedEof") return [];`
                Err(Error::IoError(e)) if e.kind() == ErrorKind::UnexpectedEof => {
                    return Ok(Vec::new())
                }
                // What:     `Err(Error::ResetRequired) => return Ok(Vec::new())`.
                //           Treat reset-required as end-of-track.
                // Why:      Simple player: end instead of resetting.
                // TS map:   `if (e.kind === "ResetRequired") return [];`
                Err(Error::ResetRequired) => return Ok(Vec::new()),
                // What:     `Err(e) => return Err(e.into())`. Other errors: convert
                //           to `PlayerError` and propagate.
                // Why:      Surface genuine demux failures.
                // TS map:   `throw toPlayerError(e);`
                Err(e) => return Err(e.into()),
            };

            // What:     `if packet.track_id() != self.track_id { continue; }`. Skip
            //           packets that are not our Opus track.
            // Why:      A container can interleave multiple tracks.
            // TS map:   `if (packet.trackId() !== this.trackId) continue;`
            if packet.track_id() != self.track_id {
                continue;
            }

            // What:     `let frames = self.decoder.decode_float(packet.buf(),
            //           &mut self.scratch, false)?;`. `packet.buf()` is the raw
            //           Opus bytes (`&[u8]`); `&mut self.scratch` lends the output
            //           buffer mutably; `false` = "this is not forward-error-
            //           correction recovery". Returns frames PER CHANNEL (`usize`).
            //           `?` converts an `opus::Error` to `PlayerError`.
            // Why:      Decode one packet into the scratch buffer.
            // TS map:   `const frames = decoder.decodeFloat(packet.buf(), scratch, false);`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const frames = decoder.decodeFloat(packet.buf(), scratch, false);
            // ```
            let frames = self
                .decoder
                .decode_float(packet.buf(), &mut self.scratch, false)?;

            // What:     `let total = frames * self.channels;`. Total INTERLEAVED
            //           sample count (frames-per-channel times channels).
            // Why:      That many leading entries of `scratch` are valid this call.
            // TS map:   `const total = frames * this.channels;`
            let total = frames * self.channels;

            // What:     `let drop_frames = self.pre_skip.min(frames);`. `.min(frames)`
            //           returns the smaller of the remaining pre-skip and this
            //           packet's frame count, so we never drop more than we have.
            // Why:      Discard priming frames spread across the first packet(s).
            // TS map:   `const dropFrames = Math.min(this.preSkip, frames);`
            let drop_frames = self.pre_skip.min(frames);

            // What:     `self.pre_skip -= drop_frames;`. Subtract what we are about
            //           to drop from the remaining pre-skip counter.
            // Why:      Track how much priming is left for later packets.
            // TS map:   `this.preSkip -= dropFrames;`
            self.pre_skip -= drop_frames;

            // What:     `let start = drop_frames * self.channels;`. The interleaved
            //           offset where audible samples begin (after dropped frames).
            // Why:      Slice past the priming samples.
            // TS map:   `const start = dropFrames * this.channels;`
            let start = drop_frames * self.channels;

            // What:     `let samples = &self.scratch[start..total];`. A BORROWED
            //           sub-slice (`&...[a..b]`) of the scratch buffer covering the
            //           audible interleaved range.
            // Why:      The portion we actually return.
            // TS map:   `const samples = scratch.subarray(start, total);`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const samples = scratch.subarray(start, total);
            // ```
            let samples = &self.scratch[start..total];

            // What:     `if samples.is_empty() { continue; }`. If this packet was
            //           entirely pre-skip (or empty), get the next one.
            // Why:      Never return an empty Vec except at true EOF (which would
            //           be misread as end-of-stream).
            // TS map:   `if (samples.length === 0) continue;`
            if samples.is_empty() {
                continue;
            }

            // What:     `return Ok(samples.to_vec());`. `.to_vec()` COPIES the
            //           borrowed slice into an owned `Vec<f32>`; `Ok(...)` wraps it.
            // Why:      Hand the caller owned interleaved samples.
            // TS map:   `return Array.from(samples);`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return Array.from(samples);
            // ```
            return Ok(samples.to_vec());
        }
    }

    // What:     `fn seek(&mut self, secs: f64) -> Result<(), PlayerError>`. Jump
    //           the demuxer to a time and clear decoder state.
    // Why:      Implement seeking for Opus.
    // TS map:   `seek(secs: number): void`
    fn seek(&mut self, secs: f64) -> Result<(), PlayerError> {
        // What:     `self.format.seek(SeekMode::Accurate, SeekTo::Time { time:
        //           Time::from(secs), track_id: Some(self.track_id) })?`. Seek by
        //           time, exactly; `Some(self.track_id)` targets our track. `?`
        //           unwraps/returns.
        // Why:      Reposition the Ogg stream at `secs`.
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

        // What:     `self.decoder.reset_state()?;`. Clears libopus's internal
        //           state so post-seek output has no leftover from before. Returns
        //           `Result<()>`; `?` converts/propagates an `opus::Error`.
        // Why:      Avoid stale samples / artifacts after a seek.
        // TS map:   `this.decoder.resetState();`
        self.decoder.reset_state()?;

        // What:     `self.pre_skip = 0;`. After seeking we are mid-stream, so there
        //           is no encoder priming left to discard.
        // Why:      Pre-skip only applies at the very start of the stream.
        // TS map:   `this.preSkip = 0;`
        self.pre_skip = 0;

        // What:     `Ok(())`. Success with the unit value. Tail -> return.
        // Why:      Seek done.
        // TS map:   `return;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return;
        // ```
        Ok(())
    }
}
