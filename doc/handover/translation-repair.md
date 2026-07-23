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

MILESTONE TWO DECLARED COMPLETE (2026-07-18, user directive
"Promote the clause-enumeration rule and declare milestone two").
Final accumulated numbers over 20 judge-graded runs (22 to 41),
repairable universe: judge strict 80/96 (0.83); PROBE-ADJUSTED
EFFECTIVE 94/96 (0.98); lenient 92/96 (0.96); detection 166/174
(0.95, the four falses being correct refusals of not-derivable
content); lexical (retired comparison) 59/96 (0.61). Every miss is
attributed: embellishment-capped partials, correct refusals of
unfounded content, and TLL1122's two derivable seeds, one of which
the now-promoted clause-enumeration rule (commit `b6967cbc9`)
reproducibly fixes. The accumulation loop is CLOSED; run 42 (in
flight at declaration, old baseline prompt) gets recorded as the
final baseline-era run when it lands, and no run 43 follows.

PKG COMPLETENESS PASS COMPLETE (2026-07-23, user "Continue." after
closure; the handover's NEXT AFTER CLOSURE named this phase).
README refreshed with milestone-two completion and the
editorRuleAddendum contract knob (commit `479bf5a28`).
API surface audit (mechanical barrel-versus-module diff, scratchpad
`api-surface-audit.ts`): three accidental omissions surfaced into
`index.ts` (commit `0482bb9e6`): `locateQuote` + `QuoteLocation`
(whole module missed the barrel), `CategoryRemap` (return type of
public `remapCategoryLeaf`), `MIN_DISPATCH_BUDGET_MS` (parity with
the public repair floor). The audit's stale flag on `BenchmarkEntry`
was a false positive: `benchmark.ts` re-exports it from
`prepare-entry.ts`.
Coverage gap map (scratchpad `coverage-map.ts`, exported symbol to
importing test): direct tests added across six commits
(`6bd1dccb7`, `959b81df8`, `14b3a3fcd`, `235a28583`, `5ca27b00b`,
`601f3bbb1`) for locateQuote, normalizePunctuation, the JSON
guards, remapCategoryLeaf, isPanelVoteState, parseModelJson,
formatUsageNote, extractCompletion + readUsage + SyntheticHttpError
(every contract-violation detail), armCallDeadline (expiry,
forwarded abort, pre-aborted caller, disposal), fetchTransport
(previously zero test references; header copy, GET body omission,
status passthrough, dependent-signal abort), prepareBenchmarkEntry
(previously zero test references), all four prompt sheet builders
(critic, derivability, resolution, restoration judge) with their
verdict guards, buildFootnoteGraph (both conventions, every
finding kind), parseMarkdownBody, and a DEFAULT_JUDGE_MODEL_IDS
catalog-membership invariant.
Indirect coverage judged adequate per TC2 (branch-named tests in
callers): repairChunk and the four pipeline stages via
repair-translation's end-to-end suite (happy, checker-refusal,
no-issues, non-translation block), exchangeWithRetry and
attemptStageCall via the client and quorum suites, computeScorecard
via the benchmark suite.
Closing verification: 85 unit suites pass, oxlint 0 warnings 0
errors, lint:types exit 0.
DIST-IMPORT ALIGNMENT COMPLETE (2026-07-23, user "Align it.",
resolving the open question this section used to carry). Every unit
test now imports package behavior from the built
`dist/final/neutral/index.mjs` per the testing-practices skill;
none import sibling source anymore. Enablers: the package was
scaffolded without its sibling one-liner `rolldown.browser.config.ts`
so no dist bundle could ever build (source-importing tests hid
this); the config landed and the neutral bundle plus `.d.mts` now
build. A pre-alignment audit proved every test-imported symbol
already public (the PKG surface pass had closed the last gaps).
Mechanical codemod (scratchpad `dist-import-codemod.ts`) merged
each file's relative imports into one dist import with inline type
markers. Verification: 85 suites pass against dist, oxlint 0/0,
lint:types exit 0, and the `buildAndTest` task exercises the same
sequence end to end.

