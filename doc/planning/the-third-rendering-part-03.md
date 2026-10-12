# The third rendering, part 03

Part 03 of [The third rendering](the-third-rendering.md),
whose index lists every part in order.

## The five declines are real, not voice loss

Measured from the archived run-6 state, no quota. This answers the question
#130 had to settle before any decline policy could be written on top of it,
because a policy calibrated on infrastructure failures would be calibrated on
noise.

EVERY ONE OF THE FIVE HAD A FULL PANEL. All five record `judgesAvailable: 6`
and `ballots: 6`: every judge answered, and none was lost to an empty reply or
a cut stream. The earlier declines in this bed that were caused by voice loss
were a different thing, and none of these is one. They are genuine indecision.

They are also near misses rather than chaos. The picks, by candidate index:

    -   `lintong#2` scattered across four candidates, best supported by two.
    -   `keyword233#0` across four, best supported by three, and every one of
        the six ballots was a self-vote.
    -   `Weideriche_#1` split three against three between only two candidates.
    -   `Acheron#1` across five, best supported by two.
    -   `Acheron#2` across four, best supported by two.

The seven slices that DID reach the gate look barely different: their best
candidate carried three or four votes against the declines' two or three, and
`gaoyanger#1` proceeded on the same three-against-three shape between two
candidates that made `Weideriche_#1` decline. What separates them is the
weighting rather than the raw count, and self-voting is doing much of that
work: `keyword233#0` weighed to nothing because all six judges preferred their
own candidate.

That last observation belongs to #91, which is about weighing self-certification
rather than forbidding it, and it now has a measured case behind it.

### What this settles, and what it does not

It settles that the decline rate is behaviour rather than infrastructure, so it
can be reasoned about.

The remaining half of #130 is a values choice rather than a measurement: what
SHOULD happen when a full panel cannot agree. The current behaviour keeps the
incumbent, and that is the reading consistent with everything else decided for
this corpus, where reader protection outranks completeness and a tie already
keeps the standing text. It is adopted on that basis rather than left open, and
it is the owner's to overrule.

### Measurement 4 in full: the three changed slices that lost nothing

Five run-6 slices shipped text differing from the standing rendering. Two were
read and recorded as damaged: `gaoyanger#1` drifted into the present tense, and
`Zha_Ke#1` shipped a short note where the archive carried a will. The other
three were flagged for reading and never got a recorded verdict, so measurement
4 stood as a bare "no, twice" without saying what the rest of the changed
slices did. All three are now read against the same question, which is whether
anything the standing text carried is lost. The passages stay in the run
artifacts under `~/temp/agent`; what follows describes the changes rather than
reproducing them.

`lintong#1` differs in exactly two places. The subject's name changes from a
two-word capitalised spelling to the lowercase single-word form the entry
declares, which is the ground every judge quoted in the run-6 name tripwire gave
for their pick. One sentence loses a trailing English connective that the
original marks nowhere. The attribution line survives intact and every other
line is identical. Nothing is lost.

`Zha_Ke#3` makes two changes and both are what the ballots argued for. A
connective the standing text had read as additive is read as contrastive
instead, and a verb phrase regains the object the original names, which the
standing text had left implicit. The outbound link survives unchanged. Nothing
is lost, and two readings improve.

`Acheron#0` is word for word identical to the standing text. It differs only in
that the semantic line breaks are gone, which is #151 rather than a loss of
content.

Measurement 4 therefore reads three clean against two damaged, rather than two
damaged against silence. Both damaged slices now have a fix and a guard behind
them, in #152 and #153, and confirming those hold in production is what run 7 is
for.

### What run 7 must show, written before run 7 is read

Recorded before the run finishes, for the same reason the `gaoyanger#1`
prediction was worth recording: an expectation written afterwards cannot be
wrong, and so cannot be evidence.

`gaoyanger#1` must not ship a present-tense rendering. The #152 sheets now name
the English as the authority for tense wherever the original leaves it unmarked.
A present-tense rendering shipping again means #152 failed in production, which
is an escalation rather than a cue to re-read the ballots.

`Zha_Ke#1` must ship nothing. Every candidate at that slice should be refused by
the floor, the incumbent retained, and the will preserved. Expect repair-round
churn there, because the finding the floor emits is a kind mismatch no candidate
can act on while #154 is open. That churn is #153 working rather than a hang or
a fresh defect. The one thing worth watching is whether the bed retries an
unfixable refusal past its bounded rounds, which would be a bound to fix in the
bed script rather than a pipeline defect.

