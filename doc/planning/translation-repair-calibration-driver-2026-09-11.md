# Reviewed calibration driver verification

Task 34 gates paid task 31.
The reference package is verified at frozen `993583ad5`;
no paid judge,
writer or image calibration has run.
The driver lives in private `~/temp/agent/v41-reviewed-*.mts` files,
with `calibrate-v41-judges-20260911.mts` as its explicit-mode entry point.

## Registered inputs

The fixed manifest contains the independently read references and deliberate variants from
[the fixture plan](translation-repair-reviewed-calibration-fixtures-2026-09-11.md).
The driver compares every materialized tuple with that approved artifact before constructing questions.

The measured matrix has twenty-eight logical arrangements,
fourteen message-plus-schema questions,
and 140 model cells across the unchanged nine peers plus V4.1.
Planner-only abstentions are not model evidence.
All models' actual initial requests are checked for equality.
Message and schema positive controls move the question digest.
Equivalent direction bookkeeping is not scored twice.

Frozen output,
manifest and driver-source digests belong to the registered plan.
A live invocation rebuilds and compares the plan before constructing provider clients.
Every driver edit therefore requires a new plan.
Planner,
simulated and live ledgers use separate directories.
The previous invalid-gold driver is retained only as a `.source.txt` artifact.

## Stage depth correction

The original private two-call bound was not a valid reading of the existing stage.
The first simulation exposed identical-prompt retries.
A later source read found another boundary that the four-call correction had missed:
`package/module/translation-repair/src/stage-quorum.ts`
runs its initial call and `STAGE_RETRY_ROUNDS = 3` retries,
then one separate recovery round when unreadable answers remain.
That final round appends the exported `RECOVERY_NUDGE`.

The maximum is therefore five stage calls per single-model cell,
with a 700-call stage ceiling for this fixed matrix.
This preserves existing behavior;
it neither adds a generation round nor shortens the production recovery path.
The four-call simulation proved only the quorum-loop path,
not this post-loop recovery.
It remains historical evidence rather than current launch approval.

Proposed `AGENTS.md` clarification to `TC2`,
not applied:

```text
TC2: Test names aren't coverage. Walk full control flow, including post-loop recovery and delegated retry layers.
Verify each distinct path and derive total bounds from the whole call graph.
```

The expected action is underway:
the complete stage and delegated router/client paths were read,
and the new simulation targets the previously missed recovery branch.

## Physical calls and actual provider bodies

`provider-router.ts` bounds the initial budget-routing attempts by serving reach.
`provider-router-reask.ts` may ask one other serving stack after a nonconforming reply.
`transient-retry.ts` grants four retries after the initial HTTP attempt.
Each client's `chatText` uses that exchange ladder once.

The proposed physical bound preserves every existing layer:
serving-provider attempts plus the optional schema re-ask,
multiplied by HTTP attempts and stage calls.
It is calculated per model and summed over registered cells.
Budget GETs are recorded separately from model POSTs.
The existing global deadline remains another independent bound.

The driver captures both initial and recovery bodies through the actual compiled provider clients,
using a transport that records the request and then refuses any network operation.
Capture does not change the request's completion cap or body schema.
The zero-retry capture transport is not the live retry policy.

Live transport checks are intended to require:

- A registered model cell.
- A registered serving URL and provider spelling.
- The exact compiled body for that cell's initial or recovery request.
- The existing measured completion cap and absence of prohibited reasoning knobs.
- Per-cell and global physical-call bounds.

Private request and response records omit authorization headers.
Known credential values from those headers are redacted from recorded response text.
No raw traffic or secrets may be printed.
A transport that throws before returning a body cannot provide complete wire evidence;
its missing usage is not zero cost.

## Evidence and failure interpretation

The existing clean-count and damaged-count comparisons keep the fixed peer cohort.
Do not discard incomplete peers or change their quorum after seeing responses.
Candidate coverage and positive candidate/peer evidence are reported separately from those raw count conditions.
An absent candidate must not become admission evidence merely because peer clean counts are zero.

Simulated rows are rejected by admission scoring,
and simulated run reports omit admission scores.
All role changes still require source-reviewed assessment;
no driver writes production role arrays.

Persistence and invariant failures must stop model spending.
Uncaught cell errors and aborted runs must not emit a completed report.
Expected provider absence remains distinct from an infrastructure failure:
the existing pipeline may return a valid terminal outcome with no ballot.

## Verification status

Reference verification and source guard proofs are complete.
The corrected logical driver simulation completed 140 cells with 170 fake calls,
but it bypassed the physical transport wrapper.
It does not establish transport correctness.

The next verification uses the actual compiled router,
clients,
prompt cache and parsers,
replacing only physical transport.
It must exercise the existing HTTP retry ladder,
cross-provider schema re-ask,
cached stage retries and final recovery nudge,
then verify one ballot per model identity and no simulated admission score.
Negative route,
bound,
persistence and interruption controls remain required before any paid launch.
