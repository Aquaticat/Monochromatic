//! Controls for the private commit index: copies, each selection mode, pathspec files and listings.

use super::*;
use crate::capture_invocation::{capture_invocation_base, capture_invocation_layout};
use crate::test_support::{fixture, git, git_context, git_text, remove, repository};
use crate::transaction_journal::RefFormat;
use std::time::{Duration, SystemTime};

/// A repository with `a.txt` and `b.txt` committed, and the private indexes beside the real index.
fn committed_repository(root: &Path) -> (PathBuf, CaptureIndexes, String) {
    let repo: PathBuf = repository(root, "repo");
    std::fs::write(repo.join("a.txt"), "a\n").expect("a");
    std::fs::write(repo.join("b.txt"), "b\n").expect("b");
    git(repo.as_path(), &["add", "a.txt", "b.txt"]);
    git(repo.as_path(), &["commit", "--quiet", "--message=files"]);
    let base: String = git_text(repo.as_path(), &["rev-parse", "HEAD"]);
    let indexes: CaptureIndexes = CaptureIndexes {
        captured_index: repo.join(".git").join("captured.index"),
        commit_index: repo.join(".git").join("commit.index"),
        object_directory: repo.join(".git").join("objects"),
    };
    return (repo, indexes, base);
}

/// Builds the selection of one mode with the given pathspecs and base.
fn selection<'a>(
    mode: TransactionMode,
    pathspecs: &'a [String],
    base: &'a str,
) -> IndexSelection<'a> {
    return IndexSelection {
        mode,
        pathspecs,
        pathspec_file: None,
        pathspec_file_nul: false,
        stage_into_index: false,
        stage_tracked_changes: false,
        base_revision: base,
    };
}

/// Runs initialization of the private index with the real index of the repository.
fn initialize(repo: &Path, indexes: &CaptureIndexes, choice: &IndexSelection) {
    initialize_commit_index(&git_context(), repo, repo.join(".git").join("index").as_path(), indexes, choice)
        .expect("initialize");
}

/// The repository paths the private index changes against the base.
fn changed(repo: &Path, indexes: &CaptureIndexes, base: &str) -> Vec<String> {
    return list_changed_index_paths(
        &git_context(),
        repo,
        indexes.commit_index.as_path(),
        base,
        indexes.object_directory.as_path(),
    )
    .expect("changed");
}

/// A copy keeps the source's modification time, and a missing source is an error.
#[test]
fn copy_keeps_the_source_modification_time() {
    let root: PathBuf = fixture("commit-index-copy-time");
    let source: PathBuf = root.join("source");
    std::fs::write(&source, "index").expect("source");
    let past: SystemTime = SystemTime::now() - Duration::from_secs(3600);
    std::fs::File::options()
        .write(true)
        .open(&source)
        .and_then(|file| { return file.set_times(FileTimes::new().set_modified(past)); })
        .expect("age the source");
    let destination: PathBuf = root.join("copy");
    copy_index_with_timestamps(source.as_path(), destination.as_path()).expect("copy");
    assert_eq!(
        std::fs::metadata(&destination).expect("copy").modified().expect("mtime"),
        std::fs::metadata(&source).expect("source").modified().expect("mtime")
    );
    assert!(copy_index_with_timestamps(root.join("absent").as_path(), destination.as_path()).is_err());
    remove(root.as_path());
}

/// Explicit-path selection stages exactly the named paths against the recorded base.
#[test]
fn explicit_path_stages_only_the_named_paths() {
    let root: PathBuf = fixture("commit-index-explicit");
    let (repo, indexes, base) = committed_repository(root.as_path());
    std::fs::write(repo.join("a.txt"), "changed\n").expect("change a");
    std::fs::write(repo.join("b.txt"), "changed\n").expect("change b");
    let pathspecs: Vec<String> = vec![String::from("a.txt")];
    initialize(&repo, &indexes, &selection(TransactionMode::ExplicitPath, &pathspecs, &base));
    assert_eq!(changed(&repo, &indexes, &base), vec![String::from("a.txt")]);
    remove(root.as_path());
}

