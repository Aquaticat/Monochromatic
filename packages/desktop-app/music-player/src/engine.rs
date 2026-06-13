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
//           multi-producer/single-consumer channel: `Sender` pushes, `Receiver` pops,
//           `TryRecvError` reports "empty" vs "all senders gone". `self` also imports
//           the `mpsc` module itself (for `mpsc::channel()`).
// Why:      The UI thread sends `Command`s to this worker thread.
// TS map:   a thread-safe async queue; `Sender.send` ~ `queue.push`, `Receiver.try_recv`
//           ~ a non-blocking `queue.tryPop`.
//
// In TS you'd write (pseudocode):
// ```ts
// // a thread-safe queue split into a Sender (push) and a Receiver (tryPop)
// ```
use std::sync::mpsc::{self, Receiver, Sender, TryRecvError};

// What:     `use std::thread::{self, JoinHandle, Thread};`. `thread::spawn` starts a
//           worker; a `JoinHandle` lets us wait for it to finish; a `Thread` is a cheap,
//           cloneable HANDLE to a running thread (it wraps an internal `Arc`), used here
//           only to call `.unpark()` on the worker. Sibling you might expect: there is no
//           separate "thread id" type you'd pass around; `Thread` is that handle.
// Why:      The engine runs on its own thread, and other threads need a `Thread` handle
//           to wake it from a park (see `park_timeout` in `run`).
// TS map:   `JoinHandle` ~ a Worker plus a promise that resolves when it exits; `Thread`
//           ~ a reference to that Worker you can post a "wake up" to.
//
// In TS you'd write (pseudocode):
// ```ts
// // JoinHandle ~ a Worker + exit promise; Thread ~ a WorkerRef you can post "wake" to
// ```
use std::thread::{self, JoinHandle, Thread};

// What:     `use std::time::Duration;`. A span of time (here, a sleep interval).
// Why:      We sleep briefly when idle to avoid busy-spinning the CPU.
// TS map:   a number of milliseconds passed to `setTimeout`.
//
// In TS you'd write (pseudocode):
// ```ts
// type Duration = number; // milliseconds
// ```
use std::time::Duration;

// What:     `use crate::command::{Command, Update};`. The UI->engine and engine->UI
//           message enums.
// Why:      The channel carries `Command`s; the callback delivers `Update`s.
// TS map:   `import { Command, Update } from "./command";`
//
// In TS you'd write (pseudocode):
// ```ts
// import { Command, Update } from "./command";
// ```
use crate::command::{Command, Update};

// What:     `use crate::controller::Controller;`. The playback state machine.
// Why:      `run` builds one and forwards commands/audio pumping to it.
// TS map:   `import { Controller } from "./controller";`
//
// In TS you'd write (pseudocode):
// ```ts
// import { Controller } from "./controller";
// ```
use crate::controller::Controller;

// What:     `use crate::output::Output;`. The PipeWire output (FFI boundary).
// Why:      `run` tries to create one and hands it to the controller.
// TS map:   `import { Output } from "./output";`
//
// In TS you'd write (pseudocode):
// ```ts
// import { Output } from "./output";
// ```
use crate::output::Output;

// What:     `const IDLE_PARK_FALLBACK_MS: u64 = 100;`. Milliseconds the worker will PARK
//           (block, using ~0 CPU) when there is no audio work this cycle, if nothing
//           wakes it sooner. `u64` (not `u32`/`i64`) is what `Duration::from_millis`
//           wants. The worker is normally woken EARLY by an `unpark()` call: the audio
//           callback unparks it after draining the ring buffer (space freed -> decode
//           more), and command senders unpark it after queueing a command (act on it
//           now). This timeout is only a SAFETY NET in case an `unpark` is ever missed;
//           it caps any stall well under the ~1 second the ring buffer holds, so a missed
//           wake never causes an audio gap.
// Why:      Replaces the old busy-poll: the worker used to skip its sleep whenever a push
//           accepted even one sample, so during playback it spun a whole CPU core.
//           Parking until explicitly woken drops idle CPU to near zero.
// TS map:   no exact equivalent; mentally `await Promise.race([wokenSignal, sleep(100)])`,
//           where `wokenSignal` resolves the instant someone calls `unpark()`.
//
// In TS you'd write (pseudocode):
// ```ts
// const IDLE_PARK_FALLBACK_MS = 100; // ms safety-net before re-checking when idle
// ```
const IDLE_PARK_FALLBACK_MS: u64 = 100;

