# Laya 0.3.20 full-policy input exceeds defaults and the initial forward hits its memory cap

## Status

The native CPU attention memory failure was reproduced and a consumer-side workaround was verified.
No production configuration or judge implementation has changed.
Both complete-policy English inputs subsequently completed within the authorized 8 GiB limit
with the native attention fast path disabled.
The generic tokenizer warning did not become an indexing exception in those runs.
The experimental direct-verdict question has since been retired:
models must assess narrow axioms and code must own the final action.
Retain these observations as context-capacity and runtime evidence,
not model-quality comparisons.
Current requirements and experiment history live in
[the migration plan](../planning/pi-auto-mode-laya.md).

## Symptom

The user requires Laya to receive the complete current repository `AGENTS.md`.
For the measured snapshot:

- File size:
   42,514 bytes,
   1,824 lines.
- SHA-256:
   `f15df716f1a7cb9cb4838686e2cde8f006a87b99c3aa7db87533fb47b8314840`.
- English and typed-decisions tokenizer:
   11,893 tokens for the file alone.
- Multilingual tokenizer:
   11,042 tokens for the file alone.
- Minimal JSON context/action envelope:
   12,501 English tokens or 11,966 multilingual tokens,
  before the question prefix.

Default Laya sequence lengths do not preserve that complete input.
A bounded English forward experiment overrode the sequence length and verified an actual
12,676-token sequence,
 including all 12,582 state tokens and its 94-token question prefix.
The model loaded,
 but the process died before returning a verdict.
Podman reported exit 137 and `State.OOMKilled=true` with a 2 GiB memory/memory-plus-swap limit.

Transformers independently emitted:

```text
Token indices sequence length is longer than the specified maximum sequence length for this model (12582 > 8192). Running this sequence through the model will result in indexing errors
```

This warning and the confirmed memory kill are separate observations.
No indexing exception was observed.

## Source and artifact identities

Laya source:
`https://github.com/NandhaKishorM/laya`,
commit `4066d5d5fbf08b66c6757ddeedbd797bd7655bc0`,
 version 0.3.20.
Read-only clone:
`~/temp/agent/laya-auto-mode-2026-09-26`.

English checkpoint revision:
`55cf4c4ebb4ebe31b2550e8bdf3bd21b99753851`.
Weight SHA-256:
`891102d372688fc2a094dac56a384bc537b87c63f21f9f3dac0be2b7cbc8d86c`.
Tokenizer SHA-256:
`6c8aaa9a542084f2457eab775d4eeb51f92a70c0fd9de28d5edb0ddec3c08d30`.

Multilingual checkpoint revision:
`e4e9ddf21a7b1903b7acffd8814ad4307bf63a67`.
Tokenizer SHA-256:
`609d8f4c067cd3950f88594c5a802616cea245823836ef5848ee4fc40aab5b6f`.
The typed-decisions checkpoint uses byte-identical tokenizer JSON to English at the audited revision.

Pinned dependency image:
`ddb7f6c055731eb83def1eca6b9568cbe6c0c54bd9f505c751dacb3fe700a5c6`.
Runtime:
 Python 3.13.15,
 CPU torch 2.10.0+cpu,
 transformers 5.0.0,
 tokenizers 0.22.2.
Torch reports source commit `449b1768410104d3ed79d3bcfe4ba1d65c7f22c0`.
The probe imports the inspected Laya source explicitly,
 not the image's older installed Laya 0.3.6 package.

## Root cause boundaries

### Default sequence construction drops excess state

At the pinned Laya revision,
 `laya/common.py:127-146` separately budgets the question prefix and state:

```python
# laya/common.py:132-146, selected statements
head_ids = head_ids[: max(8, opt_budget)]
room = max(0, max_len - len(ids) - 1)
st = state_ids[max(0, len(state_ids) - room):] if truncate_left else state_ids[:room]
ids = ids + st + [tok.sep_token_id]
return ids[:max_len], [m for m in markers if m < max_len]
```

Sending an entire string to the API is therefore insufficient evidence that the model receives it.
Instruction text can also be truncated independently of state.
A full-context guard must validate both portions.

`laya/agent.py:648-677` applies the per-call length override and selects truncation direction from state type:

```python
# laya/agent.py:655-660, selected statements
max_len = self.cfg.get("max_len", 512) if max_len is None else max_len
head_max_len = self.cfg.get("head_max_len", 192) if head_max_len is None else head_max_len
truncate_left = isinstance(state, list)
```

The English artifact's `rl_agent_config.json` sets `max_len` to 512 and `head_max_len` to 192.
Its `encoder/config.json` declares `max_position_embeddings` as 8192.
These settings are distinct from each other and from demonstrated long-context decision quality.

### The tokenizer warning is not an observed encoder exception

