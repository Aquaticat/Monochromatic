//region Template editor pages drawn with platform Material 3 parts, authored state only
// What: Package joins the authored template editor record with its native presentation.
// Why: Both pages draw fixture text as given; nothing here parses or evaluates a template.
//
// In TS you'd write (pseudocode):
// ```ts
// // Source-folder module namespace.
// ```
package dev.monochromatic.musicplayer

// What: Named imports expose native layout containers, system inset sources, focus control and
// Material 3 components.
// Why: Both pages are assembled from the platform's own list item, text field and button, so the
// study shows what those parts really do on the device instead of hand-drawn copies.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Column, Row, ListItem, OutlinedTextField, Text, TextButton } from 'native-ui';
// ```
import androidx.compose.foundation.background
// Makes a whole row one tappable action.
import androidx.compose.foundation.clickable
// Vertical placement of children inside a column taller than they are.
import androidx.compose.foundation.layout.Arrangement
// Plain container: the empty status-bar spacer, and the measured wrapper around the template field.
import androidx.compose.foundation.layout.Box
// Vertical stack.
import androidx.compose.foundation.layout.Column
// Horizontal stack for the header and for one error line.
import androidx.compose.foundation.layout.Row
// Native system inset source.
import androidx.compose.foundation.layout.WindowInsets
// Minimum size that applies only when the parent asks for nothing larger.
import androidx.compose.foundation.layout.defaultMinSize
// Fill the offered region.
import androidx.compose.foundation.layout.fillMaxSize
// Fill the offered width only.
import androidx.compose.foundation.layout.fillMaxWidth
// Fixed header height.
import androidx.compose.foundation.layout.height
// Minimum height for a preview row.
import androidx.compose.foundation.layout.heightIn
// Pads content by the software keyboard's height while it is open.
import androidx.compose.foundation.layout.imePadding
// Bottom system navigation inset.
import androidx.compose.foundation.layout.navigationBars
// Explicit content insets.
import androidx.compose.foundation.layout.padding
// Square Back target and the error icon.
import androidx.compose.foundation.layout.size
// Top system status inset.
import androidx.compose.foundation.layout.statusBars
// Pads content by a system inset.
import androidx.compose.foundation.layout.windowInsetsPadding
// A spacer exactly as tall as a top system inset.
import androidx.compose.foundation.layout.windowInsetsTopHeight
// Remembered scroll position for a page body.
import androidx.compose.foundation.rememberScrollState
// Lets a page body scroll when it is taller than its viewport.
import androidx.compose.foundation.verticalScroll
// Material icon namespace.
import androidx.compose.material.icons.Icons
// The Back arrow glyph already used by the accepted Search and Settings headers.
import androidx.compose.material.icons.filled.ArrowBack
// A filled circle with an exclamation mark, the second channel beside the error colour.
import androidx.compose.material.icons.filled.Error
// One-pixel-class separators.
import androidx.compose.material3.HorizontalDivider
// Icon renderer.
import androidx.compose.material3.Icon
// Icon-only button with ripple and semantics.
import androidx.compose.material3.IconButton
// Platform Material 3 list row.
import androidx.compose.material3.ListItem
// Colour overrides for that row.
import androidx.compose.material3.ListItemDefaults
// Shared colour and type roles.
import androidx.compose.material3.MaterialTheme
// Platform Material 3 text field with an outline, a floating label and a supporting-text slot.
import androidx.compose.material3.OutlinedTextField
// Text renderer.
import androidx.compose.material3.Text
// Low-emphasis button drawn as a label only.
import androidx.compose.material3.TextButton
// Native function registration.
import androidx.compose.runtime.Composable
// Runs a block once, or again when a listed value changes.
import androidx.compose.runtime.LaunchedEffect
// An observable box holding one whole number.
import androidx.compose.runtime.mutableIntStateOf
// Keeps one object across redraws of the same element.
import androidx.compose.runtime.remember
// Cross-axis alignment constants.
import androidx.compose.ui.Alignment
// Immutable native layout configuration.
import androidx.compose.ui.Modifier
// A handle the page uses to give keyboard focus to one element.
import androidx.compose.ui.focus.FocusRequester
// Attaches that handle to an element.
import androidx.compose.ui.focus.focusRequester
// Opaque colour value.
import androidx.compose.ui.graphics.Color
// Runs a callback with an element's position and size each time layout has placed it.
import androidx.compose.ui.layout.onPlaced
// An element's top-left corner, measured from its parent's content.
import androidx.compose.ui.layout.positionInParent
// Current screen density, to convert the scroll margin from dp to pixels.
import androidx.compose.ui.platform.LocalDensity
// The window's software-keyboard controller, read from the surrounding UI tree.
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
// Accessibility role names.
import androidx.compose.ui.semantics.Role
// Marks a text as a heading for assistive technology.
import androidx.compose.ui.semantics.heading
// Attaches accessibility properties.
import androidx.compose.ui.semantics.semantics
// Character-level styling applied to part of a text.
import androidx.compose.ui.text.SpanStyle
// A start and end position inside a text; equal ends mean a caret.
import androidx.compose.ui.text.TextRange
// Builds one text out of differently styled parts.
import androidx.compose.ui.text.buildAnnotatedString
// Font family names; Monospace gives every character the same width.
import androidx.compose.ui.text.font.FontFamily
// Font weight names; Bold is the heavy one.
import androidx.compose.ui.text.font.FontWeight
// A text-field value: the text together with its caret or selection.
import androidx.compose.ui.text.input.TextFieldValue
// Single-line truncation policy.
import androidx.compose.ui.text.style.TextOverflow
// Applies one style to the text appended inside its block.
import androidx.compose.ui.text.withStyle
// Density-independent distance type.
import androidx.compose.ui.unit.Dp
// Density-independent literal distance.
import androidx.compose.ui.unit.dp
// Rounds a fractional number to the nearest whole one.
import kotlin.math.roundToInt

