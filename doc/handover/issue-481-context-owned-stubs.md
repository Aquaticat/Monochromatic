# Issue #481 implementation handover

## Authority and goal

The user accepted the context-owned mocking recommendation with "Okay, do it."
Implement,
verify,
commit,
and close GitHub issue #481 once acceptance passes.
Do not replace this with documentation or an `exclusive` test option.
Do not ask the user to say continue while tracked work remains.

Canonical plan:
[`issue-481-context-owned-stubs.md`](../planning/issue-481-context-owned-stubs.md).
Prototype evidence:
[`sinon-context-owned-stubs.md`](../troubleshooting/sinon-context-owned-stubs.md).

## Current implementation

- `package/module/test/src/it-attempt.ts` now creates a fresh context and sandbox for every body attempt.
  It runs timeout inside the attempt's async context,
  closes before restoration,
  and aggregates body plus cleanup failures.
- `sandbox-owner.ts` carries identity,
  phase,
  runtime capabilities,
  and the no-owner sentinel.
- `execution-node.ts` reuses the existing realm-shared rejection observer's `AsyncLocalStorage`.
  Its store receives an optional `sandboxOwner` field.
  Suites and reporting contexts do not inherit method fakes.
- `sandbox-runtime.ts` lazily selects Node capabilities.
  Other runtimes retain ordinary Sinon semantics,
  not claimed async-context isolation.
- `sandbox.ts` creates the guarded test capability separately from standalone `createSinon(config)`.
- `sandbox-guard.ts` guards retained factories at invocation,
  including function namespace properties.
- `sandbox-registry.ts`,
  `sandbox-slot.ts`,
  and `sandbox-lease.ts` own a versioned realm-shared weak registry,
  per-owner private facades,
  context-selected property getters,
  generation-aware restore,
  and external descriptor conflict detection.
- `sandbox-operation.ts` selects contextual `stub(object, key)` and `spy(object, key)` for own configurable writable methods.
  Other overloads delegate to Sinon after collision preflight.
- `sandbox-result.ts` guards deferred fake `get`/`set`/`value`,
  stale ordinary fake restoration,
  mock-controller `expects`,
  and injected factory destinations.
- `sandbox-target.ts` and `sandbox-value.ts` classify dynamic arguments and preflight ordinary replacements.
- `sandbox-cleanup.ts` restores all independent contextual leases even if a fake's restore was overwritten.
- `sandbox-error.ts` defines ownership and aggregate cleanup errors.

## Verified so far

- Added `sinon-attempt.unit.test.ts` first.
  The rebuilt unmodified harness failed both retained-factory and shared-repeat-context regressions.
- Built public-artifact tests passed after initial lifecycle work.
- `sinon-context.unit.test.ts` verifies overlapping stubs,
  overlapping spies,
  independent histories,
  original unstubbed readers,
  restoration,
  and nested attempt ownership.
- Build plus targeted context,
  attempt,
  existing Sinon,
  `it`,
  and rejection-lifecycle tests passed.
- Package `lint:types` exited zero.
- Scoped Oxlint autofix converged formatting.
  Manual structural fixes replaced nullish unions with semantic sentinels,
  used guarded prototype cursors,
  added resource TSDoc,
  and corrected optional descriptor typing.
  The last autofix reported only import ordering and symbol-description warnings;
  both were then fixed.
- Full `buildAndTest`,
  `lint:types`,
  and `lint:oxlint` passed in process `proc_608a`.
  Oxlint reported zero warnings and zero errors on 53 files.

## Boundary verification update

- Commit `ec991f4ad` added cleanup,
  clock,
  and ordinary-operation tests plus deferred collection/timer guards.
- `a0a38e675` fixed clock cleanup:
  installed Sinon invokes `clock.setTickMode({ mode: 'manual' })` from `uninstall`.
  Cleanup now permits stopping automation while still rejecting a new tick mode after completion.
- Full package tests and `lint:types` passed in `proc_a6be` after rebuilding.
  Scoped autofix failed on fixture typing and style findings,
  not runtime assertions.
  Its formatter changes remain task-owned.
- Current edits add manual-restoration generation retirement for ordinary fakes and clocks,
  fix the typed clock fixture using a checked runtime `uninstall`,
  explicitly retain `call`/`apply`/`bind` factories past completion,
  and document the intentional Node emitter lint exception.
  These changes landed in `53013f383`.
  Full rebuilt package tests and `lint:types` passed in `proc_095e`.
  Its scoped formatter left only fixture callback typing findings,
  subsequently fixed in `cd8a87964`.
- `cd8a87964` adds the browser fixture,
  root Playwright discovery/static-asset routing,
  and package `test:browser` with a disposable 2 GiB/2 CPU container.
  Root config ownership was checked in `file-enforcer.config.ts`:
  the Playwright configuration is not generated.
