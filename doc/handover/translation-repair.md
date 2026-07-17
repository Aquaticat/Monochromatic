# Translation repair session handover

Status:
milestone one COMPLETE (ensembleRecall 0.981, 2026-07-17);
repair phase (milestone two) started 2026-07-17, tasks 11 to 17.
Milestone-one history below is kept for its evidence value.
Tasks 1 (scaffold), 2 (document core), 3 (issue model and span validation),
4 (Synthetic model client, streaming), and 6 (corpus reads) landed;
task 5 (benchmark) code is complete and fully gated (lint 0/0, types clean,
all unit tests pass, including the hang-forfeiture test):
run 1 died on fetch's headers timeout (fixed by streaming),
run 2 died on the driver's single global 20-minute abort signal
(fixed by per-call deadlines via `armCallDeadline`, commit `18a8e95ca`),
run 3 aborted before any model call on `MdxParseError` from two corpus
entries whose bodies contain HTML comments (see "Corpus facts").
The user bought 4 additional packs on 2026-07-16, joining a founder's
pack worth 1.5 normal packs (live five-hour ceiling now 2750,
5.5 pack-equivalents); the client's `perModelConcurrency` option and parallel
benchmark entries exploit them.
Run 4 (four entries including 8 to 21 KB translations, all seven models):
ensembleRecall 0 over a seed universe of 8, but mechanically explained,
27 of 28 attempts hit the 8-minute per-call deadline and the single
completion (GLM-5.2 on Huasheng) burned exactly 65_536 completion tokens
(the hard output ceiling) and truncated its JSON; only ~1.07 weighted
units billed, so starved calls cost nothing.
Post-run probes settled the diagnosis (see "Provider facts"):
same-model concurrency is real, and DarlinChit-scale entries (~1.4 KB)
complete in ~30 s with quality output.
Conclusion: the work unit must be small; chunking is mandatory for the
pipeline, and the benchmark uses small whole entries as stand-in chunks.
The parse phase is now tolerant per user directive (HTML comments masked,
plain-markdown fallback, findings not throws, commit `5762f4748`):
the whole pinned corpus parses (92 pairs: 69 clean, 23 comment-masked,
zero fallbacks, zero throws).
Run 5 (six small entries, 0.7 to 2.5 KB translations, 12 seeds, 42 calls):
ensembleRecall 0.5, but the decomposition is the real result.
On every entry where at least one model completed, ensemble recall was
100% (6 of 6 seed hits); the misses were entries where NO model produced
output. Failure causes: a burst-502 storm (27 instant gateway rejections
when 42 streams dispatched simultaneously; identical calls succeeded
minutes earlier), one entry (BI4PBV) where all seven models hit the
8-minute deadline, and one Nemotron 65_536-token blowout on a 1.6 KB
entry. Per-model seededRecall where completions happened:
Qwen3.6-27B 3/3 entries with 2/2 hits each, Kimi-K2.7-Code 2/2 entries
perfect, GLM-5.2 1/1 perfect (9 claims, zero unresolved),
GLM-4.7-Flash 1 completion with 0 hits (weak),
MiniMax-M3 1 "completion" of 5 tokens (an empty-but-valid report,
a precision pathology to watch). Net quota cost of the run: zero
(regeneration covered it).
Remediation landed as commit `1c7d22fd7`: the client retries transient
429/502/503/504 up to twice with jittered exponential backoff.
Run 6 (same entries, retries active, perModelConcurrency 2):
zero gateway errors, ensembleRecall 0.667 (8 of 12 seeds), best single
model gpt-oss-120b (7 of 12, schemaOk 0.667); BI4PBV timed out on all
seven models for the second consecutive run (content-conditional thinking
spiral, quarantined as data); `quote-crosses-blocks (source)` polluted
nearly every attempt's unresolved reasons.
USER PIVOT (2026-07-17): stop broadening; polish the whole loop
end-to-end on `people/Xu_Yushu` first (task 9). Full-document Xu_Yushu is
feasible live: GLM-5.2 64 s / 16_572 tokens / 30 issues, gpt-oss-120b
23 s / 8_493 tokens / 11 issues, refuting document size as the run-4
wall (spirals are content-conditional, see BI4PBV and Acheron).
USER DIRECTIVE: the system must handle malformed or mismatched texts on
its own, automatically; landed as tolerant parsing (commit `5762f4748`)
plus total automatic section alignment (commit `2f9b2c8af`:
`alignDocumentSections` pairs mirrored structures by index and degrades
to proportional monotone merging with findings, never refusing).
Xu_Yushu structural fact: both sides mirror exactly (48 nodes, identical
kind sequences, 9 sections).
Polish loop findings and fixes (Xu_Yushu, two full passes):
- Claim quality is real: clean-variant issues are specific verifiable
  defects (dropped 光辉璀璨的, 初高中 narrowed to high school, fabricated
  "2023" on dates, 动漫周边 mistranslated), and models CONVERGE on the
  same defects independently, validating ensemble adjudication.
- Pass 1: seeds 3/3 for four of six completing models; dominant failure
  was quote-not-found on punctuation variants (corpus curly, models
  ASCII).
- Fixes landed (`1c6b9fe2e`, `b6a0033cb`): length-preserving
  punctuation-normalized quote fallback (anchors keep document bytes),
  block-crossing quotes split into per-node spans, family-slip category
  remap, CJK corner brackets (「」『』) joined to the quote classes.
- Pass 2 (after first fixes): EVERY completing model (five) found all
  three seeds; resolution rates Qwen 30/31, Kimi 50/53, MiniMax 74/83,
  gpt-oss 26/31 (was 16/24), Nemotron 36/47. Remaining rejections are
  CORRECT: model typos in evidence (噪 for 噩), ambiguous short
  fragments (遗书), paraphrases, one typo category (accuracy/omition).
- Provider nondeterminism is large: GLM-5.2 completed both variants in
  pass 1 (13k and 33k tokens) and blew the 65_536 ceiling on BOTH in
  passes 2 and 3 at temperature 0 on identical input; Flash and
  Nemotron flip between completion and ceiling blowout per pass.
  The bounded second attempt is DONE (commits `b65d3069f`, `eb32173bf`):
  `attempt-retry.ts` (renamed from its truncation-only predecessor, whose
  retired name sits in the forbidden-strings appendix) detects
  truncation-shaped schema mismatches (truncated-thinking detail,
  cut-off-JSON parser messages, or completion tokens at the 65_536
  ceiling) plus http-error records, and `runCriticBenchmark` grants
  exactly one fresh-deadline second attempt, keeping the discarded first
  detail in `retriedFirstAttemptDetail`.
  Live pass 4 through `runCriticBenchmark` (seeded Xu_Yushu, all seven
  models, 308 s wall): every model completed `ok` on its FIRST attempt,
  zero truncations, so the retry path stayed idle live; trigger and cap
  are unit-tested and detection strings come from recorded real
  failures. Pass 4 is the best pass yet: 7/7 ok, ensemble recall 1.0,
  four models found all three seeds (GLM-5.2, Qwen, Kimi, Nemotron),
  GLM-5.2 completed at 10_690 tokens after three straight
  ceiling-blowout passes, Nemotron squeaked under the ceiling at
  45_977. Same input, fourth different behavior pattern:
  the nondeterminism cuts both ways.
  MiniMax-M3 flips which variant times out per pass.
  (Temperature is no longer sent at all; see provider facts.)
