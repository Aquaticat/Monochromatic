# Translation repair history: 2026-08-05 to 2026-08-07, segment 2

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

The fix is symmetric and was always available.
Wording present in BEFORE and absent from AFTER proves the edit removed it,
exactly as mechanically as the forward check proves it added something.
Claims now carry `evidence` for added damage or `omittedText` for dropped
content,
and `removal-corroborated` is its own count so the two never blur.

EXACTLY ONE anchor per claim.
Both at once is a wire fault,
not a stronger claim:
screening each and taking the better answer would let a prober launder a
contradicted quote by attaching a second one.

#### Two aggregation traps, recorded on task 53

Neither is guarded in code and both silently mix populations.

FILTER TO SHIPPED.
The probe runs wherever an operation applied,
including candidates selection
later rejected,
so `introducedDefects` sits on records whose disposition is
`not-selected` or `withdrawn`.
The human repair sheet grades only `shipped` items.
Without the filter the denominator includes regions nobody graded.

DE-DUPLICATE BY ENVELOPE ID.
Every issue sharing a merged envelope carries the SAME tally,
so aggregating over records counts one region once per issue it served.

#### Lint debt cleared while here

Commit `9183e3128`,
on the user's "Fix even pre-existing issues".
Nineteen warnings to zero:
Unicode blocks named in `protected-atom.ts`,
a real type guard replacing `verdict as GradeVerdict` in `grade-agreement.ts`,
the JSON round trip in `repair-provenance.unit.test.ts` split into a named
serialized form,
and the rate precision named in `score-agreement.ts`.

The `structuredClone` suggestion was REFUSED with reason rather than applied:
that test exists to cross the disk boundary,
and JSON drops what a clone keeps,
which is precisely what every optional field on a repair record depends on.

The remaining 150 errors are all `prefer-readonly-parameter-types`,
ignored on this branch by user decision under issue #414.

### Runs 006 and 007: the telemetry becomes readable

Commits `acdcd39ee`,
`b111fc376`,
`9533b0ba8`,
`a13ea1acf`,
plus tests in
`01a46e265` and README in `0bcb1328f`.

#### A quiet probe line said nothing

The first live line read
`3/3 heard over 1 regions, 0 corroborated, 0 contradicted, 0 unanchored`,
which is equally consistent with every prober finding nothing,
every prober declining,
and every ballot being dropped as a wire fault.
Those are three different states and the line could not tell them apart.
The negative verdicts now print beside the positive ones.

NOT restarted for this one:
artifacts already carried the full breakdown,
so the change affects what a run is readable as WHILE it runs,
not what it
records.
The two wire changes below did force restarts,
because telemetry has to come
from the shipped prompt.
On run 007 the same line reads `3 found nothing, 0 declined`,
which is the verification the terse line could not give.

#### Corpus prose could forge the probe sheet

The sheet fenced with a fixed `=====` and marked regions with bare `REGION n`,
`BEFORE:` and `AFTER:` lines.
A setext heading underline IS a row of equals signs,
so a translation containing one could close its own block and have the rest
read as sheet structure.

The package had already solved this TWICE and said so out loud:
`markdown-fence.ts` chooses a fence against enclosed content,
and its own
comment points at `candidate-select-wire.ts` doing the same for a prompt.
The probe shipped without either.
`selectFence` now lives in `prompt-fence.ts` and both use it.
Extracted rather than copied:
two implementations of a boundary deciding whether model-facing text can
impersonate instructions is one too many.

The adversarial test caught ME rather than the code.
The first assertion checked `sheet.includes('===== END =====')` was false,
but `====== END ======` CONTAINS that string,
so it would have passed at any fence width while proving nothing.
Line comparison,
not substring,
whenever a delimiter is the subject.

#### The records could not answer the question they existed for

Each issue record carried its regions' tallies but not the roster size.
Heard voices are recoverable by summing a tally's verdicts;
the CONFIGURED roster is recoverable from nothing.
So no artifact could answer whether a MAJORITY agreed,
which is the only thing the gate decision turns on.
Records now carry `IssueProbeReading`:
tallies plus both roster counts.

This is the second time review caught a defect the probe's own passing tests
did not.
Both times the tests checked what the code did rather than what the measurement
would need.

#### Reading it back

`summarizeProbeTelemetry` holds the two joins no type enforces:

-   DISTINCT ENVELOPES.
    Every issue of a merged envelope carries the same tally,
    so summing over
    records counts one region once per issue it served.
-   SHIPPED ONLY.
    The probe runs on candidates selection later rejected;
    the repair sheet grades only what shipped.

Majority is measured against the CONFIGURED roster,
never the heard one:
retry-to-quorum lets six models settle with three heard,
and a majority of those would be two probers speaking for six.
Unheard voices count as non-confirming,
the conservative direction for a probe whose false positives discard correct
repairs.
Contradicted claims count as NO evidence,
not weak evidence.

`readArtifactProbe` deliberately breaks with `artifact-read.ts` doctrine.
That reader feeds the precision gate and throws on everything malformed.
Here absence and malformation differ:
a record with no probe field is ordinary,
a field PRESENT and malformed means writer and reader disagree.
First is counted,
second throws.
Claims are dropped rather than parsed,
since they carry corpus quotes and the
CLI output must stay safe to paste where artifacts are not.

Run it with
`mise run //package/module/translation-repair:score-probe`.

Verified against a THROWAWAY fixture,
not an empty directory,
which proves
nothing:
two shipped records sharing one merged envelope collapsed to `regions=1`,
and a `not-selected` record carrying three corroborated claims was excluded,
so `majorityIntroduced` read 1 and not 2.

#### Restart ledger

Runs 004 through 007,
four restarts,
ZERO artifacts lost:
every one happened inside the first entry.
Wire or record-shape changes restart;
log wording and read-side code do not.

### The measurement chain, completed while the pass ran

Commits `f1737d6b4`,
`9d1dec09c`,
`51960a35c`,
`f93d86617`,
`aa8b9b1ce`.
Read-side only,
so `pass8-run-007` kept running throughout.

Three holes,
each of which would have made the round-three telemetry
unusable,
and one of them unrecoverably so.

#### Nothing could read a graded repair sheet

`formatRepairSheet` had existed since the two-sheet split and the runbook told
the user to fill it in,
but `parseGradedSheet` reads the DETECTION format only.
So the repair-quality number the second sheet exists to produce was
unobtainable,
and so was anything needing it.

`parseGradedRepairSheet` TRACKS FENCES,
which is why it cannot be a line filter.
The sheet quotes corpus prose that may contain a literal
`- repair grade: [Y]`,
and `repair-sheet.ts` fences that text precisely because it might.
A parser ignoring the fence would let quoted text fabricate a human verdict.
That is strictly worse than dropping one:
a missing grade shows up as an unscored item,
an invented grade shows up as
evidence.

`opensWithVerdict` and `trimLeadingDelimiters` moved to `verdict-letter.ts`.
Both sheets need the identical one-character rule separating a verdict from a
word starting with the same letter,
and two copies would drift into two
denominators.

#### The draw recorded nothing about what it drew

THIS IS THE UNRECOVERABLE ONE,
and it was caught with hours to spare.

The draw wrote two sheets and nothing else.
Sheets are numbered positions;
every machine verdict is keyed by issue id;
and the sheets deliberately print no issue id because a 64-hex string is noise
a grader reads past.
Re-running the draw does not recover the mapping:
the draw is deterministic in its SEED but not its POOL,
and the pool grows with every entry that settles,
so a draw taken at fifteen entries stops reproducing when the sixteenth lands.

Had round three been drawn before this landed,
the probe would have spent the whole round recording evidence for a question
nothing could ever ask.
`sample-manifest.json` is now written in the same breath as the sheets,
seed-named and overwrite-protected exactly as they are,
identifiers only.

#### The two instruments could not be asked about the same item

`probe-agreement.ts` joins them at ISSUE level,
not region level,
because that is the level they share:
a merged envelope serves several issues and the human grades issues,
so
"what did the human say about this region" has no answer when those issues were
graded differently.

ONE CELL IS EVIDENCE AND THE REST ARE NOT.
A repair grade of `Y` means "fully fixes this defect AND breaks nothing nearby",
so `Y` beside a probe finding is a direct human refutation:
each `refutedByHuman` is a correct repair a gate would have discarded,
and that
is the number a gate proposal has to answer for.
`N` is ambiguous BY CONSTRUCTION,
firing both for a repair that did not fix its
target and for one that damaged something,
so `sharedWithHuman` is reported as suggestive and never as confirmation,
and
`unflaggedFailures` is an upper bound on misses rather than a count.

