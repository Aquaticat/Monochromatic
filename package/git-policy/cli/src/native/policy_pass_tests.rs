//! What: The three stages of a pass in order, where each one can end the pass, and which
//!       arguments the pass hands back.
//! Why: A transform applied before a built-in policy read the command, or an optional
//!      policy run after a stopped stage, changes what a command is checked against.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // expect((await runPolicyPass(request, checks)).args).toEqual(['push', '--atomic']);
//! ```

/// The pass under test, the engine types it returns and the scripted facts.
use super::{PassResult, pass_blocking_code, policies_of_kind, run_policy_pass};
use crate::command_test_support::os_arguments;
use crate::config_schema::PolicyConfig;
use crate::diagnostics::EngineFailureCode;
use crate::policy_checks::{CandidateSource, ShippedChecks};
use crate::policy_engine::{StageEnd, StageRequest, Unavailable};
use crate::policy_events::{FindingEvent, PolicyEvent};
use crate::policy_registry::{PolicyId, Severity};
use crate::policy_test_support::{ScriptedFacts, main_worktree, scripted_facts, with_severity};
use crate::policy_trigger::Trigger;
use crate::rule_commit_only_message::ALL_FLAG_MESSAGE;
use crate::wrapper_controls::{Controls, no_controls};
use std::path::PathBuf;

/// A request for `trigger` with default severities and the given controls.
fn request(trigger: Trigger, controls: Controls) -> StageRequest {
    return StageRequest {
        trigger,
        config: PolicyConfig::defaults(),
        controls,
        selected: Vec::<PolicyId>::new(),
    };
}

/// Controls that only ask to keep going.
fn keep_going() -> Controls {
    let mut controls: Controls = no_controls();
    controls.keep_going = true;
    return controls;
}

/// Run one pass over a command and return it with the facts it asked for.
fn pass(
    stage: &StageRequest,
    values: &[&str],
    facts: ScriptedFacts,
    candidates: CandidateSource,
) -> (PassResult, Vec<String>) {
    let mut checks: ShippedChecks<ScriptedFacts> = ShippedChecks {
        facts,
        arguments: os_arguments(values),
        candidates,
        allowed_worktree_dirs: Vec::<PathBuf>::new(),
    };
    let result: PassResult = run_policy_pass(stage, &mut checks);
    // The pass never changes the arguments the checks read.
    assert_eq!(checks.arguments, os_arguments(values));
    return (result, checks.facts.asked);
}

/// Facts for a command run in `sub/` of the main worktree at `/r`.
fn below_root() -> ScriptedFacts {
    let mut facts: ScriptedFacts = scripted_facts();
    facts.location = Ok(main_worktree("/r", "sub/"));
    return facts;
}

/// The require-root finding for a command run in `/r/sub`.
fn not_at_root() -> PolicyEvent {
    return PolicyEvent::Finding(FindingEvent {
        trigger: Trigger::PreForward,
        policy: PolicyId::RequireRoot,
        severity: Severity::Error,
        code: "not-at-root",
        message: String::from(
            "cli-git: not at the root of the git repository. Repo root is /r but effective cwd is /r/sub. Tip: cd to /r or pass -C /r before the subcommand.",
        ),
        path: None,
        location: None,
        fix_available: false,
    });
}

/// The commit-only rejection of `git commit -a`.
fn all_flag_rejected() -> PolicyEvent {
    return PolicyEvent::CoreFinding {
        core_id: "commit-only",
        code: "all-flag",
        message: String::from(ALL_FLAG_MESSAGE),
    };
}

/// The registry splits into the five built-in and the four optional policies, in order.
#[test]
fn the_registry_splits_into_two_stages() {
    assert_eq!(
        policies_of_kind(false),
        vec![
            PolicyId::RequireRoot,
            PolicyId::LinkedWorktreeOnly,
            PolicyId::BranchWorktreeOnly,
            PolicyId::AddExplicit,
            PolicyId::FinalNewline,
        ]
    );
    assert_eq!(
        policies_of_kind(true),
        vec![
            PolicyId::MarkdownAutofix,
            PolicyId::ForbiddenRootContext,
            PolicyId::DependentVersionBump,
            PolicyId::ForbiddenStrings,
        ]
    );
}

