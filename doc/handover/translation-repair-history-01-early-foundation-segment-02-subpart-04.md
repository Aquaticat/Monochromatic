# Translation repair history: segment 2.4

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

DO NOT touch `RUN_PER_CALL_TIMEOUT_MS` (240 s):
  it is the one budget that
changes what the pipeline finds,
  and all ten settled round-two entries were
produced under it,
  so moving it would leave a mixed-configuration corpus and the
round-two number would mean nothing.
PASS 7 RUN 010 (2026-07-26,
  tip `d9ecde7fc`,
  1594033 ms ~27 min):
  1 settled,
10/92.
  Everythings99 repaired (MEDIUM,
  21 issues,
  20 accepted,
  20 resolved,
  2
findings).
  Bands 3 small / 4 medium / 3 large.
PASS 7 RUN 009 (2026-07-26,
  tip `a3cf36dbf`,
  1634756 ms ~27 min):
  TWO settled,
9/92.
  Dethelly repaired at last (LARGE,
  270 issues,
  260 accepted,
  257 resolved,
36 findings) in only 200917 ms ~3.3 min because runs 007 and 008 had already
cached 23 of its 24 slices;
  then Aniloviraw repaired (SMALL,
  27 issues,
  27
accepted,
  27 resolved,
  6 findings).
  Bands 3 small / 3 medium / 3 large,
  dead
even,
  which confirms the `countSettledPerBand` rank-offset fix (`61487a893`)
does what the band-starvation bug needed.
PASS 7 RUN 008 (2026-07-26,
  tip `afe844305`,
  5400006 ms):
  ZERO settled,
  7/92.
Dethelly ABORTED at the hard cap a second time,
  reaching 23 of 24 slices.
  Two
consecutive full-budget aborts on the same entry rule out transient API
throughput as the cause;
  the remaining hypothesis is that this entry's slices
are individually more expensive,
  which run 009's 3.3 min finish for the last
slice is consistent with but does not prove.
PASS 7 RUN 007 (2026-07-26):
  Dethelly ABORTED at the 90 min hard cap
(status=ERROR,
  aborted=true),
  11 of its 24 slices cached.
  Recoverable by
design:
  resume-first ordering picks it up next run and progress is monotonic.
NOT A GENERAL SLOWDOWN,
  measured rather than assumed.
  Across the five entries
settled in BOTH rounds,
  round two is FASTER in total:
  172.9 min -> 151.4 min,
ratio 0.88 (Acheron 0.67,
  AkiraComplex 0.72,
  Chinatsu_Suzuki 0.85,
Considerate_cat 0.88;
  only AmbeR_the_anpa slower at 1.13).
  So the added prompt
policy and identity block did not cost throughput.
DETHELLY IS ENTRY-SPECIFIC AND REPRODUCIBLE.
  Round one:
  24 slices in 66 min
(2.75 min/slice),
  373 accepted,
  settled in ONE run.
  Round two run 007:
  11 of
the SAME 24 slices in 90 min (8.2 min/slice).
  Run 008 resumed and reached 23 of
24,
  so 12 more slices in another 90 min (7.5 min/slice).
  Slice count is
identical across rounds,
  so the aligner did not fragment it.
TRANSIENT API THROUGHPUT IS NOW RULED OUT:
  the rate reproduced across two
independent runs hours apart,
  at 8.2 then 7.5 min/slice against round one's
2.75.
  The remaining hypothesis is that the slices now carry DIFFERENT CONTENT
-- the aligner pairs different blocks,
  so the models face different (and
plausibly more real) work than the misaligned pairings gave them.
  That is
consistent with the whole point of the fix,
  but it is a hypothesis,
  not a
measurement;
  confirming it needs a per-slice timing comparison that nothing
currently records.
OPERATIONAL CONSEQUENCE:
  the 90 min HARD_CAP_MINUTES was calibrated at ~5.5
min/slice for entries up to ~16 slices.
  At 7.5 to 8.2 min/slice a 24-slice
entry needs three runs instead of one.
  Resume makes that correct but slow.
Entries far larger (aiyysk 77 slices,
  hulicaijia 65) were already known to
exceed any single-run ceiling.
  If more large entries start needing three runs,
raising the cap is the cheap lever,
  but do NOT raise it without first checking
that per-slice time is genuinely higher rather than one entry being unusual.
Dethelly was already round one's slowest entry and its heaviest by accepted
count,
  so it is the expected place for a cap to bite first.
PASS 7 RUN 006 (2026-07-26,
  tip `2441b4150`,
  2709298 ms):
  1 settled,
  7/92
