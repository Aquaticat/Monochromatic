# IDE design records

Durable visual records for the read-only Slint IDE in `package/desktop-app/ide`:
comparison pages that put built UI options side by side,
and the screenshots those pages show.
A comparison page is a question for the user, not shipped behavior.
Answers are given in the chat and then recorded here and in `doc/handover/slint-ide-0x.md`.
Frames of the built result are stored beside the frames of the question they answer.

## Layout

- `questions/<date>-<topic>.html`:
  one self-contained page per batch of questions.
  It loads nothing from the network and refers to images by relative path.
- `screenshots/<date>-<topic>/`:
  the frames for that page.
  PNG files are stored through Git LFS by the root `.gitattributes`.
- `screenshots/<date>-<topic>-applied/`:
  frames of the application as built after the answers.

## Index

### 2026-10-05 UI batch 3

- Page: [`questions/2026-10-06-ui-batch-3.html`](questions/2026-10-06-ui-batch-3.html),
  built by the coordinating session from these frames and this entry's analysis.
- Screenshots: `screenshots/2026-10-05-ui-batch-3/`
- Status: answered by the user on 2026-10-06;
  every answer matches what the build ships:
  `hint-look` `a`,
  `hint-labels` `a`,
  `hint-packing` `a` (editord's packing, not the `b` ranked first:
  "first row with room" cannot make readers immediately realize two things are not one thing
  under the constraints we chose),
  `diagnostic-rows` `a`,
  `diagnostic-text` `b`.
  The user also kept the three-digit minimum of the line-number column.
  `doc/decision/slint-ide-0x-scope.md` records the answers under "Interface decisions (UI batch 3)".
- How the frames were made: section "How the 2026-10-05 UI batch 3 screenshots were produced".

Every option is a real build.
`<question>-<option>-<scheme>.png` is a whole 1400 by 1000 window of the `annotations` scene,
and `<question>-<option>-<scheme>-crop.png` is the part that differs,
cut at the same rectangle for every option of a question.
Line numbers in the list name the scene's source lines.
Every build shows each severity letter 4 px before its own line number:
on 2026-10-06 the user asked for a shorter space between letter and number,
and the 4 px gap was chosen for that; the frames were rebuilt after the change.

#### Hint row look (`hint-look`)

- `a`, shipped: Inter at 13 px in the source ink at 70 percent, without a box, as editord draws hints.
  Gains: the user's stated reference;
  the narrower proportional face lets more hints share a row
  (line 3 takes 2 hint rows, line 4 takes 5);
  typeface, size, and row already set hints apart from code.
  Costs: type names are not shown in the code's typeface.
- `b`: the source family's real italic at 13 px in the same ink,
  each label in a box of the source ink at 8 percent with 5 px padding,
  as the end-of-line build drew hints.
  Gains: types read in the code's family;
  the box marks a label as inserted text.
  Costs: wider labels and box padding put line 3 on 4 hint rows and line 4 on 6,
  so line 4 stands 48 px lower and line 14 leaves the window;
  stacked boxes form a dense block over short calls.

Ranking: `a` > `b`,
because `a` is the reference the user named and needs fewer rows for the same hints,
while the box of `b` repeats a distinction the row placement already makes.

#### Hint labels (`hint-labels`)

- `a`, shipped: labels as the server sent them, such as `: number` and `width:`.
  Gains: the colon tells a type from a parameter name,
  which matters more on a row of its own than inside a line;
  no rewriting that depends on a hint kind some servers leave out.
  Costs: one or two characters more per label.
- `b`: editord's stripping of a type hint's leading `: ` and a parameter hint's trailing `:`.
  Gains: shorter, quieter labels, as in editord.
  Costs: `number` (a type) and `width` (a parameter) look alike;
  a server that leaves the kind out gets unstripped labels next to stripped ones.
  In this scene the shorter labels saved no row.

Ranking: `a` > `b`,
because the colon is the only sign of what a hint names once it stands on its own row,
and stripping saved no row in the measured scene.

#### Hint packing (`hint-packing`)

- `a`, shipped: editord's packing.
  A hint stays on the current row when it starts 8 px after the previous hint's end,
  otherwise it opens a new row that later hints continue.
  Gains: rows read in source order, top to bottom;
  the brief named editord's packing.
  Costs: a call with several short arguments takes a row per argument:
  line 4 takes 5 hint rows.
