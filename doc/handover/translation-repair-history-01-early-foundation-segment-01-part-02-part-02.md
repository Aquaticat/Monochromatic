# Translation repair history: segment 1.2, part 02

Part 02 of [Translation repair history: segment 1.2](translation-repair-history-01-early-foundation-segment-01-part-02.md),
whose index lists every part in order.

## Continued record, continued

### Preserved chronological continuation, continued

- B,
  broadened seeded benchmark:
  derive replacement and insertion
  seed classes modeled on the real error seed bank (meaning
  inversion,
  fabricated specifics,
  policy-violating additions);
  grade detection recall,
  within-region precision,
  and repair
  against exact planted truth.
  Pro:
  the planting substrate already
  exists,
  ground truth is exact,
  no human grading needed.
  Con:
  a synthetic proxy for the same unknown A measures directly,
  and it spends another accumulation loop before any real-corpus
  value ships.
- C,
  interactive steering driver:
  checkpoint serialization at
  stage boundaries plus typed steering operations (approve/strike
  issue,
  correct alignment,
  lock wording,
  force verdict) per the
  settled architecture.
  Pro:
  designed,
  and required for real
  adoption.
  Con:
  which steering operations matter is best learned
  from A's real output,
  and the consumer form is deliberately
  open.
- D,
  calibration bundle:
  canary calibration feeding panel weights,
  MiniMax scheduler weighting,
  judge-universe exclusion of blocked
  entries,
  per-model editor slates.
  Pro:
  all are recorded
  follow-ups.
  Con:
  explicitly "none yet requested",
  no driving
  number,
  and the ensemble currently absorbs the quirks.
Adjacent-pair reasons:
  A over B because A measures the real error
distribution and delivers corpus value while B proxies it;
B over C because B extends a proven harness toward a measurable
gate while C's requirements stay unknown until real output exists;
C over D because C has a designed contract while D lacks any
driving number.
USER PICK (2026-07-23):
  A,
  the real-corpus production pass,
  chosen
from the ranked options;
  the proposed defaults (50-issue uniform
sample,
  0.9 precision bar) were accepted without notes.
MILESTONE THREE IS THE REAL-CORPUS PRODUCTION PASS.
  Execution
follows the milestone-two accumulation pattern:
  budgeted runs,
per-entry artifacts outside the repo (UNLICENSED corpus) under
`~/temp/translation-repair-corpus/`,
  content-free tallies here.
DRIVER BUILT AND LAUNCHED (2026-07-23):
`~/temp/translation-repair-corpus/corpus-pass-driver.ts` (home temp,
not the session scratchpad,
  because milestone-two's scratchpad
drivers evaporated with their sessions and the user grades from
these artifacts later).
  It imports the built dist as a real
consumer,
  lists people at the pinned SHA,
  excludes `tdor` (measured:
neither `page.md` nor `page.en.md` at the pin,
  so the universe is
exactly the 92 pairs),
  skips entries with existing artifacts,
orders by fewest attempts then listing order,
  dispatches while
elapsed < 25 min with 4-minute per-call deadlines and a 45-minute
plain-timer outer net (never `AbortSignal.timeout` composition on
Node 26),
  roster all seven critics and panelists,
  GLM-5.2 editor,
GLM-5.2/Qwen/Kimi checkers,
  `perModelConcurrency: 1`,
  and writes
one full artifact JSON per entry (completion marker) plus a TALLY
stdout line per entry (status,
  issue counts,
  findings,
  wall).
Plan mode (`--plan`,
  zero quota) verified:
  92 pending.
Run 001 launched 2026-07-23 ~14:40 local,
  log
`~/temp/translation-repair-corpus/run-001.log`.
Per-run procedure:
  read TALLY lines,
  append content-free run record
here,
  commit,
  push,
  relaunch until every entry has an artifact.
Corpus-pass run log (all counts,
  no content):
run 001 (2026-07-23,
  2009 s):
  3 dispatched,
  3 completed,
  0 failed;
Acheron repaired (46 issues,
  45 accepted,
  45 resolved,
  5 findings,
911 s);
  AkiraComplex repaired (9/9/9,
  1 finding,
  479 s);
