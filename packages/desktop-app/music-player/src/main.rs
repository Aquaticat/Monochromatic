//! Binary entry point. Builds the Slint window, spawns the engine on its own
//! thread, and wires the two together: UI callbacks send `Command`s to the
//! engine, and engine `Update`s are applied to the window's properties from the
//! event-loop thread. Also handles CLI path arguments and the file-open dialog.

// What:     `slint::include_modules!()` is a MACRO (the `!` marks a macro call)
//           that pastes in the Rust code generated from `ui/app.slint` by
//           `build.rs`, bringing the `AppWindow` type into scope.
// Why:      Without it the compiled-from-markup component is invisible to Rust.
// TS map:   like an auto-generated `import { AppWindow } from "./app.slint.gen";`
slint::include_modules!();

// What:     `use std::path::PathBuf;`. The owned filesystem-path type.
// Why:      CLI arguments and picked files become `PathBuf`s for `OpenPaths`.
// TS map:   `string` paths.
use std::path::PathBuf;

// What:     `use std::rc::Rc;`. `Rc<T>` is a single-threaded shared-ownership
//           pointer (reference counted). Sibling: `Arc<T>` (atomic, multi-thread).
// Why:      Several UI callbacks need to share the one `Engine`; they all run on
//           the UI thread, so non-atomic `Rc` is enough (and cheaper than `Arc`).
// TS map:   no equivalent; GC makes every JS object implicitly shared.
//
// In TS you'd write (pseudocode):
// ```ts
// const engine = new Engine(); // closures just capture it; GC handles sharing
// ```
use std::rc::Rc;

// What:     `use music_player::command::{Command, RepeatMode, Update};`. The
//           message types from our library crate. The package is `music-player`
//           but a Rust crate identifier cannot contain `-`, so the lib crate is
//           `music_player` (the hyphen becomes an underscore).
// Why:      We build `Command`s and read `Update`s.
// TS map:   `import { Command, RepeatMode, Update } from "music-player/command";`
use music_player::command::{Command, RepeatMode, Update};

// What:     `use music_player::engine::Engine;`. The controller handle.
// Why:      We spawn it and send commands.
// TS map:   `import { Engine } from "music-player/engine";`
use music_player::engine::Engine;

// What:     `use music_player::session::Session;`. The saved-state record.
// Why:      We load it on launch to restore the last session.
// TS map:   `import { Session } from "music-player/session";`
use music_player::session::Session;

// What:     `use slint::{ComponentHandle, SharedString, VecModel};`.
//           `ComponentHandle` is the trait giving `.as_weak()`/`.run()` on the
//           window; `SharedString` is Slint's cheap-to-clone string; `VecModel`
//           builds the list model behind the queue property. (The `ModelRc` the
//           setter wants is produced by `.into()`, so it needs no import.)
// Why:      Needed to drive the window and set its `[string]` queue.
// TS map:   importing the UI runtime's helpers.
use slint::{ComponentHandle, SharedString, VecModel};

// What:     `const REPEAT_MODES: i32 = 3;`. Number of repeat modes (Off/All/One),
//           used to cycle the repeat button. `i32` matches Slint's `int` property.
// Why:      Avoid a bare `3` when wrapping the mode around.
// TS map:   `const REPEAT_MODES = 3;`
const REPEAT_MODES: i32 = 3;

// What:     `fn repeat_to_int(mode: RepeatMode) -> i32`. Map the enum to the
//           integer the UI property uses (Off=0, All=1, One=2).
// Why:      Slint has no Rust enum; it stores the mode as an `int`.
// TS map:   `function repeatToInt(mode: RepeatMode): number`
fn repeat_to_int(mode: RepeatMode) -> i32 {
    // What:     `match mode { ... }`. Map each variant to its number.
    // Why:      Stable encoding shared with the .slint file.
    // TS map:   `switch (mode) { ... }`
    match mode {
        // What:     `RepeatMode::Off => 0`. Path-qualified variant -> 0.
        // Why:      Off is 0.
        // TS map:   `case "off": return 0;`
        RepeatMode::Off => 0,
        // What:     `RepeatMode::All => 1`.
        // Why:      All is 1.
        // TS map:   `case "all": return 1;`
        RepeatMode::All => 1,
        // What:     `RepeatMode::One => 2`.
        // Why:      One is 2.
        // TS map:   `case "one": return 2;`
        RepeatMode::One => 2,
    }
}

