//region Isolated native host, no MainActivity, library, playback or analysis callbacks
// What: Package declares the namespace shared by the debug manifest activity.
// Why: Explicit activity launch bypasses every production entry point.
//
// In TS you'd write (pseudocode):
// ```ts
// // Source-folder module namespace.
// ```
package dev.monochromatic.musicplayer

// What: Named imports expose Android lifecycle and version values.
// Why: A standalone window can follow the system theme without touching application state.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Build } from 'android/os';
// ```
import android.os.Build
// Bundle carries the optional Android lifecycle record.
import android.os.Bundle
// Log is a private native diagnostic sink, not visible recovery feedback.
import android.util.Log
// ComponentActivity hosts this debug-only Compose window.
import androidx.activity.ComponentActivity
// setContent installs a native UI tree.
import androidx.activity.compose.setContent
// System bars are handled by the study's Scaffold after edge-to-edge window setup.
import androidx.activity.enableEdgeToEdge
// System appearance determines which images are captured, rather than a custom palette override.
import androidx.compose.foundation.isSystemInDarkTheme
// MaterialTheme supplies actual Material controls and type metrics.
import androidx.compose.material3.MaterialTheme
// The whole color record is returned by the mirror of the production host expression.
import androidx.compose.material3.ColorScheme
// Native dynamic dark roles use the emulator's actual accent.
import androidx.compose.material3.dynamicDarkColorScheme
// Corresponding light dynamic roles.
import androidx.compose.material3.dynamicLightColorScheme
// Static dark roles preserve the platform fallback on older Android.
import androidx.compose.material3.darkColorScheme
// Corresponding static light roles.
import androidx.compose.material3.lightColorScheme
// Composable functions execute inside the native UI tree.
import androidx.compose.runtime.Composable
// Dark surfaces start from the accepted true black.
import androidx.compose.ui.graphics.Color
// LocalContext reads the hosting Android context inside composition.
import androidx.compose.ui.platform.LocalContext

/**
 * What: A composable named function returns a Material ColorScheme record.
 * Why: Mirror the current host color expression without invoking MainActivity or reflecting into it.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function lightFeedbackColorScheme(): ColorScheme { /* system dynamic/static roles, dark black */ }
 * ```
 */
@Composable
internal fun lightFeedbackColorScheme(): ColorScheme {
    // What: val stores a read-only Boolean, rather than var's replaceable binding.
    // Why: Keep this render pass's system-theme choice consistent.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const dark = isSystemInDarkTheme();
    // ```
    val dark: Boolean = isSystemInDarkTheme()
    // Context belongs to this isolated window, not a library reader.
    val context = LocalContext.current
    // An explicit type permits assignment in both version branches without a nullable placeholder.
    val scheme: ColorScheme
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        // What: A conditional expression returns one of the two system role records.
        // Why: Native theme follows system settings rather than scene identifiers.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // scheme = dark ? dynamicDarkColorScheme(context) : dynamicLightColorScheme(context);
        // ```
        scheme = if (dark) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
    } else {
        scheme = if (dark) darkColorScheme() else lightColorScheme()
    }
    if (!dark) return scheme
    // What: copy creates a new record with named fields changed, unlike mutating the original.
    // Why: Preserve dynamic accent roles while enforcing the accepted dark ground.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return { ...scheme, background: Color.Black, surface: Color.Black };
    // ```
    return scheme.copy(background = Color.Black, surface = Color.Black)
}

/**
 * What: A class extends ComponentActivity instead of the production MainActivity.
 * Why: The host has no source-loading, playback-service or analysis-service lifecycle hooks.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * class LightFeedbackActivity extends ComponentActivity { /* native debug host only */ }
 * ```
 */
class LightFeedbackActivity : ComponentActivity() {
    /**
     * What: override implements Android's creation callback; Bundle? means a nullable record.
     * Why: The scene arrives explicitly in an intent, not from saved user library state.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * override onCreate(savedInstanceState: Bundle | null): void { ... }
     * ```
     */
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // What: ?: takes a non-null value or throws; String is immutable text, not nullable String?.
        // Why: A missing capture input cannot silently render an unrelated fallback screen.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const scene = intent.getStringExtra('scene');
        // if (scene === null) throw new Error('Light-feedback study requires an explicit scene');
        // ```
        val scene: String = intent.getStringExtra("scene")
            ?: throw IllegalArgumentException("Light-feedback study requires an explicit scene.")
        lightFeedbackFixture(scene)
        // What: getBooleanExtra reads an explicit debug flag with a false default.
        // Why: Held screenshot poses cannot silently become the real auto-dismiss path.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const holdForCapture = intent.boolean('hold-for-capture') ?? false;
        // ```
        val holdForCapture: Boolean = intent.getBooleanExtra("hold-for-capture", false)
        Log.i("LightFeedback", "LightFeedbackActivity.onCreate: authored scene=$scene,captureHold=$holdForCapture")
        enableEdgeToEdge()
        // What: A trailing lambda supplies UI to setContent, like passing a callback argument in TS.
        // Why: Only this study tree is mounted; no playback or storage operation is reachable.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // setContent(() => MaterialTheme({ colorScheme: lightFeedbackColorScheme(), children: ... }));
        // ```
        setContent {
            MaterialTheme(colorScheme = lightFeedbackColorScheme()) {
                LightFeedbackStudy(scene = scene, holdForCapture = holdForCapture, onAction = { action ->
                    // The event proves only a debug intent/dismissal callback, never actual trash or restore success.
                    Log.i("LightFeedback", "LightFeedbackActivity.onAction: debug-only $action")
                })
            }
        }
    }
}
//endregion
