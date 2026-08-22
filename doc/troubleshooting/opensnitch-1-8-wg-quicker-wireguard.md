# OpenSnitch 1.8.0 strict deny blocks wg-quicker WireGuard transport until endpoint UDP is allowed

## Symptom

`wg-quicker` and OpenSnitch 1.8.0 are compatible with OpenSnitch's default `allow` action.
They also work with strict default-deny policy after OpenSnitch allows the WireGuard peer's outer UDP connection.

Without that allowance,
`wg-quicker up` still exits successfully because creating a WireGuard interface does not wait for a handshake.
The visible failure occurs when traffic tries to cross the tunnel:

```console
PING 10.44.0.2 (10.44.0.2) 56(84) bytes of data.

--- 10.44.0.2 ping statistics ---
2 packets transmitted, 0 received, 100% packet loss, time 1043ms
```

The WireGuard peer then reports no handshake and only attempted transmission:

```console
latest-handshakes: 0
transfer: 0 B received, 148 B sent
```

OpenSnitch records the outer packet as UDP with no userspace owner and with `wg-quicker`'s WireGuard mark intact:

```text
new connection udp => 59716:192.0.2.1 -> 192.0.2.2 ():2049 uid: 4294967295, mark: ca6c
[-1] FindProcess() error: Unable to get process information
```

There is no `wg-quicker` diagnostic because OpenSnitch applies its policy after interface setup.
This repository's host did not have OpenSnitch installed when investigated.
The compatibility result therefore comes from the released OpenSnitch daemon in disposable network namespaces,
not from changing the host firewall.

## Root cause

### The tools own separate nftables objects

`wg-quicker` creates a per-interface table in
`package/cli/wg-quicker/src/tunnel-firewall.ts:35-50`:

```ts
const iface = config.interfaceName;
/**
 * Name of the dedicated nft table for this interface.
 */
const nftable = `wg-quicker-${iface}`;
/**
 * nft statements built up and applied atomically via `nft -f`.
 */
const statements: string[] = [`add table inet ${nftable}`,];
```

OpenSnitch 1.8.0 names its table `opensnitch` in
`evilsocket/opensnitch@v1.8.0:daemon/firewall/nftables/exprs/enums.go:5-8`:

```go
const (
	TABLE_OPENSNITCH     = "opensnitch"
	CHAIN_FILTER_INPUT   = "filter_input"
	CHAIN_MANGLE_OUTPUT  = "mangle_output"
```

The released daemon created both `inet opensnitch` and `inet wg-quicker-wgqos` in the same disposable namespace.
Bringing the tunnel down removed only `inet wg-quicker-wgqos` and retained OpenSnitch's table.
This rules out table-name collision and broad table cleanup as the compatibility problem.

### OpenSnitch sees WireGuard's outer UDP packet

OpenSnitch installs an output chain at nftables mangle priority in
`evilsocket/opensnitch@v1.8.0:daemon/firewall/nftables/chains.go:131-138`:

```go
n.AddChain(exprs.CHAIN_FILTER_INPUT, exprs.TABLE_OPENSNITCH, exprs.NFT_FAMILY_INET,
	nftables.ChainPriorityFilter, nftables.ChainTypeFilter, nftables.ChainHookInput, filterPolicy)
if !n.Commit() {
	return fmt.Errorf("Error adding DNS interception chain filter_input-opensnitch-inet")
}
n.AddChain(exprs.CHAIN_MANGLE_OUTPUT, exprs.TABLE_OPENSNITCH, exprs.NFT_FAMILY_INET,
	nftables.ChainPriorityMangle, nftables.ChainTypeRoute, nftables.ChainHookOutput, manglePolicy)
```

Its non-TCP interception rule queues new or related packets in
`evilsocket/opensnitch@v1.8.0:daemon/firewall/nftables/rules.go:93-119`:

```go
n.Conn.AddRule(&nftables.Rule{
	Position: 0,
	Table:    table,
	Chain:    chain,
	Exprs: []expr.Any{
		&expr.Meta{Key: expr.MetaKeyL4PROTO, Register: 1},
		&expr.Cmp{
			Op:       expr.CmpOpNeq,
			Register: 1,
			Data:     []byte{unix.IPPROTO_TCP},
		},
		&expr.Ct{Register: 1, SourceRegister: false, Key: expr.CtKeySTATE},
		// ... NEW or RELATED state comparison ...
		&expr.Queue{
			Num:  n.QueueNum,
			Flag: n.getBypassFlag(),
		},
	},
	UserData: []byte(InterceptionRuleKey),
})
```

A kernel WireGuard interface emits its encrypted peer traffic as a second,
outer UDP connection.
The disposable run proved this packet reached OpenSnitch with UID `4294967295`,
no process,
and mark `0xca6c`.

### Default action determines the no-process result

When process lookup returns no connection,
OpenSnitch applies the configured default action in
`evilsocket/opensnitch@v1.8.0:daemon/main.go:408-440`:

```go
con := conman.Parse(packet, uiClient.InterceptUnknown())
if con == nil {
	applyDefaultAction(&packet, nil)
	return
}

func applyDefaultAction(packet *netfilter.Packet, con *conman.Connection) {
	log.Trace("Applying DefaultAction (%s) on %s", uiClient.DefaultAction(), con)
	if uiClient.DefaultAction() == rule.Allow {
		packet.SetVerdictAndMark(netfilter.NF_ACCEPT, packet.Mark)
		return
	}
	packet.SetVerdict(netfilter.NF_DROP)
}
```

Default allow therefore passes the packet.
Default deny drops it when OpenSnitch cannot attribute it or find an earlier system rule.
This is OpenSnitch policy behavior,
not a routing-rule collision.

### Accepted packet marks remain compatible with wg-quicker routing

`wg-quicker` depends on WireGuard's outer packet retaining the interface mark.
Its policy rule in `package/cli/wg-quicker/src/tunnel-route.ts:121-143` is:

```ts
args: [
  proto,
  'rule',
  'add',
  'not',
  'fwmark',
  String(table,),
  'table',
  String(table,),
],
```

Ordinary inner traffic enters the WireGuard table,
while an outer packet marked with that table number skips it and follows physical routing.

OpenSnitch reads the incoming netfilter mark in
`evilsocket/opensnitch@v1.8.0:daemon/netfilter/queue.go:207-214`:

```go
p := Packet{
	verdictChannel:  make(chan VerdictContainer),
	Mark:            uint32(mark),
	UID:             uid,
	NetworkProtocol: xdata[0] >> 4,
	IfaceInIdx:      int(devIn),
	IfaceOutIdx:     int(devOut),
}
```

Both default and rule-based allow paths return that same mark.
The rule-based path is recorded in
`evilsocket/opensnitch@v1.8.0:daemon/main.go:541-547`:

```go
} else if r.Action == rule.Allow {
	packet.SetVerdictAndMark(netfilter.NF_ACCEPT, packet.Mark)
	ruleName := log.Green(r.Name)
```

The successful handshake after OpenSnitch logged `mark: ca6c` is end-to-end evidence that the mark still prevented
endpoint recursion.

### Application exemptions remain subject to OpenSnitch

`wg-quicker-exempt` sets `SO_MARK` from cgroup socket-address hooks in
`package/cli/wg-quicker-exempt/src/bpf.rs:90-123`:

```rust
const SO_MARK: i32 = 36;
// ...
BpfInsn::new(BPF_MOV32_IMM, 3, 0, 0, SO_MARK),
BpfInsn::new(BPF_CALL, 0, 0, 0, FN_SETSOCKOPT),
```

OpenSnitch 1.8.0 uses kprobes and tracepoints for process discovery,
not the cgroup connect and UDP send-message attachment points owned by `wg-quicker-exempt`.
Its allow paths preserve the existing mark as shown in the previous source trace.
The source-level contracts therefore compose:
the exemption chooses physical routing,
then OpenSnitch can still allow or deny that physical connection.

The disposable compatibility run did not attach `wg-quicker-exempt` to real desktop cgroups because that would have
crossed the fixture boundary.
The cgroup-exemption conclusion is consequently source-backed rather than a combined live-cgroup test.

