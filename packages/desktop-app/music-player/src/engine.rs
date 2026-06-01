//! Engine: the controller thread. It owns the queue, the active decoder, and
//! the PipeWire `Output`, and turns UI `Command`s into playback while pushing
//! `Update`s back to the UI.
//!
//! Threads, for a TypeScript reader: `Engine::spawn` starts a background worker
//! (`std::thread`). The UI talks to it through a one-way queue of `Command`s
//! (an `mpsc` channel: many senders, one receiver). The worker replies by
//! calling an `on_update` callback the UI supplied. The PipeWire output runs its
//! OWN thread internally; this controller thread only decodes and pushes samples
//! into the ring buffer the output hands back.

// What:     `use std::path::{Path, PathBuf};`. `Path` is a borrowed path view;
//           `PathBuf` is the owned, growable version (like `&str` vs `String`).
// Why:      We hold owned paths in the queue and borrow them to open files.
// TS map:   both are just `string` in TS.
use std::path::{Path, PathBuf};

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

// What:     `use ringbuf::traits::Producer;`. Brings `push_slice` into scope for
//           the producer half of the ring buffer.
// Why:      We push decoded samples into the buffer the output gave us.
// TS map:   importing the interface whose `pushSlice` we call.
use ringbuf::traits::Producer;

// What:     `use ringbuf::HeapProd;`. The WRITE half of a heap ring buffer.
// Why:      The field type for the producer the output returns.
// TS map:   `type HeapProd<T> = RingProducer<T>;`
use ringbuf::HeapProd;

// What:     `use crate::command::{Command, Update};`. The UI->engine and
//           engine->UI message enums.
// Why:      We match `Command`s and emit `Update`s.
// TS map:   `import { Command, Update } from "./command";`
use crate::command::{Command, Update};

// What:     `use crate::decode::{AudioSpec, Source};`. `AudioSpec` describes a
//           decoded stream; `Source` is the decoder trait (its methods are in
//           scope so we can call `next_chunk`/`seek`/`spec` on a `Box<dyn Source>`).
// Why:      We hold and drive a decode source.
// TS map:   `import { AudioSpec, Source } from "./decode";`
use crate::decode::{AudioSpec, Source};

// What:     `use crate::output::Output;`. The PipeWire output (FFI boundary).
// Why:      We create one and reconfigure it per track.
// TS map:   `import { Output } from "./output";`
use crate::output::Output;

// What:     `use crate::queue::Queue;`. The pure play-queue model.
// Why:      The engine owns one and asks it what to play next.
// TS map:   `import { Queue } from "./queue";`
use crate::queue::Queue;

// What:     `use crate::session::Session;`. The serializable saved-state record.
// Why:      The engine builds one on quit and saves it to disk.
// TS map:   `import { Session } from "./session";`
use crate::session::Session;

// What:     `const IDLE_SLEEP_MS: u64 = 5;`. Milliseconds to sleep when there is
//           no audio work this cycle. `u64` is what `Duration::from_millis` wants.
// Why:      Avoid pegging a CPU core while paused or buffer-full.
// TS map:   `const IDLE_SLEEP_MS = 5;`
const IDLE_SLEEP_MS: u64 = 5;

// What:     `const POSITION_EMIT_INTERVAL_SECS: f64 = 0.1;`. Minimum seconds of
//           progress between `Position` updates to the UI. `f64` matches the
//           seconds-as-f64 time contract.
// Why:      Throttle position updates to ~10/second instead of per buffer.
// TS map:   `const POSITION_EMIT_INTERVAL_SECS = 0.1;`
const POSITION_EMIT_INTERVAL_SECS: f64 = 0.1;

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

// What:     `struct Controller { ... }`. All mutable playback state, owned by the
//           worker thread. Not `Send` (it holds the `!Send` `Output`), which is
//           fine because it never leaves this thread.
// Why:      Bundle the state so methods can mutate it.
// TS map:   `class Controller { ... }`
struct Controller {
    // What:     `on_update: Box<dyn Fn(Update) + Send>`. The UI callback.
    // Why:      Push state changes back to the UI.
    // TS map:   `onUpdate: (u: Update) => void;`
    on_update: Box<dyn Fn(Update) + Send>,
    // What:     `output: Option<Output>`. The PipeWire output, or `None` in
    //           silent mode.
    // Why:      Reconfigured per track; absent if audio init failed.
    // TS map:   `output: Output | null;`
    output: Option<Output>,
    // What:     `queue: Queue`. The play-queue model.
    // Why:      Decides track order and current track.
    // TS map:   `queue: Queue;`
    queue: Queue,
    // What:     `source: Option<Box<dyn Source>>`. The active decoder, or `None`.
    // Why:      Produces the PCM we push.
    // TS map:   `source: Source | null;`
    source: Option<Box<dyn Source>>,
    // What:     `producer: Option<HeapProd<f32>>`. The ring-buffer write end for
    //           the current stream, or `None`.
    // Why:      Where decoded samples go.
    // TS map:   `producer: RingProducer | null;`
    producer: Option<HeapProd<f32>>,
    // What:     `spec: Option<AudioSpec>`. The current track's rate/channels/duration.
    // Why:      Drives position math and reconfigure calls.
    // TS map:   `spec: AudioSpec | null;`
    spec: Option<AudioSpec>,
    // What:     `playing: bool`. Whether we are actively feeding audio.
    // Why:      Pause/play gate.
    // TS map:   `playing: boolean;`
    playing: bool,
    // What:     `volume: f32`. Linear gain 0.0..=1.0 applied to samples.
    // Why:      Volume control (PCM-gain approach).
    // TS map:   `volume: number;`
    volume: f32,
    // What:     `position_frames: u64`. Frames pushed for the current track so
    //           far. `u64` because long tracks exceed `u32` frame counts.
    // Why:      Position seconds = frames / rate.
    // TS map:   `positionFrames: number;`
    position_frames: u64,
    // What:     `last_emit_secs: f64`. Position (seconds) at the last `Position`
    //           update we emitted.
    // Why:      Throttle update frequency.
    // TS map:   `lastEmitSecs: number;`
    last_emit_secs: f64,
    // What:     `pending: Vec<f32>`. Gained samples decoded but not yet fully
    //           pushed (the ring buffer was full).
    // Why:      Resume pushing them next cycle instead of dropping audio.
    // TS map:   `pending: number[];`
    pending: Vec<f32>,
    // What:     `pending_pos: usize`. How many of `pending` are already pushed.
    // Why:      Push the remainder `pending[pending_pos..]` next time.
    // TS map:   `pendingPos: number;`
    pending_pos: usize,
}

// What:     `impl Controller { ... }`. The controller's behaviour.
// Why:      Command handling, loading, and audio pumping.
// TS map:   the class body.
impl Controller {
    // What:     `fn new(on_update: Box<dyn Fn(Update) + Send>, output: Option<Output>) -> Controller`.
    //           Build initial state (empty queue, nothing playing, full volume).
    // Why:      Starting point for the worker.
    // TS map:   `constructor(onUpdate, output)`
    fn new(on_update: Box<dyn Fn(Update) + Send>, output: Option<Output>) -> Controller {
        // What:     `Controller { ... }`. Struct literal with initial values.
        //           `Queue::new()` builds an empty queue; volume starts at `1.0`.
        // Why:      A clean idle state.
        // TS map:   `return new Controller(...);`
        Controller {
            on_update,
            output,
            queue: Queue::new(),
            source: None,
            producer: None,
            spec: None,
            playing: false,
            volume: 1.0,
            position_frames: 0,
            last_emit_secs: 0.0,
            pending: Vec::new(),
            pending_pos: 0,
        }
    }

    // What:     `fn emit(&self, update: Update)`. Call the UI callback.
    // Why:      One place to push updates out.
    // TS map:   `emit(update) { this.onUpdate(update); }`
    fn emit(&self, update: Update) {
        // What:     `(self.on_update)(update);`. Call the boxed closure with the
        //           update. The parens around `self.on_update` are needed to call
        //           the field rather than a method.
        // Why:      Deliver the update to the UI.
        // TS map:   `this.onUpdate(update);`
        (self.on_update)(update);
    }

