# Permit one verified authority: which user-code channel each collection member opens

Status: accepted, implemented and measured.

Decided: 2026-07-27, by the repository owner, after the measurement in
`doc/decision/prefer-readonly-mutable-collection-members.md`.

Amends: `doc/audit/tech-prefer-readonly-native-effect-analysis-vet-2026-07-22.md`, which forbids handwritten
effect catalogs.

## What this reopens, and what stays closed

The audit removed handwritten package, ECMAScript, DOM and Node effect catalogs. That stays removed. This
decision permits exactly one authority: a table naming, per default-library collection member, which user-code
channel that member opens.

It discharges the reachable-user-code claim about the receiver only. The receiver-structure claim keeps deriving
from the paired read-only view as decided in `doc/decision/prefer-readonly-mutable-collection-members.md`, so a
mutator stays a mutator: `Set.add` is verified narrow and restructuring at once, and reports a mutation with no
opacity.

It discharges nothing about a member's arguments. `values.with(0, replacement)` reaches no user code and still
places `replacement` inside the array it returns, so argument-side analysis runs regardless. An implementation
that returned early on a discharged receiver dropped that report and was reverted rather than shipped.

## Why an authority is unavoidable here

Which channel a member opens is a fact about ECMA-262, not about its declaration. `Map.prototype.get` touches no
property of its receiver while `Array.prototype.slice` consults species, and the two declarations are
indistinguishable in every respect the analyzer can read. Measured directly: `toReversed`, `with` and `toSpliced`
build new arrays without species while `slice`, `concat`, `flat`, `map` and `filter` use it, so even the return
type does not separate them.

An earlier proposal in `doc/decision/prefer-readonly-mutable-collection-members.md` was to give the residue its
own diagnostic class instead. That was withdrawn: classifying a finding as residue requires knowing every member
it reached is narrow, which is the same member list, and the catalog-free approximation keys on whether a member
takes an observer, which was measured to cover 222 findings of which the majority are the rule reporting
correctly.

## The claim was wrong once, and the correction is the point

The first revision of this table claimed every listed member ran no user code at all. That was false for every
`Array` entry, and reading the table back would never have shown it. Probing an accessor-bearing receiver did.

Measured, by installing an own accessor at index 0 and calling each member on it: `at`, `includes`, `indexOf`,
`lastIndexOf`, `toReversed`, `toSpliced`, `pop` and `copyWithin` all invoke the indexed getter. Worse, that
getter can restructure the receiver during a member the structural claim calls structure-preserving: a getter
that pushes turns `values.includes(marker)` into a call taking a one-element array to two.

So the table now names two channels instead of asserting one flat property.

`MEMBER_CHANNEL_INTERNAL_SLOT` covers members that read and write internal slots and touch no property of the
receiver, which is every `Map` and `Set` entry. Verified: an own `size` accessor installed on the receiver stays
untouched by `Map.prototype.get` and `Map.prototype.has`. These reach no user code, and the claim is exactly
that.

`MEMBER_CHANNEL_RECEIVER_INDEX` covers members whose only user-code channel is own-index access on their own
receiver, which is every `Array` entry. This does not claim they run nothing. It claims their channel is no
wider than the one `values[0]` opens, and the same accessor fires for a plain indexed read.

Admitting the second channel is therefore consistent with a decision this rule already made everywhere else,
rather than a new exposure. Confirmed at the user boundary: a function whose body is `values[0].label = 'x'` is
offered no read-only projection, while one whose body only reads `values[0]` is, so the rule already treats an
indexed read as a pure read even though an accessor could make it neither.

The assumption is worth stating plainly, because it is load-bearing and unsound in the exotic case: this rule's
model assumes caller-owned collections hold ordinary data properties. Naming that channel makes the assumption
explicit at the one place a reader would otherwise have to infer it.

## What makes this different from what the audit removed

Enforcement, not intent. The catalogs the audit removed were unverified assertions: a maintainer wrote that a
member was safe and nothing checked it.

Every entry is enforced by `effect-member-channel-authority.unit.test.ts`, which probes a real engine per member
against four tripwires and fails when a member reaches a channel wider than the one it claims:

-   species, covering `ArraySpeciesCreate` reading `constructor[@@species]` and calling it;
-   element coercion, covering `toString` and `valueOf`;
-   own-index access, the one hook the own-index channel admits;
-   a `size` accessor, covering property reads an internal-slot member must not perform.

The same recording object is passed as the argument wherever a member takes a key or a value, so element
coercion doubles as argument coercion. Coercion of an index argument is deliberately not covered: `at`, `with`,
`toSpliced` and `copyWithin` declare `number` at that position, so no caller-owned object carrying a
`Symbol.toPrimitive` can arrive there in typed code.

The probe also asserts its own tripwires fire, using members the table deliberately excludes: `slice` must reach
species, and `join` and a bare `toSorted()` must reach element coercion. Without those controls a probe that
silently stopped instrumenting would report a clean run for every member, and the table would look verified while
proving nothing.

The receiver holds two elements with both indices instrumented, and that detail is load-bearing rather than
incidental. With one element, two probes were vacuous: `with(0, element)` replaces the only index and so never
reads one, and a bare `toSorted()` never compares a pair, which is why its control assertion could not be
written at first. Measured on two elements, `with` reaches `index-get`, `toSorted` reaches element coercion,
`fill` reaches `index-set` twice, and `copyWithin` reaches both. `push` still reaches nothing, because it writes
past the instrumented indices, so its own-index claim remains an upper bound rather than an observation, which
is the safe direction.

