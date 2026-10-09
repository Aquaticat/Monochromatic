# ACM renewal for the CloudFront mirror is blocked by the apex CAA

## Purpose

AWS sent an `AWS_ACM_CAA_CHECK_FAILURE` health event on 2026-10-09 for the
certificate that serves `aws.aquati.cat`.
The certificate expires on 2026-11-22 at 23:59:59 UTC,
which is 44 days after the investigation recorded here.
ACM states in that event that it retries until renewal succeeds or the
certificate expires,
so nothing breaks immediately and nothing fixes itself either.

This file hands over a completed diagnosis,
six remediation options with a ranking,
and the dead ends that were measured so they are not re-explored.
No DNS,
AWS,
or repository configuration was changed to remediate the failure.
The decision is the reader's.

The diagnosis also retracts a mechanism claim in
[`doc/troubleshooting/aws-cloudfront-mirror.md`](../troubleshooting/aws-cloudfront-mirror.md)
issue 6,
which is what made this failure look impossible.

## Decision on 2026-10-09

The maintainer chose option 1 followed by option 2,
with `mirror.amazon.aquati.cat` as the option 2 hostname.

Option 1 first stops the expiry clock with an AWS-only change and no DNS
dependency.
Option 2 then restores a hostname inside `aquati.cat`.
Each needs one `UpdateDistribution` call.
If Njalla access is immediate,
option 2 alone also beats the deadline,
since ACM issues minutes after validation;
option 1 stays the safer first step because it needs no DNS.

The chosen hostname has two labels below the apex,
so the CAA record belongs at `amazon.aquati.cat`,
one label above the leaf:

```text
amazon.aquati.cat.         CAA   0 issue "amazon.com"
amazon.aquati.cat.         CAA   0 issue "amazontrust.com"
amazon.aquati.cat.         CAA   0 issue "awstrust.com"
amazon.aquati.cat.         CAA   0 issue "amazonaws.com"
mirror.amazon.aquati.cat.  CNAME <distribution-domain>.
```

The climb for `mirror.amazon.aquati.cat` terminates at `amazon.aquati.cat`,
so the apex keeps `letsencrypt.org` and `certainly.com` untouched.

One consequence to accept deliberately:
every name under `amazon.aquati.cat` inherits that set,
so nothing in the subtree can obtain a Let's Encrypt certificate unless
`0 issue "letsencrypt.org"` is added there too.
The subtree is a natural home for Amazon-issued names only.

Asked and left unanswered,
so parked rather than assumed:

- relocating the Fastly mirror under the same intermediate label,
  which would let the apex return to `letsencrypt.org` only;
- the stale `mise.toml` comment claiming dprint formats markdown,
   when the
  markdown plugin is commented out in `package/config/dprint/index.json`;
- recording why `certainly.com` sits at the apex.

Blockers measured on 2026-10-09:

- `aws sts get-caller-identity` still fails with the expired-session error
  quoted in "What to inspect and how to respond".
  Only the maintainer can run the interactive `aws login`.
- No Njalla credential exists in this environment:
  no matching variable in the process environment and no match under
  `~/.config`.
  The records above need the maintainer's dashboard or an API token.

Reusable prior art for the AWS mutations lives in the private task
directory recorded in
[`aws-cloudfront-mirror-correction.md`](aws-cloudfront-mirror-correction.md):
`common.ts` wraps the CLI with bounded waits,
saves immutable evidence per call,
and `apply-live.ts` shows the read-config,
change-one-field,
assert-only-that-field-changed pattern this work must repeat.

## What to inspect and how to respond

Follow "Remediation steps" for option 1,
then for option 2,
substituting `mirror.amazon.aquati.cat` for the placeholder hostname and
`amazon.aquati.cat` for the placeholder intermediate label.
Every step is a DNS edit at Njalla or an AWS CLI call;
none needs code changes in this repository.

Five of the six options need an authenticated AWS session;
only option 4 is a pure DNS edit.
At the time of writing,
`aws sts get-caller-identity` fails with:

```text
aws: [ERROR]: Your session has expired. Please reauthenticate using 'aws login'.
```

