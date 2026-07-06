// What:     Unit tests for `dnd_wayland_parse.rs`, pulled in by
//           `#[cfg(test)] #[path = "dnd_wayland_parse_tests.rs"] mod tests;`. Reaches
//           the parent items via `use super::*`.
// Why:      Cover the `text/uri-list` parsing (percent-decoding, file:// scheme
//           stripping, comment/blank skipping) without a live compositor; the
//           protocol handlers are exercised by a real drag in the nested session.

// What:     `use super::*;` glob-imports the parent `dnd_wayland_parse` module.
// Why:      The parse helpers are private; tests are a child module.
use super::*;

// What:     `#[test] fn percent_decode_turns_escapes_into_bytes()` checks the decoder.
// Why:      File managers percent-encode spaces and specials in dropped URIs.
#[test]
fn percent_decode_turns_escapes_into_bytes() {
    // What:     A `%20` escape decodes to a space.
    // Why:      The most common encoded character in paths.
    assert_eq!(percent_decode("hello%20world"), "hello world");
    // What:     A string with no escapes is unchanged.
    // Why:      The common path (no specials) must pass through.
    assert_eq!(percent_decode("/tmp/plain.txt"), "/tmp/plain.txt");
    // What:     A trailing bare `%` with no two hex digits stays literal.
    // Why:      A malformed escape must not panic or drop bytes.
    assert_eq!(percent_decode("100%"), "100%");
    // What:     Multiple escapes decode independently.
    // Why:      Paths can have several encoded characters.
    assert_eq!(percent_decode("a%2Fb%2Fc"), "a/b/c");
}

// What:     `#[test] fn uri_to_path_strips_file_scheme()` checks scheme stripping plus
//           decoding.
// Why:      The app wants a filesystem path, not a `file://` URI.
#[test]
fn uri_to_path_strips_file_scheme() {
    // What:     `file:///abs/path` becomes `/abs/path` (empty authority).
    // Why:      Local file drops use an empty host.
    assert_eq!(uri_to_path("file:///home/user/hello.txt"), "/home/user/hello.txt");
    // What:     Scheme stripping and percent-decoding compose.
    // Why:      A dropped file with a space in its name must resolve.
    assert_eq!(uri_to_path("file:///tmp/hello%20world.txt"), "/tmp/hello world.txt");
    // What:     A non-`file` string passes through unchanged.
    // Why:      Never mangle input that is not a file URI.
    assert_eq!(uri_to_path("/already/a/path"), "/already/a/path");
}

// What:     `#[test] fn parse_uri_list_yields_paths_and_skips_noise()` checks the whole
//           uri-list parse.
// Why:      This is what a real inbound drop delivers.
#[test]
fn parse_uri_list_yields_paths_and_skips_noise() {
    // What:     A CRLF uri-list with a comment and a blank line.
    // Why:      `text/uri-list` allows `#` comments and blank lines.
    let raw = b"#comment\r\nfile:///tmp/a.txt\r\n\r\nfile:///tmp/b%20c.txt\r\n";
    // What:     `parse_uri_list(raw)` yields only the two real paths, decoded.
    // Why:      Comments and blanks are dropped; URIs become paths.
    assert_eq!(
        parse_uri_list(raw),
        vec!["/tmp/a.txt".to_string(), "/tmp/b c.txt".to_string()]
    );
    // What:     An empty input yields no paths.
    // Why:      A drop that carried nothing usable must not invent entries.
    assert!(parse_uri_list(b"").is_empty());
}
