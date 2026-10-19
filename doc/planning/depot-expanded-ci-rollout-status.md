# Expanded CI rollout status

Status date:
2026-10-19.
Source plan:
[the accepted rollout plan](depot-expanded-ci-rollout.md),
revision `d94e50bec4`.
Decision record:
[the Depot CI adoption decision](../decision/depot-ci-adoption.md).
Baseline register:
[the current baseline register](depot-expanded-ci-baseline-register.md).

## Answer

No,
not everything is done.
The plan and its decision records are accepted.
The default-branch and pull-request advisory profile is implemented and qualified.
The remaining work items are admission and fallback,
the weekly native matrix,
cache admission,
trust controls,
the full prepared-environment baseline,
relative-target measurement,
and the
subscription transition.

## Work item status

### 1. Baseline refresh and triage

Partial.

- Owner map refreshed at `98381bfa32`:
  225 packages,
  210 active,
  13 paused,
  2 archived,
  14,301 files,
  2,600 authored task declarations,
  2,464 expanded records.
- Fast subset known-good at GitHub run `39199930641`:
  five owning build tasks and their tests.
- Whole-tree static,
  unit and complete build baselines are recorded as not known-good.
- Full build and unit are blocked on a prepared environment;
  the failure classes are
  environment,
  toolchain,
  build-order and dependency failures,
  not product attribution.
- Per-case triage of the 85,719 static findings and the full unit failure set is not complete.

### 2. GitHub-hosted advisory profiles

Done for push,
pull request and manual dispatch.

- [advisory-core.yml](../../.github/workflows/advisory-core.yml) runs the five-owner fast subset.
- Push gate:
  2 per minute,
  4 per hour,
  8 per day;
  newest skipped tip marked pending.
- Pull requests run the same profile and do not consume the push budget.
- Manual dispatch qualifies without consuming the push budget.
- Static and build continue on failure;
  unit runs after a successful build;
  one final enforce step
  fails the job if any profile failed.
- Results are advisory check runs and a step summary.
  No required checks and no branch-protection
  change.
- Manual qualification run `39202293518` passed the gate,
  build,
  unit and enforce steps.
- The first admitted push run `39201617300` found a changed-file static failure in
  `doc/handover/slint-ide-0x.md`.

### 3. Admission, caps and fallback

Not implemented.

- The user reports the product caps are configured;
  values are not recorded.
- Documented caps exist for container build minutes and GitHub Actions runner minutes.
- Native CI,
  Tests and storage caps are not documented as configurable.
- The reservation ledger,
  public-GitHub fallback rule and graceful-degradation implementation are
  not built.

### 4. Weekly native matrix

Not implemented.

- The matrix categories and explicit-dispatch rule are recorded in the plan.
- No weekly workflow,
  dispatch schedule,
  per-category bounds or admission record exists yet.
- All native capabilities remain qualified only by research and evidence controls.

### 5. Cache admission

Not implemented.

- Main-only write policy and the disabled pnpm and target-archive formats are recorded.
- Gradle command-boundary admission and later format controls are not implemented.
- No cache admission record or invalidation control exists yet.

### 6. Trust and identity controls

Not implemented.

- Fork approval,
  Dependabot exclusion,
  publishing-host binding,
  secret boundary and cache-isolation
  controls are recorded as requirements but not implemented or verified in this rollout.
- Publishing remains GitHub-hosted by plan;
  no workflow change has been made.

### 7. Native evidence closure

Mostly done.

- Push and pull-request registration proven;
  duplicate execution observed.
- Check names observed as `<workflow> / <job>` from app `219785`.
- Paused-session remains unqualified and is excluded from the weekly matrix.
- Evidence is in `doc/audit/`.

### 8. Measurement and relative targets

Not started.

- Requires the prepared environment and the full baseline.
- Relative targets remain placeholders until the first measured comparison.

### 9. Governance and Q7

Done.

- Q7 confirmed the revised plan at `d94e50bec4`.
- The adoption record is accepted in `doc/decision/`.
- The provider and cache supersession notes are in effect.
- The subscription transition from the Startup trial to Developer remains a separate user action.

## Current next action

Implement work item 3:
the admission record,
configured-cap record,
reservation ledger,
public-GitHub fallback and graceful-degradation path.
