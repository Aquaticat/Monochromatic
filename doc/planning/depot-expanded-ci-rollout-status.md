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

All nine planned work items now have implementation records.
The advisory profile,
admission and fallback,
weekly native matrix,
cache admission,
trust controls,
native qualification and fast-subset measurement are recorded.
The complete build and whole-repository unit baseline are still not known-good.
BuildKit and the VM matrix category remain unqualified for environment-specific reasons.
The subscription transition remains a user action.
These residuals are listed at the end of this status.

## Work item status

### 1. Baseline refresh and triage

Done for the capture and failure-class triage.
The complete build and unit baseline remain not known-good.

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
- Prepared native complete baseline run `2ls35xfpds` installed glib,
  gdk-pixbuf,
  cairo,
  pango,
  GTK,
  Qt6 and Podman.
  The build still failed on 13 owning tasks:
  rootless Podman namespaces,
  cargo vendor downloads,
  the music player design capture precondition,
  the Android build in the complete fanout,
  the desktop application,
  the native plugin,
  the static site,
  the terminal release-library order,
  `canvg` and the Wayland session.
  The unit step was skipped.
- Whole-tree static findings are recorded as a class-level baseline,
  not per-finding product defects.
- Evidence:
  [prepared native baseline](../audit/depot-native-baseline-2ls35xfpds-2026-10-19.evidence.json)
  and [CI baseline evidence](../audit/depot-current-baseline-2026-10-18.evidence.json).
- The complete build and unit baseline remain not known-good;
  the residual is recorded rather than treated as green.

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

Done.

- [The weekly matrix design](depot-weekly-native-matrix.md) records the category list,
  explicit-dispatch rule,
  bounds,
  evidence format and acceptance.
- The dispatch-only workflow is `.depot/workflows/weekly-native.yml` with a single-use
  [reservation](depot-weekly-native-reservation.json).
- First dispatch `dmjf38bcz0` completed in 14 minutes 22 seconds within its 120-minute
  reservation.
- The fast subset and Android consumer passed.
  Static checks reproduced the known baseline.
- BuildKit failed on rootless Podman user namespaces.
- The vmsync end-to-end test failed on a doubled module path,
  a test-path defect.
- Categories with no qualified command are recorded incomplete.
- Clean re-dispatch `r2mxbc40rh` completed in 14 minutes 39 seconds and reproduced the same
  category outcomes.
  No duplicate execution occurred;
  all four runs are in the ledger.
- Two follow-up runs tested environment fixes.
  `xv1dwhq3h4` resolved the vmsync path and then missed `qemu-img`.
  `130wfntbg4` installed `qemu-img` and then missed `virsh` and libvirt.
  BuildKit still failed on the rootless Podman namespace with `PODMAN_USERNS=host`.
- Evidence:
  [the weekly matrix evidence](../audit/depot-weekly-native-2026-10-19.evidence.json).
- Residual capability gaps:
  BuildKit needs a rootful Podman path,
  and the VM category needs a libvirt-capable sandbox.
  Both are recorded incomplete rather than product failures.
  The fast subset,
  Android and static categories carry the matrix result.

### 5. Cache admission

Done for the current format set.

- [The cache admission record](depot-cache-admission.md) inventories the admitted cargo,
  CodeQL and MSYS2 families,
  the disabled pnpm store and target archive,
  and the Gradle restore-only state.
- The music player release workflow exposes a separate `save_gradle_cache` flag and sets it false,
  so no later format was admitted.
- Cache-off,
  invalidation and stale-output evidence for Gradle is still missing,
  which is why Gradle remains restore-only rather than admitted.
- The existing cargo and MSYS2 families rely on the 2026-10-15 measurements,
  not a fresh rerun.
- No new cache format is admitted by this work item,
  so no new format's acceptance tests are owed.

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

Done for the fast subset,
with the complete profile residual.

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
- Native weekly repeats `dmjf38bcz0` and `r2mxbc40rh` completed in 14 minutes 22 seconds and
  14 minutes 39 seconds,
  a 2 percent spread.
- The complete build and unit profile is not measured because the build is still not known-good.
- There is one GitHub sample;
  the targets remain provisional rather than final.

### 9. Governance and Q7

Done.

- Q7 confirmed the revised plan at `d94e50bec4`.
- The adoption record is accepted in `doc/decision/`.
- The provider and cache supersession notes are in effect.
- The subscription transition from the Startup trial to Developer remains a separate user action.

## Current next action

All planned work items are implemented and recorded.
The remaining residuals are explicit:

- the complete build and unit baseline is not known-good;
- BuildKit needs a rootful Podman path in the native sandbox;
- the vmsync end-to-end test has a doubled module-path defect;
- release-run attachment still relies on check runs on the commit;
- the subscription transition remains a user action.

Fix the vmsync path on its owning package,
then retry the BuildKit category with a rootful Podman command.
Keep the complete build and unit baseline marked not known-good until it actually passes.
