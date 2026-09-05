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

// What:     `Build` exposes the Android platform version running the prototype.
// Why:      Dynamic Material color is available only on Android 12 and newer.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Build } from 'android/os';
// ```
import android.os.Build

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

// What:     `Icons` and its filled vectors expose Google's official Material icon set.
// Why:      Buttons and selection cues must use consistent 24dp icons instead of font glyphs.
//
// In TS you'd write (pseudocode):
// ```ts
// import { icons } from '@material-design-icons/svg';
// ```
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.FolderOpen
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material.icons.filled.SkipPrevious

// What:     `background` paints a Compose layout node with one color.
// Why:      Candidate A, B, and C differ in their surface hierarchy.
//
// In TS you'd write (pseudocode):
// ```ts
// import { background } from 'compose/foundation';
// ```
import androidx.compose.foundation.background
import androidx.compose.foundation.Canvas

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

// What:     `clickable`, `selectable`, and `selectableGroup` add Material input behavior and roles.
// Why:      Prototype list, folder, and rail targets must expose ripple, focus, and selection semantics.
//
// In TS you'd write (pseudocode):
// ```ts
// element.addEventListener('click', onSelect);
// element.setAttribute('role', 'radio');
// ```
import androidx.compose.foundation.clickable
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup

// What:     `Arrangement` names spacing policies for rows and columns.
// Why:      The prototype keeps Material's 24dp expanded spacer and component gaps explicit.
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
// Why:      The unfolded screen keeps two 414dp panes around a 24dp centered spacer.
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
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.systemGestures
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.layout.windowInsetsTopHeight
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides

// What:     `CircleShape` is Compose's reusable circular clipping outline.
// Why:      The selected letter uses shape as a second state cue alongside color.
//
// In TS you'd write (pseudocode):
// ```ts
// const circle = { borderRadius: '50%' };
// ```
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape

// What:     Material imports supply the real Android theme, app bars, buttons, lists, slider,
//           segmented control, surfaces, icons, dividers, and text renderer.
// Why:      Every visible component must inherit Material geometry, color, state, and semantics.
//
// In TS you'd write (pseudocode):
// ```ts
// import { AppBar, Button, IconButton, ListItem, SegmentedButton, Slider } from 'material3';
// ```
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.FilledTonalIconButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.SearchBar
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Slider
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme

// What:     `Composable` marks functions that emit nodes into a Compose UI tree.
// Why:      Android's renderer can evaluate each candidate as native layout.
//
// In TS you'd write (pseudocode):
// ```ts
// type Component = () => JSX.Element;
// ```
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider

// What:     `Alignment` names child alignment positions and `Modifier` carries layout operations.
// Why:      Controls need centered glyphs and explicit placement without imperative coordinates.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Alignment, Modifier } from 'compose/ui';
// ```
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics

// What:     Compose `Color` stores packed ARGB color values used by rendered components.
// Why:      The three candidate surface systems use the verified MD3 light palette.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Color } from 'compose/ui/graphics';
// ```
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color

// What:     `FontWeight`, `TextAlign`, and `TextOverflow` configure native text rendering.
// Why:      Track metadata variants must differ only in intended emphasis and availability.
//
// In TS you'd write (pseudocode):
// ```ts
// import { FontWeight, TextAlign, TextOverflow } from 'compose/ui/text';
// ```
import androidx.compose.ui.text.font.FontWeight

// What:     `dp` and `sp` construct density-aware layout and font measurements.
// Why:      Android converts the cited logical geometry to the emulator's 390dpi panel pixels.
//
// In TS you'd write (pseudocode):
// ```ts
// const dp = (value: number) => value;
// const sp = (value: number) => value;
// ```
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp

/** Intent key used by screenshot automation to select one static candidate. */
const val DESIGN_CANDIDATE_EXTRA: String = "candidate"

/** Default candidate used when screenshot automation omits its explicit selection. */
const val DEFAULT_DESIGN_CANDIDATE: String = "light-c"

