# Plan: DRY `pi-plugins` and `claude-code-plugins`

Status:
 plan complete, grilled, and all decisions resolved.
 Execution deferred to a later session per user instruction.
 Sequencing is E2b, E1, E2a, E3 with per-sub-step commits.

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

Optional in the original plan, now decided:
the deny prose is byte-identical across both hosts (the same seven-line string
in `packages/pi-plugins/guardrail/src/constants.ts` as `BUN_TEST_BLOCK_REASON`
and in `packages/claude-code-plugins/source/src/handlers/guardrail.ts` as
`BUN_TEST_DENY_OUTPUT.permissionDecisionReason`). Dedup it.
Co-locate the reason with the predicate that detects the violation:
export a `BUN_TEST_BAN_REASON` constant from
`agent-harnesses-shell-command-analyzer` alongside `invokesBunTest`.
Both guardrails import the predicate and the reason as a pair.
Each host still wraps the reason in its own protocol-specific deny shape
(`{ block, reason }` for pi; `PreToolUseOutput.hookSpecificOutput.permissionDecision`
for claude); only the reason string is shared.
The Agent-resume deny (claude only) and path-guard message (pi only) stay
host-specific since they have no counterpart.

Net:
removes one verbatim duplicate plus one byte-identical prose duplicate with no
new package.

### E2: lift spawn session-discovery and text-scan primitives

Highest payoff.
Two related lifts.

### E2a: `agent-harnesses-shared/session-discovery`

Decision:
extract, with a generic interface.
Name:
`session-discovery`, not `spawn-session-finder`, because the concept is
"resolve the calling agent session," which spawn consumes but does not own.

The mechanism (procfs parent walk, `.by-pid/` directory scan, newest-mtime
fallback, tree-then-fallback composition) is deep and identical across both
hosts; the payload and config are host-specific and shallow. That is the
codebase-design deep-module shape: shared deep mechanism, host supplies shallow
adapters.

Generic interface:

```ts
// packages/agent-harnesses-shared/session-discovery
async function findCallingSession<TMapping>(
  opts: {
    readonly byPidDir: string;                       // host resolves from its own paths/env
    readonly parseMapping: (raw: string) => TMapping; // host owns the JSON shape
    readonly startPid: number;                       // usually process.ppid
  },
): Promise<TMapping | typeof SESSION_NOT_FOUND>
```

The shared package owns `readParentPid`, the process-tree walk, `readByPidDir`,
the newest-candidate scan, and the tree-then-fallback composition.
Each host keeps a `paths.ts` that resolves `byPidDir` (pi injects `env`; claude
reads `process.env.HOME`) and a `PidMapping` type that the shared package is
generic over. Only `sessionId` is common to both; host-specific fields stay in the
host `PidMapping`.

Reconcile the four divergences found during verification:
1. Control flow: pi walks iteratively, claude recurses. Both are bounded and
   defensible under AGENTS.md ITR. Pick one in the shared package; iterative
   avoids recursion-over-flat-array concerns.
2. Read concurrency: adopt claude's `Promise.all([stat, readFile])` for the
   newest-candidate scan; strictly faster than pi's sequential read.
3. Config injection: adopt pi's `env`-injection pattern for testability (aligns
   with throwaway fixtures under THR).
4. `PidMapping` shape: only `sessionId` shared; the generic parameter handles
   the rest.

Steps follow the additive-first discipline:
add `packages/agent-harnesses-shared/session-discovery` with tests, generic
over `TMapping`;
migrate `packages/pi-plugins/spawn/src/session-finder.ts` to a host adapter
that resolves `byPidDir` and supplies the pi `PidMapping` parser;
migrate
`packages/claude-code-plugins/source/src/handlers/claude-spawn/session-finder.ts`
to a host adapter the same way;
replay byte-equal fixtures on the claude side.
Delete each host's local copies of the shared functions once migrated.

#### E2b: text-scan placement

Decision:
land in `packages/agent-harnesses-shared/text-scan` as a holding place.
Every current consumer is an agent-harness plugin, and
`docs/planning/package-category-rebalance.md` keeps `packages/module/*` for
general-purpose TypeScript utilities with wider stewardship, so the holding place
keeps the DRY change scoped to the effort that discovered the duplication.

`text-scan` is too generic a name for a `packages/module/*` package, so the
long-term home is not one `module/text-scan` package.
Tracked in GitHub issue #276:
split the primitives into purposeful `packages/module/` packages organized by
concern (character classification, token splitting, word-boundary phrase
lookup, delimiter-range stripping), migrate consumers, then delete
`agent-harnesses-shared/text-scan`.
Act on #276 once a non-harness consumer appears or once the generic name starts
hiding distinct concepts.

Lift the claude superset (535 lines) into the shared package;
`packages/pi-plugins/spawn/src/text-scan.ts` (85-line subset) becomes a re-export
or is deleted in favor of direct imports of `isWhitespace` and
`splitWhitespace` from the shared package.
The claude `source/src/lib/text-scan.ts` internal import path changes to the
shared package; its five handler consumers update accordingly.

