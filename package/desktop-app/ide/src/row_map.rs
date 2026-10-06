//! The one mapping between vertical pixels and source lines.
//!
//! Every source line owns one code row of [`CODE_ROW`] logical pixels. A line with inlay hints or diagnostic
//! messages also owns a block of virtual rows directly above its code row; the block's height includes the gap
//! that separates it from the previous line. Everything that places or finds a line vertically asks this map:
//! painting, hit testing, caret and selection rectangles, line numbers, scrolling, and the scroll extent.
//! Without blocks, line `n` starts at exactly `n * CODE_ROW`.

/// What: Height of one code row in logical pixels; `f32` is a 32-bit float (sibling `f64`), the unit of every
///       glyph advance and toolkit coordinate here.
/// Why: The 15 px source text is set on 24 px rows; naming the value keeps it in one place.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export const CODE_ROW = 24;
/// ```
pub const CODE_ROW: f32 = 24.0;
/// Distance from the top of a code row to the top of the caret bar and of selected-terminator marks.
pub const CARET_INSET: f32 = 2.0;
/// Height of the caret bar; it is centered in its code row.
pub const CARET_HEIGHT: f32 = CODE_ROW - 2.0 * CARET_INSET;

/// What: Where a vertical position falls: the source line and whether the point is in that line's block of
///       virtual rows instead of its code row. `usize` is the line index type ropes use (siblings `u32`, `u64`).
/// Why: A click in a block acts on the block's own code line, while hover and Ctrl+click treat a block as
///      "over no character"; both need the line and the part.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Place = { line: number; inBlock: boolean };
/// ```
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Place {
    /// Zero-based source line.
    pub line: usize,
    /// The point is above the line's code row, inside its virtual rows or their gap.
    pub in_block: bool,
}

/// What: The vertical layout of a whole text: its line count and the lines that own a block, each with the
///       block's height. `Vec<T>` is a growable list (siblings: fixed `[T; N]`, borrowed `&[T]`).
/// Why: Blocks are sparse, so only they are stored; positions come from two binary searches, whatever the
///      file size. `before[i]` is the summed height of all blocks above block `i`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type RowMap = { lines: number; blocks: [line: number, height: number][]; before: number[] };
/// ```
#[derive(Clone, Debug, Default, PartialEq)]
pub struct RowMap {
    /// Number of source lines; an empty text still has one.
    lines: usize,
    /// Lines owning a block, in ascending order, with the block height in logical pixels.
    blocks: Vec<(usize, f32)>,
    /// Summed height of the blocks before each entry of `blocks`.
    before: Vec<f32>,
}

/// Build the map and answer where lines and pixels are.
impl RowMap {
    /// A text of `lines` lines without any block: line `n` starts at `n * CODE_ROW`.
    pub fn plain(lines: usize) -> Self {
        return Self::new(lines, &[]);
    }

    /// What: A text of `lines` lines where each `(line, height)` pair of `raised` puts a block of that height
    ///       above that line's code row. `&[(usize, f32)]` lends the pairs, which must ascend by line.
    /// Why: The annotation store computes block heights; the map only turns them into positions. A block of
    ///      no height, or on a line the text does not have, is left out.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// static from(lines: number, raised: [number, number][]): RowMap;
    /// ```
    pub fn new(lines: usize, raised: &[(usize, f32)]) -> Self {
        // `Vec::new()` creates the empty lists the loop fills.
        let mut blocks = Vec::new();
        let mut before = Vec::new();
        let mut total: f32 = 0.0;
        for (line, height) in raised {
            if *height <= 0.0 || *line >= lines.max(1) {
                continue;
            }
            blocks.push((*line, *height));
            before.push(total);
            total += *height;
        }
        return Self {
            lines: lines.max(1),
            blocks,
            before,
        };
    }

    /// Number of source lines the map describes.
    pub fn lines(&self) -> usize {
        return self.lines;
    }

    /// What: Index of the first stored block whose line is `line` or later.
    /// Why: Every position query starts from the blocks above a line.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// const index = blocks.findIndex(([owner]) => owner >= line);
    /// ```
    fn index_of(&self, line: usize) -> usize {
        // `partition_point` is a binary search for the first entry the closure rejects.
        return self
            .blocks
            .partition_point(|(owner, _)| return *owner < line);
    }

    /// Summed height of every block above `line`'s own block.
    fn raised_before(&self, line: usize) -> f32 {
        let index = self.index_of(line);
        if index < self.before.len() {
            return self.before[index];
        }
        return self.raised();
    }

