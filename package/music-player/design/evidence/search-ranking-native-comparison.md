# Search result-order comparison on the disposable Fold

## What the fixture does and does not do

This #116 comparison uses only debug fixture rows from
`SearchRankingFixture.kt` on prototype commit `6addfc139`,
with D58's aligned row correction from `baa37caaf`.
The installed debug APK and the local build both hashed to SHA-256
`bf9a51c42facfca969e275d5fe55769656c451900f57689dc7c24190e8d6d2ef`.
The activity dispatches `search-deck-*` candidates to
`SearchPersistentDeckStudy.kt`;
these screenshots do not exercise the separate `SearchLayoutStudy.kt` branch.
All samples have a prefilled `cam` query,
a closed keyboard,
200% text,
390dpi and the selected inner-browser/deck and E2 P7.5 layout.
The native inner screen is 2076 × 2152 physical px;
the cover is 1080 × 2424px.
The cover-only D56 viewport marker remains in the candidate name.
The fixed result captions are **illustrative**:
there is no search index,
scoring algorithm,
click handler or result navigation in this study.

Two folders are shown:
`Camellia` and `Camera Obscura`.
Four tracks have direct title/filename examples:
`Cam` (exact),
`Camellia Waltz` in `Camellia` (prefix),
the same filename in `Cult of Luna` (same-title disambiguation),
and `Live at Camellia` (contained).
A separately toggled fifth track,
`Another Xronixle`,
illustrates an **immediate-parent-only** `Camellia` match even though its
own title lacks `cam`.
The fixture contains no ancestor-path,
Unicode casefold,
token,
fuzzy,
locale sorting,
large-library cardinality or real filename parser test.
Its manually ordered lists cannot validate any of those matching rules.

## Independent membership choice

- **D: direct names only.**
  Folder names and track filenames can contribute hits;
  parent names stay visible as disambiguating context but do not themselves
  expand into track hits.
  The sample keeps the six directly named rows.
  This avoids a parent folder injecting all its children into a large
  search list,
  but a user must open its folder to find a track whose own name lacks
  the query.
- **P: include immediate-parent-only track hits.**
  The sample adds `Another Xronixle` with
  `Track · Camellia · parent-only match`.
  It can surface a relevant track directly,
  but a large folder name match could dominate results with unrelated
  child filenames and duplicate its own folder result.
  The fixture does not measure that real-library risk.

On the inner panel,
the [D mixed-order initial screenshot][inner-mixed-direct-top] and
[P mixed-order initial screenshot][inner-mixed-parent-top] are
pixel-identical because the added track sits below the initial viewport.
The [D mixed-order scrolled state][inner-mixed-direct-end] and
[P mixed-order scrolled state][inner-mixed-parent-end] expose the actual
membership difference;
the P final detail remains fully visible.
On the cover,
[P mixed-order initial][cover-mixed-parent-top] and
[P mixed-order scrolled][cover-mixed-parent-end] show the extra row.
A zero pixel difference at one scroll position is not evidence of an
identical result set.

## Independent ordering choice

Membership is held fixed when comparing these orders.
`>` denotes one illustrative result position,
not a searched syntax or a promise that a sorter implements that relation.

### M. Relevance-mixed across folders and tracks

`Cam` track > `Camellia` folder > `Camellia Waltz` in `Camellia` >
`Camellia Waltz` in `Cult of Luna` > `Camera Obscura` folder >
`Live at Camellia` track.
The optional parent-only track is last.
This foregrounds an exact filename while keeping an early matching folder.
Its mixed types can be slower to scan for users who came only to browse folders.
See [inner M/D][inner-mixed-direct-top] and
[cover M/D][cover-mixed-direct-top].

### F. Folders first

`Camellia` folder > `Camera Obscura` folder > `Cam` track >
`Camellia Waltz` in `Camellia` > `Camellia Waltz` in `Cult of Luna` >
`Live at Camellia` track.
The optional parent-only track is last.
This gives the filesystem's folder structure priority,
but a prefix folder can outrank an exact track filename.
See [inner F/D][inner-folders-direct-top] and
[cover F/D][cover-folders-direct-top].

