# Software quality scale explorer

## Request and accepted scope

The user requested fixes to
`/var/home/user/Downloads/software_quality_scale_explorer (2).html`
and invoked the grilling skill.

The user confirmed the explorer primarily expresses and refines their software-quality philosophy.
Every existing catalogue rating and its stated reasoning is approved.
The custom/new-software rating algorithm is disputed.
The original request also identifies UX as needing repair.
The user delegated decisions Q3 and Q4 to the assistant:
how independent defects compound and whether the output may remain a range.
Preserve the approved catalogue and use its reasoning as constraints on the replacement algorithm.

The assistant initially reopened the provenance and validity of existing ratings.
The user corrected that framing.
Do not repeat those questions or turn this into a universal product-ranking research project.

## Work items and completion criteria

- [x] Algorithm: resolved delegated decisions;
  implemented explicit ordinal comparisons with endpoint obligations;
  verified contradictory inputs, incomplete assessments, and endpoint conditions.
- [x] UX: implemented and browser-verified the custom-rating workflow,
  reference browsing, responsive layout, reset, and export;
  preserved approved catalogue content.
- [x] Delivery: retained the original;
  delivered the revised standalone HTML in Downloads and opened it in Helium.

## Source evidence

Original HTML source locations:

- Line 283 stores catalogue ratings independently of the calculator.
  Independence does not invalidate the user-approved ratings.
- Line 284 defines eight criteria and numeric weights totalling 10.4.
- Lines 285 and 286 define endpoint gates.
- Lines 440 to 462 average answered criteria and round to an integer.
  Primary contract at 0 with all other criteria at 10 gives
  `82 / 10.4 = 7.884615...`, rounded to 8 if hard gates remain unselected.
  This conflicts with the criterion's statement that strengths cannot compensate for defining-task failure.
- Lines 346 to 362 attach score selection to numbers;
  lines 402 to 429 show the selected definition after the choice.
- Line 480 attempts `classList.add("")` while 10 eligibility is visible but gates are incomplete.
  Source audit identified this runtime-error path; browser reproduction remains pending.
- The approved catalogue contains severe maintenance/community deductions, including Zed at 1.
  An ordinary weighted average is insufficient to encode such vetoes by itself.
  Do not invent criterion scores for existing products to claim an exact calibration failure.

The independent `audit_quality_logic` agent verified the numerical counterexample from parsed source.
Neither agent has changed the original HTML.

## Implemented decisions

The replacement is `doc/artifact/software-quality-scale.html`.
It is standalone HTML with inline CSS, JavaScript, and the original catalogue records.
The original Downloads file is retained.

The custom algorithm uses explicit ordinal comparisons with approved references.
For example, higher than VS Code at 6 and lower than Neovim at 8 permits only 7.
It intersects integer bands, applies defining-failure obligations and requirements for 10,
and exposes contradictory answers instead of averaging them.
No per-criterion weights, decimal averages, or inferred midpoint remain.

Compounding is handled through judgment of the complete product with all independent consequences present.
Notes explicitly distinguish an underlying defect from its repeated symptoms.
The software does not infer severity from text or invent a numerical penalty per defect.
This is a deliberate limit:
the user supplies comparative judgments;
the algorithm checks their consequences.

The OpenClaw rationale is represented by an additional defining-failure check for
purpose-defeating privileged orchestration machinery.
This derives from the approved example and does not assign a general zero to broad scope.
Every other reference field is retained verbatim, including its original status label.

Missing endpoint checks remain unknown.
Name/job changes clear old endpoint checks.
Edited notes invalidate confirmation of the whole-product review.
Confirmed defining failures require 0 but conflicting positive comparisons stay visible and block completion.
Removing a saved comparison preserves an unrelated current draft.
After a decisive comparison, the UI retains it for review instead of suggesting an irrelevant next reference.

The interface provides reference search, category/score filtering, ordering,
qualitative notes and comparison reasons, reviewable constraints, explicit reset confirmation,
and a downloadable assessment containing provisional status and all reasoning.
The desktop result panel stays within the viewport.
On narrow screens, a compact result link precedes the form;
the full result follows the inputs.

## Browser verification status

The dedicated `agent-browser` session is `quality-explorer`.
Opening the file reported its expected URL and title.
Subsequent snapshot and evaluation commands observed `about:blank`, including commands in one shell invocation.
The captured image is blank and is not valid UX evidence.
The browser bridge agent traced the reset to inconsistent launch flags.
The required flag set is
`agent-browser --session quality-explorer --allow-file-access --pin-tab` on every invocation.
See `doc/troubleshooting/agent-browser-launch-option-reset.md` for source and positive/negative controls.

