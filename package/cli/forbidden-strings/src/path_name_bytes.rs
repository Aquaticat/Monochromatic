//! What: Native pathname bytes and redacted protocol-safe component spelling.
//! Why: Candidate scanning must not require every operating-system pathname to be UTF-8.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // Keep native path bytes for matching; encode only when constructing the safe display label.
//! ```

/// Import native path components without converting the pathname to a lossy string.
use std::path::{Component, Path};

/// Normalize native separator bytes while retaining every non-separator byte for matching.
pub(crate) fn normalized_path(path: &Path) -> Vec<u8> {
    // The platform's encoded bytes remain read-only; Vec owns the normalized copy.
    let mut bytes: Vec<u8> = path.as_os_str().as_encoded_bytes().to_vec();
    if cfg!(windows) {
        for byte in &mut bytes {
            if *byte == b'\\' { *byte = b'/'; }
        }
        // A drive-relative name contains a volume prefix and a real first filename component.
        if bytes.len() > 2 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':' && bytes[2] != b'/' {
            bytes.insert(2, b'/');
        }
    }
    return bytes;
}

/// Count volume-prefix components excluded by the incumbent pathname rule.
pub(crate) fn prefix_parts(path: &Path) -> usize {
    if !cfg!(windows) { return 0; }
    // Native parsing identifies drive/UNC prefixes; arbitrary colon-containing names remain ordinary components.
    let Some(Component::Prefix(prefix)) = path.components().next() else { return 0; };
    let mut count: usize = 0;
    let mut in_component: bool = false;
    for byte in prefix.as_os_str().as_encoded_bytes() {
        if *byte == b'/' || *byte == b'\\' {
            in_component = false;
        } else if !in_component {
            count += 1;
            in_component = true;
        }
    }
    return count;
}

/// Named predicate for the byte-slice component iterator.
pub(crate) fn is_slash(byte: &u8) -> bool {
    return *byte == b'/';
}

/// What: Encode an unmatched component for the existing single-line display protocol.
/// Why: Invalid UTF-8 bytes remain distinguishable and cannot be discarded before matching.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function safeComponent(bytes): string;
/// ```
pub(crate) fn safe_component(component: &[u8]) -> String {
    // String owns the display label; only output spelling, never matcher input, is UTF-8 text.
    let mut safe: String = String::new();
    // Each chunk lends valid text plus the following invalid bytes, so every input byte is accounted for once.
    for chunk in component.utf8_chunks() {
        for character in chunk.valid().chars() {
            if character == ':' {
                safe.push_str("\\x3a");
            } else if character == '\\' {
                safe.push_str("\\\\");
            } else if character.is_control() {
                safe.push_str(format!("\\u{{{:x}}}", character as u32).as_str());
            } else {
                safe.push(character);
            }
        }
        for byte in chunk.invalid() {
            safe.push_str(format!("\\x{byte:02x}").as_str());
        }
    }
    return safe;
}
