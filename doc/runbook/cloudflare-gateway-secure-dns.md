# Secure DNS through a Cloudflare One Gateway location over DoT

This runbook points all of a Linux host's DNS at a Cloudflare One (Zero Trust) Gateway DNS
location over DNS-over-TLS (DoT).
systemd-resolved provides the encrypted transport;
NetworkManager is told to stop handing the network's DHCP DNS to the resolver,
so nothing competes with the Gateway servers.
Written on Bazzite 44 (Fedora atomic,
 KDE),
it applies to any host using systemd-resolved with NetworkManager.

What this proves:
 after the procedure every DNS query leaves the host encrypted to the Gateway location's
resolver (the TLS certificate is validated against the location's unique DoT hostname,
which is exactly how Cloudflare attributes the query to your location),
no query falls back to the network's plaintext resolver,
and the change survives reconnect and reboot.

Bridges tried,
 so this is not an unconsidered handoff:
the whole configuration is file and CLI driven (`tee`/`printf`,
 `nmcli`,
 `resolvectl`),
with no UI automation.
Two points genuinely cannot be automated and are called out where they occur:

- A full NetworkManager reactivation (`nmcli connection up <name>`) needs the Wi-Fi
  pre-shared key,
   which the desktop stores agent-owned in the keyring and `nmcli` cannot
  read non-interactively (it fails with `Secrets were required, but not provided`).
  Bridged for the live session with `resolvectl revert`,
  and the saved profile reaches the same state on the next reconnect or reboot.
- Confirming the queries land under the right Gateway location reads the authenticated
  Cloudflare dashboard,
   which no local tool can reach;
  that is the only UI step,
   in "What to check".

All host-specific addresses,
 the location id,
 the interface,
 and the connection names below
are placeholders.
Substitute your own values (see Setup).

## Setup

Status:
TODO

Prerequisites for a fresh machine:

- A Linux host using systemd-resolved as the resolver and NetworkManager for connections
  (verified on Bazzite 44 / Fedora atomic,
   KDE;
   the steps are distro-agnostic).
  On Fedora atomic the `/etc` files edited here persist across image updates.
- `sudo` (root) on the host.
- A Cloudflare One (Zero Trust) account with a Gateway DNS **location** already created,
  with its endpoints toggled on under **Gateway** -> **DNS locations** -> your location ->
  **Select DNS endpoints**.

Gather these values from that dashboard panel and from your system,
then substitute them everywhere a placeholder appears:

- `<LOCATION_NAME>`:
   the location's display name in the dashboard.
- `<LOCATION_ID>`:
   the unique label inside the DoT/DoH hostname.
  The **DNS over TLS (DoT)** row reads `<LOCATION_ID>.cloudflare-gateway.com`;
  the **DNS over HTTPS (DoH)** row reads
  `https://<LOCATION_ID>.cloudflare-gateway.com/dns-query`.
- `<IPV4_DNS_1>`,
   `<IPV4_DNS_2>`:
   the two **IPv4 DNS** endpoint addresses.
- `<IPV6_DNS>`:
   the **IPv6 DNS** endpoint address (omit if the host has no global IPv6).
- `<WIFI_IFACE>`:
   the wireless interface name (step 2 finds it,
   for example `wlp9s0`).
- `<WIFI_CONNECTION>`:
   the NetworkManager connection (profile) name (step 2 finds it).

## Steps

Status:
TODO

1.  Confirm the resolver stack:
     systemd-resolved active,
     NetworkManager present,
     and
    resolv.
    conf owned by the resolver stub.

    ```sh
    systemctl is-active systemd-resolved
    nmcli --version
    readlink /etc/resolv.conf
    ```

    Expected:
     `active`;
     a line `nmcli tool, version ...`;
     and the symlink resolves to `../run/systemd/resolve/stub-resolv.conf`.
    If `is-active` prints `inactive`,
     enable it with `sudo systemctl enable --now systemd-resolved` and rerun.

