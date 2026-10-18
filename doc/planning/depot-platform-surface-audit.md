# Depot platform surface audit

## Status and correction

Research reopened on 2026-10-18 after the user rejected the completeness of the previous investigation.
The previous claim that only the pnpm comparison remained before interviewing was incomplete and is withdrawn.
The three proposed interview questions are also withdrawn.
No preference question or production adoption follows from this document.

This audit begins with explicit surface enumeration:
deployed documentation indexes and sitemap,
installed CLI command tree,
public API and SDK schemas,
official integration repositories,
release history,
and operational and security commitments.
Each discovered surface needs an applicability and evidence entry;
fetching a page is not equivalent to resolving its implications or exercising the feature.

## Scope and source identity

Repository applicability uses frozen source `e02be6c8b8fe9efb41a7f8f1a0b311c17796588a`.
The audit includes expanded CI needs beyond current workflows.
The Developer baseline and complementary GitHub capacity remain settled.
Account-wide usage,
invoices,
settings,
subscription changes,
broad credentials,
Code mirroring,
paid external models,
and production routing changes remain excluded.

Any additional cloud probe must have a concrete question,
immutable source,
resource bounds,
run identity,
consumer assertions,
and a cleanup plan before execution.
Retain the actual terminal and cleanup results after execution.
Existing receipts remain evidence only for their recorded source and exercised behavior.

## Enumerated primary surfaces

The deployed [LLM index][llms] contains 120 documentation entries,
257 changelog entries,
229 blog entries,
26 resources,
and 10 customer stories.
The independently retrieved [sitemap][sitemap] contains 690 URLs.
All indexed documentation pages were retrieved as current Markdown and checked for Markdown content,
rather than accepting HTTP success alone.
The [full documentation bundle][bundle] is 931,767 bytes.

The [surface ledger](depot-platform-surface-ledger.json)
records each documentation entry,
CLI help invocation,
official repository,
release entry,
and context-index entry.
The [compressed source receipt](../audit/depot-platform-surface-sources-2026-10-18.evidence.json.gz)
retains exact public responses and pinned integration source.
Its first checkpoint contained 295 source files from 28 official repositories.
The expanded checkpoint contains 542 source files from those repositories,
including the complete installed CLI implementation and additional SDK and integration source.
Retrieval state and substantive review state are separate fields.

A further source pass captures metadata for all 93 enumerated official repositories
and 142 additional root README,
license,
policy,
and dependency-manifest files.
The public `depot/docs` repository at `e40bfe1683ae561156d415513f2a648f89e82f12` contains 117 MDX pages.
Every public-source route matched a deployed page.
The deployed GitHub Actions API,
Nx Cache,
and Xcode Cache pages are absent from that public source tree.
The compressed receipt preserves this route map and the exact public MDX source.
Claim-level content differences and supplementary implementation relevance remain under review.

The installed CLI is audited against release `v2.102.23`,
source commit `1f96d6d488f938de97ea640b115e9567ebfd6fbf`.
Visible help traversal initially missed a single-space command column;
the `configure-docker` control exposed that parser defect and the inventory was corrected.
Source inspection then exposed hidden root commands and manually dispatched Claude subcommands.
The expanded inventory contains 92 help invocations,
including the failed Cargo-wrapper help invocation described in the source gaps.

No count establishes exhaustive understanding by itself.
The source and integration reconciliation remains active.

## GitHub runner KVM documentation contradiction

The current [GitHub runner troubleshooting page][gha-troubleshooting] says
"Depot GitHub Actions runners don't currently provide `/dev/kvm`".
The current runner probe contradicts that blanket restriction.
[Run 39104064329][kvm-run],
Depot job `117606073359`,
observed `/dev/kvm` as a readable and writable character device on `depot-ubuntu-24.04`.
The `/dev/null` positive control passed and the deliberately nonexistent device failed with `ENOENT`.
The standard GitHub job in the same workflow found `/dev/kvm` but could not access it,
reporting `EACCES`.
Neither observation establishes that a guest booted.

