//! Position context that resolves the zero-width assertions `^`, `$`, and `\b`.

/// The boundary context at one position between (or at the ends of) the input.
///
/// What: four booleans describing the gap where a derivative is taken or
/// nullability is checked. `line_start`/`line_end` answer `^`/`$`;
/// `word_before`/`word_after` are the word-ness of the adjacent bytes and answer
/// `\b`. Why: anchors consume no byte, so their meaning depends entirely on this
/// context rather than on the node alone.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Ctx {
    /// True at the start of the input or just after a newline.
    pub line_start: bool,
    /// True at the end of the input or just before a newline.
    pub line_end: bool,
    /// True when the byte immediately before this position is a word byte.
    pub word_before: bool,
    /// True when the byte immediately after this position is a word byte.
    pub word_after: bool,
}
