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

// A serialized RegexSet whose parallel vectors disagree (a `seedless_id` past an empty
// `rules`). libFuzzer minimized this from `fuzz_from_bytes`; before `validate_structure`
// it panicked with an out-of-bounds index at match time. Now `from_bytes` must REJECT it
// (return Err), never panic, because the decoded bytes are attacker-influenced. Embedded
// inline (not a `.bin` fixture, which the root .gitignore excludes).
const STRUCTURAL_CRASH: &[u8] = &[
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0,
];

#[test]
fn from_bytes_rejects_inconsistent_structure() {
    assert!(RegexSet::from_bytes(STRUCTURAL_CRASH).is_err());
}

#[test]
fn from_bytes_rejects_garbage_without_panic() {
    // Empty, truncated, and arbitrary bytes must all decode-fail cleanly, never panic.
    assert!(RegexSet::from_bytes(b"").is_err());
    assert!(forbidden_regex::Regex::from_bytes(b"").is_err());
    assert!(RegexSet::from_bytes(b"not a serialized matcher").is_err());
    for len in 0..STRUCTURAL_CRASH.len() {
        // Truncations of the crash input must also reject, not panic.
        let _ = RegexSet::from_bytes(&STRUCTURAL_CRASH[..len]);
    }
}

#[test]
fn line_start_marker_rule_matches_only_at_line_start() {
    // A `^`-anchored marker (short codes) routes to the line-start check, not the gate.
    let set = RegexSet::new(&["^(?:(?:PR)|(?:TS))[0-9]:"]).unwrap();
    assert!(set.is_match(b"PR5: a note"));
    assert!(set.is_match(b"TS0:"));
    assert!(!set.is_match(b"xPR5:")); // not at line start
    assert!(!set.is_match(b"PR: no digit"));
    assert!(!set.is_match(b"nothing"));
    let hits: Vec<usize> = set.matches(b"PR5:").collect();
    assert_eq!(hits, vec![0]);
}

#[test]
fn input_is_one_line_so_caret_is_position_zero() {
    // Contract: the matcher is called with ONE content line per call, so `^` means
    // position zero. A marker only at the start of the (single-line) input matches.
    let set = RegexSet::new(&["^(?:(?:PR)|(?:TS))[0-9]:"]).unwrap();
    assert!(set.is_match(b"PR9: at the start"));
    // Mid-input occurrence (no real line break in one-line input) does not match.
    assert!(!set.is_match(b"prefix PR9: not at start"));
}

#[test]
fn weak_inner_seed_rule_matches_on_its_short_literal() {
    // The only required literal is the 2-byte "Q~", below the default seed floor; the
    // fold gates on it (weak inner seed) and runs the full engine on a hit.
    let set = RegexSet::new(&["[a-z]{3}Q\\~[a-z]{3}"]).unwrap();
    assert!(set.is_match(b"junk abcQ~def junk"));
    assert!(!set.is_match(b"abcXdef"));
    assert!(!set.is_match(b"no marker here"));
}

#[test]
fn mixed_ruleset_routes_each_rule_correctly() {
    // A line-start marker, a leading-literal rule, and a weak-inner-seed rule together.
    let set = RegexSet::new(&[
        "^(?:(?:PR)|(?:TS))[0-9]:",
        "AKIA[A-Z2-7]{16}",
        "[a-z]{3}Q\\~[a-z]{3}",
    ])
    .unwrap();
    assert_eq!(set.len(), 3);
    assert_eq!(set.matches(b"PR1:").collect::<Vec<_>>(), vec![0]);
    assert_eq!(set.matches(AKIA_KEY.as_bytes()).collect::<Vec<_>>(), vec![1]);
    assert_eq!(set.matches(b"abcQ~def").collect::<Vec<_>>(), vec![2]);
    assert!(!set.is_match(b"unrelated content"));
}

#[test]
fn dialect_constructs_have_their_semantics() {
    // `.` is any byte except newline.
    let dot = compile(".").unwrap();
    assert!(dot.is_match(b"x"));
    assert!(dot.is_match(b"\t"));
    assert!(!dot.is_match(b"\n"));
    assert!(!dot.is_match(b""));

    // `{n}` is an exact count, not a literal brace.
    let three = compile("a{3}").unwrap();
    assert!(three.is_match(b"aaa"));
    assert!(three.is_match(b"aaaa")); // contains a 3-run
    assert!(!three.is_match(b"aa"));
    assert!(!three.is_match(b"a{3}"));

    // `{n,m}` is a bounded range.
    let range = compile("xa{2,3}").unwrap();
    assert!(range.is_match(b"xaa"));
    assert!(range.is_match(b"xaaa"));
    assert!(!range.is_match(b"xa"));

    // `?` is zero-or-one of the preceding atom.
    let opt = compile("xa?b").unwrap();
    assert!(opt.is_match(b"xb"));
    assert!(opt.is_match(b"xab"));
    assert!(!opt.is_match(b"xaab"));
}

#[test]
fn single_regex_round_trips_through_bytes() {
    let regex = compile("AKIA[A-Z2-7]{16}").unwrap();
    let bytes = regex.to_bytes().unwrap();
    assert!(!bytes.is_empty());
    let reloaded = forbidden_regex::Regex::from_bytes(&bytes).unwrap();
    assert_eq!(regex.is_match(AKIA_KEY.as_bytes()), reloaded.is_match(AKIA_KEY.as_bytes()));
    assert!(reloaded.is_match(AKIA_KEY.as_bytes()));
    assert!(!reloaded.is_match(b"not a key"));
}

