# Auto-mode ground-up rebuild plan

## Status and review request

Revised to the user's staged design on 2026-10-19.
Implementation is stopped. Plan discussion does not authorize implementation.
The [HTML review](ground-up-rebuild-review.html) shows the active flow, concrete cases, and remaining questions.
Open that review in Helium for the handoff.

The previous first-pass useful-question selector and three-choice interpretation are withdrawn.
Every effective rule is a first-pass question with the choices
`approve`, `deny`, `ask`, and `not-applicable`.
The approximately 100 effective rules are an expectation, not a count imposed by code.
The earlier shortage-of-useful-questions question was also withdrawn;
unresolved-rule count does not measure the supply of useful follow-ups.

This document records settled requirements separately from proposed semantics.
Remaining choices concern score admission, the meaning of an admitted `ask`,
context anchoring, and preparation timing.
The user corrected the approval baseline: assess reversibility, not exact requested-package matching.
The former Q3 and Q5 alternatives are withdrawn; their remaining engineering details follow that baseline.
Dependency qualification, shadow scheduling, retention, and size fit remain open engineering work.
No replacement code, dependency installation, package build, or configuration change accompanies this review.

The preserved reference worktree is
`/var/home/user/temp/agent/pi-auto-mode-before-rebuild-20261019`
at `e74f84bb9f60c3e1ea90f1325cf2e64947715ba0`.
Worker edits were checkpointed in `3ef7f32d19`; `7ac15b19b4` deletes the old `src` from `main`.
Old native code and generated output remain reference material, not verified replacement artifacts.
Existing abstractions, dependencies, and historical test assertions get no automatic place in this rebuild.

## Coding-agent autonomy and reversibility

The user explicitly rejects preventing tests merely because they run in another package.
A coding agent can inspect dependencies, test consumers, compare alternatives, and perform useful supporting work
without the human enumerating every package and command.
The former mandatory positive request-scope gate and package-match follow-ups were too restrictive and are withdrawn.

Assess the prepared group's actual effects and reversibility:
what changes, what can be restored, how restoration works, and what consequences remain after restoration.
Consider recovery effort, existing uncommitted work, shared state, external effects, and resource consumption.
A command called `test` is not an effect description;
a cross-package test against disposable local fixtures differs from a test that deletes shared data.
Likewise, a local edit is not irreversible merely because the user did not spell out that intermediate step.
An edit recoverable from a retained prior state differs from overwriting unrecorded user work.

Routine work with established reversible effects can proceed automatically without exact-call human approval.
Code may establish this deterministically when the relevant effects are known;
otherwise the every-rule model review assesses it.
Unknown effects require investigation or an explained ask about those effects,
not an ask caused only by a different package name.
Irreversible or costly-to-recover consequences receive the corresponding authorization review.
Reversibility does not cancel an explicit human prohibition or supply a missing human-only decision.
Task context helps explain the work; exact package or verb matching is not a generic permission condition.

Acceptance examples for this baseline:

- A change in package A is verified by running package B's consumer tests with disposable local fixtures.
  Approve when the effects are established as routine and reversible; B's name is not an objection.
- An agent tests a hypothesis by editing a disposable checkout with the prior contents retained.
  Treat the recoverable experiment as ordinary autonomous work unless an explicit instruction forbids it.
- A command named `test` resets a shared database without an established recovery path.
  Review that data loss and affected users; the command name grants no shortcut.
- Uploading a report can disclose its content even if the upload can later be deleted.
  Evaluate the disclosure; deleting the uploaded copy does not reverse every effect.

## Settled stages

### Stage 0: effective rules on every Pi start

Send parsed `AGENTS.md` to Luna to identify rules that could be potentially relevant to agent operations.
Retain original rule text, source, heading context, and instruction precedence.
Materialize the effective ruleset and add general-agent built-in rules.
The user expects approximately 100 effective authored rules; do not pad, truncate, or select to that number.
Every Pi start performs this classification, even when cached parsing is reusable.

The existing implementation already contains relevance classification:
`native/contract/integration/native-host/startup-relevance.mjs`
and `native/contract/lifecycle/rule-relevance-cache/refresh.ts`.
However, the old warm-cache path classified only missing rules.
The old definition also excluded tool choice, syntax, style, testing, documentation, and workflow.
Those exclusions do not establish the new remit.
Historical evidence in `doc/handover/pi-auto-mode-frontier-2026-10-18.md`
records 25 retained of 211 classified rules; it is not evidence for the new expected count.
The old threshold and 200-question chunking are legacy choices requiring fresh qualification.

Startup classification is session-wide potential relevance, not a per-operation useful-question selector.
Rule changes require a new effective-rules snapshot before another operation can inherit it.
A failed or incomplete classification must be visible; its missing rules cannot silently disappear.
Startup failure behavior requires qualification before implementation acceptance.

### Stage 1: capture and parse the entire pending group

Capture every pending tool-call set as a group before any member executes.
Prepare every member, including permitted argument mutations by other extensions.
Parse every tool call deeply, retaining tool identity, named arguments, resources, and execution structure.
For shell calls this includes control flow, redirects, expansions, literal values, and nested syntax.
Parsing alone does not establish expanded runtime values or actual side effects.

Bind all review evidence to one immutable group, instructions, tool catalog, and context snapshot.
A changed argument, instruction, branch, or tool definition invalidates affected approval.
Group boundaries follow pending calls; future dynamically created calls are not pretended to exist already.
The relationship between a parent call and result-dependent nested groups must be qualified at the host boundary.

### Stage 2: deterministic parsed checks

