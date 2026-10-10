//! What: The real Git version check, run once per invocation before work that depends on Git's
//!       behavior: a commit, hooks and locks.
//! Why: The native tables and protocols follow Git 2.56.0; the owner settled that 2.56.0 or newer
//!      counts as supported and that read-only commands are never checked
//!      (`doc/handover/cli-git-rust-implementation.md`, "Adopted without a question").
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! await requireSupportedGit({ gitPath }); // once
//! ```

/// Running real Git.
use super::transaction_git::{GitContext, GitOutput, GitRequest, run_git};
/// `OnceLock` holds the one answer of this process.
use std::sync::OnceLock;

/// The oldest supported Git release.
pub const MINIMUM_GIT_VERSION: (u64, u64, u64) = (2, 56, 0);

/// The answer of this process's one check.
static CHECKED: OnceLock<Result<(u64, u64, u64), String>> = OnceLock::new();

/// What: The release numbers of `git version` output, such as `git version 2.56.0.windows.1`.
/// Why:  Only the first three dotted numbers decide support; platform suffixes vary.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function parseGitVersion(output: string): [number, number, number] | undefined;
/// ```
pub fn parse_git_version(output: &[u8]) -> Option<(u64, u64, u64)> {
    let text: &str = std::str::from_utf8(output).ok()?;
    let release: &str = text.strip_prefix("git version ")?.split_whitespace().next()?;
    let mut parts: std::str::Split<'_, char> = release.split('.');
    let major: u64 = parts.next()?.parse::<u64>().ok()?;
    let minor: u64 = parts.next()?.parse::<u64>().ok()?;
    let patch_text: &str = parts.next()?;
    // A release candidate such as `2.56.0-rc1` keeps its leading digits.
    let digits: &str = &patch_text[..patch_text.find(not_digit).unwrap_or(patch_text.len())];
    let patch: u64 = digits.parse::<u64>().ok()?;
    return Some((major, minor, patch));
}

/// What: Whether a character is not an ASCII digit.
/// Why:  A named predicate keeps the search free of closures.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// (character: string) => !/[0-9]/.test(character)
/// ```
fn not_digit(character: char) -> bool {
    return !character.is_ascii_digit();
}

/// What: The message for an unsupported or unreadable Git.
/// Why:  The person must know which Git was asked and what to do.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// `cli-git: ... needs Git 2.56.0 or newer ...`
/// ```
pub fn unsupported_message(context: &GitContext, found: &str) -> String {
    return format!(
        "cli-git: real Git at {} reports {found}; commits, hooks and the locks that coordinate \
         with them need Git 2.56.0 or newer. Nothing was run. Upgrade Git, then run the command \
         again.",
        context.real_git.display()
    );
}

/// What: Ask Git its version and decide support, without the cache.
/// Why:  `check_git_version` remembers this answer.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function askGitVersion(gitPath): Promise<[number, number, number]>;
/// ```
pub fn ask_git_version(context: &GitContext) -> Result<(u64, u64, u64), String> {
    let mut request: GitRequest = GitRequest::new(std::path::Path::new("."), &["version"]);
    request.without_prefix = true;
    let output: GitOutput = match run_git(context, &request) {
        Ok(finished) => finished,
        Err(error) => return Err(unsupported_message(context, format!("nothing ({error})").as_str())),
    };
    let Some(version) = parse_git_version(output.stdout.as_slice()) else {
        let shown: String = String::from_utf8_lossy(output.stdout.as_slice()).trim().to_string();
        return Err(unsupported_message(context, format!("an unreadable version {shown:?}").as_str()));
    };
    if version < MINIMUM_GIT_VERSION {
        return Err(unsupported_message(
            context,
            format!("version {}.{}.{}", version.0, version.1, version.2).as_str(),
        ));
    }
    return Ok(version);
}

/// What: Require a supported Git, asking at most once per process.
/// Why:  The check costs a Git process, so later dependent steps reuse the answer.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// await requireSupportedGit({ gitPath });
/// ```
pub fn check_git_version(context: &GitContext) -> Result<(u64, u64, u64), String> {
    if let Some(known) = CHECKED.get() {
        return known.clone();
    }
    let answer: Result<(u64, u64, u64), String> = ask_git_version(context);
    // Another thread may have set it meanwhile; the first answer stands.
    let _ = CHECKED.set(answer.clone());
    return answer;
}

/// Version controls stay out of the release executable.
#[cfg(test)]
#[path = "git_version_tests.rs"]
mod tests;
