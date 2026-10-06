//! Inlay hints and diagnostics of the displayed file, reduced to what one frame paints.
//!
//! Snapshots come from the Language module and name the file generation and revision they describe.
//! A snapshot for any other generation or revision is never painted. Nothing here changes source geometry:
//! hints and severity markers are drawn after a line's text and underlines under its glyphs, so caret movement,
//! selection, hit testing, find rectangles, tab stops, and copying never see them.

/// The diagnostic records and their severities as the Language module reports them.
use crate::language::diagnostics::{DiagnosticsSnapshot, Severity};
/// The hint records as the Language module reports them.
use crate::language::hints::HintsSnapshot;
/// File generation and content revision of the text a snapshot describes.
use crate::language::identity::DocumentStamp;
/// What: `Rope` is Helix's character-indexed text buffer.
/// Why: The frame's character window is computed from the displayed text's line starts.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { type Rope } from 'helix-core';
/// ```
use helix_core::Rope;
/// What: `Arc` shares one immutable allocation between owners (siblings: single-thread `Rc`, owning `Box`).
/// Why: The Language module hands snapshots out as shared values; `Arc` matches its handle without copying.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Shared<T> = Readonly<T>;
/// ```
use std::sync::Arc;

/// What: Order of severity from worst to mildest; `u8` is an unsigned byte (siblings `u32`, `usize`).
/// Why: Overlapping marks are drawn mildest first, and the caret card lists the worst first.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function rank(severity: Severity): number { return ['error', 'warning', 'information', 'hint'].indexOf(severity); }
/// ```
pub fn rank(severity: Severity) -> u8 {
    if severity == Severity::Error {
        return 0;
    }
    if severity == Severity::Warning {
        return 1;
    }
    if severity == Severity::Information {
        return 2;
    }
    return 3;
}

/// What: The word a reader sees for a severity; `&'static str` is text baked into the binary (sibling `String`).
/// Why: The caret card names the severity in words, so it does not depend on color.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function severityName(severity: Severity): string;
/// ```
pub fn severity_name(severity: Severity) -> &'static str {
    if severity == Severity::Error {
        return "Error";
    }
    if severity == Severity::Warning {
        return "Warning";
    }
    if severity == Severity::Information {
        return "Information";
    }
    return "Hint";
}

/// What: One diagnostic as a frame paints it; `usize` is the character index type Helix ropes use
///       (siblings `u32`, `u64`). `Copy` lets the record be duplicated like a number.
/// Why: Painting needs the range and severity only; comparing these decides whether pixels change.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Mark = { start: number; end: number; severity: Severity };
/// ```
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Mark {
    /// First marked character.
    pub start: usize,
    /// Character after the marked range; equal to `start` for a point.
    pub end: usize,
    /// Severity, with an omitted severity shown as a warning, as Helix shows it.
    pub severity: Severity,
}

/// What: One diagnostic with the text the caret card shows; `Option<String>` is text or nothing.
/// Why: The card needs the source, code, and message, which painting does not.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Problem = { mark: Mark; source: string; code?: string; message: string };
/// ```
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Problem {
    /// Range and severity.
    pub mark: Mark,
    /// The `source` the server named, for example `rustc`; empty when it named none.
    pub source: String,
    /// The server's rule or error code.
    pub code: Option<String>,
    /// The server's message, possibly several lines.
    pub message: String,
}

/// One hint label as a frame paints it: the character it annotates and its trimmed text.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Label {
    /// Character offset the server placed the hint before.
    pub position: usize,
    /// The server's label without its padding spaces.
    pub text: String,
}

/// What: Everything one frame paints from the snapshots; `Vec<T>` is a growable list
///       (siblings: fixed `[T; N]`, borrowed `&[T]`). `Default` builds the empty value.
/// Why: Two frames with equal visible annotations have equal annotation pixels, so this is the frame-stamp key.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Visible = { labels: Label[]; marks: Mark[] };
/// ```
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Visible {
    /// Hint labels of the materialized rows, in position order.
    pub labels: Vec<Label>,
    /// Diagnostics touching the materialized rows, in start order.
    pub marks: Vec<Mark>,
}