Sheet and manifest lengths must agree or the run throws.
Joining across a disagreement would not lose a verdict,
it would MISLABEL every verdict after the divergence,
which nothing downstream
could detect.

#### Run it

```bash
mise run //package/module/translation-repair:score-probe -- \
  --repair-sheet /ABSOLUTE/path/to/repair-sheet-<seed>.md \
  --manifest /ABSOLUTE/path/to/sample-manifest-<seed>.json
```

Verified end to end on a throwaway fixture,
never on the run's own directory:
a probe-flagged issue graded `Y` scored `refutedByHuman=1`,
a probe-clean issue graded `N` scored `unflaggedFailures=1`,
two shipped records sharing one merged envelope collapsed to `regions=1`,
a `not-selected` record was excluded entirely,
and a truncated sheet threw rather than joining.

#### What is left, and what it waits on

Everything buildable without round-three data now exists.
The remaining items wait on the pass reaching fifteen settled entries:
task 53's gate decision (needs the grades),
task 48's blind pre-grade calibration (needs the sheet;
rounds one and two are NOT usable for it,
because those graded sheets may have
been read this session and blindness cannot be claimed),
task 51's recall re-measure (would contend for quota with the pass),
and task 58's refinement probe (needs the accuracy probe's measured
false-positive rate first).

### Early signal from run 007: the probe has claimed nothing at all

Verified from the LIVE slice cache rather than waiting for an artifact.
Cached `ChunkRepairOutcome` values carry the probe report,
so the serialization
can be checked while the entry is still in flight:

```text
chunk=0 regions=1 probe=heard=3/3 probedRegions=1
chunk=1 regions=1 probe=heard=3/3 probedRegions=1
chunk=2 regions=2 probe=heard=3/3 probedRegions=2
chunk=3 regions=4 probe=heard=3/3 probedRegions=4
```

Serialization is correct:
all nine tally keys present,
`probedRegions` matching
`repairRegions` exactly,
full roster heard every time.

THE PART TO WATCH:
across 8 regions and 24 prober verdicts,
every verdict was
`no-introduced-defect-found`.
Zero corroborated,
zero contradicted,
zero
unanchored,
zero claims of any kind.

Two readings and they are not equally comfortable.

The benign one:
these edits really are clean.
They survived an editor ensemble,
a judge selection,
and a checker stage before the probe ever saw them,
so a low
damage rate is what a working pipeline should produce.

The uncomfortable one:
I OVER-CORRECTED.
The whole design fought one failure
mode,
a prober reporting the pre-existing defect because every region contains
one by construction,
and it fought it three ways at once:
no `clean` verdict,
pre-existing issues shown and labelled as not findings,
and a verbatim-quote
requirement.
A probe that never claims anything is not a conservative probe,
it
is an instrument with no reading,
and `majorityIntroduced=0` across the round
would be indistinguishable from a stage that is silently broken.

NOT acted on yet,
deliberately:
8 regions is far too small to retune a prompt,
and a restart now costs the round's progress for a guess.

WHAT TO DO WITH IT:
watch the claim counts as entries settle.
If the round ends
with zero claims of ANY kind across every region,
the probe has not measured
anything and must not be reported as evidence that repairs are clean.
Say so in
the verdict.
The diagnostic that separates the two readings is the CONTRADICTED
count:
a probe that is looking and failing to anchor produces contradicted and
unanchored claims,
while a probe that has been talked out of claiming produces
neither.
Zero of everything is the shape that indicts the prompt.

### The probe is not deaf: sensitivity measured, not assumed

`mise run //package/module/translation-repair:probe-sensitivity`
(commit adds `corpus-run/probe-sensitivity.ts`).
Cat-themed fixtures only,
no corpus text,
writes nothing,
three model calls.

Run 007's first eight regions produced no claims at all,
which fits two very
different stories,
and waiting for the round to end separates them not at all.
Injecting damage does.
Result:

```text
envelope/clean         heard=3/3  noneFound=3   (no claims)
envelope/omitting      heard=3/3  removal=3
envelope/contradicting heard=3/3  corroborated=3
```

Perfect discrimination.
Zero false positives on a replacement that fixes its defect and introduces
nothing;
unanimous detection of a dropped clause;
unanimous detection of an inverted meaning.
Every claim anchored well enough for the deterministic screen to uphold it,
with nothing contradicted and nothing unanchored.

