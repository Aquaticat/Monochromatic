# Plan: improve the choosing-technology skill

Status:
plan complete and grilled.
All 13 decisions are resolved;
the user confirmed shared understanding on 2026-07-09.
Independent audit remains before final delivery.
No skill changes are authorized by this plan.

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
- `AGENTS.md`,
   especially the decision-verb,
  measurement,
  option-ranking,
  external execution,
  verification,
  and decision-document rules;
- `docs/philosophy/agents.md`,
   especially the rationale for moving technology-selection detail into a skill.

Representative outputs that invoke or describe the current skill:

- `docs/audit/zstd-vet-2026-06-17.md`;
- `docs/audit/mise-keep-vs-build-own.md`;
- `docs/audit/pitchfork-jdx.md`;
- `docs/decisions/jsonc-edit-parser-foundation.md`;
- `docs/handover/image-processing-library-vet.md`.

Maintenance evidence:

- `file-enforcer.config.ts` identifies `.agents/skills/` as canonical and mirrors it into
  `.claude/skills/` and `.factory/skills/`;
- the initial SHA-256 comparison found the canonical choosing-technology skill differed from both mirrors;
- the initial no-index diff showed the mirrors lacked the external-code-execution gate;
- commit-time file-enforcer execution later synchronized all three copies to SHA-256
  `31c4169de3f538426b7a5942457e51a4a4856324ac6658a315fed0df7b717ca8`;
- no read-only mirror verification task currently detects a later mismatch before generation repairs it;
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
Examples include Pitchfork's proxy trust behavior in `docs/audit/pitchfork-jdx.md` and
image-library build and runtime failures in
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
The `Maintain a decision document` section says the document is written after the user picks,
but `Quality check before naming a candidate` requires that document before any candidate is named.
The `Worked example` section also names candidates before the described vetting is complete.

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
but the skill did not tell the investigator when broad discovery should stop or
which hard failures should prevent candidate promotion.

The improved skill needs explicit promotion and exit criteria:

- discovery records the search space;
- hard constraints eliminate candidates cheaply;
- serious alternatives plausibly pass every known hard gate after cheap screening;
- finalists are every serious alternative whose targeted evidence confirms all hard gates and provenance;
- source and maintenance depth increases only as a candidate advances;
- every hard-gate survivor receives full finalist validation;
- only a hard failure or product-category mismatch exits a candidate before ranking.

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
but the current sentence that any failed layer makes a vendor worse does not distinguish a hard failure from
a relevance-gated score reduction.
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
The `Clone and spot-read source before recommending` section separately requires building and running
every surviving candidate,
without connecting that execution requirement to a manifest procedure.

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

### Required policy exception

The skill cannot authorize its automatic vet report by itself because `AGENTS.md` has higher authority.
Implementation must merge a narrow exception into existing `VRB` and `IWT` rules:

- an evaluation that crosses choosing-technology's substantial threshold may create or update only its required
  `docs/audit/<subject>-vet-<date>.md` process artifact in the main worktree;
- the exception does not authorize product code,
  dependencies,
  configuration,
  generated files,
  decision records,
  installation,
  builds,
  or experiments in the main worktree;
- every mutating investigation or validation operation still runs in a disposable worktree,
  scratch directory,
  container,
  VM,
  or external target;
- adoption remains separately authorized by an action verb.

Edit `AGENTS.md`,
not generated `CLAUDE.md`,
then regenerate managed outputs through file-enforcer.
No new rule code is needed because the exception narrows the existing `VRB` and `IWT` rules.

### Non-regression invariants

The rewrite must preserve these current requirements explicitly:

- open-source options precede proprietary options unless the user requests proprietary technology or
  every open-source option
  fails a hard constraint;
- hard constraint fit precedes stack familiarity;
- existing tools precede a custom implementation;
- discovery names at least two concrete alternatives with evidence-backed exit or ranking reasons;
- a dependency replacement receives incumbent-depth parity checks for transitive dependencies,
  source behavior,
  native or Wasm provenance,
  maintenance,
  and the consumer boundary;
- open-source maintenance uses response,
  action,
  pull-request,
  release,
  backlog,
  and maintainer-concentration evidence rather than open issue count;
- every eligible open-source finalist is cloned,
  source-read,
  test and CI-read,
  checked for fuzzing and mutation evidence,
  and fully validated;
- high-trust finalists receive measured human-auditability comparison;
- adopted choices receive a decision document with rejected alternatives.

The final checklist should point to these invariant names instead of paraphrasing them.

### Base categories and overlays

Classify each adopted component into exactly one base category:

- managed service or SaaS;
- inspectable open-source local technology,
  including a library,
  framework,
  build tool,
  executable,
  or self-hosted service;
- proprietary local technology.

A solution containing both a hosted service and a local client has two components and
receives two base classifications.
Do not call a hosted control plane open source merely because its engine or client is open source.

Apply every matching cross-cutting overlay independently:

- incumbent dependency replacement;
- high-trust execution inside an agent,
  plugin,
  hook,
  CI runner,
  or credential boundary;
- native,
  Wasm,
  prebuilt binary,
  or generated-code boundary;
- sensitive-data,
  privacy,
  compliance,
  residency,
  or geography boundary;
- multi-platform or browser-baseline claim.

Base gates and overlay gates accumulate.
A replacement is not a product category.
High trust is not a product category.
A proprietary high-trust component fails the inspectability gate.
A proprietary local component can remain only under the documented open-source exception and
must still pass every applicable gate.

### Discovery saturation

Replace `every meaningful candidate` with a reproducible candidate ledger and saturation rule.
For each decision:

1. Search the category's package registry,
   vendor directory,
   or official ecosystem index.
2. Search repository-host topics,
   code,
   releases,
   and organization projects.
3. Search the broader web for peer tools,
   comparative terms,
   and nearest comparable technologies.
4. Inspect this repository's incumbent,
   parallel systems,
   decision records,
   and hand-rolled alternatives.
5. Record every candidate,
   discovery source,
   base category,
   overlays,
   and cheap hard-gate result in the ledger.