    // What:     `fn set_playing(&mut self, on: bool)`. Set the flag and tell the UI.
    // Why:      Keep the play/pause button in sync.
    // TS map:   `setPlaying(on) { this.playing = on; this.emit({kind:"playing",on}); }`
    fn set_playing(&mut self, on: bool) {
        // What:     `self.playing = on;`. Update the gate.
        // Why:      Pump respects it.
        // TS map:   `this.playing = on;`
        self.playing = on;
        // What:     `if let Some(output) = self.output.as_ref() { output.set_playing(on); }`.
        //           Tell the audio output too (no-op in silent mode). `.as_ref()`
        //           borrows the `Option<Output>` as `Option<&Output>` so we can
        //           call a method without taking ownership.
        // Why:      Lets the realtime callback react instantly: on pause it stops
        //           draining the ring buffer and emits silence, so the buffered
        //           ~1 second of audio does NOT keep playing (the pause-delay bug).
        // TS map:   `this.output?.setPlaying(on);`
        if let Some(output) = self.output.as_ref() {
            output.set_playing(on);
        }
        // What:     `self.emit(Update::Playing(on));`. Mirror to the UI.
        // Why:      Visual state.
        // TS map:   `this.emit({ kind: "playing", on });`
        self.emit(Update::Playing(on));
    }

    // What:     `fn current_session(&self) -> Session`. Snapshot the playback
    //           state into a serializable `Session`.
    // Why:      Persist where the user left off.
    // TS map:   `currentSession(): Session`
    fn current_session(&self) -> Session {
        // What:     `let position_secs = match &self.spec { ... };`. Convert the
        //           frame counter to seconds using the current rate, or 0 if
        //           unknown.
        // Why:      The session stores seconds, not frames.
        // TS map:   `const positionSecs = this.spec?.rate ? this.positionFrames / this.spec.rate : 0;`
        let position_secs = match &self.spec {
            // What:     `Some(spec) if spec.rate > 0 => self.position_frames as f64 / spec.rate as f64`.
            //           Guarded arm: a known, positive rate.
            // Why:      seconds = frames / rate.
            // TS map:   `return this.positionFrames / spec.rate;`
            Some(spec) if spec.rate > 0 => self.position_frames as f64 / spec.rate as f64,
            // What:     `_ => 0.0`. No spec or zero rate.
            // Why:      Unknown position.
            // TS map:   `return 0;`
            _ => 0.0,
        };
        // What:     `Session { ... }`. Build the record from the queue + state.
        //           `self.queue.tracks().to_vec()` clones the borrowed paths into
        //           an owned `Vec`. Tail expression -> return.
        // Why:      Bundle everything the next launch needs.
        // TS map:   `return { tracks: [...this.queue.tracks()], current: ..., ... };`
        Session {
            tracks: self.queue.tracks().to_vec(),
            current: self.queue.current_index(),
            position_secs,
            volume: self.volume,
            shuffle: self.queue.shuffle_on(),
            repeat: self.queue.repeat(),
        }
    }

    // What:     `fn save_session(&self)`. Write the current session to disk,
    //           logging (not propagating) any I/O error.
    // Why:      Called on quit; a failed save should not block shutdown.
    // TS map:   `saveSession(): void`
    fn save_session(&self) {
        // What:     `if let Err(e) = self.current_session().save() { ... }`. `save`
        //           returns `io::Result<()>`; on `Err` we log it.
        // Why:      Best-effort persistence.
        // TS map:   `try { currentSession().save(); } catch (e) { console.error(e); }`
        if let Err(e) = self.current_session().save() {
            eprintln!("music-player: session save failed: {e}");
        }
    }