### OpenSnitch has WireGuard-specific process discovery and a fallback rule

OpenSnitch 1.8.0's eBPF program includes IPv4 and IPv6 tunnel probes in
`evilsocket/opensnitch@v1.8.0:ebpf_prog/opensnitch.c:345-346` and
`evilsocket/opensnitch@v1.8.0:ebpf_prog/opensnitch.c:546-547`:

```c
SEC("kprobe/udp_tunnel6_xmit_skb")
int kprobe__udp_tunnel6_xmit_skb(struct pt_regs *ctx)
```

```c
SEC("kprobe/iptunnel_xmit")
int kprobe__iptunnel_xmit(struct pt_regs *ctx)
```

Kernel and eBPF prerequisites can still make attribution unavailable.
OpenSnitch's FAQ recommends checking the eBPF module and enabling `Debug invalid connections` when WireGuard fails.

The packaged firewall configuration also contains a disabled fallback at
`evilsocket/opensnitch@v1.8.0:daemon/data/system-fw.json:217-237`:

```json
{
  "Enabled": false,
  "Description": "Exclude WireGuard VPN from being intercepted",
  "Expressions": [
    {
      "Statement": {
        "Name": "udp",
        "Values": [
          {
            "Key": "dport",
            "Value": "51820"
          }
        ]
      }
    }
  ],
  "Target": "accept"
}
```

That fallback matches a peer endpoint using UDP destination port `51820`.
It does not match a WireGuard peer on another port.
The active repository host tunnel used endpoint port `2049` when inspected,
so the stock value would need adjustment for that tunnel.

## Verification

### Versions and artifact identity

The combined test used:

- repository HEAD `04521a6ee1301e242231cd52aa65d70e1ee85faf`;
- latest `wg-quicker` package commit `9eb155a1cde5ebd97c071740597a8c20312c2c64`;
- OpenSnitch release `v1.8.0`, commit `b404c4c6316760fa7bc415509d3f8d747f7dc9cc`;
- released RPM SHA-256 `e06e9119daf764e56455b61c319e496274c0274bb53bb94a0ff1ab72967fea7d`;
- released daemon SHA-256 `8669e280de9135a921a7ffe48ec4b47ec15d2d1a947046cd4de9b23f8efaf6e3`;
- Bazzite 44 host kernel `7.1.5-ogc5.1.fc44.x86_64`;
- nftables backend,
  OpenSnitch process monitor `proc`,
  and disposable client and server network namespaces.

The fixture used a WireGuard peer on `192.0.2.2:2049`,
tunnel addresses `10.44.0.1/24` and `10.44.0.2/24`,
and `AllowedIPs = 0.0.0.0/0`.
No host route,
firewall,
or WireGuard interface was changed.

### Runnable package checks

```console
mise run //package/cli/wg-quicker:buildAndTest
mise run //package/cli/wg-quicker:test:integration:route
mise run //package/cli/wg-quicker:test:integration:bypass
mise run //package/cli/wg-quicker:lint:types
mise run //package/cli/wg-quicker:lint:oxlint
```

The combined boundary invocation used the built CLI and released daemon:

```console
sudo ip netns exec wgqosc813 env \
  WG_QUICKER_RUNTIME_DIRECTORY="$scratch/runtime" \
  "$node_bin" package/cli/wg-quicker/dist/final/node/index.mjs \
  up "$scratch/wgqos.conf"

sudo ip netns exec wgqosc813 ping -c 3 -w 5 10.44.0.2
sudo ip netns exec wgqosc813 wg show wgqos
sudo ip netns exec wgqosc813 nft list table inet opensnitch
sudo ip netns exec wgqosc813 nft list table inet wg-quicker-wgqos
```

The fixture prepared OpenSnitch without installing it on the host:

```console
mkdir --parents "${HOME}/temp/agent"
chmod 700 "${HOME}/temp/agent"
gh release download v1.8.0 \
  --repo evilsocket/opensnitch \
  --pattern 'opensnitch-1.8.0-1.x86_64.rpm' \
  --dir "${HOME}/temp/agent/opensnitch-v1.8.0-rpm"

cd -- "${HOME}/temp/agent/opensnitch-v1.8.0-rpm/root"
rpm2cpio ../opensnitch-1.8.0-1.x86_64.rpm \
  | cpio --extract --make-directories --preserve-modification-time
```

