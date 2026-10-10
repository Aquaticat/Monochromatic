//! What:
//!  The shadow repository's `config` file, written by cli-git itself,
//!       and the repository format facts it copies from the real common config.
//! Why:
//!  Git does not apply `core.repositoryformatversion` and `extensions.*` from an included file,
//!  so they are copied explicitly.
//!  `core.hooksPath` precedes the include so a real `core.hooksPath` still overrides it;
//!  `core.worktree`, `gc.auto` and `maintenance.auto` follow it,
//!  so the real config cannot redirect the worktree or start maintenance in the shadow
//!  (`src/shadow-repository/shadow-config.ts`).
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! formatShadowConfig({ format, commonDir, worktreeRoot });
//! ```

/// One required Git start, and its failure text.
use super::transaction_git::{GitContext, GitFailure, GitRequest, run_git_checked};
/// `Path` is a borrowed filesystem path.
use std::path::Path;

/// What:
///  Repository format facts the shadow copies from the real common config.
/// Why:
///   A shadow with a different object format or ref backend would misread the real store.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type RepositoryFormat = { version: string; extensions: [string, string][] };
/// ```
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RepositoryFormat {
    /// `core.repositoryformatversion`, `0` when unset.
    pub version: String,
    /// Every `extensions.*` key with its value, in file order, the prefix removed.
    pub extensions: Vec<(String, String)>,
}

/// What:
///  Quotes one value under Git's config syntax.
/// Why:
///   The value is always double-quoted,
///  so `;`, `#` and surrounding whitespace stay literal;
///  backslash, double quote, newline and tab use Git's escapes.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// quoteGitConfigValue('/a "b"'); // '"/a \\"b\\""'
/// ```
pub fn quote_git_config_value(value: &str) -> String {
    let mut body: String = String::with_capacity(value.len());
    for character in value.chars() {
        match character {
            '\\' => body.push_str(r"\\"),
            '"' => body.push_str(r#"\""#),
            '\n' => body.push_str(r"\n"),
            '\t' => body.push_str(r"\t"),
            other => body.push(other),
        }
    }
    return format!("\"{body}\"");
}

/// What:
///  Reads the format facts from the real common config file alone.
/// Why:
///   `git config --file config --list` reads only that file,
///  so an included or worktree config never leaks into the copied format.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// await readRepositoryFormat({ gitPath, commonDir });
/// ```
pub fn read_repository_format(
    context: &GitContext,
    common_dir: &Path,
) -> Result<RepositoryFormat, GitFailure> {
    let mut request: GitRequest = GitRequest::new(
        common_dir,
        &["config", "--file", "config", "--null", "--list"],
    );
    request.without_prefix = true;
    let output = run_git_checked(context, &request)?;
    let mut version: Option<String> = None;
    let mut extensions: Vec<(String, String)> = Vec::new();
    for entry in output.stdout.split(|byte| *byte == 0).filter(|entry| !entry.is_empty()) {
        // A key without a value line is a valueless boolean, which reads as `true`.
        let (key, value): (&[u8], &[u8]) = match entry.iter().position(|byte| *byte == b'\n') {
            Some(newline) => (&entry[..newline], &entry[newline + 1..]),
            None => (entry, &b"true"[..]),
        };
        let key_text: String = String::from_utf8_lossy(key).into_owned();
        let value_text: String = String::from_utf8_lossy(value).into_owned();
        if key_text.to_lowercase() == "core.repositoryformatversion" {
            version = Some(value_text.clone());
        }
        if key_text.is_char_boundary(11) && key_text[..11].to_lowercase() == "extensions." {
            extensions.push((key_text[11..].to_string(), value_text));
        }
    }
    return Ok(RepositoryFormat {
        version: version.unwrap_or_else(|| String::from("0")),
        extensions,
    });
}

/// What:
///  Formats the shadow `config` file.
/// Why:
///   The line order is the incumbent's:
///  hooks path before the include, then the worktree, gc and maintenance overrides.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// formatShadowConfig({ format, commonDir, worktreeRoot });
/// ```
pub fn format_shadow_config(format: &RepositoryFormat, common_dir: &Path, worktree_root: &Path) -> String {
    let common: String = common_dir.display().to_string();
    let mut lines: Vec<String> = vec![
        String::from("[core]"),
        format!("\trepositoryformatversion = {}", quote_git_config_value(format.version.as_str())),
        format!("\thooksPath = {}", quote_git_config_value(format!("{common}/hooks").as_str())),
    ];
    if !format.extensions.is_empty() {
        lines.push(String::from("[extensions]"));
        for (name, value) in &format.extensions {
            lines.push(format!("\t{name} = {}", quote_git_config_value(value.as_str())));
        }
    }
    lines.push(String::from("[include]"));
    lines.push(format!(
        "\tpath = {}",
        quote_git_config_value(format!("{common}/config").as_str())
    ));
    lines.push(String::from("[core]"));
    lines.push(format!(
        "\tworktree = {}",
        quote_git_config_value(worktree_root.display().to_string().as_str())
    ));
    lines.push(String::from("[gc]"));
    lines.push(String::from("\tauto = 0"));
    lines.push(String::from("[maintenance]"));
    lines.push(String::from("\tauto = false"));
    lines.push(String::new());
    return lines.join("\n");
}

/// Shadow config controls stay out of the release executable.
#[cfg(test)]
#[path = "shadow_config_tests.rs"]
mod tests;
