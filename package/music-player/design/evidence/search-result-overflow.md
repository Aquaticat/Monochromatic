# Pixel 9 Pro Fold Search result-name and list-overflow study

## Design-only fixture

The accepted Search A keeps an integrated Back/query/Clear header,
results on the right inner pane,
and the same upper-left folder browser above the bottom-left deck.
The cover uses one full-width Search page.
A debug-only result-data stress candidate on prototype commit `c7e0552ee`
uses a spaced synthetic folder title,
an unbroken synthetic track title,
a longer secondary description and additional folder rows.
The tested APK SHA-256 is
`989346cd9b7dde18dbec03255368f6aa4e1fb2744828e04e4ecd4c8bddfabc10`.
It changes no production Search result source or ranking.

The private `Fold_No_Hardware_Probe` AVD was unfolded or folded using its
measured device states at 390dpi and 200% text.
Android UI Automator hierarchies and native-panel PNGs remained in private
scratch because their system status content was not sanitized.
The source variants are
`search-deck-right-lift-retain-overflow-results-light` for the inner panel
and its delegated `search-layout-docked-results-overflow-light` cover form.
A same-APK plain-A control retained `Folders`,
Open,
`cam`,
the complete deck and the ordinary short result titles before the stress
candidate was opened.

## Inner panel at 200% text

With the keyboard closed,
the long spaced folder name wrapped within right-side text bounds
`[1220,338][2037,956]`.
The unbroken track name wrapped by character within
`[1220,1095][2037,2022]` rather than widening into the approximate
x `[983,1093)` crease.
The large first rows push other matches lower in the list,
so vertical scrolling remains part of the result experience.
After scrolling,
the final synthetic `Camellia archive 18` label was fully visible at
`[1220,1856][1858,1959]` while the left browser and mode bounds remained
unchanged.

The 300dp system-managed **debug IME** began at y `1421`;
this is not a real-Gboard pass.
With `cam` focused,
the same left browser remained visible and the final mode occupied
`[73,1270][965,1401]` above that IME.
Independent right-list swipes then brought the last result to
`[1220,1203][1858,1306]` above the IME,
without moving the browser or deck.
This tests result scrolling in the selected A composition,
not activation or ranking.

## Folded cover at 200% text

With the keyboard closed,
the long spaced folder title occupied `[127,350][993,865]` and the
unbroken track title `[127,996][993,1923]`.
The final synthetic folder row was reachable at `[127,2151][765,2254]`
after scrolling,
above the screen's navigation region.

A visible 300dp debug IME began at y `1693` after focusing `cam`.
At the cover list's maximum downward scroll,
`Camellia archive 18` still occupied `[127,2151][765,2254]`,
**behind** that bottom keyboard.
A reverse swipe visibly moved the list back to earlier rows,
so the failure was not an unresponsive gesture;
returning to the scroll end still left the last rows behind the IME.
The physical cover screenshot showed the list cut at the keyboard top,
with only results through `Camellia archive 15` readable in that sample.
`SearchLayoutStudy.kt` currently gives cover results a vertically scrolling
column with navigation-bar padding but no keyboard-height reservation.
This is a **debug-prototype viewport finding**,
not a claim about production Search (which is not yet implemented).
D55 accepts results obscured by **floating real Gboard**,
not these results hidden behind an ordinary bottom-aligned keyboard.

## Opt-in cover viewport comparison at 200% text

Prototype commits `f4a35e817` and `c4cf948e4` add a **separate,
unaccepted** `-imeviewport-` comparison to the selected Search candidate.
The selected Search cover delegation keeps the positive-heading suppression,
so the first result still begins directly beneath the integrated header.
Only the cover result viewport receives Compose `imePadding()`;
Back,
query and Clear remain in the fixed header.
The [Android Compose insets guide][compose-insets] describes keyboard inset
padding as resizing scrollable content during IME changes and consuming
nested system-bar insets.
That describes the intended API behavior,
not a substitute for the rendered device check.

The newly built and installed debug APK matched SHA-256
`0801ea3f44ef84163cbddb2b2f37fbddbb1c293148440381f6f899be7eaee7af`.
On the disposable folded 1080 × 2424 panel at 390dpi and 200% text,
its keyboard-closed result viewport was `[0,330][1080,2365]` and the
first long title started at y `350` with **no heading**.
After the query took focus,
the 300dp debug keyboard began at y `1693`;
the viewport ended at that same y instead of continuing behind it.
A within-list upward swipe visibly moved row 1 from y `2236` to y `1246`,
validating that this fixture responds to scrolling.
At the bottom,
`Camellia archive 18` occupied `[127,1479][765,1582]` and its supporting
text occupied `[127,1582][847,1673]`,
both above the keyboard.
A further upward swipe left row 18 at exactly the same bounds.
The native 1080 × 2424 screenshot showed the complete last title,
its folder icon and supporting copy immediately above the debug keyboard.
A first explicit screenshot inadvertently targeted the black **inactive
inner** display;
the verified cover capture used display ID `4619827551948147201`.
These controls support a **settled 200% debug-IME viewport pass**,
not a real-Gboard or frame-transition pass.
The APK's signing certificate differed from the prior installed debug APK;
only the disposable AVD's app was uninstalled and reinstalled before this
same-hash comparison.

Next test the keyboard-closed scroll end,
IME opening at the end,
100% text and real settled full-width Gboard,
while independently checking that the inner selected browser and deck are
unchanged at both text scales.
Keep raw status-bearing screenshots and XML private until sanitized.

[compose-insets]: https://developer.android.com/develop/ui/compose/system/insets-ui
