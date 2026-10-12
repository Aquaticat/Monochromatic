# Signals the pipeline emits and nobody reads, part 02

Part 02 of [Signals the pipeline emits and nobody reads](translation-repair-unread-signals.md),
whose index lists every part in order.

## The recurring wall: outcomes are recorded, causes are not

This document is a census of signals the pipeline EMITS.
Four separate
 investigations in one session stalled on the opposite problem,
and they stall
 the same way,
so it is worth naming as one thing rather than four.

-   ~~`quote-not-found` records that a quote failed to anchor,
    and discards the
    QUOTE.~~
    FIXED 2026-08-13 in `b8c678e0a`:
    the finding now carries a bounded
    preview of the needle.
    The 225 misses already recorded stay undiagnosable,
    but future ones name the quote that missed.
    See "The wall came down on one
    of the four".
-   ~~`schema-mismatch` records that a model reply failed to parse,
    and
    `attemptStageCall` discards the `rawText` the outcome carries.~~
    FIXED
    2026-08-13 in `256520df7`.
    See "The second wall came down,
    and the client
    was never the problem".
-   Accepted issues record their claims but NOT which critic raised each one.
    So the duplicate-issue question cannot ask whether a duplicated issue is independent
    corroboration,
    because independence means "different critics" and the
    artifact cannot say.
-   The refiner's silences recorded `refiner 0/1` and no reason,
    so the cause
    was only recoverable once a live run was watched.

The shape is identical every time:
the pipeline records WHAT happened and drops
 WHY,
so any question about cause needs a fresh run rather than the artifacts
 already paid for.
Each of those runs costs days.

The four cases share one remedy:
retain the reason alongside the outcome at the
 point the outcome is recorded,
truncated where the payload is large.
That was
 first written here as "cheap",
which is a claim with a number behind it,
so
 here is the number:

```text
  56 artifacts, 15362 KiB total, median 274 KiB each

  failed quote text        255 x 120B =  30 KiB
  truncated model replies   34 x 500B =  17 KiB
  critic id per claim     5453 x  28B = 149 KiB

  TOTAL                                 196 KiB  = +1.3%
```

So the whole remedy costs about a hundredth of what the artifacts already
 occupy,
and the largest single part is the critic attribution that the duplicate-issue question
 needs.

One correction while measuring this:
the same paragraph originally justified
 caution by saying artifacts "already carry full repaired text",
implying that
 is the bulk.
It is not.
`repairedText` totals 240 KiB across all 56 artifacts,
 under 2% of the 15362 KiB;
the bulk is the 5453 recorded claims and their
 quoted spans.
The caution was pointing at the wrong thing.

Raised here rather than acted on,
on scope rather than on cost.
It would change
 what the duplicate-issue question,
the quote-anchoring finding and the voice-loss diagnosis can be answered from,
so it belongs in a priority
 conversation rather than in a commit landed overnight.

## What still reads nothing

`alignment.findings` is turned into scorecard text and recorded,
and reaches no
 stage that could act on it.
`footnoteGraph` was in that position until 2026-08-13 and no longer is:
 `footnoteBreakCount` reads it,
and the chunk-integrity gate refuses a patch
 raising the break count.
The quote-anchoring findings are recorded,
and now carry a diagnosis,
but
 nothing acts on them either.
Whether any of these should is a design question this document does not settle.

## The quote-anchoring re-open alarm was a pooling artifact, and the closure stands

Fired 2026-08-13 by the run monitor,
which put the quote-anchoring verdict at risk on `pass13`:
8 of 58
 wrap-explained,
where the closure assumed about 3%
and this was nearer 10%.

The figure is arithmetically right and the conclusion is wrong.
It pools two
 populations that the artifact tree keeps separate:

```text
  artifacts     39 quote-not-found   1 collapsible    2.6%
  slice-cache   19 quote-not-found   7 collapsible   36.8%
  pooled        58                   8              13.8%
```

