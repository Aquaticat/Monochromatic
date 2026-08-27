# btrfs-progs 7.1 `scrub start --limit` resets the limit before scrub completion

## Symptom

This command accepted and printed a 100 MiB/s limit:

```sh
# doc/troubleshooting/btrfs-scrub-start-limit-reset.md
sudo btrfs scrub start -B --limit 100M /var/mnt/encrypted
```

While the scrub remained active,
`btrfs scrub limit /var/mnt/encrypted` reported no limit
and `/sys/fs/btrfs/01c308e7-06fa-4737-8a7b-3bb5fcba871d/devinfo/1/scrub_speed_max` contained `0`.
The scrub read about 531 MiB/s rather than the requested rate.

The separate live command worked:

```sh
# doc/troubleshooting/btrfs-scrub-start-limit-reset.md
sudo btrfs scrub limit --all --limit 100M /var/mnt/encrypted
```

The sysfs value then became `104857600`.
Subsequent block samples read 98.61 to 102.13 MiB per second.

## Root cause

The installed `btrfs-progs` is version 7.1.
Its exact source is tag `v7.1`,
commit `4ab0e80be9e3bb1db2e6038e6d4316d35fb7ba8b`.
The same ordering remains in upstream commit `6797ce7600556138081382441bbc6104f35736e2`.

`btrfs scrub start` saves the previous per-device value and writes the requested value
(`cmds/scrub.c:1411-1418`):

```c
sp[i].old_limit = read_scrub_device_limit(fdmnt, devid);
ret = write_scrub_device_limit(fdmnt, devid, throughput_limit);
if (ret < 0) {
        errno = -ret;
        warning("failed to set scrub throughput limit on devid %llu: %m",
                devid);
}
```

It then creates each blocking scrub thread
(`cmds/scrub.c:1547-1569`):

```c
ret = pthread_create(&t_devs[i], NULL,
                        scrub_one_dev, &sp[i]);
```

The parent loop restores the previous limit before joining those threads
(`cmds/scrub.c:1595-1608`):

```c
for (i = 0; i < fi_args.num_devices; ++i) {
        /* Revert to the older scrub limit. */
        ret = write_scrub_device_limit(fdmnt, di_args[i].devid, sp[i].old_limit);

        if (sp[i].skip)
                continue;
        devid = di_args[i].devid;
        ret = pthread_join(t_devs[i], NULL);
```

The kernel scrub therefore continues after userspace has restored the previous value.
The source fix moves restoration into a second loop after every scrub thread has joined.
The [prototype patch](btrfs-scrub-start-limit-reset.patch) also extends the existing scrub-limit CLI test.

## Verification

### Versions and source

```text
btrfs-progs v7.1
kernel 7.2.0-ogc6.1.fc44.x86_64
installed source 4ab0e80be9e3bb1db2e6038e6d4316d35fb7ba8b
prototype base 6797ce7600556138081382441bbc6104f35736e2
prototype commits 52720bd31d3c7e3bc2173470b44291f65d7ac61d
                  32d8942
```

The prototype built successfully in a container limited to 2 GiB of memory and 2 CPUs.
The upstream test script could not acquire a loop device inside the rootless container,
so its failure was classified as a test-environment failure:

```text
losetup: cannot find an unused loop device
```

The functional test instead used a disposable local fixture:

- Four 256 MiB sparse loop devices.
- Btrfs `Data,RAID1` and `Metadata,RAID1` profiles.
- A 64 MiB file.
- A previous per-device limit of 30 MiB/s.
- A temporary foreground-scrub limit of 1 MiB/s.

The guard sampled sysfs only while `btrfs scrub status` reported `Status: running`.
This excludes legitimate startup before the new value is written
and teardown after the old value is restored.

Unpatched result:

```text
scrubStatus=0 runningSamples=35 mismatch=1
```

Fixed result:

```text
scrubStatus=0 runningSamples=265 mismatch=0
```

The fixed run also restored all four devices to `31457280` bytes/s after completion.
The disposable filesystem unmounted,
all four loop devices detached,
and its scratch directory was removed.

### Failing catalog

- `btrfs scrub start -B --limit SIZE PATH` restores the previous value while the kernel scrub remains active.
- Background mode reaches the same restoration and join ordering in `scrub_start`.

### Working catalog

