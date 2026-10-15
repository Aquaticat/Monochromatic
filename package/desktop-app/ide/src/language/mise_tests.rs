//! Resolution against a double that answers like mise,
//!  the notice text,
//!  and the retry rule.

use super::{
    Failed, MiseRequest, MiseState, RETRY_AFTER, TIME_LIMIT,
    command::{Completed, Invocation, RunFailure},
    due, resolve_disabled, resolve_with,
};
use std::{cell::RefCell, fs, path::PathBuf, time::Duration};

const GLOBAL: &str = "/home/someone/.config/mise/config.toml";

fn request(root: &str) -> MiseRequest {
    return MiseRequest {
        project_root: PathBuf::from(root),
        project_spellings: Vec::new(),
        state_root: Some(PathBuf::from("/state")),
    };
}

fn done(stdout: &str, stderr: &str) -> Result<Completed, RunFailure> {
    return Ok(Completed {
        success: true,
        status: "exit status: 0".to_string(),
        stdout: stdout.to_string(),
        stderr: stderr.to_string(),
    });
}

fn failed(stderr: &str) -> Result<Completed, RunFailure> {
    return Ok(Completed {
        success: false,
        status: "exit status: 1".to_string(),
        stdout: String::new(),
        stderr: stderr.to_string(),
    });
}

/// What the double answers for each of the three commands,
///  in the order resolution asks them.
struct Answers {
    from_project: Result<Completed, RunFailure>,
    from_root: Result<Completed, RunFailure>,
    bin_paths: Result<Completed, RunFailure>,
}

/// Run resolution and return the state with every invocation and limit the double saw.
fn resolve(root: &str, answers: Answers) -> (MiseState, Vec<(Invocation, Duration)>) {
    let seen: RefCell<Vec<(Invocation, Duration)>> = RefCell::new(Vec::new());
    let runner = |invocation: &Invocation, limit: Duration| {
        seen.borrow_mut().push((invocation.clone(), limit));
        let answer = match (
            invocation.arguments[0].as_str(),
            invocation.directory.as_path(),
        ) {
            ("config", directory) if directory == std::path::Path::new("/") => &answers.from_root,
            ("config", _) => &answers.from_project,
            _ => &answers.bin_paths,
        };
        return answer.clone();
    };
    let state = resolve_with(&request(root), &runner);
    return (state, seen.into_inner());
}

