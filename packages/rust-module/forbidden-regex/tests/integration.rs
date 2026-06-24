//! End-to-end tests exercising the public API across the compilation boundary.

use forbidden_regex::{CompileError, RegexSet, compile};

/// A valid 20-byte AWS-style key: `AKIA` plus 16 bytes from `[A-Z2-7]`.
const AKIA_KEY: &str = "AKIAABCDEFGHIJKLMNOP";

#[test]
fn literal_and_search() {
    let re = compile("AKIA[A-Z2-7]{16}").unwrap();
    assert!(re.is_match(b"key=AKIAABCDEFGHIJKLMNOP;"));
    assert!(!re.is_match(b"no key here"));
    // Wrong alphabet: '0' and '1' are not in [A-Z2-7].
    assert!(!re.is_match(b"AKIA0123456789ABCDEF"));
}

#[test]
fn anchors_and_word_boundary() {
    let start = compile("^abc").unwrap();
    assert!(start.is_match(b"abcdef"));
    assert!(!start.is_match(b"xabcdef"));

    let end = compile("abc$").unwrap();
    assert!(end.is_match(b"xxabc"));
    assert!(!end.is_match(b"abcd"));

    let word = compile("\\bcat\\b").unwrap();
    assert!(word.is_match(b"a cat sat"));
    assert!(!word.is_match(b"category"));
}

#[test]
fn classes_and_shorthands() {
    let re = compile("[a-z]\\d[^0-9]").unwrap();
    assert!(re.is_match(b"x5!"));
    assert!(!re.is_match(b"x55"));
    let neg = compile("a[^bc]d").unwrap();
    assert!(neg.is_match(b"axd"));
    assert!(!neg.is_match(b"abd"));
}

#[test]
fn repetition_bounds() {
    let re = compile("a{2,4}").unwrap();
    assert!(!re.is_match(b"bab"));
    assert!(re.is_match(b"baab"));
    assert!(re.is_match(b"aaaa"));
    let exact = compile("x{3}").unwrap();
    assert!(exact.is_match(b"xxx"));
    assert!(!exact.is_match(b"yxxy"));
}

#[test]
fn unsupported_constructs_rejected() {
    assert!(matches!(compile("a*"), Err(CompileError::Syntax { .. })));
    assert!(matches!(compile("a+"), Err(CompileError::Syntax { .. })));
    assert!(matches!(compile("a{2,}"), Err(CompileError::Syntax { .. })));
    assert!(matches!(compile("(abc)"), Err(CompileError::Syntax { .. })));
    assert!(matches!(compile("\\x41"), Err(CompileError::Syntax { .. })));
    // Multi-atom operand of '&' must be wrapped.
    assert!(matches!(compile("ab&cd"), Err(CompileError::Syntax { .. })));
}

#[test]
fn alternation_intersection_complement() {
    // Operands must be single atoms, so multi-letter branches are wrapped.
    let alt = compile("(?:(?:cat)|(?:dog))").unwrap();
    assert!(alt.is_match(b"a dog"));
    assert!(!alt.is_match(b"a bird"));
    // The unwrapped form is rejected by the grammar.
    assert!(matches!(compile("(?:cat|dog)"), Err(CompileError::Syntax { .. })));

    // The canonical set-algebra case, wrapped to the single-atom-operand grammar:
    // an AWS-style key, excluding the documented all-2s placeholder.
    let aws = compile(
        "(?:\\b(?:(?:A3T[A-Z0-9])|(?:AKIA)|(?:ASIA))[A-Z2-7]{16}\\b)&~(AKIA2{16})",
    )
    .unwrap();
    assert!(aws.is_match(AKIA_KEY.as_bytes()));
    assert!(aws.is_match(format!("prefix {AKIA_KEY} suffix").as_bytes()));
    assert!(!aws.is_match(b"AKIA2222222222222222"));
}

#[test]
fn empty_matchable_rejected() {
    assert!(matches!(compile("a?"), Err(CompileError::EmptyMatchable)));
    assert!(matches!(compile("~(abc)"), Err(CompileError::EmptyMatchable)));
}

#[test]
fn regexset_matches_and_roundtrip() {
    let set = RegexSet::new(&["AKIA[A-Z2-7]{16}", "ghp_[A-Za-z0-9]{36}"]).unwrap();
    let ghp = format!("token ghp_{} end", "a".repeat(36));
    assert!(set.is_match(format!("... {AKIA_KEY} ...").as_bytes()));
    let hits: Vec<usize> = set.matches(ghp.as_bytes()).collect();
    assert_eq!(hits, vec![1]);

    let bytes = set.to_bytes().unwrap();
    let reloaded = RegexSet::from_bytes(&bytes).unwrap();
    assert!(reloaded.is_match(format!("x {AKIA_KEY} x").as_bytes()));
    assert!(!reloaded.is_match(b"nothing to see"));
}

#[test]
fn product_rule_survives_roundtrip() {
    // A set-algebra rule uses the product engine; serializing and reloading must
    // run its decode validation and still decide keys exactly.
    let set = RegexSet::new(&[
        "(?:\\b(?:(?:A3T[A-Z0-9])|(?:AKIA)|(?:ASIA))[A-Z2-7]{16}\\b)&~(AKIA2{16})",
        "ghp_[A-Za-z0-9]{36}",
    ])
    .unwrap();
    let bytes = set.to_bytes().unwrap();
    let reloaded = RegexSet::from_bytes(&bytes).unwrap();
    assert!(reloaded.is_match(format!("key {AKIA_KEY} end").as_bytes()));
    // The all-2s placeholder is vetoed by the complement, even after a round-trip.
    assert!(!reloaded.is_match(b"AKIA2222222222222222"));
    let hits: Vec<usize> = reloaded.matches(AKIA_KEY.as_bytes()).collect();
    assert_eq!(hits, vec![0]);
}

#[test]
fn from_ruleset_splits_on_delimiter() {
    let text = "AKIA[A-Z2-7]{16}\n---\nghp_[A-Za-z0-9]{36}\n";
    let set = RegexSet::from_ruleset(text, "---").unwrap();
    assert_eq!(set.len(), 2);
    assert!(set.is_match(AKIA_KEY.as_bytes()));
}
