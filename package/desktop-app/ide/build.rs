//! Compile native UI declarations only when the GUI feature is enabled.

/// What: Build entry point invoked by Cargo, separate from application main.
/// Why: The non-GUI tests can exercise document logic without opening a window.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// if (features.has('gui')) compileSlint('ui/app.slint');
/// ```
fn main() {
    // What: Read an optional Cargo feature flag; is_ok means it exists.
    // Why: Headless document tests need no generated UI bindings.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (process.env.CARGO_FEATURE_GUI !== undefined) { ... }
    // ```
    if std::env::var("CARGO_FEATURE_GUI").is_ok() {
        // What: expect terminates the build on a returned compiler error.
        // Why: A malformed UI must fail compilation rather than ship no window.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // compileSlint('ui/app.slint'); // throws on failure
        // ```
        slint_build::compile("ui/app.slint").expect("compile IDE UI");
    }
}
