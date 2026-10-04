# Split module-test into responsibility-focused packages

## Status

Design interview in progress.
The user requested splitting `module-test` into multiple packages with `/grill-me`.
No implementation is authorized until the user confirms the shared plan.
This document records the interview rather than an adopted architecture decision.

## Confirmed requirements

The user answered the first round:

- Q1:
  maintainability and independent consumption are the goals.
  No ordering between those goals was specified.
  Dependency minimization is not a selected goal.
- Q2:
  preserve observable test behavior during the split.
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

### Q3: Independent runtime assertions

Recommend a dedicated assertion package preserving the full current matcher interface,
including scoped assertion tracking and Sinon-based asymmetric matchers.
Benefit:
an existing assertion-only caller can depend directly on its responsibility.
Cost:
another supported package entry point and declaration surface.

Alternative:
keep assertions in the runner and extract other responsibilities.
This avoids an assertion-package interface but leaves the demonstrated standalone caller coupled to the runner package.

Ranking:
extract assertions > retain them in the runner,
because there is an existing assertion-only consumer and this responsibility already has a distinct interface.
The placement of `expectTypeOf` remains an export-surface decision,
not a reason to create another wrapper package.

### Q4: Independent sandbox contract

Ask which contract to support,
separately from where the implementation is stored:

- Ordinary disposable sandbox only.
  Benefit:
  expose existing `createSinon(config?)` behavior without the runner.
  Cost:
  callers outside our runner do not get contextual isolation or test-attempt ownership.
- Runner integration only,
  with no separately supported standalone sandbox contract.
  Benefit:
  extracted implementation can serve maintainability without another consumer interface.
  Cost:
  it does not provide independent sandbox reuse.
- Ordinary sandbox plus independently usable contextual ownership.
  Benefit:
  other executors could use our context-owned mocking.
  Cost:
  another executor must supply a defined ownership,
  context,
  and cleanup contract;
  existing injection alone is not a complete consumer interface.

Ranking:
ordinary disposable sandbox > runner integration only > independent contextual ownership.
The first buys reuse of existing standalone behavior rather than merely relocating implementation.
The second outranks the third because no alternative executor requiring contextual ownership has been identified.
This does not propose deleting or weakening contextual ownership inside our runner.

### Q5: Independent test-failure diagnostics

Recommend extracting the existing test-oriented formatting and assertion-source inspection together.
Benefit:
reporting consumers can use these without adopting the runner.
Cost:
the interface must retain and document harness-specific frame and source policies.

Alternative:
keep diagnostics in the runner.
This avoids another package interface but retains formatting implementation and callers in that package.

Ranking:
extract test diagnostics > retain them in the runner,
because a distinct existing exported interface can own source enrichment and frame filtering together.
No actual standalone reporting consumer was established by the census;
this recommendation is based on responsibility separation,
not a claim of current demand.
Generic application diagnostics are not proposed.

### Q6: Ordinary test-author entry point

Ask whether `module-test` should remain the runner with convenience re-exports,
become a runner-only entry point,
or become a facade over a separately packaged runner.

Recommended ranking:
runner with convenience re-exports > runner-only entry point > separate facade and runner.

- Runner with re-exports preserves an ordinary test's single entry point
  while enabling direct imports for standalone consumers.
  Cost:
  the ordinary entry retains the integrated dependency graph.
- Runner-only entry makes ownership visible in imports.
  Cost:
  consumers needing global assertions or type assertions may require extra imports.
- Separate facade and runner give assembly its own package.
  Cost:
  another package and interface without an identified independently useful lower-level runner contract.

The first option outranks the second because direct standalone imports already provide explicit ownership
without imposing it on every test author.
The second outranks the third because it avoids a facade-only package without demonstrated additional reuse.
This ranking is about ergonomics,
not an unverified claim of published compatibility obligations.
Exact convenience re-exports remain unsettled.

### Q7: Consumer scope

Ask whether standalone contracts target consumers outside this workspace,
without including publication in this task,
or workspace consumers only.

Recommend externally usable package contracts.
Benefit:
independent consumption is tested through built package entry points without repository-only assumptions.
Cost:
package contents,
exports,
and declarations need isolated consumer verification.

Workspace-only contracts reduce that acceptance surface but leave external consumption unpromised.
Ranking:
externally usable contracts > workspace-only contracts,
because it gives independent consumption a consumer-level acceptance criterion.
No npm publish is authorized by this interview.

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

## Review and verification

An independent Advisor review prompted separate questions for each consumer contract,
explicit qualification of ordinary versus contextual sandbox ownership,
and a consumer-scope question.
Its earlier suggestion that public-shaped manifests prove publication was rejected:
publication remains unverified.

The initial Markdown lint reported `semantic-line-breaks` after inline label colons.
Those prose breaks were corrected.
The initial document was also rendered successfully through GitHub's Markdown endpoint;
final checks follow each document revision.
Only this planning document has been committed for this task.

## Next action

Ask Q3 through Q7 and wait for the user's answers.
Do not move source,
change manifests,
or migrate consumers during the interview.
