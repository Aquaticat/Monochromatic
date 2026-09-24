# Settlement experiment UX redesign

Status: the choice matrix exists; objective rendering and bookkeeping defects found in a fresh audit
have been corrected in the scratch prototypes and reverified.
The first-settlement-wins interaction still needs the user's decision before a cell is chosen.
The lesson file is untouched by this work.
No skill design has been confirmed; this redesign feeds the Promise toy, not the teaching skill.

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

## Research: Yum-Bot Simulator

Source: RHWiki page for Yum-Bot Simulator (Rhythm Heaven Groove, Stage 5, 23rd game;
Japanese Sotto Catch), supplied by the user in chat. Facts used:

- The player runs robot S-CATCH-01 under a production line; puddings fall from ceiling containers.
- Normal puddings follow a high-low-high buzzer and are caught with the hand on the fourth beat;
  defective puddings with suspicious eyes follow a descending buzzer and are lasered.
- The robot's screen face reports every outcome: green smile, yellow neutral, red sad.
- The line manager's results text judges decisions: "Only make essential moves. You could overheat!"

Carried-over rules: one object on stage whose face is the state; the line drops the objects;
finished objects ride a conveyor with their outcomes; actions exist only while an object is present;
every press gets expressive feedback; a manager line explains each event.

## Current model (game-faithful)

- The pudding is the Promise: a numbered lever on the rail releases it (creates the Promise),
  it falls from the hatch and sits at the station plate pending.
- The robot is the settling agent with two tools: the hand catches the pudding with the
  "Hello Ada" topping (fulfill); the laser etches the "No reply" reason (reject).
  The first tool press settles; the marking (cherry dot or exclamation etch) never changes again.
- When the next pudding drops, the settled one rides the conveyor as a chip
  (pudding cone plus marking plus text), which is the visible form of "settlements are not revised".
- The robot face gives timing-display feedback (flat waiting, smile caught, frown etched);
  the accessible `#bot-face` card below the scene mirrors glyph and sentence for screen readers,
  and print hides the scene while keeping that card and the call log.
- Controls are five numbered one-shot buttons per row (release, fulfill, reject), drawn inside the
  scene as lever, mitt, and eye-beam. Availability reasons: used, would do nothing, future, live;
  drawn states are faded, dashed case, empty hook, and swaying; pressing squashes the hook.
- Value snapshots: the resolver bundle and the Promise inside it render as cards with
  `JSON.stringify(value)` and `show(value) from showify`, using the audited showify 0.2.8 bundle.

## Superseded designs (do not revive without the user asking)

- Embedding screenshots as base64 images in the choice form; replaced by live `srcdoc` iframes.
- The inverted mapping where the bot was the Promise ("drops a new bot", buckets holding outcome
  puddings); replaced by pudding-as-Promise.
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
- Presentation: agent-browser session `promises-open-chat-present` (headed helium);
  the form tab is reloaded in place by `present-ux-choice.mjs`; evidence in
  `ux-choice-handoff.json`. Screenshots: `ux-variants/shot-*.png` and
  `settlement-ux-current-1008-dark.png`.

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

- `ux-variant-experiment.js` gates the second control synchronously when the first resolver
  is called, before its observer's microtask. The log now says "called resolve" or
  "called reject", and the face temporarily says the observer report is queued;
  it never falsely records a second settlement in the same browser task.
- The value gallery captures bounded strings at each event rather than reformatting the
  current live value on every paint. It retains the latest 24 cards and now includes
  the resolver bundle, inner Promise, lesson-owned observation, Promise after the resolver,
  received fulfillment value or rejection reason, and selected Error properties.
- The matrix now bakes cue mode into the full variant as well as the stage.
  In the dark rejected state, the face screen computes to `rgb(255, 185, 157)` in
  state-colored cells and `rgb(234, 241, 238)` in neutral cells.
  The B card background also differs. Paper and code surfaces are grayscale in both themes,
  matching `neutral-reading.css`; the bounded drawn factory keeps its illustration colors.
- Snapshot grids now shrink without child-document horizontal scrolling at a 279 px iframe
  viewport inside a 390 px parent. Control sublabels measure 12.8 px there.
  Drawn buttons have a 3 rem minimum target, a visible `:focus-visible` rule,
  and a non-motion live cue when reduced motion is requested.
- The pudding's cone is clipped separately from the topping or etch,
  so the mark is no longer clipped by the pudding wrapper.
- Variant C now uses a real `<dl>`; all three variants call the reference "Promise states"
  instead of "observed outcomes"; the snapshot description no longer claims an editor
  exists in this standalone experiment. An exhausted five-pudding run reports completion.
- The form explicitly says the first-settlement-wins interaction is unresolved,
  and no layout should be applied yet. The existing presented tab was not reloaded,
  so any unsubmitted choice or free text there remains intact; the rebuilt form is on disk.

`mise run test:ux-choice` rebuilt and verified all six live cells,
including same-task double-call exclusion, distinct cue colors, grayscale light and dark
reading surfaces, six mobile child scroll widths equal to their 279 px viewports,
and zero browser errors. `mise run probe:ux-settlement` exercised unseeded startup,
the corrected same-task sequence, and all five releases: the belt held four settled puddings,
the final pudding stayed at the station, and the gallery retained 24 cards.
These probes are browser checks, not Firefox ESR, print, or a final lesson integration test.

## Earlier verification evidence (not full acceptance)

`verify-ux-choice-form.mjs` passed for all six cells after the baked Release 1 plus Laser 1:
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
- A call's effect must follow the Promise's synchronous first-settlement-wins rule,
  not the microtask-late observer bookkeeping.

## Open choices (user's, gating implementation)

- First decide what counts as "would do nothing" for a second resolver call on an already-settled
  Promise. A visible log of an ignored attempt is a meaningful teaching result,
  but the Promise itself cannot change. The current factory disables this control,
  so it does not teach the heading's promised attempt. Alternatives include letting a fresh
  one-shot control make and log the ignored call, staging a two-call sequence before running it,
  or automatically making a second call as part of a first-action scenario.
  Do not infer the user's preference from the earlier prohibition on no-op buttons.
- Matrix cell: layout (A reference rows, B kept card grid, C definition list)
  by cue color (state-colored, neutral). My ranking, with adjacent-pair reasons in the form:
  a-state, a-neutral, b-state, b-neutral, c-state, c-neutral.
- Free-text changes to the chosen cell.
- Implementation afterwards (task 35 in the session task list): apply the chosen cell to
  `promise-sequence.html` and the lesson CSS, including the global pressed-state rule,
  the drawn station, the numbered one-shot rack with disabled-with-reason availability,
  the restored snapshot cards, and the print counterpart (scene hidden, face and log kept);
  then re-run the combined suite, exports, PDF inventory, and the Firefox ESR pass,
  and commit with scoped pathspecs.

## Constraints carried from earlier work

- The learner-observation veto stays settled; do not reopen it.
- Do not edit `AGENTS.md`.
- Preserve original and rejected artifacts; `*.local.*` files are local-only.
- Long-form backgrounds stay achromatic; bounded cues may carry color.
- Firefox ESR 140 remains the baseline; opaque iframe isolation stays.
- Headless verification is valid; there is no visible-window completion gate.
- Preserve the user's open tabs, windows, and drafts during any presentation.
