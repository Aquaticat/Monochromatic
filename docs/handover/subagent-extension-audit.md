# Subagent extension audit

## Purpose

Evaluate open-source Pi extensions and a minimal custom design for subagent orchestration, prioritizing clarity and human auditability for both the parent agent and the user.

## Locked context

- Compare in-process and child-process execution models equally.
- Require a read-only subagent option; write access may exist when the extension communicates capabilities clearly.
- Include a minimal custom extension only as a fallback comparison after surveying existing options.
- Target the installed Pi and Node workflow.
- Require a user-facing UI that exposes the complete observable child activity: prompts, progress, tool calls, outputs, status, and errors. Hidden model reasoning is outside the observable requirement.
- Require user interruption of any running subagent from that UI, including parallel and background children.
- Require the parent model to set a custom timeout per subagent, not only one global timeout.
- Treat this as an agent/plugin trust-boundary review. Inspect source, tests, CI, dependencies, maintenance, and integration behavior before recommending anything.

## Current findings

- The exposed `subagent` tool reports six registered names: `scout`, `planner`, `reviewer`, `worker`, `general`, and `general-purpose`.
- Shell-visible user and project agent directories did not explain that registry, so the registry source remains an open investigation item.
- A read-write probe succeeded: `/tmp/agent/hello.txt` contains `Hello`.
- All six registered names accepted read-only diagnostic probes.
- A broad delegated source-audit attempt timed out for every shard at 180 seconds without producing usable final reports; continue with narrower bounded probes and direct source reads.

## Investigation state

- Context fork: complete.
- Candidate inventory: in progress. UI observability, interruption, and per-subagent timeout control are hard filters.
- Source and maintenance audit: pending.
- Integration validation: pending.
- Recommendation: pending.

## Screened candidate set

Meaningful open-source candidates found through GitHub and npm searches:

- `nicobailon/pi-subagents`, npm `0.34.0`, package.json declares MIT, cloned at
  `/tmp/agent/nicobailon-pi-subagents-20260709`.
- `mjakl/pi-subagent`, npm `2.1.0`, MIT, cloned at `/tmp/agent/mjakl-pi-subagent-20260709`.
- `jwu/pi-subagents`, npm `2.1.0`, MIT, cloned at `/tmp/agent/jwu-pi-subagents-20260709`.
- `@e9n/pi-subagent` from `espennilsen/pi`, npm `0.1.0`, MIT, cloned at
  `/tmp/agent/espennilsen-pi-20260709`.
- `@the-forge-flow/sub-agents-pi`, npm `0.2.4`, MIT, cloned at
  `/tmp/agent/monsieurbarti-sub-agents-pi-20260709`.
- `pi-multiagent`, npm `0.9.8`, MIT, cloned at `/tmp/agent/tiziano-pi-multiagent-20260709`.
- `pi-crew`, npm `0.9.29`, MIT, cloned at `/tmp/agent/baphuongna-pi-crew-20260709`.
- `cmf/pi-subagent` was screened out from finalist depth: its repository has two commits, no
  release, no stars, and no declared license in the GitHub metadata.

## Hard-filter evidence so far

- `nicobailon/pi-subagents` has explicit TUI rendering, child tool-call progress, transcript
  views, fleet status, interrupt and stop actions, and per-run `timeoutMs` in
  `src/extension/schemas.ts`, `src/extension/tool-description.ts`, and
  `src/runs/background/async-execution.ts`. Its parallel task schema currently exposes no
  per-task timeout field, so this remains a possible mismatch with the per-subagent timeout
  requirement.
- `jwu/pi-subagents` renders live tool calls in `extensions/subagent-render.ts` and aborts the
  child on the parent signal in `extensions/subagent-executor.ts`, but the inspected tool schema
  has no subagent timeout or user-facing control action.
- `@e9n/pi-subagent` captures full child messages and has abort-aware one-shot execution plus
  pool kill operations in `extensions/pi-subagent/src/runner.ts`, `rpc-agent.ts`, `pool.ts`, and
  `tool.ts`. Its timeout is a settings-level value, not yet verified as a parent-set per-child
  value.