The #155 change to DROPPED carries an overcorrection risk, because a criterion
counting anything the archive holds and a candidate omits structurally favours
the lane that starts from the archive. Run 6 settled 8 contests to translate, 4
to repair, and 1 to neither. Translate wins collapsing toward two or three would
mean the criterion overshot, and it would need the bounding pass #143 got.

Decline counts and `neither` counts may move in either direction, because the
sheets themselves changed. That is #130 data rather than noise, and it should be
read as a fresh measurement rather than compared for stability.

### #152 holds in production

Run 7 shipped a fresh consolidation at `gaoyanger#1`, the same slice run 6
damaged. Run 6's rendering opened in the present tense and then switched to the
past inside a single sentence, which is the exact pair of faults the #152 rule
names. Run 7's rendering holds the past throughout and no longer disagrees with
itself.

The expectation was recorded before the run was read, so it is evidence rather
than a reading fitted to a result.

### #154 is document-level data loss, and the pairing already knew

Two questions were open on #154: where the boundary came from, and whether the
assembly recovers what a slice drops. Both are answered from archived state, at
no quota cost.

The boundary came from a fallback, and the pairing had already refused the job.
The `Zha_Ke` artifact records `alignmentPairCount: 1` against `sliceCount: 4`,
with two findings, one per model asked:

```text
block-pairing unusable (hf:zai-org/GLM-4.7-Flash: pairing moves backwards on the translation side at position 3)
block-pairing unusable (hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4: pairing moves backwards on the translation side at position 3)
```

So the LLM-assisted pairing of #131 was asked, both answers were rejected as
non-monotone, and the run then fell back to assigning boundaries by character
fraction. The entry carries 303 source characters against 4388 target
characters, because the page holds a long `<details>` block the Chinese never
transcribes. Splitting a 14-to-1 asymmetry proportionally hands a 41-character
Chinese content warning a 3875-character English region.

That region is mid-element. It contains `<details>`, `<summary>` and
`</summary>`, and it stops before `</details>`. This is why the page fails the
strict grammar, and why #153 mattered: the floor used to read the refusal as
"no page" and skip the check entirely.

Assembly does not recover it. Splicing the run-6 slices back over the archive
text gives a page of 680 characters where the archive had 4388, losing 3708.
The tag counts show the shape of the damage:

```text
<details>   archive x1   assembled x0
</details>  archive x1   assembled x1
<summary>   archive x1   assembled x0
```

The opening tag and the whole body are gone and the closing tag survives with
nothing to close. So the assembled document both deletes the will and emits
unbalanced markup. This settles #154 as urgent before release rather than
urgent eventually.

It also names three separate fixes rather than one.

The first is the fallback itself, which is #71's unfinished half: a pairing the
roster declared unusable must not be replaced by a confident wrong answer. The
signal is recorded in the artifact and nothing reads it, which is now the third
time that pattern has been found.

The second is that a slice boundary must never fall inside an element,
whoever chose it. That is a structural invariant the assembler can enforce
regardless of pairing quality.

The third is #90 and #100: a page region with no counterpart in the original,
such as this `<details>` block, is one-sided content. It should be recognised
and held out of pairing, not handed proportionally to whichever source chunk
happens to sit nearby.

### The census: mid-element boundaries are not a fallback problem

Sizing #154's structural invariant meant asking how often a real slice boundary
lands inside an element. Every settled artifact carrying slice regions was
scanned, which is 18 unique entries and 124 slices, by walking each region's
tags and asking whether every opener it holds is closed inside it and every
closer it holds was opened inside it.

Three slices of 124 cut an element, across two entries of 18. That eighth-of-
the-corpus figure matches the earlier page-level count, where 12 of 92 English
pages use `<details>` and 18 of 92 carry block HTML.

The important result is the second entry. `AkiraComplex` splits a `<BlurBlock>`
across its two slices, with the opener in one and the closer in the other, and
its `alignmentFindings` is empty. No pairing was declared unusable, no fallback
ran, and the asymmetry is a mild 451 source characters against 714 target
characters. The accepted pairing placed that boundary itself.

So the fallback is not the cause of mid-element boundaries, only the cause of
the `Zha_Ke` one. Fixing the fallback would have left `AkiraComplex` exactly as
it is. The structural invariant is required on its own account rather than as
a second line behind the pairing fix, and it is the only one of the three fixes
that catches both cases.

