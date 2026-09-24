# Settlement experiment UX redesign

Status: after the source-and-browser audit, the user delegated the best remedy.
The chosen direction keeps the existing manual `Promise.withResolvers()` experiment and its
reply-shaped values, using Yum-Bot only as bounded visual inspiration.
No separate faithful game panel or new physical pudding-delivery contract is planned.
The old focused clarity review remains a preserved prototype; the mapping redesign is in progress.
The lesson file is untouched.
No skill design has been confirmed; this redesign feeds the Promise toy, not the teaching skill.

## Latest screenshot-driven clarity repair

User screenshot: `/var/home/user/Pictures/Screenshots/Screenshot_20260923_221217.png`
(1889 by 1482 physical pixels). OCR exposed repeated multiline `used: called...` captions
under the numbered controls. Direct image attachment was unavailable to this agent,
so the visual analysis used OCR, browser geometry, and matched-viewport captures;
do not claim a fresh human-quality bitmap inspection from that evidence.

`mise run probe:ux-clarity-before` exercised the preserved before-version at a 944 by 741 CSS
viewport with three released puddings, two settled belt chips, and ignored calls.
Its red assertion and measured state:

- Factory scene 581 CSS px tall; whole stage 820 CSS px tall.
- Every one of the 15 button captions wrapped; the longest held 78 characters.
- Release rail had no visible action title; current state card sat below the scene.
- The screenshot text gave the same repeated-call and numbering pattern.

Ranked causes were repeated call histories inside the buttons, unnamed release rail and
late state card, then lack of one contextual next-action instruction.
The corrected shared scene now:

- Shows the current pudding/Promise identity and fixed status before the controls;
  keeps this existing card sticky while the learner scrolls the stage.
- Names Release as creating a new Promise, Hand as fulfilling, Laser as rejecting,
  and explains that button numbers count calls within their own action row.
  The conveyor names earlier Promises separately.
- Replaces long per-button histories with `Used`, `Later`, `Wait`, `Drop`, `Settle`, or `Try`;
  the full reason remains in the accessible name and the chronological log.
- Gives one contextual guide recommending the *opposite* resolver after settlement,
  which discriminates first-call-wins from repeating the same value.
  Before releasing a pudding with no tools left, the guide visibly warns that it will remain pending.
- Adds one latest-event card inside the scene: an ignored call is acknowledged next to the
  controls while the current Promise's face and marking remain fixed.
- Keeps the current pudding's resolver bundle and inner Promise cards visible.
  Additional current views and earlier views are grouped in native disclosures;
  `beforeprint` expands them and `afterprint` restores their on-screen state.
  The 24-view bound retains the current bundle and Promise even if earlier entries rotate out.

`mise run test:ux-clarity` went green on the screenshot-state path:
scene 471 CSS px, stage 735 CSS px, no multiline control captions, visible rail title,
current state before the scene, and nearby latest-event card.
At 944 by 741 CSS px, an ignored Laser 3 click kept the face at y=8
and the event card within the viewport; at 390 by 741 CSS px, a later ignored Laser 4 click
kept the sticky face, clicked button, and event card visible without horizontal overflow.
`mise run review:ux-clarity-comparison` captured preserved before and revised after scenes at
matching 944 by 741 CSS viewports in `ux-variants/clarity-side-by-side-944-dark.local.png`.
OCR of the revised capture reads the state, next-action guide, short button statuses,
latest event, and earlier Promise labels in that order.