The quote-anchoring finding was closed on the SETTLED-ARTIFACT population,
and that population reads
 2.6% here against the roughly 3% the closure assumed.
It is the same number.
The closure stands and needs no re-taking.

This is the third time this session that a share computed over the wrong
 population produced a false alarm,
after the needs-human share and the
 quote-side split.
The tell is identical each time:
a rate that moves by a
 factor of three or more between a small reading and an established one,
where
 the small reading silently spans a different set of things.

THE MONITOR SHOULD BE FIXED RATHER THAN THE DOCUMENT.
It globs every `.json`
 under the run root,
so it will keep pooling `slice-cache` with `artifacts` on
 every future check,
and every future firing will overstate the same way.

### The slice-cache reading is a real leading indicator, not noise

36.8% against 2.6% is not a rounding difference,
and it deserves an explanation
 rather than a dismissal.

The likely one is timing rather than behaviour.
`artifacts` holds SETTLED
 entries and `slice-cache` holds slices of entries still in flight,
so the cache
 is a window onto work that has not yet reached an artifact.
If those 7
 collapsible failures settle as they stand,
the settled share rises and the finding
 genuinely would need re-taking.

Held as a WATCH ITEM rather than a finding,
for two reasons.
The cache total is
 19 observations,
which is small enough that a couple of entries dominate it.
And the direction is not established:
nothing here shows a cached failure
 reaching an artifact unchanged,
which is the step the inference needs.

Re-read both populations separately when `pass13` settles more entries.
The
 comparison that matters is artifact-share then against artifact-share now,
and
 it is the only one that speaks to the closure.

### It fired again on the settled population, and it was one entry

The fixed monitor,
counting `artifacts` alone as it should,
alarmed at 12
 settled entries:
8 of 59 wrap-explained,
13.6%,
against the roughly 3% the
 closure assumed.
On the right population,
with the pooling bug gone.

It is still a false alarm,
and the reason is the one this session keeps
 relearning:

```text
  Futajuhuacha        7/20     35%
  Aniloviraw          1/6
  every other entry   0/33

  all 12 entries      8/59     13.6%
  excluding the top   1/39      2.6%
```

Seven of the eight hits are ONE entry.
Drop it and the share is 2.6%,
which is
 the closure's number to within noise.
The finding stands,
again.

The watch item recorded when the pooling bug was fixed did predict this
 correctly in one respect:
the in-flight `slice-cache` hits were 7 of 19,
and
 they settled into `artifacts` unchanged,
so the cache was a genuine leading
 indicator of what would land.
What it led to was an outlier,
not a population
 shift.

#### The guard that generalises all three false alarms

Three alarms this session,
three different surface causes,
one shape:

-   `needs-human` at 31%,
    which was `AmbeR_the_anpa` alone.
-   Wrap-explained at 13.8%,
    which was `slice-cache` pooled with `artifacts`.
-   Wrap-explained at 13.6%,
    which was `Futajuhuacha` alone.

A threshold on the share cannot separate these from a real shift,
and the
 second and third cases prove that fixing one surface cause does not stop the
 next.
The rule that does separate them is stated once and applies to all:

A share is a POPULATION signal only if it survives dropping its largest single
 contributor.

The monitor now computes both figures and alarms only when BOTH clear the
 threshold.
It reports the excluded-top share on every progress line too,
so the
 concentration is visible before it becomes an alarm rather than after.

#### Left open, and worth a look when the pass ends

`Futajuhuacha` really is 35% wrap-explained where every other settled entry is
 near zero.
That is a fact about one entry rather than about the pipeline,
but
 nothing here explains WHY one entry's critic quotes should fail line-break
 collapse at ten times the corpus rate.
Cheap to check once the pass stops:
 whether that entry's target text is wrapped differently from the rest.

## The wall came down on one of the four

