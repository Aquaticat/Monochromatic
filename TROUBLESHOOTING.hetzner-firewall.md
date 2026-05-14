# Hetzner cloud firewall outbound-allowlist breaks Tor onion, ICMP, apt-over-HTTP, unlisted-host fetch, and non-Hetzner DNS

This file documents five independent operational consequences of
running with an outbound-allowlist firewall on Hetzner's cloud,
which was adopted after Hetzner flagged the server for port
scanning (caused by a Tor relay, since disabled). Each consequence
gets its own canonical section. The config lives in
`packages/config/tofu/hetzner.tf`.

The shape matches the rest of TROUBLESHOOTING.* even though there
is no upstream defect: the audit trail justifies each rule and the
decision not to broaden the firewall.

---

## Bug 1: Tor onion service outbound — pool sizing for the dynamic top-N guard allowlist

### Symptom

A Tor v3 onion service deployed on the host must reach guards on
port 443. A static allowlist drifts from the consensus as relays
go down. A blanket "allow port 443 outbound" rule reintroduces
the exposure that motivated the firewall in the first place.

### Root cause

The Hetzner firewall has a 500-rule cap. The `tor_out_rules`
local in `hetzner.tf` builds an allowlist from a JSON file
written by `packages/config/tofu/fetch_tor_relays.ts`, which
fetches Onionoo's consensus top-N (limit=500) guards filtered to
ORPort 443. The pool lands at ~150 IPs (~90 v4 + ~60 v6 at
writing). Each IP is one effective firewall rule; the addition
lifts `tofu` from ~50 to ~200 effective rules, well under the
500-rule cap.

### Verification

```bash
# Refresh the cache:
rm packages/config/tofu/cache_tor_relays.json
tofu plan -target=local_file.tor_relays_cache

# Count effective IPs:
jq 'length' packages/config/tofu/cache_tor_relays.json
```

The script caches Onionoo responses for one hour at
`packages/config/tofu/cache_tor_relays.json`; delete to force a
fresh fetch.

### Verified workaround (the design itself)

- **Port 443 only**: keeps the per-IP-per-port effective-rule
  count predictable (one rule per IP regardless of how many
  ports a relay advertises) and consolidates with the existing
  port-443 outbound posture in `web_out`. A meaningful share of
  guards advertise ORPort 443 specifically because Tor docs
  recommend it for blending with HTTPS on hostile networks.
  Tradeoff: cuts the usable guard pool by ~half; if Tor cannot
  bootstrap, raise `limit=` (see remediation).

- **Dynamic top-N (not pinned EntryNodes)**: tracks consensus
  changes hourly and lets Tor pick its own three guards from the
  available set. Tradeoff: requires a working fetch path to
  Onionoo and the one-hour-refresh schedule; pinning is brittle
  but is the failover if Onionoo is unreachable.

### Pool-too-small remediation

If Tor fails to bootstrap (`/var/log/tor/log` stuck below
`Bootstrapped 100%`) or repeatedly cannot find a usable guard,
the 443-only filter has cut the pool too aggressively. Raise
`limit=` in `fetch_tor_relays.ts` (the URL constant) and re-run
`tofu apply`. Each additional 100 fetched relays adds ~30 to 40
surviving IPs (~30 to 40 effective rules); doubling to
`limit=1000` stays well under the 500-rule cap on `tofu`.

### Why this does not reproduce the prior /24 sweep

The original abuse report flagged sequential connections to
`a.b.c.1` through `a.b.c.255`, the relay-mode behaviour where
Tor extends circuits to many peers across a single subnet. For a
non-relay client (an onion service is a client to its three
guards), Tor's path-spec /16 subnet diversity rule guarantees
the selected guards land in different /16s; the outbound
footprint never shows sequential per-/24 connections.

### What does not work

- Static `EntryNodes` pinning: drifts from the network when
  relays go down; manual refresh required.
- Blanket "allow 443 outbound": defeats the purpose of the
  firewall (any compromised process on the host can phone home).
- Allowing all ORPorts: per-IP-per-port count explodes (many
  relays advertise multiple ORPort values), risking the 500-rule
  cap.

### Why we do not file this upstream

Hetzner's firewall product is doing exactly what it advertises;
the design constraints are ours. No upstream report.

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

