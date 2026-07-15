# AWS CloudFront mirror (us-east-1 ACM + Njalla DNS, Nov 2025): seven failure surfaces from Alt-Svc cross-origin SAN through TLS 1.3 origin handshake mismatch

**Date**:
 2026-05-09
**Subject**:
 Setting up `aws.aquati.cat` as a public CloudFront mirror of
self-hosted `aquati.cat` while keeping the apex CAA limited to
`letsencrypt.org`.
 Records issues 1 to 6 along the AWS-side configuration
path (certificate issuance,
 DNS,
 distribution creation),
 plus issue 7
(origin TLS handshake) which currently leaves the mirror non-functional
pending AWS shipping the November 2025 announced TLS 1.3 origin
auto-negotiation.

**Mirror status as of the date above**:
 HTTP 502 from CloudFront.
 All
AWS-side resources (cert,
 distribution,
 DNS) are correctly configured;
the CloudFront edge cannot complete a TLS handshake against an origin
that accepts only TLS 1.3.
 See issue 7 for diagnosis and workarounds.

## Background

`aquati.cat` is self-hosted on Hetzner using Caddy.
 The apex CAA record is:

```text
aquati.cat. IN CAA 0 issue "letsencrypt.org"
```

The goal:
 serve `aws.aquati.cat` as a public CloudFront mirror without
broadening the apex CAA to permit Amazon.
 Keeping the apex CAA narrow
preserves the property that only Let's Encrypt may issue certificates for
`aquati.cat`.

Context for priority:
 `fastly.aquati.cat` already exists as a working
mirror,
 so `aws.aquati.cat` is diversification rather than a primary
alternative path.
 The "wait" disposition in issue 7 is genuinely
sustainable;
 no critical functionality depends on the AWS mirror
landing.

The configuration path:

1. Drop cross-origin `Alt-Svc` from the apex.
2. Request a single-name ACM cert for `aws.aquati.cat`.
3. Place CAA on the subdomain to permit Amazon during issuance.
4. Remove the subdomain CAA when `aws.aquati.cat` becomes a CNAME to
   CloudFront.
5. Encounter unresolved origin TLS handshake mismatch (issue 7);
    the
   distribution remains deployed but returns HTTP 502 for all viewer
   requests until an origin TLS workaround is applied or AWS ships
   the announced auto-negotiation.

This document records the issues encountered along that path.

## Issue 1: cross-origin Alt-Svc forces a multi-SAN cert

### Symptom

An initial design served `aws.aquati.cat` as the CloudFront mirror **and**
advertised it from the apex with `Alt-Svc`:

```http
HTTP/2 200 OK
alt-svc: h2="aws.aquati.cat:443"; ma=86400
```

This forces the cert at `aws.aquati.cat` to cover both `aquati.cat` and
`aws.aquati.cat`,
 which in turn requires the apex CAA to permit Amazon.
That breaks the goal of keeping the apex CAA letsencrypt-only.

### Minimal repro

```bash
aws acm request-certificate \
  --domain-name aws.aquati.cat \
  --subject-alternative-names aquati.cat \
  --validation-method DNS \
  --region us-east-1
# Validation eventually fails with a CAA-related rejection on the
# aquati.cat name (apex CAA permits letsencrypt.org only).
```

### Root cause

RFC 7838 section 2.1 requires the alternative service to present a TLS
certificate that is valid for the **original** origin,
 not just for the
alternative service host name.
 So a cross-origin `Alt-Svc` from
`aquati.cat` to `aws.aquati.cat` forces the alternative service's cert to
include `aquati.cat` as a SAN.
 ACM's CAA check then reads the apex CAA,
which permits only Let's Encrypt,
 and refuses to issue.

Citation:
<https://datatracker.ietf.org/doc/html/rfc7838#section-2.1>

### Verified solution

Drop `Alt-Svc` from the apex response.
 The CloudFront mirror is served as
its own origin (`https://aws.aquati.cat`),
 not as an alternative origin
for `aquati.cat`.
 The cert can then be a single-name cert for
`aws.aquati.cat` only,
 and the apex is no longer a CAA-relevant name
during ACM issuance.

### Verification commands

```bash
curl -sI https://aquati.cat/ | grep -i alt-svc
# Expected: empty
```

## Issue 2: CAA tree-walk reaches the apex without a subdomain CAA

### Symptom

With no CAA record at `aws.aquati.cat`,
 ACM's CAA check walks up to the
