# Software quality scale explorer

## Request and accepted scope

The user requested fixes to
`/var/home/user/Downloads/software_quality_scale_explorer (2).html`
and invoked the grilling skill.

The user confirmed the explorer primarily expresses and refines their software-quality philosophy.
Every existing catalogue rating and its stated reasoning is approved.
The custom/new-software rating algorithm is disputed.
The original request also identifies UX as needing repair.
Preserve the approved catalogue and use its reasoning as constraints on the replacement algorithm.

The assistant initially reopened the provenance and validity of existing ratings.
The user corrected that framing.
Do not repeat those questions or turn this into a universal product-ranking research project.

## Work items and completion criteria

- Algorithm: establish the remaining decision rules through grilling;
  implement explainable custom ratings consistent with approved reasoning;
  verify contradictory inputs, incomplete assessments, and endpoint conditions.
- UX: establish the custom-rating workflow;
  build and present concrete variants when asking visual-design questions;
  verify the chosen flow in a browser and preserve approved catalogue content.
- Delivery: retain the original as evidence;
  deliver the revised standalone HTML and record verification and output location.

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

## Browser verification status

The dedicated `agent-browser` session is `quality-explorer`.
Opening the file reported its expected URL and title.
Subsequent snapshot and evaluation commands observed `about:blank`, including commands in one shell invocation.
The captured image is blank and is not valid UX evidence.
Do not report the supplied page as browser-verified.
Resolve session/tab targeting or use a different browser bridge for the next verification pass.

## Design frontier

Settled: personal philosophy; approved catalogue ratings and rationale; custom algorithm and UX need fixes.

Open: whether custom answers should determine one score automatically or bound a judgment;
how nonzero defect severity constrains scores;
how to handle incomplete or conflicting answers;
custom-rating interaction and persistence needs.

Questions whose answers depend on algorithm authority or severity rules wait for those decisions.
No replacement model has been approved or implemented.
Next action: ask concrete questions about algorithm authority and severity without reopening approved anchors.

## Changes and commits

This handover is the first task file added.
No task commit or modified HTML has been produced yet.
