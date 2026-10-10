//! Controls for native preparation: real state unchanged, the shadow seen by hooks,
//!  hook failures propagated with their exit code, and no shadow left behind.
//!
//!  The hook dispatcher is not built here, so every test passes a plain hooks directory
//!  and the incumbent's silenced events as the seam's values.

use super::*;
use crate::capture_invocation::{capture_invocation_base, capture_invocation_layout};
use crate::capture_order::CaptureIndexes;
use crate::commit_index::{IndexSelection, initialize_commit_index, write_private_tree};
use crate::shadow_create::create_shadow_repository;
use crate::test_support::{fixture, git, git_context, git_text, remove, repository};
use crate::transaction_journal::TransactionMode;
use crate::transaction_journal_parse::parse_prepared;
use std::path::PathBuf;

/// A fixed transaction ID of the shape the registry accepts.
const TRANSACTION: &str = "0b6c2c1e-6f5b-4d0e-9a55-3f5d8e2f6a10";

/// The incumbent's silenced hook events, supplied by the test stub of the hook seam.
const INCUMBENT_SILENCED_EVENTS: [&str; 4] = ["pre-commit", "prepare-commit-msg", "commit-msg", "post-commit"];

/// Everything one preparation fixture produced.
struct Fixture {
    /// Repository the transaction selects.
    repo: PathBuf,
    /// Shadow repository of the transaction.
    shadow: PathBuf,
    /// Transaction directory, which holds the journal and the hooks.
    transaction: PathBuf,
    /// Invocation capture.
    capture: InvocationCapture,
    /// Private commit index, staged for `a.txt` only.
    commit_index: PathBuf,
    /// Intended tree of the private index.
    intended_tree: String,
}

/// A repository with `a.txt` committed, the change to `a.txt` staged privately, and a shadow ready to prepare.
fn prepared_fixture(root: &Path, hook_script: Option<(&str, &str)>) -> Fixture {
    let repo: PathBuf = repository(root, "repo");
    std::fs::write(repo.join("a.txt"), "a\n").expect("a");
    git(repo.as_path(), &["add", "a.txt"]);
    git(repo.as_path(), &["commit", "--quiet", "--message=a"]);
    git(repo.as_path(), &["remote", "add", "origin", "https://example.invalid/repo.git"]);
    let base: String = git_text(repo.as_path(), &["rev-parse", "HEAD"]);
    git(repo.as_path(), &["update-ref", "refs/remotes/origin/main", base.as_str()]);
    git(repo.as_path(), &["config", "branch.main.remote", "origin"]);
    git(repo.as_path(), &["config", "branch.main.merge", "refs/heads/main"]);
    std::fs::write(repo.join(".git").join("branch.config"), "[x]\n\tv = onbranch\n").expect("include");
    std::fs::OpenOptions::new()
        .append(true)
        .open(repo.join(".git").join("config"))
        .and_then(|mut file| {
            use std::io::Write;
            file.write_all(b"[includeIf \"onbranch:main\"]\n\tpath = branch.config\n")
        })
        .expect("include config");
    std::fs::write(repo.join("a.txt"), "changed\n").expect("change a");
    let context = git_context();
    let layout = capture_invocation_layout(&context, repo.as_path(), false).expect("layout");
    let capture: InvocationCapture = capture_invocation_base(&context, repo.as_path(), layout).expect("capture");
    let transaction: PathBuf = root.join(format!("transaction-{TRANSACTION}"));
    std::fs::create_dir_all(&transaction).expect("transaction");
    let shadow: PathBuf = create_shadow_repository(&context, repo.as_path(), &capture, TRANSACTION, transaction.as_path())
        .expect("shadow");
    let indexes: CaptureIndexes = CaptureIndexes {
        captured_index: transaction.join("captured.index"),
        commit_index: transaction.join("commit.index"),
        object_directory: shadow.join("objects"),
    };
    let pathspecs: Vec<String> = vec![String::from("a.txt")];
    let selection: IndexSelection = IndexSelection {
        mode: TransactionMode::ExplicitPath,
        pathspecs: pathspecs.as_slice(),
        pathspec_file: None,
        pathspec_file_nul: false,
        stage_into_index: false,
        stage_tracked_changes: false,
        base_revision: base.as_str(),
    };
    initialize_commit_index(&context, repo.as_path(), capture.layout.real_index_path.as_path(), &indexes, &selection)
        .expect("private index");
    let intended_tree: String = write_private_tree(
        &context,
        repo.as_path(),
        indexes.commit_index.as_path(),
        indexes.object_directory.as_path(),
    )
    .expect("tree");
    let hooks_directory: PathBuf = transaction.join("hooks");
    std::fs::create_dir_all(&hooks_directory).expect("hooks");
    if let Some((name, script)) = hook_script {
        let path: PathBuf = hooks_directory.join(name);
        std::fs::write(&path, script).expect("hook");
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755)).expect("executable");
    }
    return Fixture {
        repo,
        shadow,
        transaction,
        capture,
        commit_index: indexes.commit_index,
        intended_tree,
    };
}

