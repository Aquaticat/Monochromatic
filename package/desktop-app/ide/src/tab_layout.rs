//! Shape one projected line so that every tab ends on a pixel tab stop.
//!
//! The shaping engine has no tab stops.
//!  Each tab is shaped as one space,
//! and that space's advance is corrected through letter spacing on its single byte.
//! A line whose tabs follow other text is shaped twice:
//!  once to measure where each tab starts,
//! once with the corrections.
//!  A line whose tabs are all leading needs no measuring pass.

/// The shaper owns fonts and scratch space;
///  this module only decides tab corrections.
use crate::shaped_text::TextShaper;
/// Pixel tab-stop arithmetic,
///  independent of fonts.
use crate::tab_stop::tab_spacings;
/// The projection marks which display bytes stand in for source tabs.
use crate::text_projection::Projection;
/// What:
///  Import the shaping engine's paragraph and caret types.
/// Why:
///  A caret's position before a tab is exactly where that tab starts.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { Affinity, Cursor, Layout } from 'parley';
/// ```
use parley::{Affinity, Cursor, Layout};

/// Physical x of the boundary before display byte `byte`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function xBefore(layout: Layout, byte: number): number;
/// ```
fn x_before(layout: &Layout<u32>, byte: usize) -> f32 {
    let cursor = Cursor::from_byte_index(layout, byte, Affinity::Downstream);
    // What: `as f32` narrows the engine's 64-bit coordinate (sibling `f64`) to the advance unit.
    // Why: Tab-stop arithmetic works in the same 32-bit floats as glyph advances.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return cursor.geometry(layout, 1).x0;
    // ```
    return cursor.geometry(layout, 1.0).x0 as f32;
}

/// Shape `projection` at `scale` with syntax `roles`,
///  widening each tab to its stop.
///
/// Measurements come back in physical pixels while letter spacing is given in logical pixels,
/// so each correction is divided by `scale` before it is handed to the shaper.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function layoutWithTabs(shaper: TextShaper, projection: Projection, scale: number,
///   roles: [number, number, number][]): Layout;
/// ```
pub(crate) fn layout_with_tabs(
    shaper: &mut TextShaper,
    projection: &Projection,
    scale: f32,
    roles: &[(usize, usize, u32)],
) -> Layout<u32> {
    if projection.tabs.is_empty() {
        return shaper.line_layout(&projection.text, scale, roles, &[]);
    }
    let space = shaper.space_advance(scale);
    // What: `Vec::new()` creates an empty growable list (siblings: fixed `[f32; N]`, borrowed `&[f32]`).
    // Why: The number of tabs differs per line.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const naturals: number[] = [];
    // ```
    let mut naturals = Vec::new();
    // The n-th tab is leading exactly when n tabs, and nothing else, precede it.
    let mut leading = true;
    for (ordinal, byte) in projection.tabs.iter().enumerate() {
        if *byte != ordinal {
            leading = false;
        }
    }
    if leading {
        // Each stand-in space is one space advance wide, so leading tabs start at known positions.
        for ordinal in 0..projection.tabs.len() {
            naturals.push(ordinal as f32 * space);
        }
    } else {
        // Brushes do not change advances, so the measuring pass needs no syntax roles.
        let measured = shaper.line_layout(&projection.text, scale, &[], &[]);
        for byte in &projection.tabs {
            naturals.push(x_before(&measured, *byte));
        }
    }
    let extras = tab_spacings(&naturals, space);
    let mut spacings = Vec::new();
    // What: `zip` pairs the n-th tab byte with the n-th correction.
    // Why: Both lists are in reading order and have one entry per tab.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // projection.tabs.forEach((byte, index) => spacings.push([byte, extras[index] / scale]));
    // ```
    for (byte, extra) in projection.tabs.iter().zip(extras) {
        spacings.push((*byte, extra / scale));
    }
    return shaper.line_layout(&projection.text, scale, roles, &spacings);
}
