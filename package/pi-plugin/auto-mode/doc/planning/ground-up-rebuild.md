# Auto-mode ground-up rebuild plan

## Status and review request

Draft for the user's review, 2026-10-19.
Implementation is stopped.
This document proposes a design and dependency inventory; it does not authorize building it.
No replacement source, dependency installation, manifest change, or package build accompanies this plan.

Review the model contract, the host integration proposal, each dependency, and the size budgets.
Reply with corrections or an explicit approval to implement.
Discussion of this plan alone does not resume implementation.

### Assessment before implementation approval

The rule-batching contract now matches the user's stated direction.
The architecture is not yet sufficiently established for implementation approval.
The host proposal depends on experimental Node hooks and private Pi functions,
without a complete demonstrated execution sequence for every required mode.
Rule precedence and final reduction, shadow call accounting, and persistent log retention remain unresolved.
The size ranges are proposed budgets, not evidence that this integration fits them.
The direct dependency-function inventory is present;
the complete resolved transitive development inventory is still missing.
These are substantive limits of this draft, not reasons to resume building while review is pending.

The preserved reference worktree is
`/var/home/user/temp/agent/pi-auto-mode-before-rebuild-20261019`
at `e74f84bb9f60c3e1ea90f1325cf2e64947715ba0`.
Unfinished worker source edits were subsequently checkpointed in `3ef7f32d19`.
Commit `7ac15b19b4` deletes the old `src` from `main`.
The old native implementation and generated artifacts have not been removed.
The package is between implementations and has no current replacement verification claim.

## What rebuilding means

The replacement gets a fresh architecture and implementation in `main`.
Old source, traces, documents, and failures are available as reference material.
Existing abstractions, interfaces, dependencies, and test infrastructure get no automatic place in the replacement.
An existing utility is proposed only for a named responsibility in this document.
Historical tests supply scenarios to examine; their assertions are not automatically correct.

The package's job is to decide whether a specific prepared tool group may execute automatically.
It does not become an agent framework, provider SDK, general policy compiler, or replacement Pi distribution.

## Required behavior

- Luna evaluates authored rules against the current request, with 100 or more meaningful questions per call.
- Each question offers `approve`, `deny`, and unknown probability.
  There are no permission/prohibition, heading, adoption, or other meaning categories.
- Code determines the final `approve`, `deny`, or `ask` outcome.
- Review permits at most three sequential Luna batches and three parallel Luna calls per batch.
  HTTP retries consume those same call slots.
- Subsequent batches adapt question selection to observed results and remaining uncertainty.
  There is no mandatory sequence of semantic classification stages or separate whole-operation judge.
- For `unknown < 0.2`, select the highest-scored action.
  For `unknown >= 0.2`, that action must score at least `0.6`; otherwise ask.
  Exact action ties remain unresolved.
- API requests use platform `fetch` exclusively.
  Auto-mode imports or calls neither `pi-ai` nor `openai`.
- Span 02 observes matching production requests as a shadow and has no decision authority.
- The reviewed operation includes the entire prepared group before any member executes.
  It reflects argument preparation and other extensions' permitted argument mutations.
- Model input contains readable instructions, relevant visible conversation, and structured operations.
  Private thinking and complete raw Bash command archives stay out of model requests.
  Parsed literal arguments and quoted data retain their meaning.
- Ordinary incoming messages are never rejected because a role or category is absent from a local allow-list.
- Cancellation and shutdown stop pending work and produce no bare shutdown errors.
- Every substantial module has its purpose, interface, limitations, and size recorded inside this package.

The current repository `AGENTS.md` contains 213 tagged rules, measured with
`rg --count '^[A-Z0-9]{3}:' AGENTS.md`.
That establishes a real hundred-question workload without inventing filler questions.
It does not establish the final complete rule count after session and package instructions are included.

## Proposed end-to-end flow

