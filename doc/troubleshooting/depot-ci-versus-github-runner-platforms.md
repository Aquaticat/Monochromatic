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