Code can immediately return `approve`, `deny`, or `ask` when a named deterministic condition establishes it.
Record the condition, parsed evidence, exact group, and outcome.
A parser-success flag or apparently read-only command is not by itself proof that the whole group is authorized.
The deterministic approval catalogue is a review decision, distinct from selecting model questions.
If no terminal condition applies, continue with every effective rule.

### Stage 3: every effective rule becomes a Luna question

Send the complete prepared group, effective ruleset, and bounded visible context.
For the first pass, each rule is a question. Do not select a useful subset in code.
Each question offers exactly `approve`, `deny`, `ask`, and `not-applicable`.
Bind answer keys to rule occurrences, including built-ins, so missing or duplicate answers are detectable.
Each assessment includes the instruction hierarchy and applicable explicit user exceptions.
An unrelated rule can return `not-applicable`; it need not manufacture permission or uncertainty.

The historical context length is `clamp(5, units since the latest human message, 10)`.
A unit is an assistant thinking/output block or a tool-call set, not Pi's `turn_end` event.
Use available history when fewer than five units exist; never invent padding.
The complete pending group is a separate snapshot field and is never cut down by this history window.
Private thinking content remains excluded under the existing payload constraint;
its boundary can count as a unit without transmitting its contents.
Whether to retain the latest human request separately when outside the window is a remaining choice.

Batch only as required by verified endpoint capacity, with the complete rule context accompanying each partition.
All first-pass rules must receive coverage before automatic approval.
Early terminal denial or required human review can end work without fabricating the remaining answers.
There is no replacement whole-operation judge and no permission/prohibition taxonomy stage.

### Stage 4: aggregate, then refine only unresolved evidence

Normalize Luna's answers into an attributed object and compute the group outcome in code.
No averaging of unrelated rules, majority voting, or repeated sampling until approval.
An answer needs both a valid label and sufficient numeric evidence under the admission policy still under review.
Low-confidence or missing evidence is internal unresolved state, not a fifth answer choice.

When unresolved, construct a new set of questions addressing the particular uncertainty.
For example, decompose uncertainty about a test command’s reversibility into
which environment it targets, whether its writes are confined to disposable fixtures,
and whether any existing state would be lost or externally exposed.
Keep the whole prepared group and relevant rule context visible in every follow-up.
Do not treat uncertainty in one rule as proof that only one useful follow-up exists.
Question wording and bindings must expose the distinction being tested.
The generation and validation mechanism follows the accepted semantic examples;
the previous fixed-form selector is not a settled requirement.

At most three sequential review batches and three parallel Luna calls per batch.
HTTP retries consume those call slots.
Stop early once the outcome is established; unresolved after the permitted batches routes to `ask`.
Stage 0 is startup work, outside the per-group review budget.
Shadow requests are accounted separately only if the proposed shadow policy is accepted.
Conflicting follow-up answers require an explicit reconciliation contract;
newer answers do not silently erase prior evidence merely because they allow execution.

### Stage 5: manual decision and session feedback

Every ask must give the human decision-relevant information beyond the chat transcript and `AGENTS.md`,
which the human can already inspect.
This applies to deterministic asks, admitted model asks, exhausted uncertainty, and review failures.
Before the choices, explain:

- The exact pending action and affected target, briefly enough to identify the decision.
- The concrete evidence or conflicting interpretations that triggered escalation,
  tied to the relevant rule and operation detail.
- What remains unresolved, why automatic review could not resolve it,
  and the particular judgment or missing fact needed from the human.
- What Approve will permit and what Stop will prevent or abort.

A transcript recap, rule dump, score alone, or generic “approve this tool call?” is not an explanation.
Name limits of the reviewer's available context as those limits;
do not claim the human omitted information merely because the snapshot lacks it.
Explain only recorded evidence. Do not invent Luna's reasoning from probabilities or require private thinking.
For unavailable review evidence, state the actual failure and which checks could not be completed.
Keep the explanation attached to the exact snapshot and persist it with the resulting decision.

Illustrative ask:
“The upload targets workspace B. Your request specifies the approved team workspace;
the reviewed evidence does not establish that B is that workspace.
Approve permits this report upload to B. Stop aborts the run without uploading.
Confirm whether B is the intended destination; you may include a reason.”

Offer Approve and Stop for that explained group, with an optional reason for either choice.
Approve records `user approved tool call ...`; Stop records `user declined tool call ...`.
Include the group identity and supplied reason in the durable session record and model-visible session context.
Skipping the optional reason preserves the selected decision.
Stop retains the existing run-abort behavior; dismissal or unavailable UI withholds execution.
An established denial does not turn into an Allow prompt.
A manual approval applies to the displayed group after a freshness check, not future unrelated work.

Pi 1.3.0 provides `ui.select` and `ui.input` in both TUI and RPC declarations.
Use a choice followed by optional reason entry as the initial cross-mode proposal.
Its `ui.custom` RPC implementation returns `undefined`, so a custom TUI form alone cannot satisfy both modes.
The design must verify cancellation during each input step and interruption of stale prompts.

`appendEntry` supplies audit persistence but is not model-visible by itself.
`sendMessage` with `triggerTurn: false` is the candidate feedback channel.
While streaming, the host queues it and flushes after tool results; after Stop, it must remain on the next resume.
`deliverAs: nextTurn` is not equivalent to the next internal assistant continuation.
Verify approval and decline with actual continuation, abort, reload, and resume.
Feedback messages and compaction summaries converted to API user roles must not reset the genuine human anchor.

## Remaining semantic decisions for this round

### Q1: probability admission with four choices

The previous `unknown` was an authored choice, not automatic provider uncertainty.
The current decisions endpoints return probabilities for the caller's choices and may return separate confidence.
Removing `unknown` therefore removes the input to the former 0.2/0.6 formula.
Do not substitute `ask`, missing-score zero, or `1 - confidence` into it.

