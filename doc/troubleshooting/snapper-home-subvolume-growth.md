# Snapper 0.13.0 on Fedora 44 filled `/var/home` until qgroup cleanup was configured

## Symptom

`df` reported `/var/home` near full even after deleting large cache directories.
The live home tree was much smaller than the filesystem's used-space count,
and deleting Snapper snapshots immediately released the missing space.

Measured before deleting snapshots:

```text
Overall:
    Used:                         824.13GiB
    Free (estimated):              51.45GiB
```

Measured after deleting nine numbered Snapper snapshots and syncing deleted Btrfs subvolumes:

```text
Overall:
    Used:                         573.73GiB
    Free (estimated):             286.32GiB
```

The live snapshot inventory had hourly `timeline` snapshots and boot `number` snapshots:

```text
509 timeline
564 boot
565 timeline
574 boot
575 timeline
587 boot
588 timeline
597 timeline
598 timeline
```

## Root cause

The local Snapper configuration snapshots the whole `/var/home` subvolume:

```text
# /etc/snapper/configs/root:2-3
# subvolume to snapshot
SUBVOLUME="/var/home"
```

That means normal home churn,
including VM images,
Android emulator disk images,
package caches,
container layers,
and project build output,
is retained by snapshots until those snapshots are deleted.
Snapper filters are not an exclusion mechanism for snapshot contents.
The local `man snapper` output states:

```text
Filters are read from the files /etc/snapper/filters/*.txt ...
Note that filters do not exclude files or directories from being snapshotted.
For that, use subvolumes or mount points.
```

There are two automatic snapshot creation paths.
The hourly timer fires every hour:

```systemd
# /usr/lib/systemd/system/snapper-timeline.timer:6-7
[Timer]
OnCalendar=hourly
```

The timeline service invokes Snapper's timeline helper:

```systemd
# /usr/lib/systemd/system/snapper-timeline.service:6-8
[Service]
Type=simple
ExecStart=/usr/libexec/snapper/systemd-helper --timeline
```

The boot timer fires after boot:

```systemd
# /usr/lib/systemd/system/snapper-boot.timer:4-5
[Timer]
OnBootSec=1
```

The boot service creates a `number` cleanup snapshot for the `root` Snapper config:

```systemd
# /usr/lib/systemd/system/snapper-boot.service:6-8
[Service]
Type=oneshot
ExecStart=/usr/bin/snapper --config root create --cleanup-algorithm number --description "boot"
```

The previous config allowed snapshots but did not enable Btrfs qgroups:

```text
TIMELINE_CREATE="yes"
TIMELINE_LIMIT_HOURLY="2"
TIMELINE_LIMIT_DAILY="3"
TIMELINE_LIMIT_WEEKLY="1"
NUMBER_LIMIT="3"
NUMBER_LIMIT_IMPORTANT="3"
QGROUP=""
```

`SPACE_LIMIT` and `FREE_LIMIT` did not protect this machine while qgroups were absent.
Before the fix,
`sudo btrfs qgroup show /var` reported:

```text
ERROR: can't list qgroups: quotas not enabled
```

The local `man snapper` output says space-aware cleanup requires quota setup and range limits:

```text
For the first condition quota must be setup, see command setup-quota.
Additional the NUMBER_LIMIT and TIMELINE_LIMIT variables in the config file must have ranges.
```

Snapper's upstream space-aware cleanup article gives the intended manual setup flow:

```text
# snapper setup-quota
# snapper set-config NUMBER_LIMIT=2-10 NUMBER_LIMIT_IMPORTANT=4-10
# snapper cleanup number
```

The article explains that `setup-quota` creates a parent qgroup and Snapper watches the parent qgroup's
exclusive referenced space:

```text
Fortunately btrfs offers a qgroup hierarchy.
We can create a parent qgroup that holds the qgroups of all snapshots.
Now the exclusive space of this parent qgroup tells us how much space all snapshots use.
```

## Verification

Version and package under test:

```text
snapper-0.13.0-3.fc44.x86_64
Source RPM: snapper-0.13.0-3.fc44.src.rpm
```

Commands that identified the creation paths:

```sh
# doc/troubleshooting/snapper-home-subvolume-growth.md
systemctl cat --no-pager snapper-timeline.timer snapper-timeline.service
systemctl cat --no-pager snapper-boot.timer snapper-boot.service
sudo snapper --config root get-config
sudo snapper --config root list
```

Commands that configure quota-aware cleanup:

```sh
# doc/troubleshooting/snapper-home-subvolume-growth.md
sudo snapper --config root setup-quota

sudo snapper --config root set-config \
  TIMELINE_CREATE=yes \
  TIMELINE_CLEANUP=yes \
  TIMELINE_LIMIT_HOURLY=0-2 \
  TIMELINE_LIMIT_DAILY=0-3 \
  TIMELINE_LIMIT_WEEKLY=0-1 \
  TIMELINE_LIMIT_MONTHLY=0 \
  TIMELINE_LIMIT_QUARTERLY=0 \
  TIMELINE_LIMIT_YEARLY=0 \
  NUMBER_CLEANUP=yes \
  NUMBER_LIMIT=1-3 \
  NUMBER_LIMIT_IMPORTANT=1-3 \
  SPACE_LIMIT=100GiB \
  FREE_LIMIT=200GiB

sudo systemctl enable --now \
  snapper-timeline.timer \
  snapper-boot.timer \
  snapper-cleanup.timer
```

Commands that verified the fixed state:

```sh
# doc/troubleshooting/snapper-home-subvolume-growth.md
sudo btrfs quota rescan --wait /var
sudo btrfs qgroup show -p --human-readable /var
systemctl list-timers --all --no-pager 'snapper*'
systemctl list-unit-files --no-pager 'snapper*'
sudo snapper --config root get-config
sudo snapper --config root list
sudo snapper --config root cleanup number
sudo snapper --config root cleanup timeline
```

Expected fixed-state configuration evidence:

```text
QGROUP                   1/0
SPACE_LIMIT              100GiB
FREE_LIMIT               200GiB
TIMELINE_CREATE          yes
TIMELINE_LIMIT_HOURLY    0-2
TIMELINE_LIMIT_DAILY     0-3
TIMELINE_LIMIT_WEEKLY    0-1
NUMBER_LIMIT             1-3
NUMBER_LIMIT_IMPORTANT   1-3
snapper-boot.timer       enabled disabled
snapper-cleanup.timer    enabled disabled
snapper-timeline.timer   enabled disabled
```

Qgroup evidence after enabling quota and creating a boot snapshot should show the snapshot qgroup parented to `1/0`.
The exact exclusive MiB value can drift as the live subvolume changes:

```text
0/858        356.96GiB     21.33MiB 1/0        home/.snapshots/1/snapshot
1/0          356.96GiB     21.33MiB -          <0 member qgroups>
```

Expected snapshot evidence after enabling `snapper-boot.timer`:

```text
1 │ single │ Sun Jul  5 20:02:20 2026 │ root │ 16.25 MiB │ number │ boot
```

## Verified workarounds

### Configure qgroups and range limits while keeping snapshots enabled

Back up the config before editing:

```sh
# doc/troubleshooting/snapper-home-subvolume-growth.md
sudo cp --preserve=mode,ownership,timestamps \
  /etc/snapper/configs/root \
  /etc/snapper/configs/root.pi-prevent-home-growth-20260705T235633Z
```

Enable Snapper's Btrfs quota integration:

```sh
# doc/troubleshooting/snapper-home-subvolume-growth.md
sudo snapper --config root setup-quota
```

Use ranges for cleanup algorithms so Snapper can keep normal retention when space is healthy,
and delete down to lower bounds under pressure:

```sh
# doc/troubleshooting/snapper-home-subvolume-growth.md
sudo snapper --config root set-config \
  TIMELINE_CREATE=yes \
  TIMELINE_CLEANUP=yes \
  TIMELINE_LIMIT_HOURLY=0-2 \
  TIMELINE_LIMIT_DAILY=0-3 \
  TIMELINE_LIMIT_WEEKLY=0-1 \
  TIMELINE_LIMIT_MONTHLY=0 \
  TIMELINE_LIMIT_QUARTERLY=0 \
  TIMELINE_LIMIT_YEARLY=0 \
  NUMBER_CLEANUP=yes \
  NUMBER_LIMIT=1-3 \
  NUMBER_LIMIT_IMPORTANT=1-3 \
  SPACE_LIMIT=100GiB \
  FREE_LIMIT=200GiB
```

Keep automatic snapshots enabled:

```sh
# doc/troubleshooting/snapper-home-subvolume-growth.md
sudo systemctl enable --now \
  snapper-timeline.timer \
  snapper-boot.timer \
  snapper-cleanup.timer
```

Tradeoffs:

- Btrfs qgroups add accounting overhead.
- Snapper can delete all timeline snapshots when snapshot exclusive usage exceeds `100GiB`,
  or free space falls below `200GiB`.
- The config still keeps at least one `number` snapshot while cleanup is allowed to run.
- Very new snapshots are still protected by `NUMBER_MIN_AGE` and `TIMELINE_MIN_AGE`,
  so a huge fresh snapshot can remain until it reaches the configured minimum age.

### Structural improvement for high-churn directories

Move high-churn directories to separate Btrfs subvolumes or mount points,
or stop using a Snapper config whose `SUBVOLUME` is `/var/home`.
Snapper filters cannot solve this because they only affect diffs and undo operations,
not what Btrfs snapshots capture.

## What does not work

Deleting live cache directories while a recent `/var/home` snapshot exists does not free the retained blocks.
The snapshot keeps old extents alive until the snapshot is deleted.

Relying on fixed values like `NUMBER_LIMIT=3` and `TIMELINE_LIMIT_HOURLY=2` does not activate the second,
space-aware cleanup pass.
The Snapper documentation says the cleanup limits must be ranges for that behavior.

Relying on `SPACE_LIMIT` and `FREE_LIMIT` without Btrfs qgroups does not work.
Snapper needs `QGROUP` set by `snapper setup-quota` so it can measure snapshot space.

Disabling `snapper-timeline.timer` and `snapper-boot.timer` is only an emergency stopgap.
It prevents recurrence by stopping snapshot creation,
but it is not the desired steady state when snapshots should remain available.

Adding Snapper filters for cache paths does not prevent growth.
The local Snapper manual explicitly says filters do not exclude files or directories from being snapshotted.

## Upstream filing decision

Nothing to file upstream.

- Upstream fault:
  no.
  Snapper and Fedora systemd units behaved as configured.
- Upstream can fix it:
  not applicable for this incident.
- Supported use case:
  Snapper supports whole-subvolume snapshots and qgroup-based cleanup;
  this machine needed `snapper setup-quota` plus range limits.
- Contribution welcome:
  not checked because this is local configuration,
  not a product defect.
- Likely to fix:
  not applicable.
- Prototype:
  not applicable.
  The verified fix is local configuration and systemd timer state.