A throw is recorded as its own hook that no channel admits, so an unexpected one fails the assertion and names
the member. An earlier version recorded a rejected indexed write as `index-set`, which the own-index channel
admits, meaning any `TypeError` at all would have read as ordinary evidence. Nothing reaches that path now:
every instrumented index carries a recording setter, so writes are accepted.

Iterator members are excluded for a separate reason. `keys`, `values` and `entries` reach nothing when they are
called, and the read happens later when the iterator advances. Measured: `Array.prototype.values` fires no hook
until `next()`, which fires the indexed getter. Nothing in the model separates creating an iterator from
consuming one, so an inert-creation claim would be read as an inert-consumption claim, and both stay unproven.

## How the guard changed

The `catalog-free effect architecture` guard is narrowed rather than deleted, so its subject becomes "no
authority module outside the permitted registry" rather than "no authority module".

Two changes give that teeth. The module-name match widened from `effect-authority` to `authority`, because the
permitted module was passing the old match by accident of naming rather than by permission. And the registry
pins the table's total entry count, checked against what the production module actually exports, so adding a
member fails the build at the point where this document and the probe requirement become unavoidable. Verified
both ways: an unregistered `effect-scratch-authority.ts` fails the guard by name, and adding `slice` to the table
fails the pin at 34 against 33 and the probe with `Array.slice reached species`.

What the guard cannot do is verify that the enforcement is any good; checking that a test file exists beside an
authority would be a rubber stamp, satisfiable by an empty file. It converts a silent addition into a deliberate
one, and that is the whole claim.

## Both discharge conditions, and why neither is sufficient

A receiver claim is answered only when the member's channel is verified and the call's result exposes no
caller-owned state.

The channel condition is necessary because a stateless result proves nothing on its own. `join` returns a
`string` and calls every element's `toString`; `values.some(foreignPredicate)` returns a `boolean` and runs the
predicate.

The result condition is necessary because a verified channel proves nothing about what comes back.
`values.at(0)` reaches no user code and hands back the receiver's own element, and nothing tracks a call result
as an alias of the receiver's parameter, so `values.at(0).label = 'x'` would go unreported. Members returning the
receiver itself, `Map.set` and `Array.sort`, are covered by their own structural claim instead: each is a
mutator, so the receiver is already recorded as mutated and nothing reachable through the result is new.

Both conditions were mutation-tested rather than argued. Dropping the channel check discharges `join`; dropping
the result check discharges `at` and `with`; returning early instead of clearing receiver opacity alone drops the
report that `push` retains its argument. Each mutation fails a named assertion.

## The limit being accepted deliberately

A probe is evidence, not proof. Absence of a hook under the probe's inputs does not establish absence for all
inputs, and the probe exercises one engine rather than the specification.

Two further limits are worth recording, because neither is addressed here. Static declaration resolution does not
prove runtime dispatch: a subclass overriding `get`, a replaced prototype or a `Proxy` makes `values.get(key)`
user code while the declaration still resolves to `ReadonlyMap.get`. And the authority is keyed by TypeScript
interface name, where `Array.at` and `ReadonlyArray.at` are the same runtime intrinsic, so the keying carries a
redundancy that a future revision should collapse onto intrinsic identity.

So this sits between a derivation and an assertion: stronger than the hand-authored tables the audit removed,
because drift fails the build, and weaker than the signature-derived claims elsewhere in this rule, because
nothing here is proved. That middle ground is the cost of resolving the residue at all, and it is accepted
knowingly rather than by omission.

## Consequences, measured

- `readonly-catalog-free-invalid.ts` moves from 19 diagnostics to 16, and its contracts-cannot-discharge count
  from 12 to 9.
- `crossFileSemanticEffect`, `mutableArrayStructureEffect` and `mutableSetStructureEffect` each move from
  mutated-plus-opaque to mutated alone. That is the intended gain: `names.clear()` is a certain mutation of a
  caller-owned `Set`, and the rule now says so instead of saying it cannot tell.
- `readonly-foreign-provenance-invalid.ts` still reports all five findings, including that `replacement` escapes
  through `values.with(0, replacement)`, which is the assertion that caught the reverted wiring.
- Workspace: 1,405 findings for this rule, against the 1,450 recorded in
  `doc/decision/prefer-readonly-mutable-collection-members.md`.

  That difference is not this decision's effect and must not be read as one. Two changes landed between the two
  measurements and they pull in opposite directions: closing the member-result escape adds findings, because it
  stops discharging `find`, `at` and `Map.get` over state-carrying element types, and the receiver-only discharge
  removes them. The net is 45 fewer. Splitting it needs a workspace run at the intermediate commit,
  `d6d3ee083`, which was not performed, so no per-change workspace number is claimed here.

  The exact, attributable numbers for this decision are the fixture and summary counts above, each diffed against
  a build differing only in the change under test.

## Scope, and what the residue becomes

The measured residue was 112 findings across 38 packages, 7.7 percent of this rule's output, whose every reached
member ran nothing. Both discharge conditions narrow what this decision actually resolves, and the narrowing is
deliberate.

Discharged: members whose result is a boolean, a number or `void`, which covers `has` at 27 findings, `includes`
at 13 and `push` at 8, plus `get` and `at` over collections whose value type is primitive.

Not discharged: `entries` at 12, because iterator members are excluded; `set` at 8 and every member returning the
receiver, because the result exposes it; and `get` and `at` over object-valued collections, because the result is
the receiver's own element.

Closing the rest needs result provenance rather than a wider authority: a summary fact recording that a call's
result is reachable from the receiver's parameter, propagated through the fixed point so that mutating what came
back is attributed to the parameter it came from. That is a modelling change, not a table entry, and it is not
attempted here.
