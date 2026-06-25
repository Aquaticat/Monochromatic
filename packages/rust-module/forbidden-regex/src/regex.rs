//! Public API: a single-pattern `Regex` and a combined `RegexSet`.

/// Imports the serde derives for persisting compiled matchers.
use serde::{Deserialize, Serialize};

/// Imports the node algebra and the constructor used to wrap for search.
use crate::ast::node::Node;

/// Imports the concat constructor used to wrap a node for search.
use crate::ast::smart::concat;

/// Imports the seedless-rule grouping into union DFAs.
use crate::group::group_seedless;

/// Imports the NFA builder that selects the counting back-end.
use crate::counting::build_nfa;

/// Imports the product builder that selects the `&`/`~` counting back-end.
use crate::counting::build_product;

/// Imports the node-based seed extractor and leading-seed probe.
use crate::counting::{leading_seeds, seeds_from_node};

/// Imports the DFA builder and minimizer for the general back-end.
use crate::dfa::{build_dfa_within, minimize};

/// Imports the per-pattern back-end and its kind.
use crate::engine::{Engine, EngineKind};

/// Imports the error type.
use crate::error::CompileError;

/// Imports the RegexSet-level combined literal prefilter.
use crate::gate::SetGate;

/// Imports the parser entry point.
use crate::parse::parse;

/// Wraps a pattern node for unanchored search.
///
/// What: prefixes the node with `Top` (sigma star), giving `Σ*·R`. Why: a nullable
/// residual of `Σ*·R` at any boundary means `R` matched some substring ending
/// there, which is exactly substring search; the counting back-end models the same
/// prefix itself, so it takes the bare node instead.
fn search_root(node: Node) -> Node {
    concat(vec![Node::Top, node])
}

/// Compiles one parsed node into the engine best suited to it.
///
/// What: a seedless rule runs against every line, so it gets the O(1)-per-byte DFA
/// (with no literal prefix its DFA is only linear in any repetition bound, never the
/// exponential overlap blowup); a seeded rule is gated and rarely matched, so it gets
/// the build-fast counting back-end. Why: fast where it matters, small where it must
/// be, both building quickly.
fn build_engine(node: Node) -> Result<Engine, CompileError> {
    let seeds = seeds_from_node(&node);
    let kind = if seeds.is_empty() {
        build_table_kind(node)?
    } else {
        build_counting_kind(node)?
    };
    Ok(Engine::new(kind, seeds))
}

/// Largest DFA the back-end selector makes before falling back to counting.
///
/// What: a state ceiling for a seedless rule's DFA and the seeded last resort. Why:
/// bounds build time against a pathological structure.
const ENGINE_DFA_CAP: usize = 20_000;

/// Largest repetition bound a non-anchorable seeded rule may carry and still be tried
/// as an eager DFA rather than the counting back-end.
///
/// What: a ceiling on any `{n,m}` bound for the DFA route. Why: the DFA blowup needs a
/// literal overlapping a long counted run, so a rule with only small repetitions (a
/// line-anchored marker alternation like `^(?:INF|PRO|...):`) builds a small fast DFA,
/// while a long-counted value pattern stays on the build-fast counting back-end.
const DFA_SAFE_MAX_REPEAT: usize = 3;

/// Returns the largest repetition bound anywhere in a node.
///
/// What: the maximum `Repeat.max` over the whole tree, or zero when there is none.
/// Why: it gauges whether an eager DFA could explode, deciding the back-end route.
fn max_repeat(node: &Node) -> usize {
    match node {
        Node::Repeat { node, max, .. } => (*max).max(max_repeat(node)),
        Node::Concat(parts) | Node::Alt(parts) | Node::Inter(parts) => {
            parts.iter().map(max_repeat).max().unwrap_or(0)
        }
        Node::Comp(inner) => max_repeat(inner),
        _ => 0,
    }
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
/// with them, else the full-cap DFA as a last resort. Why: these stay small where
/// the eager DFA explodes on bounded repetition.
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

/// A compiled single pattern.
///
/// What: wraps one back-end engine. Why: the reusable single-pattern face of the
/// engine, used directly and as each member of a `RegexSet`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Regex {
    /// The compiled back-end for this pattern.
    engine: Engine,
}

