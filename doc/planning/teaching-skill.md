# Teaching skill discovery

## Status and request

The user requested a skill to curb failures in AI teaching and drafted teaching materials.
They requested grilling to discover the failures from their experience.
Repository material remains potentially relevant.
Discovery is ongoing and the first prototype has not been repaired.
The shared-understanding checkpoint was premature and is withdrawn.
[Proposed acceptance checks](teaching-skill-acceptance.md) are only a working hypothesis.
The user requires an updated Promise toy before continuing to weed out failure modes.
No skill design has been confirmed or implemented.

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
- Printing is never a reason to simplify either output:
  the HTML page as viewed in a browser or the printout.
  The user explicitly defined "source material" to include both.
  Their requirement is: "Print merely graceful degrades the interactivity."
  Both versions preserve the full teaching material, including depth, examples, and explanations.
  The browser version keeps the interactivity the lesson needs.
  Only the printout adapts interactive mechanisms into usable static equivalents.
  Printability requires another presentation of the material,
  not a least-interactive version imposed on both outputs.
  Keeping the browser version complete while reducing the printout does not satisfy this requirement.
  Required counterexample from the user:
  "oh you want it printable? I'll not add some interactivity, ANYWHERE".
  The skill must explicitly deter omitting browser interactivity just because print support was requested.

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
  - Captured: profile-based framing, prerequisite order, definitions, and role-appropriate mental models.
  - Captured: apples and scaling as an example of motivating an abstraction through a demonstrated need.
  - Captured: independent performance and explanation differ from inspecting supplied working code.
- Present the material.
  - Settled: default HTML properties and availability of Markdown alternative.
  - Settled: optional background can use foldable `<details>` sections.
  - Captured: concept-revealing interactions, state-linked code, syntax highlighting, and honest affordances.
  - Settled: preserve both browser interactivity and full teaching substance in the printout.
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

## Initial lesson implementation direction

This was the direction used for the first prototype.
The user's critique and proposed acceptance checks identify why it was insufficient;
do not treat it as the blueprint for a repaired lesson.

The initial action was to build the authorized `*.local.html`.
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
The complete interaction driver subsequently passed in process `proc_7c0a`.
Its log is `/tmp/pi-processes-uCxua0/proc_7c0a-stdout.log`.
The first attempts exposed harness assumptions, not lesson defects:
CSS iframe selection failed,
native eval stayed in the main frame,
a completion predicate mistakenly treated "Attempt timed out" as pending,
and a nested selector string was incorrectly escaped.
The frame bridge and corrected assertions yielded the completed passing run.
The tool-specific scope evidence is in
[`agent-browser-iframe-evaluation.md`](../troubleshooting/agent-browser-iframe-evaluation.md).

`~/temp/agent/verify-promises-delivery.ts` then exercised the downloaded reference and learner HTML,
adversarial source text containing a mixed-case closing script tag,
network-offline use,
light and dark themes,
a 390-pixel viewport,
and actual PDF/Print lifecycle behavior.
A fresh-session rerun with an assertion requiring an empty page-error record passed as `proc_648b`.
The disposable verification browser was closed.

The generated PDF contained 29 pages, measured with `pdfinfo`.
Its first and sixth pages were rendered with `pdftoppm` and inspected.
Screenshots are under `~/temp/agent/` with the `promises-lesson-`, `promises-chat-`,
and `promises-print-` prefixes.
These verify rendering and operation, not pedagogical success.

The exact lesson has been opened in Helium through the separate user-facing
`promises-lesson-present` browser session.
The page reported the correct file URL, document title, eight chapters, and two initial conversations.
Its scroll offset was already 1,728 pixels when inspected;
no reset to the top was performed, to avoid disrupting possible user interaction.
KWin then verified the Helium window as active, non-minimized, and on the current output `DP-2`.
Its measured frame was 1,018 by 744 pixels.
The global system journal, not the user-only journal, retained the `PI_PROMISES_LESSON_VISIBLE` record.
A later browser probe still reported the correct visible file and a changed scroll position;
focus was no longer on the page at that later moment.
No claim of sustained keyboard focus is made.
The temporary KWin script was unloaded without closing the user's lesson window.