/** Font-scale threshold where one-row segments change to a reflowing Material radio group. */
const val LARGE_TEXT_MODE_THRESHOLD: Float = 1.5f

/** Candidate-specific Material surface roles and decorative-divider treatment. */
private data class CandidatePalette(
    val window: Color,
    val picker: Color,
    val rail: Color,
    val transport: Color,
    val tracks: Color,
    val spacer: Color,
    val sectionDivider: Color,
    val paneDivider: Boolean,
    val railDivider: Boolean,
    val railDividerColor: Color,
    val rowDividers: Boolean,
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

/** Resolves only documented Material surface roles while keeping component geometry identical. */
private fun paletteFor(candidate: String, scheme: ColorScheme): CandidatePalette {
    if (candidate == "divider-a") {
        return CandidatePalette(
            window = scheme.surfaceDim,
            picker = scheme.surfaceContainerLowest,
            rail = scheme.surfaceContainerLowest,
            transport = scheme.surfaceContainerLow,
            tracks = scheme.surfaceContainerLowest,
            spacer = scheme.surfaceDim,
            sectionDivider = scheme.surfaceDim,
            paneDivider = false,
            railDivider = true,
            railDividerColor = Color.White,
            rowDividers = false,
        )
    }
    if (candidate == "divider-b") {
        return CandidatePalette(
            window = scheme.surfaceDim,
            picker = scheme.surfaceContainerLowest,
            rail = scheme.surfaceContainerLowest,
            transport = scheme.surfaceContainerLow,
            tracks = scheme.surfaceContainerLowest,
            spacer = Color.White,
            sectionDivider = scheme.surfaceDim,
            paneDivider = false,
            railDivider = true,
            railDividerColor = scheme.outlineVariant,
            rowDividers = false,
        )
    }
    if (candidate == "divider-c") {
        return CandidatePalette(
            window = scheme.surfaceDim,
            picker = scheme.surfaceContainerLowest,
            rail = scheme.surfaceContainerLowest,
            transport = scheme.surfaceContainerLow,
            tracks = scheme.surfaceContainerLowest,
            spacer = Color.White,
            sectionDivider = scheme.surfaceDim,
            paneDivider = false,
            railDivider = true,
            railDividerColor = Color.White,
            rowDividers = false,
        )
    }
    if (candidate == "light-a") {
        return CandidatePalette(
            window = scheme.surface,
            picker = scheme.surfaceContainerLow,
            rail = scheme.surfaceContainerHigh,
            transport = scheme.surfaceContainer,
            tracks = scheme.surface,
            spacer = scheme.surface,
            sectionDivider = scheme.surface,
            paneDivider = false,
            railDivider = false,
            railDividerColor = scheme.outlineVariant,
            rowDividers = false,
        )
    }
    if (candidate == "light-b") {
        return CandidatePalette(
            window = scheme.surface,
            picker = scheme.surface,
            rail = scheme.surface,
            transport = scheme.surface,
            tracks = scheme.surface,
            spacer = scheme.surface,
            sectionDivider = scheme.surface,
            paneDivider = true,
            railDivider = true,
            railDividerColor = scheme.outlineVariant,
            rowDividers = true,
        )
    }
    return CandidatePalette(
        window = scheme.surfaceDim,
        picker = scheme.surfaceContainerLowest,
        rail = scheme.surfaceContainerLowest,
        transport = scheme.surfaceContainerLow,
        tracks = scheme.surfaceContainerLowest,
        spacer = Color.White,
        sectionDivider = Color.White,
        paneDivider = false,
        railDivider = true,
        railDividerColor = scheme.outlineVariant,
        rowDividers = false,
    )
}

/** Emits a native full-screen Compose candidate behind Android's real system bars. */
@Composable
private fun DesignCandidatePrototype(candidate: String) {
    val context = LocalContext.current
    val scheme = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        dynamicLightColorScheme(context)
    } else {
        lightColorScheme()
    }
    MaterialTheme(colorScheme = scheme) {
        val palette = paletteFor(candidate = candidate, scheme = MaterialTheme.colorScheme)
        Surface(
            modifier = Modifier.fillMaxSize(),
            color = palette.window,
        ) {
            if (candidate.startsWith("command-")) {
                Box(modifier = Modifier.fillMaxSize()) {
                    FullUnfoldedStudy(palette = palette)
                    CommandBarMatrixSurface(candidate = candidate)
                }
            } else if (candidate.startsWith("dbtp-")) {
                RightHalfStudy(candidate = candidate, palette = palette)
            } else {
                FullUnfoldedStudy(palette = palette)
            }
        }
    }
}