Damage did not land on `AkiraComplex`, but not because anything prevented it.
Both lanes reproduced the tag they were handed, so the element survived. Nothing
required them to. Each slice on its own carries unbalanced markup, so the page
grammar refuses it exactly as it refuses the `Zha_Ke` region, and a candidate
that simply translates the prose it was given drops the tag without being wrong
about anything it was asked.

That failure mode is worse than markup corruption here. `BlurBlock` is the
content-blurring component from #49, so an opener dropped while its closer
survives renders as sensitive content with the blur removed. It is latent rather
than realised, and it is a reader-protection failure rather than a rendering
one.

One limit on the census: it reads regions that were assigned to a slice, so a
page region no slice covers cannot appear in it. It therefore undercounts
exposure rather than overcounting it.

### The real cause: container tags are in no block at all

The census said the invariant should have caught this, because
`assertSpanContiguity` already refuses a slice that cuts through a block and it
runs at preparation, at `document-preparation.ts:293`. Running the real
preparation over the real `Zha_Ke` pair explains why it did not.

`parseDocument` returns six nodes for that page, and none of them is the
`<details>` element. The nodes run to the element's contents directly, as a
paragraph for the summary and a blockquote for the will, and the tags
themselves land in the gaps between nodes:

```text
  block/1   [  159,  370) paragraph
  GAP       [  370,  382) NOT IN ANY NODE: "\n\n<details>\n"
  block/2   [  382,  408) paragraph
  block/3   [  409, 4034) blockquote
  GAP       [ 4034, 4047) NOT IN ANY NODE: "\n</details>\n\n"
  block/4   [ 4047, 4103) mdxJsxFlowElement
```

`AkiraComplex` is the same shape, with `<BlurBlock>` at `[264, 278)` and
`</BlurBlock>` at `[669, 684)`, both in no node.

So the slice at chunk 1 covers `[159, 4034)` and carries exactly three whole
nodes. No block is cut, every block inside the range is one the slice holds, and
the invariant is satisfied on its own terms. The opening tag sits in a gap
inside the range and the closing tag sits in a gap outside it. Assembly replaces
the range, which deletes the opener, and copies the untouched remainder, which
preserves the closer.

That is the whole mechanism behind the assembled page carrying `<details>` zero
times and `</details>` once.

The defect is therefore not that the slicer cuts elements. It is that the
document node model has no representation for a container's tags, so a class of
page content exists only as text between nodes. Every invariant reasons over
nodes, so none of them can see it, and any slice whose range happens to span
such a gap deletes what is in it. `assertSliceCoverage` is blind for the same
reason, since it asks whether every block reached a slice.

This also explains why `AkiraComplex` needed no fallback to reach the same
state. Nothing about a bad pairing is required. An ordinary boundary between two
ordinary blocks does it, whenever a container happens to open between them.

### The guard, and what it finds across the whole corpus

The parse now reports what it dissolves. `flattenContainers` returns the
container spans beside the blocks, `parseDocument` shifts them to absolute
offsets and carries them on `RepairDocument`, and a new
`assertContainerIntegrity` runs at preparation beside the checks that already
guard blocks.

The rule is both tags or neither, rather than no tag inside a range. An element
wholly inside one slice puts both of its tags in that range, which is the
ordinary healthy case: the slice text carries them and a candidate that drops
them is caught downstream where the page grammar refuses it. A rule against any
tag in a range would refuse those pages too, and they are the majority of the
pages that use containers at all.

Running preparation over all 92 pairs, with no pairings supplied:

```text
pairs read: 92
pages carrying a container: 16  (containers in total: 24)
ContainerIntegrityError fired on 11
other preparation failures: 0
```

So 11 entries of 92 currently produce a page that loses an element and emits
markup closing nothing. Five of the 16 container-carrying pages are clean, which
is the measurement that says the predicate discriminates rather than simply
refusing everything it sees.

The elements involved are `<details>` on seven entries, and one each of
`<BlurBlock>`, `<div>`, `<Hexagon>` and `<p>`. `XingZ60` carries nine containers
by itself. Two entries, `hulicaijia` and `lin10104`, fire the mirror case, where
a range holds the closing tag without the opening one.

Zero other preparation failures means the change refuses nothing it did not aim
at.

