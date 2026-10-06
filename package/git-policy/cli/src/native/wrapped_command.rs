//! What: Decide what one wrapped Git command does once real Git is known: forward it,
//!       possibly rewritten, or stop with policy events or a refusal.
//! Why: This is the whole lifecycle of a forwarded command in one place and in the
//!      installed wrapper's order: unported work is refused, configuration is loaded only
//!      for commands that need it, the policy pass runs, and a real push is stopped until
//!      its own lifecycle exists. A read-only command never reads configuration and asks
//!      Git at most where it runs.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // const outcome = await runWrappedCommand(stripped, environment, checks);
//! ```

/// What: `use` brings names from sibling files into this file; `super::` means "the parent
///       module", where every sibling file of this crate is declared.
/// Why:  The lifecycle joins control stripping, the frontier, configuration and the pass.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { runPolicyPass } from './policy_pass.ts';
/// ```
use super::action::ENGINE_FAILURE_EXIT_CODE;
/// `git add` asks for what it would stage.
use super::candidate_prediction::CandidateRequest;
use super::command_options::OptionError;
use super::command_push::{PushRegion, parse_push_region};
use super::config_loading::{ConfigLoading, classify_config_loading};
use super::config_schema::PolicyConfig;
use super::global_arguments::GlobalOutcome;
use super::invocation_config::{config_invalid_event, load_identity_config};
use super::pending_state::pending_state;
use super::policy_checks::ShippedChecks;
/// What the command offers its content policies.
use super::policy_content::LifecycleContent;
use super::policy_engine::{
    StageEnd, StageRequest, StageResult, any_policy_applies, pass_exit_code, run_policy_stage,
};
use super::policy_events::{PolicyEvent, render_policy_events};
use super::policy_pass::{PassResult, policies_of_kind, run_policy_pass};
use super::policy_registry::PolicyId;
use super::policy_trigger::Trigger;
use super::refusal_frontier::{command_frontier, inherited_lease};
use super::repository_facts::RepositoryFacts;
use super::repository_location::RepositoryLocation;
use super::unported::{Unported, unported_from_unavailable, unported_notice};
use super::worktree_identity::worktree_root;
use super::wrapper_invocation::{StrippedInvocation, command_region, command_word};
/// What: `OsString` is owned operating-system text of raw bytes. Sibling the reader might
///       expect: `String`, which must be valid UTF-8.
/// Why:  Arguments and environment values are never decoded.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // string, but byte-preserving.
/// ```
use std::ffi::OsString;

/// What: How the lifecycle of one wrapped command ended. An `enum` is a closed set of named
///       alternatives; each carries the values its ending needs. `#[derive(...)]` asks the
///       compiler to generate copying, debug printing and `==`.
/// Why:  The caller either becomes Git with these arguments or exits with this code;
///       both may first print event lines on standard error.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type WrappedOutcome = { kind: 'forward'; args: string[]; stderr: string } | { kind: 'exit'; code: number; stderr: string };
/// ```
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum WrappedOutcome {
    /// Run real Git with these arguments.
    Forward {
        /// The arguments for Git: no wrapper control, fixed transforms applied.
        arguments: Vec<OsString>,
        /// Complete event lines for standard error, written before Git starts.
        stderr: String,
    },
    /// Stop without running Git.
    Exit {
        /// Process exit code: 1 for a policy rejection, 2 for a failure or a refusal.
        code: i32,
        /// Complete text for standard error.
        stderr: String,
    },
}

/// What: The ending for a command that needs unported work: events so far, then the notice.
///       `String` is the owned event text; `&Unported` borrows the reason; `&str` borrows
///       the command word.
/// Why:  Every refusal exits 2, whether it was found before or inside the policy pass.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function refused(events: string, what: Unported, command: string): WrappedOutcome;
/// ```
fn refused(events: String, what: &Unported, command: &str) -> WrappedOutcome {
    // `mut` allows appending the notice after the events.
    let mut stderr: String = events;
    // `.as_str()` lends the owned notice as borrowed text.
    stderr.push_str(unported_notice(what, command).as_str());
    return WrappedOutcome::Exit {
        code: ENGINE_FAILURE_EXIT_CODE,
        stderr,
    };
}

