# Pi auto-mode Laya migration vetting

## Superseded scope

This report is archived as the initial Laya-only source-inspection checkpoint.
Its runtime and pending-preference statements describe that checkpoint,
not the current investigation.
The user subsequently authorized Voyage and Jev,
required narrow axiom estimates with deterministic actions,
and settled hosted-data eligibility,
trust representation,
and the interactive budget.
Current selection work is in the
[axiom migration audit](tech-pi-auto-mode-axiom-migration-vet-2026-09-26.md).
The original compatibility fingerprint is retained rather than reassigned to a different scope.

## Metadata

- Status: archived; superseded context, no recommendation.
- Started: 2026-09-26.
- Last updated: 2026-09-26.
- Subject: Pi auto-mode Laya migration.
- Owner: `01a0dc52-0955-77f6-ae77-68a6e15bb12b`.
- Governing skill commit: `a05818ad70a40e5769a36de669697ba109891b31`.
- Governing skill SHA-256: `393eb68c5b2b2f7b16c8f7f90c100fb8be43eefa4501511360cd0572e4ae8087`.
- User scope override: Laya only, no alternatives or comparative discovery/scoring.
- Compatibility fingerprint: `489211ea2b71c9449c64dcc63e160d7ae69107127d467957dcdc7eb67c7a4b63`.
- Prior compatible report: none found after lock acquisition.

Fingerprint input (displayed with indentation; hashed after RFC 8785 canonicalization):

```json
{
  "baseCategories": [
    "inspectable-open-source-local"
  ],
  "deployment": {
    "candidateHost": "Linux x86_64 workstation",
    "platformScope": null,
    "runtime": null
  },
  "hardConstraints": [
    "Additional manual approvals are acceptable",
    "Laya only; no alternatives",
    "No implementation before design confirmation",
    "Preserve safety boundaries",
    "Zero coding-plan judge traffic including fallback"
  ],
  "incumbent": "pi-plugin-auto-mode@0.0.2",
  "overlays": [
    "high-trust-execution",
    "incumbent-replacement",
    "native-model-runtime",
    "sensitive-data"
  ],
  "schemaVersion": 1,
  "scope": "Laya-only feasibility and migration audit; incumbent inspected solely for parity",
  "subject": "Pi auto-mode Laya migration",
  "trustBoundary": "Local agent tool-call authorization over private tool inputs and session context"
}
```

## Status and authority

Context collection and design interview are in progress.
No technology recommendation has been made.
The user requested Laya migration with a design interview before implementation.
See [the interview record](../planning/pi-auto-mode-laya.md).
Source was cloned to inspect the user-named replacement, crossing the substantial-evaluation threshold.
No third-party runtime, installation, model download, test, or benchmark has been executed.
No production change is authorized until shared understanding is confirmed.

## Hard constraints

- Zero auto-mode judge requests to coding-plan providers, including fallback.
- Preserve safety boundaries; additional manual approvals are acceptable.
- Main coding-agent traffic is outside this migration boundary.
- Inspectable agent execution and model-artifact provenance are required by repository policy.
- Laya only: the user explicitly excluded researching or ranking alternatives.
- Platform scope and evaluation-data retention remain unresolved.
- Manual approval is the fallback direction; no other model provider is proposed.

## Classification and rubric

Laya is an inspectable open-source local component candidate.
Applicable overlays: incumbent replacement, high-trust execution, native model runtime,
and sensitive tool/session data.
Multi-platform requirements await the interview.
SaaS gates do not apply to a local runtime.
Comparative discovery and scoring are outside the user's explicit Laya-only scope.
Use a pass/fail feasibility and migration audit, with requirements still being established.
No runtime has been promoted to validated status.

## Audit subject

### Laya

Discovery source: user-supplied https://github.com/NandhaKishorM/laya.
Clone: `/home/user/temp/agent/laya-auto-mode-2026-09-26`.
Revision: `4066d5d5fbf08b66c6757ddeedbd797bd7655bc0`.
Lifecycle: targeted source inspection in progress; all hard-gate outcomes remain pending.
Both Python and TypeScript runtimes exist in this revision.
No runtime or model artifact has yet been selected.

