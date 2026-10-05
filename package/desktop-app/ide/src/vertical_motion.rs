//! Up, Down, PageUp, and PageDown by shaped pixel position instead of character columns.
//!
//! The caret keeps aiming for the horizontal position where a run of vertical movements started,
//! so passing through a short or empty line does not pull it to the left for the lines after it.
//! Target lines are shaped on demand, because a page movement usually leaves the materialized viewport.

/// Canonical source and the current caret.
use crate::document::Document;
/// The same shaper that paints the viewport supplies the advances for hit testing.
use crate::shaped_text::TextShaper;

/// What: A copyable record; `usize` is an address-sized character index (siblings `u32`, `u64`),
/// `f32` a 32-bit float of logical pixels (sibling `f64`).
/// Why: The remembered x is only meaningful for the caret position it was produced for.
/// Storing that position with it makes every other caret change (pointer, find, reload, Left, Right)
/// invalidate the memory without those code paths knowing about it.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type PreferredColumn = { head: number; x: number };
/// ```
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct PreferredColumn {
    /// Caret position this memory belongs to.
    pub head: usize,
    /// Logical x the caret aims for on every further vertical movement.
    pub x: f32,
}

/// Move the caret `rows` lines down (negative: up) and return the new position with its remembered x.
///
/// `remembered` is used only when it belongs to the current caret position; otherwise the caret's own x is taken.
/// Moving up from the first line goes to the start of the text, and down from the last line to its end,
/// as an ordinary text view does. A larger step than the remaining lines stops on the first or last line.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function vertical(shaper: TextShaper, document: Document, scale: number, rows: number,
///   remembered?: PreferredColumn): PreferredColumn;
/// ```
pub fn vertical(
    shaper: &mut TextShaper,
    document: &Document,
    scale: f32,
    rows: isize,
    remembered: Option<PreferredColumn>,
) -> PreferredColumn {
    let text = document.text();
    let head = document.position().head;
    let row = text.char_to_line(head);
    // What: `if let Some(column)` runs only when a memory exists; `&& column.head == head` checks it is current;
    // the whole `if`/`else` is an expression whose branch value initializes `aim`.
    // Why: A memory for another caret position describes a movement that has since been interrupted,
    // and the current line is shaped only when no usable memory exists.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const aim = remembered?.head === head ? remembered.x : shaper.row(document, row, scale).caretX(head, scale);
    // ```
    let aim = if let Some(column) = remembered
        && column.head == head
    {
        column.x
    } else {
        shaper.row(document, row, scale).caret_x(head, scale)
    };
    let last = text.len_lines().saturating_sub(1);
    if rows < 0 && row == 0 {
        return PreferredColumn { head: 0, x: aim };
    }
    if rows > 0 && row == last {
        return PreferredColumn {
            head: text.len_chars(),
            x: aim,
        };
    }
    // What: `saturating_add_signed` adds a signed step to an unsigned row and stops at zero instead of wrapping.
    // Why: A page up near the top must land on the first line, not on a huge wrapped index.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const target = Math.min(Math.max(row + rows, 0), last);
    // ```
    let target = row.saturating_add_signed(rows).min(last);
    let landed = shaper.row(document, target, scale).hit(aim, scale);
    return PreferredColumn {
        head: landed,
        x: aim,
    };
}