// What:     `fn int_to_repeat(value: i32) -> RepeatMode`. Inverse of the above.
// Why:      Turn the cycled integer back into a `RepeatMode` for the command.
// TS map:   `function intToRepeat(value: number): RepeatMode`
fn int_to_repeat(value: i32) -> RepeatMode {
    // What:     `match value { 1 => All, 2 => One, _ => Off }`. The wildcard `_`
    //           maps anything else (including 0) to Off.
    // Why:      Defensive default to Off.
    // TS map:   `return value === 1 ? "all" : value === 2 ? "one" : "off";`
    match value {
        // What:     `1 => RepeatMode::All`.
        // Why:      1 is All.
        // TS map:   `case 1: return "all";`
        1 => RepeatMode::All,
        // What:     `2 => RepeatMode::One`.
        // Why:      2 is One.
        // TS map:   `case 2: return "one";`
        2 => RepeatMode::One,
        // What:     `_ => RepeatMode::Off`. Everything else.
        // Why:      Default.
        // TS map:   `default: return "off";`
        _ => RepeatMode::Off,
    }
}

// What:     `fn format_time(secs: f64) -> String`. Format seconds as "m:ss".
// Why:      Slint number-to-string is awkward, so we format here and pass strings.
// TS map:   `function formatTime(secs: number): string`
fn format_time(secs: f64) -> String {
    // What:     `let whole = if secs > 0.0 { secs as u64 } else { 0 };`. Clamp
    //           negatives/NaN to 0, then truncate to whole seconds (`as u64`).
    // Why:      Avoid negative or garbage times.
    // TS map:   `const whole = secs > 0 ? Math.floor(secs) : 0;`
    let whole = if secs > 0.0 { secs as u64 } else { 0 };
    // What:     `format!("{}:{:02}", whole / 60, whole % 60)`. Minutes, then
    //           seconds zero-padded to 2 digits (`{:02}`). Tail -> return.
    // Why:      "3:07" style display.
    // TS map:   `return `${Math.floor(whole/60)}:${String(whole%60).padStart(2,"0")}`;`
    format!("{}:{:02}", whole / 60, whole % 60)
}

