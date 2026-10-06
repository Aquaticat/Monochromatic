//! What: Controls for the lifecycle's candidates: prepared once, shared, failures remembered
//!       and coded by cause, and no read before preparation.
//! Why: A second preparation would double the Git work; a retried failure could report
//!      two different answers; a read before preparation must fail, never look clean.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // expect(await content.version(lifecycle, facts)).toBe(await content.version(lifecycle, facts));
//! ```
#![cfg(unix)]

/// Import the module under test.
use super::{ContentState, LifecycleContent, candidate_failure};
use crate::candidate_error::{CandidateError, CandidateFailure};
use crate::candidate_prediction::CandidateRequest;
use crate::candidate_version::{Candidate, CandidateVersion};
use crate::diagnostics::EngineFailureCode;
use crate::policy_engine::PolicyOutcome;
use crate::policy_test_support::{ScriptedFacts, scripted_facts};
use crate::test_support::{fixture, remove, repository};
use std::ffi::OsString;
use std::path::PathBuf;
use std::rc::Rc;

/// The candidates of a direct check over the whole worktree.
fn whole_worktree() -> LifecycleContent {
    return LifecycleContent::Requested(CandidateRequest::Direct(vec![OsString::from(":/")]));
}

/// The policy-incomplete outcome of a read made before preparation.
fn not_prepared() -> PolicyOutcome {
    return PolicyOutcome::Failed {
        code: EngineFailureCode::PolicyIncomplete,
        message: String::from(
            "cli-git read candidate content before the candidates were prepared; this is a defect in cli-git.",
        ),
    };
}

/// A lifecycle without candidates prepares nothing and asks nothing.
#[test]
fn no_candidates_prepare_nothing() {
    let mut facts: ScriptedFacts = scripted_facts();
    let mut content: ContentState = ContentState::default();
    assert!(
        content
            .prepare(&LifecycleContent::None, &mut facts)
            .expect("nothing to prepare")
            .is_none()
    );
    assert!(
        content
            .version(&LifecycleContent::None, &mut facts)
            .expect("nothing to read")
            .is_none()
    );
    assert_eq!(facts.asked, Vec::<String>::new());
}

/// Candidates are prepared once and the same version is shared; bytes come through its store.
#[test]
fn candidates_are_prepared_once_and_shared() {
    let root: PathBuf = fixture("content-shared");
    let repo: PathBuf = repository(root.as_path(), "repo");
    std::fs::write(repo.join("a.txt"), b"bytes\n").expect("file");
    let mut facts: ScriptedFacts = scripted_facts();
    facts.candidates_repository = Some(repo.clone());
    let mut content: ContentState = ContentState::new();
    let first: Rc<CandidateVersion> = content
        .prepare(&whole_worktree(), &mut facts)
        .expect("prepared")
        .expect("candidates");
    let second: Rc<CandidateVersion> = content
        .version(&whole_worktree(), &mut facts)
        .expect("read")
        .expect("candidates");
    assert!(Rc::ptr_eq(&first, &second), "one version is shared");
    assert_eq!(facts.asked, vec![String::from("candidates")]);
    let candidate: Candidate = first.candidates()[0].clone();
    assert_eq!(&content.bytes(&candidate).expect("bytes")[..], b"bytes\n");
    // A blob that vanished from the object store is unreadable content.
    let object: String = candidate
        .object
        .clone()
        .expect("object")
        .as_str()
        .to_owned();
    std::fs::remove_file(
        repo.join(".git/objects")
            .join(&object[..2])
            .join(&object[2..]),
    )
    .expect("remove the loose object");
    let mut fresh: ContentState = ContentState::new();
    let mut fresh_facts: ScriptedFacts = scripted_facts();
    fresh_facts.candidates_repository = Some(repo.clone());
    let version: Rc<CandidateVersion> = fresh
        .version(&whole_worktree(), &mut fresh_facts)
        .expect("listing needs no blob")
        .expect("candidates");
    // The fresh projection hashed the file again, so remove that object too before reading.
    let again: String = version.candidates()[0]
        .object
        .clone()
        .expect("object")
        .as_str()
        .to_owned();
    assert_eq!(again, object, "the same bytes name the same object");
    std::fs::remove_file(
        repo.join(".git/objects")
            .join(&object[..2])
            .join(&object[2..]),
    )
    .expect("remove the rewritten loose object");
    match fresh.bytes(&version.candidates()[0]) {
        Err(PolicyOutcome::Failed { code, message }) => {
            assert_eq!(code, EngineFailureCode::ContentUnavailable);
            assert!(!message.contains("a.txt"), "{message}");
        }
        other => panic!("expected unreadable content, got {other:?}"),
    }
    remove(root.as_path());
}

/// A failure to prepare is remembered: reported the same way to every reader, never retried.
#[test]
fn a_failed_preparation_is_remembered() {
    let mut facts: ScriptedFacts = scripted_facts();
    let mut content: ContentState = ContentState::new();
    let raw: CandidateError = content
        .prepare(&whole_worktree(), &mut facts)
        .expect_err("scripted facts prepare nothing");
    assert_eq!(raw.failure, CandidateFailure::GitNotStarted);
    let expected: PolicyOutcome = PolicyOutcome::Failed {
        code: EngineFailureCode::ContentUnavailable,
        message: String::from("the scripted facts prepare no candidates"),
    };
    for _attempt in 0..2 {
        assert_eq!(
            content
                .version(&whole_worktree(), &mut facts)
                .expect_err("remembered failure"),
            expected
        );
    }
    assert_eq!(facts.asked, vec![String::from("candidates")]);
    // Reading bytes after a failed preparation is a defect of the caller, not clean content.
    let version_less: Candidate = Candidate {
        identity: crate::candidate_version::CandidateIdentity {
            generation: 0,
            index: 0,
        },
        path: b"a.txt".to_vec(),
        mode: crate::candidate_object::CandidateMode::Regular,
        change: crate::candidate_record::CandidateChange::Added,
        object: None,
    };
    assert_eq!(content.bytes(&version_less), Err(not_prepared()));
    assert_eq!(
        ContentState::new().bytes(&version_less),
        Err(not_prepared())
    );
}

/// A candidate failure carries the code of its cause and the layer's own message.
#[test]
fn candidate_failures_carry_the_code_of_their_cause() {
    assert_eq!(
        candidate_failure(&CandidateError::new(CandidateFailure::GitFailed, "listing")),
        PolicyOutcome::Failed {
            code: EngineFailureCode::ContentUnavailable,
            message: String::from("listing"),
        }
    );
    assert_eq!(
        candidate_failure(&CandidateError::new(
            CandidateFailure::StaleCandidate,
            "stale"
        )),
        PolicyOutcome::Failed {
            code: EngineFailureCode::PolicyIncomplete,
            message: String::from("stale"),
        }
    );
}
