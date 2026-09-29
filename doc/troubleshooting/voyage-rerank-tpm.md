# Voyage rerank-3 batch hits a token-per-minute limit before pretest completes

## Symptom

The shared operation-calibration pretest stopped at `proc_85e9` on HTTP 429 from
`POST https://api.voyageai.com/v1/rerank`.
The affected assessment was
`base/pine-lake-transfer/positive-with-unrelated-ban`,
starting with its request-source call.
The response reported:

> You have exceeded the project's Tokens Per Minute (TPM) rate limit of 4,000,000 tokens per minute for rerank-3.
> In the minute before this request,
>  you used 3,971,647 tokens.

The owned collector then emitted:

```text
# feature/run.mjs, original stopped phase
FeatureStudyStopped: Frozen feature phase stopped; no automatic retry, tuning or test extension
```

This is a collection-throughput refusal,
not a measured failure of the probability estimator or an accepted pair's five-second deadline.
No semantic model had been fitted and no test call had been dispatched.

## Cause and source trace

The [official error-code documentation][error-codes] names HTTP 429 as
`Rate Limit Exceeded`
and recommends pacing requests.
The [rate-limit guide][rate-guide] defines both requests-per-minute and tokens-per-minute limits,
allows project limits below organization limits,
and notes that other projects can consume shared organization capacity.
Those documents were read on 2026-09-28.
The tokenization guide was also inspected;
no tokenizer package was installed and character-count approximations were not treated as exact token counts.

The guide's basic `rerank-3` table says two million TPM,
whereas this actual refusal reports a four-million project limit.
The response is the evidence for this request's reported limit.
It does not identify the account tier,
billing history,
other traffic,
or future available capacity.
No dashboard or account setting was inspected or changed.
The hosted limiter implementation was not inspected,
so no particular bucket/window algorithm or internal accounting cause is claimed.

The first-party batch loop had no inter-assessment pacing.
In the private `voyage-operation-heads-2026-09-28` repository,
the loop at `feature/run.mjs:36` invokes the assessor directly on each iteration.
Its success path at `feature/run.mjs:40-43` records the result without a pacing step:

```javascript
// feature/run.mjs:40-43
const result = await assessSet({ specs, fixtures, snapshotIdentity: manifest.policy, expectedRequests: manifest.requests, checkFrozen: checkAll, key, send: fetch, clock: performance, progress, enrich: observation => candidate ? applyCandidate({ observation, candidates: candidate.candidate.variants }) : observation });
assert.equal(result.clientCalls, 2);
sets.push({ id: set.id, profileId: set.profileId, partition: set.partition, diagnosticOnly: set.diagnosticOnly, ...result });
writeFileSync(output, JSON.stringify({ ...metadata, state: 'running', sets }, null, 2) + '\n', { mode: 0o600 });
```

The actual transport boundary in `feature/assess.mjs:47` rejects non-200 responses:

```javascript
// feature/assess.mjs:47
assert.equal(response.status, 200, 'Provider HTTP refusal');
```

Each successful source call reported 46,599 to 47,037 tokens.
Complete public policy remained in all four hypothesis documents.
A five-second per-assessment ceiling does not itself constrain batch tokens per minute.
The measured refusal is compatible with missing batch pacing;
it does not prove that this process was the only contributor to project or organization usage.

## Verification

The immutable original semantic manifest is
`db1ca9345a4e373cab696446cf839f2e731ab8db023cc7731e1c7e802df491de`.
Private `f55135c` retains the stopped file and measured stop summary.
Original result SHA-256:
`4c66b3af553ea510fa85baa6f91ae8dfb83a372ced26c49d1356ba9045fe6bb6`.

The successful catalog contains 111 completed two-source pairs,
222 successful calls,
and 10,379,854 reported tokens.
Their shared assessment clocks ranged from `788.933422999995` to `1388.999078` ms.
The fit partition was complete,
including its fit-only controls;
three validation pairs remained.

The failing catalog contains one rejected request in the next pair,
with no successful response in that pair.
Its token usage and billing are unknown.
The entire original pretest remains `state: stopped`;
the successful prefix is not silently promoted to a successful original phase.

The model-free forensic verifier at `12f0e20` was executed with:

```sh
# Main repository root; create-new receipt, no model call or fitting
mise --no-env --no-hooks exec -- node \
  /home/user/temp/agent/voyage-operation-heads-2026-09-28/verify-stopped-prefix.mjs
```

