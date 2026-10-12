# Translation repair handover, historical record, part 01

Part 01 of [Translation repair handover, historical record](translation-repair-history-01-early-foundation-segment-01-part-01.md),
whose index lists every part in order.

## Current stop condition

Historical evidence only.
Candidate M failed on 2026-09-01.
No historical next-action list authorizes a corpus run,
model call,
spent-prompt retry,
or successor implementation.


WHAT THIS IS.
Everything this project learned before the stretch the current handover covers,
kept whole because the evidence in it is why later decisions look the way they do.

NO LENGTH LIMIT HERE,
deliberately.
A record that has to stay short stops recording,
and the measurements below were expensive to make.
Nothing is trimmed to fit;
sections are appended to the end as they age out of the current handover.

THE CURRENT HANDOVER IS `doc/handover/translation-repair.md`,
which is capped at two thousand lines and holds only what a session starting today needs.
When that file approaches its cap,
its oldest sections move here unchanged.

READ THIS ONE when you need the reasoning behind a decision the current handover only cites,
or when a measurement is quoted without its method.

Status:
milestone one COMPLETE (ensembleRecall 0.981,
2026-07-17);
repair phase (milestone two) started 2026-07-17,
tasks 11 to 17.
Milestone-one history below is kept for its evidence value.
Tasks 1 (scaffold),
2 (document core),
3 (issue model and span validation),
4 (Synthetic model client,
streaming),
and 6 (corpus reads) landed;
task 5 (benchmark) code is complete and fully gated (lint 0/0,
types clean,
all unit tests pass,
including the hang-forfeiture test):
run 1 died on fetch's headers timeout (fixed by streaming),
run 2 died on the driver's single global 20-minute abort signal
(fixed by per-call deadlines via `armCallDeadline`,
commit `18a8e95ca`),
run 3 aborted before any model call on `MdxParseError` from two corpus
entries whose bodies contain HTML comments (see "Corpus facts").
The user bought 4 additional packs on 2026-07-16,
joining a founder's
pack worth 1.5 normal packs (live five-hour ceiling now 2750,
5.5 pack-equivalents);
the client's `perModelConcurrency` option and parallel
benchmark entries exploit them.
Run 4 (four entries including 8 to 21 KB translations,
all seven models):
ensembleRecall 0 over a seed universe of 8,
but mechanically explained,
27 of 28 attempts hit the 8-minute per-call deadline and the single
completion (GLM-5.2 on Huasheng) burned exactly 65_536 completion tokens
(the hard output ceiling) and truncated its JSON;
only ~1.07 weighted
units billed,
so starved calls cost nothing.
Post-run probes settled the diagnosis (see "Provider facts"):
same-model concurrency is real,
and DarlinChit-scale entries (~1.4 KB)
complete in ~30 s with quality output.
Conclusion:
the work unit must be small;
chunking is mandatory for the
pipeline,
and the benchmark uses small whole entries as stand-in chunks.
The parse phase is now tolerant per user directive (HTML comments masked,
plain-markdown fallback,
findings not throws,
commit `5762f4748`):
the whole pinned corpus parses (92 pairs:
69 clean,
23 comment-masked,
zero fallbacks,
zero throws).
Run 5 (six small entries,
0.7 to 2.5 KB translations,
12 seeds,
42 calls):
ensembleRecall 0.5,
but the decomposition is the real result.
On every entry where at least one model completed,
ensemble recall was
100% (6 of 6 seed hits);
the misses were entries where NO model produced
output.
Failure causes:
a burst-502 storm (27 instant gateway rejections
when 42 streams dispatched simultaneously;
identical calls succeeded
minutes earlier),
one entry (BI4PBV) where all seven models hit the
8-minute deadline,
and one Nemotron 65_536-token blowout on a 1.6 KB
entry.
Per-model seededRecall where completions happened:
Qwen3.6-27B 3/3 entries with 2/2 hits each,
Kimi-K2.7-Code 2/2 entries
perfect,
GLM-5.2 1/1 perfect (9 claims,
zero unresolved),
GLM-4.7-Flash 1 completion with 0 hits (weak),
MiniMax-M3 1 "completion" of 5 tokens (an empty-but-valid report,
a precision pathology to watch).
Net quota cost of the run:
zero
(regeneration covered it).
Remediation landed as commit `1c7d22fd7`:
the client retries transient
429/502/503/504 up to twice with jittered exponential backoff.
Run 6 (same entries,
retries active,
perModelConcurrency 2):
zero gateway errors,
ensembleRecall 0.667 (8 of 12 seeds),
best single
model gpt-oss-120b (7 of 12,
schemaOk 0.667);
BI4PBV timed out on all
seven models for the second consecutive run (content-conditional thinking
spiral,
quarantined as data);
`quote-crosses-blocks (source)` polluted
nearly every attempt's unresolved reasons.
USER PIVOT (2026-07-17):
stop broadening;
polish the whole loop
end-to-end on `people/Xu_Yushu` first (task 9).
Full-document Xu_Yushu is
feasible live:
GLM-5.2 64 s / 16_572 tokens / 30 issues,
gpt-oss-120b
23 s / 8_493 tokens / 11 issues,
refuting document size as the run-4
wall (spirals are content-conditional,
see BI4PBV and Acheron).
USER DIRECTIVE:
the system must handle malformed or mismatched texts on
its own,
automatically;
landed as tolerant parsing (commit `5762f4748`)
plus total automatic section alignment (commit `2f9b2c8af`:
`alignDocumentSections` pairs mirrored structures by index and degrades
to proportional monotone merging with findings,
never refusing).
Xu_Yushu structural fact:
both sides mirror exactly (48 nodes,
identical
kind sequences,
9 sections).
Polish loop findings and fixes (Xu_Yushu,
two full passes):
- Claim quality is real:
  clean-variant issues are specific verifiable
  defects (dropped 光辉璀璨的,
  初高中 narrowed to high school,
  fabricated
  "2023" on dates,
  动漫周边 mistranslated),
  and models CONVERGE on the
  same defects independently,
  validating ensemble adjudication.