### T. Tracks first

`Cam` track > `Camellia Waltz` in `Camellia` >
`Camellia Waltz` in `Cult of Luna` > `Live at Camellia` track >
`Camellia` folder > `Camera Obscura` folder.
With parent inclusion,
`Another Xronixle` appears before the folders.
This favors immediate track selection,
but folders can be pushed beneath the visible viewport.
See [inner T/D][inner-tracks-direct-top] and
[cover T/P][cover-tracks-parent-end].

Within every displayed fixture,
the track title and parent detail distinguish the two `Camellia Waltz`
entries.
The candidates do **not** prove that the intended exact/prefix/contained
categories could be calculated or tie-broken consistently in the real
library.
Folder and track actions remain a separate #129 question.
Query focus,
Back/Clear and scroll restoration remain #127;
accessibility remains #118.

## Bounded verification and capture manifest

The private UI Automator hierarchy was checked for the ordered,
fully visible title/detail pairs in every initial and scrolled capture.
Across both panels and all membership/order combinations,
the initial state included the first row and the scrolled state showed the
last row with its detail above the navigation band;
together they exposed every fixed fixture row.
Deliberately swapping two expected positions caused the order check to
fail (positive control).
This verifies the **synthetic fixture order** and keyboard-closed
visibility,
not a real result algorithm,
an actual scroll boundary,
covered-row activation or post-refocus reachability.
The parent-only row in the inner mixed/folders initial view was below the
viewport,
so the paired scrolled view is essential.

Each published PNG is named
`search-rank-review-{inner|cover}-{rankfolders|rankmixed|ranktracks}-{direct|parenthits}[-end]-s200.png`.
The corresponding private capture used the same panel/order/membership
suffix under `search-rank-` for initial,
or `search-rank-end-` for scrolled,
with adjacent `.xml` and `.json` source files.
The source metadata records the precise candidate token
`search-deck-right-lift-retain-e2floor7p5-imeviewport-{rank}[optional -parenthits]-results-light`,
disposable device state `2` inner or `0` cover,
physical screen size,
density,
font scale and matching APK hash.
The sanitizer replaced each **entire** status region with a generic
same-panel reference,
verified zero change to every app pixel below that band,
verified the public status matches the reference,
and removed PNG metadata.
Only sanitized PNGs are published;
raw status-bearing screenshots and UI hierarchies are private.

No matching scope,
relevance/tie-break algorithm or result activation is selected in this
evidence note.
No production Search code,
original AVD setting or new IME test was changed.

[inner-mixed-direct-top]: ../questions/render/search-rank-review-inner-rankmixed-direct-s200.png
[inner-mixed-direct-end]: ../questions/render/search-rank-review-inner-rankmixed-direct-end-s200.png
[inner-mixed-parent-top]: ../questions/render/search-rank-review-inner-rankmixed-parenthits-s200.png
[inner-mixed-parent-end]: ../questions/render/search-rank-review-inner-rankmixed-parenthits-end-s200.png
[cover-mixed-parent-top]: ../questions/render/search-rank-review-cover-rankmixed-parenthits-s200.png
[cover-mixed-parent-end]: ../questions/render/search-rank-review-cover-rankmixed-parenthits-end-s200.png
[cover-mixed-direct-top]: ../questions/render/search-rank-review-cover-rankmixed-direct-s200.png
[inner-folders-direct-top]: ../questions/render/search-rank-review-inner-rankfolders-direct-s200.png
[cover-folders-direct-top]: ../questions/render/search-rank-review-cover-rankfolders-direct-s200.png
[inner-tracks-direct-top]: ../questions/render/search-rank-review-inner-ranktracks-direct-s200.png
[cover-tracks-parent-end]: ../questions/render/search-rank-review-cover-ranktracks-parenthits-end-s200.png
