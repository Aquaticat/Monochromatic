//! What: Processes holding a lock file open, found by device and inode: `/proc/<pid>/fd` on
//!       Linux, `lsof` on macOS, the Restart Manager on Windows.
//! Why: An open descriptor proves a live owner. Matching by device and inode, never by path text,
//!      means bind mounts and renamed paths cannot fake or hide a holder. Processes the scan
//!      cannot read are partial evidence (`src/index-lock/index-lock-holders-linux.ts`,
//!      `-darwin.ts`, `-win32.ts`).
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! const evidence = await scanPlatformHolders({ lockPath, lock });
//! ```

/// `Path`/`PathBuf` are borrowed/owned filesystem paths.
use std::path::{Path, PathBuf};

/// The incumbent's Restart Manager script, byte for byte.
pub const RESTART_MANAGER_SCRIPT: &str = include_str!("index_lock_restart_manager.ps1");

/// Partial-evidence note every unprivileged macOS scan carries.
pub const SILENT_DENIAL_NOTE: &str = "lsof omits other users' processes on macOS without reporting it";

/// What: One process holding the lock open.
/// Why:  `LockHolderProcess`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type LockHolderProcess = { pid: number; command?: string };
/// ```
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Holder {
    /// Holder process ID.
    pub pid: i64,
    /// Holder command name when readable.
    pub command: Option<String>,
}

/// What: The scan mechanism, its holders, and what it could not see.
/// Why:  `LockHolderEvidence`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type LockHolderEvidence = { method: 'proc-fd' | 'lsof' | 'restart-manager' | 'unsupported'; holders; partial };
/// ```
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct HolderEvidence {
    /// Scan mechanism name.
    pub method: &'static str,
    /// Processes holding the lock open.
    pub holders: Vec<Holder>,
    /// Reasons the scan could not see everything.
    pub partial: Vec<String>,
}

/// What: Whether a directory name is a decimal PID.
/// Why:  `/proc` also holds `self`, `sys` and others.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// name.length > 0 && isAsciiDigits(name)
/// ```
fn is_pid_name(name: &str) -> bool {
    return !name.is_empty() && name.bytes().all(is_digit);
}

/// What: Whether a byte is an ASCII digit.
/// Why:  A named predicate keeps the scans free of closures.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// (byte: number) => byte >= 0x30 && byte <= 0x39
/// ```
fn is_digit(byte: u8) -> bool {
    return byte.is_ascii_digit();
}

/// What: Whether an error means the process exited during the scan.
/// Why:  `ENOENT` and `ESRCH` are expected races, never partial evidence.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// ['ENOENT', 'ESRCH'].includes(error.code)
/// ```
fn exited(error: &std::io::Error) -> bool {
    if error.kind() == std::io::ErrorKind::NotFound {
        return true;
    }
    #[cfg(unix)]
    {
        return error.raw_os_error() == Some(libc::ESRCH);
    }
    #[cfg(not(unix))]
    {
        return false;
    }
}

/// What: The device and inode a path names after following links, as numbers.
/// Why:  A descriptor link resolves to the open file itself.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const { dev, ino } = await stat(path, { bigint: true });
/// ```
#[cfg(unix)]
fn followed_identity(path: &Path) -> std::io::Result<(u64, u64)> {
    use std::os::unix::fs::MetadataExt;
    let metadata: std::fs::Metadata = std::fs::metadata(path)?;
    return Ok((metadata.dev(), metadata.ino()));
}

