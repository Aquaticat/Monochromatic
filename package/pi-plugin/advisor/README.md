# Pi Advisor

Pi Advisor adds an `advisor` tool and `/advisor` command to Pi.
It sends serialized conversation context to a secondary reviewer model selected from the current effective Pi model scope.

This differs from Claude Code Advisor.
Claude Code uses an Anthropic server-side beta tool.
Pi Advisor is a local Pi extension,
 works across providers,
 and calls the secondary model through Pi's model registry.

## Install

Build the package,
 then load the extension from package settings or the CLI:

```json
{
  "packages": ["./packages/pi-plugin/advisor"]
}
```

```bash
pi -e ./packages/pi-plugin/advisor/src/index.ts
```

## Tool usage

Use empty params to select the scoped model with the highest expected Advisor call cost,
excluding the current main model when another scoped model is available:

```json
{}
```

Use a focused question when the main model wants Advisor to answer a specific uncertainty,
not only provide general review feedback:

```json
{ "question": "Did I miss any verification before declaring this done?" }
```

Use an explicit scoped model slug when a specific reviewer model is needed,
including when you intentionally want the current main model:

```json
{ "model": "anthropic/claude-opus-4-7" }
```

Combine both fields when the question should go to a specific model:

```json
{
  "model": "anthropic/claude-opus-4-7",
  "question": "Which assumption in this plan is weakest?"
}
```

Accepted explicit forms are:

- canonical slug:
   `provider/modelId`;
- bare `model.id`,
   only when unique inside the effective scope;
- `model.name`,
   only when unique inside the effective scope.

Advisor throws when a slug is ambiguous,
 unknown,
 or present in the global registry but outside the effective scope.
The error lists allowed scoped slugs.

## Slash commands

- `/advisor`:
   run an immediate review with the default non-current scoped model when available.
- `/advisor <slug>`:
   run an immediate review with a specific scoped model.
- `/advisor status`:
   show enablement,
   scope source,
   scoped slugs,
   default model,
   and config paths.
- `/advisor off`:
   disable Advisor for the current session and remove the tool from active tools.
- `/advisor on`:
   re-enable Advisor for the current session.

There is no `/advisor set` command.
Persistent model overrides would bypass scoped tool-parameter selection.

## Configuration

Global config path:

```text
~/.pi/agent/extensions/pi-advisor.json
```

Project config path:

```text
.pi/extensions/pi-advisor.json
```

Example:

```json
{
  "enabled": true,
  "timeoutMs": 120000,
  "maxAdvisorOutputTokens": 16384,
  "includePriorAdvisorResults": true,
  "systemPrompt": "Focus on test coverage gaps and incorrect assumptions."
}
```

`timeoutMs` bounds one complete Advisor operation,
 including local preparation and at most one retry after a successful response with no text.
Provider `error`,
 provider `aborted`,
 caller cancellation,
 and deadline expiry do not receive an identical retry.

`maxContextChars` is optional.
When omitted,
 Advisor derives the serialized-context budget from the selected model's context budget.
When present,
 it caps the model-derived budget.
Advisor starts from Pi's compaction-aware context entries,
 so messages summarized by the latest compaction are not resent.

Project config overrides global scalar values.
Model selection is not configurable here.
The selected model always comes from empty params or the explicit `model` tool parameter.

## Effective scoped model set

Advisor resolves scope in this order:

1. Live scoped models from Pi extension context,
    if Pi exposes them.
2. Startup `--models` patterns from `process.argv`.
3. Merged Pi `enabledModels` settings from global and project settings.
4. `ctx.modelRegistry.getAvailable()` when no restricted scope exists.

Pi 0.74 does not expose live session-only `/scoped-models` changes in the typed extension context.
Advisor probes for a future runtime API,
 but first delivery reconstructs startup and settings scope when that API is absent.
Exact live `/scoped-models` support needs a Pi API such as `ctx.getScopedModels()`.

## Default model ranking

For `advisor({})`,
 Advisor first removes the current main model from default candidates when another scoped model remains.
It then estimates input tokens for the serialized request and computes:

```text
expectedCost = inputTokens * model.cost.input + maxAdvisorOutputTokens * model.cost.output
```

Cache prices are ignored.
Ties break by higher output cost,
 higher input cost,
 larger context window,
 then canonical slug lexical order.

## Reasoning effort

Every Advisor call uses the highest reasoning level below `max` advertised by the selected model.
Models without extended levels use `high`.
Models that advertise `xhigh` use it,
while models that advertise `max` without `xhigh` remain at `high`.
Advisor never requests `max` or a later level because `max` calls frequently time out.
Non-reasoning models receive no reasoning option.
Advisor passes the selected level through pi-ai's unified simple API,
which maps it to each provider's request format.

## Privacy and cost

Advisor sends the serialized conversation to the selected advisor model.
That can include prompts,
 tool calls,
 tool results,
 edits,
 command output,
 and compaction summaries.
Each Advisor call can incur provider cost for the selected model.

## Troubleshooting

### Empty scope

`advisor: no scoped models with configured auth` means no scoped model has usable auth.
Check `--models`,
 `enabledModels`,
 `/scoped-models`,
 and provider login.

### Ambiguous slug

A bare id or display name matched more than one scoped model.
Use the canonical `provider/modelId` slug from `/advisor status`.

### Out-of-scope slug

The requested model exists globally but is not in the effective scope.
Change the tool argument to one of the listed scoped slugs,
 or change Pi model scope before starting the session.

### Missing auth

Auth errors come from `ctx.modelRegistry.getApiKeyAndHeaders()`.
Log in to the provider or configure the provider's API key in Pi.

### Context truncation

Advisor derives an effective serialized-context budget from the selected model's context budget.
It reserves tokens for the Advisor system prompt,
 provider framing overhead,
 and `maxAdvisorOutputTokens`.
When serialized context exceeds that effective budget,
 Advisor keeps the head and tail and inserts an omission marker.
Set `maxContextChars` only when a project needs a lower hard cap than the selected model allows.