/// What: The ending of a stage that did not let the command proceed, or nothing when it
///       did. `&[PolicyEvent]` borrows every event so far; `Option<WrappedOutcome>` is "an
///       ending or nothing".
/// Why:  The pre-forward pass and the push gate end the same way: an unavailable stage is
///       a refusal, a failed one exits 2, and an error finding exits 1, each after the
///       events gathered so far.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function stageEnding(events: PolicyEvent[], end: StageEnd, command: string): WrappedOutcome | undefined;
/// ```
fn stage_ending(events: &[PolicyEvent], end: StageEnd, command: &str) -> Option<WrappedOutcome> {
    let rendered: String = render_policy_events(0, events);
    // `if let StageEnd::Unavailable(x) = end` runs only for that ending and binds what it carries.
    if let StageEnd::Unavailable(unavailable) = end {
        // `Some(x)` is the "present" case of `Option`.
        return Some(refused(
            rendered,
            &unported_from_unavailable(unavailable),
            command,
        ));
    }
    let code: i32 = pass_exit_code(events, end);
    if code == 0 {
        // `None` is the "absent" case: the command may proceed.
        return None;
    }
    return Some(WrappedOutcome::Exit {
        code,
        stderr: rendered,
    });
}

/// What: Whether Git's own option table reads the tokens after `push` as a dry run.
///       `&[OsString]` borrows those tokens, already free of wrapper controls.
/// Why:  Only a dry run publishes nothing. A region the table refuses is not known to be
///       a dry run, so it is treated as a real push.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function pushIsDryRun(region: string[]): boolean { try { return parsePushRegion(region).isDryRun; } catch { return false; } }
/// ```
fn push_is_dry_run(region: &[OsString]) -> bool {
    // `&[]` is an empty list of wrapper flags: they were removed before this point.
    let parsed: Result<PushRegion, OptionError> = parse_push_region(region, &[]);
    // `match` unpacks the `Result`: `Ok` carries the facts, `Err(_)` ignores the refusal.
    match parsed {
        Ok(found) => return found.dry_run,
        Err(_) => return false,
    }
}

/// What: Every shipped policy in registry order: the built-in ones, then the optional ones.
/// Why:  The push gate asks all of them at once, as the installed wrapper does.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const everyPolicy = [...builtInPolicies, ...optionalPolicies];
/// ```
fn every_policy() -> Vec<PolicyId> {
    // `mut` allows appending the second kind.
    let mut policies: Vec<PolicyId> = policies_of_kind(false);
    policies.extend(policies_of_kind(true));
    return policies;
}

/// What: Prepare a command that loads configuration: refuse unported work, read the
///       configuration of the worktree Git reports, and say what a content policy may
///       read. Returns the effective policy settings, or the ending that stops the command.
///       `Result<PolicyConfig, WrappedOutcome>` is "settings, or an ending".
/// Why:  The order is the installed wrapper's: leases and leftover state come before
///       configuration, and a commit is refused only after its configuration was accepted,
///       so an invalid file is always reported as such.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function prepareGuardedCommand(stripped, environment, checks, command): Promise<PolicyConfig>; // throws the ending
/// ```
fn prepare_guarded_command<F: RepositoryFacts>(
    stripped: &StrippedInvocation,
    environment: &[(OsString, OsString)],
    checks: &mut ShippedChecks<F>,
    command: &str,
) -> Result<PolicyConfig, WrappedOutcome> {
    // `if let Some(variable) = ...` runs only when a lease variable is present.
    if let Some(variable) = inherited_lease(environment) {
        // `Err(x)` is the failure case of `Result`; `String::new()` is empty owned text.
        return Err(refused(
            String::new(),
            &Unported::InheritedLease(variable),
            command,
        ));
    }
    // `match` unpacks the location answer; a failure to ask Git stops the command.
    let location: RepositoryLocation = match checks.facts.location() {
        Ok(found) => found,
        Err(message) => {
            return Err(WrappedOutcome::Exit {
                code: ENGINE_FAILURE_EXIT_CODE,
                // `format!` builds the owned, line-terminated text.
                stderr: format!("cli-git: {message}\n"),
            });
        }
    };
    if let Some(what) = pending_state(&location.identity, stripped.controls.skip_worktree_copy) {
        return Err(refused(String::new(), &what, command));
    }
    let policies: PolicyConfig = match load_identity_config(&location.identity) {
        Ok(loaded) => loaded.config.policies,
        Err(error) => {
            return Err(WrappedOutcome::Exit {
                code: ENGINE_FAILURE_EXIT_CODE,
                stderr: config_invalid_event(&error),
            });
        }
    };
    if let Some(what) = command_frontier(stripped, &location.identity) {
        return Err(refused(String::new(), &what, command));
    }
    // Only `git add` inside a worktree has content for a policy to read before Git runs:
    // what it would stage, predicted when a content policy first reads it.
    if command_word(stripped) == b"add" && worktree_root(&location.identity).is_some() {
        checks.candidates = LifecycleContent::Requested(CandidateRequest::Add(
            // `.to_vec()` copies the arguments after `add` for the prediction.
            command_region(stripped).to_vec(),
        ));
    }
    // `Ok(x)` is the success case.
    return Ok(policies);
}

