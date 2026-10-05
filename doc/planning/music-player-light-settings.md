# Light Settings-pane continuation

## Purpose and settled input

Continue the authorized light-surface queue after the completed D26
scan-indicator publication.
This item carries D11's accepted Settings pane into the current Fold player
and its light/dark schemes.
D81's template editor remains a separate design problem.
No Settings-template ballot or production implementation is authorized.

D11 in `package/music-player/design/decisions.md` selects candidate
settings-a:
three flat switch rows and a closing sentence that says the pane is short.
D12 removed settings-b's analysis-status row;
Re-analyse lives on the track menu.
D21 added a fourth row for the command bar's global hotkey,
and D47 superseded that command bar together with its row.
Do not transfer the fourth row to this pane.

The accepted source is
`package/music-player/design/candidates/settings-a.dc.html`.
It is an 860 by 600px dark mock shaped like a desktop window.
Its top row is 56px high and holds an outlined `Back to Camellia` control and
a `Settings` label.
Each setting row has a 64px minimum height,
a 15px title,
a 13px supporting line and a 52 by 32px switch.
A 13px closing paragraph follows the rows.
The mock's 40px Back control is not authority to violate the current 48dp
layout floor,
and its window proportions are not Fold geometry under D49.

D11 records these rows and mock states:

- `Strip common prefixes from filenames`,
  on by default.
- `Resume where I left off`,
  on,
  restoring folder,
  track and position while paused.
- `Analyse true peak in the background`,
  off in the mock;
  off means each track is measured just before it plays.

## Initial executable-source audit

Android `MainActivity.kt:2635` declares `settingsPage`.
It renders a `Page controls` heading,
one radio option per page-control style and a `Back to library` button.
`showingSettings` at line 2140 opens it,
`BackHandler` at line 2148 returns on system Back,
and line 2220 swaps it with the track pager while the surrounding chrome
stays.
Desktop `app.slint:1786` renders the same page-control chooser.

A scoped search of Android production source,
desktop source and Slint UI found none of D11's three row labels.
That is a scoped absence finding,
not a platform-capability claim.
Production Settings is therefore a page-control experiment,
not D11's pane.
It contributes one structural precedent only:
Settings replaces the track region,
other chrome remains,
and system Back returns to the library.

## Constraints from later decisions

D49 makes the Fold's cover and inner panels the visual source for every
platform,
so the desktop mock's width does not govern this study.
D50 requires the playback/control deck to stay visible while the Fold is
unfolded.
D51 keeps the Search page and its header on the right of the unfolded panel,
leaves the same folder browser and the deck on the left,
and uses one full-width destination with the same header on the cover.
E2 keeps information off the fold connector,
approximately x `[983,1093)`px of the 2076px inner display.
D34,
D35 and D45 settle the light roles;
true black remains the dark background under standing standard 7.
The whole-map keyboard proposal lists `Ctrl ,` for Settings,
but that proposal is not adopted.

`package/music-player/design/md3-tokens.md` held switch values with a note
to re-check them if switches become prominent.
This pane makes them prominent,
so the re-check was done on 2026-10-05 against the current token files.
The 52 by 32px track and 24px selected handle of settings-a match.
Its unselected switch does not:
the mock draws a 24px handle with no track outline,
while the token file gives a 16px handle and a 2px outline.
The switch's 40px state layer is below the 48dp layout floor,
so the row or switch target must supply that floor.
Draw the study with the platform's Material 3 switch,
not a copy of the mock's off state.
The same re-check read 10px for the list item's top and bottom space,
where `md3-tokens.md` had recorded 12px;
that file now holds both readings and changes no drawn surface.

## Interactions the audit cannot settle

### Analysis preference model

D11's third row is a two-state switch.
D27's first-run prompt has four answers,
and two of them persist:
`Always scan` and `Dismiss forever`.
D27 says Re-analyse on the track menu is the only entry point after
`Dismiss forever`.
Neither decision says whether the Settings switch reflects or reverses a D27
answer.
The fit study can draw the row in both positions without settling this.
Raise it with the human only if a built state shows a concrete conflict.

### Title prefixes, templates and Search

The first row changes displayed titles.
D81 makes supporting text templated and states that title customization is
not implied.
The filename investigation recorded that D11's example does not settle
Search's extension display.
Draw the row as accepted;
do not extend it to Search or to templates.

### Template entry and the closing sentence

D81 puts template configuration in Settings,
while section 11e of `open-questions.md` leaves its fields,
grammar and editor controls undesigned.
The closing sentence was accepted before D81 and says the pane holds
everything.
Do not invent a template entry.
Record that the closing sentence depends on the 11e design round.

### Placement on the Fold

settings-a is a whole-window desktop page.
No accepted Fold placement exists.
D50,
D51 and the production precedent point one way:
on the inner panel,
Settings on the right under a Back and title header,
with the same folder browser and the deck retained on the left;
on the cover,
one full-width Settings destination with the same header.
That is the proposed placement to build,
not an accepted decision.
Under standing standards 2 and 3 it is a designer call made with built
evidence and a recommendation,
not a verbal question.

## Independently verifiable queue

- [x] Identify D11's selected pane,
  the later decisions that changed its content,
  and the production Settings boundary.
- [x] Re-check the MD3 switch and list-row values against the current
  specification source and record them in `md3-tokens.md`.