/// Matching and (de)serialization for a single pattern.
impl Regex {
    /// Reports whether the pattern matches some substring of `line`.
    ///
    /// What: delegates to the back-end. Why: the public, boolean match operation.
    pub fn is_match(&self, line: &[u8]) -> bool {
        self.engine.is_match(line)
    }

    /// Serializes the compiled pattern to bytes.
    ///
    /// What: bincode-encodes the engine. Why: lets a caller persist a built matcher
    /// and reload it without recompiling.
    pub fn to_bytes(&self) -> Result<Vec<u8>, CompileError> {
        bincode::serialize(self).map_err(|e| CompileError::Serialize {
            message: e.to_string(),
        })
    }

    /// Loads a compiled pattern from bytes, validating it first.
    ///
    /// What: decodes then runs structural validation. Why: a decoded engine is
    /// executed against untrusted input, so it must be proven in-bounds first.
    pub fn from_bytes(bytes: &[u8]) -> Result<Regex, CompileError> {
        let mut regex: Regex = bincode::deserialize(bytes).map_err(|e| CompileError::Invalid {
            message: e.to_string(),
        })?;
        regex.engine.validate()?;
        // What: rebuild the prefilter from the validated graph. Why: it is not
        // serialized, and matching depends on it.
        regex.engine.prepare();
        Ok(regex)
    }
}

/// Compiles one pattern into a `Regex`.
///
/// What: parses then selects a back-end. Why: the primary entry for a single rule.
pub fn compile(pattern: &str) -> Result<Regex, CompileError> {
    let node = parse(pattern)?;
    Ok(Regex {
        engine: build_engine(node)?,
    })
}

/// A whole ruleset compiled into one matcher per rule.
///
/// What: one back-end engine per rule, in rule-id order. Why: each rule is matched
/// on its own small engine; combining them into a single gate without reintroducing
/// the counting blowup is a later step, so the set iterates its rules for now.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegexSet {
    /// Per-rule substring engines, indexed by rule id.
    rules: Vec<Engine>,
    /// Per-rule anchored DFA, when the seed is the rule's leading literal, else `None`.
    anchored: Vec<Option<Engine>>,
    /// Ids of the literal-free rules, run against every line for rule-id attribution.
    seedless_ids: Vec<usize>,
    /// Union DFAs over groups of the literal-free rules, for the boolean fast path.
    seedless_groups: Vec<Engine>,
    /// Combined required-literal gate over the seeded rules (never serialized).
    #[serde(skip)]
    gate: SetGate,
}

/// One compiled rule plus whether it is literal-free.
///
/// What: the engine, a flag for whether it has no required literal, and the node kept
/// for grouping when it is literal-free. Why: the builders share the per-rule work,
/// and the seedless nodes are combined into union DFAs afterward.
struct BuiltRule {
    /// The compiled per-rule engine.
    engine: Engine,
    /// Whether the rule has no required-literal prefilter.
    seedless: bool,
    /// Parsed node, kept only for a seedless rule so it can join a union DFA.
    node: Option<Node>,
    /// Anchored DFA engine, when the seed is the rule's leading literal.
    anchored: Option<Engine>,
}

