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
stays between 160 px and the window width minus the divider's 1 px line and a 240 px source column,
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

The divider is a 1 px line with no strip beside it.
Each state is marked by more than color:

- at rest,
  one faint column;
- under the pointer,
  the column-resize cursor and three columns in stronger ink;
- during a drag,
  the cursor and three columns in full ink;
- with keyboard focus,
  three columns in the accent color
  and a 5 px by 48 px handle in the same color in the middle of the line.

### Divider hit area

The divider's layout cell is its 1 px line,
so the tree and the source column meet at it.
Its pointer zone is 5 px wide over the whole window height:
the line's column and two columns on each side.
At sidebar width `W` those are the tree's last columns `W-2` and `W-1`,
the line at `W`,
and the source column's first columns `W+1` and `W+2`.
A press there starts a drag and does nothing else.
The zone takes presses only:
a wheel turn over it scrolls the tree or the source under it.

The zone is narrower than the 48 px minimum that every other interactive element of this application keeps.
The user decided this on 2026-10-05 for this one element:
the application runs on desktops only,
every desktop has a pointer and a keyboard,
dragging the divider is rare,
and the width is also adjustable by keyboard.
The exception does not extend to any other element.

What the zone covers,
measured in `ui/tree.slint`,
`ui/app.slint`,
and the toolkit's fluent scroll bar (Slint 1.18.1 `widgets/fluent/scrollview.slint`):

- Tree columns `W-2` and `W-1`.
  Rows span the whole tree width,
  and their text ends 12 px before the edge,
  so a row loses two columns of padding as a click target.
  When the tree overflows,
  its 14 px scroll bar lies over columns `W-14` to `W-1`.
  The thumb is drawn in columns `W-6` and `W-5`,
  or `W-10` to `W-5` under the pointer,
  and the arrow buttons take columns `W-11` to `W-4`,
  so the zone covers none of them.
  The bar scrolls by a drag that starts anywhere on its width;
  such a drag can no longer start on its last two columns.
- Source columns `W+1` and `W+2`.
  They are the first two of the 56 px line-number gutter.
  Line numbers are right-aligned and end 12 px before the text,
  and a gutter click puts the caret at the start of its line from any gutter column.
  Source text and selection rectangles start at `W+57`.
  Above and under the source view the zone lies in the 12 px padding of the file label and of the find bar.

### Pointer zone precedent

The zone's width follows desktop toolkits,
read from their sources on 2026-10-05:

- Qt gives a splitter handle narrower than 4 px a grab area of 4 or 5 px:
  `QSplitterHandle::resizeEvent` adds `(5 - handleWidth) / 2` px of margin on each side,
  5 px for a 1 px handle
  (`qt/qtbase` at `f127f11f`, `src/widgets/widgets/qsplitter.cpp` lines 208 to 221).
  KDE's Breeze style sets the handle width to 1 px
  (`KDE/breeze` at `fab6402a`, `kstyle/breezemetrics.h` line 169),
  so Breeze applications show a 1 px line with that 5 px grab area.
  Once the pointer is on a handle,
  Breeze also places a 24 px square proxy under it that keeps the drag reachable
  (`kstyle/breezesplitterproxy.cpp` line 312,
  `SplitterProxyWidth` 12 in `kstyle/breeze.kcfg`).
  Qt's Fusion style uses a 4 px handle
  (`src/widgets/styles/qfusionstyle.cpp` lines 2630 to 2632).
- Visual Studio Code's sash is 4 px wide and centered on the boundary
  (`microsoft/vscode` at `729f257f`,
  `workbench.sash.size` default 4 in `src/vs/workbench/contrib/sash/browser/sash.contribution.ts` lines 22 to 26,
  `src/vs/base/browser/ui/sash/sash.ts` lines 147 and 667).
- GTK 4 extends a paned separator's pointer area by 6 px on every side unless `wide-handle` is set
  (`GNOME/gtk` at `c2a232c4`, `gtk/gtkpaned.c` lines 131 and 297 to 310),
  and libadwaita draws the separator 1 px wide
  (`GNOME/libadwaita` at `19098711`, `src/stylesheet/widgets/_paned.scss` lines 2 to 4),
  which makes 13 px.

Qt's 5 px for a 1 px handle is used.
Visual Studio Code's 4 px cannot be centered on a 1 px line.
GTK's 6 px on the tree side would cover the scroll bar's thumb in columns `W-6` and `W-5`.
Three columns on each side would still clear the thumb and the arrow buttons;
four would cover the buttons' last column.

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

`test:native` drives the divider with real pointer and key events:
a drag from each of the zone's five columns and from the first column on each side of it,
clicks on the zone and on the pixels beside it at the default,
narrowest,
and widest widths,
a tree scroll-bar drag from the last column left of the zone,
a wheel turn over the zone's tree columns and source columns,
and the rendered columns of every state.
`inspect:sidebar-guards` removes each width bound,
each edge of the zone,
and each keyboard-focus mark in a disposable copy
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
  the toolkit's `TextInput` replaces pasted line breaks with spaces.
