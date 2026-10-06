//! Controls for the transaction Git runner against real Git.

use super::*;
use crate::test_support::{fixture, git_context, git_text, remove, repository};

/// Requests carry their arguments and nothing else by default.
#[test]
fn requests_start_empty() {
    let request: GitRequest = GitRequest::new(Path::new("/repo"), &["status", "--short"]);
    assert_eq!(request.cwd, PathBuf::from("/repo"));
    assert_eq!(
        request.arguments,
        vec![OsString::from("status"), OsString::from("--short")]
    );
    assert!(!request.without_prefix);
    assert_eq!(request.index, None);
    assert_eq!(request.object_directory, None);
    assert!(request.environment.is_empty());
    assert!(request.unset.is_empty());
    assert_eq!(request.input, None);
    assert_eq!(
        command_text(&[OsString::from("update-ref"), OsString::from("-d")]),
        "git update-ref -d"
    );
    assert_eq!(command_text(&[]), "git");
}

/// Output, exit codes and input reach the caller; failures name the command.
#[test]
fn runs_capture_output_and_feed_input() {
    let root: PathBuf = fixture("transaction-git-run");
    let repo: PathBuf = repository(root.as_path(), "repo");
    let context: GitContext = git_context();
    let mut hashing: GitRequest =
        GitRequest::new(repo.as_path(), &["hash-object", "-w", "--stdin"]);
    hashing.input = Some(b"content\n".to_vec());
    let hashed: GitOutput = run_git_checked(&context, &hashing).expect("hash-object");
    assert!(hashed.succeeded());
    assert_eq!(
        String::from_utf8_lossy(hashed.stdout.as_slice()).trim(),
        "d95f3ad14dee633a758d2e331151e950dd13e4ed"
    );
    // Large input never deadlocks against Git's output.
    let mut large: GitRequest = GitRequest::new(repo.as_path(), &["hash-object", "--stdin"]);
    large.input = Some(vec![b'x'; 4 * 1024 * 1024]);
    assert!(run_git_checked(&context, &large).is_ok());
    let missing: GitRequest = GitRequest::new(
        repo.as_path(),
        &["rev-parse", "--verify", "--quiet", "refs/heads/none"],
    );
    let output: GitOutput = run_git(&context, &missing).expect("rev-parse runs");
    assert_eq!(output.code, Some(1));
    assert!(!output.succeeded());
    let failure: GitFailure = run_git_checked(
        &context,
        &GitRequest::new(
            repo.as_path(),
            &["cat-file", "-t", "0000000000000000000000000000000000000001"],
        ),
    )
    .expect_err("missing object");
    assert!(
        failure
            .to_string()
            .starts_with("git cat-file -t 0000000000000000000000000000000000000001 failed: fatal:"),
        "{failure}"
    );
    let unstartable: GitContext = GitContext {
        real_git: root.join("no-git"),
        overlay: Vec::new(),
        global_prefix: Vec::new(),
    };
    let start: GitFailure =
        run_git_checked(&unstartable, &GitRequest::new(repo.as_path(), &["status"]))
            .expect_err("no Git");
    assert!(
        start.0.starts_with("git status could not start: "),
        "{start}"
    );
    remove(root.as_path());
}

/// The global prefix, the overlay, removals, additions, index and store reach Git in order.
#[test]
fn environment_and_prefix_reach_git() {
    let root: PathBuf = fixture("transaction-git-environment");
    let repo: PathBuf = repository(root.as_path(), "repo");
    let mut context: GitContext = git_context();
    context.global_prefix = vec![OsString::from("-c"), OsString::from("cli.probe=prefixed")];
    let prefixed: GitOutput = run_git_checked(
        &context,
        &GitRequest::new(repo.as_path(), &["config", "cli.probe"]),
    )
    .expect("prefix");
    assert_eq!(
        String::from_utf8_lossy(prefixed.stdout.as_slice()),
        "prefixed\n"
    );
    let mut bare: GitRequest = GitRequest::new(repo.as_path(), &["config", "cli.probe"]);
    bare.without_prefix = true;
    assert_eq!(run_git(&context, &bare).expect("unprefixed").code, Some(1));
    // `GIT_CONFIG_PARAMETERS` set by the overlay, then removed, then added back by the request.
    context.overlay.push((
        OsString::from("GIT_CONFIG_PARAMETERS"),
        OsString::from("'cli.probe'='overlay'"),
    ));
    let mut removed: GitRequest = GitRequest::new(repo.as_path(), &["config", "cli.probe"]);
    removed.without_prefix = true;
    removed.unset = vec![OsString::from("GIT_CONFIG_PARAMETERS")];
    assert_eq!(run_git(&context, &removed).expect("removed").code, Some(1));
    removed.environment = vec![(
        OsString::from("GIT_CONFIG_PARAMETERS"),
        OsString::from("'cli.probe'='request'"),
    )];
    let added: GitOutput = run_git_checked(&context, &removed).expect("added");
    assert_eq!(
        String::from_utf8_lossy(added.stdout.as_slice()),
        "request\n"
    );
    // A private index and object store receive the writes.
    let private_index: PathBuf = root.join("private.index");
    let store: PathBuf = root.join("objects");
    std::fs::create_dir(&store).expect("store");
    let mut update: GitRequest = GitRequest::new(
        repo.as_path(),
        &[
            "update-index",
            "--add",
            "--cacheinfo",
            "100644,d95f3ad14dee633a758d2e331151e950dd13e4ed,new.txt",
        ],
    );
    update.without_prefix = true;
    update.index = Some(private_index.clone());
    run_git_checked(&context, &update).expect("private index write");
    assert!(private_index.exists());
    assert_eq!(git_text(repo.as_path(), &["ls-files"]), "");
    let mut write: GitRequest = GitRequest::new(repo.as_path(), &["hash-object", "-w", "--stdin"]);
    write.without_prefix = true;
    write.object_directory = Some(store.clone());
    write.input = Some(b"private\n".to_vec());
    let written: GitOutput = run_git_checked(&context, &write).expect("private object");
    let oid: String = String::from_utf8_lossy(written.stdout.as_slice())
        .trim()
        .to_string();
    assert!(store.join(&oid[..2]).join(&oid[2..]).exists());
    let unknown: GitOutput = run_git(
        &context,
        &GitRequest::new(repo.as_path(), &["cat-file", "-e", oid.as_str()]),
    )
    .expect("cat-file runs");
    assert!(!unknown.succeeded());
    assert_eq!(unknown.error_text(), "");
    remove(root.as_path());
}

/// Error text is trimmed and lossily decoded.
#[test]
fn error_text_is_trimmed() {
    let output: GitOutput = GitOutput {
        code: Some(128),
        stdout: Vec::new(),
        stderr: b"  fatal: \xff broken \n".to_vec(),
    };
    assert_eq!(output.error_text(), "fatal: \u{fffd} broken");
    assert!(
        !GitOutput {
            code: None,
            stdout: Vec::new(),
            stderr: Vec::new()
        }
        .succeeded()
    );
}

/// Input files are private and already unlinked.
#[cfg(unix)]
#[test]
fn input_files_leave_nothing_behind() {
    use std::io::Read;
    use std::os::unix::fs::MetadataExt;
    let mut file: std::fs::File = input_file(b"bytes").expect("input file");
    let metadata: std::fs::Metadata = file.metadata().expect("metadata");
    assert_eq!(metadata.nlink(), 0);
    assert_eq!(metadata.mode() & 0o777, 0o600);
    let mut read: Vec<u8> = Vec::new();
    file.read_to_end(&mut read).expect("read");
    assert_eq!(read, b"bytes");
}
