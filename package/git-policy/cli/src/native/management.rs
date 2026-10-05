//! What: Decide what one `git cli-git ...` invocation does.
//! Why: Help, refusals and retired commands need no repository; `check` and `fix`
//!      validate their policy selection and configuration, then stop until policy
//!      execution exists.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // const action = planManagement(managementArgs, gitGlobalArgs, environment, inputs);
//! ```

/// Import the sibling modules the decision combines.
use super::action::{Action, ENGINE_FAILURE_EXIT_CODE, failure, policy_execution_unavailable};
use super::child_environment::child_environment_overlay;
use super::config_error::ConfigError;
use super::invocation_config::{
    InvocationConfigError, config_invalid_event, legacy_warning_events, load_invocation_config,
};
use super::management_arguments::{
    MANAGEMENT_HELP, MANAGEMENT_USAGE, ManagementAction, ManagementRefusal, RetiredCommand,
    parse_management_arguments,
};
use super::policy_registry::{POLICY_REGISTRY, policy_by_name};
use super::real_git::{ResolutionInputs, resolve_real_git};
/// What: `OsString` is owned operating-system text of raw OS bytes (sibling `String`
///       must be UTF-8).
/// Why:  Arguments and environment values are never decoded.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // string[] argv, but byte-preserving.
/// ```
use std::ffi::OsString;
/// `PathBuf` is an owned filesystem path of raw OS bytes.
use std::path::PathBuf;

/// What: The command word of a direct command.
///       `&'static str` borrows text compiled into the executable for its whole run.
/// Why:  Messages name the command the caller typed.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function directName(fix: boolean): string { return fix ? 'fix' : 'check'; }
/// ```
fn direct_name(fix: bool) -> &'static str {
    if fix {
        return "fix";
    }
    return "check";
}

/// What: The command word of a retired command.
/// Why:  The explanation names the command the caller typed.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function retiredName(command: RetiredCommand): string;
/// ```
fn retired_name(command: RetiredCommand) -> &'static str {
    // `match` must name every variant, so a new retired command cannot be forgotten.
    match command {
        RetiredCommand::Trust => return "trust",
        RetiredCommand::Untrust => return "untrust",
        RetiredCommand::Status => return "status",
    }
}

/// What: Explain that a trust command is retired.
///       `String` is the owned, line-terminated explanation.
/// Why:  Trust existed to approve executing a repository's configuration code. JSONC
///       configuration is data, so there is nothing to approve, revoke or report.
///       Old trust records are neither read nor deleted.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function retiredExplanation(command: RetiredCommand): string;
/// ```
pub fn retired_explanation(command: RetiredCommand) -> String {
    // `format!` builds the owned text; `{}` interpolates the command word.
    return format!(
        "git cli-git {} is retired. cli-git now reads cli-git.config.jsonc as data and runs no \
         repository-supplied code, so there is no code execution to approve, revoke or report. \
         Nothing was changed; existing trust records are left in place and are no longer read.\n",
        retired_name(command)
    );
}

/// What: Turn a refusal into its usage action: text on standard error, exit status 2.
/// Why:  A malformed management invocation must never fall through to Git.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function refusal(reason: ManagementRefusal): Action;
/// ```
fn refusal(reason: ManagementRefusal) -> Action {
    // `match` picks the message for the refusal and binds its `fix` flag where present.
    let stderr: String = match reason {
        ManagementRefusal::Usage => String::from(MANAGEMENT_USAGE),
        ManagementRefusal::PathspecsBeforeSeparator { fix } => format!(
            "git cli-git {} pathspecs must follow --.\n",
            direct_name(fix)
        ),
        ManagementRefusal::ScopeRequired { fix } => format!(
            "git cli-git {} requires exactly one scope: --all or non-empty pathspecs after --.\n",
            direct_name(fix)
        ),
    };
    return Action::Exit {
        code: ENGINE_FAILURE_EXIT_CODE,
        // `String::new()` is empty owned text.
        stdout: String::new(),
        stderr,
    };
}

/// What: Stop a direct command with a `config-invalid` event on standard output.
/// Why:  Direct commands report policy events on standard output, and an invalid
///       configuration or an unknown selected policy exits 2 before any policy runs.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function directConfigFailure(error: ConfigError): Action;
/// ```
fn direct_config_failure(error: &ConfigError) -> Action {
    return Action::Exit {
        code: ENGINE_FAILURE_EXIT_CODE,
        stdout: config_invalid_event(error),
        stderr: String::new(),
    };
}

