# Translation repair history: Early foundation, segment 2

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

TRANSLATION POLICY,
USER DIRECTIVE (2026-07-23,
commit
`4bab4412c`).
Two standing rules,
now baseline prompt policy (the
architecture always held that policy files are optional and the
system must work without them;
these are the first policy rules
the user has stated directly):
1. A phrase the ORIGINAL writes in a language other than its own
   keeps that original wording in the TRANSLATION and carries its
   meaning ALONGSIDE,
   side by side.
   Never replaced by meaning
   alone,
   never left bare.
   New category
   `policy/foreign-phrase-gloss`,
   distinct from
   `accuracy/untranslated` because the remedy differs:
   gloss beside
   preserved wording,
   not replacement.
   Prompted by a real finding
   on Anilovr,
   where a critic flagged an Esperanto line as
   `accuracy/untranslated`,
   whose remedy would have destroyed the
   original wording.
2. Prioritize emotional completeness and naturalness over
   one-to-one meaning correspondence.
   Critics must not report
   non-literal renderings as defects,
   and must report flattened
   voice,
   warmth,
   humor,
   irony,
   grief,
   or intimacy as the new
   `style/emotional-flattening`;
   stiff literal renderings are
   `style/awkward-phrasing` even when every word matches.
   Editors
   recast wording,
   sentence boundaries,
   and clause order freely to
   serve the feeling.
   Two guards keep this from becoming license:
   "Naturalness never licenses dropping content" pairs with the
   existing clause-enumeration rule,
   and "Never introduce content
   the ORIGINAL does not support" stays (milestone two measured
   embellishment as a real failure mode).
Taxonomy growth is safe:
   `remapCategoryLeaf` derives owners from
the category list,
   so no exhaustive map needed updating.
Verification:
   91 suites pass,
   oxlint 0/0,
   types clean;
   the prompt
suites now assert both policies in both directions.
POLICY GATE,
   Anilovr (2026-07-23,
   log
`gate-anilovr-policy.log`):
   PASS,
   repaired,
   114 issues,
   2608 s.
The policy fired as designed:
   5 `policy/foreign-phrase-gloss` and
5 `style/emotional-flattening` claims,
   ZERO `accuracy/untranslated`
(the miscategorization that prompted the directive is gone),
   and
the Esperanto line ships preserved with its meaning beside it:
`//La homa mondo devus esti detruita (The human world should be
destroyed)//`.
   Exactly the requested side-by-side shape.
ONE OVER-APPLICATION MEASURED:
   the same stylized quote kept its
CJK clause with a gloss (`我会在参宿四上等你 (I will wait for you at
Betelgeuse)`),
   but Chinese is the ORIGINAL's own language,
   not a
foreign phrase,
   so the rule does not cover it.
   Scope is bounded:
whole-page CJK went 6 to 15 chars,
   one phrase,
   one line;
   the only
other CJK line holds proper names already present in the input.
Risk if systematic:
   preserved CJK in English pages is exactly the
`accuracy/untranslated` signal the non-translation detector reads,
so unchecked spread could interact with blocking.
   Resolution is a
