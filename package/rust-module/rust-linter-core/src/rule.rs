//! The interface every lint rule implements.

// What:     `use crate::config::Config;` and the two lines under it import types
//           from this same crate; `crate::` means "from this crate's root".
// Why:      A rule reads config and context, and reports into a diagnostic list.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Config } from "./config";
// ```
/// Imports the settings record every rule reads.
use crate::config::Config;
/// Imports the per-file parsed context every rule inspects.
use crate::context::LintContext;
/// Imports the finding record every rule emits.
use crate::diagnostic::Diagnostic;
/// Imports the category grouping every rule declares itself into.
use crate::severity::Category;

// What:     `pub trait Rule { .. }`. A trait is a set of methods a type must
//           provide, which is Rust's version of a TS `interface`. Unlike an
//           interface, a trait can also supply default method bodies.
// Why:      The runner treats every rule uniformly, and rules can live in other
//           crates that depend on this one without this crate knowing about them.
//
// In TS you'd write (pseudocode):
// ```ts
// interface Rule {
//   id(): string;
//   plugin(): string;
//   allowsSuppression(): boolean;
//   check(ctx: LintContext, cfg: Config, out: Diagnostic[]): void;
// }
// ```
/// Shared interface implemented by every lint rule.
pub trait Rule {
    // What:     `fn id(&self) -> &'static str;`. A signature with no body, so
    //           implementors must supply one. `&self` borrows the rule read-only;
    //           `&'static str` is a borrowed string living for the whole program,
    //           which every literal in the source does.
    // Why:      Name the rule for diagnostics, config, and suppression.
    /// Return the stable rule identifier used in diagnostics and config.
    fn id(&self) -> &'static str;

    // What:     A method WITH a body inside a trait is a default: an implementor
    //           that says nothing inherits this, and one that wants something else
    //           overrides it. TS interfaces cannot do this.
    // Why:      Rules compiled into the linter itself all report the same plugin
    //           name, so only rules living in their own package need to say so.
    /// Return the rule package this rule belongs to, the code's first half.
    fn plugin(&self) -> &'static str {
        return "builtin"
    }

    // What:     Another required method, with no default body.
    // Why:      A category is how `-D pedantic` or a `[categories]` table can
    //           reach a rule at all. A default would quietly file every new rule
    //           under one group, so config aimed at that group would sweep in
    //           rules nobody meant to enable.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // category(): Category;
    // ```
    /// Return the category this rule belongs to.
    fn category(&self) -> Category;

    // What:     No default body, deliberately, unlike `plugin` above.
    // Why:      Whether a rule may be silenced inline is a policy decision, and a
    //           default would let a rule author inherit one without noticing. The
    //           repo's AGENTS.md MXL, MXR and RDC forbid silencing `max-lines` and
    //           `require-rustdoc` at all, and that guarantee is only worth
    //           anything if every new rule has to state its own answer.
    /// Report whether an inline directive may silence this rule.
    fn allows_suppression(&self) -> bool;

    // What:     `out: &mut Vec<Diagnostic>` is a MUTABLE borrow of the caller's
    //           growable array: the rule appends into it rather than returning a
    //           new one, so every rule shares one buffer.
    // Gotcha:   `&mut` is an EXCLUSIVE borrow. While a rule holds it nothing else
    //           may touch `out`, which is why the runner calls rules one at a
    //           time per file rather than concurrently within a file.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // check(ctx: LintContext, cfg: Config, out: Diagnostic[]): void;
    // ```
    /// Inspect one file context and append any findings.
    fn check(&self, context: &LintContext, config: &Config, out: &mut Vec<Diagnostic>);
}
