# Search result activation boundaries before selecting tap effects

## What the rows currently mean

D47 gives Search a separate destination.
D48 keeps Back,
query and Clear together;
D51 retains the actual browser and complete deck beside unfolded Search.
D52 removes a redundant positive-results heading.
D58/D59 align and highlight results,
D60 limits membership to direct folder/track names,
and D61 mixes result kinds by illustrative relevance.
D63 to D68 settle entry focus,
visible Back,
Clear,
re-entry and same-query row visibility.
D69 to D71 separate unqueried,
completed-no-match and known unavailable statuses.
None of those decisions makes a result row actionable.
The present `questions/current.html` screenshots are static fixture states;
result captions are **not** adopted tap promises.

The debug-only
`package/music-player/android-app/app/src/debug/kotlin/dev/monochromatic/musicplayer/SearchPersistentDeckStudy.kt`
on `prototype/music-player-theme-compose` renders unclickable result lines.
An earlier two-row `cam` fixture displayed `Another Xronixle` through its
parent name;
D60 later excluded that parent-only track result.
The corrected D/M fixture instead shows directly named `Cam` and
`Camellia` results in mixed order,
but it still has no result click handler.
Its visible current deck track `Another Xronixle` is not a selected
`cam` hit.
No native screenshot or hierarchy proves a folder tap,
track tap,
queue effect or focus transition.
The installed corrected fixture APK had SHA-256
`1caee7060acfb5bbcd9a02142b4c9bada6b5886517157d25fef4a48b9b1e9c05`;
its static Search-status captures likewise do not test result activation.

## Existing player actions are precedents, not Search decisions

`package/music-player/android-app/app/src/main/kotlin/dev/monochromatic/musicplayer/PlayerController.kt`
implements `selectPage(page)` by updating the selected page,
its visible items and queue page scope,
without loading a replacement track or immediately changing playback.
`playIndex(index)` instead moves the queue cursor and starts that track.
`package/music-player/android-app/app/src/main/kotlin/dev/monochromatic/musicplayer/MainActivity.kt`
routes an already-current player-list row tap to `togglePlay()` and
another player-list track row to `playIndex(item.index)`.
This is measured source behavior for the existing list,
not a settled Search-row action.
If Search opens a different folder,
the queue scope could change even while the current audio keeps playing;
“opens folder” must not be described as “plays folder.”
Conversely,
playing a track may change queue scope even if its browser folder is not
visibly selected yet;
verify actual state synchronization before asserting what appears in the
left browser after a cross-folder Search hit.

D51's left browser remains visible on the inner panel,
but the cover Search occupies the full width.
A folder result updating the left browser **without closing Search** would
therefore have no simultaneous counterpart on the cover.
Returning to the player and selecting the folder would work consistently
across panels,
at the cost of leaving the Search result list.
D66 already says opening a new Search visit starts with an empty query;
that rule alone does not choose whether activation ends the current visit.
The visible Back arrow is a separate explicit exit (D64).

## Separable activation questions

- **Folder result:** should one tap return to player with its folder
  selected (no autoplay),
  or update the retained unfolded browser and keep Search open?
  If behavior varies by panel,
  state the cover effect and why a user would tolerate different outcomes.
- **Other track result:** should one tap start that track immediately,
  or reveal its row in its folder and require a later playback action?
  Do not call “reveal” playback or promise a track restarts without
  testing the chosen implementation.
- **Already-current track result:** should tapping its Search row toggle
  play/pause like the existing player row,
  merely reveal it,
  or leave playback unchanged?
  A direct `playIndex(current)` call could restart the playhead rather than
  act like the current-row toggle;
  never claim equivalence without a real call.
- **Destination after a result action:** close Search,
  keep it open with the query/results in the right pane,
  or use a panel-specific return.
  This is independent of whether folder selection or track playback
  happened.
- **Unavailable/stale result:** a target may disappear after a static
  result is displayed.
  Do not silently choose another folder or track,
  claim playback started,
  or turn an activation failure into a no-match diagnosis.
  The actual error and recovery owner need implementation-boundary
  verification.

A visual/logic comparison must start from selected A with its real left
browser and full deck,
not the obsolete blank-left or two-row parent-only `cam` fixture.
If a prototype simulates activation,
label all queue,
player and focus outcomes as a model,
not as Android behavior.
Native TalkBack traversal and announcements remain the separate Search
accessibility review;
no further IME study is authorized without first making a compelling case
to the user.
