# Jev contract refresh and workaround boundaries

## Scope

Primary documentation was rechecked on October 14,
2026,
for the user's question about encountered Jev problems and possible workarounds.
This is a documentation refresh,
not another model experiment or production adoption.
The [observed failures and source controls](../troubleshooting/llmgateway-systemone-boundaries.md)
remain historical evidence at their recorded revisions.

## Capacity and representation

The [current model reference][models] still lists `jev-1.13.0`,
64k tokens for state plus all questions,
and 32k for state plus the longest question.
Its published rate limits are 100K tokens per second and 80 requests per second,
explicitly subject to change.
These native limits do not establish this gateway account's exact usable boundary.

Our retained full-rule trials rejected 454,012-byte and 315,353-byte requests with
`max_tokens_exceeded`.
A revised 256,710-byte encoding succeeded once with 205 answers and 62,053 reported input tokens.
It removed duplicate bookkeeping and relocated shared guidance without dropping rules.
That is verified acceptance of one representation,
not proof of semantic equivalence or universal capacity.
The error did not identify which token bound failed.

The [native API reference][api] permits structured `instructions` and criteria.
Question-map keys are excluded from inference.
Consequently,
an identifier alone cannot carry the rule's meaning.
Structured instructions are a documented mechanism,
not a tested repair for our calibration errors.

## Semantic limitations

The [Jev limitations page][limitations],
reviewed by its publisher on October 2,
2026,
warns about literal interpretation,
indirection,
irrelevant context,
adversarial state,
contradictory criteria,
unreliable counting and date arithmetic,
and Choice option-order bias.
These are vendor disclosures;
this refresh did not reproduce them.

Direct questions and aligned criteria are mitigation candidates.
Code can own exact arithmetic,
date comparisons,
and established syntax facts.
Neither shorter prompts nor larger batches establish correctness.
The complete-current-policy requirement prevents treating policy truncation as an accepted workaround.
Our recurring pathname and other-file mistakes still need their own negative controls.

## Gateway changes and residual uncertainty

The [System One feature page][legacy] now announces upcoming deprecation of `/v1/systemone`.
It says existing integrations keep working and Jev remains available at the same price on `/v1/decisions`.
No retirement date is stated there.
This is an announced interface change,
not an encountered outage.

The [migration guide][decisions] changes keyed question maps to named arrays,
`noul` to `predicate`,
and `noul` answers to `probability`.
Structured state must be serialized into text.
A migration therefore needs fresh request,
response,
deadline,
and semantic checks;
this refresh neither exercised nor adopted it.

The retained gateway source controls establish model-label normalization,
same-provider credential retries,
missing-answer acceptance,
and conditional preservation of echoed upstream errors in metadata-only logging.
They do not establish those behaviors in today's hosted revision.
Consumer response validation can reject malformed or incomplete evidence.
A local deadline can stop our wait;
it cannot establish upstream cancellation or final billing.
Version pinning cannot attest hosted weights.

Current [retention documentation][retention] still separates payload clearing from retained analytics metadata.
It now restricts retain-all to Enterprise,
with existing non-Enterprise organizations switching to metadata-only on November 8,
2026.
Neither that announcement nor a default setting resolves the historical error-diagnostic concern.
The [TypeSafe provider entry][provider] still labels prompt logging and retention Unknown.
The [TypeSafe privacy policy][privacy] prohibits training on submitted input while permitting necessity-based retention.
Those are different promises.
No account setting was inspected or changed,
and the user's accepted retention scope remains settled.

## Encountered failures and practical mitigation

The retained evidence supports different answers for capacity,
semantic correctness,
and owned integration defects.

### Capacity has a partial verified workaround

Shared guidance and removal of duplicate bookkeeping produced one accepted complete 205-question input.
Further representation work must preserve every policy and received source,
original question meaning,
and code-owned source identity.
Moving text into shared state does not establish unchanged model behavior.
Splitting questions can address the aggregate question budget only if each complete state still fits
the separate state-plus-longest-question bound and the original call/deadline budget.
It cannot solve an oversized mandatory state by itself.
No provider-side context increase is verified.

### Semantic errors can be contained but are not repaired by a cutoff

