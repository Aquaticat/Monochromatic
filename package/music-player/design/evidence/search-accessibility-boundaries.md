# Search accessibility boundaries before traversal choices

## Settled behavior that accessibility must express

D39 orders the **ordinary unfolded player** by the folder area,
then playback deck,
then track pane.
D40 announces the current track through structured state speech while
keeping the visible row's child semantics;
it does not hard-code a duplicated title in a synthetic accessibility
label.
Search A (D47/D51) is a separate destination in the right pane with
the actual folder browser and deck retained on the left.
The cover Search fills one screen.
D48 fixes the one Back/query/Clear header;
D59 marks matches visually;
D60/D61 distinguish directly named folder and track results and mixed
priority.
D63 requests **edit focus** and a keyboard on Search entry;
that is not proof of initial **accessibility focus**.
D64 to D74 define Back,
Clear,
re-entry,
status truth and successful folder/track activation,
but none proves TalkBack focus,
speech or physical input behavior.
No Search result tap handler exists in the debug-only study or in
production.

The previously verified ordinary-player TalkBack transcript at
`package/music-player/design/questions/evidence/a11y-browse-focus-100.json`
starts with “Folders” and “Open. Button” and reaches the deck's current
track state announcement at recorded step `45`.
That demonstrates the player D39 path;
it does **not** show what happens when a separate Search destination opens.
Reusing the entire folder-first traversal before the Search field could
make the just-opened destination hard to reach by sequential exploration.
The design may retain D39's local browser/deck order while giving Search's
header/results a task-appropriate entry point,
but actual TalkBack traversal must be measured before describing it as
working.

## Primary guidance and its limits

The archived [Material Search accessibility guidance][m3-search-access]
says assistive-technology users can find the input,
enter text,
clear it and interact with a result list.
It says initial accessibility focus often lands on the leading icon
button **or** the text field and asks that changes in suggestions/results
be announced.
It does not mandate which of those initial targets this separate Search
page must choose.
The archived [Material list accessibility guidance][m3-list-access]
uses the visible title and supporting text as list-item labels,
and distinguishes keyboard navigation through a single-action list from
multi-action rows.
Search has one principal action per folder/track row under D72/D73;
a decorative icon should not become an unrelated focus stop.
The archived [icon-button guidance][m3-icon-access] calls for action
labels and at least a 48dp target.
These sources do not certify the app's Compose semantics or exact
TalkBack utterances.

The debug-only
`package/music-player/android-app/app/src/debug/kotlin/dev/monochromatic/musicplayer/SearchPersistentDeckStudy.kt`
uses a `BasicTextField` with “Search music” content description and
48dp Back/Clear icon buttons.
Its `PersistentResultLine` has no `clickable` action and renders title
and supporting context as separate text nodes.
The icon has no content description,
which is appropriate for a decorative repeated type icon,
but a static result cannot be assumed to be a single focusable actionable
item or to announce the chosen D72 to D74 behavior.
A UI hierarchy can show names/roles/bounds;
it does not capture TalkBack's spoken sentence.
`doc/troubleshooting/android-emulator-37-talkback-speech-capture.md`
records that actual swipe traversal required the emulator's loopback
gRPC touch controller and TalkBack's speech overlay on the earlier
player study.
Browser axe results from the design forms are evidence about those HTML
forms only,
not Android TalkBack.

## Consequences requiring a design and later native verification

- **Search entry:** orient the user to the just-opened destination without
  losing the Back path or forcing traversal through the full left browser
  first.
  Edit focus,
  TalkBack focus and hardware keyboard focus are separate.
- **Result rows:** expose a single action target with folder/track type,
  own name,
  disambiguating parent context and the real action (“open folder”,
  “play track”,
  or current-track play/pause),
  without duplicate title speech or an icon-only cue.
  Visible D59 bold/accent highlights need not be read out as a separate
  colored fragment.
  The app must not announce a parent-only track as a Search result (D60).
- **Dynamic statuses:** when a current-query result list or confirmed
  no-match/unavailable state changes,
  announce the meaningful change without claiming completed coverage
  during a partial read or stealing text edit focus on each key.
  Do not announce a fabricated hit count or an unsupported recovery path.
- **Navigation:** explicit Back returns to player;
  successful folder/track result activation also returns to player.
  Return focus should land on meaningful, still-present player context,
  not a disposed Search result.
  A current-track action needs structured play/pause state speech under
  D40's principle;
  exact target and spoken sequence remain unverified.
- **Reflow and targets:** readable text at the measured 100%/200% scales,
  an actual 48dp minimum action target and a focus indicator cannot be
  proven by keyboard-closed screenshots or a debug result row without
  handlers.
  D56/D57's visual keyboard bounds do not waive accessibility reach.

A disposable Fold TalkBack study may inspect **accessibility traversal only**
under a 6 GiB/2 CPU cap,
without typing,
activating the query field or running an IME experiment.
If an input method appears unexpectedly,
stop that study rather than measuring or changing the IME.
The original AVD remains out of scope.
Current raw speech-overlay screenshots must stay private until all status
content and metadata are sanitized.
No production Search code,
fuzzy-library evaluation or `AGENTS.md` edit is authorized.

[m3-search-access]: https://m3.material.io/components/search/accessibility
[m3-list-access]: https://m3.material.io/components/lists/accessibility
[m3-icon-access]: https://m3.material.io/components/icon-buttons/accessibility
