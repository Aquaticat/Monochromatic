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

Done for the policy,
ledger and executable gate.
The first paid reservation remains part of work item 4.

- [The admission ledger](depot-admission-ledger.md) and
  [its machine-readable state](depot-admission-ledger.json) record the active plan,
  both allowance sets,
  the configured-cap statement,
  the documented gaps,
  the fallback matrix,
  the recovery rule and the reservation schema.
- The USD 200 capacity ceiling,
  no-overage rule and storage stop are recorded.
- [The admission gate](../../.github/workflows/admission-gate.yml) admits,
  returns a public-GitHub fallback,
  marks incomplete,
  or rejects invalid input.
- Gate scenarios `39267811638`,
  `39267816590`,
  `39267822418`,
  `39267853939` and
  `39267860138` exercised the admit,
  fallback,
  incomplete,
  ceiling and invalid decisions.
- The ledger attempts array is empty;
  no paid profile has been admitted yet.

### 4. Weekly native matrix

Partial.

- [The weekly matrix design](depot-weekly-native-matrix.md) records the category list,
  explicit-dispatch rule,
  provisional bounds,
  evidence format and acceptance.
- The design excludes paused-session and keeps publication on GitHub.
- No native workflow,
  reservation file or first dispatch exists yet.
- All native capabilities remain qualified only by research and evidence controls.

### 5. Cache admission

Partial.

- [The cache admission record](depot-cache-admission.md) inventories the admitted cargo,
  CodeQL and MSYS2 families,
  the disabled pnpm store and target archive,
  and the Gradle restore-only state.
- The music player release workflow now exposes a separate `save_gradle_cache` flag and sets it
  false,
  so Gradle writes are disabled until its controls pass.
- Cache-off,
  invalidation and stale-output evidence for Gradle is still missing.
- The existing cargo and MSYS2 families rely on the 2026-10-15 measurements,
  not a fresh rerun.

### 6. Trust and identity controls

Done for configuration verification.

- [The trust and identity record](depot-trust-and-identity-controls.md) verifies fork approval,
  Dependabot exclusion,
  publishing-host binding,
  the secret boundary and cache isolation.
- Fork approval is `first_time_contributors`.
  Fork and Dependabot events cannot reach a Depot runner because the Depot workflows are
  dispatch-only and no PR-triggered workflow requests a Depot label.
- Publishing stays GitHub-hosted.
- Depot CI has no secrets or variables.
- Residual:
  fork approval is not `all_external`,
  and the checks are configuration inspection rather than a live fork event.

### 7. Native evidence closure

Done.

- Push and pull-request registration proven;
  duplicate execution observed.
- Check names observed as `<workflow> / <job>` from app `219785`.
- [The qualification register](../audit/depot-native-qualification-register-2026-10-19.md) states
  exactly what is qualified and what is not.
- Paused-session is not qualified and is excluded from the weekly matrix.
  The decision is not to rerun it in this rollout.

### 8. Measurement and relative targets

Partial.

- [The measurement record](depot-ci-measurement-targets.md) compares the Depot 8x32 fast-subset
  run `39199930641` with the GitHub-hosted advisory run `39202293518`.
- Observed ratios:
  build plus unit 0.50,
  install tools 0.40,
  job wall 0.48.
- Provisional targets are adopted:
  0.75 for build plus unit,
  0.75 for install tools and
  0.90 for job wall.
- The complete build and unit profile still needs the prepared environment.
- A second sample is required before treating the targets as stable.

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
