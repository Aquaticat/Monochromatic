//! What: Decision controls for `git cli-git` against real Git 2.56.0.
//! Why: Help and retired commands must answer without Git or a repository; direct
//!      commands must reject unknown policies and invalid configuration on standard
//!      output with exit status 2, and must not run until policies exist.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // expect(planManagement(['--help'], [], env, inputs)).toEqual({ kind: 'exit', code: 0, stdout: HELP, stderr: '' });
//! ```
#![cfg(unix)]

/// Import the decision under test and shared fixtures.
use super::{plan_management, retired_explanation};
use crate::action::Action;
use crate::config_file::CONFIG_FILE_NAME;
use crate::management_arguments::{MANAGEMENT_HELP, MANAGEMENT_USAGE, RetiredCommand};
use crate::real_git::{Platform, ResolutionInputs};
use crate::test_support::{executable, fixture, remove, repository};
use std::ffi::OsString;
use std::path::{Path, PathBuf};

/// Inputs whose PATH holds nothing: any attempt to resolve Git fails visibly.
fn no_git(root: &Path) -> ResolutionInputs {
    return ResolutionInputs {
        platform: Platform::Unix,
        path: OsString::from("empty-directory"),
        path_extensions: OsString::new(),
        current_directory: root.to_path_buf(),
        common_paths: Vec::<PathBuf>::new(),
        own_executable: root.join("own-wrapper"),
    };
}

/// Inputs selecting the image's real Git.
fn with_git(root: &Path) -> ResolutionInputs {
    let own: PathBuf = root.join("own-wrapper");
    executable(own.as_path(), b"\x7fELF fixture wrapper");
    let mut inputs: ResolutionInputs = no_git(root);
    inputs.path = OsString::from("/usr/bin");
    inputs.own_executable = own;
    return inputs;
}

/// Plan management text arguments with `-C <directory>` as the Git global prefix.
fn plan(values: &[&str], directory: &Path, inputs: &ResolutionInputs) -> Action {
    let mut arguments: Vec<OsString> = Vec::<OsString>::new();
    for value in values {
        arguments.push(OsString::from(value));
    }
    let global: Vec<OsString> = vec![OsString::from("-C"), directory.as_os_str().to_os_string()];
    return plan_management(arguments.as_slice(), global.as_slice(), &[], inputs);
}

/// Build the expected stop action.
fn exit(code: i32, stdout: &str, stderr: &str) -> Action {
    return Action::Exit {
        code,
        stdout: String::from(stdout),
        stderr: String::from(stderr),
    };
}

/// The stop notice of a direct command.
fn stopped(command: &str) -> String {
    return format!(
        "cli-git: policy execution is not implemented in this native development \
         executable, so git cli-git {command} was not run. Repository-changing commands \
         still require the installed cli-git.\n"
    );
}

/// Help, usage refusals and scope refusals answer without resolving Git.
#[test]
fn help_and_refusals_need_no_git() {
    let root: PathBuf = fixture("management-no-git");
    let inputs: ResolutionInputs = no_git(root.as_path());
    assert_eq!(
        plan(&["--help"], root.as_path(), &inputs),
        exit(0, MANAGEMENT_HELP, "")
    );
    assert_eq!(
        plan(&["-h"], root.as_path(), &inputs),
        exit(0, MANAGEMENT_HELP, "")
    );
    for arguments in [
        vec![],
        vec!["unknown"],
        vec!["check", "--bogus"],
        vec!["--help", "x"],
    ] {
        assert_eq!(
            plan(arguments.as_slice(), root.as_path(), &inputs),
            exit(2, "", MANAGEMENT_USAGE),
            "{arguments:?}"
        );
    }
    assert_eq!(
        plan(&["check", "a.txt"], root.as_path(), &inputs),
        exit(2, "", "git cli-git check pathspecs must follow --.\n")
    );
    assert_eq!(
        plan(&["fix", "a.txt"], root.as_path(), &inputs),
        exit(2, "", "git cli-git fix pathspecs must follow --.\n")
    );
    assert_eq!(
        plan(&["check"], root.as_path(), &inputs),
        exit(
            2,
            "",
            "git cli-git check requires exactly one scope: --all or non-empty pathspecs after --.\n"
        )
    );
    assert_eq!(
        plan(&["fix", "--all", "--", "a.txt"], root.as_path(), &inputs),
        exit(
            2,
            "",
            "git cli-git fix requires exactly one scope: --all or non-empty pathspecs after --.\n"
        )
    );
    remove(root.as_path());
}

/// Retired trust commands explain the retirement with exit status 0 and need no Git.
#[test]
fn retired_commands_explain_and_succeed() {
    let root: PathBuf = fixture("management-retired");
    let inputs: ResolutionInputs = no_git(root.as_path());
    for (arguments, name, command) in [
        (vec!["trust"], "trust", RetiredCommand::Trust),
        (vec!["trust", "--yes"], "trust", RetiredCommand::Trust),
        (vec!["untrust"], "untrust", RetiredCommand::Untrust),
        (vec!["status"], "status", RetiredCommand::Status),
    ] {
        let explanation: String = format!(
            "git cli-git {name} is retired. cli-git now reads cli-git.config.jsonc as data and \
             runs no repository-supplied code, so there is no code execution to approve, revoke \
             or report. Nothing was changed; existing trust records are left in place and are no \
             longer read.\n"
        );
        assert_eq!(retired_explanation(command), explanation);
        assert_eq!(
            plan(arguments.as_slice(), root.as_path(), &inputs),
            exit(0, "", explanation.as_str()),
            "{arguments:?}"
        );
    }
    // Help for the retired command goes to standard output.
    assert_eq!(
        plan(&["trust", "--help"], root.as_path(), &inputs),
        exit(0, retired_explanation(RetiredCommand::Trust).as_str(), "")
    );
    remove(root.as_path());
}

