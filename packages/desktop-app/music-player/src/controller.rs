//! Controller: all mutable playback state, owned by the engine worker thread.
//! It holds the queue, the active decoder, the PipeWire output, and the shared
//! true-peak cache. This file has the state struct, command handling, and the
//! background-measurement kickoff; the loading and audio-pumping methods live in
//! `controller_audio.rs` (a second `impl Controller` block, kept separate so each
//! file stays within the line budget). The type stays crate-private because it
//! holds the `!Send` `Output` and never leaves its thread.

// What:     `use std::sync::{Arc, Mutex};`. `Arc<T>` is a thread-safe shared owner
//           (atomic refcount; sibling: single-thread `Rc<T>`); `Mutex<T>` guards `T`
//           so one thread touches it at a time.
// Why:      The peak cache is shared with background measurement threads.
// TS map:   no equivalent; `Arc<Mutex<T>>` ~ "a shared, lockable object".
use std::sync::{Arc, Mutex};

// What:     `use ringbuf::HeapProd;`. The WRITE half of a heap ring buffer.
// Why:      The `producer` field type.
// TS map:   `type HeapProd<T> = RingProducer<T>;`
use ringbuf::HeapProd;

// What:     `use crate::command::{Command, Update};`. The UI->engine and engine->UI
//           message enums.
// Why:      We match `Command`s and emit `Update`s.
// TS map:   `import { Command, Update } from "./command";`
use crate::command::{Command, Update};

// What:     `use crate::decode::{AudioSpec, Source};`. `AudioSpec` describes a decoded
//           stream; `Source` is the decoder trait (a `Box<dyn Source>` field).
// Why:      Struct fields name both types.
// TS map:   `import { AudioSpec, Source } from "./decode";`
use crate::decode::{AudioSpec, Source};

// What:     `use crate::measure::spawn_queue_measurement;`. Starts the background
//           sweep that pre-measures a queue's tracks.
// Why:      Called on every queue load.
// TS map:   `import { spawnQueueMeasurement } from "./measure";`
use crate::measure::spawn_queue_measurement;

// What:     `use crate::output::Output;`. The PipeWire output (FFI boundary).
// Why:      The `output` field and `new`'s parameter name it.
// TS map:   `import { Output } from "./output";`
use crate::output::Output;

// What:     `use crate::peakcache::PeakCache;`. The persistent true-peak cache.
// Why:      The shared `peaks` field's inner type.
// TS map:   `import { PeakCache } from "./peakcache";`
use crate::peakcache::PeakCache;

// What:     `use crate::playback::expand_paths;`. Folder-to-file expansion.
// Why:      `OpenPaths` expands folders into their tracks.
// TS map:   `import { expandPaths } from "./playback";`
use crate::playback::expand_paths;

// What:     `use crate::queue::Queue;`. The pure play-queue model.
// Why:      The `queue` field and `Queue::new()` name it.
// TS map:   `import { Queue } from "./queue";`
use crate::queue::Queue;

