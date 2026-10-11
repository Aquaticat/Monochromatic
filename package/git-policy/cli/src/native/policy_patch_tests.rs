//! Controls for policy patches:
//!  the grammar of one ordinary text path,
//!  and `git apply --cached --3way` against a real private index.

use super::*;
use crate::test_support::{fixture, git, git_context, remove, repository};
use crate::transaction_git::GitRequest;
use std::path::PathBuf;

/// A 40-character lowercase object ID standing for the candidate base.
const BASE: &str = "0123456789abcdef0123456789abcdef01234567";
/// A 40-character lowercase object ID standing for the proposed result.
const PROPOSED: &str = "fedcba9876543210fedcba9876543210fedcba98";

/// A one-hunk patch that adds the final newline to `f.txt`, naming `old` and `new` in its index line.
fn final_newline_patch(old: &str, new: &str) -> PolicyPatch {
    let text: String = format!(
        "diff --git a/f.txt b/f.txt\nindex {old}..{new} 100644\n--- a/f.txt\n+++ b/f.txt\n@@ -1,2 +1,2 @@\n a\n-b\n\\ No newline at end of file\n+b\n"
    );
    return PolicyPatch {
        target_id: String::from("f.txt"),
        path: String::from("f.txt"),
        bytes: text.into_bytes(),
    };
}

/// A repository whose `f.txt` ends without a newline, and whose private index starts equal to `HEAD`.
fn scene(name: &str) -> (PathBuf, PathBuf, PathBuf) {
    let root: PathBuf = fixture(name);
    let repo: PathBuf = repository(root.as_path(), "repo");
    std::fs::write(repo.join("f.txt"), b"a\nb").expect("the file is written");
    git(repo.as_path(), &["add", "--", "f.txt"]);
    git(repo.as_path(), &["commit", "--quiet", "--message=add f"]);
    let index: PathBuf = root.join("private-index");
    let mut read: GitRequest = GitRequest::new(repo.as_path(), &["read-tree", "HEAD"]);
    read.without_prefix = true;
    read.index = Some(index.clone());
    let output = crate::transaction_git::run_git(&git_context(), &read).expect("read-tree starts");
    assert!(output.succeeded(), "{}", output.error_text());
    return (root, repo, index);
}

/// The blob staged for `f.txt` in the private index.
fn staged_blob(repo: &Path, index: &Path) -> String {
    let mut list: GitRequest = GitRequest::new(repo, &["ls-files", "-s", "--", "f.txt"]);
    list.without_prefix = true;
    list.index = Some(index.to_path_buf());
    let output = crate::transaction_git::run_git(&git_context(), &list).expect("ls-files starts");
    assert!(output.succeeded(), "{}", output.error_text());
    let text: String = String::from_utf8_lossy(output.stdout.as_slice()).into_owned();
    let mut fields = text.split_whitespace();
    let _mode = fields.next();
    return fields.next().expect("the index names a blob").to_string();
}

/// The blob `HEAD` names for `f.txt`.
fn head_blob(repo: &Path) -> String {
    return String::from_utf8_lossy(git(repo, &["rev-parse", "HEAD:f.txt"]).stdout.as_slice())
        .trim()
        .to_string();
}

/// One blob to write: the repository, the scratch directory and the bytes.
struct BlobWrite<'a> {
    repo: &'a Path,
    scratch: &'a Path,
    content: &'a [u8],
}

/// Writes the content into the repository object store and returns its blob ID.
fn write_blob(write: BlobWrite<'_>) -> String {
    let file: PathBuf = write.scratch.join("content.txt");
    std::fs::write(&file, write.content).expect("the content is written");
    return String::from_utf8_lossy(
        git(write.repo, &["hash-object", "-w", file.to_str().expect("UTF-8 path")]).stdout.as_slice(),
    )
    .trim()
    .to_string();
}

/// One application attempt: the repository, its private index and scratch directory, and the patch.
struct Attempt<'a> {
    repo: &'a Path,
    index: &'a Path,
    directory: &'a Path,
    patch: &'a PolicyPatch,
    expected: &'a str,
    ordinal: u32,
}

/// Applies the patch to the private index from the repository, against the expected base.
fn apply(attempt: Attempt<'_>) -> Result<(), PatchError> {
    return apply_private_patch(PrivatePatchInput {
        context: &git_context(),
        cwd: attempt.repo,
        index: attempt.index,
        object_directory: None,
        directory: attempt.directory,
        patch: attempt.patch,
        expected_revision: attempt.expected,
        ordinal: attempt.ordinal,
    });
}

/// The final-newline correction lands in the private index, and the real index is untouched.
#[test]
fn the_final_newline_correction_lands_in_the_private_index() {
    let (root, repo, index): (PathBuf, PathBuf, PathBuf) = scene("policy-patch-lands");
    let old: String = head_blob(repo.as_path());
    let new: String = write_blob(BlobWrite { repo: repo.as_path(), scratch: root.as_path(), content: b"a\nb\n" });
    let patch: PolicyPatch = final_newline_patch(old.as_str(), new.as_str());
    let applied = apply(Attempt { repo: repo.as_path(), index: index.as_path(), directory: root.as_path(), patch: &patch, expected: old.as_str(), ordinal: 1 });
    assert_eq!(applied, Ok(()));
    assert_eq!(staged_blob(repo.as_path(), index.as_path()), new);
    assert_eq!(head_blob(repo.as_path()), old, "the real history is not moved");
    remove(root.as_path());
}

