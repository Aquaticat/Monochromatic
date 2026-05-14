# Pi GPT-5.5 long context

This project does not invest in lifting Pi's GPT-5.5 context metadata above the
conservative 272K limit for OpenAI Codex, and does not maintain local patches whose
main purpose is to push Codex-style GPT-5.x sessions closer to 400K or 1M tokens.

## Why this is out of scope

The evidence for a hard 272K server cap is not strong enough to justify a local fork,
but the upstream behavior is also not clearly worth fighting.

Pi follows the OpenAI Codex safety tradeoff: reserve the full 128K output budget and
compact before input plus potential output can overflow the model's total context.
OpenAI Codex maintainers describe this as intentional behavior, not a simple catalog
bug. Users can sometimes raise the effective window locally, but that trades earlier
compaction for a higher chance of context-overflow errors and interrupted sessions.

The payoff is low for this workspace:

- Pi already supports compaction and custom model metadata for deliberate experiments.
- The clean product fix would need separate local model IDs and provider-facing model
  IDs, so users can select both conservative and long-context variants. Pi does not
  expose that shape cleanly today.
- Maintaining a forked provider or generated model catalog would add churn every time
  Pi refreshes model metadata.
- The observed benefit is qualitative, while the failure mode is a broken long-running
  agent session.

## What we do instead

- Accept Pi's built-in `openai-codex/gpt-5.5` 272K context metadata.
- Use compaction, branch compression, or fresh sessions instead of raising the model
  window for routine work.
- Treat higher `contextWindow` values in `~/.pi/agent/models.json` as temporary manual
  experiments, not project policy.
- Do not open local tracking issues or maintain package patches for GPT-5.5 400K or 1M
  context in Pi unless upstream adds first-class variant support.

## Re-evaluation

Revisit only if Pi or OpenAI Codex ships first-class support for separate selectable
variants, for example a conservative default plus an explicit long-context variant that
maps to the same upstream model ID. Revisit also if upstream documents a reliable way to
recover from context-overflow errors without terminating or corrupting the session.
