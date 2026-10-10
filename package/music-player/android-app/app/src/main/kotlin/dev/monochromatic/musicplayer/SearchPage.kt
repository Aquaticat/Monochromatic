// The stateless Search page. The folded cover shows a full-width Search destination with no deck (D76). The
// unfolded inner panel keeps the retained folder browser and playback deck on the left and puts the Search header
// and results on the right (D51), with the crease kept clear of information (E2).

// What:     `package dev.monochromatic.musicplayer` places the Search page beside the player composables.
// Why:      The page sits next to the player screen it shares its layout width rule and glyphs with.
//
// In TS you'd write (pseudocode):
// ```ts
// // Module identity comes from the file path.
// ```
package dev.monochromatic.musicplayer

// What:     `import androidx.compose.foundation.background` paints the canvas and header fills.
// Why:      Each region is a flat M3 role, so a background modifier is the whole styling step.
//
// In TS you'd write (pseudocode):
// ```ts
// import { background } from "compose/foundation";
// ```
import androidx.compose.foundation.background

// What:     `import androidx.compose.foundation.clickable` makes each result row one activatable target.
// Why:      The row is the single action target, so the click handler and its label live on one modifier (D77).
//
// In TS you'd write (pseudocode):
// ```ts
// import { clickable } from "compose/foundation";
// ```
import androidx.compose.foundation.clickable

// What:     `import androidx.compose.foundation.isSystemInDarkTheme` reads the system appearance.
// Why:      Dark mode uses the true-black canvas and the dark emphasis mix (D59).
//
// In TS you'd write (pseudocode):
// ```ts
// import { isSystemInDarkTheme } from "compose/foundation";
// ```
import androidx.compose.foundation.isSystemInDarkTheme

// What:     `import androidx.compose.foundation.layout.Arrangement` centers the cover status vertically.
// Why:      The cover status sits in the middle of the remaining height, as in the reviewed capture.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Arrangement } from "compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.Arrangement

// What:     `import androidx.compose.foundation.layout.Box` stacks a status or list over its region.
// Why:      Each region of the page is a box whose content is chosen by the search state.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Box } from "compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.Box

// What:     `import androidx.compose.foundation.layout.BoxWithConstraints` measures the available width.
// Why:      The cover or inner arrangement is chosen from the width this page actually receives (D49).
//
// In TS you'd write (pseudocode):
// ```ts
// import { BoxWithConstraints } from "compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.BoxWithConstraints

// What:     `import androidx.compose.foundation.layout.Column` stacks the header, divider, and list.
// Why:      The page is a vertical stack on the cover and a vertical stack in each inner pane.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Column } from "compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.Column

// What:     `import androidx.compose.foundation.layout.Row` places the header and the two inner panes.
// Why:      The inner layout puts the browser and deck beside the Search pane.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Row } from "compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.Row

// What:     `import androidx.compose.foundation.layout.WindowInsets` reads the system and keyboard insets.
// Why:      The page reads the status bar, navigation bar, and keyboard insets it must keep clear (D56).
//
// In TS you'd write (pseudocode):
// ```ts
// import { WindowInsets } from "compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.WindowInsets

// What:     `import androidx.compose.foundation.layout.ime` names the software keyboard inset.
// Why:      The cover result list is padded by the keyboard height so its last row stays reachable (D56).
//
// In TS you'd write (pseudocode):
// ```ts
// import { ime } from "compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.ime

// What:     `import androidx.compose.foundation.layout.imePadding` lifts the unfolded layout above the keyboard.
// Why:      The deck must stay visible above the keyboard while typing (D51).
//
// In TS you'd write (pseudocode):
// ```ts
// import { imePadding } from "compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.imePadding

// What:     `import androidx.compose.foundation.layout.fillMaxHeight` makes each inner pane the full height.
// Why:      The panes span the whole screen height beside each other.
//
// In TS you'd write (pseudocode):
// ```ts
// import { fillMaxHeight } from "compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.fillMaxHeight

// What:     `import androidx.compose.foundation.layout.fillMaxSize` fills the parent in both directions.
// Why:      The canvas, header and list use the whole region they are given.
//
// In TS you'd write (pseudocode):
// ```ts
// import { fillMaxSize } from "compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.fillMaxSize

// What:     `import androidx.compose.foundation.layout.fillMaxWidth` fills the parent width.
// Why:      The header, divider and status lines span the full pane width.
//
// In TS you'd write (pseudocode):
// ```ts
// import { fillMaxWidth } from "compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.fillMaxWidth

// What:     `import androidx.compose.foundation.layout.height` fixes the header height.
// Why:      The header uses the 72dp M3 Search header height.
//
// In TS you'd write (pseudocode):
// ```ts
// import { height } from "compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.height

// What:     `import androidx.compose.foundation.layout.heightIn` gives each result row its minimum height.
// Why:      A row keeps at least the 72dp list height, so each row remains a comfortable target.
//
// In TS you'd write (pseudocode):
// ```ts
// import { heightIn } from "compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.heightIn

// What:     `import androidx.compose.foundation.layout.navigationBars` names the bottom system bar inset.
// Why:      The last result must not sit under the gesture bar.
//
// In TS you'd write (pseudocode):
// ```ts
// import { navigationBars } from "compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.navigationBars

// What:     `import androidx.compose.foundation.layout.padding` applies margins to content.
// Why:      Each region insets its content from the crease and the screen edges.
//
// In TS you'd write (pseudocode):
// ```ts
// import { padding } from "compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.padding

// What:     `import androidx.compose.foundation.layout.size` fixes the 48dp touch targets and 24dp glyphs.
// Why:      Every action is at least 48dp, and every glyph is drawn at its nominal size.
//
// In TS you'd write (pseudocode):
// ```ts
// import { size } from "compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.size

// What:     `import androidx.compose.foundation.layout.statusBars` names the top system bar inset.
// Why:      The header starts below the real status bar, not a guessed height.
//
// In TS you'd write (pseudocode):
// ```ts
// import { statusBars } from "compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.statusBars

// What:     `import androidx.compose.foundation.layout.union` joins the keyboard and navigation insets.
// Why:      One inset covers the keyboard and the gesture bar without stacking two paddings.
//
// In TS you'd write (pseudocode):
// ```ts
// import { union } from "compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.union

