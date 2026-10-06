//! What: The lifecycle of a wrapped command from scripted facts: what is forwarded, what
//!       stops, in which order, and which repository facts were asked for.
//! Why: The order of refusals, configuration and policies decides which message a person
//!      sees, and a fact asked for needlessly is a Git process on every command.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // expect(await runWrappedCommand(strip(['status']), [], checks)).toEqual({ kind: 'forward', args: ['-c', 'advice.statusHints=false', 'status'], stderr: '' });
//! ```
#![cfg(unix)]

/// The lifecycle under test, its inputs and the scripted facts.
use super::{WrappedOutcome, run_wrapped_command};
use crate::command_test_support::os_arguments;
use crate::config_file::CONFIG_FILE_NAME;
use crate::diagnostics::EngineFailureCode;
/// The event form of a pathname.
use crate::event_path::EventPath;
use crate::policy_checks::{DEPENDENT_VERSION_BUMP_NEEDS, ShippedChecks, shipped_checks};
use crate::policy_content::LifecycleContent;
use crate::policy_events::{FindingEvent, PolicyEvent, render_policy_events};
use crate::policy_registry::{PolicyId, Severity};
use crate::policy_test_support::{
    ScriptedFacts, linked_worktree, main_worktree, outside_worktree, scripted_facts,
};
use crate::policy_trigger::Trigger;
use crate::repository_location::RepositoryLocation;
use crate::rule_add_explicit::decide_add_explicit;
use crate::test_support::{fixture, remove, repository};
use crate::unported::{Unported, unported_notice};
use crate::worktree_identity::WorktreeIdentity;
use crate::wrapper_invocation::{StrippedInvocation, strip_wrapper_controls};
use std::ffi::OsString;
use std::path::PathBuf;

/// Run the lifecycle of one command, written as text, and return its ending with the facts asked for.
fn run(
    values: &[&str],
    facts: ScriptedFacts,
    variables: &[(&str, &str)],
) -> (WrappedOutcome, Vec<String>) {
    let stripped: StrippedInvocation = strip_wrapper_controls(os_arguments(values).as_slice());
    let mut environment: Vec<(OsString, OsString)> = Vec::<(OsString, OsString)>::new();
    for (name, value) in variables {
        environment.push((OsString::from(name), OsString::from(value)));
    }
    let mut checks: ShippedChecks<ScriptedFacts> = shipped_checks(
        facts,
        stripped.arguments.clone(),
        LifecycleContent::None,
        Vec::<PathBuf>::new(),
    );
    let outcome: WrappedOutcome =
        run_wrapped_command(&stripped, environment.as_slice(), &mut checks);
    return (outcome, checks.facts.asked);
}

/// The ending "run Git with these arguments and print nothing first".
fn forwards(values: &[&str]) -> WrappedOutcome {
    return WrappedOutcome::Forward {
        arguments: os_arguments(values),
        stderr: String::new(),
    };
}

/// The ending "exit 2 with the notice for this unported work".
fn refuses(what: &Unported, command: &str) -> WrappedOutcome {
    return WrappedOutcome::Exit {
        code: 2,
        stderr: unported_notice(what, command),
    };
}

/// Facts whose location is the given one.
fn located(location: RepositoryLocation) -> ScriptedFacts {
    let mut facts: ScriptedFacts = scripted_facts();
    facts.location = Ok(location);
    return facts;
}

/// Facts that fail every question.
fn unanswerable() -> ScriptedFacts {
    let mut facts: ScriptedFacts = scripted_facts();
    facts.location = Err(String::from("no location answer"));
    facts.index = Err(String::from("no index answer"));
    facts.sequencer = Err(String::from("no sequencer answer"));
    facts.remote_guess = Err(String::from("no branch answer"));
    return facts;
}

/// The location is asked for once and nothing else.
fn location_only() -> Vec<String> {
    return vec![String::from("location")];
}

