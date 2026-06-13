// What:     `package dev.monochromatic.musicplayer` declares the namespace this file's
//           declarations belong to. This file is in the `media3` FLAVOR source set, which
//           Gradle merges with the shared `main` source set for the Media3 build variant.
// Why:      Keeps `GainRenderersFactory` alongside `Media3Engine` and
//           `GainNormalizationProcessor` (same flavor, same package) with no imports.
// TS map:   No `package` keyword in TS; the file path is the module identity.
//
// In TS you'd write (pseudocode):
// ```ts
// // No keyword — file path is the module; this one is media3-flavor only.
// ```
package dev.monochromatic.musicplayer

// What:     `import android.content.Context` brings in Android's `Context` class (the
//           app-environment handle) by short name.
// Why:      The factory and the sink builder both need a `Context`.
// TS map:   `import type { Context } from "android-framework";`
//
// In TS you'd write (pseudocode):
// ```ts
// import type { Context } from "android-framework";
// ```
import android.content.Context

// What:     `import androidx.annotation.OptIn` brings in the `@OptIn` annotation used to
//           accept experimental/unstable APIs.
// Why:      The Media3 sink/renderer APIs touched here are `@UnstableApi`; the class
//           carries `@OptIn(UnstableApi::class)` to compile.
// TS map:   No equivalent; mentally a decorator suppressing an experimental-API error.
//
// In TS you'd write (pseudocode):
// ```ts
// // No import — TS has no compiler-enforced opt-in for unstable APIs.
// ```
import androidx.annotation.OptIn

// What:     `import androidx.media3.common.audio.AudioProcessor` brings in the
//           `AudioProcessor` interface (a pipeline stage contract).
// Why:      The sink's processor list is built as an `Array<AudioProcessor>`, so we need
//           the element type to spell `arrayOf<AudioProcessor>(...)`.
// TS map:   `import { AudioProcessor } from "media3";`
//
// In TS you'd write (pseudocode):
// ```ts
// import type { AudioProcessor } from "media3";
// ```
import androidx.media3.common.audio.AudioProcessor

// What:     `import androidx.media3.common.util.UnstableApi` brings in the `@UnstableApi`
//           marker annotation (stamped on APIs whose shape may change between releases).
// Why:      Names the opt-in marker passed to `@OptIn(UnstableApi::class)`.
// TS map:   No equivalent; mentally an `@experimental` tag.
//
// In TS you'd write (pseudocode):
// ```ts
// // No import — TS has no compiler-enforced unstable-API marker.
// ```
import androidx.media3.common.util.UnstableApi

// What:     `import androidx.media3.exoplayer.DefaultRenderersFactory` brings in the
//           class `DefaultRenderersFactory`. ExoPlayer asks a "renderers factory" to
//           build its audio/video renderers; the default one builds the standard set.
//           Subclassing it lets us tweak just the audio sink.
// Why:      `GainRenderersFactory` EXTENDS this so it inherits all the default renderer
//           building and only overrides `buildAudioSink`.
// TS map:   `import { DefaultRenderersFactory } from "media3";` then `class X extends DefaultRenderersFactory`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { DefaultRenderersFactory } from "media3";
// ```
import androidx.media3.exoplayer.DefaultRenderersFactory

// What:     `import androidx.media3.exoplayer.audio.AudioSink` brings in the `AudioSink`
//           INTERFACE: the final stage that hands PCM to the platform `AudioTrack`.
// Why:      `buildAudioSink` returns an `AudioSink`.
// TS map:   `import type { AudioSink } from "media3";`
//
// In TS you'd write (pseudocode):
// ```ts
// import type { AudioSink } from "media3";
// ```
import androidx.media3.exoplayer.audio.AudioSink

// What:     `import androidx.media3.exoplayer.audio.DefaultAudioSink` brings in the
//           concrete `DefaultAudioSink` class and its nested `DefaultAudioSink.Builder`
//           (a fluent builder for configuring the sink).
// Why:      `buildAudioSink` constructs a `DefaultAudioSink` via its `Builder`, injecting
//           the gain processor and forcing float output off.
// TS map:   `import { DefaultAudioSink } from "media3";` — `.Builder` is a nested static class.
//
// In TS you'd write (pseudocode):
// ```ts
// import { DefaultAudioSink } from "media3"; // DefaultAudioSink.Builder is nested
// ```
import androidx.media3.exoplayer.audio.DefaultAudioSink

// =============================================================================
// File summary (folds in the old KDoc's domain content)
// =============================================================================
//
// `GainRenderersFactory` is a `DefaultRenderersFactory` that builds ExoPlayer's audio
// sink with ONE extra processing stage, the `gainProcessor`, so ExoPlayer applies
// true-peak normalization inside its own audio pipeline. This is the SUPPORTED injection
// point in Media3 1.10.1: override `buildAudioSink` to return a `DefaultAudioSink`
// configured via `setAudioProcessors`, then wire this factory into the player with
// `ExoPlayer.Builder.setRenderersFactory`.
//
// Float output is FORCED OFF, deliberately. The sink only routes app-supplied processors
// when it is NOT using float output; with float output enabled a high-resolution source
// is converted to float and the app processors are DROPPED entirely, which would silently
// skip normalization for those tracks. Forcing 16-bit guarantees the `gainProcessor`
// always runs.
//
// Replacing the processor list also drops the default `SonicAudioProcessor` (playback
// speed and pitch), which this player does not use; the base audio-output
// playback-parameter setting is PRESERVED (forwarded below) so any speed change still
// routes through the platform `AudioTrack` rather than Sonic.

