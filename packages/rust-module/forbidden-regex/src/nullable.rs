//! Position-dependent nullability: does a node match the empty string here?

/// Imports the node algebra being tested.
use crate::ast::node::Node;

/// Imports the boundary context that resolves anchors.
use crate::context::Ctx;

/// Reports whether `node` accepts the empty string at the given boundary.
///
/// What: the standard Brzozowski nullability function, extended so the anchors
/// read `ctx`. `Empty`/`Top` are nullable; `Fail`/`Class` are not; `Concat` and
/// `Inter` need all children nullable; `Alt` needs one; `Comp` flips its child;
/// `Repeat` is nullable when zero copies are allowed or the body itself is
/// nullable; the anchors consult the context. Why: a string is accepted exactly
/// when the residual after consuming it is nullable, so this is the acceptance
/// test the matcher and DFA builder both rely on.
pub fn nullable(node: &Node, ctx: Ctx) -> bool {
    // What: one arm per variant; structural recursion over the node tree (a
    // bounded walk, never over flat input). Why: nullability is defined by case.
    match node {
        Node::Empty | Node::Top => true,
        Node::Fail | Node::Class(_) => false,
        Node::Concat(parts) | Node::Inter(parts) => parts.iter().all(|p| nullable(p, ctx)),
        Node::Alt(parts) => parts.iter().any(|p| nullable(p, ctx)),
        Node::Comp(inner) => !nullable(inner, ctx),
        Node::Repeat { node, min, .. } => *min == 0 || nullable(node, ctx),
        Node::LineStart => ctx.line_start,
        Node::LineEnd => ctx.line_end,
        Node::WordBoundary => ctx.word_before != ctx.word_after,
    }
}
