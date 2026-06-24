//! The serializable DFA table and its allocation-free match loop.

/// Imports the serde derives for persisting a compiled automaton.
use serde::{Deserialize, Serialize};

/// Imports the error type for validation of a decoded automaton.
use crate::error::CompileError;

/// Returns the single-bit acceptance mask for one boundary context.
///
/// What: encodes `(word_after, line_end)` into a bit index `0..=3` and shifts a
/// `1` into it. Why: each state stores which of these four boundary contexts make
/// it accepting, so the matcher tests acceptance with one mask-and.
pub fn accept_bit(word_after: bool, line_end: bool) -> u8 {
    let index = ((line_end as u8) << 1) | (word_after as u8);
    1u8 << index
}

/// A compiled, table-driven deterministic automaton over byte classes.
///
/// What: a byte-to-class map, per-class word/newline flags, a dense transition
/// table, a per-state 4-bit acceptance mask, and the start state. Why: this flat
/// shape serializes directly with serde and matches in a tight per-byte loop with
/// no allocation, which is what beats the lazy, lock-guarded alternatives.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Dfa {
    /// Number of distinct byte classes.
    pub(crate) nclasses: u32,
    /// Length-256 map from a byte to its class id.
    pub(crate) class_map: Vec<u8>,
    /// Per-class flag: is a byte of this class a word byte (for `\b`)?
    pub(crate) class_word: Vec<bool>,
    /// Per-class flag: is a byte of this class a newline (for `^`/`$`)?
    pub(crate) class_newline: Vec<bool>,
    /// Dense transition table of length `num_states * nclasses`.
    pub(crate) trans: Vec<u32>,
    /// Per-state acceptance mask over the four `(word_after, line_end)` contexts.
    pub(crate) accept: Vec<u8>,
    /// Start state id.
    pub(crate) start: u32,
    /// Total number of states.
    pub(crate) num_states: u32,
}

/// Construction-from-parts and matching for `Dfa`.
impl Dfa {
    /// Assembles a `Dfa` from already-built tables.
    ///
    /// What: the builder's only constructor; takes ownership of each table. Why:
    /// fields stay private so a `Dfa` can only arise from the builder or a
    /// validated decode.
    #[allow(clippy::too_many_arguments)]
    pub fn from_parts(
        nclasses: u32,
        class_map: Vec<u8>,
        class_word: Vec<bool>,
        class_newline: Vec<bool>,
        trans: Vec<u32>,
        accept: Vec<u8>,
        start: u32,
        num_states: u32,
    ) -> Self {
        Dfa {
            nclasses,
            class_map,
            class_word,
            class_newline,
            trans,
            accept,
            start,
            num_states,
        }
    }

    /// Reports whether the pattern matches some substring of `line`.
    ///
    /// What: walks the byte-class transitions, checking the acceptance mask at
    /// each boundary against the upcoming byte's context, and returns on the
    /// first match. Why: this is the hot path; it is branch-light and never
    /// allocates, and early exit makes a positive answer cheap.
    pub fn is_match(&self, line: &[u8]) -> bool {
        let nc = self.nclasses as usize;
        let mut state = self.start as usize;
        // What: each iteration tests acceptance at the boundary before `b`, then
        // consumes `b`. Why: a match may end at any boundary; the upcoming byte
        // supplies `word_after` and `line_end` for `$`/`\b`.
        for &b in line {
            let class = self.class_map[b as usize] as usize;
            let mask = accept_bit(self.class_word[class], self.class_newline[class]);
            if self.accept[state] & mask != 0 {
                return true;
            }
            state = self.trans[state * nc + class] as usize;
        }
        // What: the end-of-input boundary has no next byte. Why: `word_after` is
        // false and `line_end` is true there.
        self.accept[state] & accept_bit(false, true) != 0
    }

    /// Validates a decoded automaton so the match loop cannot read out of bounds.
    ///
    /// What: checks every length and that all class ids, transition targets, and
    /// the start id are in range. Why: a serialized DFA may be hostile or
    /// corrupt, and it is executed against attacker-influenced input, so it must
    /// be proven well-formed before first use.
    pub fn validate(&self) -> Result<(), CompileError> {
        // What: a small helper to build the error. Why: keeps each check terse.
        let invalid = |message: &str| CompileError::Invalid {
            message: message.to_string(),
        };
        let nc = self.nclasses as usize;
        let ns = self.num_states as usize;
        if nc == 0 || nc > 256 {
            return Err(invalid("nclasses out of range"));
        }
        if self.class_map.len() != 256 {
            return Err(invalid("class_map must have length 256"));
        }
        if self.class_word.len() != nc || self.class_newline.len() != nc {
            return Err(invalid("class flag length mismatch"));
        }
        if self.class_map.iter().any(|&c| c as usize >= nc) {
            return Err(invalid("class id out of range"));
        }
        if ns == 0 || self.accept.len() != ns || self.start as usize >= ns {
            return Err(invalid("state count or start out of range"));
        }
        let expected = ns
            .checked_mul(nc)
            .ok_or_else(|| invalid("transition table size overflow"))?;
        if self.trans.len() != expected {
            return Err(invalid("transition table length mismatch"));
        }
        if self.trans.iter().any(|&t| t as usize >= ns) {
            return Err(invalid("transition target out of range"));
        }
        Ok(())
    }
}
