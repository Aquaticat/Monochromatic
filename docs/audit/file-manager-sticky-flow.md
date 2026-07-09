# File manager sticky flow: how two prototypes replaced a layout engine

This audit records how `packages/desktop-app/file-manager-electron` and
`packages/desktop-app/file-manager-gtk-sticky` were derived from the original GTK file manager
(`packages/desktop-app/file-manager`),
 and exactly where their behavior differs from it.
It is written for a reader who knows HTML and CSS but not GTK,
so every GTK concept is introduced through its web equivalent.

Both prototypes are complete packages:
 they build,
 lint clean,
 carry unit tests for every pure
function,
 and pass an automated end-user test that runs the real app inside this repo's nested
Wayland compositor (`packages/cli/nested-wayland-session`),
 drives it with synthetic keyboard
input,
 and asserts the app's observed state.
Both boundary tests use the same key sequences and the same state-file schema,
so the two apps are held to identical observable behavior.

## The product, in web terms

The file manager is a horizontal strip of columns,
 like a miniature multi-pane Finder.
Every pane is a fixed 320x520 box on a grid:
 its column is how deep it sits in the
browse lineage (open a folder inside a pane and the new pane appears one column to the right),
and its row is assigned by a tidy tree layout so a child lines up with its parent and a later
sibling starts below the previous sibling's whole subtree.
One scroller owns the whole strip on both axes,
 the way one `overflow: auto` div would.

The interesting behavior is what happens when you scroll down.
A parent pane is supposed to follow you:
 while any of its direct children is on screen,
 the
parent stays visible,
 riding along inside a fixed region the project calls a rail
(the green `Y6L` boxes in debug screenshots).
A rail spans from the parent's own grid row down to the bottom edge of its deepest direct child.
If you know CSS,
 you already know this behavior by name:
it is what `position: sticky` does to a section heading inside its section.

## The original, described for a web developer

GTK has no `position: sticky`.
The original app therefore builds the strip out of `GtkFixed` canvases,
 which are exactly
`position: absolute` containers:
 every child is placed at explicit x/y coordinates,
 and nothing
lays anything out for you.
On top of that it implements the following,
 all by hand,
 in
`packages/desktop-app/file-manager/src/layout.rs` and `layout/lane.rs`:

- A scroll listener (`connect_value_changed` on the scroller's adjustment,
   the equivalent of a
  `scroll` event listener reading `scrollTop`).
- A per-lane offset store:
   a map from each parent pane to how far its group has slid,
  recomputed on every scroll tick.
- Hierarchical offset accumulation:
   a pane's final position sums the offsets of every ancestor
  lane above it,
   walking the parent chain.
- Rail clamping:
   a pane can belong to two rails at once (a child in its parent's rail,
   and
  itself the parent of another rail),
   so its position is clamped to the intersection of every
  rail containing it.
- A collision solver:
   after clamping,
   siblings could still be pushed onto each other,
   so a
  forward pass enforces a minimum spacing going down and a backward pass enforces it going up,
  relaxing every column into a non-overlapping stack.
- Reveal machinery:
   after spawning a pane,
   scroll it into view.
  The web equivalent is one `element.scrollIntoView()` call;
   GTK updates scroll ranges one
  layout pass after content changes,
   so the original retries on a timer until the geometry
  settles.

In web terms:
 the original is a hand-rolled layout engine running in a `scroll` handler over a
tree of absolutely positioned boxes.
Measured over `layout.rs`,
 `layout/lane.rs`,
 `layout/lane/geometry.rs`,
 and `layout/scroll.rs`,
that engine is 549 lines of code (comments and blanks excluded).
It works,
 and a human approved its behavior as the product baseline
(see `docs/handover/file-manager-gtk-build.md`),
 but it took several recorded iterations of
scroll models,
 an off-by-one bug from clamping against stale scroll bounds,
 and the solver to
get there.

## The insight chain

The prototypes came out of a conversation that started with the question
"how much simpler would this layout be in HTML/CSS?
" and sharpened in three steps.

First:
 overlap prevention is not an intrinsic problem of this product.
HTML normal flow,
 the default block layout every web page starts with,
 cannot overlap siblings.