// What:     `pub(crate) struct Controller { ... }`. All mutable playback state, owned
//           by the worker thread. Not `Send` (holds the `!Send` `Output`), which is
//           fine because it never leaves this thread. `pub(crate)` so `engine::run`
//           can drive it. Fields are `pub(crate)` too so the second `impl` block in
//           `controller_audio.rs` can reach them.
// Why:      Bundle the state so methods can mutate it.
// TS map:   `class Controller { ... }`
pub(crate) struct Controller {
    // What:     `on_update: Box<dyn Fn(Update) + Send>`. The UI callback.
    // Why:      Push state changes back to the UI.
    // TS map:   `onUpdate: (u: Update) => void;`
    pub(crate) on_update: Box<dyn Fn(Update) + Send>,
    // What:     `output: Option<Output>`. The PipeWire output, or `None` in silent mode.
    // Why:      Reconfigured per track; absent if audio init failed.
    // TS map:   `output: Output | null;`
    pub(crate) output: Option<Output>,
    // What:     `queue: Queue`. The play-queue model.
    // Why:      Decides track order and current track.
    // TS map:   `queue: Queue;`
    pub(crate) queue: Queue,
    // What:     `source: Option<Box<dyn Source>>`. The active decoder, or `None`.
    // Why:      Produces the PCM we push.
    // TS map:   `source: Source | null;`
    pub(crate) source: Option<Box<dyn Source>>,
    // What:     `producer: Option<HeapProd<f32>>`. The ring-buffer write end, or `None`.
    // Why:      Where decoded samples go.
    // TS map:   `producer: RingProducer | null;`
    pub(crate) producer: Option<HeapProd<f32>>,
    // What:     `spec: Option<AudioSpec>`. The current track's rate/channels/duration.
    // Why:      Drives position math and reconfigure calls.
    // TS map:   `spec: AudioSpec | null;`
    pub(crate) spec: Option<AudioSpec>,
    // What:     `playing: bool`. Whether we are actively feeding audio.
    // Why:      Pause/play gate.
    // TS map:   `playing: boolean;`
    pub(crate) playing: bool,
    // What:     `volume: f32`. Linear user gain 0.0..=1.0 applied to samples.
    // Why:      Volume control (PCM-gain approach).
    // TS map:   `volume: number;`
    pub(crate) volume: f32,
    // What:     `track_gain: f32`. The current track's normalization gain (<=1.0),
    //           from true-peak measurement. Multiplied with `volume` per sample.
    // Why:      Per-track true-peak normalization to the -1 dBTP ceiling.
    // TS map:   `trackGain: number;`
    pub(crate) track_gain: f32,
    // What:     `peaks: Arc<Mutex<PeakCache>>`. The shared, persistent true-peak cache.
    // Why:      Read on track load; written by load + background sweeps.
    // TS map:   `peaks: SharedPeakCache;`
    pub(crate) peaks: Arc<Mutex<PeakCache>>,
    // What:     `position_frames: u64`. Frames pushed for the current track so far.
    //           `u64` because long tracks exceed `u32` frame counts.
    // Why:      Position seconds = frames / rate.
    // TS map:   `positionFrames: number;`
    pub(crate) position_frames: u64,
    // What:     `last_emit_secs: f64`. Position (seconds) at the last `Position` update.
    // Why:      Throttle update frequency.
    // TS map:   `lastEmitSecs: number;`
    pub(crate) last_emit_secs: f64,
    // What:     `pending: Vec<f32>`. Gained samples decoded but not yet fully pushed.
    // Why:      Resume pushing them next cycle instead of dropping audio.
    // TS map:   `pending: number[];`
    pub(crate) pending: Vec<f32>,
    // What:     `pending_pos: usize`. How many of `pending` are already pushed.
    // Why:      Push the remainder `pending[pending_pos..]` next time.
    // TS map:   `pendingPos: number;`
    pub(crate) pending_pos: usize,
}