- Pass 3 (after corner-bracket fix): Qwen 29/29 resolved (100%),
  gpt-oss seeded 18/18, MiniMax clean 110/117, Nemotron clean 12/13;
  all three completing seeded models hit 3/3 seeds again.
  Source-side quote-not-found dropped from about nine (pass 2) to three
  (pass 3), all remaining ones genuine paraphrases or typos.
  Task 9 (Xu_Yushu polish) is COMPLETE: quality claims, perfect seed
  recall from every completing model across three passes, and the
  resolution gate now rejects only actual fabrication.
Update this document at every task completion or design pivot;
it exists so auto-compaction cannot lose session state.

## Goal

`@monochromatic-dev/module-translation-repair`:
a pure fn taking (original zh text, translated en text)
and returning validated issues plus a conservative repaired candidate.
Built for individually unreliable flat-rate models;
no single model output is ever a decision point.

Everything starts as a pure fn (user requirement);
consumers and deployment are deliberately out of scope for now.

## Where work lives

- Worktree `.claude/worktrees/translation-repair`, branch `translation-repair`.
- Use `/usr/bin/git` for commits in this worktree for this session (user authorization):
  the policy shim fails because the `forbidden-strings` scanner is a gitignored Rust build artifact
  (`package/cli/forbidden-strings/target/release/`) absent from fresh worktrees.
- `.env.local.json` copied from main worktree;
  `TRANSLATION_REPAIR_SYNTHETIC_API_KEY` resolves through mise sops (verified by name, never print values).
- Commits on branch:
  `16864f509` scaffold,
  `70aaaf557` catalog remark/MDX parser stack,
  `da689f628` document model and segmentation core,
  `401aa7db8` this handover,
  `411931d21` issue model and deterministic anchor validation,
  `c38ffd823` injected-transport Synthetic model client,
  `96eb1f68a` thinking-dominated output and API refusal field handling,
  `7347a73f7` pinned local corpus reads (plus `resolveGit` barrel export),
  `4cd25ae95` seeded-error benchmark harness and scorecard,
  `8f209692a` streamed chat completions,
  `2c90224ba` per-call deadlines (first, broken attempt via `AbortSignal.any`),
  `18a8e95ca` pack-scaled concurrency plus working timer-driven deadlines,
  `735e1b34e` seed derivation skips MDX/JSX delimiter-bearing sentences,
  plus docs commits after each task.

## Immediate next steps

1. MILESTONE ONE NUMBER IS IN (2026-07-17, 93-minute reference run,
   pre-budget code): `ensembleRecall` 0.981 (53 of 54 seeds) over 18
   entries spanning 714 to 5_826 chars, all seven models, one stream per
   model. Every one of the 126 calls ended `ok` (schemaOkRate 1.0 for
   every model, zero refusals); the retry layer recovered all four
   deadline forfeits (GLM-5.2, Flash, Qwen, MiniMax each once).
   Per-model seeded recall: GLM-5.2 0.889, Qwen 0.889, Kimi 0.815,
   gpt-oss 0.741, Nemotron 0.722, Flash 0.426, MiniMax 0.407;
   the ensemble union is the design working as intended.
   The single ensemble miss, analyzed at repair-phase kickoff
   (2026-07-17): wangzihao980 `seed/omission-1`, found by nobody.
   Sharper than first recorded: on that entry six models found ONLY
   `omission-2` and gpt-oss-120b found ONLY `omission-0` (its sole hit).
   Structural facts (no content): the missed needle is a 73-char
   interior sentence deleted from MID-paragraph (64 chars into its
   line); both found seeds were list items whose deletion left a
   countable zh/en structure asymmetry. Two consequences adopted:
   interior-sentence omissions are the critic's weak class (future
   prompt polish), and a real defect can arrive with exactly ONE
   proposer, so adjudication judges claims on evidence and never gates
   on corroboration count (confirms the settled panel design).
   Unresolved-reason distribution across the run (233 rejected claims):
   quote-outside-blocks source 90, quote-not-found source 39 / target
   33, ambiguous-quote 39, empty-quote 27, two model category typos;
   source-side anchoring is future critic polish, not a repair blocker.
   Quota after the whole run: 2747.5/2750
   (regeneration outpaced consumption).
   MiniMax quirk: on 7 of 18 entries it returned near-empty reports
   (5-6 completion tokens, zero claims) yet valid JSON; on others it
   produced 10-19 resolved claims. Ensemble absorbs it; noted for
   scheduler weighting later.
   Future runs are 25-minute-budget runs via the updated
   `broadened-benchmark.ts` (shuffled samples, coverage-reporting
   scorecard).
2. Per-call deadlines are DONE (commit `18a8e95ca`): `armCallDeadline` in
   `benchmark.ts` arms a plain-timer-driven `AbortController` per call and
   forwards caller aborts through a listener; disposal (`using`) clears both.
   Never compose `AbortSignal.any` with an `AbortSignal.timeout` source on
   Node 26.5.0: the dependent signal never aborts (isolated repro confirmed;
   single-source `AbortSignal.any([signal,],)` works fine, verified by probe).
3. Pack-scaled concurrency is DONE: `createSyntheticClient` takes
   `perModelConcurrency` (default 1; provider grants one concurrent request
   per model per subscribed pack), and benchmark entries run in parallel.
   The user bought 4 more packs (joining a 1.5-pack-equivalent founder's
   pack); live quota ceiling is 2750 (5.5 pack-equivalents),
   the driver floors to `perModelConcurrency: 5`.
4. Driver env: the API key resolves only through mise sops, so run the
   scratchpad driver as
   `cd <worktree> && mise exec -- node <scratchpad>/run-benchmark.ts`;
   a bare `node` invocation dies on the missing env var.
