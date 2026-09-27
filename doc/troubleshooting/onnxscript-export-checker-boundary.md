# ONNX Script 0.7.2 compatibility checker does not validate exported models

## Status and symptom

This is a source-only finding during the private Laya ONNX investigation.
No ONNX export,
candidate-package import,
or resulting runtime failure has been reproduced.
The risk is treating PyTorch's successful checker-status branch as proof that a graph passed structural validation.
Do not confuse this with the separately measured Laya CPU latency or attention-memory results.

## Source identities

PyTorch 2.10 is pinned at `449b1768410104d3ed79d3bcfe4ba1d65c7f22c0`.
ONNX Script 0.7.2 is pinned at `082bfa28e959a4c0639d91b62663c6c59c4dfc42`.

Private evidence lives at `~/temp/agent/laya-onnx-source-audit-2026-09-27`.
Its source ledgers are `torch-exporter-ledger.json`,
`runtime-boundary-source-ledger.json`,
`release-followup-source-ledger.json`,
and `build-details-source-ledger.json`.

Third-party checkouts were not edited.
Git objects were materialized into the owned evidence directory for reading.

## Root cause boundary

PyTorch `torch/onnx/_internal/_lazy_import.py` names the
`onnxscript._framework_apis.torch_2_9` facade.
Its `check_model` import delegates through the `torch_2_8` and `torch_2_6` facades
into `torch_2_5`.
The selected function in `onnxscript/_framework_apis/torch_2_5.py:61-68` explicitly does no validation:

```python
# onnxscript/_framework_apis/torch_2_5.py:61-68
def check_model(model: ir.Model) -> None:
    """No-op retained for API compatibility.

    This intentionally performs no validation. Running the ONNX checker here was
    dropped because it can report false positives and adds overhead to export.
    """

    del model  # Intentionally unused: this function performs no validation.
```

No replacement implementation was installed or executed.

When verification is enabled,
PyTorch `torch/onnx/_internal/exporter/_core.py:1576-1581` calls that facade:

```python
# torch/onnx/_internal/exporter/_core.py:1576-1581, selected statements
onnxscript_apis.check_model(onnx_program.model)
export_status.onnx_checker = True
```

Under this source combination,
normal return from that function does not establish an ONNX structural-checker result.
This does not imply that every verification stage is disabled.
The same PyTorch source separately invokes ONNX Runtime output verification at line 1619.
Its error/status/return handling also requires separate review;
a flag named `verify` is not by itself a strict artifact-publication condition.

## Verification and limits

### Working evidence

- The delegated source paths were resolved from pinned Git objects.
- The actual runtime image's missing ONNX dependency records were measured without candidate imports.
- Wheel hashes,
  target-tag controls,
  and the separate ONNX wheel's signed source attribution passed their recorded checks.
  None is a graph-correctness test.

### Unverified execution cases

- An invalid graph returning through the actual imported compatibility facade.
- The same graph being rejected by the actual `onnx.checker` API.
- A valid exported graph passing an independently invoked checker and numerical parity test.
- Failed verification leaving artifacts that the consumer correctly refuses to promote.

These cases remain pending the dependency/native execution gates.
No clean/failing runtime catalog or exported-graph correctness claim is asserted yet.
See the [qualification record](../planning/pi-auto-mode-laya-qualification.md#python-onnx).

## Verified workarounds

None yet.
The planned consumer must invoke structural checking explicitly,
validate numerical parity independently,
identify every graph/external-data artifact,
and promote only after all required checks pass.
That is an unexecuted requirement,
not a verified workaround or production implementation.

## What does not work as evidence

- The facade's function name does not establish that it calls an ONNX checker.
- `export_status.onnx_checker = True` alone does not establish structural validation with this dependency version.
- A successful artifact download,
  compatible wheel tag,
  or verified build attribution does not establish model correctness.
- No evidence here establishes that all PyTorch or ONNX Script versions behave this way.

## Upstream filing artifact

Nothing to file from this source-only finding.
No new upstream issue or comment was sent.

### Upstream filing decision

#### Upstream fault

Not established.
The compatibility function explicitly documents its deliberate no-op behavior.

#### Fixability

Relevant source is available,
but no defect requiring a change has been reproduced.

#### Supported use

Export compatibility is supported;
mandatory structural validation is not promised by this function's current body/docstring.

#### Contribution policy

Not assessed for a filing because no reportable defect has been established.

#### Maintainer intent

The source explicitly says the checker was removed for false positives and overhead.
Do not infer agreement to restore it.

#### Prototype

None.
The conditions requiring an upstream-fix prototype are not satisfied.