Two honest limits. The dry run supplies no block pairings, so production
subdivides differently and the slice indices above will not match it; what
carries over is the exposure and the fact that the invariant runs in production
too. And the guard converts silent loss into a loud refusal rather than into a
shipped page, so those 11 entries now stop at preparation. That is the right
trade against deleting a will, and it is why the slicer still owes a treatment:
binding a container's blocks into one slice where its interior is paired
content, and holding the region out where it is not.

### The guard fails when removed, per GFP

The invariant was neutered with an early return, rebuilt, and the suite run.
Exactly the three refusal cases failed and the four acceptance cases still
passed, which is the expected shape: an acceptance case passes vacuously against
a check that does nothing, so only the refusals carry the proof. The invariant
was then restored from the commit and the suite is green again at `exit=0` with
no failing lines.

### Run 7 at seven of thirteen slices

Reading the run against the expectations recorded before it, on the seven
slices settled so far.

The #155 tripwire is not tripped. On these same seven slices run 6 settled four
contests to translate and three to repair, and run 7 settles three and four.
One slice moved, `keyword233#1` from translate to repair. That is a single
change rather than the collapse toward two or three that would have meant the
DROPPED criterion overshot.

Decisions moved more than contests did. Two slices, `keyword233#0` and
`Weideriche_#1`, went from `declined-indecision` to a settled judgement and now
ship, and `Weideriche_#0` did the same earlier. So the changed sheets are
resolving panels that previously could not agree. That is #130 evidence and it
points the same way the decline classification did: the declines were behaviour
rather than infrastructure, and changing what the judges were told changed the
behaviour.

`gaoyanger#1` and `Zha_Ke#1`, the two slices the run exists to check, are one
settled and one still pending.

### A runaway shape the guard was not built for

The run log carries three `StreamCutShortError` events, two of them at 1089815
and 2014974 characters, both from the same model, both ended by the 180-second
deadline rather than by any guard.

That matters because the client-side runaway guard from #119 and #120 is a
degeneracy detector: it looks for repetition and raises
`StreamDegenerateError`. Neither of these is that error, so the guard never
fired. The premise that a runaway repeats itself does not cover a model emitting
two million characters the scanner does not read as degenerate, and nothing else
caps output size.

Filed as #156 rather than folded into #154, with the cap left to be derived from
the observed distribution of completed responses rather than guessed.

## Container tags: the defect has one origin and two consumers

Recorded 2026-08-21, before the fix is written, so the expectations below count as evidence.

### The guard's census, and what it hides

`assertContainerIntegrity` refuses 11 of the 92 readable pairs.
Naming them, because the next measurement has to reproduce this exact set:
`AkiraComplex`, `SevenBird`, `XingZ60`, `Zha_Ke`, `cheonwoomaeng`, `gqt`, `hulicaijia`, `lin10104`,
`mikaela_khara`, `shihai4h`, `zhangyubaka`.
Sixteen entries carry a container at all, so five carry one and are not refused.

The refusals do not share a cause, and reading them as one cause is what sent the first fix at the wrong file.
Eight of the 11 hold a container wholly inside one paired chunk,
and the cut happens when subdivision splits that container's blocks across two slices.
Three do not: `SevenBird`, `mikaela_khara` and `XingZ60` hold a container whose closing tag
falls outside the chunk that holds its own children.
On `mikaela_khara` the chunk ends at 8581, the closer occupies 8581 to 8593,
and the next chunk begins at 8595, so the tag sits in a 14 character gap between two chunks.
On `SevenBird` the closer begins exactly at its chunk's end offset.

That is the same defect one level up.
Chunk boundaries are minted at `src/chunk-document.ts:190` from `first.startOffset` and `last.endOffset`.
Slice boundaries are minted in `runToChunk` at `src/slice-pair.ts:76` from the same two fields.
Both read node extents, container tags belong to no node, so both draw boundaries that cut tags off.
A fix at subdivision alone would leave `SevenBird` and `mikaela_khara` refused,
because their damage is done before subdivision runs.

### Widening at the origin rather than binding at the consumers

The first design was atomicity at subdivision: treat a container as indivisible, carve over atoms, widen at the edges.
It is rejected, and the measurement is what rejects it.
It repairs one of the two consumers, and it leaves any range derivation added later exposed to the same defect.

