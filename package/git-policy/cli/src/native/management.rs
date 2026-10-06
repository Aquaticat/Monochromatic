//! What: Decide what one `git cli-git ...` invocation does.
//! Why: Help, refusals and retired commands need no repository; `check` and `fix`
//!      validate their policy selection and configuration, then run one policy pass over
//!      the selected repository and report its events on standard output.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // const action = planManagement(managementArgs, gitGlobalArgs, controls, environment, inputs);
//! ```

/// Import the sibling modules the decision combines.
use super::action::{Action, ENGINE_FAILURE_EXIT_CODE, failure};
/// A direct command asks for the worktree files its scope selects.
use super::candidate_prediction::CandidateRequest;
use super::child_environment::{child_environment_overlay, environment_value};
use super::config_error::ConfigError;
use super::config_file::LoadedConfig;
/// A scope that cannot be projected is a `transaction-failed` engine failure.
use super::diagnostics::EngineFailureCode;
use super::invocation_config::{config_invalid_event, legacy_warning_events, load_identity_config};
use super::management_arguments::{
    MANAGEMENT_HELP, MANAGEMENT_USAGE, ManagementAction, ManagementRefusal, RetiredCommand,
    parse_management_arguments,
};
use super::pending_state::pending_state;
/// The shipped checks and their constructor.
use super::policy_checks::{ShippedChecks, shipped_checks};
/// What the direct command offers its content policies.
use super::policy_content::LifecycleContent;
use super::policy_engine::{StageEnd, StageRequest, pass_exit_code};
/// The events of a direct command and their rendering.
use super::policy_events::{PolicyEvent, render_policy_events};
use super::policy_pass::{PassResult, run_policy_pass};
use super::policy_registry::{POLICY_REGISTRY, PolicyId, policy_by_name};
use super::policy_trigger::Trigger;
use super::real_git::{ResolutionInputs, resolve_real_git};
use super::repository_facts::{GitFacts, RepositoryFacts, git_facts};
use super::repository_location::RepositoryLocation;
/// The variable that names the forbidden-strings rules file.
use super::scanner_selection::RULES_VARIABLE;
use super::unported::{unported_from_unavailable, unported_notice};
use super::wrapper_controls::Controls;
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

