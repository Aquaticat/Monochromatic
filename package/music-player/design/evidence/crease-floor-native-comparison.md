# E2 native inner Search floor comparison

## Correction and fixture

The first E2 form reused one existing Search A screenshot with proportional bars.
The user correctly noted that those were not alternative mockups.
That form was withdrawn without a `min_padding` choice.
The replacement at [`questions/crease-floor-review.html`](../questions/crease-floor-review.html)
embeds separate native Compose captures for each proposed floor in both
positive-results and empty Search states.
The prototype lives only on branch `prototype/music-player-theme-compose`
at commit `469819241` under
`package/music-player/android-app/app/src/debug/kotlin/dev/monochromatic/musicplayer/SearchPersistentDeckStudy.kt`.
No production Search implementation or accepted decision was changed.

The disposable `Fold_No_Hardware_Probe` ran within a Podman container
inspected at 6,442,450,944 memory bytes and 2,000,000,000 NanoCPUs.
It was unfolded in device state `2`,
at 390dpi and 200% text.
Only keyboard-closed Search states were captured;
this is **not** an IME experiment or a D50 keyboard-fit test.
A package-signature mismatch first blocked Gradle's `:app:installDebug`.
After confirming the disposable AVD identity,
only that guest's old debug app was uninstalled and the new debug APK installed.
The installed guest APK bytes matched the built SHA-256
`9e80c29ccfee72e82574a8884b3e4dca89361f05f73db3fc0231b546c971298c`.
The original AVD and Gboard settings were not changed.
The signature behavior is documented in
`doc/troubleshooting/android-37-debug-apk-signature-update.md`.

## Captured variants

All six images have the native 2076 × 2152px panel dimensions.
The full top 136px status strip was replaced with generic status content,
all app pixels outside it matched each raw capture exactly,
and PNG text,
profile,
EXIF and timestamp chunks were removed.
Raw status-bearing captures and full UI hierarchies remain private.

- P0,
  existing Search A with no independent floor:
  [positive results](../questions/render/search-e2-floor-0-results-inner-light-s200.png)
  and [empty state](../questions/render/search-e2-floor-0-empty-inner-light-s200.png).
- P14,
  proposed 14mm **total** opposing-information floor:
  [positive results](../questions/render/search-e2-floor-14-results-inner-light-s200.png)
  and [empty state](../questions/render/search-e2-floor-14-empty-inner-light-s200.png).
- P20,
  proposed 20mm **total** opposing-information floor:
  [positive results](../questions/render/search-e2-floor-20-results-inner-light-s200.png)
  and [empty state](../questions/render/search-e2-floor-20-empty-inner-light-s200.png).

The debug prototype begins with the selected A's approximate 55px half-crease
clearance plus its existing left 8dp and right 16dp content insets.
When the proposed physical total exceeds that nominal spacing,
it divides the additional inset evenly between the left deck/browser host and
right Search pane,
then adds one dp per side to cover measured native rounding in this fixture.
This is **one tested allocation**;
E2 itself does not require equal exterior margins or an empty painted stripe.
A 10mm floor would not visibly alter this sample because its current nominal
separation already exceeds 10mm.
P14 and P20 were selected to show actual space and wrapping consequences,
not because a standard supplies those thresholds.

## Measured sample and limits

In the keyboard-closed **empty** captures,
UI Automator reported the left timer `4:35` right edge and the right
`Search your music` heading left edge as follows:

- P0:
  x `965` and `1132`,
  projected horizontal node-box gap `167px` (approximately 11.35mm).
- P14:
  x `944` and `1153`,
  projected gap `209px` (approximately 14.20mm).
- P20:
  x `900` and `1197`,
  projected gap `297px` (approximately 20.18mm).

Those boxes occupy different vertical positions;
the quoted gaps are **not** nearest same-height pairs or measurements of
actual glyph ink.
The physical panel width and visible 7.5mm crease are estimates.
All captured empty and positive states retained Folders,
Open,
the actual upper-left browser,
Back/query/Clear,
the right Search region and the complete four-mode deck.
At P14 the first browser rows kept their P0 wrapping in these captures.
At P20 the narrower browser wrapped `Celldweller` to a later line and
`Clown Core` fell below its initial viewport despite the keyboard being closed.
The browser was not replaced by a caption;
its scroll reachability in this new variant was not tested.

The screenshots show actual **after-state** layout changes under one APK.
They do not certify every meaning-bearing pixel,
long names,
other text scales,
keyboard-open fit,
focus behavior,
activation or accessibility traversal.
Choosing a numeric E2 floor remains a design decision;
compliance at that floor needs its own later verification.
The user stated **7.5mm total minimum even on a future narrower-crease
device**,
then required re-asking because the form omitted views with Search closed.
This statement is pending explicit re-confirmation after those player views;
no numeric `min_padding` decision was recorded from the incomplete review.
The historical player preview still uses fixed 414dp panes and a 24dp stripe,
so it cannot stand in for a native E2 player-floor variant.
An initial debug-only Search-closed player variant painted a gray central
rectangle by setting the inset Row's background to `palette.window`.
The user rejected that reading of E2:
7.5mm constrains informational marks,
not structural surfaces,
borders,
padding or hit regions.
Those player captures are withdrawn and must remain private.
The next debug-only prototype (`c15a2d5b5`) retains full-size player
surfaces,
current-row backgrounds,
dividers and hit regions;
only the right-side title and track text receive extra information clearance.
Its Search page likewise retains the full left browser/deck and right
surface while shifting right-side informational content.
Commit `678fd7d8f` also keeps the full 200% mode targets in the
Search-closed player.
A private P7.5 native sample shows no gray stripe,
a complete last mode at `[73,1904][965,2035]`,
and a right heading beginning at x `1106`,
just outside the approximate crease endpoint x `1093`.
All remaining native captures still require inspection before replacing
the incomplete form.
No floor decision or native player visual has yet been re-accepted.
