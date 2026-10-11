# Slint IDE soft wrap

The user asked on 2026-10-10 that the source view always wrap long lines to the pane width,
with a wrap indicator in the gutter for each wrapped line,
and no horizontal scrolling at all.
For every open detail the user said to do what JetBrains does ("IDEA is OSS").
This plan fixes the behavior from IntelliJ IDEA Community's source,
maps the code that has to change,
and orders the work.

## Where the user's words and JetBrains differ

IntelliJ draws no glyph in the gutter.
Its wrap marks are painted in the text area:
one at the end of the upper row and one just left of the continuation text,
and only on the caret's line by default.
The gutter only leaves the line number off continuation rows.
The user's explicit words win for the indicator's place:
the mark goes in the gutter, on each continuation row.
Everything the user did not say follows IntelliJ.

## Behavior to build

Each item names the IntelliJ source it comes from
(`JetBrains/intellij-community`, master at `d0936c36705bdaf87deca0f157a40c651345600c`).

- Gutter:
  a line number on the first visual row of a logical line only
  (`EditorGutterComponentImpl`, the `startsWithSoftWrap()` test);
  continuation rows show no number and carry the wrap indicator instead.
  The indicator is a small down-and-right arrow in the soft-wrap sign color
  (IntelliJ's `c0c0c0` in the light scheme, `SOFT_WRAP_SIGN_COLOR`),
  drawn as a vector shape so it needs no font glyph;
  shape and color are two channels.
  Its look gets built screenshots before the user is asked, because it is a UI decision the user left to JetBrains
  only in general.
- Wrap width: the text area's width (view minus gutter, scrollbar, and caret room),
  no minimum; with zero width, wrapping waits (`SoftWrapApplianceManager`).
- Where a row breaks (`SoftWrapEngine`, `GenericLineWrapPositionStrategy`):
  at a space or tab, or after `,`, `;`, `)`, or before `(` and `.`,
  choosing the rightmost candidate in the overflowing row, spaces staying on the upper row;
  every BMP code point from U+2F00 up (CJK and others) is a break opportunity;
  a token with no candidate breaks at the code point where the width is exceeded.
- Continuation indent: the first non-blank column of the logical line, plus one column for the mark
  (`USE_CUSTOM_SOFT_WRAP_INDENT = true`, `CUSTOM_SOFT_WRAP_INDENT = 0`).
- Home and End (`EditorActionUtil.moveCaretToLineStart`, `moveCaretToLineEnd`, smart Home on):
  Home goes to the start of the visual row, and from there to the first non-blank column of the logical line's first row;
  End goes to the end of the visual row (trailing blanks skipped), and from there to the logical line end.
  Shift variants extend the selection.
- Up and Down keep a remembered pixel x across vertical moves and move by visual rows
  (`CaretImpl.myDesiredX`); horizontal moves clear it.
  PageUp and PageDown move by visual rows.
- Ctrl+Left and Ctrl+Right move by document offset.
- A caret at the exact wrap offset is drawn at the start of the lower row;
  a move that keeps its visual position, such as End, leaves it at the end of the upper row.
  The reading position therefore needs an affinity bit.
- A click picks the visual row under the pointer; a triple click selects the whole logical line,
  all its visual rows.
- Selection, find matches, and diagnostic underlines are painted per visual fragment,
  so each wrapped row gets its own segment.
- No horizontal scrolling: the scroll range, the horizontal tile, shift-wheel motion,
  `scroll-x`, and the caret-room widening all go.

## What changes in the code

The survey of 2026-10-10 found that wrapping is not a drop-in extension of the rows model.
Parley already lays out several visual lines per source line and the painter already loops over them,
but the vertical model, the geometry readback, the gutter model,
and the caret, aim, and hit code assume one row per source line.
Places that must change, silent failures first:

1. `src/shaped_row.rs`: `hit` probes at half the layout height, so every click on a wrapped line lands in the middle row;
   `range` hard-codes `y: self.top` and a height of one code row, so selection, find, underlines, and reveal all inherit it.
2. `src/text_raster.rs` and `src/annotation_paint.rs`: exact float matches of `rectangle.y` against a row's top
   lose selected ink and underline splitting on continuation rows.
3. `src/shaped_text/view.rs`, `src/document.rs`, `src/vertical_motion.rs`, `src/caret_motion.rs`:
   caret y has no visual offset, the reading position has no affinity,
   Up and Down aim with an unwrapped row, Home and End use the logical line.
4. `src/native/rows.rs` (`wanted_key`), `src/native/viewport.rs`, `src/native/render.rs`, `src/annotation/blocks.rs`:
   the row key and frame stamp must include the wrap width,
   and the cached hint packing is keyed by scale only.
5. `src/native/input.rs`, `src/native/language/pointer.rs`, `src/pointer_selection.rs`:
   pointer and hover resolve a logical line, so a click on a continuation row maps wrongly.
6. `src/annotation_layout.rs`: hint and message x and underline y come from a logical row;
   hint packing sets block height from x, and messages can run past the pane width.
7. `src/native/rows.rs` (`measure`, `present`) and `ui/app.slint`: the gutter has one number and one mark per logical line;
   it needs a per visual row model with the number or the wrap indicator.
8. `src/tab_layout.rs`: tab stops are measured on an unbroken layout and then used on a wrapped one.
9. `src/row_map.rs`: every height, `locate`, `page`, `extent`, and `block_top` assumes one code row per line.

Open engineering question, settled by measurement and not by the user:
the vertical map needs every line's wrapped height before it can answer `locate` or the scroll extent,
but the code shapes only materialized lines.
Option A shapes every line at the wrap width when text, width, scale, or annotations change.
Option B estimates heights and corrects them as lines are shaped, using the existing keep-view-still machinery.
The first slice measures A on a large file; B is the fallback if A costs too much.

Also to verify before building:
the style properties `TextWrapMode`, `OverflowWrap`, and `WordBreak` on Parley 0.11.1
(only the 0.10 source has been read),
and whether a Flickable whose content width equals its width also blocks shift-wheel motion.

## Order of work

1. Layout model: wrap width into the row key, Parley breaking with the IntelliJ rules and indent,
   visual row counts in `RowMap`, whole-file height measurement.
2. Geometry readback: per visual line y in `ShapedRow` (`range`, `hit`, `caret_x`), affinity in `ReadingPosition`.
3. Gutter and scrolling: numbers on first rows only, the wrap indicator (after the user picks its look from screenshots),
   removal of horizontal scrolling.
4. Keys and pointer: Home, End, Up, Down, PageUp, PageDown, click, drag, triple click.
5. Annotations, find, and selection on visual rows.
6. Tests, guards, and the README: the tests and guards that assert horizontal scrolling or one row per line
   (`caret_tests`, `find_tests`, `sidebar_layout_tests`, `annotation_paint_tests`, `find_paint`, `row_map`,
   `vertical_motion`, `reading_boundaries`, `annotation_layout`, `tab_geometry`, and the guards
   `horizontal-resets-column`, `caret-room`, `horizontal-tile`, `scroll-extent`) are rewritten to wrap,
   and each new guard is seen failing.

## Not decided here

- The gutter indicator's exact look: arrow shape and weight, and its color in the dark scheme
  (IntelliJ's dark value was not read). Built screenshots of the options come first.
- Whether a "soft wrap" toggle exists. The user said always, so none is planned.

## Smoothness requirement that applies to all of it

The user ruled that choppy scrolling is not excusable even under extreme host load.
Wrapping adds layout work, so the same rule binds it:
a scroll step must not wait on shaping, rasterizing, or layout on the UI thread.
The scroll measurements of 2026-10-10 (all renderers painted only about half the possible frames;
app renders had a median of 2 ms but a p95 near 30 ms and spikes of 60 to 77 ms) are the baseline to beat.
