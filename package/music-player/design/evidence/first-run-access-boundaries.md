# First-run access and scoped no-audio design evidence

## Purpose and authorization

The human directed continued substantive design work after the filename
question was withdrawn.
This study advances D10's unresolved no-system-library/declined-source
surface using D10/D27's settled actions,
not another cosmetic ballot.
It changes no production code,
source-status API,
real library,
original AVD,
Search policy or template default.
No new IME or TalkBack experiment was performed.

The [continuation plan](../../../../doc/planning/music-player-first-run-access.md)
records fresh source findings and the independently verifiable queue.
D10 supplies `Open a folder`,
in-app Settings and an up-front explanation of analysis.
D27 supplies automatic use of an available system library and a separate
choice before full-library analysis.
No scan/dismiss answers are changed.

D84 (2026-10-05) supersedes that separate choice:
true-peak analysis is automatic and not optional,
so no ask-before-analysing prompt and no scan/dismiss answer remains.
The study first published here ended its explanation with
`After opening a library, choose whether to analyse it.`,
which D84 contradicts.
That study was left alone at first on the ground that its review verification bound the page by hash.
D88 (2026-10-05) rules that out:
nothing is locked by hash.
The study was rebuilt and republished the same day.
Its explanation now reads
`True peak is measured automatically for every audio file. Analysis uses CPU and battery; playback remains available while it runs.`
That wording is study copy that no decision chose;
D84 decides only that analysis is automatic and not optional,
and when analysis runs is undecided.

## Fresh source boundary

The source audit at `0c391a82556eeda61a285de2d70c1270fbc8994d` found
separate limitations,
not one common failure:

- `MainActivity.appRoot` renders only the broad audio-permission gate when
  that permission is absent,
  even though `LibrarySource.load` prioritizes a held folder grant.
- `LibraryRoot.heldRoot` clears a saved URI without a live persisted grant;
  its absent result does not distinguish revoked from never chosen.
- Whole-folder failures and skipped child reads can produce empty/partial
  track lists without an equivalent complete/partial/failure UI outcome.
- The launch path's automatic initial analysis has a separately accepted
  provisional runtime in `package/music-player/android-app/DECISION.peak-sweep-parallelism.md`,
  with better launch UX deferred.
  It is not labelled an unauthorized regression or reverted here.

The exact executable branches and current operation owners are cited in
the continuation plan.
No real picker,
permission recovery,
Settings-return refresh or analysis-consent transition was exercised.
A folder change changes source scope;
it is not repair of the previous source.

## Authored native fixture

The owned branch `prototype/music-player-first-run-access` starts from
`a5560abb223af9f700b9d9465eac1991a02aac07`.
The first publication captured prototype
`a534bf5ac985e091cc93d6c663c24d72ad82a91c`.
The rebuilt study captures prototype
`61e2cf7764f627d40a77bdf6039143e229ad36ea`,
which changes only the explanation's wording,
with APK SHA-256
`c6d6e9b38faee5895881b87cf055343d9904f4ab4d9b765aeecfdbd10f68521b`.
The commit and digest say what produced the captures;
nothing is checked against them (D88).
This is a different source boundary from the current-production audit,
not a current `MainActivity` equivalence claim.

`FirstRunAccessActivity` inherits `ComponentActivity`,
not `MainActivity`.
The merged debug manifest disables the production launcher,
playback service and sweep service and removes automatic WorkManager
initialization.
Per-frame service dumps and private launch logs showed no observed
playback or sweep service during the accepted frames.
The native buttons have private debug callbacks only;
no real source operation is connected or accepted.
Their callback activation was not studied.

Exact states are:

- Device-wide music access declined,
  with no held source and `Open a folder` as the primary route.
- No source opened,
  without claiming that Android lacks a MediaStore provider.
- An explicitly authored complete device-music-library read with no
  eligible audio,
  not proof that the device has no music or files.
- An explicitly authored complete chosen-folder read with no eligible
  audio,
  naming only that folder and keeping source changes explicit.

The host-JVM fixture tests cover those scene branches,
complete/zero audio,
complete/nonzero audio,
partial reads with and without results,
failed/unread scopes with both counts,
unknown coverage,
negative counts and unknown scene rejection.
All 12 first-run tests passed,
and passed again on the rebuilt prototype.
Fresh unknown-scene and partial-zero guard-removal mutants failed the
intended targeted assertions on both;
exact restoration,
complete tests and APK build passed.
These are fixture proofs,
not native discovery or gesture tests.

## Captured cohort and visible boundaries

This section describes the rebuilt study.
The first publication's cohort,
with its two scrolled views,
is in git history.

The owned disposable Fold captured 32 first views:
the four authored states on the inner and cover panels,
in light and dark,
at 100% and 200% native text.
Every acquisition used a fresh hierarchy path,
a successful dump,
a closed keyboard,
stable app frames and a host created exactly once since its launch.
No system dialog had to be answered in the captures that were kept.

