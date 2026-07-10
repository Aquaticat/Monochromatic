# Plan: improve the choosing-technology skill

Status:
draft under grill-me review.
Decisions 1 through 6 are resolved;
full-validation scope remains open.
No skill changes are authorized by this plan.
The plan will be updated after each resolved planning decision.

## Goal

Make `.agents/skills/choosing-technology/SKILL.md` at least as dependable in practice as
`.agents/skills/troubleshooting-doc/SKILL.md`.

The improved skill must preserve the current strengths:

- constraints decide before familiarity;
- existing tools are considered before custom implementations;
- serious candidates are read from source rather than judged from metadata;
- maintenance is interpreted from behavior rather than open issue count;
- high-trust code is judged for human auditability;
- recommendations name alternatives and concrete rejection reasons;
- adopted choices receive a durable decision record.

It must also become executable without contradictory lifecycle rules,
category confusion,
or an unbounded candidate audit.

## Benchmark

The user set `troubleshooting-doc` as the quality floor.
That skill is effective because it has:

- a precise trigger and mandatory deliverable;
- one explicit workflow from investigation through durable artifact;
- required output sections;
- a conservative default at the consequential fork;
- gates with named pass and fail conditions;
- concrete recovery behavior when a gate is incomplete;
- a canonical worked artifact;
- a final checklist that matches the body of the skill.

Length is not itself a defect.
`wc --lines --words --bytes` measured `choosing-technology` at 602 lines and 18,331 bytes,
while `troubleshooting-doc` is 549 lines and 16,958 bytes.
The target is therefore not an arbitrary line cap.
The target is the benchmark skill's operational precision,
coherence,
and closure.

## Evidence reviewed

Primary instructions:

- `.agents/skills/choosing-technology/SKILL.md`;
- `.agents/skills/troubleshooting-doc/SKILL.md`;
- `/home/user/.pi/agent/skills/write-a-skill/SKILL.md`;
- `AGENTS.md`, especially the decision-verb,
  measurement,
  option-ranking,
  external execution,
  verification,
  and decision-document rules;
- `docs/philosophy/agents.md`, especially the rationale for moving technology-selection detail into a skill.

Representative outputs that invoke or describe the current skill:

- `docs/audit/zstd-vet-2026-06-17.md`;
- `docs/audit/mise-keep-vs-build-own.md`;
- `docs/audit/pitchfork-jdx.md`;
- `docs/decisions/jsonc-edit-parser-foundation.md`;
- `docs/handover/image-processing-library-vet.md`.

Maintenance evidence:

- `file-enforcer.config.ts` identifies `.agents/skills/` as canonical and mirrors it into
  `.claude/skills/` and `.factory/skills/`;
- SHA-256 comparison found the canonical choosing-technology skill differs from both mirrors;
- a no-index diff showed the mirrors lack the current external-code-execution gate;
- `git log --follow` shows the skill accumulated several independent policy additions after its initial extraction from
  `AGENTS.md`.

## Current strengths

### Context questions prevent false starts

The context-fork section correctly distinguishes facts that change the candidate set from facts that can be researched.
The sampled zstd,
Pitchfork,
and image-processing artifacts all benefited from stating workload and trust boundaries before ranking tools.

### Tool-first analysis catches false build-versus-buy choices

The existing-tool-first and alternatives rules kept the zstd,
JSONC,
and mise assessments from treating a custom implementation as the automatic answer.
This is a high-value default and must remain mandatory.

### Source audits change decisions

The source,
test,
CI,
fuzzing,
and integration checks found evidence that registry metadata would not expose.
Examples include Pitchfork's proxy trust behavior in `docs/audit/pitchfork-jdx.md` and image-library build and runtime failures in
`docs/handover/image-processing-library-vet.md`.

### Maintenance checks require interpretation

The current skill correctly rejects issue count as a standalone signal.
The sampled artifacts distinguish active releases with weak support,
maintained projects with large backlogs,
and low-signal tiny repositories.

### Human auditability is treated as a selection property

