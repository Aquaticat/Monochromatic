# `@monochromatic-dev/oxlint-plugin-prefer-readonly-parameter-type`

Oxlint JavaScript plugin containing project-owned semantic rules for readonly parameter evidence:

- `prefer-readonly-parameter-type/prefer-readonly-parameter-types` reports only mutable parameters with a proved
  deeply readonly replacement;
- `prefer-readonly-parameter-type/no-readonly-parameter-mutations` reports proved caller-reachable mutation through
  readonly declarations;
- `prefer-readonly-parameter-type/no-opaque-parameter-effects` reports unresolved effects reachable from parameter
  state;
- `prefer-readonly-parameter-type/no-invalid-parameter-effect-contracts` reports stale,
  missing,
  or inconsistent effect contracts and redundant ownership markers.

## Contract

The rules combine TypeScript 7 semantic types with demand-driven,
cross-file effect summaries.
They compute category-neutral evidence once for each immutable semantic source snapshot,
then separate reporting by policy.
An unresolved effect can therefore withhold a readonly preference and propagate to mutable callers without becoming a
preference diagnostic.
Every call reached from caller-owned state has one accepted outcome:

- exact repository-owned or source-map-resolved shipped implementation proves its effects;
- separately verified isolated value shares no caller-owned identity or capability;
- default-library collection member's effect on its receiver's structure is derivable from the paired
  read-only view,
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
receiver's structure intact.
A mutable collection is read the same way,
 by pairing it with `Readonly` plus its own name:
TypeScript builds each view by removing exactly the mutators,
so a member the paired view also declares preserves the receiver's structure,
and a member the view omits restructures it and reports a mutation rather than an unknown effect.
A collection with no paired view,
`WeakMap`,
`WeakSet`,
a typed array,
or any host interface,
stays opaque.

The two questions stay independent,
because a member can restructure its receiver and run user code over it in the same call:
`Map.getOrInsertComputed` inserts and invokes a caller-supplied factory,
and `Array.sort(comparator)` reorders and invokes the comparator.
A restructuring member whose reachable user code cannot be derived reports its mutation
and stays opaque as well,
so a bare `Array.sort()`,
`push`,
and `clear` are each mutated and opaque rather than accepted.

What remains to prove is which user code the member can run over receiver state.
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
They never suggest a readonly replacement unless analysis proved one.
Projected readonly types retaining unresolved callable behavior are reported by the opaque-effect rule,
not as proved mutations.
Inert `ForeignBorrowed` markers over deeply readonly types and stale `@mutates` documentation are reported by the
contract rule.
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
A process-local evidence cache above that index uses exact semantic source object identity.
When several split rules are enabled in one Oxlint worker,
the first rule computes callable and parameter evidence,
and sibling reporters reuse the completed immutable result.
Failed or partial computations are never cached.
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

## What counts as an external call

Shipped-implementation inference resolves a **call to a package export**,
 and only that.
 Two spellings
reach it:

```ts
import { readFile, } from 'node:fs/promises';
readFile(path,);

import * as valibot from 'valibot';
valibot.safeParse(schema, input,);
```

A method call on an ordinary value does **not** reach it,
however the value's type was declared:

```ts
// The receiver is a global, a parameter, or any other value.
// None of these is a package export, so none resolves an external effect.
console.log(label,);
signal.addEventListener('abort', onAbort,);
rows.map(readRow,);
```

That is a deliberate boundary rather than a gap.
Inference works from exact package export identity,
because a value's type coming from a package does not make a call on that value a call to that package.
A method on a value is treated as unresolved instead,
which withholds,
and the retained-closure rules cover what it hands over.

Measured,
 so the practical consequence is stated rather than implied:
across two packages in this repository,
of the calls reaching this decision
104 had a receiver that was a global or a local,
52 had a receiver that was not a plain identifier,
and the ones that did resolve an export identity were `node:` builtins,
which then correctly fail because a builtin ships no implementation to inspect.
So in ordinary code this path resolves rarely,
and a parameter is withheld by the unresolved boundary rather than by a proven external effect.