The recurring wall says outcomes are recorded and causes are not.
One of its
 four instances is now fixed,
and what forced it is worth keeping,
because the
 wall had been recorded twice without anything changing.

WHAT FORCED IT was a concrete blocked question rather than the principle.
`Futajuhuacha` runs at 35% wrap-explained where every other settled entry is
 near zero.
Trying to explain that:

-   The obvious hypothesis,
    that the entry is wrapped differently,
    is REFUTED.
    At 8.3 intra-paragraph line breaks per thousand characters it is
    unremarkable:
    `AkiraComplex` is 18.0,
    `Aniloviraw` 16.7 and `Anilovr` 14.4,
    all with zero or one wrap-explained miss,
    and `Dethelly` is higher again at
    8.9 with none.
-   The next hypothesis,
    that its critics quoted longer spans,
    CANNOT BE TESTED
    from the artifacts.
    Reconstructing the anchoring over every claim span in
    all 12 settled entries found 1027 target spans and every single one located
    exactly,
    with none needing a collapse and none missing.

That second result is the wall itself,
stated precisely.
Claims that FAIL
 anchoring never become issues,
so they never reach the artifact,
so the only
 quotes an artifact carries are the ones that succeeded.
The failures are
 counted and their text is gone.

THE FIX is one call site.
`lineBreakSuffix` already had the needle in scope,
so
 the finding now appends a bounded preview:
line breaks collapsed so a finding
 stays one line,
truncated at 60 characters so a paragraph-length quote cannot
 swamp a scorecard line.

WHY IT IS SAFE for consumers,
checked rather than assumed.
The only non-test
 reader of `unresolvedReasons` is `unresolvedCountOf`,
which takes `.length`;
 the field is documented as feeding prompt iteration,
which is exactly the use
 the needle serves;
and findings already carry variable payloads by convention,
 as `stage-quorum-unmet (${shortfall})` and `duplicate-check (${check.issue})`
 do.
Nothing groups them by string equality.

VERIFIED BY MUTATION,
not by the suite passing.
Removing the preview and
 rebuilding fails 24 assertions across the three test files,
so the two new
 cases covering truncation and flattening are load-bearing rather than
 decorative.

THE OTHER THREE WALLS still stand:
`schema-mismatch` discards `rawText`,
 accepted issues do not record which critic raised each claim,
and refiner
 silences record no reason.
Each is the same shape and each would take the same
 kind of change at the site where the discarded value is still in scope.

`Futajuhuacha` stays unexplained until a pass runs the new telemetry.
That is
 the honest state:
the instrument is built and has not yet been read.

## The second wall came down, and the client was never the problem

Two of the four recurring-wall instances are now fixed.
This one carried a
 wrong diagnosis in the earlier entry,
and the correction is the useful part.

THE EARLIER ENTRY SAID the client discards `rawText` and logs the sub-kind at
 debug.
Reading the source,
`synthetic-client.ts` does neither.
It already
 returns `rawText` on every failure outcome AND a `detail` naming which of the
 three faults fired:

```text
  truncated thinking   output was truncated inside its thinking block
  unparseable          content is not valid JSON: <parser detail>
  guard rejected       content parsed as JSON but failed the caller schema guard
```

The loss is ONE CALL DOWNSTREAM.
`attemptStageCall` in `stage-call.ts` had:

```text
  l.warn(`${stage} ${modelId}: ${outcome.kind}, voice lost`,);
```

`outcome.kind` is the flattened union tag.
Both the sub-kind and the model text
 sat in scope,
unread,
on the same object.
So the emitter was fine and the
 consumer threw the diagnosis away,
which is a different fix from the one the
 earlier entry implied and a much smaller one.

WHAT IT NOW RECORDS:
the sub-kind by name,
plus a bounded,
line-flattened
 opening of the model text.
The opening is the diagnostic part.
The Kimi-K3
 outage was a two-character channel marker prefixing otherwise valid JSON,
