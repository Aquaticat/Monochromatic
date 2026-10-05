//! What: Decide what one `git` invocation of the native wrapper does, and perform it.
//! Why: The executable stays thin: it gathers process facts, asks this module for an
//!      action, and performs it. The decision itself is testable without replacing
//!      the test process.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // const action = planInvocation(args, env, inputs); perform(action);
//! ```

/// Import the sibling modules the decision combines.
use super::action::{Action, ENGINE_FAILURE_EXIT_CODE, failure, policy_execution_unavailable};
use super::child_environment::{
    FORWARD_TARGET_VARIABLE, child_environment_overlay, environment_value,
};
use super::config_loading::{ConfigLoading, classify_config_loading};
use super::forwarding::replace_process_with_real_git;
use super::global_arguments::{GlobalLayout, GlobalOutcome, global_layout};
use super::invocation_config::{
    InvocationConfigError, config_invalid_event, legacy_warning_events, load_invocation_config,
};
use super::management::plan_management;
use super::real_git::{ResolutionInputs, process_resolution_inputs, resolve_real_git};
use super::real_git_candidate::same_file;
/// What: `OsString` is owned operating-system text of raw OS bytes (sibling `String`
///       must be UTF-8).
/// Why:  Arguments and environment values are never decoded.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // process.argv and process.env, but byte-preserving.
/// ```
use std::ffi::OsString;
/// The trait that gives output streams `.write_all(..)`.
use std::io::Write;
/// `Path`/`PathBuf` are borrowed/owned filesystem paths of raw OS bytes.
use std::path::{Path, PathBuf};

/// The management namespace: `git cli-git ...` is handled by the wrapper, never by Git.
pub const MANAGEMENT_COMMAND: &str = "cli-git";

/// What: Explain that another cli-git wrapper selected this executable as real Git.
///       `&Path` borrows this executable's path for the message.
/// Why:  Forwarding again would bounce between the two wrappers forever; stopping
///       names this executable so the user can fix PATH.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function forwardedToSelf(ownExecutable: string): Action;
/// ```
fn forwarded_to_self(own_executable: &Path) -> Action {
    // `format!` builds owned text; `.as_str()` lends it to the helper.
    return failure(
        format!(
            "another cli-git wrapper selected this cli-git executable ({}) as real Git. \
             Forwarding again would never reach Git. Remove the extra cli-git from PATH or \
             place the real Git executable on PATH.",
            own_executable.display()
        )
        .as_str(),
    );
}

/// What: Decide the action for one invocation from injected process facts.
///       `&[OsString]` borrows the arguments after the program name;
///       `&[(OsString, OsString)]` borrows the environment as name/value pairs.
/// Why:  Order matters. The recursion check runs before anything else. The management
///       namespace is answered by the wrapper. Commands that need no policy
///       configuration are forwarded without reading it. Every other command
///       validates configuration and then stops, because policy execution is not
///       implemented yet and forwarding it unguarded would silently drop enforcement.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function planInvocation(args: string[], environment: [string, string][], inputs: ResolutionInputs): Action;
/// ```
pub fn plan_invocation(
    arguments: &[OsString],
    environment: &[(OsString, OsString)],
    inputs: &ResolutionInputs,
) -> Action {
    // `if let Some(target) = ... && cond` runs only when a forwarding wrapper left its
    // marker and that marker names this executable.
    if let Some(target) = environment_value(environment, FORWARD_TARGET_VARIABLE)
        && same_file(Path::new(&target), inputs.own_executable.as_path())
    {
        return forwarded_to_self(inputs.own_executable.as_path());
    }
    let layout: GlobalLayout = global_layout(arguments);
    if layout.outcome == GlobalOutcome::Command
        && arguments[layout.prefix_len] == MANAGEMENT_COMMAND
    {
        // `&arguments[a..]` borrows from index `a` on; `&arguments[..a]` borrows up to it.
        return plan_management(
            &arguments[layout.prefix_len + 1..],
            &arguments[..layout.prefix_len],
            environment,
            inputs,
        );
    }
    // What: `match` on the resolver's `Result`: keep the path or stop with its message.
    // Why:  Without real Git there is nothing to forward to.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let realGit; try { realGit = resolveRealGit(inputs); } catch (e) { return failure(String(e)); }
    // ```
    let real_git: PathBuf = match resolve_real_git(inputs) {
        Ok(found) => found,
        Err(error) => return failure(error.to_string().as_str()),
    };
    let overlay: Vec<(OsString, OsString)> =
        child_environment_overlay(environment, real_git.as_path());
    // Without a subcommand Git only prints its usage; there is nothing for policy to guard.
    if layout.outcome == GlobalOutcome::NoCommand
        || classify_config_loading(arguments) == ConfigLoading::Skip
    {
        return Action::Forward { real_git, overlay };
    }
    match load_invocation_config(
        real_git.as_path(),
        &arguments[..layout.prefix_len],
        overlay.as_slice(),
    ) {
        Ok(loaded) => {
            // `String` is owned text; `mut` allows appending the stop notice.
            let mut stderr: String = legacy_warning_events(&loaded);
            stderr.push_str(
                policy_execution_unavailable(
                    // `.to_string_lossy()` renders the subcommand for the message only.
                    arguments[layout.prefix_len].to_string_lossy().as_ref(),
                )
                .as_str(),
            );
            return Action::Exit {
                code: ENGINE_FAILURE_EXIT_CODE,
                // `String::new()` is empty owned text: wrapped commands report on standard error.
                stdout: String::new(),
                stderr,
            };
        }
        Err(InvocationConfigError::Configuration(error)) => {
            return Action::Exit {
                code: ENGINE_FAILURE_EXIT_CODE,
                stdout: String::new(),
                stderr: config_invalid_event(&error),
            };
        }
        Err(InvocationConfigError::Repository(message)) => return failure(message.as_str()),
    }
}