THE CONCLUSION THAT MATTERS:
run 007's zeros are the benign reading.
Those repairs are clean,
and a round reporting `majorityIntroduced=0` can be
reported as evidence rather than as an instrument with no reading.
The warning recorded in the previous section is DISCHARGED,
and the discharge
is measured rather than argued.

SECOND RESULT,
unplanned:
this independently validates the two-direction screen.
The omitting region is exactly the case a forward-only quote requirement could
never anchor,
and it came back `removal=3` rather than `unanchored=3`.
Had the omission fix not landed,
this check would have shown a probe that misses
the likeliest damage class,
and the whole round's zeros would have looked like
the broken reading.

MINOR,
not acted on:
two of three probers left `category` and `severity` empty
on their claims while still quoting usable evidence.
The fields are telemetry,
nothing reads them,
and the schema requires them so
they arrive as empty strings rather than missing.
Worth a prompt line only if a later analysis wants to group claims by class.

KEEP THIS CHECK.
It is cheap,
needs no corpus,
and answers the one question a
quiet instrument always raises.
Run it whenever the probe prompt changes.

### The checkers can say no, and are blind to collateral damage

`mise run //package/module/translation-repair:checker-sensitivity`.
Same experiment as the probe check,
aimed at the older and more load-bearing
stage.
Cat fixtures,
no corpus text,
three calls.

```text
genuinely-fixed    heard=3  fixed=3 notFixed=0 worse=0  resolved=true
untouched          heard=3  fixed=0 notFixed=3 worse=0  resolved=false
fixed-but-damaged  heard=3  fixed=3 notFixed=0 worse=0  resolved=true
```

FIRST RESULT,
and it settles a standing doubt.
Sol read the 98.1 percent resolution rate (2215 of 2257 accepted issues) as
"direct evidence that the current checker task is permissive and poorly
discriminating".
It is not.
Handed a candidate that is the DEFECTIVE TEXT ITSELF,
unrepaired in every
respect,
all three checkers answered `not-fixed`.
A rubber stamp cannot do that.
The 98.1 percent therefore measures the repairs,
not the checkers,
and may be
quoted as such.

SECOND RESULT,
which is the one worth acting on.
The third case fixes the stated defect and DROPS a clause while doing it:
`...windowsill, and she wakes when the sun moves.` becomes
`The cat sleeps on the windowsill.`
All three checkers called it `fixed`.
Not one voted `worse`.

That is the same damage,
in the same shape,
that the introduced-defect probe
caught 3 of 3 as `removal-corroborated` in its own sensitivity check.
The two
stages were handed equivalent fixtures and answered oppositely.

So the gap the probe was built for is now MEASURED rather than argued:
checkers answer the narrow question they are asked,
"is this accepted issue
gone",
and do not report damage the repair caused on its way.
`worse` is the
verdict that feeds `regressedKnownIssues`,
and it did not fire on real
collateral damage,
which is exactly the weakness recorded on task 53 and now
demonstrated instead of inferred.

WHAT THIS DOES NOT LICENSE:
it is one fixture,
and it says nothing about how
often such damage occurs in real repairs.
Run 007's first eight regions suggest
rarely.
The gate question still needs the round's numbers and is still the
user's.

### Stage sensitivity checks, as a practice

Two of these were built in one sitting and each settled a question that had been
argued for weeks:
whether the introduced-defect probe can hear anything,
and whether the checkers can say no.
Both were cheap,
both used cat fixtures with no corpus text,
both wrote nothing,
and each cost three model calls.

THE SHAPE,
worth reusing:
hand a stage a case where the right answer is obvious and known in advance,
plus a control where the opposite answer is right,
and see whether it distinguishes them.
An ensemble stage that agrees with itself proves nothing;
one that answers a planted case correctly proves it is reading.

WHEN TO REACH FOR IT:
whenever a rate is being quoted as evidence
(98.1 percent resolved,
zero introduced defects)
and nobody has shown the stage producing it can return the other answer.
A quiet instrument and a broken instrument look identical from the outside,
and
waiting for more data separates them not at all.