Concrete distribution: approve 0.46, deny 0.04, ask 0.29, not-applicable 0.21.
Option A admits a unique leading choice only at probability at least 0.6; this example stays unresolved.
Option B admits any unique leader; this example becomes approve.
A avoids treating a split distribution as established but may require more follow-up or human review.
B resolves more distributions immediately but treats a plurality as sufficient.
Ranking: A > B because the split example does not establish a decisive result.
The 0.6 value is a proposed reuse of a previous threshold, not a calibrated model-quality claim.
Exact ties, invalid distributions, or missing answers remain unresolved in both options.

### Q2: ask as a verdict versus uncertainty

For an admitted `ask`, option A means a human decision is required now.
Numerically unresolved answers can use follow-up batches; an established ask routes to the human immediately.
Option B treats every ask as a request for further model questions until the budget is exhausted.
Example: a rule explicitly requires the human to choose which account to charge and no choice exists.
A asks immediately; B can spend the remaining batches before asking.
A avoids repeated questions that cannot supply a human preference; B gives ambiguous asks another chance.
Ranking: A > B because a confident need for a human decision is already a resolved disposition.
This choice does not add another answer label.

Proposed group reduction, pending Q1 and Q2:
any admitted deny blocks; otherwise an admitted substantive ask routes to the human;
otherwise unresolved evidence refines; otherwise approve if all required checks approve or are not applicable.
Approval needs positive evidence for the applicable effects and reversibility checks;
all-not-applicable cannot manufacture that evidence. Exact request or package matching is not required.
A deny based on a superseded instruction is invalid evidence, not a lower-priority veto.
Precedence must be reflected in contextual questions and tested with explicit exceptions.

### Q3 withdrawn: exact-call approval is not the default autonomy boundary

The earlier recommended shortcut policy privileged a recorded approval of the exact call.
It did not provide the intended autonomy for ordinary reversible coding work.
The user’s reversibility correction supersedes that framing.
Deterministic approval conditions must express actual effects and recovery properties,
including cross-package verification, rather than exact package matching or a test-command allowlist.
The concrete effect evidence and recovery checks remain engineering work;
they are not a request to confirm the rejected boundary again.

### Q4: keep the latest human request when the window moves past it

Option A includes the latest genuine human request in a separate snapshot field,
plus the specified five-to-ten-unit visible history.
Option B includes only the capped historical window and whatever request text remains inside it.
Example: after twelve units, the original request says review only,
while the latest ten units discuss possible edits.
A retains review-only scope; B requires asking if the available evidence cannot establish scope.
A preserves the authorization anchor but adds input beyond the historical cap.
B is a literal cap on historical input but can lose the instruction needed to assess the operation.
Ranking: A > B because recency alone does not make the original request obsolete.
Neither API user-role feedback nor compaction entries count as a new human request.

### Q5 revised: built-ins assess effects and recovery

The earlier scope-versus-coverage options are withdrawn.
The proposed built-in questions now operationalize the accepted reversibility baseline:

- What state does this group affect, and do its concrete effects permit routine automatic execution?
- Can changed state be restored from an available prior state without losing existing human work?
- Does the group have external or shared consequences that restoration would not undo?
- Is the recovery effort and resource exposure established well enough to proceed automatically?
- Does the group comply with explicit human restrictions and decisions that remain applicable?

Each is evaluated using the same four answer choices, with question wording that asks for the disposition
under the stated condition, rather than a free-form effects report.
Usefulness and task context can guide investigation without turning every unmentioned intermediate step into a veto.
The precise prompts and effect evidence need scenario qualification;
they must approve the cross-package and recoverable-experiment examples when their stated conditions hold.

### Q6: preparation timing for sequential groups

Installed Pi 1.3.0 prepares and executes A, then prepares and executes B.
A B-preparation hook can therefore read A's result.
The required complete prepared group moves B's preparation before A executes.

Option A adopts prepare-all-once semantics for guarded groups, then executes the frozen arguments in original order.
Extensions needing A's result to prepare B must submit a later group or receive an actionable unsupported-case result.
Option B keeps compatibility by blocking those grouped operations pending an upstream host integration
that explicitly supports the complete-group contract.
Example: A writes a file; B's preparation hook uses that file's new content as an argument.
A requires B in a later group; B declines the incompatible operation without claiming transparent support.
A enables the group contract but changes sequential preparation timing.
B makes the compatibility limit explicit but leaves those grouped operations unavailable.
Ranking: A > B if group preparation is part of auto-mode's public contract,
because it provides a usable execution model without pretending future results already exist.
Neither option authorizes silently reviewing unprepared B or executing A before initial group review.
The patch mechanism remains an engineering qualification, not this user decision.

## Dependency tree after this round

Q1 and Q2 unlock numeric boundaries and final reduction acceptance examples.
The accepted reversibility baseline guides deterministic catalogues and built-in semantic fixtures.
Q4 unlocks snapshot boundary fixtures; Q6 unlocks supported host timing fixtures.
Then settle conflicting follow-ups, Stage 0 failure handling, shadow delivery/accounting,
and retention using concrete designs and their measured constraints.
Source budgets remain proposals pending those designs and exact resolved dependency inventories.
Do not present later dependent choices as settled merely because the flow is now defined.

## Proposed agent-guidance corrections

The former question selector contradicted the stated architecture;
the earlier scarcity question also inferred a constraint from incomplete evidence.
These are proposed edits, not modifications to `AGENTS.md`:

