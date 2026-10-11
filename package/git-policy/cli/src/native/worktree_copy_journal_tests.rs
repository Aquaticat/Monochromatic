//! Journal checks: the exact encoding, strict validation, private storage and removal on disk.

use super::*;
use crate::test_support::{fixture, remove};
use std::os::unix::fs::PermissionsExt;

/// A valid staged journal whose paths live under one fixture root.
fn sample(root: &Path) -> Journal {
    let destination: PathBuf = root.join("topic");
    let stage: PathBuf = root.join(".cli-git-worktree-copy-abc");
    return Journal {
        created_entries: vec![InstalledPath {
            device: 7,
            inode: 42,
            relative_path: String::from("cache"),
            selected: true,
        }],
        intended_entries: vec![String::from("cache")],
        destination_root: destination.to_string_lossy().into_owned(),
        phase: Phase::Installing,
        selected_roots: vec![String::from("cache")],
        source_root: root.join("source").to_string_lossy().into_owned(),
        stage_container: stage.to_string_lossy().into_owned(),
        stage_root: stage.join("payload").to_string_lossy().into_owned(),
    };
}

/// The encoding is the incumbent's `JSON.stringify` of the same object, with a final line feed.
#[test]
fn encoding_matches_the_incumbent_exactly() {
    let journal: Journal = sample(Path::new("/w"));
    let expected: String = concat!(
        "{\"createdEntries\":[{\"device\":\"7\",\"inode\":\"42\",\"relativePath\":\"cache\",\"selected\":true}],",
        "\"intendedEntries\":[\"cache\"],",
        "\"destinationRoot\":\"/w/topic\",",
        "\"phase\":\"installing\",",
        "\"selectedRoots\":[\"cache\"],",
        "\"sourceRoot\":\"/w/source\",",
        "\"stageContainer\":\"/w/.cli-git-worktree-copy-abc\",",
        "\"stageRoot\":\"/w/.cli-git-worktree-copy-abc/payload\",",
        "\"version\":1}\n"
    )
    .to_string();
    assert_eq!(encode_journal(&journal), expected);
}

/// Encoding then parsing returns the same journal.
#[test]
fn encoded_journal_parses_back_to_itself() {
    let root: PathBuf = fixture("journal-round-trip");
    let journal: Journal = sample(root.as_path());
    let journal_root: PathBuf = root.join("journals");
    let path: PathBuf = journal_root.join("id.json");
    let parsed: Journal = parse_journal(
        encode_journal(&journal).as_str(),
        path.as_path(),
        journal_root.as_path(),
    )
    .expect("valid");
    assert_eq!(parsed, journal);
    remove(root.as_path());
}

