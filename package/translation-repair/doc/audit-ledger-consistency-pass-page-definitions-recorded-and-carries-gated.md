# Audit ledger: the consistency pass, page definitions recorded and carries gated by generation

Paths in this record are the layout after 2026-10-18,
under `package/translation-repair`.

The independent review of the repairs in
[Audit ledger: the consistency pass, voices lost and places left unlocated](audit-ledger-consistency-pass-voices-lost-and-places-left-unlocated.md)
(B656 to B664) left three items open,
and the lead closed them on 2026-10-18 on top of `98d9089318`:
the artifact recount that cannot see the page's definitions (B665,
reopening B661),
the carry reader that kept a tolerance generation 18 does not need (B666,
closing the question left open in B664),
and a refusal text that still named the quotes of the place (B667,
left as it was in B662).
The test commit is `f5dc1482dc` and the fix commit `7410c9948f`.

## B665: generation 18 records the page definitions that move a slot

Decided on 2026-10-18 by the lead,
who reopened B661 for the generation that is new and unshipped.

Outcome written on 2026-10-18.
Red `f5dc1482dc`,
fixed in `7410c9948f`.

What changed:
generation 18 carries what its reader needs,
so the limit of B661 stays only for generation 17 and earlier.
`slotInSpan` and `locateWords` take an optional `definitions` string in place of reading the page's,
and the counter (`locatedRendering` in `consistency-count.ts`) puts on a located rendering of a frame
the `definitions` that move its slot,
chosen by `definitionsMovingSlotOf` (`consistency-slot-definitions.ts`).
`recordedRendering` in `pass-consistency-apply-record.ts` writes the field,
`parseConsistencyRendering` reads it from generation 18 and refuses it before,
and the recount (`expectedSlotOf` in `artifact-two-lane-read-consistency-span-slot.ts`,
split out of the span reader to keep it under the line limit)
reads the slot with the recorded definitions.
The predicate is `artifactGenerationRecordsDefinitions`.

Field shape:
`definitions`,
an optional string on a located rendering,
which sits on the occurrence record at `consistency.groups[i].occurrences[j].rendering`.
It is per place and not per group or per artifact,
because the set that moves a slot depends on the place's own span,
and most places have none.
The value is the page's definitions in the form `pageDefinitionsOf` returns,
the entries in page order and separated by a newline,
for example `[b]: https://x.example/b`.
It is the smallest faithful form:
the counter reads the slot with the whole set of the page's definitions,
drops every entry whose absence leaves the slot as it was,
and records what remains.
It records nothing where the span's slot is the same with no definitions at all,
which is nearly every place,
so a page's footnotes are not copied into each place.
A whole footnote of several paragraphs is one entry.
If the reduced set does not read back as itself through `pageDefinitionsOf`
the whole set is recorded in its place.
In the faithfulness check,
`locateWords` and `slotInSpan` with `apostrophes: 'outside'` use the page only through `pageDefinitionsOf(page.text)`,
so passing that string is exactly what passing the page was.

What the reader refuses at generation 18:
definitions that are not a string,
that are empty,
or that `pageDefinitionsOf` does not return unchanged (a sentence,
or definitions with other text among them),
at `...rendering.definitions`;
definitions on a place of a group that is not a refrain,
or that leave the slot as the span alone gives it,
with the refusal "expected the definitions that change the slot the usable ballots give inside those words,
and none where they change none";
and a place that records no definitions where they would move the slot,
which is the slot refusal as before,
because the recount then expects the slot of the span alone and the pass recorded none.
A generation 17 file with the key is refused as an unknown key,
and one without it is recounted over the span alone,
with the pin of B661 kept for that generation
(`artifact-two-lane-read-consistency-span.unit.test.ts`).

Cache and digest:
no cache key reads the field or the generation.
The consistency cache key hashes the sheet and `CONSISTENCY_CACHE_VERSION` (still 5),
and the cache holds the ballots,
while the renderings are counted again on every pass,
so no stored answer changes.
The pipeline digest (`glossary/src/corpus-run/pipeline-digest.ts`) hashes the built `dist` tree,
so it moves with this commit as with any code change and never reads an artifact field,
and the field changes it in no other way.
No page is rewritten.

Test:
`consistency-slot-in-span.unit.test.ts`,
`consistency-span-agreement.unit.test.ts`,
`consistency-slot-definitions.unit.test.ts` for the reduction,
`pass-consistency-apply-record.unit.test.ts`,
`artifact-two-lane-read-consistency-rendering.unit.test.ts`,
`artifact-two-lane-read-consistency-span-slot.unit.test.ts`,
`artifact-two-lane-read-consistency-span-located.unit.test.ts`
and `artifact-two-lane-read-consistency-span.unit.test.ts`.

Recurrence:
`mistake-prevention-stored-files-and-cached-decisions.md`,
"Files a later run reads back".

## B666: the carry reader keeps its tolerance for generation 17 and earlier only

Decided on 2026-10-18 by the lead,
who closed the question left open in B664.

Outcome written on 2026-10-18.
Red `f5dc1482dc`,
fixed in `7410c9948f`.

What changed:
`assertCarriesRecount` takes the generation.
A carry whose first count reached its quorum,
gave no candidate a strict majority
and names finalists under `runOffChoiceFinalistsOf`
must record its `runOff` from generation 18,
and is refused at `...carries[i].runOff` without it.
Generation 17 and earlier read such a carry as it was written,
since the runs of those generations asked the split and went no further.
The predicate is `artifactGenerationRequiresCarryRunOff`.
A first count that missed its quorum needs no run-off at either generation.

Test:
the carry tests in `artifact-two-lane-read-consistency-carry-run-off.unit.test.ts`
(a three-way split and a lone leader are refused at 18 and accepted at 17)
and the fixture and call sites of `artifact-two-lane-read-consistency-carry-recount.unit.test.ts`.
The accept list lost the 1-1 carry with no majority and the earlier run's split with no run-off,
which are now the generation 17 case.
The guard demo switched off the generation check and failed the new case,
and the case passed again with the check restored.

Reader check:
`read-all.ts` over the same five `artifacts` directories with this build accepted all five artifacts
(generations 14,
14,
15,
17 and 17),
output in `w184-notes/reader-check-2.txt`.

## B667: the located-words refusal named the quotes of the place and not of all usable ballots

Found on 2026-10-18 and left as it was in B662.

Outcome written on 2026-10-18.
Red `f5dc1482dc`,
fixed in `7410c9948f`.

The refusal of a located rendering that is not the agreed words read
"words that a strict majority of the quotes naming the place contain",
while the recount counts the quotes of more than half of all the usable ballots (the rule of B641 and B662).
It now reads "words that the quotes of more than half of all the usable ballots contain,
as the place's English holds them".
The two tests that pinned the old text in `artifact-two-lane-read-consistency-span.unit.test.ts`
were changed first and failed at the red commit,
and pass with the text.
