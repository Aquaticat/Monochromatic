//! Builds a counting NFA from a node tree by a Glushkov-style position walk.
//!
//! What: [`build_nfa`] turns a concatenation/alternation of classes, class
//! repetitions, and anchors into positions plus follow sets; it returns `None` for
//! intersection, complement, or `Top`, which the product or eager DFA handle. Why:
//! computing first/last/follow per subexpression yields an epsilon-free position
//! automaton whose alternation is just extra edges, so `{n,m}` never unrolls.

/// Imports the node algebra the builder reads.
use crate::ast::node::Node;

/// Imports the position kind emitted per leaf.
use crate::counting::element::Element;

/// Imports the counting NFA being built.
use crate::counting::nfa::CountingNfa;

/// Largest bound for which a non-class repetition is unrolled into copies.
///
/// What: a ceiling on `max` when a repeated body is not a single class. Why: a small
/// repeated group (an optional `(?:labs)?`) is cheaply copied, but a large bound
/// would multiply positions, so it falls back to the general engine instead.
const REPEAT_UNROLL_LIMIT: usize = 64;

/// The first/last/nullable summary of one subexpression's positions.
///
/// What: `first` are positions that may start it, `last` those that may end it, and
/// `nullable` whether it can be skipped entirely. Why: these are exactly what the
/// Glushkov concat and alternation rules combine to wire follow edges.
struct Frag {
    /// Whether the subexpression can match without consuming a position.
    nullable: bool,
    /// Positions that may be entered first.
    first: Vec<u32>,
    /// Positions that may be the last completed.
    last: Vec<u32>,
}

/// Accumulates positions and follow edges while walking the node tree.
///
/// What: `elements` collects position kinds and `follow` their successor lists,
/// grown in lockstep. Why: a single mutable sink keeps position ids stable as the
/// recursion emits leaves.
struct Builder {
    /// Position kinds in emission order.
    elements: Vec<Element>,
    /// Successor ids per position, grown alongside `elements`.
    follow: Vec<Vec<u32>>,
}

/// Construction over the node tree into positions and follow edges.
impl Builder {
    /// Emits one leaf position and returns its single-position fragment.
    ///
    /// What: pushes the element with an empty follow list. Why: leaves are the
    /// positions; their edges are added later by the combinators.
    fn leaf(&mut self, element: Element, nullable: bool) -> Frag {
        let id = self.elements.len() as u32;
        self.elements.push(element);
        self.follow.push(Vec::new());
        Frag {
            nullable,
            first: vec![id],
            last: vec![id],
        }
    }

    /// Adds a follow edge from every `from` position to every `to` position.
    ///
    /// What: a deduped cross product into the follow lists. Why: concatenation wires
    /// each left-end to each right-start.
    fn link(&mut self, from: &[u32], to: &[u32]) {
        for &f in from {
            for &t in to {
                if !self.follow[f as usize].contains(&t) {
                    self.follow[f as usize].push(t);
                }
            }
        }
    }

    /// Builds the fragment for one node, or `None` if it is not NFA-expressible.
    ///
    /// What: structural recursion over the tree, emitting leaves and combining
    /// children. Why: a bounded AST walk, the only recursion this engine permits.
    fn build(&mut self, node: &Node) -> Option<Frag> {
        match node {
            Node::Class(set) => Some(self.leaf(Element::Class(*set), false)),
            Node::LineStart => Some(self.leaf(Element::LineStart, false)),
            Node::LineEnd => Some(self.leaf(Element::LineEnd, false)),
            Node::WordBoundary => Some(self.leaf(Element::WordBoundary, false)),
            Node::Repeat { node, min, max } => self.build_repeat(node, *min, *max),
            Node::Concat(parts) => self.build_concat(parts),
            Node::Alt(parts) => self.build_alt(parts),
            Node::Empty => Some(empty_frag()),
            Node::Fail | Node::Top | Node::Inter(_) | Node::Comp(_) => None,
        }
    }

