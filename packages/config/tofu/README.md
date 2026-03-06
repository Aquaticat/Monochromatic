# tofu - Hetzner Cloud firewall manager

OpenTofu configuration for managing Hetzner Cloud firewalls with dynamic IP range aggregation from multiple CDNs and services.

## Overview

Manages firewall rules on Hetzner Cloud, with support for:
- Dynamic IP range fetching from multiple sources (Cloudflare, CloudFront, Fastly, GitHub, YouTube, etc.)
- ASN-based IP lookups via ipinfo.io
- CIDR block summarization to reduce rule counts
- Home ISP ranges for ssh/ping access (supplied locally, never committed)

## Components

### `fetch_ips.ts`

TypeScript script that fetches and caches IP ranges for a specific ASN from ipinfo.io.
Features:
- Streaming JSON parsing with minimal memory usage
- 30-day cache for fetched data
- Graceful fallback to expired cache on failure

### `hetzner.tf`

Main Terraform configuration that:
- Fetches IP ranges from multiple CDN APIs (Cloudflare, CloudFront, Fastly, GitHub, Coolify, YouTube)
- Looks up ASNs (Ubuntu, home ISP) via external data source
- Aggregates and summarizes IP blocks to minimize firewall rules
- Creates Hetzner Cloud firewall resources

## Setup

1.  Copy `hetzner.auto.tfvars.example` to `hetzner.auto.tfvars` and fill in your tokens and home ISP ASN:

```hcl
hcloud_token  = "your_hetzner_api_token"
ipinfo_token  = "your_ipinfo_token"
home_isp_asns = { home = "AS12345" }
```

2.  Create `.env.local` with:

```bash
IPINFO_TOKEN=your_ipinfo_token
```

3.  Install dependencies:

```bash
pnpm install
```

4.  Initialize and apply:

```bash
terraform init
terraform plan
terraform apply
```

## Firewall rules

### Inbound

- HTTP (80) -- from all
- HTTPS TCP/UDP (443) -- from all
- SSH (22) -- from home ISP and Coolify IPs
- ICMP -- from home ISP IPs
- Syncthing (21027/22000/22067/22070) -- from all

### Outbound

- DHCP (67-68)
- DNS to Hetzner (53)
- HTTPS TCP/UDP to CDN IPs (chunked to respect rule limits)

## IP sources

The configuration aggregates IPs from:
- Cloudflare (via API)
- CloudFront (via AWS API)
- Fastly (via API)
- GitHub (via meta API)
- Ubuntu (ASN AS41231)
- YouTube (via GitHub repo)
- Coolify (via API)
- Various static IPs (LetsEncrypt, pCloud, Linkup, Resend, OpenRouter, etc.)

## Local-only files

The following are gitignored and must be created manually:
- `*.auto.tfvars` -- API tokens and home ISP ASN
- `.env.local` -- ipinfo token for fetch_ips.ts
- `cache_*.json` -- ASN lookup caches
- `terraform.tfstate*` -- Terraform state