The daemon ran inside the client namespace with fixture-local configuration and rules:

```console
sudo ip netns exec wgqosc813 env \
  LD_LIBRARY_PATH="${HOME}/temp/agent/opensnitch-v1.8.0-rpm/lib" \
  "${HOME}/temp/agent/opensnitch-v1.8.0-rpm/root/usr/bin/opensnitchd" \
  -config-file "$scratch/default-config.json" \
  -fw-config-file "$scratch/system-fw.json" \
  -rules-path "$scratch/rules" \
  -process-monitor-method proc \
  -ui-socket "unix://$scratch/osui.sock" \
  -debug
```

The exact network topology is the same two-namespace,
physical-veth,
and two-peer topology implemented by
`package/cli/wg-quicker/src/tunnel-route.integration.test.ts`.
The combined test added OpenSnitch to its client namespace before invoking the real `wg-quicker` bundle.

### Working catalog

- Default action `allow`,
  no endpoint exclusion:
  the OpenSnitch log captured outer UDP mark `0xca6c`,
  WireGuard completed a recent handshake,
  transferred `476 B` received and `532 B` sent,
  and ping received `3` of `3` replies.
- Default action `deny`,
  endpoint-port system rule `udp dport 2049 accept` before the NFQUEUE rules:
  WireGuard completed a recent handshake,
  transferred `476 B` received and `532 B` sent,
  and ping received `3` of `3` replies.
- OpenSnitch started before `wg-quicker`:
  both nftables tables coexisted and the default-allow tunnel passed traffic.
- OpenSnitch restarted while the WireGuard fixture existed,
  followed by a fresh `wg-quicker down` and `up`:
  the endpoint-port rule still passed traffic.
- `wg-quicker down` while OpenSnitch ran:
  the WireGuard link and `wg-quicker` table disappeared,
  while OpenSnitch's populated table remained.

### Failing catalog

- Default action `deny`,
  `InterceptUnknown = false`,
  and no endpoint system rule:
  `wg-quicker up` exited successfully,
  but latest handshake remained `0`,
  transfer stayed at `0 B` received and `148 B` sent,
  and ping received `0` of `2` replies.
- OpenSnitch's disabled stock exclusion was not a workaround for the fixture's port `2049` because its only match is
  UDP destination port `51820`.

## Verified workarounds

### Keep default allow and apply application rules

OpenSnitch's released default is `DefaultAction = allow`.
The combined fixture worked without a WireGuard-specific exception,
and OpenSnitch preserved `wg-quicker`'s mark.

Tradeoff:
a no-process connection that has no matching rule receives the permissive default.
This is unsuitable when the intended policy requires unknown kernel traffic to fail closed.

### Add an OpenSnitch system rule for the peer endpoint port

For strict default deny,
add or enable an OpenSnitch system rule before its queue rules:

```nft
udp dport 2049 accept
```

Use the actual UDP destination port from the WireGuard peer's `Endpoint`.
The released `Exclude WireGuard VPN from being intercepted` rule can be enabled unchanged only when that port is
`51820`.
The disposable strict-deny test verified port `2049`.

Tradeoff:
a port-only rule bypasses OpenSnitch application attribution for every outbound UDP connection to that destination
port.
It does not bypass `wg-quicker` routing or encryption.
A separately verified address-and-port rule would be narrower,
but this investigation did not claim that untested variant as a verified workaround.

### Use OpenSnitch eBPF attribution or debug unknown connections

OpenSnitch documents eBPF tunnel probes and the `Debug invalid connections` fallback.
A user can approve the resulting kernel or unknown connection rather than bypassing the queue by port.

Tradeoff:
this depends on kernel tracing features,
OpenSnitch's eBPF objects,
and successful tunnel probe attachment.
The combined fixture deliberately used `proc`,
so this path is upstream-documented rather than locally verified here.

## What does not work

