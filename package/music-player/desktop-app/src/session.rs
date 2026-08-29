//! Desktop session persistence. Current JSON stores one `playback_mode`; former
//! `shuffle` and `repeat_track` fields exist only in the private read model used
//! during migration.

/// Owned filesystem path used for the source root and selected track.
use std::path::PathBuf;

/// Serde derives used by current output and the private migration input.
use serde::{Deserialize, Serialize};

/// Current four-state playback model.
use crate::command::PlaybackMode;

/// Shared application identity used to resolve the config directory.
use crate::identity;

/// Saved visual treatment for library page selectors.
#[derive(Clone, Copy, Debug, Default, PartialEq, Serialize, Deserialize)]
pub enum PageControlStyle {
    /// Radio indicators and labels in a wrapping group.
    Radio,
    /// Flat wrapping Material Design 1 tabs with selected underlines.
    Md1Tabs,
    /// Filled or outlined rounded buttons.
    RoundedButtons,
    /// Joined content-width buttons with selected fill.
    SegmentedButtons,
    /// Content-width browser tabs with active-tab silhouettes.
    #[default]
    ChromiumTabs,
    /// Reflective hardware caps with latched LED selection.
    LedSegmentedButtons,
}

/// Converts page styles at the Slint integer boundary.
impl PageControlStyle {
    /// Converts this style to Slint's stable integer representation.
    pub fn to_int(self) -> i32 {
        if self == PageControlStyle::Md1Tabs {
            return 1;
        }
        if self == PageControlStyle::RoundedButtons {
            return 2;
        }
        if self == PageControlStyle::SegmentedButtons {
            return 3;
        }
        if self == PageControlStyle::ChromiumTabs {
            return 4;
        }
        if self == PageControlStyle::LedSegmentedButtons {
            return 5;
        }
        return 0;
    }

    /// Decodes Slint's integer representation with a radio fallback.
    pub fn from_int(value: i32) -> PageControlStyle {
        if value == 1 {
            return PageControlStyle::Md1Tabs;
        }
        if value == 2 {
            return PageControlStyle::RoundedButtons;
        }
        if value == 3 {
            return PageControlStyle::SegmentedButtons;
        }
        if value == 4 {
            return PageControlStyle::ChromiumTabs;
        }
        if value == 5 {
            return PageControlStyle::LedSegmentedButtons;
        }
        return PageControlStyle::Radio;
    }
}

/// Current session shape written to disk.
#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct Session {
    /// Opened directory whose scan produces the queue.
    pub source_root: Option<PathBuf>,
    /// Selected track path, or no selection.
    pub selected: Option<PathBuf>,
    /// Resume position in seconds.
    pub position_secs: f64,
    /// Output gain from zero to one.
    pub volume: f32,
    /// Single selected completion and transport behavior.
    pub playback_mode: PlaybackMode,
    /// Selected page-navigation treatment.
    pub page_control_style: PageControlStyle,
}

/// Private permissive input shape that recognizes current and former fields.
#[derive(Debug, Deserialize)]
#[serde(default)]
struct StoredSession {
    /// Current source root.
    source_root: Option<PathBuf>,
    /// Current selected track.
    selected: Option<PathBuf>,
    /// Current resume position.
    position_secs: f64,
    /// Current output gain.
    volume: f32,
    /// Current explicit wire text. Unknown text still counts as a current field.
    playback_mode: Option<String>,
    /// Former shuffle enum text, used only when `playback_mode` is absent.
    shuffle: Option<String>,
    /// Former independent repeat flag, including whether the key was present.
    repeat_track: Option<bool>,
    /// Current page-control preference.
    page_control_style: PageControlStyle,
}

/// Supplies defaults for missing fields in the permissive input shape.
impl Default for StoredSession {
    /// Returns missing-field defaults for current and former JSON shapes.
    fn default() -> StoredSession {
        return StoredSession {
            source_root: None,
            selected: None,
            position_secs: 0.0,
            volume: 1.0,
            playback_mode: None,
            shuffle: None,
            repeat_track: None,
            page_control_style: PageControlStyle::ChromiumTabs,
        };
    }
}

/// Supplies first-run values for the current session shape.
impl Default for Session {
    /// Returns first-run desktop session values.
    fn default() -> Session {
        return Session {
            source_root: None,
            selected: None,
            position_secs: 0.0,
            volume: 1.0,
            playback_mode: PlaybackMode::InOrder,
            page_control_style: PageControlStyle::ChromiumTabs,
        };
    }
}

/// Loads, migrates, and saves sessions.
impl Session {
    /// Converts permissive input into current state and reports whether to rewrite.
    fn from_stored(stored: StoredSession) -> (Session, bool) {
        let should_rewrite =
            stored.playback_mode.is_none() || stored.shuffle.is_some() || stored.repeat_track.is_some();
        let current_mode = stored.playback_mode.as_deref();
        let playback_mode = if current_mode == Some("repeat") {
            PlaybackMode::Repeat
        } else if current_mode == Some("shuffle_page") {
            PlaybackMode::ShufflePage
        } else if current_mode == Some("shuffle_all") {
            PlaybackMode::ShuffleAll
        } else if current_mode.is_some() {
            PlaybackMode::InOrder
        } else if stored.repeat_track == Some(true) {
            PlaybackMode::Repeat
        } else if stored.shuffle.as_deref() == Some("WithinPage") {
            PlaybackMode::ShufflePage
        } else if stored.shuffle.as_deref() == Some("All") {
            PlaybackMode::ShuffleAll
        } else {
            PlaybackMode::InOrder
        };
        return (
            Session {
                source_root: stored.source_root,
                selected: stored.selected,
                position_secs: stored.position_secs,
                volume: stored.volume,
                playback_mode,
                page_control_style: stored.page_control_style,
            },
            should_rewrite,
        );
    }

    /// Parses current or former JSON without exposing migration fields.
    #[cfg(test)]
    fn from_json(text: &str) -> Result<Session, serde_json::Error> {
        let stored: StoredSession = serde_json::from_str(text)?;
        return Ok(Session::from_stored(stored).0);
    }

    /// Reads the session file, returning defaults after any path, I/O, or parse failure.
    pub fn load() -> Session {
        let Some(path) = session_path() else {
            return Session::default();
        };
        let Ok(text) = std::fs::read_to_string(&path) else {
            return Session::default();
        };
        let Ok(stored) = serde_json::from_str::<StoredSession>(&text) else {
            return Session::default();
        };
        let (session, should_rewrite) = Session::from_stored(stored);
        if should_rewrite {
            if let Err(error) = session.save() {
                tracing::warn!(?error, "failed to rewrite migrated playback session");
            }
        }
        return session;
    }

    /// Writes only the current session shape to the app config directory.
    pub fn save(&self) -> std::io::Result<()> {
        let Some(path) = session_path() else {
            return Ok(());
        };
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let json = serde_json::to_string_pretty(self).map_err(std::io::Error::other)?;
        return std::fs::write(&path, json);
    }
}

/// Resolves the app-private session JSON path.
fn session_path() -> Option<PathBuf> {
    return identity::config_dir().map(|directory| directory.join("session.json"));
}

/// Session persistence tests.
#[cfg(test)]
#[path = "session_tests.rs"]
mod tests;