/// Compiles one parsed node into a rule, choosing seeds that maximize anchorability.
///
/// What: gates on the leading literal when it is selective enough (so the rule gets a
/// fast anchored DFA checked at the hit), else on the most selective literal anywhere
/// (with a counting substring engine); a literal-free rule routes to the union DFA.
/// Why: anchoring at the hit replaces the slow per-rule counting scan that real code
/// triggers on every keyword hit, and gating on the leading literal is what makes it
/// sound (every match begins there).
fn build_rule(node: Node) -> Result<BuiltRule, CompileError> {
    let leading = leading_seeds(&node);
    let anchorable = !leading.is_empty();
    let seeds = if anchorable { leading } else { seeds_from_node(&node) };
    let seedless = seeds.is_empty();
    let anchored = if anchorable { anchored_engine(&node) } else { None };
    // A seedless rule, or a non-anchorable seeded rule with only small repetitions
    // (a line-anchored marker alternation), takes the fast eager DFA; everything else
    // takes the build-fast counting back-end.
    let dfa_route = seedless || (!anchorable && max_repeat(&node) <= DFA_SAFE_MAX_REPEAT);
    let kind = if dfa_route {
        build_table_kind(node.clone())?
    } else {
        build_counting_kind(node.clone())?
    };
    Ok(BuiltRule {
        engine: Engine::new(kind, seeds),
        seedless,
        node: if seedless { Some(node) } else { None },
        anchored,
    })
}

/// Records a built rule, tracking the literal-free ones and their nodes.
///
/// What: appends the engine and, when seedless, its id and node. Why: shared by the
/// strict and lenient builders; seedless rules run against every line and are grouped.
fn push_rule(
    built: BuiltRule,
    rules: &mut Vec<Engine>,
    seedless_ids: &mut Vec<usize>,
    seedless_nodes: &mut Vec<Node>,
    anchored: &mut Vec<Option<Engine>>,
) {
    if built.seedless {
        seedless_ids.push(rules.len());
        if let Some(node) = built.node {
            seedless_nodes.push(node);
        }
    }
    rules.push(built.engine);
    anchored.push(built.anchored);
}

/// Assembles a `RegexSet` from its rules, the literal-free ids, and their nodes.
///
/// What: groups the seedless nodes into union DFAs, stores everything, then builds the
/// gate. Why: the one place that wires the matching structures together.
fn assemble(
    rules: Vec<Engine>,
    anchored: Vec<Option<Engine>>,
    seedless_ids: Vec<usize>,
    seedless_nodes: Vec<Node>,
) -> RegexSet {
    let mut set = RegexSet {
        rules,
        anchored,
        seedless_ids,
        seedless_groups: group_seedless(seedless_nodes),
        gate: SetGate::default(),
    };
    set.prepare();
    set
}

/// Building, matching, and (de)serialization for a ruleset.
impl RegexSet {
    /// Compiles a slice of patterns into a `RegexSet`.
    ///
    /// What: builds a rule per pattern and one union automaton over the literal-free
    /// ones. Why: seeded rules are gated and literal-free rules share a single pass.
    pub fn new<S: AsRef<str>>(patterns: &[S]) -> Result<RegexSet, CompileError> {
        let mut rules: Vec<Engine> = Vec::new();
        let mut seedless_ids: Vec<usize> = Vec::new();
        let mut seedless_nodes: Vec<Node> = Vec::new();
        let mut anchored: Vec<Option<Engine>> = Vec::new();
        for pattern in patterns {
            let built = parse(pattern.as_ref()).and_then(build_rule)?;
            push_rule(built, &mut rules, &mut seedless_ids, &mut seedless_nodes, &mut anchored);
        }
        Ok(assemble(rules, anchored, seedless_ids, seedless_nodes))
    }

    /// Rebuilds the combined required-literal gate from the seeded rules' seeds.
    ///
    /// What: collects each rule's seeds and builds the set-level matcher. Why: the
    /// gate is not serialized, so it is rebuilt after both compilation and decode.
    fn prepare(&mut self) {
        let per_rule: Vec<Option<Vec<Vec<u8>>>> = self.rules.iter().map(Engine::seeds).collect();
        self.gate = SetGate::build(&per_rule);
    }

