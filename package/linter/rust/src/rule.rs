//! Registry of the rules this binary compiles in.
//!
//! The `Rule` trait itself lives in `monochromatic-rust-linter-core`, so a rule
//! package depends on that crate alone. This module only answers "which rules
//! does this binary ship".

// What:     `pub use other_crate::path::Item;` re-exports a name from a
//           DEPENDENCY under this crate's own path, so `crate::rule::Rule` keeps
//           resolving for every rule and test that already used it. A plain `use`
//           without `pub` would import it for this file only.
// Why:      The trait moved to the core crate; the path it is reached by did not.
//
// In TS you'd write (pseudocode):
// ```ts
// export { Rule } from "@monochromatic-dev/rust-linter-core/rule";
// ```
/// Re-exports the rule interface under this crate's original path.
pub use monochromatic_rust_linter_core::rule::Rule;

// What:     `pub fn all_rules() -> Vec<Box<dyn Rule>>`. `Box<dyn Rule>` is a
//           heap-allocated trait object: an owning pointer to a value whose
//           concrete type is known only at runtime but which implements `Rule`.
//           `dyn` marks dynamic dispatch. Siblings: `Rc<dyn Rule>` and
//           `Arc<dyn Rule>`, which share ownership instead of holding it alone.
// Why:      Different rule types have different sizes, so they are boxed to sit
//           in one `Vec` together; the runner iterates it and calls `check`.
//
// In TS you'd write (pseudocode):
// ```ts
// function allRules(): Rule[] { return [new MaxLines(), new RequireRustdoc()]; }
// ```
/// Build the set of rules compiled into this binary.
pub fn all_rules() -> Vec<Box<dyn Rule>> {
    // What:     `vec![Box::new(..) as Box<dyn Rule>, Box::new(..)]`. `vec!` is a
    //           macro, marked by its `!`, that builds a `Vec`. `Box::new(value)`
    //           moves the value onto the heap. The `as Box<dyn Rule>` on the
    //           first entry discards its concrete type so the array's element
    //           type is the trait object; the second then coerces to match.
    // Why:      Two DIFFERENT concrete types in one array need that first cast,
    //           or the element type cannot be inferred. Adding a rule is one more
    //           boxed entry here.
    return vec![
        Box::new(crate::builtin::max_lines::MaxLines) as Box<dyn Rule>,
        Box::new(crate::builtin::require_rustdoc::RequireRustdoc),
    ]
}
