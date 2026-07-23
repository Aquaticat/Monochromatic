# `@monochromatic-dev/oxlint-plugin-prefer-readonly-parameter-type`

Oxlint JavaScript plugin containing the project-owned
`prefer-readonly-parameter-type/prefer-readonly-parameter-types` semantic rule.

## Contract

The rule combines TypeScript 7 semantic types with demand-driven,
cross-file effect summaries.
Every call reached from caller-owned state has one accepted outcome:

- the exact repository-owned or shipped package implementation proves its effects;
- a separately verified isolated value shares no caller-owned identity or capability;
- the rule rejects the call as opaque.

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
`@mutates` documents known behavior but cannot make unresolved behavior safe.

TypeScript declarations establish callable identity and type shape,
not runtime behavior.
The rule therefore rejects parameter-reachable ECMAScript,
DOM,
and Node calls when their implementation is unavailable.
This includes formerly special-cased global `String`,
observational collection methods,
and shallow frozen copies retaining nested caller identity.

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