5. The `prefer-readonly-parameter-types` idiom learned for opaque DOM calls:
   the `@mutates` contract must sit on the function DIRECTLY containing the
   calls, name every flagged boundary verbatim on an unbroken line
   (`signal.addEventListener`, `signal.removeEventListener`,
   `DOM commit 5796f716 AbortController abort steps retain reason`),
   and the parameter must be `ForeignBorrowed`-marked (the
   `fetchTransport`/`chatJson` pattern); callers inherit the documented
   uncertainty without re-documenting.
- REPAIR PHASE PLAN (tasks 11 to 17, dependency-ordered; user confirmed
  repair phase as the next scope 2026-07-17):
  11 claim aggregation (cross-model dedupe proposing clusters,
  deterministic span-overlap plus category-family compatibility,
  merges only PROPOSED),
  12 adjudication panel (provenance-blind, vote states
  supported/unsupported/ambiguous/source-defect/abstain, quorum,
  evidence-based never corroboration-gated, disposes proposed merges),
  DONE (commit `ebfe447a2`) with live boundary check on seeded
  DarlinChit (2026-07-17): 7 critics -> 58 validated claims -> 15
  clusters (one 28-member hot-region mega-cluster, a refinement
  candidate) -> 5 of 7 panelists returned complete 58-verdict ballots
  with ZERO wire findings (integer-reference ballots work; Nemotron
  and gpt-oss forfeited the 5-minute deadline, driver had no retry)
  -> tally 42 issues (39 accepted, 2 rejected, 1 needs-human), BOTH
  planted seeds inside accepted issues, net quota cost ~0.
  chatJson success discriminant is `kind === 'ok'` (a first driver
  run wasted 5.6 quota units checking `'value'`),
  13 patch-operation model plus editable envelopes plus deterministic
  apply guards, DONE (commit `15450a437`: envelopes merge overlapping
  and touching accepted target spans, editors replace whole envelope
  contents against echoed base hashes, gate rejects unknown/duplicate/
  stale/drifted/unchanged as data, overlap throws),
  14 editor stage, DONE (commit `249dafad1`: numbered regions with
  current text and context, integer-referenced wire, resolver binds
  numbers to envelopes so models never echo hashes). Live editor check
  on the saved DarlinChit adjudication (2026-07-17): 39 accepted
  issues merged to 10 envelopes, GLM-5.2 answered in 7 s, 10/10 edits
  resolved and applied with zero findings and zero rejections; both
  deleted needles restored at about two-thirds content-word overlap
  (editor re-translates from zh, so byte-exact restoration is not
  expected). DESIGN FACT: the quote-based critic wire anchors
  omissions via the adjacent sentence, so omission repairs flow
  through replacement envelopes, not zero-width insertions; zero-width
  machinery stays for other producers.
  15 resolution check plus no-regression gate plus lexicographic
  candidate selection, DONE (commit `015b67b89`: checkers vote
  fixed/not-fixed/worse per issue, strict fixed majority resolves,
  worse majority counts as regression; selection order integrity >
  high-severity resolution > regressions > total resolution >
  preservation, unchanged candidate always competes and wins perfect
  ties). Live check (2026-07-17): 3 checkers, 39/39 verdicts each,
  zero findings, 25 s; 38/39 resolved (13 high-severity), 0
  regressed, patched candidate parsed clean, selection picked the
  repaired candidate over unchanged. Note checker leniency mirrors
  panel leniency; canary calibration remains the designed control,
  16 `repairTranslation` end-to-end, DONE (commit `a4d384dcb`:
  `repair-translation.ts` batch driver over `repair-chunk.ts` and the
  stage runners in `repair-stages.ts`/`repair-edit-stages.ts`;
  `stage-call.ts` turns lost voices into ensemble degradation, caller
  aborts always propagate; two wire-level critical non-translation
  votes block repair; changed chunks splice back descending;
  unit-tested end to end over a stub client scripted per
  response-format schema name). LIVE end-to-end on seeded DarlinChit
  (2026-07-17, 523 s, ~8.5 quota units): status `repaired`, critics
  5/7 heard (Nemotron and gpt-oss forfeited 4-minute deadlines,
  gracefully absorbed), 41 claims -> 31 issues (29 accepted, 2
  rejected), editor 10/10 applied zero rejections, checkers 3/3 with
  29/29 accepted issues resolved, BOTH deleted needles restored
  (11/18 and 10/15 distinctive words returned),
  17 milestone-two benchmark, DONE (commit `765e3059c`,
  `repair-benchmark.ts`): restoration grades on the distinctive
  vocabulary the deletion removed (words surviving elsewhere in the
  seeded text prove nothing; half returning marks restored,
  `RESTORATION_WORD_THRESHOLD`); `runRepairBenchmark` budget-gates
  entries sequentially with an injectable repair seam for tests;
  `computeRepairScorecard` reports `seededRepairRate` over measurable
  seeds plus coverage.
  FIRST MILESTONE-TWO NUMBER (2026-07-17, 25-minute budget, 1502 s
  wall, driver `repair-benchmark-run.ts` in the session scratchpad):
  seededRepairRate 0.75 (3 of 4 measurable seeds restored), 2 of 4
  sampled entries dispatched (coverage 0.5, budget cut the rest
  honestly), both dispatched entries status `repaired`
  (a2581911655 25/29 issues resolved, homoyamakaze 33/34).
  The one missed seed (a2581911655 omission-0, 5/18 words returned)
  is the first repair-quality calibration datum. One chunk
  (a2581911655 chunk 1) lost SIX of seven critics to 4-minute
  deadlines while GLM-5.2 completed and chunk 0 of the same entry had
  completed 7/7 four minutes earlier; the pipeline finished the chunk
  on the surviving voice. PROBE VERDICT (task 19, 2026-07-17): the
  exact seeded chunk re-run in a fresh window completed on ALL SEVEN
  models (44 to 205 s, six substantive reports plus MiniMax's known
  near-empty quirk), so the forfeit was provider weather, not
  content-hard input; retry-to-quorum is the right remedy. gpt-oss
  and Nemotron ran 200+ s even in the calm window: they are the
  systematic slow tail on this plan, not occasionally unlucky.
  Net quota over the whole run POSITIVE
  (2740.5 -> 2745.6 of 2750).
  The repair-phase exports live in `pipeline-barrel.ts` (root barrel
  hit max-lines).
  MILESTONE TWO IS NOT DONE (user directive 2026-07-17): a stage that
  loses voices must retry the lost ones until over half its roster is
  heard, DONE (task 18, commit `46d716ffa`: `stage-quorum.ts`
  `gatherStageVoices`, retries stop at quorum, unmet quorum proceeds
  with a finding; wired through critic, panel, checker, and the
  one-model editor roster). Budgeted runs now accumulate the real
  seededRepairRate (task 20); per-run accumulator JSONL sits in the
  session scratchpad.
  Run log (25-minute budget each, retries active from run 2 on):
  run 1 (2026-07-17, pre-retry): 0.75 (3/4 seeds), 2 entries
  dispatched, both repaired.
  run 2 (2026-07-17, retries active, 1964 s): 0.75 (3/4), entries
  Hangmster (34/34 issues resolved, 1 of 2 seeds) and Everythings99
  (27/29, 2 of 2); one panel round lost four voices and retry round
  one recovered them.
  run 3 (2026-07-17, 1872 s): 0.5 (3/6), THREE entries fit the same
  budget (retries keep stages complete instead of limping): DarlinChit
  2/2, s5ehfr9 1/2, TLL1122 0/2 while still shipping a 29/31-resolved
  repair; critic and panel each lost four voices once and retry round
  one recovered both fully.
  run 4 (2026-07-17, 1679 s, no retries needed): 0.33 (2/6):
  Katerina 2/2 (40/40 issues resolved), TLL1122 0/2 AGAIN (same
  entry, same misses as run 3: reproducible entry-specific failure),
  luxuanwen3 near-zero restoration (1/13 and 2/8 words) despite a
  23/26-resolved repair.
  run 5 (2026-07-17, 1655 s, detection grading active): repair 1/5,
  detection 2/6; the split works immediately:
  SevenBird both seeds DETECTED, one restored 8/11, one editor
  under-restoration 6/14 (just under threshold);
  wangzihao980 both seeds UNDETECTED, the same entry as milestone
  one's single ensemble miss, confirming interior omissions as the
  critics' weak class at the detection layer;
  XIEPT2 returned `blocked-non-translation` and a structural probe
  proved the block CORRECT (7365-char zh prose vs 1218-char en
  heading skeleton, a third still CJK): the guard works on real
  corpus data, and XIEPT2 joins BI4PBV in benchmark quarantine.
  run 6 (2026-07-17, 1813 s): repair 3/4, detection 4/4:
  qiqi233345 2/2; SS3B_0016 both detected, the 12-word needle came
  back 3/12 (editor compression on the longest needle again) while
  the 11-word one restored 6/11.
  Accumulated: 15/29 seeds restored (0.52); detection 6/10 over the
  graded runs. The misses have named classes:
  editor compression on long needles (detection fine), critic
  detection on interior omissions (wangzihao980), and one correctly
  blocked non-translation (XIEPT2, quarantined).
  QUANTIFIED (over all 29 graded seeds): needles over eleven
  distinctive words restore at 6/16 versus 9/13 for shorter ones;
  missed seeds average a 0.25 return ratio versus 0.67 for restored
  ones, so misses are real failures, not threshold noise.
  REMEDY SHIPPED (commit `a69cfdbe1`): the editor prompt now forbids
  summarizing or compressing omitted content ('a short paraphrase of
  a long omission is not a fix'); run 7 predates it, run 8 onward
  measures it.
  run 7 (2026-07-17, 1422 s, last pre-remedy baseline): repair 4/6,
  detection 6/6, all three entries repaired; misses are keyword233's
  15-word needle (4/15) and CuspariaKLSY's 7-word needle (1/7), the
  first SHORT-needle editor miss, so compression is dominant on long
  needles but not exclusive to them.
  Accumulated: 19/35 repair (0.54); detection 16/20 (0.80) over
  graded runs.
  run 8 (2026-07-17, 1826 s, FIRST with the anti-compression rule):
  repair 5/6 (0.83), detection 6/6, best multi-entry pass yet.
  Long needles went 3/4 this run versus 6/16 pre-remedy:
  chunchun_yudong's 17-word needle (longest graded) restored 12/17,
  SevenBird's 14-word needle that failed 6/14 in run 5 passed 8/14.
  The miss is s5ehfr9's 13-word needle again (2/13; 3/13 in run 3),
  a repeat offender worth an entry-specific look.
  Accumulated: 24/41 repair (0.59); post-remedy sample is one run,
  keep accumulating before crediting the rule.
  run 9 (2026-07-17, 2068 s): repair 3/4, detection 4/4:
  Rentable_A 2/2 with one PERFECT 7/7 restoration, a2581911655's
  16-word needle passed 9/16 while its 18-word needle missed again
  (6/18; 5/18 in run 1).
  POST-REMEDY TALLY after runs 8 and 9: 8/10 (0.80) versus 16/31
  (0.52) pre-remedy.
  run 10 (2026-07-17, 1778 s): repair 0/4, detection 2/4, the
  hardest pass yet: Anilovr both seeds detected but under-restored
  (2/7 and 2/8, SHORT needles, post-remedy), and wangzihao980
  reproduced its both-seeds-undetected failure from run 5, making it
  a STABLE detection hole (interior omissions defeat the critics on
  this entry across independent runs).
  Post-remedy tally corrected: 8/14 (0.57) versus 0.52 pre-remedy;
  the anti-compression rule's benefit is no longer clearly
  established, keep accumulating.
  Accumulated: 27/49 repair (0.55); detection 26/32 (0.81) over
  graded runs.
  run 11 (2026-07-17, 1717 s): repair 3/4, detection 4/4:
  MioCardMeow 2/2 with one PERFECT 8/8 and a 13-worder at 7/13;
  s5ehfr9's 13-word needle missed for the THIRD straight time
  (3/13, 2/13, 3/13): a stable editor-side repeat offender with
  detection fine, the editor-layer counterpart to wangzihao980's
  detection hole.
  Accumulated: 30/53 repair (0.57); post-remedy 11/18 (0.61) versus
  0.52 pre-remedy; detection 30/36 (0.83).
  run 12 (2026-07-17, 1488 s): the retry ladder's sternest live
  test: one chunk lost ALL SEVEN critics in a round, six again on
  retry round one, and five panelists in another round; the ladder
  recovered quorum every time (zero quorum-unmet findings) and the
  single entry that fit the budget completed with 51/51 issues
  resolved, detection 2/2, repair 1/2. Retries traded coverage
  (0.17) for completeness, as designed.
  Accumulated: 31/55 repair (0.56); post-remedy 12/20 (0.60);
  detection 32/38 (0.84).
  run 13 (2026-07-17, 1573 s): repair 3/4, detection 4/4:
  SU5ZI2MO1's 20-word needle, the longest graded yet, restored
  11/20 (a class that reliably failed pre-remedy); xixi_yuexi's
  11-worder missed just under threshold at 5/11.
  Accumulated: 34/59 repair (0.58); post-remedy 15/24 (0.63);
  detection 36/42 (0.86).
  run 14 (2026-07-17, 1639 s): repair 3/4, detection 4/4:
  coin one perfect 7/7 and one miss (2/11); xixi_yuexi 2/2 including
  the 11-worder that missed run 13 now passing 6/11 (nondeterminism
  cuts both ways at the editor too).
  Accumulated: 37/63 repair (0.59); post-remedy 18/28 (0.64);
  detection 40/46 (0.87).
  run 15 (2026-07-17, 2217 s): repair 3/4, detection 4/4; the
  EDITOR retry fired for the first time and recovered a lost editor
  voice (pre-quorum that chunk would have shipped unchanged).
  Uekawakuyuurei's 9-word seed missed at exactly 3/9 in two
  independent runs (12 and 15): a third stable repeat offender,
  editor-layer.
  Accumulated: 40/67 repair (0.60); post-remedy 21/32 (0.66);
  detection 44/50 (0.88).
  run 16 (2026-07-17, 2042 s): repair 3/4, detection 4/4 through a
  second whole-roster critic wipeout recovered in two retry rounds;
  lxy's 16-word needle near-missed at 7/16, SevenBird 2/2 again.
  Accumulated: 43/71 repair (0.61); post-remedy 24/36 (0.67);
  detection 48/54 (0.89). The rates have stabilized: repair around
  0.6 overall and about two thirds post-remedy, detection just
  under 0.9.
  run 17 (2026-07-17, 2302 s, calm weather, zero retries): repair
  3/4, detection 4/4; Everythings99 restored both 14-worders;
  a2581911655's 18-word needle missed a third time (7/18 after 5/18
  and 6/18): the longest needles trend upward post-remedy but the
  18-word class still sits under threshold.
  Accumulated: 46/75 repair (0.61); post-remedy 27/40 (0.68);
  detection 52/58 (0.90).
  Seed-detection grading (commit `a5c368a8a`) is active from run 5:
  it splits panel detection misses from editor under-restoration
  per seed, which TLL1122 and luxuanwen3 need.
  PATTERN: every missed seed so far is the LONGEST needle of its
  entry, restored only partially (5/18 and 5/14 words returned);
  long omissions come back compressed. Calibration candidates when
  data accumulates: widen omission envelopes, or grade long needles
  by clause.
  Follow-ups beyond that, none yet requested: canary calibration
  feeding panel weights, per-model editor comparison in candidate
  slates. MILESTONE-TWO GO/NO-GO NUMBER: seeded
  repair rate, the fraction of seeded omissions whose repaired
  candidate restores content matching the known deleted needle
  (normalized similarity; we planted it, so ground truth is exact)
  with ZERO out-of-envelope diffs. Reuses the seeded harness and the
  25-minute budget discipline.
