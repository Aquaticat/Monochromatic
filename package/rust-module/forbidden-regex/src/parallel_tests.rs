// What:  unit tests for the threaded rule builder.
// Why:     This file groups the parallel test cases so behavior changes fail near the code path
//          they protect.
//
// In TS you'd write (pseudocode):
// ```ts
// describe("parallel", () => {
//   // test cases below
// });
// ```

use super::{RuleOutcome, build_rules_with};
use crate::RegexSet;

// What:    Valid and invalid patterns interleaved, with two distinct failure kinds.
// Why:     Ordering and error-selection tests need several failures whose messages differ.
//
// In TS you'd write (pseudocode):
// ```ts
// function mixed_patterns(): string[] {
//   // Rust body below is the implementation.
// }
// ```
fn mixed_patterns() -> Vec<&'static str> {
    return vec![
        "abcdef[0-9]{4}",
        "ghijkl[a-z]{3}",
        "(?:unclosed",
        "mnopqr[A-Z]{2}",
        "star*",
        "stuvwx[0-9]{5}",
        "(?:another",
        "yzabcd[a-f]{6}",
    ]
}

// What:    The input indices of a sorted outcome list.
// Why:     Several tests compare which rules came back, not the built rules themselves.
//
// In TS you'd write (pseudocode):
// ```ts
// function indices(outcomes: RuleOutcome[]): number[] {
//   return outcomes.map(([index]) => index);
// }
// ```
fn indices(outcomes: &[RuleOutcome]) -> Vec<usize> {
    return outcomes.iter().map(|outcome| return outcome.0).collect()
}

// What:    Each outcome's index with its error text, or `None` for a built rule.
// Why:     `BuiltRule` has no equality, so paths are compared through this projection.
//
// In TS you'd write (pseudocode):
// ```ts
// function summary(outcomes: RuleOutcome[]): [number, string | null][] { ... }
// ```
fn summary(outcomes: &[RuleOutcome]) -> Vec<(usize, Option<String>)> {
    return outcomes
        .iter()
        .map(|(index, result)| return (*index, result.as_ref().err().map(|error| return error.to_string())))
        .collect()
}

#[test]
fn threaded_outcomes_come_back_in_input_order() {
    let owned: Vec<String> = (0..24).map(|n| return format!("rule{n:02}abc[0-9]{{3}}")).collect();
    let patterns: Vec<&str> = owned.iter().map(|pattern| return pattern.as_str()).collect();
    let outcomes = build_rules_with(&patterns, false, 4);
    assert_eq!(indices(&outcomes), (0..24).collect::<Vec<usize>>());
    assert!(outcomes.iter().all(|outcome| return outcome.1.is_ok()));
}

#[test]
fn lenient_threaded_matches_inline() {
    let patterns = mixed_patterns();
    let inline = build_rules_with(&patterns, false, 1);
    let threaded = build_rules_with(&patterns, false, 4);
    // What:    every rule is attempted, failures included.
    // Why:     `compile_lenient` keeps each rule that builds, so none may be skipped.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // expect(threaded.length).toBe(patterns.length);
    // ```
    assert_eq!(threaded.len(), patterns.len());
    assert_eq!(summary(&threaded), summary(&inline));
}

#[test]
fn strict_threaded_reports_the_lowest_index_failure() {
    let patterns = mixed_patterns();
    let unclosed = build_rules_with(&["(?:unclosed"], true, 1);
    let star = build_rules_with(&["star*"], true, 1);
    // What:    the two failure kinds render differently.
    // Why:     Positive control: otherwise picking the wrong failure would go unnoticed.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // expect(summary(unclosed)[0][1]).not.toBe(summary(star)[0][1]);
    // ```
    assert_ne!(summary(&unclosed)[0].1, summary(&star)[0].1);
    for _ in 0..16 {
        let outcomes = build_rules_with(&patterns, true, 4);
        let first_failure = outcomes
            .iter()
            .find(|outcome| return outcome.1.is_err())
            .map(|outcome| return (outcome.0, outcome.1.as_ref().err().map(|error| return error.to_string())));
        assert_eq!(first_failure, Some((2, summary(&unclosed)[0].1.clone())));
        assert_eq!(&indices(&outcomes)[..3], &[0, 1, 2]);
    }
}

#[test]
fn workers_build_deeply_nested_groups() {
    // What:    ten thousand nested groups overflow a default 2 MiB thread stack (measured:
    //          three thousand already abort there) but fit the workers' reserved stack.
    // Why:     Pins the explicit worker stack size; spawning with the default would abort
    //          this test process.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const deep = "(?:".repeat(10_000) + "abcdef" + ")".repeat(10_000);
    // ```
    let deep = format!("{}abcdef{}", "(?:".repeat(10_000), ")".repeat(10_000));
    let patterns = [deep.as_str(), deep.as_str()];
    let outcomes = build_rules_with(&patterns, true, 2);
    assert_eq!(indices(&outcomes), vec![0, 1]);
    assert!(outcomes.iter().all(|outcome| return outcome.1.is_ok()));
}

#[test]
fn regex_set_new_reports_the_first_failing_rule() {
    let expected = RegexSet::new(&["(?:unclosed"]).err().map(|error| return error.to_string());
    let actual = RegexSet::new(&mixed_patterns()).err().map(|error| return error.to_string());
    assert!(expected.is_some());
    assert_eq!(actual, expected);
}

#[test]
fn compile_lenient_keeps_every_rule_that_builds() {
    let (set, kept) = RegexSet::compile_lenient(&mixed_patterns());
    assert_eq!(kept, vec![0, 1, 3, 5, 7]);
    assert_eq!(set.len(), kept.len());
    assert!(set.is_match(b"xx mnopqrAB xx"));
    assert!(!set.is_match(b"xx star xx"));
}
