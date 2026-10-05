//! Native entry point for the read-only source-view implementation.

/// What: Import the app's GUI entry point and standard error envelope.
/// Why: Native startup returns diagnostics to the shell without silent exits.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { run } from './native';
/// ```
mod native;

/// Parse help and usage before starting logging, filesystem reads, or a native display connection.
fn main() -> anyhow::Result<()> {
    // What: args_os retains native filename bytes; skip omits the executable name and collect owns the arguments.
    // Why: Non-UTF-8 project names must not be converted through lossy display strings.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const args = nativeArgv.slice(1);
    // ```
    let args: Vec<_> = std::env::args_os().skip(1).collect();
    // What: match extracts the parsed options or preserves the concrete clap error for its exit policy.
    // Why: Help/version exit successfully without creating a window; usage errors use status 2.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const options = parseOrPrintAndExit(args);
    // return run(options);
    // ```
    let options = match ide_app::cli::parse_args(&args) {
        Ok(options) => options,
        Err(error) => {
            if let Some(cli) = error.downcast_ref::<clap::Error>() {
                // Exit is clap's documented terminal operation; no application resources have been started.
                cli.exit();
            }
            return Err(error);
        }
    };
    return native::run(options);
}