- Task list lives in the session task tool;
  mirror of current state is in "Task state" below.

## Settled architecture

Deterministic core plus model stages, revised after an adversarial second-model critique (pi, gpt-5.6-sol):

- Stages are pure `(state, responses) -> newState`;
  drivers are the impure shell (functional core, imperative shell).
  Batch driver = `repairTranslation`;
  interactive driver adds human steering as typed operations
  (approve/strike issue, correct alignment, lock wording, force verdict)
  applied to serialized checkpoints at stage boundaries.
  Mid-stage steering = abort in-flight calls (`AbortSignal` on every client call), edit checkpoint, rerun stage.
- Critic fan-out across vendor families;
  refusals handled reactively (schema failure or refusal-shaped valid output -> reroute to another family),
  never predicted or pre-annotated.
- Adjudication by a fixed provenance-blind panel with vote states
  (`supported`/`unsupported`/`ambiguous`/`source-defect`/`abstain`) and quorum.
  Never a variable electorate of non-proposers (selection defect: consensus shrinks the electorate).
- Canaries (planted errors) are calibration probes feeding routing and vote weights only;
  never hard gates; corroborated findings survive a proposer's canary miss.
- Issues keep atomic claims;
  clustering only proposes merges, an adjudicator disposes.
- Editors return patch operations against base hashes inside declared editable envelopes;
  never whole rewritten chunks.
  Deterministic guards check region change; a semantic adjudication call checks issue resolution
  (region changed does not mean issue resolved).