// What:     `import androidx.compose.foundation.layout.windowInsetsPadding` pads by a chosen inset.
// Why:      The results list pads by the keyboard and navigation insets it must clear.
//
// In TS you'd write (pseudocode):
// ```ts
// import { windowInsetsPadding } from "compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.windowInsetsPadding

// What:     `import androidx.compose.foundation.layout.windowInsetsTopHeight` reserves the status bar height.
// Why:      The top spacer uses the measured status bar, so the header clears the real system bar.
//
// In TS you'd write (pseudocode):
// ```ts
// import { windowInsetsTopHeight } from "compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.windowInsetsTopHeight

// What:     `import androidx.compose.foundation.lazy.LazyColumn` lists up to the result limit of rows.
// Why:      A lazy list composes only the visible rows, so 500 results stay cheap to draw.
//
// In TS you'd write (pseudocode):
// ```ts
// import { LazyColumn } from "compose/foundation/lazy";
// ```
import androidx.compose.foundation.lazy.LazyColumn

// What:     `import androidx.compose.foundation.lazy.rememberLazyListState` owns the list's scroll position.
// Why:      The page scrolls the list back to its first row when the query changes.
//
// In TS you'd write (pseudocode):
// ```ts
// import { useLazyListState } from "compose/foundation/lazy";
// ```
import androidx.compose.foundation.lazy.rememberLazyListState

// What:     `import androidx.compose.foundation.lazy.items` adds the list overload of the lazy builder.
// Why:      The result rows come from a List, and the list overload keys each row by its identity.
//
// In TS you'd write (pseudocode):
// ```ts
// results.map(result => <Row key={searchResultKey(result)} />);
// ```
import androidx.compose.foundation.lazy.items

// What:     `import androidx.compose.foundation.text.BasicTextField` is the bare query field.
// Why:      The field sits inside the header with its own touch target, so no outlined container is needed.
//
// In TS you'd write (pseudocode):
// ```ts
// <input type="search" value={query} onInput={onQueryChange} />
// ```
import androidx.compose.foundation.text.BasicTextField

// What:     `import androidx.compose.foundation.text.KeyboardActions` names the IME action handler.
// Why:      The Search action on the keyboard does nothing, so the keyboard stays open (D63).
//
// In TS you'd write (pseudocode):
// ```ts
// const onSearch = () => {};
// ```
import androidx.compose.foundation.text.KeyboardActions

// What:     `import androidx.compose.foundation.text.KeyboardOptions` labels the keyboard action as Search.
// Why:      The IME action is Search, not playback, so the keyboard shows the search key.
//
// In TS you'd write (pseudocode):
// ```ts
// <input enterKeyHint="search" />
// ```
import androidx.compose.foundation.text.KeyboardOptions

// What:     `import androidx.compose.material3.HorizontalDivider` draws the header boundary.
// Why:      The 1dp outline divider separates the header from the status or results.
//
// In TS you'd write (pseudocode):
// ```ts
// <hr />
// ```
import androidx.compose.material3.HorizontalDivider

// What:     `import androidx.compose.material3.Icon` draws the glyphs with a scheme-aware tint.
// Why:      Icons take their color from the theme, so the page follows light and dark mode.
//
// In TS you'd write (pseudocode):
// ```ts
// <Icon name="search" />
// ```
import androidx.compose.material3.Icon

// What:     `import androidx.compose.material3.IconButton` gives each icon action a 48dp target.
// Why:      Back and Clear are real buttons with at least the 48dp minimum target.
//
// In TS you'd write (pseudocode):
// ```ts
// <button aria-label="Back" />
// ```
import androidx.compose.material3.IconButton

// What:     `import androidx.compose.material3.MaterialTheme` supplies the M3 color and type roles.
// Why:      The page uses the theme's surface, outline, and type roles rather than fixed colors.
//
// In TS you'd write (pseudocode):
// ```ts
// import { theme } from "material3";
// ```
import androidx.compose.material3.MaterialTheme

// What:     `import androidx.compose.material3.Text` draws the headline, detail, and result text.
// Why:      Every line of text uses an M3 type style so the page matches the rest of the app.
//
// In TS you'd write (pseudocode):
// ```ts
// <p>{text}</p>
// ```
import androidx.compose.material3.Text

// What:     `import androidx.compose.runtime.Composable` marks a function as a Compose layout description.
// Why:      Every function in this file that draws UI carries this annotation.
//
// In TS you'd write (pseudocode):
// ```ts
// type Component = () => JSX.Element;
// ```
import androidx.compose.runtime.Composable

// What:     `import androidx.compose.runtime.LaunchedEffect` runs the focus request after composition.
// Why:      The query field can take focus only after it is attached to the layout.
//
// In TS you'd write (pseudocode):
// ```ts
// useEffect(() => { input.focus(); }, []);
// ```
import androidx.compose.runtime.LaunchedEffect

// What:     `import androidx.compose.runtime.remember` keeps the focus requester across recomposition.
// Why:      A new focus requester on every frame would lose the field's focus binding.
//
// In TS you'd write (pseudocode):
// ```ts
// const ref = useRef(null);
// ```
import androidx.compose.runtime.remember

// What:     `import androidx.compose.ui.Alignment` centers the header row and the empty-state content.
// Why:      Icons and text sit on the vertical center line of their rows.
//
// In TS you'd write (pseudocode):
// ```ts
// // align-items: center
// ```
import androidx.compose.ui.Alignment

// What:     `import androidx.compose.ui.Modifier` describes layout and interaction for each region.
// Why:      Every composable here takes a modifier, and the caller sets the page size through it.
//
// In TS you'd write (pseudocode):
// ```ts
// // Modifier is a chain of style and handler wrappers.
// ```
import androidx.compose.ui.Modifier

// What:     `import androidx.compose.ui.focus.FocusRequester` requests focus for the query field.
// Why:      Entering Search focuses the field so the user can type at once (D63).
//
// In TS you'd write (pseudocode):
// ```ts
// const focusRequester = { focus: () => input.focus() };
// ```
import androidx.compose.ui.focus.FocusRequester

// What:     `import androidx.compose.ui.focus.focusRequester` binds the requester to the field.
// Why:      The requester can only focus the element it is attached to.
//
// In TS you'd write (pseudocode):
// ```ts
// <input ref={inputRef} />
// ```
import androidx.compose.ui.focus.focusRequester

// What:     `import androidx.compose.ui.graphics.Color` supplies the canvas, fill, and ink colors.
// Why:      The page paints its canvas and the emphasis fill with explicit colors.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { Color } from "compose/ui/graphics";
// ```
import androidx.compose.ui.graphics.Color

