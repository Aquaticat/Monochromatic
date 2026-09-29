# Accepted Search matching outcomes and remaining policy questions

## Why this ledger exists

D60 selected matching each item's **own** folder name or final track
filename component,
not a parent folder that merely contains a track.
D61 selected mixed cross-type relevance,
not a complete comparator.
D59 settled in-place highlight of visible query substrings from the
OS accent in OKLCH.
The accepted `cam` result examples constrain more behavior than the
phrase "matching grammar remains open" suggested.
This ledger keeps the selected outcomes separate from illustrative debug
captions and still-unanswered product policies.
No production Search implementation is authorized by these examples.

`Track.displayPath` is a source-root-relative slash path
(`package/music-player/android-app/app/src/main/kotlin/dev/monochromatic/musicplayer/Track.kt`).
`PageEntry.name` may be a queue-relative path such as
`Artist/Album/01.flac`
(`package/music-player/android-app/app/src/main/kotlin/dev/monochromatic/musicplayer/core/Page.kt`).
Neither entire path is equivalent to the final filename component.
A parent path can identify and distinguish a track without generating a
Search match under D60.

## Settled visible outcomes

- Query `cam` returns a directly named track `Cam` and highlights all of
  its title.
  The user's `cam`/`Cam` correction rules out a
  case-sensitive-only result for this example.
- Query `cam` returns the folder `Camellia` and highlights the `Cam`
  prefix.
  Whole-name exact-only matching is inconsistent with the selected
  design.
- Query `cam` returns the direct track `Live at Camellia` and highlights
  `Cam` at a **later word start**.
  Whole-name prefix-only and whole-word-only alternatives are
  inconsistent with the selected design.
  This example does not prove matching inside an uninterrupted word.
- Both `Camellia Waltz` tracks in different folders remain separate
  results;
  their parent labels distinguish them.
  A matching parent label can also contain a highlighted `Cam` without
  becoming an eligibility field.
- `Another Xronixle` is **not** a Search hit for `cam` solely because it
  belongs to `Camellia`.
  Its name remains on the retained playback deck as the current track.
- The exact `Cam` track precedes the prefix `Camellia` folder in the
  accepted mixed fixture.
  This outcome does not select numeric weights or a tie-break.

The current native selected-only evidence is
`package/music-player/design/questions/current.html`;
`package/music-player/design/evidence/search-match-emphasis-native.md`
records after-state bounds and image provenance.
The D/P and M/F/T comparisons are historical at
`package/music-player/design/questions/archive/search-ranking-before-dm.html`.

## Independent unresolved boundaries

### Middle-of-word eligibility

`Scamper` includes `cam` starting after `S` inside one uninterrupted
word.
Should it match?
`Live at Camellia` is not a control for this case because `Cam` starts
a separate word.
A direct mid-word result could help a listener who remembers only an
interior fragment,
but could also add entries of uncertain relevance to a large local
library.
The [pending native W/A review][word-review] pairs a direct
`Scamper` folder with a `Dreamcam` track while retaining the accepted
controls;
its appended fixture order does not decide the new rows' rank.

### Filename extension and exactness

The visible `Cam` fixture is extensionless,
while the actual library can expose final filenames such as `Cam.flac`.
These are independent questions:

- Should `flac` by itself generate a hit from the extension?
- If the user's query is `cam`,
  should `Cam.flac` rank as an exact basename/stem match or as a prefix
  of the full filename?
- Should the rendered title display the extension?
  Display text is not automatically the matching field.

A path segment like `Album` may appear beside `Cam.flac` as context,
but `Album` cannot itself generate this track hit under D60.

### Unicode and query terms

The accepted ASCII `cam`/`Cam` example does not settle canonical composed
versus decomposed spellings,
accent-sensitive versus accent-insensitive matching,
locale-specific case mappings or scripts without letter case.
A multiple-term query such as `live cam` could require terms in order,
allow terms in any order,
or treat the space literally.
Those are separate choices from middle-of-word eligibility.

### Deterministic ties and result volume

M rejects global folder-first and track-first grouping,
but does not select how two equally relevant titles from different
folders are ordered.
An existing library path order,
a basename order,
a locale-aware order and type-as-tie-break are distinct policies.
A stable order is required so results do not jump between repeated
queries;
its concrete comparator has not been selected.
No limit,
pagination or streaming behavior for a large library was chosen by
D60/D61.

## Verification boundary

The debug `SearchRankingFixture.kt` hands Compose fixed rows in a fixed
order;
it does **not** implement a matcher.
`SearchFixtureHighlights.kt` visibly colors every literal `cam` range,
but that visual helper is not a Unicode search grammar.
New comparisons should hold D59,
D60,
D61,
the actual left browser and complete deck constant while varying one
unresolved boundary at a time.
They must not turn illustrative captions into navigation or playback.

[word-review]: ../questions/word-boundary-review.html
