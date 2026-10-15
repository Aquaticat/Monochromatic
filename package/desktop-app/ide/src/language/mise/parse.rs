//! Reading what mise prints:
//!  the configuration files it lists,
//!  the tool directories,
//!  and its messages.
//!
//! Everything here is a pure function of text,
//!  so it is tested with captured and hostile output and no mise program.

/// A listing is a JSON array of objects.
use serde_json::Value;
/// What:
///  `PathBuf` is an owned filesystem path.
/// Why:
///  Directories are checked against the file system and returned as owned values.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Path = string;
/// ```
use std::path::PathBuf;

/// Longest message kept from mise,
///  in characters.
///  Chosen,
///  not measured:
///  the longest message seen was an untrusted-configuration refusal of about 400 characters.
pub const MESSAGE_LIMIT: usize = 1000;

/// What:
///  The configuration files in the output of `mise config ls --json`.
///  `Result<Vec<PathBuf>, String>` is the list or the reason the output is not a listing.
/// Why:
///  Mise decides which files apply;
///  the application reads only their paths.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function configPaths(json: string): string[] // throws when json is not a listing
/// ```
pub fn config_paths(json: &str) -> Result<Vec<PathBuf>, String> {
    let parsed: Value = serde_json::from_str(json).map_err(|error| {
        return format!("the listing of mise configuration files is not JSON: {error}");
    })?;
    let Some(entries) = parsed.as_array() else {
        return Err("the listing of mise configuration files is not a JSON array".to_string());
    };
    let mut paths = Vec::new();
    for entry in entries {
        let Some(path) = entry.get("path").and_then(Value::as_str) else {
            return Err(
                "an entry of the listing of mise configuration files has no path".to_string(),
            );
        };
        paths.push(PathBuf::from(path));
    }
    return Ok(paths);
}

/// What:
///  The files of `project` that `global` does not list:
///  the configuration that applies to the project folder in particular.
/// Why:
///  The user's global configuration applies to every folder,
///  so it says nothing about this project.
///  Comparing two listings of mise's own makes no assumption about file names or layouts.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const projectConfigs = (project: string[], global: string[]) => project.filter(path => !global.includes(path));
/// ```
pub fn project_configs(project: &[PathBuf], global: &[PathBuf]) -> Vec<PathBuf> {
    return project
        .iter()
        .filter(|path| return !global.contains(path))
        .cloned()
        .collect();
}

/// What:
///  The tool directories in the output of `mise bin-paths`:
///  one per line,
///  kept only when absolute and an existing directory,
///  first occurrence only.
/// Why:
///  A relative entry would depend on the working directory,
///  and an entry that is not a directory cannot hold a program.
///  Lines are split on `\n` only,
///  so a directory name containing spaces or other characters stays whole.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const directories = (output: string) => unique(output.split('\n').filter(line => isAbsolute(line) && isDirectory(line)));
/// ```
pub fn directories(output: &str) -> Vec<PathBuf> {
    let mut found: Vec<PathBuf> = Vec::new();
    for line in output.split('\n') {
        let trimmed = line.strip_suffix('\r').unwrap_or(line);
        if trimmed.is_empty() {
            continue;
        }
        let path = PathBuf::from(trimmed);
        if !path.is_absolute() || !path.is_dir() {
            tracing::debug!(
                line = trimmed,
                "mise printed a tool directory that is not used"
            );
            continue;
        }
        if !found.contains(&path) {
            found.push(path);
        }
    }
    return found;
}

/// What:
///  Whether a line is mise's own bookkeeping rather than a message about the project:
///  the version footer of an error and the notice about a newer mise.
/// Why:
///  The version footer says nothing about the cause,
///  and the update notice appears on every run.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const isNoise = (line: string) => /Version: |Run with --verbose|version .* available|mise self-update/.test(line);
/// ```
fn is_noise(line: &str) -> bool {
    return line.contains("Run with --verbose or MISE_VERBOSE=1")
        || line.starts_with("mise ERROR Version: ")
        || (line.contains("mise version ") && line.contains(" available"))
        || line.contains("To update, run mise self-update");
}

/// What:
///  Mise's standard error as one message:
///  escape sequences and control characters removed,
///  bookkeeping lines dropped,
///  the rest verbatim,
///  cut at `MESSAGE_LIMIT` characters.
/// Why:
///  The text is shown to the reader as mise's exact words,
///  and it may contain project-supplied names,
///  so nothing that moves the cursor or recolors the screen is passed on.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function message(stderr: string): string
/// ```
pub fn message(stderr: &str) -> String {
    let mut plain = String::new();
    let mut characters = stderr.chars().peekable();
    while let Some(character) = characters.next() {
        if character == '\u{1b}' {
            // A control sequence is `ESC [`, parameter bytes, then one final byte from `@` to `~`;
            // an operating-system command is `ESC ]` up to a bell or `ESC \`.
            match characters.next() {
                Some('[') => {
                    for next in characters.by_ref() {
                        if ('@'..='~').contains(&next) {
                            break;
                        }
                    }
                }
                Some(']') => {
                    for next in characters.by_ref() {
                        if next == '\u{7}' {
                            break;
                        }
                        if next == '\u{1b}' {
                            characters.next_if_eq(&'\\');
                            break;
                        }
                    }
                }
                _ => {}
            }
            continue;
        }
        if character == '\n' || character == '\t' || !character.is_control() {
            plain.push(character);
        }
    }
    let kept: Vec<&str> = plain
        .lines()
        .map(str::trim_end)
        .filter(|line| return !line.is_empty() && !is_noise(line))
        .collect();
    let joined = kept.join("\n");
    if joined.chars().count() <= MESSAGE_LIMIT {
        return joined;
    }
    let cut: String = joined.chars().take(MESSAGE_LIMIT).collect();
    return format!("{cut}...");
}

/// What:
///  Several standard-error texts as one message,
///  each line once.
/// Why:
///  The same warning (a configuration field mise does not know) is printed by every run.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const merge = (texts: string[]) => unique(texts.flatMap(text => message(text).split('\n'))).join('\n');
/// ```
pub fn merge(texts: &[&str]) -> String {
    let mut lines: Vec<String> = Vec::new();
    for text in texts {
        for line in message(text).lines() {
            if !lines.iter().any(|known| return known == line) {
                lines.push(line.to_string());
            }
        }
    }
    return lines.join("\n");
}

/// What:
///  The configuration file named by mise's refusal of an untrusted configuration,
///  if the message is that refusal.
/// Why:
///  The remedy (the user runs `mise trust` on that file) must name the file,
///  and only mise knows which file of the several that apply is the untrusted one.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const untrustedConfig = (message: string) => /Config files in (.+) are not trusted/.exec(message)?.[1];
/// ```
pub fn untrusted_config(message: &str) -> Option<&str> {
    const BEFORE: &str = "Config files in ";
    const AFTER: &str = " are not trusted";
    let start = message.find(BEFORE)? + BEFORE.len();
    let length = message[start..].find(AFTER)?;
    let file = &message[start..start + length];
    if file.is_empty() {
        return None;
    }
    return Some(file);
}

/// Listings,
///  directories,
///  messages,
///  and the untrusted-file extraction on captured and hostile text.
#[cfg(test)]
#[path = "parse_tests.rs"]
mod tests;