// What:     `fn apply_update(app: &AppWindow, update: Update)`. Apply one engine
//           update to the window's properties. Runs on the event-loop thread.
// Why:      Keep the on-screen state mirroring the engine's state.
// TS map:   `function applyUpdate(app: AppWindow, update: Update): void`
fn apply_update(app: &AppWindow, update: Update) {
    // What:     `match update { ... }`. Dispatch on the update variant.
    // Why:      Each maps to one or more property setters.
    // TS map:   `switch (update.kind) { ... }`
    match update {
        // What:     `Update::Queue(names) => { ... }`. Replace the queue list.
        // Why:      Render the filenames.
        // TS map:   `case "queue": ...`
        Update::Queue(names) => {
            // What:     `let items: Vec<SharedString> = names.into_iter().map(SharedString::from).collect();`.
            //           Convert each `String` to a `SharedString`. `into_iter()`
            //           consumes the vec; `.map(SharedString::from)` converts each;
            //           `.collect()` gathers into a new `Vec`.
            // Why:      Slint models hold `SharedString`, not `String`.
            // TS map:   `const items = names.slice();`
            let items: Vec<SharedString> = names.into_iter().map(SharedString::from).collect();
            // What:     `let model = Rc::new(VecModel::from(items));`. Wrap the
            //           items in a `VecModel` (a list model) behind an `Rc`.
            // Why:      Slint list properties take a reference-counted model.
            // TS map:   `const model = items;`
            let model = Rc::new(VecModel::from(items));
            // What:     `app.set_queue(model.into());`. `model.into()` converts the
            //           `Rc<VecModel>` into the `ModelRc` the property wants.
            //           `set_queue` is the generated setter for the `queue` property.
            // Why:      Push the list to the UI.
            // TS map:   `app.queue = model;`
            app.set_queue(model.into());
        }
        // What:     `Update::NowPlaying { index, name, duration } => { ... }`.
        //           Destructure the struct variant's fields.
        // Why:      Update the now-playing label, highlight, and seek-bar max.
        // TS map:   `case "nowPlaying": { const { index, name, duration } = update; ... }`
        Update::NowPlaying {
            index,
            name,
            duration,
        } => {
            // What:     `app.set_track_name(name.into());`. `.into()` converts the
            //           `String` to `SharedString`.
            // Why:      Show the filename.
            // TS map:   `app.trackName = name;`
            app.set_track_name(name.into());
            // What:     `app.set_duration(duration as f32);`. Slint's `float` is
            //           f32, so narrow our f64 seconds.
            // Why:      The seek slider's maximum.
            // TS map:   `app.duration = duration;`
            app.set_duration(duration as f32);
            // What:     `app.set_duration_text(format_time(duration).into());`.
            //           Set the human-readable label.
            // Why:      Show total time.
            // TS map:   `app.durationText = formatTime(duration);`
            app.set_duration_text(format_time(duration).into());
            // What:     `let index_i32 = match index { Some(i) => i as i32, None => -1 };`.
            //           Encode "no current track" as -1 for the UI.
            // Why:      Slint `int` cannot be null; -1 means "none".
            // TS map:   `const indexI32 = index ?? -1;`
            let index_i32 = match index {
                // What:     `Some(i) => i as i32`. Narrow the `usize` index to `i32`.
                // Why:      Slint `int` is i32.
                // TS map:   `i;`
                Some(i) => i as i32,
                // What:     `None => -1`. No current track.
                // Why:      Sentinel.
                // TS map:   `-1;`
                None => -1,
            };
            // What:     `app.set_current_index(index_i32);`. Highlight that row.
            // Why:      Mark the playing track.
            // TS map:   `app.currentIndex = indexI32;`
            app.set_current_index(index_i32);
        }
        // What:     `Update::Position(secs) => { ... }`. Live playback position.
        // Why:      Move the seek bar and update the elapsed label.
        // TS map:   `case "position": ...`
        Update::Position(secs) => {
            // What:     `app.set_position(secs as f32);`. Narrow to Slint's float.
            // Why:      Slider thumb position.
            // TS map:   `app.position = secs;`
            app.set_position(secs as f32);
            // What:     `app.set_position_text(format_time(secs).into());`.
            // Why:      Elapsed-time label.
            // TS map:   `app.positionText = formatTime(secs);`
            app.set_position_text(format_time(secs).into());
        }
        // What:     `Update::Playing(on) => app.set_playing(on)`. Play/pause state.
        // Why:      Toggle the button label.
        // TS map:   `case "playing": app.playing = on;`
        Update::Playing(on) => app.set_playing(on),
        // What:     `Update::Volume(v) => app.set_volume(v)`. Volume (f32 already).
        // Why:      Sync the slider.
        // TS map:   `case "volume": app.volume = v;`
        Update::Volume(v) => app.set_volume(v),
        // What:     `Update::Shuffle(on) => app.set_shuffle(on)`. Shuffle state.
        // Why:      Button label.
        // TS map:   `case "shuffle": app.shuffle = on;`
        Update::Shuffle(on) => app.set_shuffle(on),
        // What:     `Update::Repeat(mode) => app.set_repeat_mode(repeat_to_int(mode))`.
        //           Encode the mode to an int for the UI.
        // Why:      Repeat button label.
        // TS map:   `case "repeat": app.repeatMode = repeatToInt(mode);`
        Update::Repeat(mode) => app.set_repeat_mode(repeat_to_int(mode)),
    }
}

