//! PipeWire output: the thin FFI boundary. ALL PipeWire/SPA/realtime code is
//! confined to this module so the rest of the player (engine.rs) only ever
//! calls `Output::new`, `Output::reconfigure`, and pushes `f32` samples into
//! the returned ring-buffer producer.
//!
//! Mental model for a TypeScript reader: PipeWire is a C audio server. We open
//! one background loop (its own OS thread, managed by C), create an output
//! "stream", and register a `process` callback that the C loop calls on a
//! realtime thread whenever the speakers need more samples. That callback
//! copies samples out of a lock-free queue (the ring buffer) and into the
//! hardware buffer. We hand the WRITE end of that queue back to the engine.
//!
//! Several types here are `!Send` (they use `Rc` internally, like a value that
//! must stay on the thread that made it). So `Output` is created, used, and
//! dropped entirely on the engine's controller thread; only the realtime
//! `process` callback runs elsewhere (on PipeWire's own thread), and it touches
//! only the ring-buffer consumer it was given.

// What:     `use std::io::Cursor;`. `Cursor` wraps an in-memory `Vec<u8>` and
//           gives it the `Read`/`Write` interface a serializer expects.
// Why:      The SPA pod serializer writes bytes into a `Cursor<Vec<u8>>`.
// TS map:   like wrapping a growing `Uint8Array` in a stream-ish writer.
//
// In TS you'd write (pseudocode):
// ```ts
// const buf = []; // a sink the serializer appends to
// ```
use std::io::Cursor;

// What:     `use std::mem::size_of;`. `size_of::<T>()` returns the byte size of
//           a type at compile time (a `usize`).
// Why:      One `f32` sample is 4 bytes; we compute strides from this rather
//           than hard-coding `4`.
// TS map:   no equivalent; JS numbers have no fixed byte width you query.
//
// In TS you'd write (pseudocode):
// ```ts
// const F32_BYTES = 4; // Float32 is 4 bytes
// ```
use std::mem::size_of;

// What:     `use pipewire as pw;`. Import the crate and rename it `pw` for short.
// Why:      Every PipeWire call below is `pw::...`.
// TS map:   `import * as pw from "pipewire";`
use pipewire as pw;

// What:     `use pw::{properties::properties, spa};`. Brings the `properties!`
//           MACRO (builds a key/value dictionary) and the `spa` submodule (the
//           lower-level "Simple Plugin API" types: audio formats, pods) into scope.
// Why:      Stream creation needs properties; format negotiation needs spa.
// TS map:   `import { properties, spa } from "pipewire";`
use pw::{properties::properties, spa};

// What:     `use pw::context::Context;`. The PipeWire "context" object: the root
//           handle from which you connect to the server.
// Why:      We create one context and keep it alive for the program.
// TS map:   `import { Context } from "pipewire";`
use pw::context::Context;

// What:     `use pw::core::Core;`. The connected "core": your session with the
//           PipeWire server, created from a context.
// Why:      Streams are created from a `Core`.
// TS map:   `import { Core } from "pipewire";`
use pw::core::Core;

// What:     `use pw::stream::{Stream, StreamFlags, StreamListener};`. `Stream` is
//           an audio stream; `StreamFlags` are connect-time options; a
//           `StreamListener` is the live registration of our callbacks (dropping
//           it unregisters them).
// Why:      We create a stream, register a process callback, and connect it.
// TS map:   `import { Stream, StreamFlags, StreamListener } from "pipewire";`
use pw::stream::{Stream, StreamFlags, StreamListener};

// What:     `use pw::thread_loop::ThreadLoop;`. A loop that runs on its OWN OS
//           thread, spawned and driven by PipeWire's C code.
// Why:      Audio must run independently of our decode/command loop.
// TS map:   closest is a Web Worker that owns its own event loop; here C owns it.
use pw::thread_loop::ThreadLoop;

// What:     `use spa::param::audio::{AudioFormat, AudioInfoRaw};`. `AudioFormat`
//           names the sample encoding (we use `F32LE` = little-endian 32-bit
//           float). `AudioInfoRaw` is a small struct describing format + rate +
//           channels that we turn into a "pod".
// Why:      To tell PipeWire we will feed interleaved f32 at a given rate/channels.
// TS map:   `import { AudioFormat, AudioInfoRaw } from "pipewire/spa";`
use spa::param::audio::{AudioFormat, AudioInfoRaw};

