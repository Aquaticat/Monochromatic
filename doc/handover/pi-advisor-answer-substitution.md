# Pi Advisor answer-substitution prevention handover

## Status

Investigation is active.
This handover was created before further source investigation at
`2026-08-25T23:58:24-04:00` from repository commit
`3210ce1ef86d3fbdd9e42afeef56b79c4ade2d24`.
The worktree was clean at creation.

The observed Advisor call completed successfully at the transport level but crossed its reviewer role:
it supplied a near-final five-part answer while reviewing a simple primality task.
No prevention design has been accepted or implemented.

## User requirements

- Explain what can prevent Advisor from substituting an answer for independent review.
- Investigate the Advisor interface, prompt, request path, and verification surface.
- Keep this handover current throughout the investigation.
- Limit this session to `package/pi-plugin/advisor` and directly shared Advisor dependencies.
- Do not investigate or change `package/pi-plugin/goal` because another session owns that work.

## Observed session

The source session is:

```text
/home/user/.pi/agent/sessions/--var-home-user-Monochromatic--/
2026-08-26T03-35-46-248Z_01a03c23-5f48-778f-8306-b30a1fddddd2.jsonl
```

The primary model was `openai-codex/gpt-5.6-luna`.
At JSONL line 12 it called Advisor without an explicit model and with this focus question:

> Review the planned answer: give exactly five valid, clearly distinct explanations that 67 is prime,
> including trial division/factor-pair reasoning, a 6k±1 reduction, Wilson's theorem with a verifiable
> factorial congruence, and a Lucas primality certificate. Check all modular arithmetic and theorem use.

The empty model selection chose `openai-codex/gpt-5.6-sol` by the configured highest-expected-cost policy.
The result at JSONL line 13 mixed valid review findings with replacement content:

- It correctly reported that no completed five-part answer or fifth method was present.
- It checked arithmetic and theorem use.
- It instructed the primary model to use exactly five named methods.
- It supplied detailed proof text, including an elliptic-curve certificate absent from the primary model's work.

Measured call details from the stored tool result are:

- duration: `523412` milliseconds;
- serialized context: `2201` characters of a `958088` character budget, not truncated;
- estimated input: `772` tokens;
- provider input: `854` tokens;
- provider output: `18093` tokens, including `17132` reasoning tokens;
- provider total: `18947` tokens;
- provider-reported cost: `$0.54706`;
- visible Advisor text: `2612` characters and `294` whitespace-delimited words.

The TUI text `772 tokens full` describes estimated request input and truncation state.
It does not describe visible response length.
`package/pi-plugin/advisor/src/rendering-summary.ts` formats that metadata.

## Established cause before deeper investigation

The caller's focus question was not a narrow uncertainty.
Its imperative `give exactly five` directly requested primary-task content.
The call therefore presented Advisor with a role conflict.

The built-in Advisor system prompt nevertheless states:

```text
Do not perform the primary task. Do not write final user-facing prose for the primary agent.
```

That guard is in `package/pi-plugin/advisor/src/constants.ts`.
The selected model failed to preserve it.
The response is therefore not intended Advisor behavior, even though the malformed focus question made the drift more likely.

Current source exposes a free-form optional `question` string and returns unrestricted model text.
The interface has no structural distinction between a review request and a request to perform the task.
The prompt prohibition is not enforced by a result contract or postcondition.

## Investigation questions

- Which caller guidance would cause the primary model to ask defect-seeking questions only after concrete evidence exists?
- Should the public parameter remain `question`, become a narrower review-request type, or disappear?
- Can a structured result contract express verdict, findings, evidence, and next checks without becoming a shallow interface?
- Should Advisor transform task-performing focus text into a review rubric, reject it locally, or ask the model to reject it?
- Which positive prompt wording keeps review behavior salient without repeating answer-generation concepts through negation?
- Which protections are deterministic, and which still depend on model instruction following?
- What red tests reproduce the observed caller request and answer-substitution output shape?
- Which shared model-review module can be reused without coupling Advisor to goal behavior?
- How should default cost and reasoning policy change, if at all, for low-risk review calls?

## Constraints

- This is an investigation and design request.
  Do not mutate production code until the user explicitly accepts or delegates a design.
- Keep changes in this session to this handover and other requested planning documents.
- Preserve Advisor as an independent reviewer rather than turning it into a general subagent.
- Prefer a deep Advisor interface that hides prompt construction, selection, transport, and validation.
- Do not treat prompt wording alone as deterministic enforcement.
- Do not claim prevention from a test that only checks static prompt text.
- Verify behavioral protections with a model or deterministic transport capable of emitting forbidden replacement content.

## Current hypotheses

These are hypotheses, not decisions:

1. Replace open-ended `question` semantics with a review contract that asks for defects against supplied evidence.
2. Add a local intent gate that rejects or normalizes task-performing review requests before provider spending.
3. Use structured Advisor output with bounded fields for verdict, findings, evidence references, and primary-agent next checks.
4. Keep the system prompt as defense in depth, rewritten around positive reviewer actions.
5. Add characterization tests for the exact observed focus question and result shape.
6. Reconsider highest-expected-cost and maximum-reasoning defaults separately from role enforcement.

## Rejected conclusions

- The result was not caused by context truncation.
  Stored details record `truncated: false`.
- `openai-codex/gpt-5.6-sol` was not explicitly requested.
  Default selection chose it.
- The Advisor extension is not designed to provide final answers.
  Its source prompt says the opposite.
- The incident is not only a provider-model defect.
  The caller interface admitted and encouraged an answer-generating focus question.

## Exact next action

Trace the complete Advisor interface from main-model guidance through parameter normalization,
request construction,
provider completion,
result extraction,
and tests.
Record every enforceable seam and every prompt-only seam in this handover before comparing designs.

## Commits

No handover commit exists yet.
Commit this initial checkpoint before beginning the next investigation step.