The delivered local file's SHA-256 is
`dd9df982e76e4d4e4d7db9def3236a1f2f75af354637c4ae7074c3b4606f90ef`.
The artifact served as the concrete example for the recorded critique.
It is not an accepted or proven teaching method.

Sources consulted for semantic verification:

- <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise>
- <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await>
- <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/withResolvers>
- <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises>
- <https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal>

## User critique of the first built lesson

The user reported "tons of failures" and gave an unfinished list.
Preserve these individually rather than treating them as cosmetic wording fixes:

- A lesson targets a learner profile, not one specific learner's biography.
  `"Hello, name" page` will not be immediately clear to everyone with the specified skills.
- "Learn `Promise`" is wrong framing for someone who does not know what a Promise is.
- "chat" is undefined.
- "wait, fail, retry, and stop" are undefined.
- "You need only your existing ability to edit and open a single HTML file" is misplaced.
  The user wrote: "We should constrain ourselves and the learner to only what they already know",
  then said teaching a tool or related thing that substantially improves the objective is fine.
  Editing one HTML file is not much of a bottleneck here;
  the user contrasted teaching "WAPI or something".
  The user's answer in "Addition-to-multiplication example" grounds this boundary in instructional sequence,
  rather than a blanket ban on new tools or concepts.
- "The pretend chat service" uses an undefined and potentially misleading term.
- Code lacks syntax highlighting despite an existing repository facility.
- "defining" and "display" are under-defined.
- "Let the browser call a function on a click" teaches the browser user's action-to-outcome model,
  not the developer's model of attaching a click event listener to a button
  and supplying the function it runs.
  See "Role-appropriate mental models and questions with prior thought".
- "A service request" is vague and misleading when the experiment waits for the learner's intervention.
- "stopping the whole page" is under-backed;
  the JavaScript thread model needs clarification.
- "now" is under-specified because JavaScript has multiple relevant notions of timing.
- The paragraph explaining objects is good but belongs before the paragraph depending on it.
- Pending, Fulfilled, and Rejected cards look clickable despite not being clickable.
  They also miss an opportunity to show code in each state.
- `Promise.withResolvers()` introduces another failure:
  the lesson has not established enough pain or shown how people managed the need
  before Promises were specified and shipped.
- "resolved is not always the same as fulfilled" needs a concrete example.
- The user emphasized:
  "This is HTML. Take advantage of it. There is a reason the format isn't interactive PDF or something."

### Verified repository evidence for highlighting

A targeted dependency and filename search found the Lezer highlighting implementation:

- `package/ssg/aquati.cat/src/lib/rehype-highlight.ts` parses supported languages
  and writes token-offset attributes onto code nodes during the build.
- `package/ssg/aquati.cat/src/client/highlight-groups.ts` defines token groups.
- `package/ssg/aquati.cat/src/style/highlight.ts` supplies CSS Custom Highlight styles.

The implementation exists and was missed during the initial lesson construction.
Its standalone integration has not yet been verified;
inspect the client registration, dependencies, and consumers before prescribing reuse mechanics.

### Design implications still being tested

Independent review supports distinguishing these concerns:

- Profile-based framing and accessible goals.
- Definitions at adequate depth, separately from prerequisite ordering.
- Accurate causal models that match the actual experiment,
  not merely more citations or a renamed simulator.
- Establishing the need and predecessor mechanism before introducing an abstraction,
  without assuming every subject needs an exhaustive historical survey.
- HTML interactions that reveal concepts and honest action affordances,
  not additional controls for their own sake.

These are candidate generalizations, not a user-confirmed final skill design.
Technical checks established operational behavior, not pedagogical adequacy.

## Addition-to-multiplication example

The user answered the prior-knowledge question with a concrete teaching sequence:

- Present an apple and arrange a row of three apples.
  The learner can establish its count using familiar addition: `1 + 2 = 3`.
- Arrange another aligned row of three.
  The learner can establish the combined count: `3 + 3 = 6`.
- Add another row and let the repeated counting expose why the current method becomes unwieldy.
- Introduce multiplication, then the multiplication table, in response to that need.

Their contrast is opening with a multiplication table instead of building this understanding.
The example establishes the importance of concrete representations,
known reasoning,
visible structure,
and a problem that motivates the next abstraction before its name or reference material arrives.

