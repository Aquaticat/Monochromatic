//! Per-rule back-end selection and the seedless-rule fold into the gate.
//!
//! What: turns a parsed node into a [`BuiltRule`] (its engine plus how it is matched:
//! gate seeds, an anchored DFA at the hit, or a line-start check), and provides the
//! single-pattern engine builder, the oracle counting union, and the line-start
//! matcher. Why: keeping the construction logic here keeps the public-API module within
//! its line budget, and the fold is the lever that puts every rule in one pass.

/// Imports the node algebra the builders read.
use crate::ast::node::Node;

/// Imports the alternation and concatenation constructors.
use crate::ast::smart::{alt, concat};

/// Imports the NFA, product, and counting-NFA types for the back-end selection.
use crate::counting::{CountingNfa, build_nfa, build_product};

/// Imports the seed extractors and leading-seed probes (default and weak floors).
use crate::counting::{leading_seeds, leading_seeds_min, seeds_from_node, seeds_from_node_min};

/// Imports the DFA builder and minimizer for the general back-end.
use crate::dfa::{build_dfa_within, minimize};

/// Imports the per-pattern back-end and its kind.
use crate::engine::{Engine, EngineKind};

/// Imports the error type.
use crate::error::CompileError;

/// Largest DFA the back-end selector makes before falling back to counting.
///
/// What: a state ceiling for a seedless rule's DFA and the seeded last resort. Why:
/// bounds build time against a pathological structure.
const ENGINE_DFA_CAP: usize = 20_000;

/// Shortest leading literal the fold will gate an otherwise-seedless rule on.
///
/// What: a two-byte floor for a weak LEADING seed (anchored at the hit). Why: a rule
/// seedless at [`crate::counting`]'s default floor would otherwise need a second
/// per-line pass; a two-byte leading literal (`SK`, `s.`) gates it into the one gate
/// pass with a cheap anchored check that dies fast on the non-matches it over-flags.
const WEAK_LEADING_SEED_LEN: usize = 2;

/// Shortest inner required literal the fold will gate an otherwise-seedless rule on.
///
/// What: a one-byte floor for a weak INNER seed (the full engine runs on a hit). Why:
/// facebook's only required literal is the one-byte alternation `|`/`%`, which is rare
/// enough in code to gate on; folding it in deletes the last second-pass rule. A
/// common one-byte seed would over-flag, but only a rule with no longer literal and no
/// line anchor reaches here, and even then the gate is no worse than a second pass.
const WEAK_INNER_SEED_LEN: usize = 1;

/// Wraps a pattern node for unanchored search.
///
/// What: prefixes the node with `Top` (sigma star), giving `Σ*·R`. Why: a nullable
/// residual of `Σ*·R` at any boundary means `R` matched some substring ending there,
/// which is exactly substring search; the counting back-end models the prefix itself.
fn search_root(node: Node) -> Node {
    concat(vec![Node::Top, node])
}

/// Builds a bare anchored DFA engine for a rule, or `None` past the cap.
///
/// What: determinizes the node with no `Σ*` prefix and minimizes it. Why: anchored
/// there is no overlap blowup, so even a literal-plus-counted rule (and `&`/`~`) is a
/// small linear DFA the gate runs at the hit position, replacing the slow per-rule
/// counting scan that real code triggers on every keyword hit.
fn anchored_engine(node: &Node) -> Option<Engine> {
    build_dfa_within(node.clone(), ENGINE_DFA_CAP)
        .ok()
        .map(|dfa| Engine::new(EngineKind::Table(minimize(&dfa)), Vec::new()))
}

/// Builds the eager-DFA back-end for a seedless node, or counting on overrun.
///
/// What: determinizes under the cap; on a cap overrun falls back to counting. Why:
/// seedless rules want the fast DFA, but a rare overrun must still be representable.
fn build_table_kind(node: Node) -> Result<EngineKind, CompileError> {
    match build_dfa_within(search_root(node.clone()), ENGINE_DFA_CAP) {
        Ok(dfa) => Ok(EngineKind::Table(minimize(&dfa))),
        Err(CompileError::StateCap { .. }) => build_counting_kind(node),
        Err(other) => Err(other),
    }
}