6. Vary search terms by problem class,
   protocol,
   deployment model,
   and ecosystem until two consecutive query variants in each still-promising source class add no
   plausible hard-gate survivor.

Do not make npm and GitHub the universal discovery sources;
use category-appropriate registries and source hosts.
Do not truncate or negatively filter the candidate search before recording what the filter would hide.
At least two alternatives must receive concrete exit or ranking reasons.
If saturation finds fewer,
report every source class and query family checked rather than inventing candidates.

### Evidence record

Every gate,
score,
and recommendation claim must carry one evidence record containing:

- candidate and exact version,
  release,
  revision,
  artifact checksum,
  or service plan;
- claim,
  decision relevance,
  base gate or overlay gate,
  and hard-gate or scored-risk status;
- primary URL,
  page or document section,
  and access date;
- independent corroboration and counterevidence when material;
- clone path,
  commit or tag,
  source `path:line` range,
  and adjacent source excerpt for code-behavior claims;
- exact command,
  working directory,
  OS and architecture,
  container or VM image and digest when used,
  environment boundaries,
  exit status,
  elapsed time,
  and relevant output excerpt or log path for execution claims;
- rating,
  confidence,
  score effect,
  and sensitivity range for scored evidence;
- pass,
  fail,
  not-applicable,
  low-signal,
  or excluded status with reason.

Reviews,
aggregators,
and tracker counts can discover or corroborate a claim;
they cannot replace primary terms,
status history,
security disclosure,
source,
or reproduced behavior.

### Weighted scoring contract

Apply weighted points to every relevance-gated concern for SaaS and technology finalists.
Hard gates remain outside the score and cannot be compensated.
Soft scores are calculated only after every finalist completes equal-depth validation.

Before candidate-specific soft evidence is rated:

- derive decision-level criteria from known requirements,
  base categories,
  overlays,
  and resolved user preferences;
- apply each relevant criterion to every finalist;
  a candidate that structurally avoids a risk receives evidence for a strong rating rather than
  removing that criterion from its denominator;
- remove criteria irrelevant to the whole decision from every finalist's denominator;
- assign equal weight 1 to every remaining criterion whose priority is unspecified;
- publish and freeze criteria,
  applicability,
  and weights;
- use weights 1 to 5,
  where 1 is marginally relevant and 5 is decisive if it were not already a hard gate;
- assign overlapping evidence to one primary criterion so an incident is counted once.

Rate each finalist from 0 to 4 on every applicable criterion:

- 0 is a serious concern;
- 1 is weak;
- 2 is acceptable;
- 3 is good;
- 4 is strong.

Every rating cites its evidence and records high,
medium,
or low confidence.
A low-signal rating records an evidence-supported minimum and maximum rating rather than an invented exact value.
Calculate minimum and maximum weighted totals from those ranges.

Normalized score equals earned weighted points divided by maximum applicable weighted points,
multiplied by 100.
Rank by the unrounded fraction;
display the raw numerator and denominator plus a score rounded to one decimal place.
Publish the complete calculation.
If no soft criterion applies to the decision,
report `score: not applicable` for every finalist rather than dividing by zero.

Sensitivity is deterministic:

- raise each equal-default weight from 1 through 5,
  one criterion at a time;
- move every medium-confidence and low-confidence exact rating one step down and one step up within 0 to 4,
  one input at a time;
- test the complete minimum and maximum range for every low-signal rating.

If a tested change alters the winner or adjacent order,
gather decisive evidence or ask only the preference that controls that input,
then refreeze and rerun the calculation.
If exact scores remain tied,
or no soft criteria apply and factual tradeoffs do not determine order,
ask for the unresolved user preference rather than inventing a tiebreaker.
Do not recommend until the fully sorted order is stable under the tested one-at-a-time perturbations.
State explicitly that this stability claim does not cover simultaneous multi-input changes.

A numeric score never replaces candidate pros,
cons,
evidence limits,
or the required reason for each adjacent ranking.

### Shared workflow

Use this sequence:

1. Read repository and deployment facts that can be measured.
2. Ask one context-fork preference only when it changes the candidate set.
3. Classify each possible component by base category and overlays.
4. Freeze known hard gates and the candidate-independent soft-scoring rubric.
5. Run the discovery-saturation protocol and maintain the candidate ledger.
6. Apply cheap hard-constraint and critical-evidence screening;
   record unavailable critical evidence as a failed exit,
   not a neutral unknown.
7. Promote plausible hard-gate survivors to serious alternatives.
8. As soon as the substantial threshold is crossed,
   create or reopen the matching vet report before further evidence work;
   update and commit the scoped report after every major phase.
9. Run targeted category and overlay evidence checks that confirm every hard gate and provenance claim.
10. Promote every confirmed hard-gate survivor to finalist.
11. Create and approve an execution manifest before each third-party command tree.
12. Fully source-audit and validate every finalist through upstream and consumer boundaries.
13. Score and compare equally validated finalists with pros,
    cons,
    evidence limits,
    calculations,
    sensitivity results,
    and a complete ranking.
14. Resolve every outcome-changing preference or return a terminal no-recommendation result.
15. Complete the vet report before returning the recommendation.
16. Recommend without changing product code,
    dependencies,
    configuration,
    or decision records when the request is evaluative.
17. After adoption is authorized,
    update the decision document and record rejected alternatives.

### Base and overlay gates

Every base category receives shared gates for constraint fit,
licensing,
alternatives,
evidence freshness,
security,
maintenance,
validation,
and output quality.

Managed service or SaaS adds universal inspection of every retained historical and direct-risk domain,
including the 24-month layoffs and 12-month outage windows.
Only findings with an explicit causal link to the proposed use affect score.

Inspectable open-source local technology adds repository cloning,
source and dependency audit,
maintenance sampling,
test and CI inspection,
fuzzing and mutation search,
build provenance,
full validation,
and consumer-boundary exercise.

Proprietary local technology adds the open-source-exception proof,
public provenance,
terms,
update channel,
telemetry,
security history,
reproducible behavior,
and exit path.
It cannot pass a high-trust overlay without inspectable source.

