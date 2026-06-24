//! The per-pattern back-end: either the counting program or the general DFA.

/// Imports the serde derives so a compiled engine can be persisted.
use serde::{Deserialize, Serialize};

/// Imports the counting back-end's linear program.
use crate::counting::LinearProgram;

/// Imports the general derivative DFA.
use crate::dfa::table::Dfa;

/// Imports the error type for decode validation.
use crate::error::CompileError;

/// The compiled matcher for one pattern.
///
/// What: a `Linear` counting program for branch-free counting-heavy patterns, or a
/// `Table` derivative DFA for everything with alternation, intersection, or
/// complement. Why: the counting program stays small where the DFA would explode,
/// while the DFA still handles the set-algebra operators the linear IR cannot.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Engine {
    /// Branch-free counting back-end; small for counted repetition.
    Linear(
        /// Counting program for the branch-free pattern.
        LinearProgram,
    ),
    /// General derivative DFA; handles `&`, `~`, and alternation.
    Table(
        /// General derivative DFA back-end.
        Dfa,
    ),
}

/// Matching and decode validation shared by both back-ends.
impl Engine {
    /// Reports whether the pattern matches some substring of `line`.
    ///
    /// What: dispatches to the active back-end. Why: callers match without caring
    /// which representation was chosen at compile time.
    pub fn is_match(&self, line: &[u8]) -> bool {
        match self {
            Engine::Linear(program) => program.is_match(line),
            Engine::Table(dfa) => dfa.is_match(line),
        }
    }

    /// Validates a decoded engine before it runs against untrusted input.
    ///
    /// What: defers to the back-end's own structural check. Why: both
    /// representations are executed on attacker-influenced input, so each must be
    /// proven in-bounds first.
    pub fn validate(&self) -> Result<(), CompileError> {
        match self {
            Engine::Linear(program) => program.validate(),
            Engine::Table(dfa) => dfa.validate(),
        }
    }
}