/// What: Run one invocation with the real process facts and return its exit code.
///       `i32` is a signed 32-bit integer, the type of process exit codes.
///       Returns only when Git was not started; a forwarded command never returns.
/// Why:  This is everything the executable's `main` does; keeping it in the library
///       lets the same code be measured by tests and mutation runs.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function runProcess(args: string[], environment: [string, string][]): number;
/// ```
pub fn run_process(arguments: &[OsString], environment: &[(OsString, OsString)]) -> i32 {
    let action: Action = match process_resolution_inputs(environment) {
        Ok(inputs) => plan_invocation(arguments, environment, &inputs),
        Err(error) => failure(
            format!(
                "cannot determine this executable or the current directory, so real Git \
                 cannot be selected safely: {error}"
            )
            .as_str(),
        ),
    };
    // `match` picks by variant and binds the fields each one carries.
    match action {
        Action::Forward { real_git, overlay } => {
            let error: std::io::Error =
                replace_process_with_real_git(real_git.as_path(), arguments, overlay.as_slice());
            write_stream(
                &mut std::io::stderr(),
                format!("cli-git: cannot start {}: {error}\n", real_git.display()).as_str(),
            );
            return ENGINE_FAILURE_EXIT_CODE;
        }
        Action::Exit {
            code,
            stdout,
            stderr,
        } => {
            // `&mut` lends each stream for writing.
            write_stream(&mut std::io::stdout(), stdout.as_str());
            write_stream(&mut std::io::stderr(), stderr.as_str());
            return code;
        }
    }
}

/// What: Write text to an output stream, ignoring a closed stream.
///       `&mut dyn Write` lends "any writable stream" (`dyn` means the concrete type is
///       chosen at run time, like a TS interface value).
/// Why:  The exit code already carries the result; a reader that went away must not
///       turn a diagnostic into a panic.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function writeStream(stream: Writable, text: string): void { try { stream.write(text); } catch {} }
/// ```
fn write_stream(stream: &mut dyn Write, text: &str) {
    // What: `let _ = ...` deliberately discards the write's `Result`.
    // Why:  There is nowhere left to report a failure to write a diagnostic.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // try { stream.write(text); } catch { /* reader closed */ }
    // ```
    let _ = stream.write_all(text.as_bytes());
}

/// Stop controls for a looping, missing or uninterpretable real Git.
#[cfg(test)]
#[path = "entry_stop_tests.rs"]
mod stop_tests;

/// Decision controls and the shared fixtures stay out of the release executable.
#[cfg(test)]
#[path = "entry_tests.rs"]
mod tests;