DELIBERATELY NOT BUILT:
the same check for the adjudication panel.
It is the most load-bearing stage for the milestone,
since precision IS the gate
and round two failed it at 0.740,
so a panel that waved through an obviously false claim would be the single most
valuable finding available.
It was skipped anyway,
because round three MEASURES this directly and better:
the human grades every sampled accepted issue as real or false,
with written
rationale saying why,
over fifty real claims rather than one planted one.
A synthetic panel check would answer a weaker version of a question whose
stronger answer is already arriving.
Reach for it only if the graded sheet leaves the cause of the false positives
unclear.

#### Correction: the first sensitivity run tested the wrong configuration

The result stands,
but the evidence for it did not,
and the gap was mine.

The first run passed `issues: []`,
so the sheet rendered "(none recorded)".
PRODUCTION NEVER DOES THAT.
Every real region arrives with the accepted issues it was cut for,
printed under
"PRE-EXISTING DEFECTS THIS EDIT TARGETED (these are NOT your findings)",
and that line is one of the three defenses against a prober reporting the old
defect.
It is therefore also the likeliest single thing to talk a prober out of
reporting anything at all.
Measuring sensitivity without it described a stage that does not run.

Re-run as a controlled pair,
every region probed twice:

```text
clean          prior=absent  noneFound=3      prior=shown  noneFound=3
omitting       prior=absent  removal=3        prior=shown  removal=3
contradicting  prior=absent  corroborated=3   prior=shown  corroborated=3
```

Identical in both conditions.
Showing the prior defect suppresses reporting THAT defect without suppressing
reporting NEW damage,
and does not induce a false positive on the clean control
either.
The defense does exactly the job it was designed for and nothing more.

So run 007's zeros remain the benign reading,
now established under the
configuration that actually runs rather than a simplified one.

THE LESSON,
worth more than the result:
a sensitivity check inherits every
simplification its harness makes.
Ask what the production call passes that the
check does not,
BEFORE reporting the check as decisive.
I reported it as
decisive first.

#### The checker check had the same fidelity gap, and closing it inverted the worry

The single-issue cases asked whether the stage CAN discriminate.
Production
never asks it that way:
`repair-chunk.ts` passes every accepted issue of a chunk
in ONE call,
and the 98.1 percent rate was only ever measured on mixed sheets.
A checker that keeps up on one issue and agrees with everything on seven would
produce that rate while proving nothing,
so the single-issue result could not
carry the conclusion on its own.

Mixed sheet,
three issues over one candidate that fixes the first and leaves the
second standing,
with a third that was never in the text at all:

```text
mixed-sheet/tense    truth=fixed      fixed=1 notFixed=2  resolved=FALSE
mixed-sheet/meaning  truth=not-fixed  fixed=0 notFixed=3  resolved=false
mixed-sheet/absent   truth=absent     fixed=1 notFixed=2  resolved=false
```

THE WORRY INVERTS.
The concern was permissiveness.
What the mixed sheet shows is
the opposite:
the checkers UNDER-credited a genuinely fixed issue,
two of three
calling the repaired tense gloss unfixed.
The gloss really was gone.
What else
was in the candidate was a glaring meaning error,
and the plausible reading is
contamination:
a defect elsewhere in the text drags verdicts down on unrelated
issues sharing the sheet.

They also mostly refused a fabricated defect,
2 of 3 answering not-fixed for
something never present,
which is the right answer available to them.

WHAT THIS IS AND IS NOT.
One sheet,
one deliberately adversarial fixture,
and a
candidate carrying a far louder defect than any real editor would leave.
It does
NOT establish that production under-credits:
the observed 98.1 percent rate is
hard to reconcile with strong under-crediting,
so either real chunks rarely
carry an unfixed issue beside a fixed one,
or the effect is fixture-specific.

WHY IT MATTERS ANYWAY:
if the effect is real at any scale it biases
`resolvedIssueIds` DOWNWARD on multi-issue chunks,
which feeds `resolvedTotal`
and `resolvedHighSeverity` into candidate selection.
That direction makes the
pipeline ship fewer repairs than it earned,
which is the safe direction to err
but is still a measurement error.
Worth a proper look with real chunk shapes if
round three's resolution counts look low against its repair grades.

#### CORRECTION: the under-crediting did not replicate

The previous section reported that checkers under-credited a genuinely fixed
issue on a mixed sheet,
two of three calling the repaired tense gloss unfixed,
and recorded it as a direction to watch that could bias `resolvedIssueIds`
downward.