// What:     `pub struct Engine { ... }`. The handle the UI keeps. It is `Send` (only a
//           channel sender + a thread handle), unlike the controller's internal state.
// Why:      Lets the UI send commands and stop the worker on drop.
// TS map:   `class Engine { tx; handle; }`
//
// In TS you'd write (pseudocode):
// ```ts
// class Engine { tx: Sender<Command>; worker: WorkerRef; handle: ThreadHandle | null; }
// ```
pub struct Engine {
    // What:     `tx: Sender<Command>`. The send end of the command channel.
    // Why:      `send` pushes commands to the worker.
    // TS map:   `tx: Sender<Command>;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // tx: Sender<Command>;
    // ```
    tx: Sender<Command>,
    // What:     `worker: Thread`. A cloneable handle to the worker thread (the one
    //           running `run`). We never join through this; we only call `.unpark()` on
    //           it.
    // Why:      After sending a command we must WAKE the worker, which is otherwise parked
    //           (blocked) when idle; without this the command would sit unhandled until
    //           the fallback timeout fires.
    // TS map:   `worker: WorkerRef;` (a thing you can post "wake up" to)
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // worker: WorkerRef;
    // ```
    worker: Thread,
    // What:     `handle: Option<JoinHandle<()>>`. The worker's join handle, or `None`
    //           after we have joined it. `JoinHandle<()>` = the thread returns nothing.
    // Why:      `Drop` joins the thread so the output cleans up before exit.
    // TS map:   `handle: ThreadHandle | null;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // handle: ThreadHandle | null;
    // ```
    handle: Option<JoinHandle<()>>,
}

// What:     `#[derive(Clone)] pub struct CommandSender { ... }`. A small bundle of the
//           command channel's send end PLUS the worker's `Thread` handle.
//           `#[derive(Clone)]` auto-generates a `.clone()` that clones both fields (both
//           are cheap: a `Sender` clone shares the channel, a `Thread` clone bumps an
//           internal refcount).
// Why:      Threads other than the UI (the file-picker thread) need to send commands AND
//           wake the worker. Handing out a bare `Sender` would let them queue a command
//           without unparking, so it would not be acted on until the timeout.
// TS map:   `class CommandSender { tx; worker; clone() {...} }`
//
// In TS you'd write (pseudocode):
// ```ts
// class CommandSender { tx: Sender<Command>; worker: WorkerRef; }
// ```
#[derive(Clone)]
pub struct CommandSender {
    // What:     `tx: Sender<Command>`. The send end of the command channel.
    // Why:      The picker thread pushes `OpenPaths` through it.
    // TS map:   `tx: Sender<Command>;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // tx: Sender<Command>;
    // ```
    tx: Sender<Command>,
    // What:     `worker: Thread`. The same worker handle `Engine` holds.
    // Why:      Wake the worker after queueing a command.
    // TS map:   `worker: WorkerRef;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // worker: WorkerRef;
    // ```
    worker: Thread,
}

// What:     `impl CommandSender { ... }`. Its one method.
// Why:      Mirror `Engine::send` for off-UI threads.
// TS map:   the class body.
//
// In TS you'd write (pseudocode):
// ```ts
// class CommandSender { send(command: Command): void { ... } }
// ```
impl CommandSender {
    // What:     `pub fn send(&self, command: Command)`. Queue a command, then wake the
    //           worker. Read-only borrow of self.
    // Why:      Same contract as `Engine::send`, usable from another OS thread.
    // TS map:   `send(command: Command): void`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // send(command: Command): void { ... }
    // ```
    pub fn send(&self, command: Command) {
        // What:     `let _ = self.tx.send(command);`. `send` returns a `Result` that errs
        //           only if the worker is gone; `let _ =` DISCARDS it.
        // Why:      A dead worker during shutdown is not worth surfacing.
        // TS map:   `try { this.tx.send(command); } catch {}`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // try { this.tx.send(command); } catch {}
        // ```
        let _ = self.tx.send(command);
        // What:     `self.worker.unpark();`. Wake the worker if it is parked; if it is not
        //           parked yet, this leaves a one-shot "permit" so its next `park` returns
        //           immediately (so the wake is never lost).
        // Why:      Make the worker act on the command now, not after the timeout.
        // TS map:   `this.worker.postWakeUp();`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.worker.postWakeUp();
        // ```
        self.worker.unpark();
    }
}

