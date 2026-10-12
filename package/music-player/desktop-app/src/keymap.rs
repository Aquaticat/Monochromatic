//! Keyboard shortcut classifier,
//!  ported from `KeyboardMap.kt`,
//!  which follows the
//! accepted keyboard-map prototype.
//!
//! The rule groups run in the prototype's order,
//!  and the first group that yields
//! an action decides the result.
//!  Unknown platform names are rejected by
//! `KeyboardPlatform::from_name` before a request can be built,
//!  so
//! `shortcut_action` never sees one.

/// What:
///      `pub enum KeyboardPlatform` names the two keyboard maps the classifier understands.
/// Why:
///      The same key means different shortcuts on each map,
///  so the map is a closed enum.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type KeyboardPlatform = "windows-linux" | "mac";
/// ```
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KeyboardPlatform {
    /// Windows and Linux map,
    ///  where Control is the primary modifier.
    WindowsLinux,
    /// macOS map,
    ///  where Command is the primary modifier.
    Mac,
}

/// Methods of `KeyboardPlatform`.
impl KeyboardPlatform {
    /// What:
    ///      `pub const ALL` lists both maps in declaration order.
    /// Why:
    ///      `from_name` searches this list,
    ///  so the accepted names live in one place.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// const ALL: readonly KeyboardPlatform[] = ["windows-linux", "mac"];
    /// ```
    pub const ALL: [KeyboardPlatform; 2] = [KeyboardPlatform::WindowsLinux, KeyboardPlatform::Mac];

    /// What:
    ///      `stored_name` returns the stable text for this map.
    /// Why:
    ///      The prototype and its tests refer to platforms by this exact text.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// function storedName(platform: KeyboardPlatform): string;
    /// ```
    pub fn stored_name(self) -> &'static str {
        return match self {
            Self::WindowsLinux => "windows-linux",
            Self::Mac => "mac",
        };
    }

    /// What:
    ///      `from_name` returns the map whose stored name equals `text`,
    ///  or an error for any other text.
    /// Why:
    ///      Unknown text must not silently choose a map,
    ///  and the match is exact and case-sensitive.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// function fromName(text: string): KeyboardPlatform {
    ///   if (text === "windows-linux") return "windows-linux";
    ///   if (text === "mac") return "mac";
    ///   throw new Error("Unknown keyboard-map platform.");
    /// }
    /// ```
    ///
    /// # Errors
    ///
    /// Returns `KeymapError::UnknownPlatform` when no stored name equals `text`.
    pub fn from_name(text: &str) -> Result<Self, KeymapError> {
        return Self::ALL
            .into_iter()
            .find(|platform| return platform.stored_name() == text)
            .ok_or(KeymapError::UnknownPlatform);
    }
}

/// What:
///      `pub enum KeymapError` is the failure of `KeyboardPlatform::from_name`.
/// Why:
///      A typed error lets callers match on the cause,
///  and its `Display` keeps the prototype's exact message.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// class KeymapError extends Error { /* "Unknown keyboard-map platform." */ }
/// ```
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KeymapError {
    /// The text names neither keyboard map.
    UnknownPlatform,
}

/// Display text for `KeymapError`.
impl std::fmt::Display for KeymapError {
    /// What:
    ///      `fmt` writes the message the prototype throws for an unknown platform.
    /// Why:
    ///      Callers and the tests compare this exact text.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// toString(): string { return "Unknown keyboard-map platform."; }
    /// ```
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        return match self {
            Self::UnknownPlatform => formatter.write_str("Unknown keyboard-map platform."),
        };
    }
}

/// Marks `KeymapError` as a standard error.
impl std::error::Error for KeymapError {}

/// What:
///      `pub enum ShortcutOwner` names the focus owner that received a key.
/// Why:
///      Owners decide whether a key belongs to the player or to a widget.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type ShortcutOwner = "player" | "editor" | "control" | "surface";
/// ```
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ShortcutOwner {
    /// The playback shortcut area itself,
    ///  the only owner that gets transport keys.
    Player,
    /// A text field or editable region that keeps its own keys.
    Editor,
    /// A focused button,
    ///  input,
    ///  select,
    ///  or summary that keeps its own keys.
    Control,
    /// Any other surface,
    ///  whose keys are never bound to playback.
    Surface,
}