apex,
 finds `letsencrypt.org` only,
 and refuses to issue.
 The validation
status moves through `PENDING_VALIDATION` and then fails with a CAA error
referencing `aquati.cat`.

### Minimal repro

```bash
# With no CAA at aws.aquati.cat, only at the apex:
aws acm request-certificate \
  --domain-name aws.aquati.cat \
  --validation-method DNS \
  --region us-east-1
# Issuance fails: the CAA record on aquati.cat does not authorize
# amazon.com (or any AWS issuer domain) to issue a certificate.
```

### Root cause

RFC 8659 section 3 specifies the CAA tree-walk.
 Starting from the queried
name,
 the resolver requests CAA records;
 if the set is empty,
 it walks up
to the parent label and repeats;
 the walk terminates at the first label
that has a non-empty CAA record set,
 or at the DNS root.

For `aws.aquati.cat`,
 the walk starts at `aws.aquati.cat` (no CAA),
 moves
to `aquati.cat` (apex CAA `letsencrypt.org` only),
 and stops there.
Amazon is not in the apex set,
 so ACM refuses.

Citation:
<https://datatracker.ietf.org/doc/html/rfc8659#section-3>

### Verified solution

Place a CAA record at `aws.aquati.cat` that permits Amazon.
 The walk now
terminates one level below the apex and never reads the apex CAA.
 The
apex CAA stays untouched.

```text
aws.aquati.cat. 300 IN CAA 0 issue "amazon.com"
```

For full AWS CA coverage,
 AWS documents four issuer domains:
`amazon.com`,
 `amazontrust.com`,
 `awstrust.com`,
 `amazonaws.com`.
`amazon.com` alone is sufficient for ACM-issued certs in practice,
 but
adding all four is safer if AWS rotates the issuing CA.

### Verification commands

```bash
dig +short CAA aws.aquati.cat
# Expected: 0 issue "amazon.com"

dig +short CAA aquati.cat
# Expected: 0 issue "letsencrypt.org" (unchanged)
```

## Issue 3: CloudFront rejects EC_secp384r1 certs with a misleading error

### Symptom

Requesting an ACM cert with `--key-algorithm EC_secp384r1` succeeds.
 The
cert is issued and validated normally.
 Attaching it to a new CloudFront
distribution then fails with:

```text
An error occurred (InvalidViewerCertificate) when calling the
CreateDistribution operation: The specified SSL certificate doesn't
exist, isn't in us-east-1 region, isn't valid, or doesn't include a
valid certificate chain.
```

The error string lists four conditions,
 none of which apply:
 the cert
exists,
 it is in `us-east-1`,
 it is valid (`Status: ISSUED`),
 and its
chain is complete.
 The actual cause (an unsupported key algorithm) is
not mentioned anywhere in the error.

### Minimal repro

```bash
aws acm request-certificate \
  --domain-name aws.aquati.cat \
  --validation-method DNS \
  --key-algorithm EC_secp384r1 \
  --region us-east-1

# After validation completes and Status is ISSUED:

aws cloudfront create-distribution --distribution-config '{
  "ViewerCertificate": {
    "ACMCertificateArn": "<arn>",
    "SSLSupportMethod": "sni-only",
    "MinimumProtocolVersion": "TLSv1.2_2021"
  }
}'
# Fails with InvalidViewerCertificate as quoted above.
```

### Root cause

CloudFront supports a restricted set of public key algorithms.
 Per the
AWS documentation,
 the supported algorithms are RSA at 1024,
 2048,
 3072,
or 4096 bits,
 plus ECDSA `prime256v1` (P-256).
 `EC_secp384r1` (P-384) is
not on the supported list.

The `InvalidViewerCertificate` error message does not mention algorithm,
which makes the diagnosis non-obvious;
 the message reads as if the ARN
were wrong,
 the region were wrong,
 or the chain were broken.

Citation:
<https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cnames-and-https-requirements.html#https-requirements-size-of-public-key>

### Verified solution

Re-request the cert with a supported algorithm.
 `EC_prime256v1` is the
closest equivalent:

```bash
aws acm request-certificate \
  --domain-name aws.aquati.cat \
  --validation-method DNS \
  --key-algorithm EC_prime256v1 \
  --region us-east-1
```

`RSA_2048` is the alternative if EC is not desired.

### Verification commands

```bash
aws acm describe-certificate \
  --certificate-arn <new-arn> \
  --region us-east-1 \
  --query 'Certificate.KeyAlgorithm'
# Expected: "EC-prime256v1"

aws cloudfront create-distribution --distribution-config '{...}'
# Expected: success, no InvalidViewerCertificate.
```

