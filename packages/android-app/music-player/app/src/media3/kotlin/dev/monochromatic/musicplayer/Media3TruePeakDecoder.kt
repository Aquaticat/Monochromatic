// What:     `package dev.monochromatic.musicplayer` declares the namespace this file's
//           declarations belong to. This file is in the `media3` FLAVOR source set,
//           merged with the shared `main` source set for the Media3 build variant.
// Why:      Keeps `Media3TruePeakDecoder` alongside the rest of the Media3 flavor and the
//           shared core (`measureTruePeak`) without imports across the package.
// TS map:   No `package` keyword in TS; the file path is the module identity.
//
// In TS you'd write (pseudocode):
// ```ts
// // No keyword — file path is the module; this one is media3-flavor only.
// ```
package dev.monochromatic.musicplayer

// What:     `import android.content.Context` brings in Android's `Context` (the
//           app-environment handle) by short name.
// Why:      `measure` needs a `Context` to resolve a `content://` URI through its
//           `ContentResolver`.
// TS map:   `import type { Context } from "android-framework";`
//
// In TS you'd write (pseudocode):
// ```ts
// import type { Context } from "android-framework";
// ```
import android.content.Context

// What:     `import android.media.AudioFormat` brings in the `AudioFormat` class, source
//           of PCM-encoding constants like `AudioFormat.ENCODING_PCM_16BIT` and
//           `AudioFormat.ENCODING_PCM_FLOAT`.
// Why:      `toFloatChunk`/`decodeChunks` branch on the actual PCM encoding the codec
//           reports, using these constants.
// TS map:   `import { AudioFormat } from "android-framework";` — a constants namespace.
//
// In TS you'd write (pseudocode):
// ```ts
// import { AudioFormat } from "android-framework"; // ENCODING_PCM_16BIT / _FLOAT
// ```
import android.media.AudioFormat

// What:     `import android.media.MediaCodec` brings in `MediaCodec`, the platform
//           low-level audio/video DECODER, plus its nested `MediaCodec.BufferInfo` (a
//           small struct describing one output buffer: size/offset/flags) and flag
//           constants (`BUFFER_FLAG_END_OF_STREAM`, etc.).
// Why:      The decode loop drives a `MediaCodec` decoder, feeding input buffers and
//           draining output buffers.
// TS map:   `import { MediaCodec } from "android-framework";` — `.BufferInfo` is nested.
//
// In TS you'd write (pseudocode):
// ```ts
// import { MediaCodec } from "android-framework";
// ```
import android.media.MediaCodec

// What:     `import android.media.MediaExtractor` brings in `MediaExtractor`, which reads
//           a container file (mp4, ogg, flac, ...) and hands out its track formats and
//           encoded sample data.
// Why:      `measure` uses an extractor to find the audio track and feed its encoded
//           samples into the codec.
// TS map:   `import { MediaExtractor } from "android-framework";`
//
// In TS you'd write (pseudocode):
// ```ts
// import { MediaExtractor } from "android-framework";
// ```
import android.media.MediaExtractor

// What:     `import android.media.MediaFormat` brings in `MediaFormat`, a key/value bag
//           describing a track (MIME type, channel count, sample rate, PCM encoding), with
//           key constants like `MediaFormat.KEY_MIME` and `MediaFormat.KEY_CHANNEL_COUNT`.
// Why:      The code reads the track's MIME, channel count, and PCM encoding from
//           `MediaFormat` instances.
// TS map:   `import { MediaFormat } from "android-framework";` — a typed string-keyed map.
//
// In TS you'd write (pseudocode):
// ```ts
// import { MediaFormat } from "android-framework";
// ```
import android.media.MediaFormat

// What:     `import android.net.Uri` brings in Android's `Uri` (a parsed `content://` /
//           `file://` locator).
// Why:      `measure` takes a `Uri` to decode.
// TS map:   `import type { Uri } from "android-framework";` — mentally a `URL`.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { Uri } from "android-framework";
// ```
import android.net.Uri

// What:     `import android.util.Log` brings in Android's tagged logging (`Log.i`, `Log.w`).
// Why:      The decoder logs throughput info and channel-count mismatches.
// TS map:   Mentally a tagged `console`.
//
// In TS you'd write (pseudocode):
// ```ts
// // Mentally: a tagged console.
// ```
import android.util.Log

// What:     `import dev.monochromatic.musicplayer.core.measureTruePeak` brings in the
//           SHARED core function `measureTruePeak(channelCount, chunks)` from the `main`
//           core package. It is the pure DSP meter: given the channel count and a stream
//           of interleaved float chunks, it returns the true peak.
// Why:      `measure` decodes to float chunks and feeds them to this shared meter, so the
//           tested core (not this flavor) owns the peak math.
// TS map:   `import { measureTruePeak } from "../core/true-peak";`
//
// In TS you'd write (pseudocode):
// ```ts
// import { measureTruePeak } from "../core/true-peak";
// ```
import dev.monochromatic.musicplayer.core.measureTruePeak

// What:     `import java.nio.ByteBuffer` brings in the JDK `ByteBuffer` (a position-tracked
//           window over bytes). Here it also exposes views: `.asFloatBuffer()` / `.asShortBuffer()`.
// Why:      Codec output buffers arrive as `ByteBuffer`s the code reinterprets as floats or
//           shorts.
// TS map:   Mentally a `DataView`/`ArrayBuffer` with a moving cursor and typed views.
//
// In TS you'd write (pseudocode):
// ```ts
// // Mentally a DataView over an ArrayBuffer with asFloat/asShort views.
// ```
import java.nio.ByteBuffer

// What:     `import java.nio.ByteOrder` brings in `ByteOrder`, with `ByteOrder.nativeOrder()`
//           giving the device's native byte order (little/big-endian).
// Why:      Codec output is in native byte order, so the buffer views must be set to it
//           before reading samples.
// TS map:   `DataView` reads take a `littleEndian` boolean; `nativeOrder()` picks the
//           device's. No standalone `ByteOrder` type in TS.
//
// In TS you'd write (pseudocode):
// ```ts
// // DataView.getFloat32(offset, /* littleEndian = */ isDeviceLittleEndian)
// ```
import java.nio.ByteOrder

// What:     `import kotlinx.coroutines.CoroutineDispatcher` brings in `CoroutineDispatcher`,
//           the type naming WHICH thread pool a coroutine runs on.
// Why:      `measure`'s `dispatcher` parameter is a `CoroutineDispatcher` so callers can
//           choose the pool (default I/O, or the sweep's low-priority thread).
// TS map:   No equivalent; mentally "which background worker pool to run on".
//
// In TS you'd write (pseudocode):
// ```ts
// // No equivalent — JS is single-threaded; there is no pool type.
// ```
import kotlinx.coroutines.CoroutineDispatcher

// What:     `import kotlinx.coroutines.Dispatchers` brings in `Dispatchers`, the named pool
//           set (`Dispatchers.IO` for blocking I/O work).
// Why:      `measure` defaults its `dispatcher` to `Dispatchers.IO` (the decode does
//           blocking reads).
// TS map:   No equivalent (single-threaded JS).
//
// In TS you'd write (pseudocode):
// ```ts
// // No equivalent — JS is single-threaded.
// ```
import kotlinx.coroutines.Dispatchers

// What:     `import kotlinx.coroutines.withContext` brings in `withContext(dispatcher) { ... }`:
//           it runs the block ON the given dispatcher's thread and SUSPENDS the caller until
//           the block finishes, returning the block's value. Unlike `launch` (fire-and-forget),
//           `withContext` is await-style.
// Why:      `measure` wraps its whole decode in `withContext(dispatcher) { ... }` so the
//           blocking work runs on the chosen background pool while the suspend function awaits
//           it.
// TS map:   Loosely `await runOn(pool, async () => { ... })` — but TS has no real threads, so
//           the "move to another thread" part has no equivalent; only the "await a value" part
//           maps cleanly.
//
// In TS you'd write (pseudocode):
// ```ts
// // const result = await runOn(dispatcher, async () => { ... }); (no real TS threads)
// ```
import kotlinx.coroutines.withContext

