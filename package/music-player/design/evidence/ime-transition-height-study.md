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

## Revised experiment and unresolved checks

Prototype commit `b16c667d4` removed the ordinary extra padding.
The platform target now selects only whether to use the compact deck;
`imePadding()` alone owns bottom reservation.
This commit was made **after** the failing recordings,
so neither recording proves its effect.
The revised APK must be installed on the disposable Fold and recorded under
the same fixture before any pass claim.

The closed deck's measured height changed from `762` to `891` to `1149px`
as Compose settled in one visit.
A later focused transition logged a stored `1071px` height,
but this capture did not isolate when that earlier sample was taken.
Consequently,
a single early `onSizeChanged` sample is not proof of full-content height.
The test must verify title,
metadata,
seek controls,
transport controls,
all mode borders,
and any scroll extent in the rendered frames.
It must also exercise keyboard dismissal,
refocus,
and heights near the observed overflow boundary.
A real Gboard banner recurrence and floating Gboard remain independent,
unresolved evidence needs.
