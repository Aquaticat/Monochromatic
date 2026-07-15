// What:     Regression tests for resharp set-algebra-aware extraction.
// Why:      `forbidden-strings` uses extracted substrings as an
//           Aho-Corasick gate before running full regexes. Algebra
//           complement bodies are excluded languages, not required
//           bytes, so extracting from `~(...)` silently disables real
//           matches when only placeholders contain the gate.
//
// In TS you'd write (pseudocode):
// ```ts
// describe("algebra extraction", () => { /* extractor tests */ });
// ```

// What:     Import the literal walker under test.
// Why:      Algebra operators must stop literal accumulation before
//           branch extraction can skip or traverse them correctly.
//
// In TS you'd write (pseudocode):
// ```ts
// import { walkLiteralBytes } from "./atom";
// ```
use super::atom::walk_literal_bytes;

// What:     Import the public extraction wrapper.
// Why:      These tests pin the externally used gate set, not only
//           the lower-level walker details.
//
// In TS you'd write (pseudocode):
// ```ts
// import { extractGatingSubstrings } from "./extract";
// ```
use super::extract::extract_gating_substrings;

// What:     Import Aho-Corasick for round-trip gate checks.
// Why:      The production scanner feeds extracted gates into this
//           matcher, so the extracted bytes must find matching input.
//
// In TS you'd write (pseudocode):
// ```ts
// import AhoCorasick from "aho-corasick";
// ```
use aho_corasick::AhoCorasick;

// What:     Helper that runs the literal walker and returns owned
//           strings for easy assertions.
// Why:      The walker writes into out-parameters; tests read better
//           when the plumbing is centralised.
//
// In TS you'd write (pseudocode):
// ```ts
// function walk(input) { return walkLiteralBytes(input); }
// ```
fn walk(input: &'static str) -> (String, String) {
    let mut out = String::new();
    let mut remainder = input;
    walk_literal_bytes(input, &mut out, &mut remainder);
    (out, remainder.to_string())
}

// What:     Helper that unwraps extraction output for patterns that
//           must have sound gates.
// Why:      Keeps each regression test focused on expected gate bytes.
//
// In TS you'd write (pseudocode):
// ```ts
// function extract(pattern) { return extractGatingSubstrings(pattern)!; }
// ```
fn extract(pattern: &str) -> Vec<(String, bool)> {
    extract_gating_substrings(pattern).expect("expected extractable gate set")
}

#[test]
fn walker_stops_before_intersection_operator() {
    let (out, remainder) = walk("foo&bar");
    assert_eq!(out.as_bytes(), b"foo");
    assert_eq!(remainder.as_bytes(), b"&bar");
}

#[test]
fn walker_stops_before_complement_operator() {
    let (out, remainder) = walk("foo~(bar)");
    assert_eq!(out.as_bytes(), b"foo");
    assert_eq!(remainder.as_bytes(), b"~(bar)");
}

#[test]
fn escaped_underscore_algebra_uses_positive_operand_gate() {
    let subs = extract(r"ghp\_[0-9a-zA-Z]{36}&~(ghp\_0{36})");
    assert_eq!(subs.len(), 1);
    assert_eq!(subs[0].0.as_bytes(), b"ghp_");
    assert!(!subs[0].1, "GitHub PAT rule is case-sensitive");
}

#[test]
fn complement_only_pattern_has_no_required_gate() {
    let result = extract_gating_substrings(r"~(ghp\_0{36})");
    assert!(result.is_none(), "pure complement must fall back to residual scanning");
}

#[test]
fn build_placeholder_complement_does_not_supply_gate() {
    // What:     `BUILD_[0-9]{6}&~(BUILD_000000)` -- the bare `_` in
    //           `BUILD_` is a resharp universal wildcard, not a
    //           literal underscore. Pre-fix the walker greedily
    //           consumed `_` as a literal byte and registered the
    //           AC gate as `BUILD_`. Post-fix the walker stops at
    //           the wildcard and registers `BUILD` (5 bytes, the
    //           literal prefix guaranteed to appear in every match)
    //           as the gate. The point of THIS test is that the
    //           complement body `~(BUILD_000000)` contributes no
    //           gating substring -- and that contract still holds.
    // Why:      Closes the AC-gate-soundness arm of BUG 10. The
    //           pre-fix gate `BUILD_` failed to fire on legitimate
    //           matches when `BUILD` is followed by a non-underscore
    //           byte because AC searched for the
    //           literal `_` while the rule matched a wildcard.
    let subs = extract(r"BUILD_[0-9]{6}&~(BUILD_000000)");
    assert_eq!(subs.len(), 1);
    assert_eq!(
        subs[0].0.as_bytes(),
        b"BUILD",
        "BUG 10: bare `_` is resharp wildcard; gate excludes it"
    );
}

#[test]
fn aws_placeholder_complement_keeps_positive_key_prefixes() {
    let subs = extract(
        r"\b((?:A3T[A-Z0-9]|AKIA|ASIA|ABIA|ACCA)[A-Z2-7]{16})\b&~(AKIA2{16})",
    );
    let gates: Vec<&str> = subs.iter().map(|(sub, _)| sub.as_str()).collect();
    assert_eq!(gates, vec!["A3T", "AKIA", "ASIA", "ABIA", "ACCA"]);
}

#[test]
fn escaped_underscore_gate_round_trips_through_aho_corasick() {
    let subs = extract(r"ghp\_[0-9a-zA-Z]{36}&~(ghp\_0{36})");
    let patterns: Vec<&str> = subs.iter().map(|(sub, _)| sub.as_str()).collect();
    let ac = AhoCorasick::new(&patterns).expect("AC build should succeed");
    let content = format!("prefix ghp_{} suffix", "A".repeat(36));
    let matches: Vec<_> = ac.find_iter(content.as_bytes()).collect();
    assert!(!matches.is_empty(), "gate should fire on real-shaped GitHub PAT");
}
