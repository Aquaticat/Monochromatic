//! Unit tests for Language Server Protocol framing.

/// Imports the framing functions under test.
use crate::lsp::protocol::{read_message, write_message, HEADER_LENGTH};

/// Imports the in-memory reader tests drive the parser from.
use std::io::BufReader;

/// Frame a body the way a client would, for the reader to parse back.
fn framed(body: &str) -> String {
    return format!("{HEADER_LENGTH}{}\r\n\r\n{body}", body.len());
}

/// A framed message is read back exactly.
#[test]
fn reads_one_framed_message() {
    let input = framed("{\"id\":1}");
    let mut reader = BufReader::new(input.as_bytes());

    assert_eq!(
        read_message(&mut reader).as_deref(),
        Some("{\"id\":1}"),
        "body round-trips"
    );
}

// What:     Two messages in one buffer, read one after the other.
// Why:      The reader must stop at the first message's declared length rather
//           than consuming everything available. A reader that over-consumed
//           would swallow the next request, and the client would hang waiting
//           for a reply to a message the server never saw.
/// Consecutive messages are read one at a time.
#[test]
fn reads_consecutive_messages() {
    let input = format!("{}{}", framed("{\"id\":1}"), framed("{\"id\":2}"));
    let mut reader = BufReader::new(input.as_bytes());

    assert_eq!(read_message(&mut reader).as_deref(), Some("{\"id\":1}"), "first");
    assert_eq!(read_message(&mut reader).as_deref(), Some("{\"id\":2}"), "second");
    assert!(read_message(&mut reader).is_none(), "then end of input");
}

/// End of input is absent rather than an error.
#[test]
fn end_of_input_is_absent() {
    let mut reader = BufReader::new("".as_bytes());

    assert!(read_message(&mut reader).is_none(), "a closed pipe ends the loop");
}

/// A message with no length header cannot be read.
#[test]
fn missing_length_header_is_absent() {
    let mut reader = BufReader::new("X-Other: 1\r\n\r\n{}".as_bytes());

    // Without a length the body has no end, so there is nothing to read.
    assert!(read_message(&mut reader).is_none(), "no length, no message");
}

/// Other headers are ignored rather than rejected.
#[test]
fn extra_headers_are_ignored() {
    let input = format!(
        "Content-Type: application/vscode-jsonrpc\r\n{HEADER_LENGTH}2\r\n\r\n{{}}"
    );
    let mut reader = BufReader::new(input.as_bytes());

    assert_eq!(read_message(&mut reader).as_deref(), Some("{}"), "body found");
}

// What:     A body containing multi-byte characters.
// Why:      The header counts BYTES, and a length computed from character count
//           would truncate the body mid-character. Rule messages quote source,
//           so non-ASCII reaches this path in practice.
/// A multi-byte body round-trips with a byte-counted length.
#[test]
fn multibyte_body_round_trips() {
    let body = "{\"m\":\"caf\u{e9} \u{1f600}\"}";
    let mut written = Vec::new();
    write_message(&mut written, body);

    let text = String::from_utf8(written).expect("written frame is UTF-8");
    let mut reader = BufReader::new(text.as_bytes());

    assert_eq!(
        read_message(&mut reader).as_deref(),
        Some(body),
        "a byte-counted length keeps the body intact"
    );
}

/// What is written can be read back.
#[test]
fn write_then_read_round_trips() {
    let mut written = Vec::new();
    write_message(&mut written, "{\"jsonrpc\":\"2.0\"}");

    let text = String::from_utf8(written).expect("UTF-8");
    assert!(text.starts_with(HEADER_LENGTH), "framed with a length header");

    let mut reader = BufReader::new(text.as_bytes());
    assert_eq!(
        read_message(&mut reader).as_deref(),
        Some("{\"jsonrpc\":\"2.0\"}"),
        "round-trips"
    );
}
