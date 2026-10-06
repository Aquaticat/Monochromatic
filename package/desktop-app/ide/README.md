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
  annotations are pending.
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
A sweep read can also meet a save that began within the last timer tick;
see [Measured write wait](#measured-write-wait).

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
Failed watches are retried at each safety sweep,
while anything shown lacks a watch.
A failure is logged and followed by the full reread once,
and again only when its error text changes;
a watch that works again is logged once.

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
120 trials per run.
5 to 8 of 120 trials showed the truncated file across four runs,
which is 17 to 27 ms before each sweep read.
The sweep read is not asked for by the save's notification,
so the write wait holds it back only once that notification has reached the schedule.
The source timer is bound before the timer that receives notifications (`src/native.rs`),
which fits a window of about one 20 ms tick.
For a save that stays unfinished that long this is about 2 to 3 in 100 saves at the 1 s sweep;
a save that is finished within a millisecond is exposed for that millisecond.

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
and every directory was listed in each interval.
The 10 s build's own cost grows with the tree,
from 2.5 to 26 ms of CPU per second,
so that part is not sweep cost.
The IDE logs at debug level by default,
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
`inspect:watch-guards` removes each guard in a disposable copy and requires its named test to fail.
`inspect:idle-cost` and `inspect:refresh-latency` produce the measurements in this section.
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