/// What:
///      `pub enum ShortcutAction` lists every result the classifier can return.
/// Why:
///      Each variant maps to one named result,
///  and `wire_name` keeps the prototype's spelling.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type ShortcutAction = "toggle" | "owner" | "ignore-repeat" | "search" | "picker" | "settings"
///   | "previous" | "next" | "close-popup" | "back" | "reveal" | "mode" | "unbound";
/// ```
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ShortcutAction {
    /// The focused text,
    ///  control,
    ///  or composition keeps this key.
    Owner,
    /// Escape closes the open popup.
    ClosePopup,
    /// Opens or focuses Search.
    Search,
    /// Opens the current-library folder picker.
    Picker,
    /// Opens in-app Settings.
    Settings,
    /// Focuses the current track row without a transport action.
    Reveal,
    /// Returns from Search or Settings to the player.
    Back,
    /// No shortcut applies.
    Unbound,
    /// A repeated key event that the player ignores.
    IgnoreRepeat,
    /// Plays or pauses the player.
    Toggle,
    /// Cycles the end-of-track mode.
    Mode,
    /// Moves to the previous track.
    Previous,
    /// Moves to the next track.
    Next,
}

/// Methods of `ShortcutAction`.
impl ShortcutAction {
    /// What:
    ///      `wire_name` returns the action text exactly as the prototype returns it.
    /// Why:
    ///      Tests and any future bridge compare the same spelling the prototype uses.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// function wireName(action: ShortcutAction): string;
    /// ```
    pub fn wire_name(self) -> &'static str {
        return match self {
            Self::Owner => "owner",
            Self::ClosePopup => "close-popup",
            Self::Search => "search",
            Self::Picker => "picker",
            Self::Settings => "settings",
            Self::Reveal => "reveal",
            Self::Back => "back",
            Self::Unbound => "unbound",
            Self::IgnoreRepeat => "ignore-repeat",
            Self::Toggle => "toggle",
            Self::Mode => "mode",
            Self::Previous => "previous",
            Self::Next => "next",
        };
    }
}

/// What:
///      `pub struct ShortcutRequest` is one key press with the focus and popup state the classifier reads.
/// Why:
///      The classifier needs all of these inputs together,
///  and named fields keep call sites readable.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type ShortcutRequest = {
///   platform: KeyboardPlatform; key: string; ctrl: boolean; meta: boolean; alt: boolean;
///   shift: boolean; repeat: boolean; owner: ShortcutOwner; inPopup: boolean;
///   inSearch: boolean; inSettings: boolean; composing: boolean;
/// };
/// ```
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ShortcutRequest {
    /// Keyboard map that interprets the key.
    pub platform: KeyboardPlatform,
    /// Key text as the platform reports it,
    ///  such as `f`,
    ///  ` `,
    ///  or `ArrowLeft`.
    pub key: String,
    /// True while Control is held.
    pub ctrl: bool,
    /// True while Command (macOS) or Meta (Windows and Linux) is held.
    pub meta: bool,
    /// True while Alt or Option is held.
    pub alt: bool,
    /// True while Shift is held.
    pub shift: bool,
    /// True when the event is an auto-repeat of a held key.
    pub repeat: bool,
    /// Focus owner that received the key.
    pub owner: ShortcutOwner,
    /// True while a popup is open.
    pub in_popup: bool,
    /// True while Search is open.
    pub in_search: bool,
    /// True while the Settings page is the visible page and no text field is editing a template line,
    ///  so Escape closes Settings (D110).
    pub in_settings: bool,
    /// True while an input method is composing text.
    pub composing: bool,
}

/// What:
///      `pub fn shortcut_action` classifies one key press into the action the prototype would take.
/// Why:
///      It is the port of the prototype's classifier,
///  and the first group that matches decides.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function shortcutAction(request: ShortcutRequest): ShortcutAction {
///   return composingOrPopupAction(request) ?? searchAndPickerAction(request) ?? /* ... */ ?? "unbound";
/// }
/// ```
pub fn shortcut_action(request: &ShortcutRequest) -> ShortcutAction {
    return composing_or_popup_action(request)
        .or_else(|| return search_and_picker_action(request))
        .or_else(|| return settings_action(request))
        .or_else(|| return reveal_action(request))
        .or_else(|| return owner_action(request))
        .or_else(|| return player_key_action(request))
        .unwrap_or(ShortcutAction::Unbound);
}