AmbeR_the_anpa repaired (23 issues,
  22 accepted,
  21 resolved,
3 findings,
  620 s).
  Remaining 89.
run 002 (2026-07-23,
  2064 s):
  2 dispatched,
  2 completed,
  0 failed;
Anilovr repaired (78 issues,
  70 accepted,
  69 resolved,
  12 findings,
1420 s,
  largest issue count of the pass so far);
  Aniloviraw
blocked-non-translation (34 issues,
  31 accepted,
  resolution never
ran,
  644 s),
  and a zero-quota probe rules this the FIRST FALSE
BLOCK:
  unlike XIEPT2/shi_Yumiaoya the en page carries zero CJK,
sizes match (~1.5 KB both sides),
  front matter and body translate
line for line on inspection.
  The log shows 4 of 7 critics cast
critical non-translation votes on the single chunk while the same
stage produced 59 claims;
  so the block logic worked as designed
(ensemble agreement) but the critic-level non-translation
classification is noisy on divergence-heavy quote-fragment diary
content.
  Decision:
  measurement continuity,
  pipeline unchanged
through the pass;
  false blocks get probed and tallied per entry,
and block calibration (for example requiring voters to file no
substantive claims themselves) is a named post-pass workstream.
Remaining 87.
USER DIRECTIVE (2026-07-23,
  supersedes the measurement-continuity
freeze recorded above):
  iteratively improve the system whenever a
change is highly confident to improve it,
  and RESTART ALL PASSES
after each such change;
  prior pass artifacts are discarded.
  Standing
procedure from here:
  discovery -> high-confidence fix -> unit tests
-> live sentinel validation where prior behavior is known -> commit
-> wipe artifacts -> restart pass numbering.
FIRST ITERATION (commit `6f11683fd`):
  deterministic contradiction
screening for non-translation votes.
  Threshold ideas failed
