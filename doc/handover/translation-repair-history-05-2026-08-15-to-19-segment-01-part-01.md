# Translation repair history: 2026-08-15 to 2026-08-19

Part of the [translation repair history index](translation-repair-history.md).

## Current stop condition

Historical evidence only.
Candidate M failed on 2026-09-01.
No historical next-action list authorizes a corpus run,
model call,
spent-prompt retry,
or successor implementation.

## Night of 2026-08-15: a whole-day review, twelve findings, and one nobody found

The day's code went to a second reader in full,
and the answer named twelve
things.
Ten were real and are fixed;
one was a duplicate of what `#103` already held;
one is held open by Question 3 rather than by doubt.
`#103` carries the disposition of each with its commit.

FIRST,
THE ONE NO REVIEW FOUND,
because it is the one that would have cost a
document.
The naturalness lane stamped `changed: true` from the REWRITER's
verdict,
and a rewriter is measured against the accuracy text it rewrites rather
than against the archive.
A refinement that lands back on the archive's own words is a slice nothing
happened in,
and it was being recorded as a change.
That names the slice in the shipped set carrying the archive wording,
which
`assertReplacementsChange` refuses,
so a run the models got right would have
aborted the whole document at assembly.
It now reads the archive text,
and drops that slice's resolved-issue credit on
the same rule the accuracy stage already applies:
nothing it returns can have
resolved anything.

REFINEMENT ALSO HAD NO ABORT PROTECTION AT ALL.
A torn-down exchange surfaced as whichever stage happened to fail,
so a caller
could not tell a spent deadline from a provider fault,
and a phase that settled
under an abort returned a document that read as a finished run.
Both rules now live in `repair-refine-step.ts`.
The second one is CONDITIONAL on the lane having asked somebody something,
and
that condition is load-bearing:
the slice loop deliberately lets a fully cached
document finish under an abort,
because what a stopped run cannot do is BUY what
it is missing,
and an unconditional check broke that rule in the probe.

WHAT ELSE LANDED,
in one line each:

-   `guardFootnoteAssembly` checks its own replacements,
    so a direct caller
    cannot hand it a no-op and have the net-zero branch adopt it as an honest
    empty result.
-   `deriveShippedIndices` states the call order as a precondition and names it
    in the message.
    That refusal is the one a blameless run can reach,
    and only
    by calling it before the guard.
-   A structural regression withdrawn in the same round a footnote took the
    blame is now recorded.
    It used to vanish,
    because a regression the
    withdrawal also fixed never reached another round.
-   Both lanes check a freshly settled record against its own text before
    caching it,
    not only when resuming one.
    Only one direction of that
    contradiction was ever caught downstream:
    a record DENYING a change it made
    is dropped in silence,
    since only changed records become replacements.
-   `winnerChangedText` reads the text alone,
    and `selectRepairCandidate`
    refuses a slate whose unchanged candidate carries anything else.
    Its
    measurements stay unchecked on purpose,
    so an archive that genuinely fails
    an integrity check is still expressible.
-   The comparison refuses repeated rows on the repair side too,
    and refuses a
    repeated shipped index rather than folding it into a set.
-   `runDocumentLanes` preflights both lanes in one call,
    with lane-prefixed
    role names:
    both lanes have a `judgeModelIds` and one object cannot hold
    that key twice.

### A harness fact worth knowing before you read any removal proof

`await describe(...)` runs at module scope,
so a FAILING suite stops every later
suite in the same file.
A probe that breaks an early suite hides whatever the later ones would have
said.
This was found the honest way:
a probe reverted two guards in
`select-candidate.ts` and only one test failed,
which looked like the second
guard being unpinned.
Reverting them one at a time showed both were load-bearing.
Read a probe's failure list as a floor rather than a total.

### Two guards this night added are pinned by no test, on purpose

`assertSettledRecordAgrees`'s CALLS in both lanes are vacuous by construction:
neither lane can produce a contradictory fresh record now that both derive
`changed` from their own text,
so removing the calls turns nothing red.
The function itself is tested.
This is the same shape as the blocked exit's vacuous check,
and it is here for
what it costs rather than for what it catches.

`winnerChangedText`'s wiring is still unpinned for the reason recorded above.