Apply overlay gates cumulatively:

- replacement adds incumbent-depth parity;
- high trust adds measured human auditability and concentrated security-boundary review;
- native,
  Wasm,
  or prebuilt code adds source-to-artifact mapping,
  checksums,
  imported host functions,
  compiler flags,
  and release verification;
- sensitive data adds privacy,
  retention,
  deletion,
  compliance,
  residency,
  and credential handling;
- multi-platform adds real validation on every relevant available target.

### Terminal outcomes

The skill must define explicit terminal behavior:

- no serious alternative survives cheap hard gates:
  finish the vet report with every exit,
  recommend none,
  and ask whether the user wants to change a named hard constraint;
- no finalist survives targeted hard-gate confirmation or relevant validation:
  finish the report,
  recommend none,
  and do not rescue a failed candidate with soft points;
- a relevant suite or execution path cannot be inspected or run:
  fail that candidate's gate and continue only with other survivors;
- sensitivity changes the ordering:
  gather evidence or ask the one outcome-changing preference,
  then rerun before recommending;
- exact scores tie or no soft criteria apply:
  ask the unresolved preference needed for a fully sorted ranking;
- a compatible vet report has concurrent edits:
  do not overwrite,
  identify the conflicting path,
  and ask before coordinating ownership;
- every candidate fails:
  state that no current candidate is recommendable rather than proposing an unverified custom implementation.

### Vet-report and decision schemas

A vet report uses `docs/audit/<subject>-vet-YYYY-MM-DD.md`,
with a stable kebab-case subject and the date the audit began.
Update the newest compatible report.
When same-day contexts are incompatible,
append a short kebab-case context qualifier rather than overwriting.

The report begins with:

- status and current lifecycle phase;
- decision subject and scope;
- started and last-updated dates;
- governing skill commit from `git log --max-count=1 --format=%H -- .agents/skills/choosing-technology/SKILL.md`;
- governing skill SHA-256;
- hard constraints,
  base categories,
  overlays,
  criteria,
  frozen weights,
  and unresolved preferences;
- compatible prior-report path or reason a new report was required;
- active audit owner and concurrent-edit check.

The body preserves the candidate ledger,
evidence records,
execution manifests,
hard-gate exits,
validation results,
score calculations,
sensitivity,
pros,
cons,
ranking,
and recommendation or terminal no-recommendation result.
Before every report edit,
check the scoped path for concurrent changes;
never overwrite another session's edits.

An adoption decision records:

- adopted candidate,
  version,
  revision,
  service plan,
  or artifact checksum;
- adoption date and authorizing request;
- linked vet report and governing skill revision;
- hard constraints and frozen weights;
- complete ranking and rejected alternatives;
- integration boundary,
  migration,
  exit,
  rollback,
  and revisit triggers.

Recommendation finishes the vet report only.
Adoption updates the decision record only after separate authorization.

### Execution manifest

Complete one manifest before every third-party command tree,
including installs,
lifecycle scripts,
generated commands,
builds,
tests,
fuzzers,
benchmarks,
and downloaded executables.
The manifest records:

- candidate,
  pinned revision,
  artifact checksums,
  and clone origin;
- exact top-level command and every statically discovered lifecycle,
  generated,
  subprocess,
  plugin,
  native,
  Wasm,
  and shell command it can reach;
- files inspected to establish that command tree;
- expected reads,
  writes,
  subprocesses,
  network endpoints,
  and outputs;
- container or VM image and digest;
- memory,
  CPU,
  process,
  file-descriptor,
  disk,
  and command-specific wall-clock ceilings;
- credential,
  environment,
  home-directory,
  network,
  and repository-mount policy;
- success evidence,
  failure evidence,
  cleanup,
  and stop conditions.

Default isolation is 2 GiB memory,
2 CPUs,
no ambient credentials,
no real home-directory mount,
a read-only repository mount,
a private scratch write volume,
and disabled network after any separately inspected dependency-fetch phase.
Record and justify every deviation.
Use the process or container boundary for the wall-clock ceiling rather than wrapping routine verification in
an external timeout command.

If execution reveals an undeclared command,
write,
network endpoint,
or native boundary,
stop before continuing,
update the manifest,
and inspect the new path.
If the complete path cannot be inspected or bounded,
fail the candidate's execution gate.
Isolation reduces impact;
it does not turn unknown code into trusted code.

### Candidate promotion rules

A candidate is discovered when a credible search finds it.
It becomes a serious alternative only when cheap screening shows:

- it plausibly satisfies every known hard constraint;
- it has no known disqualifying license,
  provenance,
  security,
  or reproducibility failure;
- its product category matches the actual job;
- its source and execution paths appear inspectable enough to justify targeted evidence work.

Targeted evidence then confirms every hard gate,
license,
provenance,
security,
reproducibility,
and category-fit claim.
Every serious alternative that still passes becomes a finalist.
There is no fixed candidate count,
score cutoff,
or preliminary soft-score exit.
Every finalist receives full CI-equivalent,
relevant-suite,
and consumer-boundary validation.

Every exit receives a concrete hard-failure or category-mismatch reason and evidence.
Soft scores rank finalists only after full validation;
they never reduce audit depth.
The user chose this because the expected hard-gate survivor set is manageable in practice.

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
  complete default CI-equivalent validation,
  every non-default suite relevant to the claimed surface,
  and consumer-boundary exercise;
- high-trust finalist:
  finalist checks plus human-auditability and concentrated security-boundary review.

Before running a finalist's validation,
inventory every upstream task and CI job.
Run the full default CI-equivalent path at the pinned revision in a secret-free,
disposable,
resource-bounded environment.
Then run every non-default test,
fuzz,
platform,
feature,
native,
Wasm,
or integration suite relevant to the promised behavior and this repo's risk.
Exercise relevant platform claims on the user's Linux x64,
macOS arm64,
and Windows x64 machines when the integration targets those platforms.