    // What:     `fn handle_command(&mut self, command: Command)`. Apply one UI
    //           command to the state.
    // Why:      The core of UI control.
    // TS map:   `handleCommand(command: Command): void`
    fn handle_command(&mut self, command: Command) {
        // What:     `match command { ... }`. Dispatch on the command variant.
        // Why:      Each command does a different thing.
        // TS map:   `switch (command.kind) { ... }`
        match command {
            // What:     `Command::OpenPaths(paths) => { ... }`. Set the queue to the
            //           given files/folders and start playing the first.
            // Why:      Opening files replaces the queue (ad-hoc queue model).
            // TS map:   `case "openPaths": ...`
            Command::OpenPaths(paths) => {
                // What:     `let tracks = expand_paths(paths);`. Turn folders into
                //           their contained files; pass files through.
                // Why:      The queue holds files, not directories.
                // TS map:   `const tracks = expandPaths(paths);`
                let tracks = expand_paths(paths);
                // What:     `self.queue.set_tracks(tracks);`. Replace the queue.
                // Why:      New playlist.
                // TS map:   `this.queue.setTracks(tracks);`
                self.queue.set_tracks(tracks);
                // What:     `self.emit(Update::Queue(self.queue.display_names()));`.
                //           Send the filename list to the UI.
                // Why:      Render the queue list.
                // TS map:   `this.emit({ kind: "queue", names: this.queue.displayNames() });`
                self.emit(Update::Queue(self.queue.display_names()));
                // What:     `if self.queue.current_path().is_some() { ... } else { ... }`.
                //           Play the first track if the queue is non-empty.
                // Why:      Opening should start playback.
                // TS map:   `if (this.queue.currentPath()) { ... } else { ... }`
                if self.queue.current_path().is_some() {
                    // What:     `let ok = self.load_current();`. Load the current
                    //           track; `ok` is whether a decoder was opened.
                    // Why:      Start decoding it.
                    // TS map:   `const ok = this.loadCurrent();`
                    let ok = self.load_current();
                    // What:     `self.set_playing(ok);`. Play if loaded, else stop.
                    // Why:      Reflect whether playback actually started.
                    // TS map:   `this.setPlaying(ok);`
                    self.set_playing(ok);
                } else {
                    // What:     `self.set_playing(false);`. Empty queue -> stopped.
                    // Why:      Nothing to play.
                    // TS map:   `this.setPlaying(false);`
                    self.set_playing(false);
                }
            }
            // What:     `Command::TogglePlay => self.set_playing(!self.playing)`.
            //           Flip the play/pause state.
            // Why:      The play/pause button.
            // TS map:   `case "togglePlay": this.setPlaying(!this.playing);`
            Command::TogglePlay => self.set_playing(!self.playing),
            // What:     `Command::Play => self.set_playing(true)`.
            // Why:      Explicit play.
            // TS map:   `case "play": this.setPlaying(true);`
            Command::Play => self.set_playing(true),
            // What:     `Command::Pause => self.set_playing(false)`.
            // Why:      Explicit pause.
            // TS map:   `case "pause": this.setPlaying(false);`
            Command::Pause => self.set_playing(false),
            // What:     `Command::Next => self.skip_to(self.queue.advance(false))`.
            //           Advance the queue (not a natural end) and load the result.
            // Why:      Next button.
            // TS map:   `case "next": this.skipTo(this.queue.advance(false));`
            Command::Next => {
                // What:     `let moved = self.queue.advance(false);`. Step forward;
                //           `Some` = there is a next track, `None` = end.
                // Why:      Decide whether to load or stop.
                // TS map:   `const moved = this.queue.advance(false);`
                let moved = self.queue.advance(false);
                // What:     `self.after_move(moved);`. Load the new current or stop.
                // Why:      Shared follow-up logic.
                // TS map:   `this.afterMove(moved);`
                self.after_move(moved);
            }
            // What:     `Command::Prev => { ... }`. Step backward and load.
            // Why:      Previous button.
            // TS map:   `case "prev": ...`
            Command::Prev => {
                // What:     `let moved = self.queue.prev();`. Step back.
                // Why:      Get the previous track index, if any.
                // TS map:   `const moved = this.queue.prev();`
                let moved = self.queue.prev();
                // What:     `self.after_move(moved);`. Load or stop.
                // Why:      Shared follow-up.
                // TS map:   `this.afterMove(moved);`
                self.after_move(moved);
            }
            // What:     `Command::PlayIndex(index) => { ... }`. Jump to a queue slot
            //           and play it.
            // Why:      Click-to-play in the queue list.
            // TS map:   `case "playIndex": ...`
            Command::PlayIndex(index) => {
                // What:     `if self.queue.play_index(index).is_some() { ... }`. Only
                //           act if the index is valid.
                // Why:      Ignore out-of-range clicks.
                // TS map:   `if (this.queue.playIndex(index) != null) { ... }`
                if self.queue.play_index(index).is_some() {
                    // What:     `let ok = self.load_current();`. Load the chosen track.
                    // Why:      Start it.
                    // TS map:   `const ok = this.loadCurrent();`
                    let ok = self.load_current();
                    // What:     `self.set_playing(ok);`. Play if loaded.
                    // Why:      Reflect success.
                    // TS map:   `this.setPlaying(ok);`
                    self.set_playing(ok);
                }
            }
            // What:     `Command::Seek(secs) => self.seek(secs)`. Jump within the
            //           current track.
            // Why:      Seek bar drag.
            // TS map:   `case "seek": this.seek(secs);`
            Command::Seek(secs) => self.seek(secs),
            // What:     `Command::SetVolume(v) => { self.volume = v; self.emit(...); }`.
            //           Update the gain and mirror it.
            // Why:      Volume slider.
            // TS map:   `case "setVolume": this.volume = v; this.emit({kind:"volume",v});`
            Command::SetVolume(v) => {
                // What:     `self.volume = v;`. Store the new gain.
                // Why:      Applied to subsequently decoded samples.
                // TS map:   `this.volume = v;`
                self.volume = v;
                // What:     `self.emit(Update::Volume(v));`. Mirror to the UI.
                // Why:      Keep the slider in sync.
                // TS map:   `this.emit({ kind: "volume", v });`
                self.emit(Update::Volume(v));
            }
            // What:     `Command::SetShuffle(on) => { ... }`. Toggle shuffle and
            //           mirror it.
            // Why:      Shuffle button.
            // TS map:   `case "setShuffle": ...`
            Command::SetShuffle(on) => {
                // What:     `self.queue.set_shuffle(on);`. Reorder play order while
                //           keeping the current track.
                // Why:      Apply shuffle.
                // TS map:   `this.queue.setShuffle(on);`
                self.queue.set_shuffle(on);
                // What:     `self.emit(Update::Shuffle(on));`. Mirror state.
                // Why:      Button visual.
                // TS map:   `this.emit({ kind: "shuffle", on });`
                self.emit(Update::Shuffle(on));
            }
            // What:     `Command::SetRepeat(mode) => { ... }`. Change repeat mode.
            // Why:      Repeat button.
            // TS map:   `case "setRepeat": ...`
            Command::SetRepeat(mode) => {
                // What:     `self.queue.set_repeat(mode);`. Apply it to the queue.
                // Why:      Affects natural-end behaviour.
                // TS map:   `this.queue.setRepeat(mode);`
                self.queue.set_repeat(mode);
                // What:     `self.emit(Update::Repeat(mode));`. Mirror state.
                //           `mode` is `Copy`, so passing it twice is fine.
                // Why:      Button visual.
                // TS map:   `this.emit({ kind: "repeat", mode });`
                self.emit(Update::Repeat(mode));
            }
            // What:     `Command::Restore { tracks, current, position, volume,
            //           shuffle, repeat } => { ... }`. Reinstate a saved session,
            //           loading the current track PAUSED at the saved position.
            // Why:      Resume where the user left off, on launch.
            // TS map:   `case "restore": { const { tracks, current, ... } = command; ... }`
            Command::Restore {
                tracks,
                current,
                position,
                volume,
                shuffle,
                repeat,
            } => {
                // What:     `self.volume = volume;`. Restore the saved gain.
                // Why:      Applied to decoded samples.
                // TS map:   `this.volume = volume;`
                self.volume = volume;
                // What:     `self.queue.set_repeat(repeat);`. Restore repeat mode.
                // Why:      Affects auto-advance.
                // TS map:   `this.queue.setRepeat(repeat);`
                self.queue.set_repeat(repeat);
                // What:     `self.queue.set_tracks(tracks);`. Rebuild the queue
                //           (cursor starts at the first track).
                // Why:      Restore the playlist.
                // TS map:   `this.queue.setTracks(tracks);`
                self.queue.set_tracks(tracks);
                // What:     `self.queue.set_shuffle(shuffle);`. Restore shuffle
                //           ordering (keeps the current track).
                // Why:      Restore shuffle state.
                // TS map:   `this.queue.setShuffle(shuffle);`
                self.queue.set_shuffle(shuffle);
                // What:     `if let Some(idx) = current { self.queue.play_index(idx); }`.
                //           Move the cursor to the saved current track, if any.
                // Why:      Resume on the right track.
                // TS map:   `if (current != null) this.queue.playIndex(current);`
                if let Some(idx) = current {
                    self.queue.play_index(idx);
                }
                // What:     `self.emit(Update::Queue(self.queue.display_names()));`.
                //           Push the queue list to the UI.
                // Why:      Render the restored queue.
                // TS map:   `this.emit({ kind: "queue", names: ... });`
                self.emit(Update::Queue(self.queue.display_names()));
                // What:     `self.emit(Update::Volume(volume));`. Mirror volume.
                // Why:      Sync the slider.
                // TS map:   `this.emit({ kind: "volume", volume });`
                self.emit(Update::Volume(volume));
                // What:     `self.emit(Update::Shuffle(self.queue.shuffle_on()));`.
                //           Mirror shuffle state.
                // Why:      Sync the button.
                // TS map:   `this.emit({ kind: "shuffle", on: this.queue.shuffleOn() });`
                self.emit(Update::Shuffle(self.queue.shuffle_on()));
                // What:     `self.emit(Update::Repeat(self.queue.repeat()));`. Mirror
                //           repeat mode.
                // Why:      Sync the button.
                // TS map:   `this.emit({ kind: "repeat", mode: this.queue.repeat() });`
                self.emit(Update::Repeat(self.queue.repeat()));
                // What:     `self.playing = false;`. Restore PAUSED, not playing.
                // Why:      Resuming should not blast audio on launch.
                // TS map:   `this.playing = false;`
                self.playing = false;
                // What:     `let loaded = self.load_current();`. Load the current
                //           track (creates the output stream, emits NowPlaying).
                // Why:      Make the track ready to play from the saved position.
                // TS map:   `const loaded = this.loadCurrent();`
                let loaded = self.load_current();
                // What:     `self.emit(Update::Playing(false));`. Mirror paused state.
                // Why:      Show the Play button.
                // TS map:   `this.emit({ kind: "playing", on: false });`
                self.emit(Update::Playing(false));
                // What:     `if loaded && position > 0.0 { self.seek(position); }`.
                //           Jump to the saved position if a track loaded.
                // Why:      Resume mid-track.
                // TS map:   `if (loaded && position > 0) this.seek(position);`
                if loaded && position > 0.0 {
                    self.seek(position);
                }
            }
            // What:     `Command::Quit => {}`. Handled in `run`'s drain loop; this
            //           arm just keeps the match exhaustive.
            // Why:      Rust requires every variant to be matched.
            // TS map:   `case "quit": break; // handled elsewhere`
            Command::Quit => {}
        }
    }

