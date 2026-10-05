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
The study's explanation ends `After opening a library, choose whether to analyse it.`
(`first-run-access-witnesses.json`, `bodyText`),
which predates D84 and no longer matches it.
The published study is left unchanged,
because its review verification binds the page by hash;
correcting that sentence is a follow-up.

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
Captured prototype:
`a534bf5ac985e091cc93d6c663c24d72ad82a91c`.
Captured APK SHA-256:
`54603701d6b942128a23c9f070ad55c1283312321aa980daf50469e00cf80398`.
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
All 12 first-run tests passed.
Fresh unknown-scene and partial-zero guard-removal mutants failed the
intended targeted assertions;
exact restoration,
complete tests and APK build passed.
These are fixture proofs,
not native discovery or gesture tests.

## Captured cohort and visible boundaries

The owned disposable Fold captured 32 initial views across inner/cover,
100%/200% native text and light/dark.
Eight 200% post-swipe attempts were also acquired.
All acquisitions used fresh hierarchy paths,
exact dump success,
keyboard-closed and stable-app-frame checks;
no hierarchy retry occurred.

Post-swipe attempts were not automatically promoted to scroll evidence.
The first crop verifier rejected a repeated app image.
Separate classification found:

- Two inner no-source 200% frames with changed retained app RGB and a
  uniquely identified analysis body displaced vertically by 90 physical
  pixels.
  The full final paragraph was inspected in both themes;
  the title is partly cropped at the top.
- Six attempts with equal retained RGB and unchanged body coordinates.
  They remain private no-observed-movement controls,
  not proof of gesture delivery,
  inability to scroll or reachability.

The [witness manifest](../questions/evidence/first-run-access-witnesses.json)
therefore publishes 32 initial frames and two separately identified
scroll witnesses.
The original 40 private records and rejected partial crop output remain
unchanged;
verified crops were regenerated in a separate directory.

All complete published app-area regions were inspected,
including unused left-side area and bottom navigation.
The paragraph's first and last lines were inspected in the full scrolled
images.
Native `Open a folder` and Settings lettering remains visible in the
initial authored states.
This does not verify their actual actions,
48dp action bounds,
contrast or accessibility focus.

The initial inner no-source 200% body has a clipped semantic rectangle;
that alone does not establish that glyphs were missing.
No visible-ink recovery claim is made.
The scrolled images demonstrate bounded movement and final-paragraph
visibility,
not simultaneous full-heading visibility or universal navigation.

Status strips were removed at 136 inner pixels and 151 cover pixels.
Retained sizes are 2076 × 2016px and 1080 × 2273px at 390dpi.
Exact retained RGB,
changed-byte sensitivity,
opacity,
essential PNG chunks,
dimensions and hashes passed.
No app text entered the removed status strips in the hierarchy census;
that is not an ink-bound measurement.
Raw status-bearing frames,
hierarchies and logs remain private.

## Review and lifecycle

[The first-run evidence review](../questions/first-run-access.html)
uses settled actions and optional observations only.
It is not a request to select among state witnesses.
Its build,
consumer and rendered-document verification are publication gates,
not a user-answer gate.
[The verification summary](../questions/evidence/first-run-access-review-verification.json)
pins the artifact,
builder and native manifest.
All 34 images decoded and opened in the first desktop/light interaction pass.
Availability combinations,
optional empty/blank observations,
inert adversarial notes and representative modal/zoom/pan/focus controls
were separately exercised in each desktop/mobile light/dark context.
Four closed-page A/AA axe audits had zero violations or incomplete checks;
no console errors or document overflow were observed.
No open-dialog axe audit or Firefox acceptance is claimed.
Visible closed-page controls met the verifier's 48CSSpx minimum.
Modal size minima were not independently measured by this consumer script.

The first implicit preview click missed a partly visible target.
Explicit center scrolling before trusted native input passed the complete
consumer check without changing the page or native images.
[The bounded source diagnosis](../../../../doc/troubleshooting/agent-browser-partial-target-center.md)
records the separate zero-offset control and its verified workaround.
Fresh exact-cohort and scroll-signal guard-removal tests failed their
intended assertions,
then restored consumer tests passed.
These checks verify this artifact,
not source recovery or native accessibility.

The native runtime was capped at 6GiB/2CPU.
The fresh snapshot's recorded font 1.0,
light appearance,
reported panel identifier 2,
accessibility off/services null and stay-on value 1 were restored and
read back.
The owning container exited gracefully;
container and matching emulator process absence were verified.
Separate device base-state and override configuration were not retained
individually,
so full equality of that configuration is not asserted.
This is not restoration of an earlier runtime or the original AVD.

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
The next substantive design item is the single IntelliJ-aligned keyboard-map
revision already requested in `open-questions.md` section 6.
It remains design-only,
not authorization for production shortcuts or live playback.
