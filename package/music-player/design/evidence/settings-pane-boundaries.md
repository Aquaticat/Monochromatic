# Native Settings-pane verification boundary

## Purpose and accepted pane

This design-only study carries D11's accepted Settings pane into the current
Fold player and its light/dark schemes.
It does not reopen Search,
the D27 first-run answers,
or D81's template editor,
whose fields and controls remain undesigned (section 11e of
`open-questions.md`).

D11 selects `candidates/settings-a.dc.html`:
three flat switch rows and a closing sentence saying the pane is short.
D12 removed settings-b's analysis-status row,
and D47 superseded the command bar together with D21's fourth row,
so the study draws exactly three rows:
`Strip common prefixes from filenames`,
`Resume where I left off` and `Analyse true peak in the background`.
Scene `accepted` is the mock's state:
the first two switches on and the third off.
Scene `inverse` puts every switch in its other position.

The mock is an 860 by 600px desktop window.
D49 makes the Fold panels the layout source,
so its proportions do not govern this study,
and its 40px Back control does not override the 48dp layout floor.
Each row is the platform's Material 3 list item with a 52 by 32dp switch;
the whole row is the two-state control,
so the row supplies the 48dp target rather than the switch's 40dp state layer.
The unselected switch is the platform's,
with a 16dp handle and an outline,
not the mock's unoutlined 24dp handle;
`md3-tokens.md` records that re-check.

## Adopted Fold placement

No accepted decision placed Settings on the Fold.
D50 keeps the deck visible while unfolded,
D51 puts the Search page on the right half with the same folder browser and
deck kept on the left,
and production Settings already replaces the track region while other
chrome stays.
The study follows those:
on the inner panel Settings takes the right half under a 72dp header with a
48dp Back target and the page title,
and on the cover it is one full-width page with the same header.
This placement was adopted from those decisions,
not separately chosen;
the viewer says how to object to it.

## Isolated artifact and input owner

The current source is prototype commit
`483f16cdd4c0bda6269ae2e4666732db6407ce75`,
with APK SHA-256
`85e4a2080d1d737eb01a16bdcc5172bcc7103fe014770891d68d3cdf1854ca50`.
`SettingsPaneActivity` extends `ComponentActivity`,
not the production activity.
Its merged manifest disables production activity/services and removes
WorkManager auto-initialization.
The player's own Settings button is not wired;
the page opens from an authored scene or one explicit debug event.

Prototype `af793e436` adds the immutable three-switch record,
D11's row order and copy and one checked toggle per row.
Its 12 pure fixture tests passed,
and fresh unknown-scene,
copy-drift,
row-position-swap,
unknown-event and cross-row-toggle mutants each failed their intended test
before exact restoration.

## Superseded first build

The first owned visit captured APK
`40d0b0e4ab592e920372be8d4771fb9381e4e885501b54f575ac3db567a11f0d`
and passed every measured rule and input check.
Fresh inspection then rejected it.
In dark,
the header's Back glyph and title,
and the retained deck's title and transport buttons,
drew black on the dark page:
nothing above them supplied a content colour,
while the accepted Search page is hosted inside a region that does.
Each separator was also a pixel different across the fold connector,
because the opaque row fill began after the connector inset.
Measured rectangles could not show either defect.
The current build fixes all three;
the first build's captures stay private and are not publication inputs.

A second visit on the current build failed before its first capture,
when a 15 s bound on `podman inspect` expired under host load.
It restored every recorded field,
its owner exited `0`,
and it supplies no evidence.

## Native fit

The third visit captured 32 views:
both panels,
light and dark,
100% and 200% text,
the closed player,
both switch scenes,
and an end-of-column view of each scene wherever the column scrolls,
eight in all.
At the measured 390dpi density the header is 176px high,
the Back target 117 by 117px and every switch 127 by 78px.
Rows are 216 to 265px high at 100% text and 435 to 720px at 200%,
all above the 117px floor.
No row title,
supporting line,
page title or closing sentence reports overflow.
On the inner panel no title,
supporting line,
switch or closing sentence starts inside the fold connector.
Neither a switch position nor the theme changes any measured rectangle.

At 100% text the whole column,
closing sentence included,
fits on both panels.
At 200% it scrolls by 787px on the inner panel and 318px on the cover,
and the closing sentence is not wholly shown until the column is scrolled.
Rectangles are device layout reports,
not glyph bounds or accessibility acceptance.

## Native input

