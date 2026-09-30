// Debug-only renderer input. No file, decoder, service or audio output is created.

// What: Place this source in the existing Android namespace.
// Why: The production controller can use the existing AudioEngine contract.
//
// In TS you'd write (pseudocode):
// ```ts
// // The module path supplies the namespace.
// ```
package dev.monochromatic.musicplayer

/**
 * What: A data class is an immutable value record with separate tag and message strings.
 * Why: Native Android logging and host-JVM recording share events, not platform calls.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * type FilenameBaselineEvent = { readonly tag: string; readonly message: string };
 * ```
 */
internal data class FilenameBaselineEvent(val tag: String, val message: String)

/**
 * What: Implement the nominal AudioEngine interface, rather than extend a native engine.
 * Why: The actual player renderer receives coherent paused state without opening media.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * class FilenameBaselineEngine implements AudioEngine { /* injected event writer; paused double */ }
 * ```
 */
internal class FilenameBaselineEngine(
    // What: A constructor property stores an event-to-Unit callback, not an Android Context.
    // Why: Every event is emitted at its real boundary without depending on Log.i in JVM tests.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // constructor(private readonly report: (event: FilenameBaselineEvent) => void) {}
    // ```
    private val report: (FilenameBaselineEvent) -> Unit,
) : AudioEngine {
    // What: String? permits a missing URI; private set limits writes to this class.
    // Why: Tests can inspect the selected synthetic identity without changing it.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private uri: string | null = null; get loadedUri() { return this.uri; }
    // ```
    var loadedUri: String? = null
        private set

    // What: Int is a 32-bit whole number, rather than Long or fractional Double.
    // Why: A bounded count records paused loads without exposing a writable counter.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private loads = 0; get loadCount() { return this.loads; }
    // ```
    var loadCount: Int = 0
        private set

    // What: Double stores fractional seconds, rather than narrower Float or integer Long.
    // Why: The rendered seek position matches the authored paused session.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private position = 0;
    // ```
    private var position: Double = 0.0

    // What: Nullable function types hold callbacks rather than a bare event or value.
    // Why: Registration remains inspectable and references can be cleared at teardown.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private playingListener: ((playing: boolean) => void) | null = null;
    // private endedListener: (() => void) | null = null;
    // ```
    private var playingListener: ((Boolean) -> Unit)? = null
    // The payload-free callback uses the same nullable-function storage concept.
    private var endedListener: (() -> Unit)? = null

    // What: Boolean is a two-valued flag, not an Int code or nullable state.
    // Why: Teardown has an explicit terminal state for lifecycle checks.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private released = false;
    // ```
    private var released: Boolean = false

    /**
     * What: Override supplies the interface method with its dictated parameters.
     * Why: Only paused loads of authored fixture URIs are allowed at this boundary.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * load(uri: string, play: boolean): void { /* validate, record, never decode */ }
     * ```
     */
    override fun load(uri: String, play: Boolean) {
        if (released) throw IllegalStateException("Filename baseline engine has been released.")
        if (play) throw IllegalStateException("Filename baseline cannot request audio playback.")
        if (!uri.startsWith("fixture://filename-player/")) {
            throw IllegalArgumentException("Filename baseline requires an authored fixture URI: $uri")
        }
        loadedUri = uri
        loadCount += 1
        report(FilenameBaselineEvent("FilenameBaselineEngine.load", "paused synthetic load=$loadCount"))
    }

    /**
     * What: Implement play with a failure instead of native output.
     * Why: An accidental real renderer action cannot silently become a playback study.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * play(): void { throw new Error('Filename baseline cannot request audio playback.'); }
     * ```
     */
    override fun play() {
        report(FilenameBaselineEvent("FilenameBaselineEngine.play", "rejecting transport request"))
        throw IllegalStateException("Filename baseline cannot request audio playback.")
    }

    /**
     * What: Implement pause without allocating or controlling native audio.
     * Why: The double remains paused through any controller cleanup.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * pause(): void { logger.info('already paused'); }
     * ```
     */
    override fun pause() {
        report(FilenameBaselineEvent("FilenameBaselineEngine.pause", "already paused"))
    }

    /**
     * What: Implement the Double seconds setter required by the engine interface.
     * Why: The actual renderer can show a fixed synthetic resume position.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * seekTo(seconds: number): void { this.position = seconds; }
     * ```
     */
    override fun seekTo(positionSec: Double) {
        position = positionSec
        report(FilenameBaselineEvent("FilenameBaselineEngine.seekTo", "synthetic position=$positionSec"))
    }

    /**
     * What: Float is a 32-bit gain, rather than Double seconds or an integer percentage.
     * Why: The production controller's gain calls are logged but have no output effect.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * setVolume(gain: number): void { logger.info(gain); }
     * ```
     */
    override fun setVolume(volume: Float) {
        report(FilenameBaselineEvent("FilenameBaselineEngine.setVolume", "synthetic gain=$volume"))
    }

    /**
     * What: Return a Double explicitly, not an implicit expression-body value.
     * Why: An unselected fixture has zero elapsed time; a paused selection uses its seed.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * positionSec(): number { return this.loadedUri === null ? 0 : this.position; }
     * ```
     */
    override fun positionSec(): Double {
        if (loadedUri == null) return 0.0
        return position
    }

    /**
     * What: Return the authored duration as a Double, not narrower Float.
     * Why: The baseline contains a stable seek bar without reading encoded media.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * durationSec(): number { return this.loadedUri === null ? 0 : 275; }
     * ```
     */
    override fun durationSec(): Double {
        if (loadedUri == null) return 0.0
        return 275.0
    }

    /**
     * What: Return the Boolean paused intent required by AudioEngine.
     * Why: Current-row identity is not presented as real playback.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * playWhenReady(): boolean { return false; }
     * ```
     */
    override fun playWhenReady(): Boolean {
        return false
    }

    /**
     * What: Store the (Boolean) -> Unit function, Kotlin's boolean-to-void callback type.
     * Why: Tests can verify controller registration without pretending audio changed.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * setOnPlayingChanged(callback: (playing: boolean) => void): void { this.playingListener = callback; }
     * ```
     */
    override fun setOnPlayingChanged(callback: (Boolean) -> Unit) {
        playingListener = callback
    }

    /**
     * What: Store the () -> Unit function, unlike the boolean-valued callback sibling.
     * Why: The controller can register its end hook but no synthetic track ends.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * setOnTrackEnded(callback: () => void): void { this.endedListener = callback; }
     * ```
     */
    override fun setOnTrackEnded(callback: () -> Unit) {
        endedListener = callback
    }

    /**
     * What: Return whether both nullable callback fields have values.
     * Why: Host tests check the real controller's initialization seam.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * callbacksRegistered(): boolean { return this.playingListener !== null && this.endedListener !== null; }
     * ```
     */
    fun callbacksRegistered(): Boolean {
        return playingListener != null && endedListener != null
    }

    /**
     * What: Release clears callback references and marks a terminal Boolean state.
     * Why: A destroyed debug activity retains no controller hooks or native resource.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * release(): void { this.playingListener = null; this.endedListener = null; this.released = true; }
     * ```
     */
    override fun release() {
        playingListener = null
        endedListener = null
        released = true
        report(FilenameBaselineEvent("FilenameBaselineEngine.release", "released paused renderer double"))
    }
}