- Tighten `VHI` to:
  “Handoffs state purpose, changes, inspection, and response.
  Show architecture choices with verified HTML diagrams and examples,
  open them in the requested browser, and explain labels.”
- Tighten `QPM` to:
  “Before asking which mechanism, test the constraint against settled requirements and plausible designs.
  Measure facts. Do not reopen a settled choice through an invented mechanism.”

The scope correction also motivates a proposed tightening of the existing `AUT` guidance:
“Execute the requested action with ordinary reversible supporting work, including cross-package tests.
Do not equate a different package with unauthorized work. Honor explicit restrictions.”
This is a proposal, not an edit to `AGENTS.md`.

The missing ask explanation also exposes a diagnostic-guidance gap.
Proposed replacement for the existing `DGT` body:
“Diagnostics name affected inputs and calls.
Every ask explains evidence, uncertainty, needed judgment, and each choice’s effect;
transcript or rule repetition is insufficient. State valid remedies.”

## Proposed high-level modules and source budgets

Budgets are raw Unicode characters including types, comments, and whitespace, not measured sizes or forecasts.
Existing max-lines lint still requires coherent files; formatting is not removed to fit a budget.
Startup and manual feedback responsibilities are included explicitly in the existing module budgets.
Their fit remains unverified.

### Host integration: 10,000 to 16,000 characters

Purpose: expose the complete prepared group, preserve selected execution semantics, and bind review to dispatch.
Interface: a group review callback with cancellation; Pi retains execution, results, and configured extensions.
Own parallel, sequential, nested, denied, aborted, and shutdown paths.
A public per-call event alone does not establish final complete-group interception.

The candidate is a narrow version-qualified Node loading hook in the installed agent loop.
It must not copy or stage Pi, its SDKs, or its dependency tree.
Installed `registerHooks` declarations mark it experimental; private Pi functions are maintenance coupling.
A supported source fingerprint and real host qualification are required before adoption.
Q6 determines the timing contract this seam must implement.

### Rules and review input capture: 8,000 to 14,000 characters

Purpose: startup relevance, built-in rule registration, visible history, and structured prepared operations.
Interface: one immutable effective-rules snapshot and one immutable group snapshot.
Preserve original text and provenance without inventing meaning categories.
Do not silently discard untagged substantive instructions.
Reuse parsing caches only without bypassing every-start classification.

Pi's `getBranch` returns raw active-branch entries;
`buildSessionContext` resolves compaction and context edits through `buildSessionProjection`.
Use original provenance to count human requests and the resolved view for visible context.
Later context transformations also need qualification.
No closed role allow-list may reject ordinary incoming chat.
A historical parse failure cannot authorize the pending group.

### Review scheduling and manual feedback: 8,000 to 12,000 characters

Purpose: every-rule first coverage, bounded adaptive follow-ups, and recorded human decisions.
Interface: one review entry returns disposition and correlated evidence.
Question IDs retain rule occurrence, group snapshot, and follow-up purpose.
No useful-rule filtering occurs in the first pass.
Transport retries and partitioning consume explicit budget slots.
Actual endpoint capacity must be verified with the selected effective rules and payload sizes.

Subsequent questions address recorded uncertainty; contradictory results cannot be silently replaced.
Every ask carries an evidence-backed explanation of the unresolved decision and the consequences of each choice.
That explanation, the manual decision, and the optional reason persist into model-visible continuation or resume.
Keep feedback provenance separate from genuine incoming human requests.

### Deterministic decision resolution: 2,000 to 4,000 characters

Purpose: immediate parsed checks, answer admission, and group reduction in ordinary code.
Interface: named parsed evidence or attributed answer distributions yield a disposition with decisive references.
Q1 and Q2 determine score admission; actual effects and reversibility determine shortcut conditions.
No parser success, missing field, not-applicable-only set, or unavailable answer implies authorization.
Validate answer attribution, expected labels, finite probabilities, normalization, and leading-choice consistency.
Accept irrelevant response metadata; do not require optional confidence or usage fields that reduction does not consume.
Missing, malformed, refused, or unavailable answers are missing evidence.

### Decisions HTTP transport: 6,000 to 10,000 characters

Purpose: encode the shared questions for each endpoint and decode their numeric answers.
Interface: a captured state plus named questions returns attributed distributions and serving-model metadata.

The primary adapter uses `https://api.llmgateway.io/v1/decisions`,
model `openai/gpt-6-luna-decisions`, and `AUTO_MODE_LLMGATEWAY_API_KEY`.
The model's `openai/` prefix is a route identifier, not an SDK import.
The shadow adapter uses `https://openrouter.ai/api/alpha/decisions`,
model `respan/span-02`, and `AUTO_MODE_OPENROUTER_API_KEY`.

It owns lazy credential reads, direct fetch, cancellation, bounded response consumption,
provider-specific envelope differences, and attributable failures.
Redirects and unrequested provider fallback are disabled.
No adapter adds hidden retries beyond the scheduler's counted attempts.
Question text, original rule bindings, and probability values survive endpoint conversion.
The exact response-size and timeout values remain qualification inputs, not invented authorization thresholds.

### Span 02 shadow: 4,000 to 6,000 characters

Purpose: compare Span 02 with the actual primary question sets without influencing execution.
Interface: observe an immutable primary request and its result; retain a correlated shadow comparison.

For group review it preserves the same state, question text, and four answer choices.
The proposed mirror also covers startup relevance using that request’s unchanged relevance-answer schema;
it does not convert startup relevance into operation approval.
Only the endpoint envelope and model identifier differ.
Shadow failures do not become primary permission failures or hold execution open.
Shutdown cancels and joins observer work.

