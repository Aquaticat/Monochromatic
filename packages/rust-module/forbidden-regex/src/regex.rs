//! Public API: a single-pattern `Regex` and a combined `RegexSet`.

/// Imports the serde derives for persisting compiled automata.
use serde::{Deserialize, Serialize};

/// Imports the node algebra and the constructors used to wrap for search.
use crate::ast::node::Node;

/// Imports the concat constructor used to wrap a node for search.
use crate::ast::smart::concat;

/// Imports the DFA builder, minimizer, and union.
use crate::dfa::{build_dfa, minimize, union};

/// Imports the compiled table type.
use crate::dfa::table::Dfa;

/// Imports the error type.
use crate::error::CompileError;

/// Imports the parser entry point.
use crate::parse::parse;

/// Wraps a pattern node for unanchored search.
///
/// What: prefixes the node with `Top` (sigma star), giving `Σ*·R`. Why: a
/// nullable residual of `Σ*·R` at any boundary means `R` matched some substring
/// ending there, which is exactly substring search.
fn search_root(node: Node) -> Node {
    concat(vec![Node::Top, node])
}

/// A compiled single pattern.
///
/// What: wraps one search DFA. Why: the reusable single-pattern face of the
/// engine, used directly and as each member of a `RegexSet`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Regex {
    /// The unanchored-search automaton for this pattern.
    dfa: Dfa,
}

/// Matching and (de)serialization for a single pattern.
impl Regex {
    /// Reports whether the pattern matches some substring of `line`.
    ///
    /// What: delegates to the DFA. Why: the public, boolean match operation.
    pub fn is_match(&self, line: &[u8]) -> bool {
        self.dfa.is_match(line)
    }

    /// Serializes the compiled pattern to bytes.
    ///
    /// What: bincode-encodes the automaton. Why: lets a caller persist a built
    /// matcher and reload it without recompiling.
    pub fn to_bytes(&self) -> Result<Vec<u8>, CompileError> {
        bincode::serialize(self).map_err(|e| CompileError::Serialize {
            message: e.to_string(),
        })
    }

    /// Loads a compiled pattern from bytes, validating it first.
    ///
    /// What: decodes then runs structural validation. Why: a decoded automaton is
    /// executed against untrusted input, so it must be proven in-bounds first.
    pub fn from_bytes(bytes: &[u8]) -> Result<Regex, CompileError> {
        let regex: Regex = bincode::deserialize(bytes).map_err(|e| CompileError::Invalid {
            message: e.to_string(),
        })?;
        regex.dfa.validate()?;
        Ok(regex)
    }
}

/// Compiles one pattern into a `Regex`.
///
/// What: parses, wraps for search, and determinizes. Why: the primary entry for
/// a single rule.
pub fn compile(pattern: &str) -> Result<Regex, CompileError> {
    let node = parse(pattern)?;
    let dfa = minimize(&build_dfa(search_root(node))?);
    Ok(Regex { dfa })
}

/// A whole ruleset compiled into one fast gate plus per-rule automata.
///
/// What: `gate` is the union search DFA (any rule matches?), `rules` are the
/// per-rule DFAs used to report which rules hit. Why: the gate gives a single
/// fast pass per line, and the per-rule DFAs recover rule identity only when the
/// gate fires.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegexSet {
    /// Union automaton answering "does any rule match?".
    gate: Dfa,
    /// Per-rule automata, indexed by rule id.
    rules: Vec<Dfa>,
}

/// Building, matching, and (de)serialization for a ruleset.
impl RegexSet {
    /// Compiles a slice of patterns into a `RegexSet`.
    ///
    /// What: parses every pattern, builds a per-rule DFA for each and a union
    /// gate over all of them. Why: the gate accelerates the common no-match case
    /// while the per-rule DFAs preserve attribution.
    pub fn new<S: AsRef<str>>(patterns: &[S]) -> Result<RegexSet, CompileError> {
        // What: parse each pattern to a node. Why: both the per-rule DFAs and the
        // union gate are built from these.
        let nodes: Vec<Node> = patterns
            .iter()
            .map(|p| parse(p.as_ref()))
            .collect::<Result<_, _>>()?;
        // What: one minimized search DFA per rule. Why: small minimal components
        // keep the union product to its reachable (roughly additive) states.
        let rules: Vec<Dfa> = nodes
            .into_iter()
            .map(|n| build_dfa(search_root(n)).map(|dfa| minimize(&dfa)))
            .collect::<Result<_, _>>()?;
        // What: union the per-rule DFAs, then minimize the gate. Why: one fast
        // single-pass automaton answering "does any rule match?".
        let gate = minimize(&union(&rules));
        Ok(RegexSet { gate, rules })
    }

    /// Compiles a ruleset from one text, split on a delimiter.
    ///
    /// What: splits `text` on `delimiter`, trims each rule, drops empties, and
    /// delegates to `new`. Why: a convenience for a file format whose rule
    /// boundary is a non-whitespace marker the caller chooses.
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
    /// What: a single pass over the union gate. Why: the fast per-line check.
    pub fn is_match(&self, line: &[u8]) -> bool {
        self.gate.is_match(line)
    }

    /// Returns the ids of the rules that match `line`.
    ///
    /// What: short-circuits on the gate, then filters the per-rule DFAs. Why: a
    /// clean line pays only the gate; reporting which rules hit is the cold path.
    pub fn matches(&self, line: &[u8]) -> impl Iterator<Item = usize> {
        // What: eagerly collect ids then return an owning iterator. Why: avoids
        // borrowing `self`/`line` in the returned iterator.
        let hits: Vec<usize> = if self.gate.is_match(line) {
            self.rules
                .iter()
                .enumerate()
                .filter(|(_, dfa)| dfa.is_match(line))
                .map(|(id, _)| id)
                .collect()
        } else {
            Vec::new()
        };
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
    /// What: bincode-encodes the gate and per-rule automata. Why: the
    /// pre-serialized form the throughput benchmark loads.
    pub fn to_bytes(&self) -> Result<Vec<u8>, CompileError> {
        bincode::serialize(self).map_err(|e| CompileError::Serialize {
            message: e.to_string(),
        })
    }

    /// Loads a compiled ruleset from bytes, validating every automaton.
    ///
    /// What: decodes then validates the gate and each rule DFA. Why: every
    /// automaton is executed, so all must be proven in-bounds before use.
    pub fn from_bytes(bytes: &[u8]) -> Result<RegexSet, CompileError> {
        let set: RegexSet = bincode::deserialize(bytes).map_err(|e| CompileError::Invalid {
            message: e.to_string(),
        })?;
        set.gate.validate()?;
        for dfa in &set.rules {
            dfa.validate()?;
        }
        Ok(set)
    }
}
