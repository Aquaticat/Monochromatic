//! Engine: the worker-thread front door. `Engine::spawn` starts a background
//! thread running `run`, which owns a `Controller` (the real playback state, in
//! `controller.rs`) and drives it from the command channel.
//!
//! Threads, for a TypeScript reader: `Engine::spawn` starts a background worker
//! (`std::thread`). The UI talks to it through a one-way queue of `Command`s
//! (an `mpsc` channel: many senders, one receiver). The worker replies by
//! calling an `on_update` callback the UI supplied. The PipeWire output runs its
//! OWN thread internally; the controller thread only decodes and pushes samples
//! into the ring buffer the output hands back.

// What:     `use std::sync::mpsc::{self, Receiver, Sender, TryRecvError};`. The
//           multi-producer/single-consumer channel: `Sender` pushes, `Receiver`
//           pops, `TryRecvError` reports "empty" vs "all senders gone". `self`
//           also imports the `mpsc` module itself (for `mpsc::channel()`).
// Why:      The UI thread sends `Command`s to this worker thread.
// TS map:   a thread-safe async queue; `Sender.send` ~ `queue.push`,
//           `Receiver.try_recv` ~ a non-blocking `queue.tryPop`.
use std::sync::mpsc::{self, Receiver, Sender, TryRecvError};

// What:     `use std::thread::{self, JoinHandle};`. `thread::spawn` starts a
//           worker; a `JoinHandle` lets us wait for it to finish.
// Why:      The engine runs on its own thread.
// TS map:   closest is a Worker plus a promise that resolves when it exits.
use std::thread::{self, JoinHandle};

// What:     `use std::time::Duration;`. A span of time (here, a sleep interval).
// Why:      We sleep briefly when idle to avoid busy-spinning the CPU.
// TS map:   a number of milliseconds passed to `setTimeout`.
use std::time::Duration;

// What:     `use crate::command::{Command, Update};`. The UI->engine and
//           engine->UI message enums.
// Why:      The channel carries `Command`s; the callback delivers `Update`s.
// TS map:   `import { Command, Update } from "./command";`
use crate::command::{Command, Update};

// What:     `use crate::controller::Controller;`. The playback state machine.
// Why:      `run` builds one and forwards commands/audio pumping to it.
// TS map:   `import { Controller } from "./controller";`
use crate::controller::Controller;

// What:     `use crate::output::Output;`. The PipeWire output (FFI boundary).
// Why:      `run` tries to create one and hands it to the controller.
// TS map:   `import { Output } from "./output";`
use crate::output::Output;

// What:     `const IDLE_SLEEP_MS: u64 = 5;`. Milliseconds to sleep when there is
//           no audio work this cycle. `u64` is what `Duration::from_millis` wants.
// Why:      Avoid pegging a CPU core while paused or buffer-full.
// TS map:   `const IDLE_SLEEP_MS = 5;`
const IDLE_SLEEP_MS: u64 = 5;

// What:     `pub struct Engine { ... }`. The handle the UI keeps. It is `Send`
//           (only a channel sender + a thread handle), unlike the controller's
//           internal state.
// Why:      Lets the UI send commands and stop the worker on drop.
// TS map:   `class Engine { tx; handle; }`
pub struct Engine {
    // What:     `tx: Sender<Command>`. The send end of the command channel.
    // Why:      `send` pushes commands to the worker.
    // TS map:   `tx: Sender<Command>;`
    tx: Sender<Command>,
    // What:     `handle: Option<JoinHandle<()>>`. The worker's join handle, or
    //           `None` after we have joined it. `JoinHandle<()>` = the thread
    //           returns nothing.
    // Why:      `Drop` joins the thread so the output cleans up before exit.
    // TS map:   `handle: ThreadHandle | null;`
    handle: Option<JoinHandle<()>>,
}

