# Ghostty 1.3.1 on Fedora/KDE: `--gtk-single-instance=true` in packaging overrides the user's `gtk-single-instance = false`, so every window shares one process

Ghostty 1.3.1 (`ghostty-1.3.1-1.fc44.x86_64`, GTK app runtime) on KDE Plasma 6.7.1 Wayland.
Setting `gtk-single-instance = false` in `~/.config/ghostty/config` has no effect on how ghostty is
actually launched: the Fedora package hardcodes `--gtk-single-instance=true` in its systemd user unit,
D-Bus service, and desktop file, and a CLI flag overrides the config value.
The result is that all ghostty windows opened through normal launchers live inside a single
long-lived server process, so one crash takes down every window at once.

## Symptom

- `~/.config/ghostty/config` contains `gtk-single-instance = false`, yet the running ghostty is:
  ```
  /usr/bin/ghostty --gtk-single-instance=true --initial-window=false
  ```
- Opening new terminals (app menu, `Ctrl+Alt+T`, "open terminal here", `kstart --application`,
  `gtk-launch`, `gio launch`) adds a window but no new process. Process count stays flat while
  window count climbs.
- Editing the entry in KDE Menu Editor (Program `/usr/bin/ghostty`, empty Command-line arguments)
  changes nothing: the flag reappears on the running process from a source the editor never shows.
- A crash of the one server process closes all of its windows simultaneously.

## Root cause

Two independent facts combine.

First, a ghostty CLI flag overrides the config file, so `--gtk-single-instance=true` on the command
line wins over `gtk-single-instance = false` in `~/.config/ghostty/config:83`:

```ini
# ~/.config/ghostty/config
gtk-single-instance = false
```

Verified empirically in both directions (see Verification): the running server carries the flag and
behaves single-instance despite the config, and a direct `ghostty --gtk-single-instance=false` starts
an independent process despite there being nothing single-instance about the config default.

Second, the flag is injected by the Fedora ghostty package, not by anything the user configured.
The desktop entry is `DBusActivatable=true`, so D-Bus-aware launchers ignore the `Exec=` line and
activate the app by bus name `com.mitchellh.ghostty` instead. Activation is delegated to systemd:

```ini
# /usr/share/dbus-1/services/com.mitchellh.ghostty.service   (ghostty-1.3.1-1.fc44)
[D-BUS Service]
Name=com.mitchellh.ghostty
SystemdService=app-com.mitchellh.ghostty.service
Exec=/usr/bin/ghostty --gtk-single-instance=true --initial-window=false
```

```ini
# /usr/lib/systemd/user/app-com.mitchellh.ghostty.service   (ghostty-1.3.1-1.fc44)
[Service]
Type=notify-reload
ReloadSignal=SIGUSR2
BusName=com.mitchellh.ghostty
ExecStart=/usr/bin/ghostty --gtk-single-instance=true --initial-window=false

[Install]
WantedBy=graphical-session.target
```

The systemd unit is `disabled` (not started at boot) but is started on demand the first time anything
requests the bus name. It then runs as a windowless single-instance server. Confirmed with
`systemctl --user status <pid>`: PID 954453 (the running server) belongs to
`app-com.mitchellh.ghostty.service`, loaded from the unit above.

The `/usr` desktop file carries the same flag, though the user-local copy (which shadows it) does not:

```ini
# /usr/share/applications/com.mitchellh.ghostty.desktop:7,26   (ghostty-1.3.1-1.fc44)
Exec=/usr/bin/ghostty --gtk-single-instance=true
```

KDE has a second injection point for terminals launched by other apps (for example the "System Update"
entry, `/usr/share/applications/system-update.desktop`, which produced the second server-flagged
process `-e /usr/bin/ujust update`):

```ini
# ~/.config/kdeglobals:109-110  (before fix)
TerminalApplication=/usr/bin/ghostty --gtk-single-instance=true
TerminalService=com.mitchellh.ghostty.desktop
```

Once the server owns `com.mitchellh.ghostty`, D-Bus activation short-circuits to the existing owner, so
every subsequent launch through a D-Bus-aware launcher opens a window inside that one process rather
than spawning a new one. That is the shared-process behavior.

### Why the KDE Menu Editor was a dead end