Code volume,
dependency surface,
architecture shape,
and concentration of sensitive behavior are useful trust criteria for plugins,
CI code,
and credential-handling dependencies.
This criterion should remain orthogonal to feature fit.

## Findings to fix

### Blocker: the recommendation lifecycle contradicts itself

The skill says SaaS candidates cannot be named before vetting at
`.agents/skills/choosing-technology/SKILL.md:103-106`.
It later says the decision document is written after the user picks at lines 446 to 450,
but the final checklist requires that decision document before any candidate is named at lines 553 to 602.
The worked example also names candidates before the described vetting is complete.

The replacement must distinguish these states:

- candidate discovered;
- candidate survives hard-constraint screening;
- candidate becomes a serious alternative;
- candidate becomes a finalist;
- finalist is recommended;
- user or prior policy adopts the recommendation;
- adopted decision is recorded.

Recommendation is the answer to an evaluation request.
The automatic vet report selected in Decision 3 is a process artifact,
not adoption.
Product code,
dependencies,
configuration,
and the durable decision record remain unchanged until the user's verb authorizes adoption.

### Blocker: applicability routing is unclear

The introduction says to skip none of three layers,
but the vendor layers apply to SaaS and the tool rules apply to libraries,
frameworks,
and build tools.
A managed service,
an open-source package,
a proprietary local tool,
a replacement dependency,
and high-trust executable code need overlapping but different checks.

The improved skill must classify the subject first and mark every gate as:

- applicable;
- not applicable with reason;
- passed;
- failed because the evidence or candidate does not meet the gate;
- low-signal,
  only for soft observational criteria where absence does not establish health or failure.

Human auditability is a risk modifier,
not a product category.
A hosted service's use of an open-source engine must not be presented as proof that its control plane is open source.

### High: the candidate funnel has no stopping rules

The phrases `every meaningful candidate`,
`serious alternative`,
and `finalist` are undefined.
The image-processing handover lists thirteen cloned repositories,
reports a scratch install of 137 packages,
and still ends with required synthesis work.
The work produced useful evidence,
but the skill did not tell the investigator when broad discovery should stop or which candidates no longer justified full validation.

The improved skill needs explicit promotion and exit criteria:

- discovery records the search space;
- hard constraints eliminate candidates cheaply;
- serious alternatives are plausible survivors with no known hard failure;
- finalists are the small set that could still win;
- source and maintenance depth increases only as a candidate advances;
- a recorded hard failure stops further work unless evidence is needed to compare a close tradeoff.

### High: evidence quality and failure semantics are underspecified

The SaaS section names reviews,
layoff trackers,
and aggregators,
but does not rank source authority,
require dates,
or record counterevidence.
It requires a 24-month layoffs window at
`.agents/skills/choosing-technology/SKILL.md:108` and a 12-month outage window at line 121.
The user confirmed those windows should remain,
but the current sentence that any failed layer makes a vendor worse does not distinguish a hard failure from a relevance-gated score reduction.
The current domains also omit direct risks such as terms stability,
data portability,
and exit cost.

Each decision-relevant claim should record:

- claim and why it matters;
- source and access date;
- primary evidence where available;
- independent corroboration where material;
- counterevidence;
- hard constraint,
  weighted risk,
  or soft observational signal;
- pass,
  fail,
  not-applicable,
  low-signal,
  or scored-concern status;
- score effect for every relevance-gated concern;
- rating confidence and sensitivity range when evidence is low-signal.

Critical evidence does not receive a neutral unknown state.
An uninspectable high-trust plugin,
unknown build provenance,
or native artifact without source-to-binary verification exits the candidate funnel.
NDA-only material does not satisfy a public evidence gate.
Soft evidence can be low-signal:
a tiny repository with no issues or pull requests is judged through releases,
commits,
ownership,
source,
and relevant tests rather than treated as healthy or failed from tracker silence.

Reviews and aggregators are discovery or corroboration sources,
not substitutes for official terms,
status history,
security disclosures,
source,
or reproducible behavior.

