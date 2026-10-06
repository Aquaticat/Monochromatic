# IDE design records

Durable visual records for the read-only Slint IDE in `package/desktop-app/ide`:
comparison pages that put built UI options side by side,
and the screenshots those pages show.
Each record is a question for the user, not shipped behavior.
Answers are given in the chat and then recorded in `doc/handover/slint-ide-0x.md` by the coordinating session.

## Layout

- `questions/<date>-<topic>.html`:
  one self-contained page per batch of questions.
  It loads nothing from the network and refers to images by relative path.
- `screenshots/<date>-<topic>/`:
  the frames for that page.
  PNG files are stored through Git LFS by the root `.gitattributes`.

## Index

### 2026-10-05 hint rows

- Screenshots: `screenshots/2026-10-05-hint-rows/`
- Status: a record of built behavior on the branch `feat/ide-hint-rows`, not a question.
  On 2026-10-05 the user rejected the end-of-line placement the entry "2026-10-05 annotations as built" shows
  and decided that inlay hints and diagnostic messages stand on virtual rows over their line,
  as editord draws them,
  with spacing that ties a block of rows to the line under it.
  These frames replace the frames of that entry as the picture of the current design.
  The values chosen along the way are listed in the package README section "Inlay hints and diagnostics"
  and stay open to the user's veto.
- How the frames were made and measured:
  section "How the 2026-10-05 hint rows frames were produced".

What the frames show.
`<scene>-<scheme>-<scale>.png` is a whole window:

- `overview`: the first lines of the `annotations` scene, one case per line group:
  several hints on one row (line 2),
  hints that would touch on a second row (line 3),
  the hard case of one row per short argument (line 4),
  a tab and CJK line with a hint and a message (line 5),
  one message (line 7),
  every severity and an omitted one on one line (line 8),
  a long message (line 9),
  a message with line breaks (line 10),
  a range over three lines (lines 11 to 13),
  and hints together with messages (line 14).
  `overview-<scheme>-2x-crop-hints.png` and `overview-<scheme>-2x-crop-messages.png` are parts of the scale 2 frame.
- `selection`: lines 2 to 5 selected with Shift+Down across three blocks; only code rows are filled.
- `find`: the find bar with `area`; matches are boxed on code rows of hinted lines.
- `bottom`: the last lines of the 239-line file, with rows on the last line.
- `narrow`: the task's default 1100 by 660 window, scale 1 only;
  message rows that start far right run past the window edge.
- `typescript`: a disposable project analyzed by a real TypeScript 7.0.2 server, no injection.
- `arrival-1-before`, `arrival-2-hints`, `arrival-3-diagnostics` (dark, scale 1):
  the three distinct frames of a recording in which hints and then diagnostics arrive.
- `reload-1-before`, `reload-2-held`, `reload-3-hints`, `reload-4-diagnostics` (dark, scale 1):
  an external change;
  the second frame shows the new text with the space of the old rows held open.
- `wheel-1-scrolling-ended`, `wheel-2-rows-shown` (dark, scale 1):
  consecutive recorded frames after wheel scrolling during which hints and diagnostics had arrived;
  line 98, the first visible line, stays where it is.

### 2026-10-05 annotations as built

- Screenshots: `screenshots/2026-10-05-annotations-as-built/`
- Status: a record of shipped behavior, not a question.
  The scope delegates inlay hint placement to the agent's evidence;
  the reasons are in the package README section "Inlay hints and diagnostics".
  The user can still veto any of it.

What the frames show,
from the `inspect:native <scheme> annotations` scene with injected hints and diagnostics
on branch `feat/ide-lsp-annotations` at `112dbd955`:

- `lines-dark-zoom.png` and `lines-light-zoom.png`:
  the first source lines enlarged.
  Inlay hints sit in boxes after the end of their line,
  in source order;
  a lettered severity marker (`E`, `W`) follows the text of a line where a diagnostic starts;
  each diagnostic is underlined in a style that differs by severity.
- `window-dark.png` and `window-light.png`:
  the whole window with the same annotations.
- `caret-card-dark.png` and `caret-card-light.png`:
  the caret inside an underlined range,
  with the card that lists the problems at the caret.

