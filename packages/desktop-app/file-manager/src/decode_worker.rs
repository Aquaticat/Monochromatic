//! The background preview-decode worker. Preview decoding is the one piece of
//! per-scroll work heavy enough to drop a frame, so it runs here, off the UI
//! thread. The UI sends a `DecodeRequest` (pane id plus colour seed) down a
//! channel; this worker produces the raw RGBA bytes and sends a `DecodeResult`
//! back; the UI thread does only the cheap wrap into a Slint image. When the
//! cache drops its request sender at shutdown, `recv` returns an error and the
//! worker thread exits.

/// What:     `use std::sync::mpsc::{Receiver, Sender};` imports the receiving and
///           sending halves of a multi-producer single-consumer channel (sibling:
///           `sync_channel`, which adds a bounded backpressure buffer).
/// Why:      One channel carries requests to the worker, another carries results
///           back to the UI thread.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // like a MessagePort pair between two workers
/// ```
use std::sync::mpsc::{Receiver, Sender};

/// What:     `use std::thread;` imports OS-thread spawning.
/// Why:      The decode runs on its own thread so the UI thread never blocks.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // like starting a Web Worker
/// ```
use std::thread;

/// What:     `use crate::preview::{decode_to_raw, encode_png, synthetic_rgba};`
///           imports the pixel-generation, encode, and decode helpers.
/// Why:      The worker synthesizes each preview's bytes and decodes them, all
///           off the UI thread.
use crate::preview::{decode_to_raw, encode_png, synthetic_rgba};

/// What:     `pub struct DecodeRequest` is one unit of work sent to the worker.
/// Why:      Carries the pane identity and the colour seed the worker needs.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type DecodeRequest = { paneId: number; seed: number };
/// ```
pub struct DecodeRequest {
    /// What:     `pub pane_id: u64` is the requesting pane's identity.
    /// Why:      The result must be routed back to the right pane.
    pub pane_id: u64,
    /// What:     `pub seed: u32` is the colour seed for the synthetic image.
    /// Why:      The worker regenerates the pixels from it.
    pub seed: u32,
}

/// What:     `pub struct DecodeResult` is one finished decode sent back to the UI.
/// Why:      Carries the raw RGBA bytes plus dimensions the UI wraps into an image.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type DecodeResult = { paneId: number; raw: Uint8Array; width: number; height: number };
/// ```
pub struct DecodeResult {
    /// What:     `pub pane_id: u64` is the pane this decode belongs to.
    /// Why:      The UI matches it to the pending pane.
    pub pane_id: u64,
    /// What:     `pub raw: Vec<u8>` is the decoded RGBA byte buffer (owned).
    /// Why:      The UI copies it into a Slint pixel buffer.
    pub raw: Vec<u8>,
    /// What:     `pub width: u32` is the decoded image width in pixels.
    /// Why:      The Slint buffer needs the dimensions.
    pub width: u32,
    /// What:     `pub height: u32` is the decoded image height in pixels.
    /// Why:      Same, the buffer height.
    pub height: u32,
}

/// What:     `fn decode_job(seed: u32) -> Option<(Vec<u8>, u32, u32)>` produces the
///           raw RGBA for one preview: synthesize pixels, encode to PNG, decode
///           back. `Option` is `Some` on success, `None` on any failure.
/// Why:      The whole heavy path runs on the worker thread; the round-trip
///           exercises the real `image` crate decode a disk-backed file would use.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function decodeJob(seed: number): [Uint8Array, number, number] | undefined { ... }
/// ```
fn decode_job(seed: u32) -> Option<(Vec<u8>, u32, u32)> {
    // What:     `let raw = synthetic_rgba(seed);` builds the source pixels.
    // Why:      Stand-in for reading the file's pixels.
    let raw = synthetic_rgba(seed);
    // What:     `let png = encode_png(&raw).ok()?;`. `.ok()` turns the `Result`
    //           into an `Option` (dropping the error); `?` returns `None` early if
    //           it was `Err`.
    // Why:      Stand-in for the on-disk compressed bytes.
    let png = encode_png(&raw).ok()?;
    // What:     `let (rgba, width, height) = decode_to_raw(&png).ok()?;` decodes and
    //           destructures the tuple, again `None` on failure.
    // Why:      The expensive decode, kept off the UI thread.
    let (rgba, width, height) = decode_to_raw(&png).ok()?;
    // What:     `Some((rgba, width, height))` wraps the result; tail expression.
    // Why:      Hand the decoded bytes back to the caller.
    Some((rgba, width, height))
}

/// What:     `pub fn spawn_decode_worker(requests: Receiver<DecodeRequest>, results:
///           Sender<DecodeResult>)` starts the background decode thread.
/// Why:      One long-lived worker drains the request queue for the app's lifetime.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function spawnDecodeWorker(requests, results) { /* start a worker loop */ }
/// ```
pub fn spawn_decode_worker(requests: Receiver<DecodeRequest>, results: Sender<DecodeResult>) {
    // What:     `thread::spawn(move || { ... });` starts a new OS thread running the
    //           closure; `move` transfers ownership of both channel ends into it.
    // Why:      The worker owns the request receiver and the result sender.
    thread::spawn(move || {
        // What:     `while let Ok(request) = requests.recv() { ... }` blocks until a
        //           request arrives; `recv` returns `Err` when every sender is
        //           dropped, ending the loop and the thread.
        // Why:      Process requests one at a time; exit cleanly at shutdown.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // for await (const request of requests) { ... }
        // ```
        while let Ok(request) = requests.recv() {
            // What:     `if let Some((raw, width, height)) = decode_job(request.seed)
            //           { ... }` runs the decode and matches success.
            // Why:      Only forward successful decodes.
            if let Some((raw, width, height)) = decode_job(request.seed) {
                // What:     `let _ = results.send(DecodeResult { ... });`. `send`
                //           returns `Err` if the UI dropped its receiver at
                //           shutdown; `let _ =` intentionally ignores that.
                // Why:      Deliver the decoded bytes; a gone UI is not an error.
                let _ = results.send(DecodeResult {
                    pane_id: request.pane_id,
                    raw,
                    width,
                    height,
                });
            } else {
                // What:     `tracing::error!(...)` logs a failed decode.
                // Why:      A synthetic decode should never fail; surface it if so.
                tracing::error!(pane_id = request.pane_id, "preview decode job failed");
            }
        }
    });
}
