// What:     `package dev.monochromatic.musicplayer` declares the namespace (logical
//           folder of names) this file's declarations belong to. This file lives under
//           the `media3` FLAVOR source set (`app/src/media3/kotlin/...`), which Gradle
//           merges with the shared `main` source set for the Media3 build variant.
// Why:      Keeps `GainNormalizationProcessor` in the same package as the shared core
//           (`processSample`) and the rest of the Media3 flavor so they resolve each
//           other without imports.
// TS map:   No `package` keyword in TS; the file path is the module identity. Mentally
//           this is a media3-only module merged into one build with the shared core.
//
// In TS you'd write (pseudocode):
// ```ts
// // No keyword — file path is the module; this one is media3-flavor only.
// ```
package dev.monochromatic.musicplayer

// What:     `import androidx.annotation.OptIn` brings in the `@OptIn` ANNOTATION
//           (a marker you attach to a declaration, written `@OptIn(...)`). It is the
//           AndroidX copy of Kotlin's opt-in mechanism: you use it to say "yes, I know
//           this API is marked experimental/unstable, let me use it anyway".
// Why:      The Media3 audio-processor base class and friends are marked `@UnstableApi`
//           (see below); without opting in, the compiler refuses to let us subclass
//           them. This import provides the annotation used on the class declaration.
// TS map:   No real equivalent. Closest is suppressing a deprecation/experimental
//           lint, e.g. a `// @ts-expect-error`-style acknowledgment or an
//           `@experimental` opt-in marker; TS has no compiler-enforced opt-in gate.
//
// In TS you'd write (pseudocode):
// ```ts
// // No import — TS has no compiler-enforced "I accept this unstable API" gate.
// ```
import androidx.annotation.OptIn

// What:     `import androidx.media3.common.C` brings in Media3's class `C`, a bag of
//           public integer CONSTANTS (its name is literally `C` for "constants"). It
//           holds values like `C.ENCODING_PCM_16BIT` (a number tagging a PCM encoding).
// Why:      `onConfigure` compares the incoming format's `encoding` against
//           `C.ENCODING_PCM_16BIT` to accept only signed 16-bit PCM.
// TS map:   `import { C } from "media3";` where `C` is `const C = { ENCODING_PCM_16BIT: 2, ... }`
//           — a namespace object of named numeric constants.
//
// In TS you'd write (pseudocode):
// ```ts
// import { C } from "media3"; // C.ENCODING_PCM_16BIT etc.
// ```
import androidx.media3.common.C

// What:     `import androidx.media3.common.audio.AudioProcessor` brings in the
//           `AudioProcessor` INTERFACE (a contract for a stage in ExoPlayer's audio
//           pipeline) plus its nested types `AudioProcessor.AudioFormat` (a small value
//           describing sample rate / channels / encoding) and
//           `AudioProcessor.UnhandledAudioFormatException` (the error thrown when a
//           stage is handed a format it cannot process).
// Why:      `onConfigure`'s parameter and return type are `AudioProcessor.AudioFormat`,
//           and it throws `AudioProcessor.UnhandledAudioFormatException` for a non-16-bit
//           input.
// TS map:   `import { AudioProcessor } from "media3";` — the nested `AudioFormat` and
//           `UnhandledAudioFormatException` map to `AudioProcessor.AudioFormat` and
//           `AudioProcessor.UnhandledAudioFormatException` static members.
//
// In TS you'd write (pseudocode):
// ```ts
// import { AudioProcessor } from "media3";
// ```
import androidx.media3.common.audio.AudioProcessor

// What:     `import androidx.media3.common.audio.BaseAudioProcessor` brings in the
//           ABSTRACT base class `BaseAudioProcessor`. "Abstract" means it cannot be
//           instantiated directly; it exists to be subclassed. It implements the dull
//           boilerplate of the `AudioProcessor` interface (buffer allocation, the
//           `replaceOutputBuffer`/`flip` lifecycle) and leaves `onConfigure`/`queueInput`
//           for the subclass to fill in.
// Why:      `GainNormalizationProcessor` EXTENDS this base so it only has to write the
//           gain logic, inheriting the buffer plumbing (`replaceOutputBuffer` below).
// TS map:   `import { BaseAudioProcessor } from "media3";` then `class X extends BaseAudioProcessor`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { BaseAudioProcessor } from "media3"; // abstract base to extend
// ```
import androidx.media3.common.audio.BaseAudioProcessor

