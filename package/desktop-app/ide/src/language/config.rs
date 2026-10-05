//! The language registry: Helix's built-in definitions plus the application's overrides, built
//! in code. No workspace or user Helix configuration is ever read, because a project-supplied
//! `languages.toml` could replace a server's command.

/// The launch seam decides what is spawned for each server.
use super::launch::{
    LaunchPolicy, LaunchRequest, ServerLaunch, launch_directly, resolve_executable,
};
/// Helix's spelling of the project root, which servers are given.
use super::root::RootView;
/// Errors name the operation that failed.
use anyhow::{Context, Result};
/// What: `ArcSwap` is a cell holding a shared pointer that can be replaced atomically.
/// Why: `helix_lsp::Registry` requires its language registry in exactly this wrapper.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const loader = { current: new Loader(config) };
/// ```
use arc_swap::ArcSwap;
/// Helix's language registry and its typed configuration.
use helix_core::syntax::{Loader, config::Configuration};
/// What: `HashMap` is a key-value table; `Path`/`PathBuf` are borrowed and owned filesystem
///       paths; `Arc` is a thread-safe shared pointer (siblings: `Rc`, `Box`).
/// Why: Side tables are looked up by server or language name.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const unavailable = new Map<string, Unavailable>();
/// ```
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    sync::Arc,
};

/// The TypeScript family is served by the project's own TypeScript 7 server.
mod typescript;

/// What: How the embedding application sets the Language module up. `Option<...>` fields are
///       "a value, or nothing".
/// Why: The launch policy and the private state directory are decided by the application;
///      extra definitions exist so tests can declare scripted servers.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type LanguageSetup = { launch: LaunchPolicy; stateRoot?: string; extraLanguages?: string };
/// ```
#[derive(Clone, Debug)]
pub struct LanguageSetup {
    /// Decides what is spawned for every server; the default spawns the server itself.
    pub launch: LaunchPolicy,
    /// Private application state directory, outside the project; needed by confining policies.
    pub state_root: Option<PathBuf>,
    /// Extra language and server definitions in Helix's `languages.toml` syntax, merged over the
    /// built-in ones. This is for definitions the application itself supplies; it must never be
    /// filled from a project or user file.
    pub extra_languages: Option<String>,
}

/// What: `impl Default for X` defines the value `X::default()` returns.
/// Why: The production setup is "built-in definitions, direct launch, no state directory".
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const defaultSetup: LanguageSetup = { launch: launchDirectly };
/// ```
impl Default for LanguageSetup {
    /// Build the production setup: every server confined by bubblewrap, with private state
    /// below the user's cache directory.
    fn default() -> Self {
        return Self {
            launch: super::confine::launch_confined,
            state_root: super::confine::default_state_root(),
            extra_languages: None,
        };
    }
}

/// Setups other than the production one.
impl LanguageSetup {
    /// What: A setup whose servers run without any confinement.
    /// Why: Only for tests with the scripted server and for guard controls on disposable
    ///      projects; a real server launched this way can write into the project.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// static unconfined(): LanguageSetup { return { launch: launchDirectly }; }
    /// ```
    pub fn unconfined() -> Self {
        return Self {
            launch: launch_directly,
            state_root: None,
            extra_languages: None,
        };
    }
}

/// What: Why a configured server cannot be started. An `enum` with data is a tagged union.
/// Why: A missing program and a refused launch lead to different states and remedies.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Unavailable = { kind: 'missing'; reason: string } | { kind: 'refused'; reason: string };
/// ```
#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) enum Unavailable {
    /// The server's own program was not found, or the project's copy is unusable.
    Missing(
        /// Which program was looked for and what the remedy is.
        String,
    ),
    /// The launch policy refused; nothing is spawned instead.
    Refused(
        /// What the launch policy reported.
        String,
    ),
}

/// What the registry remembers about one server definition besides what Helix holds.
struct Definition {
    /// Command as configured, before resolution and before the launch policy.
    command: String,
    /// Seconds a request, including `initialize`, may take. `u64` is an unsigned 64-bit integer.
    timeout: u64,
    /// The launch the policy produced; absent for an unavailable server.
    launch: Option<ServerLaunch>,
}

/// The registry plus the side tables the worker reports states from.
pub(super) struct Languages {
    /// Shared with `helix_lsp::Registry`, which reads server definitions from it at every start.
    pub(super) loader: Arc<ArcSwap<Loader>>,
    /// Canonical project root.
    root: PathBuf,
    /// The application's setup.
    setup: LanguageSetup,
    /// Server names per language, in configured order, before unavailable ones were removed.
    configured: HashMap<String, Vec<String>>,
    /// Servers that cannot be started, with the reason.
    unavailable: HashMap<String, Unavailable>,
    /// Per-server facts kept outside Helix's registry.
    definitions: HashMap<String, Definition>,
}

