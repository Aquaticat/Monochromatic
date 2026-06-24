//! Byte-class equivalence: collapse the 256 bytes into transition-equivalent groups.

/// Imports the hash map used to deduplicate byte signatures.
use std::collections::HashMap;

/// Imports the byte-set leaf type and the word predicate.
use crate::charset::{ByteSet, is_word_byte};

/// Imports the node algebra walked to gather classes.
use crate::ast::node::Node;

/// The byte-class partition derived from a pattern.
///
/// What: how many classes there are, a byte-to-class map, a representative byte
/// per class (for computing transitions), and per-class word/newline flags. Why:
/// transitions and acceptance depend on a byte only through its class, so the
/// transition table can be `num_states * nclasses` wide instead of `* 256`.
pub struct Classes {
    /// Number of distinct classes.
    pub nclasses: usize,
    /// Length-256 map from a byte to its class id.
    pub class_map: Vec<u8>,
    /// One representative byte per class id.
    pub reps: Vec<u8>,
    /// Per-class word-byte flag.
    pub class_word: Vec<bool>,
    /// Per-class newline flag.
    pub class_newline: Vec<bool>,
}

/// Computes the byte-class partition for a node.
///
/// What: gathers every distinct `Class` byte set in the node, then groups bytes
/// whose `(is_word, is_newline, membership-in-each-set)` signature is identical.
/// Why: two bytes with the same signature drive identical derivatives and the
/// same boundary context, so they are interchangeable in the DFA.
pub fn compute_classes(root: &Node) -> Classes {
    // What: collect the distinct leaf sets. Why: set membership is what makes two
    // bytes behave differently under a `Class` derivative.
    let mut sets: Vec<ByteSet> = Vec::new();
    collect_sets(root, &mut sets);

    // What: assign a class id to each distinct byte signature.
    // Why: the signature captures every byte-dependent behavior.
    let mut signature_to_id: HashMap<Vec<bool>, u8> = HashMap::new();
    let mut class_map: Vec<u8> = vec![0; 256];
    let mut reps: Vec<u8> = Vec::new();
    let mut class_word: Vec<bool> = Vec::new();
    let mut class_newline: Vec<bool> = Vec::new();
    for byte in 0u16..256 {
        let b = byte as u8;
        let signature = byte_signature(b, &sets);
        // What: reuse an existing id or mint a new one. Why: the first byte of a
        // signature becomes that class's representative.
        let id = match signature_to_id.get(&signature) {
            Some(&id) => id,
            None => {
                let id = reps.len() as u8;
                signature_to_id.insert(signature, id);
                reps.push(b);
                class_word.push(is_word_byte(b));
                class_newline.push(b == b'\n');
                id
            }
        };
        class_map[b as usize] = id;
    }

    Classes {
        nclasses: reps.len(),
        class_map,
        reps,
        class_word,
        class_newline,
    }
}

/// Builds the equivalence signature of one byte.
///
/// What: word-ness, newline-ness, then membership in each collected set. Why:
/// bytes sharing this vector produce identical transitions everywhere.
fn byte_signature(b: u8, sets: &[ByteSet]) -> Vec<bool> {
    // What: start with the two context bits, then one bit per set.
    // Why: order is fixed so equal signatures hash and compare equal.
    let mut signature = Vec::with_capacity(2 + sets.len());
    signature.push(is_word_byte(b));
    signature.push(b == b'\n');
    for set in sets {
        signature.push(set.contains(b));
    }
    signature
}

/// Walks a node collecting its distinct `Class` byte sets.
///
/// What: a structural recursion over the node tree, adding each unseen set. Why:
/// only `Class` nodes constrain bytes; the constants and anchors do not.
fn collect_sets(node: &Node, out: &mut Vec<ByteSet>) {
    // What: recurse into children; record sets at the leaves. Why: bounded walk
    // of the AST, never of input bytes.
    match node {
        Node::Class(set) => {
            if !out.contains(set) {
                out.push(*set);
            }
        }
        Node::Concat(parts) | Node::Alt(parts) | Node::Inter(parts) => {
            for part in parts {
                collect_sets(part, out);
            }
        }
        Node::Comp(inner) => collect_sets(inner, out),
        Node::Empty | Node::Fail | Node::Top | Node::LineStart | Node::LineEnd | Node::WordBoundary => {}
    }
}
