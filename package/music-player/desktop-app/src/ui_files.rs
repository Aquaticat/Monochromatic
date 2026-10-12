//! Platform file actions behind the track menu: show in the file manager, copy the file name,
//! move to the trash, and restore from the trash for Undo.
//!
//! What: each function performs one OS action and reports a `FileActionError` on failure.
//! Why: the menu decides which action runs; this module only knows how each OS does it.

use std::fmt;
use std::path::{Path, PathBuf};

/// What: `FileActionError` is the failure of one file action, with the path or text it concerned.
/// Why: the caller reports the failure as feedback, so each variant carries the detail to show.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type FileActionError = { kind: "unsupported" | "spawn" | "clipboard" | "trash" | "restore"; detail: string };
/// ```
#[derive(Debug)]
pub enum FileActionError {
    /// The path has no parent folder to open.
    NoParent(PathBuf),
    /// A file manager process could not be started.
    Spawn(String),
    /// The clipboard could not be written.
    Clipboard(String),
    /// The file could not be moved to the trash.
    Trash(String),
    /// The file could not be restored from the trash.
    Restore(String),
}

impl fmt::Display for FileActionError {
    /// What: `fmt` writes the failure in plain words for the feedback message.
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        return match self {
            Self::NoParent(path) => write!(formatter, "{} has no folder to open", path.display()),
            Self::Spawn(detail) => write!(formatter, "The file manager could not be started: {detail}"),
            Self::Clipboard(detail) => write!(formatter, "The clipboard could not be written: {detail}"),
            Self::Trash(detail) => write!(formatter, "The file could not be moved to the trash: {detail}"),
            Self::Restore(detail) => write!(formatter, "The file could not be restored: {detail}"),
        };
    }
}

impl std::error::Error for FileActionError {}

/// What: `show_in_file_manager` opens the folder holding `path` with the file selected where the OS allows it.
/// Why: Linux has no select-file route, so it opens the parent; macOS and Windows select the file.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function showInFileManager(path: string): void { ... };
/// ```
#[cfg(target_os = "linux")]
pub fn show_in_file_manager(path: &Path) -> Result<(), FileActionError> {
    let parent = path.parent().ok_or_else(|| return FileActionError::NoParent(path.to_path_buf()))?;
    return spawn("xdg-open", |command| {
        command.arg(parent);
    });
}

/// What: `show_in_file_manager` on macOS opens Finder with the file selected (`open -R`).
#[cfg(target_os = "macos")]
pub fn show_in_file_manager(path: &Path) -> Result<(), FileActionError> {
    return spawn("open", |command| {
        command.arg("-R").arg(path);
    });
}

/// What: `show_in_file_manager` on Windows opens Explorer with the file selected (`explorer /select,`).
#[cfg(windows)]
pub fn show_in_file_manager(path: &Path) -> Result<(), FileActionError> {
    return spawn("explorer", |command| {
        command.arg(format!("/select,{}", path.display()));
    });
}

/// What: `show_in_file_manager` on other platforms reports that the action is unavailable.
#[cfg(not(any(target_os = "linux", target_os = "macos", windows)))]
pub fn show_in_file_manager(_path: &Path) -> Result<(), FileActionError> {
    return Err(FileActionError::Spawn("no file manager is known for this platform".to_string()));
}

/// What: `spawn` starts a program with arguments set by `configure` and does not wait for it.
/// Why: a file manager stays open after the player continues, so the player must not block on it.
fn spawn(program: &str, configure: impl FnOnce(&mut std::process::Command)) -> Result<(), FileActionError> {
    let mut command = std::process::Command::new(program);
    configure(&mut command);
    return command
        .spawn()
        .map(|_child| ())
        .map_err(|error| return FileActionError::Spawn(format!("{program}: {error}")));
}

/// What: `copy_text` writes `text` to the system clipboard.
/// Why: Copy filename puts the file name on the clipboard, and a failed write must be reported.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function copyText(text: string): Promise<void> { await navigator.clipboard.writeText(text); }
/// ```
pub fn copy_text(text: &str) -> Result<(), FileActionError> {
    let mut clipboard = arboard::Clipboard::new().map_err(|error| return FileActionError::Clipboard(error.to_string()))?;
    return clipboard
        .set_text(text)
        .map_err(|error| return FileActionError::Clipboard(error.to_string()));
}

/// What: `move_to_trash` moves `path` to the OS trash.
/// Why: D8 deletes immediately and offers Undo, so the trash is the recoverable place for the file.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function moveToTrash(path: string): void { ... };
/// ```
pub fn move_to_trash(path: &Path) -> Result<(), FileActionError> {
    return trash::delete(path).map_err(|error| return FileActionError::Trash(error.to_string()));
}

/// What: `can_restore_from_trash` tells whether `restore_from_trash` works on this platform.
/// Why: the Undo message is offered only where the trash crate can restore a file.
pub fn can_restore_from_trash() -> bool {
    return cfg!(any(
        windows,
        all(unix, not(any(target_os = "macos", target_os = "ios", target_os = "android")))
    ));
}

/// What: `restore_from_trash` puts the most recently trashed copy of `path` back where it was.
/// Why: Undo of Move to trash restores the file from the OS trash, so nothing is copied or re-created.
#[cfg(any(
    windows,
    all(unix, not(any(target_os = "macos", target_os = "ios", target_os = "android")))
))]
pub fn restore_from_trash(path: &Path) -> Result<(), FileActionError> {
    let items = trash::os_limited::list().map_err(|error| return FileActionError::Restore(error.to_string()))?;
    let newest = items
        .into_iter()
        .filter(|item| return item.original_path() == path)
        .max_by_key(|item| return item.time_deleted)
        .ok_or_else(|| return FileActionError::Restore(format!("{} is not in the trash", path.display())))?;
    return trash::os_limited::restore_all([newest])
        .map_err(|error| return FileActionError::Restore(error.to_string()));
}

/// What: `restore_from_trash` on macOS reports that the trash crate cannot restore files there.
/// Why: the Undo message is not offered on this platform, so this branch is a guard only.
#[cfg(not(any(
    windows,
    all(unix, not(any(target_os = "macos", target_os = "ios", target_os = "android")))
)))]
pub fn restore_from_trash(_path: &Path) -> Result<(), FileActionError> {
    return Err(FileActionError::Restore("the trash cannot be restored on this platform".to_string()));
}

#[cfg(test)]
#[path = "ui_files_tests.rs"]
mod tests;
