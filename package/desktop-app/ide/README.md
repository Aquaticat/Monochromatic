# Read-only Slint IDE

Implementation in progress.
The accepted [0.x scope][scope] and [build approach][plan] define the completion criteria.
This package is not yet a completed application.
Use the [handover][handover] for current verification,
running-process details,
and the next implementation action.

## Implementation queue

- [ ] Complete the source view:
  shaped selection/copy,
  initial real syntax,
  font fidelity,
  and native external-change correspondence pass;
  the reading keys are listed under [Source view keys](#source-view-keys);
  hints and diagnostics render from injected snapshots,
  see [Inlay hints and diagnostics](#inlay-hints-and-diagnostics),
  and await the language-server wiring.
- [x] Native tree,
  asynchronous file switching,
  and recent-file reveal.
  The sidebar is resizable;
  see [Sidebar width](#sidebar-width).
  Event-driven directory invalidation remains parity work.
- [x] Combined path/content search.
- [x] In-file find.
  Plain literal,
       case-insensitive matching with a transient find bar;
  see [In-file find](#in-file-find).
- [ ] Required language-intelligence feature paths.
- [ ] Measured Helix-supported language inventory and private server state.
- [ ] Native interaction tests and behavior-difference documentation.

## Project startup

Run `monochromatic-ide PROJECT` for one explicit local root,
or `monochromatic-ide PROJECT --file FILE` to initially display a file inside it.
Relative `FILE` paths start at `PROJECT`,
not the shell's working directory.
`--help` and `--version` exit before filesystem or native-display startup.
The executable no longer substitutes example source when no file is selected.

Native tree and file switching pass callback tests and real nested Wayland input checks.
Long-distance reveal uses fixed-row windowing over native `ScrollView`;
see the [ListView investigation][listview].
Directory reads and later source opens run in bounded background workers.
Failed opens retain the displayed source and do not enter recent-file history.
Ctrl+0 through Ctrl+9 use session-local promotion and ancestor reveal.

[listview]: ../../../doc/troubleshooting/slint-listview-random-seek-offset.md
[find-matching]: ../../../doc/planning/slint-ide-find-matching.md

## Sidebar width

Drag the divider between the tree and the source to resize the tree.
The width starts at 256 px,
stays between 160 px and the window width minus the divider and a 240 px source column,
and lasts for the session only.
A window too narrow for the chosen width shows the tree narrower,
down to 160 px,
and restores the chosen width when the window widens again.
Double-clicking the divider does nothing.

The divider is reachable with Tab between the tree and the source.
Left and Right change the width by 16 px,
Home and End go to the narrowest and widest width,
and Ctrl+0 through Ctrl+9 still switch files.
Accessibility tools see a horizontal `slider` named `Sidebar width`
with its value,
bounds,
step,
and increment,
decrement,
and set-value actions;
Slint 1.18.1 has no splitter or separator role.
A pointer press never takes keyboard focus.

The idle divider is a faint 1 px line.
Hover shows the column-resize cursor and a 3 px line in stronger ink;
a drag keeps the 3 px line in full ink;
keyboard focus adds a boundary around the whole divider.

### Divider hit area

The divider is its own 48 px layout cell between the tree and the source,
and its pointer area is exactly that cell.
It never overlaps tree rows,
the tree scrollbar,
or source text,
so the last tree pixel and the first source pixel keep their own clicks.
The cost is 47 px of permanent spacing beside the 1 px line.

### Differences from editord

editord's `<file-tree>` starts at `16rem`,
which is the same 256 px default,
and is resized through the browser's `resize: inline` grip
(`package-paused/desktop-daemon/editord/src/client/file-tree/file-tree.styles.ts`).
Its styles declare no minimum or maximum width,
and its client has no double-click handling for the tree width.
This package keeps the default and the session-only width,
replaces the browser grip with a full-height divider,
and adds the 160 px minimum,
the 240 px source minimum,
and keyboard adjustment.

### Sidebar checks

`test:native` drives the divider with real pointer and key events,
including clicks on the pixels on both sides of it at the default,
narrowest,
and widest widths.
`inspect:sidebar-guards` removes each width bound in a disposable copy
and checks that its named test fails.

## Combined search

Double-Shift opens transient search.
Filename matches precede content matches;
prefix the input with `%` to show only content results.
Up/Down wrap the selected result,
Enter or a click opens it,
and Escape or an outside click closes the overlay.
Content results navigate to their matching source line.
The scope is the last-focused tree directory or a focused file's parent,
falling back to the project root.

Input changes cancel old work immediately and debounce the next search by 150 ms.
The worker runs filename and content searches concurrently through ripgrep.
It retains at most 20 filename matches and 30 content matches,
with at most one matching line per file.
Filename matching is smart-case literal substring;
content matching is smart-case regular expression.
A content-search failure does not discard usable filename results.

Record and retained-diagnostic bounds limit memory,
not total bytes scanned or query duration.
The application kills and reaps cancelled search children;
inherited ripgrep configuration,
preprocessors,
and archive decompression are disabled.
Canonical scope validation is not an OS-enforced filesystem sandbox.
Native dark/light input and clipboard probes verify result opening and content-line navigation.
Headless tests cover late replies,
 close cancellation,
 pending-open focus,
 and result-model pointer lifetime.

## In-file find

Ctrl+F opens a find bar under the source view and focuses its input with the previous find text selected.
The bar exists only while finding;
it has no previous,
 next,
 or close buttons,
because Enter,
 Shift+Enter,
 and Escape cover those actions for a bar that only the keyboard can open.
Matching is incremental while typing.
Enter selects the next match and Shift+Enter the previous one,
wrapping at the ends of the file.
Escape closes the bar,
removes the highlights,
and returns focus to the source view.

The bar shows the active match and the total as `3/17`,
`0/17` when the selection is not on a match,
`No matches` in a heavier weight when nothing matches,
and a trailing `+` when the match list was cut off at its bound.
Accessibility tools get the same state as a sentence,
for example `Match 3 of 17`,
both as the find input's description and as a text element.
The bar uses the `search` role with the label `Find in file`.

### Find matching

Matching is plain:
the find text is compared literally,
ignoring case,
against the whole file.
Regular-expression punctuation has no special meaning,
and empty find text matches nothing.
Case folding is the Unicode simple case folding of the `regex` crate that Helix reexports;
no dependency was added.
Matching lives in one function,
`find_matches` in `src/find.rs`,
so its semantics can be replaced in one place.
Matches are ranges of source character positions,
the same unit as selection and copying.

### Deliberate differences from editord

editord delegates Ctrl+F to Chrome's find-in-page,
which matches through ICU collation search;
the measured semantics are in [the find matching plan][find-matching].
The user decided on 2026-10-05 not to reproduce that folding.
`tests/find_reference.rs` runs the production matcher against the captured Chrome 149.0.7827.54 corpus
in `tests/fixture/browser-find.json` and pins the exact set of differing cases,
so an accidental change of matching behavior fails the suite:

- `canonical-accent` and `plain-accent`:
  composed,
   decomposed,
   and unaccented letters do not match each other.
- `case-expansion`:
  `STRASSE` does not match `Straße`.
- `compatibility-ligature`:
  `office` does not match `oﬃce`.
- `dotted-i`:
  `i` does not match `İ`.
- `nbsp-as-space`:
  an ordinary space does not match a no-break space.
- `kana-script`,
   `kana-width`,
   and `kana-composed`:
  kana script,
   width,
   and voicing marks are not folded.
- `single-quote` and `double-quote`:
  straight quotes do not match curly quotes.
- `soft-hyphen`:
  a soft hyphen inside a word is not ignored.
- `combining-mark-only`:
  a lone combining mark matches wherever the file contains it.

The interaction also differs from the browser bar:
the bar sits under the source view and never covers source text,
it has no buttons,
and the active match is the reading selection while the bar is still open.

### Find behavior decisions

- The active match is the reading selection.
  Typing,
   Enter,
   and Shift+Enter set the selection to a match,
  so Ctrl+C in the source view copies its original text
  and the last active match stays selected after Escape.
  A selection that is not exactly one match leaves no active match.
- Typing selects the first match at or after the selection start,
  so extending the find text keeps the current match while it still matches.
  Enter continues after the selection end;
  Shift+Enter continues before the selection start.
- Only typing,
   Enter,
   and Shift+Enter move the selection.
  Reopening the bar,
  an external reload,
  and a file switch recompute the highlights and the count without moving it.
- Enter and Shift+Enter do nothing until matches for the displayed file,
  its current revision,
  and the current find text have arrived.
- After an external reload the selection follows Helix correspondence like any other selection.
  The active match stays active while its text survives;
  otherwise the count shows no active match,
  and the selection does not jump to another occurrence.
  Highlights for the old revision are hidden until matches for the new one arrive.
- Switching files while the bar is open,
  through the tree,
  a search result,
  or Ctrl+0 to Ctrl+9,
  keeps the bar open and recomputes matches for the new file.
  The find input keeps keyboard focus when it had it,
  and Ctrl+0 to Ctrl+9 work from the find input.
- Ctrl+F is ignored while the combined search overlay is open and while no file is displayed.
  Double-Shift opens combined search above an open find bar.
  Escape closes only the topmost surface:
  the overlay first,
  then the bar.
- Escape closes the bar from the tree and the source view as well as from the find input,
  and always moves focus to the source view.
- Empty find text clears the highlights and the count without reporting `No matches`.
- Revealing a match keeps the scroll offsets when the match is already visible.
  Otherwise its line is centered,
  and a column outside the view is placed 48 px from the left edge of the text.
  The offsets are assigned directly,
   without easing.
- The find text is one line;
  the toolkit input replaces pasted line breaks with spaces.
- The find input is the toolkit `LineEdit`,
  as in combined search,
  including its built-in clear icon while it has focus and text.

### Find painting

Match rectangles come from the same shaped rows as selection rectangles (`ShapedView::range`),
so marking a match never reshapes text and ligatures stay intact.
Each state uses two visible channels:

- another match has a translucent fill in the foreground color and a 1 px boundary;
- the active match has the selection background and selection ink and a 2 px boundary;
- a selection that is not a match has the selection colors without a boundary.

Other matches are drawn over a selection,
so they stay visible inside a larger selection such as select-all.
Match ranges are part of the frame stamp:
a different match list repaints the visible source tile once,
even though only the native rectangles read the matches.

### Find bounds

- Find text is limited to 1,000 characters;
  longer text shows a diagnostic in the bar.
- Files up to 64 MiB are searched,
  because the worker copies the source into one contiguous string for the scan;
  a larger file shows a diagnostic.
- At most 10,000 matches are retained (160 kB per list);
  the count then ends in `+`,
  and navigation wraps within the retained matches.
- One background job runs at a time on the `ide-in-file-find` thread,
  with at most one waiting request.
  A newer request replaces the waiting one;
  a running scan is not interrupted,
  but its reply is discarded.
- Requests and replies carry the file-open generation,
  the content revision,
  and the query generation;
  a reply that differs in any of them is discarded.
- Only matches inside the materialized rows and the horizontal raster tile become native rectangles.

`test:find` covers the matcher,
 navigation,
 worker,
 painting,
 and the pinned browser differences.
`test:native` drives the bar through real window key events,
including reload,
 file switch,
 and the search overlay.
`inspect:find-guards` removes each guard in a disposable copy and checks that its named test fails.

## Language module

The headless core in `src/language` drives Helix's language-server client on one worker thread.
It is not wired into the window yet.
The native layer owns one `LanguageWorker`:
it sends `open`, `reload`, `close`, `request`, and `request_hints` without waiting,
and polls `try_take_status`, `try_take_reply`, `try_take_diagnostics`, and `try_take_hints` from a timer.
Every result carries the file generation, content revision, and server process it answers;
the handle drops results for anything no longer displayed.
A command method returns `false` when the queue is full; send it again on the next poll.
`enter_project_directory` must run once at startup, before any thread or Helix call,
because Helix roots every server at the process working directory.

The TypeScript family uses the project's own TypeScript 7 server (`node_modules/typescript/bin/tsc --lsp --stdio`);
a project without it shows the missing-executable state.
Server-initiated workspace edits are refused.
Every server launch passes through one launch policy in `src/language/launch.rs`;
the default spawns the server itself, without write confinement.

`test:language` runs the unit rules and sessions against the scripted server `ide-scripted-lsp`,
one child process per session.
`inspect:language` runs all five feature paths, a reload, and the stale-reply case
against real TypeScript and Rust servers on disposable projects.
`inspect:language-guards` removes the fencing, readiness, and edit-refusal guards in a disposable copy
and checks that their named tests fail.

## Inlay hints and diagnostics

The source view draws inlay hints and the displayed file's diagnostics from the Language module's
`HintsSnapshot` and `DiagnosticsSnapshot`.
The window state keeps them in `State::annotations`,
an `ide_app::annotation::Annotations` (`src/annotation.rs`).
A language poll stores each polled snapshot with `accept_hints(displayed, snapshot)`
or `accept_diagnostics(displayed, snapshot)`,
which refuse a snapshot of any other text,
and renders once when either accepted;
accepting draws nothing by itself.
`annotate::set_annotations(window, state, hints, diagnostics)` in `src/native/annotate.rs`,
both arguments `Option<Arc<...>>`,
replaces both and renders.
Nothing calls either from a running language server yet;
tests and the inspection path below inject snapshots directly.

A snapshot is painted only while its stamp names the displayed text:
the file generation and the content revision.
After an external change or a file switch the old snapshots draw nothing,
and no caret card is shown,
until snapshots for the new text arrive.
Source text never moves in between,
because no annotation takes space inside a line.

### Placement

Hints are drawn after the end of their line,
in source order,
each in a box,
in the source family's real italic face at 13 px and 70 percent of the source ink.
A line where a diagnostic starts gets a severity marker between its text and its hints.
Nothing is inserted into a line,
so caret movement,
selection,
hit testing,
double-click words,
find rectangles,
tab stops,
copying,
and reload correspondence are those of the line without annotations.
A click on a hint is a click past the end of its line and puts the caret at the line end.

The scope delegates placement to evidence.
Three placements were measured against the reading requirements with the production shaper
(`tests/annotation_placement.rs`, printed by `test:annotations`),
using the hints real servers returned in the `inspect:language` run of the Language module:

- Inline virtual text (Helix's `InlineAnnotation`, also the convention of most editors) widens the line.
  On the rust-analyzer line with four hints,
  glyphs after the first hint move by up to 234 px;
  on the TypeScript 7 line with two hints,
  by up to 135 px.
  A stale snapshot is never painted,
  so every reload would move the text left and then right again when new hints arrive,
  measured at 20 ms (TypeScript 7.0.2) and 40 ms (rust-analyzer) after the reload.
  Hints are requested for one view height above and two below the visible lines,
  so scrolling further moves arriving lines too.
  A hint before a tab either changes the tab's width
  (9 px without the hint, 18 px with it)
  or leaves the tab 9 px past a tab stop.
  Up and Down aim at a pixel x,
  and 15 of 24 caret positions of a hinted line landed on another source position.
- Hint rows above the line,
  editord's placement
  (`::before` blocks in `package-paused/desktop-daemon/editord/src/client/inlay/styles.ts`),
  make hinted lines taller,
  so every row below moves down by a whole row per hinted line above it,
  again whenever hints arrive late.
  Rows are a fixed 24 px throughout this view:
  26 uses of that height in 8 source files and 10 `line-height` uses in `ui/app.slint` at the fork point.
- End of line moves no source glyph and no row.
  Its measured cost is association:
  in the same inspection run,
  1 of 2 hinted rust-analyzer lines and 2 of 3 hinted TypeScript lines carry more than one hint,
  and their positions are then shown only by order.

End of line is the only placement that meets the no-jump and unchanged-geometry requirements,
so it is used.
`late_snapshots_move_no_source_pixel` checks the result on rendered pixels.

### Diagnostic marks

Each diagnostic is underlined under the characters it marks,
using the same range geometry as selection,
so tabs,
CJK,
combining marks,
and ligature halves are covered exactly.
Severity has two visible channels besides color:
the underline style and the marker letter.

- Error: a wavy line and a marker `E`.
- Warning: a dashed line and a marker `W`.
- Information: a dotted line and a marker `I`.
- Hint: sparse dots and a marker `H`.

A diagnostic without a severity is shown as a warning, as Helix shows it.
A range over several lines underlines each of its rows and marks a crossed line end like a selected terminator,
so an empty line inside it stays visible.
A point range gets a mark one terminator wide:
after the text at a line end,
centered on its position elsewhere.
Where ranges overlap,
the mildest severity is drawn first and the worst on top;
the marker shows the worst severity starting on its line.
Inside a selection an underline keeps its style but takes the selected-text ink,
as selected glyphs do:
the light-scheme severity inks reach only 1.16:1 to 1.39:1 against the selection fill `#0078D4`.

When the caret touches a diagnostic,
at either end of its range or inside it,
a card under the caret's line lists every problem there,
worst first,
for example `Error E0308 (rustc): mismatched types`,
with a stripe in the worst severity's ink.
It moves above the line when the view ends first,
shows only while the source view has keyboard focus,
and lists at most eight problems.
The same text starts the source view's accessible description.
Hints are not exposed to accessibility tools and never appear in the source text they read.

Severity inks are the fluent system critical,
caution,
and attention colors,
and a neutral gray,
with a light and a dark value each.
Measured on rendered frames (`marks_and_hints_render_in_both_schemes_with_measured_contrast`),
the error marker reaches 5.42:1 against the light background and 8.39:1 against the dark one,
its letter the same against the marker,
and hint text 7.68:1 (light) and 7.49:1 (dark) against its box.
Computed from the declared values against the fluent backgrounds `#FAFAFA` and `#1C1C1C`,
the warning ink reaches 5.03:1 and 12.91:1,
the information ink 6.04:1 and 9.47:1,
and the hint-severity gray 5.93:1 and 8.22:1.

### Cost and invalidation

Each render takes the annotations of the materialized rows with two binary searches,
one over hint positions and one over diagnostics indexed by start with the furthest end so far,
so a range starting above the view is still found.
The visible part is a frame-stamp input:
a snapshot change outside the materialized rows repaints nothing,
and installing the same snapshots again does nothing.
A repaint shapes one layout per visible hint and checks each visible diagnostic against each materialized row.
Hint labels past the widest line extend the scroll range.

### Inspection

Debug builds started with `IDE_INSPECT_ANNOTATIONS` naming a JSON file install that file's hints and diagnostics
for the initially displayed text (`src/native/inspect.rs`),
for nested-compositor frames without a language server.
`inspect:native dark annotations` and `inspect:native light annotations` write such a file for a fixture
with a tab,
CJK,
a combining mark,
a ligature,
overlapping ranges,
a range over a line end,
and a point at a line end.
Release builds do not contain this path,
and without the variable it does nothing.

### Differences from editord

editord shows hints and diagnostic messages in rows above each line, in Inter,
with every message always visible.
Here hints sit after the line's text in the source family,
and a message is shown only for the caret position.
editord shows severity by color alone,
in its wavy underlines and its message rows;
here the underline style and a marker letter also differ.
editord strips a type hint's leading `: ` and a parameter hint's trailing `:`;
here labels are shown as the server sent them,
without padding spaces.

`test:annotations` covers the visible subset, layout, painting, the frame stamp, and the placement measurements.
`test:annotations-native` drives injected snapshots through real key and pointer events in both schemes,
and `test:native` includes it.
`inspect:annotation-guards` removes each guard in a disposable copy and checks that its named test fails.

## Fonts and appearance

Official variable roman and real italic fonts for JetBrains Mono and Inter are bundled under `asset/font`
with their original OFL notices.
The Slint compiler is configured to embed imported font bytes.
The UI binds to the system palette.
Native dark/light rendering and font isolation are verified.
Programming ligatures retain per-character caret,
selection,
and copy behavior.
Inter's default kerning,
continuous weights,
optical-size controls,
and real italic selection are covered by font-stack tests.
Native widget snapshots also verify intermediate weights and italic cache invalidation.
Inter's normal Slint UI request currently retains the optical-axis default,
not automatic optical sizing.
Idle DPI changes are covered by a native headless window-event regression.
Live system-theme change and physical-output scale migration remain to be verified.

## Source view keys

The source view is read-only:
typing,
deleting,
and pasting are ignored.
Keys follow ordinary desktop text-view conventions.
Every movement key also has a Shift form that extends the selection from its anchor.

- Left and Right move by one grapheme,
  so a combining sequence,
  a joined emoji,
  and a CRLF pair are each one step.
  Without Shift they first collapse a selection to the side they point at.
- Ctrl+Left moves to the start of the current or previous word,
  Ctrl+Right to the end of the current or next word.
  A word is a run of letters of any script,
  digits,
  and underscores;
  a run of punctuation is a stop of its own.
- Home and End move to the start of the line and to its end before the terminator.
  Ctrl+Home and Ctrl+End move to the start and the end of the text.
- Up and Down move by one line and aim for the horizontal pixel position
  where the run of vertical movements started,
  so a short or empty line does not pull the caret to the left for the lines after it.
  A horizontal key or a click names a new position to aim for.
  Up on the first line moves to the start of the text,
  Down on the last line to its end.
- PageUp and PageDown move the caret and the view by the whole lines in view.
- Ctrl+A selects everything,
  and Ctrl+C copies the selection as original source text.
- Tab and Shift+Tab move keyboard focus between the tree,
  the sidebar divider,
  the source view,
  and the find input while the find bar is open,
  in that order.

Every caret key scrolls the view by the smallest amount that shows the caret.
The target of Up,
Down,
and the page keys is found by shaped pixel position,
not by counting characters,
so wide glyphs,
tabs,
combining marks,
and ligatures land where the eye expects.

### Pointer selection

A click places the caret at the nearest grapheme boundary.
A double click selects a word,
a punctuation run,
or a run of blanks;
a triple click selects the line with its terminator.
Shift+click extends from the anchor.
A drag extends by the unit of its press and scrolls when it passes an edge of the view.
A selected line terminator is shown as a mark after the line's text,
so a selected empty line stays visible.
Mouse drags never pan the view;
the wheel and touch scroll it.

### Tab stops

A tab ends at the next tab stop.
Stops lie at multiples of two space advances of the source font,
measured in pixels from the start of the line.
That is the CSS rule behind editord's `tab-size: 2`,
including its clause that a tab narrower than half a space runs on to the following stop.
Because stops are pixel positions,
a tab after a CJK glyph ends where a tab after Latin text ends,
although the fallback font's glyph is not two Latin cells wide.
Caret,
selection,
hit testing,
and find rectangles treat a tab as one character,
and copying yields the source tab.

### Line endings

LF and CRLF end a line.
End stops before a CRLF pair,
Right steps over it as one unit,
and a selection across it copies the original pair.
The last line needs no terminator.

### Selected text ink

Selected text is drawn in white while white reaches a contrast ratio of 3:1 against the selection fill,
and in black on a lighter fill.
The toolkit's fluent palette keeps the fill `#0078D4` in both color schemes
but pairs it with black ink in the dark scheme.
Black on that fill has a WCAG 2 ratio of 4.64 and white of 4.53,
so the ratio alone does not separate them;
the light ink is the readable one on a saturated mid-tone,
and it is what the light scheme always showed.

### Deliberate differences from editord's editor

editord leaves caret movement and selection to the browser's `contenteditable` handling.
This view implements the conventions of this section itself
and was not compared key by key with that engine.

- Words are runs of one character class,
  not dictionary segments:
  a run of CJK letters is one word.
- Ctrl+Up,
  Ctrl+Down,
  Ctrl+PageUp,
  Ctrl+PageDown,
  and Alt combinations are unbound.
- The page keys move by the whole lines in view without an overlapping line.
- A drag past an edge of the view scrolls only while the pointer moves;
  no timer keeps scrolling under a resting pointer.
- Long lines are not wrapped,
  while editord wraps them,
  so Up and Down move by source lines.
- Selected text is drawn in one ink instead of keeping its syntax colors.

`test`,
`test:native`,
and `inspect:source-guards` cover these rules:
library tests for movement,
tab stops,
and boundaries,
headless native tests that drive real window key and pointer events,
and guard-removal controls in a disposable copy.

## Current reader behavior

Copy selected source with Ctrl+C.
There is no read-only badge,
Copy button,
or permanent diagnostic footer.
Source positions,
painting,
and selection share native shaped-row geometry.

The displayed file is reread by a bounded background worker at 250 ms intervals.
External changes map the latest caret,
selection,
and viewport through Helix correspondence,
even while text remains selected.
Read failures retain the last readable source and show a diagnostic until recovery.
The concrete caret and replacement-selection cases in the accepted scope pass through the native GUI.
This polling boundary is not yet a workspace tree watcher or language-server synchronization loop.

## Build boundary

Application builds and tests run in the IDE container extending the repository's native-app image,
with 2 GiB RAM,
2 CPUs,
a 512-process limit,
and a 4096-descriptor limit.
The container receives this package and a dedicated Cargo cache,
not the user's home or credentials.
The source documentation/line-budget task invokes the repository's Rust linter separately.

The `runtime` task prepares pinned Helix grammars for the measured language inventory,
matching query assets,
and license notices beside built binaries.
It is a build-only operation,
not an application-triggered downloader.
The selection is the languages `tokei` measures as repository source or configuration
that Helix supports at the pinned revision,
plus the companion grammars their queries inject for content the repository contains.
[The runtime language plan][runtime-languages] records the measurement,
each grammar's revision and license,
and language-server presence on this host.
The published `manifest.json` lists the bundled grammars:
a file whose recognized language is not listed stays plain text,
while a listed grammar that fails to load is reported as a broken installation.

[runtime-languages]: ../../../doc/planning/slint-ide-runtime-languages.md

Helix crates share a pinned upstream revision.
Helix code and runtime assets retain their own license obligations;
the application does not inherit Helix's modal commands or editing features.

[handover]: ../../../doc/handover/slint-ide-0x.md
[scope]: ../../../doc/decision/slint-ide-0x-scope.md
[plan]: ../../../doc/planning/slint-ide-implementation.md