- Actual Chromium,
  Firefox,
  and WebKit runs in `proc_ed16` all rejected importing the consumer bundle.
  Firefox identified `node:fs/promises`.
  The rebuilt neutral `sandbox-owner` chunk has leading static `node:fs/promises` and `node:path` imports.
  `format-error.ts` statically imports the module-fs-path barrel;
  its workspace lookup is now being moved behind Node detection and a dynamic import.
  Do not claim browser compatibility until the actual browser tests pass.

### Independent review triage

Advisor identified stale manual clock generations and ordinary fake restoration as worthwhile checks;
those now have implementation changes and tests pending verification.
It also raised independent raw cleanup failure,
installation rollback,
reflective factory extraction,
mock generations,
and mixed-artifact/browser/descriptor coverage.
These remain review items,
not verified defects.

Do not blindly apply every proposed restriction:

- `guardMockController` already proxies controller calls through invocation-time completion checks.
  The review's claim that completed controller restoration is unguarded does not match that source.
  Manual restoration generations still deserve a dedicated test.
- The accepted rule binds factory authority to the supplied context and property values to the reader's context.
  It does not require rejecting an explicitly borrowed still-running context.
  Captured fake references deliberately preserve identity across readers.
- Fake timers retain ordinary shared-state semantics;
  this change does not promise that all old local clock operations become inert.
- This is not a security sandbox against arbitrary JavaScript reflection,
  direct target mutation,
  or direct Sinon imports.
  Investigate practical factory extraction without claiming a complete reflective membrane.
- Sinon's raw `sandbox.restore` itself invokes `fakeRestorers` before its fake collection
  and stops when a restorer throws.
  Distinguish baseline Sinon failure behavior from regressions introduced by the adapter.
  Contextual leases already restore independently before raw restoration.

## Work still required

Core implementation task #4 is complete.
Runtime/Sinon boundary task #5 is in progress,
then task #6 covers logger integration and closure.
Do not mark complete or close #481 yet.

- Verify timeout tails attempting new sandbox mutations,
  retained namespaced factories,
  deferred mock installation,
  raw accessor/value fakes,
  repeated and stale restoration,
  and cleanup failures combined with body failures.
- Extend returned whole-object/createStubInstance and fake-timer controller coverage.
  `sandbox-collection.ts` now guards collection fake mutators and clock restoration/tick-mode changes.
  Avoid claiming every local fake history/behavior operation becomes inert.
- Cover mixed stub/spy owners,
  symbols,
  inherited/nonconfigurable/proxy fallback,
  `withArgs`,
  `onCall`,
  `callsFake`,
  async returns,
  receiver/constructor behavior,
  callback read-context versus captured-reference semantics.
- Test assignment rejection,
  deletion/redefinition/direct-import Sinon conflicts,
  exact restoration,
  and source plus built artifact copies in one realm.
- Verify an actual browser consumer of the neutral artifact.
  Existing rejection fixtures simulate absent Node globals but are not browser evidence.
  Root Playwright server currently serves only logger dist;
  its testMatch excludes module-test.
  Add a package-local browser verification path rather than casually editing generated root config.
- Remove only the breadcrumb wrapper's `concurrency: 1` in the logger test and run rebuilt logger tests.
  Do not remove unrelated serialization in `sink/console.unit.test.ts`:
  it also changes process environment.
- Prove the production context regression fails with routing disabled in a disposable worktree.
  The guard has already been committed,
  satisfying the commit-before-mutation prerequisite.
- Run full package tests and lint after final source edits.
- Update README,
  `ARCHITECTURE.plan.md`,
  plan/troubleshooting records,
  and testing-practices skills.
  Inspect file-enforcer ownership before changing mirrored skill files.
- Commit with `Closes #481` only after all acceptance passes.

## Scope and cleanup safety

Current main-worktree unrelated changes belong to concurrent work.
At implementation start they included Markdown-linter files,
logger-fuzz coverage work,
`mise.lock`,
and `doc/troubleshooting/module-test-unhandled-rejection.md`.
Never revert or format those as part of #481.

`package/module/test/mise.toml` now has a verified scoped `format:oxlint` task:

```bash
# Package-relative paths restrict autofixing to these files.
mise run //package/module/test:format:oxlint -- src/sandbox-slot.ts
```

Root `format:oxlint` templates previously ignored extra positional files.
The package task now forwards explicit paths through `oxlint-wrapper`.
Use it for owned files only.

## Commits

- `00f7b03e9`: implementation authorization and scope.
- `e658d1bbd`: failing lifecycle regressions.
- `473407d38`: fresh guarded attempt sandbox.
- `1bcf62d56`: shared registry and execution-context primitives.
- `10bb13e69`: method dispatch,
  restoration,
  and context regression tests.
- `423749955`: scoped autofix task.
- `87208e385`: generated formatting.
- `500c32b47`: explicit absence and delegation states.
- `8ea6b3119`: formatting and remaining standards alignment.
