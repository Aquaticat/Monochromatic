# Cloudflare CDN mirror evaluation for aquati.cat

**Date**: 2026-05-09
**Subject**: Evaluating `cloudflare.aquati.cat` as a third diversification
mirror alongside `fastly.aquati.cat` (working) and `aws.aquati.cat`
(broken, see `TROUBLESHOOTING.aws-cloudfront-mirror.md`). Outcome:
**not pursued**. Cloudflare has no plan tier that combines free pricing
with keeping the apex DNS at Njalla, given the diversification-only
goal.

## Constraints

- Keep `aquati.cat` DNS at Njalla. Apex CAA stays
  `0 issue "letsencrypt.org"`.
- Free Cloudflare plan only.
- Goal is diversification (another endpoint pointing at the same origin),
  not caching, WAF, or specific Cloudflare features.

## Candidate paths and disposition

### Path 1 (excluded by user): move `aquati.cat` DNS to Cloudflare nameservers

Cloudflare's intended free model. Apex zone moves to Cloudflare,
orange-cloud the relevant subdomain, Universal SSL handles the cert.
Excluded because it breaks the constraint of keeping DNS at Njalla and
the apex CAA setup the AWS path was carefully designed around.

### Path 2 (paid): Partial (CNAME) setup

Lets Cloudflare proxy a single subdomain via a CNAME at the existing
DNS provider, no nameserver change. Per Cloudflare's docs:

- Free: not available
- Pro: not available
- Business: available
- Enterprise: available

Source: <https://developers.cloudflare.com/dns/zone-setups/partial-setup/>.
~$250/mo for Business is too steep for a diversification mirror.

### Path 3 (paid): Subdomain setup / NS delegation as a separate zone

Add `cloudflare.aquati.cat` as its own Cloudflare zone, delegate via
NS records at Njalla. Per Cloudflare's docs:

- Free: not available
- Pro: not available
- Business: not available
- Enterprise: available

Source: <https://developers.cloudflare.com/dns/zone-setups/subdomain-setup/>.
Enterprise tier well outside scope for a diversification mirror.

### Path 4 (free, off-label): Cloudflare for SaaS / Custom Hostnames

Free plan includes 100 custom hostnames; $0.10/hostname/month beyond.
Source:
<https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/plans/>.

Mechanics: a placeholder zone (any domain owned and added to Cloudflare
Free) acts as the SaaS provider zone. `cloudflare.aquati.cat` is added
as a Custom Hostname on that zone. CNAME at Njalla points
`cloudflare.aquati.cat` at a proxied CNAME target on the placeholder
zone. Fallback origin proxies back to `aquati.cat`. Cert issued
per-hostname via DCV; CAA chain follows the CNAME away from the apex
(RFC 8659 §3) so the apex `letsencrypt.org`-only CAA is not read.

Off-label because the SaaS product targets multi-tenant SaaS providers
proxying customer hostnames. Using it for one's own hostname is allowed
but adds operational overhead disproportionate to the goal: a placeholder
domain registration (~$10/yr), nameserver migration of the placeholder
zone, SaaS configuration, DCV setup, and per-hostname renewal monitoring,
all to add a third mirror behind a working Fastly setup.

### Other paths considered and ruled out

- **Workers on a `workers.dev` URL plus Njalla HTTP redirect**: changes
  the public URL after redirect; not a transparent alternate endpoint.
- **Cloudflare Tunnel**: public hostname must live on a Cloudflare zone,
  collapsing into either Path 1 (move apex DNS) or Path 4 (SaaS Custom
  Hostnames).
- **Cloudflare Pages with custom domain**: same constraint (custom domain binding requires the hostname's zone on Cloudflare).

## Decision

Skip Cloudflare. Mirror set remains `fastly.aquati.cat` (working) plus
`aws.aquati.cat` once AWS ships TLS 1.3 origin auto-negotiation cleanly
(see `TROUBLESHOOTING.aws-cloudfront-mirror.md` issue 7). Re-evaluate if
Cloudflare loosens partial setup or subdomain setup plan gating, or if
caching or WAF requirements change the goal beyond pure diversification.

## References

- Cloudflare for SaaS plans:
  <https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/plans/>
- Partial (CNAME) setup availability:
  <https://developers.cloudflare.com/dns/zone-setups/partial-setup/>
- Subdomain setup availability:
  <https://developers.cloudflare.com/dns/zone-setups/subdomain-setup/>
- RFC 8659 §3, CAA tree-walk and CNAME-following:
  <https://datatracker.ietf.org/doc/html/rfc8659#section-3>
- Related: `TROUBLESHOOTING.aws-cloudfront-mirror.md` (the AWS path's
  CAA pattern this evaluation reused).