## Issue 4: ACM validation CNAME tokens are deterministic per (account, domain)

### Symptom

After replacing the rejected `EC_secp384r1` cert (issue 3),
 the next
expectation is that a fresh validation CNAME is needed for the new
request.
 The existing validation record from the previous (failed)
request is still in DNS.

### Observation

`describe-certificate` for the new request returns the **same**
validation CNAME name and value as the old request.
 The pre-existing
record validates the new request immediately,
 with no DNS edits.

### Minimal repro

```bash
# After the first (failed) request:
aws acm describe-certificate --certificate-arn <old-arn> \
  --region us-east-1 \
  --query 'Certificate.DomainValidationOptions[0].ResourceRecord'

# After the replacement request:
aws acm describe-certificate --certificate-arn <new-arn> \
  --region us-east-1 \
  --query 'Certificate.DomainValidationOptions[0].ResourceRecord'

# Output: identical Name and Value across both requests.
```

### Root cause

ACM derives the validation CNAME deterministically from the AWS account
ID and the domain name.
 The same `(account, domain)` tuple always yields
the same `_<token>.<domain>` CNAME pointing to
`_<value>.<token>.acm-validations.aws.`,
 regardless of the cert's key
algorithm,
 validity period,
 or whether a previous request was abandoned.

This is not called out in a single canonical AWS doc,
 but it is
consistent across cert reissuance,
 deletion-and-recreation,
 and
algorithm changes for the same domain in the same account.
 Confirmed
empirically here.

### Verified solution

When re-requesting an ACM cert for the same domain in the same account,
leave the validation CNAME in place.
 ACM picks it up on the next
describe poll and validates the replacement request without any DNS
change.

### Verification commands

```bash
# Confirm the CNAME stayed put across the re-request:
dig +short CNAME _<token>.aws.aquati.cat
# Expected: _<value>.<token>.acm-validations.aws.

# Confirm the new cert moved to ISSUED without a DNS edit:
aws acm describe-certificate --certificate-arn <new-arn> \
  --region us-east-1 \
  --query 'Certificate.Status'
# Expected: "ISSUED"
```

## Issue 5: CAA-vs-CNAME conflict at the same DNS name

### Symptom

After the cert is issued,
 the next step is to point `aws.aquati.cat` at
the CloudFront distribution via a CNAME.
 Adding the CNAME at the
registrar (Njalla) fails:

```text
Cannot add CNAME: aws.aquati.cat already has a CAA record. CNAME
records cannot coexist with other record types at the same name.
```

### Minimal repro

```text
# Existing record (from issue 2):
aws.aquati.cat. IN CAA 0 issue "amazon.com"

# Attempted addition:
aws.aquati.cat. IN CNAME <distribution>.cloudfront.net.

# Registrar refuses; resolvers that ignored the registrar's enforcement
# would produce undefined behavior at query time.
```

### Root cause

RFC 1912 section 2.4 states plainly:
 a CNAME record is not allowed to
coexist with any other data.
 RFC 2181 section 10.5.1 narrows the
exception to DNSSEC sibling records (the `SIG`/`NXT` family in the
original text,
 with later equivalents).
 CAA is not on that exception
list.

The CAA record placed at `aws.aquati.cat` in issue 2 therefore blocks
the CNAME add.
 Njalla enforces this at the registrar layer.

Citations:

- <https://datatracker.ietf.org/doc/html/rfc1912#section-2.4>
- <https://datatracker.ietf.org/doc/html/rfc2181#section-10.5.1>

### Verified solution

Remove the CAA record at `aws.aquati.cat` before adding the CNAME:

1. Delete `aws.aquati.cat. IN CAA 0 issue "amazon.com"`.
2. Add `aws.aquati.cat. IN CNAME <distribution>.cloudfront.net.`.

### Verification commands

```bash
dig +short CAA aws.aquati.cat
# Expected: empty

dig +short CNAME aws.aquati.cat
# Expected: <distribution>.cloudfront.net.
```

## Issue 6: removing the subdomain CAA stays safe because ACM follows CNAMEs

### Concern

Removing the CAA at `aws.aquati.cat` (issue 5) appears to re-expose the
original problem from issue 2:
 with no CAA at the subdomain,
 the CAA
tree-walk would reach the apex,
 hit `letsencrypt.org` only,
 and block
