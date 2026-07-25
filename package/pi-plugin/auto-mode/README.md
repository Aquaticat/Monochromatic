# @monochromatic-dev/pi-plugin-auto-mode

> Scratch-path note:
> `/tmp/agent` paths in this document are historical.
> Use `~/temp/agent` for current work.

LLM-as-judge guardrail for pi.
 Replaces pi-safeguard with fixed path handling and a structured-output judge.

## Architecture

Three-stage pipeline:

```text
tool_call -> flagger (signals.ts, wide-net boolean predicates)
          -> judge (judge.ts adapter over @monochromatic-dev/pi-shared-model-review)
          -> approve (silent)
          -> deny (block + reason + guidance)
          -> ask (user decides; user-denied blocks include reason)
```

### Session approval reuse

Before resolving a judge model,
 auto-mode checks the current session branch for
an earlier verdict with the same action text and approval fingerprint.
 The
fingerprint hashes the tool name,
 current working directory,
 and permission
scope.
 For `read`,
 the scope is the path only,
 so a user approval for one
`offset` or `limit` range also covers later reads of another range in the same
file.
 For other tools,
 the scope is the full tool input,
 so a later write or
edit to the same path with different content does not match.
 Only the
fingerprint digest is stored;
 full write or edit payloads are not added to
custom entries.
 Older verdict entries without an approval fingerprint fail
closed:
 they are not reused,
 and the newest same-action unkeyed verdict prevents
older fingerprinted approvals from being reused.

If the latest matching verdict is `approve` or `user-approve`,
 auto-mode allows
the action immediately and records a fresh `approve` verdict with the original
approval reason plus `reusedFromVerdict` metadata for auditability.
 A later
`deny`,
 `user-deny`,
 or `ask` verdict for the same
action and fingerprint disables reuse,
 so stale approvals do not override newer
decisions.

The flagger and judge are strictly separated:
 the flagger never provides reasons,
the judge sees only raw action plus context.

### Judge context

The recent activity sent to the judge uses the larger of the latest user-message
activity span and the newest five rendered activity lines.
 Short latest-user
spans backfill older activity until the five-line floor is reached when enough
history exists;
 longer latest-user spans are not capped.
 Messages are not
abbreviated.

For bash tool results,
 the context line includes the execution outcome and the
full final non-empty line of bash output.

### Shared review infrastructure

Auto-mode owns its action prompt,
trust directives,
batch context,
`approve`/`deny`/`ask` interpretation,
and tool-call policy.
`@monochromatic-dev/pi-shared-model-review` owns provider dispatch,
forced structured-tool transport,
direct-JSON retries,
balanced JSON extraction,
timeout propagation,
and the distinct fallback race.
This keeps transport behavior shared with other Pi plugins without coupling their user-facing policy to auto-mode.

### Verdict extraction

Primary path:
 the judge is invoked through the shared package with forced `tool_choice` (`render_verdict`).
The pi-ai event stream's `toolcall_end` event carries the parsed `arguments`,
which are translated to a `Verdict` by `parseVerdict`.

Retry path:
 if the model finishes without calling `render_verdict`,
the shared structured-attempt runner retries without tools and asks for direct JSON.
 If that direct JSON
attempt returns no text,
 it makes one final direct JSON attempt.
 These attempts
use the same safety context,
 then parse the retry response with
`extractJsonVerdict`.

Model fallback:
 if the selected judge model still fails after its transport attempts,
auto-mode excludes that model and resolves up to two distinct authenticated fallback models
before sending any request.
 It runs every selected complete judge attempt concurrently;
the first valid structured verdict settles the guard decision.
 When only one fallback model can be selected,
that model runs alone.
 A rejected contender does not settle the race while another contender can still return a verdict.
 This is an availability fallback,
 not consensus,
so the winning fallback is timing-dependent when models disagree.
 A configured model override is the first choice,
but automatic selection supplies the fallback contenders after that override fails.
 If no fallback model can be selected or all complete attempts fail,
auto-mode asks the user as before.

The shared parser first tries `JSON.parse(text)` for whole-text output,
then falls back to a balanced-brace scan that respects string-literal escapes.
A `"reason"` field containing `{` or `}` therefore does not skew object boundaries.

When a transport fallback fires,
 the shared review logger records the contract violation so an operator can see it.
 The primary contract remains "MUST call the
tool";
 the retry exists so an unexpected provider response degrades
gracefully rather than throwing.

## Bug fixes vs upstream pi-safeguard

<table>
<thead>
<tr>
<th>Aspect</th>
<th>pi-safeguard</th>
<th>pi-auto-mode</th>
</tr>
</thead>
<tbody>
<tr>
<td>`isSystemPath` check</td>
<td>Present (causes `/var/home` false positive)</td>
<td>Removed</td>
</tr>
<tr>
<td>Budget model API</td>
<td>Calls removed `getApiKey()`</td>
<td>Calls `getApiKeyAndHeaders()`</td>
</tr>
<tr>
<td>Error handling in evaluate</td>
<td>Bare `catch` swallows TypeErrors</td>
<td>Logs error, falls back to ask-user</td>
</tr>
<tr>
<td>Config validation</td>
<td>(none in upstream)</td>
<td>Valibot (Standard-Schema-compatible)</td>
</tr>
<tr>
<td>Budget model</td>
<td>Separate `pi-budget-model` package</td>
<td>Inlined `budget-model.ts`</td>
</tr>
<tr>
<td>Bash parser</td>
<td>`@aliou/sh` (UNLICENSED, three gap bugs)</td>
<td>`unbash` (ISC) plus targeted extraction</td>
</tr>
<tr>
<td>`--` separator</td>
<td>Not handled in `hasFlag()`</td>
<td>Handled</td>
</tr>
<tr>
<td>Judge response format</td>
<td>Free-text JSON</td>
<td>Forced tool-calling, direct-JSON retry, logged text parser fallback</td>
</tr>
</tbody>
</table>