    /// Builds a counted position, or unrolls a small non-class repetition.
    ///
    /// What: a class body becomes one `Counted` position (nullable when `min` is 0);
    /// any other body is unrolled into `min` mandatory copies and `max - min`
    /// optional copies when the bound is small, else fails. Why: only class
    /// repetitions get the counter treatment, but a small repeated group (an optional
    /// `(?:labs)?`) is cheaply expressible by copying its sub-NFA.
    fn build_repeat(&mut self, body: &Node, min: usize, max: usize) -> Option<Frag> {
        if let Node::Class(set) = body {
            return Some(self.leaf(Element::Counted { set: *set, min, max }, min == 0));
        }
        if max == 0 {
            return Some(empty_frag());
        }
        if max > REPEAT_UNROLL_LIMIT {
            return None;
        }
        let mut acc = empty_frag();
        for i in 0..max {
            let mut copy = self.build(body)?;
            // What: copies past `min` are optional. Why: they may be skipped, so the
            // concat treats them as nullable.
            if i >= min {
                copy.nullable = true;
            }
            acc = self.link_frags(acc, copy);
        }
        Some(acc)
    }

    /// Builds a concatenation, wiring each part's ends to the next part's starts.
    ///
    /// What: folds the parts with [`Builder::link_frags`]. Why: concatenation is the
    /// linear backbone the follow edges thread.
    fn build_concat(&mut self, parts: &[Node]) -> Option<Frag> {
        let mut acc = empty_frag();
        for part in parts {
            let next = self.build(part)?;
            acc = self.link_frags(acc, next);
        }
        Some(acc)
    }

    /// Links two fragments in sequence by the Glushkov concatenation rule.
    ///
    /// What: wires `acc`'s ends to `next`'s starts and combines first/last/nullable
    /// across the nullable gap. Why: shared by concatenation and repeat-unrolling.
    fn link_frags(&mut self, acc: Frag, next: Frag) -> Frag {
        self.link(&acc.last, &next.first);
        let first = extend_if(acc.nullable, &acc.first, &next.first);
        let last = extend_if(next.nullable, &next.last, &acc.last);
        Frag {
            nullable: acc.nullable && next.nullable,
            first,
            last,
        }
    }

    /// Builds an alternation by unioning the branches' fragments.
    ///
    /// What: collects first, last, and nullability across branches with no new
    /// edges. Why: branches are independent, so the union is the whole structure.
    fn build_alt(&mut self, parts: &[Node]) -> Option<Frag> {
        let mut frag = Frag {
            nullable: false,
            first: Vec::new(),
            last: Vec::new(),
        };
        for part in parts {
            let branch = self.build(part)?;
            frag.nullable |= branch.nullable;
            push_unique(&mut frag.first, &branch.first);
            push_unique(&mut frag.last, &branch.last);
        }
        Some(frag)
    }
}

/// Attempts to express `node` as a counting NFA.
///
/// What: walks the tree into positions and follow sets, then wires the accept sink
/// from the root's last positions (and into `start` when the root is nullable);
/// returns `None` for an empty or non-NFA shape. Why: this is the entry the engine
/// selector tries before the eager DFA.
pub fn build_nfa(node: &Node) -> Option<CountingNfa> {
    let mut builder = Builder {
        elements: Vec::new(),
        follow: Vec::new(),
    };
    let root = builder.build(node)?;
    if builder.elements.is_empty() {
        return None;
    }
    let accept = builder.elements.len() as u32;
    builder.link(&root.last, &[accept]);
    let mut start = root.first;
    if root.nullable {
        start.push(accept);
    }
    Some(CountingNfa {
        elements: builder.elements,
        follow: builder.follow,
        start,
    })
}

/// Builds the fragment for an empty (epsilon) subexpression.
///
/// What: nullable with no positions. Why: the identity for concatenation folds.
fn empty_frag() -> Frag {
    Frag {
        nullable: true,
        first: Vec::new(),
        last: Vec::new(),
    }
}

/// Returns `base` extended by `extra` when `cond` holds, else `base` cloned.
///
/// What: a deduped conditional union. Why: the Glushkov first/last rules add the
/// other side only across a nullable gap.
fn extend_if(cond: bool, base: &[u32], extra: &[u32]) -> Vec<u32> {
    let mut out = base.to_vec();
    if cond {
        push_unique(&mut out, extra);
    }
    out
}

/// Appends each id of `extra` to `out` if not already present.
///
/// What: an order-preserving set union. Why: first/last sets must stay deduped so
/// follow edges and the start set carry no repeats.
fn push_unique(out: &mut Vec<u32>, extra: &[u32]) {
    for &id in extra {
        if !out.contains(&id) {
            out.push(id);
        }
    }
}

/// Unit tests for the counting-NFA builder, in a sidecar (max-lines exempt).
#[cfg(test)]
#[path = "build_tests.rs"]
mod tests;
