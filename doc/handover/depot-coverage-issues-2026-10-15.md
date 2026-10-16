# Depot coverage issue follow-up

The user requested a GitHub issue for every observed problem.
This follow-up owns the coverage and cost gaps identified during the authorized Depot trial.
It does not authorize production migration.

## Completed work

The [desktop cost overlay](../audit/depot-desktop-cost-2026-10-15.md)
records the complete 441-second desktop attempt and its coverage limits.
Its independent calculation check,
Markdown lint,
and rendered inspection passed.

Created these issues with source evidence and independently verifiable acceptance criteria:

- [Native verification routes](https://github.com/Aquaticats/Monochromatic/issues/1023),
  covering existing native checks beyond the Windows and Alpine music-player suites.
- [Android host and native checks](https://github.com/Aquaticats/Monochromatic/issues/1024),
  covering JVM tests,
  lint,
  native ABIs,
  and the distinction between instrumentation assembly and device execution.
- [Browser and end-to-end CI execution](https://github.com/Aquaticats/Monochromatic/issues/1025),
  covering existing Playwright suites and their reports.
- [`done` browser user-flow coverage](https://github.com/Aquaticats/Monochromatic/issues/1026),
  covering suite authoring against implemented application behavior.
- [Affected consumers](https://github.com/Aquaticats/Monochromatic/issues/1027),
  covering changed-package and transitive-consumer task selection.
- [Obsolete ownership package filter](https://github.com/Aquaticats/Monochromatic/issues/1028),
  covering the semantic-bridge workflow's stale plural path.
- [Shared-input trigger omissions](https://github.com/Aquaticats/Monochromatic/issues/1029),
  covering dependency and toolchain inputs consumed by existing jobs.
- [Remaining workload costs and allocation](https://github.com/Aquaticats/Monochromatic/issues/1030),
  covering unmeasured checks and an explicit proposed execution allocation.

## Existing issues reused

The all-state issue search returned 974 issues before the remaining parallel reports were filed.
A subsequent latest-issue search checked for concurrently created duplicates.
Existing bodies and comments were inspected for the closest matches.

- [Root package-task discovery](https://github.com/Aquaticats/Monochromatic/issues/305)
  and its overlapping [root-test report](https://github.com/Aquaticats/Monochromatic/issues/555)
  already track omissions in the aggregate test task.
- [Playwright discovery](https://github.com/Aquaticats/Monochromatic/issues/310)
  and the [paused-package reproduction](https://github.com/Aquaticats/Monochromatic/issues/603)
  already track the active-package boundary.
- [General CI direction](https://github.com/Aquaticats/Monochromatic/issues/122)
  remains the broader setup issue.
  The new workload issues specify separate execution evidence.
- [Logger post-release verification](https://github.com/Aquaticats/Monochromatic/issues/479)
  records local browser coverage pending a CI route.
- [Historical hook consolidation](https://github.com/Aquaticats/Monochromatic/issues/160)
  was superseded by the Git policy platform;
  it does not establish the proposed consumer selector.

No duplicate issue was created for those discovery or historical-hook reports.

## Ownership boundaries

Other active tasks own the desktop chooser,
fixture selection,
Android context,
snapshot and service behavior,
cache behavior,
release and quota handling,
scheduling incidents,
and GitHub log retrieval.
This follow-up creates current-repository issues only.
It does not post upstream reports.

## Verification and handoff

All eight new issue bodies passed CommonMark rendering before publication.
Their fetched GitHub body bytes match the reviewed local bodies.
GitHub reports each issue open with the `needs-triage` label.
The issues preserve production provider selection as an unresolved trial decision.

This coverage issue queue is complete.
The main trial ledger can use the linked issues to track implementation and verification.
