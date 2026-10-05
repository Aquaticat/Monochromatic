//region Isolated native Settings presentation host, no production services or preference state
// What: Package connects the explicit debug activity and authored study.
// Why: Starting this activity cannot construct the real session store or analysis owner.
//
// In TS you'd write (pseudocode):
// ```ts
// // Source-folder module namespace.
// ```
package dev.monochromatic.musicplayer

// What: Named imports expose Android lifecycle inputs and the native Compose host.
// Why: Explicit debug events can reopen the page without wiring the player's Settings button.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Intent, ComponentActivity, setContent } from 'android-ui';
// ```
import android.content.Intent
// Nullable saved-state input belongs to Android's lifecycle.
import android.os.Bundle
// Private tagged diagnostics do not represent a saved preference.
import android.util.Log
// Standalone host, not MainActivity.
import androidx.activity.ComponentActivity
// Mount only the nonfunctional study.
import androidx.activity.compose.setContent
// System padding remains owned by the measured study.
import androidx.activity.enableEdgeToEdge
// Shared native colour roles for the accepted player and the pane.
import androidx.compose.material3.MaterialTheme
// Compose tracks record replacement and schedules rendering.
import androidx.compose.runtime.mutableStateOf
// Delegated read access to native observable state.
import androidx.compose.runtime.getValue
// Delegated write access to native observable state.
import androidx.compose.runtime.setValue

/**
 * What: A class extends ComponentActivity rather than the production host.
 * Why: Native switch, Back and lifecycle verification cannot start a decoder, source load or worker.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * class SettingsPaneActivity extends ComponentActivity { /* debug-only authored state */ }
 * ```
 */
class SettingsPaneActivity : ComponentActivity() {
    /**
     * What: A private var delegates reads/writes through Compose's mutableStateOf object using by.
     * Why: Replacing the immutable record rerenders the same activity; the construction placeholder never mounts.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * const [state, setState] = useState(fixture('accepted'));
     * ```
     */
    private var state: SettingsPaneState by mutableStateOf(settingsPaneFixture("accepted"))

    /** Whether the Settings page is showing; false shows the accepted player. */
    private var opened: Boolean by mutableStateOf(true)

    /**
     * What: A private method checks one event name and replaces state only after validation succeeds.
     * Why: Native taps, the Back target, system Back and explicit debug events share one transition owner,
     * and every transition leaves a tagged before/after line for the capture scripts to count.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * function dispatch(event: string): void { log(event); if (event === 'open') setOpened(true); else if (event === 'back') setOpened(false); else setState(transition({ state, event })); }
     * ```
     */
    private fun dispatch(event: String) {
        Log.i("SettingsPane", "SettingsPaneActivity.dispatch: debug-only event=$event before=$state opened=$opened")
        if (event == "open") {
            if (opened) throw IllegalStateException("Authored Settings page is already open.")
            opened = true
        } else if (event == "back") {
            if (!opened) throw IllegalStateException("Authored Settings page is already closed.")
            opened = false
        } else {
            if (!opened) throw IllegalStateException("Authored Settings toggle arrived while the page is closed: $event")
            state = settingsPaneEvent(state, event)
        }
        Log.i("SettingsPane", "SettingsPaneActivity.dispatch: debug-only after=$state opened=$opened")
    }

    /**
     * What: override implements the native callback; Bundle? permits no saved record and ?: rejects missing input.
     * getBooleanExtra reads one explicit flag, defaulting to an open page.
     * Why: Only an explicitly named authored scene is ever mounted, with no stored preference behind it.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * override onCreate(savedState: Bundle | null): void { requireScene(); mountStudy(); }
     * ```
     */
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val scene: String = intent.getStringExtra("scene")
            ?: throw IllegalArgumentException("Settings study requires an explicit scene.")
        state = settingsPaneFixture(scene)
        opened = intent.getBooleanExtra("study-opened", true)
        Log.i("SettingsPane", "SettingsPaneActivity.onCreate: authored scene=$scene opened=$opened")
        enableEdgeToEdge()
        // What: Trailing lambdas supply native children and event callbacks.
        // Why: The actual player parts use their verified role provider while state remains entirely local.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // setContent(() => <Theme><Study state={state} opened={opened} onEvent={dispatch} onBack={() => dispatch('back')}/></Theme>);
        // ```
        setContent {
            MaterialTheme(colorScheme = lightFeedbackColorScheme()) {
                SettingsPaneStudy(state = state, opened = opened,
                    onEvent = { event -> dispatch(event) },
                    onBack = { dispatch("back") },
                    onMeasure = { event -> Log.i("SettingsPane", "SettingsPaneActivity.onMeasure: $event") })
            }
        }
    }

    /**
     * What: onNewIntent receives a same-instance singleTop launch while Android pauses/resumes this host.
     * Why: An explicit study-event reopens the page without recreating the activity, because the player's
     * own Settings button is not wired in this study. The original scene intent is deliberately retained.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * override onNewIntent(intent: Intent): void { dispatch(requireEvent(intent)); }
     * ```
     */
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        // Use the required non-null event or throw, as at the scene boundary.
        val event: String = intent.getStringExtra("study-event")
            ?: throw IllegalArgumentException("Settings continuation requires an explicit study-event.")
        dispatch(event)
    }
}
//endregion