Re-authenticate before any step that reads or mutates ACM or CloudFront
state.

## Repository changes made while diagnosing

Redaction,
forward-only,
because this repository is public
(`Aquaticat/Monochromatic`,
visibility measured as `PUBLIC`):

- Account-scoped AWS identifiers became placeholders plus the read-only
  call that recovers each one,
  in
  [`doc/troubleshooting/aws-cloudfront-mirror.md`](../troubleshooting/aws-cloudfront-mirror.md),
  [`doc/handover/aws-cloudfront-mirror-correction.md`](aws-cloudfront-mirror-correction.md),
  and
  [`package/ssg/aquati.cat/cloudfront/README.md`](../../package/ssg/aquati.cat/cloudfront/README.md).
- Redacted:
   the AWS account ID,
  the ACM certificate ID and ARN,
  CloudFront distribution IDs,
  a fixture distribution domain,
  a task-created custom cache policy ID,
  a CloudFront function ETag and distribution ETags,
  a pricing-plan subscription ID,
  and the ACM DNS validation token pair.
- Kept:
   AWS-published managed policy IDs,
  which are the same constants in every account,
  and artifact SHA-256 values,
  which verify deployed bytes without identifying the account.
- Git history still contains the original values.
  No history rewrite was performed or proposed.

Corrections to falsified claims:

- Issue 6 of
  [`doc/troubleshooting/aws-cloudfront-mirror.md`](../troubleshooting/aws-cloudfront-mirror.md)
  is marked retracted,
  with its text kept as the record of what was believed.
- Its "Current configuration state" section no longer asserts that only
  Let's Encrypt may issue for `aquati.cat`,
  or that the renewal CAA chain runs through `cloudfront.net`.
- Its "What does not work" entries for a wider apex CAA and for an
  alternate label carry dated corrections.
- The CNAME-following claim in Path 4 of
  [`doc/troubleshooting/cloudflare-mirror-evaluation.md`](../troubleshooting/cloudflare-mirror-evaluation.md)
  carries the same correction.
  That document's plan-tier conclusion is unchanged.

## Measured state on 2026-10-09

Authoritative answers came from `1-you.njalla.no`;
cross-checks came from `9.9.9.9`.

CAA,
the whole failure in four queries:

```bash
dig +short CAA aws.aquati.cat
# (no answer; the node holds a CNAME, and CAA cannot coexist with it)

dig +short CAA aquati.cat
# 0 issue "certainly.com"
# 0 issue "letsencrypt.org"

dig +short CAA cloudfront.net
# 0 issuewild "amazonaws.com"
# 0 issuewild "digicert.com"

dig +short CAA fastly.net
# 0 issue "certainly.com;validationmethods=dns-01"
# 0 issue "globalsign.com"
# 0 issue "letsencrypt.org;validationmethods=dns-01"
# 0 iodef "mailto:security@fastly.com"
```

The mirror and its certificate:

```bash
dig +short CNAME aws.aquati.cat
# <distribution-domain>.

echo | openssl s_client -connect aws.aquati.cat:443 -servername aws.aquati.cat 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates
# subject=CN=aws.aquati.cat
# issuer=C=US, O=Amazon, CN=Amazon ECDSA 256 M04
# notBefore=May  9 00:00:00 2026 GMT
# notAfter=Nov 22 23:59:59 2026 GMT
```

ACM's DNS validation record is intact,
so validation is not a second blocker:

```bash
dig +short CNAME _<validation-token>.aws.aquati.cat
# _<validation-value>.<validation-zone>.acm-validations.aws.
```

The Fastly mirror,
which is the precedent for a CDN hostname under this apex:

```bash
dig +short CNAME fastly.aquati.cat
# x.sni.global.fastly.net.

echo | openssl s_client -connect fastly.aquati.cat:443 -servername fastly.aquati.cat 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates
# subject=CN=fastly.aquati.cat
# issuer=C=US, O=Certainly, CN=Certainly Intermediate R1
# notBefore=Sep 26 09:37:04 2026 GMT
# notAfter=Oct 26 09:37:03 2026 GMT
```

The origin and the apex:

```bash
echo | openssl s_client -connect aquati.cat:443 -servername aquati.cat 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates
# subject=CN=aquati.cat
# issuer=C=US, O=Let's Encrypt, CN=YE1
# notAfter=Nov  9 10:59:10 2026 GMT
```

Nameservers are `1-you.njalla.no`,
`2-can.njalla.in`,
and `3-get.njalla.fo`.
The zone SOA serial is `2609142324`,
so the last zone change predates the 2026-10-09 failure by weeks.

## Root cause

RFC 8659 section 3 defines the Relevant RRset as a climb over the parents
of the queried FQDN:

```text
Let CAA(X) be the RRset returned by performing a CAA record query for
the FQDN X, according to the lookup algorithm specified in Section
4.3.2 of [RFC1034] (in particular, chasing aliases).  Let Parent(X) be
the FQDN produced by removing the leftmost label of X.
```

Alias chasing happens inside the single-node query `CAA(X)`.
The climb `Parent(X)` stays in the original tree.
RFC 8659 section 7 states this replaced the RFC 6844 algorithm,
which did climb CNAME and DNAME chains,
and gives the reason:
hosting providers would otherwise impose their own CAA policies on
customer names.

So for `aws.aquati.cat`:

1.  `CAA(aws.aquati.cat)` chases the CNAME,
    queries `CAA(<distribution-domain>)`,
    gets an empty answer.
2.  `Parent(aws.aquati.cat)` is `aquati.cat`.
3.  `CAA(aquati.cat)` is non-empty:
    `letsencrypt.org` and `certainly.com`.
4.  The climb terminates.
    Amazon is absent,
    so ACM must refuse.

`cloudfront.net` is never consulted,
because the climb never enters that tree.
Had it been consulted,
its `issuewild`-only set would not restrict a non-wildcard request at all:
RFC 8659 section 4.3 requires each `issuewild` property to be ignored for
a request that is not a wildcard.

The refusal ACM actually issued is the empirical confirmation.
Under the retracted issue 6 model,
ACM would have climbed to `cloudfront.net`,
then `net`,
then the root,
found no restricting set,
and issued.

## Why now

The certificate was issued on 2026-05-09 while a temporary
`aws.aquati.cat. CAA 0 issue "amazon.com"` record existed.
Issue 5 of the AWS mirror document records that Njalla refused to add the
CloudFront CNAME while that CAA record was present,
so the CAA was deleted and the CNAME added.
Renewal is the first ACM operation since that deletion,
and it is the first one that re-runs the CAA check against the apex.

The trigger is a documented plan step,
not a configuration mistake by anyone.
Issue 6 supplied an incorrect reason to believe the step was safe.

## The constraint triangle

While DNS is at Njalla and the mirror leaf is a CNAME,
the CAA climb for `aws.aquati.cat` has exactly two candidate nodes:
the leaf,
which cannot hold CAA next to a CNAME,
and the apex.
At most two of these three properties can hold:

- the public hostname stays `aws.aquati.cat`;
- the apex CAA stays free of Amazon;
- the certificate stays ACM-managed.

Every option below gives up exactly one,
except option 3,
which buys back all three by moving that one name to a DNS host that
supports an alias-type record,
so the leaf can carry its own CAA.

## Options and ranking

### Option 1: publish the mirror on the CloudFront default hostname

Drop `aws.aquati.cat` as an alias,
delete the ACM certificate,
and advertise the distribution's own `<distribution-domain>` as the mirror
URL.
AWS maintains the `*.cloudfront.net` certificate,
which is authorized by `cloudfront.net`'s own `0 issuewild "amazonaws.com"`.

Verified working today,
not inferred:

```bash
curl -s -o /dev/null -D - https://<distribution-domain>/ | head -12
# HTTP/2 200
# etag: "digwj5nnibty2np"
# content-length: 3445
# server: Caddy
# x-cache: Miss from cloudfront

curl -s -o /dev/null -w '%{http_code} %{size_download}\n' https://<distribution-domain>/en/about
# 200 6081
curl -s -o /dev/null -w '%{http_code} %{size_download}\n' https://aws.aquati.cat/en/about
# 200 6081

echo | openssl s_client -connect <distribution-domain>:443 \
  -servername <distribution-domain> 2>/dev/null | openssl x509 -noout -subject -issuer -dates -ext subjectAltName
# subject=CN=*.cloudfront.net
# issuer=C=US, O=Amazon, CN=Amazon RSA 2048 M04
# notBefore=Aug 25 00:00:00 2026 GMT
# notAfter=Mar 10 23:59:59 2027 GMT
# X509v3 Subject Alternative Name: DNS:*.cloudfront.net, DNS:cloudfront.net
```

The root body over both hostnames shares one `etag` and one
`content-length`,
so the deployed origin-override function serves identical content on the
default hostname.
The root body contains one absolute `https://aquati.cat/` reference,
which the mirror hostname serves identically.

Cookie isolation on a shared second-level domain is settled:
`cloudfront.net` appears in the Public Suffix List,
so browsers do not share cookie scope across CloudFront tenants.

- Pros:
   no certificate to renew ever again;
  no CAA change anywhere;
  no dependency on Njalla resolving anything,
  which makes it the most independent of the three paths;
  zero cost;
  the AWS Health events stop.
- Cons:
   the URL is an AWS-assigned hostname rather than a name you
  control,
  so moving this mirror to another provider later means publishing a new
  URL;
  the string is stable for the life of the distribution but is not
  brandable;
  it requires an AWS-side mutation of a distribution whose Free pricing
  plan has already rejected one attempted change
  (see "Open questions").

### Option 2: move the mirror one label deeper and put the CAA there

Publish `CAA 0 issue "amazon.com"` at an intermediate label such as
`mirror.aquati.cat`,
and serve the mirror from `aws.mirror.aquati.cat` as a CNAME to the
distribution.
The climb terminates at the intermediate label and never reads the apex.

The intermediate node is an ordinary name with no CNAME,
so it can hold CAA.
The leaf may still be a CNAME,
because the CAA lives one level up.
ACM's DNS validation record for the new leaf is a child of a CNAME'd name,
which Njalla accepts:
the existing validation record for `aws.aquati.cat` proves it.

This is the option
[`doc/troubleshooting/aws-cloudfront-mirror.md`](../troubleshooting/aws-cloudfront-mirror.md)
dismissed under "Alternate label" with the claim that the label name is
irrelevant.
That claim holds only for a single label below the apex.

- Pros:
   the apex stays free of Amazon,
  which was the original design goal;
  ACM keeps managing renewal;
  zero cost;
  the hostname stays inside `aquati.cat`;
  the same intermediate label can later carry `certainly.com` for a
  relocated Fastly mirror,
  which would let the apex return to Let's Encrypt only.
- Cons:
   the public URL changes;
  a CloudFront distribution holds one viewer certificate,
  and a certificate covering both the old and new names would drag the
  apex back into the CAA check,
  so the old hostname stops working at cutover with no TLS-level redirect
  possible;
  it needs a new certificate request,
  a new validation record,
  and an alias change on the distribution.

### Option 3: delegate the mirror name to Route 53 with an alias record

Delegate `aws.aquati.cat` as its own zone to Route 53,
use an alias record to the distribution,
and publish `CAA 0 issue "amazon.com"` at that zone apex.
An alias record is not a CNAME on the wire,
so CAA can coexist with it.

- Pros:
   the only option that keeps all three properties in the constraint
  triangle;
  the hostname,
  the narrow apex,
  and ACM managed renewal all survive;
  Route 53 charges $0.50 per hosted zone per month and does not charge
  for queries to alias records that target CloudFront distributions.
- Cons:
   an NS delegation at Njalla;
  authoritative DNS for that name splits across two providers;
  a recurring cost and a second control plane for a mirror the existing
  documentation ranks below Fastly;
  the same AWS-side mutation risk as option 1.

### Option 4: widen the apex CAA

Add the four Amazon issuer domains at the apex,
keeping `letsencrypt.org` and `certainly.com`:

```text
aquati.cat. CAA 0 issue "amazon.com"
aquati.cat. CAA 0 issue "amazontrust.com"
aquati.cat. CAA 0 issue "awstrust.com"
aquati.cat. CAA 0 issue "amazonaws.com"
```

