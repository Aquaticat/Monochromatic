//! The per-pattern back-end: a matcher plus its required-literal prefilter.

/// Imports the serde derives so a compiled engine can be persisted.
use serde::{Deserialize, Serialize};

/// Imports the counting NFA back-end.
use crate::counting::CountingNfa;

/// Imports the required-literal prefilter.
use crate::counting::Prefilter;

/// Imports the synchronized-product back-end for `&` and `~`.
use crate::counting::ProductProgram;

/// Imports the general derivative DFA.
use crate::dfa::table::Dfa;

/// Imports the error type for decode validation.
use crate::error::CompileError;

/// The matcher back-end chosen for one pattern.
///
/// What: a `Table` derivative DFA for the fast O(1)-per-byte path, a `Nfa` counting
/// automaton for patterns whose DFA would explode, or a `Product` for `&`/`~`. Why:
/// the selector picks the fastest representation that does not blow up.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EngineKind {
    /// General derivative DFA; matches in O(1) per byte.
    Table(
        /// Flat transition-table automaton.
        Dfa,
    ),
    /// Counting NFA; small where the DFA would explode on bounded repetition.
    Nfa(
        /// Counting automaton over byte-class positions.
        CountingNfa,
    ),
    /// Synchronized-product counting back-end for `&` and `~`.
    Product(
        /// Product of counting NFAs.
        ProductProgram,
    ),
}

/// A compiled matcher plus the required-literal prefilter that guards it.
///
/// What: the back-end, the literal seeds every match must contain (empty when the
/// pattern has no usable required literal), and the rebuilt searchers. Why: holding
/// the seeds at this level lets both the single-pattern fast path and the
/// `RegexSet` gate prefilter regardless of which back-end matches.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Engine {
    /// The matcher back-end.
    kind: EngineKind,
    /// Required-literal seeds for the prefilter and the set gate.
    seeds: Vec<Vec<u8>>,
    /// Searchers rebuilt from `seeds`; never serialized.
    #[serde(skip)]
    prefilter: Prefilter,
}

/// Construction, matching, and decode handling for an engine.
impl Engine {
    /// Builds an engine from a back-end and its required-literal seeds.
    ///
    /// What: stores both and builds the prefilter searchers. Why: the only
    /// constructor, so a built engine always has a prepared prefilter.
    pub fn new(kind: EngineKind, seeds: Vec<Vec<u8>>) -> Engine {
        let prefilter = Prefilter::from_seeds(&seeds);
        Engine {
            kind,
            seeds,
            prefilter,
        }
    }

    /// Reports whether the pattern matches some substring of `line`.
    ///
    /// What: rejects on the prefilter, then runs the back-end. Why: most scanned
    /// lines carry no required literal, so the cheap scan skips the matcher.
    pub fn is_match(&self, line: &[u8]) -> bool {
        self.prefilter.allows(line) && self.matches(line)
    }

    /// Runs the back-end matcher on `line`, skipping the prefilter.
    ///
    /// What: the match without the required-literal pre-check. Why: the `RegexSet` gate
    /// has already confirmed this rule's seed is present, so re-scanning the whole line
    /// for it in the engine's own prefilter is redundant work on every flagged line.
    pub fn matches_only(&self, line: &[u8]) -> bool {
        self.matches(line)
    }

    /// Runs the back-end matcher on `line`.
    ///
    /// What: dispatches to the chosen representation. Why: callers match without
    /// caring which one was selected.
    fn matches(&self, line: &[u8]) -> bool {
        match &self.kind {
            EngineKind::Table(dfa) => dfa.is_match(line),
            EngineKind::Nfa(nfa) => nfa.is_match(line),
            EngineKind::Product(program) => program.is_match(line),
        }
    }

    /// Returns the table DFA when this engine is the table back-end.
    ///
    /// What: `Some` only for an `EngineKind::Table`, else `None`. Why: the batch
    /// kernels run directly on a `Dfa`, so a caller comparing kernels needs the table
    /// when one is present and falls back to the scalar path otherwise.
    pub fn table_dfa(&self) -> Option<&Dfa> {
        match &self.kind {
            EngineKind::Table(dfa) => Some(dfa),
            _ => None,
        }
    }

    /// Fills `out[i]` with whether the engine matches `lines[i]`.
    ///
    /// What: a seedless table engine (its DFA runs on every line) takes the vertical
    /// SIMD batch kernel; any other engine loops the per-line match. Why: the SIMD
    /// kernel only pays off when the DFA actually scans every line, whereas a seeded
    /// engine's literal prefilter already rejects most lines before the DFA runs.
    pub fn is_match_batch(&self, lines: &[&[u8]], out: &mut [bool]) {
        match &self.kind {
            EngineKind::Table(dfa) if self.seeds.is_empty() => dfa.is_match_batch_simd(lines, out),
            _ => {
                for (line, slot) in lines.iter().zip(out.iter_mut()) {
                    *slot = self.is_match(line);
                }
            }
        }
    }

    /// Returns the required-literal seeds, or `None` when the engine has none.
    ///
    /// What: a clone of the seeds when present. Why: the `RegexSet` gate unions every
    /// rule's seeds; a seedless engine is always a candidate.
    pub fn seeds(&self) -> Option<Vec<Vec<u8>>> {
        if self.seeds.is_empty() {
            None
        } else {
            Some(self.seeds.clone())
        }
    }

    /// Validates a decoded engine before it runs against untrusted input.
    ///
    /// What: defers to the back-end's structural check. Why: a decoded automaton is
    /// executed on attacker-influenced input, so it must be proven in-bounds first.
    pub fn validate(&self) -> Result<(), CompileError> {
        match &self.kind {
            EngineKind::Table(dfa) => dfa.validate(),
            EngineKind::Nfa(nfa) => nfa.validate(),
            EngineKind::Product(program) => program.validate(),
        }
    }

    /// Adds to `set` the bytes that could begin a match, for a line-start fast reject.
    ///
    /// What: a `Table` engine reports its DFA's first bytes; any other kind marks every
    /// byte (conservative, so no match is ever skipped). Why: line-start rules compile
    /// to anchored DFAs, so the precise table path is the one that matters; the
    /// fallback keeps the reject sound for any back-end.
    pub fn mark_first_bytes(&self, set: &mut crate::charset::ByteSet) {
        match &self.kind {
            EngineKind::Table(dfa) => dfa.mark_first_bytes(set),
            _ => set.union_with(&crate::charset::ByteSet::all_bytes()),
        }
    }

    /// Rebuilds the prefilter searchers from the decoded seeds.
    ///
    /// What: regenerates `prefilter` from `seeds`. Why: the searchers are not
    /// serialized, so a reloaded engine must rebuild them before matching.
    pub fn prepare(&mut self) {
        self.prefilter = Prefilter::from_seeds(&self.seeds);
    }
}

/// Unit tests for the per-pattern engine, in a sidecar (max-lines exempt).
#[cfg(test)]
#[path = "engine_tests.rs"]
mod tests;
