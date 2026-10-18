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

GitHub remains the forge and check consumer.
Native Depot is the proposed Linux orchestration pool;
Depot-managed GitHub runners retain GitHub scheduling for eligible Linux AMD64/ARM64 and Windows jobs.
GitHub scheduling also retains release permissions,
protected-environment approvals and reusable-workflow references that native compatibility does not cover.
Mac work stays on public GitHub under Developer.
The exercised ARM owners establish selected portability,
not every ARM workload
([native contracts](depot-native-ci-capability-review.md),
[actual ARM consumers](depot-arm64-workload-research.md)).

## Immutable workloads and scope

The expanded repository source is `e02be6c8b8fe9efb41a7f8f1a0b311c17796588a`.
Application source,
research harness revisions,
generated producers and consumer receipts retain separate identities in the
[coverage research record](depot-complete-coverage-research.md),
[Rust record](depot-rust-coverage-research.md)
and [runtime record](depot-runtime-orchestration-research.md).
Later main changes do not silently enter that cohort.

Documentation,
inspected source and runtime-qualified consumers are separate evidence levels.
Native filesystem snapshots,
ordinary OCI job/service images,
compiled target archives and SDK custom runtimes retain different formats and identities.
The SDK custom thin-image success does not qualify ordinary OCI or named runtimes;
planned SDK snapshot and secret APIs are not delivered-feature evidence
([platform ledger](depot-platform-surface-ledger.json),
[prepared filesystem and archive controls](depot-reuse-strategy-research.md)).

The original trial's four historical source cases and native follow-up cohorts retain their own manifests.
Their 770 primary gates are a historical inventory,
not the denominator of the expanded repository evaluation
([historical evaluation](../audit/tech-depot-complete-ci-trial-vet-2026-10-18.md)).
Counts of source files,
owning task invocations,
enumerated tests,
executed bodies and result-upload events remain separate.
The current-source tree has 223 package directories:
208 active,
13 paused and two archived.
The initial 227-candidate census included four documentation blobs;
the corrected directory count does not change task or execution counts.
It has 2,425 source-owned Mise tasks across 13,860 tracked paths.
Its source-language inventory includes JavaScript/TypeScript,
Kotlin,
Rust,
Slint and C/C++;
the absence of Go or Python owners is a measured scope result,
not a reason to install unrelated task systems
([source inventory and applicability controls](depot-complete-coverage-research.md)).
The platform source ledger now reconciles all 120 captured deployed documentation pages,
with source/hash-bound findings and explicit applicability limits.
This does not mean every public API method or documented example was runtime-exercised
([platform source ledger](depot-platform-surface-ledger.json)).

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

The packed-install profile activates the actual package manager and imports 25 installed runtime packages.
It separately compiles a positive and a rejecting TypeScript consumer for the type-only ownership-marker package.
Its unexpected runtime import of that type-only package is retained as a harness expectation error.
All five functional consumers pass,
including the actual mutation CLI's dry-run discovery of two mutants and its tests.
Discovery does not mean the mutants were executed
([packed consumer source and original receipts](depot-complete-coverage-research.md)).

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

The positive Truepeak search fixture completed the unchanged grid twice,
selected a winning candidate and emitted matching 24-row feature files of 8704 bytes.
That closes synthetic search and output emission;
it does not measure real audio collection or decoding
([benchmark boundary](depot-rust-coverage-research.md)).

The native ARM64 repository profile passed the same Truepeak all-features owner:
89 passes and two intentional skips,
with all 91 JUnit identity/status tuples matching AMD64.
The built `p-limit-fork` owner also passed the same eleven runtime describe groups.
This is source-bound functional portability evidence,
without repeated timings or a whole-repository ARM qualification
([ARM64 workload and original receipt](depot-arm64-workload-research.md)).

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