(large 2 / medium 3 / small 2).
  Considerate_cat status=repaired (27 issues,
  25
accepted,
  23 resolved).
PASS 7 RUN 005 (2026-07-26,
  tip `61487a893`,
  1543107 ms):
  TWO settled (small
entries are fast),
  6/92 = large 2 / medium 2 / small 2.
  Acheron
status=repaired (19 issues,
  17 accepted,
  1041617 ms) and AkiraComplex
status=repaired (13 issues,
  13 accepted,
  501485 ms).
  The corrected band
ranking worked:
  the starved small band led this run.
ACCEPTED COUNTS ARE FALLING SHARPLY,
  and the pattern has a natural control.
Across the four entries settled in BOTH rounds:
  192 -> 111 accepted,
  ratio
0.58.
  Per entry:
AmbeR_the_anpa 42 -> 41 (-2%),
  Acheron 45 -> 17 (-62%),
  AkiraComplex 28 -> 13
(-54%),
  Chinatsu_Suzuki 77 -> 40 (-48%).
THE CONTROL IS THE INTERESTING PART:
  AmbeR_the_anpa is the one of the four that
contributed NO clear false positive to the graded fifty,
  and it is the one that
barely moved.
  The three that carried a known false positive (Acheron item 7
identity,
  AkiraComplex item 16 unanchored,
  Chinatsu_Suzuki item 40 critical
PhotoScroll) all dropped by half or more.
  That is the shape a targeted fix
should produce,
  and it is not what indiscriminate suppression would look like.
ARITHMETIC CONSISTENCY,
  NOT PROOF:
  round one's graded precision was 0.56 to
0.68,
  so of 192 accepted roughly 107 to 131 were true positives;
  111 survive.
That is consistent with the fixes removing mostly false positives,
  but it
assumes the removal was perfectly targeted,
  which only grading can establish.
Do not quote the ratio as a precision measurement.
RECALL IS NOW THE OPEN RISK AND THE GATE DOES NOT COVER IT.
  The M3 headline
gate is PRECISION ONLY,
  so a pipeline that suppressed real defects along with
false ones would still pass it.
  Before declaring milestone three,
  either add a
recall check (the seeded-defect benchmark already in this package is the
natural instrument:
  `repair-benchmark.ts` measures restoration of KNOWN
injected defects,
  so it is unaffected by the precision sample) or state
explicitly that recall is unmeasured this round.
  Flag to the user;
  do not
decide it unilaterally.
FIX A AND F SIGNALS on their target entries,
  keyword-counted not graded:
Acheron identity-mentioning accepted claims 27 -> 4 (the regex matches any
summary containing name/alias/Acheron,
  so treat as indicative only);
AkiraComplex accepted claims carrying NO source span 5 -> 0,
  and Acheron 2 ->
0.
The unanchored drop was NOT gated by fix F,
   which only labels the case on
the sheet,
   so it is a side effect of the alignment and prompt changes and must
not be attributed to F.
FIX B CONFIRMED ON THE ENTRY IT WAS BUILT FOR (2026-07-26).
   Chinatsu_Suzuki
re-settled in pass 7 run 004,
   and it is the container-nesting entry whose en
page collapses its gallery into one `<details>`.
   Round one vs round two,
accepted issues:
   PhotoScroll-referencing issues 13 -> 0,
   critical 7 -> 2,
accuracy/addition 34 -> 4,
   total accepted 77 -> 40.
WHY THIS ONE COUNTS as evidence where the AmbeR_the_anpa comparison did not:
the 13 PhotoScroll claims were exactly the graded false positive (sheet item
40,
   `accuracy/omission` CRITICAL) and its siblings;
   the change is CATEGORICAL
(to exactly zero,
   not a smaller number);
   and the mechanism is DETERMINISTIC --
unwrapping makes those blocks peers on both sides,
   so the critic no longer sees
a component present on one side and absent on the other.
   This is not
model-noise variation.
WHAT IT STILL DOES NOT SHOW:
   accepted fell 77 -> 40,
   and some of that drop
could be genuine defects no longer reported (recall loss),
   which only grading
can separate from the intended removal of misalignment artifacts.
   Do NOT quote
the accepted-count drop as a precision improvement.
BAND ORDERING FIXED MID-PASS (2026-07-26,
   commit `a0fb61f6d`).
   The ~10/10/10
bar was UNREACHABLE on a fresh pass and runs 001-002 exposed it by settling two
mediums and nothing else.
   Measured corpus band split:
   31 small / 32 medium / 29
large.
   The driver sorted the small band LAST,
   so the first small entry could
only start after all 61 non-small settled:
   at the 36-57 min per entry measured
