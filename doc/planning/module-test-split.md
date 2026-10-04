# Split module-test into responsibility-focused packages

## Status

Design interview in progress.
The user requested splitting `module-test` into multiple packages with `/grill-me`.
No implementation is authorized until the user confirms the shared plan.
This document records the interview rather than an adopted architecture decision.

## Confirmed requirements

The user answered the first round:

- Q1: maintainability and independent consumption are the goals.
  No ordering between those goals was specified.
  Dependency minimization is not a selected goal.
- Q2: preserve observable test behavior during the split.
  Package and import interfaces may change;
  matcher semantics,
  concurrency,
  timeout handling,
  sandbox cleanup,
  rejection attribution,
  and diagnostics must remain intact.

## Work areas

- [ ] Agree package responsibilities and independently usable interfaces.
- [ ] Agree the ordinary test-author entry point and consumer migration.
- [ ] Map build,
  platform,
  shared-state,
  and diagnostic contracts to verification.
- [ ] Confirm the complete shared plan before implementing.

## Source evidence

### Existing responsibilities

`package/module/test/src/index.ts` exposes execution,
assertions,
assertion-source inspection,
error formatting,
sandbox types,
and the upstream `expectTypeOf` function.

`package/module/test/src/expect.ts` directly imports Sinon for asymmetric matchers.
`expect-matchers.ts` integrates Chai,
`chai-as-promised`,
and `sinon-chai`.
Extracting assertions does not imply removing these dependencies.

`package/module/test/src/sinon.ts` provides `createSinon`,
an ordinary disposable sandbox factory.
The root entry currently exports its `DisposableSandbox` type but not the factory.
`package/module/test/package.json` also exposes source files through `./ts/*`.

`package/module/test/src/sandbox.ts` accepts a `SandboxOwner` and `SandboxRuntime`
when constructing an attempt-owned sandbox.
`it-attempt.ts` owns timeout integration and lifetime completion.
`execution-node.ts` supplies the runtime adapter through the rejection observer's async storage
and rejects sandbox execution outside an observed test.
An independent ordinary sandbox and runner-owned contextual mocking are different contracts.

The rejection observer and method-ownership registry already use versioned `Symbol.for` keys:

- `@monochromatic-dev/module-test/async-failure-runtime/v1` in `execution-node.ts`.
- `@monochromatic-dev/module-test/method-ownership/v1` in `sandbox-registry.ts`.

Do not infer that existing source and built copies necessarily create separate state.
The split must preserve these existing sharing protocols and exercise mixed-copy behavior.
`sinon-copies.unit.test.ts` and `rejection-lifecycle.unit.test.ts` cover relevant existing scenarios.

`format-error.ts` combines error-chain rendering,
workspace-prefix resolution,
assertion-source enrichment,
and harness-frame filtering.
`harness-frames.ts` contains package-path fragments that must follow any source or artifact moves.
Extracting this code unchanged yields test-oriented diagnostics,
not an application-neutral formatter.
The existing `module-caught-value` package already owns basic caught-value text and stack extraction.

The package supplies Node and neutral built entry points,
plus a browser-consumer acceptance task in `package/module/test/mise.toml`.
Preserving behavior includes retaining the current differences between contextual Node mocking
and ordinary behavior without that runtime adapter.

### Consumer census

A read-only Node scan enumerated `git ls-files -z -- package`.
It parsed every tracked package manifest and inspected tracked TS/TSX text outside
`package/module/test/` and `dist/`.

- 131 manifests declare `@monochromatic-dev/module-test` in a dependency field.
- 976 source files contain that package-name string.
  This is a reference count,
  not an exact executable-import count;
  comments and fixture strings are included.
- A named-import regex located candidates without `describe` or `it`.
  Direct reads confirmed assertion-only imports in
  `package/pi-plugin/openai-fast/src/host-fixture-abort.ts`
  and `package/test-fixture/oxlint-test-import/case/standard/src/allowed.test.ts`.

This establishes an existing assertion-only use case,
not demand for every possible extracted capability.
The scan does not establish absence of dynamic imports,
namespace imports,
untracked consumers,
or consumers outside this repository.

### Ecosystem precedent

The current [Jest expect README][jest-expect] describes a package exporting Jest's `expect` function.
The current [Vitest expect manifest][vitest-expect] separates assertions while still depending on
`@vitest/spy` and Chai.
These support separating responsibility without requiring dependency purity.
They are structural precedents,
not recommendations to replace our implementation or evidence of behavioral equivalence.

[jest-expect]: https://github.com/jestjs/jest/blob/main/packages/expect/README.md
[vitest-expect]: https://github.com/vitest-dev/vitest/blob/main/packages/expect/package.json

## Second-round frontier

### Independently consumable capabilities

Ask separately whether assertions,
sandbox functionality,
and test-failure diagnostics should each receive a standalone package interface.
Recommended answer:
yes for each,
subject to explicitly defining the sandbox interface before implementation.

- Assertions offer an existing assertion-only caller a direct dependency.
  Cost: owning an entry point that retains current matcher dependencies and semantics.
- Sandbox functionality can isolate its implementation and expose disposable mocking.
  Cost: distinguishing ordinary sandbox use from runner-integrated contextual ownership.
- Failure diagnostics can own formatting and source inspection together.
  Cost: retaining and documenting test-specific source and frame-classification policy.

These capabilities are complements,
not mutually exclusive package-layout options.
Exact names and package count remain unsettled.

### Ordinary test-author entry point

Ask whether `module-test` should remain the runner with convenience re-exports,
become a runner-only entry point,
or become a facade over a separately packaged runner.

Recommended ranking:
runner with convenience re-exports > runner-only entry point > separate facade and runner.

- Runner with re-exports preserves an ordinary test's single entry point
  while enabling direct imports for standalone consumers.
  Cost: the ordinary entry retains the integrated dependency graph.
- Runner-only entry makes ownership visible in imports.
  Cost: consumers needing global assertions or type assertions may require extra imports.
- Separate facade and runner give assembly its own package.
  Cost: another package and interface without an identified independently useful lower-level runner contract.

The first option outranks the second because direct standalone imports already provide explicit ownership
without imposing it on every test author.
The second outranks the third because it avoids a facade-only package without demonstrated additional reuse.

## Deferred decisions

After the second round:

- Define which sandbox behaviors are usable without our runner.
- Agree exact package names,
  paths,
  export surfaces,
  and runtime dependency direction.
- Decide which existing consumers migrate and which imports remain unchanged.
- Assign tests and browser acceptance to the new package graph.
- Verify publication state before making compatibility claims.
  `private: false` alone is not evidence that a package has been published.
- Confirm build outputs,
  mixed-copy state sharing,
  declaration compatibility,
  assertion-source lookup,
  and relocated stack-frame filtering.

## Excluded directions

Behavior redesign is excluded by the user's Q2 answer.
No replacement assertion library,
new testing framework,
plugin system,
or dependency-purity target is implied by the split.
A package per helper or a wrapper package solely for the upstream `expectTypeOf` re-export
has no demonstrated standalone responsibility in the inspected code.

## Next action

Ask the second-round frontier and wait for the user's answers.
Do not move source,
change manifests,
or migrate consumers during the interview.
