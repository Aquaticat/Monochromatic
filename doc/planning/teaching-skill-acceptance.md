# Proposed teaching-skill acceptance checks

## Status

This is a synthesis for shared-understanding review, not the finished skill or an accepted policy.
The [discovery record](teaching-skill.md) retains the user's examples, corrections, and rejected questions.
The local Promises page is a source of counterexamples, not an accepted teaching design.
`AGENTS.md` remains outside this change.

## Learner framing and prerequisite sequencing

### Establish capabilities without inventing a biography

Passing behavior:

- Describe the starting profile in terms of what the learner can do and explain.
- Treat a supplied example of those capabilities as evidence of the profile,
  not a claim that every reader wrote that exact program.
- Make the lesson's starting example self-contained for readers with that profile.
- Frame the destination through an understandable capability or problem,
  then introduce the subject's unfamiliar name when it has meaning.

Counterexamples this must catch:

- Calling a particular `Hello, name` program "your existing page" without establishing shared context.
- Opening with "Learn Promise" as if the unfamiliar abstraction explains the learner's destination.
- Describing a "chat" or "chat service" without establishing what participants and programs actually do.

### Introduce prerequisites before relying on them

Passing behavior:

- Account for the concepts and operations each explanation requires.
  Each is supported by the learner profile or an explanation the learner has already encountered.
- Show the concrete operation behind a term such as "define" or "display";
  a familiar-looking word does not establish the relevant programming concept.
- Place the object explanation before explanations that require understanding objects.
- Keep necessary foundations in the teaching path.
  Optional background can be folded away without making the main explanation depend on hidden knowledge.

Counterexamples this must catch:

- Requiring the reader to understand objects in order to reach the paragraph explaining objects.
- Introducing undefined terms through headings and goal statements, then defining them much later.
- Replacing a missing prerequisite with additional jargon or a link that leaves its role unexplained.

### Teach the mental model appropriate to the intended role

Passing behavior:

- Identify what the learner must construct, control, diagnose, or explain to achieve the destination.
- Make those causal relationships visible rather than substituting an observer's account of the outcome.
- Match explanatory depth to that role and goal;
  this is not a requirement to teach every underlying implementation detail.

The click-listener counterexample:

- A browser user's account is "click the button and something happens".
- The developer needs the connection they create:
  attach a listener for the button's click event and supply the function it runs.
- "Let the browser call a function on a click" skips that developer model.
  Merely adding an event-loop footnote does not repair the missing relationship.

### Build from existing knowledge without making it a ceiling

Passing behavior:

- Introduce a useful new tool or concept when it serves the learning objective,
  showing its purpose and teaching the knowledge needed to use it.
- Choose the teaching environment for its contribution to the objective,
  rather than promising that the learner will never encounter anything new.
- Explain environment requirements where they support an actionable step,
  not as a substitute for an understandable learning destination.

The apples example establishes the sequence:

- Begin with concrete arrangements whose count the learner can establish using addition.
- Preserve the visible equal-row structure while increasing the problem's scale.
- Use the demonstrated limit of repeated counting to motivate multiplication and then the table.
- Do not lead with the table and assume that examples afterward establish why it exists.

### Make physical and setup instructions actionable

Passing behavior:

- Resolve an ambiguous intended dish rather than building a lesson around an unexamined name.
- Give a novice a usable quantity and the relevant measurement unit.
- Connect procurement to an actual usable product or location,
  using the learner's available tools and genuine delivery or travel preferences.
- Inspect available evidence before asking the learner to supply discoverable facts.

Counterexamples this must catch:

- "A little bit of salt" without calibration.
- "300 degrees" without a temperature scale.
- "Get raw chicken from the grocery store" without a usable procurement path.

### Ask from a reasoned understanding

Passing behavior:

- Investigate the subject and workspace before asking about facts or diagnosing a reported defect.
- Form an interpretation from the evidence, then ask about meaningful uncertainty that remains.
- Ask questions the learner is equipped to answer about their experience, goals, tools, and constraints.
- Choose incidental teaching fixtures rather than turning a learning destination into product specification.

Required rejected questions:

- Q5 asks the novice to choose an AI API, service contract, audience, and access setup.
  Its repair is the already-selected offline, semi-deterministic random fixture,
  with the lesson focused on Promises rather than production AI integration.
- Q9 asks what is misleading about the click-listener heading without first recognizing its role mismatch.
  Its repair is thoughtful analysis before a clarification question, not a prohibition on questions.
