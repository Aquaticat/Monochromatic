//! What: Whether a repository holds durable state the installed cli-git would recover or
//!       wait for before running a command: commit transactions and interrupted worktree
//!       copies.
//! Why: The installed wrapper recovers a dead commit transaction at startup, makes a
//!      command that writes the index wait for a landing commit, and finishes an
//!      interrupted worktree copy. None of that is ported, and this executable cannot tell
//!      a dead owner from a live one. Running a repository-changing command beside such
//!      state could race a landing commit, so the caller refuses instead.
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

/// What: The directory, inside the invocation's Git directory, where the installed wrapper
///       registers commit transactions and their locks. `&str` is text baked into the program.
/// Why:  Any entry there is a transaction, a staging directory or a lock.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const TRANSACTION_REGISTRY_NAME = 'cli-git-transactions';
/// ```
pub const TRANSACTION_REGISTRY_NAME: &str = "cli-git-transactions";

/// The single transaction directory earlier builds of the installed wrapper wrote.
pub const LEGACY_TRANSACTION_NAME: &str = "cli-git-transaction";

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

/// What: Whether anything exists at `path`, without following a link. A path that cannot
///       be inspected counts as existing.
/// Why:  The legacy transaction directory is state whatever it contains.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function exists(path: string): Promise<boolean> { try { await lstat(path); return true; } catch (e) { return e.code !== 'ENOENT'; } }
/// ```
fn exists(path: &Path) -> bool {
    match std::fs::symlink_metadata(path) {
        Ok(_) => return true,
        Err(error) => return error.kind() != std::io::ErrorKind::NotFound,
    }
}

/// What: The transaction state under one Git directory, if any. `Option<Unported>` is "a
///       reason to refuse, or nothing".
/// Why:  Both the registry and the legacy directory belong to the invocation's own Git
///       directory, which differs per linked worktree.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function pendingTransactions(gitDir: string): Promise<Unported | undefined>;
/// ```
fn pending_transactions(git_dir: &Path) -> Option<Unported> {
    // `.join` appends one path segment and returns an owned path.
    let registry: PathBuf = git_dir.join(TRANSACTION_REGISTRY_NAME);
    // `None` is the "absent" case: no name is ignored in the registry.
    if holds_entries(registry.as_path(), None) {
        // `Some(x)` is the "present" case of `Option`.
        return Some(Unported::TransactionRecovery(registry));
    }
    let legacy: PathBuf = git_dir.join(LEGACY_TRANSACTION_NAME);
    if exists(legacy.as_path()) {
        return Some(Unported::TransactionRecovery(legacy));
    }
    return None;
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

/// What: The first durable state that the installed wrapper would act on for this
///       repository location. `&WorktreeIdentity` borrows Git's answer about the location;
///       `skip_worktree_copy` is true when the caller passed `--no-worktree-copy`.
/// Why:  Commit transactions are checked wherever there is a Git directory. Worktree
///       copies are checked only where the installed wrapper synchronizes them: a linked
///       worktree or a bare repository, and not when the caller opted out.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function pendingState(identity: WorktreeIdentity, skipWorktreeCopy: boolean): Promise<Unported | undefined>;
/// ```
pub fn pending_state(identity: &WorktreeIdentity, skip_worktree_copy: bool) -> Option<Unported> {
    // What: `match` on the borrowed identity; `{ git_dir, common_dir, .. }` binds two
    //       fields and ignores the rest; `|` joins patterns sharing one arm.
    // Why:  Only the main worktree is exempt from worktree-copy recovery.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // switch (identity.kind) { case 'outside-worktree': return undefined; /* ... */ }
    // ```
    match identity {
        WorktreeIdentity::OutsideWorktree => return None,
        WorktreeIdentity::MainWorktree { git_dir, .. } => {
            return pending_transactions(git_dir.as_path());
        }
        WorktreeIdentity::LinkedWorktree {
            git_dir,
            common_dir,
            ..
        }
        | WorktreeIdentity::BareRepository {
            git_dir,
            common_dir,
        } => {
            // `if let Some(found) = ...` runs only when transaction state exists.
            if let Some(found) = pending_transactions(git_dir.as_path()) {
                return Some(found);
            }
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
