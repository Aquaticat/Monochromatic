# Iterator members in `prefer-readonly-parameter-types`

Measured 2026-08-06 against `main` at `a4cf83e08`,
 from the workspace sweep recorded in
`doc/decision/prefer-readonly-result-provenance.md`.

## The recorded note was stale, and the real shape is different

`doc/decision/prefer-readonly-result-provenance.md` said under "Remaining work" that iterator members remain
separately unproven and named `summaries.values` as a cause of the `effect-fixed-point-propagation.ts:37`
finding.
 That finding no longer exists:
 the channel authority now claims iterator creation and drainage
together,
 which is what `ITERATOR_MEMBER_NAMES` and its probe were added for.

What remains is not the channel.
 It is the result.
 An iterator member's channel being narrow says the call
reaches nothing surprising;
 it says nothing about what the returned iterator carries,
 and every finding
below is about the second question.

## What the residue actually is

Parsing full diagnostic messages rather than their first lines,
 which matters because cause lists wrap and
a first-line count understates them by a factor of eight:

- 1689 findings from this rule across the workspace.
- 62 name at least one collection iterator member among their causes.
- 16 name nothing else,
   so these are the ones that could clear outright.

Of those 16:

- 14 are `entries`.
- 2 are `values`.
- 0 are `keys`.

Every one of the 14 is the same idiom,
 iterating with an index:

```ts
for (const [index, item,] of items.entries()) {
```

Representative cases:
 `package/cli/git-clone-size/src/async-queue.ts:51`,
`package/module/toml-edit/src/fuzz/arb-combinators.ts:33`,
 `package/module/kv-store/src/consensus.ts:53`,
`package/pi-plugin/goal/src/pi-runtime-verifier-provider.ts:174`.

The `values` pair is `package/module/zip-writer/src/serialize.ts:218` and
`package/desktop-app/file-manager-electron/src/session.ts:75`.

## Why `values` is the easy one and `entries` is not

`PROVENANCE_BY_OWNER` in `effect-result-provenance-authority.ts` describes a member's result with one of three
relations,
 and each entry is enforced by an identity probe in `effect-result-provenance.unit.test.ts` that puts
a sentinel in a real receiver and compares identity against the result.

`values()` fits `RESULT_RELATION_RECEIVER_ELEMENTS` exactly as `filter` and `slice` do:
 the elements the
iterator yields are the receiver's own values,
 by identity.

The probe shape does not pass unchanged,
 which this document first claimed and which is wrong.
 The container
half asserts `Array.isArray(result)`,
 and an iterator is not an array,
 so every `values` entry failed it.
 The
probe now drains a non-array result through `Symbol.iterator` and compares membership in what it yields,
 which
is the same claim the relation makes:
 the object handed back is fresh,
 and advancing it yields what the
receiver holds.
 A result that is neither an array nor iterable drains to a sentinel rather than to an empty
list,
 so a wrong shape fails as a wrong shape instead of reading as a missing sentinel.

`entries()` does not fit any of the three.
 The elements it yields are freshly allocated pairs which *contain*
a receiver element rather than alias one,
 so a sentinel placed in the receiver is never identical to any
element of the result and the existing probe shape cannot pass for it.
 That is not an accident of how the
probe is written;
 it is the honest reason `entries` was left out.

Marking `entries` as `RESULT_RELATION_RECEIVER_ELEMENTS` anyway would be sound,
 because everything reachable
through a pair can reach the receiver and over-attribution never loses a report,
 but it would be a claim the
authority's own standard says must be probed,
 and the probe would be measuring something the symbol does not
say.
 A fourth relation naming the position inside the yielded element is the honest representation.

## Proposed order

1.    Done.
   `values` on `Array`,
   `ReadonlyArray`,
   `Map` and `ReadonlyMap`,
   with the drained probe and both
   pinned counts moved from 18 to 22.
   `Set` and `ReadonlySet` are deliberately absent:
   `receiverHolding`
   builds a `Map` or an array and nothing else,
   so a `Set` entry could not be probed,
   and no finding in the
   residue involves one.

   It clears nothing on its own,
   measured rather than predicted.
   The two `values` findings survive for a
   reason the relation does not address:
   in `zip-writer` the iterator is passed straight into
   `computeOffsets(entries.values(),)`,
   so the result escapes into a call,
   and the callee is itself opaque at
   that parameter because it pushes each entry into an array it returns.
   In `file-manager-electron` the
   `values` cause sits beside `getBoundingClientRect`,
   `querySelectorAll` and `scrollIntoView`,
   which dominate
   it.
   Workspace matched pair either side of the one file:
   3028 errors,
   3903 warnings,
   1689 rule findings and
   4 semantic failures on both runs,
   with the finding sets identical line for line.

   Kept anyway,
   on the same ground as increments 1 to 4 of the result-provenance arc:
   the entry is a true,
   probed fact the later steps need,
   and landing it separately keeps the step that does change verdicts
   small enough to measure.
2.    A relation for a result whose elements hold the receiver's element at a fixed position,
   with a probe
   shape that reads that position rather than the element itself.
3.    `entries` on the same owners under that relation.
   Clears the remaining 14.
4.    `keys` last and separately:
   its elements are indices,
   so the interesting claim is that it carries no
   receiver state at all,
   which is a different assertion from the other two and needs its own control
   proving a `Map` whose keys are objects is not swept in with an array's numeric ones.

Step 4 is the one to watch:
 `Map<object, V>.keys()` yields caller-owned objects,
 so a blanket "keys are
primitives" claim would be false for exactly the receiver type where it matters most.
