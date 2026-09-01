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

### Defects found and fixed

-   Invisible-line masking had two holes:
    a line of non-ASCII space welds
    paragraphs exactly as a byte-order mark does and was not caught,
    and masking
    did not know about fenced code.
    `7b5dbf6b4`.
-   `---\r\n---` was refused outright,
    the one CRLF front-matter shape the
    earlier fix still missed,
    because its guard assumed a one-character
    terminator.
    `462b1690a`.
-   A closing fence was accepted on `trim()`,
    so ```` ```<U+FEFF> ```` read as a
    terminator.
    A bug in code committed an hour earlier,
    in the corrupting
    direction.
    `908e39285`.
-   The `#71` aligner slid every zero-evidence document by putting gaps at the
    FRONT,
    reproducing the defect it exists to remove.
    `XingZ60` hid it because
    three of its headings share names across the boundary.
    `110fc3909`.
-   The footnote graph walked the RAW tree while the node list walked the
    flattened one,
    so a definition inside a disclosure container was invisible
    and every `nodeId` after a container named the wrong block.
    `08d92eb41`.
-   Integrity did not notice broken footnotes,
    because it counted only MDX
    grammar downgrades.
    `e10ece178`.
-   Typography restoration learned its convention from the replaced REGION,
    which at a median of 75 characters usually holds no quote at all.
    `846f9ff6d`.
-   Naturalness eligibility counted a repaired parse as a degraded one,
    a
    regression introduced by the parse-finding work earlier the same night.
    `99e9b2c94`.

### Corrections made to earlier claims in this document and to the agent's own

-   The duplicate-issue cost claim was WRONG and is corrected in `af8abf895`.
    All 567 duplicate pairs share one repair envelope,
    so no model work is
    duplicated;
    the ranking reversed with the claim.
-   `#71`'s blast radius is one entry,
    but the first reasoning was wrong.
    SEVEN entries emit `structure-mismatch`;
    six pair by index anyway.
    The
    earlier check counted HEADINGS where the aligner compares CHUNKS.
-   A running pass cannot see a rebuild,
    so `pass10` was never the mixed
    population it was called at the time.

### Three verification traps hit and caught, worth knowing about

-   `git grep --extended-regexp '^\s*(\`\`\`|~~~)'` reported fence markers in
    nearly every file.
    Backslash-backtick is the buffer-start anchor in GNU
    regex.
    Fixed-string search shows the corpus has NO fenced code blocks.
-   `rg FAIL` over test output matched the NAME of a test containing "FAILS".
    Use `^\[error\]` or `AssertionError`.
-   A refinement-eligibility probe returned zero eligible for every input
    INCLUDING the clean control,
    because the fixtures were under the
    120-character minimum.
    The positive control is what caught it.

### Bounded and deliberately not built

-   CRLF documents get no invisible-line masking,
    blockquote-payload welds are
    not masked,
    and fence indentation is read from the line rather than the
    container.
    All three are real,
    all three are inert at this pin,
    and all
    three are recorded in
    `doc/troubleshooting/translation-repair-invisible-characters.md`.
-   An automatic slice-cache key over a hash of `src/` was considered and
    rejected:
    it would invalidate on comment and test changes,
    and a pass takes
    days.

## Overnight autonomous stretch, continued (05:00 to 05:20 UTC)

### What is running

`pass13`,
PID 1371047,
into
 `node_modules/.monochromatic/translation-repair-runs-pass13`,
running slice
 cache version 9.

Cache version is the quickest way to tell whether two passes are comparable,
 so for the record:
`pass10` ran version 5,
`pass12` ran version 7,
`pass13`
 runs version 9.
Artifacts from different versions answer different questions
 and should not be pooled.

`pass12` was stopped at 05:14 UTC with nothing settled.
The reasoning,
and the
 rule that a replacement pass must be confirmed working before its predecessor
 is signalled,
are in
 `doc/troubleshooting/translation-repair-run-invalidation.md`.

### What this stretch found

The method carried over unchanged:
census every signal the deterministic core
 emits,
check each is correct,
check something consumes it.
Applied this time
 to the full 56-entry artifact population rather than to one stage.

The finding:
quote anchoring silently discards 398 critic claims.
`locateQuote`
 fails,
`repair-stages.ts` pushes the reason and returns an empty array,
and
 the claim never reaches adjudication.
`quote-not-found` alone accounts for 225
 of those,