    // What:     `fn after_move(&mut self, moved: Option<usize>)`. Shared follow-up
    //           for Next/Prev: load the new current track, or stop at the end.
    // Why:      Avoid duplicating the load-or-stop logic.
    // TS map:   `afterMove(moved: number | null): void`
    fn after_move(&mut self, moved: Option<usize>) {
        // What:     `match moved { ... }`. `Some` = a track to load; `None` = end.
        // Why:      Two outcomes.
        // TS map:   `if (moved != null) { ... } else { ... }`
        match moved {
            // What:     `Some(_) => { if !self.load_current() { self.set_playing(false); } }`.
            //           Load it; stop if loading failed. The `_` ignores the index.
            // Why:      Keep the current playing state when a track loads.
            // TS map:   `if (!this.loadCurrent()) this.setPlaying(false);`
            Some(_) => {
                if !self.load_current() {
                    self.set_playing(false);
                }
            }
            // What:     `None => self.set_playing(false)`. End of queue: stop.
            // Why:      Nothing more to play.
            // TS map:   `else this.setPlaying(false);`
            None => self.set_playing(false),
        }
    }

    // What:     `fn load_current(&mut self) -> bool`. Open the queue's current
    //           track into a decoder + reconfigure output. Returns whether a track
    //           was successfully loaded. Skips past files that fail to open.
    // Why:      One place that turns "current path" into live playback state.
    // TS map:   `loadCurrent(): boolean`
    fn load_current(&mut self) -> bool {
        // What:     `loop { ... }`. Iterate over the queue, advancing past any
        //           unreadable file. Iterative (not recursive) so a long run of
        //           bad files cannot overflow the stack.
        // Why:      Robustly find the next playable track.
        // TS map:   `while (true) { ... }`
        loop {
            // What:     `let path = match self.queue.current_path() { ... };`. Copy
            //           the current path out (`.clone()` makes an owned `PathBuf`),
            //           or return `false` if the queue is empty.
            // Why:      We need an owned path to open and to release the queue borrow.
            // TS map:   `const path = this.queue.currentPath(); if (!path) return false;`
            let path = match self.queue.current_path() {
                // What:     `Some(p) => p.clone()`. Own the path.
                // Why:      Outlive the borrow.
                // TS map:   `path = currentPath;`
                Some(p) => p.clone(),
                // What:     `None => return false`. Empty queue.
                // Why:      Nothing to load.
                // TS map:   `return false;`
                None => return false,
            };

            // What:     `match crate::decode::open(&path) { ... }`. Try to open a
            //           decoder for the file. `&path` lends it.
            // Why:      Build the source.
            // TS map:   `try { const source = open(path); ... } catch (e) { ... }`
            match crate::decode::open(&path) {
                // What:     `Ok(source) => { self.install_source(source, &path); return true; }`.
                //           Loaded: install it and report success.
                // Why:      Begin playing this track.
                // TS map:   `this.installSource(source, path); return true;`
                Ok(source) => {
                    self.install_source(source, &path);
                    return true;
                }
                // What:     `Err(e) => { ... }`. Could not open this file.
                // Why:      Skip to the next track.
                // TS map:   `catch (e) { ... }`
                Err(e) => {
                    // What:     `eprintln!("music-player: cannot open {}: {e}", path.display());`.
                    //           Log the failure. `path.display()` formats the path.
                    // Why:      Surface the bad file.
                    // TS map:   `console.error(`cannot open ${path}: ${e}`);`
                    eprintln!("music-player: cannot open {}: {e}", path.display());
                    // What:     `if self.queue.advance(false).is_none() { return false; }`.
                    //           Step forward; if there is no next track, give up.
                    // Why:      Avoid an endless loop when all files are bad.
                    // TS map:   `if (this.queue.advance(false) == null) return false;`
                    if self.queue.advance(false).is_none() {
                        return false;
                    }
                    // Otherwise the loop retries with the new current track.
                }
            }
        }
    }

    // What:     `fn install_source(&mut self, source: Box<dyn Source>, path: &Path)`.
    //           Store the source, reconfigure the output to its native format,
    //           reset position, and tell the UI what is now playing.
    // Why:      The common setup after a successful `open`.
    // TS map:   `installSource(source: Source, path: string): void`
    fn install_source(&mut self, source: Box<dyn Source>, path: &Path) {
        // What:     `let spec = source.spec();`. Copy the stream's rate/channels/
        //           duration (`AudioSpec` is `Copy`).
        // Why:      Needed to configure the output and the position math.
        // TS map:   `const spec = source.spec();`
        let spec = source.spec();

        // What:     `if let Some(output) = self.output.as_mut() { ... }`. Only
        //           reconfigure when audio is available (not silent mode).
        // Why:      Skip audio setup when there is no output.
        // TS map:   `if (this.output) { ... }`
        if let Some(output) = self.output.as_mut() {
            // What:     `let capacity_frames = spec.rate as usize;`. Size the ring
            //           buffer to about one second of audio (rate frames).
            // Why:      Enough buffering to avoid underruns without big latency.
            // TS map:   `const capacityFrames = spec.rate;`
            let capacity_frames = spec.rate as usize;
            // What:     `match output.reconfigure(spec.rate, spec.channels, capacity_frames) { ... }`.
            //           Rebuild the stream at this track's format; returns a new
            //           producer (write end) on success.
            // Why:      Per-track native rate; fresh buffer flushes old audio.
            // TS map:   `try { this.producer = output.reconfigure(...); } catch (e) { ... }`
            match output.reconfigure(spec.rate, spec.channels, capacity_frames) {
                // What:     `Ok(prod) => self.producer = Some(prod)`. Store the new
                //           write end.
                // Why:      Push samples here from now on.
                // TS map:   `this.producer = prod;`
                Ok(prod) => self.producer = Some(prod),
                // What:     `Err(e) => { eprintln!(...); self.producer = None; }`.
                //           Log and drop into silent mode for this track.
                // Why:      Don't crash if a stream fails to connect.
                // TS map:   `console.error(e); this.producer = null;`
                Err(e) => {
                    eprintln!("music-player: audio reconfigure failed: {e}");
                    self.producer = None;
                }
            }
        }

        // What:     `self.source = Some(source);`. Store the decoder.
        // Why:      Pump decodes from it.
        // TS map:   `this.source = source;`
        self.source = Some(source);
        // What:     `self.spec = Some(spec);`. Cache the format.
        // Why:      Position math + future reconfigure (seek).
        // TS map:   `this.spec = spec;`
        self.spec = Some(spec);
        // What:     `self.position_frames = 0;`. Restart the frame counter.
        // Why:      New track starts at 0.
        // TS map:   `this.positionFrames = 0;`
        self.position_frames = 0;
        // What:     `self.last_emit_secs = 0.0;`. Reset the throttle baseline.
        // Why:      Emit the first position promptly.
        // TS map:   `this.lastEmitSecs = 0;`
        self.last_emit_secs = 0.0;
        // What:     `self.pending.clear(); self.pending_pos = 0;`. Drop any leftover
        //           samples from the previous track.
        // Why:      Avoid mixing tracks.
        // TS map:   `this.pending = []; this.pendingPos = 0;`
        self.pending.clear();
        self.pending_pos = 0;

        // What:     `let name = file_name_of(path);`. The display filename.
        // Why:      Filename-only metadata policy.
        // TS map:   `const name = fileNameOf(path);`
        let name = file_name_of(path);
        // What:     `let index = self.queue.current_index();`. Its position in the
        //           queue (or `None`).
        // Why:      Lets the UI highlight the current row.
        // TS map:   `const index = this.queue.currentIndex();`
        let index = self.queue.current_index();
        // What:     `self.emit(Update::NowPlaying { index, name, duration: spec.duration_secs });`.
        //           Tell the UI the new track.
        // Why:      Update the now-playing label and seek-bar maximum.
        // TS map:   `this.emit({ kind: "nowPlaying", index, name, duration: spec.durationSecs });`
        self.emit(Update::NowPlaying {
            index,
            name,
            duration: spec.duration_secs,
        });
        // What:     `self.emit(Update::Position(0.0));`. Reset the seek bar to 0.
        // Why:      New track starts at the beginning.
        // TS map:   `this.emit({ kind: "position", secs: 0 });`
        self.emit(Update::Position(0.0));
    }

