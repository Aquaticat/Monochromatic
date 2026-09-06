# Issue #481 implementation handover

## Authority and goal

The user accepted implementation with "Okay, do it."
Implement and verify context-owned `ctx.sinon` methods,
then close Aquaticat/Monochromatic#481.
Do not substitute serialization,
suite restructuring,
or an exclusivity option.
Continue tracked work without asking the user to say continue.

Canonical plan:
[`issue-481-context-owned-stubs.md`](../planning/issue-481-context-owned-stubs.md).
Source and prototype evidence:
[`sinon-context-owned-stubs.md`](../troubleshooting/sinon-context-owned-stubs.md).

## Contract and implementation

- Every body attempt gets a fresh context,
  sandbox,
  and irreversible owner generation.
  Repeats do not reuse authority.
  Timeout closes ownership before cleanup but does not cancel application work.
- `it-attempt.ts` runs the attempt and timeout in the existing shared Node async context.
  Body and cleanup failures are aggregated.
- `execution-node.ts` reuses the realm-shared rejection observer's `AsyncLocalStorage`.
  `sandbox-runtime.ts` selects Node lazily.
  Other runtimes use ordinary Sinon plus lifetime guards,
  not claimed browser async-context isolation.
- Own,
  configurable,
  writable function-valued data methods use owner-private Sinon facades.
  String/symbol keys and normalized numeric keys work.
  A context-selected getter returns the reading owner's ordinary fake.
  Captured references keep identity;
  unowned/contextless/completed readers get the original.
- `sandbox-registry.ts`,
  `sandbox-slot.ts`,
  and `sandbox-lease.ts` coordinate copies through a versioned realm-shared weak registry.
  Assignment rejects while leased.
  Final restoration preserves the exact original descriptor.
  Foreign deletion/redefinition is preserved and reported.
- Other operation families remain ordinary Sinon,
  with active-slot collision preflight and deferred lifetime guards.
  This is not a security membrane against arbitrary reflection,
  direct target changes,
  or direct Sinon.
- Successful restoration retires ordinary fake,
  mock,
  and clock generations.
  An old restorer cannot remove a newer replacement.
  Local history/behavior operations remain usable where they cannot mutate a target.
- The supplied context owns a factory capability.
  Do not add a requirement that every explicitly borrowed active context equals the current reader.
- Contextual deferred getters preserve the actual receiver.
  Root fake `.set()` conversion rejects before mutation because assignment to leased data methods is prohibited.
  Existing accessor properties retain ordinary getter/setter stubbing.

## Verification history

- `e658d1bbd` committed red attempt/repeat tests before lifecycle implementation.
- `proc_608a` passed the initial complete build/tests/types/Oxlint gates.
- Retained clocks exposed manual restoration and automatic tick shutdown paths.
  Sinon `clock.uninstall` calls `setTickMode({ mode: 'manual' })` internally;
  runner cleanup narrowly permits stopping that automation.
- Browser loading initially failed because `format-error.ts` statically imported a filesystem barrel.
  `e2a77c23a` moves that dependency behind Node detection and a dynamic import.
- A partial browser process shim exposed logger access to `process.versions.node`.
  `4c3c805c8` guards absent versions and adds a real-browser regression.
- `proc_a844` passed selected logger/module-test browser cases across Chromium,
  Firefox,
  and WebKit,
  plus logger types.
- `proc_2ed7` demonstrated that old raw mock restoration removed a newer contextual generation.
  `8daa2901b` retires raw mock controllers after successful restoration,
  including restoration invoked internally by verification.
- `proc_9107` passed full module-test build/tests,
  all module-test browser cases,
  and types after injection/mock fixes.
- `proc_6886` demonstrated the contextual getter receiver failure.
  `c63fd9ac8` forwards the actual receiver when reading the private facade.
- `proc_56a3` failed before tests:
  nested build fan-out built the neutral artifact twice while the client consumer tried to import it.
  `b6f1a813c` replaces module-test's JS group fan-out with a declared dependency graph.
  `proc_d897` then built successfully and reached the expected setter-conversion red assertion.
- `1f821673c` rejects contextual root `.set()` and documents the contract.
  `proc_6647` passed full rebuilt module-test tests and types,
  including getter/setter,
  numeric key,
  and initial stub-instance cases.
  Its formatter failed only on an unbound Date method reference in a test.
  `28793f3a5` replaces that fixture with an explicit `this: void` method.
  Final lint has not been rechecked.

## Current confirmed blockers

Task #4 is complete.
Task #5 remains in progress.
Task #6 remains pending.
Do not close #481.