across 45 of 56 entries.

A mechanism explains part of it.
The corpus soft-wraps prose,
so a critic
 quoting across a wrap returns a space where the document holds a line break,
 and neither the byte-exact search nor the punctuation-normalized fallback can
 match that.
The full argument,
including the competing explanation that was
 ruled out first,
is in
 `doc/troubleshooting/translation-repair-unread-signals.md`.

### What was landed, and what was deliberately not

Landed (`a6bbeca50`):
telemetry only.
`quote-not-found` now names whether a
 soft-line-break collapse would have located the quote uniquely,
ambiguously,
 or not at all.
No claim changes fate.

NOT landed:
admitting those quotes.
That is blocked,
not deferred.
A repair
 anchored to a quote spanning a wrap replaces several lines with one,
which is
 the same line-structure question `doc/planning/naturalness-lane-reach.md`
 leaves for the user.
Landing the fix would decide it without asking.

So the fix waits on the same decision the naturalness lane waits on,
which
 raises that decision's value:
it now governs two changes rather than one.

### Corrections to earlier claims

-   A first pass at the duplicate-issue mechanism blamed dropped adjudication
    merge opinions.
    Refuted by measurement:
    36.8% duplicate with them,
    35.1%
    without.
    Recorded so the hypothesis is not raised again.
-   A ceiling argument ("43 dropped opinions cannot explain 956 duplicates")
    was drafted and dropped,
    because one dropped opinion can leave a
    multi-claim cluster unmerged and produce more than one duplicate.
    The
    empirical split carries the refutation without it.
-   `doc/troubleshooting/translation-repair-unread-signals.md` still claimed
    `footnoteGraph` was read by nothing.
    The chunk-integrity gate has read it
    since the footnote work earlier the same night.
    Corrected.

### A trap worth adding to the list

`readdir` on the slice cache returned zero `.json` files while `find` returned
 six,
because the cache sharded by entry id into subdirectories.
The empty
 result looked exactly like "nothing cached yet" and would have been reported
 as a starved pass.
`readdir` needs `{ recursive: true, }` there.

The general shape is the one already listed twice:
a filter that silently
 matches nothing reads identically to a genuine zero.

### What the next session should check first

Whether `pass13` has settled entries carrying `[line-break-collapsible]`
 suffixes,
and in what proportion.
That number is the incidence the whole
 investigation could not measure from existing artifacts,
because a claim
 discarded at anchoring never becomes a retained issue.

If the proportion is small,
the quote-anchoring lead is closed.
If it is large,
 it becomes an argument the user should hear when they settle the
 line-structure question.

### A second finding from the same census: the refiner goes silent

CORRECTED LATER THE SAME DAY,
and the correction closed it.
Read the paragraph
 below as the finding AS FIRST WRITTEN,
then the correction under it.

The naturalness refiner was a ONE-model stage on the population measured.
Across 129 invocations it heard nothing 34 times,
and the partition by entry is
 exact:
29 entries heard from it on every invocation,
7 heard from it on none,
 and none sat in between.
Independent per-call failure cannot produce that,
so
 the cause is a function of the entry rather than transport flakiness.

Those blocks were eligible,
were selected,
and were never rewritten,
so the
 lane's real reach on that population is below the 12.0% eligibility figure.

THE CORRECTION:
that population ran 2026-08-06 to 08-11,
and `eb21ffa6b` on
 08-12 took the lane from one refiner to three.
Quorum is now two,
so a single
 lost voice cannot empty the stage,
and `pass13` confirms it in practice:
every
 one of its `refine-candidates` findings reports `3/3 heard`,
with Kimi-K3
 losing the refiner voice and being retried back each time.

So the reach deficit is real for the OLD figures and gone going forward,
and
 the objection this paragraph originally raised against Option B,
that it would
 triple the eligible blocks against a single voice,
IS WITHDRAWN.
What misled
 the first reading was a stale comment in `run-config.ts`,
since corrected.
Recorded as `#73`,
closed.

The cause is not yet known,
and getting it needs no code change.
The warning in
 `attemptStageCall` names the reason but is discarded before it reaches any
 finding;
the historical logs are gone,
checked rather than assumed.
So
 `pass13`'s voice losses are being appended to
 `node_modules/.monochromatic/translation-repair-runs-pass13/voice-loss.log`,
 and because the failure is entry-determined `pass13` should reproduce it and
 name the cause.

