//! What:
//!  Event paths of a file whose name is not UTF-8 through a landed `git commit`,
//!  `git add` at `error` severity and a replay conflict,
//!  through the built executable.
//! Why:
//!  The reader of an event relies on "no `pathBytes` means `path` is the exact name",
//!  so every event on the commit path that names a file must carry the exact bytes of a name that is not UTF-8,
//!  and a commit must not stop only because a repository holds such a name.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // const event = JSON.parse(stderr); expect(Buffer.from(event.pathBytes, 'base64')).toEqual(name);
//! ```

/// Import the shared fixtures and the commit controls' helpers.
use super::commit::{
    COMMIT_BOUND_SECONDS, assert_nothing_left, await_marker, git_text, keep_maintenance_in_the_foreground,
    remove_settled,
};
use super::support::{Fixture, Observed, bounded_for, fixture, git, observe, porcelain, repository, stderr_of, wrapper_first_path};
use std::ffi::{OsStr, OsString};
use std::os::unix::ffi::OsStringExt;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};

/// A name that is not UTF-8:
///  `bad`,
///  the byte 0xFF,
///  `.txt`.
const BAD_NAME: &[u8] = b"bad\xff.txt";

/// `BAD_NAME` as the event's readable `path`.
const BAD_TEXT: &str = "bad\u{fffd}.txt";

/// `BAD_NAME` as the event's `pathBytes`,
///  the output of `base64`.
const BAD_BYTES: &str = "YmFk/y50eHQ=";

/// The name as an operating-system string for arguments and file creation.
fn bad_name() -> OsString {
    return OsString::from_vec(BAD_NAME.to_vec());
}

/// A wrapped command with the commit bound,
///  taking operating-system string arguments.
fn wrapped_os(fixture: &Fixture, directory: &Path, arguments: &[OsString]) -> Command {
    let mut command: Command = bounded_for(
        fixture,
        fixture.root.join("bin/git").as_path(),
        wrapper_first_path(fixture).as_os_str(),
        COMMIT_BOUND_SECONDS,
    );
    command.current_dir(directory).args(arguments);
    return command;
}

/// Run one wrapped command to its end.
fn run_os(fixture: &Fixture, directory: &Path, arguments: &[OsString]) -> Observed {
    return observe(&mut wrapped_os(fixture, directory, arguments), b"");
}

/// Operating-system string arguments from literals and one name.
fn commit_arguments(extra: &[&str], name: &OsStr) -> Vec<OsString> {
    let mut arguments: Vec<OsString> = vec![OsString::from("commit")];
    arguments.extend(extra.iter().map(|argument| { return OsString::from(argument); }));
    arguments.push(OsString::from("--"));
    arguments.push(name.to_os_string());
    return arguments;
}

/// A repository holding one commit and the configuration text,
///  when the control needs one.
fn configured(fixture: &Fixture, configuration: Option<&str>) -> PathBuf {
    let repo: PathBuf = repository(fixture, OsStr::new("repo"));
    keep_maintenance_in_the_foreground(fixture, repo.as_path());
    if let Some(text) = configuration {
        std::fs::write(repo.join("cli-git.config.jsonc"), text).expect("repository configuration");
    }
    return repo;
}

/// The names `git ls-tree -z --name-only HEAD` lists,
///  as exact bytes.
fn committed_names(fixture: &Fixture, repo: &Path) -> Vec<Vec<u8>> {
    let listing: Vec<u8> = git(fixture, repo, &["ls-tree", "-z", "--name-only", "HEAD"]).stdout;
    return listing
        .split(|byte| { return *byte == 0; })
        .filter(|name| { return !name.is_empty(); })
        .map(<[u8]>::to_vec)
        .collect();
}

/// A commit of a name that is not UTF-8 lands it with its exact bytes and prints nothing,
///  with the file alone or beside a tracked name that is not UTF-8.
#[test]
fn a_commit_of_a_name_that_is_not_utf8_lands_with_its_exact_bytes() {
    let fixture: Fixture = fixture("event-path-commit-clean");
    let repo: PathBuf = configured(&fixture, None);
    std::fs::write(repo.join(bad_name()), b"fine\n").expect("file");
    let landed: Observed = run_os(&fixture, repo.as_path(), &commit_arguments(&["--message=bad"], bad_name().as_os_str()));
    assert_eq!(
        (landed.code, stderr_of(&landed)),
        (Some(0), String::new())
    );
    assert_eq!(committed_names(&fixture, repo.as_path()), vec![BAD_NAME.to_vec()]);
    assert_eq!(porcelain(&fixture, repo.as_path()), "");
    assert_nothing_left(&fixture, repo.as_path());
    // The name is now tracked in the base; a commit of another file must still land.
    std::fs::write(repo.join("other.txt"), b"fine\n").expect("other");
    let other: Observed = run_os(&fixture, repo.as_path(), &commit_arguments(&["--message=other"], OsStr::new("other.txt")));
    assert_eq!((other.code, stderr_of(&other)), (Some(0), String::new()));
    assert_eq!(
        committed_names(&fixture, repo.as_path()),
        vec![BAD_NAME.to_vec(), b"other.txt".to_vec()]
    );
    assert_nothing_left(&fixture, repo.as_path());
    remove_settled(&fixture);
}