The retained queue, unmatched comparisons, and completed-state cache have explicit bounds.
Correlation includes request occurrence, so identical repeated requests do not overwrite one another.
It does not repeatedly scan ever-growing log files or import the old built policy implementation.

Proposed budget interpretation: the three-by-three limit governs primary Luna review.
Shadow requests are separately counted and dispatched after primary review batches, with a concurrency limit of one.
They do not overlap a primary HTTP batch.
This adds network calls beyond the primary nine-call ceiling and is an explicit review point.
If the ceiling applies to all providers combined, the mirror policy must change before implementation.

### Diagnostics and lifecycle evidence: 3,000 to 5,000 characters

Purpose: reconstruct a verdict without logging the same inputs at every internal helper call.
Interface: correlated operation, batch, request, response, decision, failure, and cleanup records.

Capture full model-visible input once per operation snapshot, distributions once per completed request,
and the final decisive rules and fallback reason once per review.
Keep credential values out of request records and error output.
Use the shared tagged logger, retaining the user's project-first destination with user-state fallback.
No second logging framework or bespoke filesystem-discovery stack is proposed.

The current logger's file sink is append-only; its inspected interface offers a directory, not rotation or retention.
Bounded shadow memory does not bound these persistent files.
Persistent retention is therefore an unresolved shared-logger requirement.
Any proposed shared-logger change needs a concrete design and version bump for auto-publishing.
It is not included as an already solved property of this rebuild.

The 2026-10-19 source review identifies separate logging qualification requirements:
default sinks include console output, and `info` maps to `console.info`.
Verify the chosen configuration through actual RPC stdout and interactive sessions.
The current `flush` may return at its deadline while sink work continues,
and the file sink reports append failures without propagating them to the caller.
Do not equate `flush` with guaranteed durable evidence or complete drain.
Record the evidence-loss and overload behavior separately from disk retention.

### Package entry and bootstrap: 1,000 to 2,000 characters

Purpose: register the host integration before the host execution module loads, and start Pi with its normal settings.
Interface: one CLI entry and one extension factory.

It forwards normal CLI arguments and preserves configured extensions, skills, tools, and RPC behavior.
It uses an explicit recursion guard.
It reports an unsupported host integration once at startup rather than rejecting ordinary incoming messages.
It does not silently continue with the execution guard absent.

## Overall size proposal

- Production implementation, including comments and types: 42,000 to 69,000 characters.
- Verification source and fixtures: 30,000 to 55,000 characters.
- Build and task configuration: 2,000 to 4,000 characters.
- Maintained replacement documentation: 20,000 to 35,000 characters.
- Total maintained replacement text: 94,000 to 163,000 characters.

These totals sum the proposed budgets; they are not estimates derived from an implemented prototype.
Historical documents and archived evidence are reported separately rather than counted as replacement implementation.
No source-line target is proposed.

Proposed deployment budgets for review:

- Package-owned runtime output: at most 1,000,000 uncompressed bytes.
- Total incremental production dependency closure, including the shell parser and logger:
  at most 5,000,000 uncompressed bytes, counted once per actual package.
- Existing Pi and Node installations: measured and disclosed separately, never copied into this package.
- Development dependencies, caches, build tools, logs, and archived releases:
  separately itemized rather than hidden inside an advertised runtime figure.

These byte budgets are proposed ceilings, not verified current footprints.
The final report must include both package-directory usage and followed runtime dependency targets.
No claim of solving the reported package growth is justified by a small entry bundle alone.

## Dependency inventory

This section lists every intended direct package dependency and every symbol auto-mode would use from it.
It also lists runtime transitive packages and host/toolchain dependencies.
An unlisted direct import requires a plan update before implementation.
Function names describe intended calls, not permission to use the rest of a dependency's interface.
No package installation or dependency adoption is performed by this document.

### Production dependency: shared logger

Package: `@monochromatic-dev/module-logger`, inspected version `0.4.4`, declared `workspace:*`.
Import: `@monochromatic-dev/module-logger/ts`.

- `tagged`: construct module and function loggers with correlated tags.
- Returned `debug`, `info`, `warn`, and `error` methods:
  lifecycle detail, decision evidence, degraded review, and actionable failures respectively.
- Returned `flush`: request bounded flushing during shutdown;
  qualify its timeout and failure behavior before claiming complete drain or durable evidence.
- `Logger`: type-only declaration for passing an already tagged logger.

Necessary because this repository requires this logger and complete decision diagnostics.
Its manifest declares no production package dependencies.
The rebuild does not call its internal testing exports, create alternative sinks, or change its version implicitly.

### Production dependency: shared shell syntax projection

Package: `@monochromatic-dev/agent-harness-shared-shell-command-analyzer`,
inspected version `0.0.2`, declared `workspace:*`.
Import: `@monochromatic-dev/agent-harness-shared-shell-command-analyzer/ts/review-structure.ts`.

- `parseShellReviewStructure`: turn Bash into parser-owned structural data while withholding complete source scripts.
- `ShellReviewSyntaxError`: distinguish a current operation that cannot be fully represented from an ordinary message.

Necessary because shell control flow, quoting, substitutions, and redirection cannot be recovered by splitting strings.
The repository already owns this projection.
The rebuild does not use its command-ban helpers or replace parsing with command-name heuristics.

Qualification gap: installed `unbash` is `6.0.0`, while the adapter documentation and catalog comments name version 5.
Reading the source is not proof that the adapter works with version 6.
Reuse stays provisional until its consumed syntax cases and actual model-bound projections pass.

The source review also found a specific contract mismatch to reproduce:
installed declarations expose `Pipeline.prefixes`, `TestLogical.operands`, and `TestNot.negations`,
but the shared projection's `structuralFields` omits those fields and its generic projection filters them out.
Exercise pipeline negation and compound test predicates with positive controls before accepting this dependency.
Any required shared-parser changes need explicit scope and size accounting.
This finding is source evidence, not a completed runtime reproduction or repair.

