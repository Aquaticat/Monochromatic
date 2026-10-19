//! What a kept unit of the picture is valid for.
//!  A unit is rendered again only when its key differs:
//!  the text and its classes,
//! the palette,
//! the geometry of the picture,
//!  and the overlays that touch the lines it renders (the selection,
//! the matches,
//! the annotations).

/// The geometry and the fill inks.
use super::fills::Fills;
/// A band names its lines,
/// clip and stretch.
use super::plan::Band;
/// What a band is rendered from.
use super::render::{Scene, blocks_between, marks_between};
/// Hints and diagnostics are compared by value.
use crate::annotation::Mark;
/// The annotation inks.
use crate::annotation_layout::AnnotationColors;
/// The matches of the in-file find.
use crate::find::FindRange;
/// The matches that touch a stretch of characters.
use crate::find_navigation::visible;
/// Which text a picture is for.
use crate::language::identity::DocumentStamp;
/// The glyph palette.
use crate::text_raster::CodeColors;
/// Blocks of virtual rows.
use crate::virtual_row::Block;
/// Ranges of characters and shared blocks.
use std::{ops::Range, sync::Arc};

/// What:
///  The identity of the text and its classes.
/// Why:
///  The file generation and the revision say which text,
///  and the address of the shared classes says which highlighting.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Identity = { stamp: DocumentStamp; styles: number };
/// ```
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Identity {
    /// File generation and revision.
    pub stamp: DocumentStamp,
    /// Address of the syntax snapshot.
    pub styles: usize,
}

/// What:
///  Everything every unit of one picture shares.
/// Why:
///  A change of any of them changes every unit.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Shared = { identity: Identity; colors: CodeColors; ...; scale: number };
/// ```
#[derive(Clone, Copy, PartialEq)]
pub struct Shared {
    /// The text.
    pub identity: Identity,
    /// The glyph palette.
    pub colors: CodeColors,
    /// The annotation inks.
    pub inks: AnnotationColors,
    /// The fill inks.
    pub fills: Fills,
    /// Exact bits of the display scale.
    pub scale: u32,
    /// Exact bits of the wrap width,
    /// zero for none.
    pub wrap: u32,
    /// Exact bits of the output rows for each source row.
    pub ratio: u64,
    /// Output columns.
    pub width: usize,
}

/// What:
///  The key of a unit:
///  what one band renders,
///  with what every unit of the picture shares.
///  The band's lines,
/// its clip and stretch,
/// the heights of the lines,
///  and the overlays that touch them.
/// Why:
///  The overlays are compared as the band would draw them,
///  clipped to the band's characters,
///  so a selection elsewhere in the text changes nothing here;
///  equal keys render equal pixels.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type UnitKey = { shared: Shared; lines: [number, number]; clip: [number, number]; marks: Mark[] /* ... */ };
/// ```
#[derive(Clone, PartialEq)]
pub struct UnitKey {
    /// What every unit shares.
    pub shared: Shared,
    /// First line and the number of lines.
    pub lines: (usize, usize),
    /// Exact bits of the clip.
    pub clip: (u32, u32),
    /// Exact bits of the stretch of the text the band answers for,
    /// and whether it is the last band.
    pub span: (u32, u32, bool),
    /// The rows of each line and the exact bits of its block's height.
    pub layout: Vec<(usize, u32)>,
    /// The part of the selection in the band's characters,
    /// and one character past them.
    pub selection: Option<Range<usize>>,
    /// The matches that touch the band's characters.
    pub matches: Vec<FindRange>,
    /// The active match when it touches them.
    pub active: Option<FindRange>,
    /// The blocks of virtual rows of the lines.
    pub blocks: Vec<Arc<Block>>,
    /// The diagnostics that touch the lines.
    pub marks: Vec<Mark>,
}

/// Where a unit puts its rows:
/// the same for the same geometry and the same stretch,
/// whatever the text.
impl UnitKey {
    /// Whether `other` puts its rows in the same place as this one.
    pub fn same_place(&self, other: &Self) -> bool {
        return self.shared.ratio == other.shared.ratio
            && self.shared.width == other.shared.width
            && self.span == other.span;
    }
}

/// The key of the unit that renders `band` in `scene`.
pub fn key_of(band: &Band, scene: &Scene, shared: Shared) -> UnitKey {
    let text = scene.document.text();
    let position = scene.document.position();
    let low = position.anchor.min(position.head);
    let high = position.anchor.max(position.head);
    let end = band.first + band.count;
    let start_char = text.line_to_char(band.first);
    let end_char = if end < text.len_lines() {
        text.line_to_char(end)
    } else {
        text.len_chars()
    };
    let mut layout = Vec::new();
    for line in band.first..end {
        layout.push((
            scene.map.rows_of(line),
            scene.map.block_height(line).to_bits(),
        ));
    }
    let selection = if high > low && low <= end_char && high > start_char {
        Some(low.max(start_char)..high.min(end_char + 1))
    } else {
        None
    };
    let active = match scene.active {
        Some(range) if range.start <= end_char && range.end > start_char => Some(range),
        _ => None,
    };
    return UnitKey {
        shared,
        lines: (band.first, band.count),
        clip: (band.clip.top.to_bits(), band.clip.bottom.to_bits()),
        span: (
            band.span.start.to_bits(),
            band.span.end.to_bits(),
            band.last,
        ),
        layout,
        selection,
        matches: visible(scene.ranges, start_char, end_char).to_vec(),
        active,
        blocks: blocks_between(scene.blocks, band.first, end),
        marks: marks_between(scene.marks, start_char, end_char),
    };
}
