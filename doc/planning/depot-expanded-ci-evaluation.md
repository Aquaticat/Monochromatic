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
The current-source inventory has 227 package roots,
including 211 active and sixteen inactive roots,
and 2,425 source-owned Mise tasks across 13,860 tracked paths.
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

The native-CI documentation review covers parallel shared-filesystem semantics,
retry state,
identity,
environments,
secret selection and automatic log-based AI summaries.
Not issuing an explicit paid model request does not mean the vendor performs no AI processing of job logs.
These documented behaviors remain separate from executed repository consumers
([substantive native capability review](depot-native-ci-capability-review.md)).

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
owns allocation-row normalization and the remaining whole-graph calculation.
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
Later research attempts require a deduplicated follow-on ledger;
admission reservations are not added as observed charges
([normalized baseline](depot-owned-allocation-ledger.md),
[independent exact arithmetic](../audit/depot-owned-allocation-independent-arithmetic-2026-10-18.evidence.json)).

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

Remaining factual work is explicitly owned in the
[execution handover](../handover/depot-trial-grilling.md):
current-source macOS and Windows owner controls,
semantic feature/assertion reconciliation,
source-ledger reconciliation,
repeated coherent Linux graph measurement and combined allocation/cost normalization.
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
