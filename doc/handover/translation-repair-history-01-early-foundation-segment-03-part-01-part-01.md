# Translation repair history: Early foundation, segment 3, part 01

Part 01 of [Translation repair history: Early foundation, segment 3](translation-repair-history-01-early-foundation-segment-03-part-01.md),
whose index lists every part in order.

## Current stop condition

Historical evidence only.
Candidate M failed on 2026-09-01.
No historical next-action list authorizes a corpus run,
model call,
spent-prompt retry,
or successor implementation.

## Continued record

### Preserved chronological continuation

RESUME PROCEDURE (historical,
loop closed at milestone-two
declaration).
The user ran an unattended milestone-two accumulation
loop,
"spare no expense,
only stop when genuinely blocked;
back in a
few hours" (2026-07-17).
Standing procedure was one run at a time
(never concurrent;
one stream per model is the fastest dispatch on
this plan):
1. Launch a budgeted benchmark pass:
   `cd <worktree> && mise exec -- node <scratchpad>/repair-benchmark-run.ts`
   where `<scratchpad>` is this session's scratchpad dir.
   The driver
   uses a 25-minute run budget,
   4-minute per-call deadlines,
   a 45-minute
   outer safety net,
   oversamples 6 shuffled small entries (700 to 2500
   chars;
   XIEPT2,
   BI4PBV,
   and shi_Yumiaoya quarantined),
   and grades
   with the zh-anchored judge as headline plus the lexical grader for
   comparison.
2. On completion (task notification re-invokes you):
   read the run's
   output file,
   extract SCORECARD and the per-entry `judgments`
   (headline),
   `detection`,
   and `lexical` lines.
3. Append the run to the milestone-two run log below,
   update the
   JUDGE ACCUMULATED and detection tallies,
   commit with
   `/usr/bin/git` (docs(*) message),
   push (auto-push on).
4. Relaunch the next pass.
   Repeat until the user returns or a genuine
   blocker appears.
Artifacts persist in this session's scratchpad across compaction:
`repair-benchmark-run.ts` (driver),
   `repair-benchmark-accumulator.jsonl`
(one line per run with judge+detection+lexical per seed),
`repair-benchmark-result-<ts>.json` (full per-run dumps;
   from run 33
they also carry `repairedText` per dispatched record,
   commit
`66e0d0f42`),
   and `partial-needle-analysis.ts` (offline per-sentence
coverage report over non-restored seeds in enriched artifacts,
   zero
quota;
   run it when a stable-partial entry re-draws).
THE HEADLINE NUMBER is judge `seededRepairRate` (zh-anchored,
   strict
restored/judged);
   `seededRepairRateLenient` adds partial;
`lexicalRepairRate` is the retired vocabulary grader kept for contrast.
Do NOT set temperature or reasoning effort;
   chat calls MUST stream.
Open question already answered by the user:
   grade against the Chinese
source (done).
   No open questions currently block the loop.

1. MILESTONE ONE NUMBER IS IN (2026-07-17,
   93-minute reference run,
   pre-budget code):
   `ensembleRecall` 0.981 (53 of 54 seeds) over 18
   entries spanning 714 to 5_826 chars,
   all seven models,
   one stream per
   model.
   Every one of the 126 calls ended `ok` (schemaOkRate 1.0 for
   every model,
   zero refusals);
   the retry layer recovered all four
   deadline forfeits (GLM-5.2,
   Flash,
   Qwen,
   MiniMax each once).
   Per-model seeded recall:
   GLM-5.2 0.889,
   Qwen 0.889,
   Kimi 0.815,
   gpt-oss 0.741,
   Nemotron 0.722,
   Flash 0.426,
   MiniMax 0.407;
   the ensemble union is the design working as intended.
   The single ensemble miss,
   analyzed at repair-phase kickoff
   (2026-07-17):
   wangzihao980 `seed/omission-1`,
   found by nobody.
   Sharper than first recorded:
   on that entry six models found ONLY
   `omission-2` and gpt-oss-120b found ONLY `omission-0` (its sole hit).
   Structural facts (no content):
   the missed needle is a 73-char
   interior sentence deleted from MID-paragraph (64 chars into its
   line);
   both found seeds were list items whose deletion left a
   countable zh/en structure asymmetry.
   Two consequences adopted:
   interior-sentence omissions are the critic's weak class (future
   prompt polish),
   and a real defect can arrive with exactly ONE
   proposer,
   so adjudication judges claims on evidence and never gates
   on corroboration count (confirms the settled panel design).
   Unresolved-reason distribution across the run (233 rejected claims):
   quote-outside-blocks source 90,
   quote-not-found source 39 / target
   33,
   ambiguous-quote 39,
   empty-quote 27,
   two model category typos;
   source-side anchoring is future critic polish,
   not a repair blocker.
   Quota after the whole run:
   2747.5/2750
   (regeneration outpaced consumption).
   MiniMax quirk:
   on 7 of 18 entries it returned near-empty reports
   (5-6 completion tokens,
   zero claims) yet valid JSON;
   on others it
   produced 10-19 resolved claims.
   Ensemble absorbs it;
   noted for
   scheduler weighting later.
   Future runs are 25-minute-budget runs via the updated
   `broadened-benchmark.ts` (shuffled samples,
   coverage-reporting
   scorecard).
