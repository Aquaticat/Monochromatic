terraform {
  required_providers {
    hcloud = {
      source  = "hetznercloud/hcloud"
      version = "~> 1.45"
    }
    http = {
      source  = "hashicorp/http"
      version = "~> 3.5"
    }
    external = {
      source  = "hashicorp/external"
      version = "~> 2.3"
    }
    cidrblock = {
      source  = "amilevskiy/cidrblock"
      version = "~> 0.0.23"
    }
  }
}

moved {
  from = hcloud_firewall.tofu
  to   = hcloud_firewall.tofu["0"]
}

moved {
  from = hcloud_firewall.web_out
  to   = hcloud_firewall.tofu["1"]
}

moved {
  from = hcloud_firewall.ubuntu_http
  to   = hcloud_firewall.tofu["2"]
}

variable "hcloud_token" {
  sensitive = true
}

variable "ipinfo_token" {
  sensitive = true
}

variable "home_isp_asns" {
  type        = map(string)
  default     = {}
  description = "ASN map for home ISP ranges used in ssh/ping rules. Supply via *.auto.tfvars."
}

variable "storagebox_hostnames" {
  type        = list(string)
  default     = []
  description = "Concrete Hetzner Storage Box hostnames under your-storagebox.de to resolve for SMB/CIFS egress."
}

variable "storagebox_destination_ips" {
  type        = list(string)
  default     = []
  description = "Optional Hetzner Storage Box destination CIDRs for SMB/CIFS egress when DNS resolution is not desired."
}

variable "firewall_server_ids" {
  type        = list(number)
  default     = []
  description = "Hetzner Cloud server IDs that should receive every generated firewall."
}

variable "firewall_label_selectors" {
  type        = list(string)
  default     = []
  description = "Hetzner Cloud server label selectors that should receive every generated firewall."
}

variable "target_asns" {
  type = map(string)
  default = {
    ubuntu = "AS41231"
  }
}

provider "hcloud" {
  token = var.hcloud_token
}

locals {
  # Merge public ASNs with locally-supplied home ISP ASNs
  all_asns = merge(var.target_asns, var.home_isp_asns)
}

data "external" "asn_data" {
  for_each = local.all_asns
  program  = ["bun", "run", "${path.module}/src/fetch_ips.ts"]

  query = {
    asn = each.value
  }
}

data "external" "tor_relays" {
  program = ["bun", "run", "${path.module}/src/fetch_tor_relays.ts"]
  query   = {}
}

data "external" "storagebox_ips" {
  count   = length(var.storagebox_hostnames) == 0 ? 0 : 1
  program = ["bun", "run", "${path.module}/src/resolve_storagebox_hosts.ts"]

  query = {
    hostnames = join(",", var.storagebox_hostnames)
  }
}

