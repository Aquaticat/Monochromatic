//region Template editor pages on the Settings study's Fold placement, beside the accepted player parts
// What: Package joins the authored template editor record, its two pages and the shared player renderer.
// Why: The isolated surface needs no production navigation, preference store or playback callback.
//
// In TS you'd write (pseudocode):
// ```ts
// // Source-folder module namespace.
// ```
package dev.monochromatic.musicplayer

// What: Named imports expose system Back interception, native containers and screen density.
// Why: The study reuses the accepted folder browser and deck rather than replicas of them.
//
// In TS you'd write (pseudocode):
// ```ts
// import { BackHandler, BoxWithConstraints, Row, Surface } from 'native-ui';
// ```
import androidx.activity.compose.BackHandler
// Select the same player palette as the other verified studies.
import androidx.compose.foundation.isSystemInDarkTheme
// Available native width chooses the cover or inner route.
import androidx.compose.foundation.layout.BoxWithConstraints
// Side-by-side halves of the unfolded panel.
import androidx.compose.foundation.layout.Row
// The study and its halves use their available region.
import androidx.compose.foundation.layout.fillMaxSize
// The fold-connector clearance on the left half.
import androidx.compose.foundation.layout.padding
// Shared colour roles.
import androidx.compose.material3.MaterialTheme
// A filled region that also tells its children which colour to draw text and icons in.
import androidx.compose.material3.Surface
// Native function registration.
import androidx.compose.runtime.Composable
// Immutable native layout configuration.
import androidx.compose.ui.Modifier
// Opaque colour value; true black is the dark page.
import androidx.compose.ui.graphics.Color
// Current screen density, to convert the measured connector width from pixels.
import androidx.compose.ui.platform.LocalDensity
// Density-independent distance type.
import androidx.compose.ui.unit.Dp
// Density-independent literal distance.
import androidx.compose.ui.unit.dp

/**
 * What: A composable places the authored state's page on the panel in use. `@Composable` registers
 * the function as a UI builder; `(String) -> Unit` is a function type taking one string and
 * returning nothing.
 * Why: The placement repeats the opened Settings study: on the unfolded panel the page takes the
 * right half and the same folder browser and deck stay on the left; on the cover it is one
 * full-width page. That placement is a proposal under study, not an accepted decision.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function TemplateEditorStudy(input: { fixture: TemplateEditorFixture; onEvent: (event: string) => void;
 *   onMeasure: (line: string) => void }): UIElement;
 * ```
 */
