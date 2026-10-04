# Light error and Undo state-family continuation

## Purpose and existing decisions

This is the next independent design-only queue item after first-run evidence
and the proposed whole-map keyboard demonstration.
D82 closes custom Android notification design;
no notification variants are part of this work.
New keyboard assignments remain a proposal,
and this state-family work does not depend on their adoption.

D8 selects immediate trash with a compact,
content-width Undo toast rather than a confirmation dialog or full-width
snackbar.
D9 removes vanished rows and uses a dismissible error bar,
collapsing multiple failures to a count.
D29 places the left-aligned toast 16dp above the current bottom-edge owner,
lifting above the error bar without pushing layout.
The unresolved work is carrying those settled behaviors into the light
surface and verified Fold geometry,
not asking about pill colour or spacing below their hard floors.

## Independently verifiable queue

- [x] Inspect the accepted dark error/toast candidates,
  current operation owners and token roles.
  Completion requires distinguishing known missing-file signals,
  failed trash operations and actual Undo capability from invented
  recovery actions.
- [ ] Build isolated native light/dark authored states for error only,
  Undo only and the combined state,
  preserving D8/D9/D29 and accepted player information clearance.
  Completion requires fit and overlap evidence at both panels and native
  font scales,
  not a live filesystem mutation.
- [ ] Publish inspected,
  sanitized state evidence and verify its consumer review.
  Record implementation limits and restore/stop any owned runtime.
  Ask only if a consequential unresolved requirement survives the audit.

## Safety and evidence boundary

No real file is trashed,
restored,
renamed or deleted.
No live playback,
source scan,
original-AVD change or new IME/TalkBack experiment is authorized.
An authored successful-trash state cannot prove that production Undo can
restore the original identity or location.
A failed trash request does not qualify for a successful-trash toast.
Unknown failure causes do not receive an invented generic Retry action.

Native work may use only the owned disposable Fold under 6GiB/2CPU bounds;
browser checks stay within 2GiB/2CPU.
The existing first-run debug host disables production entry points and
services and can supply the same isolation boundary for this study.
Raw status-bearing images,
hierarchies and logs remain private.

## Initial source anchors

`package/music-player/design/decisions.md` sections D8,
D9 and D29 are the authority for behavior and placement.
`package/music-player/design/candidates/err-b.dc.html` and
`package/music-player/design/candidates/toast-a.dc.html` are historical
accepted dark treatments to inspect,
not a current source-operation proof.
`package/music-player/design/open-questions.md` section 11d lists the light error bar and
Undo toast as undrawn.

## Completed source/operation audit

The historical `err-b` and `toast-a` files were read completely.
They predate the accepted native Fold composition and still contain
superseded track ordinals,
play markers,
in-app volume and sub-48dp controls.
Carry D8/D9/D29's behavioral requirements,
not those obsolete implementation details,
into the native study.
The historical six-second demo timer is not an accepted universal Undo
interval or an accessibility timeout policy.

A source search across Android main Kotlin,
desktop Rust and Slint found no implemented trash/Undo UI action;
the literal Undo hits were unrelated comments.
`PlayerUiState` exposes no error/Undo outcome field.
These are inspected-source limits,
not proof that every platform or dependency path lacks such capability.

`MainActivity.kt:1670` currently persists only the chosen tree's read grant.
That does not establish permission to trash or restore its documents.
The installed API37 `MediaStore.java:2027` to `2071` documents
`createTrashRequest` as request generation:
it displays a system prompt,
then applies `IS_TRASHED` after approval,
and finishes the operation before delivering `RESULT_OK`.
Request generation or pending approval is not successful trash.
The same API with `false` requests removal from trash.
The current [shared-media guide][shared-media] corroborates the separate
access and operation boundaries.

The installed API37 source also exposes flagged path-based `trashFile`
and `restoreFileFromTrash` methods,
requiring declared and granted `MANAGE_EXTERNAL_STORAGE`.
The current app manifest declares neither that permission nor
`MANAGE_MEDIA`.
Their SDK declarations establish neither availability in the captured
runtime nor a reason to adopt broader access.
No special storage access is selected or requested here.