locals {
  # Single-host service egress destinations, resolved from DNS names by
  # resolve_hosts.ts instead of being pinned as hardcoded CIDRs. Each comment
  # names the service; resolve_hosts.ts unions fresh DNS with seed_resolved_hosts.json
  # and the local accumulation cache so a moved host never silently loses egress.
  # Published/broad ranges that do not map to one host (anthropic, hetzner DNS,
  # syncthing/Oracle, chrome) stay hardcoded below.
  resolvable_hostnames = [
    # Design Systems News
    "designsystems.news",
    # HN RSS
    "hnrss.org",
    # Almost Secure (palant.info)
    "palant.info",
    # Wattenberger
    "wattenberger.com",
    # LetsEncrypt
    "acme-v02.api.letsencrypt.org",
    "letsencrypt.org",
    # pCloud
    "api.pcloud.com",
    "eapi.pcloud.com",
    # Linkup
    "linkup.so",
    "api.linkup.so",
    # Resend
    "resend.com",
    "api.resend.com",
    # OpenRouter
    "openrouter.ai",
    # Distrowatch
    "distrowatch.com",
    # Leaf And Core
    "leafandcore.com",
    # Lobsters
    "lobste.rs",
    # Scott Hanselman's blog
    "hanselman.com",
    # HTTP Toolkit
    "httptoolkit.com",
    # Pencil And Paper
    "pencilandpaper.io",
    # Set Studio
    "set.studio",
    # ntietz blog
    "ntietz.com",
    # Luna's Blog
    "moonbase.lgbt",
    # Linux Servers Containers
    "lscr.io",
    # Synthetic
    "synthetic.new",
    "api.synthetic.new",
    # nginx.org (also reached on port 80 via package_repo_http_ips)
    "nginx.org",
    # archive.ubuntu.com (443 CDN path plus port 80 via package_repo_http_ips)
    "archive.ubuntu.com",
    # Nextcloud
    "nextcloud.com",
    "updates.nextcloud.com",
    "connectivity.nextcloud.com",
    "apps.nextcloud.com",
    "ltd1.nextcloud.com",
    "ltd2.nextcloud.com",
    "ltd3.nextcloud.com",
    "garm1.nextcloud.com",
    "garm2.nextcloud.com",
    "garm3.nextcloud.com",
    "garm4.nextcloud.com",
    "garm5.nextcloud.com",
    "push-notifications.nextcloud.com",
    # Personal blogs and sites read by the server
    # Adactio (Jeremy Keith)
    "adactio.com",
    # Adam Argyle
    "nerdy.dev",
    # Ana Rodrigues
    "ohhelloana.blog",
    # Andre Garzia
    "andregarzia.com",
    # Andrew Betts (triblondon)
    "trib.tv",
    # Anna Monus (Annalytic)
    "annalytic.com",
    # Baldur Bjarnason
    "baldurbjarnason.com",
    # Ben Terrett
    "benterrett.com",
    # Bruce Lawson
    "brucelawson.co.uk",
    # Cassie Evans
    "cassie.codes",
    # Temani Afif (CSS Tip)
    "css-tip.com",
    # Dan Appelquist (Torgo)
    "torgo.com",
    # datagubbe
    "datagubbe.se",
    # David Baron
    "dbaron.org",
    # Drew DeVault
    "drewdevault.com",
    # Emery Berger
    "emeryberger.com",
    # Eric Meyer
    "meyerweb.com",
    # Eric W. Bailey
    "ericwbailey.website",
    # Erwin Hoffmann
    "fehcom.de",
    # Evan Martin
    "neugierig.org",
    # Henry Desroches (Henry From Online)
    "henry.codes",
    # Jecelyn Yeen
    "jec.fyi",
    # Julia Galef
    "juliagalef.com",
    # Karolina Szczur
    "karolina.fish",
    # HTMLHell (Manuel Matuzovic)
    "htmlhell.dev",
    # Manuel Matuzovic
    "matuzo.at",
    # Marvin Hagemeister
    "marvinh.dev",
    # Matthew Somerville (dracos)
    "dracos.co.uk",
    # Max Firtman
    "firt.dev",
    # Mayank
    "mayank.co",
    # Philip Tellis
    "bluesmoon.info",
    # Rick Viscomi
    "rviscomi.dev",
    # Roderick Gadellaa
    "gadellaa.com",
    # Sam Rose (samwho)
    "samwho.dev",
    # Sophie Koonin (localghost)
    "localghost.dev",
    # Stuart Langridge (kryogenix)
    "kryogenix.org",
    # Tess O'Connor
    "tess.oconnor.cx",
    # The Bias
    "thebias.com",
    # The Technium (Kevin Kelly)
    "kk.org",
    # Thomas Steiner (tomayac)
    "blog.tomayac.com",
    # Timo Tijhof
    "timotijhof.net",
    # Tom Loosemore (Tomski)
    "blog.tomski.com",
    # GrapheneOS changelog
    "grapheneos.org",
    # Hacker News
    "news.ycombinator.com",
    # Joe Liccini (webperf.tips)
    "webperf.tips",
    # Microsoft Edge Blog
    "blogs.windows.com",
    # Nolan Lawson (Read the Tea Leaves)
    "nolanlawson.com",
    # Open Web Advocacy
    "open-web-advocacy.org",
    # Patrick Brosset
    "patrickbrosset.com",
    # Piccalilli
    "piccalil.li",
  ]
}