/// The require-root finding at `severity` for a command run in `sub/` below `root`.
fn not_at_root(root: &str, severity: Severity) -> PolicyEvent {
    return PolicyEvent::Finding(FindingEvent {
        trigger: Trigger::PreForward,
        policy: PolicyId::RequireRoot,
        severity,
        code: "not-at-root",
        message: format!(
            "cli-git: not at the root of the git repository. Repo root is {root} but effective cwd is {root}/sub. Tip: cd to {root} or pass -C {root} before the subcommand."
        ),
        path: None,
        location: None,
        fix_available: false,
    });
}

/// The manual-push refusal.
fn manual_push_refused() -> WrappedOutcome {
    return refuses(&Unported::Lifecycle(Trigger::ManualPush), "push");
}

/// The refusal of an unported content policy asked about what `git add` would stage.
fn content_refused(policy: PolicyId, needs: &'static str) -> WrappedOutcome {
    return refuses(&Unported::PolicyNeeds { policy, needs }, "add");
}

/// The failure of `final-newline` reading candidates the scripted facts cannot prepare.
fn unprepared_final_newline() -> PolicyEvent {
    return PolicyEvent::EngineFailure {
        code: EngineFailureCode::ContentUnavailable,
        message: String::from("the scripted facts prepare no candidates"),
        trigger: Some(Trigger::PreForward),
        policy: Some(PolicyId::FinalNewline),
        path: None,
    };
}

/// The location question, then the candidates of `git add`.
fn location_and_candidates() -> Vec<String> {
    return vec![String::from("location"), String::from("candidates")];
}

/// A fixture directory used as a worktree top level, with this configuration text.
fn configured(name: &str, configuration: &str) -> PathBuf {
    let root: PathBuf = fixture(name);
    std::fs::write(root.join(CONFIG_FILE_NAME), configuration).expect("configuration");
    return root;
}

/// Facts for the top level of the main worktree at a fixture directory.
fn at_root(root: &std::path::Path) -> ScriptedFacts {
    return located(main_worktree(
        root.to_str().expect("fixture path is UTF-8"),
        "",
    ));
}

/// Without a subcommand the cleaned arguments are forwarded and nothing is asked.
#[test]
fn invocations_without_a_subcommand_are_forwarded_untouched() {
    for (values, forwarded) in [
        (vec![], vec![]),
        (vec!["--version"], vec!["--version"]),
        (vec!["-C"], vec!["-C"]),
        (vec!["-C", "dir"], vec!["-C", "dir"]),
        (
            vec!["--no-such-global", "commit", "-m", "x"],
            vec!["--no-such-global", "commit", "-m", "x"],
        ),
        (vec!["--cli-git-keep-going", "--version"], vec!["--version"]),
        (vec!["--no-enforce-require-root", "-h"], vec!["-h"]),
    ] {
        assert_eq!(
            run(
                values.as_slice(),
                unanswerable(),
                &[("CLI_GIT_LANDING_LEASE", "token")]
            ),
            (forwards(forwarded.as_slice()), Vec::<String>::new()),
            "{values:?}"
        );
    }
}