- `b`: each hint takes the first row with room.
  Gains: line 4 takes 2 hint rows,
  so line 5 stands 48 px higher,
  and hints arriving move later lines less.
  Costs: rows no longer follow source order
  (on line 4 the first row holds `shape:`, `height:`, `dx:`, and `dy:`, the second `width:` and `scale:`);
  differs from editord.

Ranking: `b` > `a`,
because every hint stands at the x of its own character in both,
so source order on rows adds little,
while `b` saves rows exactly where blocks grow tallest.
The default stays `a` until the user answers, because the brief asked for editord's packing.

#### The caret card beside message rows and gutter letters (`diagnostic-rows`)

The user decided for message rows,
and on 2026-10-06 for a plain severity letter in front of the line number instead of an icon or a boxed marker,
so the lettered box after the line end that this question first offered is gone.
What is left is whether the earlier caret card stays beside them.
The frames show the caret inside the string of line 7.

- `a`, shipped: message rows and gutter letters only.
  Gains: one place for every message;
  nothing covers code or changes with the caret.
  Costs: the full text of a message cut by the row caps is reachable only through the accessible description.
- `b`: the same plus the card listing the problems at the caret,
  under the caret's line or over it when the view ends first.
  Gains: shows the full text of every problem at the caret,
  also of a message cut by the caps.
  Costs: covers the lines under the caret line and their rows while the caret is in a range,
  in the frames the first message rows of line 8;
  repeats the rows for every message that was not cut.

Ranking: `a` > `b`,
because `a` covers nothing and repeats nothing,
while the text `b` adds is already on screen except for messages cut by a cap.
A narrower `b` that opens the card only for a message cut by a cap would keep that gain at a smaller cost;
it is not built.

#### Message row text (`diagnostic-text`)

- `a`: editord's wording, `error(ts): Type 'string' is not assignable to type 'number'.`
  Gains: shorter;
  line 8's information message fits one row instead of two in this scene.
  Costs: drops the code (`2322`), which people search for;
  the lower-case severity word reads less as a label.
- `b`, shipped: the wording of the earlier caret card,
  `Error 2322 (ts): Type 'string' is not assignable to type 'number'.`
  Gains: keeps the code;
  the capitalized severity word is the row's second channel besides ink;
  the same text starts the accessible description.
  Costs: a few characters longer, so long messages wrap a little sooner.

Ranking: `b` > `a`,
because the code is the one part a reader cannot reconstruct from the message,
and the length difference cost one row in the scene.

### 2026-10-05 hint rows

- Screenshots: `screenshots/2026-10-05-hint-rows/`
- Status: a record of built behavior on the branch `feat/ide-hint-rows`, not a question.
  On 2026-10-05 the user rejected the end-of-line placement the entry "2026-10-05 annotations as built" shows
  and decided that inlay hints and diagnostic messages stand on virtual rows over their line,
  as editord draws them,
  with spacing that ties a block of rows to the line under it.
  These frames replace the frames of that entry as the picture of the current design.
  On 2026-10-06 the user decided that severity is a plain letter in front of the line number,
  close to the number;
  every frame was captured again after that change and shows each letter 4 px before its own line number.
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
  lines 96 and 97, the first visible lines, stay where they are.

### 2026-10-05 annotations as built