/// An unknown selected policy is a `config-invalid` event on standard output before Git is resolved.
#[test]
fn unknown_selected_policy_is_reported_on_stdout() {
    let root: PathBuf = fixture("management-unknown-policy");
    let inputs: ResolutionInputs = no_git(root.as_path());
    for (arguments, id) in [
        (
            vec![
                "check",
                "--all",
                "--policy",
                "final-newline",
                "--policy",
                "nope",
            ],
            "nope",
        ),
        (
            vec!["fix", "--policy=security/forbidden-string", "--", "a"],
            "security/forbidden-string",
        ),
        (vec!["check", "--all", "--policy="], ""),
        (vec!["check", "--all", "--policy", "a\"b"], "a\\\"b"),
    ] {
        assert_eq!(
            plan(arguments.as_slice(), root.as_path(), &inputs),
            exit(
                2,
                format!(
                    "{{\"schemaVersion\":1,\"sequence\":0,\"type\":\"engine-failure\",\"code\":\"config-invalid\",\"message\":\"Unknown policy ID: {id}. Shipped policies: require-root, linked-worktree-only, branch-worktree-only, add-explicit, final-newline, markdown/autofix, mono/forbidden-root-context, mono/dependent-version-bump, security/forbidden-strings.\"}}\n"
                )
                .as_str(),
                ""
            ),
            "{arguments:?}"
        );
    }
    remove(root.as_path());
}

/// A well-formed direct command resolves Git, validates configuration, then stops.
#[test]
fn direct_commands_validate_configuration_then_stop() {
    let root: PathBuf = fixture("management-direct");
    let repo: PathBuf = repository(root.as_path(), "repo");
    let inputs: ResolutionInputs = with_git(root.as_path());
    assert_eq!(
        plan(&["check", "--all"], repo.as_path(), &inputs),
        exit(2, "", stopped("check").as_str())
    );
    assert_eq!(
        plan(
            &[
                "fix",
                "--policy",
                "final-newline",
                "--policy",
                "security/forbidden-strings",
                "--",
                "a.txt"
            ],
            repo.as_path(),
            &inputs
        ),
        exit(2, "", stopped("fix").as_str())
    );
    // Outside a repository there is no configuration to reject.
    assert_eq!(
        plan(&["check", "--all"], root.as_path(), &inputs),
        exit(2, "", stopped("check").as_str())
    );
    // Invalid configuration is an event on standard output, with no stop notice.
    let source: PathBuf = repo.join(CONFIG_FILE_NAME);
    std::fs::write(&source, r#"{ "trust": { "children": true } }"#).expect("invalid config");
    assert_eq!(
        plan(&["check", "--all"], repo.as_path(), &inputs),
        exit(
            2,
            format!(
                "{{\"schemaVersion\":1,\"sequence\":0,\"type\":\"engine-failure\",\"code\":\"config-invalid\",\"message\":\"{}: Configuration key trust is retired: JSONC configuration is data and needs no code-execution approval. Remove the key.\"}}\n",
                source.display()
            )
            .as_str(),
            ""
        )
    );
    // A legacy file beside valid configuration is a warning event on standard output.
    std::fs::write(&source, "{}").expect("valid config");
    std::fs::write(repo.join("cli-git.config.ts"), "export default {};").expect("legacy config");
    assert_eq!(
        plan(&["fix", "--all"], repo.as_path(), &inputs),
        exit(
            2,
            format!(
                "{{\"schemaVersion\":1,\"sequence\":0,\"type\":\"configuration-warning\",\"code\":\"legacy-config-ignored\",\"message\":\"Legacy configuration {legacy} is ignored: {jsonc} is authoritative for the native cli-git. Remove the legacy file once no TypeScript cli-git reads it.\",\"path\":\"{legacy}\"}}\n",
                legacy = repo.join("cli-git.config.ts").display(),
                jsonc = source.display()
            )
            .as_str(),
            stopped("fix").as_str()
        )
    );
    remove(root.as_path());
}

/// A direct command without a usable real Git, or with uninterpretable Git output, stops in prose.
#[test]
fn direct_commands_report_git_failures() {
    let root: PathBuf = fixture("management-git-failure");
    assert_eq!(
        plan(&["check", "--all"], root.as_path(), &no_git(root.as_path())),
        exit(
            2,
            "",
            "cli-git: Could not find a real Git executable after examining 1 PATH candidates and \
             skipping 0 cli-git wrappers. Ensure Git is installed and PATH/PATHEXT expose its \
             executable.\n"
        )
    );
    let mut fake: ResolutionInputs = with_git(root.as_path());
    std::fs::create_dir(root.join("fake")).expect("directory");
    executable(
        root.join("fake/git").as_path(),
        b"#!/bin/sh\nprintf 'false\\n/only-two-lines\\n'\nexit 0\n",
    );
    fake.path = OsString::from("fake");
    match plan(&["check", "--all"], root.as_path(), &fake) {
        Action::Exit {
            code,
            stdout,
            stderr,
        } => {
            assert_eq!(code, 2);
            assert_eq!(stdout, "");
            assert!(
                stderr.starts_with("cli-git: cli-git could not classify the Git worktree"),
                "{stderr}"
            );
        }
        Action::Forward { .. } => panic!("a direct command is never forwarded"),
    }
    remove(root.as_path());
}
