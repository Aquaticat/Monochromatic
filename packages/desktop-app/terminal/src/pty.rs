//! PTY process management for the interactive terminal.

// What:     `use std::{...};` imports standard-library modules. `env` reads process
//           environment, `Read` and `Write` are byte-stream traits, `Sender` is a
//           channel sender, and `thread` starts the background reader.
// Why:      PTY output must be read off the UI thread and forwarded as byte chunks.
// TS map:   `import { env, Readable, Writable, Worker, Channel } from "std"`.
use std::{
    env,
    io::{Read, Write},
    sync::mpsc::Sender,
    thread,
};

// What:     `use portable_pty::{...};` imports the selected PTY abstraction.
//           `PtySize` describes terminal dimensions, `CommandBuilder` describes
//           the shell process, and `MasterPty` owns the read/write side.
// Why:      This crate avoids hand-written `forkpty` and `ioctl` setup.
// TS map:   `import { openPty, CommandBuilder } from "portable-pty"`.
use portable_pty::{
    native_pty_system, Child, CommandBuilder, MasterPty, PtySize, PtySystem,
};

// What:     `use crate::engine::ViewportGeometry;` imports the shared terminal
//           size model from the engine module.
// Why:      Ghostty and the PTY must receive the same rows, cols, and pixel size.
// TS map:   `import type { ViewportGeometry } from "./engine"`.
use crate::engine::ViewportGeometry;

// What:     `pub enum PtyEvent` declares messages from the reader thread to the UI
//           thread. The sibling shape would be one struct, but this is a tagged
//           union with separate output and stopped cases.
// Why:      The UI timer needs to distinguish shell bytes from reader lifecycle text.
// TS map:   `type PtyEvent = { type: "output", bytes } | { type: "readerStopped", message }`.
#[derive(Debug)]
pub enum PtyEvent {
    // What:     `Output(Vec<u8>)` carries one owned byte chunk from the PTY.
    // Why:      The UI thread feeds these bytes into libghostty-vt.
    // TS map:   `{ type: "output", bytes }`.
    Output(Vec<u8>),
    // What:     `ReaderStopped(String)` carries human-readable reader shutdown text.
    // Why:      The app can show EOF or read errors in the status line.
    // TS map:   `{ type: "readerStopped", message }`.
    ReaderStopped(String),
}

// What:     `pub struct PtySession` owns the live PTY process. Boxed trait objects
//           hide platform-specific Unix or Windows implementations from callers.
// Why:      Main only needs resize, write, and cleanup operations.
// TS map:   `class PtySession { master; writer; child; }`.
pub struct PtySession {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn Child + Send + Sync>,
}

// What:     `impl PtySession` defines methods on the live PTY session.
// Why:      Keep PTY creation and IO operations in one module.
// TS map:   `class PtySession { static spawnShell(...) { ... } }`.
impl PtySession {
    // What:     `pub fn spawn_shell(...) -> Result<Self, Box<dyn std::error::Error>>`
    //           creates a shell PTY and returns it or a boxed error. `Self` means
    //           `PtySession`.
    // Why:      The binary should call one function to start an interactive shell.
    // TS map:   `static spawnShell(geometry, sender): PtySession` that throws.
    pub fn spawn_shell(
        geometry: ViewportGeometry,
        event_sender: Sender<PtyEvent>,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        // What:     `let shell = default_shell_path()` reads the user's shell path.
        // Why:      A terminal should start the shell the user configured.
        // TS map:   `const shell = process.env.SHELL || "/bin/sh"`.
        let shell = default_shell_path();
        // What:     `let mut command = CommandBuilder::new(shell.as_str())` builds a
        //           mutable command with argv[0] set to the shell path.
        // Why:      PTY spawn needs a command object, not a raw string.
        // TS map:   `const command = new CommandBuilder(shell)`.
        let mut command = CommandBuilder::new(shell.as_str());
        // What:     `command.env(...)` overrides one environment variable inherited by
        //           the child shell.
        // Why:      Full-screen terminal apps query `TERM` to choose escape behavior.
        // TS map:   `command.env("TERM", "xterm-256color")`.
        command.env("TERM", "xterm-256color");
        // What:     `command.env(...)` advertises true-color support to terminal apps.
        // Why:      libghostty-vt resolves RGB colors, so child apps may emit them.
        // TS map:   `command.env("COLORTERM", "truecolor")`.
        command.env("COLORTERM", "truecolor");
        // What:     `Self::spawn_command(...)` delegates to the testable command path.
        // Why:      Unit tests can spawn a deterministic command instead of a real shell.
        // TS map:   `return PtySession.spawnCommand(geometry, command, sender)`.
        Self::spawn_command(geometry, command, event_sender)
    }

