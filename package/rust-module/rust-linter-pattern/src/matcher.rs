//! Matching a parsed pattern against a syntax tree, binding metavariables.

/// Imports the ordered map metavariable bindings are held in.
use std::collections::BTreeMap;

/// Imports the tree types the matcher walks.
use ra_ap_syntax::{NodeOrToken, SyntaxKind, SyntaxNode};

// What:     `pub const METAVARIABLE_PREFIX: &str = "META_";`. Every identifier
//           starting with this is a hole rather than a literal name.
// Why:      ast-grep spells metavariables `$X`, and that does not work here:
//           measured against ra_ap_syntax 0.0.335, `$X.unwrap()` yields one
//           error through the expression entry point and six through the file
//           one, because `$` is only a token inside a macro definition. An
//           ordinary identifier parses cleanly wherever an identifier is legal,
//           so the prefix carries the meaning instead of the sigil.
/// Identifier prefix marking a metavariable rather than a literal name.
pub const METAVARIABLE_PREFIX: &str = "META_";

// What:     `pub type Bindings = BTreeMap<String, SyntaxNode>;` names a type
//           rather than declaring a new one, the way a TS `type` alias does.
// Why:      Three functions pass this around, and spelling the map out at each
//           of them says less than the name does.
//
// In TS you'd write (pseudocode):
// ```ts
// type Bindings = Map<string, SyntaxNode>;
// ```
/// What each metavariable in a pattern matched.
pub type Bindings = BTreeMap<String, SyntaxNode>;

// What:     `pub struct Match { .. }` is one place a pattern matched.
// Why:      A rewrite needs both the range to replace and what the holes were
//           filled with, and finding them separately would mean walking twice.
/// One place a pattern matched, with what its metavariables bound to.
#[derive(Debug)]
pub struct Match {
    /// Node the pattern matched.
    pub node: SyntaxNode,

    /// What each metavariable bound to.
    pub bindings: Bindings,
}

// What:     `pub fn find_all(pattern: &SyntaxNode, haystack: &SyntaxNode) ->
//           Vec<Match>`. Walks every node in the target and tests each.
// Why:      A pattern can match anywhere, including nested inside another match,
//           so every node is a candidate rather than only the top ones.
//
// In TS you'd write (pseudocode):
// ```ts
// function findAll(pattern: SyntaxNode, haystack: SyntaxNode): Match[]
// ```
/// Find every place a pattern matches within a tree.
pub fn find_all(pattern: &SyntaxNode, haystack: &SyntaxNode) -> Vec<Match> {
    let mut found = Vec::new();

    for candidate in haystack.descendants() {
        // `Bindings::new()` starts each attempt with an empty binding set, so a
        // failed match cannot leak bindings into the next candidate.
        let mut bindings = Bindings::new();

        if matches_node(pattern, &candidate, &mut bindings) {
            found.push(Match {
                node: candidate,
                bindings,
            });
        }
    }

    return found;
}

// What:     `fn matches_node(pattern: &SyntaxNode, candidate: &SyntaxNode,
//           bindings: &mut Bindings) -> bool`. Compares one pattern node against
//           one candidate node, recursing into children.
// Why:      Structural comparison rather than text comparison is the whole point:
//           `META_X.unwrap()` must match `foo.unwrap()` and `a.b.c.unwrap()`
//           alike, and must NOT match the same characters inside a string.
//
// In TS you'd write (pseudocode):
// ```ts
// function matchesNode(pattern, candidate, bindings): boolean
// ```
/// Compare one pattern node against one candidate node.
fn matches_node(pattern: &SyntaxNode, candidate: &SyntaxNode, bindings: &mut Bindings) -> bool {
    // A metavariable matches any node at all, and records what it matched.
    if let Some(name) = metavariable_name(pattern) {
        return bind(name, candidate, bindings);
    }

    if pattern.kind() != candidate.kind() {
        return false;
    }

    // What:     Two vectors of the significant children, compared pairwise.
    //           `significant_children` drops whitespace and comments.
    // Why:      A pattern written with different spacing than the source must
    //           still match. Comparing raw child lists would make
    //           `f( a )` and `f(a)` different trees.
    let pattern_children = significant_children(pattern);
    let candidate_children = significant_children(candidate);

    if pattern_children.len() != candidate_children.len() {
        return false;
    }

    // A leaf pattern with no children compares by text: this is where an
    // identifier, a literal or an operator is actually checked.
    if pattern_children.is_empty() {
        return pattern.text() == candidate.text();
    }

    // `.zip(..)` walks both lists in lockstep, pairing each pattern child with
    // the candidate child in the same position.
    for (left, right) in pattern_children.iter().zip(candidate_children.iter()) {
        if !matches_element(left, right, bindings) {
            return false;
        }
    }

    return true;
}

