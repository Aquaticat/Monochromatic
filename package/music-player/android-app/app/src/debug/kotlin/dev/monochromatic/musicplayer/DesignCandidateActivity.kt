// This file is a throwaway design prototype. It renders six non-functional theme candidates
// in the real Compose and Android system-bar environment for emulator screenshot capture.

// What:     `package` places this debug-only activity in the app's existing Android namespace.
// Why:      The debug manifest can name the activity with the same short package path.
//
// In TS you'd write (pseudocode):
// ```ts
// // The source path supplies the module namespace.
// ```
package dev.monochromatic.musicplayer

// What:     `android.graphics.Color` supplies Android window-bar color integers and is renamed here.
// Why:      The alias keeps Android's integer color separate from Compose's `Color` value type.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Color as AndroidColor } from 'android/graphics';
// ```
import android.graphics.Color as AndroidColor

// What:     `Bundle` is Android's nullable activity state record.
// Why:      Android passes it to the activity creation callback.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { Bundle } from 'android/os';
// ```
import android.os.Bundle

// What:     `ComponentActivity` is AndroidX's Compose-capable activity base class.
// Why:      The emulator needs a real Android window that can host Compose and system bars.
//
// In TS you'd write (pseudocode):
// ```ts
// import { ComponentActivity } from 'androidx/activity';
// ```
import androidx.activity.ComponentActivity

// What:     `SystemBarStyle` selects light or dark Android status and navigation glyphs.
// Why:      Every candidate uses a light surface and therefore needs dark system glyphs.
//
// In TS you'd write (pseudocode):
// ```ts
// import { SystemBarStyle } from 'androidx/activity';
// ```
import androidx.activity.SystemBarStyle

// What:     `setContent` mounts a Compose component tree in an Android activity.
// Why:      The activity renders only the selected static candidate.
//
// In TS you'd write (pseudocode):
// ```ts
// import { setContent } from 'androidx/activity/compose';
// ```
import androidx.activity.compose.setContent

// What:     `enableEdgeToEdge` lets app pixels continue behind transparent Android system bars.
// Why:      Native status and gesture-navigation bars must appear over the candidate screenshot.
//
// In TS you'd write (pseudocode):
// ```ts
// import { enableEdgeToEdge } from 'androidx/activity';
// ```
import androidx.activity.enableEdgeToEdge

// What:     `background` paints a Compose layout node with one color.
// Why:      Candidate A, B, and C differ in their surface hierarchy.
//
// In TS you'd write (pseudocode):
// ```ts
// import { background } from 'compose/foundation';
// ```
import androidx.compose.foundation.background

// What:     `border` paints a shape-following outline around a Compose layout node.
// Why:      Candidate B uses hairlines while candidates A and C use fewer outlines.
//
// In TS you'd write (pseudocode):
// ```ts
// import { border } from 'compose/foundation';
// ```
import androidx.compose.foundation.border

// What:     `rememberScrollState` creates composition-owned scroll position state.
// Why:      Filtered folder names and the letter rail remain scrollable at device height.
//
// In TS you'd write (pseudocode):
// ```ts
// import { rememberScrollState } from 'compose/foundation';
// ```
import androidx.compose.foundation.rememberScrollState

// What:     `verticalScroll` makes a fixed Compose column vertically scrollable.
// Why:      Static prototype data can demonstrate long-list clipping without a backend.
//
// In TS you'd write (pseudocode):
// ```ts
// import { verticalScroll } from 'compose/foundation';
// ```
import androidx.compose.foundation.verticalScroll

// What:     `Arrangement` names spacing policies for rows and columns.
// Why:      The prototype keeps the settled 16dp seam and component gaps explicit.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Arrangement } from 'compose/foundation/layout';
// ```
import androidx.compose.foundation.layout.Arrangement

// What:     `Box` is Compose's stacking layout.
// Why:      It layers pane fills, dividers, and compact control faces.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Box } from 'compose/foundation/layout';
// ```
import androidx.compose.foundation.layout.Box