and
 it explained 507 mismatches in a single pass;
nothing shorter than the first
 few characters was needed to see it.

The refusal branch is covered too.
A refusal and a parse failure call for
 different responses and both read as a bare lost voice before this.

VERIFIED BY MUTATION:
restoring the bare-kind warning fails 9 assertions.
The
 test harness needed a capturing logger to make that possible,
because the
 existing cases asserted only that a voice was LOST and never read what the
 loss recorded,
which is how a warning this uninformative survived having tests.

WHEN IT WILL BE READ,
and this is NARROWER than the first version of this
 paragraph said.
It claimed the voice-loss diagnosis work's "74-and-counting voice losses become
 diagnosable",
which reads as covering the losses already on disk.
It does not.
 A warning is written once,
at the moment the voice is lost,
so the 74 losses
 `pass13` has already recorded stay bare permanently.
Only losses recorded
 AFTER a fresh process starts carry the sub-kind and the opening.
`pass13`
 cannot see the change at all,
being a frozen module graph;
the detached
 watcher resumes that run in a new process,
so the resumed half onward is
 diagnosable and the already-recorded 74 are not recoverable.

The needle write-up in this document got the equivalent point right,
saying the
 misses already recorded stay undiagnosable.
The voice-loss write-up did not,
 and the two changes have identical reach.

### Both fixes make the run log corpus-bearing, which it was not before

The raw opening is model output on a translation task,
so it is largely corpus
 prose,
and the needle preview carries corpus text by construction.
Before
 today the log recorded `schema-mismatch, voice lost` and `quote-not-found`,
 which name a fault and quote nothing.

As built this is safe.
Both land only in run logs,
which live outside git under
 `node_modules/.monochromatic` and are gitignored,
exactly like the artifacts
 and grading sheets that have always held corpus text.

The constraint is on what happens NEXT,
and it falls on this document.
Reading
 those diagnoses and writing up what they say must not quote a needle or a raw
 opening here,
because this file is committed,
and must not paste log excerpts
 into `pi`/sol or any third-party model.
`one-among-us/data` is unlicensed.
The
 same discipline the grading sheets already carry applies:
name the fault class,
 cite counts,
quote nothing.
`artifact-probe-read.unit.test.ts` states the rule
 for the quote fields it omits,
and it is the same rule.

THE REMAINING WALL is accepted issues not recording which critic raised each
 claim,
which blocks the duplicate-issue question.

It does NOT block the prober-disagreement question,
which earlier versions of this document
 claimed.
That question is about the three PROBERS in the
 introduced-defect probe,
not the critics,
and it already has per-model
 attribution:
it carries measured raise rates over the same 857 regions,
81
 claims against 45 against 5.
What it waits on is the probe calibration's human-graded ground
 truth,
which says which prober is right when they disagree.
Getting this
 straight changes the urgency rather than the work:
The duplicate-issue question is a DECISION task,
so
 critic attribution is groundwork,
not something gating a measurement about to
 be taken.

## The third wall is the same shape after all, and I said it was not

The remaining-wall paragraph of "Both fixes make the run log corpus-bearing,
which it was not before",
as `eab15a03c` wrote it,
said the attribution
 is "genuinely absent rather than discarded downstream",
and that commit's message says the same,
so the fix would need
 the claim to carry its speaker from the critic stage onward.
That is wrong,
and
 wrong in the direction that matters:
it makes a discarded value look like a
 data-flow redesign,
which is the difference between a contained change and one
 nobody starts.
Reading the source says otherwise.

`gatherStageVoices` returns `HeardVoice<ValueT>`,
whose TSDoc reads "One heard
 voice with its speaker" and whose fields are `modelId` and `value`
 (`stage-quorum.ts:53`).
`runCriticStage` then does this,
at
 `repair-stages.ts:153`:

```ts
// package/module/translation-repair/src/repair-stages.ts
const reports = gather.voices
  .map(function toReport(voice,) {
  return voice.value;
},);
```