The [earlier frozen study](pi-auto-mode-jev-qualification.md#observed-binding-errors)
returned `0.93` for permission to read `.env` contents when the source only permitted listing that pathname
and reading `README.md`.
The [instruction-condition study](pi-auto-mode-jev-qualification.md#real-instruction-condition-development-result)
returned `0.93` and `0.16` for byte-identical unused-configuration input.
Replaying until a favorable answer appears is therefore not a verified remedy.

Code-owned syntax and effect facts,
narrow source-language questions,
explicit criteria,
and abstention are mitigation mechanisms.
The [fresh locked test](pi-auto-mode-jev-fresh-qualification.md#counts-and-coverage)
had zero resolved errors at its 95/05 diagnostic band but left 77 of 216 claims unresolved.
That result neither erases the earlier false positive nor qualifies the later categorical question definitions.
The [adopted current cutoff](../decision/pi-auto-mode-semantic-admission.md)
is `0.99`,
with unresolved meanings blocking execution.
It is an operating rule,
not a measured accuracy guarantee.

The current Choice warning matters to this implementation:
`package/pi-plugin/auto-mode/src/clause-lowering.ts` places `permission` first in `CLAUSE_RELATIONS`.
The wire preserves that label order.
This establishes a concrete order-sensitivity test candidate,
not a reproduced current false approval.
The existing unit tests verify admission arithmetic and structure,
not provider invariance under reordered options.
No label reorder or additional paid study is adopted by this assessment.

### Current installed failures include owned integration defects

The installed check first rejected ordinary single-call syntax,
then encountered an omitted optional effect-owner callback.
Those were owned host defects and were corrected with local regressions;
they are not Jev model failures.
A subsequent run hit our one-MiB serialized-request guard before inference.
Increasing that guard alone cannot establish fit within Jev's independent token bounds.

The latest installed attempt reached LLM Gateway and returned HTTP 400.
`package/pi-plugin/auto-mode/src/assessment-transport.ts:238`
replaces non-200 response detail with a status-only error.
The retained log therefore cannot establish that this particular response was `max_tokens_exceeded`.
A proposed next diagnostic change is to expose only recognized provider error codes,
without logging upstream free text,
credentials,
or source content.
It is not implemented by this research task.

### Working order

First retain a recognized cause for the current HTTP 400 and measure the exact current input.
Then test content-preserving representation changes against both Jev context bounds.
Semantic mitigation remains a separate concern and must retain abstention and original authority checks.
The announced Decisions migration is maintenance work;
the current documentation does not establish that it increases Jev's context capacity or repairs semantic errors.
No production fix or migration is authorized by this analysis alone.

## Implementation follow-up and shared-state fit

The user subsequently requested continued implementation and renewed standing authorization
for task-relevant Drex and Jev inputs and credit use.
The transport now retains the recognized `max_tokens_exceeded` code without upstream free text.
An installed Qwen run reproduced that precise rejection for the complete current native request.
The captured original contains 73 source occurrences and 84 questions in 504,946 bytes.
The lossless shared-content prototype reconstructs every original state field and question instruction.
Its 165,373-byte complete request still returned `max_tokens_exceeded` in 1,269.832 ms.
It is not installed or semantically qualified.

The frozen follow-up at `${HOME}/temp/agent/pi-jev-shared-state-fit-20261014`
distinguishes serving availability from the complete shared state's capacity requirement.
It makes at most two sequential calls,
each with a five-second deadline,
and stops on rejection or response-validation failure without retry.
The first is a 312-byte public literal-label serving control.
The second retains the exact 125,822-byte shared state and unchanged `head_0` question,
for a total of 126,345 bytes.
Its SHA-256 is `287fb871e3b7a8f5ad511dc5355670769bec70b76f8db5261153224a71ec3b3f`.
The shared state retains the complete original context and all original question instructions;
only the dispatched question map is narrowed for this diagnostic.

Rejection of this single-question input would rule out merely splitting the same shared-state request
as a sufficient capacity remedy.
Acceptance would justify further complete-coverage split tests,
without proving that every other question fits or establishing semantic equivalence.
No result authorizes a represented action or changes the production provider,
cutoff,
or deadline.

Both frozen requests were dispatched once.
The serving control returned HTTP 200 in 1,357.310 ms,
with the requested model,
333 reported input tokens,
and the literal `permission` label at `1`.
This is a serving and parser control,
not semantic qualification.
The complete shared state with only `head_0` returned HTTP 400 `max_tokens_exceeded` in 731.176 ms.
Merely splitting that unchanged shared-state request therefore cannot solve its capacity rejection.
The exact token count and which provider bound fired remain unavailable.

Local inspection identifies a representation-specific contributor worth measuring:
the prototype stores every original question's instructions inside `state.root.questionInstructions`.
Those instructions are required by the assessment,
but their placement inside shared state is an experimental encoding choice.
The next local candidate moves each original encoded instruction back into its own question
while preserving the complete governing state and shared-content dictionary.
It must round-trip exactly before any separate provider experiment.
This is not permission to remove questions or source occurrences.

The placement candidate now passes exact reconstruction of the original state and all 84 questions,
including every one of the 73 source occurrences.
Its shared dictionary is unchanged.
The state measures 105,339 bytes;
the complete request measures 140,618 bytes with SHA-256
`342c62860872a1f084157f700a34d7bf27bbf95ffae3a2eb81c6cb057897853e`.
The frozen private schedule at `${HOME}/temp/agent/pi-jev-question-placement-20261014`
first sends that complete batch with a five-second deadline.
Only HTTP 400 with recognized `max_tokens_exceeded` permits the separate single-question capacity control.
That control retains the candidate's entire shared state,
measures 105,761 bytes,
and has SHA-256 `9bc4ef519973fd9d05c7e69e57690a5e6d615de97c2f6ff0bbed3ea6c517bd05`.
There are at most two calls,
no retries,
and no production admission.

Both placement requests completed with HTTP 400 `max_tokens_exceeded`.
The complete batch took 1,049.183 ms;
the single-question control took 518.147 ms.
Neither returned model answers.
Moving the instructions is insufficient even for one question with the complete shared state.
The private directory retains both original responses and result records.
No further request is scheduled by this experiment.

[models]: https://docs.typesafe.ai/models
[api]: https://docs.typesafe.ai/api
[limitations]: https://docs.typesafe.ai/model-jaggedness/jev-1.13
[legacy]: https://docs.llmgateway.io/features/system-one
[decisions]: https://docs.llmgateway.io/features/decisions
[retention]: https://docs.llmgateway.io/features/data-retention
[provider]: https://llmgateway.io/providers/typesafe
[privacy]: https://typesafe.ai/legal/privacy-policy
