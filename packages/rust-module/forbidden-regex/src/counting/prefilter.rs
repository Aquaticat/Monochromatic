//! Required-literal seeds and the per-engine substring prefilter.
//!
//! What: [`seeds_from_node`] derives literal seeds such that every match of a node
//! contains one as a substring, and [`Prefilter`] turns seeds into SIMD searchers.
//! Why: a secret scanner mostly sees lines with no secret, so rejecting them on a
//! cheap literal scan before the matcher is the dominant throughput win, and the
//! `RegexSet` gate unions every rule's seeds into one combined pass.

/// Imports the SIMD substring searcher used to test each seed.
use memchr::memmem::Finder;

/// Imports the node algebra the seed extractor reads.
use crate::ast::node::Node;

/// Shortest literal seed worth filtering on.
///
/// What: seeds below this length are too common to be selective. Why: a one- or
/// two-byte seed rejects little, so such a rule is left seedless (it routes to the
/// eager DFA instead, which matches it in O(1) per byte).
const MIN_SEED_LEN: usize = 3;

/// A set of required-literal searchers; a match implies one seed is present.
///
/// What: prebuilt owned `Finder`s; an empty set means "no prefilter, always run".
/// Why: building the searchers once (not per call) keeps the prefilter cheap.
#[derive(Debug, Clone, Default)]
pub(crate) struct Prefilter {
    /// One SIMD searcher per required seed; empty disables filtering.
    finders: Vec<Finder<'static>>,
}

/// Queries over a prepared prefilter.
impl Prefilter {
    /// Builds a prefilter from required-literal seeds.
    ///
    /// What: one owned searcher per seed. Why: the engine rebuilds this from its
    /// serialized seeds after a decode.
    pub(crate) fn from_seeds(seeds: &[Vec<u8>]) -> Prefilter {
        Prefilter {
            finders: seeds.iter().map(|seed| Finder::new(seed).into_owned()).collect(),
        }
    }

    /// Reports whether `line` could contain a match, given the required seeds.
    ///
    /// What: true if there is no prefilter, or some seed occurs in `line`. Why: a
    /// sound gate, it only ever rejects lines that provably cannot match.
    pub(crate) fn allows(&self, line: &[u8]) -> bool {
        self.finders.is_empty() || self.finders.iter().any(|finder| finder.find(line).is_some())
    }
}

/// Keeps a seed set only when every seed is at least `min` bytes, else empty.
///
/// What: the shared length gate for the seed extractors. Why: soundness is in the
/// extraction (every seed is required); length is purely a selectivity policy, so it
/// lives in one place and the fold can ask for a shorter floor.
fn filter_min(seeds: Vec<Vec<u8>>, min: usize) -> Vec<Vec<u8>> {
    if seeds.is_empty() || min_len(&seeds) < min {
        Vec::new()
    } else {
        seeds
    }
}

/// Derives required-literal seeds from a node, or empty when none is usable.
///
/// What: the most selective set of literals every match must contain, dropped if any
/// seed is shorter than [`MIN_SEED_LEN`]. Why: soundness (never reject a matchable
/// line) and selectivity (short seeds are not worth filtering on).
pub(crate) fn seeds_from_node(node: &Node) -> Vec<Vec<u8>> {
    seeds_from_node_min(node, MIN_SEED_LEN)
}

/// Derives required-literal seeds with a caller-chosen minimum length.
///
/// What: [`required_literal`] kept only when every seed is at least `min` bytes. Why:
/// a rule that is seedless at the default floor can still be folded into the gate on a
/// shorter required literal (azure's `Q~`, facebook's `|`/`%`), which beats a second
/// per-line pass even when the literal is short.
pub(crate) fn seeds_from_node_min(node: &Node, min: usize) -> Vec<Vec<u8>> {
    filter_min(required_literal(node), min)
}

/// Returns a set of literals such that every match of `node` contains one.
///
/// What: a singleton class is a one-byte seed, an alternation unions its branches,
/// an intersection uses a positive operand, and a concatenation takes its best
/// mandatory literal anywhere inside (not only the prefix). Why: any required
/// substring is a sound prefilter, and an inner keyword (`adafruit`) is often the
/// only literal a rule has.
fn required_literal(node: &Node) -> Vec<Vec<u8>> {
    match node {
        Node::Class(set) => set.as_singleton().map(|b| vec![vec![b]]).unwrap_or_default(),
        Node::Concat(parts) => concat_literal(parts),
        Node::Alt(branches) => alt_literal(branches),
        Node::Inter(operands) => inter_literal(operands),
        _ => Vec::new(),
    }
}

/// Unions the required literals of every alternation branch.
///
/// What: collects each branch's seeds, returning empty if any branch has none. Why:
/// a match takes one branch, so the union is sound only when every branch contributes.
fn alt_literal(branches: &[Node]) -> Vec<Vec<u8>> {
    let mut all: Vec<Vec<u8>> = Vec::new();
    for branch in branches {
        let seeds = required_literal(branch);
        if seeds.is_empty() {
            return Vec::new();
        }
        for seed in seeds {
            if !all.contains(&seed) {
                all.push(seed);
            }
        }
    }
    all
}

/// Returns the required literals of the first positive operand of an intersection.
///
/// What: scans operands for a non-complement with seeds. Why: a match requires every
/// positive, so any one positive's required literal is required overall.
fn inter_literal(operands: &[Node]) -> Vec<Vec<u8>> {
    for operand in operands {
        if !matches!(operand, Node::Comp(_)) {
            let seeds = required_literal(operand);
            if !seeds.is_empty() {
                return seeds;
            }
        }
    }
    Vec::new()
}

