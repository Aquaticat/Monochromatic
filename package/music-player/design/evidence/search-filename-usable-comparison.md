# Search filename placement and visibility comparison

## Purpose and status

Task 139 completed the debug-only native comparison.
Task 140 published the evidence and verified the independent visual review.
Scoped rendered-document verification is the remaining publication gate.
Neither filename policy is selected.
The accepted Search A layout,
E2 information-only clearance,
inner folder browser and complete deck remain the baseline.
The cover remains full-width without an added deck.

The [actual-player baseline](search-filename-actual-player-baseline.md)
remains an incumbent comparison,
not a selection of Search filename policy.
D11's Settings example also selects neither dimension.
The [plan](../../../../doc/planning/music-player-search-filename-comparison.md)
keeps production Search,
parsing,
collision detection and matcher selection outside this work.

## Retained native cohort

The [witness manifest](../questions/evidence/search-filename-comparison-witnesses.json)
binds 64 initial views and six separately identified scrolled witnesses to
prototype revision `a5560abb223af9f700b9d9465eac1991a02aac07`.
The retained APK SHA-256 is
`6f69735270cce6a21e9f65d11822f8a0e774b9a41c432430774317dd1f510755`.
The matrix covers inner and cover panels,
light and dark themes,
and font scales 100% and 200%.

Every published image was inspected.
The system-status strip was removed;
bottom navigation remains.
Publication verified exact retained RGB,
opacity,
PNG dimensions,
only image-essential PNG chunks,
file hashes and rejection of a changed RGB byte.
Private original frames,
XML,
OCR and logs are not published.
The [layout record](../questions/evidence/search-filename-comparison-layout.json)
contains 320 ordered semantic title/support slots.
Within each matched panel/theme/font-scale group,
exact measured Search-header-region RGB is unchanged across options,
covering 64 initial views;
retained inner browser/deck RGB is unchanged across options,
covering 32 inner views.
This cross-option equality does not independently remeasure E2 clearance.
The raw comparison-region coordinates are retained in that record.
Two rejected earlier capture attempts and their APKs remain separate.
They are not evidence from the completed cohort.

The nine comparison fixture tests passed.
Fresh terminal-marker-removal and unknown-scene mutation tests failed with
the intended assertions,
then exact restoration,
complete unit tests and rebuild passed.
The manifest retains hashes of the positive and mutant test reports.
Fresh hierarchy destinations and explicit acquisition-success checks avoid
reading leftover XML after a failed dump.
No hierarchy retry occurred in the completed initial matrix.

## Placement held apart from visibility

The long placement pair retains exactly the same two authored filenames,
kind,
parent,
action,
order and membership.
Placement specifies where a retained suffix appears;
visibility separately determines whether an eligible suffix is retained.
Its alternatives are:

- Full literal filename in the title.
- Stem in the title and exact authored suffix in the supporting line.

Both keep `.flac` and `.mp3` visible in the inspected pair.
Moving the suffix changes its position and emphasis,
not the target's identity.
The literal-name comparison also includes equal complete `Cam.flac` names
with `Collection A / Live` and `Collection B / Live` context,
the indivisible folder `Camellia.flac`,
`Cam.mix.2026.FLAC`,
`.Cam.session.opus`,
Japanese text and the extensionless track `Cam`.
These are authored labels,
not indexed files or parser output.
Dots and literal suffixes establish neither kind nor encoding.

The measured long-title semantic heights were unchanged by placement:
118px at 100% on both panels;
412px inner and 309px cover at 200%.
Supporting-line heights were 49px at 100% and 182px at 200%.
These are hierarchy text rectangles,
not ink or action bounds.
The measurement does not promise that other filenames would wrap identically.

At 200%,
the initial inner full-title literal list clips the final `Cam` support;
the initial inner supporting-suffix list omits its final title and support.
The cover supporting-suffix list also needs scrolling to show its final row.
Six bounded scroll witnesses in both themes show the extensionless final
`Cam` with `Track · library root · Play`.
Their coordinate movement and changed-RGB controls establish visual scrolling,
not TalkBack gestures,
activation or universal row reachability.
The supporting placement adds wrapping to some literal-name supporting lines;
it is not a density improvement in this tested corpus.

