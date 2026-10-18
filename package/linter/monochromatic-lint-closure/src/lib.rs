#![feature(rustc_private)]

extern crate rustc_errors;
extern crate rustc_hir;
extern crate rustc_middle;
extern crate rustc_span;

use rustc_errors::{Diag, DiagCtxtHandle, Diagnostic, Level};
use rustc_hir::def_id::DefId;
use rustc_hir::{Expr, ExprKind, Node};
use rustc_lint::{LateContext, LateLintPass, LintContext};
use rustc_middle::ty::{ClauseKind, TyKind};

dylint_linting::declare_late_lint! {
    /// Reports a closure that captures a local unless it is a direct argument whose callee parameter is bounded by
    /// `'static`. Probe for the cost and attribute behavior of a rustc driver lint.
    pub CLOSURE_PROBE,
    Warn,
    "closure with captures that is not handed to a 'static callee"
}

struct ClosureFound {
    message: String,
}

impl<'a> Diagnostic<'a> for ClosureFound {
    fn into_diag(self, dcx: DiagCtxtHandle<'a>, level: Level) -> Diag<'a> {
        let mut diag = Diag::new(dcx, level, "");
        diag.primary_message(self.message);
        diag
    }
}

/// Whether the callee's declared parameter at `index` is a generic type parameter carrying a `'static` outlives bound.
fn parameter_is_static_bounded(cx: &LateContext<'_>, callee: DefId, index: usize) -> bool {
    let tcx = cx.tcx;
    let inputs = tcx.fn_sig(callee).skip_binder().skip_binder().inputs();
    let Some(parameter) = inputs.get(index) else {
        return false;
    };
    if !matches!(parameter.kind(), TyKind::Param(_)) {
        return false;
    }
    return tcx.param_env(callee).caller_bounds().any(|clause| {
        match clause.kind().skip_binder() {
            ClauseKind::TypeOutlives(outlives) => outlives.0 == *parameter && outlives.1.is_static(),
            _ => false,
        }
    });
}

impl<'tcx> LateLintPass<'tcx> for ClosureProbe {
    fn check_expr(&mut self, cx: &LateContext<'tcx>, expr: &'tcx Expr<'tcx>) {
        let ExprKind::Closure(closure) = expr.kind else {
            return;
        };
        let captured = cx.tcx.upvars_mentioned(closure.def_id).map_or(0, |upvars| upvars.len());
        if captured == 0 {
            cx.emit_span_lint(CLOSURE_PROBE, expr.span, ClosureFound {
                message: "closure captures nothing, so a named fn can replace it".to_owned(),
            });
            return;
        }
        let Node::Expr(parent) = cx.tcx.parent_hir_node(expr.hir_id) else {
            cx.emit_span_lint(CLOSURE_PROBE, expr.span, ClosureFound {
                message: format!("closure captures {captured} local(s) and is not a direct call argument"),
            });
            return;
        };
        let typeck = cx.tcx.typeck(expr.hir_id.owner.def_id);
        let callee_and_index = match parent.kind {
            ExprKind::Call(callee, args) => {
                let position = args.iter().position(|arg| arg.hir_id == expr.hir_id);
                let def = match callee.kind {
                    ExprKind::Path(ref qpath) => typeck.qpath_res(qpath, callee.hir_id).opt_def_id(),
                    _ => None,
                };
                def.zip(position)
            }
            ExprKind::MethodCall(_, _, args, _) => {
                let position = args.iter().position(|arg| arg.hir_id == expr.hir_id);
                typeck.type_dependent_def_id(parent.hir_id).zip(position.map(|index| index + 1))
            }
            _ => None,
        };
        let verdict = match callee_and_index {
            Some((callee, index)) if parameter_is_static_bounded(cx, callee, index) => return,
            Some(_) => "the callee parameter has no 'static bound",
            None => "the callee is not a resolvable function",
        };
        cx.emit_span_lint(CLOSURE_PROBE, expr.span, ClosureFound {
            message: format!("closure captures {captured} local(s) but {verdict}"),
        });
    }
}
