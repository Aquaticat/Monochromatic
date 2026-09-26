# Laya 0.3.20 full-policy input exceeds defaults and the initial forward hits its memory cap

## Status

Investigation in progress during the Laya-only auto-mode migration interview.
No production configuration or judge implementation has changed.
No successful full-policy model verdict has been established at this checkpoint.
The user authorized a subsequent 8 GiB experiment;
its result is not assumed here.
Current requirements and experiment history live in
[the migration plan](../planning/pi-auto-mode-laya.md).

## Symptom

The user requires Laya to receive the complete current repository `AGENTS.md`.
For the measured snapshot:

- File size: 42,514 bytes, 1,824 lines.
- SHA-256: `f15df716f1a7cb9cb4838686e2cde8f006a87b99c3aa7db87533fb47b8314840`.
- English and typed-decisions tokenizer: 11,893 tokens for the file alone.
- Multilingual tokenizer: 11,042 tokens for the file alone.
- Minimal JSON context/action envelope: 12,501 English tokens or 11,966 multilingual tokens,
  before the question prefix.

Default Laya sequence lengths do not preserve that complete input.
A bounded English forward experiment overrode the sequence length and verified an actual
12,676-token sequence, including all 12,582 state tokens and its 94-token question prefix.
The model loaded, but the process died before returning a verdict.
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
commit `4066d5d5fbf08b66c6757ddeedbd797bd7655bc0`, version 0.3.20.
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
Runtime: Python 3.13.15, CPU torch 2.10.0+cpu, transformers 5.0.0, tokenizers 0.22.2.
Torch reports source commit `449b1768410104d3ed79d3bcfe4ba1d65c7f22c0`.
The probe imports the inspected Laya source explicitly, not the image's older installed Laya 0.3.6 package.

## Root cause boundaries

### Default sequence construction drops excess state

At the pinned Laya revision, `laya/common.py:127-146` separately budgets the question prefix and state:

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

That branch compares token count with tokenizer metadata; it does not run the encoder.
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
An actual completed forward and independently labelled long-context evaluation remain necessary.

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

The precise tensor allocation responsible has not been identified.
No claim is made that increasing memory will resolve every possible long-context failure.

## Verification

### Working probes

Tokenizer-only probes ran offline with 2 GiB, 2 CPUs, no host mounts, and a 120-second deadline.
They encoded the complete policy, then deliberately enabled a 64-token cap as a positive control,
then disabled truncation and measured the full JSON envelope.
Both positive controls produced 64 tokens, distinct from the complete-file counts.

The English Laya loader succeeded in the 2 GiB forward probe.
The source version/path assertion passed.
`Agent._encode_state` retained every expected state token and all question instructions
under the measured per-call override.
This is encoding evidence, not a completed model decision.

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
Each contains reviewed source, a Containerfile without RUN instructions, and scoped mise tasks.

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
The input/labels are separate; only state and typed question schema are passed to Laya.

## Verified workarounds

No successful full-policy inference workaround has been verified at this checkpoint.
The `max_len` override preserves the sequence but is not yet a working end-to-end remedy.
The user authorized an 8 GiB/2 CPU/no-extra-swap/no-network/no-host-mount retry,
with a 5-minute deadline and one inference container at a time.
Do not report that retry as successful until its actual result is captured.

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

1.  Upstream fault: not established; sequence budgets are documented and the first run hit our container limit.
2.  Fixability: no impossibility claim; per-call input extension exists, while runtime/quality validation remains open.
3.  Supported use case: the README advertises context through 8,192 tokens;
    this policy alone exceeds that advertised range under both measured tokenizer families.
4.  Contribution policy: not assessed for filing because no actionable upstream fault or filing is proposed.
5.  Maintainer willingness: not assessed; no request has been sent.
6.  Prototype: this is a consumer-side feasibility probe, not an upstream patch.

No upstream filing workflow is active.
Before any future issue/comment draft, check applicable `.out-of-scope/` exclusions,
contribution policy, and existing upstream issues, then reassess every filing constraint.