data "external" "resolved_hosts" {
  program = ["bun", "run", "${path.module}/src/resolve_hosts.ts"]

  query = {
    hostnames = join(",", local.resolvable_hostnames)
  }
}

data "http" "cloudflare_ips" {
  url = "https://api.cloudflare.com/client/v4/ips"
}

data "http" "cloudfront_ips" {
  url = "https://d7uri8nf7uskq.cloudfront.net/tools/list-cloudfront-ips"
}

data "http" "fastly_ips" {
  url = "https://api.fastly.com/public-ip-list"
}

data "http" "github_ips" {
  url = "https://api.github.com/meta"
}

data "http" "coolify_ipv4" {
  url = "https://coolify.io/ipv4.txt"
}

data "http" "coolify_ipv6" {
  url = "https://coolify.io/ipv6.txt"
}

data "http" "youtube_ipv4" {
  url = "https://raw.githubusercontent.com/touhidurrr/iplist-youtube/main/lists/cidr4.txt"
}

data "http" "youtube_ipv6" {
  url = "https://raw.githubusercontent.com/touhidurrr/iplist-youtube/main/lists/cidr6.txt"
}

locals {
  cloudflare_ips_raw_data = jsondecode(data.http.cloudflare_ips.response_body)

  cloudflare_ips_unsanitized = concat(
    local.cloudflare_ips_raw_data.result.ipv4_cidrs,
    local.cloudflare_ips_raw_data.result.ipv6_cidrs
  )
  cloudflare_ips = [
    for ip in local.cloudflare_ips_unsanitized : ip
    if can(cidrhost(ip, 0))
  ]

  cloudfront_ips_raw_data = jsondecode(data.http.cloudfront_ips.response_body)

  cloudfront_ips_unsanitized = concat(
    local.cloudfront_ips_raw_data.CLOUDFRONT_GLOBAL_IP_LIST,
  local.cloudfront_ips_raw_data.CLOUDFRONT_REGIONAL_EDGE_IP_LIST)

  cloudfront_ips = [
    for ip in local.cloudfront_ips_unsanitized : ip
    if can(cidrhost(ip, 0))
  ]

  fastly_ips_raw_data = jsondecode(data.http.fastly_ips.response_body)

  fastly_ips_unsanitized = concat(
    local.fastly_ips_raw_data.addresses,
  local.fastly_ips_raw_data.ipv6_addresses)

  fastly_ips = [
    for ip in local.fastly_ips_unsanitized : ip
    if can(cidrhost(ip, 0))
  ]

  github_ips_raw_data = jsondecode(data.http.github_ips.response_body)

  github_ips_unsanitized = concat(
    local.github_ips_raw_data.hooks,
    local.github_ips_raw_data.web,
    local.github_ips_raw_data.api,
    local.github_ips_raw_data.git,
    local.github_ips_raw_data.packages,
    local.github_ips_raw_data.importer,
  local.github_ips_raw_data.actions)

  github_ips = [
    for ip in local.github_ips_unsanitized : ip
    if can(cidrhost(ip, 0))
  ]


  all_asn_ips = {
    for name, data in data.external.asn_data :
    name => split(",", data.result.ips)
  }

  ubuntu_ips = [
    for ip in local.all_asn_ips["ubuntu"] : ip
    if can(cidrhost(ip, 0))
  ]

  # CIDRs resolved from service hostnames by resolve_hosts.ts, keyed by hostname.
  resolved_hosts_result = data.external.resolved_hosts.result

  # archive.ubuntu.com resolves through Cloudflare, not Ubuntu's AS41231.
  # Fresh containers can need port 80 before HTTPS certificates exist.
  archive_ubuntu_ips = [
    for ip in split(",", lookup(local.resolved_hosts_result, "archive.ubuntu.com", "")) : ip
    if ip != "" && can(cidrhost(ip, 0))
  ]

  # nginx.org publishes Linux packages under /packages/ and supports HTTP and HTTPS.
  nginx_org_ips = [
    for ip in split(",", lookup(local.resolved_hosts_result, "nginx.org", "")) : ip
    if ip != "" && can(cidrhost(ip, 0))
  ]

  package_repo_http_ips = distinct(concat(
    local.ubuntu_ips,
    local.archive_ubuntu_ips,
    local.nginx_org_ips,
  ))

  storagebox_dns_ips = length(var.storagebox_hostnames) == 0 ? [] : [
    for ip in split(",", data.external.storagebox_ips[0].result.ips) : ip
    if ip != "" && can(cidrhost(ip, 0))
  ]

  # Hetzner Storage Box hostnames live under <username>.your-storagebox.de.
  # Hetzner documents those host IPs as changeable, while Hetzner Cloud firewall
  # rules accept only CIDRs, so concrete hostnames are resolved into CIDRs here.
  storagebox_destination_ips = [
    for ip in concat(var.storagebox_destination_ips, local.storagebox_dns_ips) : ip
    if can(cidrhost(ip, 0))
  ]

  package_repo_http_ips_v4        = [for ip in local.package_repo_http_ips : ip if !strcontains(ip, ":")]
  package_repo_http_ips_v6        = [for ip in local.package_repo_http_ips : ip if strcontains(ip, ":")]
  package_repo_http_ips_v4_chunks = chunklist(local.package_repo_http_ips_v4, 20)
  package_repo_http_ips_v6_chunks = chunklist(local.package_repo_http_ips_v6, 20)

  youtube_ips_unsanitized = concat(
    [for s in split("\n", trimspace(data.http.youtube_ipv4.response_body)) : s if s != ""],
    [for s in split("\n", trimspace(data.http.youtube_ipv6.response_body)) : s if s != ""]
  )

  youtube_ips = [
    for ip in local.youtube_ips_unsanitized : ip
    if can(cidrhost(ip, 0))
  ]

  # Flatten all home ISP ASN IPs into a single list
  home_isp_ips = flatten([
    for name, ips in local.all_asn_ips :
    [for ip in ips : ip if can(cidrhost(ip, 0))]
    if contains(keys(var.home_isp_asns), name)
  ])

  # Anthropic https://platform.claude.com/docs/en/api/ip-addresses
  anthropic_ips = ["160.79.104.0/23", "2607:6bc0::/48"]

  # Chrome
  chrome_ips = ["142.250.139.0/24", "2607:f8b0:4023:1804::/64"]

  hetzner_ips = ["185.12.64.0/24", "2a01:4ff:ff00::/64"]

  syncthing_apt_ips = [
    "141.144.200.0/21", # Oracle Cloud London (where the .net nodes live)
    "193.122.0.0/17",   # Oracle Cloud Global range often used for their nodes
    "2603:c022::/32"    # Syncthing IPv6 Range
  ]

  # Single-host service CIDRs resolved from DNS names (see local.resolvable_hostnames).
  # Every resolved host is allowed on the 443 CDN path; archive.ubuntu.com is
  # additionally allowed on port 80 via package_repo_http_ips.
  resolved_cdn_ips = [
    for ip in flatten([
      for host, csv in local.resolved_hosts_result : split(",", csv)
    ]) : ip
    if ip != "" && can(cidrhost(ip, 0))
  ]

  small_cdn_ips = concat(
    local.hetzner_ips,
    local.syncthing_apt_ips,
    local.anthropic_ips,
    local.chrome_ips,
    local.resolved_cdn_ips,
  )

  small_cdn_ips_v4 = [for p in local.small_cdn_ips : p if !strcontains(p, ":")]
  small_cdn_ips_v6 = [for p in local.small_cdn_ips : p if strcontains(p, ":")]

  cdn_ips = concat(
    local.cloudflare_ips,
    local.cloudfront_ips,
    local.fastly_ips,
    local.github_ips,
    local.ubuntu_ips,
    local.youtube_ips,
  local.small_cdn_ips)

  coolify_ips_unsanitized = concat(
    [for s in split("\n", trimspace(data.http.coolify_ipv4.response_body)) :
      format("%s/32", s) if s != "" && !strcontains(s, "/")
    ],
    [for s in split("\n", trimspace(data.http.coolify_ipv6.response_body)) : s if s != ""]
  )

  coolify_ips = [
    for ip in local.coolify_ips_unsanitized : ip
    if can(cidrhost(ip, 0))
  ]

  tor_relay_ips = [
    for ip in split(",", data.external.tor_relays.result.ips) : ip
    if ip != "" && can(cidrhost(ip, 0))
  ]
  tor_relay_ips_v4    = [for ip in local.tor_relay_ips : ip if !strcontains(ip, ":")]
  tor_relay_ips_v6    = [for ip in local.tor_relay_ips : ip if strcontains(ip, ":")]
  tor_relay_v4_chunks = chunklist(local.tor_relay_ips_v4, 20)
  tor_relay_v6_chunks = chunklist(local.tor_relay_ips_v6, 20)

  tor_out_rules = flatten(concat(
    [for i, chunk in local.tor_relay_v4_chunks : {
      desc  = "tor v4 chunk ${i}"
      port  = "443"
      proto = "tcp"
      ips   = chunk
    }],
    [for i, chunk in local.tor_relay_v6_chunks : {
      desc  = "tor v6 chunk ${i}"
      port  = "443"
      proto = "tcp"
      ips   = chunk
    }]
  ))
}

