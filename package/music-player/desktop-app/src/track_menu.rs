//! Track context menu actions,
//!  ported from `TrackMenuAction.kt` and the pure
//! helpers in `TrackMenuPopup.kt` (`trackMenuDividerFlags`,
//!  `trackMenuDetailsSuffix`).
//!
//! The action list is pure data shared by the menu,
//!  its tests,
//!  and later wiring.
//! The order and the visible wording are accepted decision D7 text.

/// What:
///      `pub enum TrackMenuAction` declares the seven actions of the track context menu.
/// Why:
///      A closed enum keeps an extra action out of the menu,
///  and the variant order is the display order.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type TrackMenuAction = "play" | "shuffleFromHere" | "details" | "reanalyse"
///   | "showInFileManager" | "copyFilename" | "moveToTrash";
/// ```
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrackMenuAction {
    /// Starts playback of the track from its beginning.
    Play,
    /// Starts shuffled playback beginning at the track.
    ShuffleFromHere,
    /// Shows the file information for the track.
    Details,
    /// Repeats the true-peak analysis of the track.
    ReanalyseTruePeak,
    /// Reveals the track file in the system file manager.
    ShowInFileManager,
    /// Copies the file name of the track to the clipboard.
    CopyFilename,
    /// Moves the track file to the trash,
    ///  which the menu marks as destructive.
    MoveToTrash,
}

/// What:
///      `TRACK_MENU_ACTIONS` lists the seven actions in display order.
/// Why:
///      Decision D7 shows the same seven actions for every track,
///  so one static list serves all of them.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const allActions: readonly TrackMenuAction[] = ["play", "shuffleFromHere", ...];
/// ```
const TRACK_MENU_ACTIONS: [TrackMenuAction; 7] = [
    TrackMenuAction::Play,
    TrackMenuAction::ShuffleFromHere,
    TrackMenuAction::Details,
    TrackMenuAction::ReanalyseTruePeak,
    TrackMenuAction::ShowInFileManager,
    TrackMenuAction::CopyFilename,
    TrackMenuAction::MoveToTrash,
];

/// Methods of `TrackMenuAction`.
impl TrackMenuAction {
    /// What:
    ///      `group` returns the divider section an action belongs to.
    /// Why:
    ///      Neighbours with equal groups share a section,
    ///  and a change between neighbours starts a new one.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// group: number;
    /// ```
    pub fn group(self) -> u8 {
        return match self {
            Self::Play | Self::ShuffleFromHere => 0,
            Self::Details | Self::ReanalyseTruePeak => 1,
            Self::ShowInFileManager | Self::CopyFilename | Self::MoveToTrash => 2,
        };
    }

    /// What:
    ///      `destructive` is true only for the action that removes the file from storage.
    /// Why:
    ///      The menu shows destruction with a label and icon as well as the error role,
    ///  never color alone.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// destructive: boolean;
    /// ```
    pub fn destructive(self) -> bool {
        return matches!(self, Self::MoveToTrash);
    }
}

/// What:
///      `pub fn track_menu_actions_for` returns the ordered menu for any track.
/// Why:
///      The menu is the same for every track,
///  so no track state is needed.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function trackMenuActionsFor(): readonly TrackMenuAction[] { return allActions; }
/// ```
pub fn track_menu_actions_for() -> &'static [TrackMenuAction] {
    return &TRACK_MENU_ACTIONS;
}

/// What:
///      `pub fn label` returns the exact visible wording of one action.
/// Why:
///      The wording is accepted D7 text,
///  so it lives beside the action identities.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function label(action: TrackMenuAction): string { /* exhaustive switch */ }
/// ```
pub fn label(action: TrackMenuAction) -> &'static str {
    return match action {
        TrackMenuAction::Play => "Play",
        TrackMenuAction::ShuffleFromHere => "Start shuffle from here",
        TrackMenuAction::Details => "File details",
        TrackMenuAction::ReanalyseTruePeak => "Re-analyse true peak",
        TrackMenuAction::ShowInFileManager => "Show in file manager",
        TrackMenuAction::CopyFilename => "Copy filename",
        TrackMenuAction::MoveToTrash => "Move to trash",
    };
}

/// What:
///      `pub fn track_menu_divider_flags` marks,
///  for each action,
///  whether a divider is drawn just before it.
/// Why:
///      Dividers are drawn at group changes,
///  so the first action never gets one and an empty menu gets none.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function trackMenuDividerFlags(actions: TrackMenuAction[]): boolean[] {
///   return actions.map((action, index) => index > 0 && action.group !== actions[index - 1].group);
/// }
/// ```
pub fn track_menu_divider_flags(actions: &[TrackMenuAction]) -> Vec<bool> {
    return actions
        .iter()
        .enumerate()
        .map(|(index, action)| return index > 0 && action.group() != actions[index - 1].group())
        .collect();
}

/// What:
///      `pub fn track_menu_details_suffix` returns the text appended after File details.
/// Why:
///      The dB value joins the label with a middle dot,
///  and an absent or blank value adds no text at all.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function trackMenuDetailsSuffix(detailsValue: string | null): string {
///   return detailsValue === null || detailsValue.trim() === "" ? "" : ` · ${detailsValue}`;
/// }
/// ```
pub fn track_menu_details_suffix(details_value: Option<&str>) -> String {
    return match details_value {
        Some(value) if !value.trim().is_empty() => format!(" · {value}"),
        _ => String::new(),
    };
}

/// Unit tests in `track_menu_tests.rs`,
///  pulled in at this point.
#[cfg(test)]
#[path = "track_menu_tests.rs"]
mod tests;
