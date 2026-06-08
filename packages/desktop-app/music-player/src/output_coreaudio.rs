//! CoreAudio output (macOS): the thin cross-platform-audio boundary, the
//! Apple-Silicon counterpart to `output_pipewire.rs`. It exposes the SAME
//! `Output` surface the engine already drives (`Output::new`,
//! `Output::reconfigure`, `Output::set_playing`), so nothing outside this file
//! changes between platforms.
//!
//! Mental model for a TypeScript reader: cpal is a small Rust library that
//! talks to the operating system's audio engine (CoreAudio here, the macOS
//! sound server). We pick the default output device, and per track we open an
//! output "stream" at that track's sample rate. cpal calls a callback on a
//! realtime thread whenever the speakers need more samples; that callback
//! copies samples out of a lock-free queue (the ring buffer) into the buffer
//! cpal hands us. We give the WRITE end of that queue back to the engine, just
//! like the PipeWire backend does.
//!
//! Unlike the PipeWire path, the bytes cpal hands us are ALREADY `f32` (it asks
//! us for the sample type), so there is no little-endian byte conversion and no
//! scratch buffer: we pop straight into cpal's buffer.
//!
//! `cpal::Stream` is `!Send` on macOS (it keeps a non-thread-safe handle), so
//! `Output` is created, used, and dropped entirely on the engine's controller
//! thread; only the realtime callback runs elsewhere, and it touches only the
//! ring-buffer consumer it was given. Stopping is automatic: dropping the
//! `Stream` (on reconfigure, or when `Output` drops) stops and disposes it, so
//! no manual `Drop` impl is needed (the PipeWire path needed one only to order
//! its background-loop teardown).

// What:     `use std::sync::atomic::{AtomicBool, Ordering};`. `AtomicBool` is a
//           `bool` that can be read/written from multiple threads WITHOUT a lock
//           (the hardware makes the access indivisible). `Ordering` says how
//           strictly the access is ordered against other memory operations;
//           siblings range from `Relaxed` (loosest) to `SeqCst` (strictest).
// Why:      The engine thread flips a "playing" flag and the realtime audio
//           callback reads it; a plain `bool` shared across threads is undefined
//           behaviour, so it must be atomic.
// TS map:   no real equivalent (JS is single-threaded). Mentally: a one-slot
//           shared cell both threads poke safely, like a `SharedArrayBuffer`
//           `Int32Array` flag read with `Atomics.load`.
//
// In TS you'd write (pseudocode):
// ```ts
// let playing = false; // a cross-thread boolean flag
// ```
use std::sync::atomic::{AtomicBool, Ordering};

// What:     `use std::sync::Arc;`. `Arc<T>` is an ATOMICALLY reference-counted
//           shared pointer: cloning bumps a thread-safe counter, and the inner
//           `T` is freed when the last clone drops. Sibling: `Rc<T>`, the same
//           idea but NOT thread-safe (single-thread only).
// Why:      One `AtomicBool` must live in two places at once (the `Output` on
//           the engine thread and the realtime callback on cpal's thread); `Arc`
//           lets both hold a clone of one shared cell. `Rc` would not compile
//           because the cell crosses a thread boundary.
// TS map:   no equivalent; GC makes every object implicitly shared, so you would
//           just close over the same variable.
//
// In TS you'd write (pseudocode):
// ```ts
// // both closures capture the same `playing` variable
// ```
use std::sync::Arc;

// What:     `use std::thread::Thread;`. `Thread` is a cheap, cloneable HANDLE to
//           a running thread (it wraps an internal `Arc`). We only ever call
//           `.unpark()` on it. Sibling you might expect: `JoinHandle`, which OWNS
//           the thread and can wait for it; `Thread` is just a wake-able handle.
// Why:      The realtime audio callback holds one so it can wake (`unpark`) the
//           engine worker after it drains the ring buffer, telling it to decode
//           more.
// TS map:   `type Thread = WorkerRef;` (a reference you can post "wake up" to)
use std::thread::Thread;

