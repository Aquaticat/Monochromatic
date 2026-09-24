# Teaching-skill transfer probe

Status: working comparison, not a confirmed skill design or a new lesson request.
The user's positive response to the corrected Promise toy is feedback on that artifact,
not evidence that a novice has learned from it.
The cooking evidence is the user's critique recorded in [teaching-skill discovery](teaching-skill.md).
The Promise evidence includes the same discovery record,
[proposed acceptance checks](teaching-skill-acceptance.md),
and [the settlement-UX handover](../handover/promises-settlement-ux.md).
No cooking instructions, product links, or safety claims are being prescribed by this probe.

## Evidence and transfer candidates

### Resolve the intended target before teaching a procedure

- **Cooking observation:** The learner asked about “rotated chicken”.
  The user said this was not the dish name and that the response showed insufficient cooking knowledge.
  The intended dish and equipment cannot be determined from that phrase alone.
- **Promise observation:** Early lesson openings named Promises and chat machinery before establishing
  what the learner was trying to build or why the abstraction mattered.
  The Yum-Bot physical metaphor later mislabeled the causal role of the Promise.
- **Transfer candidate:** Form a reasoned interpretation of the target,
  then clarify consequential ambiguity instead of building steps around an unexamined name.
  Connect the resulting teaching path to the learner's actual destination.
- **Limit:** This is not an instruction to demand confirmation of every term.
  Ask only when plausible interpretations would change the procedure or explanation.

### Make each learner action usable at its own boundary

- **Cooking observation:** “A little bit of salt” gave no usable calibration;
  “300degrees” omitted a temperature scale;
  “Get raw chicken from grocery store” provided no actual procurement path.
  The user wanted a specific delivery product or an opened map for an in-person trip.
- **Promise observation:** Undefined prerequisites, a missing listener-registration relationship,
  ambiguous Stop ownership, and a reference send control that waited for a reply
  blocked actions the learner was meant to perform or explain.
- **Transfer candidate:** At an action boundary, supply the quantities, units, objects,
  ownership, tools, and accessible path that this learner needs to carry out the step.
  Measure discoverable environment facts before asking the learner to provide them.
- **Limit:** No oven setting, ingredient amount, product, vendor, or travel path is established here.
  A real cooking lesson would need a clarified dish, available equipment, location or delivery preference,
  and checked food-safety sources before naming those particulars.
  More detail is not inherently better if it specifies the wrong operation.

### Teach the causal model for the learner's role

- **Cooking observation:** A procurement command with no usable source assumes the novice can
  bridge from an ingredient name to acquiring the right item.
  An ambiguous oven instruction assumes the novice can infer the intended scale.
- **Promise observation:** “Click and something happens” explained a browser user's observation,
  not how the developer registers a listener.
  A resolver button was called a service request even though it only supplied a manual outcome;
  a game-performance face was treated as a Promise outcome.
- **Transfer candidate:** Explain the decisions and causal links that the learner must perform,
  construct, or diagnose, not merely the effect an observer notices.
- **Limit:** The programming learner's event-listener and Promise internals do not belong in a recipe.
  Cooking instructions likewise require domain-specific safety and handling evidence
  rather than JavaScript-style state diagrams by default.

### Align a record with the event it claims to describe

- **Cooking observation:** The quoted critique concerns missing calibration and access,
  not the timing of a cooking-progress display.
  There is no user evidence that a recipe needed a simulated timeline.
- **Promise observation:** The outcome belt originally recorded an observed result only when
  the next Create action ran, although the Promise observer had already reported it.
  The corrected lesson records the receipt in the observer callback.
- **Transfer candidate:** When a teaching aid claims to be an event log,
  its update must follow the event named by the label rather than an unrelated later action.
- **Limit:** This is a cross-domain hypothesis, not an observed cooking failure.
  Do not add a progress widget to a recipe merely to satisfy it.

### Keep operational and teaching evidence separate

- **Cooking observation:** The user's critique establishes that the quoted response was
  unusable in the specified ways; no learner cooking attempt or repaired recipe is recorded.
- **Promise observation:** Browser, Firefox ESR, export, and PDF tests establish artifact behavior.
  The user's “This is great” supports this design direction but does not measure independent
  application-building or explanation by the intended novice.
- **Transfer candidate:** Report which action paths and explanations were checked,
  then separately describe any learner performance actually observed.
- **Limit:** Do not convert the settled learner-observation veto into a new study requirement.
  Absence of learner-performance evidence limits the claim; it need not block a working artifact.

## Guardrails against over-transfer

- The apples example motivates multiplication by scaling the same familiar counting task.
  The Promise comparison motivates an abstraction against a real predecessor problem.
  The cooking critique does not establish that a novice must first fail at seasoning or shopping.
- Printable, interactive, self-contained HTML is this user's confirmed default for authored teaching.
  It does not mean every subject requires code highlighting, a button, or the same state diagram.
  Print must keep teaching substance without suppressing useful browser interactivity.
- The Promise toy's `"Hello Ada"` and `Error("No reply")` are manual fixture values.
  They are not service results or ingredients, and no game-faithful pudding processing is claimed.
- The original cooking critique must not be “repaired” by inventing a dish, location,
  temperature scale, or food-safety endpoint.
  Those details must be established or checked before an actionable recipe is written.