Every omitted upstream suite receives an exact command,
its purpose,
and evidence that it cannot affect the claimed surface.
A relevant suite that cannot be inspected or run blocks the finalist.
An upstream failure must be diagnosed:
it disqualifies the finalist unless evidence demonstrates that the failing path is outside every claimed and
consumed surface.
Consumer-boundary verification remains mandatory even after upstream validation passes.

A skipped critical check is a failed gate.
A soft criterion with sparse evidence remains low-signal with an explicit confidence range.
Neither silently becomes a pass.

## Implementation plan

### Phase 1: planning decisions, completed

The grill-me session resolved the operating model,
file authority,
artifact policy,
evidence failures,
SaaS layers,
weighted scoring,
full validation,
worked-example strategy,
default weights,
promotion thresholds,
score-based exits,
SaaS soft-risk applicability,
and vet-report timing.
Decisions 1 through 13 are the implementation contract.

The next authorized implementation action is Phase 2.
Do not restart grilling unless implementation evidence exposes a new non-measurable preference fork.

### Phase 2: establish authority,
lifecycle,
and routing

- Merge the narrow choosing-technology vet-report exception into `AGENTS.md` rules `VRB` and `IWT`.
- Regenerate `CLAUDE.md` through file-enforcer rather than editing it.
- Define candidate lifecycle states and legal transitions.
- Replace `before naming` with `before recommending` where discovery must name candidates.
- Separate recommendation,
  process-artifact writes,
  adoption,
  and decision-document mutation.
- Add exactly-one base classification plus cumulative overlay routing.
- Make the open-source default and its proprietary exception explicit in the gate sequence.
- Preserve alternative survey,
  replacement parity,
  maintenance,
  clone and source,
  validation,
  and human-auditability invariants.
- Replace `skip none` with `skip no applicable gate`.
- Define pass,
  hard failure,
  scored risk,
  low-signal,
  excluded,
  and not-applicable outcomes.
- Add the discovery ledger and saturation protocol.
- Define hard-gate-only promotion and stopping rules.
- Forbid preliminary soft scores,
  fixed candidate counts,
  or score intervals from eliminating hard-gate survivors before full validation.
- Add terminal no-recommendation and unresolved-preference outcomes.

### Phase 3: make evidence and safety executable

- Add the complete evidence-record schema with revision,
  URL section,
  access date,
  source `path:line` excerpt,
  command environment,
  exit status,
  and relevant output.
- Add the deterministic scoring contract with decision-level applicability,
  precommitted context-derived weights,
  0-to-4 ratings,
  low-signal ranges,
  raw and normalized totals,
  one-decimal display,
  zero-criterion behavior,
  ties,
  and one-at-a-time sensitivity checks.
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
- Turn the external execution gate into the complete manifest procedure with default 2 GiB and 2 CPU isolation,
  no credentials,
  read-only repository access,
  private scratch writes,
  explicit network policy,
  command-specific wall-clock ceiling,
  and fail-closed handling for newly discovered command paths.
- Require an inventory of every upstream task and CI job before finalist execution.
- Require the complete default CI-equivalent path plus every non-default suite relevant to the claimed surface.
- Require exact omission records for irrelevant suites.
- Block a finalist when a relevant suite cannot be inspected or run.
- Diagnose upstream failures and reject unless the failure is proven outside every claimed and consumed surface.
- Run consumer-boundary validation after upstream validation.
- Use the user's Linux x64,
  macOS arm64,
  and Windows x64 machines for relevant platform claims.

### Phase 4: align reports,
output,
and examples

- Add the exact vet-report slug,
  metadata,
  compatibility,
  collision,
  concurrent-ownership,
  skill-revision,
  and lifecycle schema.
- Add the exact adoption-decision fields and preserve the recommendation-versus-adoption boundary.
- Add the required recommendation and terminal-output schemas.
- Add an automatic `docs/audit/<topic>-vet-<date>.md` artifact for substantial evaluations.
- Search for a matching current vet report before creating one.
- Reuse and update the current report when decision subject,
  hard constraints,
  deployment,
  trust boundary,
  and incumbent context remain compatible.
- Create the report as soon as the substantial threshold is crossed,
  update it after each major audit phase,
  and complete it before recommendation.
- Create a new dated report only when merging materially incompatible decision context would obscure
  the evidence trail.
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
- Require every SaaS audit to inspect every retained historical and direct-risk domain.
- Report inspected but irrelevant SaaS findings without score impact.
- Require every scored concern to show why it is relevant,
  its weight,
  rating,
  evidence,
  confidence,
  and how it changed the ordering.
- Require the complete defined sensitivity matrix for every equal-default weight,
  every medium-confidence or low-confidence exact rating,
  and every low-signal rating range.
- Replace the dated SaaS example with one evidence-complete synthetic example embedded in `SKILL.md`.
- Make the example explicitly fictional and timeless.
- Exercise context routing,
  a hard-gate exit,
  candidate promotion,
  weighted scoring,
  sensitivity,
  finalist validation,
  ranking,
  automatic vet-report creation,
  and the recommendation-versus-adoption boundary.
- Key the final checklist to named workflow gates.
- Require generated audit artifacts to record both the governing skill commit and SHA-256.

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
- Remove duplicated restatements that can drift while preserving troubleshooting-doc-level detail where
  execution depends on it.
- Accept that this exceeds the generic skill-authoring guide's suggested size;
  the user chose single-file coherence over progressive disclosure for this high-stakes workflow.

### Phase 6: verify with isolated scenario fixtures

Record fixture specifications and results in `docs/audit/choosing-technology-skill-validation.md`.
This is validation evidence,
not a second source of skill rules.
Each fixture contains:

- exact synthetic user prompt;
- complete synthetic evidence bundle;
- expected base categories,
  overlays,
  lifecycle transitions,
  hard gates,
  score inputs,
  report writes,
  terminal result,
  and prohibited actions;
- fresh-session transcript;
- resulting vet-report diff;
- assertion results and reviewer verdict.