### Runtime transitive dependencies of the proposed production imports

- `unbash`, inspected `6.0.0`: the shared projection calls `parse`.
  Auto-mode makes no direct import from `unbash`.
  Its inspected manifest declares no production or optional dependencies.
- `@monochromatic-dev/module-logger`: also used internally by the shared parser, counted once.
- `@monochromatic-dev/ownership-marker-foreign-borrowed`:
  declared by the shared analyzer and provides types with no runtime export.
  The selected projection file does not import it; auto-mode introduces no ownership-marker machinery.
  Package-manager installation accounting must still disclose that declared dependency.

Thus the incremental production package inventory is the logger, shared analyzer, parser, and declared type marker.
The emitted import graph must verify this inventory rather than assuming tree shaking removes unwanted code.

### Host-provided Pi interface

Package: `@earendil-works/pi-coding-agent`, inspected `1.3.0`.
Proposed peer dependency plus catalog development dependency for declarations and host fixtures.

- `main`: start the existing Pi CLI with forwarded arguments and the inline extension factory.
  Import occurs after installation of the proposed loading hook.
- `ExtensionAPI` and `ExtensionContext`: type-only declarations for the extension and context.
- `ExtensionAPI.on`: register lifecycle handlers and obtain their unsubscribe functions.
- `ExtensionContext.getSystemPrompt`: obtain effective instructions.
- `sessionManager.getBranch`: obtain original active-branch entries where the selected review contract requires them.
- `sessionManager.buildSessionContext`: candidate for resolved session messages;
  qualify later host context transformations before claiming parity with effective model input.
- `sessionEntryToContextMessages`: convert individual entries only if original-entry conversion is required;
  this is not a substitute for resolved session projection.
- `sessionManager.getSessionId`: correlate operations without retaining every session object.
- `ui.select` and `ui.input`: collect Approve or Stop and an optional reason in TUI and RPC.
- `sendMessage` with `triggerTurn: false`: persist model-visible manual feedback without starting a new run.
- `appendEntry`: optional structured audit metadata, never the sole feedback channel.
- `ui.notify` and `ui.setStatus`: report actionable failures and review state.
- `ExtensionContext.signal`: propagate the host cancellation signal.

Necessary because auto-mode is a Pi execution guard and must preserve the real configured host.
It does not use Pi's model registry, provider dispatch, or provider request serializers to call either decision model.

Pi's own manifest depends on `pi-ai` and other provider machinery.
Those are host dependencies, not proposed auto-mode API clients or copied package artifacts.
This plan cannot claim the whole Pi installation has no such packages.
Auto-mode's own runtime and emitted imports must contain no `pi-ai` or `openai` imports or calls.

### Host agent-loop implementation surface

Package: host-provided `@earendil-works/pi-agent-core`, inspected `1.3.0`.
No new direct application dependency or SDK copy is proposed.
The proposed hook targets the installed `dist/agent-loop.js`.

These private host functions would be used by the narrow prepared-group integration:

- `executeToolCalls`: insert the group-level preparation and review seam.
- `prepareToolCall`: retain the host's argument preparation, validation, and existing pre-execution hooks.
- `executePreparedToolCall`: execute exactly the reviewed prepared call.
- `finalizeExecutedToolCall`: retain post-execution hooks and result handling.
- `emitToolExecutionUpdate`: retain streaming tool updates.
- `emitToolExecutionEnd`: retain final execution events.
- `createToolResultMessage` and `emitToolResultMessage`: preserve host result messages and ordering.
- `shouldTerminateToolBatch`: preserve batch termination semantics.
- `createErrorToolResult`: represent denied and cancelled calls through ordinary host results.
- `runToolCall`: cover individual nested tool invocation as well as the root group path.
  The host session routes `_executeNestedToolCall` through this exported core function.
  Complete result-dependent child-group review is not established by intercepting individual calls.

The original inventory incorrectly named `executeNestedToolCall` as a core function;
the 2026-10-19 source review corrects that name and location.
The replacement integration is not implemented or qualified.
Private-function coupling is a concrete maintenance cost, not a public SDK guarantee.
Source-version qualification and real host tests are mandatory if this proposal is approved.

### Node runtime and built-in functions

No additional HTTP, filesystem, process-runner, hashing, or module-loader package is proposed.
Node is the runtime already used by the repository.
The following is the intended built-in import/call inventory:

- `node:module`: `findPackageJSON` locates host package metadata;
  `registerHooks` installs the narrowly targeted loading hook;
  returned `deregister` releases it where lifecycle permits.
  Installed declarations mark `registerHooks` experimental; it needs consumer qualification.
- `node:fs/promises`: `readFile` reads explicitly selected metadata or instruction files;
  `realpath` establishes the actual host locations.
- `node:path`: `dirname`, `resolve`, and `join` construct paths from resolved host locations.
- `node:url`: `fileURLToPath` and `pathToFileURL` cross module-URL/filesystem syntax correctly.
- `node:crypto`: `createHash` fingerprints the qualified host source and captured request;
  `randomUUID` distinguishes repeated request occurrences.
- Platform `fetch`: the only HTTP sender.
- `AbortController.abort`, `AbortSignal.any`, and `throwIfAborted`:
  link operation, observer, and shutdown cancellation.
  Any timeout signal and its value require the transport qualification described in this plan.