AWS documents all four values;
`amazon.com` alone suffices today and the other three survive an issuing
CA rotation.

- Pros:
   one DNS edit and nothing else;
  the only option that requires no AWS-side mutation at all,
  which matters for a distribution whose Free plan has rejected a change
  before;
  ACM resumes on its own retry loop;
  no cost.
- Cons:
   Amazon Trust Services becomes authorized for every name that
  inherits the apex,
  including the bare `aquati.cat`,
  which cannot be scoped narrower than its own record set;
  the AWS CAA documentation states that with no `issuewild` present and an
  `issue` record for ACM,
  Amazon may also issue wildcards,
  so `*.aquati.cat` is included unless `issuewild` records are added;
  it is the option the existing documentation rejected on principle.

Two partial recoveries,
both zero cost:

- `www.aquati.cat` is an A record,
  so `www.aquati.cat. CAA 0 issue "letsencrypt.org"` re-narrows it.
- `aquati.cat. CAA 0 issuewild "letsencrypt.org"` plus
  `aquati.cat. CAA 0 issuewild "certainly.com"` keeps wildcards away from
  Amazon,
  because RFC 8659 section 4.3 makes `issuewild` take precedence for
  wildcard requests.

### Option 5: retire the AWS mirror

Delete the ACM certificate,
the distribution,
and the CNAME.

- Pros:
   the problem disappears;
  no recurring work;
  the apex stays narrow.
- Cons:
   discards distribution `<distribution-id>`,
  which was repaired and end-to-end verified on 2026-09-07;
  Fastly remains the only mirror,
  and the Fastly certificate observed on 2026-10-09 has a 30-day life,
  so it carries its own renewal cadence.

### Option 6: import a Let's Encrypt certificate into CloudFront

- Pros:
   no Amazon authorization anywhere;
  one issuer family across origin and mirrors.
- Cons:
   ACM's managed renewal documentation states imported certificates
  are not eligible for managed renewal,
  so this creates a 60-to-90-day ACME DNS-01 pipeline against the Njalla
  API plus a distribution update and deploy wait,
  indefinitely,
  and moves the private key out of the managed boundary.

### Ranking

1 > 2 > 4 > 3 > 5 > 6.

- 1 over 2:
   option 1 removes the certificate lifecycle entirely and needs
  no DNS from you at all,
  which is verified working today,
  while option 2 keeps a certificate,
  a validation record,
  and a DNS dependency to buy a branded name for a mirror the existing
  documentation calls diversification rather than a primary path.
- 2 over 4:
   option 2 keeps the apex free of Amazon at zero cost,
  while option 4 buys URL continuity by authorizing Amazon Trust Services
  for every inheriting name in the zone including wildcards.
- 4 over 3:
   both keep the current hostname,
  but option 4 is one DNS edit with no AWS-side mutation and no new
  provider,
  while option 3 adds a monthly cost,
  an NS delegation,
  and a split control plane.
- 3 over 5:
   if the mirror is worth keeping,
  option 3 keeps it with the security property intact for $0.50 a month,
  which is trivial against the $250 per month Cloudflare Business tier
  already rejected for this mirror.
- 5 over 6:
   retiring removes recurring work,
  while option 6 creates a permanent renewal pipeline for the lowest
  priority mirror.

Options 1 and 2 compose in that order:
option 1 stops the expiry clock today with no certificate work,
and option 2 can follow later if a branded hostname turns out to matter.

## Verified dead ends

Measured,
so they should not be re-explored:

- **ACM's ACME issuance**,
  added in 2026.
  AWS documents that ACME-issued certificates cannot be used with Elastic
  Load Balancing,
  CloudFront,
  or API Gateway,
  because AWS does not hold the private key.
  They are also not auto-renewed.
  The issuing CA would still be Amazon,
  so the CAA requirement would not change either.
- **Scoping Amazon's authorization with RFC 8657 parameters**,
  such as `accounturi`.
  AWS's CAA documentation lists only flags `0`,
  tags `issue` and `issuewild`,
  and the four CA domain names,
  and states that `iodef` is currently ignored.
  No parameter support is documented,
  so option 4 cannot be narrowed to one AWS account.