- The unchanged translation always competes in candidate selection;
  selection is lexicographic (integrity, high-severity resolution, no regressions, preservation)
  with pairwise preference only as tie-breaker;
  original returned with unresolved issues when nothing demonstrably beats it.
- Output contract: repaired candidate plus accepted, rejected, and unresolved issues plus completion status;
  never an unqualified "corrected translation".
- Issue states beyond MQM: `suspected-source-error` (blocks correction, preserves safer translation),
  `interpretive-ambiguity`, `alignment-error`, `footnote-conflict`, and a `policy` family
  (editing-guide violations such as suicide-method detail).
- Document dossier (facts only, no instructions): entities, recurring term renderings, quotations, footnote graph.
  Translation policy files are static, human-written, optional inputs;
  never generated per passage (content sensitivity does not correlate with document class).
- Verdicts are chunk-level with a document rollup (translation quality varies within one document).
- Scorecard harness gates everything:
  per-model per-role recall/precision/refusal/schema-compliance on seeded errors decides
  panel sizes, weights, and routing.
  Ensemble recall ceiling is the go/no-go number.

## Provider facts (verified from Synthetic docs and pricing)

- Per pack ($30/mo): 500 price-weighted requests per 5 hours, regenerating 5% per 15 minutes;
  $24/week credits regenerating 2% per ~3.4 hours;
  1 concurrent request per model per pack, different models fully parallel
  (same-model excess queues server-side, it does not error).
  The user bought 4 more packs on 2026-07-16, joining a founder's pack
  worth 1.5 normal packs;
  the live account now shows a 2750-request five-hour ceiling
  (5.5 pack-equivalents at 500 each).
- Never set reasoning effort on Synthetic calls (user directive 2026-07-16):
  non-default values sometimes error, sometimes produce low-quality or worse
  output. Default only; there is no safe latency knob there.
- Run five concurrent streams per model and absorb burst weather with
  retries, not gentle dispatch (user directive 2026-07-16). Implemented in
  `transient-retry.ts` (commit `eb32173bf`): four transport retries on an
  equal-jitter ladder (half fixed, half random, doubling from 1 s),
  retryable statuses 408/429/500/502/503/504, thrown transport failures
  (mid-stream connection resets) retried too, caller aborts always
  propagate untouched, and the policy is injectable
  (`retryPolicy: { limit, baseMs }`) so tests run on tiny backoffs.
- Refined directive (2026-07-16, after the first concurrency-5 run failed):
  probe/bench the fastest dispatch strategy for this plan and use that.
  `bench-dispatch.ts` in the session scratchpad sweeps per-model
  concurrency 1/2/3/5 over identical small-entry critic calls and reports
  ok-per-minute plus forfeits per level; the milestone run uses the winner.