/// A patch against a private index that already differs from its base is a conflict, and Git names why.
#[test]
fn a_patch_against_different_content_is_a_conflict() {
    let (root, repo, index): (PathBuf, PathBuf, PathBuf) = scene("policy-patch-conflict");
    let old: String = head_blob(repo.as_path());
    let other: String = write_blob(BlobWrite { repo: repo.as_path(), scratch: root.as_path(), content: b"x\ny" });
    let mut stage: GitRequest = GitRequest::new(repo.as_path(), &["update-index", "--cacheinfo", &format!("100644,{other},f.txt")]);
    stage.without_prefix = true;
    stage.index = Some(index.clone());
    assert!(crate::transaction_git::run_git(&git_context(), &stage).expect("update-index starts").succeeded());
    let new: String = write_blob(BlobWrite { repo: repo.as_path(), scratch: root.as_path(), content: b"a\nb\n" });
    let patch: PolicyPatch = final_newline_patch(old.as_str(), new.as_str());
    let outcome: Result<(), PatchError> = apply(Attempt { repo: repo.as_path(), index: index.as_path(), directory: root.as_path(), patch: &patch, expected: old.as_str(), ordinal: 1 });
    assert!(matches!(outcome, Err(PatchError::Conflict(_))), "{outcome:?}");
    remove(root.as_path());
}

/// The patch file is private and exclusive: a second patch with the same ordinal is refused, not overwritten.
#[test]
fn a_repeated_ordinal_never_overwrites_an_earlier_patch_file() {
    let (root, repo, index): (PathBuf, PathBuf, PathBuf) = scene("policy-patch-ordinal");
    let old: String = head_blob(repo.as_path());
    let new: String = write_blob(BlobWrite { repo: repo.as_path(), scratch: root.as_path(), content: b"a\nb\n" });
    let patch: PolicyPatch = final_newline_patch(old.as_str(), new.as_str());
    assert_eq!(apply(Attempt { repo: repo.as_path(), index: index.as_path(), directory: root.as_path(), patch: &patch, expected: old.as_str(), ordinal: 7 }), Ok(()));
    let repeated: Result<(), PatchError> = apply(Attempt { repo: repo.as_path(), index: index.as_path(), directory: root.as_path(), patch: &patch, expected: old.as_str(), ordinal: 7 });
    assert!(matches!(repeated, Err(PatchError::Failed(_))), "{repeated:?}");
    remove(root.as_path());
}

/// A well-formed single-path patch passes the grammar.
#[test]
fn a_single_path_patch_passes_the_grammar() {
    let patch: PolicyPatch = final_newline_patch(BASE, PROPOSED);
    assert_eq!(validate_policy_patch(PatchCheck { patch: &patch, expected_revision: BASE }), Ok(()));
}

/// Every unsafe path is rejected by the path rule itself, even when its headers name that path well-formed.
#[test]
fn unsafe_paths_are_rejected_by_the_path_rule() {
    for path in ["../f.txt", "a/./f.txt", "/f.txt", "a\nf.txt", "a\rf.txt", "a/../f.txt"] {
        let text: String = format!("diff --git a/{path} b/{path}\nindex {BASE}..{PROPOSED} 100644\n--- a/{path}\n+++ b/{path}\n@@ -1 +1 @@\n-a\n+b\n");
        let patch: PolicyPatch = PolicyPatch { target_id: String::from("t"), path: String::from(path), bytes: text.into_bytes() };
        let outcome: Result<(), PatchError> = validate_policy_patch(PatchCheck { patch: &patch, expected_revision: BASE });
        assert!(matches!(outcome, Err(PatchError::Rejected(_))), "{path}: {outcome:?}");
    }
}

/// Each header and directive rule rejects its own violation.
#[test]
fn header_and_directive_violations_are_rejected() {
    let good: String = String::from_utf8(final_newline_patch(BASE, PROPOSED).bytes).expect("UTF-8 patch");
    let variants: [String; 7] = [
        good.replace(&format!("index {BASE}..{PROPOSED} 100644\n"), ""),
        format!("{good}index {BASE}..{PROPOSED} 100644\n"),
        good.replace("diff --git a/f.txt b/f.txt", "diff --git a/g.txt b/g.txt"),
        good.replace(&format!("index {BASE}..{PROPOSED} 100644"), &format!("index {PROPOSED}..{PROPOSED} 100644")),
        good.replace(" 100644\n", " 100000\n"),
        good.replace("--- a/f.txt\n", "rename from f.txt\n--- a/f.txt\n"),
        good.replace(&format!("{PROPOSED} 100644"), &format!("{}G{} 100644", &PROPOSED[..1], &PROPOSED[2..])),
    ];
    for text in variants {
        let patch: PolicyPatch = PolicyPatch { target_id: String::from("t"), path: String::from("f.txt"), bytes: text.clone().into_bytes() };
        let outcome: Result<(), PatchError> = validate_policy_patch(PatchCheck { patch: &patch, expected_revision: BASE });
        assert!(matches!(outcome, Err(PatchError::Rejected(_))), "{text}: {outcome:?}");
    }
}
