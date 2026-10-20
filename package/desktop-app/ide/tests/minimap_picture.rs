//! The minimap's picture without a window:
//!  the plan of bands,
//! the picture as the box average of one frame of the whole text,
//!  the fills of the selection and the matches,
//! the cache,
//! the budgets,
//! a band that fails,
//!  the window of a long text and what an edit renders again,
//! and a build that is cancelled.

/// Diagnostics are marks of a range with a severity.
use ide_app::annotation::Mark;
/// The inks of hints and diagnostics.
use ide_app::annotation_layout::{AnnotationColors, lay_out};
/// The text and its reading position.
use ide_app::document::{Document, ReadingAffinity, ReadingPosition};
/// The matches of the in-file find.
use ide_app::find::FindRange;
/// The match rectangles of a frame.
use ide_app::find_paint::rectangles;
/// Severity of a diagnostic.
use ide_app::language::diagnostics::Severity;
/// The lines' visual rows.
use ide_app::line_rows::LineRows;
/// The picture,
/// its plan,
/// and its parts.
use ide_app::minimap::{
    BAND_BYTES, BUILD_WORK, Built, Cache, Cancel, Fills, Geometry, Input, Picture, Reducer,
    Reduction, Scene, Strip, band_count, band_height, band_step, build, paint_fills, plan, prepare,
    render, text_span,
};
/// The vertical mapping.
use ide_app::row_map::{CODE_ROW, RowMap};
/// Shaping and the frame it prepares.
use ide_app::shaped_text::{
    TextShaper, Viewport, raster_fits, raster_width, set_texture_dimension,
};
/// Syntax classes.
use ide_app::source_style::StyleSpan;
/// The painter and its palette.
use ide_app::text_raster::{CodeColors, TextRaster};
/// A window of bands is a range of their numbers.
use std::ops::Range;

/// The dark scheme's palette of the tests.
const DARK: CodeColors = CodeColors {
    foreground: [220, 220, 220, 255],
    selected: [255, 255, 255, 255],
    dark: true,
};

/// The annotation inks of the tests.
const INKS: AnnotationColors = AnnotationColors {
    hint: [150, 160, 170, 255],
    error: [255, 110, 120, 255],
    warning: [240, 200, 40, 255],
    information: [90, 200, 250, 255],
    suggestion: [170, 170, 170, 255],
};

/// The fill inks of the tests:
/// a selection no glyph has the color of.
const FILLS: Fills = Fills {
    selection: [30, 90, 200, 255],
    foreground: [220, 220, 220, 255],
    boundary: false,
};

/// A build that is never cancelled.
struct Never;

impl Cancel for Never {
    /// Never cancelled.
    fn is_cancelled(&self) -> bool {
        return false;
    }
}

/// A build that is cancelled before it starts.
struct Always;

impl Cancel for Always {
    /// Always cancelled.
    fn is_cancelled(&self) -> bool {
        return true;
    }
}

/// Everything a scene borrows,
/// owned.
struct Fixture {
    /// The text and its selection.
    document: Document,
    /// Syntax classes.
    styles: Vec<StyleSpan>,
    /// The vertical mapping,
    /// with the rows the wrapped lines really have.
    map: RowMap,
    /// Diagnostic marks.
    marks: Vec<Mark>,
    /// Find matches.
    ranges: Vec<FindRange>,
    /// The width lines are broken at.
    wrap: Option<f32>,
    /// Physical pixels per logical pixel.
    scale: f32,
}

/// A text of ordinary code with some lines long enough to wrap at `wrap`.
fn code(lines: usize) -> String {
    let mut text = String::new();
    for number in 0..lines {
        if number > 0 {
            text.push('\n');
        }
        if number % 7 == 3 {
            text.push_str(&format!(
                "    let value_{number} = compute({number}, \"a long argument that has to wrap\", Some(other.field), [1, 2, 3, 4, 5, 6, 7, 8]);"
            ));
        } else {
            text.push_str(&format!("let value_{number} = compute({number});"));
        }
    }
    return text;
}

/// Syntax classes that color the words of every line in turn.
fn styles_of(text: &str) -> Vec<StyleSpan> {
    let mut styles = Vec::new();
    let mut offset = 0;
    for (index, word) in text.split_inclusive(' ').enumerate() {
        let length = word.chars().count();
        if index % 3 == 0 && length > 1 {
            styles.push(StyleSpan {
                start: offset,
                end: offset + length - 1,
                style: 1 + index % 5,
            });
        }
        offset += length;
    }
    return styles;
}