### Two measurements taken while fixing, both zero quota

IMPORTS NOTHING USES.
The finding was six left behind in one file by an earlier
extraction,
on a lint run reporting zero warnings and zero errors.
`eslint/no-unused-vars` is off across this workspace by a decision documented in
place,
and its reasons are all about local variables.
A census over 3459 TypeScript sources finds 93 names used nowhere but their own
import line;
19 were in this package and are gone.
The policy question is `doc/planning/unused-import-lint-policy.md`,
ranked
A > B > C,
and it blocks nothing.

THE DOMINANCE DENOMINATOR IS THE SLICED FRACTION,
not the document.
`assessNonTranslationDominance` sums slice characters on both sides of its
ratio,
so an unpaired or unsliced section is in neither term.
Measured over the 92 pinned pairs:
slices cover 92.5% of an average English
document,
14 entries fall under 90%,
and two fall under half.
`XIEPT2` produces ZERO slices from 17 alignment refusals,
so the lane settles it
as a clean unchanged document having examined nothing.
Nothing behavioural changed,
because which denominator is right is a decision;
`#104` holds it,
and only the contracts that misdescribed it were corrected.

### The night's own fixes went back to the same reader, and nine things came back

Reviewing a review's output is not ceremony here:
the fixes above were written
in a few hours and touch the two assertions the whole assembly contract rests
on.
All nine findings were acted on,
and `#103` carries each with its commit.

THE ONE WORTH REMEMBERING is a finding added hours earlier,
in the same night's
work.
A structural regression withdrawn in a round where a footnote identifier
took the blame was being recorded as `assembly-structure-reverted`,
and the
round cannot know that.
Withdrawing what the footnote named MAY answer the parse
damage or may not;
the next round is what says.
It now reads
`assembly-structure-observed`.
The general lesson is worth more than the string:
a finding written from inside the round that produced it will reach for the past
tense of an outcome that has not happened yet.

TWO JUDGEMENTS WERE TAKEN RATHER THAN FIXED,
both recorded in `#103` with the
reasoning:

-   The refinement abort rule stays coarse.
    It fails an entry whose work is
    finished but was overtaken by an abort,
    because telling that apart from a
    torn-down exchange needs the phase to report whether a voice was abandoned,
    and every stage swallows a failed voice by design.
    A retry costs one entry;
    the alternative ships a cut-short document as whole,
    which costs a corpus.
    The narrower variant is `#103` item 10.
-   `selectRepairCandidate` refuses REPEATED unchanged identifiers,
    and nothing
    more general.
    The reviewer asked for unique candidate identifiers across the
    slate;
    the slate is always exactly two candidates built by
    `settleChunkVerdict`,
    so a general uniqueness check would be one more guard
    no test could pin.
    Recorded so it is not re-raised as an oversight.

THE SLICE CACHE WAS NOT BUMPED,
and the reasoning is now in the version history
in `repair-slice-key.ts` rather than only in a session.
Two changes moved what
`changed` MEANS.
Refinement outcomes are never persisted,
so that half needs
nothing.
And a version-25 accuracy record written before `winnerChangedText`
started reading the text can only over-claim a change,
never deny one,
because
the old rule answered `false` whenever the unchanged candidate won and that
candidate carries the archive text.
Over-claiming is exactly what
`sliceRecordAgrees` discards on resume,
at one recomputed slice.
Bumping would
discard every settled slice in the corpus to fix what the discard path fixes one
at a time.

WHAT IS STILL OPEN FROM BOTH REVIEWS:
`#103` items 8,
9 and 10.
Item 8 is the
same tense problem in the FOOTNOTE findings,
which is a scorecard change rather
than a string change and wants doing with `#102`.
Item 9 asks whether the
archive's own integrity should be measured rather than assumed,
which
`selectRepairCandidate` now makes expressible and nothing yet does.
Item 10 is
the narrow abort rule above.

FOR THE MORNING:
the dominance denominator is now Question 7 in
`doc/planning/translation-repair-open-decisions.md`,
with options,
a ranking,
and what I would do if it is delegated.
It was tracker-only before,
which is not
where a question the user has to answer belongs.

### The settled artifact has a version, and its absences stay absences

