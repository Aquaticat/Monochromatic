# Pi auto-mode Laya migration interview

## Status and authority

Design interview in progress.
The user requested migration to [Laya] and explicitly requested grilling before implementation.
Do not implement until shared understanding is confirmed.
No dependency, production configuration, or runtime changes have been made for this task.

[Laya]: https://github.com/NandhaKishorM/laya

## Confirmed motivation

The user's answer to Q1:

> reduce costs and werid-looking requests to coding plan providers.

Cost and provider-facing request patterns are the target.
The initial assistant suggestion about autonomous task completion was not the user's stated objective.
Auto-mode is a tool-call safety guard, not task-completion orchestration.

## Evidence gathered

`package/pi-plugin/auto-mode/README.md` describes the current flagger, judge, and approval pipeline.
`package/pi-plugin/auto-mode/src/evaluate.ts` checks reusable session approvals before resolving a judge model.
It asks the user when model resolution or judging fails.
`package/pi-plugin/auto-mode/src/judge.ts` sends structured-tool requests through shared model-review code
and retries using direct JSON when no verdict tool call appears.
These paths are relevant to request volume and request shape.
Actual provider call counts, costs, and account-policy implications have not been measured.

The current upstream Laya README advertises typed decisions rather than generated explanations.
It also documents input-window limits, overconfidence, and negation failures.
These are upstream statements, not local runtime validation.
They motivate source inspection and guard-specific evaluation before adoption.
No claim of safety parity, cost savings, or adequate local performance has been established.

## Decision frontier

### Q2: Provider boundary

Settled: A.
Auto-mode must make zero coding-plan judge requests, including fallback.
The main coding agent's normal provider traffic is outside this boundary.
Whether a separate metered API may receive escalation remains unanswered.

### Q3: Safety and interruption tradeoff

Settled: A.
Additional manual approvals are acceptable when needed to preserve safety.
Cutover does not require retaining the current level of automatic handling.
Keep deterministic safety checks and require human approval when the local decision lacks validated support.
Do not treat model confidence alone as proof of safe authorization.

## Research still required

- Inventory every consumed auto-mode responsibility and assign its future owner and parity test.
- Inspect provider selection, fallback, session reuse, trust directives, bypass, and headless behavior.
- Inspect the exact Laya inference, tokenization, serving, dependency, model-artifact, and test paths.
- Probe available deployment hardware before choosing a runtime or host.
- Establish a labelled guard-action corpus, including negation and adversarial inputs.
- Measure current judge calls and costs without exporting private transcripts.
- Define deployment, error handling, explanations, rollout, rollback, and acceptance criteria.
- Complete applicable technology vetting before recommending Laya as a safety decision authority.

## Next action

Inspect the incumbent policy surface and Laya input and deployment boundaries.
Ask whether metered-API escalation is acceptable.
Recompute the remaining interview frontier from the source findings.
Keep implementation blocked until the complete design is confirmed.
