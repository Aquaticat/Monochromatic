// Debug-only static capture of the actual production player renderer.
// MainActivity/service/source-loading and audio playback are deliberately not exercised.

// What: Use the existing Android namespace for this debug-only activity.
// Why: The debug manifest can route directly to the production-renderer seam.
//
// In TS you'd write (pseudocode):
// ```ts
// // Module identity comes from the source path.
// ```
package dev.monochromatic.musicplayer

// What: Build exposes the Android version; Bundle carries nullable activity state.
// Why: Mirror production dynamic-color selection and its onCreate signature.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Build } from 'android/os';
// ```
import android.os.Build
// Bundle is the activity lifecycle record, not an authored filename fixture.
import android.os.Bundle

// What: Android Log writes tagged private diagnostics.
// Why: Capture setup records the real controller/page state without a visible study overlay.
//
// In TS you'd write (pseudocode):
// ```ts
// import { logger } from 'android/log';
// ```
import android.util.Log

// What: ComponentActivity hosts Compose and receives Android lifecycle callbacks.
// Why: Use the same window-host family as MainActivity without starting its services.
//
// In TS you'd write (pseudocode):
// ```ts
// import { ComponentActivity } from 'androidx/activity';
// ```
import androidx.activity.ComponentActivity

// What: setContent mounts the Compose tree in the real Android window.
// Why: The production renderer runs natively rather than as copied text or HTML.
//
// In TS you'd write (pseudocode):
// ```ts
// import { setContent } from 'androidx/activity/compose';
// ```
import androidx.activity.compose.setContent

// What: enableEdgeToEdge applies AndroidX's production-default window setup.
// Why: Let the actual Scaffold compute its own system-bar insets and available width.
//
// In TS you'd write (pseudocode):
// ```ts
// import { enableEdgeToEdge } from 'androidx/activity';
// ```
import androidx.activity.enableEdgeToEdge

// What: fillMaxSize is Compose's full-window layout modifier.
// Why: Match MainActivity's full-size Surface without study padding or pane constraints.
//
// In TS you'd write (pseudocode):
// ```ts
// import { fillMaxSize } from 'compose/layout';
// ```
import androidx.compose.foundation.layout.fillMaxSize

// What: isSystemInDarkTheme reads the device appearance, not an intent-selected palette.
// Why: Mirror the production color factory at the host boundary.
//
// In TS you'd write (pseudocode):
// ```ts
// import { isSystemInDarkTheme } from 'compose/foundation';
// ```
import androidx.compose.foundation.isSystemInDarkTheme

// What: MaterialTheme provides inherited roles and Surface paints the host background.
// Why: Preserve the production renderer's actual typography and parent surface.
//
// In TS you'd write (pseudocode):
// ```ts
// import { MaterialTheme } from 'compose/material3';
// ```
import androidx.compose.material3.MaterialTheme
// Surface is the same full-window host used by MainActivity.
import androidx.compose.material3.Surface

// What: ColorScheme names the Material color record, not an individual Color value.
// Why: Match the private production color-selection expression without reflecting into it.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { ColorScheme } from 'compose/material3';
// ```
import androidx.compose.material3.ColorScheme

// What: Dynamic color factories read system accent; static factories are older-platform fallbacks.
// Why: Reproduce MainActivity's private host color factory without changing production access.
//
// In TS you'd write (pseudocode):
// ```ts
// import { dynamicDarkColorScheme } from 'compose/material3';
// ```
import androidx.compose.material3.dynamicDarkColorScheme
// The light dynamic factory is the corresponding system-light branch.
import androidx.compose.material3.dynamicLightColorScheme
// Static dark roles mirror production's pre-Android-12 fallback.
import androidx.compose.material3.darkColorScheme
// Static light roles mirror the other production fallback.
import androidx.compose.material3.lightColorScheme

// What: Composable marks a function that executes inside the Compose rendering tree.
// Why: System appearance and Android context are read at composition time.
//
// In TS you'd write (pseudocode):
// ```ts
// // A render function can read UI context hooks.
// ```
import androidx.compose.runtime.Composable

// What: Modifier is the immutable Compose layout instruction value.
// Why: The host supplies exactly the production fillMaxSize modifier.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Modifier } from 'compose/ui';
// ```
import androidx.compose.ui.Modifier

// What: Color contains individual color values, unlike a whole ColorScheme.
// Why: Production dark background and surface are explicitly black.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Color } from 'compose/graphics';
// ```
import androidx.compose.ui.graphics.Color

// What: LocalContext supplies the Android host context inside Compose.
// Why: Dynamic Material color uses the real emulator settings and system accent.
//
// In TS you'd write (pseudocode):
// ```ts
// import { LocalContext } from 'compose/platform';
// ```
import androidx.compose.ui.platform.LocalContext