    // What:     `fn seek(&mut self, secs: f64)`. Move playback to `secs` in the
    //           current track and flush buffered audio.
    // Why:      Seek-bar control.
    // TS map:   `seek(secs: number): void`
    fn seek(&mut self, secs: f64) {
        // What:     `let spec = match self.spec { Some(s) => s, None => return };`.
        //           Copy the format out, or do nothing if no track is loaded.
        // Why:      Need the rate to recompute the frame position.
        // TS map:   `const spec = this.spec; if (!spec) return;`
        let spec = match self.spec {
            // What:     `Some(s) => s`. Copy the spec.
            // Why:      `AudioSpec` is `Copy`, so no borrow is held.
            // TS map:   `spec = this.spec;`
            Some(s) => s,
            // What:     `None => return`. Nothing loaded.
            // Why:      Ignore the seek.
            // TS map:   `return;`
            None => return,
        };

        // What:     `if let Some(source) = self.source.as_mut() { ... } else { return; }`.
        //           Seek the decoder; bail if there is no source.
        // Why:      The decoder must reposition.
        // TS map:   `if (!this.source) return; this.source.seek(secs);`
        if let Some(source) = self.source.as_mut() {
            // What:     `if let Err(e) = source.seek(secs) { eprintln!(...); return; }`.
            //           Attempt the seek; on error, log and abort the seek.
            // Why:      A failed seek should not corrupt position state.
            // TS map:   `try { source.seek(secs); } catch (e) { console.error(e); return; }`
            if let Err(e) = source.seek(secs) {
                eprintln!("music-player: seek failed: {e}");
                return;
            }
        } else {
            // What:     `return;`. No source -> nothing to seek.
            // Why:      Guard.
            // TS map:   `return;`
            return;
        }

        // What:     `if let Some(output) = self.output.as_mut() { ... }`. Rebuild
        //           the stream at the SAME format to flush stale buffered audio.
        // Why:      Otherwise ~1s of pre-seek audio would still play.
        // TS map:   `if (this.output) { this.producer = output.reconfigure(...); }`
        if let Some(output) = self.output.as_mut() {
            // What:     `match output.reconfigure(spec.rate, spec.channels, spec.rate as usize) { ... }`.
            //           Same rate/channels, ~1s buffer; new empty producer.
            // Why:      Clean slate after the jump.
            // TS map:   `try { this.producer = output.reconfigure(...); } catch (e) { ... }`
            match output.reconfigure(spec.rate, spec.channels, spec.rate as usize) {
                // What:     `Ok(prod) => self.producer = Some(prod)`. Replace the
                //           producer (old buffered samples are gone with the old buffer).
                // Why:      Flush.
                // TS map:   `this.producer = prod;`
                Ok(prod) => self.producer = Some(prod),
                // What:     `Err(e) => eprintln!(...)`. Log a reconfigure failure.
                // Why:      Keep going (position still updates).
                // TS map:   `console.error(e);`
                Err(e) => eprintln!("music-player: seek reconfigure failed: {e}"),
            }
        }

        // What:     `self.pending.clear(); self.pending_pos = 0;`. Drop leftover
        //           pre-seek samples we had not pushed yet.
        // Why:      They belong to the old position.
        // TS map:   `this.pending = []; this.pendingPos = 0;`
        self.pending.clear();
        self.pending_pos = 0;

        // What:     `self.position_frames = (secs * spec.rate as f64) as u64;`.
        //           Convert the target seconds to a frame count. `as u64` truncates
        //           the float to an integer frame index.
        // Why:      Keep position reporting consistent after the jump.
        // TS map:   `this.positionFrames = Math.floor(secs * spec.rate);`
        self.position_frames = (secs * spec.rate as f64) as u64;
        // What:     `self.last_emit_secs = secs;`. Update the throttle baseline.
        // Why:      Avoid an immediate redundant emit.
        // TS map:   `this.lastEmitSecs = secs;`
        self.last_emit_secs = secs;
        // What:     `self.emit(Update::Position(secs));`. Snap the UI seek bar.
        // Why:      Reflect the jump immediately.
        // TS map:   `this.emit({ kind: "position", secs });`
        self.emit(Update::Position(secs));
    }

    // What:     `fn pump_audio(&mut self) -> bool`. Push at most one block of audio
    //           into the ring buffer. Returns whether it did meaningful work (so
    //           the caller knows whether to sleep).
    // Why:      The decode->buffer feeding step, called every loop iteration.
    // TS map:   `pumpAudio(): boolean`
    fn pump_audio(&mut self) -> bool {
        // What:     `if !self.playing { return false; }`. Paused: no work.
        // Why:      Respect pause.
        // TS map:   `if (!this.playing) return false;`
        if !self.playing {
            return false;
        }
        // What:     `if self.producer.is_none() || self.source.is_none() { return false; }`.
        //           Need both a write end and a decoder.
        // Why:      Nothing to do otherwise (e.g. silent mode or no track).
        // TS map:   `if (!this.producer || !this.source) return false;`
        if self.producer.is_none() || self.source.is_none() {
            return false;
        }

        // What:     `if self.pending_pos < self.pending.len() { ... }`. There are
        //           leftover samples from last time; try to push them first.
        // Why:      Finish the previous block before decoding more.
        // TS map:   `if (this.pendingPos < this.pending.length) { ... }`
        if self.pending_pos < self.pending.len() {
            // What:     `let pushed = if let Some(producer) = self.producer.as_mut() { producer.push_slice(&self.pending[self.pending_pos..]) } else { 0 };`.
            //           Push the unsent tail; `push_slice` returns how many it
            //           accepted (the buffer may be full). `&self.pending[a..]`
            //           borrows a sub-slice (disjoint field from the producer).
            // Why:      Make progress draining `pending`.
            // TS map:   `const pushed = producer.pushSlice(this.pending.slice(this.pendingPos));`
            let pushed = if let Some(producer) = self.producer.as_mut() {
                producer.push_slice(&self.pending[self.pending_pos..])
            } else {
                0
            };
            // What:     `self.pending_pos += pushed;`. Advance the sent cursor.
            // Why:      Track what is left.
            // TS map:   `this.pendingPos += pushed;`
            self.pending_pos += pushed;
            // What:     `if self.pending_pos >= self.pending.len() { self.pending.clear(); self.pending_pos = 0; }`.
            //           Fully drained: reset the buffer.
            // Why:      Ready to decode the next block next time.
            // TS map:   `if (this.pendingPos >= this.pending.length) { this.pending = []; this.pendingPos = 0; }`
            if self.pending_pos >= self.pending.len() {
                self.pending.clear();
                self.pending_pos = 0;
            }
            // What:     `self.advance_position(pushed);`. Count pushed frames.
            // Why:      Update the seek bar.
            // TS map:   `this.advancePosition(pushed);`
            self.advance_position(pushed);
            // What:     `return pushed > 0;`. Did work only if something was pushed
            //           (if `0`, the buffer is full -> idle this cycle).
            // Why:      Tell the caller whether to sleep.
            // TS map:   `return pushed > 0;`
            return pushed > 0;
        }

        // What:     `let decoded = if let Some(source) = self.source.as_mut() { source.next_chunk() } else { return false; };`.
        //           Decode the next block. The result is `Result<Vec<f32>, _>`.
        // Why:      Produce more audio.
        // TS map:   `const decoded = source.nextChunk();`
        let decoded = if let Some(source) = self.source.as_mut() {
            source.next_chunk()
        } else {
            return false;
        };

        // What:     `let mut chunk = match decoded { ... };`. Unwrap the decode
        //           result; on error, log, end the track, and report work done.
        // Why:      Handle decode failures without crashing.
        // TS map:   `let chunk; try { chunk = decoded; } catch (e) { ...; this.onTrackEnd(); return true; }`
        let mut chunk = match decoded {
            // What:     `Ok(c) => c`. The decoded samples.
            // Why:      Continue.
            // TS map:   `chunk = c;`
            Ok(c) => c,
            // What:     `Err(e) => { eprintln!(...); self.on_track_end(); return true; }`.
            //           Treat a decode error as the end of this track.
            // Why:      Move on rather than stall.
            // TS map:   `catch (e) { console.error(e); this.onTrackEnd(); return true; }`
            Err(e) => {
                eprintln!("music-player: decode error: {e}");
                self.on_track_end();
                return true;
            }
        };

        // What:     `if chunk.is_empty() { self.on_track_end(); return true; }`. An
        //           empty chunk is the decoder's end-of-stream signal.
        // Why:      Advance to the next track at natural end.
        // TS map:   `if (chunk.length === 0) { this.onTrackEnd(); return true; }`
        if chunk.is_empty() {
            self.on_track_end();
            return true;
        }

        // What:     `let vol = self.volume;`. Snapshot the gain.
        // Why:      Avoid borrowing `self` inside the loop below.
        // TS map:   `const vol = this.volume;`
        let vol = self.volume;
        // What:     `for sample in chunk.iter_mut() { *sample *= vol; }`. Apply the
        //           volume gain in place. `iter_mut` yields `&mut f32`; `*sample`
        //           writes through the reference.
        // Why:      PCM-gain volume (the chosen approach).
        // TS map:   `for (let i = 0; i < chunk.length; i++) chunk[i] *= vol;`
        for sample in chunk.iter_mut() {
            *sample *= vol;
        }

        // What:     `let pushed = if let Some(producer) = self.producer.as_mut() { producer.push_slice(&chunk) } else { 0 };`.
        //           Push the gained chunk; `push_slice` returns the accepted count.
        // Why:      Feed the audio thread.
        // TS map:   `const pushed = producer.pushSlice(chunk);`
        let pushed = if let Some(producer) = self.producer.as_mut() {
            producer.push_slice(&chunk)
        } else {
            0
        };
        // What:     `self.advance_position(pushed);`. Count pushed frames.
        // Why:      Update the seek bar.
        // TS map:   `this.advancePosition(pushed);`
        self.advance_position(pushed);
        // What:     `if pushed < chunk.len() { self.pending = chunk; self.pending_pos = pushed; }`.
        //           If the buffer could not take all of it, stash the remainder.
        // Why:      Push the rest next cycle instead of dropping samples.
        // TS map:   `if (pushed < chunk.length) { this.pending = chunk; this.pendingPos = pushed; }`
        if pushed < chunk.len() {
            self.pending = chunk;
            self.pending_pos = pushed;
        }
        // What:     `true`. We decoded and pushed: work was done.
        // Why:      Caller should not sleep.
        // TS map:   `return true;`
        true
    }

