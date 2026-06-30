//! What:    The per-pattern back-end: a matcher plus its required-literal prefilter.
//! Why:     This file is the Rust module that groups the engine implementation, so a reader
//!          can enter the package through one named area.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // module engine: see exported functions and types below.
//! ```

/// What:    Imports the serde derives so a compiled engine can be persisted.
/// Why:     This file needs these names in scope so the implementation below can use short
///          names instead of long crate paths.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { /* names from this Rust use line */ } from "./module";
/// ```
use serde::{Deserialize, Serialize};

/// What:    Imports the counting NFA back-end.
/// Why:     This file needs these names in scope so the implementation below can use short
///          names instead of long crate paths.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { /* names from this Rust use line */ } from "./module";
/// ```
use crate::counting::CountingNfa;

/// What:    Imports the required-literal prefilter.
/// Why:     This file needs these names in scope so the implementation below can use short
///          names instead of long crate paths.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { /* names from this Rust use line */ } from "./module";
/// ```
use crate::counting::Prefilter;

/// What:    Imports the synchronized-product back-end for `&` and `~`.
/// Why:     This file needs these names in scope so the implementation below can use short
///          names instead of long crate paths.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { /* names from this Rust use line */ } from "./module";
/// ```
use crate::counting::ProductProgram;

/// What:    Imports the general derivative DFA.
/// Why:     This file needs these names in scope so the implementation below can use short
///          names instead of long crate paths.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { /* names from this Rust use line */ } from "./module";
/// ```
use crate::dfa::table::Dfa;

/// What:    Imports the error type for decode validation.
/// Why:     This file needs these names in scope so the implementation below can use short
///          names instead of long crate paths.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { /* names from this Rust use line */ } from "./module";
/// ```
use crate::error::CompileError;

/// Smallest batch that routes a seedless table engine to the Sheng permute kernel.
///
/// What: the line-count floor below which `is_match_batch` stays on the per-line loop.
/// Why: Sheng builds a one-time 16 KiB permute table per call, so a tiny batch would not
/// scan enough bytes to amortize it; this floor keeps the kernel a win, never a regression.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const SHENG_BATCH_FLOOR: unknown = /* value below */;
/// ```
const SHENG_BATCH_FLOOR: usize = 512;

/// The matcher back-end chosen for one pattern.
///
/// What: a `Table` derivative DFA for the fast O(1)-per-byte path, a `Nfa` counting
/// automaton for patterns whose DFA would explode, or a `Product` for `&`/`~`. Why:
/// the selector picks the fastest representation that does not blow up.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type EngineKind =
///   | { kind: "variant" };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EngineKind {
    /// What:    General derivative DFA; matches in O(1) per byte.
    /// Why:     The surrounding function uses this step to keep the matcher behavior correct
    ///          at this point.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// // Same step as the Rust statement below, written with ordinary TS objects/functions.
    /// ```
    Table(
        /// What:    Flat transition-table automaton.
        /// Why:     The surrounding function uses this step to keep the matcher behavior
        ///          correct at this point.
        ///
        /// In TS you'd write (pseudocode):
        /// ```ts
        /// // Same step as the Rust statement below, written with ordinary TS objects/functions.
        /// ```
        Dfa,
    ),
    /// What:    Counting NFA; small where the DFA would explode on bounded repetition.
    /// Why:     The surrounding function uses this step to keep the matcher behavior correct
    ///          at this point.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// // Same step as the Rust statement below, written with ordinary TS objects/functions.
    /// ```
    Nfa(
        /// What:    Counting automaton over byte-class positions.
        /// Why:     The surrounding function uses this step to keep the matcher behavior
        ///          correct at this point.
        ///
        /// In TS you'd write (pseudocode):
        /// ```ts
        /// // Same step as the Rust statement below, written with ordinary TS objects/functions.
        /// ```
        CountingNfa,
    ),
    /// What:    Synchronized-product counting back-end for `&` and `~`.
    /// Why:     The surrounding function uses this step to keep the matcher behavior correct
    ///          at this point.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// // Same step as the Rust statement below, written with ordinary TS objects/functions.
    /// ```
    Product(
        /// What:    Product of counting NFAs.
        /// Why:     The surrounding function uses this step to keep the matcher behavior
        ///          correct at this point.
        ///
        /// In TS you'd write (pseudocode):
        /// ```ts
        /// // Same step as the Rust statement below, written with ordinary TS objects/functions.
        /// ```
        ProductProgram,
    ),
}