Rerun with IDENTICAL inputs:

```text
mixed-sheet/tense    first run  fixed=1 notFixed=2  resolved=false
mixed-sheet/tense    rerun      fixed=3 notFixed=0  resolved=true
```

It did not reproduce.
That was run-to-run variance,
and the finding is
WITHDRAWN.

The isolation case,
added to attribute a cause that turned out not to exist,
still answers its own question and is worth keeping:

```text
all-fixed/tense    fixed=3  resolved=true
all-fixed/meaning  fixed=3  resolved=true
all-fixed/absent   fixed=3  resolved=true
```

Three issues on one sheet,
all genuinely repaired,
all credited unanimously.
SHEET SIZE DOES NOT DEGRADE CHECKER ACCURACY,
which was the concern worth
ruling out,
and it is now ruled out on the shape production actually uses.

THE ONE CONSISTENT IMPERFECTION,
seen in both runs:
the fabricated defect
(`adjudicated/absent`,
describing a dog that appears nowhere in either text)
drew one `fixed` vote out of three,
both times.
The majority correctly answered
`not-fixed`,
so the tally lands right,
but one checker in three will affirm a
defect that never existed.
Quorum absorbs it.
Worth remembering if the checker
roster ever shrinks below three.

THE LESSON,
and it is mine:
I reported an n=1 observation from a STOCHASTIC
ensemble as a finding.
This entire pipeline exists because individual models are
unreliable,
and every stage in it votes for exactly that reason.
A single
adverse draw is the least surprising thing such a system can produce.
Replicate
before recording,
especially when the observation is the interesting one.

#### The probe result held to the same standard that killed the other one

Withdrawing the checker finding for lack of replication while continuing to
assert the probe finding would have been selective skepticism:
keep the result
that flatters the work,
discard the one that does not.
Both were low-n.
So the
probe check was rerun under the same scrutiny.

Every line identical to the first run:

```text
clean          absent noneFound=3     shown noneFound=3
omitting       absent removal=3       shown removal=3
contradicting  absent corroborated=3  shown corroborated=3
```

Two runs,
two prior conditions,
unanimous across all four cells per region.
THE PROBE FINDING SURVIVES the standard that refuted the other one,
which is the
only reason it may now be quoted.

The durable point is the symmetry,
not the outcome.
An adverse result rerun and
a favourable result taken on faith is how a measurement programme talks itself
into whatever it started out believing.
Rerun both,
or neither.

#### Why rejected issues cannot reach the probe denominator

A worry worth writing down because the answer is not local to the reader.
`result.issues` carries EVERY adjudicated issue,
rejected and needs-human
included,
not only the accepted ones.
`readArtifactProbe` filters on
`repairDisposition === 'shipped'`,
so if a rejected issue could ever carry that
disposition it would land in a denominator the repair sheet never grades.

It cannot,
and the reason lives two modules away.
`deriveEditableEnvelopes`
filters to accepted issues BEFORE cutting any envelope,
so `EditableEnvelope`
`issueIds`,
and therefore `RepairRegion.issueIds`,
only ever name accepted
issues.
`buildIssueRecords` gives an issue the regions naming it,
a rejected
issue is named by none,
and `judgeDisposition` answers `no-region` for an empty
region list before it ever considers selection or blocking.

Verified by reading those three,
not inferred from the filter.

### Budget risk: 15 entries may not fit the 12-hour soft budget

Measured off `pass8-run-007` rather than assumed,
at 59 minutes elapsed:

```text
per-chunk minutes: 2.7, 8.2, 11.8, 8.0, 11.0, 12.0
mean 9.80 min/chunk including setup
```

Projected to the fifteen settled entries the draw needs:

```text
3 slices/entry ->  7.4 h   fits
5 slices/entry -> 12.3 h   marginal, over the 12 h soft budget
7 slices/entry -> 17.2 h   does not fit
```

The entry running when this was measured has SEVEN slices.

TWO CAUSES,
and they are not equally fixable.
Provider latency is running high right now:
first-byte times of 126,
176 and
192 seconds appear in this log,
which is most of the per-chunk cost and is
nobody's design decision.
The introduced-defect probe also adds one stage per chunk that has applied
operations,
three parallel calls,
which is real but small beside the six-model
critic and panel stages.

