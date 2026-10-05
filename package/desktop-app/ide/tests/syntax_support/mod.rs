//! Shared assertion for syntax tests: one sample is recognized and painted by the application engine.

/// What: `use helix_core::Rope;` brings the `Rope` type into this file under its short name.
///       A rope is the text container the application keeps source in.
/// Why:  The engine classifies exactly this type, so tests must build the same input.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { Rope } from 'helix-core';
/// ```
use helix_core::Rope;
/// The application-owned adapter under test; no Helix loader is constructed here.
use ide_app::syntax::SyntaxEngine;
/// Paths drive filename recognition exactly as a project file would.
use std::path::Path;

/// What: `const ROLES: &[&str]` is a fixed, read-only list of borrowed text values.
///       Siblings: `Vec<String>` (growable, owned) and `[&str; 13]` (length in the type).
/// Why:  The engine numbers paint roles as one plus the position in this same ordered list,
///       so tests can name a role (`"keyword"`) instead of repeating its number.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const ROLES = ['keyword', 'string', /* ... */ 'special'] as const;
/// ```
const ROLES: &[&str] = &[
    "keyword",
    "string",
    "comment",
    "constant",
    "type",
    "function",
    "variable",
    "operator",
    "punctuation",
    "tag",
    "attribute",
    "namespace",
    "special",
];

/// What: `pub fn assert_reads_as(path: &str, ...)` is a public function taking five borrowed
///       text values (`&str`: the caller keeps ownership; sibling `String` would take it).
///       It returns nothing and stops the test by panicking when an expectation fails.
/// Why:  Every bundled language needs the same two facts checked through the application path:
///       the file is recognized as `language`, and `fragment` is painted with `role`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export function assertReadsAs(
///   path: string, source: string, language: string, role: string, fragment: string,
/// ): void { /* throws when an expectation fails */ }
/// ```
pub fn assert_reads_as(path: &str, source: &str, language: &str, role: &str, fragment: &str) {
    // What: `ROLES.iter().position(|name| ...)` scans the list with a closure (`|name| ...` is
    //       an arrow function) and returns `Option<usize>`: `Some(index)` or `None`.
    //       `*name` reads through the reference the iterator lends. `.expect("...")` extracts
    //       the index or panics with that message. `usize` is the platform's index integer;
    //       siblings `u32`/`u64`/`i32` would need a cast wherever a position is used.
    // Why:  A misspelled role name must fail loudly instead of matching nothing.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const index = ROLES.indexOf(role);
    // if (index < 0) throw new Error('role is one of the engine palette roles');
    // ```
    let index: usize = ROLES
        .iter()
        .position(|name| return *name == role)
        .expect("role is one of the engine palette roles");
    // What: `SyntaxEngine::new()` returns `Result<SyntaxEngine>`: success or an error value.
    // Why:  A missing bundled manifest must stop the test with its own diagnostic.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const engine = new SyntaxEngine(); // throws when the manifest is missing
    // ```
    let engine = SyntaxEngine::new().expect("bundled language manifest");
    let text = Rope::from_str(source);
    let file = Path::new(path);
    // What: `&text` lends the rope without giving it away. `language_id` returns
    //       `Option<String>`; `.as_deref()` views it as `Option<&str>` so it can be compared
    //       with `Some(language)`, the present variant wrapping the expected name.
    //       `assert_eq!` is a macro (the `!`) that panics when both sides differ.
    // Why:  Recognition is asserted separately from painting, so a wrong language cannot hide
    //       behind a fragment that two grammars happen to paint alike.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // assert.equal(engine.languageId(file, text), language);
    // ```
    assert_eq!(
        engine.language_id(file, &text).as_deref(),
        Some(language),
        "language recognized for {path}"
    );
    // The first `expect` unwraps the `Result`, the second the `Option` inside it.
    let spans = engine
        .highlight(file, &text)
        .expect("bundled grammar and highlighting rules load")
        .expect("bundled language is not plain text");
    // What: `Vec::new()` creates an empty growable list; `mut` allows pushing into it.
    // Why:  A failure message listing every painted fragment shows what the grammar produced.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const classified: Array<[string, string]> = [];
    // ```
    let mut classified = Vec::new();
    let mut found = false;
    for span in spans.iter() {
        // What: `text.slice(a..b)` is a borrowed view of characters `a` up to `b`;
        //       `.to_string()` copies that view into an owned `String`.
        // Why:  Spans address source characters, so slicing the rope returns the painted text.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const painted = source.slice(span.start, span.end);
        // ```
        let painted = text.slice(span.start..span.end).to_string();
        if span.style == index + 1 && painted == fragment {
            found = true;
        }
        classified.push((ROLES[span.style - 1], painted));
    }
    assert!(
        found,
        "expected {role} on {fragment:?} in {path}; painted fragments: {classified:?}"
    );
}