After each first view the content was dragged upward until app pixels
stopped changing.
No view moved,
on either panel at either text size,
so the rebuilt study has no second views.
A second,
independent reading agrees:
no captured hierarchy marks a container as scrollable.
That reading can show a difference.
In the first publication's private hierarchies,
the one state that moved (inner panel,
no source,
200% text) carries the mark,
and the states that did not move carry none.
With the shorter explanation the content fits:
on the inner panel at 200% text the explanation's rectangle ends at 2002
physical pixels,
above the navigation area that begins at 2074.
An unmoved state is still not evidence that a gesture was delivered.

The captures span two emulator boots.
The first boot ended in a segmentation fault of the emulator after twelve
complete states;
the second captured the remaining twenty.
Each view in the
[witness manifest](../questions/evidence/first-run-access-witnesses.json)
names its visit.
Both boots ran the same installed APK,
and each view was checked in its own environment.
The crash is recorded in
`doc/troubleshooting/android-emulator-37-software-renderer-sigsegv.md`.

All 32 published app-area regions were inspected in full,
as light and dark pairs,
including the unused left side of the inner panel and the navigation area.
Every view draws its title,
body,
`Open a folder` and Settings;
the two analysis states also draw the heading and the new explanation,
and no view draws the withdrawn sentence.
At 200% text nothing is cut off on either panel.
One view,
`first-run-access-inner-declined-light-s100.png`,
shows no gesture handle in the navigation strip.
It was the first capture of its visit and the cause was not established.
This inspection does not verify the buttons' actions,
48dp action bounds,
contrast or accessibility focus.

Status strips were removed at the height the system reported for each panel:
136 inner pixels and 152 cover pixels.
Retained sizes are 2076 × 2016px and 1080 × 2272px at 390dpi.
The first publication cut the cover at 151 pixels on a different emulator image.
Exact retained RGB,
changed-byte sensitivity,
opacity,
essential PNG chunks and dimensions passed.
No digest is recorded or compared (D88).
Raw status-bearing frames,
hierarchies and logs remain private.

## Review and lifecycle

This section describes the rebuilt study.

[The first-run evidence review](../questions/first-run-access.html)
uses settled actions and optional observations only.
It is not a request to select among state witnesses.
It says that analysis is automatic and not optional,
and it shows a second view only where content moved,
which is nowhere in this cohort.
[The verification record](../questions/evidence/first-run-access-review-verification.json)
says what was checked and with what result.
It holds no digest (D88).

The builder derives the cohort from the captures and checks each image's
geometry and drawn text from the image and its record.
It refuses a view that draws the withdrawn sentence,
a no-audio state that explains analysis,
a missing state,
and a drag outcome that disagrees with the kept views or with the
hierarchy's scrolling mark.
The consumer test rejects 13 changed manifests,
accepts a synthetic second view with a displaced body and refuses one without,
and rejects a ballot,
the withdrawn sentence in the page and a changed output.
With each of three named guards deleted from a disposable builder,
the test failed on the matching rejection;
restored,
it passed.

All 32 images decoded and opened in an offline Chromium check.
The shown views,
the drag status line,
optional empty and blank observations,
inert adversarial notes and one modal with zoom,
pan,
reset and focus return were exercised in each of four contexts:
desktop and phone width,
light and dark.
Four closed-page A/AA axe audits had zero violations or incomplete checks;
no console errors or document overflow were observed,
and visible closed-page controls met the 48 CSS pixel minimum.
A desktop light and a phone dark screenshot were looked at.
No open-dialog audit or Firefox acceptance is claimed.
These checks verify this page,
not source recovery or native accessibility.

The native runtime was capped at 6 GiB and 2 CPUs.
The first boot ended in an emulator crash before restoration.
Its stale lock files were moved to a backup after no owner was found,
as `doc/troubleshooting/android-emulator-37-disposable-avd-lock-after-hard-stop.md`
prescribes.
The second boot first read a text size of 200%,
left by the crash,
captured the remaining states,
restored the recorded fields to the first visit's baseline
(text size 100%,
light appearance,
panel opened,
accessibility off) and read them back.
The owning container exited with status 0,
and container and matching emulator process absence were verified.
Whether the restored text size persists is shown only by the next boot's
first reading.
Separate device base-state and override configuration were not retained
individually,
so full equality of that configuration is not asserted.

## Remaining implementation gate

Design evidence does not create production source-status outcomes or
permission recovery.
Binding each state needs complete/partial/failure provenance for the
assessed scope and the current source identity.
Picker cancellation must not be treated as source success.
Changing a folder must not silently widen it to device-wide media.
No production implementation or default-template selection is authorized.

No new preference question is justified by this study.
The human closed custom Android media-notification design in D82:
accept the standard platform presentation.
No notification variants or visual preference question follows.
When this study was first published,
the next design item was the keyboard-map revision in `open-questions.md` section 6.
The current queue is in `HANDOFF.md`.
