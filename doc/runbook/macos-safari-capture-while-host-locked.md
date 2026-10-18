# Capture macOS Safari and iPhone Simulator Safari while `m1` is locked

Visual checks of web pages in Apple browsers run on `m1` (Apple M1, 16 GiB RAM, macOS 27).
Keep-awake tools on the host (Vorssaint, `caffeinate`, pointer nudging) have proven unreliable,
so every capture path here must keep working while the host's login session is locked.
Last verified 2026-10-18.

## What fails while the host is locked

On `m1`, `ioreg -n Root -d1 -a | grep -A1 CGSSessionScreenIsLocked` prints `<true/>` while locked;
the key is absent while unlocked.

- Safari (the app) stops painting: the page reports `document.visibilityState` as `hidden`.
- Safari's WebDriver (`/usr/bin/safaridriver`) still creates sessions, navigates and runs scripts,
  but `GET /session/{id}/screenshot` returns a blank dark frame of the right size.
- The Safari Technology Preview MCP (`safari-mcp-stp`) behaves the same: scripts run, screenshots are black.
- Published experience agrees:
  Safari has no headless mode,
  and its WebDriver needs an unlocked window server
  (for example [caramel issue 61][caramel-61]).

## iPhone Simulator: works while locked

`xcrun simctl io <udid> screenshot <file>` reads the simulated device's own frame buffer,
so it captures correctly with the host locked.
Drive navigation with `xcrun simctl openurl <udid> <url>`.

## macOS Safari: real Safari inside a UTM macOS VM

A guest macOS session has its own window server that does not lock when the host locks,
so real Safari inside the guest keeps painting.

Setup on `m1` as of 2026-10-18:

- VM bundle: `/Volumes/MacData/utm/macOS.utm` (UTM, Apple Virtualization backend, 8 GiB RAM),
  guest macOS 27.0 with Safari 27.0, the same versions as the host.
- Guest display: 1920x1200 at 80 PPI, which is a 1x (non-Retina) display;
  this matches a desktop screen at device pixel ratio 1.
- Guest address: `192.168.64.2` on UTM's shared network (`bridge100`); host side is `192.168.64.1`.
- Login: user `user`; SSH key `~/.ssh/id_ed25519_vm` on `m1` is in the guest's `authorized_keys`,
  so reach it as `ssh m1` then `ssh -i ~/.ssh/id_ed25519_vm user@192.168.64.2`.
  No entry on the Linux side is needed.
- `utmctl` does not work over SSH (`OSStatus error -1743`, "does not work from SSH sessions");
  start or stop the VM from the UTM window on the host.

Guest settings that keep it rendering, applied with `sudo` in the guest:

```bash
# in the guest, over SSH
sudo pmset -a sleep 0 displaysleep 0 disksleep 0 powernap 0
sysadminctl -screenLock off -password '<password>'
defaults -currentHost write com.apple.screensaver idleTime -int 0
sudo /usr/bin/safaridriver --enable
```

`sudo sysadminctl -autologin set -userName user -password '<password>'` failed with
`SACSetAutoLoginPassword error:22` even with FileVault off, so a guest reboot needs a manual login
from the UTM window.

### Reaching the host's preview server from the guest

Forward the host's port into the guest so pages keep the same `localhost` origin:

```bash
# on m1
ssh -i ~/.ssh/id_ed25519_vm -o ExitOnForwardFailure=yes -f -N -R 4173:127.0.0.1:4173 user@192.168.64.2
```

### Starting WebDriver in the guest

Start the driver with `nohup` and stdin detached;
a bare `cmd &` inside `ssh host '...'` dies when the SSH command returns,
and the next request fails with curl exit 7 (connection refused):

```bash
# in the guest, over SSH
nohup /usr/bin/safaridriver --port 4445 </dev/null >/tmp/safari-driver.log 2>&1 &
```

Never run `/Applications/Safari.app/Contents/MacOS/Safari` directly (for example with `--version`)
to read the version: it starts a Safari process that never exits,
and every later `POST /session` times out with
`The session timed out while connecting to a Safari instance`.
Read the version with `defaults read /Applications/Safari.app/Contents/Info CFBundleShortVersionString`,
and kill any such stray process before creating a session.

## macOS WebKit fallback: `webkit-capture` on the host

`/Volumes/MacData/xinyanchen-capture/webkit-capture` on `m1` is a small Swift tool:
an off-screen `WKWebView` (the system WebKit that Safari uses) with occlusion detection disabled
through the private `_setWindowOcclusionDetectionEnabled:`,
Safari's user agent,
and `takeSnapshot` output at the host's 2x scale.
It renders while the host is locked (page reports `visible`).

```bash
# on m1
webkit-capture <url> <width> <height> <out.png> [script] [settle-ms] [full]
```

Positive control on 2026-10-18:
`filter`,
gradient and SVG `mask-image`,
`transform: scaleX(-1)` and `box-shadow` rendered as in Chromium;
`backdrop-filter` did not render in its snapshot,
and a 3D `rotateY` came out slightly different.
It is Safari's engine,
not the Safari app:
no toolbar,
Safari preference defaults,
or content blockers.
Prefer the VM;
use this when the VM is down.