`DocumentsContract.java:576` marks deletability,
while `deleteDocument` invokes provider deletion.
That operation is not documented as a reversible trash/restore contract.
Provider deletion capability alone supplies no Undo owner.
The source audit does not claim Android universally requires one prompt
or universally forbids direct operations;
current ownership and grants matter.
D8 does not authorize bypassing OS consent or falsely reporting success.

## Fixture implementation in progress

The owned debug worktree now has exact missing,
Undo,
combined,
failed-trash and pending-trash fixtures.
A successful Undo fixture requires explicitly authored per-item
`verified-success`,
a restoration handle and a live interval.
`approved-but-unverified` is neither pending nor a known failure;
it cannot borrow successful-trash feedback.
The retired `completed` token is rejected rather than silently acquiring
that stronger meaning.
Failed,
cancelled,
pending,
expired and missing-handle controls reject successful Undo feedback.
The combined state separates three unavailable-file outcomes from one
successfully trashed authored row.
No file is actually changed.

The native renderer and overlap/fit evidence are still pending.
Prototype `5a7232914` commits the original fixture;
`d266f3664` separates accepted requests from per-item verified success.
The revised 15 host-JVM tests passed,
and fresh unknown-scene,
pending and accepted-but-unverified mutants failed their intended tests.
Exact restoration and the complete unit task passed in `proc_9e67`.

Comparable MediaProvider revision
`a183e2b92c71d86ec7b104c116ef3f4dbcbb523f`
was inspected read-only.
Its positive task can set `RESULT_OK` after batch operations whose per-item
results are not checked,
including a caught exception path.
This is not proved equivalent to the installed image or an observed
provider failure.
The source demonstrates why request acceptance/completion does not supply
that fixture's stronger per-item success premise.
[The operation boundary](../troubleshooting/android-trash-request-outcome-boundary.md)
retains exact source excerpts,
dialog-skipping conditions and limits.

Prototype `36ea4fa46` adds the isolated `LightFeedbackActivity`,
renderer,
feedback surfaces and private native-layout measurements.
Existing player routes retain default-empty row omissions and no measurement
modifier;
the feedback route names its authored omissions while retaining source
indices and the complete shared folder/deck renderer.
Undo emits only a debug intent and does not return a row or report recovery.
Dismiss changes only local error-bar presentation.
The error bar explicitly owns its navigation inset;
Scaffold content padding is not assumed to protect custom bottom-bar controls.

The bounded APK build passed in `proc_7d1d`.
The fresh merged manifest retains the isolated host,
disables production entry/services and removes automatic WorkManager
initialization.
The retained APK SHA-256 is
`523573ee2937200c74135751b36fe84fe56ad9bc17dc1f89132c125c8193f121`.
No native light-feedback capture or artifact acceptance is claimed yet.

The first owned emulator attempt aborted before guest readiness with
`Failed to find memory type for ColorBuffers.`
The obsolete boot watch was stopped and container/matching-emulator
absence checked.
The explicit `-feature -Vulkan` attempt then exited before guest readiness
with the distinct multiple-instance FATAL.
That lock rejection does not establish the override's effect on graphics.
Validated `lsof` and `fuser` positive controls,
nonempty `lslocks` output and empty matching process/container checks
preceded joint quarantine of only the exact owned `hardware-qemu.ini.lock`
and `multiinstance.lock` files.
Their private backup is retained;
no original AVD or arbitrary lock was changed.

The post-quarantine runtime remained live under its measured caps,
but the readiness watch failed on `adb: device unauthorized`.
That is not a successful read proving incomplete guest boot.
Owning-container console help remained reachable and accepted graceful
shutdown;
an absence watch must finish before any restart.
No guest settings were changed through the unauthorized transport and no
fresh settings snapshot or application frame was captured.

Fresh installed metadata and the running emitter identify Android Emulator
`37.2.12.0`,
build `16428233`;
the historical `37.1.11` attribution does not apply to this visit.
Read-only comparable gfxstream revision
`07ee40efb0e7037a9a9b7fe59071e7c4997e7cbe`
traces the allocation/probe/fatal sequence,
not source/binary equivalence or a proved allocator cause.
[The graphics and transport boundary](../troubleshooting/android-emulator-container-color-buffer-allocation.md)
retains those separate outcomes.