/**
 * What: Declare a Composable function returning the complete Material color record.
 * Why: Mirror MainActivity.kt's private musicPlayerColorScheme host expression only.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function filenameBaselineColorScheme(): ColorScheme { /* same system selection */ }
 * ```
 */
@Composable
private fun filenameBaselineColorScheme(): ColorScheme {
    // What: Boolean holds system appearance, not an integer mode code.
    // Why: The host uses production's dark/light branch without a candidate palette override.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const dark = isSystemInDarkTheme();
    // ```
    val dark: Boolean = isSystemInDarkTheme()
    // Read the actual Android context for the same dynamic-color factories.
    val context = LocalContext.current
    // What: ColorScheme is assigned by explicit version and appearance branches.
    // Why: The debug host mirrors the production private factory, not Search's scene palette.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let scheme: ColorScheme;
    // if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
    //   scheme = dark ? dynamicDarkColorScheme(context) : dynamicLightColorScheme(context);
    // } else { scheme = dark ? darkColorScheme() : lightColorScheme(); }
    // ```
    val scheme: ColorScheme
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        if (dark) scheme = dynamicDarkColorScheme(context) else scheme = dynamicLightColorScheme(context)
    } else {
        if (dark) scheme = darkColorScheme() else scheme = lightColorScheme()
    }
    if (!dark) return scheme
    return scheme.copy(background = Color.Black, surface = Color.Black)
}

/**
 * What: Extend ComponentActivity, the same lifecycle/window host family as MainActivity.
 * Why: Call the actual playerScreen instead of reflecting into or copying its private rows.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * class FilenameBaselineActivity extends ComponentActivity { /* debug-only capture host */ }
 * ```
 */
class FilenameBaselineActivity : ComponentActivity() {
    // What: A nullable engine field can be absent before setup or after teardown.
    // Why: The activity owns and releases the recording double once.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private engine: FilenameBaselineEngine | null = null;
    // ```
    private var engine: FilenameBaselineEngine? = null

    /**
     * What: Override the framework's nullable Bundle lifecycle callback.
     * Why: Seed the real controller once, outside recomposition, and mirror production's host.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * onCreate(saved: Bundle | null): void { /* seed once; mount actual renderer */ }
     * ```
     */
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        // What: getStringExtra returns String?; Elvis supplies only the documented initial defaults.
        // Why: Capture routing selects authored data without changing production launcher behavior.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const scene = intent.getStringExtra('scene') ?? 'long';
        // ```
        val scene: String = intent.getStringExtra("scene") ?: "long"
        // Reuse the nullable-extra fallback for independent current-row selection.
        val selection: String = intent.getStringExtra("selection") ?: "none"
        // What: Construct the immutable request and seed through the real controller API.
        // Why: Native metadata names the actual page and row identities before rendering.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const fixture = filenameBaselineFixture({ scene, selection });
        // ```
        val fixture: FilenameBaselineFixture = filenameBaselineFixture(FilenameBaselineRequest(scene, selection) { event ->
            // The host uses real tagged Android logging; the no-audio double remains JVM-testable.
            Log.i(event.tag, event.message)
        })
        engine = fixture.engine
        Log.i("FilenameBaselineActivity.onCreate", "scene=$scene selection=$selection page=${fixture.controller.uiState.selectedPage} current=${fixture.controller.uiState.currentIndex} paused=${!fixture.engine.playWhenReady()} style=${SessionStore.loadPageControlStyle(this)}")
        // What: The trailing lambda is the Compose tree mounted by setContent.
        // Why: Production chrome, pager and private trackRow execute without study overlays.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // setContent(() => <MaterialTheme colorScheme={filenameBaselineColorScheme()}>
        //   <Surface modifier={Modifier.fillMaxSize()}><playerScreen controller={fixture.controller}/></Surface>
        // </MaterialTheme>);
        // ```
        setContent {
            MaterialTheme(colorScheme = filenameBaselineColorScheme()) {
                Surface(modifier = Modifier.fillMaxSize()) {
                    playerScreen(controller = fixture.controller, onChooseFolder = {
                        throw IllegalStateException("Filename baseline does not open the library picker.")
                    })
                }
            }
        }
    }

    /**
     * What: Override the framework teardown callback and explicitly release owned state.
     * Why: No callback survives a destroyed debug capture activity.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * onDestroy(): void { this.engine?.release(); this.engine = null; super.onDestroy(); }
     * ```
     */
    override fun onDestroy() {
        // What: ?. calls release only for a non-null engine, rather than asserting presence.
        // Why: Failed setup and normal teardown use the same bounded cleanup path.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.engine?.release();
        // ```
        engine?.release()
        engine = null
        super.onDestroy()
    }
}