// What:     `impl Engine { ... }`. The handle's methods.
// Why:      Construction and command sending.
// TS map:   the class body.
impl Engine {
    // What:     `pub fn spawn<F>(on_update: F) -> Engine where F: Fn(Update) + Send + 'static`.
    //           Start the worker. `F` is the callback type; the WHERE clause
    //           requires it be callable repeatedly (`Fn`), movable to another
    //           thread (`Send`), and own no short-lived borrows (`'static`).
    // Why:      The UI passes a closure that forwards updates to the Slint loop.
    // TS map:   `static spawn(onUpdate: (u: Update) => void): Engine`
    pub fn spawn<F>(on_update: F) -> Engine
    where
        F: Fn(Update) + Send + 'static,
    {
        // What:     `let (tx, rx) = mpsc::channel::<Command>();`. Create the
        //           channel; destructure into sender `tx` and receiver `rx`.
        // Why:      The link between UI and worker.
        // TS map:   `const { tx, rx } = makeChannel<Command>();`
        let (tx, rx) = mpsc::channel::<Command>();

        // What:     `let callback: Box<dyn Fn(Update) + Send> = Box::new(on_update);`.
        //           Box the callback as a heap-allocated trait object so the
        //           worker can store one fixed type regardless of the concrete `F`.
        // Why:      Erase `F` to a uniform callback type.
        // TS map:   `const callback = onUpdate;` (TS functions are already boxed)
        let callback: Box<dyn Fn(Update) + Send> = Box::new(on_update);

        // What:     `let handle = thread::spawn(move || run(rx, callback));`. Start
        //           the worker. `move ||` is a closure that TAKES OWNERSHIP of `rx`
        //           and `callback` and runs `run(...)` on the new thread.
        // Why:      Decode/playback happens off the UI thread.
        // TS map:   `const handle = startWorker(() => run(rx, callback));`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const handle = startWorker(() => run(rx, callback));
        // ```
        let handle = thread::spawn(move || run(rx, callback));

        // What:     `Engine { tx, handle: Some(handle) }`. Build the handle. Tail
        //           -> return.
        // Why:      Hand the UI its control surface.
        // TS map:   `return new Engine(tx, handle);`
        Engine {
            tx,
            handle: Some(handle),
        }
    }

    // What:     `pub fn sender(&self) -> Sender<Command>`. Hand out a CLONE of the
    //           command channel's send end. `Sender` is `Clone` and `Send`, so the
    //           clone can be moved to another OS thread (the file-picker thread).
    // Why:      The file dialog runs on its own thread and must send `OpenPaths`
    //           back; it cannot hold the `!Send` `Rc<Engine>` the UI uses.
    // TS map:   `sender(): Sender<Command>` (returns a thread-safe queue handle)
    pub fn sender(&self) -> Sender<Command> {
        // What:     `self.tx.clone()`. Duplicate the sender (both refer to the same
        //           underlying channel). Tail -> return.
        // Why:      Give the caller its own handle.
        // TS map:   `return this.tx.clone();`
        self.tx.clone()
    }

    // What:     `pub fn send(&self, command: Command)`. Forward a command to the
    //           worker. Read-only borrow of self.
    // Why:      The UI's only way to control playback.
    // TS map:   `send(command: Command): void`
    pub fn send(&self, command: Command) {
        // What:     `let _ = self.tx.send(command);`. `send` returns a `Result`
        //           that errs only if the worker is gone; `let _ =` DISCARDS it.
        // Why:      A dead worker during shutdown is not worth surfacing.
        // TS map:   `try { this.tx.send(command); } catch {}`
        let _ = self.tx.send(command);
    }
}

// What:     `impl Drop for Engine { ... }`. Cleanup when the UI drops the engine.
// Why:      Tell the worker to quit and wait for it, so PipeWire shuts down.
// TS map:   a `dispose()` that stops the worker.
impl Drop for Engine {
    // What:     `fn drop(&mut self)`. Runs at end of life.
    // Why:      Graceful shutdown.
    // TS map:   `[Symbol.dispose]() { ... }`
    fn drop(&mut self) {
        // What:     `let _ = self.tx.send(Command::Quit);`. Ask the worker to stop;
        //           ignore the error if it already exited.
        // Why:      Break the worker's loop.
        // TS map:   `try { this.tx.send(Command.Quit); } catch {}`
        let _ = self.tx.send(Command::Quit);

        // What:     `if let Some(handle) = self.handle.take() { let _ = handle.join(); }`.
        //           `.take()` moves the handle out (leaving `None`); `join()` waits
        //           for the worker to finish; `let _ =` ignores a panic result.
        // Why:      Ensure the output (and PipeWire) is fully torn down before exit.
        // TS map:   `if (this.handle) { await this.handle; this.handle = null; }`
        if let Some(handle) = self.handle.take() {
            let _ = handle.join();
        }
    }
}