Threading the reason into the finding was considered and deferred:
it needs a
 `StageVoice` union change,
cache version 10 and another restart,
and the log
 route answers the question without any of them.

Tracked as task #73;
the quote-anchoring work is task #72.

### Standing invariants for whoever picks this up

-   Every `*.unit.test.ts` imports `../dist/final/node/index.mjs`,
    so always
    run `buildAndTest`,
    never bare `test:unit`.
-   A running pass has a frozen module graph,
    so rebuilding cannot affect it,
    and a pass must be confirmed working before its predecessor is signalled.
-   Any pipeline-behaviour change bumps `SLICE_CACHE_VERSION` in the same
    commit.
    It has been missed once,
    on the very commit that added a gate.
-   Corpus content is unlicensed:
    artifacts,
    sheets and logs stay under
    `node_modules/.monochromatic/`,
    never in git,
    and grading sheets never go
    to a third-party model.

### A third finding: the aligner fix was never wired in

`alignHeadings` in `align-sections-order.ts` is a Needleman-Wunsch aligner that
 allows gaps on either side,
is covered by its own test file,
is exported from
 `index.ts`,
and carries the gap-placement fix from `110fc3909`.
Nothing calls it.
A search across the repository finds it only in its own
 definition,
its own tests,
and the re-export.

The pipeline aligns through `alignDocumentSections` in `chunk-document.ts`,
 which on a structure mismatch still merges adjacent source sections from the
 front and aligns the rest proportionally by character fraction.
Two merges
 shift the document by two,
which is the offset `#71` recorded.

Run against the current build,
`alignHeadings` produces the correct `XingZ60`
 pairing outright,
with affinity 1.00 on the three shared Latin names and the
 two gaps landing on the two sections that genuinely have no translation.
So the fix is wiring,
not new logic.

Blast radius re-measured on the current build,
which `#71` asked for:
7 of 92
 entries fall back to proportional,
but five of those have EQUAL chunk counts
 where proportional lands on index pairing anyway,
and `XIEPT2` was inspected
 pair by pair and is correct.
Only `XingZ60` is wrong,
confirming the earlier
 count by a different route.

NOT landed,
and the reason is not caution:
alignment feeds every later stage,
 and wiring it produces explicitly unpaired sections,
which is exactly the
 destination question `#70` leaves open.
Landing it would answer a question the
 user owns.
Options and ranking (B > C > A) are in
 `doc/planning/wire-the-heading-aligner.md`.

The general lesson is the one this handover already names:
a committed fix with
 a passing test suite is not evidence that the pipeline uses the code it fixed.
Asking whether a built feature FIRES caught typography restoration in the
 previous stretch and caught this in the current one.

## Every open decision, consolidated 2026-08-13

Supersedes the earlier "Four decisions waiting" list,
which is now incomplete.
Ordered by how much else is blocked behind each.

REWRITTEN at the end of the stretch rather than amended again.
Three
 amendments had stacked on this list and two of its items had gone false,
which
 is the same accretion this session diagnosed elsewhere.
What follows is the
 current state,
not a history of it.

### 1. Choose the pipeline shape: translate or repair (`#70`, blocks `#71`)

CORRECTED FRAMING.
An earlier version of this list called this "what an
 unpaired source section is for",
as though a destination policy had to be
 invented.
`doc/planning/translation-pipeline-redesign.md` already settles that
 it is not a separate decision:
the destination falls out of which pipeline
 shape is chosen,
and it offers three options ranked B > C > A.

-   B,
    translate every slice and select against the existing text.
    An unpaired
    section is then just a slice whose existing translation is empty.
-   C,
    fill coverage gaps first,
    then repair the completed draft.
    The coverage
    check fills it.
-   A,
    route barely-covered sections to a translate stage.
    The section is the
    sparse case the classifier routes.

The ranking's reasoning is that C rests on judging whether source content is
 represented anywhere,
the same judgement that already produced five false
 positives,
and a coverage check that misses is invisible.
B replaces detection
 with selection,
which is built and auditable.

FOUR PREREQUISITES are listed there,
and one is already on this board:
`#31`'s
 judge crosscheck,
deferred since milestone three,
because B stakes everything
 on judges preferring a good human translation over a fluent machine one and
 nothing has measured that.
The others are what replaces the introduced-defect
 differential,
what pairs 7 and 5 actually are,
and cost.