// What:     `Column` is Compose's vertical layout.
// Why:      Picker, transport, and track content stack vertically.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Column } from 'compose/foundation/layout';
// ```
import androidx.compose.foundation.layout.Column

// What:     `FlowRow` wraps content-width children onto successive lines.
// Why:      Folder names remain plain text with several names per line.
//
// In TS you'd write (pseudocode):
// ```ts
// import { FlowRow } from 'compose/foundation/layout';
// ```
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow

// What:     `Row` is Compose's horizontal layout.
// Why:      The unfolded screen keeps two 402dp panes around a 16dp seam.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Row } from 'compose/foundation/layout';
// ```
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope

// What:     Layout modifier imports expose fixed size, fill, padding, inset, and weight operations.
// Why:      The prototype maps the existing 852dp design geometry into native Compose constraints.
//
// In TS you'd write (pseudocode):
// ```ts
// import { fillMaxSize, fillMaxWidth, height, padding, size, weight, width } from 'compose/layout';
// ```
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.layout.windowInsetsTopHeight
import androidx.compose.foundation.layout.WindowInsets

// What:     `CircleShape` and `RoundedCornerShape` are reusable Compose clipping outlines.
// Why:      Transport buttons, chips, and panes retain their settled MD3 geometry.
//
// In TS you'd write (pseudocode):
// ```ts
// import { CircleShape, RoundedCornerShape } from 'compose/foundation/shape';
// ```
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape

// What:     Material imports supply the real Android theme, buttons, slider, surfaces, and text renderer.
// Why:      Screenshots must exercise Compose rather than reproduce these controls in CSS.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Button, MaterialTheme, Slider, Surface, Text, lightColorScheme } from 'compose/material3';
// ```
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.lightColorScheme

// What:     `Composable` marks functions that emit nodes into a Compose UI tree.
// Why:      Android's renderer can evaluate each candidate as native layout.
//
// In TS you'd write (pseudocode):
// ```ts
// type Component = () => JSX.Element;
// ```
import androidx.compose.runtime.Composable

// What:     `Alignment` names child alignment positions and `Modifier` carries layout operations.
// Why:      Controls need centered glyphs and explicit placement without imperative coordinates.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Alignment, Modifier } from 'compose/ui';
// ```
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier

// What:     Compose `Color` stores packed ARGB color values used by rendered components.
// Why:      The three candidate surface systems use the verified MD3 light palette.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Color } from 'compose/ui/graphics';
// ```
import androidx.compose.ui.graphics.Color

// What:     `FontWeight`, `TextAlign`, and `TextOverflow` configure native text rendering.
// Why:      Track metadata variants must differ only in intended emphasis and availability.
//
// In TS you'd write (pseudocode):
// ```ts
// import { FontWeight, TextAlign, TextOverflow } from 'compose/ui/text';
// ```
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow

// What:     `dp` and `sp` construct density-aware layout and font measurements.
// Why:      Android converts the cited logical geometry to the emulator's 390dpi panel pixels.
//
// In TS you'd write (pseudocode):
// ```ts
// const dp = (value: number) => value;
// const sp = (value: number) => value;
// ```
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Intent key used by screenshot automation to select one static candidate. */
const val DESIGN_CANDIDATE_EXTRA: String = "candidate"

/** Default candidate used when screenshot automation omits its explicit selection. */
const val DEFAULT_DESIGN_CANDIDATE: String = "light-c"

/** Shared verified light-theme color scheme supplied to real Material components. */
private val DESIGN_LIGHT_SCHEME = lightColorScheme(
    primary = Color(0xFF6750A4),
    onPrimary = Color(0xFFFFFFFF),
    secondaryContainer = Color(0xFFE8DEF8),
    onSecondaryContainer = Color(0xFF4A4459),
    surface = Color(0xFFFEF7FF),
    onSurface = Color(0xFF1D1B20),
    onSurfaceVariant = Color(0xFF49454F),
    outline = Color(0xFF79747E),
    outlineVariant = Color(0xFFCAC4D0),
)