/// A compiled matcher plus the required-literal prefilter that guards it.
///
/// What: the back-end, the literal seeds every match must contain (empty when the
/// pattern has no usable required literal), and the rebuilt searchers. Why: holding
/// the seeds at this level lets both the single-pattern fast path and the
/// `RegexSet` gate prefilter regardless of which back-end matches.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Engine = {
///   // fields documented in Rust above
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Engine {
    /// What:    The matcher back-end.
    /// Why:     The surrounding record stores this value by name so later code can read the
    ///          same piece of state.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// kind: unknown;
    /// ```
    kind: EngineKind,
    /// What:    Required-literal seeds for the prefilter and the set gate.
    /// Why:     The surrounding record stores this value by name so later code can read the
    ///          same piece of state.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// seeds: number[][];
    /// ```
    seeds: Vec<Vec<u8>>,
    /// What:    Searchers rebuilt from `seeds`; never serialized.
    /// Why:     The surrounding record stores this value by name so later code can read the
    ///          same piece of state.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// prefilter: unknown;
    /// ```
    #[serde(skip)]
    prefilter: Prefilter,
}

/// What:    Construction, matching, and decode handling for an engine.
/// Why:     The program attaches these functions to the named Rust type so callers can use
///          method syntax.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // Methods are written inside a class or as functions that take the value.
/// ```
impl Engine {
    /// Builds an engine from a back-end and its required-literal seeds.
    ///
    /// What: stores both and builds the prefilter searchers. Why: the only
    /// constructor, so a built engine always has a prepared prefilter.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// function new(/* args */) {
    ///   // body documented in Rust
    /// }
    /// ```
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
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// function is_match(/* args */) {
    ///   // body documented in Rust
    /// }
    /// ```
    pub fn is_match(&self, line: &[u8]) -> bool {
        self.prefilter.allows(line) && self.matches(line)
    }

    /// Runs the back-end matcher on `line`, skipping the prefilter.
    ///
    /// What: the match without the required-literal pre-check. Why: the `RegexSet` gate
    /// has already confirmed this rule's seed is present, so re-scanning the whole line
    /// for it in the engine's own prefilter is redundant work on every flagged line.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// function matches_only(/* args */) {
    ///   // body documented in Rust
    /// }
    /// ```
    pub fn matches_only(&self, line: &[u8]) -> bool {
        self.matches(line)
    }

    /// Runs the back-end matcher on `line`.
    ///
    /// What: dispatches to the chosen representation. Why: callers match without
    /// caring which one was selected.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// function matches(/* args */) {
    ///   // body documented in Rust
    /// }
    /// ```
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
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// function table_dfa(/* args */) {
    ///   // body documented in Rust
    /// }
    /// ```
    pub fn table_dfa(&self) -> Option<&Dfa> {
        match &self.kind {
            EngineKind::Table(dfa) => Some(dfa),
            _ => None,
        }
    }

    /// Fills `out[i]` with whether the engine matches `lines[i]`.
    ///
    /// What: a seedless table pattern over a large batch takes the Sheng permute kernels
    /// (`is_match_batch_sheng2`, which cascades two-byte -> one-byte -> scalar by what the
    /// DFA and host support); everything else loops the per-line match. Why: a seedless
    /// table pattern scans every line, and the composed two-byte Sheng was measured up to
    /// 3.35x the per-line loop on x86 (one-byte ~2.2x on both arches), with no prefilter
    /// and no bucketing. A seeded engine keeps the per-line loop so its literal prefilter
    /// still rejects most lines first, and a small batch keeps it too, so the kernel's
    /// one-time permute-table build stays amortized. (A vertical SIMD gather across lines
    /// lost outright and was removed; the interleaved and tight kernels reach parity to a
    /// small win and back the `is_match_batch_bucketed` opt-in.)
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// function is_match_batch(/* args */) {
    ///   // body documented in Rust
    /// }
    /// ```
    pub fn is_match_batch(&self, lines: &[&[u8]], out: &mut [bool]) {
        if self.seeds.is_empty() && lines.len() >= SHENG_BATCH_FLOOR
            && let EngineKind::Table(dfa) = &self.kind
        {
            dfa.is_match_batch_sheng2(lines, out);
            return;
        }
        for (line, slot) in lines.iter().zip(out.iter_mut()) {
            *slot = self.is_match(line);
        }
    }

    /// Returns the required-literal seeds, or `None` when the engine has none.
    ///
    /// What: a clone of the seeds when present. Why: the `RegexSet` gate unions every
    /// rule's seeds; a seedless engine is always a candidate.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// function seeds(/* args */) {
    ///   // body documented in Rust
    /// }
    /// ```
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
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// function validate(/* args */) {
    ///   // body documented in Rust
    /// }
    /// ```
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
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// function mark_first_bytes(/* args */) {
    ///   // body documented in Rust
    /// }
    /// ```
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
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// function prepare(/* args */) {
    ///   // body documented in Rust
    /// }
    /// ```
    pub fn prepare(&mut self) {
        self.prefilter = Prefilter::from_seeds(&self.seeds);
    }
}

/// What:    Unit tests for the per-pattern engine, in a sidecar (max-lines exempt).
/// Why:     The package keeps that concept in a separate Rust file so this module can refer to
///          it by name.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import "./tests";
/// ```
#[cfg(test)]
#[path = "engine_tests.rs"]
mod tests;