The Menu Editor edits the desktop entry's `Exec`/args. Because the entry is `DBusActivatable=true`,
launches do not use `Exec` at all; they go through D-Bus activation to the systemd unit and D-Bus
service, both of which hardcode the flag in `/usr`. Editing args in the menu therefore cannot remove
the flag, which is why the source of `--gtk-single-instance=true` was not findable there.

## Verification

Versions under test:

- Ghostty 1.3.1, stable channel, app runtime `.gtk`, GTK 4.22.4, libadwaita 1.9.1
  (rpm `ghostty-1.3.1-1.fc44.x86_64`).
- KDE Plasma 6.7.1, KWin 6.7.1, Wayland session, Fedora 44 (Bazzite / rpm-ostree).

Observe the shared-process behavior (launch adds a window, not a process):

```bash
before=$(pgrep -x ghostty | wc -l)
kstart --application com.mitchellh.ghostty; sleep 2
after=$(pgrep -x ghostty | wc -l)
echo "delta processes = $((after - before))"   # observed: 0  (window went into the server)
```

Prove a direct `--gtk-single-instance=false` launch is an independent process (works cleanly):

```bash
before=$(pgrep -x ghostty | wc -l)
setsid --fork ghostty --gtk-single-instance=false; sleep 2
after=$(pgrep -x ghostty | wc -l)
echo "delta processes = $((after - before))"   # observed: 1  (new PID)
```

Prove `--gtk-single-instance=false` never claims the bus name, so no server can reform, using a
throwaway session bus that has no pre-existing owner:

```bash
dbus-run-session -- bash -c '
  b=$(pgrep -x ghostty | sort)
  ghostty --gtk-single-instance=false >/dev/null 2>&1 & sleep 3
  ghostty --gtk-single-instance=false >/dev/null 2>&1 & sleep 3
  a=$(pgrep -x ghostty | sort)
  echo "new PIDs:"; comm -13 <(echo "$b") <(echo "$a") | sed "/^$/d"
  busctl --address "$DBUS_SESSION_BUS_ADDRESS" list --acquired 2>/dev/null \
    | grep -i com.mitchellh.ghostty || echo "no acquired owner"
'
# observed: two distinct new PIDs; "no acquired owner"
```

Launchers that exhibit the shared-process forwarding while a server owns the name:
`kstart --application com.mitchellh.ghostty`, `gtk-launch com.mitchellh.ghostty`,
`gio launch <desktop-file>`.

Launch forms that always produce an independent process:
`ghostty --gtk-single-instance=false` (direct binary), and any launcher once no process owns the bus
name (fresh session with the workaround applied).

## Verified workarounds

### Per-invocation: launch the binary directly with `--gtk-single-instance=false`

For a single "give me a separate process" action, bypass D-Bus activation and run the binary:

```bash
ghostty --gtk-single-instance=false
```

This is what the `key-helper-kwin` KWin script plus `key-helper-service`
(`~/.local/lib/key-helper/index.ts`, `NEW_WINDOW_OVERRIDES["com.mitchellh.ghostty"]`) use to implement
`Meta+N` as "new instance of the current app". Verified: `Meta+N` on a ghostty window adds a new PID.

Tradeoff: this is a full new process, not a window in a shared server, so it uses more memory and does
not get the server's fast attach. That is the intended behavior here (crash isolation), but it means
`Meta+N` on ghostty is heavier than opening a tab or a server-backed window.

### Global: make every launch its own process

Applied to make all launch paths independent (contains crash blast radius). All edits are user-level;
the `/usr` files are read-only on rpm-ostree and are shadowed, not modified.

1. User desktop file `~/.local/share/applications/com.mitchellh.ghostty.desktop` (shadows `/usr`):
   set both `Exec=` lines to `/usr/bin/ghostty --gtk-single-instance=false` and set
   `DBusActivatable=false` (so launchers use `Exec` instead of activating the shared server).
2. `~/.config/kdeglobals`: `TerminalApplication=/usr/bin/ghostty --gtk-single-instance=false`.
3. Shadow the D-Bus service so any stray activation cannot spawn a `=true` server. Create
   `~/.local/share/dbus-1/services/com.mitchellh.ghostty.service` (user-local shadows `/usr`):
   ```ini
   [D-BUS Service]
   Name=com.mitchellh.ghostty
   Exec=/usr/bin/ghostty --gtk-single-instance=false
   ```
