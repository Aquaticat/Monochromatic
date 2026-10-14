//! Markdown roles ask for a weight or the italic face as their second channel beside color,
//!  and neither may move a caret.

/// Production source font assets and shaping interfaces.
use ide_app::{
    document::Document,
    font_asset::{CODE_ITALIC, CODE_ROMAN},
    shaped_text::{TextShaper, Viewport},
    source_style::{
        BOLD_ROLE, HEADING_ROLE, ITALIC_ROLE, LINK_ROLE, LINK_URL_ROLE, LIST_ROLE, QUOTE_ROLE,
        RAW_INLINE_ROLE, STRIKETHROUGH_ROLE, StyleSpan,
    },
    syntax::SCOPES,
};
/// Actual font runs expose the selected font bytes and normalized variation coordinates.
use parley::PositionedLayoutItem;

/// One viewport line at scale one,
///  optionally wrapped to a width in logical pixels.
fn viewport(wrap: Option<f32>) -> Viewport {
    return Viewport {
        first: 0,
        count: 1,
        width: 800.0,
        scale: 1.0,
        wrap,
        clip: None,
    };
}

/// The character range of the first occurrence of `word` in `source`.
fn span(source: &str, word: &str, style: u32) -> StyleSpan {
    let byte = source.find(word).expect("word is in the sample");
    let start = source[..byte].chars().count();
    return StyleSpan {
        start,
        end: start + word.chars().count(),
        style: style as usize,
    };
}

/// What font a run of the first row used,
///  as the font bytes' first and last values and the normalized weight coordinate.
fn faces(source: &str, styles: &[StyleSpan]) -> Vec<(bool, i16)> {
    let document = Document::new(source);
    let view = TextShaper::new().prepare(&document, viewport(None), styles);
    let mut seen = Vec::new();
    for line in view.rows[0].layout.lines() {
        for item in line.items() {
            if let PositionedLayoutItem::GlyphRun(glyph_run) = item {
                let run = glyph_run.run();
                let italic = run.font().data.as_ref() == CODE_ITALIC;
                assert!(italic || run.font().data.as_ref() == CODE_ROMAN);
                let weight = run.normalized_coords().first().copied().unwrap_or(0);
                seen.push((italic, weight));
            }
        }
    }
    return seen;
}

/// The role numbers name the scopes the engine registers.
#[test]
fn role_numbers_name_the_registered_scopes() {
    let named = [
        (HEADING_ROLE, "markup.heading"),
        (BOLD_ROLE, "markup.bold"),
        (ITALIC_ROLE, "markup.italic"),
        (STRIKETHROUGH_ROLE, "markup.strikethrough"),
        (RAW_INLINE_ROLE, "markup.raw.inline"),
        (LINK_ROLE, "markup.link"),
        (LINK_URL_ROLE, "markup.link.url"),
        (LIST_ROLE, "markup.list"),
        (QUOTE_ROLE, "markup.quote"),
    ];
    for (role, scope) in named {
        assert_eq!(SCOPES[role as usize - 1], scope, "role {role}");
    }
}

/// Strong roles shape in a heavier instance of the roman face,
///  and the plain words around them in the regular instance.
#[test]
fn heavy_roles_shape_in_a_heavier_instance_of_the_roman_face() {
    let source = "plain strong plain";
    let plain = faces(source, &[]);
    assert!(plain.iter().all(|face| return *face == (false, 0)));
    for role in [HEADING_ROLE, BOLD_ROLE, LIST_ROLE] {
        let styled = faces(source, &[span(source, "strong", role)]);
        let heavier = styled
            .iter()
            .filter(|(italic, weight)| return !*italic && *weight > 0)
            .count();
        assert_eq!(heavier, 1, "role {role} makes one heavier run: {styled:?}");
    }
    let semibold = faces(source, &[span(source, "strong", LINK_ROLE)]);
    let bold = faces(source, &[span(source, "strong", BOLD_ROLE)]);
    let weight_of = |faces: &Vec<(bool, i16)>| return faces.iter().map(|face| return face.1).max();
    assert!(weight_of(&semibold) > Some(0) && weight_of(&semibold) < weight_of(&bold));
}

/// Struck text is lighter than the source weight,
///  because a glyph-only painter cannot draw a line through it.
#[test]
fn struck_text_is_lighter_than_the_source_weight() {
    let source = "plain struck plain";
    let styled = faces(source, &[span(source, "struck", STRIKETHROUGH_ROLE)]);
    assert!(
        styled
            .iter()
            .any(|(italic, weight)| return !*italic && *weight < 0),
        "faces: {styled:?}"
    );
}

/// Emphasis,
///  quotes,
///  and link destinations use the real italic face rather than a skew.
#[test]
fn italic_roles_use_the_real_italic_face() {
    let source = "plain words plain";
    for role in [ITALIC_ROLE, QUOTE_ROLE, LINK_URL_ROLE] {
        let styled = faces(source, &[span(source, "words", role)]);
        assert!(
            styled.iter().any(|(italic, _)| return *italic),
            "role {role}: {styled:?}"
        );
    }
}

/// Roles that only choose a color leave the face alone.
#[test]
fn color_only_roles_keep_the_source_face() {
    let source = "plain `code` plain";
    let styled = faces(source, &[span(source, "code", RAW_INLINE_ROLE)]);
    assert!(
        styled.iter().all(|face| return *face == (false, 0)),
        "faces: {styled:?}"
    );
}

/// Carets sit where the unstyled line puts them,
///  on tabbed and wrapped lines with heavy,
///  italic,
///  and fallback-font text,
///  because the geometry paths shape without roles.
#[test]
fn faces_leave_every_caret_position_and_break_where_they_were() {
    let source = "\tstrong text\tafter a tab 猫🐈 and emphasis with a long tail of words that wrap around the width twice over";
    let styles = [
        span(source, "strong", BOLD_ROLE),
        span(source, "猫🐈", HEADING_ROLE),
        span(source, "emphasis", ITALIC_ROLE),
        span(source, "text", LINK_ROLE),
        span(source, "words", STRIKETHROUGH_ROLE),
        span(source, "tail", QUOTE_ROLE),
    ];
    let document = Document::new(source);
    for wrap in [None, Some(220.0), Some(400.0)] {
        let mut shaper = TextShaper::new();
        let view = shaper.prepare(&document, viewport(wrap), &styles);
        let styled = &view.rows[0];
        let plain = match wrap {
            Some(width) => shaper.wrapped_row(&document, 0, 1.0, width),
            None => shaper.row(&document, 0, 1.0),
        };
        assert_eq!(styled.visual_rows(), plain.visual_rows(), "wrap {wrap:?}");
        assert_eq!(styled.source_rows(), plain.source_rows(), "wrap {wrap:?}");
        for position in 0..=styled.source_len() {
            assert_eq!(
                styled.caret_x(position, 1.0),
                plain.caret_x(position, 1.0),
                "caret x at {position}, wrap {wrap:?}"
            );
        }
    }
}
