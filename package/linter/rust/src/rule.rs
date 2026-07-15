//! Rule trait and registry for enabled lint rules.

// What:     `use crate::config::Config;` imports the settings type from this
//           crate. `crate::` means "from the root of this same crate" (not an
//           external dependency).
// Why:      Rules receive the config so they can read knobs like the budget.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Config } from "./config";
// ```
/// Imports shared rule configuration.
use crate::config::Config;

// What:     `use crate::context::LintContext;` imports the per-file bundle.
// Why:      Rules read the file's code lines, path, and source from it.
//
// In TS you'd write (pseudocode):
// ```ts
// import { LintContext } from "./context";
// ```
/// Imports parsed per-file context.
use crate::context::LintContext;

// What:     `use crate::diagnostic::Diagnostic;` imports the finding record.
// Why:      Rules push findings into a list of these.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Diagnostic } from "./diagnostic";
// ```
/// Imports diagnostic payload type.
use crate::diagnostic::Diagnostic;

// What:     `pub trait Rule { ... }`. A `trait` is a set of methods a type must
//           provide; it is Rust's version of a TypeScript `interface`.
// Why:      Every lint rule implements this shared shape so the runner can treat
//           them uniformly and the set is easy to grow.
//
// In TS you'd write (pseudocode):
// ```ts
// interface Rule { id(): string; check(ctx: LintContext, cfg: Config, out: Diagnostic[]): void; }
// ```
/// Shared interface implemented by every lint rule.
pub trait Rule {
    // What:     `fn id(&self) -> &'static str;`. A method signature with no body
    //           (implementors fill it in). `&self` borrows the rule read-only;
    //           `&'static str` is a program-lifetime borrowed string (the rule's
    //           fixed name). Sibling return type: owned `String`.
    // Why:      Name the rule for diagnostics and config.
    /// Return stable rule identifier used in diagnostics.
    fn id(&self) -> &'static str;

    // What:     `fn check(&self, context: &LintContext, config: &Config, out: &mut
    //           Vec<Diagnostic>);`. `&LintContext` and `&Config` are read-only
    //           borrows. `out: &mut Vec<Diagnostic>` is a MUTABLE borrow of the
    //           caller's vector: the rule appends findings into it rather than
    //           returning a new list, so all rules share one growing buffer.
    // Why:      Give the rule everything to inspect and a place to report into.
    // Gotcha:   `&mut` means exclusive borrow: while a rule holds it, nothing else
    //           may touch `out`. The runner calls rules one at a time, so this is
    //           fine.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // check(ctx: LintContext, cfg: Config, out: Diagnostic[]): void;
    // ```
    /// Inspect one file context and append diagnostics.
    fn check(&self, context: &LintContext, config: &Config, out: &mut Vec<Diagnostic>);
}

// What:     `pub fn all_rules() -> Vec<Box<dyn Rule>>`. Returns the enabled rule
//           set. `Box<dyn Rule>` is a heap-allocated "trait object": an owning
//           pointer to some value whose concrete type is only known at runtime
//           but which implements `Rule`. `dyn` marks dynamic dispatch. Siblings:
//           `Rc<dyn Rule>` / `Arc<dyn Rule>` (shared instead of single-owner).
// Why:      Different rule types have different sizes, so we box them to store
//           them together in one `Vec`; the runner iterates and calls `check`.
//
// In TS you'd write (pseudocode):
// ```ts
// function allRules(): Rule[] { return [new MaxLines()]; }
// ```
/// Build the enabled lint rule set.
pub fn all_rules() -> Vec<Box<dyn Rule>> {
    // What:     `vec![Box::new(...) as Box<dyn Rule>, Box::new(...)]`. `vec![...]`
    //           builds a `Vec`. `Box::new(value)` moves `value` onto the heap and
    //           yields the owning pointer. `crate::builtin::max_lines::MaxLines` and
    //           `crate::builtin::require_rustdoc::RequireRustdoc` are the unit structs
    //           (zero-field types) for the two rules. The `as Box<dyn Rule>` on the
    //           first entry "forgets" its concrete type so the list's element type
    //           is the trait object; the second entry then coerces to match. Tail
    //           expression, so it is returned.
    // Why:      Every registered rule runs against every file; adding a rule is
    //           just another boxed entry here. Two DIFFERENT concrete types in one
    //           list need that first `as` cast, or the array's element type cannot
    //           be inferred.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return [new MaxLines(), new RequireRustdoc()];
    // ```
    vec![
        Box::new(crate::builtin::max_lines::MaxLines) as Box<dyn Rule>,
        Box::new(crate::builtin::require_rustdoc::RequireRustdoc),
    ]
}
