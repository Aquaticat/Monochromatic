//! The Unix-socket control API.
//!
//! A dedicated thread owns the listening socket and does all blocking line I/O. For each
//! request line it parses a `Command`, forwards it to the main (event-loop) thread over a
//! calloop channel together with a one-shot reply channel, waits for the `Response`, and
//! writes it back. Executing on the main thread is required because screenshot readback
//! and input injection must touch the GL context and seat, which live there.

/// What:     Grouped `use` of the blocking I/O traits, the Unix socket types, paths, the
///           one-shot reply channel, and threads.
/// Why:      The control thread reads lines and writes responses; the reply channel bridges
///           back from the main thread.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import net from "node:net"; // and a promise to await the main thread's reply
/// ```
use std::{
    io::{BufRead, BufReader, Write},
    os::unix::net::{UnixListener, UnixStream},
    path::Path,
    sync::mpsc::{sync_channel, SyncSender},
};

/// What:     Grouped `use` of the calloop channel (cross-thread source) and loop handle,
///           plus winit's `PhysicalSize` for the resize request.
/// Why:      Register the channel as an event source and request a window resize.
use smithay::reexports::{
    calloop::{
        channel::{channel, Event, Sender},
        LoopHandle,
    },
    winit::dpi::PhysicalSize,
};

/// What:     `use anyhow::{Context, Result};`. Error helpers.
/// Why:      Socket binding and thread spawning return `Result`.
use anyhow::{Context, Result};

/// What:     `use tracing::{info, warn};`. Structured log macros.
/// Why:      Report listening, accept errors, and connection errors.
use tracing::{info, warn};

/// What:     Grouped `use` of the protocol, input, keymap, screenshot, and state items.
/// Why:      `execute` dispatches parsed commands into these subsystems.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { parseCommand, formatResponse, Command, Response } from "./protocol"; ...
/// ```
use crate::{
    child, dnd, encoder, input, keymap,
    protocol::{format_response, parse_command, Command, Response},
    recorder, screenshot,
    state::Compositor,
};

/// A command forwarded from the control thread to the main thread, with a reply channel.
///
/// What:     `pub struct ControlRequest { pub command: Command, pub reply:
///           SyncSender<Response> }`. `SyncSender<Response>` is the sending half of a
///           bounded one-shot channel the main thread answers on.
/// Why:      Carries both the work and the way to return its result across threads.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type ControlRequest = { command: Command; reply: (r: Response) => void };
/// ```
pub struct ControlRequest {
    /// The parsed command to execute on the main thread.
    pub command: Command,
    /// One-shot channel the main thread sends the response back on.
    pub reply: SyncSender<Response>,
}

/// Bind the control socket, register the channel source, and spawn the control thread.
///
/// What:     `pub fn start(loop_handle: &LoopHandle<Compositor>, socket_path: &Path) ->
///           Result<()>`. Borrows the loop handle (to insert the channel source) and the
///           socket path. The loop-handle lifetime is elided, matching `child.rs`.
/// Why:      One call from `run` wires the whole control API when a socket is requested.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function start(loopHandle, socketPath): void { ... }
/// ```
pub fn start(loop_handle: &LoopHandle<Compositor>, socket_path: &Path) -> Result<()> {
    // What:     `let listener = bind_listener(socket_path)?;`. Create the listening socket.
    // Why:      The control thread accepts connections on it.
    let listener = bind_listener(socket_path)?;

    // What:     `let (sender, channel) = channel::<ControlRequest>();`. Create a calloop
    //           cross-thread channel: `sender` (moved to the control thread) and `channel`
    //           (the event source registered on the loop).
    // Why:      The bridge from the control thread to the main thread.
    let (sender, channel) = channel::<ControlRequest>();

    // What:     `loop_handle.insert_source(channel, |event, _, state| { ... }).map_err(...)?;`.
    //           Register the channel; the callback runs on the main thread for each message.
    // Why:      Execute forwarded commands where the GL context and seat live.
    loop_handle
        .insert_source(channel, |event, _, state: &mut Compositor| {
            // What:     `if let Event::Msg(request) = event { ... }`. The channel yields
            //           `Event::Msg(T)` for each item (and `Event::Closed` at the end); we
            //           only act on messages.
            // Why:      Ignore the close notification; there is nothing to do on it.
            if let Event::Msg(request) = event {
                // What:     `let response = execute(state, request.command);`. Run the
                //           command against the live state on the main thread.
                // Why:      Produce the result to send back.
                let response = execute(state, request.command);

                // What:     `let _ = request.reply.send(response);`. Send the result back;
                //           discard the send error (the control thread may have hung up).
                // Why:      Deliver the response to the waiting control thread.
                let _ = request.reply.send(response);
            }
        })
        .map_err(|err| anyhow::anyhow!("registering the control channel source failed: {err}"))?;

    // What:     `std::thread::Builder::new().name("nws-control".to_string()).spawn(move ||
    //           control_thread(listener, sender)).context(...)?;`. Spawn the named control
    //           thread, moving the listener and sender into it.
    // Why:      Keep blocking socket I/O off the event-loop thread.
    std::thread::Builder::new()
        .name("nws-control".to_string())
        .spawn(move || control_thread(listener, sender))
        .context("spawning the control thread")?;

    // What:     `Ok(())`. Success.
    // Why:      Signal the control API is up.
    Ok(())
}