Run each fixture in a fresh agent session rooted in its own disposable linked worktree.
Load the rewritten project skill,
provide no prior conversation,
and expose no ambient credentials or live third-party resources.
Allow writes only to the fixture's expected vet report inside that worktree.
Use a separate independent reviewer to compare the transcript and report with the expected assertions.
A fixture passes only when both execution and review agree.

Cover at least these cases:

- managed database with universal SaaS inspection,
  residency hard gate,
  irrelevant findings receiving no score,
  and an outcome-changing weight sensitivity question;
- pure TypeScript dependency replacement with incumbent-depth parity and keeping the incumbent as a valid winner;
- native or Wasm candidate with valid provenance and an execution manifest;
- native prebuilt candidate failing source-to-artifact mapping;
- credential-handling open-source agent plugin receiving human-auditability scoring;
- proprietary high-trust plugin failing inspectability;
- proprietary local tool passing only through the explicit open-source exception;
- license hard failure;
- security hard failure;
- tiny repository with no tracker activity remaining low-signal while other maintenance evidence is scored;
- every hard-gate survivor receiving equal-depth finalist validation despite weak preliminary soft evidence;
- relevant upstream failure proven outside the claimed and consumed surface;
- relevant suite unavailable,
  causing candidate failure and a no-recommendation result when no survivor remains;
- zero applicable soft criteria;
- exact score tie requiring a preference;
- compatible vet report reuse;
- incompatible same-day report receiving a context qualifier;
- concurrent report edit blocking overwrite;
- evaluation producing only the authorized vet-report mutation;
- adoption producing a decision-record update only after a separate action request.

Verify universal SaaS inspection as applicable work even when findings receive no score.
Verify every terminal outcome,
complete ranking,
evidence record,
execution manifest,
report field,
and adoption boundary.
Use an independent reviewer to compare the rewritten skill,
fixtures,
and results against this plan and the troubleshooting-doc benchmark.

### Phase 7: synchronize and guard mirrors

- Edit task source in `mise.no-env.toml`,
  not generated `mise.toml`.
- Add a `verify:skill-mirrors` task with inline `node -e` logic.
- Compare every canonical `.agents/skills/*/*.md` file byte-for-byte with both
  `.claude/skills/*/*.md` and `.factory/skills/*/*.md`.
- Fail on a missing,
  extra,
  or content-mismatched mirror.
- Sequence `prepare:pnpm:others:files` so file-enforcer generation is followed by `verify:skill-mirrors`.
- Keep `file-enforcer.config.ts` and its `mirrorSkills` function as the only mirror writer.
- Regenerate `mise.toml` and all mirrors through `mise run prepare:pnpm:others:files`.
- In a disposable worktree,
  verify a modified mirror fails `mise run verify:skill-mirrors`,
  then regenerate and verify the task passes.
- Confirm `.claude/skills/` and `.factory/skills/` remain ignored outputs and
  `.agents/skills/` remains the only edited skill source.

## Success criteria

The improvement is complete only when:

- `AGENTS.md` explicitly authorizes the narrow vet-report process artifact and still forbids every other
  evaluation mutation;
- a reader can identify the current lifecycle state and next legal action;
- every component has one base category and every matching overlay;
- the open-source default,
  alternatives,
  replacement parity,
  maintenance,
  cloning,
  source audit,
  validation,
  human auditability,
  and adoption-record invariants remain explicit;
- discovery covers every required source class and records saturation evidence;
- every gate,
  score,
  command,
  and recommendation claim has the complete evidence record;
- candidate promotion eliminates hard failures early and sends every remaining survivor through equal-depth validation;
- soft scores never eliminate a hard-gate survivor before finalist validation;
- every third-party command tree has a reviewed manifest,
  explicit resource and trust boundaries,
  and fail-closed handling for newly discovered execution;
- every finalist completes the default CI-equivalent path,
  every relevant non-default suite,
  and consumer-boundary checks on relevant available platforms;
- no finalist has a failure within a claimed or consumed surface;
- every excluded suite or out-of-surface failure has exact evidence and rationale;
- scores define applicability,
  low-signal ranges,
  raw arithmetic,
  rounding,
  zero-criterion behavior,
  ties,
  and one-at-a-time sensitivity;
- every recommendation separates non-compensable gates from relevance-gated scores and includes pros,
  cons,
  evidence limits,
  score breakdown,
  sensitivity,
  and a stable fully sorted ranking;
- no-survivor,
  unavailable-validation,
  sensitivity,
  tie,
  report-conflict,
  and no-recommendation terminal states are explicit;
- substantial evaluations create or reopen a compatible vet report at threshold crossing,
  update it after each phase,
  and complete it before recommendation;
- report slugging,
  revisions,
  compatibility,
  collisions,
  and concurrent ownership are deterministic;
- evaluation requests do not cause unauthorized product,
  dependency,
  configuration,
  generated-file,
  or decision-record edits;
- adopted choices receive a decision record with the defined provenance,
  ranking,
  migration,
  exit,
  rollback,
  and revisit fields;
- isolated scenario fixtures pass execution and independent-review assertions for every route and terminal state;
- the inline synthetic example reaches an evidence-complete recommendation without time-sensitive real-world claims;
- Markdown lint passes for every changed document;
- `verify:skill-mirrors` fails a mismatch fixture and passes regenerated byte-identical mirrors;
- an independent review finds no contradiction between body,
  example,
  checklist,
  fixtures,
  and policy exception;
- the result meets or exceeds troubleshooting-doc's trigger clarity,
  source trace,
  gate precision,
  recovery behavior,
  artifact quality,
  reproducibility,
  and completion closure.

## Grill-me decisions

### Decision 1: operating model

Decision:
use a hard-gated exhaustive workflow.
The user selected the risk-gated model on 2026-07-09,
then Decision 10 established hard failures as the only pre-finalist risk gate.

Every applicable gate remains mandatory,
but expensive source and runtime validation follows cheap hard-gate screening.
Every plausible survivor receives targeted hard-gate confirmation.
Every confirmed hard-gate survivor receives equal-depth finalist validation.
A hard failure or category mismatch records an exit and stops further work on that candidate.

Pros:

