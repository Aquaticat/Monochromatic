//! Source classifications remain independent of any native display geometry.

/// What: A source highlight range, independent of native pixels.
/// Why: Parser results can be validated and tested without a window.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type StyleSpan = {start: number; end: number; style: number};
/// ```
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct StyleSpan {
    /// Inclusive source character offset.
    pub start: usize,
    /// Exclusive source character offset.
    pub end: usize,
    /// Semantic palette entry.
    pub style: usize,
}
