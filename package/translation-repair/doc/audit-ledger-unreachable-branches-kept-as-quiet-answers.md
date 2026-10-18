# Audit ledger: branches no input reaches, kept as quiet answers

Branches no input reaches that answered quietly where a loud refusal belongs,
most met when a coverage census asked for them to be removed.

Part of [Audit ledger](audit-ledger.md),
which lists every file of this record.

## B168: the persistence guard passed an artifact nothing reviewed, and four cases kept the branch that did it

Red in `8f0d7dd6f`,
fixed in `2e02fbd4e`.

Found on 2026-10-05 (UTC)
by the second review of the trial's added cases (its finding 3).
`assertFinalNaturalnessComplete` (`corpus-run/final-naturalness-completeness.ts`)
opened with a branch for a consolidation that never ran:
it returned without a word where the contest had not run either,
refused a contested body slice as short of the naturalness floor,
and passed contested front matter.
Its syntax map carried an empty arm for a contest that never ran.
No pass builds any of those pairings:
`persistSettledEntry` is the guard's one caller,
`pass-entry.ts` hands it only the result of `settledPageArtifact`,
and `settledEntryArtifact` writes `laneSelection` as `contested` and `consolidation` as `settled`,
literals that `buildSettledTwoLaneArtifact` copies unchanged.
The trial's four cases reached the branch through the cast in `artifactCarrying`,
and one pinned the silent pass:
an artifact whose contest and consolidation never ran,
so with no body slice reviewed,
was accepted,
against a TSDoc saying every absent review other than the two named exemptions fails closed.