// What:     `use spa::pod::{serialize::PodSerializer, Object, Pod, Value};`. A
//           "pod" (Plain Old Data) is SPA's self-describing binary value format.
//           `PodSerializer` turns a `Value` into bytes; `Object`/`Value` build
//           the structured value; `Pod` is a borrowed view over the bytes.
// Why:      Stream format parameters are passed to PipeWire as a serialized pod.
// TS map:   no equivalent; think "encode a tagged struct into a byte buffer".
//
// In TS you'd write (pseudocode):
// ```ts
// const bytes = encodePod({ type: "Format", ... }); // bespoke binary encoding
// ```
use spa::pod::{serialize::PodSerializer, Object, Pod, Value};

// What:     `use spa::utils::Direction;`. Enum: is this stream `Output`
//           (we produce audio) or `Input` (we capture)? Sibling: `Input`.
// Why:      A music player produces audio, so `Output`.
// TS map:   `type Direction = "input" | "output";`
use spa::utils::Direction;

// What:     `use ringbuf::traits::{Consumer, Split};`. These TRAITS bring methods
//           into scope: `Split::split` (cut a ring buffer into a producer and a
//           consumer half) and `Consumer::pop_slice` (drain samples out).
// Why:      We split the buffer and the callback pops from the consumer half.
// TS map:   importing interfaces whose methods we then call.
use ringbuf::traits::{Consumer, Split};

// What:     `use ringbuf::{HeapCons, HeapProd, HeapRb};`. `HeapRb<T>` is a
//           heap-allocated ring buffer; `.split()` yields a `HeapProd<T>` (write
//           end) and `HeapCons<T>` (read end). Both halves can live on different
//           threads (single-producer, single-consumer).
// Why:      A lock-free hand-off of samples from the decode thread to the
//           realtime audio thread.
// TS map:   no direct equivalent; imagine a fixed-size, lock-free `Array` queue
//           split into a writer object and a reader object.
use ringbuf::{HeapCons, HeapProd, HeapRb};

// What:     `use crate::error::PlayerError;`. Our one app-wide error type.
// Why:      Fallible methods here return `PlayerError`.
// TS map:   `import { PlayerError } from "@/error";`
use crate::error::PlayerError;

// What:     `const F32_BYTES: usize = size_of::<f32>();`. Bytes in one `f32`
//           sample (4). `usize` because it measures memory and feeds stride math.
// Why:      Stride = bytes per audio frame = `F32_BYTES * channels`.
// TS map:   `const F32_BYTES = 4;`
const F32_BYTES: usize = size_of::<f32>();

// What:     `struct ProcessData { ... }`. The state the realtime callback owns.
//           It is moved INTO the stream listener; the C loop hands it back to our
//           closure as `&mut ProcessData` on every call.
// Why:      The callback must not allocate or lock; it keeps its consumer and a
//           reusable scratch buffer here.
// TS map:   `type ProcessData = { consumer: Consumer; channels: number; scratch: Float32Array };`
struct ProcessData {
    // What:     `consumer: HeapCons<f32>`. The READ half of the ring buffer.
    // Why:      The callback pops decoded samples from it.
    // TS map:   `consumer: RingConsumer<number>;`
    consumer: HeapCons<f32>,
    // What:     `channels: usize`. Channel count of the current track (1 or 2...).
    //           `usize` for index/stride arithmetic without casts.
    // Why:      Needed to compute the per-frame stride and how many samples fill
    //           a buffer.
    // TS map:   `channels: number;`
    channels: usize,
    // What:     `scratch: Vec<f32>`. A reusable buffer the callback pops into
    //           before converting to little-endian bytes.
    // Why:      Avoid allocating inside the realtime callback (grows at most once
    //           when the buffer size first stabilises).
    // TS map:   `scratch: Float32Array;`
    scratch: Vec<f32>,
}

