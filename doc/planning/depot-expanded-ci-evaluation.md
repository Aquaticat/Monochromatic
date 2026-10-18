# Depot expanded CI evaluation working report

## Decision and acceptance limits

Use Depot as an additional execution and build pool,
with Developer as the requested planning baseline.
Keep GitHub Actions orchestration where its integration or native-platform requirements justify it.
The expanded evaluation covers application owners,
artifact consumers,
caching,
containers,
VMs and test infrastructure;
the [execution handover](../handover/depot-trial-grilling.md)
records the accepted scope and remaining work.
This working report precedes independent sufficiency review and the requested interview.

The evidence supports a selective hybrid rather than a blanket whole-CI speed multiplier.
Native Depot CI and Depot-managed GitHub Actions are distinct products:
the [native CI overview](https://depot.dev/docs/ci/overview)
limits native sandboxes to Linux,
while the [GitHub runner catalog](https://depot.dev/docs/github-actions/runner-types)
lists Windows and Apple Silicon Mac compute.
Developer makes Depot Windows available;
Mac eligibility starts with Startup
([current eligibility and allowance sources](../audit/depot-included-allowance-2026-10-18.evidence.json)).

The historical native follow-up's price comparison covers native CI usage alone.
It does not establish that Developer is always cheaper across separate product allowances.
For example,
the explicitly hypothetical monthly input of 20000 native two-CPU base minutes and
20000 Linux GitHub-runner two-CPU base minutes costs USD 236 on Developer versus USD 200 on Startup,
before unspecified services or charges
([executed combined model](../audit/depot-combined-product-pricing-2026-10-18.evidence.json)).
The USD 200 ceiling therefore requires an explicit workload allocation.

## Immutable workloads and scope

The expanded repository source is `e02be6c8b8fe9efb41a7f8f1a0b311c17796588a`.
Application source,
research harness revisions,
generated producers and consumer receipts retain separate identities in the
[coverage research record](depot-complete-coverage-research.md),
[Rust record](depot-rust-coverage-research.md)
and [runtime record](depot-runtime-orchestration-research.md).
Later main changes do not silently enter that cohort.

The original trial's four historical source cases and native follow-up cohorts retain their own manifests.
Their 770 primary gates are a historical inventory,
not the denominator of the expanded repository evaluation
([historical evaluation](../audit/tech-depot-complete-ci-trial-vet-2026-10-18.md)).
Counts of source files,
owning task invocations,
enumerated tests,
executed bodies and result-upload events remain separate.

The evidence is principally first-party execution data and inspected implementation source.
Primary receipts bind original ZIP/member hashes,
source revisions and actual consumers.
Documentation-only capabilities remain distinct from exercised repository workloads;
capturing a source page does not establish substantive applicability review.

## Gate and artifact-consumer results

### Actual producer and consumer boundaries

The fresh native artifact consumer verified all 1036 declared compiled hashes,
including the hidden manifest.
Flattened symlinks still broke its first real import.
Restoring source-owned activation and emitted dependency links from the same immutable artifact made
permission and prohibition pass with zero HTTP/provider requests;
the remaining `none` case reached the preserved `unresolved` versus `unspecified` assertion.
The consumer did not rebuild the application or rerun the unit suite
([source and retained controls](depot-complete-coverage-research.md)).
An artifact-membership pass alone cannot qualify that runtime boundary.

The browser profile exercised all eight browser specs in each engine:
Chromium passed 28 cases,
Firefox passed 28,
and WebKit passed 26 with one OPFS assertion failure and one authored skip.
The separate active DOM E2E profile exercised all four specs,
passing 17 cases each in Chromium and Firefox.
The original root E2E discovery failure remains retained separately from that explicit active-spec profile
([browser/E2E evidence and original receipts](depot-complete-coverage-research.md)).

The current-source Rust work completed bounded ASan execution of all 35 frozen fuzz targets.
Truepeak's all-features Nextest owner passed 89 cases with two expected skips.
The actual Codex host returned forty real successful shell results through its unchanged signed binary,
using a deterministic local fixture rather than paid provider calls
([Rust primary receipt](../audit/depot-rust-coverage-2026-10-18.evidence.json)).
Planted-fault,
compiler-consumer,
corpus-provenance and privileged-WG evidence remain separate result families in that record.
The privileged WG replay passed all eleven ignored cases after explicit Node-PID-one and Tini reaping controls;
the fifteen ordinary cases were filtered from that targeted replay.
The missing namespace init explains that fixture's six preceding process-identity teardown failures,
without changing frozen product source
([Rust execution record](depot-rust-coverage-research.md)).

The exact cloud-produced Android APK pair has a headful local consumer:
all sixteen source-derived instrumentation cases were reported,
fourteen passed and two retained the known session-store context-fixture failure,
with no skips.
The receipt binds APK identities,
device settings and emulator/ADB cleanup
([Android consumer](../audit/depot-android-consumer-2026-10-18.evidence.json)).
This functional device pass is separate from APK layout,
signing,
JNI and producer JVM checks.

### Execution infrastructure

Native Depot,
Depot-managed GitHub Actions and standard GitHub now each have a passing actual frozen `mvm` guest lifecycle.
The standard-GitHub replay preserves UID/GID and adds the actual device group only to the disposable child.
All three passing consumers verify guest stdout,
exit-two stderr,
a 51-byte shared-directory CLI roundtrip and private-domain/daemon cleanup
([all eight original archives and outcomes](../audit/depot-mvm-kvm-2026-10-18.evidence.json)).
That roundtrip did not separately assert guest payload visibility or a guest write.
An independent source review identified this test gap;
an explicit guest transformation consumer is now in the execution queue.
The earlier failed probes remain historical observations;
the named-ACL mutation's writer is not identified.

The service/container profile passed four native and six GitHub host/job-container consumers.
It verifies actual locked Node 26.12.0,
its executable identity and loaded `libatomic`,
separately from the image's Node 24 runtime
([service primary receipt](../audit/depot-service-containers-2026-10-18.evidence.json)).
That image's Git 2.39.5 qualifies its exercised checkout consumer,
not the Git-policy suite's exact Git 2.56 requirement.

The per-test identity adapter passed timed physical splitting:
both shard commands found historical timings for all 34 candidates,
executed disjoint 17-case partitions and passed the exact-union consumer.
The original JUnit bytes,
validated classname adaptation,
stored result rows and committed guard-removal failure are retained
([Tests adapter receipt](../audit/depot-tests-identity-adapter-2026-10-18.evidence.json)).
Physical sandbox identities are not a claim about distinct physical hosts or a speed ratio.

The multi-architecture BuildKit campaign produced actual AMD64 and ARM64 image consumers,
including locked Node 26 execution,
and verified registry read-only access against a rejected write.
SPDX and SLSA subjects matched the saved image identity;
the separate OCI archive's empty subject retained its own disposition.
The four-target Bake run exercised overlapping target work,
secret delivery and keyless SSH listing,
but did not perform an SSH signature or prove project-level autoscaling
([BuildKit primary receipt](../audit/depot-buildkit-platform-campaign-2026-10-18.evidence.json)).
Truepeak's image build and cache checks reported zero tests;
the separately executed 89-case owner supplies its test evidence.

The SDK campaign created and stopped three isolated VMs.
Its final consumer used the absolute required Git executable,
read a bounded manifest and completed a nonce write/read/delete cycle.
The earlier Node-path failure and operation with an unresolved read timeout remain separate failed probes.
The command-log query's empty response does not prove complete absence of execution logs.
Fresh terminal VM reads prove the observed stop state,
without establishing a billing-release instant
([SDK and platform evidence](depot-platform-capability-research.md)).

## Reliability and source failures

The original same-name artifact rerun selected a stale archive alongside current producer outputs;
the hash guard rejected it.
Numeric-ID sorting is source-proven,
but the failing Action's raw pre-filter response was not captured,
so the specific incident cannot distinguish sorting from a visibility race.
Content-bound artifact names passed both a fresh consumer and complete rerun
([source trace and controls](../troubleshooting/depot-rerun-artifact-id-order.md),
[original evidence](../audit/depot-native-orchestration-2026-10-18.evidence.json)).

An isolated job-level allowed failure produced a failing native aggregate and GitHub App suite,
while the paired GitHub workflow succeeded.
Default downstream eligibility passed separately;
the isolated step-level continuation retained failure outcome,
success conclusion and successful native job/workflow status
([policy/history receipt](../audit/depot-job-policy-history-2026-10-18.evidence.json)).
Continuation semantics need the exercised granularity.

The original job-container image selected checkout's REST fallback;
the independent image control found no Git executable on its default AMD64 `PATH`.
These facts do not identify the original REST download stall's cause.
The Git-capable successor then exposed the locked Node 26 loader's missing `libatomic.so.1`;
the final derived image passed all ten actual service consumers
([prerequisite source and run controls](../audit/depot-container-prerequisites-2026-10-18.evidence.json),
[retained executable image delta](../troubleshooting/github-actions-container-node-runtime-prerequisites.md)).

The built-in Semgrep 1.34 scan missed the controlled missing-`USER` and non-JSON `CMD` cases.
The same retained rule bytes executed by Semgrep 1.181 detected both,
while the Hadolint root/non-root controls behaved as expected.
This qualifies the replacement scan execution;
it does not establish a repaired Depot built-in scanner
([scanner and rule-source evidence](depot-platform-capability-research.md)).

Every measured provider allowed the finite seventy-second writer past a sixty-second step deadline.
Only native Depot's observation proves completion after the executor advanced to its next step;
both GitHub-orchestrated observers started after their writers finished.
The source-backed note separates that observation from unknown descendant signal routing,
VM release and billing
([process receipt](../audit/depot-process-timeouts-2026-10-18.evidence.json),
[deciding-source note](../troubleshooting/depot-step-timeout-process-boundary.md)).

Product assertions,
harness errors,
missing producers and prerequisite failures retain different dispositions.
The recorded browser OPFS assertion,
native `none` assertion,
property/conformance counterexamples and Android fixture failures are not converted to passing gates
by successful setup or successful unrelated siblings
([coverage record](depot-complete-coverage-research.md),
[Android receipt](../audit/depot-android-consumer-2026-10-18.evidence.json)).

## Provider allocation, cost, and critical paths

Developer includes 500 build minutes,
2000 native CI base minutes,
2000 GitHub runner base minutes and 25 GB combined cache/registry storage.
Startup includes 5000,
20000,
20000 and 250 GB respectively.
Both include one million passing Tests results;
extra passing results cost USD 0.000001 each.
Current primary wording and unit limits are retained in the
[allowance reconciliation](depot-included-allowance-reconciliation.md).
Mac allowance normalization and generic SDK eligibility for included CI credits remain unresolved;
the model does not grant those forecast credits.

The [combined pricing model](../audit/depot-combined-product-pricing-2026-10-18.evidence.json)
prices independent named product entitlements,
combined storage and passing results.
Its scenario inputs are hypothetical monthly quantities,
not observed future event rates.
The [cost/critical-path work record](depot-expanded-ci-cost-model.md)
owns allocation-row normalization and the remaining whole-graph calculation.
Standard GitHub public-repository compute remains a zero-compute-cost option;
artifact/storage rules are separate
([GitHub billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)).

Cache conclusions name the workload and mechanism.
Both fresh pnpm profiles use pinned `actions/cache/restore` and `actions/cache/save`
at `27d5ce7f107fe9357f9df03efb73ab90386fccae` for the isolated pnpm content store.
The `pnpm store github` jobs use GitHub Actions cache;
the `pnpm store depot` jobs use Depot's Actions cache integration.
The fresh GitHub profile's two cache-disabled restore-plus-install observations were nine to ten seconds;
the two warm observations were eleven to twelve seconds.
The corresponding Depot profile was three seconds without caching and four to five seconds warm.
These are the isolated pnpm-store profiles,
not a result for every job inheriting a cache step
([exact jobs, phases, original ZIP/member receipts](../audit/depot-pnpm-fresh-jobs-2026-10-18.evidence.json)).
Depot's checkout also changed between those phases,
so its whole-job decrease does not isolate pnpm caching.

The Kotlin linter plugin's repeated Gradle `test --rerun jar` comparison exercises six fresh JUnit cases per job.
Depot's generic HTTP remote task cache restores compilation outputs;
the tests still execute.
The two warm commands took 17.550 and 15.836 seconds,
versus 21.435 and 20.262 seconds with both remote and local task-output caching disabled.
The within-condition spreads were 1.714 and 1.172 seconds.
The observed mean reduction is about 19.9 percent for that command boundary,
which includes JVM startup,
compilation or restoration,
tests and JAR production.
Whole warm jobs took 162 and 177 seconds versus 146 and 153 seconds without task caching;
variable pnpm import/link time prevents a whole-job benefit claim
([unchanged-input controls and exact receipts](depot-reuse-strategy-research.md#repeated-gradle-task-output-comparison)).

The forbidden-strings release CLI's compiled-target archive also has a real fresh consumer:
all 237 owned Nextest cases passed in producer and reader.
The reader's CLI build took 0.070 seconds versus the seed's 52.228 seconds,
but archive extraction alone adds 0.334 seconds,
and the reader's full Nextest command took 45.200 seconds versus 39.233 seconds in the seed.
Those commands include 22.506 and 21.449 seconds of actual test execution respectively.
This single reader proves compatible target reuse;
it does not establish a job or provider speed multiplier
([target-archive controls](depot-reuse-strategy-research.md)).

Prepared dependencies,
Gradle remote task outputs,
sccache,
compiled artifacts,
BuildKit layers and Depot Disk have separate admission,
invalidation and consumer evidence in the
[reuse research](depot-reuse-strategy-research.md).
The finished allocation must choose these mechanisms per owner and retained consumer boundary.
It cannot treat a cache hit,
restored bytes or a shorter compile phase as a measured whole-CI speedup.

## Adoption conditions and unresolved evidence

Remaining factual work is explicitly owned in the
[execution handover](../handover/depot-trial-grilling.md):
desktop producer/runtime prerequisites,
proper packed-install consumers,
semantic feature/assertion reconciliation,
actual repository ARM evidence,
the final benchmark branch,
source-ledger reconciliation and combined cost/critical-path normalization.
Independent sufficiency review follows those results.
These are ongoing research tasks,
not deferred production acceptance tests.

After the evidence closes,
the interview can settle the desired required/advisory boundaries,
event cadence,
paid-priority allocation and treatment of retained source failures.
The recommendation must retain its source cohorts,
documented plan eligibility,
exact consumer limits and USD 200 monthly scope.
