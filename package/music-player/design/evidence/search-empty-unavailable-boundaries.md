# Search empty and unavailable state boundaries before selection

## Existing decisions and visible sources

D47/D48 give Search a separate destination and one Back/query/Clear header.
D51 retains the actual folder browser and complete playback deck on the
left of the unfolded Fold.
D52 removes a **positive-results** heading that merely repeats the query;
it does not settle no-match copy.
D60 limits visible hits to direct folder/track names;
D63 requests query edit focus and a keyboard when Search opens;
D65 keeps the current edit-focus/keyboard state after Clear;
D66 starts each new Search visit with an empty query.
D10's player first-run empty view applies when no system library exists or
the user declined access;
it is not automatically the Search no-match view.

The selected-A keyboard-closed
`package/music-player/design/questions/render/search-selected-review-inner-empty-light-s100.png`
shows “Search your music” and “Type a name to explore your library” in
the right pane,
with the real left browser and complete deck retained.
It is a debug fixture,
not native proof of D63's newer focus/keyboard request.
The earlier
`package/music-player/design/questions/render/fold-search-inner-open-none-light-s100.png`
and
`package/music-player/design/questions/render/fold-search-inner-open-unavailable-dark-s100.png`
show “No results for ‘zzq’” and “Library unavailable” in an
**obsolete blank-left** layout.
They preserve historical wording evidence,
not valid selected-A comparisons.
The debug-only
`package/music-player/android-app/app/src/debug/kotlin/dev/monochromatic/musicplayer/SearchPersistentDeckStudy.kt`
on branch `prototype/music-player-theme-compose` (commit `cc66a0dcf`)
sets a fixed
`zzq` query for a `-none` marker;
`-unavailable` overrides results even with an empty query.
The current fixture's unavailable detail says “Search returns when the
library is available” and provides no recovery control.
No real search algorithm,
permission recovery or result activation is implemented by these fixtures.

## Distinct evidence states

- **Empty query, library usable:** no lookup needs to have failed.
  A prompt can explain Search's folder/track scope rather than claim “no
  results.”
  D63's intended keyboard-open entry means a keyboard-closed old screenshot
  cannot certify final fit.
- **Nonempty query, zero direct-name hits:** the library was searched and
  yielded no matching folder/track names.
  Keep the query and Clear accessible;
  do not call the whole library empty or missing.
- **Usable but empty library:** no tracks/folders to search;
  this is not evidence that permission is absent or an error occurred.
  D10's player-level empty treatment and Search's right-pane message may
  need different affordances without duplicating them.
- **Known access or source failure:** only a genuinely known cause can
  justify “unavailable” and a matching recovery action.
  This state can take precedence over either empty query or no-match
  messages;
  avoid telling the user to try another name when no source is readable.
- **Loading or analysis in progress:** not a failed query or an inaccessible
  library.
  D27 allows playback before analysis;
  do not show “library unavailable” merely because analysis is pending.

`package/music-player/android-app/app/src/main/kotlin/dev/monochromatic/musicplayer/LibrarySource.kt`
currently chooses a held folder,
then device-wide audio permission,
then an empty list.
It also turns a failed whole-folder scan into an empty list after logging.
`package/music-player/android-app/app/src/main/kotlin/dev/monochromatic/musicplayer/MainActivity.kt`
gates the current player behind audio permission.
An empty returned list therefore cannot distinguish an intentionally
empty folder,
no permission and some scan failures,
and the current gate does not demonstrate that Search can be opened while
permission is absent.
A designed unavailable state must be conditional on actual source status
available to the eventual implementation;
static text must not pretend that a missing status already exists.
This is an evidence constraint,
not authorization to change the production library seam now.

## Review frontier

Compare copy,
state priority,
location within selected A,
and any recovery control for a known cause.
Do not replace the left folder browser/deck with the obsolete blank-left
fixture,
introduce a positive-results heading,
reopen matcher-library selection,
or settle result-row actions or TalkBack behavior.
Any Android screen comparison requires captures from the disposable Fold
at physical panel pixels,
with the same selected A/E2 context and status-strip sanitization.
No new IME experiment is authorized without first making a compelling
case to the user.
The repo's bare `#127` to `#129` and `#118` Markdown references are
**internal review-task numbers**;
GitHub currently has unrelated issues at those numbers,
so future design prose should name the review area or say “review task”
instead of generating misleading issue links.
