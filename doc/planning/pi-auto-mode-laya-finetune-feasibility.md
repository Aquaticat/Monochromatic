# Laya fine-tuning feasibility for auto-mode axioms

## Conclusion and authority

Laya exposes trainable encoder and decision-head boundaries,
and published code demonstrates training mechanisms for typed questions.
That establishes a source-supported path to an experiment,
not a demonstrated remedy for this guard's probabilities or latency.
No optimizer step,
training run,
GPU allocation,
new checkpoint download,
or publication was performed in this assessment.
No training method or dependency is selected.

The [corrected native Noul baseline](pi-auto-mode-laya-qualification.md#corrected-native-noul-observations)
uses supplied operation facts and request-text predicates,
not Bash reconstruction.
Its observations do not establish whether fine-tuning is necessary,
whether a frozen encoder contains sufficient transferable features,
or whether either training mechanism would produce a qualified probability profile.
The two request states are not a training/calibration/final-qualification corpus.

The user authorized all task-relevant assessment content through LLM Gateway/Jev,
not Laya training,
rented compute,
ongoing capture,
other-provider uploads,
or production cutover.
Do not seek dashboard or Mac access.
Do not train Laya on Jev outputs.
Candidate investigation still precedes further integration-policy interviewing.

## Primary source boundaries

The [Laya source](https://github.com/NandhaKishorM/laya) is pinned at
`4066d5d5fbf08b66c6757ddeedbd797bd7655bc0`,
version 0.3.20,
in `~/temp/agent/laya-auto-mode-2026-09-26`.
Laya-relative paths in this note refer to that clone.

The Laya README also points to [stuntd](https://github.com/bladedevoff/stuntd).
It was read as a Laya head-training precedent,
not promoted as another assessor candidate or selected dependency.
The read-only clone is
`~/temp/agent/stuntd-laya-finetune-source-2026-09-27`,
revision `102a63116ef597231e3b2aa1455dea583e099cc0`.
Its manifest declares 0.1.1 and its inspected license is Apache-2.0.
No stuntd installation,
server,
capture,
training,
or test suite was executed.
Stuntd-relative paths refer to that clone.

## What the inspected training code supports

### Encoder and head adaptation

Laya's notebook
`notebooks/laya_finetune_typed_decisions_2xT4_kaggle.ipynb:110-132`
converts Noul references into false/true target distributions.
An independently authored binary reference can therefore be represented as a two-entry target;
there is no need to train on final approve/deny labels.
Missing labels must not use the notebook's default 0.5 values as a substitute for unknown evidence.

At notebook lines 275-282,
the optimizer receives both parameter groups:

```python
# notebooks/laya_finetune_typed_decisions_2xT4_kaggle.ipynb
enc_params = [p for n, p in ddp_model.named_parameters() if "encoder." in n]
head_params = [p for n, p in ddp_model.named_parameters() if "encoder." not in n]
optimizer = torch.optim.AdamW([
    {"params": enc_params, "lr": LR_ENCODER},
    {"params": head_params, "lr": LR_HEAD}
], weight_decay=0.01)
```

The inspected recipe does not freeze the encoder.
Its loop combines a noisy-logit policy-gradient objective with soft cross-entropy guidance
at lines 319-340.
These are learning objectives for the typed outputs,
not evidence that this guard's semantics or operating regime have been learned.

### Detached or frozen encoder with head training

`laya/common.py:176-196` contains an explicit gradient boundary:

```python
# laya/common.py
h = self.encoder(input_ids=input_ids, attention_mask=attention_mask).last_hidden_state
if detach_encoder:
    h = h.detach()
```

The encoder still runs.
Detachment is not a shortcut that omits inference encoding.
The same forward path supports non-reentrant checkpointing for head layers during gradient-enabled training.
`tests/test_head_checkpointing.py:106-144` covers detached encoder gradients,
frozen head inputs,
and bypass during evaluation/no-grad.
Those tests were read,
not run:
their helper performs backward and optimizer steps.
They do not establish full-policy training memory or correctness on the actual checkpoints here.

A concrete separate trainer exists in stuntd.
`stuntd/train/trainer.py:177-193` freezes encoder and action-head parameters;
`_HEAD_PREFIXES` retains the transformer head,
scorer,
and type embedding.
Its `_fit` at lines 340-360 uses cross-entropy over those trainable parameters.
The optional cache at lines 276-332 records frozen encoder outputs for training epochs.
That training cache is not a serving-latency result:
`stuntd/serve/decider.py:204-218` still calls the model forward path when its score computation is invoked.

This is a mechanism inventory,
not a ranked implementation menu.
No head-only quality improvement or local training-memory fit is measured.

## Why the published recipes are not guard qualification

### Input retention and grouping

The [model-free preparation investigation](../troubleshooting/laya-finetune-input-boundaries.md)
exercised the inspected Laya notebook's preparation and splitting code without training.
It observed a 512-token saved item,
no restoration after changing worker configuration,
and 1,024 tokens only after explicit re-encoding;
the complete control required 12,553 tokens.
Retained option markers did not prove retained state.

The same investigation showed exact calibration-item exclusion but permitted sibling questions
from one state to occur in both training and calibration.
The synthetic overlap measurement is not a measurement of the published dataset's bias.
The guard needs grouping at its underlying state/family boundary,
not an item-index split silently adopted as independent qualification.

Stuntd does not solve those requirements by speaking the Jev protocol.
Its `site_row` at `stuntd/train/trainer.py:73-77`
uses `build_sequence` with a stored layout.
`stuntd/train/layout.py:25-50` constructs a `choice` question and widens the option budget,
not a complete-policy retention assertion.
Thus this trainer is also a different question representation from the measured native Noul profile.
It needs independent format and probability validation.
Its exact-text deduplication and time split in `stuntd/train/dataset.py:88-101`
do not themselves enforce the guard's scenario/family partition.
No real stuntd dataset overlap was measured.

### Calibration and the serving path

The current Laya notebook withholds exact calibration item indices before optimization
and removes inherited option-count buckets when exporting its per-type fit.
Do not repeat the historical same-item-fit claim as current notebook behavior.
Published checkpoints remain separate artifacts.

There are additional fit/serve conditions to qualify.
The notebook's `fit_one_temp` at lines 202-218 can return values clamped to 0.1 through 10.
`laya/common.py:376-390` applies a serving interval of 0.5 through 5.
A future fitted value must be checked after loading and runtime normalization;
this interval difference does not prove any unrun fit would land outside the serving interval.
The current Noul baseline did not change or fit temperatures.
Its unrelated `choice:11+` warning must not be attributed to its Noul values.

The notebook performs CUDA FP16 autocast at lines 306-315 and 393-403,
whereas the measured CPU inference profile uses BF16.
That difference is a validation requirement,
not an assertion that either precision is faulty.

Stuntd's `_evaluate` at `stuntd/train/run.py:105-136`
fits temperature,
selects its operating point,
and reports agreement/calibration metrics on the same holdout logits.
Its reported holdout is not a separate final set untouched by calibration and threshold selection.
Those metrics must not be adopted as independent guard qualification.
The guard's own policy thresholds and final actions remain code-owned.

### Data rights and collection

The [typed-decisions dataset card](https://huggingface.co/datasets/LocalLLaMA/typed-decisions)
describes teacher agreement rather than independent correctness.
No benchmark gold or provider output was adopted as this guard's training labels.

Stuntd advertises provider-answer capture and distillation,
as well as manual row import.
Its capture controls do not grant permission to collect ongoing traffic or train on Jev outputs.
That advertised teacher workflow is not authorized here.
The code was inspected only as evidence of an existing training boundary.

The [browser-specialization record](https://huggingface.co/cklxx/laya-browser/blob/642bacc1cb65f55c0af6e0e1178b6d48634a327a/code/finetune/README.md)
reports another task and a shortened state representation,
including a 1,500-character page-text component and relocated options.
It is an author-reported specialization example,
not independent guard evidence or permission to shorten mandatory policy.
Its accuracy,
training duration,
and device timings are not estimates for this task.

## Resource and execution limits

The Laya notebook explicitly launches two workers for its Kaggle T4 environment
at lines 443-457,
uses NCCL/CUDA initialization at lines 221-227,
and uses microbatches of eight at lines 266-278.
It is not the bounded CPU inference recipe already measured here.
CUDA API spelling alone does not establish an NVIDIA-only impossibility on other builds;
no AMD training/runtime fit was tested.

The observed inference peaks and stored tensor counts do not establish training memory.
Gradients,
optimizer state,
activations,
checkpoint recomputation,
precision,
and any encoder cache remain unmeasured for a training run.
Stuntd's default cache budget uses physical-memory reporting
in `stuntd/train/trainer.py:92-116`,
not the explicit container budget used in this investigation.
Any future experiment needs an explicit bounded allocation and validated stop conditions.

Neither inspected recipe contains an inference architecture-pruning or smaller-encoder distillation step.
The Laya notebook exports the model state and encoder configuration at lines 416-428;
stuntd freezes the encoder rather than replacing it.
These sources establish no remedy for the measured per-forward deadline misses.
Do not infer a speedup from changing weights,
training fewer parameters,
or training-time encoder caching.

Do not run the notebook end to end as a convenience command.
Its install/download preparation is unpinned at lines 64-102,
its saved-item loader uses `weights_only=False` at line 251,
and its publication cell creates a public Hub repository and uploads a folder at lines 803-813.
Those actions need separate execution,
data,
training,
and publication authority where applicable.
None ran here.

## What a later authorized experiment would need to establish

- A frozen parser-first input contract and independently checked reference labels,
  with unknown references excluded rather than invented.
- Training/calibration/final-qualification groups separated by the relevant scenario/family identities.
- Full-policy encoding verified before materializing examples and again at model input.
- A named model/runtime/representation,
  with published native alternatives such as two-option `choice` distinguished from a training intervention.
- Matching effective calibration and serving precision/configuration.
- Measured resource fit inside separately approved training bounds.
- Quality changes measured against the same frozen baseline and an untouched qualification set.
- A separately qualified path for the total assessment deadline and real consumer behavior.

No inference-only contrast can establish the benefit of an unrun training intervention.
Source inspection supports conditional feasibility only;
Laya profile qualification remains open under #25 and the
[current audit](../audit/tech-pi-auto-mode-axiom-migration-vet-2026-09-27.md).
No training or production recommendation follows.