// What:     `import androidx.compose.ui.graphics.SolidColor` paints the text cursor.
// Why:      The cursor takes the primary role, as the rest of the app's inputs do.
//
// In TS you'd write (pseudocode):
// ```ts
// caret-color: var(--primary);
// ```
import androidx.compose.ui.graphics.SolidColor

// What:     `import androidx.compose.ui.platform.LocalDensity` converts the crease width into dp.
// Why:      The crease is a physical width, so its dp value depends on the current display density.
//
// In TS you'd write (pseudocode):
// ```ts
// const density = window.devicePixelRatio;
// ```
import androidx.compose.ui.platform.LocalDensity

// What:     `import androidx.compose.ui.platform.LocalSoftwareKeyboardController` shows the keyboard on entry.
// Why:      Entering Search opens the keyboard so typing starts at once (D63).
//
// In TS you'd write (pseudocode):
// ```ts
// input.focus();
// ```
import androidx.compose.ui.platform.LocalSoftwareKeyboardController

// What:     `import androidx.compose.ui.semantics.Role` marks each result row as a button for TalkBack.
// Why:      The row performs an action, so assistive technology must announce it as a button.
//
// In TS you'd write (pseudocode):
// ```ts
// <div role="button" />
// ```
import androidx.compose.ui.semantics.Role

// What:     `import androidx.compose.ui.semantics.contentDescription` names the query field and icon buttons.
// Why:      Icon-only controls and the field need an accessible name.
//
// In TS you'd write (pseudocode):
// ```ts
// <input aria-label="Search music" />
// ```
import androidx.compose.ui.semantics.contentDescription

// What:     `import androidx.compose.ui.semantics.semantics` attaches semantic properties to a modifier.
// Why:      The field name and the row merge are set through the semantics modifier.
//
// In TS you'd write (pseudocode):
// ```ts
// // element.setAttribute("aria-label", ...)
// ```
import androidx.compose.ui.semantics.semantics

// What:     `import androidx.compose.ui.semantics.stateDescription` speaks the current-track state of a row.
// Why:      The playing or paused state is structured speech, separate from the title (D77).
//
// In TS you'd write (pseudocode):
// ```ts
// el.setAttribute("aria-description", "Current track, playing");
// ```
import androidx.compose.ui.semantics.stateDescription

// What:     `import androidx.compose.ui.text.AnnotatedString` carries a title with its emphasized ranges.
// Why:      Each highlighted range is a span on the annotated string, so the text itself is unchanged.
//
// In TS you'd write (pseudocode):
// ```ts
// type AnnotatedString = { text: string; spans: StyledRange[] };
// ```
import androidx.compose.ui.text.AnnotatedString

// What:     `import androidx.compose.ui.text.SpanStyle` styles one highlighted range.
// Why:      Each match is painted with the accent fill and bold text (D59).
//
// In TS you'd write (pseudocode):
// ```ts
// { background: fill, fontWeight: 700 }
// ```
import androidx.compose.ui.text.SpanStyle

// What:     `import androidx.compose.ui.text.buildAnnotatedString` builds the annotated title and detail.
// Why:      The builder appends the unchanged text first, then adds one style per range.
//
// In TS you'd write (pseudocode):
// ```ts
// const annotated = buildAnnotatedString(() => { append(text); addStyle(...); });
// ```
import androidx.compose.ui.text.buildAnnotatedString

// What:     `import androidx.compose.ui.text.font.FontWeight` makes the headlines semibold and matches bold.
// Why:      The status headline and the emphasized match share the bold weight (D59 and the review).
//
// In TS you'd write (pseudocode):
// ```ts
// font-weight: 600;
// ```
import androidx.compose.ui.text.font.FontWeight

// What:     `import androidx.compose.ui.text.input.ImeAction` marks the keyboard action as Search.
// Why:      The keyboard's action key reads Search, not a playback command.
//
// In TS you'd write (pseudocode):
// ```ts
// // enterKeyHint = "search"
// ```
import androidx.compose.ui.text.input.ImeAction

// What:     `import androidx.compose.ui.text.style.TextAlign` centers the cover status copy.
// Why:      The cover status is centered under its glyph, as in the reviewed capture.
//
// In TS you'd write (pseudocode):
// ```ts
// text-align: center;
// ```
import androidx.compose.ui.text.style.TextAlign

// What:     `import androidx.compose.ui.unit.Dp` and `dp` name every size and inset in density-independent units.
// Why:      Insets and targets use dp, and the crease converts from physical pixels at runtime.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { Dp } from "compose/ui/unit";
// ```
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

// What:     `import dev.monochromatic.musicplayer.core.SearchResult` names one result row.
// Why:      The page draws each result and passes its identity to the open callback.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { SearchResult } from "dev.monochromatic.musicplayer/core/SearchResults";
// ```
import dev.monochromatic.musicplayer.core.SearchResult

// What:     `import dev.monochromatic.musicplayer.core.SearchResultKind` distinguishes folder and track rows.
// Why:      The leading glyph and the crease-safe row logic branch on the kind.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { SearchResultKind } from "dev.monochromatic.musicplayer/core/SearchResults";
// ```
import dev.monochromatic.musicplayer.core.SearchResultKind

// What:     `import dev.monochromatic.musicplayer.core.SearchState` is the page state the header and body follow.
// Why:      The body follows one exhaustive state, so each state gets its own copy or list.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { SearchState } from "dev.monochromatic.musicplayer/core/SearchResults";
// ```
import dev.monochromatic.musicplayer.core.SearchState

// What:     `import dev.monochromatic.musicplayer.core.SearchHighlight` is one emphasized range.
// Why:      The title and detail paint each range through the annotated string.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { SearchHighlight } from "dev.monochromatic.musicplayer/core/SearchMatcher";
// ```
import dev.monochromatic.musicplayer.core.SearchHighlight

// What:     `import dev.monochromatic.musicplayer.core.SearchStatusLine` is one status headline and support line.
// Why:      The status composables draw the copy the pure model chose.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { SearchStatusLine } from "dev.monochromatic.musicplayer/core/SearchPageModel";
// ```
import dev.monochromatic.musicplayer.core.SearchStatusLine

// What:     `import dev.monochromatic.musicplayer.core.SearchRowSemantics` carries a row's spoken pieces.
// Why:      The row merges its kind, action, and state into one TalkBack stop from these values.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { SearchRowSemantics } from "dev.monochromatic.musicplayer/core/SearchPageModel";
// ```
import dev.monochromatic.musicplayer.core.SearchRowSemantics