ACM's renewal of the cert.

### Why it stays safe

RFC 8659 section 3 requires CAs to follow CNAME aliases during CAA
processing.
 When the queried name has no CAA records but does have a
CNAME,
 the resolver follows the alias and walks the CAA chain from the
**target** of the CNAME,
 not from the parent of the original name.

After `aws.aquati.cat` becomes a CNAME,
 the CAA processing chain at
ACM renewal time is:

1. `aws.aquati.cat`:
    no CAA,
    but a CNAME is present,
    so follow the
   alias.
2. `<distribution>.cloudfront.net`:
    no CAA,
    walk up.
3. `cloudfront.net`:
    no CAA,
    walk up.
4. `net`:
    no CAA,
    walk up.
5. (root):
    no CAA.

No restrictive CAA is encountered along the chain.
 ACM is permitted,
and renewal works.

The apex CAA at `aquati.cat` is never read during this process.
 Once
the CNAME is followed,
 the walk continues up the **target's** parent
chain (`cloudfront.net`,
 `net`,
 root),
 not back into the original tree.

Citation:
<https://datatracker.ietf.org/doc/html/rfc8659#section-3>

### Verification commands

```bash
# After cert renewal completes, confirm ACM kept the cert valid:
aws acm describe-certificate --certificate-arn <arn> \
  --region us-east-1 \
  --query 'Certificate.Status'
# Expected: "ISSUED"

# Confirm no CAA blocks anywhere on the resolution chain:
dig +short CAA aws.aquati.cat
# Expected: empty (CNAME present, queried name has no CAA)

target=$(dig +short CNAME aws.aquati.cat | sed 's/\.$//')
dig +short CAA "$target"
# Expected: empty

dig +short CAA cloudfront.net
# Expected: empty
```

## Issue 7: TLS 1.3 origin announcement out of sync with API and edge behavior

### Symptom

After completing issues 1 to 6,
 the CloudFront distribution `EYK5GXXEGWEYZ`
deploys cleanly.
 The first end-to-end test against `https://aws.aquati.cat/`
returns HTTP 502 from CloudFront:

```bash
curl -sI https://aws.aquati.cat/
# HTTP/2 502
# x-cache: Error from cloudfront
# via: 1.1 fa01d52e12da475687f2d2f66a3af028.cloudfront.net (CloudFront)
# x-amz-cf-pop: YTO53-P2
```

The CloudFront edge cannot establish a TLS handshake with the origin.
Direct openssl probes confirm that Caddy at `aquati.cat` accepts TLS 1.3
only:

```bash
openssl s_client -connect aquati.cat:443 -servername aquati.cat \
  -tls1_2 -brief </dev/null
# error:0A00042E:SSL routines:ssl3_read_bytes:tlsv1 alert protocol version
# Alert 70 ("protocol_version"): server refused TLS 1.2.

openssl s_client -connect aquati.cat:443 -servername aquati.cat \
  -tls1_3 -brief </dev/null
# CONNECTION ESTABLISHED
# Protocol version: TLSv1.3
```

### Minimal repro

1. Origin (Caddy or any other TLS server) is configured to accept only
   TLS 1.3.
2. CloudFront distribution with
   `CustomOriginConfig.OriginSslProtocols.Items: ["TLSv1.2"]` (the only
   value the API enum accepts;
    see root cause).
3. Request through the distribution.
    Result:
    HTTP 502.

### Root cause

A two-layer mismatch between the AWS announcement and the deployed
system.

**Layer 1:
 the API enum is closed at TLSv1.2.
**

```bash
aws cloudfront update-distribution \
  --id <id> --if-match <etag> \
  --distribution-config '{... OriginSslProtocols Items: ["TLSv1.2", "TLSv1.3"] ...}'
# An error occurred (MalformedXML) when calling the UpdateDistribution
# operation: ... Member must satisfy enum value set:
# [SSLv3, TLSv1, TLSv1.1, TLSv1.2]
```

The field is also required:

```bash
aws cloudfront update-distribution \
  --id <id> --if-match <etag> \
  --distribution-config '{... OriginSslProtocols field omitted ...}'
# An error occurred (InvalidArgument) when calling the UpdateDistribution
# operation: The parameter OriginSslProtocols is required.
```

So the distribution must declare `OriginSslProtocols`,
 and the only TLS
1.
x value the enum accepts is `TLSv1.2`.

**Layer 2:
 the announced auto-negotiation is not observed.
**