@Composable
internal fun TemplateEditorStudy(fixture: TemplateEditorFixture, onEvent: (String) -> Unit,
    onMeasure: (String) -> Unit) {
    // What: val binds this render's native theme as a Boolean.
    // Why: The accepted player parts take the same light/dark flag as every other verified study.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const light = !systemDark();
    // ```
    val light = !isSystemInDarkTheme()
    // What: BackHandler intercepts the system Back gesture and runs its trailing lambda instead.
    // Why: System Back means the same as the header's Back target on either page; the host
    // decides what `back` does, which on the Settings page is a logged line only.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // useBackHandler(() => onEvent('back'));
    // ```
    BackHandler { onEvent("back") }
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
        // `600.dp` is 600 density-independent pixels; `.dp` is a property Kotlin adds to numbers.
        val isCover: Boolean = maxWidth < 600.dp
        if (isCover) {
            // What: `Surface(color, contentColor) { ... }` fills its region with `color` and makes
            // `contentColor` the default for text and icons drawn inside its trailing lambda.
            // Why: Without such a region, text and icons that name no colour of their own stay black,
            // which is unreadable on the true-black dark page.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // <div style={{ background: pageColor, color: scheme.onSurface }}>{children}</div>
            // ```
            Surface(modifier = Modifier.fillMaxSize(), color = pageColor,
                contentColor = MaterialTheme.colorScheme.onSurface) {
                // The cover shows one full-width page with the ordinary 16dp side insets.
                TemplateEditorStudyPage(fixture = fixture, modifier = Modifier.fillMaxSize(),
                    startSafe = 16.dp, endSafe = 16.dp, pageColor = pageColor,
                    onEvent = onEvent, onMeasure = onMeasure)
            }
        } else {
            // What: `with(LocalDensity.current) { (55f / density).dp }` reads the screen's pixels-per-dp
            // and converts 55 physical pixels to dp; `55f` is a 32-bit floating-point literal.
            // Why: The fold connector is about 110 physical pixels wide, centred on the panel, so each
            // half keeps 55 pixels clear before its own content inset, exactly as the Settings study does.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const halfDent = 55 / density;
            // ```
            val halfDent = with(LocalDensity.current) { (55f / density).dp }
            // The same content-colour region as the cover page, here around both halves.
            Surface(modifier = Modifier.fillMaxSize(), color = pageColor,
                contentColor = MaterialTheme.colorScheme.onSurface) {
                // What: A Row places its children side by side; `weight(1f)` on each gives them equal
                // widths. `{ slot -> ... }` is a lambda that receives the browser's layout configuration.
                // Why: The left half is the accepted folder browser over the full-height deck, built
                // exactly as the Settings study builds it; the right half is the page under study.
                // Gotcha: `halfDent + 8.dp` adds two Dp values. Kotlin lets a type define what `+` means
                // (operator overloading); TypeScript has no such mechanism, so read it as number addition.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // <div style={{ display: 'flex' }}>
                //   <DeckHost style={{ flex: 1 }}>{slot => <Folders style={{ ...slot, paddingRight: halfDent + 8 }}/>}</DeckHost>
                //   <Page style={{ flex: 1 }} startSafe={halfDent + 16} endSafe={16}/>
                // </div>
                // ```
                Row(modifier = Modifier.fillMaxSize()) {
                    SearchFoldDeckHost(light = light, modifier = Modifier.weight(1f),
                        deckFullHeight = true) { slot ->
                        SearchFoldFolders(light = light, modifier = slot.padding(end = halfDent + 8.dp))
                    }
                    // The right half starts clear of the fold connector, then keeps the 16dp inset.
                    TemplateEditorStudyPage(fixture = fixture, modifier = Modifier.weight(1f),
                        startSafe = halfDent + 16.dp, endSafe = 16.dp, pageColor = pageColor,
                        onEvent = onEvent, onMeasure = onMeasure)
                }
            }
        }
    }
}

/**
 * What: A private composable draws the page the authored state names. `Modifier` is an immutable
 * layout configuration. `Dp` is a density-independent distance; the siblings a reader might expect
 * are a raw pixel Int and the font-scaled `Sp`.
 * Why: Both placements choose between the same two pages, so the choice is written once. The
 * insets use Dp (not pixels or Sp) so they are the same physical size on both panels and do not
 * grow with the user's text size.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function TemplateEditorStudyPage(input: { fixture: TemplateEditorFixture; modifier: Modifier; startSafe: number;
 *   endSafe: number; pageColor: Color; onEvent: (event: string) => void; onMeasure: (line: string) => void }): UIElement;
 * ```
 */
@Composable
private fun TemplateEditorStudyPage(fixture: TemplateEditorFixture, modifier: Modifier, startSafe: Dp,
    endSafe: Dp, pageColor: Color, onEvent: (String) -> Unit, onMeasure: (String) -> Unit) {
    // The `list` state is the Settings page; every other authored state is the editor.
    if (fixture.page == "list") {
        TemplateEditorListPage(modifier = modifier, startSafe = startSafe, endSafe = endSafe,
            pageColor = pageColor, fixture = fixture, onEvent = onEvent, onMeasure = onMeasure)
    } else {
        TemplateEditorPage(modifier = modifier, startSafe = startSafe, endSafe = endSafe,
            pageColor = pageColor, fixture = fixture, onEvent = onEvent, onMeasure = onMeasure)
    }
}
//endregion
