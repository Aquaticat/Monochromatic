//! What: Continuation-prefix and paragraph-ancestry controls through actual Markdown/MDX parses.
//! Why: A prefix copied from the wrong line, or a paragraph chosen from the wrong ancestor, rewrites container syntax.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // Parse real containers, then compare the copied prefix and the applied fix byte for byte.
//! ```

/// Import the production helpers under test.
use super::{continuation_prefix, paragraph_for};
/// Import the consuming rule, its severity and the actual grouped-edit applier.
use crate::diagnostic::Severity;
use crate::edits::{Fix, apply_fixes};
use crate::markdown_semantic_breaks::semantic_line_breaks;
/// Import the native parser adapter and its typed node catalog.
use crate::markdown_source::MarkdownSource;
use satteri_ast::mdast::MdastNodeType;

/// Parse one exact fixture through the native adapter.
fn parse(source: &str, mdx: bool) -> MarkdownSource {
    // Own the text: the parsed source keeps its exact bytes for every later offset.
    return MarkdownSource::new(String::from("prose.md"), String::from(source), mdx)
        .expect("fixture parses");
}

/// Find the first node of one kind, failing when the fixture did not exercise that syntax.
fn first(context: &MarkdownSource, kind: MdastNodeType) -> u32 {
    // Node ids are u32 arena indexes; all_nodes lists them in source order.
    for id in context.all_nodes() {
        if context.kind(*id) == kind {
            return *id;
        }
    }
    panic!("fixture did not create the requested node kind");
}

/// Apply every advertised semantic-break fix once through the production editor.
fn fixed(source: &str) -> String {
    let context: MarkdownSource = parse(source, false);
    // Own the fixes so they outlive the diagnostics they were moved out of.
    let mut fixes: Vec<Fix> = Vec::<Fix>::new();
    for diagnostic in semantic_line_breaks(&context, Severity::Error) {
        fixes.push(diagnostic.fix.expect("add-only fix"));
    }
    return apply_fixes(source, fixes.as_slice())
        .expect("apply")
        .source;
}

/// A paragraph below earlier lines copies its own line's prefix, for every line-ending spelling.
#[test]
fn later_line_paragraphs_copy_only_their_own_line_prefix() {
    for newline in ["\n", "\r\n", "\r"] {
        let source: String =
            format!("intro words{newline}{newline}> first, second word.{newline}");
        let context: MarkdownSource = parse(source.as_str(), false);
        // The quoted paragraph is the second one; the intro paragraph has no container prefix.
        let mut prefixes: Vec<String> = Vec::<String>::new();
        for id in context.all_nodes() {
            if context.kind(*id) == MdastNodeType::Paragraph {
                prefixes.push(continuation_prefix(&context, *id));
            }
        }
        assert_eq!(prefixes, ["", "> "], "{source:?}");
        // The inserted break follows the incumbent's choice: CRLF only when the source already uses it.
        let inserted: &str = if newline == "\r\n" { "\r\n" } else { "\n" };
        assert_eq!(
            fixed(source.as_str()),
            format!("intro words{newline}{newline}> first,{inserted}>  second word.{newline}"),
            "{source:?}"
        );
    }
}

/// Nested containers on a later line keep quote markers and replace the list marker with a space.
#[test]
fn nested_later_line_containers_keep_markers_and_blank_list_bullets() {
    let source: &str = "intro words\n\n- > first, second here.\n";
    let context: MarkdownSource = parse(source, false);
    // The fixture's last paragraph is the nested one; every earlier line must stay out of its prefix.
    let mut nested: Option<u32> = None;
    for id in context.all_nodes() {
        if context.kind(*id) == MdastNodeType::Paragraph {
            nested = Some(*id);
        }
    }
    assert_eq!(
        continuation_prefix(&context, nested.expect("nested paragraph")),
        "  > "
    );
    assert_eq!(
        fixed(source),
        "intro words\n\n- > first,\n  >  second here.\n"
    );
}

/// Authored tabs stay tabs in the copied prefix; only list-marker characters become spaces.
#[test]
fn tab_indentation_survives_in_the_continuation_prefix() {
    let list: MarkdownSource = parse("-\tfirst, second here.\n", false);
    assert_eq!(
        continuation_prefix(&list, first(&list, MdastNodeType::Paragraph)),
        " \t"
    );
    assert_eq!(
        fixed("-\tfirst, second here.\n"),
        "-\tfirst,\n \t second here.\n"
    );
    let quote: MarkdownSource = parse(">\tfirst, second word.\n", false);
    assert_eq!(
        continuation_prefix(&quote, first(&quote, MdastNodeType::Paragraph)),
        ">\t"
    );
}

/// Text under inline wrappers resolves to its one paragraph; non-prose ancestors exclude it.
#[test]
fn paragraph_lookup_climbs_inline_wrappers_and_respects_exclusions() {
    let nested: MarkdownSource = parse("> - **_deep, text_** and ~~more, text~~ here\n", false);
    let paragraph: u32 = first(&nested, MdastNodeType::Paragraph);
    // Count the checked text nodes so an empty traversal cannot pass silently.
    let mut texts: usize = 0;
    for id in nested.visible_nodes() {
        if nested.kind(*id) != MdastNodeType::Text {
            continue;
        }
        texts += 1;
        assert_eq!(paragraph_for(&nested, *id), Some(paragraph));
    }
    assert_eq!(texts, 4);
    for source in [
        "# Title, here\n",
        "Text[^note] here\n\n[^note]: A note, with more\n",
        "A [link, text](/target) here\n",
    ] {
        let context: MarkdownSource = parse(source, false);
        // The last text node sits under the excluded heading, footnote definition or link.
        let mut excluded: Option<u32> = None;
        for id in context.visible_nodes() {
            if context.kind(*id) == MdastNodeType::Text && context.slice(*id).contains(',') {
                excluded = Some(*id);
            }
        }
        assert_eq!(
            paragraph_for(&context, excluded.expect("comma text")),
            None,
            "{source}"
        );
    }
}

/// The parser never places a paragraph inside another paragraph, in Markdown or below MDX elements.
#[test]
fn paragraphs_never_nest_inside_paragraphs() {
    for (source, mdx) in [
        ("> - **_deep, text_** and ~~more, text~~ here\n", false),
        (
            "1. one, item\n\n   second, paragraph\n\n   > quoted, paragraph\n",
            false,
        ),
        (
            "Text[^note], here\n\n[^note]: A note, with *emphasis, inside* it\n",
            false,
        ),
        (
            "A [link, text](/target) and ![image, alt](/image.png) here\n",
            false,
        ),
        (
            "Outer <b>inline, element</b> text\n\n<div>\n\nInner, paragraph\n\n</div>\n",
            true,
        ),
    ] {
        let context: MarkdownSource = parse(source, mdx);
        let mut paragraphs: usize = 0;
        for id in context.all_nodes() {
            if context.kind(*id) != MdastNodeType::Paragraph {
                continue;
            }
            paragraphs += 1;
            assert!(
                !context.has_ancestor(*id, MdastNodeType::Paragraph),
                "{source}"
            );
        }
        // Each fixture must really contain paragraphs, or the loop asserted nothing.
        assert!(paragraphs > 0, "{source}");
        // The ancestry query itself can answer yes: paragraph text has a paragraph ancestor.
        let text: u32 = first(&context, MdastNodeType::Text);
        assert!(
            context.has_ancestor(text, MdastNodeType::Paragraph),
            "{source}"
        );
    }
}