    // What:     `pub fn spawn_command(...) -> Result<Self, ...>` creates a PTY around
    //           an arbitrary command.
    // Why:      Tests and future command-launch options need the same PTY wiring.
    // TS map:   `static spawnCommand(geometry, command, sender): PtySession`.
    pub fn spawn_command(
        geometry: ViewportGeometry,
        command: CommandBuilder,
        event_sender: Sender<PtyEvent>,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        // What:     `native_pty_system()` selects the platform PTY implementation.
        // Why:      Linux, macOS, and Windows PTYs differ behind this API.
        // TS map:   `const ptySystem = nativePtySystem()`.
        let pty_system = native_pty_system();
        // What:     `pty_system.openpty(...)` allocates a master/slave PTY pair.
        // Why:      The shell runs on the slave side while the app reads and writes master.
        // TS map:   `const pair = ptySystem.openPty(size)`.
        let pair = pty_system.openpty(pty_size_from_geometry(geometry))?;
        // What:     `pair.slave.spawn_command(command)?` starts the child on the slave PTY.
        // Why:      The child then sees stdin, stdout, and stderr as a real terminal.
        // TS map:   `const child = pair.slave.spawn(command)`.
        let child = pair.slave.spawn_command(command)?;
        // What:     `pair.master.try_clone_reader()?` creates a readable handle to PTY output.
        // Why:      The reader moves to a background thread while the master stays owned here.
        // TS map:   `const reader = pair.master.cloneReader()`.
        let reader = pair.master.try_clone_reader()?;
        // What:     `pair.master.take_writer()?` creates the one writable handle to PTY input.
        // Why:      Keyboard bytes are written through this object.
        // TS map:   `const writer = pair.master.takeWriter()`.
        let writer = pair.master.take_writer()?;
        // What:     `spawn_reader_thread(reader, event_sender)` starts output forwarding.
        // Why:      Blocking reads must not stall Slint animations or input.
        // TS map:   `startWorker(() => readLoop(reader, sender))`.
        spawn_reader_thread(reader, event_sender);
        // What:     `Ok(Self { ... })` wraps the live PTY handles in a session object.
        // Why:      The caller can resize, write, and kill the session by dropping it.
        // TS map:   `return new PtySession(pair.master, writer, child)`.
        Ok(Self {
            master: pair.master,
            writer,
            child,
        })
    }

    // What:     `pub fn resize(&self, geometry: ViewportGeometry) -> Result...` sends
    //           updated terminal size to the PTY master.
    // Why:      Shells and full-screen apps need SIGWINCH and updated rows or cols.
    // TS map:   `resize(geometry): void` that throws on PTY resize failure.
    pub fn resize(&self, geometry: ViewportGeometry) -> Result<(), Box<dyn std::error::Error>> {
        // What:     `self.master.resize(...)` asks the OS PTY to update its winsize.
        // Why:      Child programs read this size and repaint to the new viewport.
        // TS map:   `this.master.resize(size)`.
        self.master.resize(pty_size_from_geometry(geometry))?;
        // What:     `Ok(())` returns success with no payload.
        // Why:      Resize completed.
        // TS map:   `return`.
        Ok(())
    }

