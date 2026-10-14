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

[models]: https://docs.typesafe.ai/models
[api]: https://docs.typesafe.ai/api
[limitations]: https://docs.typesafe.ai/model-jaggedness/jev-1.13
[legacy]: https://docs.llmgateway.io/features/system-one
[decisions]: https://docs.llmgateway.io/features/decisions
[retention]: https://docs.llmgateway.io/features/data-retention
[provider]: https://llmgateway.io/providers/typesafe
[privacy]: https://typesafe.ai/legal/privacy-policy
