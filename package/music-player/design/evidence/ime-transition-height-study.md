# Debug IME transition and unfolded deck fit

## Boundary

D50 requires the complete unfolded deck throughout Search typing.
The accepted [Search A review](../questions/current.html) uses a 300dp debug IME.
The earlier [Gboard evidence](gboard-geometry.md) records a real transient
font-update banner that raised the IME top to y `1140` and clipped the final mode.
The separate 415dp `FoldBannerInputMethod` approximates that reported height,
but **does not reproduce Gboard's banner**.
The upper-left keeps the same folder browser in every candidate here.

## Disposable fixture and controls

A private Pixel 9 Pro Fold AVD (`Fold_No_Hardware_Probe`) ran in a 6 GiB,
2 CPU container on its 2076 × 2152px inner panel at 390dpi and 200% font scale.
The tested debug APK SHA-256 was
`ac9a9570028aec916d2df704b403dac032165daf2cbb1daded78960b1362f7b6`,
built from prototype commit `d98a890b2`.
Both candidate visits used that APK,
the same system-managed 415dp debug IME,
a focused `cam` query,
and a physical-display `screenrecord` at 1038 × 1076px.
This is half the physical pixel count in each dimension;
frame geometry must be doubled before comparison with native PNGs.
The video captures remain private because their status region was not sanitized.

- **Failure control:**
  `search-deck-right-lift-bannerfit-retain-results-light` retained the
  earlier fixed 1000px Compose-bottom trigger.
  App logs showed the platform IME bottom already at `1011px` while
  Compose reported `681px` and `973px`;
  the compact-deck branch was still false.
  It became true when Compose reported `1011px`.
  In the 24-frame recording,
  two visible-IME frames lacked the final mode's bottom outline.
  Frame 016 showed `Shuffle all` cut at the dark IME edge.
  The same five-outline scan detected the complete mode before and after
  those frames,
  so the scan can distinguish a failure from a passing state.
- **First measured-fit attempt:**
  `search-deck-right-lift-autofit-retain-results-light` measured the closed
  deck,
  compared it with available height using the platform IME target,
  and selected the compact branch at the first logged `681px` Compose
  bottom.
  It also added `platform bottom - Compose bottom` as ordinary padding
  after `imePadding()`.
  In the 27-frame recording,
  frames 017 and 018 lacked most of the mode group,
  with a blank strip between app content and the keyboard.
  The same geometry scan reported only two of the five mode outlines in
  those frames.
  This **failed** D50 more visibly despite the earlier branch decision.

The app logs describe values sampled during composition;
`imePadding()` is resolved during layout.
The recordings demonstrate that combining the sampled difference with
`imePadding()` did **not** yield a reliable reservation in this fixture.
They do not establish an AndroidX bug or prove the precise callback order.
The experiment's raw logs are in private scratch as
`fixed-ime-transition.log` and
`auto-reserve-failed-ime-transition.log`;
full videos and extracted frames have matching names there.

## Layout-time-only retest

Prototype commit `b16c667d4` removed the ordinary extra padding.
The platform target now selects only whether to use the compact deck;
`imePadding()` alone owns bottom reservation.
The rebuilt debug APK SHA-256 was
`e5b998268d5e28d65006e73ffa642e1aee58c4b0818f0511d88a3a19a3f19f9f`.
In a new 26-frame recording at approximately 10fps,
13 sampled frames included the visible debug IME;
the five-outline check found the full final mode in each of those frames.
The platform already reported a `1011px` target when Compose first reported
`44px`,
and the compact branch was true at that sample.
The earlier fixed-trigger control had two clipped visible-IME frames,
but was recorded with the previous APK;
it proves the image check can expose a clip,
not a same-APK performance comparison.
The new recording jumped from an IME top around y `2108` to y `1140`
between captured frames,
so it **does not prove** visibility at every intermediate animation frame.
The corrected video and logs remain private scratch files named
`auto-ime-transition.mp4` and `auto-ime-transition.log`.

## In-place height steps

Prototype commit `dccedba55` added a separate debug-only input method whose
buttons changed its actual system-managed height without losing Search focus.
The APK SHA-256 for this step study was
`838f0f11294e5d824768a1d57dd5b471a8aa1c93f9b7dbca6f8b7ba8adcf375c`.
On the same unfolded 200% Fold,
its 330,
360,
370,
372,
375,
400 and 415dp states reported IME tops of y `1348`,
`1275`,
`1251`,
`1246`,
`1238`,
`1177` and `1141`,
respectively.
The first 330 to 360dp step changed the platform bottom inset from
`804` to `877px`,
a positive control that the button altered the actual IME window.

The measured-fit candidate selected the compact branch by 360dp.
At every stepped endpoint,
all four modes had full 131px final-row bounds ending 20px before the
actual IME,
and title,
metadata,
seek text,
transport icons and both right-side results remained in their safe areas.
This is **endpoint** evidence,
not an animation proof.
The unchanged vertical-deck control stayed complete at 360,
370,
372 and 375dp;
it first clipped at 400dp,
where its final mode was only 120px tall and ended exactly at the IME top.
It switched to compact at 415dp.
Thus the closed-deck height used by the first fit estimate caused an
earlier-than-needed design change.

The passing vertical deck's app `ScrollView` spanned 1033px at 360 and
375dp;
its 16dp separator occupied another approximately 39px.
At 400dp,
the available area from y `136` to IME top y `1177` was 1041px,
less than that measured combined demand.
The clipped `ScrollView` was only 1002px tall there.
Those measurements motivated prototype commit `ad53f5685`,
which prefers a noncompact keyboard-open deck sample when it has positive
unconstrained space above it.
This later candidate has **not** yet been verified in the step fixture;
its fallback may still choose compact early on a cold start.

## Remaining boundary

The closed deck's first measured heights changed from `762` to `891` to
`1149px` as Compose settled in one visit.
A later focused transition logged a stored `1071px` height,
but this capture did not isolate when that earlier sample was taken.
No single early `onSizeChanged` value proves full-content demand.
Verify the new open-height sample,
ascending and descending steps,
keyboard dismissal and refocus,
and cold entry at a height where both deck arrangements fit.
Check title paint and accessibility bounds separately;
acceptance of a cropped **browser** does not allow a cropped deck.
A real Gboard banner recurrence and floating Gboard remain independent,
unresolved evidence needs.