2.  Identify your Wi-Fi interface and active connection profile.

    ```sh
    nmcli device status
    nmcli -t -f NAME,TYPE,DEVICE connection show --active
    ```

    Expected:
     a `wifi` device in state `connected`,
     whose DEVICE column is your `<WIFI_IFACE>`;
     and an active `802-11-wireless` row whose NAME is your `<WIFI_CONNECTION>`.
    Note both;
     the steps below substitute them.

3.  Create the systemd-resolved drop-in that defines the Gateway DoT servers.
    The file should contain (placeholders replaced with your dashboard values):

    ```ini
    # /etc/systemd/resolved.conf.d/cloudflare-gateway.conf
    [Resolve]
    DNS=<IPV4_DNS_1>#<LOCATION_ID>.cloudflare-gateway.com <IPV4_DNS_2>#<LOCATION_ID>.cloudflare-gateway.com <IPV6_DNS>#<LOCATION_ID>.cloudflare-gateway.com
    DNSOverTLS=yes
    Domains=~.
    ```

    Create it non-interactively (edit the placeholders first;
     drop the `<IPV6_DNS>#...` token if the host has no global IPv6):

    ```sh
    sudo mkdir -p /etc/systemd/resolved.conf.d
    printf '%s\n' \
      '# /etc/systemd/resolved.conf.d/cloudflare-gateway.conf' \
      '[Resolve]' \
      'DNS=<IPV4_DNS_1>#<LOCATION_ID>.cloudflare-gateway.com <IPV4_DNS_2>#<LOCATION_ID>.cloudflare-gateway.com <IPV6_DNS>#<LOCATION_ID>.cloudflare-gateway.com' \
      'DNSOverTLS=yes' \
      'Domains=~.' | sudo tee /etc/systemd/resolved.conf.d/cloudflare-gateway.conf
    ```

    The `IP#hostname` form connects to the IP on port 853 and uses the hostname for TLS SNI
    and certificate verification,
     which is what ties the queries to your Gateway location.
    `DNSOverTLS=yes` is strict (no plaintext fallback);
    `Domains=~.` makes this the catch-all resolver for every name.

    Expected:
     `tee` echoes the four lines back,
     confirming the file written.

4.  Tell NetworkManager to ignore the DHCP-supplied DNS on the connection,
    so only the Gateway servers above are ever used.
    Run this once per saved Wi-Fi you want covered.

    ```sh
    sudo nmcli connection modify <WIFI_CONNECTION> ipv4.ignore-auto-dns yes ipv6.ignore-auto-dns yes
    ```

    Expected:
     `nmcli -g ipv4.ignore-auto-dns,ipv6.ignore-auto-dns connection show <WIFI_CONNECTION>`
     prints `yes` then `yes` on two lines.

5.  Apply the configuration to the running system.

    ```sh
    sudo systemctl restart systemd-resolved
    sudo nmcli device reapply <WIFI_IFACE>
    sudo resolvectl revert <WIFI_IFACE>
    ```

    Expected:
     `Connection successfully reapplied to device '<WIFI_IFACE>'.`,
     then `resolvectl revert` returns with no output and no error.
    `device reapply` activates the profile change without a reconnect (so it needs no
    Wi-Fi password),
     but on some NetworkManager versions it does not drop the DNS already
    pushed to the live link;
    `resolvectl revert` clears that link's DNS at runtime so the global config takes over now.
    A full reconnect or reboot reaches the same state from the saved profile.

## What to check

Status:
TODO

1.  The global resolver is the Gateway DoT servers,
     and the link has no DNS scope of its own.

    ```sh
    resolvectl status
    ```

    Expected,
     under `Global`:
     `Protocols: ... +DNSOverTLS`,
     a `DNS Servers:` block listing the three `...#<LOCATION_ID>.cloudflare-gateway.com`
     entries,
     and `DNS Domain: ~.`.
    Under `Link N (<WIFI_IFACE>)`:
     `Current Scopes: LLMNR/IPv4 LLMNR/IPv6` with no `DNS` scope,
     `-DefaultRoute`,
     and no `DNS Servers:` line.

