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

## Design tree

- Establish what the teaching should accomplish.
  - Open: how to handle the ambiguous dish name before teaching.
  - Open: how to establish relevant prior knowledge without assuming prerequisite skills.
- Make instructions usable by the intended learner.
  - Observed failure: quantities without usable calibration.
  - Observed failure: procurement instructions without concrete access to the required item.
  - Observed failure: measurements without units.
  - Open: what successful replacements look like in context.
- Determine scope and operating boundaries after the failures are understood.
  - Open: how these requirements apply to live teaching and drafted materials.
  - Open: what the agent should resolve itself and what needs learner input.
  - Open: acceptance examples and confirmation of shared understanding.

## Next action

Ask what the first response to the ambiguous cooking request should accomplish.
Use the answer to refine the tree before drafting skill instructions.
