//! Stderr filtering for noisy Ghostty debug lines.

// What:     `use std::{...};` imports standard-library modules. `File` owns file
//           descriptors, `BufRead` and `Write` move bytes, `c_int` matches C's
//           integer type, and `thread` starts the forwarding worker.
// Why:      The filter redirects process stderr through a pipe and forwards every
//           line except Ghostty's known noisy OSC debug line.
// TS map:   `import { File, pipe, Worker } from "std"`.
use std::{
    ffi::c_int,
    fs::File,
    io::{self, BufRead, BufReader, Write},
    thread,
};

// What:     `use std::os::fd::FromRawFd;` imports Unix file-descriptor ownership
//           conversion. Sibling `AsRawFd` only borrows an fd, while `IntoRawFd`
//           gives one away.
// Why:      After `pipe` and `dup`, Rust needs to own those raw descriptors as files.
// TS map:   No direct equivalent; closest is wrapping a numeric fd in a stream.
#[cfg(unix)]
use std::os::fd::FromRawFd;

// What:     `const STDERR_FILE_DESCRIPTOR: c_int = 2;` names Unix stderr's fd.
//           Sibling fd values are stdin `0` and stdout `1`.
// Why:      `dup2` needs the numeric destination fd for process stderr.
// TS map:   `const STDERR_FILE_DESCRIPTOR = 2`.
#[cfg(unix)]
const STDERR_FILE_DESCRIPTOR: c_int = 2;

// What:     `const SUPPRESSED_GHOSTTY_OSC_LOG: &[u8] = ...` stores bytes, not a
//           `&str`; sibling `&str` would require valid UTF-8 input.
// Why:      Stderr is a byte stream, so filtering should not fail on non-UTF-8 text.
// TS map:   `const SUPPRESSED_GHOSTTY_OSC_LOG = new TextEncoder().encode(...)`.
const SUPPRESSED_GHOSTTY_OSC_LOG: &[u8] = b"unimplemented OSC callback";

// What:     `struct PipeFileDescriptors` names the two numeric ends returned by
//           Unix `pipe`. A tuple sibling would hide which fd is read vs write.
// Why:      Error cleanup must close the correct end at each step.
// TS map:   `type PipeFileDescriptors = { readFd: number; writeFd: number }`.
#[cfg(unix)]
struct PipeFileDescriptors {
    read_fd: c_int,
    write_fd: c_int,
}

// What:     `unsafe extern "C" { ... }` declares C functions supplied by libc.
//           Rust cannot check their memory or fd safety for us.
// Why:      The standard library wraps files but does not expose `pipe` or `dup2`.
// TS map:   No direct equivalent; closest is declaring native bindings.
#[cfg(unix)]
unsafe extern "C" {
    fn pipe(pipe_fds: *mut c_int) -> c_int;
    fn dup(old_fd: c_int) -> c_int;
    fn dup2(old_fd: c_int, new_fd: c_int) -> c_int;
    fn close(fd: c_int) -> c_int;
}

