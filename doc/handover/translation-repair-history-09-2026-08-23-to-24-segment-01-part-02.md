# Translation repair history: segment 1.2

Part of the [translation repair history index](translation-repair-history.md).

## Current stop condition

Historical evidence only.
Candidate M failed on 2026-09-01.
No historical next-action list authorizes a corpus run,
model call,
spent-prompt retry,
or successor implementation.

## Continued record

### Preserved chronological continuation

`pageChars` fell by exactly two hundred and `missing` stayed at zero.
The check did not notice.

THE REASON IS STRUCTURAL,
not a coding slip.
The wordings cover the slices.
A page is the archive with the slice spans replaced,
so most of it is text no reading describes,
and a deletion there is invisible to any per-slice check.
The claim in the module note was true only of losses INSIDE a slice wording.

### What replaced it: arithmetic that covers the text no slice names

Splicing replaces each span with its replacement,
so the document grows by exactly what each slice added
and shrinks by what it removed,
and everything between the spans is carried through untouched.
That gives a prediction that needs no offsets:

    expected = archiveChars + sum over slices of (shippedChars - incumbentChars)

The archive text is on the artifact already,
stored by `#128` and decided in `doc/decision/artifact-stores-the-archive-text.md`,
which is what makes this reachable without adding a field.

MEASURED BEFORE IT WAS TRUSTED,
on six real published pages across four runs.
The prediction was exact on all six:
`gaoyanger` 349 to 370,
`dogesir_` 3716 to 3840,
`wangzihao980` 2133 to 2295,
`Acheron` 1269 to 1172,
`AmbeR_the_anpa` 2516 to 2576,
`Anilovr` 2236 to 2343.
Five grew and one shrank,
so the arithmetic is not a restatement of the archive length in either direction.

Both controls then failed the page and the negative control stayed clean:

    untouched:      chars=3840=expected            missing=0   exit=0
    minus 200:      chars=3640/expected 3840       missing=0   exit=1
    plus 200:       chars=4040/expected 3840       missing=0   exit=1

`missing=0` on both mutations is the point.
The occurrence scan still reports nothing wrong;
only the arithmetic refutes them.

### Where the arithmetic stops being an equality

A FILLED ANCHOR MAKES IT A FLOOR.
`spliceSlices` composes the separators around an inserted rendering
rather than carrying them in any row,
which `delivery-invariants.ts` states in the same words:
a concatenation of row texts differs from the document while nothing is wrong.
Those separators are real characters nobody counted,
so a page with one is longer than the sum predicts.
`pageWeightRefutes` is one-sided accordingly:
exact weighings must match,
inexact ones only set a floor,
and a page under its floor lost text either way.

An artifact written before `archiveText` was stored reports `UNWEIGHED` rather than agreeing,
so a run of old artifacts cannot read as a run that was checked.

### Both halves are kept, because neither subsumes the other

The order scan catches wording swapped between two slices of equal size,
which the length invariant cannot see.
The length invariant catches the two hundred character cut,
which the order scan cannot see.
Each has a test naming the other as the case it does not cover,
so removing one will fail a test that says why it was there.

Landed in `093b53001`,
572 PASS,
0 FAIL,
0 lint warnings,
types clean.

## The recheck ballots have still never reached a live artifact, and the reason is not a defect (`#192`)

MEASURED 2026-08-24 over every settled artifact on disk.

`#192` landed in `f65b727b7` and is GFP-proven in unit tests.
The live-artifact VUB was still owed,
and reading the artifacts says it is not merely owed but failing:

    issue records total = 1215
      refined AND resolved = 160      <- these buy a checker round
      carrying recheckReading = 0

The conjunction is what matters.
`retainsResolvedIssues` returns early with `readings: {}`
when the slice has no confirmed-resolved issue,
so `refined` alone proves nothing.
A record that is BOTH `refined` and `resolved` went past that early return,
bought a round,
and must carry its ballots.
There are 160 of them across twenty entries and not one has a reading.

### The cause is launch ordering, not a dropped field

Two readings were considered and the first one was wrong.

REFUTED:
an explicit artifact projection that lists fields and missed this one.
There is no such projection.
`rg 'checkerReadings' src --glob '!*test*'` finds seven hits,
none under `corpus-run/`,
so chunk outcomes are serialized whole
and a required field set to `{}` would appear as `{}`.