/// A fixture of `lines` lines at `scale`,
/// wrapped at `wrap` with the rows the shaper finds.
fn fixture(lines: usize, wrap: f32, scale: f32) -> Fixture {
    return fixture_of(&code(lines), wrap, scale);
}

/// A fixture of `text` at `scale`,
/// wrapped at `wrap` with the rows the shaper finds.
fn fixture_of(text: &str, wrap: f32, scale: f32) -> Fixture {
    let document = Document::new(text);
    let mut shaper = TextShaper::new();
    let mut rows = LineRows::plain(document.text().len_lines());
    let mut measured = Vec::new();
    for line in 0..document.text().len_lines() {
        let count = shaper
            .wrapped_row(&document, line, scale, wrap)
            .visual_rows();
        measured.push((line, count));
    }
    rows.apply(measured);
    let map = RowMap::plain(document.text().len_lines()).with_rows(&rows);
    return Fixture {
        styles: styles_of(text),
        document,
        map,
        marks: Vec::new(),
        ranges: Vec::new(),
        wrap: Some(wrap),
        scale,
    };
}

/// A scene of the fixture.
impl Fixture {
    /// The scene the bands are rendered from.
    fn scene(&self, fills: Fills) -> Scene<'_> {
        return Scene {
            document: &self.document,
            styles: &self.styles,
            map: &self.map,
            colors: DARK,
            inks: INKS,
            fills,
            blocks: &[],
            marks: &self.marks,
            ranges: &self.ranges,
            active: None,
            wrap: self.wrap,
            width: raster_width(self.wrap),
            scale: self.scale,
        };
    }

    /// The input of a build in a view `view` tall and a minimap `width` wide.
    fn input<'a>(&self, scene: Scene<'a>, view: f32, width: f32) -> Input<'a> {
        return Input {
            scene,
            view,
            width,
            window: self.all(),
        };
    }

    /// The numbers of every band of the text.
    fn all(&self) -> Range<usize> {
        return 0..band_count(self.map.height(), band_step(self.wrap, self.scale));
    }

    /// Select the characters `anchor` to `head`.
    fn select(&mut self, anchor: usize, head: usize) {
        self.document.select(ReadingPosition {
            anchor,
            head,
            viewport: 0,
            affinity: ReadingAffinity::Downstream,
        });
    }
}

/// The picture of the fixture in one go.
fn picture(fixture: &Fixture, fills: Fills, view: f32, width: f32) -> Built {
    let scene = fixture.scene(fills);
    let input = fixture.input(scene, view, width);
    let mut shaper = TextShaper::new();
    let mut raster = TextRaster::new();
    let prepared = prepare(&input);
    return build(
        &mut shaper,
        &mut raster,
        &input,
        &prepared,
        &mut Cache::new(),
        BUILD_WORK,
        &Never,
    )
    .expect("a picture");
}

/// What:
///  The picture a single frame of the whole text gives,
///  reduced in one strip:
///  the independent reference of the banded build.
/// Why:
///  The bands,
/// the stitch,
/// and the cache are all absent from it.
fn whole_frame(fixture: &Fixture, fills: Fills, view: f32, width: f32) -> (Vec<u8>, usize, usize) {
    let scene = fixture.scene(fills);
    let scale = fixture.scale;
    let geometry = Geometry::new(fixture.map.height(), view);
    let ratio = f64::from(geometry.scale());
    let out_width = ((width * scale).round() as usize).max(1);
    let out_height =
        (f64::from(fixture.map.height()) * f64::from(scale) * ratio - 1e-3).ceil() as usize;
    // The reference is a CPU raster of the whole text in one frame; it is never a GPU texture,
    // so the device's texture size (8192 pixels unless a device says more) does not bound it.
    set_texture_dimension(u32::MAX);
    let mut shaper = TextShaper::new();
    let mut raster = TextRaster::new();
    let lines = fixture.document.text().len_lines();
    let viewport = Viewport {
        first: 0,
        count: lines,
        width: scene.width,
        scale,
        wrap: fixture.wrap,
        clip: None,
    };
    let mut frame = shaper.prepare_rows(&fixture.document, viewport, &fixture.styles, &fixture.map);
    frame.matches = rectangles(&frame, scene.ranges, scene.active);
    let visible = ide_app::annotation::Visible {
        blocks: Vec::new(),
        marks: fixture.marks.clone(),
    };
    frame.annotations = Some(lay_out(&frame, &visible, &mut shaper, INKS));
    let mut bytes = vec![0; frame.width as usize * frame.height as usize * 4];
    paint_fills(&mut bytes, (frame.width, frame.height), &frame, fills);
    let pixels = raster
        .paint_onto(&frame, DARK, 0.0, bytes)
        .expect("a frame within the limit");
    let reduction = Reduction {
        source_width: f64::from(text_span(fixture.wrap)) * f64::from(scale),
        width: out_width,
        ratio,
    };
    let reducer = Reducer::new(reduction, pixels.width as usize);
    let strip = Strip {
        bytes: &pixels.bytes,
        width: pixels.width as usize,
        height: pixels.height as usize,
        top: f64::from(frame.origin) * f64::from(scale),
    };
    let reduced = reducer.reduce(&strip, &(0.0..f64::INFINITY));
    let mut picture = Picture::new(out_width, 0..out_height);
    picture.place(&reduced).expect("same width");
    return (picture.finish(), out_width, out_height);
}

