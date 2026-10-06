//region Isolated native template editor host, no production services, parser or stored template
// What: Package connects the explicit debug activity and the authored study.
// Why: Starting this activity cannot construct the real session store, a library reader or playback.
//
// In TS you'd write (pseudocode):
// ```ts
// // Source-folder module namespace.
// ```
package dev.monochromatic.musicplayer

// What: Named imports expose Android lifecycle inputs and the native Compose host.
// Why: The activity mounts one authored state named by its launch intent and nothing else.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Bundle, Log, ComponentActivity, setContent } from 'android-ui';
// ```
import android.os.Bundle
// Private tagged diagnostics do not represent a saved template.
import android.util.Log
// Standalone host, not MainActivity.
import androidx.activity.ComponentActivity
// Mount only the nonfunctional study.
import androidx.activity.compose.setContent
// System padding remains owned by the study's own pages.
import androidx.activity.enableEdgeToEdge
// Shared native colour roles for the accepted player parts and the pages.
import androidx.compose.material3.MaterialTheme
// Delegated read access to native observable state.
import androidx.compose.runtime.getValue
// Compose tracks record replacement and schedules rendering.
import androidx.compose.runtime.mutableStateOf
// Delegated write access to native observable state.
import androidx.compose.runtime.setValue

/**
 * What: A class extends ComponentActivity rather than the production host; `: ComponentActivity()`
 * names the parent class and calls its constructor.
 * Why: Opening the editor and returning from it can be exercised on a device without starting a
 * decoder, a source load, a worker or any real template evaluation.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * class TemplateEditorActivity extends ComponentActivity { /* debug-only authored state */ }
 * ```
 */
class TemplateEditorActivity : ComponentActivity() {
    /**
     * What: A private var delegates reads and writes through Compose's mutableStateOf object using `by`.
     * Why: Replacing the immutable record redraws the same activity with another authored state.
     * The `list` state given here is a construction placeholder that never mounts: `onCreate`
     * replaces it with the scene the launch intent names before anything is drawn.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * const [shown, setShown] = useState(templateEditorFixture('list'));
     * ```
     */
    private var shown: TemplateEditorFixture by mutableStateOf(templateEditorFixture("list"))

    /**
     * What: A private method logs one event name and replaces the shown record in exactly two cases.
     * `$event` splices the name into the logged line like a TypeScript template literal.
     * Why: Header Back, system Back and every row tap share one owner. Opening the entry on the
     * Settings page shows the editor's default state, and Back on an editor page returns to the
     * Settings page. Back on the Settings page, inserting a field and resetting are not connected
     * in this authored study, so they leave a tagged line and change nothing.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * function dispatch(event: string): void {
     *   log(event);
     *   if (event === 'open' && shown.page === 'list') setShown(templateEditorFixture('default'));
     *   else if (event === 'back' && shown.page === 'editor') setShown(templateEditorFixture('list'));
     * }
     * ```
     */
    private fun dispatch(event: String) {
        // What: `Log.i(tag, line)` writes one info line to Android's log under a tag.
        // Why: Capture scripts filter by the tag and count these lines to see what was tapped.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // console.info('TemplateEditor', `TemplateEditorActivity.dispatch: debug-only event=${event}`);
        // ```
        Log.i("TemplateEditor", "TemplateEditorActivity.dispatch: debug-only event=$event")
        if (event == "open" && shown.page == "list") {
            // Opening the entry always shows the editor as first opened, never a focused or failing state.
            shown = templateEditorFixture("default")
        } else if (event == "back" && shown.page == "editor") {
            // Any editor state returns to the same Settings page.
            shown = templateEditorFixture("list")
        }
    }

    /**
     * What: `override` implements the native callback; `Bundle?` permits no saved record. `?:` is
     * the "or else" operator: when the value on its left is null, the expression on its right runs,
     * here a `throw`.
     * Why: Only an explicitly named authored scene is ever mounted, with no stored template behind it.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * override onCreate(savedState: Bundle | null): void { const scene = requireScene(); mountStudy(scene); }
     * ```
     */
    override fun onCreate(savedInstanceState: Bundle?) {
        // Let the parent class run its own start-up first.
        super.onCreate(savedInstanceState)
        // Use the required non-null scene name from the launch intent, or throw.
        val scene: String = intent.getStringExtra("scene")
            ?: throw IllegalArgumentException("Template editor study requires an explicit scene.")
        // Replace the placeholder with the named authored state; an unknown name throws here.
        shown = templateEditorFixture(scene)
        // One tagged line records which authored scene this launch mounted.
        Log.i("TemplateEditor", "TemplateEditorActivity.onCreate: authored scene=$scene")
        // Draw behind the system bars; the pages add their own status and navigation padding.
        enableEdgeToEdge()
        // What: Trailing lambdas supply native children and event callbacks; `{ event -> ... }` is a
        // lambda taking one argument.
        // Why: The pages and the accepted player parts use the verified role provider while every
        // state stays local to this activity. Measurements leave a tagged line for capture scripts.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // setContent(() => <Theme><Study fixture={shown} onEvent={dispatch} onMeasure={line => log(line)}/></Theme>);
        // ```
        setContent {
            MaterialTheme(colorScheme = lightFeedbackColorScheme()) {
                TemplateEditorStudy(fixture = shown,
                    onEvent = { event -> dispatch(event) },
                    onMeasure = { event -> Log.i("TemplateEditor", "TemplateEditorActivity.onMeasure: $event") })
            }
        }
    }
}
//endregion