/// A read-only command reads no configuration, checks no leftover state and ignores leases.
#[test]
fn read_only_commands_skip_configuration_and_refusals() {
    // The configuration is invalid and a transaction is registered: neither is looked at.
    let root: PathBuf = configured("wrapped-read-only", "this is not JSONC");
    std::fs::create_dir_all(root.join(".git/cli-git-transactions/id")).expect("registry entry");
    let lease: [(&str, &str); 1] = [("CLI_GIT_PREPARATION_LEASE", "token")];
    for (values, forwarded) in [
        (
            vec!["status"],
            vec!["-c", "advice.statusHints=false", "status"],
        ),
        (vec!["log", "--oneline"], vec!["log", "--oneline"]),
        (vec!["branch", "--list"], vec!["branch", "--list"]),
        (
            vec!["--cli-git-keep-going", "rev-parse", "HEAD"],
            vec!["rev-parse", "HEAD"],
        ),
    ] {
        assert_eq!(
            run(values.as_slice(), at_root(root.as_path()), &lease),
            (forwards(forwarded.as_slice()), location_only()),
            "{values:?}"
        );
    }
    // Commands exempt from require-root ask Git nothing at all.
    for values in [vec!["version"], vec!["help", "status"]] {
        assert_eq!(
            run(values.as_slice(), unanswerable(), &lease),
            (forwards(values.as_slice()), Vec::<String>::new()),
            "{values:?}"
        );
    }
    // The settings are the defaults even where the repository's file would turn the policy off.
    std::fs::write(
        root.join(CONFIG_FILE_NAME),
        r#"{ "policies": { "require-root": "off" } }"#,
    )
    .expect("configuration");
    let root_text: &str = root.to_str().expect("fixture path is UTF-8");
    assert_eq!(
        run(&["status"], located(main_worktree(root_text, "sub/")), &[]),
        (
            WrappedOutcome::Exit {
                code: 1,
                stderr: render_policy_events(0, &[not_at_root(root_text, Severity::Error)]),
            },
            location_only()
        )
    );
    // A location that cannot be read stops the command; it is never treated as the top level.
    assert_eq!(
        run(&["status"], unanswerable(), &[]),
        (
            WrappedOutcome::Exit {
                code: 2,
                stderr: render_policy_events(
                    0,
                    &[PolicyEvent::EngineFailure {
                        code: EngineFailureCode::ContentUnavailable,
                        message: String::from("no location answer"),
                        trigger: Some(Trigger::PreForward),
                        policy: Some(PolicyId::RequireRoot),
                        path: None,
                    }]
                ),
            },
            location_only()
        )
    );
    remove(root.as_path());
}

/// Preparation order: lease, location, leftover state, configuration, then the command itself.
#[test]
fn a_guarded_command_is_prepared_in_order() {
    let root: PathBuf = configured("wrapped-order", "this is not JSONC");
    let registry: PathBuf = root.join(".git/cli-git-transactions");
    std::fs::create_dir_all(registry.join("id")).expect("registry entry");
    let lease: [(&str, &str); 1] = [("CLI_GIT_LANDING_LEASE", "")];
    // 1. A lease stops the command before Git is asked anything.
    assert_eq!(
        run(&["commit", "-m", "x"], unanswerable(), &lease),
        (
            refuses(&Unported::InheritedLease("CLI_GIT_LANDING_LEASE"), "commit"),
            Vec::<String>::new()
        )
    );
    // 2. Without the location nothing else can be decided.
    assert_eq!(
        run(&["commit", "-m", "x"], unanswerable(), &[]),
        (
            WrappedOutcome::Exit {
                code: 2,
                stderr: String::from("cli-git: no location answer\n"),
            },
            location_only()
        )
    );
    // 3. Leftover state is reported before the invalid configuration.
    assert_eq!(
        run(&["commit", "-m", "x"], at_root(root.as_path()), &[]),
        (
            refuses(&Unported::TransactionRecovery(registry.clone()), "commit"),
            location_only()
        )
    );
    std::fs::remove_dir_all(&registry).expect("remove registry");
    // 4. The invalid configuration is reported before the commit refusal.
    let (invalid, invalid_asked) = run(&["commit", "-m", "x"], at_root(root.as_path()), &[]);
    assert_eq!(invalid_asked, location_only());
    match invalid {
        WrappedOutcome::Exit { code, stderr } => {
            assert_eq!(code, 2);
            assert!(
                stderr.starts_with(
                    "{\"schemaVersion\":1,\"sequence\":0,\"type\":\"engine-failure\",\"code\":\"config-invalid\","
                ),
                "{stderr}"
            );
            assert_eq!(stderr.matches('\n').count(), 1, "{stderr}");
        }
        WrappedOutcome::Forward { .. } => panic!("an invalid configuration never forwards"),
    }
    // 5. With a valid configuration the commit itself is refused, before any policy runs.
    std::fs::write(root.join(CONFIG_FILE_NAME), "{}").expect("configuration");
    let root_text: &str = root.to_str().expect("fixture path is UTF-8");
    for location in [
        main_worktree(root_text, ""),
        main_worktree(root_text, "sub/"),
    ] {
        assert_eq!(
            run(&["commit", "-a", "-m", "x"], located(location), &[]),
            (
                refuses(&Unported::CommitTransaction, "commit"),
                location_only()
            )
        );
    }
    remove(root.as_path());
}