/// The largest channel difference between two pictures of the same size.
fn worst_difference(left: &[u8], right: &[u8]) -> u8 {
    assert_eq!(left.len(), right.len(), "pictures of different sizes");
    let mut worst = 0;
    for (one, other) in left.iter().zip(right) {
        worst = worst.max(one.abs_diff(*other));
    }
    return worst;
}

/// Bands cover the text from its first pixel to its last,
/// one after the other,
/// each within the band budget,
/// whatever the text's height,
/// the window's width,
/// and the scale.
#[test]
fn bands_cover_the_text_exactly_and_stay_within_their_budget() {
    let mut rows = LineRows::plain(2_000);
    // One line wrapped to thousands of rows, and others to a few.
    rows.apply([(10, 5_000), (500, 3), (1_999, 40)]);
    let tall = RowMap::plain(2_000).with_rows(&rows);
    let plain = RowMap::plain(50_000);
    let blocks = RowMap::new(300, &[(0, 17.0), (5, 48.0), (299, 31.0)]);
    for map in [&tall, &plain, &blocks] {
        for scale in [0.5_f32, 1.0, 1.25, 2.0, 3.0] {
            for width in [160.0_f32, 700.0, 1354.0, 3000.0, 7600.0] {
                let columns = (raster_width(Some(width)) * scale).ceil() as u64;
                let step = band_height(columns, scale);
                let bands = plan(map, columns, scale, 0..band_count(map.height(), step));
                let mut edge = 0.0_f32;
                let mut line = 0;
                for (index, band) in bands.iter().enumerate() {
                    assert_eq!(
                        band.span.start, edge,
                        "band {index} starts where the last ended"
                    );
                    assert!(band.span.end > band.span.start);
                    assert!(
                        band.first >= line,
                        "a band never starts before the line of the band before it"
                    );
                    line = band.first;
                    assert_eq!(band.last, index + 1 == bands.len());
                    let band_rows = ((band.clip.bottom - band.clip.top) * scale).ceil() as u64;
                    // A window so wide that the shortest band passes the budget gets the shortest band.
                    let shortest = columns * 4 * (4.0 * CODE_ROW * scale).ceil() as u64;
                    assert!(
                        columns * band_rows * 4 <= BAND_BYTES.max(shortest),
                        "band {index} holds {} bytes",
                        columns * band_rows * 4
                    );
                    assert!(raster_fits(columns, band_rows));
                    assert!(
                        band.clip.top >= 0.0 && band.clip.top < band.clip.bottom,
                        "band {index} has a clip {:?}",
                        band.clip
                    );
                    // The clip holds the whole stretch.
                    let first_top = map.block_top(band.first);
                    assert!(first_top + band.clip.top <= band.span.start + 1e-3);
                    assert!(
                        first_top + band.clip.bottom + 1e-3 >= band.span.end,
                        "band {index} stops at {} before its stretch ends at {}",
                        first_top + band.clip.bottom,
                        band.span.end
                    );
                    edge = band.span.end;
                }
                assert_eq!(edge, map.height(), "the stretches end where the text does");
            }
        }
    }
    // A band is never taller than the budget allows, and never shorter than two rows.
    assert!(band_height(1_000_000, 3.0) >= 2.0 * CODE_ROW);
}

