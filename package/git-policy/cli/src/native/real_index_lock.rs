//! What:
//!  The real `index.lock` a landing holds,
//!  created exclusively,
//!  identified by device,
//!  inode and
//!       filesystem,
//!  announced through `index~pid.lock`,
//!  and released only while it is still the file
//!       that was created.
//! Why:
//!  The landing's index install depends on the exact lock file it created;
//!  a replaced lock must
//!      never be deleted,
//!  and a lock this process did not create must never be released
//!      (`src/policy-engine/commit-landing-index-lock.ts`).
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! await using lock = await openRealIndexLock({ realIndexPath, timeoutMs });
//! ```

/// The lock identity record the transaction journal stores.
use super::transaction_journal::LockIdentity;
#[cfg(unix)]
use super::transaction_journal::FileIdentity;
/// The waiting coordination and its failure.
use super::index_writer_coordination::{CoordinationFailure, wait_for_lock};
/// The filesystem identity of the worktree's volume.
#[cfg(unix)]
use super::filesystem_identity::filesystem_identity;
/// Announcing this process through the PID file.
use super::private_storage::write_private_file;
/// `Path` and `PathBuf` are borrowed and owned filesystem paths.
use std::path::{Path, PathBuf};

/// What:
///  A real `index.lock` created by this process.
/// Why:
///   Holding the identity lets the release prove the file is still the one created.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type RealIndexLock = { lockPath: string; identity: LockIdentity; installIndex(source): Promise<void> };
/// ```
#[derive(Debug, Eq, PartialEq)]
pub struct RealIndexLock {
    /// The lock path,
    ///  `<real index>.lock`.
    lock_path: PathBuf,
    /// The PID file path,
    ///  `<real index>~pid.lock`.
    pid_path: PathBuf,
    /// The identity recorded when the lock was created.
    identity: LockIdentity,
}

/// What:
///  The lock path of a real index.
/// Why:
///   Git names the lock beside the index.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// `${realIndexPath}.lock`
/// ```
pub fn real_lock_path(real_index: &Path) -> PathBuf {
    let mut name: std::ffi::OsString = real_index.as_os_str().to_owned();
    name.push(".lock");
    return PathBuf::from(name);
}

/// What:
///  The PID file path of a real index.
/// Why:
///   Git's `core.lockfilePid` file lives beside the lock.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// lockPidPath(realIndexPath) // `${realIndexPath}~pid.lock`
/// ```
pub fn real_pid_path(real_index: &Path) -> PathBuf {
    let mut name: std::ffi::OsString = real_index.as_os_str().to_owned();
    name.push("~pid.lock");
    return PathBuf::from(name);
}

impl RealIndexLock {
    /// What:
    ///  The identity recorded for the lock.
    /// Why:
    ///   The landing journal stores it.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// lock.identity
    /// ```
    pub fn identity(&self) -> &LockIdentity {
        return &self.identity;
    }

    /// What:
    ///  Whether the lock path still names the file this process created.
    /// Why:
    ///   A release or install must not act on a replaced lock.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// await assertLockIdentity({ lockPath, identity });
    /// ```
    pub fn assert_identity(&self) -> Result<(), String> {
        return same_file_identity(self.lock_path.as_path(), &self.identity);
    }

    /// What:
    ///  Release the lock and this process's PID file,
    ///  refusing a lock that was replaced.
    /// Why:
    ///   A replaced lock belongs to another process and stays in place.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// await lock[Symbol.asyncDispose]();
    /// ```
    pub fn release(self) -> Result<(), String> {
        self.assert_identity()?;
        if let Err(error) = std::fs::remove_file(&self.lock_path) {
            return Err(error.to_string());
        }
        return remove_own_pid_file(self.pid_path.as_path());
    }
}

/// What:
///  Whether a path is a regular file with the recorded device and inode,
///  without following links.
/// Why:
///   Following a link would compare another file's identity.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const metadata = await lstat(path, { bigint: true });
/// ```
#[cfg(unix)]
fn same_file_identity(path: &Path, identity: &LockIdentity) -> Result<(), String> {
    use std::os::unix::fs::MetadataExt;
    let metadata: std::fs::Metadata = match std::fs::symlink_metadata(path) {
        Ok(found) => found,
        Err(error) => return Err(error.to_string()),
    };
    if !metadata.is_file()
        || metadata.dev().to_string() != identity.file.device
        || metadata.ino().to_string() != identity.file.inode
    {
        return Err(format!("the index lock identity changed: {}", path.display()));
    }
    return Ok(());
}

/// What:
///  On platforms without an inode,
///  the identity cannot be checked,
///  so the lock is never trusted.
/// Why:
///   The incumbent refuses a landing without a filesystem identity too.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// throw new TypeError('filesystem identity unavailable');
/// ```
#[cfg(not(unix))]
fn same_file_identity(path: &Path, _identity: &LockIdentity) -> Result<(), String> {
    return Err(format!("the index lock identity cannot be checked here: {}", path.display()));
}