/// Everything `build` produces before it is wrapped for sharing.
struct Built {
    /// Helix's registry, without the unavailable servers.
    loader: Loader,
    /// See `Languages::configured`.
    configured: HashMap<String, Vec<String>>,
    /// See `Languages::unavailable`.
    unavailable: HashMap<String, Unavailable>,
    /// See `Languages::definitions`.
    definitions: HashMap<String, Definition>,
}

/// What: Decide whether a server's program exists, returning its absolute path or the reason
///       it is unavailable.
/// Why: The check must see the real server, never a wrapper placed in front of it.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function locate(server: string, command: string, root: string): string // throws when missing
/// ```
fn locate(server: &str, command: &str, root: &Path) -> Result<PathBuf, Unavailable> {
    if server == typescript::SERVER {
        // `map_err` wraps the text reason in the `Missing` variant.
        return typescript::locate(root).map_err(Unavailable::Missing);
    }
    // `ok_or_else` turns "nothing" into the error built by the closure.
    return resolve_executable(command, root).ok_or_else(|| {
        return Unavailable::Missing(format!(
            "the program '{command}' for {server} was not found on PATH"
        ));
    });
}

/// What: Build the registry and its side tables. `&Path` and `&LanguageSetup` are lent read-only.
/// Why: Definitions are assembled in code from Helix's compiled-in defaults: built-in table,
///      application overrides, executable resolution, then the launch policy. Servers that are
///      missing or refused are removed from every language so Helix can never start them.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function build(root: string, setup: LanguageSetup): Built
/// ```
fn build(root: &Path, setup: &LanguageSetup) -> Result<Built> {
    // The built-in `languages.toml` of the pinned Helix revision, compiled into helix-loader.
    let defaults = helix_loader::config::default_lang_config();
    let merged = match &setup.extra_languages {
        Some(text) => {
            // What: `toml::from_str` parses text into a generic value; `context` attaches a message
            //       and the trailing `?` returns the error to the caller.
            // Why: Malformed application definitions must stop the module, not silently vanish.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const extra = parseToml(text);
            // ```
            let extra: toml::Value =
                toml::from_str(text).context("Cannot parse the extra language definitions")?;
            // Depth 3 is Helix's own merge depth: language entries merge by name.
            helix_loader::merge_toml_values(defaults, extra, 3)
        }
        None => defaults,
    };
    // What: `try_into` decodes the generic value into Helix's typed `Configuration`.
    // Why: Unknown keys and wrong types are rejected here by Helix's own schema.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const configuration = ConfigurationSchema.parse(merged);
    // ```
    let mut configuration: Configuration = merged
        .try_into()
        .context("Cannot decode the language definitions")?;
    typescript::apply(&mut configuration, root);
    // What: Helix's spelling of the root, when it differs from the canonical one; `ok()` drops
    //       the refusal, which the start reports on its own.
    // Why: Helix gives servers this spelling, so a confined server must find the project there.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const spellings = [discoverRoot(root)?.helix].filter(spelling => spelling && spelling !== root);
    // ```
    let spellings: Vec<PathBuf> = RootView::discover(root)
        .ok()
        .map(|view| return view.helix().to_path_buf())
        .filter(|spelling| return spelling.as_path() != root)
        .into_iter()
        .collect();
    let mut unavailable: HashMap<String, Unavailable> = HashMap::new();
    let mut definitions: HashMap<String, Definition> = HashMap::new();
    // `iter_mut` walks the table handing out modifiable borrows of each definition.
    for (name, definition) in configuration.language_server.iter_mut() {
        let command = definition.command.clone();
        let outcome = locate(name, &command, root).and_then(|executable| {
            let request = LaunchRequest {
                server: name.clone(),
                executable,
                args: definition.args.clone(),
                environment: definition.environment.clone(),
                settings: definition.config.clone(),
                project_root: root.to_path_buf(),
                project_spellings: spellings.clone(),
                state_root: setup.state_root.clone(),
            };
            // Calling the function pointer held in `setup.launch`; a refusal becomes `Refused`.
            return (setup.launch)(&request).map_err(Unavailable::Refused);
        });
        let launch = match outcome {
            Ok(launch) => {
                definition.command = launch.command.clone();
                definition.args = launch.args.clone();
                definition.environment = launch.environment.clone();
                definition.config = launch.settings.clone();
                Some(launch)
            }
            Err(reason) => {
                tracing::debug!(server = %name, ?reason, "language server is unavailable");
                unavailable.insert(name.clone(), reason);
                None
            }
        };
        definitions.insert(
            name.clone(),
            Definition {
                command,
                timeout: definition.timeout,
                launch,
            },
        );
    }
    let mut configured: HashMap<String, Vec<String>> = HashMap::new();
    for language in configuration.language.iter_mut() {
        let mut names = Vec::new();
        for features in &language.language_servers {
            names.push(features.name.clone());
        }
        configured.insert(language.language_id.clone(), names);
        // What: `retain` keeps only the entries for which the closure returns true.
        // Why: `Registry::get` starts every server a language lists; an unavailable one must not be listed.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // language.languageServers = language.languageServers.filter(server => !unavailable.has(server.name));
        // ```
        language
            .language_servers
            .retain(|features| return !unavailable.contains_key(&features.name));
    }
    let loader = Loader::new(configuration).context("Cannot build the language registry")?;
    // `Ok(...)` is the success variant of `Result`.
    return Ok(Built {
        loader,
        configured,
        unavailable,
        definitions,
    });
}

