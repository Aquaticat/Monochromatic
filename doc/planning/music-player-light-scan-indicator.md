# Light scan-indicator continuation

## Purpose and settled input

Continue the authorized light-surface queue after the completed D7 menu
publication.
This item carries D26's accepted scan-F into the current Fold player and
light/dark schemes.
Settings/template editor design remains separate.
No new scan-policy ballot or production analysis is authorized.

D26 in `package/music-player/design/decisions.md` selects a bottom-edge
56dp bar with analysis text and counts,
plus an always-rendered 100dp-wide Pause/Resume control.
D13 makes the bar non-permanent:
it appears during analysis and leaves when analysis finishes.
D12 rejects a permanent completed-analysis status row.
D27's consent choices remain settled and are not part of this fit study.

The accepted source is the right frame of
`package/music-player/design/candidates/scan-ef.dc.html`.
It uses a 56px minimum-height row in its historical dp-sized mock,
a fixed 100px control and a single-line ellipsized status label.
The control changes between Pause and Resume without changing its slot.
Its 40px minimum control height is not authority to violate the current
48dp layout floor.
The native study must measure both labels at the target text scales rather
than shrinking them to fit.

The accepted source places the scan row after the deck in normal layout.
D26 specifically prevents reflow during the scan as counts/control state
change;
it does not turn this bar into D83's floating error/Undo overlay.
The historical section 7 notes predate the selected scan-F structure.
Do not transfer the error overlay's no-reservation rule to the scan bar.
No permanent blank scan slot or completed-status row should remain.
The existing inner folder browser,
full deck and information-only crease clearance remain the player baseline.

## Initial executable-source audit

Android `MainActivity.kt:1356` starts `PeakSweepService`.
The service's `runSweep` sends count updates through `postProgress` at
`PeakSweepService.kt:91`.
`buildNotification` at line 109 renders those counts in an ongoing system
notification,
not a D26 app bar.
Its inspected implementation does not expose a Pause/Resume action.
Those are source observations,
not a reason to run or alter the real sweep.

`PlayerUiState.kt:72` exposes `loading` for source discovery.
`MainActivity.kt:3652` renders that through `loadingNotice`,
a spinner and `Loading your library…` text.
Source enumeration is not true-peak analysis;
that loading flag must not become a substitute for authored scan progress.

Scoped searches across Android production source,
desktop source and Slint UI found no `scanLabel`,
`Analysing true peak`,
`Analyzing true peak`,
`Pause analysis`,
`Resume analysis` or `isScanning` menu/bar owner.
The positive matches identify the Android sweep service,
worker and scheduler instead.
This is a scoped absence finding,
not a platform-capability claim.

The historical scan-F and first-run candidates increment their authored
count to a cap,
but their inspected timers do not transition out of scanning at that cap.
Their captions describe disappearing on completion;
the executable study must actually exercise that boundary rather than
crediting the caption as lifecycle evidence.
No historical candidate is rewritten by this continuation.

## Isolated preparation and verification

Prototype `a10baf8b4` adds validated immutable scan records and checked
synthetic events.
The 21 pure fixture tests passed,
along with fresh unknown-scene,
completed-bar,
paused-progress and stalled-running mutants.
Each mutant produced its intended assertion failure;
exact restoration and the complete unit task followed.
The authored final step actually enters a completed state and removes bar
visibility;
no worker outcome is implied.

Prototype `56b6170fd` adds the isolated native host and accepted scan-F row.
The full unit task and APK build passed.
APK SHA-256 is
`60fe847ebbd5d5c6694fbecddb08b87142b6d258137579ff0dee93901541bf29`.
The merged manifest disables production activity/services and removes
WorkManager initialization.
Android lint still fails on the same five inherited errors;
no finding names a new `ScanIndicator` source file.
No lint rule or unrelated source was changed.
No native fit or input acceptance is claimed yet.
The host uses explicit same-instance debug events for start/progress,
while Pause/Resume are native button actions.
The inspected installed SDK `Activity.onNewIntent` contract pauses/resumes
the existing top activity without recreating it when SINGLE_TOP is used.
The original scene intent is retained.
Installed Material3 `1.5.0-alpha27` source and class declarations expose the
classic outlined button,
its content padding and label style;
the study keeps 100dp width,
56dp bar height and a 48dp control floor.
Text-layout diagnostics will decide fit,
not source inspection or guessed text width.

## Independently verifiable queue

- [x] Identify D26's selected bar,
  its state transitions and the production loading/analysis boundaries.
- [ ] Build pure authored scan state and an isolated native host using the
  accepted player,
  without calling production analysis or persistence.
- [ ] Measure light/dark fit on both panels at 100% and 200% text,
  including Pause/Resume labels and count-width stress.
  Preserve the accepted label ellipsis and current layout floors.
- [ ] Exercise native Pause/Resume,
  progress changes and disappearance after authored completion.
  Verify stable active geometry and exact return to the no-bar baseline;
  record any deliberate appearance/disappearance reservation separately.
- [ ] Publish freshly inspected,
  sanitized and exact-artifact-bound evidence and verify its offline viewer.

## Boundaries and next action

Use only authored progress and debug events.
No real peak computation,
cache writes,
media playback,
source discovery,
consent changes or notification redesign occurs.
A prototype pause or completion is not a real worker outcome.
No new IME,
TalkBack or keyboard-default experiment belongs to this item.

Native work retains the owned Fold runtime's 6 GiB/2 CPU cap;
browser verification retains 2 GiB/2 CPU.
Original AVDs remain untouched.
Every visit records original settings before mutation,
restores those exact fields and verifies owner shutdown/runtime absence.
The owned visit reached the exact isolated activity with a fresh baseline.
The initial probe failed on inner/light/200% Resume text:
`ScanIndicator.text:control:Resume:lines=1,overflow=true`.
Pause reported no overflow;
the bar and control rectangles were unchanged after the native pause input.
The bar measured 137px high;
the control measured 244px wide and 131px high within it at 390dpi.
This is a real text-fit failure,
not failed touch delivery or accepted visual evidence.
The probe stopped before cover checks and before the complete cohort.
Recorded-setting restoration and owner shutdown were started immediately.

The first native draft supplied 12dp horizontal button content padding.
That value is not specified by D26 or scan-F's source,
whose control has no horizontal padding declaration.
The separate playback-mode control's 12dp floor must not be silently
promoted into a scan-control requirement.
The next step is to distinguish width from height overflow and measure the
accepted fixed-width control at its actual source padding,
without shrinking text or claiming a fix from source alone.
Authored completion removes the row at the next composition;
this introduces no production dwell-time or animation requirement.
The separator preserves scan-F's existing `border-top` rather than adding
a new status surface.