### A closure handed to an export whose implementation keeps or calls it

When the shipped implementation **is** inspected,
 what it proves is read per parameter position.
A closure argument is judged by what that position does with it:

```ts
import { retainCallback, ignoreCallback, } from 'some-package';

// Withheld. The implementation keeps this callback past its own return,
// and invoking it later hands back the caller's own row.
export function keep(config: Config,): void {
  retainCallback((): Row => config.row,);
}

// Offered. The implementation never invokes, keeps, or writes through this position,
// so nothing the closure could hand back is reachable.
export function ignore(config: Config,): void {
  ignoreCallback((): Row => config.row,);
}
```

The second case is the reason this is decided per position rather than per call.
An external summary is a proof about the shipped implementation,
so a position it reports no fact about is a position that implementation demonstrably does not use.

Two details worth knowing when reading a report:

-   A closure that **writes** its capture is withheld anyway,
     by the ordinary direct-write attribution,
     whatever the callee is.
     Only a closure that reads and hands its capture back depends on this rule.
-   The declared callback type does not decide it.
     TypeScript accepts a value-returning function where `() => void` is expected,
     so `(): Row => config.row` passes for a `() => void` parameter,
     and the closure that was actually written is what gets inspected.

## Retained closures

Handing a closure to a callee this rule cannot inspect does not by itself withhold an offer.
What the callee may do with that closure is bounded by what invoking it hands back,
so a closure whose every completion is a leaf exposes nothing however the callee keeps it.
That is why `rows.map((row) => config.row.label,)` keeps its offer.

Deciding what a completion hands back asks the callable that actually runs,
never the declared callback type of the formal it was passed as.

Two rules follow from that,
both of which can withhold an offer you might expect to stand.

A declared `void` result is trusted only when it describes a body.
TypeScript permits assigning a value-returning function where a `void`-returning one is expected,
and permits no other such substitution,
so `void` on a callable *type* constrains nothing about what the callable returns.
A call through a parameter,
 a mutable local or a member signature is therefore treated as able to hand
back state,
while a call to a function declaration keeps its `void` at face value.
One consequence is worth stating plainly:
a closure completing with `console.log(...)` withholds,
because that name resolves to a member of an interface rather than to a function declaration.

A parameter default does not stand for every value the parameter can hold.
Where the rule can name the callables an expression might be,
it uses them as evidence and joins their answer with the declared result type rather than replacing it.
So writing `producer: () => Row | string = (): string => 'leaf'` does not narrow the analysis to the
default,
and both the default's own body and the declared union decide together.

If a parameter you expected to be offered is withheld for either reason,
[the retained-closure guide](../../../doc/troubleshooting/oxlint-prefer-readonly-retained-closure.md)
lists every way to recover the offer and which of them change what is true rather than what the rule sees.

## Self-hosting boundary

The enabled preference rule does not lint its own package under its effect policy.
Its implementation necessarily calls TypeScript semantic handles,
Oxlint host context methods,
and ECMAScript collections whose runtime bodies are not part of the configured TypeScript project.
Self-application could pass only by restoring handwritten host authorities or by rejecting the implementation itself.

`package/config/oxlint/src/overrides.ts` disables only
`prefer-readonly-parameter-type/prefer-readonly-parameter-types` for
`package/oxlint-plugin/prefer-readonly-parameter-type/**`.
Every other configured Oxlint rule remains active there.
The package's unit corpus and external consumer tests exercise all four rules directly.
The dedicated fixture asserts one diagnostic owned by each rule,
projected unresolved capability excluded from the mutation rule,
and one shared evidence computation across four distinct rule contexts.

## Verification

Package acceptance includes:

- TypeScript type lint and package Oxlint with the documented self-hosting boundary;
- readonly classification,
  exact runtime implementation,
  strict opacity,
  effect propagation,
  split-rule ownership,
  suggestion,
  bridge lifecycle,
  and cache-sharing tests;
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