### High: execution safety is a rule without a procedure

The new external-code-execution gate has the correct conservative outcome,
but does not specify what inspection establishes safety.
It also sits apart from the later requirement to build and run every surviving candidate.

The improved skill should require an execution manifest before third-party code runs:

- exact source and revision;
- exact command;
- lifecycle and generated commands it can invoke;
- native,
  Wasm,
  plugin,
  and shell boundaries;
- expected filesystem writes;
- network and credential access;
- resource bounds;
- disposable environment;
- expected success evidence.

An unknown or uninspectable execution path remains disqualifying.
Isolation limits impact but does not convert unknown code into trusted code.

### High: the required output does not fully encode repository option policy

The skill requires alternatives and rejection reasons,
but not a complete pros-and-cons treatment and fully sorted ranking for every live option.
`AGENTS.md` requires both.
The worked SaaS example gestures at checks rather than demonstrating evidence-complete comparison.
It also contains dated vendor and price claims that can become stale.

The improved skill needs one output contract:

- decision and scope;
- hard-gate results separated from relevance-gated scores;
- known context and unresolved preferences;
- candidate funnel with exit reasons;
- per-finalist hard-constraint status;
- per-finalist pros,
  cons,
  evidence limits,
  evidence,
  and score breakdown;
- complete ranking with the reason for each adjacent ordering and every score difference that affected it;
- recommendation confidence and blocked checks;
- vet-report path and governing skill revision;
- adoption status;
- decision-document status.

Replace the current vendor example with a synthetic example or a link to a canonical,
evidence-complete repository artifact.

### Medium: requirements are duplicated instead of routed

Alternative counts,
decision-document maintenance,
source auditing,
and auditability recur in the body,
violation signals,
worked example,
and final checklist.
Duplication has already allowed the lifecycle contradiction to appear.

The benchmark does not require a short file,
but it does require one authoritative statement of each gate.
The final checklist should reference the same phase and gate names rather than restating subtly different rules.

### Medium: mirror freshness is not verified

`file-enforcer.config.ts` is the canonical mirror mechanism,
but the generated copies currently lag the canonical skill.
The implementation plan must regenerate them and add a verification path that fails when generated skill mirrors drift.
Generated mirrors must not become independently edited sources.

### Medium: historical artifacts cannot identify the governing skill revision

The sampled artifacts cite the skill by name,
but most do not record its commit or revision.
Because the requirements changed repeatedly,
later readers cannot reliably distinguish a skipped check from a check added after the audit.
Future technology audit and decision artifacts should record the skill revision used.

## Proposed target design

Keep one comprehensive `.agents/skills/choosing-technology/SKILL.md` as the complete authority.
Do not distribute the governing workflow or category gates across reference files.
The file may remain long when operational detail earns its place,
matching the troubleshooting-doc benchmark.
Use named lifecycle phases and gates inside that file so each rule has one authoritative location.

### Entry contract

The entry section should define:

- triggers;
- mandatory classification step;
- lifecycle state machine;
- invariants that apply to every category;
- recommendation-versus-adoption boundary;
- output contract;
- completion checklist keyed to named gates.

### Weighted scoring contract

Apply weighted points to every relevance-gated concern for SaaS and technology candidates.
Hard gates remain outside the score and cannot be compensated.

Before scoring candidates:

- derive criterion weights from known requirements and resolved user preferences;
- publish and freeze the criteria,
  applicability rules,
  and weights before reading candidate-specific soft-risk results;
- use a weight from 1 to 5,
  where 1 is marginally relevant and 5 is decisive if it were not already a hard gate;
- remove duplicate criteria and assign overlapping evidence to one primary criterion.

For each applicable criterion:

- rate the candidate from 0 to 4,
  where 0 is a serious concern,
  1 is weak,
  2 is acceptable,
  3 is good,
  and 4 is strong;
- cite the evidence supporting the rating;
- state confidence as high,
  medium,
  or low;
- treat genuinely inapplicable criteria as not applicable rather than giving free points;
- treat a low-signal source as a confidence limitation,
  then score from other relevant evidence or carry a sensitivity range rather than inventing facts.

