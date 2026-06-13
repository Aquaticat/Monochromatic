//! Decoding: turn an audio file into interleaved f32 PCM. One demux path
//! (symphonia probes + demuxes) feeds two decode paths: symphonia's decoders for
//! FLAC/WAV/MP3/Vorbis/AAC/ALAC, and libopus (the opus crate) for Opus.
//! Ported from the desktop crate; dum-dum-non-ts comments deferred.

use std::fs::File;
use std::path::Path;

use symphonia::core::codecs::audio::well_known::CODEC_ID_OPUS;
use symphonia::core::codecs::audio::{AudioDecoder, AudioDecoderOptions};
use symphonia::core::errors::Error;
use symphonia::core::formats::probe::Hint;
use symphonia::core::formats::{FormatOptions, FormatReader, SeekMode, SeekTo, Track, TrackType};
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::units::{Duration, Timestamp};

use crate::error::PlayerError;
use crate::opus::OpusSource;

/// Decoded-stream shape: sample rate, channel count, total duration in seconds.
#[derive(Clone, Copy, Debug)]
pub struct AudioSpec {
    pub rate: u32,
    pub channels: u16,
    pub duration_secs: f64,
}

/// A decode source: query its spec, pull interleaved f32 chunks (an empty chunk
/// signals EOF), and seek by seconds. `Send` so the engine worker thread can own it.
pub trait Source: Send {
    fn spec(&self) -> AudioSpec;
    fn next_chunk(&mut self) -> Result<Vec<f32>, PlayerError>;
    fn seek(&mut self, secs: f64) -> Result<(), PlayerError>;
}

/// Open an audio file: probe the container, find the first audio track, and
/// return the right decoder (libopus for Opus, symphonia otherwise).
pub fn open(path: &Path) -> Result<Box<dyn Source>, PlayerError> {
    let file = File::open(path)?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());
    let mut hint = Hint::new();
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        hint.with_extension(ext);
    }
    let format = symphonia::default::get_probe().probe(
        &hint,
        mss,
        FormatOptions::default(),
        MetadataOptions::default(),
    )?;
    let (track_id, is_opus, track) = {
        let track = format
            .first_track_known_codec(TrackType::Audio)
            .ok_or_else(|| PlayerError::Unsupported("no audio track".to_string()))?;
        let audio_params = track
            .codec_params
            .as_ref()
            .and_then(|cp| cp.audio())
            .ok_or_else(|| {
                PlayerError::Unsupported("track has no audio codec parameters".to_string())
            })?;
        (track.id, audio_params.codec == CODEC_ID_OPUS, track.clone())
    };
    if is_opus {
        let source = OpusSource::new(format, track, track_id)?;
        Ok(Box::new(source))
    } else {
        let source = SymphoniaSource::new(format, track, track_id)?;
        Ok(Box::new(source))
    }
}

/// Seek a demuxer to `secs` from the audible start, converting to an absolute
/// frame timestamp (adding the track's start_ts so second 0 lands on the first
/// audible frame, not the rejected frame 0 of an Ogg/Opus pre-skip stream).
/// Shared by both decode paths so the timeline math lives in one place.
pub(crate) fn seek_format(
    format: &mut dyn FormatReader,
    track_id: u32,
    secs: f64,
) -> Result<(), PlayerError> {
    let track = format
        .tracks()
        .iter()
        .find(|t| t.id == track_id)
        .ok_or_else(|| PlayerError::Unsupported("seek: track not found".to_string()))?;
    let start_ts: Timestamp = track.start_ts;
    let rate = track
        .codec_params
        .as_ref()
        .and_then(|cp| cp.audio())
        .and_then(|a| a.sample_rate)
        .ok_or_else(|| PlayerError::Unsupported("seek: unknown sample rate".to_string()))?;
    let n_frames = track.num_frames;
    let secs_clamped = if secs > 0.0 { secs } else { 0.0 };
    let offset_frames = (secs_clamped * f64::from(rate)).round() as u64;
    let mut target_ts: Timestamp = start_ts.saturating_add(Duration::new(offset_frames));
    if let Some(n_frames) = n_frames {
        let max_ts = start_ts.saturating_add(Duration::new(n_frames));
        if target_ts > max_ts {
            target_ts = max_ts;
        }
    }
    format.seek(
        SeekMode::Accurate,
        SeekTo::Timestamp {
            ts: target_ts,
            track_id,
        },
    )?;
    Ok(())
}

/// symphonia-decoded source (everything except Opus). Primes one chunk in `new`
/// to learn the true rate/channels (AAC/ALAC report them only after first decode).
struct SymphoniaSource {
    format: Box<dyn FormatReader>,
    decoder: Box<dyn AudioDecoder>,
    track_id: u32,
    spec: AudioSpec,
    pending: Option<Vec<f32>>,
    n_frames: Option<u64>,
}

impl SymphoniaSource {
    fn new(
        format: Box<dyn FormatReader>,
        track: Track,
        track_id: u32,
    ) -> Result<Self, PlayerError> {
        let audio_params = track
            .codec_params
            .as_ref()
            .and_then(|cp| cp.audio())
            .ok_or_else(|| {
                PlayerError::Unsupported("track has no audio codec parameters".to_string())
            })?;
        let decoder = symphonia::default::get_codecs()
            .make_audio_decoder(audio_params, &AudioDecoderOptions::default())?;
        let rate = audio_params.sample_rate.unwrap_or(0);
        let channels = match &audio_params.channels {
            Some(c) => c.count(),
            None => 0,
        };
        let n_frames = track.num_frames;
        let spec = AudioSpec {
            rate,
            channels: channels as u16,
            duration_secs: 0.0,
        };
        let mut source = SymphoniaSource {
            format,
            decoder,
            track_id,
            spec,
            pending: None,
            n_frames,
        };
        let first = source.decode_next_raw()?;
        let duration_secs = match (source.n_frames, source.spec.rate) {
            (Some(n), r) if r > 0 => n as f64 / r as f64,
            _ => 0.0,
        };
        source.spec.duration_secs = duration_secs;
        source.pending = Some(first);
        Ok(source)
    }

    fn decode_next_raw(&mut self) -> Result<Vec<f32>, PlayerError> {
        loop {
            let packet = match self.format.next_packet() {
                Ok(Some(p)) => p,
                Ok(None) => return Ok(Vec::new()),
                Err(Error::ResetRequired) => return Ok(Vec::new()),
                Err(e) => return Err(e.into()),
            };
            if packet.track_id != self.track_id {
                continue;
            }
            match self.decoder.decode(&packet) {
                Ok(decoded) => {
                    let spec = decoded.spec();
                    self.spec.rate = spec.rate();
                    self.spec.channels = spec.channels().count() as u16;
                    let mut out: Vec<f32> = Vec::new();
                    decoded.copy_to_vec_interleaved(&mut out);
                    if out.is_empty() {
                        continue;
                    }
                    return Ok(out);
                }
                Err(Error::DecodeError(_)) => continue,
                Err(Error::IoError(_)) => continue,
                Err(e) => return Err(e.into()),
            }
        }
    }
}

impl Source for SymphoniaSource {
    fn spec(&self) -> AudioSpec {
        self.spec
    }

    fn next_chunk(&mut self) -> Result<Vec<f32>, PlayerError> {
        if let Some(chunk) = self.pending.take() {
            return Ok(chunk);
        }
        self.decode_next_raw()
    }

    fn seek(&mut self, secs: f64) -> Result<(), PlayerError> {
        seek_format(self.format.as_mut(), self.track_id, secs)?;
        self.decoder.reset();
        self.pending = None;
        Ok(())
    }
}
