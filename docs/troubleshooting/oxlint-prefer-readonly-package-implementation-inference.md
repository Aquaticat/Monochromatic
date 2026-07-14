# Semantic readonly package calls need shipped implementation inference

## Symptom

TypeScript package declarations describe call signatures,
not caller-observable effects.
An imported function can therefore resolve to an exact `.d.ts` declaration while the readonly rule still cannot know
whether its implementation mutates an argument,
invokes a callback,
or crosses another unknown boundary.

Treating every package declaration as observational would be unsound.
Maintaining a complete handwritten catalog for every API in `pnpm-lock.yaml` would also duplicate implementation facts
and become stale across package versions.

## Root cause

The consumer TypeScript project normally loads package declarations and omits shipped JavaScript implementation bodies.
A declaration symbol alone cannot prove mutation absence.
Runtime probes cannot prove nonmutation,
and package names or method names do not identify exact callable behavior.

Package exports add another mapping layer:

- one subpath can expose separate `types`,
  `import`,
  `node`,
  and `default` targets;
- declarations can be bundled while runtime exports re-export internal functions;
- a source map can identify authored source that must participate in cache invalidation;
- JavaScript under `node_modules` is not traversed transitively unless TypeScript's `maxNodeModuleJsDepth` permits it.

## Verified resolution

The rule resolves only invoked package callables on demand.
`packages/oxlint-plugins/prefer-readonly-parameter-type/src/prefer-readonly-parameter-types/external-callable-effect.ts`
coordinates the following checks:

1.  The selected declaration resolves to an exact installed package name and version.
2.  The same version appears as a package or snapshot key in the governing `pnpm-lock.yaml`.
3.  The authored import binding identifies a package export,
    or an instance-method declaration identifies an exact named exported owner and declaration entry.
4.  `package.json` exports select a shipped `import`,
    `node`,
    or `default` implementation.
    Root-only packages can use `module` or `main` fallback.
5.  The implementation exists as supported JavaScript or TypeScript source.
6.  Referenced or adjacent source-map bytes,
    plus one unambiguous shipped mapped source when present,
    participate in the implementation digest.
    Runtime implementation remains the effect-analysis authority.
7.  A generated TypeScript 7 project loads the runtime entry with `allowJs`,
    `checkJs`,
    and bounded `maxNodeModuleJsDepth`.
8.  The existing fixed-point effect engine analyzes package-local calls transitively.
    Calls into another locked package recursively use the same demand-driven path.

Generated projects live under the dependency-local semantic cache and are reused during one stable Oxlint input
snapshot.
`closeSemanticBridge()` closes those projects and clears process-local results before another lifecycle.
Direct summaries use the same validated content-addressed persistent cache as repository source.
The cache identity includes package version,
implementation path,
runtime bytes,
source-map evidence,
project graph,
compiler options,
lockfile,
TypeScript version,
and analyzer implementation.

The current resolver covers:

- named and default imported functions;
- namespace member calls;
- exported object methods;
- exported static and instance class methods when declarations retain the named owner;
- package subpaths;
- shipped JavaScript and TypeScript;
- declaration overloads;
- runtime re-exports;
- transitive package-local calls.

External callback invocation remains distinct from referent mutation.
When package implementation invokes a callback with caller-owned data,
the callback capability is marked invoked and the data relation remains opaque until the caller callback can be joined
soundly across project snapshots.

## Verification

Run:

```sh
mise run //packages/oxlint-plugins/prefer-readonly-parameter-type:lint:types
mise run //packages/oxlint-plugins/prefer-readonly-parameter-type:lint:oxlint
mise run //packages/oxlint-plugins/prefer-readonly-parameter-type:build:js:node
mise run //packages/oxlint-plugins/prefer-readonly-parameter-type:test:unit
```

`src/effect-summaries.unit.test.ts` creates a disposable locked package and verifies:

- observational and mutating runtime exports;
- bundled declarations and overload selection;
- JavaScript re-exports;
- shipped TypeScript subpaths;
- source-map evidence;
- object,
  static,
  and instance methods;
- callback invocation with fail-closed data relation;
- missing implementation fallback.

The independent-process cache fixture separately proves that unchanged direct summaries are read from persistent storage
without rebuilding direct effects.

## Patterns that fail closed

The rule retains an opaque diagnostic when any required identity or implementation fact is unavailable,
including:

- package version absent from the governing pnpm lockfile;
- dynamic call target;
- unresolved or wildcard export mapping not reduced to one exact target;
- missing runtime file;
- native implementation without inspectable source or authoritative effect metadata;
- anonymous returned capability without an exact exported declaration owner;
- recursive package cycle whose effect is still being inferred;
- unknown call inside an otherwise inspectable package implementation.

Failing closed is intentional.
A declaration,
a source-map file,
or successful runtime example is not evidence that an input cannot be changed.

## What does not work

### Treat declarations as implementations

A `.d.ts` body has no operations to inspect.
Using its readonly surface as an effect proof would hide runtime mutation.

### Pre-enumerate every lockfile API

The lockfile establishes exact package eligibility,
not callable effects.
Pre-generating a complete catalog would analyze uninvoked APIs and still need runtime export and implementation mapping.

### Trust a source-map source instead of runtime code

A stale or malicious source map can disagree with shipped JavaScript.
Mapped source contributes cache evidence,
but it cannot erase an effect visible in runtime implementation.

### Treat unresolved package methods as observational

A matching package name,
owner name,
or method name is not sufficient provenance.
The resolver requires exact export,
version,
and implementation source or retains uncertainty.

## Upstream filing decision

1.  **Is it upstream's fault?** No. TypeScript declarations are not an effect system,
    and package export layouts are package-authored contracts.
2.  **Can upstream fix it?** No single TypeScript or Oxlint change can infer arbitrary package runtime effects.
3.  **Is the use case supported?** TypeScript supports package and symbol resolution,
    which the project combines with its own effect engine.
4.  **Would an upstream contribution be welcome?** No generally applicable defect or patch was identified.
5.  **Will upstream likely fix it?** Not applicable because no upstream defect is claimed.
6.  **Was a compatible project-side fix prototyped?** Yes.
    Demand-driven implementation resolution and transitive analysis pass disposable package fixtures.

Nothing should be filed upstream.