### E3: statusline projected-overrun kernel

Gate dropped.
Originally gated on a design decision because the plan claimed the projection
arithmetic had diverged. Verification disproved that:
`packages/pi-plugins/statusline/src/usage-warning.ts` explicitly states it
"mirrors the Claude Code statusline projection: recover elapsed window time
as `windowSeconds - secondsUntilReset`." The pi model is the claude model plus
two generalizations: `sampledAtMs` (sampling instant explicit, not always
`Date.now()`) and an optional `paceScale` (for providers like Synthetic that
regenerate credits on a different cadence). The models are already aligned; pi
is the superset.

Adopt pi's `RateLimitSnapshot` (`usedPercent`, `windowSeconds`, `resetAtMs`,
`sampledAtMs`, `paceScale`) as the canonical shared shape. Claude is a strict
special case (`sampledAtMs = Date.now()`, `paceScale = 1`).

Lift into `agent-harnesses-shared/usage-projection`:
the projected-overrun computation, the `->N%` marker rendering, the
relative-time formatter, and the threshold constants
(`MIN_USAGE_FOR_PROJECTION`, `PROJECTED_OVERRUN_THRESHOLD`,
`RATE_LIMIT_THRESHOLD`, `CAUTION_THRESHOLD`, `CRITICAL_THRESHOLD`).
Claude's `formatRateLimit` becomes a caller of the shared projector with
`sampledAtMs = now` and `paceScale = 1`; pi's `usage-warning.ts` already uses the
shared shape directly.

Host-specific parts stay put:
pi's HTTP-header parsers (`anthropic-rate-limit-headers.ts`,
`codex-rate-limit-headers.ts`, `synthetic-quota-headers.ts`,
`rate-limit-headers.ts`) that build snapshots from the `after_provider_response`
event, and claude's JSON `rate_limits.five_hour` and `rate_limits.seven_day` tier
reader that builds snapshots from the statusline JSON. Both feed the shared
projector.

Sizing:
a dedicated `agent-harnesses-shared/usage-projection` package is justified
(projection model, marker, formatter, and threshold set are substantial enough
not to fold into `shell-command-analyzer`).

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

Execution order:
E2b, then E1, then E2a, then E3.
E2b first because it is the lowest-risk utility lift with no protocol coupling,
and it unblocks E2a whose `session-finder` imports `splitWhitespace` from
text-scan. E1 next (smallest, re-proves the pattern). E2a after its text-scan
dependency is shared. E3 last (smallest payoff).

Commit granularity:
per sub-step (add shared module; migrate pi consumer; migrate claude consumer;
delete old duplicate), each leaving the tree green. This matches the GCE rule
(commit eagerly at the earliest checkpoint) and the additive-first discipline
from `docs/planning/extract-refactor-guardrail.md`.

Each step is independently shippable.

## Execution constraints

From repo rules, for whoever executes this plan in a later session:

- Every verification run against disposable fixtures, never real coordination
  state. `session-finder` reads real procfs and real
  `~/.pi/agent/spawn-results/.by-pid/` or `~/.claude/spawn-results/.by-pid/`
  coordination files; tests must use `mktemp -d` plus a fake `byPidDir`, not a
  real home. See AGENTS.md THR.
- Each migrated plugin verified the way its host exercises it:
  pi side via `pi -e` extension load or the unit-test `pi-test-harness`;
  claude side via the byte-equal stdout fixture replay documented in
  `packages/claude-code-plugins/README.md`. See AGENTS.md VUB and VB2.
- Each new shared package satisfies all lint rules: `require-tsdoc`, max-lines
  (split, not compress), and `no-restricted-syntax/no-regex` that motivated
  `text-scan`. See AGENTS.md LN1 and MXL.
- Each new shared package gets `README.md`, passes linting with zero errors, and
  has tests covering every exported code path before declared done.
  See AGENTS.md PKG and TCV.

## Open decisions

All resolved during grilling:

- E1:
  fold `invokesBunTest` plus the byte-identical ban prose (as `BUN_TEST_BAN_REASON`)
  into the existing `agent-harnesses-shell-command-analyzer`. No new package.
- E2a:
  extract as `agent-harnesses-shared/session-discovery`, generic over the
  host `PidMapping`; adopt pi's env-injection and claude's `Promise.all`
  stat-plus-read concurrency; iterative tree walk.
- E2b:
  land in `agent-harnesses-shared/text-scan` as a holding place; long-term split
  into purposeful `packages/module/` packages tracked in GitHub issue #276.
- E3:
  drop the design gate; adopt pi's `RateLimitSnapshot` as canonical
  (claude is the special case with `sampledAtMs = Date.now()`, `paceScale = 1`);
  extract as `agent-harnesses-shared/usage-projection`.
- Sequencing:
  E2b, E1, E2a, E3 with per-sub-step commits.