// What:     `import androidx.media3.common.util.UnstableApi` brings in the
//           `@UnstableApi` ANNOTATION marker. Media3 stamps it on APIs whose shape may
//           change between releases; touching one is a compile error unless you opt in.
// Why:      `BaseAudioProcessor` (and the sink wiring) are `@UnstableApi`, so this file
//           carries `@OptIn(UnstableApi::class)` to acknowledge that and compile.
// TS map:   No equivalent; mentally an `@experimental` tag you must explicitly accept.
//
// In TS you'd write (pseudocode):
// ```ts
// // No import — TS has no compiler-enforced unstable-API marker.
// ```
import androidx.media3.common.util.UnstableApi

// What:     `import dev.monochromatic.musicplayer.core.processSample` brings in the
//           top-level function `processSample` from the SHARED `main` core package
//           `dev.monochromatic.musicplayer.core` (NOT this flavor). It is the pure,
//           unit-tested per-sample DSP: it applies the gain then clamps the result.
// Why:      `queueInput` calls `processSample(sample, currentGain)` per sample so the
//           tested core, not this flavor, owns the gain+clamp math.
// TS map:   `import { processSample } from "../core/process-sample";` — a plain named
//           import of a shared pure function.
//
// In TS you'd write (pseudocode):
// ```ts
// import { processSample } from "../core/process-sample";
// ```
import dev.monochromatic.musicplayer.core.processSample

// What:     `import java.nio.ByteBuffer` brings in the JDK class `ByteBuffer`, a
//           fixed-capacity, position-tracked window over a block of bytes. Reading
//           (`.short`, `.put`) advances an internal CURSOR (its "position"); `.flip()`
//           switches it from write mode to read mode.
// Why:      ExoPlayer hands each audio block to `queueInput` as a `ByteBuffer`, and the
//           stage writes its output into another `ByteBuffer`.
// TS map:   Closest is a `DataView` over an `ArrayBuffer`, but `ByteBuffer` also keeps
//           a moving position/limit cursor that a `DataView` does not, so reads/writes
//           here implicitly advance that cursor (a `DataView` makes you pass an offset).
// Gotcha:   `ByteBuffer` is STATEFUL: each `.short`/`.put`/`.putShort` moves the cursor,
//           so the same call twice reads/writes different bytes. Not like a plain array.
//
// In TS you'd write (pseudocode):
// ```ts
// // Mentally a DataView whose read/write offset auto-advances after each access.
// ```
import java.nio.ByteBuffer

// What:     `import kotlin.math.roundToInt` brings in the stdlib EXTENSION function
//           `roundToInt()` callable on a `Float`/`Double`. It rounds to the nearest
//           whole number and returns an `Int` (32-bit signed integer), rounding halves
//           up (toward positive infinity).
// Why:      After scaling a clamped float sample back up, we round it to the nearest
//           integer before narrowing to a 16-bit `Short`.
// TS map:   `Math.round(x)` — TS rounds and returns a `number`; Kotlin returns a typed
//           `Int`. (`Math.round` also rounds halves toward +infinity, matching.)
//
// In TS you'd write (pseudocode):
// ```ts
// // x.roundToInt() === Math.round(x)
// ```
import kotlin.math.roundToInt

// =============================================================================
// File summary (folds in the old KDoc's domain content)
// =============================================================================
//
// `GainNormalizationProcessor` is the ExoPlayer audio-pipeline STAGE that applies a
// track's true-peak normalization `gain` to every sample. It is the Media3 port of the
// desktop's per-sample output stage (`process_sample`). It is installed in
// `GainRenderersFactory`'s `DefaultAudioSink`, whose PCM pipeline runs trim ->
// channel-map -> convert-to-16-bit -> app processors, so this stage ALWAYS receives
// signed 16-bit PCM (float output is forced off in the factory precisely so a
// high-resolution source cannot bypass it).
//
// User volume is applied separately and downstream by the platform `AudioTrack`
// (`Media3Engine` sets `player.volume`), so the composed result is
// `clamp(sample * trackGain) * userVolume`, matching the desktop's `volume * track_gain`
// for every sample where the clamp does not fire (the designed-for case once true-peak
// normalization has brought the level under the ceiling).
//
// Threading: `gain` is READ on the audio thread and WRITTEN from the main thread when a
// track loads, so it is `@Volatile`; it is snapshotted once per `queueInput` so the
// whole buffer uses one consistent value. The gain is attenuate-only (`0.0..1.0`), so
// the `processSample` clamp is a backstop that does not fire in normal operation. A
// `gain` of exactly `UNITY_GAIN` (1.0) takes a fast path that copies the 16-bit samples
// through unchanged, avoiding any requantization for a track that needs no attenuation.

