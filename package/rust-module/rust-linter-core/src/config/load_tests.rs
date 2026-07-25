//! Unit tests for reading configuration from disk.

/// Imports filesystem writes used to build throwaway config trees.
use std::fs;
/// Imports the borrowed path type discovery walks with.
use std::path::Path;

/// Imports the loading, discovery and `extends` machinery under test.
use crate::config::load::{discover, load_file, load_for, LoadError, CONFIG_FILE_NAME};
/// Imports the compiled configuration resolution runs against.
use crate::config::resolve::LinterConfig;
/// Imports the severity vocabulary the assertions speak.
use crate::severity::{Category, RuleSeverity};

// What:     `fn write(directory: &Path, name: &str, text: &str)`. Creates parent
//           directories then writes one file, failing the test on any error.
// Why:      Every test here builds a small tree; `.expect(..)` at each step would
//           bury what the test is actually about.
//
// In TS you'd write (pseudocode):
// ```ts
// function write(dir: string, name: string, text: string): void
// ```
/// Write one file into a throwaway tree, creating parents as needed.
fn write(directory: &Path, name: &str, text: &str) {
    let target = directory.join(name);
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).expect("test directory should be creatable");
    }

    fs::write(&target, text).expect("test file should be writable");
}

/// Resolve one rule's severity from a loaded configuration.
fn severity_of(linter: &LinterConfig, path: &str, rule: &str) -> RuleSeverity {
    return linter
        .resolve(Path::new(path), "builtin", rule, Category::Pedantic)
        .severity;
}

/// A configuration file is read and its rules take effect.
#[test]
fn load_file_reads_rules() {
    // `tempfile::tempdir()` makes a directory that deletes itself when the
    // returned handle drops, so no test leaves anything behind.
    let temp = tempfile::tempdir().expect("temp dir");
    write(temp.path(), CONFIG_FILE_NAME, "[rules]\n\"a\" = \"error\"\n");

    let loaded = load_file(&temp.path().join(CONFIG_FILE_NAME)).expect("config should load");
    let linter = LinterConfig::compile(loaded).expect("config should compile");

    assert_eq!(severity_of(&linter, "src/lib.rs", "a"), RuleSeverity::Error);
}

/// An extending file inherits its base and wins where they disagree.
#[test]
fn extends_inherits_then_overrides() {
    let temp = tempfile::tempdir().expect("temp dir");
    write(
        temp.path(),
        "base.toml",
        "[rules]\n\"a\" = \"error\"\n\"b\" = \"error\"\n",
    );
    write(
        temp.path(),
        CONFIG_FILE_NAME,
        "extends = [\"base.toml\"]\n\n[rules]\n\"b\" = \"off\"\n",
    );

    let loaded = load_file(&temp.path().join(CONFIG_FILE_NAME)).expect("config should load");
    let linter = LinterConfig::compile(loaded).expect("config should compile");

    assert_eq!(
        severity_of(&linter, "src/lib.rs", "a"),
        RuleSeverity::Error,
        "inherited from the base"
    );
    assert_eq!(
        severity_of(&linter, "src/lib.rs", "b"),
        RuleSeverity::Off,
        "the extending file wins"
    );
}

/// Unlike oxlint's, this `extends` inherits more than rules.
#[test]
fn extends_inherits_ignore_patterns_too() {
    let temp = tempfile::tempdir().expect("temp dir");
    write(temp.path(), "base.toml", "ignore-patterns = [\"**/gen/**\"]\n");
    write(temp.path(), CONFIG_FILE_NAME, "extends = [\"base.toml\"]\n");

    let loaded = load_file(&temp.path().join(CONFIG_FILE_NAME)).expect("config should load");
    let linter = LinterConfig::compile(loaded).expect("config should compile");

    // oxlint's `extends` merges rules ONLY, dropping ignorePatterns, categories
    // and overrides, which is why the repo's own oxlint.config.ts spreads its
    // base instead of extending it. This is a full merge on purpose.
    assert!(
        linter.is_ignored(Path::new("a/gen/x.rs")),
        "ignore patterns are inherited, unlike oxlint's extends"
    );
}