- preserves the troubleshooting-doc standard that incomplete gates stay visible and cannot silently pass;
- prevents hard-gate failures and category mismatches from consuming full source,
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
hard-gated exhaustive beats always exhaustive because decisive hard failures stop work while every eligible survivor
receives equal-depth validation.
Always exhaustive beats user-budgeted tiers because a skill-level quality floor should not disappear when
a shallow tier is selected.

### Decision 2: file organization

Decision:
keep one comprehensive `SKILL.md`.
The user selected this on 2026-07-09 and rejected the premise that contradictions become easier to isolate
across more files.

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
single comprehensive file beats hybrid because one authority makes whole-contract review and
contradiction search direct.
Hybrid beats a thin router because it would at least keep invariant workflow and completion gates in the loaded skill.

### Decision 3: pre-adoption artifact

Decision:
automatically write a vet report for every substantial technology evaluation.
The user selected this on 2026-07-09 to meet the troubleshooting-doc durable-artifact standard.

The report lives at `docs/audit/<topic>-vet-<date>.md` and records the exact choosing-technology skill revision.
The substantial threshold is crossed when an evaluation promotes at least one serious alternative and
uses external source,
vendor,
maintenance,
clone,
or execution evidence.
A response that only applies an existing decision record or answers a narrow factual question does not create
a redundant vet report.

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
evidence limits,
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
but makes equal research receive inconsistent durability and can defer documentation until
context is already exhausted.

Rejected alternative:
keep evidence inline until adoption.
It avoids pre-adoption files,
but loses the benchmark's durable evidence trail and makes interrupted audits expensive to reconstruct.

Ranking:
automatic vet reports beat conditional reports because durability should follow measurable research depth rather than
whether someone remembered to request a file.
Conditional reports beat inline-only evidence because they preserve at least the evaluations most likely to
outlive one session.

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
The validation design should use those targets when relevant rather than inventing an unavailable-hardware
exception for
common desktop platforms.

Pros:

- prevents opaque candidates from competing with verifiable candidates;
- turns provenance and execution safety into actual gates;
- avoids treating the absence of tracker traffic as proof about a tiny project's health;
- keeps low-signal semantics narrow and explainable.

Cons:

- excludes otherwise feature-rich proprietary or opaque candidates categorically;
- requires clear separation between critical evidence and soft observational signals;
- platform-specific claims outside the available machine set may still need a different candidate or
  reproducible third-party evidence.

Rejected alternative:
universal penalty for every evidence gap.
It is conservative,
but falsely equates missing tracker activity with missing build provenance.

Rejected alternative:
neutral unknowns that do not affect ranking.
It avoids inferring failure from absence,
but would let candidates with unresolved safety or provenance compete with verified candidates.

Ranking:
critical-fail plus soft-low-signal beats a universal penalty because it is stricter where evidence is load-bearing and
more accurate where evidence is merely observational.
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
the combined hard-gate plus relevance-scored model beats direct-risks-only because it preserves useful
early-warning evidence without turning it into an automatic veto.
Direct-risks-only beats six mandatory gates because direct contractual and operational evidence is more
decision-relevant than treating every proxy as fatal.

### Decision 6: scoring method

Decision:
use explicit weighted points for every relevance-gated concern.
The user selected this on 2026-07-09.

The scoring contract is:

- hard gates are pass or fail and stay outside arithmetic;
- decision-level criteria and 1-to-5 weights come from context and resolved preferences;
- criteria,
  applicability,
  and weights freeze before candidate-specific soft-risk results are rated;
- every relevant criterion applies to every equally validated finalist;
- each criterion receives a cited 0-to-4 rating with high,
  medium,
  or low confidence;
- low-signal evidence receives an evidence-supported minimum and maximum rating;
- normalized score equals earned weighted points divided by maximum applicable weighted points,
  multiplied by 100;
- ranking uses the unrounded fraction and display includes raw arithmetic plus one decimal place;
- zero applicable criteria produce `score: not applicable`,
  not division by zero;
- overlapping evidence is counted once;
- sensitivity tests every equal-default weight from 1 through 5,
  every medium-confidence or low-confidence exact rating by one step in each direction,
  and every low-signal range;
- an order-changing sensitivity result requires decisive evidence or a user preference;
- an exact tie or zero-criterion tie requires the unresolved preference needed for full ordering;
- the stability claim covers tested one-at-a-time changes,
  not simultaneous changes;
- score never replaces pros,
  cons,
  evidence limits,
  or adjacent-ranking reasons.

Pros:

- implements an explicit lower-score,
lower-rank policy;
- exposes weights instead of hiding them in prose;
- freezing weights before candidate ratings reduces winner-driven criteria changes;
- decision-level applicability prevents candidate-specific denominator gaming;
- zero-criterion and tie behavior are explicit;
- sensitivity checks expose false precision.

Cons:

- numbers can imply more certainty than the evidence supports;
- weight selection remains a judgment even when published;
- criterion overlap requires active deduplication;
- order-changing uncertainty and ties may require another user decision.

Rejected alternative:
ordinal risk bands.
They reduce false precision,
but need extra aggregation and tie rules and do not implement a direct score as clearly.

Rejected alternative:
narrative pairwise comparison.
It preserves nuance,
but permits hidden weighting and does not produce the requested lower score.

Ranking:
weighted points beat ordinal bands because transparent precommitted weights and sensitivity checks make
arithmetic inspectable.
Ordinal bands beat narrative-only comparison because they still constrain how evidence maps to risk.

### Decision 7: full relevant validation

Decision:
require complete default CI-equivalent validation,
every non-default suite relevant to the claimed surface,
and consumer-boundary checks for every finalist.
The user selected this on 2026-07-09.

Procedure:

1. Inventory every upstream task and CI job at the pinned revision.
2. Inspect the commands through the external-execution gate.
3. Run the complete default CI-equivalent path in a secret-free,
   disposable,
   resource-bounded environment.
4. Run every non-default suite relevant to claimed behavior or this repo's risk,
   including test,
   integration,
   fuzz,
   native,
   Wasm,
   feature,
   and platform suites where applicable.
