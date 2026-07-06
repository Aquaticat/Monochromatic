//! Pure `text/uri-list` parsing for the Wayland drag-and-drop adapter (Linux only).
//!
//! Split from `dnd_wayland.rs` to keep that file under the line budget, and because
//! this half is pure data transformation (no Wayland objects), so it is unit-tested
//! on its own. An inbound drop delivers a `text/uri-list` (CRLF-separated `file://`
//! URIs with optional `#` comment lines); these helpers turn it into filesystem
//! paths.

/// What:     `pub fn parse_uri_list(bytes: &[u8]) -> Vec<String>` turns a raw
///           `text/uri-list` into filesystem paths.
/// Why:      The app wants paths, not `file://` URIs.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function parseUriList(bytes: Uint8Array): string[] { ... }
/// ```
pub fn parse_uri_list(bytes: &[u8]) -> Vec<String> {
    // What:     `String::from_utf8_lossy(bytes)` decodes the bytes as UTF-8, replacing
    //           any invalid sequence rather than failing.
    // Why:      A uri-list is text; never reject a drop over an odd byte.
    let text = String::from_utf8_lossy(bytes);
    // What:     Split into lines, drop blanks and `#` comments, convert each URI to a
    //           path, and collect. `text/uri-list` is CRLF-separated with optional
    //           `#` comment lines.
    // Why:      Yield one path per dropped file.
    text.lines()
        .map(str::trim)
        .filter(|line| !line.is_empty() && !line.starts_with('#'))
        .map(uri_to_path)
        .collect()
}

/// What:     `fn uri_to_path(uri: &str) -> String` strips the `file://` scheme and
///           percent-decodes a single URI into a path.
/// Why:      `file:///home/user/hello%20world.txt` should read
///           `/home/user/hello world.txt`.
fn uri_to_path(uri: &str) -> String {
    // What:     `let rest = uri.strip_prefix("file://").unwrap_or(uri);` removes the
    //           scheme and empty authority; a non-file URI passes through unchanged.
    // Why:      Local file drops use `file://` with an empty host, so `file:///p` ->
    //           `/p`.
    let rest = uri.strip_prefix("file://").unwrap_or(uri);
    // What:     `percent_decode(rest)` turns `%XX` escapes back into bytes.
    // Why:      File managers percent-encode spaces and other characters.
    percent_decode(rest)
}

/// What:     `fn percent_decode(input: &str) -> String` decodes `%XX` escapes in a
///           single linear pass over the bytes.
/// Why:      uri-list paths are percent-encoded; a linear scan (no regex) suffices.
fn percent_decode(input: &str) -> String {
    // What:     `let bytes = input.as_bytes();` views the string as raw bytes.
    // Why:      `%XX` decoding works on bytes, then re-interpret as UTF-8.
    let bytes = input.as_bytes();
    // What:     `let mut out: Vec<u8> = Vec::with_capacity(bytes.len());` collects the
    //           decoded bytes.
    // Why:      The result is at most as long as the input.
    let mut out: Vec<u8> = Vec::with_capacity(bytes.len());
    // What:     `let mut index = 0;` is the scan cursor.
    // Why:      A manual cursor lets a `%` consume the next two hex digits.
    let mut index = 0;
    // What:     `while index < bytes.len() { ... }` walks every byte once (O(n)).
    // Why:      Single linear pass, no rescanning.
    while index < bytes.len() {
        // What:     `if bytes[index] == b'%' && index + 2 < bytes.len() { ... }` tries
        //           to decode a `%XX` triplet.
        // Why:      Only a complete escape is decoded; a stray `%` is kept literal.
        if bytes[index] == b'%' && index + 2 < bytes.len() {
            // What:     Parse the two hex digits after `%`. `from_str_radix(_, 16)`
            //           reads a base-16 number; `.ok()` turns failure into `None`.
            // Why:      Convert `%20` to the byte 0x20.
            let hex = std::str::from_utf8(&bytes[index + 1..index + 3])
                .ok()
                .and_then(|pair| u8::from_str_radix(pair, 16).ok());
            // What:     `if let Some(byte) = hex { ... }` pushes the decoded byte and
            //           skips the triplet.
            // Why:      Handle a valid escape.
            if let Some(byte) = hex {
                out.push(byte);
                index += 3;
                continue;
            }
        }
        // What:     Default: copy the byte as-is and advance one.
        // Why:      Non-escape bytes (and a malformed `%`) pass through.
        out.push(bytes[index]);
        index += 1;
    }
    // What:     `String::from_utf8_lossy(&out).into_owned()` re-interprets the decoded
    //           bytes as a UTF-8 string.
    // Why:      Paths are UTF-8; never fail on an odd byte.
    String::from_utf8_lossy(&out).into_owned()
}

/// What:     `#[cfg(test)] #[path = "dnd_wayland_parse_tests.rs"] mod tests;` pulls the
///           unit tests from the flat sibling file only in test builds.
/// Why:      Cover the parsing without a compositor, keeping the tests out of this
///           file's line budget.
#[cfg(test)]
#[path = "dnd_wayland_parse_tests.rs"]
mod tests;
