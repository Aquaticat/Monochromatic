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
/// pathname segments. The file is canonicalized only for deciding whether it
/// is inside the repository; the content read still uses its supplied path.
pub(crate) fn logical_path(path: &str, root: Option<&Path>) -> String {
    let Some(root) = root else {
        return path.to_string();
    };
    let Ok(absolute) = std::fs::canonicalize(path) else {
        return path.to_string();
    };
    if let Ok(relative) = absolute.strip_prefix(root) {
        if let Some(name) = relative.to_str() {
            return name.to_string();
        }
    }
    return path.to_string();
}

/// Converts control characters to visible escapes without altering Unicode text.
///
/// A pathname containing a newline must not inject another protocol record.
fn safe_component(component: &str) -> String {
    return component.chars().flat_map(char::escape_debug).collect();
}

/// Matches one non-empty name component as one or more engine lines.
///
/// Unix pathname components may contain newlines even though Git normally does
/// not. Feeding each newline-delimited portion through the same engine prevents
/// a rule from matching across that boundary. The component is still one name.
fn matching_rules(component: &str, loaded: &LoadedRules) -> Result<Vec<String>, ()> {
    let mut rules: Vec<String> = Vec::new();
    for set in loaded.iter_sets() {
        let matcher = AssertUnwindSafe(|| {
            let mut ids: Vec<usize> = Vec::new();
            for portion in component.as_bytes().split(|byte| return *byte == b'\n') {
                if portion.is_empty() {
                    continue;
                }
                ids.extend(set.matcher.line_matches(portion, &[0]).into_iter().map(|(_, id)| return id));
            }
            ids.sort_unstable();
            ids.dedup();
            return ids;
        });
        let Ok(ids) = catch_unwind(matcher) else {
            return Err(());
        };
        rules.extend(ids.into_iter().map(|id| return rule_token(set.base, &set.names, id)));
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
        if component.is_empty() || component == "." || component == ".." {
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
    let findings = matches.into_iter().flat_map(|(segment, rules)| {
        return rules.into_iter().map(|rule| return format!("{}:name:{} rule={}", display, segment, rule));
    }).collect();
    return PathScan { display, findings };
}

/// Unit tests keep the name-matching and masking contract beside its owner.
#[cfg(test)]
#[path = "path_scan_tests.rs"]
mod tests;
