# Depot CI adoption proposal

Status:
proposed on 2026-10-18 for review.
This proposal is not in force.
It moves to `doc/decision/depot-ci-adoption.md` only after the closure evidence lands and the user
accepts it,
under `AGENTS.md` `DRR`.

This proposal consolidates the operating model settled in the 2026-10-18 interview.
It is supported by [the evaluation](depot-expanded-ci-evaluation.md),
[the independent review record](depot-expanded-ci-evaluation-independent-review.md),
and the closure workstream record.

## Scope

- Applies to all CI execution,
  scheduling,
  caching and provider routing for this repository.
- GitHub remains the forge,
  the check consumer,
  the release-permission holder and the default
  executor.
- Does not change publishing issuers,
  workflow bindings or release producers.
- Does not enable any optional product.
  See "Optional products".
- The rollout plan remains a proposal until Q7 is answered.

## Developer no-overage baseline

- The operating plan is Developer at USD 20 per month.
- Overage is disabled on every product.
- Admission stops at each configured included allowance;
  work that cannot be admitted runs on free
  public GitHub-hosted compute for this public repository.
- The USD 200 combined planning ceiling remains the outer planning limit.
  With overage disabled the operating cash cost is the Developer fee,
  and no paid overage is
  authorized.
- The user reports that the product caps are configured.
  The exact values are not recorded here.
  Current Depot documentation exposes configured caps for container build minutes and GitHub
  Actions runner minutes;
  native CI,
  Tests and storage caps are not documented as configurable.
  The plan records this as a residual control gap and relies on the configured caps,
  the usage
  pages,
  an operational stop and graceful degradation.
- The current trial is on Startup.
  Moving the account to Developer is a separate user step and must be recorded before a
  Developer-based admission is used.

## Advisory-only model

- CI results are advisory.
- No required status checks are configured and no branch protection is changed.
- Direct commits and auto-push remain.
- Results inform keep or revert,
  review and promotion decisions;
  they do not block commits,
  merges,
  pushes or releases by themselves.
- Existing source failures require exact reproducible baselines before their results are reported.
- Setup,
  discovery and artifact-integrity failures are never converted to passes.
- Adopting required checks later requires a new decision record.

## Execution routing

- Ordinary per-push work runs on GitHub-hosted runners by default,
  explicitly including Node type,
  lint,
  unit and process validation.
- The default-branch advisory run uses the sliding-window rate limits currently used by the
  Scorecard workflow as the starting point,
  and adjusts from measured capacity.
  It runs a fast static,
  build and unit subset;
  the complete profile runs in the weekly matrix.
- The repeated complete profile is paid only through one bounded weekly native matrix.
- The weekly matrix covers these capability categories,
  and no others without a new decision:
  static checks;
  Node and Rust test consumers;
  browser and E2E consumers;
  packaged artifacts and host consumers;
  OS,
  architecture and application consumers;
  VM,
  desktop and Android consumers;
  BuildKit and Bake container producers;
  Depot Tests;
  cache and Disk;
  SDK VM profiles.
- Native `pull_request` registration is proven in this repository on a non-default base.
  Push-on-main registration remains untested;
  native profiles run by explicit dispatch for the weekly matrix,
  and no push-triggered native workflow is relied on until the corrected positive control
  passes.
- Paused-session SSH,
  `--ssh-after-step`,
  tmate and interactive session strings are excluded from
  the weekly matrix.
  A separate bounded paused-session qualification is allowed;
  it is a debug feature,
  not a weekly
  capability.
- The concrete matrix membership,
  commands and bounds are a pilot work item with an admission
  record;
  no category is enabled before its record passes.

## Trust boundaries

- Public GitHub-hosted runners are the only executor for untrusted pull-request source,
  including
  fork pull requests and Dependabot updates.
- Depot executes trusted `main` pushes,
  explicit dispatches and the weekly trigger only.
- Fork-PR approval settings and Dependabot exclusion are verified before any Depot runner receives
  work.
- Egress filtering and Tailscale are not assumed;
  Depot execution is trusted-source-only.
