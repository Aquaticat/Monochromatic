# Translation repair history: segment 2.4, part 03

Part 03 of [Translation repair history: segment 2.4](translation-repair-history-01-early-foundation-segment-02-subpart-04.md),
whose index lists every part in order.

## Continued record, continued

### Preserved chronological continuation, continued

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
