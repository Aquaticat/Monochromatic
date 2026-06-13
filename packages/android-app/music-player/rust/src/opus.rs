//! Opus decode path: symphonia demuxes Ogg/Opus and yields raw packets; libopus
//! (the opus crate) decodes them. Output is always 48 kHz. Ported from the
//! desktop crate; dum-dum-non-ts comments deferred.

use symphonia::core::errors::Error;
use symphonia::core::formats::{FormatReader, Track};

use crate::decode::{seek_format, AudioSpec, Source};
use crate::error::PlayerError;

/// libopus always decodes to 48 kHz.
const OPUS_RATE: u32 = 48_000;
/// Largest samples-per-channel one Opus packet can decode to (a 120 ms frame at 48 kHz).
const MAX_FRAMES_PER_CHANNEL: usize = 5760;
const STEREO: usize = 2;
const MONO: usize = 1;

/// Live Opus decode state: the Ogg demuxer, the libopus decoder, a reusable
/// scratch buffer, and the remaining encoder pre-skip frames to discard.
pub struct OpusSource {
    format: Box<dyn FormatReader>,
    decoder: opus::Decoder,
    track_id: u32,
    channels: usize,
    spec: AudioSpec,
    scratch: Vec<f32>,
    pre_skip: usize,
}

impl OpusSource {
    pub fn new(
        format: Box<dyn FormatReader>,
        track: Track,
        track_id: u32,
    ) -> Result<Self, PlayerError> {
        let audio_params = track
            .codec_params
            .as_ref()
            .and_then(|cp| cp.audio())
            .ok_or_else(|| {
                PlayerError::Unsupported("opus: no audio codec parameters".to_string())
            })?;
        let channels = match &audio_params.channels {
            Some(c) => c.count(),
            None => {
                return Err(PlayerError::Unsupported(
                    "opus: unknown channel layout".to_string(),
                ))
            }
        };
        let opus_channels = match channels {
            MONO => opus::Channels::Mono,
            STEREO => opus::Channels::Stereo,
            other => {
                return Err(PlayerError::Unsupported(format!(
                    "opus: {other} channels (only mono/stereo supported)"
                )))
            }
        };
        let decoder = opus::Decoder::new(OPUS_RATE, opus_channels)?;
        let pre_skip = track.delay.unwrap_or(0) as usize;
        let duration_secs = match track.num_frames {
            Some(n) => n as f64 / OPUS_RATE as f64,
            None => 0.0,
        };
        let spec = AudioSpec {
            rate: OPUS_RATE,
            channels: channels as u16,
            duration_secs,
        };
        let scratch = vec![0.0f32; MAX_FRAMES_PER_CHANNEL * channels];
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

impl Source for OpusSource {
    fn spec(&self) -> AudioSpec {
        self.spec
    }

    fn next_chunk(&mut self) -> Result<Vec<f32>, PlayerError> {
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
            let frames = self
                .decoder
                .decode_float(&packet.data, &mut self.scratch, false)?;
            let total = frames * self.channels;
            let drop_frames = self.pre_skip.min(frames);
            self.pre_skip -= drop_frames;
            let start = drop_frames * self.channels;
            let samples = &self.scratch[start..total];
            if samples.is_empty() {
                continue;
            }
            return Ok(samples.to_vec());
        }
    }

    fn seek(&mut self, secs: f64) -> Result<(), PlayerError> {
        seek_format(self.format.as_mut(), self.track_id, secs)?;
        self.decoder.reset_state()?;
        self.pre_skip = 0;
        Ok(())
    }
}
