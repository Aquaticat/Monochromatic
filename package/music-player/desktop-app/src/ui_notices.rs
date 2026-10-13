//! Plain-language messages for events the user did not ask about: a file that cannot be played, a file that left the
//! folder.
//!
//! What: pure functions that turn an engine report into the one or two lines a message shows.
//! Why: D83 says a failure is explained in a floating message that names the file and fits two lines; keeping the words
//! apart from the window code lets tests read them without a window.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! const unplayableMessage = (paths: string[]) => paths.length === 1 ? `${basename(paths[0])} can't be played.` : `${paths.length} files can't be played, including ${basename(paths[0])}.`;
//! ```

use std::path::{Path, PathBuf};

/// What: `file_name_text` is the last component of a path as text, or the whole path when it has none.
/// Why: a message names the file, not its long folder path (D83: two visible lines).
fn file_name_text(path: &Path) -> String {
    return path
        .file_name()
        .map_or_else(|| return path.display().to_string(), |name| return name.to_string_lossy().into_owned());
}

/// What: `unplayable_message` words the report of files that could not be opened for playback.
/// Why: one file is named; several collapse to a count with the first named (D9: a count, not one message per file).
/// An empty report gives an empty message, which the caller does not show.
pub(crate) fn unplayable_message(paths: &[PathBuf]) -> String {
    return match paths {
        [] => String::new(),
        [only] => format!("{} can't be played.", file_name_text(only)),
        [first, rest @ ..] => format!("{} files can't be played, including {}.", rest.len() + 1, file_name_text(first)),
    };
}

/// What: `file_gone_message` words the report that the selected track's file left the folder.
/// Why: the row disappears and playback stops, so the message says which file and, when it was playing, that playback
/// stopped because of it (PB2).
pub(crate) fn file_gone_message(path: &Path, was_playing: bool) -> String {
    let name: String = file_name_text(path);
    if was_playing {
        return format!("{name} was removed from the folder, so playback stopped.");
    }
    return format!("{name} was removed from the folder.");
}

#[cfg(test)]
#[path = "ui_notices_tests.rs"]
mod tests;