Known cost of the end-of-line placement,
visible on line 1:
several hints on one line are told apart only by their order.
The tree's selected row and the wide divider gutter in these frames predate the UI batch 2 answers.

### 2026-10-05 UI batch 2

- Page: [`questions/2026-10-05-ui-batch-2.html`](questions/2026-10-05-ui-batch-2.html)
- Screenshots: `screenshots/2026-10-05-ui-batch-2/`
- Status: awaiting the user's answers.

Questions on the page, with the slug used in file names:

- `divider-gap`: how the sidebar divider spends its 48 px minimum grab width.
- `divider-tab`: whether the divider is a keyboard Tab stop.
- `clear-icon`: whether the find and search inputs keep the toolkit's clear icon.
- `find-buttons`: whether the find bar gets previous, next, and close buttons.
- `selected-ink`: whether selected rows draw white text on the selection fill in both schemes.

## How the 2026-10-05 UI batch 2 screenshots were produced

### File names

`<question>-<option>-<scheme>-<state>.png` is a full 1100 by 660 frame.
`<question>-<option>-<scheme>-<state>-crop.png` is the rectangle the page shows,
cut at the same position and size for every option of that question and state.
Option `a` is always the `main` build.

### Builds

Every option is a real build of the application.
Option `a` of every question is `main` at `a630b237b`.
While the page was made, `main` gained language navigation.
On `main` at `2c64f0229`,
`ui/divider.slint`, `ui/tree.slint`, `ui/find.slint`, and `ui/search.slint` are identical to `a630b237b`;
`ui/app.slint` differs only by language navigation and an outside-project label,
and `ui/hover.slint` and `ui/references.slint` are new.
None of those additions appears in the captured scenes.
Every other option is one commit on the branch `prototype/ide-ui-variants`.
The tree of each commit is `a630b237b` plus only that option
(each commit restores the files of the previous option to `main`),
so checking one commit out builds that option alone.
The branch is throwaway prototype code and is never merged.

- `divider-gap` `b`, `5de82698c`:
  a 1 px divider cell with a 48 px grab area overlapping tree and source.
- `divider-gap` `c`, `106ab1ea4`:
  the line on the tree-side edge of the 48 px cell.
- `divider-gap` `d`, `6b74bf6c4`:
  a Material 3 style drag handle in the 48 px cell.
- `divider-tab` `b`, `4133d984b`:
  no Tab stop; Alt+Shift+Left and Alt+Shift+Right resize.
- `divider-tab` `c`, `b1cc52b81`:
  no Tab stop and no keyboard resizing.
- `clear-icon` `b`, `a79ac704f`:
  find and search inputs built on `TextInput`, without the clear icon.
- `find-buttons` `b`, `d8d28717a`:
  previous, next, and close buttons in the find bar.
- `selected-ink` `b`, `c1e3a8d2f`:
  white ink on the selection fill in the tree and the search list.

Options `c` and `d` of `divider-gap` and the whole `selected-ink` question were not in the original request.
The page states why each was added.

### Command, fixture, and window size

Each frame set comes from a fresh session of the package's native inspection task,
run in the worktree that holds the prototype branch:

```sh
# package/desktop-app/ide/mise.toml, task inspect:native
IDE_NATIVE_MCP_PORT=9378 mise run //package/desktop-app/ide:inspect:native dark scroll
IDE_NATIVE_MCP_PORT=9379 mise run //package/desktop-app/ide:inspect:native light scroll
```

- Fixture: `scroll`, a 203-line `fixture.ts` opened at start.
- Window: the task's default 1100 by 660 nested screen at scale factor 1;
  every session asserts that size before its first frame and every frame is checked to be 1100 by 660 pixels.
- Project contents: each session adds the same entries to its disposable project before any frame
  (`src/index.ts`, `README.md`, `package.json`, `an-extremely-long-file-name-that-reaches-the-divider.ts`)
  and asserts the resulting tree order.
- Sessions: one per question, option, and scheme, each quit through the compositor control socket.

### Input and capture

- Keys and clicks are seat input through the compositor control socket
  (`key`, `type`, `click` of `package/cli/nested-wayland-session`).