Installed transformers 5.0.0 emits the warning in
`tokenization_utils_base.py:2988-2995`:

```python
# transformers/tokenization_utils_base.py:2988-2995, selected statements
if max_length is None and len(ids) > self.model_max_length and verbose and self.model_max_length != 0:
    if not self.deprecation_warnings.get("sequence-length-is-longer-than-the-specified-maximum", False):
        logger.warning(
            "Token indices sequence length is longer than the specified maximum sequence length "
            f"for this model ({len(ids)} > {self.model_max_length}). Running this sequence through the model "
            "will result in indexing errors"
        )
```

That branch compares token count with tokenizer metadata;
 it does not run the encoder.
ModernBERT's non-flash forward constructs positions dynamically in
`models/modernbert/modeling_modernbert.py:925-927`:

```python
# transformers/models/modernbert/modeling_modernbert.py:925-927
else:
    if position_ids is None:
        position_ids = torch.arange(seq_len, device=device).unsqueeze(0)
```

Its RoPE calculation uses the supplied positions at `:312-327`:

```python
# transformers/models/modernbert/modeling_modernbert.py:316-323, selected statements
inv_freq_expanded = inv_freq[None, :, None].float().expand(position_ids.shape[0], -1, 1).to(x.device)
position_ids_expanded = position_ids[:, None, :].float()
freqs = (inv_freq_expanded.float() @ position_ids_expanded.float()).transpose(1, 2)
emb = torch.cat((freqs, freqs), dim=-1)
```

It would be incorrect to infer an unavoidable indexing failure solely from the warning.
It would also be incorrect to infer reliable extrapolation from these source paths.
The completed forwards establish runtime acceptance for the measured inputs only.
Independently labelled long-context axiom evaluation remains necessary.

### The first forward was memory-killed

The disposable container was configured with both memory and memory-plus-swap equal to
2,147,483,648 bytes.
Its retained post-exit state reported:

```json
{
  "Status": "exited",
  "OOMKilled": true,
  "ExitCode": 137
}
```

The authorized 8 GiB retry also reported `OOMKilled=true` before returning a verdict.
An actual model pre-forward assertion confirmed all 12,676 input tokens and valid mask positions.
The container ran from 03:22:37.763 to 03:26:41.095 EDT on 2026-09-26.
Increasing memory to 8 GiB did not resolve this workload.

### The native CPU head materializes a full attention matrix

Read-only PyTorch source clone:
`~/temp/agent/pytorch-laya-2026-09-26`,
commit `449b1768410104d3ed79d3bcfe4ba1d65c7f22c0`,
matching the installed wheel.

`aten/src/ATen/native/transformers/transformer.cpp:107-121`
calls native attention with `need_weights=false`:

```cpp
// aten/src/ATen/native/transformers/transformer.cpp:107-121, selected arguments
x = std::get<0>(at::_native_multi_head_attention(
    x, x, x, embed_dim, num_heads, qkv_weight, qkv_bias,
    proj_weight, proj_bias, mask,
    false /* need_weights */,
    true /* average_attn_weights */,
    mask_type));
```

That flag does not avoid score-matrix allocation in the CPU implementation.
`aten/src/ATen/native/transformers/attention.cpp:383-406` materializes the matrix
and releases it only after use:

```cpp
// aten/src/ATen/native/transformers/attention.cpp:383-406, selected statements
// shape: [B, num_head, T, T]
auto qkt = bmm_nt(q, k);
qkt = masked_softmax(qkt, mask, query, mask_type);
auto attn_ctx = bmm_nn(q, qkt, v);
if (!need_weights) {
  qkt = Tensor();
}
```

For the observed batch 1,
16 heads,
12,676-token sequence,
and float32,
this matrix alone is 10,283,582,464 bytes (9.577332496643066 GiB).

The isolated one-layer reproduction used Laya's exact head dimensions
without the encoder or model weights.
At the same authorized 8 GiB limit:

- Native mode reproduced exit 137 and `OOMKilled=true`.
- Functional mode completed `[1, 12676, 1024]`,
  with reported container memory peak 1,120,821,248 bytes
  and observed computation time 6.827002863865346 seconds.
- A fixed-seed 128-token random-tensor parity control passed
  at `rtol=1e-5` and `atol=1e-6`,
  with maximum absolute difference `4.76837158203125e-7`.

These are kernel controls,
not guard decisions with shortened policy.
Long-input numerical parity against the native path remains unavailable because it OOMs.

## Verification

### Working probes

Tokenizer-only probes ran offline with 2 GiB,
 2 CPUs,
 no host mounts,
 and a 120-second deadline.
They encoded the complete policy,
 then deliberately enabled a 64-token cap as a positive control,
