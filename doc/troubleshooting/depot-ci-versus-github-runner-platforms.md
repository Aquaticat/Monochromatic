# Depot's 2026-10-17 product documentation distinguishes CI sandboxes from native GitHub runners

## Symptom

The evaluation summary said macOS and Windows required another provider.
That conclusion was too broad.
The collected native jobs used GitHub-hosted runners;
their placement did not establish that Depot could not supply native compute.

## Root cause

The report generalized a restriction of standalone Depot CI to Depot's separate GitHub Actions runner product.
The [CI overview](https://depot.dev/docs/ci/overview) states:

> Depot CI doesn't provide sandboxes for macOS or Windows.

The [GitHub runner catalog](https://depot.dev/docs/github-actions/runner-types)
separately lists Windows Server runners and Apple Silicon macOS runners.
GitHub Actions remains the workflow orchestrator when those Depot runners supply compute.
This is a product-scope correction,
not an upstream implementation defect.
No claim about an internal control-plane code path is made.

## Verification

The current CI overview,
compatibility page,
GitHub runner overview and runner catalog were fetched on 2026-10-17.
The [correction evidence](../audit/depot-platform-product-correction-2026-10-17.evidence.json)
records the URLs and distinct claims.

The supported documentation catalog includes:

- Linux x86_64 and Arm64 sandboxes in standalone Depot CI.
- Windows Server 2022 and 2025 runners used by GitHub Actions.
- macOS 14 and 15 on M2 and macOS 26 on M4 used by GitHub Actions.

The rejected inference catalog includes:

- Applying standalone Depot CI's OS restriction to every Depot product.
- Treating our GitHub-hosted execution as a measurement of Depot's native runners.
- Treating documented runner availability as proof that this repository's consumers pass there.
- Treating Apple Silicon macOS as an equivalent Intel macOS performance baseline.

These are documentation and retained-placement checks.
Actual Depot native-runner execution is separate follow-up work.
An empty repository runner listing is not a failure proof for ephemeral runners.

## Verified correction and tradeoff

Describe the orchestrator and compute provider separately.
Depot can supply Windows and macOS compute through GitHub Actions;
standalone Depot CI does not provide those sandboxes.
The provider trial must exercise the real native consumers before assigning parity or performance credit.

The user subsequently instructed execution of that missing evaluation.
Preserve the historical source cases and original results,
and record any new runner architecture or harness binding separately.
Do not change subscriptions or inspect account-wide settings.

## What does not work

Switching a Windows or macOS label into a standalone Depot CI workflow does not establish native OS execution.
The [CI compatibility documentation](https://depot.dev/docs/ci/compatibility)
also explains that unrecognized labels become Depot Ubuntu.

The prior conclusion that the existing compute-provider split was necessary is withdrawn.
The original trial placement remains a historical fact.

## Upstream filing decision

1.  No upstream fault is established:
    the product documentation distinguishes these services.
2.  No upstream implementation change is required to correct this report.
3.  Native GitHub runner use is documented;
    repository compatibility still needs execution evidence.
4.  Contribution acceptance was not evaluated because no upstream defect is alleged.
5.  No upstream fix expectation is asserted.
6.  No upstream prototype is needed for our product-scope error.

There is nothing to file upstream.
The correction belongs in this repository's report and execution ledger.

## Current GitHub runner KVM observation contradicts deployed troubleshooting

On 2026-10-18,
the current [Depot runner troubleshooting page][gha-kvm-doc] still said:

> Depot GitHub Actions runners don't currently provide `/dev/kvm`.

Actual [GitHub workflow run 39104064329][gha-kvm-run],
Depot job `117606073359`,
reported `/dev/kvm` as a character device with read and write access on `depot-ubuntu-24.04`.
The same workflow's standard GitHub job found the device but received `EACCES`.
The valid `/dev/null` control and deliberately nonexistent path established that the device probe could
distinguish permitted,
denied,
and absent devices.

The [retained verification receipt][gha-kvm-evidence] independently checks GitHub archive digests,
extracted member hashes,
and payload identity.
It binds both observations to frozen source `e02be6c8b8fe9efb41a7f8f1a0b311c17796588a`
and harness `15ee06968996212b97111accc2013c2780ed1944`.
The conflicting documentation was fetched again while verifying the artifact.

The blanket missing-KVM inference is withdrawn for that exercised Depot runner label.
Device presence and access do not establish successful VM initialization,
guest execution,
Android acceptance,
or behavior of every runner size and architecture.
The generic SDK's separate missing-device observation remains specific to its own sandboxes.

The [2026-09-16 Metal rollout account][gha-metal-rollout] describes moving GitHub Actions jobs onto Depot Metal.
Consequently,
the July announcement's future-migration wording cannot establish October placement.
The underlying implementation cause of the documentation conflict is not proven.
Use the label-specific runtime receipt for the observed fact,
and retain documentation conflicts explicitly rather than turning the page into a universal capability ban.

No upstream message was sent.
The mismatch is documented locally while actual KVM initialization and guest verification proceed separately.

[gha-kvm-doc]: https://depot.dev/docs/github-actions/troubleshooting
[gha-kvm-run]: https://github.com/Aquaticats/Monochromatic/actions/runs/39104064329
[gha-kvm-evidence]: ../audit/depot-github-kvm-documentation-contradiction-2026-10-18.evidence.json
[gha-metal-rollout]: https://depot.dev/blog/how-we-load-tested-depot-metal-before-scaling-up
