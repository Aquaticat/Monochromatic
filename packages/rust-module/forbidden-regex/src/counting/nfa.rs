//! The serializable counting NFA: positions, follow sets, and start set.

/// Imports the serde derives so a counting NFA can be persisted.
use serde::{Deserialize, Serialize};

/// Imports the position kind and its decode-time check.
use crate::counting::element::{Element, validate_element};

/// Imports the error type for validating a decoded NFA.
use crate::error::CompileError;

/// A counting NFA over byte-class positions with runtime counter-sets.
///
/// What: `elements[p]` is the position kind, `follow[p]` its successor positions
/// (an id equal to `elements.len()` is the virtual accept), and `start` the
/// initially active positions. Why: branching lives in the follow and start sets,
/// so alternation costs only edges while each `{n,m}` stays one counted position;
/// the whole structure is linear in the pattern, never in any repetition bound.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CountingNfa {
    /// Position kinds, indexed by position id.
    pub elements: Vec<Element>,
    /// Successor ids per position; the id `elements.len()` is the accept sink.
    pub follow: Vec<Vec<u32>>,
    /// Positions active before any input is read.
    pub start: Vec<u32>,
}

/// Matching and decode validation for a counting NFA.
impl CountingNfa {
    /// Reports whether the NFA matches some substring of `line`.
    ///
    /// What: defers to the counting-set search. Why: the boolean answer for one
    /// linear or alternation pattern; the prefilter that fast-rejects most lines
    /// lives one level up in `Engine`.
    ///
    /// @example
    /// ```ignore
    /// let nfa = build_nfa(&parse("(?:(?:AKIA)|(?:ASIA))[A-Z2-7]{4}").unwrap()).unwrap();
    /// assert!(nfa.is_match(b"xxAKIAB2C7"));
    /// ```
    pub fn is_match(&self, line: &[u8]) -> bool {
        crate::counting::run::run(self, line)
    }

    /// Checks that a decoded NFA is safe to run against untrusted input.
    ///
    /// What: requires positions, validates each, and bounds every follow and start
    /// id by the accept index. Why: a serialized NFA may be hostile and is executed
    /// on attacker-influenced input, so its indices must be proven in range and its
    /// counter bounds proven small before it runs.
    pub fn validate(&self) -> Result<(), CompileError> {
        if self.elements.is_empty() {
            return Err(CompileError::Invalid {
                message: "counting nfa has no positions".to_string(),
            });
        }
        if self.follow.len() != self.elements.len() {
            return Err(CompileError::Invalid {
                message: "counting nfa follow length mismatch".to_string(),
            });
        }
        for element in &self.elements {
            validate_element(element)?;
        }
        let accept = self.elements.len() as u32;
        for &id in self.follow.iter().flatten().chain(&self.start) {
            if id > accept {
                return Err(CompileError::Invalid {
                    message: "counting nfa target out of range".to_string(),
                });
            }
        }
        Ok(())
    }
}

/// Unit tests for counting-NFA decode validation, in a sidecar (max-lines exempt).
#[cfg(test)]
#[path = "nfa_tests.rs"]
mod tests;
