//! What: Declaration-site portion of the explicit Rust type policy.
//! Why: Missing annotation syntax is checked separately from resolving generic calls and written inference holes.
//! This module alone is not the complete rust/require-explicit-types rule.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // Check variable and anonymous-function annotations, then run semantic checks separately.
//! ```

/// What: Import the shared owned finding and borrowed source interfaces.
/// Why: Declaration checks reuse the same parse and byte-coordinate convention as the other Rust rules.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { Diagnostic, Severity, Span, RustSource } from './core';
/// ```
use crate::diagnostic::{Diagnostic, Severity, Span};
/// Import the retained Rust parse rather than parsing each declaration again.
use crate::rust_source::RustSource;
/// Import typed syntax accessors and source-node references.
use ra_ap_syntax::{AstNode, SyntaxNode, TextRange, ast};

/// What: Create a report-only finding anchored to the relevant authored syntax.
/// Why: Inferring and inserting a type is a separate operation and can change inference or coercion behavior.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function finding(context: RustSource, node: SyntaxNode, severity: Severity, message: string, help: string): Diagnostic;
/// ```
fn finding(context: &RustSource, node: &SyntaxNode, severity: Severity, message: &str, help: &str) -> Diagnostic {
    // TextRange holds byte coordinates. usize matches source indexing, unlike fixed-width u32/u64/i32/i64.
    let range: TextRange = node.text_range();
    let offset: usize = usize::from(range.start());
    let length: usize = usize::from(range.len());
    let span: Span = context.span(offset, length);
    // String owns its bytes rather than borrowing an &str; diagnostics can outlive the parsed source.
    let owned_message: String = String::from(message);
    // Clone the owned filename without moving it out of the shared context.
    let filename: String = context.filename.clone();
    let mut diagnostic: Diagnostic = Diagnostic::new(
        "rust/require-explicit-types",
        severity,
        owned_message,
        filename,
        span,
    );
    // Some stores present help text, whereas None would omit it from the wire output.
    diagnostic.help = Some(String::from(help));
    return diagnostic;
}

/// What: Require annotations on let statements and anonymous-function parameters/results.
/// Why: These are declaration positions where valid Rust otherwise infers a type.
/// Named function parameters and non-unit results are already mandatory in Rust;
/// omitted named-function results declare unit rather than inferring a result.
/// Loop and conditional patterns have no equivalent annotation slot and are not rewritten.
/// Existing annotations, including `_`, are left for the semantic half to validate.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function checkDeclarationAnnotations(context: RustSource, severity: Severity): Diagnostic[];
/// ```
pub fn check_declaration_annotations(context: &RustSource, severity: Severity) -> Vec<Diagnostic> {
    // Vec is owned and growable, unlike a borrowed slice or fixed-size array.
    let mut findings: Vec<Diagnostic> = Vec::<Diagnostic>::new();
    for node in context.syntax().descendants() {
        // Clone only the shared syntax handle so another typed view can inspect it without consuming this view.
        let possible_statement: Option<ast::LetStmt> = ast::LetStmt::cast(node.clone());
        if let Some(statement) = possible_statement {
            if statement.ty().is_some() {
                continue;
            }
            // Recovery nodes with no pattern do not establish a variable declaration.
            let Some(pattern) = statement.pat() else {
                continue;
            };
            findings.push(finding(
                context,
                pattern.syntax(),
                severity,
                "Missing explicit type annotation on variable binding.",
                "Add ': Type' after the whole binding pattern, including destructuring and let-else patterns.",
            ));
            // The descendants iterator still visits children, including an anonymous-function initializer.
            continue;
        }
        // Some narrows an optional typed node; other syntax contributes no declaration requirement here.
        let Some(closure) = ast::ClosureExpr::cast(node) else {
            continue;
        };
        let Some(parameters) = closure.param_list() else {
            continue;
        };
        for parameter in parameters.params() {
            if parameter.ty().is_some() {
                continue;
            }
            findings.push(finding(
                context,
                parameter.syntax(),
                severity,
                "Missing explicit type annotation on anonymous-function parameter.",
                "Add ': Type' after the parameter pattern, or replace the anonymous function with a named function.",
            ));
        }
        if closure.ret_type().is_some() {
            continue;
        }
        findings.push(finding(
            context,
            parameters.syntax(),
            severity,
            "Missing explicit return-type annotation on anonymous function.",
            "Add '-> Type' and a block body, including '-> ()' for unit, or use a named function.",
        ));
    }
    return findings;
}

/// Keep declaration controls separate from release code.
#[cfg(test)]
#[path = "rust_explicit_declarations_tests.rs"]
mod tests;