// What:     `@OptIn(UnstableApi::class)` is an ANNOTATION attached to the class below.
//           `@OptIn(...)` means "I accept the listed experimental APIs". `UnstableApi::class`
//           is a CLASS REFERENCE literal: `SomeType::class` yields the runtime
//           class-token (a `KClass`) for `UnstableApi`, here naming WHICH opt-in marker
//           is being accepted.
// Why:      `BaseAudioProcessor` is marked `@UnstableApi`; subclassing it without this
//           opt-in is a compile error. The annotation silences that, scoped to this class.
// TS map:   No equivalent. Mentally a decorator that suppresses an experimental-API
//           error, e.g. `@AcceptUnstable(UnstableApi)` — but TS has no such compiler gate.
// Gotcha:   `::class` is Kotlin's class-literal operator (not a method call); it is the
//           rough analogue of passing the class itself (like TS `UnstableApi` the value),
//           not an instance.
//
// In TS you'd write (pseudocode):
// ```ts
// // No annotation — TS has no compiler-enforced opt-in for unstable APIs.
// ```
@OptIn(UnstableApi::class)
// What:     `class GainNormalizationProcessor : BaseAudioProcessor() { ... }` declares a
//           class that EXTENDS (inherits from) `BaseAudioProcessor`. In Kotlin the `:`
//           after the class name introduces the supertype, and the trailing `()` is a
//           CALL to the base class's no-argument constructor (you construct the parent
//           as part of declaring the child). The class itself takes no constructor
//           parameters.
// Why:      Reuse the base's buffer plumbing (`replaceOutputBuffer`, output buffer,
//           `flip`) and only implement the gain-specific `onConfigure`/`queueInput`.
// TS map:   `class GainNormalizationProcessor extends BaseAudioProcessor { ... }` —
//           Kotlin's `: BaseAudioProcessor()` is TS's `extends BaseAudioProcessor`; the
//           `()` is the implicit `super()` call TS would make for you.
// Gotcha:   The `()` after the supertype is the SUPERCLASS CONSTRUCTOR CALL, not an
//           empty parameter list on this class. A TS reader sees `extends Base`, no `()`.
//
// In TS you'd write (pseudocode):
// ```ts
// class GainNormalizationProcessor extends BaseAudioProcessor {
//   // ...gain field and overrides below...
// }
// ```
class GainNormalizationProcessor : BaseAudioProcessor() {
    // What:     `@Volatile` is an ANNOTATION on the field below. It tells the JVM that
    //           the field may be touched by MULTIPLE THREADS and that every read must see
    //           the latest write (no per-thread caching of the value, no reordering
    //           around it).
    // Why:      `gain` is written on the MAIN thread (when a track loads) and read on the
    //           AUDIO thread (per buffer); without `@Volatile` the audio thread could keep
    //           reading a stale cached value and never pick up the new gain.
    // TS map:   No equivalent. JS is single-threaded, so cross-thread visibility never
    //           arises; mentally "this value is shared between two threads, always read
    //           fresh". (Web Workers would use a `SharedArrayBuffer`, the nearest cousin.)
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // // No annotation — single-threaded JS needs no volatile.
    // ```
    @Volatile
    // What:     `var gain: Float = UNITY_GAIN` declares a PUBLIC (no visibility keyword =
    //           public in Kotlin), REASSIGNABLE (`var`) PROPERTY named `gain`.
    //           - `: Float` is the type: a 32-bit IEEE-754 floating-point number.
    //             Sibling the reader might expect: `Double` (64-bit). `Float` is chosen
    //             because audio samples and the Android audio pipeline are 32-bit floats;
    //             `Double` would double the width for no extra precision the format uses.
    //           - `= UNITY_GAIN` initialises it to the companion constant `1.0f`
    //             (passthrough) until a real per-track gain is resolved.
    // Why:      Holds the current track's normalization gain (`0.0..1.0`), applied to
    //           every sample. Public so the engine can set it when a track loads.
    // TS map:   `gain: number = UNITY_GAIN;` — TS has only `number` (a 64-bit double), so
    //           the `Float` vs `Double` distinction disappears.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // gain: number = UNITY_GAIN; // 0.0..1.0, defaults to 1.0 passthrough
    // ```
    var gain: Float = UNITY_GAIN