Calculate the normalized score as earned weighted points divided by maximum applicable weighted points,
then multiply by 100.
Publish the full breakdown,
not only the total.

Run a sensitivity check when finalists are close or any influential rating has low confidence.
If moving one low-confidence rating or weight by one step changes the winner,
report the ranking as unstable and either gather decisive evidence or ask the unresolved preference.
A numeric score never replaces candidate pros,
cons,
evidence limits,
or the required reason for each adjacent ranking.

### Shared workflow

Use this sequence:

1. Read repository and deployment facts that can be measured.
2. Ask one context-fork preference only when it changes the candidate set.
3. Classify the subject and activate applicable gates.
4. Discover candidates broadly enough to avoid anchoring.
5. Apply hard constraints and critical evidence gates;
   record unavailable critical evidence as a failed exit,
   not a neutral unknown.
6. Promote plausible survivors to serious alternatives.
7. Run category-specific evidence checks.
8. Promote candidates that could still win to finalists.
9. Inspect execution safety before running any third-party code.
10. Source-audit and validate finalists at the consumer boundary.
11. Compare finalists with pros,
    cons,
    evidence limits,
    weighted score breakdowns,
    sensitivity results,
    and a complete ranking.
12. Write or update the automatic vet report when the substantial-evaluation threshold is crossed.
13. Recommend without changing product code,
    dependencies,
    configuration,
    or decision records when the request is evaluative.
14. After adoption is authorized,
    update the decision document and record rejected alternatives.

### Category gates

Keep distinct check sets for:

- managed service or SaaS,
  retaining the 24-month layoffs and 12-month outage windows while adding direct operational risks;
- open-source library,
  framework,
  build tool,
  or local executable;
- proprietary local tool;
- incumbent dependency replacement;
- high-trust execution boundary.

Shared gates cover licensing,
constraint fit,
alternatives,
evidence freshness,
security,
maintenance,
source provenance where source exists,
validation,
and output quality.
Category gates add only what materially differs.

### Candidate promotion rules

A candidate is discovered when a credible search finds it.
It becomes a serious alternative only when:

- it plausibly satisfies every known hard constraint;
- it has no known disqualifying license,
  provenance,
  security,
  or reproducibility failure;
- its product category matches the actual job;
- enough evidence exists to justify deeper work.

A serious alternative becomes a finalist only when it can still outrank the current leader after known tradeoffs.
Every exit receives a concrete reason and evidence.
A candidate that cannot win receives no further expensive validation.

### Validation levels

The plan should avoid a menu that lets agents lower the quality bar arbitrarily.
Instead,
validation depth should follow candidate state and risk:

- discovery:
  metadata and primary documentation only;
- serious alternative:
  targeted source,
  provenance,
  maintenance,
  and safety inspection;
- finalist:
  full relevant source audit,
  reproducible build or installation,
  upstream validation appropriate to the claimed surface,
  and consumer-boundary exercise;
- high-trust finalist:
  finalist checks plus human-auditability and concentrated security-boundary review.

A skipped critical check is a failed gate.
A soft criterion with sparse evidence remains low-signal with an explicit confidence range.
Neither silently becomes a pass.

## Implementation plan

### Phase 1: resolve the operating model

Use grill-me to settle:

- exact definition of full relevant validation.

Update this plan after each answer.
Do not edit the skill during grilling.

### Phase 2: rewrite the lifecycle and routing contract

- Define the candidate lifecycle states and legal transitions.
- Separate recommendation from adoption and decision-document mutation.
- Add subject classification and applicable-gate routing.
- Replace `skip none` with `skip no applicable gate`.
- Define hard failure,
  weighted risk,
  low-signal,
  and not-applicable outcomes.
- Define promotion and stopping rules.

### Phase 3: make evidence and safety executable

- Add the weighted scoring contract with precommitted context-derived weights,
  0-to-4 evidence ratings,
  confidence labels,
  normalized totals,
  and sensitivity checks.