`#96`'s schema half is built,
in `f2b8c4e39`.
It was the highest-rated finding
of the whole-day review and it was blocked by nothing,
which is why it went
first rather than the parts Question 5 holds.

WHAT THE ARTIFACT NOW CARRIES:
`artifactSchemaVersion`,
and the `sliceCount`
that both index sets are out of.
Fields had been added three times with no
version marker,
so every reader told the generations apart by guessing from
which fields happened to be present,
which works exactly until two generations
differ in something other than presence.

WHAT READS IT BACK:
`readArtifactChangeSets`,
wired into `parseSettledArtifact`
so every consumer of the parser gets it.
It answers one of three kinds,
and the
three are the point:

-   `unrecorded`,
    when neither index set was written.
    NOT an empty set.
    A run
    nobody wrote index sets for must never read as a run that changed nothing,
    and an empty array is exactly how those two become indistinguishable.
-   `uncounted`,
    when both sets are there without a `sliceCount` to bound them.
    Everything else about them is still checked.
-   `counted`,
    when the version promises all three,
    which is fully validated.

It REFUSES one index set without the other,
a versioned artifact missing either
of them,
and a version this reader does not know.
That last one matters most:
meeting a generation written after you were compiled tells you exactly one
thing,
which is that you do not know the shape,
and carrying on is how an
instrument reports a wrong number rather than a missing one.

MEASURED BEFORE DESIGNING IT,
at zero quota:
164 artifact files are on disk and
NOT ONE carries `pipelineDigest`,
`sourceBytes` or the index sets.
So every
artifact that exists is the oldest generation,
and the two generations between
it and version 1 are empty populations.
They are named in the version history
anyway,
because a reader that meets one must not read it as the generation
before.
The measurement is also what makes wiring the reader into
`parseSettledArtifact` safe:
no artifact on disk can reach any new refusal.

`orderedChangeSets` SPLIT to make this possible:
`checkedChangeSets` holds every
rule that needs no slice count,
and `orderedChangeSets` adds the range check on
top.
The `uncounted` reading needs the first without the second.
Assembly is
unaffected,
and the split is deliberately not exported through a barrel,
so the
public surface did not grow:
its unbounded behaviour is pinned through the
reader and its negative-index refusal through the assembly tests that already
existed.

BOTH GUARDS WERE SHOWN TO FAIL WITHOUT THEMSELVES,
after the commit,
by removing
them,
rebuilding,
running and restoring.
Removing the unknown-version refusal
fails that one test;
removing both change-set refusals fails both of theirs.

A HARNESS FACT WORTH ADDING to the one recorded earlier tonight:
two failures
inside ONE suite both report,
as an `AggregateError` naming how many children
failed.
It is only across SUITES that a failure hides what comes after,
because
each `await describe(...)` runs at module scope.
So a probe's failure list is a
floor at suite granularity,
not at test granularity.

WHAT THIS CLOSED ELSEWHERE:
`#94`'s enforcement half is now entirely done.
Both
index sets are checked and ordered at every return of both lanes and the blocked
exit,
`sliceCount` is on the repair result and in the artifact,
and what remains
in `#94` is only the rename from `chunk` to `slice`,
which is held with `#99`
because renaming before slice identity is settled means renaming twice.

#### And that work went to the same reader, which found six more things

All six were taken,
in `edf269a67`.
Two are worth carrying forward as lessons
rather than as changelog:

THE REFUSAL I HAD NOT THOUGHT OF is an artifact that carries `sliceCount` with
no version.
No writer ever produced it,
which is exactly why it slipped past:
the shape that produces it is a CURRENT artifact whose version field was lost to
an edit or a merge,
and reading that as a generation predating the count throws
away a denominator the run recorded.
The general lesson is that a version field
makes absence meaningful in BOTH directions,
and only one of them is obvious.

I WAS WRONG ABOUT WHO TO BLAME.
I had let `AssemblyContractError` escape the
reader on purpose,
on the reasoning that a repeat or an overlap is a broken lane
contract wherever it is found.
The reader cannot know that:
a run,
an edit,
a
truncation and a merge all look identical from inside a file.
It now reports
what the artifact contains and where,
naming the entry,
and carries the contract
message through without asserting how it got there.
Worth remembering when the
next reader is tempted to describe its input's history.