/** Renders two equal 414dp panes around Material's centered 24dp expanded-layout spacer. */
@Composable
private fun FullUnfoldedStudy(palette: CandidatePalette) {
    Row(modifier = Modifier.fillMaxSize()) {
        Box(
            modifier = Modifier
                .width(414.dp)
                .fillMaxSize(),
        ) {
            FolderAndTransportPane(
                modifier = Modifier.fillMaxSize(),
                palette = palette,
            )
        }
        Box(
            modifier = Modifier
                .width(24.dp)
                .fillMaxSize()
                .background(palette.spacer),
        )
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
        Box(modifier = Modifier.width(438.dp).fillMaxSize())
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
        Box(modifier = Modifier.fillMaxWidth().height(16.dp).background(palette.sectionDivider))
        TransportBlock(
            modifier = Modifier.fillMaxWidth(),
            palette = palette,
        )
    }
}

/** Shows a Material app bar, source actions, adaptive letter rail, and wrapped folder targets. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FolderPicker(modifier: Modifier, palette: CandidatePalette) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(palette.picker),
    ) {
        TopAppBar(
            title = {
                Text(text = "Folders")
            },
            actions = {
                TextButton(onClick = {}) {
                    Icon(
                        imageVector = Icons.Filled.FolderOpen,
                        contentDescription = null,
                        modifier = Modifier.size(ButtonDefaults.IconSize),
                    )
                    Box(modifier = Modifier.width(ButtonDefaults.IconSpacing))
                    Text(text = "Open")
                }
            },
            modifier = Modifier.windowInsetsPadding(
                WindowInsets.systemGestures.only(WindowInsetsSides.Start),
            ),
            colors = TopAppBarDefaults.topAppBarColors(
                containerColor = palette.picker,
                scrolledContainerColor = palette.picker,
            ),
            windowInsets = WindowInsets(0, 0, 0, 0),
        )
        Row(modifier = Modifier.weight(1f)) {
            LetterRail(palette = palette)
            if (palette.railDivider) {
                Box(
                    modifier = Modifier
                        .width(1.dp)
                        .fillMaxSize()
                        .background(palette.railDividerColor),
                )
            }
            FolderNames()
        }
    }
}

/** Draws one independently scrolling single-select column of writing-system targets. */
@Composable
private fun LetterRail(palette: CandidatePalette) {
    val letters = listOf("A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q")
    Column(
        modifier = Modifier
            .width(48.dp)
            .fillMaxSize()
            .background(palette.rail)
            .verticalScroll(rememberScrollState())
            .selectableGroup(),
    ) {
        for (letter in letters) {
            val selectedLetter = letter == "C"
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .selectable(
                        selected = selectedLetter,
                        onClick = {},
                        role = Role.RadioButton,
                    ),
                contentAlignment = Alignment.Center,
            ) {
                if (selectedLetter) {
                    Surface(
                        modifier = Modifier.size(32.dp),
                        shape = CircleShape,
                        color = MaterialTheme.colorScheme.secondaryContainer,
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Text(
                                text = letter,
                                color = MaterialTheme.colorScheme.onSecondaryContainer,
                                style = MaterialTheme.typography.labelLarge,
                            )
                        }
                    }
                } else {
                    Text(
                        text = letter,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.labelLarge,
                    )
                }
            }
        }
    }
}