/// An index commit without staging copies the real index unchanged.
#[test]
fn index_without_staging_matches_the_real_index() {
    let root: PathBuf = fixture("commit-index-index-plain");
    let (repo, indexes, base) = committed_repository(root.as_path());
    std::fs::write(repo.join("a.txt"), "changed\n").expect("change a");
    git(repo.as_path(), &["add", "a.txt"]);
    std::fs::write(repo.join("u.txt"), "u\n").expect("untracked");
    let pathspecs: Vec<String> = Vec::new();
    initialize(&repo, &indexes, &selection(TransactionMode::Index, &pathspecs, &base));
    let real_tree: String = write_private_tree(
        &git_context(),
        repo.as_path(),
        repo.join(".git").join("index").as_path(),
        indexes.object_directory.as_path(),
    )
    .expect("real tree");
    let private_tree: String = write_private_tree(
        &git_context(),
        repo.as_path(),
        indexes.commit_index.as_path(),
        indexes.object_directory.as_path(),
    )
    .expect("private tree");
    assert_eq!(private_tree, real_tree);
    remove(root.as_path());
}

/// `commit -a` staging stages every tracked change and leaves untracked files out.
#[test]
fn index_with_tracked_staging_stages_only_tracked_changes() {
    let root: PathBuf = fixture("commit-index-tracked");
    let (repo, indexes, base) = committed_repository(root.as_path());
    std::fs::write(repo.join("a.txt"), "changed\n").expect("change a");
    std::fs::write(repo.join("u.txt"), "u\n").expect("untracked");
    let pathspecs: Vec<String> = Vec::new();
    let mut choice: IndexSelection = selection(TransactionMode::Index, &pathspecs, &base);
    choice.stage_tracked_changes = true;
    initialize(&repo, &indexes, &choice);
    assert_eq!(changed(&repo, &indexes, &base), vec![String::from("a.txt")]);
    remove(root.as_path());
}

/// An include stages the named paths into the copy, and the real index stays as it was.
#[test]
fn include_stages_the_named_path_into_the_copy_only() {
    let root: PathBuf = fixture("commit-index-include");
    let (repo, indexes, base) = committed_repository(root.as_path());
    std::fs::write(repo.join("b.txt"), "changed\n").expect("change b");
    std::fs::write(repo.join("a.txt"), "changed\n").expect("change a");
    let real_before: Vec<u8> = std::fs::read(repo.join(".git").join("index")).expect("index");
    let pathspecs: Vec<String> = vec![String::from("b.txt")];
    let mut choice: IndexSelection = selection(TransactionMode::Index, &pathspecs, &base);
    choice.stage_into_index = true;
    initialize(&repo, &indexes, &choice);
    assert_eq!(changed(&repo, &indexes, &base), vec![String::from("b.txt")]);
    assert_eq!(std::fs::read(repo.join(".git").join("index")).expect("index"), real_before);
    remove(root.as_path());
}

/// A pathspec file read with NUL records stages each of its paths.
#[test]
fn pathspec_file_with_nul_records_selects_each_path() {
    let root: PathBuf = fixture("commit-index-nul-file");
    let (repo, indexes, base) = committed_repository(root.as_path());
    std::fs::write(repo.join("a.txt"), "changed\n").expect("change a");
    std::fs::write(repo.join("b.txt"), "changed\n").expect("change b");
    let list: PathBuf = root.join("list");
    std::fs::write(&list, b"a.txt\0b.txt\0").expect("list");
    let pathspecs: Vec<String> = Vec::new();
    let mut choice: IndexSelection = selection(TransactionMode::ExplicitPath, &pathspecs, &base);
    choice.pathspec_file = Some(list.as_path());
    choice.pathspec_file_nul = true;
    initialize(&repo, &indexes, &choice);
    assert_eq!(
        changed(&repo, &indexes, &base),
        vec![String::from("a.txt"), String::from("b.txt")]
    );
    remove(root.as_path());
}

/// A pathspec file read with newline records is the same selection as a list of positional paths.
#[test]
fn pathspec_file_with_newline_records_selects_one_path() {
    let root: PathBuf = fixture("commit-index-newline-file");
    let (repo, indexes, base) = committed_repository(root.as_path());
    std::fs::write(repo.join("a.txt"), "changed\n").expect("change a");
    std::fs::write(repo.join("b.txt"), "changed\n").expect("change b");
    let list: PathBuf = root.join("list");
    std::fs::write(&list, "a.txt\n").expect("list");
    let pathspecs: Vec<String> = Vec::new();
    let mut choice: IndexSelection = selection(TransactionMode::ExplicitPath, &pathspecs, &base);
    choice.pathspec_file = Some(list.as_path());
    initialize(&repo, &indexes, &choice);
    assert_eq!(changed(&repo, &indexes, &base), vec![String::from("a.txt")]);
    remove(root.as_path());
}

/// A relative pathspec file source resolves against the invocation directory,
///  an absolute one stays as written, and an absent source is no file.
#[test]
fn pathspec_source_resolves_against_the_effective_directory() {
    let root: PathBuf = fixture("commit-index-source");
    let mut empty: &[u8] = &[];
    assert_eq!(
        materialize_pathspec_file(root.as_path(), root.join("cwd").as_path(), Some("list"), &mut empty).expect("relative"),
        Some(root.join("cwd").join("list"))
    );
    assert_eq!(
        materialize_pathspec_file(root.as_path(), root.as_path(), Some("/abs/list"), &mut empty).expect("absolute"),
        Some(PathBuf::from("/abs/list"))
    );
    assert_eq!(
        materialize_pathspec_file(root.as_path(), root.as_path(), None, &mut empty).expect("absent"),
        None
    );
    remove(root.as_path());
}

/// Standard input is copied once into the transaction, with private mode, and its bytes are kept exactly.
#[test]
fn pathspec_from_standard_input_is_copied_once() {
    let root: PathBuf = fixture("commit-index-stdin");
    let mut input: &[u8] = b"a.txt\0b.txt\0";
    let path: PathBuf = materialize_pathspec_file(root.as_path(), root.as_path(), Some("-"), &mut input)
        .expect("stdin")
        .expect("path");
    assert_eq!(path, root.join(PATHSPEC_INPUT_NAME));
    assert_eq!(std::fs::read(&path).expect("copy"), b"a.txt\0b.txt\0");
    remove(root.as_path());
}

/// The written tree is the tree Git reports for the private index, and it is a tree object.
#[test]
fn private_tree_is_the_tree_of_the_private_index() {
    let root: PathBuf = fixture("commit-index-tree");
    let (repo, indexes, base) = committed_repository(root.as_path());
    std::fs::write(repo.join("a.txt"), "changed\n").expect("change a");
    let pathspecs: Vec<String> = vec![String::from("a.txt")];
    initialize(&repo, &indexes, &selection(TransactionMode::ExplicitPath, &pathspecs, &base));
    let oid: String = write_private_tree(
        &git_context(),
        repo.as_path(),
        indexes.commit_index.as_path(),
        indexes.object_directory.as_path(),
    )
    .expect("tree");
    assert_eq!(git_text(repo.as_path(), &["cat-file", "-t", oid.as_str()]), "tree");
    assert_ne!(oid, git_text(repo.as_path(), &["rev-parse", "HEAD^{tree}"]));
    remove(root.as_path());
}

