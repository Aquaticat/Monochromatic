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
Do not commit raw histories or start ongoing transcript capture.
Training and separately rented compute require further authorization.
The user authorizes all task-relevant assessment content through LLM Gateway to Jev
and explicitly expanded that consent to Respan,
including private or sensitive content for the named evaluation.
This supersedes the earlier no-private-input restriction for those routes;
it does not request unrelated bulk exports or authorize other recipients.
Public/synthetic API probes using the supplied credentials remain authorized.
Complete current `AGENTS.md` must be preserved,
with stale results rejected after a policy change.

Current references:

- [Axiom architecture and interview answers](../planning/pi-auto-mode-axioms.md).
- [Effect and authorization contract](../planning/pi-auto-mode-effect-contract.md).
- [Current multi-candidate audit](../audit/tech-pi-auto-mode-axiom-migration-vet-2026-09-28-80e67cc0.md).
- [Historical interview and responsibility ledger](../planning/pi-auto-mode-laya.md).

## Gateway input authorization and access boundary

The user declined dashboard access and stated:

> But I can say it only records metadata.
> I'm approving sending anything and everything to LLMGateway/Jev.

Record metadata-only logging as user-reported configuration,
not independent inspection or a guarantee about every internal diagnostic field.
The explicit input authorization covers task-relevant assessment content,
including private or sensitive content,
through the named LLM Gateway/Jev route.
It supersedes Q8 A's earlier private-input eligibility restriction for that route.
Do not ask for the same permission again or keep dashboard inspection as a prerequisite.

The authorization concerns assessor inputs,
not the tool actions being assessed.
It does not authorize unrelated bulk exports,
other recipients,
ongoing capture,
training,
paid compute,
or production cutover.
Data minimization and the complete-current-policy requirement remain in force.
Existing vendor terms and the separate prohibition on using Jev outputs as Laya training labels are unchanged.

Stop account-settings access attempts.
The Safari MCP fallback had attempted its configured Mac SSH endpoint solely to locate an authenticated browser;
hostname resolution failed and no Safari session opened.
The Mac is not needed for inference or files,
and the agent must not retry it for this task.
The user offered clarification rather than dashboard access.
No login form or account-setting mutation was submitted.

Todo #20 was superseded and deleted,
not marked technically verified.
Todo #24 records this authorization/context change;
#14 no longer depends on dashboard access.
Candidate qualification and final shared-design confirmation remain incomplete.
No `AGENTS.md` edit is authorized by this clarification.

## Respan candidate and input authorization

The user added `AUTO_MODE_RESPAN_API_KEY`,
asked to also assess `span-01-lite`,
reported `span-01-free` as another name,
and supplied `respan.ai`.
The user then explicitly expanded the existing input consent to Respan.
Do not ask for that same consent again.
Current first-party documentation maps Lite to `span-01-free` and Pro to `span-01-pro`.
The direct scoring route is `POST https://api.respan.ai/api/v1/scores`,
returning native present/absent/not-observable probability triples.
Do not treat not-observable as absence or silently normalize it away.
Metadata status and filtered-model routes returned `403` with the provided key and `401` with invalid controls.
The controllers withheld the actual error wording,
so the cause is unknown.
No further metadata retry is planned.
The initial scoring canary returned `422` because output must be an assistant message.
The separately frozen correction kept the request in input and added a fixed synthetic assistant output.
It returned `200` with valid native triples in `609.983842` ms,
including full-policy preparation and final checks.
Private result `d309fe5` retains this single observation;
see the [role-contract finding](../troubleshooting/respan-span-output-role.md).
No threshold or semantic qualification follows from the canary.

This is an additive candidate change,
not permission to restart the paused ONNX source expansion.
All task-relevant assessment content may be sent through the named Respan evaluation route,
including private or sensitive content.
No assessed action,
training,
other recipient,
unrelated export/capture,
raw-history commit,
hardware/rented-compute allocation,
or production change follows.
The Gateway metadata-only logging statement does not establish Respan's logging behavior.

The user reports zero Respan balance and authorizes limited initial Pro tests through OpenRouter.
Direct Lite/free remains first;
no paid direct Pro call,
billing change,
or automatic top-up is permitted.
Recommend topping up only if measured Pro benefit warrants it.
OpenRouter inputs are limited to separately frozen synthetic payloads plus complete current policy,
not blanket private-history routing or fallback.
Reported low OpenRouter rate limits remain unverified.

Task #39 checks the supplied resource before unrelated work.
The active audit context is `80e67cc07b2eb898054d15ddd04e91bb689fbb4c8ebb77aee5c4ba3cd6f9a8d2`;
the earlier Respan context and all prior reports remain unchanged.
A public raw GitHub fetch matched all 42,677 bytes of current policy.
The completed free scoring probe used synthetic wording plus that verified-public policy,
with freshness rechecked before dispatch and release.
The current audit records unresolved terms and data-handling questions without revoking existing input consent.
The initial OpenRouter Pro request returned `400` because Respan requires string or span-shaped state.
A separately frozen correction used the exact accepted Lite span and definitions.
It returned `200` with model `respan/span-01-20260925`,
Noul values `0.6700895` and `0.027236922`,
and reported cost `0.00026302` USD.
The live validator rejected that versioned label before its final freshness checks;
its `529.101426` ms duration is not a complete qualified assessment.
Anonymous catalogue metadata later corroborated the label.
Private `8a4e6c5` retains an offline source/policy/body recheck without another model call.
Both Noul values equal Lite's present fields on this one span,
not proof of model parity or native uncertainty mapping.
The [OpenRouter contract finding](../troubleshooting/openrouter-respan-decisions-contract.md)
records the failures and limits.
No further Pro call or top-up recommendation follows from this canary.
Do not invent an absence probability or discard not-observable mass.
Task #38's result documentation is finalized after the scoring resource check,
without rerunning its model batch.

Task #40 completed the bounded direct Lite semantic study,
using Jev's existing 18-profile matrix and pre-query references,
not Jev outputs or new scenarios.
Private source `e931518` and input/control freeze `4104ade` precede live queries.
`proc_02ba` passed parser,
serializer,
native-mass,
coverage/error,
anchor,
and shared-deadline controls.
All 61 source/input files,
including diagnostic constants,
are hash-frozen.
There was no exact text overlap with the prior Respan canary;
an injected matching control verified that result.
The original declared anchor remains excluded from novel coverage.
The [native qualification protocol](../planning/pi-auto-mode-respan-qualification.md)
sets at most 36 direct free calls,
one shared five-second clock per source pair,
zero retries,
and first-failure stop.
Apply upper cutoffs separately to native present and absent mass;
never infer absence from low present probability.
No additional Pro call,
threshold selection,
training,
reserved-scenario query,
or source-audit restart is part of this study.

`proc_cbe7` completed all 36 calls within the paired-profile deadlines.
Private `b15df3e` retains the raw result;
`proc_5210` verified all current source/policy hashes,
actual native bodies,
and rescoring;
`558f064` retains the verified summary and README.
At per-channel cutoffs `0.8`,
`0.9`,
and `0.95`,
correct/wrong/uncertain counts were respectively 58/1/13,
39/1/32,
and 5/0/67.
No band met minimum role coverage.
At `0.8` and `0.9`,
no approved-prose positive relation resolved correctly true.
At `0.95`,
only prohibitions resolved true and no estimate resolved false.
The resolved error assigned `0.911335` present mass to sending `.env` externally when the request
said to read `.env` locally and send `README.md` instead.
No tool action occurred and no internal model cause is established.

