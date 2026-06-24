//! Loads the real forbidden-strings ruleset and ports each rule for both engines.
//!
//! What: embeds the committed example ruleset and the shared appendix, extracts the
//! `/PATTERN/FLAGS` regex rules, and ports each into an `(ours, bare)` pair. Why: a
//! realistic benchmark must run the credential shapes the scanner actually ships,
//! not toy patterns.

/// Imports the per-rule porter.
use crate::port::port;

/// The committed betterleaks port plus set-algebra demonstrations.
const EXAMPLE: &str = include_str!("../../../../forbidden-strings.local.example.txt");

/// The shared appendix of shortcode-label rules.
const APPEND: &str = include_str!("../../../../forbidden-strings.append.txt");

/// Loads every regex rule, ported into `(ours, bare)` pairs.
///
/// What: walks both rule files, keeps the `/.../` regex lines, and ports each. Why:
/// the caller compile-filters these to the subset both engines accept.
pub fn load_rules() -> Vec<(String, String)> {
    let mut pairs = Vec::new();
    for source in [EXAMPLE, APPEND] {
        for line in source.lines() {
            let trimmed = line.trim();
            if let Some(inner) = extract_pattern(trimmed) {
                pairs.push(port(inner));
            }
        }
    }
    pairs
}

/// Extracts the pattern body of a `/PATTERN/FLAGS` rule line.
///
/// What: returns the text between the opening `/` and the first unescaped `/` that
/// is not inside a class; `None` for non-regex lines. Why: rule bodies contain `/`
/// inside classes and as `\/`, so the closing delimiter must be found carefully.
fn extract_pattern(line: &str) -> Option<&str> {
    let b = line.as_bytes();
    if b.first() != Some(&b'/') {
        return None;
    }
    let mut i = 1;
    let mut in_class = false;
    while i < b.len() {
        let c = b[i];
        if c == b'\\' {
            i += 2;
            continue;
        }
        if in_class {
            if c == b']' {
                in_class = false;
            }
            i += 1;
            continue;
        }
        match c {
            b'[' => in_class = true,
            b'/' => return Some(&line[1..i]),
            _ => {}
        }
        i += 1;
    }
    None
}