The fix:
any pairing other than a contested selection over a settled consolidation throws,
its message opening `unreachable:` and naming both records found and the writer that records them otherwise;
the syntax map reads the contested slices with no second arm.
Narrowing `SettledArtifact` to the one pairing was measured first and set aside
(the fixing agent's measurement):
`buildSettledTwoLaneArtifact` takes the whole unions,
and with its parameters narrowed twenty-eight type errors follow
in five test files and one fixture that build pending artifacts for the readers.
One case replaces the four:
it builds each of the three other pairings through `buildSettledTwoLaneArtifact`,
with no cast,
and asserts the three whole messages.
The front-matter case refuses under `unsafe-baseline`,
the skip a body slice ships with,
so only the front-matter rule can be what refused;
it and the absent-review case assert the class and the whole message.

The same pairing stood in a neighbouring file's fixture.
`declinedArtifact` in `corpus-run/pass-readiness-boundaries.unit.test.ts` built it by cast,
and its case went red under the fix (the fixing agent's measurement);
the fixture now records a settled consolidation whose slice carries no polish,
which the guard refuses with the error the case asserts.

Open to the owner's veto:
the throw in place of a narrowed type.

The same review's other findings changed test files only,
merged in `8f0d7dd6f` and green before the fix and after it:

- `preservation-check.unit.test.ts` asserts the whole verdict for an empty licensed quote,
  where the old assertion held with the guard deleted;
- `corpus-run/probe-relabel-control.unit.test.ts` had two cases that passed under three of four mutants of the gatherer;
  it now holds one case for each of the four rules,
  its header states them as the code has them,
  and its dog fixtures are cat fixtures;
- `corpus-run/canadian-forms.unit.test.ts` refuses a year with its ordinal suffix,
  an input the refusal alone leaves unchanged;
- `coverage-wire.unit.test.ts` refuses two replies under a coverage degree that exists,
  and accepts the reply carrying all three fields;
- `corpus-run/model-catalog-compare.unit.test.ts` asserts the report line for line,
  the whole comparison,
  and both parse refusals whole;
- `grade-sheet-read.unit.test.ts`,
  `model-card-derive.unit.test.ts`,
  `synthetic-quota.unit.test.ts`,
  `synthetic-transport.unit.test.ts` and `resolution-wire.unit.test.ts`
  assert whole values and whole messages where they asserted a fragment or a class,
  and the last feeds a numeric string that the whole-number test alone would pass.

Each rewritten assertion fails under the deletion it names
(the fixing agent's mutant runs,
the gatherer's on rebuilt bundles and the others on type-stripped copies of the source).

Recurrence:
`mistake-prevention.md`,
"Guards a census wants gone".

## B176: the corroboration's two empty-group refusals had lost their words

Fixed in `6d60ce1a2`,
with no red case,
since no input reaches the throw.

Found on 2026-10-05 (UTC),
reading the MiMo trial's production diff once the trial was merged.
`corroborate` and `corroborateByOverlap` (`rendering-audit-corroborate.ts`) each read the first member of a group
behind a `RenderingAuditInvariantError` that named the group and why it cannot be empty,
and the trial's T8 change (`18f0b3a85`) replaced both with `nonNullishOrThrow(members.at(0,),)`,
whose whole message is `Expected non-nullish value, got undefined`.
No claim list reaches either:
`corroborate` opens every group with the claim it is keyed on,
and `corroborateByOverlap` grows every group from its seed.

The fix:
both throws are back with their class and their words,
and each function's TSDoc names the refusal.
No case drives them,
since no input builds an empty group;
`stretchReadingOf` reads both as invariant throws,
where it reads the `nonNullishOrThrow` line as cold (the fixing agent's probe).

Recurrence:
`mistake-prevention.md`,
"Guards a census wants gone".

## B177: the substitute break floor took lists of different lengths without a word

Fixed in `6d60ce1a2`,
with no red case,
since no input reaches the throw.

Found on 2026-10-05 (UTC),
reading the same diff.
`substituteBreakFindings` (`source-only-breaks.ts`) takes each side as two parallel lists,
block shapes and break counts,
and read a count at a block's index with `?? 0`,
which the trial's T8 change (`250da1333`) made `nonNullishOrThrow`.
The proof the trial gave holds for production:
`readSliceSkeleton` reads both lists off one parse's top-level blocks,
and `validateTranslatedSlice` is the one caller.
But the conversion refused only some broken inputs and named none.
On the file as it stood at `7f069adc9` (the fixing agent's run of it),
a break list one entry long on either side returned no finding,
a break list one entry short returned no finding where the uncounted block was of a kind the page holds,
and otherwise threw `Expected non-nullish value, got undefined`.

The fix:
the function refuses each side at its entry where the two lists differ in length,
with a throw whose message opens `unreachable:` and names the side.
No case drives it:
the function is not exported,
and 40,009 seeded texts through `readSliceSkeleton` gave no skeleton whose lists differ
(the fixing agent's measurement).
The 55 test files that reach the function through `validateTranslatedSlice` print no failure.

Open to the owner's veto:
the entry check itself,
where the trial's three reads alone already refuse every input production builds.

The same reading left the trial's other edits to these modules standing,
each on the fixing agent's evidence.
Five string reads in `preservation-tokens.ts`,
one in `retry-stated-wait.ts` and one split read in `rendering-audit-screen.ts`
are bounded by their own string's length:
60,016 texts through each reader threw nothing,
where a control read one past the end threw 7,594 times.
The branch removed from `benchRotation` (`stage-fanout-window.ts`) rests on `ChatMessage.content` being a string,
with no cast in production code.
The two OpenRouter extractions return what the inline code at `28303c42a` returned,
over 280 and 14 inputs.
The package index exports 28 more value names than at `28303c42a` and none fewer,
and no added name is imported by nothing.

Recurrence:
`mistake-prevention.md`,
"Guards a census wants gone":
when a fallback becomes a refusal,
the inputs the fallback covered are refused at the function's entry,
in words.

## B199: an artifact whose contest never ran read as nothing to report

Red in `6f61ba5dd`,
fixed in `72f5be638`.

Found on 2026-10-05 (UTC),
as an item ledger M113 left open.
`finalSelectionFindings` (`corpus-run/final-selection-completeness.ts`) read a lane selection that was not `contested`
as an empty list of contests.
No production input reaches that arm:
`pass-entry-persist.ts` holds the function's one caller,
`settledEntryArtifact` writes the kind as a literal,
and `assertFinalNaturalnessComplete` already refuses the same state out loud (ledger B168).

The fix:
the arm throws,
its message opening `unreachable:` and naming the kind found and the writer that records it as contested.
The case that asserted the empty list asserts the whole message.

Open when this entry was written,
closed in B250 (`df807a8b5`):
the sibling arm of the same function,
for a consolidation that never ran,
has the same shape and was left,
since every fixture default of its test file builds that state.

Recurrence:
`mistake-prevention.md`,
"Guards a census wants gone".

## B200: a parsed list item without offsets dropped its whole list without a word

Fixed in `72f5be638`,
its case in the same commit,
since it calls the reader the fix adds.

Found on 2026-10-05 (UTC),
as an item ledger M113 left open.
`readLists` (`corpus-run/list-spread-restore.ts`) returned no list at all when one item carried no start or end offset,
which would move every later list's position in the slice.
The installed parser sets a position on every node it builds
(`mdast-util-from-markdown` 2.0.3,
`enter` and `exit` in its `lib/index.js`),
and none of 54 list items on the 184 pinned pages,
nor of 31 on 13 invented lists,
lacked one
(the fixing agent's reading and counts).

The fix:
`listItemExtent` reads an item's offsets and throws `unreachable:` for an item with none;
it is exported through the barrel so that its case can hand it an item built without a position.
No input reached the old arm,
so the case had no red run on it:
on the tree of `6f61ba5dd` it failed on the missing export.

Recurrence:
`mistake-prevention.md`,
"Guards a census wants gone".

## B223: the width contest answered `none` for a composite whose text is neither seat's

Red in `81ad0add4`,
fixed in `0b687fbdf`.

Found on 2026-10-05 (UTC)
by the first review of the trial's added cases (its finding 4),
behind a case pinning the answer.
`seatThatWon` (`corpus-run/editor-width-contest.ts`) reads which seat won
from the shipped producer and the shipped text,
and closed with `return 'none'` where a composite's text matched neither seat.
`contest`,
its one caller,
seats two composites,
each carrying its arm's patch as the candidate's value,
and a stage that reports a composite ships one candidate's value
(the agent's reading of `contest` and of `selectChunkPatch` in `editor-ensemble.ts`),
so no run produces that state.
`none` is also the answer where no candidate won,
so the sentinel could not be told from an honest reading.

The fix:
the branch is `throw new Error('unreachable: …')`,
naming the composite whose text is neither seat's and why the slate cannot hold one,
with a `@throws` line.
The case that pinned `none` is replaced by
"REFUSES A COMPOSITE WHOSE SHIPPED TEXT IS NEITHER SEAT'S,
since the two seats are the only composites on the slate and a winner ships one of their patches",
which asserts the class and the whole message
and failed on the lead's red tree.
The whole suite's run on `f7653073b` is recorded in B222.

Open to the owner's veto:
the throw,
where deleting the line and keeping `seatThatWon` total over two seats was the other way.

Recurrence:
`mistake-prevention.md`,
"Guards a census wants gone".

## B224: the refine eligibility boundary kept a verdict for a paragraph no parse emits

Fixed in `0b687fbdf`,
with no red case,
since the state cannot be built without a cast.

Found on 2026-10-05 (UTC)
by the first review of the trial's added cases (its finding 3),
behind a case that reached the arm through an `as unknown as` cast.
`judgeParagraph` (`refine-eligibility.ts`) skipped a paragraph standing outside the body zone,
with the reason `not-body-zone`.
`parseDocument` gives a node the zone `footnote-definition` exactly where its kind is `footnoteDefinition`
(`document-node.ts`,
the zone's one writer by the agent's reading),
and the kind test refuses that kind first,
so the arm answered for a node no parse emits.
The trial's fifteenth T8 cluster had recorded as much and cased the arm all the same,
handing the boundary a document built for it.

The fix:
the arm is `throw new Error('unreachable: …')`,
naming the paragraph outside the body zone and the zone's one source,
with a `@throws` line;
`not-body-zone` leaves `IneligibleReason`,
which only the module and its test named on the red commit's tree (`git grep`);
and the case is deleted.
The whole suite's run on `f7653073b` is recorded in B222.

Recurrence:
`mistake-prevention.md`,
"Guards a census wants gone":
no verdict is kept for a fixture production cannot build.

## B231: fourteen chain tails refusing an unhandled member read to the census as code no test ran

Changed in `94de8258e`,
a refactor with no red case.

Found on 2026-10-06 (UTC)
in the whole-suite coverage census taken at `65bd3a645` (`census-5RzoUC`).
B227 closed fourteen branch chains over a union with a call to a helper,
`refuseUnhandledMember`,
which threw a plain `Error`.
The census counts a cold stretch apart from untested code only where it holds nothing but
`throw new Error('unreachable: …')` or a throw of a class whose name ends in `InvariantError`
(`corpus-run/coverage-invariant-throw.ts`).
A call to a helper is neither,
so each tail was listed as cold code:
fourteen cold stretches over 80 lines,
one in each of the fourteen caller files
(the lead's count over the census file,
by a script kept in the session's scratch).
The prevention doc already held that an invariant is written in a shape the census reads (ledger M115);
the helper's shape was not read against that at B227's merge.

The fix:
the helper is the class `UnhandledMemberInvariantError` (`unhandled-member.ts`),
thrown at the chain's end.
Its message is the helper's,
unchanged,
and its constructor keeps the `never` parameter,
so a widened union still stops the build at the throw site;
the thrown value's class name changes from `Error` to the class's own.
The fourteen `@throws` lines name the class.
The class stays unmarked,
as the helper's `Error` was,
since its discriminant is read off a value the types say cannot exist.
The inventory scan refuses an unmarked class that writes its own sentence without a recorded reason,
failed on that at the merge,
and now holds the reason in its withheld list.
The test builds the class through `Reflect.construct`,
since the constructor takes `never`,
and compares the whole text of each refusal.

The whole suite ran on `94de8258e` in a side checkout:
1,621 `[PASS]` lines and no `[FAIL]` line,
the lint finding nothing,
and the 36 source scans passing.

Not measured:
that the census now counts the fourteen apart.
That is read off the census's rule,
and the recount is owed to the next whole-suite census.

Recurrence:
`mistake-prevention.md`,
"Guards a census wants gone":
an invariant is written in a shape the census reads,
and a helper that throws for its caller is not one.

## B250: the final-selection findings read a consolidation that never ran as nothing to report

Red in `3d4558d9c`,
fixed in `df807a8b5`.

Found on 2026-10-06 (UTC),
closing the item B199 left open.
`finalSelectionFindings` read a consolidation recorded as not run as an empty list,
where `settledEntryArtifact`,
its one writer,
records every consolidation as settled.

The fix:
it throws `unreachable:` naming the kind found and that writer.
No input reaches it:
the writer sets the kind as a literal and `assertFinalNaturalnessComplete` already refuses it.
The case is "REFUSES an artifact whose consolidation has not run,
since settledEntryArtifact records every consolidation it hands persistence
and no polish can stand on a stage that never ran".

Recurrence:
`mistake-prevention.md`,
"Guards a census wants gone".