MILESTONE THREE SCOPING PROPOSED (2026-07-23, user "Scope milestone
3"). Deliberation only; no implementation authorized yet.
Grounding facts measured this session:
`derive-seeds.ts` emits only `kind: 'deletion'` seeds while
`seeded-error.ts` already plants deletion, replacement, and
insertion; no checkpoint serialization, policy-file seam, or
dossier (entities, terminology) module exists in src
("checkpoint" appears only in design comments, and
`tally-votes.ts` notes adjudication is replayable).
Options, ranked A > B > C > D:
- A (RECOMMENDED), real-corpus production pass: run the proven pure
  fn unseeded over all 92 pinned pairs through the budgeted
  accumulation loop until every entry carries a final status
  (repaired, unchanged, or blocked-non-translation; known-hard
  entries such as BI4PBV produce honest degraded statuses, nothing
  is excluded). Artifacts (issues with fates, repaired text,
  findings, status) stay outside the repo because the corpus is
  UNLICENSED; the handover records content-free tallies only.
  Headline gate: precision of accepted issues on a human-graded
  uniform sample (proposed 50 issues at a proposed 0.9 bar, user
  sets both), because a judge ensemble drawn from the same seven
  models re-affirming its own panel's acceptances is circular;
  a zh-anchored judge crosscheck over all accepted issues is the
  secondary, machine-graded number. Safety invariants: zero
  deterministic-gate violations, zero regression-majority
  selections, unchanged or blocked wherever nothing beats the
  input. Cost extrapolated from the measured DarlinChit
  full-pipeline datum (523 s, ~8.5 weighted units): 92 entries on
  the order of 13 hours wall and 800 weighted units spread over
  days of budgeted runs, inside regeneration; larger entries chunk
  into more calls, so that extrapolation is a floor.
  Pro: measures the one unmeasured dimension that matters
  (real-error precision; milestone one deliberately skipped
  precision grading), meets the recorded deferral condition
  ("until the pure fn proves itself"), and produces both the
  corpus deliverable and the data that would justify B, C, or D.
  Con: the headline sample needs user grading time, and artifacts
  must live outside the repo.
- B, broadened seeded benchmark: derive replacement and insertion
  seed classes modeled on the real error seed bank (meaning
  inversion, fabricated specifics, policy-violating additions);
  grade detection recall, within-region precision, and repair
  against exact planted truth. Pro: the planting substrate already
  exists, ground truth is exact, no human grading needed.
  Con: a synthetic proxy for the same unknown A measures directly,
  and it spends another accumulation loop before any real-corpus
  value ships.
- C, interactive steering driver: checkpoint serialization at
  stage boundaries plus typed steering operations (approve/strike
  issue, correct alignment, lock wording, force verdict) per the
  settled architecture. Pro: designed, and required for real
  adoption. Con: which steering operations matter is best learned
  from A's real output, and the consumer form is deliberately
  open.
- D, calibration bundle: canary calibration feeding panel weights,
  MiniMax scheduler weighting, judge-universe exclusion of blocked
  entries, per-model editor slates. Pro: all are recorded
  follow-ups. Con: explicitly "none yet requested", no driving
  number, and the ensemble currently absorbs the quirks.
Adjacent-pair reasons: A over B because A measures the real error
distribution and delivers corpus value while B proxies it;
B over C because B extends a proven harness toward a measurable
gate while C's requirements stay unknown until real output exists;
C over D because C has a designed contract while D lacks any
driving number.
USER PICK (2026-07-23): A, the real-corpus production pass, chosen
from the ranked options; the proposed defaults (50-issue uniform
sample, 0.9 precision bar) were accepted without notes.
MILESTONE THREE IS THE REAL-CORPUS PRODUCTION PASS. Execution
follows the milestone-two accumulation pattern: budgeted runs,
per-entry artifacts outside the repo (UNLICENSED corpus) under
`~/temp/translation-repair-corpus/`, content-free tallies here.
DRIVER BUILT AND LAUNCHED (2026-07-23):
`~/temp/translation-repair-corpus/corpus-pass-driver.ts` (home temp,
not the session scratchpad, because milestone-two's scratchpad
drivers evaporated with their sessions and the user grades from
these artifacts later). It imports the built dist as a real
consumer, lists people at the pinned SHA, excludes `tdor` (measured:
neither `page.md` nor `page.en.md` at the pin, so the universe is
exactly the 92 pairs), skips entries with existing artifacts,
orders by fewest attempts then listing order, dispatches while
elapsed < 25 min with 4-minute per-call deadlines and a 45-minute
plain-timer outer net (never `AbortSignal.timeout` composition on
Node 26), roster all seven critics and panelists, GLM-5.2 editor,
GLM-5.2/Qwen/Kimi checkers, `perModelConcurrency: 1`, and writes
one full artifact JSON per entry (completion marker) plus a TALLY
stdout line per entry (status, issue counts, findings, wall).
Plan mode (`--plan`, zero quota) verified: 92 pending.
Run 001 launched 2026-07-23 ~14:40 local, log
`~/temp/translation-repair-corpus/run-001.log`.
Per-run procedure: read TALLY lines, append content-free run record
here, commit, push, relaunch until every entry has an artifact.
Corpus-pass run log (all counts, no content):
run 001 (2026-07-23, 2009 s): 3 dispatched, 3 completed, 0 failed;
Acheron repaired (46 issues, 45 accepted, 45 resolved, 5 findings,
911 s); AkiraComplex repaired (9/9/9, 1 finding, 479 s);
AmbeR_the_anpa repaired (23 issues, 22 accepted, 21 resolved,
3 findings, 620 s). Remaining 89.

RESUME PROCEDURE (historical, loop closed at milestone-two
declaration). The user ran an unattended milestone-two accumulation
loop, "spare no expense, only stop when genuinely blocked; back in a
few hours" (2026-07-17). Standing procedure was one run at a time
(never concurrent; one stream per model is the fastest dispatch on
this plan):
1. Launch a budgeted benchmark pass:
   `cd <worktree> && mise exec -- node <scratchpad>/repair-benchmark-run.ts`
   where `<scratchpad>` is this session's scratchpad dir. The driver
   uses a 25-minute run budget, 4-minute per-call deadlines, a 45-minute
   outer safety net, oversamples 6 shuffled small entries (700 to 2500
   chars; XIEPT2, BI4PBV, and shi_Yumiaoya quarantined), and grades
   with the zh-anchored judge as headline plus the lexical grader for
   comparison.
2. On completion (task notification re-invokes you): read the run's
   output file, extract SCORECARD and the per-entry `judgments`
   (headline), `detection`, and `lexical` lines.
3. Append the run to the milestone-two run log below, update the
   JUDGE ACCUMULATED and detection tallies, commit with
   `/usr/bin/git` (docs(*) message), push (auto-push on).
4. Relaunch the next pass. Repeat until the user returns or a genuine
   blocker appears.
Artifacts persist in this session's scratchpad across compaction:
`repair-benchmark-run.ts` (driver), `repair-benchmark-accumulator.jsonl`
(one line per run with judge+detection+lexical per seed),
`repair-benchmark-result-<ts>.json` (full per-run dumps; from run 33
they also carry `repairedText` per dispatched record, commit
`66e0d0f42`), and `partial-needle-analysis.ts` (offline per-sentence
coverage report over non-restored seeds in enriched artifacts, zero
quota; run it when a stable-partial entry re-draws).
THE HEADLINE NUMBER is judge `seededRepairRate` (zh-anchored, strict
restored/judged); `seededRepairRateLenient` adds partial;
`lexicalRepairRate` is the retired vocabulary grader kept for contrast.
Do NOT set temperature or reasoning effort; chat calls MUST stream.
Open question already answered by the user: grade against the Chinese
source (done). No open questions currently block the loop.

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
  run 18 (2026-07-17, 1858 s): repair 3/6, detection 6/6; TLL1122's
  classification settles: both seeds DETECTED yet under-restored
  (6/15 and 5/12), so it is editor-side, not a detection hole;
  Katerina 2/2 again; the checker retry recovered two lost voices.
  Accumulated: 49/81 repair (0.60); post-remedy 30/46 (0.65);
  detection 58/64 (0.91).
  run 19 (2026-07-17, 1729 s): repair 4/6, detection 6/6;
  chunchun_yudong's 17-worder restored 12/17 a second time, while
  s5ehfr9's 13-worder missed a FOURTH time at a near-constant 3/13
  and keyword233's 15-worder repeated its exact 4/15: the specific
  editor misses look entry-deterministic despite editor
  nondeterminism, suggesting the failing needles share a content
  property (for the next design pass to identify).
  Accumulated: 53/87 repair (0.61); post-remedy 34/52 (0.65);
  detection 64/70 (0.91).
  run 20 (2026-07-17, 2272 s): repair 2/4, detection 4/4;
  a2581911655's 18-worder missed a fourth time at exactly 7/18 while
  its 16-worder restored a third time; new entry ttttsuuukikoo_
  (81 issues, the largest issue count yet) split 1/1.
  Accumulated: 55/91 repair (0.60); post-remedy 36/56 (0.64);
  detection 68/74 (0.92).
  NEEDLE-PROPERTY ANALYSIS (2026-07-17, offline, structural only):
  no single structural feature (quote marks, footnote refs,
  parentheticals, digits, comma density, paragraph position,
  document position) separates the stubborn misses from reliable
  restorations; both classes span the same ranges. Combined with
  the near-constant per-seed return ratios across independent runs
  (3/13 four times, 7/18 twice, 4/15 twice), the leading hypothesis
  is that the editor consistently produces a faithful-but-terse
  re-translation of a compact zh sentence, and vocabulary overlap
  against the wordier ORIGINAL EN under-credits it.
  CONSEQUENCE: the lexical seededRepairRate is a LOWER BOUND on true
  repair quality.
  USER DECISION (2026-07-17): grade restoration against the Chinese
  source. DONE (commit `81271a63d`): the headline seededRepairRate is
  now a bilingual ensemble JUDGE anchored on zh (`restoration-judge.ts`,
  `restoration-judge-wire.ts`). Judges read the original Chinese, the
  deleted sentence as a content pointer, and the repaired text, then
  rule restored/partial/absent, tolerating terse-but-faithful
  rewording and requiring zh grounding. No single judge decides:
  the roster (GLM-5.2, Qwen, Kimi by default) fans out with
  retry-to-quorum and each seed's verdict is the conservative lower
  median (an even split rounds toward the less-credited verdict).
  Scorecard now reports judgedSeeds, restoredSeeds, partialSeeds,
  seededRepairRate (strict, zh-anchored), seededRepairRateLenient
  (restored+partial), plus the lexical* fields for comparison.
  The lexical grader moved to `lexical-restoration.ts`; the benchmark
  takes an injectable `judge` seam (tests stub it) and a
  `judgeModelIds` roster. All prior run numbers (0.60 repair) were
  LEXICAL; the judge rate supersedes them from the next live run and
  the two rates print side by side so the gap is visible.
  JUDGE LIVE BOUNDARY CHECK (2026-07-17, `judge-boundary.ts`): on the
  saved DarlinChit repaired text, 3/3 judges heard, quorum met, both
  seeds ruled `restored` in 15 s for ~2 quota units. The live judge
  works; the overnight loop resumes on it from run 22.
  run 21 (2026-07-17, 2413 s, LAST lexical-only run): lexical repair
  2/4, detection 4/4; a2581911655's 18-worder missed a FIFTH time
  (5/18) and Acheron's 9-worder at 1/9, exactly the terse-faithful
  cases the judge is expected to re-credit, so run 21 is the natural
  before/after datum.
  FINAL LEXICAL ACCUMULATED: 57/97 (0.59) over 21 runs; detection
  72/78 (0.92). The judge rate starts fresh at run 22.
  run 22 (2026-07-17, 2271 s, FIRST judge-graded run): judge repair
  2/4 (0.50) versus lexical 0/4 on the SAME seeds, and the split is
  the validation, not noise:
  - ttttsuuukikoo_ both seeds JUDGE=restored but LEXICAL=absent
    (2/6 and 2/7 words): the editor faithfully re-translated the zh
    with different English wording, vocabulary overlap missed it, the
    bilingual judge caught it. This is the under-crediting the user
    predicted, now corrected.
  - wangzihao980 both seeds JUDGE=absent AND LEXICAL=absent while the
    run still resolved 37/37 OTHER issues: a genuine repair failure
    the judge agrees on. Detection was true (issue accepted at the
    region) but the editor did not actually restore the content, so
    detection-yet-unrepaired is real and the judge exposes it.
  The judge discriminates (credits faithful rewording, fails genuine
  misses) rather than inflating; that is the whole point.
  run 23 (2026-07-17, 2069 s): judge 4/4 (1.0), lexical also 4/4;
  noname3031 and MioCardMeow both fully restored, both graders
  agreeing this run (agreement is common; disagreement appears on the
  terse-rewording cases like run 22's ttttsuuukikoo_).
  run 24 (2026-07-17, 2469 s, first post-compaction run): judge 3/4
  (0.75), lexical also 3/4; detection 4/4. Acheron seed 0 (9 words)
  JUDGE=partial with 2/9 lexical words returned; its sibling seed 1
  (10 words) fully restored. MioCardMeow both restored again (repeat
  draw from run 23). Four entries budget-skipped including
  luxuanwen3, so the anti-compression prompt retest did not draw.
  PATTERN NOTE: Acheron breaks the "missed seed is always the LONGEST
  needle of its entry" streak; the partial (9 words) is shorter than
  its fully restored sibling (10 words).
  run 25 (2026-07-17, 1795 s): judge 6/6 (1.0), lexical 6/6,
  detection 6/6; yingying, lxy, SU5ZI2MO1 all fully repaired (three
  dispatched, three budget-skipped). SU5ZI2MO1 seed 0 was a 20-word
  needle restored fully (11/20 lexical words, judge unanimous): the
  longest needle restored to date, evidence the anti-compression
  editor prompt (edit-prompt.ts) is working on exactly the long-needle
  compression failure it was written for.
  run 26 (2026-07-17, 1608 s): judge 6/6 (1.0), lexical 4/6,
  detection 6/6; coin, Mizuki_Yuuki, AkiraComplex all fully repaired
  (three dispatched, three budget-skipped). Two more judge-vs-lexical
  disagreements, both unanimous judge=restored on low word overlap
  (coin seed 0: 3/11 words; AkiraComplex seed 0: 4/10): the
  faithful-rewording under-credit pattern run 22 first exposed.
  Mizuki_Yuuki seed 0 (18 words) restored fully, a second long
  needle credited since the anti-compression prompt.
  run 27 (2026-07-17, 2414 s): judge 5/6 (0.83, one partial),
  lexical 3/6, detection 6/6; CuspariaKLSY, Hangmster,
  CutOceanHeyFis1 all repaired (three dispatched, three
  budget-skipped). Three more unanimous judge=restored on low overlap
  (1/7, 6/14, 3/11 words). FIRST INVERSION: CuspariaKLSY seed 1 is
  lexical=restored (4/8 words) but judge=partial against the zh
  source; the judge discriminates in BOTH directions, catching a
  half-restoration the word counter credited. Lenient rate still 1.0.
  run 28 (2026-07-17, 1462 s): raw scorecard judge 2/4, detection
  2/4; but shi_Yumiaoya came back status=blocked-non-translation.
  Probe confirmed the block is CORRECT: its en page holds a genuinely
  untranslated CJK region (six lines at 33 to 83 percent CJK; zh 3935
  chars vs en 1458), 4/7 critics voted non-translation on that chunk,
  whole entry returned unchanged by design. Like XIEPT2, seeding it
  grades nothing about repair, so shi_Yumiaoya is now QUARANTINED in
  the driver (third entry). Its two run-28 seeds are excluded from
  the accumulated tallies below.
  JUDGE CAVEAT found: on the unchanged blocked text the judges
  unanimously called the 231-char seed 0 "restored" though the needle
  occurs 0 times; only 2 of its content words uniquely disappeared,
  so near-duplicate needles (vocabulary still present elsewhere) can
  fool the judge. Rare (first in 28 runs), quarantine prevents this
  instance; benchmark-side fix (exclude blocked entries from the
  judge universe) noted as a calibration follow-up.
  The repairable entry CuspariaKLSY, a repeat draw from run 27,
  reproduced its run 27 judgments exactly (seed 0 restored on 0/7
  lexical words, seed 1 partial): judge verdicts are stable across
  independent runs. Detection 2/2 there.
  run 29 (2026-07-17, 2405 s): judge 2/4 (0.50, two partials),
  lexical 2/4, detection 4/4; Anilovr and Acheron repaired (two
  dispatched, four budget-skipped). Acheron is a repeat draw from run
  24 and its seed 0 judged PARTIAL both times (independent runs):
  second reproducibility case; that specific needle consistently
  comes back half-restored from the editor. Anilovr seed 0 is a
  second inversion (lexical=restored on 4/7 words, judge=partial
  against the zh source). Lenient rate stays 1.0: every judged seed
  in the repairable universe is at least partial.
  run 30 (2026-07-18, 1598 s): judge 6/6 (1.0), lexical 4/6,
  detection 6/6; Mizuki_Yuuki, Barron12312, mone all fully repaired
  (three dispatched, three budget-skipped). Mizuki_Yuuki is a repeat
  draw from run 26 and both seeds judged restored BOTH times
  (including its 18-word needle): reproducibility now shown on the
  restored side as well as the partial side. mone adds two more
  unanimous judge=restored on low overlap (5/12, 3/11 words).
  run 31 (2026-07-18, 1818 s): judge 3/4 (0.75, one partial),
  lexical 4/4, detection 4/4; Anilovr and yingying repaired (two
  dispatched, four budget-skipped). Anilovr seed 0 judged PARTIAL
  again (runs 29 and 31, lexical over-crediting it both times): the
  inversion reproduces, third stable-partial seed alongside Acheron
  seed 0 and CuspariaKLSY seed 1. yingying reproduced run 25's
  double-restored.
  run 32 (2026-07-18, 2044 s): judge 6/6 (1.0), lexical 5/6,
  detection 6/6; Mizuki_Yuuki, SU5ZI2MO1, a2581911655 all fully
  repaired (three dispatched, three budget-skipped). Mizuki_Yuuki is
  three-for-three across independent draws; SU5ZI2MO1's 20-word
  needle restored again on repeat; a2581911655 seed 0 is another
  under-credit (8/18 words, unanimous judge=restored).
  run 33 (2026-07-18, 1444 s): judge 4/4 (1.0), lexical 3/4,
  detection 4/4; MioCardMeow and AkiraComplex repaired (two
  dispatched, four budget-skipped). MioCardMeow three-for-three
  across draws; AkiraComplex reproduced run 26 exactly including the
  same 4/10 lexical under-credit on seed 0. First enriched artifact
  (carries repairedText) but no partial verdicts to analyze this run.
  run 34 (2026-07-18, 1542 s): judge 5/6 (0.83, one partial),
  lexical 3/6, detection 6/6; keyword233, mone, Mizuki_Yuuki repaired
  (three dispatched, three budget-skipped). mone reproduced run 30's
  double-restored double-under-credit; Mizuki_Yuuki restored on its
  FOURTH draw. New partial: keyword233 seed 0, 15 content words,
  6 returned.
  FIRST ENRICHED-ARTIFACT ANALYSIS (partial-needle-analysis.ts, zero
  quota): keyword233's partial needle is a SINGLE sentence; its
  ordered coverage bitmap is 000100101110001, scattered mid-sentence
  coverage, so the residual failure mode is within-sentence
  paraphrase of one long sentence, NOT head-truncation and NOT
  dropped trailing sentences. OPEN HYPOTHESIS: if the deleted EN
  sentence embellished beyond the zh source, a faithful zh-anchored
  editor cannot restore those words and "partial" is the correct
  ceiling for that seed; testable later by asking the judge ensemble
  whether each needle is fully derivable from zh.
  run 35 (2026-07-18, 2404 s): judge 4/4 (1.0), lexical 2/4,
  detection 4/4; ttttsuuukikoo_ and CutOceanHeyFis1 repaired (two
  dispatched, four budget-skipped). Both are repeats reproducing
  earlier verdicts: ttttsuuukikoo_ (run 22's original under-credit
  case) restored again; CutOceanHeyFis1 matched run 27 including the
  same judge=restored-lexical=absent split on seed 0.
  run 36 (2026-07-18, 1554 s): judge 2/4 (0.50, both akasa_musha
  seeds partial), lexical 2/4, detection 4/4; akasa_musha (new entry)
  and CutOceanHeyFis1 (third draw, reproduced again) repaired.
  akasa_musha seed 0 is the largest needle yet (23 content words over
  three sentences); seed 1 is another inversion (lexical=restored
  8/13, judge=partial).
  ENRICHED ANALYSIS: akasa_musha seed 0's three sentences covered
  0.45/0.57/0.60 (none dropped whole); seed 1 single sentence at
  0.69 yet still judged partial. All three enriched partials to date
  show the same signature: scattered within-sentence paraphrase, no
  head-truncation, no sentence-dropping; the judges hold a high bar
  even at 0.69 word coverage.
  JUDGE ACCUMULATED (repairable universe): 59/70 (0.84) over 15 runs
  (22 to 36). Lexical over the same runs 45/70 (0.64). Detection
  142/148 (0.96).
  USER DIRECTION (2026-07-18, interactive): pursue BOTH the
  derivability probe AND the editor calibration A/B, probe first.
  Built and committed while run 37 was in flight:
  - Derivability probe (commit `2951e9b42`): derivability-wire.ts +
    derivability-probe.ts ask the judge ensemble whether each deleted
    sentence is fully derivable from the zh source
    (derivable/partially-derivable/not-derivable). UPPER-median
    resolution (opposite of the restoration judge) rounds splits
    toward derivable: the probe can only EXCUSE a partial, so the
    excuse carries the burden of proof. Unjudged defaults derivable.
    Driver `derivability-probe-run.ts` (scratchpad) probes all five
    stable-partial entries with restored siblings as controls; run it
    BETWEEN benchmark runs (one stream per model is fastest).
  - Editor rule addendum (commit `c767a550a`):
    RepairModels.editorRuleAddendum threads one extra rule line into
    the editor system prompt (composed from named blocks, never
    string surgery). A/B plan: baseline vs clause-enumeration rule on
    the stable-partial entries, judge verdicts on target seeds
    compared; only meaningful for seeds the probe rules derivable.
  run 37 (2026-07-18, 1531 s): judge 3/6 (0.50, three partials),
  lexical 3/6, detection 6/6; TLL1122, DarlinChit, keyword233
  repaired (three dispatched, three budget-skipped). TLL1122 (one of
  the two original long-needle miss entries) re-drew at last: BOTH
  seeds judged partial. keyword233 seed 0 reproduced its run 34
  partial (0.40 then 0.47 coverage across independent runs).
  DarlinChit fully restored. Stable-partial set now SIX seeds over
  five entries: Acheron 0, CuspariaKLSY 1, Anilovr 0, keyword233 0,
  TLL1122 0 and 1 (akasa_musha's two included makes eight probe
  targets). Enriched analysis over all six shows the one signature:
  scattered within-sentence paraphrase, 0.40 to 0.69 coverage, no
  sentence dropped whole.
  JUDGE ACCUMULATED (repairable universe): 62/76 (0.82) over 16 runs
  (22 to 37). Lexical over the same runs 48/76 (0.63). Detection
  148/154 (0.96).
  DERIVABILITY PROBE RESULTS (2026-07-18, 144 s total, ~14 quota
  units, every quorum 3/3, every vote unanimous):
  - Six of eight stable-partial seeds are PARTIALLY-DERIVABLE
    (Acheron 0, CuspariaKLSY 1, Anilovr 0, keyword233 0, akasa_musha
    0 and 1): the original EN translation embellished beyond the zh
    source, so partial restoration is those seeds' correct CEILING.
  - TLL1122 seeds 0 and 1 are DERIVABLE yet only partially restored:
    the only genuine editor shortfall; the A/B target.
  - wangzihao980's two ABSENT seeds (run 22) are NOT-DERIVABLE: the
    deleted sentences have no zh support, so the editor rule "Never
    introduce content the ORIGINAL does not support" makes refusal
    CORRECT; run 22's "genuine repair failure" reading is retracted.
  - All four restored-sibling controls probed derivable: the probe
    discriminates rather than excuses.
  MISS ATTRIBUTION through run 37 (76 judged seed-results): 62
  restored; 10 partials on partially-derivable seeds (ceiling met);
  2 partials on derivable TLL1122 seeds (real shortfall); 2 absents
  on not-derivable wangzihao980 seeds (correct refusal).
  PROBE-ADJUSTED EFFECTIVE RATE: 74/76 (0.97). Strict rate over
  winnable (derivable) seeds: 62/64 (0.97).
  ERRATUM: run 29 to 37 notes said accumulated lenient stayed 1.0;
  wrong, run 22's two wangzihao980 absents make lenient through run
  37 74/76 (0.97). Per-run lenient scorecards were correct; only the
  accumulated claim in these notes was wrong.
  EDITOR A/B, VARIANT ARM 1 (2026-07-18, 937 s): TLL1122 with the
  clause-enumeration editorRuleAddendum. Seed 1 FLIPPED partial ->
  RESTORED (unanimous, on 5/12 lexical words: meaning-complete
  rewording only the zh-anchored judge credits). Seed 0 stayed
  partial. Word coverage identical across arms (0.47 and 0.50), so
  the flip is purely semantic. Retry-to-quorum recovered a 4-critic
  forfeit and a whole-panel 7-voice forfeit inside this run.
  The rule text lives in scratchpad `editor-ab-run.ts` as
  CLAUSE_ENUMERATION_RULE. Variant arm 2 (replicate) launched to
  confirm the n=1 flip before drawing conclusions.
  EDITOR A/B, VARIANT ARM 2 (2026-07-18, 591 s): reproduces arm 1
  EXACTLY: seed 1 restored (unanimous), seed 0 partial, identical
  lexical counts (6/15, 5/12).
  A/B VERDICT: the clause-enumeration rule reliably flips TLL1122
  seed 1 (2/2 variant arms vs partial at baseline); TLL1122 seed 0 is
  now the accumulation's ONLY unresolved derivable seed, resisting
  both arms at 0.47 coverage. Why it resists is open; candidate
  probes: per-clause derivability of that one sentence, or a
  different editor model on that entry.
  DECISION FOR USER: promote CLAUSE_ENUMERATION_RULE into the
  baseline editor prompt? Evidence: 2/2 reproducible win on the one
  targeted seed, no observed regression (arm seeds elsewhere weren't
  run). Promotion changes the measured pipeline mid-accumulation, so
  it awaits explicit direction; the loop continues on the BASELINE
  prompt meanwhile for measurement continuity.
  run 38 (2026-07-18, 1598 s): judge 4/4 (1.0), lexical 3/4,
  detection 4/4; xixi_yuexi and homoyamakaze (both first-time
  entries) fully repaired (two dispatched, four budget-skipped).
  homoyamakaze includes a 16-word needle restored at 11/16 and
  another under-credit (3/10 words, unanimous judge=restored).
  JUDGE ACCUMULATED (repairable universe): 66/80 (0.83) over 17 runs
  (22 to 38). Lexical 51/80 (0.64). Detection 152/158 (0.96).
  Lenient 78/80 (0.98). Probe-adjusted effective 78/80 (0.98).
  run 39 (2026-07-18, 2281 s): judge 6/6 (1.0), lexical 5/6,
  detection 6/6; Katerina (first draw), homoyamakaze, a2581911655
  all fully repaired (three dispatched, three budget-skipped). Both
  repeats reproduced earlier verdicts; a2581911655 seed 0 repeated
  its under-credit (6/18, unanimous judge=restored).
  JUDGE ACCUMULATED (repairable universe): 72/86 (0.84) over 18 runs
  (22 to 39). Lexical 56/86 (0.65). Detection 158/164 (0.96).
  Lenient and probe-adjusted effective both 84/86 (0.98).
  run 40 (2026-07-18, 1504 s): judge 6/6 (1.0), lexical 2/6,
  detection 6/6; SU5ZI2MO1, luxuanwen3, coin all fully repaired
  (three dispatched, three budget-skipped). LUXUANWEN3 at last: one
  of the two original pre-judge long-needle miss entries dispatched
  for the first time in the judge era, and BOTH seeds judged restored
  on extreme under-credits (2/13 and 2/8 lexical words, unanimous).
  Its historic lexical-era "miss" was faithful rewording; with
  TLL1122 probed and A/B'd, every pre-judge question is now closed.
  SU5ZI2MO1's 20-word needle restored again (third time).
  JUDGE ACCUMULATED (repairable universe): 78/92 (0.85) over 19 runs
  (22 to 40). Lexical 58/92 (0.63). Detection 164/170 (0.96).
  Lenient and probe-adjusted effective both 90/92 (0.98).
  run 41 (2026-07-18, 1919 s): judge 2/4, lexical 1/4, detection 2/4;
  wangzihao980 and a2581911655 repaired (two dispatched, four
  budget-skipped). wangzihao980's first re-draw since run 22
  REPRODUCES it exactly: both seeds absent, detection false. With the
  probe's not-derivable verdict this is the correct-refusal case
  confirming across independent runs, and the detection "misses" are
  the same coin: nothing is actually missing relative to zh, so the
  panel rightly accepts no issue there. a2581911655 third draw, both
  restored again.
  JUDGE ACCUMULATED (repairable universe): 80/96 (0.83) over 20 runs
  (22 to 41). Lexical 59/96 (0.61). Detection 166/174 (0.95, the four
  wangzihao980 falses being correct refusals in disguise). Lenient
  92/96 (0.96). Probe-adjusted effective 94/96 (0.98).
  PROMOTION AND DECLARATION (2026-07-18, user directive): the
  clause-enumeration rule is now a baseline editor prompt rule
  (commit `b6967cbc9`; the editorRuleAddendum plumbing stays for
  future calibration experiments), and MILESTONE TWO IS DECLARED
  COMPLETE with the final numbers recorded at the top of the resume
  block. Run 42, launched before the promotion, ran the old baseline
  and closes the baseline era; no run 43.
  run 42, CLOSING RUN (2026-07-18, 1523 s, pre-promotion prompt):
  judge 2/4, lexical 2/4, detection 4/4; chunchun_yudong (first
  draw) both restored; SS3B_0016 (first draw) both partial, and an
  immediate derivability probe ruled both seeds PARTIALLY-DERIVABLE
  (unanimous, 19 s): embellishment-capped, misses attributed, the
  dominant pattern to the end.
  WHOLE-ACCUMULATION TOTALS including the closing run, 21 runs (22
  to 42), exactly 100 seed-results: judge strict 82/100 (0.82);
  PROBE-ADJUSTED EFFECTIVE 98/100 (0.98); lenient 96/100 (0.96);
  detection 170/178 (0.96); retired lexical 61/100 (0.61). LOOP
  CLOSED.
  NEXT AFTER CLOSURE: package completeness per PKG (README, exported
  API surface review, test coverage over every exported path) awaits
  user direction, as does any milestone-three scoping.
  The point after run 23 is where the user chose to compact.
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
