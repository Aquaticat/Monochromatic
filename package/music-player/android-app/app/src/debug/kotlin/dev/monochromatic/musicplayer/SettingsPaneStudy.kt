//region Settings page on the proposed Fold placement, beside the unchanged accepted player parts
// What: Package joins the pure Settings state, its native pane and the shared player renderer.
// Why: The isolated surface needs no production navigation, preference store or playback callback.
//
// In TS you'd write (pseudocode):
// ```ts
// // Source-folder module namespace.
// ```
package dev.monochromatic.musicplayer

// What: Named imports expose system Back interception, native containers and measured system insets.
// Why: The study reuses the accepted browser, deck and player rather than replicas of them.
//
// In TS you'd write (pseudocode):
// ```ts
// import { BackHandler, Box, Row, Scaffold } from 'native-ui';
// ```
import androidx.activity.compose.BackHandler
// Select the same player palette as the other verified studies.
import androidx.compose.foundation.isSystemInDarkTheme
// Overlay container and measured regions.
import androidx.compose.foundation.layout.Box
// Available native width chooses the cover or inner route.
import androidx.compose.foundation.layout.BoxWithConstraints
// Stack for the closed player's measured region.
import androidx.compose.foundation.layout.Column
// Side-by-side halves of the unfolded panel.
import androidx.compose.foundation.layout.Row
// Native system inset source.
import androidx.compose.foundation.layout.WindowInsets
// Consume Scaffold's system padding once.
import androidx.compose.foundation.layout.consumeWindowInsets
// The study and its halves use their available region.
import androidx.compose.foundation.layout.fillMaxSize
// Apply measured system padding and the fold-connector clearance.
import androidx.compose.foundation.layout.padding
// Region kept clear of system bars and cutouts.
import androidx.compose.foundation.layout.safeDrawing
// Pads an element by a system inset.
import androidx.compose.foundation.layout.windowInsetsPadding
// Shared colour roles.
import androidx.compose.material3.MaterialTheme
// Scaffold owns the closed player's system insets, as in the verified scan study.
import androidx.compose.material3.Scaffold
// A filled region that also tells its children which colour to draw text and icons in.
import androidx.compose.material3.Surface
// Native function registration.
import androidx.compose.runtime.Composable
// Emit the composed state after it enters composition.
import androidx.compose.runtime.LaunchedEffect
// Immutable native layout configuration.
import androidx.compose.ui.Modifier
// Opaque colour value; true black is the dark page.
import androidx.compose.ui.graphics.Color
// Current screen density, to convert the measured connector width from pixels.
import androidx.compose.ui.platform.LocalDensity
// Density-independent literal distance.
import androidx.compose.ui.unit.dp

/**
 * What: A composable takes the authored switch record, whether the page is open, and separate
 * input and diagnostic callbacks.
 * Why: Opening, toggling and returning are observable without saving a preference or touching audio.
 * The placement follows the accepted Search page: on the unfolded panel the page takes the right half
 * and the same folder browser and deck stay on the left; on the cover it is one full-width page.
 * That placement is a proposal under study, not an accepted decision.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function SettingsPaneStudy(input: { state: SettingsPaneState; opened: boolean; onEvent: (event: string) => void;
 *   onBack: () => void; onMeasure: (line: string) => void }): UIElement;
 * ```
 */
