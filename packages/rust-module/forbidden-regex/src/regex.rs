//! Public API: a single-pattern `Regex` and a combined `RegexSet`.

/// Imports the serde derives for persisting compiled matchers.
use serde::{Deserialize, Serialize};

/// Imports the node algebra used by the rule sink's node lists.
use crate::ast::node::Node;

/// Imports the rule construction, the seedless fold, and the line-start matcher.
use crate::build::{
    BuiltRule, build_engine, build_rule, build_seedless_union, line_start_match,
};

/// Imports the seedless-rule grouping into union DFAs.
use crate::group::group_seedless;

/// Imports the counting NFA type for the seedless-union oracle.
use crate::counting::CountingNfa;

/// Imports the per-pattern back-end.
use crate::engine::Engine;

/// Imports the error type.
use crate::error::CompileError;

/// Imports the RegexSet-level combined literal prefilter.
use crate::gate::SetGate;

/// Imports the parser entry point.
use crate::parse::parse;

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
    /// Anchored DFAs for `^`-anchored rules, checked at every line start.
    line_start: Vec<Engine>,
    /// Rule ids paired with `line_start`, for rule-id attribution.
    line_start_ids: Vec<usize>,
    /// Ids of the literal-free rules, run against every line for rule-id attribution.
    seedless_ids: Vec<usize>,
    /// Union DFAs over groups of the literal-free rules, for the boolean fast path.
    seedless_groups: Vec<Engine>,
    /// Single counting automaton over the literal-free rules (CsA measurement path).
    ///
    /// What: one counting NFA over the alternation of every NFA-expressible seedless
    /// rule, `None` when a seedless rule needs the product back-end. Why: lets the
    /// bench measure one counting pass against the unrolled DFA groups, to see whether
    /// folding the literal-free rules into a single counting traversal beats them.
    seedless_union: Option<CountingNfa>,
    /// Combined required-literal gate over the seeded rules (never serialized).
    #[serde(skip)]
    gate: SetGate,
}

/// Accumulates the per-rule matching structures while a ruleset is compiled.
///
/// What: the parallel per-rule vectors plus the node lists for the seedless union DFAs
/// and the original-seedless oracle. Why: one sink keeps rule ids dense and aligned as
/// each built rule is recorded, shared by the strict and lenient builders.
#[derive(Default)]
struct RuleSink {
    /// Per-rule engines, indexed by rule id.
    rules: Vec<Engine>,
    /// Per-rule anchored DFA at a leading-seed hit, or `None`.
    anchored: Vec<Option<Engine>>,
    /// Anchored DFAs for `^`-anchored line-start rules.
    line_start: Vec<Engine>,
    /// Rule ids paired with `line_start`.
    line_start_ids: Vec<usize>,
    /// Ids of the truly-seedless rules (handled by the union DFAs).
    seedless_ids: Vec<usize>,
    /// Nodes of the truly-seedless rules, combined into union DFAs.
    seedless_nodes: Vec<Node>,
    /// Nodes seedless at the default floor, combined into the oracle counting union.
    reference_nodes: Vec<Node>,
}

/// Recording one built rule and finishing into a `RegexSet`.
impl RuleSink {
    /// Records a built rule, tracking its routing and oracle node by rule id.
    ///
    /// What: appends the engine and, by route, its anchored DFA, line-start DFA, or
    /// seedless id and node, plus the original-seedless node for the oracle. Why: one
    /// place keeps every parallel vector aligned with the rule id.
    fn push(&mut self, built: BuiltRule) {
        let id = self.rules.len();
        if built.seedless {
            self.seedless_ids.push(id);
            if let Some(node) = built.node {
                self.seedless_nodes.push(node);
            }
        }
        if let Some(engine) = built.routing.line_start {
            self.line_start.push(engine);
            self.line_start_ids.push(id);
        }
        if let Some(node) = built.reference_node {
            self.reference_nodes.push(node);
        }
        self.rules.push(built.engine);
        self.anchored.push(built.routing.anchored);
    }

