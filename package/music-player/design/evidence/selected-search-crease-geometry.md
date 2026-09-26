# Selected Fold Search A informational clearance on the inner panel

## Measured boundary

The accepted [Search A review](../questions/current.html) uses the physical
2076 × 2152px Pixel 9 Pro Fold inner panel at the measured 390dpi setting.
E2 places the approximate visible dent at x `[983,1093)`px,
centred on x `1038`.
These endpoints inherit uncertainty from the published panel diagonal and
the user's approximately 7.5mm visible-width estimate.
Surfaces,
dividers,
backgrounds and hit regions may cross this band;
meaning-bearing marks must remain clear.
See [device-metrics.md](../device-metrics.md) and
[decisions.md](../decisions.md) under E2.

## Native selected-A measurements

The private debug-only prototype worktree's
`package/music-player/design/questions/evidence/search-selected-inner-*.xml`
records UI Automator nodes for Search results,
typing and empty states in light/dark at 100%/200% text.
The capture metadata identifies prototype commit `25dc2fb01`,
a 300dp system-managed **debug IME** for typing,
and the 390dpi physical panel.
The linked active review uses its sanitized physical-panel PNGs;
the raw XML is not a public asset and must not be inferred from the
review's embedded bitmap alone.

Across the measured inner fixtures,
text and labelled app-node bounds did not intersect x `[983,1093)`.
The rightmost left-side text bounds ended at x `965` (`4:35`),
18px before the approximate dent start.
The nearest right-side text bounds began at x `1132` in an empty Search
state,
39px beyond the approximate dent end.
The closest opposing bounds were therefore 167px apart,
compared with the approximate 110px dent width.
The right-side positive result labels began at x `1220`;
that result state has a wider opposing bound gap than the empty state.

For the active 200% typing capture,
UI Automator placed `4:35` at `[842,629][965,707]`,
Open at `[744,168][894,259]`,
and the matching right-side result labels at x `1220` or farther.
The [light typing screenshot](../questions/render/search-selected-review-inner-typing-light-s200.png)
visually shows no meaning-bearing app mark in the central band above the
debug IME;
the continuing pane/background boundary is structural and allowed.
The [dark empty screenshot](../questions/render/search-selected-review-inner-empty-dark-s100.png)
shows the empty-state heading near x `1132` without entering the dent.
These visual checks corroborate the node bounds,
not a per-pixel proof of every animation frame or arbitrary long text.
The debug IME itself is system-owned test input,
not an app content placement to certify under E2.

## Detector control and remaining choice

The read-only XML inspector classified a text node as crossing when its
bounds began before x `1093` and ended after x `983`.
It reported no crossing app labels in the selected inner fixtures.
A disposable **in-memory** positive control changed one `4:35` box from
`[842,629][965,707]` to `[842,629][1000,707]` without changing repository
files;
the same crossing check changed from zero to one.
This proves the box detector can find an injected intersection,
not that UI Automator bounds perfectly describe glyph ink or every icon.

E2 specifies the opposing-information distance as
`max(min_padding, crease_width)` in physical units.
The observed 167px gap clears the approximate 110px crease term.
It satisfies the formula **only if** the still-open `min_padding` term is
at most 167 physical px at this panel size.
At the measured 390dpi that observed gap is approximately 68.5dp,
but neither the dp conversion nor the existing 12dp mode-button content
padding chooses E2's minimum.
A larger minimum would require another visible design or a different content
arrangement;
do not silently adopt one from this before-state measurement.
Long result names,
other screen states and the preference for a future minimum clearance
remain separate review work.
