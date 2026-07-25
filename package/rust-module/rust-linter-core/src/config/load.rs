//! Reading configuration from disk: `extends` chains and nested discovery.

/// Imports filesystem reads for configuration files.
use std::fs;
/// Imports the owned and borrowed path types discovery walks with.
use std::path::{Path, PathBuf};

/// Imports the on-disk configuration shape being read.
use crate::config::file::ConfigFile;
/// Imports the merge operation layering one configuration over another.
use crate::config::resolve::merge;

// What:     `pub const CONFIG_FILE_NAME: &str = "rust-linter.toml";`. A `const`
//           is inlined at every use site and has no address, unlike a `static`,
//           which is one value living at one place in memory for the whole
//           program.
// Why:      Discovery, `--init`, and the error messages all need the same name,
//           and a literal repeated across them is a rename waiting to go wrong.
//
// In TS you'd write (pseudocode):
// ```ts
// export const CONFIG_FILE_NAME = "rust-linter.toml";
// ```
/// File name discovery looks for in each directory.
pub const CONFIG_FILE_NAME: &str = "rust-linter.toml";

// What:     `pub enum LoadError { .. }` with variants that CARRY data: each holds
//           the path, and some hold the underlying failure. This is Rust's way of
//           expressing "one of several failures, each with its own detail".
// Why:      AGENTS.md DGT asks that a user-facing diagnostic name the affected
//           input plainly, so every variant carries the path it failed on.
//
// In TS you'd write (pseudocode):
// ```ts
// type LoadError =
//   | { kind: "read"; path: string; cause: Error }
//   | { kind: "parse"; path: string; cause: Error }
//   | { kind: "glob"; cause: Error }
//   | { kind: "cycle"; path: string };
// ```
/// Why a configuration could not be loaded.
#[derive(Debug)]
pub enum LoadError {
    /// A configuration file could not be read.
    Read {
        /// File that could not be read.
        path: PathBuf,
        /// Underlying filesystem failure.
        cause: std::io::Error,
    },

    /// A configuration file was not valid TOML, or carried unknown keys.
    Parse {
        /// File that could not be parsed.
        path: PathBuf,
        /// Underlying parse failure, naming the offending key or line.
        cause: toml::de::Error,
    },

    /// A glob in the configuration was malformed.
    Glob {
        /// Underlying glob failure, naming the offending pattern.
        cause: globset::Error,
    },

    /// An `extends` chain referred back to a file already in it.
    Cycle {
        /// File that closed the loop.
        path: PathBuf,
    },
}

// What:     `impl std::fmt::Display for LoadError`. Implementing a trait from
//           the STANDARD LIBRARY for our own type, which is what makes a value
//           printable with `{}` rather than the debug `{:?}`.
// Why:      These reach the user as CLI errors, so they must read as sentences.
//
// In TS you'd write (pseudocode):
// ```ts
// toString(): string { /* ... */ }
// ```
/// Human-readable rendering for configuration load failures.
impl std::fmt::Display for LoadError {
    /// Write this failure as a sentence naming the file it concerns.
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        return match self {
            LoadError::Read { path, cause } => {
                write!(formatter, "cannot read config {}: {cause}", path.display())
            }
            LoadError::Parse { path, cause } => {
                write!(formatter, "invalid config {}: {cause}", path.display())
            }
            LoadError::Glob { cause } => write!(formatter, "invalid glob in config: {cause}"),
            LoadError::Cycle { path } => write!(
                formatter,
                "config extends itself in a cycle at {}",
                path.display()
            ),
        };
    }
}

/// Marks this type as a standard error, so callers can box or chain it.
impl std::error::Error for LoadError {}

// What:     `pub fn load_file(path: &Path) -> Result<ConfigFile, LoadError>`.
//           Reads ONE file and everything it extends, returning the merged
//           result. `Result` carries either the value or the failure.
// Why:      `extends` is resolved here rather than by the caller, so every entry
//           point gets the same chain semantics.
//
// In TS you'd write (pseudocode):
// ```ts
// function loadFile(path: string): ConfigFile // throws LoadError
// ```
/// Read one configuration file, resolving everything it extends.
pub fn load_file(path: &Path) -> Result<ConfigFile, LoadError> {
    // `Vec::new()` starts the cycle-detection trail empty; each recursion level
    // appends the file it is reading.
    return load_with_trail(path, &mut Vec::new());
}