/** Packs filtered folder names as plain selectable 48dp text targets with no chip styling. */
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
            color = MaterialTheme.colorScheme.primary,
            style = MaterialTheme.typography.titleLarge,
        )
        FlowRow(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(start = 12.dp, end = 16.dp, bottom = 16.dp)
                .selectableGroup(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            for (folder in folders) {
                val selectedFolder = folder == "Camellia"
                Box(
                    modifier = Modifier
                        .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                        .selectable(
                            selected = selectedFolder,
                            onClick = {},
                            role = Role.RadioButton,
                        ),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = folder,
                        modifier = Modifier.padding(horizontal = 4.dp),
                        color = if (selectedFolder) {
                            MaterialTheme.colorScheme.primary
                        } else {
                            MaterialTheme.colorScheme.onSurface
                        },
                        style = if (selectedFolder) {
                            MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Medium)
                        } else {
                            MaterialTheme.typography.bodyLarge
                        },
                    )
                    if (selectedFolder) {
                        val indicatorColor = MaterialTheme.colorScheme.primary
                        Canvas(modifier = Modifier.matchParentSize()) {
                            val indicatorHeight = 2.dp.toPx()
                            drawRect(
                                color = indicatorColor,
                                topLeft = Offset(0f, size.height - indicatorHeight),
                                size = Size(size.width, indicatorHeight),
                            )
                        }
                    }
                }
            }
        }
    }
}

/** Draws a labeled Material slider, official transport icon buttons, and one-row mode selector. */
@Composable
private fun TransportBlock(modifier: Modifier, palette: CandidatePalette) {
    Column(
        modifier = modifier
            .heightIn(max = 440.dp)
            .background(color = palette.transport)
            .verticalScroll(rememberScrollState())
            .windowInsetsPadding(WindowInsets.systemGestures.only(WindowInsetsSides.Start))
            .windowInsetsPadding(WindowInsets.navigationBars)
            .padding(horizontal = 16.dp, vertical = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(text = "Another Xronixle", style = MaterialTheme.typography.titleMedium)
            Text(
                text = "1 of 16 · −1.2 dBTP",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodySmall,
            )
        }
        CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                val timeStyle = MaterialTheme.typography.labelMedium.copy(fontFeatureSettings = "tnum")
                Text(
                    text = "1:06",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = timeStyle,
                )
                Slider(
                    value = 0.16f,
                    onValueChange = {},
                    modifier = Modifier
                        .weight(1f)
                        .semantics {
                            contentDescription = "Track position"
                        },
                )
                Text(
                    text = "4:35",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = timeStyle,
                )
            }
            TransportControls()
        }
        ModeControl()
    }
}

/** Draws three real Material icon buttons with color and size hierarchy for playback. */
@Composable
private fun TransportControls() {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        FilledTonalIconButton(onClick = {}) {
            Icon(imageVector = Icons.Filled.SkipPrevious, contentDescription = "Previous track")
        }
        FilledIconButton(onClick = {}) {
            Icon(imageVector = Icons.Filled.Pause, contentDescription = "Pause")
        }
        FilledTonalIconButton(onClick = {}) {
            Icon(imageVector = Icons.Filled.SkipNext, contentDescription = "Next track")
        }
    }
}

/** Draws one non-wrapping segmented control or a reflowing radio group for enlarged text. */
@Composable
private fun ModeControl() {
    val labels = listOf("Repeat", "In order", "Shuffle", "Shuffle all")
    val accessibleLabels = listOf("Repeat track", "Play in order", "Shuffle current folder", "Shuffle all folders")
    if (LocalDensity.current.fontScale >= LARGE_TEXT_MODE_THRESHOLD) {
        LargeTextModeControl(labels = accessibleLabels)
        return
    }
    SingleChoiceSegmentedButtonRow {
        for (index in labels.indices) {
            SegmentedButton(
                selected = index == 1,
                onClick = {},
                shape = SegmentedButtonDefaults.itemShape(index = index, count = labels.size),
                modifier = Modifier
                    .defaultMinSize(minWidth = 48.dp)
                    .semantics {
                        contentDescription = accessibleLabels[index]
                    },
            ) {
                Text(text = labels[index], maxLines = 1)
            }
        }
    }
}

