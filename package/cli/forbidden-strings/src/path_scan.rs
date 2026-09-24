//! Scans logical pathname components without exposing matched names.
//!
//! A component is one directory name or filename, not the path between them.
//! The engine returns matching rule ids rather than match spans, so a matching
//! component is masked in full. All findings for the file share the same masked
//! display path, including content and read-error findings made by the caller.

/// Imports the filesystem path type for repository-root-relative names.
use std::path::Path;
/// Imports the unwind boundary that keeps a matcher panic from passing a scan.
use std::panic::{catch_unwind, AssertUnwindSafe};

/// Imports loaded matcher sets and their shared rule-identity formatter.
use crate::{frx_load::LoadedRules, frx_scan::rule_token};

/// Mask substituted for a pathname component that matches any active rule.
const REDACTED: &str = "[REDACTED]";

/// Redacted label and findings for one scanned pathname.
pub(crate) struct PathScan {
    /// Path safe for content findings and read-error diagnostics.
    pub(crate) display: String,
    /// Distinct name findings, one for each matching component and rule.
    pub(crate) findings: Vec<String>,
}

/// Discovers the Git root, if cwd or an ancestor has a `.git` entry.
///
/// A worktree's `.git` file counts as a root just as a main repository's
/// `.git` directory does. A standalone invocation returns `None`.
pub(crate) fn repository_root() -> Option<std::path::PathBuf> {
    // `current_dir` owns an absolute path; failure leaves explicit names lexical.
    let cwd = std::env::current_dir().ok()?;
    for ancestor in cwd.ancestors() {
        if ancestor.join(".git").exists() {
            return Some(ancestor.to_path_buf());
        }
    }
    return None;
}

/// Chooses a repository-relative name for files inside the repository.
///
/// Paths outside a repository and standalone invocations retain all supplied
/// pathname segments. Lexical normalization removes navigation markers without
/// following symlinks: the selected link name, not its target, must be scanned.
pub(crate) fn logical_path(path: &str, root: Option<&Path>) -> String {
    let Some(root) = root else {
        return path.to_string();
    };
    let input = Path::new(path);
    let absolute = if input.is_absolute() {
        input.to_path_buf()
    } else {
        let Ok(cwd) = std::env::current_dir() else {
            return path.to_string();
        };
        cwd.join(input)
    };
    let mut normalized = std::path::PathBuf::new();
    for part in absolute.components() {
        if part == std::path::Component::ParentDir {
            normalized.pop();
        } else if part != std::path::Component::CurDir {
            normalized.push(part.as_os_str());
        }
    }
    if let Ok(relative) = normalized.strip_prefix(root)
        && let Some(name) = relative.to_str() {
            return name.to_string();
        }
    return path.to_string();
}

/// Escapes reserved protocol colons and control characters in visible names.
///
/// No literal colon remains in a display path, so `:name:` cannot be mistaken
/// for the finding-kind separator even if a filename ends with `:name`.
/// and a newline must never inject another protocol record.
fn safe_component(component: &str) -> String {
    let mut safe = String::new();
    for ch in component.chars() {
        if ch == ':' {
            safe.push_str("\\x3a");
        } else if ch == '\\' {
            safe.push_str("\\\\");
        } else if ch.is_control() {
            safe.push_str(&format!("\\u{{{:x}}}", ch as u32));
        } else {
            safe.push(ch);
        }
    }
    return safe;
}

/// Matches one non-empty, single-line name component against all loaded sets.
///
/// The engine treats a trailing CR or LF as a content-line terminator, which
/// would change anchor semantics for a filename. Callers fail closed on those
/// pathname bytes instead of misrepresenting an incomplete name as a match.
fn matching_rules(component: &str, loaded: &LoadedRules) -> Result<Vec<String>, ()> {
    let mut rules: Vec<String> = Vec::new();
    for set in loaded.iter_sets() {
        let matcher = AssertUnwindSafe(|| return set.matcher.line_matches(component.as_bytes(), &[0]));
        let Ok(ids) = catch_unwind(matcher) else {
            return Err(());
        };
        rules.extend(ids.into_iter().map(|(_, id)| return rule_token(set.base, &set.names, id)));
    }
    return Ok(rules);
}

/// Scans each logical component and masks every component with a matching rule.
///
/// Component numbers are one-based and ignore the root and navigation markers
/// (`.`, `..`), which are not directory names. A matcher panic masks the entire
/// path and returns an engine-error finding instead of printing unsafe input.
pub(crate) fn scan_path(path: &str, loaded: &LoadedRules) -> PathScan {
    // Git paths use `/`; native external paths use the platform separator.
    let normalized = if cfg!(windows) { path.replace('\\', "/") } else { path.to_string() };
    let components: Vec<&str> = normalized.split('/').collect();
    let mut displayed: Vec<String> = Vec::with_capacity(components.len());
    let mut matches: Vec<(usize, Vec<String>)> = Vec::new();
    let mut position = 0;
    for component in components {
        if component.contains('\n') || component.contains('\r') {
            return PathScan {
                display: REDACTED.to_string(),
                findings: vec![format!("{}: unsupported pathname line break", REDACTED)],
            };
        }
        if component.is_empty() || component == "." || component == ".." {
            displayed.push(safe_component(component));
            continue;
        }
        // The native drive or network root is not a directory name.
        if cfg!(windows) && position == 0 && component.len() == 2
            && component.as_bytes()[1] == b':' && component.as_bytes()[0].is_ascii_alphabetic() {
            displayed.push(safe_component(component));
            continue;
        }
        position += 1;
        let Ok(rules) = matching_rules(component, loaded) else {
            return PathScan {
                display: REDACTED.to_string(),
                findings: vec![format!("{}: engine error", REDACTED)],
            };
        };
        if rules.is_empty() {
            displayed.push(safe_component(component));
        } else {
            displayed.push(REDACTED.to_string());
            matches.push((position, rules));
        }
    }
    let display = displayed.join("/");
    let mut findings: Vec<String> = Vec::new();
    for (segment, rules) in matches {
        for rule in rules {
            findings.push(format!("{}:name:{} rule={}", display, segment, rule));
        }
    }
    return PathScan { display, findings };
}

/// Unit tests keep the name-matching and masking contract beside its owner.
#[cfg(test)]
#[path = "path_scan_tests.rs"]
mod tests;
