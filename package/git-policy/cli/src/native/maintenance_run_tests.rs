//! Controls for running automatic maintenance:
//!  the config read, the Git invocations and their order, the pre-2.47 retry, and the failure paths.

use super::*;
use crate::test_support::{executable, fixture, git, git_context, remove, repository};
use std::path::PathBuf;

/// Stand-in Git behavior for one test.
struct Stand {
    /// Exit status of the `config` invocation.
    config_exit: u8,
    /// Escaped `printf '%b'` text the `config` invocation prints.
    config_output: &'static str,
    /// Whether `--detach` fails as Git before 2.47 fails it.
    reject_detach: bool,
    /// Whether the `config` invocation ends itself with `SIGTERM`.
    signal_config: bool,
}

/// Write a stand-in Git that appends each invocation's arguments to a log and answers as `stand` says.
fn stand_in(root: &std::path::Path, stand: &Stand) -> (PathBuf, PathBuf) {
    let log: PathBuf = root.join("calls.log");
    let path: PathBuf = root.join("git");
    let signal_line: &str = if stand.signal_config { "kill -TERM $$\n" } else { "" };
    let reject_line: &str = if stand.reject_detach {
        "case \" $* \" in *\" --detach \"*) printf '%s\\n' \"error: unknown option 'detach'\" >&2; exit 129;; esac\n"
    } else {
        ""
    };
    let content: String = format!(
        "#!/bin/sh\nprintf '%s\\n' \"$*\" >> '{}'\ncase \" $* \" in *\" config \"*) printf '%b' '{}'; printf 'fatal: bad config\\n' >&2; {}exit {};; esac\n{}exit 0\n",
        log.display(),
        stand.config_output,
        signal_line,
        stand.config_exit,
        reject_line,
    );
    executable(path.as_path(), content.as_bytes());
    return (path, log);
}

/// Read the logged invocations in order.
fn calls(log: &std::path::Path) -> Vec<String> {
    return std::fs::read_to_string(log)
        .unwrap_or_default()
        .lines()
        .map(String::from)
        .collect();
}

/// A context that starts the stand-in with the caller's global options and no overlay.
fn stand_context(path: PathBuf, global_prefix: &[&str]) -> GitContext {
    return GitContext {
        real_git: path,
        overlay: Vec::new(),
        global_prefix: global_prefix.iter().map(|option| return std::ffi::OsString::from(option)).collect(),
    };
}

/// An unset configuration runs detached maintenance after the config read, both with the caller's global options.
#[test]
fn unset_configuration_runs_detached_maintenance_with_the_global_prefix() {
    let root: PathBuf = fixture("maintenance-unset");
    let (path, log) = stand_in(root.as_path(), &Stand {
        config_exit: 1,
        config_output: "",
        reject_detach: false,
        signal_config: false,
    });
    let outcome: AutoMaintenanceOutcome =
        run_auto_maintenance(&stand_context(path, &["-c", "x.y=z"]), root.as_path())
            .expect("maintenance ran");
    assert_eq!(outcome, AutoMaintenanceOutcome::Exited(0));
    let logged: Vec<String> = calls(log.as_path());
    assert_eq!(logged.len(), 2);
    assert!(logged[0].starts_with("-c x.y=z config --type=bool-or-int --null --get-regexp "));
    assert_eq!(logged[1], "-c x.y=z maintenance run --auto --quiet --detach");
    remove(root.as_path());
}

/// Git before 2.47 rejects `--detach` with 129, and the step retries without it.
#[test]
fn rejected_detach_retries_without_the_flag() {
    let root: PathBuf = fixture("maintenance-retry");
    let (path, log) = stand_in(root.as_path(), &Stand {
        config_exit: 1,
        config_output: "",
        reject_detach: true,
        signal_config: false,
    });
    let outcome: AutoMaintenanceOutcome =
        run_auto_maintenance(&stand_context(path, &[]), root.as_path()).expect("maintenance ran");
    assert_eq!(outcome, AutoMaintenanceOutcome::Exited(0));
    assert_eq!(
        calls(log.as_path()).into_iter().skip(1).collect::<Vec<String>>(),
        vec![
            String::from("maintenance run --auto --quiet --detach"),
            String::from("maintenance run --auto --quiet"),
        ]
    );
    remove(root.as_path());
}

/// A `maintenance.autodetach` of false runs the foreground form.
#[test]
fn detach_false_runs_the_foreground_form() {
    let root: PathBuf = fixture("maintenance-foreground");
    let (path, log) = stand_in(root.as_path(), &Stand {
        config_exit: 0,
        config_output: "maintenance.autodetach\\nfalse\\0",
        reject_detach: false,
        signal_config: false,
    });
    let outcome: AutoMaintenanceOutcome =
        run_auto_maintenance(&stand_context(path, &[]), root.as_path()).expect("maintenance ran");
    assert_eq!(outcome, AutoMaintenanceOutcome::Exited(0));
    assert_eq!(
        calls(log.as_path()).last().map(String::as_str),
        Some("maintenance run --auto --quiet --no-detach")
    );
    remove(root.as_path());
}

