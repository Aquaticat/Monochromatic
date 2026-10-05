//region Isolated native context-menu host, no production lifecycle or operation owner
// What: Package connects the explicit debug activity and authored menu study.
// Why: An intent can open this study without constructing MainActivity or a library source.
//
// In TS you'd write (pseudocode):
// ```ts
// // Source-folder module namespace.
// ```
package dev.monochromatic.musicplayer

// What: Named imports expose Android lifecycle input and the existing native UI host.
// Why: The study follows system appearance without playback, storage or analysis services.
//
// In TS you'd write (pseudocode):
// ```ts
// import { ComponentActivity, setContent } from 'android-ui';
// ```
import android.os.Bundle
// Private debug diagnostics do not announce real operation success.
import android.util.Log
// Standalone activity rather than the production host.
import androidx.activity.ComponentActivity
// Install only the nonfunctional study tree.
import androidx.activity.compose.setContent
// The Scaffold owns measured safe-drawing insets after edge-to-edge setup.
import androidx.activity.enableEdgeToEdge
// Reuse the same dynamic/static role expression as the verified overlay study.
import androidx.compose.material3.MaterialTheme

/**
 * What: A class extends ComponentActivity and overrides its lifecycle entry point.
 * Why: No production source, player engine or service can be reached through this host.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * class TrackMenuActivity extends ComponentActivity { /* isolated authored study */ }
 * ```
 */
class TrackMenuActivity : ComponentActivity() {
    /**
     * What: override implements Android's callback; Bundle? permits a missing saved record.
     * Why: Every launch requires a named authored scene instead of a guessed default library.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * override onCreate(savedState: Bundle | null): void { ... }
     * ```
     */
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // What: ?: uses the provided non-null value or throws the explicit diagnostic.
        // Why: Missing or unknown input cannot masquerade as a valid menu capture.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const scene = intent.getStringExtra('scene');
        // if (scene === null) throw new Error('Track-menu study requires an explicit scene.');
        // ```
        val scene: String = intent.getStringExtra("scene")
            ?: throw IllegalArgumentException("Track-menu study requires an explicit scene.")
        trackMenuTracks(scene)
        Log.i("TrackMenu", "TrackMenuActivity.onCreate: authored scene=$scene")
        enableEdgeToEdge()
        // What: Trailing lambdas supply native content and a debug event callback.
        // Why: The shared role provider preserves the settled player behind the menu.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // setContent(() => MaterialTheme({ colors: existingStudyColors(), children: study(scene) }));
        // ```
        setContent {
            MaterialTheme(colorScheme = lightFeedbackColorScheme()) {
                TrackMenuStudy(scene = scene, onEvent = { event ->
                    Log.i("TrackMenu", "TrackMenuActivity.onEvent: debug-only $event")
                })
            }
        }
    }
}
//endregion
