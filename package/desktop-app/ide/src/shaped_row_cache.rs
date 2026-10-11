//! Shaped source rows kept by line for one text revision and display scale.

/// What:
///  `ShapedRow` is the shaped line a cache entry keeps;
///  `HashMap` maps a line index to its entry.
/// Why:
///  A row is looked up by line, and the cache owns its rows until they are evicted.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import type { ShapedRow } from './shaped-row';
/// ```
use crate::shaped_row::ShapedRow;
/// Lines are keyed by their index and compared by their distance from the view's centre.
use std::collections::HashMap;

/// What:
///  Most lines the cache keeps; the lines farthest from the view are evicted first.
/// Why:
///  A tile of three view heights holds about a hundred lines at typical sizes,
///  so a few hundred lines let a re-centered tile reuse the lines it shares with the previous one.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const ROW_CACHE_LINES = 256;
/// ```
const ROW_CACHE_LINES: usize = 256;

/// What:
///  The shaped rows of a text, keyed by line, with the text revision and display scale they were shaped for.
/// Why:
///  Shaping is the expensive part of a tile; a row shaped for the same text and scale is identical to a new one,
///  except for its vertical position, which the caller sets from the current vertical mapping.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type RowCache = { key?: [revision: number, scale: number]; rows: Map<number, ShapedRow> };
/// ```
#[derive(Default)]
pub struct RowCache {
    /// Text revision and the scale's exact bits; `None` before the first sync.
    key: Option<(u64, u32)>,
    /// Shaped rows by line, each with its top left at zero.
    rows: HashMap<usize, ShapedRow>,
}

/// Cache operations, each judged against the text revision and scale the cache was synced to.
impl RowCache {
    /// Empty the cache unless it was shaped for this text revision and scale.
    pub fn sync(&mut self, revision: u64, scale: f32) {
        // What: `to_bits` compares the scale exactly, so two equal scales always produce the same key.
        // Why: A scale change alters every glyph advance, so no row shaped at another scale may be reused.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const key = [revision, scale];
        // ```
        let key = (revision, scale.to_bits());
        if self.key != Some(key) {
            self.rows.clear();
            self.key = Some(key);
        }
    }

    /// The shaped row of `line`, if it was shaped for the synced text and scale.
    pub fn get(&self, line: usize) -> Option<&ShapedRow> {
        return self.rows.get(&line);
    }

    /// Keep a freshly shaped row under its line.
    pub fn insert(&mut self, row: ShapedRow) {
        self.rows.insert(row.row, row);
    }

    /// What:
    ///  Evict the lines farthest from `centre` until no more than `ROW_CACHE_LINES` remain.
    /// Why:
    ///  The rows near the view are the ones the next re-center needs; far rows would only waste memory.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// function trim(centre: number): void;
    /// ```
    pub fn trim(&mut self, centre: usize) {
        if self.rows.len() <= ROW_CACHE_LINES {
            return;
        }
        let mut lines: Vec<usize> = self.rows.keys().copied().collect();
        // `abs_diff` is the distance between two line indices without underflow.
        lines.sort_by_key(|line| return line.abs_diff(centre));
        for line in lines.drain(ROW_CACHE_LINES..) {
            self.rows.remove(&line);
        }
    }

    /// Forget every row and the key, after a change the key does not describe, such as new styles.
    pub fn clear(&mut self) {
        self.rows.clear();
        self.key = None;
    }
}
