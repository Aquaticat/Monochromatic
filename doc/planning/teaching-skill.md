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

## Concrete lesson requested

The user redirected the interview toward a built example:
"Build me a *.local.html explaining Promises in JavaScript."
They explicitly allowed clarifying questions.
Build this lesson now to anchor subsequent critique;
this authorizes the lesson artifact, not a finalized teaching skill.

Planned artifact: `doc/planning/promises-teaching.local.html`.
The repository ignores `*.local.*`; preserve that local-only status.
The confirmed default presentation requirements apply.

Workspace discovery found relevant examples:

- `package/module/async-time/src/index.ts`: waiting and timeout operations.
- `package/module/async-iter/src/map-iterable-async.ts`:
  starting asynchronous operations before collecting results with `Promise.all`.
- `AGENTS.md`, `PP1` and `PP2`: implementation uses `async`/`await`
  and Promise combinators rather than callback chains or explicit Promise constructors.

Repository code establishes available examples and implementation conventions,
not the human learner's knowledge.
The user then specified a role-play learner rather than their personal knowledge.

### Confirmed learner and destination

Starting point:

- Independently build a JavaScript hello-world program.
- Build a single-file HTML page whose script prompts for a name
  and renders `Hello <name>` in the DOM.
- Nothing beyond that is established.

The lesson should enable the learner to independently build a browser AI chat application with:

- No dependencies.
- Rate limiting.
- Accepted cancellation requests.
- Exponential retries.
- Tolerance of AI API faults.
- Multiple chat threads.

The learner must also be prepared to present the application to an interviewer.
Promises are therefore part of an application-building learning path,
not the complete learning objective.
Supplying a working application or a clickable demo alone would not establish independent ability.
The lesson must account for prerequisites absent from the confirmed starting point
and provide opportunities to build and explain rather than only inspect supplied code.

### Rejected clarification: Q5

The assistant asked:

> What AI API setup should the learner’s finished application target?
>
> Describe the service or API contract, who will use the application,
> and who supplies API access. No actual credentials are needed.
>
> My recommendation for the lesson itself: include an offline, controllable API simulator
> so the learner can deliberately trigger delays, failures, and cancellations,
> then teach the real-service connection explicitly.
> The simulator should support learning and testing,
> not masquerade as a finished AI integration.

The user called this a textbook wrong question,
challenged its relevance,
and required it to become a counterexample in the skill.
They required confirmation of the assistant's understanding even if the assistant thinks it understands.

The prior plan made the real API and credential boundary a blocker
and framed the remaining discovery as an application contract.
That plan is withdrawn.

The user confirmed the central explanation:
the assistant confused an application-building learning destination with a product specification.
They added these required distinctions:

- Asking someone whose established knowledge ends at `Hello <name>` to choose an API setup
  invites a non-answer such as "maybe A".
  Treating that answer as an informed requirement would mislead the teacher.
- Applications shown in interviews do not need to be production applications.
- The focus is `Promise`, not AI.
- An offline, semi-deterministic simulated API with randomness is the appropriate teaching fixture.
  This is settled; do not ask the user to choose it again.

The confirmed counterexample must teach the agent to choose incidental teaching fixtures itself,
keep the requested subject central,
and ask questions the learner is equipped to answer.
Clarification should improve the lesson rather than manufacture unreliable requirements.

Independent advisor review also identified the novice-knowledge mismatch
and the inappropriate product-specification framing before the user confirmed them.

## Lesson implementation direction

Build the authorized `*.local.html` now.
Use repeatable fault scenarios and an optional random mode for the offline API.
The simulated chat application gives Promise behavior a concrete purpose;
it is not a production AI integration project.
Provide prerequisites at the point of use without assuming more than the confirmed starting point.
Use actual Promise behavior in interactions and distinguish observation of a supplied demo
from independent building and interview explanation.

## Current artifact and verification

`doc/planning/promises-teaching.local.html` now exists and remains ignored by `.gitignore`'s `*.local.*` rule.
The user requested writing in chunks of 200 to 500 lines to avoid API timeout errors;
large additions have been split across tool calls.

The artifact contains:

- A progression from named functions and event callbacks to Promise states,
  `async`/`await`, rejection, timers, retries, rate limiting, cancellation, and conversation ownership.
- Actual Promise settlement and continuation-order experiments.
- An offline chat fixture with repeatable scenarios and seeded-random per-attempt choices.
- A sandboxed, network-disabled code workshop with starters, hints, and worked repairs.
- Exercises for cancellation, timeout causes, a shared rate gate,
  invalid fulfillment values, and destination ownership before the independent capstone.
- Downloadable learner HTML, reference HTML, and critique notes.
- System-following theme, print expansion, sources, and a visible critique path back to Pi.

Independent advisor review identified a prerequisite gap before the capstone.
The added gate, timeout, validation, and fixed-conversation exercises address that concern structurally.
Other implemented review corrections distinguish cancellation from failure,
show measured start gaps,
explain the gate's lack of FIFO fairness,
state per-attempt random probabilities,
and warn that retrying a real timeout can duplicate remote side effects.
The simulator tracks displayed conversation histories but deliberately does not simulate model memory.

Initial browser load succeeded with no reported page errors.
The rendered document had one `main`, eight chapters, and no horizontal overflow at a 1,280-pixel viewport.
The initial screenshot is `~/temp/agent/promises-lesson-first.png`.
These are smoke checks, not completed interaction verification or evidence of learner mastery.

The browser verification driver is `~/temp/agent/verify-promises-lesson.ts`.
It uses the isolated `promises-lesson-verify` session and exercises controls,
expected broken starters and worked repairs,
service scenarios,
cancellation phases,
reset races,
seed replay,
and downloads.
Verification is currently running; inspect its notification and logs before trusting results.

Sources consulted for semantic verification:

- <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise>
- <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await>
- <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/withResolvers>
- <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises>
- <https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal>

## Next action

Finish the running browser verification and repair any failures.
Reopen and exercise exported HTML,
check responsive and print output,
then close the disposable verification browser and open the exact lesson in Helium for critique.
Keep the final teaching skill pending until the concrete lesson has informed discovery.
