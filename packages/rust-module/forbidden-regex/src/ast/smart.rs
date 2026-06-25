//! Smart constructors that keep nodes canonical so derivative states stay finite.

/// Imports the byte-set leaf type for the `class` constructor.
use crate::charset::ByteSet;

/// Imports the node algebra these constructors build.
use crate::ast::node::Node;

/// Builds a sequence, dropping `Empty`, absorbing `Fail`, and flattening.
///
/// What: concatenation is associative with `Empty` as identity and `Fail` as a
/// zero. Why: normalizing here means equal languages produce equal nodes, which
/// bounds the number of derivative states.
pub fn concat(parts: Vec<Node>) -> Node {
    // What: flatten one level of nested `Concat` and drop `Empty` children.
    // Why: associativity and identity, applied as the parts are collected.
    let mut flat: Vec<Node> = Vec::new();
    for part in parts {
        // What: a `Fail` anywhere makes the whole sequence unmatchable.
        // Why: `Fail` is the multiplicative zero of concatenation.
        if part == Node::Fail {
            return Node::Fail;
        }
        match part {
            Node::Empty => {}
            Node::Concat(inner) => flat.extend(inner),
            other => flat.push(other),
        }
    }
    // What: collapse the degenerate arities. Why: a 0- or 1-element sequence is
    // not a `Concat`.
    if flat.is_empty() {
        Node::Empty
    } else if flat.len() == 1 {
        flat.into_iter().next().unwrap()
    } else {
        Node::Concat(flat)
    }
}

/// Builds an alternation with ACI normalization (flatten, drop `Fail`, sort,
/// dedup), absorbing `Top`.
///
/// What: union is associative, commutative, and idempotent, with `Fail` as
/// identity and `Top` as the absorbing element. Why: sorting plus dedup gives a
/// canonical form so two equal unions are the same node.
pub fn alt(parts: Vec<Node>) -> Node {
    // What: flatten nested `Alt`, drop `Fail`, and short-circuit on `Top`.
    // Why: union identities applied while collecting.
    let mut flat: Vec<Node> = Vec::new();
    for part in parts {
        if part == Node::Top {
            return Node::Top;
        }
        match part {
            Node::Fail => {}
            Node::Alt(inner) => flat.extend(inner),
            other => flat.push(other),
        }
    }
    // What: sort then dedup for the commutative-idempotent canonical form.
    // Why: `Ord`/`Eq` on `Node` make this a stable canonicalization.
    flat.sort();
    flat.dedup();
    if flat.is_empty() {
        Node::Fail
    } else if flat.len() == 1 {
        flat.into_iter().next().unwrap()
    } else {
        Node::Alt(flat)
    }
}

/// Builds an intersection with ACI normalization, absorbing `Fail` and dropping
/// `Top`.
///
/// What: intersection is associative, commutative, idempotent, with `Top` as
/// identity and `Fail` as the absorbing element. Why: canonical form bounds
/// state growth from `&` and complement.
pub fn inter(parts: Vec<Node>) -> Node {
    // What: flatten nested `Inter`, drop `Top`, short-circuit on `Fail`.
    // Why: intersection identities applied while collecting.
    let mut flat: Vec<Node> = Vec::new();
    for part in parts {
        if part == Node::Fail {
            return Node::Fail;
        }
        match part {
            Node::Top => {}
            Node::Inter(inner) => flat.extend(inner),
            other => flat.push(other),
        }
    }
    flat.sort();
    flat.dedup();
    // What: an empty intersection is the universe. Why: `Top` is the identity,
    // so intersecting nothing constrains nothing.
    if flat.is_empty() {
        Node::Top
    } else if flat.len() == 1 {
        flat.into_iter().next().unwrap()
    } else {
        Node::Inter(flat)
    }
}

/// Builds a complement, collapsing double negation and the constants.
///
/// What: `~~x = x`, `~Fail = Top`, `~Top = Fail`. Why: keeps complement nodes
/// from stacking and resolves the constant cases immediately.
pub fn comp(inner: Node) -> Node {
    match inner {
        Node::Comp(x) => *x,
        Node::Fail => Node::Top,
        Node::Top => Node::Fail,
        other => Node::Comp(Box::new(other)),
    }
}

/// Builds a bounded repetition, collapsing the trivial arities.
///
/// What: `max == 0` matches nothing-repeated (the empty string); a `Fail` body is
/// `Empty` when zero reps are allowed else `Fail`; exactly-one becomes the body.
/// Why: keeps the count in a `Repeat` node (later a counter register) rather than
/// unrolling it into states, and removes degenerate nodes.
pub fn repeat(node: Node, min: usize, max: usize) -> Node {
    if max == 0 {
        return Node::Empty;
    }
    if node == Node::Fail {
        return if min == 0 { Node::Empty } else { Node::Fail };
    }
    if min == 1 && max == 1 {
        return node;
    }
    Node::Repeat {
        node: Box::new(node),
        min,
        max,
    }
}

/// Builds `x?` as `x{0,1}`.
///
/// What: optional is repetition between zero and one. Why: a single spelling for
/// the optional tail used by `?` and by `{n,m}` upper bounds.
pub fn optional(node: Node) -> Node {
    repeat(node, 0, 1)
}

/// Builds a one-byte class node, collapsing an empty set to `Fail`.
///
/// What: a class matching no byte matches nothing. Why: keeps `Fail` as the sole
/// representation of the empty language so nullability and derivatives stay
/// simple.
pub fn class(set: ByteSet) -> Node {
    if set.is_empty() {
        Node::Fail
    } else {
        Node::Class(set)
    }
}

/// Unit tests for the smart constructors, in a sidecar (max-lines exempt).
#[cfg(test)]
#[path = "smart_tests.rs"]
mod tests;