    // What:     `fn on_track_end(&mut self)`. Natural end of the current track:
    //           advance the queue (a natural end, so repeat-one replays) and load,
    //           or stop at the end of the queue.
    // Why:      Auto-advance between tracks.
    // TS map:   `onTrackEnd(): void`
    fn on_track_end(&mut self) {
        // What:     `let moved = self.queue.advance(true);`. `true` = natural end,
        //           which lets repeat-one replay the same track.
        // Why:      Honour the repeat mode.
        // TS map:   `const moved = this.queue.advance(true);`
        let moved = self.queue.advance(true);
        // What:     `self.after_move(moved);`. Load the next or stop.
        // Why:      Shared follow-up logic.
        // TS map:   `this.afterMove(moved);`
        self.after_move(moved);
    }

    // What:     `fn advance_position(&mut self, samples_pushed: usize)`. Add the
    //           pushed frames to the position counter and emit a throttled
    //           `Position` update.
    // Why:      Keep the seek bar moving without flooding the UI.
    // TS map:   `advancePosition(samplesPushed: number): void`
    fn advance_position(&mut self, samples_pushed: usize) {
        // What:     `let channels = self.spec.as_ref().map_or(0, |s| s.channels) as u64;`.
        //           Read the channel count (0 if no spec). `map_or(default, f)`
        //           applies `f` when `Some`, else returns the default. `as u64`
        //           widens for the division.
        // Why:      Frames = interleaved samples / channels.
        // TS map:   `const channels = this.spec ? this.spec.channels : 0;`
        let channels = self.spec.as_ref().map_or(0, |s| s.channels) as u64;
        // What:     `if channels == 0 { return; }`. Avoid divide-by-zero.
        // Why:      No valid spec yet.
        // TS map:   `if (channels === 0) return;`
        if channels == 0 {
            return;
        }
        // What:     `self.position_frames += samples_pushed as u64 / channels;`.
        //           Convert pushed interleaved samples to frames and accumulate.
        // Why:      Track playback progress.
        // TS map:   `this.positionFrames += Math.floor(samplesPushed / channels);`
        self.position_frames += samples_pushed as u64 / channels;
        // What:     `let rate = self.spec.as_ref().map_or(0, |s| s.rate);`. The
        //           sample rate (0 if unknown).
        // Why:      Seconds = frames / rate.
        // TS map:   `const rate = this.spec ? this.spec.rate : 0;`
        let rate = self.spec.as_ref().map_or(0, |s| s.rate);
        // What:     `if rate == 0 { return; }`. Avoid divide-by-zero.
        // Why:      Cannot compute seconds.
        // TS map:   `if (rate === 0) return;`
        if rate == 0 {
            return;
        }
        // What:     `let secs = self.position_frames as f64 / rate as f64;`. Current
        //           position in seconds.
        // Why:      The unit the UI uses.
        // TS map:   `const secs = this.positionFrames / rate;`
        let secs = self.position_frames as f64 / rate as f64;
        // What:     `if secs - self.last_emit_secs >= POSITION_EMIT_INTERVAL_SECS { ... }`.
        //           Only emit when enough progress has accumulated.
        // Why:      Throttle to ~10 updates/second.
        // TS map:   `if (secs - this.lastEmitSecs >= POSITION_EMIT_INTERVAL_SECS) { ... }`
        if secs - self.last_emit_secs >= POSITION_EMIT_INTERVAL_SECS {
            // What:     `self.last_emit_secs = secs;`. Update the baseline.
            // Why:      Next emit waits another interval.
            // TS map:   `this.lastEmitSecs = secs;`
            self.last_emit_secs = secs;
            // What:     `self.emit(Update::Position(secs));`. Send the position.
            // Why:      Move the seek bar.
            // TS map:   `this.emit({ kind: "position", secs });`
            self.emit(Update::Position(secs));
        }
    }
}

// What:     `fn expand_paths(paths: Vec<PathBuf>) -> Vec<PathBuf>`. Turn the
//           opened paths into a flat file list: a directory expands to every file
//           under it, RECURSIVELY (subfolders included); a plain path passes
//           through unchanged.
// Why:      The queue holds files, but the UI opens a folder, which should
//           enqueue all of its tracks.
// TS map:   `function expandPaths(paths: string[]): string[]`
fn expand_paths(paths: Vec<PathBuf>) -> Vec<PathBuf> {
    // What:     `let mut out: Vec<PathBuf> = Vec::new();`. The accumulating result.
    //           Explicit type because it starts empty.
    // Why:      Collect the expanded files.
    // TS map:   `const out: string[] = [];`
    let mut out: Vec<PathBuf> = Vec::new();

    // What:     `for path in paths { ... }`. Consume each opened path by value.
    // Why:      Classify file vs directory.
    // TS map:   `for (const path of paths) { ... }`
    for path in paths {
        // What:     `if path.is_dir() { ... } else { ... }`. `is_dir()` checks the
        //           filesystem (following symlinks).
        // Why:      Directories need recursive expansion.
        // TS map:   `if (isDir(path)) { ... } else { ... }`
        if path.is_dir() {
            // What:     `out.extend(collect_dir_files(&path));`. Append every file
            //           found under the directory. `&path` lends it; `.extend(...)`
            //           MOVES the returned files into `out`.
            // Why:      Recursively enqueue the folder's tracks.
            // TS map:   `out.push(...collectDirFiles(path));`
            out.extend(collect_dir_files(&path));
        } else {
            // What:     `out.push(path);`. A plain path: keep it as-is (MOVES it).
            // Why:      Could be a file (or non-existent; the decoder will report).
            // TS map:   `out.push(path);`
            out.push(path);
        }
    }

    // What:     `out`. Tail expression -> the expanded list is returned.
    // Why:      Hand back the flat file list.
    // TS map:   `return out;`
    out
}