## Configuration

- Global:
   `~/.pi/agent/extensions/pi-auto-mode.json`
- Project:
   `.pi/extensions/pi-auto-mode.json` (additive only)

```json
{
  "enabled": true,
  "commands": ["terraform", ["docker", "compose"]],
  "patterns": ["production"],
  "instructions": "Allow terraform commands in this project",
  "judgeModel": {
    "modelOverride": "openai/gpt-4o-mini",
    "strategy": "any-provider",
    "majorVersions": 1
  },
  "judgeTimeoutMs": 10000
}
```

The `judgeModel` defaults to `{strategy: "any-provider", majorVersions: 1}` when the config is absent
or `judgeModel` is unset;
 defined once in `src/constants.ts` as `JUDGE_MODEL_DEFAULTS` and referenced from
the loader,
 the global defaults,
 and the judge-model selector.
Automatic judge selection first keeps the configured major-version families,
then ranks candidates by local speed-name heuristic:
`highspeed` or `high-speed` > `fast` > `luna` > `flash` or `spark` > `terra` >
`turbo` > `nano` > `mini` > `haiku` > `lite` or `light` > no signal.
When no speed signal separates candidates,
 selection falls back to input cost and version.

### Effective scoped model set

Automatic selection only considers Pi's effective scoped models:

1. Live scope exposed by Pi's extension context.
2. Startup `--models` patterns.
3. Merged global and project `enabledModels` settings.
4. Authenticated registry models when Pi has no scope restriction.

The default strategy ranks candidates from every provider in that set.
Set `strategy` to `same-provider` to restrict that automatic selection to the active model's provider.
A configured `modelOverride` remains an explicit registry-wide choice and can select a model outside the scope.

## Skill read allowlist

Before each agent run,
 auto-mode reads Pi's loaded skill metadata from
`before_agent_start` and allows `read` tool access to every loaded skill
directory.
 This prevents guard prompts when the model loads `SKILL.md` or
referenced files from global,
 project,
 or package skills.

Auto-mode also allows `read` tool access to existing files under current
`~/temp/agent` and historical `/tmp/agent` compatibility roots when each
directory is owned by the current process user,
has no group or other permission bits,
 and resolves without symlinks.
Agents should place new third-party source clones under `~/temp/agent` when they
need repeated inspection outside the current project.
The allowlist uses canonical filesystem paths,
 so symlinks that resolve outside
either root still go through the normal signal and judge pipeline.

For Bash tool calls,
 both private roots are trusted for existing non-secret
helper paths.
 Running an inspected helper script from either root does not
trigger a location-only prompt.
 Bash calls still flag destructive commands,
secret-looking paths inside either root,
 and paths outside trusted roots.

When a Bash command passes a secret-looking environment variable to a trusted
script or interpreter command under either root,
 auto-mode permits `grep` to
source that key from a project-local `.env` file.
 This covers image-diff or
model-check helpers such as
`GEMINI_API_KEY="$KEY" node "${HOME}/temp/agent/check.mjs"`.
 It does not allow
arbitrary secret files,
 unrelated dotenv reads,
 home dotfiles,
 direct network
commands with secret parameter references,
 or untrusted script paths.

Auto-mode also allows `read` tool access to existing files in linked git
worktrees attached to the current repository.
 The worktree list comes from real
git metadata,
 and each candidate root is classified with `rev-parse` so the main
worktree is not added to this cross-worktree allowlist.

The allowlist preserves secret-path checks.
 `write` and `edit` calls targeting
skill directories,
 linked worktrees,
 or either agent scratch root still go through
the normal signal and judge pipeline.

## Logging

The package uses tagged loggers from `@monochromatic-dev/module-logger`.
The root tag is `auto-mode`;
 each module composes a deeper tag
(`auto-mode -> evaluate`,
 `auto-mode -> judge`,
 ...).
 At function entry
and at branch decisions the log lines describe the flow so operators
can audit verdicts without instrumenting the code further.

## Commands

- `/guard <directive>`:
   add a session-scoped trust directive
- `/guard reset`:
   clear all trust directives
- `/guard`:
   list active trust directives

## Bypass mode

`Shift+Tab` toggles bypass mode when pi has no built-in binding on that key.
Stock pi binds `Shift+Tab` to `app.thinking.cycle`,
 so users who want the
bypass shortcut must unbind or remap that action in `~/.pi/agent/keybindings.json`:

```json
{
  "app.thinking.cycle": []
}
```

While bypass is enabled,
 auto-mode allows tool calls without flagger or judge
evaluation.
 The footer shows `auto-mode: bypass`,
 toggles are written as
`auto-mode:bypass` session entries,
 and each tool call allowed while bypass is
active is written as a bypass audit entry.
 Press `Shift+Tab` again to restore
guardrail checks.

## Tools

- `propose_trust`:
   request permission for something the guardrail blocked.
  If the proposed rule exactly matches an active session trust directive,
  auto-mode accepts it without a UI prompt.
   New or reset-cleared rules still
  prompt the user.
