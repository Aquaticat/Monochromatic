# Redesigning the translation-repair pipeline

## Status

This is a proposal record,
not an accepted architecture decision.
It supersedes overlap tuning as active work after stopped `Carena0442` run 1.
Do not implement a replacement until multiple interfaces have been compared
and one has been explicitly selected.

## Corrected requirements

### Every invocation has finite work

No stage may contain an open-ended quality loop such as
`while (!accepted)` or equivalent recursion,
queue self-replenishment,
or retry scheduling with no statically defined frontier.

Each invocation must have a finite call graph.
Every model responsibility,
maximum payload count,
and dependency edge must be known before invocation starts.
A rejected result cannot cause same stage to call itself again.
Changing text,
findings,
nonce,
round,
or prompt wording cannot extend frontier.

This requirement rejects current loops in
`package/module/translation-repair/src/consolidation-naturalness-settle.ts`
and
`package/module/translation-repair/src/consolidate-slice-buy.ts`
as replacement architecture.
Moving them behind new interface would not fix design.

### Quality deficit is never terminal no-output result

Successful run always returns good output.
Pipeline must not call quality refusal,
`ERROR`,
or `INCOMPLETE` terminal completion.
Rejected wording is not output,
but its rejection cannot end run with nothing.

Operational loss can suspend durable work.
Suspended work is not terminal run result and resumes from checkpoint without whole-entry restart.
Only terminal state visible as completed run carries publishable output.

Finite invocation and nonterminal suspension must be kept distinct.
An invocation may checkpoint after finite planned work;
run remains open until output exists.
This does not authorize hidden unbounded loop in process.

### Naturalness is not a measurement

`naturalness`,
`absolute naturalness`,
`naturalness floor`,
and similar labels are too unstable to serve as metric,
threshold,
or aggregate quality fact.
A panel vote does not turn term into measurement.

Future architecture must use concrete,
anchored editorial evidence:
wrong meaning,
omission,
addition,
identity change,
syntax damage,
grammatical error,
unclear reference,
inconsistent tense,
broken paragraph relation,
register mismatch,
or another explicitly named defect.
Subjective editorial judgment remains evidence,
not numeric or absolute measurement.

Existing telemetry can retain historical field names for old artifacts.
New schema and implementation must not present naturalness verdict count as quality measure.

### No generic final quality gate

Generic final Gate exists because preceding stages together do not reliably produce good text.
Adding stronger Gate,
more reviewers,
or another correction loop treats symptom.
Replacement must make quality responsibility part of transformation that creates wording.

Every text-producing stage needs explicit postcondition and accountable owner.
Later stage may consume evidence or assemble approved work,
but cannot be catch-all panel that rescues arbitrary upstream defects.
Final assembly should enforce deterministic integrity and publication mechanics,
not ask models whether combined pipeline happened to be good enough.

## Stopped Carena evidence

Run used pipeline digest
`sha256-tree-v1:0edfb04f6b9f7e0181de7b810ce483135dab59190c53cc6464433fb626bdff1e`,
overlap 4,
and both required providers wet.
It started at `2026-08-30T03:40:51.772Z`
and was stopped by user after 16,659 seconds of retained log time.
It produced no `TALLY`,
artifact,
or fixed page.

Consolidation started 8,735 seconds before retained log ended.
Eighteen slices were contested.
Four consolidation slices started;
one ended after 636,939 milliseconds with `exit=failed`,
and no other consolidation slice reached `SLICE-COST`.

Consolidation bought 186 roster rounds:

- 50 selection rounds
- 46 refiner rounds
- 46 rounds under historical `absolute-naturalness-review` name
- 41 consolidation polish gates
- 3 consolidation fidelity gates

Those rounds sum to 25,899,861 milliseconds because four slices overlap.
22,280,018 milliseconds,
86.0 percent of summed round time,
was post-quorum grace.
Forty of 46 historical naturalness reviews returned `unacceptable`;
five returned `acceptable`,
and one lacked quorum.

This is not provider outage.
Responses continued and both meters remained wet.
Overlap hid waits but could not make stage settle.

Durable sanitized evidence is
`doc/audit/translation-repair-carena-stopped-run.md`.
Complete partial evidence and analysis remain outside repository at:

- `~/temp/agent/analysis-Carena-current-overlap4-stopped-phases-20260830.json`
- `~/temp/agent/analysis-Carena-current-overlap4-stopped-latency-20260830.json`
- `~/Downloads/Carena0442-current-overlap4-run1-20260829/`

## Root-cause hypothesis

Current pipeline does not assign one module responsibility for producing finished English.
It composes candidate generators,
selectors,
fidelity gates,
refiners,
reviewers,
and polish gates,
then asks later panels to repair what previous panels accepted.

Per-slice candidate competition fragments document voice.
Selection identifies preferred candidate,
not necessarily finished wording.
A subsequent generic editor can alter source-faithful choice.
A subsequent generic review can reject any altered paragraph.
One dissent reopens full production,
selection,
and gate machinery.

`FINAL_POLISH_MINIMUM_CHARS = 0` in
`package/module/translation-repair/src/consolidation-polish-round.ts`
makes every structurally refinable paragraph eligible on every polish attempt.
`package/module/translation-repair/src/absolute-naturalness-review-stage.ts`
makes any usable rejection decisive.
`package/module/translation-repair/src/consolidation-naturalness-settle.ts`
adds each changed correction to prior evidence,
so exact cycle detector does not fire while wording and findings continue to vary.

These mechanisms make more review create more work without demonstrating convergence.
Concurrency cannot repair that relationship.

## Replacement design target

Explore interfaces built around finished-document authorship rather than stage rescue.
Candidate replacement should make these responsibilities explicit:

1.  Derive source-backed document specification,
    including identities,
    structure,
    claims,
    links,
    media evidence,
    and archive-supported context.
2.  Give one accountable document editor whole specification and whole archive context.
3.  Collect one finite,
    role-partitioned audit wave over draft.
    Roles discover concrete defects rather than assign naturalness score.
4.  Give one accountable reconciliation editor complete deduplicated defect dossier once.
    Accepted regions are locked unless dossier requires change.
5.  Assemble and verify deterministic structure,
    completeness,
    identity,
    source anchors,
    and publication integrity.
    No generic model Gate follows.

This shape is only initial design target.
Design-it-twice comparison must include alternatives with different seam placement.

## Questions design must answer

- How does one editor prove complete source coverage without per-slice candidate tournament?
- Which editorial defects require corroboration,
and which deterministic facts are enough alone?
- How can reviewer roles partition responsibility so same general opinion is not multiplied?
- How does reconciliation preserve accepted wording while resolving cross-paragraph issues?
- What finite frontier exists when reconciliation output still contains concrete defect?
- How does durable suspension resume without converting finite invocation into hidden unbounded retry?
- Which current caches and artifacts remain useful evidence,
and which encode architecture being removed?
- What user-facing interface makes one entry trivial to run,
inspect,
resume,
and publish?

## Immediate next evidence

Before selecting architecture:

- compare multiple radical interfaces against corrected requirements
- replay stopped Carena task ledger to calculate payload reduction each design would provide
- test each design against known omission,
identity,
archive,
visual,
front-matter,
and lane-choice fixtures
- define positive control proving concrete editorial defect detector can find seeded defect
- define negative control proving detector does not manufacture work from acceptable text
- require final output reading;
mechanical completion alone does not validate architecture
