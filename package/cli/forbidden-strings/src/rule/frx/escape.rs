//! Escapes a bare literal line into the engine's always-verbose dialect.
//!
//! The forbidden-regex engine is always in verbose mode, so unescaped whitespace
//! is swallowed and a `#` at a line start begins a comment. A literal rule must
//! therefore be rewritten so every byte matches itself and nothing else: the
//! escapable metacharacters and every whitespace byte gain a leading backslash,
//! and every other byte passes through as a one-byte literal. This is a
//! syntax-boundary transformer (literal text into pattern syntax), so its one job
//! is that the compiled pattern matches exactly the input literal.

/// Reports whether a character must be backslash-escaped in the verbose dialect.
///
/// The set is exactly the bytes the engine's escape parser accepts as a literal
/// byte (`parse_escape`): the metacharacters below plus every ASCII whitespace
/// byte. Every other byte is a plain literal in atom position, so escaping it is
/// unnecessary and (for non-listed bytes) would be an "unsupported escape". The
/// whitespace test uses `is_ascii_whitespace`, matching the engine's own cursor
/// and escape parser (space, tab, newline, form feed, carriage return; not the
/// vertical tab, which the engine treats as a plain literal byte).
fn needs_escape(ch: char) -> bool {
    // Whitespace is swallowed by verbose mode unless escaped.
    if ch.is_ascii_whitespace() {
        return true;
    }
    // Metacharacters special in atom, postfix, or verbose-comment position, each
    // of which the engine accepts as a literal byte when backslash-escaped.
    return matches!(
        ch,
        '.' | '[' | ']' | '(' | ')' | '{' | '}' | '?' | '|' | '&' | '~' | '^' | '$' | '\\' | '#'
            | '-' | '/' | '*' | '+'
    );
}

/// Escapes one literal line into a verbose-dialect pattern matching it exactly.
///
/// Each escapable metacharacter and whitespace byte gains a leading backslash;
/// every other character (ordinary ASCII, and every byte of a multi-byte UTF-8
/// character, all of which are non-ASCII and never in the escape set) is emitted
/// unchanged. Only ASCII backslashes are inserted, always before an ASCII byte,
/// so the result stays valid UTF-8 without a fallible reassembly step.
pub(super) fn escape_literal(literal: &str) -> String {
    // Reserve a little slack for the backslashes escapable characters add.
    let mut out = String::with_capacity(literal.len() + literal.len() / 4);
    for ch in literal.chars() {
        if needs_escape(ch) {
            out.push('\\');
        }
        out.push(ch);
    }
    return out;
}

/// Registers the round-trip and adversarial escaping tests (sidecar, lint-exempt).
#[cfg(test)]
#[path = "escape_tests.rs"]
mod escape_tests;
