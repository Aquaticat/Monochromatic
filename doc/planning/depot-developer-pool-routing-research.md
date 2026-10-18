# Depot Developer pool routing research

Research in progress on 2026-10-18.
The objective is substantially broader CI coverage using Depot as an additional execution pool,
with GitHub Actions retained where it fits the workload.
This note records repository architecture,
routing mechanisms,
security boundaries,
and rollout evidence for the parent adoption study.
It does not authorize a production workflow or repository-policy change.

## Measured starting point

At `cf9c9c028bf59c990108ed97a660bf72d64311f3`,
the main checkout has no `.depot/` directory and has 17 GitHub workflow files defining 48 jobs before matrix expansion.
The workflow inventory includes focused fuzzing,
host-contract checks,
native Windows and Alpine consumers,
release pipelines,
CodeQL,
Scorecard,
and Claude execution.
The root `mise.toml` also exposes build,
lint,
unit,
browser,
and end-to-end task families that these focused workflows do not cover as a complete graph.

Repository-only GitHub API reads on 2026-10-18 found an empty required-status-check list on `main`,
an active Copilot review ruleset,
SHA-pinned allowed actions,
and read-only default workflow tokens.
No account-wide settings or secret contents were read.
The checked-in historical [CI provider decision](../decision/ci-provider.md) predates the native trial;
its old platform inventory must not be treated as current capability evidence.

## Research and experiment boundary

Current tasks are an inventory starting point,
not the ceiling of desired coverage.
Research includes affected consumers,
static checks,
unit and property tests,
fuzzing and mutation,
browser engines,
native architectures,
GUI and VM consumers,
Android,
release provenance,
and bounded agent-requested cloud experiments.

A disposable branch will test a GitHub Actions matrix with one GitHub Linux row and one Depot Linux row,
explicit single-pool selection,
cross-job artifact receipts,
and an intentional failing worker that must fail the final gate.
The command tree is limited to checked-in Node receipt logic,
pinned GitHub artifact actions,
repository-scoped workflow dispatch and readback,
and disposable-worktree Git operations.
It uses no project secrets,
publishing credentials,
production state,
or account settings.
Manual dispatch is experiment evidence,
not proof of PR or merge-queue enforcement:
[GitHub documents that distinction](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks).

## Next evidence

Complete the task and consumer inventory,
primary-source compatibility review,
routing probe,
mechanism comparison,
and adoption verification plan before user grilling begins.