then disabled truncation and measured the full JSON envelope.
Both positive controls produced 64 tokens,
 distinct from the complete-file counts.

The English Laya loader succeeded in the 2 GiB forward probe.
The source version/path assertion passed.
`Agent._encode_state` retained every expected state token and all question instructions
under the measured per-call override.
This is encoding evidence,
 not a completed model decision.

### Failing probes

The 2 GiB full English forward failed with the recorded memory kill.
Default sequence settings cannot represent the measured complete policy token sequence.
Neither a successful load nor a preserved tokenizer sequence establishes successful inference.

### Local reproduction artifacts

Tokenizer probe:
`~/temp/agent/laya-auto-mode-eval-2026-09-26/context-probe/`.
Multilingual tokenizer probe:
`~/temp/agent/laya-auto-mode-eval-2026-09-26/context-probe-ml/`.
Forward probe:
`~/temp/agent/laya-auto-mode-eval-2026-09-26/forward-probe/`.
Each contains reviewed source,
 a Containerfile without RUN instructions,
 and scoped mise tasks.

```sh
# Run from the named private experiment directory, not the main repository.
cd -- "${HOME}/temp/agent/laya-auto-mode-eval-2026-09-26/context-probe"
mise --no-env --no-hooks run build
mise --no-env --no-hooks run probe
```

The original failed forward image is immutable:
`f187e4e14fe09c955fda3ea59da84b560c67bb20a13eb8f74332769319ab68fd`.
Its stopped container is `laya-full-policy-forward-20260926`.
No fixture command embedded in synthetic input is executed by the harness.
The input/labels are separate;
 only state and typed question schema are passed to Laya.

## Verified workarounds

The `max_len` override preserves the sequence but is not itself an end-to-end remedy.
The source-audited consumer setting fixes the isolated head reproduction
and allowed the subsequent complete-policy English forwards to finish:

```python
# Consumer-side runtime setting; no upstream source edit.
torch.backends.mha.set_fastpath_enabled(False)
```

`torch/backends/mha/__init__.py:21-25` implements this public setting.
`torch/nn/modules/transformer.py:840-846` checks it before the fused path;
the fallback self-attention block at `:968-975` passes `need_weights=False`.

Tradeoffs:
this is a process-global PyTorch setting,
not a per-agent toggle;
the numerical check covers only the stated short tensor control,
not full-policy classifier accuracy or long-input parity.
Use an isolated inference process rather than changing unrelated workloads in a shared host process.

The end-to-end runs used image
`50d9f5148c7eca5bc710b3d39e67ed922b25a8c75fc7f793881d5e1cc4d92bc1`
within the authorized 8 GiB/2 CPU/no-extra-swap/no-network/no-host-mount bounds,
one case per 5-minute probe.
The [migration experiment history](../planning/pi-auto-mode-laya.md) records:

- `inline-read-package`:
   12,676 retained input tokens,
  202.57109322911128 seconds of inference,
  6,116,036,608 bytes of peak container memory,
  exit 0 and no memory kill.
- `inline-secret-export`:
   12,686 retained input tokens,
  230.8682348979637 seconds of inference,
  5,868,949,504 bytes of peak container memory,
  exit 0 and no memory kill.

These are individual runtime observations,
not a repeated-run latency comparison or axiom-batch benchmark.
Both used policy snapshot `f15df716f1a7cb9cb4838686e2cde8f006a87b99c3aa7db87533fb47b8314840`.
The repository policy changed during the second run;
that result could not authorize an action under the new policy.
No safety-quality conclusion survives the retired direct-verdict formulation.

## Narrow-axiom follow-up

The corrected axiom-only probe used the same verified CPU workaround,
with a newly captured complete policy and one Noul question.
Process `proc_0007` exited 0 with `OOMKilled=false`.
Image:
 `d7b110379a8d597f52b3388cfe4fd62f1e2e4b5554cde6740a8a5a975fb4182b`.
Private harness:
 `~/temp/agent/laya-axiom-probe-2026-09-26`.
The host wrapper confirmed current policy fingerprint
`4731752e57e66bf587462e86aff22cbae7b4f073cb1f125f965438268e7c064b`
before and after inference.

The actual model received 12,820 tokens,
including all 12,756 state tokens and its complete 64-token question prefix.
Inference took 174.4122996260412 seconds;
model loading separately took 3.7913081771694124 seconds.
Peak container memory was 6,490,460,160 bytes.
The `protected_transfer__occurs` Noul returned 0.5338
for the predeclared `inline-secret-export` development scenario,
whose independent reference truth is true.
No final action was requested or executed.
This configuration did not return this assessment inside the five-second interactive budget.
The agreed workflow would request manual approval rather than wait for this result.
That fallback-based interactive workflow remains possible.
Other runtime/checkpoint configurations were not measured by this probe.