- No secret-bearing workflow runs on Depot unless separately admitted.
- Publishing workflows stay GitHub-hosted;
  npm trusted publishing excludes self-hosted runners and
  the pnpr binding names the exact GitHub workflow.

## Cache write policy

- Writes are allowed only from `main` pushes and explicit dispatches.
- Pull requests,
  merge groups and untrusted source restore only.
- Applies to GitHub Actions cache,
  Depot Actions cache,
  Depot project BuildKit cache and
  organization-global Disk.
- No cache holds shipped,
  attested or published bytes;
  release producers stay fresh.
- Each cache format needs an admission record with relative benefit and invalidation evidence
  before enablement;
  a measured regression keeps the format disabled.
- The existing [CI caching policy](../decision/ci-caching.md) remains the measurement record for
  GitHub Actions cache;
  its write and size rules extend to the other systems through this record.

## Review gate

- One independent whole-report review,
  recorded against a pinned evaluation revision,
  precedes any
  paid profile.
- The review is recorded in
  [the review record](depot-expanded-ci-evaluation-independent-review.md).
- Material changes to the evaluation or the weekly matrix require re-review or a recorded waiver.
- The review does not authorize implementation;
  user acceptance of this record does.

## Rollback authority

- Removing the weekly dispatch disables every paid profile;
  advisory-only results leave no required
  check to unwind.
- The operator may disable Depot admission without further approval on:
  repeated classified provider or startup failures beyond the one recovery attempt;
  an allowance or storage breach;
  a trust incident;
  or evidence of a cache or isolation defect.
- Safety disablement records the date,
  profile,
  reason and fallback.
- Re-enabling requires the review gate conditions and user notice.
- On a cache incident,
  stop writes and invalidate the affected family before resuming.

## Optional products

- Default:
  out of scope.
- Enabling any product requires a new dated decision record with eligibility,
  meter,
  cost and
  trust boundary.
- "Applicable capabilities" language does not authorize any product.
- The per-product disposition list from the closure research is recorded here.
- Out for the pilot and phase 2:
  Depot Code,
  Depot Agents,
  Dagger,
  GPU,
  managed AWS,
  customer AWS,
  private connectivity,
  external observability sinks,
  Fast CDN,
  server-side registry promotion,
  and unbounded autoscaling in its unbounded form.
- Out for the pilot and conditional for phase 2:
  custom GitHub runner images,
  pending a measured tool-install and bootstrap share of Depot GitHub runner jobs;
  and registry pull-through,
  pending a measured base-image pull share and Docker Hub rate-limit incidence.
- Depot Code Access app `219785` is the connected app,
  not the Depot Code product.
  Native CI needs the app and default-branch `.depot` workflows,
  not a Code repository.
- Managed AWS and customer AWS are two layers of one product.
  Both are out;
  the customer layer would require two standing `AdministratorAccess` roles.
- Fast CDN and server-side promotion are out because no staging or production promotion exists
  in the repository,
  not because no images exist.
- GPU is out because the accepted interaction path uses software rendering and no hardware
  `/dev/dri` device was found.
- Unbounded autoscaling is out because the audited schema has no provider-side total-builder
  ceiling.
- Enabling any of these requires a new dated decision record with eligibility,
  meter,
  cost and
  trust boundary.
- Signing trust and release publishing remain unchanged.

## Success and acceptance

- Success is measured relative to the public GitHub baseline for the same workload:
  speed,
  coverage,
  reliability and allocation exposure.
  Concrete baselines and thresholds are recorded with the weekly matrix admission record.
- This proposal becomes effective only on explicit user acceptance after:
  the owner-map refresh,
  the native evidence experiments,
  the paused-session qualification,
  the cache and window admission record,
  and the per-product disposition list are recorded.
- On acceptance:
  move this content to `doc/decision/depot-ci-adoption.md`;
  insert the dated supersession note in `doc/decision/ci-provider.md`;
  insert the dated amendment note in `doc/decision/ci-caching.md`;
  record the acceptance in the handover;
  and put the revised rollout plan to Q7.
