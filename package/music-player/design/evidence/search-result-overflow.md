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

## Next comparison

Prototype a separate cover variant whose result viewport reserves the
reported bottom IME height while keeping the same fixed header and native
result rows.
Require the last row to become readable while `cam` remains focused,
then compare keyboard-closed and typing states at 100%/200% text.
Do not infer success from an app-node rectangle alone;
verify the rendered state before capturing it.
Any raw captures stay private until their status regions and metadata are
sanitized for a user review.