fn listing(paths: &[&str]) -> String {
    let entries: Vec<String> = paths
        .iter()
        .map(|path| return format!(r#"{{"path": "{path}", "tools": []}}"#))
        .collect();
    return format!("[{}]", entries.join(","));
}

#[test]
fn a_project_with_its_own_configuration_gets_the_directories_mise_prints() {
    let tools = tempfile::tempdir().expect("directory");
    let node = tools.path().join("node/bin");
    let taplo = tools.path().join("taplo");
    fs::create_dir_all(&node).expect("directory");
    fs::create_dir_all(&taplo).expect("directory");
    let (state, seen) = resolve(
        "/work/project",
        Answers {
            from_project: done(
                &listing(&["/work/project/mise.toml", GLOBAL]),
                "mise WARN  unknown field: lockfile\n",
            ),
            from_root: done(&listing(&[GLOBAL]), "mise WARN  unknown field: lockfile\n"),
            bin_paths: done(
                &format!("{}\n{}\n", node.display(), taplo.display()),
                "mise WARN  missing: taplo@0.9.0\n",
            ),
        },
    );
    let MiseState::Provided(provided) = state else {
        panic!("not provided: {state:?}");
    };
    assert_eq!(provided.directories, [node, taplo]);
    assert_eq!(provided.configs, [PathBuf::from("/work/project/mise.toml")]);
    assert_eq!(
        provided.warnings,
        "mise WARN  unknown field: lockfile\nmise WARN  missing: taplo@0.9.0"
    );
    let asked: Vec<(Vec<String>, PathBuf)> = seen
        .iter()
        .map(|(invocation, _)| return (invocation.arguments.clone(), invocation.directory.clone()))
        .collect();
    let listing_arguments = ["config", "ls", "--json"].map(str::to_string).to_vec();
    assert_eq!(
        asked,
        [
            (listing_arguments.clone(), PathBuf::from("/work/project")),
            (listing_arguments, PathBuf::from("/")),
            (
                vec!["bin-paths".to_string()],
                PathBuf::from("/work/project")
            ),
        ]
    );
}

#[test]
fn mise_is_never_asked_to_install_trust_run_or_name_the_project() {
    let (_, seen) = resolve(
        "/work/--cd=/etc",
        Answers {
            from_project: done(&listing(&["/work/--cd=/etc/mise.toml"]), ""),
            from_root: done("[]", ""),
            bin_paths: done("", ""),
        },
    );
    assert_eq!(seen.len(), 3);
    for (invocation, _) in &seen {
        let command = invocation.arguments.join(" ");
        for forbidden in [
            "trust", "install", "exec", "run", "use", "set", "activate", "env", "--cd", "--yes",
            "/work",
        ] {
            assert!(
                !invocation
                    .arguments
                    .iter()
                    .any(|argument| return argument.contains(forbidden)),
                "mise was asked `{command}`, which contains {forbidden}"
            );
        }
    }
}

#[test]
fn a_project_without_a_configuration_of_its_own_is_not_a_mise_project() {
    let (state, seen) = resolve(
        "/work/project",
        Answers {
            from_project: done(&listing(&[GLOBAL]), ""),
            from_root: done(&listing(&[GLOBAL]), ""),
            bin_paths: failed("bin-paths must not be asked"),
        },
    );
    assert!(matches!(state, MiseState::Unused(_)), "{state:?}");
    assert!(!state.serves_project());
    assert_eq!(
        seen.len(),
        2,
        "bin-paths was asked for a project mise does not serve"
    );
}

#[test]
fn an_untrusted_configuration_fails_with_mises_words_and_the_file() {
    let stderr = "mise ERROR error parsing config file: /work/project/mise.toml
mise ERROR Config files in /work/project/mise.toml are not trusted.
Trust them with `mise trust`. See https://mise.jdx.dev/cli/trust.html for more information.
mise ERROR Version: 2026.10.0 linux-x64 (2026-10-02)
mise ERROR Run with --verbose or MISE_VERBOSE=1 for more information
";
    let (state, seen) = resolve(
        "/work/project",
        Answers {
            from_project: failed(stderr),
            from_root: done("[]", ""),
            bin_paths: done("", ""),
        },
    );
    let MiseState::Failed(Failed { message, untrusted }) = state else {
        panic!("not failed: {state:?}");
    };
    assert_eq!(untrusted.as_deref(), Some("/work/project/mise.toml"));
    assert!(
        message.contains("Config files in /work/project/mise.toml are not trusted."),
        "{message}"
    );
    assert!(
        message.contains("Trust them with `mise trust`."),
        "{message}"
    );
    assert!(!message.contains("Version:"), "{message}");
    assert_eq!(seen.len(), 1, "nothing is asked after a refusal");
}

#[test]
fn a_failure_without_a_message_still_says_what_ended() {
    let (state, _) = resolve(
        "/work/project",
        Answers {
            from_project: done(&listing(&["/work/project/mise.toml"]), ""),
            from_root: done("[]", ""),
            bin_paths: failed(""),
        },
    );
    let MiseState::Failed(failed) = state else {
        panic!("not failed: {state:?}");
    };
    assert!(
        failed
            .message
            .contains("`mise bin-paths` ended with exit status: 1"),
        "{}",
        failed.message
    );
    assert_eq!(failed.untrusted, None);
}

#[test]
fn an_unreadable_listing_fails_instead_of_guessing() {
    let (state, _) = resolve(
        "/work/project",
        Answers {
            from_project: done("<html>", ""),
            from_root: done("[]", ""),
            bin_paths: done("", ""),
        },
    );
    let MiseState::Failed(failed) = state else {
        panic!("not failed: {state:?}");
    };
    assert!(failed.message.contains("not JSON"), "{}", failed.message);
}

#[test]
fn a_run_that_timed_out_or_could_not_start_fails_and_a_refused_sandbox_does_not() {
    let timed_out = RunFailure::Failed("did not finish within 10 s and was stopped".to_string());
    let (state, _) = resolve(
        "/work/project",
        Answers {
            from_project: Err(timed_out),
            from_root: done("[]", ""),
            bin_paths: done("", ""),
        },
    );
    let MiseState::Failed(failed) = state else {
        panic!("not failed: {state:?}");
    };
    assert_eq!(
        failed.message,
        "`mise config ls --json` did not finish within 10 s and was stopped"
    );
    let (refused, seen) = resolve(
        "/work/project",
        Answers {
            from_project: Err(RunFailure::Refused(
                "bubblewrap is not installed".to_string(),
            )),
            from_root: done("[]", ""),
            bin_paths: done("", ""),
        },
    );
    assert_eq!(
        refused,
        MiseState::Unused("bubblewrap is not installed".to_string())
    );
    assert_eq!(seen.len(), 1);
}

#[test]
fn all_runs_share_one_time_limit() {
    let (_, seen) = resolve(
        "/work/project",
        Answers {
            from_project: done(&listing(&["/work/project/mise.toml"]), ""),
            from_root: done("[]", ""),
            bin_paths: done("", ""),
        },
    );
    assert_eq!(seen.len(), 3);
    let limits: Vec<Duration> = seen.iter().map(|(_, limit)| return *limit).collect();
    assert!(
        limits[0] <= TIME_LIMIT && limits[0] > TIME_LIMIT - Duration::from_secs(2),
        "{limits:?}"
    );
    assert!(
        limits.windows(2).all(|pair| return pair[1] <= pair[0]),
        "{limits:?}"
    );
}

#[test]
fn the_disabled_policy_never_runs_mise() {
    assert_eq!(
        resolve_disabled(&request("/work/project")),
        MiseState::Disabled
    );
}

#[test]
fn a_failure_is_asked_again_after_the_retry_time_and_a_good_answer_only_for_a_missing_server() {
    let failed = MiseState::Failed(Failed {
        message: "x".to_string(),
        untrusted: None,
    });
    let provided = MiseState::Provided(super::Provided {
        directories: Vec::new(),
        configs: Vec::new(),
        warnings: String::new(),
    });
    let young = RETRY_AFTER - Duration::from_millis(1);
    assert!(!due(&failed, young, true));
    assert!(due(&failed, RETRY_AFTER, false));
    assert!(!due(&provided, RETRY_AFTER * 10, false));
    assert!(!due(&provided, young, true));
    assert!(due(&provided, RETRY_AFTER, true));
    for idle in [MiseState::Disabled, MiseState::Unused("x".to_string())] {
        assert!(!due(&idle, RETRY_AFTER * 100, true));
    }
}
