# AWS CloudFront mirror: certificate and DNS setup failures, then unresolved HTTP 502

**Original investigation**:
 2026-05-09.
**Reassessment**:
 2026-09-07.
**Subject**:
 Setting up `aws.aquati.cat` as a public CloudFront mirror of
self-hosted `aquati.cat` while keeping the apex CAA limited to
`letsencrypt.org`.
 Records issues 1 to 6 along the AWS-side configuration
path (certificate issuance,
 DNS,
 distribution creation),
 plus issue 7
(CloudFront HTTP 502).
The reassessment retracts the inference that this proves an unfinished TLS 1.3 rollout.

**Mirror status on 2026-09-07**:
HTTP 502 from CloudFront.
Direct probes of `aquati.cat:443` negotiate TLS 1.3 and reject TLS 1.2 over IPv4 and IPv6 with `aquati.cat` SNI.
The current distribution configuration and CloudFront-to-origin handshake were not obtained;
the exact cause remains unconfirmed.
See issue 7 for evidence,
omitted alternatives,
and verification limits.

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
The original disposition was to wait.
That priority judgment does not establish an AWS rollout defect;
issue 7 records the reassessment.

The configuration path:

1. Drop cross-origin `Alt-Svc` from the apex.
2. Request a single-name ACM cert for `aws.aquati.cat`.
3. Place CAA on the subdomain to permit Amazon during issuance.
4. Remove the subdomain CAA when `aws.aquati.cat` becomes a CNAME to
   CloudFront.
5. Encounter HTTP 502 from CloudFront (issue 7).
   Requests to `/` still fail in the reassessment;
   neither the failure's full path scope nor its cause has been established.

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

## Issue 7: CloudFront HTTP 502 does not establish absent TLS 1.3 origin support

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

The original investigation attributed this to a TLS version mismatch.
Direct OpenSSL probes establish how `aquati.cat:443` responds to those inputs,
not CloudFront's actual handshake or current origin configuration:

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

### Root cause: not established

The 2026-05-09 inference was too strong.
The [AWS announcement][origin-tls-announcement],
dated 2025-11-20,
says:

> TLS 1.3 support is automatically enabled for all origin types,
> including custom origins,
> Amazon S3,
> and Application Load Balancers,
> with no configuration changes required on your part.

AWS describes CloudFront automatically negotiating TLS 1.3 with supporting origins.
The current [API reference][origin-protocol-api] still lists
`SSLv3 | TLSv1 | TLSv1.1 | TLSv1.2`.
That proves the documented configuration vocabulary,
not the maximum version in CloudFront's ClientHello.
Neither document resolves what happened on this distribution's connection.
The linked [origin cipher guide][origin-ciphers] still lacks TLS 1.3 cipher names;
the documentation is not a substitute for a correlated handshake capture.

The original evidence also mixed incompatible timelines and boundaries:

- The cited 2025-11-04 comment predates the 2025-11-20 announcement.
- A viewer-certificate policy failure does not establish an origin-protocol failure.
- A generic HTTP 502 is compatible with multiple causes in
  [AWS's troubleshooting guide][cloudfront-502],
  including certificate-name mismatch,
  incomplete chains,
  DNS,
  and origin connectivity.

[Caddy issue #7445][caddy-cloudfront-issue] contains a separate report of CloudFront sending
an unexpected SNI name and Caddy logging `no certificate available`.
It is a hypothesis source,
not proof that this distribution has the same cause.
No CloudFront implementation source or origin-side trace was available in this reassessment.
No claim about Caddy's internal call chain is made.

### Omitted avenues and their tradeoffs

This is an architecture review,
not a completed vendor selection or authorization to deploy.

#### Diagnose the existing origin path without lowering TLS

- Benefit:
  a hostname,
  certificate,
  or routing correction could preserve the current architecture and TLS policy.
- Cost:
  requires authenticated distribution inspection and correlated origin evidence;
  an actual CloudFront interoperability defect remains possible.
- Verification:
  inspect the active origin hostname,
  port,
  request/cache policies,
  deployed state,
  and any request functions.
  Correlate a failing request with CloudFront detailed results and the origin's received
  SNI,
  supported TLS versions,
  certificate selection,
  and network outcome.

AWS [documents][origin-request-policies] an existing mechanism that replaces the viewer's `Host`
with the origin domain when the viewer `Host` is excluded.
This establishes a configuration avenue,
not that attaching `AllViewerExceptHostHeader` fixes this site.
Its broad forwarding of other viewer data is not automatically appropriate for a static site.

#### Publish a separate static-artifact replica

The issue assumes a mirror must fetch from the live Caddy origin.
The repository's site is generated into static files:
see [`package/ssg/aquati.cat/README.md`](../../package/ssg/aquati.cat/README.md).
Its serving boundary in
[`package/ssg/aquati.cat/Caddyfile:2`](../../package/ssg/aquati.cat/Caddyfile)
is:

```caddyfile
# package/ssg/aquati.cat/Caddyfile:2
root * dist
try_files {path} {path}.html {path}/index.html
file_server
```

Publish the same release to a separate origin for CloudFront rather than retrieving it from Caddy.
A concrete AWS-native candidate is a private S3 bucket origin with origin access control (OAC).
[AWS documents][s3-oac] a bucket-policy distribution-ARN condition that scopes access,
and HTTPS origin requests with OAC's `always` signing setting.
The REST origin does not supply Caddy's `try_files` behavior;
key layout or edge rewriting would need validation.
The S3 website endpoint is a different mechanism:
[it does not support origin HTTPS][origin-https] and does not support OAC.

- Benefit:
  removes the CloudFront-to-Caddy handshake from the serving path;
  could keep the AWS copy available when the primary host fails.
  This design need not change the primary site's Caddy configuration or TLS policy.
- Cost:
  adds artifact publication,
  freshness monitoring,
  rollback,
  and serving-policy parity work.
  Shared source,
  build,
  DNS,
  and publication-credential dependencies need separate analysis;
  their isolation depends on the design.
- Verification before selection:
  prove self-contained assets and runtime requests,
  clean URLs,
  directory indexes,
  missing-file status,
  redirects,
  MIME types,
  compression,
  cache/security headers,
  complete-release publication,
  and continued serving without the primary origin.
  OAC's HTTPS guarantee alone is not evidence that every connection negotiated TLS 1.3.

This is the strongest omitted architectural direction for origin independence,
not a validated recommendation to adopt S3.
No bucket or distribution was created or modified.

#### Dedicated compatibility endpoint

A separate origin hostname or listener could isolate a TLS compatibility policy from the public apex.
The original document named this option;
issue #146's compressed choice set omitted it.

- Benefit:
  can leave the apex's TLS-1.3-only handshake unchanged and retain live content delivery.
- Cost:
  a TLS 1.2 leg still exists if that is the required compatibility concession;
  this fails a requirement forbidding TLS 1.2 everywhere.
  Another endpoint needs certificate,
  access-control,
  and routing verification.
  An AWS address allowlist alone does not authenticate this particular distribution.
- Status:
  not deployed or verified;
  no reason to build it before establishing the current failure's cause.

#### Chain CloudFront through Fastly

A candidate topology is `CloudFront -> Fastly -> Caddy`.
Fastly's viewer endpoint returning 200 does not prove CloudFront-origin compatibility.

- Benefit:
  reuses an existing delivery path without changing the primary origin's TLS policy.
- Cost:
  makes the AWS endpoint depend on Fastly,
  defeating independence from that CDN;
  adds cache,
  invalidation,
  Host/SNI,
  and incident-attribution interactions.
- Status:
  untested candidate,
  not a diversification recommendation.

#### Priority ranking

Investigate the existing path first,
then evaluate independent artifact replication.
Diagnosis precedes redesign because no protocol defect has been established;
replication follows because it addresses the shared-origin dependency diagnosis alone cannot remove.
These are complementary steps,
not exclusive choices.

For further evaluation toward restoring the AWS endpoint:
artifact replica > dedicated compatibility endpoint > CDN chaining.
Replication could also remove the live primary dependency;
a compatibility endpoint preserves it but avoids dependence on Fastly;
chaining adds that CDN dependency.
If independence from the primary origin is mandatory,
only replication among these candidates qualifies.
Under a strict prohibition on any TLS 1.2 leg,
a compatibility endpoint requiring that concession is excluded.
This is an investigation ranking,
not a validated deployment selection.

### Workaround verification status

None verified for this distribution in the reassessment.
The original heading incorrectly called unshipped configuration sketches verified workarounds.
The alternatives in "Omitted avenues and their tradeoffs" remain proposals.
Global TLS relaxation is outside issue #146's scope;
waiting remains an operational choice,
not a demonstrated technical remedy.

### Verification on 2026-09-07

Read-only probes ran from `/var/home/user/Monochromatic`.
CloudFront is an unversioned managed service;
the deployed Caddy version was not obtained.
DNS returned `135.181.104.96` and `2a01:4f9:c012:34ed::1`.
The commands without `-4` selected that IPv6 address.

Working catalog:

```bash
# Origin TLS 1.3 succeeds with aquati.cat SNI over both address families.
openssl s_client -connect aquati.cat:443 -servername aquati.cat -tls1_3 -brief </dev/null
openssl s_client -4 -connect aquati.cat:443 -servername aquati.cat -tls1_3 -brief </dev/null
# Protocol version: TLSv1.3
# Ciphersuite: TLS_AES_128_GCM_SHA256
# Verification: OK

curl --silent --show-error --head --connect-timeout 15 --max-time 30 https://fastly.aquati.cat/
# HTTP/2 200
# server: Caddy
```

Failing catalog,
separated by signal:

```bash
# Origin rejects TLS 1.2 over both address families.
openssl s_client -connect aquati.cat:443 -servername aquati.cat -tls1_2 -brief </dev/null
openssl s_client -4 -connect aquati.cat:443 -servername aquati.cat -tls1_2 -brief </dev/null
# tlsv1 alert protocol version; SSL alert number 70; exit 1

# Keeping IPv4 and TLS 1.3 unchanged, changing only SNI fails.
openssl s_client -4 -connect aquati.cat:443 -servername aws.aquati.cat -tls1_3 -brief </dev/null
openssl s_client -4 -connect aquati.cat:443 -servername dyfbcoafqtni3.cloudfront.net -tls1_3 -brief </dev/null
# tlsv1 alert internal error; SSL alert number 80; exit 1

curl --silent --show-error --head --connect-timeout 15 --max-time 30 https://aws.aquati.cat/
# HTTP/2 502
# x-cache: Error from cloudfront
# x-amz-cf-pop: LHR61-P6
```

The SNI positive control succeeds with `aquati.cat` and fails with the other names.
This proves name-sensitive behavior at this origin,
not that CloudFront sent either failing name.
A separate GET also returned the generic CloudFront 502 page.

Evidence acquisition limits:

- `aws cloudfront get-distribution-config --id EYK5GXXEGWEYZ` with a field-filtered query failed:
  `aws: [ERROR]: Your session has expired. Please reauthenticate using 'aws login'.`
  Exit status 255;
  `aws configure list-profiles` listed only `default`.
  No active distribution settings were inferred from this failure.
- A read-only SSH attempt to obtain Caddy journal entries used batch authentication and strict host-key checking.
  It failed with `Host key verification failed.` because no trusted ED25519 key was known for `aquati.cat`.
  Host verification was not bypassed;
  origin logs were not read.
- No production mutations,
  packet captures,
  candidate deployments,
  or builds were performed.

The original `update-distribution` verification example was removed:
it is a mutation API,
not a read-only capability probe.
Its historical rejection does not make future execution safe.

## Current configuration state

**Status**:
mirror returns HTTP 502 in the 2026-09-07 probes.
The current distribution settings and exact cause remain unconfirmed.
The configuration inventory records the original investigation,
not an authenticated current-state read.

Concrete identifiers recorded on 2026-05-09:

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
  The original investigation recorded `MalformedXML`;
  the current API reference still omits this value.
  This does not prove TLS 1.3 is absent from automatic negotiation (issue 7).
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
- **A viewer-certificate TLS policy as an origin fix**.
  Viewer and origin connections are separate boundaries.
  A historical provider issue about the viewer policy does not diagnose this origin failure.
- **Treating HTTP 502 or the API enum as rollout evidence**.
  Neither reveals the actual CloudFront ClientHello.
  The reassessment retracts the original conclusion that these observations established an unfinished rollout.

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

### Issue 7: upstream filing decision

The 2026-09-07 reassessment supersedes the original upstream attribution.

1. **Upstream's fault?**
   Unconfirmed;
   no correlated CloudFront-to-origin evidence distinguishes configuration from a service defect.
2. **Can upstream fix it?**
   Not assessed without an established defect;
   extending the API enum is not a proven requirement for automatic TLS 1.3.
3. **Supporting the use case?**
   Yes according to AWS's origin TLS 1.3 announcement.
4. **Would upstream welcome this contribution?**
   No contribution is proposed;
   contribution-policy auditing is deferred until there is additive defect evidence.
5. **Will upstream fix it?**
   No forecast:
   AWS describes support as already available.
   Search found the existing [AWS feature request][origin-feature-request]
   and [Caddy #7445][caddy-cloudfront-issue];
   the latter was read with all comments and describes a separate SNI incident.
6. **Minimal-fix prototype?**
   None:
   root cause is unconfirmed,
   so the auto-prototype gate is not met.

The `.out-of-scope/` file inventory contained no AWS or Caddy exemption.
No upstream issue or comment was filed or drafted:
there is no established upstream defect or additive fix to report.
The recommendation is further evidence collection,
not waiting for an inferred rollout.
No deployment decision was adopted.

## References

Sources for the reassessment were accessed on 2026-09-07.

[origin-tls-announcement]: https://aws.amazon.com/about-aws/whats-new/2025/11/amazon-cloudfront-tls13-origin/
[origin-protocol-api]: https://docs.aws.amazon.com/cloudfront/latest/APIReference/API_OriginSslProtocols.html
[origin-ciphers]: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/secure-connections-supported-ciphers-cloudfront-to-origin.html
[cloudfront-502]: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/http-502-bad-gateway.html
[caddy-cloudfront-issue]: https://github.com/caddyserver/caddy/issues/7445
[origin-request-policies]: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-managed-origin-request-policies.md
[s3-oac]: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.md
[origin-https]: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-https-cloudfront-to-custom-origin.html
[origin-feature-request]: https://repost.aws/questions/QUzNusy9axTz2iWIyfK1q-nw/feature-cloudfront-origin-tls-v1-3

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
