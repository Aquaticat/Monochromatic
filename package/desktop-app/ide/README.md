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
  External changes reach the tree and the source through inotify notifications;
  see [Change watching](#change-watching).
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
[Language navigation](#language-navigation) wires it into the window.
The native layer owns one `LanguageWorker`:
it sends `open`,
 `reload`,
 `close`,
 `request`,
 and `request_hints` without waiting,
and polls `try_take_status`,
 `try_take_reply`,
 `try_take_diagnostics`,
 and `try_take_hints` from a timer.
Every result carries the file generation,
 content revision,
 and server process it answers;
the handle drops results for anything no longer displayed.
A command method returns `false` when the queue is full;
 send it again on the next poll.
`enter_project_directory` must run once at startup,
 before any thread or Helix call,
because Helix roots every server at the process working directory.

The TypeScript family uses the project's own TypeScript 7 server (`node_modules/typescript/bin/tsc --lsp --stdio`);
a project without it shows the missing-executable state.
Server-initiated workspace edits are refused.
Every server launch passes through one launch policy in `src/language/launch.rs`.
The default,
 `src/language/confine.rs`,
 runs each server inside `/usr/bin/bwrap`
with the whole file system read-only,
 no network,
 and a cleared environment plus an allowlist,
following `doc/planning/slint-ide-write-confinement.md`.
Each server writes only its private state,
`$XDG_CACHE_HOME/monochromatic-ide/language/<project>-<hash>/<server>`,
which also holds its private `/tmp`,
 caches,
 and cargo output.
The state root is resolved through symbolic links first
and must lie neither inside the project nor above it.
After the sandbox replaces `/tmp`,
 `/run`,
 and `/dev`,
the project is bound again read-only at its own path
and at Helix's working-directory spelling when that lies below one of them,
so projects below `/tmp` or `/run/media/<user>` work.
`PROJECT_MOUNT` in `src/language/confine/project.rs` is the one switch a later write mode changes.
Without bubblewrap or user namespaces,
for a project or state root below `/proc`,
or for state inside or above the project,
the server shows the launch-refused state with the cause and remedy;
nothing falls back to an unconfined launch.
`LanguageSetup::unconfined()` exists only for tests and guard controls on disposable projects.

`test:language` runs the unit rules and sessions against the scripted server `ide-scripted-lsp`,
one child process per session.
`inspect:language` runs all five feature paths,
 a reload,
 and the stale-reply case
against real confined TypeScript and Rust servers on disposable projects,
and checks that the servers left each project tree unchanged.
`inspect:language-confinement` runs the write-confinement acceptance tests:
write,
 escape,
 and delegation probes from inside the server trees,
the mount and environment audits,
 fail-closed cases,
and the same fixtures unconfined as the guard control.
`inspect:language-guards` removes the fencing,
 readiness,
 and edit-refusal guards in a disposable copy
and checks that their named tests fail.

## Language navigation

In the source view,
Ctrl+B goes to the definition of the symbol at the caret,
and at the definition itself it finds the symbol's references.
Ctrl+click goes to the definition of the character under the pointer.
Ctrl+Q shows hover information for the caret,
and a pointer resting 350 ms on one character shows it for that character.
Nothing of this is visible until it is used:
there is no status bar and no language indicator.

### Definitions and references

One target is opened directly.
In the displayed file the caret moves to the start of the target,
and the target's line is centered when it was out of view.
Another project file opens through the ordinary file open,
so it enters Ctrl+0 to Ctrl+9 history,
gets its tree badge,
and is revealed in the tree.
A file outside the project opens read-only,
with a bordered `Outside project` label before its path in the file label;
it gets no tree row,
no history slot,
and no project root of its own,
and Ctrl+0 returns to the last project file.

Several targets are listed beside the caret line,
below it when there is room and above it otherwise,
so the list never covers that line.
The list's title counts them,
for example `3 references` or `2 definitions`,
and each row shows the project-relative path and the one-based line,
or the server's address for a location that cannot be opened.
Outside-project rows say `Outside project`
and unopenable rows say `Cannot open`.
The list takes keyboard focus:
Up and Down move the selection and wrap,
Enter or a click opens the selected location,
Escape or a click outside closes the list,
and every way of closing returns focus to the source view.
Tab stays in the list and Ctrl+F waits until it is closed,
as with the search overlay.
Rows are 48 px tall;
the selected row has the selection fill,
a heavier weight,
and a boundary.
Accessibility tools see a `list` named by the title,
with `list-item` rows that report their selection and open on their default action.

A location the server names but the reader cannot open,
such as an `untitled:` or `jdt:` address or a missing file,
is explained instead of opened,
for example `Cannot open file:///gone.rs: the file does not exist.`

### Hover

Hover content is shown as plain text in JetBrains Mono in a popup beside its line:
below it when it fits,
above it otherwise,
and on the roomier side with a scrolling body when neither fits,
so the popup never covers the hovered line.
It is at most 640 px or 60% of the window wide and 320 px tall.
Markdown code-fence lines are dropped,
runs of blank lines collapse,
and content longer than 8,000 characters is cut with an ellipsis line.

The popup closes on Escape,
on any caret movement,
on scrolling,
on a reload of the file,
on a file switch,
and when the search overlay opens.
A pointer hover also closes when the pointer leaves both the source view and the popup,
so the pointer can move into the popup to scroll it,
and when the pointer rests over no character,
such as past the end of a line,
on a blank line,
or over the line numbers.
Resting over no character asks the server nothing.

### Notes

When an action the user asked for cannot be done,
a note appears in the same popup beside the line it was asked about.
A note has three channels that set it apart from hover content:
a heavier weight,
the interface typeface,
and a bar along its leading edge.
Notes are declared as an assertive live region and hover content as a polite one;
announcement by a screen reader was not tested.
A note closes like hover content,
and a new action replaces it.
A resting pointer never shows a note;
its failures are only logged.

Each note names the reason and the remedy:

- a server still starting:
  `scripted-ls is still starting (Indexing). Press Ctrl+B again in a moment.`,
  with the server's progress title when it reports one;
- a missing server program,
  with the reason the Language module reports,
  which for TypeScript names the project dependency to install,
  followed by `After installing it, press Ctrl+B again.`;
- a feature the server does not offer:
  `scripted-ls does not offer go to definition.`;
- a failed request,
  with the server's error code and message,
  a timeout,
  or a server that stopped while answering,
  each with the key to try again;
- a request the server set aside because its analysis kept changing;
- an empty answer:
  `No definition found.`,
  `No usages found.`,
  or `No hover information at this position.`,
  followed,
  while the server reports work in progress,
  by the advice to press the key again when it finishes;
- a server that cannot follow external changes,
  a failed start,
  a launch the policy refused,
  a server root outside the project,
  and a file outside the project with no running server of its language;
- a file without a recognized language or without a configured server;
- an answer overtaken by a reload of the same file:
  `The file changed on disk before the hover information arrived. Press Ctrl+Q again.`;
- language support that could not start or stopped,
  with the reason and the need to restart the application.

The Language module re-resolves server programs and starts failed servers only when a file is displayed.
When the latest status shows a missing program,
a failed start,
an unsynchronized server,
or an outside-project file without a ready server,
and no server is ready,
an explicit action first displays the file to the worker again,
so the remedy "press Ctrl+B again" works without switching files.

### Stale results

The handle's fence advances only when an open or reload command was queued,
so the window checks every reply again before applying it:
the reply must carry the number of the request the window waits for,
of the same kind,
and both the reply and the request must describe the displayed file generation and revision.
A request is sent only after the worker holds the displayed text,
because the worker drops a request for other text without replying;
a waiting request whose text is no longer displayed is dropped,
and on a reload of the same file the note asks to try again.
The popup and the list close when the displayed text changes,
and a language target waiting for its file is dropped by any later open.
Pointer hover and key actions use separate request slots,
so hovering never replaces a pending Ctrl+B,
and a resting pointer's late answer never replaces the location list or a note.

### Synchronization and annotations

The window tells the worker about each displayed file,
and about each accepted external reload with the copy taken before `Document::apply_reload` consumed it;
a command the queue cannot take is sent again on the next 20 ms tick.
The visible lines are reported for inlay hints once they stayed the same for 200 ms,
a chosen value,
and at once for newly displayed text.
Accepted hint and diagnostic snapshots are stored in `State::annotations`,
the store the section "Inlay hints and diagnostics" describes,
which hands a snapshot out only for the stamp of the text being drawn.
The tick that stores one repaints the source once (`src/native/language/poll.rs`),
so hints and diagnostics appear without another event.
The hover popup is anchored to the top of the hovered line's block of virtual rows
or to the bottom of its code row,
so it covers neither the line nor the hints and messages over it.
At window close the worker is dropped after the window is gone,
which waits up to about a second for servers to exit.

### Differences from editord

editord's language client is in `package-paused/desktop-daemon/editord/src/client/app/`.
Ctrl+B,
Ctrl+click,
the references fallback,
opening a single reference directly,
`path:line` rows,
wrapping Up and Down,
Enter,
Escape,
and the 350 ms pointer rest follow it.
Deliberate differences:

- Ctrl+Q shows hover information for the caret.
  editord has no keyboard hover;
  Ctrl+Q is the Quick Documentation key of the JetBrains keymap editord's other keys come from.
- Hover content drops Markdown fence lines;
  editord shows the raw text through `textContent`,
  fences included.
- The hover popup sits beside the hovered line at the hovered character,
  not 8 px below the pointer,
  and an empty answer for a new character closes it instead of leaving the previous content.
- Notes stay until dismissed instead of disappearing after 2 seconds,
  name a remedy,
  and are declared as a live region for assistive technologies.
- Several definitions are listed;
  editord's server keeps only the first.
- The list has a title,
  48 px rows,
  click to open,
  and modal focus;
  editord's popover has none of these.
- A reload or a file switch closes the popup and the list.
- A file outside the project gets no history slot.
- There is no Find Usages key besides Ctrl+B at the definition,
  no back navigation after a jump,
  and no indication while a request is pending.

### Language navigation checks

`test:native` builds the scripted server `ide-scripted-lsp`,
then drives every path with real window key and pointer events:
definitions in the same file,
another project file,
and outside the project,
the references list with its keys,
outside click,
and focus return,
unopenable targets,
hover by key and by the resting pointer with its placement and dismissals,
each server-state note,
answers overtaken by a reload and by a file switch,
a worker that could not start,
and closing while a request is pending.
`IDE_SCRIPTED_DEFINITION` and `IDE_SCRIPTED_REFERENCES` give the scripted server's answers as JSON.
`inspect:language-navigation-guards` removes each native guard in a disposable copy
and checks that its named test fails.
`inspect:native` takes `IDE_NATIVE_PROJECT` and `IDE_NATIVE_FILE`
to open a disposable project below the system temporary directory instead of its generated fixture.

## Inlay hints and diagnostics

The source view draws inlay hints and the displayed file's diagnostic messages on virtual rows
that stand over the line they belong to,
and underlines the characters each diagnostic marks.
The user decided this placement on 2026-10-05:
no hint inside or after a line,
hints and messages on rows of their own as editord draws them
(`package-paused/desktop-daemon/editord/src/client/inlay/`),
and spacing that makes a block of such rows read as part of the line under it.
An earlier build drew hints after the end of their line and showed messages in a card at the caret;
the design record `design/README.md` keeps its frames as history.

Snapshots come from the Language module's `HintsSnapshot` and `DiagnosticsSnapshot`.
The window state keeps them in `State::annotations`,
an `ide_app::annotation::Annotations` (`src/annotation.rs`).
A language poll stores each polled snapshot with `accept_hints(displayed, text, snapshot)`
or `accept_diagnostics(displayed, text, snapshot)`,
which refuse a snapshot of any other text,
and renders once when either accepted;
accepting draws nothing by itself.
`annotate::set_annotations(window, state, hints, diagnostics)` in `src/native/annotate.rs` replaces both and renders;
tests use it.

A snapshot is painted only while its stamp names the displayed text:
the file generation and the content revision.
Hints accumulate within one revision.
A server is asked about the lines around the view,
so each answer replaces the hints of the lines it was asked about and keeps those of every other line:
rows seen once are still there when the view returns to them.

### Placement

A line with hints or messages gets a block of virtual rows directly over its code row.
Hint rows come first and message rows after them,
so messages are nearest to the code.
These are the values at scale 1;
each is a logical length and is multiplied by the display scale:

- A code row is 24 px high (`row_map::CODE_ROW`).
- A virtual row is 16 px high (`virtual_row::ROW_HEIGHT`),
  set in Inter Variable at 13 px (`ROW_TEXT`).
- A block starts with 10 px of empty space (`BLOCK_GAP`).
  Nothing separates its rows from each other or from the code row they belong to.
- A line without hints and messages has no block and no gap.

Measured on `design/screenshots/2026-10-05-hint-rows/overview-dark-1x.png`,
the empty space between the ink of a hint row and the ink of its own line is 10 px,
and between that hint row and the ink of the line before it 22 px;
baseline to baseline the distances are 20 px and 30 px.
That difference is the only sign of which line a block belongs to:
there is no box,
rule,
or background.

#### Hint rows

A hint is drawn at the pixel x of the character it is placed before,
taken from the row the production shaper laid out,
so tabs,
CJK,
combining marks,
and ligatures put it where the character is.
Hints are packed in position order,
as editord packs them:
a hint goes on the current row when it starts at least 8 px (`virtual_row::HINT_GAP`)
after the end of the previous hint on that row,
otherwise it starts a new row,
and every later hint continues on that new row.
A hint at the end of a line is drawn on its row at the x of the line end;
nothing is drawn after a line.
Labels are shown as the server sent them,
without padding spaces,
in the source ink at 70 percent,
without a box.

The packing never looks back at an earlier row,
so a call with several short arguments can take one row per argument:
`resize(box(1, 2), 3, 4, 5)` takes five rows in `overview-dark-1x.png`.
Placing each hint on the first row with room is the alternative;
the design record compares the two as the question `hint-packing`.

#### Message rows

Every diagnostic that starts on a line gets rows of its own in that line's block,
starting at the pixel x of the diagnostic's first character.

- Text: `Error E0308 (rustc): mismatched types`,
  that is the severity in words,
  the code and the source when the server gave them,
  and the message.
- Ink: the severity's ink.
  The severity word is the second channel besides color,
  and the underline style is a third.
- Order: worst severity first,
  then source order.
- Line breaks: each line of a message starts a row.
  Blank lines are dropped;
  indentation is kept.
- Long lines: a line wraps at a blank once it reaches 80 characters (`WRAP_COLUMNS`),
  wide characters counting as two;
  a longer word is cut.
  Every row after a message's first is indented by 16 px (`CONTINUATION_INDENT`).
  The limit is a count of characters,
  so the height of a block is known without shaping its text.
- Cap per message: 12 rows (`MESSAGE_ROWS`).
  The last row of a longer message reads `… N more lines`.
- Cap per line: 8 messages (`LINE_MESSAGES`).
  One more row then reads `N more on this line, the worst: Warning`,
  naming the worst severity left out.
- A range over several lines: its message stands over the first line of the range only;
  every line of the range is underlined.

Rows do not wrap to the window:
a row that starts far to the right runs past the right edge,
as a long code line does,
and the horizontal scroll range reaches its end.
`narrow-dark-1x.png` shows that at the default window width.

A message cut by either cap is spelled out in full in the source view's accessible description
while the caret touches its diagnostic,
up to eight problems.
There is no pointer or keyboard way to read the rest on screen yet.

#### Virtual rows are not source text

- The caret never stands on a virtual row.
  Up,
  Down,
  and the page keys move between code rows.
- Selection fills cover code rows only,
  and copying yields the source text alone.
- Find matches source text only and paints its rectangles on code rows.
- Line numbers and gutter letters stand beside code rows.
- A press on a virtual row acts on the code line under it at the same x:
  the click,
  double click,
  triple click,
  Shift+click,
  or drag is the one a press on that line would be.
  A block belongs to its line for the pointer as it does for the eye.
- A resting pointer and Ctrl+click on a virtual row are over no character,
  so no hover and no definition request is sent.
- The hover popup is anchored to the top of the hovered line's block or to the bottom of its code row,
  so it covers neither the line nor its rows.
- Hints are not exposed to accessibility tools.
  The source view's accessible description starts with the problems at the caret.

Caret movement,
selection,
hit testing,
double-click words,
find rectangles,
tab stops,
copying,
and reload correspondence within a line are those of the line without annotations,
because nothing is inserted into a line.

### One vertical mapping

`RowMap` (`src/row_map.rs`) is the only code that converts between a vertical pixel and a source line.
It holds the height of every block,
sparsely with running sums,
and answers `block_top(line)`,
`code_top(line)`,
`code_bottom(line)`,
`height()`,
`locate(y)`,
`line_at(y)`,
and `page(offset, height, forward)` by binary search.
Painting,
hit testing,
caret and selection geometry,
find rectangles,
line numbers,
caret following,
the reveal of search results and jump targets,
the page keys,
scroll restore after a reload,
the line range reported for inlay hints,
and the language popup's anchor all ask it;
nothing else multiplies a row number by a row height.
Blocks come from `Annotations::assemble` (`src/annotation/blocks.rs`),
which packs a line's hints once per snapshot and scale and counts message rows without shaping.

### Stability

Rows arrive after the text is shown,
hints and diagnostics separately,
and they take space,
so the rules for what may move are part of the placement.

- Rows for lines before the first visible line move no visible pixel.
  The view keeps the distance between its scroll offset and the code row of its first line (`rows::settle`),
  and a view at the very top stays there.
- Rows for a visible line move only the lines after it,
  by the height of the block:
  26 px for one row and 16 px for each further row.
- While the reader scrolls,
  a change that would move the scroll offset waits until the offset has been still for 200 ms
  (`rows::SCROLL_QUIET`),
  so a wheel animation is never cut short.
  A render that comes after a scroll step whose change handler has not run yet
  (the window's offset differs from the one last placed) counts as scrolling too;
  under host load a recording showed such a render moving the first visible line by 3 px before this rule.
  Underlines are drawn at once;
  they take no space.
- After an external change the rows of the replaced text are not painted,
  but their space is held over every line the change left in place (`rows::hold`).
  Hint space is given up when hints for those lines arrive.
  Message space is kept for 1 s (`rows::ROW_HOLD`) whatever arrives,
  because diagnostics can come in several answers,
  and then all held space is given up.
  A server that gives the same hints and messages within that time moves no line.
- A first open has nothing to hold:
  hints and diagnostics each move lines once when they arrive.
- The vertical scroll range is the sum of the code rows and the blocks known so far.
  It grows as hints arrive for lines further on.
  The source view has no scroll bar,
  so nothing shows that growth.
- A caret line before the view is revealed together with its block.
  A search result or jump target is revealed from the top of its block.

Measured on frames recorded from the nested compositor
(commands and frame names are in `design/README.md`, entry "2026-10-05 hint rows"):

- Injected hints for the first lines of the scene moved line 2 by 26 px,
  line 3 by 68 px,
  line 4 by 158 px,
  lines 5 to 13 by 184 px,
  and lines 14 to 20 by 210 px,
  in one frame;
  line 1 did not move.
  Diagnostics injected 3 s later moved lines 5 and 6 by 16 px,
  line 7 by 42 px,
  and line 8 by 164 px;
  lines 1 to 4 did not move.
- An external change with annotations returning 0.3 s and 0.7 s later changed three frames
  and moved no code row.
- With diagnostics returning 3 s later,
  message space was given up 1.01 s after the reload (lines moved up by 16, 42, and 164 px)
  and taken again when the diagnostics arrived, 3.16 s after it.
- With a TypeScript 7.0.2 server,
  hints and diagnostics arrived within 1 ms of each other at the first open
  and moved lines once;
  after an external change the rows were back within 0.04 s and no code row moved.
- 42 wheel notches sent while hints and diagnostics arrived
  gave 30 kept frames in which every code row found again moved by one common amount,
  never backwards;
  the rows appeared in one frame 0.32 s after the last render that deferred them,
  with the first visible lines unmoved and the lines after them moved by 26 to 256 px.
- Times come from the application's log:
  host load from other sessions dropped up to two thirds of the recorded frames.

The native tests `rows_arriving_in_view_move_only_lines_beneath_them`,
`rows_arriving_above_the_view_move_no_visible_pixel`,
`rows_above_the_view_wait_until_scrolling_has_stopped`,
`a_reload_holds_row_space_until_annotations_return`,
and `scrolling_across_annotated_lines_is_rigid` in `src/native/annotation_stability_tests.rs`
pin on rendered pixels which lines may move and by how much.

### Diagnostic marks

Each diagnostic is underlined under the characters it marks,
using the same range geometry as selection,
so tabs,
CJK,
combining marks,
and ligature halves are covered exactly.
Severity has three visible channels besides color:
the underline style,
the severity word that starts each message row,
and a letter in the gutter.

- Error: a wavy line and `E`.
- Warning: a dashed line and `W`.
- Information: a dotted line and `I`.
- Hint: sparse dots and `H`.

#### Gutter letters

The user decided on 2026-10-06 that severity is a plain letter in front of the line number,
not an icon or a boxed marker,
and then that the letter stands close to the number, not a long space away.
A line where diagnostics start shows the letter of the worst of them in that severity's ink:
JetBrains Mono at the line numbers' 15 px,
bold,
in a cell one letter wide that ends 4 px before that line's own number,
whatever the number's digit count.
Measured on rendered frames
(`the_letter_stands_the_same_gap_before_one_two_and_three_digit_numbers`),
6 blank pixel columns lie between the letter's ink and the number's ink before `1`, `10`, and `100` alike
(the 4 px gap plus the side bearings of the two glyphs, antialiased edges counted as ink),
where 1 blank column lies between the digits of `10`:
the letter reads as a mark before the number and not as one more digit,
and stands closer to it than one digit advance.

From its left edge the gutter holds 6 px,
the 9 px letter cell,
the 4 px gap,
the number column,
and the 12 px before the text, unchanged.
The number column is as wide as the displayed file's widest line number, with at least three digits,
which is Helix's default minimum
(`min_width: 3` in `helix-view/src/editor.rs`, applied in `line_numbers_width` in `helix-view/src/gutter.rs`).
Both widths are measured from the font (`letter-probe` and `number-probe` in `ui/app.slint`)
and rounded to whole pixels:
9 px per digit and per letter,
so a file of fewer than 1000 lines gets a 58 px gutter at scale 1;
like every logical length it is multiplied by the display scale.
The letter's room is there on every line,
so neither the text nor a line number moves when diagnostics arrive or go.
Text moves right by one digit when the displayed file's line count gains a digit past 999,
as in Helix
(`the_gutter_gains_a_digit_past_999_lines_and_the_pointer_follows`).
The empty line after a final terminator has a number of its own and counts.
Every horizontal position in the source view,
hit testing,
find rectangles,
the caret,
selection,
underlines,
and the virtual rows,
is measured from the one `gutter-width` property of `ui/app.slint`,
so all of them follow the gutter;
native code is told the width of the view right of the gutter and never the gutter's width itself.

A range over several lines shows its letter on its first line only,
where its message rows stand.
The letter belongs to the diagnostics of the displayed text:
after an external change it goes with the message rows and returns with the new diagnostics.
`I` and `H` extend the user's `E` and `W` by the same rule; that extension is open to the user's veto.
Native code hands the window one number per materialized line (`State::line_marks`, set in `rows::present`),
taken from the first message row of the line's block, which names the worst severity,
and the line count that sizes the number column.

Open to the user's veto:
the 4 px between letter and number,
the 6 px before the letter,
and the three-digit minimum.
Without the minimum,
text in a file of fewer than 10 lines would start 18 px further left than in a file of 100 lines or more,
and would move whenever the line count crosses 9 or 99.

A diagnostic without a severity is shown as a warning, as Helix shows it.
A range over several lines underlines each of its rows and marks a crossed line end like a selected terminator,
so an empty line inside it stays visible.
A point range gets a mark one terminator wide:
after the text at a line end,
centered on its position elsewhere.
Where ranges overlap,
the mildest severity is drawn first and the worst on top.
Inside a selection an underline keeps its style but takes the selected-text ink,
as selected glyphs do:
the light-scheme severity inks reach only 1.16:1 to 1.39:1 against the selection fill `#0078D4`.

Severity inks have a light and a dark value each (`ui/annotation.slint`):
the WinUI system critical and caution fill colors for errors and warnings
(`SystemFillColorCritical` and `SystemFillColorCaution` in `microsoft/microsoft-ui-xaml`,
`controls/dev/CommonStyles/Common_themeresources_any.xaml`),
the accent pair of Slint's fluent style for information,
and a neutral gray for hints.
Measured on rendered frames (`rows_and_marks_render_in_both_schemes_with_measured_contrast`),
against the light background hint rows reach 8.36:1,
error rows 5.42:1 to 5.46:1,
warning rows 5.06:1,
information rows 6.06:1,
and hint-severity rows 5.93:1;
against the dark background 8.78:1,
8.39:1,
12.91:1,
9.47:1,
and 8.22:1.
Gutter letters, measured the same way (`gutter_letters_show_the_worst_severity_in_front_of_the_line_number`),
reach 5.42:1 (`E`),
5.10:1 (`W`),
and 6.05:1 (`I`) against the light background,
and 8.39:1,
12.91:1,
and 9.47:1 against the dark one.

### Cost and invalidation

Accepting diagnostics groups their messages by line and wraps them once.
Accepting hints groups them by line;
a line's hints are shaped and packed the first time its block is assembled,
then kept until another answer covers the line or the display scale changes.
The vertical mapping is rebuilt only when the store,
the text,
or the scale changed (`rows::refresh`).
Each render takes the blocks and the diagnostics of the materialized rows with binary searches.
That visible part is a frame-stamp input:
a snapshot change outside the materialized rows repaints nothing,
installing the same snapshots again does nothing,
and rows that appear before the view only move the cached frame (`ShapedView::rebase`).
A repaint shapes one layout per visible hint and message row
and checks each visible diagnostic against each materialized row.
Rows that end past the widest line extend the horizontal scroll range.
Gutter letters are read from the blocks of the materialized lines on every render,
and the window's list of them is changed only where a letter changed.

### Inspection

Debug builds started with `IDE_INSPECT_ANNOTATIONS` naming a JSON file show that file's hints and diagnostics
for the displayed text (`src/native/inspect.rs`),
for nested-compositor frames without a language server.
The file may give delays after which hints and diagnostics arrive,
separately,
and delays after which they arrive again following each external reload.
Such a window starts no language worker:
a worker without servers reports "no problems" for the displayed text,
which would replace the file's diagnostics.
Release builds do not contain this path,
and without the variable it does nothing.

`inspect:native dark annotations` and `inspect:native light annotations` write such a file for a fixture
whose first lines hold one case each:
several hints on one row,
hints that would touch,
a tab and CJK line with a hint and a message,
one message,
every severity on one line,
a long message,
a message with line breaks,
a range over several lines,
and hints together with messages;
further lines make the file long.
`IDE_NATIVE_ANNOTATION_DELAYS` and `IDE_NATIVE_ANNOTATION_RELOAD_DELAYS`,
each `HINTS,DIAGNOSTICS` in milliseconds,
set the delays,
and `IDE_NATIVE_SCALE` starts the nested output at another scale.
A parent compositor that cannot make a window of the scaled size keeps the nested window smaller;
the compositor's `scale` control command switches the scale of a running session without that limit.

### Differences from editord

editord draws the same rows over each line in Inter,
hints first and each diagnostic on a row of its own at its column.
Deliberate differences:

- Position: editord pads rows with spaces whose width it estimates from one measured ratio.
  Here a hint or message starts at the pixel x the shaper gives its character.
- Hint gap: editord lets a hint follow the previous one as soon as its column is reached,
  counted in characters.
  Here 8 px must stay free,
  measured in pixels.
- Hint labels: editord strips a type hint's leading `: ` and a parameter hint's trailing `:`.
  Here labels are shown as the server sent them.
- Message text: editord writes `error(rustc): message`.
  Here the row reads `Error E0308 (rustc): message`,
  with the code.
- Message ink: editord colors a line's whole block,
  hints included,
  in the worst severity's color,
  and shows severity by color alone.
  Here each message has its own severity's ink and word,
  hints keep the hint ink,
  underline styles differ,
  and the gutter shows the worst severity's letter in front of the line number.
- Order and caps: editord lists messages in the server's order and wraps them to the editor's width without a cap.
  Here they are listed worst first,
  wrap at 80 characters,
  and are capped per message and per line.
- Spacing: editord gives every row a line height of 1.5 and no extra gap.
  Here rows are 16 px with a 10 px gap before the block.
- Arrival: editord lets the page reflow when rows arrive.
  Here the view is held still for rows before it,
  waits for scrolling to stop,
  and holds row space across a reload.

`test:annotations` covers the vertical mapping,
the row rules,
the store,
layout,
painting,
the frame stamp,
and the measurements of inline placement kept in `tests/annotation_placement.rs`.
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

The displayed file is reread by a bounded background worker when a change notification names it;
see [Change watching](#change-watching).
External changes map the latest caret,
selection,
and viewport through Helix correspondence,
even while text remains selected.
Read failures retain the last readable source and show a diagnostic until recovery.
The concrete caret and replacement-selection cases in the accepted scope pass through the native GUI.

## Change watching

The tree and the displayed file follow external changes through Linux inotify,
using the `notify` crate 8.2.0 (`INotifyWatcher` by name, default features off, no polling backend).
Only what is shown is watched,
each directory non-recursively:
the project root,
every visible expanded folder,
and the displayed file's folder,
even when the tree does not show that folder.
Collapsing a folder removes its watch;
folders inside a collapsed folder stay expanded in the tree but are not watched.
A folder is watched only at its own canonical path inside the project root,
so a symbolic link to a folder elsewhere,
or to another folder of the project,
is never watched.
The watcher only reads.

A notification carries no data.
It marks a directory listing or the displayed file as due,
and the existing bounded readers reread;
their request identity and stale-reply fencing still decide what is shown.
A burst of notifications for one folder becomes one pending reread,
with at most one more after a read already under way.
A notified folder or file is not reread sooner than 100 ms after its previous read started:
a single change is read at the next 20 ms timer tick,
and a folder or file that changes continuously,
such as build output or a busy log,
is reread at most 10 times per second.
The IDE's own opens and reads of watched paths are not changes and are ignored.
A new watch rereads its folder once more,
because a change can land between the first listing and the watch;
a newly displayed file is read once more for the same reason.
A permission change on a watched folder rereads that folder.

For the displayed file,
a closed write,
a rename into place,
a removal,
and a permission change are read at once.
A write that is still open,
including the truncation that starts an in-place save,
and a newly created file are read once 150 ms pass without another write,
and at most 250 ms after the first.
The latest notification decides,
so a save that deletes and rewrites the file waits for the rewrite.

### Recovery and timers

A full reread of every shown folder and the displayed file follows:
an inotify queue overflow (`IN_Q_OVERFLOW`),
an error from the notification stream,
a watched folder that is removed or renamed,
a watch that cannot be added,
including at the `fs.inotify.max_user_watches` limit,
and a watcher that cannot start or stops.
Each is logged.
A renamed folder's watch is removed,
because inotify keeps following the moved directory under its old name.

A shown item without a live watch keeps the previous timers:
the displayed file every 250 ms,
and unwatched folders one at a time every 500 ms.
Failed watches are retried every 10 s.

Every 10 s,
every shown folder and the displayed file are reread anyway,
after all notified work.
inotify never reports some changes:
network and FUSE mounts,
writes through `mmap`,
and unmounts (`notify` does not map `IN_UNMOUNT`).
The sweep bounds how long those stay stale.
It costs one listing per shown folder and one source read per 10 s,
against 20 listings and 40 source reads per 10 s under the previous polling.

### Threading and shutdown

A watch thread owns the watcher and applies the set of shown folders,
because adding a watch blocks until notify's own event thread answers.
notify's event thread records notifications into state the UI timer drains every 20 ms.
Closing the window closes the watch thread and joins it;
dropping the watcher makes notify remove its watches and close its descriptor.
notify starts its event thread detached,
so that thread is not joined.
A watch call stuck on a hung filesystem delays window close,
as a stuck directory or file read already does.

### Measured refresh latency

`inspect:refresh-latency` times an external write until the tree row or the source text changes,
through the shipped bindings in the headless window,
16 trials per case,
three runs per build,
with the same pseudo-random write gaps and target folders in both builds.
Polling (`48a1b5756`):
a new file in one of 8 expanded folders took a median of 1657 to 1706 ms across runs,
at most 4035 ms;
with one expanded folder,
651 to 785 ms,
at most 988 ms;
a rewrite of the displayed file,
115 to 147 ms,
at most 281 ms.
Watching:
a new file took a median of 29 to 35 ms with 8 folders and 31 to 35 ms with one,
at most 96 ms;
a rewrite took 44 to 56 ms,
at most 92 ms.
The medians of one build differed between its runs by at most 134 ms under polling and 6 ms under watching.

### Deliberate differences from editord

editord watches each folder with chokidar when it is first expanded and keeps the watch after collapse;
this reader removes it on collapse.
editord refreshes the displayed file only through its folder's watch,
so a file opened from search in a collapsed folder is not refreshed there;
this reader always watches the displayed file's folder.
editord ignores events for `.git`,
`node_modules`,
editor swap,
and temporary file names;
this reader lists those names like any other,
so their changes appear.
editord waits for a file's size to stay unchanged for 150 ms (`awaitWriteFinish`) before reporting it;
this reader reads closed writes at once and waits 150 ms only for writes still open.
editord drops a folder's watch on an error;
this reader rereads everything shown,
keeps that folder on a timer,
and retries the watch.
editord has no overflow handling or periodic reread.

### Change-watching checks

`tests/change_watch.rs` runs the watcher over disposable folders:
entry changes,
moves in and out,
the extra read after a new watch,
collapse removing the kernel watch,
finished and unfinished writes,
silence for the IDE's own reads,
a real queue overflow,
a notification error,
removed,
renamed,
failed,
and retried watches,
refused outside and symbolic-link folders,
and no watch left after shutdown.
`tests/refresh_policy.rs` pins the intervals.
`native::watch_tests` checks the shipped tree and source in the headless window.
`inspect:watch-guards` removes each guard in a disposable copy and requires its named test to fail.
In the nested compositor,
dark and light,
external create,
rename,
and delete in an expanded folder,
and both correspondence examples through atomic replace,
show without polling.

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