// What:     `pub fn install_ghostty_stderr_filter() -> io::Result<()>` installs the
//           process-wide stderr filter on Unix and no-ops elsewhere.
// Why:      Ghostty writes the noisy debug line directly to stderr before Rust can
//           handle it at the terminal-engine layer.
// TS map:   `function installGhosttyStderrFilter(): void` that throws on OS failure.
#[cfg(unix)]
pub fn install_ghostty_stderr_filter() -> io::Result<()> {
    // What:     `let pipe_fds = create_pipe()?` creates a read end and write end.
    // Why:      Future stderr bytes need somewhere to go before filtering.
    // TS map:   `const pipeFds = createPipe()`.
    let pipe_fds = create_pipe()?;
    // What:     `match duplicate_fd(...)` copies current stderr before replacing it.
    // Why:      The filter thread needs the original destination to forward kept lines.
    // TS map:   `const originalStderrFd = duplicateFd(stderrFd)`.
    let original_stderr_fd = match duplicate_fd(STDERR_FILE_DESCRIPTOR) {
        Ok(fd) => fd,
        Err(error) => {
            close_fd(pipe_fds.read_fd);
            close_fd(pipe_fds.write_fd);
            return Err(error);
        }
    };
    // What:     `if let Err(error) = replace_stderr_with_pipe(...)` tries to make fd 2
    //           point at the pipe write end.
    // Why:      Anything writing to stderr after this goes through the filter worker.
    // TS map:   `try { replaceStderrWithPipe(pipe.writeFd) } catch (error) { ... }`.
    if let Err(error) = replace_stderr_with_pipe(pipe_fds.write_fd) {
        close_fd(pipe_fds.read_fd);
        close_fd(pipe_fds.write_fd);
        close_fd(original_stderr_fd);
        return Err(error);
    }
    // What:     `close_fd(pipe_fds.write_fd)` closes the extra write fd after `dup2`.
    // Why:      fd 2 now owns the write side, so this duplicate would only delay EOF.
    // TS map:   `close(pipe.writeFd)`.
    close_fd(pipe_fds.write_fd);
    // What:     `file_from_fd(...)` turns raw fds into Rust-owned `File` values.
    // Why:      The worker thread can then read and write with safe stream methods.
    // TS map:   `const readerFile = File.fromFd(pipe.readFd)`.
    let reader_file = file_from_fd(pipe_fds.read_fd);
    // What:     `file_from_fd(...)` owns the duplicate of original stderr.
    // Why:      Kept lines bypass fd 2 and avoid feeding back into the filter pipe.
    // TS map:   `const writerFile = File.fromFd(originalStderrFd)`.
    let writer_file = file_from_fd(original_stderr_fd);
    // What:     `thread::spawn(move || ...)` starts a detached worker and moves both
    //           files into it.
    // Why:      Stderr writes must not block the Slint UI thread on filtering work.
    // TS map:   `new Worker(() => forwardFilteredStderr(readerFile, writerFile))`.
    thread::spawn(move || forward_filtered_stderr(reader_file, writer_file));
    // What:     `Ok(())` returns success with no payload.
    // Why:      fd 2 now routes through the filter.
    // TS map:   `return`.
    Ok(())
}

// What:     `pub fn install_ghostty_stderr_filter() -> io::Result<()>` is the
//           non-Unix sibling of the real installer.
// Why:      The terminal package currently targets Linux, but this keeps the crate
//           compiling if Cargo checks it on another platform.
// TS map:   `function installGhosttyStderrFilter(): void {}`.
#[cfg(not(unix))]
pub fn install_ghostty_stderr_filter() -> io::Result<()> {
    // What:     `Ok(())` returns success with no payload.
    // Why:      There is no Unix fd 2 to filter on this platform path.
    // TS map:   `return`.
    Ok(())
}

// What:     `fn create_pipe() -> io::Result<PipeFileDescriptors>` wraps Unix `pipe`.
// Why:      Callers get normal Rust error handling instead of raw `-1` checks.
// TS map:   `function createPipe(): PipeFileDescriptors`.
#[cfg(unix)]
fn create_pipe() -> io::Result<PipeFileDescriptors> {
    // What:     `let mut pipe_fds = [0; 2]` creates two C-int slots for libc to fill.
    // Why:      `pipe` writes the read fd into index 0 and write fd into index 1.
    // TS map:   `const pipeFds = [0, 0]`.
    let mut pipe_fds = [0; 2];
    // What:     `unsafe { pipe(...) }` calls C code with a pointer to the two slots.
    // Why:      Rust has no safe wrapper for creating an anonymous pipe here.
    // TS map:   `const result = native.pipe(pipeFds)`.
    let result = unsafe { pipe(pipe_fds.as_mut_ptr()) };
    // What:     `if result == -1` checks libc's error sentinel.
    // Why:      Failed syscalls report details through `errno`, read by `last_os_error`.
    // TS map:   `if (result === -1) throw lastOsError()`.
    if result == -1 {
        return Err(io::Error::last_os_error());
    }
    // What:     `Ok(PipeFileDescriptors { ... })` wraps both raw fd numbers.
    // Why:      The caller can now close or transfer them by name.
    // TS map:   `return { readFd: pipeFds[0], writeFd: pipeFds[1] }`.
    Ok(PipeFileDescriptors {
        read_fd: pipe_fds[0],
        write_fd: pipe_fds[1],
    })
}

