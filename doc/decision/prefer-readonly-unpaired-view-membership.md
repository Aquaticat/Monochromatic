# Declaring read-only view membership the default library omits

Accepted 2026-08-06 by the repository owner,
 over leaving the limit documented and over treating every
member of an unpaired interface as restructuring its receiver.

## The derivation needs a pair, and the library does not always provide one

`collectionStructureClaim` in `effect-default-library-readonly-view.ts` decides whether a member
restructures its receiver by diffing an interface against its `Readonly` counterpart.
 `Array` declares
`push` and `ReadonlyArray` does not,
 so `push` mutates.
 Everything the rule knows about mutation comes from
that one diff,
 which is why the rule needs no catalogue of mutators.

`lib.es5.d.ts` declares `DataView` and no `ReadonlyDataView`,
 checked rather than assumed.
 So the diff has
nothing to compare,
 the claim answers `COLLECTION_UNRECOGNIZED`,
 and `recordCollectionMemberEffect` returns
before reaching any other question.
 Every buffer write lands on the opaque boundary.

Measured before this landed:
 21 findings across the workspace name a `DataView` or typed-array member and
14 name nothing else.
 `writeEndOfCentralDirectory` in `package/module/zip-writer/src/serialize.ts` carries
a `ForeignBorrowed` marker and a hand-written `@mutates view` for what is a specification-defined store,
which is the escape hatch being reached for in place of an answer.

## What was decided

Declare the membership the library omits,
 in `effect-unpaired-view-authority.ts`,
 and let the existing diff
run against it unchanged.

The alternative shape,
 listing the mutating members instead,
 was rejected for a specific reason rather than
on taste:
 it would introduce a second derivation that can disagree with the first,
 and the two would then
have to be kept consistent by hand.
 Declaring the view states the same fact in the same shape the library
states it for every paired interface,
 so there is one rule and one place it can be wrong.

Treating every member of an unpaired interface as mutating was rejected because it is false.
 `getUint16`
would be recorded as mutating its receiver,
 which makes a stale `@mutates` contract look accurate and puts a
wrong fact into summaries other analysis reads.
 A wrong inference is worse than an absent one.

## What it is held to

`effect-unpaired-view.unit.test.ts` drives a real `DataView` over a real `ArrayBuffer` and,
 for every member
the engine exposes,
 compares the buffer's bytes either side of the call.
 A declared member that changes them
fails,
 and an undeclared member that changes nothing fails.
 That is the same standard the other authorities
are held to:
 an entry added without a passing probe is a defect.

The count is pinned in two files,
 so adding a member means changing a number in
`catalog-free-architecture.unit.test.ts` as well,
 which is the point at which the probe becomes unavoidable.

## What it does not do yet, measured

Nothing,
 on its own.
 `receiverClaimAnswerable` asks for a verified user-code channel before it asks the
structure claim anything,
 and `MEMBER_CHANNELS_BY_INTERFACE` has no `DataView` entry.
 Probed with the
authority in place and no channel entry:
 `writeEndOfCentralDirectory` still reports `view.setUint16`.
 With
channel entries added by hand it reads `referentMutated=[0]` and `opaque=[]`,
 which is the intended answer
and is what the second half would buy.

The channel entries are not landed with this,
 and the reason is that they cannot yet be probed.
`instrumentedReceiver` in `effect-member-channel-authority.unit.test.ts` builds a `Map`,
 a `Set` or an array
and instruments elements,
 species and index hooks.
 A `DataView` has none of those,
 so listing its members
there produces a probe that passes without measuring anything,
 which is the failure mode that authority's
own design is meant to prevent.

So this lands as a prerequisite,
 on the same footing as the result relations that changed no verdict when they
landed:
 a true, probed fact the consuming half needs.
 Whether to extend the channel probe to a receiver kind
with no elements is a separate decision.