/// What: Whether one process holds the file open, and why its descriptors were unreadable.
/// Why:  `scanProcess`: the first unreadable descriptor's reason is kept.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function scanProcess({ procRoot, pid, device, inode }): Promise<{ holds: boolean; partial?: string }>;
/// ```
#[cfg(unix)]
fn scan_process(proc_root: &Path, pid: &str, device: u64, inode: u64) -> (bool, Option<String>) {
    let fd_directory: PathBuf = proc_root.join(pid).join("fd");
    let listing: std::fs::ReadDir = match std::fs::read_dir(&fd_directory) {
        Ok(found) => found,
        Err(error) if exited(&error) => return (false, None),
        Err(error) => return (false, Some(format!("PID {pid}: {error}"))),
    };
    let mut holds: bool = false;
    let mut partial: Option<String> = None;
    for item in listing {
        let Ok(entry) = item else {
            continue;
        };
        match followed_identity(entry.path().as_path()) {
            Ok((found_device, found_inode)) => {
                if found_device == device && found_inode == inode {
                    holds = true;
                }
            }
            Err(error) if exited(&error) => {}
            Err(error) => {
                if partial.is_none() {
                    partial = Some(format!(
                        "PID {pid} fd {}: {error}",
                        entry.file_name().to_string_lossy()
                    ));
                }
            }
        }
    }
    return (holds, partial);
}

/// What: Every process other than this one holding a file open, by device and inode, through a
///       proc root.
/// Why:  `scanProcFdHolders`; processes are scanned one after another (the incumbent runs 16 at
///       once; the result is the same set).
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function scanProcFdHolders({ device, inode, procRoot, selfPid }): Promise<LockHolderEvidence>;
/// ```
#[cfg(unix)]
pub fn scan_proc_fd_holders(proc_root: &Path, device: u64, inode: u64, self_pid: u32) -> HolderEvidence {
    let mut evidence: HolderEvidence = HolderEvidence {
        method: "proc-fd",
        holders: Vec::new(),
        partial: Vec::new(),
    };
    let listing: std::fs::ReadDir = match std::fs::read_dir(proc_root) {
        Ok(found) => found,
        Err(error) => {
            evidence.partial.push(format!("{}: {error}", proc_root.display()));
            return evidence;
        }
    };
    let own: String = self_pid.to_string();
    let mut pids: Vec<String> = Vec::new();
    for item in listing.flatten() {
        let name: String = item.file_name().to_string_lossy().into_owned();
        if is_pid_name(name.as_str()) && name != own {
            pids.push(name);
        }
    }
    for pid in &pids {
        let (holds, partial) = scan_process(proc_root, pid.as_str(), device, inode);
        if holds && let Ok(number) = pid.parse::<i64>() {
            let command: Option<String> = std::fs::read_to_string(proc_root.join(pid).join("comm"))
                .ok()
                .map(trimmed);
            evidence.holders.push(Holder { pid: number, command });
        }
        if let Some(reason) = partial {
            evidence.partial.push(reason);
        }
    }
    super::diagnostic_log::debug(
        "scanProcFdHolders",
        format!(
            "scanned {} processes: {} holders, {} unreadable",
            pids.len(),
            evidence.holders.len(),
            evidence.partial.len()
        )
        .as_str(),
    );
    return evidence;
}

/// What: Text without surrounding whitespace.
/// Why:  A named function keeps `map` free of closures.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// (text: string) => text.trim()
/// ```
fn trimmed(text: String) -> String {
    return String::from(super::js_text::trim_javascript(text.as_str()));
}

/// What: One `lsof -F pcDi` process record: its PID, command and the device and inode of every
///       listed file (each field present when parsable).
/// Why:  `LsofProcess`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type LsofProcess = { pid: number; command?: string; files: { device?: bigint; inode?: bigint }[] };
/// ```
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LsofProcess {
    /// Process ID as `Number` reads it; `None` when it is not a number.
    pub pid: Option<i64>,
    /// Command name.
    pub command: Option<String>,
    /// Device and inode of each listed file.
    pub files: Vec<(Option<u128>, Option<u128>)>,
}

/// What: An `lsof` number as `BigInt` reads it: decimal, or `0x`, `0o` or `0b` prefixed.
/// Why:  Device numbers come `0x`-prefixed, inodes decimal.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// BigInt(text)
/// ```
pub fn parse_lsof_number(text: &str) -> Option<u128> {
    let trimmed: &str = super::js_text::trim_javascript(text);
    if trimmed.is_empty() {
        return Some(0);
    }
    let (digits, radix) = match trimmed.get(..2) {
        Some("0x" | "0X") => (&trimmed[2..], 16),
        Some("0o" | "0O") => (&trimmed[2..], 8),
        Some("0b" | "0B") => (&trimmed[2..], 2),
        _ => (trimmed, 10),
    };
    if digits.is_empty() || digits.starts_with(['+', '-']) {
        return None;
    }
    return u128::from_str_radix(digits, radix).ok();
}

