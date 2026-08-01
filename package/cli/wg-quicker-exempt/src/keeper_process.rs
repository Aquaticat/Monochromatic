//! Validates descriptor-keeper process identity before lifecycle signals.

/// Persisted process identity and socket mark.
use crate::keeper_state::KeeperProcess;
/// Standard process-file and syscall failures.
use std::io;
/// Unix path bytes for exact `/proc` command-line comparison.
use std::os::unix::ffi::OsStrExt;
/// Cgroup identity passed to holder child.
use std::path::Path;
/// Bounded shutdown polling interval.
use std::time::{Duration, Instant};

/// Maximum time allowed for a validated holder to disappear.
const STOP_WAIT: Duration = Duration::from_secs(5);
/// Poll cadence balances quick teardown with bounded procfs reads.
const STOP_POLL: Duration = Duration::from_millis(20);
/// Additional confirmation window after forced termination.
const KILL_WAIT: Duration = Duration::from_secs(5);

/// Reads Linux process start-time field after safely skipping parenthesized command name.
pub fn process_start_time(pid: i32) -> io::Result<u64> {
    let text = std::fs::read_to_string(format!("/proc/{pid}/stat"))?;
    let command_end = text.rfind(')').ok_or_else(|| {
        return io::Error::new(io::ErrorKind::InvalidData, "process stat lacks command terminator");
    })?;
    let tail = text.get(command_end + 1..).ok_or_else(|| {
        return io::Error::new(io::ErrorKind::InvalidData, "process stat tail is absent");
    })?;
    let fields: Vec<&str> = tail.split_whitespace().collect();
    let start_time = fields.get(19).ok_or_else(|| {
        return io::Error::new(io::ErrorKind::InvalidData, "process stat lacks start time");
    })?;
    return start_time.parse().map_err(io::Error::other);
}

/// Builds exact NUL-separated argument vector expected for one holder.
fn expected_command(
    process: KeeperProcess,
    cgroup_dir: &Path,
) -> io::Result<Vec<Vec<u8>>> {
    let executable = std::env::current_exe()?;
    let cgroup = cgroup_dir.as_os_str().as_bytes().to_vec();
    return Ok(vec![
        executable.as_os_str().as_bytes().to_vec(),
        b"__hold".to_vec(),
        process.mark.to_string().into_bytes(),
        cgroup,
    ]);
}

/// Reads command-line arguments without interpreting path bytes as text.
fn process_command(pid: i32) -> io::Result<Vec<Vec<u8>>> {
    let bytes = std::fs::read(format!("/proc/{pid}/cmdline"))?;
    let mut arguments: Vec<Vec<u8>> = bytes
        .split(|byte| return *byte == 0)
        .map(<[u8]>::to_vec)
        .collect();
    if arguments.last().is_some_and(Vec::is_empty) {
        arguments.pop();
    }
    return Ok(arguments);
}

/// Confirms PID, start time, executable argument, command, mark, and cgroup.
pub fn validate_process(process: KeeperProcess, cgroup_dir: &Path) -> io::Result<()> {
    let observed_start = process_start_time(process.pid)?;
    if observed_start != process.start_time {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            format!(
                "keeper PID {} start time changed: expected {}, observed {}",
                process.pid, process.start_time, observed_start
            ),
        ));
    }
    let observed_command = process_command(process.pid)?;
    let expected = expected_command(process, cgroup_dir)?;
    if observed_command != expected {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            format!("keeper PID {} command does not match owned holder", process.pid),
        ));
    }
    return Ok(());
}

/// Reports whether exact holder remains live and rejects PID reuse or command mismatch.
pub fn keeper_is_live(process: KeeperProcess, cgroup_dir: &Path) -> io::Result<bool> {
    match validate_process(process, cgroup_dir) {
        Ok(()) => return Ok(true),
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(false),
        Err(error) => return Err(error),
    }
}

/// Reaps holder when current process happens to be its parent.
fn reap_if_child(pid: i32) -> io::Result<bool> {
    let mut status: libc::c_int = 0;
    // SAFETY: status points to writable integer and WNOHANG never blocks.
    let result = unsafe { libc::waitpid(pid, &mut status, libc::WNOHANG) };
    if result == pid {
        return Ok(true);
    }
    if result == 0 {
        return Ok(false);
    }
    let error = io::Error::last_os_error();
    if error.raw_os_error() == Some(libc::ECHILD) {
        return Ok(false);
    }
    return Err(error);
}

/// Waits bounded interval for exact process to disappear or change identity.
fn wait_for_disappearance(
    process: KeeperProcess,
    duration: Duration,
) -> io::Result<bool> {
    let deadline = Instant::now() + duration;
    while Instant::now() < deadline {
        if reap_if_child(process.pid)? {
            return Ok(true);
        }
        match process_start_time(process.pid) {
            Ok(start_time) if start_time == process.start_time => {
                std::thread::sleep(STOP_POLL);
            }
            Ok(_) => return Ok(true),
            Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(true),
            Err(error) => return Err(error),
        }
    }
    return Ok(false);
}

/// Sends SIGTERM, escalates exact surviving holder to SIGKILL, and confirms disappearance.
pub fn stop_process(process: KeeperProcess, cgroup_dir: &Path) -> io::Result<()> {
    validate_process(process, cgroup_dir)?;
    // SAFETY: validated positive PID names exact holder process.
    let terminate_result = unsafe { libc::kill(process.pid, libc::SIGTERM) };
    if terminate_result < 0 {
        return Err(io::Error::last_os_error());
    }
    if wait_for_disappearance(process, STOP_WAIT)? {
        return Ok(());
    }
    validate_process(process, cgroup_dir)?;
    // SAFETY: identity was revalidated immediately before forced termination.
    let kill_result = unsafe { libc::kill(process.pid, libc::SIGKILL) };
    if kill_result < 0 {
        return Err(io::Error::last_os_error());
    }
    if wait_for_disappearance(process, KILL_WAIT)? {
        return Ok(());
    }
    return Err(io::Error::new(
        io::ErrorKind::TimedOut,
        format!("keeper PID {} survived SIGTERM and SIGKILL", process.pid),
    ));
}