/// Runs the preparation of a fixture with the plain hooks directory and the incumbent's silenced events.
fn prepare(fixture: &Fixture, commit_args: &[&str]) -> Result<PreparedCommit, PreparationError> {
    let hooks: PreparationHooks = PreparationHooks {
        directory: fixture.transaction.join("hooks"),
        silenced_events: INCUMBENT_SILENCED_EVENTS.iter().map(|event| String::from(*event)).collect(),
    };
    let commit_arguments: Vec<String> = commit_args.iter().map(|arg| String::from(*arg)).collect();
    let request: PreparationRequest = PreparationRequest {
        capture: &fixture.capture,
        shadow: fixture.shadow.as_path(),
        hooks: &hooks,
        commit_index: fixture.commit_index.as_path(),
        global_args: &[],
        commit_args: commit_arguments.as_slice(),
    };
    return prepare_native_commit(
        &git_context(),
        fixture.repo.as_path(),
        &request,
        fixture.transaction.as_path(),
        fixture.intended_tree.as_str(),
        &PreparedPaths {
            committed_paths: vec![String::from("a.txt")],
            ..PreparedPaths::default()
        },
    );
}

/// Preparation leaves the real refs, the real index and the worktree bytes unchanged,
///  and the prepared commit lives in the shadow with its journal record.
#[test]
fn preparation_leaves_real_refs_index_and_worktree_unchanged() {
    let root: PathBuf = fixture("commit-preparation-success");
    let fixture: Fixture = prepared_fixture(root.as_path(), None);
    let refs_before: String = git_text(fixture.repo.as_path(), &["for-each-ref"]);
    let index_before: Vec<u8> = std::fs::read(fixture.repo.join(".git").join("index")).expect("index");
    let head_before: String = git_text(fixture.repo.as_path(), &["rev-parse", "HEAD"]);
    let prepared: PreparedCommit = prepare(&fixture, &["-m", "message"]).expect("prepared");
    assert_eq!(git_text(fixture.repo.as_path(), &["for-each-ref"]), refs_before);
    assert_eq!(git_text(fixture.repo.as_path(), &["rev-parse", "HEAD"]), head_before);
    assert_eq!(std::fs::read(fixture.repo.join(".git").join("index")).expect("index"), index_before);
    assert_eq!(std::fs::read_to_string(fixture.repo.join("a.txt")).expect("worktree"), "changed\n");
    assert_eq!(prepared.tree_oid, fixture.intended_tree);
    assert!(!prepared.signed);
    assert_eq!(
        git_text(fixture.shadow.as_path(), &["rev-parse", "HEAD"]),
        prepared.oid
    );
    let record: String = std::fs::read_to_string(fixture.transaction.join(PREPARED_FILENAME)).expect("prepared.json");
    let parsed = parse_prepared(record.as_bytes()).expect("parse");
    assert_eq!(parsed.prepared_oid, prepared.oid);
    assert_eq!(parsed.intended_tree_oid, fixture.intended_tree);
    assert_eq!(parsed.shadow_path, fixture.shadow.display().to_string());
    assert_eq!(parsed.committed_paths, vec![String::from("a.txt")]);
    remove(root.as_path());
}

/// A hook sees the shadow as the incumbent's hook sees it: `HEAD` at the base, the upstream,
///  the `onbranch:` include and the Git directory is the shadow itself.
#[cfg(unix)]
#[test]
fn a_hook_sees_the_shadow_head_upstream_include_and_git_dir() {
    let root: PathBuf = fixture("commit-preparation-hook-view");
    let out: PathBuf = root.join("out");
    std::fs::create_dir(&out).expect("out");
    let script: String = format!(
        "#!/bin/sh\n\
         git rev-parse HEAD > \"{o}/head\"\n\
         git rev-parse --abbrev-ref '@{{upstream}}' > \"{o}/upstream\"\n\
         git config --get x.v > \"{o}/onbranch\"\n\
         git rev-parse --git-dir > \"{o}/gitdir\"\n",
        o = out.display()
    );
    let fixture: Fixture = prepared_fixture(root.as_path(), Some(("pre-commit", script.as_str())));
    let base: String = git_text(fixture.repo.as_path(), &["rev-parse", "HEAD"]);
    prepare(&fixture, &["-m", "message"]).expect("prepared");
    assert_eq!(std::fs::read_to_string(out.join("head")).expect("head").trim(), base);
    assert_eq!(std::fs::read_to_string(out.join("upstream")).expect("upstream").trim(), "origin/main");
    assert_eq!(std::fs::read_to_string(out.join("onbranch")).expect("onbranch").trim(), "onbranch");
    assert_eq!(
        std::fs::read_to_string(out.join("gitdir")).expect("gitdir").trim(),
        fixture.shadow.display().to_string()
    );
    remove(root.as_path());
}