/// A dry-run commit goes through the pass: commit-only applies and may reject.
#[test]
fn a_dry_run_commit_is_checked_and_forwarded() {
    assert_eq!(
        run(
            &["commit", "--dry-run", "-m", "x", "file"],
            scripted_facts(),
            &[]
        ),
        (
            forwards(&["commit", "-o", "--dry-run", "-m", "x", "file"]),
            location_only()
        )
    );
    let (rejected, asked) = run(&["commit", "--dry-run", "-m", "x"], scripted_facts(), &[]);
    assert_eq!(
        asked,
        vec![String::from("location"), String::from("sequencer")]
    );
    match rejected {
        WrappedOutcome::Exit { code, stderr } => {
            assert_eq!(code, 1);
            assert!(
                stderr.starts_with(
                    "{\"schemaVersion\":1,\"sequence\":0,\"type\":\"core-finding\",\"trigger\":\"pre-forward\",\"coreId\":\"commit-only\",\"code\":\"commit-only/pathspec-required\","
                ),
                "{stderr}"
            );
        }
        WrappedOutcome::Forward { .. } => panic!("a pathless dry run is rejected"),
    }
    // The commit hatch is removed and skips the transform.
    assert_eq!(
        run(
            &["commit", "--no-enforce-only", "--dry-run", "-a"],
            scripted_facts(),
            &[]
        ),
        (forwards(&["commit", "--dry-run", "-a"]), location_only())
    );
}

/// `git add` is checked by add-explicit first, then its candidates are read by the first
/// content policy that is on; candidates that cannot be prepared stop it with exit 2.
#[test]
fn add_reads_its_candidates_after_add_explicit() {
    assert_eq!(
        run(&["add", "file"], scripted_facts(), &[]),
        (
            WrappedOutcome::Exit {
                code: 2,
                stderr: render_policy_events(0, &[unprepared_final_newline()]),
            },
            location_and_candidates()
        )
    );
    // A bulk add is rejected by add-explicit before any content policy reads.
    let bulk: String = decide_add_explicit(os_arguments(&["add", "."]).as_slice())
        .expect("a bulk add is rejected");
    let bulk_event: PolicyEvent = PolicyEvent::Finding(FindingEvent {
        trigger: Trigger::PreForward,
        policy: PolicyId::AddExplicit,
        severity: Severity::Error,
        code: "bulk-add-rejected",
        message: bulk,
        path: None,
        location: None,
        fix_available: false,
    });
    assert_eq!(
        run(&["add", "."], scripted_facts(), &[]),
        (
            WrappedOutcome::Exit {
                code: 1,
                stderr: render_policy_events(0, std::slice::from_ref(&bulk_event)),
            },
            location_only()
        )
    );
    // With keep-going the finding is reported and the content policy still reads.
    assert_eq!(
        run(&["--cli-git-keep-going", "add", "."], scripted_facts(), &[]),
        (
            WrappedOutcome::Exit {
                code: 2,
                stderr: render_policy_events(0, &[bulk_event, unprepared_final_newline()]),
            },
            location_and_candidates()
        )
    );
    // Escaping the only content policy that is on prepares nothing and lets the command through.
    assert_eq!(
        run(
            &["add", "--no-enforce-final-newline", "file"],
            scripted_facts(),
            &[]
        ),
        (forwards(&["add", "file"]), location_only())
    );
    // Outside a worktree there is nothing to stage, so Git answers for itself.
    assert_eq!(
        run(&["add", "file"], located(outside_worktree()), &[]),
        (forwards(&["add", "file"]), location_only())
    );
}

