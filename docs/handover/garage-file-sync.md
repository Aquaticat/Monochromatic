# Runbook: self-hosted file sync (Garage S3 + rclone bisync)

Rebuild-from-scratch procedure for the Seafile replacement: a single-node Garage
S3 store on Coolify behind a self-managed Caddy, synced to one or more clients by
rclone bisync on an hourly schedule (systemd on Linux, launchd on macOS).

Personal infrastructure, no secrets in this file: credentials appear only as
placeholder names, never values.

## What this builds

- Garage v2.3.0 single-node S3 store on the Coolify host, bucket `files`,
  reachable at `https://garage.c.aquati.cat`.
- Caddy front proxy that terminates TLS and offers only HTTP/1.1 and HTTP/3 (no
  HTTP/2), because HTTP/2's flow-control window throttles uploads to about
  5 MB/s over the ~116 ms RTT to the server.
- An rclone `garage` S3 remote on each client, path-style, region `garage`.
- A bisync exclude filter (`garage-filter.txt`, rule `- *‛*`) passed by every
  client via `--filter-from`. Without it, bisync aborts on 6 stale double-encoded
  "phantom" keys that the bucket lists but cannot serve. See the phantom-key
  section below and
  [the phantom-keys troubleshooting doc](../troubleshooting/rclone-double-encode-phantom-keys.md).
- An hourly scheduler per client: a `user` systemd timer on Linux, a launchd
  LaunchAgent on macOS, each bisyncing `garage:files/Plain` against the client's
  local `Plain` directory.

## Artifacts referenced (do not duplicate)

In the personal notes folder (not this repo):

- `garage-coolify-compose.yml`: the full Garage compose, the secret-generation
  commands, the storage split, and the rclone client commands. Paste this into
  Coolify in Stage A; read its header for the env vars to set.
- `decision-file-sync.md`: why Garage over copyparty, Seafile, Nextcloud, OCIS,
  Syncthing.

In this repo:

- [rclone-double-encode-phantom-keys.md](../troubleshooting/rclone-double-encode-phantom-keys.md):
  why the filter exists, the full root cause, and every removal attempt that failed.

## Bridges tried (why some steps are manual)

- The client parts (rclone remote, scheduler units) are plain commands; on a
  fresh machine you run Stage C and the matching Stage D directly, no UI needed.
- The Garage deploy is a Coolify web-UI action. Coolify has an API, but the
  established workflow is the UI, so Stage A is written as UI steps.
- The Caddyfile is on the Coolify host and self-managed (Coolify's own Caddy
  management is disabled). Clients cannot reach the server's admin surface
  (Garage admin API on `:3903` is loopback-only on the host), so Stage B is done
  over SSH on the host.

## The phantom-key filter (read before Stage C)

The bucket contains 6 keys whose names carry rclone's escape rune U+201B (`‛`),
created once by a double-encode during the original Seafile-to-Garage migration.
Garage lists them but returns `404` on HEAD/GET, and rclone bisync treats a single
unreadable source object as fatal: the whole run aborts with
`Bisync aborted. Must run --resync to recover`.

They cannot be removed: an S3 `DELETE` is a silent no-op on them, and
`garage repair tables` does not reconcile them on a single node (both verified).
So every client excludes them with a filter instead. Nothing regenerates them
(the only writer is rclone on the default encoding with a clean local tree), so
this is a permanent, set-once measure.

Create the filter file on each client before its first bisync:

```bash
printf '%s\n' '- *‛*' > ~/.config/rclone/garage-filter.txt
# verify the bytes are 2d 20 2a e2 80 9b 2a 0a (the ‛ is a literal U+201B)
hexdump -C ~/.config/rclone/garage-filter.txt
```

Pass it to every bisync invocation as `--filter-from ~/.config/rclone/garage-filter.txt`.
Changing the filter between runs makes bisync abort with "filters have changed",
so the first run after adding it must be a `--resync`.

## Setup

Status: TODO | DONE

Have these ready before starting:

- Login to **Coolify** for the target server.
- An **SSH** session to the Coolify host (for the data dir and the Caddyfile).
- The saved S3 credentials `GARAGE_DEFAULT_ACCESS_KEY` (format `GK` + 24 hex)
  and `GARAGE_DEFAULT_SECRET_KEY` (64 hex). If lost, you will mint new ones in
  Stage A and re-point rclone in Stage C.
- rclone on each client: `mise use -g rclone` on Linux, `brew install rclone` on
  macOS (Homebrew installs to `/opt/homebrew/bin/rclone`).

## Steps

Status: TODO | DONE

### Stage A: deploy Garage on Coolify

1. On the Coolify host SSH shell, run `mkdir -p /mnt/storagebox/garage-data`.
   Expected: no output, or `File exists`.
2. In **Coolify**, open the **Project**, click **+ New**, choose **Resource**,
   then **Docker Compose Empty**. Expected: a compose editor opens.
3. Paste the entire contents of `garage-coolify-compose.yml` into the editor.
   Expected: the editor shows the `garage` service and a `configs:` block.