STANDS:
every one of those artifacts was written by a pass
whose build predates the field.
The tell is `checker-reading-vub/lintong`,
which carries `chunks[n].checkerReadings` and `issues[n].checkerReading`
and no `recheckReadings` at all,
while `AmbeR_the_anpa` and `Anilovr` carry none of the three.
Three different builds,
three different field sets,
all settling within two hours of each other.
This is the trap already recorded here:
a rebuild does not change a running pass,
and a pass launched before a field exists never writes it,
however long it runs.

Every construction site does set the field.
`repair-chunk.ts`,
`repair-unchanged-outcome.ts`,
`repair-not-applicable.ts`,
and both exits of `refine-slice-settle.ts` all name `recheckReadings`,
and `ChunkRepairOutcome` makes it required so a new site cannot forget it.

### A search trap that produced the wrong reading first

The refuted reading came from `rg 'recheckReadings' . | head -20`,
which returned exactly twenty lines and omitted `repair-not-applicable.ts:79`.
The omission looked like a construction site that forgot the field.
QRY names this exact failure:
a `head` cap makes a search report fewer matches than exist and says nothing about it.
Re-run uncapped before concluding a symbol is absent from a file.

### What is now in flight

`recheck-ballot-vub-2026-08-24` on `093b53001`,
running `keyword233,saurikissa`.
Both entries produced the `refined AND resolved` conjunction on every earlier run that settled them,
`keyword233` at 7 and 5 records and `saurikissa` at 5,
5,
5 and 4,
so both are expected to buy a recheck round rather than merely maybe.

The same run answers `#193`:
the accept gate's panel readings have never reached a live artifact either,
for the same reason and on the same schedule.

### Two batches were stopped rather than left running

`checker-width-wide-batch-2026-08-24` and `checker-width-wide-batch2-2026-08-24`
had failed at their originally launched task,
been relaunched with their output going to a closed descriptor,
and were holding `pass.lock` files naming pids that no longer existed.
They had produced no log line in fifty-two minutes.

They were stopped by pid and their stale locks removed.
Nothing was lost:
their slice caches were pinned to a pipeline digest
superseded by five commits since,
so a resume would have re-bought every call regardless.
The question they were opened for,
checker width,
was answered and closed by `#188`,
and the switch they set no longer exists.

### The check now runs inside the pass, not only after it

A check nobody runs is not a check.
`verify-published` reads a run back after the fact;
`refusePageThatDisagrees` asks the same two questions inside `publishFixedPage`,
between the splice and the write.

That position is the whole design.
`pass-entry.ts` already reads its tally line before publishing,
and states why in the same terms:
a question that can refuse an entry has to be asked while refusing is still free.
Raised after the write it would leave a page on disk that no artifact accounts for,
inverting the ordering a resumed pass depends on.
Asked here,
a disagreement publishes nothing and settles nothing,
the pass reports the entry failed,
and the stage caches still hold every answer,
so a re-run reproduces the contradiction rather than losing it.

The archive handed to the guard is the text actually being spliced
rather than the copy the artifact stores,
so the weighing is an equality on every entry
instead of reporting an older artifact as unweighable.

REFUSING AN ENTRY AT ALL IS ONLY DEFENSIBLE BECAUSE BOTH CHECKS ARE ONE-SIDED.
The scan asks only that each wording occur in order,
and greedy leftmost matching finds an assignment whenever any exists,
so it cannot call a correct page wrong.
The arithmetic is an equality only where no anchor was filled and a floor otherwise.
A test pins the filled-anchor case,
because refusing a page longer than the sum
would stop every entry that fills a gap,
which is the work this pipeline exists for.

`corpus-barrel.ts` was at 299 code lines against a 300 cap,
so the publish chain moved to `publish-barrel.ts`,
following the seam `control-barrel.ts` and `generation-barrel.ts` used before it:
by audience.
The barrel falls to 271.

### GFP found a bad test rather than a bad guard

Four mutations,
each rebuilt and run,
then restored.

    delete the guard CALL from publishFixedPage    exit 1, 2 cases fail
    delete the LENGTH branch                       exit 1, 4 cases fail
    delete the WORDING branch                      exit 0, NOTHING FAILED
    restored                                       exit 0, 574 PASS

The third one is the finding.
The case meant to pin the wording branch used a page missing a rendering,
which is ALSO the wrong length,
so the arithmetic refused it and the assertions could not tell which branch had spoken.
`toContain('slice')` did not discriminate either,
because the length refusal says "every slice change".

