//! Waiting in the native language tests: advancing timers until a state holds, and waiting for
//! the scripted server to finish its start within the product's start deadline.

/// The reader whose binding reports the server's state, and the server's name.
use super::test_support::{LanguageReader, SERVER};
/// Server states as the binding reports them.
use ide_app::language::status::ServerState;
/// Deadlines for every wait.
use std::time::{Duration, Instant};

/// Longest wait for an expected state in these tests.
const PATIENCE: Duration = Duration::from_secs(10);

/// What: Longest wait for the scripted server to become ready or to fail its start.
/// Why: This is the product's start deadline for the server these tests define: `initialize`
///      gets three request timeouts of 5 s (`START_FACTOR` in `src/language/config.rs`), and the
///      worker reports the start failed 2 s after that (`START_MARGIN` in
///      `src/language/attach/start.rs`). A shorter wait fails a start the product still accepts.
///      If either constant or the `timeout` in `definitions` changes, this follows it.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const READY_PATIENCE_MS = 3 * 5_000 + 2_000;
/// ```
const READY_PATIENCE: Duration = Duration::from_secs(17);

/// Advance timers until `ready` holds, failing with `message` after `patience`.
fn eventually_within(message: &str, patience: Duration, mut ready: impl FnMut() -> bool) {
    let start = Instant::now();
    loop {
        slint::platform::update_timers_and_animations();
        if ready() {
            return;
        }
        assert!(start.elapsed() < patience, "{message}");
        std::thread::sleep(Duration::from_millis(2));
    }
}

/// Advance timers until `ready` holds, failing with `message` after ten seconds.
pub(super) fn eventually(message: &str, ready: impl FnMut() -> bool) {
    eventually_within(message, PATIENCE, ready);
}

/// What: The scripted server's state as the binding last polled it, if it is listed.
///       `Option<ServerState>` is "a state, or nothing" (sibling: a borrowed `&ServerState`).
/// Why: The readiness wait stops on a failed start and names that state in its message.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function serverState(reader: LanguageReader): ServerState | undefined
/// ```
fn server_state(reader: &LanguageReader) -> Option<ServerState> {
    // The trailing `?` leaves with nothing after the binding was closed.
    let binding = reader.binding.as_ref()?;
    let language = binding.language.borrow();
    // `find` returns the first row for the server; `map` copies its state out of the borrow.
    return language
        .status
        .servers
        .iter()
        .find(|row| return row.server.name == SERVER)
        .map(|row| return row.state.clone());
}

/// Wait until the scripted server is ready for the displayed file, as the binding polled it.
/// A failed start ends the wait at once, and the message names the state last seen.
pub(super) fn ready(reader: &LanguageReader) {
    eventually_within(
        "the scripted server neither became ready nor failed within its start deadline",
        READY_PATIENCE,
        || {
            return matches!(
                server_state(reader),
                Some(ServerState::Ready | ServerState::FailedToStart { .. })
            );
        },
    );
    assert_eq!(
        server_state(reader),
        Some(ServerState::Ready),
        "the scripted server did not become ready"
    );
}
