# Derive mutable collection member effects from the paired read-only view

Status: accepted, implemented and measured.

Decided: 2026-07-27.

Extends: `doc/decision/prefer-readonly-effect-model-split.md`.

Evidence: `doc/troubleshooting/oxlint-prefer-readonly-intrinsic-regression.md`.

## Problem

The model split derived receiver effects for `Readonly*` view receivers only. A mutable receiver stayed wholly
opaque, so `readonly T[]` iteration derived while the identical call on `T[]` did not. Measured across the
workspace before this change, mutable collection members still caused findings: `Map.set` 20 cause-mentions,
`Map.get` 11, `Map.delete` 4, `Set.has` 3, `Set.add` 1.

Worse, a genuine mutation and an unanalyzable call were reported identically. `values.clear()` is a certain
mutation of a caller-owned `Set`, but the rule could only say it did not know what the call did, which no
`@mutates` contract could satisfy.

## Decision

Pair each mutable collection interface with `Readonly` plus its own name, both proven default-library, and
read the structural claim off the difference between them.

TypeScript builds each read-only view by removing exactly the mutators, so a member the view also declares
preserves the receiver's structure and a member the view omits restructures it. The partition is upstream's,
not authored here.

Verified against TypeScript 7.0.2, the difference is exactly:

- `Set`: `add`, `clear`, `delete`.
- `Map`: `clear`, `delete`, `getOrInsert`, `getOrInsertComputed`, `set`.
- `Array`: `copyWithin`, `fill`, `pop`, `push`, `reverse`, `shift`, `sort`, `splice`, `unshift`.

No view declares a member its mutable interface lacks, so the partition is exact in both directions. A
collection with no paired view, `WeakMap`, `WeakSet`, a typed array, or any host interface, is unrecognized
and keeps failing closed. `SetLike` does not exist, so `ReadonlySetLike` is a view with no mutable
counterpart and is simply never looked up.

### The two claims stay independent

A member can restructure its receiver and run user code over it in the same call. `Map.getOrInsertComputed`
inserts and invokes a caller-supplied factory; `Array.sort(comparator)` reorders and invokes the comparator.
The structural claim therefore records its mutation, and the observer analysis from the model split runs
afterwards regardless.

Only a fully answered call discharges. A restructuring member whose reachable user code cannot be derived
reports its mutation and still falls through to the opaque boundary. A bare `Array.sort()` reorders and runs
the default comparator's string coercion, so it ends up both mutated and opaque rather than accepted. `push`
and `clear` likewise, since neither supplies an observer.

### Where the view member names come from

Scanning default-library files for `Readonly*` interface declarations, memoized per program snapshot.
Interfaces merge across library files, and `ReadonlyArray` alone is declared in `lib.es5.d.ts`,
`lib.es2015.core.d.ts`, `lib.es2015.iterable.d.ts` and more, so every default-library file must contribute:
a partial scan would misread a later-declared member as a mutator.

Filtering candidates by `lib.*.d.ts` basename before fetching cuts the cost from 262 to 116 milliseconds,
measured, with identical member counts. That is paid once per snapshot.

## What this does not achieve

This does not let the rule lint its own implementation, and does not unblock narrowing
`readonlyEffectSelfHostingOverride`.

Measured by enumerating every default-library call in three of the 37 plugin files that import no TypeScript
semantic API: `effect-element-application.ts` contains only `Map.get`, `ReadonlyMap.get` and `Set.has`;
`effect-callback-relation.ts` the same three; `effect-fixed-point-propagation.ts` adds `Array.forEach` and
`Array.reduce`, which this change derives, but also `ReadonlyMap.get` and `ReadonlyMap.values`, which it does
not.

Every one of those files is blocked by the reachable-user-code claim on members that supply no observer.
`ReadonlyMap.get` already had its structural claim discharged before this change and still reported.

Discharging that claim is not derivable from types. `Map.prototype.get` runs no user code while
`Array.prototype.slice` consults `Symbol.species`, and nothing in either declaration says so: it is a fact
about ECMA-262. Inferring it from the return type or the parameter types would be a member-behaviour table
recovered from shape rather than read from a declaration, which is the handwritten catalog the audit closed
the door on, and which the passing `catalog-free effect architecture` test guards against.

