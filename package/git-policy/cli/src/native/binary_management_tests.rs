//! What: `git cli-git` controls through the built executable.
//! Why: The management namespace belongs to the wrapper: help and retired commands
//!      answer without Git, malformed scopes exit 2, and nothing in the namespace is
//!      ever handed to real Git.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // expect(run(wrappedGit, ['cli-git', '--help'])).toMatchObject({ status: 0, stdout: HELP });
//! ```

/// Import the shared fixtures and bounded process helpers.
use super::support::{Fixture, Observed, bounded, fixture, observe, remove, repository, wrapped};
use std::ffi::{OsStr, OsString};
use std::path::{Path, PathBuf};

/// The only configuration file the native wrapper reads.
const CONFIG_FILE_NAME: &str = "cli-git.config.jsonc";

/// Run `git <arguments>` through the wrapper in a directory.
fn run(fixture: &Fixture, directory: &Path, arguments: &[&str]) -> Observed {
    return observe(wrapped(fixture).current_dir(directory).args(arguments), b"");
}

/// Standard error as text for message assertions.
fn stderr_text(observed: &Observed) -> String {
    return String::from_utf8_lossy(&observed.stderr).into_owned();
}

/// Standard output as text for message assertions.
fn stdout_text(observed: &Observed) -> String {
    return String::from_utf8_lossy(&observed.stdout).into_owned();
}

/// Help is printed on standard output with exit status 0, even when PATH holds no Git at all.
#[test]
fn help_needs_neither_git_nor_a_repository() {
    let fixture: Fixture = fixture("management-help");
    let only_wrapper: OsString = fixture.root.join("bin").into_os_string();
    for arguments in [
        vec!["cli-git", "--help"],
        vec!["-C", "/nonexistent", "cli-git", "-h"],
    ] {
        let observed: Observed = observe(
            bounded(
                &fixture,
                fixture.root.join("bin/git").as_path(),
                only_wrapper.as_os_str(),
            )
            .args(arguments.as_slice()),
            b"",
        );
        assert_eq!(observed.code, Some(0), "{arguments:?}");
        assert_eq!(observed.stderr, Vec::<u8>::new(), "{arguments:?}");
        let help: String = stdout_text(&observed);
        assert!(
            help.starts_with("Usage: git cli-git <command> [options]\n"),
            "{help}"
        );
        assert!(
            help.contains("  check    Check policies over an explicit scope.\n"),
            "{help}"
        );
        assert!(
            help.contains("  fix      Apply policy fixes over an explicit scope.\n"),
            "{help}"
        );
    }
    remove(&fixture);
}

/// Malformed invocations exit 2 with their remedy on standard error and nothing on standard output.
#[test]
fn malformed_invocations_exit_two() {
    let fixture: Fixture = fixture("management-refusals");
    let repo: PathBuf = repository(&fixture, OsStr::new("repo"));
    for (arguments, message) in [
        (
            vec!["cli-git", "check"],
            "git cli-git check requires exactly one scope: --all or non-empty pathspecs after --.\n",
        ),
        (
            vec!["cli-git", "check", "--all", "--", "a.txt"],
            "git cli-git check requires exactly one scope: --all or non-empty pathspecs after --.\n",
        ),
        (
            vec!["cli-git", "check", "a.txt"],
            "git cli-git check pathspecs must follow --.\n",
        ),
        (
            vec!["cli-git", "fix", "a.txt", "--all"],
            "git cli-git fix pathspecs must follow --.\n",
        ),
    ] {
        assert_eq!(
            run(&fixture, repo.as_path(), arguments.as_slice()),
            Observed {
                code: Some(2),
                stdout: Vec::<u8>::new(),
                stderr: message.as_bytes().to_vec(),
            },
            "{arguments:?}"
        );
    }
    for arguments in [
        vec!["cli-git"],
        vec!["cli-git", "unknown"],
        vec!["cli-git", "check", "--bogus", "--all"],
        vec!["cli-git", "check", "--policy"],
        vec!["cli-git", "--help", "extra"],
    ] {
        let observed: Observed = run(&fixture, repo.as_path(), arguments.as_slice());
        assert_eq!(observed.code, Some(2), "{arguments:?}");
        assert_eq!(observed.stdout, Vec::<u8>::new(), "{arguments:?}");
        assert!(
            stderr_text(&observed).starts_with(
                "Usage: git cli-git check (--all | -- <pathspec>...) [--policy <id>]...\n"
            ),
            "{arguments:?}"
        );
    }
    remove(&fixture);
}

