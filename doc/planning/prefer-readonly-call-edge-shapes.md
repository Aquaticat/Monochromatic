# Call-edge shapes that offer a written parameter

`prefer-readonly-parameter-type` maps a callee's effects onto a caller through one edge per
call.
 Nine shapes were measured where that mapping loses a write,
 and the rule then offers
`readonly` for a parameter the callee writes.
 Seven are fixed and two remain.
 This document records all
nine,
 what each needed,
 and the three hypotheses from the same review that did not
reproduce.

Every case lives in
`package/test-fixture/oxlint-no-restricted-syntax/src/readonly-call-edge-invalid.ts`,
one function per hypothesis,
 so a single lint run says which the rule currently gets wrong.
The count is pinned in `prefer-readonly-parameter-type.unit.test.ts` as a ledger:
 ten
offers,
 of which three are correct.
 A fix has to lower it deliberately and a regression
raises it.

## The shared cause

The edge stores one entry per syntactic argument position,
 and propagation reads that array
by formal parameter index.
 Those two indexes agree only for a plain positional call against
a callee whose formals are all ordinary value parameters.
 Five arrays are read by formal
index and have to stay aligned together:
 `arguments`,
 `foreignArguments`,
`directForeignArguments`,
 `callbackKeys` and `callbackFileNames`.

## Fixed

### An explicit `this` parameter shifted every later index

A `this` parameter occupies a formal index while receiving no argument,
 so all five arrays
started a slot early.
 Measured on `explicitThisEffect`:
 the callee recorded its write on
formal one,
 the caller's only argument sat at edge zero,
 and the write reached nobody.
All five arrays are now padded together,
 which is the precedent the rest and spread work
should follow.

### A shorthand inside an accessor body contributed nothing

A shorthand property's name resolves to the property rather than to the local it reads,
 so
the packaged-callable scan asked for the wrong symbol.
 Measured on
`accessorShorthandEffect`,
 where a parameter appears only as `{ row }` inside a getter.
`parameterIndexes` already asks for the value symbol where it walks shorthands directly;
the scan now does the same.

### Rest and spread broke the index relation

A rest formal now collects every actual from its own position onward,
 and past a spread every later formal may receive the spread or anything after it.
`effect-formal-actual-mapping.ts` computes the whole relation,
 and all five formal-indexed arrays derive from it,
 which subsumes the `this` padding rather than special-casing it.

Two asymmetries there are deliberate.
A formal counts as foreign only when every actual that can fill it carries the marker,
 because a foreign formal suppresses the offer.
A callback identity is recorded only where exactly one actual fills the formal,
 so a rest or post-spread formal reports none and propagates invocation as unresolved.

Fixing the mapping was not enough on its own:
 `call.arguments` holds the spread element itself and the structural checks test for
 literal kinds,
 so a spread of an array literal packaged nothing.
The walk now sees through spread elements and through parentheses,
 non-null,
 assertion and satisfies wrappers.

### Parameter defaults and initializers were not walked

A default initializer naming an earlier parameter makes the two aliases,
 so both indexes now answer for a write through the later name.
Defaults inside binding patterns are still unrepresented,
 which `bindingOriginsFor` states.

Parameter initializers now join both the origin-discovery walk and the inspected set.
They join the inspected set unconditionally rather than through the closure selection,
 because they are not nested callables and nothing about them is deferred.
Adding them to the origin walk alone was measured insufficient,
 which is how the separately built inspected set came to light.

## Open

### A setter can write the value assigned through it

`setterPairEffect` passes a parameter to a callee whose body assigns it into a property of
another argument,
 and that property is backed by a setter which writes what it receives.
Two gaps compose:
 the accessor scan finds no origin for the setter's own parameter,
 since
it is setter-local rather than a caller binding,
 and a property assignment is not modelled
as a call,
 so the callee records mutation of the container rather than of the assigned
value.