    /// Compiles patterns, skipping any that fail, with the kept input indices.
    ///
    /// What: builds a rule per pattern, dropping ones that do not compile, plus the
    /// union automaton; returns the set and the kept original indices. Why: a real
    /// ruleset has rules this dialect cannot express, so the rest are kept in one pass.
    pub fn compile_lenient<S: AsRef<str>>(patterns: &[S]) -> (RegexSet, Vec<usize>) {
        let mut rules: Vec<Engine> = Vec::new();
        let mut seedless_ids: Vec<usize> = Vec::new();
        let mut seedless_nodes: Vec<Node> = Vec::new();
        let mut anchored: Vec<Option<Engine>> = Vec::new();
        let mut kept: Vec<usize> = Vec::new();
        for (index, pattern) in patterns.iter().enumerate() {
            if let Ok(built) = parse(pattern.as_ref()).and_then(build_rule) {
                push_rule(built, &mut rules, &mut seedless_ids, &mut seedless_nodes, &mut anchored);
                kept.push(index);
            }
        }
        (assemble(rules, anchored, seedless_ids, seedless_nodes), kept)
    }

    /// Compiles a ruleset from one text, split on a delimiter.
    ///
    /// What: splits `text` on `delimiter`, trims each rule, drops empties, and
    /// delegates to `new`. Why: a convenience for a file format whose rule boundary
    /// is a non-whitespace marker the caller chooses.
    pub fn from_ruleset(text: &str, delimiter: &str) -> Result<RegexSet, CompileError> {
        let parts: Vec<&str> = text
            .split(delimiter)
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .collect();
        RegexSet::new(&parts)
    }

    /// Reports whether any rule matches a substring of `line`.
    ///
    /// What: checks the seeded rules whose literal occurs (via the gate), then the
    /// literal-free rules in one union pass (or individually if there is no union).
    /// Why: a non-matching line costs one gate pass plus one union pass.
    pub fn is_match(&self, line: &[u8]) -> bool {
        if self
            .gate
            .any_candidate(line, |rule, pos| self.matches_rule(line, rule, pos))
        {
            return true;
        }
        self.seedless_groups.iter().any(|group| group.is_match(line))
    }

    /// Checks one seeded rule against `line`, anchored at `pos` when possible.
    ///
    /// What: runs the rule's anchored DFA over `line[pos..]` when the seed is the
    /// rule's leading literal, else the whole-line substring engine. Why: anchoring at
    /// the seed hit replaces the slow per-rule counting scan with one small linear DFA.
    fn matches_rule(&self, line: &[u8], rule: usize, pos: usize) -> bool {
        match &self.anchored[rule] {
            Some(engine) => engine.is_match(&line[pos..]),
            None => self.rules[rule].is_match(line),
        }
    }

    /// Returns the ids of the rules that match `line`.
    ///
    /// What: collects seeded hits via the gate, then the literal-free hits by running
    /// each seedless engine. Why: seedless rules have no literal to gate on, so they
    /// are checked directly.
    pub fn matches(&self, line: &[u8]) -> impl Iterator<Item = usize> {
        let mut hits: Vec<usize> = Vec::new();
        self.gate.for_each_candidate(line, |rule, pos| {
            if self.matches_rule(line, rule, pos) {
                hits.push(rule);
            }
        });
        for &id in &self.seedless_ids {
            if self.rules[id].is_match(line) {
                hits.push(id);
            }
        }
        hits.sort_unstable();
        hits.dedup();
        hits.into_iter()
    }

    /// Profiling hook: runs only the seeded-rule gate path.
    ///
    /// What: the gate candidates, skipping the literal-free rules. Why: lets the
    /// bench split per-line time between the gate and the literal-free scans.
    pub fn gate_only_is_match(&self, line: &[u8]) -> bool {
        self.gate
            .any_candidate(line, |rule, pos| self.matches_rule(line, rule, pos))
    }

    /// Profiling hook: runs only the seeded-literal prefilter, no fallback.
    ///
    /// What: the gate's prefilter presence test alone. Why: separates the prefilter's
    /// cost from the per-rule counting fallback it triggers on a hit.
    pub fn prefilter_only_is_match(&self, line: &[u8]) -> bool {
        self.gate.prefilter_present(line)
    }

