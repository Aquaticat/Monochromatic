# PyTorch 2.10 ONNX export can refine a requested dynamic shape despite fallback being disabled

## Symptom and scope

A parameter-free `Unflatten(1, (2, 2))` fixture accepts an input shaped `[1, 4]`.
The probe requested its second input dimension as `Dim('sequence', min=2, max=8)`.
Direct `torch.export.export` rejected that incompatible range.
The combined `torch.onnx.export` call returned with `fallback=False`,
but its returned program had no dynamic range constraints and its ONNX input dimension was fixed at `4`.
The ONNX structural checker accepted that fixed-shape graph.

This is a producer-contract distinction,
not an invalid ONNX graph or evidence that all exporter versions behave the same way.
It is separate from the
[ONNX Script compatibility checker boundary](onnxscript-export-checker-boundary.md).
No Laya checkpoint or ONNX Runtime inference was involved.

## Source identities and call chain

PyTorch 2.10 source is pinned at `449b1768410104d3ed79d3bcfe4ba1d65c7f22c0`.
Runtime Torch was `2.10.0+cpu` in image
`67e3fbe2fe272445ac3503daf9b606bcfb2215d286df77da3cf6103571a01fb8`.
The frontend was ONNX 1.23.0,
ONNX Script 0.7.2,
ONNX IR 1.0.0,
ML dtypes 0.6.0,
and Python-backend protobuf 7.36.2.
Third-party checkouts were read,
not edited.

`torch/onnx/_internal/exporter/_core.py:1342-1360` distinguishes an existing exported program
from a module requiring capture:

```python
# torch/onnx/_internal/exporter/_core.py:1342-1360, selected statements
if isinstance(model, torch.export.ExportedProgram):
    program = model
else:
    for strategy_class in _capture_strategies.CAPTURE_STRATEGIES:
        result = strategy(model, args, kwargs, dynamic_shapes=dynamic_shapes)
```

The non-strict strategy in `_capture_strategies.py:219-243` catches a capture `UserError`,
refines shapes from the suggested fixes,
and calls capture again:

```python
# torch/onnx/_internal/exporter/_capture_strategies.py:227-243, selected statements
except torch._dynamo.exc.UserError as exc:
    new_shapes = torch.export.dynamic_shapes.refine_dynamic_shapes_from_suggested_fixes(
        exc.msg, dynamic_shapes
    )
    return torch.export.export(
        model,
        args,
        kwargs=kwargs,
        dynamic_shapes=new_shapes,
        strict=False,
        prefer_deferred_runtime_asserts_over_guards=_flags.PREFER_DEFERRED_RUNTIME_ASSERTS_OVER_GUARDS,
    )
```

The strict strategy has the corresponding retry at `_capture_strategies.py:172-188`.
These are capture-strategy calls,
not the legacy fallback guarded in `_compat.py:170-213`:

```python
# torch/onnx/_internal/exporter/_compat.py:170-213, selected statements
except Exception as e:
    if fallback:
        torch.onnx.utils.export(...)
    else:
        raise
```

Therefore `fallback=False` does not describe every internal capture attempt or freeze the original shape request.
The probe did not instrument the refinement helper:
its output establishes the changed contract,
while this source trace identifies the available retry/refinement path.
The omitted arguments in these excerpts are unchanged in the pinned source;
these excerpts are source explanations,
not runnable patches.

## Verification

Private evidence is under
`~/temp/agent/laya-onnx-source-audit-2026-09-27/export-laya`.
Source/manifest commit `7e3e4a7` precedes execution;
raw input,
stdout/stderr,
result,
and graph bytes are retained at `d53a844`.
The exercised task was `mise --no-env --no-hooks run test:export-laya-capture` in that private repository.
Its create-new records prevent blind reruns.

Process `proc_68ff` passed inside a read-only,
network-disabled container with two GiB memory,
no added swap or host mounts,
two CPUs,
64 pids,
256 descriptors,
and a 60-second runtime ceiling.
Graphs remain quarantined.

### Working catalog

- Direct capture of `Identity` with the requested range retained actual constraint `s81: 2..8`.
- Its Torch exported program accepted a second fixture shaped `[1, 6]`.
- ONNX conversion of that existing exported program retained a symbolic second input axis.
- Explicit ONNX checking accepted the converted graph.
- Direct fixed-shape capture of `Unflatten(1, (2, 2))` produced the expected `[1, 2, 2]` Torch output.
- The combined ONNX wrapper returned a structurally valid fixed-shape graph for the constrained fixture.
  That success does not satisfy the requested variable-range contract.