The assistant's interpretation is that new tools and concepts are allowed,
but require a bridge from the learner's established understanding.
The Promises page reversed that order by naming the abstraction and listing its features
before sufficiently establishing the problem it solves.

When asked what to do if the learner counts correctly but sees no reason to change methods,
the user answered: "Scale up. There WILL be a point where they fail."
Increase the same problem's demands until the current method's limitation is observable.
Introduce the new method in response to that demonstrated need,
rather than merely asserting that counting is cumbersome or narrating an unobserved realization.
This is evidence about the method's limits, not a judgment about the learner.
Do not assume a required lockstep UI, forced quiz, or exhaustive historical survey.

## Role-appropriate mental models and questions with prior thought

The assistant asked:
"You called 'Let the browser call a function on a click' misleading.
What incorrect understanding would that phrasing give the learner?"
The user challenged whether the assistant genuinely failed to see the problem.

The assistant then overcorrected toward not asking the user to diagnose its wording.
The user clarified that questions are welcome, but must show thinking first.
Their challenge was a probe of the assistant's understanding, not a ban on asking.
Do not turn this correction into a rule against clarification questions.

The user supplied the distinction:

- A generic browser user clicks a button and things happen.
- The learner is becoming a developer.
  The developer attaches a click event listener to the button;
  when triggered, it runs a function.

The heading replaces the mechanism the developer must construct with the outcome a browser user observes.
The assistant should have inferred that mismatch before asking.
A question should start from a reasoned interpretation and investigate a remaining uncertainty,
not ask the user to perform the initial analysis of an already-identified failure.

Teach the causal model appropriate to the learner's intended role.
Accessible wording must not erase the relationships the learner needs to create, inspect, or explain.
This also guides independent review of the remaining under-defined or misleading lesson language.

The user explicitly said not to edit `AGENTS.md` for now.
Keep the teaching-specific correction and rejected question in these planning notes.
No final skill is authorized until shared understanding is confirmed.

The assistant checked MDN's `addEventListener()` and `dispatchEvent()` documentation while investigating.
The first distinguishes registering a listener on a target from invoking it;
the second documents synchronous programmatic dispatch.
These checks must not replace the user's central role-and-mental-model distinction
with an unrelated lecture on scheduling exceptions.

- <https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener>
- <https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/dispatchEvent>

## Requirements synthesis review

`teaching-skill-acceptance.md` groups proposed checks by learner framing,
observable problems and causal explanations,
HTML and print behavior,
and verification evidence.
It keeps the cooking, apples, and Promise examples as concrete acceptance cases.

Independent advisor review prompted these corrections before confirmation:

- Apply failure-driven scaling when an abstraction addresses an existing method's limitation,
  not as a universal prerequisite for teaching every fact.
- Preserve the requested real pre-Promise callback history,
  separately from the Promise constructor pattern that precedes `Promise.withResolvers()`.
- Preserve all reasons Q5 failed without banning pedagogically relevant audience questions.
- Separate artifact behavior, content review, teaching-effectiveness evidence, and demonstrated mastery.

The highlighter's producer, consumer, registration, and style paths were inspected.
Standalone integration remains unverified and is not claimed.
No lesson rewrite, skill implementation, or `AGENTS.md` edit has occurred during this synthesis.

## Rejected premature confirmation checkpoint

After collecting the critique and writing acceptance checks,
the assistant asked whether shared understanding had been reached.
The user rejected that progression:
"We haven't weeded out all failure modes, even just in the Promise toy example."
They requested the updated Promise toy first.

Recording and classifying failures does not establish that they have been resolved or exhausted.
The assistant must demonstrate its interpretation through a materially revised teaching artifact,
then continue discovery from that artifact's failures.
The acceptance proposal is not an approved design or a reason to close the interview.

## Next action

Rebuild and verify `doc/planning/promises-teaching.local.html`,
then visibly present the exact updated artifact in Helium.
Preserve the initial prototype as local evidence and keep local artifacts ignored.
Write additions in chunks no larger than the requested 200 to 500 lines.
Do not write the final skill or ask for final confirmation yet.
Do not edit `AGENTS.md`.
