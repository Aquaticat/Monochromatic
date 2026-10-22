//! The code tile drawn across stacked textures shows what one texture shows:
//!  the textures of a stack, read back and put one below the other, equal the picture of the same rows in one texture,
//!  at every cut, with glyphs, selected glyphs, hints, and underlines that a cut passes through.
//! No window is opened here: the scenes are drawn on the test thread's device.
//! The window's own stacking (the images, the window thread's swap) is in the tests that name a window.

/// Where the text area starts in a window, and the window's own type.
use super::{AppWindow, sidebar_tests::TEXT_LEFT};
/// The tile the GPU draws, read back without a window, and how far two renders may differ.
use super::{
    annotation_scene_tests::block,
    gpu_snapshot::{install_gpu_platform, snapshot},
    gpu_tile::{SLICE_LISTS_SET, render_scene, render_stack},
    tall_window_tests::settled_tile,
    tile_reads::same_pixels,
    wrap_tests::{long_text, open, settled},
};
/// The document with a selection, the rows of a tile, the shaper that lays them out, and the stack.
use ide_app::{
    annotation::{Mark, Visible},
    annotation_layout::{AnnotationColors, lay_out},
    code_colors::CodeColors,
    document::{Document, ReadingAffinity, ReadingPosition},
    language::diagnostics::Severity,
    row_map::{CODE_ROW, RowMap},
    shaped_text::{ShapedView, TextShaper, Viewport, set_texture_dimension, stack_rows},
    tile_scene::{paint_stack, paint_tile},
};
/// The pixels the GPU drew, and the window's events.
use slint::{
    ComponentHandle, Rgba8Pixel, SharedPixelBuffer, platform::update_timers_and_animations,
};
/// Counters are atomic.
use std::sync::atomic::Ordering;

/// Black text, red selected text: the two inks differ, so every selected glyph run is clipped.
const RED_SELECTED: CodeColors = CodeColors {
    foreground: [0, 0, 0, 255],
    selected: [255, 0, 0, 255],
    dark: false,
};

/// Inks of the annotations; each differs from the source ink.
const INKS: AnnotationColors = AnnotationColors {
    hint: [150, 160, 170, 255],
    error: [255, 110, 120, 255],
    warning: [240, 200, 40, 255],
    information: [90, 200, 250, 255],
    suggestion: [170, 170, 170, 255],
};

/// `lines` lines of dense code, none wrapping, joined without a final terminator.
fn code(lines: usize) -> String {
    let mut text = String::new();
    for number in 0..lines {
        if number > 0 {
            text.push('\n');
        }
        text.push_str(&format!(
            "pub fn compute_{number}(first_item: u32, second_item: &str) -> Result<u32, String> {{ // {number}"
        ));
    }
    return text;
}

/// The shaped rows of `lines` lines with the first `selected` of them selected.
fn shaped(lines: usize, selected: usize) -> (ShapedView, Document) {
    let mut document = Document::new(&code(lines));
    if selected > 0 {
        let head = if selected >= lines {
            document.text().len_chars()
        } else {
            document.text().line_to_char(selected)
        };
        document.select(ReadingPosition {
            anchor: 0,
            head,
            viewport: 0,
            affinity: ReadingAffinity::Downstream,
        });
    }
    let mut shaper = TextShaper::new();
    let plain = RowMap::plain(lines);
    let view = shaper.prepare_rows(
        &document,
        Viewport {
            first: 0,
            count: lines,
            width: 300.0,
            scale: 1.0,
            wrap: None,
            clip: None,
        },
        &[],
        &plain,
    );
    return (view, document);
}

/// The rows of the stack's textures where a texture ends and the next begins.
fn seams(heights: &[u32]) -> Vec<usize> {
    let mut seams = Vec::new();
    let mut row = 0;
    for height in &heights[..heights.len() - 1] {
        row += *height as usize;
        seams.push(row);
    }
    return seams;
}

