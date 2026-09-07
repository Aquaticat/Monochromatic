# CloudFront mirror correction in progress

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
The fixture is now being restored to its original policies for independent native-function validation.
It has no custom aliases and uses CloudFront's default viewer certificate.
The first creation attempt was rejected because the live distribution's flat-rate-plan WAF ACL cannot be shared.
The successful test-only configuration omits that ACL;
the live WAF was not changed.
Both test phases must retain this same fixture configuration apart from the policy pair.
Delete this disposable distribution after validation,
even if live correction is blocked.

Task-created custom cache policy:
`bb6179b5-8f0c-443f-af07-15822be803fd`,
`AquatiCat-OriginCacheControl-NoViewerHost`.
Its payload is the original managed policy minus `host`,
with descriptive name/comment changes.
Delete it too if the live correction cannot use it.

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

The function cannot remain associated with the disposable distribution when it is attached to the live Free-plan
resource:
flat-rate resources cannot share CloudFront Functions.
Detach it from the fixture and wait for deployment before live association.
Do not republish or change the validated function bytes.

The account had no custom cache policies and one distribution before fixture creation.
Applied service-quota listing returned no entries;
the default quota API listed 20 cache policies and 500 web distributions.

## Next action

The native waiter for restoring the original-policy fixture is running.
After its success notification:

- Run `attach-function.ts fixture` in the private task directory.
  It first requires a fresh original-policy HTTP 502 control.
- Wait for function association deployment and run the actual-content verification with a new output prefix.
- Disable the disposable distribution and detach its function;
  wait for deployment,
  then delete the fixture and unused custom cache policy.
- Run `attach-function.ts live` only after the saved function-fixture verification marker exists.
  It changes only the viewer-request function association,
  checking the full live configuration against `live-before.json`.
- Verify the live endpoint,
  pricing subscription,
  TLS boundary,
  and selected headers/content.
  Preserve original policy IDs and all other distribution settings.

Browser search did not produce results in the agent-browser control on the primary site or the fixture.
A Pagefind worker request remained pending;
no causal claim was made.
Static resources loaded,
theme toggle worked,
and HTTP content parity passed.
Keep this browser-verification limitation separate from CloudFront HTTP 502 remediation.

[plans]: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/flat-rate-pricing-plan.md