- Pass 1:
  seeds 3/3 for four of six completing models;
  dominant failure
  was quote-not-found on punctuation variants (corpus curly,
  models
  ASCII).
- Fixes landed (`1c6b9fe2e`,
  `b6a0033cb`):
  length-preserving
  punctuation-normalized quote fallback (anchors keep document bytes),
  block-crossing quotes split into per-node spans,
  family-slip category
  remap,
  CJK corner brackets (「」『』) joined to the quote classes.
- Pass 2 (after first fixes):
  EVERY completing model (five) found all
  three seeds;
  resolution rates Qwen 30/31,
  Kimi 50/53,
  MiniMax 74/83,
  gpt-oss 26/31 (was 16/24),
  Nemotron 36/47.
  Remaining rejections are
  CORRECT:
  model typos in evidence (噪 for 噩),
  ambiguous short
  fragments (遗书),
  paraphrases,
  one typo category (accuracy/omition).
- Provider nondeterminism is large:
  GLM-5.2 completed both variants in
  pass 1 (13k and 33k tokens) and blew the 65_536 ceiling on BOTH in
  passes 2 and 3 at temperature 0 on identical input;
  Flash and
  Nemotron flip between completion and ceiling blowout per pass.
  The bounded second attempt is DONE (commits `b65d3069f`,
  `eb32173bf`):
  `attempt-retry.ts` (renamed from its truncation-only predecessor,
  whose
  retired name sits in the forbidden-strings appendix) detects
  truncation-shaped schema mismatches (truncated-thinking detail,
  cut-off-JSON parser messages,
  or completion tokens at the 65_536
  ceiling) plus http-error records,
  and `runCriticBenchmark` grants
  exactly one fresh-deadline second attempt,
  keeping the discarded first
  detail in `retriedFirstAttemptDetail`.
  Live pass 4 through `runCriticBenchmark` (seeded Xu_Yushu,
  all seven
  models,
  308 s wall):
  every model completed `ok` on its FIRST attempt,
  zero truncations,
  so the retry path stayed idle live;
  trigger and cap
  are unit-tested and detection strings come from recorded real
  failures.
  Pass 4 is the best pass yet:
  7/7 ok,
  ensemble recall 1.0,
  four models found all three seeds (GLM-5.2,
  Qwen,
  Kimi,
  Nemotron),
  GLM-5.2 completed at 10_690 tokens after three straight
  ceiling-blowout passes,
  Nemotron squeaked under the ceiling at
  45_977.
  Same input,
  fourth different behavior pattern:
  the nondeterminism cuts both ways.
  MiniMax-M3 flips which variant times out per pass.
  (Temperature is no longer sent at all;
  see provider facts.)