The [independently checked evidence][kvm-evidence] binds these observations to frozen repository source
`e02be6c8b8fe9efb41a7f8f1a0b311c17796588a`
and harness `15ee06968996212b97111accc2013c2780ed1944`.
Both downloaded archive digests matched the GitHub API digests;
both extracted member hashes and embedded observations also matched.
The conflicting deployed page was fetched again during this verification.

The [2026-07-07 Metal announcement][metal-launch] described future migration of GitHub runners.
It cannot establish their placement in October.
The [2026-09-16 load-testing account][metal-gha-rollout] explicitly describes
"moving more GitHub Actions jobs onto Depot Metal"
and says traffic was subsequently moved.
That source establishes a rollout chronology,
not complete migration of every label,
KVM guest success,
or a capacity guarantee.
Its load test deliberately stopped before allocating real workload machines.
The [2026-09-22 autoscaler account][metal-autoscaler] also describes capacity headroom,
availability-zone constraints,
and compute/storage pools rather than a queue-free service guarantee.

Generic SDK sandboxes,
standalone CI,
GitHub runner labels,
and native Windows/macOS remain separate products and execution cases.
The generic SDK's retained missing-device observation does not override this GitHub runner result.
The separate KVM initialization and actual guest consumer probes remain active work.

## Newly exposed orchestration semantics

### Local changes and reusable workflows

[Run management][manage-runs] documents local patch upload and injection after checkout.
A job that calls a reusable workflow has no steps where the CLI can inject that patch:
it runs merge-base code without local changes and emits a warning.
The existing smoke tests of `depot ci run` do not qualify that path for an agent's uncommitted current-source request.
The next orchestration probe must bind caller,
called workflow,
checkout source,
patch contents,
and consumed output identities.

Native downstream dispatch is another distinct boundary.
The built-in job `DEPOT_TOKEN` cannot start another workflow,
and the job's OIDC token cannot directly authorize dispatch.
The documented route needs a user or organization token.
No new token or dispatch secret is created by this audit.

### Retries and parallel execution

[Native step retries][retry] apply to `run:` steps,
retry every nonzero exit without an exit-code filter,
and reuse the same sandbox.
Filesystem effects and environment files accumulate.
A step's timeout applies separately to each attempt;
the job timeout still terminates the retry loop.
`retries: N` permits `N + 1` total executions.
This differs from a fresh-job retry or a classified infrastructure-only retry.

[Parallel steps][parallel] take isolated snapshots of step environment,
outputs,
and path state,
but share the workspace,
home directory,
and tool cache.
Default failure handling cancels siblings.
`fail-fast: false` collects remaining failures;
`continue-on-error` can instead absorb a failure.
Repository tasks that format files or modify shared build directories cannot be assumed safe in such a block.
Actual state-merge and cancellation probes remain research work.

### Native event and check chronology

The [2026-08-19 change][pr-continuation] says native pull-request runs continue after new commits by default.
Supersession needs an explicit concurrency group with `cancel-in-progress: true`.
The earlier GitHub worker cancellation probe did not exercise native event supersession.

The [2026-08-21 duplicate-run fix][duplicate-checks]
preserves successful checks when another duplicate run is cancelled.
The [2026-09-23 check change][check-names]
gives explicitly named matrix combinations distinct check identities.
The [rerun correction][reruns]
reruns successful dependent jobs when upstream retry results change.
These are claims about separate event and attempt paths,
not evidence that this repository has exercised them.

The [compatibility reference][compatibility] also exposes separate limits:

- Non-Depot runner labels become `depot-ubuntu-latest`.
  Copying a job labeled `windows-latest` does not establish native Windows execution.
- Fork pull-request support remains planned.
- Release,
  check-run,
  check-suite,
  status,
  and issue events other than comments are unsupported.
- Scheduled workflows run from the default branch in UTC,
  ignore the entry's timezone,
  and have no official start-time guarantee.
