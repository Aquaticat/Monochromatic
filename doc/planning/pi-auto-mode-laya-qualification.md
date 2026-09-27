# Remaining Laya candidate qualification

## Priority and scope

The user corrected the sequence:
finish investigating Laya,
Jev,
and Voyage-rerank before further integration-policy questions.
See the [current handover](../handover/pi-auto-mode-axiom-evaluation.md).
No production implementation,
training,
private upload,
new hardware allocation,
or `AGENTS.md` edit is authorized by this plan.

The earlier full-policy English CPU runs establish retained input and measured runtime,
not general axiom quality.
The FP32 and BF16 protected-transfer observations remain separate single measurements.
No coding-plan provider may judge or supply fallback.

## Questions the remaining work must answer

- Does the tested complete-policy Noul representation respond to positive/negative evidence,
  or mainly to option labels?
- How does that behavior carry to an independently labelled executable-versus-quoted contrast?
- Which published Laya checkpoints and runtimes can preserve the required policy,
  and what is known versus untested about their supported context and platform?
- What source-supported fine-tuning paths exist,
  which data rights and resources would they require,
  and what evidence could justify requesting training later?
- Which source,
  calibration,
  execution,
  and consumer claims remain unsupported after these probes?

No software roadmap follows merely from passing a transport or forward-input check.

## Evidence motivating the next experiment

Pinned Laya source:
`~/temp/agent/laya-auto-mode-2026-09-26`,
revision `4066d5d5fbf08b66c6757ddeedbd797bd7655bc0`,
version 0.3.20.
Its `README.md:1021-1041` warns that Noul can follow labels rather than state
and documents model-facing label overrides.
Its `laya/common.py:65-91` retains semantic order `[false, true]`
when rendering those labels.
Its `laya/agent.py:760-813` computes Noul from the second semantic probability slot,
not the auxiliary action score.

Both cached English and multilingual encoder configs declare 8,192 positions.
The measured complete-policy English axiom input was 12,820 tokens.
Successful forward execution beyond the declared range is not long-context accuracy qualification.
The [existing context investigation](../troubleshooting/laya-full-agents-context.md)
records actual input-tensor checks and dynamic position construction.
Mandatory policy will not be truncated or windowed away to improve a result.

## Frozen label-sensitivity tranche

Private root:
`~/temp/agent/laya-axiom-labels-2026-09-26`.
The first tranche uses the already tested English checkpoint,
source-supported CPU BF16,
and the same attention workaround.
This holds the runtime configuration fixed while changing evidence and model-facing labels.
It does not choose English or BF16 for production.

The state pairs are:

- A public field whose color is blue versus orange,
  asking whether that named field is exactly blue.
  This is a representation control;
  production code would resolve such an observed equality directly.
- The frozen development-only literal single-quoted substitution
  versus actual double-quoted substitution,
  asking only about the protected-file read attempt.

Each state is tested with:

- Default `false` and `true` labels.
- Opaque labels with false mapped to A and true mapped to B.
- The reversed opaque assignment.

The resulting twelve trials are declared before any new model output.
All reference truths remain outside the model input and inference image.
The original 24 reserved scenarios remain unused.
No best label mapping will be promoted from these development results.
A control failure is not proof that every Laya representation or checkpoint is unusable.

## Execution and interpretation bounds

Every trial includes complete current `AGENTS.md`.
The runner verifies original policy freshness,
complete encoded state and instructions,
actual forward IDs and attention masks,
model digests,
and continued BF16 activation.
It records native P(true),
not a final action or auxiliary `act_probability`.

Only one inference container runs at a time.
Each has 8 GiB RAM,
2 CPUs,
no added swap,
no network,
no host mounts,
and a 300-second wall-clock ceiling.
A failure stops the remaining batch for diagnosis.
The entire finite batch cannot authorize a tool action.
Its research ceiling is not the five-second production assessment budget.
A late model path would still require the accepted manual fallback.

Outcomes must distinguish controls from guard examples,
label sensitivity from accuracy,
context acceptance from context quality,
and research runtime from deadline-qualified assessment.
No held-out calibration,
model ranking,
or production policy profile is selected here.