AWS announced in November 2025:
 "CloudFront will automatically negotiate
TLS 1.3 when your origin supports it" with "no configuration changes
required.
" Empirically,
 with `OriginSslProtocols: ["TLSv1.2"]` and an
origin that accepts only TLS 1.3,
 the YTO53-P2 (Toronto) edge returns
HTTP 502 instead of negotiating TLS 1.3.
 Multiple post-November-2025
sources report the same:

- Stack Overflow comment,
   2025-11-04:
   "As of Nov 2025,
   cloudfront still
  doesn't support TLS 1.3 with connection to origin.
  "
  <https://stackoverflow.com/questions/58209174/does-aws-cloudfront-support-tlsv1-3-for-custom-origin>
- Reddit r/aws thread:
   "CloudFront doesn't support TLS1.3 between CF and
  Origin because it's not a valid value for OriginSslProtocols.
  "
  <https://www.reddit.com/r/aws/comments/133zunj/>
- AWS re:
  Post feature request thread:
  <https://repost.aws/questions/QUzNusy9axTz2iWIyfK1q-nw/feature-cloudfront-origin-tls-v1-3>
- Terraform AWS provider issue 43840 (related,
   viewer-side
  `TLSv1.3_2025` also rejected):
  <https://github.com/hashicorp/terraform-provider-aws/issues/43840>

AWS announcement:
<https://aws.amazon.com/about-aws/whats-new/2025/11/amazon-cloudfront-tls13-origin/>

### Verified workarounds

Each preserves a different security property.
 None ship as part of the
current configuration;
 the chosen path is to leave the mirror
non-functional until AWS's announced auto-negotiation actually applies.

**A.
 Enable TLS 1.2 globally on origin.
** Caddyfile change:

```caddyfile
aquati.cat {
    tls {
        protocols tls1.2 tls1.3
    }
    # ... handlers
}
```

Caddy 2's TLS 1.2 cipher set excludes RC4,
 DES,
 export-grade,
 CBC stream
modes,
 and small-prime DHE.
 The marginal handshake regression is small.
Trade-off:
 all clients lose the TLS-1.3-only stance,
 not just AWS edges.

**B.
 Single site block plus HTTP-layer abort matcher.
** Reject TLS 1.2
at the HTTP layer for non-AWS clients:

```caddyfile
aquati.cat {
    tls {
        protocols tls1.2 tls1.3
    }

    @reject_old_tls_non_aws {
        expression `{http.request.tls.version} == "tls1.2"`
        not remote_ip <CIDRs from CLOUDFRONT_ORIGIN_FACING>
    }
    abort @reject_old_tls_non_aws
    # ... handlers
}
```

CIDR list refreshed periodically from
<https://ip-ranges.amazonaws.com/ip-ranges.json>,
 filtered to
`service == "CLOUDFRONT_ORIGIN_FACING"`.
 As of the date above:
 45 IPv4
and 2 IPv6 prefixes.
 Trade-off:
 TLS 1.2 handshake is exposed publicly;
content delivery is restricted;
 recurring CIDR refresh required when
AWS publishes a new POP block.

**C.
 Two site blocks plus separate origin hostname.
** Add an
`origin.aquati.cat` site block with TLS 1.2+ and the same IP allowlist;
switch the CloudFront distribution origin domain from `aquati.cat` to
`origin.aquati.cat`.
 The public hostname keeps TLS-1.3-only at
handshake.
 Adds DNS records (`origin` A and AAAA),
 a second LE cert
auto-provisioned by Caddy,
 and a distribution origin domain update.
Same recurring CIDR refresh as option B.

**D.
 Wait.
** Leave configuration as is.
 Distribution returns 502.
Re-test periodically;
 re-enabling the mirror requires only a Caddy
reload (option A) or no change at all (if AWS ships the auto-negotiation
cleanly).

### Verification commands

```bash
# Origin TLS policy:
openssl s_client -connect aquati.cat:443 -servername aquati.cat \
  -tls1_2 -brief </dev/null
# Expected (TLS-1.3-only origin): alert number 70 (protocol_version).

openssl s_client -connect aquati.cat:443 -servername aquati.cat \
  -tls1_3 -brief </dev/null
# Expected: CONNECTION ESTABLISHED, Protocol version: TLSv1.3.

# CloudFront mirror:
curl -sI https://aws.aquati.cat/ | head -5
# Expected (current state): HTTP/2 502.
# Expected (after AWS fix or origin TLS 1.2 enable): HTTP/2 200.

# AWS API enum check (probe; does not change state):
aws cloudfront update-distribution \
  --id <id> --if-match <etag> \
  --distribution-config '{... OriginSslProtocols Items: ["TLSv1.3"] ...}'
# Expected (still): MalformedXML, "Member must satisfy enum value set:
# [SSLv3, TLSv1, TLSv1.1, TLSv1.2]". When this stops erroring, the API
# has caught up and option D becomes the right path again.
```