/// The picture is the box average of the window's own rendering:
/// the banded build equals the reduction of one frame of the whole text,
/// with a selection,
/// find matches,
/// wrapped lines,
/// and a diagnostic,
/// at scale one and two.
#[test]
fn the_picture_is_the_box_average_of_one_frame_of_the_whole_text() {
    for scale in [1.0_f32, 2.0] {
        let mut fixture = fixture(200, 300.0, scale);
        let text: String = fixture.document.text().to_string();
        // A selection that crosses the borders of several bands.
        let first = text.find("value_5 ").expect("a word to select");
        let last = text.find("value_90 ").expect("a word to end the selection");
        fixture.select(first, last + 4);
        let mut ranges = Vec::new();
        for needle in ["compute(11)", "compute(77)", "compute(160)"] {
            let at = text.find(needle).expect("a word to match");
            ranges.push(FindRange {
                start: at,
                end: at + 7,
            });
        }
        fixture.ranges = ranges;
        let mut marks = Vec::new();
        for needle in ["value_21 ", "value_190 "] {
            let at = text.find(needle).expect("a word to mark");
            marks.push(Mark {
                start: at,
                end: at + 8,
                severity: Severity::Error,
            });
        }
        fixture.marks = marks;
        let fills = Fills {
            boundary: true,
            ..FILLS
        };
        let built = picture(&fixture, fills, 900.0, 110.0);
        let (expected, width, height) = whole_frame(&fixture, fills, 900.0, 110.0);
        assert_eq!(
            (built.width as usize, built.height as usize),
            (width, height)
        );
        assert!(
            built.stats.rendered > 1,
            "the picture is made of several bands"
        );
        assert_eq!(built.stats.failed + built.stats.skipped, 0);
        let worst = worst_difference(&built.bytes, &expected);
        assert!(
            worst <= 1,
            "at scale {scale} the banded picture differs from the reduction of one frame by {worst}"
        );
        // The picture has ink in the selection's fill, the syntax colors, and the diagnostic.
        let mut blue = 0;
        let mut inked = 0;
        for pixel in built.bytes.chunks(4) {
            if pixel[3] > 0 {
                inked += 1;
            }
            if pixel[2] > pixel[0].saturating_add(20) && pixel[2] > 0 {
                blue += 1;
            }
        }
        assert!(inked > 100, "scale {scale}: only {inked} inked pixels");
        assert!(
            blue > 5,
            "scale {scale}: the selection fill reaches {blue} pixels"
        );
    }
}

/// How many pixels of `bytes` are the opaque selection fill of the tests.
fn selection_fill(bytes: &[u8]) -> usize {
    let mut found = 0;
    for pixel in bytes.chunks(4) {
        if pixel[..3] == [30, 90, 200] && pixel[3] == 255 {
            found += 1;
        }
    }
    return found;
}

/// The selection's fill lies under the glyphs in a band,
/// where the markup draws it:
/// pixels of the selected rows carry the fill's color,
/// and the same band without a selection carries none.
#[test]
fn the_selection_fill_is_drawn_under_the_glyphs_of_a_band() {
    let mut fixture = fixture(6, 600.0, 1.0);
    let band = plan(&fixture.map, 1000, 1.0, 0..1).remove(0);
    let mut shaper = TextShaper::new();
    let mut raster = TextRaster::new();
    let plain = render(&mut shaper, &mut raster, &fixture.scene(FILLS), &band).expect("a band");
    fixture.select(0, 12);
    let selected = render(&mut shaper, &mut raster, &fixture.scene(FILLS), &band).expect("a band");
    assert_eq!(selection_fill(&plain.bytes), 0, "no selection, no fill");
    assert!(
        selection_fill(&selected.bytes) > 12 * 6 * 10,
        "the selected characters have {} pixels of the fill",
        selection_fill(&selected.bytes)
    );
    // The fill is only behind the first row: the pixels below the first code row hold none.
    let row_bytes = selected.width * 4;
    let below = &selected.bytes[(CODE_ROW as usize + 2) * row_bytes..];
    assert_eq!(
        selection_fill(below),
        0,
        "the fill stops with the selected characters"
    );
}