/// Returns the literals every match of `node` must begin with, or empty when a match
/// can start with a non-literal.
///
/// What: the leading singleton-class run of a concatenation, the union over an
/// alternation's branches, or a positive intersection operand's leading literal. Why:
/// when these equal the gate's seeds, every match starts at a seed position, so the
/// rule can be checked by an anchored DFA at that position instead of a substring scan.
pub(crate) fn leading_literals(node: &Node) -> Vec<Vec<u8>> {
    match node {
        Node::Class(set) => set.as_singleton().map(|b| vec![vec![b]]).unwrap_or_default(),
        Node::Concat(parts) => concat_leading(parts),
        Node::Alt(branches) => alt_leading(branches),
        Node::Inter(operands) => inter_leading(operands),
        _ => Vec::new(),
    }
}

/// Returns the leading literals if they are all selective enough to gate on.
///
/// What: [`leading_literals`] when every one is at least [`MIN_SEED_LEN`], else empty.
/// Why: gating on the leading literal (not the most selective inner one) lets a rule be
/// checked by an anchored DFA at the hit, but only when the leading literal is itself a
/// worthwhile filter.
pub(crate) fn leading_seeds(node: &Node) -> Vec<Vec<u8>> {
    leading_seeds_min(node, MIN_SEED_LEN)
}

/// Returns the leading literals with a caller-chosen minimum length.
///
/// What: [`leading_literals`] kept only when every one is at least `min` bytes. Why:
/// the fold gates an otherwise-seedless rule on a short leading literal (`SK`, `s.`)
/// so it is checked by an anchored DFA at the hit instead of a second per-line pass.
pub(crate) fn leading_seeds_min(node: &Node, min: usize) -> Vec<Vec<u8>> {
    filter_min(leading_literals(node), min)
}

/// Returns the leading literals of a concatenation, extended by the following run.
///
/// What: the first part's leading literals (a singleton byte, or each branch of a
/// leading alternation), each extended by the maximal run of singleton classes that
/// follows. Why: every match begins with the first element, so a leading
/// alternation's branches plus the mandatory bytes after it (`(?:sk|rk)_` ->
/// `sk_`/`rk_`) are a longer, more selective leading literal than the bare branches.
fn concat_leading(parts: &[Node]) -> Vec<Vec<u8>> {
    let Some((first, rest)) = parts.split_first() else {
        return Vec::new();
    };
    let mut prefixes = leading_literals(first);
    if prefixes.is_empty() {
        return Vec::new();
    }
    for part in rest {
        let Node::Class(set) = part else {
            break;
        };
        let Some(b) = set.as_singleton() else {
            break;
        };
        for prefix in &mut prefixes {
            prefix.push(b);
        }
    }
    prefixes
}

/// Unions the leading literals of every alternation branch.
///
/// What: collects each branch's leading literal, returning empty if any branch lacks
/// one. Why: a match takes one branch, so the union covers every start only when every
/// branch contributes a leading literal.
fn alt_leading(branches: &[Node]) -> Vec<Vec<u8>> {
    let mut all: Vec<Vec<u8>> = Vec::new();
    for branch in branches {
        let lits = leading_literals(branch);
        if lits.is_empty() {
            return Vec::new();
        }
        for lit in lits {
            if !all.contains(&lit) {
                all.push(lit);
            }
        }
    }
    all
}

/// Returns the leading literal of the first positive operand of an intersection.
///
/// What: scans operands for a non-complement with a leading literal. Why: a match
/// satisfies every positive operand, so it begins with any positive's leading literal.
fn inter_leading(operands: &[Node]) -> Vec<Vec<u8>> {
    for operand in operands {
        if !matches!(operand, Node::Comp(_)) {
            let lits = leading_literals(operand);
            if !lits.is_empty() {
                return lits;
            }
        }
    }
    Vec::new()
}

/// Returns the most selective mandatory literal anywhere in a concatenation.
///
/// What: accumulates maximal runs of singleton classes and also considers each
/// non-literal part's own required literal (an inner alternation of keywords), then
/// keeps the candidate with the longest minimum seed. Why: every part of a
/// concatenation is mandatory, so its longest fixed substring is a required literal.
fn concat_literal(parts: &[Node]) -> Vec<Vec<u8>> {
    let mut best: Vec<Vec<u8>> = Vec::new();
    let mut run: Vec<u8> = Vec::new();
    for part in parts {
        if let Node::Class(set) = part
            && let Some(b) = set.as_singleton()
        {
            run.push(b);
            continue;
        }
        best = better_seed(best, vec![run.clone()]);
        run.clear();
        best = better_seed(best, required_literal(part));
    }
    better_seed(best, vec![run])
}

/// Picks the more selective of two candidate seed sets.
///
/// What: keeps the candidate whose shortest seed is longer, ignoring empty candidates.
/// Why: a longer required literal rejects more lines; the length floor is applied once
/// by [`filter_min`] at the top, so this only compares selectivity.
fn better_seed(best: Vec<Vec<u8>>, candidate: Vec<Vec<u8>>) -> Vec<Vec<u8>> {
    if !candidate.is_empty() && min_len(&candidate) > min_len(&best) {
        candidate
    } else {
        best
    }
}

/// Returns the shortest seed length in a set, or zero when empty.
///
/// What: the minimum length, the selectivity score. Why: a seed set is only as
/// selective as its weakest member.
fn min_len(seeds: &[Vec<u8>]) -> usize {
    seeds.iter().map(Vec::len).min().unwrap_or(0)
}

/// Unit tests for seed extraction and the prefilter, in a sidecar (max-lines exempt).
#[cfg(test)]
#[path = "prefilter_tests.rs"]
mod tests;