- Keep every hard gate outside the score so points cannot compensate for failure.
- Add source hierarchy and claim-record requirements.
- Retain the current 24-month layoffs and 12-month outage windows.
- Add direct vendor risks:
  terms and pricing stability,
  account enforcement and appeal,
  security and privacy,
  availability and support,
  data portability and deletion,
  lock-in and exit cost,
  ownership and business continuity,
  API deprecation,
  and geography or compliance where relevant.
- Make unavailable critical evidence a failed gate rather than a neutral ranking state.
- Reserve low-signal for soft observational criteria such as tracker activity in a tiny repository.
- Disqualify uninspectable high-trust code,
  unverifiable native artifacts,
  and unknown build provenance.
- Do not accept NDA-only evidence as satisfying a public audit gate.
- Define maintenance sampling without relying on issue count.
- Add licensing,
  provenance,
  security,
  privacy,
  data portability,
  and lock-in checks where applicable.
- Turn the external execution gate into an execution-manifest procedure.
- Define consumer-boundary validation and partial-validation reporting.

### Phase 4: align output and examples

- Add the required recommendation schema.
- Add an automatic `docs/audit/<topic>-vet-<date>.md` artifact for substantial evaluations.
- Define the substantial threshold as any evaluation that promotes a serious alternative and uses external source,
  vendor,
  maintenance,
  clone,
  or execution evidence.
- Treat the vet report as permitted process documentation,
  not authorization to adopt a dependency or service.
- Require pros,
  cons,
  evidence limits,
  score breakdown,
  and fully sorted ranking for live options.
- Require every scored concern to show why it is relevant,
  its weight,
  rating,
  evidence,
  confidence,
  and how it changed the ordering.
- Require sensitivity analysis when a one-step change to an influential low-confidence input could change the winner.
- Replace the dated SaaS example with an evidence-complete synthetic example or canonical repository artifact.
- Key the final checklist to named workflow gates.
- Require generated audit artifacts to record the skill revision.

### Phase 5: organize one authoritative skill

- Keep the workflow,
  category gates,
  examples,
  and completion contract in one `SKILL.md`.
- Use named lifecycle phases and gate identifiers to make internal references exact.
- Ensure the description covers selection,
  evaluation,
  replacement,
  vendor vetting,
  and safety review triggers.
- Keep each rule authoritative in one place and point the final checklist to those rule names.
- Remove duplicated restatements that can drift while preserving troubleshooting-doc-level detail where execution depends on it.
- Accept that this exceeds the generic skill-authoring guide's suggested size;
  the user chose single-file coherence over progressive disclosure for this high-stakes workflow.

### Phase 6: verify with scenario fixtures

Dry-run the rewritten skill against at least these synthetic prompts:

- choose a managed database under budget and residency constraints;
- replace a pure TypeScript parsing dependency;
- assess a native or Wasm package that runs lifecycle scripts;
- choose a credential-handling agent plugin;
- evaluate an incumbent where keeping it is a valid outcome;
- answer an evaluation request that does not authorize adoption;
- reject a candidate whose critical provenance or safety evidence is unavailable;
- retain a tiny repository with no tracker activity as low-signal when other relevant gates pass;
- stop auditing a candidate after a decisive hard failure.

For each fixture,
verify:

- correct category routing;
- only applicable gates activate;
- no recommendation appears before required finalist checks;
- no irrelevant exhaustive work is required;
- unavailable critical evidence causes a recorded exit;
- absent soft tracker evidence remains low-signal and relevance-gated;
- score breakdowns use precommitted weights and reproducible arithmetic;
- sensitivity checks expose unstable rankings;
- alternatives receive pros,
  cons,
  and complete rankings with adjacent-order reasons;
- recommendation writes only the required vet report and does not mutate product,
  dependency,
  configuration,
  or decision state;
- adoption updates the decision record;
- unsafe or uninspectable execution remains blocked.

Use an independent reviewer to compare the rewritten skill and fixtures against this plan and the troubleshooting-doc benchmark.

