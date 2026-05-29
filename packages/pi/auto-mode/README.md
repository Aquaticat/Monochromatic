# @monochromatic-dev/pi-auto-mode

LLM-as-judge guardrail for pi. Replaces pi-safeguard with fixed path handling and a structured-output judge.

## Architecture

Three-stage pipeline:

```text
tool_call -> flagger (signals.ts, wide-net boolean predicates)
          -> judge (judge.ts, LLM call via tool-calling with forced tool_choice)
          -> approve (silent)
          -> deny (block + reason + guidance)
          -> ask (user decides; user-denied blocks include reason)
```

### Session approval reuse

Before resolving a judge model, auto-mode checks the current session branch for
an earlier verdict with the same action text and approval fingerprint. The
fingerprint hashes the tool name, current working directory, and full tool input,
so a later write or edit to the same path with different content does not match.
Only the fingerprint digest of the full input is stored; full write or edit
payloads are not added to custom entries. Older verdict entries without an
approval fingerprint fail closed: they are not reused, and the newest same-action
unkeyed verdict prevents older fingerprinted approvals from being reused.

If the latest matching verdict is `approve` or `user-approve`, auto-mode allows
the action immediately and records a fresh `approve` verdict with the original
approval reason plus `reusedFromVerdict` metadata for auditability. A later
`deny`, `user-deny`, or `ask` verdict for the same
action and fingerprint disables reuse, so stale approvals do not override newer
decisions.

The flagger and judge are strictly separated: the flagger never provides reasons, the judge sees only raw action plus context.

### Judge context

The recent activity sent to the judge uses the larger of the latest user-message
activity span and the newest five rendered activity lines. Short latest-user
spans backfill older activity until the five-line floor is reached when enough
history exists; longer latest-user spans are not capped. Messages are not
abbreviated.

For bash tool results, the context line includes the execution outcome and the
full final non-empty line of bash output.

### Verdict extraction

Primary path: the judge is invoked with forced `tool_choice` (`render_verdict`).
The pi-ai event stream's `toolcall_end` event carries the parsed `arguments`,
which are translated to a `Verdict` by `parseVerdict`.

Retry path: if the model finishes without calling `render_verdict`,
`callJudge` retries once without tools and asks for direct JSON. The retry
uses the same safety context, then parses the retry response with
`extractJsonVerdict`.

Compatibility fallback: `collectToolCall` can still parse first-pass text
for tests and direct helper usage. The parser first tries `JSON.parse(text)`
for the whole-text case, then falls back to a balanced-brace scan that
respects string-literal escapes (so a `"reason"` field containing `{` or `}`
does not skew the boundaries).

When either fallback path fires, the judge logs an error so an operator can
see the contract violation. The primary contract remains "MUST call the
tool"; the retry exists so an unexpected provider response degrades
gracefully rather than throwing.

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
| Judge response format      | Free-text JSON                              | Forced tool-calling, direct-JSON retry, logged text parser fallback |

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

Auto-mode also allows `read` tool access to existing files under `/tmp/agent`.
Agents should place third-party source clones there when they need repeated
inspection outside the current project. The allowlist uses canonical filesystem
paths, so symlinks that resolve outside `/tmp/agent` still go through the normal
signal and judge pipeline.

The allowlist is read-only and still preserves secret-path checks. `write`,
`edit`, and `bash` tool calls targeting skill directories or `/tmp/agent` still
go through the normal signal and judge pipeline.

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