    // What:     `override fun onConfigure(inputAudioFormat: AudioProcessor.AudioFormat): AudioProcessor.AudioFormat { ... }`
    //           declares a method that OVERRIDES (replaces) the base class's `onConfigure`.
    //           The `override` keyword is MANDATORY in Kotlin when redefining an inherited
    //           open method. It takes one `AudioProcessor.AudioFormat` (a description of
    //           sample rate / channels / encoding) and returns an `AudioProcessor.AudioFormat`.
    //           Block body `{ ... }`.
    // Why:      The base calls `onConfigure` when the upstream format is known, to let the
    //           stage accept/reject it and declare its OUTPUT format. Here we accept only
    //           16-bit PCM and pass the format through unchanged (this stage does not
    //           alter rate/channels/encoding). Any other encoding is rejected rather than
    //           silently mishandled; it cannot occur while the factory forces float off,
    //           so this is a guard against a future configuration change.
    // TS map:   `override onConfigure(inputAudioFormat: AudioProcessor.AudioFormat): AudioProcessor.AudioFormat { ... }`
    //           — TS (4.3+) also has an `override` keyword for clarity.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // override onConfigure(inputAudioFormat: AudioFormat): AudioFormat {
    //   if (inputAudioFormat.encoding !== C.ENCODING_PCM_16BIT) {
    //     throw new UnhandledAudioFormatException(inputAudioFormat);
    //   }
    //   return inputAudioFormat;
    // }
    // ```
    override fun onConfigure(
        inputAudioFormat: AudioProcessor.AudioFormat,
    ): AudioProcessor.AudioFormat {
        // What:     `if (inputAudioFormat.encoding != C.ENCODING_PCM_16BIT) { ... }` is a
        //           control-flow guard. `inputAudioFormat.encoding` reads the encoding tag
        //           (an `Int`); `!=` compares it against the constant `C.ENCODING_PCM_16BIT`
        //           (signed 16-bit PCM). True when the input is anything but 16-bit PCM.
        // Why:      This stage's per-sample math assumes 16-bit PCM; reject anything else.
        // TS map:   `if (inputAudioFormat.encoding !== C.ENCODING_PCM_16BIT) { ... }`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (inputAudioFormat.encoding !== C.ENCODING_PCM_16BIT) { ... }
        // ```
        if (inputAudioFormat.encoding != C.ENCODING_PCM_16BIT) {
            // What:     `throw AudioProcessor.UnhandledAudioFormatException(inputAudioFormat)`
            //           CONSTRUCTS the exception (constructor call, NO `new` keyword) with
            //           the offending format, then `throw`s it up the stack.
            // Why:      Surface an unsupported format as a hard error rather than producing
            //           garbage audio.
            // TS map:   `throw new UnhandledAudioFormatException(inputAudioFormat);` — TS
            //           needs `new`; Kotlin omits it.
            // Gotcha:   No `new`: `UnhandledAudioFormatException(...)` is a constructor call
            //           that looks like a function call.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // throw new UnhandledAudioFormatException(inputAudioFormat);
            // ```
            throw AudioProcessor.UnhandledAudioFormatException(inputAudioFormat)
        }
        // What:     `return inputAudioFormat` returns the same format object unchanged.
        //           Explicit `return` (block body). A non-null returned format keeps the
        //           stage ACTIVE for every accepted stream (16-bit in, 16-bit out).
        // Why:      The gain stage does not change rate/channels/encoding, so its output
        //           format equals its input format.
        // TS map:   `return inputAudioFormat;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return inputAudioFormat;
        // ```
        return inputAudioFormat
    }