- Environment-scoped secret lookup does not establish GitHub environment approval protection.
- Native `GITHUB_TOKEN` is a GitHub App token and is documented unsuitable for GitHub Packages authentication.

## API and SDK completeness boundaries

### Generated CI reference differs from Markdown pages

The sitemap includes [the CI API reference][ci-api],
which the LLM documentation index omits.
The original HTML endpoint works and identifies its generated schema.
Appending `.md` redirects to the general documentation overview with HTTP 200.
That response is not CI API documentation.

The current [CI OpenAPI schema][ci-openapi] exposes 45 methods and 152 component schemas.
The [GitHub Actions schema][gha-openapi] exposes 18 methods and 65 component schemas.
Pinned CLI and public-proto sources also contain legacy versions and additional service families.
These surfaces need method-level reconciliation;
a bundled client declaration does not establish a current public endpoint guarantee.

### Telemetry and termination need precise scopes

The [GitHub Actions API guide][gha-api] documents organization-token authentication.
Job analytics default to 30 days and allow windows up to 90 days;
log queries default to one hour and allow windows up to 30 days.
Pagination tokens bind the organization and original filters.
Telemetry can lag;
`dataThrough` reports its coverage boundary.

Utilization and runner recommendations aggregate whole UTC days even for a sub-day query.
Their threshold comparison rounds percentages and has no minimum sample count.
Duration and failure counts use the requested interval instead.
These recommendations cannot replace unchanged-input workload measurement.

`TerminateGithubActionsJob` requests termination of Depot compute.
It does not cancel the GitHub workflow.
A requested termination,
an observed terminal job,
and stopped billing remain distinct facts.
No excluded account-wide analytics method is invoked here.

## Registry lifecycle and export surface

[Registry v2][registry] supports arbitrary OCI artifacts,
organization subdomains,
project-saved builds,
and direct server-to-server image copying with `depot push`.
The [quickstart][registry-quickstart] documents repository creation on first push,
wildcard-scoped registry access tokens,
and the distinction between those tokens and one-hour project pull tokens.
The latter only cover project repository paths.

Standard transfer is documented free;
Fast CDN transfer costs USD 0.10 per GB without an included allowance.
Registry storage shares the plan's storage allowance with caches.
Artifacts can be as large as 50 GB.
These are documented capabilities,
not measurements of this repository's images or transfers.

Tagged retention is opt-in.
Image age is measured from push time rather than last pull;
project-saved images have their own retention setting and default to unlimited.
Manifest deletion can precede physical blob reclamation by up to 31 hours.
Deleting a shared-layer tag does not prove equivalent storage reduction.

[Pull-through caching][pull-through] has further consequences:

- Upstream credentials are organization-level configuration.
  They are not created or inspected in this audit.
- Pull-through mapping can only be chosen when creating the repository.
- A cached mutable tag is not revalidated against upstream on pull.
- Unreferenced cached blobs can become eligible for reclamation after six idle hours.
- Cached content therefore does not guarantee operation through an upstream outage.

Public registry schemas expose deletion,
retention,
token,
upstream,
and manifest-detail operations.
Their authorization and cleanup behavior still need an isolated artifact proof
before relying on those operations for resource reclamation.
No broad registry token,
mirror,
or policy change follows from source discovery.

## Security and operational commitments under review

The current [security documentation][security] distinguishes project builder caches,
repository-scoped Actions caches,
organization roles,
encrypted CI secrets,
and ephemeral GitHub runner instances.
Build permission also gives effective access to a project's builder and cache contents.
That trust boundary affects shared dependency and compiler caches.

[AI documentation][ai] says failed CI attempts receive model-generated summaries from already masked logs.
Sherlock can inspect broader authenticated settings and usage when used in the dashboard.
No authenticated Sherlock session is opened for this audit,
and no account-access restriction is bypassed through an assistant.