/// An `extends` path resolves relative to the file naming it.
#[test]
fn extends_resolves_relative_to_the_extending_file() {
    let temp = tempfile::tempdir().expect("temp dir");
    write(temp.path(), "shared/base.toml", "[rules]\n\"a\" = \"error\"\n");
    write(
        temp.path(),
        "package/rust-linter.toml",
        "extends = [\"../shared/base.toml\"]\n",
    );

    let loaded =
        load_file(&temp.path().join("package/rust-linter.toml")).expect("config should load");
    let linter = LinterConfig::compile(loaded).expect("config should compile");

    assert_eq!(severity_of(&linter, "src/lib.rs", "a"), RuleSeverity::Error);
}

/// A file that extends itself is reported rather than looping forever.
#[test]
fn extends_cycle_is_reported() {
    let temp = tempfile::tempdir().expect("temp dir");
    write(temp.path(), "one.toml", "extends = [\"two.toml\"]\n");
    write(temp.path(), "two.toml", "extends = [\"one.toml\"]\n");

    let result = load_file(&temp.path().join("one.toml"));

    // What:     `matches!(value, Pattern)` is a macro answering whether the value
    //           matches the pattern, without needing every other arm spelled out.
    // Why:      The test cares that this is a cycle error, not which path closed
    //           the loop.
    assert!(
        matches!(result, Err(LoadError::Cycle { .. })),
        "a cycle must be reported, not looped: {result:?}"
    );
}

/// Two branches extending one shared base is not a cycle.
#[test]
fn diamond_extends_is_not_a_cycle() {
    let temp = tempfile::tempdir().expect("temp dir");
    write(temp.path(), "base.toml", "[rules]\n\"a\" = \"error\"\n");
    write(temp.path(), "left.toml", "extends = [\"base.toml\"]\n");
    write(temp.path(), "right.toml", "extends = [\"base.toml\"]\n");
    write(
        temp.path(),
        CONFIG_FILE_NAME,
        "extends = [\"left.toml\", \"right.toml\"]\n",
    );

    let loaded = load_file(&temp.path().join(CONFIG_FILE_NAME));

    assert!(
        loaded.is_ok(),
        "one base reached by two paths is legitimate: {loaded:?}"
    );
}

/// A missing file is reported as a read failure naming the path.
#[test]
fn missing_file_is_reported() {
    let temp = tempfile::tempdir().expect("temp dir");

    let result = load_file(&temp.path().join("absent.toml"));

    assert!(
        matches!(result, Err(LoadError::Read { .. })),
        "a missing config is a read error: {result:?}"
    );
}

/// A misspelled key fails loudly rather than being ignored.
#[test]
fn unknown_key_is_rejected() {
    let temp = tempfile::tempdir().expect("temp dir");
    write(temp.path(), CONFIG_FILE_NAME, "ignorePatterns = [\"x\"]\n");

    let result = load_file(&temp.path().join(CONFIG_FILE_NAME));

    // The key is `ignore-patterns`; the camelCase spelling is oxlint's, not
    // this linter's. Silently accepting it would mean a config that claims to
    // ignore files and does not.
    assert!(
        matches!(result, Err(LoadError::Parse { .. })),
        "a misspelled key must be rejected: {result:?}"
    );
}

/// Discovery walks upward and returns outermost first.
#[test]
fn discover_returns_outermost_first() {
    let temp = tempfile::tempdir().expect("temp dir");
    write(temp.path(), CONFIG_FILE_NAME, "");
    write(temp.path(), "package/thing/rust-linter.toml", "");

    let found = discover(&temp.path().join("package/thing"), Some(temp.path()));

    assert_eq!(found.len(), 2, "both configs found: {found:?}");
    assert_eq!(
        found[0],
        temp.path().join(CONFIG_FILE_NAME),
        "outermost comes first so nearer files merge on top"
    );
}

/// Discovery stops at the boundary it was given.
#[test]
fn discover_stops_at_the_root_boundary() {
    let temp = tempfile::tempdir().expect("temp dir");
    write(temp.path(), "inner/rust-linter.toml", "");

    let found = discover(
        &temp.path().join("inner"),
        Some(&temp.path().join("inner")),
    );

    assert_eq!(found.len(), 1, "the walk stopped at the boundary: {found:?}");
}

