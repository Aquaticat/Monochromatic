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
const SYSTEM_PREFIXES = ["/etc", "/usr", "/var", "/boot", "/sys", "/proc", "/dev", "/sbin", "/lib"];

function pathSignals(filePath, ctx) {
  const resolved = resolvePath(filePath, ctx.cwd);
  if (!isUnder(resolved, ctx.cwd)) return true;   // outside cwd -- flag
  if (isHomeDotfile(resolved, ctx.home)) return true; // dotfile in $HOME -- flag
  if (isSystemPath(resolved)) return true;         // system path -- flag
  if (SECRET_PATH_PATTERN.test(filePath)) return true; // secret file -- flag
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
  if (isSystemPath(resolved)) return true;
```

The corrected `pathSignals` function:

```javascript
function pathSignals(filePath, ctx) {
  const resolved = resolvePath(filePath, ctx.cwd);
  if (!isUnder(resolved, ctx.cwd)) return true;
  if (isHomeDotfile(resolved, ctx.home)) return true;
  if (SECRET_PATH_PATTERN.test(filePath)) return true;
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