The [terms][terms] are effective 2025-06-27.
They distinguish general service terms from beta previews,
permit beta behavior changes,
state API abuse restrictions without a fixed numerical request budget,
and provide no general uptime warranty.
Cancellation requires contacting support;
ordinary deletion of account content can take up to 90 days,
with encrypted-backup and legal-retention exceptions.
Those statements do not substitute for per-product artifact retention or immediate erasure proof.

The [public status service][status] and its machine-readable incident feed were retrieved.
Recent records include CI start failures,
sandbox dispatch problems,
queue delays,
and US/EU build disk-I/O incidents.
Status chronology,
pagination behavior,
component identities,
and published uptime denominators remain under audit.
No availability percentage is inferred from an incomplete incident count.

## Owned BuildKit campaign and exporter boundaries

The [BuildKit checkpoint receipt](../audit/depot-buildkit-platform-campaign-2026-10-18.evidence.json)
binds the isolated project,
immutable fixture source,
native build results,
registry content,
and actual consumers.
The new service fixture supplies no repository performance comparison.

Reading the historical project with the existing user login was rejected:
`This endpoint requires an organization token, but a user token was provided`.
No organization token was created.
The separately authorized research project `27m5m3vjlv` was created with explicit `HARDWARE_16X32`,
five-minute build timeout,
`cachePolicy.keepGb=25`,
one-day cache retention,
and no autoscaling request.
The create response reports 26,843,545,600 retained-cache bytes for that field value.
The public schema rejects a `keepGb` value smaller than 25.
The create response proves these initial bounds without account-wide inspection.

Request `7wjrw9szj0` failed with `multiple outputs currently unsupported`.
Installed CLI source appends an image exporter for `--save`,
then rejects an exporter list containing multiple entries.
The [exporter troubleshooting record](../troubleshooting/depot-buildkit-exporters.md)
contains the deciding source and verified single-export workaround.

Two subsequent fixture failures remain separate evidence:
`xj1l6kmvbg` rejected an uppercase unresolved named-context reference,
and `xm26rbm5kt` reached Node 24.22.0 on both architectures but rejected malformed generated TypeScript.
The generator had placed a literal newline inside a JavaScript quoted string.
The previous local serialization repair was wrong and is withdrawn.
The corrected harness JSON-decodes every exec-form Node program,
checks its TypeScript and JavaScript syntax with a deliberately invalid control,
then runs the actual service under the pinned Node image before another remote build.

The pinned local service returned `/health` 200,
`/nonce` 200,
and a missing-path control 404.
Responses matched the runtime nonce,
frozen repository source,
harness commit,
and Node 24.22.0.
The container had two CPUs,
512 MiB memory,
64 processes,
no network,
and no host bind mounts.
Controlled server closure and container removal passed.

Single-export save build `fxzj58r8m2` then passed in 28.003 seconds at fixture source
`5cfc1d90f92154cf62fa95789fad9bd7deeda208`.
The exact registry index digest is
`sha256:4f2c182b14f816dfe9ab08f531a8d49378b5f76767b8f56f7c9154f05d0ff3e7`.
Independent registry reads verified the index,
its `linux/amd64` and `linux/arm64` child manifests,
their configuration hashes,
and their gzip layer media types.
SPDX and SLSA v0.2 in-toto statement subjects match the corresponding runtime-manifest digests.
Signature verification and policy enforcement remain separate surfaces.

The image-list API returns full registry references in its `tag` field.
The post-build harness initially compared that field to a bare tag and failed.
A scoped read reconciled the already successful build.
The service was not rebuilt to repair that assertion.
The CLI's intermediate `containerimage.descriptor.digest` also differs from its final
`containerimage.digest` for this multi-platform result.
The final digest was independently checked against actual registry bytes.

Anonymous manifest access returned 401.
The temporary pull token used the observed Basic authentication challenge and successfully read the image.
Cross-origin signed blob redirects were followed without forwarding the Authorization header.
The token value is excluded from committed evidence.
The CLI reference describes a build-ID form while the registry overview describes project-path read access.
The token's successful read of the subsequently created CI image establishes cross-build project access.
Cross-project isolation remains unexercised.