/** Candidate-specific surface roles and line treatment. */
private data class CandidatePalette(
    val window: Color,
    val picker: Color,
    val rail: Color,
    val transport: Color,
    val tracks: Color,
    val inactiveTrack: Color,
    val paneOutlines: Boolean,
    val railHairline: Boolean,
    val rowHairlines: Boolean,
)

/** Static row model used only by the non-functional design prototype. */
private data class PrototypeTrack(
    val title: String,
    val duration: String,
    val peak: String,
)

/** Debug-only Android window used to capture native candidate screenshots. */
class DesignCandidateActivity : ComponentActivity() {
    /** Creates one transparent-system-bar Compose candidate selected by an intent extra. */
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.light(AndroidColor.TRANSPARENT, AndroidColor.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.light(AndroidColor.TRANSPARENT, AndroidColor.TRANSPARENT),
        )
        val requestedCandidate = intent.getStringExtra(DESIGN_CANDIDATE_EXTRA)
        var candidate = DEFAULT_DESIGN_CANDIDATE
        if (requestedCandidate != null) {
            candidate = requestedCandidate
        }
        setContent {
            DesignCandidatePrototype(candidate = candidate)
        }
    }
}

/** Resolves surface roles while keeping all non-theme geometry identical. */
private fun paletteFor(candidate: String): CandidatePalette {
    if (candidate == "light-a") {
        return CandidatePalette(
            window = Color(0xFFFFFFFF),
            picker = Color(0xFFF7F2FA),
            rail = Color(0xFFECE6F0),
            transport = Color(0xFFF3EDF7),
            tracks = Color(0xFFFEF7FF),
            inactiveTrack = Color(0xFFE6E0E9),
            paneOutlines = false,
            railHairline = false,
            rowHairlines = false,
        )
    }
    if (candidate == "light-b") {
        return CandidatePalette(
            window = Color(0xFFFEF7FF),
            picker = Color(0xFFFEF7FF),
            rail = Color(0xFFFEF7FF),
            transport = Color(0xFFFEF7FF),
            tracks = Color(0xFFFEF7FF),
            inactiveTrack = Color(0xFFE7E0EC),
            paneOutlines = true,
            railHairline = true,
            rowHairlines = true,
        )
    }
    return CandidatePalette(
        window = Color(0xFFDED8E0),
        picker = Color(0xFFFFFFFF),
        rail = Color(0xFFFFFFFF),
        transport = Color(0xFFF7F2FA),
        tracks = Color(0xFFFFFFFF),
        inactiveTrack = Color(0xFFE6E0E9),
        paneOutlines = false,
        railHairline = true,
        rowHairlines = false,
    )
}

/** Emits a native full-screen Compose candidate behind Android's real system bars. */
@Composable
private fun DesignCandidatePrototype(candidate: String) {
    val palette = paletteFor(candidate = candidate)
    MaterialTheme(colorScheme = DESIGN_LIGHT_SCHEME) {
        Surface(
            modifier = Modifier.fillMaxSize(),
            color = palette.window,
        ) {
            if (candidate.startsWith("dbtp-")) {
                RightHalfStudy(candidate = candidate, palette = palette)
            } else {
                FullUnfoldedStudy(palette = palette)
            }
        }
    }
}

/** Renders a 402dp inset left pane and one edge-to-edge right track surface. */
@Composable
private fun FullUnfoldedStudy(palette: CandidatePalette) {
    Row(modifier = Modifier.fillMaxSize()) {
        Box(
            modifier = Modifier
                .width(418.dp)
                .fillMaxSize(),
        ) {
            FolderAndTransportPane(
                modifier = Modifier.fillMaxSize(),
                palette = palette,
            )
        }
        Box(modifier = Modifier.width(16.dp).fillMaxSize())
        TrackPane(
            modifier = Modifier.weight(1f),
            candidate = "dbtp-a",
            palette = palette,
        )
    }
}