/// Registry operations used by the worker.
impl Languages {
    /// Build the registry for one project root.
    pub(super) fn new(root: &Path, setup: LanguageSetup) -> Result<Self> {
        let built = build(root, &setup)?;
        return Ok(Self {
            // `ArcSwap::from_pointee` wraps the registry for atomic replacement; `Arc::new` shares it.
            loader: Arc::new(ArcSwap::from_pointee(built.loader)),
            root: root.to_path_buf(),
            setup,
            configured: built.configured,
            unavailable: built.unavailable,
            definitions: built.definitions,
        });
    }

    /// What: Server names configured for a language, in order. `&[String]` is a borrowed list.
    /// Why: States are reported for every configured server, including the ones Helix never sees.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// configured(language: string): readonly string[]
    /// ```
    pub(super) fn configured(&self, language: &str) -> &[String] {
        // `map_or` yields an empty list for an unknown language.
        return self
            .configured
            .get(language)
            .map_or(&[], |names| return names.as_slice());
    }

    /// Why a server cannot be started, or nothing when it can.
    pub(super) fn unavailable(&self, server: &str) -> Option<&Unavailable> {
        return self.unavailable.get(server);
    }

    /// Seconds a server may take to answer `initialize`; Helix's default when the server is unknown.
    pub(super) fn timeout(&self, server: &str) -> u64 {
        return self
            .definitions
            .get(server)
            .map_or(20, |definition| return definition.timeout);
    }

    /// The launch the policy produced for a server, when it is available.
    pub(super) fn launch(&self, server: &str) -> Option<&ServerLaunch> {
        // `and_then` continues into the inner `Option`; `as_ref` borrows instead of moving.
        return self
            .definitions
            .get(server)
            .and_then(|definition| return definition.launch.as_ref());
    }

    /// The application's private state directory, when one is configured.
    pub(super) fn state_root(&self) -> Option<&Path> {
        return self.setup.state_root.as_deref();
    }

    /// What: Rebuild the registry when a language's server programs appeared or disappeared
    ///       since it was built; returns true when it was rebuilt.
    /// Why: Programs are resolved when the registry is built, so a server installed later (or
    ///      project dependencies installed after start) would otherwise stay "missing" until restart.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// refresh(language: string): boolean
    /// ```
    pub(super) fn refresh(&mut self, language: &str) -> Result<bool> {
        let mut changed = false;
        for name in self.configured(language) {
            let Some(definition) = self.definitions.get(name) else {
                continue;
            };
            let found = locate(name, &definition.command, &self.root).is_ok();
            let was_missing = matches!(self.unavailable.get(name), Some(Unavailable::Missing(_)));
            if found == was_missing {
                changed = true;
            }
        }
        if !changed {
            return Ok(false);
        }
        tracing::info!(
            language,
            "rebuilding the language registry after a server program changed"
        );
        let built = build(&self.root, &self.setup)?;
        // `store` atomically replaces the registry Helix reads at its next server start.
        self.loader.store(Arc::new(built.loader));
        self.configured = built.configured;
        self.unavailable = built.unavailable;
        self.definitions = built.definitions;
        return Ok(true);
    }
}

/// Registry assembly, the TypeScript override, and availability are exercised on disposable projects.
#[cfg(test)]
#[path = "config_tests.rs"]
mod tests;
