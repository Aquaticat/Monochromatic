//! What: Decision controls for one wrapper invocation against real Git 2.56.0.
//! Why: Inspection commands must be forwarded without reading configuration, every
//!      other command must validate configuration and then stop, and the management
//!      namespace must never reach Git. The invocations that stop before a Git is
//!      trusted are controlled in `entry_stop_tests.rs`.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // expect(planInvocation(['status'], env, inputs)).toEqual({ kind: 'forward', realGit: '/usr/bin/git', ... });
//! ```
#![cfg(unix)]

/// Import the decision under test and shared fixtures.
use super::{MANAGEMENT_COMMAND, plan_invocation};
use crate::action::{Action, ENGINE_FAILURE_EXIT_CODE};
use crate::child_environment::FORWARD_TARGET_VARIABLE;
use crate::config_file::CONFIG_FILE_NAME;
use crate::management_arguments::MANAGEMENT_HELP;
use crate::real_git::{Platform, ResolutionInputs};
use crate::test_support::{REAL_GIT, executable, fixture, remove, repository};
use std::ffi::OsString;
use std::path::{Path, PathBuf};

/// What: Inputs selecting the image's real Git, with a fixture file standing in for this wrapper.
/// Why: `pub(super)` lets the sibling stop controls in `entry_stop_tests.rs` reuse these helpers.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export function inputs(root: string): ResolutionInputs { /* ... */ }
/// ```
pub(super) fn inputs(root: &Path) -> ResolutionInputs {
    let own: PathBuf = root.join("own-wrapper");
    executable(own.as_path(), b"\x7fELF fixture wrapper");
    return ResolutionInputs {
        platform: Platform::Unix,
        path: OsString::from("/usr/bin"),
        path_extensions: OsString::new(),
        current_directory: root.to_path_buf(),
        common_paths: Vec::<PathBuf>::new(),
        own_executable: own,
    };
}

/// Build owned arguments from text.
pub(super) fn text(values: &[&str]) -> Vec<OsString> {
    let mut result: Vec<OsString> = Vec::<OsString>::new();
    for value in values {
        result.push(OsString::from(value));
    }
    return result;
}

/// Build `-C <directory> <rest...>` as owned arguments.
fn in_directory(directory: &Path, rest: &[&str]) -> Vec<OsString> {
    let mut result: Vec<OsString> =
        vec![OsString::from("-C"), directory.as_os_str().to_os_string()];
    result.extend(text(rest));
    return result;
}

/// The forward action every inspection command must produce in these fixtures.
pub(super) fn forward() -> Action {
    return Action::Forward {
        real_git: PathBuf::from(REAL_GIT),
        overlay: vec![
            (OsString::from("GIT_CONFIG_COUNT"), OsString::from("1")),
            (
                OsString::from("GIT_CONFIG_KEY_0"),
                OsString::from("core.lockfilePid"),
            ),
            (OsString::from("GIT_CONFIG_VALUE_0"), OsString::from("true")),
            (
                OsString::from(FORWARD_TARGET_VARIABLE),
                OsString::from(REAL_GIT),
            ),
        ],
    };
}

/// Return the stderr of a stop action with exit code 2 and empty stdout; a forward fails the test.
pub(super) fn stopped(action: Action) -> String {
    match action {
        Action::Exit {
            code,
            stdout,
            stderr,
        } => {
            assert_eq!(code, ENGINE_FAILURE_EXIT_CODE);
            assert_eq!(stdout, "", "wrapped commands report on standard error");
            return stderr;
        }
        Action::Forward { .. } => panic!("expected a stop action, got {action:?}"),
    }
}

/// The stop notice for one subcommand.
fn not_run(subcommand: &str) -> String {
    return format!(
        "cli-git: policy execution is not implemented in this native development executable, \
         so git {subcommand} was not run. Repository-changing commands still require the \
         installed cli-git.\n"
    );
}