// What:     `use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};`. These are
//           TRAITS (interfaces): importing them brings their methods into scope.
//           `HostTrait` gives `default_output_device`; `DeviceTrait` gives
//           `build_output_stream`; `StreamTrait` gives `play`. In Rust a trait's
//           methods are callable only when the trait is in scope.
// Why:      We call all three method families below, so all three traits must be
//           imported even though we never name the trait types directly.
// TS map:   like importing interfaces whose methods you then call; TS has no
//           "import the interface to unlock the method" rule, so this is extra.
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};

// What:     `use cpal::{BufferSize, SampleRate, StreamConfig};`. `StreamConfig`
//           is the struct describing a stream (channel count, sample rate, buffer
//           size). `SampleRate(u32)` is a tiny wrapper around the samples-per-
//           second number. `BufferSize` is an enum: `Default` (let CoreAudio
//           pick) or `Fixed(n)`.
// Why:      We build one `StreamConfig` per track to open the output stream at
//           that track's native rate and channel count.
// TS map:   `import { BufferSize, SampleRate, StreamConfig } from "cpal";`
use cpal::{BufferSize, SampleRate, StreamConfig};

// What:     `use ringbuf::traits::{Consumer, Split};`. These TRAITS bring methods
//           into scope: `Split::split` (cut a ring buffer into a producer and a
//           consumer half) and `Consumer::pop_slice` (drain samples out).
// Why:      We split the buffer and the callback pops from the consumer half.
// TS map:   importing interfaces whose methods we then call.
use ringbuf::traits::{Consumer, Split};

// What:     `use ringbuf::{HeapProd, HeapRb};`. `HeapRb<T>` is a heap-allocated
//           ring buffer; `.split()` yields a `HeapProd<T>` (write end) and a
//           `HeapCons<T>` (read end). We only NAME the producer and the buffer
//           here (the consumer is inferred), so the consumer type is not imported.
//           Both halves can live on different threads (single-producer,
//           single-consumer).
// Why:      A lock-free hand-off of samples from the decode thread to the
//           realtime audio thread.
// TS map:   no direct equivalent; imagine a fixed-size, lock-free `Array` queue
//           split into a writer object and a reader object.
use ringbuf::{HeapProd, HeapRb};

// What:     `use crate::error::PlayerError;`. Our one app-wide error type.
// Why:      Fallible methods here return `PlayerError`.
// TS map:   `import { PlayerError } from "@/error";`
use crate::error::PlayerError;

// What:     `pub struct Output { ... }`. Owns the CoreAudio output. Fields:
//           - `device: cpal::Device`. The default output device, OWNED and kept
//             so each `reconfigure` can build a fresh stream on it.
//           - `stream: Option<cpal::Stream>`. The current output stream, or
//             `None` before the first track. `Option<T>` is Rust's "value or
//             nothing" (it has no `null`); sibling `Some(x)` carries a value.
//           - `playing: Arc<AtomicBool>`. The MASTER play/pause flag, cloned into
//             each new stream's callback so the flag survives track changes.
//           - `worker: Thread`. The engine worker's thread handle, cloned into
//             each callback so it can `unpark()` the worker on drain.
// Why:      Mirrors the PipeWire `Output` field-for-field in PURPOSE so the
//           engine sees one identical type. `cpal::Device`/`Stream` replace the
//           PipeWire core/context/loop because cpal manages those internally.
// TS map:   `class Output { device; stream: Stream | null; playing; worker; }`
pub struct Output {
    // What:     `device: cpal::Device`. The chosen output device (speakers/DAC),
    //           owned by this struct. Sibling you might expect: a borrowed
    //           `&Device`, but we OWN it so it outlives every stream we build.
    // Why:      `build_output_stream` is a method on the device; keeping it lets
    //           per-track `reconfigure` reopen a stream without re-querying.
    // TS map:   `device: AudioDevice;`
    device: cpal::Device,
    // What:     `stream: Option<cpal::Stream>`. The live stream, or `None`.
    //           Dropping the `Stream` stops audio, so replacing this field is how
    //           we tear a track's stream down.
    // Why:      Recreated per track at that track's native rate/channels.
    // TS map:   `stream: AudioStream | null;`
    stream: Option<cpal::Stream>,
    // What:     `playing: Arc<AtomicBool>`. The shared play/pause flag (master
    //           copy). `set_playing` writes it from the engine thread; each
    //           callback reads a clone.
    // Why:      One shared cell keeps engine and audio thread in sync across track
    //           changes.
    // TS map:   `playing: { value: boolean };`
    playing: Arc<AtomicBool>,
    // What:     `worker: Thread`. The engine worker's thread handle, kept so each
    //           new stream's callback (built in `reconfigure`) gets a clone.
    // Why:      The callback uses it to `unpark()` the worker when the ring buffer
    //           drains, so the worker refills the freed space.
    // TS map:   `worker: WorkerRef;`
    worker: Thread,
}