/// Every rule of the incumbent's validation refuses the record with its own wording.
#[test]
fn validation_refuses_each_malformed_shape() {
    let root: PathBuf = fixture("journal-validation");
    let journal_root: PathBuf = root.join("journals");
    let path: PathBuf = journal_root.join("id.json");
    let base: String = encode_journal(&sample(root.as_path()));
    let corrupt = format!(
        "cli-git: worktree-copy journal is corrupt: {}.",
        quote(path.to_string_lossy().as_ref())
    );
    let cases: Vec<(String, String)> = vec![
        (
            base.replace("\"version\":1", "\"version\":2"),
            corrupt.clone(),
        ),
        (
            base.replace("\"phase\":\"installing\"", "\"phase\":\"other\""),
            corrupt.clone(),
        ),
        (
            base.replace("\"device\":\"7\"", "\"device\":\"07\""),
            corrupt.clone(),
        ),
        (
            base.replace("\"selected\":true", "\"selected\":\"yes\""),
            corrupt.clone(),
        ),
        (
            base.replace("\"intendedEntries\":[\"cache\"]", "\"intendedEntries\":[1]"),
            corrupt.clone(),
        ),
        (
            base.replace(
                &format!(
                    "\"sourceRoot\":{}",
                    quote(root.join("source").to_string_lossy().as_ref())
                ),
                "\"sourceRoot\":\"relative/source\"",
            ),
            String::from(
                "cli-git: worktree-copy journal has unsafe sourceRoot: \"relative/source\".",
            ),
        ),
        (
            base.replace(
                &format!(
                    "\"stageContainer\":{}",
                    quote(
                        root.join(".cli-git-worktree-copy-abc")
                            .to_string_lossy()
                            .as_ref()
                    )
                ),
                &format!(
                    "\"stageContainer\":{}",
                    quote(
                        root.join("elsewhere/.cli-git-worktree-copy-abc")
                            .to_string_lossy()
                            .as_ref()
                    )
                ),
            ),
            format!(
                "cli-git: worktree-copy journal has unsafe private stage relation: {}.",
                quote(path.to_string_lossy().as_ref())
            ),
        ),
        (
            base.replace(
                "\"intendedEntries\":[\"cache\"]",
                "\"intendedEntries\":[\"../escape\"]",
            ),
            String::from("cli-git: Git returned unsafe ignored path \"../escape\"."),
        ),
        (
            base.replace(
                "\"selectedRoots\":[\"cache\"]",
                "\"selectedRoots\":[\"cache\",\"cache\"]",
            ),
            format!(
                "cli-git: worktree-copy journal contains duplicate repository paths: {}.",
                quote(path.to_string_lossy().as_ref())
            ),
        ),
    ];
    for (text, expected) in cases {
        let failure: WorktreeCopyError =
            parse_journal(text.as_str(), path.as_path(), journal_root.as_path())
                .expect_err("refused");
        assert_eq!(failure.0, expected, "{text}");
    }
    let escaped: PathBuf = root.join("elsewhere/id.json");
    let failure: WorktreeCopyError =
        parse_journal(base.as_str(), escaped.as_path(), journal_root.as_path())
            .expect_err("escaped");
    assert_eq!(
        failure.0,
        format!(
            "cli-git: worktree-copy journal escaped private root: {}.",
            quote(escaped.to_string_lossy().as_ref())
        )
    );
    let not_json: WorktreeCopyError =
        parse_journal("{", path.as_path(), journal_root.as_path()).expect_err("not json");
    // The JSON parser's own text differs from the incumbent's; the wording before the cause is the contract.
    assert!(
        not_json.0.starts_with(&format!(
            "cli-git: could not read worktree-copy journal {}. Cause: ",
            quote(path.to_string_lossy().as_ref())
        )),
        "{}",
        not_json.0
    );
    remove(root.as_path());
}

/// The journal root and its parent are created private, and a journal written there reads back exactly.
#[cfg(unix)]
#[test]
fn journal_is_written_privately_and_read_back() {
    let root: PathBuf = fixture("journal-disk");
    let common: PathBuf = root.join("common");
    std::fs::create_dir(common.as_path()).expect("common");
    let journal_root: PathBuf = ensure_journal_root(common.as_path()).expect("root");
    assert_eq!(
        journal_root,
        common.join("cli-git-worktree-copy").join("v1")
    );
    assert_eq!(
        std::fs::metadata(journal_root.as_path())
            .expect("root")
            .permissions()
            .mode()
            & 0o777,
        0o700
    );
    let journal: Journal = sample(root.as_path());
    let path: PathBuf = journal_root.join("id.json");
    write_journal(path.as_path(), &journal).expect("write");
    assert_eq!(
        std::fs::metadata(path.as_path())
            .expect("file")
            .permissions()
            .mode()
            & 0o777,
        0o600
    );
    let pending: Vec<PendingJournal> = read_pending_journals(common.as_path()).expect("pending");
    assert_eq!(
        pending,
        vec![PendingJournal {
            path: path.clone(),
            journal
        }]
    );
    remove(root.as_path());
}

/// Without a journal root there is nothing pending.
#[test]
fn absent_journal_root_has_no_pending_journals() {
    let root: PathBuf = fixture("journal-absent");
    assert!(
        read_pending_journals(root.as_path())
            .expect("none")
            .is_empty()
    );
    remove(root.as_path());
}