The firewall has no outbound ICMP rule. ICMP is not in the
allowlist; all ICMP egress is dropped at the Hetzner perimeter.
Pings to the gateway succeed because that traffic stays inside
the local network segment, before the cloud firewall.

### Verified workaround

If outbound ICMP is needed for debugging, add an outbound ICMP
rule in `hetzner.tf`. Tradeoff: re-opens an egress vector; only
add temporarily and remove after the debugging session.

### What does not work

- Using `tcping` against a known-allowlisted destination
  (port 443 via TCP): works as a connectivity check but cannot
  diagnose ICMP-specific issues (path MTU, fragmentation).

### Why we do not file this upstream

By-design; Hetzner allows arbitrary protocols on firewall rules.
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

Ubuntu's default sources use HTTP (port 80); the firewall only
allows outbound HTTPS (port 443) to whitelisted CDN IPs.

The Ubuntu ASN IPs **are** whitelisted on port 443. Port 80 is
allowed only for the Ubuntu ASN IPs (`hetzner.tf`
`ubuntu_http_out_rules`), but the base image's sources file
points to a mirror that may not match.

### Verified workaround

Install `ca-certificates` over HTTP first (port 80 is allowed
for Ubuntu ASN IPs), then switch sources to HTTPS for the
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
certs, which are not present in the base `ubuntu:latest` image.
Ubuntu 24.04+ has HTTPS support built into apt itself (no
`apt-transport-https` needed). The deb822-format sources file
lives at `/etc/apt/sources.list.d/ubuntu.sources` (not the legacy
`/etc/apt/sources.list`).

Tradeoff: doubles the apt step. Acceptable because the
ca-certificates install is small and only runs at image build
time.

### What does not work

- Pinning the base image to one that already includes
  `ca-certificates`: most slim base images strip it precisely
  because most users add it themselves; pinning a "fat" image
  trades clarity for size.
- Allowing port 80 outbound globally: contradicts the firewall's
  least-privilege posture.

### Why we do not file this upstream

Ubuntu's sources default is reasonable; the constraint is the
firewall's. No upstream report.

---

## Bug 4: Outbound connections to unlisted hosts fail

### Symptom

```bash
curl https://example.com
# Connection refused / timeout
```

### Root cause

Only hosts whose IPs appear in the CDN allowlist (`cdn_ips` and
related locals in `hetzner.tf`) can be reached on port 443. The
firewall is allowlist-only; everything else drops at the
perimeter.

### Verified workaround

Add the destination's IPs to the appropriate list and run `tofu
apply`. Tradeoff: per-IP allowlisting; new destinations require
a deploy, not just a code change.

### What does not work

- Using a HTTP proxy that itself is allowlisted: the proxy is
  one allowed destination, but the proxy must terminate TLS and
  re-encrypt to the real destination; the firewall sees the
  proxy IP but allows it.
- Putting hostnames in the firewall config: Hetzner's firewall
  rules take IPs, not hostnames.

### Why we do not file this upstream

By-design firewall posture. No upstream report.

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
range (`185.12.64.0/24`). Other resolvers are blocked at the
perimeter.

### Verified workaround

Containers must use the host's DNS configuration (which points
to Hetzner resolvers) or explicitly set `dns: ["185.12.64.1",
"185.12.64.2"]` in their Docker/Compose config. Tradeoff: locks
DNS resolution to Hetzner's infrastructure; cannot use external
resolvers (Cloudflare, Google, Quad9). Acceptable for a hardened
host; documented for container authors who otherwise default to
public resolvers.

### What does not work

- DNS over HTTPS (DoH) to Cloudflare on port 443: would work in
  principle (port 443 is open to whitelisted CDNs) but
  Cloudflare's DoH endpoint may not be in the CDN allowlist;
  check `cdn_ips` first.
- DNS over TCP (port 53): same restriction applies.

### Why we do not file this upstream

By-design; the resolver choice is the operator's. No upstream
report.

---

## Why we do not loosen the firewall

Each of the five sections concludes with a small tradeoff
acceptable given the original abuse report. The blanket "open
ICMP / open all 443 / open all DNS" alternative re-creates the
exposure that motivated the firewall. The audit trail above
explains each rule's purpose; future maintainers can update one
rule without reverting the posture.
