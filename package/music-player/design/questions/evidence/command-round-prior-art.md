# Command bar round: prior art and scope

This is design evidence,
 not a production specification.
 The first S × C matrix was an
internal draft and has been withdrawn from review:
 it treated in-app placement and
global invocation as exclusive,
 treated D25's shortcut reservation as a requirement for
separate surfaces,
 and compared different input/result states.
 Its native captures remain
historical experiment evidence only;
 no option has been put to the user or selected.
The active round is being reframed around independent in-app placement,
 global
invocation,
 and search-surface relationship decisions.
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
 The draft incorrectly asked for one S code when S3
could coexist with either in-app surface;
 the user was never asked to choose these codes.

## Historical first-draft ranking (withdrawn)

- **Surface:** S1 > S2 > S3 was not a valid exclusive ranking.
  S1 and S2 address
  in-app placement;
  S3 addresses a globally invoked window relationship that may
  coexist with either.
  The draft did not depict another app in focus or an actual
  detached OS window.
- **Content:** C1 > C2 > C3.
  The claimed D25 justification was incorrect:
  D25 reserves shortcuts but does not require separate surfaces.
  C1 might still have a useful separation tradeoff;
  C2 makes the distinction explicit but spends a row on modes and may
  duplicate the picker;
  C3 finds everything in one place but makes result relevance
  and Enter's effect less predictable.

## Corrected active study, independent questions

The rebuilt throwaway Slint source is committed on the prototype branch as
`ee1b2d59c`,
 with native-fit fixes in `dbbf5116e` and `6d533f740`.
 Its new
`questions/render/command-round-{i,g,r,e}*` captures replace the first matrix for
review.
 Every proposed state has an opaque light and dark Slint raster:

- **I (in-app placement):** I1 docked below the header,
  I2 floating within the player,
  I3 replacing the content region.
  All show the same typed `open` action query,
  matching actions and selected result.
  Each appears at 480 × 600 and 1100 × 640px.
  I1 also has a 360 × 640px synthetic larger-text and long-label stress capture.
- **G (optional global invocation):** G1 raises the player from a previously active
  notes app,
  G2 draws a detached quick surface over that app.
  I and G are
  complementary;
  the Slint scenes do not implement an actual second OS window or
  hotkey.
- **R (future Ctrl+F):** R1 uses a separate search destination,
  R2 an explicit
  search mode in the command surface.
  Both depict the same illustrative `cam`
  query and folder/track results.
  D25 settles only the reserved shortcut,
  not
  whether those surfaces are shared.
- **Edge probes:** E1 names no matching actions;
  E2 explicitly names an action
  unavailable during a scan.
  They are contextual evidence,
  not extra choices.

The native scenes do not establish keyboard navigation,
 screen-reader semantics,
 focus
restoration,
 result execution,
 search indexing,
 or real compositor window behavior.
The simplified player behind the overlays draws D43's absence of volume,
 a 24% seek
state,
 a pause glyph matching the suggested action,
 D38's tonal Open and current-row
emphasis.
 It remains a design representation rather than an exact desktop application
screenshot.
 The native 360px stress uses explicit larger prototype text,
 not a measured
OS UI-font preset.

Current questionnaire rankings are **I1 > I2 > I3** (source anchor over floating,
context retention over full replacement),
 **G2 > G1** (keep the previous task visible
over raising the player),
 and **R1 > R2** (dedicated navigation room over mode
switching).
 These are recommendations for separately selectable choices,
 not settled
decisions.
 Search targets,
 result ranking,
 a discoverable in-app entry and the exact
in-app binding remain open.

[jetbrains-search]: https://www.jetbrains.com/help/idea/searching-everywhere.html
[vscode-palette]: https://code.visualstudio.com/docs/editing/getting-started/userinterface#_command-palette
