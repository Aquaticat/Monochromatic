# Native scan-indicator verification boundary

## Purpose and settled input

This design-only study carries D26's accepted scan-F indicator into the
current Fold player and its light/dark schemes.
It does not reopen Search,
menu actions,
D83 overlay placement,
notification presentation,
D27 consent choices or D81's Settings-template requirement.

D26 selects a bottom-edge 56dp bar with analysis text and counts plus an
always-rendered 100dp-wide Pause/Resume control.
D13 makes the bar non-permanent:
it appears during analysis and leaves when analysis finishes.
D12 rejects a permanent completed-analysis status row.

The accepted source is the right frame of
`candidates/scan-ef.dc.html`.
Its historical mock uses a 56px row,
a fixed 100px control and a single-line ellipsized status label.
The control changes between Pause and Resume without changing its slot.
Its 40px control height is not authority to violate the current 48dp
layout floor.
The accepted source reserves the bar row in normal layout;
this is not D83's floating overlay rule.

## Isolated artifact and input owner

The current source is prototype commit
`25a95411750c5c5356631fc508513c42a81ad1c4`,
with APK SHA-256
`c06ec80240e41641fee1fdec79313a8294b9595544740145f4fa6f2b1f77ddf1`.
`ScanIndicatorActivity` extends `ComponentActivity`,
not the production activity.
Its merged manifest disables production activity/services and removes
WorkManager auto-initialization.

Prototype `a10baf8b4` adds validated immutable scan records and checked
synthetic events.
The 21 pure fixture tests passed,
with fresh unknown-scene,
completed-bar,
paused-progress and stalled-running mutants failing their intended tests
followed by exact restoration.

The host owns one immutable state record.
Native Pause/Resume uses the actual button.
Explicit same-instance debug events deliver authored start and progress
without recreating the activity.
A synthetic event is not a real worker outcome.

## Measured padding boundary

The first native draft (`56b6170fd`,
APK `60fe847ebbd5d5c6694fbecddb08b87142b6d258137579ff0dee93901541bf29`)
added 12dp horizontal button content padding.
That value is not specified by D26 or scan-F's source;
the separate playback-mode control's 12dp floor must not be promoted into
a scan-control requirement.
The inner/light/200% Resume label failed with
`ScanIndicator.text:control:Resume:lines=1,overflow=true`.
Pause reported no overflow.
The probe stopped before cover checks and the full cohort.

Prototype `25a954117` retains the padded draft as an explicit same-APK
diagnostic control and defaults to scan-F's source padding.
For inner/light/200% Resume,
native intrinsic text width was 233.5px.
The padded draft laid out 186 by 91px and reported height overflow under
its single-line limit.
Source padding laid out 234 by 91px with neither overflow axis set.
The measured outer bar and control slots and player geometry were
identical.
This is the paired padding result,
not a universal text-fit claim.

## Native fit and state verification

The focused probe passed on both panels at 200% in light:
Pause and Resume each fired once in the same activity,
control text fit,
active geometry stayed unchanged and changed-rectangle controls failed.
The status stayed on one line;
it was ellipsized on cover and not inner.

The complete 32-pose cohort now covers both panels,
light/dark and 100%/200% text across idle,
running,
paused and wide-count scenes.
Six cover 200% active views report the accepted status ellipsis;
the total count is not fully visible there.
Layout rectangles are not glyph bounds or accessibility acceptance.

Native controls passed in all eight panel/theme/scale environments:
native Pause/Resume exactly once each,
synthetic start and progress delivered without activity recreation,
paused progress not advancing,
unchanged active player geometry and app pixels,
unchanged fixed bar/control slots,
completion removing the whole bar,
and the completed player matching the idle baseline in geometry and app
pixels.
Changed-pixel and changed-geometry controls were rejected.
While active the bar reserves 137px of player height at 390dpi;
this is scan-F's own row reservation,
not a floating-overlay measurement.

## Verification limits

Every progress value and completion is authored debug input.
No real peak computation,
cache write,
source discovery,
media playback,
notification change or worker pause occurs.
Authored completion removes the row at the next composition;
no production dwell time or animation is selected.
No new IME,
TalkBack or keyboard-default experiment is included.

Full Android lint is not passing.
Its five inherited errors are `MissingSuperCall` in the old debug IMEs and
`NewApi` in the prior Search inset experiment.
Those files are unchanged by this work.
No finding names a `ScanIndicator` source file;
65 warnings and two hints remain.
No lint rule or unrelated source was changed.

The measured adapter was LLVM 20.1.2 llvmpipe software rendering despite
the requested host GPU path.
Successful capture and shutdown are not diagnostic-free or general
stability claims.

## Privacy and restoration

Raw screenshots,
Android hierarchies,
logs and generated identities remain private.
Sanitized publication inputs use measured application/root bounds,
exact retained RGB,
opaque 8-bit PNGs and essential chunks only.
Ordinary viewport clipping and temporary bar occlusion are retained.

Only the freshly recorded fields are restored and exactly read back:
font scale `1.0`,
night mode no,
device state identifier 2 OPENED,
accessibility disabled,
no enabled accessibility services,
2076 by 2152 at 390dpi and the system image fingerprint.
Separate base-state and override equality is not claimed.
The owner exited `0`;
matching containers and QEMU are absent.
Original AVDs and library data remain untouched.

## Publication state and next steps

Sanitization is complete:
32 measured-inset crops are ready under the private
`study-source-padding/verified-crops/` with retained-RGB proofs.
`questions/scan-indicator.template.html` is prepared but not yet bound to
witnesses.
Remaining work:
make and inspect the light/dark full-region pairs,
bind a fresh inspection record to these exact crop hashes,
publish `scan-indicator-witnesses.json` and scoped native verification,
build and validate `scan-indicator.html`,
run consumer tests and guard-removal proofs,
run four-context offline browser verification,
inspect the resulting screenshots,
publish the review-verification digest,
then close the plan,
README,
HANDOFF and open-questions records.
The document verifier must also learn this artifact.
No new preference answer is required to complete those checks.

The [continuation plan](../../../../doc/planning/music-player-light-scan-indicator.md)
records terminal outcomes,
superseded attempts and remaining checks.