- [x] Build pure authored Settings state with checked toggle events,
  without persistence or production wiring.
- [x] Build an isolated native host using the accepted player and the
  proposed Fold placement.
- [ ] Measure light/dark fit on both panels at 100% and 200% text,
  including the long supporting lines and both switch positions.
  Preserve the 48dp layout floor.
- [ ] Exercise native switch toggles,
  the Back control and system Back.
  Verify the return to an unchanged player.
- [ ] Publish freshly inspected,
  sanitized and exact-artifact-bound evidence and verify its offline viewer.

## Isolated preparation and verification

Prototype `af793e436` adds an immutable three-switch record,
D11's row order and copy,
and one checked toggle event per row.
Scene `accepted` is D11's mock state;
scene `inverse` puts every switch in the other position.
The complete unit task passed with 12 Settings fixture tests.
Fresh unknown-scene,
copy-drift,
row-position-swap,
unknown-event and cross-row-toggle mutants each failed their intended test.
Exact restoration and a freshly executed complete unit task followed.

Prototype `1cf2f2cb3` adds the isolated native host.
Each row is the platform's Material 3 list item with a display-only switch;
the whole row is the two-state control,
so the row supplies the 48dp floor rather than the switch's 40dp state layer.
Both text lines may wrap.
The page header follows the accepted Search header:
a 48dp Back target and a one-line title in a 72dp bar.
The unfolded arrangement reuses the Search page's deck host and folder
browser on the left;
the cover page is full width.
Prototype `6bc622ff7` then makes each measured element report its unclipped
rectangle beside its visible one,
so a row scrolled partly out of view is not judged shorter than it is.
The complete unit task and APK build passed for that commit.
The current APK SHA-256 is
`40d0b0e4ab592e920372be8d4771fb9381e4e885501b54f575ac3db567a11f0d`;
the first host build,
`2faeddc682baf92aaf3d0bfcb4f5c53d4c1d29dc6d2803b2fe46e40513305ee1`,
was never installed.
The merged manifest disables the production activity and services,
removes WorkManager initialization and exports `SettingsPaneActivity`.
The player's own Settings button is not wired;
the study opens the page from an authored scene or an explicit debug event.

## First native visit and what inspection rejected

The first owned visit installed APK `40d0b0e4…` and captured both panels in
light and dark at 100% and 200% text.
Every measured rule passed:
72dp header,
48dp Back target,
52 by 32dp switches,
rows above the 48dp floor,
no text overflow and no information inside the fold connector.
At 200% text the column scrolls on both panels,
so each open state also has an end-of-column capture.

Fresh inspection of those captures then rejected the build for publication.
In the dark theme the header's Back glyph and title,
and the retained deck's title and transport buttons,
were drawn black on the dark page.
Nothing above them supplied a content colour;
the accepted Search page is hosted inside a filled region that does.
Each separator was also one pixel different across the fold connector,
because the opaque row fill began after the connector inset.
Measured rectangles could not show either defect.

Prototype `483f16cdd` puts the opened study in the same kind of filled region,
names the header's colour and makes the row fill transparent.
Its complete unit task and APK build passed.
The current APK SHA-256 is
`85e4a2080d1d737eb01a16bdcc5172bcc7103fe014770891d68d3cdf1854ca50`.
The first visit's captures are superseded and stay private;
they are not publication inputs.

## Visits on the fixed build

A second visit installed the fixed APK,
then failed before its first capture:
a 15 s bound on `podman inspect` expired under a host load near 50.
It restored every recorded field,
its owner exited `0`,
and it supplies no evidence.
That bound is now 120 s,
and a failed or timed-out inspection reads as unknown,
never as an absent runtime.

The third visit captured all 32 views:
both panels,
light and dark,
100% and 200% text,
the closed player,
both switch scenes and an end-of-column view wherever the column scrolls.
Every measured rule passed,
and the geometry matches the first build exactly.
The column scrolls only at 200% text:
787 physical pixels on the unfolded panel and 318 on the cover.

Fresh inspection of all 16 light/dark pairs found the dark header and deck
text legible and the separators uniform across the connector.
It also records four observations:
at 200% text on the unfolded panel `Resume where I left off` leaves `off`
alone on its second line;
at the start of a scrolling column the last visible line runs under the
gesture handle;
opening Settings narrows the left folder browser exactly as the Search page
does;
and the 24dp Back arrow reads small beside the 200% title.

The viewer builder now re-measures three things from the embedded images:
header text contrast,
drawn switch positions,
and the retained left half against the published Search images.
Run on the first build's crops,
those rules reject it by name:
the left half first,
then the dark title and Back arrow once that rule is removed.

## Boundaries and next action

Use only authored switch state.
No preference is persisted,
no prefix stripping or session restore is implemented,
and no analysis runs.
No new IME,
TalkBack or keyboard-default experiment belongs to this item.

Native work retains the owned Fold runtime's 6 GiB/2 CPU cap;
browser verification retains 2 GiB/2 CPU.
Original AVDs remain untouched.
Every visit records original settings before mutation,
restores those exact fields and verifies owner shutdown and runtime absence.

The next action is the second owned native visit on APK `85e4a208…`:
capture and measure both panels,
themes and text scales,
exercise the switches and both Back paths,
then inspect every capture afresh before any publication.