4. Open **Environment Variables** and add the five secrets named in the compose
   header (`GARAGE_RPC_SECRET`, `GARAGE_ADMIN_TOKEN`, `GARAGE_METRICS_TOKEN`,
   `GARAGE_DEFAULT_ACCESS_KEY`, `GARAGE_DEFAULT_SECRET_KEY`), each generated with
   the command written beside it in that header. Expected: five variables saved.
   Keep the access key and secret key; they are your S3 login for Stage C.
5. Click **Deploy**. Expected: the deploy log ends with the `garage` container
   running and no restart loop.

### Stage B: drop HTTP/2 at Caddy

1. On the host, open your self-managed **Caddyfile** in an editor.
2. In the global options block at the very top (the leading `{ ... }`), add:

    ```caddyfile
    {
        servers :443 {
            protocols h1 h3
        }
    }
    ```

   Expected: the file now contains a `servers :443` block with `protocols h1 h3`.
3. Confirm the `garage.c.aquati.cat` site reverse-proxies to **127.0.0.1:3900**
   (the loopback port the compose publishes). Expected: the site block routes to
   `127.0.0.1:3900`.
4. Reload Caddy: `systemctl reload caddy` (or `caddy reload --config <path>`).
   Expected: the command returns with no error printed.

### Stage C: configure rclone on a client

1. Confirm rclone is installed: `rclone version` prints `rclone v1.74.3` or newer.
2. Create the remote (substitute the Stage A credentials):

    ```bash
    rclone config create garage s3 \
      provider Other \
      access_key_id <GARAGE_DEFAULT_ACCESS_KEY> \
      secret_access_key <GARAGE_DEFAULT_SECRET_KEY> \
      endpoint https://garage.c.aquati.cat \
      region garage \
      force_path_style true
    ```

   Expected: `rclone lsf garage:files` returns `Plain/` (or an empty list on a
   fresh store), with no `directory not found` error.
3. Create the phantom-key filter file (see the phantom-key section):

    ```bash
    printf '%s\n' '- *‛*' > ~/.config/rclone/garage-filter.txt
    ```

   Expected: `hexdump -C ~/.config/rclone/garage-filter.txt` shows
   `2d 20 2a e2 80 9b 2a 0a`.
4. Establish the baseline, first run only, never repeat `--resync`:

    ```bash
    rclone bisync garage:files/Plain ~/Plain --resync \
      --filter-from ~/.config/rclone/garage-filter.txt \
      --transfers 16 --checkers 32 --s3-upload-concurrency 8 -v
    ```

   Expected: the log ends with `Bisync successful`. On a 1 GbE link the first run
   pulls the full tree (here ~55 GB) in roughly 20 minutes; later runs reuse the
   listing and take 2 to 3 minutes.

### Stage D (Linux): install the hourly systemd timer

1. Write `~/.config/systemd/user/rclone-bisync-garage.service`:

    ```ini
    [Unit]
    Description=Bisync ~/Seafile/Plain with Garage S3
    Documentation=https://rclone.org/bisync/
    After=network-online.target
    Wants=network-online.target

    [Service]
    Type=oneshot
    WorkingDirectory=%h
    TimeoutStartSec=3000
    ExecStart=%h/.local/share/mise/shims/rclone bisync garage:files/Plain %h/Seafile/Plain --filter-from %h/.config/rclone/garage-filter.txt --transfers 16 --checkers 32 --s3-upload-concurrency 8 --resilient --recover -v
    Nice=10
    IOSchedulingClass=best-effort
    IOSchedulingPriority=6
    ```

   The `ExecStart` uses the mise shim (a stable path that resolves the active
   rclone version) so a `mise upgrade rclone` does not break the unit. The
   `--filter-from` is mandatory (phantom keys).
2. Write `~/.config/systemd/user/rclone-bisync-garage.timer`:

    ```ini
    [Unit]
    Description=Run Garage bisync hourly

    [Timer]
    OnCalendar=hourly
    Persistent=true
    RandomizedDelaySec=120

    [Install]
    WantedBy=timers.target
    ```

3. Run `systemctl --user daemon-reload`. Expected: no output.
4. Run `systemctl --user enable --now rclone-bisync-garage.timer`. Expected:
   `Created symlink ... timers.target.wants/rclone-bisync-garage.timer`.
5. Run `loginctl enable-linger $(id -un)` so the timer fires while logged out.
   Expected: `loginctl show-user $(id -un) -p Linger` then prints `Linger=yes`.
6. Trigger one run: `systemctl --user start rclone-bisync-garage.service`.
   Expected: the run finishes and the journal shows `Bisync successful`.

### Stage D (macOS): install the hourly launchd agent

