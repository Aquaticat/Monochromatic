# Depot runner sizing, October 15, 2026

## Question and current evidence

The user asked whether a bigger Depot runner would help the music-player build.
The comparison separates runner CPU allocation from Cargo's concurrent compilation jobs.
The corrected large-runner matrix has completed;
the remaining configurations and default-container-builder repetitions are still running.
This report will incorporate their results before the final recommendation.
[Large-runner execution](https://github.com/Aquaticats/Monochromatic/actions/runs/38822116510)

## Measurement method

The trial uses the Alpine release build and production runtime from branch `trial/depot-20261015`.
The GitHub runner matrix executes revision `ef616a2900269c52c61d24f816520504a3d74dd2`.
It compares CPU/job pairs `4/4`,
`8/4`,
`8/8`,
`16/4`,
`16/8`,
`16/16`,
`32/16`,
`32/32`,
`64/16`,
and `64/64`.
Each pair gets one ephemeral runner and two rounds with separate Cargo cache namespaces.
Each round contains a cold build,
two unchanged repetitions,+a CLI-name source change,
and an unchanged repetition of the changed source.
Every exported executable must print the expected version inside the production Alpine runtime.
[Main execution](https://github.com/Aquaticats/Monochromatic/actions/runs/38822116503),
[large-runner execution](https://github.com/Aquaticats/Monochromatic/actions/runs/38822116510)

The original matrices failed because Cargo could accept stale artifacts after BuildKit replayed older source timestamps.
Their failed source-change observations are excluded from the corrected comparison.
The fix hashes copied source content and cleans the local application packages when the content changes,
while preserving registry dependency artifacts.
The [cache investigation](../troubleshooting/cargo-buildkit-source-timestamps.md)
records the failing control and remedy.

Cold means empty Cargo caches for that round.
The second round can reuse the base image and operating-system page cache.
The measurements time the Bake invocation,
including export on the runner;
they exclude workflow setup and cleanup.
Two observations on one runner measure within-runner spread,
not the distribution across independently allocated machines.
The CPU model and memory observations are retained with every configuration.
The 32-CPU jobs reported `AMD EPYC 9R45`;
the 64-CPU jobs reported `Intel(R) Xeon(R) 6975P-C`.
Consequently,
the allocation results cannot isolate core count from processor and host differences.
[Large-runner evidence](depot-runner-sizing-2026-10-15.38822116510.evidence.json)

## Cost method

Published Linux runner rates are USD $0.003 per allocated CPU-minute.
The measured build seconds multiplied by that rate estimate gross compute usage,
before included allowances and excluding setup.
These are modeled charges,
not invoice entries.
[Depot runner prices](https://depot.dev/docs/github-actions/runner-types)

The user's CAD $8.975/hour valuation and dated CAD $1.4196/USD conversion give approximately USD $6.322/hour.
Combined cost adds that elapsed-time value to gross compute cost only when the build determines relevant completion.
When a required Windows job finishes later,
reducing Linux time may save none of the user's valued elapsed time.
The [trial report](depot-trial-2026-10-15.md)
records the valuation,
exchange-rate source,
and exact-commit platform overlap measurements.

## Container product distinction

Depot's default container builder has 16 CPUs and 32 GB RAM on every plan.
Larger container builders require Startup or Business.
This is separate from selecting a larger GitHub Actions runner.
[Container builder specifications](https://depot.dev/docs/container-builds/overview)

The initial container trial used four Cargo jobs.
The follow-up measures 16 jobs on the existing default builder,
without changing its allocation or subscription.
It uses two fresh Cargo cache namespaces,
unchanged repetitions,
and the production runtime assertion.
Its elapsed times include downloading the artifact to the local client,
so they are not directly comparable to the runner-local exports.
The [initial trial report](depot-trial-2026-10-15.md)
retains the original four-job observation and its scope.