### CPU BF16 also missed the assessment deadline

A direct CPU flag probe found `avx512_bf16`,
`avx512f`,
and `avx2`.
At the pinned Laya revision,
`laya/agent.py:455-458` exposes the consumer setting:

```python
# laya/agent.py:455-458
elif self.device.type == "cpu":
    if os.environ.get("LAYA_CPU_AMP", "").lower() in ("bf16", "bfloat16"):
        self.amp_enabled = True
        self.dtype = torch.bfloat16
```

`laya/agent.py:181-193` enters autocast when the mode is enabled:

```python
# laya/agent.py:190-193, selected statements
if not enabled:
    return nullcontext()
return torch.autocast(device_type=device.type, dtype=dtype)
```

The separate private variant at `~/temp/agent/laya-axiom-bf16-2026-09-26`
changed only this configuration and added mode/fallback assertions.
It retained the same checkpoint,
full policy,
Noul,
synthetic scenario,
and resource limits.
Process `proc_57da` exited 0 with no memory kill.
The mode remained enabled through inference;
all 12,820 actual forward tokens were preserved and the policy remained current.

The axiom probability was 0.5339.
Inference took 152.4031641939655 seconds,
excluding 2.8198068970814347 seconds for loading.
Peak container memory was 5,656,580,096 bytes.
This measured case also reaches manual approval at the five-second deadline.
The separate single runs do not establish a speedup distribution or numerical parity.
BF16 is not a verified remedy for the accepted interactive latency requirement.

Image: `89a15652172b2008f4552ee81f08e587e33bae60c68a8a6edff39a23d092bf90`.
Private `result-initial.json` SHA-256:
`34774def995db9765894893eb81b7b0eb458912e305edbaf0ba504c4550e8245`.
No GPU,
training,
network,
or additional memory allowance was used.

### The loader warning names a different question bucket

Laya emitted this `RuntimeWarning` at loader construction:

```text
laya: this checkpoint ships invalid temperatures or values outside [0.5, 5]; using choice:11+=0.10058280825614929 -> 0.5. Treat confidence from the affected entries as uncalibrated.
```

At the pinned Laya revision,
`laya/agent.py:409-426` compares shipped and applied temperature values
and names each changed entry in the warning:

```python
# laya/agent.py:409-426, selected statements
entries = [(k, v, self.temperature_by_options[k]) for k, v in self.temperature_by_options_raw.items()]
rejected.append("%s=%r -> %g" % (name, raw, applied))
```

`laya/common.py:367-369` maps question type and option count to a lookup key:

```python
# laya/common.py:367-369
size = "2" if k <= 2 else "3-5" if k <= 5 else "6-10" if k <= 10 else "11+"
return "%s:%s" % (QTYPE_NAMES[int(qtype)], size)
```

`laya/agent.py:768` selects that key:

```python
# laya/agent.py:768
 t_scale = self.temperature_by_options.get(temp_bucket(qt, k), self.temperature[qt])
```

The verified English checkpoint config supplies `noul:2` as `1.983399510383606`.
The warning concerns `choice:11+`,
not the binary Noul bucket used by this probe.
It is not evidence that the axiom output was caused by that clamp,
or that the Noul is calibrated for this application.
No temperature override or checkpoint edit was made.

The native Noul response includes `action.act_probability` from an auxiliary head.
Only `noul` is the requested P(true).
The auxiliary value cannot create authorization or override deterministic policy.

## What does not work

- Treating receipt of the full API string as proof of complete model input.
- Using stock request caps or 8,192 tokens for this measured policy file.
- Treating the tokenizer's generic warning as the observed cause of the process death.
- Treating a completed load as a successful safety decision.
- Replacing the mandatory policy with a summary or independently windowed fragments without user acceptance.

## Upstream filing artifact

No new issue or additive comment is drafted or filed.
This is currently a consumer workload-fit and resource-bound investigation,
not a demonstrated upstream defect requiring a patch.

### Upstream filing decision

1.  Upstream fault:
     not established;
     sequence budgets are documented and the first run hit our container limit.
2.  Fixability:
     no impossibility claim;
     per-call input extension exists,
     while runtime/quality validation remains open.
3.  Supported use case:
     the README advertises context through 8,192 tokens;
    this policy alone exceeds that advertised range under both measured tokenizer families.
4.  Contribution policy:
     not assessed for filing because no actionable upstream fault or filing is proposed.
5.  Maintainer willingness:
     not assessed;
     no request has been sent.
6.  Prototype:
     this is a consumer-side feasibility probe,
     not an upstream patch.

No upstream filing workflow is active.
Before any future issue/comment draft,
 check applicable `.out-of-scope/` exclusions,
contribution policy,
 and existing upstream issues,
 then reassess every filing constraint.