- The find input is the application's own text box,
  the same one combined search uses;
  see [Find and search text box](#find-and-search-text-box).

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

## Find and search text box

The find text and the search query are edited in `QueryInput` (`ui/query-input.slint`),
a single-line box built on the toolkit's `TextInput` item.
It replaces the toolkit's fluent `LineEdit` because of that widget's clear control:
a cell 16 px wide whose width cannot be set from outside
(Slint 1.18.1 `widgets/fluent/lineedit.slint` lines 58 to 67,
`widgets/common/lineedit-base.slint` lines 189 to 196).
The user decided on 2026-10-05 to keep the control and give it a click target of at least 48 px by 48 px.

### Clear control

The x at the trailing end of the box empties the text.
Its click target is a 48 px by 48 px layout cell of the box:
the glyph is 16 px in the middle,
and the rest of the cell is padding that takes the click.
Being a layout cell,
it is never drawn over the text or over anything beside the box.
While the control is hidden,
the same cell is the box's 12 px trailing padding.

The control follows the toolkit's rule for when it exists:
the box has text,
is enabled,
and has keyboard focus.
A click empties the text,
reports the edit,
so the find count and highlights or the search results go with it,
and leaves keyboard focus in the box.
A press released outside the cell clears nothing.
As in the toolkit,
the control is not a Tab stop;
from the keyboard,
Ctrl+A and Delete empty the box.

Each pointer state has two marks:

- at rest,
  the glyph alone;
- under the pointer,
  a filled plate with a 1 px boundary;
- pressed,
  a stronger fill and a 2 px boundary.

Accessibility tools see a `button` named `Clear find text` or `Clear search query`
whose default action clears.
The toolkit's control is not exposed to them at all.

### Behavior kept from the toolkit box

Read from `widgets/common/lineedit-base.slint` and `widgets/fluent/lineedit.slint` of Slint 1.18.1:

- The placeholder shows while the text and any input-method composition are both empty.
- Selected text has the palette's selection fill and the palette's accent ink,
  which is black in the dark scheme and white in the light one.
  The source view and selected rows choose their ink from the fill instead;
  see [Selected text ink](#selected-text-ink).
- A text wider than the box scrolls with the caret:
  while the caret moves through the text it stays 24 px inside the text area,
  and the end of the text reaches the area's edge.
- A right click opens a menu with Undo,
  Redo,
  Cut,
  Copy,
  Paste,
  and Select All;
  Copy and Select All are disabled while the box is empty.
- Editing keys,
  clipboard shortcuts,
  undo,
  redo,
  and input-method composition are `TextInput`'s own
  (`i-slint-core` 1.18.1 `items/text.rs`),
  so they are the same in both boxes.
- Focus is marked by a 2 px accent line along the bottom edge and a different fill.
- Accessibility tools see a `text-input` with its label,
  value,
  placeholder,
  and enabled state,
  and can set the value and the selection.

Not carried over,
because nothing here uses them:
the password and read-only modes,
the `accepted` callback,
and the key callbacks.

### Text box checks

`test:native` drives both boxes with real window events:

- a click on each corner pixel and on the center of the find box's clear cell clears,
  a click one pixel outside each edge does not,
  the cell's measured size is 48 px by 48 px,
  and clearing keeps focus and removes the find count and the highlights;
- the search box's clear cell has the same size,
  and clearing removes the results and keeps focus;
- editing keys,
  every entry of the context menu,
  and scrolling of a text wider than the box,
  which never reaches the clear cell;
- rendered pixels in both schemes:
  placeholder,
  focus marks,
  selection colors,
  and the clear control's three states.

`inspect:find-guards` and `inspect:search-guards` remove the cell's size,
its whole-cell click target,
its edit report,
and each half of its shown rule in a disposable copy
and check that the named tests fail.
Input-method composition was not exercised:
the toolkit's public window events carry no composition event,
and the nested compositor provides no input method.
Accessible properties were read from the running application
through the toolkit's inspection server during the native frame captures;
see `design/README.md`.

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

Inlay hints and pull diagnostics are requests the worker makes on its own:
when a file is displayed,
 after a reload,
 and when `request_hints` reports the visible lines.
Nobody else would ask again,
so a request the server supersedes (`-32801` or `-32800`)
or leaves unanswered for its whole request timeout
is sent again up to 3 times,
and a hint request names the lines reported last.
After that the server owes the answer (`src/language/owed.rs`):
its next message of any kind makes the worker ask once more,
at most 3 times for one displayed text.
A failure the server states itself is final for that text.
A definition,
 references,
 or hover request that times out is reported to its caller as a timeout and is not sent again.

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
`IDE_SCRIPTED_STALL_AT` and `IDE_SCRIPTED_STALL_MS` hold the scripted server's read loop once,
before the first message of the named method,
so `tests/language/again.rs` makes a request time out without any load on the machine.
`IDE_LANGUAGE_TEST_LOG=1` makes a session print the worker's debug log
and the helix-lsp protocol log to standard error.
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
 edit-refusal,
 and ask-again guards in a disposable copy
and checks that their named tests fail.

`inspect:language-lifecycle` opens a file,
sends one hover,
closes,
and lets the worker shut down against the same real confined servers.
It fails on any ERROR-level record,
on bare shutdown error text such as `context canceled`,
and on any leftover process.
Its second part ends the application process with `SIGKILL`
and records which server and sandbox processes remain after 0, 1, 5, and 10 seconds.
The quiet-shutdown checks fail at present, for causes outside this package:
`helix-lsp` logs server standard-error lines,
the end of that stream,
and error responses at ERROR
(`doc/troubleshooting/helix-lsp-transport-error-level-records.md`);
the TypeScript 7 server reports its own exit as `context canceled`
(`doc/troubleshooting/typescript-7-lsp-exit-context-canceled.md`);
and rust-analyzer warns about a user configuration file that does not exist
(`doc/troubleshooting/rust-analyzer-notify-missing-user-config.md`).
`tests/language/quiet.rs` is the scripted-server form in the container suite:
the enforced test allows `helix-lsp`'s end-of-stream record and nothing else at ERROR,
and the ignored strict test is the acceptance test for whichever handling is adopted.
`inspect:language-lifecycle-guards` observes both in a disposable copy,
together with the worker's shutdown request,
its wait for servers to end,
and its reaping.

When its handle is dropped,
the worker sends `shutdown` and `exit` to every server,
waits up to one second for the processes to end,
and drops its runtime, which kills every server that is left.
It then waits, for at most two more seconds,
until the kernel lists no child process of the worker thread (`src/language/reap.rs`),
so an ended server is not left in the process table as a zombie.
`lifecycle::server_that_ignores_exit_is_killed_and_reaped_before_the_drop_returns` covers a server
that ignores `exit` and the end of its input (`IDE_SCRIPTED_LINGER=1`).
A killed process that the kernel needs more than two seconds to end,
which was seen in measurements where processes stalled for seconds,
stays a zombie until the application exits.
`inspect:language-reap-rate` counts leftover processes by kind over many lifetimes,
with the reaping and with the fixed 50 ms pause it replaced;
`doc/troubleshooting/tokio-dropped-child-zombie-after-last-park.md` has the source trace and the measurements.

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
and a boundary,
and its text is drawn in the ink described under [Selected rows](#selected-rows).
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
- a server that was not started because it could not be confined:
  `typescript-native was not started, so go to definition is not available for this file:`
  followed by the cause and, last, the remedy the launch policy names;
- a server that cannot follow external changes,
  a failed start,
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
While the hover popup,
a note,
or the location list is shown,
the caret's problem card is hidden so the two never overlap;
its text stays in the source view's accessible description.
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
For a running language server the caller is the language poll in `src/native/language/poll.rs`,
through the `accept_` methods;
tests and the path described under "Inspection" inject snapshots with `set_annotations`.

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

Severity inks have a light and a dark value each:
the WinUI system critical and caution fill colors for errors and warnings
(`SystemFillColorCritical` and `SystemFillColorCaution` in `microsoft/microsoft-ui-xaml`,
`controls/dev/CommonStyles/Common_themeresources_any.xaml`),
the accent pair of Slint's fluent style for information,
and a neutral gray for hints.
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

### Selected rows

The selected row of the tree,
of the search results,
and of the location list draws its text and marks in the ink native code chooses from the selection fill.
It is the rule of [Selected text ink](#selected-text-ink) in `src/selection_ink.rs`,
applied in `src/native/render.rs`.
With the fluent palette that ink is white on `#0078D4` in both color schemes,
where the palette's own selection ink is black in the dark scheme.
The user chose this on 2026-10-05.

Measured on rendered frames in both schemes
by `selected_rows_use_the_ink_chosen_from_the_fill_with_measured_contrast`:

- White on the fill reaches 4.53:1.
  That holds for the tree's file name,
  its slot badge,
  the location list's label and detail,
  and both lines of a search result,
  whether or not the list has keyboard focus.
  No part of a selected row is dimmed:
  all of it uses the one ink at full opacity.
- A selected tree row under the pointer or with keyboard focus is tinted.
  The tint is the opposite of the ink,
  black under white ink,
  so it moves the fill away from the text:
  the fill becomes `#006EC3` and the ratio 5.23:1.
  Tinted with the foreground ink,
  as unselected rows are,
  the dark scheme's fill became `#1482D7` and the ratio fell to 4.04:1.

`inspect:theme-guards` removes the ink choice and reverses the tint in a disposable copy
and checks that the test fails.

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
The same inotify instance also watches the project's source folders for the language servers;
see [Watching for the language servers](#watching-for-the-language-servers).
Only what is shown is watched,
each directory non-recursively:
the project root,
every visible expanded folder,
and the displayed file's folder,
even when the tree does not show that folder.
A displayed file outside the project,
opened from a language target such as a standard-library source,
is not watched and is not a watch failure:
the safety sweep rereads it.
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
and a newly created file are read once 50 ms pass without another write,
and at most 100 ms after the first.
The user chose both values on 2026-10-05.
While such a write waits,
neither the safety sweep (the periodic reread in [Recovery and timers](#recovery-and-timers))
nor a highlighting request reads the file.
The latest notification decides,
so a save that deletes and rewrites the file waits for the rewrite.
A writer that leaves the file unfinished for longer than the quiet period is read mid-write,
and read again when it closes the file.

A read that no write notification asked for accepts the file only when it has been quiet:
the safety sweep,
the timer of an unwatched file,
a highlighting retry,
the first read,
and the reread after a new watch,
a newly displayed file,
or lost events.
The reader asks the open file for its modification time after reading;
when that time lies less than 50 ms before the read began,
or during the read,
or after the current time,
the bytes are dropped and the file waits like an unfinished write.
The check depends on the file alone,
so no order of timers and notifications lets such a read show a save in progress;
see [Measured write wait](#measured-write-wait).
A file system that keeps modification times in whole seconds can let a save through this check.

### Recovery and timers

A full reread of every shown folder and the displayed file follows:
an inotify queue overflow (`IN_Q_OVERFLOW`),
an error from the notification stream,
a watched folder that is removed or renamed,
a watch that cannot be added,
reaching the `fs.inotify.max_user_watches` limit,
and a watcher that cannot start or stops.
Each is logged once.
A renamed folder's watch is removed,
because inotify keeps following the moved directory under its old name.

A shown item without a live watch keeps the previous timers:
the displayed file every 250 ms,
and unwatched folders one at a time every 500 ms.
Failed watches are retried at each safety sweep,
while anything shown lacks a watch.
A failure is logged and followed by the full reread once,
and again only when its error text changes;
a watch that works again is logged once.

The watch limit counts the watches of every program the user runs,
so reaching it is one state rather than one failure per folder.
The first refused watch logs one warning that names the sysctl,
rereads everything shown once,
and stops adding watches in that pass.
The safety sweep then retries after 2 s,
doubling the wait after each refused retry up to 64 s.
Expanding,
collapsing,
switching files,
and scrolling the tree (at most once a second) retry at once
without lengthening the wait.
The displayed file's folder is tried first.
When every shown folder has a watch again,
one line says so.
Folders without a watch keep the timers and the sweep meanwhile.
See [Watch counts and the watch limit](#watch-counts-and-the-watch-limit).
Folders watched for the language servers come after these and have their own limit state.

Every second,
every shown folder and the displayed file are reread anyway,
after all notified work:
the safety sweep.
The user chose the 1 s interval on 2026-10-05.
inotify never reports some changes:
network and FUSE mounts,
writes through `mmap`,
and unmounts (`notify` does not map `IN_UNMOUNT`).
The sweep bounds how long those stay stale.
One directory read starts per 20 ms timer tick,
so one pass over more than about 50 shown folders outlasts the second.
The next pass then starts when the previous one has read every folder,
and each folder is reread once per pass.
The sweep costs one listing per shown folder and one source read per second,
where the previous polling did 2 listings and 4 source reads per second whatever was shown;
see [Measured idle cost](#measured-idle-cost).

With the sweep at 1 s,
the 500 ms timer for unwatched folders shortens the longest time a folder goes unread
only when one to three shown folders lack a watch:
500 ms for one,
900 ms for two,
980 ms for three,
and the sweep's 1 s from four
(`tests/refresh_intervals.rs` prints these from the shipped schedule).
The 250 ms timer for an unwatched displayed file stays four times as frequent as the sweep.
Both timers are kept.

### Watch counts and the watch limit

The IDE holds one watch per shown folder:
2 with one expanded folder,
13 with 12,
and 101 with 100,
counted from its inotify descriptors in `/proc` (`inspect:idle-cost`).
Watching only the folders in the tree's viewport was measured as the alternative
(`inspect:watch-scope`, 60 expanded folders, three runs each):
it held 5 watches instead of 61,
but in 48 of 60 trials a folder changed while out of view showed its old listing
for a median of 61 to 85 ms per run,
at most 148 ms,
after it scrolled into view;
watching every expanded folder showed the change at once in 59 of 60 trials,
1 ms late in the other.
The IDE keeps watching every expanded folder.

The language servers count against the same limit;
see [Watching for the language servers](#watching-for-the-language-servers).

The IDE's own podman tasks run their containers with `--network=none`,
except `fetch` and `runtime`, which download;
podman's default network starts a pasta helper per container,
which holds an inotify watch and warns when the limit is reached.

A positive control runs the IDE in a disposable user namespace whose own watch limit is 4
(`inspect:watch-limit`, 12 expanded folders, the host limit untouched):
in each of two runs,
one warning,
no per-folder warning,
4 and 3 refused watch calls in 60 s with 59 and 60 sweeps,
a file created in an unwatched folder listed after 629 and 751 ms,
and one line 63.8 and 61.3 s after the namespace limit was raised,
the backoff's longest wait.
In the second run,
Home in the tree scrolled it and retried the watches 43 ms later,
with no watch call in the 1.5 s before.

### Watching for the language servers

Language servers learn about changes made outside the editor through `workspace/didChangeWatchedFiles`.
Helix watches no files for its servers,
so its built-in rust-analyzer definition sets `files.watcher = "server"`,
and rust-analyzer then asks notify for a recursive watch of each workspace package's folder (`vfs-notify`),
which watches every folder below it,
`node_modules` included,
whatever `files.excludeDirs` says.
The TypeScript 7 server watches nothing itself:
Helix declares client-side watching,
which TypeScript 7.0.2 then relies on (`internal/lsp/server.go`),
and before this change nothing told it about other files,
so the displayed file's diagnostics did not follow a change of a file it imports.

The IDE watches for the servers.
While some server has registered file watchers (`client/registerCapability`),
the change watcher watches every source folder of the project,
each non-recursively,
on its one inotify instance,
and sends every change in them to the language worker,
without passing through the interface thread.
When no server has watchers any more,
those watches are released.
Source folders are the folders ripgrep lists files from with the search's settings (`src/search_process.rs`),
so the search and the servers agree on `.gitignore`,
`.ignore`,
`.rgignore`,
and hidden names;
hidden folders such as `.cargo` are skipped as the search skips them.
`node_modules`,
`target`,
and `.git` are never watched,
even where no ignore file names them.
ripgrep lists a folder named on its command line even when an ignore rule names it,
but applies the ignore files of its parents below it (ripgrep 15.2.0),
so a new folder is classified by scanning its parent again.
An empty folder cannot be classified by a list of files:
it is watched until its first change,
which is held back until its parent has been scanned again;
the files that scan lists in it are then sent as created,
and a new ignored folder,
such as a build's `dist`,
never reaches a server.
Scans run on their own thread.

The language worker keeps each server's registrations itself.
helix-lsp's own handler (`helix-lsp/src/file_event.rs` at the pinned revision) keeps only string patterns,
ignores the kinds a watcher asks for,
and always sends "changed",
while both rust-analyzer and the TypeScript 7 server register relative patterns.
Glob patterns follow the protocol:
`*` and `?` stay inside one path segment,
`**` spans segments,
and `{}` and `[]` group.
A watcher's kind decides which of created,
changed,
and deleted it hears,
and a server that registered nothing gets nothing.
Changes are gathered per path with the kind of its final state on disk
(a deletion after a creation stays a deletion),
and a burst is sent once it pauses for 50 ms,
or 500 ms after it began,
as one notification per server.
Each server that heard about changes is then asked for the displayed file's diagnostics again,
since another file may have changed them.
A reload of the displayed file reaches the servers the same way.
rust-analyzer is given `files.watcher = "client"`,
set in code after the definitions are merged,
because a merged `files` table replaces the whole table;
it then registers watchers and takes no watches of its own.

The tree and the displayed file come first under the watch limit.
A folder both want keeps one watch,
and collapsing it in the tree keeps the servers' watch.
When the limit refuses a watch the tree wants,
a watch held only for the servers is given up for it,
and while the tree waits on the limit,
the servers add nothing.
The servers' limit is its own state:
one warning naming `fs.inotify.max_user_watches`,
one line when every source folder is watched again,
and retries after the same growing wait (2 s doubling to 64 s),
which the watch thread schedules itself.

`inspect:server-watches` measured both on disposable projects,
with the servers confined as in production,
on a quiet host,
two runs of each case in one session
(`~/temp/agent/ide-server-watches-5jAwxc`).
The Rust workspace has 40 crates,
1080 source folders,
a `target` of 6000 folders,
a `.git` of 257,
and a `node_modules` of 2001 folders inside its first crate,
9345 folders in all.
The displayed file calls a function another file defines,
and the other file is changed outside the IDE to give it a parameter,
which rust-analyzer's own analysis reports;
`cargo check` is turned off (`checkOnSave = false`) so it cannot report the change instead.
The TypeScript project has 1000 source files,
3000 dependency packages,
12328 folders in all,
and its displayed file imports a constant whose export is removed outside the IDE.

#### Before: the build at `45db45d02`

- rust-analyzer watched by itself: 3081 watches in both runs, 1080 for sources and 2001 for `node_modules`.
- TypeScript: no watches at all.

#### After: the IDE watches for the servers

- Rust: 1082 watches in both runs, all held by the IDE and all on source folders; rust-analyzer held none.
  The displayed file's diagnostic appeared 2008 and 745 ms after the write.
- TypeScript: 42 watches in both runs, all held by the IDE; the diagnostic appeared after 102 and 60 ms.

#### Positive control: the same build without forwarding

- Rust and TypeScript: no watches, and the diagnostics stayed unchanged for 60 s in both runs of each.

On this repository,
ripgrep lists files in 1549 folders,
the count the IDE would watch for a server with the repository as its project.

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
The runs of the two builds alternated in one session on a busy host,
with a load average of 49 to 156 on 16 processors.
Polling (`48a1b5756`):
a new file in one of 8 expanded folders took a median of 1672 to 1789 ms across runs,
at most 4038 ms;
with one expanded folder,
671 to 789 ms,
at most 1524 ms;
a rewrite of the displayed file,
93 to 148 ms,
at most 288 ms.
Watching,
with the 1 s sweep and the 50 ms write wait:
a new file took a median of 28 to 33 ms with 8 folders and 35 to 51 ms with one,
at most 115 ms;
a rewrite took 38 to 75 ms,
at most 140 ms.
The medians of one build differed between its runs by at most 118 ms under polling and 27 ms under watching.
The schedule makes a change that lands within 100 ms after a sweep read of the same folder wait for the reread gap;
with the sweep at 1 s that is about one change in ten,
and the slowest trials near 100 ms fit it.

### Measured write wait

`inspect:refresh-latency` with the filter `write_wait_pause` plays an in-place save against the headless window:
truncate,
pause,
write,
close,
with `am a` selected,
8 trials per pause length in each of three runs.
With the 50 ms quiet period and the 100 ms limit,
no trial with a pause of 10 to 50 ms showed the truncated file,
2 of 24 did at 60 ms,
4 of 24 at 70 ms,
and all 96 at 80 ms and longer.
The wait is counted from the 20 ms timer tick that receives the notification,
so the boundary lies between 50 and 80 ms.
Every trial that showed the truncated file lost the selection;
every other trial kept it on `was a`.
A copy with the earlier 150 ms and 250 ms,
measured in the same session,
showed the truncated file in all 24 trials at 200 ms and in none at 100 and 150 ms.

Two trials showed the truncated file at a pause below the quiet period:
one of 200 trials with pauses of 10 to 50 ms across five runs at the shipped values,
and one of 240 trials with pauses of 10 to 150 ms in the copy with 150 ms and 250 ms.
Their cause is not established;
the sweep is ruled out for the second,
whose save began about 200 ms after a read had restarted the sweep clock.

The filter `write_wait_timer` starts the same save,
unfinished for 40 ms,
at a pseudo-random time within the 400 ms that contain the next sweep read,
until 120 trials have counted.
A trial counts only when the file stayed truncated for less than the quiet period in real time;
on a loaded host the test thread itself can stall mid-save,
which makes the save a long one that any read may show by design.
Before the quiet check (`45db45d02`) 4,
6,
and 8 of 120 trials showed the truncated file in three runs.
With it,
none of 120 did in any of three runs,
alternating with the earlier build in one session at a load average of 63 to 99 on 16 processors.
Of the trials the stalls stretched past the quiet period,
6 of 30 showed the truncated file before the check and 1 of 41 with it.

### Measured idle cost

`inspect:idle-cost` runs the release build in the nested compositor,
expands sibling folders of eight files each through key input,
and samples the idle IDE for 60 s:
CPU time from `/proc/<pid>/stat`,
read calls from `/proc/<pid>/io`,
listings from the IDE's log,
and every system call in one further session under `strace`.
The shipped 1 s build and a build that differs only in a 10 s `SAFETY_SWEEP` alternate,
three runs each;
ranges give the lowest and highest run.

#### One expanded folder

- 1 s sweep: 3.0 to 3.2 ms of CPU per second, 59 to 67 read calls, 2 listings, 301 system calls per second.
- 10 s sweep: 2.5 to 2.8 ms of CPU per second, 50 to 52 read calls, 0.2 listings, 256 system calls per second.

#### 12 expanded folders

- 1 s sweep: 7.3 to 8.2 ms of CPU per second, 84 to 90 read calls, 12.9 listings, 561 system calls per second.
- 10 s sweep: 4.7 to 5.2 ms of CPU per second, 54 to 57 read calls, 1.3 listings, 284 system calls per second.

#### 100 expanded folders

- 1 s sweep: 45.0 to 45.5 ms of CPU per second, 154 to 168 read calls, 49.9 listings, 1353 system calls per second.
- 10 s sweep: 26.0 to 26.3 ms of CPU per second, 73 to 90 read calls, 10.1 listings, 480 system calls per second.

#### Reading the numbers

Runs of one build differed by at most 0.84 ms of CPU and 17 read calls per second.
With 100 expanded folders one pass over the 101 shown directories took 2.02 s,
so the 1 s build reads without pause,
and every directory was listed once per pass.
There the 1 s build does 40 more listings per second than the 10 s build,
for about 19 ms more CPU and about 870 more system calls per second:
about 22 calls per listing,
of which 8 are `readlink` (path resolution) and 4 are `write` (log lines).
The 10 s build's cost also grows with the tree,
from 2.5 to 26 ms of CPU per second;
it sweeps too,
at 10 listings per second with 100 folders,
and what else grows with the tree was not separated.
The IDE always logs at debug level (the filter is fixed in `src/native.rs`),
four lines per listing:
9,
52,
and 200 log lines per second at the 1 s sweep,
against 0.9,
5.3,
and 40 at 10 s.
The log is written from the UI thread,
so a log destination that blocks stalls the window;
one sample with the log on a busy disk stood still for 10 s,
and the measurement keeps its live log in memory-backed storage for that reason.
The displayed file was 640 bytes;
the sweep reads the whole file once per second,
so that part grows with the file,
and was not measured for large files.
The host was busy during the runs with one and 12 folders,
with a load average of 6 to 48 on 16 processors,
and nearly idle during the runs with 100;
the builds alternate within each run,
so each comparison shares its conditions.

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
this reader reads closed writes at once,
and for writes still open it waits 50 ms,
a shorter wait than editord's that the user chose on 2026-10-05.
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
a repeated failure reported once,
refused outside and symbolic-link folders,
and no watch left after shutdown.
`tests/refresh_policy.rs` pins the intervals.
`tests/refresh_intervals.rs` simulates the shipped schedule in 20 ms ticks:
timers leave an unfinished write alone,
a pass over more folders than one interval can read still rereads every folder,
and the unwatched timer never makes a folder staler than the sweep alone.
`native::watch_tests` checks the shipped tree and source in the headless window.
`native::write_wait_tests` plays a slow writer against that window:
an in-place save and a delete-then-rewrite are shown only when finished.
`native::quiet_read_tests` does the same for a file outside the project,
whose reads no write notification ever asks for.
`tests/quiet_read.rs` checks the reader's quiet requirement with chosen modification times
and the reread classification.
The library tests in `change_watch/reconcile_tests.rs` drive the watch limit with a fake kernel:
one state,
no further adds,
the backoff and its cap,
immediate retries,
and the displayed file's folder first.
`change_watch/server_watch_tests.rs` drives the servers' watches with a fake kernel:
one watch for a folder both want,
a server watch given up for the tree,
the servers waiting while the tree waits,
and their own limit state.
`change_watch/server_scan_tests.rs` checks the scan's ignore rules,
pruned and empty folders,
and new folders classified by their parent.
`language/watched_files_tests.rs` checks the merge rule,
glob patterns per the protocol,
kinds,
bursts,
and servers that stopped.
`tests/language/watched.rs` drives the worker and a change watcher with the scripted server,
which registers watchers from `IDE_SCRIPTED_WATCHERS`:
changes by glob and kind,
the diagnostics pull after them,
ignored,
dependency,
and unmatched files left out,
a burst of 500 changes in a few notifications,
new folders followed,
a new ignored folder never sent,
and nothing for a server without watchers.
`native::language::watched_tests` checks the same through the shipped window's language tick.
`inspect:watch-guards` removes each guard in a disposable copy and requires its named test to fail.
`inspect:idle-cost`,
`inspect:refresh-latency`,
`inspect:watch-scope`,
`inspect:server-watches`,
and `inspect:watch-limit` produce the measurements in this section.
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

## Release build and application directory

`mise run //package/desktop-app/ide:build:release` builds the optimized `monochromatic-ide` binary
in the bounded container described under [Build boundary](#build-boundary).
`mise run //package/desktop-app/ide:bundle` runs that build and assembles `dist/monochromatic-ide`,
a directory that runs from any location,
without the source tree and without `HELIX_RUNTIME` in the environment:

```txt
# package/desktop-app/ide/dist/monochromatic-ide
monochromatic-ide             release binary; Inter and JetBrains Mono are compiled in
runtime/manifest.json         pinned Helix revision and the bundled grammar libraries
runtime/grammars/             one shared object per bundled grammar
runtime/queries/              Helix query files at the pinned revision
runtime/licenses/<grammar>/   license notice of each bundled grammar
runtime/Helix-LICENSE         MPL-2.0 text for the Helix query files and the Helix crates in the binary
LICENSES/                     LGPL-3.0-or-later and GPL-3.0-or-later texts of the application
LICENSES/font/                SIL Open Font License notices of Inter and JetBrains Mono
```

Run it as `dist/monochromatic-ide/monochromatic-ide PROJECT`,
with `--file FILE` as under [Project startup](#project-startup).
`mise run //package/desktop-app/ide:run:bundle PROJECT` does the same from the package directory.
`dist/` is ignored by Git.
The existing `build` and `run` tasks stay the debug build that tests and inspection use;
sibling applications name their release build `build`,
and renaming here is left until the other tasks and documents that call `build` can change with it.

The release build unsets `SLINT_EMIT_DEBUG_INFO`,
which the debug tasks set so inspection can address interface elements by name,
and builds only the application binary,
not the runtime,
inspection,
and scripted-server helpers.
The directory holds no desktop entry,
icon,
or installer,
and no collected license notices of the Rust crates compiled into the binary;
those are open decisions.

### Where the binary finds its language runtime

The pinned Helix loader (`prioritize_runtime_dirs` in `helix-loader/src/lib.rs`)
looks for each runtime file in these directories,
in this order,
and takes the first that has the file:

- `runtime` beside the directory `CARGO_MANIFEST_DIR` names,
  only when that variable is set while the application runs;
- `runtime` in Helix's configuration directory,
  `$XDG_CONFIG_HOME/helix/runtime` or `~/.config/helix/runtime`;
- the directory `HELIX_RUNTIME` names,
  when it is set;
- a directory fixed at build time through `HELIX_DEFAULT_RUNTIME`,
  which no task of this package sets;
- `runtime` beside the executable,
  after symbolic links to the executable are resolved.

So the assembled directory works wherever it is copied or moved as a whole,
and a symbolic link to its executable works from any directory.
A copy of the executable alone finds no runtime:
it shows source as plain text,
with a message that names the manifest it looked for,
for files a language applies to.
A file no language applies to,
such as a `.txt` file,
loses nothing,
so it is plain text without a message or a warning;
whether a language applies is decided by the compiled-in filename and shebang rules,
which need no runtime.
A file in the user's Helix configuration directory or under `HELIX_RUNTIME`
replaces the bundled file of the same relative path,
one file at a time.
With an empty `queries/sql/highlights.scm` in a scratch configuration directory,
the packaged application drew a SQL file without colors and reported nothing.

### What the host provides

- Linux on x86_64 with glibc 2.39 or later,
  `libstdc++`,
  `libgcc_s`,
  and `libfontconfig`.
  The build container is Fedora 41.
- A Wayland session,
  with `libwayland-client`,
  `libwayland-egl`,
  `libxkbcommon`,
  and `libEGL`,
  which the binary opens when it starts.
  Only Wayland was checked.
- `rg` (ripgrep) on `PATH` for [Combined search](#combined-search).
- For language features:
  `/usr/bin/bwrap` with unprivileged user namespaces,
  and each language's server on `PATH`,
  such as `rust-analyzer`.
  TypeScript uses the project's own `node_modules/typescript` at version 7 or later,
  started through `node`.
  Without one of these the reader still works,
  and a language action explains what is missing;
  see [Language module](#language-module).
- No fonts:
  with the system copies of both families hidden,
  the packaged binary drew the interface and the source in its own faces.

The application writes language-server state below `$XDG_CACHE_HOME/monochromatic-ide`
and nothing below the configuration or data directories.
It logs to standard output at debug level,
including language-server logs,
with no setting to lower that yet.

### Bundle checks

`mise run //package/desktop-app/ide:inspect:bundle [directory] [only]` checks an assembled directory,
`dist/monochromatic-ide` by default,
without changing it:

- `inventory`:
  the executable,
  the manifest,
  and exactly the grammar libraries the manifest lists.
- `license-texts`:
  the application's license texts,
  both font notices,
  Helix's license,
  and a notice with a copyright line for every bundled grammar.
- `grammars-load`:
  the package's four syntax test binaries,
  run in the bounded container with `HELIX_RUNTIME` naming the checked directory's `runtime`,
  mounted read-only.
  They load every listed library,
  compile the highlighting rules of every language that uses one,
  and highlight a sample of each bundled language.
- `starts-outside-source-tree`:
  a copy below the private scratch root reports its version with an empty environment,
  then runs in the nested compositor with no runtime variable
  and an empty configuration directory,
  and must highlight a SQL file from its own `runtime`.
- `missing-runtime-reported`:
  a copy without `runtime` must still open the file
  and report the manifest it could not read.
  The check reads the report from the application's log;
  the window shows the same sentence under the source.

The release binary has no headless backend
(`SLINT_BACKEND=headless` without a display ends with "No backends configured"),
so both startup checks need a Wayland session and the release build of `package/cli/nested-wayland-session`.
SQL is the sample because it has a bundled grammar and no configured language server.
Both also require a clean end:
the application exits with status 0 within the compositor's 2 s after the close request,
and the session leaves no application process,
no private bus daemon,
and no bus directory behind.
A session that fails is ended through the compositor's `quit` first,
because a compositor ended by a signal leaves its `dbus-daemon`,
that daemon's directory below the temporary directory,
and its hosted application running;
whatever is left is stopped and removed.

`mise run //package/desktop-app/ide:inspect:bundle-guards [directory] [only]` damages one copy per case
and requires the matching check to fail on it while the unrelated checks still pass:
a removed grammar library,
an unlisted library,
a cleared executable bit,
removed query rules,
a removed grammar notice,
removed REUSE header lines,
a removed font notice,
a removed application license,
a removed Helix license,
a removed runtime,
and an executable that still finds a runtime elsewhere.

### Measured on 2026-10-05

- Size:
  81,516,093 bytes in 1,255 files.
  The binary is 46,856,800 bytes with its symbol table
  (35,666,600 after `strip --strip-all`, which the task does not run);
  `runtime/grammars` is 33,463,328 bytes in 27 files,
  `runtime/queries` 1,087,532 bytes in 1,193 files,
  and the license texts and notices 107,898 bytes in 33 files.
  Size is not a constraint for this package.
- Build:
  2 GiB and 2 CPUs are enough.
  Two release builds from an empty release directory finished in 18 min 40 s and 15 min 22 s of Cargo time,
  on a host whose load average was between 54 and 97 each time it was read during them,
  so the second container averaged 1.04 of its 2 CPUs.
  In the second,
  sampled four times a second from the container's control group,
  anonymous memory peaked at 1,116 MiB;
  the group reached its 2,048 MiB limit only through reclaimable file cache,
  used at most 19 MiB of swap,
  and recorded no out-of-memory kill.
  Both builds produced the same binary, byte for byte.
- The release build prints one warning the debug build does not:
  `set_annotations` in `src/native/annotate.rs` is unused,
  because its only caller outside tests is the debug-only inspection path.
  `lint:clippy` checks the debug profile and does not see it.

[handover]: ../../../doc/handover/slint-ide-0x.md
[scope]: ../../../doc/decision/slint-ide-0x-scope.md
[plan]: ../../../doc/planning/slint-ide-implementation.md
