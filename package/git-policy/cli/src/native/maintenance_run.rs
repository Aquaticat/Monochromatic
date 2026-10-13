//! What:
//!  Running automatic maintenance after a landing:
//!  one `git config` read for the maintenance keys,
//!  then `git maintenance run --auto --quiet`, detached or not, in the real worktree.
//!  Its exit status is returned for the caller to ignore, as native Git does.
//! Why:
//!  Every landing migrates its objects into one pack;
//!  without this step the pack count grows by one per commit and every later Git process searches every pack.
//!  Failures are logged and never fail the landed commit.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! await runAutoMaintenance({ gitPath, cwd, globalArgs });
//! ```

/// The decision and its error type.
use super::maintenance_decision::{
    MAINTENANCE_CONFIG_PATTERN, MaintenanceDecision, MaintenanceError, auto_maintenance_arguments,
    parse_config_records,
};
/// Diagnostics on standard error, switched like the incumbent's console sink.
use super::diagnostic_log;
/// The real-Git context and the captured output of one start.
use super::transaction_git::{GitContext, GitOutput, GitRequest, run_git};
/// `Path` is a borrowed filesystem path.
use std::path::Path;

/// Tag the incumbent's logger prints for this function, so diagnostics match.
const TAG: &str = "runAutoMaintenance";

/// Exit status `parse_options` uses for an unknown option,
///  which Git before 2.47 reports for `maintenance run --detach`.
const USAGE_EXIT_CODE: i32 = 129;

/// Exit status of `git config --get-regexp` when no key matches.
const CONFIG_UNSET_EXIT_CODE: i32 = 1;

/// What:
///  What automatic maintenance did.
/// Why:
///   Configuration can turn it off, which is not an exit status;
///  the caller distinguishes the two.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Outcome = typeof AUTO_MAINTENANCE_DISABLED | number;
/// ```
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AutoMaintenanceOutcome {
    /// Configuration disabled maintenance; no maintenance Git ran.
    Disabled,
    /// Git's exit status for the maintenance run, or for the config read when that read failed.
    Exited(i32),
}

/// What:
///  Git's exit status, where a signal ending Git counts as `1`.
/// Why:
///   The incumbent reads a missing exit code as `1` (`exitCode ?? 1`).
///
/// In TS you'd write (pseudocode):
/// ```ts
/// child.exitCode ?? 1
/// ```
fn exit_status(code: Option<i32>) -> i32 {
    return code.unwrap_or(1);
}

/// What:
///  Map a start failure to a maintenance error that names the command.
/// Why:
///   The caller logs one line that says which Git start could not run.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// throw new CommitTransactionGitError(`${command} could not start`);
/// ```
fn start_failure(command: &str, error: std::io::Error) -> MaintenanceError {
    return MaintenanceError::Start(format!("{command} could not start: {error}"));
}

/// What:
///  Run automatic maintenance in the real worktree with the caller's global options.
/// Why:
///   The read and the run happen in the same order the incumbent uses,
///  so the decision and its effect agree on one configuration snapshot per read.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // config read, then `git maintenance run --auto --quiet --detach|--no-detach`; retry without the flag on 129
/// ```
pub fn run_auto_maintenance(
    context: &GitContext,
    cwd: &Path,
) -> Result<AutoMaintenanceOutcome, MaintenanceError> {
    // Config lookup; exit 1 means no key is set.
    let lookup: GitOutput = run_git(
        context,
        &GitRequest::new(
            cwd,
            &[
                "config",
                "--type=bool-or-int",
                "--null",
                "--get-regexp",
                MAINTENANCE_CONFIG_PATTERN,
            ],
        ),
    )
    .map_err(|error| return start_failure("git config", error))?;
    let lookup_code: i32 = exit_status(lookup.code);
    if lookup_code != 0 && lookup_code != CONFIG_UNSET_EXIT_CODE {
        diagnostic_log::warn(
            TAG,
            format!(
                "skipping automatic maintenance: git config exited {lookup_code}: {}",
                String::from_utf8_lossy(&lookup.stderr).trim()
            )
            .as_str(),
        );
        return Ok(AutoMaintenanceOutcome::Exited(lookup_code));
    }
    // An unset key prints nothing, so an exit of 1 parses as an empty configuration.
    let config_bytes: &[u8] = if lookup_code == 0 {
        lookup.stdout.as_slice()
    } else {
        &[]
    };
    let config = parse_config_records(config_bytes)?;
    // Native maintenance arguments, or the disabled outcome.
    let arguments: Vec<&'static str> = match auto_maintenance_arguments(&config) {
        MaintenanceDecision::Disabled => {
            diagnostic_log::debug(
                TAG,
                "automatic maintenance disabled by configuration",
            );
            return Ok(AutoMaintenanceOutcome::Disabled);
        }
        MaintenanceDecision::Run(arguments) => arguments,
    };
    diagnostic_log::debug(TAG, format!("running git {}", arguments.join(" ")).as_str());
    // Maintenance outcome; a detached run returns once the background process is forked.
    let result: GitOutput = run_git(
        context,
        &GitRequest::new(cwd, arguments.as_slice()),
    )
    .map_err(|error| return start_failure("git maintenance run", error))?;
    let result_code: i32 = exit_status(result.code);
    if result_code != USAGE_EXIT_CODE {
        diagnostic_log::debug(
            TAG,
            format!("automatic maintenance exited {result_code}").as_str(),
        );
        return Ok(AutoMaintenanceOutcome::Exited(result_code));
    }
    // Git before 2.47 has no detach option; its native form omits it and gc detaches on its own.
    let flag: &str = arguments.last().copied().unwrap_or("");
    diagnostic_log::debug(
        TAG,
        format!(
            "git rejected {flag}; retrying in the pre-2.47 form: {}",
            String::from_utf8_lossy(&result.stderr).trim()
        )
        .as_str(),
    );
    let fallback_arguments: &[&str] = &arguments[..arguments.len() - 1];
    let fallback: GitOutput = run_git(
        context,
        &GitRequest::new(cwd, fallback_arguments),
    )
    .map_err(|error| return start_failure("git maintenance run", error))?;
    let fallback_code: i32 = exit_status(fallback.code);
    diagnostic_log::debug(
        TAG,
        format!("automatic maintenance exited {fallback_code}").as_str(),
    );
    return Ok(AutoMaintenanceOutcome::Exited(fallback_code));
}

/// Runner controls live beside the runner.
#[cfg(test)]
#[path = "maintenance_run_tests.rs"]
mod tests;
