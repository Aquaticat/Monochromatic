//! What: Existing bare-URL and shortcut-reference normalization.
//! Why: Markdown and MDX require different safe link spellings, while reference identity stays unchanged.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // MD034 and MD054 over parser-owned links and references.
//! ```

/// Import typed link/reference data and the common result models.
use satteri_ast::mdast::{decode_link_data, decode_reference_data, MdastNodeType};
use crate::diagnostic::{Diagnostic, Severity};
use crate::edits::Edit;
use crate::markdown_finding::finding;
use crate::markdown_source::MarkdownSource;

/// Escape only the punctuation significant to the destination Markdown context.
fn escape(text: &str, reserved: &[char]) -> String {
    let mut output = String::new();
    for character in text.chars() {
        if reserved.contains(&character) {
            output.push('\\');
        }
        output.push(character);
    }
    return output;
}

/// Wrap bare supported URLs/emails without turning MDX text into JSX.
pub fn no_bare_urls(context: &MarkdownSource, severity: Severity) -> Vec<Diagnostic> {
    let mut findings = Vec::new();
    for id in context.visible_nodes() {
        if context.kind(*id) != MdastNodeType::Link {
            continue;
        }
        let written = context.slice(*id);
        if written.starts_with('<') || written.starts_with('[') {
            continue;
        }
        let data = decode_link_data(context.data(*id));
        let url = context.text(data.url);
        let mut wrappable = url.starts_with("mailto:");
        for scheme in ["http://", "https://", "ftp://", "ftps://"] {
            if written.starts_with(scheme) {
                wrappable = true;
            }
        }
        if !wrappable {
            continue;
        }
        let replacement;
        let message;
        if context.mdx {
            let label = escape(written, &['\\', '[', ']']);
            let destination = escape(url, &['\\', '<', '>']);
            replacement = format!("[{label}](<{destination}>)");
            message = "Bare URL; use an inline link.";
        } else {
            replacement = format!("<{written}>");
            message = "Bare URL; wrap it in angle brackets.";
        }
        let (start, end) = context.offsets(*id);
        findings.push(finding(context, *id, "markdown/no-bare-urls", severity,
            String::from(message), Some(Edit { start, end, replacement })));
    }
    return findings;
}

/// Convert only shortcut references to collapsed references by appending brackets.
pub fn link_image_style(context: &MarkdownSource, severity: Severity) -> Vec<Diagnostic> {
    let mut findings = Vec::new();
    for id in context.visible_nodes() {
        let kind = context.kind(*id);
        if kind != MdastNodeType::LinkReference && kind != MdastNodeType::ImageReference {
            continue;
        }
        let data = decode_reference_data(context.data(*id));
        // Sätteri's public codec defines 0 as Shortcut, 1 as Collapsed and 2 as Full.
        if data.reference_kind != 0 {
            continue;
        }
        let (_, end) = context.offsets(*id);
        findings.push(finding(context, *id, "markdown/link-image-style", severity,
            String::from("Shortcut reference style; use the collapsed `[label][]` style."),
            Some(Edit { start: end, end, replacement: String::from("[]") })));
    }
    return findings;
}