### Rejected direct range

Direct capture of the constrained fixture with range `2..8` raised `UserError`.
The diagnostic includes:

```text
Constraints violated (sequence)! For more information, run with TORCH_LOGS="+dynamic".
  - You marked sequence as dynamic but your code specialized it to be a constant (4).
```

The retained complete diagnostic recommends a fixed `sequence = 4` among its suggested fixes.
The quoted line is the opening clause of the longer diagnostic line;
`capture-result.json` preserves the unabridged text.
The combined wrapper's measured result had `ranges: []` and dimensions `[1, 4]`.

### Artifact identity

`direct.onnx` has 741 bytes and SHA-256
`6f2b4d06e8a987269a341ac0e761caf317e518627027d6849aedeb8a591bb55e`.
`combined.onnx` has 3,610 bytes and SHA-256
`0841aa7c5c5933cd82c399e1c48e986ecd59cf82dc79f16fec54f1a289104b6d`.
Both companion data files were empty.
No numerical ONNX output parity or consumer-side range enforcement was tested.

## Verified consumer-side boundary

The control exercised explicit capture followed by conversion of the resulting program:

```python
# export-laya/capture-controls.py, inside the contained experiment
program = torch.export.export(
    model,
    inputs,
    dynamic_shapes=shapes,
    strict=False,
    prefer_deferred_runtime_asserts_over_guards=False,
)
torch.onnx.export(
    program,
    (),
    '/out/direct.onnx',
    input_names=['x'],
    output_names=['y'],
    dynamo=True,
    verify=False,
    fallback=False,
    optimize=False,
    report=False,
    profile=False,
    external_data=True,
    opset_version=18,
)
onnx.checker.check_model('/out/direct.onnx')
```

The control also checked the actual captured range and converted input dimension.
This composition rejects the demonstrated conflict before ONNX conversion,
rather than relying on the combined wrapper to retain the original request.
Its tradeoff is rejection instead of automatic shape refinement;
some modules may therefore need an explicitly revised input contract or different producer implementation.
No such revision is silently accepted here.

The direct call's deferred-runtime-assert setting was explicitly false,
whereas pinned ONNX `torch/onnx/_flags.py:51-55` defaults its strategy setting to true:

```python
# torch/onnx/_flags.py:51-55
PREFER_DEFERRED_RUNTIME_ASSERTS_OVER_GUARDS: bool = _load_boolean_flag(
    "TORCH_ONNX_PREFER_DEFERRED_RUNTIME_ASSERTS_OVER_GUARDS",
    this_will="set prefer_deferred_runtime_asserts_over_guards when calling torch.export",
    default=True,
)
```

The controls qualify the demonstrated composition,
not an isolated causal comparison of that flag or a Laya exporter.
Actual graph/input constraints still require validation before a consumer admits an artifact.

## What does not establish the requested contract

- `fallback=False` alone does not rule out the observed shape refinement.
- A successful structural checker does not establish the originally requested dynamic range.
- A requested axis name does not establish the emitted axis's actual shape or range.
- The source-defined `Dim` API does not prove a particular model supports every requested dimension.
- These controls do not qualify full-policy Laya semantics,
  numerical parity,
  assessment latency,
  or ORT provenance.

## Upstream filing artifact

Nothing to file from this consumer-boundary investigation.
No issue or comment was sent,
and no upstream patch is proposed.

### Upstream filing decision

#### Upstream fault

Not established.
The source intentionally refines shapes from suggested fixes;
the measured graph is valid for its emitted fixed shape.
The defect would be our consumer mistaking that success for its unchanged requested contract.

#### Fixability

Source is inspectable,
but no upstream defect requiring repair was established.
The demonstrated consumer composition does not modify upstream code.

#### Supported use

The pinned APIs explicitly accept modules and exported programs.
The controls exercised both routes within their declared fixture scope.

#### Contribution policy

Not assessed for a filing because no reportable upstream defect or draft was established.

#### Maintainer intent

The retry/refinement branch is explicit in the implementation.
No maintainer preference for removing it is inferred.

#### Prototype

The consumer-side composition is exercised.
It is not an upstream fix prototype;
the conditions requiring one are not met.
