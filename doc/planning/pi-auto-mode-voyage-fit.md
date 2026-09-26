# Voyage axiom-assessment fit

## Status and scope

This investigates the user-authorized Voyage family under the
[axiom architecture](pi-auto-mode-axioms.md).
No production model,
probability adapter,
or auxiliary role is selected.
The old final-verdict document-ranking pilot remains withdrawn as quality evidence.
Do not rerun that task formulation or relabel relevance as permission.

## Published interface evidence

The [current model overview](https://www.mongodb.com/docs/voyageai/models/)
lists text embeddings,
code/domain embeddings,
contextualized embeddings,
multimodal embeddings,
open-weight embeddings,
and rerankers.
The inspected catalog does not describe a native Noul-style truth-probability interface.
This is a statement about the inspected published contracts,
not proof that no other service or composed classifier could ever provide one.

The [legacy rerank API](https://docs.voyageai.com/reference/reranker-api)
returns indexed `relevance_score` values and token usage.
The response contract calls the value document relevance to a query,
not P(true) for an arbitrary claim.
It does not define a probability range in that response schema.
Do not normalize scores across documents or treat a numeric value as a truth probability merely because it falls in the unit interval.

The [embedding API](https://docs.voyageai.com/reference/embeddings-api.md)
returns vectors.
Those vectors would require a separately designed and validated classifier or calibration mapping
before satisfying the guard's probability interface.
No such mapping has been trained or qualified here.
A retrieval role must not filter or replace mandatory complete current `AGENTS.md`.

## Endpoint and documentation distinctions

The already verified endpoint is `https://api.voyageai.com/v1/rerank`,
with `rerank-3` explicitly requested and returned.
No new model or endpoint substitution is planned.

The live [Atlas API specification](https://www.mongodb.com/docs/api/doc/atlas-embedding-and-reranking-api/)
lists `rerank-3` with:

- 8,000 query tokens.
- 32,000 tokens per query/document pair.
- 600K aggregate processed tokens.
- An explicit `truncation: false` error path instead of automatic truncation.

Those are Atlas documentation facts,
not independently verified legacy endpoint limits.
The legacy reference still describes older model limits.
The retrieved Markdown reranker page also lagged the live HTML and API specification,
listing older models and a different preview notice.
Do not silently combine those versions.

The [lifecycle policy](https://www.mongodb.com/docs/voyageai/models/lifecycle/)
explicitly excludes the legacy Voyage platform.
Its Atlas Preview status and support guarantees cannot be transplanted onto the tested legacy route.
The [client documentation](https://www.mongodb.com/docs/voyageai/api-and-clients/)
also distinguishes key/endpoint routing and different SDK retry defaults.
The probe uses a first-party fixed-endpoint HTTP client,
not either SDK's defaults.

The live [Voyage FAQ](https://docs.voyageai.com/docs/faq)
describes an organization opt-out from storage and future model training.
The user's actual setting has not been inspected or changed.
Q12's acceptance of necessity-based retention does not establish that setting
or authorize vendor training on private input.
Current probes remain public/synthetic only.

## Query ledger

A private schedule was frozen at
`~/temp/agent/voyage-axiom-fit-schedule-2026-09-26.json`.
The literal Radius query was
`Voyage AI rerank-3 relevance_score probability classification models query document token limits api.voyageai.com`.
It returned eight results with `max_results: 8`,
search ID `search_3bf6bb11854c801eaa49c9f271c82872`.
Only relevant official Voyage/MongoDB sources were followed.
No unrestricted vendor discovery or saturation claim follows.

## Raw-feature probe design

The experiment will test evidence relevance for named claims,
not rank candidate final actions.
Every document contains a complete current policy snapshot and public synthetic state.
`truncation` is explicitly false.
Reference truth remains local and is not included as an expected answer in the request.

A retrieval control with policy present first checks whether the method can distinguish explicit package-reading evidence
from an unrelated recipe field.
It does not test whether the model attends to or internally preserves the policy.
The subsequent frozen development contrasts concern:

- Protected-file read attempts:
  ordinary package metadata,
  actual `.env` transfer,
  literal single-quoted substitution,
  and actual double-quoted substitution.
- Cache-removal scope:
  cross-clause versus correctly linked permission.
- Protected-transfer scope:
  reading `.env` plus uploading another file versus uploading the `.env` contents.

The result will retain raw scores,
indices,
reference truths,
usage,
request sizes,
and timings.
It will not produce probabilities,
Brier scores,
automatic decisions,
or calibrated thresholds.
A feature's separation on these examples would not establish a usable probability adapter.
A failed control or uninformative contrast would not prove every Voyage model or representation unusable.

This work is conditional feature feasibility,
not equal-format model-quality comparison with native Jev Noul outputs.
Each request receives a separate five-second experimental budget.
This does not establish the production requirement of all needed axioms for one action within five seconds.
Scores from different queries are not assumed comparable.
The ordinary-package/transfer comparison also changes request and transfer context;
only the quote pair isolates quoting.
Grant cases assume valid synthetic human authority;
they do not test origin,
revocation,
or standalone prohibitions.

Offline response and request-construction checks passed.
Removing the committed repeated-index guard made the test fail with
`Missing expected exception (RerankResponseError)`.
The guard was restored before any live feature request.
No raw-feature result has been inspected yet.

## Source and classification counterevidence

The official organization repository enumeration located `voyage-ai/openapi`.
The attempted `voyage-ai/voyage-openapi` name returned a GitHub GraphQL resolution error
and a REST 404;
that failed name is not evidence of absent source.
The correct source was cloned read-only to
`~/temp/agent/voyage-openapi-source-2026-09-26`,
revision `d638a2a8d9d535a850e7b0d664e49e65934f3bde`.
Its `voyage-openapi.yml:542-580` describes indexed relevance scores and token usage.
Its model roster predates the current live documentation;
it does not establish `rerank-3` limits.

The official [voyage-large-2-instruct repository](https://github.com/voyage-ai/voyage-large-2-instruct)
explicitly describes an embedding model optimized for classification,
clustering,
and retrieval.
It recommends prepending classification instructions with `input_type: None`.
This is relevant evidence for downstream classification with embeddings,
not evidence that the embedding API returns arbitrary-claim truth probabilities.
A composed classifier remains a possible design requiring separate training authorization and qualification,
not an evaluated substitute or a selected addition.