// What:     `fn main() -> Result<(), slint::PlatformError>`. The entry point;
//           may end with a `PlatformError` if Slint cannot create a window.
// Why:      Propagate window/backend failure as the exit status.
// TS map:   `async function main(): Promise<void>` that may throw.
fn main() -> Result<(), slint::PlatformError> {
    // What:     `let app = AppWindow::new()?;`. Build the window; `?` returns the
    //           error from `main` on failure.
    // Why:      We need the window before wiring anything.
    // TS map:   `const app = new AppWindow();`
    let app = AppWindow::new()?;

    // What:     `let weak = app.as_weak();`. A WEAK handle to the window: it does
    //           not keep the window alive, and can be sent to other threads and
    //           upgraded back to a strong handle ON the event-loop thread.
    // Why:      The engine's update callback (on another thread) needs to reach
    //           the window without owning it.
    // TS map:   `const weak = new WeakRef(app);`
    let weak = app.as_weak();

    // What:     `let engine = Rc::new(Engine::spawn(move |update| { ... }));`. Start
    //           the engine, giving it a callback that forwards each `Update` to the
    //           UI thread. `move` makes the closure own `weak`. Wrap the engine in
    //           `Rc` so multiple UI callbacks can share it.
    // Why:      One engine, shared by all the button handlers.
    // TS map:   `const engine = Engine.spawn(update => { ... });`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const engine = Engine.spawn(update => postToUiThread(() => applyUpdate(app, update)));
    // ```
    let engine = Rc::new(Engine::spawn(move |update| {
        // What:     `let weak = weak.clone();`. Clone the weak handle for this call
        //           (the outer closure is called repeatedly, so it cannot move
        //           `weak` out).
        // Why:      Each update needs its own handle to move into the inner closure.
        // TS map:   `const w = weak;`
        let weak = weak.clone();
        // What:     `let _ = slint::invoke_from_event_loop(move || { ... });`. Run
        //           the inner closure ON the UI/event-loop thread (required for
        //           touching window properties). `let _ =` ignores the result
        //           (it errs only if the loop is gone, e.g. during shutdown).
        // Why:      Updates arrive on the engine thread but must be applied on the
        //           UI thread.
        // TS map:   `queueMicrotaskOnUiThread(() => { ... });`
        let _ = slint::invoke_from_event_loop(move || {
            // What:     `if let Some(app) = weak.upgrade() { apply_update(&app, update); }`.
            //           `upgrade()` turns the weak handle back into a strong one if
            //           the window still exists; if so, apply the update.
            // Why:      The window may have closed before this runs.
            // TS map:   `const app = weak.deref(); if (app) applyUpdate(app, update);`
            if let Some(app) = weak.upgrade() {
                apply_update(&app, update);
            }
        });
    }));

    // What:     `app.on_toggle_play({ let engine = engine.clone(); move || engine.send(Command::TogglePlay) });`.
    //           Register the play/pause handler. The block clones the `Rc<Engine>`
    //           and returns a `move` closure that owns the clone. `on_toggle_play`
    //           is the generated registrar for the `toggle-play` callback.
    // Why:      Button press -> engine command.
    // TS map:   `app.onTogglePlay(() => engine.send(Command.TogglePlay));`
    app.on_toggle_play({
        // What:     `let engine = engine.clone();`. A shared-owner clone for this
        //           closure (cheap: bumps the reference count).
        // Why:      The closure must own an engine handle that outlives this scope.
        // TS map:   `const e = engine;`
        let engine = engine.clone();
        // What:     `move || engine.send(Command::TogglePlay)`. The handler.
        // Why:      Ask the engine to toggle.
        // TS map:   `() => engine.send(Command.TogglePlay)`
        move || engine.send(Command::TogglePlay)
    });

    // What:     `app.on_prev(...)`. Previous-track handler.
    // Why:      Prev button.
    // TS map:   `app.onPrev(() => engine.send(Command.Prev));`
    app.on_prev({
        let engine = engine.clone();
        move || engine.send(Command::Prev)
    });

    // What:     `app.on_next(...)`. Next-track handler.
    // Why:      Next button.
    // TS map:   `app.onNext(() => engine.send(Command.Next));`
    app.on_next({
        let engine = engine.clone();
        move || engine.send(Command::Next)
    });

    // What:     `app.on_seek(move |secs| ...)`. Seek handler. The closure takes the
    //           slider value `secs: f32` and forwards it as `f64` seconds.
    // Why:      Dragging the seek bar jumps playback.
    // TS map:   `app.onSeek(secs => engine.send(Command.Seek(secs)));`
    app.on_seek({
        let engine = engine.clone();
        move |secs| engine.send(Command::Seek(secs as f64))
    });

    // What:     `app.on_set_volume(move |v| ...)`. Volume handler; `v: f32` gain.
    // Why:      Volume slider.
    // TS map:   `app.onSetVolume(v => engine.send(Command.SetVolume(v)));`
    app.on_set_volume({
        let engine = engine.clone();
        move |v| engine.send(Command::SetVolume(v))
    });

    // What:     `app.on_toggle_shuffle(...)`. Reads the current shuffle property
    //           and sends its opposite. Needs a weak handle to read the property.
    // Why:      The engine command carries the desired boolean, not a "toggle".
    // TS map:   `app.onToggleShuffle(() => engine.send(Command.SetShuffle(!app.shuffle)));`
    app.on_toggle_shuffle({
        let engine = engine.clone();
        // What:     `let weak = app.as_weak();`. Weak handle to read the property.
        // Why:      Closures cannot borrow `app` for `'static`; a weak handle can.
        // TS map:   `const w = app;`
        let weak = app.as_weak();
        // What:     `move || { if let Some(app) = weak.upgrade() { engine.send(Command::SetShuffle(!app.get_shuffle())); } }`.
        //           Upgrade, read `get_shuffle()`, send the inverse.
        // Why:      Compute the new state from the current one.
        // TS map:   `() => engine.send(Command.SetShuffle(!app.shuffle))`
        move || {
            if let Some(app) = weak.upgrade() {
                engine.send(Command::SetShuffle(!app.get_shuffle()));
            }
        }
    });

    // What:     `app.on_cycle_repeat(...)`. Advances the repeat mode Off->All->One->Off.
    // Why:      One button cycles through the three modes.
    // TS map:   `app.onCycleRepeat(() => engine.send(Command.SetRepeat(next)));`
    app.on_cycle_repeat({
        let engine = engine.clone();
        let weak = app.as_weak();
        // What:     `move || { ... }`. Read the current mode int, add one modulo
        //           `REPEAT_MODES`, convert back, and send.
        // Why:      Cycle the mode.
        // TS map:   `() => { const next = (app.repeatMode + 1) % 3; engine.send(...); }`
        move || {
            if let Some(app) = weak.upgrade() {
                // What:     `let next = int_to_repeat((app.get_repeat_mode() + 1) % REPEAT_MODES);`.
                //           `%` wraps 2 -> 0. Convert the int back to the enum.
                // Why:      Next mode in the cycle.
                // TS map:   `const next = intToRepeat((app.repeatMode + 1) % 3);`
                let next = int_to_repeat((app.get_repeat_mode() + 1) % REPEAT_MODES);
                // What:     `engine.send(Command::SetRepeat(next));`. Apply it.
                // Why:      Tell the engine.
                // TS map:   `engine.send(Command.SetRepeat(next));`
                engine.send(Command::SetRepeat(next));
            }
        }
    });

    // What:     `app.on_play_index(move |i| ...)`. Click-to-play handler; `i: i32`
    //           is the queue row. Sent as a `usize` index.
    // Why:      Clicking a queue row plays it.
    // TS map:   `app.onPlayIndex(i => engine.send(Command.PlayIndex(i)));`
    app.on_play_index({
        let engine = engine.clone();
        move |i| engine.send(Command::PlayIndex(i as usize))
    });

    // What:     `app.on_open_files(...)`. Opens the file picker on a SEPARATE
    //           thread (the dialog blocks) and sends the chosen files.
    // Why:      A blocking dialog must not freeze the UI event loop.
    // TS map:   `app.onOpenFiles(() => { showPickerAsync().then(files => tx.send(...)); });`
    app.on_open_files({
        // What:     `let tx = engine.sender();`. A `Send` clone of the command
        //           channel for the picker thread (the `Rc<Engine>` is `!Send`).
        // Why:      The thread cannot hold the `Rc`; it holds the sender instead.
        // TS map:   `const tx = engine.sender();`
        let tx = engine.sender();
        // What:     `move || { ... }`. The handler.
        // Why:      Launch the picker.
        // TS map:   `() => { ... }`
        move || {
            // What:     `let tx = tx.clone();`. Clone the sender for this thread.
            // Why:      Each open spawns a fresh thread that owns its own sender.
            // TS map:   `const t = tx;`
            let tx = tx.clone();
            // What:     `std::thread::spawn(move || { ... });`. Run the dialog off
            //           the UI thread.
            // Why:      Keep the UI responsive while the dialog is open.
            // TS map:   `runInWorker(() => { ... });`
            std::thread::spawn(move || {
                // What:     `if let Some(files) = rfd::FileDialog::new().pick_files() { ... }`.
                //           Show a multi-file picker (XDG portal on Wayland). Returns
                //           `Some(Vec<PathBuf>)` if the user chose files, else `None`.
                // Why:      Let the user enqueue files.
                // TS map:   `const files = await showOpenDialog({ multiple: true }); if (files) { ... }`
                if let Some(files) = rfd::FileDialog::new().pick_files() {
                    // What:     `let _ = tx.send(Command::OpenPaths(files));`. Send the
                    //           selection to the engine; ignore a send error (engine gone).
                    // Why:      Replace the queue with the chosen files.
                    // TS map:   `tx.send(Command.OpenPaths(files));`
                    let _ = tx.send(Command::OpenPaths(files));
                }
            });
        }
    });

    // What:     `let cli_paths: Vec<PathBuf> = std::env::args().skip(1).map(PathBuf::from).collect();`.
    //           Collect command-line arguments after the program name into paths.
    //           `skip(1)` drops `argv[0]`; `.map(PathBuf::from)` converts each.
    // Why:      Allow `music-player file1 dir2 ...` to enqueue on launch.
    // TS map:   `const cliPaths = process.argv.slice(2);`
    let cli_paths: Vec<PathBuf> = std::env::args().skip(1).map(PathBuf::from).collect();
    // What:     `if !cli_paths.is_empty() { ... } else { ... }`. CLI paths take
    //           precedence over a saved session; with no paths, restore the
    //           last session instead.
    // Why:      Opening files explicitly should override resuming.
    // TS map:   `if (cliPaths.length) { ... } else { ... }`
    if !cli_paths.is_empty() {
        // What:     `engine.send(Command::OpenPaths(cli_paths));`. Enqueue and play.
        // Why:      Honour CLI arguments.
        // TS map:   `engine.send(Command.OpenPaths(cliPaths));`
        engine.send(Command::OpenPaths(cli_paths));
    } else {
        // What:     `let session = Session::load();`. Read the saved session
        //           (returns defaults if none/corrupt; prunes moved files).
        // Why:      Resume where the user left off.
        // TS map:   `const session = Session.load();`
        let session = Session::load();
        // What:     `if !session.tracks.is_empty() { engine.send(Command::Restore { ... }); }`.
        //           Only restore when a non-empty queue survived pruning.
        // Why:      Nothing to resume otherwise.
        // TS map:   `if (session.tracks.length) engine.send({ kind: "restore", ... });`
        if !session.tracks.is_empty() {
            engine.send(Command::Restore {
                tracks: session.tracks,
                current: session.current,
                position: session.position_secs,
                volume: session.volume,
                shuffle: session.shuffle,
                repeat: session.repeat,
            });
        }
    }

    // What:     `app.run()`. Show the window and run the event loop until it
    //           closes; returns `Result<(), PlatformError>`. Tail -> return.
    //           When it returns, `app` and `engine` drop: the engine's `Drop`
    //           sends `Quit` and joins its thread, tearing down PipeWire.
    // Why:      Hand control to Slint.
    // TS map:   `return app.run();`
    app.run()
}