    // What:     `pub fn write_bytes(&mut self, bytes: &[u8]) -> std::io::Result<()>`
    //           writes borrowed bytes to the PTY input stream.
    // Why:      Keyboard input reaches the shell through the master writer.
    // TS map:   `writeBytes(bytes: Uint8Array): void`.
    pub fn write_bytes(&mut self, bytes: &[u8]) -> std::io::Result<()> {
        // What:     `self.writer.write_all(bytes)?` writes the entire borrowed byte slice.
        // Why:      Partial writes would corrupt escape sequences and UTF-8 text.
        // TS map:   `writer.write(bytes)`.
        self.writer.write_all(bytes)?;
        // What:     `self.writer.flush()` asks the stream to push buffered bytes now.
        // Why:      Interactive input should reach the shell immediately.
        // TS map:   `writer.flush()`.
        self.writer.flush()
    }
}

// What:     `impl Drop for PtySession` defines cleanup when the session is destroyed.
// Why:      Closing the terminal window should terminate the child shell.
// TS map:   `PtySession.prototype.dispose = function () { ... }`.
impl Drop for PtySession {
    // What:     `fn drop(&mut self)` is Rust's destructor hook.
    // Why:      It runs automatically when the last `PtySession` owner goes away.
    // TS map:   `dispose()` called by `using` or manual cleanup.
    fn drop(&mut self) {
        // What:     `let _ = self.child.kill();` calls kill and intentionally ignores
        //           cleanup errors. `let _ =` is Rust's explicit discard pattern.
        // Why:      Destructors cannot return errors, and the child may already be gone.
        // TS map:   `try { child.kill(); } catch {}`.
        let _ = self.child.kill();
    }
}

// What:     `fn default_shell_path() -> String` returns an owned shell path string.
// Why:      `CommandBuilder::new` needs a stable string while building the command.
// TS map:   `function defaultShellPath(): string`.
fn default_shell_path() -> String {
    // What:     `env::var("SHELL").ok()` reads `$SHELL` and converts `Result` to
    //           `Option`. `filter` rejects empty strings.
    // Why:      Desktop launches may have a configured shell; empty values are unusable.
    // TS map:   `const shell = process.env.SHELL || undefined`.
    let shell = env::var("SHELL").ok().filter(|value| !value.is_empty());
    // What:     `unwrap_or_else(...)` returns `$SHELL` or allocates `"/bin/sh"`.
    // Why:      POSIX systems should always have `/bin/sh` as a fallback shell.
    // TS map:   `return shell ?? "/bin/sh"`.
    shell.unwrap_or_else(|| "/bin/sh".to_string())
}

// What:     `fn pty_size_from_geometry(...) -> PtySize` converts engine geometry to
//           portable-pty's size struct.
// Why:      Ghostty and the kernel PTY must agree on rows, cols, and pixel size.
// TS map:   `function ptySizeFromGeometry(geometry): PtySize`.
fn pty_size_from_geometry(geometry: ViewportGeometry) -> PtySize {
    // What:     `PtySize { ... }` constructs a size record with rows, cols, and pixels.
    // Why:      PTY resize APIs need text dimensions and can also carry pixel hints.
    // TS map:   `return { rows, cols, pixelWidth, pixelHeight }`.
    PtySize {
        rows: geometry.rows,
        cols: geometry.cols,
        pixel_width: geometry.cell_width_px as u16 * geometry.cols,
        pixel_height: geometry.cell_height_px as u16 * geometry.rows,
    }
}