WHAT HAPPENS AT THE BUDGET:
`corpus-pass.ts` stops STARTING new entries once
`SOFT_BUDGET_MS` is reached,
and finishes the one in flight.
It does not crash
and loses nothing already settled.
A short round is a smaller sample,
not a
broken one.

THE DECISION IF IT MATERIALIZES IS THE USER'S,
because both options spend
something they own:
raise `SOFT_BUDGET_MINUTES` and spend more quota and wall
clock,
or draw the sheets from fewer than fifteen entries and accept narrower
page diversity.
Note that the fifty-issue sample size is unaffected either way;
entry count buys diversity across pages,
not statistical power,
which is the
same arithmetic recorded when the cap was set.

DO NOT silently raise the budget.
Measure again at the halfway mark:
the band
interleave means small entries settle faster,
so the mean over fifteen may come
in well under the seven-slice worst case this projection uses.

#### Sharpened: the projection is band-aware, and 15 entries probably will not fit

The first projection spanned 7.4 to 17.2 hours because it guessed at slices per
entry.
Two facts remove that guess.

SLICES ARE SIZE-CAPPED at `SLICE_CHAR_BUDGET = 400` target characters,
so a
slice costs roughly the same wherever it comes from.
Band does not change the
price of a chunk,
only HOW MANY chunks an entry has.
The 9.80 min/chunk mean is
therefore usable across bands rather than only for the large entry it was
measured on.

THE PASS INTERLEAVES BANDS so coverage fills evenly,
so the first fifteen
settled entries are about five per band rather than fifteen of any one.

Estimating slice counts from the band thresholds (`SMALL_BAND_MAX_BYTES` 1843,
`MEDIUM_BAND_MAX_BYTES` 3686,
Chinese at roughly three bytes per character and
an English expansion near 1.6):

```text
small   ~2 slices     medium  ~4 slices     large  ~11 slices
15 entries at five per band ~ 85 slices
85 x 9.80 min = 13.9 h against a 12.0 h soft budget
```

Per-chunk time would have to fall to 8.5 minutes for fifteen entries to fit.

SO THE LIKELY OUTCOME IS A SHORT ROUND,
not a failed one:
the pass stops
starting entries at the budget and finishes the one in flight,
and roughly
twelve to thirteen entries settle instead of fifteen.

THE ONE VARIABLE THAT COULD CHANGE IT is provider latency,
which is the bulk of
the per-chunk cost right now (first-byte 126 to 192 seconds in this log) and is
not stable.
It has been better in earlier runs this session.
Re-measure rather
than trusting this.

STILL THE USER'S CALL,
and now worth raising BEFORE the budget fires rather than
after:
accept twelve or thirteen entries,
or raise `SOFT_BUDGET_MINUTES`.
The
fifty-issue sample is unaffected either way,
so the cost of the short round is
page diversity alone.

#### CORRECTION: the budget caps an INVOCATION, not the round

The previous two sections framed a choice between raising
`SOFT_BUDGET_MINUTES` and accepting a short round.
That choice does not exist,
and I raised it with the user before checking.

`corpus-pass.ts` computes its `done` set by READING THE ARTIFACTS DIRECTORY:

```ts
const done = new Set(
  (await readdir(artifactsDir,))
    .filter(isArtifactFile,)
    .map(toId,),
);
```

So a second invocation skips every entry already carrying an artifact and
continues with the rest.
The soft budget bounds how long ONE run keeps starting
entries;
it does not bound how many entries a round accumulates.
Artifacts
persist,
`attempts.json` persists,
and the per-entry slice cache is discarded on
settle so nothing stale carries over.

THE ACTUAL PROCEDURE when the budget fires:
start the pass again.
It will report
`done=N` for whatever settled and work the remainder.
Nothing is lost and no
configuration changes.

The projection still MATTERS,
just not as a decision:
it says the round needs
roughly one and a half invocations rather than one,
so plan for a second run
rather than being surprised by a short first one.
The pass is a tracked
background task,
so its exit notifies without polling.

WHAT SURVIVES of the earlier sections:
the measured 9.80 min/chunk,
the
band-independence of per-chunk cost,
the ~85 slices for fifteen entries,
and
that provider latency dominates and is unstable.
Only the framing as a
user-facing tradeoff was wrong.

### First real artifact: the probe fires on corpus data

`AmbeR_the_anpa` settled and `score-probe` read it:
