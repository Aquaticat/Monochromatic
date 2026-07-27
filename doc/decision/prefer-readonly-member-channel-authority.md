# Permit one verified authority: default-library members that run no user code

Status: accepted, implementation in progress.

Decided: 2026-07-27, by the repository owner, after the measurement in
`doc/decision/prefer-readonly-mutable-collection-members.md`.

Amends: `doc/audit/tech-prefer-readonly-native-effect-analysis-vet-2026-07-22.md`, which forbids handwritten
effect catalogs.

## What this reopens, and what stays closed

The audit removed handwritten package, ECMAScript, DOM and Node effect catalogs. That stays removed. This
decision permits exactly one authority: the set of default-library collection members verified to run no user
code, meaning they neither consult `Symbol.species` nor coerce elements through `toString` or `valueOf`.

It discharges the reachable-user-code claim only. The receiver-structure claim keeps deriving from the paired
read-only view as decided in `doc/decision/prefer-readonly-mutable-collection-members.md`, so a mutator stays a
mutator: `Set.add` is inert and restructuring at once, and reports a mutation with no opacity.

## Why an authority is unavoidable here

Whether a member runs user code is a fact about ECMA-262, not about its declaration. `Map.prototype.get` runs
nothing while `Array.prototype.slice` consults species, and the two declarations are indistinguishable in every
respect the analyzer can read. Measured directly: `toReversed`, `with` and `toSpliced` build new arrays without
species while `slice`, `concat`, `flat`, `map` and `filter` use it, so even the return type does not separate
them.

An earlier proposal in `doc/decision/prefer-readonly-mutable-collection-members.md` was to give the residue its
own diagnostic class instead. That was withdrawn: classifying a finding as residue requires knowing every
member it reached is inert, which is the same member list, and the catalog-free approximation keys on whether a
member takes an observer, which was measured to cover 222 findings of which the majority are the rule reporting
correctly.

## What makes this different from what the audit removed

Enforcement, not intent. The catalogs the audit removed were unverified assertions: a maintainer wrote that a
member was safe and nothing checked it.

Every entry here is enforced by a test that probes a real engine. For each listed member the test calls it on
an `Array`, `Map` or `Set` subclass whose `Symbol.species` getter records a hit, holding an element whose
`toString` and `valueOf` record hits, and fails if any hook fires. A member that starts dispatching, whether
through an engine change, a specification change or a mistaken addition to the list, fails the build.

The `catalog-free effect architecture` guard test is narrowed rather than deleted, so an unverified authority
module remains forbidden. The guard's subject changes from "no authority module" to "no authority module
without engine enforcement".

## The limit being accepted deliberately

A probe is evidence, not proof. Absence of dispatch under the probe's inputs does not establish absence for all
inputs, and the probe exercises one engine rather than the specification.

So this sits between a derivation and an assertion: stronger than the hand-authored tables the audit removed,
because drift fails the build, and weaker than the signature-derived claims elsewhere in this rule, because
nothing here is proved. That middle ground is the cost of resolving the residue at all, and it is accepted
knowingly rather than by omission.

One consequence worth stating: inert array members such as `at` and `includes` reduce to ordinary property
reads, which the rule already tolerates on parameters without reporting. Admitting them is therefore consistent
with how element access is already treated, not a new exposure.

## Scope

Targets the measured residue: 112 findings across 38 packages, 7.7 percent of this rule's output, whose every
reached member is inert. Findings naming a dispatching member, 265, and findings on calls that are not
default-library collection members, 276, are untouched.
