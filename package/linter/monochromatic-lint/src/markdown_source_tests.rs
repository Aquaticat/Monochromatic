//! What: Native Markdown/MDX parser-interface controls.
//! Why: Rule ports must receive exact source slices and must not inspect MDX code as prose.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! describe('native Markdown source', () => { /* Unicode, options and subtree controls */ });
//! ```

/// Import the production adapter and typed node decoders.
use super::MarkdownSource;
use satteri_ast::mdast::{decode_heading_data, MdastNodeType};

/// Find a concrete parsed node while failing if the fixture did not exercise that syntax.
fn node(document: &MarkdownSource, kind: MdastNodeType) -> u32 {
    for id in document.all_nodes() {
        if document.kind(*id) == kind {
            return *id;
        }
    }
    panic!("fixture did not create requested node kind");
}

/// Original offsets remain byte-based after BOM stripping and astral characters.
#[test]
fn bom_and_astral_source_slices_are_exact() {
    let document = MarkdownSource::new(String::from("source.md"), String::from("\u{feff}🚀\n\n# Title\n"), false).expect("Markdown parse");
    let heading = node(&document, MdastNodeType::Heading);
    assert_eq!(document.slice(heading), "# Title");
    assert_eq!(document.node_span(heading).offset, 9);
    assert_eq!(document.node_span(heading).line, 3);
    assert_eq!(document.node_span(heading).column, 1);
    assert_eq!(decode_heading_data(document.data(heading)).depth, 1);
    assert_eq!(document.text_content(heading), "Title");
    assert_eq!(document.filename, "source.md");
    assert!(!document.mdx);
}

/// Explicit flags enable both frontmatter formats without enabling math.
#[test]
fn frontmatter_and_math_options_match_the_selected_contract() {
    let yaml = MarkdownSource::new(String::from("a.md"), String::from("---\na: b\n---\ntext\n"), false).expect("YAML parse");
    node(&yaml, MdastNodeType::Yaml);
    let toml = MarkdownSource::new(String::from("b.md"), String::from("+++\na = 1\n+++\ntext\n"), false).expect("TOML parse");
    node(&toml, MdastNodeType::Toml);
    let math = MarkdownSource::new(String::from("c.md"), String::from("$x$\n"), false).expect("plain dollar text");
    assert!(!math.all_nodes().iter().any(|id| return math.kind(*id) == MdastNodeType::InlineMath));
}

/// MDX code nodes and their children are hidden from prose-rule traversal.
#[test]
fn mdx_subtrees_are_not_prose_rule_inputs() {
    let document = MarkdownSource::new(String::from("a.mdx"), String::from("export const value = 1\n\n<div>inside</div>\n\nOutside\n"), true).expect("MDX parse");
    let esm = node(&document, MdastNodeType::MdxjsEsm);
    let jsx = node(&document, MdastNodeType::MdxJsxFlowElement);
    assert!(!document.visible_nodes().contains(&esm));
    assert!(!document.visible_nodes().contains(&jsx));
    for child in document.children(jsx) {
        assert!(!document.visible_nodes().contains(child));
    }
    assert!(document.visible_nodes().iter().any(|id| return document.kind(*id) == MdastNodeType::Paragraph));
}

/// Empty source still has a usable root and no invalid range.
#[test]
fn empty_source_has_a_valid_root() {
    let document = MarkdownSource::new(String::from("empty.md"), String::new(), false).expect("empty parse");
    assert_eq!(document.kind(0), MdastNodeType::Root);
    assert_eq!(document.node_span(0).length, 0);
    assert_eq!(document.visible_nodes(), [0]);
}

/// MDX syntax errors are typed failures, never a partially accepted tree.
#[test]
fn invalid_mdx_is_a_processing_failure() {
    let result = MarkdownSource::new(String::from("broken.mdx"), String::from("export const =\n"), true);
    let error = match result {
        Ok(_) => panic!("invalid MDX must be rejected"),
        Err(error) => error,
    };
    assert!(error.message.contains("MDX") || error.message.contains("panicked"));
    assert_eq!(error.to_string(), error.message);
}