check "ip_syntax_validation" {
  assert {
    condition = alltrue([
      for ip in concat(
        local.cdn_ips,
        local.package_repo_http_ips,
        local.hetzner_ips,
        local.coolify_ips,
        local.tor_relay_ips,
        local.storagebox_destination_ips,
      ) : can(cidrhost(ip, 0))
    ])
    error_message = "Typo detected in your local IP list!"
  }
}

data "cidrblock_summarization" "cloudflare_ips" {
  cidr_blocks = local.cloudflare_ips
}

data "cidrblock_summarization" "cdn_ips" {
  cidr_blocks = local.cdn_ips
}

data "cidrblock_summarization" "home_isp_ips" {
  cidr_blocks = local.home_isp_ips
}

data "cidrblock_summarization" "coolify_ips" {
  cidr_blocks = local.coolify_ips
}

data "cidrblock_summarization" "storagebox_destination_ips" {
  cidr_blocks = local.storagebox_destination_ips
}

locals {
  firewall_count              = 5
  firewall_effective_limit    = 500
  firewall_rule_ip_limit      = 100
  firewall_rule_ip_chunk_size = 20
  firewall_assignment_cycle   = local.firewall_count * 2
  firewall_indexes            = range(local.firewall_count)

  cdn_ips_summarized = data.cidrblock_summarization.cdn_ips.summarized_cidr_blocks

  cdn_ips_v4 = [for ip in local.cdn_ips_summarized : ip if !strcontains(ip, ":")]
  cdn_ips_v6 = [for ip in local.cdn_ips_summarized : ip if strcontains(ip, ":")]

  # cdn_ips_v4_filtered = concat([
  #   for ip in local.cdn_ips_v4 : ip
  #   if can(split("/", ip)[1]) && (
  #     tonumber(split("/", ip)[1]) <= 23
  #   )
  # ], local.small_cdn_ips_v4)

  # cdn_ips_v6_filtered = concat([
  #   for ip in local.cdn_ips_v6 : ip
  #   if can(split("/", ip)[1]) && (
  #     tonumber(split("/", ip)[1]) <= 63
  #   )
  # ], local.small_cdn_ips_v6)

  cdn_ips_v4_greedy = distinct([
    for ip in local.cdn_ips :
    cidrsubnet(format("%s/%s", cidrhost(ip, 0), 12), 0, 0)
    if !strcontains(ip, ":")
  ])

  cdn_ips_v6_greedy = distinct([
    for ip in local.cdn_ips :
    cidrsubnet(format("%s/%s", cidrhost(ip, 0), 40), 0, 0)
    if strcontains(ip, ":")
  ])

  # cdn_ips_v4_chunks = chunklist(local.cdn_ips_v4_filtered, local.firewall_rule_ip_chunk_size)
  # cdn_ips_v6_chunks = chunklist(local.cdn_ips_v6_filtered, local.firewall_rule_ip_chunk_size)
  cdn_ips_v4_chunks = chunklist(local.cdn_ips_v4_greedy, local.firewall_rule_ip_chunk_size)
  cdn_ips_v6_chunks = chunklist(local.cdn_ips_v6_greedy, local.firewall_rule_ip_chunk_size)

  web_out = [
    { port = "443", proto = "tcp", desc = "https tcp cdn" },
    { port = "443", proto = "udp", desc = "https udp cdn" },
  ]

  # Port 80 only for package repositories (ca-certificates must be fetched over
  # HTTP before HTTPS sources can work in fresh containers).
  package_repo_http_out_rules = flatten(concat(
    [for i, chunk in local.package_repo_http_ips_v4_chunks : {
      description     = "http package repo v4 - chunk ${i}"
      destination_ips = chunk
      direction       = "out"
      port            = "80"
      protocol        = "tcp"
      source_ips      = []
    }],
    [for i, chunk in local.package_repo_http_ips_v6_chunks : {
      description     = "http package repo v6 - chunk ${i}"
      destination_ips = chunk
      direction       = "out"
      port            = "80"
      protocol        = "tcp"
      source_ips      = []
    }]
  ))

  # amilevskiy/cidrblock returns null summarized_cidr_blocks for empty input;
  # keep an unconfigured Storage Box allowlist as an iterable empty list.
  storagebox_ips_summarized = length(local.storagebox_destination_ips) == 0 ? [] : data.cidrblock_summarization.storagebox_destination_ips.summarized_cidr_blocks
  storagebox_ips_v4         = [for ip in local.storagebox_ips_summarized : ip if !strcontains(ip, ":")]
  storagebox_ips_v6         = [for ip in local.storagebox_ips_summarized : ip if strcontains(ip, ":")]
  storagebox_ips_v4_chunks  = chunklist(local.storagebox_ips_v4, local.firewall_rule_ip_chunk_size)
  storagebox_ips_v6_chunks  = chunklist(local.storagebox_ips_v6, local.firewall_rule_ip_chunk_size)

  storagebox_smb_out_rules = flatten(concat(
    [for i, chunk in local.storagebox_ips_v4_chunks : {
      description     = "smb hetzner storagebox v4 - chunk ${i}"
      destination_ips = chunk
      direction       = "out"
      port            = "445"
      protocol        = "tcp"
      source_ips      = []
    }],
    [for i, chunk in local.storagebox_ips_v6_chunks : {
      description     = "smb hetzner storagebox v6 - chunk ${i}"
      destination_ips = chunk
      direction       = "out"
      port            = "445"
      protocol        = "tcp"
      source_ips      = []
    }]
  ))

  web_out_rules = flatten([
    for service in local.web_out : concat(
      [for i, chunk in local.cdn_ips_v4_chunks : {
        description     = "${service.desc} v4 - chunk ${i}"
        destination_ips = chunk
        direction       = "out"
        port            = service.port
        protocol        = service.proto
        source_ips      = []
      }],

      [for i, chunk in local.cdn_ips_v6_chunks : {
        description     = "${service.desc} v6 - chunk ${i}"
        destination_ips = chunk
        direction       = "out"
        port            = service.port
        protocol        = service.proto
        source_ips      = []
      }]
    )
  ])

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

  base_firewall_rules = [
    {
      description     = "dhcpv4"
      destination_ips = ["0.0.0.0/0"]
      direction       = "out"
      port            = "67-68"
      protocol        = "udp"
      source_ips      = []
    },
    {
      description     = "dns hetzner"
      destination_ips = local.hetzner_ips
      direction       = "out"
      port            = "53"
      protocol        = "udp"
      source_ips      = []
    },
    {
      description     = "http"
      destination_ips = []
      direction       = "in"
      port            = "80"
      protocol        = "tcp"
      source_ips      = ["0.0.0.0/0", "::/0"]
    },
    {
      description     = "https tcp"
      destination_ips = []
      direction       = "in"
      port            = "443"
      protocol        = "tcp"
      source_ips      = ["0.0.0.0/0", "::/0"]
    },
    {
      description     = "https udp"
      destination_ips = []
      direction       = "in"
      port            = "443"
      protocol        = "udp"
      source_ips      = ["0.0.0.0/0", "::/0"]
    },
    {
      description     = "syncthing quic"
      destination_ips = []
      direction       = "in"
      port            = "22000"
      protocol        = "udp"
      source_ips      = ["0.0.0.0/0", "::/0"]
    },
    {
      description     = "syncthing relay data"
      destination_ips = []
      direction       = "in"
      port            = "22067"
      protocol        = "tcp"
      source_ips      = ["0.0.0.0/0", "::/0"]
    },
    {
      description     = "syncthing relay status"
      destination_ips = []
      direction       = "in"
      port            = "22070"
      protocol        = "tcp"
      source_ips      = ["0.0.0.0/0", "::/0"]
    },
    {
      description     = "syncthing"
      destination_ips = []
      direction       = "in"
      port            = "21027"
      protocol        = "udp"
      source_ips      = ["0.0.0.0/0", "::/0"]
    },
    {
      description     = "syncthing"
      destination_ips = []
      direction       = "in"
      port            = "22000"
      protocol        = "tcp"
      source_ips      = ["0.0.0.0/0", "::/0"]
    },
    {
      description     = "rustdesk nat type test"
      destination_ips = []
      direction       = "in"
      port            = "21115"
      protocol        = "tcp"
      source_ips      = ["0.0.0.0/0", "::/0"]
    },
    {
      description     = "rustdesk id registration heartbeat tcp"
      destination_ips = []
      direction       = "in"
      port            = "21116"
      protocol        = "tcp"
      source_ips      = ["0.0.0.0/0", "::/0"]
    },
    {
      description     = "rustdesk id registration heartbeat udp"
      destination_ips = []
      direction       = "in"
      port            = "21116"
      protocol        = "udp"
      source_ips      = ["0.0.0.0/0", "::/0"]
    },
    {
      description     = "rustdesk relay tcp"
      destination_ips = []
      direction       = "in"
      port            = "21117"
      protocol        = "tcp"
      source_ips      = ["0.0.0.0/0", "::/0"]
    },
    {
      description     = "rustdesk web client websocket"
      destination_ips = []
      direction       = "in"
      port            = "21118"
      protocol        = "tcp"
      source_ips      = ["0.0.0.0/0", "::/0"]
    },
    {
      description     = "rustdesk web client websocket"
      destination_ips = []
      direction       = "in"
      port            = "21119"
      protocol        = "tcp"
      source_ips      = ["0.0.0.0/0", "::/0"]
    },
  ]

  ping_in_rules = [
    for i, chunk in local.home_isp_ips_chunks : {
      description     = "ping - chunk ${i}"
      destination_ips = []
      direction       = "in"
      port            = ""
      protocol        = "icmp"
      source_ips      = chunk
    }
  ]

  ssh_in_rules = [
    for i, chunk in local.ssh_source_ips_chunks : {
      description     = "ssh - chunk ${i}"
      destination_ips = []
      direction       = "in"
      port            = "22"
      protocol        = "tcp"
      source_ips      = chunk
    }
  ]

  tor_out_firewall_rules = [
    for rule in local.tor_out_rules : {
      description     = rule.desc
      destination_ips = rule.ips
      direction       = "out"
      port            = rule.port
      protocol        = rule.proto
      source_ips      = []
    }
  ]

  all_firewall_rules = concat(
    local.base_firewall_rules,
    local.ping_in_rules,
    local.ssh_in_rules,
    local.tor_out_firewall_rules,
    local.storagebox_smb_out_rules,
    local.web_out_rules,
    local.package_repo_http_out_rules,
  )

  weighted_firewall_rule_keys = sort([
    for rule_index, rule in local.all_firewall_rules : format(
      "%05d:%05d",
      local.firewall_rule_ip_limit - max(length(rule.source_ips), length(rule.destination_ips), 1),
      rule_index,
    )
  ])

  weighted_firewall_rules = [
    for key in local.weighted_firewall_rule_keys : local.all_firewall_rules[tonumber(split(":", key)[1])]
  ]

  weighted_firewall_rule_bucket_indexes = [
    for rule_index, rule in local.weighted_firewall_rules :
    rule_index % local.firewall_assignment_cycle < local.firewall_count
    ? rule_index % local.firewall_assignment_cycle
    : local.firewall_assignment_cycle - 1 - (rule_index % local.firewall_assignment_cycle)
  ]

  balanced_firewall_rules = {
    for firewall_index in local.firewall_indexes : tostring(firewall_index) => [
      for rule_index, rule in local.weighted_firewall_rules : rule
      if local.weighted_firewall_rule_bucket_indexes[rule_index] == firewall_index
    ]
  }

  balanced_firewall_effective_rule_counts = {
    for firewall_index, rules in local.balanced_firewall_rules : firewall_index => sum([
      for rule in rules : max(length(rule.source_ips), length(rule.destination_ips), 1)
    ])
  }
}

