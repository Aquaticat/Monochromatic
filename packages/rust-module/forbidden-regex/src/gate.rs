//! The `RegexSet`-level combined literal prefilter over the seeded rules.
//!
//! What: [`SetGate`] is one multi-pattern matcher over the union of every seeded
//! rule's required literals, mapping each literal back to its rule. Why: a line is
//! checked only against the rules whose literal it actually contains (one combined
//! Teddy pass) instead of every rule; the literal-free rules are handled separately
//! by the set's union automaton.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // module gate: see exported functions and types below.
//! ```

/// What:    Imports the multi-pattern matcher and its kind, to map a hit back to its rules.
/// Why:     This file needs these names in scope so the implementation below can use short
///          names instead of long crate paths.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { /* names from this Rust use line */ } from "./module";
/// ```
use aho_corasick::{AhoCorasick, AhoCorasickKind};

/// What:    Imports the leftmost match-kind for the SIMD prefilter.
/// Why:     This file needs these names in scope so the implementation below can use short
///          names instead of long crate paths.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { /* names from this Rust use line */ } from "./module";
/// ```
use regex_automata::MatchKind;

/// What:    Imports the SIMD literal prefilter and the span it searches.
/// Why:     This file needs these names in scope so the implementation below can use short
///          names instead of long crate paths.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { /* names from this Rust use line */ } from "./module";
/// ```
use regex_automata::util::prefilter::Prefilter;

/// What:    Imports the span type the prefilter searches over.
/// Why:     This file needs these names in scope so the implementation below can use short
///          names instead of long crate paths.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { /* names from this Rust use line */ } from "./module";
/// ```
use regex_automata::Span;

/// A combined required-literal gate over the seeded rules of a ruleset.
///
/// What: a SIMD prefilter over every seeded rule's literals for the negative-line
/// fast reject, plus an aho-corasick matcher mapping a hit back to its rules. Why:
/// the prefilter rejects most lines at SIMD speed (hundreds of literals exceed
/// aho-corasick's SIMD capacity, so it alone would run scalar), and the matcher is
/// only consulted on the rare line that does contain a seed.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type SetGate = {
///   // fields documented in Rust above
/// };
/// ```
#[derive(Debug, Clone, Default)]
pub struct SetGate {
    /// What:    SIMD prefilter over the seeded literals, or `None` when none are seeded.
    /// Why:     The surrounding record stores this value by name so later code can read the
    ///          same piece of state.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// prefilter: unknown | null;
    /// ```
    prefilter: Option<Prefilter>,
    /// What:    Matcher over every seeded rule's literals, or `None` when none are seeded.
    /// Why:     The surrounding record stores this value by name so later code can read the
    ///          same piece of state.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// matcher: unknown | null;
    /// ```
    matcher: Option<AhoCorasick>,
    /// What:    Rule id for each literal pattern in `matcher`, by pattern index.
    /// Why:     The surrounding record stores this value by name so later code can read the
    ///          same piece of state.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// literal_rule: number[];
    /// ```
    literal_rule: Vec<usize>,
}

/// What:    Construction and candidate selection.
/// Why:     The program attaches these functions to the named Rust type so callers can use
///          method syntax.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // Methods are written inside a class or as functions that take the value.
/// ```
impl SetGate {
    /// Builds the gate from each rule's seeds (`None` for a literal-free rule).
    ///
    /// What: collects every seeded rule's literals with its rule id into one matcher;
    /// literal-free rules are skipped (the set's union automaton covers them). Why:
    /// the matcher fast-rejects against the rules that have a required literal.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// function build(/* args */) {
    ///   // body documented in Rust
    /// }
    /// ```
    pub fn build(rule_seeds: &[Option<Vec<Vec<u8>>>]) -> SetGate {
        let mut literals: Vec<Vec<u8>> = Vec::new();
        let mut literal_rule: Vec<usize> = Vec::new();
        for (rule, seeds) in rule_seeds.iter().enumerate() {
            if let Some(list) = seeds {
                for seed in list {
                    literals.push(seed.clone());
                    literal_rule.push(rule);
                }
            }
        }
        let (prefilter, matcher) = if literals.is_empty() {
            (None, None)
        } else {
            (
                Prefilter::new(MatchKind::LeftmostFirst, &literals),
                // What: force the DFA back-end for the which-rule matcher. Why: the
                // overlapping enumeration is a per-byte automaton walk on every flagged
                // line; the DFA does one table lookup per byte instead of chasing the
                // NFA's failure links, which is the dominant scalar cost on arm64.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // AhoCorasick: unknown;
                // ```
                AhoCorasick::builder()
                    .kind(Some(AhoCorasickKind::DFA))
                    .build(&literals)
                    .ok(),
            )
        };
        SetGate {
            prefilter,
            matcher,
            literal_rule,
        }
    }