Completed verification of the replacement:

- Parsed catalogue deep-equals the original data, including all 36 records and every field.
- Script syntax and pure-model probes passed for blank and complete assessments,
  ranges, exact bracketing, missing checks, every zero/ten rule,
  all 33 score/relation boundary combinations, and duplicate-comparison invariance.
- Browser controls reproduced the supported 7 example,
  an unconfirmed and confirmed 10,
  failed-ten conflicts,
  incompatible comparison/zero handling,
  context invalidation,
  and draft retention when another saved comparison is removed.
- All score filters, category filtering, search, empty state, sort orders,
  reference selection, skipping, and method navigation were exercised.
- At 320 and 375 CSS pixels, both views have document scroll width equal to viewport width.
- Axe-core 4.12.1 reported zero violations and zero incomplete findings for
  the desktop dark assessment,
  mobile assessment,
  desktop light catalogue,
  and desktop light assessment states tested.

An immediate reset assertion ran before the native dialog close event completed.
The following observation showed the cleared state.
Final reset verification must wait for that rendered state rather than infer failure from a timing race.

The initial download-tool invocation timed out without producing the expected saved file.
Independent unplaced and populated assessment downloads then succeeded without changing the export code.
The populated export exactly matched `assessmentText()` bytes and preserved Unicode and literal markup-like text.
See `doc/troubleshooting/agent-browser-assessment-download-check.md`.
No cause is assigned to the isolated timeout.

Final reset checks used the native dialog buttons and Escape,
then waited for the cleared name input before asserting `Unplaced`.
Escape retained the entered fixture name;
confirmed discard cleared it.

The final mobile layout has one navigation row at 375 CSS pixels,
with the input form beginning at approximately 390 CSS pixels from the viewport top.
This replaces the measured approximately 642-pixel form start before compacting the navigation and header.
The method view also passed axe-core with zero violations and zero incomplete findings.
The modal had zero violations and one unresolved automated contrast finding;
the browser bridge agent checked the actual rendered paragraph separately.
Its dark-theme foreground/background contrast was 13.455:1,
with an opaque background and no element visually covering the paragraph.
Its light-theme contrast was 14.421:1,
also with an opaque background and the paragraph first in the hit-test stack.
Both modal screenshots were inspected without clipping or overlap.

## Design frontier

Settled: personal philosophy; approved catalogue ratings and rationale; custom algorithm and UX need fixes.

Q3/Q4 are delegated and resolved through complete-product comparisons and explicit candidate ranges.
The replacement is implemented within the requested standalone scope.
No request to revise existing reference judgments or research a universal ranking is open.
The finished copy is `/var/home/user/Downloads/software_quality_scale_explorer_fixed.html`.
It was compared byte-for-byte with the repository artifact.
Both have SHA-256 `554f6516ccc33b5c7b329070566adf8e81509c54e2878e2361ee83e698e37103`.
The supplied `(2).html` file is retained unchanged.
Final pure-model probes passed after all edits,
including explicit conflicts between confirmed zero and positive comparisons,
every missing-ten condition,
model purity,
and delivered-copy/catalogue equality.

The Downloads copy is open in Helium 0.16.5.1,
with Rate new visible, empty assessment inputs/comparisons,
every gate unknown, modal closed, and scroll at the top.
KWin confirmed activation with `active=true`, `minimized=false`,
and output `DP-3` matching the current output.
The final screenshot is `~/temp/agent/quality-helium-final.png`.
Later browser `document.hasFocus()` returned false;
the handoff evidence establishes activation at its measured moment,
not sustained keyboard focus.
The user-facing Helium session `quality-helium` remains available on CDP port 44673,
window PID 2333943.
Disposable `quality-explorer` and `quality-export` verification browsers were closed.

No implementation or verification work remains.

## Changes and commits

- `9f18a50eb`: approved rubric and repair scope.
- `7916cf873`: browser launch-option reset diagnosis.
- `0e33b6b5f`: reference-based custom assessment and revised standalone explorer.
- `84eabfc63`: stale-state protections, accessibility, and responsive result handling.
- `db9cbf49d`: compact mobile navigation and recorded verification.
- `1ce57f623`: verified export controls and isolated-timeout record.
- `e594284a8`: final model and delivery checks.
