# Translation repair history: segment 1.2

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

WHAT THE SAME REVIEWS RAISED AND I DID NOT ACT ON,
each with the measurement
that says why it can wait.
None is a judgement call left open;
each is real and
currently unreachable on this corpus,
so acting would be building against
nothing:

-   THE RAW SCANNER AND THE PARSER STILL DISAGREE ABOUT ESCAPES.
    `\[^1]` is not
    a footnote to the parser and is a hit to the scanner,
    which stops on `[` and
    `^` without asking whether either was escaped.
    Measured over all 279 corpus
    markdown files:
    ZERO escaped `\[^` sequences.
    A false hit inflates a mention
    count on both sides of a comparison,
    so it moves attribution only when a
    replacement adds or removes one.
-   AND ABOUT WHITESPACE IN A LABEL.
    The parser accepts it and collapses it;
    `GFM_IDENTIFIER_STOPPERS` rejects the marker outright,
    so such a footnote
    yields no mention key and the guard would withdraw everything.
    Zero corpus
    identifiers carry whitespace;
    all 209 are digits.
    Fixing it means teaching
    the scanner the parser's label rules,
    which changes what
    `buildFootnoteGraph` reports as an unresolved reference,
    so it is a change to
    the graph rather than to a key.
-   AND ABOUT WHAT MAKES A FULL-WIDTH MARKER A DEFINITION.
    `buildFootnoteGraph`
    calls it a definition when it opens a block;
    `footnoteIdentifiers` requires
    the `：` after it.
    Measured:
    ZERO `〔N〕` markers in any of the 279 files,
    so
    this convention has no corpus instances at all.
    One shared classifier is the
    fix if that ever changes.
-   `spliceSlices` DOES NOT VALIDATE THAT SPANS DO NOT OVERLAP.
    It cannot today:
    every replacement it receives is keyed to a slice from one
    `prepareDocumentPair`,
    and those spans partition the document by
    construction.
    Assembly does refuse two replacements naming one index
    (`e66a18749`).
    Recorded because the construction argument is the only thing
    holding it,
    and it lives in another file.
-   DEFINITION HITS CARRY NO OFFSET,
    while reference hits do.
    Nothing needs one
    yet;
    a future finding that wanted to point at a definition would.
-   `PreparedDocumentPair` COULD CARRY THE PARSED INCUMBENT rather than having
    the guard reparse it.
    A performance note,
    not a correctness one,
    and the
    guard reparses per round anyway.
-   A SLICE KEY COULD IN PRINCIPLE LAND IN ANOTHER LANE'S NAMESPACE.
    `sliceFileName` writes `${prefix}${key}.json` and `belongsToNamespace`
    defines the repair lane as everything NOT starting with a claimed prefix,
    so
    a repair key beginning `translate.` would be written by one lane and adopted
    by the other.
    Measured on what is actually on disk:
    every slice file in
    every pass directory is a 64-character hex digest,
    so no key can carry a dot
    at all,
    and the key derivation is what holds it.
    Recorded rather than
    guarded for the same reason as the footnote-escape items:
    the population is
    empty,
    and a guard here would be built against nothing.
    A key scheme that
    stopped being a hex digest is what makes it real.
-   AN EMPTY CRITIC ROSTER SETTLES A DOCUMENT INSTEAD OF REFUSING IT,
    found by
    fault injection while proving the guard tests fail (`#93`).
    Configuring zero
    critic models runs the repair lane end to end and returns an UNCHANGED
    document with `status` settled and zero exchanges bought:
    no throw,
    no
    finding,
    nothing a later reader can tell apart from a page that needed no
    repair.
    The quiet path is deliberate for OUTAGES,
    where a stage with no
    usable voices must settle rather than poison the slice cache with an answer
    it did not get.
    A deterministic empty roster is a CONFIGURATION error,
    and
    the two are indistinguishable downstream.
    A corpus pass under that
    misconfiguration writes a directory of vacuous settled artifacts and looks
    like a clean run.
    NOT BUILT ON PURPOSE:
    where the refusal belongs is a
    design choice (lane entry,
    `runDocumentLanes`,
    or the corpus-pass boundary
    that builds the roster),
    and so is whether an empty ADJUDICATOR,
    EDITOR,
    CHECKER or REFINER roster deserves the same treatment,
    since silence means
    different things at those stages.
    `#93` carries the probe as evidence.