/** Reflows playback modes into full-label Material radio rows when system text is enlarged. */
@Composable
private fun LargeTextModeControl(labels: List<String>) {
    Column(modifier = Modifier.fillMaxWidth().selectableGroup()) {
        for (index in labels.indices) {
            val selectedMode = index == 1
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 48.dp)
                    .selectable(
                        selected = selectedMode,
                        onClick = {},
                        role = Role.RadioButton,
                    )
                    .padding(horizontal = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                RadioButton(selected = selectedMode, onClick = null)
                Text(text = labels[index], style = MaterialTheme.typography.bodyLarge)
            }
        }
    }
}

/** Builds one edge-to-edge track surface with a real app bar and list inside native insets. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TrackPane(modifier: Modifier, candidate: String, palette: CandidatePalette) {
    Box(modifier = modifier.fillMaxSize().background(color = palette.tracks)) {
        Row(modifier = Modifier.fillMaxSize()) {
            if (palette.paneDivider) {
                Box(
                    modifier = Modifier
                        .width(1.dp)
                        .fillMaxSize()
                        .background(MaterialTheme.colorScheme.outlineVariant),
                )
            }
            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxSize()
                    .windowInsetsPadding(WindowInsets.systemGestures.only(WindowInsetsSides.End)),
            ) {
                Box(modifier = Modifier.windowInsetsTopHeight(WindowInsets.safeDrawing))
                TopAppBar(
                    title = {
                        Text(text = "Camellia")
                    },
                    actions = {
                        IconButton(onClick = {}) {
                            Icon(imageVector = Icons.Filled.Settings, contentDescription = "Settings")
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = palette.tracks,
                        scrolledContainerColor = MaterialTheme.colorScheme.surfaceContainer,
                    ),
                    windowInsets = WindowInsets(0, 0, 0, 0),
                )
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
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .verticalScroll(rememberScrollState())
                        .windowInsetsPadding(WindowInsets.navigationBars),
                ) {
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

/** Renders one baseline Material two-line list item with an icon-only current-track cue. */
@Suppress("DEPRECATION")
@Composable
private fun TrackRow(index: Int, track: PrototypeTrack, candidate: String, palette: CandidatePalette) {
    val playing = index == 0
    ListItem(
        headlineContent = {
            Text(
                text = track.title,
                style = MaterialTheme.typography.bodyLarge,
            )
        },
        supportingContent = {
            TrackMetadata(
                track = track,
                candidate = candidate,
            )
        },
        leadingContent = {
            Box(
                modifier = Modifier.size(24.dp),
                contentAlignment = Alignment.Center,
            ) {
                if (playing) {
                    Icon(
                        imageVector = Icons.Filled.PlayArrow,
                        contentDescription = "Playing",
                    )
                }
            }
        },
        trailingContent = if (candidate == "dbtp-c") {
            {
                Text(
                    text = track.peak,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.labelMedium.copy(fontFeatureSettings = "tnum"),
                )
            }
        } else {
            null
        },
        colors = ListItemDefaults.colors(
            containerColor = Color.Transparent,
            headlineColor = MaterialTheme.colorScheme.onSurface,
            leadingIconColor = MaterialTheme.colorScheme.primary,
            supportingColor = MaterialTheme.colorScheme.onSurfaceVariant,
        ),
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 72.dp)
            .clickable(role = Role.Button, onClick = {})
            .semantics {
                selected = playing
            },
    )
    if (palette.rowDividers) {
        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
    }
}

/** Applies three true-peak treatments while preserving every value and valid Material role pairs. */
@Composable
private fun TrackMetadata(track: PrototypeTrack, candidate: String) {
    val supportingColor = MaterialTheme.colorScheme.onSurfaceVariant
    if (candidate == "dbtp-b") {
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                text = track.duration,
                color = supportingColor,
                style = MaterialTheme.typography.bodySmall,
            )
            Text(
                text = "·",
                color = supportingColor,
                style = MaterialTheme.typography.bodySmall,
            )
            Text(
                text = track.peak,
                color = MaterialTheme.colorScheme.onSurface,
                style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.Medium),
            )
        }
        return
    }
    var metadata = track.duration + " · " + track.peak
    if (candidate == "dbtp-c") {
        metadata = track.duration
    }
    Text(
        text = metadata,
        color = supportingColor,
        style = MaterialTheme.typography.bodySmall,
    )
}

