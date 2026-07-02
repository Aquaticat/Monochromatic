# Hetzner cloud firewall outbound-allowlist operational consequences

This file documents six independent operational consequences of
running with an outbound-allowlist firewall on Hetzner's cloud,
which was adopted after Hetzner flagged the server for port
scanning (caused by a Tor relay,
 since disabled).
 Each consequence
gets its own canonical section.
 The config lives in
`packages/config/tofu/hetzner.tf`.

The shape matches the rest of TROUBLESHOOTING.
* even though there
is no upstream defect:
 the audit trail justifies each rule and the
decision not to broaden the firewall.

---

## Bug 1: Tor onion service outbound; pool sizing for the dynamic top-N guard allowlist

### Symptom

A Tor v3 onion service deployed on the host must reach guards on
port 443.
 A static allowlist drifts from the consensus as relays
go down.
 A blanket "allow port 443 outbound" rule reintroduces
the exposure that motivated the firewall in the first place.

### Root cause

The Hetzner firewall has a 500-rule cap.
 The `tor_out_rules`
local in `hetzner.tf` builds an allowlist from a JSON file
written by `packages/config/tofu/src/fetch_tor_relays.ts`,
 which
fetches Onionoo's consensus top-N (limit=500) guards filtered to
ORPort 443.
 The pool lands at ~150 IPs (~90 v4 + ~60 v6 at
writing).
 Each IP is one effective firewall rule;
 the addition
lifts `tofu` from ~50 to ~200 effective rules,
 well under the
500-rule cap.

### Verification

```bash
# Refresh the cache (delete it, then re-run so the external data source refetches):
rm packages/config/tofu/src/cache_tor_relays.txt
tofu plan

# Count effective IPs (the cache is a comma-separated CIDR list, not JSON):
tr ',' '\n' < packages/config/tofu/src/cache_tor_relays.txt | grep -c .
```

The script caches Onionoo responses for one hour at
`packages/config/tofu/src/cache_tor_relays.txt`;
 delete to force a
fresh fetch.

### Verified workaround (the design itself)

- **Port 443 only**:
   keeps the per-IP-per-port effective-rule
  count predictable (one rule per IP regardless of how many
  ports a relay advertises) and consolidates with the existing
  port-443 outbound posture in `web_out`.
   A meaningful share of
  guards advertise ORPort 443 specifically because Tor docs
  recommend it for blending with HTTPS on hostile networks.
  Tradeoff:
   cuts the usable guard pool by ~half;
   if Tor cannot
  bootstrap,
   raise `limit=` (see remediation).

- **Dynamic top-N (not pinned EntryNodes)**:
   tracks consensus
  changes hourly and lets Tor pick its own three guards from the
  available set.
   Tradeoff:
   requires a working fetch path to
  Onionoo and the one-hour-refresh schedule;
   pinning is brittle
  but is the failover if Onionoo is unreachable.

### Pool-too-small remediation

If Tor fails to bootstrap (`/var/log/tor/log` stuck below
`Bootstrapped 100%`) or repeatedly cannot find a usable guard,
the 443-only filter has cut the pool too aggressively.
 Raise
`limit=` in `fetch_tor_relays.ts` (the URL constant) and re-run
`tofu apply`.
 Each additional 100 fetched relays adds ~30 to 40
surviving IPs (~30 to 40 effective rules);
 doubling to
`limit=1000` stays well under the 500-rule cap on `tofu`.

### Why this does not reproduce the prior /24 sweep

The original abuse report flagged sequential connections to
`a.b.c.1` through `a.b.c.255`,
 the relay-mode behaviour where
Tor extends circuits to many peers across a single subnet.
 For a
non-relay client (an onion service is a client to its three
guards),
 Tor's path-spec /16 subnet diversity rule guarantees
the selected guards land in different /16s;
 the outbound
footprint never shows sequential per-/24 connections.

### What does not work

- Static `EntryNodes` pinning:
   drifts from the network when
  relays go down;
   manual refresh required.