So whether the rule can ever lint its own implementation is a policy question, not an engineering follow-up.
The options are to accept that it cannot, or to reopen the audited no-catalog constraint. Both are decisions
for the repository owner.

## Consequences, measured

- `readonly-catalog-free-invalid.ts` moves from 21 diagnostics to 18, and its contracts-cannot-discharge
  count from 13 to 11. All three losses were diffed against the pre-change build and verified individually:
  two are `map` and `toSorted` over a mutable `children` array with owned, pure observers, and the third is
  `clearReadonlyOverload`, whose declared `@mutates` now agrees with a derived mutation instead of an effect
  the rule could not prove. No `audited-call catalogue` message appears, which stays asserted.
- `crossFileSemanticEffect` changes from `opaque: [0]` alone to `mutated: [0]` and `opaque: [0]`. The helper
  it calls clears a `Set`, now a derived mutation.
- `package/module/caught-value` still reports its two argument-side findings, unchanged, as the control.
- Warm `//package/config/oxlint:lint:oxlint`: 871 milliseconds over 14 files with no findings, against the
  939 milliseconds measured before this change. No regression despite the added snapshot scan.
- Workspace: 1,300 findings for this rule over 2,696 files, against 1,364 over 2,694 before the change.
  Unlike the model split's headline, this pair is nearly matched, two files apart in tree state, so the
  reduction of roughly 64 findings is attributable to this work with modest uncertainty. Receiver-side
  findings fall from 557 to 516 and argument-side from 765 to 737.

  A first attempt at this measurement was discarded rather than reported: it overlapped the rebuilds used to
  verify the fixtures, so the run could have loaded a deliberately broken plugin.

## The share that stays unfixable

Of the 1,300 findings, 222 are receiver-side findings whose every named member is observer-free, so no code
change and no derivation available here can satisfy them. That is 17.1 percent, up from 16.2 percent before
this change: the count held at roughly 222 while the derivable findings around it cleared, which is the
predicted direction.

The distribution matters more than the share, and it is what decides the policy question.

Those findings sit in **49 distinct packages**, out of 78 holding any finding from this rule. None of them is
`prefer-readonly-parameter-type` itself, whose findings the existing exemption already suppresses. The spread
is a long tail rather than a hotspot: `git-policy/cli` holds 61 and `module/toml-edit` 31, then 47 further
packages hold single digits each.

So accepting the class as a permanent error does not cost one exemption. The rationale that justifies
exempting this plugin, that the findings are unprovable by construction rather than defects, applies verbatim
to all 49, exactly as `doc/troubleshooting/oxlint-prefer-readonly-intrinsic-regression.md` warned when the
original override was scoped. Any package wanting a clean lint would need its own entry, and the allowlist
would grow with the workspace.

That is the deciding argument, and it is about exemption count rather than finding count. The recommended
response is to separate provable from unprovable findings at the diagnostic boundary, so the unprovable class
becomes one recorded decision instead of 49 growing globs, while the effect model keeps asserting nothing it
cannot derive. Reopening the no-catalog constraint would reach a similar practical outcome by giving up the
guarantee that motivated the architecture, and is not recommended.

Whichever way that lands, `DGT` needs care for this class: its diagnostics must name the affected input
plainly while stating honestly that no remediation path exists at the call site.

## Acceptance

Each branch carries a fixture that fails when the mutable-collection path is disabled, verified by disabling
it and observing the expected failure rather than by assuming coverage:

- `mutableArrayObservationEffect` iterates a mutable array with an owned observer and is clean. Disabled, the
  whole call is opaque.
- `mutableArrayStructureEffect` appends, reporting `mutated: [0]` and `opaque: [0]`. Disabled, it reports
  opaque alone.
- `mutableSetStructureEffect` clears, same shape.
- `crossFileSemanticEffect` propagates the derived mutation across files.