/// The repository's configuration decides which content policy answers for `git add`.
#[test]
fn configuration_selects_the_policies_of_a_guarded_command() {
    let root: PathBuf = configured(
        "wrapped-configured",
        r#"{ "policies": { "final-newline": "off" } }"#,
    );
    assert_eq!(
        run(&["add", "file"], at_root(root.as_path()), &[]),
        (forwards(&["add", "file"]), location_only())
    );
    assert_eq!(
        run(&["push", "origin"], at_root(root.as_path()), &[]),
        (forwards(&["push", "--atomic", "origin"]), location_only())
    );
    std::fs::write(
        root.join(CONFIG_FILE_NAME),
        r#"{ "policies": { "final-newline": "off", "mono/dependent-version-bump": "error" } }"#,
    )
    .expect("configuration");
    assert_eq!(
        run(&["add", "file"], at_root(root.as_path()), &[]),
        (
            content_refused(PolicyId::DependentVersionBump, DEPENDENT_VERSION_BUMP_NEEDS),
            location_only()
        )
    );
    // That policy has no manual-push trigger, so a push is not gated by it.
    assert_eq!(
        run(&["push", "origin"], at_root(root.as_path()), &[]),
        (forwards(&["push", "--atomic", "origin"]), location_only())
    );
    // A listed Markdown policy reads what the add stages, and gates a push.
    std::fs::write(
        root.join(CONFIG_FILE_NAME),
        r#"{ "policies": { "final-newline": "off", "markdown/autofix": "error" } }"#,
    )
    .expect("configuration");
    assert_eq!(
        run(&["add", "file"], at_root(root.as_path()), &[]),
        (
            WrappedOutcome::Exit {
                code: 2,
                stderr: render_policy_events(
                    0,
                    &[PolicyEvent::EngineFailure {
                        code: EngineFailureCode::ContentUnavailable,
                        message: String::from("the scripted facts prepare no candidates"),
                        trigger: Some(Trigger::PreForward),
                        policy: Some(PolicyId::MarkdownAutofix),
                        path: None,
                    }]
                ),
            },
            location_and_candidates()
        )
    );
    assert_eq!(
        run(&["push", "origin"], at_root(root.as_path()), &[]),
        (manual_push_refused(), location_only())
    );
    // A policy set to `warn` lets the command through and reports on standard error first.
    std::fs::write(
        root.join(CONFIG_FILE_NAME),
        r#"{ "policies": { "require-root": "warn", "final-newline": "off" } }"#,
    )
    .expect("configuration");
    let root_text: &str = root.to_str().expect("fixture path is UTF-8");
    assert_eq!(
        run(
            &["reset", "--soft", "HEAD"],
            located(main_worktree(root_text, "sub/")),
            &[]
        ),
        (
            WrappedOutcome::Forward {
                arguments: os_arguments(&["reset", "--soft", "HEAD"]),
                stderr: render_policy_events(
                    0,
                    &[
                        not_at_root(root_text, Severity::Warn),
                        PolicyEvent::WarnUnsafe {
                            trigger: Trigger::PreForward,
                            policy: PolicyId::RequireRoot,
                        },
                    ]
                ),
            },
            location_only()
        )
    );
    remove(root.as_path());
}

