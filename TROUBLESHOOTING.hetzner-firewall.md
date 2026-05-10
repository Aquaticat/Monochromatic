# Hetzner firewall troubleshooting

## Background

The Hetzner cloud firewall (`packages/config/tofu/hetzner.tf`) uses an allowlist model
for outbound traffic.
This was added after Hetzner flagged the server for port scanning
(caused by a Tor relay, since disabled).

## Tor onion service outbound

The `tofu` (main) firewall has a dynamic outbound rule block that allows port 443 TCP
to a hourly-refreshed allowlist of top Tor guards (see
`packages/config/tofu/fetch_tor_relays.ts` and the `tor_out_rules` local in
`hetzner.tf`).
This is the firewall side of the v3 onion service deployment.

The pool size at `limit=500` consensus-weight-ordered guards filtered to ORPort 443
lands at ~150 IPs (roughly 90 v4 + 60 v6 at the time of writing).
Each IP costs one effective firewall rule, so the addition lifts `tofu` from
~50 to ~200 effective rules and stays under the 500-per-firewall cap.

### Why port 443 only

Single port keeps the per-IP-per-port effective-rule count predictable
(one rule per IP regardless of how many ports a relay also advertises) and
consolidates with the existing port-443 outbound posture in `web_out`.
A meaningful share of guards advertise ORPort 443 specifically because Tor docs
recommend it for blending with HTTPS on hostile networks.

### Why not pin EntryNodes

Pinning is brittle: relays go down, and a static entry list drifts from the
network until manually refreshed.
A 1-hour-refresh top-N allowlist tracks consensus-weight changes and lets Tor
pick its own three guards from the available set.

### Why this does not reproduce the prior /24 sweep

The original abuse report flagged sequential connections to `a.b.c.1` to `a.b.c.255`,
which is the relay-mode behaviour where Tor extends circuits to many peers across
a single subnet.
For a non-relay client (an onion service is a client to its three guards),
Tor's path-spec /16 subnet diversity rule guarantees the selected guards land
in different /16s, so the outbound footprint never shows sequential per-/24
connections.

### Pool-too-small remediation

If Tor fails to bootstrap (`/var/log/tor/log` stuck below `Bootstrapped 100%`)
or repeatedly cannot find a usable guard, the 443-only filter has cut the pool
too aggressively for the current network state.
Raise `limit=` in `fetch_tor_relays.ts` (the URL constant) and re-run
`tofu apply`.
Each additional 100 fetched relays adds roughly 30 to 40 surviving IPs (~30 to
40 effective rules), so doubling to `limit=1000` stays well under the 500-rule
cap on `tofu`.

### Cache invalidation

The script caches Onionoo responses for one hour at
`packages/config/tofu/cache_tor_relays.json`.
Delete the file to force a fresh fetch on the next `tofu plan` or `tofu apply`.

## Outbound ICMP (ping) does not work

The firewall has no outbound ICMP rule.
Pinging external IPs like `1.1.1.1` will show 100% packet loss.
Pinging the gateway (`172.31.1.1`) still works because it sits inside Hetzner's local network
segment, before the cloud firewall.

This is intentional; add an outbound ICMP rule in `hetzner.tf` if ping is needed for debugging.

## apt fails inside Docker containers

`apt-get update` fails because Ubuntu's default sources use HTTP (port 80),
and the firewall only allows outbound HTTPS (port 443) to whitelisted CDN IPs.

The Ubuntu ASN IPs **are** whitelisted, but only on port 443.
Port 80 is commented out in the `web_out` list in `hetzner.tf`.

Fix: install `ca-certificates` over HTTP first (port 80 is allowed for Ubuntu ASN IPs),
then switch sources to HTTPS for the remaining packages:

```dockerfile
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/*
RUN sed -i 's|http://|https://|g' /etc/apt/sources.list.d/ubuntu.sources
RUN apt-get update \
 && apt-get install -y --no-install-recommends podman git unzip
```

The two-step approach is needed because HTTPS requires root CA certs,
which aren't present in the base `ubuntu:latest` image.
Ubuntu 24.04+ has HTTPS support built into apt itself (no `apt-transport-https` needed).
The deb822-format sources file lives at `/etc/apt/sources.list.d/ubuntu.sources`
(not the legacy `/etc/apt/sources.list`).

The firewall allows port 80 outbound only for Ubuntu ASN IPs (`hetzner.tf` `ubuntu_http_out_rules`).

## Outbound connections fail to unlisted hosts

Only hosts whose IPs appear in the CDN allowlist (`cdn_ips` and related locals in `hetzner.tf`)
can be reached on port 443.
To allow a new service, add its IPs to the appropriate list and run `tofu apply`.

## DNS only works through Hetzner resolvers

The firewall restricts outbound DNS (UDP 53) to Hetzner's own IP range (`185.12.64.0/24`).
Containers must use the host's DNS configuration (which points to Hetzner resolvers)
or explicitly set `dns: ["185.12.64.1", "185.12.64.2"]` in their Docker/Compose config.
