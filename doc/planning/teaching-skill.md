# Teaching skill discovery

## Status and request

The user requested a skill to curb failures in AI teaching and drafted teaching materials.
They requested grilling to discover the failures from their experience.
Repository material remains potentially relevant.
Discovery is ongoing; no skill design has been confirmed or implemented.

## Evidence from the user

Example learner request: "Teach me to make rotated chicken".

The user identified these failures in the AI response:

- "A little bit of salt": gives a novice no usable quantity.
  The user also noted that "rotated chicken" is not the dish name
  and that the wording signals missing cooking knowledge.
- "Get raw chicken from grocery store": leaves the procurement step unactionable.
  The user wanted a specific product link for delivery or a map opened for an in-person trip.
- "Set oven to 300degrees": omits the temperature scale and invites misunderstanding.

## Confirmed intake requirements

The user confirmed that the AI should ask clarifying questions.
Their examples specify meanings, not exact wording or a canned questionnaire:

- Discover relevant evidence in the user's workspace first.
  If there is sufficient reason to suspect an A/B or X/Y problem,
  ask about the underlying choice and whether a different approach would better serve the goal.
  Suspicion must come from discovery, not a reflex to challenge every request.
- Anchor questions in the user's experience and available tools.
  Ask about comfort with the relevant techniques or tools.
- Establish the intended outcome:
  accomplishing the immediate task and whether the user also wants missing background knowledge
  that improves their general ability.
  Offer requested science or related background in foldable `<details>` sections.
- Explain the intended presentation.
  Default to building an interactive, visual, self-contained, auto-dark-theme, printable HTML demo.
  Mention Markdown as an available alternative when the user wants something quick.

## Design tree

- Establish what the teaching should accomplish.
  - Settled: clarify the intended dish instead of passing over the ambiguous name.
  - Settled: discover workspace evidence before asking questions that evidence can answer.
  - Settled: investigate an alternative underlying goal when evidence warrants it.
  - Settled: anchor relevant experience and available tools through discovery and questions.
  - Settled: distinguish the immediate goal from additionally desired background learning.
- Make instructions usable by the intended learner.
  - Observed failure: quantities without usable calibration.
  - Observed failure: procurement instructions without concrete access to the required item.
  - Observed failure: measurements without units.
  - Open: other failures during teaching after intake is done correctly.
  - Open: examples that distinguish successful teaching from merely precise instructions.
- Present the material.
  - Settled: default HTML properties and availability of Markdown alternative.
  - Settled: optional background can use foldable `<details>` sections.
  - Open: useful interaction and visual behavior in the teaching artifact.
- Determine remaining scope and operating boundaries after the failures are understood.
  - Open: how these requirements apply to live teaching and drafted materials.
  - Open: acceptance examples and confirmation of shared understanding.

## Interview adjustment

The user answered "Of course ask clarifying questions" to the question about the first response.
Clarification was already implied by the initial failure example.
Subsequent questions should discover unresolved failures or preferences,
not ask the user to ratify an obvious repair.

## Next action

Ask what fails during the lesson even when the intake and presentation requirements are met.
Use the answer to refine the tree before drafting skill instructions.