The fix instead widens the extents where the package first writes them:
a block that carries a container's opening tag owns that tag,
and a block that carries the closing tag owns that one.
Every consumer that reads `startOffset` and `endOffset` inherits the correction without knowing containers exist.

Two facts make this safe, and both are measured rather than assumed.
Across both sides of the whole corpus there are 53 containers and not one of them
has a tag region overlapping any block node, so widening cannot collide with a neighbour.
Nesting exists on `XingZ60` alone, four pairs across its two sides,
and it composes: a block takes the minimum opener start among containers it opens
and the maximum closer end among containers it closes.

Widening also dissolves the atomicity requirement rather than implementing it.
When a container's blocks split across two slices, the first slice carries the opening tag inside its own text
and the last slice carries the closing tag inside its own text.
Each tag is wholly held by some slice, neither is half held, and the invariant is satisfied by construction.
The `AkiraComplex` shape stops being a merge problem.

### What is expected after the change, committed in advance

The census must report 0 `ContainerIntegrityError` across all 92 pairs, with no qualification.
`XingZ60` carries a ninth container in a target-only section that no paired chunk reaches;
it needs no treatment, because no slice reaches it, neither tag is ever held,
and `spliceSlices` copies the region verbatim.
So the expected number is 0, not "0 except one".

Every entry without a container must produce byte-identical slices.
Seventy-six of the 92 have none, and any difference there means the widening reached text it had no business reaching.

On the 16 entries that do carry one, every tag region must fall inside some slice's range.

Cache misses on those 16 are expected, and they are invalidation rather than breakage:
the slice text changed, so the key changed.

### What the guard is for afterwards

Its job changes, and saying so now prevents a later session reading it as dead weight.
Before the widening it stood between a container and a document that loses a will.
After the widening, preparation cannot produce a half held tag at all,
so the guard stands against a future regression in range derivation rather than against damage in flight.

The residual exposure moves rather than disappearing.
A lane can still drop a closing tag from its own candidate,
and that is now a candidate fault rather than a preparation fault.
The machinery for it already exists: the floor reads a page the strict grammar refuses,
and a deleted region is a named fault bounded to a silent original.
Expected steady state, committed in advance: a container defect that used to stop preparation
now appears as a contest-visible fault on one candidate, and a different candidate ships.
No new machinery is to be built for it in this task.

### What the widening measured, including where the pre-commit was wrong

Landed 2026-08-21 as `fdfeb1108`, with tests in `d081efb91`.

The census reports 92 of 92 pairs preparing clean, 0 `ContainerIntegrityError` and 0 other failures.
That is the pre-committed number exactly, `XingZ60`'s target-only ninth container included.

One pre-committed expectation was stated wrong and is corrected here rather than quietly restated.
It said 76 entries carry no container and all 76 must produce byte-identical slices.
That count came from parsing the English side only.
Measuring both sides, 75 entries carry no container anywhere and 17 carry one on some side.
All 75 are byte-identical.
The entry that exposed the miscount is `interrgned`, which carries a `<blockquote>` container
on its Chinese side and none on its English side, so widening correctly changed its source-side slices
while its English side has no container at all.
There is no unexplained drift.

The guard fails when the widening is removed, which is what makes it evidence rather than decoration.
Neutering `widenNodesToContainers` to return its input and rebuilding takes the refusals from 0 to 16,
naming every entry whose English side carries a container and leaving the other 76 untouched.
Restoring it returns the census to 0.

### The old rule was measured wrong, not reasoned wrong

Worth recording because the sequence is the useful part.
The widening landed first while the guard still enforced its original rule,
that one slice range must hold both of a container's tags or neither.
The census then reported 12 refusals rather than 0:
`SevenBird` and `Zha_Ke` were fixed, and `Chinatsu_Suzuki`, `Huasheng` and `LCG_Akiball` were newly refused.

That is the fix working and the guard disagreeing with it.
Once tags ride inside blocks, a container whose blocks fall in different slices is the healthy case:
the first slice carries the opening tag in its own text, the last carries the closing tag in its own,
each lane sees the tag it must reproduce, and the page stays balanced.
The old rule called that a defect because it was written for a world where tags floated between blocks.

So the rule became two narrower ones.
Every tag of a container that holds blocks must lie wholly inside one of them,
and no slice range may end part way through a tag.
Both fire only on a regression in how extents or ranges are derived, which is what the guard is now for.
A lane dropping a tag from its own candidate is a candidate fault,
carried by the floor that reads a page the strict grammar refuses and by the named deleted-region fault.