/// A conflicted path is listed once, even though it has several unmerged stages.
#[test]
fn unmerged_paths_are_listed_once() {
    let root: PathBuf = fixture("commit-index-unmerged");
    let (repo, indexes, _base) = committed_repository(root.as_path());
    let blob: String = git_text(repo.as_path(), &["hash-object", "-w", "a.txt"]);
    let info: String = format!("100644 {blob} 1\ta.txt\n100644 {blob} 2\ta.txt\n100644 {blob} 3\ta.txt\n");
    let mut request = indexed_request(
        repo.as_path(),
        &["update-index", "--index-info"],
        Some(indexes.commit_index.as_path()),
        Some(indexes.object_directory.as_path()),
    );
    request.input = Some(info.into_bytes());
    run_git_checked(&git_context(), &request).expect("conflict stages");
    assert_eq!(
        list_unmerged_index_paths(&git_context(), repo.as_path(), indexes.commit_index.as_path()).expect("unmerged"),
        vec![String::from("a.txt")]
    );
    remove(root.as_path());
}

/// The layout of a repository and the capture of its base give the same base the selection uses.
#[test]
fn selection_base_is_the_recorded_base() {
    let root: PathBuf = fixture("commit-index-base");
    let (repo, _indexes, base) = committed_repository(root.as_path());
    let layout = capture_invocation_layout(&git_context(), repo.as_path(), false).expect("layout");
    let capture = capture_invocation_base(&git_context(), repo.as_path(), layout).expect("capture");
    assert_eq!(capture.layout.ref_format, RefFormat::Files);
    assert_eq!(crate::capture_invocation::base_revision(&capture), base);
    remove(root.as_path());
}


/// The incumbent's committed tree when one file is selected, recorded by `native-interop/capture-differential.mjs`.
const INCUMBENT_ONE_FILE_TREE: &str = "4f40a1ec2c64780454051d9d363c6870a6ef2f6e";
/// The incumbent's committed tree when both changed files are selected.
const INCUMBENT_TWO_FILE_TREE: &str = "efe77971c159b0a29a5d97e7169b8c35fa33a1f1";

/// Builds the state the incumbent differential starts from: two committed files, both changed, one untracked.
fn differential_state(root: &Path, stage: &[&str]) -> (PathBuf, CaptureIndexes, String) {
    std::fs::create_dir_all(root).expect("state root");
    let repo: PathBuf = repository(root, "repo");
    std::fs::write(repo.join("a.txt"), "a\n").expect("a");
    std::fs::write(repo.join("b.txt"), "b\n").expect("b");
    git(repo.as_path(), &["add", "a.txt", "b.txt"]);
    git(repo.as_path(), &["commit", "--quiet", "--message=base"]);
    std::fs::write(repo.join("a.txt"), "a-changed\n").expect("a changed");
    std::fs::write(repo.join("b.txt"), "b-changed\n").expect("b changed");
    std::fs::write(repo.join("u.txt"), "u\n").expect("untracked");
    if !stage.is_empty() {
        let mut arguments: Vec<&str> = vec!["add"];
        arguments.extend(stage.iter().copied());
        git(repo.as_path(), &arguments);
    }
    let base: String = git_text(repo.as_path(), &["rev-parse", "HEAD"]);
    let transaction: PathBuf = root.join("transaction");
    std::fs::create_dir(&transaction).expect("transaction");
    let indexes: CaptureIndexes = CaptureIndexes {
        captured_index: transaction.join("captured.index"),
        commit_index: transaction.join("commit.index"),
        object_directory: repo.join(".git").join("objects"),
    };
    return (repo, indexes, base);
}

/// Initializes the private index for one selection and returns the tree written from it.
fn native_tree(repo: &Path, indexes: &CaptureIndexes, choice: &IndexSelection) -> String {
    initialize_commit_index(&git_context(), repo, repo.join(".git").join("index").as_path(), indexes, choice)
        .expect("initialize");
    return write_private_tree(
        &git_context(),
        repo,
        indexes.commit_index.as_path(),
        indexes.object_directory.as_path(),
    )
    .expect("tree");
}

