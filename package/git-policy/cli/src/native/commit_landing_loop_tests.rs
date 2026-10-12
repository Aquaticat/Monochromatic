//! Controls for the landing loop's helpers: the failure texts, the event order and the completion records.

use super::*;
use crate::capture_invocation::InvocationLayout;
use crate::transaction_git::{GitContext, GitFailure};
use crate::test_support::{REAL_GIT, fixture, git, remove, repository};
use crate::transaction_journal::{Conclusion, RefFormat, SymbolicHead};
use std::ffi::OsString;

/// A capture on `refs/heads/main`.
fn capture() -> InvocationCapture {
    return InvocationCapture {
        base: Base::Unborn,
        layout: InvocationLayout {
            symbolic_head: SymbolicHead::Branch(String::from("refs/heads/main")),
            target_ref: String::from("refs/heads/main"),
            conclusion: Conclusion::None,
            repository_root: PathBuf::from("/r"),
            git_dir: PathBuf::from("/r/.git"),
            common_dir: PathBuf::from("/r/.git"),
            real_index_path: PathBuf::from("/r/.git/index"),
            object_directory: PathBuf::from("/r/.git/objects"),
            registry_root: PathBuf::from("/r/.git/cli-git-transactions"),
            ref_format: RefFormat::Files,
            object_format: String::from("sha1"),
            empty_tree_oid: "4".repeat(40),
            invoked_at: String::from("2026-10-11T00:00:00.000Z"),
        },
    };
}

/// A replay that broke ends with one transaction failure naming the target, the parent and the cause.
#[test]
fn a_broken_replay_is_one_transaction_failure() {
    match replay_failure(&capture(), "abc", String::from("because")) {
        LoopOutcome::Failed { events, exit_code } => {
            assert_eq!(exit_code, 2);
            assert_eq!(events.len(), 1);
            match &events[0] {
                PolicyEvent::EngineFailure { message, code, trigger, .. } => {
                    assert_eq!(*code, crate::diagnostics::EngineFailureCode::TransactionFailed);
                    assert_eq!(*trigger, Some(crate::policy_trigger::Trigger::PreForward));
                    assert_eq!(
                        message,
                        "refs/heads/main moved while this commit was prepared, and replaying it onto abc failed; nothing landed: because"
                    );
                }
                other => panic!("expected an engine failure, got {other:?}"),
            }
        }
        LoopOutcome::Landed { .. } => panic!("a broken replay lands nothing"),
    }
}

/// Failure events are the settled events, then the lost races, then the last events, in that order.
#[test]
fn failure_events_keep_their_order() {
    let settled: Vec<PolicyEvent> = vec![PolicyEvent::LandingReserved { lost_races: 1 }];
    let raced: Vec<PolicyEvent> = vec![PolicyEvent::LandingReserved { lost_races: 2 }];
    let last: Vec<PolicyEvent> = vec![PolicyEvent::LandingReserved { lost_races: 3 }];
    assert_eq!(
        failed_events(settled.as_slice(), raced.as_slice(), last),
        vec![
            PolicyEvent::LandingReserved { lost_races: 1 },
            PolicyEvent::LandingReserved { lost_races: 2 },
            PolicyEvent::LandingReserved { lost_races: 3 },
        ]
    );
}

/// Every replay step failure keeps its cause in the text.
#[test]
fn replay_error_texts_keep_the_cause() {
    assert_eq!(replay_error_text(&ReplayError::Git(GitFailure(String::from("git said no")))), "git said no");
    assert_eq!(replay_error_text(&ReplayError::Object(String::from("bad object"))), "bad object");
    assert!(replay_error_text(&ReplayError::Merge(crate::replay_merge::ReplayMergeError::Rebuild(String::from("rebuilt")))).contains("rebuilt"));
}

/// A reservation failure stops the loop as a transaction failure.
#[test]
fn a_reservation_failure_is_a_transaction_failure() {
    match reservation_stop(ReservationError::Identity(String::from("who"))) {
        TransactionStop::Failed { message, .. } => assert!(message.contains("who"), "{message}"),
        other => panic!("expected a failure, got {other:?}"),
    }
}

/// Completions follow the replayed index: a path keeps its record with the new blob only while its entry keeps the mode.
#[test]
fn completions_are_retargeted_to_the_replayed_blobs() {
    let root: PathBuf = fixture("loop-retarget");
    let repo: PathBuf = repository(root.as_path(), "repo");
    std::fs::write(repo.join("same.txt"), b"same\n").expect("same");
    std::fs::write(repo.join("moded.txt"), b"moded\n").expect("moded");
    git(repo.as_path(), &["add", "--", "same.txt", "moded.txt"]);
    git(repo.as_path(), &["update-index", "--chmod=+x", "moded.txt"]);
    let blob: String = String::from_utf8_lossy(git(repo.as_path(), &["rev-parse", ":same.txt"]).stdout.as_slice()).trim().to_string();
    let context: GitContext = GitContext {
        real_git: PathBuf::from(REAL_GIT),
        overlay: Vec::<(OsString, OsString)>::new(),
        global_prefix: Vec::new(),
    };
    let environment: Vec<(OsString, OsString)> = Vec::new();
    let config = crate::config_schema::CliGitConfig::defaults();
    let controls = crate::wrapper_controls::no_controls();
    let region = crate::command_commit::parse_commit_region(&[], &[]).expect("region");
    let invocation: CommitInvocation<'_> = CommitInvocation {
        context: &context,
        environment: environment.as_slice(),
        cwd: repo.as_path(),
        arguments: &[],
        subcommand_index: 0,
        region: &region,
        config: &config,
        controls: &controls,
        inherited_lease_valid: false,
        executable: Path::new("/nonexistent"),
    };
    let record = |path: &str, mode: &str| {
        return AddedPath {
            path: String::from(path),
            git_mode: String::from(mode),
            original_oid: String::from("o"),
            intended_oid: String::from("old"),
        };
    };
    let retargeted: Vec<AddedPath> = retarget_records(
        &invocation,
        repo.join(".git/index").as_path(),
        &[record("same.txt", "100644"), record("moded.txt", "100644"), record("gone.txt", "100644")],
    )
    .expect("retargeted");
    assert_eq!(retargeted.len(), 1, "{retargeted:?}");
    assert_eq!(retargeted[0].path, "same.txt");
    assert_eq!(retargeted[0].intended_oid, blob);
    assert_eq!(retargeted[0].original_oid, "o");
    remove(root.as_path());
}

/// Each lost race moves the attempt number and the lost-race count up by one.
#[test]
fn a_lost_race_moves_the_counters_up_by_one() {
    assert_eq!(next_attempt_number(1), 2);
    assert_eq!(next_attempt_number(5), 6);
    assert_eq!(lost_races_after(0), 1);
    assert_eq!(lost_races_after(4), 5);
}
