//! What: Paragraph and delimiter boundaries for semantic prose breaks.
//! Why: A break must stay within its original container and outside closing emphasis delimiters.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // Find prose ancestry, climb co-terminating inline wrappers, and retain the container continuation prefix.
//! ```

/// Import only the native source interface and its typed node catalog.
use crate::markdown_source::MarkdownSource;
use satteri_ast::mdast::MdastNodeType;

/// Find the enclosing paragraph unless a non-prose ancestor excludes this text.
pub(crate) fn paragraph_for(context: &MarkdownSource, id: u32) -> Option<u32> {
    // These ancestors represent content with another syntax or a single-line contract.
    const SKIP: &[MdastNodeType] = &[
        MdastNodeType::Heading,
        MdastNodeType::Table,
        MdastNodeType::TableRow,
        MdastNodeType::TableCell,
        MdastNodeType::Link,
        MdastNodeType::LinkReference,
        MdastNodeType::Image,
        MdastNodeType::ImageReference,
        MdastNodeType::Definition,
        MdastNodeType::Html,
        MdastNodeType::FootnoteDefinition,
        MdastNodeType::FootnoteReference,
    ];
    // Option carries a discovered paragraph id, not a synthesized fallback node.
    let mut paragraph: Option<u32> = None;
    let mut cursor: Option<u32> = context.parent(id);
    while let Some(parent) = cursor {
        let kind: MdastNodeType = context.kind(parent);
        if SKIP.contains(&kind) {
            return None;
        }
        // Paragraphs hold only inline content, so at most one ancestor matches and it is also the nearest one.
        if kind == MdastNodeType::Paragraph {
            paragraph = Some(parent);
        }
        cursor = context.parent(parent);
    }
    return paragraph;
}

/// Climb only inline delimiters whose final child is the current tail.
pub(crate) fn delimiter_tail(context: &MarkdownSource, id: u32) -> u32 {
    let mut tail: u32 = id;
    while let Some(parent) = context.parent(tail) {
        let kind: MdastNodeType = context.kind(parent);
        if kind != MdastNodeType::Strong
            && kind != MdastNodeType::Emphasis
            && kind != MdastNodeType::Delete
        {
            break;
        }
        if context.children(parent).last() != Some(&tail) {
            break;
        }
        tail = parent;
    }
    return tail;
}

/// Keep quote markers and indentation while replacing list-marker characters with spaces.
pub(crate) fn continuation_prefix(context: &MarkdownSource, paragraph: u32) -> String {
    // Copy only the paragraph's opening line prefix; usize is the byte-offset type every source slice takes.
    let (start, _): (usize, usize) = context.offsets(paragraph);
    // Zero stands for a paragraph on the first line, where no earlier line ending exists.
    let mut line_start: usize = 0;
    // The standard reverse search finds the nearest LF or CR; Some carries its byte offset, None means first line.
    if let Some(ending) = context.source[..start].rfind(['\n', '\r']) {
        // Both line-ending characters are one byte, so the line begins directly after the match.
        line_start = ending + 1;
    }
    // A leading BOM affects original offsets, not the visible continuation indentation.
    if line_start == 0 && context.source.starts_with('\u{feff}') {
        line_start = '\u{feff}'.len_utf8();
    }
    let mut prefix: String = String::new();
    for character in context.source[line_start..start].chars() {
        if character == '>' || character == ' ' || character == '\t' {
            prefix.push(character);
        } else {
            prefix.push(' ');
        }
    }
    return prefix;
}

/// Container-prefix and paragraph-ancestry controls are test-only.
#[cfg(test)]
#[path = "markdown_prose_context_tests.rs"]
mod tests;