Podman 5.8.7 pulled the immutable remote image and ran its unmodified entrypoint and command.
The health,
nonce,
and missing-path HTTP assertions passed,
and controlled stop exited zero.
However,
`podman healthcheck run` returned 125 with `has no defined healthcheck`,
even though the raw OCI configuration contains the Docker `Healthcheck` extension.
The aggregate consumer remains failed.
The [pinned Podman source diagnosis](../troubleshooting/podman-oci-healthchecks.md)
now explains the omitted metadata;
the parent-run Docker consumer honored the same original image's check.

The expired initial eight-minute wall-clock window is retained.
The authorized recovery used a fresh five-minute request guard,
the same builder sizes,
and the same USD 1 timestamp-compute ceiling.
That model is not proof of an invoice cap or aggregate account expenditure.
The shared images and project remain held for independent native CI and GitHub consumers.

Build `d0xtstnptt` exercised a multi-node local filesystem exporter with the base stage forced to execute.
The exported x64 identity reports 16 CPUs,
32,997,220,352 memory bytes,
and AMD EPYC 9R45.
The ARM identity reports 16 CPUs,
33,020,604,416 memory bytes,
and Neoverse-V2.
Both report Node 24.22.0 and the exact committed harness and frozen repository source.
This is actual builder geometry and local-export evidence.

Build `31w6c0wlvk` produced a native single-architecture OCI archive without `--save`.
Skopeo separately copied the saved multi-architecture registry image into an OCI archive with all digests preserved.
Archive consumers verified every reachable blob's size and digest,
the runtime program,
the healthcheck configuration,
and platform identities.
Native OCI statements contain empty `subject` arrays;
their descriptor annotations associate the attestation manifest with the AMD64 runtime digest.
The registry-derived archive retains SPDX and provenance statements whose subjects match both runtime digests.
These representations are not equivalent for consumers that require in-toto subject fields.
The deciding exporter source and consequences remain under research.

## Derived CI image consumer control

A separate campaign built an ordinary OCI job image from the exact owned service index.
The original service image stays unchanged and retained for active consumers.
Parent-run GitHub job `117622633314` in workflow run `39109462308` retained the service's healthcheck,
reached healthy state,
then encountered checkout's GitHub REST download fallback because the job image lacked Git.
The job reached its five-minute guard during archive-download retries.
This differs from the local Podman healthcheck loss and does not establish a shared runtime limitation.

Derived build `6hb1g0j21b` passed with AMD64 and ARM64 outputs at source
`0b471538cd549cb2181088803c1e0a6d542d791e`.
Its distinct immutable index digest is
`sha256:aab45816f04afec0aed6ccd0daea92e6288a4a35c65368438678bad30b57f346`.
Actual local build and runtime Git controls passed before remote allocation.
The derived image adds Git 2.39.5,
curl 7.88.1,
CA certificates,
GNU tar 1.34,
gzip 1.12,
xz 5.4.1,
and zstd 1.5.4.
Git meets checkout's minimum;
Git-policy tests still require their separate Git 2.56 toolchain.
Both derived configurations use `CMD ["bash"]` and have no active service healthcheck.
`/opt/depot-research/image-tools.json` records each platform's actual tools,
Debian package versions,
immutable base,
and derived source identity.
The audited action inputs are `jdx/mise-action@c2a87611a18de5b3828c5652fe268e992400cb5c`,
Mise `2026.10.9`,
`install: false`,
and `cache: false`.
Checkout is pinned to `de0fac2e4500dabe0009e67214ff5f5447ce83dd`.
The consumer harness source is `1438ecde4b643a606e0a75f85067e3d0153e9bb5`.
The local control caught the original service's inherited `BUILD_HARNESS_SHA` environment value
overriding a derived argument with the same name.
The corrected fixture uses a distinct `CI_IMAGE_HARNESS_SHA` argument to identify the derived build.
The original service's environment remains inherited and separately identified.

