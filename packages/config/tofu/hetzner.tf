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
  program  = ["bun", "run", "${path.module}/fetch_ips.ts"]

  query = {
    asn = each.value
  }
}

data "external" "tor_relays" {
  program = ["bun", "run", "${path.module}/fetch_tor_relays.ts"]
  query   = {}
}

data "external" "storagebox_ips" {
  count   = length(var.storagebox_hostnames) == 0 ? 0 : 1
  program = ["bun", "run", "${path.module}/resolve_storagebox_hosts.ts"]

  query = {
    hostnames = join(",", var.storagebox_hostnames)
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

  ubuntu_ips_v4        = [for ip in local.ubuntu_ips : ip if !strcontains(ip, ":")]
  ubuntu_ips_v6        = [for ip in local.ubuntu_ips : ip if strcontains(ip, ":")]
  ubuntu_ips_v4_chunks = chunklist(local.ubuntu_ips_v4, 20)
  ubuntu_ips_v6_chunks = chunklist(local.ubuntu_ips_v6, 20)

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

  # Design Systems News
  design_systems_news_ips = [
    "142.93.187.240/32"
  ]

  # HN RSS
  hn_rss_ips = [
    "159.89.243.242/32"
  ]

  # Almost Secure (palant.info)
  palant_ips = [
    "2a01:4f8:c0c:3e12::2/128", "94.130.151.233/32"
  ]

  # Wattenberger
  wattenberger_ips = ["2a05:d014:58f:6200::259/128", "2a05:d014:58f:6200::258/128",
  "63.176.8.218/32", "35.157.26.135/32"]

  # LetsEncrypt
  letsencrypt_ips = ["18.208.88.157/32", "98.84.224.111/32", "2600:1f18:16e:df01::259/128", "2600:1f18:16e:df01::258/128", "172.65.32.248/32", "2606:4700:60:0:f53d:5624:85c7:3a2c/128"]

  # pCloud
  pCloud_ips = ["45.131.247.0/24", "74.120.8.122/32", "185.62.237.121/32"]

  # Linkup
  linkup_ips = ["31.43.160.6/32", "31.43.161.6/32", "104.20.29.222/32", "172.66.159.108/32", "2606:4700:10::ac42:9f6c/128", "2606:4700:10::6814:1dde/128"]

  # Resend
  resend_ips = ["76.76.21.22/32", "54.157.71.137/32", "54.205.195.44/32"]

  # OpenRouter
  openrouter_ips = ["104.18.3.115/32", "104.18.2.115/32", "2606:4700::6812:373/128", "2606:4700::6812:273/128"]

  # Anthropic https://platform.claude.com/docs/en/api/ip-addresses
  anthropic_ips = ["160.79.104.0/23", "2607:6bc0::/48"]

  # Distrowatch
  distrowatch_ips = ["82.103.129.71/32", "2a00:9080:1:58a::1/128"]

  # Leaf And Core
  leafAndCore_ips = ["162.241.225.96/32"]

  # Lobsters
  lobsters_ips = ["68.183.100.95/32", "2604:a880:400:d1:0:2:16bc:d001/128"]

  # Scott Hanselman's blog
  hanselman_ips = ["13.107.246.35/32", "13.107.213.35/32", "2620:1ec:46::35/128", "2620:1ec:bdf::35/128"]

  # Chrome
  chrome_ips = ["142.250.139.0/24", "2607:f8b0:4023:1804::/64"]

  # HTTP Toolkit
  httpToolkit_ips = ["169.150.219.114/32", "2400:52e0:1a06::1025:1/128"]

  # Pencil And Paper
  pencilAndPaper_ips = ["198.202.211.1/32"]

  # Set Studio
  setStudio_ips = ["172.64.80.1/32", "2606:4700:130:436c:6f75:6466:6c61:7265/128"]

  # ntietz blog
  ntietz_ips = ["147.182.138.16/32"]

  # Luna's Blog
  moonbaseLgbt_ips = ["138.68.164.160/32", "2a03:b0c0:1:d0::dbe:f001/128"]

  # Linux Servers Containers
  lscr_ips = ["52.33.86.107/32", "54.244.195.224/32", "34.213.189.139/32", "3.77.103.135/32"]

  hetzner_ips = ["185.12.64.0/24", "2a01:4ff:ff00::/64"]

  syncthing_apt_ips = [
    "141.144.200.0/21", # Oracle Cloud London (where the .net nodes live)
    "193.122.0.0/17",   # Oracle Cloud Global range often used for their nodes
    "2603:c022::/32"    # Syncthing IPv6 Range
  ]

  synthetic_ips = ["3.209.162.83/32", "52.70.98.142/32", "104.26.6.235/32", "172.67.73.12/32", "104.26.7.235/32", "2606:4700:20::681a:7eb/128", "2606:4700:20::ac43:490c/128", "2606:4700:20::681a:6eb/128"]

  nextcloud_ips = [
    # nextcloud.com
    "85.10.195.17/32",
    "2a01:4f8:a0:3068::2/128",
    # updates.nextcloud.com
    "5.9.202.145/32",
    "2a01:4f8:210:21c8::145/128",
    # connectivity.nextcloud.com
    "65.21.231.50/32",
    "2a01:4f9:6a:1de8::2/128",
    # apps.nextcloud.com
    "65.21.231.50/32",
    "2a01:4f9:6a:1de8::2/128",
    # ltd1.nextcloud.com
    "95.217.44.166/32",
    "2a01:4f9:2a:3119::2/128",
    # ltd2.nextcloud.com
    "37.27.104.209/32",
    "2a01:4f9:3070:1b62::2/128",
    # ltd3.nextcloud.com
    "95.216.37.161/32",
    "2a01:4f9:2a:25de::2/128",
    # garm3.nextcloud.com
    "65.108.197.113/32",
    "2a01:4f9:1a:995e::2/128",
    # garm2.nextcloud.com
    "65.109.114.179/32",
    "2a01:4f9:3051:40eb::2/128",
    # garm1.nextcloud.com
    "65.109.20.140/32",
    "2a01:4f9:5a:1299::2/128",
    # garm4.nextcloud.com
    "65.108.142.93/32",
    "2a01:4f9:1a:9254::2/128",
    # garm5.nextcloud.com
    "65.21.22.252/32",
    "2a01:4f9:3080:4f42::2/128",
    # push-notifications.nextcloud.com
    "95.217.53.153/32",
    "2a01:4f9:2b:29dc::153/128"
  ]

  small_cdn_ips = concat(local.hetzner_ips, local.syncthing_apt_ips, local.synthetic_ips, local.design_systems_news_ips, local.hn_rss_ips, local.palant_ips, local.wattenberger_ips, local.pCloud_ips, local.linkup_ips, local.resend_ips, local.openrouter_ips, local.ntietz_ips, local.moonbaseLgbt_ips, local.hanselman_ips, local.chrome_ips, local.httpToolkit_ips, local.pencilAndPaper_ips, local.setStudio_ips, local.lscr_ips, local.anthropic_ips, local.nextcloud_ips)

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
    condition     = alltrue([for ip in concat(local.cdn_ips, local.hetzner_ips, local.coolify_ips, local.tor_relay_ips, local.storagebox_destination_ips) : can(cidrhost(ip, 0))])
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

  # Port 80 only for Ubuntu APT repos (ca-certificates must be fetched over
  # HTTP before HTTPS sources can work in fresh containers).
  ubuntu_http_out_rules = flatten(concat(
    [for i, chunk in local.ubuntu_ips_v4_chunks : {
      description     = "http ubuntu v4 - chunk ${i}"
      destination_ips = chunk
      direction       = "out"
      port            = "80"
      protocol        = "tcp"
      source_ips      = []
    }],
    [for i, chunk in local.ubuntu_ips_v6_chunks : {
      description     = "http ubuntu v6 - chunk ${i}"
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

  home_isp_ips_summarized = length(local.home_isp_ips) == 0 ? [] : data.cidrblock_summarization.home_isp_ips.summarized_cidr_blocks
  home_isp_ips_chunks     = chunklist(local.home_isp_ips_summarized, local.firewall_rule_ip_chunk_size)
  coolify_ips_summarized  = length(local.coolify_ips) == 0 ? [] : data.cidrblock_summarization.coolify_ips.summarized_cidr_blocks
  ssh_source_ips_chunks   = chunklist(concat(local.home_isp_ips_summarized, local.coolify_ips_summarized), local.firewall_rule_ip_chunk_size)

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
    local.ubuntu_http_out_rules,
  )

  balanced_firewall_rules = {
    for firewall_index in local.firewall_indexes : tostring(firewall_index) => [
      for rule_index, rule in local.all_firewall_rules : rule
      if rule_index % local.firewall_count == firewall_index
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