/// Read one configuration file, tracking the `extends` chain for cycles.
fn load_with_trail(path: &Path, trail: &mut Vec<PathBuf>) -> Result<ConfigFile, LoadError> {
    // What:     `path.canonicalize().unwrap_or_else(|_| path.to_path_buf())`.
    //           `canonicalize` resolves symlinks and `..` so two spellings of one
    //           file compare equal. `|_|` is a closure ignoring its argument.
    // Why:      Cycle detection compares paths, and `a/../a.toml` and `a.toml`
    //           are the same file wearing two names.
    let key = path
        .canonicalize()
        .unwrap_or_else(|_| return path.to_path_buf());

    // `.contains(&key)` scans the trail; a hit means this chain has looped.
    if trail.contains(&key) {
        return Err(LoadError::Cycle { path: key });
    }

    trail.push(key);

    // `.map_err(closure)` converts one error type into another, which is how a
    // filesystem failure becomes a `LoadError` naming the path.
    let text = fs::read_to_string(path).map_err(|cause| return LoadError::Read {
        path: path.to_path_buf(),
        cause,
    })?;

    let parsed: ConfigFile = toml::from_str(&text).map_err(|cause| return LoadError::Parse {
        path: path.to_path_buf(),
        cause,
    })?;

    // What:     `path.parent().unwrap_or_else(|| Path::new("."))`. `parent()` is
    //           absent for a bare file name, and `.` is the directory that name
    //           is relative to.
    // Why:      `extends` paths resolve relative to the file that names them, not
    //           to the process's working directory, so a shared config can be
    //           extended from anywhere.
    let directory = path.parent().unwrap_or_else(|| return Path::new("."));

    // Bases are merged in listed order, then this file's own settings go on top,
    // so the file doing the extending always wins.
    let mut merged = ConfigFile::default();
    for entry in &parsed.extends {
        let base = load_with_trail(&directory.join(entry), trail)?;
        merged = merge(merged, base);
    }

    // Remove this file from the trail so a diamond, where two branches extend one
    // shared base, is not mistaken for a cycle.
    trail.pop();

    // What:     `let mut resolved = merge(merged, parsed);` then clearing the
    //           key. `merge` CONCATENATES `extends` rather than dropping it,
    //           because it is a public function that must not lose data.
    // Why:      This is the one place that knows the chain has been walked, so
    //           this is the only place entitled to say so. Leaving the key set
    //           would make a caller re-resolve a chain already resolved.
    let mut resolved = merge(merged, parsed);
    resolved.extends = Vec::new();

    return Ok(resolved);
}

// What:     `pub fn discover(start: &Path, root: Option<&Path>) -> Vec<PathBuf>`.
//           Walks upward from a directory collecting configuration files.
// Why:      Decision D3's follow-up settled that a package-level config LAYERS
//           over the root one rather than replacing it. The repo's `lint:rust`
//           task fans out per package, so a package config that replaced the root
//           would silently drop repo-wide policy for that package, and every
//           package would have to restate it.
//
// In TS you'd write (pseudocode):
// ```ts
// function discover(start: string, root?: string): string[]
// ```
/// Collect configuration files from `start` upward, outermost first.
pub fn discover(start: &Path, root: Option<&Path>) -> Vec<PathBuf> {
    let mut found = Vec::new();

    // What:     `let mut current = Some(start);` then a `while let` loop. `while
    //           let Some(directory) = current` runs as long as the binding
    //           matches, which walks the ancestor chain until `parent()` runs out.
    // Why:      A plain `for` has nothing to iterate here; the chain is produced
    //           one step at a time.
    let mut current = Some(start);
    while let Some(directory) = current {
        let candidate = directory.join(CONFIG_FILE_NAME);
        if candidate.is_file() {
            found.push(candidate);
        }

        // Stop at the boundary the caller named, so discovery never escapes the
        // repository into a developer's home directory.
        if let Some(boundary) = root
            && directory == boundary {
                break;
            }

        current = directory.parent();
    }

    // Collected nearest-first while walking up, but merging wants outermost
    // first so nearer files land on top. `.reverse()` flips in place.
    found.reverse();
    return found;
}

// What:     `pub fn load_for(start: &Path, root: Option<&Path>) -> Result<ConfigFile, LoadError>`.
// Why:      The whole discovery-and-merge story in one call, so the CLI does not
//           re-implement the layering order.
/// Discover and merge every configuration governing a directory.
pub fn load_for(start: &Path, root: Option<&Path>) -> Result<ConfigFile, LoadError> {
    let mut merged = ConfigFile::default();
    for path in discover(start, root) {
        let loaded = load_file(&path)?;
        merged = merge(merged, loaded);
    }

    return Ok(merged);
}