/// What:
///  Create the lock file exclusively with private permissions.
/// Why:
///   `O_EXCL` is the mutual exclusion;
///  an existing file means another owner holds the lock.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// open(lockPath, O_CREAT | O_EXCL | O_RDWR, 0o600);
/// ```
#[cfg(unix)]
fn create_exclusive(path: &Path) -> Result<bool, String> {
    use std::os::unix::fs::OpenOptionsExt;
    let mut options: std::fs::OpenOptions = std::fs::OpenOptions::new();
    options.write(true).create_new(true).mode(0o600);
    match options.open(path) {
        Ok(_) => return Ok(true),
        Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => return Ok(false),
        Err(error) => return Err(error.to_string()),
    }
}

/// What:
///  Create the lock file exclusively,
///  on platforms without Unix modes.
/// Why:
///   Private permissions are not applied there;
///  the identity check still refuses the lock.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// open(lockPath, O_CREAT | O_EXCL | O_RDWR);
/// ```
#[cfg(not(unix))]
fn create_exclusive(path: &Path) -> Result<bool, String> {
    let mut options: std::fs::OpenOptions = std::fs::OpenOptions::new();
    options.write(true).create_new(true);
    match options.open(path) {
        Ok(_) => return Ok(true),
        Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => return Ok(false),
        Err(error) => return Err(error.to_string()),
    }
}

/// What:
///  The identity of a freshly created lock file.
/// Why:
///   The journal records it;
///  a platform without device and inode numbers records nothing.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// { file: { device: String(stat.dev), inode: String(stat.ino) }, fsId: await resolveFsId(dirname(path)) };
/// ```
#[cfg(unix)]
fn created_identity(lock_path: &Path, real_index: &Path) -> Result<LockIdentity, String> {
    use std::os::unix::fs::MetadataExt;
    let metadata: std::fs::Metadata = match std::fs::symlink_metadata(lock_path) {
        Ok(found) => found,
        Err(error) => return Err(error.to_string()),
    };
    let directory: &Path = real_index.parent().unwrap_or(Path::new("."));
    let fs_id: String = match filesystem_identity(directory) {
        Some(found) => found,
        None => return Err(String::from("the filesystem identity of the worktree is unavailable")),
    };
    return Ok(LockIdentity {
        file: FileIdentity {
            device: metadata.dev().to_string(),
            inode: metadata.ino().to_string(),
        },
        fs_id,
    });
}

/// What:
///  On platforms without device and inode numbers,
///  no identity is recorded and the landing stops.
/// Why:
///   The Windows volume serial is not exposed by the standard library,
///  as the design notes say.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// throw new TypeError('filesystem identity unavailable');
/// ```
#[cfg(not(unix))]
fn created_identity(lock_path: &Path, _real_index: &Path) -> Result<LockIdentity, String> {
    return Err(format!("the index lock identity cannot be recorded here: {}", lock_path.display()));
}

/// What:
///  Remove the PID file when it still names this process.
/// Why:
///   Another process may have announced itself meanwhile.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// if ((await readFile(pidPath, 'utf8')) === `pid ${process.pid}\n`) await rm(pidPath);
/// ```
fn remove_own_pid_file(pid_path: &Path) -> Result<(), String> {
    let own: String = format!("pid {}\n", std::process::id());
    match std::fs::read_to_string(pid_path) {
        Ok(text) => {
            if text == own && let Err(error) = std::fs::remove_file(pid_path) {
                return Err(error.to_string());
            }
            return Ok(());
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(error.to_string()),
    }
}

/// What:
///  Take the real index lock,
///  waiting for a foreign holder under the classification rules,
///  then
///       record its identity and announce this process through the PID file.
/// Why:
///   `openLockWaiting` plus the identity and PID steps of the landing.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const handle = await openLockWaiting({ realIndexPath, timeoutMs });
/// ```
pub fn acquire_real_index_lock(
    real_index: &Path,
    timeout_ms: u64,
    consequence: &str,
) -> Result<RealIndexLock, CoordinationFailure> {
    let lock_path: PathBuf = real_lock_path(real_index);
    loop {
        match create_exclusive(lock_path.as_path()) {
            Ok(true) => break,
            Ok(false) => wait_for_lock(real_index, timeout_ms, consequence)?,
            Err(reason) => return Err(CoordinationFailure::Stop(reason)),
        }
    }
    let identity: LockIdentity = match created_identity(lock_path.as_path(), real_index) {
        Ok(found) => found,
        Err(reason) => {
            let _ = std::fs::remove_file(lock_path.as_path());
            return Err(CoordinationFailure::Stop(reason));
        }
    };
    let pid_path: PathBuf = real_pid_path(real_index);
    if let Err(error) = write_private_file(pid_path.as_path(), format!("pid {}\n", std::process::id()).as_bytes()) {
        let _ = std::fs::remove_file(lock_path.as_path());
        return Err(CoordinationFailure::Stop(error.to_string()));
    }
    return Ok(RealIndexLock {
        lock_path,
        pid_path,
        identity,
    });
}

/// Real-lock controls stay out of the release executable.
#[cfg(test)]
#[path = "real_index_lock_tests.rs"]
mod tests;