## Current configuration state

**Status**:
 AWS-side resources fully configured;
 mirror returns HTTP 502
because of issue 7.
 All steps below remain valid;
 only the origin TLS
handshake is unresolved.

Concrete identifiers (as of the date above):

- AWS account:
   `016042452668`.
- ACM certificate ARN:
  `arn:aws:acm:us-east-1:016042452668:certificate/c5d23357-7ed7-4393-87b4-e62f4c5d4751`.
- CloudFront distribution ID:
   `EYK5GXXEGWEYZ`.
- CloudFront distribution domain:
   `dyfbcoafqtni3.cloudfront.net`.

DNS records:

- `aquati.cat. IN CAA 0 issue "letsencrypt.org"` (apex,
   unchanged from
  the starting state).
- `aws.aquati.cat. IN CNAME dyfbcoafqtni3.cloudfront.net.`
- `_9593853f9aa43436c944ab2fe8d548d3.aws.aquati.cat. IN CNAME _7a600be3b5a98f691b651f493a643f06.jkddzztszm.acm-validations.aws.`
  (kept permanently for renewal;
   deleting this record breaks the next
  ACM renewal cycle).

ACM cert:

- Region:
   `us-east-1` (mandatory for CloudFront viewer certs).
- Domain:
   `aws.aquati.cat` (single name,
   no SANs).
- Key algorithm:
   `EC_prime256v1`.
- Validation method:
   DNS.

Properties this configuration preserves:

- The apex CAA is unchanged.
   Only Let's Encrypt may issue certs for
  `aquati.cat`.
- Amazon may issue certs only for `aws.aquati.cat`,
   and only because the
  CAA chain at renewal time runs through `cloudfront.net`'s empty CAA,
  not through the apex.

## What does not work

The following alternatives were considered and rejected:

- **Wider apex CAA**,
   e.g. adding `0 issue "amazon.com"` at
  `aquati.cat`.
   Rejected on principle:
   the goal is to keep the apex's
  attack surface narrow.
   Permitting Amazon to issue for the apex
  defeats the purpose of running a restrictive CAA at all.
- **ALIAS records at the apex** pointing to CloudFront.
   Njalla supports
  only standard DNS record types;
   there is no Route 53 ALIAS or
  CNAME-flattening equivalent.
   Even if it were available,
   the apex
  would still need CAA permitting Amazon at issuance time (same dead
  end as widening the apex CAA).
- **Alternate label** like `cdn.aquati.cat`.
   The CAA tree-walk and
  CAA-vs-CNAME constraints apply equally to any subdomain of
  `aquati.cat`.
   The label name is irrelevant;
   the structural issues
  are identical.
- **`EC_secp384r1` cert** (P-384).
   CloudFront rejects it with the opaque
  `InvalidViewerCertificate` error documented in issue 3.
   Use
  `EC_prime256v1` (P-256) or `RSA_2048` instead.
- **`OriginSslProtocols.Items: ["TLSv1.3"]`** in the distribution config.
  The CloudFront API enum is closed at `[SSLv3, TLSv1, TLSv1.1, TLSv1.2]`;
  the call returns `MalformedXML` (issue 7).
- **Omitting `OriginSslProtocols`** in the distribution config.
   The API
  returns `InvalidArgument: The parameter OriginSslProtocols is required.`
  The field cannot be left blank or absent.
- **`OriginProtocolPolicy: http-only`** as a way to bypass TLS to origin.
  Caddy enforces a redirect from HTTP to HTTPS,
   so CloudFront would
  receive a 308 from the origin and not retry over HTTPS.
   The redirect
  is also visible to viewers if `ViewerProtocolPolicy` allows HTTP.
- **`MinimumProtocolVersion: "TLSv1.3_2025"`** on the viewer certificate.
  Terraform AWS provider issue 43840 confirms the API rejects it;
   even
  if accepted,
   this is a viewer-side setting and does not affect the
  origin handshake mismatch documented in issue 7.