Focused user review: `ux-variants/settlement-scene-clarity-review.local.html` is a
self-contained HTML document (not a screenshot). It pre-runs the user's three-pudding state;
Laser 3 remains live for the discriminating ignored-call test.
The artifact states what changed, what to inspect, and asks for any still-confusing row,
label, or relationship in chat; no A/B/C cell choice is needed yet.
`mise run test:ux-clarity-review` exercised Laser 3, two native value disclosures,
light/dark mobile/desktop captures, and a PDF whose text retained hidden-on-screen history.
`mise run test:firefox-ux` passed on Firefox ESR 140.16.0 for both the standalone scene
and the focused self-contained review.
`present-ux-clarity-review.mjs` opened the latest focused review in a separate headed Helium tab,
retaining the two tabs observed immediately before that presentation (three tabs afterwards).
The active title is "Settlement factory: clear controls (latest review)";
`ux-clarity-review-handoff.json` records its URL, example state, and system dark mode.
The earlier focused tab was not reloaded or closed.

## Origin and measured defects

The user photographed the settlement section of the lesson
("Supply one outcome, then try to replace it" plus the three state cards above it)
and called it confusing: `/var/home/user/Pictures/Screenshots/Screenshot_20260917_210251.png`.
`probe-settlement-ux.mjs` reproduced that state (Reject, then a futile Fulfill)
at 1008 CSS px dark in a disposable headless session and measured:

- Hidden code: the Pending card's code line needs 347 px but its box offers 266 px
  (331 px at 1280 px), and the overflow scrollbar is an overlay, so nothing signals more content.
- Distance: the live highlight sits 326 px above the buttons (601 px at 390 px),
  so a click changes cards that are usually off-screen while a differently worded badge repeats the state.
- Color: the active card background is the accent tint `#253e37` (dark) for every state,
  so a rejected Promise reads green.
- Prose: the snapshot preamble is one 352-character sentence carrying five numeric limits.
- Context: nothing near the cards says the highlight tracks the experiment below.
- Controls: the lesson CSS defines `button:disabled` and `:focus-visible` but no `:active` rule,
  and the settlement buttons look identical before and after the outcome is fixed.

Later user rounds added requirements, each implemented in the prototypes:

1. Buttons must show when and whether they were clicked and whether another click can do anything.
2. A click that would do nothing must be a disabled button; repeatable actions get five pre-baked
   numbered one-shot buttons per action, labeled 1 to 5.
3. Follow the Rhythm Heaven Groove Yum-Bot Simulator model; the presentation may be a matrix.
4. Draw the robot, conveyor, containers, and puddings in HTML/CSS
   (reference: `/var/home/user/Downloads/600px-Screenshot_Switch_Yum-Bot_Simulator.png`).
5. The buttons belong inside the drawn scene, not in a separate rack.
6. "Drops a new bot" was off-model; the pudding is the Promise (game-faithful remap).
7. The resolver-bundle and inner-Promise snapshot cards must not be omitted; they are restored.

## Research: Yum-Bot Simulator (corrected reading)