- Blanket "allow 443 outbound":
   defeats the purpose of the
  firewall (any compromised process on the host can phone home).
- Allowing all ORPorts:
   per-IP-per-port count explodes (many
  relays advertise multiple ORPort values),
   risking the 500-rule
  cap.

### Why we do not file this upstream

Hetzner's firewall product is doing exactly what it advertises;
the design constraints are ours.
 No upstream report.

---

## Bug 2: Outbound ICMP (ping) does not work

### Symptom

```bash
ping 1.1.1.1
# 100% packet loss
ping 172.31.1.1
# works (gateway sits inside Hetzner's local network segment)
```

### Root cause

The firewall has no outbound ICMP rule.
 ICMP is not in the
allowlist;
 all ICMP egress is dropped at the Hetzner perimeter.
Pings to the gateway succeed because that traffic stays inside
the local network segment,
 before the cloud firewall.

### Verified workaround

If outbound ICMP is needed for debugging,
 add an outbound ICMP
rule in `hetzner.tf`.
 Tradeoff:
 re-opens an egress vector;
 only
add temporarily and remove after the debugging session.

### What does not work

- Using `tcping` against a known-allowlisted destination
  (port 443 via TCP):
   works as a connectivity check but cannot
  diagnose ICMP-specific issues (path MTU,
   fragmentation).

### Why we do not file this upstream

By-design;
 Hetzner allows arbitrary protocols on firewall rules.
No upstream report.

---

## Bug 3: `apt-get update` fails inside Docker containers because Ubuntu sources default to HTTP

### Symptom

A fresh `ubuntu:latest` container on this host:

```bash
$ apt-get update
# Connection refused / timeout on port 80
```

### Root cause

Ubuntu's default sources use HTTP (port 80);
 the firewall only
allows outbound HTTPS (port 443) to whitelisted CDN IPs.

The Ubuntu ASN IPs **are** whitelisted on port 443.
 Port 80 is
allowed only for the Ubuntu ASN IPs (`hetzner.tf`
`ubuntu_http_out_rules`),
 but the base image's sources file
points to a mirror that may not match.

### Verified workaround

Install `ca-certificates` over HTTP first (port 80 is allowed
for Ubuntu ASN IPs),
 then switch sources to HTTPS for the
remaining packages:

```dockerfile
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/*
RUN sed -i 's|http://|https://|g' /etc/apt/sources.list.d/ubuntu.sources
RUN apt-get update \
 && apt-get install -y --no-install-recommends podman git unzip
```

The two-step approach is needed because HTTPS requires root CA
certs,
 which are not present in the base `ubuntu:latest` image.
Ubuntu 24.04+ has HTTPS support built into apt itself (no
`apt-transport-https` needed).
 The deb822-format sources file
lives at `/etc/apt/sources.list.d/ubuntu.sources` (not the legacy
`/etc/apt/sources.list`).

Tradeoff:
 doubles the apt step.
 Acceptable because the
ca-certificates install is small and only runs at image build
time.

### What does not work

- Pinning the base image to one that already includes
  `ca-certificates`:
   most slim base images strip it precisely
  because most users add it themselves;
   pinning a "fat" image
  trades clarity for size.
- Allowing port 80 outbound globally:
   contradicts the firewall's
  least-privilege posture.

### Why we do not file this upstream

Ubuntu's sources default is reasonable;
 the constraint is the
firewall's.
 No upstream report.

---

## Bug 4: Outbound connections to unlisted hosts fail

### Symptom

```bash
curl https://example.com
# Connection refused / timeout
```

### Root cause

Only hosts whose IPs appear in the CDN allowlist (`cdn_ips` and
related locals in `hetzner.tf`) can be reached on port 443.
 The
firewall is allowlist-only;
 everything else drops at the
perimeter.

Single-host service destinations are resolved from DNS names at plan
time by `resolve_hosts.ts` (driven by `local.resolvable_hostnames`),
which unions fresh DNS with `seed_resolved_hosts.json` and a local
accumulation cache so a moved host keeps its previously-seen IPs.
Published or broad ranges that do not map to one host (Anthropic,
Hetzner DNS,
 Syncthing/Oracle,
 Chrome) stay hardcoded as locals.