// What:     `impl Engine { ... }`. The handle's methods.
// Why:      Construction and command sending.
// TS map:   the class body.
//
// In TS you'd write (pseudocode):
// ```ts
// class Engine { /* spawn, sender, send */ }
// ```
impl Engine {
    // What:     `pub fn spawn<F>(on_update: F) -> Engine where F: Fn(Update) + Send + 'static`.
    //           Start the worker. `F` is the callback type; the WHERE clause requires it
    //           be callable repeatedly (`Fn`), movable to another thread (`Send`), and own
    //           no short-lived borrows (`'static`).
    // Why:      The UI passes a closure that forwards updates to the Slint loop.
    // TS map:   `static spawn(onUpdate: (u: Update) => void): Engine`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // static spawn(onUpdate: (u: Update) => void): Engine { ... }
    // ```
    pub fn spawn<F>(on_update: F) -> Engine
    where
        F: Fn(Update) + Send + 'static,
    {
        // What:     `let (tx, rx) = mpsc::channel::<Command>();`. Create the channel;
        //           destructure into sender `tx` and receiver `rx`. `::<Command>` is the
        //           turbofish pinning the element type.
        // Why:      The link between UI and worker.
        // TS map:   `const { tx, rx } = makeChannel<Command>();`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const { tx, rx } = makeChannel<Command>();
        // ```
        let (tx, rx) = mpsc::channel::<Command>();

        // What:     `let callback: Box<dyn Fn(Update) + Send> = Box::new(on_update);`.
        //           `Box::new(...)` moves the callback onto the heap as a TRAIT OBJECT
        //           (`dyn Fn(...)`), so the worker can store one fixed type regardless of
        //           the concrete `F`. Sibling: `Rc`/`Arc` would add sharing we do not need.
        // Why:      Erase `F` to a uniform callback type.
        // TS map:   `const callback = onUpdate;` (TS functions are already boxed)
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const callback = onUpdate; // TS functions are already "boxed"
        // ```
        let callback: Box<dyn Fn(Update) + Send> = Box::new(on_update);

        // What:     `let self_tx = tx.clone();`. A second sender clone moved into the worker.
        // Why:      The worker builds a `CommandSender` from it so the file watcher can inject
        //           `Command::Rescan` back into this same channel.
        // TS map:   `const selfTx = tx; // clone of the same channel sender`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const selfTx = tx; // same channel, second handle
        // ```
        let self_tx = tx.clone();

        // What:     `let handle = thread::spawn(move || run(rx, callback, self_tx));`.
        //           `thread::spawn` starts the worker; the `move` closure takes ownership of
        //           `rx`, `callback`, and `self_tx` and runs `run(...)` on the new thread.
        // Why:      Decode/playback happens off the UI thread; the worker also owns the
        //           self-sender used to wire the watcher.
        // TS map:   `const handle = startWorker(() => run(rx, callback, selfTx));`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const handle = startWorker(() => run(rx, callback, selfTx));
        // ```
        let handle = thread::spawn(move || run(rx, callback, self_tx));

        // What:     `let worker = handle.thread().clone();`. `handle.thread()` borrows the
        //           spawned thread's `Thread` handle (`&Thread`); `.clone()` makes an owned
        //           copy (bumps an internal refcount, does not copy the thread).
        // Why:      Store a handle we can `unpark()` to wake the worker after sending a
        //           command. It refers to the SAME thread that `run` sees via
        //           `thread::current()`.
        // TS map:   `const worker = handle.workerRef;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const worker = handle.workerRef;
        // ```
        let worker = handle.thread().clone();

        // What:     `Engine { tx, worker, handle: Some(handle) }`. Build the handle (field
        //           shorthand for `tx`/`worker`). `Some(handle)` wraps the join handle so
        //           `Drop` can `.take()` it. Tail -> return.
        // Why:      Hand the UI its control surface.
        // TS map:   `return new Engine(tx, worker, handle);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return new Engine(tx, worker, handle);
        // ```
        Engine {
            tx,
            worker,
            handle: Some(handle),
        }
    }

