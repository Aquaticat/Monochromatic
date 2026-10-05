# Transient feedback overlay verification boundary

## Purpose and accepted behavior

D83 replaces the layout-reserving error bar.
Error feedback uses floating,
automatically expiring and immediately dismissible toast/snackbar content.
Messages target two visible lines;
longer detail directs the user to capture Android logs.
The browser,
track viewport and playback deck must not resize when feedback appears,
expires or is dismissed.

D8's no-app-confirmation treatment does not bypass Android consent.
D9's vanished-row removal and count-collapsed failures remain distinct from
successful trash.
D29 supplies content-width,
left-aligned overlay placement with a 16dp owner separation.
Its former error-bar layout owner is superseded.

This is isolated design work,
not production storage or log-export implementation.
No real file is trashed,
restored,
renamed or deleted.
No playback,
library scan,
IME or TalkBack experiment is performed.

## Native source and artifact

The owned debug branch retains the accepted shared player renderer and its
E2 information-only inset route.
The isolated `LightFeedbackActivity` has no production activity lifecycle.
The merged manifest disables `MainActivity`,
`PlaybackService` and `PeakSweepService` and removes automatic WorkManager
initialization.
Production source remains separate from this debug work.

The current E2 overlay artifact is bound to prototype commit
`743c5b378c6333f75857a3d5b7c87e4c284b53c5`
and APK SHA-256
`2b556131d86e39acb8ebcf194f39da9ed8e36e2f146a86ab4fb971f4c8f06480`.
The earlier fixed-pane overlay artifact and layout-reserving bar cohorts
are not accepted evidence for this artifact.

`LightFeedbackStudy` puts snackbar hosts in a sibling overlay,
not in Scaffold's `bottomBar` or player content measurement.
The actual track viewport supplies the placement rectangle.
Simultaneous notices use measured host heights so separation remains while
an outgoing native animation still occupies space.
This source structure motivates no-layout-change verification;
it is not itself proof of unchanged rendered geometry.

## Authored outcome boundary

The fixture distinguishes:

- A known unavailable track,
  omitted from the authored list.
- A verified successful trash premise with a live restoration handle.
- A count-collapsed failure independent of a successful-trash premise.
- Failed trash,
  retaining the row without successful-trash feedback.
- A pending request,
  retaining rows and displaying no success.
- A long multiline diagnostic with non-ASCII text and a distinctive tail.

An accepted or finished Android request is not automatically per-item
verified success.
The [storage result source audit](../../../../doc/troubleshooting/android-trash-request-outcome-boundary.md)
records the deciding SDK and comparable-provider boundary.
A restore-handle premise is not proof that actual recovery succeeds.

The pure outcome report contains 16 passing cases;
the message-fit report contains nine.
Fresh third-line and overflow guard-removal controls fail the intended
message tests,
followed by exact source restoration and the complete package unit task.
These tests do not evaluate native text layout or a provider.

## Presentation and lifecycle distinction

The default renderer uses the native short-duration snackbar lifecycle.
Immediate Close and Undo controls act on the native host.
The platform host owns timeout adjustment;
there is no separately invented fixed-time accessibility policy.
Automatic disappearance must be observed without manual input or activity
recreation before being called expiry evidence.

Static acquisition uses an explicit,
false-default `hold-for-capture` flag.
A held image proves neither automatic expiry nor successful activation.
The review must label these images as held poses and keep native lifecycle
results separate.

The error message is measured at its actual constrained text width.
If it would exceed two lines or overflow,
the renderer selects concise failure copy and a named Android-log direction.
Actual `Text` layout is checked separately from premeasurement.
Full authored detail goes to the tagged Android diagnostic sink.
The diagnostic control emits only a private capture intent in this study;
it neither exports a log file nor announces capture success.

## Required evidence before publication

The final evidence set must distinguish:

- Native layout rectangles from glyph bounds and accessibility acceptance.
- Same-scene before/after geometry from comparisons that also change rows.
- Unchanged application pixels from independently animated Android
  status/navigation regions.
- Notification/shadow exclusions from ordinary player content.
- Native timeout,
  manual dismissal,
  Undo intent and diagnostic intent from held poses.
- A full multiline log read-back from a matching prefix or final marker alone.
- The exact new artifact from earlier bar or fixed-pane captures.

A changing-geometry positive control must be rejected before trusting an
unchanged-player result.
The final viewer requires the exact inspected panel/scene/theme/font
combinations,
image digests,
held-pose markers and fresh acquisition assertions.
It is evidence only,
not another policy ballot.

Publication is still pending native controls,
image inspection and offline browser verification.
The earlier fixed-pane diagnostic cohort showed native expiry and manual
completion with unchanged application geometry;
its corrected offline pixel comparison retained `3743106` identical
application pixels outside notices/shadows in each tested transition.
That is not final E2-artifact acceptance.
Native startup dialogs,
readiness errors and mismatched evidence scopes remain rejected attempts,
not images to relabel as successful captures.
The [continuation plan](../../../../doc/planning/music-player-light-error-undo.md)
records current terminal outcomes and the next authorized step.

## Privacy and runtime cleanup

Raw screenshots,
Android hierarchies,
logs,
ADB identities and emulator metadata remain private.
Public images must be inspected,
remove the system-status strip,
retain exact application RGB and use opaque PNGs with essential chunks only.

Native visits use only `Fold_No_Hardware_Probe` under 6 GiB/2 CPU caps.
Each bounded stage restores and reads back the recorded original fields,
then requests graceful shutdown.
Separate base-state/override configuration equality is not claimed unless
it was independently recorded and compared.
Browser verification runs in an owned 2 GiB/2 CPU container and closes its
browser at completion.
