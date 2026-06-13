//! One error type for the native decode path: I/O, symphonia, opus, and
//! unsupported cases funnel into PlayerError so functions can use `?` freely.
//! Ported from the desktop crate (Audio variant omitted: no output stage yet).
//! Verbose dum-dum-non-ts comments deferred to finalization.

use std::fmt;

/// Decode-path failures: wrapped I/O, symphonia, and opus errors, plus an owned
/// message for unsupported files/codecs.
#[derive(Debug)]
pub enum PlayerError {
    /// Filesystem/stream failure opening or reading the file.
    Io(std::io::Error),
    /// symphonia demux/decode failure.
    Decode(symphonia::core::errors::Error),
    /// libopus decode failure.
    Opus(opus::Error),
    /// Unsupported file/codec situation, with a human-readable reason.
    Unsupported(String),
}

impl fmt::Display for PlayerError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            PlayerError::Io(e) => write!(f, "i/o error: {e}"),
            PlayerError::Decode(e) => write!(f, "decode error: {e}"),
            PlayerError::Opus(e) => write!(f, "opus error: {e}"),
            PlayerError::Unsupported(m) => write!(f, "unsupported: {m}"),
        }
    }
}

impl std::error::Error for PlayerError {}

impl From<std::io::Error> for PlayerError {
    fn from(e: std::io::Error) -> PlayerError {
        PlayerError::Io(e)
    }
}

impl From<symphonia::core::errors::Error> for PlayerError {
    fn from(e: symphonia::core::errors::Error) -> PlayerError {
        PlayerError::Decode(e)
    }
}

impl From<opus::Error> for PlayerError {
    fn from(e: opus::Error) -> PlayerError {
        PlayerError::Opus(e)
    }
}