/// Builds a counting back-end for a node.
///
/// What: a counting NFA for a node without `&`/`~`, a synchronized product for one
/// with them, else the full-cap DFA as a last resort. Why: these stay small where the
/// eager DFA explodes on bounded repetition.
fn build_counting_kind(node: Node) -> Result<EngineKind, CompileError> {
    if let Some(nfa) = build_nfa(&node) {
        return Ok(EngineKind::Nfa(nfa));
    }
    if let Some(program) = build_product(&node) {
        return Ok(EngineKind::Product(program));
    }
    // What: a capped DFA as the last resort. Why: nothing else expressed this node,
    // and a capped build fails fast (the rule is dropped) rather than grinding.
    Ok(EngineKind::Table(minimize(&build_dfa_within(
        search_root(node),
        ENGINE_DFA_CAP,
    )?)))
}

/// Compiles one parsed node into the engine best suited to it.
///
/// What: a seedless rule gets the O(1)-per-byte DFA (no literal prefix, so only linear
/// in any repetition bound), a seeded rule the build-fast counting back-end. Why: fast
/// where it matters, small where it must be, both building quickly.
pub(crate) fn build_engine(node: Node) -> Result<Engine, CompileError> {
    let seeds = seeds_from_node(&node);
    let kind = if seeds.is_empty() {
        build_table_kind(node)?
    } else {
        build_counting_kind(node)?
    };
    Ok(Engine::new(kind, seeds))
}

/// How a rule is matched after the fold: gated, anchored at the hit, or line-start.
///
/// What: the seeds the gate prefilters on (empty for a line-start or truly-seedless
/// rule), an optional anchored DFA run at the hit, and an optional line-start DFA run
/// at every line start. Why: every rule should ride the one gate pass, so the fold
/// chooses, per rule, the cheapest sound way to fit it there.
pub(crate) struct Routing {
    /// Required-literal seeds the gate prefilters and attributes on; empty when none.
    pub(crate) seeds: Vec<Vec<u8>>,
    /// Anchored DFA run at a leading-seed hit, when the rule has a leading literal.
    pub(crate) anchored: Option<Engine>,
    /// Anchored DFA run at every line start, for a `^`-anchored otherwise-seedless rule.
    pub(crate) line_start: Option<Engine>,
}

/// One compiled rule plus how it is matched.
///
/// What: the engine, its routing (seeds / anchored / line-start), whether it is still
/// truly literal-free, and the node kept for a literal-free rule (to join a union DFA)
/// or for the original-seedless oracle. Why: the sink records each by rule id; the
/// truly-seedless nodes form union DFAs, the original-seedless nodes the oracle union.
pub(crate) struct BuiltRule {
    /// The compiled per-rule engine.
    pub(crate) engine: Engine,
    /// How the rule is matched after the fold.
    pub(crate) routing: Routing,
    /// Whether the rule still has no usable filter (gate, anchor, nor line-start).
    pub(crate) seedless: bool,
    /// Parsed node, kept for a truly-seedless rule so it can join a union DFA.
    pub(crate) node: Option<Node>,
    /// Parsed node, kept for any rule seedless at the default floor, for the oracle.
    pub(crate) reference_node: Option<Node>,
}

/// Reports whether a node can match only at a line start (`^` at its head).
///
/// What: true when the node is a concatenation whose first factor is `^`. Why: such a
/// rule's matches all begin at a line start, so it is checked there instead of by a
/// per-line substring scan.
fn starts_with_line_anchor(node: &Node) -> bool {
    matches!(node, Node::Concat(parts) if parts.first() == Some(&Node::LineStart))
}