### Verification state

Suite exits 0 with zero failing cases.
Lint reports 0 errors and 1 warning, the inherited `no-unsafe-type-assertion` on `unwrap-container.ts`,
already shown to be load-bearing: removing the assertion loses the borrowed-foreign marking
and `prefer-readonly-parameter-types` errors in its place.

Two documents that told the old story were corrected rather than left standing.
The `unwrap-container.ts` header said the tags "fall outside every promoted span" and that this was safe;
it now says where they go instead and that a caller reading blocks while dropping containers
reintroduces the defect in full.
Its test case asserting that no promoted block contains a container tag was asserting the defect itself,
so it is reversed rather than deleted.

### Run 7, the pre-committed slice

`Zha_Ke#1` was pre-committed to ship nothing, with the will preserved.
It shipped nothing and the incumbent was retained, so the outcome held.
The mechanism did not: the pre-commit predicted every candidate refused by the floor,
and what happened was `declined-indecision` at the judge, with the incumbent kept for want of agreement.
Recording the difference because a right outcome reached by an unpredicted route
is weaker evidence than one reached by the predicted mechanism, and the distinction should not be lost.

### The instrument that proved it, and the one that could not

The first attempt at an end-to-end check assembled each container entry with identity replacements,
every slice handing back exactly the text it was cut from, and compared the result to the archive.
All 16 came back byte-identical with no tag lost.
That result is worthless, and the positive control is what showed it:
neutering both the widening and the guard and running the same probe returns the same clean answer.
Identity replacement writes back the slice text it was given, and a tag inside a slice range
is inside that slice's text, so the probe round-trips whatever it is handed.
It cannot distinguish a fixed pipeline from a broken one.

The discriminating question is narrower, and it is the asymmetry the widening actually removes.
A tag inside some slice's range is text a lane rewrites.
A tag inside no slice's range is text assembly copies through untouched.
When a container has one of each, the two tags are decided by different authorities:
one can be dropped by a candidate while the other is guaranteed to survive,
which is precisely how a page ends up with markup closing nothing.

Measured across the target sides that carry containers, 24 containers reached in both builds:

    before  6 containers with both tags in a slice range, 7 with neither, and 11 SPLIT
    after   23 with both tags in a slice range, 1 with neither, and 0 SPLIT

The 11 name themselves: `SevenBird`, `XingZ60` three times, `Zha_Ke`, `cheonwoomaeng`, `gqt`,
`hulicaijia`, `lin10104`, `mikaela_khara`, `zhangyubaka`.
The single remaining "neither" is `XingZ60`'s target-only section, which no slice reaches by design.

WHAT THIS DOES NOT CLAIM. It does not claim a lane can no longer drop a tag.
It claims that both tags of a container are now decided by the same authority,
so dropping one is a candidate fault visible to the contest
rather than a structural certainty invisible to every invariant.
The residual exposure is named in the section on what the guard is for, and it is unchanged by this.

### Three things the widening changes that are not defects

Recorded so a later session does not read any of them as a regression.

Run 7's slices were cut BEFORE the widening, from the cached bed state.
Scoring run 7 against run 6 stays valid, because both read the same slices,
but per-slice comparison on the container entries ends at run 7:
any freshly prepared run re-slices them.
Run 7 must not be credited with the container fix, which landed after its slices were cut.

Seventeen entries will re-buy, not sixteen.
The source side widens too, so `interrgned` re-buys on its Chinese-side `<blockquote>`,
and the five container entries that previously settled clean
(`Huasheng`, `Chinatsu_Suzuki`, `LCG_Akiball`, `NIGHT81473140`, `hakureico`)
re-buy against new content hashes.
Cache misses on those 17 are invalidation, because the slice text genuinely changed.

The residual expectation is recorded and NOT yet observed.
A lane dropping a container tag should now surface as a contest-visible candidate fault,
carried by the floor and the deleted-region rule.
Nothing has exercised that path since the widening landed,
so it stays an expectation until the first post-widening run touches a container entry.

## Run 7 scored, and the deletion it did NOT repeat

### What the headline did, and why it cannot yet be credited to anything

Counting the same way for both runs over the same 13 slices:

- Run 6: the gate ran at 7 slices, shipped consolidated at all 7, and 5 slices ended `declined-indecision`.
- Run 7: the gate ran at 10 slices, shipped consolidated at all 10, and 2 slices ended `declined-indecision`.

The fixes that landed between the two runs were aimed squarely at judges who could not agree,
so the direction is the one they were built to produce.
That is not evidence they produced it.
Twelve of the 13 slices moved between the runs,
including slices where nothing changed but the wording,
because the models are redrawn on every run and the bed buys every call fresh.
A shift from 7 to 10 out of 13 is well inside the spread two draws of that size can produce on their own,
and nothing here has measured that spread.
Run 8 does NOT bound it either, and saying so here corrects a line this document briefly carried.
A run-to-run band has to be measured on ONE UNCHANGED BUILD.
Run 8 carries ONE change run 7 did not:
the `#158` scanner fix, which is not telemetry-only.
Arming the degeneration detector on 47 percent of traffic that was previously invisible to it
can change outcomes on its own,
because a call whose thinking repeats past 131072 characters is now cut where run 7 let it complete.
So run 8 against run 7 still carries a confound, though a narrower one than run 7 against run 6.

The bed's slices are NOT the second change, and a line this document carried saying otherwise was wrong.
The bed does not slice anything.
It replays static artifacts under `~/temp/agent/readable-20260820` and `~/temp/agent/pairfix-20260820`,
every one of them written on 2026-08-20 between 17:34 and 19:29.
The `#154` widening landed at 2026-08-21 14:50:40, about twenty hours later.
Run 8 therefore replays PRE-WIDENING slices, exactly as run 7 did.

That static input is what makes run 9 against run 8 a clean pair:
identical build, identical slices, nothing touched between them.
Until that exists the honest reading is that the gate reached more slices in run 7 and the reason is unmeasured.

### `Zha_Ke#1`: run 6 shipped a 96 percent deletion, and run 7 did not

THE RUN ATTRIBUTION HERE WAS WRONG IN AN EARLIER VERSION OF THIS DOCUMENT,
which read as though run 7 shipped the deletion.
It did not.
Read straight off the two state files:

```text
run 6   Zha_Ke#1   decision=judged                origin=fresh       incumbent=3875   shipped= 164
run 7   Zha_Ke#1   decision=declined-indecision   origin=incumbent   incumbent=3875   shipped=3875
```

Run 6 deleted the letter. Run 7 kept every character of it.

WHAT CHANGED BETWEEN THEM IS THE DECISION, NOT THE JUDGEMENT.
Run 7's panel still reasoned the deleting way:
its recorded selection ballot calls the letter-preserving candidates
"unacceptable because they add the entire letter text, names, and metadata not present in the ORIGINAL".
The panel did not converge, the gate returned `declined-indecision`,
and the fallback to the standing text is what saved the letter.
So the letter survived run 7 by the safety net, not by the panel changing its mind.

RUN 7 IS ALSO THE FIRST RUN CARRYING `#155`.
The policy clause making deletion of page-only content a named fault landed at 13:45:20,
and run 7's state file was created at 13:46:48, eighty-eight seconds later.
Run 6 finished at 13:21, before it existed.
That makes run 6 against run 7 the only before-and-after pair for that clause,
and one slice is not enough to attribute the change to it:
`declined-indecision` is exactly what a panel split by a new fault clause looks like,
and also exactly what an ordinary tie looks like.

TWO OTHER ROWS NEED SEPARATING FROM THE DELETION COUNT.
Run 6's `Zha_Ke#0` and run 7's `Acheron#0` both carry `shipped=0` with `decision` undefined.
Those are slices that failed rather than slices that deleted,
and counting them as deletions would overstate the rate in both runs.

Run 7 does carry one large reduction that is not a failure:
`Acheron#1` shipped 172 characters against 328 standing, judged and fresh, a 48 percent cut.
Nothing has read that slice.

What follows describes RUN 6's deletion, which remains the clearest evidence in the bed.

Run 6 replaced 3875 characters of standing text with 164 characters, and the gate ballots were 6 for consolidated,
0 against.
Every other slice in both runs shipped between 90 and 111 percent of what stood.
This one shipped 4 percent.

The cause is not the judges.
Their own recorded reason is that the standing candidate
"includes the entire letter body and a metadata sentence not present in the original passage",
which is true, and which they were right to notice.
They were shown 41 characters of source against 3875 characters of standing English and asked which was faithful.
Given that pairing the short answer IS the faithful one.