// What:     `impl Controller { ... }`. The command/state half of the behaviour.
// Why:      Construction, command handling, and the measurement kickoff.
// TS map:   part of the class body.
impl Controller {
    // What:     `pub(crate) fn new(on_update: Box<dyn Fn(Update) + Send>, output: Option<Output>) -> Controller`.
    //           Build initial state (empty queue, nothing playing, full volume + gain,
    //           loaded peak cache). `pub(crate)` so `engine::run` can construct it.
    // Why:      Starting point for the worker.
    // TS map:   `constructor(onUpdate, output)`
    pub(crate) fn new(
        on_update: Box<dyn Fn(Update) + Send>,
        output: Option<Output>,
    ) -> Controller {
        // What:     `Controller { ... }`. Struct literal. `Queue::new()` empty queue;
        //           volume/gain start at 1.0; `PeakCache::load()` reads any saved peaks;
        //           `Arc::new(Mutex::new(...))` wraps it for sharing.
        // Why:      A clean idle state with the cache ready.
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
            track_gain: 1.0,
            peaks: Arc::new(Mutex::new(PeakCache::load())),
            position_frames: 0,
            last_emit_secs: 0.0,
            pending: Vec::new(),
            pending_pos: 0,
        }
    }

    // What:     `pub(crate) fn emit(&self, update: Update)`. Call the UI callback.
    //           `pub(crate)` because `controller_audio.rs` also emits.
    // Why:      One place to push updates out.
    // TS map:   `emit(update) { this.onUpdate(update); }`
    pub(crate) fn emit(&self, update: Update) {
        // What:     `(self.on_update)(update);`. Call the boxed closure. The parens make
        //           it call the field, not a method.
        // Why:      Deliver the update to the UI.
        // TS map:   `this.onUpdate(update);`
        (self.on_update)(update);
    }

    // What:     `fn set_playing(&mut self, on: bool)`. Set the flag and tell the UI.
    // Why:      Keep the play/pause button in sync.
    // TS map:   `setPlaying(on) { ... }`
    fn set_playing(&mut self, on: bool) {
        // What:     `self.playing = on;`. Update the gate.
        // Why:      Pump respects it.
        // TS map:   `this.playing = on;`
        self.playing = on;
        // What:     `if let Some(output) = self.output.as_ref() { output.set_playing(on); }`.
        //           Tell the audio output (no-op in silent mode). `.as_ref()` borrows
        //           the `Option<Output>` as `Option<&Output>`.
        // Why:      The realtime callback reacts instantly: on pause it stops draining
        //           the ring buffer and emits silence, so buffered audio does not keep
        //           playing (the pause-delay bug).
        // TS map:   `this.output?.setPlaying(on);`
        if let Some(output) = self.output.as_ref() {
            output.set_playing(on);
        }
        // What:     `self.emit(Update::Playing(on));`. Mirror to the UI.
        // Why:      Visual state.
        // TS map:   `this.emit({ kind: "playing", on });`
        self.emit(Update::Playing(on));
    }

    // What:     `fn start_queue_measurement(&self)`. Kick off the background sweep that
    //           pre-measures every track in the current queue into the shared cache.
    //           Read-only borrow (it only clones the track list and the cache handle).
    // Why:      Called on every queue load so later track changes hit the cache.
    // TS map:   `startQueueMeasurement(): void`
    fn start_queue_measurement(&self) {
        // What:     `spawn_queue_measurement(self.queue.tracks().to_vec(), Arc::clone(&self.peaks));`.
        //           Spawn the detached sweep. `self.queue.tracks().to_vec()` clones the
        //           queue's paths into an owned `Vec`; `Arc::clone(&self.peaks)` makes
        //           another shared handle to the cache (bumps the refcount, same data).
        // Why:      Hand the worker its own owned inputs; it runs independently.
        // TS map:   `spawnQueueMeasurement([...this.queue.tracks()], this.peaks);`
        spawn_queue_measurement(self.queue.tracks().to_vec(), Arc::clone(&self.peaks));
    }

    // What:     `pub(crate) fn handle_command(&mut self, command: Command)`. Apply one
    //           UI command. `pub(crate)` so `engine::run` can call it.
    // Why:      The core of UI control.
    // TS map:   `handleCommand(command: Command): void`
    pub(crate) fn handle_command(&mut self, command: Command) {
        // What:     `match command { ... }`. Dispatch on the command variant.
        // Why:      Each command does a different thing.
        // TS map:   `switch (command.kind) { ... }`
        match command {
            // What:     `Command::OpenPaths { paths, play } => { ... }`. Replace the
            //           queue with the given files/folders, load the first track, and
            //           play it only when `play` is true.
            // Why:      Opening replaces the queue; the launch auto-load loads paused.
            // TS map:   `case "openPaths": { const { paths, play } = command; ... }`
            Command::OpenPaths { paths, play } => {
                // What:     `let tracks = expand_paths(paths);`. Folders -> their files.
                // Why:      The queue holds files, not directories.
                // TS map:   `const tracks = expandPaths(paths);`
                let tracks = expand_paths(paths);
                // What:     `self.queue.set_tracks(tracks);`. Replace the queue.
                // Why:      New playlist.
                // TS map:   `this.queue.setTracks(tracks);`
                self.queue.set_tracks(tracks);
                // What:     `self.emit(Update::Queue(self.queue.display_paths()));`. Send
                //           the relative-path list to the UI.
                // Why:      Render the queue list (grouped by folder / first letter).
                // TS map:   `this.emit({ kind: "queue", names: ... });`
                self.emit(Update::Queue(self.queue.display_paths()));
                // What:     `self.start_queue_measurement();`. Pre-measure the whole
                //           queue in the background (true-peak normalization cache).
                // Why:      Every queue load (open or auto-load) warms the peak cache.
                // TS map:   `this.startQueueMeasurement();`
                self.start_queue_measurement();
                // What:     `if self.queue.current_path().is_some() { ... } else { ... }`.
                //           Load the first track if the queue is non-empty.
                // Why:      Opening should make a track current.
                // TS map:   `if (this.queue.currentPath()) { ... } else { ... }`
                if self.queue.current_path().is_some() {
                    // What:     `let ok = self.load_current();`. Load the current track.
                    // Why:      Make it ready to play.
                    // TS map:   `const ok = this.loadCurrent();`
                    let ok = self.load_current();
                    // What:     `self.set_playing(play && ok);`. Play only if asked AND a
                    //           track loaded. `&&` short-circuits.
                    // Why:      Auto-load loads paused; a user open starts playback.
                    // TS map:   `this.setPlaying(play && ok);`
                    self.set_playing(play && ok);
                } else {
                    // What:     `self.set_playing(false);`. Empty queue -> stopped.
                    // Why:      Nothing to play.
                    // TS map:   `this.setPlaying(false);`
                    self.set_playing(false);
                }
            }
            // What:     `Command::TogglePlay => self.set_playing(!self.playing)`. Flip
            //           play/pause.
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
            // What:     `Command::Next => { ... }`. Advance (not a natural end) and load.
            // Why:      Next button.
            // TS map:   `case "next": ...`
            Command::Next => {
                // What:     `let moved = self.queue.advance(false);`. Step forward.
                // Why:      Decide whether to load or stop.
                // TS map:   `const moved = this.queue.advance(false);`
                let moved = self.queue.advance(false);
                // What:     `self.after_move(moved);`. Load the new current or stop.
                // Why:      Shared follow-up.
                // TS map:   `this.afterMove(moved);`
                self.after_move(moved);
            }
            // What:     `Command::Prev => { ... }`. Step backward and load.
            // Why:      Previous button.
            // TS map:   `case "prev": ...`
            Command::Prev => {
                // What:     `let moved = self.queue.prev();`. Step back.
                // Why:      Get the previous index, if any.
                // TS map:   `const moved = this.queue.prev();`
                let moved = self.queue.prev();
                // What:     `self.after_move(moved);`. Load or stop.
                // Why:      Shared follow-up.
                // TS map:   `this.afterMove(moved);`
                self.after_move(moved);
            }
            // What:     `Command::PlayIndex(index) => { ... }`. Jump to a queue slot.
            // Why:      Click-to-play in the queue list.
            // TS map:   `case "playIndex": ...`
            Command::PlayIndex(index) => {
                // What:     `if self.queue.play_index(index).is_some() { ... }`. Act only
                //           on a valid index.
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
            // What:     `Command::Seek(secs) => self.seek(secs)`. Jump within the track.
            // Why:      Seek bar drag.
            // TS map:   `case "seek": this.seek(secs);`
            Command::Seek(secs) => self.seek(secs),
            // What:     `Command::SetVolume(v) => { ... }`. Update the gain and mirror it.
            // Why:      Volume slider.
            // TS map:   `case "setVolume": ...`
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
            // What:     `Command::SetShuffle(mode) => { ... }`. Set the shuffle mode.
            // Why:      Shuffle radio group.
            // TS map:   `case "setShuffle": ...`
            Command::SetShuffle(mode) => {
                // What:     `self.queue.set_shuffle(mode);`. Rebuild the playback
                //           scope/order for the new mode, keeping the current track.
                // Why:      Apply the shuffle mode (off / within-page / all).
                // TS map:   `this.queue.setShuffle(mode);`
                self.queue.set_shuffle(mode);
                // What:     `self.emit(Update::Shuffle(mode));`. Mirror state. `mode`
                //           is `Copy`, so using it twice is fine.
                // Why:      Radio-group visual.
                // TS map:   `this.emit({ kind: "shuffle", mode });`
                self.emit(Update::Shuffle(mode));
            }
            // What:     `Command::SetRepeatTrack(on) => { ... }`. Toggle "repeat track".
            // Why:      Repeat-track checkbox.
            // TS map:   `case "setRepeatTrack": ...`
            Command::SetRepeatTrack(on) => {
                // What:     `self.queue.set_repeat_track(on);`. Apply it.
                // Why:      Affects natural-end behaviour (replay current track).
                // TS map:   `this.queue.setRepeatTrack(on);`
                self.queue.set_repeat_track(on);
                // What:     `self.emit(Update::RepeatTrack(on));`. Mirror state.
                // Why:      Checkbox visual.
                // TS map:   `this.emit({ kind: "repeatTrack", on });`
                self.emit(Update::RepeatTrack(on));
            }
            // What:     `Command::Restore { ... } => { ... }`. Reinstate a saved session,
            //           loading the current track PAUSED at the saved position.
            // Why:      Resume where the user left off, on launch.
            // TS map:   `case "restore": { const { tracks, current, ... } = command; ... }`
            Command::Restore {
                tracks,
                current,
                position,
                volume,
                shuffle,
                repeat_track,
            } => {
                // What:     `self.volume = volume;`. Restore the saved gain.
                // Why:      Applied to decoded samples.
                // TS map:   `this.volume = volume;`
                self.volume = volume;
                // What:     `self.queue.set_repeat_track(repeat_track);`. Restore the
                //           "repeat track" flag.
                // Why:      Affects auto-advance (replay current on natural end).
                // TS map:   `this.queue.setRepeatTrack(repeatTrack);`
                self.queue.set_repeat_track(repeat_track);
                // What:     `self.queue.set_tracks(tracks);`. Rebuild the queue.
                // Why:      Restore the playlist.
                // TS map:   `this.queue.setTracks(tracks);`
                self.queue.set_tracks(tracks);
                // What:     `self.queue.set_shuffle(shuffle);`. Restore shuffle ordering.
                // Why:      Restore shuffle state.
                // TS map:   `this.queue.setShuffle(shuffle);`
                self.queue.set_shuffle(shuffle);
                // What:     `self.start_queue_measurement();`. Pre-measure the restored
                //           queue in the background, like any other queue load.
                // Why:      Warm the peak cache for the restored tracks too.
                // TS map:   `this.startQueueMeasurement();`
                self.start_queue_measurement();
                // What:     `if let Some(idx) = current { self.queue.play_index(idx); }`.
                //           Move the cursor to the saved current track, if any.
                // Why:      Resume on the right track.
                // TS map:   `if (current != null) this.queue.playIndex(current);`
                if let Some(idx) = current {
                    self.queue.play_index(idx);
                }
                // What:     `self.emit(Update::Queue(self.queue.display_paths()));`. Push
                //           the relative-path list to the UI.
                // Why:      Render the restored queue (grouped by folder / first letter).
                // TS map:   `this.emit({ kind: "queue", names: ... });`
                self.emit(Update::Queue(self.queue.display_paths()));
                // What:     `self.emit(Update::Volume(volume));`. Mirror volume.
                // Why:      Sync the slider.
                // TS map:   `this.emit({ kind: "volume", volume });`
                self.emit(Update::Volume(volume));
                // What:     `self.emit(Update::Shuffle(self.queue.shuffle_mode()));`.
                //           Mirror the shuffle mode.
                // Why:      Sync the radio group.
                // TS map:   `this.emit({ kind: "shuffle", mode: ... });`
                self.emit(Update::Shuffle(self.queue.shuffle_mode()));
                // What:     `self.emit(Update::RepeatTrack(self.queue.repeat_track()));`.
                //           Mirror the "repeat track" flag.
                // Why:      Sync the checkbox.
                // TS map:   `this.emit({ kind: "repeatTrack", on: ... });`
                self.emit(Update::RepeatTrack(self.queue.repeat_track()));
                // What:     `self.playing = false;`. Restore PAUSED.
                // Why:      Resuming should not blast audio on launch.
                // TS map:   `this.playing = false;`
                self.playing = false;
                // What:     `let loaded = self.load_current();`. Load the current track.
                // Why:      Make it ready to play from the saved position.
                // TS map:   `const loaded = this.loadCurrent();`
                let loaded = self.load_current();
                // What:     `self.emit(Update::Playing(false));`. Mirror paused state.
                // Why:      Show the Play button.
                // TS map:   `this.emit({ kind: "playing", on: false });`
                self.emit(Update::Playing(false));
                // What:     `if loaded && position > 0.0 { self.seek(position); }`. Jump
                //           to the saved position if a track loaded.
                // Why:      Resume mid-track.
                // TS map:   `if (loaded && position > 0) this.seek(position);`
                if loaded && position > 0.0 {
                    self.seek(position);
                }
            }
            // What:     `Command::Quit => {}`. Handled in `run`'s drain loop; this arm
            //           keeps the match exhaustive.
            // Why:      Rust requires every variant to be matched.
            // TS map:   `case "quit": break; // handled elsewhere`
            Command::Quit => {}
        }
    }

    // What:     `pub(crate) fn after_move(&mut self, moved: Option<usize>)`. Shared
    //           follow-up for Next/Prev/natural-end: load the new current track, or stop
    //           at the end. `pub(crate)` so `on_track_end` (in `controller_audio.rs`)
    //           can call it.
    // Why:      Avoid duplicating the load-or-stop logic.
    // TS map:   `afterMove(moved: number | null): void`
    pub(crate) fn after_move(&mut self, moved: Option<usize>) {
        // What:     `match moved { ... }`. `Some` = a track to load; `None` = end.
        // Why:      Two outcomes.
        // TS map:   `if (moved != null) { ... } else { ... }`
        match moved {
            // What:     `Some(_) => { if !self.load_current() { self.set_playing(false); } }`.
            //           Load it; stop if loading failed. `_` ignores the index.
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
}