/**
 * What: A composable draws the Settings page: status spacer, header, separator, a `Templates`
 * heading and the template's one entry. `@Composable` registers the function as a UI builder that
 * may only be called from another one. `Modifier` is an immutable layout configuration. `Dp` is a
 * density-independent distance; the siblings a reader might expect are a raw pixel Int and the
 * font-scaled `Sp`. `Color` is an opaque colour value. `(String) -> Unit` is a function type taking
 * one string and returning nothing. `startSafe` and `endSafe` are the horizontal insets that keep
 * text clear of the fold connector.
 * Why: The entry shows the line the template produces now, so its effect is visible before the
 * editor is opened. The insets use Dp (not pixels or Sp) so they are the same physical size on both
 * panels and do not grow with the user's text size.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function TemplateEditorListPage(input: { modifier: Modifier; startSafe: number; endSafe: number; pageColor: Color;
 *   fixture: TemplateEditorFixture; onEvent: (event: string) => void; onMeasure: (line: string) => void }): UIElement;
 * ```
 */
@Composable
internal fun TemplateEditorListPage(modifier: Modifier, startSafe: Dp, endSafe: Dp, pageColor: Color,
    fixture: TemplateEditorFixture, onEvent: (String) -> Unit, onMeasure: (String) -> Unit) {
    // What: val binds one remembered scroll-state object for this page.
    // Why: Its maxValue says how many pixels of content lie outside the viewport, which a screenshot cannot.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const scroll = useScrollState();
    // ```
    val scroll = rememberScrollState()
    // What: LaunchedEffect reruns its block whenever the listed value changes. `Int.MAX_VALUE` is the
    // largest 32-bit whole number, which the scroll state holds until the first layout has measured it.
    // `${...}` splices a value into the string like a TypeScript template literal.
    // Why: The hidden extent is logged once it is known, and again only when a layout changes it.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // useEffect(() => { if (scroll.maxValue !== 2147483647) onMeasure(`TemplateEditor.scroll:max=${scroll.maxValue}`); }, [scroll.maxValue]);
    // ```
    LaunchedEffect(scroll.maxValue) {
        if (scroll.maxValue != Int.MAX_VALUE) onMeasure("TemplateEditor.scroll:max=${scroll.maxValue}")
    }
    // What: Nested trailing lambdas supply the children of native layout components. A modifier is
    // built by chaining calls left to right; each call wraps what the calls before it described.
    // Why: Header and body stay one page, in the accepted Settings page's header-over-content order.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // <Column style={{ background: pageColor }}><StatusSpacer/><Header/><Divider/><ScrollColumn>{body}</ScrollColumn></Column>
    // ```
    Column(modifier = modifier.fillMaxSize().background(pageColor)) {
        // What: An empty Box as tall as the status bar; `WindowInsets.statusBars` is that bar's size.
        // Why: The window draws edge to edge, so the header must start under the clock and icons.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // <div style={{ height: 'env(safe-area-inset-top)' }}/>
        // ```
        Box(modifier = Modifier.fillMaxWidth().windowInsetsTopHeight(WindowInsets.statusBars))
        // What: Arguments are passed by name; `{ onEvent("back") }` is a lambda (an arrow function)
        // taking no arguments.
        // Why: This page's Back target leaves Settings for the player, which the study only logs.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // <Header title="Settings" backDescription="Back to player" onBack={() => onEvent('back')}/>
        // ```
        TemplateEditorHeader(title = "Settings", backDescription = "Back to player",
            onBack = { onEvent("back") }, startSafe = startSafe, endSafe = endSafe)
        // What: `1.dp` reads "one density-independent pixel"; `.dp` is a property Kotlin adds to
        // numbers. `MaterialTheme.colorScheme.outline` is the theme's strong separator colour.
        // Why: The header is closed by the same line as the accepted Search and Settings headers.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // <hr style={{ height: 1, background: scheme.outline }}/>
        // ```
        HorizontalDivider(thickness = 1.dp, color = MaterialTheme.colorScheme.outline)
        // What: `weight(1f)` gives this column the height left under the header; `1f` is a 32-bit
        // floating-point literal. `verticalScroll(scroll)` lets its content move, and the content is
        // padded by the navigation bar's height.
        // Why: The last row can be scrolled clear of the system navigation bar.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 'env(safe-area-inset-bottom)' }}>{body}</div>
        // ```
        Column(modifier = Modifier.weight(1f).fillMaxWidth().verticalScroll(scroll)
            .windowInsetsPadding(WindowInsets.navigationBars)) {
            TemplateEditorSectionHeading(text = "Templates", startSafe = startSafe, endSafe = endSafe, bottom = 8.dp)
            // What: `ListItem` takes its parts as named lambdas ("slots"): a headline and a supporting
            // line. `clickable` makes the whole row one action with the Button role and merges the two
            // texts into one accessibility element.
            // Why: One tap anywhere on the row opens the editor, and the row is announced as one button.
            // Gotcha: `startSafe - 16.dp` subtracts two Dp values. Kotlin lets a type define what `-`
            // means (operator overloading); TypeScript has no such mechanism, so read it as plain number
            // subtraction. The subtraction assumes the list item's own 16dp side padding.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // <ListItem role="button" onClick={() => onEvent('open')} headline={entry.title} supporting={entry.supporting}
            //   style={{ paddingLeft: startSafe - 16, paddingRight: endSafe - 16, background: 'transparent' }}/>
            // ```
            ListItem(
                headlineContent = { Text(text = fixture.listEntry.title) },
                modifier = Modifier.fillMaxWidth()
                    .clickable(role = Role.Button, onClick = { onEvent("open") })
                    .padding(start = startSafe - 16.dp, end = endSafe - 16.dp),
                supportingContent = { Text(text = fixture.listEntry.supporting) },
                // `Color.Transparent` gives the row no fill of its own, so the page colour shows through.
                colors = ListItemDefaults.colors(containerColor = Color.Transparent),
            )
            // `outlineVariant` is the theme's quiet separator colour, used between rows.
            HorizontalDivider(thickness = 1.dp, color = MaterialTheme.colorScheme.outlineVariant)
        }
    }
}