### Phase 7: synchronize and guard mirrors

- Run the existing file-enforcer path to regenerate `.claude/skills/` and `.factory/skills/`.
- Verify canonical and mirrored hashes match.
- Add or extend a repository verification task so mirror drift fails visibly.
- Confirm generated mirrors remain ignored outputs and `.agents/skills/` remains the only edited source.

## Success criteria

The improvement is complete only when:

- a reader can identify the current lifecycle state and next legal action;
- SaaS,
  open-source,
  proprietary,
  replacement,
  and high-trust cases activate the correct gates;
- candidate promotion and stopping rules prevent both shallow anchoring and unbounded audits;
- every executed third-party command has a reviewed manifest and disposable boundary;
- every recommendation separates non-compensable gates from relevance-gated scores,
  publishes frozen weights and arithmetic,
  and contains evidence status,
  pros,
  cons,
  evidence limits,
  score breakdown,
  and a full ranking;
- substantial evaluations automatically receive a vet report recording the governing skill revision;
- evaluation requests do not cause unauthorized product,
  dependency,
  configuration,
  or decision-record edits;
- adopted choices receive a decision record;
- scenario fixtures exercise every route and failure state;
- an independent review finds no contradiction between body,
  example,
  and checklist;
- canonical and mirrored skills are byte-identical after generation;
- the result meets or exceeds troubleshooting-doc's trigger clarity,
  gate precision,
  recovery behavior,
  artifact quality,
  and completion closure.

## Grill-me decisions

### Decision 1: operating model

Decision:
use a risk-gated exhaustive workflow.
The user selected this on 2026-07-09.

Every applicable gate remains mandatory,
but expensive source and runtime validation follows candidate promotion.
A candidate receives deeper work only while it can still win.
A hard failure records an exit and stops further work unless a close comparison needs more evidence.

Pros:

- preserves the troubleshooting-doc standard that incomplete gates stay visible and cannot silently pass;
- prevents irrelevant candidates from consuming full source,
build,
and runtime audits;
- reduces exposure to third-party execution without reducing scrutiny of finalists;
- makes stopping behavior reproducible rather than discretionary.

Cons:

- requires precise serious-alternative and finalist definitions;
- requires agents to record promotion and exit decisions;
- can still be substantial when several candidates remain genuinely competitive.

Rejected alternative:
always exhaustive.
It offers uniform maximum scrutiny,
but spends the same effort on candidates that already cannot satisfy the job.

Rejected alternative:
user-budgeted tiers.
It offers an explicit speed-versus-depth tradeoff,
but makes recommendation quality optional and can fall below the benchmark skill's completion standard.

Ranking:
risk-gated exhaustive beats always exhaustive because it preserves every relevant gate while removing work that cannot change the decision.
Always exhaustive beats user-budgeted tiers because a skill-level quality floor should not disappear when a shallow tier is selected.

### Decision 2: file organization

Decision:
keep one comprehensive `SKILL.md`.
The user selected this on 2026-07-09 and rejected the premise that contradictions become easier to isolate across more files.

Pros:

- one file remains the complete authority;
- agents cannot skip a category procedure because they failed to follow a reference;
- cross-category invariants and category-specific gates can be compared in one search;
- matches the successful troubleshooting-doc shape;
- generated mirrors copy one artifact.

Cons:

- every technology-selection task loads detail for categories that may not apply;
- disciplined headings,
  named gates,
  and deduplication are necessary to keep the file navigable;
- the result will exceed the generic skill-authoring guide's suggested length.

Rejected alternative:
hybrid core plus references.
It would reduce irrelevant loaded detail,
but introduces cross-file authority and makes contradiction checks span several documents.

Rejected alternative:
thin router plus references.
It minimizes initial context,
but fragments the governing contract and makes skipped references a correctness risk.

Ranking:
single comprehensive file beats hybrid because one authority makes whole-contract review and contradiction search direct.
Hybrid beats a thin router because it would at least keep invariant workflow and completion gates in the loaded skill.

