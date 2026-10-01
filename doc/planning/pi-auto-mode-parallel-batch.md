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

- Make the callback reproduction pass with one complete batch assessment.
- Exercise the real scheduler,
  including its serial preparation and parallel execution.
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

No fix is claimed yet.
The native-manager qualification remains separate and has not dispatched its actual SDK run.
The new grouping contract must be incorporated into the eventual real-consumer integration.