/// A config read that fails with an exit status other than 0 or 1 skips maintenance and reports that status.
#[test]
fn failing_config_read_skips_maintenance_and_reports_its_status() {
    let root: PathBuf = fixture("maintenance-config-failure");
    let (path, log) = stand_in(root.as_path(), &Stand {
        config_exit: 128,
        config_output: "",
        reject_detach: false,
        signal_config: false,
    });
    let outcome: AutoMaintenanceOutcome =
        run_auto_maintenance(&stand_context(path, &[]), root.as_path()).expect("config ran");
    assert_eq!(outcome, AutoMaintenanceOutcome::Exited(128));
    assert_eq!(calls(log.as_path()).len(), 1);
    remove(root.as_path());
}

/// A config read ended by a signal counts as exit 1, so maintenance still runs, as `exitCode ?? 1` does.
#[test]
fn signaled_config_read_counts_as_unset() {
    let root: PathBuf = fixture("maintenance-config-signal");
    let (path, log) = stand_in(root.as_path(), &Stand {
        config_exit: 0,
        config_output: "",
        reject_detach: false,
        signal_config: true,
    });
    let outcome: AutoMaintenanceOutcome =
        run_auto_maintenance(&stand_context(path, &[]), root.as_path()).expect("maintenance ran");
    assert_eq!(outcome, AutoMaintenanceOutcome::Exited(0));
    assert_eq!(calls(log.as_path()).len(), 2);
    remove(root.as_path());
}

/// Config output that is not UTF-8 is an error and runs no maintenance.
#[test]
fn config_output_that_is_not_utf8_is_refused_before_maintenance() {
    let root: PathBuf = fixture("maintenance-config-utf8");
    let (path, log) = stand_in(root.as_path(), &Stand {
        config_exit: 0,
        config_output: "gc.auto\\n\\377\\0",
        reject_detach: false,
        signal_config: false,
    });
    assert_eq!(
        run_auto_maintenance(&stand_context(path, &[]), root.as_path()),
        Err(MaintenanceError::ConfigNotUtf8)
    );
    assert_eq!(calls(log.as_path()).len(), 1);
    remove(root.as_path());
}

/// A disabled configuration runs no maintenance and reports the disabled outcome.
#[test]
fn disabled_configuration_runs_no_maintenance() {
    let root: PathBuf = fixture("maintenance-disabled");
    let (path, log) = stand_in(root.as_path(), &Stand {
        config_exit: 0,
        config_output: "maintenance.auto\\nfalse\\0",
        reject_detach: false,
        signal_config: false,
    });
    let outcome: AutoMaintenanceOutcome =
        run_auto_maintenance(&stand_context(path, &[]), root.as_path()).expect("config ran");
    assert_eq!(outcome, AutoMaintenanceOutcome::Disabled);
    assert_eq!(calls(log.as_path()).len(), 1);
    remove(root.as_path());
}

/// Real Git: a repository with `maintenance.auto` false reports the disabled outcome.
#[test]
fn real_repository_with_maintenance_disabled_reports_disabled() {
    let root: PathBuf = fixture("maintenance-real-disabled");
    let repo: PathBuf = repository(root.as_path(), "repo");
    git(repo.as_path(), &["config", "maintenance.auto", "false"]);
    assert_eq!(
        run_auto_maintenance(&git_context(), repo.as_path()).expect("config read"),
        AutoMaintenanceOutcome::Disabled
    );
    remove(root.as_path());
}

/// Real Git: an empty repository runs `git maintenance run --auto` and exits 0.
#[test]
fn real_repository_runs_maintenance_and_exits_zero() {
    let root: PathBuf = fixture("maintenance-real-run");
    let repo: PathBuf = repository(root.as_path(), "repo");
    assert_eq!(
        run_auto_maintenance(&git_context(), repo.as_path()).expect("maintenance ran"),
        AutoMaintenanceOutcome::Exited(0)
    );
    remove(root.as_path());
}

/// Real Git: a damaged configuration makes the config read fail with its own status, and maintenance is skipped.
#[test]
fn real_damaged_configuration_skips_maintenance() {
    let root: PathBuf = fixture("maintenance-real-damaged");
    let repo: PathBuf = repository(root.as_path(), "repo");
    std::fs::write(repo.join(".git").join("config"), b"[core\n\tbogus\n").expect("damage config");
    let outcome: AutoMaintenanceOutcome =
        run_auto_maintenance(&git_context(), repo.as_path()).expect("config read ran");
    assert!(matches!(outcome, AutoMaintenanceOutcome::Exited(code) if code != 0 && code != 1));
    remove(root.as_path());
}
