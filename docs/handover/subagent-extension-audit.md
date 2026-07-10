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
