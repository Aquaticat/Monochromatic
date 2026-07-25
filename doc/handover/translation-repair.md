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

- Worktree `${HOME}/worktrees/translation-repair`, branch `translation-repair`.
  Moved 2026-07-24 (`git worktree move`) out of the old in-repo
  `.claude/worktrees/translation-repair`, which risked the same stray-cleanup loss
  as `${HOME}/temp`; it now sits alongside the repo's other worktrees under
  `${HOME}/worktrees/`. After the move, run `mise trust` at the new path.
- Use `/usr/bin/git` for commits in this worktree for this session (user authorization):
  the policy shim fails because the `forbidden-strings` scanner is a gitignored Rust build artifact
  (`package/cli/forbidden-strings/target/release/`) absent from fresh worktrees.
- `.env.local.json` copied from main worktree;
  `TRANSLATION_REPAIR_SYNTHETIC_API_KEY` resolves through mise sops (verified by name, never print values).
- Corpus-pass driver and sentinel probe are COMMITTED SOURCE (2026-07-24, user
  directive "driver and probe should be source code") under
  `package/module/translation-repair/src/corpus-run/`:
  `run-config.ts` (shared roster, budgets, corpus pin, worktree/runs-dir
  resolvers, client factory), `corpus-pass.ts` (full-corpus accumulation pass),
  `sentinel-probe.ts` (named-entry validation). They import the pipeline from
  SIBLING SOURCE and are `import.meta.main`-guarded, following the repo's
  executable-in-src pattern (e.g. `package/dev-script/watch-restart/src/cli.ts`);
  no hardcoded dist path. Run via mise tasks (package `mise.toml`):
  `mise run //package/module/translation-repair:corpus-pass` (append `-- --plan`
  for the zero-quota setup check that verifies imports, corpus reads, filtering,
  ordering, key injection, and client construction), and
  `mise run //package/module/translation-repair:sentinel-probe -- <id>...`.
  Only the RUN OUTPUTS stay gitignored and out of git: per-entry artifacts,
  `attempts.json`, and run logs live in
  `node_modules/.monochromatic/translation-repair-runs/` (gitignored so
  UNLICENSED-corpus-derived artifacts can never be committed, and outside
  `${HOME}/temp` so cleanup cannot wipe them; AGENTS.md rules TMP and NMD).
  Override that dir with `TRANSLATION_REPAIR_RUNS_DIR`.
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
  accumulation loop until every entry carries a settled status
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
run 002 (2026-07-23, 2064 s): 2 dispatched, 2 completed, 0 failed;
Anilovr repaired (78 issues, 70 accepted, 69 resolved, 12 findings,
1420 s, largest issue count of the pass so far); Aniloviraw
blocked-non-translation (34 issues, 31 accepted, resolution never
ran, 644 s), and a zero-quota probe rules this the FIRST FALSE
BLOCK: unlike XIEPT2/shi_Yumiaoya the en page carries zero CJK,
sizes match (~1.5 KB both sides), front matter and body translate
line for line on inspection. The log shows 4 of 7 critics cast
critical non-translation votes on the single chunk while the same
stage produced 59 claims; so the block logic worked as designed
(ensemble agreement) but the critic-level non-translation
classification is noisy on divergence-heavy quote-fragment diary
content. Decision: measurement continuity, pipeline unchanged
through the pass; false blocks get probed and tallied per entry,
and block calibration (for example requiring voters to file no
substantive claims themselves) is a named post-pass workstream.
Remaining 87.
USER DIRECTIVE (2026-07-23, supersedes the measurement-continuity
freeze recorded above): iteratively improve the system whenever a
change is highly confident to improve it, and RESTART ALL PASSES
after each such change; prior pass artifacts are discarded. Standing
procedure from here: discovery -> high-confidence fix -> unit tests
-> live sentinel validation where prior behavior is known -> commit
-> wipe artifacts -> restart pass numbering.
FIRST ITERATION (commit `6f11683fd`): deterministic contradiction
screening for non-translation votes. Threshold ideas failed
measurement first (length ratio: genuine pair Zha_Ke runs 16x en
over zh while correctly blocked XIEPT2 sits at 6.4x; CJK residue:
genuine shihai4h carries 6.8 percent versus correctly blocked
shi_Yumiaoya's 5.1). The surviving discriminator comes from the
category's own definition (wholly unrelated pair): validated claims
that critique translated content (category leaf outside omission/
untranslated/non-translation) and anchor at least one span into the
TARGET side contradict the votes deterministically. Aniloviraw
measured 44 such claims (and its panel had ACCEPTED a critical
non-translation issue, so panel routing alone would not have saved
it); floor set at 8 (ensemble-scale margin over a seven-critic
roster). New module `non-translation-evidence.ts`:
`assessNonTranslationEvidence` (verdict + count) and
`screenNonTranslationVotes` (dismisses contradicted votes together
with their non-translation claims pre-aggregation, emitting a
finding); `repairChunk` screens after the critic stage and exposes
`nonTranslationContradicted`; `repairTranslation` blocks only on
uncontradicted votes. NON_TRANSLATION_BLOCK_VOTES moved to the new
module (barrel path updated). Verification: 87 suites pass against
dist including the new contradicted-path end-to-end test, oxlint
0/0 (max-lines remediated by moving screening logic into the new
module, never by raising the limit), lint:types exit 0.
LIVE SENTINEL PROBE: ALL PASS (2026-07-23, log
`~/temp/translation-repair-corpus/sentinel-probe.log`, artifacts
kept under `probe/`). XIEPT2 stayed blocked (blocked chunk: 5
claims, 4 votes, 165 s); shi_Yumiaoya stayed blocked (blocked
chunk: 7 claims, 5 votes; its translated chunk drew 35 claims with
zero votes, 983 s); Aniloviraw REPAIRED (4 votes reproduced across
independent runs, dismissed against 37 content-critique claims,
655 s). The floor of 8 sits in a wide gap: correct blocks at 5 and
7 total claims, the false block at 37 content-critique claims.
Run 004 had been stopped mid-flight; PASS 2 started from zero
(all pass-1 artifacts and attempts wiped, 92 pending) under the
fixed pipeline, logs `pass2-run-NNN.log`.
Pass 2 run log (all counts, no content):
pass2 run 001 (2026-07-23, 1502 s): 2 dispatched, 2 completed, 0
failed; Acheron repaired (48 issues, 46 accepted, 45 resolved, 7
findings, 1012 s); AkiraComplex repaired (9 issues, 8 accepted, 6
resolved, 3 findings, 491 s). Both reproduce their pass-1 statuses
with nondeterministic count drift. Remaining 90.
SECOND ITERATION (2026-07-23, commit `c3ea27b23`), root cause named
by the user: multi-LLM value is OVERLAPPING coverage (A finds a b c,
B finds b c d), and each critic satisfices at 10 to 14 claims per
call regardless of defect density (the user counts 200+ issues on
Anilovr at first glance versus 33 found). Measured corpus-wide:
67 to 84 percent singleton issues across all pass-2 artifacts, so
losing a voice loses its findings nearly one-for-one; the earlier
full-roster-retry idea survives only as secondary hardening, not
the fix. Root-cause fix: PARAGRAPH-BOUND SLICES (user decision:
paragraph-bound, never sentence-bound, because sentence windows
reward mechanical one-to-one rendering over meaning and emotion).
`slice-pair.ts` subdivides each aligned section pair into
budget-bound node runs (never splitting a block node;
SLICE_CHAR_BUDGET 400 target chars; source budget scales by
character share so the denser zh side cannot collapse pairing back
to section scale, a flaw the unit test caught); the whole loop runs
per slice. Evidence base: on DarlinChit-scale units the ensemble
produced a 28-member agreement cluster, so small units yield both
thoroughness and overlap. CONTRACT CHANGE, dominance block: a
2-vote tiny slice must not block a document, so
`blocked-non-translation` now fires only when standing-vote slices
dominate target characters (`assessNonTranslationDominance`);
minority standing slices ship unchanged with findings (per-slice
degradation, matching the settled architecture's never-document-wide
rule). Consequence recorded: shi_Yumiaoya's expected production
outcome changes from blocked to not-blocked with its untranslated
region degraded per slice. `repairChunk` early-exits standing-vote
slices before panel and editor spend (types moved to
`repair-contract.ts` for the line budget). Secondary: critic stage
retries to FULL ROSTER (`retryTarget: 'full-roster'` in
`stage-quorum.ts`), voting stages keep quorum;
`stage-roster-incomplete` finding records shortfalls. Verification:
89 suites pass against dist (slicing byte-exactness, dominance,
per-slice degradation end to end), oxlint 0/0, types clean.
Sentinel probe 2 launched (four entries: XIEPT2 must block via
dominance, shi_Yumiaoya must NOT block under the new contract,
Aniloviraw repaired, Anilovr measures thoroughness against its
33-issue section-scale baseline with the user's 200+ as reference;
log `sentinel-probe-2.log`). Pass 3 restarts from zero on ALL PASS
plus a decisive Anilovr thoroughness gain.
THIRD ITERATION (2026-07-23, commit `666d87602`), user question "is
our union algorithm good" then directive "LLMs must act as part of
union algorithms". Findings from code plus measurement over pass-2
artifacts (192 issues, 3496 same-chunk issue pairs): exact dedupe
can never merge cross-critic claims (free-text summaries differ),
so clustering is the only cross-critic union; the LLM half already
exists (panel ballots carry a sameDefect opinion per multi-member
cluster, majority merges, silence and ties split conservatively
because a wrong merge hides a defect), and the 243 same-family
overlapping-but-separate issue pairs are the panel's judged splits
working as designed. The real gap: the family gate in
`claimsShareDefect` kept 62 overlapping cross-family pairs
(accuracy vs terminology 23, accuracy vs fluency 12, accuracy vs
extension 9...) from ever reaching panel judgment. Fix: proposals
now arise from same-side span overlap alone; neither family nor
severity pre-decides, the panel disposes every proposal. Also
measured: only 3 of 192 issues carry single-side evidence, so the
same-side overlap requirement is not a material union gap. KNOWN
LIMIT recorded: disposal is binary per cluster (merge all members
or split to singletons), so a widened mixed cluster judged "not one
defect" splinters exactly as today, no regression; per-sub-group
disposal is the recorded refinement if graded evidence demands it.
Verification: 89 suites pass, oxlint 0/0, types clean. The running
sentinel probe loaded the pre-union dist at process start and stays
internally consistent; Anilovr gets one re-run on the
current-tip pipeline for the thoroughness gate before pass 3.
NAMING RULE (user directive 2026-07-23): never call any pipeline,
gate, or artifact "final"; the system is early in polishing and
every pass is one iteration among many. Say current-tip,
this-iteration, or name the commit.
FULL-ROSTER CRITIC RETRIES REVERTED (2026-07-23, commit
`78317a93c`, user decision "we shouldn't retry everything until ALL
respond" after the probe ran 70 minutes). Measurement vindicated
the concern only partially: critics answered 7/7 first-round in
nearly every probe slice (one critic retry fired in the whole log),
so the revert costs little; the REAL wall-time sink is the panel,
where the same four voices hit the full 240 s deadline slice after
slice before the retry recovers them. The full-roster mechanism
stays in stage-quorum.ts, tested but unused. SENTINEL PROBE 2: ALL PASS
(2026-07-23, pre-union dist, log `sentinel-probe-2.log`, artifacts
under `probe/`). XIEPT2 blocked in 565 s via dominance early exit
(0 issues, 24 findings); shi_Yumiaoya REPAIRED with 79 issues under
the new contract (untranslated-region slices degraded per slice);
Aniloviraw REPAIRED, 69 issues (up from 44 at section scale);
Anilovr REPAIRED, 130 issues in 2681 s.
THOROUGHNESS GATE MET: Anilovr 130 issues versus its 33-issue
section-scale baseline, a 3.9x gain moving decisively toward the
user's first-glance estimate of 200+; per-entry wall time roughly
doubled (1358 s to 2681 s), the expected slicing cost.
CURRENT-TIP GATE (2026-07-23, Anilovr re-run on the union-widened,
quorum-retry tip, log `gate-anilovr-union.log`): PASS, repaired,
121 issues in 2547 s. Consolidation from 130 is the union working
(3 MIXED-FAMILY merged issues, structurally impossible before the
widening), not lost findings.
UNDER-MERGE CHECK, offline and zero quota: singleton share rose to
89 percent at slice scale, so near-miss anchoring was measured
directly. Same-slice issue pairs by nearest-span gap: 361
overlapping (proposed and SPLIT by the panel, its conservative
disposal working), 309 within 1 to 20 chars, 324 within 21 to 60.
Sampling the 1-to-20 band showed every pair is a genuinely
DISTINCT defect on adjacent text (untranslated Esperanto phrase
beside an added sentence; preposition error beside a CJK
quotation-mark convention issue; heading mistranslation beside a
nuance shift), so proximity inside a small slice is adjacency, not
duplication. Widening the merge neighborhood would OVER-merge.
Verdict: the union algorithm is sound at slice scale and the high
singleton share reflects real defect density; no further union
iteration warranted on current evidence.
PASS 3 STARTED then STOPPED after two entries (2026-07-23): the
translation-policy directive below landed while it ran, so its
artifacts were discarded rather than spend quota on a superseded
prompt.

TRANSLATION POLICY, USER DIRECTIVE (2026-07-23, commit
`4bab4412c`). Two standing rules, now baseline prompt policy (the
architecture always held that policy files are optional and the
system must work without them; these are the first policy rules
the user has stated directly):
1. A phrase the ORIGINAL writes in a language other than its own
   keeps that original wording in the TRANSLATION and carries its
   meaning ALONGSIDE, side by side. Never replaced by meaning
   alone, never left bare. New category
   `policy/foreign-phrase-gloss`, distinct from
   `accuracy/untranslated` because the remedy differs: gloss beside
   preserved wording, not replacement. Prompted by a real finding
   on Anilovr, where a critic flagged an Esperanto line as
   `accuracy/untranslated`, whose remedy would have destroyed the
   original wording.
2. Prioritize emotional completeness and naturalness over
   one-to-one meaning correspondence. Critics must not report
   non-literal renderings as defects, and must report flattened
   voice, warmth, humor, irony, grief, or intimacy as the new
   `style/emotional-flattening`; stiff literal renderings are
   `style/awkward-phrasing` even when every word matches. Editors
   recast wording, sentence boundaries, and clause order freely to
   serve the feeling. Two guards keep this from becoming license:
   "Naturalness never licenses dropping content" pairs with the
   existing clause-enumeration rule, and "Never introduce content
   the ORIGINAL does not support" stays (milestone two measured
   embellishment as a real failure mode).
Taxonomy growth is safe: `remapCategoryLeaf` derives owners from
the category list, so no exhaustive map needed updating.
Verification: 91 suites pass, oxlint 0/0, types clean; the prompt
suites now assert both policies in both directions.
POLICY GATE, Anilovr (2026-07-23, log
`gate-anilovr-policy.log`): PASS, repaired, 114 issues, 2608 s.
The policy fired as designed: 5 `policy/foreign-phrase-gloss` and
5 `style/emotional-flattening` claims, ZERO `accuracy/untranslated`
(the miscategorization that prompted the directive is gone), and
the Esperanto line ships preserved with its meaning beside it:
`//La homa mondo devus esti detruita (The human world should be
destroyed)//`. Exactly the requested side-by-side shape.
ONE OVER-APPLICATION MEASURED: the same stylized quote kept its
CJK clause with a gloss (`我会在参宿四上等你 (I will wait for you at
Betelgeuse)`), but Chinese is the ORIGINAL's own language, not a
foreign phrase, so the rule does not cover it. Scope is bounded:
whole-page CJK went 6 to 15 chars, one phrase, one line; the only
other CJK line holds proper names already present in the input.
Risk if systematic: preserved CJK in English pages is exactly the
`accuracy/untranslated` signal the non-translation detector reads,
so unchecked spread could interact with blocking. Resolution is a
values question about memorial presentation (the quote is the
person's own last words), not a measurable one, so it went to the
user.
USER PICK (2026-07-23): render source-language text into English
like ordinary prose; only genuinely third languages get
preserve-plus-gloss, including inside quotations and stylized
multilingual lines. Rejected alternatives recorded: preserve CJK
with a gloss everywhere, and a quoted-blockquote-only carve-out.
SCOPING FIX (commit `4b8fd64c8`): both prompts now carry the
explicit negative, "The ORIGINAL's own language is never such a
phrase", with the quotation and stylized-line cases named so the
exception cannot spread; prompt tests assert it in both files.
Verification: 91 suites, oxlint 0/0, types clean. Second policy
gate on Anilovr (log `gate-anilovr-policy2.log`): PASS, repaired,
92 issues, 2795 s. Both goals confirmed and no over-correction:
the Esperanto stays glossed (4 gloss claims, gloss retained
`//La homa mondo devus esti detruita// (The human world should be
destroyed)`), and the stylized quote's Chinese clause now renders
to English ("I will wait for you at Betelgeuse"). Whole-page CJK
went 6 to 0: the editor also romanized two proper names the input
carried in characters (方方 to Fang Fang, 铃木真依 to Mai Suzuki),
flagged as one `accuracy/untranslated` and resolved. That is
consistent with the render-source-into-English pick, not a new
over-application, and it clears the non-translation-detector
interaction entirely (no residual CJK to read as untranslated).
PASS 4 starting from zero on this tip.
INCIDENT AND RECOVERY (2026-07-24): the user accidentally ran
`rm -rf ${HOME}/temp`, wiping the old out-of-repo run dir
`${HOME}/temp/translation-repair-corpus/` (driver, sentinel probe,
all pass-4 artifacts, and `pass4-run-001.log`) mid-run. Nothing
irreplaceable was lost: the pipeline code, this handover, and every
recorded decision live in git, and the corpus was never in `${HOME}/temp`
(it reads live via `git show` at the pinned SHA from
`${HOME}/one-among-us/data`, verified readable post-incident). Only
regenerable scaffolding and one interrupted pass's artifacts went with it.
Recovery: rebuilt the driver and probe grounded in the module's exported
API (`listCorpusPeople`, `readCorpusFile`, `createSyntheticClient`,
`repairTranslation`), not memory; relocated them plus artifacts to the
durable gitignored dir `node_modules/.monochromatic/translation-repair-runs/`
(user's suggestion; see "Where work lives"). Verified at zero quota with
`--plan`: pending 92 (tdor excluded by the complete-pair filter, no
hardcoded exclusion), key injected, client constructs. Added AGENTS.md
rules TMP (`${HOME}/temp` is ephemeral, keep only reconstructable
scaffolding) and NMD (durable uncommittable state goes in
`node_modules/.monochromatic/`), regenerated CLAUDE.md, commit
`1831230e0`. Pass 4 run 001 relaunched on that tip; the pipeline itself
is unchanged from `63baaa686`, so accumulation resumes exactly where it
would have.
WORKTREE MOVE AND SOURCE PROMOTION (2026-07-24): the user flagged that a
worktree under the repo's `.claude/` risks the same stray-cleanup loss as
`${HOME}/temp`, so the worktree moved via `git worktree move` from
`.claude/worktrees/translation-repair` to `${HOME}/worktrees/translation-repair`
(same filesystem, a rename; HEAD and all run outputs moved with it; `mise trust`
re-run at the new path). Then, per "driver and probe should be source code" and
"put them under src/<category>", the driver and probe were promoted from
gitignored `.mjs` scaffolding to committed TypeScript under
`src/corpus-run/` (`run-config.ts`, `corpus-pass.ts`, `sentinel-probe.ts`),
importing the pipeline from sibling source, `import.meta.main`-guarded, run via
new package mise tasks `corpus-pass` and `sentinel-probe`. Only run OUTPUTS stay
gitignored in `node_modules/.monochromatic/translation-repair-runs/`. See "Where
work lives". Only run OUTPUTS stay gitignored in
`node_modules/.monochromatic/translation-repair-runs/`.
RESOLVED (2026-07-24, commit `92f7b2c55`): the new source is green (format,
oxlint 0/0, types), `--plan` runs through the mise task (pending 92, tdor
excluded, client constructs, zero quota), the old `.mjs` copies are deleted, and
`buildAndTest` passes so the library is unregressed by the addition. Pass 4 run
002 relaunched via `mise run //package/module/translation-repair:corpus-pass`
(log `node_modules/.monochromatic/translation-repair-runs/pass4-run-002.log`) on
tip `92f7b2c55`; the pipeline behavior is unchanged from `63baaa686` (the
intervening commits are docs, the worktree move, and this source promotion, none
touching pipeline logic), so this continues pass 4 accumulation. The persisted
`attempts.json` survived, so entries attempted-but-never-settled by the wiped
runs (e.g. Acheron) now sort after the untouched zero-attempt entries.
PASS 4 RUN 002 (2026-07-24, tip `92f7b2c55`, 2110s wall, soft budget hit):
processed 2 of 92, artifacts 2/92. `AmbeR_the_anpa` repaired (61 issues, 58
accepted, 58 resolved, 0 findings, 2028s ~34min ALONE, consuming the whole soft
budget; the top-of-loop soft check stopped new entries after it). `AkiraComplex`
blocked-non-translation (0 issues, 4 findings, 62s) is a VERIFIED FALSE BLOCK:
its en page is a faithful translation of the zh (checked directly against the
pinned corpus). Findings were `empty-quote (source)` x2, `non-translation votes
stand (2/7 heard); slice unchanged`, `non-translation dominance (561 of 590
target chars)`. Root cause: only 2 of 7 critics were HEARD on the dominant
slice and both voted non-translation, meeting the ABSOLUTE
`NON_TRANSLATION_BLOCK_VOTES=2` threshold (`non-translation-evidence.ts`); 5
silent critics gave no counter-signal, so a bare 2 votes blocked despite no real
ensemble agreement. Likely trigger: the page opens with an English epigraph that
is English in BOTH zh and en source, so a slice reads as "source == target, not
a translation" to a critic. HIGH-CONFIDENCE ISSUE, fix deferred for careful
calibration (do not just lower/raise the constant blindly): the severe block
(discards all repair, returns input) must require genuine ensemble agreement,
not a bare count a low-participation slice can satisfy. Candidate fixes, each
with a tension to resolve against the KNOWN TRUE-POSITIVE case (zh cat story vs
"Meow meow meow": GLM + gpt-oss + Qwen, i.e. 3 of 7, all flagged
non-translation, one failing to anchor): (1) require a MINIMUM critics-heard
count on the slice before any block (2/7 heard is too few to make a severe call;
degrade instead) -- cleanest, targets the failure mode directly, needs the
minimum chosen so the 3/7 true case still blocks when those 3 are among the
heard; (2) require non-translation votes as a fraction of the FULL roster
treating silent critics as not-non-translation (e.g. >= 3) -- must not exceed 3
or it breaks the true case; (3) both. The English-epigraph-in-both trigger is a
second, orthogonal seam (a slice whose source and target are identical English
should never count as non-translation evidence). NEXT ACTION: design and land
this with full context, add unit tests over the participation cases, validate on
`AkiraComplex` (expect: no longer blocked) via `sentinel-probe -- AkiraComplex`
plus the true-positive fixture, then restart the pass. Accumulation is PAUSED
(run 003 not launched) because a fix+restart discards further runs; resume only
if choosing progress-under-current-pipeline over the fix.
USER PICK (2026-07-24): "Always land the fix now then restart." This is a
STANDING refinement of the improve-and-restart directive: context pressure is
NOT a reason to defer a verified high-confidence fix; land it, do not park it for
a fresh session. Recorded so future sessions do not re-offer "defer".
FIX LANDED (2026-07-24, commit `342f9caa5`): `NON_TRANSLATION_BLOCK_VOTES` raised
2 -> 3 in `non-translation-evidence.ts`. Three wire votes is genuine ensemble
agreement and, because three votes cannot come from fewer than three critics
heard, folds a participation floor into the count so a low-participation slice
(AkiraComplex's 2/7) can never block; three is the observed true-positive floor
(cat/"meow" drew three) and errs safe (a missed block attempts repair with issues
still surfaced; a false block discards a faithful translation whole). The block
decision was extracted from an inline expression in `repair-chunk.ts` into a
named, exported `nonTranslationVotesStand({votes, contradicted})` with regression
unit tests (2 votes below floor do not stand; 3 uncontradicted stand; 3
contradicted do not). `downgradeCount` moved to sibling `downgrade-count.ts` to
keep `repair-chunk.ts` under the 300-line budget. Verified: build, format 0/0,
lint, types, unit tests all green. Live sentinel-probe on AkiraComplex is the
final confirmation before restart. This makes the restarted pass a NEW pass
(pipeline behavior changed); prior pass-4 artifacts are discarded.
FIX CONFIRMED LIVE (2026-07-24): `sentinel-probe -- AkiraComplex` returned
status=repaired (21 issues, 21 accepted, 1 finding, 421s), up from
blocked-non-translation: the false block is gone end-to-end. Artifacts and
`attempts.json` wiped for a clean restart. PASS 5 RUN 001 launched on tip
`b3fdf6e4c` (log `pass5-run-001.log`); this is the current accumulation pass
under the three-vote non-translation block. Loop continues per task 30: record
each run's tallies content-free, commit, launch the next, until all 92 settle,
landing any further verified high-confidence fix immediately (restarting) per
the standing rule.
PASS 5 RUN 001 (2026-07-24, tip `b3fdf6e4c`, 1906s wall, soft budget hit):
2 dispatched, 2 completed, 0 failed. Acheron repaired (56 issues, 55
accepted, 54 resolved, 18 findings, 1464s); AkiraComplex repaired (13
issues, 13 accepted, 12 resolved, 1 finding, 442s). AkiraComplex is the
headline: the three-vote block holds in the full pass exactly as the probe
predicted -- the once-false-blocked slice now repairs cleanly, no
regression elsewhere. Acheron alone ate the 25-min soft budget, so the
top-of-loop check stopped new entries after it; the two artifacts persist,
attempts.json carries {Acheron:1, AkiraComplex:1}. No new high-confidence
fix surfaced; loop continues, launching run 002 on the same tip.
PASS 5 RUN 002 (2026-07-24, tip `94b031cae`, 2088s wall, soft budget hit):
1 dispatched, 1 completed, 0 failed. AmbeR_the_anpa repaired (49 issues,
45 accepted, 44 resolved, 6 findings, 2088s) -- a single large document
that overran the 25-min soft budget on its own, so no second entry
dispatched. 3/92 settled. No new fix surfaced; run 003 launched on tip
`94b031cae` (same, since only the handover moved).
PASS 5 RUN 003 (2026-07-24, tip `0384097b7`, 1806s wall, soft budget hit):
1 dispatched, 1 completed, 0 failed. Aniloviraw repaired (26 issues, 26
accepted, 25 resolved, 13 findings, 1806s) -- the once-false-blocked
divergence-heavy pair, repairing cleanly again. One transient event: five
of seven critics (Qwen3.6-27B, Kimi-K2.7-Code, MiniMax-M3, Nemotron-3,
gpt-oss-120b) hit the 240s deadline together on a single slice at
10:14:54Z; that slice heard only two critics, the pipeline degraded
gracefully via quorum, and the entry still repaired. Reads as an API-side
slowdown burst, not a code fault -- logged, no fix triggered. 4/92 settled.
Run 004 launched on tip `0384097b7`.
PASS 5 RUN 004 (2026-07-24, tip `5f60a1b55`, 2540s wall, near hard cap):
1 dispatched, 1 completed, 0 failed. Anilovr repaired (95 issues, 95
accepted, ALL 95 resolved, 34 findings, 2540s) -- the largest document
yet by issue count, running ~42 min, just under the 45-min hard cap. Two
critic timeouts (Nemotron-3, gpt-oss-120b) on one slice, again absorbed
by quorum with no effect on the outcome. A perfect 95/95 accept-and-
resolve is a strong signal but exactly the kind of number the milestone-
three human grade exists to check, not to trust on its own. 5/92 settled.
Run 005 launched on tip `5f60a1b55`.
PASS 5 RUN 005 (2026-07-24, tip `20a66e58b`, 1769s wall, soft budget hit):
3 dispatched, 3 completed, 0 failed. BI4PBV repaired (42 issues, 38
accepted, 37 resolved, 16 findings, 1498s). ArtsEpiphany unchanged (0
issues, 15s) -- correct: a 120-char placeholder stub whose desc is blank
by intent and whose source equals its target, nothing to repair. Arita
BLOCKED-non-translation (0 issues, 14 findings, 255s) -- the FIRST block
under the three-vote regime, and it demanded investigation before the
loop could continue.
ARITA DIAGNOSIS (2026-07-24): a FALSE block, but from a slice-alignment
defect, not the vote threshold. Arita is a genuine translation (rich zh
biography, faithful en). Deterministic node dump proved both sides carry
exactly 13 nodes corresponding 1:1, yet `subdivideChunkPair` mis-paired
them with a one-paragraph drift, so critics correctly read each mismatched
slice as non-translation and 6-7 of 7 voted -- genuine ensemble agreement
on genuinely mispaired input. Root cause: the slicer grouped each side
independently with different budgets (source scaled ~150, target 400);
small adjacent nodes merged at different indices per side, run counts
diverged (12 vs 11), and the character-fraction merge pulled an extra
source run into slice 0, shifting every later slice by one. This is the
common case (translations preserve paragraph structure), so the defect
likely mis-sliced many entries subtly; Arita was pathological because the
drift made EVERY slice a mismatch.
ARITA FIX (2026-07-24, commit `7a5117727`): `groupNodesLockstep` -- when
both sides carry equal node counts, group them together, extending a slice
to the next shared index only while BOTH sides stay within budget, so
slice N always holds the same node indices on both sides. Genuine
paragraph-count mismatch still falls back to the existing monotone merge.
Correct by construction for the equal-count case; surgical (unequal counts
untouched). Verified deterministically: an engineered equal-count marker
fixture drifted under the old code (src[M0] vs tgt[M0,M1]) and pairs 1:1
under the new; the real Arita content now slices 1:1 (简介/Introduction,
intro/intro, band/band ... every slice a true pair). Unit test
`pairs equal node counts in lockstep without off-by-one drift (Arita
regression)` added; format/lint/types/unit all green. Live confirmation:
`sentinel-probe -- Arita` returned status=repaired (123 issues, 114
accepted, 7 findings, 4110s) with 0 non-translation votes on every critic
stage -- the false block gone end-to-end.
ARITA FIX BLAST RADIUS (2026-07-24, deterministic corpus survey, zero
quota): across the 92 usable entries, 182 of 284 aligned chunk-pairs
(64%) carry equal node counts and so take the lockstep path; replaying the
old independent-budget grouping, 68 of those 182 pairs -- spread over 46
of the 92 entries -- had divergent per-side run boundaries, i.e. the old
code actually mis-sliced them. Most drifted entries still REPAIRED before
(Acheron, AkiraComplex, BI4PBV are in the drifted set) because partial
drift only mispairs some slices; Arita was the pathological all-slices
case that blocked. So the fix corrects slicing on 68 pairs across half the
corpus, but the ONLY confirmed end-to-end outcome change is Arita
(block->repair); alignment is now provably more correct on those pairs,
while any issue-set or quality effect is unmeasured and waits on the
milestone-three human grade. Survey scripts in the session scratchpad
(nodecount-survey.mjs, drift-survey.mjs) reproduce the counts.
PASS 6 RUN 001 (2026-07-24, tip `973ca8235`, 1556s wall, soft budget hit):
1 dispatched, 1 completed, 0 failed. Acheron repaired (46 issues, 45
accepted, 44 resolved, 4 findings, 1556s). Data point on the corrected
slicing: Acheron is in the drifted set, and its numbers moved from pass-5
old-slicing (56 issues, 55 accepted, 54 resolved, 18 findings) to 46/45/44
with findings down 18->4. Factual: the issue set changed and finding-noise
dropped under 1:1 alignment; whether that is higher quality is for the
grade, not this delta. 1/92 settled. Run 002 launched on tip `6a58ababf`.
PASS 6 RUN 002 (2026-07-24, tip `edc7959bf`, 2620s wall, soft budget hit):
2 dispatched, 2 completed, 0 failed. AkiraComplex repaired (32 issues, 28
accepted, 28 resolved, 1 finding, 698s); AmbeR_the_anpa repaired (44
issues, 42 accepted, 42 resolved, 4 findings, 1923s). Both in earlier
passes too; no blocks under lockstep. 3/92 settled. Run 003 launched.
PASS 6 RUN 003 (2026-07-24, tip `8459fd92d`, 1764s wall, soft budget hit):
1 dispatched, 1 completed, 0 failed. Aniloviraw repaired (52 issues, 52
accepted, all 52 resolved, 10 findings, 1764s) -- the original
contradiction-screen false-block entry, repairing cleanly again. 4/92
settled. Run 004 launched.
PASS 6 RUN 004 (2026-07-24, tip `f08bd3996`, hard cap hit): Anilovr
status=ERROR, aborted at 2700002ms (the 45-min HARD_CAP), 0 processed.
Diagnosis (NOT a regression, NOT a fix trigger): the log shows transport
`terminated` failures with retries plus two critic timeout bursts, and
only 6 of 7 slices finished in 45 min -- a bad API window at ~20:27Z, not
a workload change. Deterministic slice-count check (anilovr-slices.mjs)
proves it: Anilovr produces 7 slices under BOTH old and lockstep code
(delta=0; Arita +1, Acheron/AmbeR 0), and it repaired fine in pass-5 run
004 at 2540s with those same 7 slices. Self-heals by design: no artifact
written so Anilovr stays pending, but its attempt count went to 1, so the
fewest-attempts order now processes the 87 zero-attempt entries first and
retries Anilovr later (hopefully a calmer API window). Still 4/92 settled.
Run 005 launched.
PASS 6 RUN 005 (2026-07-24, tip `9c86aebf1`, hard cap hit): Arita
status=ERROR, aborted at 2700003ms, 0 processed. This one is SYSTEMATIC,
not transient: the earlier live probe showed Arita legitimately takes
4110s (~68 min) for its 12 slices, which exceeds the 45-min cap, so Arita
can never settle as configured. Still 4/92 settled.
CORPUS-PASS BUDGET FIX (2026-07-24, commit `5b74bd7b2`): two problems
surfaced. (1) The hard ceiling was armed ONCE for the whole loop, so its
abort signal was shared -- an entry starting near the soft budget got only
the sliver left before the cap. Fixed: a fresh `armCallDeadline` per entry
(disposed via `using`, since try/finally is lint-banned), so each entry
gets its full budget regardless of start time. (2) 45 min was too tight;
raised HARD_CAP to 90 min (per entry), clearing every entry up to ~16
slices at the measured ~5.5 min/slice. Driver-only; repair results and the
4 settled artifacts unaffected, so NO restart. Verified: format/lint/types
0/0 and a `--plan` run (zero quota) shows hard=5400000ms.
LARGE-ENTRY TAIL (2026-07-24, deterministic slice survey
slice-distribution.mjs): the corpus slice-count distribution is
median 8 but long-tailed -- aiyysk 77 slices, hulicaijia 65, shihai4h 45,
interrgned 43, NIGHT81473140 41, Xu_Yushu 35, XingZ60 31, Dethelly 24;
total 1129 slices over 92 entries. At ~5.5 min/slice the biggest need
multiple HOURS end to end, so ~10 entries cannot complete in ANY bounded
single-run cap. The 90-min cap settles the ~80 smaller entries; the tail
needs slice-level RESUMABILITY (cache completed slices, resume across
runs) -- a change to the pure function's contract (inject a slice cache,
like the client is injected). Flagged to the user as a decision before
building. Meanwhile run 006 relaunches so the bulk keeps settling; huge
entries waste one 90-min attempt then deprioritize (attempts already 1 for
Anilovr/Arita).
PASS 6 RUN 006 (2026-07-24, tip `47ba504a3`, 3034s wall): 3 dispatched, 3
completed, 0 failed. ArtsEpiphany unchanged (0 issues, 8s, the placeholder
stub again); BI4PBV repaired (38 issues, 37 accepted, 36 resolved, 5
findings, 1437s); Barron12312 repaired (49 issues, 46 accepted, 46
resolved, 2 findings, 1590s). The per-entry cap did its job -- three
entries packed before the soft budget instead of one blocking the run.
7/92 settled. Run 007 launched.
USER PICK (2026-07-24): the large-entry tail is solved with SLICE-LEVEL
RESUMABILITY (chosen over a very high atomic cap or reducing per-slice
cost). Plan: inject an optional slice cache into repairTranslation (keyed
by deterministic slice content hash), persist each completed slice, resume
across runs; driver supplies a disk-backed cache under the runs dir. Build
next, additive so the bulk keeps running on current code meanwhile.
RESUMABILITY LANDED (2026-07-24, commit `bfc3f6449`): `SliceCache`
(`{ resumed: ReadonlyMap<hash, ChunkRepairOutcome>, persist(key,
serialized) }`) injected optionally into `repairTranslation`; the slice
loop keys each slice by `hashContent([chunkIndex, sourceText,
targetText])`, reuses a resumed outcome (zero model calls) or computes then
persists it. Driver helper `corpus-run/slice-cache-store.ts`
(openSliceCache / discardSliceCache) writes one JSON per slice under
`node_modules/.monochromatic/translation-repair-runs/slice-cache/<entry>/`,
guards each file (a half-write recomputes), and drops the dir on settle. A
huge entry (aiyysk 77 slices) now completes over several 90-min attempts
instead of losing all work each abort -- it deprioritizes between attempts
but caches ~16 more slices each. Persist takes a SERIALIZED STRING, not the
outcome object, because the repo BANS disabling
prefer-readonly-parameter-types (rule no-disable-prefer-readonly-
parameter-types); a string param sidesteps it, the pipeline owns
serialization, the driver writes bytes. Additive and result-preserving
(unit test: the resumed run makes 0 model calls and reproduces the fresh
result), so settled artifacts stay valid and NO restart.
RESTART NOTE (IMPORTANT): the slice-cache stores repairChunk OUTCOMES, so a
PIPELINE change makes it stale. The restart/wipe routine now clears THREE
things together: `artifacts/`, `attempts.json`, AND `slice-cache/`.
Content-hash keys already self-invalidate on a slicing change, but wipe all
three anyway. Verified format/lint/types/unit 0 and `--plan` runs. Run 007
was already in flight on pre-resumability code (per-entry cap, no cache);
it finishes normally, then run 008 launches with resumability.
PASS 6 RUN 007 (2026-07-24, tip `c4cfe103b`, 3119s wall): 1 dispatched, 1
completed, 0 failed. Chinatsu_Suzuki repaired (77 issues, 77 accepted, all
77 resolved, 4 findings, 3119s ~52 min) -- an entry that would have hit
the old 45-min per-run cap but fits the 90-min per-entry budget; the cap
fix earned its keep. 8/92 settled. Run 008 launched WITH resumability
active (tip after the resumability commits).
PASS 6 RUN 008 (2026-07-24, tip `ed5936126`, 3079s wall, resumability
live): 1 dispatched, 1 completed, 0 failed. Considerate_cat repaired (50
issues, 41 accepted, 40 resolved, 11 findings, 3079s). Resumability
cleanup verified in production: the slice-cache dir is empty after the run
because the settled entry's cache was discarded as designed. 9/92 settled.
Run 009 launched.
PASS 6 RUN 009 (2026-07-24, tip `7c3cca379`, 1634s wall): 1 dispatched, 1
completed, 0 failed. CuspariaKLSY repaired (74 issues, 70 accepted, all 70
resolved, 6 findings, 1634s). 10/92 settled. Run 010 launched.
PASS 6 RUN 010 (2026-07-24, tip `d1d2f2c52`, 2505s wall): 2 dispatched, 2
completed, 0 failed. CutOceanHeyFis1 repaired (19 issues, 19 accepted, 18
resolved, 5 findings, 1182s); DarlinChit repaired (46 issues, 40 accepted,
40 resolved, 20 findings, 1323s). 12/92 settled. (Run 010's first launch
was killed by a transient harness hiccup right after the run-009 commit
landed; relaunched standalone. Going forward: commit foreground, launch
corpus-pass as its own background command.) Run 011 launched.
COVERAGE-BAR DECISION (2026-07-25, user-approved): task 30's completion bar
changed from "all 92 settled" to STRATIFIED REPRESENTATIVE COVERAGE
(~10/10/10 across small/medium/large size bands). Rationale: the M3 gate is
human-graded precision on a uniform 50-issue sample; 12 settled entries
already yield hundreds of accepted issues, so sample SIZE was satisfied long
ago and the full-92 pass was never load-bearing for it. What the gate needs
is a REPRESENTATIVE sample, and the pool was skewed small -- 9 small / 2
medium / 1 large by page.md byte-size tertiles (small <=1.8KB, medium
1.8-3.6KB, large >=3.6KB up to 40.7KB), with the single large entry sitting
at the bottom of its band. The heavily-sliced large tail -- exactly where
the lockstep slicing fix most affects precision -- was un-sampled. Target:
~10 settled per band (need ~1 small, ~8 medium, ~9 large), large picks
spread across the band; then draw the 50-issue sample STRATIFIED by band.
The skew is a throughput artifact: small entries finish inside one run while
large ones consume it, so equal wall-clock settles many small + few large.
DRIVER FIX (same day, DRIVER-ONLY so NO restart/wipe -- repair outputs per
entry are identical): corpus-pass now sorts the small band LAST in `pending`
(`SMALL_PAGE_BYTES=1843`, measuring page-source bytes via TextEncoder),
then fewest-attempts within a band, so run budget flows to medium+large;
small still settles once larger bands are served (deprioritize, not
exclude). Verified format/lint/types 0/0/0 and `--plan` first-5 pending all
non-small (Everythings99 1859B .. Huasheng 7397B). Run 011 was already in
flight on the old order and finishes normally; run 012 onward uses the new
order. Task 30 subject/description updated to match.
PASS 6 RUN 011 (2026-07-25, tip `e032fa453`, hit the per-entry 90-min cap):
0 settled, still 12/92. Dethelly (6171B, large band) processed 13
chunks/slices then aborted at the hard ceiling (TALLY status=ERROR
aborted=true, Timeout). FIRST cap-abort since resumability landed: all 13
finished slices persisted to `slice-cache/Dethelly/` and the cache was
correctly RETAINED on abort (discard is success-only). This exposed an
ordering flaw -- `attempts[Dethelly]` incremented to 1 and the within-band
tiebreak was fewest-attempts-first, so Dethelly sorted BEHIND every
0-attempt non-small entry; run 012 would have started a fresh entry and
left the 13 cached slices idle, and every big-large entry would take one
partial attempt with none finishing, starving exactly the entries that most
need resume and defeating the "large spread across band" goal.
RESUME-FIRST FIX (driver-only, no restart): added `listResumableEntries`
(slice-cache-store.ts) returning ids whose cache dir holds >=1 finished
slice; corpus-pass now sorts those FIRST (before band, before attempts) so
an in-flight large document finishes before a fresh one starts. Safe against
livelock because `repairChunk` never throws -- every failure path (votes
stand / no claims / no envelopes / no surviving ops / lost voices) returns
an unchanged outcome that gets persisted, and a cap-abort always completes
>=1 new slice; the only residual (a deterministic pure-function throw at
some slice) would surface as a repeated same-entry ERROR and is caught by
per-run inspection, not silently absorbed. Verified format/lint/types 0/0/0
and `--plan` first=Dethelly,Everythings99,... (resumable sorts first).
VERIFICATION CAVEAT (do NOT overstate): only the PERSIST-on-abort half of
resumability is proven in production (the 13 files exist). The RESUME half
-- next run reads them back, skips them with ZERO model calls, continues on
new slices, settles, and DISCARDS the cache -- has never run. Run 012 is its
first real test. Watch run 012 for: Dethelly starts near-instantly, no
critic/panel/editor/checker calls on the 13 cached chunks, continuation on
chunk 13+, a settle, then `slice-cache/Dethelly/` GONE. Only after seeing
that is resumability end-to-end validated. Run 012 launched.
PASS 6 RUN 012 (2026-07-25, tip `90809eeed`, 3958s wall ~66 min): 1 settled,
13/92. RESUMABILITY END-TO-END VALIDATED IN PRODUCTION. Resume-first put
Dethelly at the front (START/--plan confirmed); the log shows `6 chunk
pairs, 24 slices`, the 13 cached slices (chunks 0-12) skipped with ZERO
stage/model logs, the FIRST critic stage firing at chunk 13, then
continuation through slice 23, then TALLY status=repaired (391 issues, 373
accepted, 364 resolved, 100 findings). Post-settle the `Dethelly.json`
artifact is present AND `slice-cache/Dethelly/` is GONE (cache root empty):
the full skip->continue->settle->discard cycle observed. Both halves now
proven -- persist-on-abort (run 011) and resume+discard (run 012). The
resume-first ordering also proved correct: run 012 processed only Dethelly
(it started past the 25-min soft budget) and ended. Dethelly is large-band,
so large settled 1->2 (Chinatsu_Suzuki ~5.2KB, Dethelly ~6.2KB -- both
mid-large; bigger large entries still needed for band spread). Run 013
launched (no resumable entries remain, so it picks the first non-small
0-attempt entry by band order).
PASS 6 RUN 013 (2026-07-25, tip `54eb8c323`, 1529s wall ~25 min): 1 settled,
14/92. Everythings99 repaired (32 issues, 31 accepted, 31 resolved, 1
finding); settled in one run, no cap, cache empty after. First non-small
0-attempt entry by the new band order (1859B, bottom of the medium band),
so medium settled 2->3. Bands now 9 small / 3 medium / 2 large. Run 014
launched.
PASS 6 RUN 014 (2026-07-25, tip `a70cb3592`, 4867s wall ~81 min): 1 settled,
15/92. Futajuhuacha repaired (5448B/large, 248 issues, 243 accepted, 238
resolved, 59 findings); settled in ONE run just under the 90-min cap, no
abort, cache empty after. Large settled 2->3 (a large entry that fits the
single-run budget -- only the biggest large entries, >~6-12KB, need resume).
Bands now 9 small / 3 medium / 3 large. Run 015 launched.
PASS 6 RUN 015 (2026-07-25, tip `3a119f095`, 5194s wall ~87 min): 1 settled,
16/92. Huasheng repaired (7397B/large, 235 issues, 227 accepted, 226
resolved, 40 findings); settled in ONE run right at the 90-min cap ceiling.
Large settled 3->4 (all four are mid-large 5.2-7.4KB; entries above ~7.4KB
will start capping and needing resume). Bands now 9 small / 3 medium / 4
large. OPERATIONAL NOTE: run 015's FIRST launch was chained onto the commit
with a bare `&` (untracked) -- no completion notification, and the tracked
watcher I added was itself killed after ~1 min. Fixed by killing the
untracked run (0 slices lost, killed mid-first-chunk on GLaDOSister; its
empty cache dir removed) and relaunching run 015 as its own
`run_in_background` task. GLaDOSister carries a wasted attempt=1 from that
kill, so it sorts one slot behind the 0-attempt entries (harmless, still a
needed medium). RULE: launch corpus-pass ONLY as a standalone tracked
background command, never a bare `&` chained after another command. Run 016
launched.
PASS 6 RUN 016 (2026-07-25, tip `8eddd3906`, 4016s wall ~67 min): 1 settled,
17/92. Jennife80677612 repaired (3859B/large-bottom, 84 issues, 78 accepted,
76 resolved, 11 findings); one run, no cap. Large settled 4->5 (all five
still lower-large 3.9-7.4KB; bigger large entries still ahead). Bands now 9
small / 3 medium / 5 large. Run 017 launched.
PASS 6 RUN 017 (2026-07-25, tip `7719f975f`, ~77 min effective on the third
launch): 2 settled, 19/92. KILL SAGA + resume-across-external-kill validated.
Run 017's first launch (tracked) ran ~16 min on Katerina, finishing chunks
0-2, then was KILLED (external, non-resource: load ~1.3, 33Gi free, no OOM);
Katerina's 3 slices persisted. Relaunch died at START (~1 min, another
transient kill), zero progress, 3 slices intact. THIRD launch survived ~77
min and settled TWO entries: Katerina RESUMED (`8 slices`, first completion
`chunk 3` -- the 3 cached chunks skipped with zero model calls, so resume is
now proven across an EXTERNAL KILL, not just a cap-abort; ~18 min, 70 issues
66 accepted 65 resolved) then Kotori fresh (~59 min, 138 issues 129 accepted
126 resolved). Both are medium (Katerina 2.2KB, Kotori 2.4KB), so medium
3->5. LESSON: the intermittent background-task kills seen this session (runs
010/011 first launches, a watcher, run 017 x2) are HARMLESS under
resumability -- each costs at most the in-flight slice; on a `killed`
notification just relaunch and resume-first continues the entry. Recomputed
band totals over all 19 settled: small 9/30 (need ~1), medium 5/31 (need
~5), large 5/31 (need ~5); large still all lower-band 3.8-7.2KB, bigger
large entries (9-40KB, will cap and need multi-run resume) still ahead. Run
018 launched.
PASS 6 RUN 018 (2026-07-25, tip `0fa06bd7e`, 3096s wall ~52 min): 1 settled,
20/92. LCG_Akiball repaired (large, 89 issues, 83 accepted, 82 resolved, 8
findings); one run, no cap. Large settled 5->6. Bands now 9 small / 5 medium
/ 6 large (need ~1 small, ~5 medium, ~4 large). Run 019 launched.
PASS 6 RUN 019 (2026-07-25, tip `5063a3740`, 4254s wall ~71 min effective;
first launch killed at START, 0 loss, empty MTF_0615 cache dir removed):
1 settled, 21/92. MeowBot233 repaired (medium, 206 issues, 198 accepted, 198
resolved, 23 findings); one run, no cap. Medium settled 5->6. Bands now 9
small / 6 medium / 6 large (need ~1 small, ~4 medium, ~4 large). Run 020
launched.
PASS 6 RUN 020 (2026-07-25, tip `55b0dd444`, 2257s wall ~38 min): 1 settled,
Mio status=blocked-non-translation (93 accepted issues, 0 resolved). FALSE
BLOCK discovered and fixed (commit `398007d4c`). Mio's en page is a faithful
translation that ALSO translates its embedded images -- WeChat chat logs,
Twitter posts, and a final chat that the zh page.md carries only as
`<PhotoScroll>` photos, so that translated-image text has NO zh-markdown
counterpart. Its slices correctly drew non-translation votes (chunks
5,6,8-12, all 7/7), and at 5342 of 7778 target chars (69%) they tripped the
bare char-majority dominance rule and discarded the whole document, even
though chunks 0,1,2,7 are clean repaired translations. VERIFIED SYSTEMIC via
a scan of all 22 artifacts: Futajuhuacha and Huasheng each carry 8 standing
slices too (same as Mio) and only escaped because their standing chars
stayed under half; every entry with standing slices also has clean chunks
(Mio 5, Futajuhuacha 11, Huasheng 13, Dethelly 22, Kotori 10). This is the
4TH real-corpus non-translation block this session (Aniloviraw, AkiraComplex,
Arita, Mio) and ALL FOUR WERE FALSE; the only true positive ever is the
invented cat/"meow" pair. Discriminator: every false block held confirmed
good-translation content; the true positive held none. FIX (advisor-guided,
document-dominance layer ONLY): added `sliceAnchorsTranslation` (a
non-standing slice carrying an accepted target-anchored content critique) and
`assessNonTranslationDominance` now vetoes the block whenever ANY slice
anchors translation -- a threshold-free discriminator from 4-false-vs-1-true,
keeping the calibrated err-toward-not-blocking direction. Because the change
only flips the block branch and only toward NOT blocking, every "repaired"
entry is provably unchanged; ONLY Mio is stale (no full wipe, slicing
untouched so caches stay valid). Deterministic tests pass (Mio-shape
dominance regression + six anchor-probe cases); format/lint/types/build 0.
Live Mio re-validation CONFIRMED (sentinel-probe `bcgzdo82q`, ~47 min):
PROBE Mio status=repaired (84 issues, 82 accepted, 45 findings) -- flipped
blocked->repaired exactly like Arita. The log shows the correct shape: chunks
0,1,2,3,4,7 repaired (clean anchors), chunks 5,6,8-15 still ship unchanged
per-slice (10 standing, even MORE than run 020's 8, yet no document block
because the anchors veto it). Stale Mio.json deleted and Mio's attempts entry
reset to 0 so it re-settles as a fair medium candidate during accumulation;
settled dropped to 21/92 (9 small / 6 medium / 6 large). Accumulation resumed
at run 021 (NO pass restart or wipe -- only Mio was stale). Surface the
4/4-false-block pattern in the milestone writeup -- it is a real finding about
this feature's value on this all-real-translation corpus.
PASS 6 RUN 021 (2026-07-25, tip `5baaa37c2`, 2829s wall ~47 min): 1 settled,
22/92. Mio RE-SETTLED status=repaired (88 issues, 87 accepted, ALL 87
resolved, 56 findings) under the anchor-veto fix -- the false block is gone
in the actual artifact pool, not just the probe. Picked first because its
attempts were reset to 0. Medium settled 6->7. Bands now 9 small / 7 medium
/ 6 large (need ~1 small, ~3 medium, ~4 large). Run 022 launched.
PASS 6 RUN 022 (2026-07-25, tip `3e905b1f3`, 1864s wall ~31 min): 1 settled,
23/92. Mizuki_Yuuki repaired (medium, 59 issues, 58 accepted, 58 resolved, 6
findings); one run, no cap. Medium settled 7->8. Bands now 9 small / 8
medium / 6 large (need ~1 small, ~2 medium, ~4 large). Large lags because its
bigger entries (9-40KB) need multi-run resume. Run 023 launched.
PASS 6 RUN 023 (2026-07-25, tip `1d670bc17`, 2596s wall ~43 min): 1 settled,
24/92. MushroomGuuuu repaired (MEDIUM band, 1934B zh source; 69 issues, 62
accepted, 62 resolved, 8 findings, 7 chunks); one run, exceeded 25-min soft
budget but settled within 90-min hard cap. Medium settled 8->9. Bands now 9
small / 9 medium / 6 large (small & medium at the ~10 bar; large needs ~4).
Advisor call (Opus 4.8): do NOT add ordering to force large -- runs are free
background work (user waived quota), 6 large already yields ample large-band
accepted issues (MushroomGuuuu alone 62 >> the ~17 a stratified 50-sample
needs), so large=~10 is document-diversity polish, not sample-sufficiency;
also `corpus-pass` takes only `--plan`, no entry-id targeting arg, so forcing
large would mean new code through the lint gauntlet for negative ROI. Decision:
run naturally (eligible order interleaves medium/large; resume-first finishes
any that abort; no stall risk), and redirect ACTIVE effort to tasks 31/32
(judge crosscheck + stratified sample tooling) which are unblocked against the
24 already-settled entries -- only the final draw waits on band fill. Run 024
launched.
M3 SAMPLE TOOLING BUILT + VALIDATED (2026-07-25, task 32, commits `bf4860250`
+ `be6912575`): the stratified precision-sample toolchain is now landed and
green (build/format 0-0/types/tests). Pure, unit-tested modules: `sample-
grading.ts` (band cuts 1843/3686 B matching accumulation; `classifyBand`;
`GradableIssue`/`GradableClaim`/`GradableSpan` -- a MINIMAL input shape a real
`AdjudicatedIssue` and an artifact-parsed issue both satisfy; `extractGrading-
Candidate` dedupes source/target quotes, primary claim first), `sample-draw.ts`
(`allocateBandQuota` even-split-under-availability round-robin; `drawStratified-
Sample` sha256-hex-keyed deterministic draw, round-robin ACROSS entries within
a band so one issue-heavy entry never dominates), `grading-sheet.ts` (Y/N grade
box per issue with zh source + en target quotes + claim), and `artifact-read.ts`
(`parseSettledArtifact`: a MEASUREMENT INSTRUMENT not a lenient deserializer --
structural-guards-only, THROWS `ArtifactParseError` on a malformed ACCEPTED
issue rather than skipping it, since a silent drop biases the precision
denominator; non-accepted issues excluded as out-of-denominator; category/
severity kept plain strings so no off-taxonomy value is ever a drop reason).
Advisor (Opus 4.8) shaped the parser-as-instrument stance + the string-not-
union call. Thin `corpus-run/draw-sample.ts` (mise task `draw-sample`; `--final`
writes the gate sheet, default writes a PRELIMINARY one) reconciles each
artifact's parsed accepted count against its recorded `acceptedCount` and aborts
loudly on mismatch. PRELIMINARY draw over the 24 settled: pool 2132 accepted
(337 small / 714 medium / 1081 large; entries 9/9/6), 50 drawn 17/17/16.
Validated the sheet is HUMAN-GRADABLE from quotes alone across all bands and
multi-claim issues (e.g. "确认脑死亡" -> "confirmed to be dead"; multi-claim
renders quotes joined by ` · `) -- no corpus open needed to judge Y/N. Sheet
lives OUTSIDE the repo (`node_modules/.monochromatic/.../grading-sheet-
preliminary.md`) since it quotes UNLICENSED corpus text; NEVER committed. FINAL
draw (`draw-sample -- --final`) runs ONCE after the large band fills, so the
user is never handed a sheet that shifts underneath them. Still pending: task 31
judge crosscheck (secondary machine number, quota-heavy, held until now); task
33 gate must report precision PER BAND (the payoff of stratifying) plus the
plain real/50>=0.9 headline.
M3 SAFETY-INVARIANT PRE-CHECK (2026-07-25, task 33 prep, advisor-directed
"check what the artifacts actually record before building a checker; if they
don't, say so, don't fabricate"). Finding: the artifacts record `status`,
`repairedText`, `findings`, and the issue fates -- enough to verify STATUS/TEXT
CONSISTENCY, but NOT the "zero deterministic-gate violations" or "zero
regression-majority selections" invariants directly (no envelope/patch-op or
candidate-comparison data is serialized; `findings` are model-noise diagnostics
like ambiguous-quote / quote-not-found / missing-verdict, not gate violations).
Those two invariants are guaranteed BY CONSTRUCTION (fail-closed patch +
resolution gates; `selectRepairCandidate` keeps UNCHANGED as the floor so a
repaired status means a candidate strictly beat the input) and covered by the
apply-patch / select-candidate / tally-resolution unit tests -- so task 33 will
CITE those, not re-measure from artifacts. What IS artifact+corpus-verifiable,
run now over the 24 settled (compared `repairedText` vs the pinned
`page.en.md`): 23 repaired ALL genuinely changed (0 identical-to-input, i.e. no
hollow repairs), 1 unchanged BYTE-IDENTICAL to input (correct), 0 blocked (the
non-translation anchor-veto fix holds in the pool), 0 anomalies. Status dist
23 repaired / 1 unchanged / 0 blocked; 417 findings all model-noise shapes.
This is the "unchanged/repaired wherever the input is/ isn't beaten" invariant,
clean. Judge crosscheck (task 31) explicitly DEFERRED by advisor until human
grades exist to calibrate the judge against (building it now calibrates against
nothing); the 50-vs-2132 scope is then sequential (same-50 agreement first, and
the 2132-wide run is a user quota call, not autonomous) and the headline gate
does not depend on it.
PASS 6 (2026-07-24): pipeline behavior changed (slicing), so the restarted
pass is a NEW pass; prior pass-5 artifacts and attempts.json discarded.
Note lessons banked while landing this: run package tasks ONLY by scoped
name (`//package/module/translation-repair:<task>`) -- a bare `mise run
build`/`test` from the worktree root fans out to the whole monorepo
(cargo/podman/rust), spikes load, and OOM-kills scoped work; and a lint
`no-regex` rule blocks inline `String#match` regex (used substring checks
instead). PASS 6 RUN 001 launched on tip after the handover commit under
the lockstep slicing fix. Loop continues per task 30: record each run's
tallies content-free, commit, launch the next, until all 92 settle,
landing any further verified high-confidence fix immediately (restarting)
per the standing rule.
The user's concurrent
prior-art survey landed as doc/research/translation-repair-prior-art.md
(commits `650fc5827`, `059ce44e8`): closest precedents MQM-APE and
TEaR; the guarded-envelope composition is the unusual part; its
cautions (ensemble-checked is not independently-verified, seeded
numbers need human-graded evaluation for real-world claims) match
milestone three's human-graded gate. USER PICK (2026-07-23): keep full deadlines and retry-to-quorum as
is; no adjudication-quality change before the precision gate, the
accumulation loop absorbs the wall time. Racing to quorum and
deadline shortening stay recorded as rejected-for-now options,
revisitable if graded evidence changes the tradeoff.
pass2 run 002 (2026-07-23, 1737 s): 2 dispatched, 2 completed, 0
failed; Aniloviraw REPAIRED (44 issues, 40 accepted, 40 resolved,
14 findings, 379 s): the false block reproduced a THIRD time (4
votes, 48 content-critique claims) and the screen dismissed it in
production, exactly as designed; Anilovr repaired (33 issues, 25
accepted, 25 resolved, 13 findings, 1358 s). The pass-1 78 versus
pass-2 33 issue swing decomposes mechanically from the logs (user
challenged the first "variance" label; measured on challenge):
pass-1 big chunk ran 7/7 critics (95 claims) into a
quorum-degraded 4/7 panel (72 issues, acceptance at 3 of 4 heard),
pass-2 ran 5/7 critics after a forfeit-retry (57 claims, per-critic
volume nearly identical) into a full 7/7 panel (27 issues). Claims
barely converge across critics on this entry (95 claims to 72
distinct issues, mostly singletons), so each lost critic removes
its singletons, and the thin pass-1 panel is the outlier side.
Screening uninvolved: zero non-translation votes on Anilovr chunks
in both passes. No iteration triggered: quorum design worked as
built, and thin-panel volatility errs toward fewer accepted issues,
the safe direction for a precision gate; revisit only if the graded
sample shows precision misses clustering in degraded-panel entries.
Remaining 88.
run 003 (2026-07-23, 1913 s): 3 dispatched, 3 completed, 0 failed;
Arita repaired (20 issues, 18 accepted, 17 resolved, 6 findings,
644 s); ArtsEpiphany unchanged (0 claims from 7/7 critics, 8 s;
measured: the pair is a 120-byte front-matter stub each side, so
zero claims is correct, not a silent failure); BI4PBV REPAIRED
(31 issues, 30 accepted, 28 resolved, 3 findings, 1260 s): the
milestone-two quarantine entry that forfeited all seven models in
two independent benchmark runs completed 7/7 on all three chunks
at first attempt; the spiral was provider weather plus seeded-text
conditions, and the production pass holds no quarantine list.
Remaining 84.

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
