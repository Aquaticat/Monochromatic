# Call-edge shapes that still offer a written parameter

`prefer-readonly-parameter-type` maps a callee's effects onto a caller through one edge per
call.
 Nine shapes were measured where that mapping loses a write,
 and the rule then offers
`readonly` for a parameter the callee writes.
 Two are fixed.
 This document records all
nine,
 what each needs,
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

## Open

### Rest and spread break the index relation

A rest formal must receive the union of every remaining actual.
`mutateSecondRest(...rows)` records its write on formal zero while the caller's parameter
sits at edge index one,
 so `restEdgeEffect` is offered `readonly`.

A spread actual covers several formals.
 `mutateSecond(_first, second)` records on formal
one while `spreadEdgeEffect` has a single syntactic spread argument.
 Expand the spread when
the tuple length is known,
 and map conservatively to every candidate formal otherwise.

`TQ1` forbids rest parameters in code we control,
 so the rest half is mostly about
third-party and default-library callees,
 while the spread half applies to our own code.

### Parameter defaults and initializers are not walked

`mutateDefaultAlias(primary, alias = primary)` writes `alias`,
 records only formal one,
and offers `primary`.
 The conservative summary is both formals,
 because an omitted or
`undefined` `alias` refers to `primary`.
 `defaultAliasEffect` is the caller side:
 an
omitted argument leaves `arguments[1]` absent,
 so the write reaches nobody even once the
callee records it.

`defaultInitializerEffect` reaches a mutating call from a parameter initializer rather than
a body,
 which a summary walk bounded by the body never sees.

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
 Whether the bound is reachable on real code is not established:
 it is never
exhausted by this package's tests,
 and the throw is what would make a reachable bound
visible rather than silent.
