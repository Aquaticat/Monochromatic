//! What: Whether a repository holds an interrupted worktree copy the installed cli-git would
//!       finish before running a command.
//! Why: Finishing an interrupted worktree copy is not ported; running a repository-changing
//!      command beside one could race it, so the caller refuses instead. Commit transactions
//!      are recovered by `commit_recovery.rs` before this check.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // const pending = await pendingState(identity, skipWorktreeCopy); if (pending) refuse(pending);
//! ```

/// What: `use` brings names from sibling files into this file; `super::` means "the parent
///       module", where every sibling file of this crate is declared.
/// Why:  The state lives under the Git directories that the identity query reported.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import type { WorktreeIdentity } from './worktree_identity.ts';
/// ```
use super::unported::Unported;
use super::worktree_identity::WorktreeIdentity;
/// `OsStr` is borrowed operating-system text of raw bytes.
use std::ffi::OsStr;
/// What: `Path` is a borrowed filesystem path of raw bytes and `PathBuf` its owned form.
///       Sibling the reader might expect: `&str`/`String`, which must be valid UTF-8.
/// Why:  Git directories are joined and inspected without decoding.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // string paths, but byte-preserving.
/// ```
use std::path::{Path, PathBuf};

/// What: The directory, inside the common Git directory, where the installed wrapper
///       journals a worktree copy until it is complete, as path segments.
/// Why:  A journal there means a copy was interrupted.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const WORKTREE_COPY_JOURNAL_SEGMENTS = ['cli-git-worktree-copy', 'v1'];
/// ```
pub const WORKTREE_COPY_JOURNAL_SEGMENTS: &[&str] = &["cli-git-worktree-copy", "v1"];

/// The lock directory beside the journals; it is not a journal and may outlive every copy.
pub const SETTLEMENT_LOCK_NAME: &str = "settlement.lock";

/// What: Whether `directory` holds any entry other than `ignored`. `Option<&str>` is "a
///       name or nothing"; `bool` is true or false.
/// Why:  A missing directory holds nothing. A directory that cannot be listed might hold
///       anything, so it counts as holding state: the caller refuses instead of guessing.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function holdsEntries(directory: string, ignored?: string): Promise<boolean> {
///   try { return (await readdir(directory)).some(name => name !== ignored); }
///   catch (e) { return e.code !== 'ENOENT'; }
/// }
/// ```
fn holds_entries(directory: &Path, ignored: Option<&str>) -> bool {
    // What: `match` unpacks the listing `Result`; `error.kind()` classifies an OS error.
    // Why:  Only "does not exist" proves the directory is empty.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let entries; try { entries = await opendir(directory); } catch (e) { return e.code !== 'ENOENT'; }
    // ```
    let entries: std::fs::ReadDir = match std::fs::read_dir(directory) {
        Ok(listing) => listing,
        Err(error) => return error.kind() != std::io::ErrorKind::NotFound,
    };
    // `for entry in entries` reads one directory entry at a time; each is a `Result`.
    for entry in entries {
        // `let Ok(found) = ... else { ... };` unwraps the entry; an unreadable one counts as state.
        let Ok(found) = entry else {
            return true;
        };
        // `.file_name()` is the entry's own name as owned raw bytes; `.as_os_str()` lends it.
        if !is_ignored(found.file_name().as_os_str(), ignored) {
            return true;
        }
    }
    return false;
}

/// What: Whether an entry name is the one name the caller asked to ignore. `&OsStr`
///       borrows raw operating-system text. Sibling the reader might expect: `&str`,
///       which must be valid UTF-8.
/// Why:  Directory entries are raw bytes; comparing them undecoded can never mistake a
///       name that is not UTF-8 for the ignored one.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const isIgnored = (name: string, ignored?: string) => ignored !== undefined && name === ignored;
/// ```
fn is_ignored(name: &OsStr, ignored: Option<&str>) -> bool {
    // `match` unpacks "a name or nothing".
    match ignored {
        Some(expected) => return name == expected,
        None => return false,
    }
}

/// What: The interrupted worktree copies under one common Git directory, if any.
/// Why:  Journals are shared by every worktree of a repository; the settlement lock beside
///       them is not a journal.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function pendingWorktreeCopies(commonDir: string): Promise<Unported | undefined>;
/// ```
fn pending_worktree_copies(common_dir: &Path) -> Option<Unported> {
    // `.to_path_buf()` copies the borrowed path so segments can be appended; `mut` allows that.
    let mut journals: PathBuf = common_dir.to_path_buf();
    for segment in WORKTREE_COPY_JOURNAL_SEGMENTS {
        journals.push(segment);
    }
    if holds_entries(journals.as_path(), Some(SETTLEMENT_LOCK_NAME)) {
        return Some(Unported::WorktreeCopyRecovery(journals));
    }
    return None;
}

/// What: The interrupted worktree copy the installed wrapper would act on for this
///       repository location. `&WorktreeIdentity` borrows Git's answer about the location;
///       `skip_worktree_copy` is true when the caller passed `--no-worktree-copy`.
/// Why:  Worktree copies are checked only where the installed wrapper synchronizes them: a
///       linked worktree or a bare repository, and not when the caller opted out.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function pendingState(identity: WorktreeIdentity, skipWorktreeCopy: boolean): Promise<Unported | undefined>;
/// ```
pub fn pending_state(identity: &WorktreeIdentity, skip_worktree_copy: bool) -> Option<Unported> {
    // What: `match` on the borrowed identity; `{ common_dir, .. }` binds one field and ignores
    //       the rest; `|` joins patterns sharing one arm.
    // Why:  Only linked worktrees and bare repositories synchronize worktree copies.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // switch (identity.kind) { case 'outside-worktree': return undefined; /* ... */ }
    // ```
    match identity {
        WorktreeIdentity::OutsideWorktree | WorktreeIdentity::MainWorktree { .. } => return None,
        WorktreeIdentity::LinkedWorktree { common_dir, .. }
        | WorktreeIdentity::BareRepository { common_dir, .. } => {
            if skip_worktree_copy {
                return None;
            }
            return pending_worktree_copies(common_dir.as_path());
        }
    }
}

/// Disposable-directory controls stay out of the release executable.
#[cfg(test)]
#[path = "pending_state_tests.rs"]
mod tests;