/// What:
///      `composing_or_popup_action` handles an input method still composing,
///  and an open popup.
/// Why:
///      These rules come first,
///  so a composing key or a popup key never reaches a shortcut.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function composingOrPopupAction(request: ShortcutRequest): ShortcutAction | null {
///   if (request.composing) return "owner";
///   if (request.inPopup) return request.key === "Escape" ? "close-popup" : "owner";
///   return null;
/// }
/// ```
fn composing_or_popup_action(request: &ShortcutRequest) -> Option<ShortcutAction> {
    if request.composing {
        return Some(ShortcutAction::Owner);
    }
    if request.in_popup {
        if request.key == "Escape" {
            return Some(ShortcutAction::ClosePopup);
        }
        return Some(ShortcutAction::Owner);
    }
    return None;
}

/// What:
///      `search_and_picker_action` handles primary plus F (Search) and primary plus O (folder picker).
/// Why:
///      Search and the folder picker are the first letter shortcuts in the prototype's order.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function searchAndPickerAction(request: ShortcutRequest): ShortcutAction | null {
///   if (isPrimaryLetter(request, "f")) return "search";
///   if (isPrimaryLetter(request, "o")) return "picker";
///   return null;
/// }
/// ```
fn search_and_picker_action(request: &ShortcutRequest) -> Option<ShortcutAction> {
    if is_primary_letter(request, "f") {
        return Some(ShortcutAction::Search);
    }
    if is_primary_letter(request, "o") {
        return Some(ShortcutAction::Picker);
    }
    return None;
}

/// What:
///      `settings_action` handles the two Settings chords,
///  one for each keyboard map.
/// Why:
///      Settings chords come after the letter shortcuts and before reveal in the prototype's order.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function settingsAction(request: ShortcutRequest): ShortcutAction | null {
///   if (platform === "mac" && onlyMeta && key === ",") return "settings";
///   if (platform === "windows-linux" && onlyCtrlAlt && lowerKey === "s") return "settings";
///   return null;
/// }
/// ```
fn settings_action(request: &ShortcutRequest) -> Option<ShortcutAction> {
    if request.platform == KeyboardPlatform::Mac && only_meta(request) && request.key == "," {
        return Some(ShortcutAction::Settings);
    }
    if request.platform == KeyboardPlatform::WindowsLinux
        && only_ctrl_alt(request)
        && has_letter_key(request, "s")
    {
        return Some(ShortcutAction::Settings);
    }
    return None;
}

/// What:
///      `reveal_action` handles the reveal chord,
///  which uses G on Windows and Linux and L on macOS.
/// Why:
///      Reveal focuses the current track without a transport action,
///  so it has its own group.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function revealAction(request: ShortcutRequest): ShortcutAction | null {
///   if (isPrimaryLetter(request, request.platform === "mac" ? "l" : "g")) return "reveal";
///   return null;
/// }
/// ```
fn reveal_action(request: &ShortcutRequest) -> Option<ShortcutAction> {
    if is_primary_letter(request, reveal_key_for(request.platform)) {
        return Some(ShortcutAction::Reveal);
    }
    return None;
}

/// What:
///      `owner_action` decides keys by who owns focus:
///  Escape back from Search or from Settings,
///  editors and controls,
///      and any non-player surface.
/// Why:
///      Text and controls keep their own keys,
///  and surfaces that are not the player stay unbound.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function ownerAction(request: ShortcutRequest): ShortcutAction | null {
///   if (request.key === "Escape" && (request.inSearch || request.inSettings)) return "back";
///   if (owner === "editor" || owner === "control") return "owner";
///   if (owner !== "player") return "unbound";
///   return null;
/// }
/// ```
fn owner_action(request: &ShortcutRequest) -> Option<ShortcutAction> {
    if request.key == "Escape" && (request.in_search || request.in_settings) {
        return Some(ShortcutAction::Back);
    }
    if matches!(request.owner, ShortcutOwner::Editor | ShortcutOwner::Control) {
        return Some(ShortcutAction::Owner);
    }
    if request.owner != ShortcutOwner::Player {
        return Some(ShortcutAction::Unbound);
    }
    return None;
}

