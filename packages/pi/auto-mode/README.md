# @monochromatic-dev/pi-auto-mode

LLM-as-judge guardrail for pi. Replaces pi-safeguard with fixed path handling and structured-output judge.

## Architecture

Three-stage pipeline:

```
tool_call -> flagger (signals.ts, wide-net boolean predicates)
          -> judge (judge.ts, LLM call via tool-calling with forced tool_choice)
          -> approve (silent) / deny (block + guidance) / ask (user decides)
```

Flagger and judge are strictly separated: the flagger never provides reasons, the judge sees only raw action + context.

## Bug fixes vs upstream pi-safeguard

| Aspect | pi-safeguard | pi-auto-mode |
|--------|-------------|-------------|
| `isSystemPath` check | Present (causes /var/home false positive) | Removed |
| Budget model API | Calls removed `getApiKey()` | Calls `getApiKeyAndHeaders()` |
| Error handling in evaluate | Bare `catch` swallows TypeErrors | Logs error, falls back to ask-user |
| Config validation | Valibot | Zod (in catalog) |
| Budget model | Separate `pi-budget-model` package | Inlined `budget-model.ts` |
| Bash parser | `@aliou/sh` (UNLICENSED, 3 gap bugs) | `shell-quote` (MIT) + targeted extraction |
| `--` separator | Not handled in `hasFlag()` | Handled |
| Judge response format | Free text + JSON parsing | Tool-calling with forced tool_choice |
| Verdict extraction | `parseVerdict(text)` | Read `toolCall.arguments` directly |

## Configuration

- Global: `~/.pi/agent/extensions/pi-auto-mode.json`
- Project: `.pi/extensions/pi-auto-mode.json` (additive only)

```json
{
  "enabled": true,
  "commands": ["terraform", ["docker", "compose"]],
  "patterns": ["production"],
  "instructions": "Allow terraform commands in this project",
  "judgeModel": {
    "modelOverride": "openai/gpt-4o-mini",
    "strategy": "same-provider",
    "costRatio": 0.5,
    "majorVersions": 1
  },
  "judgeTimeoutMs": 10000
}
```

## Commands

- `/guard <directive>` — add a session-scoped trust directive
- `/guard reset` — clear all trust directives
- `/guard` — list active trust directives

## Tools

- `propose_trust` — request permission for something the guardrail blocked