/// Bind (and clean up any stale) the control Unix socket.
///
/// What:     `fn bind_listener(path: &Path) -> Result<UnixListener>`. Removes a stale
///           socket file if present, then binds.
/// Why:      A leftover socket file from a previous run would make `bind` fail.
fn bind_listener(path: &Path) -> Result<UnixListener> {
    // What:     `if path.exists() { std::fs::remove_file(path).with_context(...)?; }`.
    //           Remove a pre-existing socket file.
    // Why:      `UnixListener::bind` errors if the path already exists.
    if path.exists() {
        std::fs::remove_file(path)
            .with_context(|| format!("removing stale control socket {}", path.display()))?;
    }

    // What:     `let listener = UnixListener::bind(path).with_context(...)?;`. Bind the
    //           socket.
    // Why:      Start listening for control connections.
    let listener = UnixListener::bind(path)
        .with_context(|| format!("binding control socket {}", path.display()))?;

    // What:     `info!(...)`. Log where the control socket lives.
    // Why:      Make the address discoverable.
    info!("control socket listening at {}", path.display());

    // What:     `Ok(listener)`. Return the bound listener.
    // Why:      Hand it to the control thread.
    Ok(listener)
}

/// The control thread body: accept connections and handle each in turn.
///
/// What:     `fn control_thread(listener: UnixListener, sender: Sender<ControlRequest>)`.
///           Owns the listener and the channel sender.
/// Why:      Serialises control clients (a test harness connects one at a time), keeping
///           the protocol simple.
fn control_thread(listener: UnixListener, sender: Sender<ControlRequest>) {
    // What:     `for incoming in listener.incoming() { ... }`. Iterate accepted connections;
    //           `incoming()` yields `Result<UnixStream>` blockingly.
    // Why:      Serve each control client.
    for incoming in listener.incoming() {
        // What:     `match incoming { Ok(stream) => ..., Err(err) => { warn!; break; } }`.
        //           Handle a connection or log-and-stop on an accept error.
        // Why:      Keep serving until a fatal accept error.
        match incoming {
            Ok(stream) => {
                // What:     `if let Err(err) = handle_connection(stream, &sender) { warn!(...);
                //           }`. Serve the connection, logging any per-connection error.
                // Why:      One client's I/O error should not kill the control thread.
                if let Err(err) = handle_connection(stream, &sender) {
                    warn!("control connection ended with error: {err}");
                }
            }
            Err(err) => {
                // What:     `warn!(...); break;`. Log and stop accepting.
                // Why:      A listener-level error is not recoverable.
                warn!("control accept failed: {err}");
                break;
            }
        }
    }
}