/// What:
///      `player_key_action` handles the keys the player owns:
///  repeat,
///  Space,
///  Control plus M,
///      and the two track-change chords per map.
/// Why:
///      These keys act only when the playback area has focus,
///  which the owner group has already checked.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function playerKeyAction(request: ShortcutRequest): ShortcutAction | null {
///   if (repeat) return "ignore-repeat";
///   if (noModifiers && key === " ") return "toggle";
///   if (onlyCtrl && lowerKey === "m") return "mode";
///   // ...the Windows and Linux arrows and the macOS brackets follow...
///   return null;
/// }
/// ```
fn player_key_action(request: &ShortcutRequest) -> Option<ShortcutAction> {
    if request.repeat {
        return Some(ShortcutAction::IgnoreRepeat);
    }
    if no_modifiers(request) && request.key == " " {
        return Some(ShortcutAction::Toggle);
    }
    if only_ctrl(request) && has_letter_key(request, "m") {
        return Some(ShortcutAction::Mode);
    }
    if request.platform == KeyboardPlatform::WindowsLinux && only_ctrl(request) {
        if request.key == "ArrowLeft" {
            return Some(ShortcutAction::Previous);
        }
        if request.key == "ArrowRight" {
            return Some(ShortcutAction::Next);
        }
    }
    if request.platform == KeyboardPlatform::Mac && only_meta_shift(request) {
        if request.key == "[" || request.key == "{" {
            return Some(ShortcutAction::Previous);
        }
        if request.key == "]" || request.key == "}" {
            return Some(ShortcutAction::Next);
        }
    }
    return None;
}

/// What:
///      `is_primary_letter` is true when only the primary modifier is held and the key is the given letter.
/// Why:
///      Search,
///  the folder picker,
///  and reveal all use this same combination with different letters.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const isPrimaryLetter = (request: ShortcutRequest, letter: string) =>
///   isPlainPrimary(request) && request.key.toLowerCase() === letter;
/// ```
fn is_primary_letter(request: &ShortcutRequest, letter: &str) -> bool {
    return is_plain_primary(request) && has_letter_key(request, letter);
}

/// What:
///      `is_plain_primary` is true when the primary modifier is held,
///  the other one is not,
///      and neither Alt nor Shift is held.
/// Why:
///      Every letter shortcut needs exactly this modifier combination.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const isPlainPrimary = (request: ShortcutRequest) =>
///   primary && !otherPrimary && !request.altKey && !request.shiftKey;
/// ```
fn is_plain_primary(request: &ShortcutRequest) -> bool {
    let primary = primary_pressed(request);
    let other_primary = other_primary_pressed(request);
    return primary && !other_primary && no_alt_or_shift(request);
}

/// What:
///      `has_letter_key` compares the key text,
///  ignoring letter case,
///  with a lowercase letter.
/// Why:
///      A shortcut must match the letter whether or not Shift changed its case.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const hasLetterKey = (request: ShortcutRequest, letter: string) => request.key.toLowerCase() === letter;
/// ```
fn has_letter_key(request: &ShortcutRequest, letter: &str) -> bool {
    return request.key.to_lowercase() == letter;
}

/// What:
///      `no_modifiers` is true when Control,
///  Command or Meta,
///  Alt,
///  and Shift are all released.
/// Why:
///      Plain keys such as Space must not fire while any modifier is held.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const noModifiers = (r: ShortcutRequest) => !r.ctrlKey && !r.metaKey && !r.altKey && !r.shiftKey;
/// ```
fn no_modifiers(request: &ShortcutRequest) -> bool {
    return !request.ctrl && !request.meta && no_alt_or_shift(request);
}

/// What:
///      `only_ctrl` is true when Control is held and Meta,
///  Alt,
///  and Shift are released.
/// Why:
///      Control-only chords,
///  such as Control plus M and the Windows and Linux track arrows,
///  need this.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const onlyCtrl = (r: ShortcutRequest) => r.ctrlKey && !r.metaKey && !r.altKey && !r.shiftKey;
/// ```
fn only_ctrl(request: &ShortcutRequest) -> bool {
    return request.ctrl && !request.meta && no_alt_or_shift(request);
}