THE REST,
in one line each.
`KNOWN_ARTIFACT_SCHEMA_VERSIONS` is separate from
the constant the pass writes,
so a later bump cannot orphan the generation
before it.
Which failure a multiply-invalid set reports is now stated and pinned
rather than falling out of the split.
`requireCount` refuses whole numbers past
what JSON carries exactly,
since `Number.isInteger` says yes well beyond the
point where round trips stop being exact.
And a round-trip test drives the real
writer through JSON into the parser,
because every other test in that file
hand-builds the record and would keep passing with the writer misspelling every
field it writes.

BOTH NEW GUARDS FROM THAT COMMIT were shown to fail without themselves as well,
in one probe:
removing the count-without-version refusal and reverting the
safe-integer check fails three tests across two files.

### The proportional aligner is gone, and so are the contracts it left

`3d34b72e2`,
which is `#98`'s two side findings.
`alignProportionally` merged
mismatched sections by cumulative character fraction;
it is what slid `XingZ60`
by two sections and made every issue filed on that entry noise.
The forced
aligner replaced it and it has been unreachable since.
272 lines,
plus
`totalChunkChars` and `mergeChunkRun`,
plus the `sections-merged` finding kind
that only it emitted.
Artifacts settled before the change still carry that
string as prose,
and no reader in the package matches on it.

WHAT THE DELETION EXPOSED is more interesting than the deletion:
seven separate
statements in that file described the behaviour it used to have.
Alignment
called itself total while a refused section lands in no pair on either side.
A
pair claimed either side might span several merged sections.
The fast path was
called `mirrored` while testing only counts and leading node kinds,
which for a
document of ordinary heading sections is just the counts.
`heading-affinity.ts`
still called itself an unwired prototype though the grid scorer has called it
since the forced aligner landed.
Dead code does not sit quietly;
it keeps its
documentation alive around it,
and the surrounding contracts go on describing a
system that no longer exists.

THE HEADLINE DEFECT IN `#98` IS STILL OPEN,
deliberately,
and one correction is
worth carrying:
I had written that the aligner is blind to cross-language
headings.
It is not.
`headingAffinity` scores shared Latin runs precisely so a
handle carried across pairs its sections.
What it cannot score is two headings
with no shared Latin at all,
which is the common case here.
So running the
aligner over the 85 fast-path entries would change no pairing,
and doing it
would look like a fix while altering nothing.

### `#99`'s first step, and a guard proof that argued against its own guard

`d1fd32853` adds `assertSliceIndexing`,
which states the property every cache
key,
splice and cross-lane join rests on:
both sides of a prepared slice agree
about its index,
and that index is the slice's position.
`prepareDocumentPair`
runs it,
since that is the only place holding every slice of a document at once.
It changes no index,
so no cache moves,
and it gives `#99`'s reshape of how
indices are assigned something that fails if the reshape breaks the invariant.

THE PROOF IS THE INTERESTING PART,
because it did not say what I expected.
Mis-stamping the base index with the assertion REMOVED fails 16 tests:
an
existing `prepareDocumentPair` test already covers global document-order
stamping,
and 11 `repairTranslation` children fail with `AssemblyContractError`
from the assembly invariants.
So this defect class was already caught,
three
stages downstream,
as a complaint about a replacement rather than about the
stamping.

That makes the new guard a diagnosis improvement and a floor under the reshape,
NOT the only thing between a mis-stamp and a shipped document,
and it is
recorded that way in `#99`.
Worth doing the probe even when a guard is obviously
correct:
what it measures is not whether the guard works but what the codebase
already knew,
and the honest answer here was "more than I assumed".

The barrel it exports through is new.
`pipeline-barrel.ts` sat exactly at its
line budget,
so one document PAIR,
from the shared preparation to the driver
that runs both lanes over it,
became `document-barrel.ts`.

### A slice is now keyed by what it asks, not by where it sits

`5577324f5`,
and it is the change that makes the rest of `#99` and `#100`
affordable.
Both lane caches hashed the slice index beside the run shape and
both texts.
That meant any renumbering discarded every slice below the change,
however untouched its text,
and one-sided slicing renumbers BY DESIGN:
it
inserts a slice wherever a section has no translation.
Without this,
`#100`
would have rebought the corpus on its first run and again on every slicing
change after it.