// =============================================================================
// File summary (folds in the old KDoc's domain content)
// =============================================================================
//
// `Media3TruePeakDecoder` is OFFLINE true-peak measurement for the Media3 flavor: decode
// an entire audio file at a `content://` (or `file://`) URI to interleaved float PCM and
// run the pure `measureTruePeak` DSP over it. The platform decoder is the integration seam
// the Kotlin core deliberately left open: the desktop opened a symphonia decoder here, this
// Media3 flavor drives a `MediaExtractor` plus a `MediaCodec` decoder, and the full-Rust
// flavor feeds symphonia again.
//
// The decode is one synchronous extractor/codec pass on `Dispatchers.IO`. The decoded PCM
// is STREAMED through a lazy `Sequence` rather than collected into a list ON PURPOSE: the
// on-device library holds 30-minute field recordings, and a single one decoded to float is
// on the order of a gigabyte, which would exhaust the phone; producing and consuming one
// buffer at a time keeps the pass in roughly constant memory (the meter itself is a few
// floats per channel).
//
// Float is NOT requested: the audio is decoded at the codec's default, which is signed
// 16-bit PCM for every codec in this library, ample precision for a peak magnitude. Forcing
// float via `KEY_PCM_ENCODING` is actively harmful, because the platform raw-PCM passthrough
// decoder (used for WAV) then reports float output while still emitting the original 16-bit
// bytes; so the actual output encoding is read back from the codec's output format
// (defaulting to 16-bit) and float is handled only if a codec genuinely produces it. The
// whole pass is decode-only (no `Surface`, no rendering), so it produces no sound and is
// safe to run while the user is listening to something else.
//
// This is an `object` (a single shared instance, like a static utility namespace); it holds
// only constants and pure functions, no per-call state.

// What:     `object Media3TruePeakDecoder { ... }` declares a SINGLETON OBJECT: Kotlin
//           creates exactly one instance of it, named `Media3TruePeakDecoder`, and there is
//           no constructor to call. Members are accessed as `Media3TruePeakDecoder.measure(...)`,
//           like static methods on a namespace.
// Why:      The decoder is stateless utility code (constants + pure functions); a singleton
//           `object` is Kotlin's way to hang such "static" members off a name without making a
//           class you instantiate.
// TS map:   `export const Media3TruePeakDecoder = { measure(...) {...}, ... };` (a singleton
//           namespace object), or a class with only `static` members. There is no `new`.
// Gotcha:   `object` here is a TYPE DECLARATION creating one global instance, NOT the `object :
//           Interface { }` expression used elsewhere for anonymous instances. Same keyword, two
//           uses: named `object X {}` is a singleton; `object : T {}` is an anonymous instance.
//
// In TS you'd write (pseudocode):
// ```ts
// export const Media3TruePeakDecoder = {
//   // ...constants and functions below as members...
// };
// ```
object Media3TruePeakDecoder {
    // What:     `private const val DECODE_TAG: String = "Media3TruePeak"` declares a private
    //           compile-time `String` constant.
    // Why:      Distinct logcat tag for this offline pass, so its lines filter apart from
    //           playback's.
    // TS map:   `private static readonly DECODE_TAG = "Media3TruePeak";`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const DECODE_TAG = "Media3TruePeak";
    // ```
    private const val DECODE_TAG: String = "Media3TruePeak"

    // What:     `private const val DEQUEUE_TIMEOUT_US: Long = 10_000L` declares a private
    //           compile-time `Long` (64-bit integer) constant. The `_` in `10_000` is a digit
    //           GROUP SEPARATOR (ignored by the compiler, for readability); the `L` suffix
    //           makes it a `Long`. Sibling `Int` (32-bit) is declined because the MediaCodec
    //           timeout API takes microseconds as a `Long`.
    // Why:      Poll timeout (microseconds) for dequeuing OUTPUT buffers: small and positive so
    //           the loop waits briefly when no decoded buffer is ready rather than spinning the
    //           CPU, but never blocks the IO thread for long.
    // TS map:   `private static readonly DEQUEUE_TIMEOUT_US = 10_000;` — TS `number` covers it;
    //           the `_` separator and `L` suffix have no TS analogue beyond the numeric separator.
    // Gotcha:   `10_000L` is ten thousand (the underscore is cosmetic), typed `Long`, not `Int`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const DEQUEUE_TIMEOUT_US = 10_000; // microseconds
    // ```
    private const val DEQUEUE_TIMEOUT_US: Long = 10_000L

    // What:     `private const val NON_BLOCKING_TIMEOUT_US: Long = 0L` declares a private
    //           compile-time `Long` constant `0` (the `L` makes it `Long`, not `Int`).
    // Why:      Non-blocking timeout for dequeuing INPUT buffers. The feed loop drains every
    //           free input slot each pass with this timeout, so the decoder is never
    //           input-starved: feeding one buffer per iteration and then waiting on output
    //           instead makes the whole decode crawl at roughly one buffer per
    //           `DEQUEUE_TIMEOUT_US`, the difference between a sub-second scan and a 100-second one.
    // TS map:   `private static readonly NON_BLOCKING_TIMEOUT_US = 0;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const NON_BLOCKING_TIMEOUT_US = 0; // non-blocking
    // ```
    private const val NON_BLOCKING_TIMEOUT_US: Long = 0L

    // What:     `private const val PCM_16BIT_SCALE: Float = 32768.0f` declares a private
    //           compile-time `Float` (32-bit) constant; the `f` suffix marks it `Float` (vs the
    //           `Double` `32768.0`).
    // Why:      Divisor turning a signed 16-bit sample into a float in `-1.0..1.0`.
    //           `Short.MIN_VALUE` is `-32768`, so dividing by 32768 maps full-scale negative to
    //           exactly `-1.0`; this matches the desktop's `f32` sample domain so the measured
    //           peak is comparable.
    // TS map:   `private static readonly PCM_16BIT_SCALE = 32768.0;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const PCM_16BIT_SCALE = 32768.0;
    // ```
    private const val PCM_16BIT_SCALE: Float = 32768.0f

    // What:     `private const val NANOS_PER_MILLI: Long = 1_000_000L` declares a private
    //           compile-time `Long` constant one million (underscores cosmetic, `L` = `Long`).
    // Why:      Nanoseconds per millisecond, for the measured-duration log (`System.nanoTime()`
    //           returns nanoseconds as a `Long`).
    // TS map:   `private static readonly NANOS_PER_MILLI = 1_000_000;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const NANOS_PER_MILLI = 1_000_000;
    // ```
    private const val NANOS_PER_MILLI: Long = 1_000_000L