// What:     `import dev.monochromatic.musicplayer.core.isClearVisible` decides whether Clear appears.
// Why:      Clear is shown only for a query that has visible text (D65).
//
// In TS you'd write (pseudocode):
// ```ts
// import { isClearVisible } from "dev.monochromatic.musicplayer/core/SearchPageModel";
// ```
import dev.monochromatic.musicplayer.core.isClearVisible

// What:     `import dev.monochromatic.musicplayer.core.searchEmphasisSpans` keeps only the valid highlight ranges.
// Why:      The annotated string must never receive a range outside its text.
//
// In TS you'd write (pseudocode):
// ```ts
// import { searchEmphasisSpans } from "dev.monochromatic.musicplayer/core/SearchPageModel";
// ```
import dev.monochromatic.musicplayer.core.searchEmphasisSpans

// What:     `import dev.monochromatic.musicplayer.core.searchRowSecondLine` names the context line of a row.
// Why:      A track shows its parent folder, while a root-level track and a folder show no second line (D77).
//
// In TS you'd write (pseudocode):
// ```ts
// import { searchRowSecondLine } from "dev.monochromatic.musicplayer/core/SearchPageModel";
// ```
import dev.monochromatic.musicplayer.core.searchRowSecondLine

// What:     `import dev.monochromatic.musicplayer.core.searchRowSemantics` computes a row's spoken pieces.
// Why:      The row reads its kind, action, and state from one pure call.
//
// In TS you'd write (pseudocode):
// ```ts
// import { searchRowSemantics } from "dev.monochromatic.musicplayer/core/SearchPageModel";
// ```
import dev.monochromatic.musicplayer.core.searchRowSemantics

// What:     `import dev.monochromatic.musicplayer.core.searchStatusLine` picks the copy for a non-result state.
// Why:      The status copy is decided in the pure model, so the composable only draws it.
//
// In TS you'd write (pseudocode):
// ```ts
// import { searchStatusLine } from "dev.monochromatic.musicplayer/core/SearchPageModel";
// ```
import dev.monochromatic.musicplayer.core.searchStatusLine

// What:     `import dev.monochromatic.musicplayer.core.SEARCH_*` names the copy the page draws.
// Why:      The labels and copy are defined once in the model, so tests and the page read the same text.
//
// In TS you'd write (pseudocode):
// ```ts
// import { SEARCH_FIELD_LABEL, SEARCH_BACK_LABEL } from "dev.monochromatic.musicplayer/core/SearchPageModel";
// ```
import dev.monochromatic.musicplayer.core.SEARCH_BACK_LABEL
import dev.monochromatic.musicplayer.core.SEARCH_CLEAR_LABEL
import dev.monochromatic.musicplayer.core.SEARCH_FIELD_LABEL

// What:     `private const val SEARCH_CREASE_WIDTH_MM: Float = 7.5f` is the visible crease width.
// Why:      E2 measured this width as the crease the information must clear.
//
// In TS you'd write (pseudocode):
// ```ts
// const SEARCH_CREASE_WIDTH_MM = 7.5;
// ```
/** Visible crease width of the Fold inner panel in millimeters (E2). */
private const val SEARCH_CREASE_WIDTH_MM: Float = 7.5f

// What:     `private const val SEARCH_PANEL_WIDTH_MM: Float = 141.08f` is the active inner panel width.
// Why:      The crease is converted from millimeters to pixels through the panel's measured width.
//
// In TS you'd write (pseudocode):
// ```ts
// const SEARCH_PANEL_WIDTH_MM = 141.08;
// ```
/** Active width of the Fold inner panel in millimeters, from the published diagonal (E2). */
private const val SEARCH_PANEL_WIDTH_MM: Float = 141.08f

// What:     `private const val SEARCH_PANEL_WIDTH_PX: Float = 2076f` is the inner panel width in pixels.
// Why:      Pairs with `SEARCH_PANEL_WIDTH_MM` to turn the millimeter crease into physical pixels.
//
// In TS you'd write (pseudocode):
// ```ts
// const SEARCH_PANEL_WIDTH_PX = 2076;
// ```
/** Width of the Fold inner panel in physical pixels (E2). */
private const val SEARCH_PANEL_WIDTH_PX: Float = 2076f

// What:     `private val SEARCH_CREASE_HALF_PX: Float` is half the crease in physical pixels.
// Why:      The clear zone on each side of the fold is half the crease, measured in physical pixels.
//
// In TS you'd write (pseudocode):
// ```ts
// const SEARCH_CREASE_HALF_PX = (7.5 / 141.08) * 2076 / 2;
// ```
/** Half of the crease width in physical pixels, which is the clear zone on each side of the fold. */
private const val SEARCH_CREASE_HALF_PX: Float =
    SEARCH_CREASE_WIDTH_MM / SEARCH_PANEL_WIDTH_MM * SEARCH_PANEL_WIDTH_PX / 2f

// What:     `private val SEARCH_EDGE_INSET: Dp = 16.dp` is the page's standard edge inset.
// Why:      Header and row content start at the same 16dp inset on the cover and beside the crease.
//
// In TS you'd write (pseudocode):
// ```ts
// const SEARCH_EDGE_INSET = 16;
// ```
/** Standard inset from the screen or pane edge to header and row content. */
private val SEARCH_EDGE_INSET: Dp = 16.dp

// What:     `private val SEARCH_BROWSER_GAP: Dp = 8.dp` separates the folder browser from the crease.
// Why:      The browser keeps a small gap beyond the crease so its text stays clear of the fold.
//
// In TS you'd write (pseudocode):
// ```ts
// const SEARCH_BROWSER_GAP = 8;
// ```
/** Gap between the folder browser's end and the crease clear zone. */
private val SEARCH_BROWSER_GAP: Dp = 8.dp

// What:     `private val SEARCH_TOUCH_TARGET: Dp = 48.dp` is the minimum action target.
// Why:      Every icon action and the header's leading slot keep the 48dp minimum target (D58).
//
// In TS you'd write (pseudocode):
// ```ts
// const SEARCH_TOUCH_TARGET = 48;
// ```
/** Minimum size of each icon action and of the leading icon slot. */
private val SEARCH_TOUCH_TARGET: Dp = 48.dp