- **Relying on the November 2025 announced auto-negotiation**.
   AWS
  documented that CloudFront would automatically negotiate TLS 1.3
  against origins that support it,
   without configuration changes.
  Empirically,
   the YTO53-P2 edge does not auto-negotiate TLS 1.3
  against an origin that accepts only TLS 1.3.
   Multiple post-November
  community reports observe the same.
   Status of the announcement:
   not
  reliably shipped as of the date above.

## Why we do not file these upstream

Walked per issue against the 5-constraint upstream-filing check.
 Default
policy:
 do not file.
 The audit trail is the point.

### Issues 1, 2, 5, 6: RFC-mandated behavior

Issues 1 (RFC 7838 forces multi-SAN cert for cross-origin Alt-Svc),
 2
(RFC 8659 tree-walk reaches apex),
 5 (RFC 1912 plus RFC 2181 ban
CAA-vs-CNAME coexistence),
 6 (RFC 8659 CNAME-following keeps chain safe)
are RFC-mandated behaviors,
 not bugs.

1. **Upstream's fault?
   ** No. RFCs 7838,
    8659,
    1912,
    2181 define the
   behavior.
    ACM,
    Njalla,
    and CloudFront each implement the specs
   correctly.
2. **Can upstream fix it?
   ** Not applicable;
    the RFC is the spec.
3. **Supporting the use case?
   ** Not applicable;
    the use case is fully
   supported,
    just constrained by the specs.
4. **Will they fix it?
   ** Not applicable.
5. **Minimal-fix prototype?
   ** Not applicable.

**Decision:
 no upstream report.
** The "fix" is to understand the spec
and route around it (issue 1:
 drop Alt-Svc;
 issue 2:
 place subdomain
CAA;
 issue 5:
 remove subdomain CAA before adding CNAME;
 issue 6:
trust the CNAME-following walk).

### Issue 3: CloudFront InvalidViewerCertificate error string omits key algorithm cause

The error string lists four conditions (ARN,
 region,
 validity,
 chain),
none of which apply when the cause is an unsupported key algorithm
(`EC_secp384r1`).
 UX defect,
 not a behavior defect.

1. **Upstream's fault?
   ** Yes.
    Error message is genuinely misleading.
2. **Can upstream fix it?
   ** Yes;
    one-line change to the error string in
   the `CreateDistribution` validation path to name the unsupported
   algorithm or list the supported set.
3. **Supporting the use case?
   ** Yes.
    Single-name ACM cert + CloudFront
   distribution is a documented,
    common combination.
4. **Will they fix it?
   ** Unknown.
    AWS service teams do iterate on error
   message wording,
    but this specific message has been in the field for
   years across multiple algorithm changes (RSA → ECDSA,
    P-256
   introduction).
    Low signal that a fix is queued.
5. **Minimal-fix prototype?
   ** Not feasible;
    the validation code is
   closed-source.
    A user-facing prototype would be a Re:
   Post feedback
   item with the misleading message and the actual cause.

**Decision:
 do not file as a bug.
** Already-existing internal
diagnosis is enough;
 AWS does not provide a tracker that accepts UX
feedback at a granularity finer than Re:
Post.
 If a Re:
Post post would
help future searchers find the diagnosis,
 the draft below is the
content.
 Do not file as-is.

````md
**Title:** CloudFront `InvalidViewerCertificate` error string does not
mention unsupported key algorithm when ACM cert uses EC_secp384r1

**Symptom:**

```
An error occurred (InvalidViewerCertificate) when calling the
CreateDistribution operation: The specified SSL certificate doesn't
exist, isn't in us-east-1 region, isn't valid, or doesn't include a
valid certificate chain.
```