/// Explicit-path selections, with a pathspec, a newline pathspec file, a NUL pathspec file and stdin,
///  yield the incumbent's one-file tree, and the two-file selections yield the incumbent's two-file tree.
#[test]
fn private_index_trees_match_the_incumbent_for_each_selection() {
    let root: PathBuf = fixture("commit-index-incumbent-explicit");
    {
    let (repo, indexes, base) = differential_state(root.join("p").as_path(), &[]);
    let pathspecs: Vec<String> = vec![String::from("a.txt")];
    assert_eq!(
        native_tree(&repo, &indexes, &selection(TransactionMode::ExplicitPath, &pathspecs, &base)),
        INCUMBENT_ONE_FILE_TREE,
        "explicit-path"
    );
    }
    remove(root.as_path());
}

/// The index-mode and tracked-staging selections match the incumbent's trees.
#[test]
fn index_mode_trees_match_the_incumbent() {
    let root: PathBuf = fixture("commit-index-incumbent-index");
    let none: Vec<String> = Vec::new();

    {
    let (repo, indexes, base) = differential_state(root.join("plain").as_path(), &["a.txt"]);
    assert_eq!(
        native_tree(&repo, &indexes, &selection(TransactionMode::Index, &none, &base)),
        INCUMBENT_ONE_FILE_TREE,
        "index-plain"
    );

    }
    {
    let (repo, indexes, base) = differential_state(root.join("tracked").as_path(), &[]);
    let mut tracked: IndexSelection = selection(TransactionMode::Index, &none, &base);
    tracked.stage_tracked_changes = true;
    assert_eq!(native_tree(&repo, &indexes, &tracked), INCUMBENT_TWO_FILE_TREE, "tracked-all");

    }
    {
    let (repo, indexes, base) = differential_state(root.join("include").as_path(), &["a.txt"]);
    let include_paths: Vec<String> = vec![String::from("b.txt")];
    let mut include: IndexSelection = selection(TransactionMode::Index, &include_paths, &base);
    include.stage_into_index = true;
    assert_eq!(native_tree(&repo, &indexes, &include), INCUMBENT_TWO_FILE_TREE, "include");
    }
    remove(root.as_path());
}

/// Pathspec files in both record forms, and standard input, select the same paths the incumbent did.
#[test]
fn pathspec_file_trees_match_the_incumbent() {
    let root: PathBuf = fixture("commit-index-incumbent-files");
    let none: Vec<String> = Vec::new();

    {
    let (repo, indexes, base) = differential_state(root.join("newline").as_path(), &[]);
    let list: PathBuf = root.join("newline.list");
    std::fs::write(&list, "a.txt\n").expect("list");
    let mut newline: IndexSelection = selection(TransactionMode::ExplicitPath, &none, &base);
    newline.pathspec_file = Some(list.as_path());
    assert_eq!(native_tree(&repo, &indexes, &newline), INCUMBENT_ONE_FILE_TREE, "newline file");

    }
    {
    let (repo, indexes, base) = differential_state(root.join("nul").as_path(), &[]);
    let list: PathBuf = root.join("nul.list");
    std::fs::write(&list, b"a.txt\0b.txt\0").expect("nul list");
    let mut nul: IndexSelection = selection(TransactionMode::ExplicitPath, &none, &base);
    nul.pathspec_file = Some(list.as_path());
    nul.pathspec_file_nul = true;
    assert_eq!(native_tree(&repo, &indexes, &nul), INCUMBENT_TWO_FILE_TREE, "nul file");

    }
    {
    let (repo, indexes, base) = differential_state(root.join("stdin").as_path(), &[]);
    let mut input: &[u8] = b"a.txt\n";
    let stdin_path: PathBuf = materialize_pathspec_file(indexes.commit_index.parent().expect("transaction"), &repo, Some("-"), &mut input)
        .expect("stdin")
        .expect("path");
    let mut from_stdin: IndexSelection = selection(TransactionMode::ExplicitPath, &none, &base);
    from_stdin.pathspec_file = Some(stdin_path.as_path());
    assert_eq!(native_tree(&repo, &indexes, &from_stdin), INCUMBENT_ONE_FILE_TREE, "stdin");
    }
    remove(root.as_path());
}
