//! Opaque directory-read identities fence asynchronous replies independently of source-file revisions.

/// Parent-owned cache state and request tokens share one lifecycle boundary.
use super::{DirectoryRequest, FileTree};
/// Completed requests carry the reader's original ordered snapshot or failure.
use crate::workspace::DirectoryEntry;
/// Request failures identify the directory; stale failures never replace a current diagnostic.
use anyhow::{Result, bail};
/// Path borrows native names; Arc preserves one allocation identity across threads.
use std::{path::Path, sync::Arc};

/// Expose the read target without exposing mutation of its opaque identity.
impl DirectoryRequest {
    /// Borrow the path for the read-only workspace operation.
    pub fn path(&self) -> &Path {
        // What: Arc dereferences to its owned PathBuf, whose as_path lends a Path.
        // Why: The worker can read a filename but cannot rewrite the request to another directory.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return request.path;
        // ```
        return self.path.as_path();
    }
}

/// A request becomes stale when superseded, completed, or removed by an ancestor snapshot.
impl FileTree {
    /// Start or supersede a read for a known directory; actual I/O belongs to the worker.
    pub fn begin_listing(&mut self, directory: &Path) -> Result<DirectoryRequest> {
        if directory != self.root {
            // What: Option::is_some_and runs the closure only for a present borrowed entry.
            // Why: Unknown paths, files, and symlink dirents cannot become directory read requests.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // if (this.entry(directory)?.isDirectory !== true) throw new Error('Not a known directory');
            // ```
            if !self
                .entry(directory)
                .is_some_and(|entry| return entry.is_directory)
            {
                bail!(
                    "Cannot request a listing for unknown or non-directory tree entry {}",
                    directory.display()
                );
            }
        }
        // What: Arc::new owns the copied native path; clones share that allocation rather than its identity changing.
        // Why: Equal path text from two different requests must not make their replies interchangeable.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const request = { path: directory, identity: {} };
        // ```
        let request = DirectoryRequest {
            path: Arc::new(directory.to_path_buf()),
        };
        // Clone the token's shared owner while returning another owner to the worker.
        self.pending
            .insert(directory.to_path_buf(), request.clone());
        tracing::debug!(path = %directory.display(), "started tree directory request");
        // What: Ok returns the prepared request; Err would carry a rejected operation.
        // Why: Request creation does not imply any directory bytes have been read yet.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return request;
        // ```
        return Ok(request);
    }

    /// Accept a current reply once; stale success and failure replies both return false without side effects.
    pub fn complete_listing(
        &mut self,
        request: &DirectoryRequest,
        result: Result<Vec<DirectoryEntry>>,
    ) -> Result<bool> {
        // What: Arc::ptr_eq compares allocation identity, unlike equality of the contained path bytes.
        // Why: Reissued reads and tokens from another tree cannot overwrite the current request's snapshot.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const current = pending.get(request.path);
        // if (current?.identity !== request.identity) return false;
        // ```
        let current = self.pending.get(request.path()).is_some_and(|pending| {
            return Arc::ptr_eq(&pending.path, &request.path);
        });
        if !current {
            // Log even discarded errors while keeping stale diagnostics out of the visible UI.
            if let Err(error) = result {
                tracing::debug!(path = %request.path().display(), %error, "discarded stale directory read failure");
            } else {
                tracing::debug!(path = %request.path().display(), "discarded stale directory snapshot");
            }
            // False is an expected stale reply, not an operation failure.
            return Ok(false);
        }
        self.pending.remove(request.path());
        // What: ? propagates the current read/validation failure after releasing its occupied request slot.
        // Why: A fresh retry is possible without discarding the last successful directory snapshot.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // pending.delete(request.path);
        // this.applyListing(request.path, unwrapResult(result));
        // return true;
        // ```
        self.apply_listing(request.path(), result?)?;
        // The validated snapshot was installed exactly once.
        return Ok(true);
    }
}