/// A journal whose file is group-writable is unsafe and fails closed without being deleted.
#[cfg(unix)]
#[test]
fn unsafe_journal_mode_fails_closed_and_is_kept() {
    let root: PathBuf = fixture("journal-unsafe-mode");
    let common: PathBuf = root.join("common");
    std::fs::create_dir(common.as_path()).expect("common");
    let journal_root: PathBuf = ensure_journal_root(common.as_path()).expect("root");
    let path: PathBuf = journal_root.join("id.json");
    std::fs::write(path.as_path(), encode_journal(&sample(root.as_path()))).expect("journal");
    std::fs::set_permissions(path.as_path(), std::fs::Permissions::from_mode(0o620)).expect("mode");
    let failure: WorktreeCopyError = read_pending_journals(common.as_path()).expect_err("unsafe");
    assert_eq!(
        failure.0,
        format!(
            "cli-git: worktree-copy journal file is unsafe: {}.",
            quote(path.to_string_lossy().as_ref())
        )
    );
    assert!(path.exists());
    remove(root.as_path());
}

/// A journal file with a second hard link is unsafe, because its content could be changed elsewhere.
#[cfg(unix)]
#[test]
fn journal_with_extra_hard_link_is_unsafe() {
    let root: PathBuf = fixture("journal-link-count");
    let common: PathBuf = root.join("common");
    std::fs::create_dir(common.as_path()).expect("common");
    let journal_root: PathBuf = ensure_journal_root(common.as_path()).expect("root");
    let path: PathBuf = journal_root.join("id.json");
    std::fs::write(path.as_path(), encode_journal(&sample(root.as_path()))).expect("journal");
    std::fs::hard_link(path.as_path(), root.join("alias")).expect("alias");
    let failure: WorktreeCopyError = read_pending_journals(common.as_path()).expect_err("linked");
    assert!(
        failure
            .0
            .starts_with("cli-git: worktree-copy journal file is unsafe: ")
    );
    remove(root.as_path());
}

/// A journal that cannot be written fails with the persist wording and leaves no temporary file.
#[test]
fn unwritable_journal_leaves_no_temporary() {
    let root: PathBuf = fixture("journal-persist");
    let path: PathBuf = root.join("absent-directory").join("id.json");
    let failure: WorktreeCopyError =
        write_journal(path.as_path(), &sample(root.as_path())).expect_err("persist");
    assert_eq!(
        failure.0,
        format!(
            "cli-git: could not persist worktree-copy journal {}. Cause: No such file or directory (os error 2)",
            quote(path.to_string_lossy().as_ref())
        )
    );
    remove(root.as_path());
}

/// Removal writes the complete phase, deletes the stage with its read-only subdirectories, and deletes the journal.
#[cfg(unix)]
#[test]
fn removal_deletes_stage_and_journal() {
    let root: PathBuf = fixture("journal-remove");
    let common: PathBuf = root.join("common");
    std::fs::create_dir(common.as_path()).expect("common");
    let journal_root: PathBuf = ensure_journal_root(common.as_path()).expect("root");
    let journal: Journal = sample(root.as_path());
    let stage: PathBuf = PathBuf::from(journal.stage_container.as_str());
    std::fs::create_dir_all(stage.join("payload/locked")).expect("stage");
    std::fs::write(stage.join("payload/locked/file"), b"x").expect("file");
    std::fs::set_permissions(
        stage.join("payload/locked"),
        std::fs::Permissions::from_mode(0o500),
    )
    .expect("read-only");
    let path: PathBuf = journal_root.join("id.json");
    write_journal(path.as_path(), &journal).expect("write");
    let pending: PendingJournal = PendingJournal {
        path: path.clone(),
        journal,
    };
    remove_pending_journal(&pending).expect("removed");
    assert!(!stage.exists());
    assert!(!path.exists());
    remove(root.as_path());
}
