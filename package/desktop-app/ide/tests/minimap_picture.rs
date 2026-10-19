//! The minimap's picture without a window:
//!  the plan of bands,
//! the picture as the box average of one frame of the whole text,
//!  the fills of the selection and the matches,
//! the cache,
//! the budgets,
//! a band that fails,
//!  a long text that is sampled,
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
use ide_app::language::identity::DocumentStamp;
/// The lines' visual rows.
use ide_app::line_rows::LineRows;
/// The picture,
/// its plan,
/// and its parts.
use ide_app::minimap::{
    BAND_BYTES, Built, Cache, Cancel, Density, FULL_WORK, Fills, Geometry, Identity, Input, Pass,
    Picture, Reducer, Reduction, SAMPLES, Scene, Strip, band_height, build, full_density,
    paint_fills, plan, prepare, render, text_span,
};
/// The vertical mapping.
use ide_app::row_map::{CODE_ROW, RowMap};
/// Shaping and the frame it prepares.
use ide_app::shaped_text::{TextShaper, Viewport, line_work, raster_fits, raster_width};
/// Syntax classes.
use ide_app::source_style::StyleSpan;
/// The painter and its palette.
use ide_app::text_raster::{CodeColors, MAX_RASTER_BYTES, TextRaster};

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
    let text = code(lines);
    let document = Document::new(&text);
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
        styles: styles_of(&text),
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
            identity: Identity {
                stamp: DocumentStamp {
                    file: 1,
                    revision: self.document.revision(),
                },
                styles: 0,
            },
            view,
            width,
        };
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
    let prepared = prepare(&input, Pass::Full);
    return build(
        &mut shaper,
        &mut raster,
        &input,
        &prepared,
        None,
        FULL_WORK,
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
    let out_height = ((f64::from(geometry.track() * scale)) - 1e-3).ceil() as usize;
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
        step: 1.0,
    };
    let reduced = reducer.reduce(&strip, &(0.0..f64::INFINITY));
    let mut picture = Picture::new(out_width, out_height);
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
                let bands = plan(map, columns, scale);
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
    let band = plan(&fixture.map, 1000, 1.0).remove(0);
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
        let prepared = prepare(&input, Pass::Full);
        build(
            &mut shaper,
            &mut raster,
            &input,
            &prepared,
            Some(&mut cache),
            FULL_WORK,
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
        let prepared = prepare(&input, Pass::Full);
        build(
            &mut shaper,
            &mut raster,
            &input,
            &prepared,
            Some(&mut cache),
            FULL_WORK,
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
        let prepared = prepare(&input, Pass::Full);
        build(
            &mut shaper,
            &mut raster,
            &input,
            &prepared,
            Some(&mut cache),
            FULL_WORK,
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
        let prepared = prepare(&input, Pass::Full);
        build(
            &mut shaper,
            &mut raster,
            &input,
            &prepared,
            Some(&mut cache),
            FULL_WORK,
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
        let prepared = prepare(&input, Pass::Full);
        build(
            &mut shaper,
            &mut raster,
            &input,
            &prepared,
            Some(&mut cache),
            FULL_WORK,
            &Never,
        )
        .expect("a picture")
    };
    // Another selection changes the keys, but no work is allowed.
    fixture.select(0, 30);
    let scene = fixture.scene(FILLS);
    let input = fixture.input(scene, 300.0, 110.0);
    let prepared = prepare(&input, Pass::Full);
    let kept = build(
        &mut shaper,
        &mut raster,
        &input,
        &prepared,
        Some(&mut cache),
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
        Some(&mut empty),
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
    let band = plan(&fixture.map, 5_000_024, 1.0).remove(0);
    let mut shaper = TextShaper::new();
    let mut raster = TextRaster::new();
    let error = render(&mut shaper, &mut raster, &scene, &band)
        .err()
        .expect("a frame cut to the limit is refused");
    assert!(format!("{error:#}").contains("raster limit"), "{error:#}");
    let input = fixture.input(scene, 200.0, 110.0);
    let prepared = prepare(&input, Pass::Full);
    let built = build(
        &mut shaper,
        &mut raster,
        &input,
        &prepared,
        None,
        FULL_WORK,
        &Never,
    )
    .expect("a picture");
    assert_eq!(built.stats.failed, built.stats.units);
    assert_eq!(built.stats.rendered, 0);
}

/// A text with many more rows than the track has pixels is sampled:
/// the lines rendered follow the track and not the text,
/// and no raster passes the limit.
#[test]
fn a_long_text_is_sampled_within_the_track_and_never_passes_the_raster_limit() {
    let fixture = fixture(3_000, 700.0, 1.0);
    let scene = fixture.scene(FILLS);
    let input = fixture.input(scene, 240.0, 110.0);
    let ratio = f64::from(Geometry::new(fixture.map.height(), 240.0).scale());
    assert_eq!(full_density(ratio), Density::Sampled(SAMPLES));
    let mut shaper = TextShaper::new();
    let mut raster = TextRaster::new();
    let quick = prepare(&input, Pass::Quick);
    let coarse = build(
        &mut shaper,
        &mut raster,
        &input,
        &quick,
        None,
        FULL_WORK,
        &Never,
    )
    .expect("a coarse picture");
    assert_eq!(coarse.height, 240);
    assert!(
        coarse.stats.lines <= 240,
        "the coarse picture rendered {} lines for 240 rows",
        coarse.stats.lines
    );
    let prepared = prepare(&input, Pass::Full);
    let full = build(
        &mut shaper,
        &mut raster,
        &input,
        &prepared,
        None,
        FULL_WORK,
        &Never,
    )
    .expect("a picture");
    assert!(full.stats.lines <= 240 * SAMPLES);
    assert!(full.stats.lines >= 240 * SAMPLES / 2);
    assert_eq!(full.stats.failed + full.stats.skipped, 0);
    assert!(u64::try_from(full.stats.largest).expect("a size") <= MAX_RASTER_BYTES);
    let mut inked = 0;
    for pixel in full.bytes.chunks(4) {
        if pixel[3] > 0 {
            inked += 1;
        }
    }
    assert!(
        inked > 1000,
        "the sampled picture holds only {inked} inked pixels"
    );
    // The coarse and the full picture are estimates of the same average.
    let mut coarse_sum = 0_u64;
    let mut full_sum = 0_u64;
    for (one, other) in coarse.bytes.chunks(4).zip(full.bytes.chunks(4)) {
        coarse_sum += u64::from(one[3]);
        full_sum += u64::from(other[3]);
    }
    let low = full_sum * 7 / 10;
    let high = full_sum * 13 / 10;
    assert!(
        coarse_sum >= low && coarse_sum <= high,
        "the coarse picture holds {coarse_sum} of alpha against {full_sum}"
    );
}

/// Lines that cost a great deal each make the full picture sample fewer code rows for each output row,
/// down to one,
/// so the picture stays whole within its budget instead of leaving rows out.
#[test]
fn costly_lines_thin_the_samples_instead_of_leaving_rows_out() {
    for (length, samples) in [(300, SAMPLES), (4_000, SAMPLES / 2), (20_000, 1)] {
        let mut text = String::new();
        for number in 0..2_000 {
            text.push_str(&format!("{number:04} {}\n", "x".repeat(length)));
        }
        let document = Document::new(&text);
        let map = RowMap::plain(document.text().len_lines());
        let fixture = Fixture {
            document,
            styles: Vec::new(),
            map,
            marks: Vec::new(),
            ranges: Vec::new(),
            wrap: None,
            scale: 1.0,
        };
        let scene = fixture.scene(FILLS);
        let input = fixture.input(scene, 240.0, 110.0);
        let prepared = prepare(&input, Pass::Full);
        let pending = prepared.pending_work(&scene, &Cache::new());
        let line = line_work(&fixture.document, 0);
        assert!(
            pending <= FULL_WORK,
            "{length} characters a line: the plan costs {pending}, more than {FULL_WORK}"
        );
        assert_eq!(
            (pending as f64 / (240 * line) as f64).round() as usize,
            samples,
            "{length} characters a line: the plan costs {pending} for 240 rows of lines that cost {line}"
        );
    }
}

/// A build that is cancelled answers nothing.
#[test]
fn a_cancelled_build_answers_nothing() {
    let fixture = fixture(10, 500.0, 1.0);
    let scene = fixture.scene(FILLS);
    let input = fixture.input(scene, 200.0, 110.0);
    let prepared = prepare(&input, Pass::Full);
    let mut shaper = TextShaper::new();
    let mut raster = TextRaster::new();
    assert!(
        build(
            &mut shaper,
            &mut raster,
            &input,
            &prepared,
            None,
            FULL_WORK,
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
            let prepared = prepare(&input, Pass::Full);
            build(
                &mut shaper,
                &mut raster,
                &input,
                &prepared,
                None,
                FULL_WORK,
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