4. Mask the server unit: `systemctl --user mask app-com.mitchellh.ghostty.service`.
5. Refresh caches: `update-desktop-database ~/.local/share/applications && kbuildsycoca6 --noincremental`.

Tradeoffs:

- The windowless single-instance server is gone, so cold opens are slightly slower and each window is a
  separate process (more total memory). This is the point, but it is a real cost.
- `DBusActivatable=false` means the app's D-Bus activation interface is not used for launches. KDE's
  `X-TerminalArg*` keys still work through `Exec`, so "open terminal here" and "run command in terminal"
  are unaffected.
- The shadow D-Bus service launches a `=false` ghostty that never claims `com.mitchellh.ghostty`, so if
  something ever does activate the name it will wait out the D-Bus activation timeout (about 25 s)
  before giving up, while the window still opens. In practice nothing activates the name once
  `DBusActivatable=false`, so this path is dormant.
- Takes effect at next login, not immediately. See the next section.

Reverting: `systemctl --user unmask app-com.mitchellh.ghostty.service`, delete
`~/.local/share/dbus-1/services/com.mitchellh.ghostty.service`, and restore the desktop file and
`kdeglobals` (backups were kept beside the change under the session scratchpad).

Post-login verification (run after logging out and back in, with no server owning the name):

```bash
busctl --user list --acquired | grep -i com.mitchellh.ghostty || echo "no server (good)"
b=$(pgrep -x ghostty | wc -l); kstart --application com.mitchellh.ghostty; sleep 2
echo "delta = $(( $(pgrep -x ghostty | wc -l) - b ))"   # expect 1 per launch
```

## What does not work

- Editing `gtk-single-instance = false` in `~/.config/ghostty/config` alone: overridden by the
  `--gtk-single-instance=true` CLI flag in the packaging files.
- Editing the desktop entry `Exec`/args (KDE Menu Editor or the file directly) while leaving
  `DBusActivatable=true`: launches go through D-Bus activation and ignore `Exec`, so the flag from the
  systemd unit and D-Bus service still applies.
- Masking `app-com.mitchellh.ghostty.service` without also shadowing the D-Bus service: the D-Bus
  service file's own `Exec=` fallback still carries `--gtk-single-instance=true`, so an activation can
  recreate a `=true` server.
- Killing the running server to switch models in the current session: not viable in an interactive
  session where the server is the controlling terminal. Here the server (PID 954453) was the ancestor
  of the running shell (`ghostty -> bash -> claude -> bash`), so killing it would end the session and
  close every other ghostty window. This is why the global workaround only takes full effect after a
  fresh login.

## Upstream filing decision

`.out-of-scope/` holds no ghostty or KDE exemption, so upstream tracking is not out of scope by policy.
Duplicate search: `gh search issues --repo ghostty-org/ghostty ...` returned rate-limited on this run
(see `docs/troubleshooting/gh-search-rate-limit.md`); the decision below does not rest on filing, so
the incomplete search does not block it.

Default policy is do not file. Walking the six constraints:

1. Is it really upstream's fault? No. Two intended behaviors combine: CLI flags overriding the config
   file is standard and deliberate, and the single-instance server started via systemd/D-Bus activation
   is a feature (fast windowless attach). The `--gtk-single-instance=true` flag lives in Fedora's
   packaging files (`ghostty-1.3.1-1.fc44`), which is a distribution packaging choice, not the ghostty
   source. The user-facing surprise is that a config key is silently ineffective for the GUI launch
   path, but that is a consequence of documented precedence plus packaging, not a defect in ghostty.
2. Can upstream fix it? Not applicable given constraint 1 fails; there is no upstream defect to fix.
   The closest actionable change would be a Fedora packaging request to not hardcode the flag, which is
   a preference debate about a working feature, not a bug fix.
3. Are they supporting this use case? Both single-instance and non-single-instance are supported and
   documented via `gtk-single-instance`; the workaround uses the supported `=false` mode.
4. Would the repo welcome our contribution? Not evaluated to completion; moot because constraint 1
   already fails.
5. Will they likely fix it? Not applicable; nothing to fix.
6. Prototyped a minimal fix? Not applicable; constraints 1 and 2 fail, so the auto-prototype trigger
   (constraints 1 to 5 holding or sorta-holding) is not met.

Decision: do not file. This is a local configuration and packaging-precedence issue, resolved entirely
with user-level configuration. No new-issue draft is kept; there is nothing upstream to report.
