# Search navigation and focus boundaries before interaction choices

## Selected surfaces and distinct focus meanings

D47 gives the player a Search button that opens a separate destination
with a Back path.
D48 puts Back,
query and Clear in one header.
D51 keeps actual folder browsing and the complete playback deck on the
left of the unfolded Fold,
with query/results on the right;
its cover Search is full-width.
D52 starts positive results directly beneath the header.
D56 keeps the cover result viewport scrollable above an ordinary bottom
keyboard while its header remains fixed.
The currently selected D/M results and D59 match highlights appear in
`package/music-player/design/questions/current.html`.
None of those visual decisions says whether **text edit focus** is
requested when Search opens,
or what a second system Back does after the keyboard has hidden.
Screen-reader initial accessibility focus is a separate #118 concern and
must not be inferred from keyboard/edit focus.

The archived Material 3 Search guidance indexed in
`package/music-player/design/evidence/search-result-behavior-boundaries.md`
says a focused search bar's Back icon releases focus and returns the bar
to its original state;
they also keep submitted result-query text visible but unfocused.
That is about an expanding **search bar**, not D47's separate Search
page;
its Back transition cannot be copied as a rule that the selected
page merely collapses a field.
The [Material Search accessibility guidance][m3-accessibility]
says assistive-technology initial focus may land on a leading icon or
text field and must announce changes in suggestions/results.
It does not choose initial **edit** focus for this separate destination.
The archived guidelines were inspected through the local copy indexed in
`package/music-player/design/material-3-compliance.md`;
no Material Search component is a production dependency here.

## What the debug host does, not what was selected

In the **prototype branch** `prototype/music-player-theme-compose`
(commit `cc66a0dcf`,
not production files in the main worktree),
the debug-only inner
`package/music-player/android-app/app/src/debug/kotlin/dev/monochromatic/musicplayer/SearchPersistentDeckStudy.kt`
and folded-cover delegate
`package/music-player/android-app/app/src/debug/kotlin/dev/monochromatic/musicplayer/SearchLayoutStudy.kt`
each initialize temporary `opened` and `query` state from a candidate
marker.
Both set `opened = false` and `query = ""` in an `onBack` callback,
register `BackHandler(enabled = opened)` and reopen from the player with
an empty query.
Both headers' Clear action invokes `onQueryChange("")` without closing
the page.
They use a `BasicTextField` but do not explicitly request text focus
on opening Search.
The inner and cover result regions call `rememberScrollState()` in their
composable view;
that is an in-memory fixture detail,
not accepted scroll-restoration semantics across edits or visits.
These observations come from debug source on
`prototype/music-player-theme-compose`,
not a production Search implementation or a live user-boundary flow.

## Observed refocus limitation

`package/music-player/design/evidence/search-result-overflow.md` records
that one cover viewport candidate showed its last result above a measured
bottom keyboard after scrolling.
Hiding then refocusing that keyboard shrank the viewport and required
another upward swipe to restore the last row's visibility.
D56 chose the cover-only keyboard-aware viewport,
**not** that extra swipe as a desired interaction.
This is a bounded observation from the already completed debug and
settled-Gboard studies,
not a claim about every input method,
posture or animation frame.
No new IME experiment is authorized without first explaining a compelling
need to the user.

## Independent decisions to expose

- **Entry edit focus:** ask whether opening Search immediately requests
  query edit focus and the keyboard,
  or opens with an unfocused empty query until the user selects it.
  One path is quicker for typing;
  the other initially preserves more visible content.
- **Visible Back versus system Back:** the header Back path returns to the
  player under D47/D48.
  With the keyboard already visible,
  a separate preference can decide whether system Back first hides that
  keyboard and leaves Search open or returns to the player immediately.
  Do not present Material's in-place bar-collapse behavior as the page's
  Back action.
- **Clear:** the `×` action should remove query text while keeping the
  Search destination.
  Whether it preserves the prior edit-focus/keyboard state or forces a
  new focus request is distinct from page navigation.
- **Re-entry:** reopening Search may begin with an empty query,
  or restore the previous query and result position.
  The temporary debug `onBack` reset is not a user decision.
- **Result position:** changing the query produces a different result set;
  hiding/refocusing a keyboard with the **same** query need not reset
  the user's position.
  These events should not be treated as one scroll-reset policy.
  The observed extra swipe is evidence to compare against a proposed
  preserved anchor,
  not evidence that one is selected.

Result activation (#129),
empty/unavailable content (#128),
TalkBack traversal and announcements (#118),
and search-library selection (D62,
future implementation work) stay separate.
Any HTML state walkthrough would be a **logic-only** design aid,
not a new Android or IME verification run.

[m3-accessibility]: https://m3.material.io/components/search/accessibility