- `TextEncoder.encode` and `TextDecoder.decode`: count wire bytes and decode bounded response chunks.
- Standard `JSON.parse`/`stringify`, `Promise.allSettled`, and `Promise.withResolvers`:
  data envelopes, joined parallel results, and lifecycle barriers.
- `performance.now`: measure observed durations rather than infer them from a clock target.
- `process.argv`, `process.env`, and `process.execPath`:
  forwarded host arguments, named credentials/recursion guard, and test child runtime.

The hook consumes the source returned by Node's next loader.
There is no recursive package traversal, source-code compiler, SDK dependency relinker, or global monkey patch.
Only the explicitly qualified host module is transformed.

### Test-only dependencies and functions

Package: `@monochromatic-dev/module-test`, inspected `0.0.2`, declared `workspace:*`.

- `describe` and `it`: named behavioral suites against freshly built output.
- `expect`: outcome, payload, event-order, cancellation, and emitted-output assertions.
- `expectTypeOf`: public declaration checks against host-facing types where useful.
- Per-test `sinon.spy` and `sinon.stub`: observe injected HTTP calls and lifecycle events with automatic cleanup.

Package: `typebox`, supplied by the existing catalog, development-only.

- `Type.Object` and `Type.String`: declare the small registered-tool schemas in actual Pi integration fixtures.
  Production auto-mode does not register replacement tools and needs no schema-builder import.

Node test-only functions:

- `node:http.createServer`: real loopback response, malformed-data, redirect, and cancellation fixtures.
- `node:events.once`: wait for actual server/process events without polling sleeps.
- `node:child_process.spawn`: run the real Pi CLI and collect both output streams.
- `node:fs/promises`: `mkdtemp`, `mkdir`, `writeFile`, `readFile`, `stat`, and `rm`:
  disposable homes, projects, captures, and cleanup with deletion constrained to the created fixture.
- `node:os.homedir`: create durable scratch fixtures under the injected user's home.

The module-test development closure includes its existing assertion and sandbox packages,
including `chai`, `chai-as-promised`, `expect-type`, `sinon`, `sinon-chai`, `p-limit`,
`@types/sinon`, and its workspace helper modules.
Auto-mode imports none of those directly or in production.
Its complete installed development closure needs a generated resolved inventory before implementation acceptance;
this document does not claim a full transitive development-package audit has already been performed.

### Build and type dependencies and functions

- `@monochromatic-dev/config-rolldown`, declared `workspace:*`:
  `nodeConfig` creates the ordinary Node bundle and declarations.
  Its `rolldown` and `rolldown-plugin-dts` dependencies remain development tools.
  No custom SDK emission or native compiler pipeline is proposed.
- `@monochromatic-dev/config-typescript`, declared `workspace:*`:
  the `dom` configuration supplies repository TypeScript rules and fetch-related platform types.
  This is configuration data, with no runtime function calls.
- `@types/node`, from the existing catalog:
  Node declarations only, with no runtime functions.
- Repository-root `typescript`, `rolldown`, `oxlint`, and `oxlint-tsgolint`:
  existing type, bundle, and lint commands invoked through package-scoped `mise run` tasks.
  They are not shipped runtime dependencies.
- Existing `@monochromatic-dev/dev-script-task-util` task entry points:
  `tsc-filter` and `oxlint-wrapper` preserve the repository's type and lint execution conventions.
  Auto-mode imports no helper functions from this package into production.
- `mise` and `pnpm`: task dispatch and generated dependency-lockfile management.
- `podman`: disposable verification with a two-GiB memory and two-CPU limit.
  It is a verification requirement, not a production runtime dependency.

Any shared configuration bundling that pulls in unwanted runtime code is a qualification failure to investigate.
Changing shared lint rules or replacing the repository build stack is outside this proposal.

### Deliberately absent dependencies

There is no direct `pi-ai`, `openai`, model-review SDK, model-selection SDK, `nano-spawn`,
generic schema validator, policy compiler, ownership-capability framework, or native/Wasm build dependency.
No SDK source tree, provider serializer, tool implementation, or Node installation is copied into auto-mode.
The shell parser and shared logger are the only proposed production library responsibilities outside Node and Pi.

## Implementation and verification sequence after review

### Establish the host seam and dependency facts

Qualify the proposed host hook with a minimal actual Pi consumer before expanding the design.
Cover parallel, sequential, nested, mutated-input, denied, cancellation, and configured-extension behavior.
Generate the exact resolved production and development dependency inventories and disk accounting.
Qualify the consumed parser projection against installed `unbash` 6.
Verify actual hundred-question endpoint capacity without executing proposed operations.
An unsupported assumption returns to this plan; it does not trigger an unreviewed framework expansion.

### Implement review through one interface

Build startup relevance, capture, scheduler, codec, deterministic reducer, and manual feedback.
Assert every-start classification and complete effective-rule first-pass coverage in captured requests.
Use the actual effective ruleset at the expected hundred-rule scale.
Cover early resolution, adaptive second and third batches, exhausted review, partial call failures,
missing answers, every admitted label, and the exact probability boundaries accepted in Q1.
Exercise the five-to-ten-unit window, original human provenance, and approval/decline reasons on resume.
For every ask-producing branch, assert a concrete evidence-backed explanation, unresolved judgment,
and action consequences in the actual TUI/RPC payload; a generic prompt must fail the fixture.
Assert model-visible inclusion and exclusion using actual serialized requests.

### Connect primary review and shadow

Exercise the installed Pi consumer with its configured extensions, skills, tool catalog, and preceding turns.
Use disposable target projects and homes for any state-mutating verification.
Then drive supervised MiMo sessions with the accepted replacement and matching Span 02 shadow requests.
Keep original and replacement evidence distinct.
Old legacy shadow traffic does not verify the new question contract.