@Composable
internal fun SettingsPaneStudy(state: SettingsPaneState, opened: Boolean, onEvent: (String) -> Unit,
    onBack: () -> Unit, onMeasure: (String) -> Unit) {
    // What: val binds this render's native theme as a Boolean.
    // Why: The accepted player parts take the same light/dark flag as every other verified study.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const light = !systemDark();
    // ```
    val light = !isSystemInDarkTheme()
    // What: LaunchedEffect runs its block when the page state or the switch record changes.
    // Why: A logged tap alone does not establish that its resulting state was composed.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // useEffect(() => onMeasure(describe(opened, state)), [opened, state]);
    // ```
    LaunchedEffect(opened, state) {
        onMeasure("SettingsPane.composed:opened=$opened:strip=${state.stripCommonPrefixes}:" +
            "resume=${state.resumeWhereLeftOff}:analyse=${state.analyseInBackground}")
    }
    // What: BackHandler intercepts the system Back gesture only while its `enabled` flag is true.
    // Why: System Back returns from the page to the player; with the page closed it is not intercepted.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // useBackHandler(opened, onBack);
    // ```
    BackHandler(enabled = opened) { onBack() }
    // What: An `if`/`else` expression chooses one colour; Color.Black is pure #000000.
    // Why: True black is the standing dark background; light uses the settled flat lowest surface.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const pageColor = light ? scheme.surfaceContainerLowest : '#000000';
    // ```
    val pageColor: Color = if (light) MaterialTheme.colorScheme.surfaceContainerLowest else Color.Black
    // What: BoxWithConstraints exposes the available width as `maxWidth` to its children.
    // Why: Width, not a device name, selects the cover or unfolded arrangement, as in the player itself.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // <Measure>{({ maxWidth }) => maxWidth < 600 ? <Cover/> : <Unfolded/>}</Measure>
    // ```
    BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
        val isCover: Boolean = maxWidth < 600.dp
        if (!opened) {
            // The closed state is the accepted player in the same wrapper the verified scan study used.
            Scaffold(contentWindowInsets = WindowInsets.safeDrawing) { padding ->
                Column(modifier = Modifier.fillMaxSize().padding(padding).consumeWindowInsets(padding)) {
                    Box(modifier = Modifier.weight(1f).fillMaxSize().settingsPaneMeasure("player", onMeasure)) {
                        SearchPlayerPreview(isCover = isCover, light = light,
                            onSearch = { onMeasure("SettingsPane.search-intent-only") },
                            e2InformationStartInset = 12.dp)
                    }
                }
            }
        } else if (isCover) {
            // What: `Surface(color, contentColor) { ... }` fills its region with `color` and makes
            // `contentColor` the default for text and icons drawn inside its trailing lambda.
            // Why: The accepted Search page is hosted inside such a region. Without one, text and icons
            // that name no colour of their own stay black, which a fresh inspection found unreadable in
            // the dark theme on the retained deck's title and transport buttons.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // <div style={{ background: pageColor, color: scheme.onSurface }}>{children}</div>
            // ```
            Surface(modifier = Modifier.fillMaxSize(), color = pageColor,
                contentColor = MaterialTheme.colorScheme.onSurface) {
                SettingsPane(state = state, onEvent = onEvent, onBack = onBack, onMeasure = onMeasure,
                    modifier = Modifier.fillMaxSize(), startSafe = 16.dp, endSafe = 16.dp, pageColor = pageColor)
            }
        } else {
            // What: `with(LocalDensity.current) { (55f / density).dp }` reads the screen's pixels-per-dp
            // and converts 55 physical pixels to dp; `55f` is a 32-bit floating-point literal.
            // Why: The fold connector is about 110 physical pixels wide, centred on the panel, so each
            // half keeps 55 pixels clear before its own content inset, exactly as the Search page does.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const halfDent = 55 / density;
            // ```
            val halfDent = with(LocalDensity.current) { (55f / density).dp }
            // The same content-colour region as the cover page, here around both halves.
            Surface(modifier = Modifier.fillMaxSize(), color = pageColor,
                contentColor = MaterialTheme.colorScheme.onSurface) {
                Row(modifier = Modifier.fillMaxSize()) {
                    SearchFoldDeckHost(light = light,
                        modifier = Modifier.weight(1f).settingsPaneMeasure("left", onMeasure),
                        deckFullHeight = true) { slot ->
                        SearchFoldFolders(light = light, modifier = slot.padding(end = halfDent + 8.dp))
                    }
                    SettingsPane(state = state, onEvent = onEvent, onBack = onBack, onMeasure = onMeasure,
                        modifier = Modifier.weight(1f), startSafe = halfDent + 16.dp, endSafe = 16.dp,
                        pageColor = pageColor)
                }
            }
        }
        // What: An empty Box padded by the safe-drawing insets, drawn over the study and measured.
        // It has no click handler, so touches pass through to the page beneath it.
        // Why: Its rectangle is the app area between the status and navigation bars, which the capture
        // scripts use to crop the status strip for privacy instead of assuming an inset height.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // <div style={{ position: 'absolute', inset: safeInsets, pointerEvents: 'none' }} ref={measure('root')}/>
        // ```
        Box(modifier = Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing)
            .settingsPaneMeasure("root", onMeasure))
    }
}
//endregion
