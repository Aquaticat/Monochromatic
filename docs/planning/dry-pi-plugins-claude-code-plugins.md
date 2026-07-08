# Plan: DRY `pi-plugins` and `claude-code-plugins`

Status:
 open.
 Plan only;
 no extraction started.
 Awaiting approval before any code change.

## Goal

Remove duplicated logic between `packages/pi-plugins/*` and
`packages/claude-code-plugins/*` by lifting genuinely shared agent-harness logic
into `packages/agent-harnesses-shared/*`,
following the pattern already proven there three times.
Host-specific adapters and protocol types stay in their host clusters.

## Baseline policy (already decided)

`docs/planning/package-category-rebalance.md` sets the governing rule for these
two clusters:

> `statusline` and `terminal-title` each exist under both `pi/` and
> `claude-code-plugins/`, and `spawn` appears as `pi/spawn` and
> `claude-code-plugins/claude-spawn`. They share a concept but no code, and they
> bind to different host APIs, so each stays under its host cluster. Extract an
> `agent-harnesses-shared/` package only if real shared agent-harness logic
> emerges, as it did for `current-time-context`.

The bar is **real shared agent-harness logic emerged**, not "same concept."
Two host clusters with different protocols is the expected default, not a
defect to fix:

- pi plugin:
  in-process event emitter.
  Entry is `export default async function(pi: ExtensionAPI)`, registers
  `pi.on('tool_call', (event, ctx) => ...)`, returns pi-shaped decisions.
  Types come from `@earendil-works/pi-coding-agent`.
- Claude Code plugin:
  subprocess stdin/stdout JSON.
  Entry is a `#!/usr/bin/env node` shim calling
  `runHookPlugin({ parser, handler, writer })` from
  `packages/claude-code-plugins/source/src/runtime/handler-runtime.ts`.
  Types come from `@monochromatic-dev/claude-code-plugins-hook-types`.

## Current state inventory

The DRY vehicle already exists at `packages/agent-harnesses-shared/` with three
shared packages, each consumed by both clusters:

- `agent-harnesses-shared/terminal-title`
  (`@monochromatic-dev/module-terminal-title`):
  consumed by `packages/pi-plugins/terminal-title` and
  `packages/claude-code-plugins/source`.
  Both sides are reduced to a host adapter table mapping tool names
  (`bash`/`Bash`, `read`/`Read`) to shared `ToolTitleEntry` builders.
  DRY complete.
- `agent-harnesses-shared/current-time-context`
  (`@monochromatic-dev/module-current-time-context`):
  consumed by `packages/pi-plugins/current-time-context` (a thin
  `pi.on('before_agent_start')` wrapper) and
  `packages/claude-code-plugins/source` (the `prompt-time` handler re-exports
  the same `formatTimeContext`).
  DRY complete.
- `agent-harnesses-shared/shell-command-analyzer`
  (`@monochromatic-dev/agent-harnesses-shell-command-analyzer`):
  consumed by `packages/pi-plugins/guardrail`,
  `packages/pi-plugins/auto-mode`, and
  `packages/claude-code-plugins/source` (guardrail).
  Owns `analyzeShellCommand`, `extractParamRefs`, `looksLikePath`.
  Shell-command parsing DRY complete.

Established pattern, proven three times:
shared pure-logic module in `agent-harnesses-shared/` plus thin host adapters
that own the protocol boundary (event shape in, decision shape out) and the
tool-name or input-field vocabulary.

## Per-family assessment

The complete set of concepts that appear under both clusters:
`guardrail`, `spawn` versus `claude-spawn`, `statusline`, `terminal-title`, and
`current-time-context` (pi) versus `prompt-time` (claude).
No other pi-plugins package shares real logic with a claude-code-plugins package
(advisor, auto-mode, morph-compact, search-fetch, thinking-defaults are pi-only;
correction-reminder, stop-reminders, session-start-housekeeping,
bash-output-filter, research-agent are claude-only).

### terminal-title

DRY complete.
Nothing to do.
Reference implementation of the shared-module-plus-host-adapter pattern that E1, E2, and E3 extend.

### current-time-context (pi) versus prompt-time (claude)

DRY complete.
Shared `formatTimeContext`; both hosts are thin adapters.
Nothing to do.

### guardrail