    // What:     `pub fn sender(&self) -> CommandSender`. Hand out a `CommandSender` (a
    //           CLONE of the channel's send end bundled with the worker `Thread` handle).
    //           Both inner parts are `Send`, so the bundle can be moved to another OS
    //           thread (the file-picker thread).
    // Why:      The file dialog runs on its own thread and must send `OpenPaths` back AND
    //           wake the worker; it cannot hold the `!Send` `Rc<Engine>` the UI uses.
    //           Returning the bundle (not a bare `Sender`) guarantees that off-UI sends
    //           also unpark the worker.
    // TS map:   `sender(): CommandSender` (a thread-safe queue handle that also wakes)
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // sender(): CommandSender { return new CommandSender(this.tx.clone(), this.worker); }
    // ```
    pub fn sender(&self) -> CommandSender {
        // What:     `CommandSender { tx: self.tx.clone(), worker: self.worker.clone() }`.
        //           `self.tx.clone()` duplicates the sender (both refer to the same
        //           channel); `self.worker.clone()` duplicates the worker handle (refcount
        //           bump). Tail -> return.
        // Why:      Give the caller its own send-and-wake handle.
        // TS map:   `return new CommandSender(this.tx.clone(), this.worker);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return new CommandSender(this.tx.clone(), this.worker);
        // ```
        CommandSender {
            tx: self.tx.clone(),
            worker: self.worker.clone(),
        }
    }

    // What:     `pub fn send(&self, command: Command)`. Forward a command to the worker.
    //           Read-only borrow of self.
    // Why:      The UI's only way to control playback.
    // TS map:   `send(command: Command): void`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // send(command: Command): void { ... }
    // ```
    pub fn send(&self, command: Command) {
        // What:     `let _ = self.tx.send(command);`. `send` returns a `Result` that errs
        //           only if the worker is gone; `let _ =` DISCARDS it.
        // Why:      A dead worker during shutdown is not worth surfacing.
        // TS map:   `try { this.tx.send(command); } catch {}`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // try { this.tx.send(command); } catch {}
        // ```
        let _ = self.tx.send(command);
        // What:     `self.worker.unpark();`. Wake the parked worker; if it is not parked
        //           yet, this leaves a one-shot permit so its next `park` returns
        //           immediately (the wake is never lost).
        // Why:      Act on the command now instead of after the fallback timeout.
        // TS map:   `this.worker.postWakeUp();`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.worker.postWakeUp();
        // ```
        self.worker.unpark();
    }
}

// What:     `impl Drop for Engine { ... }`. Cleanup when the UI drops the engine. `Drop`
//           is the destructor trait; its `drop` runs at end of scope.
// Why:      Tell the worker to quit and wait for it, so PipeWire shuts down.
// TS map:   a `dispose()` that stops the worker.
//
// In TS you'd write (pseudocode):
// ```ts
// class Engine { [Symbol.dispose]() { /* stop + join worker */ } }
// ```
impl Drop for Engine {
    // What:     `fn drop(&mut self)`. Runs at end of life. `&mut self` because it tears the
    //           engine down.
    // Why:      Graceful shutdown.
    // TS map:   `[Symbol.dispose]() { ... }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // [Symbol.dispose]() { ... }
    // ```
    fn drop(&mut self) {
        // What:     `let _ = self.tx.send(Command::Quit);`. Ask the worker to stop; ignore
        //           the error if it already exited.
        // Why:      Break the worker's loop.
        // TS map:   `try { this.tx.send(Command.Quit); } catch {}`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // try { this.tx.send(Command.Quit); } catch {}
        // ```
        let _ = self.tx.send(Command::Quit);

        // What:     `self.worker.unpark();`. Wake the worker if it is parked, so it sees the
        //           `Quit` immediately rather than after the timeout.
        // Why:      Make shutdown prompt.
        // TS map:   `this.worker.postWakeUp();`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.worker.postWakeUp();
        // ```
        self.worker.unpark();

        // What:     `if let Some(handle) = self.handle.take() { let _ = handle.join(); }`.
        //           `.take()` moves the handle out (leaving `None`); `join()` waits for the
        //           worker to finish; `let _ =` ignores a panic result.
        // Why:      Ensure the output (and PipeWire) is fully torn down before exit.
        // TS map:   `if (this.handle) { await this.handle; this.handle = null; }`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (this.handle) { await this.handle; this.handle = null; }
        // ```
        if let Some(handle) = self.handle.take() {
            let _ = handle.join();
        }
    }
}