// What:     `@OptIn(UnstableApi::class)` is an annotation on the class below: "I accept
//           the unstable API `UnstableApi`". `UnstableApi::class` is a class-literal
//           (`Type::class` yields the runtime class-token for `UnstableApi`).
// Why:      The sink/renderer APIs used here are `@UnstableApi`; without opting in the
//           compiler refuses to compile this class.
// TS map:   No equivalent. Mentally a decorator suppressing an experimental-API error.
//
// In TS you'd write (pseudocode):
// ```ts
// // No annotation — TS has no compiler-enforced opt-in for unstable APIs.
// ```
@OptIn(UnstableApi::class)
// What:     `class GainRenderersFactory(context: Context, private val gainProcessor: GainNormalizationProcessor) : DefaultRenderersFactory(context)`
//           declares a class with a PRIMARY CONSTRUCTOR (the parameter list right after
//           the class name) that EXTENDS `DefaultRenderersFactory`. The pieces span the
//           next few lines and are commented individually below:
//           - two constructor parameters, `context` and `gainProcessor`;
//           - `: DefaultRenderersFactory(context)` is the SUPERCLASS CONSTRUCTOR CALL,
//             forwarding `context` up to the base.
// Why:      Build a renderers factory that knows about our `gainProcessor` so the
//           overridden `buildAudioSink` can install it.
// TS map:   `class GainRenderersFactory extends DefaultRenderersFactory { constructor(context: Context, private readonly gainProcessor: GainNormalizationProcessor) { super(context); } }`
//
// In TS you'd write (pseudocode):
// ```ts
// class GainRenderersFactory extends DefaultRenderersFactory {
//   constructor(
//     context: Context,
//     private readonly gainProcessor: GainNormalizationProcessor,
//   ) {
//     super(context);
//   }
//   // ...buildAudioSink override below...
// }
// ```
class GainRenderersFactory(
    // What:     `context: Context,` is a primary-constructor parameter with NO `val`/`var`
    //           keyword. That means it is NOT stored as a property; it is an ordinary
    //           constructor argument, visible only during construction (here, to forward
    //           to the superclass).
    // Why:      The base `DefaultRenderersFactory` needs the `Context`; this class does not
    //           keep it, so no `val` (no field) is created.
    // TS map:   A plain `constructor(context: Context)` parameter used only for `super(context)`
    //           — no `private`/`readonly`, so it becomes no field.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // // constructor(context: Context) — used only to call super(context)
    // ```
    context: Context,
    // What:     `private val gainProcessor: GainNormalizationProcessor,` is a primary-
    //           constructor parameter that ALSO becomes a private read-only PROPERTY in one
    //           stroke. `val` makes it read-only; `private` hides it; the `val` keyword on a
    //           constructor param is Kotlin shorthand for "store this argument as a field".
    // Why:      The factory must remember the gain processor instance so `buildAudioSink`
    //           can insert it; the engine holds the SAME instance to set its per-track gain.
    // TS map:   `private readonly gainProcessor: GainNormalizationProcessor` as a constructor
    //           parameter-property (TS's `private readonly` ctor-param sugar).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // // constructor(..., private readonly gainProcessor: GainNormalizationProcessor)
    // ```
    private val gainProcessor: GainNormalizationProcessor,
    // What:     `) : DefaultRenderersFactory(context) {` closes the constructor list and
    //           states the SUPERTYPE with its constructor call: `DefaultRenderersFactory(context)`
    //           invokes the base class's constructor, passing the `context` parameter up.
    // Why:      A subclass must construct its parent; this forwards `context` so the default
    //           renderer machinery is set up.
    // TS map:   `extends DefaultRenderersFactory` plus a `super(context)` call in the ctor.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // // extends DefaultRenderersFactory; constructor body does super(context)
    // ```
) : DefaultRenderersFactory(context) {
    // What:     `override fun buildAudioSink(context: Context, enableFloatOutput: Boolean, enableAudioOutputPlaybackParameters: Boolean): AudioSink = ...`
    //           OVERRIDES the base's `buildAudioSink`. The `override` keyword is mandatory.
    //           It takes three parameters (commented individually below) and returns an
    //           `AudioSink`, using an EXPRESSION BODY (`= expr`): the builder chain after
    //           `=` IS the return value (no `return`, no braces).
    // Why:      The base would build a plain sink; we override it to build a
    //           `DefaultAudioSink` carrying our `gainProcessor`, with float output forced
    //           off so the processor is never bypassed.
    // TS map:   `override buildAudioSink(context, enableFloatOutput, enableAudioOutputPlaybackParameters): AudioSink { return ...; }`
    //           — TS uses a `return`; Kotlin's `=` expression body omits it.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // override buildAudioSink(
    //   context: Context,
    //   enableFloatOutput: boolean,
    //   enableAudioOutputPlaybackParameters: boolean,
    // ): AudioSink {
    //   return new DefaultAudioSink.Builder(context)
    //     .setAudioProcessors([this.gainProcessor])
    //     .setEnableFloatOutput(false)
    //     .setEnableAudioOutputPlaybackParameters(enableAudioOutputPlaybackParameters)
    //     .build();
    // }
    // ```
    override fun buildAudioSink(
        // What:     `context: Context,` is the sink-builder's context parameter (no `val`,
        //           so not stored).
        // Why:      `DefaultAudioSink.Builder(context)` needs it.
        // TS map:   plain `context: Context` parameter.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // // context: Context
        // ```
        context: Context,
        // What:     `enableFloatOutput: Boolean,` is the base's request for float output.
        //           `Boolean` is Kotlin's true/false type.
        // Why:      It is IGNORED on purpose: this override forces float output off
        //           regardless (see the class summary), so the gain processor is never
        //           bypassed.
        // TS map:   `enableFloatOutput: boolean` — but unused; we pass `false` explicitly.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // // enableFloatOutput: boolean (ignored; we force false)
        // ```
        enableFloatOutput: Boolean,
        // What:     `enableAudioOutputPlaybackParameters: Boolean,` is the base's flag for
        //           routing playback-speed/pitch changes through the audio output.
        // Why:      It is FORWARDED unchanged to the builder, preserving the base behavior so
        //           a speed change still routes through `AudioTrack` rather than Sonic.
        // TS map:   `enableAudioOutputPlaybackParameters: boolean`, forwarded as-is.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // // enableAudioOutputPlaybackParameters: boolean (forwarded unchanged)
        // ```
        enableAudioOutputPlaybackParameters: Boolean,
    ): AudioSink =
        // What:     This is the expression-body return: a fluent BUILDER CHAIN that
        //           constructs and configures a `DefaultAudioSink`. Read top to bottom:
        //           - `DefaultAudioSink.Builder(context)` CONSTRUCTS the builder (constructor
        //             call, no `new`).
        //           - `.setAudioProcessors(arrayOf<AudioProcessor>(gainProcessor))` sets the
        //             processor list. `arrayOf<AudioProcessor>(gainProcessor)` builds an
        //             `Array<AudioProcessor>` of length 1 whose only element is our
        //             `gainProcessor`. The `<AudioProcessor>` is an EXPLICIT GENERIC TYPE
        //             ARGUMENT forcing the array's element type to the INTERFACE
        //             `AudioProcessor` (an upcast from the concrete `GainNormalizationProcessor`),
        //             which is what `setAudioProcessors` expects. This single-stage list also
        //             REPLACES the default `SonicAudioProcessor`, dropping speed/pitch.
        //           - `.setEnableFloatOutput(false)` FORCES float output off, so the sink
        //             keeps 16-bit and never drops our processor.
        //           - `.setEnableAudioOutputPlaybackParameters(enableAudioOutputPlaybackParameters)`
        //             forwards the base flag, preserving speed-change routing through AudioTrack.
        //           - `.build()` finalizes and returns the configured `DefaultAudioSink`
        //             (which IS an `AudioSink`, the declared return type). This is the tail
        //             value the expression body returns.
        // Why:      Produce a sink that always runs the normalization stage in 16-bit, with
        //           no Sonic stage, while keeping the base's playback-parameter behavior.
        // TS map:   `return new DefaultAudioSink.Builder(context).setAudioProcessors([this.gainProcessor]).setEnableFloatOutput(false).setEnableAudioOutputPlaybackParameters(enableAudioOutputPlaybackParameters).build();`
        //           — TS uses a plain array `[gainProcessor]` (no `arrayOf<T>` and no upcast),
        //           and needs `new` on the builder.
        // Gotcha:   `arrayOf<AudioProcessor>(...)` is a TYPED array constructor; the
        //           `<AudioProcessor>` widens the element type from the concrete class to the
        //           interface. TS arrays are structurally typed, so no explicit widening is
        //           needed. Also note: the whole thing is the function's RETURN (expression
        //           body), not a stray statement.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return new DefaultAudioSink.Builder(context)
        //   .setAudioProcessors([this.gainProcessor]) // Array<AudioProcessor> of length 1
        //   .setEnableFloatOutput(false)              // force 16-bit so the stage runs
        //   .setEnableAudioOutputPlaybackParameters(enableAudioOutputPlaybackParameters)
        //   .build();
        // ```
        DefaultAudioSink.Builder(context)
            .setAudioProcessors(arrayOf<AudioProcessor>(gainProcessor))
            .setEnableFloatOutput(false)
            .setEnableAudioOutputPlaybackParameters(enableAudioOutputPlaybackParameters)
            .build()
}