- Bench verdict (2026-07-17): one stream per model wins by a factor of
  six. Level 1: 7/7 ok, 71 s wall, 5.9 ok/min (median call 39 s).
  Levels 2/3/5: 0.8/1.0/0.6 ok/min, with every vendor except zai-org
  stalling to a 5-minute cap while both GLMs completed (slowed 2-4x).
  Aggregate concurrency beyond one-per-model collapses throughput on
  this plan, at least during this window; pack count does not translate
  into usable same-model parallelism. Milestone runs use
  `perModelConcurrency: 1`. Full fact base for the provider report:
  `doc/troubleshooting/synthetic-aggregate-concurrency-stall.md`.
- Benchmarks are time-boxed (user directive 2026-07-17: about 30 minutes
  each, or they run too rarely to be useful; commit `275f7b6ab`).
  `runCriticBenchmark` takes `runBudgetMs`: models work entry queues
  sequentially, every attempt and retry is budget-gated, exchange
  deadlines cap to the remaining budget, and cut attempts record as
  `skipped`. The scorecard excludes skipped records from all rates and
  recall denominators and reports `coverage`; drivers use
  `runBudgetMs: 25 min` + `perCallTimeoutMs: 5 min` + a 45-minute outer
  signal as safety net only (an outer abort throws away every in-memory
  record), and shuffle their entry sample per run so repeated
  budget-bound runs accumulate coverage.
- Deadline placement is load-bearing (commit `7c0e41532`): the first
  concurrency-5 run armed every fan-out call's deadline at dispatch while
  the limiter ran five per model, so queued calls burned their whole budget
  waiting and 124 of 126 expired in one synchronized wall; the mass abort
  then crashed Node via an orphaned HTTP/2 stream error
  (`ERR_HTTP2_STREAM_ERROR`; Node 26 fetch speaks h2 to this origin).
  Deadlines now arm inside the client's per-model slot
  (`exchangeTimeoutMs` on `ChatTextRequest`, `call-deadline.ts`), so only
  the exchange counts. Drivers keep a scoped `uncaughtException` guard
  that swallows only `ERR_HTTP2_STREAM_ERROR`.
- 35-stream probe (5 per model, tiny prompts): the dispatch burst drew 27
  instant 502s that the transport retries fully absorbed, but service
  under 35 streams is heavily stalled: one-character answers took
  78 to 119 s and 14 of 35 calls missed a 120 s cap. Aggregate stream
  count, not just per-model entitlement, governs real throughput.
- Never set temperature either (user directive 2026-07-16): per the user,
  this is less a Synthetic API issue and more their upstream GPU providers
  plus inference pipelines plus the models' inherent issues; either way the
  knob is not honored reliably. It was removed from `ChatTextRequest`
  entirely so nothing can set it; a unit test asserts the wire body carries
  no `temperature` key. All calls run on defaults, which also means past
  temperature-0 runs never had the determinism the setting promised
  (consistent with the observed completion-vs-ceiling flips on identical
  input).
- Live probe results (2026-07-16, after run 4):
  three concurrent tiny GLM-4.7-Flash calls all completed in 2.0 to 2.4 s,
  fully overlapped (no server-side serialization of dispatched requests);
  a real critic call on the smallest entry (DarlinChit, 1.4 KB translation)
  completed in 28.6 s on GLM-5.2 (6_621 completion tokens, 9 issues) and in
  35.4 s on gpt-oss-120b (2_246 tokens, 6 issues).
  Contrast run 4: an 8 KB translation drove GLM-5.2 to the 65_536-token
  output ceiling without finishing its JSON, and every other call starved
  behind long-running ones.
  Work-unit conclusion: critic calls must stay near DarlinChit scale
  (roughly 1 to 4 KB of translation); document chunking is mandatory for
  the full pipeline.
- Request weight = model input price / baseline input price (baseline is the provider
  default model, currently GLM-5.2 at exactly 1).
  Verified empirically: one GLM-4.7-Flash call deducted exactly 0.0714 (1/14) from
  `/quotas` remaining, matching `estimateRequestWeight` in `synthetic-catalog.ts`.
- `GET /openai/v1/models` carries per-model pricing, context length, max output
  (65536 for all), and feature flags; every catalog model advertises `json_mode` and
  `structured_outputs`.
  Per-model strictness still unverified, so client-side validation stays.
- `GET https://api.synthetic.new/v2/quotas` (free, does not count against limits);
  live shape verified 2026-07-16:
  `rollingFiveHourLimit {remaining,max,limited,nextTickAt,tickPercent}`,
  `weeklyTokenLimit {percentRemaining,maxCredits,remainingCredits,nextRegenAt,...}`,
  plus `subscription`, `search`, `freeToolCalls` (unmodeled).
- Models: GLM-5.2 (512k), GLM-4.7-Flash, Qwen3.6-27B, Kimi-K2.7-Code, MiniMax-M3,
  Nemotron-3-Super-120B, gpt-oss-120b; six vendor families.
- Chat base URL `https://api.synthetic.new/openai/v1`.
- The client (task 4) provides a per-model `p-limit` semaphore sized by
  `perModelConcurrency` (default 1; pass the pack count);
  price-aware role routing belongs to the orchestrator.
- End-to-end boundary check passed: real GLM-4.7-Flash `chatJson` round trip returned
  guard-validated JSON and the quota delta matched the estimate.
- Chat calls must stream (user directive: the provider is finicky without streaming;
  and the first real benchmark died on fetch's five-minute headers timeout while a
  model was thinking).
  The client always sends `stream: true` with `stream_options.include_usage`;
  the transport drains the whole SSE body to text and `stream-completion.ts`
  reassembles it, requiring the `[DONE]` terminator (cut-off streams throw instead
  of returning truncated content) and folding `delta.refusal` into the first-class
  refusal field.
  Do not add an undici dependency for timeout control (user directive);
  streaming makes plain platform fetch sufficient.
- These models think heavily: expect 90%+ of output tokens to be thinking tokens
  (user guidance; live probe confirmed 35 completion tokens for a 1-token answer).
  Consequences already built into the client:
  reasoning arrives in separate `reasoning`/`reasoning_content` message fields with
  clean `content` (verified live on GLM-4.7-Flash);
  the message carries a first-class `refusal` field which outranks heuristics
  (marker `api-refusal-field`);
  embedded `<think>` blocks are split off before parsing and refusal scanning;
  truncation inside thinking is a distinct schema-mismatch detail;
  `maxTokens` must be generous or omitted;
  budget spend estimates must use thinking-inflated completion counts
  (usage is carried on every `chatJson` outcome for the scorecard).