/**
 * What:     `PrototypeSearchResult` is a Kotlin record used by the command-bar matrix.
 * Why:      Each static result needs one typed bundle so layout code does not pass parallel values.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * type PrototypeSearchResult = {
 *   title: string;
 *   supporting: string;
 *   kind: 'folder' | 'track' | 'command';
 *   shortcut: string;
 * };
 * ```
 */
private data class PrototypeSearchResult(
    val title: String,
    val supporting: String,
    val kind: String,
    val shortcut: String,
)

/**
 * What:     `CommandBarMatrixSurface` draws one overlay selected by matrix candidate key.
 * Why:      Nine screenshots must vary scope and placement without changing accepted app chrome.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function CommandBarMatrixSurface({ candidate }: { candidate: string }): JSX.Element {}
 * ```
 */
@Composable
private fun CommandBarMatrixSurface(candidate: String) {
    val scope = if (candidate.startsWith("command-c-")) {
        "commands"
    } else if (candidate.startsWith("command-s-")) {
        "scoped"
    } else {
        "unified"
    }
    val presentation = if (candidate.endsWith("-p")) {
        "pane"
    } else if (candidate.endsWith("-f")) {
        "full"
    } else {
        "docked"
    }
    if (presentation == "pane") {
        PaneCommandBar(scope = scope)
        return
    }
    if (presentation == "full") {
        FullScreenCommandBar(scope = scope)
        return
    }
    DockedCommandBar(scope = scope)
}

/**
 * What:     `DockedCommandBar` places a 720dp search surface over a scrim.
 * Why:      Material recommends docked focused search for expanded windows while preserving context.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function DockedCommandBar({ scope }: { scope: string }): JSX.Element {}
 * ```
 */
@Composable
private fun DockedCommandBar(scope: String) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.scrim.copy(alpha = 0.32f)),
        contentAlignment = Alignment.TopEnd,
    ) {
        Surface(
            modifier = Modifier
                .padding(top = 60.dp, end = 12.dp)
                .width(390.dp)
                .height(580.dp),
            shape = RoundedCornerShape(28.dp),
            color = MaterialTheme.colorScheme.surfaceContainerHigh,
            shadowElevation = 6.dp,
        ) {
            CommandSearchPanel(scope = scope, modifier = Modifier.fillMaxSize().padding(12.dp))
        }
    }
}

/**
 * What:     `PaneCommandBar` replaces only the accepted layout's right 414dp pane.
 * Why:      This variant tests persistent folder context against reduced result width.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function PaneCommandBar({ scope }: { scope: string }): JSX.Element {}
 * ```
 */
@Composable
private fun PaneCommandBar(scope: String) {
    Row(modifier = Modifier.fillMaxSize()) {
        Box(modifier = Modifier.width(438.dp).fillMaxSize())
        Surface(
            modifier = Modifier.weight(1f).fillMaxSize(),
            color = MaterialTheme.colorScheme.surfaceContainerLow,
        ) {
            CommandSearchPanel(
                scope = scope,
                modifier = Modifier
                    .fillMaxSize()
                    .windowInsetsPadding(WindowInsets.safeDrawing)
                    .padding(horizontal = 12.dp),
            )
        }
    }
}

/**
 * What:     `FullScreenCommandBar` replaces the visual workspace with focused search.
 * Why:      This variant tests maximum result capacity and compact-screen parity.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function FullScreenCommandBar({ scope }: { scope: string }): JSX.Element {}
 * ```
 */