#[test]
fn diagnostic_accessors_report_structure() {
    // Two leading-literal rules: both gated and anchored, none seedless.
    let anchored = RegexSet::new(&["AKIA[A-Z2-7]{16}", "ghp_[A-Za-z0-9]{36}"]).unwrap();
    assert_eq!(anchored.len(), 2);
    assert!(!anchored.is_empty());
    assert_eq!(anchored.anchored_count(), 2);
    assert_eq!(anchored.seedless_count(), 0);
    assert_eq!(anchored.line_start_count(), 0);
    assert_eq!(anchored.seedless_group_count(), 0);
    assert_eq!(anchored.seedless_union_size(), 0);

    // Two class-only rules: no seed, no leading literal, so truly seedless and grouped.
    let seedless = RegexSet::new(&["[a-z]{20}", "[0-9]{18}"]).unwrap();
    assert_eq!(seedless.seedless_count(), 2);
    assert!(seedless.seedless_group_count() >= 1);
    assert!(seedless.seedless_union_size() >= 2);

    // One line-start marker rule.
    let marker = RegexSet::new(&["^(?:(?:PR)|(?:TS))[0-9]:"]).unwrap();
    assert_eq!(marker.line_start_count(), 1);

    assert!(RegexSet::new::<&str>(&[]).unwrap().is_empty());
}

#[test]
fn profiling_hooks_track_their_components() {
    let set = RegexSet::new(&["AKIA[A-Z2-7]{16}", "[a-z]{20}"]).unwrap();
    let key = AKIA_KEY.as_bytes();
    let twenty = b"abcdefghijklmnopqrst";

    // Gate / prefilter / candidate hooks see the seeded AKIA rule, not a bare line.
    assert!(set.gate_only_is_match(key));
    assert!(!set.gate_only_is_match(b"nothing seeded here"));
    assert!(set.prefilter_only_is_match(key));
    assert!(!set.prefilter_only_is_match(b"nothing seeded here"));
    // candidates_only does the enumeration work but the stubbed predicate makes it
    // always return false (a timing harness), so it must report false either way.
    assert!(!set.candidates_only_is_match(key));
    assert!(!set.candidates_only_is_match(b"nothing seeded here"));
    assert!(set.gate_anchored_only_is_match(key));

    // Seedless / counting-union hooks see the class-only rule, not the seeded one.
    assert!(set.seedless_only_is_match(twenty));
    assert!(!set.seedless_only_is_match(key));
    assert!(set.csa_only_is_match(twenty));
    assert!(!set.csa_only_is_match(b"short"));

    // The anchored-only gate hook sees AKIA (anchored) but not a seedless line.
    assert!(!set.gate_anchored_only_is_match(b"nothing seeded here"));
    assert!(!set.gate_anchored_only_is_match(twenty));
}

#[test]
fn nested_group_repetition_compiles_and_matches() {
    // Reasonable nested group repetition compiles fast and matches correctly.
    let triple = compile("(?:ab){3}").unwrap();
    assert!(triple.is_match(b"ababab"));
    assert!(!triple.is_match(b"abab"));
    let nested = compile("(?:[a-z]{2}){2}").unwrap();
    assert!(nested.is_match(b"abcd"));
    assert!(!nested.is_match(b"ab1d"));
}

// libFuzzer (roundtrip/differential) found these deeply-nested bounded repetitions
// (and complement over them) blow up the DFA build's residuals. With the residual-size
// guard, compile now TERMINATES (rejects or falls back to counting) instead of OOM.
// Marked #[ignore]: even guarded, the worst case takes seconds (more in a debug build),
// which would dominate the default suite and per-mutant mutation runs; run on demand
// with `cargo test -- --ignored`. The engine guard plus the fuzz corpus are the live
// regression protection.
#[test]
#[ignore = "slow pathological compile; the residual guard is exercised by fuzzing"]
fn pathological_nested_repetition_terminates_without_oom() {
    let _ = compile("(?:(?:(?:(?:[^0-9]a\\|?){3}){2}){3,4}){4,4}");
    let _ = compile("~((?:(?:(?:\\S{4,4}\\d{4,4})a?){4,4}a?){3}a)a");
}

#[test]
fn from_bytes_roundtrips_a_built_set() {
    let set = RegexSet::new(&["AKIA[A-Z2-7]{16}", "ghp_[A-Za-z0-9]{36}"]).unwrap();
    let reloaded = RegexSet::from_bytes(&set.to_bytes().unwrap()).unwrap();
    assert!(reloaded.is_match(AKIA_KEY.as_bytes()));
    assert!(!reloaded.is_match(b"nothing here"));
}

#[test]
fn debug_seedless_reports_only_literal_free_patterns() {
    // The diagnostic returns the node dump for a pattern with no usable seed (no leading
    // literal AND no required inner literal), and None once either kind of seed exists. A
    // class repetition is seedless; a leading or inner literal makes it seeded.
    let dump = forbidden_regex::debug_seedless("[a-z]{5}").expect("a class repetition is seedless");
    assert!(dump.len() > 10, "the dump must be the real parsed node, got {dump:?}");
    assert_ne!(dump, "xyzzy");
    assert!(forbidden_regex::debug_seedless("[a-z]{3}abc").is_none(), "an inner literal is a seed");
    assert!(forbidden_regex::debug_seedless("AKIA[A-Z2-7]{16}").is_none(), "a leading literal is a seed");
}