The speaker is discarded one line after arriving,
and every claim built after
 that line comes from `reports`,
which no longer knows who said anything.
This
 is the third instance of the same shape,
not a different one:
`locate-quote`
 had the needle in scope,
`stage-call` had the sub-kind and the raw text in
 scope,
and `runCriticStage` has the `modelId` in scope.

WHAT IS GENUINELY ABSENT is the destination,
not the source.
`issue-model.ts:10`
 and `aggregate-claims.ts:15` both describe a mechanism in the present tense,
 that "the shell maps claim ids to proposers for calibration,
never for judging".
 No such map exists.
Every occurrence of `proposer` under `src/` is a comment or
 a test name;
none is an implementation.
So the design named the right place,
 recorded why it must sit outside the claim,
and the map was never built while
 its one input was being thrown away upstream.

THE INVARIANT THE FIX MUST NOT BREAK,
and the reason attribution cannot simply
 be added to the claim:
adjudication is provenance-blind by deliberate design,
 `adjudicate-prompt.unit.test.ts` asserts the sheet "keeps proposer identity out
 of the sheet",
and `aggregate-claims.ts:17` records why.
A real defect can
 arrive with exactly one proposer;
the reference run had `gpt-oss-120b` as the
 sole finder of a planted seed.
Proposer counts must never reach a judging
 prompt.
A side map keyed by claim id satisfies this,
because
 `computeIssueClaimId` already gives every claim a stable handle and the panel
 never sees the map.

THERE IS A WORKING PRECEDENT in a sibling stage.
`editor-ensemble.ts:251` tracks
 "every distinct APPLIED proposal for this envelope,
first proposer" for edit
 candidates,
and `candidate-select.ts:29` uses provenance to stop a proposer
 grading its own work.
The pattern is established in this codebase;
the critic
 stage just never got it.

COST OF LANDING IT,
measured rather than assumed.
A change to the chunk outcome
 shape requires bumping `SLICE_CACHE_VERSION` (`repair-translation.ts:85`,
 currently 9),
and that bump was missed on the very commit that added the gate,
 so it is worth pricing before deciding when.
`corpus-pass.ts:566` calls
 `discardSliceCache` the moment an entry settles,
so the cache only ever holds
 in-flight work.
Confirmed on `pass13`:
12 settled artifacts,
and the slice
 cache holds one entry (`GLaDOSister`,
8 files,
216K).
A bump therefore costs
 one entry's partial slices,
not twelve entries.

## Census of the findings nobody reads, pass13

Every settled artifact carries a `findings` array.
`score-probe` reads it,
but
 only to summarize the editor and refine rosters,
so every other kind recorded
 there has never been looked at.
Taken over pass13's first 13 settled entries:
 748 findings.

NONE OF THEM CONTAIN CORPUS TEXT.
Checked rather than assumed:
zero of 748
 contain any CJK character,
and the rare kinds were read with quoted spans
 redacted before anything was pasted anywhere.
That makes a findings census safe
 to share in a way the artifacts themselves are not.

The bulk are ordinary stage bookkeeping:

-   `refine-skip` 214,
    `refine-skipped` 100
-   `editor-candidates` 88,
    `editor-envelope-select` 87,
    `editor-chunk-select` 87
-   `quote-not-found` 69,
    which is the anchoring loss the quote-anchoring finding already measured
-   `refine-candidates` 28,
    `empty-quote` 24,
    `refine-selected` 13,
    `refine-declined` 13,
    `refine-recheck-passed` 8

The tail is where the unread signal lives:

-   `group-index-out-of-range` 5
-   `ambiguous-quote` 3,
    `quote-outside-blocks` 3,
    `non-translation` 2
-   `alignment` 1,
    `duplicate-verdict` 1,
    `unknown-regrade-severity` 1,
    `missing-verdict` 1