// What:     `impl Output { ... }`. The methods for the CoreAudio output.
// Why:      Construction and per-track reconfiguration, same surface as PipeWire.
// TS map:   the class body.
impl Output {
    // What:     `pub fn new(worker: Thread) -> Result<Output, PlayerError>`. Pick
    //           the default output device and build a silent (stream-less)
    //           `Output`. `worker` is the engine worker's thread handle, taken by
    //           value (the caller hands us its own clone). `Result<T, E>` is
    //           Rust's typed success-or-failure (no exceptions); siblings `Ok(T)`
    //           and `Err(E)`.
    // Why:      One-time setup; we keep `worker` so per-track callbacks can wake
    //           the worker on drain. Matches the PipeWire `new` signature exactly.
    // TS map:   `static create(worker: WorkerRef): Output` (throwing on failure)
    pub fn new(worker: Thread) -> Result<Output, PlayerError> {
        // What:     `let host = cpal::default_host();`. The "host" is the audio
        //           API backend; on macOS there is exactly one (CoreAudio).
        // Why:      Devices are enumerated through a host.
        // TS map:   `const host = cpal.defaultHost();`
        let host = cpal::default_host();

        // What:     `let device = host.default_output_device().ok_or_else(|| ...)?;`.
        //           `default_output_device()` returns `Option<Device>` (`Some`
        //           with the system default, or `None` if there is no output).
        //           `.ok_or_else(|| PlayerError::Audio(...))` turns `None` into an
        //           `Err(PlayerError)`, building the message lazily via the closure
        //           `|| ...`. `?` unwraps the `Ok`/returns the `Err` early.
        //           `.to_string()` allocates an owned `String` from the `&str`
        //           literal because `PlayerError::Audio` holds an owned `String`,
        //           not a borrowed `&str` (the error outlives this call).
        // Why:      No output device means we cannot play; surface it as our error.
        // TS map:   `const device = host.defaultOutputDevice(); if (!device) throw new PlayerError("no default output device");`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const device = host.defaultOutputDevice();
        // if (!device) throw new PlayerError("audio: no default output device");
        // ```
        let device = host
            .default_output_device()
            .ok_or_else(|| PlayerError::Audio("no default output device".to_string()))?;

        // What:     `let playing = Arc::new(AtomicBool::new(false));`. Build the
        //           shared play/pause flag, initially `false` (paused).
        //           `Arc::new` heap-allocates the cell and starts its reference
        //           count at 1; `AtomicBool::new(false)` is the initial value.
        // Why:      A brand-new output is silent until the engine says play.
        // TS map:   `const playing = { value: false };`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const playing = { value: false };
        // ```
        let playing = Arc::new(AtomicBool::new(false));

        // What:     `Ok(Output { device, stream: None, playing, worker })`.
        //           Construct the struct (no stream yet) and wrap it in the
        //           success variant `Ok`. `stream: None` is the "no value yet"
        //           case of `Option`. Field shorthand for `device`/`playing`/
        //           `worker`. No trailing `;`, so this is the tail expression that
        //           the function returns.
        // Why:      Hand back the ready (but silent) output.
        // TS map:   `return new Output(device, null, playing, worker);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return new Output(device, null, playing, worker);
        // ```
        Ok(Output {
            device,
            stream: None,
            playing,
            worker,
        })
    }

