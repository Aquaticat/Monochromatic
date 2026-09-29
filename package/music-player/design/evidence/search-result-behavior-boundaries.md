# Search result behavior boundaries before an action decision

## Settled composition, unresolved effects

D47 opens a separate Search page.
D48 gives it one Back/query/Clear header.
D51 keeps query and results on the right of the unfolded Fold with the
same browser and playback deck on the left;
D52 starts positive matches immediately under the header.
D56 keeps the folded-cover results list scrollable above ordinary bottom
keyboards,
and D57 permits only the measured real floating-Gboard overlap with
some inner result lettering.
E2's selected physical floor applies only to meaning-bearing marks.
D58 aligns Back/result icons and query/result titles in the debug-only
keyboard-closed native study at 100% and 200% on both Fold panels;
see `search-header-result-alignment.md`.
None of these choices specifies result ranking or what tapping a result does.
`package/music-player/design/decisions.md` records those bounds.

The debug-only
`package/music-player/android-app/app/src/debug/kotlin/dev/monochromatic/musicplayer/SearchPersistentDeckStudy.kt`
on branch `prototype/music-player-theme-compose` renders a folder result
`Camellia` with detail `Folder · opens this folder` and a track
`Another Xronixle` with detail `Track · Camellia · reveals track` for
query `cam`.
`PersistentResultLine` has no click handler;
the app under review has no production Search index or result activation.
The track title itself does **not** contain `cam`:
its appearance in the fixture might illustrate a parent-folder match,
not a decided rule that every matching folder expands into all its tracks.
The longer overflow fixture repeats synthetic folder rows to test viewport
scrolling,
not a ranking algorithm.
A separate debug-only `SearchRankingFixture.kt` now lists fixed result
identities in multiple hand-authored orders for the #116 review.
Those rows are not produced by a search index:
their exact/prefix/contained and parent-only captions describe
illustrative categories,
not exercised matching rules or selected tap effects.
The installed fixture APK SHA-256 is
`bf9a51c42facfca969e275d5fe55769656c451900f57689dc7c24190e8d6d2ef`.
These source fixtures cannot prove actions,
search scope,
matching algorithms,
or production sorting.

## Incumbent library behavior

`package/music-player/android-app/app/src/main/kotlin/dev/monochromatic/musicplayer/PlayerController.kt`
has distinct boundaries:
`selectPage(page)` changes the displayed page **and queue page scope**
without moving the current track or immediately loading/playing another;
that scope can affect future transport.
`playIndex(index)` selects and starts a track.
`MainActivity.kt` routes a tap on the already-current track row to
`togglePlay()` and a tap on another track row to `playIndex(item.index)`.
That is a **player-list** interaction,
not an accepted Search-result tap rule.
A Search track could reveal its row before a deliberate playback tap,
start another track directly,
or toggle the already-current track;
those effects must be named separately.
A folder match could close Search and select a page,
or update the retained browser while Search remains open.
Either may affect queue scope without immediately forcing a new track.

The filesystem is the library:
folder paths and filenames are the available names,
with no tag database.
The product targets large local libraries and non-Latin folder names
(`package/music-player/design/HANDOFF.md` and D30).
A result ordering should remain deterministic and show enough parent
context to disambiguate duplicate filenames.
Whether matches in a folder name should cause every child track to appear
is a separate indexing policy:
do not infer it from the two-row `cam` fixture.

## External design evidence and its boundary

The Material Search guidance indexed by
`package/music-player/design/material-3-compliance.md` says
suggestions/results may appear while typing or after submission,
results form a list under the header,
and selecting a suggestion/result is an available action.
Its Back behavior concerns a focused search bar returning to its original
state;
D47 instead chooses a **separate destination**.
The Fold emulator precedent study
`package/music-player/design/evidence/fold-search-emulator-precedents.md`
shows Messages,
Files and Maps keeping query/results together but does not establish a
folder-versus-track ranking or a music-player activation effect.
Neither source settles the local-file product behavior.

## Decisions to show rather than assume

- Searched fields:
  folder names,
  track filenames,
  and optional parent-folder/path names on track results.
  Returning every child of a matching folder could dominate a large result
  list;
  this has not been measured in a real library fixture.
- Matching rules:
  exact,
  prefix and substring matches are separate from which field matches.
- Ordering:
  folder-versus-track grouping,
  relevance across types,
  and deterministic tie-breaking are separable policies.
  Type labels and parent context must remain readable in each rendering.
- Folder action:
  close Search and select its folder page,
  or update the retained upper-left browser while Search remains open.
  Selecting a page changes queue scope without immediately starting a track.
- Track action:
  reveal the target in its folder without an immediate play command,
  start another track,
  or toggle an already-current track.
  These are alternative behaviors,
  not two descriptions of one tap.
- Keyboard focus,
  Back/Clear,
  refocus after keyboard dismissal and TalkBack are tracked separately.
  No further IME experiments are authorized without first making a
  compelling case to the user.

No ranking,
indexing scope or result-tap effect is adopted by this evidence note.
No production Search code was changed.