@Composable
private fun FullScreenCommandBar(scope: String) {
    Row(modifier = Modifier.fillMaxSize()) {
        Surface(
            modifier = Modifier.width(414.dp).fillMaxSize(),
            color = MaterialTheme.colorScheme.surfaceContainerLow,
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .windowInsetsPadding(WindowInsets.safeDrawing)
                    .padding(horizontal = 12.dp),
            ) {
                CommandSearchInput(scope = scope)
                if (scope == "scoped") {
                    ScopeFilterRow()
                }
                Text(
                    text = "Results appear in the other pane",
                    modifier = Modifier.padding(16.dp),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }
        Box(
            modifier = Modifier
                .width(24.dp)
                .fillMaxSize()
                .background(Color.White),
        )
        Surface(
            modifier = Modifier.weight(1f).fillMaxSize(),
            color = MaterialTheme.colorScheme.surfaceContainerLowest,
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .windowInsetsPadding(WindowInsets.safeDrawing)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 12.dp),
            ) {
                SearchResultContent(scope = scope)
            }
        }
    }
}

/**
 * What:     `CommandSearchPanel` combines a real baseline Material search bar with result lists.
 * Why:      Every placement option must compare the same query, filters, and result semantics.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function CommandSearchPanel(props: { scope: string; className: string }): JSX.Element {}
 * ```
 */
@Composable
private fun CommandSearchPanel(scope: String, modifier: Modifier) {
    Column(modifier = modifier.verticalScroll(rememberScrollState())) {
        CommandSearchInput(scope = scope)
        if (scope == "scoped") {
            ScopeFilterRow()
        }
        SearchResultContent(scope = scope)
    }
}

/**
 * What:     `CommandSearchInput` renders Material's baseline 56dp search component in a static state.
 * Why:      The matrix should assess information architecture, not hand-drawn field geometry.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function CommandSearchInput({ scope }: { scope: string }): JSX.Element {}
 * ```
 */
@Suppress("DEPRECATION")
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CommandSearchInput(scope: String) {
    val query = if (scope == "commands") "" else "cam"
    val hint = if (scope == "commands") "Run a command" else "Search folders, tracks, and commands"
    SearchBar(
        query = query,
        onQueryChange = {},
        onSearch = {},
        active = false,
        onActiveChange = {},
        modifier = Modifier.fillMaxWidth(),
        placeholder = {
            Text(text = hint)
        },
        leadingIcon = {
            Icon(imageVector = Icons.Filled.ArrowBack, contentDescription = "Close command bar")
        },
        trailingIcon = {
            Icon(imageVector = Icons.Filled.Close, contentDescription = "Clear query")
        },
        windowInsets = WindowInsets(0, 0, 0, 0),
    ) {}
}

/**
 * What:     `ScopeFilterRow` shows explicit All, Folders, Tracks, and Commands choices.
 * Why:      The scoped matrix row must make category control visible before result selection.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function ScopeFilterRow(): JSX.Element {}
 * ```
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ScopeFilterRow() {
    val scopes = listOf("All", "Folders", "Tracks", "Commands")
    FlowRow(
        modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        for (index in scopes.indices) {
            FilterChip(
                selected = index == 2,
                onClick = {},
                label = {
                    Text(text = scopes[index])
                },
                modifier = Modifier.heightIn(min = 48.dp),
            )
        }
    }
}

/**
 * What:     `SearchResultContent` supplies representative commands or grouped library matches.
 * Why:      Users need to judge scope from concrete duplicate-name and command results.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function SearchResultContent({ scope }: { scope: string }): JSX.Element {}
 * ```
 */
