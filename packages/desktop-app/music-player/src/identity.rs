//! Single source of truth for the application's platform identity strings.
//!
//! The app is named in three different identity systems, and the strings MUST
//! NOT drift, so they live here instead of scattered across modules:
//!
//! - Linux: `APP_ID` (`monochromatic.music-player`) is the Wayland app id, the
//!   X11 `WM_CLASS`, and the `<APP_ID>.desktop` basename. KDE matches the
//!   running window to the launcher entry by it, and
//!   `share/applications/monochromatic.music-player.desktop` is named after it,
//!   so changing it is a breaking change. Read only on Linux (launcher.rs).
//! - macOS: the bundle id is `MACOS_BUNDLE_IDENTIFIER`
//!   (`com.monochromatic.music-player`). It actually lives in `macos/Info.plist`
//!   (XML cannot share a Rust constant); it is mirrored here so the value has
//!   one documented home and a test can assert the plist matches.
//! - All platforms: the per-user config directory is derived from the
//!   reverse-DNS triple (`CONFIG_QUALIFIER`, `CONFIG_ORGANIZATION`,
//!   `CONFIG_APPLICATION`) by the `directories` crate (session.rs). Changing any
//!   of the three moves every existing user's `session.json`, so they are fixed.
//!
//! The three reverse-DNS roots differ on purpose (`monochromatic.`,
//! `com.monochromatic.`, `dev.Monochromatic.`); collecting them here makes that
//! divergence visible rather than looking like drift.

// What:     `pub const APP_ID: &str = "monochromatic.music-player";`. A module-
//           level immutable string constant. `&str` is a borrowed string slice
//           (sibling: the owned, heap-allocated `String`); a `const` `&str`
//           points at bytes baked into the binary, so no allocation happens.
// Why:      One name for the Wayland app id / WM_CLASS / `.desktop` basename, so
//           the window, the desktop file, and KDE's launcher matching can never
//           disagree. Declared on every platform (only Linux reads it); a `pub`
//           constant unused inside this library is NOT dead code, so non-Linux
//           builds stay warning-clean without a `#[cfg]`.
// TS map:   `export const APP_ID = "monochromatic.music-player";`
//
// In TS you'd write (pseudocode):
// ```ts
// export const APP_ID = "monochromatic.music-player";
// ```
pub const APP_ID: &str = "monochromatic.music-player";

// What:     `pub const MACOS_BUNDLE_IDENTIFIER: &str = "com.monochromatic.music-player";`.
//           Another `const` string slice (see `APP_ID` for the `&str` vs `String`
//           note).
// Why:      The macOS `CFBundleIdentifier` is authored in `macos/Info.plist`, but
//           recording it here gives the value a single documented home and lets a
//           unit test assert the plist still contains it, catching silent drift.
// TS map:   `export const MACOS_BUNDLE_IDENTIFIER = "com.monochromatic.music-player";`
//
// In TS you'd write (pseudocode):
// ```ts
// export const MACOS_BUNDLE_IDENTIFIER = "com.monochromatic.music-player";
// ```
pub const MACOS_BUNDLE_IDENTIFIER: &str = "com.monochromatic.music-player";

// What:     `pub const CONFIG_QUALIFIER: &str = "dev";`. The first of the three
//           reverse-DNS parts the `directories` crate's `ProjectDirs::from`
//           takes (qualifier, organization, application).
// Why:      Pulling the literal out of session.rs means the config-dir identity
//           is named in one place next to the other identifiers.
// TS map:   `export const CONFIG_QUALIFIER = "dev";`
//
// In TS you'd write (pseudocode):
// ```ts
// export const CONFIG_QUALIFIER = "dev";
// ```
pub const CONFIG_QUALIFIER: &str = "dev";

// What:     `pub const CONFIG_ORGANIZATION: &str = "Monochromatic";`. The second
//           `ProjectDirs::from` part (the organization name).
// Why:      Same single-source-of-truth reason as `CONFIG_QUALIFIER`.
// TS map:   `export const CONFIG_ORGANIZATION = "Monochromatic";`
//
// In TS you'd write (pseudocode):
// ```ts
// export const CONFIG_ORGANIZATION = "Monochromatic";
// ```
pub const CONFIG_ORGANIZATION: &str = "Monochromatic";

// What:     `pub const CONFIG_APPLICATION: &str = "music-player";`. The third
//           `ProjectDirs::from` part (the application name); also the last
//           segment of the config directory path.
// Why:      Same single-source-of-truth reason as `CONFIG_QUALIFIER`.
// TS map:   `export const CONFIG_APPLICATION = "music-player";`
//
// In TS you'd write (pseudocode):
// ```ts
// export const CONFIG_APPLICATION = "music-player";
// ```
pub const CONFIG_APPLICATION: &str = "music-player";