here,
   over a day of compute before the small band opens at all.
   Round one only
reached small=9 because those entries had settled in earlier passes;
   archiving
`attempts.json` and the artifacts wiped that inheritance,
   turning a mild skew
correction into a starved band.
FIX:
   order is now resume-first -> INTERLEAVE bands by within-band rank ->
larger band leads within a rank -> fewest attempts.
   This keeps the original
intent (small entries finish inside one run while large ones consume it,
   so
early settling over-represents small) but solves it symmetrically,
   reaching ten
per band in ~30 entries instead of ~71.
   Band logic extracted to
`corpus-run/band-order.ts` to keep the driver under max-lines (never disabled).
VERIFIED on `--plan`:
   first=Arita(large),
   Considerate_cat(medium),
Acheron(small),
   Chinatsu_Suzuki(large),
   Everythings99(medium).
OVERLAP WITH ROUND ONE IS NOT HIGH,
   correcting an earlier claim in this
session.
   Anilovr is second in the fresh queue yet was NOT among round one's 29,
so round one's settled set was never the head of this queue;
   it was shaped by
its own pass-4/5/6 attempt history.
   Round two's ORDER is deterministic,
   but it
does not reproduce round one's SET.
   Compare precision on the actual
intersection once the bands fill;
   do not assume it.
PASS 7 RUN 003 (2026-07-26,
   tip `a0fb61f6d`,
   3443744 ms ~57 min):
   1 settled,
3/92 (large 1 / medium 2 / small 0).
   Arita status=repaired (86 issues,
   85
accepted,
   85 resolved,
   5 findings).
   First run under the interleaved ordering.
PASS 7 RUN 002 (2026-07-26,
   tip `60a0ad3a6`,
   2789962 ms ~46 min):
   1 settled,
2/92.
   Anilovr status=repaired (81 issues,
   78 accepted,
   77 resolved,
   8
findings).
PASS 7 RUN 001 (2026-07-26,
   tip `c911b31a6`,
   2171621 ms ~36 min):
   1 settled,
1/92.
   AmbeR_the_anpa status=repaired (41 issues,
   41 accepted,
   41 resolved,
   4
findings,
   6 chunks).
   Same entry in round one:
   44 issues,
   42 accepted,
   42
resolved,
   4 findings,
   7 chunks.
   Observable deltas:
   chunk count 7->6 (the
aligner pairs differently),
   severity lost its lone `critical` and lone
`neutral`,
   and the category mix moved (accuracy/mistranslation 27->18,
accuracy/omission 11->15,
   accuracy/addition now 5).
   NOT EVIDENCE OF A
PRECISION CHANGE and must not be recorded as one:
   nothing here is graded,
   the
seven models are individually unreliable so counts move run to run regardless,
and this is a single entry.
   It is also a WEAK test of the fixes by construction
-- AmbeR_the_anpa contributed no CLEAR false positive to the graded fifty (its
two sampled items were the "Yes-ish" Bilibili gloss and a true positive),
   so
nothing here was expected to change.
   Only a graded round-two sample answers the
question.
ENTRY ORDER IS DETERMINISTIC AND MATCHES ROUND ONE's queue:
   `corpus-pass.ts`
sorts with a STABLE `toSorted` on resumable-first,
   then non-small-before-small,
then fewest-attempts.
   With the archive in place no id is resumable and every
attempt count is 0,
   so two of three keys are identically zero and ordering
collapses to the band split,
   with stability preserving the pinned-commit
listing order inside each group (`--plan` confirms:
first=AmbeR_the_anpa,Anilovr,Arita,Chinatsu_Suzuki,Considerate_cat).
   So round
two starts from the same queue round one did;
   an earlier claim in this session
that it would settle a DIFFERENT set was wrong.
   Divergence is confined to the
tail,
   where changed slice counts shift which entries fit inside each run's
soft budget.
   Consequence:
   do NOT add entry-id pinning to the driver for
comparability;
   if the settled sets diverge,
   compare precision on the
INTERSECTION,
   which is computable from the artifacts after the fact.
M3 FIXES A-F ALL LANDED (2026-07-26),
   and PASS 7 is the re-measure.
   Commits:
`ef6b75052` (A identity),
   `1790ec037` (B1 container unwrapping),
   `1aa8a0904`
(B2 monotone alignment),
   `7c4502580` (D source-not-golden),
   `a76aacae6` (E
context + community usage),
   `f6aee711a` (C self-contradiction),
   `f0821647f` (F
anchor naming).
   Every one:
   build/format/lint 0-0,
   types clean,
   full suite 0
