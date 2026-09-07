# CloudFront mirror correction completed

## Authorization and scope

The user authorized the targeted hostname correction for issue #146:
exclude viewer `Host` from both forwarding contributions,
while preserving other cache settings and Caddy,
TLS,
DNS,
viewer certificate,
and the live WAF association.
Do not change pricing plans or billing to overcome a restriction.

## Saved state

Private task artifacts:
`~/temp/agent/cloudfront-146-20260907.ctYFOkY1/`.
`live-before.json` contains the complete original distribution configuration and ETag.
`cache-before.json` contains the original managed cache policy.
The task scripts save immutable JSON evidence alongside their input files.

- Live distribution:
  `EYK5GXXEGWEYZ` at `aws.aquati.cat`.
- Original ETag:
  `E13V1IB3VIYZZH`.
- Original cache policy:
  `4cc15a8a-d715-48a4-82b8-cc0b614638fe`.
- Original origin-request policy:
  `216adef6-5c7f-47e4-b989-5492eafa07d3`.
- Proposed origin-request policy:
  `b689b0a8-53d0-40ab-baf2-68738e2966ac`.

## Resources created by this task

Disposable distribution:
`E35CZ02308UXVB` at `d1na6uytzcnwt9.cloudfront.net`.
The original-policy failure control returned HTTP 502.
The corrected policy pair passed content verification,
but the live Free-plan update was rejected.
Independent function validation also passed with both original policies restored.
The fixture was subsequently disabled,
detached from the function,
and deleted at `2026-09-07T21:37Z`.
A list read confirmed its absence.
It has no custom aliases and uses CloudFront's default viewer certificate.
The first creation attempt was rejected because the live distribution's flat-rate-plan WAF ACL cannot be shared.
The successful test-only configuration omits that ACL;
the live WAF was not changed.
The policy test changed only the policy pair;
the independent function test changed only the function association.
Cleanup is complete.

Task-created custom cache policy:
`bb6179b5-8f0c-443f-af07-15822be803fd`,
`AquatiCat-OriginCacheControl-NoViewerHost`.
Its payload is the original managed policy minus `host`,
with descriptive name/comment changes.
Deleted after fixture cleanup;
the custom-policy list confirmed its absence.

## Measured plan constraint

`aws pricing-plan-manager list-subscriptions --region us-east-1` returned an active `FREE` subscription
covering the live distribution and its WAF ACL.
AWS's [flat-rate plan documentation][plans] lists custom caching rules only for Business and Premium.
The live `UpdateDistribution` call confirmed the restriction:
`Distributions with the Free pricing plan can't have the following features: Custom cache policy`.
A subsequent read confirmed the original live ETag and policy IDs were unchanged.
No subscription was changed.

## Native function substitution

The same-intent implementation now uses CloudFront's native
`updateRequestOrigin({ hostHeader: 'aquati.cat', sni: 'aquati.cat' })`
in a viewer-request function,
while retaining both original policies.
This preserves the authorized caching and origin-security constraints without changing billing.
An independent advisor reviewed the implementation substitution and validation boundary.

Created and published function:
`AquatiCat-OriginHost`.
LIVE ETag:
`ETVPDKIKX0DER`.
Exact source,
SHA-256,
ARN,
risks,
and rollback are recorded in
[`package/ssg/aquati.cat/cloudfront/README.md`](../../package/ssg/aquati.cat/cloudfront/README.md).
AWS virtual tests preserve requests for every configured HTTP method.
Actual origin rewriting is not verified by that API.
Independent real-traffic verification passed at `2026-09-07T21:29:28Z`:
12 routes/assets,
status and body hash parity,
selected header parity,
decoded compression parity,
actual gzip and Brotli wire decoding,
and HEAD.
Browser navigation to `/en/about`,
resource loading,
and theme toggle passed;
`agent-browser errors` returned no page errors.
The checkbox itself was covered;
clicking its visible label successfully changed its checked state.