measurement first (length ratio:
  genuine pair Zha_Ke runs 16x en
over zh while correctly blocked XIEPT2 sits at 6.4x;
  CJK residue:
genuine shihai4h carries 6.8 percent versus correctly blocked
shi_Yumiaoya's 5.1).
  The surviving discriminator comes from the
category's own definition (wholly unrelated pair):
  validated claims
that critique translated content (category leaf outside omission/
untranslated/non-translation) and anchor at least one span into the
TARGET side contradict the votes deterministically.
  Aniloviraw
measured 44 such claims (and its panel had ACCEPTED a critical
non-translation issue,
  so panel routing alone would not have saved
it);
  floor set at 8 (ensemble-scale margin over a seven-critic
roster).
  New module `non-translation-evidence.ts`:
`assessNonTranslationEvidence` (verdict + count) and
`screenNonTranslationVotes` (dismisses contradicted votes together
with their non-translation claims pre-aggregation,
  emitting a
finding);
  `repairChunk` screens after the critic stage and exposes
`nonTranslationContradicted`;
  `repairTranslation` blocks only on
uncontradicted votes.
  NON_TRANSLATION_BLOCK_VOTES moved to the new
module (barrel path updated).
  Verification:
  87 suites pass against
dist including the new contradicted-path end-to-end test,
  oxlint
0/0 (max-lines remediated by moving screening logic into the new
module,
  never by raising the limit),
  lint:types exit 0.
LIVE SENTINEL PROBE:
  ALL PASS (2026-07-23,
  log
`~/temp/translation-repair-corpus/sentinel-probe.log`,
  artifacts
kept under `probe/`).
  XIEPT2 stayed blocked (blocked chunk:
  5
claims,
  4 votes,
  165 s);
  shi_Yumiaoya stayed blocked (blocked
chunk:
  7 claims,
  5 votes;
  its translated chunk drew 35 claims with
zero votes,
  983 s);
  Aniloviraw REPAIRED (4 votes reproduced across
independent runs,
  dismissed against 37 content-critique claims,
655 s).
  The floor of 8 sits in a wide gap:
  correct blocks at 5 and
7 total claims,
  the false block at 37 content-critique claims.
Run 004 had been stopped mid-flight;
  PASS 2 started from zero
(all pass-1 artifacts and attempts wiped,
  92 pending) under the
fixed pipeline,
  logs `pass2-run-NNN.log`.
Pass 2 run log (all counts,
  no content):
pass2 run 001 (2026-07-23,
  1502 s):
  2 dispatched,
  2 completed,
  0
failed;
  Acheron repaired (48 issues,
  46 accepted,
  45 resolved,
  7
findings,
  1012 s);
  AkiraComplex repaired (9 issues,
  8 accepted,
  6
resolved,
  3 findings,
  491 s).
  Both reproduce their pass-1 statuses
with nondeterministic count drift.
  Remaining 90.
SECOND ITERATION (2026-07-23,
  commit `c3ea27b23`),
  root cause named
by the user:
  multi-LLM value is OVERLAPPING coverage (A finds a b c,
B finds b c d),
  and each critic satisfices at 10 to 14 claims per
call regardless of defect density (the user counts 200+ issues on
Anilovr at first glance versus 33 found).
  Measured corpus-wide:
67 to 84 percent singleton issues across all pass-2 artifacts,
  so
losing a voice loses its findings nearly one-for-one;
  the earlier
full-roster-retry idea survives only as secondary hardening,
  not
the fix.
  Root-cause fix:
  PARAGRAPH-BOUND SLICES (user decision:
paragraph-bound,
  never sentence-bound,
  because sentence windows
reward mechanical one-to-one rendering over meaning and emotion).
`slice-pair.ts` subdivides each aligned section pair into
budget-bound node runs (never splitting a block node;
SLICE_CHAR_BUDGET 400 target chars;
  source budget scales by
character share so the denser zh side cannot collapse pairing back
to section scale,
  a flaw the unit test caught);
  the whole loop runs
per slice.
  Evidence base:
  on DarlinChit-scale units the ensemble
produced a 28-member agreement cluster,
  so small units yield both
thoroughness and overlap.
  CONTRACT CHANGE,
  dominance block:
  a
2-vote tiny slice must not block a document,
  so
`blocked-non-translation` now fires only when standing-vote slices
dominate target characters (`assessNonTranslationDominance`);
minority standing slices ship unchanged with findings (per-slice
degradation,
  matching the settled architecture's never-document-wide
rule).
  Consequence recorded:
  shi_Yumiaoya's expected production
outcome changes from blocked to not-blocked with its untranslated
region degraded per slice.
  `repairChunk` early-exits standing-vote
slices before panel and editor spend (types moved to
`repair-contract.ts` for the line budget).
  Secondary:
  critic stage
retries to FULL ROSTER (`retryTarget: 'full-roster'` in
`stage-quorum.ts`),
  voting stages keep quorum;
`stage-roster-incomplete` finding records shortfalls.
  Verification:
89 suites pass against dist (slicing byte-exactness,
  dominance,
per-slice degradation end to end),
  oxlint 0/0,
  types clean.
Sentinel probe 2 launched (four entries:
  XIEPT2 must block via
dominance,
  shi_Yumiaoya must NOT block under the new contract,
Aniloviraw repaired,
  Anilovr measures thoroughness against its
33-issue section-scale baseline with the user's 200+ as reference;
log `sentinel-probe-2.log`).
  Pass 3 restarts from zero on ALL PASS
plus a decisive Anilovr thoroughness gain.
THIRD ITERATION (2026-07-23,
  commit `666d87602`),
  user question "is
our union algorithm good" then directive "LLMs must act as part of
union algorithms".
  Findings from code plus measurement over pass-2
artifacts (192 issues,
  3496 same-chunk issue pairs):
  exact dedupe
can never merge cross-critic claims (free-text summaries differ),
so clustering is the only cross-critic union;
  the LLM half already
exists (panel ballots carry a sameDefect opinion per multi-member
cluster,
  majority merges,
  silence and ties split conservatively
because a wrong merge hides a defect),
  and the 243 same-family
overlapping-but-separate issue pairs are the panel's judged splits
working as designed.
  The real gap:
  the family gate in
`claimsShareDefect` kept 62 overlapping cross-family pairs
(accuracy vs terminology 23,
  accuracy vs fluency 12,
  accuracy vs
extension 9...) from ever reaching panel judgment.
  Fix:
  proposals
now arise from same-side span overlap alone;
  neither family nor
severity pre-decides,
  the panel disposes every proposal.
  Also
measured:
  only 3 of 192 issues carry single-side evidence,
  so the
same-side overlap requirement is not a material union gap.
  KNOWN
LIMIT recorded:
  disposal is binary per cluster (merge all members
or split to singletons),
  so a widened mixed cluster judged "not one
defect" splinters exactly as today,
  no regression;
  per-sub-group
disposal is the recorded refinement if graded evidence demands it.
Verification:
  89 suites pass,
  oxlint 0/0,
  types clean.
  The running
sentinel probe loaded the pre-union dist at process start and stays
internally consistent;
  Anilovr gets one re-run on the
current-tip pipeline for the thoroughness gate before pass 3.
NAMING RULE (user directive 2026-07-23):
  never call any pipeline,
gate,
  or artifact "final";
  the system is early in polishing and
every pass is one iteration among many.
  Say current-tip,
this-iteration,
  or name the commit.
FULL-ROSTER CRITIC RETRIES REVERTED (2026-07-23,
  commit
`78317a93c`,
  user decision "we shouldn't retry everything until ALL
respond" after the probe ran 70 minutes).
  Measurement vindicated
the concern only partially:
  critics answered 7/7 first-round in
nearly every probe slice (one critic retry fired in the whole log),
so the revert costs little;
  the REAL wall-time sink is the panel,
where the same four voices hit the full 240 s deadline slice after
slice before the retry recovers them.
  The full-roster mechanism
stays in stage-quorum.ts,
  tested but unused.
  SENTINEL PROBE 2:
  ALL PASS
(2026-07-23,
  pre-union dist,
  log `sentinel-probe-2.log`,
  artifacts
under `probe/`).
  XIEPT2 blocked in 565 s via dominance early exit
(0 issues,
  24 findings);
  shi_Yumiaoya REPAIRED with 79 issues under
the new contract (untranslated-region slices degraded per slice);
Aniloviraw REPAIRED,
  69 issues (up from 44 at section scale);
Anilovr REPAIRED,
  130 issues in 2681 s.
THOROUGHNESS GATE MET:
  Anilovr 130 issues versus its 33-issue
section-scale baseline,
  a 3.9x gain moving decisively toward the
user's first-glance estimate of 200+;
  per-entry wall time roughly
doubled (1358 s to 2681 s),
  the expected slicing cost.
CURRENT-TIP GATE (2026-07-23,
  Anilovr re-run on the union-widened,
quorum-retry tip,
  log `gate-anilovr-union.log`):
  PASS,
  repaired,
121 issues in 2547 s.
  Consolidation from 130 is the union working
(3 MIXED-FAMILY merged issues,
  structurally impossible before the
widening),
  not lost findings.
UNDER-MERGE CHECK,
  offline and zero quota:
  singleton share rose to
89 percent at slice scale,
  so near-miss anchoring was measured
directly.
  Same-slice issue pairs by nearest-span gap:
  361
overlapping (proposed and SPLIT by the panel,
  its conservative
disposal working),
  309 within 1 to 20 chars,
  324 within 21 to 60.
Sampling the 1-to-20 band showed every pair is a genuinely
DISTINCT defect on adjacent text (untranslated Esperanto phrase
beside an added sentence;
  preposition error beside a CJK
quotation-mark convention issue;
  heading mistranslation beside a
nuance shift),
  so proximity inside a small slice is adjacency,
  not
duplication.
  Widening the merge neighborhood would OVER-merge.
Verdict:
  the union algorithm is sound at slice scale and the high
singleton share reflects real defect density;
  no further union
iteration warranted on current evidence.
PASS 3 STARTED then STOPPED after two entries (2026-07-23):
  the
translation-policy directive below landed while it ran,
  so its
artifacts were discarded rather than spend quota on a superseded
prompt.
