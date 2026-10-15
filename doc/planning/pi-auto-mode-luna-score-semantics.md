# Luna choice probability and confidence

## Question and scope

The user asked whether the current `0.80` threshold is applied to the correct quantity.
This October 14,
2026 note establishes the external response contract.
The separate implementation trace owns which returned field actually reaches admission.
No inference request,
production edit,
or new acceptance rule is part of this research.

## The returned fields answer different contract questions

The [OpenAI Decisions guide][guide] describes Choice as selecting a supplied option
and returning a probability distribution over the options plus a separate `confidence` field.
In plain language,
each option's probability describes the model's allocation to that candidate answer.
`confidence` is another returned quantity about the answer;
it is not the selected option's probability under another field name.
The guide's illustrative choice has winning probability `0.95` and confidence `0.93`.

The [API reference][reference] lists `confidence` as a number alongside `choice` and `probabilities`.
It does not provide a confidence formula,
define a separate correctness event for that number,
or establish statistical independence from the option probabilities.
Calling it a separate field is supported.
Calling it an independent estimator of correctness would exceed the inspected contract.

The guide tells application authors to choose thresholds using labeled application examples
and the costs of false positives and false negatives.
It does not prescribe `0.80`,
require that cutoff on confidence,
or say one numeric cutoff is interchangeable across these fields.
The reference also permits a per-question refusal;
refusal handling remains separate from a numeric threshold.

## What Gateway does with the fields

The [Gateway Decisions guide][gateway-guide] exposes both per-option probabilities and confidence.
Its example has a selected probability of `0.88` and confidence `0.81`.
That example establishes the distinction in its public wire shape,
not calibration for our input.

The [gateway source repository][gateway-source] was inspected at
`ebbeaf029ec4fbddf1a23ae03e46bf7c1c7d9259`,
reconfirmed as public `main` during this refresh.
In `apps/gateway/src/decisions/decisions.ts:198`,
OpenAI selects the native Decisions branch.
At line 324,
the normalizer preserves upstream response fields with an object spread and replaces the model label.
It does not recalculate option probabilities or confidence in that branch.
This is source evidence;
the hosted deployment's matching revision is unestablished.

## Implication for the threshold question

The [current local decision](../decision/pi-auto-mode-semantic-admission.md)
defines admission of a supported selected meaning at `0.80` with a unique lead.
Comparing the selected meaning's returned probability with that boundary is consistent with
a threshold on support for that meaning.
It is not a check that the separate `confidence` field reaches `0.80`.
Neither field alone establishes that the entire proposed operation is authorized.

Adding a confidence boundary would be an additional acceptance condition,
not a naming correction.
Replacing the probability boundary with confidence would define a different condition.
For example,
a hypothetical answer with selected probability `0.90` and confidence `0.70`
passes a probability-only `0.80` boundary but fails a confidence `0.80` boundary.
This is an illustration of the predicates,
not an observed Luna response or a recommendation to change admission.

The response contract therefore supports keeping the quantities distinct and naming the field being thresholded.
It does not by itself establish which condition best meets this application's error tolerance.
That conclusion requires the local question definitions,
actual admission consumers,
and labeled examples rather than renaming probability as confidence.

[guide]: https://developers.openai.com/api/docs/guides/decisions
[reference]: https://developers.openai.com/api/reference/resources/decisions/methods/create
[gateway-guide]: https://docs.llmgateway.io/features/decisions
[gateway-source]: https://github.com/theopenco/llmgateway