Repaired two ways.
The assertion now looks for "in slice order",
which only the scan says.
And a new case swaps two settled renderings between their slices,
so the page holds both wordings,
is exactly as long as it should be,
and is wrong only in order.
It asserts both that the two pages are the same length
and that the arithmetic does NOT refute the swapped one,
so if that premise ever stops holding
the case fails rather than quietly measuring the other branch.

Re-run after the repair,
the wording mutation fails two cases and restores clean.

### The wiring had no test either

Deleting the guard call from `publishFixedPage` would have left every existing case green.
That is the same shape of gap that let `#194` ship.

The new case builds an artifact whose comparison row claims more archive wording at a slice
than the archive holds there,
so the artifact and the publisher disagree about what the slice covers.
The wording still ships and still lands in order,
so only the arithmetic notices.
It asserts the throw AND that no page exists afterwards,
since a guard raising after `writeFileAtomic`
would satisfy the first and still leave the page behind.

## Both ballot readings reach a live artifact, and the launch-ordering diagnosis was right (`#192`, `#193`)

VERIFIED 2026-08-24 on `ballot-reading-vub-2026-08-24/GLaDOSister`,
settled by a pass launched on a build carrying both fields.

    issue records            120
    refined AND resolved      26
    of those carrying recheckReading   26      <- all of them

    chunks[n].recheckReadings                  10
    chunks[n].issues[n].readings.issue/<id>    240 panel readings
    configuredPanelists                        264
    checkerReading / checkerReadings           91 / 10

Every record that bought a recheck round kept its ballots,
and the accept gate's panel readings are on the artifact per claim.
Both live-artifact VUBs are met and both tasks close.

This also confirms the reading recorded above rather than merely being consistent with it.
The 160 records with no reading came from passes whose builds predate the fields;
the first entry settled by a pass launched after them carries every field on every eligible record.
No code changed between the two observations.

The same entry's page passes the standalone verifier at `chars=3502=expected`,
so `#197` has its live boundary check too.

## A lost voice and a genuine absence land as the same gap (`#198`)

FOUND 2026-08-24 by measurement,
while diagnosing why XIEPT2 was the only entry in the corpus producing unfilled slices.

`TranslateAbsenceReason`'s `no-candidate` says in its own TSDoc that it covers
"every translator was silent,
blank,
or lost its voice".
Those are three different facts.
A translator that declined is evidence about the passage;
a translator whose answer failed to parse is evidence about the hour.
Both land as the same reason,
the slice ships as a gap,
and the artifact records an absence a later reader cannot tell from a real one.

### The first reading was that XIEPT2 cannot fill its own gaps, and it was wrong

XIEPT2 had eight unfilled slices against zero across 108 slices in every other run,
which reads like a property of the hardest entry in the corpus.
It is not.

Voice loss is time-varying,
and it moved by an order of magnitude in one hour:

    xiept2-anchorfix   04:00 UTC    129 streams     4 lost     3%
                       05:00        229 streams     2 lost     1%
                       06:00       1896 streams   371 lost    20%

    recheck-ballot     05:00         14 streams     0 lost     0%
                       06:00       2023 streams   397 lost    20%

The unfilled slices track it exactly:

    XIEPT2 translate lane   05:00 hour    13 computed,   0 unfilled
                            06:00 hour     9 computed,  10 unfilled

### The cause is outside this build, and that part is proven

XIEPT2 has been running since 01:20 on a build loaded at launch,
and a rebuild does not change a running pass,
so none of the five commits landed today can have caused its 3 to 1 to 20 percent.
It is a frozen-code control that ran straight through the boundary.

Two passes on DIFFERENT builds and DIFFERENT entries
cross into 20 percent in the same wall-clock hour.
Loss is spread evenly across all six models,
59 to 62 each,
so no single model explains it either,
and for this window it supersedes `#77`'s finding that Kimi-K3 dominates.

WHAT IS NOT ESTABLISHED is which external thing it is.
Provider,
network and this host are all consistent with the evidence gathered.
The claim that stands is narrower and sufficient:
it is not our code.

### Why this is a release concern rather than a bad afternoon

An entry settled during a bad hour publishes a page with holes,
the artifact calls them absences,
`pageSilent` counts them,
and nothing anywhere says they were an artefact of the hour.
Ten of XIEPT2's slices are in exactly that state as this is written.