/// A clean forwarded command gets its transform and may proceed.
#[test]
fn a_clean_pass_hands_back_the_transformed_arguments() {
    let stage: StageRequest = request(Trigger::PreForward, no_controls());
    for (values, forwarded) in [
        (vec!["push", "origin"], vec!["push", "--atomic", "origin"]),
        (
            vec!["status"],
            vec!["-c", "advice.statusHints=false", "status"],
        ),
        (
            vec!["commit", "--dry-run", "-m", "x", "file"],
            vec!["commit", "-o", "--dry-run", "-m", "x", "file"],
        ),
        (vec!["add", "file"], vec!["add", "file"]),
    ] {
        let (result, asked) = pass(
            &stage,
            values.as_slice(),
            scripted_facts(),
            CandidateSource::None,
        );
        assert_eq!(
            result,
            PassResult {
                arguments: os_arguments(forwarded.as_slice()),
                events: Vec::<PolicyEvent>::new(),
                end: StageEnd::Completed,
            },
            "{values:?}"
        );
        assert_eq!(pass_blocking_code(&result), None, "{values:?}");
        assert_eq!(asked, vec![String::from("location")], "{values:?}");
    }
}

/// A built-in error ends the pass before any transform; the input arguments come back.
#[test]
fn a_built_in_error_ends_the_pass_before_the_transforms() {
    let stage: StageRequest = request(Trigger::PreForward, no_controls());
    let (result, asked) = pass(
        &stage,
        &["commit", "-a", "-m", "x"],
        below_root(),
        CandidateSource::None,
    );
    assert_eq!(
        result,
        PassResult {
            arguments: os_arguments(&["commit", "-a", "-m", "x"]),
            events: vec![not_at_root()],
            end: StageEnd::Stopped,
        }
    );
    assert_eq!(pass_blocking_code(&result), Some(1));
    assert_eq!(asked, vec![String::from("location")]);
}

/// With keep-going the transforms and optional policies still run, and the pass still blocks.
#[test]
fn keep_going_collects_every_stage_and_still_blocks() {
    let stage: StageRequest = request(Trigger::PreForward, keep_going());
    let (rejected, _asked) = pass(
        &stage,
        &["commit", "-a", "-m", "x"],
        below_root(),
        CandidateSource::None,
    );
    assert_eq!(
        rejected,
        PassResult {
            arguments: os_arguments(&["commit", "-a", "-m", "x"]),
            events: vec![not_at_root(), all_flag_rejected()],
            end: StageEnd::Completed,
        }
    );
    assert_eq!(pass_blocking_code(&rejected), Some(1));
    // The transform of a command the built-in stage rejected is still applied.
    let (pushed, _pushed_asked) = pass(&stage, &["push"], below_root(), CandidateSource::None);
    assert_eq!(
        pushed,
        PassResult {
            arguments: os_arguments(&["push", "--atomic"]),
            events: vec![not_at_root()],
            end: StageEnd::Completed,
        }
    );
    assert_eq!(pass_blocking_code(&pushed), Some(1));
}

/// A transform rejection ends the pass unless keep-going; a transform failure always does.
#[test]
fn a_transform_rejection_or_failure_ends_the_pass() {
    let stopped: StageRequest = request(Trigger::PreForward, no_controls());
    let (rejected, _asked) = pass(
        &stopped,
        &["commit", "-a", "-m", "x"],
        scripted_facts(),
        CandidateSource::None,
    );
    assert_eq!(
        rejected,
        PassResult {
            arguments: os_arguments(&["commit", "-a", "-m", "x"]),
            events: vec![all_flag_rejected()],
            end: StageEnd::Stopped,
        }
    );
    assert_eq!(pass_blocking_code(&rejected), Some(1));
    for controls in [no_controls(), keep_going()] {
        let mut facts: ScriptedFacts = scripted_facts();
        facts.sequencer = Err(String::from("no sequencer answer"));
        let stage: StageRequest = request(Trigger::PreForward, controls);
        let (failed, asked) = pass(&stage, &["commit", "-m", "x"], facts, CandidateSource::None);
        assert_eq!(
            failed,
            PassResult {
                arguments: os_arguments(&["commit", "-m", "x"]),
                events: vec![PolicyEvent::EngineFailure {
                    code: EngineFailureCode::CoreIncomplete,
                    message: String::from("no sequencer answer"),
                    trigger: None,
                    policy: None,
                    path: None,
                }],
                end: StageEnd::Failed,
            }
        );
        assert_eq!(pass_blocking_code(&failed), Some(2));
        assert_eq!(
            asked,
            vec![String::from("location"), String::from("sequencer")]
        );
    }
    // The commit hatch skips the rejection, so the pass completes.
    let mut escaped: Controls = no_controls();
    escaped.commit_only_escaped = true;
    let (forwarded, _forwarded_asked) = pass(
        &request(Trigger::PreForward, escaped),
        &["commit", "-a", "-m", "x"],
        scripted_facts(),
        CandidateSource::None,
    );
    assert_eq!(
        forwarded,
        PassResult {
            arguments: os_arguments(&["commit", "-a", "-m", "x"]),
            events: Vec::<PolicyEvent>::new(),
            end: StageEnd::Completed,
        }
    );
}

