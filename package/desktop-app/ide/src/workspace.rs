//! Read-only project boundary and lazy directory snapshots; no mutation operations are exposed.

/// Paths retain native filenames rather than round-tripping lossy UI strings.
use std::{ffi::OsString, fs, path::{Path, PathBuf}};
/// Every failure identifies the operation and affected input.
use anyhow::{bail, Context, Result};

/// One filesystem entry in the same enumeration order used by editord.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DirectoryEntry {
    /// Native filename retained separately from its UI representation.
    pub name: OsString,
    /// Absolute path formed from the contained directory and native entry name.
    pub path: PathBuf,
    /// Dirent directory status, without recursively following symbolic links.
    pub is_directory: bool,
}

/// One canonical project root bounds tree and project-search navigation.
#[derive(Clone, Debug)]
pub struct Workspace {
    /// Canonical root prevents sibling-prefix and symbolic-link escapes.
    root: PathBuf,
}

/// Resolve and read snapshots without adding a writable filesystem interface.
impl Workspace {
    /// Open an existing local directory as the sole project root.
    pub fn new(path: &Path) -> Result<Self> {
        let root = path.canonicalize()
            .with_context(|| return format!("Cannot open project directory {}", path.display()))?;
        if !root.is_dir() {
            bail!("Cannot use {} as the project root: it is not a directory", root.display());
        }
        tracing::info!(root = %root.display(), "opened read-only project boundary");
        return Ok(Self { root });
    }

    /// Borrow the canonical root for read-only subprocess working directories.
    pub fn root(&self) -> &Path {
        return &self.root;
    }

    /// Resolve relative names from the explicit project root, never ambient process cwd.
    /// Symlinks resolving outside the root are rejected for tree/project-search operations.
    pub fn resolve(&self, path: &Path) -> Result<PathBuf> {
        let candidate = self.root.join(path);
        let resolved = candidate.canonicalize()
            .with_context(|| return format!("Cannot resolve project path {}", candidate.display()))?;
        if !resolved.starts_with(&self.root) {
            bail!("Project path {} resolves outside {}", path.display(), self.root.display());
        }
        return Ok(resolved);
    }

    /// Read only the requested directory; hidden entries remain visible as in editord.
    pub fn list(&self, path: &Path) -> Result<Vec<DirectoryEntry>> {
        let directory = self.resolve(path)?;
        let entries = fs::read_dir(&directory)
            .with_context(|| return format!("Cannot list project directory {}", directory.display()))?;
        let mut snapshot = Vec::new();
        for result in entries {
            let entry = result.with_context(|| return format!("Cannot read an entry in {}", directory.display()))?;
            let kind = entry.file_type().with_context(|| return format!("Cannot inspect {}", entry.path().display()))?;
            snapshot.push(DirectoryEntry {
                name: entry.file_name(), path: entry.path(), is_directory: kind.is_dir(),
            });
        }
        tracing::debug!(path = %directory.display(), entries = snapshot.len(), "read directory snapshot");
        return Ok(snapshot);
    }
}
