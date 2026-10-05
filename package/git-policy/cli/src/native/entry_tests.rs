//! What: Decision controls for one wrapper invocation against real Git 2.56.0.
//! Why: Inspection commands must be forwarded without reading configuration, every
//!      other command must validate configuration and then stop, and a wrapper
//!      selected as real Git must refuse to forward.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // expect(planInvocation(['status'], env, inputs)).toEqual({ kind: 'forward', realGit: '/usr/bin/git', ... });
//! ```
#![cfg(unix)]

/// Import the decision under test and shared fixtures.
use super::{Action, ENGINE_FAILURE_EXIT_CODE, load_invocation_config, plan_invocation};
use crate::child_environment::FORWARD_TARGET_VARIABLE;
use crate::config_file::CONFIG_FILE_NAME;
use crate::config_schema::CliGitConfig;
use crate::policy_registry::{PolicyId, Severity};
use crate::real_git::{Platform, ResolutionInputs};
use crate::test_support::{REAL_GIT, executable, fixture, remove, repository};
use std::ffi::OsString;
use std::path::{Path, PathBuf};

/// Inputs selecting the image's real Git, with a fixture file standing in for this wrapper.
fn inputs(root: &Path) -> ResolutionInputs {
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

/// Build `-C <directory> <rest...>` as owned arguments.
fn in_directory(directory: &Path, rest: &[&str]) -> Vec<OsString> {
    let mut result: Vec<OsString> =
        vec![OsString::from("-C"), directory.as_os_str().to_os_string()];
    for value in rest {
        result.push(OsString::from(value));
    }
    return result;
}

/// The forward action every inspection command must produce in these fixtures.
fn forward() -> Action {
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

/// Return the stderr of a stop action with exit code 2; a forward fails the test.
fn stopped(action: Action) -> String {
    match action {
        Action::Exit { code, stderr } => {
            assert_eq!(code, ENGINE_FAILURE_EXIT_CODE);
            return stderr;
        }
        Action::Forward { .. } => panic!("expected a stop action, got {action:?}"),
    }
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
    ] {
        let mut owned: Vec<OsString> = Vec::<OsString>::new();
        for value in &arguments {
            owned.push(OsString::from(value));
        }
        assert_eq!(
            plan_invocation(owned.as_slice(), &[], &resolution),
            forward(),
            "{arguments:?}"
        );
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
    let not_run: &str = "cli-git: policy execution is not implemented in this native development \
                         executable, so git add was not run. Repository-changing commands still \
                         require the installed cli-git.\n";
    let arguments: Vec<OsString> = in_directory(repo.as_path(), &["add", "file"]);
    // No configuration file: defaults apply.
    assert_eq!(
        stopped(plan_invocation(arguments.as_slice(), &[], &resolution)),
        not_run
    );
    // A valid file is accepted.
    std::fs::write(
        repo.join(CONFIG_FILE_NAME),
        r#"{ "policies": { "final-newline": "error" } }"#,
    )
    .expect("valid config");
    assert_eq!(
        stopped(plan_invocation(arguments.as_slice(), &[], &resolution)),
        not_run
    );
    // A legacy file beside it is reported before the stop notice.
    std::fs::write(repo.join("cli-git.config.ts"), "export default {};").expect("legacy config");
    assert_eq!(
        stopped(plan_invocation(arguments.as_slice(), &[], &resolution)),
        format!(
            "cli-git: Legacy configuration {} is ignored: {} is authoritative for the native \
             cli-git. Remove the legacy file once no TypeScript cli-git reads it.\n{not_run}",
            repo.join("cli-git.config.ts").display(),
            repo.join(CONFIG_FILE_NAME).display()
        )
    );
    // An invalid key stops with the configuration diagnostic and no stop notice.
    std::fs::write(
        repo.join(CONFIG_FILE_NAME),
        r#"{ "policies": { "unknown": "off" } }"#,
    )
    .expect("invalid config");
    let invalid: String = stopped(plan_invocation(arguments.as_slice(), &[], &resolution));
    assert!(
        invalid.starts_with(
            format!(
                "cli-git: {}: Unknown policy ID: unknown.",
                repo.join(CONFIG_FILE_NAME).display()
            )
            .as_str()
        ),
        "{invalid}"
    );
    assert!(invalid.ends_with(".\n"), "{invalid}");
    assert!(!invalid.contains("not implemented"), "{invalid}");
    // A legacy file alone demands migration.
    std::fs::remove_file(repo.join(CONFIG_FILE_NAME)).expect("remove JSONC");
    let legacy: String = stopped(plan_invocation(arguments.as_slice(), &[], &resolution));
    assert!(
        legacy.starts_with("cli-git: Legacy configuration ") && legacy.contains("is not executed"),
        "{legacy}"
    );
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
    let message: String = stopped(plan_invocation(
        in_directory(plain.as_path(), &["init"]).as_slice(),
        &[],
        &resolution,
    ));
    assert!(
        message.starts_with("cli-git: policy execution is not implemented")
            && message.contains("so git init was not run"),
        "{message}"
    );
    let loaded = load_invocation_config(
        Path::new(REAL_GIT),
        in_directory(plain.as_path(), &[]).as_slice(),
        &[],
    )
    .expect("defaults outside a worktree");
    assert_eq!(loaded.config, CliGitConfig::unconfigured());
    assert_eq!(loaded.source, None);
    remove(root.as_path());
}

/// The caller's global options select which repository's configuration is loaded.
#[test]
fn configuration_follows_global_repository_selection() {
    let root: PathBuf = fixture("entry-selection");
    let first: PathBuf = repository(root.as_path(), "first");
    let second: PathBuf = repository(root.as_path(), "second");
    std::fs::create_dir(first.join("nested")).expect("nested directory");
    std::fs::write(
        first.join(CONFIG_FILE_NAME),
        r#"{ "policies": { "add-explicit": "warn" } }"#,
    )
    .expect("first config");
    std::fs::write(
        second.join(CONFIG_FILE_NAME),
        r#"{ "policies": { "add-explicit": "off" } }"#,
    )
    .expect("second config");
    for (directory, source, expected) in [
        (
            first.join("nested"),
            first.join(CONFIG_FILE_NAME),
            Severity::Warn,
        ),
        (second.clone(), second.join(CONFIG_FILE_NAME), Severity::Off),
    ] {
        let loaded = load_invocation_config(
            Path::new(REAL_GIT),
            in_directory(directory.as_path(), &[]).as_slice(),
            &[],
        )
        .expect("selected repository configuration");
        assert_eq!(loaded.source, Some(source));
        assert_eq!(
            loaded
                .config
                .policies
                .setting(PolicyId::AddExplicit)
                .severity,
            expected
        );
    }
    remove(root.as_path());
}

/// A wrapper named as the forward target by another wrapper refuses to forward; other targets do not trigger.
#[test]
fn forward_target_naming_this_executable_stops() {
    let root: PathBuf = fixture("entry-handshake");
    let resolution: ResolutionInputs = inputs(root.as_path());
    let link: PathBuf = root.join("link-to-own");
    std::os::unix::fs::symlink(&resolution.own_executable, &link).expect("symlink");
    for target in [resolution.own_executable.clone(), link] {
        let environment: Vec<(OsString, OsString)> = vec![(
            OsString::from(FORWARD_TARGET_VARIABLE),
            target.into_os_string(),
        )];
        assert_eq!(
            stopped(plan_invocation(
                &[OsString::from("--version")],
                environment.as_slice(),
                &resolution
            )),
            format!(
                "cli-git: another cli-git wrapper selected this cli-git executable ({}) as real \
                 Git. Forwarding again would never reach Git. Remove the extra cli-git from PATH \
                 or place the real Git executable on PATH.\n",
                resolution.own_executable.display()
            )
        );
    }
    // A marker naming real Git (inherited by a hook), a missing path or an empty value is not this executable.
    for target in [REAL_GIT, "/nonexistent/git", ""] {
        let environment: Vec<(OsString, OsString)> = vec![(
            OsString::from(FORWARD_TARGET_VARIABLE),
            OsString::from(target),
        )];
        assert_eq!(
            plan_invocation(
                &[OsString::from("--version")],
                environment.as_slice(),
                &resolution
            ),
            forward(),
            "{target:?}"
        );
    }
    remove(root.as_path());
}

/// Without a usable real Git the invocation stops with the resolver's evidence.
#[test]
fn missing_real_git_stops_with_resolution_evidence() {
    let root: PathBuf = fixture("entry-no-git");
    let mut resolution: ResolutionInputs = inputs(root.as_path());
    std::fs::create_dir(root.join("only-wrapper")).expect("directory");
    std::os::unix::fs::symlink(&resolution.own_executable, root.join("only-wrapper/git"))
        .expect("symlink");
    resolution.path = OsString::from("only-wrapper:missing");
    assert_eq!(
        stopped(plan_invocation(
            &[OsString::from("status")],
            &[],
            &resolution
        )),
        "cli-git: Could not find a real Git executable after examining 2 PATH candidates and \
         skipping 1 cli-git wrappers. Ensure Git is installed and PATH/PATHEXT expose its \
         executable.\n"
    );
    remove(root.as_path());
}

/// A "Git" whose identity output cannot be interpreted stops the command instead of guessing.
#[test]
fn uninterpretable_identity_output_stops() {
    let root: PathBuf = fixture("entry-bad-identity");
    let mut resolution: ResolutionInputs = inputs(root.as_path());
    std::fs::create_dir(root.join("fake")).expect("directory");
    executable(
        root.join("fake/git").as_path(),
        b"#!/bin/sh\nprintf 'false\\n/only-two-lines\\n'\nexit 0\n",
    );
    resolution.path = OsString::from("fake");
    let message: String = stopped(plan_invocation(
        &[OsString::from("commit")],
        &[],
        &resolution,
    ));
    assert!(
        message.starts_with("cli-git: cli-git could not classify the Git worktree"),
        "{message}"
    );
    remove(root.as_path());
}