- Hover uses the Slint MCP tool `move_pointer`, which moves the toolkit pointer,
  because the control protocol has no plain pointer move.
  Its `wheel` command with zero notches moved the seat pointer,
  but the divider did not show hover afterwards in a control run.
- A frame is the compositor's `screenshot`, saved once two screenshots 250 ms apart are byte-identical.
- Frames with a focused text input are picked from 12 samples taken 120 ms apart:
  among samples seen at least twice, the one with the caret drawn.
  Every option therefore shows the caret in the same blink phase.
- The compositor writes nearly uncompressed PNG files.
  The stored files are re-encoded losslessly with ImageMagick and stripped of metadata;
  each stored frame was compared with its original and differs in no pixel.

### Scenes

Every scene starts from the state right after launch: `fixture.ts` open and selected in the tree,
the source focused, the sidebar 256 px wide.

- `divider-gap`:
  `idle` at start with the pointer parked at 1000, 450;
  `pointer-tree` with the pointer at 244, 152, on the `README.md` row 12 px left of the tree edge;
  `pointer-gap` with the pointer at 268, 152;
  `focus` after parking the pointer and pressing Tab twice (source to tree, tree to divider).
- `divider-tab`:
  `tree` after one Tab;
  `tab-1` after one more Tab;
  `shortcut` after Shift+Tab and then Alt+Shift+Right three times.
- `clear-icon`:
  `find-text` after Ctrl+F and typing `Latin`;
  `find-selected` after Escape and Ctrl+F again;
  `search-empty` after Escape and two Shift taps;
  `search-text` after typing `fixture`.
- `find-buttons`:
  `match` after Ctrl+F and typing `Latin`;
  `hover` with the pointer on the next button and `after-next` after one seat click on it (option `b` only);
  `nomatch` after Ctrl+A and typing `zzz`.
- `selected-ink`:
  `tree` at start;
  `search` after two Shift taps and typing `fixture`.

### What the frames do not show

- The mouse cursor: the screenshot holds the application surface only.
- Drags: the control protocol has no held-button drag.
- The right-click menu and input-method preedit of the `clear-icon` option `b` input,
  which the prototype does not rebuild.
- The references list from the language-navigation work:
  it is not in `a630b237b`, and showing it needs a running language server.
  On `main` at `2c64f0229` its selected row uses the same palette ink as the tree and the search list.

## How the 2026-10-05 hint rows frames were produced

### Sessions

Every frame comes from the package's native inspection task on `feat/ide-hint-rows`,
with injected annotations unless stated:

```sh
# package/desktop-app/ide/mise.toml, task inspect:native
IDE_NATIVE_MCP_PORT=9424 IDE_NATIVE_SIZE=1400x1000 mise run //package/desktop-app/ide:inspect:native dark annotations
IDE_NATIVE_MCP_PORT=9425 IDE_NATIVE_SIZE=1400x1000 mise run //package/desktop-app/ide:inspect:native light annotations
```

- Fixture: `annotations`, a 239-line `fixture.ts` with 92 hints and 23 diagnostics from the inspection file.
- Scale 1 frames are 1400 by 1000 pixels.
  Scale 2 frames are 2800 by 2000 pixels,
  taken in a session of the same command after the compositor's `scale 2` control command.
  A session started at scale 2 through `IDE_NATIVE_SCALE=2` was kept 2160 pixels wide by the host compositor,
  so it was not used.
- `narrow` frames follow the control command `resize 1100 660`.
- Input is seat input through the compositor control socket:
  `click`, `key`, and `type` of `package/cli/nested-wayland-session`.
  The selection is a click on line 2 and Shift with Down three times and End;
  find is Ctrl+F and `type area`;
  the bottom is Ctrl+End.
- A scale 2 frame is kept once three screenshots 1.2 s apart are byte-identical.
  The find frames have a blinking input caret and are taken 7 s after the input instead.
  Every frame was opened and compared with its scene;
  the code rows of each scale 2 frame stand within 0.75 logical pixels of those of its scale 1 frame.
- The stored files are re-encoded losslessly without ancillary chunks.