/// An unchanged picture is taken whole from the cache,
/// a new selection renders only the units it touches,
/// and a new palette or scale renders them all.
#[test]
fn only_the_units_whose_inputs_changed_are_rendered_again() {
    let mut fixture = fixture(150, 1354.0, 1.0);
    let mut shaper = TextShaper::new();
    let mut raster = TextRaster::new();
    let mut cache = Cache::new();
    let first = {
        let scene = fixture.scene(FILLS);
        let input = fixture.input(scene, 400.0, 110.0);
        let prepared = prepare(&input);
        build(
            &mut shaper,
            &mut raster,
            &input,
            &prepared,
            &mut cache,
            BUILD_WORK,
            &Never,
        )
        .expect("a picture")
    };
    assert_eq!(first.stats.reused, 0);
    assert!(first.stats.rendered > 3);
    assert_eq!(cache.len(), first.stats.units);
    // The same inputs: nothing is rendered.
    let again = {
        let scene = fixture.scene(FILLS);
        let input = fixture.input(scene, 400.0, 110.0);
        let prepared = prepare(&input);
        build(
            &mut shaper,
            &mut raster,
            &input,
            &prepared,
            &mut cache,
            BUILD_WORK,
            &Never,
        )
        .expect("a picture")
    };
    assert_eq!(again.stats.rendered, 0);
    assert_eq!(again.stats.reused, first.stats.units);
    assert_eq!(again.bytes, first.bytes);
    // A selection inside the first lines changes the units that hold them only.
    fixture.select(0, 20);
    let selected = {
        let scene = fixture.scene(FILLS);
        let input = fixture.input(scene, 400.0, 110.0);
        let prepared = prepare(&input);
        build(
            &mut shaper,
            &mut raster,
            &input,
            &prepared,
            &mut cache,
            BUILD_WORK,
            &Never,
        )
        .expect("a picture")
    };
    assert!(selected.stats.rendered >= 1);
    assert!(
        selected.stats.rendered * 3 <= first.stats.units,
        "a selection in the first lines rendered {} of {} units",
        selected.stats.rendered,
        first.stats.units
    );
    assert_eq!(
        selected.stats.rendered + selected.stats.reused,
        first.stats.units
    );
    assert_ne!(selected.bytes, first.bytes, "the selection shows");
    // A new palette changes every unit (positive control for the cache keys).
    let recolored = {
        let mut scene = fixture.scene(FILLS);
        scene.colors = CodeColors {
            dark: false,
            ..DARK
        };
        let input = fixture.input(scene, 400.0, 110.0);
        let prepared = prepare(&input);
        build(
            &mut shaper,
            &mut raster,
            &input,
            &prepared,
            &mut cache,
            BUILD_WORK,
            &Never,
        )
        .expect("a picture")
    };
    assert_eq!(recolored.stats.reused, 0);
    assert_eq!(recolored.stats.rendered, first.stats.units);
}

/// A unit the work budget cannot pay keeps the rows of the last picture,
/// and is counted and logged rather than blanked.
#[test]
fn a_unit_the_budget_cannot_pay_keeps_the_rows_of_the_last_picture() {
    let mut fixture = fixture(40, 500.0, 1.0);
    let mut shaper = TextShaper::new();
    let mut raster = TextRaster::new();
    let mut cache = Cache::new();
    let before = {
        let scene = fixture.scene(FILLS);
        let input = fixture.input(scene, 300.0, 110.0);
        let prepared = prepare(&input);
        build(
            &mut shaper,
            &mut raster,
            &input,
            &prepared,
            &mut cache,
            BUILD_WORK,
            &Never,
        )
        .expect("a picture")
    };
    // Another selection changes the keys, but no work is allowed.
    fixture.select(0, 30);
    let scene = fixture.scene(FILLS);
    let input = fixture.input(scene, 300.0, 110.0);
    let prepared = prepare(&input);
    let kept = build(
        &mut shaper,
        &mut raster,
        &input,
        &prepared,
        &mut cache,
        0,
        &Never,
    )
    .expect("a picture");
    assert!(kept.stats.skipped >= 1, "the budget skipped nothing");
    assert_eq!(kept.stats.rendered, 0);
    assert_eq!(
        kept.bytes, before.bytes,
        "the rows of the last picture stay"
    );
    // Without a last picture the skipped units are transparent, and the build still answers.
    let mut empty = Cache::new();
    let blank = build(
        &mut shaper,
        &mut raster,
        &input,
        &prepared,
        &mut empty,
        0,
        &Never,
    )
    .expect("a picture");
    let mut all_blank = true;
    for byte in &blank.bytes {
        if *byte != 0 {
            all_blank = false;
        }
    }
    assert!(all_blank, "the skipped units are transparent");
}