/// What: The latest snapshots plus a position index over every diagnostic; `Option<Arc<T>>` is a shared
///       snapshot or nothing.
/// Why: Groups arrive per source, so their union is sorted once here instead of on every frame.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Annotations = { hints?: HintsSnapshot; diagnostics?: DiagnosticsSnapshot;
///                      problems: Problem[]; reach: number[] };
/// ```
#[derive(Debug, Default)]
pub struct Annotations {
    /// Latest hints, painted only while their stamp names the displayed text.
    hints: Option<Arc<HintsSnapshot>>,
    /// Latest diagnostics, painted only while their stamp names the displayed text.
    diagnostics: Option<Arc<DiagnosticsSnapshot>>,
    /// Every diagnostic of every group, ordered by start, then end.
    problems: Vec<Problem>,
    /// `reach[i]` is the largest end among `problems[0..=i]`, so a range starting above a window is found by search.
    reach: Vec<usize>,
}

/// What: Severity a diagnostic is drawn with; `Option<Severity>` is a severity or nothing.
/// Why: The protocol leaves an omitted severity to the client; Helix shows it as a warning
///      (`helix-term/src/ui/editor.rs`, `Some(Severity::Warning) | None => warning`).
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function shown(severity?: Severity): Severity { return severity ?? 'warning'; }
/// ```
fn shown(severity: Option<Severity>) -> Severity {
    // `unwrap_or` takes the present severity or substitutes the warning.
    return severity.unwrap_or(Severity::Warning);
}

/// What: Flatten every group of `diagnostics` into one list ordered by start, then end, with the furthest end so
///       far beside it; `Option<&DiagnosticsSnapshot>` lends a snapshot or nothing; the answer is a pair (tuple).
/// Why: Groups arrive per source, so their union is sorted once per snapshot instead of on every frame.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function indexed(diagnostics?: DiagnosticsSnapshot): [Problem[], number[]];
/// ```
fn indexed(diagnostics: Option<&DiagnosticsSnapshot>) -> (Vec<Problem>, Vec<usize>) {
    let mut problems = Vec::new();
    // What: `if let Some(snapshot) = diagnostics` runs only when a snapshot is present.
    // Why: Absent diagnostics leave the index empty.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (diagnostics) { for (const group of diagnostics.groups) ... }
    // ```
    if let Some(snapshot) = diagnostics {
        for group in &snapshot.groups {
            for item in &group.items {
                problems.push(Problem {
                    mark: Mark {
                        start: item.start,
                        // A range the server sent backwards still marks its characters.
                        end: item.end.max(item.start),
                        severity: shown(item.severity),
                    },
                    // `clone` copies the text so the index owns it independently of the snapshot.
                    source: group.source.clone(),
                    code: item.code.clone(),
                    message: item.message.clone(),
                });
            }
        }
    }
    // What: `sort_by_key` orders by the pair `(start, end)`; `|problem|` is a closure parameter.
    // Why: Window and caret searches binary-search by start.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // problems.sort((a, b) => a.mark.start - b.mark.start || a.mark.end - b.mark.end);
    // ```
    problems.sort_by_key(|problem| return (problem.mark.start, problem.mark.end));
    let mut reach = Vec::new();
    let mut furthest = 0;
    for problem in &problems {
        furthest = furthest.max(problem.mark.end);
        reach.push(furthest);
    }
    return (problems, reach);
}

/// Build, query, and replace the annotation inputs of the displayed file.
impl Annotations {
    /// What: Keep both snapshots and index every diagnostic once. `Option<Arc<...>>` parameters are moved in.
    /// Why: The setter runs when a snapshot changes; frames only search the index.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// static from(hints?: HintsSnapshot, diagnostics?: DiagnosticsSnapshot): Annotations;
    /// ```
    pub fn new(
        hints: Option<Arc<HintsSnapshot>>,
        diagnostics: Option<Arc<DiagnosticsSnapshot>>,
    ) -> Self {
        // `as_deref` lends the snapshot inside the shared pointer, or nothing.
        let (problems, reach) = indexed(diagnostics.as_deref());
        return Self {
            hints,
            diagnostics,
            problems,
            reach,
        };
    }