/// Inspection commands, native queries, option errors and a bare `git` are forwarded unchanged.
#[test]
fn commands_needing_no_policy_are_forwarded() {
    let root: PathBuf = fixture("entry-forward");
    let resolution: ResolutionInputs = inputs(root.as_path());
    for arguments in [
        vec!["status"],
        vec!["--version"],
        vec!["-C", "/somewhere", "log", "--oneline"],
        vec!["branch", "--list"],
        vec!["--no-such-global-option", "commit"],
        vec!["-C"],
        vec![],
        vec!["--no-pager"],
        // The namespace word in any position but the subcommand is an ordinary argument.
        vec!["log", "cli-git"],
        vec!["-C", "cli-git", "status"],
        vec!["--help", "cli-git"],
    ] {
        assert_eq!(
            plan_invocation(text(arguments.as_slice()).as_slice(), &[], &resolution),
            forward(),
            "{arguments:?}"
        );
    }
    remove(root.as_path());
}

/// `git cli-git ...` is answered by the wrapper, also behind global options, and never forwarded.
#[test]
fn management_namespace_is_answered_by_the_wrapper() {
    let root: PathBuf = fixture("entry-management");
    let mut resolution: ResolutionInputs = inputs(root.as_path());
    // No Git on PATH: help must not need it.
    resolution.path = OsString::from("nothing-here");
    assert_eq!(MANAGEMENT_COMMAND, "cli-git");
    for arguments in [
        vec!["cli-git", "--help"],
        vec!["-C", "/somewhere", "-c", "a.b=c", "cli-git", "-h"],
        vec!["--no-pager", "cli-git", "--help"],
    ] {
        assert_eq!(
            plan_invocation(text(arguments.as_slice()).as_slice(), &[], &resolution),
            Action::Exit {
                code: 0,
                stdout: String::from(MANAGEMENT_HELP),
                stderr: String::new(),
            },
            "{arguments:?}"
        );
    }
    // The global prefix reaches the direct command: it selects the repository whose file is read.
    resolution.path = OsString::from("/usr/bin");
    let repo: PathBuf = repository(root.as_path(), "repo");
    std::fs::write(repo.join(CONFIG_FILE_NAME), r#"{ "unknown": 1 }"#).expect("invalid config");
    match plan_invocation(
        in_directory(repo.as_path(), &["cli-git", "check", "--all"]).as_slice(),
        &[],
        &resolution,
    ) {
        Action::Exit {
            code,
            stdout,
            stderr,
        } => {
            assert_eq!(code, 2);
            assert!(stdout.contains("\"code\":\"config-invalid\""), "{stdout}");
            assert!(
                stdout.contains("Unknown configuration key: unknown."),
                "{stdout}"
            );
            assert_eq!(stderr, "");
        }
        Action::Forward { .. } => panic!("the management namespace is never forwarded"),
    }
    remove(root.as_path());
}

/// An inspection command never reads repository configuration, even when it is invalid.
#[test]
fn inspection_commands_do_not_load_configuration() {
    let root: PathBuf = fixture("entry-skip-config");
    let repo: PathBuf = repository(root.as_path(), "repo");
    std::fs::write(repo.join(CONFIG_FILE_NAME), "not jsonc at all").expect("invalid config");
    std::fs::write(repo.join("cli-git.config.ts"), "throw 1;").expect("legacy config");
    let resolution: ResolutionInputs = inputs(root.as_path());
    assert_eq!(
        plan_invocation(
            in_directory(repo.as_path(), &["status"]).as_slice(),
            &[],
            &resolution
        ),
        forward()
    );
    // The same repository stops a configuration-requiring command on that invalid file.
    let message: String = stopped(plan_invocation(
        in_directory(repo.as_path(), &["add", "file"]).as_slice(),
        &[],
        &resolution,
    ));
    assert!(message.contains("JSONC syntax error"), "{message}");
    remove(root.as_path());
}

/// A configuration-requiring command validates configuration, then stops without running Git.
#[test]
fn policy_commands_stop_after_validating_configuration() {
    let root: PathBuf = fixture("entry-required");
    let repo: PathBuf = repository(root.as_path(), "repo");
    let resolution: ResolutionInputs = inputs(root.as_path());
    let arguments: Vec<OsString> = in_directory(repo.as_path(), &["add", "file"]);
    let source: PathBuf = repo.join(CONFIG_FILE_NAME);
    let legacy: PathBuf = repo.join("cli-git.config.ts");
    // No configuration file: unconfigured defaults apply.
    assert_eq!(
        stopped(plan_invocation(arguments.as_slice(), &[], &resolution)),
        not_run("add")
    );
    // A valid file is accepted.
    std::fs::write(&source, r#"{ "policies": { "final-newline": "error" } }"#)
        .expect("valid config");
    assert_eq!(
        stopped(plan_invocation(arguments.as_slice(), &[], &resolution)),
        not_run("add")
    );
    // A legacy file beside it is one warning event before the stop notice.
    std::fs::write(&legacy, "export default {};").expect("legacy config");
    assert_eq!(
        stopped(plan_invocation(arguments.as_slice(), &[], &resolution)),
        format!(
            "{{\"schemaVersion\":1,\"sequence\":0,\"type\":\"configuration-warning\",\"code\":\"legacy-config-ignored\",\"message\":\"Legacy configuration {legacy} is ignored: {jsonc} is authoritative for the native cli-git. Remove the legacy file once no TypeScript cli-git reads it.\",\"path\":\"{legacy}\"}}\n{stop}",
            legacy = legacy.display(),
            jsonc = source.display(),
            stop = not_run("add")
        )
    );
    // An invalid key is exactly one config-invalid event and no stop notice.
    std::fs::write(&source, r#"{ "policies": { "unknown": "off" } }"#).expect("invalid config");
    assert_eq!(
        stopped(plan_invocation(arguments.as_slice(), &[], &resolution)),
        format!(
            "{{\"schemaVersion\":1,\"sequence\":0,\"type\":\"engine-failure\",\"code\":\"config-invalid\",\"message\":\"{}: Unknown policy ID: unknown. Shipped policies: require-root, linked-worktree-only, branch-worktree-only, add-explicit, final-newline, markdown/autofix, mono/forbidden-root-context, mono/dependent-version-bump, security/forbidden-strings.\"}}\n",
            source.display()
        )
    );
    // A legacy file alone demands migration, as a config-invalid event.
    std::fs::remove_file(&source).expect("remove JSONC");
    let migration: String = stopped(plan_invocation(arguments.as_slice(), &[], &resolution));
    assert!(
        migration.starts_with(
            format!(
                "{{\"schemaVersion\":1,\"sequence\":0,\"type\":\"engine-failure\",\"code\":\"config-invalid\",\"message\":\"Legacy configuration {} is not executed or read by the native cli-git.",
                legacy.display()
            )
            .as_str()
        ),
        "{migration}"
    );
    assert!(migration.ends_with("\"}\n"), "{migration}");
    assert_eq!(migration.matches('\n').count(), 1);
    remove(root.as_path());
}

/// Outside a worktree there is no configuration file; the command still stops instead of running.
#[test]
fn policy_commands_outside_a_worktree_use_defaults() {
    let root: PathBuf = fixture("entry-outside");
    let resolution: ResolutionInputs = inputs(root.as_path());
    let plain: PathBuf = root.join("plain");
    std::fs::create_dir(&plain).expect("plain directory");
    // An invalid file outside any repository is never read.
    std::fs::write(plain.join(CONFIG_FILE_NAME), "invalid").expect("stray file");
    assert_eq!(
        stopped(plan_invocation(
            in_directory(plain.as_path(), &["init"]).as_slice(),
            &[],
            &resolution,
        )),
        not_run("init")
    );
    remove(root.as_path());
}