STATE:
NO PASS IS RUNNING,
deliberately.
`pass16` was stopped on 2026-08-14 with zero artifacts settled,
on the user's
ruling that there is no cost to stopping a to-be-discarded entry mid-flight:
the pipeline shape is decided and anything accumulating under the repair-only
shape is output the new shape replaces.
The driver EXISTS and is tested;
nothing calls it from the corpus pass.
A long run is blocked on two things rather than one:
Question 5,
which decides
what the pass does with a replacement,
and the wiring itself,
which is shaped
differently under each of that question's answers.
Do not restart accumulation before both,
or the same budget buys the same
discardable entries again.
The stopped pass left its `pass.lock` behind in
`node_modules/.monochromatic/translation-repair-runs-pass16`;
the next pass takes it over as stale and says so with a `LOCK taking over` line,
which is the first live exercise of that path.

WHAT LANDED,
and what it does not yet do:
`runTranslateStage` (`8e27504f1`,
tests `9411e833d`) renders one slice from its
original through several translators,
stands the archive's own translation among
them as one candidate,
and lets judges choose.
`translateDocument` (`e2deabf4d`) now drives it over a whole prepared pair,
and
that is the part `#89` was blocked on.
It could never simply replace `runEditorStage` at the old call site,
because
`repairChunk` returns before reaching the editor on exactly the slices
translation is meant to recover:
non-translation votes standing,
critics raising
no claims,
the panel cutting no envelopes.
The driver visits every slice instead.
WHAT REMAINS OF `#89` (updated 2026-08-15,
the combined driver now exists as
`runDocumentLanes`):
`corpus-pass.ts` opens no translate cache,
writes no
translate fields into the artifact,
and has no deadline accounting that keeps a
capped run from writing a settled artifact.
The preparation half is done:
`repairPreparedDocument` takes a prepared pair,
which is what a combined driver needs from this side.
The combined driver is Question 5 neutral only if it returns both lanes' outputs
without arbitrating between them,
so build it that way;
the `corpus-pass.ts` wiring is not neutral and waits on that answer.

WHAT NEEDS YOU,
in the order it blocks work:

1.   HOW WIDE the producing roles should be,
     and how to WRITE that width.
    You decided to widen them and separately ruled that provider counts must
    not be hardcoded,
     since the offering changes often.
    No structural bound survives to derive a number from:
     selection works with
    every model producing,
     because the discount applies to a judge's ballot for
    its OWN candidate only,
     and checker disjointness is being replaced by a
    weighting under `#91`.
    What moves with width is cost,
     ballot dilution and coverage,
     which is a
    tradeoff rather than an arithmetic the code can settle,
     so the number needs
    to come from you or from a measurement nobody has taken.
2.   A policy answer for the TRANSCRIBED-IMAGE class,
     unchanged and now urgent.
    Chinese pages hold letters as images;
     English pages transcribe and translate
    them.
    The class is now ENUMERATED,
     replacing the older "roughly 31 thousand
    characters,
     6 entries verified",
     which reproduces from no measurement I can
    take:
     8 target-only blockquotes over 1000 characters,
     across 6 entries,
    15299 characters,
     sitting inside a wider target-only population of 132
    blocks and 44731 characters that also holds translator apparatus and
    alignment slop.
    Exactly one transcription is invisible to that structural test,
     `shihai4h`
    at 102 source characters against 1665,
     because it was transcribed INTO a
    quote the Chinese also carries.
    A source-only translator has no source for that text and a source-only judge
    cannot tell dropping it from correctly omitting it.
    Your standing ruling,
     keep accurate translator additions,
     says it must
    survive;
     nothing in the lane yet makes it survive.
3.   `#66` and `#68`,
     human grading,
     unchanged and still the gate on probe
    calibration.

WHAT CHANGED OVERNIGHT 2026-08-13,
kept as the record of that session:

-   `#74` was REFUTED and is now REBUILT.
    The old fix could never have worked:
    `alignHeadings` cannot leave two headings unpaired at all,
    because a
    zero-affinity pairing scores 0 while two gaps cost `2 * GAP_PENALTY`,
    and
    the designed penalty was bounded by exactly that quantity.
    Attempts six
    (lexicographic scoring with an ambiguity path) and seven (the preamble as
    an empty-labelled unit) are prototyped and measured against PRODUCTION:
    90 of 92 entries pair identically,
    `XingZ60` keeps 12 of 13 pairs and loses
    only the wrong one,
    and the single refused entry,
    `XIEPT2`,
    holds 82
    characters of English against 6994 of Chinese.
    It is NOT LANDED,
    because
    with no translate stage `XIEPT2` would get nothing at all,
    and that is the
    destination decision `#70` owns.
-   The dominant cause of alignment fallback is an ASYMMETRIC PREAMBLE,
    not a
    missing section:
    exactly 5 entries corpus-wide,
    and they are 5 of the 7
    that fall back.
    That was the bigger half of the work and it was long
    assumed mechanical.
