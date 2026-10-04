//! Validate UI declarations and require embedded resources in the native procedural-macro compilation.

/// What: Build entry point invoked by Cargo, separate from application main.
/// Why: The non-GUI tests can exercise document logic without opening a window.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// if (features.has('gui')) compileSlint('ui/app.slint');
/// ```
fn main() {
    // Cargo passes this to the Slint procedural macro used by the native module.
    // The standalone compile_with_config validation uses the same embedding policy.
    println!("cargo:rustc-env=SLINT_EMBED_RESOURCES=true");
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
        // What: Configure fonts and other imported resources as embedded bytes.
        // Why: Runtime rendering must not require the build machine's font files.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const config = compilerConfig({ embedResources: true });
        // ```
        let config = slint_build::CompilerConfiguration::new()
            .embed_resources(slint_build::EmbedResourcesKind::EmbedFiles);
        slint_build::compile_with_config("ui/app.slint", config).expect("compile IDE UI");
    }
}
