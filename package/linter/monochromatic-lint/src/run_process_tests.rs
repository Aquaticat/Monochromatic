//! What: Controls for writing output to a stream that may close early or fail.
//! Why: A closed pipe is an ordinary end of output; any other write failure must change the exit status.
//! Argument parsing and real streams are exercised by the binary-level container tests.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! describe('emit', () => { /* bytes written, closed pipe tolerated, other failures reported */ });
//! ```

/// Import the stream writer under test.
use super::emit;
use std::io::{ErrorKind, Write};

/// A stream that records what it receives and can fail on write or on flush with a chosen error.
struct Stream {
    /// Bytes accepted so far.
    written: Vec<u8>,
    /// Error every write returns, if any.
    write_failure: Option<ErrorKind>,
    /// Error every flush returns, if any.
    flush_failure: Option<ErrorKind>,
    /// How many times flush was called.
    flushes: usize,
}

/// Build a stream with the given failure behavior.
fn stream(write_failure: Option<ErrorKind>, flush_failure: Option<ErrorKind>) -> Stream {
    return Stream {
        written: Vec::<u8>::new(),
        write_failure,
        flush_failure,
        flushes: 0,
    };
}

/// Accept or refuse bytes as configured.
impl Write for Stream {
    /// Record the bytes, or fail with the configured error.
    fn write(&mut self, buffer: &[u8]) -> std::io::Result<usize> {
        if let Some(kind) = self.write_failure {
            return Err(std::io::Error::from(kind));
        }
        self.written.extend_from_slice(buffer);
        return Ok(buffer.len());
    }

    /// Count the flush, or fail with the configured error.
    fn flush(&mut self) -> std::io::Result<()> {
        self.flushes += 1;
        if let Some(kind) = self.flush_failure {
            return Err(std::io::Error::from(kind));
        }
        return Ok(());
    }
}

/// Text is written whole and flushed once; empty text touches the stream not at all.
#[test]
fn text_is_written_whole_and_flushed() {
    let mut open: Stream = stream(None, None);
    assert!(emit(&mut open, "{\"code\":\"x\"}\n🚀\n"));
    assert_eq!(open.written, "{\"code\":\"x\"}\n🚀\n".as_bytes());
    assert_eq!(open.flushes, 1);
    let mut untouched: Stream = stream(Some(ErrorKind::Other), Some(ErrorKind::Other));
    assert!(emit(&mut untouched, ""));
    assert!(untouched.written.is_empty());
    assert_eq!(untouched.flushes, 0);
}

/// A closed pipe on write or flush is tolerated; any other failure is reported.
#[test]
fn only_a_closed_pipe_is_tolerated() {
    assert!(emit(&mut stream(Some(ErrorKind::BrokenPipe), None), "x"));
    assert!(emit(&mut stream(None, Some(ErrorKind::BrokenPipe)), "x"));
    assert!(!emit(
        &mut stream(Some(ErrorKind::PermissionDenied), None),
        "x"
    ));
    assert!(!emit(&mut stream(None, Some(ErrorKind::StorageFull)), "x"));
    // A failed write is not followed by a flush.
    let mut failed: Stream = stream(Some(ErrorKind::PermissionDenied), None);
    assert!(!emit(&mut failed, "x"));
    assert_eq!(failed.flushes, 0);
}
