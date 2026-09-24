# Command bar round: prior art and scope

This is design evidence,
 not a production specification.
 D21 already settles a command bar
with a configurable global hotkey off by default.
 D25 reserves Ctrl+F for future
search and Ctrl+O for the folder picker.
 A keyboard-map pass remains open.

## Primary sources

- The local Material 3 archive at
  `~/Downloads/m3.material.io/components/search/{overview,guidelines,specs}/index.html`
  distinguishes a search bar for the current view,
  a search app bar for primary global
  search,
  and an icon entry for secondary search.
  Focused results appear in lists,
  optionally separated by category labels or gaps.
  On medium and expanded layouts,
  docked results are supported;
  compact layouts default to full-screen focused search.
  Its contained search style uses a persistent filled container and recommends
  surface roles separated by more than one tonal step.
  The search bar is 56dp high;
  the docked container is 360 to 720dp wide and 240dp to two-thirds of the screen high.
  These are search-component precedents,
  not a mandate that the D21 command bar must
  perform media search.
- [IntelliJ IDEA Search Everywhere][jetbrains-search] is a single entry point for files,
  actions,
  symbols,
  settings and more,
  with tabs and scoped shortcuts;
  it opens on
  recent files before typing.
  This supports an explicit-scope alternative,
  but does
  not erase D25's already reserved keys in this player.
- [VS Code Command Palette][vscode-palette] uses Ctrl+Shift+P for commands while Ctrl+P
  opens file navigation;
  its quick-input surface can also switch modes.
  This
  supports separating actions from navigation even when a common surface is reused.

## Native design study

The throwaway Slint study is on the prototype branch at
`package/music-player/design/candidates/command-study.slint`.
 Slint Viewer 1.17.1
rendered the opaque rasters in `questions/render/command-round-*` at 480 × 600px
(the current desktop app's `preferred-width` and `preferred-height` in
`package/music-player/desktop-app/ui/app.slint`) for every S × C combination and in
both schemes.
 The recommended S1C1 combination also appears at an exploratory
1100 × 640px stress size;
 neither size decides the open default-window question (11c).

The background is a simplified,
 design-only Slint player scene preserving the D43
no-volume choice,
 D38 Open action,
 current track emphasis and folder context.
 It is
not a screenshot of the current production desktop app.
 Role colors use the measured
Android wallpaper evidence in `questions/evidence/cover-round-wallpaper-roles-{dark,light}.json`
as design-study references;
 this does not settle the desktop color mapping.
 S3 is an
illustration of a detached quick window drawn inside one Slint scene,
 not a functioning
second operating-system window or a global-hotkey feasibility test.

The independent axes are:

- **S1,
  docked under the player header:** the command surface stays with its source
  window,
  covering content below the folder row.
- **S2,
  floating inside the player:** centered and scrimmed,
  detached from the header
  but still inside the app.
- **S3,
  detached quick-window concept:** a separate-looking palette over the player,
  intended to express the globally invoked state when the player is not focused.
- **C1,
  actions only:** results are executable commands;
  Ctrl+F remains a separate
  future media search entry.
- **C2,
  explicit modes:** Actions,
  Tracks and Folders scopes share a palette but do not
  mix their results in one list.
- **C3,
  mixed results:** folders,
  tracks and actions appear together under group labels.

C2 and C3 use tracks and folders as illustrative result types,
 not a decision on the
future search index or ranking.
 The user can choose an S code and a C code
independently.

## Current design ranking for the questionnaire

- **Surface:** S1 > S2 > S3.
  S1 keeps the bar local to its player context and follows
  the docked-search precedent;
  S2 is a recognizable keyboard palette but occludes
  more context;
  S3 fits an out-of-app hotkey concept yet loses local context and
  remains untested as a real operating-system window.
- **Content:** C1 > C2 > C3.
  C1 preserves D25's clean distinction between commands,
  search and picker;
  C2 makes the distinction explicit but spends a row on modes and may
  duplicate the picker;
  C3 finds everything in one place but makes result relevance
  and Enter's effect less predictable.

[jetbrains-search]: https://www.jetbrains.com/help/idea/searching-everywhere.html
[vscode-palette]: https://code.visualstudio.com/docs/editing/getting-started/userinterface#_command-palette