values question about memorial presentation (the quote is the
person's own last words),
   not a measurable one,
   so it went to the
user.
USER PICK (2026-07-23):
   render source-language text into English
like ordinary prose;
   only genuinely third languages get
preserve-plus-gloss,
   including inside quotations and stylized
multilingual lines.
   Rejected alternatives recorded:
   preserve CJK
with a gloss everywhere,
   and a quoted-blockquote-only carve-out.
SCOPING FIX (commit `4b8fd64c8`):
   both prompts now carry the
explicit negative,
   "The ORIGINAL's own language is never such a
phrase",
   with the quotation and stylized-line cases named so the
exception cannot spread;
   prompt tests assert it in both files.
Verification:
   91 suites,
   oxlint 0/0,
   types clean.
   Second policy
gate on Anilovr (log `gate-anilovr-policy2.log`):
   PASS,
   repaired,
92 issues,
   2795 s.
   Both goals confirmed and no over-correction:
the Esperanto stays glossed (4 gloss claims,
   gloss retained
`//La homa mondo devus esti detruita// (The human world should be
destroyed)`),
   and the stylized quote's Chinese clause now renders
to English ("I will wait for you at Betelgeuse").
   Whole-page CJK
went 6 to 0:
   the editor also romanized two proper names the input
carried in characters (方方 to Fang Fang,
   铃木真依 to Mai Suzuki),
flagged as one `accuracy/untranslated` and resolved.
   That is
consistent with the render-source-into-English pick,
   not a new
over-application,
   and it clears the non-translation-detector
interaction entirely (no residual CJK to read as untranslated).
PASS 4 starting from zero on this tip.
INCIDENT AND RECOVERY (2026-07-24):
   the user accidentally ran
`rm -rf ${HOME}/temp`,
   wiping the old out-of-repo run dir
`${HOME}/temp/translation-repair-corpus/` (driver,
   sentinel probe,
all pass-4 artifacts,
   and `pass4-run-001.log`) mid-run.
   Nothing
irreplaceable was lost:
   the pipeline code,
   this handover,
   and every
recorded decision live in git,
   and the corpus was never in `${HOME}/temp`
(it reads live via `git show` at the pinned SHA from
`${HOME}/one-among-us/data`,
   verified readable post-incident).
   Only
regenerable scaffolding and one interrupted pass's artifacts went with it.
Recovery:
   rebuilt the driver and probe grounded in the module's exported
API (`listCorpusPeople`,
   `readCorpusFile`,
   `createSyntheticClient`,
`repairTranslation`),
   not memory;
   relocated them plus artifacts to the
durable gitignored dir `node_modules/.monochromatic/translation-repair-runs/`
(user's suggestion;
   see "Where work lives").
   Verified at zero quota with
`--plan`:
   pending 92 (tdor excluded by the complete-pair filter,
   no
hardcoded exclusion),
   key injected,
   client constructs.
   Added AGENTS.md
rules TMP (`${HOME}/temp` is ephemeral,
   keep only reconstructable
scaffolding) and NMD (durable uncommittable state goes in
`node_modules/.monochromatic/`),
   regenerated CLAUDE.md,
   commit
`1831230e0`.
   Pass 4 run 001 relaunched on that tip;
   the pipeline itself
is unchanged from `63baaa686`,
   so accumulation resumes exactly where it
would have.
WORKTREE MOVE AND SOURCE PROMOTION (2026-07-24):
   the user flagged that a
worktree under the repo's `.claude/` risks the same stray-cleanup loss as
`${HOME}/temp`,
   so the worktree moved via `git worktree move` from
`.claude/worktrees/translation-repair` to `${HOME}/worktrees/translation-repair`
(same filesystem,
   a rename;
   HEAD and all run outputs moved with it;
   `mise trust`
re-run at the new path).
   Then,
   per "driver and probe should be source code" and
"put them under src/<category>",
   the driver and probe were promoted from
gitignored `.mjs` scaffolding to committed TypeScript under
`src/corpus-run/` (`run-config.ts`,
   `corpus-pass.ts`,
   `sentinel-probe.ts`),
importing the pipeline from sibling source,
   `import.meta.main`-guarded,
   run via
new package mise tasks `corpus-pass` and `sentinel-probe`.
   Only run OUTPUTS stay
gitignored in `node_modules/.monochromatic/translation-repair-runs/`.
   See "Where
work lives".
   Only run OUTPUTS stay gitignored in
`node_modules/.monochromatic/translation-repair-runs/`.
RESOLVED (2026-07-24,
   commit `92f7b2c55`):
   the new source is green (format,
oxlint 0/0,
   types),
   `--plan` runs through the mise task (pending 92,
   tdor
excluded,
   client constructs,
   zero quota),
   the old `.mjs` copies are deleted,
   and
`buildAndTest` passes so the library is unregressed by the addition.
   Pass 4 run
002 relaunched via `mise run //package/module/translation-repair:corpus-pass`
(log `node_modules/.monochromatic/translation-repair-runs/pass4-run-002.log`) on
tip `92f7b2c55`;
   the pipeline behavior is unchanged from `63baaa686` (the
intervening commits are docs,
   the worktree move,
   and this source promotion,
   none
touching pipeline logic),
   so this continues pass 4 accumulation.
   The persisted
`attempts.json` survived,
   so entries attempted-but-never-settled by the wiped
runs (e.g. Acheron) now sort after the untouched zero-attempt entries.
PASS 4 RUN 002 (2026-07-24,
   tip `92f7b2c55`,
   2110s wall,
   soft budget hit):
processed 2 of 92,
   artifacts 2/92.
   `AmbeR_the_anpa` repaired (61 issues,
   58
accepted,
   58 resolved,
   0 findings,
   2028s ~34min ALONE,
   consuming the whole soft
budget;
   the top-of-loop soft check stopped new entries after it).
   `AkiraComplex`
blocked-non-translation (0 issues,
   4 findings,
   62s) is a VERIFIED FALSE BLOCK:
its en page is a faithful translation of the zh (checked directly against the
pinned corpus).
   Findings were `empty-quote (source)` x2,
   `non-translation votes
stand (2/7 heard); slice unchanged`,
   `non-translation dominance (561 of 590
target chars)`.
   Root cause:
   only 2 of 7 critics were HEARD on the dominant
slice and both voted non-translation,
   meeting the ABSOLUTE
`NON_TRANSLATION_BLOCK_VOTES=2` threshold (`non-translation-evidence.ts`);
   5
silent critics gave no counter-signal,
   so a bare 2 votes blocked despite no real
ensemble agreement.
   Likely trigger:
   the page opens with an English epigraph that
is English in BOTH zh and en source,
   so a slice reads as "source == target,
   not
a translation" to a critic.
   HIGH-CONFIDENCE ISSUE,
   fix deferred for careful
calibration (do not just lower/raise the constant blindly):
   the severe block
(discards all repair,
   returns input) must require genuine ensemble agreement,
not a bare count a low-participation slice can satisfy.
   Candidate fixes,
   each
with a tension to resolve against the KNOWN TRUE-POSITIVE case (zh cat story vs
"Meow meow meow":
   GLM + gpt-oss + Qwen,
   i.e. 3 of 7,
   all flagged
non-translation,
   one failing to anchor):
   (1) require a MINIMUM critics-heard
count on the slice before any block (2/7 heard is too few to make a severe call;
degrade instead) -- cleanest,
   targets the failure mode directly,
   needs the
minimum chosen so the 3/7 true case still blocks when those 3 are among the
heard;
   (2) require non-translation votes as a fraction of the FULL roster
treating silent critics as not-non-translation (e.g. >= 3) -- must not exceed 3
or it breaks the true case;
   (3) both.
   The English-epigraph-in-both trigger is a
second,
   orthogonal seam (a slice whose source and target are identical English
should never count as non-translation evidence).
   NEXT ACTION:
   design and land
this with full context,
   add unit tests over the participation cases,
   validate on
`AkiraComplex` (expect:
   no longer blocked) via `sentinel-probe -- AkiraComplex`
plus the true-positive fixture,
   then restart the pass.
   Accumulation is PAUSED
(run 003 not launched) because a fix+restart discards further runs;
   resume only
if choosing progress-under-current-pipeline over the fix.
USER PICK (2026-07-24):
   "Always land the fix now then restart."
   This is a
STANDING refinement of the improve-and-restart directive:
   context pressure is
NOT a reason to defer a verified high-confidence fix;
   land it,
   do not park it for
a fresh session.
   Recorded so future sessions do not re-offer "defer".
FIX LANDED (2026-07-24,
   commit `342f9caa5`):
   `NON_TRANSLATION_BLOCK_VOTES` raised
2 -> 3 in `non-translation-evidence.ts`.
   Three wire votes is genuine ensemble
agreement and,
   because three votes cannot come from fewer than three critics
heard,
   folds a participation floor into the count so a low-participation slice
(AkiraComplex's 2/7) can never block;
   three is the observed true-positive floor
(cat/"meow" drew three) and errs safe (a missed block attempts repair with issues
still surfaced;
   a false block discards a faithful translation whole).
   The block
decision was extracted from an inline expression in `repair-chunk.ts` into a
named,
   exported `nonTranslationVotesStand({votes, contradicted})` with regression
unit tests (2 votes below floor do not stand;
   3 uncontradicted stand;
   3
contradicted do not).
   `downgradeCount` moved to sibling `downgrade-count.ts` to
keep `repair-chunk.ts` under the 300-line budget.
   Verified:
   build,
   format 0/0,
lint,
   types,
   unit tests all green.
   Live sentinel-probe on AkiraComplex is the
final confirmation before restart.
   This makes the restarted pass a NEW pass
(pipeline behavior changed);
   prior pass-4 artifacts are discarded.
FIX CONFIRMED LIVE (2026-07-24):
   `sentinel-probe -- AkiraComplex` returned
status=repaired (21 issues,
   21 accepted,
   1 finding,
   421s),
   up from
blocked-non-translation:
   the false block is gone end-to-end.
   Artifacts and
`attempts.json` wiped for a clean restart.
   PASS 5 RUN 001 launched on tip
`b3fdf6e4c` (log `pass5-run-001.log`);
   this is the current accumulation pass
under the three-vote non-translation block.
   Loop continues per task 30:
   record
each run's tallies content-free,
   commit,
   launch the next,
   until all 92 settle,
landing any further verified high-confidence fix immediately (restarting) per
the standing rule.
PASS 5 RUN 001 (2026-07-24,
   tip `b3fdf6e4c`,
   1906s wall,
   soft budget hit):
2 dispatched,
   2 completed,
   0 failed.
   Acheron repaired (56 issues,
   55
accepted,
   54 resolved,
   18 findings,
   1464s);
   AkiraComplex repaired (13
issues,
   13 accepted,
   12 resolved,
   1 finding,
   442s).
   AkiraComplex is the
headline:
   the three-vote block holds in the full pass exactly as the probe
predicted -- the once-false-blocked slice now repairs cleanly,
   no
regression elsewhere.
   Acheron alone ate the 25-min soft budget,
   so the
top-of-loop check stopped new entries after it;
   the two artifacts persist,
attempts.json carries {Acheron:1,
   AkiraComplex:1}.
   No new high-confidence
fix surfaced;
   loop continues,
   launching run 002 on the same tip.
PASS 5 RUN 002 (2026-07-24,
   tip `94b031cae`,
   2088s wall,
   soft budget hit):
1 dispatched,
   1 completed,
   0 failed.
   AmbeR_the_anpa repaired (49 issues,
45 accepted,
   44 resolved,
   6 findings,
   2088s) -- a single large document
that overran the 25-min soft budget on its own,
   so no second entry
dispatched.
   3/92 settled.
   No new fix surfaced;
   run 003 launched on tip
`94b031cae` (same,
   since only the handover moved).
PASS 5 RUN 003 (2026-07-24,
   tip `0384097b7`,
   1806s wall,
   soft budget hit):
1 dispatched,
   1 completed,
   0 failed.
   Aniloviraw repaired (26 issues,
   26
accepted,
   25 resolved,
   13 findings,
   1806s) -- the once-false-blocked
divergence-heavy pair,
   repairing cleanly again.
   One transient event:
   five
of seven critics (Qwen3.6-27B,
   Kimi-K2.7-Code,
   MiniMax-M3,
   Nemotron-3,
gpt-oss-120b) hit the 240s deadline together on a single slice at
10:14:54Z;
   that slice heard only two critics,
   the pipeline degraded
gracefully via quorum,
   and the entry still repaired.
   Reads as an API-side
slowdown burst,
   not a code fault -- logged,
   no fix triggered.
   4/92 settled.
Run 004 launched on tip `0384097b7`.
PASS 5 RUN 004 (2026-07-24,
   tip `5f60a1b55`,
   2540s wall,
   near hard cap):
1 dispatched,
   1 completed,
   0 failed.
   Anilovr repaired (95 issues,
   95
accepted,
   ALL 95 resolved,
   34 findings,
   2540s) -- the largest document
yet by issue count,
   running ~42 min,
   just under the 45-min hard cap.
   Two
critic timeouts (Nemotron-3,
   gpt-oss-120b) on one slice,
   again absorbed
by quorum with no effect on the outcome.
   A perfect 95/95 accept-and-
resolve is a strong signal but exactly the kind of number the milestone-
three human grade exists to check,
   not to trust on its own.
   5/92 settled.
Run 005 launched on tip `5f60a1b55`.
PASS 5 RUN 005 (2026-07-24,
   tip `20a66e58b`,
   1769s wall,
   soft budget hit):
3 dispatched,
   3 completed,
   0 failed.
   BI4PBV repaired (42 issues,
   38
accepted,
   37 resolved,
   16 findings,
   1498s).
   ArtsEpiphany unchanged (0
issues,
   15s) -- correct:
   a 120-char placeholder stub whose desc is blank
by intent and whose source equals its target,
   nothing to repair.
   Arita
BLOCKED-non-translation (0 issues,
   14 findings,
   255s) -- the FIRST block
under the three-vote regime,
   and it demanded investigation before the
loop could continue.
ARITA DIAGNOSIS (2026-07-24):
   a FALSE block,
   but from a slice-alignment
defect,
   not the vote threshold.
   Arita is a genuine translation (rich zh
biography,
   faithful en).
   Deterministic node dump proved both sides carry
exactly 13 nodes corresponding 1:1,
   yet `subdivideChunkPair` mis-paired
them with a one-paragraph drift,
   so critics correctly read each mismatched
slice as non-translation and 6-7 of 7 voted -- genuine ensemble agreement
on genuinely mispaired input.
   Root cause:
   the slicer grouped each side
independently with different budgets (source scaled ~150,
   target 400);
small adjacent nodes merged at different indices per side,
   run counts
diverged (12 vs 11),
   and the character-fraction merge pulled an extra
source run into slice 0,
   shifting every later slice by one.
   This is the
common case (translations preserve paragraph structure),
   so the defect
likely mis-sliced many entries subtly;
   Arita was pathological because the
drift made EVERY slice a mismatch.
ARITA FIX (2026-07-24,
   commit `7a5117727`):
   `groupNodesLockstep` -- when
both sides carry equal node counts,
   group them together,
   extending a slice
to the next shared index only while BOTH sides stay within budget,
   so
slice N always holds the same node indices on both sides.
   Genuine
paragraph-count mismatch still falls back to the existing monotone merge.
Correct by construction for the equal-count case;
   surgical (unequal counts
untouched).
   Verified deterministically:
   an engineered equal-count marker
fixture drifted under the old code (src[M0] vs tgt[M0,M1]) and pairs 1:1
under the new;
   the real Arita content now slices 1:1 (简介/Introduction,
intro/intro,
   band/band ... every slice a true pair).
   Unit test
`pairs equal node counts in lockstep without off-by-one drift (Arita
regression)` added;
   format/lint/types/unit all green.
   Live confirmation:
`sentinel-probe -- Arita` returned status=repaired (123 issues,
   114
accepted,
   7 findings,
   4110s) with 0 non-translation votes on every critic
stage -- the false block gone end-to-end.
ARITA FIX BLAST RADIUS (2026-07-24,
   deterministic corpus survey,
   zero
quota):
   across the 92 usable entries,
   182 of 284 aligned chunk-pairs
(64%) carry equal node counts and so take the lockstep path;
   replaying the
old independent-budget grouping,
   68 of those 182 pairs -- spread over 46
of the 92 entries -- had divergent per-side run boundaries,
   i.e. the old
code actually mis-sliced them.
   Most drifted entries still REPAIRED before
(Acheron,
   AkiraComplex,
   BI4PBV are in the drifted set) because partial
drift only mispairs some slices;
   Arita was the pathological all-slices
case that blocked.
   So the fix corrects slicing on 68 pairs across half the
corpus,
   but the ONLY confirmed end-to-end outcome change is Arita
(block->repair);
   alignment is now provably more correct on those pairs,
while any issue-set or quality effect is unmeasured and waits on the
milestone-three human grade.
   Survey scripts in the session scratchpad
(nodecount-survey.mjs,
   drift-survey.mjs) reproduce the counts.
PASS 6 RUN 001 (2026-07-24,
   tip `973ca8235`,
   1556s wall,
   soft budget hit):
1 dispatched,
   1 completed,
   0 failed.
   Acheron repaired (46 issues,
   45
accepted,
   44 resolved,
   4 findings,
   1556s).
   Data point on the corrected
slicing:
   Acheron is in the drifted set,
   and its numbers moved from pass-5
old-slicing (56 issues,
   55 accepted,
   54 resolved,
   18 findings) to 46/45/44
with findings down 18->4.
   Factual:
   the issue set changed and finding-noise
dropped under 1:1 alignment;
   whether that is higher quality is for the
grade,
   not this delta.
   1/92 settled.
   Run 002 launched on tip `6a58ababf`.
PASS 6 RUN 002 (2026-07-24,
   tip `edc7959bf`,
   2620s wall,
   soft budget hit):
2 dispatched,
   2 completed,
   0 failed.
   AkiraComplex repaired (32 issues,
   28
accepted,
   28 resolved,
   1 finding,
   698s);
   AmbeR_the_anpa repaired (44
issues,
   42 accepted,
   42 resolved,
   4 findings,
   1923s).
   Both in earlier
passes too;
   no blocks under lockstep.
   3/92 settled.
   Run 003 launched.
PASS 6 RUN 003 (2026-07-24,
   tip `8459fd92d`,
   1764s wall,
   soft budget hit):
1 dispatched,
   1 completed,
   0 failed.
   Aniloviraw repaired (52 issues,
   52
accepted,
   all 52 resolved,
   10 findings,
   1764s) -- the original
contradiction-screen false-block entry,
   repairing cleanly again.
   4/92
settled.
   Run 004 launched.
PASS 6 RUN 004 (2026-07-24,
   tip `f08bd3996`,
   hard cap hit):
   Anilovr
status=ERROR,
   aborted at 2700002ms (the 45-min HARD_CAP),
   0 processed.
Diagnosis (NOT a regression,
   NOT a fix trigger):
   the log shows transport
`terminated` failures with retries plus two critic timeout bursts,
   and
only 6 of 7 slices finished in 45 min -- a bad API window at ~20:27Z,
   not
a workload change.
   Deterministic slice-count check (anilovr-slices.mjs)
proves it:
   Anilovr produces 7 slices under BOTH old and lockstep code
(delta=0;
   Arita +1,
   Acheron/AmbeR 0),
   and it repaired fine in pass-5 run
004 at 2540s with those same 7 slices.
   Self-heals by design:
   no artifact
written so Anilovr stays pending,
   but its attempt count went to 1,
   so the
fewest-attempts order now processes the 87 zero-attempt entries first and
retries Anilovr later (hopefully a calmer API window).
   Still 4/92 settled.
Run 005 launched.
PASS 6 RUN 005 (2026-07-24,
   tip `9c86aebf1`,
   hard cap hit):
   Arita
status=ERROR,
   aborted at 2700003ms,
   0 processed.
   This one is SYSTEMATIC,
not transient:
   the earlier live probe showed Arita legitimately takes
4110s (~68 min) for its 12 slices,
   which exceeds the 45-min cap,
   so Arita
can never settle as configured.
   Still 4/92 settled.
CORPUS-PASS BUDGET FIX (2026-07-24,
   commit `5b74bd7b2`):
   two problems
surfaced.
   (1) The hard ceiling was armed ONCE for the whole loop,
   so its
abort signal was shared -- an entry starting near the soft budget got only
the sliver left before the cap.
   Fixed:
   a fresh `armCallDeadline` per entry
(disposed via `using`,
   since try/finally is lint-banned),
   so each entry
gets its full budget regardless of start time.
   (2) 45 min was too tight;
raised HARD_CAP to 90 min (per entry),
   clearing every entry up to ~16
slices at the measured ~5.5 min/slice.
   Driver-only;
   repair results and the
4 settled artifacts unaffected,
   so NO restart.
   Verified:
   format/lint/types
0/0 and a `--plan` run (zero quota) shows hard=5400000ms.
