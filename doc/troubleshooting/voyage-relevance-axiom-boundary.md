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

## Verified boundary and unresolved alternatives

The research client retains `rawRelevanceScore`,
validates finite numbers and unique document indices,
and never emits a probability or policy action.
This prevents semantic relabelling at the prototype boundary,
but supplies no replacement assessor.
Production continues unchanged.

Embeddings plus a classifier remain a possible composed design,
not an evaluated probability adapter.
Voyage's official
[classification instructions](https://github.com/voyage-ai/voyage-large-2-instruct)
describe an embedding model with classification-oriented prompts.
The response remains an embedding rather than a native arbitrary-claim probability.
Any training requires separate authorization and disjoint qualification.
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
