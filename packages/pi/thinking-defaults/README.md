# pi-thinking-defaults

Model-aware thinking default extension for pi.

GPT-shaped models get `xhigh` thinking.
Every other model gets `high` thinking.

## Installation

Add this package to global pi settings at `~/.pi/agent/settings.json`:

```json
{
  "packages": [
    "/var/home/user/Monochromatic/packages/pi/thinking-defaults"
  ],
  "defaultThinkingLevel": "high"
}
```

Keep project `.pi/settings.json` package-free unless this behavior becomes shared project policy.
The project settings file currently documents that user-specific workflow packages belong in global settings.

## Behavior

The extension applies the policy when pi starts or reloads a session,
and whenever the active model changes through `/model`, Ctrl+P cycling, or session restore.

Manual thinking changes remain in effect until the next session start or model selection.
The extension skips `pi.setThinkingLevel()` when the current level already matches the policy target.

Pi persists `pi.setThinkingLevel()` calls to global `defaultThinkingLevel`.
After each model-aware application, this extension rewrites the persisted scalar default back to `high`.
That keeps non-GPT startup paths on the project-approved fallback while still allowing GPT sessions to run at `xhigh`.

Pi clamps requested thinking levels to the selected model capabilities.
A non-reasoning model can therefore display `off` even though this extension requested `high`.

## GPT matching rule

A model is GPT-shaped when the final slash-delimited segment of its model id starts with `gpt-`,
after lowercasing.

Examples that resolve to `xhigh`:

- `gpt-5.5`
- `openai/gpt-5.4`
- `GPT-5.5`

Examples that resolve to `high`:

- `synthetic/hf:moonshotai/Kimi-K2.6`
- `synthetic/hf:zai-org/GLM-5.1`
- `claude-sonnet-4-5`

## Source structure

```text
src/
  index.ts                         # Extension entry point and pi event registration
  model-policy.ts                  # Model id leaf extraction and thinking target selection
  apply-thinking-default.ts        # Side-effect boundary around getThinkingLevel and setThinkingLevel
  global-settings.ts               # Restores persisted defaultThinkingLevel to high
  model-policy.unit.test.ts        # Pure policy tests
  apply-thinking-default.unit.test.ts
  index.unit.test.ts               # Extension registration and handler tests
  mise.verify-extension.ts         # Built extension smoke verification
```

## Validation

Run package validation from the repository root:

```sh
mise run //packages/pi/thinking-defaults:build
mise run //packages/pi/thinking-defaults:test:unit
mise run //packages/pi/thinking-defaults:lint
mise run //packages/pi/thinking-defaults:verify:extension
```
