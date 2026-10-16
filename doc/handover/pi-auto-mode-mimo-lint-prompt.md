# MiMo v2.6 Pro lint cleanup prompt

## Purpose

Paste the task section into a new MiMo v2.6 Pro coding session in this repository.
It hands off remaining auto-mode lint work after replacing the decision core and restoring native behavior.
It preserves selected decision context, scoped confirmation, bypass, and verified release activation.
Review the measured diagnostics and behavioral evidence in the resulting commits.
The prompt itself has not been benchmarked against alternative prompts.

The bounded work cycle and explicit repeat-call rule are deliberate:
Xiaomi documents unnecessary repeated tool calls as a MiMo v2.6 failure mode in its
[tool repetition analysis](https://mimo.xiaomi.com/zh/blog/mimo-v2-6-tool-call-repetition).
This is a task-level mitigation,
not a claim that a prompt replaces model or harness fixes.

## Task prompt

You are implementing lint fixes in `package/pi-plugin/auto-mode` in the current repository.
Finish the remaining maintained-code lint queue while preserving Pi's working native behavior.
Work autonomously through verified changes until the queue is complete or a concrete blocker requires user input.

### Establish the current state

Read `AGENTS.md`,
applicable package instructions,
and `doc/handover/pi-auto-mode-current-frontier.md`.
Treat its active-work section as current and its named measurements as historical.
Use `doc/handover/pi-auto-mode-axiom-evaluation.md` only for evidence needed by the boundary you change.
Inspect repository status and preserve concurrent changes.

Run the package's complete maintained lint task through `mise run`,
save its untruncated output,
and count diagnostics by file and rule.
Verify the configured input scope includes maintained native modules.
The last pre-bypass measurement was 826 files,
zero errors,
and 10151 warnings.
Those numbers are a historical reference,
not a current baseline.
The subsequent host-isolation focused check covered 40 changed files,
with zero errors and 2709 warnings.
It exited nonzero for warnings and is not a complete-package count.
The replacement's type checking and relevant built-consumer regressions passed.
Live configured-host Luna checks verified scoped Allow, prohibition, and independent external approval requirements.

Read root and package `mise.toml` before selecting commands.
Existing tasks include `lint:oxlint`,
`lint:types`,
`build:js:node`,
`build:native`,
`test:native:domain`,
`test:native:approval-context`,
and `test:native:bypass`.
Invoke package tasks as `mise run //package/pi-plugin/auto-mode:<task>`.

### Preserve the repaired behavior

Pi owns ordinary chat, provider switching, retries, navigation, reload, and native callback effects.
Auto-mode starts the judgment at complete-group dispatch and captures operation-local native currentness.
Preserve passive prompt, event, and transport observation when capture fails.
Unresolved or failed clause assessment first reaches Luna's complete-operation decision question.
Only exhausted automatic paths or unavailable original inputs fall back to manual approval of the exact group.
An established policy decision or approval remains binding when its dependencies become stale;
the fallback must not open a second dialog that bypasses it.
Use `test:native:session-actions`, `test:native:host-isolation`, and `test:native:manual-group`
when changing these boundaries.

Shift+Tab now toggles explicit bypass through `src/native-bypass.ts` and native resource registration.
Enabled bypass executes native tools and nested programs without semantic assessments or fabricated approvals.
Disabled bypass restores normal policy enforcement.
Programs outside automatic inspection then require manual approval; Stop executes nothing.
Session reload preserves state;
the visible status and session audit entries remain meaningful.
The fixed virtual-input guard runs in both modes.
The integration regression test is `test:native:bypass`.
Bypass also supports ordinary native programs outside the guarded semantic profiles.
Do not move semantic profile preparation back ahead of the bypass branch.

`native/contract/integration/action-policy/decision-core.mjs` now owns decision composition.
The former `evaluate.mjs`, `index.mjs`, and `reviewer.mjs` forwarding paths were removed on 2026-10-15.
Preserve this consolidation rather than restoring a parallel decision framework.
Assessment context selects the legacy five-message floor or complete latest-user span before candidate issuance.
Keep complete current instructions and complete selected messages;
retained archives and the raw provider request must not return as additional model input.
Each clause question also carries the complete proposed operation.
The regression is `test:native:decision-context`.

Unresolved prerequisite estimates must reach the decision model rather than becoming terminal restrictions.
Last-resort Allow authorizes the exact group without rewriting those estimates as satisfied external facts.
Established prohibitions and final model denials remain terminal.
Retain correlated assessment inputs, source references, distributions, admission, and fallback reasons in logs.
Use `test:native:approval` and `test:native:manual-review` when changing this boundary.
Use `test:native:decision-fallback` for model-before-dialog routing and diagnostic reconstruction.

Native builds stage immutable releases, including their matching maintained policy bundle,
and validate CLI loading before changing the active link.
Use `test:native:build-activation` for changes to build publication.
Do not relocate or delete a release referenced by a running process.

Normal prompt capture retains complete text, source lists, tool metadata, and follow-up history
without fixture-derived byte or occurrence ceilings.
Keep explicit cycle detection, accessor/proxy rejection, source ownership, and freshness checks.
The capture regression is `test:native:prompt-capacity`.

Direct native Bash calls now receive automatic review alongside inspected programs.
Preserve complete command strings and whole-group assessment,
including mixed direct Bash and codemode groups.
Live Luna dispatch has been exercised with all 140 cached MCP tools;
model uncertainty still uses scoped confirmation.
Use `test:native:direct-bash` and `test:semantic-operating-policy` when changing admission.
Keep retained-origin lookup linear in catalog size,
parent checks at both collection boundaries,
and registered schemas free of aggregate property-count ceilings.
Use `test:native:run-message-freshness`, `test:native:source-freshness-work`,
and `test:native:tool-schema-capacity` when changing capture.
Configured-host checks must retain the real extension, skill, and MCP metadata scope.
Disabling MCP omitted the original first-group failure and did not establish readiness.

Complete assessments use at most three sequential bundles of up to three parallel provider calls.
Each provider request contains at most 200 questions and complete shared context.
Keep exact question names, answer ordering, shared cancellation, retired capability rejection,
and the original fifteen-second preparation-inclusive deadline.
Failed bundles and eligible retries consume the same allowance.
The average USD 0.001 per judgment cost limit was removed.
The built regression is `test:assessment-bundles`.
Do not reinstate size-triggered manual review as a workaround for request construction.

Preserve original response,
judgment,
source,
tool,
and callback ownership.
Keep cancellation,
ordering,
once-only cleanup,
error constructors,
error identity,
and failure timing intact.
`retainExecutionSources` supports both approved and explicitly bypassed execution;
it retains dependencies and does not issue permission.
Avoid changes to provider choices,
user configuration,
approval policy,
or native installation while performing lint cleanup.

### Work one boundary at a time

Select a coherent diagnostic cluster from the current measurement.
Historical candidates are the remaining `prepared-dispatch.mjs` coordination code
and `program-profile-reviewed.mjs`.
Prefer the current measured queue over those historical priorities.

Read the relevant linter implementation and offending values.
Explain the intended invariant briefly,
then make the code shape satisfy it.
Extract typed sibling modules when a real ownership or lifecycle boundary exists.
Reuse the original module's diagnostic constructors and borrowed callbacks where identity matters.
Preserve real mutation contracts;
an analyzer limitation is not evidence of a runtime mutation.

Keep lint rules,
file coverage,
and severity unchanged.
Do not hide findings with broad casts,
suppression comments,
ignored files,
fake contracts,
or generated copies of maintained code.
Treat a needed semantic change as a separate design decision requiring explicit acceptance.

For each boundary:

1.  Record the baseline behavior and the concrete invariants its consumers must retain.
2.  Implement and commit scoped changes according to repository commit rules.
3.  Build the maintained exports and native consumer as needed,
    run package type checking,
    and exercise the built consumer through the relevant test tasks.
4.  For changed execution or ownership paths,
    compare against the original implementation in disposable fixtures.
    Include an allowed-versus-blocked positive control and relevant failure paths.
    Prove new guards can fail using process-local omissions or disposable artifacts.
5.  Run focused lint,
    then recount complete maintained diagnostics after the boundary is verified.
    Explain any increases rather than claiming progress from one clean file.
6.  Update the current handover with commits,
    measured results,
    unresolved findings,
    and the next concrete boundary.
    Start the next queued boundary without waiting for a continuation request.

Use existing replay and omission fixtures where they fit.
Historical scratch artifacts live under `${HOME}/temp/agent/pi-tool-call-scope-20261014/`;
verify their existence and inputs before relying on them.
Keep state-mutating verification in disposable fixtures.
Use the package's configured resource bounds.

### Keep tool use tied to evidence

Before each call,
identify the unresolved fact,
edit,
or verification it serves.
Batch independent reads;
sequence edits before commands that consume them.
Retain useful results in the handover instead of repeatedly rediscovering them.
Repeat a command only after relevant state changed,
to resolve a transient failure,
or to perform a named control.
If the same failure recurs with unchanged inputs,
inspect its cause and change the experiment.
Summarize findings and next actions without exposing private reasoning.

### Completion

Finish when the complete maintained lint scope reports zero errors and warnings,
the package type check and affected built-consumer tests pass,
and native bypass plus ordinary policy enforcement still pass their regression checks.
Document the measured scope and any surfaces not exercised.
Report commits,
before-and-after diagnostics,
verification commands and results,
and remaining blockers.
Never describe a subset as completion of the whole queue.