// What:     `private val SEARCH_ICON_DP: Dp = 24.dp` is the nominal glyph size.
// Why:      Glyphs are drawn at the Material 24dp size inside their 48dp slot.
//
// In TS you'd write (pseudocode):
// ```ts
// const SEARCH_ICON_DP = 24;
// ```
/** Nominal size of each glyph inside its target slot. */
private val SEARCH_ICON_DP: Dp = 24.dp

// What:     `private val SEARCH_HEADER_HEIGHT: Dp = 72.dp` is the full-content Search header height.
// Why:      The baseline M3 Search header is 72dp with a divider (D48).
//
// In TS you'd write (pseudocode):
// ```ts
// const SEARCH_HEADER_HEIGHT = 72;
// ```
/** Height of the integrated Search header (D48). */
private val SEARCH_HEADER_HEIGHT: Dp = 72.dp

// What:     `private val SEARCH_ROW_MIN_HEIGHT: Dp = 72.dp` is the minimum height of one result row.
// Why:      Rows keep the baseline two-line list height so each row is a comfortable target.
//
// In TS you'd write (pseudocode):
// ```ts
// const SEARCH_ROW_MIN_HEIGHT = 72;
// ```
/** Minimum height of one result row. */
private val SEARCH_ROW_MIN_HEIGHT: Dp = 72.dp

// What:     `private val SEARCH_STATUS_TOP: Dp = 72.dp` offsets the inner status headline from the top.
// Why:      The inner status starts below the header, as in the reviewed inner capture.
//
// In TS you'd write (pseudocode):
// ```ts
// const SEARCH_STATUS_TOP = 72;
// ```
/** Distance from the top of the inner Search pane to its status headline. */
private val SEARCH_STATUS_TOP: Dp = 72.dp

// What:     `private val SEARCH_STATUS_DETAIL_TOP: Dp = 12.dp` separates a status headline from its detail.
// Why:      The detail sits 12dp under its headline on the inner panel, as in the reviewed capture.
//
// In TS you'd write (pseudocode):
// ```ts
// const SEARCH_STATUS_DETAIL_TOP = 12;
// ```
/** Gap between a status headline and its support line. */
private val SEARCH_STATUS_DETAIL_TOP: Dp = 12.dp

// What:     `private val SEARCH_COVER_TITLE_TOP: Dp = 24.dp` separates the cover glyph from the headline.
// Why:      The cover status stacks its glyph, headline and detail, with the headline 24dp below the glyph.
//
// In TS you'd write (pseudocode):
// ```ts
// const SEARCH_COVER_TITLE_TOP = 24;
// ```
/** Gap between the cover status glyph and its headline. */
private val SEARCH_COVER_TITLE_TOP: Dp = 24.dp

// What:     `private val SEARCH_COVER_DETAIL_TOP: Dp = 8.dp` separates the cover headline from its detail.
// Why:      The cover detail sits 8dp under the headline, as in the reviewed capture.
//
// In TS you'd write (pseudocode):
// ```ts
// const SEARCH_COVER_DETAIL_TOP = 8;
// ```
/** Gap between the cover headline and its support line. */
private val SEARCH_COVER_DETAIL_TOP: Dp = 8.dp

// What:     `private val SEARCH_SEAM: Dp = 1.dp` is the hairline under the header.
// Why:      The divider is one density-independent pixel, the seam weight the reference captures show.
//
// In TS you'd write (pseudocode):
// ```ts
// const SEARCH_SEAM = 1;
// ```
/** Thickness of the divider under the Search header. */
private val SEARCH_SEAM: Dp = 1.dp

// What:     `private val SEARCH_TRUE_BLACK: Color = Color(0xFF000000)` is the dark canvas.
// Why:      Dark mode paints a true-black canvas behind the page, matching the player screen.
//
// In TS you'd write (pseudocode):
// ```ts
// const SEARCH_TRUE_BLACK = "#000000";
// ```
/** True black canvas used behind the page in dark mode. */
private val SEARCH_TRUE_BLACK: Color = Color(0xFF000000)

// What:     `private const val SEARCH_LIGHT_WHITE_MIX: Float = 0.72f` mixes the light fill toward white.
// Why:      The light emphasis lifts the accent toward white by this lightness fraction (D59).
//
// In TS you'd write (pseudocode):
// ```ts
// const SEARCH_LIGHT_WHITE_MIX = 0.72;
// ```
/** Lightness fraction the light emphasis fill moves toward white (D59). */
private const val SEARCH_LIGHT_WHITE_MIX: Float = 0.72f

// What:     `private const val SEARCH_LIGHT_CHROMA_MIX: Float = 0.55f` reduces the light fill's chroma.
// Why:      Lower chroma keeps the light emphasis calm while the hue still follows the accent (D59).
//
// In TS you'd write (pseudocode):
// ```ts
// const SEARCH_LIGHT_CHROMA_MIX = 0.55;
// ```
/** Chroma fraction the light emphasis fill gives up (D59). */
private const val SEARCH_LIGHT_CHROMA_MIX: Float = 0.55f

// What:     `private const val SEARCH_DARK_BLACK_MIX: Float = 0.62f` mixes the dark fill toward black.
// Why:      The dark emphasis darkens the accent by this lightness fraction (D59).
//
// In TS you'd write (pseudocode):
// ```ts
// const SEARCH_DARK_BLACK_MIX = 0.62;
// ```
/** Lightness fraction the dark emphasis fill moves toward black (D59). */
private const val SEARCH_DARK_BLACK_MIX: Float = 0.62f

// What:     `private const val SEARCH_DARK_CHROMA_MIX: Float = 0.35f` reduces the dark fill's chroma.
// Why:      Lower chroma keeps the dark emphasis from glowing against black (D59).
//
// In TS you'd write (pseudocode):
// ```ts
// const SEARCH_DARK_CHROMA_MIX = 0.35;
// ```
/** Chroma fraction the dark emphasis fill gives up (D59). */
private const val SEARCH_DARK_CHROMA_MIX: Float = 0.35f

// What:     `class SearchLayoutException` signals a layout input that cannot be measured.
// Why:      A non-positive density has no physical meaning, so the page throws instead of guessing a crease.
//
// In TS you'd write (pseudocode):
// ```ts
// class SearchLayoutError extends Error {}
// ```
/** Thrown when a layout input is outside its measurable range. */
class SearchLayoutException(message: String) : IllegalArgumentException(message)

