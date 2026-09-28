# Drex API v1.1 full-policy requests report v1.0

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
An explicitly requested v1.0 semantic study is the next frozen measurement,
not an already verified direct-pin result at this checkpoint.

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
