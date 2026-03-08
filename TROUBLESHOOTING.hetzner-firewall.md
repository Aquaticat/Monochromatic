# Hetzner firewall troubleshooting

## Background

The Hetzner cloud firewall (`packages/config/tofu/hetzner.tf`) uses an allowlist model
for outbound traffic.
This was added after Hetzner flagged the server for port scanning
(caused by a Tor relay, since disabled).

## Outbound ICMP (ping) does not work

The firewall has no outbound ICMP rule.
Pinging external IPs like `1.1.1.1` will show 100% packet loss.
Pinging the gateway (`172.31.1.1`) still works because it sits inside Hetzner's local network
segment, before the cloud firewall.

This is intentional -- add an outbound ICMP rule in `hetzner.tf` if ping is needed for debugging.

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
