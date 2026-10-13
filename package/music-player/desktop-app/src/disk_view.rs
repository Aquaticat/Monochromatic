//! The questions the refresh planner asks the disk, behind a trait so a test can answer them without a real library.
//!
//! What: `Disk` answers what one path is, what a folder holds directly, and which tracks a whole subtree holds in
//! queue order; `RealDisk` answers from the file system with the same rules as the folder walk.
//! Why: the planner must be tested with a million tracks, and a million files on disk are too slow to create in the
//! normal suite; the trait lets the large test answer from memory while the small tests use real files.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! interface Disk { kind(path: string): EntryKind; entries(folder: string): [string, EntryKind][]; walk(folder: string): string[]; }
//! ```

use std::path::{Path, PathBuf};

use crate::playback::is_audio_file;

/// What:
///      `pub(crate) enum EntryKind { Missing, Folder, Track, Other }`.
///  What a path is on disk, as far as the queue cares.
/// Why:
///       The queue lists audio files; a folder leads to more of them, and anything else (a missing path, a text file, a
///  sidecar) is not listed.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum EntryKind {
    /// Nothing is there.
    Missing,
    /// A folder.
    Folder,
    /// An audio file the queue lists.
    Track,
    /// Something the queue does not list.
    Other,
}

/// What:
///      `pub(crate) trait Disk { kind, entries, walk }`.
///  The three questions of the planner.
/// Why:
///       See the module description.
pub(crate) trait Disk {
    /// What a path is right now.
    fn kind(&self, path: &Path) -> EntryKind;
    /// The folders and tracks directly in a folder; other entries are left out.
    fn entries(&self, folder: &Path) -> Vec<(PathBuf, EntryKind)>;
    /// Every track under a folder, in queue order.
    fn walk(&self, folder: &Path) -> Vec<PathBuf>;
}

/// What:
///      `pub(crate) struct RealDisk;`.
///  The file system.
/// Why:
///       The running player asks the real disk, with the folder walk's own rules.
pub(crate) struct RealDisk;

/// What:
///      `fn kind_of(path: &Path, file_type: std::fs::FileType) -> EntryKind`.
///  Classifies one entry by its type, the way the folder walk does.
/// Why:
///       A folder entry says whether it is a folder; a symlink needs one more look to see whether it leads to a file, and a
///  symlink to a folder is not followed, so the planner and the walk list the same tracks.
fn kind_of(path: &Path, file_type: std::fs::FileType) -> EntryKind {
    if file_type.is_dir() {
        return EntryKind::Folder;
    }
    if is_audio_file(path) && (file_type.is_file() || (file_type.is_symlink() && path.is_file())) {
        return EntryKind::Track;
    }
    return EntryKind::Other;
}

/// The real answers.
impl Disk for RealDisk {
    /// What:
    ///      `fn kind(&self, path: &Path) -> EntryKind`.
    ///  One `lstat` of the path.
    /// Why:
    ///       A missing path is a removal; a path that exists is looked at by its type.
    fn kind(&self, path: &Path) -> EntryKind {
        return match std::fs::symlink_metadata(path) {
            Ok(metadata) => kind_of(path, metadata.file_type()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => EntryKind::Missing,
            Err(error) => {
                tracing::warn!(path = %path.display(), error = %error, "cannot look at a changed path; treated as missing");
                EntryKind::Missing
            }
        };
    }

    /// What:
    ///      `fn entries(&self, folder: &Path) -> Vec<(PathBuf, EntryKind)>`.
    ///  One read of the folder.
    /// Why:
    ///       A folder event is answered by the folder's own entries, not by a walk of what is below.
    fn entries(&self, folder: &Path) -> Vec<(PathBuf, EntryKind)> {
        let listing = match std::fs::read_dir(folder) {
            Ok(listing) => listing,
            Err(error) => {
                tracing::warn!(dir = %folder.display(), error = %error, "cannot read a changed folder");
                return Vec::new();
            }
        };
        return listing
            .flatten()
            .filter_map(|entry| {
                let file_type = entry.file_type().ok()?;
                let path: PathBuf = entry.path();
                let kind: EntryKind = kind_of(&path, file_type);
                return (kind != EntryKind::Other).then_some((path, kind));
            })
            .collect();
    }

    /// What:
    ///      `fn walk(&self, folder: &Path) -> Vec<PathBuf>`.
    ///  The folder walk of one subtree.
    /// Why:
    ///       A new or recreated folder has no queue entries to compare with, so everything in it is read once.
    fn walk(&self, folder: &Path) -> Vec<PathBuf> {
        return crate::scan_stream::scan_streaming(folder, usize::MAX, &mut |_batch| {});
    }
}