Inputs passed in all eight panel,
theme and text-scale environments.
A touch on each row toggled it once and a second touch toggled it back.
Each toggle changed pixels only inside its own row,
redrew its switch,
and left every rectangle unchanged;
toggling back restored the app pixels exactly.
At 200% text on the inner panel the third row was reached by scrolling to
the column end first.
The Back target closed the page once,
and the closed player matched a freshly launched closed player in geometry and
app pixels.
One authored reopen restored the opened page exactly,
then system Back closed it once and the closed player matched again.
The host was created once across all of those inputs,
and a per-step event ledger matched every capture.
Changed-pixel,
changed-geometry and changed-count controls were rejected.

Opening Settings changes about 79,000 of 2,011,644 left-half pixels at 100%
text and about 70,000 at 200%:
the folder browser reflows narrower,
as it does for the Search page.
The live input matrix was recomputed offline from its 90 retained captures,
and every field of its manifest was reproduced.

## Fresh inspection

All 16 light/dark full-region pairs were inspected on 2026-10-05,
after every crop was re-derived from its private raw capture with a
changed-byte control.
An enlarged detail confirmed that each separator has the same colour inside
the fold connector as beyond it.
In dark the header and deck text are drawn in the theme's light text colour,
as on the accepted Search page.

Four observations are recorded for the human,
not turned into a ballot:
at 200% text on the inner panel `Resume where I left off` leaves `off`
alone on its second line;
at the start of a scrolling column the last visible line runs under the
gesture handle;
opening Settings narrows the left folder browser;
and the 24dp Back arrow reads small beside the 200% title.

## Verification limits

Every switch position is authored debug state.
No preference is stored,
no filename prefix is stripped,
no session is restored and no analysis runs.
Whether the third row reflects a D27 first-run answer,
and whether the closing sentence survives D81's template entry,
stay with the 11e design round.
No new IME,
TalkBack or keyboard-default experiment is included.

Full Android lint is not passing.
Its five inherited errors are three `MissingSuperCall` and two `NewApi`
findings in unchanged files;
65 warnings and two hints remain,
and no finding names a Settings study file.
The measured adapter was LLVM 20.1.2 llvmpipe software rendering despite the
requested host GPU path;
startup reported that the GPU cannot be used for hardware rendering.

## Privacy and restoration

Raw screenshots,
Android hierarchies,
logs and generated identities remain private.
Published crops start at the measured application root,
keep exact RGB,
are opaque 8-bit PNGs with essential chunks only,
and show only authored labels and the anonymous gesture handle.

Only the freshly recorded fields were restored and read back:
font scale,
night mode,
device state,
accessibility state and services,
display geometry and the system image fingerprint.
The second readback matched every field.
The owner's exit status `0` was recorded by its own parent process,
and no matching container or emulator process remained.
Original AVDs and library data remain untouched.

## Publication and consumer verification

[The witness manifest](../questions/evidence/settings-pane-witnesses.json)
and its 32 PNGs carry each view's measured rectangles,
visible parts and line counts.
[The native verification record](../questions/evidence/settings-pane-native-verification.json)
holds the input contexts,
their replay,
the superseded build,
fixture reports,
lint totals and restoration.
Publication preflights rejected seven changed inputs before any public write.
The [offline viewer](../questions/settings-pane.html) states the measured
findings from that data and the by-eye observations separately.

Its builder holds 105 named rules,
one per line.
Validation re-measures drawn switch positions,
header contrast and the retained left half from the embedded images;
the left half must match the published accepted Search images.
Run on the rejected first build's crops,
those pixel rules reject it by name.
The consumer test rejects 142 changed inputs,
at least one per rule.
Each of the 105 rules and the script-data encoding was deleted once in a
disposable copy,
and the test failed on that rule by name every time.
The pixel rules decode the embedded PNGs in process;
that decoder matched ImageMagick byte for byte on all 36 images it reads.

Four offline Chromium desktop/mobile light/dark contexts decoded and opened
all 32 previews,
exercised every panel,
scale and theme combination,
the end-of-column availability and its scroll note,
optional blank observations,
inert adversarial notes,
stale-reply invalidation and modal zoom/pan/reset/focus.
The sixteen resulting review,
gallery,
open-boundary and modal screenshots were inspected.
Each closed-page axe audit had 22 passes and no violations or incomplete
results.
Open-dialog axe,
Firefox ESR140 and native accessibility acceptance were not exercised.
The browser closed and its owned container is absent.
The [review verification record](../questions/evidence/settings-pane-review-verification.json)
binds exact viewer,
builder,
test,
manifest and native-result digests.
No new preference answer is required.

The [continuation plan](../../../../doc/planning/music-player-light-settings.md)
records superseded attempts and remaining checks.