FAIL.
   What each addresses in the graded sample:
   A=3 FPs,
   B=5 FPs (the largest
cluster),
   C=1,
   D=5,
   E=3,
   F=1 ungradable item.
FIX C and D and E are PROMPT changes,
   not gates.
   C was explicitly NOT built as
a deterministic check (advisor-confirmed):
   the case is cross-language semantic
overlap that no deterministic check catches without translating,
   and a lexical
approximation would silently reject real omissions,
   trading recall for
precision.
   Same reasoning for F:
   the unanchored-claim case is SURFACED on the
sheet,
   not gated,
   since rejecting such claims would trade recall for precision
before any measurement shows the trade is worth it.
ROUND-TWO SEED CHANGED:
   `DEFAULT_SAMPLE_SEED` is now
`milestone-three-precision-round-two`.
   Re-drawing under the round-one seed
would partially re-select the fifty items the user already graded,
   so the next
measurement would be scored partly on its own calibration set and read better
than the pipeline is.
   The constant's TSDoc now states this rule so a future
session cannot reuse a burned seed by accident.
ROUND-ONE EVIDENCE ARCHIVED,
   NOT DELETED:
   `artifacts/` (6.4M),
   `attempts.json`
and `slice-cache/` moved to
`node_modules/.monochromatic/translation-repair-runs/round-one-archive/`,
   with
`gate-verdict.md` and `grading-sheet.md` copied in beside them.
   The segmentation
fixes change slicing,
   so every cached slice is stale and a fresh pass is
required;
   the archive keeps the graded pool and its verdict auditable.
   All of
it stays OUTSIDE git (UNLICENSED corpus content).
M3 FIX A LANDED (2026-07-26,
   commit `ef6b75052`,
   task 36):
   critics now receive
the identity BOTH pages declare.
   `parse-document.ts` had been putting
`frontMatter` on `RepairDocument` since forever,
   and a grep proved NO downstream