### The panel parser degrades gracefully, which is worth stating

`group-index-out-of-range`,
`duplicate-verdict`,
`missing-verdict` and
 `unknown-regrade-severity` all come from `adjudicate-wire.ts`,
and all four are
 the parser correctly refusing a malformed judge answer rather than a defect of
 its own.
The important one is `unknown-regrade-severity`
 (`adjudicate-wire.ts:279`):
it keeps the VOTE and drops only the unusable
 severity,
so a judge that mis-typed a severity still counts toward the verdict.
 A first reading of the name suggests a lost voice,
and it is not one.

At 8 occurrences in 748 findings across 13 entries,
the panel is receiving
 well-formed answers nearly always.
This is a healthy signal that had never been
 read either.

### The one alignment finding contradicts its own message

```text
alignment structure-mismatch (pair 0: section structures differ
  (source 1 chunks, target 1 chunks); aligned proportionally by character fraction)
```

The structures are declared different while both sides have exactly ONE chunk.
 That is not a contradiction in the data,
it is the mismatch test being about
 something other than counts,
and the code says exactly which:

```ts
// package/module/translation-repair/src/chunk-document.ts, the shape test as it stood;
// today it is `equalShape` and reads the same two things
const mirrored = (sourceChunks.length === targetChunks.length)
  && sourceChunks.every(function leadingKindMatches(chunk, index,) {
    return chunk.nodes[0]?.kind === targetChunks[index]?.nodes[0]?.kind;
  },);
```

With one chunk on each side,
the count test passes by construction,
so
 the shape test can be false for exactly one reason:
the leading node kinds differ.
 One document opens with a heading and the other with a paragraph.
That is the
 asymmetric preamble the aligner-scoring finding named,
confirmed from the source rather than
 inferred from a sample.

The fallback did no harm HERE,
because pairing one chunk to one chunk
 proportionally gave the same answer as pairing them directly.
But it was the
 same code path that shifted every section of `XingZ60` by two,
and it fired on
 an entry where nothing was wrong with the document at all.
A test that reports
 a mismatch on a forced pairing is reporting on the preamble,
not the structure.
 The proportional path has since been deleted (`chunk-document.ts` says so at
 its head);
an unequal shape now goes to `alignHeadingsForced`,
and the finding
 names the sections it could not pair rather than a fraction it aligned by.

## A signal that was read and said the wrong thing, and one that did not exist (2026-08-26)

THE COVERAGE SENTENCE MISREAD ITS OWN SEAT.
`WROTE NOTHING AT ALL: minimax-m3` at the end of arm A's REFINER
table told the reader to re-run a seat whose `SEAT` line,
printed by the same command,
said `asked=31 usable=31`;
arm A2 repeated it for `minimax-m3` and `deepseek-v4-flash-0731`.
The line was derived from slates,
and a
rewriter that answers every ask and leaves the paragraph as it stands reaches no slate.
The answered-but-unslated fix (landed in source,
awaiting the build) carries the refine stage's heard ids out to the coverage split,
which gains an
answered-but-unslated state;
the editor and translate seats still carry only a count out and say so.
The general shape is the one this document keeps finding:
a summary line derived from one record while the
contradicting record sits three lines below it,
and nothing compares them.

NOTHING WATCHED THE LINKS.
The naturalness lane protects link destinations as ordered atoms,
but a slice that
ships through the repair lane's archive sentence or the contest's incumbent can drop a source hyperlink with no
finding anywhere;
the output reading found a page that had.
The destinations check (landed in source as `fd4f7546f`) adds the document-level
check at publish:
`DESTINATIONS <id> source=N page=M dropped=K` on stdout beside the `TALLY` line,
the
addresses at info in the run log,
a warn line with the count.
It is a finding and never a refusal,
because the
page is what both deciders approved.
`grep '^DESTINATIONS ' <log> | grep -v 'dropped=0'` is the read.
