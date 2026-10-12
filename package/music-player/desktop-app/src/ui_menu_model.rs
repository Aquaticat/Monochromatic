//! Pure track menu model: the rows, icons and dividers for one track.
//!
//! What: `menu_items` builds the menu rows from the shared action list in `track_menu`.
//! Why: the action order, the grouping and the destructive row come from the Rust model; the window
//! only draws them.

use music_player::track_menu::{TrackMenuAction, label, track_menu_actions_for, track_menu_divider_flags};

/// What: `MenuItemView` is one menu row as plain values.
/// Why: the window's `TrackMenuItem` struct holds Slint strings, which the pure model does not.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type MenuItemView = { label: string; icon: number; destructive: boolean; dividerBefore: boolean; value: string };
/// ```
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct MenuItemView {
    /// Visible label of the action.
    pub label: String,
    /// Glyph index in the menu's icon order.
    pub icon: i32,
    /// True for the destructive action.
    pub destructive: bool,
    /// True when a divider sits above this row.
    pub divider_before: bool,
    /// Inline value after the label; only the details row carries one.
    pub value: String,
}

/// What: `icon_index` gives the glyph index the menu component draws for an action.
/// Why: the menu's icon order is fixed: play, shuffle, details, re-analyse, show, copy, trash.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const iconIndex = (action: TrackMenuAction): number => ICON_ORDER.indexOf(action);
/// ```
pub fn icon_index(action: TrackMenuAction) -> i32 {
    return match action {
        TrackMenuAction::Play => 0,
        TrackMenuAction::ShuffleFromHere => 1,
        TrackMenuAction::Details => 2,
        TrackMenuAction::ReanalyseTruePeak => 3,
        TrackMenuAction::ShowInFileManager => 4,
        TrackMenuAction::CopyFilename => 5,
        TrackMenuAction::MoveToTrash => 6,
    };
}

/// What: `menu_items` builds every menu row, with the file size as the details value.
/// Why: the details row shows its value inline (D7), and the value is read when the menu opens.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const menuItems = (size: string | null): MenuItemView[] => { ... };
/// ```
pub fn menu_items(size_text: Option<&str>) -> Vec<MenuItemView> {
    let actions = track_menu_actions_for();
    let dividers = track_menu_divider_flags(actions);
    return actions
        .iter()
        .zip(dividers)
        .map(|(action, divider)| return MenuItemView {
            label: label(*action).to_string(),
            icon: icon_index(*action),
            destructive: action.destructive(),
            divider_before: divider,
            value: match action {
                TrackMenuAction::Details => size_text.unwrap_or("").to_string(),
                _ => String::new(),
            },
        })
        .collect();
}

/// What: `human_size` formats a byte count with one decimal in KB, MB or GB.
/// Why: the details row shows a size a person can read at a glance.
pub fn human_size(bytes: u64) -> String {
    const KB: f64 = 1024.0;
    let value = bytes as f64;
    if value >= KB * KB * KB {
        return format!("{:.1} GB", value / (KB * KB * KB));
    }
    if value >= KB * KB {
        return format!("{:.1} MB", value / (KB * KB));
    }
    return format!("{:.1} KB", value / KB);
}

#[cfg(test)]
#[path = "ui_menu_model_tests.rs"]
mod tests;