/// Handle one control connection: read request lines and write response lines.
///
/// What:     `fn handle_connection(stream: UnixStream, sender: &Sender<ControlRequest>) ->
///           Result<()>`. Reads until the client closes the connection.
/// Why:      Implements the line-per-request, line-per-response loop for one client.
fn handle_connection(stream: UnixStream, sender: &Sender<ControlRequest>) -> Result<()> {
    // What:     `let reader_half = stream.try_clone().context(...)?;`. Duplicate the socket
    //           fd so one half reads while the other writes.
    // Why:      `BufReader` consumes its reader; we still need to write responses.
    let reader_half = stream.try_clone().context("cloning the control stream")?;

    // What:     `let mut writer = stream;`. Keep the original for writing.
    // Why:      Write responses on it.
    let mut writer = stream;

    // What:     `let reader = BufReader::new(reader_half);`. Buffered line reader over the
    //           read half.
    // Why:      `.lines()` needs a buffered reader.
    let reader = BufReader::new(reader_half);

    // What:     `for line in reader.lines() { ... }`. Iterate the connection's lines;
    //           `lines()` yields `Result<String>` per line, ending at EOF.
    // Why:      One request per line.
    for line in reader.lines() {
        // What:     `let line = line.context("reading a control line")?;`. Unwrap the read
        //           result.
        // Why:      Propagate a read error out of the connection loop.
        let line = line.context("reading a control line")?;

        // What:     `let response = dispatch_line(&line, sender);`. Parse and execute the
        //           line (or produce an error response).
        // Why:      Turn a request line into a response.
        let response = dispatch_line(&line, sender);

        // What:     `let text = format_response(&response);`. Render the response to its wire
        //           form.
        // Why:      Prepare the bytes to write.
        let text = format_response(&response);

        // What:     `writer.write_all(text.as_bytes()).context(...)?;` then a newline, then
        //           `writer.flush()`. Write the response line and push it out.
        // Why:      Deliver the response promptly so the client can proceed.
        writer
            .write_all(text.as_bytes())
            .context("writing a control response")?;
        writer.write_all(b"\n").context("writing a control newline")?;
        writer.flush().context("flushing a control response")?;
    }

    // What:     `Ok(())`. The client closed the connection normally.
    // Why:      Signal clean end-of-connection.
    Ok(())
}

/// Parse one line and, if valid, run it on the main thread and await its response.
///
/// What:     `fn dispatch_line(line: &str, sender: &Sender<ControlRequest>) -> Response`.
///           Always returns a `Response` (parse errors become `Err` responses).
/// Why:      Bridge the control thread to the main thread for one command.
fn dispatch_line(line: &str, sender: &Sender<ControlRequest>) -> Response {
    // What:     `let command = match parse_command(line) { Ok(c) => c, Err(message) =>
    //           return Response::Err(message) };`. Parse; a parse error short-circuits to an
    //           error response.
    // Why:      Do not bother the main thread with malformed input.
    let command = match parse_command(line) {
        Ok(command) => command,
        Err(message) => return Response::Err(message),
    };

    // What:     `let (reply_tx, reply_rx) = sync_channel::<Response>(1);`. A bounded one-shot
    //           channel for this command's reply.
    // Why:      The main thread answers on `reply_tx`; we wait on `reply_rx`.
    let (reply_tx, reply_rx) = sync_channel::<Response>(1);

    // What:     `if sender.send(ControlRequest { command, reply: reply_tx }).is_err() {
    //           return Response::Err(...); }`. Forward the request; a send error means the
    //           loop is gone.
    // Why:      Hand the work to the main thread, or report shutdown.
    if sender
        .send(ControlRequest {
            command,
            reply: reply_tx,
        })
        .is_err()
    {
        return Response::Err("compositor is shutting down".to_string());
    }

    // What:     `match reply_rx.recv() { Ok(response) => response, Err(_) =>
    //           Response::Err(...) }`. Block until the main thread replies; a receive error
    //           means the reply sender was dropped.
    // Why:      Return the executed command's result.
    match reply_rx.recv() {
        Ok(response) => response,
        Err(_) => Response::Err("compositor dropped the request".to_string()),
    }
}

