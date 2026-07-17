//! Parses the two-form rule-file format into engine-ready patterns.
//!
//! A rule file is a sequence of lines. A blank line or a `#`-comment line is
//! ignored. A `/PATTERN/FLAGS` line whose trailing run is all ASCII-lowercase is
//! a regex rule passed to the engine strict, with `m`/`x` accepted as no-ops
//! (the engine is always multiline and verbose) and any other flag letter a hard
//! fail-closed load error. Every other non-blank line is a bare literal escaped
//! into the verbose dialect. A leading UTF-8 BOM is stripped once up front.

/// Imports the literal-to-dialect escaper for bare literal lines.
use super::escape::escape_literal;

/// Imports the redacted load-error type reported on a bad flag or empty source.
use super::error::LoadError;

/// The classification of one rule-file line.
enum LineClass {
    /// A blank or comment line, contributing no rule.
    Skip,
    /// A bare literal line, carrying its trimmed text for escaping.
    Literal(
        /// Trimmed literal text, escaped into the verbose dialect by the caller.
        String,
    ),
    /// A `/PATTERN/FLAGS` regex line, split into its pattern and flag run.
    Regex {
        /// Pattern body between the delimiting slashes, passed to the engine.
        body: String,
        /// Trailing flag run (all ASCII-lowercase), validated against the policy.
        flags: String,
    },
}

/// The UTF-8 byte-order-mark code point, stripped from the start of a source.
const BOM: char = '\u{FEFF}';

/// Strips a leading UTF-8 BOM, returning the remaining source unchanged.
fn strip_bom(text: &str) -> &str {
    return text.strip_prefix(BOM).unwrap_or(text);
}

/// Classifies one line as a skip, a literal, or a regex with its flag run.
///
/// Mirrors the scanner's existing classifier: a line is a regex only when it
/// starts with `/`, has a later closing `/`, and the trailing run is entirely
/// ASCII-lowercase (an empty run counts). Any other shape, including a slashed
/// line whose trailing run is not all-lowercase, is a literal.
fn classify_line(line: &str) -> LineClass {
    let trimmed = line.trim();
    if trimmed.is_empty() || trimmed.starts_with('#') {
        return LineClass::Skip;
    }
    let bytes = trimmed.as_bytes();
    // A regex rule needs at least the two delimiting slashes and a closing slash
    // past the opening one.
    if bytes.len() >= 2
        && bytes[0] == b'/'
        && let Some(last) = trimmed.rfind('/')
        && last > 0
    {
        let body = &trimmed[1..last];
        let flags = &trimmed[last + 1..];
        // Only an all-lowercase trailing run is a flags slot; otherwise the line
        // is a literal that merely happens to contain slashes.
        if flags.chars().all(|c| return c.is_ascii_lowercase()) {
            return LineClass::Regex {
                body: body.to_string(),
                flags: flags.to_string(),
            };
        }
    }
    return LineClass::Literal(trimmed.to_string());
}

/// Reports the first flag letter outside the `{m, x}` no-op set, if any.
///
/// `m` (multiline) and `x` (verbose) are always on in the engine, so they are
/// dropped as no-ops. Any other letter would change match semantics if silently
/// dropped (an `i` or `s`), so the caller fails the load closed on it.
fn first_bad_flag(flags: &str) -> Option<char> {
    return flags.chars().find(|&c| return c != 'm' && c != 'x');
}

/// Parses a rule source into the engine-ready pattern list.
///
/// Strips a leading BOM, classifies each line, escapes literals into the verbose
/// dialect, drops `m`/`x` flags, and fails closed with a redacted, index-bearing
/// error on any other flag. Returns `NoRules` when no rule line survives. The
/// index in an error is the rule's 0-based position among the kept rules, which
/// is the opaque index the load path reports.
pub(super) fn parse_patterns(text: &str) -> Result<Vec<String>, LoadError> {
    let mut patterns: Vec<String> = Vec::new();
    for line in strip_bom(text).lines() {
        // Route each line by its class; the pushed index equals the current rule
        // count, so a bad flag reports the offending rule's opaque index.
        match classify_line(line) {
            LineClass::Skip => {}
            LineClass::Literal(literal) => patterns.push(escape_literal(&literal)),
            LineClass::Regex { body, flags } => {
                if let Some(flag) = first_bad_flag(&flags) {
                    return Err(LoadError::UnsupportedFlag {
                        index: patterns.len(),
                        flag,
                    });
                }
                patterns.push(body);
            }
        }
    }
    if patterns.is_empty() {
        return Err(LoadError::NoRules);
    }
    return Ok(patterns);
}

/// Registers the format, flags-policy, and BOM-strip tests (sidecar, lint-exempt).
#[cfg(test)]
#[path = "format_tests.rs"]
mod format_tests;