2.  Real lookups succeed and report encrypted transport.

    ```sh
    sudo resolvectl flush-caches
    resolvectl query example.com
    ```

    Expected:
     address records,
     then the line `Data was acquired via local or encrypted transport: yes`.

3.  The only live DNS socket is DoT to a Gateway endpoint on port 853.

    ```sh
    resolvectl query github.com >/dev/null; sudo ss -tnp 'dport = :853'
    ```

    Expected:
     one `ESTAB` row to `<IPV4_DNS_1>:853` (or `<IPV4_DNS_2>:853` / `[<IPV6_DNS>]:853`)
     owned by `users:(("systemd-resolve",...))`,
     and no `ESTAB` to your router on `:53`.

4.  Authenticated UI (the one manual step):
     confirm Cloudflare attributes the queries to
    your location.

    1.  In a browser,
         open `https://one.dash.cloudflare.com` and select your account.

        Expected:
         the Zero Trust overview loads.

    2.  Open **Gateway** -> **DNS locations** and click your location **<LOCATION_NAME>**.

        Expected:
         the endpoints shown match the `<IPV4_DNS_1>`,
         `<IPV4_DNS_2>`,
         `<IPV6_DNS>`,
         and
         `<LOCATION_ID>.cloudflare-gateway.com` values you configured.

    3.  Open **Logs** -> **Gateway** -> **DNS** (or **Gateway** -> **Analytics**).

        Expected:
         your recent test lookups (`example.com`,
         `github.com`) appear,
         tagged with the
         location **<LOCATION_NAME>**.

    Optional stronger proof:
     under **Gateway** -> **Firewall policies** -> **DNS**,
     add a policy that blocks a throwaway hostname,
     then run `resolvectl query <that-host>`.
    Expect the block response (for example `0.0.0.0` and `::`) instead of the real address.

## Restore

Status:
TODO

1.  Remove the drop-in and re-enable DHCP DNS on each connection you changed.

    ```sh
    sudo rm -f /etc/systemd/resolved.conf.d/cloudflare-gateway.conf
    sudo nmcli connection modify <WIFI_CONNECTION> ipv4.ignore-auto-dns no ipv6.ignore-auto-dns no
    sudo systemctl restart systemd-resolved
    sudo nmcli device reapply <WIFI_IFACE>
    ```

    Expected:
     `resolvectl status` shows the `Global` `DNS Servers:` list empty again,
     and the `<WIFI_IFACE>` link back to a `DNS` scope with your network's DHCP servers.
    If the link does not pick the DHCP servers back up,
     reconnect the Wi-Fi (toggle it off and on in the desktop network applet,
     which supplies the saved password).

2.  If you added an authenticated test policy in "What to check",
    delete it under **Gateway** -> **Firewall policies** -> **DNS**.

## Notes and caveats

- Strict transport:
   `DNSOverTLS=yes` never downgrades to plaintext,
   so on a network that blocks TCP `:853` all DNS fails until you restore,
   or until you set `DNSOverTLS=opportunistic` and `sudo systemctl restart systemd-resolved`.
- New networks:
   the `ignore-auto-dns` change is per connection.
   A network you have not run step 4 on stays leak-safe anyway (strict global DoT means the
   network's plaintext resolver is never used),
   but `resolvectl status` lists its DHCP servers as inert entries until you run step 4 for it.
- Captive portals (hotel,
   airport sign-in pages) and split-horizon corporate DNS will not
  resolve while this is active;
   restore temporarily,
   sign in,
   then reapply.
- IPv6 endpoint:
   include `<IPV6_DNS>` only when the host has global IPv6 reachability
   (`ping -6 -c 2 <IPV6_DNS>` succeeds).
   On IPv4-only networks the IPv4 endpoints still resolve AAAA records,
   so name resolution for IPv6 destinations keeps working.
- The `<LOCATION_ID>` subdomain uniquely identifies your Gateway location;
   treat it like an account identifier and keep it out of shared logs and screenshots.