/// A nearer configuration layers over an outer one rather than replacing it.
#[test]
fn nested_config_layers_over_the_outer_one() {
    let temp = tempfile::tempdir().expect("temp dir");
    write(
        temp.path(),
        CONFIG_FILE_NAME,
        "[rules]\n\"a\" = \"error\"\n\"b\" = \"error\"\n",
    );
    write(
        temp.path(),
        "package/thing/rust-linter.toml",
        "[rules]\n\"b\" = \"off\"\n",
    );

    let loaded = load_for(&temp.path().join("package/thing"), Some(temp.path()))
        .expect("config should load");
    let linter = LinterConfig::compile(loaded).expect("config should compile");

    // This is the layering decision: the package config restates only `b`, and
    // repo-wide policy for `a` survives. Replacing rather than layering would
    // force every package to restate the whole policy.
    assert_eq!(
        severity_of(&linter, "src/lib.rs", "a"),
        RuleSeverity::Error,
        "outer policy survives"
    );
    assert_eq!(
        severity_of(&linter, "src/lib.rs", "b"),
        RuleSeverity::Off,
        "the nearer config wins where it speaks"
    );
}

/// Loading a tree with no configuration at all is not an error.
#[test]
fn missing_configs_load_as_empty() {
    let temp = tempfile::tempdir().expect("temp dir");

    let loaded = load_for(temp.path(), Some(temp.path()));

    assert!(loaded.is_ok(), "no config is a legitimate state: {loaded:?}");
}

/// Load failures render as sentences naming the file.
#[test]
fn load_errors_name_their_file() {
    let temp = tempfile::tempdir().expect("temp dir");
    let missing = temp.path().join("absent.toml");

    // `.unwrap_err()` takes the failure out of a `Result`, panicking if it
    // unexpectedly succeeded.
    let error = load_file(&missing).unwrap_err();

    // `.to_string()` runs the `Display` implementation, which is what a user sees.
    let rendered = error.to_string();
    assert!(
        rendered.contains("absent.toml"),
        "the message must name the file: {rendered}"
    );
}

/// The loader clears `extends` once it has resolved the chain.
#[test]
fn loader_clears_extends_after_resolving() {
    let temp = tempfile::tempdir().expect("temp dir");
    write(temp.path(), "base.toml", "[rules]\n\"a\" = \"error\"\n");
    write(temp.path(), CONFIG_FILE_NAME, "extends = [\"base.toml\"]\n");

    let loaded = load_file(&temp.path().join(CONFIG_FILE_NAME)).expect("config should load");

    // `merge` preserves `extends`, so only the loader may clear it, and only
    // after walking the chain. A loaded config still carrying the key would make
    // any later merge re-resolve a chain that is already resolved.
    assert!(
        loaded.extends.is_empty(),
        "a loaded config reports no pending extends: {:?}",
        loaded.extends
    );
}

// What:     A test that discovery returns each config file exactly once, driven
//           from a RELATIVE start path.
// Why:      It did not. `discover` climbed by `.parent()`, and the parent of `.`
//           is `""`, so `"".join("rust-linter.toml")` named the same file as
//           `"./rust-linter.toml"` and every config was loaded twice. Map-shaped
//           keys merge idempotently, so nothing showed it until pattern rules,
//           which concatenate, started reporting every finding twice.
/// Discovery from a relative path finds each config once, not twice.
#[test]
fn relative_start_does_not_find_the_same_config_twice() {
    let temp = tempfile::tempdir().expect("temp dir");
    write(temp.path(), CONFIG_FILE_NAME, "[rules]\n\"a\" = \"error\"\n");

    // `set_current_dir` makes the relative start meaningful. The guard restores
    // it afterwards so one test cannot strand the others in a deleted directory.
    let original = std::env::current_dir().expect("current dir");
    std::env::set_current_dir(temp.path()).expect("enter temp dir");

    let found = discover(Path::new("."), None);

    std::env::set_current_dir(original).expect("restore dir");

    // `.filter(..).count()` counts how many discovered paths name this file, by
    // file name rather than by full path, because the two spellings that caused
    // the bug differ only in their prefix.
    let matching = found
        .iter()
        .filter(|path| {
            return path.file_name().and_then(|name| return name.to_str()) == Some(CONFIG_FILE_NAME);
        })
        .count();

    assert_eq!(
        matching, 1,
        "one config file should be discovered once: {found:?}"
    );
}