/** Renders the right track surface edge to edge for its physical right-half crop. */
@Composable
private fun RightHalfStudy(candidate: String, palette: CandidatePalette) {
    Row(modifier = Modifier.fillMaxSize()) {
        Box(modifier = Modifier.width(434.dp).fillMaxSize())
        TrackPane(
            modifier = Modifier.weight(1f),
            candidate = candidate,
            palette = palette,
        )
    }
}

/** Builds the settled picker-over-transport left pane. */
@Composable
private fun FolderAndTransportPane(modifier: Modifier, palette: CandidatePalette) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(palette.picker),
    ) {
        Box(modifier = Modifier.windowInsetsTopHeight(WindowInsets.safeDrawing))
        FolderPicker(
            modifier = Modifier.weight(1f),
            palette = palette,
        )
        Box(modifier = Modifier.fillMaxWidth().height(16.dp).background(palette.window))
        TransportBlock(
            modifier = Modifier.fillMaxWidth(),
            palette = palette,
        )
    }
}

/** Shows the adaptive-letter pattern and plain wrapped folder-name targets. */
@Composable
private fun FolderPicker(modifier: Modifier, palette: CandidatePalette) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(palette.picker),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp)
                .padding(horizontal = 12.dp),
            horizontalArrangement = Arrangement.End,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Button(
                onClick = {},
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (palette.paneOutlines) Color.Transparent else Color(0xFFE8DEF8),
                    contentColor = Color(0xFF4A4459),
                ),
                modifier = if (palette.paneOutlines) {
                    Modifier.border(1.dp, Color(0xFF79747E), RoundedCornerShape(20.dp))
                } else {
                    Modifier
                },
            ) {
                Text(text = "▰  Open", fontSize = 14.sp, fontWeight = FontWeight.Medium)
            }
        }
        Row(modifier = Modifier.weight(1f)) {
            LetterRail(palette = palette)
            if (palette.railHairline) {
                Box(
                    modifier = Modifier
                        .width(1.dp)
                        .fillMaxSize()
                        .background(Color(0xFFCAC4D0)),
                )
            }
            FolderNames()
        }
    }
}

/** Draws one independently scrolling column of writing-system rail targets. */
@Composable
private fun LetterRail(palette: CandidatePalette) {
    val letters = listOf("A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q")
    Column(
        modifier = Modifier
            .width(48.dp)
            .fillMaxSize()
            .background(palette.rail)
            .verticalScroll(rememberScrollState()),
    ) {
        for (letter in letters) {
            Box(
                modifier = Modifier.size(48.dp),
                contentAlignment = Alignment.Center,
            ) {
                if (letter == "C") {
                    Surface(
                        modifier = Modifier.size(32.dp),
                        shape = CircleShape,
                        color = Color(0xFFE8DEF8),
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Text(text = letter, color = Color(0xFF4A4459), fontSize = 14.sp)
                        }
                    }
                } else {
                    Text(text = letter, color = Color(0xFF49454F), fontSize = 14.sp)
                }
            }
        }
    }
}