What this session ADDS is scale,
not framing:
there are three unpaired sections
 at this pin,
one of which is a seven-character `(To-Do)` placeholder needing no
 decision,
leaving TWO genuinely untranslated sections of 915 and 1459
 characters BOTH IN ONE ENTRY.
The 915-character one opens with an HTML
 disclosure block rather than prose.
So whatever shape is chosen,
the section
 content it has to handle today is small and markup-bearing.

Still the highest-value decision,
because the aligner fix cannot land without
 it.
`doc/planning/translation-pipeline-redesign.md` and
 `doc/planning/wire-the-heading-aligner.md`.

### 2. Naturalness lane reach: does changing line structure count as damage

Ranked B > C > A,
with two things that moved since the ranking was written.

The reliability objection to B is GONE:
`#73` closed,
because the refiner is a
 three-model stage since `eb21ffa6b` and `pass13` confirms every invocation at
 full roster.

The line-structure cost is now measured rather than abstract:
admitting the 620
 blocks removes 1329 line breaks and turns paragraphs of median 3 lines into
 single lines of median 212 characters,
p90 413,
max 1063.
That WEAKENS B over
 C,
because B's argument rests on the corpus wrapping inconsistently and inside
 these blocks it does not (median line 65,
p90 130).

It governs ONE change now,
not two.
`#72` closed,
so wrap-spanning quotes are
 no longer part of this question.
`doc/planning/naturalness-lane-reach.md`.

### 3. Whether the critic stage should retry to a full roster (from `#75`)

New,
and separable from everything else.
The editor and refiner retry lost
 voices until the roster is whole;
the critic retries only to quorum,
so a
 voice lost after quorum is met is never recovered.
At 7 settled entries that
 is 18.6% of critic invocations running one voice short,
permanently,
on the
 stage where claims are DETECTED.

Cost of fixing it,
measured:
about 3% more critic calls.
The exposure is
 measured;
the harm is not,
and measuring it needs a paired run.

### 4. Which unit precision is denominated in (`#65`)

Issue or envelope.
570 of 2650 accepted issues share a span with another,
but
 every duplicate pair shares one repair envelope,
so the harm is counting
 rather than wasted work.
Ranked C > B > A.

One half of it CANNOT be answered from existing data:
whether a duplicate is
 independent corroboration depends on the two copies coming from different
 critics,
and artifacts do not record which critic raised a claim.
`doc/planning/duplicate-accepted-issues.md`.

### 5. The damage sheet still wants human grading (`#66`, then `#68`)

`#68` is blocked behind `#66`:
which prober is right when they disagree cannot
 be settled from telemetry.

### Not decisions, just waiting on the running pass

-   `#72` is CLOSED with a verdict rather than a null.
    Soft wrapping explains
    about 3% of quote misses:
    1 of 33 wrap-explained,
    one-sided 95% ceiling
    13.5%,
    on a sample verified to wrap as much as the rest of the corpus (69%
    against 69%).
    At that rate the change recovers roughly 7 of the 225 misses
    in the settled population,
    which is not worth a behaviour change that also
    decides the line-structure question.

    It was first closed at 30 misses with NONE wrap-explained and a 9.5%
    ceiling.
    One appeared an hour later,
    which loosened the bound rather than
    tightening it.
    The decision did not move;
    the wording did,
    from "no effect"
    to "a small real effect".
    Full record in
    `doc/troubleshooting/translation-repair-unread-signals.md`.

    So the line-structure decision governs ONE change,
    the naturalness lane,
    rather than two.
    What stays open is the other 398 discarded claims,
    whose
    dominant cause is unknown.
-   `#73` is CLOSED,
    not waiting.
    It was already fixed by `eb21ffa6b` before it
    was found.
    `#75` replaces it,
    and needs no decision until a debug capture
    names which schema-mismatch sub-kind Kimi-K3 is hitting.

Neither needs anything from the user,
and both are now answered.
`#72` was
 unanswerable from the existing 56-entry population,
which is why `pass13` was
 restarted rather than left.
That restart paid for itself.

## Session 2026-08-13, second half: attribution readers, a safety gate, and two of my own errors

### What landed

CRITIC ATTRIBUTION IS COMPLETE END TO END.
The writer path closed earlier;
this
 half built and hardened the reader.
`score-attribution` reads a run and prints
 per-critic rates,