### Verified workaround

For a single-host service,
 add its hostname to
`local.resolvable_hostnames` in `hetzner.tf` and run `tofu apply`;
`resolve_hosts.ts` resolves it to `/32` and `/128` CIDRs and
accumulates them,
 so a later address change does not silently break
egress.
 For a destination that is a published or broad range rather
than one host,
 add the CIDRs to the relevant hardcoded local (or to
`seed_resolved_hosts.json` under the closest hostname).
 Tradeoff:
 new
destinations still require a deploy,
 not just a code change.

### What does not work

- Using a HTTP proxy that itself is allowlisted:
   the proxy is
  one allowed destination,
   but the proxy must terminate TLS and
  re-encrypt to the real destination;
   the firewall sees the
  proxy IP but allows it.
- Expecting hcloud to accept hostnames directly:
   Hetzner's firewall
  rules take IPs or CIDRs,
   not hostnames;
   `resolve_hosts.ts`
  bridges this by resolving names to CIDRs at plan time,
   but the rule
  itself still carries only the resolved CIDRs.

### Why we do not file this upstream

By-design firewall posture.
 No upstream report.

---

## Bug 5: DNS works only through Hetzner resolvers

### Symptom

```bash
dig @1.1.1.1 example.com
# timeout
dig @185.12.64.1 example.com
# works
```

### Root cause

The firewall restricts outbound DNS (UDP 53) to Hetzner's own IP
range (`185.12.64.0/24`).
 Other resolvers are blocked at the
perimeter.

### Verified workaround

Containers must use the host's DNS configuration (which points
to Hetzner resolvers) or explicitly set `dns: ["185.12.64.1",
"185.12.64.2"]` in their Docker/Compose config.
 Tradeoff:
 locks
DNS resolution to Hetzner's infrastructure;
 cannot use external
resolvers (Cloudflare,
 Google,
 Quad9).
 Acceptable for a hardened
host;
 documented for container authors who otherwise default to
public resolvers.

### What does not work

- DNS over HTTPS (DoH) to Cloudflare on port 443:
   would work in
  principle (port 443 is open to whitelisted CDNs) but
  Cloudflare's DoH endpoint may not be in the CDN allowlist;
  check `cdn_ips` first.
- DNS over TCP (port 53):
   same restriction applies.

### Why we do not file this upstream

By-design;
 the resolver choice is the operator's.
 No upstream
report.

---

## Bug 6: Hetzner Storage Box SMB needs outbound TCP 445 to changeable Storage Box IPs

### Symptom

Mounting a Hetzner Storage Box over SMB/CIFS from the host fails
while the outbound allowlist is active:

```bash
mount.cifs -o seal,user=<username>,pass=<password> //<username>.your-storagebox.de /mnt/my-storage-box
# timeout / connection refused on TCP 445
```

### Root cause

Hetzner's Storage Box docs say SMB/CIFS uses the
`<username>.your-storagebox.de` domain and that each Storage Box
comes with IPv4 and IPv6 addresses that can change.
 The hcloud
firewall provider's `hcloud_firewall` schema accepts `destination_ips`
as IPs or CIDRs,
 not hostnames,
 so `*.your-storagebox.de` cannot be
expressed directly in the firewall rule.

The implemented rule resolves configured concrete Storage Box hostnames
through `packages/config/tofu/src/resolve_storagebox_hosts.ts`,
 combines
them with optional explicit `storagebox_destination_ips`,
 summarizes
those CIDRs,
 chunks them,
 and adds outbound TCP 445 rules to
`hcloud_firewall.tofu` via `storagebox_smb_out_rules` in
`packages/config/tofu/hetzner.tf`.

### Verification

DNS checks confirmed the public domain shape and lack of wildcard DNS:

```bash
dig +short your-storagebox.de A
# 213.133.105.29
dig +short '*.your-storagebox.de' A
# no answer
dig +short u123456.your-storagebox.de A
# 91.98.246.177
```

ASN checks for observed Storage Box addresses resolved to Hetzner
Online,
 but the implementation does not allow all AS24940 ranges:

```bash
curl --silent --show-error --fail https://ipinfo.io/91.98.246.177/org
# AS24940 Hetzner Online GmbH
```

The resolver rejects wildcard input,
 returns an empty CIDR list for
an empty hostname list,
 and resolves a concrete hostname through DNS:

```bash
mise run //packages/config/tofu:test:storagebox-resolver
mise run //packages/config/tofu:test:storagebox-resolver:network u123456.your-storagebox.de
```

Configuration validation passes through the package task:

```bash
mise run //packages/config/tofu:lint
```

### Verified workaround (the design itself)

Resolve configured concrete Storage Box hostnames into `/32` and
`/128` CIDRs,
 optionally adding explicit CIDRs via
`storagebox_destination_ips`.
 Tradeoff:
 each Storage Box hostname must
be listed in local tfvars,
 because hcloud cannot express a DNS wildcard
and the public wildcard does not resolve.

### What does not work

- Putting `*.your-storagebox.de` directly in `destination_ips`:
   hcloud
  firewall rules require IPs or CIDRs.
- Pinning the current A/AAAA answer for one Storage Box hostname:
  Hetzner documents those addresses as changeable,
   so the rule would
  silently drift.
- Opening TCP 445 to all Hetzner Online AS24940 ranges:
   broader than
  Storage Boxes and unnecessary when the concrete hostname can be
  resolved.
- Opening TCP 445 globally:
   contradicts the outbound allowlist posture
  adopted after the original abuse report.

### Why we do not file this upstream

By-design product boundary.
 Hetzner's Storage Box domain is stable for
clients,
 and Hetzner Cloud firewalls intentionally operate on IP/CIDR
rules.
 No upstream report.

---

## Bug 7: Hetzner Cloud firewall rule distribution exceeds product limits

### Symptom

Applying the firewall can fail with both per-rule and per-firewall
Hetzner API errors:

```text
invalid input in fields 'rules[0].source_ips', 'rules[8].source_ips'
[value required to be smaller]

firewall limit exceeded
```

### Root cause

Hetzner's Cloud Firewall FAQ lists two relevant limits:
 at most five
active firewalls per server and at most 500 effective rules per
firewall.
 One inbound rule with many sources counts as many effective
rules.
 The hcloud client docs also state that `source_ips` and
`destination_ips` can specify 100 CIDRs at most per rule.

The previous layout kept large dynamic groups in descriptive firewalls.
A throwaway plan against an empty state measured this distribution:

```text
hcloud_firewall.tofu rules 23 effective 901 max_src 355 max_dst 20
hcloud_firewall.ubuntu_http rules 5 effective 84 max_src 0 max_dst 20
hcloud_firewall.web_out rules 54 effective 1014 max_src 0 max_dst 20
```

That violated both the 100-CIDR rule input cap and the 500-effective-rule
firewall cap.

The current design encodes the Hetzner limits directly in
`packages/config/tofu/hetzner.tf:443-448`:

```hcl
firewall_count              = 5
firewall_effective_limit    = 500
firewall_rule_ip_limit      = 100
firewall_rule_ip_chunk_size = 20
firewall_assignment_cycle   = local.firewall_count * 2
firewall_indexes            = range(local.firewall_count)
```

Inbound home ISP and SSH source ranges are chunked before rule emission
at `packages/config/tofu/hetzner.tf:561-571`:

```hcl
home_isp_ips_summarized = length(local.home_isp_ips) == 0 ? [] : (
  data.cidrblock_summarization.home_isp_ips.summarized_cidr_blocks
)
home_isp_ips_chunks = chunklist(local.home_isp_ips_summarized, local.firewall_rule_ip_chunk_size)
coolify_ips_summarized = length(local.coolify_ips) == 0 ? [] : (
  data.cidrblock_summarization.coolify_ips.summarized_cidr_blocks
)
ssh_source_ips_chunks = chunklist(
  concat(local.home_isp_ips_summarized, local.coolify_ips_summarized),
  local.firewall_rule_ip_chunk_size,
)
```