// What:     `fn run(rx: Receiver<Command>, on_update: Box<dyn Fn(Update) + Send>)`. The
//           worker's entry point: set up state, then loop handling commands and pumping
//           audio until told to quit. `Box<dyn Fn(...)>` is the heap-boxed callback trait
//           object.
// Why:      Everything playback-related lives on this one thread.
// TS map:   `function run(rx: Receiver<Command>, onUpdate: (u: Update) => void): void`
//
// In TS you'd write (pseudocode):
// ```ts
// function run(rx: Receiver<Command>, onUpdate: (u: Update) => void): void { ... }
// ```
fn run(
    rx: Receiver<Command>,
    on_update: Box<dyn Fn(Update) + Send>,
    self_tx: Sender<Command>,
) {
    // What:     `let output = match Output::new(thread::current()) { ... };`. Try to start
    //           PipeWire, handing it a handle to THIS thread. `thread::current()` returns
    //           the running thread's `Thread` handle; it is the same thread `Engine`
    //           stored via `handle.thread()`. On failure we log and run WITHOUT audio (the
    //           UI still works).
    // Why:      Never crash the app if audio init fails; the output keeps the handle so its
    //           realtime callback can `unpark()` us when the ring buffer drains.
    // TS map:   `let output; try { output = Output.create(currentWorkerRef); } catch (e) { console.error(e); output = null; }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let output;
    // try { output = Output.create(currentWorkerRef); } catch (e) { console.error(e); output = null; }
    // ```
    let output = match Output::new(thread::current()) {
        // What:     `Ok(o) => Some(o)`. Audio is available; wrap it as present.
        // Why:      Keep the output.
        // TS map:   `output = o;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // output = o;
        // ```
        Ok(o) => Some(o),
        // What:     `Err(e) => { eprintln!(...); None }`. `eprintln!` writes to stderr;
        //           `{e}` uses `PlayerError`'s Display. The block's tail `None` becomes the
        //           match value (silent mode).
        // Why:      Degrade gracefully to silent mode.
        // TS map:   `console.error(...); output = null;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // console.error("music-player: audio init failed:", e); output = null;
        // ```
        Err(e) => {
            eprintln!("music-player: audio init failed: {e}");
            None
        }
    };

    // What:     `let mut controller = Controller::new(on_update, output);`. Build the
    //           mutable controller state. `mut` because the loop mutates it.
    // Why:      Holds the queue, source, producer, and flags across the loop.
    // TS map:   `const controller = new Controller(onUpdate, output);`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const controller = new Controller(onUpdate, output);
    // ```
    let mut controller = Controller::new(on_update, output);

    // What:     `let self_sender = CommandSender { tx: self_tx, worker: thread::current() };`.
    //           Bundle the self-sender with THIS worker thread's handle. `thread::current()`
    //           on the worker thread is the same thread the run loop parks on, so a watcher
    //           send both enqueues `Rescan` and unparks us.
    // Why:      The file watcher needs a send-and-wake handle to inject `Rescan`.
    // TS map:   `const selfSender = new CommandSender(selfTx, currentWorkerRef);`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const selfSender = new CommandSender(selfTx, currentWorkerRef);
    // ```
    let self_sender = CommandSender {
        tx: self_tx,
        worker: thread::current(),
    };
    // What:     `controller.watcher = crate::watch::SourceWatcher::new(move || self_sender.send(Command::Rescan));`.
    //           Create the file watcher (or `None` if the OS watcher fails) with a change
    //           callback that enqueues `Rescan` and wakes this worker. The closure owns
    //           `self_sender`.
    // Why:      Once attached, every open/restore re-points it at the current Source Root, so
    //           on-disk changes drive live `Rescan`s; the watcher itself stays engine-agnostic.
    // TS map:   `controller.watcher = SourceWatcher.new(() => selfSender.send(Command.Rescan));`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // controller.watcher = SourceWatcher.new(() => selfSender.send(Command.Rescan));
    // ```
    controller.watcher = crate::watch::SourceWatcher::new(move || self_sender.send(Command::Rescan));

    // What:     `loop { ... }`. The main worker loop (Rust's `while (true)`); we `break` on
    //           quit.
    // Why:      Keep handling commands and feeding audio.
    // TS map:   `while (true) { ... }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // while (true) { ... }
    // ```
    loop {
        // What:     `let mut quitting = false;`. Flag set when a quit/disconnect is seen
        //           while draining commands.
        // Why:      Break the outer loop after the drain.
        // TS map:   `let quitting = false;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // let quitting = false;
        // ```
        let mut quitting = false;

        // What:     `loop { ... }`. Inner loop: drain ALL queued commands without blocking,
        //           so the UI feels responsive.
        // Why:      Apply every pending command before decoding more audio.
        // TS map:   `while (true) { const r = rx.tryRecv(); ... }`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // while (true) { const r = rx.tryRecv(); ... }
        // ```
        loop {
            // What:     `match rx.try_recv() { ... }`. Non-blocking receive: `Ok(cmd)` a
            //           command, `Err(Empty)` nothing right now, `Err(Disconnected)` all
            //           senders dropped.
            // Why:      Pull commands until the channel is momentarily empty.
            // TS map:   `switch (rx.tryRecv()) { ... }`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // switch (rx.tryRecv()) { ... }
            // ```
            match rx.try_recv() {
                // What:     `Ok(Command::Quit) => { quitting = true; break; }`. Stop
                //           requested: flag it and leave the drain loop.
                // Why:      Begin shutdown.
                // TS map:   `case Quit: quitting = true; break;`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // case Quit: quitting = true; break;
                // ```
                Ok(Command::Quit) => {
                    quitting = true;
                    break;
                }
                // What:     `Ok(command) => controller.handle_command(command)`. Any other
                //           command: apply it.
                // Why:      React to UI input.
                // TS map:   `default: controller.handleCommand(command);`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // default: controller.handleCommand(command);
                // ```
                Ok(command) => controller.handle_command(command),
                // What:     `Err(TryRecvError::Empty) => break`. No more commands now.
                // Why:      Move on to pumping audio.
                // TS map:   `case empty: break;`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // case empty: break;
                // ```
                Err(TryRecvError::Empty) => break,
                // What:     `Err(TryRecvError::Disconnected) => { quitting = true; break; }`.
                //           The UI dropped the engine; shut down.
                // Why:      Nothing left to serve.
                // TS map:   `case disconnected: quitting = true; break;`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // case disconnected: quitting = true; break;
                // ```
                Err(TryRecvError::Disconnected) => {
                    quitting = true;
                    break;
                }
            }
        }

        // What:     `if quitting { controller.save_session(); break; }`. Persist the
        //           session, then leave the main loop -> `run` returns -> `controller` (and
        //           its `Output`) drops -> PipeWire stops.
        // Why:      Save where the user left off before shutting down.
        // TS map:   `if (quitting) { controller.saveSession(); break; }`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (quitting) { controller.saveSession(); break; }
        // ```
        if quitting {
            controller.save_session();
            break;
        }

        // What:     `let applied_peak = controller.poll_pending_peak();`. Poll any
        //           in-flight current-track peak measurement without blocking.
        // Why:      If a measured gain landed, apply it before decoding the next audio
        //           chunk so future samples use exact normalization.
        // TS map:   `const appliedPeak = controller.pollPendingPeak();`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const appliedPeak = controller.pollPendingPeak();
        // ```
        let applied_peak = controller.poll_pending_peak();
        // What:     `let did_work = controller.pump_audio();`. Try to push one block of
        //           audio; returns whether anything happened.
        // Why:      Decide whether to sleep.
        // TS map:   `const didWork = controller.pumpAudio();`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const didWork = controller.pumpAudio();
        // ```
        let did_work = controller.pump_audio();

        // What:     `if !applied_peak && !did_work { thread::park_timeout(Duration::from_millis(IDLE_PARK_FALLBACK_MS)); }`.
        //           When neither a peak swap nor audio pumping did work, PARK: block the
        //           thread (using ~0 CPU) until someone calls `unpark()` on this thread,
        //           or the timeout elapses, whichever comes first. `park_timeout` also
        //           returns immediately if an `unpark` permit was already left while we
        //           were busy, so a wake racing with this call is never lost.
        // Why:      Peak application counts as work because the next loop should observe
        //           fresh state immediately; otherwise the audio callback unparks us when
        //           it drains the ring buffer and command senders unpark us when they queue
        //           work. Blocking instead of looping is what stops the worker from pegging
        //           a CPU core; the timeout is only a safety net.
        // TS map:   `if (!appliedPeak && !didWork) await Promise.race([wokenSignal, sleep(100)]);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (!appliedPeak && !didWork) await Promise.race([wokenSignal, sleep(IDLE_PARK_FALLBACK_MS)]);
        // ```
        if !applied_peak && !did_work {
            thread::park_timeout(Duration::from_millis(IDLE_PARK_FALLBACK_MS));
        }
    }
}