consumer ever read it -- so critics judged names with the declaration withheld.
New `identity-context.ts`:
   `extractDeclaredIdentity` (reads `name` top-level,
`alias`/`location` under `info`,
   the pinned corpus's shape;
   non-string and blank
values REJECTED rather than coerced,
   since a coerced value would enter the
prompt as an authoritative correspondence) and `collectIdentityLines` (pairs
both sides per field,
   keeps one-sided declarations because "sourced metadata,
not invention" is exactly the judgment that failed).
   Returns a LIST,
   not
`string | undefined`:
   repo rule `no-restricted-syntax(no-nullish-union)` forbids
nullish unions,
   and its decision procedure picks the empty-collection branch
here.
   Prompt policy added:
   declarations are AUTHORITATIVE for naming,
   cover
transliteration across Chinese/Japanese/English readings,
   and NEVER license a
defect in surrounding prose;
   `desc` free prose deliberately excluded.
VERIFIED at the real boundary on all three failing entries:
   the block now
carries 委委-fairy/Acheron,
   岁月封华/Suigetsu Houka,
   and Toka_ls's 瞳華 alias.
12 new unit tests,
   full suite green (100 PASS,
   0 FAIL),
   lint 0/0,
   types clean.
Threading note:
   `exactOptionalPropertyTypes` rejects re-passing a destructured
optional,
   so each hop uses the codebase's conditional-spread idiom.
M3 FIX B DIAGNOSIS (2026-07-26,
   task 37,
   read from the real corpus at the user's
instruction -- do NOT re-derive this from artifacts alone).
   The "segmentation"
cluster is THREE distinct causes,
   and the earlier "it's plumbing" framing was
wrong:
(1) INDEX DRIFT INSIDE A SECTION.
   `slice-pair.ts` `groupNodesLockstep` pairs by
shared index whenever both sides have equal node counts,
   and the comment at its
docblock states the assumption outright:
   "When both sides carry the same node
count their paragraphs correspond one to one ... never drifting."
   Susiethegamer
DISPROVES it:
   zh 32 nodes,
   en 32 nodes,
   yet at index 6 the en drops the zh
lead-in paragraph (a "her sister said to Susie:"
   line) and starts the blockquote
directly,
   so zh[7] blockquote is the true partner of en[6].
   Everything from
index 6 on is paired off by one;
   equal totals hid it because the en regains a
node later.
   Equal count does NOT imply correspondence.
(2) CONTAINER NESTING.
   Chinatsu_Suzuki is zh 25 nodes vs en 17:
   the en wraps its
entire trailing gallery in ONE `<details><summary>Original</summary>` element,
which is a single top-level `mdxJsxFlowElement` holding 11 blocks the zh carries
at top level.
   Inside it the en preserves the ORIGINAL CHINESE verbatim (in
traditional characters) beside the PhotoScrolls.
   Consequences:
   the 5 PhotoScroll
"omissions" are false (they are present,
   nested),
   and the preserved Chinese will
also trip the prompt's own `accuracy/untranslated` rule,
   which is a false
positive generator by design.
   Huasheng carries `<details>` on BOTH sides
(matched and translated),
   so ITS finding is misalignment,
   not convention.
(3) ENTITY IDENTITY,
   not segmentation at all.
   Susiethegamer item 41's real
defect claim is that the en attributes a game to "Nekomaki" where the zh says
姐姐 (sister) -- but Nekomaki IS the sister.
   That is fix A's territory,
   and it
shows the graded "segmenting" labels are the user's shorthand,
   not a diagnosis.
Node counts measured:
   Chinatsu_Suzuki 25/17,
   Huasheng 39/44,
   MeowBot233 55/64,
Dethelly 53/55,
   Susiethegamer 32/32.
CONSEQUENCE:
   masking non-prose MDX nodes (the cheap fix considered first) would
NOT fix this and would delete real content,
   since the en `<details>` blocks hold
prose.
   The real fix is a monotone sequence alignment tolerant of insertions and
deletions,
   plus unwrapping container elements so both sides expose comparable
top-level structure.
M3 GATE VERDICT:
   FAILED (2026-07-26,
   task 33,
   user-graded).
   The user graded all
50 items of the final sheet in place,
   with free-text rationale rather than bare
Y/N.
   Tally:
   28 clear Y,
   16 clear N,
   6 partial/ungradable.
   Bands are contiguous in
the sheet (items 1-17 small,
   18-34 medium,
   35-50 large;
   verified mechanically).
PRECISION vs the 0.9 bar -- strict (partials against) 28/50 = 0.56;
   partials
excluded 28/44 = 0.64;
   generous (both "Yes-ish" as Y) 30/46 = 0.65;
   ABSOLUTE
CEILING,
   every partial credited as a true positive,
   34/50 = 0.68.
   Per band,
partials excluded:
   small 9/15 = 0.60,
   medium 8/14 = 0.57 (10/16 = 0.63 counting
the "Yes-ish" pair,
   which enter denominator as well as numerator),
   large 11/15 =
0.73.
   The bar needs 45/50,
   so the gate fails by 22 points AT ITS CEILING:
   no
reading of the ambiguous grades can move the verdict,
   and it is not sampling
noise.
   Precision is roughly FLAT across bands,
   so entry size is not the driver
and the stratification bought a null result -- worth knowing,
   not a wasted
control.
   NOT a sheet-context artifact:
   only items 12,
   16,
   48 read as context-
starved and all three are already excluded as partials;
   each of the 16 clear N
grades carries a substantive rationale (frontmatter,
   segmentation,
   obligatory
English grammar) that more context would not overturn.
ROOT CAUSES of the 16 clear false positives,
   ranked:
   (1) SEGMENTATION/ALIGNMENT,
5 items (18,
   38,
   40,
   41, 46) -- the user named it directly ("this is a segmenting
error in our system/pipeline");
   the zh span and en span compared were never a
translation pair,
   so the model correctly reports a difference between mismatched
texts.
   This also inflates severity:
   the sample's two most severe false positives
(40 critical,
   46 major) are BOTH alignment failures.
   (2) FRONTMATTER NOT
CONSULTED,
   3 items (7,
   14, 19) -- names and aliases are declared in each page's
frontmatter but the pipeline feeds body text only,
   so a correct sourced English
name reads as an unsubstantiated substitution;
   cheap and unambiguous to fix,
since the data is in a file we already read.
   (3) LEGITIMATE CROSS-LANGUAGE
ASYMMETRY,
   5 items (2,
   10,
   17,
   23, 29) -- English obligatorily encodes what
Chinese leaves implicit (subject pronouns,
   quotation marks,
   plural address) and
the model scores that obligation as an addition or loss;
   the user's framing on
item 2 is the durable one:
   THE SOURCE TEXT IS NOT GOLDEN,
   so a translation that
repairs a source deficiency is not a defect.
   (4) DOMAIN/LOCAL CONTEXT,
   3 items
(15,
   24, 31) -- community slang the model did not know,
   and word choices judged
in isolation when the adjacent half-sentence licenses them;
   common shape is
judging a span with too little of its neighbourhood.
OTHER SIGNALS:
   addition-class claims have no gradable source context (item 16
ungradable,
   zh side rendered `(none)`);
   checked the code rather than guessing --
`sideQuotes` in `sample-grading.ts` drops empty quote strings,
   so `(none)` means
no non-empty source span existed,
   which for an `accuracy/addition` claim is
semantically CORRECT (an insertion anchors to an empty point).
   So this is a SHEET
gap,
   not an accept-gate bug:
   the grader needs a window of surrounding source text
around the insertion point.
   Affects 1/50.
   Self-contradicting claims survive
adjudication (item 48 alleges an omission its own quoted target contains).
   And
some true positives are NOT actionable (items 6,
   8,
   44:
   utterance-final
particles,
   poetic imagery) -- real precision wins that predict no repair gain,
   so
precision alone overstates deliverable value.
SAFETY INVARIANTS CHECKED CLEAN -- the gate failed on precision,
   NOT safety.
Every `repaired` entry genuinely differs from its input and the single
`unchanged` entry is byte-identical,
   measured over the artifact pool with 0
anomalies;
   0 entries blocked;
   the degrade-and-persist design in `repairChunk`
means no failure path throws,
   so a bad slice costs coverage,
   never corruption;
splice-back stays conservative (only clean-anchor chunks,
   standing slices ship
unchanged per-slice).
NON-TRANSLATION BLOCK,
   0/4 ON GENUINE INPUTS (the finding flagged at run 021 for
the milestone writeup,
   now surfaced):
   all 4 real-corpus blocks this session
(Aniloviraw,
   AkiraComplex,
   Arita,
   Mio) were FALSE;
   the only true positive the
feature ever produced is the invented cat/"meow" probe pair.
   Discriminator holds
(false blocks all carried confirmed good-translation content,
   the true positive
carried none),
   which is what the `sliceAnchorsTranslation` veto encodes.
   On an
all-real-translation corpus this is a finding about the feature's VALUE here,
   not
just its threshold.
CONSEQUENCES FOR THE RE-MEASURE:
   (a) it needs a NEW draw seed -- `DEFAULT_SAMPLE_
SEED` is the fixed constant `'milestone-three-precision'`,
   so re-drawing with it
over a changed pool would partially RE-SELECT the just-graded items and
contaminate the result;
   this sheet is burned as a calibration set.
   (b) fixing
segmentation invalidates the cached slices,
   so the re-measure needs a fresh
accumulation pass,
   not a re-draw over the current artifacts.
   TASK 31 (judge
crosscheck) STAYS DEFERRED,
   on a NEW rationale -- the old "wait until human
grades exist" expired the moment they arrived;
   the live reason is that 8 of the
16 clear false positives come from input the PIPELINE assembles,
   so a crosscheck
now would measure a pipeline about to change.
   Full quoted detail,
   which cannot be
committed (UNLICENSED corpus text),
   lives beside the sheet at
`node_modules/.monochromatic/translation-repair-runs/gate-verdict.md`.
FIX LIST,
   ranked by sample yield,
   NOT started (the user's turn was a report,
   and
scope is theirs to set):
   segmentation/alignment (5) > frontmatter (3) > accept-
gate rules for self-contradicting claims (1) > judge context widening for the
asymmetry and domain classes (8 combined,
   but these need prompt/knowledge work
rather than plumbing,
   so they are the expensive tail).
TASK 30 COMPLETE + FINAL SHEET DRAWN (2026-07-25,
   advisor-confirmed).
   Advisor:
declare the bar MET at 9/11/9 -- the parity argument is decisive (small is
structurally pinned at 9 by the driver deprioritization and is already accepted
as "~10";
   by parity large=9 is "~10";
   every band is within 1 of 10,
   a face-value
satisfaction of an APPROXIMATE bar).
   Sufficiency was long past (the earlier
6-large call);
   9->10 large is a cosmetic digit whose pursuit risks a medium-
over-coverage spiral (next pick is a coin flip;
   a miss = medium 12 for zero
gain).
   STOP accumulation;
   the 29-entry pool is a frozen snapshot.
   FINAL draw run
`draw-sample -- --final` -> `grading-sheet.md` (NOT preliminary),
   pool 2871
accepted (337 small / 921 medium / 1613 large),
   50 drawn.
   Sanity checks all
pass:
   allocation exactly 17 small / 17 medium / 16 large = 50;
   reconcile clean
(every artifact's parsed accepted == its recorded acceptedCount,
   so the sample
is not short);
   large-band items render gradably across the settled large tail
(NIGHT81473140 / Jennife80677612 / Susiethegamer etc.);
   no preliminary banner.
Sheet lives OUTSIDE the repo (UNLICENSED corpus quotes) at
`node_modules/.monochromatic/translation-repair-runs/grading-sheet.md`;
   NEVER
committed.
   Task 30 (accumulation) DONE:
   29/92 settled = 9 small / 11 medium / 9
large,
   statuses 28 repaired / 1 unchanged / 0 blocked.
   Now the genuine surface-
to-user point:
   the headline gate needs the USER to grade the 50 issues Y/N (real
defect vs false positive) against the 0.9 precision bar.
   Task 31 (judge
crosscheck) stays DEFERRED until those grades exist;
   task 33 (gate verdict:
   per-
band + overall precision vs 0.9,
   plus the safety invariants pre-checked clean)
waits on the grades.
   Do NOT build ahead of grading -- the bottleneck is now
entirely the user's grading time.
M3 SAMPLE TOOLING BUILT + VALIDATED (2026-07-25,
   task 32,
   commits `bf4860250`
+ `be6912575`):
  the stratified precision-sample toolchain is now landed and
green (build/format 0-0/types/tests).
  Pure,
  unit-tested modules:
  `sample-
grading.ts` (band cuts 1843/3686 B matching accumulation;
  `classifyBand`;
`GradableIssue`/`GradableClaim`/`GradableSpan` -- a MINIMAL input shape a real
`AdjudicatedIssue` and an artifact-parsed issue both satisfy;
  `extractGrading-
Candidate` dedupes source/target quotes,
  primary claim first),
  `sample-draw.ts`
(`allocateBandQuota` even-split-under-availability round-robin;
  `drawStratified-
Sample` sha256-hex-keyed deterministic draw,
  round-robin ACROSS entries within
a band so one issue-heavy entry never dominates),
  `grading-sheet.ts` (Y/N grade
box per issue with zh source + en target quotes + claim),
  and `artifact-read.ts`
(`parseSettledArtifact`:
  a MEASUREMENT INSTRUMENT not a lenient deserializer --
structural-guards-only,
  THROWS `ArtifactParseError` on a malformed ACCEPTED
issue rather than skipping it,
  since a silent drop biases the precision
denominator;
  non-accepted issues excluded as out-of-denominator;
  category/
severity kept plain strings so no off-taxonomy value is ever a drop reason).
Advisor (Opus 4.8) shaped the parser-as-instrument stance + the string-not-
union call.
  Thin `corpus-run/draw-sample.ts` (mise task `draw-sample`;
  `--final`
writes the gate sheet,
  default writes a PRELIMINARY one) reconciles each
artifact's parsed accepted count against its recorded `acceptedCount` and aborts
loudly on mismatch.
  PRELIMINARY draw over the 24 settled:
  pool 2132 accepted
(337 small / 714 medium / 1081 large;
  entries 9/9/6),
  50 drawn 17/17/16.
Validated the sheet is HUMAN-GRADABLE from quotes alone across all bands and
multi-claim issues (e.g. "确认脑死亡" -> "confirmed to be dead";
  multi-claim
renders quotes joined by ` · `) -- no corpus open needed to judge Y/N.
  Sheet
lives OUTSIDE the repo (`node_modules/.monochromatic/.../grading-sheet-
preliminary.md`) since it quotes UNLICENSED corpus text;
  NEVER committed.
  FINAL
draw (`draw-sample -- --final`) runs ONCE after the large band fills,
  so the
user is never handed a sheet that shifts underneath them.
  Still pending:
  task 31
judge crosscheck (secondary machine number,
  quota-heavy,
  held until now);
  task
33 gate must report precision PER BAND (the payoff of stratifying) plus the
plain real/50>=0.9 headline.
M3 SAFETY-INVARIANT PRE-CHECK (2026-07-25,
  task 33 prep,
  advisor-directed
"check what the artifacts actually record before building a checker;
  if they
don't,
  say so,
  don't fabricate").
  Finding:
  the artifacts record `status`,
`repairedText`,
  `findings`,
  and the issue fates -- enough to verify STATUS/TEXT
CONSISTENCY,
  but NOT the "zero deterministic-gate violations" or "zero
regression-majority selections" invariants directly (no envelope/patch-op or
candidate-comparison data is serialized;
  `findings` are model-noise diagnostics
like ambiguous-quote / quote-not-found / missing-verdict,
  not gate violations).
Those two invariants are guaranteed BY CONSTRUCTION (fail-closed patch +
resolution gates;
  `selectRepairCandidate` keeps UNCHANGED as the floor so a
repaired status means a candidate strictly beat the input) and covered by the
apply-patch / select-candidate / tally-resolution unit tests -- so task 33 will
CITE those,
  not re-measure from artifacts.
  What IS artifact+corpus-verifiable,
run now over the 24 settled (compared `repairedText` vs the pinned
`page.en.md`):
  23 repaired ALL genuinely changed (0 identical-to-input,
  i.e. no
hollow repairs),
  1 unchanged BYTE-IDENTICAL to input (correct),
  0 blocked (the
non-translation anchor-veto fix holds in the pool),
  0 anomalies.
  Status dist
23 repaired / 1 unchanged / 0 blocked;
  417 findings all model-noise shapes.
This is the "unchanged/repaired wherever the input is/ isn't beaten" invariant,
clean.
  Judge crosscheck (task 31) explicitly DEFERRED by advisor until human
grades exist to calibrate the judge against (building it now calibrates against
nothing);
  the 50-vs-2132 scope is then sequential (same-50 agreement first,
  and
the 2132-wide run is a user quota call,
  not autonomous) and the headline gate
does not depend on it.
PASS 6 (2026-07-24):
  pipeline behavior changed (slicing),
  so the restarted
pass is a NEW pass;
  prior pass-5 artifacts and attempts.json discarded.
Note lessons banked while landing this:
  run package tasks ONLY by scoped
name (`//package/module/translation-repair:<task>`) -- a bare `mise run
build`/`test` from the worktree root fans out to the whole monorepo
(cargo/podman/rust),
  spikes load,
  and OOM-kills scoped work;
  and a lint
`no-regex` rule blocks inline `String#match` regex (used substring checks
instead).
  PASS 6 RUN 001 launched on tip after the handover commit under
the lockstep slicing fix.
  Loop continues per task 30:
  record each run's
tallies content-free,
  commit,
  launch the next,
  until all 92 settle,
landing any further verified high-confidence fix immediately (restarting)
per the standing rule.
The user's concurrent
prior-art survey landed as doc/research/translation-repair-prior-art.md
(commits `650fc5827`,
  `059ce44e8`):
  closest precedents MQM-APE and
TEaR;
  the guarded-envelope composition is the unusual part;
  its
cautions (ensemble-checked is not independently-verified,
  seeded
numbers need human-graded evaluation for real-world claims) match
milestone three's human-graded gate.
  USER PICK (2026-07-23):
  keep full deadlines and retry-to-quorum as
is;
  no adjudication-quality change before the precision gate,
  the
accumulation loop absorbs the wall time.
  Racing to quorum and
deadline shortening stay recorded as rejected-for-now options,
revisitable if graded evidence changes the tradeoff.
pass2 run 002 (2026-07-23,
  1737 s):
  2 dispatched,
  2 completed,
  0
failed;
  Aniloviraw REPAIRED (44 issues,
  40 accepted,
  40 resolved,
14 findings,
  379 s):
  the false block reproduced a THIRD time (4
votes,
  48 content-critique claims) and the screen dismissed it in
production,
  exactly as designed;
  Anilovr repaired (33 issues,
  25
accepted,
  25 resolved,
  13 findings,
  1358 s).
  The pass-1 78 versus
pass-2 33 issue swing decomposes mechanically from the logs (user
challenged the first "variance" label;
  measured on challenge):
pass-1 big chunk ran 7/7 critics (95 claims) into a
quorum-degraded 4/7 panel (72 issues,
  acceptance at 3 of 4 heard),
pass-2 ran 5/7 critics after a forfeit-retry (57 claims,
  per-critic
volume nearly identical) into a full 7/7 panel (27 issues).
  Claims
barely converge across critics on this entry (95 claims to 72
distinct issues,
  mostly singletons),
  so each lost critic removes
its singletons,
  and the thin pass-1 panel is the outlier side.
Screening uninvolved:
  zero non-translation votes on Anilovr chunks
in both passes.
  No iteration triggered:
  quorum design worked as
built,
  and thin-panel volatility errs toward fewer accepted issues,
the safe direction for a precision gate;
  revisit only if the graded
sample shows precision misses clustering in degraded-panel entries.
Remaining 88.
run 003 (2026-07-23,
  1913 s):
  3 dispatched,
  3 completed,
  0 failed;
Arita repaired (20 issues,
  18 accepted,
  17 resolved,
  6 findings,
644 s);
  ArtsEpiphany unchanged (0 claims from 7/7 critics,
  8 s;
measured:
  the pair is a 120-byte front-matter stub each side,
  so
zero claims is correct,
  not a silent failure);
  BI4PBV REPAIRED
(31 issues,
  30 accepted,
  28 resolved,
  3 findings,
  1260 s):
  the
milestone-two quarantine entry that forfeited all seven models in
two independent benchmark runs completed 7/7 on all three chunks
at first attempt;
  the spiral was provider weather plus seeded-text
conditions,
  and the production pass holds no quarantine list.
Remaining 84.