### Demonstrate regression detection and finish measurement

Replace package tasks that still build the native pipeline or reference deleted `src` files.
The replacement type-check input must exclude retired native implementation unless explicitly required.
Start acceptance from fresh replacement artifacts; old `dist` output cannot supply a passing result.
Verify the project-first log destination without the legacy task environment overriding it.

Commit important guard tests, remove each guard in a disposable copy, rebuild, and show the intended failure.
Restore and demonstrate the original behavior passes.
Capture complete stdout and stderr for stop, abort, deny, allow, and shutdown scenarios.
Compare test cases against actual branches, not only a green process exit.
Run the package's full type check, lint, and relevant tests with current artifacts.
Do not loosen lint rules or reject valid wrapping to meet a size budget.

Measure production, verification, configuration, documentation, emitted output, dependency targets,
logs, caches, and archived artifacts separately.
Any ignored-file cleanup first gets the required dry-run and stray-Git-entry checks.
No cleanup or deletion is performed as part of writing this plan.

## Decisions still requiring review or qualification

The current semantic frontier is Q1, Q2, Q4, and Q6 in this document and the HTML form.
The package-match gate is rejected; the former Q3 and Q5 options are withdrawn.
Further dependent work covers follow-up conflicts, startup failures, shadow call accounting and preemption,
persistent log retention, exact dependency closure, and source/deployment budgets.
Actual host semantics, endpoint capacity, parser compatibility, RPC output, and lifecycle behavior remain unqualified.
No implementation proceeds while the user is reviewing this plan.

## Review artifact verification

The revised HTML passed the disposable nested-browser interaction check on 2026-10-19.
Every scenario, navigation control, all 18 answer options, and manual Approve/Stop examples with and without reasons ran.
Reply generation passed for empty input, notes only, choices only, literal markup, text selection, and keyboard activation.
All 23 interactive controls measured at least 48 pixels in both dimensions.
Light and dark appearances and a 390-pixel viewport passed without horizontal overflow.
Expanded built-in wording and preparation timelines were recaptured after their final edit.
Browser error and console records were empty.
This verifies the planning artifact, not plugin behavior or model quality.

Retained images:
[active stages](ground-up-rebuild-review/staged-overview-dark.png),
[score admission](ground-up-rebuild-review/staged-q1-dark.png),
[ask meaning](ground-up-rebuild-review/staged-q2-dark.png),
[deterministic approval](ground-up-rebuild-review/staged-q3-dark.png),
[human anchor](ground-up-rebuild-review/staged-q4-dark.png),
[built-in wording](ground-up-rebuild-review/staged-q5-dark.png),
[preparation timing](ground-up-rebuild-review/staged-q6-dark.png),
[manual feedback](ground-up-rebuild-review/staged-manual-dark.png),
[light appearance](ground-up-rebuild-review/staged-scenario-tests-light.png),
and [narrow response form](ground-up-rebuild-review/staged-response-narrow.png).
The later ask-explanation clarification is shown in
[light](ground-up-rebuild-review/explained-ask-light.png)
and [dark](ground-up-rebuild-review/explained-ask-dark.png).
Its Approve/Stop examples passed with and without reasons, including literal markup in reason text.
The updated panel fits a 390-pixel viewport and has no page errors or console messages.
The older `staged-manual-dark.png` shows the prior manual example;
the other screenshots without the `staged-` or `explained-ask-` prefixes document the superseded review.

## Inspected sources

These are source-reading facts, not new runtime qualification results.

- [Shared logger manifest][logger-manifest], [tagged functions][logger-tagged], and [file sink][logger-file].
- [Shared parser manifest][shell-manifest], [projection implementation][shell-projection], and [adapter README][shell-readme].
- [Shared test harness manifest][test-manifest] and [Node build configuration][build-config].
- [Existing adaptive assessment requirements][assessment] and [Span 02 trial][span-trial].
- Installed Pi `1.3.0` public declarations in
  `package/pi-plugin/auto-mode/node_modules/@earendil-works/pi-coding-agent/dist/index.d.ts`
  and `dist/core/extensions/types.d.ts` under that same installed package.
- Installed Pi agent core `1.3.0`, `dist/agent-loop.js`:
  `executeToolCalls`, `prepareToolCall`, and `runToolCall`.
  Resolved installed path:
  `node_modules/.pnpm/@earendil-works+pi-agent-core@1.3.0_undici@8.12.2/node_modules/@earendil-works/pi-agent-core/dist/agent-loop.js`.
- Installed Pi coding agent `1.3.0`, `dist/core/agent-session.js:388` and `:401`:
  `_executeNestedToolCall` routes through core `runToolCall`.
- Installed Pi coding agent `1.3.0`, `dist/core/session-manager.js:256` and `:1058`:
  resolved projection differs from reading branch entries.
- Installed Node declarations, `node_modules/@types/node/module.d.ts`:
  `findPackageJSON` and experimental `registerHooks`.

[logger-manifest]: ../../../../module/logger/package.json
[logger-tagged]: ../../../../module/logger/src/tagged.ts
[logger-file]: ../../../../module/logger/src/sink/file.ts
[shell-manifest]: ../../../../agent-harness-shared/shell-command-analyzer/package.json
[shell-projection]: ../../../../agent-harness-shared/shell-command-analyzer/src/review-structure.ts
[shell-readme]: ../../../../agent-harness-shared/shell-command-analyzer/README.md
[test-manifest]: ../../../../module/test/package.json
[build-config]: ../../../../config/rolldown/src/index.node.ts
[assessment]: ../../../../../doc/planning/pi-auto-mode-batched-assessment.md
[span-trial]: ../span-02-trial.md
