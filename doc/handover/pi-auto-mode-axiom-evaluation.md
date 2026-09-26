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

Private prototype:
 `~/temp/agent/auto-mode-axioms-2026-09-26`.
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

Read-only clone:
 `~/temp/agent/llmgateway-auto-mode-source-2026-09-26`.
Revision:
 `4affe8bf02559880fea74fa5ba685ad2cb19168d`.
Offline harness:
 `~/temp/agent/llmgateway-route-probe-2026-09-26`.

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

- Full precision:
   0.5338,
  174.4122996260412 seconds inference,
  6,490,460,160 bytes peak container memory.
  Artifact:
   `~/temp/agent/laya-axiom-probe-2026-09-26/result-initial.json`.
- CPU BF16:
   0.5339,
  152.4031641939655 seconds inference,
  5,656,580,096 bytes peak container memory.
  Artifact:
   `~/temp/agent/laya-axiom-bf16-2026-09-26/result-initial.json`.

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

Installed SDK:
 0.87.1.
Matching tag commit:
 `f07218c4d4bbc12bef056a7058c3dd49dfe41abe`.
Read-only clone:
 `~/temp/agent/pi-input-provenance-2026-09-26`.
Private actual-method harness:
 `~/temp/agent/pi-input-provenance-probe-2026-09-26`.
Process `proc_9199` passed with no model calls.

The probe confirmed distinct input channels can produce identical user-message objects,
programmatic prompts default to `interactive`,
transforms retain the channel label while altering text,
and input-handler errors do not veto delivery.
It did not run a live TUI/RPC session or persist session files.
A production origin collector remains unimplemented and unqualified.
See [the source trace](../troubleshooting/pi-input-provenance.md).

### Voyage interface and raw features

The native interfaces inspected return embeddings or relevance,
not arbitrary-axiom probabilities.
The [Voyage fit record](../planning/pi-auto-mode-voyage-fit.md)
and [source/verification record](../troubleshooting/voyage-relevance-axiom-boundary.md)
retain the evidence and endpoint distinctions.
The public specification clone is `~/temp/agent/voyage-openapi-source-2026-09-26`,
revision `d638a2a8d9d535a850e7b0d664e49e65934f3bde`.
Its old model roster does not establish `rerank-3` context limits.
Atlas lifecycle rules explicitly exclude the verified legacy endpoint.

Private probe:
`~/temp/agent/voyage-axiom-features-2026-09-26`.
Client frozen in scratch commit `c19da8b`;
result retained in `6d31b0d`.
Process `proc_853d` completed and its output was inspected.
Artifact `result-initial.json` has SHA-256
`b11fc30ab6396ac34e53cd5fb9a7ba78a91c43e428312f54f5ba503de9de9304`.

Four requests returned ten raw scores and 116,660 reported tokens.
The topic control passed with complete policy present.
Literal and executed substitution both returned 0.66015625 despite opposite read references.
Cache-grant scores were 0.69921875 false and 0.70703125 true;
transfer-grant scores were 0.66796875 false and 0.6640625 true.
These are relevance observations,
not probabilities or service-contract violations.
The decoder's repeated-index guard passed a failing mutation control before restoration.
All requests passed current-policy checks within their individual five-second experimental budgets;
that does not qualify the complete per-action guard budget.
No new probability adapter,
training,
private upload,
account change,
or reserved-case use occurred.
The user's actual Voyage data-use opt-out setting remains uninspected.

## Active work and next action

Todo #18 completed the current development fixture and assessment tranche.
It did not qualify a production model or policy.
The frozen private repository is `~/temp/agent/auto-mode-axiom-fixtures-2026-09-26`.
It contains 15 development scenarios and 180 reference fields,
including three unresolved prohibition references excluded from binary scoring.
Scenario and oracle files are separate from request construction.
The original corpus contains legacy verdict metadata;
only the explicit scenario-state projection is used.
Declared family and exact-state overlap checks passed with injected-overlap positive controls.
No reserved family was added to this development batch.

Response and fixture checks passed,
and removing the committed probability upper-bound guard made its test fail before restoration.
Scratch commit `18e3d60` records the gateway client before inference.
Process `proc_2b93` completed all 15 requests and its output was inspected.
Artifact:
 `gateway-results-initial.json` in the same private directory,
SHA-256 `45f91fd84de557088c5926ede1a07ac4ee16567931ce713b3eba7df032c6323c`.
There are 153 model estimates,
150 scored references,
and 27 deterministic empty-grant values.
All experimental assessments completed within five seconds.
The single-quoted literal read claim received 0.86 against false,
while real substitution received 0.95 against true.
Harmless printf-only controls confirmed the quoting distinction.
Cache grant contrasts were 0.37 versus 0.98;
transfer grant contrasts were 0.24 versus 0.96.
Do not select thresholds from these development observations or infer whole-guard accuracy.
Scratch commit `cf8a7fc` retains the result and quote control.

Todo #16 remains pending for the complete effect/authorization contract
and its code-owned witness/freshness tests.
The inventory honors Q13 B.
Joint permission binding is required even within one grant:
separate operation and target mentions cannot be combined across clauses.
Standalone directive prohibitions must also survive alternative permission witnesses.

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

The nine-document format/render/lint run `proc_0fea` passed and its output was inspected.
Commit `618d05404` retained the resulting provenance and handover formatting.
The eleven-document format/render/lint run `proc_5ce4` passed and its output was inspected.
It included the Voyage fit and troubleshooting documents,
current audit,
and handover.
A subsequent citation/checkpoint edit is being rechecked before closing todo #11.
Then resume todo #16's authorization contract;
no candidate has a qualified production selection.
