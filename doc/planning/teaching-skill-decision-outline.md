# Candidate teaching-skill decision outline

Status: planning-only process sketch, not `SKILL.md`, a confirmed requirement,
or permission to implement the final skill.
Its examples and falsifiers live in [the working acceptance checks](teaching-skill-acceptance.md),
[the cross-domain probe](teaching-skill-transfer-probe.md),
and [the learner-result research note](teaching-skill-research-feedback.md).
This outline tests whether the same process could guide live teaching and authored material
without copying Promise-specific UI or unverified recipe details into unrelated topics.

## Invocation hypothesis

A future model-invoked pointer would fire when the agent is asked to teach a person,
explain material for a stated learner, or create or review instructional material.
Those are distinct branches; the pointer should not fire merely because an answer contains
an explanatory sentence. A model-invoked description is a permanent context cost,
but relying on the user to remember a skill would miss ordinary teaching requests.
The trigger and its tradeoff remain a planning hypothesis, not a package decision.

## Decide what the learner must accomplish

- Inspect discoverable context, then identify the learner's evidenced capabilities,
  immediate task, and any separately desired transferable background.
  A worked example of a capability is not a biography of every learner.
- Form a reasoned interpretation before asking.
  Clarify an ambiguity only if plausible readings change the method, equipment,
  audience, or explanatory goal. Choose incidental teaching fixtures rather than asking
  a novice to specify a product's API, customers, or credentials.
- **Completion criterion:** the learner's target and starting capabilities are sufficiently
  defined to select the next teachable action; any unanswered question changes that action.

The “rotated chicken” request tests target ambiguity.
The rejected AI-service setup question tests fixture ownership.
The earlier broad “what failure did I miss?” question tests whether the teacher did its own
research before asking the user to diagnose a defect.

## Decide which causal relation to teach next

- Identify the operation or inference the learner must construct, perform, or explain.
  Teach prerequisites before depending on them and use the causal model for that role.
- When a new abstraction answers a known method's limit, demonstrate that limit using
  a concrete version of the familiar method, then compare the replacement on the same
  problem. This is not a demand for a failure experience before every fact.
- Keep an operation separate from its representation and from a fixture policy.
  Verify source-backed claims when analogies, runtime ordering, or external tools matter.
- **Completion criterion:** the next concept has a grounded purpose and its explanation
  reveals the relationship the learner must use, not only the observer's result.

The apples-to-multiplication progression and callback-to-Promise comparison test the
abstraction branch. Listener registration tests the developer-role branch.
The manual resolver ticket tests the operation-versus-observation boundary.

## Decide how the learner can act

- For each consequential step, supply verified quantities, units, objects, tools,
  access paths, and ownership needed by that learner. Do not fill missing dish,
  location, equipment, or safety facts with precise-looking guesses.
- Choose a subject-appropriate demonstration and make its controls perform their
  advertised action. Update any event record at the event it claims to represent.
- **Completion criterion:** the learner can attempt the next step with available resources;
  required information is present or a consequential uncertainty is explicitly resolved.

The quoted salt, oven, and grocery instructions test actionability;
the Promise Send, Stop, and delayed belt cases test operation and event boundaries.

## Decide how the learner checks their own result

- At a consequential action or inference, provide an observable success or safety
  criterion using an available, appropriate check.
  A reference result or a label alone does not measure the learner's own attempt.
- When their observation differs, say what it establishes and what remains unknown.
  Offer a bounded next check, safe stop, or what to report for help.
  Do not infer a Promise's internal state from `Waiting…`, or food safety from appearance.
- **Completion criterion:** the learner has a criterion and a usable next decision
  when the step's outcome is correct, different, or inconclusive.

This is a proposed specificity refinement, not a universal checkpoint after every
sentence or a claim that the current Promise lesson lacks rejection feedback.
The [local disposable probe](teaching-skill-research-feedback.md) showed existing task,
hint, and diagnostic support, plus distinct underlying operations behind the same display.

## Decide how to present and preserve the teaching

- For authored lessons, follow the user's confirmed default of a visual, interactive,
  self-contained HTML presentation with automatic theme and complete print substance.
  Offer the requested quick Markdown alternative when appropriate.
- Preserve useful browser actions and provide usable static counterparts for print;
  neither medium justifies stripping depth from the other.
  For a live exchange, establish the next learner action and use the chosen medium;
  do not treat a full artifact as a substitute for responding to the learner.
- **Completion criterion:** the chosen medium exposes the causal relation and preserves
  necessary content for that medium, including action and result boundaries.

Code highlighting belongs to code teaching when useful, not every recipe.
A printed Promise lab needs source, trace, and explanation even though its controls cannot run.

## Decide what the evidence warrants claiming

- Exercise actual teaching examples and artifact integrations through their consumer
  where possible. Check prerequisites, examples, control effects, exports, accessibility,
  and print separately from learner independence.
- Report observed learner performance only if it occurred. A working reference,
  completed browser suite, or positive design reaction is not proof of learner mastery.
- **Completion criterion:** every completion claim names its evidence layer and no
  absent learner observation is turned into a study or approval gate.

## Design gate before a real skill

Test this process sketch against the recorded counterexamples and near misses,
including a precisely worded but wrong cooking procedure, the rejected API-specification
question, a working Promise reference with an unhandled learner error,
and a result display that hides an already-settled Promise.
If a branch cannot distinguish those cases, revise the sketch rather than adding
an all-purpose prohibition. Confirm shared understanding before creating a real skill.
The user's instruction to leave `AGENTS.md` unchanged remains in force.
