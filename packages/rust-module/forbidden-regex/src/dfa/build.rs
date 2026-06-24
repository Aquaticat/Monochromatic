//! Eager determinization: turn a node into a `Dfa` by enumerating derivative states.

/// Imports the hash map used to intern states.
use std::collections::HashMap;

/// Imports the node algebra being determinized.
use crate::ast::node::Node;

/// Imports the boundary context driving derivatives and acceptance.
use crate::context::Ctx;

/// Imports the byte derivative.
use crate::derivative::derivative;

/// Imports the error type for the state cap.
use crate::error::CompileError;

/// Imports nullability for acceptance masks.
use crate::nullable::nullable;

/// Imports the byte-class computation.
use crate::dfa::classes::compute_classes;

/// Imports the table type and its acceptance-bit helper.
use crate::dfa::table::{Dfa, accept_bit};

/// Largest number of DFA states before the build is abandoned.
///
/// What: an upper bound on determinization. Why: complement and intersection can
/// in principle explode the state count; the cap turns that into a clean error.
const STATE_CAP: usize = 200_000;

/// A determinization state: a residual node plus its incoming boundary bits.
///
/// What: the residual regex together with whether the previous byte was a
/// newline (`at_line_start`) and a word byte (`prev_word`). Why: those two bits
/// are the parts of the boundary context that a residual cannot recover on its
/// own, so they must be part of the state's identity.
#[derive(Clone, PartialEq, Eq, Hash)]
struct StateKey {
    /// The residual regex after the bytes that lead to this state.
    node: Node,
    /// Whether this position is a line start (previous byte was a newline).
    at_line_start: bool,
    /// Whether the previous byte was a word byte.
    prev_word: bool,
}

/// Builds a DFA from a (search-wrapped) node.
///
/// What: BFS over derivative states, computing per-class transitions and a
/// per-state acceptance mask, until no new state appears or the cap is hit. Why:
/// eager determinization yields a flat table that matches with no per-byte
/// allocation and no lazy-cache lock.
pub fn build_dfa(root: Node) -> Result<Dfa, CompileError> {
    let classes = compute_classes(&root);
    let nc = classes.nclasses;
    let mut index: HashMap<StateKey, u32> = HashMap::new();
    let mut states: Vec<StateKey> = Vec::new();
    let mut trans: Vec<u32> = Vec::new();
    let mut accept: Vec<u8> = Vec::new();
    // What: the start sits at a line start with no preceding word byte. Why:
    // position zero of the input has nothing before it.
    let start = intern(
        &mut index,
        &mut states,
        StateKey {
            node: root,
            at_line_start: true,
            prev_word: false,
        },
    );
    // What: process states in discovery order; interning may append more. Why:
    // appending in id order keeps `trans`/`accept` aligned with state ids.
    let mut i = 0usize;
    while i < states.len() {
        let node = states[i].node.clone();
        let at_ls = states[i].at_line_start;
        let pw = states[i].prev_word;
        accept.push(compute_accept(&node, at_ls, pw));
        for class in 0..nc {
            let b = classes.reps[class];
            let word_after = classes.class_word[class];
            let line_end = classes.class_newline[class];
            let ctx = Ctx {
                line_start: at_ls,
                line_end,
                word_before: pw,
                word_after,
            };
            let next_node = derivative(&node, b, ctx);
            let next = intern(
                &mut index,
                &mut states,
                StateKey {
                    node: next_node,
                    at_line_start: line_end,
                    prev_word: word_after,
                },
            );
            trans.push(next);
        }
        if states.len() > STATE_CAP {
            return Err(CompileError::StateCap { limit: STATE_CAP });
        }
        i += 1;
    }
    Ok(Dfa::from_parts(
        nc as u32,
        classes.class_map,
        classes.class_word,
        classes.class_newline,
        trans,
        accept,
        start,
        states.len() as u32,
    ))
}

/// Returns the id of `key`, interning it on first sight.
///
/// What: hash-map lookup with append-on-miss. Why: equal residual states must
/// collapse to one id so the automaton stays finite.
fn intern(index: &mut HashMap<StateKey, u32>, states: &mut Vec<StateKey>, key: StateKey) -> u32 {
    if let Some(&id) = index.get(&key) {
        return id;
    }
    let id = states.len() as u32;
    index.insert(key.clone(), id);
    states.push(key);
    id
}

/// Computes the 4-bit acceptance mask of a state.
///
/// What: tests nullability under each `(word_after, line_end)` boundary, with the
/// state's own `line_start`/`word_before` fixed. Why: acceptance depends on the
/// upcoming byte, so the matcher needs all four answers precomputed per state.
fn compute_accept(node: &Node, at_line_start: bool, prev_word: bool) -> u8 {
    // What: fold the four boundary contexts into a bitmask. Why: one mask-and at
    // match time then replaces four nullability checks.
    let mut mask = 0u8;
    for line_end in [false, true] {
        for word_after in [false, true] {
            let ctx = Ctx {
                line_start: at_line_start,
                line_end,
                word_before: prev_word,
                word_after,
            };
            if nullable(node, ctx) {
                mask |= accept_bit(word_after, line_end);
            }
        }
    }
    mask
}