1.  Obtain the complete prepared group at Pi's execution seam.
2.  Capture one instruction, conversation, tool-catalog, and operation snapshot for that group.
3.  Parse shell programs locally and construct the model-visible request.
4.  Create rule-versus-request questions and schedule the first batch.
5.  Decode each returned distribution and apply the user's score rule in code.
6.  Resolve the group or select another batch from the remaining uncertainty and rule dependencies.
7.  Ask the user if review remains unresolved after the allowed batches or a required input cannot be obtained.
8.  Execute the reviewed group only after an approval bound to that group, or return a normal blocked result.

An argument or instruction change invalidates the affected review.
It cannot inherit approval merely because a tool-call ID is unchanged.
This needs a snapshot comparison at dispatch, not an object-capability graph spanning the SDK.
Re-review remains subject to explicit operation-level limits; mutation must not create an unbounded review loop.

## Proposed high-level modules and source budgets

These are design budgets, not measured implementation sizes or completion forecasts.
Units are raw Unicode characters, including types, comments, and whitespace.
Formatting remains valid; existing max-lines lint still requires coherent file splits.
An over-budget module requires a revised explanation and review before expanding it.

### Host integration: 10,000 to 16,000 characters

Purpose: intercept complete prepared groups, preserve Pi execution behavior, and bind decisions to execution.
Interface: one review callback receiving the prepared group and its cancellation signal.
The callback returns the group disposition; Pi continues to own actual tool execution and tool results.

It owns parallel, sequential, nested-tool, blocked-result, and shutdown integration.
It must prevent partial execution while a group is awaiting review.
It must retain other extensions' tool hooks and final argument mutations.

This is the largest unresolved architectural risk.
Pi 1.3.0's public `tool_call` event exposes one call and allows later handlers to mutate its input.
Its agent loop prepares calls individually.
Therefore a public per-call extension alone is not established as sufficient for final complete-group review.

Proposed approach: a narrowly scoped, version-qualified Node loading hook on the installed Pi agent loop.
The hook adds a group review seam after preparation and before execution.
It does not copy, compile, or stage Pi, its provider clients, or its dependency tree inside auto-mode.
The approved upstream source fingerprint identifies the supported patch surface.
The Node hook and all execution modes need qualification before this approach can be adopted.

If this cannot fit the budget while preserving host semantics, return the concrete integration problem for review.
Do not silently reintroduce the legacy native framework or broaden the patch to provider serialization.

### Review input capture: 8,000 to 14,000 characters

Purpose: produce the complete model-visible snapshot without leaking thinking or raw shell archives.
Interface: one immutable review input containing authored rule occurrences, visible context, and prepared operations.

It gets effective instructions and the active conversation branch from the host.
It retains source identifiers and precedence context rather than interpreting prose into a meaning taxonomy.
Tagged rules remain original authored text.
Untagged instruction handling must preserve substantive instructions rather than silently discarding them.

It projects shell commands through the shared syntax parser.
It preserves control flow, redirects, expansions, literal arguments, and nested execution structure.
Parsing does not establish expanded runtime values or actual effects.
The original local command remains the command Pi executes.

It projects text from host messages without requiring a closed role enum.
Historical shell parse failures do not reject incoming chat or grant permission to a current operation.
A current operation that cannot be represented completely requires an actionable review failure.

### Question planning and review scheduling: 8,000 to 12,000 characters

Purpose: keep the entire bounded, adaptive review behind one caller interface.
Interface: `review` takes a captured request, authored rules, a provider adapter, and cancellation.
It returns the group outcome and correlated decision evidence.
Callers do not manage individual stages.

It selects prewritten rule-evaluation question forms and binds them to original rule occurrences.
It does not ask another model to manufacture questions or extract rule categories.
The full precedence context accompanies each rule assessment.