/// What: The first field with this identifier among lines, parsed as a number.
/// Why:  `numberField`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// numberField({ lines, identifier })
/// ```
fn number_field(lines: &[&str], identifier: char) -> Option<u128> {
    for line in lines {
        if let Some(rest) = line.strip_prefix(identifier) {
            return parse_lsof_number(rest);
        }
    }
    return None;
}

/// What: Lines grouped under each line starting with `identifier`; earlier lines are dropped.
/// Why:  `groupsStartingAt`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// groupsStartingAt({ lines, identifier })
/// ```
fn groups<'a>(lines: &[&'a str], identifier: char) -> Vec<Vec<&'a str>> {
    let mut grouped: Vec<Vec<&'a str>> = Vec::new();
    for line in lines {
        if line.starts_with(identifier) {
            grouped.push(vec![*line]);
        } else if let Some(last) = grouped.last_mut() {
            last.push(*line);
        }
    }
    return grouped;
}

/// What: Parse `lsof -F pcDi` output into process records.
/// Why:  `parseLsofFields`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// parseLsofFields('p42\ncgit\nf3\nD0x1000011\ni77\n')
/// ```
pub fn parse_lsof_fields(output: &str) -> Vec<LsofProcess> {
    let lines: Vec<&str> = output.split('\n').collect();
    let mut processes: Vec<LsofProcess> = Vec::new();
    for group in groups(lines.as_slice(), 'p') {
        let mut command: Option<String> = None;
        for line in &group {
            if let Some(rest) = line.strip_prefix('c') {
                command = Some(String::from(rest));
                break;
            }
        }
        let mut files: Vec<(Option<u128>, Option<u128>)> = Vec::new();
        for file in groups(group.as_slice(), 'f') {
            files.push((number_field(file.as_slice(), 'D'), number_field(file.as_slice(), 'i')));
        }
        processes.push(LsofProcess {
            pid: super::recovery_evidence::decimal_attempt(&group[0][1..]),
            command,
            files,
        });
    }
    return processes;
}

/// What: Processes whose listed file matches the lock's device and inode.
/// Why:  `matchingHolders`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// matchingHolders({ processes, device, inode })
/// ```
pub fn matching_holders(processes: &[LsofProcess], device: u64, inode: u64) -> Vec<Holder> {
    let mut holders: Vec<Holder> = Vec::new();
    for process in processes {
        let Some(pid) = process.pid else {
            continue;
        };
        let wanted: (Option<u128>, Option<u128>) = (Some(u128::from(device)), Some(u128::from(inode)));
        if process.files.contains(&wanted) {
            holders.push(Holder {
                pid,
                command: process.command.clone(),
            });
        }
    }
    return holders;
}

/// What: Parse the Restart Manager script's `<pid>\t<application name>` lines.
/// Why:  `parseRestartManagerOutput`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// parseRestartManagerOutput('4242\tgit.exe\n')
/// ```
pub fn parse_restart_manager_output(output: &str) -> Vec<Holder> {
    let mut holders: Vec<Holder> = Vec::new();
    for raw in output.split('\n') {
        let line: &str = super::js_text::trim_javascript(raw);
        if line.is_empty() {
            continue;
        }
        let (pid_text, command) = match line.split_once('\t') {
            Some((pid, name)) => (pid, name),
            None => (line, ""),
        };
        let Some(pid) = super::recovery_evidence::decimal_attempt(super::js_text::trim_javascript(pid_text)) else {
            continue;
        };
        holders.push(Holder {
            pid,
            command: if command.is_empty() { None } else { Some(String::from(command)) },
        });
    }
    return holders;
}

