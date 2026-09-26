# Android Emulator 37.1.11 rejects a private Fold AVD after a forced container stop

## Symptom

The design-only `Fold_No_Hardware_Probe` AVD had been running in a
6 GiB/2 CPU Podman container.
`podman stop --time 20` warned that `SIGTERM` did not stop the emulator
within 20 seconds and resorted to `SIGKILL`.
A later boot attempt of that **same disposable AVD** exited with code `1`:

```text
FATAL | Running multiple emulators with the same AVD is an experimental feature.Please use -read-only flag to enable this feature.
```

This was emitted by Android Emulator 37.1.11.0 before guest boot,
not by Gboard or the music-player prototype.
It is distinct from the host `qemu_thread_create` failure recorded in
[fedora-44-fold-emulator-user-task-ceiling.md](fedora-44-fold-emulator-user-task-ceiling.md).
The `-read-only` suggestion in the fatal message does not meet a writable
disposable-guest test's needs.

## Root cause boundary

The local Android 37.1.11 build is not mapped to a public source commit.
The nearby public `emu-master-dev` source in
[`android-qemu2-glue/main.cpp`][emulator-main] at lines `1844` to `1873`
shows a writable-instance check after the snapshot lock:

```cpp
const char* coreHwIniPath = avdInfo_getCoreHwIniPath(avd);
// The read-only branch uses a temporary INI instead.
if (opts->read_only) {
    TempFile* tempIni = tempfile_create();
    coreHwIniPath = tempfile_path(tempIni);
} else if (!opts->check_snapshot_loadable &&
           filelock_create_timeout(coreHwIniPath, 2000) == NULL) {
    derror("Running multiple emulators with the same AVD ");
    derror("is an experimental feature.");
    derror("Please use -read-only flag to enable this feature.");
    return 1;
}
```

That path identifies an unsuccessful lock acquisition as the branch emitting
the observed fatal message in the available source.
It does **not** prove which condition made the installed binary's lock
acquisition fail.
A [separate Android automation report][comparable-issue] describes stale
`hardware-qemu.ini.lock` after a killed architecture probe on other emulator
versions and AVDs;
that is comparable precedent,
not a reproduction of this container failure.

The private AVD directory contained an empty `multiinstance.lock` and a
three-byte `hardware-qemu.ini.lock`,
both with modification times predating this failed restart.
Before moving them,
`adb devices -l` found no device,
`pgrep` found no process for this AVD,
`podman ps` showed no emulator container,
and `lsof`,
`fuser` and `lslocks` reported no owner of either path.
`lslocks` did report unrelated active locks,
so its empty AVD match was not caused by an entirely empty lock listing.
These checks bound the risk of relocating **this private fixture's** files;
they do not establish how the packaged emulator interprets every lock or
rule out a different hidden owner in another environment.

[emulator-main]: https://android.googlesource.com/platform/external/qemu/+/refs/heads/emu-master-dev/android-qemu2-glue/main.cpp
[comparable-issue]: https://github.com/kaeawc/auto-mobile/issues/5202

## Verification

- **Failed case:**
  Starting `Fold_No_Hardware_Probe` under the same
  `podman run --memory=6g --cpus=2` fixture with both lock files present
  emitted the quoted FATAL and returned code `1` before ADB connected.
- **Passing case:**
  Both exact files were moved to private scratch rather than deleted:
  `/home/user/temp/agent/fold-avd-lock-backup.zQiURuZu/`.
  Repeating the same bounded container command then reported
  `ADB_BOOT_READY emulator-5580`.
  Its guest reported AVD name `Fold_No_Hardware_Probe`,
  unfolded device state `2`,
  font scale `2.0`,
  and selected Gboard.
  Launching the existing debug Search activity returned `Status: ok`;
  UI Automator saw the real `Folders` browser,
  Open,
  `cam` field and complete keyboard-closed playback mode.
- The paired before/after run proves **joint relocation** recovered this
  AVD's launch.
  It does not isolate which lock file was decisive or establish that
  `SIGKILL` alone created an invalid lock.

No original `Pixel_9_Pro_Fold` AVD path was modified or launched for this
recovery.
The failing container was removed on exit;
the passing container retained the 6 GiB/2 CPU bounds.

## Verified workaround and tradeoffs

For this **disposable AVD only**,
first confirm no live emulator,
ADB device,
Podman emulator container,
or lock owner uses its directory.
Then preserve its exact stale lock files outside the AVD directory,
and boot the same bounded writable fixture again.
The successful run retained its installed debug app and Gboard settings;
no guest wipe was needed.
The backup is retained in private scratch for diagnosis,
not a public review asset.
If an owner is found,
do **not** move the lock;
stop or reconnect the actual owner instead.
Lock relocation is not a generic fix for every multiple-instance warning.

## What does not work

- The initial writable reboot with those two files still in place:
  it returned the FATAL before the guest appeared in ADB.
- Using `-read-only` solely to suppress the warning:
  not attempted because this design fixture needs writable guest state and
  the message itself identifies read-only as a different multi-instance mode.
- Removing locks from the original AVD or deleting arbitrary `*.lock` files:
  not attempted or authorized.
- Treating the GPU Vulkan warning in the failed boot log as this incident's
  cause:
  the deciding diagnostic was the later lock-related FATAL,
  and the same host-rendering setup booted after the exact lock relocation.

## Upstream filing decision

No upstream report is filed or drafted as ready.
The `.out-of-scope/` entries contain no Android Emulator lock exemption,
but the observed cleanup followed a forced stop of a private writable fixture:

1. An emulator fault is not isolated from the local forced-stop lifecycle.
2. An upstream cleanup change may be possible,
   but the installed binary's source identity and failed lock condition are
   not established.
3. Normal writable AVD startup is supported;
   this failed post-`SIGKILL` state is not proven to be a supported
   recovery guarantee.
4. Contribution policy for the responsible source revision was not audited.
5. No Android Emulator maintainer response to this exact case was
   established;
   the separate automation issue is not the emulator's upstream tracker.
6. No upstream patch or source-level positive control was built.

### Draft, do not file as-is

~~~md
Android Emulator 37.1.11: private Fold AVD reports multiple-instance fatal after forced stop

A writable disposable AVD stopped by a Podman SIGKILL fallback later returned
"Running multiple emulators with the same AVD" while ADB and process checks
found no other running emulator. Moving its two lock files to a private
backup allowed the same bounded boot command to start. The exact lock
failure and source revision have not been isolated, so this is not yet an
upstream issue with a verified fix.
~~~
