# Drex API full-policy routing and request compatibility

## Drex 2.0 rejects the complete native question batch

### Current contract recheck on 2026-10-14

The [current factual recheck](../planning/pi-auto-mode-drex-current-contract.md)
finds changed published Drex 2.0 context limits and an explicit no-fallback statement.
The hosted 512-question documentation still conflicts with the retained 16-question rejection.
Public source remains at `be8ba7c8157241b9393862e9fcec104d0dc5caff`
and does not contain the deciding hosted guard.
Its local `requests` batch envelope does not establish support on the hosted route.
No new provider call or verified workaround follows from the documentation change.
The prepared 16/17-question synthetic control needs separate execution permission;
the existing upstream filing decision remains unchanged.

### Symptom

On 2026-10-13,
the hosted `POST https://console.nace.ai/v1/systemone` endpoint returned 422 for a disposable native Pi request
containing the complete current policy and 244 questions.
The requested model was `drex-v2.0`.
The original wire failed with `questions.head_0.instructions: must be a string`.
Its issue list reports the same instruction-type failure for every question.
After lossless conversion of instruction objects to JSON text,
the response was `too many questions (244); limit is 16`.
Neither rejected response reported a serving model.

### Cause and source boundary

The owned Jev adapter supplies structured instruction objects.
The current [hosted question schema](https://console.nace.ai/docs/drex/guides/questions)
requires strings.
The first error is therefore an adapter incompatibility.

The second error conflicts with the current
[hosted limits](https://console.nace.ai/docs/drex/reference/limits),
which document 512 questions.
The deciding hosted implementation is not published in the inspected source checkout.
The read-only `nace-ai/drex-decision-models` checkout at
`be8ba7c8157241b9393862e9fcec104d0dc5caff` contains a different local request schema.
At `kev/api.py:51`:

```python
# nace-ai/drex-decision-models, kev/api.py:51
    questions: dict[str, Question] = Field(min_length=1)
```

A repository-wide hidden and ignored-file search for the exact diagnostic,
question-limit identifiers,
and the documented limit found no hosted guard.
The local schema is not evidence for the cause of the hosted limit.
The observation establishes rejection of this request,
not a universal model limit or a model-quality result.

### Verification

The private qualification repository retains `contract/research/drex-2.0-recheck`:
request manifests,
create-new runners,
and results.
The [release audit](../audit/tech-pi-auto-mode-drex-2-release-vet-2026-10-13.md)
records source hashes,
explicit payload consent,
execution bounds,
and exact returned labels.

The frozen original phase ran `mise run probe` once.
The separately frozen schema follow-up ran `mise run probe:text` once.
These tasks need fresh result destinations before a separately authorized repeat;
the retained runners refuse to overwrite evidence.
Both use five-second deadlines and no retries.

Working controls:

- The constant-state API control returned 200 and `model: drex-v2.0`.
- The complete 32,553-byte policy supplied once returned 200 and `model: drex-v2.0`.
- Local round-trip assertions recovered all original instruction objects from the converted strings,
  with unchanged state,
  criteria,
  questions,
  and original provider request.

Failing controls:

- The complete native wire with structured instructions returned the field-type 422.
- The converted 692,952-byte wire retained all 244 questions and returned the question-limit 422.

### Verified handling and rejected approaches

Keep the incumbent route while completing native integration.
This avoids adopting a model whose complete native request did not pass the serving gate;
it does not establish new semantic-quality evidence for the incumbent.

`JSON.stringify` on each instruction object resolves the observed field-type rejection,
as verified by the next response reaching the question-limit check.
It does not make the complete request accepted or qualify the text representation semantically.

Splitting 244 questions into groups of 16 requires 16 calls,
exceeding the accepted three-call ceiling.
No such dispatch was made.
Removing policy,
dropping sources,
or omitting questions would change the required assessment and was not attempted.

### Upstream filing decision

Nothing is filed or drafted for the bounded release check.

1.  Upstream fault: the field-type error belongs to the owned adapter;
    the question-limit response differs from hosted documentation,
    but its deciding code is unavailable.
2.  Upstream fixability: unknown without that code;
    no impossibility or fix-size claim is made.
3.  Supported use: hosted documentation covers text instructions and question batches up to 512.
4.  Contribution policy: not investigated because no external report is proposed.
5.  Willingness to change: unknown;
    no maintainer communication was sent.
6.  Prototype: the owned conversion was executed and retained;
    no source-justified hosted patch can be built from the inspected local runtime.

## Historical Drex v1.1 full-policy responses report v1.0

## Symptom

Requests naming `drex-v1.1` returned HTTP 200 with `model: "drex-v1.0"`.
The observed inputs included complete 42,677-byte `AGENTS.md`,
a synthetic selected source,
a code-owned read operation,
and the existing independent relation/prohibition questions.
Both calls completed within one `1984.5333979999998` ms assessment clock.

This is not a v1.1 quality measurement.
A successful HTTP response does not make the requested version the answering version.

## Documented boundary and observed cause limits

The [evaluation reference][evaluate] says:

> `drex-v1.1` takes a state plus longest question of up to 4,096 tokens;
> longer requests are answered by `drex-v1.0`,
> and the response `model` reports `drex-v1.0`.

The provider describes a length-dependent route from a v1.1 request to a v1.0 response.
The [model reference][models] also makes the broader statement:

> A pinned id is always answered by that version at that version's price.

The general pin statement cannot safely be applied without the documented long-input exception.
The observed responses agree with that exception.
Hosted routing source and actual serving weights were not inspected;
this is an API-contract and observed-label finding,
not a source-level proof of the internal routing cause.
Reported input-token totals also count multiple questions,
so they are not independently measured state-plus-longest-question lengths.

The first-party prototype explicitly distinguishes requested and returned labels.
At private source commit `564d544`,
`~/temp/agent/nace-drex-auto-mode-eval-2026-09-28/protocol.mjs:8` to `9` declares:

```js
// Private experiment: protocol.mjs
export const REQUESTED_MODEL = 'drex-v1.1';
export const SERVED_MODELS = ['drex-v1.0', 'drex-v1.1'];
```

At `protocol.mjs:32`,
it rejects undeclared labels before extracting Noul values:

```js
// Private experiment: protocol.mjs
assert(SERVED_MODELS.includes(value.model), 'Undeclared Drex response model');
```

The retained result includes `requestedModel`,
`servedModelLabel`,
and `differsFromRequestedModel`.
Both retained request bodies still name v1.1;
no additional first-party fallback request was made.

## Verification

Service response version:
`drex-v1.0`.
Requested version:
`drex-v1.1`.
Date:
2026-09-28.
Private source/input commits:
`564d544` and `496dfac`.
Raw result:
`e639234`.

The historical invocation was:

```bash
# Run from /var/home/user/Monochromatic; historical invocation, not a command to repeat over retained evidence.
MISE_AUTO_INSTALL=false mise --no-hooks exec --no-deps --fresh-env \
  --allow-env AUTO_MODE_NACE_DREX_API_KEY -- \
  node /home/user/temp/agent/nace-drex-auto-mode-eval-2026-09-28/run.mjs
```

The harness uses create-new result files.
Reproduction requires a separately frozen experiment copy;
do not delete old evidence to rerun it.

### Working observations and controls

- The model-list GET authenticated with HTTP 200.
- Both full-policy scoring calls returned valid native Noul answers under the predeclared v1.0 observation label.
- Request bodies were 45,914 and 46,131 bytes.
- Source,
  policy,
  full body,
  and raw-response checks passed.
- Fake transport accepted declared v1.0/v1.1 labels and distinguished them.
- `proc_fc6e` rechecked evidence without another model call.

### Rejected controls and failed interpretation

- Undeclared model labels,
  missing/extra answers,
  invalid Noul values,
  and invalid usage metadata were rejected locally.
- Preparation expiry dispatched no request.
- A late aggregate was rejected;
  omitting that guard exposed acceptance in an isolated copy.
- Reading `model: "drex-v1.1"` in the request as proof that v1.1 answered conflicts with both retained responses.

Result SHA-256:
`3e18de5385d1a2433db6b7c20f96d4330b08b74f7bc4e383d90caab647548a5d`.
Manifest SHA-256:
`0728f866798c5961297b7f8829bbc84bc89888e8e71ff696059944dc7c79179e`.

## Verified caller handling

The canary predeclared the documented response-label set,
validated it,
and retained the actual answering label without relabeling it as v1.1.
The tradeoff is explicit:
this permits a v1.0 observation in a routing probe,
not use of that observation as evidence for a required v1.1 deployment.
A production version requirement remains a separate gate.

Do not shorten or summarize policy to manufacture a v1.1 result.
The full-policy requirement remains unchanged.
The subsequent [36-call semantic study](../planning/pi-auto-mode-drex-qualification.md)
explicitly requested v1.0 and received v1.0 labels throughout.
That verifies the direct-pin path only for the recorded calls.
Its tradeoff is explicit:
it measures v1.0 rather than v1.1,
and its tested semantic profile failed the predeclared gate.
A correct model label alone does not establish suitability.

## What does not work

- Treating general pinned-version prose as sufficient serving-version evidence.
- Attributing the measured Noul values or timing to v1.1.
- Treating a version label as independent proof of exact serving weights.
- Treating the canary as calibration,
  general deadline compliance,
  or semantic qualification.

## Upstream filing decision

No upstream filing or draft is made.
There is no established hosted-code defect in this bounded observation.

1.  Upstream fault:
    the route is explicitly documented;
    the broader pin prose is in tension with it,
    but a code defect was not established.
2.  Upstream fixability:
    no source-level implementation or fix-size claim was investigated.
3.  Supported use:
    the official API documents both typed Noul evaluation and the long-input route.
4.  Contribution policy:
    not investigated because no external report is proposed.
5.  Willingness to change:
    unknown;
    no inference from silence or documentation age.
6.  Prototype:
    caller-side label handling and controls were executed;
    no upstream code patch was required or attempted.

The task's finite-evidence boundary does not reopen an upstream source-audit branch.
The durable outcome is the verified caller boundary and its limits.

[evaluate]: https://drex.nace.ai/docs/api-reference/systemone
[models]: https://drex.nace.ai/docs/reference/models
