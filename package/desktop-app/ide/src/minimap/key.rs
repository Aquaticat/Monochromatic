//! What a kept unit of the picture is valid for.
//!  A unit is rendered again only when its key differs:
//!  the text of its lines and their syntax classes,
//! the palette,
//! the geometry of the picture,
//!  and the overlays that touch the lines it renders (the selection,
//! the matches,
//! the annotations).
//!  Everything about the text is taken from the lines the band renders and measured from the band's first character,
//!  so an edit changes the keys of the bands it touches and no others.

/// The geometry and the fill inks.
use super::fills::Fills;
/// A band names its lines,
/// clip and stretch.
use super::plan::Band;
/// What a band is rendered from.
use super::render::{Scene, blocks_between, marks_between};
/// The annotation inks.
use crate::annotation_layout::AnnotationColors;
/// The matches that touch a stretch of characters.
use crate::find_navigation::visible;
/// A diagnostic's severity is part of how it is drawn.
use crate::language::diagnostics::Severity;
/// Syntax classes by character offset.
use crate::source_style::StyleSpan;
/// The glyph palette.
use crate::text_raster::CodeColors;
/// Blocks of virtual rows.
use crate::virtual_row::Block;
/// Ranges of characters and shared blocks.
use std::{ops::Range, sync::Arc};

/// What:
///  Everything every unit of one picture shares.
/// Why:
///  A change of any of them changes every unit.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Shared = { colors: CodeColors; inks: AnnotationColors; fills: Fills; scale: number; /* ... */ };
/// ```
#[derive(Clone, Copy, PartialEq)]
pub struct Shared {
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
///  A 64-bit digest of bytes written in any number of pieces.
/// Why:
///  The key of a band holds the digest of its text and of its syntax classes instead of copies,
///  so a band cut from the middle of a very long line costs a few words;
///  the digest is FNV-1a, whose result does not depend on how a rope cut its text into chunks.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// class Digest { bytes(piece: Uint8Array): void; number(value: number): void; finish(): bigint }
/// ```
struct Digest {
    /// The running hash.
    state: u64,
}

/// Feeding and reading a digest.
impl Digest {
    /// FNV-1a's offset basis.
    const BASIS: u64 = 0xcbf2_9ce4_8422_2325;
    /// FNV-1a's prime.
    const PRIME: u64 = 0x0000_0100_0000_01b3;

    /// An empty digest.
    fn new() -> Self {
        return Self { state: Self::BASIS };
    }

    /// Feed `piece`.
    fn bytes(&mut self, piece: &[u8]) {
        for byte in piece {
            self.state = (self.state ^ u64::from(*byte)).wrapping_mul(Self::PRIME);
        }
    }

    /// Feed `value` as eight bytes.
    fn number(&mut self, value: usize) {
        self.bytes(&(value as u64).to_le_bytes());
    }
}

/// The digest of the characters `start` to `end` of the text.
fn text_digest(scene: &Scene, start: usize, end: usize) -> u64 {
    let mut digest = Digest::new();
    for chunk in scene.document.text().slice(start..end).chunks() {
        digest.bytes(chunk.as_bytes());
    }
    digest.number(end - start);
    return digest.state;
}

/// The digest of the syntax classes that reach the characters `start` to `end`,
/// each clipped to them and measured from `start`:
/// what the shaper makes of the classes for those lines.
fn styles_digest(styles: &[StyleSpan], start: usize, end: usize) -> u64 {
    // Spans ascend and do not overlap, so a halving search finds the first one that reaches the band.
    let mut reaching = 0;
    let mut high = styles.len();
    while reaching < high {
        let middle = reaching + (high - reaching) / 2;
        if styles[middle].end <= start {
            reaching = middle + 1;
        } else {
            high = middle;
        }
    }
    let mut digest = Digest::new();
    for span in &styles[reaching..] {
        if span.start >= end {
            break;
        }
        digest.number(span.start.max(start) - start);
        digest.number(span.end.min(end) - start);
        digest.number(span.style);
    }
    return digest.state;
}

/// A position `at`, measured from the band's first character `base`;
/// negative when it lies before the band.
fn from_base(at: usize, base: usize) -> i64 {
    return at as i64 - base as i64;
}

/// What:
///  The key of a unit:
///  what one band renders,
///  with what every unit of the picture shares.
///  The band's lines,
/// its clip and stretch,
/// the heights of the lines,
///  the digests of their text and syntax classes,
///  and the overlays that touch them.
/// Why:
///  The overlays are compared as the band would draw them,
///  clipped to the band's characters and measured from the first,
///  so a selection elsewhere in the text, or an edit before the band that moves its characters, changes nothing here;
///  equal keys render equal pixels.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type UnitKey = { shared: Shared; lines: [number, number]; clip: [number, number]; text: bigint; styles: bigint;
///   marks: [number, number, Severity][] /* ... */ };
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
    /// The digest of the characters of the lines.
    pub text: u64,
    /// The digest of the syntax classes that reach the lines.
    pub styles: u64,
    /// The part of the selection in the band's characters,
    /// and one character past them,
    /// from the band's first character.
    pub selection: Option<Range<usize>>,
    /// The matches that touch the band's characters,
    /// from the band's first character.
    pub matches: Vec<(i64, i64)>,
    /// The active match when it touches them,
    /// from the band's first character.
    pub active: Option<(i64, i64)>,
    /// The blocks of virtual rows of the lines.
    pub blocks: Vec<Arc<Block>>,
    /// The diagnostics that touch the lines,
    /// from the band's first character.
    pub marks: Vec<(i64, i64, Severity)>,
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
        Some(low.max(start_char) - start_char..high.min(end_char + 1) - start_char)
    } else {
        None
    };
    let active = match scene.active {
        Some(range) if range.start <= end_char && range.end > start_char => Some((
            from_base(range.start, start_char),
            from_base(range.end, start_char),
        )),
        _ => None,
    };
    let mut matches = Vec::new();
    for range in visible(scene.ranges, start_char, end_char) {
        matches.push((
            from_base(range.start, start_char),
            from_base(range.end, start_char),
        ));
    }
    let mut marks = Vec::new();
    for mark in marks_between(scene.marks, start_char, end_char) {
        marks.push((
            from_base(mark.start, start_char),
            from_base(mark.end, start_char),
            mark.severity,
        ));
    }
    return UnitKey {
        shared,
        lines: (band.first, band.count),
        clip: (band.clip.top.to_bits(), band.clip.bottom.to_bits()),
        span: (band.span.start.to_bits(), band.span.end.to_bits(), band.last),
        layout,
        text: text_digest(scene, start_char, end_char),
        styles: styles_digest(scene.styles, start_char, end_char),
        selection,
        matches,
        active,
        blocks: blocks_between(scene.blocks, band.first, end),
        marks,
    };
}