It reconstructed every retained request,
reparsed response bytes,
checked raw coordinates,
source/policy identities,
schedule-prefix membership,
and completed-pair deadlines.
A changed-score positive control proved the verifier detects a scalar change.
`verified-stopped-prefix.json` explicitly records `completePhase: false`.
Do not remove evidence to rerun create-new controllers.

## Remediation and its verification boundary

The authorized comparison can continue only through a separately frozen dispatch/admission protocol.
The original failed file and frozen code stay unchanged.
The proposed continuation uses exactly the remaining three pretest pairs,
then the original 54 unqueried test pairs.
No completed request is replayed and no half-pair is joined across clocks.
The rejected zero-success pair is explicitly restarted as a new assessment,
not counted as zero retries across collection windows.

Research pacing waits seventy seconds at the start of each new live phase,
then at least four seconds after each completed pair before starting another.
Waiting is recorded separately from each unchanged five-second assessment clock.
This is deliberate scheduling of synthetic research cases,
not qualification of queueing latency in a live guard.
Pacing reduces this collector's offered request frequency;
it cannot guarantee capacity when other traffic or rate settings are unknown.

A new recovery-namespace pretest artifact may combine the verified prefix and verified suffix,
but must retain both origins and pass ordinary full reconstruction before a separate admission receipt permits fitting.
Both fixed candidates must then bind that composed input and remain locked before test.
The expected completed accounting is 336 scored requests plus one original rejected attempt.
Rejected-call usage remains unknown.
Repeat/order controls belong only to the original collection window;
no cross-window serving stability is established.

`proc_d51e` passed local no-replay,
no-half-pair,
exact-order,
and incomplete-evidence controls.
A synthetic clock recorded waits of 70,001 and 4,001 ms separately from 40 ms mocked assessment times.
An early-returning timer was rejected;
an isolated omitted pacing guard exposed that violation.
The original reader still rejects the incomplete original evidence because its required verification receipt is absent.
`proc_ee57` subsequently completed the three missing pairs with six new calls,
no completed-request replay,
and no new quota refusal in that suffix.
It recorded `78009.94261299999` ms of research waiting separately from `81774.210385` ms total phase time.
`proc_0107` then reconstructed all 228 composed successful responses and admitted the new evidence,
while preserving the original stopped state and rejected attempt.
This verifies recovery for that bounded suffix,
not future quota availability or live-guard queue latency.
Both candidates were then fitted and locked before the original 108-call shared test.
`proc_c4b9` completed that paced test without a further refusal;
`proc_6e57` reconstructed its responses and both predictions.
Test pairs ranged from `1036.3708619999961` to `1606.8648460000113` ms,
with `282047.93324999994` ms of separately recorded research waiting.
The completed accounting is 336 scored calls plus the original rejected attempt,
with 15,712,072 reported successful-response tokens and unknown rejected usage.
The original failure is not reclassified as a success.
This is bounded recovery evidence,
not a quota or future-latency guarantee.

## What does not establish recovery

- Rerunning the original collector over already completed requests.
- Renaming its stopped result to completed or fitting directly from partial pretest evidence.
- Excluding the 429 from the total attempt count.
- Hiding a rate-limit wait inside an advertised five-second assessment.
- Dropping mandatory policy,
  shortening hypotheses,
  or changing confidence thresholds to avoid throughput limits.
- Treating the basic-tier table as measured account configuration.

The guide also documents automatic backoff and quota increases.
Neither is silently enabled here:
this protocol has no in-clock retry or automatic further continuation,
and account/billing changes or quota requests are outside the authorized recovery.
A new refusal stops with evidence preserved.

## Upstream filing decision

No upstream issue,
comment,
quota-increase request,
or vendor message is proposed or sent.

1.  Upstream fault is not established:
    the service returned its documented rate-limit refusal.
2.  No upstream correction has been shown necessary:
    the first-party batch scheduler lacked pacing.
3.  Pacing reranking traffic is documented;
    the custom probability-estimation design remains our responsibility.
4.  Contribution-policy review for a new upstream change is not applicable because none is proposed.
5.  Maintainer willingness to change limits is not inferred and no contact is made.
6.  The prospective fix belongs to our collector and admission boundary,
    not an upstream implementation patch.

There is nothing to file as a new upstream bug on this evidence.
The existing [Voyage boundary record](voyage-relevance-axiom-boundary.md#upstream-filing-decision)
retains the earlier source-repository and filing review.
No source-level server defect is asserted.

[error-codes]: https://docs.voyageai.com/docs/error-codes
[rate-guide]: https://docs.voyageai.com/docs/rate-limits
