# @monochromatic-dev/pi-auto-mode

LLM-as-judge guardrail for pi. Replaces pi-safeguard with fixed path handling and a structured-output judge.

## Architecture

Three-stage pipeline:

```
tool_call -> flagger (signals.ts, wide-net boolean predicates)
          -> judge (judge.ts, LLM call via tool-calling with forced tool_choice)
          -> approve (silent) / deny (block + guidance) / ask (user decides)
```

The flagger and judge are strictly separated: the flagger never provides reasons, the judge sees only raw action plus context.

### Verdict extraction

Primary path: the judge is invoked with forced `tool_choice` (`render_verdict`).
The pi-ai event stream's `toolcall_end` event carries the parsed `arguments`,
which are translated to a `Verdict` by `parseVerdict`.

Fallback path: if the model ignores `toolChoice` and returns text instead
(observed with some non-Anthropic providers), the stream's `text_end` events
are concatenated and `extractJsonVerdict` parses the JSON object out of the
text. The fallback first tries `JSON.parse(text)` for the whole-text case,
then falls back to a balanced-brace scan that respects string-literal escapes
(so a `"reason"` field containing `{` or `}` does not skew the boundaries).

When the fallback fires, the judge logs an error so an operator can see
the contract violation. The contract is still "MUST call the tool"; the
fallback exists so an unexpected provider response degrades gracefully
rather than throwing.

## Bug fixes vs upstream pi-safeguard

| Aspect                     | pi-safeguard                                | pi-auto-mode                                           |
| -------------------------- | ------------------------------------------- | ------------------------------------------------------ |
| `isSystemPath` check       | Present (causes `/var/home` false positive) | Removed                                                |
| Budget model API           | Calls removed `getApiKey()`                 | Calls `getApiKeyAndHeaders()`                          |
| Error handling in evaluate | Bare `catch` swallows TypeErrors            | Logs error, falls back to ask-user                     |
| Config validation          | (none in upstream)                          | Valibot (Standard-Schema-compatible)                   |
| Budget model               | Separate `pi-budget-model` package          | Inlined `budget-model.ts`                              |
| Bash parser                | `@aliou/sh` (UNLICENSED, three gap bugs)    | `shell-quote` (MIT) plus targeted extraction           |
| `--` separator             | Not handled in `hasFlag()`                  | Handled                                                |
| Judge response format      | Free-text JSON                              | Forced tool-calling, free-text JSON as logged fallback |

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

The `judgeModel` defaults to `{strategy: "same-provider", costRatio: 0.5, majorVersions: 1}` when the config is absent or `judgeModel` is unset; defined once in `src/constants.ts` as `JUDGE_MODEL_DEFAULTS` and referenced from the loader, the global defaults, and the budget-model selector.

## Skill read allowlist

Before each agent run, auto-mode reads Pi's loaded skill metadata from
`before_agent_start` and allows `read` tool access to every loaded skill
directory. This prevents guard prompts when the model loads `SKILL.md` or
referenced files from global, project, or package skills.

The allowlist is read-only and still preserves secret-path checks. `write`,
`edit`, and `bash` tool calls targeting skill directories still go through the
normal signal and judge pipeline.

## Logging

The package uses tagged loggers from `@monochromatic-dev/module-logger`.
The root tag is `auto-mode`; each module composes a deeper tag
(`auto-mode -> evaluate`, `auto-mode -> judge`, ...). At function entry
and at branch decisions the log lines describe the flow so operators
can audit verdicts without instrumenting the code further.

## Commands

- `/guard <directive>`: add a session-scoped trust directive
- `/guard reset`: clear all trust directives
- `/guard`: list active trust directives

## Tools

- `propose_trust`: request permission for something the guardrail blocked
