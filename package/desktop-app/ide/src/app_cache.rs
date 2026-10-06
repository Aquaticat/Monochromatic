//! The application's private cache directory, `$XDG_CACHE_HOME/monochromatic-ide`.
//!
//! What: One function that both language-server state and unpacked parser libraries build on.
//! Why: The application may keep private cache files outside the project (scope decision), and two
//!      copies of the rule for finding that directory could drift apart.

/// An owned path: callers join further names onto the cache directory.
use std::path::PathBuf;

/// What: The cache directory, or `None` when neither variable is an absolute path.
///       `Option<PathBuf>` is an owned path or nothing (sibling: `&Path`, a borrowed path);
///       `var_os` reads a variable without requiring UTF-8; `.filter(...)` keeps only absolute values;
///       `.or_else(...)` tries the home directory's `.cache` when the first is missing.
/// Why: The XDG base directory specification names `$XDG_CACHE_HOME`, falling back to `~/.cache`,
///      and says relative values are invalid and must be ignored. An owned path is returned because
///      callers join further names onto it.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function applicationCache(): string | undefined {
///   const cache = absolute(env.XDG_CACHE_HOME) ?? (absolute(env.HOME) && join(env.HOME, '.cache'));
///   return cache && join(cache, 'monochromatic-ide');
/// }
/// ```
pub fn application_cache() -> Option<PathBuf> {
    // The trailing `?` returns `None` from this function when neither variable is usable.
    let cache = std::env::var_os("XDG_CACHE_HOME")
        .map(PathBuf::from)
        // What: `|path| return path.is_absolute()` is an arrow function given each candidate.
        // Why: A relative value would depend on the working directory, which the application changes.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // (path) => isAbsolute(path)
        // ```
        .filter(|path| return path.is_absolute())
        .or_else(|| {
            return std::env::var_os("HOME")
                .map(PathBuf::from)
                .filter(|path| return path.is_absolute())
                .map(|home| return home.join(".cache"));
        })?;
    // What: `Some(...)` wraps the joined path as the present variant of `Option`.
    // Why: Callers distinguish "no cache directory" from a usable one.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return join(cache, 'monochromatic-ide');
    // ```
    return Some(cache.join("monochromatic-ide"));
}
