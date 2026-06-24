//! Public API: a single-pattern `Regex` and a combined `RegexSet`.

/// Imports the serde derives for persisting compiled matchers.
use serde::{Deserialize, Serialize};

/// Imports the node algebra and the constructor used to wrap for search.
use crate::ast::node::Node;

/// Imports the concat constructor used to wrap a node for search.
use crate::ast::smart::concat;

/// Imports the NFA builder that selects the counting back-end.
use crate::counting::build_nfa;

/// Imports the product builder that selects the `&`/`~` counting back-end.
use crate::counting::build_product;

/// Imports the node-based required-literal seed extractor.
use crate::counting::seeds_from_node;

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
    /// Per-rule engines, indexed by rule id.
    rules: Vec<Engine>,
    /// Ids of the literal-free rules, run against every line.
    seedless_ids: Vec<usize>,
    /// Combined required-literal gate over the seeded rules (never serialized).
    #[serde(skip)]
    gate: SetGate,
}

/// One compiled rule plus whether it is literal-free.
///
/// What: the engine and a flag for whether it has no required literal. Why: the
/// builders share the per-rule work, varying only in error handling.
struct BuiltRule {
    /// The compiled per-rule engine.
    engine: Engine,
    /// Whether the rule has no required-literal prefilter.
    seedless: bool,
}

/// Compiles one parsed node into a rule, noting whether it is literal-free.
///
/// What: extracts seeds and builds the engine (DFA when seedless, counting when
/// seeded). Why: a literal-free rule must run against every line, so the caller
/// records it; the split matches `build_engine`.
fn build_rule(node: Node) -> Result<BuiltRule, CompileError> {
    let seeds = seeds_from_node(&node);
    let seedless = seeds.is_empty();
    let kind = if seedless {
        build_table_kind(node)?
    } else {
        build_counting_kind(node)?
    };
    Ok(BuiltRule {
        engine: Engine::new(kind, seeds),
        seedless,
    })
}

/// Records a built rule, tracking the literal-free ones.
///
/// What: appends the engine and, when seedless, its id. Why: shared by the strict
/// and lenient builders; seedless rules run against every line.
fn push_rule(built: BuiltRule, rules: &mut Vec<Engine>, seedless_ids: &mut Vec<usize>) {
    if built.seedless {
        seedless_ids.push(rules.len());
    }
    rules.push(built.engine);
}

/// Assembles a `RegexSet` from its rules and the literal-free id list.
///
/// What: stores both then builds the gate. Why: the one place that wires the
/// matching structures together.
fn assemble(rules: Vec<Engine>, seedless_ids: Vec<usize>) -> RegexSet {
    let mut set = RegexSet {
        rules,
        seedless_ids,
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
        for pattern in patterns {
            let built = parse(pattern.as_ref()).and_then(build_rule)?;
            push_rule(built, &mut rules, &mut seedless_ids);
        }
        Ok(assemble(rules, seedless_ids))
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
        let mut kept: Vec<usize> = Vec::new();
        for (index, pattern) in patterns.iter().enumerate() {
            if let Ok(built) = parse(pattern.as_ref()).and_then(build_rule) {
                push_rule(built, &mut rules, &mut seedless_ids);
                kept.push(index);
            }
        }
        (assemble(rules, seedless_ids), kept)
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
            .any_candidate(line, |rule| self.rules[rule].is_match(line))
        {
            return true;
        }
        self.seedless_ids.iter().any(|&id| self.rules[id].is_match(line))
    }

    /// Returns the ids of the rules that match `line`.
    ///
    /// What: collects seeded hits via the gate, then the literal-free hits by running
    /// each seedless engine. Why: seedless rules have no literal to gate on, so they
    /// are checked directly.
    pub fn matches(&self, line: &[u8]) -> impl Iterator<Item = usize> {
        let mut hits: Vec<usize> = Vec::new();
        self.gate.for_each_candidate(line, |rule| {
            if self.rules[rule].is_match(line) {
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
        for engine in &mut set.rules {
            engine.validate()?;
            engine.prepare();
        }
        // What: rebuild the combined gate from the prepared engines. Why: it is not
        // serialized, and the fast path depends on it.
        set.prepare();
        Ok(set)
    }
}
