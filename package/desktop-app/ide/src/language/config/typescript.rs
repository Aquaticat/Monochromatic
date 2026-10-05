//! The TypeScript family uses the project's own TypeScript 7 server instead of Helix's default.
//!
//! Helix's default, `typescript-language-server`, needs a `tsserver.js` that TypeScript 7 no
//! longer ships. TypeScript 7 has its own server, `tsc --lsp --stdio`; a project without it
//! shows the missing-executable state. Adopted in `doc/planning/slint-ide-language-intelligence.md`.

/// Helix's typed configuration and one server definition.
use helix_core::syntax::config::{Configuration, LanguageServerConfiguration};
/// What: `Value` is any JSON value; `json!` builds one from literal syntax.
/// Why: The server's settings table is JSON.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Value = unknown;
/// ```
use serde_json::{Value, json};
/// What: `HashMap` is a key-value table; `Path`/`PathBuf` are borrowed and owned paths.
/// Why: The launcher is located below the project root.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { join } from 'node:path';
/// ```
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
};

/// Name of Helix's default server for the TypeScript family, which is replaced.
const DEFAULT_SERVER: &str = "typescript-language-server";

/// Name of the application's definition of the TypeScript 7 server.
pub(super) const SERVER: &str = "typescript-native";

/// The launcher a project's TypeScript package installs, relative to the project root.
const LAUNCHER: &str = "node_modules/typescript/bin/tsc";

/// The package manifest that states the project's TypeScript version.
const MANIFEST: &str = "node_modules/typescript/package.json";

/// What: The settings the server needs before it returns inlay hints.
/// Why: Measured in the integration spike: the server returned no hints until its settings held
///      these Visual Studio Code style keys under `typescript.inlayHints`; the keys of Helix's
///      `typescript-language-server` table produced none.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const settings = { typescript: { inlayHints: { variableTypes: { enabled: true }, /* ... */ } } };
/// ```
fn settings() -> Value {
    return json!({
        "typescript": {
            "inlayHints": {
                "parameterNames": { "enabled": "all", "suppressWhenArgumentMatchesName": false },
                "parameterTypes": { "enabled": true },
                "variableTypes": { "enabled": true },
                "propertyDeclarationTypes": { "enabled": true },
                "functionLikeReturnTypes": { "enabled": true },
                "enumMemberValues": { "enabled": true },
            },
        },
    });
}

/// What: Add the TypeScript 7 server definition and point every language that used Helix's
///       default TypeScript server at it. `&mut Configuration` lends the configuration for
///       modification.
/// Why: The command is an absolute path below the project root, so it does not depend on the
///      process working directory the way a relative command would.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function apply(configuration: Configuration, root: string): void {
///   configuration.languageServer[SERVER] = { command: join(root, LAUNCHER), args: ['--lsp', '--stdio'], config: settings() };
///   for (const language of configuration.language)
///     for (const server of language.languageServers) if (server.name === DEFAULT_SERVER) server.name = SERVER;
/// }
/// ```
pub(super) fn apply(configuration: &mut Configuration, root: &Path) {
    // Variables an application-supplied definition of this server adds are kept, for example
    // probe markers in acceptance tests; command, arguments, and settings are always replaced.
    let environment =
        configuration
            .language_server
            .get(SERVER)
            .map_or(HashMap::new(), |existing| {
                return existing.environment.clone();
            });
    configuration.language_server.insert(
        // `to_string` copies the constant into an owned `String` the table keeps.
        SERVER.to_string(),
        LanguageServerConfiguration {
            // `to_string_lossy` renders the path as text; availability is checked on the real path.
            command: root.join(LAUNCHER).to_string_lossy().into_owned(),
            args: vec!["--lsp".to_string(), "--stdio".to_string()],
            environment,
            // `Some(...)` is the "value present" variant of `Option`.
            config: Some(settings()),
            // Helix's default request timeout, in seconds.
            timeout: 20,
            // `None` is the "nothing" variant: no required root files.
            required_root_patterns: None,
        },
    );
    // `iter_mut` hands out modifiable borrows so names can be replaced in place.
    for language in configuration.language.iter_mut() {
        for features in language.language_servers.iter_mut() {
            if features.name == DEFAULT_SERVER {
                features.name = SERVER.to_string();
            }
        }
    }
}

/// What: Find the project's TypeScript 7 launcher, or explain why there is none.
///       `Result<PathBuf, String>` is the absolute launcher path or a user-facing reason.
/// Why: A project without TypeScript, or with a version before 7, has no built-in language
///      server; both are the missing-executable state, with a reason that names the remedy.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function locate(root: string): string // throws with the reason
/// ```
pub(super) fn locate(root: &Path) -> Result<PathBuf, String> {
    let launcher = root.join(LAUNCHER);
    if !launcher.is_file() {
        // `Err(...)` is the failure variant of `Result`.
        return Err(format!(
            "the project has no TypeScript language server: {} does not exist. Install the project's dependencies; TypeScript 7 or later is required",
            launcher.display()
        ));
    }
    let manifest = root.join(MANIFEST);
    // What: `read_to_string` returns `Result`; `map_err` converts the I/O error into the text
    //       reason, and the trailing `?` returns it on failure.
    // Why: Without a readable manifest the version cannot be shown to be 7 or later.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const encoded = readFileSync(manifest, 'utf8');
    // ```
    let encoded = std::fs::read_to_string(&manifest).map_err(|error| {
        return format!(
            "cannot read the project's TypeScript version from {}: {error}",
            manifest.display()
        );
    })?;
    let decoded: Value = serde_json::from_str(&encoded).map_err(|error| {
        return format!(
            "cannot decode the project's TypeScript version from {}: {error}",
            manifest.display()
        );
    })?;
    // `as_str` is `Some` for a JSON string; `unwrap_or("")` substitutes empty text otherwise.
    let version = decoded["version"].as_str().unwrap_or("");
    // What: `split('.').next()` takes the text before the first dot; `parse::<u64>()` converts it
    //       to a number and returns `Result`. `unwrap_or(0)` treats an unreadable version as too old.
    // Why: Only the major version decides whether the package contains the server.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const major = Number(version.split('.')[0]) || 0;
    // ```
    let major = version
        .split('.')
        .next()
        .unwrap_or("")
        .parse::<u64>()
        .unwrap_or(0);
    if major < 7 {
        return Err(format!(
            "the project's TypeScript {version} has no built-in language server; version 7 or later is required"
        ));
    }
    // `Ok(...)` is the success variant of `Result`.
    return Ok(launcher);
}
