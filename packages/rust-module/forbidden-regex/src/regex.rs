//! Public API: a single-pattern `Regex` and a combined `RegexSet`.

/// Imports the serde derives for persisting compiled matchers.
use serde::{Deserialize, Serialize};

/// Imports the node algebra and the constructor used to wrap for search.
use crate::ast::node::Node;

/// Imports the concat constructor used to wrap a node for search.
use crate::ast::smart::concat;

/// Imports the linearizer that selects the counting back-end.
use crate::counting::linearize;

/// Imports the DFA builder and minimizer for the general back-end.
use crate::dfa::{build_dfa, minimize};

/// Imports the per-pattern back-end selector.
use crate::engine::Engine;

/// Imports the error type.
use crate::error::CompileError;

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
/// What: takes the counting back-end when the node linearizes, otherwise builds the
/// minimized search DFA. Why: counting-heavy patterns stay small in the linear IR,
/// while alternation, intersection, and complement need the DFA.
fn build_engine(node: Node) -> Result<Engine, CompileError> {
    // What: a branch-free node becomes a counting program. Why: it avoids the
    // determinization blowup of bounded repetition.
    if let Some(program) = linearize(&node) {
        return Ok(Engine::Linear(program));
    }
    let dfa = minimize(&build_dfa(search_root(node))?);
    Ok(Engine::Table(dfa))
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
        let regex: Regex = bincode::deserialize(bytes).map_err(|e| CompileError::Invalid {
            message: e.to_string(),
        })?;
        regex.engine.validate()?;
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
}

/// Building, matching, and (de)serialization for a ruleset.
impl RegexSet {
    /// Compiles a slice of patterns into a `RegexSet`.
    ///
    /// What: parses every pattern and selects a back-end for each. Why: each rule
    /// keeps its own small matcher, preserving attribution.
    pub fn new<S: AsRef<str>>(patterns: &[S]) -> Result<RegexSet, CompileError> {
        let rules: Vec<Engine> = patterns
            .iter()
            .map(|p| parse(p.as_ref()).and_then(build_engine))
            .collect::<Result<_, _>>()?;
        Ok(RegexSet { rules })
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
    /// What: short-circuits over the per-rule engines. Why: the fast per-line check
    /// pays only until the first match.
    pub fn is_match(&self, line: &[u8]) -> bool {
        self.rules.iter().any(|engine| engine.is_match(line))
    }

    /// Returns the ids of the rules that match `line`.
    ///
    /// What: filters the per-rule engines by match. Why: reporting which rules hit
    /// is the attribution path.
    pub fn matches(&self, line: &[u8]) -> impl Iterator<Item = usize> {
        // What: eagerly collect ids then return an owning iterator. Why: avoids
        // borrowing `self`/`line` in the returned iterator.
        let hits: Vec<usize> = self
            .rules
            .iter()
            .enumerate()
            .filter(|(_, engine)| engine.is_match(line))
            .map(|(id, _)| id)
            .collect();
        hits.into_iter()
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
        let set: RegexSet = bincode::deserialize(bytes).map_err(|e| CompileError::Invalid {
            message: e.to_string(),
        })?;
        for engine in &set.rules {
            engine.validate()?;
        }
        Ok(set)
    }
}