/// A band whose frame the shaper must cut to the raster limit cannot be rendered:
/// the render says so,
/// and a build counts every such unit and still answers.
#[test]
fn a_band_that_cannot_be_rendered_is_counted_and_leaves_the_picture_standing() {
    let mut fixture = fixture(8, 400.0, 1.0);
    // A raster so wide that not even three rows of it fit the limit.
    fixture.wrap = Some(5_000_000.0);
    let scene = fixture.scene(FILLS);
    let band = plan(&fixture.map, 5_000_024, 1.0, 0..1).remove(0);
    let mut shaper = TextShaper::new();
    let mut raster = TextRaster::new();
    let error = render(&mut shaper, &mut raster, &scene, &band)
        .err()
        .expect("a frame cut to the limit is refused");
    assert!(format!("{error:#}").contains("raster limit"), "{error:#}");
    let input = fixture.input(scene, 200.0, 110.0);
    let prepared = prepare(&input);
    let built = build(
        &mut shaper,
        &mut raster,
        &input,
        &prepared,
        &mut Cache::new(),
        BUILD_WORK,
        &Never,
    )
    .expect("a picture");
    assert_eq!(built.stats.failed, built.stats.units);
    assert_eq!(built.stats.rendered, 0);
}

/// The part of `whole`'s rows that `part` holds,
/// against `part`'s own:
/// the largest channel difference.
fn crop_difference(whole: &Built, part: &Built) -> u8 {
    assert_eq!(whole.width, part.width, "pictures of different widths");
    let stride = whole.width as usize * 4;
    let from = part.top as usize * stride;
    let to = from + part.height as usize * stride;
    assert!(
        to <= whole.bytes.len(),
        "the rows {from} to {to} are not in a picture of {}",
        whole.bytes.len()
    );
    return worst_difference(&whole.bytes[from..to], &part.bytes);
}

/// The picture of the bands `window` of `fixture`,
/// kept in `cache`.
fn windowed(fixture: &Fixture, window: Range<usize>, cache: &mut Cache) -> Built {
    let scene = fixture.scene(FILLS);
    let input = Input {
        window,
        ..fixture.input(scene, 240.0, 110.0)
    };
    let mut shaper = TextShaper::new();
    let mut raster = TextRaster::new();
    let prepared = prepare(&input);
    return build(
        &mut shaper,
        &mut raster,
        &input,
        &prepared,
        cache,
        BUILD_WORK,
        &Never,
    )
    .expect("a picture");
}

/// A long text builds only the bands near the visible part of the picture,
/// at every scroll,
/// and what it builds is exactly those rows of the picture of the whole text:
/// the window covers the track,
/// holds a few bands,
/// and never passes the raster limit.
#[test]
fn a_long_text_builds_only_the_bands_near_the_visible_part_and_they_are_rows_of_the_whole() {
    // At 1.3 the cuts between bands fall between two pixel rows, as they do at every fractional scale.
    for scale in [1.0_f32, 1.3, 2.0] {
        let mut fixture = fixture(3_000, 700.0, scale);
        // All of the text is selected: the fill covers whole code rows,
        // so a pixel row cut in two by a border has ink on both sides.
        let end = fixture.document.text().len_chars();
        fixture.select(0, end);
        let geometry = Geometry::new(fixture.map.height(), 240.0);
        let step = band_step(fixture.wrap, scale);
        let whole = windowed(&fixture, fixture.all(), &mut Cache::new());
        assert!(
            whole.height as f32 > 20.0 * 240.0 * scale,
            "the text is many views long"
        );
        assert_eq!(whole.stats.failed + whole.stats.skipped, 0);
        for share in [0.0_f32, 0.37, 0.81, 1.0] {
            let offset = geometry.max_offset() * share;
            let window = geometry.bands_for(offset, step);
            let part = windowed(&fixture, window.clone(), &mut Cache::new());
            assert_eq!(part.stats.units, window.len());
            assert!(
                part.stats.units * 8 < whole.stats.units,
                "scale {scale} at {share}: {} of {} bands built",
                part.stats.units,
                whole.stats.units
            );
            assert_eq!(
                crop_difference(&whole, &part),
                0,
                "scale {scale} at {share}: the rows differ from the whole picture's"
            );
            assert!(u64::try_from(part.stats.largest).expect("a size") <= BAND_BYTES);
            // The rows in view are among the rows built.
            let slide = (geometry.slide(offset) * scale).round() as u32;
            let shown = (geometry.track() * scale).ceil() as u32;
            assert!(
                part.top <= slide && slide + shown <= part.top + part.height + 1,
                "scale {scale} at {share}: rows {slide} to {} in view, rows {} to {} built",
                slide + shown,
                part.top,
                part.top + part.height
            );
        }
    }
}