@Composable
private fun SearchResultContent(scope: String) {
    if (scope == "commands") {
        SearchResultStatus(text = "5 recent commands")
        ResultSection(
            title = "RECENT COMMANDS",
            results = listOf(
                PrototypeSearchResult("Pause playback", "Playback", "command", "Space"),
                PrototypeSearchResult("Play in order", "Playback mode", "command", ""),
                PrototypeSearchResult("Jump to playing track", "Navigation", "command", "Ctrl+L"),
                PrototypeSearchResult("Open folder", "Library", "command", "Ctrl+O"),
                PrototypeSearchResult("Settings", "Application", "command", "Ctrl+,"),
            ),
        )
        return
    }
    if (scope == "scoped") {
        SearchResultStatus(text = "2 track results")
        ResultSection(
            title = "TRACKS",
            results = listOf(
                PrototypeSearchResult("Another Xronixle", "Camellia · 4:35 · −1.2 dBTP", "track", ""),
                PrototypeSearchResult("Crystallized", "Camellia · 5:40 · −0.7 dBTP", "track", ""),
            ),
        )
        return
    }
    SearchResultStatus(text = "6 results in 3 groups")
    ResultSection(
        title = "FOLDERS",
        results = listOf(
            PrototypeSearchResult("Camellia", "Folder · 16 tracks", "folder", ""),
            PrototypeSearchResult("Camille Saint-Saëns", "Folder · 43 tracks", "folder", ""),
        ),
    )
    ResultSection(
        title = "TRACKS",
        results = listOf(
            PrototypeSearchResult("Another Xronixle", "Camellia · 4:35 · −1.2 dBTP", "track", ""),
            PrototypeSearchResult("Crystallized", "Camellia · 5:40 · −0.7 dBTP", "track", ""),
        ),
    )
    ResultSection(
        title = "COMMANDS",
        results = listOf(
            PrototypeSearchResult("Open Camellia in file manager", "Folder action", "command", ""),
            PrototypeSearchResult("Play Camellia", "Folder action", "command", "Enter"),
        ),
    )
}

/**
 * What:     `SearchResultStatus` renders result count as visible and politely announced status.
 * Why:      Search updates need both sighted feedback and a screen-reader notification.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function SearchResultStatus({ text }: { text: string }): JSX.Element {}
 * ```
 */
@Composable
private fun SearchResultStatus(text: String) {
    Text(
        text = text,
        modifier = Modifier
            .padding(start = 16.dp, top = 12.dp, end = 16.dp)
            .semantics {
                liveRegion = LiveRegionMode.Polite
            },
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.typography.bodyMedium,
    )
}

/**
 * What:     `ResultSection` emits a category label followed by baseline Material list rows.
 * Why:      Group labels disambiguate folders, tracks, and actions without relying on icon color.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function ResultSection(props: { title: string; results: readonly Result[] }): JSX.Element {}
 * ```
 */
@Composable
private fun ResultSection(title: String, results: List<PrototypeSearchResult>) {
    Text(
        text = title,
        modifier = Modifier.padding(start = 16.dp, top = 12.dp, bottom = 4.dp),
        color = MaterialTheme.colorScheme.primary,
        style = MaterialTheme.typography.labelMedium,
    )
    for (result in results) {
        SearchResultRow(result = result)
    }
}

/**
 * What:     `SearchResultRow` maps one result record to an actionable two-line list item.
 * Why:      Folder context and keyboard shortcuts must remain visible at selection time.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function SearchResultRow({ result }: { result: PrototypeSearchResult }): JSX.Element {}
 * ```
 */
@Suppress("DEPRECATION")
@Composable
private fun SearchResultRow(result: PrototypeSearchResult) {
    val resultIcon = if (result.kind == "folder") {
        Icons.Filled.Folder
    } else if (result.kind == "track") {
        Icons.Filled.MusicNote
    } else if (result.title.startsWith("Play") || result.title.startsWith("Pause")) {
        Icons.Filled.PlayArrow
    } else {
        Icons.Filled.Search
    }
    ListItem(
        headlineContent = {
            Text(text = result.title)
        },
        supportingContent = {
            Text(text = result.supporting)
        },
        leadingContent = {
            Icon(imageVector = resultIcon, contentDescription = result.kind)
        },
        trailingContent = if (result.shortcut.isNotEmpty()) {
            {
                Text(
                    text = result.shortcut,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.labelMedium,
                )
            }
        } else {
            null
        },
        colors = ListItemDefaults.colors(containerColor = Color.Transparent),
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 72.dp)
            .clickable(role = Role.Button, onClick = {}),
    )
}
