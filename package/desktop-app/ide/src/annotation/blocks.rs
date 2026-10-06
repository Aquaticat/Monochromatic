//! The blocks of virtual rows the store's hints and diagnostics call for, one per annotated line.
//!
//! Three things decide a block: the hints accumulated for the displayed revision, the message rows of its
//! diagnostics, and space held over from the previous revision after an external change. Assembly packs hint
//! rows with the production shaper, so a block's height is exactly what a frame will paint.

/// The store these methods extend, its records, and the hint label type.
use super::{Annotations, Held, Label};
/// Hint rows are packed against the shaped code line.
use crate::annotation_layout::pack;
/// The displayed text and its line starts.
use crate::document::Document;
/// One accepted hint snapshot and the stamp of the text it describes.
use crate::language::{hints::HintsSnapshot, identity::DocumentStamp};
/// The shaper that paints the source measures hint labels and their anchor positions.
use crate::shaped_text::TextShaper;
/// The assembled record of one line's rows.
use crate::virtual_row::Block;
/// What: `Rope` is Helix's character-indexed text buffer.
/// Why: A hint belongs to the line its position lies on.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { type Rope } from 'helix-core';
/// ```
use helix_core::Rope;
/// What: `BTreeMap` is a map kept in key order; `Arc` shares one immutable block between the window state and
///       the frames that paint it; `Instant` is a point on a monotonic clock.
/// Why: Blocks are handed out in line order and compared by content when deciding whether to repaint.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Shared<T> = Readonly<T>;
/// ```
use std::{collections::BTreeMap, sync::Arc, time::Instant};

/// Group hints by line, hold space across a reload, and assemble blocks.
impl Annotations {
    /// What: Take the labels of `snapshot` into the per-line store: lines the snapshot asked about are replaced
    ///       by its answer, other lines keep the labels an earlier snapshot of the same revision gave them.
    ///       `&Rope` lends the text the snapshot describes.
    /// Why: Hints are requested for one view height above and two below the visible lines. Replacing all hints
    ///      with each answer would remove the rows of lines scrolled away from, and put them back when the
    ///      view returns, moving the text both times.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// mergeLabels(text: Rope, snapshot: HintsSnapshot): void;
    /// ```
    pub(super) fn merge_labels(&mut self, text: &Rope, snapshot: &HintsSnapshot) {
        if self.labelled != Some(snapshot.stamp) {
            self.labels.clear();
            self.placed.clear();
            // `Some(...)` records which revision the labels now describe.
            self.labelled = Some(snapshot.stamp);
        }
        let asked = snapshot.first_line..snapshot.last_line;
        // What: `range(...)` walks the stored lines inside the asked range; `copied()` yields the line numbers
        //       themselves and `collect()` gathers them into a list.
        // Why: The lines are removed afterwards; a map cannot be changed while it is being walked.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const stale = [...labels.keys()].filter(line => line >= first && line < last);
        // ```
        let stale: Vec<usize> = self
            .labels
            .range(asked.clone())
            .map(|(line, _)| return *line)
            .collect();
        for line in stale {
            self.labels.remove(&line);
            self.placed.remove(&line);
        }
        let length = text.len_chars();
        for hint in &snapshot.hints {
            // Prototype variant: editord's label stripping by hint kind.
            let whole = hint.label.trim();
            let trimmed = if hint.kind == Some(crate::language::hints::HintKind::Parameter) {
                whole.strip_suffix(':').unwrap_or(whole)
            } else if hint.kind == Some(crate::language::hints::HintKind::Type) {
                whole.strip_prefix(": ").unwrap_or(whole)
            } else {
                whole
            };
            if trimmed.is_empty() {
                continue;
            }
            let line = text.char_to_line(hint.position.min(length));
            // `entry(...).or_default()` lends the line's list, creating an empty one first when absent.
            self.labels.entry(line).or_default().push(Label {
                position: hint.position,
                // `to_string` copies the borrowed trimmed text into an owned `String`.
                text: trimmed.to_string(),
            });
            self.placed.remove(&line);
        }
        // Hint space held from the previous revision is given up for the lines this answer covers.
        for part in &mut self.held {
            if asked.contains(&part.line) {
                part.hints = 0.0;
            }
        }
    }

