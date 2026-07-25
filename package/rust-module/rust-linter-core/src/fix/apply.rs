//! Applying proposed repairs to a file's text.

/// Imports the finding record repairs are attached to.
use crate::diagnostic::Diagnostic;
/// Imports the repair types being applied.
use crate::fix::{Edit, FixKind};

// What:     `pub struct Applied { .. }` is what one pass produces: the rewritten
//           text, and how many repairs went into it.
// Why:      The caller needs both. The text is what gets written back, and the
//           count is what tells the fixpoint loop whether to go round again.
/// Outcome of applying repairs to one file's text.
pub struct Applied {
    /// Rewritten source text.
    pub source: String,

    /// How many repairs were applied in this pass.
    pub applied: usize,

    /// How many repairs were skipped because they overlapped an applied one.
    pub skipped: usize,
}

// What:     `pub fn apply(source: &str, diagnostics: &[Diagnostic], ceiling:
//           FixKind) -> Applied`. Borrows the text and findings, returns a new
//           owned string rather than mutating in place.
// Why:      A pass that failed halfway through would leave a file that is
//           neither the original nor the repaired version. Building a new string
//           means the caller writes it only once the whole pass succeeded.
//
// In TS you'd write (pseudocode):
// ```ts
// function apply(source: string, diagnostics: Diagnostic[], ceiling: FixKind): Applied
// ```
/// Apply every eligible repair to one file's text.
pub fn apply(source: &str, diagnostics: &[Diagnostic], ceiling: FixKind) -> Applied {
    // What:     `.filter_map(..)` keeps the elements whose closure answers
    //           `Some`, discarding the rest, which is a filter and a map in one.
    // Why:      Most findings carry no repair, and the ones that do may propose
    //           a kind this run is not allowed to apply.
    let mut edits: Vec<&Edit> = diagnostics
        .iter()
        .filter_map(|diagnostic| return diagnostic.fix.as_ref())
        .filter(|fix| return fix.kind.is_applied_at(ceiling))
        .flat_map(|fix| return fix.edits.iter())
        .collect();

    // What:     `.sort_by_key(..)` orders the edits by where they start.
    // Why:      Overlap detection below compares each edit against the previous
    //           one, which only works on a sorted list. Rust's sort is stable,
    //           so two edits at the same offset keep the order their rules ran.
    edits.sort_by_key(|edit| return edit.span.offset);

    let mut applied = 0;
    let mut skipped = 0;

    // Rebuilt left to right, copying the untouched text between edits.
    let mut out = String::new();
    let mut cursor = 0;

    for edit in edits {
        let start = edit.span.offset;
        let end = start + edit.span.length;

        // What:     `if start < cursor` detects an edit overlapping one already
        //           applied.
        // Why:      Two rules can both want to rewrite the same bytes, and
        //           applying both would produce text neither intended. Skipping
        //           the later one is safe: the fixpoint loop runs again, the
        //           rule reports again against the new text, and its repair
        //           applies on the next pass if it still makes sense.
        if start < cursor {
            skipped += 1;
            continue;
        }

        // An edit pointing past the end of the file cannot be applied. That is a
        // rule bug rather than a user error, but dropping the edit is better
        // than panicking in a path the user asked to rewrite their source.
        if end > source.len() {
            skipped += 1;
            continue;
        }

        // `get(range)` answers `Option`, absent when the range does not land on
        // character boundaries. Rust strings are UTF-8, and slicing through the
        // middle of a multi-byte character would panic.
        let Some(untouched) = source.get(cursor..start) else {
            skipped += 1;
            continue;
        };

        if source.get(start..end).is_none() {
            skipped += 1;
            continue;
        }

        out.push_str(untouched);
        out.push_str(&edit.replacement);
        cursor = end;
        applied += 1;
    }

    // Everything after the last edit is copied unchanged.
    if let Some(rest) = source.get(cursor..) {
        out.push_str(rest);
    }

    return Applied {
        source: out,
        applied,
        skipped,
    };
}

// What:     `pub const MAX_PASSES: usize = 10;`
// Why:      Repairs can cascade: fixing one problem reveals another the same
//           rule now reports. Iterating to a fixpoint is what makes `--fix`
//           converge, and a cap is what stops two rules that undo each other
//           from spinning forever. Ten is oxlint's own limit.
/// Most fixpoint passes a single file gets before the loop gives up.
pub const MAX_PASSES: usize = 10;