/// How many texels of the rows `from..to` are inked at all.
fn inked_in(pixels: &SharedPixelBuffer<Rgba8Pixel>, from: usize, to: usize) -> usize {
    let width = pixels.width() as usize;
    return pixels.as_slice()[from * width..to * width]
        .iter()
        .filter(|pixel| return pixel.a > 0)
        .count();
}

/// Whether `stacked` is `whole` shifted down by one row of `width` texels, which no picture of text equals.
fn shifted_equals(whole: &[Rgba8Pixel], stacked: &[Rgba8Pixel], width: usize) -> bool {
    return same_pixels(&whole[width..], &stacked[..stacked.len() - width]);
}

/// A tile of selected and plain rows, drawn as one texture and as a stack of three to five at lowered texture limits,
/// is the same picture at every texel, and the rows on both sides of each cut are inked.
/// A stack that sat one row lower would not be equal.
#[test]
fn a_tile_drawn_across_textures_equals_the_tile_in_one_texture() {
    install_gpu_platform();
    set_texture_dimension(8192);
    for selected in [0_usize, 25, 40] {
        let (view, _document) = shaped(40, selected);
        assert_eq!(view.height as usize, 40 * CODE_ROW as usize);
        let one = paint_tile(&view, RED_SELECTED, 0.0).expect("a tile that one texture holds");
        let whole = render_scene(&one);
        let width = whole.width() as usize;
        for limit in [700_u32, 400, 300] {
            set_texture_dimension(limit);
            let stack = paint_stack(&view, RED_SELECTED, 0.0).expect("a stack within the limit");
            let mut heights = Vec::new();
            for texture in &stack.textures {
                assert!(
                    texture.height <= limit,
                    "a texture of {} rows",
                    texture.height
                );
                heights.push(texture.height);
            }
            assert_eq!(heights.iter().sum::<u32>(), view.height);
            assert!(heights.len() >= 2, "limit {limit}: {heights:?}");
            let stacked = render_stack(&stack);
            assert_eq!(
                (stacked.width(), stacked.height()),
                (whole.width(), whole.height())
            );
            assert!(
                same_pixels(whole.as_slice(), stacked.as_slice()),
                "selected {selected}, limit {limit}: the stack of {} textures differs from the one texture",
                heights.len()
            );
            for seam in seams(&heights) {
                assert!(
                    inked_in(&stacked, seam - 6, seam + 6) > 0,
                    "selected {selected}, limit {limit}: the rows around the seam at {seam} are blank"
                );
            }
            assert!(
                !shifted_equals(whole.as_slice(), stacked.as_slice(), width),
                "selected {selected}, limit {limit}: a shift of one row went unseen"
            );
            set_texture_dimension(8192);
        }
    }
}

/// A texture of the stack draws only the rows that can reach it:
/// the scene of a texture is not the scene of the whole tile, so a render of the whole tile in every texture
/// (the cut without the shift) is a different picture.
#[test]
fn a_texture_of_the_stack_is_placed_by_its_own_top() {
    install_gpu_platform();
    set_texture_dimension(8192);
    let (view, _document) = shaped(40, 0);
    let one = paint_tile(&view, RED_SELECTED, 0.0).expect("a tile that one texture holds");
    let whole = render_scene(&one);
    set_texture_dimension(400);
    let stack = paint_stack(&view, RED_SELECTED, 0.0).expect("a stack within the limit");
    let first = render_scene(&stack.textures[0]);
    let second = render_scene(&stack.textures[1]);
    let width = whole.width() as usize;
    let top = stack.textures[0].height as usize;
    // The second texture holds the rows below the first, not the first again.
    assert!(!same_pixels(
        first.as_slice(),
        &second.as_slice()[..first.as_slice().len()]
    ));
    let expected = &whole.as_slice()[top * width..(top + second.height() as usize) * width];
    assert!(same_pixels(expected, second.as_slice()));
    set_texture_dimension(8192);
}

