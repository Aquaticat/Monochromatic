//! Thin binary entry for the file-manager column-strip virtualization spike.
//!
//! All wiring lives in the library so in-process UI tests can build the window;
//! the binary just calls `run()`.

/// What:     `fn main() -> anyhow::Result<()>` is the program entry point.
///           Returning a `Result` lets a startup failure become a non-zero exit
///           without a manual `process.exit`-style path.
/// Why:      The whole program is `file_manager::app::run`; keep the binary thin.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function main(): Promise<void> { await run(); }
/// ```
fn main() -> anyhow::Result<()> {
    // What:     `file_manager::app::run()` runs the whole program from the library
    //           crate `file_manager`; it is the tail expression, so its
    //           `Result<()>` becomes `main`'s return value.
    // Why:      Delegate everything to the library.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return run();
    // ```
    file_manager::app::run()
}
