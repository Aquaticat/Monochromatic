# Respan Span-01 rejects user-role span output

## Symptom

On 2026-09-28,
`POST https://api.respan.ai/api/v1/scores` with model `span-01-free`
returned HTTP `422` for a selected user request placed in `span.output`:

```json
{"detail":"bad span: span output must be an assistant message"}
```

The private canary retained this response in
`~/temp/agent/respan-auto-mode-eval-2026-09-28/pilot-result.json`,
commit `8b7bdf6`.
This is a request-format refusal,
not a model-quality result or evidence that the supplied key is invalid.

## Root cause and evidence boundary

The owned `pilot-contract.mjs:9` serializer put the selected request in a user-role output:

```javascript
// Private canary: pilot-contract.mjs
output: { role: 'user', content: fixture.evidenceText },
```

The [scoring reference][scores],
read on 2026-09-28,
describes `span.output` as the single turn to evaluate,
"usually the assistant's reply",
and describes `Span1Message.role` as an optional string.
The initial interpretation that this permitted user-role output was wrong for the observed endpoint.
The server response explicitly requires an assistant message.
The hosted server implementation and immutable serving revision were not inspected;
no internal call chain or model-execution claim follows from the status code.

The same reference's example detects user frustration from a user message in `span.input`.
Consequently the correction keeps selected user wording in input rather than falsely relabeling it as assistant speech.
Definitions explicitly target the final input user message.
Complete policy and the code-supplied operation remain separate system context.

## Verification

The initial request included complete current policy,
but received the quoted `422`.
A separately frozen correction received HTTP `200` and valid native triples:

Original source is `425d58a`;
its input freeze is `813501b`.
Corrected source is `ef1bca2`;
its input freeze is `097f056`,
and successful result is `d309fe5`.

The Linux workstation ran Node `v26.10.0` against direct Respan,
with scoped `AUTO_MODE_RESPAN_API_KEY` only.
Complete policy had 42,677 bytes,
SHA-256 `4731752e57e66bf587462e86aff22cbae7b4f073cb1f125f965438268e7c064b`.
The corrected request had 48,212 bytes;
the returned input-token count was 13,151.

The corrected assessment took `609.983842` ms,
including preparation and final source/policy checks,
excluding module/process startup and result-file writing.
Native probability triples passed finite-number,
range,
ID/order,
model,
and sum checks with frozen sum tolerance `0.00001`.

The executed corrected command was:

```bash
# Historical canary, invoked from the main repository root
MISE_AUTO_INSTALL=false mise --no-hooks exec --no-deps --fresh-env \
  --allow-env AUTO_MODE_RESPAN_API_KEY -- node --max-old-space-size=128 \
  /home/user/temp/agent/respan-auto-mode-eval-2026-09-28/corrected/run-pilot.mjs
```

These controllers intentionally create new evidence files and refuse to overwrite them.
A repeat requires a separately frozen run,
not deletion of the retained files.
No repeat is planned for this canary.
No fixture read operation was executed.

One accepted request is not semantic qualification,
a general latency guarantee,
a measured context-window limit,
or proof that the hosted service preserves every input token internally.

## Verified workaround

The corrected `corrected/pilot-contract.mjs:7` constructs this boundary:

```javascript
// Private canary: corrected/pilot-contract.mjs, structural excerpt
input: [...original.span.input, { role: 'user', content: fixture.evidenceText }],
output: {
  role: 'assistant',
  content: 'No assistant action is represented by this synthetic fixture.',
},
```

The selected request remains user speech.
The required assistant turn is fixed synthetic padding,
not execution evidence,
a permission grant,
or a reference answer.
The tradeoff is an additional synthetic turn in model context;
qualification must use this actual serialization rather than assume equivalence to another provider's state format.

## What does not work

- Putting a user-role message in `span.output` produced the retained `422`.
- Metadata status and filtered-model endpoints returned `403` with the provided key,
  although the corrected scoring request succeeded.
  Metadata refusal therefore did not establish scoring unavailability.
- The metadata controllers' narrow diagnostic allowlist discarded the actual refusal wording.
  Its cause remains unknown;
  do not attribute it to credits or authentication.
- Treating `p_not_observable` as absent permission,
  absence of a behavior,
  or removable probability mass is not supported by the native contract.

## Upstream filing decision

No issue or message was sent.
The `.out-of-scope/` filename inventory contained no Respan-specific entry;
no upstream draft or duplicate search was started because vendor contact is outside this bounded evaluation.

1.  Upstream fault is not established;
    the rejected request used an unsupported output role.
2.  Documentation could state the output-role requirement explicitly;
    no server implementation change has been assessed.
3.  Detecting user behavior in input is documented;
    user-role output is not explicitly promised.
4.  Contribution policies were not investigated;
    no filing is authorized.
5.  Maintainer willingness is unknown;
    no refusal or commitment is inferred.
6.  The client-side layout correction is verified,
    but it is not an upstream patch.

Nothing is fileable from this bounded contract finding.

[scores]: https://respan.ai/docs/apis/respan-models/score-span-behaviors.md