/// What: The words of a direct command as the caller typed them after `git`.
///       `String` is owned UTF-8 text.
/// Why:  A refusal names the command that was not run.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function directCommand(fix: boolean): string { return `cli-git ${directName(fix)}`; }
/// ```
fn direct_command(fix: bool) -> String {
    // `format!` builds owned text; `{}` interpolates the command word.
    return format!("cli-git {}", direct_name(fix));
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

/// What: The pathspecs of a direct command's scope. `all` is `--all`; `Vec<OsString>`
///       is the owned list of pathspecs written after `--`.
/// Why:  `--all` selects the whole worktree from its top level, which Git spells `:/`,
///       as the installed wrapper does.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const directPathspecs = all ? [':/'] : pathspecs;
/// ```
fn scope_pathspecs(all: bool, pathspecs: Vec<OsString>) -> Vec<OsString> {
    if all {
        // `vec![...]` builds the one-item list.
        return vec![OsString::from(":/")];
    }
    return pathspecs;
}

/// What: Turn the selected policy names into policy identities.
///       `Result<Vec<PolicyId>, ConfigError>` is the identities, or the error naming the
///       first name no shipped policy has.
/// Why:  `--policy` selects among shipped policies only; a mistyped ID must stop the
///       command instead of selecting nothing.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function selectedPolicies(names: string[]): PolicyId[]; // throws ConfigError on an unknown name
/// ```
fn selected_policies(names: &[String]) -> Result<Vec<PolicyId>, ConfigError> {
    // `Vec::<PolicyId>::new()` is an empty owned list; `mut` allows pushing.
    let mut selected: Vec<PolicyId> = Vec::<PolicyId>::new();
    // `for name in names` borrows each selected ID in order.
    for name in names {
        // `match` unpacks "a registry row or nothing".
        match policy_by_name(name.as_str()) {
            Some(descriptor) => selected.push(descriptor.id),
            None => {
                let mut known: String = String::new();
                for descriptor in POLICY_REGISTRY {
                    if !known.is_empty() {
                        known.push_str(", ");
                    }
                    known.push_str(descriptor.name);
                }
                // `Err(...)` is the failure variant carrying the error.
                return Err(ConfigError::new(
                    format!("Unknown policy ID: {name}. Shipped policies: {known}.").as_str(),
                ));
            }
        }
    }
    // `Ok(...)` is the success variant: every selected ID is shipped.
    return Ok(selected);
}

/// What: Run the policy pass of one direct command and build its action.
///       `&LoadedConfig` borrows the accepted configuration; `&mut ShippedChecks<GitFacts>`
///       lends the shipped policies over real Git for writing.
/// Why:  Direct commands report every event on standard output. `check` first reports a
///       legacy file left beside the JSONC file, and policy events continue its numbering.
///       A policy that cannot be evaluated here stops the command with exit status 2 and
///       a notice on standard error, after the events gathered so far.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function runDirectCommand({ fix, selected, controls, loaded, checks }): Promise<Action>;
/// ```
fn run_direct_command(
    fix: bool,
    selected: Vec<PolicyId>,
    controls: &Controls,
    loaded: &LoadedConfig,
    checks: &mut ShippedChecks<GitFacts>,
) -> Action {
    // Only `check` reports a legacy file left beside the JSONC file; `fix` stays silent.
    let mut stdout: String = if fix {
        String::new()
    } else {
        legacy_warning_events(loaded)
    };
    // Each event is one line, so the lines written so far are the next event number.
    // `.matches('\n').count()` counts them; `as u64` widens the count to the number type.
    let first_sequence: u64 = stdout.matches('\n').count() as u64;
    // `.clone()` copies the scanner options the configuration chose.
    checks.scanner_settings.options = loaded.config.policies.forbidden_strings.clone();
    let trigger: Trigger = if fix {
        Trigger::DirectFix
    } else {
        Trigger::DirectCheck
    };
    // The selected files are staged on a private index before any policy runs, as the
    // installed wrapper does, so a scope Git refuses is reported whatever is selected.
    if let Err(error) = checks
        .content
        .prepare(&checks.candidates, &mut checks.facts)
    {
        stdout.push_str(
            render_policy_events(
                first_sequence,
                &[PolicyEvent::EngineFailure {
                    code: EngineFailureCode::TransactionFailed,
                    message: error.message,
                    // `Some(x)` is the "present" case of `Option`.
                    trigger: Some(trigger),
                    // `None` is the "absent" case: no policy has run.
                    policy: None,
                    path: None,
                }],
            )
            .as_str(),
        );
        return Action::Exit {
            code: ENGINE_FAILURE_EXIT_CODE,
            stdout,
            stderr: String::new(),
        };
    }
    let request: StageRequest = StageRequest {
        trigger,
        // `.clone()` copies the settings and controls into the request.
        config: loaded.config.policies.clone(),
        controls: controls.clone(),
        selected,
    };
    let pass: PassResult = run_policy_pass(&request, checks);
    // `.as_slice()` lends the owned events as a borrowed view.
    stdout.push_str(render_policy_events(first_sequence, pass.events.as_slice()).as_str());
    // `if let StageEnd::Unavailable(x) = ...` runs only for that ending and binds what it carries.
    let stderr: String = if let StageEnd::Unavailable(unavailable) = pass.end {
        unported_notice(
            &unported_from_unavailable(unavailable),
            direct_command(fix).as_str(),
        )
    } else {
        String::new()
    };
    return Action::Exit {
        code: pass_exit_code(pass.events.as_slice(), pass.end),
        stdout,
        stderr,
    };
}

/// What: Decide the action for the arguments after `git cli-git`.
///       `&[OsString]` borrows argument lists; `&Controls` borrows what the wrapper
///       controls written before `cli-git` asked for; `&ResolutionInputs` borrows process facts.
/// Why:  Help, refusals and retired commands answer without resolving Git or reading
///       any repository. A direct command validates its selection, asks Git once where it
///       runs, refuses beside commit transactions it cannot recover, loads that
///       worktree's configuration and runs one policy pass.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function planManagement(args, gitGlobalArgs, controls, environment, inputs): Action;
/// ```
pub fn plan_management(
    arguments: &[OsString],
    git_global_arguments: &[OsString],
    controls: &Controls,
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
    let (fix, policies, scope): (bool, Vec<String>, Vec<OsString>) = match parsed {
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
        ManagementAction::Direct {
            fix,
            all,
            policies,
            pathspecs,
        } => (fix, policies, scope_pathspecs(all, pathspecs)),
    };
    let selected: Vec<PolicyId> = match selected_policies(policies.as_slice()) {
        Ok(ids) => ids,
        // `&error` lends the error to the renderer.
        Err(error) => return direct_config_failure(&error),
    };
    let real_git: PathBuf = match resolve_real_git(inputs) {
        Ok(found) => found,
        Err(error) => return failure(error.to_string().as_str()),
    };
    let overlay: Vec<(OsString, OsString)> =
        child_environment_overlay(environment, real_git.as_path());
    // `mut` lets the pass cache facts it asks Git for.
    let mut checks: ShippedChecks<GitFacts> = shipped_checks(
        git_facts(real_git.as_path(), git_global_arguments, overlay.as_slice()),
        // `.to_vec()` copies the borrowed global options for the rule cores.
        git_global_arguments.to_vec(),
        LifecycleContent::Requested(CandidateRequest::Direct(scope)),
        // `Vec::new()` is an empty owned list: no direct-command policy reads the tool caches.
        Vec::<PathBuf>::new(),
    );
    // The forbidden-strings rules variable is read from this invocation's environment.
    checks.scanner_settings.rules_variable = environment_value(environment, RULES_VARIABLE);
    let location: RepositoryLocation = match checks.facts.location() {
        Ok(found) => found,
        Err(message) => return failure(message.as_str()),
    };
    // `true`: a direct command forwards nothing, so only commit transactions matter here.
    if let Some(what) = pending_state(&location.identity, true) {
        return Action::Exit {
            code: ENGINE_FAILURE_EXIT_CODE,
            stdout: String::new(),
            stderr: unported_notice(&what, direct_command(fix).as_str()),
        };
    }
    match load_identity_config(&location.identity) {
        Ok(loaded) => return run_direct_command(fix, selected, controls, &loaded, &mut checks),
        Err(error) => return direct_config_failure(&error),
    }
}

/// Decision controls stay out of the release executable.
#[cfg(test)]
#[path = "management_tests.rs"]
mod tests;