Independent registry reads verified both derived configurations and their SPDX/provenance subject bindings.
The token issued for original build `fxzj58r8m2` before the derived build existed
successfully read the derived index,
configurations,
attestations,
and final filesystem layers.
This proves cross-build read access inside the same project;
cross-project isolation remains unexercised.
After positive authenticated reads,
an owned empty blob-upload initiation returned HTTP 403 with registry error `DENIED`.
No upload was created.

The next action is the independent GitHub and native CI job-container consumer,
while forwarding,
remote source,
and firstparty cache-mount campaigns continue.
The timestamp-compute model covers 139,103 milliseconds across native requests,
giving USD 0.1854707 at the declared two-builder rate.
This is a request-window estimate,
not billed usage or an aggregate invoice guarantee.
No account-wide billing or usage query is authorized or required by this campaign.

## Repository Node26 image prerequisite correction

The subsequent cloud job-image consumers reached checkout,
then the frozen Node `26.12.0` loader failed with a missing `libatomic.so.1`.
The base Node `24.22.0` check did not exercise the repository's different runtime.
The failed CI image remains retained.
A further owned derivative adds Debian `libatomic1`
and executes both exact architecture archives from the frozen root `mise.lock` during its build.
The archive hashes,
ELF machine identifiers,
dynamic-library resolution,
TypeScript execution,
and runtime versions must pass before that derivative receives consumer credit.
The second Node installation is removed within the same build step.

The isolated source `7590bcde15e5ceef4dc36f4e2c3d975e1c1b833f` contains the executed correction.
Build `1ng4qs1pmq` completed in 31,529 milliseconds and produced immutable index
`sha256:853b99050d5420698a02d7cb10978be8824dc0999c9ace08ec453706da54ec31`.
The actual Node `26.12.0` module executed on both AMD64 and Arm64 builders
after SHA256 verification against the frozen lock.
The probes exercised TypeScript,
crypto,
and top-level `await`,
and verified ELF machine 62 or 183 and resolved `libatomic.so.1`.
Both architectures report Debian `libatomic1` version `12.2.0-14+deb12u1`.
Base Node remains `24.22.0`.
The temporary repository Node installation was removed in the same step
and does not appear in the final filesystem layer.

Independent registry reads verified the corrected configurations and their attestation subject bindings.
The original-build token read the new index and both final layers;
an empty blob-upload initiation again returned HTTP 403 `DENIED`.
The corrected `/opt/depot-research/image-tools.json` hashes are
`53d2d2c340ef8214c8b9caf2da0b94c38327c63655d4656729a3b54c5d1e7f96` for AMD64
and `1229b983f4c529867d6a0fb1d0b1f1c1ba00f8b941c04d599ecd3d6845f3afa2` for Arm64.
They contain 4,154 and 4,179 bytes respectively.
The [BuildKit receipt](../audit/depot-buildkit-platform-campaign-2026-10-18.evidence.json)
records this derivative separately from the retained missing-library image.
The parent owns the subsequent full checkout and Mise consumers.

The same research branch now includes the frozen firstparty `truepeak-core` Cargo cache-mount fixture
from source `7f22f25adb`.
Its mount controls distinguish an empty offline failure,
an online seed,
offline target reuse,
offline registry reuse with a fresh target,
and changed-flag invalidation.
No remote Cargo case has run yet.
The actual local prerequisite control started pinned Node `24.22.0`,
Rust `1.97.1`,
and Cargo `1.97.1`
with the frozen lock hash under a two-CPU,
two-GiB,
network-disabled runtime.

The parent-authorized cumulative timestamp-compute model ceiling is now USD 2.
Its fresh forecast includes the seven observed request intervals,
the Cargo cohort,
the forwarding graph,
and the immutable remote-Git controls.
The owned project remains `HARDWARE_16X32`,
with at most two architecture builders and a five-minute server build timeout.
This model does not inspect or constrain unseen account charges.

## Unreleased CLI changes expose additional research cases