/// An untracked name that is not UTF-8 beside a committed file does not stop the commit.
#[test]
fn an_untracked_name_that_is_not_utf8_does_not_stop_a_commit() {
    let fixture: Fixture = fixture("event-path-commit-untracked");
    let repo: PathBuf = configured(&fixture, None);
    std::fs::write(repo.join(bad_name()), b"left alone\n").expect("untracked file");
    std::fs::write(repo.join("a.txt"), b"one\n").expect("a");
    let landed: Observed = run_os(&fixture, repo.as_path(), &commit_arguments(&["--message=a"], OsStr::new("a.txt")));
    assert_eq!((landed.code, stderr_of(&landed)), (Some(0), String::new()));
    assert_eq!(committed_names(&fixture, repo.as_path()), vec![b"a.txt".to_vec()]);
    assert_nothing_left(&fixture, repo.as_path());
    remove_settled(&fixture);
}

/// A correction on a name that is not UTF-8 lands in the commit and the worktree,
///  and the summary lists the exact bytes.
#[test]
fn a_commit_correction_of_a_name_that_is_not_utf8_reports_the_exact_bytes() {
    let fixture: Fixture = fixture("event-path-commit-fix");
    let repo: PathBuf = configured(&fixture, None);
    std::fs::write(repo.join(bad_name()), b"no newline").expect("file");
    let landed: Observed = run_os(&fixture, repo.as_path(), &commit_arguments(&["--message=bad"], bad_name().as_os_str()));
    assert_eq!(
        (landed.code, stderr_of(&landed)),
        (
            Some(0),
            format!(
                "{{\"schemaVersion\":1,\"sequence\":0,\"type\":\"fix-summary\",\"trigger\":\"pre-forward\",\
                 \"passes\":1,\"changedPaths\":[\"{BAD_TEXT}\"],\"changedPathBytes\":[\"{BAD_BYTES}\"]}}\n"
            )
        )
    );
    assert_eq!(committed_names(&fixture, repo.as_path()), vec![BAD_NAME.to_vec()]);
    assert_eq!(std::fs::read(repo.join(bad_name())).expect("worktree copy"), b"no newline\n");
    assert_nothing_left(&fixture, repo.as_path());
    remove_settled(&fixture);
}

/// A dry run at `error` severity reports the finding with the exact bytes and exits 1.
#[test]
fn a_blocking_commit_finding_names_the_exact_bytes() {
    let fixture: Fixture = fixture("event-path-commit-blocked");
    let repo: PathBuf = configured(&fixture, Some("{ \"policies\": { \"final-newline\": \"error\" } }\n"));
    std::fs::write(repo.join(bad_name()), b"no newline").expect("file");
    let blocked: Observed = run_os(
        &fixture,
        repo.as_path(),
        &commit_arguments(&["--dry-run", "--message=bad"], bad_name().as_os_str()),
    );
    assert_eq!(
        (blocked.code, stderr_of(&blocked)),
        (
            Some(1),
            format!(
                "{{\"schemaVersion\":1,\"sequence\":0,\"type\":\"finding\",\"trigger\":\"pre-forward\",\
                 \"policyId\":\"final-newline\",\"severity\":\"error\",\
                 \"code\":\"final-newline/noncanonical-final-newline\",\
                 \"message\":\"Non-empty text file must end with exactly one LF byte.\",\
                 \"path\":\"{BAD_TEXT}\",\"pathBytes\":\"{BAD_BYTES}\",\"fix\":\"available\"}}\n"
            )
        )
    );
    remove_settled(&fixture);
}

/// `git add` at `error` severity stops with the exact bytes and stages nothing.
#[test]
fn an_add_blocked_at_error_severity_names_the_exact_bytes() {
    let fixture: Fixture = fixture("event-path-add-blocked");
    let repo: PathBuf = configured(&fixture, Some("{ \"policies\": { \"final-newline\": \"error\" } }\n"));
    std::fs::write(repo.join(bad_name()), b"no newline").expect("file");
    let blocked: Observed = run_os(
        &fixture,
        repo.as_path(),
        &[OsString::from("add"), OsString::from("--"), bad_name()],
    );
    assert_eq!(
        (blocked.code, stderr_of(&blocked)),
        (
            Some(1),
            format!(
                "{{\"schemaVersion\":1,\"sequence\":0,\"type\":\"finding\",\"trigger\":\"pre-forward\",\
                 \"policyId\":\"final-newline\",\"severity\":\"error\",\
                 \"code\":\"final-newline/noncanonical-final-newline\",\
                 \"message\":\"Non-empty text file must end with exactly one LF byte.\",\
                 \"path\":\"{BAD_TEXT}\",\"pathBytes\":\"{BAD_BYTES}\",\"fix\":\"none\"}}\n"
            )
        )
    );
    assert_eq!(git(&fixture, repo.as_path(), &["ls-files", "-z"]).stdout, Vec::<u8>::new());
    remove_settled(&fixture);
}