/// Routes a rule seedless at the default floor onto a weak seed.
///
/// What: gate on a weak leading literal (anchored at the hit) when present, else on
/// any weak inner required literal (the full engine runs on a hit). Why: a second
/// per-line pass caps the combined rate below regex, so every literal-free rule is
/// folded into the gate; each route is sound because the seed is a required literal.
fn fold_seedless(node: &Node) -> Routing {
    let weak_leading = leading_seeds_min(node, WEAK_LEADING_SEED_LEN);
    if !weak_leading.is_empty() {
        return Routing {
            anchored: anchored_engine(node),
            seeds: weak_leading,
            line_start: None,
        };
    }
    Routing {
        seeds: seeds_from_node_min(node, WEAK_INNER_SEED_LEN),
        anchored: None,
        line_start: None,
    }
}

/// Chooses how a rule is matched: line-start, default seeds, else the seedless fold.
///
/// What: a `^`-anchored rule is checked at line starts (off the gate entirely); else
/// gate on the leading literal when selective (anchored at the hit), else on the best
/// inner literal, else the seedless fold. Why: a marker rule's common short codes make
/// terrible gate seeds, but it matches only at line starts, so a cheap pos-zero check
/// beats flagging it as a substring; anchoring at the hit replaces the slow counting
/// scan, and folding deletes the second per-line pass.
fn route_rule(node: &Node) -> Routing {
    if starts_with_line_anchor(node) {
        return Routing {
            seeds: Vec::new(),
            anchored: None,
            line_start: anchored_engine(node),
        };
    }
    let leading = leading_seeds(node);
    if !leading.is_empty() {
        return Routing {
            anchored: anchored_engine(node),
            seeds: leading,
            line_start: None,
        };
    }
    let seeds = seeds_from_node(node);
    if !seeds.is_empty() {
        return Routing {
            seeds,
            anchored: None,
            line_start: None,
        };
    }
    fold_seedless(node)
}

/// Compiles one parsed node into a rule, folding literal-free rules into the gate.
///
/// What: routes the rule (default seeds, anchored, line-start, or last-resort
/// seedless), then builds the back-end best suited to it. Why: a literal-free rule
/// that cannot be folded still falls back to a union DFA, but the fold keeps that set
/// empty for this ruleset so there is one pass.
pub(crate) fn build_rule(node: Node) -> Result<BuiltRule, CompileError> {
    let was_seedless = leading_seeds(&node).is_empty() && seeds_from_node(&node).is_empty();
    let routing = route_rule(&node);
    let anchorable = routing.anchored.is_some();
    let seedless = routing.seeds.is_empty() && routing.line_start.is_none();
    // An anchorable rule matches via its anchored DFA at the hit, so its own engine is
    // unused and takes the build-fast counting back-end. A non-anchorable rule's engine
    // IS its matcher, run over the whole line on every hit, so it takes the eager DFA
    // for a fast per-byte check; `build_table_kind` falls back to counting if the DFA
    // would explode. This keeps the inner-keyword rules off the slow counting scan they
    // pay on common-keyword hits.
    let kind = if anchorable {
        build_counting_kind(node.clone())?
    } else {
        build_table_kind(node.clone())?
    };
    Ok(BuiltRule {
        engine: Engine::new(kind, routing.seeds.clone()),
        routing,
        seedless,
        node: if seedless { Some(node.clone()) } else { None },
        reference_node: if was_seedless { Some(node) } else { None },
    })
}

/// Builds one counting automaton over every NFA-expressible seedless rule.
///
/// What: the counting NFA of the alternation of the seedless nodes, or `None` when
/// there are none or any needs the product back-end. Why: the oracle the bench checks
/// the folded `is_match` against (no literal-free rule's match may be missed).
pub(crate) fn build_seedless_union(nodes: &[Node]) -> Option<CountingNfa> {
    if nodes.is_empty() {
        return None;
    }
    build_nfa(&alt(nodes.to_vec()))
}

/// Reports whether a `^`-anchored engine matches at the start of `line`.
///
/// What: runs the bare anchored DFA, which matches only a prefix beginning at a line
/// start. Why: the engine's contract is one line per call, so `^` is position zero;
/// the anchored DFA dies on the first non-matching byte, making this an O(1) check on
/// almost every line instead of the whole-line newline scan a multi-line search needs.
pub(crate) fn line_start_match(engine: &Engine, line: &[u8]) -> bool {
    engine.is_match(line)
}
