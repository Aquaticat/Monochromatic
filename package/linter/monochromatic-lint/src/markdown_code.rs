//! What: Fence-language normalization over exact authored source.
//! Why: Indented code stays unchanged, and unlabeled rustdoc fences must retain Rust semantics.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // MD040 inserts text normally, rust inside rustdoc.
//! ```

/// Import native code data and shared finding construction.
use satteri_ast::mdast::{decode_code_data, MdastNodeType};
use crate::diagnostic::{Diagnostic, Severity};
use crate::edits::Edit;
use crate::markdown_finding::finding;
use crate::markdown_source::MarkdownSource;

/// Return the opening marker's end using the incumbent written-form classification.
pub(crate) fn language_insert_offset(context: &MarkdownSource, id: u32) -> Option<usize> {
    let (start, _) = context.offsets(id);
    let written = context.slice(id);
    let trimmed = written.trim_start();
    if !trimmed.starts_with("```") && !trimmed.starts_with("~~~") {
        return None;
    }
    let opener = written.split('\n').next().expect("a source slice has an opening segment");
    let marker_and_rest = opener.trim_start();
    let indentation = opener.len() - marker_and_rest.len();
    let marker = marker_and_rest.as_bytes()[0];
    let mut width = 0;
    for byte in marker_and_rest.bytes() {
        if byte != marker {
            break;
        }
        width += 1;
    }
    return Some(start + indentation + width);
}

/// Add a language label to an unlabeled fence without changing its body or trailing opener whitespace.
pub fn fenced_code_language(context: &MarkdownSource, severity: Severity, rustdoc: bool) -> Vec<Diagnostic> {
    let mut findings = Vec::new();
    for id in context.visible_nodes() {
        if context.kind(*id) != MdastNodeType::Code {
            continue;
        }
        let data = decode_code_data(context.data(*id));
        if !data.lang.is_empty() {
            continue;
        }
        let Some(offset) = language_insert_offset(context, *id) else {
            continue;
        };
        let label = if rustdoc { "rust" } else { "text" };
        findings.push(finding(context, *id, "markdown/fenced-code-language", severity,
            String::from("Fenced code block has no language label."),
            Some(Edit { start: offset, end: offset, replacement: String::from(label) })));
    }
    return findings;
}