The [completed Lite result](../planning/pi-auto-mode-respan-qualification.md#completed-result)
records full identities and limits.
This tested Lite profile failed its finite gate;
Jev's tested `0.95` profile passed its own finite gate.
Different wire framing and native uncertainty handling prevent an intrinsic model-ranking claim.
No band was tuned,
no repeat is planned,
and no provider is adopted.
Overall service/privacy,
production calibration,
and live-authority qualification remain open.

The bounded Jev and Respan semantic studies are finished,
but that does not complete the full candidate investigation.
The agent resumed the design interview with Q16 on inherited-directive revocation.
The user instead asked:
"Have you looked at Voyage-rerank?"
Q16 remains unanswered and the design interview is paused.

At the Q16 interruption,
Voyage had only the historical interface/raw-feature evidence:
4 `rerank-3` requests over 10 documents with complete policy.
It had not received a corrected parser-first semantic-feature study.
No relevance-to-axiom-probability mapping was validated.
The quotation-based quality conclusions remain withdrawn.
Do not treat Voyage as fully qualified or categorically unusable.
The [Voyage fit record](../planning/pi-auto-mode-voyage-fit.md) and retained raw artifact were rechecked.
Returning to the design interview before resolving this candidate-status gap was premature.
No new training,
private Voyage input consent,
model batch,
paid Pro expansion,
or paused Laya source work follows merely from this clarification.

The user then requested continuation after a system crash.
Commit `8edcade70` and clean retained experiment repositories were verified;
a missing process-manager record did not trigger a repeated study.
Task #41 completed a corrected Voyage raw-feature check under
`~/temp/agent/voyage-semantic-controls-2026-09-28`.
Source `af607b3` and input/control freeze `a101ca4` precede live calls.
Local controls `proc_9f53` passed without networking.

The [Voyage protocol](../planning/pi-auto-mode-voyage-fit.md#corrected-source-isolated-study)
uses the existing synthetic matrix and code-owned parser/structured facts,
not raw Bash occurrence questions or candidate final verdicts.
At most 17 sequential calls include a topical control,
12 within-query feature contrasts,
and a fixed four-call action-shaped timing envelope.
Every document retains complete current policy with truncation disabled.
Raw relevance is not relabelled as probability;
no fitting,
training,
private Voyage upload,
reserved-case query,
or automatic repeat is authorized.
The design interview remains paused.

`proc_3099` completed all 17 frozen calls with zero retries.
Eight of twelve diagnostic query groups strictly separated true and false references;
cache/request positive relation and three read-side groups had ties or inversions.
The final four-call envelope took `3753.4803429999993` ms on this attempt.
For the same `.env` reading claim,
the direct request and the filename/README cross-clause request both scored `0.66015625`.
A `.env.example` request scored higher at `0.67578125`.
These are corrected language-scope findings,
not the withdrawn quotation test or an observed tool action.

Private `26445eb` retains raw results;
`proc_83da` rechecked current policy,
all frozen sources,
request/document bytes,
raw responses,
indices,
and ordering summaries without another model call.
`fd05a3b` retains the verified summary and README.
The [completed Voyage feature result](../planning/pi-auto-mode-voyage-fit.md#completed-corrected-result)
records all counts and limits.
Voyage demonstrated semantic ranking signal,
but the tested representation did not fully separate all contrasts
and no truth-probability mapping or deployed auxiliary role is qualified.
No training,
threshold fitting,
normalization,
repeat,
or automatic interview resumption follows.

A candidate-scope question offered stopping Voyage's primary-assessor investigation
or defining a separate composed-estimator study before further design.
The question tool was initially aborted.
The user subsequently chose B and said:
"You come up with something yourself."
The agent must design the concrete method rather than return the design problem to the user.

This selects composed-estimator research,
not a production model,
threshold,
or implementation.
The offered B boundary still requires separate authorization before parameter fitting or training.
Private Voyage inputs,
reserved scenarios,
new providers,
new Pro calls,
and the paused Laya source branch remain outside this step.
Q16 is unanswered and the integration interview stays paused.
Task #43 defines the [paired-hypothesis composition](../planning/pi-auto-mode-voyage-composed-estimator.md).
Selected source plus parsed/structured operation becomes the query;
claim/complement hypotheses become documents,
with complete current policy in each document.
The request/prose pair uses two API calls in the proposed representation,
not a promised latency result.
Each axiom retains its own support/complement pair,
margin,
and common level;
no cross-axiom normalization or probability interpretation is allowed.

A future per-role regularized logistic head would be supervised truth estimation,
not automatic conversion of relevance.
Fitting and production cutoffs remain unauthorized.
Abstention and probability quality must be validated on accepted cases,
with fresh group-separated data before deployment claims.
The first planned no-fitting mechanism test targets four existing read profiles,
with repeats and order reversals on both source kinds,
for at most twelve calls.
It tests old feature collisions and source sensitivity,
not a probability profile.
No new NLI model,
SDK,
provider,
or training implementation is adopted.

Task #44 freezes the no-fitting mechanism probe at
`~/temp/agent/voyage-paired-hypotheses-2026-09-28`.
Source `4a0d2a6` and input/control/verifier checkpoint `c17ab9f` precede live calls.
`proc_681b` passed the exact encoder,
per-axiom pair decoder,
reference exclusion,
reversed-index,
raw-range,
overflow,
comparison,
and shared-deadline controls.
The frozen twelve-call schedule includes four base read profiles,
one exact repeat of each direct-positive source kind,
and one document-order reversal of each.
All 58 source/input files and complete policy are hash-bound.
No model output from this probe is a probability or permission decision.

## Sequencing correction

The user stopped the integration-policy interview and asked whether investigation of Laya,
Jev,
and Voyage-rerank was finished.
It was not.
The agent moved into Q14 and Q15 prematurely.
Return to candidate investigation before further integration-policy questions or contract implementation.
Do not treat completed access checks or limited probes as completed candidate evaluation.

The user nevertheless answered Q14 A and Q15 B.
Those answers are recorded in the settled preferences section;
they do not authorize production implementation or mean the shared design is confirmed.
The user explicitly requested no `AGENTS.md` edit for now and asked to save the correction in this handover.
Do not apply the previously proposed AXQ rule or another corrective agent-guidance edit.

This handover supersedes pending-question wording and the unaccepted Q15 A recommendation
in older planning/audit records.
Do not repeat Q14 or Q15.
Defer the dependent inheritance/revocation-linkage interview until candidate research is ready.

## Parser-boundary correction

The user corrected the candidate probe:

> "single-quoted example" - that's not the way.
> These are not reasoning models and we have a bash parser.

The agent wrongly delegated Bash quotation/substitution interpretation to the models
and treated the resulting estimates as candidate-quality evidence.
Withdraw that comparison across Laya,
Jev,
and Voyage.
Quarantine aggregate quality scores that mix those code-owned questions with semantic questions.
Retain raw outputs as historical observations,
and retain transport,
resource,
runtime,
and input-preservation measurements only for their original envelopes.
Do not transfer those measurements automatically to revised inputs.
Color-field controls are interface checks,
not guard competence tests.
Prose-only observations need a field/input audit before reuse;
do not discard their independent references or silently qualify the mixed batches.

Actual incumbent verification:
`~/temp/agent/auto-mode-parser-boundary-2026-09-26/probe.mjs`
called `src/command-parser.ts`'s `analyzeBashCommand`,
which delegates to the shared `analyzeShellCommand` and installed `unbash` 4.0.11.
On the exact frozen literal fixture it returned `hasCommandSubstitution: false`
and no `cat` command.
On the double-quoted counterpart it returned `true`
and a `cat` command whose argument is `/work/project/.env`.
No command was executed and no model was called.
The existing shared-analyzer test at `src/index.unit.test.ts:89`
already checks the same distinction using `date`.

The flattened `allFiles` list also contains a path-shaped printed string in the literal case.
It must not be treated as a list of proven reads.
Command records,
source spellings,
redirect kinds,
and context belong together.
The parser is not a universal proof of runtime reachability,
command identity after dynamic resolution,
or successful file access.

The next probe must not ask models to reconstruct syntax facts supplied by the parser.
Use code-established facts with explicit scope and provenance;
query only a genuinely remaining narrow semantic relation.
For the next limited tranche,
that means trusted request/prohibition or eligible prose-grant language,
without raw Bash occurrence questions or final-action labels.
This is a probe-scope correction,
not a revocation of Q13 B's qualified semantic-effect eligibility for validated inspected forms.
Independent review confirmed that distinction and the need for per-question evidence quarantine.

Todo #21 tracks this correction and fixture verification;
#14 remains unqualified.
The later user-reported metadata setting and input authorization supersede the account-access task.
The original `proc_baf9` and `proc_7f3f` completed.
The replacement Laya run is recorded separately under #6.
Model calls were paused while this boundary was reviewed and the replacement fixtures were checked.
No production change or `AGENTS.md` edit was made.
Do not resume integration-policy grilling.

The replacement fixture root is
`~/temp/agent/auto-mode-parser-first-fixtures-2026-09-26`,
scratch commits `6d7e531`,
`bb60345`,
and `ad4a457`.
It reuses the independent development references for `delete-negated-request`
and `delete-positive-request`.
The actual parser runs locally;
a projection restricted to the exact frozen command supplies the operation descriptor.
Standard command identity and cache-to-target binding are explicitly synthetic assumptions,
not claims about the host.
Only request wording differs between the model states.
Raw proposed-action source,
occurrence questions,
references,
and final-action labels are absent from those states.
Full current policy must still be added unchanged at inference time.

Fixture checks passed.
Removing each boundary check in separate disposable test copies caused
`Missing expected exception`;
the original checks remained unchanged and passed again.
Re-preparation into a fresh directory reproduced input SHA-256
`83bea87e969798821dcc9131a6433772b7751d783e13e7edbd82ec4a2611bcaa`.

The native Jev client is frozen at
`~/temp/agent/jev-parser-first-request-controls-2026-09-26`,
commit `6a65f88`.
Its finite schedule is three repetitions of each state,
with requested/prohibited questions in one call and one five-second budget per two-question assessment.
Parser preparation was offline,
so this is not a full live-consumer deadline qualification.
Client syntax and copied-fixture checks passed.
Process `proc_8bd7` subsequently completed all six requests;
`63861bd` retains the result,
SHA-256 `145e30b90564103761ddaffe0840a34ba9b59f7f8d2769f0c60b5e74a4b3a0c8`.
All passed freshness and their two-question five-second budget.
The negated request returned requested=0.02 and prohibited=0.95 on each repetition.
The positive request returned requested=0.83,
0.82,
0.84 and prohibited=0.03,
0.02,
0.02.
These are repeated observations of two development states,
not calibration or a production threshold.
The [Jev qualification record](../planning/pi-auto-mode-jev-qualification.md#parser-first-request-language-controls)
retains timing,
usage,
and limitations.

The corresponding Laya tranche is frozen at
`~/temp/agent/laya-parser-first-request-controls-2026-09-26`,
commit `01473ec`.
Process `proc_12af` completed bounded image construction,
actual-image preflight,
and twelve sequential single-question Noul trials across English,
multilingual,
and typed-decisions.
All used the same shared states and predicate wording,
with default labels and the unchanged reviewed runtime.
Its result is retained in `44b8770`,
SHA-256 `46b481b7d55ddb72d8f265a0fc16050548b1fa0a14a85bdd428b912d63230807`.
Verification `proc_46f0` checked input/reference identities,
complete forward tokens/masks,
freshness,
and actual exited-container image/timestamps/resource configuration.
The measured summary is retained in `017a584`.
Interpretation check `proc_3f2c` measured the ordinal differences and verified checkpoint temperature configs.
Neither check ran another model forward.
This task's inference batch is finished;
do not rerun it as if the result were missing.

The [corrected observations](../planning/pi-auto-mode-laya-qualification.md#corrected-native-noul-observations)
record all probabilities and resources.
There are two synthetic states and four conditional state/predicate references,
not twelve independent scenarios.
Each cell was measured once.
All same-checkpoint predicate pairs moved in the expected ordinal direction at returned precision;
robust sensitivity,
calibration,
thresholds,
and ranking remain unestablished.
Every forward exceeded five seconds,
and all inputs exceeded the encoder-declared 8,192 positions.
No cause or fine-tuning remedy is established.
The `choice:11+` warning is not a warning about the selected Noul bucket.

The native baseline scope is #6;
remaining profile/representation/runtime qualification is explicitly retained in #25.
Source-supported fine-tuning feasibility is #7.
The corrected controls cover request text,
not overall policy prohibitions or eligible prose-grant matching.
References depend on the supplied synthetic operation/cache bindings.
Jev serving independence remains unknown,
not a proven effective sample size of one or three.
No extra inference tranche is required merely to record these bounded observations;
new controls would not by themselves establish training benefit.

## Settled preferences

Do not reopen these choices:

- Authorized candidates are Laya,
  relevant Voyage products/models,
  Jev,
  and Respan's user-named `span-01-lite` / `span-01-free`.
  Prefer LLM Gateway over OpenRouter where applicable.
- Additional manual approvals are acceptable.
  First deployment is this Linux workstation.
- The later input authorizations supersede Q8 A for LLM Gateway/Jev and the named Respan evaluation:
  all task-relevant assessment content is authorized,
  including private or sensitive content.
  No dashboard access will be provided;
  do not pursue it or treat it as a remaining input-consent gate.
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
- Q14 A makes trust-directive reset effective across branches of the same session ID.
  Navigation must not reactivate those reset directives.
  This answer does not expand reset to exact-action approval records
  or decide revocation in already-forked separate sessions.
- Q15 B permits eligible human-confirmed trust directives to inherit into a new forked session
  through verified lineage and a valid original human witness.
  Copied text or an entry ID alone does not establish authority.
  Cross-session revocation linkage remains unresolved.
  Q16 was proposed but not answered;
  the user asked about Voyage-rerank instead.
  The interview is paused while its incomplete assessment is addressed.

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
Those historical probes are finished.
Current inference status is recorded in the candidate-investigation section.
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

A later method-composition probe at
`~/temp/agent/pi-trust-lifecycle-probe-2026-09-26`
passed as `proc_ec6a` with no model calls or real session writes.
It uses actual prompt/command dispatch,
branch/fork methods,
and current project grant functions,
with registry,
UI,
append,
index,
ID,
and filesystem doubles.
A programmatic prompt labelled `rpc` reached the registered `/guard` handler before input callbacks
and appended a directive with `hasUI: false`.
Ordinary text reached the input callback as a positive control.
Moving before a reset exposed the old directive again;
returning to reset cleared it.
An in-memory fork copied the grant's entry ID and text under a new session ID.
These facts require grant-writer witnesses and original-session binding;
they do not qualify a collector or establish a live RPC exploit.

Image:
`d24811aa4ade5e0a2cf7ab1daedc00b6c30d70dc4c079404858a745e562ae7e5`.
Result SHA-256:
`76d454148c75ced5f6f6a0de916990bdc3177c106d3de8b86ec4e1ab7619bc8b`.
Scratch commits:
`a81fa9b`,
`e508b17`,
and `83e9762`.
Copied-source final-LF normalization was checked against original bytes and recorded in `source-manifest.json`.
Node's `stripTypeScriptTypes` experimental warning was retained;
it concerns this research harness,
not a production dependency choice.

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

The user asked:
"Are we overengineering now?"
The agent agrees that source tracing and audit tooling expanded without a decision-focused stopping point.
Task #34 is paused,
not completed;
its evidence and unresolved gates remain intact.
The user subsequently asked to continue working after that narrower proposal.
Task #35 completed the bounded candidate checkpoint at `5d247532a`.
The [three-candidate checkpoint](../audit/tech-pi-auto-mode-axiom-migration-vet-2026-09-27.md)
keeps adoption unqualified and stops the ONNX/source-build expansion.
Task #36's frozen Jev live batch then completed in `proc_647a`:
cache removal took 977.2364449999999 milliseconds,
structured read took 675.6790840000001 milliseconds,
and parsed transfer took 702.3758939999998 milliseconds.
Each profile included preparation and both selected-source calls under one shared five-second clock.
Process/module startup and research-log writes were excluded.
There were six client calls and twelve scalars,
with no client retry or assessed operation.
Complete current policy was retained in every call.

Local shared-clock and guard-omission controls passed in `proc_b912`.
Host-side recheck `proc_4bb3` verified current policy/source identities and actual request bodies,
including identity with the corresponding prior-tranche bodies.
Private budget checkpoints are `0576589`,
`bd65fa7`,
`236e36c`,
and `36bb87b`.
The known false-reference prohibition returned 0.58;
semantic qualification and calibration remain open.
These are tested warm preparation envelopes,
not live authority,
full policy-finalizer,
accuracy,
or production latency qualification.
The batch is finished.
Task #37 resolved the aggregate-audit bookkeeping failure after the required lock interval.
The updater had raised `Report amendment point changed` before writing.
Recovery verified the recorded owner's absence,
a recorded age of 2,142,404 milliseconds,
exact lock identity,
unchanged report bytes,
and absence of a partial report file.
The lock and failure payload were preserved before the corrected atomic edit.
Receipts are `~/temp/agent/auto-mode-budget-audit-lock-recovery.json`
and `~/temp/agent/auto-mode-budget-abandoned-lock-326366.json`.
This establishes no exception for fresh or empty locks.

The user explicitly chose B:
keep integration/design questions deferred and complete a bounded Jev semantic-qualification study first.
Task #38 completed that study under the existing semantic-control repository's `qualification/` directory.
Draft `0e49860` defines a fixed semantic coverage matrix and reuses the existing diagnostic band catalog,
without selecting a production threshold.
Scorer/control source `7d26d64` and local results `f5ff3d2` passed in `proc_e4d3`.
The protocol has 18 profiles,
36 source texts,
and 72 scalars;
35 texts are novel relative to the prior tranche,
and one is an explicitly declared anchor excluded from minimum new-coverage credit.
It requires zero resolved semantic errors and some correct true/false coverage for every source/predicate role,
while reporting operation-specific coverage without imposing an automation-rate target.
The frozen semantic batch subsequently completed in `proc_5f18`,
with raw results at private `c7df3c1`.
The 0.95/0.05 diagnostic band met the finite benchmark gate;
no production threshold was selected.
Postcheck `proc_30a8` output was inspected:
current policy,
frozen sources,
actual request bodies,
and the declared anchor matched.
Private `b447c0c` retains its verified summary and README.
Results for 0.8/0.2 were 64 correct,
2 wrong,
and 6 uncertain;
0.9/0.1 gave 57 correct,
1 wrong,
and 14 uncertain;
0.95/0.05 gave 45 correct,
none wrong,
and 27 uncertain.
All bands met minimum novel-text role coverage,
but only 0.95/0.05 passed the zero-error gate.
Its true request-prohibition coverage rests on one novel example.
The [completed result record](../planning/pi-auto-mode-jev-qualification.md#completed-bounded-semantic-qualification)
retains binding errors,
timing,
token counts,
identities,
and limitations.
Do not repeat the completed study.
For any separately authorized future study,
freeze cases,
reference labels,
scoring,
acceptance criteria,
and stopping conditions before model calls.
The original reserved scenarios remain unqueried.
This new user-authorized study does not reopen source/runtime exploration or permit prompt tuning.
Do not tune prompts,
choose thresholds,
or query reserved scenarios from this batch.
No candidate choice or production implementation is authorized by this continuation.
No constraint is waived,
and old process-completion notifications do not authorize resuming the paused source expansion.
No background process was running when the pause was recorded.

The published Noul baseline #6 and conditional source-feasibility assessment #7 are complete within their stated scopes.
Remaining Laya profile qualification is #25.
Jev work is split into #26 client failure boundaries and #27 broader parser-first semantic controls;
neither is a production implementation.

Task #26 completed its experimental-client scope at
`~/temp/agent/jev-client-failure-boundary-2026-09-27`.
Source freeze `e1f0066` defines fifteen ordinary scenarios and five isolated guard-omission controls.
It copies the previously tested client and helpers,
replacing only disposable endpoint/policy paths and a clock import for the explicit post-result deadline control.
Real loopback HTTP exercises redirects,
malformed/oversized replies,
synthetic echoes,
header/body stalls,
and disposable policy/input changes.
No vendor/model call,
real credential,
training,
assessed-action execution,
account access,
or Mac access occurs.

The exact workstation Node v26.10.0 binary is baked into an already used Debian-based image;
its SHA-256 is `ab9c8eecf9f82d6693cdc3accced17034065c8d96213b0aa76a7e803d20ae1da`.
The container has 2 GiB,
two CPUs,
no added swap,
no external network or host mounts,
and a ninety-second ceiling.
Source checks and image construction passed.
Image:
`e571de1b4573b6dd16d6b2f220c436b1d131467ec43a016e1f523963a087907e`.
Process `proc_fe79` stopped at runtime preflight with exit 127:
`node: error while loading shared libraries: libatomic.so.1: cannot open shared object file: No such file or directory`.
No client case or model call ran.
This is first-party image packaging evidence,
not a Jev/gateway failure.

Task #28 repaired that runtime boundary before #26 resumed.
The added installed x86-64 library is from `libatomic-16.2.1-2.fc44.x86_64`,
source RPM `gcc-16.2.1-2.fc44.src.rpm`,
SHA-256 `b08060687ffb5768003b0c283cac5bddaa84ea5526d4d7bcb5994af98af5a130`.
Its bytes independently match the RPM digest record;
RPM verification also reported `.......T.`,
which was not removed by changing the host file.
ELF inspection found `libc.so.6` dependency requirements `GLIBC_2.2.5` and `GLIBC_2.14`.
The initial manifest and failure remain separate artifacts.
Process `proc_819e` rebuilt the image after the manifest/dependency correction.
Actual preflight `proc_b908` passed:
Node v26.10.0 started and the baked library digest matched.
Task #28 is complete.

Suite `proc_edaf` then passed all fifteen scenarios and five named guard-omission controls,
with no vendor/model calls.
Corrected image:
`bb388e4205d3451bc39fa7e8062d0d4c6b1dd5ea3400edfc889ec4e56bcae2d3`.
The positive control retained six paired-question assessment records;
every failure scenario retained none.
Both stalled transports produced observed connection cancellation before fixture cleanup.
The late-result branch used a scripted clock,
not a latency measurement.
No bare shutdown error or synthetic credential/echo text was accepted in child diagnostics.

The immutable v1 artifact's `recordedEstimates` field names assessment records,
not individual scalar probabilities.
Do not turn the mock replies into model-quality or calibration evidence.
Raw result commit `81243f7` retains SHA-256
`155941906eb24d4bd18591fbbb6927c632d90069ab670c75d3b3bd5a76450272`.
Verifier `05c3536` passed as `proc_afa3`,
checking recorded outcomes,
expected failure categories,
and actual exited-container resource configuration.
Task #26 is complete within this experimental scope.
The sixteen-document render and scoped Markdown lint passed as `proc_53c2`,
and the main worktree was clean after that check.
Task #27 is now active as separate semantic-quality work.
See the [client-boundary record](../planning/pi-auto-mode-jev-qualification.md#local-client-failure-boundary-controls).
These controls cannot establish hosted cancellation/billing,
TLS behavior,
model quality,
or real Pi fallback behavior.

### Broader semantic-control preparation

Task #27 uses `~/temp/agent/auto-mode-semantic-controls-2026-09-27`.
The initial source freeze `469d51a` prepared and checked 23 development states:
15 request texts and 8 eligible-prose texts,
with 46 conditional binary references.
Each selected source is queried for a positive relation and an explicit prohibition,
not a final action.
Neutral texts prevent treating those predicates as complementary probabilities.
An unresolved referent and an unverified authority witness remain model-free exclusion controls.
The original 24 reserved scenarios remain unqueried.

Review corrections are frozen at `ee6dca2`.
Canonical `cases-v2.json` declares synthetic eligibility/binding assumptions explicitly;
active preparation no longer overwrites an authored false value.
Supplied resource aliases are explicit facts.
The same semantic scope rules apply to requests and prose grants.
Preservation wording can explicitly prohibit removal;
this is not a literal search for the word `not`.
Both prose predicates explicitly exclude policy text as evidence of what the selected prose says,
while the client still includes complete current `AGENTS.md` unchanged.

The reviewer called `Inspect package metadata.` a newly authored ablation.
That was incorrect:
both frozen transfer-scope scenarios already contain that exact request text.
Preparation now checks its exact original source and request-only reference axes.
The reviewer also proposed different containment rules for requests and grants;
that asymmetry was not adopted.
`review-disposition.json` records the accepted changes and rejected inferences.

The actual sender imports `wire.mjs` for serialization;
its tests inspect that component's JSON with metadata sentinels,
not a sibling reconstruction alone.
`client-source.json` checks unchanged transport/response and post-result deadline blocks
against the previously tested client.
That source comparison does not requalify every failure path or a live consumer.
Process `proc_5ea7` passed the reviewed fixture and actual-serializer checks,
plus four isolated source/question/authority/binding guard omissions.
Every original control passed;
each omitted guard produced its expected assertion failure without modifying the original.
Current input SHA-256:
`c22b1607f5653eb926dfadfe9fdcc925e875ce7fa7efa3de779f7d77a3262a4b`.
Generated artifacts were frozen at `eaad3d7`.
Native probe `proc_061a` completed 23 sequential requests and 46 scalar observations.
It reported 245,441 input and 943 output tokens;
paired assessments took 257.7406569999994 to 473.556852 milliseconds across different cells.
Every assessment passed policy freshness and its submitted-question budget.
Result `71999e7` retains SHA-256
`feaefa79220c71e878491f6fbb7108e54ed3564f7ae8f576d0ae01a9eabd2320`.
Verifier `proc_768d` reconstructed all actual request/state hashes
and rechecked source identities,
references,
current policy,
and scalar ranges.

The cache cross-clause prose returned positive scope 0.06 and explicit prohibition 0.54,
against false references for both.
The 0.54 observation is preserved without relabeling,
threshold selection,
prompt tuning,
or a claimed internal cause.
Other source-specific ranges and evidence limits are in the
[broader qualification record](../planning/pi-auto-mode-jev-qualification.md#broader-source-isolated-semantic-controls).
These controls do not exhaust destination mismatches,
conditional grants,
or effect-language qualification.
Task #27 is complete within this bounded development scope,
not a qualified production profile.
Main records are committed at `582626258` and `7c6bfdb92`;
sixteen-document rendering and scoped lint passed as `proc_9051`.
Private summary `c811cf1` and README renderer `511d5a0` are retained;
the private rendered check passed and both worktrees were clean.
Task #25 is now active:
inspect the published native binary-choice representation and remaining runtime paths,
without assuming a latency remedy,
training permission,
or accelerator authorization.
The remaining Jev profile/consumer gates stay open,
and integration-policy interviewing remains deferred.

Laya's new private root is
`~/temp/agent/laya-parser-first-choice-controls-2026-09-27`,
source freeze `08d6e90`.
It plans twelve native binary-choice forwards over the corrected two-state request fixture,
with one question/container and fixed `A=false`,
`B=true` mapping.
Reference truths stay outside model inputs;
no Jev output becomes a label.
Source inspection verified the changed type prefix,
type embedding,
and selected binary temperature bucket,
so this is not a pure label rename or a claimed timing remedy.
`proc_7472` passed fixture checks and model-free decoder tests on host Python 3.14.7,
including seven failing shortcut/guard mutations with the original unchanged.
The first image preflight passed as `proc_b0c8` without a model forward.
Pre-inference review led to strengthened source `4390c20`:
shared layout/forward comparisons,
isolated driver-result checks,
tighter probability-sum validation,
complete selected-package Python source identity,
and actual-image helper execution.
Trial inputs and independent references did not change.
`proc_b487` passed eight decoder mutations,
nine dirty input fields plus a shared-comparator omission,
and eleven isolated result-guard omissions.
Artifacts are retained at `773b3d6`.

Reviewed image preflight `proc_c9a4` passed under actual image Python 3.13.15;
both helper suites executed without model imports/forwards,
and all 24 package Python files matched the pinned ledger.
Image:
`0a2b7ff04ddbf65cfe70f8768566c45f55dd9c7fb5ee9ad4f9903b85ad8b9dbd`.
Record:
`8d0705e`.
Native-choice batch `proc_45e5` completed all twelve trials.
Raw result `09555a4` retains SHA-256
`0bf8adc3b90e8e9eb0ea7fef0d5e7b9c8ace6382ff8b526745320095de37ee3b`.
Verifier `proc_7fd1` passed actual source/current-policy,
reference,
marker/type,
image,
exited-container configuration/timestamp,
and non-OOM checks.
Total forward input was 149,936 tokens;
every tested sequence exceeded the declared 8,192 positions.
All twelve native `predict()` calls exceeded five seconds,
with 73.56364870304242 to 144.56432593706995 seconds across different cells.
Those measured CPU BF16 combinations miss the total budget;
this does not reject all Laya runtimes or qualify full consumer timing.

Mapped `probabilities.B` values,
ordered negated-request requested/prohibited then positive-request requested/prohibited:
English 0.5429/0.5782/0.6128/0.4368;
multilingual 0.3486/0.3905/0.5813/0.1471;
typed-decisions 0.5571/0.5159/0.5902/0.4831.
Each cell ran once.
Do not turn these four conditional references into independent scenarios,
classification accuracy,
calibration,
label robustness,
or a cause/threshold claim.
The fixture has neither absence nor conflict controls.
Read-only ONNX follow-up is at `~/temp/agent/laya-onnx-source-audit-2026-09-27`.
It read the monolithic exporter/runtime and split exporter,
plus the matching PyTorch 2.10 export entry point from its Git object without changing the sparse checkout.
Monolithic export inherits `dynamo=True`,
`verify=False`,
and `fallback=False`;
its delegated `_compat` implementation and runtime package inventory remain next source checks.
Split export uses float32 and writes graph files before parity checks,
so file existence is not a verified artifact.
No ONNX export,
installation,
or extra inference was performed during the batch.
After completing the native-choice documentation checks,
continue the pinned ONNX exporter/dependency investigation.
Model-free inspection `proc_b4a9` completed those scripts.
The actual image had NumPy 2.5.3,
Transformers 5.0.0,
and Torch 2.10.0+cpu distribution records.
The inspected path had no ONNX,
ONNX IR,
ONNX Runtime,
ONNX Script,
or protobuf distribution records;
top-level probes for the first four module names were also absent.
No package was imported or installed and no model ran.
The pinned `_compat` source is now read;
its dynamic-axis conversion,
export,
optimization,
and save paths remain source evidence,
not executed export qualification.
`_core.py:1576-1695` has warning/status-and-return verification-error paths,
so do not assume `verify=True` alone is a strict publication gate.

Primary metadata probe `proc_8cdc` reported ONNX 1.23.0,
ONNX Script 0.7.2,
ONNX IR 1.0.0,
ONNX Runtime 1.30.0,
and protobuf 7.36.2.
These are observed releases,
not selected or vetted dependencies.
The first filename filter covered `cp313` and pure-Python tags,
not every compatible ABI;
an empty ONNX result must not become a no-wheel claim.
Follow-up `proc_c248` completed the full fixed-release file inventory and standard-library target probe.
The target reports Python 3.13.15,
`cpython-313-x86_64-linux-gnu`,
GIL enabled,
and glibc 2.41.
The complete ONNX file list contains a `cp312-abi3` x86-64 manylinux wheel;
the initial `cp313`-only filter was not an availability proof.
ONNX Runtime lists both ordinary `cp313` and free-threaded `cp313t` files;
do not silently substitute the latter for this target.
No filename is yet an import,
compatibility,
provenance,
or qualified-export result.
Target tag matching has now passed as `proc_ae26`.
Next:
complete dependency/source/artifact review
and freeze a bounded CPU-only export/consumer manifest before any installation or export.
The ONNX audit root retains the full file/ABI inventory at `b9b04dd`
and unverified publication metadata at `eb8dd6d`.
Integrity API probe `proc_4216` returned publish attestations for ONNX and ONNX IR,
with matching subject digests but no cryptographic verification.
The exact queried ONNX Script,
ONNX Runtime,
and both protobuf variant files returned 404.
Do not equate publication metadata with build provenance/trust,
or a missing PyPI object with unavailable source.
Inert artifact download `proc_1753` then fetched the six exact inventoried wheel files,
33,930,000 bytes total,
with every size and SHA-256 matching primary metadata.
This includes both protobuf variants for inspection,
not simultaneous installation or a production dependency choice.
Download source `ab61900` and inspection preparation `6dd4403` remain private.
Static archive/metadata inspection `proc_539d` completed under two GiB,
two CPUs,
no network or host mounts,
and a sixty-second container ceiling.
Image `61ed561dda2431cbf59b05db9e293287de5460835132defb22905ca8b39d226c`
rechecked the baked archive hashes,
package names/versions,
metadata,
and filename inventories without installing or importing packages.
ONNX has one shared-library filename match,
ONNX Runtime three,
and native protobuf one.
ONNX Script,
ONNX IR,
and pure-Python protobuf have none.
These are filename matches,
not complete content-type detection,
`RECORD` verification,
or executable trust.
ONNX's compatibility `version.py` has an empty `git_version`;
ORT's build-info Python file names the package/version only.
Neither inspected Python field supplies native source-to-build identity.
A separate GitHub SLSA v1 attestation check `proc_ae6d` succeeded for the exact ONNX wheel,
SHA-256 `f336004196a22fbdc16c62e7f26f20635af1826db6147c80ff3b4b8d428fc7ef`,
requiring the pinned `ee3ccbd2b2344299d3a4506c2954a47b2181a485` source digest,
repository,
release-workflow identity,
and GitHub-hosted signer.
`proc_20d1` checked the returned certificate/subject fields
and confirmed rejection of an all-zero source pin.
The verified signed attribution does not establish build correctness,
reproducibility,
ABI compatibility,
or other packages' provenance.
The earlier PyPI publication-bundle metadata remains separately unverified.

`proc_b5ee` read actual-image metadata for the transitive surface:
NumPy 2.5.3,
packaging 26.3,
typing-extensions 4.16.0,
SymPy 1.14.0,
and mpmath 1.3.0 are present;
`ml-dtypes` and `flatbuffers` are absent.
`proc_20d1` retained full primary release file lists for observed `ml-dtypes` 0.6.0
and `flatbuffers` 25.12.19.
Neither package is selected or installed.
Private checkpoint `81b50b0` retains those negative-control/transitive metadata results.
`proc_d7e6` subsequently downloaded the tag-matched ML dtypes and flatbuffers wheels as inert files,
with matching primary-metadata sizes and SHA-256 values.
ML dtypes publication metadata returned HTTP 200;
flatbuffers returned HTTP 404.
`proc_51be` verified the ML dtypes publication signature,
exact workflow/tag identity,
and source digest `6bc762dd106292e1aa0d5de98d3867d6b642f209`.
The adapter only re-enveloped existing certificate,
transparency,
payload,
and signature fields for GitHub CLI 2.101.0;
verification remained in `gh`.
This is publication attribution,
not a SLSA build predicate or native-runtime qualification.

Signature-control harness #29 initially failed as `proc_7fdb`:
`gh` rejected the changed bundle,
but the harness incorrectly required the word `signature` in its diagnostic.
The actual diagnostic was `Error: verifying with issuer "sigstore.dev"`.
Original failure evidence is preserved at private `6415ebd`.
The repaired harness `8001c47` proves only one signature byte changed
and brackets it with fresh original-bundle calls.
`proc_9927` passed original/changed/original statuses zero/one/zero;
its raw paired results were inspected.
The generic issuer message does not identify the internal rejection stage.
The original failing command stopped before combined-wheel preparation or inspection.
`proc_ae26` used the actual image's packaging 26.3 source,
hash-checked against five reviewed files,
under a 128-MiB/one-CPU/ten-second model-free manifest.
All six inspected WHEEL tag sets matched;
positive native/ABI3/compressed-pure controls and negative free-threaded/newer-glibc/other-architecture/older-specific-ABI controls passed.
New-release filename matching selected no runtime dependency,
but identified matching `ml-dtypes` and `flatbuffers` files for further inspection.
Results are committed at private `cb6c69b`.
No ONNX export or model inference has occurred in this follow-up.

Pinned source clones are under the private scratch root:
ONNX Script `onnxscript-laya-2026-09-27`,
`v0.7.2` / `082bfa28e959a4c0639d91b62663c6c59c4dfc42`;
ONNX IR `onnx-ir-laya-2026-09-27`,
`v1.0.0` / `014085ef19fb4467a0f4e539cee1bcc4703c8824`;
ONNX Runtime `onnxruntime-laya-2026-09-27`,
`v1.30.0` / `f2c39fe2f838cf35ce7da92824f5a5e3ee6e88a7`.
They are clean sparse shallow checkouts,
not modified or executed.
ONNX `onnx-laya-2026-09-27` is also a clean sparse shallow checkout:
`v1.23.0` / `ee3ccbd2b2344299d3a4506c2954a47b2181a485`.
Its clone completed as `proc_eae8`.
Source extraction `proc_82ca` copied selected ONNX Script files into the owned audit root;
its `torch_2_9` facade exists and delegates shared functions to `torch_2_8`.
Follow-up `proc_216f` extracted fourteen named execution/release boundary files.
The inspected `torch_2_8` facade delegates shared functions again to `torch_2_6`,
whose inspected `onnxscript/_framework_apis/torch_2_6.py:19` delegates shared functions to `torch_2_5`;
`proc_50f2` extracted that delegated facade,
whose `check_model` explicitly performs no validation.
The source-only checker finding and unexecuted verification cases are recorded in
[the checker-boundary note](../troubleshooting/onnxscript-export-checker-boundary.md).
Do not treat PyTorch's checker-status flag as independently verified structural validity.
The `torch_2_8` optimizer also invokes ONNX fusion rewriting.
`proc_1445` extracted ten further facade/build/release files.
ONNX `.github/workflows/release_linux_cibw.yml:84-100`
sets hardening/lite-protobuf flags and invokes ABI3 validation;
its fetched protoc/protobuf artifacts and nested build configuration still require source review.
ORT `tools/ci_build/github/azure-pipelines/py-packaging-pipeline.yml:63,87`
references the 1ES official template and a CPU packaging stage;
the CPU stage was subsequently read and delegates Linux work to `templates/py-linux.yml`.
That template,
the 1ES parent,
and the exact artifact/build link remain open.
`proc_7c61` queried GitHub SLSA attestations for the exact ORT wheel digest and returned HTTP 404.
`proc_50f2` inspected two ELF members without loading them:
both contain self-reported short source `f2c39fe` and `Release` build-description strings.
One additional string-like occurrence in the Python binding is retained without causal interpretation.
Those bytes are not authenticated build attribution.
Radius search `search_f84e73a53a2e7063537376f86458e539`
and the official source-build document supplied no exact-wheel attestation;
this is not proof that all provenance routes are exhausted.
The subsequently read `templates/py-linux.yml` passes authenticated feed settings into its build container.
Its CPU Dockerfile and `Dockerfile.manylinux2_28_cpu` both reference the same Azure-hosted base tag.
`proc_2e52` received a registry 401 challenge;
`proc_43ea` followed the documented anonymous bearer-token flow and the token endpoint also returned
401 `UNAUTHORIZED`.
No user credentials,
refresh-token request,
image-layer download,
or binary execution occurred.
This blocks anonymous access to that inspected build-image route,
not every possible public source-build route.
The export-only path is being considered separately from an ORT consumer:
PyTorch's non-verification path returns before runtime verification,
but optional ONNX Script evaluator calls still need review and an actual probe.

Additional clean source clones:
`ml-dtypes-laya-2026-09-27` at `6bc762dd106292e1aa0d5de98d3867d6b642f209`,
and `flatbuffers-laya-2026-09-27` at `7e163021e59cca4f8e1e35a7c828b5c6b7915953`.
ML dtypes uses scikit-build-core/CMake,
NumPy headers,
and its Eigen submodule;
no root `setup.py` was found by the initial file read.
No candidate import or exporter image build has run at this checkpoint.

Subsequent static checks completed:
`proc_1a40` inspected all eight inert wheels in image
`c42c66d018ce437903fa8bfd0b511623d9f7e97a3ce17ba6ca8aae8b2c832ecf`;
`proc_74cf` verified every non-self RECORD entry against the archive's exact file set.
`proc_17d5` mapped Python members to pinned Git blob identities.
All ONNX Script,
ONNX IR,
ML dtypes,
and flatbuffers Python members matched.
ONNX matched 504 of 510;
the six unmatched paths are protobuf code/wrappers with identified generator rules.
Each protobuf variant matched 43 of 58;
the fifteen remaining paths are generated protobuf/defaults outputs requiring their generation boundary review.
Both protobuf variants have identical Python-member paths and hashes.
`proc_8b0d` exercised matching,
changed-content,
and missing-source controls;
separate equality and missing-source guard omissions failed their expected tests.
No source clone changed and no dependency code was imported by these checks.

#30 now carries a guard-model-free frontend canary in the private audit's `export-canary/` directory.
It selects five exact frontend wheels,
including pure-Python protobuf,
while leaving ORT,
flatbuffers,
and native protobuf outside the import tree.
The prepared experiment uses explicit non-verifying/non-fallback export flags,
a deterministic arithmetic buffer,
independent valid/invalid checker controls,
and quarantined graph/data output.
It is not a Laya checkpoint trial or a five-second assessment measurement.
Source `3393f3d` and inputs `cfa9bfc` precede later pre-execution review changes.
This preparation checkpoint preceded the image build and candidate imports.

#31 records a resource-validation repair before #30 proceeds.
The installed Podman help and actual HostConfig contradicted review claims that `--timeout`
was stop grace and that `--cpus=2` lacked quota/period fields.
`proc_fe02` terminated the finite timed control,
but its Node assertion guessed exit 137 instead of observed CLI 255/OCI -1.
Initial evidence remains at private `adf9d82`.
Corrected fresh controls `proc_7082` passed natural/timed outcomes,
resource/configuration assertions,
and distinct runtime/stop-timeout values.
The parent now normalizes the exit representation,
checks omitted resource fields,
and the canary has pre/post kernel-limit checks.
Those kernel checks passed in the subsequent `proc_dfe2` canary.
The pre-review source manifest is archived and refreshed hashes retained.
#31 evidence is retained at private `326e6c3`;
only its four owned exited resource-control containers were removed after retention.
#30 execution now passed:
`proc_2888` built image `67e3fbe2fe272445ac3503daf9b606bcfb2215d286df77da3cf6103571a01fb8`;
`proc_b473` passed the original guard and five individual omission expectations;
`proc_dfe2` imported the five frontend packages and completed the toy export/check/reload path without ORT.
The valid checker control passed and the undeclared-input control raised `onnx.checker.ValidationError`.
Only the expected staged native imports occurred outside synthetic controls.

Host-side recheck `proc_c941` verified actual exited-image identity,
baked source hashes,
quarantined bytes,
and resource evidence.
The observed whole-canary memory peak was 337,326,080 bytes under the two-GiB/two-CPU profile.
`proc_8bd0` parsed the graph without inference:
one `Add` node,
no model-local functions,
and a 512-byte external float initializer.
The graph is 1,323 bytes.
Result SHA-256 is `ce4915838f8935383dfd2e17773e2fb410cc950507e3fe9cf525bb19dbfe52a9`.
Raw results are at private `39f76be`;
verification source/evidence follows at `4d17745` and `be07523`.

Torchvision registration warnings and the LeafSpec FutureWarning remain in the raw stderr.
Their source and scope are documented in the
[checker-boundary note](../troubleshooting/onnxscript-export-checker-boundary.md#separate-retained-exporter-diagnostics).
No warning was filtered.
The graph/data remain quarantined and unpromoted.
This proves the exact frontend's toy path only,
not Laya exportability,
numerical parity,
full-policy context behavior,
assessment latency,
or ORT consumer qualification.

`proc_9941` passed the seventeen-document render/scoped lint checkpoint.
The host-side recheck is separate execution,
not independent authorship or code review.
No-inference/guard-load flags are program-scope declarations,
not measured counters.
Only the owned exited canary container was removed after verification and source-copy retention;
the immutable image and quarantined files remain.
#30 is complete within its bounded frontend scope.
Final main render/lint `proc_fd07` and private README renders `proc_dfcb` passed;
main checkpoint is `1e788cff9`.

#32 now blocks broader #25 and prepares the separate Laya producer.
Private source/preflight `9af16ad` and result `ae0cf7e` live in `export-laya/`.
Metadata-only `proc_cce5` matched 24 Laya and four selected Transformers source files in the actual image.
It found no baseline kernels or ORT module;
Torch/Transformers/tokenizers/safetensors versions were recorded.
Checkpoint file sizes matched but content hashes were not checked by that metadata command.
The preinstalled Laya location remains present,
so the eventual producer must select and verify `/input/source/laya` explicitly.
No Laya import,
checkpoint load,
or export occurred in that metadata preflight.
Later layout controls imported Laya without weights;
the separately frozen producer attempt is recorded with its own result.

The pinned upstream exporter calls `agent.model` directly with random sixteen-token input.
The owned producer must instead use complete current policy and an existing development axiom,
and distinguish explicit FP32 export from the previously measured BF16 `predict` path.
Current policy SHA remained `4731752e57e66bf587462e86aff22cbae7b4f073cb1f125f965438268e7c064b`.
ModernBERT SDPA/mask/RoPE,
optional kernel imports,
and Torch named-dimension source were read;
no export-shape compatibility is claimed.

#32 first-party handoff controls now passed as `proc_4968`:
copying occurred while the fixture container was alive,
a valid digest was acknowledged,
and a wrong digest was refused.
`proc_b105` removed only the committed hash equality check in an owned derivative;
the wrong digest then received an acknowledgement and the expected test failed.
Raw evidence is retained at private `19702d3` and `393aa5e`.
Only the four owned exited copy controls were removed after retention.
Streaming-copy control `proc_cca7` also passed with 268,435,456 bytes,
one-MiB chunks,
a 64-MiB Node heap,
and one GiB/one CPU in the container.
Evidence is at private `ce5ca63`.
No full-model transfer throughput or combined memory fit is measured.
Forced exit loses uncopied tmpfs contents;
retain durable logs/partial host copies without claiming complete artifact recovery.

Capture controls `proc_68ff` also passed under two GiB/two CPUs/60 seconds.
Direct capture retained the valid `2..8` range and symbolic ONNX axis.
A fixed reshape accepted its fixed input but rejected that incompatible direct range.
The combined ONNX wrapper with `fallback=False` returned a graph fixed at length four.
Its structural checker passed;
that is not the originally requested variable contract.
Source and the non-isolated deferred-assert flag difference are recorded in
[the shape-contract note](../troubleshooting/pytorch-onnx-shape-refinement.md).
Source is private `7e3e4a7`,
raw/result/artifact bytes `d53a844`.
The owned exited capture and scaled-copy containers were removed after evidence retention;
quarantined artifacts remain.

#33 addresses a separate first-party audit-hook coverage gap.
`proc_c2b6` confirmed the archived hook did not match synthetic
`os.fork`,
`os.forkpty`,
`os.posix_spawn`,
or `pty.spawn` events.
No process operation was called by that probe,
and it does not show that any prior canary spawned a process.
Do not treat the original selected controls as complete Python process-event coverage.
Archived sources/results remain unchanged.

Producer-only `export-laya/boundary.py` now has SHA-256
`733dc5654f774a56f2e291c9a6a38264b7a27939bbb9e7f40022aa854cad463d`.
`proc_da6c` passed its 12 rejection/three allowance controls,
and all eight process-family/four non-process omissions failed as expected.
Evidence is private `29e60e9`,
`d805954`,
and `1ca9658`.
This is live Python-hook dispatch with synthetic events,
not a native syscall sandbox or actual process-API exercise.
The full suite passed on the actual derived producer image as `proc_f772`.
Repeat it for a changed image.

#32's first full-policy producer passed as `proc_5da8`.
`proc_ee64` froze the existing English negated-request/choice fixture and current full policy.
`proc_a512` built image `5da5309750c91f4ebac7000bcde671bb87795c2c067259ec6001022f484b0e2e`.
`proc_a121` checked ten baked producer files and 36 inherited sources;
`proc_2d25` passed 14 real-tokenizer/layout and 27 graph/external-data cases.
Those cases are not exhaustive fuzz/branch coverage or individual omission proof for every redundant check.
The runtime manifest is private `8a01e7a`,
with baked manifest SHA-256 `7828170f30b5f44cbb22619089eedde5ab91e5428358c4719c39abf3502e4f79`.

The attempt verified five checkpoint hashes before loading,
asserted CPU/FP32/evaluation state,
and used the demonstrated direct-capture composition.
It retained 42,677 policy bytes,
12,591 state tokens,
87 prefix tokens,
and 12,678 total tokens.
Current policy SHA remained `4731752e57e66bf587462e86aff22cbae7b4f073cb1f125f965438268e7c064b`
through launch,
quarantine acknowledgement,
exit,
and host recheck.

Direct capture retained range `2..20000`;
both token/mask inputs retained shared symbol `s53`.
Structural checking,
external-reference checks,
IR reload,
source postflight,
and copied hashes passed.
The graph has 4,355 nodes,
39 standard-domain operator kinds,
no local functions,
and 203 external tensors.
Pre-handoff cgroup memory peak was 4,739,661,824 bytes,
not the final lifetime peak or a minimum requirement.
The child's timer including handoff was 24.631399751175195 seconds;
this is research export timing,
not inference or a total assessment.
Container exit was zero with no OOM.

`producer-quarantine-initial/laya.onnx` is 7,412,394 bytes,
SHA-256 `24c550312500bc57a1aa07c1a5dda2c42774a63dd77e128f25250a5b98be47d3`.
Its data companion is 1,685,258,240 bytes,
SHA-256 `9489d054cbafcc53a841c39aa195c84638f5ffc52a51c1dad90b9fcaf7b09d08`.
Raw results are private `d4ee2b9`;
summary is `80dd553`.
Result SHA-256 is `ea90423b4c181160dc24c7c69d78ab3445194c1808a0e798021494c301c7b21b`.
`proc_3e43` re-derived host hashes and checked the actual exited image,
policy,
range/axis binding,
and operator inventory.
It is executable same-session rechecking,
not independent review or numerical equivalence.
All warnings remain in raw stderr.
Artifacts remain quarantined and unpromoted;
the owned exited producer container was removed after host-side evidence rechecking.
Its immutable image and quarantined graph/data remain.

#32 is complete within the bounded producer scope.
Main checkpoint `cfb8b55e4`,
eighteen-document render/scoped lint `proc_65f4`,
and private renders `proc_15b3` passed;
the worktrees were clean after those checks.

#34 now blocks broader #25 and investigates official CPU consumer publication/source-build routes.
The finite private schedule is `consumer-route-schedule.json` at `ece382b`.
Metadata process `proc_e2cd` completed;
raw responses and summary are private `9186a80`.
The initial official release listing names the Linux x64 CPU archive at 11,306,877 bytes,
with digest `a5ed5a3cac51fbb2e90da632ae43d19212faaa20e76484e62bcb7c23ddb3b3fd`.
That release metadata is not authenticated source/build attribution.
That CPU archive's exact-subject GitHub attestation lookup returned HTTP 404.
Official `onnxruntime-node@1.30.0` and `onnxruntime-web@1.30.0` metadata both returned 200.
Both advertise integrity and registry-signature records,
but neither returned `gitHead` or a `dist.attestations` pointer.
Those unverified registry signatures are not build/source attribution.
Node's package metadata declares a postinstall entry point;
Web declares a prebuilt-Wasm pull script.
Inspect their pinned publication/build/install paths and primary attestation routes next.
`proc_8a42` found a successful Web CI run and 63 successful runs at the exact source pin,
with all query pages retained at private `62a42e5`.
The selected Linux CI `34444839882`,
Linux CPU minimal `34444839366`,
and Web CI `34444840015` artifact listings each returned 200 with an empty list in `proc_5b37`.
Those results are private `da0c6c8`;
they establish no currently listed artifacts for those runs,
not why artifacts are absent or that every source-build route is unavailable.
Pinned source copies/ledger from `proc_95f3` are in private `consumer-source/` and `consumer-source-ledger.json`.
The Linux reusable build and publication paths remain source follow-ups.
The pinned build action `8bad63a3c05d448311dfa8e5f531171c97471aa1` was cloned read-only;
`proc_4aee` extracted its embedded sources without running its bundle.
The inspected checksum/cache logic is not a complete build-input receipt.
The ORT tag is lightweight;
GitHub reports the source commit's signature as valid,
which does not authenticate a binary build.
Private `consumer-attribution-followup.json` retains those distinctions and review corrections.

The official CPU archive was then acquired inertly in `proc_7524` with matching release size/hash.
`proc_ca7c` passed bounded standard-library parsing and byte-identity controls,
without disk extraction or candidate-library loading.
Its 41-member archive expands to 30,464,000 bytes.
Archive and wheel shared libraries each have 28,985,152 bytes,
but their SHA-256 values differ:
archive `245a6f8c38127551057a1cd1ffd59f0a186a227ade4f3492dea2494eb565542e`,
wheel `c902c70b3003c0e99fada202f37478c515ae9bba7944c2b2abd0017bae0c82ed`.
The cause is not established.
Plans/source/results are private `0081038`,
`eacbbe7`,
`6101efa`,
and `739ede1`.
The [attribution troubleshooting note](../troubleshooting/onnxruntime-artifact-attribution.md)
records source excerpts,
controls,
and limits.
No new consumer has been installed or executed,
and these route-specific results do not establish universal provenance absence.
Continue source/build-route inspection and consider the already pinned ONNX package's reference evaluator
as another CPU consumer source path,
without assuming it is qualified or meets the deadline.

The reference-evaluator investigation now uses pinned ONNX 1.23.0 source
`ee3ccbd2b2344299d3a4506c2954a47b2181a485`.
`proc_1d32` extracted its initial source set;
`proc_cd31` extracted 196 directly imported operator modules,
retained at private `8310324`.
The standard-library AST-only probe `proc_8a61` inventoried 205 Python files and 977 declared imports,
and mapped all 39 retained graph operator kinds to direct class-name/version candidates for opset 18.
Private `3d04920` and `3d3e422` retain source and results.
This does not prove runtime registration,
shape/dtype support,
parity,
or deadline fit.
The operator package eagerly imports its registry modules,
so reviewing only the selected graph operators would miss import-time paths.
The inventory includes conditional and type-checking imports;
`PIL.Image` occurs inside the unselected `ImageDecoder._run`,
not as a demonstrated requirement for this graph.
`proc_cb23` extracted the seven additional helper modules,
retained at `57c013e`.
`proc_f95b` then matched all 212 current Python source copies,
527,164 bytes,
to the retained ONNX wheel/source map,
verified unchanged from historical `fbbf53f`.
The join result is private `0528dbc`.
This preserves an attributable source route without claiming whole-consumer admission.
Continue helper/import-time and selected-operation review;
no reference evaluator has been imported or run.

The deferred Linux/Wasm reusable workflows and delegated run-build/setup-tool embedded sources
have now been read completely.
`proc_56d2` retained their identities at private `4e0e7a2`;
findings are in `consumer-build-delegation-notes.json` at `c73ee3c`.
The CI run wrapper probes NVIDIA availability independently of requested providers,
conditionally adds GPU access,
and mounts host paths without this study's resource/isolation settings.
Do not invoke it as the bounded CPU experiment.
The setup source checks newly downloaded archives but returns existing tool-cache hits first;
its vcpkg path executes a bootstrap script.
No cache fault,
artifact-list deletion cause,
or global source-build impossibility is inferred.
No upstream action or build was executed.
The [artifact-attribution source trace](../troubleshooting/onnxruntime-artifact-attribution.md)
records exact paths and excerpts.
The next prepared source extraction is `prepare:reference-core-sources`,
covering ONNX schema binding,
serialization,
and dtype boundaries without compilation or evaluator execution.

Continue unresolved consumer provenance,
numerical parity,
execution fit,
and context/semantic qualification.
Do not treat producer success as qualified inference or reuse these timings as the five-second assessment result.
The MIT license,
build metadata,
version-only setup logic,
and primary CI matrix were read;
this is not complete source/build/consumer qualification.
The probability field remains the predeclared true option,
and recorded temperature means source-selected configuration,
not a separately captured decoder intermediate.
Preserve eight GiB,
two CPUs,
no added swap/network/mounts/accelerator devices,
and the 300-second research ceiling per container;
no production deadline is relaxed.
No calibration,
training,
threshold selection,
production change,
account access,
or Mac access is authorized by this preparation.

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
The archived run recorded 0.86 for a single-quoted literal read claim
and 0.95 for real substitution.
The model-quality conclusions drawn from that quoting comparison are withdrawn:
Bash structure is parser-owned,
not a model test.
Retain only the scoped runtime/input-delivery evidence.
Cache grant contrasts were 0.37 versus 0.98;
transfer grant contrasts were 0.24 versus 0.96.
Do not select thresholds from these development observations or infer whole-guard accuracy.
Scratch commit `cf8a7fc` retains the result and quote control.

Todo #11 is complete for Voyage interface/feature fit only.
Todo #16 was paused for the candidate-research priority correction.
Its effect/authorization contract and code-owned witness/freshness tests remain incomplete.
The completed Jev/Respan checkpoint does not authorize implementation
or establish readiness of the still-incomplete Voyage assessment.
The design interview remains paused.
The inventory honors Q13 B.
Joint permission binding is required even within one grant:
separate operation and target mentions cannot be combined across clauses.
Standalone directive prohibitions must also survive alternative permission witnesses.

That historical Laya sequencing checkpoint does not authorize resuming source exploration.
The active bounded checkpoint is recorded in the Respan candidate section;
task #34 remains paused.

### Laya investigation still incomplete

Task #6 was reopened at this historical checkpoint and subsequently completed the published native baseline.
Broader runtime qualification remains deferred under #25 and the paused #34;
do not resume it from this historical record.
The [Laya qualification record](../planning/pi-auto-mode-laya-qualification.md)
tracks the bounded candidate work;
no integration interview has resumed.

Process `proc_c075` completed twelve English CPU BF16 trials with full policy,
no OOM kills,
and passing freshness/forward-input checks.
Private root:
`~/temp/agent/laya-axiom-labels-2026-09-26`.
Scratch commits `9f62f00` and `1e2e544` freeze inputs/driver;
`baed175` retains the result.
Result SHA-256:
`5db4e9aefe3f6d0c3b89437a1c1102f6bf16c9070220582123b47bb8a11ced3f`.
Image:
`3f57df19a7dd3297bd712336ea63e4b3b493c27deffe2893a2e7e02a4f062823`.

The default color control returned 0.5378 for blue against true
and 0.5894 for orange against false.
Opaque assignments changed that ordering in this single run.
Literal/executed read estimates were 0.5403/0.5398 by default,
0.5182/0.5187 for false=A and true=B,
and 0.5241/0.5231 for the reverse assignment.
Noul is rounded to four decimals;
no raw logits were captured and no significance or calibration is established.
All trials exceeded five seconds of inference,
with measured durations from 141.08666695607826 to 173.88067755522206 seconds.
Inputs were 12,574 or 12,782 actual forward tokens,
beyond the declared 8,192 positions.
Retained input is not context-quality qualification.

The unchanged-image repetition batch `proc_3890` completed and was inspected.
Private root:
`~/temp/agent/laya-label-repeat-2026-09-26`.
Scratch commit `9b72a56` froze it;
`498c492` retains results and the measured summary.
Including the original run,
the blue control returned 0.5378 in all three observations
and the literal false case returned 0.5403 in all three.
Their inference ranges were 141.59633065015078 to 142.77544056624174 seconds
and 143.68281278014183 to 174.7530222190544 seconds respectively.
The latter measured spread is 31.07020943891257 seconds;
do not credit single-run timing differences inside that range to a configuration change.
This does not establish variation for every other input or label assignment.
Result SHA-256:
`06ed361cfcf1d066e70e4f32f0b182a499e6aa94235c4bb7e89bb5394c4f5142`.

A fourteen-trial follow-up is frozen at
`~/temp/agent/laya-checkpoint-axioms-2026-09-26`,
scratch commit `4c1022a`.
It tests the same control/quotation states with default Noul on multilingual and typed-decisions,
plus the existing cache grant pair on English under all three label assignments.
Fixture and driver checks passed.
Image build `proc_6cf8` passed,
but initial run `proc_0f87` stopped before model loading with
`Checkpoint artifact ledger is incomplete`.
The inherited image ledger contained English artifacts only.
That was a first-party probe packaging error,
not a Laya capability failure.
Scratch commit `87d36cf` retains the failed result and copied ledger;
`6d9274f` explicitly bakes the complete reviewed ledger and adds staged/baked checks.
Removing the new guard caused `Missing expected exception (ArtifactLedgerError)`;
restoring it passed.
The actual old image failed the new baked check.

Corrected process `proc_7f3f` completed and was inspected.
Its baked-image check passed with all fifteen artifacts and three checkpoint identities,
without importing a model.
Corrected image:
`eaf3c7508954f11c879bbc7162c81d9504aaa9e0c9356c4e21a1f21361c70cca`.
Scratch commit `570fb5b` retains `result-ledger-fixed.json`,
SHA-256 `8ef510d6437cb0817db2cb532d8285364540fd5278a4453aa1f661e0ce2425cc`.
All fourteen trials passed input/freshness checks and exited 0 without OOM kills.
None completed inference within five seconds.
Multilingual measured 73.18491603527218 to 76.15995599981397 seconds;
typed-decisions measured 146.92294748313725 to 174.76137589570135 seconds;
English grant trials measured 148.34310482395813 to 179.10930500691757 seconds.
The [qualification record](../planning/pi-auto-mode-laya-qualification.md)
retains the raw values and their withdrawn quotation-quality interpretation.
No checkpoint is silently substituted,
no temperature is refitted,
and no reserved case is used.

The model-free preparation probe `proc_610b` passed at
`~/temp/agent/laya-training-input-audit-2026-09-26`.
Scratch commits `9f921f1` and `c20421f` retain it.
Result SHA-256:
`b1895a4b37b3907e9a9cbec8037a2d4ce40f2ca0a1a41fc32f02d77495fcfa04`.
Image:
`9887ea1741517968a5caa5f0a479205d419669ae7fd9b2f81d1ad9b7db6252b6`.
An item encoded at 512 stayed at 512 after worker configuration changed;
explicit re-encoding produced 1,024,
while complete input required 12,553.
The actual question-item splitter overlapped 345 synthetic states between training/calibration;
a whole-state control overlapped none.
This is not a measurement of the real dataset's bias.
No model forward or optimizer step was performed.
See the [source trace](../troubleshooting/laya-finetune-input-boundaries.md).

The current notebook withholds calibration item indices from optimization,
which differs from the still-unqualified calibration of the published typed-decisions checkpoint.
Do not conflate those artifacts or assume every phrase about training items means identical optimizer samples.
The benchmark card describes teacher agreement rather than independent truth.
No benchmark gold or Jev output is authorized as our training labels.

Read-only GPU inventory identified PCI `1002:7480`,
KFD target `110002`,
and 8,573,157,376 VRAM bytes,
with 6,922,715,136 used at one instant.
The host is Bazzite 44 with kernel `7.2.0-ogc6.1.fc44.x86_64`.
Current AMD documentation lists gfx1102,
and PyTorch HIP reuses the CUDA interface spelling;
NVIDIA-only or GPU-impossible claims would be unsupported.
No accelerator runtime was initialized,
installed,
or allocated.
Device/driver/operator fit,
resource authorization,
and isolation remain unverified.

The corrected published-Noul baseline is tracked under #6.
Broader probability qualification and remaining configurations are retained under #25;
source-supported fine-tuning feasibility is recorded under #7 in the
[feasibility note](../planning/pi-auto-mode-laya-finetune-feasibility.md).

The inspected notebook adapts encoder and head with an RLCD/soft-cross-entropy loop.
Laya also exposes `detach_encoder` and head-checkpointing boundaries;
its gradient tests were read but not executed because they perform optimizer steps.
No source-supported mechanism establishes a guard-quality improvement,
training-memory fit,
or a remedy for the measured latency.
The already measured preparation/grouping gaps remain applicable.
New source inspection also records the notebook's fit interval of 0.1 to 10
versus the serving clamp of 0.5 to 5,
without claiming an unrun fit would leave the serving interval.

The README-linked stuntd source was inspected only as a frozen-encoder/head-training precedent,
not a promoted assessor or selected dependency.
Clone:
`~/temp/agent/stuntd-laya-finetune-source-2026-09-27`,
revision `102a63116ef597231e3b2aa1455dea583e099cc0`,
manifest version 0.1.1,
Apache-2.0.
No install,
service,
capture,
training,
or test suite ran.
Its advertised provider-answer capture/distillation workflow is not authorized here;
manual import exists but is not a qualified guard-training pipeline.
Its trained heads use a choice representation,
its layouts do not assert complete-policy retention,
and its holdout is reused for temperature/operating-point selection and reported metrics.
Do not borrow its demo performance or treat training-time encoder caching as a serving-latency result.

The browser-specialization README was read at Hugging Face commit
`642bacc1cb65f55c0af6e0e1178b6d48634a327a`.
It documents a different task and shortened state;
its reported hardware,
quality,
and timing are not this guard's measurements.
The conclusion is conditional source feasibility only,
not a training or production recommendation.

Keep the agreed resource bounds and distinguish measured deadline misses from rejecting every fallback workflow.
Training and rented compute still require separate authorization.

### Jev investigation still incomplete

Native development batches,
context overflow probes,
and pinned gateway-source observations are available.
Broader qualification and outstanding model/service evidence remain open under todos #2 and #14.
The 15-case development batch is not calibration or a complete evaluation.
Its mixed quality aggregate is quarantined by the parser-boundary correction.
The [Jev qualification record](../planning/pi-auto-mode-jev-qualification.md)
records completed read-only metadata/service research and the eighteen-request shared-control batch `proc_baf9`.
The latter measured 262.319438 to 741.3148530000001 milliseconds per assessment,
with complete submitted policy and passing freshness checks.
Its quotation estimates are historical outputs of a wrongly delegated task,
not evidence for selecting or rejecting Jev.
Gateway account settings were not independently verified:
the available browser profile reached login,
and the inference-key API does not expose retention settings.
The user subsequently declined dashboard access,
reported metadata-only logging,
and authorized all assessment content through LLM Gateway/Jev.
Do not pursue further account-settings access or treat its absence as a consent blocker.
Do not reopen the accepted AUP,
retention,
or gateway-internal retry choices.

### Voyage-rerank investigation has bounded findings

Todo #11 completed interface and raw-feature fit work only.
It did not qualify an axiom probability mapping,
auxiliary role,
or the entire service.
Keep relevance scores distinct from truth probabilities and explicitly state which remaining questions affect eligibility.
Do not treat the withdrawn final-verdict pilot as quality evidence or silently introduce training.

### Deferred integration work

Original-request witnesses,
grant-writer provenance,
branch/fork binding,
revocation finalization,
old approval reuse,
manual prompts,
deadline/retry/cancellation paths,
and real Pi consumer integration remain unimplemented.
The Jev and Respan bounded studies are complete,
but Voyage's corrected qualification and probability mapping remain unresolved.
The user asked about that gap instead of answering Q16;
do not resume the interview on a claim that candidate investigation is finished.
Broader service and production-qualification gates remain open.
Preserve the original 24 reserved scenarios;
do not tune definitions or thresholds to reserved model results.
No winner or adoption-ready recommendation exists.

## Artifacts and commit checkpoints

Key commits include `1d2537e8b` for Q13 B,
`9b7de69b1` for the aligned effect contract,
`c955c345b` for BF16 audit evidence,
`60e65241d` for Pi provenance findings,
and `5b6200b34` for their contract implications.
Only scoped documentation was committed in the main worktree.
Unrelated music-player work and `tmp/` must not be reset or cleaned.

The current authorization-context audit fingerprint is
`80e67cc07b2eb898054d15ddd04e91bb689fbb4c8ebb77aee5c4ba3cd6f9a8d2`.
Commit `de7a5a1e5` records the bounded Pro/OpenRouter authorization context.
The initial Respan `d5b5b9cdfae6f38c9958ab2eaf7d39b8026b9bb3ed61965bcefbf56451de9170`
and pre-Respan `51edb8223a030345de584932d5273ecd90ead6753011d84fefb7b9505f218d67` contexts remain preserved.
The historical `4a2938840ff56544f24ad0d2dd543431c94baa1e18db815adb8ee68af297ea8d` report is also archived,
not relabelled.
Commit `a44920f9c` records the pre-Respan context fork.
`~/temp/agent/auto-mode-current-audit.json` identifies the current path and full fingerprint.

Audit updates use private per-path locks,
pre-edit hash checks,
and atomic sibling-file renames.
The helper is `~/temp/agent/auto-mode-route-audit-update.mjs`;
it reads the current-context manifest and accepts exact replacement pairs as its argument.
Do not run old-context amendment files unchanged.
The historical broad formatter is `~/temp/agent/auto-mode-doc-format-current.mjs`.
The bounded Respan checkpoint uses `~/temp/agent/auto-mode-respan-result-format.mjs`
with an explicit scoped path list;
do not assume the historical list contains newly added reports.
Both select reports by full metadata fingerprint,
then last-updated date and lexical path,
not by assuming one filename per subject.
The shared helper and disposable tests are in
`~/temp/agent/auto-mode-report-context-2026-09-27`.
Commits `ebec922` and `15e755f` retain the context checks and a failing full-fingerprint-filter omission control.
Update the formatter's explicit path list when adding scoped documents.

Do not generalize the earlier interrupted-lock recovery into a stale-lock rule.
The governing skill requires an absent process and a recorded start older than thirty minutes.
An empty record cannot establish those facts;
leave uncertain locks in place and report the conflict.

The nine-document format/render/lint run `proc_0fea` passed and its output was inspected.
Commit `618d05404` retained the resulting provenance and handover formatting.
The eleven-document format/render/lint run `proc_5ce4` passed and its output was inspected.
It included the Voyage fit and troubleshooting documents,
current audit,
and handover.
The subsequent citation/checkpoint edit passed the inspected eleven-document check `proc_3a0f`.
The Pi lifecycle findings passed the inspected eleven-document check `proc_1490`.
The Laya candidate documents passed the thirteen-document rendering and scoped lint run `proc_df32`.
The repeat/packaging-recovery checkpoint passed the inspected thirteen-document run `proc_1473`.
The Jev record and parser-boundary correction passed the inspected fourteen-document run `proc_5466`.
Repeat the scoped formatter/render/lint workflow after further documentation edits.

A subsequent audit-update Bash call reported `Command timed out after 30 seconds`.
The expected amendment had not landed,
no updater remained,
and its scoped lock was empty.
An initial inspection wrongly assumed valid JSON;
checking bytes before parsing corrected that inspection.
The open-file inspection was validated with a held-descriptor positive control,
then found no file user after the descriptor closed.
The empty lock was preserved,
not deleted,
at `~/temp/agent/auto-mode-interrupted-audit-lock-1952303.empty`.
Evidence is `~/temp/agent/auto-mode-audit-lock-recovery.json`.
Process-managed rerun `proc_41a0` passed,
and the expected report section was verified in the resulting file.
The timeout cause was not established;
this was not Laya inference or Jev model-quality evidence.
Todo #22 is complete.
A final scope clarification distinguishes reusable trust directives from exact-action approvals.
That clarification was rendered and its scoped Markdown lint passed after commit `6fa854714`.
The user subsequently chose Q14 A and Q15 B,
while correcting the premature integration interview.
This handover records those answers and the return to candidate investigation.
The in-memory probe still does not qualify persisted replay.
The dependent inheritance/revocation questions were deferred until the chosen bounded semantic work finished.
Only the bounded Jev and Respan studies are now complete.
The attempted resumption with Q16 was interrupted by the user's Voyage-rerank question;
Q16 remains unanswered and the interview is paused.
No candidate has a qualified production selection,
and no production implementation is authorized.
