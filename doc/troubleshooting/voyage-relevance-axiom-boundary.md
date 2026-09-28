# Voyage rerank-3 relevance is not a qualified axiom probability

## Symptom

The auto-mode migration needs probabilities for narrow claims,
with deterministic code choosing the final action.
The verified legacy Voyage `rerank-3` API instead returns document relevance.
Interpreting that number as P(true) would cross an unqualified semantic boundary.
No production migration or resulting authorization failure occurred.

A public synthetic probe returned identical relevance values for literal and executed command substitution,
despite opposite independently authored read-attempt references.
It also ranked a cross-clause transfer grant above a correctly bound transfer grant.
These observations do not violate the documented relevance contract.
The user subsequently corrected the task boundary:
Bash quotation interpretation belongs to our existing parser,
not these models.
The quotation-based candidate-quality comparison is withdrawn.
The [parser verification](../handover/pi-auto-mode-axiom-evaluation.md#parser-boundary-correction)
records the actual incumbent's positive and negative outputs.
Historical scores remain raw observations;
the relevance-versus-probability contract distinction does not depend on them.

## Contract trace and cause

Read-only source:
`~/temp/agent/voyage-openapi-source-2026-09-26`.
Repository:
<https://github.com/voyage-ai/openapi>.
Revision:
`d638a2a8d9d535a850e7b0d664e49e65934f3bde`.
The specification is MIT-licensed;
no upstream code or dependency was executed.

The published contract receives a query and document strings.
At `voyage-openapi.yml:550-565`,
it returns indexed relevance,
not claim truth:

```yaml
# voyage-openapi.yml:550-565, excerpt
                  data:
                    type: array
                    description: 'An array of the reranking results, sorted by the
                      descending order of relevance scores.

                      '
                    items:
                      type: object
                      properties:
                        index:
                          type: integer
                          description: The index of the document in the input list.
                        relevance_score:
                          type: number
                          description: The relevance score of the document with respect
                            to the query.
```

A caller must preserve `index` identity when reading sorted results.
Neither this number schema nor the
[current Atlas rerank contract](https://www.mongodb.com/docs/api/doc/atlas-embedding-and-reranking-api/operation/operation-rerankdocuments)
defines the returned number as the probability of an arbitrary axiom.
The specification's model roster predates `rerank-3`;
its old context limits are not attributed to that model.
The live call independently verified the response shape for the explicitly requested model label.
An echoed model label is not independent serving-model attestation.

The error would be in a consumer that equates relevance with truth,
not necessarily in the service's ranking.
No private serving implementation was inspected,
so this record does not attribute the observed ties or orderings to a model architecture,
precision mode,
truncation,
or training defect.

## Verification

The private first-party harness is
`~/temp/agent/voyage-axiom-features-2026-09-26`.
Scratch commit `c19da8b` froze the client before inference.
Commit `6d31b0d` retains the result.
No fixture command was executed.
Only public synthetic development states and complete current `AGENTS.md` were submitted.
Independent truth labels remained local.

From that directory,
the verified offline command is:

```sh
# ~/temp/agent/voyage-axiom-features-2026-09-26
mise --no-env --no-hooks run test:boundaries
```

It passed request-construction checks and malformed-response checks.
Removing the already committed repeated-index guard caused Node's
`AssertionError [ERR_ASSERTION]: Missing expected exception (RerankResponseError).`
Restoring it passed.
The test also verifies that finite raw scores outside the unit interval are not rejected as malformed probabilities.
This tests decoder semantics,
not a claim that the live model emits every schema-admitted number.

The live command was:

```sh
# ~/temp/agent/voyage-axiom-features-2026-09-26
mise --no-env --no-hooks run probe
```

Its first-party mise wrapper resolves only `AUTO_MODE_VOYAGE_API_KEY` from the root environment.
No credential is printed or persisted.
The client rejects redirects,
uses no client retry,
and caps Node heap at 256 MiB,
requests at 1 MiB,
and responses at 64 KiB.
Each separate assessment has five seconds including preparation,
parsing,
and freshness checks.
The four sequential experimental requests do not qualify the complete per-action guard deadline.
The existing result path is create-new guarded;
repeating the live command against it is not a fresh experiment.

### Working patterns

Process `proc_853d` exited 0.
All four requests returned HTTP 200,
with ten document scores and 116,660 reported total tokens.
Durations were 459.2234870000002 to 765.136248 milliseconds.
Current-policy checks passed for every request.

The retrieval control with policy present distinguished package-reading evidence,
0.76953125,
from an unrelated recipe,
0.439453125.
This verifies observable topic separation,
not model attention to the policy or internal token preservation.

The cache-grant contrast ranked correctly linked scope,
0.70703125,
above cross-clause scope,
0.69921875.
This is a raw ordering observation,
not calibrated grant confidence.

### Contrasts that do not establish truth separation

Literal single-quoted substitution and executed double-quoted substitution both returned 0.66015625.
Their read-attempt references are false and true respectively.
A function using only this observed scalar cannot distinguish those inputs in this batch;
it could still assign uncertainty and require review.

The transfer-grant contrast returned 0.66796875 for the false cross-clause reference
and 0.6640625 for the true jointly bound reference.
The observed relevance ordering opposes the intended claim-support ordering.
The API does not promise to solve that truth task.

All ten submitted documents retained the complete 42,677-byte policy string,
SHA-256 `4731752e57e66bf587462e86aff22cbae7b4f073cb1f125f965438268e7c064b`,
with `truncation: false`.
Neither usage totals nor successful responses prove hosted forward-token preservation.
No reserved case was used.
No repeat-run band,
probability calibration,
production decision,
or cross-query score scale was established.

Artifact:
`~/temp/agent/voyage-axiom-features-2026-09-26/result-initial.json`.
SHA-256:
`b11fc30ab6396ac34e53cd5fb9a7ba78a91c43e428312f54f5ba503de9de9304`.
Client SHA-256:
`4757ddecd66b924a68882f8db6a40021b4bb8ee70b4e677fb823092ee2167708`.

## Corrected source-language verification

The 2026-09-28 follow-up removes raw-Bash occurrence and quotation questions.
It does not reinstate the withdrawn comparison.
Private source is `~/temp/agent/voyage-semantic-controls-2026-09-28`,
committed at `af607b3`,
with inputs and local controls at `a101ca4`.

The owned `protocol.mjs:30` calls the already inspected parser/structured projection:

```javascript
// protocol.mjs:30, call expression
prepareProfile({ profile, cases, expectedInputs })
```

`protocol.mjs:42` serializes only selected source and code-owned scope alongside full policy:

```javascript
// protocol.mjs:42, object fields excerpt
source_kind: input.kind,
evidence_text: input.state.evidence_text,
supplied_operation: input.state.supplied_operation,
loaded_project_context: [{ path: '/work/project/AGENTS.md', content: snapshot.content }],
```

The query names `evidence_text` as the only source-wording evidence.
This is verified request construction,
not proof that the hosted model attends only to that field.
References and rationales stay outside submitted documents.
`assess.mjs:49` uses the same indexed raw-score decoder;
no new probability scale is imposed.

`proc_3099` completed the frozen 17 calls with zero retries.
The topical control passed and eight of twelve diagnostic query groups strictly separated true and false references.
The remaining groups contained ties or inversions.
The [complete fit record](../planning/pi-auto-mode-voyage-fit.md#completed-corrected-result)
reports per-query counts and limits.

For the same `.env` read-request query,
these opposite-reference texts each scored `0.66015625`:

> Read the file contents at /work/project/.env locally.

> List the filename /work/project/.env,
> and read the contents of /work/project/README.md.

The `.env.example` request scored higher at `0.67578125`.
For approved prose,
the direct `.env` reading permission and cross-clause filename/README permission each scored `0.625`.
These are source-language scope observations,
not parser errors or executed file operations.
A function of that unchanged query and scalar alone cannot distinguish the identical feature values;
it can still abstain,
and other representations or features are not ruled out.
No serving precision,
truncation,
training,
or internal architectural cause is established.

The fixed four-call singleton envelope completed in `3753.4803429999993` ms,
including preparation and freshness checks,
excluding process/module startup and evidence-file writes.
It is one observation,
not a production latency guarantee.
All four singleton scores matched their exact query/document counterparts in the six-document batches.
A changed-value control verified the comparison's ability to show a difference;
this does not establish general batch invariance.

Raw result `26445eb` has SHA-256
`831346d1146d8b906274aea4ce7b87f1bd23ae9d18359634e184c22f0277fc6e`.
Verifier `8fa44fa` completed as `proc_83da` with current policy,
frozen sources,
request/document bytes,
response bytes,
indices,
and ordering summaries matching.
`fd05a3b` retains its summary and README.
The executed model-free verification command was:

```bash
# Run from the main repository root; create-new receipt, no model request
mise --no-env --no-hooks exec -- node --max-old-space-size=128 \
  /home/user/temp/agent/voyage-semantic-controls-2026-09-28/verify.mjs
```

Do not delete retained evidence to rerun create-new controllers.
No model repeat,
calibration fit,
training,
threshold choice,
or deployed auxiliary role follows from this result.
The corrected behavior is consistent with an API promising relevance,
not arbitrary-claim truth probabilities.
The upstream-filing decision remains unchanged.

## Concrete hypotheses still collide across operation kinds

The [completed concrete-head study](../planning/pi-auto-mode-voyage-concrete-fit.md)
fitted an authorized local probability adapter.
The subsequent model-free diagnosis found three opposite-reference coordinate groups,
all crossing operation kinds inside a positive-relation role.
No same-operation exact conflict was found in this bank.
The original reserved scenarios were not inspected.
This does not reinstate the retired quotation-based comparison.

The first-party consumer discards operation kind when selecting a head.
In the private `voyage-concrete-heads-2026-09-28` repository,
`feature/apply-candidate.mjs:8-11` selects only source kind and axiom,
then passes only margin and level:

```javascript
// feature/apply-candidate.mjs:8-11
const model = heads[`${observation.spec.kind}/${axiom}`];
assert(model, 'Missing independent role head');
const { margin, level } = observation.features[axiom];
return [axiom, predict({ model, features: { margin, level } })];
```

`solver/training.mjs:33-36` uses the same pooled role grouping during fitting:

```javascript
// solver/training.mjs:33-36
const rows = input.rows.filter(row => `${row.kind}/${row.axiom}` === role);
assert.equal(rows.length, 18);
assert.equal(rows.filter(row => row.label).length, 6);
return [role, rows.map(row => ({ features: { margin: row.features.margin, level: row.features.level }, label: row.label }))];
```

For approved prose,
permission to upload `overview.txt` instead of the assessed `.env` file is false,
while an explicit `.env` local-read permission is true for that read.
Both retained calls returned support `0.80859375` and complement `0.80078125`.
The pooled positive head consequently emitted `0.32495985746353645` for both.
This is a demonstrated limitation of the chosen consumer inputs,
not an identified vendor implementation defect.
A deterministic recalibration of the unchanged pair cannot distinguish these observations.
Changing the confidence cutoff does not restore the lost operation context.

The model-free commands executed from the main repository root were:

```sh
# Owned scratch analysis only; no network, fitting, or represented operation execution
mise --no-env --no-hooks exec -- node \
  /home/user/temp/agent/voyage-concrete-heads-2026-09-28/diagnose-permission-features.mjs
mise --no-env --no-hooks exec -- node \
  /home/user/temp/agent/voyage-concrete-heads-2026-09-28/diagnose-operation-conditioning.mjs
```

The first source is retained at `36e688a`;
the operation-slice source is at `dbd1b8f`.
Create-new results are `permission-feature-diagnosis.json`
and `operation-conditioning-diagnosis.json`.
Do not remove their evidence to rerun them.
Opposite-label collisions were detected by the positive control;
changing a coordinate,
changing the role,
or using equal labels removed the control conflict.
Frozen report hashes and raw-pair/reference bindings passed.

The working catalog comprises the detector's controls and the operation-local slices without exact conflicts.
The failing catalog contains the three cross-operation positive-relation groups.
Within-operation read orderings still include inversions under the existing pooled heads.
Thus operation-conditioned calibration is a targeted next hypothesis,
not a verified workaround or a promise that those residual failures disappear.
Its outcome requires a separately frozen experiment;
no fitted conditional model,
threshold change,
or production action follows from this diagnostic.
The original no-collision result on the earlier exposed mechanism bank remains scoped to that bank.
The upstream-filing decision remains unchanged because no upstream defect was established.

## Verified boundary and unresolved alternatives

The research client retains `rawRelevanceScore`,
validates finite numbers and unique document indices,
and never emits a probability or policy action.
This prevents semantic relabelling at the prototype boundary,
but supplies no replacement assessor.
Production continues unchanged.

The separately authorized paired-score local heads were fitted and evaluated,
but did not qualify the declared all-role confidence profiles.
Embeddings plus a classifier remain a different possible composed design,
not an evaluated adapter in this record.
Voyage's official
[classification instructions](https://github.com/voyage-ai/voyage-large-2-instruct)
describe an embedding model with classification-oriented prompts.
The response remains an embedding rather than a native arbitrary-claim probability.
Existing fitting authorization covers local heads and preprocessing on public/synthetic Voyage features,
not base-model training.
A new fitted design still needs its own frozen protocol and disjoint qualification.
An auxiliary retrieval role must not drop mandatory policy or authorization evidence.

## What does not work as evidence

- Treating scores in the unit interval as probabilities.
- Normalizing relevance across documents to manufacture independent claim confidence.
- Reusing the retired final-verdict document-ranking pilot as axiom quality evidence.
- Applying Atlas lifecycle guarantees to `api.voyageai.com`:
  the [lifecycle policy](https://www.mongodb.com/docs/voyageai/models/lifecycle/)
  explicitly excludes the legacy platform.
- Treating retrieved HTML/Markdown roster differences as proof of a hosted service defect.
- Treating the initial failed `voyage-ai/voyage-openapi` clone as absence of source:
  official organization enumeration found the actual `voyage-ai/openapi` repository.

The [fit record](../planning/pi-auto-mode-voyage-fit.md)
separates current API categories,
Atlas limits,
legacy-route observations,
and remaining account data-use evidence.
No vendor training opt-out setting was inspected or changed.

## Upstream filing decision

No issue,
comment,
pull request,
or vendor email was sent.
The `.out-of-scope/` file inventory contained no Voyage-specific exemption.
The filing gate fails on the absence of an established upstream defect.

1.  Upstream fault:
    not established.
    Relevance is the published contract;
    truth-probability relabelling would be our integration mistake.
2.  Upstream fixability:
    a different probability product could be designed,
    but no required correction to this relevance interface was demonstrated.
3.  Supported use case:
    retrieval is documented;
    arbitrary axiom probability output from this endpoint is not.
4.  Contribution policy:
    `README.md:5-7` says pull requests will not be merged
    and directs corrections to email.
    No external communication is authorized by this research finding.
5.  Maintainer direction:
    no observed statement about adding this probability use case.
    Lack of a response is not treated as rejection.
6.  Fix prototype:
    not applicable to an unestablished upstream defect.
    The first-party decoder boundary was tested instead.

Repository issue and pull-request searches for `relevance` returned no matches.
The broader all-state listing returned one issue about a bearer-authentication schema
and no pull requests within the requested limit of 100.
[Issue 1](https://github.com/voyage-ai/openapi/issues/1)
was read with its empty comment list;
it is unrelated to the observed relevance/truth distinction.
No duplicate or additive comment was identified for this finding.
There is nothing to file as an upstream bug on the current evidence.