// What:     `private data class SearchPageActions(...)` groups the page callbacks.
// Why:      The header, status, and list all take the same four callbacks, so one value passes them together.
//
// In TS you'd write (pseudocode):
// ```ts
// type SearchPageActions = { onQueryChange; onBack; onClear; onOpenResult };
// ```
/** Callbacks the Search page invokes; grouped so each region takes one value. */
private data class SearchPageActions(
    /** Receives each edit of the query text. */
    val onQueryChange: (String) -> Unit,
    /** Returns to the player without hiding the keyboard first (D64). */
    val onBack: () -> Unit,
    /** Erases the query without changing focus (D65). */
    val onClear: () -> Unit,
    /** Opens one result row (D72 and D73). */
    val onOpenResult: (SearchResult) -> Unit,
)

// What:     `internal fun searchCreaseHalfDp(densityPerDp: Float): Float` converts the crease half to dp.
// Why:      E2 forbids storing the crease as a fixed dp, so the dp value is derived from the current density.
//
// In TS you'd write (pseudocode):
// ```ts
// const searchCreaseHalfDp = (pxPerDp: number) => SEARCH_CREASE_HALF_PX / pxPerDp;
// ```
/**
 * Returns half the crease width in density-independent pixels for the given physical-pixels-per-dp density.
 *
 * @throws SearchLayoutException when the density is not positive.
 */
internal fun searchCreaseHalfDp(densityPerDp: Float): Float {
    if (densityPerDp <= 0f) {
        throw SearchLayoutException("Density must be positive to convert the crease width, but was $densityPerDp.")
    }
    return SEARCH_CREASE_HALF_PX / densityPerDp
}

// What:     `internal fun searchMatchFill(accent: Color, darkScene: Boolean): Color` derives the match fill.
// Why:      D59 requires the fill to come from the OS accent in OKLCH, not a fixed purple.
//
// In TS you'd write (pseudocode):
// ```ts
// const searchMatchFill = (accent, dark) => mixOklchWithNeutral({ color: accent, ... });
// ```
/** Returns the emphasis fill derived from the accent through OKLCH, lighter in light mode and darker in dark mode. */
internal fun searchMatchFill(accent: Color, darkScene: Boolean): Color =
    mixOklchWithNeutral(
        OklchNeutralMix(
            color = accent,
            neutralLightness = if (darkScene) OKLCH_BLACK_LIGHTNESS else OKLCH_WHITE_LIGHTNESS,
            lightnessFraction = if (darkScene) SEARCH_DARK_BLACK_MIX else SEARCH_LIGHT_WHITE_MIX,
            chromaFraction = if (darkScene) SEARCH_DARK_CHROMA_MIX else SEARCH_LIGHT_CHROMA_MIX,
        ),
    )

// What:     `internal fun searchResultKey(result: SearchResult): String` gives each row a stable list key.
// Why:      The lazy list needs unique keys, and folders and tracks are distinguished by their kind and position.
//
// In TS you'd write (pseudocode):
// ```ts
// const searchResultKey = (r) => r.kind === "folder" ? `folder:${r.name}` : `track:${r.indexInLibrary}:${r.name}`;
// ```
/** Returns a key that is unique for each result in one list. */
internal fun searchResultKey(result: SearchResult): String = when (result.kind) {
    SearchResultKind.FOLDER -> "folder:${result.name}"
    SearchResultKind.TRACK -> "track:${result.indexInLibrary}:${result.name}"
}

// What:     `internal fun searchHighlightedText(...)` paints each highlight range in an annotated string.
// Why:      The title keeps its exact characters, and only valid ranges get the accent fill and bold text (D59).
//
// In TS you'd write (pseudocode):
// ```ts
// const searchHighlightedText = (text, hs, fill, ink) => ({ text, spans: searchEmphasisSpans(text, hs).map(...) });
// ```
/** Returns the text with each valid highlight range painted with the match fill and bold weight. */
internal fun searchHighlightedText(
    text: String,
    highlights: List<SearchHighlight>,
    fill: Color,
    ink: Color,
): AnnotatedString = buildAnnotatedString {
    append(text)
    searchEmphasisSpans(text, highlights).forEach { highlight ->
        addStyle(
            SpanStyle(color = ink, background = fill, fontWeight = FontWeight.Bold),
            highlight.start,
            highlight.end,
        )
    }
}

// What:     `@Composable fun searchPage(...)` draws the Search page for the available width.
// Why:      One entry point serves both layouts, so the caller wires the page once and the width picks the arrangement.
//
// In TS you'd write (pseudocode):
// ```ts
// function SearchPage(props: SearchPageProps): UIElement;
// ```
/**
 * Draws the Search page for the given state and query.
 *
 * The cover or inner arrangement comes from `isCoverLayout` applied to the measured width.
 *
 * On the folded cover the page is one full-width destination with no deck (D76). On the unfolded inner panel the
 * folder browser and the deck stay on the left, and the Search header and results stay on the right (D51). The
 * deck and browser slots are drawn only in the inner layout.
 *
 * @param isPlaying Playing state of the current track, or null when the page does not know it.
 * @param folderBrowser Draws the retained folder browser in the upper-left region of the inner layout.
 */
@Composable
fun searchPage(
    state: SearchState,
    query: String,
    onQueryChange: (String) -> Unit,
    onBack: () -> Unit,
    onClear: () -> Unit,
    onOpenResult: (SearchResult) -> Unit,
    currentTrackIndex: Int?,
    deck: @Composable () -> Unit,
    modifier: Modifier = Modifier,
    isPlaying: Boolean? = null,
    folderBrowser: @Composable (Modifier) -> Unit = {},
) {
    /** Whether the system is in dark mode, which selects the true-black canvas and dark emphasis. */
    val dark: Boolean = isSystemInDarkTheme()
    /** Canvas painted behind the whole page. */
    val canvas: Color = if (dark) SEARCH_TRUE_BLACK else MaterialTheme.colorScheme.surfaceContainerLowest
    /** Actions the regions share, grouped into one value. */
    val actions = SearchPageActions(
        onQueryChange = onQueryChange,
        onBack = onBack,
        onClear = onClear,
        onOpenResult = onOpenResult,
    )
    BoxWithConstraints(modifier = modifier.fillMaxSize().background(canvas)) {
        if (isCoverLayout(maxWidth.value)) {
            searchCoverPage(state = state, query = query, actions = actions, canvas = canvas,
                currentTrackIndex = currentTrackIndex, isPlaying = isPlaying)
        } else {
            searchInnerPage(state = state, query = query, actions = actions, canvas = canvas,
                currentTrackIndex = currentTrackIndex, isPlaying = isPlaying, deck = deck,
                folderBrowser = folderBrowser)
        }
    }
}

