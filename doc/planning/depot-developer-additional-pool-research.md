# Expanded CI using Depot and GitHub: research plan

## Authorization and sequencing

On 2026-10-18,
the user requested migration toward Depot Developer as an additional pool alongside GitHub,
invoked grilling,
and required research before the interview begins.
Depot and GitHub Actions experiments are authorized for that research.
Do not start grilling while a factual prerequisite can still be researched or tested.

The user subsequently clarified that migration is the wrong framing:
the objective is to use Depot's full capabilities and greatly expand the current CI setup.
Developer remains the intended base plan,
and GitHub remains complementary capacity.
Discovery must cover the full Depot platform relevant to that expanded CI,
including capabilities absent from current workflows and capabilities outside Developer eligibility.
Eligibility gaps inform the later interview rather than silently narrowing research.
The research must determine practical routing,
reuse,
coverage,
cost and operational consequences before presenting the remaining preference decisions.
The existing USD 200 future all-provider monthly ceiling and waiting-time valuation remain inputs.
Account-wide access and subscription changes remain excluded by the prior explicit constraint.
The new experiment authorization does not require a subscription change to test the proposed arrangement.

Production routing and the paid-plan transition follow the completed interview and shared understanding.
Research harnesses live in isolated branches and worktrees;
the main worktree receives documentation and evidence.

## Independently verifiable research areas

- Provider capabilities and billing:
  the current complete platform inventory,
  Developer eligibility,
  separate allowances,
  normalization,
  storage,
  retention,
  concurrency,
  admission controls and trial-to-paid transition semantics.
  Include remote container builds,
  CI sandboxes and orchestration,
  GitHub runners,
  reusable images,
  caches and disks,
  registry,
  test reporting and splitting,
  debugging and programmatic execution.
- Repository workload and selection:
  existing workflows,
  affected-package and consumer selection,
  missing coverage,
  package tasks,
  scheduling policies and artifact consumers.
- Cache and reusable environments:
  fresh-job cold and warm comparisons,
  changed source and dependency invalidation,
  prepared files versus fresh runtime services,
  trust and storage costs.
- Pool routing and orchestration:
  intentional placement,
  explicit cloud requests,
  concurrency,
  superseded-work cancellation,
  failures,
  fallback and stable status identities.
- Trust and credentials:
  fork events,
  OIDC,
  action provenance,
  cache writers,
  artifact identity,
  private-resource exposure and release boundaries.
- Economics and user-visible performance:
  complete preparation and consumption cost,
  observed variance,
  useful unfinished-work intervals,
  actual arrival mix and selective overage.
- Rollout and recovery:
  reversible stages,
  source and cache compatibility,
  provider outages,
  observability,
  rollback and adoption acceptance checks.

## Working evidence and ownership

The research skill assigns background primary-source work.
Separate agents own the capability,
repository-routing and cache notes;
the main agent owns executable research harnesses,
integration of results and the decision tree.
All findings distinguish current official documentation,
source inspection,
real invocation,
observed output and unresolved evidence.
Performance and cache claims name the workflow and job,
cache implementation,
input state and timed boundary.
Policy extrapolation to a similar job stays distinct from a measurement of that job.

The existing cache evidence demonstrates reuse but does not establish a fresh-job warm comparison between providers.
The native follow-up demonstrated execution,
not a controlled native provider speedup.
These are experiment inputs,
not reasons to skip the missing measurements.

## Completion before grilling

Research is ready for the interview when each area has cited findings,
applicable behavior has a real invocation or a clearly bounded unexercised limit,
plausible designs have been tested far enough to expose disqualifying problems,
and remaining questions are preferences rather than facts the agent can obtain.
Summarize the decision tree and ask its whole settled-prerequisite frontier in a single round.
Do not ask the user to rediscover repository facts or repeat settled preferences.

## Current work