    /// Assembles the accumulated rules into a prepared `RegexSet`.
    ///
    /// What: groups the truly-seedless nodes into union DFAs, builds the oracle
    /// counting union over the original-seedless nodes, stores everything, then builds
    /// the gate. Why: the one place that wires the matching structures together.
    fn assemble(self) -> RegexSet {
        let seedless_union = build_seedless_union(&self.reference_nodes);
        let mut set = RegexSet {
            rules: self.rules,
            anchored: self.anchored,
            line_start: self.line_start,
            line_start_ids: self.line_start_ids,
            seedless_ids: self.seedless_ids,
            seedless_groups: group_seedless(self.seedless_nodes),
            seedless_union,
            gate: SetGate::default(),
        };
        set.prepare();
        set
    }
}

/// Building, matching, and (de)serialization for a ruleset.
impl RegexSet {
    /// Compiles a slice of patterns into a `RegexSet`.
    ///
    /// What: builds a rule per pattern and one union automaton over the literal-free
    /// ones. Why: seeded rules are gated and literal-free rules share a single pass.
    pub fn new<S: AsRef<str>>(patterns: &[S]) -> Result<RegexSet, CompileError> {
        let mut sink = RuleSink::default();
        for pattern in patterns {
            sink.push(parse(pattern.as_ref()).and_then(build_rule)?);
        }
        Ok(sink.assemble())
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
        let mut sink = RuleSink::default();
        let mut kept: Vec<usize> = Vec::new();
        for (index, pattern) in patterns.iter().enumerate() {
            if let Ok(built) = parse(pattern.as_ref()).and_then(build_rule) {
                sink.push(built);
                kept.push(index);
            }
        }
        (sink.assemble(), kept)
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
    /// What: the one gate pass (seeded rules whose literal occurs, checked anchored or
    /// in full), the `^`-anchored rules checked at every line start, and any remaining
    /// truly-literal-free rules in a union pass. Why: the fold puts every rule in the
    /// gate or the cheap line-start check, so for the shipped ruleset there is one pass.
    pub fn is_match(&self, line: &[u8]) -> bool {
        if self
            .gate
            .any_candidate(line, |rule, pos| self.matches_rule(line, rule, pos))
        {
            return true;
        }
        if self.line_start.iter().any(|engine| line_start_match(engine, line)) {
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
    /// What: collects gate hits, then the `^`-anchored line-start hits, then any
    /// truly-literal-free hits. Why: each routing path attributes its own rule ids.
    pub fn matches(&self, line: &[u8]) -> impl Iterator<Item = usize> {
        let mut hits: Vec<usize> = Vec::new();
        self.gate.for_each_candidate(line, |rule, pos| {
            if self.matches_rule(line, rule, pos) {
                hits.push(rule);
            }
        });
        for (engine, &id) in self.line_start.iter().zip(&self.line_start_ids) {
            if line_start_match(engine, line) {
                hits.push(id);
            }
        }
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

    /// Profiling hook: runs only the single counting-union automaton.
    ///
    /// What: the one counting NFA over every seedless rule, skipping the gate and the
    /// unrolled DFA groups. Why: measures whether one counting pass over the
    /// literal-free rules beats the unrolled DFA groups it would replace.
    pub fn csa_only_is_match(&self, line: &[u8]) -> bool {
        self.seedless_union.as_ref().is_some_and(|nfa| nfa.is_match(line))
    }

    /// Returns the position count of the seedless counting union, or zero when absent.
    ///
    /// What: how many NFA positions the single counting pass carries. Why: a
    /// diagnostic for the per-byte cost of the counting union against the DFA groups.
    pub fn seedless_union_size(&self) -> usize {
        self.seedless_union.as_ref().map_or(0, |nfa| nfa.elements.len())
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
    /// combine; zero means every literal-free rule folded into the one gate pass.
    pub fn seedless_group_count(&self) -> usize {
        self.seedless_groups.len()
    }

    /// Returns how many `^`-anchored rules are checked at line starts.
    ///
    /// What: the line-start rule count. Why: a diagnostic for the fold, since these
    /// rules left the per-line scan for a cheap anchored check at line starts.
    pub fn line_start_count(&self) -> usize {
        self.line_start.len()
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
            .chain(set.line_start.iter_mut())
            .chain(set.anchored.iter_mut().flatten())
        {
            engine.validate()?;
            engine.prepare();
        }
        // What: validate the decoded counting union before it runs. Why: it is
        // executed against untrusted input like every other back-end.
        if let Some(nfa) = &set.seedless_union {
            nfa.validate()?;
        }
        // What: rebuild the combined gate from the prepared engines. Why: it is not
        // serialized, and the fast path depends on it.
        set.prepare();
        Ok(set)
    }
}