    // What:     `suspend fun measure(context: Context, contentUri: Uri, dispatcher: CoroutineDispatcher = Dispatchers.IO): Float = withContext(dispatcher) { ... }`
    //           declares a SUSPEND function (can await without blocking a thread) with an
    //           EXPRESSION BODY whose value is the whole `withContext(dispatcher) { ... }` call.
    //           - `dispatcher: CoroutineDispatcher = Dispatchers.IO` is a parameter with a
    //             DEFAULT VALUE: callers may omit it and get `Dispatchers.IO`.
    //           - `withContext(dispatcher) { ... }` runs the trailing-lambda block on that
    //             dispatcher's thread, suspends until it finishes, and returns the block's value
    //             (here the `Float` peak), which the expression body returns.
    // Why:      Decode the whole file at `contentUri` and return its measured true peak, linear
    //           and typically near `1.0` for full-scale material. A zero-channel or empty stream
    //           yields `0.0` (the core's silence guard), which downstream maps to unity gain.
    //           Runs on `dispatcher` (shared `Dispatchers.IO` by default; the background sweep
    //           passes a low-priority thread so its decode yields to playback). The pass is
    //           intentionally NOT cancellable mid-decode: a single track is bounded work, and the
    //           measure-on-miss caller would rather let it finish and cache than waste a partial
    //           decode; cancellation is honored at the track boundary by the batch sweep.
    //           THROWS: `IllegalArgumentException` when `contentUri` exposes no audio track;
    //           `IllegalStateException` when the track lacks a MIME type or the decoder emits a
    //           PCM encoding that is neither 16-bit nor float; `java.io.IOException` when the data
    //           source cannot be opened or the codec fails.
    // TS map:   `async function measure(context: Context, contentUri: Uri, dispatcher = Dispatchers.IO): Promise<number> { return await runOn(dispatcher, async () => { ... }); }`
    //           — Kotlin's `suspend` is `async`; the default param is the same idea; `withContext`
    //           is the "run on a pool and await" wrapper (the thread move has no TS analogue).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // async function measure(
    //   context: Context,
    //   contentUri: Uri,
    //   dispatcher: CoroutineDispatcher = Dispatchers.IO,
    // ): Promise<number> {
    //   return await runOn(dispatcher, async () => { /* ...decode...; return peak; */ });
    // }
    // ```
    suspend fun measure(
        context: Context,
        contentUri: Uri,
        dispatcher: CoroutineDispatcher = Dispatchers.IO,
    ): Float = withContext(dispatcher) {
        // What:     `val extractor = MediaExtractor()` declares a read-only local `extractor`
        //           (type inferred `MediaExtractor`) by constructing one (no `new`).
        // Why:      The extractor reads the container to find and feed the audio track.
        // TS map:   `const extractor = new MediaExtractor();`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const extractor = new MediaExtractor();
        // ```
        val extractor = MediaExtractor()
        // What:     `extractor.setDataSource(context, contentUri, null)` points the extractor at
        //           the URI. The third argument `null` is the headers map (a `null` literal).
        // Why:      `setDataSource(context, uri, null)`: the null headers map is allowed; for a
        //           `content://` URI the framework opens it via the `ContentResolver` itself, so
        //           no manual file-descriptor handling is needed.
        // TS map:   `extractor.setDataSource(context, contentUri, null);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // extractor.setDataSource(context, contentUri, null);
        // ```
        extractor.setDataSource(context, contentUri, null)

        // What:     `val trackIndex: Int = firstAudioTrack(extractor) ?: throw IllegalArgumentException("no audio track in $contentUri")`
        //           declares a read-only `Int` `trackIndex`. `firstAudioTrack(extractor)` returns
        //           a nullable `Int?` (the audio track index, or `null`). `?:` is the ELVIS
        //           operator: use the index if non-null, otherwise evaluate the right side, which
        //           THROWS an `IllegalArgumentException` (constructed with the URI message; no
        //           `new`).
        // Why:      We need an audio track to decode; a container without one is a usage error.
        // TS map:   `const i = firstAudioTrack(extractor); if (i === null) throw new IllegalArgumentException(`no audio track in ${contentUri}`); const trackIndex = i;`
        // Gotcha:   `?: throw ...` is Kotlin's "unwrap-or-throw"; the Elvis right side can be a
        //           `throw` (which has type `Nothing`), so this null-checks and throws in one line.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const i = firstAudioTrack(extractor);
        // if (i === null) throw new IllegalArgumentException(`no audio track in ${contentUri}`);
        // const trackIndex: number = i;
        // ```
        val trackIndex: Int = firstAudioTrack(extractor)
            ?: throw IllegalArgumentException("no audio track in $contentUri")
        // What:     `val inputFormat: MediaFormat = extractor.getTrackFormat(trackIndex)` declares
        //           a read-only `MediaFormat` local holding the chosen track's format bag.
        // Why:      We read MIME, channel count, etc. from this format and use it to configure the
        //           codec.
        // TS map:   `const inputFormat: MediaFormat = extractor.getTrackFormat(trackIndex);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const inputFormat: MediaFormat = extractor.getTrackFormat(trackIndex);
        // ```
        val inputFormat: MediaFormat = extractor.getTrackFormat(trackIndex)
        // What:     `extractor.selectTrack(trackIndex)` tells the extractor to read samples from
        //           that track.
        // Why:      Only a selected track yields sample data to feed the codec.
        // TS map:   `extractor.selectTrack(trackIndex);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // extractor.selectTrack(trackIndex);
        // ```
        extractor.selectTrack(trackIndex)

        // What:     `val mime: String = inputFormat.getString(MediaFormat.KEY_MIME) ?: throw IllegalStateException("audio track $trackIndex in $contentUri has no MIME type")`
        //           declares a read-only `String` `mime`. `getString(KEY_MIME)` returns a nullable
        //           `String?`; `?:` throws an `IllegalStateException` when it is `null`.
        // Why:      The codec is created by MIME type; a track without one cannot be decoded.
        // TS map:   `const m = inputFormat.getString(MediaFormat.KEY_MIME); if (m === null) throw new IllegalStateException(...); const mime = m;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const m = inputFormat.getString(MediaFormat.KEY_MIME);
        // if (m === null) throw new IllegalStateException(`audio track ${trackIndex} in ${contentUri} has no MIME type`);
        // const mime: string = m;
        // ```
        val mime: String = inputFormat.getString(MediaFormat.KEY_MIME)
            ?: throw IllegalStateException("audio track $trackIndex in $contentUri has no MIME type")

        // What:     `val channelCount: Int = inputFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT)`
        //           declares a read-only `Int` local holding the track's channel count, read from
        //           the input format.
        // Why:      `measureTruePeak` needs the channel count EAGERLY, but the decoder's OUTPUT
        //           format only exists after `INFO_OUTPUT_FORMAT_CHANGED`, which fires only once
        //           the lazy sequence is iterated. The container's input track carries the channel
        //           count for every audio codec in this library, so take it here; the loop
        //           cross-checks the output count and logs a mismatch.
        // TS map:   `const channelCount: number = inputFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const channelCount: number = inputFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT);
        // ```
        val channelCount: Int = inputFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT)