    // What:     `override fun queueInput(inputBuffer: ByteBuffer) { ... }` overrides the
    //           base's `queueInput`. It takes one `ByteBuffer` of interleaved signed
    //           16-bit PCM (one or more whole frames) and returns nothing (no return type
    //           = `Unit`, Kotlin's "void"). Block body.
    // Why:      This is the per-buffer hook the base calls with decoded input; we apply
    //           the snapshotted `gain` to each 16-bit sample and write the result to the
    //           stage's output buffer. At `UNITY_GAIN` the bytes are copied through without
    //           requantizing; otherwise each sample goes to float, through the tested
    //           `processSample` (gain then clamp), and back to 16-bit.
    // TS map:   `override queueInput(inputBuffer: ByteBuffer): void { ... }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // override queueInput(inputBuffer: ByteBuffer): void {
    //   if (!inputBuffer.hasRemaining()) return;
    //   const output = this.replaceOutputBuffer(inputBuffer.remaining());
    //   const currentGain = this.gain;
    //   if (currentGain === UNITY_GAIN) {
    //     output.put(inputBuffer);
    //   } else {
    //     while (inputBuffer.hasRemaining()) {
    //       const sample = inputBuffer.readShort() / SAMPLE_SCALE_IN;
    //       const processed = processSample(sample, currentGain);
    //       output.putShort(Math.round(processed * SAMPLE_SCALE_OUT)); // as 16-bit
    //     }
    //   }
    //   output.flip();
    // }
    // ```
    override fun queueInput(inputBuffer: ByteBuffer) {
        // What:     `if (!inputBuffer.hasRemaining()) { return }` is an early-return guard.
        //           `inputBuffer.hasRemaining()` is `true` when the buffer's cursor has not
        //           reached its limit (there are bytes left to read); `!` negates it.
        // Why:      An empty buffer has nothing to process; bail out (returning `Unit`).
        // TS map:   `if (!inputBuffer.hasRemaining()) return;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (!inputBuffer.hasRemaining()) return;
        // ```
        if (!inputBuffer.hasRemaining()) {
            return
        }
        // What:     `val output: ByteBuffer = replaceOutputBuffer(inputBuffer.remaining())`
        //           declares a read-only local `output` (`val` = the binding cannot be
        //           reassigned) of type `ByteBuffer`. `replaceOutputBuffer(n)` is an
        //           INHERITED protected method from `BaseAudioProcessor`: it (re)allocates
        //           the stage's output buffer to hold `n` bytes and returns it ready for
        //           writing. `inputBuffer.remaining()` is the byte count still unread in the
        //           input (output is the same size as input here).
        // Why:      We need a destination buffer of the same size to write the gained
        //           samples into.
        // TS map:   `const output: ByteBuffer = this.replaceOutputBuffer(inputBuffer.remaining());`
        //           — `replaceOutputBuffer` is an inherited method, so TS would call it via
        //           `this`; Kotlin lets you call inherited methods unqualified.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const output: ByteBuffer = this.replaceOutputBuffer(inputBuffer.remaining());
        // ```
        val output: ByteBuffer = replaceOutputBuffer(inputBuffer.remaining())
        // What:     `val currentGain: Float = gain` declares a read-only `Float` local
        //           `currentGain` and copies the current value of the `@Volatile` `gain`
        //           field into it ONCE.
        // Why:      Snapshot the gain so the whole buffer is processed with one consistent
        //           value even if the main thread changes `gain` mid-buffer.
        // TS map:   `const currentGain: number = this.gain;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const currentGain: number = this.gain; // snapshot once per buffer
        // ```
        val currentGain: Float = gain
        // What:     `if (currentGain == UNITY_GAIN) { ... } else { ... }` is a control-flow
        //           if/else. `==` on two `Float`s is a numeric value comparison. The `then`
        //           branch is the fast path (gain is exactly 1.0); the `else` branch does
        //           the real per-sample work.
        // Why:      A unity gain needs no change, so we copy bytes through and skip the
        //           float round-trip / requantization entirely.
        // TS map:   `if (currentGain === UNITY_GAIN) { ... } else { ... }`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (currentGain === UNITY_GAIN) { ... } else { ... }
        // ```
        if (currentGain == UNITY_GAIN) {
            // What:     `output.put(inputBuffer)` BULK-copies all remaining bytes of
            //           `inputBuffer` into `output`, advancing both buffers' cursors.
            // Why:      No attenuation: copy the 16-bit samples straight through without
            //           requantizing them (avoids any precision loss for an un-attenuated
            //           track).
            // TS map:   `output.put(inputBuffer);` — mentally `output.set(inputBytes)` plus
            //           cursor advancement on both sides.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // output.put(inputBuffer); // bulk copy, advances both cursors
            // ```
            output.put(inputBuffer)
        } else {
            // What:     `while (inputBuffer.hasRemaining()) { ... }` loops while the input
            //           buffer still has unread bytes, processing one 16-bit sample per
            //           iteration. Standard condition-controlled loop.
            // Why:      Walk every sample of the buffer to apply the gain individually.
            // TS map:   `while (inputBuffer.hasRemaining()) { ... }`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // while (inputBuffer.hasRemaining()) { ... }
            // ```
            while (inputBuffer.hasRemaining()) {
                // What:     `val sample: Float = inputBuffer.short / SAMPLE_SCALE_IN`
                //           declares a read-only `Float` local `sample`.
                //           - `inputBuffer.short` READS the next signed 16-bit value
                //             (`Short`) from the buffer AND advances its cursor by 2 bytes.
                //             (In Kotlin `buffer.short` looks like a property but performs
                //             a relative read with a side effect.)
                //           - `/ SAMPLE_SCALE_IN` divides that `Short` by the `Float`
                //             `32768.0f`. Mixed `Short / Float` promotes the `Short` to
                //             `Float`, yielding a `Float` in `-1.0..1.0`.
                // Why:      Convert the raw 16-bit integer sample into the normalized float
                //           domain `processSample` expects.
                // TS map:   `const sample: number = inputBuffer.readShort() / SAMPLE_SCALE_IN;`
                //           — TS has no implicit `.short` cursor read; you'd call an explicit
                //           `readShort()` that advances the offset.
                // Gotcha:   `inputBuffer.short` is a SIDE-EFFECTING read: it consumes 2 bytes
                //           and moves the cursor. Reading it twice yields two different
                //           samples; it is NOT a plain property access.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // const sample: number = inputBuffer.readShort() / SAMPLE_SCALE_IN;
                // ```
                val sample: Float = inputBuffer.short / SAMPLE_SCALE_IN
                // What:     `val processed: Float = processSample(sample, currentGain)`
                //           declares a read-only `Float` local `processed`. It calls the
                //           SHARED core function `processSample(sample, gain)` (from the
                //           `main` core package), which applies the gain then clamps the
                //           result into `-1.0..1.0`.
                // Why:      Reuse the tested core math instead of re-implementing gain+clamp
                //           here.
                // TS map:   `const processed: number = processSample(sample, currentGain);`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // const processed: number = processSample(sample, currentGain);
                // ```
                val processed: Float = processSample(sample, currentGain)
                // What:     `output.putShort((processed * SAMPLE_SCALE_OUT).roundToInt().toShort())`
                //           writes one 16-bit sample into `output`. Reading the inner
                //           expression outward:
                //           - `processed * SAMPLE_SCALE_OUT` scales the clamped `-1.0..1.0`
                //             float back up by `32767.0f`, giving a `Float`.
                //           - `.roundToInt()` is a type-CONVERSION call: round the `Float`
                //             to the nearest whole number and return an `Int` (32-bit).
                //           - `.toShort()` is a narrowing type-CONVERSION: take the low 16
                //             bits of the `Int` as a `Short`. Safe here because the clamp
                //             bounds the value to `-1.0..1.0`, so the scaled result fits a
                //             16-bit range without overflow.
                //           - `output.putShort(...)` writes that `Short` and advances the
                //             output cursor by 2 bytes.
                // Why:      Quantize the processed float back to signed 16-bit PCM and emit
                //           it.
                // TS map:   `output.putShort(Math.round(processed * SAMPLE_SCALE_OUT));` —
                //           TS `number` covers `Int`/`Short`, so no explicit `.toShort()`;
                //           the `putShort` write keeps only the low 16 bits.
                // Gotcha:   `.toShort()` is a NARROWING cast (Int -> 16-bit). It would wrap
                //           silently on overflow; it is safe ONLY because `processSample`'s
                //           clamp guarantees the value is in range first.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // output.putShort(Math.round(processed * SAMPLE_SCALE_OUT)); // 16-bit
                // ```
                output.putShort((processed * SAMPLE_SCALE_OUT).roundToInt().toShort())
            }
        }
        // What:     `output.flip()` switches the `output` buffer from WRITE mode to READ
        //           mode: it sets the limit to the current position and rewinds the cursor
        //           to 0, so the bytes just written are now ready to be read downstream.
        // Why:      The base/sink reads `output` after `queueInput` returns; it must be
        //           flipped so it reports the right range of valid bytes.
        // TS map:   No 1:1 method. Mentally `output = output.subarray(0, written); offset = 0;`
        //           — `ByteBuffer.flip()` resets a cursor that TS typed arrays do not have.
        // Gotcha:   Forgetting `flip()` would make the downstream stage read zero bytes (or
        //           the wrong range); it is required, not optional cleanup.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // output.flip(); // limit = position; position = 0; now readable
        // ```
        output.flip()
    }