// What:     `fn spawn_reader_thread(...)` takes ownership of a reader and sender,
//           then starts a background thread.
// Why:      PTY reads block until the child writes output.
// TS map:   `function spawnReaderThread(reader, sender): void`.
fn spawn_reader_thread(mut reader: Box<dyn Read + Send>, event_sender: Sender<PtyEvent>) {
    // What:     `thread::spawn(move || { ... })` starts a native thread and moves the
    //           reader plus sender into its closure.
    // Why:      The reader must live independently from the UI thread.
    // TS map:   `new Worker(() => readLoop(reader, sender))`.
    thread::spawn(move || {
        // What:     `let mut buffer = [0u8; 8192]` creates a fixed-size byte buffer.
        // Why:      Reusing one buffer avoids allocating for every read call.
        // TS map:   `const buffer = new Uint8Array(8192)`.
        let mut buffer = [0u8; 8192];
        // What:     `loop { ... }` repeats until EOF, read error, or UI shutdown.
        // Why:      The shell can produce output for the whole window lifetime.
        // TS map:   `while (true) { ... }`.
        loop {
            // What:     `match reader.read(&mut buffer)` blocks for PTY output and branches
            //           on bytes read, EOF, or error.
            // Why:      Each branch needs a different event-loop message.
            // TS map:   `const readCount = reader.read(buffer); if ...`.
            match reader.read(&mut buffer) {
                // What:     `Ok(0)` means EOF from the PTY.
                // Why:      The shell exited or the PTY closed.
                // TS map:   `if (readCount === 0) sender.send(readerStopped)`.
                Ok(0) => {
                    let _ = event_sender.send(PtyEvent::ReaderStopped("PTY closed".to_string()));
                    return;
                }
                // What:     `Ok(read_count)` means the buffer contains that many bytes.
                // Why:      Only the filled prefix should be forwarded.
                // TS map:   `sender.send(buffer.slice(0, readCount))`.
                Ok(read_count) => {
                    let bytes = buffer[..read_count].to_vec();
                    if event_sender.send(PtyEvent::Output(bytes)).is_err() {
                        return;
                    }
                }
                // What:     `Err(error)` means the OS read call failed.
                // Why:      Surface the failure in the status line instead of silently dying.
                // TS map:   `sender.send({ type: "readerStopped", message: String(error) })`.
                Err(error) => {
                    let message = format!("PTY read failed: {error}");
                    let _ = event_sender.send(PtyEvent::ReaderStopped(message));
                    return;
                }
            }
        }
    });
}

// What:     `#[cfg(test)] mod tests` compiles tests only for `cargo test`.
// Why:      PTY command spawning should be verified without opening Slint.
// TS map:   `describe("PtySession", () => { ... })`.
#[cfg(test)]
mod tests {
    // What:     `use super::{...};` imports PTY items from the parent module.
    // Why:      Tests exercise the public spawn path and event enum.
    // TS map:   `import { PtyEvent, PtySession } from "./pty"`.
    use super::{PtyEvent, PtySession};
    // What:     `use crate::engine::ViewportGeometry;` imports the shared geometry type.
    // Why:      PTY tests need the same size object as the app.
    // TS map:   `import type { ViewportGeometry } from "./engine"`.
    use crate::engine::ViewportGeometry;
    // What:     `use portable_pty::CommandBuilder;` imports the PTY command builder.
    // Why:      The test spawns a deterministic shell command.
    // TS map:   `import { CommandBuilder } from "portable-pty"`.
    use portable_pty::CommandBuilder;
    // What:     `use std::{...};` imports channels and timeouts for the test.
    // Why:      The test waits for output without blocking forever.
    // TS map:   `import { channel, Duration } from "std"`.
    use std::{sync::mpsc, time::Duration};

    #[test]
    fn spawns_command_and_reads_output() -> Result<(), Box<dyn std::error::Error>> {
        let geometry = ViewportGeometry {
            cols: 20,
            rows: 4,
            cell_width_px: 9.0,
            cell_height_px: 18.0,
        };
        let (sender, receiver) = mpsc::channel();
        let mut command = CommandBuilder::new("/bin/sh");
        command.arg("-lc");
        command.arg("printf terminal-pty-test");
        let _session = PtySession::spawn_command(geometry, command, sender)?;
        let event = receiver.recv_timeout(Duration::from_secs(5))?;
        if let PtyEvent::Output(bytes) = event {
            let text = String::from_utf8_lossy(bytes.as_slice());
            assert!(text.contains("terminal-pty-test"));
        } else {
            panic!("expected PTY output event");
        }
        Ok(())
    }
}
