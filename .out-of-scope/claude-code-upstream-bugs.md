# Claude Code upstream bugs

This project does not file or track Claude Code bugs as GitHub issues, and does not
invest in elaborate local workarounds for upstream Claude Code defects.

## Why this is out of scope

Upstream Claude Code (the Anthropic CLI) is **very unresponsive** to issue reports.
Filing local tracking issues for bugs that will not be fixed upstream just produces
issue-tracker clutter without changing the outcome. The pattern has played out enough
times that the cost-of-tracking now exceeds the value-of-knowing.

Specifically:

- Bug reports filed upstream sit without response or get marked duplicate / wontfix.
- Fixes that do land take many releases, with no notification when they ship.
- The behavior we care about (Edit/Write atomicity, pipe reliability, compaction
  triggering, terminal cursor handling, etc.) is unlikely to change soon enough to
  matter for current work.

## What we do instead

- **Document the defect in `doc/troubleshooting/<topic>.md`.** Source-trace the
  cause if possible. Include the workaround we use locally.
- **Skip filing a GitHub issue for tracking.** No `track-upstream-claude-code-X` issues.
- **Implement the local workaround in `AGENTS.md` rules** so future agent sessions
  follow it without needing to rediscover the bug.

## Examples of this category

The following local tracking issues were closed as wontfix per this policy:

- `#89` MCP-based edit tool to replace Claude Code's Edit (content-hash staleness)
- `#90` Claude Code Bash tool pipe bug
- `#112` Agent-initiated context compaction
- `#162` Claude Code Edit/Write non-atomic fallback exposing empty file window
- `#163` Claude Code overrides ghostty cursor style

Each of those corresponds to a file under `doc/troubleshooting/` that
remains the canonical record. That file is where the institutional
knowledge lives.

## Exception

If Claude Code ever provides a documented mechanism for an issue we care about
(e.g. publishes an official IPC channel for agent-initiated compaction), that is a
*new feature* to adopt, not an *upstream bug fix to wait for*. File an enhancement
issue at that point, scoped to integrating the new feature.

## Re-evaluation

If upstream Claude Code responsiveness changes meaningfully, revisit this policy.
The trigger to re-evaluate is empirical evidence that a reported issue produced a
fix within an actionable timeframe, not optimistic projection.