The open [CLI upgrade pull request][cli-upgrade] documents differences from the installed release:
remote Bake handling,
source-policy enforcement,
metadata merging,
combined load and output behavior,
context isolation,
and Docker driver cleanup selection.
These are upstream author's claims until reconciled with deciding source and applicable controls.
An unmerged change receives no deployed capability credit.
The installed Docker configuration uninstall path will not be exercised against shared state.

## Active source and runtime gaps

- Reconcile every indexed page and command with a concrete repository use,
  a non-applicability reason,
  or an explicit unresolved question.
- Compare deployed schemas,
  bundled CLI schemas,
  SDK exports,
  and source release dates method by method.
- Follow advanced BuildKit and Bake features into implementation:
  remote Git contexts,
  named contexts,
  native architectures,
  SSH and secret forwarding,
  cache export/import,
  local exports,
  provenance,
  SBOMs,
  OCI lazy-pull formats,
  deduplication,
  and builder lifecycle.
- Qualify service containers,
  reusable workflow current-source behavior,
  retry side effects,
  parallel state,
  event supersession,
  and status attempts with bounded real probes coordinated with the parent investigation.
- The Cargo wrapper checks for local `sccache` before providing delegated help.
  This machine's help invocation failed with `sccache not found in PATH`.
  That is a local prerequisite failure,
  not evidence against the separately exercised cloud compiler-cache route.
- Reconcile security statements with later infrastructure changes,
  plan eligibility,
  artifact deletion,
  exports,
  and support commitments.
- Keep SDK lifecycle smoke tests distinct from prepared-image,
  agent configuration,
  snapshot,
  and real repository consumers.

The source/evidence ledger will distinguish discovered,
retrieved,
source-audited,
exercised,
blocked,
and unresolved surfaces.
No completion or interview-readiness conclusion is made.

[llms]: https://depot.dev/llms.txt
[sitemap]: https://depot.dev/sitemap.xml
[bundle]: https://depot.dev/llms-all.txt
[cli-upgrade]: https://github.com/depot/cli/pull/627
[gha-troubleshooting]: https://depot.dev/docs/github-actions/troubleshooting
[kvm-run]: https://github.com/Aquaticats/Monochromatic/actions/runs/39104064329
[kvm-evidence]: ../audit/depot-github-kvm-documentation-contradiction-2026-10-18.evidence.json
[metal-launch]: https://depot.dev/blog/announcing-depot-metal
[metal-gha-rollout]: https://depot.dev/blog/how-we-load-tested-depot-metal-before-scaling-up
[metal-autoscaler]: https://depot.dev/blog/autoscaling-depot-metal
[manage-runs]: https://depot.dev/docs/ci/how-to-guides/manage-workflow-runs
[retry]: https://depot.dev/docs/ci/how-to-guides/retry-steps
[parallel]: https://depot.dev/docs/ci/how-to-guides/parallel-steps
[pr-continuation]: https://depot.dev/changelog/2026-08-19-depot-ci-pr-run-cancellation
[duplicate-checks]: https://depot.dev/changelog/2026-08-21-duplicate-pull-request-checks
[check-names]: https://depot.dev/changelog/2026-09-23-accurate-github-checks
[reruns]: https://depot.dev/changelog/2026-09-23-depot-ci-rerun-fixes
[compatibility]: https://depot.dev/docs/ci/compatibility
[ci-api]: https://depot.dev/docs/api/ci/reference
[ci-openapi]: https://depot.dev/openapi/depot-ci/v1.json
[gha-openapi]: https://depot.dev/openapi/depot-github-actions/v1.json
[gha-api]: https://depot.dev/docs/api/github-actions-api
[registry]: https://depot.dev/docs/registry/overview
[registry-quickstart]: https://depot.dev/docs/registry/quickstart
[pull-through]: https://depot.dev/docs/registry/pull-through-cache
[security]: https://depot.dev/docs/security
[ai]: https://depot.dev/docs/ai-at-depot
[terms]: https://depot.dev/terms-of-service
[status]: https://status.depot.dev/