/// What: Run the lifecycle of one wrapped command. `&StrippedInvocation` borrows the
///       invocation without its wrapper controls; `&mut ShippedChecks<F>` lends the shipped
///       policies and their facts provider `F` for writing.
/// Why:  A command Git does not run as a subcommand is forwarded as it is. A read-only
///       command skips configuration and every refusal check, and uses the default
///       settings. Every other command is prepared first. Then one pre-forward pass runs,
///       and a real push must also clear the manual-push gate.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function runWrappedCommand(stripped, environment, checks): Promise<WrappedOutcome>;
/// ```
pub fn run_wrapped_command<F: RepositoryFacts>(
    stripped: &StrippedInvocation,
    environment: &[(OsString, OsString)],
    checks: &mut ShippedChecks<F>,
) -> WrappedOutcome {
    if stripped.layout.outcome != GlobalOutcome::Command {
        return WrappedOutcome::Forward {
            // `.clone()` copies the arguments for the caller.
            arguments: stripped.arguments.clone(),
            stderr: String::new(),
        };
    }
    // `String::from_utf8_lossy` renders the command word for messages, replacing bytes that
    // are not UTF-8; `.into_owned()` makes it owned text.
    let command: String = String::from_utf8_lossy(command_word(stripped)).into_owned();
    // `.as_slice()` lends an owned list as a borrowed view.
    let policies: PolicyConfig =
        if classify_config_loading(stripped.arguments.as_slice()) == ConfigLoading::Skip {
            PolicyConfig::defaults()
        } else {
            match prepare_guarded_command(stripped, environment, checks, command.as_str()) {
                Ok(loaded) => loaded,
                Err(ending) => return ending,
            }
        };
    let request: StageRequest = StageRequest {
        trigger: Trigger::PreForward,
        config: policies,
        controls: stripped.controls.clone(),
        // `Vec::<PolicyId>::new()` is an empty owned list: a wrapped command selects every policy.
        selected: Vec::<PolicyId>::new(),
    };
    let pass: PassResult = run_policy_pass(&request, checks);
    if let Some(ending) = stage_ending(pass.events.as_slice(), pass.end, command.as_str()) {
        return ending;
    }
    // `mut` allows the push gate to append its events.
    let mut events: Vec<PolicyEvent> = pass.events;
    if command_word(stripped) == b"push" && !push_is_dry_run(command_region(stripped)) {
        let gate_request: StageRequest = StageRequest {
            trigger: Trigger::ManualPush,
            config: request.config,
            controls: request.controls,
            selected: request.selected,
        };
        let gated: Vec<PolicyId> = every_policy();
        if any_policy_applies(&gate_request, gated.as_slice()) {
            let gate: StageResult = run_policy_stage(&gate_request, gated.as_slice(), checks);
            // `.extend(list)` moves every item of `list` onto the end.
            events.extend(gate.events);
            if let Some(ending) = stage_ending(events.as_slice(), gate.end, command.as_str()) {
                return ending;
            }
        }
    }
    return WrappedOutcome::Forward {
        arguments: pass.arguments,
        stderr: render_policy_events(0, events.as_slice()),
    };
}

/// Lifecycle order, fact use and every ending stay out of the release executable.
#[cfg(test)]
#[path = "wrapped_command_tests.rs"]
mod tests;