The original needs a collision solver only because absolute positioning opts out of flow.
The solver is compensation for a representational choice,
 not essential complexity.

Second:
 `position: sticky` is the one CSS positioning scheme that adds scroll-driven movement
while staying in flow.
A sticky element keeps its layout slot,
 rides the viewport while its containing block passes,
and is released when the containing block's end pushes it off.
Written as a formula,
 a sticky element with `top: 0` sits at:

```txt
y = band_top + clamp(scroll - band_top, 0, band_height - element_height)
```

That clamped expression is recognizably the same job as the original's entire lane engine:
follow the scroll,
 inside a fixed region,
 without leaving it.

Third,
 and decisively:
 the shared pane model already guarantees the structure sticky needs.
The tidy tree layout in `packages/desktop-app/file-manager/src/model.rs` assigns rows so that a
node aligns with its first child and a node's whole subtree occupies a contiguous row block
below the previous sibling.
Two consequences follow directly:

- Within one column,
   the rail of a pane ends at its deepest direct child,
   and the next pane in
  that same column belongs to a later subtree,
   so it starts below that.
  Rails in a column can never overlap each other.
- Therefore,
   if each pane is placed in its own rail and clamped inside it,
   no two panes can
  ever collide,
   at any scroll position.
  Non-overlap stops being something you solve and becomes something the structure guarantees.

Once the rule and the guarantee were both on the table,
 each prototype is just one way of
saying "apply the sticky rule per pane":
the Electron app says it declaratively and lets the browser's layout engine execute it,
and the GTK variant says it as one arithmetic expression executed per scroll tick.

## Prototype 1: file-manager-electron

The renderer builds the strip as ordinary HTML:

```html
<div class="strip">          <!-- overflow: auto; display: flex; the one scroller -->
  <div class="column">       <!-- 320px wide, block layout -->
    <div class="rail">       <!-- height/margins computed once per model change -->
      <section class="pane"> <!-- position: sticky; top: 0 -->
```

The whole scroll-time behavior is these two declarations in
`packages/desktop-app/file-manager-electron/src/styles.css`:

```css
.strip { overflow: auto; }
.pane  { position: sticky; top: 0; }
```

The only geometry the app computes is static flow numbers,
 once per model change,
 in
`src/bands.ts` (119 code lines):
 each rail's height (own row down to deepest direct child's
bottom) and the margin above it that places it at its grid offset.
Because rails are normal-flow siblings,
 the margins are provably non-negative
(the unit tests assert this),
 which is the structural non-overlap guarantee in code.
During scrolling,
 zero application script runs;
 the browser's layout engine,
 which executes
sticky positioning off the main thread,
 does everything.

What JavaScript remains is not layout:
 the pane model itself