/// A window that slides by a band renders the band that came in and nothing else,
/// the cache keeps the bands of the window and no others,
/// and the rows built are still rows of the whole picture.
#[test]
fn a_window_that_slides_renders_only_the_band_that_came_in() {
    let fixture = fixture(2_000, 700.0, 1.0);
    let whole = windowed(&fixture, fixture.all(), &mut Cache::new());
    let mut cache = Cache::new();
    let first = windowed(&fixture, 10..16, &mut cache);
    assert_eq!(
        (first.stats.rendered, first.stats.reused),
        (6, 0),
        "{:?}",
        first.stats
    );
    assert_eq!(cache.len(), 6);
    let next = windowed(&fixture, 11..17, &mut cache);
    assert_eq!(
        (next.stats.rendered, next.stats.reused),
        (1, 5),
        "one band came in and five stayed"
    );
    assert_eq!(cache.len(), 6, "the band that went out is dropped");
    assert!(cache.get(10).is_none() && cache.get(16).is_some());
    assert_eq!(crop_difference(&whole, &first), 0);
    assert_eq!(crop_difference(&whole, &next), 0);
    assert!(next.top > first.top, "the picture moved down the text");
    // A jump to another place keeps nothing of the old window.
    let far = windowed(&fixture, 30..36, &mut cache);
    assert_eq!((far.stats.rendered, far.stats.reused), (6, 0));
    assert_eq!(cache.len(), 6);
}

/// Where the character `at` stands after the characters from `from` on moved by `by`.
fn moved(at: usize, from: usize, by: i64) -> usize {
    if at >= from {
        return (at as i64 + by) as usize;
    }
    return at;
}

/// `fixture` after the characters `from` to `to` are replaced by `insert`:
/// the lines measured again,
/// the matches and the diagnostics moved with the text after them.
fn edited(fixture: &Fixture, from: usize, to: usize, insert: &str) -> Fixture {
    let mut rope = fixture.document.text().clone();
    rope.remove(from..to);
    rope.insert(from, insert);
    let wrap = fixture.wrap.expect("a wrapped fixture");
    let mut after = fixture_of(&rope.to_string(), wrap, fixture.scale);
    let by = insert.chars().count() as i64 - (to - from) as i64;
    for range in &fixture.ranges {
        after.ranges.push(FindRange {
            start: moved(range.start, to, by),
            end: moved(range.end, to, by),
        });
    }
    for mark in &fixture.marks {
        after.marks.push(Mark {
            start: moved(mark.start, to, by),
            end: moved(mark.end, to, by),
            severity: mark.severity,
        });
    }
    return after;
}

/// An edit renders again the bands it touches and no others:
/// a character changed in one line renders one band,
/// a character added in a line far above renders none even though every character after it moved,
/// and an added line,
/// which moves the rows of everything below it,
/// renders the bands of the window again;
/// the picture is the one a build without a cache gives in every case.
#[test]
fn an_edit_renders_only_the_bands_it_touches() {
    let mut base = fixture(2_000, 700.0, 1.0);
    let text = base.document.text().to_string();
    let found = text.find("value_380 ").expect("a word to match and mark");
    let at = text[..found].chars().count();
    base.ranges = vec![FindRange {
        start: at,
        end: at + 9,
    }];
    base.marks = vec![Mark {
        start: at,
        end: at + 9,
        severity: Severity::Error,
    }];
    let step = band_step(base.wrap, 1.0);
    let line = base.document.text().char_to_line(at);
    let middle = (base.map.block_top(line) / step) as usize;
    let window = middle - 3..middle + 3;
    let mut cache = Cache::new();
    let first = windowed(&base, window.clone(), &mut cache);
    assert_eq!((first.stats.rendered, first.stats.reused), (6, 0));
    let mut inked = false;
    for byte in &first.bytes {
        if *byte != 0 {
            inked = true;
        }
    }
    assert!(inked, "the window holds ink");
    // A character changed in the middle of the window's third band: that band alone is rendered again.
    let inside = base
        .map
        .line_at(step * (window.start + 2) as f32 + step / 2.0);
    let letter = base
        .document
        .text()
        .line(inside)
        .to_string()
        .find('l')
        .expect("a letter to change");
    let from = base.document.text().line_to_char(inside) + letter;
    let changed = edited(&base, from, from + 1, "L");
    let after = windowed(&changed, window.clone(), &mut cache);
    assert_eq!(
        (after.stats.rendered, after.stats.reused),
        (1, 5),
        "one line changed: {:?}",
        after.stats
    );
    let from_scratch = windowed(&changed, window.clone(), &mut Cache::new());
    assert_eq!(
        after.bytes, from_scratch.bytes,
        "the reused bands are still right"
    );
    assert_ne!(after.bytes, first.bytes, "the edit shows");
    // A character added in the first line moves every character after it, the match and the diagnostic with them,
    // and no line: nothing in the window is rendered again.
    let moved_text = edited(&changed, 1, 1, "x");
    let shifted = windowed(&moved_text, window.clone(), &mut cache);
    assert_eq!(
        (shifted.stats.rendered, shifted.stats.reused),
        (0, 6),
        "characters moved, no line: {:?}",
        shifted.stats
    );
    let from_scratch_moved = windowed(&moved_text, window.clone(), &mut Cache::new());
    assert_eq!(shifted.bytes, from_scratch_moved.bytes);
    // A line added above moves every row below it: the bands of the window are rendered again, and no others are.
    let longer = edited(&moved_text, 0, 0, "// a new first line\n");
    let below = windowed(&longer, window.clone(), &mut cache);
    assert_eq!(below.stats.rendered + below.stats.reused, 6);
    assert!(
        below.stats.rendered >= 1,
        "an added line renders the bands it moves"
    );
    let from_scratch_longer = windowed(&longer, window.clone(), &mut Cache::new());
    assert_eq!(below.bytes, from_scratch_longer.bytes);
    assert_eq!(cache.len(), 6, "only the window is kept");
}