    /// What: Hold `parts` open above lines of the text `next` until `until`. `Vec<Held>` is moved in.
    /// Why: Called when an external change replaced the displayed text: the rows of the old text are not
    ///      painted for the new one, but their space stays until hints and diagnostics of the new text arrive
    ///      or the time passes, so unchanged lines do not move twice.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// hold(next: DocumentStamp, parts: Held[], until: number): void;
    /// ```
    pub fn hold(&mut self, next: DocumentStamp, parts: Vec<Held>, until: Instant) {
        self.held = parts;
        self.held_for = Some(next);
        self.held_until = Some(until);
        self.version += 1;
    }

    /// What: Give up held space whose time has passed at `now`; the answer says whether anything was given up.
    /// Why: A server that never answers for the new text must not leave empty rows forever.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// expire(now: number): boolean;
    /// ```
    pub fn expire(&mut self, now: Instant) -> bool {
        // `is_some_and` answers false without a deadline and otherwise asks the closure.
        let due = self.held_until.is_some_and(|until| return now >= until);
        if !due {
            return false;
        }
        let had = !self.held.is_empty();
        self.held.clear();
        self.held_until = None;
        if had {
            self.version += 1;
        }
        return had;
    }

    /// What: The blocks of every annotated line of the text `displayed`, in line order. `&mut TextShaper` is
    ///       lent to pack hint rows of lines not packed yet at `scale`; `&Document` lends the displayed text.
    /// Why: This is the single source of block heights for the vertical mapping and of the rows a frame
    ///      paints. Snapshots and held space of any other text contribute nothing.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// assemble(displayed: DocumentStamp, document: Document, shaper: TextShaper, scale: number): Block[];
    /// ```
    pub fn assemble(
        &mut self,
        displayed: DocumentStamp,
        document: &Document,
        shaper: &mut TextShaper,
        scale: f32,
    ) -> Vec<Arc<Block>> {
        if self.placed_scale != scale {
            // Label widths and caret positions are measured in pixels of one scale.
            self.placed.clear();
            self.placed_scale = scale;
        }
        let labelled = self.labelled == Some(displayed);
        let diagnosed = self.diagnostics_current(displayed);
        // Every line that owns something, with the space held for it.
        let mut lines: BTreeMap<usize, (f32, f32)> = BTreeMap::new();
        if labelled {
            for line in self.labels.keys() {
                lines.insert(*line, (0.0, 0.0));
            }
        }
        if diagnosed {
            for line in self.messages.keys() {
                lines.insert(*line, (0.0, 0.0));
            }
        }
        if self.held_for == Some(displayed) {
            for part in &self.held {
                lines.insert(part.line, (part.hints, part.messages));
            }
        }
        let count = document.text().len_lines();
        let mut blocks = Vec::new();
        for (line, held) in lines {
            if line >= count {
                continue;
            }
            let mut hint_rows = 0;
            let mut hints = Vec::new();
            // `get` lends the line's labels when the line has any.
            if labelled && let Some(labels) = self.labels.get(&line) {
                // What: `entry(...).or_insert_with(...)` lends the line's cached packing, running the closure
                //       to pack the line first when the cache has none; `|| { ... }` is that closure.
                // Why: A line is shaped and packed once per snapshot and scale, not on every assembly.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // if (!placed.has(line)) placed.set(line, pack(shaper.row(document, line, scale), labels, shaper, scale));
                // ```
                let packed = self.placed.entry(line).or_insert_with(|| {
                    let row = shaper.row(document, line, scale);
                    return pack(&row, labels, shaper, scale);
                });
                // `clone` copies the packed rows so the block owns them independently of the cache.
                (hint_rows, hints) = packed.clone();
            }
            let mut messages = Vec::new();
            if diagnosed && let Some(rows) = self.messages.get(&line) {
                messages = rows.clone();
            }
            let block = Block {
                line,
                hint_rows,
                hints,
                messages,
                held,
            };
            if block.height() > 0.0 {
                // `Arc::new` makes the block shareable between the window state and its frames.
                blocks.push(Arc::new(block));
            }
        }
        return blocks;
    }
}
