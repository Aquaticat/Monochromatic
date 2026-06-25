//! Greedy combination of literal-free rules into a few union DFAs.
//!
//! What: the seedless (literal-free) rules run against every line, so [`group_seedless`]
//! collapses them from N separate DFA passes into a few combined union DFAs. Why: one
//! O(1)-per-byte pass over a union covers many rules at once; growing a group rule by
//! rule lets the smart `alt` constructor share structure across members, so compatible
//! rules fold together while the per-group state cap keeps the explosive ones apart.

/// Imports the node algebra combined into each group.
use crate::ast::node::Node;

/// Imports the constructors that wrap a group for unanchored search.
use crate::ast::smart::{alt, concat};

/// Imports the DFA builder and minimizer for each group.
use crate::dfa::{build_dfa_within, minimize};

/// Imports the engine wrapper each group DFA becomes.
use crate::engine::{Engine, EngineKind};

/// Largest combined DFA a group of seedless rules may form.
///
/// What: a state ceiling on a group's union DFA; a trial union exceeding it starts a
/// new group instead. Why: combining literal-free rules into one pass is the
/// throughput lever, but `{n,m}` overlap blowup must cap, so explosive rules separate.
const GROUP_DFA_CAP: usize = 6_000;

/// Wraps a node with the `Σ*` prefix for unanchored substring search.
///
/// What: prefixes `Top` so a nullable residual at any boundary means a substring
/// matched. Why: every group DFA matches anywhere in the line.
fn search_wrap(node: Node) -> Node {
    concat(vec![Node::Top, node])
}

/// Builds a node into a seedless Table engine, or `None` past the cap.
///
/// What: determinizes the search-wrapped node under the cap and minimizes it. Why: a
/// node that exceeds the cap is rejected so the caller can keep it separate.
fn group_engine(node: Node) -> Option<Engine> {
    build_dfa_within(search_wrap(node), GROUP_DFA_CAP)
        .ok()
        .map(|dfa| Engine::new(EngineKind::Table(minimize(&dfa)), Vec::new()))
}

/// Folds each rule into the first group whose grown union still fits the cap.
///
/// What: tries appending the rule to each existing group node and keeps the first
/// union that builds under the cap; otherwise the rule opens a new group. Why: growing
/// a group lets `alt` share structure across members, so far more rules combine than a
/// pairwise test would admit.
fn grow_groups(nodes: Vec<Node>) -> Vec<Node> {
    let mut groups: Vec<Node> = Vec::new();
    'rule: for node in nodes {
        for group in &mut groups {
            let trial = alt(vec![group.clone(), node.clone()]);
            if build_dfa_within(search_wrap(trial.clone()), GROUP_DFA_CAP).is_ok() {
                *group = trial;
                continue 'rule;
            }
        }
        groups.push(node);
    }
    groups
}

/// Combines literal-free rule nodes into as few union DFAs as the cap allows.
///
/// What: greedily grows groups, then builds one Table engine per group. Why: the
/// literal-free rules dominate per-line cost, so fewer passes over them is the main
/// throughput lever.
///
/// @example
/// ```ignore
/// let engines = group_seedless(vec![parse("[0-9]{15,16}").unwrap()]);
/// assert_eq!(engines.len(), 1);
/// ```
pub(crate) fn group_seedless(nodes: Vec<Node>) -> Vec<Engine> {
    grow_groups(nodes).into_iter().filter_map(group_engine).collect()
}
