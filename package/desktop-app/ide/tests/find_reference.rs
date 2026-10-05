//! Measure the existing Helix regex engine against captured browser literal-find results before selecting a matcher.

/// The already adopted Helix crate reexports its actual regex dependency.
use helix_core::regex::{RegexBuilder, escape};
/// Typed fixture decoding keeps source strings and expected offsets separate from executable patterns.
use serde::Deserialize;

/// What: Serde derives a JSON decoder for this owned record; String owns text rather than borrowing &str.
/// Why: The parsed corpus outlives the temporary parser call and records the exact tested browser build.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Corpus = { browserVersion: string; cases: Case[] };
/// ```
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Corpus {
    /// Full build read from the disposable browser profile, not the reduced user agent.
    browser_version: String,
    /// Measured cases are finite, synthetic, and independent of project files.
    cases: Vec<Case>,
}

/// Browser offsets count UTF-16 units while Rust regex offsets count UTF-8 bytes.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Case {
    /// Stable case name identifies a semantic difference without relying on display ordering.
    name: String,
    /// Synthetic source remains unchanged by the matcher.
    text: String,
    /// Literal query must be escaped before crossing into regex syntax.
    query: String,
    /// False denotes no match, not an empty selected range.
    found: bool,
    /// Original source substring selected by the browser.
    selected: String,
    /// Inclusive browser boundary in UTF-16 units.
    start_utf16: usize,
    /// Exclusive browser boundary in UTF-16 units.
    end_utf16: usize,
}

/// Compare the incumbent without pretending simple Unicode case folding implements collation search.
#[test]
fn report_incumbent_literal_find_against_browser_reference() {
    let corpus: Corpus = serde_json::from_str(include_str!("fixture/browser-find.json")).expect("captured browser corpus");
    let mut differences = Vec::new();
    let mut seen_positive = false;
    let mut seen_negative = false;
    for case in corpus.cases {
        // What: escape makes every query character literal; the builder only changes case sensitivity.
        // Why: Regex punctuation in user input must not accidentally broaden this literal-find comparison.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const matcher = compileEscapedLiteral(case.query, { ignoreCase: true });
        // ```
        let mut builder = RegexBuilder::new(&escape(&case.query));
        builder.case_insensitive(true);
        let matcher = builder.build().expect("escaped literal compiles");
        let matched = if case.query.is_empty() { None } else { matcher.find(&case.text) };
        let selected = matched.map(|result| return result.as_str()).unwrap_or("");
        let start = matched.map(|result| return case.text[..result.start()].encode_utf16().count()).unwrap_or(0);
        let end = matched.map(|result| return case.text[..result.end()].encode_utf16().count()).unwrap_or(0);
        let agrees = matched.is_some() == case.found && selected == case.selected && start == case.start_utf16 && end == case.end_utf16;
        if !agrees { differences.push(case.name.clone()); }
        if case.name == "positive-literal" { assert!(matched.is_some() && agrees); seen_positive = true; }
        if case.name == "negative-literal" { assert!(matched.is_none() && agrees); seen_negative = true; }
        // Exact machine-readable terminal output is an inspection artifact, not application logging.
        println!("{}", serde_json::json!({ "case": case.name, "agrees": agrees, "browserFound": case.found, "regexFound": matched.is_some(), "regexSelected": selected, "regexStartUtf16": start, "regexEndUtf16": end }));
    }
    assert!(seen_positive && seen_negative, "the corpus must exercise both match outcomes");
    println!("{}", serde_json::json!({ "browserVersion": corpus.browser_version, "differentCases": differences }));
}
