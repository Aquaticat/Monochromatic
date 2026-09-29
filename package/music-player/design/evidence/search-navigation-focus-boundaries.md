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

## Observed refocus limitation and Android Back boundary

`package/music-player/design/evidence/search-result-overflow.md` records
that one cover viewport candidate showed its final result above a measured
bottom keyboard after scrolling.
Hiding then refocusing that keyboard shrank the viewport;
the list offset did not need to jump to the top for the final row to
require another upward swipe.
D56 chose the cover-only keyboard-aware viewport,
**not** that extra swipe as desired behavior.
That is a bounded observation from the completed debug and settled-Gboard
studies,
not a claim about every input method,
posture or animation frame.
A scroll **anchor** and whether its row is **visible** are different
facts;
the logic prototype must represent both.
The desired same-query visibility guarantee still needs native
verification before any production implementation claims it works.
No new IME experiment is authorized without first explaining a compelling
need to the user.

Android SDK 37 `android/inputmethodservice/InputMethodService.java`
documents that its default `onKeyDown` intercepts `KEYCODE_BACK` while the
IME is shown and its default `onKeyUp` hides that IME UI.
The same source describes a conditional IME-owned
`BACK_DISPOSITION_ADJUST_NOTHING` path under which Back can instead reach
the app.
This is not evidence that our app can make one system Back exit Search
across arbitrary keyboards.
Treat keyboard-first system Back as an illustrative platform baseline,
not a user-selected cross-IME guarantee or a universal native claim.
The visible header Back action is a distinct design choice:
D47 promises a Back **path** from a separate destination,
not the first tap's exact outcome while typing.

## Independent decisions to expose

- **Entry edit focus:** immediate query focus/keyboard request versus
  waiting for explicit field focus.
  The accepted E2 code already names crease clearance;
  do not reuse it for passive entry.
- **Visible Back arrow:** return directly to player versus hide a shown
  keyboard first,
  keeping Search and its query.
  The decision is not fixed by Material's in-place bar-collapse guidance.
- **Clear:** erase query and stay in Search;
  independently keep the existing edit-focus/keyboard state or request
  focus and a keyboard.
  Compare while typing,
  after keyboard dismissal with edit focus retained,
  and after moving edit focus away.
- **Re-entry query:** open with a fresh empty query versus restore the
  previous query.
  If it is restored,
  **separately** choose top results versus the prior position.
  The temporary debug `onBack` reset is not a user decision.
- **Same-query refocus:** keep the intended row visible after the viewport
  shrinks,
  retain the raw list offset without visibility compensation (the
  observed final-row extra-swipe case),
  or reset to top.
  A middle row and final row must be distinguishable.
  Changing the query is a different event;
  a repeated identical query must not reset the position.

The Search result position is distinct from the visible left folder
browser's own location and scroll position.
The demonstration fixes a non-default browser context and playback deck
across Search entry/exit;
it does not prove native retention or define a return focus target.
The re-entry comparison concerns visits in one running session;
posture changes and process restoration are not modeled.
Result activation (#129),
empty/unavailable content (#128),
TalkBack traversal and announcements (#118),
and search-library selection (D62,
future implementation work) stay separate.
`package/music-player/design/questions/search-navigation-focus.prototype.html`
is an interactive **logic-only** walkthrough for these pending choices,
not a new Android/IME verification run or adoption of its defaults.

[m3-accessibility]: https://m3.material.io/components/search/accessibility