The owning runtime exited cleanly and its absence watch passed.
The `-skip-adb-auth` attempt still reported an unauthorized guest transport;
that flag is not a verified authorization workaround.
An independent console screenshot showed a separate System UI ANR.
Authenticated local gRPC touch removed that dialog,
providing a visible input positive control;
a console mouse command's `OK` alone had not shown the intended change.
Neither observation establishes the ANR's cause or ADB authorization.

The measured container network is isolated `pasta` and its ADB server
used `HOME=/tmp`.
A container-local server restart and reconnect retained unauthorized
transport and showed no RSA approval dialog in the inspected frames.
Only this runtime's generated key pair was retained in private mode-restricted
storage for one bounded persistent-identity retry.
No original host key,
original AVD or guest authorization file is copied or changed.
The current runtime accepted graceful console shutdown;
`proc_3ef7` verifies absence before that last retry.
The final persistent-owned-identity retry displayed the actual
`Allow USB debugging?` prompt.
Its fingerprint matched the retained runtime-generated public key.
Authenticated gRPC input selected `Always allow from this computer`
and `Allow`;
ADB then reported `device`,
`sys.boot_completed=1` and the correct `Fold_No_Hardware_Probe` identity.
`proc_0e8c` retained the fresh settings snapshot and validated the 6 GiB/2 CPU
bounds.
The guest transport is no longer a blocker.
The cover/light/200% combined and failed-trash fit controls captured in
`proc_7ccb`.
Both raw frames were inspected:
error copy,
Dismiss and the complete deck remain visible;
the combined Undo-bearing surface is over the list.
The final combined layout event records viewport bottom `979px` and toast
bottom `940px`,
a `39px` separation matching `16dp` at `390dpi`.
This is a bounded layout observation,
not native activation,
ink bounds,
universal fit or actual operation/recovery acceptance.
The initial panel/theme/font attempt retained nine inner/100% frames
before the owning emulator segfaulted with status `139`.
The capture task's separate terminal diagnostic was a bounded
`am force-stop` transport timeout.
No complete manifest or full-cohort acceptance exists for that partial
attempt and its artifacts remain private.
The emitter reported OpenGL ES Translator over
`llvmpipe (LLVM 22.1.8, 256 bits)` despite the requested `-gpu host` option.
No usable coredump was found for this visit;
nearby null-context messages do not establish the crash's deciding call.

The current SDK's freshly exercised GPU help advertises `swiftshader`.
A bounded current-37.2.12 software-renderer probe is starting with the
same owned AVD,
retained generated identity and 6 GiB/2 CPU bounds.
The historical 37.1.11 SwiftShader failure is not treated as proof about
this different installed build.
The original settings snapshot remains unchanged;
a new renderer's startup snapshot is separate.
The current SwiftShader probe reached authorized guest readiness and a
separate startup snapshot in `proc_0c26`.
The emitter explicitly reports Google SwiftShader;
the original restoration snapshot remains unchanged.
The first SwiftShader acquisition attempt rejected a renamed private-root
path before installation or any frame:
Node reported `ENOENT` for the absent settings path.
The consumer harness path is corrected without changing the emulator,
APK or original snapshot.
The renewed acquisition retains renderer/build provenance and final
post-stability layout diagnostics;
no initial cohort is complete yet.
Boot success does not prove that the earlier graphics failure is fixed.
New capture and interaction evidence still gates publication.

The human correction identified a workflow gap:
prioritize an available owned-device authorization prompt and verify its
matching key/transport before repeating boot watches.
This expected-action clarification stays in this plan;
no `AGENTS.md` edit is made this round.
The next action is the prepared cover/200% combined and failed-trash fit
controls,
then measured layout/interaction checks and the independent capture cohort.
The prepared cover/200% combined and failed-trash fit controls still run
before any full capture cohort.
Verification must establish stable fresh root/viewport rectangles,
LTR configuration,
finite contained overlay geometry,
measured action layout floors,
visible copy and per-scene row omissions.
Same-environment no-feedback and toast-only controls are required before
claiming unchanged player geometry;
post-Dismiss frames require new layout readiness checks.
Semantic rectangles remain distinct from visible ink and pointer activation.
Real storage actions and new IME/TalkBack work remain outside this study.
No user answer or new production permission request is blocking these
remaining authorized design steps.
The first-run captured APK and source revision remain immutable;
new builds are a separate light-feedback cohort.

[shared-media]: https://developer.android.com/training/data-storage/shared/media