Research is active.
The cited [platform inventory](depot-developer-pool-capabilities-research.md)
and [repository routing study](depot-developer-pool-routing-research.md) are complete.
The [cache study](depot-developer-pool-cache-research.md)
now includes real fresh-job Cargo compiler-cache hits,
changed-flag invalidation,
automatically supplied short-lived credentials and concurrent persistent-disk consumers.
The parent-owned pnpm experiment is finishing its repeated cache-disabled,
explicit-miss and warm comparisons.
An independent research review is checking completeness and the remaining decision frontier.
The user correction broadens every area's applicability to a substantially expanded CI graph;
today's workflows are a measured incumbent,
not the limit of the design.
No interview question is pending.

## Research findings and remaining acceptance work

- Platform:
  Developer covers Linux and Windows execution,
  with separate CI,
  Actions and container-build allowances.
  Depot Mac eligibility requires Startup;
  GitHub Mac remains complementary.
  The platform inventory also covers registry,
  snapshots,
  SDK sandboxes,
  Code,
  Agents,
  reports,
  splitting,
  disks and product-specific admission controls.
  Source-verified eligibility is distinct from repository runtime acceptance.
- Workload selection:
  the study enumerates 2,421 tasks,
  including hidden tasks,
  and desired consumers beyond today's workflows.
  Actual Mise graph evaluation rejects a real development-dependency cycle.
  A pnpm reverse-closure probe traverses that cycle correctly;
  it does not establish complete cross-language selection.
- Routing:
  immutable-source probes cover both pools,
  each pool alone,
  intentional worker failure and cancellation propagation.
  Dispatch checks do not establish required PR-check enforcement or stopped billing.
- Trust:
  cache branch isolation,
  fork restrictions,
  release identity and publisher eligibility are separate boundaries.
  A key prefix is not isolation.
  Preserve eligible GitHub-hosted npm publication and the repository's exact pnpr trust configuration.
- Economics:
  observed repository arrivals and documented product prices are retained.
  They do not price a substantially expanded graph.
  Account-wide usage remains uninspected,
  and vendor minute caps do not establish the requested aggregate dollar ceiling.
- Rollout:
  bounded explicit profiles can precede authoritative affected selection.
  Required checks,
  current-source failure policy,
  headful Android feasibility,
  Hyper-V consumers and complete GUI coverage retain explicit adoption checks.
  Historical KVM guest execution is verified;
  it does not substitute for those distinct consumers.

The final pnpm timing comparison and independent review remain factual research work.
Production profiles,
PR enforcement and failure remediation remain implementation and acceptance work after the interview.

## Runtime research ownership

The [fresh-job pnpm-store experiment](depot-pnpm-store-fresh-job-research.md)
compares GitHub and Depot GitHub Actions cache backends using the current workspace installer
and existing semantic-bridge artifact consumers.
The parent agent owns this probe.
The cache researcher owns standalone Depot CI persistent-disk verification.
The routing researcher owns GitHub/Depot pool selection and aggregate failure gates.
The capabilities researcher owns the bounded Sandbox SDK lifecycle and runtime probe.
All experiments are isolated from production routing and subscription settings.

## Reporting-rule clarification

The user corrected the vague statement that caching slowed unspecified jobs.
The exact measured regression is GitHub Actions `actions/cache` for the pnpm store
in `readonly-semantic-bridge.yml`'s cross-platform semantic-bridge jobs.
It does not establish a Depot Cache regression or independent measurements of other pnpm workflows.
The [existing cache decision](../decision/ci-caching.md#pnpm-store-not-cached)
now records the workload,
backend and measurement boundary explicitly.

A concrete proposed tightening of `AGENTS.md`'s existing `QNB` rule is:

```text
# Proposed AGENTS.md replacement; not applied.
QNB:
Comparing noisy results:
name workloads, cache systems and timed boundaries;
measure unchanged-input spread first.
Differences within that spread are noise.
```

The proposal remains unapplied.
Present it with the interview's independent decisions after factual research,
respecting the user's instruction not to start grilling yet.
