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
use super::action::{Action, ENGINE_FAILURE_EXIT_CODE, failure};
use super::child_environment::{
    FORWARD_TARGET_VARIABLE, child_environment_overlay, environment_value,
};
use super::effective_target::default_allowed_worktree_dirs;
use super::forwarding::replace_process_with_real_git;
use super::global_arguments::{GlobalLayout, GlobalOutcome, global_layout};
use super::management::plan_management;
/// The linter the executable gives the Markdown policy.
use super::markdown_linter::executable_linter;
/// The shipped checks and their constructor.
use super::policy_checks::{ShippedChecks, shipped_checks};
/// A forwarded command starts with no candidate content.
use super::policy_content::LifecycleContent;
use super::real_git::{ResolutionInputs, process_resolution_inputs, resolve_real_git};
use super::real_git_candidate::same_file;
use super::repository_facts::{GitFacts, git_facts};
/// The variable that names the forbidden-strings rules file.
use super::scanner_selection::RULES_VARIABLE;
use super::wrapped_command::{WrappedOutcome, run_wrapped_command};
use super::wrapper_controls::{Controls, no_controls, strip_global_controls};
use super::wrapper_invocation::{StrippedInvocation, strip_wrapper_controls};
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

/// What: The caller's home directory from the environment, if it names one.
///       `Option<PathBuf>` is "an owned path or nothing".
/// Why:  The tool caches exempt from linked-worktree enforcement live under the home
///       directory; it comes from the injected environment, never from a fixed path.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const home = environment.HOME === undefined || environment.HOME === '' ? undefined : environment.HOME;
/// ```
fn home_directory(environment: &[(OsString, OsString)]) -> Option<PathBuf> {
    // `if let Some(home) = ... && cond` runs only when the variable is set and not empty.
    if let Some(home) = environment_value(environment, "HOME")
        && !home.is_empty()
    {
        // `Some(...)` is the "present" case; `PathBuf::from` turns the text into a path.
        return Some(PathBuf::from(home));
    }
    // `None` is the "absent" case.
    return None;
}

/// What: Decide the action for one invocation from injected process facts.
///       `&[OsString]` borrows the arguments after the program name;
///       `&[(OsString, OsString)]` borrows the environment as name/value pairs.
/// Why:  Order matters. The recursion check runs before anything else. Wrapper controls
///       written before the subcommand are removed first, because Git's own reading of
///       the arguments stops at them and would hide the subcommand from every later
///       decision. The management namespace is answered by the wrapper. Every other
///       command goes through the wrapped-command lifecycle with real Git behind it.
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
    // `mut` allows the scan to record what the removed controls asked for.
    let mut global_controls: Controls = no_controls();
    // `&mut global_controls` lends the record for writing.
    let global_clean: Vec<OsString> = strip_global_controls(arguments, &mut global_controls);
    // `.as_slice()` lends the owned list as a borrowed view.
    let layout: GlobalLayout = global_layout(global_clean.as_slice());
    if layout.outcome == GlobalOutcome::Command
        && global_clean[layout.prefix_len] == MANAGEMENT_COMMAND
    {
        // `&list[a..]` borrows from index `a` on; `&list[..a]` borrows up to it.
        return plan_management(
            &global_clean[layout.prefix_len + 1..],
            &global_clean[..layout.prefix_len],
            &global_controls,
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
    let stripped: StrippedInvocation = strip_wrapper_controls(arguments);
    // The global options before the subcommand select the repository for every fact query.
    let facts: GitFacts = git_facts(
        real_git.as_path(),
        &stripped.arguments[..stripped.layout.prefix_len],
        overlay.as_slice(),
    );
    // `mut` lets the lifecycle cache facts and state what content policies can read.
    let mut checks: ShippedChecks<GitFacts> = shipped_checks(
        facts,
        // `.clone()` copies the stripped arguments for the rule cores.
        stripped.arguments.clone(),
        LifecycleContent::None,
        default_allowed_worktree_dirs(
            environment,
            // `.as_deref()` lends the optional owned path as an optional borrowed one.
            home_directory(environment).as_deref(),
        ),
    );
    // The forbidden-strings rules variable is read from this invocation's environment.
    checks.scanner_settings.rules_variable = environment_value(environment, RULES_VARIABLE);
    // The Markdown linter is found on, and runs with, this invocation's environment.
    checks.markdown.linter = Box::new(executable_linter(environment));
    // `match` picks by variant and binds the fields each ending carries.
    match run_wrapped_command(&stripped, environment, &mut checks) {
        // `arguments: forwarded` binds the field under a new name.
        WrappedOutcome::Forward {
            arguments: forwarded,
            stderr,
        } => {
            return Action::Forward {
                real_git,
                arguments: forwarded,
                overlay,
                stderr,
            };
        }
        WrappedOutcome::Exit { code, stderr } => {
            return Action::Exit {
                code,
                // `String::new()` is empty owned text: wrapped commands report on standard error.
                stdout: String::new(),
                stderr,
            };
        }
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
        Action::Forward {
            real_git,
            arguments: forwarded,
            overlay,
            stderr,
        } => {
            // Warning events reach the caller before Git's own output.
            write_stream(&mut std::io::stderr(), stderr.as_str());
            let error: std::io::Error = replace_process_with_real_git(
                real_git.as_path(),
                forwarded.as_slice(),
                overlay.as_slice(),
            );
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
