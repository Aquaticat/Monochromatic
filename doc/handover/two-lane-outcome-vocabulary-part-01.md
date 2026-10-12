# Handover: the lane outcome vocabulary and what is mid-flight, part 01

Part 01 of [Handover: the lane outcome vocabulary and what is mid-flight](two-lane-outcome-vocabulary.md),
whose index lists every part in order.

## READ THIS FIRST AFTER A COMPACTION (rewritten 2026-08-18 07:05Z)

### THE PASS IS FINISHED AND THE FREEZE IS LIFTED

`DONE processed=5 of pending=5; artifacts=5/92 elapsed=19109264ms`, `Finished in 19111.45s`, exit 0.
All five artifacts are in `~/translation-repair-runs-flagged-20260818/artifacts`. The producing path
is free: builds, tests and `#120`/`#121` fixes can all land.

### `#107` IS ANSWERED, AND THE ANSWER IS A NULL

`doc/audit/flagged-slice-replacement-rate.md`. Five entries, 42 slices.

  pre-registered ledger reading   flagged 26 of 32  0.8125    unflagged 38 of 52  0.7308
  contested slices only           flagged 14 of 16  0.8750    unflagged 20 of 21  0.9524

THE SIGN FLIPS WITH THE DENOMINATOR, which is what a difference smaller than the instrument looks
like. As archive survival: flagged 2 of 16 at 0.125, unflagged 1 of 21 at 0.048, natural six-entry
pool 2 of 39 at 0.051. The contested cut rests on two survivals against one; moving one slice changes
the direction.

THE NULL COUNTS, per `QPC`: the same reader reports 1.0000 against 0.0000 under `--control shipped`,
so it is shown able to display a difference and does not display one here.

WHAT DID DIFFER is contest availability, 16 of 16 flagged slices held a vote against 21 of 26
unflagged, which is about whether a candidate arrived rather than how judging went. Critic attention
runs the OTHER way, 12.7 claims per hundred source characters at flagged slices against 15.2.

### SHEET ONE IS GRADED TO ITEM 7 AND SHEET TWO IS OPEN (2026-08-18 afternoon)