The pairing is the defect.
Every other slice in the bed has a source-to-standing ratio between 2.1 and 4.0,
which is what a Chinese to English pair looks like.
`Zha_Ke#1` sits at 94.5.

`Zha_Ke`'s English page carries ONE container spanning offsets 372 to 4045, a span of 3673 characters,
and its Chinese source carries none at all.
The letter is content the English page has and the Chinese does not,
and the slicing paired it against a note of 41 characters.

### The structural check filtered in the wrong direction

Three of the six candidates at that slice reproduced the letter at about 3800 characters,
and all three were marked `invalid`,
every one of them for the same reason:
`MdxParseError: MDX body refused to parse`.
The three candidates marked `valid` were 136, 161 and 164 characters, all of them deletions.

So at this slice the structural check refused exactly the candidates that preserved the content
and admitted only the candidates that dropped it.
The floor did not fail to protect the letter.
It selected against it.

That parse failure has a named cause, and it is `#154`:
these slices were cut before the container widening,
so the container's tags belonged to no node and the slice text carried a letter body without its opening
and closing tags.
A candidate faithfully reproducing that text reproduces the imbalance, and unbalanced MDX does not parse.
A candidate that rewrites it into a short clean note parses fine.

### What run 8 does NOT test

An earlier version of this section said run 8 was the first run whose slices are cut after the widening,
so it would be the live test of the residual expectation recorded here as unobserved.
That was wrong, and the timestamps settle it:
the bed replays artifacts written 2026-08-20, and the widening landed 2026-08-21 14:50:40.
Run 8 never exercises the widening.

The consequence for scoring matters more than the correction.
At `Zha_Ke#1`, a still-failing faithful candidate is NOT evidence the widening failed,
and a passing one is NOT evidence it worked.
The path was not walked.
Testing the widening needs slices cut from the current build, which the bed as written never does.

`Zha_Ke#1` should also come OUT of run 8's accuracy count for the band comparison.
Its `expect: 'repair'` label was set by a reading that did not know
93 percent of the slice's standing text was material the pairing had already declined to pair.
A malformed slice scoring as a clean accuracy point in a thirteen-item bed
moves the number this document is trying to bound.
Score it, record it, and exclude it from the comparison with a note.

The widening does not fix the pairing, and neither does anything else here.
Forty-one characters of source against a 2909-character letter the roster explicitly refused to pair
is a slice no judge should be shown at all, whatever parses.
That is `#157`, and this is the strongest evidence for it in the corpus so far:
not a pairing that produced a confidently wrong answer,
but a CORRECT pairing whose refusal the slicer discarded,
coming within a single unanimous ballot of deleting a letter someone wrote about a person who died.

## Run 8 scored, stratified, and what its headline rate hides

Run 8 finished on 2026-08-21 with all thirteen slices recorded.
Scored flat against the eight-entry reading it agrees on six of twelve,
excluding `Zha_Ke#1` for the reason `#154` and `#157` both give:
that row replays a slice built before either landed.

THE FLAT RATE ANSWERS THREE DIFFERENT QUESTIONS AT ONCE, so it is not the number to read.
The bed's own note records that `neither` in the reading means the two lanes TIED,
"not that both were bad".
A contest that picks a lane there has broken a tie, not contradicted the reading.
And a slice with no standing text has nothing to contest at all,
so its `neither` is structural rather than a judgement.

Split three ways:

- The reading named a lane and standing text existed, seven slices: the contest agrees on six.
    The one miss is `Acheron#2`, where the reading says translate and the contest chose repair.
- The reading called the lanes tied, three slices: the contest broke toward repair on all three.
- No standing text, two slices: `Zha_Ke#0` and `Acheron#0`, both necessarily `neither`.

THE TIE-BREAK LEAN IS WORTH WATCHING AND IS NOT YET A FINDING.
Three of three toward repair is what a systematic lean would look like
and also what three coin flips look like one time in four.
Run 9 is the second draw, on the identical build and the identical replayed slices,
and it is the thing that can tell those apart.

WHAT THE GATE SHIPPED: consolidated at eight slices, standing at three, no gate at two.
Judge participation was healthy throughout:
six judges available at every slice that had one,
five or six ballots, and zero abstentions anywhere.
So nothing in this run was decided by a panel that had lost voices,
which is the confound `#156` would introduce if the runaway guard were letting streams through.
