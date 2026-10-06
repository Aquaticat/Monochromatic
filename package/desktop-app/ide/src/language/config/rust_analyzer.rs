//! rust-analyzer watches the workspace by itself: Helix's built-in definition sets
//! `files.watcher = "server"`, because Helix does not watch files for its servers. rust-analyzer then
//! takes one inotify watch for every directory below each package of the workspace. It already leaves
//! out each package's `target` and `.git`, but a package that also holds JavaScript dependencies has every
//! `node_modules` directory watched, which can be thousands of watches that never affect a Rust result.
//! This adds the project's `node_modules` directories to `files.excludeDirs`, which takes paths relative to
//! the workspace root and no patterns, so they are found by walking the project once when it is opened.

/// Helix's typed configuration.
use helix_core::syntax::config::Configuration;
/// What: `Value` is any JSON value; `json!` builds one from literal syntax.
/// Why: The server's settings table is JSON.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Value = unknown;
/// ```
use serde_json::{Value, json};
/// What: `Path`/`PathBuf` are a borrowed and an owned path; `Instant` is a monotonic time point.
/// Why: The walk starts at the project root, and its duration is logged.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { join } from 'node:path';
/// ```
use std::{
    path::{Path, PathBuf},
    time::Instant,
};

/// Name of Helix's rust-analyzer definition.
const SERVER: &str = "rust-analyzer";

/// Directories visited before the walk gives up and leaves the rest of the project as it is.
const WALK_LIMIT: usize = 200_000;

/// Directory names the walk does not enter: rust-analyzer already leaves out `target` and `.git`,
/// and each `node_modules` is recorded rather than entered.
const PRUNED: [&str; 3] = ["node_modules", "target", ".git"];

/// Every `node_modules` directory below `root`, as paths relative to it with `/` between names, sorted.
/// Symbolic links are not followed, and the walk stops after `WALK_LIMIT` directories.
pub fn node_modules_below(root: &Path) -> Vec<String> {
    let started = Instant::now();
    let mut found = Vec::new();
    // What: `vec![...]` makes a list holding the root; it is used as a stack of directories still to read.
    // Why: An explicit stack walks deep trees without recursion.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const pending: string[] = [root];
    // ```
    let mut pending: Vec<PathBuf> = vec![root.to_path_buf()];
    let mut visited = 0;
    while let Some(directory) = pending.pop() {
        visited += 1;
        if visited > WALK_LIMIT {
            tracing::info!(
                limit = WALK_LIMIT,
                "stopped looking for node_modules directories to hide from rust-analyzer"
            );
            break;
        }
        // What: `let Ok(entries) = ... else` skips a directory that cannot be listed.
        // Why: An unreadable directory is not rust-analyzer's either; the walk goes on.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // let entries; try { entries = readdirSync(directory, { withFileTypes: true }); } catch { continue; }
        // ```
        let Ok(entries) = std::fs::read_dir(&directory) else {
            continue;
        };
        // `flatten` skips entries that could not be read.
        for entry in entries.flatten() {
            // `file_type` does not follow symbolic links, so a link to a directory is not entered.
            let is_directory = entry.file_type().is_ok_and(|kind| return kind.is_dir());
            if !is_directory {
                continue;
            }
            let name = entry.file_name();
            if name == "node_modules" {
                // What: `strip_prefix` gives the path below the root; `to_str` is `None` for names that are not Unicode.
                // Why: rust-analyzer's setting is JSON text relative to the workspace root.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // found.push(relative(root, entry.path));
                // ```
                let path = entry.path();
                let relative = path
                    .strip_prefix(root)
                    .ok()
                    .and_then(|below| return below.to_str());
                if let Some(text) = relative {
                    found.push(text.replace(std::path::MAIN_SEPARATOR, "/"));
                }
                continue;
            }
            if PRUNED.iter().any(|pruned| return name == *pruned) {
                continue;
            }
            pending.push(entry.path());
        }
    }
    found.sort();
    tracing::debug!(directories = found.len(), visited, elapsed = ?started.elapsed(), "found node_modules directories to hide from rust-analyzer");
    return found;
}

/// Add `excluded` to the `files.excludeDirs` list of a settings table, keeping entries already there.
pub fn add_excluded(settings: &mut Value, excluded: &[String]) {
    if !settings.is_object() {
        *settings = json!({});
    }
    // What: `as_object_mut` borrows the member table; `entry(...).or_insert_with` finds or creates a member.
    // Why: Other `files` settings, such as Helix's `watcher`, stay as they are.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const files = (settings.files ??= {}); const list = (files.excludeDirs ??= []);
    // ```
    let Some(members) = settings.as_object_mut() else {
        return;
    };
    let files = members
        .entry("files".to_string())
        .or_insert_with(|| return json!({}));
    if !files.is_object() {
        *files = json!({});
    }
    let Some(file_members) = files.as_object_mut() else {
        return;
    };
    let list = file_members
        .entry("excludeDirs".to_string())
        .or_insert_with(|| return json!([]));
    if !list.is_array() {
        *list = json!([]);
    }
    let Some(items) = list.as_array_mut() else {
        return;
    };
    for path in excluded {
        // `Value::from` wraps the text as a JSON string; an entry already listed is not repeated.
        let item = Value::from(path.clone());
        if !items.contains(&item) {
            items.push(item);
        }
    }
}

/// Hide the project's `node_modules` directories from rust-analyzer's own file watching.
pub(super) fn apply(configuration: &mut Configuration, root: &Path) {
    // What: `get_mut` borrows the definition for modification, or `None` when there is none.
    // Why: A configuration without rust-analyzer needs no walk.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const definition = configuration.languageServer[SERVER]; if (!definition) return;
    // ```
    let Some(definition) = configuration.language_server.get_mut(SERVER) else {
        return;
    };
    let excluded = node_modules_below(root);
    if excluded.is_empty() {
        return;
    }
    // `get_or_insert_with` gives the existing settings table, or an empty one first.
    let settings = definition.config.get_or_insert_with(|| return json!({}));
    add_excluded(settings, &excluded);
}

/// The walk on disposable trees, the settings merge, and the configuration Helix is given.
#[cfg(test)]
#[path = "rust_analyzer_tests.rs"]
mod tests;