WHAT A KEY IS FOR,
stated the way that settles the question:
two runs' slices
are the same slice when the models would be asked the same thing.
That is the
source text,
the incumbent,
the governance flag and the run shape.
Where the
slice sits is not part of the question,
so it is not part of the key.

WHAT IT COSTS,
measured rather than assumed.
Two slices carrying identical
source text,
identical incumbent and identical governance inside one document
now share a cache entry.
Their models would decide identically,
so the shared
record is right rather than merely cheap.
Across the 92 pinned documents and
1260 slices there is no such pair;
the probe was validated first on an invented
document with two identical sections,
where it finds the pair.
Both drivers now
stamp a resumed record with the index they asked under,
because the index the
record was computed with would otherwise name the wrong slice in every issue
record and replacement built from it.

The repair cache moves to 26 and the translate cache to 2,
which discards what
is on disk.
The user authorized that explicitly,
and the version histories in
both files say why it was spent here rather than later.

TWO TESTS CHANGED MEANING RATHER THAN WORDING,
which is worth noticing:
both
lanes used to REFUSE a cached record whose index disagreed,
and that refusal was
the very thing this change makes wrong.
They now assert the re-stamping,
by
resuming from records whose indices are all off by one and checking the document
and every index against the run that settled them.
A third test in
`document-lanes.unit.test.ts` had used the old refusal as its way to make the
repair lane fail with the signal live;
it now fails the lane's cache write
instead,
which is a first-lane failure of the same shape and does not depend on
a rule that no longer exists.

### Every slice now carries a delivery record, and a cache entry proves its own name

`2210fbbf8` builds `slice-delivery.ts`,
which is item 2 of `#102`:
one record
per slice naming the source,
the archive wording,
what the lane decided,
what
actually shipped,
and which of the three ways it shipped.
The distinction it
exists for is that a slice can DECIDE a replacement and still ship the archive
text,
because `guardFootnoteAssembly` withdraws replacements for footnote
damage,
for structural regression,
and for a set that reassembles to the archive
text.
Reading the document alone,
those are indistinguishable from a slice the
judges left alone.
Nothing calls `buildSliceDelivery` yet:
the wiring waits on
Question 5,
and items 5 and 6 (assert that the shipped set equals the
`replacement-shipped` records,
and that reassembling the ledger reproduces the
document) are still owed.

`358efd207` closes the hole the cache-key change opened.
A persisted slice is
named by a hash of its key,
and the loader trusted the file name to say which
question the record answered.
With the index in the key that was nearly
unfalsifiable;
without it,
a record moved,
copied or renamed answers for whatever
slice asks under that name,
and the driver splices its text into a slice it was
never computed for.
Every persisted record now carries an envelope stating the
key it answers,
and the loader refuses a payload whose envelope disagrees.

TWO CORRECTIONS FROM SOL ON THAT ONE,
both worth keeping.
First,
a reader cannot
know whether the run,
a later edit or a truncated write broke a record,
so the
refusal must not blame the run:
it names the file and what disagrees.
Second,
my
own commit message says the two remaining findings are recorded in `#99`.
They
are in `#95`.

### One question, asked once, whatever the cache holds

`40cf35737`.
Taking the index out of the key means two slices with identical
source,
incumbent and governance share an entry.
A WARM run resumes one record
for both,
which is right.
A COLD run asked the models twice,
kept two different
answers,
persisted both under one key and could use either.
Same input,
two
documents,
depending on whether a cache existed.
Both drivers now memoize what
they settle by key within the run,
so the cold path reuses what it just settled
exactly as the warm path resumes it.

ONE NUANCE RECORDED IN `#95` RATHER THAN DECIDED:
the memoization is
unconditional,
including for a record the driver deliberately did not persist
because no translator was heard.
An in-run twin therefore reuses an unheard
record while a warm run would ask again for both.

### The final name of a slice is stamped where the whole document is in view