/// The tile of two lines with hints, messages, and underlines of all severities, below `padding` empty lines,
/// as shaped rows with their annotation frame laid out.
fn annotated(padding: usize) -> ShapedView {
    let body = "let first_value = compute(alpha, beta);\nlet second_value = compute(gamma, delta);\nlet third = 3;\n";
    let source = format!("{}{body}", "\n".repeat(padding));
    let document = Document::new(&source);
    let lines = document.text().len_lines();
    let mut shaper = TextShaper::new();
    let first_block = block(
        &source,
        padding,
        (4, "ty: u32"),
        &[(4, Severity::Error, "unknown name here")],
    );
    let second_block = block(
        &source,
        padding + 1,
        (4, "ty: u64"),
        &[(18, Severity::Warning, "a long warning text")],
    );
    // The first line of the body starts at character `padding`, the second 40 characters after it.
    let start = padding;
    let second = padding + 40;
    let mut marks = Vec::new();
    for (from, to, severity) in [
        (start + 4, start + 15, Severity::Error),
        (start + 18, start + 25, Severity::Warning),
        (second + 4, second + 16, Severity::Information),
        (second + 20, second + 30, Severity::Hint),
    ] {
        marks.push(Mark {
            start: from,
            end: to,
            severity,
        });
    }
    let visible = Visible {
        blocks: vec![first_block.clone(), second_block.clone()],
        marks,
    };
    let raised = vec![
        (padding, first_block.height()),
        (padding + 1, second_block.height()),
    ];
    let map = RowMap::new(lines, &raised);
    let mut view = shaper.prepare_rows(
        &document,
        Viewport {
            first: 0,
            count: lines,
            width: 160.0,
            scale: 1.0,
            wrap: None,
            clip: None,
        },
        &[],
        &map,
    );
    let frame = lay_out(&view, &visible, &mut shaper, INKS);
    view.annotations = Some(frame);
    return view;
}

/// How many texels of the rows `from..to` carry one of the annotation inks.
fn annotation_ink_in(pixels: &SharedPixelBuffer<Rgba8Pixel>, from: usize, to: usize) -> usize {
    let width = pixels.width() as usize;
    let mut found = 0;
    for pixel in &pixels.as_slice()[from * width..to * width] {
        // Annotation inks are far from the source ink, which is a light gray.
        let is_annotation = [
            INKS.hint,
            INKS.error,
            INKS.warning,
            INKS.information,
            INKS.suggestion,
        ]
        .iter()
        .any(|ink| {
            return pixel.a > 150
                && pixel.r.abs_diff(ink[0]) < 12
                && pixel.g.abs_diff(ink[1]) < 12
                && pixel.b.abs_diff(ink[2]) < 12;
        });
        if is_annotation {
            found += 1;
        }
    }
    return found;
}

