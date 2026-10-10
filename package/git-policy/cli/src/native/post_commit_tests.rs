//! Controls for the post-commit gate against real repositories.
//! The TypeScript corpus is `src/policy-engine/post-commit-lifecycle.unit.test.ts` and `post-commit-facts.unit.test.ts`.
//! The incumbent's test plugins have no native equivalent, so the same behaviors are driven with the built-in
//! final-newline and forbidden-strings policies at fixed severities.

use super::*;
use crate::auto_push_single_flight::PushGit;
use crate::policy_registry::{PolicyId, Severity};
use crate::repository_facts::RepositoryFacts;
use crate::test_support::{fixture, git, remove};
use crate::wrapper_controls::no_controls;
use std::path::PathBuf;

/// Final-newline content of the landed file: a complete line.
const LANDED_CONTENT: &str = "landed content\n";

/// Environment every query of these fixtures runs with.
fn fixture_environment() -> Vec<(OsString, OsString)> {
    return [
        ("PATH", "/usr/bin:/bin"),
        ("GIT_CONFIG_NOSYSTEM", "1"),
        ("GIT_CONFIG_GLOBAL", "/nonexistent-global-config"),
        ("GIT_AUTHOR_NAME", "Fixture"),
        ("GIT_AUTHOR_EMAIL", "fixture@example.invalid"),
        ("GIT_COMMITTER_NAME", "Fixture"),
        ("GIT_COMMITTER_EMAIL", "fixture@example.invalid"),
    ]
    .iter()
    .map(|(name, value)| {
        return (OsString::from(name), OsString::from(value));
    })
    .collect();
}

/// A repository with a baseline commit (`stable.txt`) and one landed commit that adds `landed.txt`.
fn landed_repository(name: &str, landed_bytes: &str) -> (PathBuf, String) {
    let root = fixture(name);
    git(&root, &["init", "--quiet", "--initial-branch=main"]);
    git(&root, &["config", "user.email", "cli-git@example.invalid"]);
    git(&root, &["config", "user.name", "cli-git fixture"]);
    std::fs::write(root.join("stable.txt"), "stable content\n").expect("stable file");
    git(&root, &["add", "stable.txt"]);
    git(&root, &["commit", "--quiet", "-m", "baseline"]);
    std::fs::write(root.join("landed.txt"), landed_bytes).expect("landed file");
    git(&root, &["add", "landed.txt"]);
    git(&root, &["commit", "--quiet", "-m", "landed"]);
    let landed = String::from_utf8_lossy(&git(&root, &["rev-parse", "HEAD"]).stdout)
        .trim()
        .to_owned();
    return (root, landed);
}

/// The default configuration with one policy's severity replaced.
fn with_severity(policy: PolicyId, severity: Severity) -> PolicyConfig {
    let mut config: PolicyConfig = PolicyConfig::defaults();
    for setting in &mut config.settings {
        if setting.id == policy {
            setting.severity = severity;
        }
    }
    return config;
}

/// Build a gate request over a fixture repository.
fn request<'request>(
    landed: &'request str,
    global_prefix: &'request [OsString],
    overlay: &'request [(OsString, OsString)],
    config: PolicyConfig,
    controls: Controls,
) -> PostCommitRequest<'request> {
    return PostCommitRequest {
        real_git: Path::new("/usr/bin/git"),
        landed_oid: landed,
        arguments: &[],
        global_prefix,
        overlay,
        config,
        controls,
    };
}

/// The `-C` prefix that makes every query read the fixture repository.
fn prefix_for(root: &Path) -> Vec<OsString> {
    return vec![OsString::from("-C"), root.as_os_str().to_os_string()];
}

/// A landed commit whose committed bytes are complete passes the gate and reaches the backup.
#[test]
fn a_clean_landed_commit_passes_the_gate() {
    let (root, landed) = landed_repository("pc-clean", LANDED_CONTENT);
    let prefix = prefix_for(&root);
    let overlay = fixture_environment();
    let outcome = run_post_commit_gate(&request(
        &landed,
        &prefix,
        &overlay,
        with_severity(PolicyId::FinalNewline, Severity::Error),
        no_controls(),
    ));
    assert!(!outcome.blocked, "{outcome:?}");
    assert!(outcome.events.is_empty(), "{outcome:?}");
    assert_eq!(outcome.oid, landed);
    remove(&root);
}