### Decision 3: pre-adoption artifact

Decision:
automatically write a vet report for every substantial technology evaluation.
The user selected this on 2026-07-09 to meet the troubleshooting-doc durable-artifact standard.

The report lives at `docs/audit/<topic>-vet-<date>.md` and records the exact choosing-technology skill revision.
The substantial threshold is crossed when an evaluation promotes at least one serious alternative and uses external source,
vendor,
maintenance,
clone,
or execution evidence.
A response that only applies an existing decision record or answers a narrow factual question does not create a redundant vet report.

The vet report is a process artifact.
It does not authorize dependency changes,
service signup,
configuration edits,
or a decision-record update.
Those remain adoption actions.

Pros:

- preserves source paths,
commands,
evidence dates,
unknowns,
and rejected candidates;
- lets interrupted work resume without repeating expensive research;
- makes the skill revision and completion state auditable;
- matches the benchmark skill's rule that substantial investigation ends in a durable artifact.

Cons:

- creates repository documentation during an evaluation-only request;
- requires a specific project rule that this process artifact is permitted despite the normal decision-verb boundary;
- can create clutter unless finished reports are linked from later decisions and obsolete drafts are retired.

Rejected alternative:
write a report only when requested or when a handover becomes necessary.
It reduces artifact volume,
but makes equal research receive inconsistent durability and can defer documentation until context is already exhausted.

Rejected alternative:
keep evidence inline until adoption.
It avoids pre-adoption files,
but loses the benchmark's durable evidence trail and makes interrupted audits expensive to reconstruct.

Ranking:
automatic vet reports beat conditional reports because durability should follow measurable research depth rather than whether someone remembered to request a file.
Conditional reports beat inline-only evidence because they preserve at least the evaluations most likely to outlive one session.

### Decision 4: critical evidence gaps

Decision:
critical evidence gaps disqualify;
only soft observational evidence can be low-signal and relevance-gated.
The user established this on 2026-07-09.

The skill must not carry an unverified candidate through ranking when any of these remain unknown:

- source and behavior of a high-trust plugin;
- source-to-binary mapping,
  checksums,
  or equivalent provenance for native artifacts;
- build provenance;
- any hard constraint;
- any safety boundary needed for the proposed use.

A proprietary high-trust plugin,
native package with unverifiable prebuilt binaries,
or candidate with unknown build provenance exits immediately.
NDA-only evidence does not satisfy a public audit gate.

Soft observational evidence receives different treatment.
A tiny repository with no issues or pull requests is not automatically healthy or failed.
The audit uses releases,
commits,
ownership concentration,
source,
tests,
and the candidate's actual risk surface,
then labels tracker responsiveness low-signal.

The user has Linux x64,
macOS arm64,
and Windows x64 machines.
The validation design should use those targets when relevant rather than inventing an unavailable-hardware exception for common desktop platforms.

Pros:

- prevents opaque candidates from competing with verifiable candidates;
- turns provenance and execution safety into actual gates;
- avoids treating the absence of tracker traffic as proof about a tiny project's health;
- keeps low-signal semantics narrow and explainable.

Cons:

- excludes otherwise feature-rich proprietary or opaque candidates categorically;
- requires clear separation between critical evidence and soft observational signals;
- platform-specific claims outside the available machine set may still need a different candidate or reproducible third-party evidence.

Rejected alternative:
universal penalty for every evidence gap.
It is conservative,
but falsely equates missing tracker activity with missing build provenance.

Rejected alternative:
neutral unknowns that do not affect ranking.
It avoids inferring failure from absence,
but would let candidates with unresolved safety or provenance compete with verified candidates.

Ranking:
critical-fail plus soft-low-signal beats a universal penalty because it is stricter where evidence is load-bearing and more accurate where evidence is merely observational.
A universal penalty beats neutral unknowns because unresolved critical risk must affect the decision.

### Decision 5: SaaS evidence layers

Decision:
keep the current six vendor domains and fixed windows,
add direct operational risks,
and make softer concerns relevance-gated score reductions rather than automatic disqualifiers.
The user selected this on 2026-07-09.

