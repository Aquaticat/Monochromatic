//! The `RegexSet`-level combined literal prefilter over the seeded rules.
//!
//! What: [`SetGate`] is one multi-pattern matcher over the union of every seeded
//! rule's required literals, mapping each literal back to its rule. Why: a line is
//! checked only against the rules whose literal it actually contains (one combined
//! Teddy pass) instead of every rule; the literal-free rules are handled separately
//! by the set's union automaton.

/// Imports the multi-pattern matcher backing the combined prefilter.
use aho_corasick::AhoCorasick;

/// A combined required-literal gate over the seeded rules of a ruleset.
///
/// What: the matcher over every seeded rule's literals and the per-literal rule id.
/// Why: candidate selection turns a line into the few rules whose literal it
/// contains, so a non-matching line is rejected in one pass.
#[derive(Debug, Clone, Default)]
pub struct SetGate {
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
        let matcher = if literals.is_empty() {
            None
        } else {
            AhoCorasick::new(&literals).ok()
        };
        SetGate {
            matcher,
            literal_rule,
        }
    }

    /// Reports whether any seeded rule whose literal occurs in `line` satisfies
    /// `check`.
    ///
    /// What: runs `check` on each rule whose literal is present, stopping at the first
    /// hit. Why: the boolean any-rule path over the seeded rules.
    pub fn any_candidate(&self, line: &[u8], mut check: impl FnMut(usize) -> bool) -> bool {
        let Some(matcher) = &self.matcher else {
            return false;
        };
        // Fast reject: the leftmost `is_match` uses the SIMD prefilter, so a line with
        // no seed is rejected in one accelerated pass; only on a hit do we enumerate
        // the (overlapping) matches to find which rules to check.
        if !matcher.is_match(line) {
            return false;
        }
        for found in matcher.find_overlapping_iter(line) {
            if check(self.literal_rule[found.pattern().as_usize()]) {
                return true;
            }
        }
        false
    }

    /// Calls `visit` for each seeded rule whose literal occurs in `line`.
    ///
    /// What: visits every rule with a literal hit, possibly with repeats. Why: the
    /// attribution path collects all seeded hits.
    pub fn for_each_candidate(&self, line: &[u8], mut visit: impl FnMut(usize)) {
        if let Some(matcher) = &self.matcher {
            for found in matcher.find_overlapping_iter(line) {
                visit(self.literal_rule[found.pattern().as_usize()]);
            }
        }
    }
}