`28793f3a5` adds `sinon-returned.unit.test.ts` and `sinon-install.unit.test.ts`.
`proc_46f5` demonstrates failures against the already rebuilt implementation:

- `onCall`,
  `onFirstCall`,
  `onSecondCall`,
  and `onThirdCall` return behavior objects whose `.get`/`.set`/`.value` reach the root descriptor.
  These objects currently bypass root fake guards and generation retirement.
- Whole-object stubs,
  function-object static stubs,
  and `createStubInstance` need direct-member and returned-behavior lifetime coverage.
  Collection guarding currently skips function-valued whole-object results.
- Failed whole-object `stub` and `spy` can leave an earlier member wrapped.
  The raw sandbox does not register the partial collection before the later member throws.
  Its subsequent `restore()` therefore does not restore that earlier member.
  Do not restore the whole sandbox on failure:
  unrelated successful fakes from the same attempt must survive.

Raw control:
`/home/user/temp/agent/issue-481-returned-control.ts`.
It uses Sinon 22.1.0 from the installed bundle and disposable local targets.
It proved descriptor mutation through every listed call selector,
plus partial collection installation surviving ordinary sandbox restoration.

### Independent review correction

Advisor suggested `withArgs()` children retained descriptor authority.
The raw control disproved that specific reading:
child `.get`,
`.set`,
and `.value` each throw `TypeError: Object.defineProperty called on non-object`.
`src/sinon/spy.js:45` creates an independent fake;
`src/sinon/stub.js:64` does not copy root descriptor metadata into it.
By contrast,
`onCall` behavior objects retain their root through `stub` and really mutate descriptors.
Guard proven target-changing paths,
not harmless local `withArgs` behavior.

Sinon's ordinary cleanup stopping after a throwing restorer is a baseline limitation,
not automatically an adapter regression.
Contextual leases already clean up independently.

## Next actions

1. Guard returned call-sequence behavior objects with the root's same owner and restoration generation.
   Preserve fake/controller identity and harmless local behavior after completion.
2. Guard function-object collection members without treating application static helpers as root fake mutators.
3. Roll back only replacements introduced by failed whole-object operations.
   Preserve unrelated existing fakes and aggregate rollback failures with the original error.
   Check partial injection failure too;
   success-only injection wrapping may expose unguarded factories after a later write fails.
4. Rebuild and run the committed red tests,
   complete package tests,
   types,
   and scoped formatting plus Oxlint.
5. Prove the committed contextual concurrency regression fails with routing disabled in a disposable worktree.
   The commit-before-mutation prerequisite is satisfied.
6. Remove only the breadcrumb wrapper's `concurrency: 1` in logger's `create-logger.unit.test.ts`.
   Keep `sink/console.unit.test.ts` serialization because it also mutates process environment.
   Run rebuilt logger package tests and lint.
7. Repeat actual module-test/logger browser acceptance after final source changes.
8. Reconcile README,
   architecture plan,
   planning/troubleshooting records,
   and testing-practices guidance with verified outcomes.
   `file-enforcer.config.ts` owns canonical `.agents/skills` mirrors in `.claude/skills` and `.factory/skills`.
   Read its mirror implementation and writing-for-agents skill before editing guidance.
9. Commit with `Closes #481` only after all acceptance gates pass,
   then confirm push and issue closure.

## Tooling and unrelated work

Repository:
`/var/home/user/Monochromatic`.
Commits auto-push.
Stage and commit explicit owned paths only.

Builds and tests use `mise run`.
Package browser task uses a disposable Podman container limited to 2 GiB RAM,
2 CPUs,
and one Playwright worker.
The browser consumer imports built neutral output and is served under `/dist/module-test/` on port 3005.
Root Playwright configuration was checked and is not file-enforcer generated.

Scoped formatter:

```bash
# Paths inside the package are relative to its root.
mise run //package/module/test:format:oxlint -- src/sandbox-slot.ts
```

Outside-package paths must be normalized absolute paths;
`..` is rejected by the wrapper.
The root formatter template does not forward positional file paths.

Preserve concurrent changes in `mise.lock`,
`doc/troubleshooting/module-test-unhandled-rejection.md`,
and music-player design evidence/render files.
Earlier unrelated changes included Markdown CLI and logger-fuzz work.
Do not revert or format those to clear #481 gates.

The historical Markdown CLI startup error was:
`SyntaxError: The requested module './walk-files.ts' does not provide an export named 'isMdxPath'`.
Its current status needs rechecking;
do not fix unrelated CLI work as part of this issue.
