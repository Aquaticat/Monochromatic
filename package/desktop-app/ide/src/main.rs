//! Native entry point for the read-only source-view implementation.

/// What: Import the app's GUI entry point and standard error envelope.
/// Why: Native startup returns diagnostics to the shell without silent exits.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { run } from './native';
/// ```
mod native;

/// Run the GUI, propagating startup and platform failures to the caller.
fn main() -> anyhow::Result<()> {
    return native::run();
}