- Screenshots: `screenshots/2026-10-05-annotations-as-built/`
- Status: history.
  The user saw these frames and rejected the end-of-line hint placement on 2026-10-05:
  hints move to virtual rows above the code line,
  like editord,
  and diagnostic messages go on virtual rows too.

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
- Status: answered by the user on 2026-10-05 and applied.
  The applied frames are in `screenshots/2026-10-05-ui-batch-2-applied/`;
  see [Applied frames of the 2026-10-05 UI batch 2](#applied-frames-of-the-2026-10-05-ui-batch-2).

Questions on the page, with the slug used in file names:

- `divider-gap`: how the sidebar divider spends its 48 px minimum grab width.
- `divider-tab`: whether the divider is a keyboard Tab stop.
- `clear-icon`: whether the find and search inputs keep the toolkit's clear icon.
- `find-buttons`: whether the find bar gets previous, next, and close buttons.
- `selected-ink`: whether selected rows draw white text on the selection fill in both schemes.

#### Answers of 2026-10-05

- `divider-gap`:
  option B,
  a thin line with no strip.
  The built divider does not use the prototype's 48 px grab area over the tree and the source.
  Its pointer zone is 5 px wide,
  sized from desktop toolkit sources;
  the package `README.md` lists them under "Pointer zone precedent".
  The user granted this size for this one element only:
  the application runs on desktops only,
  every desktop has a pointer and a keyboard,
  dragging the divider is rare,
  and the width is also adjustable by keyboard.
- `divider-tab`:
  option A,
  the divider stays a Tab stop with the `slider` role and its arrow keys.
- `clear-icon`:
  neither option as drawn.
  The clear control stays,
  and its click target,
  invisible padding included,
  is at least 48 px by 48 px.
  The toolkit's control cannot be given that size,
  so the built boxes are the application's own text box with a 48 px by 48 px clear cell.
- `find-buttons`:
  option A,
  keyboard only.
- `selected-ink`:
  option B,
  white text on the selection fill,
  in the tree,
  the search results,
  and the references list.

### 2026-10-05 packaged application check

- Screenshots: `screenshots/2026-10-05-packaged-check/`
- Status: evidence of a check, not a question; it has no page.

The frames show the assembled application directory of the package's `bundle` task
running from a copy outside the repository.
[Its production section](#how-the-2026-10-05-packaged-check-screenshots-were-produced)
gives the build, the sessions, and what each frame shows.

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

## Applied frames of the 2026-10-05 UI batch 2

`screenshots/2026-10-05-ui-batch-2-applied/` holds frames of the application built at commit `5683610b5`
of the branch `feat/ide-ui-batch-2`,
in the dark and the light scheme.

### How the applied frames were produced

Every frame comes from a fresh session of the package's native inspection task
in the nested compositor,
one session per scene and scheme:

```sh
# package/desktop-app/ide/mise.toml, task inspect:native
IDE_NATIVE_MCP_PORT=9394 mise run //package/desktop-app/ide:inspect:native dark scroll
IDE_NATIVE_MCP_PORT=9395 mise run //package/desktop-app/ide:inspect:native light scroll
```

- Fixture,
  window size,
  project contents,
  seat input,
  pointer hover,
  settled frames,
  caret phase,
  and lossless re-encoding are those of
  [How the 2026-10-05 UI batch 2 screenshots were produced](#how-the-2026-10-05-ui-batch-2-screenshots-were-produced).
- A held press uses the toolkit inspection server's `drag_element`,
  which presses,
  moves in 5 px steps 16 ms apart,
  and releases.
  The divider is dragged straight down its own line,
  so its width stays 256 px;
  the clear control is dragged out of its cell,
  where the release clears nothing.
  Screenshots are taken while the drag runs,
  and one whose sampled pixels show the pressed state is kept;
  it is not a settled pair.
- A frame taken right after a scale switch or after the context menu opens
  waits until the application reports the new scale or lists the menu entries,
  because the compositor can answer before the application has redrawn.
- Frames whose names end in `-2x` follow the control command `scale 2`:
  2200 by 1320 pixels for the same 1100 by 660 logical window.
- The references frames open a disposable TypeScript project below the system temporary directory
  through `IDE_NATIVE_PROJECT` and `IDE_NATIVE_FILE`,
  with the repository's TypeScript 7.0.2 copied into its `node_modules`.
  A seat click puts the caret on a function's name at its definition,
  and Ctrl+B lists its references.
- `capture-record.json` holds what each session read from the running application:
  accessible properties of the divider,
  both text boxes,
  and both clear controls,
  sampled pixel colors of the divider states,
  and the values after each action.

### What the applied frames show

File names are `<element>-<state>-<scheme>.png`,
with `-2x` for the scale 2 frames.

- `divider-rest`:
  the 1 px line,
  with the pointer parked over the source.
- `divider-hovered`:
  three columns in stronger ink,
  with the pointer on the line.
- `divider-dragging`:
  three columns in full ink,
  during a held press.
- `divider-focused`:
  three columns in the accent color and the handle in the middle,
  after Tab from the source to the tree and to the divider.
- `divider-rest-2x`,
  `divider-hovered-2x`,
  and `divider-focused-2x`:
  the same states at scale 2.
- `find-empty`:
  the find bar after Ctrl+F,
  with its placeholder and no clear control.
- `find-text`:
  the find text `Latin` and the clear control at rest.
- `find-clear-hovered` and `find-clear-pressed`:
  the clear control under the pointer and during a held press.
- `find-text-2x` and `find-clear-hovered-2x`:
  the clear cell at scale 2.
- `find-menu`:
  the context menu after a right click on the find text.
- `search-empty`,
  `search-text`,
  `search-clear-hovered`,
  and `search-clear-pressed`:
  the same states of the search box;
  `search-text` also shows a selected result row.
- `selected-tree`:
  the selected tree row while the source has keyboard focus.
- `selected-tree-hovered`:
  the same row under the pointer,
  with its darker tint.
- `selected-tree-focused`:
  the same row with keyboard focus on it,
  after Tab from the source and End,
  with its tint and boundary.
- `selected-search`:
  the selected search result.
- `selected-references` and `selected-references-second`:
  the references list with its first and then its second row selected.

### What the applied frames do not show

- The mouse cursor:
  the screenshot holds the application surface only.
  The column-resize cursor over the divider is therefore not in any frame.
- Input-method composition:
  the nested compositor provides no input method.

## How the 2026-10-05 packaged-check screenshots were produced

### Build and copy

`mise run //package/desktop-app/ide:bundle` assembled `dist/monochromatic-ide`
from the application sources of `aab809c54`.
The binary's SHA-256 starts with `522415c723cc2156`.
It was built with a 10 s safety sweep,
a 150 ms quiet time for an open write,
and a 250 ms limit on that wait
(`SAFETY_SWEEP`, `WRITE_QUIET`, and `WRITE_WAIT_LIMIT` in `src/refresh_policy.rs`).
The directory was copied to a scratch directory below `~/temp/agent`,
outside the repository,
and every session ran that copy.
The frames record that commit:
inlay hints sit in boxes after the end of their line.
A later decision moves hints to a line of their own over the code line,
so newer builds look different there.

### Sessions

One session per language and scheme:
a TypeScript 7 project and a Rust project,
each in dark and in light,
built the way `bin/inspect-language.mjs` builds its fixtures and placed beside the copy.
Each session hosted the copy in the release build of `package/cli/nested-wayland-session`
at 1100 by 660 and scale factor 1,
with `--color-scheme dark` or `--color-scheme light`,
started as `monochromatic-ide PROJECT --file src/main.ts` or `src/main.rs`.
The environment held no `HELIX_RUNTIME` and no Cargo variable,
and the configuration, cache, and data directories were empty scratch directories.
The TypeScript sessions also hid the system copies of Inter and JetBrains Mono,
as the `inspect:native` task does;
the Rust sessions used the host's own font configuration.
Language servers ran confined by `/usr/bin/bwrap`:
the project's own TypeScript 7 server and the host's `rust-analyzer`.

### Input and capture

- The release binary has no inspection server,
  so every key, click, and pointer move is seat input through the compositor control socket,
  and nothing is read from inside the application.
- What the application did is read from three places:
  its own log lines,
  the nested clipboard through `wl-paste` on the nested display only,
  and these frames.
- A frame is the compositor's `screenshot`,
  saved once three screenshots 250 ms apart are byte-identical.
  The first frame of a session also waits until the window shows more than one flat color.
  With the find or search input focused its caret blinks,
  so `ts-dark-find-next`,
  `ts-light-find-next`,
  and `ts-light-search-file-name` are the last of twenty screenshots instead.
- The stored files are re-encoded losslessly with ImageMagick and stripped of metadata;
  each was compared with its original and differs in no pixel.

### File names

`<language>-<scheme>-<step>.png`,
with `ts` or `rust`,
`dark` or `light`,
and a step from this list,
in the order of the check:

- `open-highlighted`:
  the first file, highlighted from the copy's own `runtime`.
- `select-line`:
  one line selected with Shift+End;
  the nested clipboard then held exactly that line.
- `find-next`:
  the find bar after typing a name and pressing Enter.
- `search-file-name`:
  the search overlay with a file-name result before the content results.
- `hover`:
  hover information from Ctrl+Q at a call.
- `hints-and-diagnostic-card`:
  inlay hints at the line ends,
  the error mark,
  and the caret's problem card.
- `references`:
  the other file,
  reached with Ctrl+B at the call,
  and the list from Ctrl+B at the definition there.
- `outside-project`:
  Rust only,
  the standard library file that defines `String::new`,
  with its `Outside project` label.
- `tree-new-file`:
  the first file after another process appended a line to it,
  and the tree row of a file another process created.

The steps from `open-highlighted` through `search-file-name` do not depend on the language,
so the Rust sessions store only `open-highlighted` of them.
Every session ran every step,
including the ones without a stored frame:
a content-only search,
opening files from the tree,
choosing a reference,
and a resting-pointer hover.

### What the frames do not show

- The mouse cursor:
  the screenshot holds the application surface only.
- The quit:
  each session ended through the compositor's `quit`,
  which asks the window to close.
- The emoji in the first file's string under the host's own font configuration:
  in the Rust frames its place is blank,
  while the TypeScript frames,
  taken with the restricted font configuration,
  show it as an outline glyph.
  The same TypeScript file opened under the host's configuration also shows a blank.

## How the 2026-10-05 hint rows frames were produced

### Sessions

Every frame comes from the package's native inspection task on `feat/ide-hint-rows` at `BUILD_COMMIT`,
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
- A scale 2 frame is kept once three screenshots 1.2 s apart are byte-identical
  and have the scaled width;
  frames that the first sessions took before the scale change or the `resize` had reached the window
  were taken again in fresh sessions that wait for the new width.
  The find frames have a blinking input caret and are taken 7 s (scale 1) or 15 s (scale 2) after the input instead.
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
IDE_NATIVE_MCP_PORT=9424 IDE_NATIVE_SIZE=1400x1000 \
  IDE_NATIVE_ANNOTATION_DELAYS=4000,7000 IDE_NATIVE_ANNOTATION_RELOAD_DELAYS=300,700 \
  mise run //package/desktop-app/ide:inspect:native dark annotations
# A reload after which diagnostics return later than the hold:
IDE_NATIVE_MCP_PORT=9424 IDE_NATIVE_SIZE=1400x1000 \
  IDE_NATIVE_ANNOTATION_DELAYS=9000,13000 IDE_NATIVE_ANNOTATION_RELOAD_DELAYS=300,3000 \
  mise run //package/desktop-app/ide:inspect:native dark annotations
# Wheel scrolling across the arrival:
IDE_NATIVE_MCP_PORT=9424 IDE_NATIVE_SIZE=1400x1000 IDE_NATIVE_ANNOTATION_DELAYS=5500,8000 \
  mise run //package/desktop-app/ide:inspect:native dark annotations
```

- The external change replaces one word of the first comment line by a word of equal length,
  written to the fixture file while the session runs,
  so every annotated line stays where it was in the text.
- The wheel recording sends one `wheel 700 400 0 1` notch every 240 ms for 10 s.
- The arrival was recorded for 18 s in a session of its own, because the slow start under host load
  left the first 9 s recording without the arrival.
- Recorded frames:
  arrival 327 kept and 700 dropped;
  reload 158 kept and 114 dropped;
  late reload 116 kept and 253 dropped;
  wheel 282 kept and 142 dropped;
  TypeScript arrival 287 kept and 63 dropped;
  TypeScript reload 108 kept and 87 dropped.
  Dropped frames came from host load (a load average of 45 to 100 from other sessions);
  times below come from the application's log, not from frame counts.

### Measurement

A code row is found by the ink of its gutter, letter or line number.
Its pixels from x 340 on,
right of every severity letter,
are then searched for in the next recorded frame,
and the difference of the two positions is that line's movement.
For the wheel recording only a row found again pixel for pixel counts,
because neighbouring fixture lines look alike.

- Arrival: after the text and its syntax colors, two frames differ from the frame before them.
  Hints: line 1 moved 0 px, line 2 26 px, line 3 68 px, line 4 158 px, lines 5 to 13 184 px, lines 14 to 20 210 px.
  Diagnostics, 2.92 s later by the log: lines 1 to 4 moved 0 px, lines 5 and 6 16 px, line 7 42 px, line 8 164 px;
  later lines left the window.
- Reload within the hold: three frames differ (the new text, hints back, diagnostics back);
  no code row moved in any of them.
- Reload with late diagnostics: by the log, message space was given up 1.01 s after the reload
  and taken again with the diagnostics 3.16 s after it.
  The recording shows the first of the two
  (lines 5 and 6 moved up 16 px, line 7 42 px, line 8 164 px);
  it kept no frame after the second.
- TypeScript 7.0.2, first open: by the application's log hints and diagnostics were stored within 1 ms of each other,
  2.03 s after the file was announced to the server,
  and lines moved once, in one recorded frame.
  External change: the rows were back 0.04 s after the reload by the application's log,
  two recorded frames differ,
  and no code row moved.
- Wheel: 42 notches were sent;
  by the log the view came to rest at a scroll offset of 2280 px.
  In 30 kept frames every code row found again moved by one common amount,
  never backwards
  (at most 119 px between two kept frames, because frames were dropped).
  Hints and diagnostics that arrived meanwhile were shown in one frame,
  0.32 s after the last render that deferred them by the log;
  in it lines 96 and 97, the first visible lines, did not move,
  line 98 moved 26 px by its own new block,
  and later lines 52 to 256 px,
  each by the blocks that appeared before it inside the window.
  The 1202 px of blocks that appeared before the window moved nothing.
  A recording of the build before the scroll-step rule (`862f20fac`) showed the first visible line moving 3 px
  in that frame.

## How the 2026-10-05 UI batch 3 screenshots were produced

### Builds

Every option is a real build of the application.
Options that the branch `feat/ide-hint-rows` ships are built from the prototype commit `4438d8028`,
whose sources equal `feat/ide-hint-rows` at `397d40092`,
the build that stands each severity letter 4 px before its own line number.
Every other option is one commit on the branch `prototype/ide-hint-row-variants`,
in the worktree `.claude/worktrees/ide-hint-row-variants`.
The tree of each commit is `4438d8028` plus only that option
(each commit restores the files of the previous option),
so checking one commit out builds that option alone.
The branch is throwaway prototype code and is never merged.

- `diagnostic-text` `a`, `06b8a3b09`: editord wording without the code.
- `hint-look` `b`, `a5ee2671f`: the source family italic in a box.
- `hint-labels` `b`, `70851ccc1`: editord label stripping.
- `hint-packing` `b`, `89a24c0ff`: each hint on the first row with room.
- `diagnostic-rows` `b`, `5e46c5d18`: rows and gutter letters plus the caret card.

The same options were built twice before, and their frames were replaced by the frames of these builds:
first on `fb0824037`, together with a lettered box after the line end that the user's decision of 2026-10-06 retired
(commits `46704e4c2` to `9d24ffcca`),
then on `c1edfcf40`, with the letters in a 16 px column at the gutter's left edge,
which the user found too far from the line numbers
(commits `ad6a6fac0`, `c9873c837`, `65184fbff`, `d5736b7ed`, and `fce7a8852`).

### Command, fixture, and window size

Each frame set comes from a fresh session of the package's native inspection task,
run in the worktree that holds the build:

```sh
# package/desktop-app/ide/mise.toml, task inspect:native
IDE_NATIVE_MCP_PORT=9424 IDE_NATIVE_SIZE=1400x1000 mise run //package/desktop-app/ide:inspect:native dark annotations
IDE_NATIVE_MCP_PORT=9425 IDE_NATIVE_SIZE=1400x1000 mise run //package/desktop-app/ide:inspect:native light annotations
```

- Fixture: `annotations`, the 239-line scene with 92 injected hints and 23 diagnostics
  that the entry "2026-10-05 hint rows" describes.
- Window: 1400 by 1000 at scale 1; every frame is checked to be 1400 by 1000 pixels.
- Sessions: one per build and scheme, each quit through the compositor control socket.

### Input and capture

- Input is seat input through the compositor control socket (`click` and `key`).
  The first frame of a session follows a click on line 1 and Ctrl+Home;
  `diagnostic-rows` uses the second frame, after a click inside the string of line 7.
- A frame is kept once three screenshots 1.2 s apart are byte-identical.
- The stored files are re-encoded losslessly without ancillary chunks.
- Crop rectangles, in pixels of the whole frame (left, top, right, bottom):
  `hint-look`, `hint-labels`, and `hint-packing` 300, 30, 1100, 350;
  `diagnostic-rows` 300, 290, 1400, 790;
  `diagnostic-text` 300, 380, 1400, 950.
- Measured on the frames by the ink of the gutter's line numbers,
  the code row of line 5 stands at y 339 in the shipped build,
  387 with `hint-look` `b`,
  339 with `hint-labels` `b`,
  and 291 with `hint-packing` `b`;
  line 8 stands at 559 in the shipped build and 543 with `diagnostic-text` `a`.
