# Increments for the collection result gate, after two reviews

Proposal,
 not a decision.
The decisions this serves are
`doc/decision/prefer-readonly-result-provenance.md`,
 "Adopted for issue #414",
 and
`doc/decision/prefer-readonly-member-channel-authority.md`,
 "The stated trust baseline".
Issue #414 is the defect;
 issue #415 recorded the baseline question and is closed.

The first draft of this plan was five steps:
 admit species-consuming members to the channel authority,
 add a
container relation,
 resolve it,
 extend `receiverClaimAnswerable`,
 then withdraw the type-shape gate.
Two independent reviews found three of those five unsound as written,
 before any of it was built.
What follows
is what survives.

## What already landed

The shorthand provenance defect,
 issue #416,
 found while probing whether observer-return origins could carry
step 5.
`effect-expression-provenance.ts` resolved a shorthand property name with `getSymbolAtLocation`,
 which
answers with the property rather than the local it reads,
 so a returned `{ row }` recorded no origin while
`{ row: row }` recorded one,
 and a caller writing through the returned holder kept its read-only offer.
Every other walk in the package already asked for the value symbol.

## Traps this plan exists to avoid

- `memberChannelIsVerifiedNarrow` is a boolean meaning the member's whole user-code channel is trusted.
   `map`
  and `filter` invoke an observer,
   so admitting them to that authority discharges
  `rows.map(foreignMutatingObserver)` on the strength of a primitive result type.
   The authority has to separate
  an ambient channel,
   indexed access and species,
   from an observer channel that still demands owned-summary
  analysis.
- In `effect-readonly-view-application.ts` both result gates run before observers are resolved,
   so a container
  relation recognised in the fallback can discharge `rows.filter(row => { row.label = 'x'; return true; })`
  without the predicate ever being analyzed.
   Observer derivation and result derivation have to be independent
  operations whose coverage is combined afterwards.
- Withdrawing the result gate globally exposes members the container relation does not cover:
   `find` and
  `findLast`,
   whose union result `resultAliasesReceiverState` does not split;
   a `map` wrapping receiver state,
  `rows.map(row => ({ row }))`,
   whose element type is identical to nothing;
   and `reduce`,
   whose result can
  come from the seed or any observer return.
- A container relation cannot travel through `callResultReceiver`,
   which models identity of the result itself.
  `copy.push(fresh)` must not attribute to `rows` while `copy[0].label = 'x'` must.
   That needs two facets,
  origins of the value and origins reachable through its elements,
   which a scalar `SlotOrigins` cannot answer.
- The container members are not one relation.
   `filter` under a type-predicate overload narrows `(A | B)[]` to
  `A[]`,
   so exact type identity cannot validate it.
   `flat` returns descendants rather than the receiver's
  immediate held type and reads nested arrays.
   `concat`,
   `with` and `toSpliced` mix receiver elements with
  argument elements,
   so the relation is "may carry receiver state" rather than "container of receiver
  elements",
   and `concat` additionally consults `Symbol.isConcatSpreadable`,
   which the accepted baseline does
  not cover.
- Observer-return origins are not yet a proof.
   `expressionOrigins` strips a property access to its root,
   so
  `row => ({ count: row.count })` reports the callback parameter as an origin although only a number crossed
  into the fresh object.
   And `NO_SLOT_ORIGIN` conflates a proven-empty result with an unresolved one,
   so
  discharge on emptiness would repeat the defect the effect-model split already caught once.

## Increments, in an order where every intermediate state is sound

1.    Split the channel authority so an observer-bearing member records an ambient channel and an observer
      obligation separately.
       No member's verdict changes;
       this only makes the composition expressible.
2.    Give `expressionOrigins` a discriminated answer,
       proven-with-origins against unproven,
       and prune leaves
      that provably cannot carry mutable identity.
       Type evidence may prove a value carries no identity;
       it may
      never prove a mutable value is fresh.
3.    Add direct receiver-value provenance for `find` and `findLast`,
       splitting the result union,
       so their
      current protection survives the gate withdrawal.
4.    Add the element-reachability facet to the binding model,
       and teach element access,
       destructuring,
      argument transfer and later collection calls to consume it.
5.    Add the fresh-container relation,
       named as "may carry receiver state",
       for `filter` and `slice` only,
      each probed for both halves:
       the result is not the receiver,
       and a result element is the sentinel.
       Leave
      `concat`,
       `flat`,
       `with` and `toSpliced` out of this increment and record why.
6.    Add the observer-return relation for `map`,
       consuming step 2 through the callback's proven returned
      slots mapped by `observedParameterIndexes`.
7.    Withdraw the type-shape gate,
       last,
       when every member it currently covers has a relation or an explicit
      exclusion.
8.    Write the collection-specific diagnostic for whatever residue remains,
       which is what issue #414 asked
      for and what the earlier investigation comment on it recommended.

Steps 1 to 4 change no verdict on their own.
The first verdict change is step 5,
 and by then the element facet and the escape consumption exist to carry it.

## Acceptance

Every table entry keeps its probe,
 per the standard both authority documents already set:
 an entry added
without a passing identity probe is a defect.
The two measurement scripts in
`doc/decision/prefer-readonly-result-provenance.md` are the regression check for the decision itself,
 and the
fresh-object `map` case is the one that must flip.