// What:     `pub struct Output { ... }`. Owns the whole PipeWire pipeline. FIELD
//           ORDER IS THE DROP ORDER: Rust drops fields top-to-bottom, so the
//           listener (which holds a raw pointer into the stream) drops before the
//           stream, and both before the core/context/loop.
// Why:      Keeps all the `!Send` PipeWire objects alive together and tears them
//           down in a safe order.
// TS map:   `class Output { listener; stream; core; context; threadLoop; }`
pub struct Output {
    // What:     `listener: Option<StreamListener<ProcessData>>`. The live callback
    //           registration, or `None` before the first stream. Dropping it
    //           unregisters the callback.
    // Why:      Must outlive nothing and be dropped first (it points into stream).
    // TS map:   `listener: StreamListener | null;`
    listener: Option<StreamListener<ProcessData>>,
    // What:     `stream: Option<Stream>`. The current output stream, or `None`.
    // Why:      Recreated per track at that track's native rate/channels.
    // TS map:   `stream: Stream | null;`
    stream: Option<Stream>,
    // What:     `core: Core`. The connected session. Held for the program's life.
    // Why:      Needed to create streams.
    // TS map:   `core: Core;`
    core: Core,
    // What:     `_context: Context`. The context the core came from. The leading
    //           `_` says "kept only to stay alive, not otherwise used".
    // Why:      The core depends on the context outliving it.
    // TS map:   `private context: Context;`
    _context: Context,
    // What:     `thread_loop: ThreadLoop`. The background audio loop.
    // Why:      Drives the realtime callback; dropped last.
    // TS map:   `threadLoop: ThreadLoop;`
    thread_loop: ThreadLoop,
}

// What:     `impl Output { ... }`. Methods for the output pipeline.
// Why:      Construction and per-track reconfiguration.
// TS map:   the class body.
impl Output {
    // What:     `pub fn new() -> Result<Output, PlayerError>`. Initialise
    //           PipeWire, build the loop/context/core, and start the loop thread.
    // Why:      One-time setup of the audio pipeline.
    // TS map:   `static async create(): Promise<Output>`
    pub fn new() -> Result<Output, PlayerError> {
        // What:     `pw::init();`. Initialises the PipeWire library (global C
        //           setup). Safe to call; idempotent in practice.
        // Why:      Required before any other PipeWire call.
        // TS map:   `pw.init();`
        pw::init();

        // What:     `let thread_loop = unsafe { ThreadLoop::new(Some("music-player-audio"), None) }
        //           .map_err(...)?`. `ThreadLoop::new` is an `unsafe fn` (its
        //           safety contract is about keeping the loop alive correctly,
        //           which the `Output` struct guarantees). `Some("music-player-audio")`
        //           names the thread; `None` = no extra properties. `.map_err`
        //           converts a `pw::Error` into our `PlayerError`; `?` returns early.
        // Why:      Create the background audio loop.
        // TS map:   `const threadLoop = new ThreadLoop("music-player-audio");`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const threadLoop = new ThreadLoop("music-player-audio");
        // ```
        let thread_loop = unsafe { ThreadLoop::new(Some("music-player-audio"), None) }
            // What:     `.map_err(|e| PlayerError::Audio(format!("thread loop: {e:?}")))`.
            //           `|e| ...` is a closure; `format!` builds an owned `String`;
            //           `{e:?}` uses the error's Debug formatting.
            // Why:      Wrap the low-level error in our `Audio` variant.
            // TS map:   `.catch(e => { throw new PlayerError.Audio(`thread loop: ${e}`); })`
            .map_err(|e| PlayerError::Audio(format!("thread loop: {e:?}")))?;

        // What:     `let context = Context::new(&thread_loop).map_err(...)?`.
        //           `Context::new` takes a reference to anything loop-like
        //           (`&thread_loop` lends it). Builds the context.
        // Why:      The root from which we connect to the server.
        // TS map:   `const context = new Context(threadLoop);`
        let context = Context::new(&thread_loop)
            .map_err(|e| PlayerError::Audio(format!("context: {e:?}")))?;

        // What:     `let core = context.connect(None).map_err(...)?`. `connect`
        //           opens the session; `None` = default connection properties.
        // Why:      We need a `Core` to make streams.
        // TS map:   `const core = context.connect();`
        let core = context
            .connect(None)
            .map_err(|e| PlayerError::Audio(format!("core connect: {e:?}")))?;

        // What:     `thread_loop.start();`. Spawns the loop's OS thread and begins
        //           processing. After this, callbacks can fire on that thread.
        // Why:      Bring the audio pipeline to life.
        // TS map:   `threadLoop.start();`
        thread_loop.start();

        // What:     `Ok(Output { listener: None, stream: None, core, _context: context,
        //           thread_loop })`. Build the struct (no stream yet) and wrap in
        //           `Ok`. Field shorthand for `core`/`thread_loop`. Tail -> return.
        // Why:      Hand back the ready (but silent) output.
        // TS map:   `return new Output(null, null, core, context, threadLoop);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return new Output(null, null, core, context, threadLoop);
        // ```
        Ok(Output {
            listener: None,
            stream: None,
            core,
            _context: context,
            thread_loop,
        })
    }