1. Write `~/Library/LaunchAgents/cat.aquati.rclone-bisync-garage.plist` (the
   local path and the `--config` path must be absolute; launchd does not expand
   `~`):

    ```xml
    <?xml version="1.0" encoding="UTF-8"?>
    <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
    <plist version="1.0">
    <dict>
        <key>Label</key>
        <string>cat.aquati.rclone-bisync-garage</string>
        <key>ProgramArguments</key>
        <array>
            <string>/opt/homebrew/bin/rclone</string>
            <string>bisync</string>
            <string>garage:files/Plain</string>
            <string>/Users/USERNAME/Plain</string>
            <string>--config</string>
            <string>/Users/USERNAME/.config/rclone/rclone.conf</string>
            <string>--filter-from</string>
            <string>/Users/USERNAME/.config/rclone/garage-filter.txt</string>
            <string>--transfers</string>
            <string>16</string>
            <string>--checkers</string>
            <string>32</string>
            <string>--s3-upload-concurrency</string>
            <string>8</string>
            <string>--resilient</string>
            <string>--recover</string>
            <string>-v</string>
        </array>
        <key>StartCalendarInterval</key>
        <dict>
            <key>Minute</key>
            <integer>0</integer>
        </dict>
        <key>RunAtLoad</key>
        <false/>
        <key>ProcessType</key>
        <string>Background</string>
        <key>Nice</key>
        <integer>10</integer>
        <key>LowPriorityIO</key>
        <true/>
        <key>StandardOutPath</key>
        <string>/Users/USERNAME/Library/Logs/rclone-bisync-garage.log</string>
        <key>StandardErrorPath</key>
        <string>/Users/USERNAME/Library/Logs/rclone-bisync-garage.log</string>
    </dict>
    </plist>
    ```

   Replace `USERNAME` throughout. Expected:
   `plutil -lint ~/Library/LaunchAgents/cat.aquati.rclone-bisync-garage.plist`
   prints `... : OK`.
2. Load it: `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/cat.aquati.rclone-bisync-garage.plist`.
   Expected: `launchctl list | grep rclone` shows the label with exit status `0`.
3. Trigger one run: `launchctl kickstart gui/$(id -u)/cat.aquati.rclone-bisync-garage`.
   Expected: `~/Library/Logs/rclone-bisync-garage.log` ends with `Bisync successful`.

   A LaunchAgent runs only while the user is logged in (the Aqua session); there
   is no `linger` equivalent. For a personal Mac that stays logged in, the
   `StartCalendarInterval` fires every hour and catches up once on wake.

## What to check

Status: TODO | DONE

Run each and match the exact string:

- Transport is no longer HTTP/2:
  `curl -sSI https://garage.c.aquati.cat` shows a first line `HTTP/1.1 403`,
  plus headers `Via: 1.1 Caddy` and `Alt-Svc: h3=":443"`. A first line of
  `HTTP/2 403` means the `protocols h1 h3` change in Stage B did not take.
- Garage is healthy (on the Coolify host):
  `docker exec $(docker ps --format '{{.Names}}' | grep -i garage) /garage bucket list`
  output contains `files`.
- rclone can reach the bucket:
  `rclone lsf garage:files` returns `Plain/` without `directory not found`.
- The filter file is correct on each client:
  `hexdump -C ~/.config/rclone/garage-filter.txt` shows `2d 20 2a e2 80 9b 2a 0a`.
- The sync ran clean (Linux):
  `journalctl --user -u rclone-bisync-garage.service -n 40` contains
  `Bisync successful`.
- The sync ran clean (macOS):
  `tail ~/Library/Logs/rclone-bisync-garage.log` contains `Bisync successful`.
- No phantom files reached the local tree:
  `find ~/Plain -name '*‛*'` (or `~/Seafile/Plain`) prints nothing.
- The scheduler is armed (Linux):
  `systemctl --user list-timers rclone-bisync-garage.timer` prints a `NEXT`
  timestamp.
- The scheduler is armed (macOS):
  `launchctl print gui/$(id -u)/cat.aquati.rclone-bisync-garage` prints
  `state = waiting` (or `not running`) with the program path.

## Restore

Status: TODO | DONE

Undo, from least to most destructive. Local files in the client's `Plain`
directory are never touched by any of these.

- Stop and remove the scheduler (Linux):
  `systemctl --user disable --now rclone-bisync-garage.timer`, then
  `rm ~/.config/systemd/user/rclone-bisync-garage.{service,timer}`, then
  `systemctl --user daemon-reload`. Then `loginctl disable-linger $(id -un)`.
- Stop and remove the scheduler (macOS):
  `launchctl bootout gui/$(id -u)/cat.aquati.rclone-bisync-garage`, then
  `rm ~/Library/LaunchAgents/cat.aquati.rclone-bisync-garage.plist`.
- Force a fresh baseline next time (clears bisync state):
  `rm -rf ~/.cache/rclone/bisync/garage_files_Plain..*` on Linux, or
  `rm -rf ~/Library/Caches/rclone/bisync/garage_files_Plain..*` on macOS. The
  next sync then needs `--resync` again.
- Remove the rclone remote and filter: `rclone config delete garage`, then
  `rm ~/.config/rclone/garage-filter.txt`.
- Re-enable HTTP/2 at Caddy: delete the `servers :443 { protocols h1 h3 }` block
  from the Caddyfile and `systemctl reload caddy`.
- Tear down Garage: in **Coolify**, delete the compose resource and its
  `garage-meta` volume; optionally empty `/mnt/storagebox/garage-data` on the
  host. This deletes all uploaded objects.