/// The cuts of a tile with hints, messages, and underlines of all severities pass through the virtual rows and
/// the underlines, and the stack still equals the one texture:
/// the texture limit is as small as the tile is wide, so the cuts stand every 160 rows,
/// and the annotated lines are moved down one code row at a time under them.
/// At least three cuts stand within three rows of annotation ink,
/// so the equality is not only of rows without any.
#[test]
fn hints_messages_and_underlines_cut_by_a_seam_are_drawn_whole() {
    install_gpu_platform();
    let colors = CodeColors {
        foreground: [230, 230, 230, 255],
        selected: [255, 255, 255, 255],
        dark: true,
    };
    let mut annotated_seams = 0;
    let mut cuts = 0;
    for padding in 0..8 {
        set_texture_dimension(8192);
        let view = annotated(padding);
        let one = paint_tile(&view, colors, 0.0).expect("a tile that one texture holds");
        let whole = render_scene(&one);
        let width = whole.width() as usize;
        set_texture_dimension(160);
        assert!(u64::from(view.height) <= stack_rows(u64::from(view.width)));
        let stack = paint_stack(&view, colors, 0.0).expect("a stack within the limit");
        let heights: Vec<u32> = stack
            .textures
            .iter()
            .map(|texture| return texture.height)
            .collect();
        assert!(heights.len() >= 2, "padding {padding}: {heights:?}");
        let stacked = render_stack(&stack);
        assert!(
            same_pixels(whole.as_slice(), stacked.as_slice()),
            "padding {padding}: the stack of {} textures differs from the one texture",
            heights.len()
        );
        assert!(
            !shifted_equals(whole.as_slice(), stacked.as_slice(), width),
            "padding {padding}: a shift of one row went unseen"
        );
        for seam in seams(&heights) {
            cuts += 1;
            if annotation_ink_in(&stacked, seam.saturating_sub(3), seam + 3) > 0 {
                annotated_seams += 1;
            }
        }
    }
    set_texture_dimension(8192);
    assert!(cuts >= 8, "only {cuts} cuts were made");
    assert!(
        annotated_seams >= 3,
        "only {annotated_seams} of {cuts} cuts stood within three rows of annotation ink"
    );
}

/// The pixels of the code view in the window's frame, row by row from the top, and the width of a row of them:
/// the textures of the tile as the window composites them, with the selection and the caret, without the minimap.
fn code_view(window: &AppWindow) -> (Vec<Rgba8Pixel>, usize) {
    let frame = snapshot(window.window());
    let scale = window.window().scale_factor();
    let columns = frame.width() as usize;
    let left = (TEXT_LEFT * scale) as usize;
    let right = columns - (window.get_minimap_width() * scale).round() as usize;
    let mut view = Vec::new();
    for row in frame.as_slice().chunks(columns) {
        view.extend_from_slice(&row[left..right]);
    }
    return (view, right - left);
}

/// Where two reads of the code view differ, for a failure message: the rows that hold a differing texel, counted,
/// and the first few of them with the first differing column.
fn describe_difference(left: &[Rgba8Pixel], right: &[Rgba8Pixel], width: usize) -> String {
    let mut rows = Vec::new();
    for (row, (one, other)) in left.chunks(width).zip(right.chunks(width)).enumerate() {
        if !same_pixels(one, other) {
            let column = one
                .iter()
                .zip(other)
                .position(|(first, second)| return !same_pixels(&[*first], &[*second]));
            rows.push((row, column));
        }
    }
    return format!("{} rows differ, the first {:?}", rows.len(), &rows[..rows.len().min(8)]);
}

/// What a window at texture limit `limit` shows after its view left the tile it first had:
/// the code view's pixels, their row width, and the sizes of the tile's textures.
fn shown_after_a_jump(limit: u32) -> (Vec<Rgba8Pixel>, usize, Vec<(u32, u32)>) {
    let (_project, opened) = open(&long_text(400));
    let window = &opened.window;
    settled(&opened);
    // The device's own limit is recorded when the first frame is set up, so the lowered limit is recorded after it.
    code_view(window);
    set_texture_dimension(limit);
    window.set_scroll_y(-3000.0);
    update_timers_and_animations();
    settled_tile(&opened);
    let (view, width) = code_view(window);
    let sizes = opened.source.borrow().gpu.tile_texture_sizes();
    assert_eq!(window.get_error_message().to_string(), "");
    window.hide().expect("close wrap window");
    set_texture_dimension(8192);
    return (view, width, sizes);
}

