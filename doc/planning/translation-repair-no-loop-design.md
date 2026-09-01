# No-loop production remediation proposal

## Status

Proposal,
2026-09-01,
implementing the
[post-redesign direction decision](../decision/translation-repair-post-redesign-direction.md)
and its no-loops refinement
("loops are discouraged altogether...
Discouraged,
not a ban.
You can overrule on this if you provide enough evidence and get an approval").
Grounded in
[`translation-repair-redesign-insights.md`](translation-repair-redesign-insights.md).
Supersedes the loop-bound shape in
[`translation-repair-bounded-quality-termination.md`](translation-repair-bounded-quality-termination.md).
Needs owner approval on the two decision points at the end before code.

## Why the loops exist, and why they go

The unbounded correction loops are takeover additions:
continuous correction landed in generation 13 on 2026-08-29
(`1d16d89c4`),
and the archive-block,
preparation,
and insertion continuations landed in the same generation series.
The owner's stated rationale for removing them:
they were built "under an assumption that models are bad,
which isn't really true as of today".
The loops compensate for weak model output by re-asking until a panel is satisfied;
with current-generation models the compensation is the cost center,
not the safety net,
and the stopped Carena run measured it buying churn rather than convergence.

## Design rule

Every model stage is a producer or a selector inside a fixed-depth graph.
No stage may reject without replacing,
no response creates work,
and reviews are recorded evidence,
never withholding authority.
This is the owner's own corrected-requirements language applied at slice scale,
where the insights show responses fit completion budgets and the wide OCR-bridged roster stays usable.

Where a bounded second round exists it is a statically named graph node,
not a loop:
depth is fixed before the first provider call.

## The six loops and their replacements

### Consolidation naturalness correction, removed

`settleNaturalnessCorrections` and the absolute-naturalness review's blocking authority go away.
Consolidation becomes:
produce slate once,
judged selection once,
deterministic gates
(preservation,
structure,
declared names),
then one fixed polish round:
refiners propose,
judges select between proposal and standing text,
the deterministic guard applies,
and a declined proposal leaves the standing text shipping.
Absolute-naturalness findings are recorded as evidence on the settlement.

Evidence:
86 percent of the stopped Carena run's consolidation round time was post-quorum grace;
acceptance demanded near-unanimity of eight seats and passed 5 of 46 times;
22 of 40 blocks came from a single seat;
serial correction without located evidence measurably degrades text (D1.3);
and the judged-contest form is the one that produced the page a reading accepted.

### Consolidation recovery, single attempt

`buyConsolidationSlice` makes one attempt.
When standing may not ship and the settlement still needs recovery,
deterministic selection takes the best produced candidate;
zero produced candidates remain the bounded provider error.

### Translate follow-up, fixed depth two

Initial production plus at most one statically named follow-up round carrying the judge's rejection evidence,
mirroring the measured recovery round that brought back three of four re-asked answers.
After that the slice settles as unfilled or incumbent-kept,
never as a thrown entry.

### Archive-block review, single round

Unresolved blocks are retained with findings;
reviewer indecision cannot withhold the entry.

### Preparation revision, fixed depth two

One preparation,
selected corrections applied once,
one re-preparation over the corrected archive.
Remaining unclaimed blocks become findings.

### Insertion placement, fixed depth two

One coverage round plus one placement repair round.
Passages still unresolved stay unfilled and flow to `UnfilledPageError`,
which remains the one bounded no-page terminal,
because no admissible candidate for required content was produced.

## Entry terminals after the change

The three-bucket classification from the bounded-termination plan carries over unchanged:
quality-withholding `INCOMPLETE` classes retire,
deterministic-integrity classes stay,
infrastructure and model-output classes stay.
The two-seat located-agreement floor from the zero-spend replay becomes moot for stages that no longer block;
it stays available if any blocking review survives design review.

## Portable guards landing regardless

- Truncation-as-unusable in production's `readJsonOutcome`:
  today content that parses wins even at `finish_reason=max_tokens`,
  the exact defect `doc/troubleshooting/charm-hyper-max-tokens-tool-json.md` records;
  the rejection feeds the existing bounded schema-mismatch recovery.
- Corpus-pin environment override
  (clone dir and commit),
  replacing the throwaway edits the Carena fixture runs used.

## Roster refresh options

Production's writer seats
(Qwen3.8-27B,
Kimi-K3,
gemma-4-26b)
were measured before the current Hyper top end existed.
The live Hyper catalog now carries qwen3.8-flash and qwen3.8-max (vision, 128,000 and 65,536 output),
qwen3.8-2.4t-a95b,
full glm-5.3 (262,144 output),
deepseek-v4-pro and -flash (384,000 output),
minimax-m3 (512,000 output),
and glm-5.3-flash whose own ceiling is 131,072 where the project vetted 32,000.
Synthetic's live listing today
(11 rows fetched 2026-09-01 from its models endpoint)
adds GLM-5.2 and Nemotron-3-Super-120B beyond what is seated,
so the advancement is concentrated on the Hyper side.

- R1,
  keep the measured roster:
  cleanest attribution,
  but leaves the advancement unused against the owner's stated premise.
- R2,
  seat obvious upgrades unmeasured and let the four-entry pass read the combination:
  fastest leverage;
  the owner has accepted exactly this bundling before
  ("Bundle all the improvements that could be made, in"),
  at the recorded cost that no delta attributes to one change.
- R3,
  run the existing producer-calibrate and editor-calibrate instruments over the refreshed candidate set first,
  seat winners on measurement,
  then pass:
  matches the repo's seat-on-measurement practice and vets each new route's real ceiling,
  at one calibration run of extra spend and time.

Ranking:
R3 over R2,
because seats decided by 40-round disinterested ballots have repeatedly overturned headline impressions
(qwen3.8-max's best headline was survivorship on the easy half),
and the calibration also vets routes and ceilings the pass will depend on.
R2 over R1,
because R1 spends the whole pass without testing the premise the owner named.

## What stays

Slice-scale two-lane shape,
lane contest,
deterministic guards,
slice caches,
the overlap dial,
the OCR reading lane,
the four-entry completion set,
and the pass-then-reading gate.

## Decision points

1.  Approve the loop-free shape above,
    including the two explicitly retained fixed-depth-two stages
    (translate follow-up, preparation revision, insertion placement)?
2.  Roster: R1, R2, or R3?