/// A failing `commit-msg` hook stops preparation with Git's exit code and leaves no shadow repository.
#[cfg(unix)]
#[test]
fn a_failing_commit_msg_hook_propagates_the_exit_code_and_removes_the_shadow() {
    let root: PathBuf = fixture("commit-preparation-hook-fails");
    let fixture: Fixture = prepared_fixture(root.as_path(), Some(("commit-msg", "#!/bin/sh\nexit 7\n")));
    let refs_before: String = git_text(fixture.repo.as_path(), &["for-each-ref"]);
    let error: PreparationError = prepare(&fixture, &["-m", "message"]).expect_err("hook fails");
    match error {
        PreparationError::NativeExit { exit_code } => assert_eq!(exit_code, 1),
        other => panic!("expected the native exit code, got {other}"),
    }
    assert!(!fixture.shadow.exists(), "the shadow must be removed");
    assert!(!fixture.transaction.join(PREPARED_FILENAME).exists());
    assert_eq!(git_text(fixture.repo.as_path(), &["for-each-ref"]), refs_before);
    remove(root.as_path());
}

/// A commit with nothing selected fails with Git's own nonzero code and leaves no shadow.
#[test]
fn a_nothing_to_commit_failure_removes_the_shadow() {
    let root: PathBuf = fixture("commit-preparation-nothing");
    let fixture: Fixture = prepared_fixture(root.as_path(), None);
    let commit_index_empty: PathBuf = fixture.transaction.join("empty.index");
    std::fs::copy(fixture.repo.join(".git").join("index"), &commit_index_empty).expect("index");
    let hooks: PreparationHooks = PreparationHooks {
        directory: fixture.transaction.join("hooks"),
        silenced_events: Vec::new(),
    };
    let commit_arguments: Vec<String> = vec![String::from("-m"), String::from("message")];
    let request: PreparationRequest = PreparationRequest {
        capture: &fixture.capture,
        shadow: fixture.shadow.as_path(),
        hooks: &hooks,
        commit_index: commit_index_empty.as_path(),
        global_args: &[],
        commit_args: commit_arguments.as_slice(),
    };
    let error: PreparationError = prepare_native_commit(
        &git_context(),
        fixture.repo.as_path(),
        &request,
        fixture.transaction.as_path(),
        fixture.intended_tree.as_str(),
        &PreparedPaths::default(),
    )
    .expect_err("nothing to commit");
    assert!(matches!(error, PreparationError::NativeExit { exit_code } if exit_code != 0));
    assert!(!fixture.shadow.exists());
    remove(root.as_path());
}

/// The native command names the shadow, the work tree and the hooks directory, and silences the commit events.
#[test]
fn native_commit_arguments_name_the_shadow_and_silence_the_hooks() {
    let capture_root: PathBuf = fixture("commit-preparation-arguments");
    let repo: PathBuf = repository(capture_root.as_path(), "repo");
    let context = git_context();
    let layout = capture_invocation_layout(&context, repo.as_path(), false).expect("layout");
    let capture: InvocationCapture = capture_invocation_base(&context, repo.as_path(), layout).expect("capture");
    let hooks: PreparationHooks = PreparationHooks {
        directory: PathBuf::from("/h"),
        silenced_events: vec![String::from("commit-msg")],
    };
    let commit_arguments: Vec<String> = vec![String::from("-m"), String::from("x")];
    let global: Vec<String> = vec![String::from("-c"), String::from("a.b=1")];
    let request: PreparationRequest = PreparationRequest {
        capture: &capture,
        shadow: Path::new("/s"),
        hooks: &hooks,
        commit_index: Path::new("/i"),
        global_args: global.as_slice(),
        commit_args: commit_arguments.as_slice(),
    };
    let work_tree: String = format!("--work-tree={}", capture.layout.repository_root.display());
    assert_eq!(
        native_commit_arguments(&request),
        vec![
            "-c",
            "a.b=1",
            "--git-dir=/s",
            work_tree.as_str(),
            "-c",
            "core.hooksPath=/h",
            "-c",
            "hook.commit-msg.enabled=false",
            "commit",
            "-m",
            "x",
        ]
    );
    remove(capture_root.as_path());
}

/// The prepared commit's signature is read from its header block only, not from the message.
#[test]
fn signature_is_read_from_the_header_block_only() {
    let root: PathBuf = fixture("commit-preparation-signed");
    let repo: PathBuf = repository(root.as_path(), "repo");
    let head: String = git_text(repo.as_path(), &["rev-parse", "HEAD"]);
    let shadow: PathBuf = root.join("shadow");
    std::fs::create_dir(&shadow).expect("shadow");
    git(&shadow, &["init", "--bare", "--quiet", "--template="]);
    std::fs::write(shadow.join("objects").join("info").join("alternates"), format!("{}\n", repo.join(".git").join("objects").display())).expect("alternates");
    git(&shadow, &["update-ref", "refs/heads/main", head.as_str()]);
    git(&shadow, &["symbolic-ref", "HEAD", "refs/heads/main"]);
    let prepared: PreparedCommit = read_prepared_commit(&git_context(), shadow.as_path()).expect("read");
    assert_eq!(prepared.oid, head);
    assert!(!prepared.signed);
    remove(root.as_path());
}
