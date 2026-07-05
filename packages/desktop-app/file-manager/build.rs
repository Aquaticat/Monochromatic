//! Compiles the Slint file-manager UI into generated Rust code.

// What:     `fn main()` is Cargo's build-script entry point. Cargo runs this
//           function once, before compiling the crate itself.
// Why:      The app needs generated Rust types for `ui/app.slint` before
//           `src/main.rs` can call `slint::include_modules!()`.
//
// In TS you'd write (pseudocode):
// ```ts
// generateUiBindings("ui/app.slint");
// ```
fn main() {
    // What:     `slint_build::compile("ui/app.slint")` invokes Slint's Rust
    //           build helper, and `.expect(...)` unwraps the success value or
    //           panics with the message when the markup compiler returns an
    //           error. `slint_build` is the build-time crate; `slint` is the
    //           runtime crate.
    // Why:      A broken `.slint` file should stop the build immediately with a
    //           clear message rather than failing later inside generated code.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // compileSlint("ui/app.slint"); // throws on markup error
    // ```
    slint_build::compile("ui/app.slint").expect("Slint UI compilation failed");
}