/// A replay conflict on a name that is not UTF-8 lists the readable names and a parallel list of the exact bytes.
#[test]
fn a_replay_conflict_on_a_name_that_is_not_utf8_lists_the_exact_bytes() {
    let fixture: Fixture = fixture("event-path-conflict");
    let repo: PathBuf = configured(&fixture, None);
    std::fs::write(repo.join(bad_name()), b"one\n").expect("base file");
    git(&fixture, repo.as_path(), &["add", "--all"]);
    git(&fixture, repo.as_path(), &["commit", "--quiet", "--message=base"]);
    std::fs::write(repo.join(bad_name()), b"one\ntwo\n").expect("edit");
    let markers: PathBuf = fixture.root.join("markers");
    std::fs::create_dir(&markers).expect("marker directory");
    let slow: Child = wrapped_os(&fixture, repo.as_path(), &commit_arguments(&["--message=slow"], bad_name().as_os_str()))
        .env("CLI_GIT_TEST_ONLY_PHASE_SIGNAL", format!("preparation-done:pause:{}", markers.display()))
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .expect("the slow commit starts");
    await_marker(markers.join("preparation-done.reached").as_path());
    std::fs::write(repo.join(bad_name()), b"other\n").expect("winner edit");
    git(&fixture, repo.as_path(), &["add", "--all"]);
    git(&fixture, repo.as_path(), &["commit", "--quiet", "--message=winner"]);
    let winning: String = git_text(&fixture, repo.as_path(), &["rev-parse", "HEAD"]);
    std::fs::write(markers.join("preparation-done.release"), b"").expect("release the slow commit");
    let finished = slow.wait_with_output().expect("the slow commit ends");
    let stderr: String = String::from_utf8_lossy(finished.stderr.as_slice()).into_owned();
    assert_eq!(finished.status.code(), Some(1), "{stderr}");
    assert!(stderr.contains("\"code\":\"concurrent-commit/replay-conflict\""), "{stderr}");
    assert!(stderr.contains(format!("\"paths\":[\"{BAD_TEXT}\"],\"pathsBytes\":[\"{BAD_BYTES}\"]").as_str()), "{stderr}");
    assert_eq!(git_text(&fixture, repo.as_path(), &["rev-parse", "HEAD"]).trim(), winning.trim());
    remove_settled(&fixture);
}

/// Names that are UTF-8 keep their old shape:
///  a backslash is escaped by JSON only,
///  and a name holding the replacement character itself, correctly encoded, gets no `pathBytes`.
#[test]
fn names_that_are_utf8_keep_the_old_shape() {
    let fixture: Fixture = fixture("event-path-utf8");
    let repo: PathBuf = configured(&fixture, None);
    let replacement: OsString = OsString::from("caf\u{fffd}.txt");
    for name in [OsString::from("a\\b.txt"), replacement.clone()] {
        std::fs::write(repo.join(&name), b"no newline").expect("file");
    }
    let added: Observed = run_os(
        &fixture,
        repo.as_path(),
        &[OsString::from("add"), OsString::from("--"), OsString::from("a\\b.txt"), replacement],
    );
    let line = |name: &str, sequence: u64| -> String {
        return format!(
            "{{\"schemaVersion\":1,\"sequence\":{sequence},\"type\":\"finding\",\"trigger\":\"pre-forward\",\
             \"policyId\":\"final-newline\",\"severity\":\"warn\",\
             \"code\":\"final-newline/noncanonical-final-newline\",\
             \"message\":\"Non-empty text file must end with exactly one LF byte.\",\
             \"path\":\"{name}\",\"fix\":\"none\"}}\n"
        );
    };
    assert_eq!(
        (added.code, stderr_of(&added)),
        (Some(0), format!("{}{}", line("a\\\\b.txt", 0), line("caf\u{fffd}.txt", 1)))
    );
    git(&fixture, repo.as_path(), &["reset", "--quiet"]);
    let committed: Observed = run_os(
        &fixture,
        repo.as_path(),
        &[
            OsString::from("commit"),
            OsString::from("--message=utf-8"),
            OsString::from("--"),
            OsString::from("a\\b.txt"),
            OsString::from("caf\u{fffd}.txt"),
        ],
    );
    assert_eq!(
        (committed.code, stderr_of(&committed)),
        (
            Some(0),
            "{\"schemaVersion\":1,\"sequence\":0,\"type\":\"fix-summary\",\"trigger\":\"pre-forward\",\"passes\":1,\
             \"changedPaths\":[\"a\\\\b.txt\",\"caf\u{fffd}.txt\"]}\n"
                .to_string()
        )
    );
    assert_nothing_left(&fixture, repo.as_path());
    remove_settled(&fixture);
}