// What:     `fn run(rx: Receiver<Command>, on_update: Box<dyn Fn(Update) + Send>)`.
//           The worker's entry point: set up state, then loop handling commands
//           and pumping audio until told to quit.
// Why:      Everything playback-related lives on this one thread.
// TS map:   `function run(rx: Receiver<Command>, onUpdate: (u: Update) => void): void`
fn run(rx: Receiver<Command>, on_update: Box<dyn Fn(Update) + Send>) {
    // What:     `let output = match Output::new() { ... };`. Try to start PipeWire.
    //           On failure we log and run WITHOUT audio (the UI still works).
    // Why:      Never crash the app if audio init fails.
    // TS map:   `let output; try { output = Output.create(); } catch (e) { console.error(e); output = null; }`
    let output = match Output::new() {
        // What:     `Ok(o) => Some(o)`. Audio is available.
        // Why:      Keep the output.
        // TS map:   `output = o;`
        Ok(o) => Some(o),
        // What:     `Err(e) => { eprintln!(...); None }`. `eprintln!` writes to
        //           stderr; `{e}` uses `PlayerError`'s Display.
        // Why:      Degrade gracefully to silent mode.
        // TS map:   `console.error(...); output = null;`
        Err(e) => {
            eprintln!("music-player: audio init failed: {e}");
            None
        }
    };

    // What:     `let mut controller = Controller::new(on_update, output);`. Build
    //           the mutable controller state.
    // Why:      Holds the queue, source, producer, and flags across the loop.
    // TS map:   `const controller = new Controller(onUpdate, output);`
    let mut controller = Controller::new(on_update, output);

    // What:     `loop { ... }`. The main worker loop; we `break` on quit.
    // Why:      Keep handling commands and feeding audio.
    // TS map:   `while (true) { ... }`
    loop {
        // What:     `let mut quitting = false;`. Flag set when a quit/disconnect
        //           is seen while draining commands.
        // Why:      Break the outer loop after the drain.
        // TS map:   `let quitting = false;`
        let mut quitting = false;

        // What:     `loop { ... }`. Inner loop: drain ALL queued commands without
        //           blocking, so the UI feels responsive.
        // Why:      Apply every pending command before decoding more audio.
        // TS map:   `while (true) { const r = rx.tryRecv(); ... }`
        loop {
            // What:     `match rx.try_recv() { ... }`. Non-blocking receive:
            //           `Ok(cmd)` a command, `Err(Empty)` nothing right now,
            //           `Err(Disconnected)` all senders dropped.
            // Why:      Pull commands until the channel is momentarily empty.
            // TS map:   `switch (rx.tryRecv()) { ... }`
            match rx.try_recv() {
                // What:     `Ok(Command::Quit) => { quitting = true; break; }`. Stop
                //           requested: flag it and leave the drain loop.
                // Why:      Begin shutdown.
                // TS map:   `case Quit: quitting = true; break;`
                Ok(Command::Quit) => {
                    quitting = true;
                    break;
                }
                // What:     `Ok(command) => controller.handle_command(command)`. Any
                //           other command: apply it.
                // Why:      React to UI input.
                // TS map:   `default: controller.handleCommand(command);`
                Ok(command) => controller.handle_command(command),
                // What:     `Err(TryRecvError::Empty) => break`. No more commands now.
                // Why:      Move on to pumping audio.
                // TS map:   `case empty: break;`
                Err(TryRecvError::Empty) => break,
                // What:     `Err(TryRecvError::Disconnected) => { quitting = true; break; }`.
                //           The UI dropped the engine; shut down.
                // Why:      Nothing left to serve.
                // TS map:   `case disconnected: quitting = true; break;`
                Err(TryRecvError::Disconnected) => {
                    quitting = true;
                    break;
                }
            }
        }

        // What:     `if quitting { controller.save_session(); break; }`. Persist the
        //           session, then leave the main loop -> `run` returns ->
        //           `controller` (and its `Output`) drops -> PipeWire stops.
        // Why:      Save where the user left off before shutting down.
        // TS map:   `if (quitting) { controller.saveSession(); break; }`
        if quitting {
            controller.save_session();
            break;
        }

        // What:     `let did_work = controller.pump_audio();`. Try to push one
        //           block of audio; returns whether anything happened.
        // Why:      Decide whether to sleep.
        // TS map:   `const didWork = controller.pumpAudio();`
        let did_work = controller.pump_audio();

        // What:     `if !did_work { std::thread::sleep(Duration::from_millis(IDLE_SLEEP_MS)); }`.
        //           When idle (paused / buffer full / no track), sleep briefly.
        // Why:      Avoid burning CPU; commands are still drained next iteration.
        // TS map:   `if (!didWork) await sleep(IDLE_SLEEP_MS);`
        if !did_work {
            std::thread::sleep(Duration::from_millis(IDLE_SLEEP_MS));
        }
    }
}
