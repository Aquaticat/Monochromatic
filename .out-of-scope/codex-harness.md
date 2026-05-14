# Codex harness

This project does not maintain Codex harness plugins or invest further in Codex-specific
agent integration work.

This policy applies only to the Codex harness and its integration surface. It does not
apply to Codex models, model providers, APIs, benchmarks, or other non-harness Codex
technology.

## Why this is out of scope

The Codex harness is not worth the maintenance cost for this workspace. Its plugin and
hook model is less useful than Pi for the workflows this repository needs, and keeping a
parallel Codex plugin tree creates duplicated integration work without enough payoff.

Pi is the preferred agent harness here. It provides a better fit for the project’s
coding-agent workflow, tool integration model, process management, and session ergonomics.

## What we do instead

- Build agent automation for Pi first.
- Keep Claude Code workarounds only where the current workflow still depends on them.
- Do not recreate deleted `packages/codex-plugins/` packages unless a future user
  explicitly changes this policy.
- Treat Codex-specific harness bugs, hooks, and plugin ideas as out of scope.

## Deleted area

`packages/codex-plugins/` was removed because maintaining it would preserve a second
agent-integration surface that the project does not plan to use.
