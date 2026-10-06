//! The inspection session's part in watching folders for the servers: the relay the application's tick
//! performs, writing a file as another program would, and waiting for the watched folders.

/// The session these steps belong to.
use super::Session;
/// Failures name the operation that failed.
use anyhow::{Context, Result};
/// JSON values and the literal-building macro.
use serde_json::{Value, json};
/// What: `Path` is a borrowed path; `Duration` a time span.
/// Why: Files are named relative to the project, and every wait is bounded.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const limit = seconds * 1000;
/// ```
use std::{path::Path, time::Duration};

/// Folder watching steps.
impl Session {
    /// What: The application's tick: the watcher feeds the worker while some server wants file changes.
    ///       `then` makes the sender only when it is wanted.
    /// Why: Without this relay no folder is watched for the servers, which is the positive control.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// relayFileChanges() { watcher?.feedServers(worker.wantsFileChanges() ? worker.fileChangeSender() : undefined); }
    /// ```
    pub(super) fn relay_file_changes(&mut self) {
        let Some(watcher) = self.watcher.as_mut() else {
            return;
        };
        let feed = self
            .worker
            .wants_file_changes()
            .then(|| return self.worker.file_change_sender());
        watcher.feed_servers(feed);
        // The tree's invalidations have no reader here.
        let _tree = watcher.take();
    }

    /// Write a file of the project as another program would; the displayed document is not touched.
    pub(super) fn write(&mut self, file: &Path, text: &str) -> Result<Value> {
        let path = self.project.join(file);
        std::fs::write(&path, text)
            .with_context(|| return format!("Cannot write {}", path.display()))?;
        return Ok(json!({ "written": path.display().to_string() }));
    }

    /// Wait until at least `minimum` folders are watched for the servers; report whether that happened.
    pub(super) fn folders(&mut self, minimum: usize, seconds: u64) -> Result<Value> {
        // What: a closure that reads the watcher's folder count, or false without a watcher.
        // Why: `until` polls with any such test.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const watched = (session) => (session.watcher?.serverFolders() ?? 0) >= minimum;
        // ```
        let watched = move |session: &Session| {
            return session
                .watcher
                .as_ref()
                .is_some_and(|watcher| return watcher.server_folders() >= minimum);
        };
        let within = self.until(Duration::from_secs(seconds), &watched)?;
        let folders = self
            .watcher
            .as_ref()
            .map_or(0, |watcher| return watcher.server_folders());
        return Ok(json!({ "within": within, "folders": folders }));
    }
}