-   Prerequisite 3 is MISPAIRING,
    not unsupported content,
    but the first
    version of that answer overclaimed and was corrected in place.
-   Option B's cost is 1.56x the editor calls and 3.9x its output,
    not a
    multiplication of the run,
    because the editor already fires on 64% of
    slices.
-   `#72` stands,
    through TWO alarms.
    The first pooled `slice-cache` with
    `artifacts`;
    the second was `Futajuhuacha` supplying 7 of 8 hits.
    The
    monitor now alarms only when a share survives dropping its largest single
    contributor,
    which is the rule covering all three false alarms this
    session.
-   `quote-not-found` now records WHICH quote missed,
    not only that one did
    (`b8c678e0a`),
    which takes down one of the four recurring-wall instances.
    Landed without restarting `pass13`;
    a detached watcher at
    `~/temp/agent/continue-pass13.sh` RESUMES that run when its budget expires,
    carrying its settled entries forward rather than re-doing them.
    Cancel with
    `pkill --full continue-pass13.sh`.

WHEN FIFTEEN SETTLE:
1.    `mise run //package/module/translation-repair:draw-sample -- --final`.
    It now writes THREE files:
      both sheets and `sample-manifest-<seed>.json`.
    The manifest is not optional and cannot be regenerated later;
    see "The draw recorded nothing about what it drew".
2.    Hand the user `doc/runbook/translation-repair-round-three-grading.md`.
    Detection sheet FIRST and alone,
      then the repair sheet.
3.    `score-agreement` for the precision gate (bar 0.9;
    round one 0.560/0.636/0.680,
      round two 0.740/0.787/0.800).
4.    `score-probe --repair-sheet PATH --manifest PATH` for the probe.

SUPERSEDED 2026-08-07:
TASK 53 IS ANSWERED,
do not re-ask it.
Put to the user
with `AskUserQuestion`,
they chose to keep the probe in SHADOW MODE.
The four
options,
the full ranking,
and the condition that reopens the question live in
`doc/decision/introduced-defect-probe-gating.md`,
which is canonical.
`refutedByHuman` from step 4 is the evidence that reopens it,
and revising that
document is what to do with it.

When scoring the probe,
subtract `refinedJoined` before reading any other
count:
on those positions the probe judged wording the naturalness lane
replaced,
so they compare two different texts.

DO NOT start the recall re-measure (task 51) while a pass is running;
it
contends for the same quota.

MILESTONE TWO DECLARED COMPLETE (2026-07-18,
user directive
"Promote the clause-enumeration rule and declare milestone two").
Final accumulated numbers over 20 judge-graded runs (22 to 41),
repairable universe:
judge strict 80/96 (0.83);
PROBE-ADJUSTED
EFFECTIVE 94/96 (0.98);
lenient 92/96 (0.96);
detection 166/174
(0.95,
the four falses being correct refusals of not-derivable
content);
lexical (retired comparison) 59/96 (0.61).
Every miss is
attributed:
embellishment-capped partials,
correct refusals of
unfounded content,
and TLL1122's two derivable seeds,
one of which
the now-promoted clause-enumeration rule (commit `b6967cbc9`)
reproducibly fixes.
The accumulation loop is CLOSED;
run 42 (in
flight at declaration,
old baseline prompt) gets recorded as the
final baseline-era run when it lands,
and no run 43 follows.