    /// Reports whether any seeded rule whose literal occurs in `line` satisfies
    /// `check`.
    ///
    /// What: runs `check` on each rule whose literal is present, stopping at the first
    /// hit. Why: the boolean any-rule path over the seeded rules.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// function any_candidate(/* args */) {
    ///   // body documented in Rust
    /// }
    /// ```
    pub fn any_candidate(&self, line: &[u8], mut check: impl FnMut(usize, usize) -> bool) -> bool {
        let Some(matcher) = &self.matcher else {
            return false;
        };
        // What:    Fast reject: the SIMD prefilter rejects a line with no seed in one
        //          accelerated pass; only on a hit do we enumerate the (overlapping) matches
        //          to find which rules to check, passing each match's start so a rule whose
        //          seed is its leading literal can be checked anchored at that position.
        // Why:     The surrounding function uses this step to keep the matcher behavior
        //          correct at this point.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // // Same step as the Rust statement below, written with ordinary TS objects/functions.
        // ```
        if let Some(prefilter) = &self.prefilter
            && prefilter.find(line, Span::from(0..line.len())).is_none()
        {
            return false;
        }
        for found in matcher.find_overlapping_iter(line) {
            if check(self.literal_rule[found.pattern().as_usize()], found.start()) {
                return true;
            }
        }
        false
    }

    /// Profiling hook: reports whether the SIMD prefilter alone flags a seed.
    ///
    /// What: just the prefilter find, with no aho-corasick or per-rule fallback. Why:
    /// isolates the prefilter's own cost from the cost of the per-rule check it gates.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// function prefilter_present(/* args */) {
    ///   // body documented in Rust
    /// }
    /// ```
    pub fn prefilter_present(&self, line: &[u8]) -> bool {
        match &self.prefilter {
            Some(prefilter) => prefilter.find(line, Span::from(0..line.len())).is_some(),
            None => false,
        }
    }

    /// Reports the start of the next seeded literal at or after `at` in `buf`.
    ///
    /// What: a positional SIMD prefilter search over `buf[at..]`, `None` when no seed
    /// occurs there (or no rule is seeded). Why: the batch path sweeps the whole
    /// concatenated corpus in one pass to mark which lines hold a seed, so Teddy runs at
    /// full SIMD width over a long buffer instead of paying per-line setup on each short
    /// line, which is where the negative-line cost dominates.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// function prefilter_find_from(/* args */) {
    ///   // body documented in Rust
    /// }
    /// ```
    pub fn prefilter_find_from(&self, buf: &[u8], at: usize) -> Option<usize> {
        let prefilter = self.prefilter.as_ref()?;
        prefilter.find(buf, Span::from(at..buf.len())).map(|span| span.start)
    }

    /// Calls `visit` for each seeded rule whose literal occurs in `line`.
    ///
    /// What: visits every rule with a literal hit and the hit's start, possibly with
    /// repeats. Why: the attribution path collects all seeded hits and the position
    /// lets an anchorable rule be checked anchored.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// function for_each_candidate(/* args */) {
    ///   // body documented in Rust
    /// }
    /// ```
    pub fn for_each_candidate(&self, line: &[u8], mut visit: impl FnMut(usize, usize)) {
        if let Some(matcher) = &self.matcher {
            for found in matcher.find_overlapping_iter(line) {
                visit(self.literal_rule[found.pattern().as_usize()], found.start());
            }
        }
    }
}

/// What:    Unit tests for the set-level gate, in a sidecar (max-lines exempt).
/// Why:     The package keeps that concept in a separate Rust file so this module can refer to
///          it by name.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import "./tests";
/// ```
#[cfg(test)]
#[path = "gate_tests.rs"]
mod tests;