`3afb233de`.
Subdivision was handed a base index and added its own offset,
which
is right only while every earlier section contributed exactly the slices the base
counted.
`#100` breaks that deliberately:
an insertion slice for an untranslated
section is a slice the base index never saw coming.
`prepareDocumentPair` now
restamps every carved pair through `reindexSlicePair` from where it actually
landed,
then asserts the invariant.
That closed `#99` on the minimal
alternative:
assert the property,
take the index out of the key,
and stamp
centrally,
rather than reshaping three stampings into one type.

### A refusal now names the slice it is actually for

`dba53968e`,
found by the advisor rather than by a test.
`alignmentRefusalFinding`
produces a sentence naming a slice by index,
and that sentence was STORED inside
the settled record.
Since the key no longer carries the index,
one record answers
for any slice asking the same question and is re-stamped when it does,
but the
stored sentence kept the index it was first settled under.
Two identical sections
therefore reported slice 0 twice and slice 1 never.
The sentence is now derived
in the driver from the record disposition,
its alignment measurements and the
index it carries after stamping.

MEASURED STRUCTURALLY,
because both caches had just been invalidated and disk
measures nothing:
this was the ONE index-bearing string stored in a persisted
record.
The repair lane stores none,
and every wire finding names a within-prompt
reference such as an edit region or a claim index,
which the key already covers.

THE PROMPT AUDIT THAT THE WHOLE KEY CHANGE RESTS ON is also closed,
recorded in
`#95`.
Of every file that builds model messages,
only `repair-contract.ts` and
`assembly-integrity.ts` mention `chunkIndex` at all,
and those are a type field
and a set of map keys.
The only index-derived value reaching a prompt is the
`lineStructured` governance flag,
which is in the key,
and `identityContext` is
in the run shape.
So identical texts really do mean an identical question.

### Two sol reviews of `#100`, and what they changed

The first read the ten files of the slicing and alignment path and corrected the
recorded design in ways that reorder the whole task,
now rewritten into `#100`:
`alignHeadingsForced` emits no target cursor,
so the "place at the cursor" rule
was unimplementable;
`ambiguous` does not mean untranslated and treating it so can
DUPLICATE content;
a forced gap need not have a unique boundary;
therefore "emit
every source run exactly once" and "never place inside uncertainty" cannot both
hold,
and some source sections must stay unplaced.
Deleting `mergeOneSidedRuns`
alone makes `runToChunk` throw.
The landing order is now producers LAST:
placement
model,
then assembly,
then lane,
then paragraph subdivision,
then section-level
insertions.

The second was launched because the first had answered a question about
`translate-stage.ts` WITHOUT that file in front of it.
It confirmed the wrong-
success state (with both texts blank,
`wantsReplacement` is false,
the alignment
guard cannot fire,
and a missing translation settles as an ordinary unchanged
slice) and corrected two claims:
structural repair of candidates must NOT be
skipped in absent mode,
since it validates against the ORIGINAL,
and blank fresh
candidates already never reach the slate because `buildTranslateCandidates`
filters them.
It also found that a blank reply still counts toward
`heardTranslators`,
and that the incumbent fallback reports a producer for text
that does not exist.
Both are unmeasured:
no artifact under the runs directory
carries `translate-blank` or `translate-no-candidate`,
because the translate lane
has never run over the corpus.
They are recorded in `#100` landing 3 rather than
fixed speculatively now.

### A chunk can now name a place, and a span has to prove it can be written back

`26267a148`,
`faaa83ed8` and `f51c65549`,
which are landings one and two of
`#100` in the order the review set:
nothing produces an insertion yet,
and by
the time something does,
assembly will already refuse the shapes it must.

THE PLACEMENT MODEL,
in `chunk-placement.ts`.
A chunk is either CONTENT,
which
covers existing text,
or an INSERTION,
which names a boundary where a
translation belongs and none exists.
The discriminant is a field rather than
emptiness:
no constructor here produces an empty content chunk,
but the
exported type is structural,
so any caller can build one and a
`nodes.length === 0` test would silently promote that fabrication to an
insertion.