/// A real push is stopped at the manual-push gate; a dry run and an ungated push are forwarded.
#[test]
fn a_real_push_must_clear_the_manual_push_gate() {
    for values in [
        vec!["push"],
        vec!["push", "origin", "main"],
        vec!["push", "--dry-run", "--no-dry-run"],
        vec!["push", "--", "--dry-run"],
        // A region Git refuses is not known to be a dry run.
        vec!["push", "--dry-run", "--no-such-option"],
    ] {
        assert_eq!(
            run(values.as_slice(), scripted_facts(), &[]),
            (manual_push_refused(), location_only()),
            "{values:?}"
        );
    }
    assert_eq!(
        run(&["push", "--dry-run", "origin"], scripted_facts(), &[]),
        (
            forwards(&["push", "--atomic", "--dry-run", "origin"]),
            location_only()
        )
    );
    assert_eq!(
        run(&["push", "-n"], scripted_facts(), &[]),
        (forwards(&["push", "--atomic", "-n"]), location_only())
    );
    // Escaping the only manual-push policy that is on removes the gate.
    assert_eq!(
        run(
            &["push", "--no-enforce-final-newline", "origin"],
            scripted_facts(),
            &[]
        ),
        (forwards(&["push", "--atomic", "origin"]), location_only())
    );
    // An earlier rejection is reported instead of the gate.
    let (rejected, _asked) = run(&["push"], located(main_worktree("/r", "sub/")), &[]);
    assert_eq!(
        rejected,
        WrappedOutcome::Exit {
            code: 1,
            stderr: render_policy_events(0, &[not_at_root("/r", Severity::Error)]),
        }
    );
}

/// The worktree policies are wired to the measured location.
#[test]
fn worktree_policies_read_the_location() {
    let (rejected, asked) = run(&["reset", "--hard"], scripted_facts(), &[]);
    assert_eq!(asked, location_only());
    match rejected {
        WrappedOutcome::Exit { code, stderr } => {
            assert_eq!(code, 1);
            assert!(
                stderr.contains("\"policyId\":\"linked-worktree-only\""),
                "{stderr}"
            );
        }
        WrappedOutcome::Forward { .. } => panic!("a hard reset in the main worktree is rejected"),
    }
    assert_eq!(
        run(
            &["reset", "--hard"],
            located(linked_worktree("/r", "/w")),
            &[]
        ),
        (forwards(&["reset", "--hard"]), location_only())
    );
    assert_eq!(
        run(
            &["reset", "--no-enforce-worktree", "--hard"],
            scripted_facts(),
            &[]
        ),
        (forwards(&["reset", "--hard"]), location_only())
    );
    let mut guessed: ScriptedFacts = scripted_facts();
    guessed.remote_guess = Ok(true);
    let (created, created_asked) = run(&["switch", "topic"], guessed, &[]);
    assert_eq!(
        created_asked,
        vec![String::from("location"), String::from("remote-guess:topic")]
    );
    match created {
        WrappedOutcome::Exit { code, stderr } => {
            assert_eq!(code, 1);
            assert!(
                stderr.contains("\"policyId\":\"branch-worktree-only\""),
                "{stderr}"
            );
        }
        WrappedOutcome::Forward { .. } => panic!("a guessed branch creation is rejected"),
    }
}