/// What: Find the first selected policy ID that no shipped policy has.
///       `Option<ConfigError>` is "an error or nothing".
/// Why:  `--policy` selects among shipped policies only; a mistyped ID must stop the
///       command instead of selecting nothing.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function unknownSelectedPolicy(policies: string[]): ConfigError | undefined;
/// ```
fn unknown_selected_policy(policies: &[String]) -> Option<ConfigError> {
    // `for id in policies` borrows each selected ID in order.
    for id in policies {
        if policy_by_name(id.as_str()).is_none() {
            let mut known: String = String::new();
            for descriptor in POLICY_REGISTRY {
                if !known.is_empty() {
                    known.push_str(", ");
                }
                known.push_str(descriptor.name);
            }
            // `Some(...)` is the "present" variant carrying the error.
            return Some(ConfigError::new(
                format!("Unknown policy ID: {id}. Shipped policies: {known}.").as_str(),
            ));
        }
    }
    // `None` is the "absent" variant: every selected ID is shipped.
    return None;
}

/// What: Decide the action for the arguments after `git cli-git`.
///       `&[OsString]` borrows argument lists; `&ResolutionInputs` borrows process facts.
/// Why:  Help, refusals and retired commands answer without resolving Git or reading
///       any repository. A direct command validates its selection and the selected
///       repository's configuration, reports legacy files, then stops because policy
///       execution is not implemented.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function planManagement(args, gitGlobalArgs, environment, inputs): Action;
/// ```
pub fn plan_management(
    arguments: &[OsString],
    git_global_arguments: &[OsString],
    environment: &[(OsString, OsString)],
    inputs: &ResolutionInputs,
) -> Action {
    // What: `match` on the parse `Result`: keep the action or return the refusal.
    // Why:  Nothing else may run for an invocation the grammar rejects.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const parsed = parseManagementArgs(args); if (parsed === MANAGEMENT_REFUSED) return usage();
    // ```
    let parsed: ManagementAction = match parse_management_arguments(arguments) {
        Ok(action) => action,
        Err(reason) => return refusal(reason),
    };
    // `match` picks by variant and binds the fields each one carries.
    let (fix, policies): (bool, Vec<String>) = match parsed {
        ManagementAction::Help => {
            return Action::Exit {
                code: 0,
                stdout: String::from(MANAGEMENT_HELP),
                stderr: String::new(),
            };
        }
        ManagementAction::Retired { command, help } => {
            // Help goes to standard output; an attempted action is explained on standard error.
            if help {
                return Action::Exit {
                    code: 0,
                    stdout: retired_explanation(command),
                    stderr: String::new(),
                };
            }
            return Action::Exit {
                code: 0,
                stdout: String::new(),
                stderr: retired_explanation(command),
            };
        }
        // `..` ignores the scope fields the stopped command does not use yet.
        ManagementAction::Direct { fix, policies, .. } => (fix, policies),
    };
    // `if let Some(error) = ...` runs only when a selected ID is unknown.
    if let Some(error) = unknown_selected_policy(policies.as_slice()) {
        return direct_config_failure(&error);
    }
    let real_git: PathBuf = match resolve_real_git(inputs) {
        Ok(found) => found,
        Err(error) => return failure(error.to_string().as_str()),
    };
    let overlay: Vec<(OsString, OsString)> =
        child_environment_overlay(environment, real_git.as_path());
    match load_invocation_config(real_git.as_path(), git_global_arguments, overlay.as_slice()) {
        Ok(loaded) => {
            return Action::Exit {
                code: ENGINE_FAILURE_EXIT_CODE,
                stdout: legacy_warning_events(&loaded),
                stderr: policy_execution_unavailable(
                    format!("cli-git {}", direct_name(fix)).as_str(),
                ),
            };
        }
        Err(InvocationConfigError::Configuration(error)) => return direct_config_failure(&error),
        Err(InvocationConfigError::Repository(message)) => return failure(message.as_str()),
    }
}

/// Decision controls stay out of the release executable.
#[cfg(test)]
#[path = "management_tests.rs"]
mod tests;