/**
 * What: A composable draws the editor page: status spacer, header, separator, then one scrolling
 * column holding the template field, the field list and the way back to the default. The preview
 * is drawn in one of three places, named by `fixture.layout`: `flow` puts its heading and both rows
 * at the start of the scrolling column; `rows` pins both rows between the header and the scrolling
 * column; `lines` pins only each row's supporting line there. The page also scrolls its body to an
 * authored position. It takes the same inputs as the list page.
 * Why: The same page serves the cover's full-width page and the inner panel's right half; only the
 * caller-supplied insets differ. Typing, inserting a field and resetting are not connected: they
 * emit an event name and change nothing, because this study draws authored states only. The three
 * layouts are alternatives to compare with the keyboard open, where the `flow` preview can scroll
 * out of view, and the authored position makes every capture of one state rest on the same pixels.
 * `templateEditorLayout` and `templateEditorPosition` are what limit a launch to the names read here.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function TemplateEditorPage(input: { modifier: Modifier; startSafe: number; endSafe: number; pageColor: Color;
 *   fixture: TemplateEditorFixture; onEvent: (event: string) => void; onMeasure: (line: string) => void }): UIElement;
 * ```
 */
@Composable
internal fun TemplateEditorPage(modifier: Modifier, startSafe: Dp, endSafe: Dp, pageColor: Color,
    fixture: TemplateEditorFixture, onEvent: (String) -> Unit, onMeasure: (String) -> Unit) {
    // One remembered scroll state for the editor body.
    val scroll = rememberScrollState()
    // Log the hidden extent once the first layout has measured it.
    LaunchedEffect(scroll.maxValue) {
        if (scroll.maxValue != Int.MAX_VALUE) onMeasure("TemplateEditor.scroll:max=${scroll.maxValue}")
    }
    // What: `mutableIntStateOf(-1)` makes an observable box holding one Int, here -1 for "not
    // measured yet"; `remember { ... }` keeps the same box across redraws. Its sibling is
    // `mutableStateOf(-1)`, a box for a value of any type.
    // Why: The top edge of the template field block is only known once layout has run, which is
    // after this function, so layout writes it into a box and the page redraws with the number.
    // `mutableIntStateOf` (not `mutableStateOf`) is the form made for a plain whole number, and it
    // is read and written through `.intValue` with no further syntax.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const [blockTop, setBlockTop] = useState(-1);
    // ```
    val blockTop = remember { mutableIntStateOf(-1) }
    // The block's bottom edge is kept the same way, and is -1 until the first layout.
    val blockBottom = remember { mutableIntStateOf(-1) }
    // What: `LocalDensity.current` reads the screen's pixels-per-dp from the surrounding UI tree.
    // `with(x) { ... }` runs its block with `x` in scope, which is what lets `8.dp.roundToPx()`
    // turn 8dp into a whole number of pixels there.
    // Why: Scroll positions are counted in pixels, so the 8dp gap kept under the field's lines
    // must be counted in pixels too.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const margin = Math.round(8 * density);
    // ```
    val margin: Int = with(LocalDensity.current) { 8.dp.roundToPx() }
    // What: `.intValue` reads the whole number out of its box.
    // Why: The scroll rule works on plain numbers read once per redraw, and a redraw happens
    // whenever one of them changes.
    // Gotcha: `top = 8.dp` inside a `padding(...)` call in this function is an argument passed by
    // name, not an assignment to this `top`; the two never touch.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const top = blockTop;
    // ```
    val top: Int = blockTop.intValue
    // The block's bottom edge, read the same way.
    val bottom: Int = blockBottom.intValue
    // `viewportSize` is the height of the scrolling window in pixels; it is 0 until the first layout.
    val viewport: Int = scroll.viewportSize
    // How many pixels the body can scroll; `Int.MAX_VALUE` until the first layout has measured it.
    val maxScroll: Int = scroll.maxValue
    // What: `LaunchedEffect(a, b, c, d) { ... }` reruns its block whenever any listed value
    // changes. `scroll.scrollTo(n)` moves the body to n pixels at once, with no animation; it is a
    // suspending call, Kotlin's counterpart of an awaited async call, which is why it sits inside
    // an effect. `minOf` and `maxOf` are `Math.min` and `Math.max`.
    // Why: This is the page's authored scroll rule, and it decides the resting position in place
    // of whatever Compose would pick when the keyboard opens. A state launched at position `end`
    // rests on the body's last pixel. Any other state with a focused field scrolls just far enough
    // that the field's own lines (its error lines or typing help) clear the keyboard by 8dp, but
    // never so far that the field's top edge leaves the window. An unfocused state at position
    // `top` is left where it starts. The block reruns while the keyboard slides in, because the
    // window height and the scroll range change on every frame, so it settles on the final
    // geometry. Each applied scroll leaves one line for capture scripts.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // useEffect(() => { void (async () => {
    //   const measured = maxScroll !== 2147483647;
    //   if (fixture.position === 'end') {
    //     if (measured && maxScroll > 0) { await scroll.scrollTo(maxScroll); onMeasure(`TemplateEditor.scroll:rule=end ...`); }
    //   } else if (fixture.caret >= 0 && top >= 0 && bottom >= 0 && viewport > 0 && measured) {
    //     const wanted = Math.min(top, Math.max(0, bottom + margin - viewport));
    //     const target = Math.min(maxScroll, Math.max(0, wanted));
    //     await scroll.scrollTo(target); onMeasure(`TemplateEditor.scroll:rule=lines ...`);
    //   }
    // })(); }, [top, bottom, viewport, maxScroll]);
    // ```
    LaunchedEffect(top, bottom, viewport, maxScroll) {
        // Nothing may be scrolled or logged against a range the first layout has not measured yet.
        val measured: Boolean = maxScroll != Int.MAX_VALUE
        if (fixture.position == "end") {
            // The end is scrolled to only once there is a measured, non-empty range to scroll through.
            if (measured && maxScroll > 0) {
                scroll.scrollTo(maxScroll)
                onMeasure(
                    "TemplateEditor.scroll:rule=end target=$maxScroll viewport=$viewport top=$top bottom=$bottom")
            }
        } else if (fixture.caret >= 0 && top >= 0 && bottom >= 0 && viewport > 0 && measured) {
            // The smallest scroll that shows the block's bottom edge plus the margin, capped so the
            // block's top edge stays inside the window.
            val wanted: Int = minOf(top, maxOf(0, bottom + margin - viewport))
            // Kept inside the range the body can actually scroll.
            val target: Int = minOf(maxScroll, maxOf(0, wanted))
            scroll.scrollTo(target)
            onMeasure(
                "TemplateEditor.scroll:rule=lines target=$target viewport=$viewport top=$top bottom=$bottom")
        }
    }
    // The page is one column: status spacer, header, separator, a pinned preview in two of the
    // three layouts, then the scrolling body.
    Column(modifier = modifier.fillMaxSize().background(pageColor)) {
        // Status-bar spacer, as on the list page.
        Box(modifier = Modifier.fillMaxWidth().windowInsetsTopHeight(WindowInsets.statusBars))
        // This page's Back target returns to the Settings page.
        TemplateEditorHeader(title = "Supporting line", backDescription = "Back to Settings",
            onBack = { onEvent("back") }, startSafe = startSafe, endSafe = endSafe)
        // The strong separator that closes the header.
        HorizontalDivider(thickness = 1.dp, color = MaterialTheme.colorScheme.outline)
        // What: An `if` with no `else` draws its block for the `rows` layout only. The block sits
        // between the header's separator and the scrolling column, so it is not part of what scrolls.
        // Why: Pinned here, the two preview rows stay in view however far the body is scrolled and
        // however much of the window the keyboard takes. The layout draws no `Preview` heading: the
        // rows sit directly under the page title.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // {fixture.layout === 'rows' && <>
        //   {fixture.previewRows.map((row, index) => <>{index > 0 && <QuietDivider/>}<PreviewRow row={row}/></>)}
        //   <StrongDivider/>
        // </>}
        // ```
        if (fixture.layout == "rows") {
            // What: `0 until n` is the run of whole numbers from 0 up to but not including n, and
            // `for (index in ...)` visits each of them; `previewRows[index]` reads one entry by position.
            // Why: The quiet separator belongs between the rows, so it is drawn before every row
            // except the first, and that takes the row's position, not only the row.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // for (let index = 0; index < fixture.previewRows.length; index += 1) { ... }
            // ```
            for (index in 0 until fixture.previewRows.size) {
                // `outlineVariant` is the quiet separator colour, as between the list page's rows.
                if (index > 0) HorizontalDivider(thickness = 1.dp, color = MaterialTheme.colorScheme.outlineVariant)
                TemplateEditorPreviewRowView(row = fixture.previewRows[index], startSafe = startSafe,
                    endSafe = endSafe)
            }
            // The block is closed by the strong separator, because page content scrolls under this edge.
            HorizontalDivider(thickness = 1.dp, color = MaterialTheme.colorScheme.outline)
        }
        // What: The `lines` layout pins a plain Column with one `Text` per preview row and nothing
        // else: no heading and no titles.
        // Why: Only the lines the template yields are kept in view, which takes the least height
        // from the window the keyboard leaves.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // {fixture.layout === 'lines' && <>
        //   <div style={{ padding: `8px ${endSafe}px 8px ${startSafe}px` }}>
        //     {fixture.previewRows.map(row => <p className="supporting">{row.supporting}</p>)}
        //   </div>
        //   <StrongDivider/>
        // </>}
        // ```
        if (fixture.layout == "lines") {
            // The block keeps the page's side insets, with 8dp over its first line and under its last.
            Column(modifier = Modifier.fillMaxWidth()
                .padding(start = startSafe, end = endSafe, top = 8.dp, bottom = 8.dp)) {
                // What: A `for (row in rows)` loop emits one element per list entry, like `rows.map(...)` in JSX.
                // Why: The lines are drawn in the order of the authored rows, first file first.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // {fixture.previewRows.map(row => <p>{row.supporting}</p>)}
                // ```
                for (row in fixture.previewRows) {
                    // What: `Text` draws one string in the colour and type roles that
                    // `TemplateEditorPreviewRowView` gives a row's supporting line; `maxLines = 1` with
                    // `TextOverflow.Ellipsis` cuts a long line with "…".
                    // Why: Unlike the row view, this draws the text even when it is empty. An empty
                    // line keeps its height, so the second file's line never moves up into the place
                    // of the first one's.
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // <p style={{ color: scheme.onSurfaceVariant, font: type.bodySmall, whiteSpace: 'nowrap', textOverflow: 'ellipsis', minHeight: '1lh' }}>{row.supporting}</p>
                    // ```
                    Text(text = row.supporting, color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodySmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
            // The same strong separator closes this block.
            HorizontalDivider(thickness = 1.dp, color = MaterialTheme.colorScheme.outline)
        }
        // What: `imePadding()` shrinks this column by the software keyboard's height while it is
        // open. It comes before `verticalScroll`, so it is the scrolling window itself that shrinks,
        // not padding added inside the scrolled content. The navigation-bar padding after the scroll
        // covers the closed case. `weight(1f)` gives the column the height the header and a pinned
        // preview leave.
        // Why: With the padding inside the content the window would keep its height and the keyboard
        // would simply cover the focused template field. Shrinking the window is also what the
        // authored scroll rule reads as `viewportSize`, and a pinned preview sits outside this
        // column, so the keyboard takes height from the scrolling window only.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // <div style={{ flex: 1, marginBottom: keyboardHeight, overflowY: 'auto' }}>
        //   <div style={{ paddingBottom: navigationBarHeight }}>{body}</div>
        // </div>
        // ```
        Column(modifier = Modifier.weight(1f).fillMaxWidth().imePadding().verticalScroll(scroll)
            .windowInsetsPadding(WindowInsets.navigationBars)) {
            // The `flow` layout draws the preview here, where it scrolls with the rest of the body.
            if (fixture.layout == "flow") {
                TemplateEditorSectionHeading(text = "Preview", startSafe = startSafe, endSafe = endSafe,
                    bottom = 4.dp)
                // The two authored rows are drawn in order, each closed by a quiet separator.
                for (row in fixture.previewRows) {
                    TemplateEditorPreviewRowView(row = row, startSafe = startSafe, endSafe = endSafe)
                    HorizontalDivider(thickness = 1.dp, color = MaterialTheme.colorScheme.outlineVariant)
                }
            }
            // What: `Text` draws one string; `color` and `style` name a theme colour role and a theme
            // type role instead of fixed values.
            // Why: The note says where the rows come from, in the quiet role D35 gives supporting text.
            // In the `rows` and `lines` layouts it is the first thing in the scrolling column.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // <p style={{ color: scheme.onSurfaceVariant, font: type.bodySmall, padding: `8px ${endSafe}px 16px ${startSafe}px` }}>{fixture.previewNote}</p>
            // ```
            Text(text = fixture.previewNote,
                modifier = Modifier.padding(start = startSafe, end = endSafe, top = 8.dp, bottom = 16.dp),
                color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
            // What: A `Box` with a trailing lambda wraps its child and takes the child's size.
            // `onPlaced { coordinates -> ... }` runs its lambda each time layout has positioned the
            // box. `positionInParent()` is the box's top-left corner measured from the content of
            // the scrolling column, so its `y` does not change when the body scrolls. `y` is a Float,
            // a 32-bit fractional number whose sibling is the 64-bit Double, and `roundToInt()`
            // rounds it to the nearest whole pixel. `coordinates.size.height` is the box's height in
            // whole pixels, and `.intValue = ...` writes a number into its box.
            // Why: The scroll rule needs the top and the bottom edge of the whole field block, its
            // error lines or typing help included, and only layout knows them.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // <div ref={element => { if (element) { setBlockTop(element.offsetTop); setBlockBottom(element.offsetTop + element.offsetHeight); } }}>
            //   <TemplateField/>
            // </div>
            // ```
            Box(modifier = Modifier.onPlaced { coordinates ->
                // The block's top edge, in whole pixels from the start of the scrolled content.
                val placedTop: Int = coordinates.positionInParent().y.roundToInt()
                blockTop.intValue = placedTop
                // The bottom edge is the top edge plus the block's measured height.
                blockBottom.intValue = placedTop + coordinates.size.height
            }) {
                TemplateEditorTemplateField(fixture = fixture, onMeasure = onMeasure, startSafe = startSafe,
                    endSafe = endSafe)
            }
            TemplateEditorSectionHeading(text = "Fields", startSafe = startSafe, endSafe = endSafe, bottom = 4.dp)
            // One row per insertable field, each closed by a quiet separator.
            for (field in fixture.fields) {
                TemplateEditorFieldRow(field = field, onEvent = onEvent, startSafe = startSafe, endSafe = endSafe)
                HorizontalDivider(thickness = 1.dp, color = MaterialTheme.colorScheme.outlineVariant)
            }
            // What: `TextButton` draws a label-only button, and the `if` around it leaves it out
            // entirely when there is nothing to reset. `defaultMinSize(minHeight = 48.dp)` keeps its
            // touch target at least 48dp tall.
            // Why: The way back to the default is offered only when the template is not the default.
            // A disabled button would differ from an enabled one by its dimmed colour alone; leaving
            // it out says the same thing by presence, which does not rest on colour.
            // Its label lines up with the text column: the installed Material 3 text button pads its
            // label by 12dp on each side, so the button itself starts 12dp before `startSafe`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // {fixture.resetEnabled && <button onClick={() => onEvent('reset')}
            //   style={{ marginLeft: startSafe - 12, minHeight: 48 }}>Reset to default</button>}
            // ```
            if (fixture.resetEnabled) {
                TextButton(onClick = { onEvent("reset") },
                    modifier = Modifier.padding(start = startSafe - 12.dp, top = 8.dp, bottom = 16.dp)
                        .defaultMinSize(minHeight = 48.dp)) {
                    Text(text = "Reset to default")
                }
            }
        }
    }
}

/**
 * What: A private composable draws the page-level header shared by both pages: a 48dp Back target
 * and the page title. `() -> Unit` is a function type taking nothing and returning nothing.
 * Why: It repeats the accepted Settings header's geometry (72dp high, on the high container
 * surface), so both pages read as the same kind of destination and return the same way.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function TemplateEditorHeader(input: { title: string; backDescription: string; onBack: () => void;
 *   startSafe: number; endSafe: number }): UIElement;
 * ```
 */
@Composable
private fun TemplateEditorHeader(title: String, backDescription: String, onBack: () -> Unit,
    startSafe: Dp, endSafe: Dp) {
    // What: A Row places its children side by side; `Alignment.CenterVertically` centres them on
    // the row's height. `surfaceContainerHigh` is the theme's raised-surface colour.
    // Why: The Back target and the title share one 72dp band kept clear of the fold connector.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // <div style={{ display: 'flex', alignItems: 'center', height: 72, background: scheme.surfaceContainerHigh }}>{children}</div>
    // ```
    Row(modifier = Modifier.fillMaxWidth().height(72.dp)
        .background(MaterialTheme.colorScheme.surfaceContainerHigh)
        .padding(start = startSafe, end = endSafe), verticalAlignment = Alignment.CenterVertically) {
        // A 48dp icon-only button; its trailing lambda supplies the glyph.
        IconButton(onClick = onBack, modifier = Modifier.size(48.dp)) {
            // What: `contentDescription` is the name assistive technology reads for the glyph; `tint`
            // is the colour the glyph is drawn in, here the theme's text-on-page role.
            // Why: Each page names where its Back target leads, and the glyph stays readable in the
            // dark theme instead of taking an inherited black.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // <ArrowBackIcon aria-label={backDescription} style={{ color: scheme.onSurface }}/>
            // ```
            Icon(imageVector = Icons.Filled.ArrowBack, contentDescription = backDescription,
                tint = MaterialTheme.colorScheme.onSurface)
        }
        // What: `semantics { heading() }` marks this text as a heading; `weight(1f)` gives it the
        // remaining width; `maxLines = 1` with `TextOverflow.Ellipsis` cuts a long title with "…".
        // Why: The title truncates on one line inside the fixed header instead of pushing the Back target.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // <h1 style={{ flex: 1, whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{title}</h1>
        // ```
        Text(text = title, modifier = Modifier.weight(1f).padding(start = 8.dp).semantics { heading() },
            color = MaterialTheme.colorScheme.onSurface, style = MaterialTheme.typography.titleLarge,
            maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

/**
 * What: A private composable draws one section heading in the label type role and the quiet text
 * colour, marked as a heading for assistive technology.
 * Why: `Templates`, `Preview` and `Fields` share one style and one top inset; only the gap under
 * the heading differs, so the caller passes it.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function TemplateEditorSectionHeading(input: { text: string; startSafe: number; endSafe: number; bottom: number }): UIElement;
 * ```
 */
@Composable
private fun TemplateEditorSectionHeading(text: String, startSafe: Dp, endSafe: Dp, bottom: Dp) {
    // The heading sits 16dp under whatever precedes it and keeps the page's side insets.
    Text(text = text,
        modifier = Modifier.padding(start = startSafe, end = endSafe, top = 16.dp, bottom = bottom)
            .semantics { heading() },
        color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelLarge)
}

/**
 * What: A private composable draws one preview row the way a track row is drawn: a title and,
 * under it, the supporting line the template yields. The row has no click handler.
 * Why: The preview shows the template's result in the place it will appear, and it is a picture of
 * a row, not a control, so it must not look or act tappable.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function TemplateEditorPreviewRowView(input: { row: TemplateEditorPreviewRow; startSafe: number; endSafe: number }): UIElement;
 * ```
 */
@Composable
private fun TemplateEditorPreviewRowView(row: TemplateEditorPreviewRow, startSafe: Dp, endSafe: Dp) {
    // What: `heightIn(min = 56.dp)` sets a minimum height; `Arrangement.Center` centres the texts
    // in a row taller than they are. With 8dp of top and bottom padding the two lines make exactly
    // 56dp at the default text size.
    // Why: The row keeps a track row's height, and larger text grows it instead of being clipped.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // <div style={{ minHeight: 56, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: `8px ${endSafe}px 8px ${startSafe}px` }}>{lines}</div>
    // ```
    Column(modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp)
        .padding(start = startSafe, end = endSafe, top = 8.dp, bottom = 8.dp),
        verticalArrangement = Arrangement.Center) {
        // The title uses the page's main text role on one line, cut with an ellipsis.
        Text(text = row.title, color = MaterialTheme.colorScheme.onSurface,
            style = MaterialTheme.typography.bodyLarge, maxLines = 1, overflow = TextOverflow.Ellipsis)
        // A template may yield nothing for a file; the row then draws no second line at all.
        if (row.supporting != "") {
            // The supporting line uses the quiet role D35 gives it, on one line.
            Text(text = row.supporting, color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodySmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

/**
 * What: A private composable draws the template field: an outlined text field labelled `Template`
 * holding the authored text in a monospace face, with error lines or typing help under it.
 * Why: The field shows each authored state exactly, including where the caret is, and typing is
 * deliberately not connected, so no keystroke can show a result the reference did not compute.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function TemplateEditorTemplateField(input: { fixture: TemplateEditorFixture; onMeasure: (line: string) => void;
 *   startSafe: number; endSafe: number }): UIElement;
 * ```
 */
@Composable
private fun TemplateEditorTemplateField(fixture: TemplateEditorFixture, onMeasure: (String) -> Unit,
    startSafe: Dp, endSafe: Dp) {
    // A caret position of -1 means the authored state has no focus in the field.
    val focused: Boolean = fixture.caret >= 0
    // What: `remember { ... }` runs its block the first time this element is drawn and returns the
    // same object on every later redraw. `FocusRequester()` constructs a focus handle.
    // Why: The handle given to the field must be the same one the focus effect uses.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const requester = useRef(new FocusRequester()).current;
    // ```
    val requester = remember { FocusRequester() }
    // What: `LocalSoftwareKeyboardController.current` reads a value the surrounding UI tree provides,
    // here the window's keyboard controller, or null where the window has none.
    // Why: A focused authored state is captured with the keyboard open, as it is while typing.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const keyboard = useContext(SoftwareKeyboardContext);
    // ```
    val keyboard = LocalSoftwareKeyboardController.current
    // What: `LaunchedEffect(Unit)` runs its block once, when this element first appears; `Unit` is a
    // constant that never changes. `keyboard?.show()` calls `show` only when `keyboard` is not null.
    // Why: A focused state takes focus and asks for the keyboard exactly once; an unfocused state
    // never does. The line logged either way lets a capture check which of the two it got.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // useEffect(() => { if (focused) { requester.requestFocus(); keyboard?.show(); } onMeasure(`TemplateEditor.focus:field=${focused}`); }, []);
    // ```
    LaunchedEffect(Unit) {
        if (focused) {
            requester.requestFocus()
            keyboard?.show()
        }
        onMeasure("TemplateEditor.focus:field=$focused")
    }
    // What: `if`/`else` is an expression that yields a value, like TypeScript's `cond ? a : b`.
    // Why: A focused state puts the caret where it was authored; otherwise it rests at the end.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const caret = focused ? fixture.caret : fixture.template.length;
    // ```
    val caret: Int = if (focused) fixture.caret else fixture.template.length
    // What: `TextFieldValue` pairs the text with a selection; `TextRange(caret)` is an empty
    // selection at one position, which is a caret.
    // Why: A plain string could not say where the caret is, and the help shown depends on it.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const value = { text: fixture.template, selectionStart: caret, selectionEnd: caret };
    // ```
    val value = TextFieldValue(text = fixture.template, selection = TextRange(caret))
    // What: `OutlinedTextField` draws the field. `onValueChange = {}` is a lambda that ignores every
    // edit, so the field always shows `value`. `bodyLarge.copy(fontFamily = FontFamily.Monospace)`
    // makes a copy of the theme's body style with only its font family replaced. `isError` switches
    // the outline and label to the error colour. `focusRequester(requester)` attaches the handle.
    // Why: A template is code, and a monospace face keeps brackets and dollar signs easy to count.
    // The field fills the width between the page's side insets.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // <TextField ref={requester} label="Template" value={value} onChange={() => {}} aria-invalid={fixture.errors.length > 0}
    //   style={{ fontFamily: 'monospace' }} supporting={templateEditorSupporting(fixture)}/>
    // ```
    OutlinedTextField(value = value, onValueChange = {},
        modifier = Modifier.fillMaxWidth().padding(start = startSafe, end = endSafe).focusRequester(requester),
        textStyle = MaterialTheme.typography.bodyLarge.copy(fontFamily = FontFamily.Monospace),
        label = { Text(text = "Template") },
        supportingText = templateEditorSupporting(fixture),
        isError = fixture.errors.isNotEmpty())
}

/**
 * What: A private function returns what the field draws under itself, as a UI-building function,
 * or null for nothing. `(@Composable () -> Unit)?` is a nullable function type: a composable
 * taking no arguments, or null.
 * Why: Mistakes take the place of typing help, help shows only when there are no mistakes, and a
 * null result makes the field reserve no supporting line at all.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function templateEditorSupporting(fixture: TemplateEditorFixture): (() => UIElement) | null;
 * ```
 */
private fun templateEditorSupporting(fixture: TemplateEditorFixture): (@Composable () -> Unit)? {
    // What: `return { ... }` returns a lambda; nothing inside it runs until the field calls it.
    // Why: The field decides where and when its supporting content is drawn.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (fixture.errors.length > 0) return () => <ErrorLines lines={fixture.errors}/>;
    // ```
    if (fixture.errors.isNotEmpty()) return { TemplateEditorErrorLines(lines = fixture.errors) }
    // What: val binds the nullable help record; after `help != null` Kotlin treats `help` as present.
    // Why: The help lines need a record that is certainly there, without a second lookup.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const help = fixture.help; if (help !== null) return () => <HelpLines help={help}/>;
    // ```
    val help: TemplateEditorHelp? = fixture.help
    if (help != null) return { TemplateEditorHelpLines(help = help) }
    // No mistakes and no help: the field draws nothing under itself.
    return null
}

/**
 * What: A private composable draws one row per mistake: an error icon, then the line.
 * Why: Each mistake is marked by an icon, by the error colour and by its own words, so the state
 * never rests on colour alone.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function TemplateEditorErrorLines(input: { lines: readonly string[] }): UIElement;
 * ```
 */
@Composable
private fun TemplateEditorErrorLines(lines: List<String>) {
    // A Column with no modifier is only as large as the rows it stacks.
    Column {
        // One row per error line, in the order the reference reports them.
        for (line in lines) {
            // A Row's children start at its top edge, so the icon stays beside the first text line.
            Row {
                // What: `contentDescription = null` marks the icon as decoration for assistive
                // technology; `size(16.dp)` fixes its square size; `error` is the theme's error colour.
                // Why: The words beside it already say what is wrong, so the icon is not read twice.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // <ErrorIcon aria-hidden="true" style={{ width: 16, height: 16, color: scheme.error }}/>
                // ```
                Icon(imageVector = Icons.Filled.Error, contentDescription = null,
                    modifier = Modifier.size(16.dp), tint = MaterialTheme.colorScheme.error)
                // The line keeps a 4dp gap from its icon and wraps freely at large text.
                Text(text = line, modifier = Modifier.padding(start = 4.dp),
                    color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

/**
 * What: A private composable draws the typing help: the call's signature on one line with the
 * parameter the caret is in set in bold, then the sentence describing that parameter.
 * Why: The signature is code, so it shares the field's monospace face; the description is prose.
 * The bold word says which argument is being typed by weight, as KWGT's editor does, so that
 * does not rest on the description alone.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function TemplateEditorHelpLines(input: { help: TemplateEditorHelp }): UIElement;
 * ```
 */
@Composable
private fun TemplateEditorHelpLines(help: TemplateEditorHelp) {
    // What: `indexOf` finds where the parameter's name starts inside the signature, or gives -1.
    // Why: The name is authored copy and the signature is authored copy; if they ever disagree the
    // signature is drawn without a bold word instead of failing, and the capture's copy check
    // against the reference is what catches the disagreement.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const start = help.signature.indexOf(help.parameter);
    // ```
    val start: Int = help.signature.indexOf(help.parameter)
    // What: `buildAnnotatedString { ... }` assembles one text from parts; `append` adds a part, and
    // `withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { ... }` adds its part in bold.
    // `substring(a, b)` is the slice from a up to but not including b.
    // Why: The drawn characters stay exactly the signature; only the weight of one word changes.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const signature = start < 0 ? [help.signature]
    //   : [help.signature.slice(0, start), <b>{help.parameter}</b>, help.signature.slice(start + help.parameter.length)];
    // ```
    val signature = buildAnnotatedString {
        if (start < 0) {
            append(help.signature)
        } else {
            append(help.signature.substring(0, start))
            withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append(help.parameter) }
            append(help.signature.substring(start + help.parameter.length))
        }
    }
    // The signature and its description are stacked, signature first.
    Column {
        // `fontFamily = FontFamily.Monospace` replaces only the face of the small body style.
        Text(text = signature, color = MaterialTheme.colorScheme.onSurfaceVariant,
            fontFamily = FontFamily.Monospace, style = MaterialTheme.typography.bodySmall,
            maxLines = 1, overflow = TextOverflow.Ellipsis)
        // The description wraps freely under the signature.
        Text(text = help.description, color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodySmall)
    }
}

/**
 * What: A private composable draws one insertable field as a Material 3 list item: its name, its
 * value for the first preview file, and at the end the call a tap would insert.
 * Why: The row teaches the field by showing a real value beside its name, and the whole row is one
 * button, so the call text at its end is part of the same action and not a second target.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function TemplateEditorFieldRow(input: { field: TemplateEditorField; onEvent: (event: string) => void;
 *   startSafe: number; endSafe: number }): UIElement;
 * ```
 */
@Composable
private fun TemplateEditorFieldRow(field: TemplateEditorField, onEvent: (String) -> Unit,
    startSafe: Dp, endSafe: Dp) {
    // A field with no value for this file says so in words instead of leaving a blank line.
    val shownValue: String = if (field.value == "") "No value yet" else field.value
    // The row is one button; `clickable` merges its three texts into one accessibility element.
    ListItem(
        headlineContent = { Text(text = field.label) },
        modifier = Modifier.fillMaxWidth()
            .clickable(role = Role.Button, onClick = { onEvent("insert:" + field.insert) })
            .padding(start = startSafe - 16.dp, end = endSafe - 16.dp),
        // A long value, such as a path, is cut with an ellipsis instead of growing the row.
        supportingContent = { Text(text = shownValue, maxLines = 1, overflow = TextOverflow.Ellipsis) },
        // The trailing slot sits at the row's end and shows the call in the field's monospace face.
        trailingContent = {
            Text(text = field.insert, color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontFamily = FontFamily.Monospace, style = MaterialTheme.typography.labelLarge)
        },
        // No fill of its own, so the page colour shows through.
        colors = ListItemDefaults.colors(containerColor = Color.Transparent),
    )
}
//endregion