    /// What: Store hints that describe `displayed`; a snapshot for any other text is refused, the held hints
    ///       stay, and the answer is `false`. `Arc<HintsSnapshot>` is moved in.
    /// Why: This is the Language poll's entry point: hints and diagnostics arrive independently, and only a
    ///      snapshot of the displayed file generation and revision may replace what is shown.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// acceptHints(displayed: DocumentStamp, snapshot: HintsSnapshot): boolean;
    /// ```
    pub fn accept_hints(&mut self, displayed: DocumentStamp, snapshot: Arc<HintsSnapshot>) -> bool {
        if snapshot.stamp != displayed {
            return false;
        }
        // `Some(...)` stores the snapshot as the present value.
        self.hints = Some(snapshot);
        return true;
    }

    /// What: Store diagnostics that describe `displayed` and index them; a snapshot for any other text is
    ///       refused, the held diagnostics stay, and the answer is `false`.
    /// Why: The index is rebuilt once per accepted snapshot, never per frame.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// acceptDiagnostics(displayed: DocumentStamp, snapshot: DiagnosticsSnapshot): boolean;
    /// ```
    pub fn accept_diagnostics(
        &mut self,
        displayed: DocumentStamp,
        snapshot: Arc<DiagnosticsSnapshot>,
    ) -> bool {
        if snapshot.stamp != displayed {
            return false;
        }
        // `&snapshot` lends the snapshot behind the shared pointer to the indexing pass.
        let (problems, reach) = indexed(Some(&snapshot));
        self.problems = problems;
        self.reach = reach;
        self.diagnostics = Some(snapshot);
        return true;
    }

    /// What: The held hints while they describe `displayed`, otherwise nothing; `Option<&HintsSnapshot>` lends
    ///       the snapshot without copying it.
    /// Why: Readers other than the renderer, such as logging, ask with the stamp of the displayed text.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// hints(displayed: DocumentStamp): HintsSnapshot | undefined;
    /// ```
    pub fn hints(&self, displayed: DocumentStamp) -> Option<&HintsSnapshot> {
        // `filter` keeps the lent snapshot only when the closure accepts it.
        return self
            .hints
            .as_deref()
            .filter(|held| return held.stamp == displayed);
    }

    /// The held diagnostics while they describe `displayed`, otherwise nothing.
    pub fn diagnostics(&self, displayed: DocumentStamp) -> Option<&DiagnosticsSnapshot> {
        return self
            .diagnostics
            .as_deref()
            .filter(|held| return held.stamp == displayed);
    }

    /// What: Whether these exact snapshots are already held; `Arc::ptr_eq` compares identities, not contents.
    /// Why: A poll that hands back the same snapshots must not rebuild the index.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// holds(hints?: HintsSnapshot, diagnostics?: DiagnosticsSnapshot): boolean;
    /// ```
    pub fn holds(
        &self,
        hints: &Option<Arc<HintsSnapshot>>,
        diagnostics: &Option<Arc<DiagnosticsSnapshot>>,
    ) -> bool {
        // What: `match` on a pair of options: two present snapshots compare identities, two absent ones are
        //       equal, and `_` (any other combination) is a difference.
        // Why: Pointer identity is exact and costs nothing, whatever the snapshot size.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const sameHints = this.hints === hints;
        // ```
        let same_hints = match (&self.hints, hints) {
            (Some(held), Some(given)) => Arc::ptr_eq(held, given),
            (None, None) => true,
            _ => false,
        };
        let same_diagnostics = match (&self.diagnostics, diagnostics) {
            (Some(held), Some(given)) => Arc::ptr_eq(held, given),
            (None, None) => true,
            _ => false,
        };
        return same_hints && same_diagnostics;
    }