The function cannot remain associated with the disposable distribution when it is attached to the live Free-plan
resource:
flat-rate resources cannot share CloudFront Functions.
The fixture detach deployed before deletion.
`DescribeFunction` then returned `UNASSOCIATED` in LIVE.
The LIVE source was fetched immediately before production mutation;
its ETag and SHA-256 matched the tested artifact.
The function was not republished or edited.

The account had no custom cache policies and one distribution before fixture creation.
Applied service-quota listing returned no entries;
the default quota API listed 20 cache policies and 500 web distributions.

## Live update accepted

At `2026-09-07T21:38:48Z`,
`attach-function.ts live` submitted the function association successfully.
The full live config matched `live-before.json` immediately before mutation.
An assertion verified that only `DefaultCacheBehavior.FunctionAssociations` changed.
Both policy IDs,
TLS settings,
origin configuration,
viewer certificate,
and WAF were preserved.

The active subscription was re-read and required to remain:
`sub_3DTSjxYPTfECao1AdspkkEBB8cY`,
`FREE`,
`ACTIVE`.
No subscription mutation was submitted.

`rollback-live-function.ts detach` is prepared but has not been executed.
It fetches fresh config/ETag,
requires this task's exact association,
and removes only that association.
It does not restore the old full config over unrelated changes.

## Verified completion

`verify-live-state.ts` passed at `2026-09-07T21:41:59Z`.
The live distribution was `Deployed`,
ETag `E1VC38T7YXB528`.
Its full configuration matched the submitted input;
removing only the new association reconstructed the original snapshot exactly.
The subscription remained `FREE`,
`ACTIVE`,
with ETag `2` and its original update timestamp.
Primary TLS 1.3 succeeded and TLS 1.2 failed with protocol-version alerts over IPv4 and IPv6.
Live mirror root bodies matched the primary over TLS 1.3 in both families.

`verify.ts live` passed at `2026-09-07T21:42:12Z`.
It verified the same route/resource catalog,
headers,
content hashes,
HEAD,
and compression boundaries as the function fixture.
The root body was 3,445 bytes,
SHA-256 `15789f6f382e87508716b0840b9962fde1fe0324ed5ad868ec953629b52e903e`.
The missing resource remained HTTP 404 with an empty body.

Live browser verification followed the English language link,
toggled the theme through its visible label,
confirmed loaded resources,
and navigated to the rendered About page.
No page errors were reported.
The task browser was closed.

Resolution commit `983b39022` closed issue #146 through auto-push.
The issue state was read back as `CLOSED`.
The [resolution comment][resolution] records measured outcomes and remaining verification limits.
Package artifact verification is recorded in commit `3b7f8b120`,
with its package README link in `0c7be2c4f`.

No AWS cleanup or live deployment work remains.
The only retained task-created AWS resource is the live-associated function.

## Wait correction and verification limits

The native baseline waiter eventually returned exit zero after 1,813 seconds.
A direct read returned `Deployed` just before its success notification around a stop request.
The claim that it had stalled or delayed progress unnecessarily was retracted:
the completion time is not established by these observations.
The communication failure was leaving a silent wait without bounded checkpoints.
The replacement process logs timestamped observations and returns a pending checkpoint after 10 observations,
with 30-second intervals and bounded AWS connection/read calls.
Ready observations were obtained for function deployment and fixture disable.

Repeated requests for the CSS asset returned `Miss from cloudfront` twice,
with no origin `Cache-Control`.
No cache-hit preservation claim is made.
The original cache policy and its minimum/default TTL of zero remain unchanged.

Browser search did not produce results in the agent-browser control on the primary site or the fixture.
A Pagefind worker request remained pending;
no causal claim was made.
Static resources loaded,
theme toggle worked,
and HTTP content parity passed.
Keep this browser-verification limitation separate from CloudFront HTTP 502 remediation.

[plans]: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/flat-rate-pricing-plan.md
[resolution]: https://github.com/Aquaticat/Monochromatic/issues/146#issuecomment-5575913552