- Allowing only the `wg-quicker` executable does not identify the outer peer packet.
  The packet observed in the fixture had no userspace UID or PID because the WireGuard kernel interface emitted it.
- Assuming every WireGuard peer uses destination port `51820` does not work.
  WireGuard endpoints may use another configured port,
  including the fixture and active host port `2049`.
- Setting `ExemptMark` is not an OpenSnitch bypass.
  It intentionally sends selected application sockets through physical routing,
  but those packets still cross OpenSnitch's output interception chain.
- Treating OpenSnitch's shutdown warnings as tunnel-failure evidence does not work.
  The fixture emitted `queue ... stuck, closing by timeout` only during daemon teardown after successful handshakes;
  the live connection catalog showed no such warning.
- OpenSnitch issue `#1629` reports ProtonVPN and OpenSnitch 1.7.x timeout behavior.
  It is not a reproduction of the released 1.8.0 nftables result recorded here.

## Upstream filing decision

`.out-of-scope/` contains no OpenSnitch,
WireGuard,
or firewall exemption.

The upstream issue and pull-request search covered open and closed results for `WireGuard`,
`VPN`,
`NFQUEUE`,
and kernel connections.
The relevant threads were read in full:

- `#454`,
  the original WireGuard and kernel-process investigation;
- `#853`,
  the fixed 1.6.0-rc.4 regression;
- `#1250`,
  the fixed IPv6 tunnel attribution issue;
- `#1406`,
  the incomplete hardened-kernel report;
- open `#1629`,
  the ProtonVPN 1.7.x timeout report;
- merged pull request `#1423`,
  which moved OpenSnitch 1.8.0 into its application-specific nftables table.

The required filing constraints resolve as follows:

1.  **Upstream fault:** no.
    Released 1.8.0 worked with `wg-quicker` under default allow.
    Strict deny dropping an unattributed connection follows the configured policy,
    and OpenSnitch already provides attribution and exclusion mechanisms.
2.  **Upstream can fix it:** not applicable to the verified compatibility result.
    A separate attribution regression would be fixable,
    but this harness did not reproduce one.
3.  **Supported use case:** yes.
    The FAQ discusses WireGuard,
    source includes tunnel probes,
    and the default system-firewall data includes a WireGuard exclusion.
4.  **Contribution welcome:** yes.
    The repository has bug and feature templates,
    no `CONTRIBUTING.md` or pull-request template,
    and no prohibition on assisted reports was found.
    Pull request `#1423` demonstrates a recent external firewall contribution and maintainer review.
5.  **Likely upstream action:** no change is indicated by this result.
    The observed strict-deny behavior is policy enforcement,
    not evidence of a defect.
6.  **Minimal compatible fix prototyped:** not applicable because constraints 1 and 5 fail.
    The consumer-side endpoint-port configuration was tested instead.

### Upstream filing artifact

Nothing should be filed or added to an existing thread from this investigation.
The result confirms compatibility and an existing documented policy requirement.
It does not reproduce open issue `#1629`'s ProtonVPN timeout,
so commenting there would conflate different versions and callers rather than advance its diagnosis.

## Sources

- [OpenSnitch FAQ][opensnitch-faq]
- [OpenSnitch system rules documentation][opensnitch-system-rules]
- [OpenSnitch 1.8.0 release][opensnitch-release]
- [OpenSnitch WireGuard issue 454][opensnitch-454]
- [OpenSnitch ProtonVPN issue 1629][opensnitch-1629]
- [OpenSnitch application-specific nftables pull request 1423][opensnitch-1423]

[opensnitch-faq]: https://github.com/evilsocket/opensnitch/wiki/FAQs
[opensnitch-system-rules]: https://github.com/evilsocket/opensnitch/wiki/System-rules
[opensnitch-release]: https://github.com/evilsocket/opensnitch/releases/tag/v1.8.0
[opensnitch-454]: https://github.com/evilsocket/opensnitch/issues/454
[opensnitch-1629]: https://github.com/evilsocket/opensnitch/issues/1629
[opensnitch-1423]: https://github.com/evilsocket/opensnitch/pull/1423