    /// Profiling hook: prefilter plus aho-corasick enumeration, no per-rule check.
    ///
    /// What: the gate path with the per-rule predicate stubbed to never match. Why:
    /// isolates the which-rule enumeration cost from the per-rule counting cost.
    pub fn candidates_only_is_match(&self, line: &[u8]) -> bool {
        self.gate.any_candidate(line, |_rule, _pos| false)
    }

    /// Profiling hook: the gate path but skipping rules without an anchored DFA.
    ///
    /// What: runs only anchored per-rule checks, treating counting-fallback rules as
    /// non-matching. Why: isolates the anchored-check cost from the slow counting
    /// fallback, to see which dominates the gate.
    pub fn gate_anchored_only_is_match(&self, line: &[u8]) -> bool {
        self.gate.any_candidate(line, |rule, pos| match &self.anchored[rule] {
            Some(engine) => engine.is_match(&line[pos..]),
            None => false,
        })
    }

    /// Profiling hook: runs only the literal-free group DFAs.
    ///
    /// What: the seedless union engines, skipping the gate. Why: the other half of the
    /// per-line time split.
    pub fn seedless_only_is_match(&self, line: &[u8]) -> bool {
        self.seedless_groups.iter().any(|group| group.is_match(line))
    }

    /// Returns how many seeded rules have an anchored DFA fast-check.
    ///
    /// What: the count of rules whose seed is their leading literal. Why: a diagnostic
    /// for how much of the gate fallback avoids the slow counting scan.
    pub fn anchored_count(&self) -> usize {
        self.anchored.iter().filter(|engine| engine.is_some()).count()
    }

    /// Returns how many union DFAs the seedless rules collapsed into.
    ///
    /// What: the group count. Why: a diagnostic for how well the literal-free rules
    /// combine; one group means a single pass like regex's combined automaton.
    pub fn seedless_group_count(&self) -> usize {
        self.seedless_groups.len()
    }

    /// Returns how many rules have no required-literal prefilter.
    ///
    /// What: counts engines whose seed set is empty. Why: a diagnostic for tuning
    /// the prefilter, since seedless rules run against every line.
    pub fn seedless_count(&self) -> usize {
        self.rules.iter().filter(|engine| engine.seeds().is_none()).count()
    }

    /// Returns the number of rules.
    ///
    /// What: the rule count. Why: callers index `matches` results against rules.
    pub fn len(&self) -> usize {
        self.rules.len()
    }

    /// Reports whether the set has no rules.
    ///
    /// What: rule count is zero. Why: the conventional companion to `len`.
    pub fn is_empty(&self) -> bool {
        self.rules.is_empty()
    }

    /// Serializes the compiled ruleset to bytes.
    ///
    /// What: bincode-encodes every rule engine. Why: the pre-serialized form the
    /// throughput benchmark loads.
    pub fn to_bytes(&self) -> Result<Vec<u8>, CompileError> {
        bincode::serialize(self).map_err(|e| CompileError::Serialize {
            message: e.to_string(),
        })
    }

    /// Loads a compiled ruleset from bytes, validating every engine.
    ///
    /// What: decodes then validates each rule engine. Why: every engine is
    /// executed, so all must be proven in-bounds before use.
    pub fn from_bytes(bytes: &[u8]) -> Result<RegexSet, CompileError> {
        let mut set: RegexSet = bincode::deserialize(bytes).map_err(|e| CompileError::Invalid {
            message: e.to_string(),
        })?;
        // What: validate the decoded graph, then rebuild its runtime prefilter. Why:
        // both must happen before any engine runs on untrusted input.
        for engine in set
            .rules
            .iter_mut()
            .chain(set.seedless_groups.iter_mut())
            .chain(set.anchored.iter_mut().flatten())
        {
            engine.validate()?;
            engine.prepare();
        }
        // What: rebuild the combined gate from the prepared engines. Why: it is not
        // serialized, and the fast path depends on it.
        set.prepare();
        Ok(set)
    }
}