SOL ARGUED AGAINST MY FIRST SHAPE and was right.
I was going to hang an optional
`placement` field on the one broad chunk type;
that buys the word discriminator
without the protection,
since an insertion stays assignable to everything that
wants content.
The union it proposed,
with the discriminant optional on content
and required on an insertion,
changes no existing construction site and still
stops an anchor reaching a content-only parameter.
Exactly two places had to be
told they mean content,
both in `slice-pair.ts`,
because production makes
nothing else.

THE LINTER ARGUED WITH SOL AND WON A SMALLER POINT.
The review wanted an
insertion typed with an empty tuple for its nodes and an empty string literal
for its text.
`no-optional-escape` refuses both:
a zero-length container is
absence spelled as a value,
and the rule asks for a distinct non-empty domain
value instead.
The `kind` field is that value,
and the constructor keeps the
other two empty.

ONE RULE COVERS THE WHOLE REFUSAL LIST,
in `placement-layout.ts`:
every target
span starts at or after the previous span ends,
walked in slice order.
From that
follow no overlap,
no anchor inside a span,
no two spans starting at one offset,
no anchor after a span it starts with,
and no backward placement,
while every
legal shape stays legal.
Sol checked the equivalence claim against the code and
agreed there is no offset-only counterexample once the per-slice shape checks
pass.

WHAT IT FOUND THAT I HAD NOT:
array order is only slice order if the indices are
positions,
and `spliceSlices` never said so.
Its counterexample is two anchors
at one boundary carrying unique but shuffled indices,
where the descending-index
sort writes BA for slices that say AB.
The splice now asserts slice indexing
itself.
It also refuses blank text written into an anchor whose original says
something,
which needed the index map to carry the whole pair rather than the
target side alone.

THE TEXT-AGREEMENT CHECK IS MINE rather than the review's:
a span's text must be
what the document holds between its offsets.
Sol kept it,
on the ground that no
offset rule can catch stale or foreign slices whose ranges are valid and
ordered,
and corrected the message,
since a mismatch means stale text,
wrong
offsets or another document rather than only another document.

FIVE PROBES,
each shown to fail before being trusted:
the discriminant read as
emptiness (an empty content chunk becomes an insertion),
the ordering rule
removed (a backward placement passes),
the text agreement removed (foreign
slices pass),
the indexing assert removed (shuffled indices pass),
and the blank
refusal removed (an anchor ships nothing).
One earlier probe was rebuilt after
the first attempt failed for the wrong reason,
a missing import rather than the
guard:
a probe that fails on a `ReferenceError` proves nothing about the
assertion it was meant to test.

WHAT LANDING TWO STILL OWES,
recorded in `#101`:
separator ownership.
Assembly
writes model text verbatim,
so an anchor before a heading concatenates with that
heading and one at end of file concatenates with the previous paragraph.
The
review's rule is to strip only outer blank-line material from a fragment,
join
same-anchor fragments with one canonical blank line,
preserve existing
whitespace byte for byte,
and add one blank line only where an insertion creates
an adjacency that had no separator.
It also asks whether a MISSING replacement
for an anchor should be refused the way a blank one now is,
which cannot be
answered until the absent-incumbent lane work says whether assembly may ever
withdraw an anchor's replacement.

### The blank line between two blocks now has an owner

`e2c624fa9` finishes landing two of `#100` and closes `#101`.
Every replacement
until now went into a span that already sat between the right separators,
so
writing model text verbatim preserved them and nothing had to decide anything.
An anchor has no span:
written verbatim before a heading it produces
`...afternoon.## Habits`,
which still parses as Markdown and says something
else.

ASSEMBLY DECIDES,
not the prompt.
A prompt asking for correct leading and
trailing blank lines is a hope that fails silently,
and it cannot be right
anyway:
several fragments landing at one boundary,
each carrying its own blank
lines,
put two between every pair.
Only assembly knows what is on both sides of
the boundary,
how many fragments share it,
and what the document separates
blocks with.

THE RULES,
from the review and unchanged by implementing them:
strip only outer
blank-line material from a fragment and keep its indentation,
since a rendering
that begins with spaces is inside a list or a quote;
join same-anchor fragments
with one blank line;
preserve existing whitespace byte for byte and only top it
up;
use the document's own line ending,
which a Windows translation needs and a
diff would otherwise report as changes to lines nobody touched;
and treat the
end of the file as termination rather than as separation from nothing.