/// Retired trust commands explain the retirement, exit 0, and neither read nor write trust records.
#[test]
fn retired_trust_commands_explain_and_change_nothing() {
    let fixture: Fixture = fixture("management-retired");
    let repo: PathBuf = repository(&fixture, OsStr::new("repo"));
    // A legacy executable configuration that would fail loudly if anything ran it.
    std::fs::write(repo.join("cli-git.config.mjs"), "process.exit(97);\n").expect("legacy");
    for (arguments, name) in [
        (vec!["cli-git", "trust"], "trust"),
        (vec!["cli-git", "trust", "--yes"], "trust"),
        (vec!["cli-git", "untrust"], "untrust"),
        (vec!["cli-git", "status"], "status"),
    ] {
        let observed: Observed = run(&fixture, repo.as_path(), arguments.as_slice());
        assert_eq!(
            observed,
            Observed {
                code: Some(0),
                stdout: Vec::<u8>::new(),
                stderr: format!(
                    "git cli-git {name} is retired. cli-git now reads cli-git.config.jsonc as \
                     data and runs no repository-supplied code, so there is no code execution to \
                     approve, revoke or report. Nothing was changed; existing trust records are \
                     left in place and are no longer read.\n"
                )
                .into_bytes(),
            },
            "{arguments:?}"
        );
    }
    let help: Observed = run(&fixture, repo.as_path(), &["cli-git", "trust", "--help"]);
    assert_eq!(help.code, Some(0));
    assert_eq!(help.stderr, Vec::<u8>::new());
    assert!(stdout_text(&help).starts_with("git cli-git trust is retired."));
    // The fixture home, where a trust registry would live, is still empty.
    assert_eq!(
        std::fs::read_dir(fixture.root.join("home"))
            .expect("fixture home")
            .count(),
        0
    );
    remove(&fixture);
}

/// A direct command reports configuration problems as events on standard output and never runs Git on the repository.
#[test]
fn direct_commands_validate_then_stop() {
    let fixture: Fixture = fixture("management-direct");
    let repo: PathBuf = repository(&fixture, OsStr::new("repo"));
    std::fs::write(repo.join("file.txt"), b"no final newline").expect("file");
    let stop: &str = "cli-git: policy execution is not implemented in this native development \
                      executable, so git cli-git check was not run. Repository-changing commands \
                      still require the installed cli-git.\n";
    // Well-formed, from another directory through the global prefix.
    let repo_text: String = repo.to_string_lossy().into_owned();
    for arguments in [
        vec!["-C", repo_text.as_str(), "cli-git", "check", "--all"],
        vec![
            "-C",
            repo_text.as_str(),
            "cli-git",
            "check",
            "--policy",
            "final-newline",
            "--",
            "file.txt",
        ],
    ] {
        assert_eq!(
            run(&fixture, fixture.root.as_path(), arguments.as_slice()),
            Observed {
                code: Some(2),
                stdout: Vec::<u8>::new(),
                stderr: stop.as_bytes().to_vec(),
            },
            "{arguments:?}"
        );
    }
    // An unknown selected policy: one config-invalid event on standard output.
    let unknown: Observed = run(
        &fixture,
        repo.as_path(),
        &["cli-git", "check", "--all", "--policy", "no-such-policy"],
    );
    assert_eq!(unknown.code, Some(2));
    assert_eq!(unknown.stderr, Vec::<u8>::new());
    assert!(
        stdout_text(&unknown).starts_with(
            "{\"schemaVersion\":1,\"sequence\":0,\"type\":\"engine-failure\",\"code\":\"config-invalid\",\"message\":\"Unknown policy ID: no-such-policy. Shipped policies: require-root, "
        ),
        "{}",
        stdout_text(&unknown)
    );
    assert_eq!(stdout_text(&unknown).matches('\n').count(), 1);
    // Invalid repository configuration: the same event shape, naming the file and key.
    let source: PathBuf = repo.join(CONFIG_FILE_NAME);
    std::fs::write(&source, r#"{ "plugins": {} }"#).expect("invalid config");
    let invalid: Observed = run(&fixture, repo.as_path(), &["cli-git", "fix", "--all"]);
    assert_eq!(invalid.code, Some(2));
    assert_eq!(invalid.stderr, Vec::<u8>::new());
    assert!(
        stdout_text(&invalid).starts_with(
            format!(
                "{{\"schemaVersion\":1,\"sequence\":0,\"type\":\"engine-failure\",\"code\":\"config-invalid\",\"message\":\"{}: Configuration key plugins is retired",
                source.display()
            )
            .as_str()
        ),
        "{}",
        stdout_text(&invalid)
    );
    // `fix` changed nothing.
    assert_eq!(
        std::fs::read(repo.join("file.txt")).expect("file"),
        b"no final newline"
    );
    remove(&fixture);
}

/// The namespace word is only a command in the subcommand position; elsewhere it is an ordinary argument.
#[test]
fn namespace_word_elsewhere_is_an_ordinary_argument() {
    let fixture: Fixture = fixture("management-word");
    let repo: PathBuf = repository(&fixture, OsStr::new("repo"));
    std::fs::write(repo.join("cli-git"), b"a file named like the namespace\n").expect("file");
    // `git add cli-git` is an `add`, stopped as every repository-changing command is.
    let add: Observed = run(&fixture, repo.as_path(), &["add", "cli-git"]);
    assert_eq!(add.code, Some(2));
    assert!(
        stderr_text(&add).contains("so git add was not run"),
        "{}",
        stderr_text(&add)
    );
    // An inspection command naming the file is forwarded to Git unchanged.
    let listed: Observed = run(
        &fixture,
        repo.as_path(),
        &["ls-files", "--others", "--", "cli-git"],
    );
    assert_eq!(
        listed,
        Observed {
            code: Some(0),
            stdout: b"cli-git\n".to_vec(),
            stderr: Vec::<u8>::new(),
        }
    );
    remove(&fixture);
}