and it prints no corpus text,
so its output is safe to paste
 where the artifacts are not.
Full record in
 `doc/planning/critic-attribution.md`,
including three reader defects fixed
 before any real artifact existed and a fourth found by review afterwards.

The one worth carrying forward:
the reader treated a MALFORMED `chunkCritics`
 key exactly like an ABSENT one,
so a corrupt artifact silently joined the
 pre-attribution population,
and that population is the denominator of every
 rate.
Only absence means legacy now.

THE DETERMINISTIC PRESERVATION CHECK IS BUILT,
which is what the replan
 proposed.
`checkPreservation` in `preservation-check.ts`:
everything in the
 replaced text that no accepted issue quoted as defective must still be present
 afterwards.
Calibrated on the 50 real graded repairs rather than tuned by
 taste.
It rejects both damage regions and one wholesale deletion,
and rejects
 none of the 29 repairs graded sound.

It is NOT yet wired into `applyPatchOperations`.
The envelope carries
 `issueIds` but not the quoted defect text,
so the gate needs the quotes
 threaded to the apply site.
That wiring is the next step and is the only thing
 standing between this check and its being load-bearing.

RUN CONTINUITY is arranged and documented in
 `doc/handover/translation-repair-run-continuity.md`.
Two supervisors,
one
 single-shot and one chained,
which cannot race because the chained one refuses
 to launch while the other's pid is alive.

### Two errors of mine, both the same shape

I ASSERTED THAT `one-var` CONFLICTS WITH THE TSDOC RULE and offered that as the
 reason to disable it.
It does not.
Measured afterwards:
a combined declaration
 carrying one TSDoc lints clean,
and an inner TSDoc before a second declarator
 is accepted too,
so `require-tsdoc` never objected.
The user found the real
 cause,
which is that the rule should always have been set to `never` and was
 arriving from the `style` category with the opposite default.

I PRE-GRADED THE REPAIR SHEET WITHOUT READING THIS DOCUMENT,
which already
 contained a full reading of that same sheet.
The user caught it on item 1.
Two
 grades were wrong:
item 1,
where "a family misfortune" fixes the semantics and
 is still not English anyone writes,
and item 2,
where the edit deleted the
 hi3861 and Klipper clause the source does contain.
Both are recorded at
 `doc/handover/translation-repair.md` under "The repair sheet is not gradeable".

The shape is the same in both:
a claim asserted from what was in front of me
 rather than from the record,
when one `rg` would have settled it.
Anything
 grading these sheets should read the prior reading FIRST.

### The pre-grades, and what they are worth

Both outstanding sheets are pre-graded,
ANCHORED at the user's explicit
 instruction rather than blind.
That was raised as a concern,
because the
 runbook keeps pre-grades out of the sheet so the agreement rate measures
 concordance rather than correction effort,
and the user overrode it knowingly.
 So the agreement rate from this round is not comparable with earlier rounds.

-   Repair sheet:
    29 Y,
    5 N,
    so 0.853,
    after the two corrections.
    The five
    failures separate cleanly into four SAFETY failures (items 2,
    21,
    37 and 34)
    and one QUALITY failure (item 1),
    which is precisely the split the replan
    proposes and the single-column sheet cannot express.
-   Damage sheet:
    4 damage,
    16 acceptable.
    It does NOT survive the
    concentration guard:
    three of the four are one free-verse entry,
    so
    dropping that entry leaves 1 in 17.
    Do not read 0.20 as a probe precision.

Originals are preserved in `pre-grades-repair-round-three.json` and
 `pre-grades-damage.json` beside the sheets,
so the user's corrections do not
 erase what the agent claimed.

### New findings

-   `#77` Kimi-K3 is 78.9% of all 90 voice losses in a run that ALREADY
    contains the channel-marker fix,
    so that fix was a real cause and not the
    only one.
    The sub-kind that would name the residue landed nine hours after
    the pass started,
    and a running pass has a frozen module graph,
    so this
    log cannot carry it.
    `#75` unblocks itself on the next resume.
-   `#79` The editor replaced three correctly translated lines of one free-verse
    entry with invented text,
    once with a correct translation of a DIFFERENT
    line.
    Checked and NOT the alignment defect:
    that entry carries no alignment
    finding.
-   `#78` The working tree had been linting against a `node_modules` stale
    relative to the lockfile,
    so 1447 warnings were not being reported at all
    until an install synced them.