Desktop execution now covers the original wide session and all six remaining authored sessions,
using the real application and nested compositor.
The wide session reports 69 passing assertions and one authored modifier-repeat skip,
then a separate track-loading harness error.
The remaining structured session summaries report 41 passes and one dialog assertion failure,
with no skips.
The failing assertion is `Ctrl+Shift+O opens the system folder dialog`.
Repeated assertions across layouts and duplicated raw log lines are not unique case identities.
The continuation retains ninety PNG artifact identities,
with cleanup verifying no app/compositor processes,
units or container and restored audio state
([desktop sessions and original artifacts](depot-complete-coverage-research.md)).

### Execution infrastructure

Native orchestration needs explicit event and check ownership,
with content-bound artifact names and supported reusable-workflow references.
Native retries reuse filesystem/environment state,
and native parallel branches share mutable directories;
they do not create isolated repetitions.
The measured single-job graph does not qualify every native parallel-step merge rule.
Tests reporting should retain original JUnit and validated identity transformations,
use attempt-specific report keys and split only admitted runnable identities.
The 34-case Nextest adapter qualifies its demonstrated single-binary shape.
Full-framework reporting,
dashboard flakiness and GitHub/native analytics parity retain narrower evidence limits
([orchestration contracts](depot-native-ci-capability-review.md),
[physical report adapter](depot-tests-identity-adapter-research.md)).

Native Depot,
Depot-managed GitHub Actions and standard GitHub now each have a passing actual frozen `mvm` guest lifecycle.
The standard-GitHub replay preserves UID/GID and adds the actual device group only to the disposable child.
All three passing consumers verify guest stdout,
exit-two stderr,
a 51-byte shared-directory CLI roundtrip and private-domain/daemon cleanup
([all eight original archives and outcomes](../audit/depot-mvm-kvm-2026-10-18.evidence.json)).
That roundtrip did not separately assert guest payload visibility or a guest write.
An independent source review identified this test gap;
the follow-up now proves that boundary on all three pools.
Each guest verifies its own boot identity and exact 51-byte input,
creates an initially absent distinct output,
transforms it and returns the exact 57-byte result to the host.
All three retain private-domain and daemon cleanup
([new original archives and guest proofs](../audit/depot-mvm-guest-files-2026-10-18.evidence.json)).
The first follow-up GitHub dispatch remained queued because of a corrupted generated runner expression;
it is retained as a harness failure,
separately from the three actual consumers.
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
SPDX and SLSA subjects matched their runtime-manifest digests,
which are not necessarily the image-index digest;
the separate OCI archive's empty subject retained its own disposition.
The four-target Bake run exercised overlapping target work,
secret delivery and keyless SSH listing,
but did not perform an SSH signature or prove project-level autoscaling
([BuildKit primary receipt](../audit/depot-buildkit-platform-campaign-2026-10-18.evidence.json)).
Truepeak's image build and cache checks reported zero tests;
the separately executed 89-case owner supplies its test evidence.

Native jobs also completed actual BuildKit and registry consumers using only their injected job token.
The local-export correction `pxx75mxnw2` imports and executes the frozen queue source from its exported image.
The separate registry run `38z4wlq9d3` rejects anonymous and invented-token access,
then exchanges the injected token,
reads and rehashes the OCI graph and executes the extracted frozen-source consumer.
The original `dzsf27t0xx` run reached the builder but failed because the fixture mixed incompatible exporters.
The temporary image and solely owned project were deleted;
the exact manifest changed from HTTP 200 to 404 and the project query returned `not_found`.
Those are logical cleanup observations,
not physical-erasure or invoice claims
([native authentication receipt and original ZIPs](../audit/depot-native-buildkit-job-auth-2026-10-18.evidence.json)).

The custom-runtime SDK campaign created and stopped three isolated VMs.
Its final consumer used the absolute required Git executable,
read a bounded manifest and completed a nonce write/read/delete cycle.
The earlier Node-path failure and operation with an unresolved read timeout remain separate failed probes.
The command-log query's empty response does not prove complete absence of execution logs.
Fresh terminal VM reads prove the observed stop state,
without establishing a billing-release instant
([SDK and platform evidence](depot-platform-surface-audit.md)).

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

