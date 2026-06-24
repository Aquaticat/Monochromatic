//! Brzozowski byte derivatives over the node algebra.

/// Imports the node algebra being differentiated.
use crate::ast::node::Node;

/// Imports the smart constructors that keep results canonical.
use crate::ast::smart::{alt, comp, concat, inter};

/// Imports the boundary context used when a sequence steps past a nullable
/// anchor.
use crate::context::Ctx;

/// Imports nullability, needed by the concatenation rule.
use crate::nullable::nullable;

/// Returns the derivative of `node` with respect to one `byte` at `ctx`.
///
/// What: `D_b(r)` is the regex matching the remaining input after a leading `b`.
/// Constants and anchors derive to `Fail` or `Top`; a class derives to `Empty`
/// when it contains `b`; the boolean operators distribute; concatenation uses
/// the nullable-prefix rule below. Why: feeding the input one byte at a time
/// through this function and checking nullability at the end decides membership,
/// and the boolean cases are what give the engine `&` and `~`.
pub fn derivative(node: &Node, byte: u8, ctx: Ctx) -> Node {
    // What: one arm per variant; recursion is structural over child nodes.
    // Why: the derivative is defined inductively on the regex shape.
    match node {
        Node::Empty | Node::Fail => Node::Fail,
        Node::Top => Node::Top,
        Node::LineStart | Node::LineEnd | Node::WordBoundary => Node::Fail,
        Node::Class(set) => {
            // What: a class consumes `b` iff `b` is a member. Why: after
            // consuming the matched byte nothing remains, hence `Empty`.
            if set.contains(byte) {
                Node::Empty
            } else {
                Node::Fail
            }
        }
        Node::Alt(parts) => alt(parts.iter().map(|p| derivative(p, byte, ctx)).collect()),
        Node::Inter(parts) => inter(parts.iter().map(|p| derivative(p, byte, ctx)).collect()),
        Node::Comp(inner) => comp(derivative(inner, byte, ctx)),
        Node::Concat(parts) => derivative_concat(parts, byte, ctx),
    }
}

/// Derivative of a concatenation, summing over its nullable prefix.
///
/// What: for `x0 x1 ...`, the derivative is `D(x0)·x1...` plus, when `x0` is
/// nullable here, the derivative of the tail, and so on through every leading
/// nullable factor (so zero-width anchors at the front are stepped over). Why:
/// the empty string a nullable factor matches lets the next factor also start on
/// this same byte, which is exactly how anchors inside a sequence take effect.
fn derivative_concat(parts: &[Node], byte: u8, ctx: Ctx) -> Node {
    // What: accumulate one alternative per leading nullable factor; an index
    // loop is used because each step needs the tail slice `parts[i + 1..]`.
    // Why: lookahead into the remaining factors is the allowed counter-loop case.
    let mut branches: Vec<Node> = Vec::new();
    for i in 0..parts.len() {
        // What: D(parts[i]) followed by the untouched tail parts[i+1..].
        // Why: this is the contribution of starting the byte inside factor i.
        let mut seq: Vec<Node> = Vec::with_capacity(parts.len() - i);
        seq.push(derivative(&parts[i], byte, ctx));
        seq.extend_from_slice(&parts[i + 1..]);
        branches.push(concat(seq));
        // What: only continue past factor i if it can match empty here.
        // Why: a non-nullable factor must consume the byte, so later factors
        // cannot also begin on it.
        if !nullable(&parts[i], ctx) {
            break;
        }
    }
    alt(branches)
}
