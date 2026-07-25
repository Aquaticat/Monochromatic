//! Source positions and the labelled spans a diagnostic points at.

// What:     `pub struct Span { ... }` declares a record type with named, OWNED
//           fields. A struct is like a TS object type, except each field's
//           ownership is explicit rather than implied by garbage collection.
// Why:      Every field here exists because oxlint's JSON diagnostic format
//           carries exactly these four numbers per span, and matching that
//           format field-for-field is what lets the repo's existing
//           `oxlint-wrapper.ts` tooling read this linter's output unchanged.
//
// In TS you'd write (pseudocode):
// ```ts
// type Span = { offset: number; length: number; line: number; column: number };
// ```
/// Byte range in one source file, carried with its human-facing line and column.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Span {
    // What:     `offset: usize`. `usize` is the unsigned integer wide enough to
    //           index any element in memory: 32-bit on a 32-bit OS, 64-bit on a
    //           64-bit one. Siblings: `u32`, `u64`, `i32`, `i64`.
    // Why:      `usize` because this indexes into the source text, and every Rust
    //           slicing API expresses indices as `usize`; mixing widths would
    //           force casts at every call site.
    /// Zero-based byte offset of the span's first byte.
    pub offset: usize,

    /// Length of the span in bytes, not characters.
    pub length: usize,

    /// One-based line on which the span starts.
    pub line: usize,

    /// One-based column, counted in bytes, on which the span starts.
    pub column: usize,
}

/// Constructors for source spans.
impl Span {
    // What:     `pub fn new(...) -> Self`. An associated function with no `self`
    //           parameter, so it is called as `Span::new(..)` rather than on an
    //           existing value; TS would call this a static method. `Self` is an
    //           alias for the type the `impl` block is for.
    // Why:      One place builds spans, so the four numbers can never be passed
    //           in a scrambled order at a call site that happens to type-check.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // static create(o: number, l: number, line: number, col: number): Span
    // ```
    /// Build a span from its byte range and its resolved line and column.
    pub fn new(offset: usize, length: usize, line: usize, column: usize) -> Self {
        // What:     `Self { offset, length, line, column }`. Field shorthand: when
        //           a local variable already has the field's name, `offset:
        //           offset` collapses to `offset`.
        // Why:      Build and hand back the record.
        // Gotcha:   Rust would return this without the `return` keyword, because
        //           a function body's last expression IS its return value. This
        //           crate writes the keyword anyway: clippy's `implicit_return`
        //           is denied in `Cargo.toml`, so the implicit form is an error
        //           here even though it is idiomatic Rust elsewhere.
        return Self {
            offset,
            length,
            line,
            column,
        }
    }

    /// Build a zero-length span that points at one position rather than a range.
    pub fn at(offset: usize, line: usize, column: usize) -> Self {
        // Zero length: renderers draw a caret rather than an underline.
        return Self::new(offset, 0, line, column)
    }
}

// What:     `pub struct Label { ... }` pairs a span with the optional note drawn
//           beside it in rendered output.
// Why:      oxlint's JSON puts an array of these on every diagnostic, and its
//           rich default renderer uses the note as the text beside the underline.
/// One span a diagnostic points at, with an optional note rendered beside it.
#[derive(Clone, Debug)]
pub struct Label {
    /// Source range this label underlines.
    pub span: Span,

    // What:     `message: Option<String>`. `Option<T>` is Rust's stand-in for a
    //           value that may be absent; it has two variants, `Some(value)` and
    //           `None`. Rust has no `null`, so absence is expressed in the type
    //           and the compiler forces every reader to handle both cases.
    // Why:      Most labels carry no note; oxlint emits the key as absent rather
    //           than as an empty string, and this type says so.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // message?: string;
    // ```
    /// Note rendered beside this label, absent when the span speaks for itself.
    pub message: Option<String>,
}

/// Constructors for diagnostic labels.
impl Label {
    /// Build a bare label that underlines a span with no note.
    pub fn new(span: Span) -> Self {
        // `None` is the absent variant of `Option`; there is no note here.
        return Self {
            span,
            message: None,
        }
    }

    // What:     `pub fn with_message(span: Span, message: impl Into<String>)`.
    //           `impl Into<String>` accepts any type that knows how to convert
    //           itself into an owned `String`, so callers may pass either a
    //           borrowed `&str` literal or an already-owned `String`.
    // Why:      Rule authors write `Label::with_message(span, "expected here")`
    //           without having to remember `.to_string()` at every call.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // static withMessage(span: Span, message: string): Label
    // ```
    /// Build a label carrying a note rendered beside its span.
    pub fn with_message(span: Span, message: impl Into<String>) -> Self {
        // `.into()` performs the conversion the parameter's bound promised.
        return Self {
            span,
            message: Some(message.into()),
        }
    }
}