Parsing already shared via `agent-harnesses-shell-command-analyzer`.
One verbatim duplicate remains:
`invokesBunTest` is identical in
`packages/pi-plugins/guardrail/src/bash-guard.ts` and
`packages/claude-code-plugins/source/src/handlers/guardrail.ts`,
same JSDoc, same
`info.name === 'bun' && info.args[0] === 'test'` predicate over
`analyzeShellCommand` output.
The deny prose is near-identical; only the output shape differs
(pi returns `{ block, reason }`;
claude returns `PreToolUseOutput.hookSpecificOutput.permissionDecision`).
The Agent-resume block (claude only) and the gitignore path-guard (pi only) are
genuinely host-specific and stay put.

### spawn versus claude-spawn

Not yet shared.
This is the biggest opportunity.
`session-finder.ts` is structurally near-identical on both sides:
`SESSION_NOT_FOUND` sentinel, `readParentPid`, `readPidMapping`,
`walkProcessTreeFrom`, `readByPidDir`, `findByMostRecent`, `findCallingSession`,
the same procfs-walk, PID-mapping, newest-candidate mechanism.
Both files even import `splitWhitespace` from their own `text-scan`.
Only the `PidMapping` payload shape (pi session path versus claude session path)
and a couple of signatures differ.
`text-scan`:
`packages/pi-plugins/spawn/src/text-scan.ts` is an 85-line subset
(`isWhitespace` plus `splitWhitespace`) of
`packages/claude-code-plugins/source/src/lib/text-scan.ts` (535 lines,
used by five handlers).
pi cannot import from `claude-code-plugins/source` without an inverted
cross-cluster dependency, so this is a genuine lift candidate, not a
re-export.

### statusline

Conceptual overlap only; the shared kernel is narrow.
The two sides parse different input shapes:
pi reads HTTP response headers from the `after_provider_response` event into a
generic `RateLimitSnapshot` with `usedPercent`, `windowSeconds`, `paceScale`,
`sampledAtMs` (`packages/pi-plugins/statusline/src/rate-limit-parse-helpers.ts`);
claude reads JSON `rate_limits.five_hour` and `rate_limits.seven_day` tiers and
derives `elapsed = windowSeconds - (resets_at - now)` at render time
(`packages/claude-code-plugins/statusline/src/statusline.ts`).
`packages/pi-plugins/statusline/README.md` already states it "ports only the
projected-overflow warning behavior from `claude-code-plugins/statusline`."
The genuinely shared kernel is the projected-overrun model, the `->N%` marker,
relative-time formatting, and threshold constants.
The arithmetic has diverged (pace and sampled-at versus derived-elapsed), so
unifying needs a design decision before any extraction.

## Recommended extractions

Each extraction follows the additive-first discipline recorded in
`docs/planning/extract-refactor-guardrail.md`:
land the shared code as an additive, verified, committed addition;
migrate each consumer leaving the tree green;
delete the old duplicate only once no consumer references it.
Verify with the byte-equal stdout fixtures method documented in
`packages/claude-code-plugins/README.md` (capture baseline
`dist/final/node/index.mjs` fixtures covering every decision path, replay
through the new entry, require byte-equal stdout).

### E1: fold `invokesBunTest` into `shell-command-analyzer`

This adds no new package.
`invokesBunTest` is a predicate over `analyzeShellCommand` output, so it belongs
alongside `extractParamRefs` and `looksLikePath` in the existing
`packages/agent-harnesses-shared/shell-command-analyzer` package, which is
already a dependency of both guardrails.

Steps:

1. Add `invokesBunTest(command)` to
   `packages/agent-harnesses-shared/shell-command-analyzer/src/`,
   exported from its `src/index.ts`, with its unit test.
2. Commit as a standalone, verified, green-tree addition.
3. Migrate `packages/pi-plugins/guardrail/src/bash-guard.ts` to import
   `invokesBunTest` from the shared package; delete the local copy.
   Run `mise run //packages/pi-plugins/guardrail:lint:types` and the guardrail
   tests.
4. Migrate
   `packages/claude-code-plugins/source/src/handlers/guardrail.ts` the same way;
   rebuild and replay baseline fixtures for byte-equal stdout.
5. Commit each migration separately, tree green at every commit.

Optional:
extract the shared deny prose into a constant in the same package only if both
hosts want identical wording.
The deny output shape stays host-specific.
This is secondary and not required for E1 to ship.

