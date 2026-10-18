//! What:
//!  A Dylint late lint that reports a closure unless it captures something and is handed to a callee that keeps it.
//! Why:
//!  A closure that captures nothing can be a named function, and a closure that only lends its captures for the
//!  duration of a call can be a loop or a named function with parameters; only a closure that owns state for a
//!  callee requiring `'static` has no named replacement.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! for (const closure of allClosures(crate)) {
//!   if (!(capturesSomething(closure) && isDirectArgumentOfStaticParameter(closure))) report(closure);
//! }
//! ```
#![feature(rustc_private)]

extern crate rustc_errors;
extern crate rustc_hir;
extern crate rustc_middle;
extern crate rustc_span;

mod capture;
mod diagnostic;
mod message;
mod placement;
mod static_bound;
#[cfg(test)]
mod message_tests;
#[cfg(test)]
mod ui_tests;
#[cfg(test)]
mod verdict_tests;

/// Import the compiler's high-level IR node types: expressions and closure kinds.
use rustc_hir::{ClosureKind, Expr, ExprKind};
/// Import the lint traits and the context passed to every check.
use rustc_lint::{LateContext, LateLintPass, LintContext};
/// Import the capture-name list builder.
use crate::capture::captured_names;
/// Import the diagnostic value.
use crate::diagnostic::ClosureFound;
/// Import the placement classifier.
use crate::placement::{Placement, classify_placement};

dylint_linting::declare_late_lint! {
    /// ### What it does
    ///
    /// Reports a closure expression unless (1) rustc's capture analysis says it captures something and (2) it is a
    /// direct call or method-call argument whose declared parameter requires `'static` (also through
    /// `Box::new(closure)`, `impl Trait` arguments, supertrait bounds, trait methods and async closures).
    ///
    /// ### Why is this bad?
    ///
    /// A closure with no captures can be a named function. A closure that is only borrowed for the duration of a call
    /// can be a loop or a named function. A callee requiring `'static` keeps the state, so only there is a closure
    /// the only way to write the callable.
    ///
    /// ### Known problems
    ///
    /// Wrappers between the closure and the bound (`Arc::new(closure)`, `Some(closure)`, struct fields,
    /// `Option<F>`) and callees that are values of fn-trait type are not recognised and stay reported.
    ///
    /// ### Example
    ///
    /// ```rust
    /// let doubled: Vec<i32> = values.iter().map(|value| value * 2).collect();
    /// ```
    ///
    /// Use instead, when the callee keeps the state:
    ///
    /// ```rust
    /// std::thread::spawn(move || state.len());
    /// ```
    pub AVOIDABLE_CLOSURE,
    Warn,
    "closure that a named function, a loop or a match could replace"
}

/// What:
///  True for a plain closure and an async closure; false for coroutines such as `async {}` blocks.
/// Why:
///  An `async` block is a closure node in the compiler's IR but not a closure expression the author wrote.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function isClosureExpression(kind: ClosureKind): boolean { return kind === 'closure' || kind === 'async-closure'; }
/// ```
fn is_closure_expression(kind: ClosureKind) -> bool {
    return matches!(kind, ClosureKind::Closure | ClosureKind::CoroutineClosure(_));
}

impl<'tcx> LateLintPass<'tcx> for AvoidableClosure {
    /// What:
    ///  Check one expression; act only on closure expressions written in the author's own code.
    /// Why:
    ///  A closure that comes from an external macro (a dependency's macro, a derive, a proc macro such as Slint's)
    ///  is not something the author can rewrite, so it is skipped; closures written by the author inside a macro
    ///  call, and closures in the author's own `macro_rules!`, are checked.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// function checkExpr(expr: Expr) {
    ///   if (!isClosureExpression(expr) || fromExternalMacro(expr)) return;
    ///   const captures = capturedNames(expr);
    ///   const placement = classifyPlacement(expr);
    ///   if (captures.length > 0 && placement === 'kept-by-callee') return;
    ///   report(expr, captures, placement);
    /// }
    /// ```
    fn check_expr(&mut self, cx: &LateContext<'tcx>, expr: &'tcx Expr<'tcx>) {
        let ExprKind::Closure(closure) = expr.kind else {
            return;
        };
        if !is_closure_expression(closure.kind) {
            return;
        }
        if expr.span.in_external_macro(cx.sess().source_map()) {
            return;
        }
        let captures: Vec<String> = captured_names(cx, closure.def_id);
        let placement: Placement = classify_placement(cx, expr);
        if !captures.is_empty() && placement == Placement::KeptByCallee {
            return;
        }
        cx.emit_span_lint(AVOIDABLE_CLOSURE, expr.span, ClosureFound { captures, placement });
    }
}