- `pi-multiagent` has an operator widget, raw event inspection, cancel control, per-step
  `timeoutSecondsPerStep`, and detailed child event handling. Its own skill says normal live
  assistant and tool activity is not all parent-visible by default, so it needs careful testing
  against the complete-observability requirement.
- `@the-forge-flow/sub-agents-pi` explicitly advertises live tool-call streaming, full transcript
  expansion, an interruptible TUI panel, and per-call tool allowlists in its README and source.
  Its current package surface does not show a parent-set timeout parameter.
- `pi-crew` has a rich dashboard, transcript viewer, cancellation, and a large test suite, but
  its README states that the project is mostly AI-developed and not hardened. The cloned source
  is also materially larger than the other candidates and its timeout controls need to be
  separated from global run, no-output, and workflow-step settings.

## Validation probes

All containerized validation runs used a 2 GB memory cap and 2 CPU cap.

- `mjakl/pi-subagent`: `npm install --no-package-lock && npm test` passed all 37 tests.
  Its test suite does not cover the missing UI control or timeout features.
- `@the-forge-flow/sub-agents-pi`: `npm install --no-package-lock && npm test` passed 136 tests
  across 12 files. `npm run test:coverage` fails because `@vitest/coverage-v8` is not declared.
  Installation reported six dependency vulnerabilities and deprecated `@mariozechner` Pi peers.
- `nicobailon/pi-subagents`: with Git available, 1081 of 1082 tests passed. The repeated failure is
  `test/unit/watchdog-lsp-diagnostics.test.ts`, malformed language-server JSON, with `write EPIPE`
  from `src/watchdog/lsp-diagnostics.ts:318`. A first run without Git had 30 environment-driven
  failures; those disappeared after Git was installed in the disposable container.
- `@e9n/pi-subagent`: typecheck passed and its `node --test` command found zero tests. Installation
  reported one high-severity vulnerability.
- `pi-multiagent`: install without a frozen lockfile added 110 packages, then stopped because pnpm
  ignored build scripts for `@google/genai`, `koffi`, and `protobufjs` pending approval. The clone
  has no `pnpm-lock.yaml`, so the repository's frozen-lockfile validation path is not runnable as
  checked out.
- `pi-crew`: the full test command reached 5991 tests, with 5987 passing, 3 skipped, and one
  failure in `test/unit/settings-store-cov.test.ts` where a root container could write a path the
  test expected to reject. Re-running that file as the mapped non-root user passed all 13 tests;
  the full root-container command was still not green.
- `jwu/pi-subagents`: using the fully qualified Bun image, `bun run lint && bun test` passed
  formatting, typecheck, and 111 tests across 7 files. Bun reported two blocked postinstall
  scripts requiring trust approval.

## Evidence rules

- Do not recommend a candidate from metadata alone.
- Clone serious open-source candidates under `/tmp/agent/` and record exact paths.
- Read production source, tests, CI, dependency manifests, and security-sensitive boundaries.
- Search for fuzzing, property testing, mutation testing, and coverage evidence; record absence explicitly.
- Run each candidate's complete validation task and exercise the Pi integration boundary where feasible.
- Compare code volume, runtime dependencies, architecture shape, security-code concentration, and rendering or generated-code surface.
- Keep the final ranking and rejection reasons in this handover until a decision document is created after user selection.

## Continuation checklist

1. Search Pi docs, npm, and GitHub for meaningful open-source subagent extensions and orchestration examples.
2. Separate true alternatives from generic agent prompts, external launchers, and unrelated spawn tools.
3. Clone finalists and serious alternatives under `/tmp/agent/`.
4. Audit source, tests, CI, dependencies, maintenance, and security boundaries.
5. Run bounded validation and integration probes.
6. Update this file after each evidence phase so context compaction preserves the investigation state.
7. Write `docs/decisions/<project>.md` after the user selects an option.