/// What:
///      `only_meta` is true when Meta (Command) is held and Control,
///  Alt,
///  and Shift are released.
/// Why:
///      The macOS Settings chord is Command with no other modifier.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const onlyMeta = (r: ShortcutRequest) => r.metaKey && !r.ctrlKey && !r.altKey && !r.shiftKey;
/// ```
fn only_meta(request: &ShortcutRequest) -> bool {
    return request.meta && !request.ctrl && no_alt_or_shift(request);
}

/// What:
///      `only_ctrl_alt` is true when Control and Alt are held and Meta and Shift are released.
/// Why:
///      The Windows and Linux Settings chord is Control plus Alt with no other modifier.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const onlyCtrlAlt = (r: ShortcutRequest) => r.ctrlKey && r.altKey && !r.metaKey && !r.shiftKey;
/// ```
fn only_ctrl_alt(request: &ShortcutRequest) -> bool {
    return request.ctrl && request.alt && no_meta_or_shift(request);
}

/// What:
///      `only_meta_shift` is true when Meta and Shift are held and Control and Alt are released.
/// Why:
///      The macOS track-change chords are Command plus Shift with no other modifier.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const onlyMetaShift = (r: ShortcutRequest) => r.metaKey && r.shiftKey && !r.ctrlKey && !r.altKey;
/// ```
fn only_meta_shift(request: &ShortcutRequest) -> bool {
    return request.meta && request.shift && no_ctrl_or_alt(request);
}

/// What:
///      `no_alt_or_shift` is true when Alt and Shift are both released.
/// Why:
///      Most shortcut rules require Alt and Shift to be off,
///  so the check has a single name.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const noAltOrShift = (r: ShortcutRequest) => !r.altKey && !r.shiftKey;
/// ```
fn no_alt_or_shift(request: &ShortcutRequest) -> bool {
    return !request.alt && !request.shift;
}

/// What:
///      `no_meta_or_shift` is true when Meta and Shift are both released.
/// Why:
///      The Control-plus-Alt chord must not also have Meta or Shift held.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const noMetaOrShift = (r: ShortcutRequest) => !r.metaKey && !r.shiftKey;
/// ```
fn no_meta_or_shift(request: &ShortcutRequest) -> bool {
    return !request.meta && !request.shift;
}

/// What:
///      `no_ctrl_or_alt` is true when Control and Alt are both released.
/// Why:
///      The macOS bracket chords must not also have Control or Alt held.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const noCtrlOrAlt = (r: ShortcutRequest) => !r.ctrlKey && !r.altKey;
/// ```
fn no_ctrl_or_alt(request: &ShortcutRequest) -> bool {
    return !request.ctrl && !request.alt;
}

/// What:
///      `primary_pressed` reads the primary modifier:
///  Control on Windows and Linux,
///  Command on macOS.
/// Why:
///      Each keyboard map has one primary modifier,
///  and the letter shortcuts check it first.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const primaryPressed = (request: ShortcutRequest) => request.platform === "mac" ? request.meta : request.ctrl;
/// ```
fn primary_pressed(request: &ShortcutRequest) -> bool {
    return match request.platform {
        KeyboardPlatform::WindowsLinux => request.ctrl,
        KeyboardPlatform::Mac => request.meta,
    };
}

/// What:
///      `other_primary_pressed` reads the modifier that is not primary on this platform.
/// Why:
///      A letter shortcut must not also have that other modifier pressed.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const otherPrimaryPressed = (request: ShortcutRequest) => request.platform === "mac" ? request.ctrl : request.meta;
/// ```
fn other_primary_pressed(request: &ShortcutRequest) -> bool {
    return match request.platform {
        KeyboardPlatform::WindowsLinux => request.meta,
        KeyboardPlatform::Mac => request.ctrl,
    };
}

/// What:
///      `reveal_key_for` returns the lowercase letter that triggers reveal on this platform.
/// Why:
///      Reveal uses G on Windows and Linux and L on macOS,
///  and the classifier compares against it.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const revealKeyFor = (platform: KeyboardPlatform): string => platform === "mac" ? "l" : "g";
/// ```
fn reveal_key_for(platform: KeyboardPlatform) -> &'static str {
    return match platform {
        KeyboardPlatform::WindowsLinux => "g",
        KeyboardPlatform::Mac => "l",
    };
}

/// Unit tests in `keymap_tests.rs`,
///  pulled in at this point.
#[cfg(test)]
#[path = "keymap_tests.rs"]
mod tests;