(`src/strip.ts`,
 a line-for-line port of the Rust model so the two ecosystems share semantics,
with the Rust model's unit tests ported case for case),
 DOM reconciliation
(create/remove/reorder pane elements when the model changes;
 the browser gives you flow,
 not
diffing),
 keyboard handling,
 and the sandboxed IPC bridge that lets the renderer list
directories without filesystem access of its own.

One web-side convenience deserves explicit mention because the GTK side lacks it:
revealing a newly spawned pane is a single `scrollIntoView()` call,
 because the browser
reflows synchronously before scrolling.
No retries,
 no timers.

## Prototype 2: file-manager-gtk-sticky

The second prototype answers the obvious objection:
 "fine,
 but we ship GTK,
 not a browser.
"
It ports the RULE back to GTK rather than the technology.

It reuses the original crate's public model,
 filesystem,
 and type modules verbatim
(`file-manager` is a path dependency),
 so the two GTK apps differ only in the layout engine.
The engine is `src/band.rs`:
 75 code lines of pure functions,
 no GTK types anywhere,
of which the load-bearing part is exactly the sticky formula:

```rust
pub fn sticky_y(band: Band, scroll: f64) -> f64 {
    let travel = (band.height - f64::from(PANE_HEIGHT)).max(0.0);
    band.top + (scroll - band.top).clamp(0.0, travel)
}
```

The GTK adapter (`src/layout.rs`,
 227 code lines) is only plumbing:
 one absolute canvas
(a `GtkFixed`,
 the `position: absolute` container),
 a widget map,
 and a scroll listener whose
entire body is "re-place every pane at `band::positions(placements, scroll)`".
Gone relative to the original:
 the per-lane offset store,
 the parent-chain accumulation,
 the
rail-intersection clamping,
 the two-pass collision solver,
 and the offset pruning on close.
There is no layout state at all;
 position is a pure function of the model snapshot and the
scroll offset,
 which is why `band.rs` can be unit-tested by sweeping scroll values and
asserting the overlap count is zero everywhere.

Because GTK has no native sticky,
 this variant still pays two costs the browser build does not:
the scroll listener runs on the UI thread on every scroll tick (like a JS `scroll` handler,
where the browser's sticky runs in its compositor),
 and the reveal-after-spawn retry timer
survives,
 because GTK still settles scroll ranges one layout pass after content changes.

## How the claims were verified

- The pure math is unit-tested in both languages
  (`file-manager-electron/src/bands.unit.test.ts`,
   `file-manager-gtk-sticky/src/band_tests.rs`):
  leaf bands never travel,
   parent bands stretch to the deepest direct child and ignore
  grandchildren,
   the clamp pins then releases,
   and a scroll sweep over the shared fixture tree
  reports zero overlapping pairs at every sample.
- Both apps mirror a shallow JSON state file
  (the Electron main process writes it;
   the GTK app writes it when `FM_STICKY_STATE_PATH` is
  set) with identical keys,
   including two facts computed from geometry:
  `rootPinned` (the first root pane sits exactly at the viewport top while the app is scrolled)
  and `overlapCount`.
- Both boundary tests host the real app inside the nested Wayland compositor with a throwaway
  fixture directory,
   drive it with the same key sequence
  (enter,
   left,
   enter again for dedup,
   down,
   enter,
   backspace),
   and assert the same states,
  decisively `rootPinned: true` with `scrolledDown: true` and `overlapCount: 0`.
- Screenshots with the debug tint were pixel-measured to confirm the rendered rails and panes
  coincide (that measuring caught a real bug;
   see the GTK bug list below).

## Behavioral differences against the original

The prototypes are deliberately not pixel-identical to the approved baseline.
Each difference below names what a user would observe,
 why it differs,
 and how much it matters.

### Release point at the end of a rail

The original stops a lane's movement when the lane's bottom edge reaches the viewport bottom
(`lane_max_offset` in `layout/lane.rs`:
 maximum offset is `lane_bottom - viewport_height`).
Sticky releases a pane when the rail's end pushes the pane off
(maximum travel is `band_height - pane_height`).

Concretely,
 with a rail spanning rows 0 through 3 (2116px) in a 600px viewport:
the original lets the parent follow until the app has scrolled 1516px,
 at which point the
lane's bottom is flush with the viewport bottom and the parent scrolls away with it;
sticky keeps the parent pinned until 1596px,
 when the rail's own end arrives.
Sticky's variant is the standard web semantics ("the section heading stays until its section
is gone");
 the original's variant releases earlier.
Both keep the parent visible while children are;
 the difference is only in the hand-off frame.
The original's exact formula depends on the viewport height;
 sticky's does not.

### Every parent sticks, not only roots

In the original,
 a pane's movement comes from its parent's lane
(the handover records this as preventing parents from double-moving into siblings),
so the visibly sticking pane is primarily the root riding its own root lane.
In the sticky model every pane owns a band:
 leaves get a band exactly one pane tall
(zero travel,
 so they are simply static grid boxes),
 and every pane with children sticks
within its own rail,
 the way every section heading in a long document sticks,
 nested or not.
A middle-of-the-lineage parent therefore follows the scroll in the prototypes in situations
where the original would let it slide off while its own children remain visible.
This is a behavior improvement by web intuition,
 but it is a difference from the approved
baseline and needs the product owner's eyes before it replaces anything.

### The parent-chain accumulation is gone

The original sums scroll offsets along a pane's ancestor chain to position it.
In the sticky model no pane's position depends on any other pane's position;
each clamps independently inside its own fixed band,
 and the tidy tree guarantees those
independent decisions can never conflict.
There is no observable "accumulated" motion to compare because the structure makes it
unnecessary;
 what a user sees in both cases is panes staying inside their rails.

### The collision solver is gone, and with it its side effect

The original's forward/backward relaxation could compress the gap between siblings when
clamping pushed them together (spacing is enforced as a minimum,
 not a fixed grid).
In the prototypes,
 pane gaps are fixed flow margins and can never compress,
 because the
situation the solver handled (two panes' computed positions colliding) is structurally
impossible.
If a future design ever wants gap compression back,
 that is precisely the point where a
solver,
 or CSS beyond sticky,
 re-enters.

### Deliberate scope cuts, not layout differences

The prototypes do not implement thumbnails,
 drag-and-drop,
 the Windows/macOS drag shims,
 or
the original's `close_column`/`close_right_of` bulk gestures;
 the Electron port also omits the
original's snapshot generation counter.
These are orthogonal to the layout comparison;
 the GTK variant reuses the original's model so
those semantics remain available to it unchanged.

## What the toolkit swap actually bought, measured

- Original lane engine:
   549 code lines of stateful,
   scroll-driven positioning
  (`layout.rs` 170,
   `layout/lane.rs` 275,
   `lane/geometry.rs` 40,
   `layout/scroll.rs` 64).
- GTK sticky variant:
   302 code lines total for the same jobs
  (`band.rs` 75 pure and unit-tested,
   `layout.rs` 227 of GTK plumbing),
  with zero layout state and the policy itself being one clamp expression.
- Electron variant:
   119 code lines of one-shot flow arithmetic (`bands.ts`)
  plus two CSS declarations;
   zero code of any kind runs during scrolling.

The honest conclusion,
 and the reason this audit exists rather than just a port:
most of the win was available WITHOUT leaving GTK,
 because the win came from the model
(flow plus sticky semantics plus the tidy tree's disjoint-bands guarantee),
 not from the
browser.
What only the browser provides is executing that model declaratively:
sticky positioning off the main thread,
 synchronous reflow that makes `scrollIntoView`
retry-free,
 and a layout engine that has been debugged for twenty years.

## The GTK integration bugs, as evidence

The sticky CSS in the Electron prototype needed no debugging at all.
Reimplementing the same rule in GTK surfaced three integration bugs before its boundary test
passed,
 and each is instructive about what a browser quietly does for you:

- Initial keyboard focus landed on the pane header's close button
  (the first focusable widget in the tree),
   so the first Enter closed the pane instead of
  opening the selected row.
  The web build never met this because its entries are non-focusable list items under a
  single keydown handler.
- A GTK `ListView` renders a selected row but keeps its keyboard cursor unset until the first
  arrow key,
   so a bare Enter activated nothing;
   the fix initializes the cursor explicitly
  (`ListView::scroll_to` with the focus flag,
   which needed a newer GTK feature level).
  In the web build,
   selection is app state and Enter reads it directly.
- Pane bodies carry an expand flag that propagates up the widget tree and stretched the
  per-column canvases,
   silently displacing every later column ~74px right of its rail.
  This was caught only by pixel-measuring a compositor screenshot.
  The fix replaced per-column canvases with one absolute canvas,
   whose children cannot be
  displaced by stretching.
  CSS's answer to the same problem is that `width: 320px` means what it says.

## Where the pieces live

- Original:
   `packages/desktop-app/file-manager` (lane engine under `src/layout*`).
- Electron prototype:
   `packages/desktop-app/file-manager-electron`
  (`src/bands.ts`,
   `src/styles.css`,
   model port in `src/strip.ts`).
- GTK sticky prototype:
   `packages/desktop-app/file-manager-gtk-sticky`
  (`src/band.rs`,
   adapter in `src/layout.rs`,
   shared model via the `file-manager` crate).
- Compositor test host:
   `packages/cli/nested-wayland-session`.
- Approved-baseline history:
   `docs/handover/file-manager-gtk-build.md`.

## Decision this audit does not make

Whether the sticky release semantics (and every-parent stickiness) should replace the approved
baseline is a product call:
 the baseline was approved by a human on a live run,
 and these
prototypes change its feel in the two ways described above.
The next step,
 if the direction is wanted,
 is a side-by-side live run of
`file-manager` and `file-manager-gtk-sticky` on the same fixture tree.