- **Deleting the apex CAA records.**
  An empty set all the way to the root restricts nothing,
  so every CA becomes authorized for the whole zone.
  Strictly worse than option 4.
- **A single-label alternate name** such as `cdn.aquati.cat`.
  Its only ancestor with CAA is the apex,
  so the structural problem is unchanged.
  This is the case the existing documentation generalized too far.
- **An alias-type record at Njalla.**
  Njalla's published records documentation lists A,
  AAAA,
  and SRV,
  and the live zone shows CNAME,
  MX,
  TXT,
  CAA,
  HTTPS,
  and NS.
  No ALIAS or ANAME type is documented,
  and
  [`doc/troubleshooting/aws-cloudfront-mirror.md`](../troubleshooting/aws-cloudfront-mirror.md)
  independently records the same finding.
  Flattening a CloudFront endpoint into static A records would also pin
  edge IPs that AWS rotates.
- **Waiting for ACM to succeed on retry.**
  The CAA check is deterministic against the same record set.
  Retries change nothing until DNS changes.

## Remediation steps

### Option 1

1.  Re-authenticate the AWS CLI.
2.  Read the live distribution configuration and ETag,
    and save both.
3.  Confirm the Free pricing plan permits the change on a copy or during
    a maintenance window,
    since the same plan rejected a custom cache policy on 2026-09-07.
4.  Remove `aws.aquati.cat` from `Aliases` and set the viewer certificate
    back to the CloudFront default in one `UpdateDistribution` call.
5.  After the deployment reaches `Deployed`,
    delete the CNAME at Njalla and delete the ACM certificate.
6.  Publish the default hostname wherever the mirror URL is referenced.

### Option 2

1.  At Njalla,
    add `mirror.aquati.cat. CAA 0 issue "amazon.com"`,
    plus `0 issue "letsencrypt.org"` if any name under that label will
    ever use Let's Encrypt.
2.  Add `aws.mirror.aquati.cat. CNAME <distribution-domain>.`
3.  Request a new ACM certificate for `aws.mirror.aquati.cat` with DNS
    validation in `us-east-1`.
4.  Add the validation CNAME ACM reports;
    it is a child of the new CNAME'd leaf,
    which Njalla accepts.
5.  After the certificate reaches `ISSUED`,
    update the distribution's `Aliases` and `ViewerCertificate` in one
    call.
6.  Remove the old `aws.aquati.cat` CNAME and delete the old certificate
    only after the new hostname verifies.

### Option 3

1.  Create a Route 53 hosted zone for `aws.aquati.cat`.
2.  In it,
    create an alias record to the distribution and
    `CAA 0 issue "amazon.com"` at the zone apex.
3.  At Njalla,
    replace the `aws.aquati.cat` CNAME with NS records pointing at the
    four Route 53 name servers.
4.  Wait for the delegation to propagate,
    then confirm ACM's retry succeeds without any other change.

### Option 4

1.  At Njalla,
    add the four `issue` records listed in option 4.
2.  Optionally add the two `issuewild` records and the `www` record from
    the partial recoveries in option 4.
3.  Confirm the apex set with `dig +short CAA aquati.cat`.
4.  Wait for ACM's retry;
    no AWS-side action is needed.

### Option 5

1.  Remove the alias and certificate as in option 1,
    then delete the distribution.
2.  Delete the CNAME and the ACM validation record at Njalla.
3.  Detach the CloudFront function first if the Free plan refuses to
    delete a distribution that still has one associated.

## Verification

At the boundary a viewer uses,
not at the API:

```bash
echo | openssl s_client -connect <mirror-hostname>:443 -servername <mirror-hostname> 2>/dev/null \
  | openssl x509 -noout -dates -issuer
# notAfter must be later than Nov 22 23:59:59 2026 GMT

curl -s -o /dev/null -w '%{http_code} %{size_download}\n' https://<mirror-hostname>/
# 200 and a body length matching https://aquati.cat/
```

ACM state,
after re-authentication:

```bash
aws acm describe-certificate --certificate-arn <certificate-arn> --region us-east-1 \
  --query 'Certificate.{Status:Status,Renewal:RenewalSummary,Domain:DomainValidationOptions}'
```

For option 1 and option 2,
the boundary check must run against the hostname that will actually be
published,
and the old hostname must be checked for the intended failure
(a TLS name mismatch) rather than left silently broken.

## Open questions

- Does the Free pricing plan permit an `UpdateDistribution` that changes
  `Aliases` and `ViewerCertificate`?
  The 2026-09-07 work preserved both fields rather than changing them,
  and measured only that a custom cache policy is rejected.
  This gates options 1,
  2,
  and 5.
- Why does the apex authorize `certainly.com`?
  No commit or document records adding it.
  The Fastly mirror's Certainly certificate is consistent with it being
  deliberate,
  and the zone SOA serial shows the last change predates this incident.
  Under RFC 8659 the apex set is also what authorizes Certainly for
  `fastly.aquati.cat`,
  since that name is a CNAME with no CAA of its own.
- Does the origin's Let's Encrypt certificate use DNS-01 against Njalla?
  Only relevant if DNS for the apex ever moves.
- Should the Fastly mirror move under the same intermediate label as
  option 2,
  which would let the apex return to `letsencrypt.org` only?
- Is a Certificate Transparency watch for `aquati.cat` worth adding as a
  compensating control if option 4 is chosen?
  `iodef` is documented as ignored by ACM,
  so it would not report these refusals.

## Redaction convention

Angle-bracket placeholders in this file and in the files it references are
deliberate,
not editorial gaps.
Each one names an account-scoped AWS value that a reader of this public
repository does not need.
The recovering call is written next to the placeholder in
"Repository changes made while diagnosing" and in the identifier
inventory of
[`doc/troubleshooting/aws-cloudfront-mirror.md`](../troubleshooting/aws-cloudfront-mirror.md).

Values that are public through DNS by design are written literally where
they carry evidence:
hostnames,
CNAME targets,
CAA record sets,
and certificate subject and issuer fields.

## References

- RFC 8659 section 3,
  Relevant Resource Record Set:
  <https://www.rfc-editor.org/rfc/rfc8659.txt>
- RFC 8659 section 7,
  Differences from RFC 6844,
  including why CNAME chain climbing was removed:
  <https://www.rfc-editor.org/rfc/rfc8659.txt>
- AWS Certificate Manager,
  Certification Authority Authorization problems,
  with the four Amazon CA domain names:
  <https://docs.aws.amazon.com/acm/latest/userguide/troubleshooting-caa.html>
- AWS Certificate Manager,
  configure a CAA record,
  including the `issuewild` interaction and the ignored `iodef`:
  <https://docs.aws.amazon.com/acm/latest/userguide/setup.html#setup-caa>
- AWS Certificate Manager,
  managed certificate renewal eligibility,
  including imported and ACME certificates:
  <https://docs.aws.amazon.com/acm/latest/userguide/managed-renewal.html>
- AWS Certificate Manager,
  issuing certificates through ACME,
  including the CloudFront binding restriction:
  <https://docs.aws.amazon.com/acm/latest/userguide/acm-acme-issuance.html>
- Amazon Route 53 pricing,
  hosted zones and free alias queries to CloudFront:
  <https://aws.amazon.com/route53/pricing/>
- Public Suffix List,
  which contains `cloudfront.net`:
  <https://publicsuffix.org/list/public_suffix_list.dat>
- Njalla record documentation:
  <https://njal.la/docs/records/>
- Related:
  [`doc/troubleshooting/aws-cloudfront-mirror.md`](../troubleshooting/aws-cloudfront-mirror.md),
  [`doc/troubleshooting/cloudflare-mirror-evaluation.md`](../troubleshooting/cloudflare-mirror-evaluation.md),
  [`doc/handover/aws-cloudfront-mirror-correction.md`](aws-cloudfront-mirror-correction.md),
  [`package/ssg/aquati.cat/cloudfront/README.md`](../../package/ssg/aquati.cat/cloudfront/README.md)