## Corpus facts (verified)

- Memorial corpus: `one-among-us/data`, `people/<id>/` entries with `info.yml`,
  `page.md` (zh source, YAML front matter, `##` section headings),
  `page.en.md` (translation under repair), `page.zh_hant.md` (script conversion, out of scope).
- The data repo is `UNLICENSED` (its `package.json`), explicitly all rights reserved:
  corpus content must never be committed to this repository.
- Fixture strategy (task 6, done): the user cloned the repo to `~/one-among-us/data`;
  `corpus-source.ts` reads it via `git show` at pinned `CORPUS_COMMIT_SHA`
  (`a41fc607ea5a70d8a7625cc67d5ed8c444f53379`, upstream `main` on 2026-07-16;
  92 zh/en page pairs, footnoted entries include Huasheng and DarlinChit).
  Blob reads use byte-exact `execFile` capture (nano-spawn strips the final newline);
  git resolves through `resolveGit` from `@monochromatic-dev/git-policy-cli/ts`
  (newly exported), because PATH exposes the policy shim
  (`node_modules/.bin/git` rejects bulk staging even in throwaway repos).
  Boundary-verified against the real clone: listing plus two entries parsed
  cleanly through `parseDocument` with resolved footnote graphs.
- Pages are MDX: upstream `scripts/mdx.ts` compiles with `@mdx-js/mdx`
  (Vue pragma, `remarkMath` only, no `remark-gfm`).
  `[^1]` renders quasi-literally on the live site;
  emitted repairs must preserve the exact textual footnote convention byte-for-byte.
- NOT every entry parses as MDX: of twelve sampled zh/en pairs, four failed
  `parseDocument` (`interrgned`, `windward0032`, `XingZ60`, `mikaela_khara`),
  at least one on an HTML comment (`<!--`, illegal in MDX) at body start.
  Open question how upstream renders those; the pipeline needs a skip-or-
  preprocess decision before corpus-wide runs.
  Parse-clean large pairs besides Huasheng/DarlinChit:
  `shihai4h`, `aiyysk`, `hulicaijia`, `NIGHT81473140`, `Xu_Yushu`, `zhangyubaka`.