        // What:     `val codec: MediaCodec = MediaCodec.createDecoderByType(mime)` declares a
        //           read-only `MediaCodec` local, created by the static factory
        //           `createDecoderByType(mime)` (builds a decoder for that MIME type).
        // Why:      This is the decoder that turns encoded samples into PCM.
        // TS map:   `const codec: MediaCodec = MediaCodec.createDecoderByType(mime);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const codec: MediaCodec = MediaCodec.createDecoderByType(mime);
        // ```
        val codec: MediaCodec = MediaCodec.createDecoderByType(mime)
        // What:     `try { ... } finally { ... }` runs the decode in the `try` and guarantees the
        //           `finally` cleanup runs whether the decode succeeds or throws. The `try` block's
        //           tail value (`peak`) becomes the value of the whole `try` expression, which is
        //           the `withContext` lambda's value.
        // Why:      The codec/extractor MUST be released even on failure; `finally` is the cleanup
        //           hook. (The code uses `try/finally` rather than `use {}` because, as the cleanup
        //           note explains, these classes are not `AutoCloseable`.)
        // TS map:   `try { ...; return peak; } finally { ...cleanup... }` — Kotlin's `try` is an
        //           EXPRESSION (its value flows out); TS `try` is a statement, so TS would `return`
        //           inside the `try`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // try {
        //   /* ...configure, start, decode... */
        //   return peak; // try-block tail value
        // } finally {
        //   /* ...release codec and extractor... */
        // }
        // ```
        try {
            // What:     `codec.configure(inputFormat, /* surface = */ null, /* crypto = */ null, /* flags = */ 0)`
            //           configures the decoder. The `/* surface = */ null`, `/* crypto = */ null`,
            //           `/* flags = */ 0` are POSITIONAL arguments with INLINE BLOCK COMMENTS naming
            //           each (no video surface, no DRM crypto, no flags). The comments are just
            //           documentation, not named-argument syntax.
            // Why:      Decode at the codec's default encoding (16-bit for this library). Do NOT
            //           request float: the raw-PCM passthrough decoder would then mislabel its
            //           16-bit output as float. `decodeChunks` reads the encoding the codec actually
            //           reports and handles either. No surface means decode-only (no rendering, no
            //           sound).
            // TS map:   `codec.configure(inputFormat, /* surface */ null, /* crypto */ null, /* flags */ 0);`
            // Gotcha:   The `/* x = */` pieces are COMMENTS documenting positional args; removing
            //           them would not change the call's meaning (but here we keep them verbatim).
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // codec.configure(inputFormat, /* surface */ null, /* crypto */ null, /* flags */ 0);
            // ```
            codec.configure(inputFormat, /* surface = */ null, /* crypto = */ null, /* flags = */ 0)
            // What:     `codec.start()` starts the decoder so it begins accepting input buffers.
            // Why:      The codec must be started before the feed/drain loop runs.
            // TS map:   `codec.start();`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // codec.start();
            // ```
            codec.start()

            // What:     `var sampleCount = 0L` declares a REASSIGNABLE (`var`) `Long` local
            //           initialised to 0 (the `L` makes the literal a `Long`). A counter the
            //           `onEach` below increments.
            // Why:      Tally how many samples passed through, for the throughput log. `Long` (not
            //           `Int`) because a long recording can exceed 2 billion samples.
            // TS map:   `let sampleCount = 0;` (TS `number`).
            // Gotcha:   `0L` is a `Long` literal; mixing it with `Int` would need a cast.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // let sampleCount = 0; // running sample tally
            // ```
            var sampleCount = 0L
            // What:     `val startNanos: Long = System.nanoTime()` declares a read-only `Long`
            //           holding a high-resolution start timestamp in NANOSECONDS.
            // Why:      Measure how long the decode takes for the throughput log.
            // TS map:   `const startNanos = performance.now() * 1e6;` (ms -> ns, roughly).
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const startNanos = performance.now() * 1e6; // ~nanoseconds
            // ```
            val startNanos: Long = System.nanoTime()
            // What:     `val peak: Float = measureTruePeak(channelCount, decodeChunks(extractor, codec, channelCount).onEach { chunk -> sampleCount += chunk.size })`
            //           declares the read-only `Float` `peak` by calling the shared meter. The
            //           second argument is the lazy chunk stream with a tap:
            //           - `decodeChunks(...)` returns a lazy `Sequence<FloatArray>`.
            //           - `.onEach { chunk -> sampleCount += chunk.size }` is a LAZY side-effecting
            //             transform: as each chunk flows through, it runs the trailing lambda
            //             (named param `chunk`) to add `chunk.size` (the array length) to
            //             `sampleCount`, then passes the chunk on unchanged.
            // Why:      Stream the decoded chunks into the tested core meter while tallying the
            //           sample count, all without materialising the whole decode in memory.
            // TS map:   `const peak = measureTruePeak(channelCount, tap(decodeChunks(extractor, codec, channelCount), (chunk) => { sampleCount += chunk.length; }));`
            //           — `.onEach` is a lazy generator "tap"; `chunk.size` is `.length`.
            // Gotcha:   `.onEach` runs LAZILY (only as the meter pulls each chunk), not eagerly; the
            //           count is correct because the meter consumes the whole sequence.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const peak: number = measureTruePeak(
            //   channelCount,
            //   tap(decodeChunks(extractor, codec, channelCount), (chunk) => { sampleCount += chunk.length; }),
            // );
            // ```
            val peak: Float = measureTruePeak(
                channelCount,
                decodeChunks(extractor, codec, channelCount).onEach { chunk -> sampleCount += chunk.size },
            )
            // What:     `val elapsedMs: Long = (System.nanoTime() - startNanos) / NANOS_PER_MILLI`
            //           declares a read-only `Long` of elapsed milliseconds: take a new nanosecond
            //           timestamp, subtract the start, and integer-divide by `NANOS_PER_MILLI`.
            //           `Long - Long` and `Long / Long` are integer ops (the division truncates).
            // Why:      Compute the decode duration for the throughput log.
            // TS map:   `const elapsedMs = Math.trunc((performance.now() * 1e6 - startNanos) / NANOS_PER_MILLI);`
            // Gotcha:   `Long / Long` is INTEGER division (truncates the remainder), not float
            //           division; the sub-millisecond part is dropped.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const elapsedMs = Math.trunc((performance.now() * 1e6 - startNanos) / NANOS_PER_MILLI);
            // ```
            val elapsedMs: Long = (System.nanoTime() - startNanos) / NANOS_PER_MILLI
            // What:     `Log.i(DECODE_TAG, "measured true peak $peak for $contentUri ($channelCount ch, $mime) " + "in ${elapsedMs}ms over $sampleCount samples")`
            //           logs at INFO level. The message is two STRING-TEMPLATE literals JOINED with
            //           `+` (string concatenation across the line break). `$peak`, `$contentUri`,
            //           `${elapsedMs}`, `$sampleCount` interpolate values; `${elapsedMs}ms` uses
            //           braces because the `ms` would otherwise glue onto the name.
            // Why:      The sample count and elapsed time are logged so the scan's throughput stays
            //           observable.
            // TS map:   ``console.info(DECODE_TAG, `measured true peak ${peak} for ${contentUri} (${channelCount} ch, ${mime}) ` + `in ${elapsedMs}ms over ${sampleCount} samples`);``
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // console.info(
            //   DECODE_TAG,
            //   `measured true peak ${peak} for ${contentUri} (${channelCount} ch, ${mime}) ` +
            //     `in ${elapsedMs}ms over ${sampleCount} samples`,
            // );
            // ```
            Log.i(
                DECODE_TAG,
                "measured true peak $peak for $contentUri ($channelCount ch, $mime) " +
                    "in ${elapsedMs}ms over $sampleCount samples",
            )
            // What:     `peak` on its own line is the TRY block's (and thus the `withContext`
            //           lambda's, and thus the function's) TAIL EXPRESSION: with no trailing `;`
            //           and being the last expression, its value is returned.
            // Why:      Hand the measured peak back as the function's result.
            // TS map:   `return peak;` (TS would put the `return` inside the `try`).
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return peak;
            // ```
            peak
        } finally {
            // What:     `runCatching { codec.stop() }` runs `codec.stop()` and WRAPS the outcome in
            //           a `Result`, SWALLOWING any exception (the `Result` is discarded here).
            //           `runCatching { ... }` is the stdlib "try this, capture success-or-failure"
            //           helper; ignoring its return value means "try to stop, ignore failure".
            // Why:      `MediaCodec` and `MediaExtractor` are final classes that do not implement
            //           `AutoCloseable`, so `use {}` will not compile; we release by hand. `stop()`
            //           can throw when the codec is already in an error state, so guard it, but
            //           `release()`/`extractor.release()` must always run.
            // TS map:   `try { codec.stop(); } catch { /* ignore */ }` — `runCatching {}` discarding
            //           its `Result` is a try/catch that swallows the error.
            // Gotcha:   `runCatching { }` here SILENTLY discards the failure (the `Result` is unused).
            //           That is intentional only because a failed `stop()` is benign before `release()`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // try { codec.stop(); } catch { /* benign: codec already in error state */ }
            // ```
            runCatching { codec.stop() }
            // What:     `codec.release()` frees the decoder's native resources.
            // Why:      Must always run, even if `stop()` failed.
            // TS map:   `codec.release();`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // codec.release();
            // ```
            codec.release()
            // What:     `extractor.release()` frees the extractor's resources.
            // Why:      Must always run; releases the data source.
            // TS map:   `extractor.release();`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // extractor.release();
            // ```
            extractor.release()
        }
    }

    // What:     `private fun firstAudioTrack(extractor: MediaExtractor): Int? = (0 until extractor.trackCount).firstOrNull { index -> ... }`
    //           declares a private function returning a NULLABLE `Int?`, as an expression body:
    //           - `0 until extractor.trackCount` builds an `IntRange` `0, 1, ..., trackCount-1`
    //             (`until` is HALF-OPEN: it EXCLUDES the upper bound).
    //           - `.firstOrNull { index -> ... }` returns the FIRST element for which the trailing
    //             lambda (named param `index`) is `true`, or `null` if none match.
    //           - the lambda body (next lines) tests whether that track's MIME starts with
    //             `"audio/"`.
    // Why:      Find the first track whose MIME names audio, or `null` when the container exposes
    //           none.
    // TS map:   `private firstAudioTrack(extractor: MediaExtractor): number | null { const i = [...range(0, extractor.trackCount)].find((index) => ...); return i ?? null; }`
    //           — `0 until n` is a half-open range; `.firstOrNull` is `.find(...) ?? null`.
    // Gotcha:   `until` is HALF-OPEN (excludes `trackCount`); the sibling `..` (e.g. `0..n`) is
    //           INCLUSIVE. Using `..` here would index one past the end.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private firstAudioTrack(extractor: MediaExtractor): number | null {
    //   for (let index = 0; index < extractor.trackCount; index++) {
    //     if (extractor.getTrackFormat(index).getString(MediaFormat.KEY_MIME)?.startsWith("audio/") === true) {
    //       return index;
    //     }
    //   }
    //   return null;
    // }
    // ```
    private fun firstAudioTrack(extractor: MediaExtractor): Int? =
        (0 until extractor.trackCount).firstOrNull { index ->
            // What:     `extractor.getTrackFormat(index).getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true`
            //           is the lambda's predicate (its tail value). Pieces:
            //           - `getString(MediaFormat.KEY_MIME)` returns a nullable `String?` MIME.
            //           - `?.startsWith("audio/")` is a SAFE CALL: if the MIME is non-null, return
            //             whether it starts with `"audio/"` (a `Boolean`); if it is `null`, the whole
            //             thing is `null`. So the type so far is `Boolean?`.
            //           - `== true` collapses that `Boolean?` to a plain `Boolean`: `true` stays
            //             `true`, while both `false` and `null` become `false`.
            // Why:      Treat a track as audio only when its MIME is present AND starts with
            //           `"audio/"`; a missing MIME is "not audio".
            // TS map:   `mime?.startsWith("audio/") === true` — TS's `=== true` does the same
            //           null-or-false collapse.
            // Gotcha:   `== true` is not redundant: it is the idiom for turning a `Boolean?` (which
            //           can be `null`) into a `Boolean`, mapping `null` to `false`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // extractor.getTrackFormat(index).getString(MediaFormat.KEY_MIME)?.startsWith("audio/") === true
            // ```
            extractor.getTrackFormat(index).getString(MediaFormat.KEY_MIME)
                ?.startsWith("audio/") == true
        }

    // What:     `private fun decodeChunks(extractor: MediaExtractor, codec: MediaCodec, expectedChannels: Int): Sequence<FloatArray> = sequence { ... }`
    //           declares a private function returning a `Sequence<FloatArray>` (a LAZY stream of
    //           float arrays) via an expression body. `sequence { ... }` is the SEQUENCE BUILDER:
    //           it builds a lazy generator; inside, `yield(x)` emits one element and SUSPENDS until
    //           the consumer asks for the next. Nothing in the block runs until the sequence is
    //           iterated.
    // Why:      Lazily decode the selected track to interleaved float chunks in decode order, one
    //           `FloatArray` per non-empty output buffer, stopping at end-of-stream. It never
    //           yields an empty array: the core meter treats an empty chunk as end-of-stream, and
    //           the codec routinely emits a zero-size buffer at the final flag and sometimes at the
    //           format change, so those are released and skipped.
    // TS map:   `function* decodeChunks(extractor, codec, expectedChannels): Generator<Float32Array> { ... yield chunk; ... }`
    //           — Kotlin's `sequence { ... yield(x) }` is exactly TS's `function* () { ... yield x; }`.
    // Gotcha:   `Sequence` is LAZY (pull-based), unlike a `List`. The `sequence {}` body does not run
    //           on call; it runs incrementally as the consumer pulls. `FloatArray` is a PRIMITIVE
    //           float array (unboxed), sibling to the boxed `Array<Float>`; here it maps to
    //           `Float32Array`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // function* decodeChunks(
    //   extractor: MediaExtractor,
    //   codec: MediaCodec,
    //   expectedChannels: number,
    // ): Generator<Float32Array> {
    //   // ...feed/drain loop, yielding each non-empty chunk...
    // }
    // ```
    private fun decodeChunks(
        extractor: MediaExtractor,
        codec: MediaCodec,
        expectedChannels: Int,
    ): Sequence<FloatArray> = sequence {
        // What:     `val info = MediaCodec.BufferInfo()` declares a read-only local `info`
        //           constructed from the nested class `MediaCodec.BufferInfo` (no `new`). It is a
        //           reusable struct the codec fills in per output buffer (size/offset/flags).
        // Why:      `dequeueOutputBuffer(info, ...)` writes the dequeued buffer's metadata into it.
        // TS map:   `const info = new MediaCodec.BufferInfo();`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const info = new MediaCodec.BufferInfo();
        // ```
        val info = MediaCodec.BufferInfo()
        // What:     `var pcmEncoding: Int = AudioFormat.ENCODING_PCM_16BIT` declares a REASSIGNABLE
        //           `Int` initialised to the 16-bit PCM constant.
        // Why:      A missing `KEY_PCM_ENCODING` in the output format means signed 16-bit, so
        //           default to it and overwrite once the real format arrives.
        // TS map:   `let pcmEncoding = AudioFormat.ENCODING_PCM_16BIT;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // let pcmEncoding = AudioFormat.ENCODING_PCM_16BIT;
        // ```
        var pcmEncoding: Int = AudioFormat.ENCODING_PCM_16BIT
        // What:     `var queuedEndOfInput = false` declares a reassignable `Boolean` (type inferred)
        //           tracking whether the end-of-stream input buffer has been queued.
        // Why:      Once we have signalled end-of-input, stop feeding and only drain.
        // TS map:   `let queuedEndOfInput = false;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // let queuedEndOfInput = false;
        // ```
        var queuedEndOfInput = false
        // What:     `var drainedEndOfOutput = false` declares a reassignable `Boolean` tracking
        //           whether the end-of-stream OUTPUT buffer has been seen.
        // Why:      The outer loop runs until output is fully drained.
        // TS map:   `let drainedEndOfOutput = false;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // let drainedEndOfOutput = false;
        // ```
        var drainedEndOfOutput = false

        // What:     `while (!drainedEndOfOutput) { ... }` is the main loop: keep going until the
        //           codec has emitted its end-of-stream output buffer.
        // Why:      Drive feed-then-drain cycles until the whole track has been decoded.
        // TS map:   `while (!drainedEndOfOutput) { ... }`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // while (!drainedEndOfOutput) { ... }
        // ```
        while (!drainedEndOfOutput) {
            // region feed every free input buffer (non-blocking) so the decoder never starves
            // What:     `while (!queuedEndOfInput) { ... }` is the inner feed loop: keep grabbing
            //           free input slots until we have signalled end-of-input.
            // Why:      Drain every currently-free input buffer each pass so the decoder is never
            //           starved (see the `NON_BLOCKING_TIMEOUT_US` rationale).
            // TS map:   `while (!queuedEndOfInput) { ... }`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // while (!queuedEndOfInput) { ... }
            // ```
            while (!queuedEndOfInput) {
                // What:     `val inputIndex: Int = codec.dequeueInputBuffer(NON_BLOCKING_TIMEOUT_US)`
                //           declares a read-only `Int`. `dequeueInputBuffer(timeout)` returns the
                //           index of a free input buffer, or a NEGATIVE value when none is free
                //           within the (zero, non-blocking) timeout.
                // Why:      Try to grab a free input slot to fill with encoded data.
                // TS map:   `const inputIndex = codec.dequeueInputBuffer(NON_BLOCKING_TIMEOUT_US);`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // const inputIndex = codec.dequeueInputBuffer(NON_BLOCKING_TIMEOUT_US);
                // ```
                val inputIndex: Int = codec.dequeueInputBuffer(NON_BLOCKING_TIMEOUT_US)
                // What:     `if (inputIndex < 0) { break }` checks for "no free slot" (negative
                //           index) and `break`s out of the inner feed loop.
                // Why:      No free input slot right now; go drain output and come back.
                // TS map:   `if (inputIndex < 0) break;`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // if (inputIndex < 0) break;
                // ```
                if (inputIndex < 0) {
                    break
                }
                // What:     `val inputBuffer: ByteBuffer = codec.getInputBuffer(inputIndex) ?: error("dequeued input buffer $inputIndex was null")`
                //           declares a read-only `ByteBuffer`. `getInputBuffer(index)` returns a
                //           nullable `ByteBuffer?`; `?:` falls back to `error(...)`, the stdlib
                //           helper that THROWS an `IllegalStateException` with the given message.
                // Why:      Get the actual buffer to write encoded data into; a `null` here is an
                //           illegal state (the index was just reported free), so fail loudly.
                // TS map:   `const inputBuffer = codec.getInputBuffer(inputIndex); if (inputBuffer === null) throw new Error(`dequeued input buffer ${inputIndex} was null`);`
                // Gotcha:   `error("msg")` is Kotlin stdlib that THROWS (not a logging call); it is
                //           `throw new Error(...)` (specifically `IllegalStateException`).
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // const inputBuffer = codec.getInputBuffer(inputIndex);
                // if (inputBuffer === null) throw new Error(`dequeued input buffer ${inputIndex} was null`);
                // ```
                val inputBuffer: ByteBuffer = codec.getInputBuffer(inputIndex)
                    ?: error("dequeued input buffer $inputIndex was null")
                // What:     `val sampleSize: Int = extractor.readSampleData(inputBuffer, /* offset = */ 0)`
                //           declares a read-only `Int`. `readSampleData(buffer, offset)` reads the
                //           next encoded sample into the buffer at byte `offset` (here `0`, with an
                //           inline naming comment) and returns its byte size, or `-1` at end of stream.
                // Why:      Pull the next encoded chunk from the container into the input buffer.
                // TS map:   `const sampleSize = extractor.readSampleData(inputBuffer, /* offset */ 0);`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // const sampleSize = extractor.readSampleData(inputBuffer, /* offset */ 0);
                // ```
                val sampleSize: Int = extractor.readSampleData(inputBuffer, /* offset = */ 0)
                // What:     `if (sampleSize < 0) { ... } else { ... }` branches on whether the
                //           extractor returned end-of-stream (`-1`, hence `< 0`) or real data.
                // Why:      At end of stream, queue an end-of-stream marker; otherwise queue the
                //           real sample and advance.
                // TS map:   `if (sampleSize < 0) { ... } else { ... }`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // if (sampleSize < 0) { ... } else { ... }
                // ```
                if (sampleSize < 0) {
                    // What:     `codec.queueInputBuffer(inputIndex, 0, 0, 0L, MediaCodec.BUFFER_FLAG_END_OF_STREAM)`
                    //           submits a ZERO-size buffer (offset 0, size 0, presentation time `0L`
                    //           a `Long`) flagged `BUFFER_FLAG_END_OF_STREAM`.
                    // Why:      `-1` signals no more samples: queue a zero-size buffer flagged
                    //           end-of-stream so the decoder knows the input is done.
                    // TS map:   `codec.queueInputBuffer(inputIndex, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM);`
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // codec.queueInputBuffer(inputIndex, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM);
                    // ```
                    codec.queueInputBuffer(inputIndex, 0, 0, 0L, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                    // What:     `queuedEndOfInput = true` flips the flag so the inner feed loop stops.
                    // Why:      We have signalled end-of-input; no more feeding.
                    // TS map:   `queuedEndOfInput = true;`
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // queuedEndOfInput = true;
                    // ```
                    queuedEndOfInput = true
                } else {
                    // What:     `codec.queueInputBuffer(inputIndex, 0, sampleSize, extractor.sampleTime, 0)`
                    //           submits the just-read sample: offset 0, length `sampleSize`,
                    //           presentation time `extractor.sampleTime` (a `Long`), no flags (`0`).
                    // Why:      Hand the real encoded sample to the decoder.
                    // TS map:   `codec.queueInputBuffer(inputIndex, 0, sampleSize, extractor.sampleTime, 0);`
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // codec.queueInputBuffer(inputIndex, 0, sampleSize, extractor.sampleTime, 0);
                    // ```
                    codec.queueInputBuffer(inputIndex, 0, sampleSize, extractor.sampleTime, 0)
                    // What:     `extractor.advance()` moves the extractor to the next sample.
                    // Why:      Step forward so the next `readSampleData` reads new data.
                    // TS map:   `extractor.advance();`
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // extractor.advance();
                    // ```
                    extractor.advance()
                }
            }
            // endregion

            // region drain available output
            // What:     `val outputIndex: Int = codec.dequeueOutputBuffer(info, DEQUEUE_TIMEOUT_US)`
            //           declares a read-only `Int`. `dequeueOutputBuffer(info, timeout)` returns the
            //           index of a ready output buffer (filling `info`), OR a negative status code
            //           like `INFO_OUTPUT_FORMAT_CHANGED` / `INFO_TRY_AGAIN_LATER`.
            // Why:      Pull one decoded output buffer (or learn the format changed / nothing ready).
            // TS map:   `const outputIndex = codec.dequeueOutputBuffer(info, DEQUEUE_TIMEOUT_US);`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const outputIndex = codec.dequeueOutputBuffer(info, DEQUEUE_TIMEOUT_US);
            // ```
            val outputIndex: Int = codec.dequeueOutputBuffer(info, DEQUEUE_TIMEOUT_US)
            // What:     `if (outputIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) { ... } else if (outputIndex >= 0) { ... }`
            //           branches: the first arm handles the one-time output-format announcement;
            //           the `else if (outputIndex >= 0)` arm handles a real decoded buffer. Any
            //           other negative status (`INFO_TRY_AGAIN_LATER`, the deprecated
            //           `INFO_OUTPUT_BUFFERS_CHANGED`) falls through with NO handling: the loop
            //           simply cycles back to feed more input and poll again.
            // Why:      Learn the PCM encoding/channel count when the format arrives, and process
            //           actual PCM when a buffer is ready; ignore the transient "try again" status.
            // TS map:   `if (outputIndex === MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) { ... } else if (outputIndex >= 0) { ... }`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // if (outputIndex === MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) { ... }
            // else if (outputIndex >= 0) { ... }
            // // else: INFO_TRY_AGAIN_LATER etc. -> no handling, loop again
            // ```
            if (outputIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                // What:     `val outputFormat: MediaFormat = codec.outputFormat` declares a read-only
                //           `MediaFormat` holding the decoder's actual OUTPUT format (now available).
                // Why:      Read the real PCM encoding and channel count from it.
                // TS map:   `const outputFormat: MediaFormat = codec.outputFormat;`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // const outputFormat: MediaFormat = codec.outputFormat;
                // ```
                val outputFormat: MediaFormat = codec.outputFormat
                // What:     `pcmEncoding = outputFormat.getInteger(MediaFormat.KEY_PCM_ENCODING, AudioFormat.ENCODING_PCM_16BIT)`
                //           reassigns `pcmEncoding`. The two-argument `getInteger(key, default)`
                //           returns the value for the key, or the DEFAULT (`ENCODING_PCM_16BIT`)
                //           when the key is absent.
                // Why:      A missing `KEY_PCM_ENCODING` is the documented signal for signed 16-bit,
                //           so default to it; otherwise adopt whatever the codec actually emits.
                // TS map:   `pcmEncoding = outputFormat.getInteger(MediaFormat.KEY_PCM_ENCODING, AudioFormat.ENCODING_PCM_16BIT);`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // pcmEncoding = outputFormat.getInteger(MediaFormat.KEY_PCM_ENCODING, AudioFormat.ENCODING_PCM_16BIT);
                // ```
                pcmEncoding = outputFormat.getInteger(
                    MediaFormat.KEY_PCM_ENCODING, AudioFormat.ENCODING_PCM_16BIT,
                )
                // What:     `val outputChannels: Int = outputFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT)`
                //           declares a read-only `Int` holding the decoder's reported channel count.
                // Why:      Cross-check it against the input track's channel count.
                // TS map:   `const outputChannels = outputFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT);`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // const outputChannels = outputFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT);
                // ```
                val outputChannels: Int = outputFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
                // What:     `if (outputChannels != expectedChannels) { Log.w(...) }` warns when the
                //           decoder's channel count disagrees with the input track's.
                // Why:      We took the channel count eagerly from the input; log if the output
                //           disagrees (the meter still uses the eager count).
                // TS map:   `if (outputChannels !== expectedChannels) console.warn(...);`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // if (outputChannels !== expectedChannels) {
                //   console.warn(DECODE_TAG, `channel count mismatch: input ${expectedChannels}, output ${outputChannels}`);
                // }
                // ```
                if (outputChannels != expectedChannels) {
                    // What:     `Log.w(DECODE_TAG, "channel count mismatch: input $expectedChannels, output $outputChannels")`
                    //           logs the mismatch at WARN level (string-template interpolation).
                    // Why:      Make a channel-count discrepancy visible without aborting the decode.
                    // TS map:   ``console.warn(DECODE_TAG, `channel count mismatch: input ${expectedChannels}, output ${outputChannels}`);``
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // console.warn(DECODE_TAG, `channel count mismatch: input ${expectedChannels}, output ${outputChannels}`);
                    // ```
                    Log.w(
                        DECODE_TAG,
                        "channel count mismatch: input $expectedChannels, output $outputChannels",
                    )
                }
            } else if (outputIndex >= 0) {
                // What:     `val isCodecConfig: Boolean = (info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG) != 0`
                //           declares a read-only `Boolean`. `info.flags and BUFFER_FLAG_CODEC_CONFIG`
                //           is a BITWISE AND (`and` is Kotlin's infix bitwise-and on `Int`); `!= 0`
                //           tests whether that bit is set, i.e. this buffer carries codec config data,
                //           not audio.
                // Why:      Codec-config buffers must be skipped (they are not PCM samples).
                // TS map:   `const isCodecConfig = (info.flags & MediaCodec.BUFFER_FLAG_CODEC_CONFIG) !== 0;`
                // Gotcha:   `and` here is the BITWISE operator (Kotlin spells `&` as the infix word
                //           `and` for `Int`), NOT logical `&&`. Read it as TS `&`.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // const isCodecConfig = (info.flags & MediaCodec.BUFFER_FLAG_CODEC_CONFIG) !== 0;
                // ```
                val isCodecConfig: Boolean =
                    (info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG) != 0
                // What:     `if (info.size > 0 && !isCodecConfig) { ... }` runs only for a real,
                //           non-empty PCM buffer (`&&` is logical AND).
                // Why:      Yield only real PCM: skip codec-config buffers and any zero-size buffer,
                //           since the meter would read an empty chunk as end-of-stream and stop early.
                // TS map:   `if (info.size > 0 && !isCodecConfig) { ... }`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // if (info.size > 0 && !isCodecConfig) { ... }
                // ```
                if (info.size > 0 && !isCodecConfig) {
                    // What:     `val outputBuffer: ByteBuffer = codec.getOutputBuffer(outputIndex) ?: error("dequeued output buffer $outputIndex was null")`
                    //           declares a read-only `ByteBuffer`. `getOutputBuffer(index)` returns a
                    //           nullable `ByteBuffer?`; `?:` falls back to `error(...)` (throws
                    //           `IllegalStateException`) on `null`.
                    // Why:      Get the decoded PCM bytes; a `null` for a just-dequeued index is an
                    //           illegal state, so fail loudly.
                    // TS map:   `const outputBuffer = codec.getOutputBuffer(outputIndex); if (outputBuffer === null) throw new Error(...);`
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // const outputBuffer = codec.getOutputBuffer(outputIndex);
                    // if (outputBuffer === null) throw new Error(`dequeued output buffer ${outputIndex} was null`);
                    // ```
                    val outputBuffer: ByteBuffer = codec.getOutputBuffer(outputIndex)
                        ?: error("dequeued output buffer $outputIndex was null")
                    // What:     `yield(toFloatChunk(outputBuffer, info.offset, info.size, pcmEncoding))`
                    //           converts the valid span of the buffer to a `FloatArray` (via
                    //           `toFloatChunk`) and YIELDS it from the sequence. `yield` emits one
                    //           element and suspends the generator until the consumer pulls the next.
                    // Why:      Stream this decoded chunk to the meter without buffering the whole file.
                    // TS map:   `yield toFloatChunk(outputBuffer, info.offset, info.size, pcmEncoding);`
                    // Gotcha:   `yield(...)` here is a generator yield (like TS `yield`), only usable
                    //           inside the `sequence { }` builder; it pauses execution, not a return.
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // yield toFloatChunk(outputBuffer, info.offset, info.size, pcmEncoding);
                    // ```
                    yield(toFloatChunk(outputBuffer, info.offset, info.size, pcmEncoding))
                }
                // What:     `codec.releaseOutputBuffer(outputIndex, /* render = */ false)` returns the
                //           output buffer to the codec. The second argument `false` (with an inline
                //           naming comment) means "do NOT render to a surface" (decode-only).
                // Why:      The buffer must be released back to the codec after reading; `render=false`
                //           keeps the pass silent (no playback).
                // TS map:   `codec.releaseOutputBuffer(outputIndex, /* render */ false);`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // codec.releaseOutputBuffer(outputIndex, /* render */ false);
                // ```
                codec.releaseOutputBuffer(outputIndex, /* render = */ false)
                // What:     `if ((info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) { drainedEndOfOutput = true }`
                //           tests (bitwise `and`) whether this output buffer carries the end-of-stream
                //           flag, and if so flips `drainedEndOfOutput` to stop the main loop.
                // Why:      The end-of-stream output buffer is the signal that decoding is complete.
                // TS map:   `if ((info.flags & MediaCodec.BUFFER_FLAG_END_OF_STREAM) !== 0) drainedEndOfOutput = true;`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // if ((info.flags & MediaCodec.BUFFER_FLAG_END_OF_STREAM) !== 0) drainedEndOfOutput = true;
                // ```
                if ((info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) {
                    drainedEndOfOutput = true
                }
            }
            // endregion
        }
    }

    // What:     `private fun toFloatChunk(buffer: ByteBuffer, offset: Int, size: Int, pcmEncoding: Int): FloatArray { ... }`
    //           declares a private function taking a codec output buffer, the valid byte `offset`
    //           and `size` within it, and the PCM `pcmEncoding`, returning a `FloatArray`
    //           (primitive float array; sibling boxed `Array<Float>`).
    // Why:      Convert one decoded output buffer to an interleaved `FloatArray`, honoring the
    //           actual PCM encoding: 16-bit samples are scaled by `PCM_16BIT_SCALE`, float samples
    //           are copied. Both read in the device's native byte order (what a platform decoder
    //           emits). The valid span is taken from `offset`/`size` (the `BufferInfo` authority),
    //           independent of the buffer's own position and limit. THROWS `IllegalStateException`
    //           when `pcmEncoding` is neither float nor 16-bit, so an unexpected format is reported
    //           rather than measured as garbage.
    // TS map:   `private toFloatChunk(buffer: ByteBuffer, offset: number, size: number, pcmEncoding: number): Float32Array { ... }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private toFloatChunk(buffer: ByteBuffer, offset: number, size: number, pcmEncoding: number): Float32Array { ... }
    // ```
    private fun toFloatChunk(
        buffer: ByteBuffer,
        offset: Int,
        size: Int,
        pcmEncoding: Int,
    ): FloatArray {
        // What:     `val region: ByteBuffer = buffer.duplicate().apply { position(offset); limit(offset + size); order(ByteOrder.nativeOrder()) }`
        //           declares a read-only `ByteBuffer` `region`.
        //           - `buffer.duplicate()` makes a shallow COPY that shares the same underlying
        //             bytes but has its OWN independent position/limit cursor.
        //           - `.apply { ... }` is a SCOPE FUNCTION: it runs the block with the duplicate as
        //             `this` (so the unqualified `position(...)`, `limit(...)`, `order(...)` calls
        //             target it) and RETURNS that same duplicate.
        //           - inside: `position(offset)` and `limit(offset + size)` narrow the view to the
        //             valid span; `order(ByteOrder.nativeOrder())` sets native byte order.
        // Why:      Read exactly the valid `[offset, offset+size)` span in native byte order without
        //           disturbing the original buffer's cursor (the codec still owns that).
        // TS map:   `const region = (() => { const d = buffer.duplicate(); d.position(offset); d.limit(offset + size); d.order(nativeOrder()); return d; })();`
        // Gotcha:   `.apply { }` returns the RECEIVER (the duplicate), not the block's last value;
        //           and `.duplicate()` shares bytes but not the cursor, so narrowing `region` does
        //           not move the original `buffer`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const region = buffer.duplicate();
        // region.position(offset);
        // region.limit(offset + size);
        // region.order(ByteOrder.nativeOrder());
        // ```
        val region: ByteBuffer = buffer.duplicate().apply {
            position(offset)
            limit(offset + size)
            order(ByteOrder.nativeOrder())
        }
        // What:     `if (pcmEncoding == AudioFormat.ENCODING_PCM_FLOAT) { ... }` branches when the
        //           decoder genuinely emitted 32-bit float samples.
        // Why:      Float output is copied through without scaling.
        // TS map:   `if (pcmEncoding === AudioFormat.ENCODING_PCM_FLOAT) { ... }`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (pcmEncoding === AudioFormat.ENCODING_PCM_FLOAT) { ... }
        // ```
        if (pcmEncoding == AudioFormat.ENCODING_PCM_FLOAT) {
            // What:     `val floats = region.asFloatBuffer()` declares a read-only local `floats`
            //           (type inferred `FloatBuffer`): a VIEW of `region`'s bytes as 32-bit floats.
            // Why:      Read the bytes as floats directly.
            // TS map:   `const floats = new Float32Array(region.buffer, region.position, region.remaining/4);` (a typed view).
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const floats = region.asFloatBuffer();
            // ```
            val floats = region.asFloatBuffer()
            // What:     `return FloatArray(floats.remaining()).also { floats.get(it) }` builds and
            //           returns a `FloatArray`.
            //           - `FloatArray(floats.remaining())` allocates a primitive float array sized to
            //             the remaining float count.
            //           - `.also { floats.get(it) }` is a SCOPE FUNCTION: it runs the block with the
            //             new array as `it`, BULK-copying the floats into it (`floats.get(it)` fills
            //             the array), then RETURNS that same array (the receiver). So the array is
            //             allocated, filled, and returned in one expression.
            // Why:      Materialise this chunk's float samples into a plain array for the meter.
            // TS map:   `const out = new Float32Array(floats.remaining()); floats.get(out); return out;`
            // Gotcha:   `.also { }` returns the RECEIVER (the array), not the block's value; the block
            //           is run purely for its side effect (filling the array).
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const out = new Float32Array(floats.remaining());
            // floats.get(out); // bulk copy
            // return out;
            // ```
            return FloatArray(floats.remaining()).also { floats.get(it) }
        }
        // What:     `if (pcmEncoding == AudioFormat.ENCODING_PCM_16BIT) { ... }` branches when the
        //           decoder emitted signed 16-bit samples (the common case).
        // Why:      16-bit samples must be scaled to floats in `-1.0..1.0`.
        // TS map:   `if (pcmEncoding === AudioFormat.ENCODING_PCM_16BIT) { ... }`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (pcmEncoding === AudioFormat.ENCODING_PCM_16BIT) { ... }
        // ```
        if (pcmEncoding == AudioFormat.ENCODING_PCM_16BIT) {
            // What:     `val shorts = region.asShortBuffer()` declares a read-only `shorts` (a
            //           `ShortBuffer`): a VIEW of `region`'s bytes as signed 16-bit shorts.
            // Why:      Read the raw 16-bit samples.
            // TS map:   `const shorts = new Int16Array(region.buffer, region.position, region.remaining/2);`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const shorts = region.asShortBuffer();
            // ```
            val shorts = region.asShortBuffer()
            // What:     `val count: Int = shorts.remaining()` declares a read-only `Int` of how many
            //           shorts remain to read.
            // Why:      Size the output and copy buffers.
            // TS map:   `const count = shorts.remaining();`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const count = shorts.remaining();
            // ```
            val count: Int = shorts.remaining()
            // What:     `val raw = ShortArray(count)` declares a read-only local `raw`, a PRIMITIVE
            //           16-bit-integer array (sibling: boxed `Array<Short>`) of length `count`.
            // Why:      A destination to bulk-copy the shorts into before converting.
            // TS map:   `const raw = new Int16Array(count);`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const raw = new Int16Array(count);
            // ```
            val raw = ShortArray(count)
            // What:     `shorts.get(raw)` BULK-copies all remaining shorts from the buffer view into
            //           the `raw` array in one call.
            // Why:      Bulk-copy the whole block once, then convert in a primitive loop. The
            //           per-element `shorts.get(index)` form this replaced cost about thirty seconds
            //           on a multi-minute opus track (device-measured): each call was a bounds-checked
            //           virtual read behind a lambda, so the conversion, not the MediaCodec decode
            //           (roughly seven seconds) or the meter, dominated.
            // TS map:   `shorts.get(raw);` — `Int16Array`'s `.set`/`.get` bulk copy.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // shorts.get(raw); // bulk copy, once
            // ```
            shorts.get(raw)
            // What:     `val out = FloatArray(count)` declares a read-only `FloatArray` of length
            //           `count` to hold the converted float samples.
            // Why:      The meter consumes floats; this is the converted output.
            // TS map:   `const out = new Float32Array(count);`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const out = new Float32Array(count);
            // ```
            val out = FloatArray(count)
            // What:     `for (index in 0 until count) { ... }` is a counted loop over `0..count-1`
            //           (`0 until count` is the half-open range, excluding `count`). `index` is the
            //           loop variable.
            // Why:      Convert each 16-bit sample to a float in a tight primitive loop.
            // TS map:   `for (let index = 0; index < count; index++) { ... }`
            // Gotcha:   `until` excludes the upper bound, so this is exactly `0 <= index < count`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // for (let index = 0; index < count; index++) { ... }
            // ```
            for (index in 0 until count) {
                // What:     `out[index] = raw[index] / PCM_16BIT_SCALE` writes one converted sample.
                //           `raw[index]` is a `Short`; `/ PCM_16BIT_SCALE` (a `Float`) promotes it to
                //           `Float`, producing a value in `-1.0..1.0`, stored into `out[index]`.
                // Why:      Map the 16-bit integer sample into the float domain the meter expects.
                // TS map:   `out[index] = raw[index] / PCM_16BIT_SCALE;`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // out[index] = raw[index] / PCM_16BIT_SCALE;
                // ```
                out[index] = raw[index] / PCM_16BIT_SCALE
            }
            // What:     `return out` returns the converted float array.
            // Why:      Hand this chunk's float samples back to the sequence/meter.
            // TS map:   `return out;`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return out;
            // ```
            return out
        }
        // What:     `throw IllegalStateException("unsupported PCM encoding $pcmEncoding from decoder")`
        //           constructs (no `new`) and throws an `IllegalStateException` naming the
        //           unexpected encoding. Reached only when `pcmEncoding` is neither float nor 16-bit.
        // Why:      Surface an unexpected PCM format as a hard error rather than measuring garbage.
        // TS map:   `throw new IllegalStateException(`unsupported PCM encoding ${pcmEncoding} from decoder`);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // throw new IllegalStateException(`unsupported PCM encoding ${pcmEncoding} from decoder`);
        // ```
        throw IllegalStateException("unsupported PCM encoding $pcmEncoding from decoder")
    }
}