The built-in Semgrep 1.34.1 scan missed the controlled missing-`USER` case,
and its `CMD $...VARS` pattern did not match the exercised JSON-form `CMD`.
The same retained rule bytes executed by Semgrep 1.181.0 detected both,
while the Hadolint root/non-root controls behaved as expected.
This qualifies the replacement scan execution;
it does not establish a repaired Depot built-in scanner
([scanner and rule-source evidence](depot-platform-surface-audit.md)).

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

The Linux static campaign ran 465 owning commands,
with 418 passing and 47 failing;
these are task outcomes rather than assertion counts.
The default Node owner campaign reports 126 passing commands and one failing unused-export owner.
The bounded property profile reports 64 passing cases and five retained counterexamples.
The separate mutation profile records eleven killed mutants,
six surviving mutants and two compile-error outcomes.
The complete semantic assertion manifest remains a separate reconciliation gate
([command dispositions and retained counterexamples](depot-complete-coverage-research.md)).

The first repeated-graph dispatch `39135886118` failed tool setup in all four jobs,
before any of its planned 222 owner commands ran.
It omitted the configured `cargo-binstall` prerequisite.
The corrected driver also closes staged-source mutation and resistant descendant cleanup gaps found by
independent preflight.
Its twelve local controls pass on exact source `234ccc92dabb81e998e0a0bb5e838713924dd83f`;
those stub controls earn no application execution credit
([setup failure](../audit/depot-expanded-graph-setup-failure-2026-10-18.evidence.json),
[independent source and cancellation controls](../audit/depot-expanded-graph-preflight-2026-10-18.evidence.json)).

The first native graph repetitions complete their shared-build and Rust owners,
but browser preparation reaches the documented `newuidmap` primary-group rejection.
The isolated correction routes native Podman probes,
builds and runs through the previously verified noninteractive rootful boundary.
It preserves the absolute executable,
application inputs,
command plan and container resource limits.
Both real corrected native repetitions pass preparation,
Chromium and Firefox owner tasks;
WebKit still reaches the source OPFS verification assertion,
and root E2E discovers the unresolved paused-owner dependency before any test executes.
All 222 command logs are retained per corrected sample,
without command-budget termination or unstarted work.
Passing setup does not convert these source gates into a passing pipeline
([original and corrected native consumers](../audit/depot-expanded-graph-native-correction-2026-10-18.evidence.json)).

The independent review of all eight original graph samples verifies 1720 retained command-log hashes.
It separates strict lint warnings,
property counterexamples,
WireGuard diagnostic expectations,
logger Promise/JSON assertions and intermittent watch waits.
The watch assertion fails in three samples across multiple provider contexts;
the samples do not establish a provider-specific failure rate or cause.
WireGuard's HTTP 500,
`IPINFO_TOKEN` and `ENOTFOUND` lines belong passing injected negative fixtures,
so those lines do not establish provider network failures.
Reached WebKit reports retain 26 expected cases,
one skip and one unexpected OPFS assertion;
root E2E discovery reports contain zero executed cases
([source and exact reporter classifications](depot-expanded-graph-independent-review.md)).

Two public GitHub WebKit logs contain `npm notice` text interleaved with reporter JSON.
The research collector merges command stdout and stderr into one file.
The reviewer retains original hashes and explicitly derived views that remove only those identified notice lines.
Those views support assertion classification;
they do not qualify a strict machine consumer of the original mixed streams.
The observation does not establish invalid JSON on Playwright's own stdout
([collector source and derived-view boundary](depot-expanded-graph-independent-review.md)).

The native-CI documentation review covers parallel shared-filesystem semantics,
retry state,
identity,
environments,
secret selection and automatic log-based AI summaries.
Not issuing an explicit paid model request does not mean the vendor performs no AI processing of job logs.
These documented behaviors remain separate from executed repository consumers
([substantive native capability review](depot-native-ci-capability-review.md)).