- Deletion seeds can break the seeded MDX parse when the deleted sentence
  holds half of a paired construct (seen live: acorn "Unterminated string
  constant" after a seed removed the closing half of an `{'...'}` expression).
  `deriveOmissionSeeds` therefore skips delimiter-bearing sentences
  (commit `735e1b34e`), and the driver preflights `parseDocument` over the
  seeded text before spending quota.
- `page.en.md` files are plausibly Google-Translate seeded
  (`google-translate-api-x` plus a `translate` script upstream) with uneven human editing.
- Some memorial texts carry footnotes (`[^1]`, definitions `[^1]:[text](url)` link-wrapped);
  the archive class (Lu Xun, later) uses plain-text `〔N〕` markers.
- Editing guides are the policy files:
  `one-among-us/about-site` `content/{zh-Hans,en}/docs/memorial.md`.
  Deterministically checkable rules: 「」/『』 quote conventions in zh, curly quotes in en.
  Hard content rules: soften suicide methods, never drug names or doses;
  third person; `ta`/`they` for unstated pronouns; archive links for external references.
- Real error seed bank from corpus inspection:
  fabricated year ("November 13th, 2023" where source has no year; timeline implies 2019),
  meaning inversion ("never taught anything about gender" vs 接触过...相关概念),
  load-bearing omission (father's 「就像你们女孩子总希望找到一个强壮的男朋友保护自己」),
  flattened irony (心灵干洗机 -> "spiritual baptism"),
  policy-violating addition ("her committing suicide" for 她的离开 in the lxy entry).
- Quoted misgendering is content to preserve (narration she/her, father's 「儿子」「他」 stays);
  terminology-consistency guards need quoted-speech exemptions.
- Archive texts contain transcription errors against canonical editions
  (缘愁似棍长 for 缘愁似个长, 春秋焚梁传 for 穀梁传, 一九三三月三月十五日):
  `suspected-source-error` must be able to block "corrections" toward corruption.

## Repo idioms and traps learned this session

- micromark emits `footnoteReference` nodes only when a matching definition exists;
  an undefined `[^n]` survives as literal text.
  `scanGfmReferenceLiterals` in `footnote-graph.ts` turns exactly those literals into
  unresolved-reference findings.
- `prefer-readonly-parameter-types`: mdast-typed parameters need
  `ForeignBorrowed<...>` (from `@monochromatic-dev/ownership-marker-foreign-borrowed/ts`)
  at the ownership boundary; never repeat the marker on descendants.
  Error constructors passing `cause` to `super` need an
  `@mutates cause - ...getter or proxy trap...` TSDoc line (idiom from `package/module/fs-id/src/errors.ts`).
- `unicorn/custom-error-definition` wants literal `this.name = 'ClassName';` strings.
- `no-restricted-syntax/no-nullish-union`: model absence with optional properties plus conditional spread
  (`exactOptionalPropertyTypes`), never `T | undefined`.
- `eslint/init-declarations`: no `let` plus try-assign; extract a throwing helper returning the value.
- `prefer-describe-function-ref-name`: `describe` name must be `fnUnderTest.name`.
- Test harness: `await describe({ name, children: [it({ name, fn, },),], },)`
  from `@monochromatic-dev/module-test/ts`;
  matchers include `toBe`, `toEqual`, `toStrictEqual`, `toContain`, `toHaveLength`, `toThrow`.
- mise task wrappers swallow findings into inherited stdio:
  capture full output to a scratchpad file and `rg` it; tails alone mislead.
- Run `pnpm install` after every `package.json` dependency edit (TS2307 otherwise).
- Fixtures must never contain real-person data or recognizable source content;
  cat-themed invention mirroring structure only (user corrected this twice; treat as hard rule).
- Parser deps all from the pnpm catalog: `unified`, `remark-parse`, `remark-mdx`, `remark-gfm`,
  `yaml`, `@types/mdast`.
  `remark-math` is not in the catalog; math survives as text nodes (accepted milestone-one gap).
- `no-mixed-operators` idioms: parenthesize comparisons under `&&`/`||`,
  `(typeof value) !== 'string'`, and `index === (-1)` for indexOf non-existence
  (`unicorn/consistent-existence-index-check` simultaneously demands `=== -1`).
- `chain-per-line`: chains of two or more member steps plus a call split one step per
  line (`claim` / `.spans` / `.map(...)`); extract consts for chained conditions.
- `typescript/no-unsafe-type-assertion` bans narrowing casts:
  replace with `find` over the closed list plus `nonNullishOrThrow`.
- `isolatedDeclarations`: exported consts need explicit type annotations;
  `as const satisfies ...` alone fails TS9010.

## Task state

1. Scaffold package: done.
2. Document model and segmentation core: done
   (`parse-document.ts`, `document-node.ts`, `footnote-graph.ts`, `footnote-model.ts`,
   `front-matter.ts`, `parse-mdx.ts`; 20 tests; zero lint findings).
3. Issue model and span/anchor validation: done
   (`issue-taxonomy.ts`: closed MQM-derived category union with `policy` and
   `extension` families, severities including `neutral`, runtime guards;
   `issue-model.ts`: `SpanAnchor` with side/nodeId/nodeHash/absolute offsets/exact
   quote, zero-width insertion anchors, atomic multi-span `IssueClaim`,
   deterministic `computeIssueClaimId` over canonical serialization;
   `validate-issue.ts`: rejection-as-data `validateIssueClaim` with kinds
   anchorless-issue, malformed-offset, inverted-span, unknown-node,
   stale-node-hash, span-outside-node, quote-mismatch;
   fail-fast per span, all spans reported independently;
   adversarial tests over parsed cat-themed fixtures).
   Claims carry no proposer provenance; the shell tracks that outside the claim.
4. Synthetic model client: done
   (`synthetic-catalog.ts` verified catalog and request-weight estimator;
   `synthetic-transport.ts` injectable transport seam, fetch receives only
   locally owned values plus a dependent signal;
   `synthetic-quota.ts` typed `/v2/quotas` snapshots;
   `completion-shape.ts` protocol parsing with first-class `refusal` field;
   `refusal.ts` deterministic opening-window marker scan;
   `chat-contract.ts` request/outcome types;
   `model-content.ts` fence and think-block handling, tolerant JSON parse;
   `synthetic-client.ts` `createSyntheticClient` with per-model `p-limit(1)`,
   mandatory `AbortSignal`, outcome-as-data `chatJson`;
   boundary-verified against the live API twice).
5. Seeded-error benchmark harness and scorecard (exit criterion of milestone one):
   code landed (`4cd25ae95`), first real run in progress.
   `seeded-error.ts` (deterministic planting, region tracking, hit tolerance 30),
   `derive-seeds.ts` (runtime omission derivation from longest unique sentences,
   min 40 chars, so no UNLICENSED content is committed),
   `critic-wire.ts` (quote-based wire format, `CRITIC_RESPONSE_FORMAT` JSON schema,
   quote-to-anchor resolution failing closed on absent/ambiguous/cross-block
   quotes, final `validateIssueClaim` gate),
   `critic-prompt.ts` (strict system prompt with closed vocabularies),
   `scorecard.ts` (pure aggregation; per-model schema-ok, refusal, effective
   seeded recall; `ensembleRecall` over the entry+seed universe is the go/no-go
   number; precision is deliberately not graded against seeded truth because the
   MT-seeded corpus carries genuine errors),
   `benchmark.ts` (`runCriticBenchmark`: entries and models parallel,
   HTTP failures as attempt data, aborts propagate, and one
   fresh-deadline second attempt per transient-shaped failure via
   `attempt-retry.ts`).
   First real run: entries Huasheng and DarlinChit, 2 derived omission seeds each,
   all 7 models; driver script `run-benchmark.ts` in the session scratchpad;
   results land in `benchmark-result.json` there and must be copied into this doc.
6. Pinned-SHA corpus reads from the user's local clone: done (`corpus-source.ts`;
   see corpus facts).
7. Section chunking with total automatic alignment: done
   (`chunk-document.ts`, commit `2f9b2c8af`).
8. Tolerant parsing: done (commit `5762f4748`).
9. Xu_Yushu polish loop: done (see status narrative).
10. Truncation-shaped retry: done (`attempt-retry.ts`).
11. Claim aggregation into merge-proposal clusters: done
    (`aggregate-claims.ts`, commit `8818f27fd`: dedupe by
    `computeIssueClaimId`, transitive same-family span-overlap clustering
    via work-stack walk, zero-width anchors expand by
    `CLUSTER_ANCHOR_TOLERANCE` 30, deterministic cluster ids over sorted
    member ids, clusters in document order; nine unit tests, lint 0/0.
    `format:oxlint` is the auto-fixer for the vertical stylistic rules;
    run it instead of hand-splitting arguments).
12. Adjudication panel with vote states and quorum: blocked by 11.
13. Patch-operation model, envelopes, deterministic apply: parallel-ready.
14. Editor stage (patch-op wire): blocked by 12 and 13.
15. Resolution check, no-regression gate, candidate selection: blocked by 14.
16. `repairTranslation` end-to-end: blocked by 15.
17. Milestone-two benchmark (seeded repair rate): blocked by 16.

## Deliberately open

- Output consumer (wiki PRs, files, UI): deferred until after the pure fn proves itself.
- User possesses the policy files; the system must function without them.
- Benchmark focuses on memorial texts first (user decision).
- Unrelated text pairs (user probe: zh cat story vs "Meow meow meow"):
  `accuracy/non-translation` is in the taxonomy (commit `d4dabc283`) and
  the critic prompt reports one critical instance for wholly unrelated
  pairs. Verified live on the invented pair: GLM-5.2, gpt-oss-120b, and
  Qwen3.6-27B each emitted exactly one accuracy/non-translation/critical
  issue. Qwen's failed to ANCHOR (degenerate repetitive gibberish makes
  every short quote ambiguous), so the future rollup must treat
  non-translation as a document-level verdict where wire-level ensemble
  agreement suffices and anchoring is best-effort; ensemble-agreed
  critical non-translation blocks repair and returns the input unchanged.
- Model-driven input fixing (user: parse phase may "optionally" use LLMs to
  fix source and translations before continuing): deferred by evidence, not
  rejected. Deterministic tolerance (comment masking + markdown fallback)
  covers every document in the pinned corpus with zero fallbacks needed;
  `RepairDocument.parseFindings` is the designed trigger seam. Build the
  LLM fixer only when a corpus commit produces a document whose findings
  show real damage (an `mdx-downgraded` finding is the signal to watch),
  and gate any fixed text on a strict re-parse plus a content-preservation
  check before it replaces the input.
- Document chunking (zh-to-en aligned sections) LANDED
  (commit `2f9b2c8af`: `chunk-document.ts`, `alignDocumentSections`
  pairing mirrored structures by index, degrading to proportional
  monotone merging with findings, never refusing). Motivation stands:
  run 4 proved whole large documents exceed the 65_536-token output
  ceiling on thinking models, and small units complete in ~30 s.
