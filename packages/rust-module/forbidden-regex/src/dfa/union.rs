//! Union of per-rule DFAs into one gate via reachable-product construction.

/// Imports the hash map used to intern product states and byte classes.
use std::collections::HashMap;

/// Imports the word-byte predicate for reclassification.
use crate::charset::is_word_byte;

/// Imports the table type and its raw-byte stepping helpers.
use crate::dfa::table::Dfa;

/// Number of possible byte values, the width of the intermediate table.
const BYTE_VALUES: usize = 256;

/// Builds a gate DFA accepting where any component DFA accepts.
///
/// What: a breadth-first product over the reachable tuples of component states,
/// OR-ing their acceptance masks, then a byte-class recompression of the
/// resulting raw table. Why: combining the already-minimized per-rule DFAs keeps
/// the product to the reachable (roughly additive) states instead of rebuilding
/// one giant exploding union from scratch.
pub fn union(rules: &[Dfa]) -> Dfa {
    let mut index: HashMap<Vec<u32>, u32> = HashMap::new();
    let mut states: Vec<Vec<u32>> = Vec::new();
    // What: the product starts at every component's start. Why: all rules begin
    // matching at line start together.
    let start_tuple: Vec<u32> = rules.iter().map(|r| r.start_state()).collect();
    intern(&mut index, &mut states, start_tuple);
    let mut raw_trans: Vec<u32> = Vec::new();
    let mut accept: Vec<u8> = Vec::new();
    let mut i = 0usize;
    while i < states.len() {
        let tuple = states[i].clone();
        // What: a product state accepts in a context iff some component does.
        // Why: the gate answers "does any rule match?".
        let mut mask = 0u8;
        for (rule, &state) in rules.iter().zip(tuple.iter()) {
            mask |= rule.accept_mask_of(state);
        }
        accept.push(mask);
        for byte in 0u16..BYTE_VALUES as u16 {
            // What: step every component on the same raw byte. Why: the product
            // advances all rules in lockstep over the input.
            let next: Vec<u32> = rules
                .iter()
                .zip(tuple.iter())
                .map(|(rule, &state)| rule.step(state, byte as u8))
                .collect();
            let id = intern(&mut index, &mut states, next);
            raw_trans.push(id);
        }
        i += 1;
    }
    reclassify(states.len(), &raw_trans, accept)
}

/// Returns the id of `tuple`, interning it on first sight.
///
/// What: hash-map lookup with append-on-miss over component-state tuples. Why:
/// equal product states must collapse to one id.
fn intern(index: &mut HashMap<Vec<u32>, u32>, states: &mut Vec<Vec<u32>>, tuple: Vec<u32>) -> u32 {
    if let Some(&id) = index.get(&tuple) {
        return id;
    }
    let id = states.len() as u32;
    index.insert(tuple.clone(), id);
    states.push(tuple);
    id
}

/// Recompresses a raw 256-wide transition table into byte classes.
///
/// What: groups bytes whose whole transition column is identical and whose
/// word/newline flags agree, then emits a class-indexed `Dfa`. Why: a narrow
/// class table is far smaller and more cache-friendly than a 256-wide one, which
/// is what makes the gate fast to run.
fn reclassify(num_states: usize, raw_trans: &[u32], accept: Vec<u8>) -> Dfa {
    let mut signature_to_class: HashMap<Vec<u32>, u8> = HashMap::new();
    let mut class_map = vec![0u8; BYTE_VALUES];
    let mut reps: Vec<u8> = Vec::new();
    let mut class_word: Vec<bool> = Vec::new();
    let mut class_newline: Vec<bool> = Vec::new();
    for byte in 0..BYTE_VALUES {
        // What: a byte's signature is its word/newline flags plus its transition
        // column. Why: two bytes are interchangeable iff both agree.
        let mut signature = Vec::with_capacity(num_states + 2);
        signature.push(is_word_byte(byte as u8) as u32);
        signature.push((byte == b'\n' as usize) as u32);
        for state in 0..num_states {
            signature.push(raw_trans[state * BYTE_VALUES + byte]);
        }
        let next = reps.len() as u8;
        let id = match signature_to_class.get(&signature) {
            Some(&id) => id,
            None => {
                signature_to_class.insert(signature, next);
                reps.push(byte as u8);
                class_word.push(is_word_byte(byte as u8));
                class_newline.push(byte == b'\n' as usize);
                next
            }
        };
        class_map[byte] = id;
    }
    let nc = reps.len();
    let mut trans = vec![0u32; num_states * nc];
    for state in 0..num_states {
        for (class, &rep) in reps.iter().enumerate() {
            trans[state * nc + class] = raw_trans[state * BYTE_VALUES + rep as usize];
        }
    }
    Dfa::from_parts(
        nc as u32,
        class_map,
        class_word,
        class_newline,
        trans,
        accept,
        0,
        num_states as u32,
    )
}