/// Compare one pattern child against one candidate child.
fn matches_element(
    pattern: &NodeOrToken<SyntaxNode, ra_ap_syntax::SyntaxToken>,
    candidate: &NodeOrToken<SyntaxNode, ra_ap_syntax::SyntaxToken>,
    bindings: &mut Bindings,
) -> bool {
    return match (pattern, candidate) {
        (NodeOrToken::Node(left), NodeOrToken::Node(right)) => {
            matches_node(left, right, bindings)
        }

        // Two tokens match when they are the same kind and the same text, which
        // is what makes `unwrap` in a pattern mean the identifier `unwrap`.
        (NodeOrToken::Token(left), NodeOrToken::Token(right)) => {
            left.kind() == right.kind() && left.text() == right.text()
        }

        // A node against a token, or the reverse, is a shape mismatch. This arm
        // exists because Rust requires a `match` to cover every combination, and
        // AGENTS.md PP8 forbids inventing an answer for an unreachable one.
        _ => false,
    };
}

// What:     `fn metavariable_name(node: &SyntaxNode) -> Option<String>`. Answers
//           the metavariable's name when this pattern node IS one.
// Why:      A metavariable is written as an ordinary identifier, so recognising
//           one means checking that the node is a bare name reference whose text
//           starts with the prefix.
/// Return the metavariable name when a pattern node is a hole.
fn metavariable_name(node: &SyntaxNode) -> Option<String> {
    // Only these kinds can stand in for something. A metavariable spelled
    // anywhere else, such as inside a string, is left as literal text.
    let usable = node.kind() == SyntaxKind::PATH_EXPR
        || node.kind() == SyntaxKind::PATH
        || node.kind() == SyntaxKind::PATH_SEGMENT
        || node.kind() == SyntaxKind::NAME_REF
        || node.kind() == SyntaxKind::NAME
        || node.kind() == SyntaxKind::IDENT_PAT;

    if !usable {
        return None;
    }

    let text = node.text().to_string();

    // `.strip_prefix(..)` answers `Some(rest)` when the prefix matched, which is
    // both the test and the removal in one step. A bare `META_` with nothing
    // after it is not a metavariable: it names no hole.
    let rest = text.strip_prefix(METAVARIABLE_PREFIX)?;
    if rest.is_empty() {
        return None;
    }

    return Some(text);
}

// What:     `fn bind(name: String, candidate: &SyntaxNode, bindings: &mut
//           Bindings) -> bool`. Records what a metavariable matched, or checks
//           consistency when it has already been bound.
// Why:      A metavariable used twice in one pattern must match the same thing
//           both times: `META_X == META_X` should match `a == a` and not
//           `a == b`. Without this check the second occurrence would match
//           anything and the pattern would say less than it appears to.
/// Bind a metavariable, or verify it matched the same text as before.
fn bind(name: String, candidate: &SyntaxNode, bindings: &mut Bindings) -> bool {
    if let Some(existing) = bindings.get(&name) {
        return existing.text() == candidate.text();
    }

    bindings.insert(name, candidate.clone());
    return true;
}

// What:     `fn significant_children(node: &SyntaxNode) -> Vec<..>`. The node's
//           children with whitespace and comments removed.
// Why:      A pattern must match source formatted differently than the pattern
//           was written, and comments inside the matched range must not defeat
//           a match either.
/// Return a node's children, excluding whitespace and comments.
fn significant_children(
    node: &SyntaxNode,
) -> Vec<NodeOrToken<SyntaxNode, ra_ap_syntax::SyntaxToken>> {
    return node
        .children_with_tokens()
        .filter(|element| {
            // `.as_token()` answers `Option`, absent for a node, so a node is
            // always kept and only trivia tokens are dropped.
            return element.as_token().is_none_or(|token| {
                return token.kind() != SyntaxKind::WHITESPACE
                    && token.kind() != SyntaxKind::COMMENT;
            });
        })
        .collect();
}