/// A landed file without a final newline blocks the backup and names the commit in a `commit-landed` event.
#[test]
fn a_blocked_landed_commit_ends_with_an_explicit_commit_landed_event() {
    let (root, landed) = landed_repository("pc-block", "no final newline");
    let prefix = prefix_for(&root);
    let overlay = fixture_environment();
    let outcome = run_post_commit_gate(&request(
        &landed,
        &prefix,
        &overlay,
        with_severity(PolicyId::FinalNewline, Severity::Error),
        no_controls(),
    ));
    assert!(outcome.blocked);
    assert!(
        matches!(outcome.events.first(), Some(PolicyEvent::Finding(_))),
        "{outcome:?}"
    );
    assert_eq!(
        outcome.events.last(),
        Some(&PolicyEvent::CommitLanded {
            oid: landed.clone()
        })
    );
    let rendered = render_policy_events(0, outcome.events.as_slice());
    assert!(
        rendered.contains(&format!(
            "\"message\":\"Commit {landed} remains local; post-commit gate blocked automatic backup.\""
        )),
        "{rendered}"
    );
    assert!(
        rendered.contains("\"outcome\":\"post-commit-blocked\""),
        "{rendered}"
    );
    remove(&root);
}

/// A warning-only result allows the backup, and its finding is still printed.
#[test]
fn a_warning_only_result_allows_the_backup() {
    let (root, landed) = landed_repository("pc-warning", "no final newline");
    let prefix = prefix_for(&root);
    let overlay = fixture_environment();
    let outcome = run_post_commit_gate(&request(
        &landed,
        &prefix,
        &overlay,
        with_severity(PolicyId::FinalNewline, Severity::Warn),
        no_controls(),
    ));
    assert!(!outcome.blocked, "{outcome:?}");
    assert!(
        matches!(outcome.events.as_slice(), [PolicyEvent::Finding(_)]),
        "{outcome:?}"
    );
    remove(&root);
}

/// A full-lifecycle escape of the blocking policy lets the backup run with no events.
#[test]
fn the_full_lifecycle_escape_is_honored() {
    let (root, landed) = landed_repository("pc-escape", "no final newline");
    let prefix = prefix_for(&root);
    let overlay = fixture_environment();
    let mut controls = no_controls();
    controls.escaped = vec![PolicyId::FinalNewline];
    let outcome = run_post_commit_gate(&request(
        &landed,
        &prefix,
        &overlay,
        with_severity(PolicyId::FinalNewline, Severity::Error),
        controls,
    ));
    assert!(!outcome.blocked, "{outcome:?}");
    assert!(outcome.events.is_empty(), "{outcome:?}");
    remove(&root);
}

/// A landed commit Git cannot read keeps the commit and reports the engine failure before the commit-landed event.
#[test]
fn an_engine_failure_retains_the_commit_and_reports_the_failure() {
    let (root, _landed) = landed_repository("pc-failure", LANDED_CONTENT);
    let prefix = prefix_for(&root);
    let overlay = fixture_environment();
    let missing = "f".repeat(40);
    let outcome = run_post_commit_gate(&request(
        &missing,
        &prefix,
        &overlay,
        with_severity(PolicyId::FinalNewline, Severity::Error),
        no_controls(),
    ));
    assert!(outcome.blocked);
    let kinds: Vec<&str> = outcome
        .events
        .iter()
        .map(|event| match event {
            PolicyEvent::EngineFailure { .. } => "engine-failure",
            PolicyEvent::CommitLanded { .. } => "commit-landed",
            _ => "other",
        })
        .collect();
    assert_eq!(kinds.last(), Some(&"commit-landed"), "{kinds:?}");
    assert!(kinds.contains(&"engine-failure"), "{kinds:?}");
    remove(&root);
}