    /// Whether the held diagnostics describe exactly the displayed text.
    fn diagnostics_current(&self, stamp: DocumentStamp) -> bool {
        // `is_some_and` answers false for no snapshot and otherwise asks the closure.
        return self
            .diagnostics
            .as_ref()
            .is_some_and(|snapshot| return snapshot.stamp == stamp);
    }

    /// What: The labels and marks of rows `first..last` of `text`, or nothing for a stale snapshot.
    ///       `&Rope` lends the displayed text.
    /// Why: Painting is bounded to the materialized rows; both searches are binary, so the cost follows the
    ///      number of visible annotations, not the file.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// visible(stamp: DocumentStamp, text: Rope, first: number, last: number): Visible;
    /// ```
    pub fn visible(&self, stamp: DocumentStamp, text: &Rope, first: usize, last: usize) -> Visible {
        let mut result = Visible::default();
        let lines = text.len_lines();
        if first >= lines {
            return result;
        }
        let start = text.line_to_char(first);
        // Past the last line every remaining position, including the end of the text, is inside the window.
        let mut end = usize::MAX;
        if last < lines {
            end = text.line_to_char(last);
        }
        if let Some(snapshot) = &self.hints
            && snapshot.stamp == stamp
        {
            let from = snapshot
                .hints
                .partition_point(|hint| return hint.position < start);
            for hint in &snapshot.hints[from..] {
                if hint.position >= end {
                    break;
                }
                let trimmed = hint.label.trim();
                if !trimmed.is_empty() {
                    result.labels.push(Label {
                        position: hint.position,
                        // `to_string` copies the borrowed trimmed text into an owned `String`.
                        text: trimmed.to_string(),
                    });
                }
            }
        }
        if self.diagnostics_current(stamp) {
            // The first diagnostic whose range, or an earlier one's, reaches the window.
            let from = self
                .reach
                .partition_point(|furthest| return *furthest < start);
            for problem in &self.problems[from..] {
                if problem.mark.start >= end {
                    break;
                }
                if problem.mark.end >= start {
                    result.marks.push(problem.mark);
                }
            }
        }
        return result;
    }

    /// What: Diagnostics whose range contains caret boundary `position`, worst first; `Vec<&Problem>` lends them.
    /// Why: The caret card shows every problem at the caret; a range touches the caret at both of its ends.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// at(stamp: DocumentStamp, position: number): Problem[];
    /// ```
    pub fn at(&self, stamp: DocumentStamp, position: usize) -> Vec<&Problem> {
        let mut result = Vec::new();
        if !self.diagnostics_current(stamp) {
            return result;
        }
        let from = self
            .reach
            .partition_point(|furthest| return *furthest < position);
        for problem in &self.problems[from..] {
            if problem.mark.start > position {
                break;
            }
            if problem.mark.end >= position {
                result.push(problem);
            }
        }
        // What: `sort_by_key` is stable, so equal severities keep their position order.
        // Why: The worst problem is read first.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // result.sort((a, b) => rank(a.mark.severity) - rank(b.mark.severity));
        // ```
        result.sort_by_key(|problem| return rank(problem.mark.severity));
        return result;
    }
}

/// What: The card text for one problem, for example `Error E0308 (rustc): mismatched types`.
/// Why: The severity is spelled out, so the card does not rely on its color; the code and source say who reported it.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function describe(problem: Problem): string;
/// ```
pub fn describe(problem: &Problem) -> String {
    let mut text = severity_name(problem.mark.severity).to_string();
    if let Some(code) = &problem.code {
        text.push(' ');
        text.push_str(code);
    }
    if !problem.source.is_empty() {
        // `format!` builds a new `String` from a template, like a TS template literal.
        text.push_str(&format!(" ({})", problem.source));
    }
    text.push_str(": ");
    text.push_str(problem.message.trim());
    return text;
}
