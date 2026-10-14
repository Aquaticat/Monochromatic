//! Controls for the live-holder wait: its limit from the environment, its notice text,
//!  and the notice a slow wait prints.

use super::*;
use crate::owner_lock::{OwnerLock, SilentWait, acquire_owner_lock};
use crate::test_support::{fixture, remove};
use std::ffi::OsString;

/// The limit follows the variable and falls back to the default for anything unusable.
#[test]
fn the_limit_comes_from_the_variable_or_the_default() {
    assert_eq!(live_wait_limit_from(None), DEFAULT_LIVE_WAIT);
    assert_eq!(DEFAULT_LIVE_WAIT, Duration::from_secs(1800));
    assert_eq!(
        live_wait_limit_from(Some(OsStr::new("90"))),
        Duration::from_secs(90)
    );
    for value in ["0", "", "-1", "1.5", "soon"] {
        assert_eq!(
            live_wait_limit_from(Some(OsStr::new(value))),
            DEFAULT_LIVE_WAIT,
            "{value:?}"
        );
    }
}

/// A value that is not valid text is unusable.
#[cfg(unix)]
#[test]
fn a_non_text_limit_falls_back_to_the_default() {
    use std::os::unix::ffi::OsStringExt;
    let value: OsString = OsString::from_vec(vec![0xff, 0xfe]);
    assert_eq!(live_wait_limit_from(Some(value.as_os_str())), DEFAULT_LIVE_WAIT);
}

/// The notice names the holder, the lock, the waited time and the limit,
///  and says where to change it.
#[test]
fn the_notice_names_the_holder_the_lock_and_both_durations() {
    let line: String = slow_wait_line(
        "the hook lock",
        Path::new("/repo/.git/cli-git/hook.lock"),
        Some(4242),
        Duration::from_millis(5900),
        Duration::from_secs(1800),
    );
    assert_eq!(
        line,
        "cli-git: still waiting for process 4242 to release the hook lock (/repo/.git/cli-git/hook.lock) \
         after 5 seconds; giving up after 1800 seconds (CLI_GIT_LOCK_WAIT_SECONDS changes this), \
         leaving the lock in place."
    );
    let anonymous: String = slow_wait_line(
        "the hook lock",
        Path::new("/x"),
        None,
        Duration::from_secs(6),
        Duration::from_secs(9),
    );
    assert!(
        anonymous.starts_with("cli-git: still waiting for another cli-git process to release"),
        "{anonymous}"
    );
}

/// A slow wait prints one line naming the live holder,
///  and the first busy moment prints nothing.
#[test]
fn a_slow_wait_prints_one_line_naming_the_holder() {
    let root: PathBuf = fixture("live-lock-notice");
    let lock_directory: PathBuf = root.join("hook.lock");
    let held: OwnerLock =
        acquire_owner_lock(&lock_directory, DEFAULT_POLL_DELAY, &mut SilentWait).expect("held");
    let mut sink: Vec<u8> = Vec::new();
    let mut notice: HolderNotice<&mut Vec<u8>> = HolderNotice::new(
        lock_directory.as_path(),
        "the hook lock",
        Duration::from_secs(60),
        &mut sink,
    );
    notice.waiting();
    notice.slow(Duration::from_secs(7));
    drop(notice);
    let text: String = String::from_utf8(sink).expect("text");
    assert_eq!(text.matches('\n').count(), 1, "{text}");
    assert!(
        text.contains(&format!("waiting for process {}", std::process::id())),
        "{text}"
    );
    assert!(text.contains("after 7 seconds"), "{text}");
    assert!(text.contains("giving up after 60 seconds"), "{text}");
    drop(held);
    remove(&root);
}

/// A notice for a lock nobody holds still prints, without naming a process.
#[test]
fn a_notice_for_an_unreadable_lock_still_prints() {
    let root: PathBuf = fixture("live-lock-notice-absent");
    let mut sink: Vec<u8> = Vec::new();
    let mut notice: HolderNotice<&mut Vec<u8>> = HolderNotice::new(
        root.join("absent.lock").as_path(),
        "a lock",
        Duration::from_secs(60),
        &mut sink,
    );
    notice.slow(Duration::from_secs(5));
    drop(notice);
    let text: String = String::from_utf8(sink).expect("text");
    assert!(text.contains("another cli-git process"), "{text}");
    remove(&root);
}

/// A free lock is taken at once with the process's own limit and no output.
#[test]
fn a_free_lock_is_taken_without_waiting() {
    let root: PathBuf = fixture("live-lock-free");
    let lock: OwnerLock =
        acquire_live_owner_lock(root.join("free.lock").as_path(), "a lock").expect("free");
    lock.release().expect("release");
    remove(&root);
}

/// Variable the helper process is started with.
const HELPER_EXPECTED: &str = "LIVE_LOCK_TEST_EXPECTED_SECONDS";

/// Helper process body,
///  started by the test below with the limit variable set:
///  the limit this process runs under is the variable's.
#[test]
#[ignore = "started as a helper process by the environment test"]
fn helper_reads_the_limit_from_its_environment() {
    let expected: u64 = std::env::var(HELPER_EXPECTED)
        .expect("expected")
        .parse()
        .expect("seconds");
    assert_eq!(live_wait_limit(), Duration::from_secs(expected));
}

/// Run the helper with an expectation and, when given, the limit variable;
///  whether the helper's assertion held.
fn helper_agrees(value: Option<&str>, expected: u64) -> bool {
    let mut command: std::process::Command =
        std::process::Command::new(std::env::current_exe().expect("test binary"));
    command
        .args([
            "--exact",
            "live_lock::tests::helper_reads_the_limit_from_its_environment",
            "--ignored",
            "--test-threads=1",
            "--quiet",
        ])
        .env(HELPER_EXPECTED, expected.to_string())
        .env_remove(LIVE_WAIT_VARIABLE);
    if let Some(text) = value {
        command.env(LIVE_WAIT_VARIABLE, text);
    }
    return command.status().expect("start the helper").success();
}

/// The process environment reaches the limit:
///  a child started with the variable runs under it, and one started without it runs under the default.
///  A wrong expectation must fail the helper, which proves the helper really ran its assertion.
#[test]
fn the_process_environment_sets_the_limit() {
    assert!(!helper_agrees(Some("7"), 8), "the helper must fail a wrong expectation");
    assert!(!helper_agrees(None, 7), "the helper must fail a wrong default");
    for (value, expected) in [(Some("7"), 7_u64), (Some("0"), 1800), (Some("junk"), 1800), (None, 1800)] {
        assert!(helper_agrees(value, expected), "{value:?}");
    }
}