/// From a linked worktree, creating a worktree and running a possible alias are refused.
#[test]
fn worktree_creation_and_aliases_are_refused_where_copies_are_synchronized() {
    let linked: RepositoryLocation = linked_worktree("/r", "/w");
    assert_eq!(
        run(
            &["worktree", "add", "../topic"],
            located(linked.clone()),
            &[]
        ),
        (
            refuses(&Unported::WorktreeCopy, "worktree"),
            location_only()
        )
    );
    assert_eq!(
        run(&["st"], located(linked.clone()), &[]),
        (refuses(&Unported::AliasResolution, "st"), location_only())
    );
    assert_eq!(
        run(
            &["worktree", "add", "--no-worktree-copy", "../topic"],
            located(linked.clone()),
            &[]
        ),
        (forwards(&["worktree", "add", "../topic"]), location_only())
    );
    assert_eq!(
        run(&["worktree", "list"], located(linked), &[]),
        (forwards(&["worktree", "list"]), location_only())
    );
    // In the main worktree neither needs the copy.
    for values in [vec!["worktree", "add", "../topic"], vec!["st"]] {
        assert_eq!(
            run(values.as_slice(), scripted_facts(), &[]),
            (forwards(values.as_slice()), location_only()),
            "{values:?}"
        );
    }
    // A bare repository synchronizes copies too.
    let bare: RepositoryLocation = RepositoryLocation {
        identity: WorktreeIdentity::BareRepository {
            common_dir: PathBuf::from("/b.git"),
            git_dir: PathBuf::from("/b.git"),
        },
        prefix: Vec::<u8>::new(),
    };
    assert_eq!(
        run(&["worktree", "add", "../topic"], located(bare), &[]),
        (
            refuses(&Unported::WorktreeCopy, "worktree"),
            location_only()
        )
    );
}

/// Findings of `git add` come from what it would stage: a warning lets it through, an
/// error stops it, and the real index is left for Git to change.
#[test]
fn add_findings_come_from_what_the_add_would_stage() {
    let root: PathBuf = fixture("wrapped-add-content");
    let repo: PathBuf = repository(root.as_path(), "repo");
    std::fs::write(
        repo.join(CONFIG_FILE_NAME),
        "{ \"policies\": { \"mono/forbidden-root-context\": \"error\" } }\n",
    )
    .expect("configuration");
    std::fs::write(repo.join("a.txt"), b"no final newline").expect("file");
    std::fs::write(repo.join("CONTEXT.md"), b"context\n").expect("context");
    std::fs::create_dir(repo.join("nested")).expect("nested");
    std::fs::write(repo.join("nested/CONTEXT.md"), b"nested\n").expect("nested context");
    let index_before: Vec<u8> = std::fs::read(repo.join(".git/index")).expect("index");
    let mut facts: ScriptedFacts = at_root(repo.as_path());
    facts.candidates_repository = Some(repo.clone());
    let warning: PolicyEvent = PolicyEvent::Finding(FindingEvent {
        trigger: Trigger::PreForward,
        policy: PolicyId::FinalNewline,
        severity: Severity::Warn,
        code: "noncanonical-final-newline",
        message: String::from("Non-empty text file must end with exactly one LF byte."),
        path: Some(EventPath::from_git_bytes("a.txt".as_bytes())),
        location: None,
        fix_available: false,
    });
    assert_eq!(
        run(&["add", "a.txt"], facts.clone(), &[]),
        (
            WrappedOutcome::Forward {
                arguments: os_arguments(&["add", "a.txt"]),
                stderr: render_policy_events(0, &[warning]),
            },
            location_and_candidates()
        )
    );
    let forbidden: PolicyEvent = PolicyEvent::Finding(FindingEvent {
        trigger: Trigger::PreForward,
        policy: PolicyId::ForbiddenRootContext,
        severity: Severity::Error,
        code: "root-context-forbidden",
        message: String::from("Root CONTEXT.md is forbidden; read source code directly."),
        path: Some(EventPath::from_git_bytes("CONTEXT.md".as_bytes())),
        location: None,
        fix_available: false,
    });
    assert_eq!(
        run(&["add", "--", "CONTEXT.md"], facts.clone(), &[]),
        (
            WrappedOutcome::Exit {
                code: 1,
                stderr: render_policy_events(0, &[forbidden]),
            },
            location_and_candidates()
        )
    );
    assert_eq!(
        run(&["add", "nested/CONTEXT.md"], facts, &[]),
        (
            forwards(&["add", "nested/CONTEXT.md"]),
            location_and_candidates()
        )
    );
    assert_eq!(
        std::fs::read(repo.join(".git/index")).expect("index"),
        index_before,
        "only Git, after the lifecycle, may change the index"
    );
    remove(root.as_path());
}
