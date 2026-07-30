//! Marks sockets from chosen app cgroups so their traffic bypasses the WireGuard tunnel.
//!
//! Attaches a cgroup-BPF program (connect4/6, udp4/6 sendmsg) that sets `SO_MARK`
//! on sockets created beneath each target cgroup. A policy-routing rule
//! (`ip rule add fwmark <mark> table main`) then routes that traffic direct.
//! Each attachment's links are pinned under `/sys/fs/bpf/wg-quicker-exempt/` so
//! they persist after this process exits; removing a pinned link detaches it.
//!
//! Subcommand: `attach <mark> <cgroup-dir>...`

/// Raw `bpf(2)` bindings and the socket-marking program builder.
mod bpf;

/// Standard I/O error type used for syscall and filesystem failures.
use std::io;
/// Raw file descriptor type for open cgroup directories.
use std::os::unix::io::RawFd;
/// Filesystem path handling for cgroup and pin directories.
use std::path::Path;
/// Process exit code returned from `main`.
use std::process::ExitCode;

/// Root of the bpf filesystem where links are pinned.
const BPF_FS: &str = "/sys/fs/bpf";

/// Pin directory for this tool's links.
const PIN_ROOT: &str = "/sys/fs/bpf/wg-quicker-exempt";

/// Opens a cgroup directory read-only for use as a `bpf` attach target.
fn open_cgroup(dir: &Path) -> io::Result<RawFd> {
    let c_path = std::ffi::CString::new(dir.as_os_str().as_encoded_bytes()).map_err(|_| {
        return io::Error::new(io::ErrorKind::InvalidInput, "cgroup path contains NUL");
    })?;
    // SAFETY: open(2) on a NUL-terminated path with O_DIRECTORY|O_RDONLY.
    let fd = unsafe { libc::open(c_path.as_ptr(), libc::O_DIRECTORY | libc::O_RDONLY) };
    if fd < 0 {
        return Err(io::Error::last_os_error());
    }
    return Ok(fd);
}

/// Ensures the bpf filesystem is mounted and the pin directory exists.
fn ensure_pin_root() -> io::Result<()> {
    if !Path::new(BPF_FS).exists() {
        return Err(io::Error::new(
            io::ErrorKind::NotFound,
            format!("bpf filesystem not present at {BPF_FS}"),
        ));
    }
    return std::fs::create_dir_all(PIN_ROOT);
}

/// Derives a filesystem-safe pin subdirectory name from a cgroup path.
fn pin_dir_for(cgroup_dir: &str) -> String {
    let tag = cgroup_dir
        .trim_start_matches('/')
        .replace('/', "__");
    return format!("{PIN_ROOT}/{tag}");
}

/// Attaches the marker to every listed cgroup directory, pinning links.
fn attach_many(mark: u32, dirs: &[String]) -> io::Result<()> {
    ensure_pin_root()?;
    for dir in dirs {
        let path = Path::new(dir);
        let fd = open_cgroup(path)?;
        let pin_dir = pin_dir_for(dir);
        std::fs::create_dir_all(&pin_dir)?;
        let result = bpf::attach_marker(fd, mark, &pin_dir);
        // SAFETY: closing a valid, no-longer-needed cgroup fd.
        unsafe {
            libc::close(fd);
        }
        let pinned = result.map_err(|e| {
            return io::Error::new(e.kind(), format!("attach {dir}: {e}"));
        })?;
        println!("attached mark={mark} to {dir} ({} links pinned)", pinned.len());
    }
    return Ok(());
}

/// Prints usage to stderr.
fn usage() {
    eprintln!("usage: wg-quicker-exempt attach <mark> <cgroup-dir>...");
}

/// Program entry point.
fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let [cmd, mark_s, rest @ ..] = args.as_slice() else {
        usage();
        return ExitCode::from(2);
    };
    let mark: u32 = match mark_s.parse() {
        Ok(m) => m,
        Err(_) => {
            eprintln!("invalid mark: {mark_s}");
            return ExitCode::from(2);
        }
    };
    match cmd.as_str() {
        "attach" => {
            if rest.is_empty() {
                usage();
                return ExitCode::from(2);
            }
            return match attach_many(mark, rest) {
                Ok(()) => ExitCode::SUCCESS,
                Err(e) => {
                    eprintln!("error: {e}");
                    ExitCode::FAILURE
                }
            };
        }
        _ => {
            usage();
            return ExitCode::from(2);
        }
    }
}