The user graded items 1 to 7 of the first relocation sheet and said it was
"once again, impossible to grade". Their comments, verbatim, are the requirements:

  1 [N]  2 [N]
  3 [? The matching might have been broken.]
  4 [N, but 姐妹 obviously is better translated to "girl" or "woman" here, depending on the final age of the subject.]
  5 [? Maybe there is a matching issue]
  6 [? Semantic wrapping is paramount even when original Chinese text didn't,
  for maintainability. And I don't see an issue with the original translated text.]
  7 [??? Once again, semantic wrapping, and I don't see an issue with the original passage.]

PRESERVED BEFORE ANYTHING WAS REGENERATED: `relocation-sheet.graded-v1.md` and
`relocation-manifest.v1.json` are copies, and `relocation-grades-v1.json` holds the seven grades
joined to entry, lane, slice and flag. The generator overwrites `relocation-sheet.md` wholesale, so
that copy is the only record of their work.

SHEET TWO IS BUILT AND OPEN IN GHOSTTY WITH HX:
`~/translation-repair-runs-flagged-20260818/relocation-sheet.md`, items 8 to 21, 41 KB, built by
`~/temp/agent/relocation-sheet-2.mjs`, zero quota. Seven flagged runs merged whole, seven controls,
one rewrap-only item dropped. Three independent boxes per item, `damaged` / `unnecessary` /
`mismatch`, plus free `notes`. Wrapping normalised away for display, blank lines kept. Blinding
deliberately dropped. Full rationale in `#107`.

STILL WAITING FROM BEFORE: `~/translation-repair-runs-20260817/damage-sheet.md`, 20 items, ungraded,
which `#68` needs. And `#96`'s licence question, recommendation already written in
`doc/planning/artifact-archive-text.md`.

### TWO NEW MEASURED FINDINGS, BOTH COMMITTED

RELOCATION IS LOCAL. Over all 92 probed entries, 1260 slices: 80 flagged, 51 contiguous runs,
LONGEST RUN THREE, mean 1.57, and every relocation pair adjacent. `~/temp/agent/slide-shape.mjs`,
written up in `doc/audit/relocation-signature-at-flagged-slices.md`. This bounds the `#107` fix:
a judge shown n-1, n, n+1 would have the moved passage in view in every case measured.

THE DAMAGE IS VISIBLE IN A FINISHED DOCUMENT. The repair lane's `lintong` output offers the same
thing twice within four lines and repeats an invitation the paragraphs above already made: each of
the two distinguishing noun phrases occurs twice in the repair document and once in the translate
one. The repair lane edits the incumbent in place, so a one-sentence original against a
four-sentence incumbent leaves three sentences behind that slice 2 then supplies again. The
translate lane, which writes each slice from its source, is clean here.

LINE STRUCTURE LOSS, `doc/audit/line-structure-loss-when-a-replacement-ships.md`. Of 64 shipped
replacements with an incumbent: 33 lose soft wrapping, 17 flatten to a single line, 9 lose a
blank-line paragraph break, 2 are a rewrap and nothing else, 0 are byte-identical. The repository
already owns the fix: `package/cli/markdown-lint`'s `semantic-line-breaks` rule is `fixable: true`
and ADD-ONLY, so it cannot destroy a break the model got right. Tracked as `#122`.

### THE BIGGEST FINDING OF THE NIGHT IS NOT ABOUT `#107`

`doc/audit/incumbent-almost-never-wins-a-contest.md`. Over the six NATURALLY accumulated entries, not
hand picked, the archive's wording survives a contested vote 2 times in 39. Mean winning weight 3.31
for a fresh candidate against 0.42 for the incumbent. Eleven of thirteen retentions are defaults
where nothing was offered against it.

BOTH ARTEFACT EXPLANATIONS ARE RULED OUT: the incumbent is on the ballot anonymously by design, and
its slot varies across the 39 judged slices, 13/10/5/3/3/5. It competes blind, from a moving
position, and loses.

That bears on `#84`, on `#96`, and on whether this pipeline is described as repairing or translating:
`#83` entered the incumbent into selection on the premise it would sometimes win.

### THE SEMANTIC WRAP LANDED, AND IT EXPOSED A BUNDLING TRAP (2026-08-18 evening)

`#122` code is in. Four commits: `d8d3b933f` the wrap, `34f4320a8` the satteri external fix,
`59384774c` the tests, `3c2b945e1` the lint warnings. Full suite exit 0, types clean,
`lint:oxlint` 0 warnings 0 errors, 15 new cases.

`src/semantic-wrap.ts` calls `fixSource` with exactly the `semantic-line-breaks` rule.
`src/repair-wrap.ts` and `src/translate-wrap.ts` apply it at the top of `assembleRepair` and
`assembleTranslation`, the one point per lane where both the replacements and the lane wordings
read from the same list, because the delivery invariant demands those two agree byte for byte.
Only text a lane PRODUCED is wrapped; `changed` is re-derived so a wrapping-only difference is
recorded as the retention it is.

MEASURED BEFORE WIRING, zero quota, over all 64 shipped passages: findings 326 to 0, no passage
loses a non-newline character, ten gain continuation prefixes, second application changes nothing.
GFP shown both ways and restored.

STILL OWED: re-run `~/temp/agent/wrap-census.mjs` over a pool settled AFTER this landed. Needs a
fresh pass, so it rides the next one.

`#447` IS THE TRAP. Importing markdown-lint bundles it, because the rolldown config always bundles
`@monochromatic-dev/**` and keeps only DECLARED dependencies external. That inlined Sätteri's napi
loader into `dist/final/node/`, where its binding cannot be found, so every import of
translation-repair threw before reaching pipeline code. Declaring `satteri: catalog:` in the
consumer keeps it external. `packageExtensions` does NOT apply: nothing is missing from Sätteri's
own location, the code was copied out of it by the bundler. The user asked for the writeup to live
in the issue rather than in `doc/troubleshooting/`, so `de0aa4676` added a doc and `471966830`
removed it again; the evidence is all in `#447`, which asks for the doc and then a migration.

### THE TRANSLATE LANE WAS DELETING ENGLISH, AND THE FIX CHANGED SHAPE (2026-08-18 evening)

Found from the grader's item 8. Measured: `dogesir_/translate` 3493 to 2042 characters,
`wangzihao980/translate` 1952 to 1091. The repair lane retained the same passages.
`doc/audit/deleting-english-the-chinese-never-said.md`.

THE RATIO GUARD DOES NOT REACH IT: `MAX_INCUMBENT_TO_SOURCE_RATIO` is 16, the cases measure
15.49 and 8.71.

CLASSIFYING TARGET-ONLY CONTENT IS UNSOUND. `splitTargetOnlyRun` reaches 2 of the 9 known
transcripts and fails three ways: transcript before the shared markup, several per document with
only the last reachable, one merged into a paired block. Deeper, "has no source counterpart"
cannot be decided by matching bytes, since translation changes bytes by construction; a
corpus-wide exact-match scan returns 234 hits that are almost all ordinary translated quotations.

DELETION IS DECIDABLE, and that is what shipped as `refused-quote-loss`: a replacement may not
leave fewer blockquote BLOCKS than the archive. 4 of 64 flagged rows, 0 of 69 natural rows,
reproduced through the built artifact. Counter-case: the repair lane's correct removal of an
invented paragraph was prose, so the guard stays quiet on it.

ONE LANE ALREADY KNEW. On `wangzihao980` the repair lane's critics rejected the claim that the
transcript was an improper addition 5 votes to 1; elsewhere it recorded a translator's comment
`needs-human` rather than acting. The translate lane deleted both with no flag, because a passage
with no source span is invisible to a stage reading only source spans.

CRLF BUG FOUND: one of 184 corpus markdown files uses CRLF throughout, where a `\n\n` splitter
reads the whole document as one block and counts zero quotes. Shared splitter now folds first.

BOTH FAIL-SHOWN-FIRST CHECKS DONE and restored, for the quote guard and for the archive window.

LANDED: 32caa4f02, c03847232, 7da2825f5, 6e6bc863a (window on, both sides), 4d041313c (house
policy: name what a passage points at, drop dead punctuation), 79c8120c0 (`readsImages`),
25fd63639 (quote guard), 1a3325ca3 (audit).

STILL OWED ON `#111` B: image path resolution, the wire shape for an image part, and the stated
rule for "the OCR does not make sense" written down BEFORE it is implemented.

### WHAT TO DO NEXT, in order

  1  `#120` defect 6 LANDED in `d0403c9f0`; the remaining five defects are open, then `#121`;
  2  `#122`, wire `package/cli/markdown-lint`'s add-only `semantic-line-breaks` fix into the ship
     path, then re-run `~/temp/agent/wrap-census.mjs` and confirm soft-wrapping loss goes to zero
     with the paragraph counts unchanged;
  3  the `#107` window widening the locality measurement bounds: show the judge n-1, n, n+1. Longest
     flagged run anywhere is three and every relocation pair is adjacent, so that window is enough
     in every case measured;
  4  optionally `mise run //package/module/translation-repair:rendering-audit-settled -- --archive
     ~/translation-repair-runs-flagged-20260818/artifacts` which SPENDS QUOTA unless `--cap 0`, then
     `rendering-audit-settled-report` for `#107`'s reading A, the relocation pairs.

### Sol is closed out: issue `#444` filed, no further effort this session

The user's instruction is launch-and-forget and focus on the pipeline. `Aquaticat/Monochromatic#444`
carries the full report: three runs at `--thinking xhigh` exiting 124 with zero bytes and NO session
file written, against a smoke test on the same model and level that answered in 2.2 seconds and wrote
a five-record session. Three variants were launched and are forgotten; if any returns, add a comment
to `#444` and move on.

`--thinking` must stay `xhigh` or `max` for this use, per the user, so lowering effort is not a
workaround.

### The main-worktree `package.json` change is explained

`~/.pi/agent/sessions/--var-home-user-Monochromatic--/2026-08-18T01-36-53-044Z_*.jsonl` is a
concurrent `pi` session, model `gpt-5.3-codex-spark`, prompt "commit all", which ran
`git add package.json pnpm-lock.yaml && git commit -m "chore(root): add open code review..."` at
01:37Z. That is the `@monochromatic-dev/cli-open-code-review-issue` dependency. Not this session's
work, correctly left alone per `EC1`, and no longer a mystery.

### The idle windows rest on a premise the current traffic contradicts

TRACKED AS `#121`, measurement only, nothing decided and no constant changed.
`doc/audit/stream-guards-first-production-traffic.md` holds it.

`stream-idle-guard.ts` disables both windows at 600000 ms on the stated ground that first-byte
silence is normal here, citing p50 95.6 s over 32 streams. Over 395 streams in this pass:

  firstByte ms   p50 1174   p75 1349   p90 1726   p99 3091   max 9084
  maxGap ms      p50  207   p75  257   p90  463   p99  989   max 11659

About eighty times faster at the median. Every one of the 395 got a first byte: zero negative
`firstByteMs` values, checked by re-grepping with the sign after the first pattern would have
silently dropped them.

TWO REASONS THIS SAMPLE BEATS THE ONE IT DISAGREES WITH: it is UNCENSORED, since neither window
fired, where the old one was taken with a 150 s window live; and it is UNBIASED BY SURVIVORSHIP,
since `#118` reports progress on the cut path, where the retracted "1349 streams, mean firstByte
1822 ms" excluded abandoned calls by construction.

RE-READ ACROSS EVERY PASS LOG THAT CARRIES THE COLUMNS, 5470 streams over three workloads and five
days (`grace-remeasure-snapshot.log` excluded as a copy of `corpus-pass-20260817.log`):

  resume-run-output       2888 streams  p50 1032  p90 1477  p99  3955  max 183755
  corpus-pass-20260817    2166 streams  p50 1237  p90 1951  p99 10163  max  91843
  flagged-pass-2           416 streams  p50 1173  p90 1726  p99  2768  max   9084

THE MIDDLE HOLDS EVERYWHERE and the TAIL IS REAL, which one pass could not have shown. Exceedances
over all 5470: first byte over 30 s in 10 streams, over 60 s in 2, over 120 s in 1, over 300 s in
NONE; largest gap over 30 s in 4, over 60 s in 1, over 120 s in none.

SO A SMALL WINDOW IS RULED OUT rather than supported. A 30 s first-byte window would fire on about
one call in 550, roughly one stage in ninety losing a voice to the guard itself. A 300 s one would
have fired on none and would still end a dead call in five minutes rather than never. Both counts
are LOWER BOUNDS, since two of the three logs predate `#118` and hold only completed streams.

IT STILL DOES NOT SAY THE CONSTANTS ARE WRONG. The change is a decision-doc revision to
`doc/decision/translation-repair-straggler-grace.md`, which owns the reasoning, and it belongs to
the user.

### The `#107` join reader is built, validated, and waiting

`~/temp/agent/join-107.mjs`. Outside the repository, no build, no quota, safe while the pass runs.

  node ~/temp/agent/join-107.mjs --archive ~/translation-repair-runs-flagged-20260818/artifacts

THE INDEX SPACE WAS CHECKED, not assumed, because `#99` established that `chunkIndex` means three
different things depending on who stamped it. Over all six settled entries the probe's `sliceCount`
equals the artifact's delivery row count in BOTH lanes, and delivery indices run contiguously from
zero. The reader re-checks per entry and THROWS on a mismatch rather than joining silently.

VALIDATED against three already-recorded figures: translate 37 of 50 at 0.7400, repair 32 of 50 at
0.6400, 69 shipped pooled. POSITIVE CONTROL passes, per `QPC`: with `--control shipped` it reports
1.0000 flagged against 0.0000 unflagged, so it is shown able to display a difference before being
trusted to report the absence of one. An empty flagged bucket prints `NO SLICES IN THIS BUCKET`
rather than a rate of zero.

Flag lists for the five entries, union of every flag kind, 16 flagged slices against 26 unflagged:
lintong 2 3 4; wangzihao980 3 4; GLaDOSister 2 3 4; dogesir_ 2 3 8 9; saurikissa 3 4 8 9.

### What the first production traffic showed, written up in full

`doc/audit/stream-guards-first-production-traffic.md`. Read over the pass's first 48 minutes: 347
streams, 219,574,656 raw characters, median 357,921, largest 5,558,524.

BOTH NEW INSTRUMENTS WORKED. The first straggler abandonment now says why:
`panel hf:zai-org/GLM-5.2: abandoned 180000ms after quorum (cut-mid-reply after 2915229 delivered
chars, first byte at 2087ms), voice lost`. Before `#118` that line read only `voice lost`. Its
companion progress line records `maxGap 460ms`, so the call was streaming steadily when the grace
ended it, and the idle guard could never have seen it.

THE DEGENERATION GUARD HAS STILL NEVER FIRED, and the straggler grace has cut ten calls. The
searches that answer this are `stream .*: cut` and `degenerate in`. A bare `cut` returns false
positives, all the word "cute" in a rationale about 撒娇.

SUPERSEDED, and the figure below was a MID-FLIGHT FLOOR read before the pass finished. Read to
the end of the log by `#121`: SIXTEEN OF NINETEEN cuts, 84%, are `hf:zai-org/GLM-5.2`.

  GLM-5.2       328 streams  16 cuts
  Qwen3.6-27B   354 streams   2 cuts   (its two largest deliveries, absent from the earlier read)
  Kimi-K3       322 streams   1 cut
  the other three            0 cuts

The earlier reading, kept because two numbers moved rather than one and a reader comparing them
should see both:

  GLM-5.2      186 streams  9 cuts  0.0484
  Kimi-K3      183 streams  1 cut   0.0055
  GLM-4.7-Flash 183 streams 0 cuts  0.0000
  Qwen3.6-27B  199 streams  0 cuts  0.0000
  gpt-oss-120b 199 streams  0 cuts  0.0000
  Nemotron     199 streams  0 cuts  0.0000

Qwen moving from zero to two matters more than GLM's count rising: a model with no cuts at all is
a different claim from one whose largest deliveries get cut.

So the grace's cost falls on ONE VOICE and the ensemble loses the same member repeatedly. NOT a
claim that GLM-5.2 is slow, which was retracted once already: first byte on the cut runs ran 751 to
2120 ms, ordinary for this pass. They were long, not slow, and delivered sizes at the cut vary
twenty-fold from 123534 to 2915229 characters.

VOICE LOSS SPLITS INTO TWO SHAPES, nine so far: six straggler abandonments (GLM-5.2 five, Kimi-K3
one) and three schema mismatches (GLM-4.7-Flash two, gpt-oss-120b one), each of the latter reporting
`raw=""` after a stream that COMPLETED. That qualifies the earlier finding that voice loss was GLM
and never Kimi-K3: on this pass it is seven of nine GLM but no longer GLM alone. Five hand-picked
entries are not a corpus sample.

THE CASE THE GUARDS EXIST FOR HAPPENED AND NOTHING CAN DIAGNOSE IT: GLM-4.7-Flash streamed
2,052,766 raw characters, COMPLETED on its own, and delivered `raw=""`, an empty answer. Whether it
thought usefully or cycled is unanswerable from the log.

FIVE DEFECTS FOUND AND TRACKED AS `#120`, all held until the freeze lifts, all written up in
`doc/decision/translation-repair-runaway-call-termination.md`:

  1  long-period looping escapes the detector entirely: what decides a verdict is gcd(period, 32),
     so a 501-character loop reads healthy at 0.1223 while a 500-character one is refused at 0.0305.
     Probe at `~/temp/agent/degeneration-period-probe.mjs`, gcd prediction matched observation 15
     of 15, control of never-repeating text scores 1.0000.
  2  `raw chars` and `delivered chars` are the same number, 235 of 235, because `drainBody` returns
     the wire format itself. The generated-character count nothing records.
  3  a deliberate termination is filed as `cut`, the same word a stall gets.
  4  the runaway error is built from `response.url` rather than `label`, so it names the endpoint
     every model shares. Driven through the built drain, the message opens with a bare colon.
  5  the cut excerpt shows `data: {"id":"chatcmpl-` in every case and never the model's words,
     which is the one thing it was added to show.

WHY 2 MATTERS MOST: a verdict needs about 131,000 GENERATED characters and production counts only
raw ones. At a 10x envelope 45 of 347 streams reach the bar; at 1x, 282 of 347. The unmeasured
ratio decides whether this guard judges one stream in eight or four in five.

### Sol is closed out: `#444` filed, corrected twice, no further effort

THE CAUSE IS THE ROUTE, not the prompt. `openai-codex/gpt-5.6-sol` produced exactly ONE response, at
02:02:53Z, and has produced nothing since: about eleven calls, every one hanging until killed with
zero bytes on stdout and stderr, regardless of prompt size, content, argv or `@file` delivery,
thinking level, or context-file discovery.

TWO CONTROLS SETTLE IT. The exact 51-byte prompt that succeeded at 02:02Z now exits 124. And the
DEFAULT provider, same flags and same `--thinking xhigh` and same prompt, answers `ALIVE` in seconds.
So pi works, `--print` works, `xhigh` works, and the prompt works.

A PROMPT-SIZE STORY WAS BUILT AND RETRACTED. A ladder at 80, 120, 160, 200, 500, 1000, 2000 and 4000
bytes all hung, and a 260-byte trivially-answerable prompt hung, which looked like a size threshold
between 51 and 80 bytes. It was not: every one of those runs happened AFTER whatever changed, and
the baseline was never re-run. A missing control. `#444` carries the retraction and was retitled.

DO NOT SPEND MORE ON THIS. The user's instruction is launch-and-forget and focus on the pipeline, and
`--thinking` must stay `xhigh` or `max` for this use so lowering effort is not a workaround.

### Two settled pools, which must not be confused

`~/translation-repair-runs-20260817/artifacts`, SIX entries, NATURAL ACCUMULATION, may feed a draw.
`~/translation-repair-runs-flagged-20260818/artifacts`, FIVE entries, HAND PICKED for carrying
displacement flags, may serve `#107`'s comparison and may NOT feed any precision, damage or
accumulation draw. `corpus-pass` warns about this itself whenever `--only` is used.

### One thing is waiting on the user

`#60`'s DAMAGE SHEET IS WRITTEN AND UNGRADED: `~/translation-repair-runs-20260817/damage-sheet.md`,
20 items, 33 KB, outside the repository. The manifest beside it keeps the probe's verdicts, which
the sheet deliberately does not show. Grading it is what `#68` needs.

`#96` ALSO NEEDS A DECISION and the recommendation is already written in
`doc/planning/artifact-archive-text.md`: store `targetText` whole, since the premise that it doubles
artifact size was measured and is false, at 0.6 to 0.9 percent. The remaining objection is a licence
question, which is the user's call and not an agent's.

### Concurrent work in the MAIN worktree, which is not mine and was not touched

`/var/home/user/Monochromatic` carries uncommitted changes to `package.json` and `pnpm-lock.yaml`,
adding `@monochromatic-dev/cli-open-code-review-issue` as a workspace dependency. Nothing in this
session made them and nothing in this session touched them, per `EC1`. They were checked only to
confirm they were not a side effect of building here. Leave them for whoever is doing that work.

### What landed tonight, newest first

  d39fb47a4  the two pools separated in this document
  (lock fix)  runs directory is created before it is locked, so a fresh directory works at all
  4149fb0d2  `describeAbandon`: a lost voice now says WHY, not just that it was lost
  ada369720  `#118`: keep what a cut stream delivered, report it on both paths, name the model
  0b6d9afb0  tests for which delivery rows a damage draw counts
  b71ea7328  `#60`: damage draw reads the version 2 ledger, BOTH lanes
  7aa4866fa  `#119`: end runaway calls in the drain, proven by strip
  fd62d7b37  the runaway watch the drain calls
  8517282c1  both channels scanned, so thinking runaways are caught
  bf15afaf1  the verse false positive fixed by raising the bar for speaking
  8eb62c0ac  the degeneration detector itself

### Numbers measured tonight that should not be re-derived

  replacement rate      0.740, 37 of 50 slices, six entries, translate lane, 0 withdrawn
                        held from 0.739 at 23 slices, so it survived a doubled denominator
  displacement flags    0 across the six settled entries; 29 of 92 entries flagged corpus-wide,
                        66 flagged slices against 1260, about 5 percent
  damage draw           69 shipped regions in the pool, 32 repair and 37 translate; 20 drawn;
                        probe flagged 2, silent 18
  degeneration          threshold 0.1 distinct; varied prose 0.9909, structured output 1.0000,
                        a cycling phrase 0.0015, verse with a refrain 0.036
  strip evidence        with the runaway guard inert the drain reads 3,060,000 characters;
                        the healthy long call logs 1,652,574 in BOTH runs, which is the control

### Retracted claims, so they are not repeated

  "GLM is slow"                     retracted; it is a tail on this workload, not a slow model
  "1349 streams, mean firstByte"    retracted; survivorship bias, `#118` was the cause
  "an abandoned call leaves nothing" retracted; streaming means partial text always exists
  "storing targetText doubles size"  retracted; measured at 0.6 to 0.9 percent
  "the grace re-measure is owed"     retracted; it was delivered the same morning in
                                     `doc/audit/straggler-grace-remeasure.md`, 0.039 against 0.138
  "1,590,838 chars is degeneration"  retracted; `chars` counts raw event bytes, envelope included



Written 2026-08-16 because the user's machine is stuttering and a hard reboot would otherwise lose the state.
Updated after every step from here rather than at the end.
Companion to `doc/planning/two-lane-corpus-pass.md`, which holds the design record;
this file holds the WORKING STATE.

Worktree: `/var/home/user/worktrees/translation-repair`, branch `translation-repair-rebased`.
All commands below assume it, not the main worktree.

## Two pools now exist, and they must not be confused

READ THIS BEFORE ANY DRAW. There are two settled pools and only one of them may feed a sample.

`~/translation-repair-runs-20260817/artifacts`, SIX ENTRIES, NATURAL ACCUMULATION. Acheron,
AkiraComplex, AmbeR_the_anpa, Anilovr, Arita, Chinatsu_Suzuki. Drawn in the order the pass takes
them, so a draw over it is a draw over the corpus. `#60`'s damage sheet came from here.

`~/translation-repair-runs-flagged-20260818/artifacts`, FIVE ENTRIES, HAND PICKED. lintong,
wangzihao980, GLaDOSister, dogesir_, saurikissa, chosen because the displacement probe flags them.
`corpus-pass` warns about this itself when `--only` is used, in as many words: run it into a
throwaway directory so a hand-picked entry never enters a pool later draws treat as natural
accumulation. IT MAY BE USED for the flagged-versus-unflagged comparison `#107` waits on, and it
MAY NOT be used for any precision, damage or accumulation draw, because its entries were selected
for the property being measured.

## What the six-entry pool measured

REPLACEMENT RATE 0.740, 37 of 50 slices, 0 withdrawn, translate lane. The three-entry reading was
0.739, so it held as the denominator doubled. Pooled figure quotable; per-entry rows are not, and
six entries cannot separate an effect from an entry.

ZERO DISPLACEMENT FLAGS across all six, which is why the flagged pool had to be made. That is a
real zero rather than a dead instrument: the same probe run flags 29 of 92 entries, 66 flagged
slices against 1260, about 5 percent, which over 50 slices predicts two or three.

## After the freeze lifted, 2026-08-17 night

THE PASS STOPPED CLEANLY at exactly 6 entries, the watcher reporting
`reached 6 entries, stopping pass 3768707` then `stopped`. Pool at
`~/translation-repair-runs-20260817/artifacts`: Acheron, AkiraComplex, AmbeR_the_anpa, Anilovr,
Arita, Chinatsu_Suzuki.

THE RUNAWAY GUARD IS NOW WIRED AND PROVEN. Built, tested and linted once the producing path was
free: `7aa4866fa` wires `drainBody`, and the strip test shows it fails without the guard
(`expected 'drained' to equal 'raised'`, drain reads 3,060,000 characters). The healthy long call
logs 1,652,574 in both runs, which is the control. `lint:types` and `lint:oxlint` clean.

THE SOL REVIEW RETURNED NOTHING. `timeout 3600 pi --model openai-codex/gpt-5.6-sol` exited 124 with
zero lines after the full hour, which is the documented "it may never return" case rather than a
failure. So the three stream modules have had NO second-reviewer pass. Worth redoing with a smaller
paste, one file rather than three, if a reviewer is wanted.

### `#60` redraw: the pool was ready, the draw was not

The draw failed on the settled pool with
`artifact parse failed at artifact Acheron.issues: expected an array`. It read version 1's
top-level issue list; these artifacts carry `lanes.repair` and `lanes.translate`.

MOVING THE FIELD READ WOULD HAVE BEEN THE WRONG FIX, quietly. Both lanes ship replacement text.
Measured over all six entries the population is 69 regions, 32 repair against 37 translate, so a
repair-only draw would have covered 46 percent of the regions where this pipeline replaced text
while calling itself a draw over the shipped regions.

Fixed in `b71ea7328` and `0b6d9afb0`: `corpus-run/damage-region-v2.ts` reads both lanes' delivery
ledgers, keeps `replacement-shipped` rows, records the lane per row, and counts rows that filled a
passage with no incumbent rather than dropping them (0 such rows in this pool). Uses the artifact's
own text rather than re-slicing, per `#115`, which also removed the old unplaceable-region failure.
Draw domain bumped to `damage-sample/v2` so the two populations cannot claim one draw.

## Evening sitting, 2026-08-17: runaway calls

WHY THIS EXISTS. The user reports that the provider does not auto-terminate token degeneration, so
runaway calls must be ended by us. Decision recorded in
`doc/decision/translation-repair-runaway-call-termination.md`; work tracked in `#119`.

THE USER'S THREE CONSTRAINTS, all of which shaped the design:

-   DO NOT SEND `max_tokens`. The provider is a two-person shop and a cap only helps if implemented
    correctly; relying on one turns "runs too long" into "truncates silently", which is worse.
    Keep the request body lean. No production stage sets it today, so this is a decision to keep
    current behaviour deliberately rather than by omission.
-   CATCH DEGENERATION IN THINKING TRACES, "I will output." repeating without end. This is the case
    that escapes everything else, because such a model emits no answer and a content-only scan sees
    an empty string, which reads as a short reply.
-   SOME MODELS LEGITIMATELY WRITE A GREAT DEAL, and that is not bad. Length never condemns.

BUILT AND COMMITTED, none of it wired into the drain yet, so nothing in the running pass changed:

-   `stream-degeneration.ts` `watchForDegeneration`, `8eb62c0ac` and `bf15afaf1`
-   `stream-delta-scan.ts` `scanStreamDeltas`, `8517282c1`
-   `stream-runaway-watch.ts` `watchRunaway` plus `StreamDegenerateError`, `fd62d7b37`

NOT BUILT OR LINTED YET. The worktree used for it had no `node_modules`, so everything was exercised
by running `node` against the TypeScript source directly: 9 detector checks, 8 scanner checks driven
end to end, 6 watch checks. Unit test files exist beside each module and import `dist`, so they have
never run. RUN `mise run //package/module/translation-repair:test:unit` AND `lint:types` ONCE THE
FREEZE LIFTS, and expect to fix things.

THE ONE REAL FALSE POSITIVE FOUND AND FIXED: verse carrying a refrain scored 0.036 distinct, which
the ratio alone condemns, and this corpus contains verse. The fix was to refuse to speak below about
131000 characters of generated text, roughly fifteen times the longest model output in any of the 56
settled artifacts. Do not lower that bar without re-checking verse.

MISREAD ONCE, DO NOT REPEAT IT: `chars` in the drain progress line counts RAW server-sent-event
bytes, envelope included, not generated text. A median of 324,995 is an ordinary reply.

## What the evening measurement said, and what it did not

`doc/decision/translation-repair-straggler-grace.md` now carries a second reading from the evening
pass. IT DOES NOT REPLACE the morning's `doc/audit/straggler-grace-remeasure.md`, which already ran
the named control and is the re-measure of record. An earlier draft of that section wrongly said the
re-measure was still owed; corrected in `d2573ed7a`.

Genuinely new from the evening data:

-   THE DEFINITION CANNOT SEE THE TRANSLATE LANE. `translate-document.ts:391` logs selection only
    when ZERO translators were heard, so partial loss in `select` leaves no `heard` line. Of 30
    voices lost in the snapshot, 17 went in `select` and 1 in `refiner`. The instrument counts 10
    of 30. Both sides of every comparison are measured the same way, so nothing is invalidated, but
    the figures understate loss and the definition should be extended before the next comparison.
-   EVERY ABANDONED VOICE IS A GLM, 29 of 29 attributed, and none is Kimi-K3, which appears more
    often in the log than any other model. Supersedes `#77`.
-   THE RESIDUAL IS CENSORED. An abandoned call is killed at quorum plus 180 s, so its duration is
    unknown and strictly greater. It is not shown to be a latency finding, and if these calls are
    degenerating then no window would ever have helped them.

## Pass state as of 2026-08-17 evening

-   Pass PID `3768707`, alive, cwd `package/module/translation-repair`, runs dir
    `/home/user/translation-repair-runs-20260817` via `TRANSLATION_REPAIR_RUNS_DIR`.
-   Watcher PID `3953196` polls that artifacts dir every 60 s and kills the pass at 6 entries.
    VERIFIED to watch the same path the pass writes to.
-   4 artifacts settled, 5th in flight. Frozen snapshot of the log at
    `~/temp/agent/grace-remeasure-snapshot.log`.
-   AUTO-PUSH IS FAILING with GitHub 500s as of 00:00Z; `d2573ed7a` is committed locally and not
    pushed. Retry `git push` from this worktree.

## Where the 2026-08-17 afternoon sitting got to

Newest first. Everything named here is COMMITTED and pushed unless it says otherwise.

-   `ad76cc8da` records that queue item 3 is BLOCKED and that its census already exists. Read that
    item before touching the aligner; it cost this sitting an hour before the task itself was read.
-   `3c070bde8`, `cffd4c376` the retry's missing test (raised-then-decided) and a count correction.
-   `3ab0a2d15` re-reads the straggler-grace re-measure on the AT-RISK population and prices the
    retry from settled artifacts. Both are in `doc/audit/straggler-grace-remeasure.md`.
-   `fcc6a4b57`, `3a667a187` the re-measure write-up and `#105`'s retry, from the morning.

THE RETRY IS GFP'D AND THE STRIP IS RESTORED. `judgeSlateWithRetry` was replaced in
`translate-stage.ts` by a direct `judgeTranslateSlate` call, rebuilt, and the suite reported
`AggregateError: 4 children failed in suite "runTranslateStage"`, naming exactly the four retry
cases: the twice-decline restamp, the second-ask accept, the evidence-into-refusal absent case, and
the new raised-then-decided one.

THE FIFTH RETRY CASE STAYED GREEN ON PURPOSE. "BUYS NO SECOND ROUND when the first one decided"
passes with the wiring stripped, because a decision buys no retry either way, so it is NOT strip
evidence and must not be counted as any. Worth keeping straight: a guard suite where every case
fails on a strip is usually a suite that is testing the wiring rather than the behaviour.

ITEM 6 IS BUILT, persisting probe output into the runs directory, which was decided and unblocked
once item 3 turned out not to be. It landed as `src/corpus-run/probe-store.ts` with six tests, and
`coverage-probe.ts` now writes through it while still printing to standard output.

TWO THINGS ABOUT ITS DESIGN worth not re-litigating:

-   IT IS SHARED, not coverage-specific, because `audit-sensitivity.ts` had the identical defect and
    its three runs of each arm on 2026-08-17 also survive only in a transcript. BOTH CALLERS ARE NOW
    WIRED (`d8dd1172c`), and the second one turned out to carry a worse defect than the one it was
    being fixed for: it had NO `import.meta.main` guard, so both arms ran at module scope and any
    import of that file bought a full checker roster twice. Verified from git rather than memory:
    the previous revision ends in two bare `await auditOne(...)` calls and contains no guard at all.
    Only the bundler's entry list stood between an ordinary import and the spend.

    THE GUARD IS DEMONSTRATED ONE WAY ONLY, and that is deliberate. Importing the built `.mjs` with
    `TRANSLATION_REPAIR_SYNTHETIC_API_KEY` cleared returns in 16 ms with no output, so the guard
    holds. The negative half, stripping it to watch the arms fire, is NOT run: it would spend a full
    roster, and the git evidence establishes the before-state without paying for it. Recorded here
    the same way `assertDerivationsAgree`'s missing strip demonstration was.

    `audit-sensitivity` RECORDS NO CORPUS PIN, deliberately, since it reads invented fixtures. That
    is what moved the corpus commit out of `ProbeRun` and into `subject`: the second caller could not
    fill the field honestly, which is the signal a field is in the wrong place.

    VERIFIED BY RUNNING IT FOR REAL, 6 calls and about two minutes, which is both the boundary check
    and a fourth stability sample. It wrote
    `audit-sensitivity/2026-08-17T13-41-58.852Z-c93f970d.json`, 18435 bytes, carrying three
    checkers, the subject naming its fixtures and arms, and BOTH ARMS' REPORTS WHOLE. It is the
    first `audit-sensitivity` result in this project's history that survives the terminal that ran
    it.

    WHAT THAT FOURTH SAMPLE SAYS, and it is not nothing:

    ```text
    flipped   heard 3/3   oracleVoices 3   agreed 1 (3 voices)   corroborated 0   near 3
    clean     heard 3/3   oracleVoices 0   agreed 0              corroborated 0   near 0
    ```

    THE CONTROL IS STILL CLEAN and the auditors still find the planted defect unanimously. THE
    STRICT TIER STILL MISSES IT: all three voices pointed at the oracle span and `corroborated` is
    zero, while the loose `agreed` tier caught it with all three. That is the fourth run in a row
    where the strict count would have reported a unanimous defect as nothing, which is exactly why
    the second tier was added, and it is now on disk rather than in a transcript.

GFP'D AND VERIFIED AT THE BOUNDARY, both:

-   THE STRIP was the filename, replaced by a fixed `rows.json`. Exactly three cases failed, and
    they are the three loss-guards: keeping both runs, separating two builds of one instant, and the
    stamped name. The other three pass under a fixed name, correctly, and are not strip evidence.
    Run per file with `node src/corpus-run/probe-store.unit.test.ts`, which takes seconds against
    the full suite's ten minutes.
-   THE BOUNDARY CHECK was the real task against a throwaway `TRANSLATION_REPAIR_RUNS_DIR` at
    `--cap 0`, which short-circuits before any candidate and so spends NO quota. Exit 0, one file
    written, carrying both instants, a real six-model roster, the corpus commit, 93 entries walked
    and a pipeline digest computed over built output.

AND IT FOUND SOMETHING, which is why that check is worth running rather than reasoning about: THE
REDIRECT THE PROBE WAS BUILT AROUND NEVER WORKED. The tagged logger writes to STANDARD OUTPUT, the
same stream the rows JSON goes to, and the probe logs a line per candidate, so
`coverage-probe > rows.json` yields progress lines wrapped around a JSON document that no parser
accepts. The rows were never recoverable that way for any run that actually probed anything. That
is not a regression from this change; it is why a file is the answer rather than better discipline.
-   A PER-RUN FILENAME, carrying the instant and the pipeline digest, because both probes are rerun
    against the same subject ON PURPOSE to see whether a verdict is stable, and one fixed `rows.json`
    would let each rerun destroy the run it was bought to be compared against.

NOT the reason, though an earlier draft of this section said so: `coverage-probe.ts` is nowhere near
the line cap. It measures about 209 CODE lines against a cap of 300, which counts code only; the 396
physical lines are mostly TSDoc. The split is justified by the second caller, not by size.

ALSO FOUND, and not yet fixed: `audit-sensitivity.ts` has NO `import.meta.main` guard, so importing
it runs both arms and spends quota. `coverage-probe.ts` carries that guard with a comment saying
exactly why. Nothing imports it today except the bundler entry list, so the hole is latent.

## Item 5's whole population is four files, and they were sitting in scratch

THE ONLY VERSION 2 ARTIFACTS THAT EXIST are four, being two entries settled twice. Measured rather
than assumed: the default runs directory holds 56 settled artifacts and NOT ONE carries an
`artifactSchemaVersion` field, so every one of them predates version 2 and none can answer a
two-lane question.

That matters because queue item 5 is the rendering audit run "standalone over EVERY settled version
2 artifact". Every is four, from two distinct entries. That is still worth running, being the
instrument's first application to real output rather than fixtures, but it is not the census the
phrase suggests, and nothing about particular entries can be settled from two of them.

THEY WERE BOTH IN `~/temp/agent`, which is the agent scratch root and is named to be deleted. A
cleanup or a REISUB would have destroyed item 5's entire input, and re-settling those two entries
costs about 100 minutes of real quota. They are now copied, about 1.8 MB in total, to:

```text
~/translation-repair-v2-archive/grace-remeasure-2026-08-17/{Aniloviraw,zheermao101}.json
~/translation-repair-v2-archive/grace-remeasure-2026-08-17/remeasure.log
~/translation-repair-v2-archive/two-lane-cost-2026-08-16/{Aniloviraw,zheermao101}.json
~/translation-repair-v2-archive/two-lane-cost-2026-08-16/two-lane-cost.log
```

THE LOGS WENT TOO, 3.7 MB with the artifacts. They are the evidence behind every table in
`doc/audit/straggler-grace-remeasure.md`: the per-stage voice completeness split by stage kind and
roster size was computed from them and cannot be recomputed from the artifacts alone.

OUTSIDE THE REPOSITORY ON PURPOSE: they carry corpus text, which does not enter this repo.

THE DEFAULT RUNS DIRECTORY IS GENUINELY DURABLE, checked rather than worried about, because it sits
under `node_modules/` and `resolveRunsDir` calls itself durable. The 56 settled artifacts there are
dated 2026-08-06 to 08-11 and `node_modules/.modules.yaml` is dated 2026-08-13, so an install ran
after they were written and did not remove them. Nothing to fix; recorded so it is not re-raised.

## The one sentence

Every defect in this stretch is the same shape:
**an absence recorded as a deliberate choice**,
and the fix is always to give the absence its own name rather than let it borrow a decision's.

## Standing instruction: `no-non-null-assertion` names the wrong fix

**From the user, 2026-08-16.**
`oxlint`'s `typescript(no-non-null-assertion)` prints help text suggesting optional chaining
(`x?.y` in place of `x!.y`). Do not follow it.
The fix in this repo is `nonNullishOrThrow` from `@monochromatic-dev/module-or-throw/ts`,
added as a `workspace:*` dependency where a package does not already carry one;
`translation-repair` already does (`package/module/translation-repair/package.json:23`).

The suggestion is not merely stylistically off, it changes what the code MEANS:
`x!.y` throws where the value is missing and `x?.y` yields `undefined`,
so following the help text turns a loud failure into a silent one,
which is the defect class this whole session exists to close.
The repo's own configuration already states the intent
(`package/config/oxlint/src/rule/restriction.ts:214`: "Ban non-null assertion (!): use nonNullishOrThrow instead").

Per the user, the message documented the correct fix not long before, so this reads as a REGRESSION
in wording rather than as a rule anyone re-decided.
What is measured so far: the help text (`Consider using the optional chain operator ...`) appears
nowhere in this repository outside `node_modules`, so it is emitted by oxlint's built-in
`typescript/no-non-null-assertion` rather than by any config or plugin here,
while the correct fix IS documented on this side, in
`package/config/oxlint/src/rule/restriction.ts:214` and
`package/oxlint-plugin/no-restricted-syntax/README.md` (lines 60, 139, 204).
The cause is NOT established beyond that: no oxlint source has been read for it.
Do not attribute it to the oxlint maintainers and do not file anything upstream on this evidence.
Tracked for the user to fix properly in `#442`.

## Standing instruction: fixtures are cat-themed invention, and adapting is not inventing

**From the user, 2026-08-17**, on a fixture I wrote for the rendering audit:
"Ensure everything is cat-themed. Cats don't hand over letters to Li Ming by hand."

The fixture in question was not corpus content, and that was checked rather than assumed: `git grep`
against the corpus clone at the pinned commit (`~/one-among-us/data`, `a41fc607`) reports zero files
for `没有离开`, `三封信`, `在窗台上`, `第二天把三封信`, `她没有离开`, `睡了一整天`, and zero for the
English side (`gave three letters`, `the windowsill`, `slept on the windowsill`).
The single hit anywhere was `交给了`, an ordinary verb phrase, in an unrelated sentence.
Nothing had been committed either: the file was untracked when the question was asked.

WHAT WAS ACTUALLY WRONG is worth keeping, because it is subtler than a licensing slip.
The sentence was ADAPTED from the fixture written into task `#85` by an earlier review, with the
place and person swapped, rather than invented here.
An inherited skeleton is weaker than the standard even when it carries no corpus text, and it is how
a non-cat example survives three rewrites.
Write fixtures; do not adapt them.

THE CHECK IS CHEAP, so run it rather than reasoning about it: `git grep --fixed-strings --count` for
each distinctive span in the corpus clone, before a fixture is committed and before one is sent to
any model.

WHERE CORPUS TEXT MAY GO, unchanged: to the production provider, which is ZDR and retains no
content. Not into the repository, and not into any other external tool. The sol reviews in this
handover were four source files with no corpus content and no fixtures beyond what those files hold.

## Landed, pushed, safe

-   `92539977f` read the unreached slice on the axis that separates it (test).
-   `494723d8d` pin the stage that heard nobody, and the rules around it (tests + barrel exports).
    Exports added: `LaneSliceOutcome`, `DecisionComparison`, `translateLaneWordings`.
-   `d14a06bca` pin the gap verdict, the decision axis, and the blocked run's shipped index (tests).

All three were shown to fail without their guards before being trusted (GFP), by stripping the
guard, rebuilding, running, and restoring with `git checkout --`.
The strip scripts are in the scratchpad as `unheard.mjs` and `ungap.mjs`.

## The vocabulary change landed

`c2779c737`, the whole thing as one commit,
because the coherence rule cannot land without the repair-exit fix:
`buildSliceDelivery` asserts coherence, and the repair lane would otherwise throw at every anchor.
Full suite green, lint clean, types clean.

New files it added:

-   `src/wording-coherence.ts`, the cross-axis rule, plus `src/wording-coherence.unit.test.ts`.
-   `src/lane-slice-sets.ts`, the five checks every named index list has to pass, shared by all three lists.
-   `src/lane-slice-coverage-error.ts`, the error class moved out so the builder and the set checks can share it
    without importing each other.
-   `src/repair-lane-wordings.ts`, the repair lane's adapter, mirroring `translate-lane-wordings.ts`.

Two existing tests moved with it, and neither was weakened:
the pairwise contradiction message is now one message for any two lists,
and the delivery fixture's anchor became `not-applicable` where it used to be `decided ''`.

## The decision taken while the user was away

**A fifth outcome member, `not-applicable`.**
Adopted rather than asked, because the evidence determines one answer (QGR);
recorded here and in the planning doc so it can be reversed on sight.

The repair lane skips a passage the archive never translated:
it mends existing English and there is none.
`notApplicableRepair` returns `repairedText: ''`,
and `repair-assemble.ts` fed every outcome to the builder as a DECISION,
so the lane reported "I decided the empty string here" at every gap in the archive.
`compareDecisions` then read that against a translate lane that actually filled the passage
and reported `{ kind: 'comparable', verdict: 'different' }`:
a row asserting the two lanes chose different wordings where one of them never had an opinion.

Both reviewers ranked the options A > B > C independently and for the same reason:

-   **A, the fifth member.** Chosen.
-   **B, report anchors as `unfilled`.** Rejected: `unfilled` means the lane tried and produced nothing,
    which is a rate worth measuring, and folding these in would make the repair lane's decline rate
    equal the count of gaps in the archive, a constant of the document that measures nothing about the lane.
    `#105` wants exactly that rate.
-   **C, keep `decided ''`.** Rejected: it is the defect.

Mechanics, agreed by both reviewers and implemented:

-   Coherence requires `not-applicable` to sit at an `absent` incumbent, and refuses it at a `present` one.
-   `decideDelivery` needs no new member: a non-decision at an absent incumbent already returns `gap-remains`,
    and the shipped/withdrawn refusal already covers it.
-   `not-applicable` is a REACHED outcome, so the stopped-prefix rule still refuses it after a `not-evaluated`.
    The blocked exit therefore intersects anchors with the outcomes prefix:
    an anchor before the crossing is `not-applicable`, one after it stays `not-evaluated`.
