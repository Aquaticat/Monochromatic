# Issue #481: context-owned stub isolation

## Request and scope

The user asks what to do about [issue #481](https://github.com/Aquaticat/Monochromatic/issues/481).
This is investigation and recommendation,
not authorization to implement a production fix.

The user explicitly directs the investigation not to anchor on the issue's proposed fixes.
Their hypothesis is that injected `ctx` enables a code-only solution.
Evaluate that boundary before recommending new test options or structural suite changes.
Do not treat the issue's menu as an exhaustive list.

Suggested clarification to the existing `AGENTS.md` rule `QPM`:
when reviewing an issue,
inspect existing ownership and injection boundaries before adopting its proposed remedies.
This is a proposal,
not an instruction-file change.

## Initial evidence

- `package/module/test/src/it.ts:213` creates a sandbox before calling the test with `ctx`.
- `package/module/test/src/sinon.ts:39` delegates to Sinon's ordinary `createSandbox`.
  Separate sandbox cleanup does not imply separate target objects.
- `package/module/test/src/describe.ts:184` inherits concurrency,
  but each suite dispatches its own children.
- `package/module/test/src/execution-node.ts:173` already creates `AsyncLocalStorage`.
  `runNodeExecution` runs each descriptor in an execution context.
- `package/module/test/src/execution.ts:25` delegates directly outside the detected Node runtime.
- `package/module/logger/src/create-logger.unit.test.ts:748` contains the sequential breadcrumb wrapper.
- `package/module/test/README.md:93` already documents the shared-target collision.
  The issue's claim that the harness has no documentation is broader than the present evidence supports.

## Investigation in progress

Prototype context-routed method stubs in a disposable worktree,
with an unchanged-harness failure control.
Check concurrent owners,
an unstubbed reader,
restoration,
async continuation,
and function-reference semantics.
Separate verified method-stub behavior from unverified broader Sinon and runtime support.

No recommendation or implementation decision has been accepted.