check "hetzner_firewall_rule_limits" {
  assert {
    condition = alltrue(flatten([
      for rules in values(local.balanced_firewall_rules) : [
        for rule in rules : length(rule.source_ips) <= local.firewall_rule_ip_limit && length(rule.destination_ips) <= local.firewall_rule_ip_limit
      ]
    ]))
    error_message = "Hetzner firewall rules must have at most 100 source or destination CIDRs."
  }
}

check "hetzner_firewall_effective_rule_limits" {
  assert {
    condition     = alltrue([for count in values(local.balanced_firewall_effective_rule_counts) : count <= local.firewall_effective_limit])
    error_message = "Hetzner firewalls must stay under 500 effective rules each."
  }
}

resource "hcloud_firewall" "tofu" {
  for_each = local.balanced_firewall_rules

  name = "tofu-${each.key}"

  dynamic "rule" {
    for_each = each.value
    content {
      description     = rule.value.description
      destination_ips = rule.value.destination_ips
      direction       = rule.value.direction
      port            = rule.value.port
      protocol        = rule.value.protocol
      source_ips      = rule.value.source_ips
    }
  }
}

resource "hcloud_firewall_attachment" "tofu" {
  for_each = length(var.firewall_server_ids) == 0 && length(var.firewall_label_selectors) == 0 ? {} : hcloud_firewall.tofu

  firewall_id     = each.value.id
  label_selectors = length(var.firewall_label_selectors) == 0 ? null : var.firewall_label_selectors
  server_ids      = length(var.firewall_server_ids) == 0 ? null : var.firewall_server_ids
}