// What:     `fn collect_dir_files(root: &Path) -> Vec<PathBuf>`. Walk a directory
//           tree and return every file under it, sorted within each folder, with
//           a folder's own files listed before its subfolders' files. `&Path` is
//           a borrowed path (we only read it).
// Why:      Opening a folder should enqueue all its tracks, including nested ones.
// TS map:   `function collectDirFiles(root: string): string[]`
fn collect_dir_files(root: &Path) -> Vec<PathBuf> {
    // What:     `let mut out: Vec<PathBuf> = Vec::new();`. The collected files.
    // Why:      Accumulate across the whole walk.
    // TS map:   `const out: string[] = [];`
    let mut out: Vec<PathBuf> = Vec::new();

    // What:     `let mut stack: Vec<PathBuf> = vec![root.to_path_buf()];`. A
    //           work-list of directories still to visit, seeded with the root.
    //           `vec![...]` is the macro that builds a vector literal;
    //           `root.to_path_buf()` copies the borrowed `&Path` into an OWNED
    //           `PathBuf` we can store.
    // Why:      An explicit stack walks the tree ITERATIVELY (no recursion), so a
    //           deeply nested folder cannot overflow the call stack.
    // TS map:   `const stack: string[] = [root];`
    let mut stack: Vec<PathBuf> = vec![root.to_path_buf()];

    // What:     `while let Some(dir) = stack.pop() { ... }`. Pop directories until
    //           the work-list is empty. `stack.pop()` returns `Option<PathBuf>`:
    //           `Some(dir)` while items remain, `None` when done (ends the loop).
    // Why:      Process every pending directory.
    // TS map:   `while (stack.length) { const dir = stack.pop()!; ... }`
    while let Some(dir) = stack.pop() {
        // What:     `let entries = match std::fs::read_dir(&dir) { ... };`. List the
        //           directory; `read_dir` returns `Result<ReadDir>` (an iterator of
        //           entries). `&dir` lends the path.
        // Why:      Gather this folder's children, robust to unreadable folders.
        // TS map:   `let entries; try { entries = readdir(dir); } catch (e) { ... }`
        let entries = match std::fs::read_dir(&dir) {
            // What:     `Ok(e) => e`. The directory iterator.
            // Why:      Walk its entries.
            // TS map:   `entries = e;`
            Ok(e) => e,
            // What:     `Err(e) => { eprintln!(...); continue; }`. Log the failure
            //           and `continue` to the next work-list item.
            // Why:      One bad folder should not abort the whole walk.
            // TS map:   `catch (e) { console.error(e); continue; }`
            Err(e) => {
                eprintln!("music-player: cannot read dir {}: {e}", dir.display());
                continue;
            }
        };

        // What:     `let mut files: Vec<PathBuf> = Vec::new();`. Files directly in
        //           this folder.
        // Why:      Collected, sorted, then appended.
        // TS map:   `const files: string[] = [];`
        let mut files: Vec<PathBuf> = Vec::new();
        // What:     `let mut subdirs: Vec<PathBuf> = Vec::new();`. Subfolders found
        //           in this folder.
        // Why:      Pushed onto the work-stack after sorting.
        // TS map:   `const subdirs: string[] = [];`
        let mut subdirs: Vec<PathBuf> = Vec::new();

        // What:     `for entry in entries.flatten() { ... }`. Each `read_dir` item
        //           is a `Result<DirEntry>`; `.flatten()` yields only the `Ok`
        //           values, silently dropping unreadable entries. So `entry` is a
        //           `DirEntry`.
        // Why:      Iterate readable entries; skip broken ones robustly.
        // TS map:   `for (const entry of entries.filter(e => e.ok).map(e => e.value)) { ... }`
        for entry in entries.flatten() {
            // What:     `let file_type = match entry.file_type() { ... };`.
            //           `entry.file_type()` reports the entry kind WITHOUT following
            //           symlinks (returns `Result<FileType>`); on error skip it.
            // Why:      The non-following check lets us refuse to descend into
            //           symlinked directories, avoiding infinite loops on a symlink
            //           cycle.
            // TS map:   `let ft; try { ft = entry.fileType(); } catch { continue; }`
            let file_type = match entry.file_type() {
                // What:     `Ok(ft) => ft`. The entry's type.
                // Why:      Classify below.
                // TS map:   `ft = ...;`
                Ok(ft) => ft,
                // What:     `Err(_) => continue`. Unreadable type: skip this entry.
                //           `_` ignores the error value.
                // Why:      Be robust.
                // TS map:   `catch { continue; }`
                Err(_) => continue,
            };
            // What:     `let p = entry.path();`. The entry's full path.
            // Why:      Stored in one of the two buckets.
            // TS map:   `const p = entry.path;`
            let p = entry.path();
            // What:     `if file_type.is_dir() { subdirs.push(p); } else if p.is_file() { files.push(p); }`.
            //           A REAL subdirectory (symlinks excluded by `file_type`) goes
            //           on the work-list; anything that resolves to a file
            //           (`p.is_file()` DOES follow symlinks, so symlinked files
            //           still count) is kept. A symlinked directory matches neither
            //           and is ignored (loop-safe).
            // Why:      Recurse only into real folders; collect real files.
            // TS map:   `if (ft.isDirectory()) subdirs.push(p); else if (isFile(p)) files.push(p);`
            if file_type.is_dir() {
                subdirs.push(p);
            } else if p.is_file() {
                files.push(p);
            }
        }

        // What:     `files.sort();`. Sort this folder's files alphabetically in place.
        // Why:      Deterministic queue order.
        // TS map:   `files.sort();`
        files.sort();
        // What:     `subdirs.sort();`. Sort subfolders alphabetically in place.
        // Why:      Deterministic descent order.
        // TS map:   `subdirs.sort();`
        subdirs.sort();

        // What:     `out.extend(files);`. Append this folder's files (a parent's
        //           files precede its children's), MOVING them into `out`.
        // Why:      Add the folder's tracks to the result.
        // TS map:   `out.push(...files);`
        out.extend(files);

        // What:     `for dir in subdirs.into_iter().rev() { stack.push(dir); }`.
        //           Push subfolders in REVERSE sorted order. `into_iter()` consumes
        //           the vec by value; `.rev()` reverses the iteration.
        // Why:      The stack pops last-in-first-out, so reversing here makes the
        //           subfolders pop back out in sorted (ascending) order.
        // TS map:   `for (const dir of [...subdirs].reverse()) stack.push(dir);`
        for dir in subdirs.into_iter().rev() {
            stack.push(dir);
        }
    }

    // What:     `out`. Tail expression -> the recursively collected files.
    // Why:      Hand back every file under `root`.
    // TS map:   `return out;`
    out
}

// What:     `fn file_name_of(path: &Path) -> String`. The display filename of a
//           path (final component), or the whole path if it has none.
// Why:      Filename-only metadata policy for the UI.
// TS map:   `function fileNameOf(path: string): string`
fn file_name_of(path: &Path) -> String {
    // What:     `match path.file_name() { ... }`. `file_name()` returns
    //           `Option<&OsStr>` (the last component), or `None` (e.g. `/`).
    // Why:      Extract the filename.
    // TS map:   `const name = basename(path);`
    match path.file_name() {
        // What:     `Some(name) => name.to_string_lossy().into_owned()`.
        //           `to_string_lossy()` converts the OS string to a `Cow<str>`
        //           (replacing invalid bytes); `.into_owned()` makes an owned
        //           `String`.
        // Why:      Need an owned UTF-8 string for the UI.
        // TS map:   `return basename;`
        Some(name) => name.to_string_lossy().into_owned(),
        // What:     `None => path.display().to_string()`. Fall back to the full
        //           path text. `display()` formats the path; `.to_string()` owns it.
        // Why:      Always show something.
        // TS map:   `return String(path);`
        None => path.display().to_string(),
    }
}

