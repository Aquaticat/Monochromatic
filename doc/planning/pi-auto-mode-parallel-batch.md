# Assess parallel tool calls as one judgment

## Accepted requirement

On 2026-10-01,
the user requested fixing the latent per-tool judgment behavior:
parallel tool calls must be judged as one.
The assessment input must contain the complete batch and combined effects,
including interactions that are not visible when each call is assessed separately.
The three-call ceiling,
five-second total deadline,
and average US$0.001 cost target apply to that combined judgment,
not separately to each member.

No member may start before the batch decision.
This is an admission requirement,
not a promise to roll back tools that later fail during execution.
A batch decision does not make filesystem or network operations transactional.

## Reproduction

The provider-free probe invoked the real built auto-mode extension's registered `tool_call` handler
with concurrent synthetic read events and an injected evaluator.
No represented read or provider call was executed.

`proc_20ac` exited 1 with:

```text
# contract/diagnostic/parallel-tool-batch/reproduce.mjs:38
AssertionError [ERR_ASSERTION]: Parallel batch must be assessed once, not once per tool
2 !== 1
```

The returned evidence recorded two evaluator invocations,
each containing only one call's input.
The first received empty sibling context;
the second received an already-completed approval for the first.
This is not one combined judgment.
The real host's parallel scheduler was not exercised by this initial callback reproduction.

The tested built artifact was `package/pi-plugin/auto-mode/dist/final/node/index.mjs`,
SHA-256 `de44e07774252c3268bc893c6493bf02c539ef95243255e3edb107e50c010185`.
The local fixture and retained result live in `contract/diagnostic/parallel-tool-batch/`
of the separate qualification repository.

## Real scheduler reproduction and private fix prototype

A second reproduction used installed pi-agent-core 1.0.0's actual `runAgentLoop`,
a scripted assistant response,
the same built auto-mode extension,
an injected evaluator,
and inert tools.
`proc_2172` exited 1 at the expected assertion:
two evaluations instead of one.
Both low-level hook invocations had access to the complete two-call assistant manifest.
No provider call or real read operation occurred.

The private `batch-admission.mjs` prototype captures immutable member identities and serialized inputs,
shares one in-flight assessment,
and never waits inside the first hook for sibling hooks to arrive.
A changed,
unknown,
or reused member cancels the group.
It is not installed into production auto-mode.

`proc_46b7` exited 0 after 11 controls through the real 1.0.0 scheduler,
plus duplicate-identity rejection:

- Single write and single Bash fixtures each execute their inert tool after one assessment.
- A parallel positive group receives one assessment before both inert executions.
- The combined write-plus-Bash fixture is blocked despite both singleton positives.
- Whole-group denial executes no members.
- Changed second-member input cancels the first member before it can execute.
- Cancellation,
  stale context,
  assessment failure,
  malformed decision,
  and an unknown second member execute nothing.

The tested host-loop SHA-256 is
`65def8c7f3fa01e38fe05467520efc8673c22ea8197833a3b04b29c8a60cb1e3`.
These controls do not qualify nested grouping,
post-guard input mutation,
production extension wiring,
human approval,
or provider calls.
No `AgentSession` was constructed.

## Deciding source and integration gap

`package/pi-plugin/auto-mode/src/index.ts:478` copies `currentTurnBatch`
and calls the injected evaluator for the current event.
It adds that event's verdict only after evaluation returns.
The batch is retrospective context,
not a complete pending execution set.

Installed Pi 0.99.2 `dist/core/agent-session.js:308` forwards a per-call event
containing call ID,
tool name,
input,
and optional parent ID.
It does not forward the low-level hook's complete assistant message as a batch manifest.

Installed pi-agent-core 0.99.2 `dist/agent-loop.js:411` prepares each parallel member serially,
awaiting its hook,
then invokes the prepared execution functions through `Promise.all`.
Consequently,
a first per-call hook that waits for all sibling hooks to arrive can deadlock the preparation loop.
Do not implement that barrier.

The same source at `prepareToolCall` applies tool argument preparation and validation before the hook.
Extension `tool_call` handlers can then mutate input;
`extensions/types.d.ts:939` explicitly says later handlers see earlier mutations.
A raw assistant-message snapshot alone is not proof of the final arguments executed.

## Required fix shape

The admission seam needs a complete,
immutable pending-batch manifest and a shared result before member execution.
It must preserve:

- Explicit batch identity and exact member identities,
  distinct from timing overlap or a shared parent ID.
- Complete effective inputs after relevant argument transformations.
- One code-owned assessment of all members and combined effects.
- One shared decision and one shared call,
  cost,
  deadline,
  and cancellation budget.
- Fixed blocks before bypass or model estimates.
- Rejection of changed membership or inputs rather than reuse of a stale group result.
- Group-scoped human presentation and approval,
  with no grant inferred from machine verdicts.

The default implementation must not release already-approved siblings after a later sibling invalidates the group.
A cached per-call verdict is not a replacement for group admission.
Unflagged members still belong in the combined assessment scope when another member or their interaction needs judging.
Keep the existing finite supported-tool scope;
this requirement does not silently qualify arbitrary custom or MCP tools.

Top-level sibling calls and nested calls require separately verified integration.
Pi's nested runner receives individual `ctx.executeTool()` requests,
not a declaration of an entire future `Promise.all` set.
A shared `parentToolCallId` can include sequential dependent calls too.
Do not group all descendants together or guess group membership from a short timer.
The orchestration seam must supply the actual complete parallel set.

## Remaining verification

- Integrate the qualified batch-admission seam into the real extension rather than only the private prototype.
- Preserve the demonstrated real-scheduler serial preparation and parallel execution behavior.
- Verify zero execution on group denial,
  changed inputs,
  cancellation,
  or incomplete manifests.
- Demonstrate a combined-effect rejection that individually permissive judgments would miss.
- Keep separate sessions,
  turns,
  sequential calls,
  and unrelated nested groups isolated.
- Verify one group-level prompt and shared model-call accounting.

A finite private fix prototype passed;
a deployed extension fix is not claimed.
The native-manager qualification remains separate and has not dispatched its actual SDK run.
The new grouping contract must be incorporated into the eventual real-consumer integration.
