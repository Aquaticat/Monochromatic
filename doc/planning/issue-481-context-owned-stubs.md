# Issue #481: context-owned stub isolation

## Request and scope

The user asks what to do about [issue #481](https://github.com/Aquaticat/Monochromatic/issues/481).
This is investigation and recommendation,
not authorization to implement a production fix.

The user explicitly directs the investigation not to anchor on the issue's proposed fixes.
Their hypothesis is that injected `ctx` enables a code-only solution.
The investigation tested that boundary before recommending new test options or structural suite changes.

Suggested clarification to the existing `AGENTS.md` rule `QPM`:
when reviewing an issue,
inspect existing ownership and injection boundaries before adopting its proposed remedies.
This remains a proposal,
not an instruction-file change.

## Recommendation

Pursue **context-owned method stubs behind the existing `ctx.sinon` API** as the primary fix.
The code-only approach is demonstrated for the Node method-stub case,
not yet implemented for production or established across the full Sinon surface.
Keep #481 open until production acceptance passes.

The caller should still write:

```ts
// Test body, unchanged API.
const warn = ctx.sinon.stub(console, 'warn');
```

Internally:

- Associate each test-body attempt with a unique ownership token.
- Let Sinon create its fake on an owner-private target.
- Make actual method reads select that owner's fake,
  falling back to the original for an owner without a replacement.
- Restore only the completing owner's replacement.
- Reject new mutations from completed attempts,
  including timeout tails.

`ctx` identifies who installs the fake.
It does not travel into arbitrary code calling `console.warn`.
Async execution context supplies that missing connection in the prototype.
A private sandbox alone,
or a proxy only passed to the test,
does not isolate what unchanged code reads from the real global.

## Evidence and limits

[Source trace, runnable experiment, and results](../troubleshooting/sinon-context-owned-stubs.md)
are the canonical evidence.
The [disposable patch](../troubleshooting/sinon-context-owned-stubs.patch) preserves the experiment.

The unmodified harness failed a forced-overlap control with Sinon's double-wrap error.
An unstubbed sibling also observed another test's fake.
After changing only the fork's harness,
the same ownership assertions passed.
Additional probes passed against actual `console.warn`,
timer continuations,
repeat cleanup,
stale restoration,
and timeout-tail method reads.
Package `lint:types` exited zero.

The experiment also verified a consequential boundary:
an unbound `EventEmitter` callback reads under the emitting context,
not the context that registered it.
A fake reference already captured by one owner retains that fake's identity when another owner invokes it.
Do not describe either behavior as universal registration-owner isolation.

This is feasibility evidence through real source-level `describe` and `it`,
not a complete implementation,
full Sinon compatibility,
a browser test,
or a rebuilt logger-suite result.
An independent reviewer accepted the direction with the production gates in this plan.

## Ranked approaches

### Context-owned method replacement, recommended

Pros:
fixes the demonstrated conflict without test-author scheduling metadata,
retains concurrent execution,
and also isolates unstubbed readers in the proven method case.

Cons:
requires runtime context support and explicit method/property semantics.
The temporary getter is observable through descriptor reflection.
Broader Sinon operations and lifecycle rejection still need implementation and verification.

### Existing sequential ancestor, fallback

Pros:
already available,
requires no new harness API,
and keeps ordinary replacement semantics during normally completing tests.

Cons:
requires test restructuring,
serializes the grouped work,
and does not itself cancel timed-out bodies.
Other tests outside that ancestor may still read a replacement.

### New exclusive scheduling option

Pros:
could provide a declared boundary for opaque shared state that cannot be context-selected.

Cons:
adds test-author metadata and scheduler semantics without being necessary for the demonstrated method case.
Excluding only competing writers would still miss readers;
excluding every test gives up concurrency.
Timeout and detached-work lifecycle still require a policy.

Ranking:
context-owned method replacement > existing sequential fallback > new exclusive option.
The first outranks serialization because the prototype demonstrates isolation without sacrificing overlap.
The existing fallback outranks a new option because the new scheduling surface is not required by this incident.
This ranks the next investment for #481,
not every future shared-resource problem.

Documentation and owner-aware diagnostics complement the fix;
they are not competing substitutes for actual isolation.
In particular,
do not claim two concurrent owners when the evidence is only same-test double stubbing or an unknown external wrapper.

## Production acceptance gates

### Execution and cleanup

Use the existing runtime execution boundary rather than leave a second static Node-only store in `it.ts`.
`package/module/test/src/execution-node.ts` already supplies descriptor context for rejection attribution.
Its current descriptor lifetime is not sufficient by itself:
`it.repeats` needs fresh attempt identity.

Close attempt ownership irreversibly before cleanup.
Test completed and timed-out descendants trying to create new stubs,
not only calling previously stubbed methods.
Verify cleanup after throws,
configuration failures,
repeats,
nested owners,
and restoration in either owner order.
Preserve exact descriptors after the final owner releases them.

### Semantics and supported operations

Specify current-property-read ownership,
original fallback,
function capture,
and callback-context behavior.
Test native promise and timer continuations,
contextless readers,
plain emitters,
and pre-existing asynchronous resources.

Inventory `stub`,
`spy`,
`replace`,
accessors,
whole-object operations,
fake timers,
and direct-import Sinon interactions.
For each mutation family,
state whether it is isolated,
retains ordinary semantics,
or is rejected with a useful diagnostic.
Do not advertise complete `SinonSandbox` isolation based on method-only evidence.

Verify `withArgs`,
`onCall`,
`callsFake`,
async fake behaviors,
constructors,
call ordering,
symbol keys,
inherited properties,
nonconfigurable properties,
proxies,
and assignment/deletion/redefinition interactions.
Preserve unsupported target behavior or reject before mutation;
do not silently install a partially functioning replacement.

### Runtime and consumer boundary

The prototype only verifies Node.
`package/module/test/src/execution.ts` currently delegates directly outside detected Node.
Resolve and test the runtime support policy before claiming a portable fix.
Keep browser imports usable;
a Node-only prototype must not become a static Node import in the neutral entry.

Build the harness and test the public artifact,
not only its source.
Rebuild and run the logger tests with the breadcrumb sequential workaround removed in a throwaway worktree.
Verify the regression fails when the ownership mechanism is disabled.
Run package tests and lint before closing #481.

## Session record

- `089d4c953` records the context-first request and investigation scope.
- `7102e4800` preserves the disposable experiment patch.
- Main-worktree changes are documentation only.
  The GitHub issue was not edited or closed.
- No user acceptance of an implementation design has occurred.
- Next action after implementation authorization:
  build the production ownership lifecycle and runtime boundary,
  beginning with the completed-owner mutation regression.
