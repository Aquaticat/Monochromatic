//! How the embedding application sets the Language module up:
//!  the launch policy,
//!  the private state directory,
//!  the mise policy,
//!  and extra definitions.

/// The launch seam decides what is spawned for each server.
use crate::language::launch::{LaunchPolicy, launch_directly};
/// The mise policy decides whether and how a project's mise tools are looked up.
use crate::language::mise::{MisePolicy, resolve_confined, resolve_disabled};
/// What:
///  `PathBuf` is an owned filesystem path.
/// Why:
///  The state root is chosen by the application and stored for the whole session.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type PathBuf = string;
/// ```
use std::path::PathBuf;

/// What:
///  How the embedding application sets the Language module up.
///  `Option<...>` fields are
///       "a value,
///  or nothing".
/// Why:
///  The launch policy and the private state directory are decided by the application;
///      extra definitions exist so tests can declare scripted servers.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type LanguageSetup = { launch: LaunchPolicy; mise: MisePolicy; stateRoot?: string; extraLanguages?: string };
/// ```
#[derive(Clone, Debug)]
pub struct LanguageSetup {
    /// Decides what is spawned for every server;
    ///  the default spawns the server itself.
    pub launch: LaunchPolicy,
    /// Decides how the tools a project's mise configuration provides are found;
    ///  the default runs mise in the same confinement the servers get,
    ///  the unconfined setup never runs it.
    pub mise: MisePolicy,
    /// Private application state directory,
    ///  not containing the project;
    ///  needed by confining policies.
    pub state_root: Option<PathBuf>,
    /// Extra language and server definitions in Helix's `languages.toml` syntax,
    ///  merged over the
    /// built-in ones.
    ///  This is for definitions the application itself supplies;
    ///  it must never be
    /// filled from a project or user file.
    pub extra_languages: Option<String>,
}

/// What:
///  `impl Default for X` defines the value `X::default()` returns.
/// Why:
///  The production setup is "built-in definitions,
///  confined launch,
///  confined mise,
///  private state directory".
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const defaultSetup: LanguageSetup = { launch: launchConfined, mise: resolveConfined, stateRoot: defaultStateRoot() };
/// ```
impl Default for LanguageSetup {
    /// Build the production setup:
    ///  every server confined by bubblewrap,
    ///  with private state
    /// below the user's cache directory,
    ///  and mise run in that confinement too.
    fn default() -> Self {
        return Self {
            launch: crate::language::confine::launch_confined,
            mise: resolve_confined,
            state_root: crate::language::confine::default_state_root(),
            extra_languages: None,
        };
    }
}

/// Setups other than the production one.
impl LanguageSetup {
    /// What:
    ///  A setup whose servers run without any confinement and that never runs mise.
    /// Why:
    ///  Only for tests with the scripted server and for guard controls on disposable
    ///      projects;
    ///  a real server launched this way can write into the project.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// static unconfined(): LanguageSetup { return { launch: launchDirectly, mise: resolveDisabled }; }
    /// ```
    pub fn unconfined() -> Self {
        return Self {
            launch: launch_directly,
            mise: resolve_disabled,
            state_root: None,
            extra_languages: None,
        };
    }
}
