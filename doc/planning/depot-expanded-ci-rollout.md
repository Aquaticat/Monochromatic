# Expanded GitHub and Depot CI rollout

## Purpose and accepted constraints

This is the concrete rollout plan for the shared-understanding check after the research interview.
The [evaluation](depot-expanded-ci-evaluation.md) supplies the evidence and its limits;
the [handover](../handover/depot-trial-grilling.md) records the answers.
Implementation follows the user's confirmation of this plan.

The permanent design heavily uses GitHub-hosted runners themselves.
It also uses Depot-managed GitHub runners,
selected native Depot CI workflows and applicable Depot build,
cache,
registry,
test and VM capabilities.
Ordinary Linux workloads remain on GitHub's own compute.
There is no target of progressively moving all eligible work to Depot.

Developer is the USD 20 planning baseline.
The combined monthly planning ceiling remains USD 200.
Standing authority covers bounded recurring overage under conservative reservations.
The repository ledger observes its own allocations;
its estimates do not guarantee an aggregate account invoice.
This plan does not change the subscription.

## Workload allocation and cadence

### Core validation

Run the qualified static,
build and unit profiles on PRs and default-branch pushes.
Preserve the existing direct-commit and auto-push workflow.
Coalesce superseded intermediate validation while keeping explicit release handling separate.

GitHub-hosted Linux runners own ordinary type checking,
linting and Node unit validation as permanent workloads.
GitHub-hosted Windows and Mac runners retain broad native-platform validation,
alongside the existing GitHub-hosted publication boundaries.
These assignments establish useful GitHub execution beyond platform exceptions and emergency fallback.

Depot-managed GitHub runners initially receive selected shared-build and Rust-heavy profiles,
where the retained comparisons establish completed-phase benefits.
Keep actual provider,
machine,
source,
case and artifact identities in every result.
The research does not establish a whole-CI speed multiplier.

Start with explicit owning commands and a visible workload-to-provider map.
Use a conservative complete eligible profile when affected scope is unqualified.
The frozen Mise dependency cycle prevents making that graph authoritative without repair and controls.
Current-source task discovery must preserve active,
paused and archived distinctions.
An owner with no literal test task is not automatically an untested product or a passing check.

### Weekly breadth

Run the wider qualified OS and architecture,
browser,
packaged-consumer,
property and mutation matrix weekly.
Keep Chromium,
Firefox and WebKit results separate.
Execute actual packed artifacts in fresh consumers rather than substituting source imports or build success.
Retain native-platform case identities and overlaps rather than adding incompatible counts.

GitHub-hosted runners remain a substantial execution pool for this breadth.
Use Depot for selected accelerator,
ARM,
container and VM profiles where the particular workload qualifies.
Provide explicit manual or agent-requested profile dispatch for investigation and qualification.
Keep private personal fixtures local.
No recurring local desktop,
emulator or device service is installed by this rollout.

## Verdicts and recovery

Use the accepted regression ratchet.
Qualified known-good checks and new or changed failures block their validation gate.
Only explicitly identified existing source failures can remain advisory.
Baseline actual reproducible cases,
inputs and assertions;
never exempt an entire failing owner or command.
Reproduce baselines on the implementation candidate's immutable source before accepting them.
The historical failures are evidence to investigate,
not automatically current exceptions.

Setup,
discovery and artifact-integrity failures always fail validation.
Missing or unexecuted consumers cannot become passes.
Preserve original stdout and stderr separately and retain per-case outcomes.
The harness's deliberate inner failure controls remain separate from product failures.

Stable GitHub validation gates consume the exact required artifact set and worker outcomes.
Exercise genuine PR association,
source failure,
cancellation,
missing-artifact and altered-artifact controls before relying on a new gate.
Automatic artifact or release promotion respects its qualified gates;
this work does not trigger a release or impose a PR-only development policy.

Allow one automatic recovery attempt for a classified provider or startup failure.
It may use the same pool or an eligible alternate pool.
Reserve exposure for both attempts and preserve the original diagnostic and attempt identities.
Source failures retain their failure verdict;
an unrelated passing provider cannot erase them.
An unclassified failure blocks rather than becoming an automatic recovery candidate.

## Depot capabilities and cache policy

Promote selected Linux workflows to native Depot CI after qualification of their actual features,
case identities,
GitHub result association and producer/consumer boundaries.
This promotion complements permanent heavy GitHub-hosted execution.
Workflows requiring the unqualified paused-session attachment stay on GitHub until that boundary qualifies.
Other selected workflows qualify against their own needs.

Use admitted BuildKit and Bake profiles for immutable container producers,
with actual runtime consumers and preserved provenance checks.
Use Depot Tests where adapters retain original JUnit identities,
shard membership and attempts.
Expose qualified SDK VM and native KVM work as bounded profiles with lifecycle consumers and cleanup.
Do not infer a universal test-splitting benefit,
signing trust or complete VM coverage from the selected research controls.

Select caches by owner and cache system rather than enabling one blanket cache policy:

- The measured pnpm store profiles using `actions/cache` do not justify a universal store-cache default.
- The Kotlin linter's Gradle task-output cache has a measured command-phase benefit;
  retain the qualification and distinguish it from whole-job setup.
- Direct sccache and compiled test-target archives require their own source,
  toolchain and reader controls.
  The archived-target CLI build result does not establish a Nextest execution speedup.
- Prepared tools,
  snapshots and Disk mounts need executable admission,
  secret-exclusion controls and single-writer or partitioned ownership.

Respect the existing [CI caching policy](../decision/ci-caching.md),
including the prohibition on caching artifacts a workflow ships.
Validate cache-off execution,
invalidation and stale-output rejection before enabling each format.
Keep release producers fresh under their owning policy.
Reviewed registry and transfer options receive no invented performance benefit.
Unbounded autoscaling remains outside automatic paid admission.

## Admission and implementation sequence

Every paid profile declares resource and execution bounds,
retention exposure and its conservative reservation.
Where remaining included allowances are unknown,
do not assume unused credits.
Track allocations and overlapping recovery attempts without double counting.
Keep terminal API timestamps separate from invoice and physical-deallocation claims.
Insufficient headroom selects an eligible GitHub profile where qualified;
otherwise report incomplete admission rather than a successful test.

Implement these independently verifiable work items:

1.  Refresh current-source owners,
    profiles and reproducible failure baselines from the retained source/runtime methodology.
2.  Add the GitHub-hosted core profiles,
    explicit Depot-managed build profiles and exact-result collection.
3.  Implement and exercise conservative admission,
    concurrent reservations,
    supersession and the single recovery attempt.
4.  Add the weekly breadth and actual packaged-artifact consumers,
    with private fixtures and local devices kept within their accepted boundaries.
5.  Enable measured cache formats and admitted BuildKit,
    Tests and VM profiles after their consumer controls pass.
6.  Qualify and promote selected native Linux workflows,
    retaining the permanent GitHub-hosted assignments and a visible routing override.
7.  Verify the real PR and artifact-promotion boundaries,
    then measure configured-profile duration,
    failure results and allocation exposure before relying on the recurring schedule.

Reuse existing task,
generation and budgeting owners where they apply.
Keep experiments isolated while deliberating.
Do not claim every product feature or source branch is covered by the research or by this plan.

## Shared-understanding check

Confirm whether this captures the agreed operating model and permits implementation.
If it differs,
identify the requirement or assignment to change.
Runner labels,
cache encodings,
retry timers and other engineering details are chosen and verified during implementation.
