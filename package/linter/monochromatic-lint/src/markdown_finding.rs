//! What: Shared construction for node-anchored Markdown findings.
//! Why: Rule ports share the same byte coordinates, optional single-edit fix, and wire defaults.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // diagnose({ node, ruleId, message, fix })
//! ```

/// Import the common finding and edit models and the native parse interface.
use crate::diagnostic::{Diagnostic, Severity};
use crate::edits::{Edit, Fix};
use crate::markdown_source::MarkdownSource;

/// What: Build an owned diagnostic from a rule-visible node.
/// Why: The parser arena can be released after all findings and edits have been collected.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function finding(context, id, rule, severity, message, edit): Diagnostic;
/// ```
pub(crate) fn finding(
    context: &MarkdownSource,
    id: u32,
    rule: &str,
    severity: Severity,
    message: String,
    edit: Option<Edit>,
) -> Diagnostic {
    let mut diagnostic = Diagnostic::new(
        rule,
        severity,
        message,
        context.filename.clone(),
        context.node_span(id),
    );
    if let Some(source_edit) = edit {
        diagnostic.fix = Some(Fix { edits: vec![source_edit] });
    }
    return diagnostic;
}