// What:     `fn duplicate_fd(fd: c_int) -> io::Result<c_int>` wraps Unix `dup`.
// Why:      The original stderr destination must survive after fd 2 is replaced.
// TS map:   `function duplicateFd(fd): number`.
#[cfg(unix)]
fn duplicate_fd(fd: c_int) -> io::Result<c_int> {
    // What:     `unsafe { dup(fd) }` asks libc to duplicate one open fd.
    // Why:      The duplicate gives the filter thread a stable output destination.
    // TS map:   `const result = native.dup(fd)`.
    let result = unsafe { dup(fd) };
    // What:     `if result == -1` checks libc's error sentinel.
    // Why:      `dup` can fail if the process is out of file descriptors.
    // TS map:   `if (result === -1) throw lastOsError()`.
    if result == -1 {
        return Err(io::Error::last_os_error());
    }
    // What:     `Ok(result)` returns the duplicated fd number.
    // Why:      The caller owns that fd and must eventually close it.
    // TS map:   `return result`.
    Ok(result)
}

// What:     `fn replace_stderr_with_pipe(write_fd: c_int) -> io::Result<()>` wraps
//           Unix `dup2`.
// Why:      Repointing fd 2 makes existing C/Zig stderr writes enter our pipe.
// TS map:   `function replaceStderrWithPipe(writeFd): void`.
#[cfg(unix)]
fn replace_stderr_with_pipe(write_fd: c_int) -> io::Result<()> {
    // What:     `unsafe { dup2(...) }` atomically copies `write_fd` onto fd 2.
    // Why:      Future writes to stderr should use the pipe without changing callers.
    // TS map:   `const result = native.dup2(writeFd, STDERR_FILE_DESCRIPTOR)`.
    let result = unsafe { dup2(write_fd, STDERR_FILE_DESCRIPTOR) };
    // What:     `if result == -1` checks libc's error sentinel.
    // Why:      The filter cannot work if fd 2 was not replaced.
    // TS map:   `if (result === -1) throw lastOsError()`.
    if result == -1 {
        return Err(io::Error::last_os_error());
    }
    // What:     `Ok(())` returns success with no payload.
    // Why:      stderr now points at the pipe write end.
    // TS map:   `return`.
    Ok(())
}

// What:     `fn close_fd(fd: c_int)` wraps Unix `close` and discards errors.
// Why:      Cleanup paths cannot fix a close failure and should preserve the earlier error.
// TS map:   `function closeFd(fd): void`.
#[cfg(unix)]
fn close_fd(fd: c_int) {
    // What:     `let _ = unsafe { close(fd) }` calls C `close` and explicitly discards
    //           its return code.
    // Why:      These calls are best-effort cleanup after success or another failure.
    // TS map:   `try { native.close(fd) } catch {}`.
    let _ = unsafe { close(fd) };
}

// What:     `fn file_from_fd(fd: c_int) -> File` converts a raw fd into a `File`.
// Why:      Rust should close the fd automatically when the worker exits.
// TS map:   `function fileFromFd(fd): File`.
#[cfg(unix)]
fn file_from_fd(fd: c_int) -> File {
    // What:     `unsafe { File::from_raw_fd(fd) }` tells Rust it now owns `fd`.
    // Why:      The fd came from `pipe` or `dup`, so no other Rust `File` owns it.
    // TS map:   `return File.fromFd(fd)`.
    unsafe { File::from_raw_fd(fd) }
}