    // What:     `pub fn reconfigure(&mut self, rate: u32, channels: u16,
    //           capacity_frames: usize) -> Result<HeapProd<f32>, PlayerError>`.
    //           Tear down any existing stream and build a fresh one negotiating
    //           the given native `rate`/`channels`, with a ring buffer holding
    //           `capacity_frames` frames. Returns the WRITE half of that buffer.
    // Why:      Per-track native rate: each new track gets a stream at its own
    //           rate, and a fresh empty buffer so no stale audio leaks across.
    // TS map:   `reconfigure(rate: number, channels: number, capacityFrames: number): RingProducer`
    pub fn reconfigure(
        &mut self,
        rate: u32,
        channels: u16,
        capacity_frames: usize,
    ) -> Result<HeapProd<f32>, PlayerError> {
        // What:     `let channels_usize = channels as usize;`. Widen `u16` to
        //           `usize` for buffer arithmetic.
        // Why:      Sample counts and strides are `usize`.
        // TS map:   `const channels = channelsU16;` (TS numbers don't distinguish)
        let channels_usize = channels as usize;

        // What:     `let capacity_samples = capacity_frames * channels_usize;`.
        //           Ring-buffer capacity is in INTERLEAVED SAMPLES, so frames
        //           times channels.
        // Why:      Size the buffer to hold `capacity_frames` frames of audio.
        // TS map:   `const capacitySamples = capacityFrames * channels;`
        let capacity_samples = capacity_frames * channels_usize;

        // What:     `let rb = HeapRb::<f32>::new(capacity_samples);`. Allocate a
        //           ring buffer of that many `f32` slots. `::<f32>` is the turbofish
        //           that pins the element type.
        // Why:      The shared queue between decode thread and audio thread.
        // TS map:   `const rb = new RingBuffer<number>(capacitySamples);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const rb = new RingBuffer<number>(capacitySamples);
        // ```
        let rb = HeapRb::<f32>::new(capacity_samples);

        // What:     `let (producer, consumer) = rb.split();`. `split()` CONSUMES
        //           the buffer and returns its two halves; destructured into the
        //           write end `producer` and the read end `consumer`.
        // Why:      Producer goes to the engine; consumer goes into the callback.
        // TS map:   `const { producer, consumer } = rb.split();`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const { producer, consumer } = rb.split();
        // ```
        let (producer, consumer) = rb.split();

        // What:     `let process_data = ProcessData { consumer, channels: channels_usize,
        //           scratch: Vec::new() };`. Bundle the callback's state.
        //           `Vec::new()` is an empty buffer (grows on first use).
        // Why:      This is moved into the listener as the callback's `&mut` data.
        // TS map:   `const processData = { consumer, channels, scratch: new Float32Array(0) };`
        let process_data = ProcessData {
            consumer,
            channels: channels_usize,
            scratch: Vec::new(),
        };

        // What:     `let guard = self.thread_loop.lock();`. Lock the audio loop:
        //           while held, the loop thread will not touch loop objects, so we
        //           can safely create/destroy streams. The returned `guard`
        //           UNLOCKS automatically when it goes out of scope (even on an
        //           early `?` return).
        // Why:      PipeWire requires the loop locked when mutating its objects
        //           from another thread.
        // TS map:   no equivalent; think "acquire a mutex; auto-released at block end".
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const guard = threadLoop.lock(); // released when it falls out of scope
        // ```
        let guard = self.thread_loop.lock();

        // What:     `self.listener = None;`. Drop the previous callback
        //           registration FIRST (it holds a raw pointer into the old stream).
        // Why:      Unregister before destroying the stream it points at.
        // TS map:   `this.listener?.unregister(); this.listener = null;`
        self.listener = None;

        // What:     `self.stream = None;`. Drop the previous stream (destroys the
        //           C object), now that no listener references it.
        // Why:      Replace it with a fresh stream below.
        // TS map:   `this.stream = null;`
        self.stream = None;

        // What:     `let stream = Stream::new(&self.core, "music-player", properties! { ... })
        //           .map_err(...)?`. Create a new stream on our core, named
        //           "music-player", with media metadata. `properties! { *KEY => "val" }`
        //           builds the dictionary; the `*` dereferences each key constant.
        // Why:      A fresh stream to negotiate this track's format.
        // TS map:   `const stream = new Stream(core, "music-player", { mediaType: "Audio", ... });`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const stream = new Stream(core, "music-player", { MEDIA_TYPE: "Audio", MEDIA_CATEGORY: "Playback", MEDIA_ROLE: "Music" });
        // ```
        let stream = Stream::new(
            &self.core,
            "music-player",
            properties! {
                *pw::keys::MEDIA_TYPE => "Audio",
                *pw::keys::MEDIA_CATEGORY => "Playback",
                *pw::keys::MEDIA_ROLE => "Music",
            },
        )
        .map_err(|e| PlayerError::Audio(format!("stream new: {e:?}")))?;

        // What:     `let listener = stream.add_local_listener_with_user_data(process_data)
        //           .process(|stream, pd| { ... }).register().map_err(...)?`. Attach
        //           our state as the callback's user data, set the `process`
        //           callback, and register it (returns an owned `StreamListener`).
        //           The closure receives `&StreamRef` and `&mut ProcessData`.
        // Why:      This callback is how PipeWire pulls samples from us in realtime.
        // TS map:   `const listener = stream.onProcess(processData, (stream, pd) => { ... });`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const listener = stream.onProcess(processData, (stream, pd) => { ...fill buffer... });
        // ```
        let listener = stream
            .add_local_listener_with_user_data(process_data)
            // What:     `.process(|stream, pd| { ... })`. Register the realtime
            //           callback. `|stream, pd|` is the closure's parameter list.
            //           This runs on PipeWire's thread; it must not block/allocate.
            // Why:      Feed the hardware buffer from our ring buffer.
            // TS map:   `(stream, pd) => { ... }`
            .process(|stream, pd| {
                // What:     `match stream.dequeue_buffer() { ... }`. Ask the stream
                //           for a buffer to fill. Returns `Option<Buffer>`:
                //           `Some(buffer)` if one is available, else `None`.
                // Why:      We can only write when PipeWire gives us a buffer.
                // TS map:   `const buffer = stream.dequeueBuffer(); if (!buffer) return;`
                match stream.dequeue_buffer() {
                    // What:     `None => {}`. No buffer right now: do nothing.
                    // Why:      Skip this cycle.
                    // TS map:   `if (!buffer) return;`
                    None => {}
                    // What:     `Some(mut buffer) => { ... }`. We got a buffer; `mut`
                    //           because we write into it.
                    // Why:      Fill it with samples.
                    // TS map:   `else { ... }`
                    Some(mut buffer) => {
                        // What:     `let datas = buffer.datas_mut();`. A buffer can
                        //           hold several data planes; `datas_mut()` borrows
                        //           them mutably as a slice.
                        // Why:      Interleaved audio uses plane 0.
                        // TS map:   `const datas = buffer.datas;`
                        let datas = buffer.datas_mut();

                        // What:     `if datas.is_empty() { return; }`. Defensive:
                        //           no planes means nothing to fill. `return` exits
                        //           the closure (the buffer is queued back on drop).
                        // Why:      Avoid indexing an empty slice.
                        // TS map:   `if (datas.length === 0) return;`
                        if datas.is_empty() {
                            return;
                        }

                        // What:     `let bdata = &mut datas[0];`. Mutable reference to
                        //           the first data plane.
                        // Why:      The interleaved samples go here.
                        // TS map:   `const bdata = datas[0];`
                        let bdata = &mut datas[0];

                        // What:     `let stride = F32_BYTES * pd.channels;`. Bytes per
                        //           audio frame (one sample per channel).
                        // Why:      Used to size and tag the chunk.
                        // TS map:   `const stride = 4 * pd.channels;`
                        let stride = F32_BYTES * pd.channels;

                        // What:     `let n_frames = match bdata.data() { ... };`.
                        //           `bdata.data()` returns `Option<&mut [u8]>`: the
                        //           mapped byte buffer to write, or `None`.
                        // Why:      Fill the bytes and report how many frames we wrote.
                        // TS map:   `const slice = bdata.data; const nFrames = slice ? fill(slice) : 0;`
                        let n_frames = match bdata.data() {
                            // What:     `Some(slice) => { ... }`. `slice: &mut [u8]`
                            //           is the writable hardware buffer bytes.
                            // Why:      Copy decoded samples into it.
                            // TS map:   `if (slice) { ... }`
                            Some(slice) => {
                                // What:     `let avail_frames = slice.len() / stride;`.
                                //           How many whole frames fit in this buffer.
                                // Why:      We fill exactly that many frames.
                                // TS map:   `const availFrames = (slice.length / stride) | 0;`
                                let avail_frames = slice.len() / stride;

                                // What:     `let want = avail_frames * pd.channels;`.
                                //           Interleaved sample count to produce.
                                // Why:      Total f32 values to pop/convert.
                                // TS map:   `const want = availFrames * pd.channels;`
                                let want = avail_frames * pd.channels;

                                // What:     `if pd.scratch.len() < want { pd.scratch.resize(want, 0.0); }`.
                                //           Grow the scratch buffer if needed,
                                //           filling new slots with `0.0`.
                                // Why:      Have room to pop `want` samples (grows
                                //           at most once after sizes stabilise).
                                // TS map:   `if (pd.scratch.length < want) pd.scratch = new Float32Array(want);`
                                if pd.scratch.len() < want {
                                    pd.scratch.resize(want, 0.0);
                                }

                                // What:     `let got = pd.consumer.pop_slice(&mut pd.scratch[..want]);`.
                                //           Pop up to `want` samples from the ring
                                //           buffer into the scratch slice; returns
                                //           how many were actually available (`usize`).
                                // Why:      Pull decoded audio out of the queue.
                                // TS map:   `const got = pd.consumer.popSlice(pd.scratch.subarray(0, want));`
                                let got = pd.consumer.pop_slice(&mut pd.scratch[..want]);

                                // What:     `for s in pd.scratch[got..want].iter_mut() { *s = 0.0; }`.
                                //           Zero any samples we could NOT fill (the
                                //           queue had fewer than `want`). `iter_mut`
                                //           yields mutable references `s`; `*s`
                                //           writes through the reference.
                                // Why:      Output silence on underrun instead of
                                //           stale/garbage data.
                                // TS map:   `for (let i = got; i < want; i++) pd.scratch[i] = 0;`
                                for s in pd.scratch[got..want].iter_mut() {
                                    *s = 0.0;
                                }

                                // What:     `for (i, sample) in pd.scratch[..want].iter().enumerate() { ... }`.
                                //           Iterate the samples with their index `i`.
                                //           `.iter()` borrows them read-only;
                                //           `.enumerate()` pairs each with its index.
                                // Why:      Write each f32 as 4 little-endian bytes
                                //           into the hardware buffer.
                                // TS map:   `pd.scratch.slice(0, want).forEach((sample, i) => { ... });`
                                for (i, sample) in pd.scratch[..want].iter().enumerate() {
                                    // What:     `let bytes = sample.to_le_bytes();`.
                                    //           `to_le_bytes()` converts the `f32`
                                    //           into a `[u8; 4]` in little-endian order.
                                    // Why:      The buffer format is F32LE bytes.
                                    // TS map:   `dataView.setFloat32(off, sample, true);`
                                    let bytes = sample.to_le_bytes();

                                    // What:     `let off = i * F32_BYTES;`. Byte offset
                                    //           of this sample in the buffer.
                                    // Why:      Where to write the 4 bytes.
                                    // TS map:   `const off = i * 4;`
                                    let off = i * F32_BYTES;

                                    // What:     `slice[off..off + F32_BYTES].copy_from_slice(&bytes);`.
                                    //           Copy the 4 bytes into the buffer at
                                    //           `off`. `&bytes` lends the array.
                                    // Why:      Place the sample.
                                    // TS map:   `slice.set(bytes, off);`
                                    slice[off..off + F32_BYTES].copy_from_slice(&bytes);
                                }

                                // What:     `avail_frames`. Tail of the arm: the
                                //           number of frames we filled becomes
                                //           `n_frames`.
                                // Why:      Report the frame count.
                                // TS map:   `return availFrames;`
                                avail_frames
                            }
                            // What:     `None => 0`. No mapped buffer: zero frames.
                            // Why:      Nothing written.
                            // TS map:   `else nFrames = 0;`
                            None => 0,
                        };

                        // What:     `let chunk = bdata.chunk_mut();`. The "chunk"
                        //           is the metadata describing the valid region of
                        //           the buffer; `chunk_mut()` borrows it mutably.
                        // Why:      We must tell PipeWire how much we wrote.
                        // TS map:   `const chunk = bdata.chunk;`
                        let chunk = bdata.chunk_mut();

                        // What:     `*chunk.offset_mut() = 0;`. `offset_mut()` returns
                        //           a mutable reference to the offset field; `*... =`
                        //           writes through it. Data starts at byte 0.
                        // Why:      No leading padding.
                        // TS map:   `chunk.offset = 0;`
                        *chunk.offset_mut() = 0;

                        // What:     `*chunk.stride_mut() = stride as _;`. Set the
                        //           per-frame byte stride. `as _` lets the compiler
                        //           infer the exact integer type the field needs.
                        // Why:      PipeWire needs the frame size.
                        // TS map:   `chunk.stride = stride;`
                        *chunk.stride_mut() = stride as _;

                        // What:     `*chunk.size_mut() = (stride * n_frames) as _;`.
                        //           Total valid bytes = stride times frames written.
                        // Why:      Tells PipeWire how many bytes to play.
                        // TS map:   `chunk.size = stride * nFrames;`
                        *chunk.size_mut() = (stride * n_frames) as _;
                    }
                }
            })
            // What:     `.register()`. Finish building and register the listener;
            //           returns `Result<StreamListener<ProcessData>, pw::Error>`.
            // Why:      Activate the callbacks on the stream.
            // TS map:   `.register()`
            .register()
            .map_err(|e| PlayerError::Audio(format!("listener: {e:?}")))?;

        // What:     `let mut info = AudioInfoRaw::new();`. Build the format
        //           descriptor. `mut` because we set fields next.
        // Why:      Describe the audio we will send.
        // TS map:   `const info = new AudioInfoRaw();`
        let mut info = AudioInfoRaw::new();

        // What:     `info.set_format(AudioFormat::F32LE);`. Interleaved 32-bit
        //           little-endian float samples. Sibling formats: `S16LE`, etc.
        // Why:      Our decoders output `f32`.
        // TS map:   `info.format = "F32LE";`
        info.set_format(AudioFormat::F32LE);

        // What:     `info.set_rate(rate);`. Samples per second for THIS track.
        // Why:      Per-track native rate; PipeWire resamples to the device.
        // TS map:   `info.rate = rate;`
        info.set_rate(rate);

        // What:     `info.set_channels(channels as u32);`. Channel count; the API
        //           wants `u32`, so widen our `u16`.
        // Why:      Stereo/mono layout.
        // TS map:   `info.channels = channels;`
        info.set_channels(channels as u32);

        // What:     `let values: Vec<u8> = PodSerializer::serialize(Cursor::new(Vec::new()),
        //           &Value::Object(Object { type_, id, properties: info.into() }))
        //           .map_err(...)?.0.into_inner();`. Serialize the format object
        //           into bytes. `Value::Object` wraps an `Object` whose `type_`
        //           and `id` are SPA constants (object is a Format / EnumFormat).
        //           `info.into()` converts the `AudioInfoRaw` into the object's
        //           property list. `serialize(...)` returns
        //           `Result<(Cursor, ...)>`; `?` unwraps; `.0` takes the cursor;
        //           `.into_inner()` extracts the `Vec<u8>`.
        // Why:      Stream parameters must be passed as serialized pod bytes.
        // TS map:   no equivalent; `const values = encodeFormatPod(info);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const values = encodeFormatPod({ type: "Format", id: "EnumFormat", info });
        // ```
        let values: Vec<u8> = PodSerializer::serialize(
            Cursor::new(Vec::new()),
            &Value::Object(Object {
                // What:     `type_: pw::spa::sys::SPA_TYPE_OBJECT_Format`. The raw
                //           SPA constant marking this object as a "Format" object.
                //           `pw::spa::sys` is the raw C-binding submodule.
                // Why:      PipeWire identifies the object kind by this tag.
                // TS map:   `type: SPA_TYPE_OBJECT_Format,`
                type_: pw::spa::sys::SPA_TYPE_OBJECT_Format,
                // What:     `id: pw::spa::sys::SPA_PARAM_EnumFormat`. Marks the
                //           parameter as the set of formats we can accept.
                // Why:      Stream negotiation reads `EnumFormat`.
                // TS map:   `id: SPA_PARAM_EnumFormat,`
                id: pw::spa::sys::SPA_PARAM_EnumFormat,
                // What:     `properties: info.into()`. `.into()` converts the
                //           `AudioInfoRaw` into the `Vec<Property>` the object wants.
                // Why:      The format fields become the object's properties.
                // TS map:   `properties: infoToProps(info),`
                properties: info.into(),
            }),
        )
        .map_err(|e| PlayerError::Audio(format!("pod serialize: {e:?}")))?
        .0
        .into_inner();

        // What:     `let pod = Pod::from_bytes(&values).ok_or_else(|| ...)?`.
        //           `Pod::from_bytes` returns `Option<&Pod>` (a borrowed view over
        //           `values`); `.ok_or_else(...)` turns `None` into an error;
        //           `?` unwraps the `&Pod`.
        // Why:      `connect` takes pod references, not raw bytes.
        // TS map:   `const pod = Pod.fromBytes(values); if (!pod) throw ...;`
        let pod = Pod::from_bytes(&values)
            .ok_or_else(|| PlayerError::Audio("invalid format pod".to_string()))?;

        // What:     `let mut params = [pod];`. A fixed array of one pod reference;
        //           `mut` because `connect` takes `&mut [&Pod]`.
        // Why:      The parameter list for stream negotiation.
        // TS map:   `const params = [pod];`
        let mut params = [pod];

        // What:     `stream.connect(Direction::Output, None, StreamFlags::AUTOCONNECT
        //           | StreamFlags::MAP_BUFFERS | StreamFlags::RT_PROCESS, &mut params)
        //           .map_err(...)?`. Connect the stream as an output. `None` =
        //           auto-pick a target sink. The flags: AUTOCONNECT (link to a
        //           sink automatically), MAP_BUFFERS (memory-map buffers so our
        //           callback gets a byte slice), RT_PROCESS (run `process` on the
        //           realtime thread). `|` combines the bit flags. `&mut params`
        //           lends the param list.
        // Why:      Start streaming audio at the negotiated format.
        // TS map:   `stream.connect("output", null, AUTOCONNECT | MAP_BUFFERS | RT_PROCESS, params);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // stream.connect("output", null, AUTOCONNECT | MAP_BUFFERS | RT_PROCESS, params);
        // ```
        stream
            .connect(
                Direction::Output,
                None,
                StreamFlags::AUTOCONNECT | StreamFlags::MAP_BUFFERS | StreamFlags::RT_PROCESS,
                &mut params,
            )
            .map_err(|e| PlayerError::Audio(format!("connect: {e:?}")))?;

        // What:     `self.stream = Some(stream);`. Store the new stream (moves it
        //           into the struct; the C object it points to stays put, so the
        //           listener's pointer remains valid).
        // Why:      Keep it alive while playing this track.
        // TS map:   `this.stream = stream;`
        self.stream = Some(stream);

        // What:     `self.listener = Some(listener);`. Store the registration so
        //           the callbacks stay active.
        // Why:      Dropping it would unregister the callback.
        // TS map:   `this.listener = listener;`
        self.listener = Some(listener);

        // What:     `drop(guard);`. Explicitly release the loop lock now (it would
        //           also release at end of scope; doing it here is clearer).
        // Why:      Let the audio loop resume processing.
        // TS map:   `guard.unlock();`
        drop(guard);

        // What:     `Ok(producer)`. Return the WRITE half of the ring buffer.
        //           Tail -> return.
        // Why:      The engine pushes decoded samples into it.
        // TS map:   `return producer;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return producer;
        // ```
        Ok(producer)
    }
}

// What:     `impl Drop for Output { ... }`. Custom cleanup when an `Output` is
//           dropped (goes out of scope). `Drop` is the destructor trait.
// Why:      Stop the loop thread BEFORE the fields (stream/core/...) are
//           destroyed, so no realtime callback runs during teardown.
// TS map:   no exact equivalent; like a `Symbol.dispose`/`finally` cleanup.
impl Drop for Output {
    // What:     `fn drop(&mut self)`. Runs once, automatically, at end of life.
    // Why:      Stop the audio loop first.
    // TS map:   `[Symbol.dispose]() { ... }`
    fn drop(&mut self) {
        // What:     `self.thread_loop.stop();`. Stops the loop and joins its OS
        //           thread. After this no callbacks fire.
        // Why:      Make destroying the stream/core safe (no concurrent access).
        // TS map:   `this.threadLoop.stop();`
        self.thread_loop.stop();
        // After this method returns, the struct fields drop in declaration order:
        // listener (unregister) -> stream (destroy) -> core -> context -> loop.
    }
}