- `btrfs scrub limit --all --limit SIZE PATH` changes the live sysfs values.
- Writing `scrub_speed_max` through the dedicated limit command affects an already-running scrub.
- The prototype keeps the temporary value while the kernel reports a running scrub,
  then restores the previous value after completion.

## Verified workarounds

Apply the limit after starting scrub:

```sh
# doc/troubleshooting/btrfs-scrub-start-limit-reset.md
sudo btrfs scrub start -B /mountpoint
sudo btrfs scrub limit --all --limit 100M /mountpoint
```

For a foreground scrub,
run the start command in one process and the limit command from another process.

Tradeoffs:

- The live command changes persistent-in-mount sysfs state rather than tying restoration to one scrub invocation.
- Record every previous device value and restore it explicitly after scrub completion.
- A process that exits before restoration can leave the live limit active until it is changed or the filesystem unmounts.

## What does not work

### Trusting the startup line

`Starting scrub on devid 1 (limit 100.00MiB/s)` reports the value read immediately after it was written.
It does not prove the value remains active while the kernel scrub runs.

### Checking userspace process lifetime

An initial guard sampled from process creation through process exit.
It reported a mismatch on the fixed implementation because that interval includes valid startup and teardown transitions.
Kernel `Status: running` is the relevant assertion boundary.

### Using `btrfs check --repair`

This bug controls scrub throughput.
It is unrelated to filesystem structural repair,
and `btrfs check --repair` cannot correct the option's userspace ordering.

## Upstream filing decision

No `.out-of-scope/` entry matches Btrfs or `btrfs-progs`.

1. **Is it really upstream's fault?**
   Yes.
   The installed and current upstream source restore the old value before joining active scrub threads.
2. **Can upstream fix it?**
   Yes.
   Moving restoration after all joins preserves the documented lifecycle.
3. **Are they supporting this use case?**
   Yes.
   [`btrfs-scrub(8)`](https://btrfs.readthedocs.io/en/stable/btrfs-scrub.html)
   documents `scrub start --limit` and promises restoration after scrub finishes.
4. **Would the repository welcome the contribution?**
   Yes.
   `README.md` prefers GitHub issues for bug reports and accepts GitHub pull requests.
   `Documentation/dev/Developer-s-FAQ.rst` documents testing and patch review.
   No AI-assistance prohibition was found in those files or `.github/`.
5. **Will they likely fix it?**
   Yes with ordinary review uncertainty.
   Maintainer review on [pull request 947](https://github.com/kdave/btrfs-progs/pull/947)
   explicitly accepted saving and restoring the prior limit.
6. **Have we prototyped a minimal compatible fix?**
   Yes.
   The linked patch moves the existing restoration block,
   adds a CLI regression test,
   compiles,
   fails the kernel-running guard without the fix,
   and passes it with the fix.

Searches for `scrub limit reset foreground` found no matching open or closed issue or pull request.
[Issue 943](https://github.com/kdave/btrfs-progs/issues/943) requested scrub performance control,
and pull request 947 implemented `--limit` for that issue.
An additive comment on issue 943 is appropriate;
a new issue would duplicate the feature's existing thread.
External posting requires the user's authorization and has not occurred.

### Additive comment draft

~~~md
`btrfs scrub start --limit` in btrfs-progs 7.1 restores the previous sysfs limit while the kernel scrub is still running.

Reproduction on a four-device disposable RAID1 fixture:

```text
unpatched: scrubStatus=0 runningSamples=35 mismatch=1
fixed:     scrubStatus=0 runningSamples=265 mismatch=0
```

Each sample was taken only while `btrfs scrub status` reported `Status: running`.
The unpatched scrub completed in 6 seconds despite requesting 1 MiB/s.
The fixed scrub took 38 seconds and restored every device's prior 30 MiB/s value after completion.

`cmds/scrub.c` currently writes the requested value around lines 1413 to 1414,
starts the scrub threads,
then restores the old value around lines 1597 to 1598 before `pthread_join` around line 1608.
Current upstream commit `6797ce7600556138081382441bbc6104f35736e2` retains this ordering.

The minimal fix moves the restoration block into a second loop after all scrub threads have joined.
I also added a case to `tests/cli-tests/024-scrub-limit/test.sh` that checks the temporary value while kernel status is running and the original value after completion.

The live workaround is:

```sh
btrfs scrub limit --all --limit SIZE MOUNTPOINT
```

This workaround must restore the previous values explicitly after completion.
~~~