/// The window shows a tile of stacked textures as it shows the same tile in one texture:
/// the code view of the frame is the same at every texel, with the textures of the stack abutting, and a normal
/// window gets one texture.
/// A view that sat one row lower would not be equal.
#[test]
fn the_window_shows_a_stacked_tile_as_the_one_texture_shows_it() {
    install_gpu_platform();
    let (whole, width, one) = shown_after_a_jump(8192);
    assert_eq!(
        one.len(),
        1,
        "a window of ordinary size draws one texture: {one:?}"
    );
    for limit in [700_u32, 400] {
        let (stacked, stacked_width, sizes) = shown_after_a_jump(limit);
        assert!(sizes.len() >= 3, "limit {limit}: {sizes:?}");
        for (across, down) in &sizes {
            assert!(
                *down <= limit && *across == sizes[0].0,
                "limit {limit}: {sizes:?}"
            );
        }
        assert_eq!(stacked_width, width);
        assert_eq!(stacked.len(), whole.len());
        assert!(
            same_pixels(&whole, &stacked),
            "limit {limit}: the code view of a stack of {} textures {sizes:?} differs from the one texture's: {}",
            sizes.len(),
            describe_difference(&whole, &stacked, width)
        );
        assert!(
            !same_pixels(&whole[width..], &stacked[..stacked.len() - width]),
            "limit {limit}: a shift of one row went unseen"
        );
    }
}

/// A tile that replaces one of the same shape draws into the textures it has and hands the window no new list:
/// a scroll step that re-centers the tile costs neither a texture nor an image.
#[test]
fn a_tile_of_the_same_shape_reuses_its_textures_and_the_list_of_images() {
    install_gpu_platform();
    // Lines of one row each, so that two tiles at different places hold the same number of rows.
    let (_project, opened) = open(&"a short line of code\n".repeat(5000));
    let window = &opened.window;
    settled(&opened);
    code_view(window);
    set_texture_dimension(700);
    window.set_scroll_y(-3000.0);
    update_timers_and_animations();
    settled_tile(&opened);
    code_view(window);
    let sizes = opened.source.borrow().gpu.tile_texture_sizes();
    assert!(sizes.len() >= 3, "{sizes:?}");
    let made = opened.source.borrow().gpu.tile_textures_made();
    let lists = SLICE_LISTS_SET.load(Ordering::SeqCst);
    let rendered = opened.source.borrow().gpu.tiles_rendered();
    let scenes = opened.source.borrow().gpu.tile_textures_rendered();
    window.set_scroll_y(-9000.0);
    update_timers_and_animations();
    settled_tile(&opened);
    code_view(window);
    assert!(
        opened.source.borrow().gpu.tiles_rendered() > rendered,
        "the tile was not drawn again"
    );
    // Every texture of the stack is drawn once for each tile.
    assert_eq!(
        opened.source.borrow().gpu.tile_textures_rendered() - scenes,
        (opened.source.borrow().gpu.tiles_rendered() - rendered) * sizes.len() as u64
    );
    assert_eq!(opened.source.borrow().gpu.tile_texture_sizes(), sizes);
    assert_eq!(
        opened.source.borrow().gpu.tile_textures_made(),
        made,
        "a tile of the same shape made new textures"
    );
    assert_eq!(
        SLICE_LISTS_SET.load(Ordering::SeqCst),
        lists,
        "the window was given a new list of textures"
    );
    window.hide().expect("close wrap window");
    set_texture_dimension(8192);
}

/// The window is told the texture side of the device it is drawn on, and its markup holds both sides of the window to
/// it in physical pixels, at any display scale: a surface past it makes the toolkit's surface configuration panic.
/// The markup is read as text because no harness window enforces a largest size; the nested compositor does.
#[test]
fn the_window_is_never_larger_than_the_devices_texture_side() {
    install_gpu_platform();
    let (_project, opened) = open(&long_text(10));
    let window = &opened.window;
    code_view(window);
    assert_eq!(
        window.get_texture_limit() as u32,
        ide_app::shaped_text::texture_dimension()
    );
    let markup = include_str!("../../ui/app.slint");
    assert!(markup.contains("max-width: root.texture-limit * 1phx;"));
    assert!(markup.contains("max-height: root.texture-limit * 1phx;"));
    window.hide().expect("close wrap window");
}