/// What: Scan for open holders with the host's mechanism.
/// Why:  `scanPlatformHolders`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function scanPlatformHolders({ lockPath, lock }): Promise<LockHolderEvidence>;
/// ```
pub fn scan_platform_holders(lock_path: &Path, device: u64, inode: u64) -> HolderEvidence {
    #[cfg(target_os = "linux")]
    {
        let _ = lock_path;
        return scan_proc_fd_holders(Path::new("/proc"), device, inode, std::process::id());
    }
    #[cfg(target_os = "macos")]
    {
        return scan_lsof_holders(lock_path, device, inode);
    }
    #[cfg(windows)]
    {
        let _ = (device, inode);
        return scan_restart_manager_holders(lock_path);
    }
    #[cfg(not(any(target_os = "linux", target_os = "macos", windows)))]
    {
        let _ = (lock_path, device, inode);
        return HolderEvidence {
            method: "unsupported",
            holders: Vec::new(),
            partial: vec![String::from("no open-holder scan on this platform")],
        };
    }
}

/// What: Holders through `lsof -n -P -w -F pcDi -- <lock>`; exit 1 with output means "no match".
/// Why:  `scanLsofHolders`; an unprivileged scan always notes that macOS hides other users.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function scanLsofHolders({ lockPath, device, inode }): Promise<LockHolderEvidence>;
/// ```
#[cfg(target_os = "macos")]
fn scan_lsof_holders(lock_path: &Path, device: u64, inode: u64) -> HolderEvidence {
    let output: std::io::Result<std::process::Output> = std::process::Command::new("lsof")
        .args(["-n", "-P", "-w", "-F", "pcDi", "--"])
        .arg(lock_path)
        .env("LC_ALL", "C")
        .stdin(std::process::Stdio::null())
        .output();
    let stdout: String = match output {
        Ok(finished) if finished.status.success() || finished.status.code() == Some(1) => {
            String::from_utf8_lossy(finished.stdout.as_slice()).into_owned()
        }
        Ok(finished) => {
            return HolderEvidence {
                method: "lsof",
                holders: Vec::new(),
                partial: vec![format!("lsof failed: exit {:?}", finished.status.code())],
            };
        }
        Err(error) => {
            return HolderEvidence {
                method: "lsof",
                holders: Vec::new(),
                partial: vec![format!("lsof failed: {error}")],
            };
        }
    };
    // SAFETY: `getuid` has no preconditions.
    let root: bool = unsafe { libc::getuid() } == 0;
    return HolderEvidence {
        method: "lsof",
        holders: matching_holders(parse_lsof_fields(stdout.as_str()).as_slice(), device, inode),
        partial: if root { Vec::new() } else { vec![String::from(SILENT_DENIAL_NOTE)] },
    };
}

/// What: Holders through the Restart Manager script, the path passed in `CLI_GIT_RM_TARGET`.
/// Why:  `scanRestartManagerHolders`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function scanRestartManagerHolders(lockPath: string): Promise<LockHolderEvidence>;
/// ```
#[cfg(windows)]
fn scan_restart_manager_holders(lock_path: &Path) -> HolderEvidence {
    let output: std::io::Result<std::process::Output> = std::process::Command::new("powershell.exe")
        .args(["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", RESTART_MANAGER_SCRIPT])
        .env("CLI_GIT_RM_TARGET", lock_path)
        .stdin(std::process::Stdio::null())
        .output();
    match output {
        Ok(finished) if finished.status.success() => {
            return HolderEvidence {
                method: "restart-manager",
                holders: parse_restart_manager_output(String::from_utf8_lossy(finished.stdout.as_slice()).as_ref()),
                partial: Vec::new(),
            };
        }
        Ok(finished) => {
            return HolderEvidence {
                method: "restart-manager",
                holders: Vec::new(),
                partial: vec![format!("Restart Manager query failed: exit {:?}", finished.status.code())],
            };
        }
        Err(error) => {
            return HolderEvidence {
                method: "restart-manager",
                holders: Vec::new(),
                partial: vec![format!("Restart Manager query failed: {error}")],
            };
        }
    }
}

/// Holder-scan controls stay out of the release executable.
#[cfg(test)]
#[path = "index_lock_holders_tests.rs"]
mod tests;
