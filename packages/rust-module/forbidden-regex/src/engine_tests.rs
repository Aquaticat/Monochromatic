// What:  unit tests for the per-pattern Engine: the prefilter gate in front of the
//        back-end, the prefilter-skipping match the set gate uses, seed reporting, and
//        the first-byte set.
// Why:   Engine wires the required-literal prefilter to the matcher; if is_match ran the
//        back-end without the prefilter it would be slow, and if matches_only kept the
//        prefilter the set gate's already-confirmed hit would be rescanned. Both
//        behaviours are pinned here.

use super::{Engine, EngineKind};
use crate::dfa::{build_dfa_within, minimize};
use crate::parse::parse;

// A Table engine over a pattern's anchored DFA, carrying the given seeds.
fn table_engine(pattern: &str, seeds: &[&[u8]]) -> Engine {
    let dfa = minimize(&build_dfa_within(parse(pattern).expect("parses"), 10_000).expect("builds"));
    let seeds = seeds.iter().map(|s| s.to_vec()).collect();
    Engine::new(EngineKind::Table(dfa), seeds)
}

#[test]
fn is_match_rejects_when_the_seed_is_absent() {
    // The back-end would match "abc", but the seed "zzz" is not present, so the
    // prefilter short-circuits to a non-match.
    let engine = table_engine("abc", &[b"zzz"]);
    assert!(!engine.is_match(b"abc"));
}

#[test]
fn matches_only_skips_the_prefilter() {
    // Same engine: matches_only ignores the prefilter and runs the back-end, which
    // matches the "abc" prefix.
    let engine = table_engine("abc", &[b"zzz"]);
    assert!(engine.matches_only(b"abc"));
    assert!(!engine.matches_only(b"xbc"));
}

#[test]
fn is_match_runs_the_back_end_when_the_seed_is_present() {
    let engine = table_engine("abc", &[b"abc"]);
    assert!(engine.is_match(b"abc"));
    assert!(!engine.is_match(b"abx"));
}

#[test]
fn empty_seeds_make_the_prefilter_always_allow() {
    let engine = table_engine("abc", &[]);
    assert_eq!(engine.seeds(), None);
    assert!(engine.is_match(b"abc"));
    assert!(!engine.is_match(b"xyz"));
}

#[test]
fn seeds_are_reported_when_present() {
    let engine = table_engine("abc", &[b"abc"]);
    assert_eq!(engine.seeds(), Some(vec![b"abc".to_vec()]));
}

#[test]
fn validate_and_prepare_keep_a_built_engine_working() {
    let mut engine = table_engine("AKIA[A-Z2-7]{4}", &[b"AKIA"]);
    assert!(engine.validate().is_ok());
    // prepare rebuilds the prefilter searchers; matching still works afterwards.
    engine.prepare();
    assert!(engine.is_match(b"AKIAB2C7"));
}

#[test]
fn prepare_rebuilds_the_prefilter_dropped_by_decode() {
    // The prefilter is `#[serde(skip)]`, so a decoded engine starts with none and must be
    // rebuilt by `prepare`. A match verdict cannot see this (an empty prefilter just allows
    // every line, still sound), so pin it on the searcher count: zero after decode, one per
    // seed after prepare. This proves `prepare` is not a no-op.
    let engine = table_engine("AKIA[A-Z2-7]{4}", &[b"AKIA"]);
    let bytes = bincode::serialize(&engine).expect("engine serializes");
    let mut decoded: Engine = bincode::deserialize(&bytes).expect("engine deserializes");
    assert_eq!(decoded.prefilter.len(), 0, "a decoded engine has no prefilter until prepared");
    decoded.prepare();
    assert_eq!(decoded.prefilter.len(), 1, "prepare rebuilds one searcher per seed");
}

#[test]
fn validate_rejects_a_corrupt_back_end() {
    // Engine::validate must delegate into the back-end so a hostile decoded table is
    // caught before it runs; corrupt the inner DFA and confirm rejection.
    let mut engine = table_engine("abc", &[]);
    if let EngineKind::Table(dfa) = &mut engine.kind {
        dfa.start = dfa.num_states + 1; // out-of-range start state
    }
    assert!(engine.validate().is_err());
}

#[test]
fn mark_first_bytes_delegates_to_the_table() {
    let engine = table_engine("abc", &[]);
    let mut set = crate::charset::ByteSet::empty();
    engine.mark_first_bytes(&mut set);
    assert!(set.contains(b'a'));
    assert!(!set.contains(b'b'));
}