5. Exercise relevant platform claims on Linux x64,
   macOS arm64,
   and Windows x64 when those are consumer targets.
6. Record every omitted suite by exact command,
   purpose,
   and evidence that it cannot affect the claimed surface.
7. Diagnose every failure.
   Reject the finalist unless the failing path is proven outside every claimed and consumed surface.
8. Exercise the real consumer boundary after upstream validation passes.

A relevant suite that cannot be inspected or run blocks recommendation.
Hours-long work is not skipped merely for duration;
run it with appropriate resource isolation when it is relevant.
Unrelated benchmarks,
stress suites,
or platform targets may be omitted only with the exact record required by this decision.

Pros:

- verifies upstream's normal quality contract and this repo's actual boundary;
- catches relevant optional-feature and platform failures outside the default suite;
- preserves hard-gated proportionality because only eligible finalists receive this depth;
- prevents `consumer smoke test passed` from standing in for upstream health;
- makes omissions auditable.

Cons:

- finalist validation can consume substantial compute and machine time;
- relevance and failure-isolation claims require evidence;
- cross-platform coordination adds operational work;
- upstream validation may expose additional external-execution paths that must be inspected first.

Rejected alternative:
run literally every upstream suite.
It maximizes execution,
but spends time and trust exposure on unrelated benchmarks,
stress modes,
and unsupported targets that cannot change the decision.

Rejected alternative:
consumer-boundary checks only.
They prove the immediate integration,
but miss defects and maintenance failures in the upstream quality contract.

Ranking:
CI-equivalent plus every relevant suite beats literal suite completeness because it remains exhaustive for
the claimed surface without executing irrelevant code.
Literal suite completeness beats consumer-only checks because broad upstream validation catches failures a
narrow integration fixture cannot.

### Decision 8: worked example

Decision:
embed a synthetic worked example in `SKILL.md`.
The user selected this on 2026-07-09.

The example must be explicitly fictional and must not use current vendor,
price,
funding,
outage,
release,
or maintenance facts.
Use a fictional credential-handling automation choice whose candidates span:

- a managed SaaS option with the retained six vendor domains and added direct risks;
- an open-source self-hosted option that reaches source and validation gates;
- an opaque proprietary high-trust plugin that exits at the source and provenance gate.

The example should show:

1. measurable context gathered before preference questions;
2. one context-fork question that changes the candidate set;
3. category routing and applicable gates;
4. discovery,
   serious-alternative promotion,
   finalist promotion,
   and a hard-gate exit;
5. precommitted criteria and weights;
6. cited fictional evidence ratings,
   confidence,
   normalized arithmetic,
   and sensitivity result;
7. complete CI-equivalent and relevant-suite validation records for finalists;
8. pros,
   cons,
   evidence limits,
   and adjacent ranking reasons;
9. automatic vet-report path and skill revision;
10. recommendation without adoption changes;
11. later decision-record update only after an explicit adoption action.

Pros:

- keeps the complete governing workflow and example in one file;
- avoids stale real-world claims;
- can deliberately cover every important state and failure path;
- makes scoring arithmetic and lifecycle transitions easy to inspect.

Cons:

- cannot prove the workflow is practical on a real candidate;
- synthetic evidence can look cleaner than real research;
- adds substantial length to an already comprehensive skill;
- scenario fixtures and future real vet reports must provide the practical counterweight.

Rejected alternative:
link a new real vet as the canonical example.
It would demonstrate practical execution,
but becomes historical and requires a substantial unrelated selection audit to finish the skill rewrite.

Rejected alternative:
provide only the output contract.
It is concise,
but gives no end-to-end gold-standard rendering of gates,
scoring,
and lifecycle transitions.

Ranking:
synthetic inline example beats a real canonical vet because the user prioritizes one-file authority and
timeless coverage.
A real canonical vet beats output-contract-only because an executed artifact still teaches the workflow better than
a schema alone.

### Decision 9: default scoring weights

Decision:
use equal default weights and ask only when sensitivity analysis shows an unresolved preference can change the winner.
The user selected this on 2026-07-09.

Process:

1. Give every decision-level soft criterion supported by an explicit requirement or preference its
   precommitted 1-to-5 weight.
2. Give every remaining decision-level soft criterion equal weight 1.
3. Rate and score every fully validated finalist with the frozen rubric.
4. Raise each equal-default criterion from weight 1 through weight 5,
   one criterion at a time,
   while holding all other inputs fixed.
5. If no tested weight changes the winner,
   keep equal defaults and do not ask a rubber-stamp question.
6. If a tested weight changes the winner,
   ask only the preference that determines that criterion's real weight,
   then freeze and rerun the score.
7. Apply the complete medium-confidence,
   low-confidence,
   and low-signal rating sensitivity matrix separately.

Pros:

- exposes rather than hides absent preferences;
- avoids a long weight questionnaire when priorities cannot change the result;
- gives every unprioritized soft criterion equal treatment;
- uses user questions only at genuine decision forks;
- produces a reproducible trigger for reopening weights.

Cons:

- equal weight is still a temporary assumption;
- one-at-a-time sensitivity can miss interactions between several simultaneous preference changes;
- testing the full 1-to-5 range may flag a preference fork the user considers implausible;
- rerunning weights adds arithmetic and report detail.

Rejected alternative:
ask the user to set every weight before research.
It maximizes explicit preference ownership,
but creates questions whose answers often cannot alter the result.

Rejected alternative:
use fixed category presets.
It makes repeated audits consistent,
but embeds unstated project preferences and can silently bias candidates.

Ranking:
equal defaults plus sensitivity beat asking every weight because they preserve user control only where it matters to
the outcome.
Asking every weight beats fixed presets because explicit answers are safer than inferred standing preferences.

### Decision 10: promotion threshold

Decision:
promote every confirmed hard-gate survivor to finalist.
The user selected this on 2026-07-09 because the expected survivor set is manageable in practice.

Promotion sequence:

1. Discovery records every credible candidate found by the category-appropriate search.
2. Cheap screening checks known hard constraints,
   category fit,
   license,
   apparent provenance,
   and apparent inspectability.