/** Packs filtered folder names as plain 48dp text targets with no chip styling. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun RowScope.FolderNames() {
    val folders = listOf(
        "Camellia", "C418", "Carpenter Brut", "Casiopea", "Celldweller", "Chicane",
        "CHON", "Clark", "Clown Core", "Coaltar of the Deepers", "Com Truise", "Cornelius",
        "Covet", "Crumb", "Crystal Castles", "Cult of Luna", "Current Value", "Cynic",
        "Cö shu Nie", "capsule", "Charisma.com", "Cornelius Live", "Cytus Sound Team",
    )
    Column(modifier = Modifier.weight(1f)) {
        Text(
            text = "C",
            modifier = Modifier.padding(start = 16.dp, top = 8.dp, end = 16.dp, bottom = 2.dp),
            color = Color(0xFF6750A4),
            fontSize = 22.sp,
            lineHeight = 28.sp,
        )
        FlowRow(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(start = 16.dp, end = 16.dp, bottom = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(24.dp),
        ) {
            for (folder in folders) {
                Text(
                    text = folder,
                    modifier = Modifier.heightIn(min = 48.dp),
                    color = if (folder == "Camellia") Color(0xFF6750A4) else Color(0xFF1D1B20),
                    fontSize = 16.sp,
                    fontWeight = if (folder == "Camellia") FontWeight.Medium else FontWeight.Normal,
                )
            }
        }
    }
}

/** Draws the fixed non-functional transport controls beneath the picker. */
@Composable
private fun TransportBlock(modifier: Modifier, palette: CandidatePalette) {
    Column(
        modifier = modifier
            .background(color = palette.transport)
            .windowInsetsPadding(WindowInsets.navigationBars)
            .padding(start = 16.dp, top = 14.dp, end = 16.dp, bottom = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(text = "Another Xronixle", fontSize = 16.sp, fontWeight = FontWeight.Medium)
            Text(text = "1 of 16 · −1.2 dBTP", color = Color(0xFF49454F), fontSize = 12.sp)
        }
        Slider(
            value = 0.16f,
            onValueChange = {},
            modifier = Modifier.fillMaxWidth().height(44.dp),
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            TransportCircle(label = "◀", size = 48, fill = palette.inactiveTrack)
            Box(modifier = Modifier.width(24.dp))
            TransportCircle(label = "Ⅱ", size = 64, fill = Color(0xFF6750A4), content = Color(0xFFFFFFFF))
            Box(modifier = Modifier.width(24.dp))
            TransportCircle(label = "▶", size = 48, fill = palette.inactiveTrack)
        }
        ModeControl(palette = palette)
    }
}

/** Draws one circular transport face at a cited dp diameter. */
@Composable
private fun TransportCircle(label: String, size: Int, fill: Color, content: Color = Color(0xFF49454F)) {
    Surface(
        modifier = Modifier.size(size.dp),
        shape = CircleShape,
        color = fill,
    ) {
        Box(contentAlignment = Alignment.Center) {
            Text(text = label, color = content, fontSize = 20.sp, fontWeight = FontWeight.Bold)
        }
    }
}

/** Draws the settled four-way outlined segmented mode control in two rows. */
@Composable
private fun ModeControl(palette: CandidatePalette) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, Color(0xFF79747E), RoundedCornerShape(20.dp)),
    ) {
        ModeRow(first = "Repeat", second = "In order", selectedSecond = true, palette = palette)
        ModeRow(first = "Shuffle folder", second = "Shuffle all", selectedSecond = false, palette = palette)
    }
}

/** Draws one 40dp row of two equal segmented mode faces. */
@Composable
private fun ModeRow(first: String, second: String, selectedSecond: Boolean, palette: CandidatePalette) {
    Row(modifier = Modifier.fillMaxWidth().height(40.dp)) {
        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxSize()
                .border(0.5.dp, Color(0xFF79747E)),
            contentAlignment = Alignment.Center,
        ) {
            Text(text = first, fontSize = 14.sp, fontWeight = FontWeight.Medium)
        }
        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxSize()
                .background(if (selectedSecond) Color(0xFFE8DEF8) else Color.Transparent)
                .border(0.5.dp, Color(0xFF79747E)),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = second,
                color = if (selectedSecond) Color(0xFF4A4459) else Color(0xFF1D1B20),
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
            )
        }
    }
}

