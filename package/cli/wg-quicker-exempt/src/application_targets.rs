//! Discovers Ghostty cgroups by systemd names and Helium cgroups by executable ownership.

/// Filesystem and process-race failures.
use std::io;
/// Target and fixture roots.
use std::path::{Path, PathBuf};

/// Ghostty main user service prefix.
const GHOSTTY_SERVICE_PREFIX: &str = "app-com.mitchellh.ghostty@";
/// Ghostty terminal surface scope prefix.
const GHOSTTY_SURFACE_PREFIX: &str = "app-ghostty-surface-transient-";
/// Helium desktop integration service prefix observed from its Chrome application ID.
const HELIUM_SERVICE_PREFIX: &str =
    "app-chrome\\x2dcadlkienfkclaiaibeoongdcgmdikeeg\\x2dDefault@";

/// Roots make process and cgroup discovery testable without real host state.
pub struct ScanRoots<'a> {
    /// User's systemd `app.slice` directory.
    pub app_slice: &'a Path,
    /// Procfs root containing numeric process directories.
    pub proc_root: &'a Path,
    /// Cgroup v2 mount root joined with unified paths.
    pub cgroup_root: &'a Path,
}

/// Reports Ghostty service or surface cgroup name.
pub fn is_ghostty_cgroup_name(name: &str) -> bool {
    return (name.starts_with(GHOSTTY_SERVICE_PREFIX) && name.ends_with(".service"))
        || (name.starts_with(GHOSTTY_SURFACE_PREFIX) && name.ends_with(".scope"));
}

/// Reports Helium desktop-integration service name before executable scan catches children.
pub fn is_helium_service_name(name: &str) -> bool {
    return name.starts_with(HELIUM_SERVICE_PREFIX) && name.ends_with(".service");
}

/// Reports numeric procfs directory name without regular expression parsing.
fn is_process_id(name: &str) -> bool {
    return !name.is_empty() && name.bytes().all(|byte| return byte.is_ascii_digit());
}

/// Reports executable filename owned by Helium or its crash handler.
fn is_helium_executable(path: &Path) -> bool {
    let Some(name) = path.file_name() else {
        return false;
    };
    return name.to_string_lossy().to_ascii_lowercase().starts_with("helium");
}

/// Extracts unified cgroup path from one procfs cgroup file.
fn unified_cgroup_path(text: &str) -> Option<&str> {
    for line in text.lines() {
        if let Some(path) = line.strip_prefix("0::") {
            return Some(path);
        }
    }
    return None;
}

/// Adds path once while preserving simple linear collection semantics.
fn push_unique(paths: &mut Vec<PathBuf>, path: PathBuf) {
    if !paths.contains(&path) {
        paths.push(path);
    }
}

/// Scans direct app slice entries whose names identify Ghostty or Helium service.
fn scan_named_cgroups(roots: &ScanRoots<'_>, targets: &mut Vec<PathBuf>) -> io::Result<()> {
    for entry_result in std::fs::read_dir(roots.app_slice)? {
        let entry = entry_result?;
        if !entry.file_type()?.is_dir() {
            continue;
        }
        let name = entry.file_name();
        let Some(name_text) = name.to_str() else {
            continue;
        };
        if is_ghostty_cgroup_name(name_text) || is_helium_service_name(name_text) {
            push_unique(targets, entry.path());
        }
    }
    return Ok(());
}

/// Reads process file while treating process disappearance as ordinary scan race.
fn read_process_file(path: &Path) -> io::Result<Option<String>> {
    match std::fs::read_to_string(path) {
        Ok(text) => return Ok(Some(text)),
        Err(error)
            if error.kind() == io::ErrorKind::NotFound
                || error.kind() == io::ErrorKind::PermissionDenied =>
        {
            return Ok(None);
        }
        Err(error) => return Err(error),
    }
}

/// Reads process executable while treating process disappearance as ordinary scan race.
fn read_process_executable(path: &Path) -> io::Result<Option<PathBuf>> {
    match std::fs::read_link(path) {
        Ok(executable) => return Ok(Some(executable)),
        Err(error)
            if error.kind() == io::ErrorKind::NotFound
                || error.kind() == io::ErrorKind::PermissionDenied =>
        {
            return Ok(None);
        }
        Err(error) => return Err(error),
    }
}

/// Scans Helium processes and maps each into user app-slice cgroup.
fn scan_helium_processes(
    roots: &ScanRoots<'_>,
    targets: &mut Vec<PathBuf>,
) -> io::Result<()> {
    for entry_result in std::fs::read_dir(roots.proc_root)? {
        let entry = entry_result?;
        let name = entry.file_name();
        let Some(name_text) = name.to_str() else {
            continue;
        };
        if !is_process_id(name_text) {
            continue;
        }
        let process = entry.path();
        let Some(executable) = read_process_executable(&process.join("exe"))? else {
            continue;
        };
        if !is_helium_executable(&executable) {
            continue;
        }
        let Some(cgroup_text) = read_process_file(&process.join("cgroup"))? else {
            continue;
        };
        let Some(relative) = unified_cgroup_path(&cgroup_text) else {
            continue;
        };
        let target = roots.cgroup_root.join(relative.trim_start_matches('/'));
        if target.starts_with(roots.app_slice) && target.is_dir() {
            push_unique(targets, target);
        }
    }
    return Ok(());
}

/// Returns deduplicated sorted cgroups requiring socket exemption.
pub fn scan_application_targets(roots: &ScanRoots<'_>) -> io::Result<Vec<PathBuf>> {
    let mut targets = Vec::new();
    scan_named_cgroups(roots, &mut targets)?;
    scan_helium_processes(roots, &mut targets)?;
    targets.sort();
    targets.dedup();
    return Ok(targets);
}

/// Builds production user `app.slice` path from numeric UID.
pub fn user_app_slice(uid: u32) -> PathBuf {
    return Path::new("/sys/fs/cgroup/user.slice")
        .join(format!("user-{uid}.slice"))
        .join(format!("user@{uid}.service"))
        .join("app.slice");
}

/// Scans production procfs and cgroup mount for one desktop user.
pub fn scan_user_application_targets(uid: u32) -> io::Result<Vec<PathBuf>> {
    let app_slice = user_app_slice(uid);
    return scan_application_targets(&ScanRoots {
        app_slice: &app_slice,
        proc_root: Path::new("/proc"),
        cgroup_root: Path::new("/sys/fs/cgroup"),
    });
}
