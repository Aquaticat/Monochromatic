//! What:
//!  Reject Rust closure expressions in the parsed source tree.
//! Why:
//!  Callbacks must point to named functions or methods,
//!  not anonymous function bodies.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // Report every ArrowFunction or unnamed FunctionExpression in the parsed tree.
//! ```

/// What:
///  Import the shared finding model and retained Rust parse.
/// Why:
///  This rule reuses the existing parse and byte-coordinate convention.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { Diagnostic, Severity, Span, RustSource } from './core';
/// ```
use crate::diagnostic::{Diagnostic, Severity, Span};
/// Import the owned source containing the already parsed syntax tree.
use crate::rust_source::RustSource;
/// Import parser node kinds and byte ranges,
///  not a text-pattern approximation.
use ra_ap_syntax::{SyntaxKind, TextRange};

/// What:
///  Report each parsed closure,
///  including nested,
///  bound,
///  move and async closures.
/// Why:
///  Naming a variable holding a closure does not give the function itself a declaration name.
/// No fix is emitted:
///  captured state can require changing the callback's surrounding API usage.
/// Macro token trees are not expanded by this syntax-only frontend.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function checkNoAnonymousFunctions(context: RustSource, severity: Severity): Diagnostic[];
/// ```
pub fn check_no_anonymous_functions(context: &RustSource, severity: Severity) -> Vec<Diagnostic> {
    // What: Vec<Diagnostic> is an owned growable list, unlike a borrowed &[Diagnostic]
    // or fixed-length [Diagnostic; N]. mut permits appending; the return transfers ownership.
    // Why: The number of anonymous functions depends on the input, not a fixed array length.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const findings: Diagnostic[] = [];
    // ```
    let mut findings: Vec<Diagnostic> = Vec::<Diagnostic>::new();
    for node in context.syntax().descendants() {
        if node.kind() != SyntaxKind::CLOSURE_EXPR {
            continue;
        }
        // What: TextRange describes bytes in the original file; usize indexes those bytes.
        // u32/u64/i32/i64 are fixed-width alternatives, but source slices use platform-sized usize.
        // Why: Borrowed source coordinates avoid reconstructing or reformatting a closure body.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const { start: offset, length } = node.byteRange;
        // ```
        let range: TextRange = node.text_range();
        let offset: usize = usize::from(range.start());
        let length: usize = usize::from(range.len());
        let span: Span = context.span(offset, length);
        // What: String::from creates owned text, rather than a borrowed &str slice.
        // Why: A diagnostic can outlive both this call and its parsed source.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const message: string = 'Anonymous function; use a named function or method.';
        // ```
        let message: String = String::from("Anonymous function; use a named function or method.");
        // What: clone duplicates the filename's owned String without changing the source context.
        // Why: Findings retain their filename when the parser and original source are released.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const filename: string = context.filename;
        // ```
        let filename: String = context.filename.clone();
        let mut finding: Diagnostic = Diagnostic::new(
            "rust/no-anonymous-functions",
            severity,
            message,
            filename,
            span,
        );
        // What: Some wraps a present optional help string; None would mean no help text.
        // Why: Moving a captured value into a named function requires an explicit design choice.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // finding.help = 'Pass a named function or method as the callback. ...';
        // ```
        finding.help = Some(String::from(
            "Pass a named function or method as the callback. If the closure captures surrounding values, redesign how that state reaches the callback; assigning the closure to a named variable does not satisfy this rule.",
        ));
        findings.push(finding);
    }
    return findings;
}

/// Keep behavior controls out of release artifacts.
#[cfg(test)]
#[path = "rust_no_anonymous_functions_tests.rs"]
mod tests;