/// Unreadable candidates end the pass as unavailable at the first enabled content policy.
#[test]
fn unreadable_candidates_end_the_pass_as_unavailable() {
    let needs: &'static str = "predicting what git add would stage";
    let (built_in, _asked) = pass(
        &request(Trigger::PreForward, no_controls()),
        &["add", "file"],
        scripted_facts(),
        CandidateSource::NotPorted(needs),
    );
    assert_eq!(
        built_in,
        PassResult {
            arguments: os_arguments(&["add", "file"]),
            events: Vec::<PolicyEvent>::new(),
            end: StageEnd::Unavailable(Unavailable::Policy {
                policy: PolicyId::FinalNewline,
                needs,
            }),
        }
    );
    assert_eq!(pass_blocking_code(&built_in), Some(2));
    // With the built-in content policy escaped, the first listed optional policy answers.
    let config: PolicyConfig = with_severity(
        &PolicyConfig::defaults(),
        PolicyId::ForbiddenStrings,
        Severity::Error,
    );
    let mut controls: Controls = no_controls();
    controls.escaped.push(PolicyId::FinalNewline);
    let optional: StageRequest = StageRequest {
        trigger: Trigger::PreForward,
        config,
        controls: controls.clone(),
        selected: Vec::<PolicyId>::new(),
    };
    let (listed, _listed_asked) = pass(
        &optional,
        &["add", "file"],
        scripted_facts(),
        CandidateSource::NotPorted(needs),
    );
    assert_eq!(
        listed.end,
        StageEnd::Unavailable(Unavailable::Policy {
            policy: PolicyId::ForbiddenStrings,
            needs,
        })
    );
    // With no content policy left, the same command may proceed.
    let (unlisted, _unlisted_asked) = pass(
        &request(Trigger::PreForward, controls),
        &["add", "file"],
        scripted_facts(),
        CandidateSource::NotPorted(needs),
    );
    assert_eq!(unlisted.end, StageEnd::Completed);
    assert_eq!(pass_blocking_code(&unlisted), None);
}

/// A direct check runs both stages and no transform.
#[test]
fn a_direct_check_applies_no_transform() {
    let stage: StageRequest = request(Trigger::DirectCheck, no_controls());
    let (clean, asked) = pass(&stage, &["push"], scripted_facts(), CandidateSource::None);
    assert_eq!(
        clean,
        PassResult {
            arguments: os_arguments(&["push"]),
            events: Vec::<PolicyEvent>::new(),
            end: StageEnd::Completed,
        }
    );
    assert_eq!(asked, vec![String::from("location")]);
    // The commit-only transform would reject `-a` and ask for the sequencer; a check does neither.
    let (unchanged, unchanged_asked) = pass(
        &stage,
        &["commit", "-a"],
        scripted_facts(),
        CandidateSource::None,
    );
    assert_eq!(unchanged.events, Vec::<PolicyEvent>::new());
    assert_eq!(unchanged.arguments, os_arguments(&["commit", "-a"]));
    assert_eq!(unchanged_asked, vec![String::from("location")]);
}

/// A trigger whose lifecycle is not ported is unavailable, never an empty clean pass.
#[test]
fn an_unported_lifecycle_is_unavailable() {
    for trigger in [Trigger::PostCommit, Trigger::ManualPush] {
        let (result, asked) = pass(
            &request(trigger, no_controls()),
            &["push"],
            scripted_facts(),
            CandidateSource::None,
        );
        assert_eq!(
            result,
            PassResult {
                arguments: os_arguments(&["push"]),
                events: Vec::<PolicyEvent>::new(),
                end: StageEnd::Unavailable(Unavailable::Lifecycle(trigger)),
            },
            "{trigger:?}"
        );
        assert_eq!(pass_blocking_code(&result), Some(2), "{trigger:?}");
        assert_eq!(asked, Vec::<String>::new(), "{trigger:?}");
    }
}