None of the four listed conditions applies when the actual cause is an
ECDSA P-384 key. The supported algorithms are RSA at 1024/2048/3072/4096
plus ECDSA prime256v1
(<https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cnames-and-https-requirements.html#https-requirements-size-of-public-key>).

**Suggested fix:** Add the supported-algorithm set to the error string
when the ARN, region, validity, and chain are all valid but the key
algorithm is not in the supported set.
````

### Issue 4: ACM validation CNAME deterministic per (account, domain), docs gap

ACM derives the validation CNAME deterministically from the AWS account
ID and the domain name,
 so re-requests for the same `(account, domain)`
reuse the existing CNAME.
 This is consistent and useful,
 but not
documented in a single canonical AWS doc.

1. **Upstream's fault?
   ** Yes,
    narrowly:
    docs gap.
    Behavior is
   reasonable;
    documentation does not call it out.
2. **Can upstream fix it?
   ** Yes;
    one paragraph in the ACM DNS
   validation docs.
3. **Supporting the use case?
   ** Yes;
    re-requesting after a failed cert
   is a common path.
4. **Will they fix it?
   ** Unknown.
    Docs feedback through the page's
   feedback widget is the standard route.
5. **Minimal-fix prototype?
   ** Docs-only change;
    the prototype is the
   one-paragraph addition.

**Decision:
 low-priority docs feedback only.
** Future investigators
can find the diagnosis here;
 AWS docs feedback widget is the route if
filed.
 Do not file as a bug.

### Issue 7: CloudFront edge HTTP 502 against TLS-1.3-only origin

Two-layer mismatch:
 API enum still closed at `[SSLv3, TLSv1, TLSv1.1,
TLSv1.2]`,
 and the November 2025 announced auto-negotiation does not
apply at the YTO53-P2 edge as of the date above.

1. **Upstream's fault?
   ** Yes.
    AWS announced the feature publicly,
    the
   API enum has not been extended,
    and the edge behavior does not
   match the announcement.
2. **Can upstream fix it?
   ** Yes.
    The fix is API enum extension to
   include `TLSv1.3` and edge rollout of the auto-negotiation;
    AWS is
   the only party with access.
3. **Supporting the use case?
   ** Yes per the November 2025 announcement.
4. **Will they fix it?
   ** Likely yes,
    given the announcement,
    but the
   ship date is uncertain.
    Re:
   Post feature request thread already
   open:
    <https://repost.aws/questions/QUzNusy9axTz2iWIyfK1q-nw>.
5. **Minimal-fix prototype?
   ** Not feasible;
    the API is closed-source.

**Decision:
 no separate filing.
** The existing Re:
Post feature request
covers the use case.
 Wait for AWS to ship;
 workaround D (wait) is the
chosen path because `fastly.aquati.cat` already provides the mirror
function.
 If the wait extends past 6 months from announcement
(2026-05),
 reconsider workaround A or C.

## References

- RFC 7838,
   HTTP Alternative Services,
   section 2.1:
  <https://datatracker.ietf.org/doc/html/rfc7838#section-2.1>
- RFC 8659,
   DNS Certification Authority Authorization,
   section 3:
  <https://datatracker.ietf.org/doc/html/rfc8659#section-3>
- RFC 1912,
   Common DNS Operational and Configuration Errors,
  section 2.4:
  <https://datatracker.ietf.org/doc/html/rfc1912#section-2.4>
- RFC 2181,
   Clarifications to the DNS Specification,
   section 10.5.1:
  <https://datatracker.ietf.org/doc/html/rfc2181#section-10.5.1>
- CloudFront supported public key sizes and algorithms:
  <https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cnames-and-https-requirements.html#https-requirements-size-of-public-key>
- AWS announcement,
   "Amazon CloudFront now supports TLS 1.3 for origin
  connections" (November 2025):
  <https://aws.amazon.com/about-aws/whats-new/2025/11/amazon-cloudfront-tls13-origin/>
- AWS API reference,
   `OriginSslProtocols`:
  <https://docs.aws.amazon.com/cloudfront/latest/APIReference/API_OriginSslProtocols.html>
- AWS re:
  Post,
   "[Feature] CloudFront Origin TLS v1.3":
  <https://repost.aws/questions/QUzNusy9axTz2iWIyfK1q-nw/feature-cloudfront-origin-tls-v1-3>
- Stack Overflow,
   "Does AWS CloudFront support TLSv1.3 for custom origin?
  ":
  <https://stackoverflow.com/questions/58209174/does-aws-cloudfront-support-tlsv1-3-for-custom-origin>
- Reddit r/aws,
   "What TLS version does AWS use for communication b/w
  cloudfront distribution and S3 origins":
  <https://www.reddit.com/r/aws/comments/133zunj/>
- Terraform AWS provider issue 43840,
   "TLS v1.3 missing from Viewer
  Certificate in Cloudfront Distribution":
  <https://github.com/hashicorp/terraform-provider-aws/issues/43840>
- AWS published IP ranges (filter by `service == "CLOUDFRONT_ORIGIN_FACING"`):
  <https://ip-ranges.amazonaws.com/ip-ranges.json>
- Caddy v2 placeholders and matchers:
  <https://caddyserver.com/docs/conventions>,
  <https://caddyserver.com/docs/caddyfile/matchers>
