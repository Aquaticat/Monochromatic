//! How the project appears inside the sandbox: bound again at every spelling a server is given,
//! after the sandbox's own `/tmp`, `/run`, and `/dev` replaced the host's.

/// What: `Path` is a borrowed filesystem path and `PathBuf` its owned sibling.
/// Why: Project spellings are compared and placed by path components, not as text.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Path = string;
/// ```
use std::path::{Path, PathBuf};

/// What: The bubblewrap option that mounts the project.
/// Why: Servers in 0.x only read the project. This is the one value a later write mode changes
///      (to `--bind`); every project mount uses it, including the canonical path, which the
///      read-only root would otherwise already cover.
pub const PROJECT_MOUNT: &str = "--ro-bind";

/// Locations the sandbox replaces with its own: the private `/tmp`, an empty `/run`, and a fresh
/// `/dev`. A path below one of them exists inside only if it is bound again (measured: projects
/// below `/tmp`, `/run/user/<uid>`, and `/dev/shm` were missing inside without the bind, and
/// listed and read-only with it).
pub const REPLACED_LOCATIONS: [&str; 3] = ["/tmp", "/run", "/dev"];

/// The process file system. It is mounted fresh inside, nothing a user creates can lie below it
/// (`mkdir` there fails), and bubblewrap cannot create a mount point in it.
pub const PROCESS_FILE_SYSTEM: &str = "/proc";

/// What: The replaced location a path lies in, if any. `Path::starts_with` compares whole
///       components, so `/tmpfoo` is not below `/tmp`.
/// Why: Only a spelling below a replaced location is missing inside; every other spelling
///      resolves through the read-only root to the canonical path, which is always bound.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const replacedLocation = (path: string) => REPLACED_LOCATIONS.find(top => path === top || path.startsWith(top + '/'));
/// ```
pub fn replaced_location(path: &Path) -> Option<&'static str> {
    return REPLACED_LOCATIONS
        .into_iter()
        .find(|location| return path.starts_with(location));
}

/// What: A path as text, or the refusal reason. `&'a str` borrows text from the path.
/// Why: Helix stores arguments as text, so a path that is not valid Unicode cannot be passed on.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function text(path: string, what: string): string // throws to refuse
/// ```
fn text<'a>(path: &'a Path, what: &str) -> Result<&'a str, String> {
    return path.to_str().ok_or_else(|| {
        return format!("{what} {} is not valid Unicode", path.display());
    });
}

/// What: The mount options that show the project inside: the canonical root at its own path,
///       then each other spelling that lies below a replaced location, all with `PROJECT_MOUNT`.
///       `spellings` are other spellings of the same root that servers are given, such as the
///       one Helix derives from `PWD`.
/// Why: These options come after the replacements, so the later mount wins and a project below
///      `/tmp` or `/run/media/<user>` is visible and still not writable.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function projectBinds(project: string, spellings: string[]): string[] // throws to refuse
/// ```
pub fn project_binds(project: &Path, spellings: &[PathBuf]) -> Result<Vec<String>, String> {
    let canonical = text(project, "the project")?;
    let mut options = vec![
        PROJECT_MOUNT.to_string(),
        canonical.to_string(),
        canonical.to_string(),
    ];
    for spelling in spellings {
        if spelling.as_path() == project || replaced_location(spelling).is_none() {
            continue;
        }
        options.push(PROJECT_MOUNT.to_string());
        options.push(canonical.to_string());
        options.push(text(spelling, "the project spelling")?.to_string());
    }
    return Ok(options);
}

/// Mount options per project spelling, the one mount option, and whole-component location checks.
#[cfg(test)]
#[path = "project_tests.rs"]
mod tests;