3. Plausible survivors become serious alternatives.
4. Targeted evidence confirms every hard gate,
   provenance,
   safety,
   reproducibility,
   and category-fit claim.
5. Every confirmed survivor becomes a finalist.
6. Every finalist receives the full validation bar from Decision 7.

No fixed top count,
score interval,
or preliminary soft ranking limits finalist promotion.
Only a hard failure or product-category mismatch exits a candidate.

Pros:

- no viable hard-gate-passing candidate is excluded by uncertain preliminary scoring;
- promotion is easy to explain and audit;
- preserves exhaustive comparison among eligible technologies;
- aligns audit depth with objective eligibility rather than soft preferences.

Cons:

- every survivor incurs full source and runtime validation;
- a broad problem with many eligible tools can still require substantial work;
- hard gates must be defined precisely enough to prevent soft dislikes from becoming convenient exits;
- the expected manageable survivor count is an operating expectation rather than a fixed bound.

Rejected alternative:
promote by evidence-backed score intervals.
It bounds work more aggressively,
but can exclude a candidate before full validation based on uncertain soft evidence.

Rejected alternative:
promote a fixed top count.
It makes effort predictable,
but arbitrary cutoffs can exclude ties or distinct tradeoffs.

Ranking:
all hard-gate survivors beat score intervals because eligibility,
not preliminary preference,
should control who receives definitive validation.
Score intervals beat a fixed count because they at least respond to evidence and uncertainty rather than
an arbitrary number.

### Decision 11: score-based candidate exits

Decision:
soft score cannot eliminate a hard-gate-passing candidate before finalist validation.
Decision 10 settles this without another preference question.

Weighted scores are calculated for ranking after every finalist completes Decision 7 validation.
A lower soft score lowers final rank but never retroactively excuses skipped source,
upstream,
platform,
or consumer-boundary checks.

Pros:

- prevents circular reasoning where shallow evidence justifies keeping evidence shallow;
- makes all final scores comparable at the same validation depth;
- preserves soft scoring as ranking rather than eligibility.

Cons:

- spends full validation effort on candidates likely to rank lower;
- removes score-based early stopping as a cost control.

Rejected alternative:
allow a large preliminary score gap to stop validation.
It saves work,
but makes the score depend on unequal evidence depth and can lock in an early leader.

Ranking:
full validation before soft-score exits beats preliminary score stopping because equal evidence depth matters more than
reducing a manageable finalist set.

### Decision 12: SaaS soft-risk applicability

Decision:
inspect every retained SaaS risk domain for every SaaS candidate,
but score only findings relevant to the proposed use.
The user selected this on 2026-07-09.

Every SaaS audit inspects:

- layoffs and headcount over 24 months;
- customer reviews;
- outages over 12 months;
- funding,
ownership,
and business model;
- signup friction;
- security and abuse history;
- every direct operational-risk domain added by Decision 5.

For each finding,
the report states:

- what was inspected;
- evidence and date;
- whether it has a plausible causal effect on the proposed use;
- if relevant,
  criterion,
  weight,
  rating,
  confidence,
  and score effect;
- if irrelevant,
  why it receives no score effect.

Inspection is universal;
scoring is relevance-gated.
A domain cannot be omitted merely because the initial workload description did not mention it.
A finding cannot lower score merely because it exists.

Pros:

- preserves broad early-warning discovery;
- catches risks the initial requirements did not anticipate;
- prevents irrelevant vendor facts from changing rank;
- makes every no-score decision inspectable.

Cons:

- broad vendor research remains mandatory even when likely irrelevant;
- causal relevance judgments can be disputed;
- the report must avoid double-counting one incident across overlapping domains;
- inspected but unscored evidence adds report length.

Rejected alternative:
inspect only workload-activated domains.
It reduces work,
but can miss unexpected account,
business,
outage,
security,
or support risks.

Rejected alternative:
inspect and score every domain.
It is uniform,
but lets irrelevant soft facts lower a candidate's rank.

Ranking:
universal inspection plus relevance-gated scoring beats activated-only inspection because discovery should not
depend on
already knowing the risk.
Activated-only inspection beats scoring every domain because relevance still matters more than rubric uniformity.

### Decision 13: vet-report timing and reuse

Decision:
create or update the matching vet report during the audit and complete it before delivering the recommendation.
The user selected this on 2026-07-09.

Lifecycle:

1. Before creating a report,
   search `docs/audit/` for the same decision subject.
2. Reuse the current matching report when its hard constraints,
   deployment context,
   trust boundary,
   incumbent,
   and decision scope are compatible.
3. As soon as the substantial-evaluation threshold from Decision 3 is crossed,
   create or reopen that report.
4. Update it after context,
   discovery,
   hard-gate screening,
   targeted evidence,
   finalist validation,
   scoring,
   and synthesis phases.
5. Record the governing skill revision and each evidence date.
6. Finish the report before returning the recommendation.
7. Create a new dated report only when changed decision context is materially incompatible and merging would obscure
   which evidence supports which constraints.
8. Link later adoption decisions to the vet report;
   do not turn the vet report itself into adoption authorization.

Pros:

- matches the troubleshooting-doc rule that the durable artifact exists before completion;
- preserves work throughout a long audit rather than writing from memory at the end;
- avoids duplicate reports for one evolving decision;
- makes handover possible at every major phase;
- keeps recommendation and adoption separate.

Cons:

- recommendation delivery waits for report completion;
- an existing report can accumulate substantial edits;
- compatibility judgments determine whether history stays in one file or splits;
- concurrent sessions must coordinate edits to the same report.

Rejected alternative:
create a new dated snapshot for every evaluation.
It preserves immutable episodes,
but duplicates evidence and fragments one continuing decision.

Rejected alternative:
recommend first and document later.
It is faster at the response boundary,
but breaks durable-artifact closure and risks losing evidence.

Ranking:
update-before-answer beats new snapshots because one current evidence trail is easier to resume and audit than
duplicates.
New snapshots beat document-later because at least every recommendation still has a completed artifact.
