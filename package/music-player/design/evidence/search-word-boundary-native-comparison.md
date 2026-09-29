# Word-start versus middle-of-word Search on the disposable Fold

## Question and fixed controls

D60 searches each folder's own name and each track's final filename
component;
parent and ancestor names cannot generate track hits.
D61 mixes folder and track results by relevance,
with exact `Cam` before prefix `Camellia`.
The user's `cam`/`Cam` instruction and selected fixture also require
`Live at Camellia`,
where `Cam` begins a later word.
D59 keeps matching letters bold on an OS-accent fill adjusted in OKLCH.
The only unresolved dimension here is whether query `cam` should also
find a directly named track with those letters **inside one uninterrupted
word**:
`Scamper` and `Dreamcam`.
This comparison is not a scorer,
parser,
Search index or result action.

The debug-only `SearchRankingFixture.kt` on prototype commit `72da1d925`
returns three settled controls in both variants:
`Cam` track,
`Camellia` folder and `Live at Camellia` track,
in that mixed order.
The anywhere variant appends `Scamper` and `Dreamcam` tracks;
the word-start variant omits them.
All five titles are direct names,
not matches inherited from `Cult of Luna` or another parent.
`SearchPersistentDeckStudy.kt` renders the inner list,
then delegates folded-cover rendering to `SearchLayoutStudy.kt`.
The result rows have no click handler;
“exact filename”,
“later word” and “middle of word” are illustrative captions.

## Native evidence and after-state checks

The disposable `Fold_No_Hardware_Probe` had a 2076 × 2152 inner panel,
1080 × 2424 cover,
390dpi and 200% text.
The installed debug APK and local build both had SHA-256
`5a484da7ad8f46db12d53cc5b84f2f9239f4e9a769486fe3e1804e9d6b46c351`.
Only keyboard-closed light-scheme captures were made:

- [Word start, inner][inner-word] retains the browser and complete deck
  with the three accepted direct-name rows.
- [Anywhere, inner][inner-any] retains that same browser/deck and app
  header,
  then appends the two interior-name rows with `cam` highlighted
  inside the title.
- [Word start, cover][cover-word] retains one full-width Search page
  without the interior rows.
- [Anywhere, cover][cover-any] shows the extra highlighted tracks after
  the accepted rows.

Private UI Automator hierarchies on both panels placed the exact `Cam`
first,
`Camellia` second and `Live at Camellia` third.
Only the anywhere variant then showed `Scamper` and `Dreamcam`;
neither variant showed the rejected parent-only `Another Xronixle`
Search hit.
Result titles shared the query start x `1249` inner or x `156`
cover.
The last supporting line was fully visible without a swipe on the
observed 200% keyboard-closed panels.
A same-panel native PNG difference check found zero difference over the
inner left browser/deck and over the cover header,
while right-side result areas changed (means `0.0111488` inner and
`0.0107152` cover).
That positive control detects a real membership difference,
not a relabeled identical frame.

The sanitizer replaced the entire status region with the same panel's
generic reference,
verified exact app pixels underneath,
and removed PNG metadata.
Raw status-bearing screenshots,
XML and installed-path details stayed private.
The host-JVM debug-variant tests passed for stable D/M controls,
interior-only membership and highlight offsets `Scamper[1,4)` and
`Dreamcam[5,8)`.
Those tests do not implement a production Unicode word parser.
The source assets and instructions are embedded in the
[separate review form][review].
The selected-only `questions/current.html` continues to show D/M with
no mid-word answer assumed.

## Unselected options and separate questions

- **W, word start only:** pros:
  retains every accepted example without the two incidental interior
  rows;
  cons:
  a user recalling only part of an uninterrupted name cannot find it.
- **A, substring anywhere:** pros:
  finds `Scamper` and `Dreamcam` from `cam`;
  cons:
  can add incidental matches in a large library.
  Real-library volume was not measured.

Personal ranking:
**W > A** because accepted word-start results remain discoverable with
less risk of extra matches,
while A buys interior-fragment recall at that cost.
No W/A choice is recorded yet.
Whitespace,
hyphens,
apostrophes,
extensions,
Unicode equivalence,
multiple query terms and deterministic tie-breaks are **separate**
open decisions.
No production Search or new IME experiment was authorized.

[inner-word]: ../questions/render/search-word-boundary-review-inner-rankword-s200.png
[inner-any]: ../questions/render/search-word-boundary-review-inner-rankany-s200.png
[cover-word]: ../questions/render/search-word-boundary-review-cover-rankword-s200.png
[cover-any]: ../questions/render/search-word-boundary-review-cover-rankany-s200.png
[review]: ../questions/word-boundary-review.html