Native live/paused-step SSH,
per-job logs and resource metrics are separately documented debugging capabilities.
Their operational admission must retain exact attempt identity and private connection details.
Developer community support,
beta terms and the incomplete incident-history denominator provide no repository availability guarantee.
The proposal retains exact-attempt diagnostics and GitHub execution as a fallback;
both products still depend on their configured forge and identity paths
([operating terms and status boundaries](depot-platform-surface-audit.md)).

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
The [current GHA troubleshooting guide](https://depot.dev/docs/github-actions/troubleshooting)
documents a separate GitHub Actions minute limit,
while container builds have their own usage control.
Those published controls are not a demonstrated combined USD 200 limit across native CI,
storage,
Tests,
SDK and other products.
Configured account limits and their live effects were not inspected.
The [container-build overview](https://depot.dev/docs/container-builds/overview)
also describes cache-size policy as soft because required parent layers can be retained.
A 25 GB project cache policy is therefore not a strict storage spending cap.

The [combined pricing model](../audit/depot-combined-product-pricing-2026-10-18.evidence.json)
prices independent named product entitlements,
combined storage and passing results.
Its scenario inputs are hypothetical monthly quantities,
not observed future event rates.
The [cost/critical-path work record](depot-expanded-ci-cost-model.md)
owns allocation-row normalization and the observed dependency-path calculation.
Standard GitHub public-repository compute remains a zero-compute-cost option;
artifact/storage rules are separate
([GitHub billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)).

The frozen owned-allocation baseline contains 223 distinct records.
Independent coordinator checks rehash all 411 retained source bodies and exactly recompute all 195 priced intervals:
native CI USD 4.8546,
Depot GitHub runners USD 1.3372 and SDK intervals USD 0.0081959,
with public GitHub compute zero.
Their known partial nominal subtotal is USD 6.1999959 before allowances.
BuildKit's USD 0.538584 request-window proxy remains separate from unknown allocated-builder compute.
Admission reservations are not added as observed charges
([normalized baseline](depot-owned-allocation-ledger.md),
[independent exact arithmetic](../audit/depot-owned-allocation-independent-arithmetic-2026-10-18.evidence.json)).

The independently checked follow-on snapshot adds 30 distinct terminal allocation rows,
with no baseline duplicates and 35 rehashed source bodies.
Its nominal provider-window proxy is USD 0.6041:
Depot GitHub USD 0.1797 and native CI USD 0.4244,
with public GitHub compute zero.
The desktop row uses its exact 263-second failed attempt,
not the superseded 279-second run envelope.
The separate BuildKit request-window proxy is USD 0.015897333333;
actual allocated-builder billing remains unknown.
Later OS,
owner and debug controls are excluded from this frozen snapshot until separately normalized
([follow-on ledger](depot-owned-allocation-follow-on.md),
[independent frozen source and arithmetic](../audit/depot-owned-allocation-follow-on-independent-2026-10-18.evidence.json)).

The current-source four-CPU Linux comparison has two completed repetitions on each GitHub runner pool.
All 42 shared Node build commands pass in every sample.
GitHub takes 206.729 and 213.691 seconds;
Depot's GitHub runners take 73.986 and 72.591 seconds.
The means are 210.210 and 73.2885 seconds,
with observed spreads of 6.962 and 1.395 seconds.
The ratio of means is 2.87.
The two Rust owner commands average 720.5195 seconds on GitHub versus 325.8625 seconds on Depot,
a 2.21 ratio,
with observed spreads of 10.631 and 28.513 seconds.
Both original Rust command logs contain the same 89 Truepeak and 237 forbidden-strings passing identities
in every sample;
the Truepeak summary also records two skips.
These compare complete owner programs,
including Rust compilation and test execution,
under observed four-CPU,
approximately 16 GB Linux x64 allocations
([original samples, sources and exact arithmetic](../audit/depot-expanded-graph-github-repetition-2026-10-18.evidence.json)).

Neither ratio describes complete CI.
Each public GitHub repetition leaves 28 commands unstarted and terminates six commands at their budgets,
while both Depot GitHub repetitions retain all 222 scheduled command logs.
Property-test seeds also differ across repetitions.
The graph is one job with parallel dependency branches,
not a distributed artifact pipeline or every repository owner.
It restores no explicit package/compiler cache and uses a fresh Cargo target;
provider image,
tool and registry caches are not assumed empty.
The ranges are observed spreads from two repetitions,
not statistical confidence intervals
([source-bound limits](../audit/depot-expanded-graph-github-repetition-2026-10-18.evidence.json)).

Corrected native Depot repeats the same completed shared-build commands in 62.589 and 62.011 seconds,
with a 0.578-second observed spread.
Its 62.300-second mean gives a 3.37 ratio against GitHub's shared-build mean.
The native Rust commands take 322.278 and 331.160 seconds,
with an 8.882-second observed spread;
their 326.719-second mean gives a 2.21 ratio against GitHub.
Native uses the explicit rootful Podman prerequisite adapter and retains separate source/test failures,
so these also remain completed-phase comparisons
([source and original artifact joins](../audit/depot-expanded-graph-native-correction-2026-10-18.evidence.json)).

Independent native parity checks match the same 89 Truepeak and 237 forbidden-strings passing identities
against the GitHub reference,
including changed-case and changed-status negative controls
([original-log parity](../audit/depot-expanded-graph-native-parity-review-2026-10-18.evidence.json)).
The observed longest dependency path runs from shared builds into a Node consumer branch in all six profiles;
the independent Rust branch is shorter.
The model therefore does not add overlapping Rust and Node time reductions as human waiting savings
([source-bound path arithmetic](../audit/depot-expanded-graph-critical-path-2026-10-18.evidence.json)).

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
The complete integration review also separates applicable Gradle/Rust mechanisms from unused Bazel,
Go,
Maven,
Moon,
Nx,
Pants,
Turbo and Xcode owners.
Depot's Actions cache guide explicitly documents no branch isolation;
the actual six-job probe confirms sibling-branch read reuse on Depot and a sibling miss on GitHub,
after both same-branch positive controls.
This is qualified to the observed defaults and nondefault sibling seed,
not every access-mode or fork/PR write scenario
([cache applicability and trust review](depot-cache-capability-review.md)).

## Adoption conditions and unresolved evidence

### Proposed workflow allocation

Use the native Linux pool for admitted Node static/unit/process owners,
Rust Nextest owners,
bounded property/conformance/mutation profiles and compatible browser/container consumers.
Build shared producers once and validate their real consumers.
Keep GitHub permission and approval boundaries on GitHub scheduling,
with Depot runners available where their tested OS,
resource shape and plan eligibility fit.
The final required/advisory split and event cadence remain interview decisions;
the retained source failures prevent treating every researched owner as a passing required gate
([owner results](depot-complete-coverage-research.md),
[Rust execution contexts](depot-rust-coverage-research.md)).

Allocate reuse by measured owner:
Gradle remote task outputs for the demonstrated Kotlin linter,
direct sccache for qualified Rust compiler consumers,
and source/tool/ABI-bound dependency or target archives with passing readers.
The Kotlin owner join independently matches all six authored JVM methods to four original passing JUnit reports
and the exact frozen package subtree;
it closes a missing evidence projection without another allocation
([source/task/case join](../audit/depot-kotlin-gradle-owner-join-2026-10-18.evidence.json)).
The measured pnpm content-store profiles do not justify universal store caching.
Native tool snapshots require current checkout and executable/PATH admission.
Organization-global Disk mounts need a single writer,
partitioning or immutable content;
concurrent mounts do not provide atomic mutation.
An expected digest supplied by the same mutable untrusted cache does not independently authenticate its contents
([reuse controls](depot-reuse-strategy-research.md),
[cache capabilities and trust](depot-cache-capability-review.md)).

Use BuildKit/Bake for admitted container contexts and immutable multiarchitecture CI/service producers,
preserving the exercised SBOM/provenance-to-runtime-digest checks.
A matching attestation subject does not establish signing trust.
Autoscaling has no demonstrated total-builder bound in this evaluation;
keep it outside automatic paid admission until that bound is supplied.
Registry pull-through,
Fast CDN and server-side promotion are reviewed options with no measured speedup here.
Tagged retention is opt-in,
saved project images default to unlimited retention,
and logical deletion can precede blob reclamation.
Standard transfer is documented free;
Fast transfer costs USD 0.10/GB
([executed BuildKit graph](../audit/depot-buildkit-platform-campaign-2026-10-18.evidence.json),
[registry lifecycle sources](depot-platform-surface-audit.md)).
Credentialed Containerfiles also need their own context and cleanup controls:
the synthetic Git rewrite probe retained its invented-token key,
without supplying a real credential or proving exported-layer retention
([source-owned cleanup boundary](../troubleshooting/git-url-rewrite-cleanup-key.md)).

### Trust, budget and optional products

Trusted branches and untrusted PRs need explicit cache-write and secret authority.
Depot Actions cache,
project BuildKit cache and organization-global Disk have different scopes.
Linux egress filtering is root-modifiable and incompatible with Tailscale;
it is not a hostile-root exfiltration boundary or a Windows/Mac policy.
Private connectivity needs its documented credentials and eligibility.
Dependabot has a separate runner setting and lacks ordinary GitHub OIDC,
so its authentication cannot inherit the regular-job assumption.
No network policy,
tailnet credential or Dependabot secret was activated
([cache trust](depot-cache-capability-review.md),
[network and bot source review](depot-platform-surface-ledger.json)).

Paid scheduling needs finite workload reservations and separately priced storage,
Tests,
SDK and optional-product quantities.
The research excludes account-wide usage and invoice inspection,
so it cannot verify an aggregate USD 200 invoice guarantee.
Production admission needs current authorized headroom and expiry,
with public GitHub compute available when paid headroom is unknown.
Retention and deletion must name exported artifacts,
registry manifests/blobs,
snapshots,
Disk and logs separately
([allowances and limits](depot-included-allowance-reconciliation.md),
[actual logical registry cleanup](depot-native-buildkit-auth-research.md)).

Managed/customer-AWS,
GPU and custom GitHub runner images need their separate eligibility and administrative delegation.
Code is a public-beta Git transport/mirror with push-only native events;
it has no demonstrated independent GitHub recovery path here.
Depot Agents describes Claude Code,
Anthropic authentication and separately billed agent minutes without included usage.
The repository's Codex fixture does not qualify that product.
The Dagger engine integration is deprecated and adds a distinct engine charge.
These reviewed adjacent products remain unactivated,
as do absent-owner cache/language recipes and external observability sinks
([optional-product boundaries](depot-platform-surface-audit.md),
[current Dagger guide](https://depot.dev/docs/github-actions/integrations/dagger)).

### Remaining research and interview boundary

Remaining factual work is explicitly owned in the
[execution handover](../handover/depot-trial-grilling.md):
current-source macOS and Windows owner controls,
semantic feature/assertion reconciliation,
existing-evidence joins and admitted execution of remaining IDE/file-manager/terminal/design owners,
the finite native debug consumer,
prepared-image absence controls and final combined allocation/cost normalization.
The capability-allocation source review is complete;
the concrete rollout profiles still need exact owner commands,
producer prerequisites,
evidence joins and source-failure dispositions before the interview.
All 120 captured documentation pages now have substantive applicability findings in the source ledger.
The repeated GitHub and corrected native graph phases,
case parity and independent failure classifications are sealed;
their failed full-graph outcomes remain qualified rather than converted into an overall speed claim.
The desktop,
packed-install and native automatic BuildKit/registry consumer queues are complete with the qualifications in
Gate and artifact-consumer results.
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
