//! The walk for `node_modules` directories, the settings merge, and the configuration Helix is given.

/// The functions under test.
use super::{add_excluded, exclude_node_modules, node_modules_below};
/// The registry Helix reads, built the way the application builds it.
use crate::language::config::{LanguageSetup, Languages};
/// What: `json!` builds a JSON value from literal syntax; `symlink` creates a symbolic link.
/// Why: Fixtures are a disposable directory tree and a settings table written inline.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { symlinkSync } from 'node:fs';
/// ```
use serde_json::json;
/// Directory fixtures and a link that must not be followed.
use std::{fs, os::unix::fs::symlink, path::Path};

/// A project with `node_modules` at several depths, some inside directories rust-analyzer already skips.
fn project() -> (tempfile::TempDir, std::path::PathBuf) {
    let directory = tempfile::tempdir().expect("project");
    let root = directory.path().canonicalize().expect("canonical project");
    for path in [
        "node_modules/left-pad",
        "crates/web/node_modules/react/node_modules/inner",
        "crates/web/src",
        "target/debug/node_modules",
        ".git/node_modules",
    ] {
        fs::create_dir_all(root.join(path)).expect("fixture directory");
    }
    // A link to a package directory: following it would report the same node_modules twice.
    symlink(root.join("crates/web"), root.join("web-link")).expect("link to a package");
    return (directory, root);
}

/// Each `node_modules` is found once and not entered; `target`, `.git`, and links are not walked.
#[test]
fn node_modules_directories_are_found_without_entering_them() {
    let (_directory, root) = project();
    assert_eq!(
        node_modules_below(&root),
        ["crates/web/node_modules", "node_modules"],
        "the walk entered a node_modules, target, .git, or a link"
    );
    assert!(
        node_modules_below(Path::new("/nonexistent-ide-project")).is_empty(),
        "an unreadable root produced directories"
    );
}

/// Exclusions join the settings already there and are not repeated.
#[test]
fn exclusions_join_the_existing_files_settings() {
    let mut settings = json!({ "files": { "watcher": "server", "excludeDirs": ["docs", "node_modules"] }, "check": {} });
    add_excluded(
        &mut settings,
        &["node_modules".to_string(), "web/node_modules".to_string()],
    );
    assert_eq!(
        settings,
        json!({ "files": { "watcher": "server", "excludeDirs": ["docs", "node_modules", "web/node_modules"] }, "check": {} })
    );
    let mut empty = json!(null);
    add_excluded(&mut empty, &["node_modules".to_string()]);
    assert_eq!(
        empty,
        json!({ "files": { "excludeDirs": ["node_modules"] } })
    );
}

/// The definition Helix is given keeps Helix's server-side watching and leaves the project's
/// `node_modules` directories out of it.
#[test]
fn the_built_configuration_hides_node_modules_from_rust_analyzer() {
    let (_directory, root) = project();
    let languages = Languages::new(&root, LanguageSetup::unconfined()).expect("registry");
    let loader = languages.loader.load();
    let definition = loader
        .language_server_configs()
        .get("rust-analyzer")
        .expect("rust-analyzer definition");
    let settings = definition.config.clone().expect("rust-analyzer settings");
    assert_eq!(
        settings["files"]["watcher"],
        json!("server"),
        "Helix's server-side watching was lost"
    );
    let expected: Vec<String> = ["crates/web/node_modules", "node_modules"]
        .iter()
        .map(|relative| return root.join(relative).display().to_string())
        .collect();
    assert_eq!(
        settings["files"]["excludeDirs"],
        json!(expected),
        "the project's node_modules directories were not excluded by absolute path"
    );
}

/// Each spelling of the root gets its own entries, because rust-analyzer compares the paths it was given.
#[test]
fn every_spelling_of_the_root_is_excluded() {
    let (_directory, root) = project();
    let mut settings = Some(json!({ "files": { "watcher": "server" } }));
    exclude_node_modules(
        &mut settings,
        &root,
        &[std::path::PathBuf::from("/srv/link")],
    );
    let mut expected = Vec::new();
    for base in [root.display().to_string(), "/srv/link".to_string()] {
        for relative in ["crates/web/node_modules", "node_modules"] {
            expected.push(format!("{base}/{relative}"));
        }
    }
    assert_eq!(
        settings.expect("settings")["files"]["excludeDirs"],
        json!(expected)
    );
}
