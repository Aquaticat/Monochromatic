// What:     `use crate::config::Config;` imports the settings type from this
//           crate. `crate::` means "from the root of this same crate" (not an
//           external dependency).
// Why:      Rules receive the config so they can read knobs like the budget.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Config } from "./config";
// ```
use crate::config::Config;

// What:     `use crate::context::LintContext;` imports the per-file bundle.
// Why:      Rules read the file's code lines, path, and source from it.
//
// In TS you'd write (pseudocode):
// ```ts
// import { LintContext } from "./context";
// ```
use crate::context::LintContext;

// What:     `use crate::diagnostic::Diagnostic;` imports the finding record.
// Why:      Rules push findings into a list of these.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Diagnostic } from "./diagnostic";
// ```
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
pub trait Rule {
    // What:     `fn id(&self) -> &'static str;`. A method signature with no body
    //           (implementors fill it in). `&self` borrows the rule read-only;
    //           `&'static str` is a program-lifetime borrowed string (the rule's
    //           fixed name). Sibling return type: owned `String`.
    // Why:      Name the rule for diagnostics and config.
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
pub fn all_rules() -> Vec<Box<dyn Rule>> {
    // What:     `vec![Box::new(crate::rules::max_lines::MaxLines)]`. `vec![...]`
    //           builds a `Vec`. `Box::new(value)` moves `value` onto the heap and
    //           yields the owning pointer. `crate::rules::max_lines::MaxLines` is
    //           the unit struct (a zero-field type) for the one rule. Tail
    //           expression, so it is returned.
    // Why:      Today there is exactly one rule; adding more is just more boxed
    //           entries here.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return [new MaxLines()];
    // ```
    vec![Box::new(crate::rules::max_lines::MaxLines)]
}
