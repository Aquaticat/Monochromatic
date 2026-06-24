//! The element leaf type and its decode-time validation.

/// Imports the serde derives so an element can be persisted.
use serde::{Deserialize, Serialize};

/// Imports the byte-set leaf type carried by class and counted elements.
use crate::charset::ByteSet;

/// Imports the error type for validating a decoded element.
use crate::error::CompileError;

/// Largest repetition bound a decoded element may carry.
///
/// What: an upper limit on a `Counted` element's `max`, checked on decode. Why: the
/// counter-set can hold up to `max` distinct values, so a hostile serialized bound
/// could force unbounded memory; this caps it well above the parser's own limit.
pub(crate) const MAX_DECODED_COUNT: usize = 1 << 16;

/// One position of a counting NFA: a byte class, a counted class, or an anchor.
///
/// What: the byte-consuming positions (`Class`, `Counted`) and the zero-width
/// anchors; branching between positions lives in the NFA's follow sets, not here.
/// Why: keeping a bounded repetition as one `Counted` position is what moves the
/// count out of the state space and into a runtime counter-set.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum Element {
    /// Matches exactly one byte drawn from the set.
    Class(
        /// Byte set the single matched byte must belong to.
        ByteSet,
    ),
    /// Matches between `min` and `max` bytes from the set, counted at runtime.
    Counted {
        /// Byte set each repetition must match.
        set: ByteSet,
        /// Fewest repetitions that satisfy the element.
        min: usize,
        /// Most repetitions the element admits.
        max: usize,
    },
    /// Zero-width `^`: passable only at a line start.
    LineStart,
    /// Zero-width `$`: passable only at a line end.
    LineEnd,
    /// Zero-width `\b`: passable only where word-ness changes.
    WordBoundary,
}

/// Validates one decoded element.
///
/// What: only `Counted` carries decode-time risk; class and anchor elements are
/// always well formed. Why: a serialized bound may be hostile, and the simulation
/// allocates a counter-set sized by `max`, so it must be proven small first.
pub(crate) fn validate_element(element: &Element) -> Result<(), CompileError> {
    if let Element::Counted { set, min, max } = element {
        let invalid = |message: &str| CompileError::Invalid {
            message: message.to_string(),
        };
        if set.is_empty() {
            return Err(invalid("counted element has an empty set"));
        }
        if min > max {
            return Err(invalid("counted element has min greater than max"));
        }
        if *max > MAX_DECODED_COUNT {
            return Err(invalid("counted element bound exceeds the decode cap"));
        }
    }
    Ok(())
}
