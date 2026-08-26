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

## Current interface trace

The answer-generating instruction is reinforced at several seams:

1. `package/pi-plugin/advisor/src/tool-params.ts:46` describes `question` as content for Advisor to `answer`.
2. `package/pi-plugin/advisor/src/tool.ts:86` tells the primary model to use `question` when Advisor should `answer`
   an uncertainty.
3. `package/pi-plugin/advisor/src/constants.ts:63` tells Advisor to answer the focus question first,
   then later in the same prompt tells it not to perform the primary task.
4. `package/pi-plugin/advisor/src/advisor-request.ts:55` places the raw string beneath a `## Focus question` heading.
5. `package/pi-plugin/advisor/src/advisor-client.ts:279` sends that text as the only provider user message.
6. `package/pi-plugin/advisor/src/tool.ts:336` extracts all returned text without a semantic or structural check.

The role conflict is therefore produced by the Advisor interface,
not only by one unfortunate model call.
The negative system-prompt guard competes with repeated positive `answer` framing closer to the focus text.

The test surface currently proves transport rather than role preservation:

- `package/pi-plugin/advisor/src/advisor-client.unit.test.ts:205` uses unconstrained fixture text `advisor answer`;
- `package/pi-plugin/advisor/src/advisor-client.unit.test.ts:469` proves only that focus text reaches the provider;
- `package/pi-plugin/advisor/src/advisor-request.unit.test.ts` proves heading placement;
- no Advisor test rejects a task-performing focus request;
- no Advisor test constrains the result to findings about existing evidence.

`package/pi-shared/model-review` already supplies a forced-tool structured-review transport.
Its interface leaves verdict schema,
strict parsing,
prompting,
and interpretation with the caller.
Advisor can reuse that transport without importing goal behavior.
A structured contract would deterministically constrain response shape,
but string fields would still need bounded semantics because a schema alone cannot prove that prose is not a replacement answer.

## Enforcement layers

Prevention has distinct layers with different guarantees:

- **Primary-model ownership guidance** can require a candidate artifact or conclusion before review.
  This changes model behavior but is not deterministic.
- **Input grammar** can remove arbitrary imperative text from the Advisor call.
  An enumerated focus rejects the exact incident request before provider spending.
- **Request encoding** can carry focus as JSON data rather than a user-message instruction heading.
  This reduces prompt role confusion but remains model-dependent.
- **Forced structured output** can make a single review-submission tool the provider's only output path.
  Free text from an omitted tool must never reach the primary model.
- **Strict parsing** can reject unknown fields,
  invalid evidence references,
  excessive findings,
  and overlong strings.
- **Bounded rendering** can expose only validated findings to the primary model.
- **Finding semantics** remain model-dependent unless a separate semantic classifier is added.
  A classifier would add another fallible model call rather than create proof.

The strongest practical design therefore combines deterministic grammar and output-shape constraints with positive reviewer-role
prompting.
No single prompt sentence can supply the guarantee.

## Candidate interfaces under comparison

### Minimal typed review

```typescript
type AdvisorInput = {
  readonly model?: string;
  readonly focus?: 'assumptions' | 'correctness' | 'verification' | 'risk' | 'scope';
};
```

The implementation returns validated findings rather than provider prose.
This removes the free-form instruction channel and keeps empty parameters safe.
Its cost is loss of arbitrary natural-language focus.

### Anchored multidimensional review

```typescript
type AdvisorInput = {
  readonly model?: string;
  readonly focus?: {
    readonly dimensions: readonly AdvisorDimension[];
    readonly target: 'latest-candidate' | 'changes' | 'verification-output' | 'whole-session';
  };
};
```

This preserves more precision without accepting task instructions.
Its interface is wider,
and the primary model must choose target semantics correctly.

### Free-form focus with local intent gate

Keep `question` but reject task-performing language locally and quote it as data.
This preserves flexibility but cannot classify arbitrary natural language soundly.
Verb lists,
regular expressions,
and model classifiers all leave bypasses or false positives.
This candidate currently ranks last.

## Candidate structured result

A review result should contain no general answer field.
The current candidate shape is:

```typescript
type AdvisorReview = {
  readonly assessment: 'clear' | 'findings' | 'insufficient-evidence';
  readonly findings: readonly {
    readonly category: AdvisorDimension;
    readonly evidenceRefs: readonly number[];
    readonly concern: string;
    readonly requiredCheck: string;
  }[];
};
```

The parser must bound array sizes and string lengths,
validate every evidence reference against serialized context,
and reject unknown fields.
The renderer,
not the provider,
creates final review prose.
`requiredCheck` names evidence the primary agent must obtain;
it is deliberately narrower than a replacement or suggested-answer field.

The exact incident would fail at two deterministic seams:
`question` would be unsupported,
and a free-text five-part answer would not be a valid review result.
A malicious or confused model could still place answer content inside a bounded `concern`,
so field bounds and evidence references remain required defense.

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

Collect the independent interface sketches already running in isolated,
tool-free Pi subprocesses.
Compare them by depth,
locality,
seam placement,
and exact-incident prevention.
Then define red tests and rank the final options.

## Commits

- `d159018a8`, `docs(advisor): start answer-substitution handover`, created this live investigation record.
