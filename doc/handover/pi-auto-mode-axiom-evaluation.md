# Pi auto-mode axiom evaluation handover

## Authority and active design

The user wants lower cost and no unusual judge traffic to coding-plan providers.
Models must emit probabilities for narrow axioms;
deterministic code owns approve,
deny,
and ask.
Zero coding-plan judge calls includes fallback.
Normal coding-agent traffic is outside this migration boundary.

Production implementation remains blocked until final shared understanding is confirmed.
Main-worktree work is documentation only.
Private prototypes,
local history inspection,
and synthetic evaluation are authorized.
No raw histories may be uploaded or committed,
no ongoing transcript capture is authorized,
and training or separately rented compute requires further authorization.
Public/synthetic API probes using the supplied credentials remain authorized.
Complete current `AGENTS.md` must be preserved,
with stale results rejected after a policy change.

Current references:

- [Axiom architecture and interview answers](../planning/pi-auto-mode-axioms.md).
- [Effect and authorization contract](../planning/pi-auto-mode-effect-contract.md).
- [Current multi-candidate audit](../audit/tech-pi-auto-mode-axiom-migration-vet-2026-09-26.md).
- [Historical interview and responsibility ledger](../planning/pi-auto-mode-laya.md).

## Settled preferences

Do not reopen these choices:

- Authorized candidates are Laya,
  relevant Voyage products/models,
  and Jev.
  Prefer LLM Gateway over OpenRouter.
- Additional manual approvals are acceptable.
  First deployment is this Linux workstation.
- Q8 A permits considering future private non-secret runtime input after the remaining audit and cutover acceptance.
  It is not permission for private uploads now.
- Q9a A presents explicit human-confirmed scope alongside new grant wording.
- Q9b A permits qualified semantic reuse of accepted prose grants.
- Q10a accepts a five-second total assessment wait,
  not a fresh timeout per question or retry.
- Q10b B permits one client transport retry within that total budget.
- Q11 B caps our client at two calls and permits gateway-internal retries.
  No end-to-end two-attempt cap is required.
- Q12 C accepts published necessity-based retention without a fixed deletion deadline.
  Do not impose zero retention or a fixed maximum as a new gate.
- TypeSafe AUP section 1.5 is acceptable for this guard-classification evaluation.
  Do not require provider clarification solely about it.
- Q13 B permits automatic approval from qualified semantic effect estimates
  for validated inspected script forms,
  without separate code-established effect analysis.
  Do not reinstate the rejected code-proof-only prerequisite under another name.

Fixed checks,
provenance,
missing-evidence handling,
profile applicability,
manual/headless behavior,
and cancellation remain code-owned.
Neither role labels nor a model's opinion can create a human grant.

## Completed evidence

### Deterministic prototype and Jev

Private prototype: `~/temp/agent/auto-mode-axioms-2026-09-26`.
Its three-effect catalog is a demonstration,
not production coverage.
Six independently labelled development cases,
three unvalidated diagnostic profiles,
4,096 binary vectors,
and a failing hard-block mutation control were exercised.
No production profile is selected.

The first native Jev axiom pilot returned 57 model estimates across six requests.
Its diagnostic action matches concealed an uncertain prohibition estimate of 0.68.
Do not use final-action accuracy alone as qualification.
The earlier direct-verdict pilots are withdrawn as model-quality evidence.

Live public context-limit probe:
`~/temp/agent/jev-context-boundary-2026-09-26/result-initial.json`.
A complete-policy control returned HTTP 200 with 10,457 reported input tokens.
Requests with 40,000 and 80,000 repetitions of `x ` returned HTTP 400
with `max_tokens_exceeded`.
All met their individual five-second deadlines.
These are not token counts for rejected inputs or proof of internal token preservation.

### Gateway source and terms

Read-only clone: `~/temp/agent/llmgateway-auto-mode-source-2026-09-26`.
Revision: `4affe8bf02559880fea74fa5ba685ad2cb19168d`.
Offline harness: `~/temp/agent/llmgateway-route-probe-2026-09-26`.

The actual pinned route with mocked host/provider dependencies showed:

- Complete policy string forwarding.
- Upstream model labels overwritten by the gateway catalog label.
- Three synthetic upstream attempts after two retryable failures,
  including with `x-no-fallback: true`.
- Missing answer IDs passed as HTTP 200.
- Echoed upstream error text survived ordinary metadata-only payload stripping.

These are not claims of historical hosted substitution,
extra live attempts,
or private-data retention.
Source and live evidence are separated in
[the gateway troubleshooting record](../troubleshooting/llmgateway-systemone-boundaries.md).
TypeSafe documents 64k aggregate tokens and 32k for state plus the longest question.
No-training is not no-retention.
Do not use Jev outputs to train Laya;
independently authored labels remain separate.

### Laya full-policy Noul measurements

Both experiments used one `protected_transfer__occurs` Noul
on the predeclared true `inline-secret-export` development case.
Both verified all 12,820 actual forward tokens,
kept policy current,
and exited 0 without a memory kill.

- Full precision: 0.5338,
  174.4122996260412 seconds inference,
  6,490,460,160 bytes peak container memory.
  Artifact: `~/temp/agent/laya-axiom-probe-2026-09-26/result-initial.json`.
- CPU BF16: 0.5339,
  152.4031641939655 seconds inference,
  5,656,580,096 bytes peak container memory.
  Artifact: `~/temp/agent/laya-axiom-bf16-2026-09-26/result-initial.json`.

Both measured cases would reach manual approval at five seconds.
Do not generalize this into rejecting every interactive workflow,
other checkpoint/runtime configurations,
or a model-quality ranking.
No repeat-run timing band or numerical parity was measured.
The auxiliary `action.act_probability` is not authorization.
The loader warning concerns `choice:11+`,
not the `noul:2` bucket used here.

The research limits remain 8 GiB,
2 CPUs,
no added swap,
no network or host mounts,
300 seconds,
and one inference container at a time.
No inference is currently scheduled.
Detailed source and resource evidence:
[Laya troubleshooting](../troubleshooting/laya-full-agents-context.md).

### Pi input provenance

Installed SDK: 0.87.1.
Matching tag commit: `f07218c4d4bbc12bef056a7058c3dd49dfe41abe`.
Read-only clone: `~/temp/agent/pi-input-provenance-2026-09-26`.
Private actual-method harness: `~/temp/agent/pi-input-provenance-probe-2026-09-26`.
Process `proc_9199` passed with no model calls.

The probe confirmed distinct input channels can produce identical user-message objects,
programmatic prompts default to `interactive`,
transforms retain the channel label while altering text,
and input-handler errors do not veto delivery.
It did not run a live TUI/RPC session or persist session files.
A production origin collector remains unimplemented and unqualified.
See [the source trace](../troubleshooting/pi-input-provenance.md).

## Active work and next action

Todo #16 is active:
complete the effect/authorization contract,
independent axiom fixtures,
and its code-owned witness/freshness tests in private scratch.
The source-backed inventory now distinguishes review signals from proved facts
and honors Q13 B's semantic effect policy.

Next work should address:

- A verified original-request witness,
  stable binding to the actual entry/branch,
  collector failure,
  input transforms,
  queues,
  resumption,
  and context edits.
  Use metadata references rather than duplicate transcript capture.
- Independent per-axiom truth labels beyond the initial six cases.
  Preserve the original 24 reserved scenarios;
  do not fit definitions or thresholds to reserved model results.
- Same-grant operation/resource/destination/condition binding,
  stale grants,
  branch switches,
  revocations,
  old machine-approval reuse,
  and pending prompt changes.
- Total deadline and permitted client-retry failure paths,
  cancellation,
  missing estimates,
  modalities,
  and real consumer integration in disposable fixtures.
- Remaining model/service gates and comparable qualification for authorized candidates.
  Voyage relevance scores are not automatically axiom probabilities.
  No winner or adoption-ready recommendation exists.

## Artifacts and commit checkpoints

Key commits include `1d2537e8b` for Q13 B,
`9b7de69b1` for the aligned effect contract,
`c955c345b` for BF16 audit evidence,
`60e65241d` for Pi provenance findings,
and `5b6200b34` for their contract implications.
Only scoped documentation was committed in the main worktree.
Unrelated music-player work and `tmp/` must not be reset or cleaned.

The current audit fingerprint is
`4a2938840ff56544f24ad0d2dd543431c94baa1e18db815adb8ee68af297ea8d`.
Audit updates use private per-path locks,
pre-edit hash checks,
and atomic sibling-file renames.
The helper is `~/temp/agent/auto-mode-route-audit-update.mjs`,
which now accepts a JSON file of exact replacement pairs as its argument.
The formatter helper is `~/temp/agent/auto-mode-doc-format-current.mjs`.
Update its explicit path list when adding scoped documents.

The last seven-document format/render/lint run passed as `proc_c44f`.
The newly added provenance document and this handover still need inclusion in the next scoped check.
Do not report that later check as completed until its result is inspected.
