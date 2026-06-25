//! The `RegexSet`-level combined literal prefilter over the seeded rules.
//!
//! What: [`SetGate`] is one multi-pattern matcher over the union of every seeded
//! rule's required literals, mapping each literal back to its rule. Why: a line is
//! checked only against the rules whose literal it actually contains (one combined
//! Teddy pass) instead of every rule; the literal-free rules are handled separately
//! by the set's union automaton.

/// Imports the multi-pattern matcher and its kind, to map a hit back to its rules.
use aho_corasick::{AhoCorasick, AhoCorasickKind};

/// Imports the leftmost match-kind for the SIMD prefilter.
use regex_automata::MatchKind;

/// Imports the SIMD literal prefilter and the span it searches.
use regex_automata::util::prefilter::Prefilter;

/// Imports the span type the prefilter searches over.
use regex_automata::Span;

/// A combined required-literal gate over the seeded rules of a ruleset.
///
/// What: a SIMD prefilter over every seeded rule's literals for the negative-line
/// fast reject, plus an aho-corasick matcher mapping a hit back to its rules. Why:
/// the prefilter rejects most lines at SIMD speed (hundreds of literals exceed
/// aho-corasick's SIMD capacity, so it alone would run scalar), and the matcher is
/// only consulted on the rare line that does contain a seed.
#[derive(Debug, Clone, Default)]
pub struct SetGate {
    /// SIMD prefilter over the seeded literals, or `None` when none are seeded.
    prefilter: Option<Prefilter>,
    /// Matcher over every seeded rule's literals, or `None` when none are seeded.
    matcher: Option<AhoCorasick>,
    /// Rule id for each literal pattern in `matcher`, by pattern index.
    literal_rule: Vec<usize>,
}

/// Construction and candidate selection.
impl SetGate {
    /// Builds the gate from each rule's seeds (`None` for a literal-free rule).
    ///
    /// What: collects every seeded rule's literals with its rule id into one matcher;
    /// literal-free rules are skipped (the set's union automaton covers them). Why:
    /// the matcher fast-rejects against the rules that have a required literal.
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
    pub fn any_candidate(&self, line: &[u8], mut check: impl FnMut(usize, usize) -> bool) -> bool {
        let Some(matcher) = &self.matcher else {
            return false;
        };
        // Fast reject: the SIMD prefilter rejects a line with no seed in one
        // accelerated pass; only on a hit do we enumerate the (overlapping) matches
        // to find which rules to check, passing each match's start so a rule whose
        // seed is its leading literal can be checked anchored at that position.
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
    pub fn prefilter_find_from(&self, buf: &[u8], at: usize) -> Option<usize> {
        let prefilter = self.prefilter.as_ref()?;
        prefilter.find(buf, Span::from(at..buf.len())).map(|span| span.start)
    }

    /// Calls `visit` for each seeded rule whose literal occurs in `line`.
    ///
    /// What: visits every rule with a literal hit and the hit's start, possibly with
    /// repeats. Why: the attribution path collects all seeded hits and the position
    /// lets an anchorable rule be checked anchored.
    pub fn for_each_candidate(&self, line: &[u8], mut visit: impl FnMut(usize, usize)) {
        if let Some(matcher) = &self.matcher {
            for found in matcher.find_overlapping_iter(line) {
                visit(self.literal_rule[found.pattern().as_usize()], found.start());
            }
        }
    }
}

/// Unit tests for the set-level gate, in a sidecar (max-lines exempt).
#[cfg(test)]
#[path = "gate_tests.rs"]
mod tests;
