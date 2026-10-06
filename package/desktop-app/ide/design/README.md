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

### 2026-10-06 UI batch 3b

- Page: [`questions/2026-10-06-ui-batch-3b.html`](questions/2026-10-06-ui-batch-3b.html)
- Screenshots: `screenshots/2026-10-06-ui-batch-3b/`
- Status: open.
  The coordinating session asks the user in the chat and points to the page.
  The frames and builds are described in the
  [production notes](#how-the-2026-10-06-ui-batch-3b-screenshots-were-produced).

The open choices of the applied UI batch 2 and one new question, with the slug used in file names.
Option `a` is what the application does now.

- `zone-width`: the divider's pointer zone,
  5 px (`a`), 7 px (`b`), 4 px (`c`), or 13 px (`d`).
- `query-selection-ink`: selected text inside the find and search boxes
  in the toolkit's colors (`a`) or in the ink chosen from the selection fill (`b`).
- `selected-row-tint`: a hovered or keyboard-focused selected tree row
  tinted away from its ink (`a`) or not tinted (`b`).
- `trailing-cell`: the box's trailing cell
  shrinks to 12 px of padding while the clear control is hidden (`a`) or always keeps 48 px (`b`).
- `divider-focus`: the keyboard-focused divider
  with three accent columns and a 5 px by 48 px handle (`a`),
  a 5 px by 96 px handle (`b`),
  or five accent columns over the whole height and no handle (`c`).
- `clear-plate`: the clear control's hover and press
  on a 32 px plate inside the 48 px cell (`a`) or on the whole cell (`b`).
- `padding-click`: a click on the search panel's padding
  keeps keyboard focus in the query box (`a`) or moves it to the panel and hides the clear control (`b`).
- `watch-limit`: when the system's inotify watch limit is reached,
  the application only logs it (`a`) or also shows a one-line message (`b`).

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

## How the 2026-10-06 UI batch 3b screenshots were produced

### File names

`<question>-<option>-<scheme>-<state>.png` is a full 1100 by 660 frame;
`divider-focus` and `watch-limit` have one state each and no `-<state>` part.
`-2x` follows the scheme or state for a frame at scale factor 2 (2200 by 1320 pixels).
`-crop.png` is the same frame cut at the rectangle listed for its question under
[Crop rectangles](#crop-rectangles-of-the-2026-10-06-ui-batch-3b),
the same rectangle for every option,
and enlarged by a whole factor without smoothing, so each screen pixel stays a square block.

### Builds

Every option is a real build of the application.
The base is `main` at `22de770b8`;
its `package/desktop-app/ide` is identical to `066b14ec5`,
where the branch `feat/ide-accessibility-tests` starts.
Option `a` of a question is the base build,
except for `zone-width`:
there every option, `a` included, is a prototype commit,
because the zone is invisible and only the prototype draws it.
Every other option is one commit on the branch `prototype/ide-batch-2-choices`.
The tree of each commit is the base plus only that option
(each commit restores the files of the previous option to the base),
so checking one commit out builds that option alone.
The branch is throwaway prototype code and is never merged.

- `zone-width` `a`, `3dfe71e4e`:
  the current 5 px zone, two columns on each side of the line, drawn as a translucent magenta overlay.
- `zone-width` `b`, `9655769d8`:
  a 7 px zone, three columns on each side.
- `zone-width` `c`, `f1c4c4d48`:
  a 4 px zone, one column on the tree side and two on the source side.
  4 px cannot be centered on a 1 px line;
  the tree side gets the single column because the tree's scroll bar lies on that side.
- `zone-width` `d`, `f05226ea6`:
  a 13 px zone, six columns on each side.
- `query-selection-ink` `b`, `bf446cf9c`:
  selected text in both boxes in the ink chosen from the selection fill,
  the ink of selected rows and of selected source text.
- `selected-row-tint` `b`, `3e5c35d38`:
  a selected tree row is never tinted.
- `trailing-cell` `b`, `5c4493fb6`:
  the clear cell keeps its 48 px while the clear control is hidden.
- `divider-focus` `b`, `d74bc6728`:
  a 5 px by 96 px focus handle.
- `divider-focus` `c`, `2f74ed887`:
  keyboard focus draws five accent columns over the whole height and no handle.
- `clear-plate` `b`, `061bcdf5d`:
  the hover and press plate fills the whole 48 px cell.
- `padding-click` `b`, `e393926fe`:
  the search panel's key scope is a focus owner again, as before 2026-10-05.
- `watch-limit` `b`, `a7ff27343`:
  a row along the bottom edge with the warning letter `W`,
  `File-watch limit reached:` in bold,
  and `changes may show up to 1 s late. Raise it with sudo sysctl fs.inotify.max_user_watches=1048576`.
  The environment variable `IDE_PROTOTYPE_WATCH_LIMIT` stands in for the watch thread reporting the limit.
  The option's first commit, `587b1475a`, centered the shortened main layout and so moved it 16 px down;
  `a7ff27343` on top of it keeps the layout at the top edge, and only that build is in the frames.

In the zone-width prototypes the focus handle keeps its 5 px width centered on the line at every zone width.

### Command, fixture, and window size

Each frame set comes from a fresh session of the package's native inspection task,
run in the worktree that holds the prototype branch with the option's `ui` and `src` checked out:

```sh
# package/desktop-app/ide/mise.toml, task inspect:native
IDE_NATIVE_MCP_PORT=9394 mise run //package/desktop-app/ide:inspect:native dark scroll
IDE_NATIVE_MCP_PORT=9395 mise run //package/desktop-app/ide:inspect:native light scroll
```

The `watch-limit` sessions add `IDE_PROTOTYPE_WATCH_LIMIT=1`, which the base build ignores.
Fixture, window size, project contents, seat input, pointer hover, settled frames, caret phase,
held presses, scale switches, and lossless re-encoding are those of
[How the 2026-10-05 UI batch 2 screenshots were produced](#how-the-2026-10-05-ui-batch-2-screenshots-were-produced)
and [How the applied frames were produced](#how-the-applied-frames-were-produced).
The `zone-width` sessions add 20 files to the project,
so the tree overflows and shows its scroll bar beside the zone.
`capture-record.json` holds what each session read from the running application.

### Scenes

Every scene starts from the state right after launch: `fixture.ts` open and selected in the tree,
the source focused, the sidebar 256 px wide, so the divider's line is pixel column 256.

- `zone-width`:
  `idle` with the pointer parked over the source;
  `hovered` with the pointer on the zone's outermost source-side column.
  Each session also checked that the pointer one column further out leaves the line at rest.
- `query-selection-ink`:
  `find-selected` after Ctrl+F, typing `Latin`, and Ctrl+A;
  `search-selected` after Escape, two Shift taps, typing `fixture`, and Ctrl+A.
- `selected-row-tint`:
  `hovered` with the pointer on the selected row;
  `focused` after Tab from the source and Home and Down onto the selected row.
- `trailing-cell`:
  `focused-empty` after Ctrl+F;
  `typing` after typing `Latin`;
  `unfocused-text` after a seat click in the source;
  `empty` after Ctrl+F, Delete, and another click in the source;
  `long-typing` after Ctrl+F and typing 130 letters, longer than the box;
  `long-unfocused` after another click in the source.
- `divider-focus`:
  after Tab twice from the source, at scale 1 and at scale 2.
- `clear-plate`:
  `hovered` with the pointer on the find box's clear control after typing `Latin`
  and waiting for the count, which decides where the cell is;
  `pressed` during a held press that is released outside the cell.
- `padding-click`:
  `before` after two Shift taps,
  typing `fixture`,
  and waiting for the results;
  `after` a seat click at 156, 122, in the search panel's left padding beside the query box.
- `watch-limit`:
  the window after start.

### Crop rectangles of the 2026-10-06 UI batch 3b

Rectangles are left, top, width, and height in logical pixels;
a `-2x` frame is cut at the doubled rectangle and enlarged by half the factor.

- `zone-width`: 196, 32, 120 by 240, enlarged 4 times.
- `query-selection-ink` `find-selected`: 257, 604, 843 by 56, enlarged twice.
- `query-selection-ink` `search-selected`: 150, 50, 800 by 110, enlarged twice.
- `selected-row-tint`: 0, 32, 257 by 248, enlarged twice.
- `trailing-cell`: 600, 604, 500 by 56, enlarged twice.
- `divider-focus`: 216, 200, 80 by 260, enlarged 4 times.
- `clear-plate`: 940, 600, 160 by 60, enlarged 4 times.
- `padding-click`: 150, 50, 800 by 110, enlarged twice.
- `watch-limit`: 0, 560, 1100 by 100, not enlarged.

### What the frames do not show

- The mouse cursor and therefore the column-resize cursor over the zone:
  the screenshot holds the application surface only.
- The zone overlay in the application:
  it exists only in the `zone-width` prototype commits.
- `watch-limit` `a` beyond the unchanged window:
  its only effect is the log line
  `Cannot watch <directory>: the inotify watch limit is reached; raise fs.inotify.max_user_watches`
  (`src/change_watch/watch_thread.rs`).
- A real watch limit:
  `b` shows the message from the injected trigger, not from exhausted inotify watches.

### What the frames show

- `zone-width`:
  the magenta band is the zone.
  With 25 rows the tree shows its scroll bar,
  whose thumb is drawn in columns 250 and 251 at rest.
  Options `a`, `b`, and `c` end left of the thumb;
  `d`'s band covers it (`zone-width-d-light-idle-crop.png` shows the thumb inside the band).
  The `hovered` frames show the line's three hover columns lit inside the band.
- `query-selection-ink`:
  the options differ in the dark scheme only.
  `a` draws the selected text black on the selection fill,
  `b` white;
  in the light scheme both draw it white.
  Sampled in the find box's selection,
  the darkest pixel of `a` dark is 0 and the lightest of `b` dark is 255 (gray levels).
- `selected-row-tint`:
  in `a` the hovered and the focused selected row have the darker fill `#006EC3`,
  the focused one also its boundary;
  in `b` the hovered row looks like the row at rest,
  and keyboard focus is marked by the boundary alone.
- `trailing-cell`:
  the short-text states (`focused-empty`, `typing`, `unfocused-text`, `empty`) are identical in both options,
  because the trailing cell is empty space whenever the clear control is hidden.
  The options differ only for a text longer than the box without focus:
  in `long-unfocused` the text of `a` runs to 12 px from the box's end
  and the text of `b` stops 48 px from it.
- `divider-focus`:
  the handle is 48 px tall in `a` and 96 px tall in `b`;
  `c` is a five-column accent line over the whole height,
  which also overlaps the two last columns of the selected tree row.
- `clear-plate`:
  `a`'s 32 px plate leaves 8 px of the cell around it;
  `b`'s plate fills the cell,
  so its boundary lies on the box's border and covers the box's focus line under the cell.
- `padding-click`:
  in `a` the `after` frame still shows the caret,
  the clear control,
  and the focus line;
  in `b` all three are gone and the box has its unfocused fill.
- `watch-limit`:
  `a` shows the window unchanged;
  `b` shows the 32 px row along the bottom edge,
  with the main layout shortened by that height.
  Its accessible label is the whole sentence,
  read from the running application.