/// New syntax classes for the lines of one band render that band again and no other,
/// whatever the text.
#[test]
fn new_syntax_classes_render_only_the_bands_they_reach() {
    let mut base = fixture(2_000, 700.0, 1.0);
    let step = band_step(base.wrap, 1.0);
    let window = 12..18;
    let mut cache = Cache::new();
    let first = windowed(&base, window.clone(), &mut cache);
    assert_eq!((first.stats.rendered, first.stats.reused), (6, 0));
    let inside = base.map.line_at(step * 14.0 + step / 2.0);
    let from = base.document.text().line_to_char(inside);
    let mut changed = 0;
    for span in &mut base.styles {
        if span.start >= from && changed < 3 {
            span.style += 1;
            changed += 1;
        }
    }
    let after = windowed(&base, window.clone(), &mut cache);
    assert_eq!(
        (after.stats.rendered, after.stats.reused),
        (1, 5),
        "the classes of one line changed: {:?}",
        after.stats
    );
    assert_ne!(after.bytes, first.bytes, "the classes show");
    let fresh = windowed(&base, window, &mut Cache::new());
    assert_eq!(after.bytes, fresh.bytes);
}

/// A build that is cancelled answers nothing.
#[test]
fn a_cancelled_build_answers_nothing() {
    let fixture = fixture(10, 500.0, 1.0);
    let scene = fixture.scene(FILLS);
    let input = fixture.input(scene, 200.0, 110.0);
    let prepared = prepare(&input);
    let mut shaper = TextShaper::new();
    let mut raster = TextRaster::new();
    assert!(
        build(
            &mut shaper,
            &mut raster,
            &input,
            &prepared,
            &mut Cache::new(),
            BUILD_WORK,
            &Always
        )
        .is_none()
    );
}

/// A very tall window at both scales:
/// the picture is as tall as its track,
/// and no band passes the band budget.
#[test]
fn a_tall_view_gives_a_picture_as_tall_as_its_track_within_the_budget() {
    for scale in [1.0_f32, 2.0] {
        let fixture = fixture(300, 1354.0, scale);
        let scene = fixture.scene(FILLS);
        let input = fixture.input(scene, 12_000.0, 110.0);
        let geometry = Geometry::new(fixture.map.height(), 12_000.0);
        let built = {
            let mut shaper = TextShaper::new();
            let mut raster = TextRaster::new();
            let prepared = prepare(&input);
            build(
                &mut shaper,
                &mut raster,
                &input,
                &prepared,
                &mut Cache::new(),
                BUILD_WORK,
                &Never,
            )
            .expect("a picture")
        };
        assert_eq!(
            built.height as usize,
            (f64::from(geometry.track() * scale) - 1e-3).ceil() as usize
        );
        assert_eq!(built.width as usize, (110.0 * scale).round() as usize);
        assert!(u64::try_from(built.stats.largest).expect("a size") <= BAND_BYTES);
        assert_eq!(built.stats.failed + built.stats.skipped, 0);
    }
}
