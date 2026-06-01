//! Library root for the `player` music player. The binary (`main.rs`) wires
//! these modules to the Slint UI; keeping the logic in a library lets the pure
//! parts (queue, session) be unit-tested without any audio or GUI.

// What:     `pub mod command;` declares and re-exports the `command` module
//           (the file `src/command.rs`). `pub` makes it visible to the binary
//           and to tests.
// Why:      Shared command/update message types live there.
// TS map:   `export * as command from "./command";`
pub mod command;

// What:     `pub mod queue;` the play-queue model module.
// Why:      Pure traversal/shuffle/repeat logic, unit-tested.
// TS map:   `export * as queue from "./queue";`
pub mod queue;

// What:     `pub mod session;` the save/restore module.
// Why:      Persists the last session to disk.
// TS map:   `export * as session from "./session";`
pub mod session;

// What:     `pub mod error;` the shared error type module.
// Why:      `PlayerError` is the one error all fallible functions return.
// TS map:   `export * as error from "./error";`
pub mod error;

// What:     `pub mod decode;` the decoding module (`src/decode.rs`).
// Why:      Probes files and yields interleaved f32 PCM via the `Source` trait.
// TS map:   `export * as decode from "./decode";`
pub mod decode;

// What:     `pub mod opus;` the Opus decode path (`src/opus.rs`).
// Why:      libopus-backed `Source` for Opus, which symphonia cannot decode.
// TS map:   `export * as opus from "./opus";`
pub mod opus;

// What:     `pub mod output;` the PipeWire audio output module (`src/output.rs`).
// Why:      Thin FFI boundary: streams `f32` PCM to PipeWire via a ring buffer.
// TS map:   `export * as output from "./output";`
pub mod output;

// What:     `pub mod engine;` the controller-thread module (`src/engine.rs`).
// Why:      Owns the queue + decoder + output; turns commands into playback.
// TS map:   `export * as engine from "./engine";`
pub mod engine;