Retain:

- layoffs and headcount over 24 months;
- customer reviews;
- outages over 12 months;
- funding,
ownership,
and business model;
- signup friction;
- security and abuse history.

Add:

- terms and pricing stability;
- account suspension,
enforcement,
and appeal behavior;
- security,
privacy,
data use,
and compliance where relevant;
- availability,
SLA,
and support behavior;
- data export,
portability,
retention,
and deletion;
- lock-in,
migration path,
and exit cost;
- ownership changes and business continuity;
- API deprecation and compatibility policy;
- geography and access restrictions where relevant.

Hard constraints,
critical provenance,
and safety remain non-compensable gates.
Softer findings lower a candidate's score only when the audit explains their relevance to the proposed use.
A lower score lowers ranking;
it does not by itself disqualify a candidate.

Pros:

- preserves early-warning evidence from layoffs,
funding,
reviews,
and outage history;
- adds direct contractual and operational evidence;
- prevents one soft concern from masquerading as a hard technical failure;
- makes ranking effects explicit.

Cons:

- expands an already substantial vendor audit;
- requires a scoring method that avoids hidden weights and false precision;
- review sites,
layoff trackers,
and funding reports remain weaker sources than direct terms and observed behavior;
- overlapping domains must be deduplicated so one incident is not counted several times.

Rejected alternative:
direct risks only.
It prioritizes stronger evidence,
but drops softer early-warning signals the user wants retained.

Rejected alternative:
make every current domain a mandatory gate.
It is mechanically strict,
but would disqualify candidates for soft concerns that should instead affect comparative rank.

Ranking:
the combined hard-gate plus relevance-scored model beats direct-risks-only because it preserves useful early-warning evidence without turning it into an automatic veto.
Direct-risks-only beats six mandatory gates because direct contractual and operational evidence is more decision-relevant than treating every proxy as fatal.

### Decision 6: scoring method

Decision:
use explicit weighted points for every relevance-gated concern.
The user selected this on 2026-07-09.

The scoring contract is:

- hard gates are pass or fail and stay outside arithmetic;
- criteria and 1-to-5 weights come from context and resolved preferences;
- criteria,
  applicability,
  and weights freeze before candidate-specific soft-risk results are scored;
- each applicable candidate criterion receives a cited 0-to-4 rating;
- every rating records high,
  medium,
  or low confidence;
- normalized score equals earned weighted points divided by maximum applicable weighted points,
  multiplied by 100;
- full calculations are published;
- low-signal evidence uses a sensitivity range rather than invented certainty;
- overlapping evidence is counted once;
- a sensitivity check moves influential low-confidence ratings or weights by one step;
- if that change flips the winner,
  ranking is unstable and requires decisive evidence or a user preference;
- score never replaces pros,
  cons,
  evidence limits,
  or adjacent-ranking reasons.

Pros:

- implements an explicit lower-score,
lower-rank policy;
- exposes weights instead of hiding them in prose;
- freezing weights before candidate ratings reduces winner-driven criteria changes;
- normalized totals keep not-applicable criteria from granting free points;
- sensitivity checks expose false precision.

Cons:

- numbers can imply more certainty than the evidence supports;
- weight selection remains a judgment even when published;
- criterion overlap requires active deduplication;
- close totals need narrative judgment and may require another user decision.

Rejected alternative:
ordinal risk bands.
They reduce false precision,
but need extra aggregation and tie rules and do not implement a direct score as clearly.

Rejected alternative:
narrative pairwise comparison.
It preserves nuance,
but permits hidden weighting and does not produce the requested lower score.

Ranking:
weighted points beat ordinal bands because transparent precommitted weights and sensitivity checks make arithmetic inspectable.
Ordinal bands beat narrative-only comparison because they still constrain how evidence maps to risk.

### Decision 7: full relevant validation

Open after Decision 6.
Define when upstream's full suite is mandatory and when a bounded,
consumer-focused validation plus documented omissions is sufficient.
