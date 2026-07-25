//! Reading and writing Language Server Protocol messages over stdio.

/// Imports the buffered reading and writing the transport needs.
use std::io::{BufRead, Write};

// What:     `pub const HEADER_LENGTH: &str = "Content-Length: ";`. The one header
//           the protocol requires.
// Why:      LSP frames each message with an HTTP-style header block, and the
//           length is what tells the reader where the JSON body ends. Naming it
//           keeps the parser and the writer from disagreeing about spelling.
/// Header naming a message body's length in bytes.
pub const HEADER_LENGTH: &str = "Content-Length: ";

// What:     `pub fn read_message(input: &mut impl BufRead) -> Option<String>`.
//           `impl BufRead` accepts any buffered reader, so a test can drive this
//           from an in-memory buffer rather than from a real stdin.
// Why:      That is what makes the transport testable without spawning a process.
//
// In TS you'd write (pseudocode):
// ```ts
// function readMessage(input: BufReader): string | undefined
// ```
/// Read one framed message body, absent at end of input.
pub fn read_message(input: &mut impl BufRead) -> Option<String> {
    let mut length: Option<usize> = None;

    // The header block ends at a blank line, which is what this loop watches for.
    loop {
        let mut line = String::new();

        // `read_line` answers how many bytes it read; zero means end of input,
        // which is how a client closing the pipe reaches us.
        let read = input.read_line(&mut line).ok()?;
        if read == 0 {
            return None;
        }

        let trimmed = line.trim_end();
        if trimmed.is_empty() {
            break;
        }

        // `.strip_prefix(..)` is both the test and the removal, and the parse
        // answers `Result`, so a malformed length is simply not a length.
        if let Some(value) = trimmed.strip_prefix(HEADER_LENGTH) {
            length = value.trim().parse().ok();
        }
    }

    // A message with no length header cannot be read: its body has no end.
    let length = length?;

    // `vec![0; length]` allocates exactly the body's size, so the read below
    // stops at the message boundary rather than consuming the next one.
    let mut body = vec![0; length];
    input.read_exact(&mut body).ok()?;

    return String::from_utf8(body).ok();
}

// What:     `pub fn write_message(output: &mut impl Write, body: &str)`. Frames
//           one message and flushes it.
// Why:      The flush matters: a client waits for a complete message, and a
//           buffered reply that never leaves the process reads to it exactly
//           like a hung server.
/// Write one framed message, flushing so the client sees it.
pub fn write_message(output: &mut impl Write, body: &str) {
    // The length is in BYTES, not characters, which differ the moment a
    // diagnostic message contains anything outside ASCII.
    let framed = format!("{HEADER_LENGTH}{}\r\n\r\n{body}", body.len());

    // Write failures are ignored deliberately: the client has gone, and there is
    // nowhere left to report that to.
    let _ = output.write_all(framed.as_bytes());
    let _ = output.flush();
}
