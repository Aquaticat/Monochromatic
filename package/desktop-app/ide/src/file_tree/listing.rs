//! Validate complete background snapshots before replacing any visible tree state.

/// Parent-private state remains owned by the same tree rather than duplicated in a worker.
use super::FileTree;
/// Preserve native names and dirent kinds from the existing read-only workspace reader.
use crate::workspace::DirectoryEntry;
/// Invalid snapshots are errors,
///  not partial updates or empty-directory fallbacks.
use anyhow::{Result, bail};
/// Sets detect duplicate paths without changing input order;
///  paths retain non-UTF-8 names.
use std::{
    collections::BTreeSet,
    path::{Component, Path},
};

/// Check one snapshot independently so a rejected reply cannot partly update expansion state.
fn validate(directory: &Path, entries: &[DirectoryEntry]) -> Result<()> {
    // What: BTreeSet::new owns unique keys; Vec would permit duplicates and require repeated scans.
    // Why: Duplicate row paths must be rejected without sorting the displayed entries.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const seen = new Set<string>();
    // ```
    let mut seen = BTreeSet::new();
    for entry in entries {
        // What: components separates native path segments; Normal excludes '.', '..', roots and prefixes.
        // Why: A snapshot must contain immediate children, not traversal expressions or synthetic paths.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (!isSingleNormalFilename(entry.name)) throw new Error('Invalid child');
        // ```
        let mut components = Path::new(&entry.name).components();
        let valid_name = matches!(components.next(), Some(Component::Normal(name)) if name == entry.name.as_os_str())
            && components.next().is_none();
        if !valid_name || entry.path != directory.join(&entry.name) {
            bail!(
                "Invalid tree entry {} in directory {}",
                entry.path.display(),
                directory.display()
            );
        }
        // Lend each path while validating; the set does not outlive this snapshot borrow.
        if !seen.insert(&entry.path) {
            bail!(
                "Duplicate tree entry {} in directory {}",
                entry.path.display(),
                directory.display()
            );
        }
    }
    // What: Ok(()) reports validation success without producing another copy of the snapshot.
    // Why: The caller can install its original ordered entries only after all checks pass.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return;
    // ```
    return Ok(());
}

/// Apply snapshots without performing I/O or treating the presentation model as security confinement.
impl FileTree {
    /// Replace a synchronous snapshot atomically;
    ///  asynchronous readers must use complete_listing's token check.
    /// Removed or reclassified subtrees lose stale caches and pending reads.
    pub fn apply_listing(&mut self, directory: &Path, entries: Vec<DirectoryEntry>) -> Result<()> {
        if directory != self.root {
            // What: if-let extracts a borrowed entry when its parent snapshot still contains it.
            // Why: Replies for removed directories must not resurrect detached tree state.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const entry = this.entry(directory);
            // if (entry === undefined || !entry.isDirectory) throw new Error('Unknown directory');
            // ```
            if let Some(entry) = self.entry(directory) {
                if !entry.is_directory {
                    bail!(
                        "Cannot list non-directory tree entry {}",
                        directory.display()
                    );
                }
            } else {
                bail!("Cannot list unknown tree directory {}", directory.display());
            }
        }
        // What: ? propagates validation errors before the tree's first mutation.
        // Why: A malformed reply preserves both visible rows and expansion state.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // validate(directory, entries);
        // ```
        validate(directory, &entries)?;
        // Borrow keys of surviving directories once, avoiding a repeated scan per old entry.
        let mut surviving = BTreeSet::new();
        for entry in &entries {
            if entry.is_directory {
                surviving.insert(entry.path.as_path());
            }
        }
        // Gather owned detached names before mutably borrowing the same directory map.
        let mut removed = BTreeSet::new();
        // Borrow the previous snapshot if one exists; first loads have no detached subtrees.
        if let Some(previous) = self.directories.get(directory) {
            for old in previous {
                // A directory replaced with a file or symlink must also discard its descendants.
                if old.is_directory && !surviving.contains(old.path.as_path()) {
                    // What: clone copies the owned native path instead of borrowing the soon-replaced snapshot.
                    // Why: Cache pruning runs after the immutable snapshot borrow ends.
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // removed.add(old.path);
                    // ```
                    removed.insert(old.path.clone());
                }
            }
        }
        // What: retain closures keep only paths with no removed ancestor; ancestors includes the path itself.
        // Why: Prune each cache once, without comparing every cached path with every removed directory.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // keepPathsWhere(path => !ancestors(path).some(parent => removed.has(parent)));
        // ```
        self.directories.retain(|path, _entries| {
            return !path
                .ancestors()
                .any(|parent| return removed.contains(parent));
        });
        self.expanded.retain(|path| {
            return !path
                .ancestors()
                .any(|parent| return removed.contains(parent));
        });
        // Detached requests cannot become current again if the same directory name is later recreated.
        self.pending.retain(|path, _request| {
            return !path
                .ancestors()
                .any(|parent| return removed.contains(parent));
        });
        // A synchronous snapshot also supersedes any older in-flight read of this directory.
        self.pending.remove(directory);
        tracing::debug!(path = %directory.display(), entries = entries.len(), "applied tree directory snapshot");
        // Copy only the directory key; move the already ordered entries into the cache.
        self.directories.insert(directory.to_path_buf(), entries);
        // Successful application does not return another snapshot copy.
        return Ok(());
    }
}