    // What:     `pub fn reconfigure(&mut self, rate: u32, channels: u16,
    //           capacity_frames: usize) -> Result<HeapProd<f32>, PlayerError>`.
    //           `&mut self` is an exclusive borrow (we mutate the stream field).
    //           Tear down any existing stream and open a fresh one at the given
    //           native `rate`/`channels`, with a ring buffer holding
    //           `capacity_frames` frames. Returns the WRITE half of that buffer.
    //           `usize` is the pointer-wide unsigned integer used for sizes/counts
    //           (siblings `u32`/`u64`); `u16` is the small channel count the
    //           decoder reports.
    // Why:      Per-track native rate: each track gets its own stream and a fresh
    //           empty buffer so no stale audio leaks across. Identical signature
    //           to the PipeWire backend.
    // TS map:   `reconfigure(rate: number, channels: number, capacityFrames: number): RingProducer`
    pub fn reconfigure(
        &mut self,
        rate: u32,
        channels: u16,
        capacity_frames: usize,
    ) -> Result<HeapProd<f32>, PlayerError> {
        // What:     `let channels_usize = channels as usize;`. `as` is a primitive
        //           numeric cast widening the `u16` channel count to `usize` for
        //           buffer arithmetic.
        // Why:      Sample counts and strides are `usize`.
        // TS map:   `const channelsUsize = channels;` (TS numbers don't distinguish)
        let channels_usize = channels as usize;

        // What:     `let capacity_samples = capacity_frames * channels_usize;`.
        //           Ring-buffer capacity is in INTERLEAVED SAMPLES, so frames
        //           times channels.
        // Why:      Size the buffer to hold `capacity_frames` frames of audio.
        // TS map:   `const capacitySamples = capacityFrames * channels;`
        let capacity_samples = capacity_frames * channels_usize;

        // What:     `let rb = HeapRb::<f32>::new(capacity_samples);`. Allocate a
        //           ring buffer of that many `f32` slots. `::<f32>` is the
        //           "turbofish" that pins the element type.
        // Why:      The shared queue between decode thread and audio thread.
        // TS map:   `const rb = new RingBuffer<number>(capacitySamples);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const rb = new RingBuffer<number>(capacitySamples);
        // ```
        let rb = HeapRb::<f32>::new(capacity_samples);

        // What:     `let (producer, mut consumer) = rb.split();`. `split()`
        //           CONSUMES the buffer and returns its two halves, destructured
        //           into the write end `producer` and the read end `consumer`.
        //           `mut consumer` because the callback will mutate it (popping
        //           advances its read cursor).
        // Why:      Producer goes to the engine; consumer is moved into the
        //           callback below.
        // TS map:   `const { producer, consumer } = rb.split();`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const { producer, consumer } = rb.split();
        // ```
        let (producer, mut consumer) = rb.split();

        // What:     `self.stream = None;`. Drop the previous stream by overwriting
        //           the field with the empty `Option`. Dropping a `cpal::Stream`
        //           stops and disposes it.
        // Why:      Stop the old track's audio before opening the new stream, and
        //           free its callback (which holds the OLD consumer) so the new
        //           buffer is the only one feeding the device.
        // TS map:   `this.stream?.stop(); this.stream = null;`
        self.stream = None;

        // What:     `let config = StreamConfig { channels, sample_rate:
        //           SampleRate(rate), buffer_size: BufferSize::Default };`. Build
        //           the stream description. `channels` is field shorthand (the
        //           `u16` count). `SampleRate(rate)` wraps the raw `u32` rate in
        //           cpal's newtype. `BufferSize::Default` lets CoreAudio choose the
        //           callback buffer size (sibling: `BufferSize::Fixed(n)`).
        // Why:      Open the device at THIS track's native rate/channels; CoreAudio
        //           sample-rate-converts to the hardware clock, so the engine never
        //           resamples (mirrors PipeWire's transparent resampling).
        // TS map:   `const config = { channels, sampleRate: rate, bufferSize: "default" };`
        let config = StreamConfig {
            channels,
            sample_rate: SampleRate(rate),
            buffer_size: BufferSize::Default,
        };

        // What:     `let playing = Arc::clone(&self.playing);`. `&self.playing`
        //           lends the field read-only; `Arc::clone` makes another handle to
        //           the SAME shared flag (bumps the reference count, does not copy
        //           the bool).
        // Why:      The callback (next) reads pause/play decisions the engine makes
        //           on the other thread through this clone.
        // TS map:   `const playing = this.playing;` (same shared box)
        let playing = Arc::clone(&self.playing);

        // What:     `let worker = self.worker.clone();`. Clone the worker thread
        //           handle (a reference-count bump, not a new thread).
        // Why:      The callback uses it to `unpark()` the worker after draining,
        //           so the worker refills the freed buffer space.
        // TS map:   `const worker = this.worker;`
        let worker = self.worker.clone();

        // What:     `let stream = self.device.build_output_stream(&config, move
        //           |data, _| { ... }, move |err| { ... }, None).map_err(...)?;`.
        //           Open an output stream. `&config` lends the config read-only.
        //           The first closure is the REALTIME data callback (cpal calls it
        //           to fill `data: &mut [f32]`); `move` makes it OWN the captured
        //           `consumer`/`playing`/`worker`. The second closure is the error
        //           callback. `None` is the optional timeout (sibling
        //           `Some(Duration)`). cpal infers the sample type as `f32` from
        //           the `data: &mut [f32]` parameter. `.map_err(|e| ...)` converts
        //           a `BuildStreamError` into our `PlayerError`; `?` returns early
        //           on failure.
        // Why:      This stream + its realtime callback are how CoreAudio pulls
        //           samples from us, exactly like PipeWire's `process` callback.
        // TS map:   `const stream = device.buildOutputStream(config, (data) => {...}, (err) => {...});`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const stream = device.buildOutputStream(config,
        //   (data) => { /* fill data from the ring buffer */ },
        //   (err) => { console.error("cpal stream error:", err); });
        // ```
        let stream = self
            .device
            .build_output_stream(
                &config,
                // What:     `move |data: &mut [f32], _: &cpal::OutputCallbackInfo|
                //           { ... }`. The realtime callback. `|...|` is a closure
                //           (anonymous function); `move` transfers ownership of the
                //           captured variables into it. `data: &mut [f32]` is the
                //           hardware buffer to fill (interleaved `f32`, already the
                //           right sample type). `_` ignores the timing-info arg.
                //           This runs on CoreAudio's realtime thread, so it must NOT
                //           allocate, lock, or block.
                // Why:      Copy decoded samples from the ring buffer into the
                //           speaker buffer (or silence when paused/underrun).
                // TS map:   `(data, _info) => { ...fill data... }`
                move |data: &mut [f32], _: &cpal::OutputCallbackInfo| {
                    // What:     `let is_playing = playing.load(Ordering::Relaxed);`.
                    //           `.load(...)` is the atomic READ of the shared flag;
                    //           `Relaxed` is the loosest ordering (we only need the
                    //           value read indivisibly, no ordering against other
                    //           memory, which is correct for a lone flag).
                    // Why:      Decide, on the realtime thread, whether to feed real
                    //           audio or silence this cycle.
                    // TS map:   `const isPlaying = Atomics.load(playingFlag, 0) !== 0;`
                    let is_playing = playing.load(Ordering::Relaxed);

                    // What:     `let got = if is_playing { consumer.pop_slice(data) }
                    //           else { 0 };`. When playing, `pop_slice(data)` pops up
                    //           to `data.len()` samples straight into the speaker
                    //           buffer and returns how many were available (a
                    //           `usize`). When paused, pop NOTHING (`0`) so the
                    //           buffered audio is preserved for a seamless resume.
                    //           `data` is `&mut [f32]`, lent to the popper.
                    // Why:      Pausing must stop draining the buffer at once;
                    //           otherwise the ~1 second already queued keeps playing
                    //           (the pause-delay bug the PipeWire path also guards).
                    // TS map:   `const got = isPlaying ? consumer.popSlice(data) : 0;`
                    let got = if is_playing {
                        consumer.pop_slice(data)
                    } else {
                        0
                    };

                    // What:     `if got > 0 { worker.unpark(); }`. When we popped at
                    //           least one sample we freed ring-buffer space;
                    //           `unpark()` wakes the engine worker (or leaves a
                    //           one-shot permit if it is not parked yet) so it
                    //           decodes more. `unpark` is wait-free (an atomic plus a
                    //           wake): no lock, no allocation, safe in this realtime
                    //           callback.
                    // Why:      Backpressure signal that lets the worker BLOCK when
                    //           the buffer is full instead of busy-looping.
                    // TS map:   `if (got > 0) worker.postWakeUp();`
                    if got > 0 {
                        worker.unpark();
                    }

                    // What:     `for s in data[got..].iter_mut() { *s = 0.0; }`.
                    //           `data[got..]` is the SLICE from index `got` to the
                    //           end (range indexing, not valid TS syntax). `iter_mut`
                    //           yields mutable references `s`; `*s = 0.0` writes
                    //           through each reference. When paused `got` is `0`, so
                    //           this zeroes the WHOLE buffer: pure silence.
                    // Why:      Output silence for the unfilled tail (underrun) and
                    //           while paused, instead of stale/garbage samples.
                    // TS map:   `for (let i = got; i < data.length; i++) data[i] = 0;`
                    for s in data[got..].iter_mut() {
                        *s = 0.0;
                    }
                },
                // What:     `move |err| { eprintln!("music-player: cpal stream
                //           error: {err}"); }`. The error callback. `move` owns
                //           nothing it needs to keep; `|err|` binds the
                //           `cpal::StreamError`. `eprintln!` writes a line to stderr
                //           (`{err}` interpolates the error's Display).
                // Why:      Surface device-loss / overrun errors without crashing
                //           playback. Fires only on rare stream errors, never in the
                //           hot path, so the stderr write is acceptable here.
                // TS map:   `(err) => { console.error(`cpal stream error: ${err}`); }`
                move |err| {
                    eprintln!("music-player: cpal stream error: {err}");
                },
                // What:     `None`. The optional stream timeout; `None` means "no
                //           timeout" (sibling `Some(Duration::from_millis(n))`).
                // Why:      We want the stream to wait indefinitely for buffers.
                // TS map:   `undefined` (no timeout)
                None,
            )
            // What:     `.map_err(|e| PlayerError::Audio(format!("build stream: {e:?}")))`.
            //           Transform an `Err(BuildStreamError)` into our
            //           `Err(PlayerError::Audio(...))`. `|e| ...` is a closure;
            //           `format!` builds an owned `String`; `{e:?}` uses the error's
            //           Debug formatting. `Ok` values pass through untouched.
            // Why:      Flatten cpal's error type into our one app-wide error.
            // TS map:   `.catch(e => { throw new PlayerError(`build stream: ${e}`); })`
            .map_err(|e| PlayerError::Audio(format!("build stream: {e:?}")))?;

        // What:     `stream.play().map_err(|e| ...)?;`. `play()` starts the stream
        //           (cpal streams are created paused). It returns
        //           `Result<(), PlayError>`; `.map_err` wraps any failure as our
        //           error and `?` returns it early. `()` is the empty "unit" value
        //           (like `void`).
        // Why:      Begin pulling samples; without this the callback never fires.
        // TS map:   `await stream.play();`
        stream
            .play()
            .map_err(|e| PlayerError::Audio(format!("stream play: {e:?}")))?;

        // What:     `self.stream = Some(stream);`. Store the new stream in the
        //           field, wrapping it in `Some` (the "has a value" case of
        //           `Option`). Moving it in keeps it alive while this track plays.
        // Why:      Dropping the stream would stop audio; the struct must own it.
        // TS map:   `this.stream = stream;`
        self.stream = Some(stream);

        // What:     `Ok(producer)`. Wrap the WRITE half of the ring buffer in the
        //           success variant. No trailing `;`, so this is the tail
        //           expression the function returns.
        // Why:      The engine pushes decoded samples into it.
        // TS map:   `return producer;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return producer;
        // ```
        Ok(producer)
    }

    // What:     `pub fn set_playing(&self, on: bool)`. Flip the shared pause/play
    //           flag. Takes `&self` (read-only borrow) because writing an atomic
    //           does NOT need exclusive access; the cell handles concurrent writes.
    // Why:      The engine calls this on pause/play so the realtime callback reacts
    //           immediately. Identical to the PipeWire backend's method.
    // TS map:   `setPlaying(on: boolean): void`
    pub fn set_playing(&self, on: bool) {
        // What:     `self.playing.store(on, Ordering::Relaxed);`. The atomic WRITE:
        //           store `on` into the shared flag. `Relaxed` matches the loose
        //           ordering used by the callback's `.load` (a lone flag needs no
        //           stronger guarantee).
        // Why:      Make the new state visible to the audio thread.
        // TS map:   `Atomics.store(playingFlag, 0, on ? 1 : 0);`
        self.playing.store(on, Ordering::Relaxed);
    }
}
