# `@monochromatic-dev/oxlint-plugin-prefer-readonly-parameter-type`

Oxlint JavaScript plugin containing the project-owned
`prefer-readonly-parameter-type/prefer-readonly-parameter-types` semantic rule.

## Contract

The rule combines TypeScript 7 semantic types with demand-driven,
cross-file effect summaries.
Every call reached from caller-owned state has one accepted outcome:

- exact repository-owned or source-map-resolved shipped implementation proves its effects;
- separately verified isolated value shares no caller-owned identity or capability;
- default-library read-only view member cannot restructure its receiver,
  and every caller-supplied observer it hands receiver state to is owned source whose own effects propagate;
- exact `ForeignHostCapability` marker plus `@mutates` contract bounds runtime-owned host behavior after inference fails;
- rule rejects call as opaque.

Missing source,
missing callable summaries,
bodyless declarations,
native boundaries,
unsupported runtime resolution,
and exhausted analysis budgets fail closed.
Static plain-data types do not prove runtime isolation because matching values can retain shared identity,
accessors,
proxies,
hooks,
functions,
or host capabilities.
`@mutates` alone documents known behavior but cannot make unresolved behavior safe.

TypeScript declarations establish callable identity and type shape,
not runtime behavior.
The rule therefore rejects parameter-reachable ECMAScript,
DOM,
and Node calls when their implementation is unavailable.
This includes formerly special-cased global `String`
and shallow frozen copies retaining nested caller identity.

Collection members are split rather than rejected wholesale.
Membership of a default-library `Readonly*` interface is upstream's own statement that the member leaves the
receiver's structure intact,
so what remains to prove is only which user code the member can run over receiver state.
The member's instantiated signature answers that:
it names the argument positions receiving the receiver or its type arguments,
and an observer at such a position is analyzed as ordinary owned source whose effects propagate to the receiver.
A member handing receiver state to no caller-supplied observer proves nothing this way and stays opaque,
which covers `join`,
`toLocaleString`,
and `toSorted` called without a comparator.
So do `get`,
`has`,
`slice`,
and `at`,
which supply no observer to analyze.
An observer that is not owned source,
a receiver position the signature does not describe,
and any further argument carrying state,
such as a `reduce` seed or a `map` `thisArg`,
each leave the call opaque.

Workspace calls resolve through repository source and are analyzed live.
Locked package calls resolve through package exports to the selected shipped JavaScript or TypeScript entry.
Runtime re-export chains and declaration-adjacent runtime shadows are followed iteratively.
Missing runtime files,
native implementations,
and unresolved transitive boundaries remain opaque.
No package,
ECMAScript,
DOM,
or Node effect catalog participates in acceptance.
Exact host authority is carried by source types at each accepted boundary,
not by method-name or package-name tables inside analyzer.

Unresolved diagnostics name affected inputs and reached calls,
then list the proof-preserving remediation paths.
Inert `ForeignBorrowed` markers over deeply readonly types and stale `@mutates` documentation are reported.
Ordinary `--fix` does not alter signatures or contracts;
semantic rewrites remain suggestion-only.

## Demand and cache boundaries

Each active source expands analysis through exact owned callee and callback identities only.
A reached `ForeignBorrowed` candidate asks TypeScript for exact signature usages and walks backwards through callable owners.
Non-call escapes,
top-level or excluded callers,
unavailable usage queries,
and unresolved exact call edges add an ordinary inbound and remove inferred foreign provenance.
This avoids scanning every callable in every configured source.

Process-local final indexes use TypeScript's immutable semantic project snapshot as their authority.
A source overlay refresh creates a different snapshot and cannot reuse the old final index.
Schema-4 persistent entries validate exact source,
module,
semantic call,
compiler-option,
declaration-surface,
and lockfile identities across later processes.
`closeSemanticBridge()` clears every process cache.

CLI diagnostics are authoritative because Oxlint's language server does not execute JavaScript plugins.

## Ownership marker

Externally dictated mutable values use
`ForeignBorrowed<T>` from `@monochromatic-dev/ownership-marker-foreign-borrowed/ts`.
The marker records foreign ownership without claiming immutability or proving opaque behavior.
Properties,
elements,
destructured bindings,
callback elements,
synchronous iteration elements,
and owned helper parameters can inherit provenance through semantic analysis.
A helper parameter is inferred foreign only when every exact inbound supplies wholly foreign mutable state.
One ordinary or unresolved path restores normal readonly enforcement.

`ForeignBorrowed` never makes a bodyless or unresolved call acceptable.
Move such work to an implementation-known boundary,
pass its primitive result,
or provide verified isolation.

When source and source-map inference cannot resolve exact runtime implementation,
`ForeignHostCapability<T>` can mark exact runtime-owned capability.
The marker has exact declaration identity,
also carries foreign ownership,
and admits unresolved behavior only with corresponding `@mutates` contract.
Same-named local aliases remain opaque.

See the
[foreign-provenance guide](../../../doc/troubleshooting/oxlint-prefer-readonly-foreign-provenance.md).

## Callback invocation

Invoking a caller-provided callback is an affected capability.
The rule tracks invocation separately from referent mutation,
so an implementation-derived callback call does not automatically claim mutation of the function object or every captured value.
Unknown and external callbacks remain fail closed.

## Self-hosting boundary

The strict rule does not lint its own package under its effect policy.
Its implementation necessarily calls TypeScript semantic handles,
Oxlint host context methods,
and ECMAScript collections whose runtime bodies are not part of the configured TypeScript project.
Self-application could pass only by restoring handwritten host authorities or by rejecting the implementation itself.

`package/config/oxlint/src/overrides.ts` disables only
`prefer-readonly-parameter-type/prefer-readonly-parameter-types` for
`package/oxlint-plugin/prefer-readonly-parameter-type/**`.
Every other configured Oxlint rule remains active there.
The package's unit corpus and external consumer tests exercise the strict rule directly.

## Verification

Package acceptance includes:

- TypeScript type lint and package Oxlint with the documented self-hosting boundary;
- readonly classification,
  exact runtime implementation,
  strict opacity,
  effect propagation,
  diagnostic,
  suggestion,
  bridge lifecycle,
  and cache tests;
- conditional exports,
  runtime re-exports,
  declaration and runtime sibling mismatch,
  shipped TypeScript,
  and unresolved runtime rejection;
- declaration preservation through bundled output;
- staged publication and installation outside monorepo dependency ancestry;
- Linux,
  macOS,
  and Windows host bridge workflows.