## Visibility composes with either placement

The authored eligible label `Cam Solo.opus` is compared with `Cam Solo`.
The same-parent `Cam.flac` and `Cam.mp3` retain their cues.
Displayed `Cam Outside.flac` also retains its cue because an authored
same-parent `Cam Outside.mp3` partner exists outside the displayed subset.
The dotted folder remains literal.
Supporting placement has its own always-visible and conditional pair,
so the two questions can be answered independently.

Omitting the eligible suffix changes text,
not the measured title/support heights:
59px/49px at 100% and 103px/182px at 200% on both panels.
The fixtures supply membership and required-cue flags.
They do not evaluate a query,
assess an inventory or detect a collision.
Any conditional production policy would need independently established scope;
an unknown scope must not be presented as proven unique.
No implementation or universal disambiguation guarantee is established.

## Recommendation for review

### Placement

Full literal title keeps the name contiguous and its distinguishing suffix
at title emphasis.
It preserves more initial literal-list content in the tested 200% inner view.
Its cost is title punctuation and suffix text,
including when the name is long.
Supporting placement groups the suffix with kind and context and gives the
stem a cleaner title.
Its costs are weaker suffix emphasis,
separation of the literal name across lines and extra supporting-line wraps.
The long pair had no measured height saving.

Ranking:
full literal title > supporting suffix,
because the tested secondary placement buys no long-name height reduction
and costs initial literal-list visibility.
This is an evidence-led preference for correction or veto,
not acceptance.

### Visibility

Always-visible suffixes preserve information without relying on a uniqueness
assessment.
The cost is additional literal text on the eligible label.
Conditional visibility can remove that text where the relevant scope is
actually known and safe.
Its costs are scope-dependent behavior and the need to retain cues for
non-displayed partners or unknown scope.
No tested height reduction offsets those costs.

Ranking:
always visible > conditional omission,
because the authored omission reduced text but not vertical space,
while a real conditional policy needs knowledge the fixture does not supply.
This ranking selects no parser,
matcher,
collision algorithm or implementation schedule.

The deliberately ambiguous stem-only control is not a usable option.
Copying ordinary one-line rows is also not a substitute for the tested Search
alternatives:
the actual player retains long suffixes at inner 100%,
but clips them in the captured cover and 200% cases.
The ordinary player's wider context and real chrome must not be replaced by
a narrower replica when making that claim.

## Review and remaining boundary

Use the self-contained
[filename review](../questions/search-filename-comparison.html)
to inspect placement and visibility separately,
including their composition,
then answer both questions and the final free-text field.
The recommendation is not a preselected answer.
The review contains 102 checked images,
including the separately provenanced actual-player baseline.
Offline consumer verification decoded and opened each one,
exercised every form/viewer control,
checked independent and keep-open answers,
and confirmed that edited choices or notes invalidate a prepared reply.
Adversarial notes remained inert textarea text.
Desktop/mobile light/dark checks had zero A/AA axe violations,
incomplete checks or console errors.
Browser accessibility checks apply to the review page,
not native acceptance.
A committed disposable guard test failed when the exact-scroll-cohort
validation was removed from the copied builder,
then passed with the original builder.
Hash,
traversal,
metadata-agreement and changed-output rejection controls also passed.

This study establishes static debug presentation only.
It does not verify Search matching,
real source identity,
activation,
speech,
focus transitions,
actual 48dp result actions,
contrast acceptance,
suffix-query emphasis,
changing real inventory scope,
native packaging or live playback.
D75 to D80's accepted accessibility design direction remains separate from
native implementation acceptance.
Task 133 and the source-recovery work remain independently open.
The current run's fresh settings snapshot was restored,
then the owned runtime exited gracefully.
Container,
ADB target,
owning process and matching emulator process absence were verified;
this is not restoration of a prior run or the original AVD.
