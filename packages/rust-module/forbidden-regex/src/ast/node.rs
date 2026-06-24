//! The derivative-regex node algebra.

/// Imports the byte-set leaf type used by `Class` nodes.
use crate::charset::ByteSet;

/// A regular expression as a value that derivatives transform.
///
/// What: a small algebra closed under Brzozowski derivatives, including the
/// boolean operators `Inter` (intersection) and `Comp` (complement) plus the
/// distinguished constants `Empty` (epsilon), `Fail` (the empty language), and
/// `Top` (every string). Why: derivatives map each variant to another node, so
/// the same type represents both the parsed pattern and every residual state;
/// `Eq`/`Ord`/`Hash` let smart constructors dedup and sort, and let the DFA
/// builder intern states.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum Node {
    /// Matches the empty string (epsilon).
    Empty,
    /// Matches nothing (the empty language); arises as a dead derivative.
    Fail,
    /// Matches every string (sigma star); arises from complement and as the
    /// unanchored-search prefix.
    Top,
    /// Matches one byte drawn from the set.
    ///
    /// What: literals, `.`, `[...]`, and the shorthands all reduce to this.
    Class(ByteSet),
    /// Sequence: each child matches in order.
    Concat(Vec<Node>),
    /// Alternation: any one child matches.
    Alt(Vec<Node>),
    /// Intersection: every child must match the same input.
    Inter(Vec<Node>),
    /// Complement: matches exactly the strings the child does not.
    Comp(Box<Node>),
    /// Bounded repetition: match the child between `min` and `max` times.
    ///
    /// What: kept un-unrolled so a counter register, not DFA states, carries the
    /// count. Why: unrolling `{n,m}` bakes the count into the automaton and blows
    /// it up exponentially under unanchored search.
    Repeat {
        /// Repeated sub-expression.
        node: Box<Node>,
        /// Minimum number of repetitions still required.
        min: usize,
        /// Maximum number of repetitions still allowed.
        max: usize,
    },
    /// Zero-width `^`: nullable only at a line start.
    LineStart,
    /// Zero-width `$`: nullable only at a line end.
    LineEnd,
    /// Zero-width `\b`: nullable only where word-ness changes.
    WordBoundary,
}