Either an assignment through a possibly accessor-backed property is treated as affecting
the assigned value,
 which is cheap and conservative,
 or property assignment resolves the
setter implementation and propagates an edge from the assignment's right operand to the
setter's formal,
 which is precise and needs a latent-effect relation for accessors.

### An owned method call is not exact under overriding

`polymorphicEffect` calls a method whose static resolution finds a reading base
implementation,
 while a reachable subclass override writes.
 The edge is therefore a pure
owned call and the parameter is offered.
 An owned edge is exact only for a non-virtual
target or after closed-world override analysis;
 anything else needs opaque treatment.

Relatedly,
 `propagateEffects` returns silently when a call edge names a callee with no
summary,
 so an owned-resolution mismatch becomes a no-effect edge rather than an unresolved
one.

## Did not reproduce

A mixed method-and-direct effect,
 where a callee both writes its own parameter and writes
through a method that parameter holds,
 is already covered:
 the packaged-callable scan
carries the method's origins to the edge.

A getter body writing a captured parameter during an otherwise read-only lookup does not
reproduce,
 because the accessor body sits in the caller's own scope and the caller's
direct-write scan records it.
 It would reproduce if the literal were built in a helper,
which is worth adding as a fixture when the setter work lands.

A zero-argument method writing its own receiver produces no offer,
 because a class type
carrying methods classifies as an opaque capability before any effect reasoning applies.
That is a suppression by classification rather than a proof,
 so it stays worth a probe if
the classifier ever narrows.

## A separate hazard in the same loop

The propagation pass bound counts mutable effect bits,
 while a pass also reports progress
for callback relations,
 element applications and uncertainty provenance,
 none of which
contribute a counted bit.
 The loop could therefore exit on the bound with changes pending,
returning summaries that were still growing.
 That now throws rather than returning a
partial result.

Measured after adding the throw:
 a repository-wide sweep raises it nowhere.
Findings and offers are identical to the sweep before it,
 1850 and 23,
 and the offer sets match by identity.
So the bound is not reached by any program this repository's sweep completes,
 and the guard costs nothing.
One caveat on the word every:
 the sweep loses one program to the upstream panic recorded in
`doc/troubleshooting/typescript-go-tuple-type-panic.md`,
 so that program's propagation never runs far enough to reach the guard either way.

## What the two remaining fixes would cost here

Both were measured rather than estimated,
 and both come out at zero for this repository.

For the overridden method,
 no real method here is overridden.
Counted across `.ts` outside `dist` and `node_modules`:
 145 class declarations,
 117 with a heritage clause,
 and 6 `override` members.
Of the 117,
 73 are `extends Error` and 34 are `extends HTMLElement`.
Of the 6,
 five are `public override readonly name` overriding `Error.name`,
 a property,
 and the sixth is this fixture's own.
So the precise fix changes nothing here,
 and the blunt variant that treats every method call on a class-typed receiver as
 unresolved is the only one with a cost and is unnecessary.

For the setter,
 the blunt variant would touch 992 property assignments of the form
`a.b = c`,
 because no static test inside the callee can see an accessor the caller supplied.
Against that,
 the repository declares 12 `set` accessors,
 two files of which are these fixtures and one a paused package.
The three real ones all take a primitive and write `this` rather than their parameter,
 so `expressionCanCarryMutableState` already excludes them.

Value in both cases is correctness for consumers of the rule rather than findings here.

## Sweeps

Repository-wide `mise run lint:oxlint`,
 each on a clean tree,
 compared by offer identity
rather than by count,
 since one addition and one withdrawal cancel numerically:

- 1451 findings and 35 offers before any of this session's work.
- 1850 and 23 after the propagation-bound guard.
- 1859 and 23 after the formal-to-actual mapping.
- 1859 and 23 after the parameter-default work,
   with the offer set identical.

No offer was added or withdrawn across the call-edge work,
 and the propagation-bound failure is raised nowhere.