// What:     `@Composable private fun searchCoverPage(...)` draws the folded cover arrangement.
// Why:      The cover has one full-width destination: header, status or results, and no deck (D76).
//
// In TS you'd write (pseudocode):
// ```ts
// function CoverSearch(props): UIElement { return <Column><Header /><Divider /><Body /></Column>; }
// ```
/** Draws the cover arrangement: the fixed header above a status or a keyboard-aware result list (D56). */
@Composable
private fun searchCoverPage(
    state: SearchState,
    query: String,
    actions: SearchPageActions,
    canvas: Color,
    currentTrackIndex: Int?,
    isPlaying: Boolean?,
) {
    Column(modifier = Modifier.fillMaxSize().background(canvas)) {
        Box(modifier = Modifier.fillMaxWidth().windowInsetsTopHeight(WindowInsets.statusBars))
        searchHeader(query = query, actions = actions, startInset = SEARCH_EDGE_INSET, endInset = SEARCH_EDGE_INSET)
        HorizontalDivider(thickness = SEARCH_SEAM, color = MaterialTheme.colorScheme.outline)
        /** Status line for this state, or null when the state draws a result list. */
        val line: SearchStatusLine? = searchStatusLine(state)
        if (line != null) {
            searchCoverStatus(line = line, modifier = Modifier.weight(1f).fillMaxWidth())
        } else if (state is SearchState.Results) {
            searchResultList(
                results = state.items,
                query = query,
                actions = actions,
                currentTrackIndex = currentTrackIndex,
                isPlaying = isPlaying,
                startInset = SEARCH_EDGE_INSET,
                endInset = SEARCH_EDGE_INSET,
                modifier = Modifier.weight(1f).fillMaxWidth()
                    .windowInsetsPadding(WindowInsets.ime.union(WindowInsets.navigationBars)),
            )
        }
    }
}

// What:     `@Composable private fun searchInnerPage(...)` draws the unfolded arrangement.
// Why:      The browser and deck stay on the left, lifted above the keyboard, and Search sits on the right (D50, D51).
//
// In TS you'd write (pseudocode):
// ```ts
// function InnerSearch(props): UIElement { return <Row><Left /><Right /></Row>; }
// ```
/** Draws the inner arrangement: the retained browser and deck on the left, and the Search pane on the right. */
@Composable
private fun searchInnerPage(
    state: SearchState,
    query: String,
    actions: SearchPageActions,
    canvas: Color,
    currentTrackIndex: Int?,
    isPlaying: Boolean?,
    deck: @Composable () -> Unit,
    folderBrowser: @Composable (Modifier) -> Unit,
) {
    /** Density of the current display, used to convert the crease width into dp. */
    val density = LocalDensity.current
    /** Half the crease in dp, which is the clear zone that keeps information off the fold (E2). */
    val halfCrease: Dp = searchCreaseHalfDp(density.density).dp
    /** Status line for this state, or null when the state draws a result list. */
    val line: SearchStatusLine? = searchStatusLine(state)
    Row(modifier = Modifier.fillMaxSize().background(canvas).imePadding()) {
        Column(modifier = Modifier.weight(1f).fillMaxHeight()) {
            Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                folderBrowser(Modifier.fillMaxSize().padding(end = halfCrease + SEARCH_BROWSER_GAP))
            }
            Box(modifier = Modifier.fillMaxWidth()) {
                deck()
            }
        }
        Column(modifier = Modifier.weight(1f).fillMaxHeight()) {
            Box(modifier = Modifier.fillMaxWidth().windowInsetsTopHeight(WindowInsets.statusBars))
            searchHeader(
                query = query,
                actions = actions,
                startInset = halfCrease + SEARCH_EDGE_INSET,
                endInset = SEARCH_EDGE_INSET,
            )
            HorizontalDivider(thickness = SEARCH_SEAM, color = MaterialTheme.colorScheme.outline)
            if (line != null) {
                searchInnerStatus(
                    line = line,
                    startInset = halfCrease + SEARCH_EDGE_INSET,
                    endInset = SEARCH_EDGE_INSET,
                    modifier = Modifier.weight(1f).fillMaxWidth(),
                )
            } else if (state is SearchState.Results) {
                searchResultList(
                    results = state.items,
                    query = query,
                    actions = actions,
                    currentTrackIndex = currentTrackIndex,
                    isPlaying = isPlaying,
                    startInset = halfCrease + SEARCH_EDGE_INSET,
                    endInset = SEARCH_EDGE_INSET,
                    modifier = Modifier.weight(1f).fillMaxWidth().windowInsetsPadding(WindowInsets.navigationBars),
                )
            }
        }
    }
}

// What:     `@Composable private fun searchHeader(...)` draws the Back, query field, and Clear row.
// Why:      One header holds all three controls (D48), and the field takes focus and the keyboard on entry (D63).
//
// In TS you'd write (pseudocode):
// ```ts
// function Header(props): UIElement { return <div><button /><input /><button /></div>; }
// ```
/** Draws the integrated Search header, requesting focus for the field when the page opens. */
@Composable
private fun searchHeader(
    query: String,
    actions: SearchPageActions,
    startInset: Dp,
    endInset: Dp,
) {
    /** Focus requester attached to the query field so the page can focus it on entry. */
    val focusRequester = remember { FocusRequester() }
    /** Software keyboard controller, or null when the platform offers none. */
    val keyboard = LocalSoftwareKeyboardController.current
    LaunchedEffect(Unit) {
        focusRequester.requestFocus()
        keyboard?.show()
    }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(SEARCH_HEADER_HEIGHT)
            .background(MaterialTheme.colorScheme.surfaceContainerHigh)
            .padding(start = startInset, end = endInset),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        IconButton(onClick = actions.onBack, modifier = Modifier.size(SEARCH_TOUCH_TARGET)) {
            Icon(imageVector = SEARCH_BACK_ICON, contentDescription = SEARCH_BACK_LABEL)
        }
        BasicTextField(
            value = query,
            onValueChange = actions.onQueryChange,
            modifier = Modifier
                .weight(1f)
                .height(SEARCH_TOUCH_TARGET)
                .focusRequester(focusRequester)
                .semantics { contentDescription = SEARCH_FIELD_LABEL },
            singleLine = true,
            textStyle = MaterialTheme.typography.bodyLarge.copy(color = MaterialTheme.colorScheme.onSurface),
            cursorBrush = SolidColor(MaterialTheme.colorScheme.primary),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            keyboardActions = KeyboardActions(onSearch = {}),
            decorationBox = { field ->
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.CenterStart) {
                    if (query.isEmpty()) {
                        Text(
                            text = SEARCH_FIELD_LABEL,
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    field()
                }
            },
        )
        if (isClearVisible(query)) {
            IconButton(onClick = actions.onClear, modifier = Modifier.size(SEARCH_TOUCH_TARGET)) {
                Icon(imageVector = SEARCH_CLEAR_ICON, contentDescription = SEARCH_CLEAR_LABEL)
            }
        }
    }
}

