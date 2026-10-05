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
- [ ] Build pure authored Settings state and an isolated native host using
  the accepted player and the proposed Fold placement,
  without persistence or production wiring.
- [ ] Measure light/dark fit on both panels at 100% and 200% text,
  including the long supporting lines and both switch positions.
  Preserve the 48dp layout floor.
- [ ] Exercise native switch toggles,
  the Back control and system Back.
  Verify the return to an unchanged player.
- [ ] Publish freshly inspected,
  sanitized and exact-artifact-bound evidence and verify its offline viewer.

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

The next action is the authored state fixture and isolated native host.