/// Execute a command against the live compositor state (runs on the main thread).
///
/// What:     `pub fn execute(state: &mut Compositor, command: Command) -> Response`.
///           Dispatches each command variant to its subsystem and maps the outcome to a
///           `Response`.
/// Why:      The single place command semantics live; called from the channel source.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function execute(state, command): Response { ... }
/// ```
pub fn execute(state: &mut Compositor, command: Command) -> Response {
    // What:     `match command { ... }`. One arm per command variant.
    // Why:      Route to screenshot, input, resize, or lifecycle handling.
    match command {
        Command::Ping => Response::Ok,
        Command::Screenshot(path) => {
            // What:     `match screenshot::capture(state, &path) { Ok(()) => Response::Ok,
            //           Err(err) => Response::Err(format!("{err:#}")) }`. Capture and map the
            //           result. `{err:#}` formats the anyhow error with its full context chain.
            // Why:      Report a screenshot failure with its cause.
            match screenshot::capture(state, &path) {
                Ok(()) => Response::Ok,
                Err(err) => Response::Err(format!("{err:#}")),
            }
        }
        Command::Click { x, y, button } => {
            // What:     `input::click(state, x, y, button);`. Inject the click.
            // Why:      Perform the requested click.
            input::click(state, x, y, button);
            Response::Ok
        }
        Command::Key { name, action } => {
            // What:     `match keymap::named_key(&name) { Some(evdev) => { input::key(...);
            //           Response::Ok } None => Response::Err(...) }`. Resolve the key name;
            //           error on an unknown key.
            // Why:      Only inject keys we can map to an evdev code.
            match keymap::named_key(&name) {
                Some(evdev) => {
                    input::key(state, evdev, action);
                    Response::Ok
                }
                None => Response::Err(format!("unknown key: {name}")),
            }
        }
        Command::Type(text) => {
            // What:     `input::type_text(state, &text);`. Type the run of text.
            // Why:      Perform the requested typing.
            input::type_text(state, &text);
            Response::Ok
        }
        Command::Resize { width, height } => {
            // What:     `resize(state, width, height);`. Request the window resize.
            // Why:      Change the nested screen size.
            resize(state, width, height);
            Response::Ok
        }
        Command::DropFile { path, x, y } => {
            // What:     `match dnd::drop_file(state, &path, x, y) { Ok(()) => Response::Ok,
            //           Err(err) => Response::Err(format!("{err:#}")) }`. Originate the
            //           compositor-side drag; map the outcome. `{err:#}` renders the anyhow
            //           context chain.
            // Why:      Report a drop-file setup failure (missing file, unmapped app) with its
            //           cause; the drop itself completes asynchronously on the release timer.
            match dnd::drop_file(state, &path, x, y) {
                Ok(()) => Response::Ok,
                Err(err) => Response::Err(format!("{err:#}")),
            }
        }
        Command::Record { dir, fps, format } => {
            // What:     `match encoder::Format::parse(&format) { Ok(fmt) => ..., Err(message)
            //           => Response::Err(message) }`. Validate the format name first.
            // Why:      Reject an unknown format before touching the recorder.
            match encoder::Format::parse(&format) {
                Ok(fmt) => {
                    // What:     `match recorder::start(state, dir, fps, fmt) { Ok(()) =>
                    //           Response::Ok, Err(err) => Response::Err(format!("{err:#}")) }`.
                    //           Start recording; map the outcome.
                    // Why:      Begin the capture, reporting any setup failure.
                    match recorder::start(state, dir, fps, fmt) {
                        Ok(()) => Response::Ok,
                        Err(err) => Response::Err(format!("{err:#}")),
                    }
                }
                Err(message) => Response::Err(message),
            }
        }
        Command::RecordStop => {
            // What:     `match recorder::stop(state) { Some(stats) => Response::OkWith(...),
            //           None => Response::Err("not recording") }`. Stop and report the
            //           measured statistics as the response payload.
            // Why:      Make the achieved fps / drop count observable to the caller.
            match recorder::stop(state) {
                Some(stats) => Response::OkWith(format!(
                    "captured={} dropped={} failures={} seconds={:.3} fps={:.1}",
                    stats.captured, stats.dropped, stats.failures, stats.seconds, stats.fps
                )),
                None => Response::Err("not recording".to_string()),
            }
        }
        Command::Quit => {
            // Ask hosted client to close before tearing down its Wayland connection.
            child::request_hosted_client_shutdown(state);
            return Response::Ok;
        }
    }
}

/// Request that the nested winit window (and thus the output) resize.
///
/// What:     `fn resize(state: &mut Compositor, width: i32, height: i32)`. Asks winit for a
///           new inner size; the actual `WinitEvent::Resized` follows and updates the
///           output.
/// Why:      A control command should be able to change the screen size mid-test.
fn resize(state: &mut Compositor, width: i32, height: i32) {
    // What:     `let _ = state.backend.window().request_inner_size(PhysicalSize::new(width
    //           as u32, height as u32));`. Request the resize; discard the returned optional
    //           immediate size. The parent compositor may honour or ignore it.
    // Why:      Best-effort resize; the resulting `Resized` event does the real update.
    let _ = state
        .backend
        .window()
        .request_inner_size(PhysicalSize::new(width as u32, height as u32));
}