Three ways out are recorded on `#198`,
unranked pending a decision:
splitting the reason so the artifact records which of the three happened,
refusing to settle an entry whose gaps came from lost voices,
and re-asking a slate whose voices were all lost rather than declined.
Splitting the reason is a prerequisite for the other two,
since neither can act on a distinction the pipeline does not record.

### One operational consequence, taken immediately

`recheck-ballot-vub-2026-08-24` was stopped.
It had been launched to close `#192` and `#193`,
which `GLaDOSister` closed first,
so it was redundant before the degradation made its output untrustworthy as well.
`xiept2-anchorfix` was left running:
its purpose is the `#194` live boundary check,
which is about whether the publisher handles a silent anchor correctly,
and a degraded hour gives it MORE anchors to handle rather than fewer.
Its output is a test fixture,
not a deliverable.

Any quality measurement taken in this window is contaminated,
including anything `#196` would conclude about the per-entry cap.

### The reason is split, and the fact it splits on was already there

Landed 2026-08-24 in `5a482a74f`.

`no-voice-heard` joins `TranslateAbsenceReason` and `TranslateDecision`.
`SLATE_TERMINALS` gives it the same terminal as `no-candidate`,
because what the two tell a reader differs
while what they tell the consolidation does not:
neither reached a judge.
That record is typed `Record<TranslateDecision, ConsolidationTerminal>`
precisely so a new decision fails to typecheck instead of falling into whichever branch is last,
and it worked:
the choice had to be made rather than defaulted.

THE DISTINGUISHING FACT WAS ALREADY AT THE EXIT THAT COLLAPSED IT.
`ProducedSlate.heardTranslators` has been carried since the produce and judge halves were split,
for the reason its own TSDoc gives:
a decision taken over a thin slate is not the same decision,
and the judging half has no other way to know.
Zero heard is the whole test.
This is the fourth defect this session
where the information needed was present and discarded one line before it could be recorded.

### A test was pinning the conflation

The document case for an unfillable passage
builds its fixture with `silentForSource`,
which the harness documents as
"original whose slice every translator fails on",
"standing in for a provider that is down while the signal stays live".
It asserted `no-candidate`.

So the codebase's own fixture for a dead provider
was landing on the reason that means the passage is hard.
It now asserts `no-voice-heard` and its name says why.

### GFP, in both directions, because one direction would prove nothing

    always no-candidate    (the old behaviour)   exit 1, 4 cases fail
    always no-voice-heard  (the opposite)        exit 1, 2 cases fail
    restored                                     exit 0, 575 PASS

The new judge-level cases are a PAIR on purpose.
A single reason covering both states satisfies either case alone,
so only both together show a distinction is drawn rather than a constant returned,
and the two mutations are what demonstrate that.
Their client throws if anything asks it a question,
since an empty slate must buy no judging round.

### What is left on `#198`

Splitting the reason was the prerequisite.
Refusing to settle an entry whose gaps came from lost voices,
and re-asking a slate whose voices were all lost,
both remain open,
and both need a measurement that CANNOT be taken in the current window:
anything measured about re-ask effectiveness during a 20 percent hour
measures the hour rather than the remedy.

### Correction: the cause WAS established, and it was our own quota

Two claims recorded earlier under `#198` are wrong and are retracted here.

RETRACTED:
"WHAT IS NOT ESTABLISHED is which external thing it is.
Provider,
network and this host are all consistent with the evidence gathered."

The cause was established by reading the response bodies.
866 of 875 lost voices carried:

```text
SyntheticHttpError HTTP 429: {"error":"You've exceeded your subscription rate limits. Upgrade, or try again later..."}
```

Three were content-based and three were nginx 503.
It was not provider degradation and not the network.
It was this account's own Synthetic budget running out,
and the owner corrected the reading of it further:

> "own subscription rate limit being hit due to concurrency" - it's not concurrency.
> It's "remaining weekly credits".

That distinction decides the remedy.
A longer backoff cannot help,
because retrying an exhausted weekly budget never succeeds.
Failover to a second provider can.

RETRACTED:
that the two remaining `#198` items are blocked on a clean measurement window.
The owner rejected the premise outright:

> "are blocked on a clean window" - no,
> provider issues are normal and expected,
> our pipeline should be resilient enough to not fail even when the provider is having issues.

Refusing to settle is therefore itself a failure mode rather than a way out,
and waiting for quiet weather is not a plan.
The remedy is `#199`:
a second provider,
and the quota reader that has been built and unwired since 2026-07-16.
