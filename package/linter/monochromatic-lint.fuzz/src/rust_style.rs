//! What: Structured and malformed-source invariants for the anonymous-function rule.
//! Why: A raw-only fuzzer can spend its entire budget in invalid syntax without reaching real closures.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // Every draw exercises a known closure count plus arbitrary source and diagnostic bounds.
//! ```

/// Import the production rule and owned source/finding models, not a second implementation.
use monochromatic_lint::diagnostic::{Diagnostic, Severity, Span};
/// Import the actual checker used by the linter.
use monochromatic_lint::rust_no_anonymous_functions::check_no_anonymous_functions;
/// Import the parser-owning input shared by all Rust rules.
use monochromatic_lint::rust_source::RustSource;

/// What: Grammar fragments paired with independently known closure counts.
/// Why: Negative pipe/string/async-block controls keep lexical approximations from passing.
/// &[...] borrows this fixed data; a Vec would allocate, and a fixed array type would repeat its length.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const cases: readonly [string, number][] = [...];
/// ```
const CASES: &[(&str, usize)] = &[
    ("let callback = || {};\n", 1),
    ("let callback = move || {};\n", 1),
    ("let callback = async move || {};\n", 1),
    ("call(|value: u16| -> u16 { return value; });\n", 1),
    ("call(|| || 1);\n", 2),
    ("call(named);\n", 0),
    (
        "let bits: u16 = 1 | 2; let flag: bool = true || false;\n",
        0,
    ),
    ("let future = async { return 1; };\n", 0),
    ("let text: &str = \"move || {}\"; /* |x| x */\n", 0),
];

/// Build at most 64 grammar fragments while retaining the expected closure count.
pub fn generated_source(data: &[u8]) -> (String, usize) {
    // String owns growable text; &str would only borrow it. usize matches byte and collection indexes.
    let mut source: String =
        String::from("fn named(value: u16) -> u16 { return value; }\nfn main() {\n");
    let mut expected: usize = 0;
    for byte in data.iter().take(64) {
        // Copy the borrowed byte's value and convert it to the platform-sized case index.
        let index: usize = usize::from(*byte) % CASES.len();
        let (fragment, added): (&str, usize) = CASES[index];
        source.push_str(fragment);
        expected += added;
    }
    source.push_str("}\n");
    return (source, expected);
}

/// What: Check the real findings and their byte ranges without duplicating closure recognition.
/// Why: Malformed input may recover partially, but it must not produce invalid spans or unsafe fixes.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function checkSource(source: string): number;
/// ```
fn check_source(source: &str) -> usize {
    // Own the input while lending it read-only to the rule.
    let context: RustSource = RustSource::new(String::from("fuzz.rs"), String::from(source));
    let findings: Vec<Diagnostic> = check_no_anonymous_functions(&context, Severity::Error);
    for finding in &findings {
        assert_eq!(finding.code, "rust/no-anonymous-functions");
        assert_eq!(finding.filename, "fuzz.rs");
        assert_eq!(finding.severity, Severity::Error);
        assert!(finding.fix.is_none());
        assert_eq!(finding.labels.len(), 1);
        // Borrow the label; ownership remains with the finding.
        let span: &Span = &finding.labels[0].span;
        assert!(span.offset <= source.len());
        assert!(span.length <= source.len() - span.offset);
        assert!(source.is_char_boundary(span.offset));
        assert!(source.is_char_boundary(span.offset + span.length));
        assert!(span.line >= 1);
        assert!(span.column >= 1);
    }
    return findings.len();
}

/// Exercise generated syntax on every draw, including non-UTF-8 byte inputs.
pub fn check_rust_style(data: &[u8]) {
    let (source, expected): (String, usize) = generated_source(data);
    // Borrow the generated String as a string slice for the real parser.
    assert_eq!(check_source(source.as_str()), expected);
    // What: UTF-8 decoding returns Ok(text) or Err(details), rather than throwing.
    // Why: Only valid UTF-8 is a Rust source string; every rejected byte draw still ran generated syntax.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const text = decodeUtf8Strict(data); if (text !== undefined) checkSource(text);
    // ```
    if let Ok(raw) = std::str::from_utf8(data) {
        check_source(raw);
    }
}

/// Verify each generator branch and both empty/invalid-byte inputs before fuzzing starts.
#[test]
fn every_rust_style_generator_branch_has_a_positive_or_negative_control() {
    // Each position independently states whether its grammar fragment contains closures.
    let expected: [usize; 9] = [1, 1, 1, 1, 2, 0, 0, 0, 0];
    for (index, expected_count) in expected.iter().enumerate() {
        // The bounded case index fits in a byte by construction.
        let bytes: [u8; 1] = [index as u8];
        let (source, count): (String, usize) = generated_source(&bytes);
        // Read the borrowed count without taking ownership of the array slot.
        assert_eq!(count, *expected_count);
        assert_eq!(check_source(source.as_str()), count);
    }
    check_rust_style(&[]);
    check_rust_style(&[255, 254, 253]);
    // Borrow a byte literal containing Unicode before a real closure.
    check_rust_style("fn main() { /* 🚀 */ let f = || {}; }".as_bytes());
}
