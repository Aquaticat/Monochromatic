# pi-safeguard troubleshooting

## pi-safeguard flags every file under `/var/home/` as a system path

**Date**: 2026-04-28
**pi-safeguard version**: 2.0.1
**Upstream source**: [mgabor3141/yapp](https://github.com/mgabor3141/yapp), `packages/safeguard/src/signals.ts`

### Problem

On systems where the home directory is under `/var/home/` (common on
Fedora with SELinux, NixOS, and some other distributions), pi-safeguard
flags **every** file read/write/edit as a security risk, even files
well within the project working directory.

The judge model then denies the action (or the user gets a confirmation
prompt), making the guardrail unusable. Every `read`, `write`, `edit`
tool call is blocked.

### Minimal reproduction

```bash
# On a system with /var/home/user as $HOME:
pi -p "Read README.md"
# Result: blocked by the security guardrail
```

### Root cause

`pathSignals` in `packages/safeguard/src/signals.ts` checks whether a
resolved file path falls under a system prefix:

```typescript
const SYSTEM_PREFIXES = ['/etc', '/usr', '/var', '/boot', '/sys', '/proc',
  '/dev', '/sbin', '/lib',];

function pathSignals(filePath, ctx,) {
  const resolved = resolvePath(filePath, ctx.cwd,);
  if (!isUnder(resolved, ctx.cwd,))
    return true; // outside cwd -- flag
  if (isHomeDotfile(resolved, ctx.home,))
    return true; // dotfile in $HOME -- flag
  if (isSystemPath(resolved,))
    return true; // system path -- flag
  if (SECRET_PATH_PATTERN.test(filePath,))
    return true; // secret file -- flag
  return false;
}
```

The `isSystemPath` check fires **after** the `isUnder` check confirms
the path is inside cwd. On systems where `$HOME` is `/var/home/user`,
every resolved project path starts with `/var/...`, and
`isSystemPath` returns `true` for all of them.

The `isSystemPath` check is redundant here: the `!isUnder` check on the
line above already flags any path outside the project directory,
including actual system paths like `/etc/passwd`. The `isSystemPath`
check adds no value for paths that are already confirmed to be under
cwd, but it causes a false positive when the project itself lives under
a `SYSTEM_PREFIXES` entry.

Exact source locations in the yapp monorepo:

- `packages/safeguard/src/signals.ts:95-101` -- `pathSignals` function
- `packages/safeguard/src/signals.ts:122-125` -- `SYSTEM_PREFIXES` array
- `packages/safeguard/src/signals.ts:127-129` -- `isSystemPath` function

### Fix

Remove the `isSystemPath` check from `pathSignals`. Paths outside cwd
are already caught by the `!isUnder` check. The `isSystemPath` check
served no purpose for in-cwd paths and caused false positives on
systems with non-standard home directory locations.

In the compiled dist at
`~/.local/share/mise/installs/node/<node-version>/lib/node_modules/pi-safeguard/dist/index.js`,
delete the line:

```javascript
if (isSystemPath(resolved,))
  return true;
```

The corrected `pathSignals` function:

```javascript
function pathSignals(filePath, ctx,) {
  const resolved = resolvePath(filePath, ctx.cwd,);
  if (!isUnder(resolved, ctx.cwd,))
    return true;
  if (isHomeDotfile(resolved, ctx.home,))
    return true;
  if (SECRET_PATH_PATTERN.test(filePath,))
    return true;
  return false;
}
```

**Caveat**: This patch is lost when `pi update` reinstalls pi-safeguard.
Re-apply after updating, or install from a forked version.

### What does not work

- Setting `judgeModel.instructions` to explain that `/var/home/user` is
  a home directory -- the flagger sends the action to the judge regardless,
  and the judge only sees the raw action description, not why it was
  flagged. The flagger's false positive cannot be overridden by judge
  instructions.
- Adding `/var/home` to allowed paths -- there is no such config option
  in pi-safeguard. The `allowedPaths` concept exists in pi-guardrails
  but not in pi-safeguard.
- Using `strategy: "any-provider"` in `judgeModel` -- this changes which
  model the judge uses, not which signals fire. The flagger is
  model-agnostic.

### Draft upstream issue

**Title**: `pathSignals` false positive on systems with home under `/var/home/`

**Labels**: bug

**Description**:

On distributions where the home directory is `/var/home/<user>`
(e.g. Fedora with SELinux), the `isSystemPath` check in `pathSignals`
flags every project file as a system path because `/var` is in
`SYSTEM_PREFIXES`. This makes pi-safeguard unusable on these systems
-- every `read`, `write`, and `edit` tool call is blocked.

The `isSystemPath` check is redundant for paths already confirmed to be
under cwd (the `!isUnder` check on the prior line already flags paths
outside the project). Removing it fixes the false positive without
weakening protection for actual system paths outside cwd.

**Reproduction**:

1. Set up a system with `HOME=/var/home/user`
2. `pi install npm:pi-safeguard`
3. `pi -p "Read README.md"`
4. Expected: file is read normally (under cwd, no secret keywords)
5. Actual: blocked by the security guardrail

**Suggested fix**:

Remove `if (isSystemPath(resolved)) return true;` from `pathSignals`.
The `!isUnder` check already handles paths outside the project directory,
which covers the actual system path threat model.

---

## pi-budget-model fails to find a judge model when active model is the latest major version

**Date**: 2026-04-28
**pi-safeguard version**: 2.0.1
**pi-budget-model version**: 1.0.1

### Problem

When the active model is the latest major version in its provider and
is already relatively cheap, pi-budget-model's auto-selection fails
with `NoBudgetModelError`. Every flagged action then falls back to
user confirmation, making the "auto" behavior equivalent to a manual
permission gate.

### Root cause

`pi-budget-model` defaults to `majorVersions: 1`, meaning it only
considers models in the latest major version group. If the active
model itself is in that group and no cheaper model exists within it,
the cost ratio check (`activeCost * costRatio`) rejects all candidates.

For the synthetic provider, the active model
`synthetic/hf:zai-org/GLM-5.1` costs $1/M input. With `costRatio: 0.5`,
the budget selector looks for models under $0.50/M input in major
version 5. Both GLM-5 models cost $1/M, so none qualify. Cheaper models
(GLM-4.7-Flash at $0.10/M, Nemotron at $0.30/M) are in major versions
4 and 3 respectively, and are excluded by the default `majorVersions: 1`.

### Fix

Set `majorVersions: 0` in the safeguard config to search all major
versions:

```json
// ~/.pi/agent/extensions/pi-safeguard.json
{
  "judgeModel": {
    "majorVersions": 0
  }
}
```

With this setting, pi-budget-model finds `GLM-4.7-Flash` at $0.10/M
input and uses it as the judge.

### What does not work

- Setting `costRatio: 1` -- this allows the budget selector to pick a
  model that costs the same as the active model, defeating the point of
  using a cheaper model.
- Setting `strategy: "any-provider"` -- unless other providers have API
  keys configured, there are no candidates to find.

---

## pi-budget-model crashes on `ModelRegistry.getApiKey` — every flagged action requires manual approval

**Date**: 2026-04-28
**pi-safeguard version**: 2.0.1
**pi-budget-model version**: 1.0.1
**pi-coding-agent version**: 0.70.6
**Upstream source**: [mgabor3141/yapp](https://github.com/mgabor3141/yapp), `packages/budget-model/src/index.ts`

### Problem

Every flagged action shows "No judge model available — manual approval
required" regardless of the judge model configuration. Setting
`majorVersions: 0` or `strategy: "any-provider"` has no effect. The
judge is never reached.

### Minimal reproduction

```bash
# Any action that triggers the safeguard flagger (e.g. a bash command
# containing "sudo"):
pi -p "run sudo apt update"
# Result: "No judge model available — manual approval required."
```

### Root cause

`pi-budget-model` 1.0.1 calls `ctx.modelRegistry.getApiKey(model)` at
four locations in its compiled dist:

```javascript
// pi-budget-model/dist/index.js, lines 81, 113, 128, 156
const apiKey = await ctx.modelRegistry.getApiKey(candidate,);
```

The `ModelRegistry` class in `@mariozechner/pi-coding-agent` 0.70.6
**does not have** a `getApiKey(model)` method. It was replaced by
`getApiKeyAndHeaders(model)`, which returns a structured result:

```typescript
// ModelRegistry methods in pi-coding-agent 0.70.6:
getApiKeyAndHeaders(model: Model<Api>): Promise<ResolvedRequestAuth>;
getApiKeyForProvider(provider: string): Promise<string | undefined>;
```

`ResolvedRequestAuth` is a discriminated union:

```typescript
{ ok: true; apiKey?: string; headers?: Record<string, string> }
| { ok: false; error: string }
```

When `findBudgetModel` reaches the first `getApiKey` call, it throws:

```
TypeError: ctx.modelRegistry.getApiKey is not a function
```

Pi-safeguard's `evaluate` function catches **all** errors with a bare
`catch` block:

```javascript
// pi-safeguard/dist/index.js
async function evaluate(pi, ctx, config, systemPrompt, action, batchContext,
  flowVerdicts,)
{
  let judge;
  try {
    judge = await resolveJudgeModel(ctx, config,);
  }
  catch {
    return askUser(pi, ctx, action,
      'No judge model available — manual approval required.',);
  }
  // ...
}
```

The TypeError is silently swallowed. The user sees the generic
"No judge model available" message with no indication that the real
problem is a missing method, not a missing model.

Exact source locations:

- `packages/budget-model/src/index.ts` -- four calls to
  `ctx.modelRegistry.getApiKey(model)`
- `@mariozechner/pi-coding-agent` `core/model-registry.ts` --
  `ModelRegistry` class has `getApiKeyAndHeaders` and
  `getApiKeyForProvider` but no `getApiKey`
- `packages/safeguard/src/index.ts` -- bare `catch` block in
  `evaluate` that swallows the TypeError

### Fix

**Option A**: Monkey-patch `ModelRegistry.prototype` to add the missing
method. Add this to the pi-safeguard dist so it runs before
`findBudgetModel` is called:

```javascript
// Add to pi-safeguard/dist/index.js, before the first use of findBudgetModel
import { ModelRegistry, } from '@mariozechner/pi-coding-agent';
if (!ModelRegistry.prototype.getApiKey) {
  ModelRegistry.prototype.getApiKey = async function(model,) {
    const result = await this.getApiKeyAndHeaders(model,);
    if (!result.ok)
      return undefined;
    return result.apiKey;
  };
}
```

**Option B**: Edit the pi-budget-model dist to call
`getApiKeyAndHeaders` instead. Replace all four occurrences of:

```javascript
const apiKey = await ctx.modelRegistry.getApiKey(candidate,);
```

with:

```javascript
const apiKey = (await ctx.modelRegistry.getApiKeyAndHeaders(candidate,)).apiKey;
```

(and similarly for the other three call sites that use `model` instead
of `candidate`).

**Caveat**: Both patches are lost when `pi update` reinstalls
pi-safeguard. Re-apply after updating, or install from a forked version.

### What does not work

- Setting `majorVersions: 0` -- the code crashes before reaching the
  version filtering logic. The method does not exist regardless of
  config.
- Setting `strategy: "any-provider"` -- same crash, different code
  path (the `getApiKey` calls in `findAnyProvider` and
  `resolveModelOverride` are also broken).
- Setting `modelOverride` to pin a specific judge model -- this calls
  `getApiKey` in `resolveModelOverride`, which also crashes.
- Configuring `judgeModel.instructions` -- the judge is never called;
  the crash happens during model resolution.

### Why the existing `majorVersions: 0` workaround from the previous section does not help

The `majorVersions: 0` workaround targets a different (earlier) bug
where the budget selector excluded older major versions. That fix is
correct for its specific scenario, but it cannot help here because
the `getApiKey` TypeError crashes the function **before** the version
filtering logic runs. The `majorVersions` setting is never evaluated.

### Draft upstream issue

**Title**: `pi-budget-model` calls `ModelRegistry.getApiKey()` which no longer exists in pi-coding-agent 0.70.6

**Labels**: bug

**Description**:

`pi-budget-model` 1.0.1 calls `ctx.modelRegistry.getApiKey(model)` at
four locations, but `ModelRegistry` in `@mariozechner/pi-coding-agent`
0.70.6 only has `getApiKeyAndHeaders(model)` and
`getApiKeyForProvider(provider)`. The `getApiKey(model)` method was
removed (or renamed) without a compatibility shim.

This causes a `TypeError: ctx.modelRegistry.getApiKey is not a function`
that is silently caught by pi-safeguard's bare `catch` block in
`evaluate`, surfacing as the generic "No judge model available" message
with no diagnostic detail.

Every flagged action requires manual approval, regardless of
configuration. The `majorVersions`, `costRatio`, `strategy`, and
`modelOverride` settings are all unreachable.

**Reproduction**:

1. Install pi-safeguard 2.0.1 (which depends on pi-budget-model 1.0.1)
2. Use any model that triggers the safeguard flagger
3. Expected: judge model is selected and evaluates the action
4. Actual: "No judge model available — manual approval required."

**Suggested fix**:

Replace `ctx.modelRegistry.getApiKey(model)` calls with
`ctx.modelRegistry.getApiKeyAndHeaders(model)` and extract the API key
from the structured result. Alternatively, add a `getApiKey(model)`
compatibility method to `ModelRegistry` that wraps
`getApiKeyAndHeaders`.