Each call carries at least 100 genuine rule/request questions.
Partition only when required by verified provider capacity, balancing groups rather than leaving tiny remainder calls.
The legacy converter's local 200-question cap is not proof of a current provider limit.
Hundred-question capacity must be exercised through the actual selected endpoint before implementation is accepted.

Later batches select rule checks and question forms based on unresolved dependencies and returned evidence.
Already resolved checks may be reassessed when their interpretation depends on a remaining uncertainty.
Question IDs retain source and evaluation-form identity.
Parallel questions are not majority votes and repeated questions are not independent evidence.

If a supported workload cannot supply 100 meaningful questions, or an adaptive follow-up cannot meet that requirement,
bring that concrete conflict back for review.
Do not invent filler or silently ship a one-question fallback.
Input capacity exhaustion also remains unresolved; it never permits dropping required rules.

### Deterministic decision resolution: 2,000 to 4,000 characters

Purpose: implement the score rule and the final group disposition in ordinary code.
Interface: distributions become per-rule dispositions, then a group outcome with decisive rule references.

Proposed reduction for review:

- An admitted `deny` for an applicable rule blocks automatic execution.
- All required rule checks admitted as `approve` permit automatic execution.
- An unresolved check that can change the result triggers another adaptive batch, then `ask` at exhaustion.

Each question assesses its rule under the complete instruction hierarchy and explicit exceptions.
A low-priority rule must not override a higher-priority instruction merely because its score is larger.
This precedence interpretation and the proposed reduction need explicit scenario coverage.
There is no arithmetic averaging of unrelated rules and no separate whole-operation model verdict.

The response codec checks actual API data needed for this calculation:
question attribution, complete expected distributions, finite probabilities, and valid normalization.
It accepts unrelated response metadata and does not validate arbitrary SDK message categories.
Missing, malformed, refused, or unavailable answers remain missing evidence, never manufactured denials or approvals.

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

It preserves the same state, question text, and approval/denial choices.
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
- Returned `flush`: join queued writes during shutdown.
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
- `sessionManager.getBranch` and `sessionEntryToContextMessages`:
  obtain the active branch and public host context projection.
- `sessionManager.getSessionId`: correlate operations without retaining every session object.
- `ui.select`: present scoped manual choices in supported TUI and RPC modes.
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
- `executeNestedToolCall`: cover nested tool invocation rather than allowing it to bypass review.

These names are verified in installed source, but the replacement integration is not implemented or qualified.
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

Build the capture, scheduler, codec, and deterministic reducer behind the single review interface.
Use the real hundred-question scale in request-capture fixtures.
Cover early resolution, adaptive second and third batches, exhausted review, partial call failures,
missing answers, and exact `0.2`/`0.6` boundaries.
Assert model-visible inclusion and exclusion using actual serialized requests.

### Connect primary review and shadow

Exercise the installed Pi consumer with its configured extensions, skills, tool catalog, and preceding turns.
Use disposable target projects and homes for any state-mutating verification.
Then drive supervised MiMo sessions with the accepted replacement and matching Span 02 shadow requests.
Keep original and replacement evidence distinct.
Old legacy shadow traffic does not verify the new question contract.

### Demonstrate regression detection and finish measurement

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

- Whether the proposed narrow private Pi hook is an acceptable integration cost.
- Whether the proposed per-rule reduction expresses the desired approval/denial semantics,
  including explicit exceptions and instruction precedence.
- How to handle a workload with fewer than 100 meaningful questions without inventing filler or a hidden exception.
- Whether the model-call ceiling includes shadow calls, or the separately counted mirror proposal is acceptable.
- Whether the proposed source and deployment budgets are appropriate.
- How to bound persistent decision-log retention through the shared logger, with a version bump if changed.
- Actual provider capacity, parser compatibility, and the resolved development closure,
  all unqualified rather than assumed complete.

No implementation proceeds while the user is reviewing this plan.

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
  `executeToolCalls`, `prepareToolCall`, and `executeNestedToolCall`.
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