PKG COMPLETENESS PASS COMPLETE (2026-07-23,
user "Continue."
after
closure;
the handover's NEXT AFTER CLOSURE named this phase).
README refreshed with milestone-two completion and the
editorRuleAddendum contract knob (commit `479bf5a28`).
API surface audit (mechanical barrel-versus-module diff,
scratchpad
`api-surface-audit.ts`):
three accidental omissions surfaced into
`index.ts` (commit `0482bb9e6`):
`locateQuote` + `QuoteLocation`
(whole module missed the barrel),
`CategoryRemap` (return type of
public `remapCategoryLeaf`),
`MIN_DISPATCH_BUDGET_MS` (parity with
the public repair floor).
The audit's stale flag on `BenchmarkEntry`
was a false positive:
`benchmark.ts` re-exports it from
`prepare-entry.ts`.
Coverage gap map (scratchpad `coverage-map.ts`,
exported symbol to
importing test):
direct tests added across six commits
(`6bd1dccb7`,
`959b81df8`,
`14b3a3fcd`,
`235a28583`,
`5ca27b00b`,
`601f3bbb1`) for locateQuote,
normalizePunctuation,
the JSON
guards,
remapCategoryLeaf,
isPanelVoteState,
parseModelJson,
formatUsageNote,
extractCompletion + readUsage + SyntheticHttpError
(every contract-violation detail),
armCallDeadline (expiry,
forwarded abort,
pre-aborted caller,
disposal),
fetchTransport
(previously zero test references;
header copy,
GET body omission,
status passthrough,
dependent-signal abort),
prepareBenchmarkEntry
(previously zero test references),
all four prompt sheet builders
(critic,
derivability,
resolution,
restoration judge) with their
verdict guards,
buildFootnoteGraph (both conventions,
every
finding kind),
parseMarkdownBody,
and a DEFAULT_JUDGE_MODEL_IDS
catalog-membership invariant.
Indirect coverage judged adequate per TC2 (branch-named tests in
callers):
repairChunk and the four pipeline stages via
repair-translation's end-to-end suite (happy,
checker-refusal,
no-issues,
non-translation block),
exchangeWithRetry and
attemptStageCall via the client and quorum suites,
computeScorecard
via the benchmark suite.
Closing verification:
85 unit suites pass,
oxlint 0 warnings 0
errors,
lint:types exit 0.
DIST-IMPORT ALIGNMENT COMPLETE (2026-07-23,
user "Align it.",
resolving the open question this section used to carry).
Every unit
test now imports package behavior from the built bundle per the
testing-practices skill;
none import sibling source anymore.
Enablers:
the package was scaffolded without its sibling one-liner
rolldown config so no dist bundle could ever build (source-importing
tests hid this);
the config landed and the bundle plus `.d.mts` now
build.
SUPERSEDED 2026-08-06 (user "Please turn this pkg into `node`
builds only."):
the target moved from `neutral` to `node`,
so the
import path is now `dist/final/node/index.mjs`.
Rolldown's `cleanDir`
clears only the output directory it writes,
so a checkout that built
before this change keeps a stale `dist/final/neutral/` that nothing
removes.
Harmless,
since no manifest entry and no import points at it
now,
but delete it rather than wondering why both exist.
A pre-alignment audit proved every test-imported symbol
already public (the PKG surface pass had closed the last gaps).
Mechanical codemod (scratchpad `dist-import-codemod.ts`) merged
each file's relative imports into one dist import with inline type
markers.
Verification:
85 suites pass against dist,
oxlint 0/0,
lint:types exit 0,
and the `buildAndTest` task exercises the same
sequence end to end.

MILESTONE THREE SCOPING PROPOSED (2026-07-23,
user "Scope milestone
3").
Deliberation only;
no implementation authorized yet.
Grounding facts measured this session:
`derive-seeds.ts` emits only `kind: 'deletion'` seeds while
`seeded-error.ts` already plants deletion,
replacement,
and
insertion;
no checkpoint serialization,
policy-file seam,
or
dossier (entities,
terminology) module exists in src
("checkpoint" appears only in design comments,
and
`tally-votes.ts` notes adjudication is replayable).
Options,
ranked A > B > C > D:
- A (RECOMMENDED),
  real-corpus production pass:
  run the proven pure
  fn unseeded over all 92 pinned pairs through the budgeted
  accumulation loop until every entry carries a settled status
  (repaired,
  unchanged,
  or blocked-non-translation;
  known-hard
  entries such as BI4PBV produce honest degraded statuses,
  nothing
  is excluded).
  Artifacts (issues with fates,
  repaired text,
  findings,
  status) stay outside the repo because the corpus is
  UNLICENSED;
  the handover records content-free tallies only.
  Headline gate:
  precision of accepted issues on a human-graded
  uniform sample (proposed 50 issues at a proposed 0.9 bar,
  user
  sets both),
  because a judge ensemble drawn from the same seven
  models re-affirming its own panel's acceptances is circular;
  a zh-anchored judge crosscheck over all accepted issues is the
  secondary,
  machine-graded number.
  Safety invariants:
  zero
  deterministic-gate violations,
  zero regression-majority
  selections,
  unchanged or blocked wherever nothing beats the
  input.
  Cost extrapolated from the measured DarlinChit
  full-pipeline datum (523 s,
  ~8.5 weighted units):
  92 entries on
  the order of 13 hours wall and 800 weighted units spread over
  days of budgeted runs,
  inside regeneration;
  larger entries chunk
  into more calls,
  so that extrapolation is a floor.
  Pro:
  measures the one unmeasured dimension that matters
  (real-error precision;
  milestone one deliberately skipped
  precision grading),
  meets the recorded deferral condition
  ("until the pure fn proves itself"),
  and produces both the
  corpus deliverable and the data that would justify B,
  C,
  or D.
  Con:
  the headline sample needs user grading time,
  and artifacts
  must live outside the repo.
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