The `typescript` frames come from a project written below the system temporary directory
(`src/main.ts`, `src/shape.ts`, `tsconfig.json`, and a copy of `typescript@7.0.2` with its native binary):

```sh
# package/desktop-app/ide/mise.toml, task inspect:native
IDE_NATIVE_MCP_PORT=9424 IDE_NATIVE_SIZE=1400x1000 IDE_NATIVE_PROJECT=<project> IDE_NATIVE_FILE=src/main.ts \
  mise run //package/desktop-app/ide:inspect:native dark basic
```

The light and scale 2 frames of that session follow the control commands `color-scheme light` and `scale 2`,
so they also show a live scheme change and a live scale change with rows in place.

### Recordings

Recordings use the compositor's `record` command.
Only the named key frames are stored;
the recordings themselves are not.

```sh
# package/desktop-app/ide/mise.toml, task inspect:native
# Arrival, and a reload after which annotations return within the hold:
IDE_NATIVE_MCP_PORT=9424 IDE_NATIVE_ANNOTATION_DELAYS=4000,7000 IDE_NATIVE_ANNOTATION_RELOAD_DELAYS=300,700 \
  mise run //package/desktop-app/ide:inspect:native dark annotations
# A reload after which diagnostics return later than the hold:
IDE_NATIVE_MCP_PORT=9424 IDE_NATIVE_ANNOTATION_DELAYS=9000,13000 IDE_NATIVE_ANNOTATION_RELOAD_DELAYS=300,3000 \
  mise run //package/desktop-app/ide:inspect:native dark annotations
# Wheel scrolling across the arrival:
IDE_NATIVE_MCP_PORT=9424 IDE_NATIVE_ANNOTATION_DELAYS=5500,8000 \
  mise run //package/desktop-app/ide:inspect:native dark annotations
```

- The external change replaces one word of the first comment line by a word of equal length,
  written to the fixture file while the session runs,
  so every annotated line stays where it was in the text.
- The wheel recording sends one `wheel 700 400 0 1` notch every 240 ms for 10 s.
- Recorded frames:
  arrival 539 at 60 per second, none dropped;
  reload 227 kept and 100 dropped;
  late reload 388, none dropped;
  wheel 425 at 30 per second, none dropped;
  TypeScript arrival 239 kept and 102 dropped;
  TypeScript reload 130 kept and 63 dropped.
  Dropped frames came from host load;
  times taken from a recording with drops are approximate.

### Measurement

A code row is found by the ink of its line number in the gutter.
Its pixels,
line number and code,
are then searched for in the next recorded frame,
and the difference of the two positions is that line's movement.
For the wheel recording only a row found again pixel for pixel counts,
because neighbouring fixture lines look alike.

- Arrival: two frames differ from the frame before them.
  Hints: line 1 moved 0 px, line 2 26 px, line 3 68 px, line 4 158 px, lines 5 to 13 184 px, lines 14 to 17 210 px.
  Diagnostics, 3 s later: lines 1 to 4 moved 0 px, lines 5 and 6 16 px, line 7 42 px, line 8 164 px;
  later lines left the window.
- Reload within the hold: three frames differ (the new text, hints back, diagnostics back);
  no code row moved in any of them.
- Reload with late diagnostics: four frames differ.
  Message space was given up 1.02 s after the reload (lines 5 and 6 moved up 16 px, line 7 42 px, line 8 164 px)
  and taken again 3.15 s after it by the same amounts.
- TypeScript 7.0.2, first open: by the application's log diagnostics were stored 0.19 s before hints,
  and each moved lines once (line 14 by 336 px, then by 254 px).
  External change: the rows were back 0.23 s after the reload by the application's log,
  two recorded frames differ,
  and no code row moved.
- Wheel: 39 notches of 60 px took effect (2340 px).
  In 145 frames every code row found again moved by one common amount,
  never backwards,
  at most 45 px in one frame.
  Hints and diagnostics that arrived meanwhile were shown in one frame,
  0.27 s after the last scrolling frame;
  in it the first visible line did not move,
  the six lines after it moved 26 px,
  and later lines 52, 94, 120, and 146 px,
  each by the blocks that appeared before it inside the window.
  The 1228 px of blocks that appeared before the window moved nothing.