// What:     `fn forward_filtered_stderr(...)` reads redirected stderr and writes kept
//           lines to the original stderr destination.
// Why:      Only Ghostty's known noisy OSC debug line should disappear.
// TS map:   `function forwardFilteredStderr(readerFile, writerFile): void`.
fn forward_filtered_stderr(reader_file: File, mut writer_file: File) {
    // What:     `BufReader::new(reader_file)` buffers reads from the pipe.
    // Why:      Line-oriented filtering should not make one syscall per byte.
    // TS map:   `const reader = new BufferedReader(readerFile)`.
    let mut reader = BufReader::new(reader_file);
    // What:     `let mut line = Vec::new()` creates a growable byte buffer. Sibling
    //           `String` would require UTF-8; fixed arrays cannot grow for long logs.
    // Why:      Ghostty debug records can be long because they dump OSC metadata bytes.
    // TS map:   `let line: number[] = []`.
    let mut line = Vec::new();
    // What:     `loop { ... }` repeats until stderr closes or reading fails.
    // Why:      The app can write diagnostics for the whole GUI lifetime.
    // TS map:   `while (true) { ... }`.
    loop {
        line.clear();
        // What:     `reader.read_until(...)` reads one newline-terminated byte record.
        // Why:      Dropping whole lines preserves every non-matching diagnostic intact.
        // TS map:   `const readCount = reader.readUntil("\n", line)`.
        let read_count = reader.read_until(b'\n', &mut line);
        // What:     `match read_count` branches on bytes read, EOF, or read error.
        // Why:      Each case has a different control-flow result.
        // TS map:   `if (readCount === 0) return; else if (error) return; ...`.
        match read_count {
            Ok(0) => return,
            Ok(_) => {
                // What:     `if should_suppress_stderr_line(...)` checks the byte record.
                // Why:      Matching records are exactly the Ghostty OSC noise to hide.
                // TS map:   `if (shouldSuppressStderrLine(line)) continue`.
                if should_suppress_stderr_line(line.as_slice()) {
                    continue;
                }
                // What:     `let _ = writer_file.write_all(...)` forwards all kept bytes
                //           and explicitly discards write errors.
                // Why:      If original stderr closes, there is nowhere useful to report it.
                // TS map:   `try { writer.write(line) } catch {}`.
                let _ = writer_file.write_all(line.as_slice());
                // What:     `let _ = writer_file.flush()` pushes diagnostics promptly and
                //           explicitly discards flush errors.
                // Why:      Error logs should remain interactive, but failure is unrecoverable.
                // TS map:   `try { writer.flush() } catch {}`.
                let _ = writer_file.flush();
            }
            Err(_) => return,
        }
    }
}

// What:     `fn should_suppress_stderr_line(line: &[u8]) -> bool` checks one borrowed
//           stderr byte line for the Ghostty noise marker.
// Why:      Tests can lock the exact filtering rule without touching process stderr.
// TS map:   `function shouldSuppressStderrLine(line: Uint8Array): boolean`.
fn should_suppress_stderr_line(line: &[u8]) -> bool {
    // What:     `.windows(...).any(|window| ...)` scans overlapping byte windows with
    //           a Rust closure. It is the byte-slice sibling of string `includes`.
    // Why:      This finds the marker without regex or UTF-8 assumptions.
    // TS map:   `return bytesIncludes(line, SUPPRESSED_GHOSTTY_OSC_LOG)`.
    line.windows(SUPPRESSED_GHOSTTY_OSC_LOG.len())
        .any(|window| window == SUPPRESSED_GHOSTTY_OSC_LOG)
}

// What:     `#[cfg(test)] mod tests` compiles these tests only during `cargo test`.
// Why:      The pure filter predicate should be verified without redirecting stderr.
// TS map:   `describe("stderr_filter", () => { ... })`.
#[cfg(test)]
mod tests {
    // What:     `use super::should_suppress_stderr_line;` imports the private predicate
    //           from the parent module.
    // Why:      Tests should check the rule directly.
    // TS map:   `import { shouldSuppressStderrLine } from "./stderr_filter"`.
    use super::should_suppress_stderr_line;

    #[test]
    fn suppresses_ghostty_unimplemented_osc_callback() {
        assert!(should_suppress_stderr_line(
            b"debug(stream): unimplemented OSC callback: .{ .context_signal = .{} }\n",
        ));
    }

    #[test]
    fn keeps_other_ghostty_debug_lines() {
        assert!(!should_suppress_stderr_line(
            b"debug(stream): some other Ghostty diagnostic\n",
        ));
    }

    #[test]
    fn keeps_non_utf8_lines_without_marker() {
        assert!(!should_suppress_stderr_line(b"\xff\xfe\xfd\n"));
    }
}