Moved blocks map the previous `main`,
 `web_out`,
 and `ubuntu_http`
firewalls into the first three generic firewalls,
 so applying the
migration updates existing state instead of deleting all old firewalls
before creating the balanced set.

All rule groups then feed one ordered list.
 The balancer computes each
rule's effective-rule cost,
 sorts heavier rules first,
 then assigns them
through a snake pattern across the five firewalls.
 The key sorting lives
at `packages/config/tofu/hetzner.tf:699-715`:

```hcl
weighted_firewall_rule_keys = sort([
  for rule_index, rule in local.all_firewall_rules : format(
    "%05d:%05d",
    local.firewall_rule_ip_limit - max(length(rule.source_ips), length(rule.destination_ips), 1),
    rule_index,
  )
])

weighted_firewall_rule_bucket_indexes = [
  for rule_index, rule in local.weighted_firewall_rules :
  rule_index % local.firewall_assignment_cycle < local.firewall_count
  ? rule_index % local.firewall_assignment_cycle
  : local.firewall_assignment_cycle - 1 - (rule_index % local.firewall_assignment_cycle)
]
```

The snake pattern sends sorted rules to firewalls in this repeating order:
`0, 1, 2, 3, 4, 4, 3, 2, 1, 0`.
 That keeps large 20-CIDR rules from
systematically accumulating on one firewall.

### Verification

A throwaway plan with a dummy 64-character hcloud token and empty state
now creates five generic firewalls.
 The plan JSON measured these counts:

```text
hcloud_firewall.tofu["0"] rules 23 effective 397 max_src 20 max_dst 20
hcloud_firewall.tofu["1"] rules 23 effective 400 max_src 20 max_dst 20
hcloud_firewall.tofu["2"] rules 23 effective 398 max_src 20 max_dst 20
hcloud_firewall.tofu["3"] rules 23 effective 400 max_src 20 max_dst 20
hcloud_firewall.tofu["4"] rules 24 effective 404 max_src 20 max_dst 20
```

Package validation also passes:

```bash
mise run //packages/config/tofu:lint
```

### Verified workaround (the design itself)

Use five generic firewalls named `tofu-0` through `tofu-4`,
 chunk every
large source or destination CIDR list to 20 entries per rule,
 and mix
all rule categories across the five firewalls.
 Tradeoff:
 firewall names
no longer describe a traffic class.
 All five firewalls must be applied
to the server because Hetzner combines their allow rules.
 Set
`firewall_server_ids` or `firewall_label_selectors` so OpenTofu manages
those attachments without using the Hetzner web UI.
 The attachment
resources are declared at `packages/config/tofu/hetzner.tf:768-774`.

### What does not work

- Keeping descriptive firewalls such as `main`,
   `web_out`,
   and
  `ubuntu_http`:
   the effective-rule counts are uneven and can exceed
  500 on one resource while others remain underused.
- Keeping home ISP sources in one `ping` or `ssh` rule:
   large summarized
  home ISP ranges can exceed the API's 100-CIDR per-rule input limit.
- Creating more than five server firewalls:
   Hetzner permits only five
  active firewalls per server.

### Why we do not file this upstream

By-design product limits.
 Hetzner documents the five-active-firewall
and 500-effective-rule caps,
 and the API rejects oversized source and
destination lists as documented.
 The consumer-side fix is to chunk and
balance rules before sending them to hcloud.

---

## Why we do not loosen the firewall

Each of the seven sections concludes with a small tradeoff
acceptable given the original abuse report.
 The blanket "open
ICMP / open all 443 / open all DNS / open all 445" alternative re-creates the
exposure that motivated the firewall.
 The audit trail above
explains each rule's purpose;
 future maintainers can update one
rule without reverting the posture.