/// A landed name that is not an object name is an engine failure, never a clean gate.
#[test]
fn a_landed_name_that_is_not_an_object_name_is_an_engine_failure() {
    let (root, _landed) = landed_repository("pc-bad-name", LANDED_CONTENT);
    let prefix = prefix_for(&root);
    let overlay = fixture_environment();
    let outcome = run_post_commit_gate(&request(
        "not-an-oid",
        &prefix,
        &overlay,
        with_severity(PolicyId::FinalNewline, Severity::Error),
        no_controls(),
    ));
    assert!(outcome.blocked);
    assert!(matches!(
        outcome.events.first(),
        Some(PolicyEvent::EngineFailure {
            code: EngineFailureCode::ContentUnavailable,
            ..
        })
    ));
    remove(&root);
}

/// A blocked gate prints its events, exits `2` and never runs the backup.
#[test]
fn a_blocked_gate_exits_two_and_does_not_back_up() {
    let (root, landed) = landed_repository("pc-run-blocked", "no final newline");
    let prefix = prefix_for(&root);
    let overlay = fixture_environment();
    let git_context = PushGit {
        real_git: PathBuf::from("/usr/bin/git"),
        cwd: root.clone(),
        environment: overlay.clone(),
    };
    let mut err: Vec<u8> = Vec::new();
    let outcome = run_post_commit(
        &request(
            &landed,
            &prefix,
            &overlay,
            with_severity(PolicyId::FinalNewline, Severity::Error),
            no_controls(),
        ),
        &git_context,
        &mut err,
    )
    .expect("runs");
    assert_eq!(outcome.exit_code, POST_COMMIT_BLOCKED_EXIT_CODE);
    assert!(outcome.auto_push.is_none());
    let terminal = String::from_utf8_lossy(&err);
    assert!(
        terminal.contains("\"type\":\"commit-landed\""),
        "{terminal}"
    );
    remove(&root);
}

/// A clean gate hands the landed commit to auto-push; a repository without remotes is skipped with exit `0`.
#[test]
fn a_clean_gate_hands_the_commit_to_auto_push() {
    let (root, landed) = landed_repository("pc-run-clean", LANDED_CONTENT);
    let prefix = prefix_for(&root);
    let overlay = fixture_environment();
    let git_context = PushGit {
        real_git: PathBuf::from("/usr/bin/git"),
        cwd: root.clone(),
        environment: overlay.clone(),
    };
    let mut err: Vec<u8> = Vec::new();
    let outcome = run_post_commit(
        &request(
            &landed,
            &prefix,
            &overlay,
            with_severity(PolicyId::FinalNewline, Severity::Error),
            no_controls(),
        ),
        &git_context,
        &mut err,
    )
    .expect("runs");
    assert_eq!(outcome.exit_code, 0);
    let pushed = outcome.auto_push.expect("auto-push ran");
    assert_eq!(pushed.outcome, crate::auto_push::AutoPushOutcome::Skipped);
    assert!(err.is_empty());
    remove(&root);
}

/// The landed-delta candidates list only the paths the landed commit changed, classified as added.
#[test]
fn the_landed_delta_lists_only_the_changed_paths_as_added() {
    let (root, landed) = landed_repository("pc-delta", LANDED_CONTENT);
    let prefix = prefix_for(&root);
    let overlay = fixture_environment();
    let mut facts = git_facts(Path::new("/usr/bin/git"), &prefix, &overlay);
    let commit = parse_object_id(landed.as_bytes()).expect("object name");
    let prepared = facts
        .candidates(&CandidateRequest::Landed(commit))
        .expect("landed candidates");
    let paths: Vec<String> = prepared
        .version
        .candidates()
        .iter()
        .map(|candidate| String::from_utf8_lossy(&candidate.path).into_owned())
        .collect();
    assert_eq!(paths, vec!["landed.txt".to_owned()], "{paths:?}");
    remove(&root);
}