Net:
removes one verbatim duplicate with no new package.

### E2: lift spawn session-discovery and text-scan primitives

Highest payoff.
Two related lifts.

#### E2a: `agent-harnesses-shared/spawn-session-finder`

Extract the procfs-walk, PID-mapping, newest-candidate mechanism from both
`session-finder.ts` files into a new shared package, generic over the
`PidMapping` payload shape.
The host supplies the mapping field reader and the session-path resolver;
the shared package owns the process-tree walk, PID-dir reads, and
newest-candidate selection.

Substantial enough to justify its own package (roughly 700 lines of
near-duplicated mechanism across the two sides).

Steps follow the additive-first discipline:
add shared package with tests;
migrate `packages/pi-plugins/spawn/src/session-finder.ts` to a host adapter;
migrate
`packages/claude-code-plugins/source/src/handlers/claude-spawn/session-finder.ts`
to a host adapter;
replay byte-equal fixtures on the claude side.

#### E2b: `text-scan` placement decision

`text-scan` is general regex-free text scanning, not agent-harness-specific.
Two placement options:

- `packages/agent-harnesses-shared/text-scan`:
  keeps it with the other harness-shared utilities;
  current consumers are only the two harness clusters.
- `packages/module/text-scan`:
  the broad utility bucket that `package-category-rebalance.md` explicitly
  preserves for general TypeScript utilities;
  stewardship broadens beyond agent harnesses.

Recommend `agent-harnesses-shared/text-scan` for now because every current
consumer is a harness plugin and the rebalance doc keeps `module/` for
general-purpose utilities with wider stewardship.
Revisit if non-harness consumers appear.

Lift the claude superset (535 lines) into the shared package;
`packages/pi-plugins/spawn/src/text-scan.ts` (85-line subset) becomes a re-export
or is deleted in favor of direct imports of `isWhitespace` and
`splitWhitespace` from the shared package.
The claude `source/src/lib/text-scan.ts` internal import path changes to the
shared package; its five handler consumers update accordingly.

### E3: statusline projected-overrun kernel (needs design first)

Gate on a design decision, then extract.
Do not extract before the projection model is aligned.

Design question:
adopt the pi model (pace and sampled-at time, decoupled from render time) or
the claude model (elapsed derived from `resets_at` and `now` at render time)
as the canonical shared shape?
pi is the more general model (sampling time explicit, pace scale explicit);
claude is simpler but couples to wall-clock `now` at format time.

After the model is chosen, extract into `agent-harnesses-shared/`:
the projected-overrun computation, the `->N%` marker rendering, the
relative-time formatter, and the threshold constants.
pi header parsers and claude JSON tier readers stay host-specific and both
call the shared projector.

Sizing:
if the shared kernel is small after alignment, fold it into an existing shared
package rather than creating a new one (same principle as E1).
If it is substantial, a dedicated `agent-harnesses-shared/statusline-projection`
package is justified.
Decide placement after the design lands.

## What stays in host clusters

- Protocol types:
  `packages/claude-code-plugins/hook-types` for claude hook-event shapes;
  `@earendil-works/pi-coding-agent` for pi event and context types.
- The `runHookPlugin` stdin/stdout runtime (claude only) and the `pi.on(...)`
  registration (pi only).
- Host-specific guardrail branches:
  Agent-resume blocking (claude), gitignore path-guard (pi).
- Per-plugin install containers:
  `.claude-plugin/plugin.json`, marketplace wiring.
  The ADR in `packages/claude-code-plugins/README.md` already settled that
  per-plugin directories stay as install containers.

## Sequencing

1. E1 (smallest, re-proves the pattern, no new package).
2. E2a then E2b (biggest payoff; E2a unblocks deleting the largest duplicate,
   E2b removes the text-scan fork).
3. E3 (design decision first, then extraction).

Each step is independently shippable and leaves the tree green.

## Open decisions

- E2b placement:
  `agent-harnesses-shared/text-scan` versus `packages/module/text-scan`.
- E3 canonical projection model:
  pace and sampled-at (pi) versus derived-elapsed (claude).
- E3 placement:
  dedicated package versus fold into an existing one, decided after the design.
- Whether to extract the shared deny prose in E1 or leave wording per host.