    /// Summed height of every block.
    fn raised(&self) -> f32 {
        // What: `last()` lends the final entry or nothing; `map_or` reads it or answers zero.
        // Why: The total is the last prefix plus the last block's own height.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return blocks.length ? before.at(-1) + blocks.at(-1)[1] : 0;
        // ```
        return self.blocks.last().map_or(0.0, |(_, height)| {
            return self.before[self.before.len() - 1] + *height;
        });
    }

    /// Height of the block above `line`'s code row; zero for a line without one.
    pub fn block_height(&self, line: usize) -> f32 {
        let index = self.index_of(line);
        // `get` lends the entry at `index`, or nothing past the end.
        if let Some((owner, height)) = self.blocks.get(index)
            && *owner == line
        {
            return *height;
        }
        return 0.0;
    }

    /// Top of `line`'s block, which is the top of everything the line owns. `line` may equal the line count;
    /// the answer is then the height of the whole text.
    pub fn block_top(&self, line: usize) -> f32 {
        let bounded = line.min(self.lines);
        return bounded as f32 * CODE_ROW + self.raised_before(bounded);
    }

    /// Top of `line`'s code row.
    pub fn code_top(&self, line: usize) -> f32 {
        return self.block_top(line) + self.block_height(line);
    }

    /// Bottom of `line`'s code row, where the next line's block or code row starts.
    pub fn code_bottom(&self, line: usize) -> f32 {
        return self.code_top(line) + CODE_ROW;
    }

    /// Height of the whole text: every code row and every block.
    pub fn height(&self) -> f32 {
        return self.lines as f32 * CODE_ROW + self.raised();
    }

    /// What: The line owning vertical position `y`, and whether `y` is in its block. Positions above the text
    ///       belong to the first line and positions below it to the last line's code row.
    /// Why: Pointer events and the scroll offset are pixels; everything else works on source lines.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// locate(y: number): Place;
    /// ```
    pub fn locate(&self, y: f32) -> Place {
        let last = self.lines - 1;
        if y >= self.height() {
            return Place {
                line: last,
                in_block: false,
            };
        }
        let bounded = y.max(0.0);
        // The first block whose top lies below the point; the one before it, if any, starts at or above it.
        let after = self.blocks.partition_point(|(owner, _)| {
            return self.block_top(*owner) <= bounded;
        });
        if after == 0 {
            // What: `as usize` truncates the non-negative quotient to a line index.
            // Why: No block starts at or above the point, so rows are plain down to it.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return { line: Math.min(Math.floor(y / CODE_ROW), last), inBlock: false };
            // ```
            return Place {
                line: ((bounded / CODE_ROW) as usize).min(last),
                in_block: false,
            };
        }
        let (owner, height) = self.blocks[after - 1];
        let code = self.block_top(owner) + height;
        if bounded < code {
            return Place {
                line: owner,
                in_block: true,
            };
        }
        return Place {
            line: (owner + ((bounded - code) / CODE_ROW) as usize).min(last),
            in_block: false,
        };
    }

    /// The line owning vertical position `y`, whichever of its parts the point is in.
    pub fn line_at(&self, y: f32) -> usize {
        return self.locate(y).line;
    }

    /// What: Height of everything `line` owns: its block and its code row. A line the text does not have
    ///       counts as one plain row.
    /// Why: A page step is measured in whole lines, also where a page reaches past either end of the text.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// extent(line: number): number;
    /// ```
    fn extent(&self, line: usize) -> f32 {
        if line >= self.lines {
            return CODE_ROW;
        }
        return self.block_height(line) + CODE_ROW;
    }

    /// What: One page step from a view whose top edge is at `offset` and which is `height` tall: the number of
    ///       lines that fit, at least one, and their summed height. `forward` counts from the top line down,
    ///       otherwise the lines above it. The answer is a pair (tuple).
    /// Why: PageUp and PageDown move the caret by whole lines and the view by exactly the pixels those lines
    ///      take, which is no longer a multiple of one row height once blocks take space.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// page(offset: number, height: number, forward: boolean): [lines: number, pixels: number];
    /// ```
    pub fn page(&self, offset: f32, height: f32, forward: bool) -> (usize, f32) {
        let start = self.line_at(offset);
        let mut count: usize = 0;
        let mut pixels: f32 = 0.0;
        loop {
            // Above the first line there is nothing to measure; such steps count as plain rows.
            let mut step = CODE_ROW;
            if forward {
                step = self.extent(start + count);
            } else if count < start {
                step = self.extent(start - count - 1);
            }
            if count > 0 && pixels + step > height {
                break;
            }
            pixels += step;
            count += 1;
            if pixels >= height {
                break;
            }
        }
        return (count, pixels);
    }
}
