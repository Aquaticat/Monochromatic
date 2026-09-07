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
The fixture now has the corrected policy pair,
and content-parity verification is running.
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
This may block attaching the proposed custom cache-policy clone to the live distribution.
No subscription was changed.

The account had no custom cache policies and one distribution before fixture creation.
Applied service-quota listing returned no entries;
the default quota API listed 20 cache policies and 500 web distributions.

## Next action

The baseline and corrected fixture deployments completed.
The process tool is running `verify.ts fixture` from the private task directory.
After its success notification:

- Require the saved `fixture-verification-passed.json` marker before attempting live application.
- Preserve every live distribution field except the policy associations;
  compare against `live-before.json` and use a fresh ETag.
- If live policy attachment is rejected by plan gating,
  retain the original live configuration,
  clean up test resources,
  and obtain a decision before changing caching semantics or billing.

[plans]: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/flat-rate-pricing-plan.md