Source: [RHWiki's Yum-Bot Simulator gameplay and timing-display descriptions][yum-bot]
(Rhythm Heaven Groove, Stage 5, 23rd game; Japanese Sotto Catch).
The earlier reading omitted consequences that change the mapping:

- The game supplies *already normal or defective* puddings with different audio/visual cues.
  The player responds to that supplied type; choosing a tool does not make a pudding defective.
- A correctly caught normal pudding is placed automatically onto the conveyor immediately.
  A correctly lasered defective pudding is obliterated, not sent down the belt intact.
- The robot's green smile means a correctly timed catch **or** laser; yellow and red grade
  early/late or missed actions. The face does not encode fulfilled versus rejected Promise state.
- The line manager judges the robot's decisions, not the eventual Promise value.

The production-line artwork remains useful evidence for layout and feedback,
but its timing, routing, and physical-object semantics cannot be claimed by the current prototype.

## Current prototype mapping (disputed, not game-faithful)

The assistant introduced pudding-as-Promise after the user asked where the pudding was.
That question did not ratify this mapping.

- The pudding is the Promise: a numbered lever on the rail releases it (creates the Promise),
  it falls from the hatch and sits at the station plate pending.
- The robot is the settling agent with two tools: the hand catches the pudding with the
  "Hello Ada" topping (fulfill); the laser etches the "No reply" reason (reject).
  The first tool press settles; fresh tools may call a resolver again and log the ignored attempt.
  The marking (cherry dot or exclamation etch) never changes again.
- When the next pudding drops, the settled one rides the conveyor as a chip
  (pudding cone plus marking plus text). This is a history queue, not the game's conveyor:
  a catch does not move immediately, and a lasered pudding remains intact before joining it.
- The drawn robot face reflects pending/fulfilled/rejected (flat/smile/frown),
  not the game's timing/decision grade;
  the accessible `#bot-face` card precedes the scene and stays visible while the learner scrolls it.
  Print hides the drawn scene but keeps that card, the contextual guide, and the call log.
- Controls are five numbered one-shot buttons per row (release, fulfill, reject), drawn inside the
  scene as lever, mitt, and eye-beam. Availability reasons: used, would do nothing, future, live;
  drawn states are faded, dashed case, empty hook, and swaying; pressing squashes the hook.
- Value snapshots: the resolver bundle and the Promise inside it render as cards with
  `JSON.stringify(value)` and `show(value) from showify`, using the audited showify 0.2.8 bundle.

## Factory logic audit (unresolved)

The user said the scene's logic seemed wrong and requested a double-check, not an implementation.
No prototype or lesson behavior was changed during this audit.
`mise run probe:factory-logic` opens fresh hand-first and laser-first routes in a disposable browser.
Its game-faithfulness assertion is intentionally red:

- Neither route has a supplied normal/defective kind or cue before the choice.
  The code's `perform` branch creates an untyped `Promise.withResolvers()` bundle;
  the action decides which resolver is called.
- After Hand 1, the pudding remains visible at the station, the belt count is zero,
  and the face says fulfilled. Release 2 alone moves that pudding onto the belt.
  The source game moves a correctly caught normal pudding immediately.
- After Laser 1, the pudding remains visible with an etch, the belt count is zero,
  and the face says rejected. Release 2 then puts the intact rejected pudding on the belt.
  The source game obliterates a correctly lasered defective pudding.
- A green smile for fulfillment and a frown for rejection grade the Promise outcome,
  whereas the source game grades both correctly executed actions with a green smile.
- Fresh tools can call resolving functions again on the processed pudding.
  That is useful and accepted for the Promise experiment, but the game description supplies
  no second physical processing step for the same departed or destroyed pudding.
- `build-ux-choice-form.mjs:71,160` cites the game's colored timing faces as a reason to color
  fulfilled/rejected Promise cues. That maps action grades onto different semantics;
  the existing layout/color ranking must not be treated as accepted.

The probe reports the separate authored policy that Release 2 is disabled while Promise 1 is pending.
It is not evidence of a Promise restriction or, alone, a game contradiction.
The actual JavaScript experiment still calls native resolvers:
`verify-ux-resolver-calls.mjs` recorded Reject, Resolve, Reject on one bundle,
while its native observer reported only Rejected. For the fixed string and Error fixtures,
that correctly demonstrates the first outcome staying fixed.
[MDN's `Promise.withResolvers()` reference][withresolvers-mdn] confirms the bundle exposes
one Promise with resolving functions retained in scope.
Correct Promise calls do not make the physical analogy correct.

The deeper issue is one drawn pudding representing the Promise identity,
the physical material the robot catches or destroys, and the outcome marking.
Those roles need not share a lifetime. A rejected Promise still exists for observation;
a correctly destroyed defective pudding does not.
An ignored resolver call does not prevent other code from doing physical work.
The prior claim that a consumed game pudding makes repeated Promise calls impossible was too strong:
the resolver functions can target a durable record after a physical pudding has departed.

### Corrected contract and proposed directions

The lesson source at `/home/user/temp/agent/promises-revision/promise-sequence.html:84-99` says
`Promise.withResolvers()` starts no timer or service, calls the section a *manual settlement
experiment, not a service request*, and uses `"Hello Ada"` or `Error("No reply")`.
Neither outcome is an edible pudding, and no real shop network request is performed here.
A physical pudding-delivery ticket would require changing the operation and payloads;
that is a new lesson-contract decision, not a cosmetic fix.
The earlier recommendation to use a pudding-delivery ticket without accounting for these
values was wrong. The independent advisor identified that gap; the cited lesson source
confirms it. The remaining direct question is how much literal Yum-Bot behavior to retain
without changing the already authored reply-shaped settlement fixture.

1.  **Honest, Promise-first factory with bounded Yum-Bot inspiration (recommended).**
    Keep the manual `Promise.withResolvers()` experiment and its values.
    Use factory artwork and a drawn control surface, but call the belt outcome history,
    the face an observed Promise-state display, and Hand/Laser resolver-control icons.
    Stop describing physical catching, laser destruction, and game timing grades as implemented.
    **Pros:** preserves the meaningful reply-shaped values and first-settlement-wins teaching
    without inventing a physical operation that produces `"Hello Ada"`.
    **Cons:** no longer follows the source game's causal choreography;
    some artwork may need replacement to avoid implying physical actions.
2.  **Separate faithful game illustration from the unchanged Promise experiment.**
    Show normal/defective cues, immediate belt placement or destruction, and action grades
    in a clearly separate game panel; keep the manual resolver experiment independent.
    **Pros:** neither causal model needs to pretend to be the other.
    **Cons:** adds a second system and more teaching surface to a Promise-focused lesson.
3.  **Physical pudding plus Promise ticket (requires new contract approval).**
    The pudding is a supplied job and the Promise a durable delivery/processing ticket;
    later resolver probes target the ticket, not the pudding.
    **Pros:** can preserve game choreography and repeated resolver calls in distinct layers.
    **Cons:** the current `"Hello Ada"`/`Error("No reply")` outcomes and manual-service boundary
    do not describe that ticket; changing them changes the lesson, not just its visuals.
4.  **Promise of correct game-turn execution (requires new contract approval).**
    Both correct Hand and correct Laser fulfill; wrong or missed actions reject.
    **Pros:** aligns the face's game-performance grade with the Promise contract.
    **Cons:** reverses the current Hand=fulfill/Laser=reject teaching setup and introduces
    timing/classification into a Promise lesson.

Ranking for the existing fixture: honest factory inspiration > separate faithful illustration >
physical ticket contract rewrite > game-turn-success contract rewrite.
The honest factory keeps one coherent Promise experiment better than two parallel systems;
separating the game is less invasive than changing the established values and operation;
a physical ticket retains more of the existing resolver pairing than a turn-success Promise.
The audit itself authorized no implementation. The subsequent user instruction
"Do whatever is the best" delegated the choice; the chosen direction is recorded next.

The user's logged-ignored-attempt decision remains settled.
The already authored manual experiment determines its reply-shaped values and no-service boundary.
Ask whether the user wants literal game behavior kept in a separate illustration,
or the game used only as visual inspiration for the unchanged experiment.
Real-time rhythm timing is not entailed by either choice and should not be added unasked.
Only then revisit layout and cue color.

## Chosen boundary after the user's delegation

The manual settlement section at
`/home/user/temp/agent/promises-revision/promise-sequence.html:84-99` is the fixed contract:
no service request, one `Promise.withResolvers()` bundle, learner-controlled `resolve("Hello Ada")`
and `reject(new Error("No reply"))`, then an actual ignored later call.
The Promise is a durable handle for that toy result, not an edible pudding or a quality grade.

The redesigned scene will use Yum-Bot's visual vocabulary only:

- A stable, numbered **Promise ticket** is the workpiece representing object identity.
  It does not acquire a publicly readable outcome mark.
- The separate **observer display** reports the lesson-owned state and value/reason.
  The robot's decorative face stays neutral rather than calling rejection a missed game action.
- The belt is labeled **earlier Promise records**, not the game's conveyor of caught pudding.
  Rejecting cannot destroy a Promise; neither outcome waits for a new release to "become real".
- The hand/laser-shaped controls are explicitly resolving-function controls.
  They invoke `delivery.resolve` or `delivery.reject`, not physical catching or obliteration.
  Fresh numbered tools can make real ignored calls on the same retained bundle;
  clicked tools become used and genuinely inert controls stay disabled.
- Pudding art may remain as a static motif, but it is not the Promise, the `"Hello Ada"` value,
  the `Error("No reply")` reason, or an input classified as normal/defective.
  No rhythm timing or game grading is simulated.
- Keep core bundle/inner-Promise value views, full print substance,
  achromatic reading backgrounds, and the Firefox ESR baseline.

This is a design choice for the shared scene, not selection of A/B/C layout or cue color.
The prior color ranking justified by the game's timing faces is invalid and must be recomputed
for Promise outcome cues if a final lesson layout is chosen.

## Superseded designs (do not revive without the user asking)

- Embedding screenshots as base64 images in the choice form; replaced by live `srcdoc` iframes.
- The inverted mapping where the bot was the Promise ("drops a new bot", buckets holding outcome
  puddings); replaced by pudding-as-Promise, which is now also under audit.
- A plain slot-grid rack outside the scene; replaced by drawn controls inside the scene.
- Reusable buttons with a dashed "spent" style; replaced by numbered one-shot buttons per user rule.
- Global call-slot numbering with a "skipped" state; replaced by per-row numbering.

## Artifacts and paths

- Lesson artifact, unchanged by this work:
  `/var/home/user/Monochromatic/doc/planning/promises-teaching.local.html`,
  655,250 bytes, SHA-256 `5401b0df5d9b1eee7f987086e1cef6d60d4e109b63c7bd61d818ed7ef8a05002`;
  its PDF is 121 Letter pages. The pre-value-view copy keeps hash `319ffcb2…`.
- Authoring workspace: `/home/user/temp/agent/promises-revision`.
- Variant prototypes: `ux-variants/ux-variant-a.html` (reference rows),
  `ux-variant-b.html` (kept card grid as live map), `ux-variants/ux-variant-c.html`
  (definition list), sharing `ux-variants/ux-variant-base.css` and
  `ux-variants/ux-variant-experiment.js`.
- Choice form: `ux-variants/settlement-ux-choice.local.html`, a matrix of layout rows
  (A, B, C) by cue-color columns (state-colored, neutral): six live `srcdoc` cells,
  one radio per cell (`name="cell"`, values like `a-state`), row and column pros and cons,
  a full ranking, and a free-text textarea. Rebuild with `node build-ux-choice-form.mjs`.
- Verifier and presenter: `verify-ux-choice-form.mjs`, `shoot-ux-variants.mjs`,
  `present-ux-choice.mjs`; defect probe `probe-settlement-ux.mjs`;
  debug helpers `debug-matrix-cell.mjs`, `debug-showify-direct.mjs`.
- Showify bundle: `../promises-value-inspection/showify-probe.bundle.js` relative to the
  revision workspace (from `ux-variants/` that is `../../promises-value-inspection/…`);
  it exposes `globalThis.showifyShow`. Options mirror the lesson viewer:
  depth 4, indent 2, breakLength 80, maxArrayLength 24, maxStringLength 2000, colors false,
  getters none, callToJSON false, callNodeInspect false, callCustomInspect false.
- Presentation: agent-browser session `promises-open-chat-present` (headed Helium);
  `present-ux-choice.mjs` now navigates only an active empty tab or opens a separate tab,
  never reloads an existing choice or draft. The latest invocation opened a separate tab
  (`ux-choice-handoff.json` records one tab before and two after).
  The active new tab contains six live cells and the baked ignored-call trace, with no
  checked radio, empty free text, and zero browser errors. Screenshots:
  `ux-variants/shot-*.png` and `settlement-ux-current-1008-dark.png`.
  An earlier invocation of agent-browser 0.38.1 emitted "Daemon version mismatch detected,
  restarting..." and saw only `about:blank`; preservation of any tab that existed before
  that restart is unknown.
  [The daemon-version troubleshooting note](../troubleshooting/agent-browser-daemon-version-restart.md)
  traces the restart and the verified consumer preflight.
  `present-ux-choice.mjs` now checks a named daemon's version sidecar before contacting it
  and chooses a separate version-qualified session on mismatch.
  Do not claim a pre-restart draft survived without evidence.

## Fresh audit after compaction

`mise run probe:ux-settlement` in the authoring workspace tested the live matrix in a separate browser session.
The earlier verifier checked the baked Release 1 plus Laser 1 state and only one later interaction sequence.
It did not exercise these cases:

- The section says "try to replace it", but both settling tools are disabled once a Promise settles.
  That is a factory restriction, not proof that later resolving calls leave a Promise unchanged.
  A new teaching interaction needs a user decision; do not silently change that requirement.
- In one scripted browser task, Release 2, Hand 1, then Laser 2 leaves the Promise fulfilled,
  yet the log records both Hand 1 and Laser 2 as settlements.
  The second tool remains enabled until the Promise observer runs in a microtask.
  This is a verified authored-log bug, not a claim about two separate human pointer clicks.
- The sampled rejected-state foreground colors in every state/neutral pair were identical:
  the scene, face screen, face word, and mark all computed to `rgb(255, 185, 157)`.
  Other cues and backgrounds need their own comparison before claiming whole cells are identical.
- `ux-variant-base.css` uses chromatic reading surface tokens (`#142023` paper and `#102023` code
  in dark mode), while the lesson's `neutral-reading.css` requires grayscale backgrounds.
  The drawn factory scene is a bounded illustration and can keep its color.
- At the 390 px parent viewport, a child frame had a 279 px viewport and its snapshot cards
  extended to x=418 px; the body scrolled horizontally.
  The control sublabel computed to 9.92 px. The CSS lacks explicit `:focus-visible` styling
  for the drawn buttons and overrides their minimum block size with zero.
- The visible rejection mark starts above the pudding and mostly falls outside the pudding's
  `clip-path`: mark top/bottom 1036/1049 px, pudding top/bottom 1045/1074 px in one snapshot.
  The conveyor chip's mark uses the same clipped-outside construction.
- The prototype's only value cards are the current resolver bundle and its inner Promise.
  `value-runtime-patches.mjs` also records the lesson-owned observation, the Promise after a
  resolver call, the received value or rejection reason, and selected Error properties.
  The prototype recreates the two cards on paint instead of retaining earlier snapshots.
- Variant C calls itself a definition list but uses `<ul>`. All variants call pending an
  "observed outcome" even while the station is idle, before any Promise exists.
  The snapshot-limit prose refers to an edited draft and a latest-24 recorder that this
  standalone experiment does not have.
- After all five release levers have been used, the station holds the last settled pudding,
  the belt holds four, every button is disabled, and no completion/restart guidance appears.

The audit keeps layout selection pending. Firefox ESR and print verification still belong to the
post-decision implementation. Do not silently apply any cell to the lesson.

## Scratch corrections after the audit

The source changes are in `/home/user/temp/agent/promises-revision`, outside the repository.
They have not been integrated into `doc/planning/promises-teaching.local.html`.

- The audit's first fix gated the second control synchronously at the first resolver call.
  The user's subsequent decision superseded that restriction. `ux-variant-experiment.js` now
  keeps the first-call record immediately, calls the actual resolving function on each fresh
  numbered tool press, and logs subsequent calls as ignored without claiming a second settlement.
  The face distinguishes the call from its observer's microtask, even when both happen in one task.
- The value gallery captures bounded strings at each event rather than reformatting the
  current live value on every paint. It retains the latest 24 cards and now includes
  the resolver bundle, inner Promise, lesson-owned observation, Promise after the resolver,
  received fulfillment value or rejection reason, and selected Error properties.
- The matrix now bakes cue mode into the full variant as well as the stage.
  In the dark rejected state, the face screen computes to `rgb(255, 185, 157)` in
  state-colored cells and `rgb(234, 241, 238)` in neutral cells.
  The B card background also differs. Paper and code surfaces are grayscale in both themes,
  matching `neutral-reading.css`; the bounded drawn factory keeps its illustration colors.
  The neutral column is now named "Outcome-neutral cues" rather than "One neutral accent":
  factory colors remain, but they are not success-or-failure codes.
  Its copy was patched in the active form without reloading or altering form inputs.
- Snapshot grids now shrink without child-document horizontal scrolling at a 279 px iframe
  viewport inside a 390 px parent. Control sublabels measure 12.8 px there.
  Drawn buttons have a 3 rem minimum target, a visible `:focus-visible` rule,
  and a non-motion live cue when reduced motion is requested.
- The pudding's cone is clipped separately from the topping or etch,
  so the mark is no longer clipped by the pudding wrapper.
- Variant C now uses a real `<dl>`; all three variants call the reference "Promise states"
  instead of "observed outcomes"; the snapshot description no longer claims an editor
  exists in this standalone experiment. An exhausted five-pudding run reports completion.
- The form now bakes Release 1, Laser 1, then Hand 1: the hand invokes `resolve` on the
  already-rejected Promise, logs the ignored attempt, and leaves the etch and frown fixed.
  The form clearly separates the factory's single-flight and one-shot rules from Promise rules.
  The choice matrix remains a prototype until the user selects a cell.

`mise run test:ux-choice` rebuilt and verified all six live cells,
including real ignored resolver calls, both call orders, repeated same-action attempts,
same-task calls, an exhausted-tool pending pudding, dark/light grayscale reading surfaces,
mobile child widths without overflow, trusted pointer and keyboard activation,
visible keyboard focus, and zero browser errors.
`verify-ux-resolver-calls.mjs` wrapped `Promise.withResolvers()` in a disposable variant:
its ledger recorded Reject, Resolve, Reject while the native Promise observer reported only
Rejected. A suppressed-call mutant kept the same UI log but failed the native-call guard.
`mise run review:ux-captures` regenerated desktop/mobile light/dark screenshots and found no
horizontally clipped code; the snapshot viewer now wraps and remains keyboard-scrollable.
`mise run probe:ux-settlement` exercised unseeded startup and all five releases:
the belt held four settled puddings, the final pudding stayed at the station,
and the gallery retained 24 cards. Exhaustion now has explicit text if all tools are spent
before the next pudding is released, leaving that Promise visibly pending.
`mise run test:firefox-ux` passed on Firefox ESR 140.16.0 for both call orders, the fixed markings,
the actual error/value snapshots, and ignored resolver calls.
`mise run test:ux-print` generated `ux-variants/settlement-print-review.local.pdf` and confirmed
its extracted text keeps state explanations, the ignored call, fixed outcome, and value snapshots
while the nonfunctional scene is omitted. This is text inventory, not final visual print approval.
The latest prototype artifacts are outside Git, in the authoring workspace.
The lesson remains at SHA-256 `5401b0df5d9b1eee7f987086e1cef6d60d4e109b63c7bd61d818ed7ef8a05002`.

## Earlier verification evidence (superseded)

This paragraph describes the prototype before the user allowed logged ignored attempts;
it is preserved only to explain why the matrix was reopened.
`verify-ux-choice-form.mjs` then passed for all six cells after the baked Release 1 plus Laser 1:
face and scene read rejected, the station pudding carries the etch, post reads 01,
release 1 and laser 1 are used, hand 1 is disabled as "this pudding is already settled",
release 2 is the single live control, the belt is empty, the snapshot cards render
`{"promise":{}}`, `{}`, and `Promise { <state unknown> }`, and the log has two entries.
Interaction in cell a-state: release 2 sends the etched pudding to the belt as a chip with its
etch cone and "! No reply", advances the post to 02, and drops a pending pudding;
hand 1 then settles it with the cherry marking, the log reaches four entries,
release 3 becomes live and hand 2 becomes would-do-nothing.
Frames self-size with no nested scrollbars, the matrix stacks within 390 px,
no images are embedded, and console errors are empty.
Earlier lesson suites (combined tests, exports, PDF, Firefox ESR 140.15.0) remain the evidence
for the lesson file itself; this UX work has not modified it yet.

## Implementation pitfalls (recorded so they are not re-derived)

- `String.replace` with a string replacement eats `$1`-style sequences inside the minified
  showify bundle; always pass a replacer function when inlining it.
- `atob` yields bytes, not text: decode `srcdoc` payloads with `TextDecoder` or glyphs mojibake.
- Baking the cue mode must target the stage element string
  (`<div class="bot-stage" data-colors="state">`), never the CSS attribute selector.
- Variant files reference the showify bundle two levels up: `../../promises-value-inspection/…`.
- Variant B's `renderState` must guard `observed === null` at the first paint.
- The `.bot` face card styles live in `ux-variant-base.css`; dropping them collapses the face
  card into inline text.
- agent-browser tab selection takes tab ids like `t1`, not positional integers;
  select then `reload`.
- For the fixed string and Error fixtures, the first resolver call fixes the outcome before
  observer bookkeeping runs in a microtask. General resolution with a pending thenable may
  lock out later calls while the Promise remains pending; do not generalize the fixture trace.

## Settled first-settlement-wins interaction

The user chose **yes**: a fresh numbered hand or laser button counts as doing something
when it calls a resolver after the Promise has settled and visibly logs
"attempt ignored; original outcome unchanged".
The Promise itself remains fixed. The clicked one-shot button becomes used.
Buttons before a pudding exists remain disabled; available unspent buttons may make later calls
against a settled pudding. The log names both the pudding and the button's per-row number.
A same-task second call is logged as ignored before the observer's microtask;
a later click preserves the face and marking as well.
The staged two-call run and automatic second-call alternatives were not selected.
This decision is not a selection of matrix layout or cue colors.

## Open choices and remaining work

- The bounded-visual-inspiration direction is settled by the user's delegation.
  Do not ask the user to reapprove the same mapping or reopen the logged-attempt decision.
- Build and verify the Promise-ticket scene in the scratch prototypes.
  Treat the old focused clarity review as rejected evidence, not the active design.
- The A/B/C layout and cue-color matrix has not been selected.
  The previous a-state ranking relied on game timing-face colors and is invalid.
  Reassess presentation choices against Promise teaching after the scene is coherent.
- A physical pudding-delivery ticket or Promise of game-turn success remains outside scope;
  either requires a new operation/payload design request.
  Do not add rhythm timing by default.
- Free-text changes to the chosen cell.
- Implementation afterwards (task 35 in the session task list): only after both mapping and
  layout/cue decisions, apply the approved design to `promise-sequence.html` and lesson CSS.
  Preserve the actual ignored resolver calls, disabled-with-reason one-shot controls,
  value snapshots, print counterpart, and achromatic reading backgrounds;
  then re-run the combined suite, exports, PDF inventory, and Firefox ESR pass,
  and commit with scoped pathspecs.

## Constraints carried from earlier work

- The learner-observation veto stays settled; do not reopen it.
- Do not edit `AGENTS.md`.
- Preserve original and rejected artifacts; `*.local.*` files are local-only.
- Long-form backgrounds stay achromatic; bounded cues may carry color.
- Firefox ESR 140 remains the baseline; opaque iframe isolation stays.
- Headless verification is valid; there is no visible-window completion gate.
- Preserve the user's open tabs, windows, and drafts during any presentation.

[yum-bot]: https://rhwiki.net/wiki/Yum-Bot_Simulator#Gameplay
[withresolvers-mdn]: https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise/withResolvers
