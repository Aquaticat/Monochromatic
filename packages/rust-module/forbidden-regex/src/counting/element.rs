//! The linear element IR and the linearizer that builds it from a node.

/// Imports the serde derives so a linear program can be persisted.
use serde::{Deserialize, Serialize};

/// Imports the node algebra the linearizer reads.
use crate::ast::node::Node;

/// Imports the byte-set leaf type carried by class and counted elements.
use crate::charset::ByteSet;

/// Imports the error type for validating a decoded program.
use crate::error::CompileError;

/// Largest repetition bound a decoded program may carry.
///
/// What: an upper limit on a `Counted` element's `max`, checked on decode. Why: the
/// counter-set can hold up to `max` distinct values, so a hostile serialized bound
/// could force unbounded memory; this caps it well above the parser's own limit.
const MAX_DECODED_COUNT: usize = 1 << 16;

/// One element of a linear (branch-free) pattern.
///
/// What: a single byte class, a counted class repetition, or a zero-width anchor;
/// the only shapes the counting simulation runs without unrolling. Why: keeping a
/// bounded repetition as one `Counted` element is what moves the count out of the
/// state space and into a runtime counter-set.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum Element {
    /// Matches exactly one byte drawn from the set.
    Class(
        /// Byte set the single matched byte must belong to.
        ByteSet,
    ),
    /// Matches between `min` and `max` bytes from the set, counted at runtime.
    Counted {
        /// Byte set each repetition must match.
        set: ByteSet,
        /// Fewest repetitions that satisfy the element.
        min: usize,
        /// Most repetitions the element admits.
        max: usize,
    },
    /// Zero-width `^`: passable only at a line start.
    LineStart,
    /// Zero-width `$`: passable only at a line end.
    LineEnd,
    /// Zero-width `\b`: passable only where word-ness changes.
    WordBoundary,
}

/// A branch-free chain of elements matched left to right.
///
/// What: the ordered elements plus the implicit accept after the last. Why: the
/// serializable, counter-aware back-end for patterns with no alternation,
/// intersection, or complement; its size is linear in the pattern, never in any
/// repetition bound.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LinearProgram {
    /// Elements in match order; reaching past the last one accepts.
    pub elements: Vec<Element>,
}

/// Validation for a decoded linear program.
impl LinearProgram {
    /// Checks that a decoded program is safe to run against untrusted input.
    ///
    /// What: rejects an empty chain, an empty counted set, an inverted bound, and a
    /// bound above the decode cap. Why: a serialized program may be hostile, and
    /// the simulation allocates a counter-set sized by `max`, so the bound must be
    /// proven small before the program runs.
    pub fn validate(&self) -> Result<(), CompileError> {
        // What: a non-empty chain is required. Why: an empty program would accept
        // the empty string everywhere, the rejected empty-match footgun.
        if self.elements.is_empty() {
            return Err(CompileError::Invalid {
                message: "linear program has no elements".to_string(),
            });
        }
        for element in &self.elements {
            validate_element(element)?;
        }
        Ok(())
    }
}

/// Validates one decoded element.
///
/// What: only `Counted` carries decode-time risk; class and anchor elements are
/// always well formed. Why: keeps the per-element checks isolated and named.
fn validate_element(element: &Element) -> Result<(), CompileError> {
    if let Element::Counted { set, min, max } = element {
        let invalid = |message: &str| CompileError::Invalid {
            message: message.to_string(),
        };
        if set.is_empty() {
            return Err(invalid("counted element has an empty set"));
        }
        if min > max {
            return Err(invalid("counted element has min greater than max"));
        }
        if *max > MAX_DECODED_COUNT {
            return Err(invalid("counted element bound exceeds the decode cap"));
        }
    }
    Ok(())
}

/// Attempts to express `node` as a linear program.
///
/// What: walks a concatenation of classes, class repetitions, and anchors into an
/// element list; returns `None` for any shape with alternation, intersection,
/// complement, or a non-class repetition body. Why: those shapes need the
/// derivative DFA, so the caller falls back to it; the linear back-end claims only
/// the counting-heavy patterns it can keep small.
///
/// @example
/// ```ignore
/// // AKIA[A-Z2-7]{16} -> four Class elements then one Counted element.
/// let prog = linearize(&node).unwrap();
/// assert_eq!(prog.elements.len(), 5);
/// ```
pub fn linearize(node: &Node) -> Option<LinearProgram> {
    let mut elements: Vec<Element> = Vec::new();
    push_node(node, &mut elements)?;
    if elements.is_empty() {
        return None;
    }
    Some(LinearProgram { elements })
}

/// Appends the elements of one node to `out`, or fails if it is not linear.
///
/// What: structural recursion over the node tree, pushing a leaf per class or
/// anchor and recursing through concatenation. Why: a bounded walk of the AST (not
/// of input), the only recursion this engine permits.
fn push_node(node: &Node, out: &mut Vec<Element>) -> Option<()> {
    match node {
        Node::Class(set) => push_leaf(out, Element::Class(*set)),
        Node::LineStart => push_leaf(out, Element::LineStart),
        Node::LineEnd => push_leaf(out, Element::LineEnd),
        Node::WordBoundary => push_leaf(out, Element::WordBoundary),
        Node::Concat(parts) => push_concat(parts, out),
        Node::Repeat { node, min, max } => push_repeat(node, *min, *max, out),
        Node::Empty | Node::Fail | Node::Top | Node::Alt(_) | Node::Inter(_) | Node::Comp(_) => None,
    }
}

/// Pushes one element and reports success.
///
/// What: appends `element` and returns `Some`. Why: a shared tail so each leaf arm
/// is a single expression.
fn push_leaf(out: &mut Vec<Element>, element: Element) -> Option<()> {
    out.push(element);
    Some(())
}

/// Pushes every part of a concatenation in order.
///
/// What: recurses into each child. Why: concatenation is the linear backbone.
fn push_concat(parts: &[Node], out: &mut Vec<Element>) -> Option<()> {
    for part in parts {
        push_node(part, out)?;
    }
    Some(())
}

/// Pushes a repetition, requiring its body to be a single class.
///
/// What: a class body becomes one `Counted` element; any other body fails. Why:
/// only class repetitions get the counter-set treatment, a structured body would
/// need the general automaton.
fn push_repeat(body: &Node, min: usize, max: usize, out: &mut Vec<Element>) -> Option<()> {
    match body {
        Node::Class(set) => push_leaf(out, Element::Counted { set: *set, min, max }),
        _ => None,
    }
}