/** Builds one edge-to-edge track surface with controls inside native safe insets. */
@Composable
private fun TrackPane(modifier: Modifier, candidate: String, palette: CandidatePalette) {
    Box(modifier = modifier.fillMaxSize().background(color = palette.tracks)) {
        Row(modifier = Modifier.fillMaxSize()) {
            if (palette.paneOutlines) {
                Box(modifier = Modifier.width(1.dp).fillMaxSize().background(Color(0xFFCAC4D0)))
            }
            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxSize()
                    .windowInsetsPadding(WindowInsets.safeDrawing),
            ) {
                Row(
            modifier = Modifier.fillMaxWidth().height(56.dp).padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Button(
                onClick = {},
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (palette.paneOutlines) Color.Transparent else Color(0xFFE8DEF8),
                    contentColor = Color(0xFF4A4459),
                ),
                modifier = if (palette.paneOutlines) {
                    Modifier.border(1.dp, Color(0xFF79747E), RoundedCornerShape(20.dp))
                } else {
                    Modifier
                },
            ) {
                Text(text = "Camellia  ▾", fontSize = 14.sp, fontWeight = FontWeight.Medium)
            }
            Box(modifier = Modifier.weight(1f))
            Box(modifier = Modifier.size(48.dp), contentAlignment = Alignment.Center) {
                Text(text = "⋮", color = Color(0xFF49454F), fontSize = 24.sp)
            }
        }
        val tracks = listOf(
            PrototypeTrack("Another Xronixle", "4:35", "−1.2 dBTP"),
            PrototypeTrack("Burning Aquamarine", "5:12", "−0.8 dBTP"),
            PrototypeTrack("Dokuhebi", "4:01", "−1.4 dBTP"),
            PrototypeTrack("ENÛMA∇ELIŠ", "9:47", "−0.3 dBTP"),
            PrototypeTrack("Ghost", "3:22", "−1.1 dBTP"),
            PrototypeTrack("Hyperflux", "4:44", "−0.9 dBTP"),
            PrototypeTrack("Idol Corruption", "5:31", "−0.6 dBTP"),
            PrototypeTrack("KillerToy", "4:12", "−1.0 dBTP"),
            PrototypeTrack("Nacreous Snowmelt", "6:03", "−0.7 dBTP"),
        )
                Column(modifier = Modifier.weight(1f).verticalScroll(rememberScrollState())) {
                    for (index in tracks.indices) {
                        TrackRow(
                            index = index,
                            track = tracks[index],
                            candidate = candidate,
                            palette = palette,
                        )
                    }
                }
            }
        }
    }
}

/** Renders one settled 72dp two-line row with candidate-specific metadata emphasis. */
@Composable
private fun TrackRow(index: Int, track: PrototypeTrack, candidate: String, palette: CandidatePalette) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .height(72.dp)
            .background(if (index == 0) Color(0xFFE8DEF8) else Color.Transparent),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text(
                text = if (index == 0) "▶" else (index + 1).toString(),
                modifier = Modifier.width(18.dp),
                color = if (index == 0) Color(0xFF6750A4) else Color(0xFF79747E),
                fontSize = 12.sp,
                textAlign = TextAlign.Center,
            )
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = track.title,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    fontSize = 16.sp,
                    lineHeight = 24.sp,
                )
                TrackMetadata(index = index, track = track, candidate = candidate)
            }
        }
        if (palette.rowHairlines) {
            Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(Color(0xFFCAC4D0)))
        }
    }
}

/** Applies the three open true-peak presentation treatments without changing row geometry. */
@Composable
private fun TrackMetadata(index: Int, track: PrototypeTrack, candidate: String) {
    if (candidate == "dbtp-b") {
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(text = track.duration, color = Color(0xFF49454F), fontSize = 12.sp, lineHeight = 16.sp)
            Text(text = "·", color = Color(0xFF79747E), fontSize = 12.sp, lineHeight = 16.sp)
            Text(
                text = track.peak,
                color = Color(0xFF1D1B20),
                fontSize = 12.sp,
                lineHeight = 16.sp,
                fontWeight = FontWeight.Medium,
            )
        }
        return
    }
    var metadata = track.duration + " · " + track.peak
    if (candidate == "dbtp-c" && index != 0) {
        metadata = track.duration
    }
    Text(
        text = metadata,
        color = Color(0xFF49454F),
        fontSize = 12.sp,
        lineHeight = 16.sp,
    )
}