    // What:     `companion object { ... }` declares a single object attached to the class,
    //           holding STATIC-LIKE members (values that belong to the class itself, not to
    //           an instance). Members inside are referenced as
    //           `GainNormalizationProcessor.UNITY_GAIN`, etc.
    // Why:      Hosts the gain/scale constants shared by every instance and by callers
    //           (`Media3Engine` reads `GainNormalizationProcessor.UNITY_GAIN`).
    // TS map:   TS has no `companion object`; use `static` members:
    //           `class X { static readonly UNITY_GAIN = 1.0; ... }`. Mentally "everything
    //           inside the companion is a `static` member of the class".
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // // static readonly UNITY_GAIN = 1.0; (etc.) on the class
    // ```
    companion object {
        // What:     `const val UNITY_GAIN: Float = 1.0f` declares a PUBLIC compile-time
        //           CONSTANT `Float` named `UNITY_GAIN`.
        //           - `const val` (vs plain `val`) means the value is inlined at compile
        //             time; it must be a primitive/`String` literal known statically.
        //           - The `f` suffix on `1.0f` marks it a `Float` (32-bit) literal; without
        //             `f` it would be a `Double` (64-bit). Sibling: `1.0` (Double).
        // Why:      The gain that leaves the signal unchanged: both the default value and
        //           the fast-path copy threshold.
        // TS map:   `static readonly UNITY_GAIN = 1.0;` — TS `number` is always 64-bit, so
        //           there is no `f`/`Float` vs `Double` distinction.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // static readonly UNITY_GAIN = 1.0;
        // ```
        const val UNITY_GAIN: Float = 1.0f

        // What:     `private const val SAMPLE_SCALE_IN: Float = 32768.0f` declares a
        //           PRIVATE (file/class-internal) compile-time `Float` constant. `private`
        //           limits it to this file's class; the `f` suffix makes it a `Float`.
        // Why:      Divisor mapping a signed 16-bit sample to a float in `-1.0..1.0`:
        //           `Short.MIN_VALUE` is `-32768`, so dividing by `32768.0f` maps full-scale
        //           negative to exactly `-1.0`. (Note the asymmetry with the OUT scale.)
        // TS map:   `private static readonly SAMPLE_SCALE_IN = 32768.0;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // private static readonly SAMPLE_SCALE_IN = 32768.0;
        // ```
        private const val SAMPLE_SCALE_IN: Float = 32768.0f

        // What:     `private const val SAMPLE_SCALE_OUT: Float = 32767.0f` declares a
        //           PRIVATE compile-time `Float` constant (`f` suffix = `Float`, not the
        //           `Double` `32767.0`).
        // Why:      Multiplier mapping a clamped `-1.0..1.0` float back to signed 16-bit:
        //           `1.0` -> `Short.MAX_VALUE` (32767). Using 32767 here (vs 32768 for the
        //           input divisor) keeps `+1.0` from overflowing the positive 16-bit range.
        // TS map:   `private static readonly SAMPLE_SCALE_OUT = 32767.0;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // private static readonly SAMPLE_SCALE_OUT = 32767.0;
        // ```
        private const val SAMPLE_SCALE_OUT: Float = 32767.0f
    }
}
