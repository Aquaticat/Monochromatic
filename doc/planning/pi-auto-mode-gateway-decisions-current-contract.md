# LLM Gateway Decisions candidate checks

## Scope and authorization

On October 14,
2026,
the user enabled `microsoft-decision-1` and `gpt-6-luna-decisions` on the existing LLM Gateway key.
Exercise that supplied access before resuming other work.
These are compatibility probes for the existing migration,
not production provider adoption.
The five-second deadline,
three-call ceiling,
and 0.99 unique-maximum admission threshold remain unchanged.

## Current contract

The [Gateway guide][guide] places these models on `POST /v1/decisions`.
The [API reference][reference] accepts provider-prefixed model identifiers.
Requests use text input and named question arrays;
answers use arrays and may contain explicit refusals.
Structured state and instructions are serialized as exact JSON text.
Choice criteria become value/description entries;
null descriptions are omitted and restored to null by the probe's inverse mapping.
The offline inverse reconstruction exactly matched the captured original state and all 84 question objects.
This proves information preservation,
not equivalent model interpretation.

Both candidates are managed services reached through the incumbent gateway.
No SDK or executable dependency is added.
Local dependency artifact gates are inapplicable;
provider semantic,
operational,
and contract qualification remain pending.

## Frozen schedule

Private directories are `${HOME}/temp/agent/pi-gateway-microsoft-20261014`
and `${HOME}/temp/agent/pi-gateway-luna-20261014`.
Each pins its provider-prefixed model and first sends the same one-question literal-label Choice control.
Only a complete valid response inside five seconds permits its complete native assessment request.
Every attempt has a five-second deadline,
no automatic retry,
and no represented execution.
Refusals,
unexpected model names,
missing or duplicate answers,
invalid distributions,
and late responses stop that model's schedule.
Only the necessary Mise-resolved key enters the probe process.

The Microsoft control is 361 bytes with SHA-256
`0e0aceb2250961035809393fddaac7844f9a8c85045b5456bfc8e570f9acabcb`;
its complete request is 584,006 bytes with SHA-256
`430ce8f2c1a8ad985b9a823ce937ac08bca5ebbb3fa3a31008cbbc4d35020413`.
The Luna control is 362 bytes with SHA-256
`82cec21afd1d44c96419b519bfff49228cedfe375490641c6ce4bdbb900861da`;
its complete request is 584,007 bytes with SHA-256
`59611db7d2fc22abc491db6bb41fe69bac90769f78c23d1f1409799fa78d4350`.

## Verified access and pending complete-input permission

Automatic approval review rejected the original combined launch before execution:
it treated model enablement as permission to test access,
without permission to export the complete private assessment to the new model destinations.
A concrete permission question named both prepared complete inputs.
The user answered `Authorize both complete-input probes`.
Separate `-complete` directories now dispatch each original frozen complete request once,
reusing the successful controls rather than repeating them.

Separate synthetic-only directories append `-access` before the date.
Their preflight asserts the literal fixture and single question before dispatch.
Both returned HTTP 200 with the exact provider-prefixed model and complete valid Choice answer.
Microsoft returned `permission` at 0.9989888137654562 in 1,805.284 ms,
with confidence 0.9987865765185475 and usage 65 input tokens plus one reported output token.
Luna returned `permission` at 0.99 in 991.616 ms,
with confidence 0.99 and usage 136 input tokens plus zero output tokens.
Both satisfy the numeric cutoff on this literal control.
Neither result establishes policy interpretation,
complete-input capacity,
or repeated-run latency.

[guide]: https://docs.llmgateway.io/features/decisions
[reference]: https://docs.llmgateway.io/v1_decisions