### Incumbent parity baseline

Source: `package/pi-plugin/auto-mode`.
`src/evaluate.ts` resolves a provider model for flagged, unreused actions.
`src/judge.ts` invokes the shared structured review transport.
The migration must remove coding-plan calls from this path and its fallback handling.
The static checks, exact approval reuse, and manual approval UI remain incumbent responsibilities,
not disposable behavior.
The incumbent is not an alternative being evaluated for selection.

## Research scope

Only inspect Laya's repository, published artifacts, model checkpoints, documentation, and issues.
The user excluded alternatives before any comparative external discovery ran.
The planned comparative query schedule was discarded without execution.
Incumbent inspection establishes migration responsibilities, not a keep-versus-replace recommendation.

## Initial source evidence

### Instruction and state truncation

Source: Laya revision named in the audit subject, `laya/common.py:127-146`.
The question prefix and state have separate truncation paths:

```python
# laya/common.py:132-146, selected statements
head_ids = head_ids[: max(8, opt_budget)]
room = max(0, max_len - len(ids) - 1)
st = state_ids[max(0, len(state_ids) - room):] if truncate_left else state_ids[:room]
return ids[:max_len], [m for m in markers if m < max_len]
```

The TypeScript counterpart is `laya-ts/src/common.ts:85-101`:

```typescript
// laya-ts/src/common.ts:85-101, selected statements
headIds = headIds.slice(0, Math.max(8, budget));
const room = Math.max(0, maxLen - prefix.ids.length - 1);
const st = truncateLeft ? stateIds.slice(Math.max(0, stateIds.length - room)) : stateIds.slice(0, room);
```

Decision relevance: copying the incumbent prompt into this API would not guarantee complete policy/context coverage.
Gate status: pending a consumer-side completeness boundary and evaluated schema.
Runtime reproduction: not yet performed.

### Guard policy remains application-owned

Upstream `docs/staged-adoption.md` explicitly separates typed decisions from execution permission.
It calls for reviewed labels, held-out calibration, bounded promotion, and explicit review of high-impact actions.
This supports investigating a bounded classifier, not declaring it an authorization replacement.

### Available runtime surfaces

`laya-ts/package.json` declares version `0.1.0`, a `prepack` build,
and optional `onnxruntime-node` and `onnxruntime-web` dependencies.
`laya-ts/README.md` documents split encoder/head ONNX export and rejects free-string structured outputs.
These are source/documentation findings, not package-provenance or execution validation.
Native provenance, transitive dependencies, model revisions, tests, and serving behavior remain pending.

## Local hardware probe

Commands run from `/var/home/user/Monochromatic`:
`uname --all`, `lscpu`, `free --bytes`, and `lspci -nn`.
Exit status: 0.
Host: Linux x86_64, AMD Ryzen 7 8700F, 8 physical cores and 16 logical CPUs.
Reported total RAM: 67,002,466,304 bytes.
PCI GPU identification: AMD Navi 33, device `1002:7480`.
These facts establish available hardware, not Laya performance or accelerator compatibility.
No load test was run.
Elapsed command timings were not captured; no timing claim is made.

## Required remaining evidence

- Complete incumbent responsibility, owner, selection, parity-test, and retirement ledger.
- License, dependency, model-artifact, build-provenance, and execution-command audits.
- Source, maintenance, CI, fuzzing, mutation, and human-auditability evidence.
- Secret-free resource-bounded execution manifest before any third-party runtime.
- Guard-specific labelled evaluation, including adversarial inputs, negation, context loss, and trust scope.
- Real Pi consumer-boundary verification on the selected deployment targets.
- Cost/request-volume baseline and before/after measurement.
- A Laya-only feasibility conclusion and migration design, without alternative selection.

## Current outcome

No recommendation yet.
Design questions and validation are unresolved.
No upstream filing or runtime workaround is proposed.