// What:     `#[cfg(test)] mod tests { ... }` declares a submodule compiled ONLY
//           during `cargo test`. `#[cfg(test)]` is a conditional-compilation
//           attribute.
// Why:      Cover the pure path-expansion helper (the threaded engine itself is
//           exercised by manual UI verification, not unit tests).
// TS map:   like a `*.test.ts` file, but inlined and compiled out of prod.
#[cfg(test)]
mod tests {
    // What:     `use super::*;` imports everything from the parent module into the
    //           test scope. `super` means "one level up".
    // Why:      Tests need `expand_paths`, `PathBuf`, etc.
    // TS map:   `import * as parent from "./engine";`
    use super::*;
    // What:     `use std::fs;` brings the filesystem module into scope.
    // Why:      The test builds a real directory tree to walk.
    // TS map:   `import * as fs from "node:fs";`
    use std::fs;
    // What:     `use std::time::{SystemTime, UNIX_EPOCH};`. A clock reading and the
    //           1970 epoch reference point.
    // Why:      Build a unique temp-dir name so reruns do not collide.
    // TS map:   `Date.now()`.
    use std::time::{SystemTime, UNIX_EPOCH};

    // What:     `fn unique_temp_dir() -> PathBuf` test helper: make and return a
    //           fresh throwaway directory under the system temp dir.
    // Why:      Verify on a disposable fixture, never real state.
    // TS map:   `function uniqueTempDir(): string`.
    fn unique_temp_dir() -> PathBuf {
        // What:     `let nanos = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();`.
        //           Current time minus the epoch -> a `Duration`; `.unwrap()`
        //           extracts it (panics only if the clock predates 1970);
        //           `.as_nanos()` gives a `u128` nanosecond count.
        // Why:      A high-resolution component keeps the directory name unique.
        // TS map:   `const nanos = BigInt(Date.now()) * 1_000_000n;`
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        // What:     `let dir = std::env::temp_dir().join(format!("music-player-expand-{}-{}", std::process::id(), nanos));`.
        //           Build the path: system temp dir + a name carrying the process
        //           id and the nanosecond stamp. `std::process::id()` is this
        //           process's pid (a `u32`).
        // Why:      Unique per process and per call.
        // TS map:   `const dir = path.join(os.tmpdir(), `music-player-expand-${pid}-${nanos}`);`
        let dir = std::env::temp_dir().join(format!(
            "music-player-expand-{}-{}",
            std::process::id(),
            nanos
        ));
        // What:     `fs::create_dir_all(&dir).unwrap();`. Create the directory (and
        //           any missing parents); `.unwrap()` fails the test on error.
        //           `&dir` lends the path.
        // Why:      The fixture root must exist before we populate it.
        // TS map:   `fs.mkdirSync(dir, { recursive: true });`
        fs::create_dir_all(&dir).unwrap();
        // What:     `dir`. Tail expression -> return the created path.
        // Why:      Hand the fixture root to the caller.
        // TS map:   `return dir;`
        dir
    }

    // What:     `#[test]` marks the next function as a test case.
    // Why:      `cargo test` discovers and runs it.
    // TS map:   `test("expand_paths ...", () => { ... })`.
    #[test]
    fn expand_paths_walks_directories_recursively_and_sorts() {
        // What:     `let root = unique_temp_dir();`. Make the throwaway fixture.
        // Why:      A real tree to expand.
        // TS map:   `const root = uniqueTempDir();`
        let root = unique_temp_dir();

        // What:     `fs::write(root.join("b.flac"), b"x").unwrap();`. Create a file.
        //           `root.join("b.flac")` builds the child path; `b"x"` is a BYTE
        //           STRING literal (a `&[u8; 1]`, raw bytes, not text); `.unwrap()`
        //           fails the test on I/O error.
        // Why:      Two root files created out of alphabetical order, to prove the
        //           walk sorts them.
        // TS map:   `fs.writeFileSync(path.join(root, "b.flac"), "x");`
        fs::write(root.join("b.flac"), b"x").unwrap();
        // What:     create the second root file.
        // Why:      Out-of-order sibling.
        // TS map:   `fs.writeFileSync(path.join(root, "a.flac"), "x");`
        fs::write(root.join("a.flac"), b"x").unwrap();

        // What:     `let sub = root.join("sub");`. A subfolder path.
        // Why:      Prove the walk descends one level.
        // TS map:   `const sub = path.join(root, "sub");`
        let sub = root.join("sub");
        // What:     create the subfolder.
        // Why:      It must exist before adding files.
        // TS map:   `fs.mkdirSync(sub, { recursive: true });`
        fs::create_dir_all(&sub).unwrap();
        // What:     a file inside the subfolder.
        // Why:      Expected after the root files.
        // TS map:   `fs.writeFileSync(path.join(sub, "c.flac"), "x");`
        fs::write(sub.join("c.flac"), b"x").unwrap();

        // What:     `let nested = sub.join("nested");`. A deeper folder.
        // Why:      Prove the walk descends more than one level.
        // TS map:   `const nested = path.join(sub, "nested");`
        let nested = sub.join("nested");
        // What:     create the nested folder.
        // Why:      Needed before its file.
        // TS map:   `fs.mkdirSync(nested, { recursive: true });`
        fs::create_dir_all(&nested).unwrap();
        // What:     a file two levels down.
        // Why:      Expected last.
        // TS map:   `fs.writeFileSync(path.join(nested, "d.flac"), "x");`
        fs::write(nested.join("d.flac"), b"x").unwrap();

        // What:     `let got = expand_paths(vec![root.clone()]);`. Expand the root
        //           folder. `vec![...]` wraps it in a one-element vector;
        //           `root.clone()` copies the path (we reuse `root` afterwards).
        // Why:      Exercise the recursive walk.
        // TS map:   `const got = expandPaths([root]);`
        let got = expand_paths(vec![root.clone()]);

        // What:     `let expected = vec![ ... ];`. The order the walk must produce:
        //           a folder's files (sorted) before its subfolders' files,
        //           depth-first.
        // Why:      Pin the deterministic ordering.
        // TS map:   `const expected = [ ... ];`
        let expected = vec![
            root.join("a.flac"),
            root.join("b.flac"),
            sub.join("c.flac"),
            nested.join("d.flac"),
        ];
        // What:     `assert_eq!(got, expected);`. Panics (failing the test) unless
        //           the two vectors are equal.
        // Why:      Confirm recursive collection and ordering.
        // TS map:   `expect(got).toEqual(expected);`
        assert_eq!(got, expected);

        // What:     `let single = expand_paths(vec![root.join("a.flac")]);`. Expand a
        //           plain FILE path (not a directory).
        // Why:      A file should pass through unchanged.
        // TS map:   `const single = expandPaths([path.join(root, "a.flac")]);`
        let single = expand_paths(vec![root.join("a.flac")]);
        // What:     `assert_eq!(single, vec![root.join("a.flac")]);`. One element, the
        //           file itself.
        // Why:      Files are not expanded.
        // TS map:   `expect(single).toEqual([path.join(root, "a.flac")]);`
        assert_eq!(single, vec![root.join("a.flac")]);

        // What:     `let _ = fs::remove_dir_all(&root);`. Delete the throwaway tree;
        //           `let _ =` discards the result (cleanup is best-effort).
        // Why:      Leave no fixture behind.
        // TS map:   `fs.rmSync(root, { recursive: true, force: true });`
        let _ = fs::remove_dir_all(&root);
    }
}