- Pass 3 (after corner-bracket fix):
  Qwen 29/29 resolved (100%),
  gpt-oss seeded 18/18,
  MiniMax clean 110/117,
  Nemotron clean 12/13;
  all three completing seeded models hit 3/3 seeds again.
  Source-side quote-not-found dropped from about nine (pass 2) to three
  (pass 3),
  all remaining ones genuine paraphrases or typos.
  Task 9 (Xu_Yushu polish) is COMPLETE:
  quality claims,
  perfect seed
  recall from every completing model across three passes,
  and the
  resolution gate now rejects only actual fabrication.
Update this document at every task completion or design pivot;
it exists so auto-compaction cannot lose session state.

## Goal

`@monochromatic-dev/module-translation-repair`:
a pure fn taking (original zh text,
translated en text)
and returning validated issues plus a conservative repaired candidate.
Built for individually unreliable flat-rate models;
no single model output is ever a decision point.

Everything starts as a pure fn (user requirement);
consumers and deployment are deliberately out of scope for now.

## Where work lives

- Worktree `${HOME}/worktrees/translation-repair`,
  branch
  `translation-repair-rebased` since 2026-08-06.
  The work MOVED off
  `translation-repair`:
  that branch is protected against force-push,
  so the
  rebase onto main could never land on it,
  and the remote copy is frozen at the
  pre-rebase history.
  Work on `translation-repair-rebased` from now on,
  and
  treat `origin/translation-repair` as stale rather than as the branch to push
  to.
  The pre-rebase tip is also kept locally as
  `translation-repair-prerebase-backup`.
  Moved 2026-07-24 (`git worktree move`) out of the old in-repo
  `.claude/worktrees/translation-repair`,
  which risked the same stray-cleanup loss
  as `${HOME}/temp`;
  it now sits alongside the repo's other worktrees under
  `${HOME}/worktrees/`.
  After the move,
  run `mise trust` at the new path.
- Use `/usr/bin/git` for commits in this worktree for this session (user authorization):
  the policy shim fails because the `forbidden-strings` scanner is a gitignored Rust build artifact
  (`package/cli/forbidden-strings/target/release/`) absent from fresh worktrees.
- `.env.local.json` copied from main worktree;
  `TRANSLATION_REPAIR_SYNTHETIC_API_KEY` resolves through mise sops (verified by name,
  never print values).
- Corpus-pass driver and sentinel probe are COMMITTED SOURCE (2026-07-24,
  user
  directive "driver and probe should be source code") under
  `package/module/translation-repair/src/corpus-run/`:
  `run-config.ts` (shared roster,
  budgets,
  corpus pin,
  worktree/runs-dir
  resolvers,
  client factory),
  `corpus-pass.ts` (full-corpus accumulation pass),
  `sentinel-probe.ts` (named-entry validation).
  They import the pipeline from
  SIBLING SOURCE and are `import.meta.main`-guarded,
  following the repo's
  executable-in-src pattern (e.g. `package/dev-script/watch-restart/src/cli.ts`);
  no hardcoded dist path.
  Run via mise tasks (package `mise.toml`):
  `mise run //package/module/translation-repair:corpus-pass` (append `-- --plan`
  for the zero-quota setup check that verifies imports,
  corpus reads,
  filtering,
  ordering,
  key injection,
  and client construction),
  and
  `mise run //package/module/translation-repair:sentinel-probe -- <id>...`.
  Only the RUN OUTPUTS stay gitignored and out of git:
  per-entry artifacts,
  `attempts.json`,
  and run logs live in
  `node_modules/.monochromatic/translation-repair-runs/` (gitignored so
  UNLICENSED-corpus-derived artifacts can never be committed,
  and outside
  `${HOME}/temp` so cleanup cannot wipe them;
  AGENTS.md rules TMP and NMD).
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
  `2c90224ba` per-call deadlines (first,
  broken attempt via `AbortSignal.any`),
  `18a8e95ca` pack-scaled concurrency plus working timer-driven deadlines,
  `735e1b34e` seed derivation skips MDX/JSX delimiter-bearing sentences,
  plus docs commits after each task.
