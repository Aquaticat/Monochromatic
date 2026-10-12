# Translation repair history: segment 1.2, part 01

Part 01 of [Translation repair history: segment 1.2](translation-repair-history-01-early-foundation-segment-01-part-02.md),
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