// What:     `@Composable private fun searchCoverStatus(...)` draws a centered status on the cover.
// Why:      The cover status stacks a glyph, headline and detail in the middle of the screen, as in the review.
//
// In TS you'd write (pseudocode):
// ```ts
// function CoverStatus({ line }): UIElement { return <Center><Icon/><h2>{title}</h2><p>{detail}</p></Center>; }
// ```
/** Draws a centered status with a glyph, a headline, and an optional support line. */
@Composable
private fun searchCoverStatus(line: SearchStatusLine, modifier: Modifier) {
    Column(
        modifier = modifier.padding(horizontal = SEARCH_EDGE_INSET),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(
            imageVector = SEARCH_ICON,
            contentDescription = null,
            modifier = Modifier.size(SEARCH_ICON_DP),
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            text = line.title,
            modifier = Modifier.padding(top = SEARCH_COVER_TITLE_TOP),
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.SemiBold,
            textAlign = TextAlign.Center,
        )
        line.detail?.let { detail ->
            Text(
                text = detail,
                modifier = Modifier.padding(top = SEARCH_COVER_DETAIL_TOP),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
        }
    }
}

// What:     `@Composable private fun searchInnerStatus(...)` draws a left-aligned status in the inner pane.
// Why:      The inner status starts at the header's start inset, below the header, as in the reviewed capture.
//
// In TS you'd write (pseudocode):
// ```ts
// function InnerStatus({ line }): UIElement { return <div><h2>{line.title}</h2><p>{line.detail}</p></div>; }
// ```
/** Draws a left-aligned status headline with an optional support line below it. */
@Composable
private fun searchInnerStatus(line: SearchStatusLine, startInset: Dp, endInset: Dp, modifier: Modifier) {
    Column(
        modifier = modifier.padding(start = startInset, end = endInset, top = SEARCH_STATUS_TOP),
    ) {
        Text(
            text = line.title,
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.SemiBold,
        )
        line.detail?.let { detail ->
            Text(
                text = detail,
                modifier = Modifier.padding(top = SEARCH_STATUS_DETAIL_TOP),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

// What:     `@Composable private fun searchResultList(...)` draws the lazy list of result rows.
// Why:      A lazy list keeps up to the result limit of rows cheap to draw, and it returns to the top on a new query.
//
// In TS you'd write (pseudocode):
// ```ts
// function ResultList({ items }): UIElement { return <VirtualList>{items.map(Row)}</VirtualList>; }
// ```
/** Draws the result rows in a lazy list that returns to its first row whenever the query changes. */
@Composable
private fun searchResultList(
    results: List<SearchResult>,
    query: String,
    actions: SearchPageActions,
    currentTrackIndex: Int?,
    isPlaying: Boolean?,
    startInset: Dp,
    endInset: Dp,
    modifier: Modifier,
) {
    /** Scroll state of the result list, which is reset when the query changes. */
    val listState = rememberLazyListState()
    LaunchedEffect(query) {
        listState.scrollToItem(0)
    }
    LazyColumn(state = listState, modifier = modifier) {
        items(items = results, key = { result -> searchResultKey(result) }) { result ->
            searchResultRow(
                result = result,
                currentTrackIndex = currentTrackIndex,
                isPlaying = isPlaying,
                onOpenResult = actions.onOpenResult,
                startInset = startInset,
                endInset = endInset,
            )
        }
    }
}

// What:     `@Composable private fun searchResultRow(...)` draws one result as one merged action row.
// Why:      The row shares the header's start inset so its icon and title line up with Back and the query (D58).
//
// In TS you'd write (pseudocode):
// ```ts
// function ResultRow({ result }): UIElement { return <button><Icon/><div><p>{t}</p><p>{p}</p></div></button>; }
// ```
/** Draws one result row with its glyph, highlighted title, optional parent line, and one merged accessible action. */
@Composable
private fun searchResultRow(
    result: SearchResult,
    currentTrackIndex: Int?,
    isPlaying: Boolean?,
    onOpenResult: (SearchResult) -> Unit,
    startInset: Dp,
    endInset: Dp,
) {
    /** Spoken kind, action and playback state of this row. */
    val rowSpeech: SearchRowSemantics = searchRowSemantics(result, currentTrackIndex, isPlaying)
    /** Accent-derived fill for every emphasized range in this row. */
    val fill: Color = searchMatchFill(
        accent = MaterialTheme.colorScheme.primary,
        darkScene = isSystemInDarkTheme(),
    )
    /** Ink color for the emphasized and plain text of this row. */
    val ink: Color = MaterialTheme.colorScheme.onSurface
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = SEARCH_ROW_MIN_HEIGHT)
            .clickable(role = Role.Button, onClickLabel = rowSpeech.actionLabel) { onOpenResult(result) }
            .semantics(mergeDescendants = true) {
                /** Current-track state read from the row's speech, or null when the row is not current. */
                val state: String? = rowSpeech.stateLabel
                if (state != null) {
                    stateDescription = state
                }
            }
            .padding(start = startInset, end = endInset),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(modifier = Modifier.size(SEARCH_TOUCH_TARGET), contentAlignment = Alignment.Center) {
            Icon(
                imageVector = if (result.kind == SearchResultKind.FOLDER) FOLDER_OPEN_ICON else SEARCH_TRACK_ICON,
                contentDescription = rowSpeech.kindLabel,
                modifier = Modifier.size(SEARCH_ICON_DP),
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = searchHighlightedText(result.name, result.nameHighlights, fill, ink),
                style = MaterialTheme.typography.bodyLarge,
            )
            searchRowSecondLine(result)?.let { context ->
                Text(
                    text = searchHighlightedText(
                        text = context,
                        highlights = result.parentHighlights,
                        fill = fill,
                        ink = MaterialTheme.colorScheme.onSurfaceVariant,
                    ),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}
