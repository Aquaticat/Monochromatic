# Bazzite 44 global input stalls remained unconfirmed; a separate Plasma 6.7.4 panel freeze was observed

## Status

The original problem is an intermittent episode in which input to every application is delayed.
No such episode was reproduced during this investigation,
so its root cause remains unknown.
A low-rate observer is running through 2026-08-28 at 04:20:34 local time.

A different episode was captured on 2026-08-27 around 04:25 local time:
all four Plasma panels stopped reacting to hover and click input,
while the pointer and ordinary windows remained responsive.
Queued panel clicks took effect after the episode ended.
Bazaar also became gray for about one second.
The user confirmed that this was not the usual global-input problem.

Panel Colorizer 6.5.0 was still installed once on every panel even though its visible behavior was disabled.
The user said it should already have been removed and authorized uninstalling it.
The four widget instances and package were removed,
its live settings were moved out of the active configuration,
and Plasma Shell was restarted.
This is a verified removal,
not proof that Panel Colorizer caused either incident class.

At about 05:25,
a later episode with overlapping symptoms occurred after that removal and Plasma restart.
The panel and Helium scrolling were delayed,
while other applications remained responsive.
A watchdog independently captured a Plasma event-loop timeout during the report.
This recurrence establishes that Panel Colorizer was not required for this later episode.
It does not establish that the 04:25 and 05:25 episodes had one cause,
or that Helium and Plasma shared one cause.

## Symptom

### Original global-input episode

The defining symptom is delayed input across applications,
not merely an unresponsive panel.
No timestamped instance of this symptom has been captured yet.

The available negative evidence is:

- No AMDGPU reset,
  GPU fault,
  ring timeout,
  job timeout,
  or recovery occurred across sixteen retained boots.
- The current GPU temperatures were normal and no thermal throttling was measured.
- High VRAM use was observed,
  but no memory-pressure or GPU-failure event coincided with a user-visible episode.
- The user could not reproduce the global-input delay during the initial investigation.

### Separate Plasma-centered episodes

During the 2026-08-27 panel episode:

- All four panels stopped showing hover effects.
- Panel clicks were delayed until recovery.
- Ordinary windows remained interactive.
- Pointer movement remained responsive.
- The user did not test the panel clock or Meta-key launcher shortcut.
- The panels recovered without restarting Plasma Shell.

The passive observer recorded no system-wide stall around the report.
Samples from 04:25:19 through 04:26:49 local time showed:

```text
loopGapMs       1000.7 to 1001.2
kwinWaitMs      0.0 to 0.1
cpuPressureMs   2.7 to 10.3
ioPressureMs    0.0 to 2.3
memoryPressureMs 0.0
dm-0 ioMs       0 to 34
dm-1 ioMs       0
```

No matching Plasma,
KWin,
kernel,
AMDGPU,
or Btrfs diagnostic was emitted.
Both Plasma Shell and KWin answered a DBus peer ping immediately at 04:27:03,
near the end of the episode.
That probe was too late to prove whether Plasma's event loop had been blocked earlier.

During the later episode around 05:25:

- The panel and Helium scrolling were delayed.
- Other applications remained responsive.
- Plasma Shell failed a 1.5-second DBus probe.
- KWin answered its control probe in 5.8 ms.
- KWin scheduler wait stayed at 0.0 ms in the sampled interval.
- CPU pressure was 10.5 ms or less in the surrounding sampled intervals.
- I/O pressure was at or below 0.1 ms.
- Memory pressure remained 0.0 ms.
- No kernel,
  DRM,
  or AMDGPU fault was emitted.

The watchdog declared Plasma responsive after three later probes,
and the user placed visible recovery around 05:27.
Those recovery probes began only after all-thread stack collection finished,
so they do not measure the natural duration of the event.
The collector itself may account for part of the visible duration.
Plasma's 05:27:51 probe took 22.0 ms,
compared with the 4.9 to 6.2 ms startup range,
but remained below the 250 ms incident boundary.
The user continued to perceive some Helium scrolling delay after the panel recovered.
At 05:54,
the user confirmed that Helium and the panel were both working normally again.
The temporary continuation keeps Helium's client-local behavior separate from the measured Plasma event-loop stall.

## Root cause

### Original global-input episode: unknown

There is no red-capable reproduction for the original symptom.
The user-visible event has not coincided with a captured kernel fault,
compositor delay,
resource-pressure interval,
or application stack.
The investigation therefore cannot assign an original root cause.

A direct event-loop watchdog now probes Plasma Shell and KWin every five seconds.
Its first failure captured both process states and a Plasma stack.
A second stack was also captured,
but the stack collector pauses the target process and can prolong an existing stall.
The replacement watchdog therefore records only probe results and kernel wait channels.
This closes part of the initial procfs-only observer gap without repeatedly stopping Plasma.

## Diagnostic interpretation

### The later panel episode crossed Plasma's event-loop boundary while KWin remained responsive

The first failed probe began at approximately 05:25:23.8 and reached its 1.5-second limit around 05:25:25.3.
KWin answered in 5.8 ms in the same watchdog pass.
The user's `now` marker arrived around 05:25:52,
so autonomous detection preceded the marker and the later evidence commands.
The Plasma GUI thread stack was:

```text
QWaitCondition::wait
QSGThreadedRenderLoop::polishAndSync
QSGThreadedRenderLoop::handleExposure
QWindow::event
QtWaylandClient::QWaylandWindow::updateExposure
```

The exact Qt source is `qtdeclarative` tag `v6.11.1`.
Its threaded-render-loop comment states that the GUI thread initiates `polishAndSync`,
then blocks until the render thread finishes synchronization
([`qsgthreadedrenderloop.cpp:45-59`](https://code.qt.io/cgit/qt/qtdeclarative.git/tree/src/quick/scenegraph/qsgthreadedrenderloop.cpp?h=v6.11.1#n45)).
The implementation first polishes QML items,
then posts a synchronization event and waits on the render thread
([`qsgthreadedrenderloop.cpp:1546-1681`](https://code.qt.io/cgit/qt/qtdeclarative.git/tree/src/quick/scenegraph/qsgthreadedrenderloop.cpp?h=v6.11.1#n1546)):

```cpp
d->polishItems();

w->thread->postEvent(new WMSyncEvent(window, inExpose, w->forceRenderPass, scProxyData));

w->thread->waitCondition.wait(&w->thread->mutex);
```

A later failed probe at 05:31:43 again timed out Plasma while KWin answered in 5.5 ms.
That Plasma stack was earlier in the same render-loop path:

```text
surfaceForWindow
WindowEffects::installBlur
PlasmaQuick::PlasmaWindow::resizeEvent
QQuickGridLayoutBase::rearrange
QQuickLayout::updatePolish
QQuickWindowPrivate::polishItems
QSGThreadedRenderLoop::polishAndSync
QSGThreadedRenderLoop::handleExposure
```

The second event is observer-contaminated by at least:

- Manual `eu-stack` attachment to Helium's multi-threaded browser and GPU processes.
- OpenSnitch rule creation and audit activity for `eu-stack`.
- OpenSnitch BPF unload and load activity.
- A Plasma invalid-XML notification diagnostic at 05:31:01.

The `WindowEffects::installBlur` frame is one momentary sample during that contaminated window.
It is retained as raw evidence,
not used to identify an initiating component or counted as an independent natural reproduction.

The failed DBus probe establishes that Plasma's GUI event loop did not service the request within 1.5 seconds.
The first stack shows that the GUI thread was at Qt's normal render-synchronization wait point.
All sampled render threads were later idle in `processEventsAndWaitForMore`,
so the sequential stack snapshot does not identify what delayed the earlier synchronization.
The second stack likewise cannot establish that ordinary layout,
blur installation,
or dynamic-cast work was unusually slow.
The captures do not identify which Plasma window was exposed,
which QML item initiated a resize,
or why Helium scrolling remained delayed.
No kernel GPU fault appeared during either interval.

### AMDGPU `REG_WAIT` messages are real timeouts but have not occurred at runtime here

The exact kernel source is OpenGamingCollective Linux tag `v7.2-ogc6`,
commit `53a8eea83bb37294a0fe3d5ceaf6b5f1d8d141b2`.

The register helper passes the polling interval,
try count,
function,
and source line into `generic_reg_wait`
(`drivers/gpu/drm/amd/display/dc/inc/reg_helper.h:216-221`):

```c
/* macro to poll and wait for a register field to read back given value */

#define REG_WAIT(reg_name, field, val, delay_between_poll_us, max_try) \
        generic_reg_wait(CTX, \
                REG(reg_name), FN(reg_name, field), val,\
                delay_between_poll_us, max_try, __func__, __LINE__)
```

`dcn32_program_compbuf_size` waits for four DET-size registers before increasing the compression-buffer size
(`drivers/gpu/drm/amd/display/dc/hubbub/dcn32/dcn32_hubbub.c:140-160`):

```c
if (compbuf_size_segments > hubbub2->compbuf_size_segments) {
    REG_WAIT(DCHUBBUB_DET0_CTRL, DET0_SIZE_CURRENT, hubbub2->det0_size, 1, 100);
    REG_WAIT(DCHUBBUB_DET1_CTRL, DET1_SIZE_CURRENT, hubbub2->det1_size, 1, 100);
    REG_WAIT(DCHUBBUB_DET2_CTRL, DET2_SIZE_CURRENT, hubbub2->det2_size, 1, 100);
    REG_WAIT(DCHUBBUB_DET3_CTRL, DET3_SIZE_CURRENT, hubbub2->det3_size, 1, 100);
}
```

`optc32_disable_crtc` disables the timing generator and then waits for its clock to stop being busy
(`drivers/gpu/drm/amd/display/dc/optc/dcn32/dcn32_optc.c:172-199`):

```c
REG_UPDATE(OTG_CONTROL,
        OTG_MASTER_EN, 0);

REG_UPDATE(CONTROL,
        VTG0_ENABLE, 0);

/* CRTC disabled, so disable  clock. */
REG_WAIT(OTG_CLOCK_CONTROL,
        OTG_BUSY, 0,
        1, 150000);
```

Per-boot monotonic journal timestamps place every retained local event within 39.705 seconds of boot.
Boot `-15` had no matching event;
boots `-14` through `0` did.
The two `optc32_disable_crtc` occurrences were in boots `-14` and `-13` around 39 seconds.
The `dcn32_program_compbuf_size` occurrences were between 11.343 and 39.705 seconds.

This timing supports an early display-configuration phase on this machine,
but the functions can also participate in later display mode transitions.
The messages must not be called harmless solely because they happened early.
The narrower verified statement is that no matching runtime timeout coincided with the reported desktop symptoms here.

### Timeline creation was clean, while cleanup aligned with both natural panel events

The exact Snapper source is tag `v0.13.0`,
commit `3a3bd97083976d28538d402284ff947b4aab5b8f`.

The hourly helper creates a snapshot whose cleanup label is `timeline`
(`client/systemd-helper/systemd-helper.cc:98-104`):

```cpp
SCD scd;
scd.description = "timeline";
scd.cleanup = "timeline";
scd.userdata = userdata;

snapper->createSingleSnapshot(scd, report);
```

A non-empty cleanup label enables quota handling
(`snapper/Snapshot.cc:640-647`):

```cpp
snapper->getFilesystem()->createSnapshot(num, num_parent, read_only, !cleanup.empty(),
                                         empty);
```

The Btrfs backend passes the configured qgroup to snapshot creation
(`snapper/Btrfs.cc:332-336`):

```cpp
create_snapshot(subvolume_dir.fd(), info_dir.fd(), SNAPSHOT_NAME, read_only,
                quota ? qgroup : no_qgroup);
```

Snapper then requests qgroup inheritance
(`snapper/BtrfsUtils.cc:152-165`):

```cpp
if (qgroup != no_qgroup)
{
    struct btrfs_qgroup_inherit *inherit;

    inherit = (btrfs_qgroup_inherit*) &buffer[0];
    inherit->num_qgroups = 1;
    inherit->num_ref_copies = 0;
    inherit->num_excl_copies = 0;
    inherit->qgroups[0] = qgroup;
    util_inherit = (struct btrfs_util_qgroup_inherit *)inherit;
}
```

When the kernel cannot use its quick-inherit accounting path,
it marks the qgroup inconsistent
(`fs/btrfs/qgroup.c:3582-3587`):

```c
if (need_rescan)
    qgroup_mark_inconsistent(fs_info, "qgroup inherit needs a rescan");
```

The current system starts this path hourly.
At 04:00:12 local time,
`snapper-timeline.service` created the root snapshot and the kernel emitted:

```text
BTRFS warning (device dm-0): qgroup marked inconsistent, qgroup inherit needs a rescan
```

The snapshot produced dm-0 and NVMe activity,
including a measured 21,556 KiB dm-0 write interval at 04:00:13.
KWin ping time stayed between 5.4 and 6.3 ms around the warning,
KWin scheduler wait remained at or below 0.1 ms,
and the user reported no stutter while actively trying to trigger one.
The scans completed at 04:22:12 and 04:23:50.

A second qgroup warning occurred at 05:00:12.
The procfs observer recorded no scheduler or resource-pressure threshold crossing around it.
At 05:00:25,
Plasma Shell answered in 5.6 ms and KWin answered in 5.4 ms.
No user symptom marker accompanied this cycle,
so these measurements establish responsive sampled services rather than absence of a subjective symptom.

The installed `snapper-cleanup.timer` runs hourly with `OnUnitActiveSec=1h`.
The 04:25 and 05:25 natural Plasma-centered events both occurred while that cleanup service was active:

- The 04:20:34 cleanup logged deletion of snapshot 969 at 04:23:50.
  The user reported the first panel episode around 04:25.
  Cleanup completed at 04:29:57.
- The 05:21:32 cleanup logged deletion of snapshot 970 at 05:24:49.
  Plasma's failed probe began about 34 seconds later.
  Cleanup completed at 05:34:56.
- The same cleanup logged deletion of snapshot 971 at 05:31:02.
  The observer-contaminated second probe began about 41 seconds later.

Both uncontaminated symptom reports therefore have a cleanup association,
unlike the earlier assessment based only on timeline creation.
This is repeated temporal evidence,
not a demonstrated call path.
No I/O-pressure interval,
KWin delay,
or system-wide input failure accompanied the failed Plasma probe.
The 04:00 and 05:00 clean timeline-creation measurements still oppose a simple snapshot-creation trigger.
A cleanup-specific interaction is now a focused hypothesis for the Plasma-centered episodes,
but it requires another uncontaminated cleanup cycle with a snapshot deletion
to distinguish recurrence from coincidence.

The 06:22 cleanup ran during the encrypted-filesystem scrub and deleted no snapshot.
It completed at 06:25 without a Plasma or KWin probe delay.
The 07:00 timeline creation also left both probes responsive while the scrub was active.
These are scrub-contaminated cases and do not test the deletion-specific association.

## Environment findings

### Panel Colorizer remained active despite disabled visible styling

The installed package was Panel Colorizer 6.5.0,
source tag `v6.5.0`,
commit `157bf8105e92afd9d6fa82faef872099d05ee9c2`.
The latest upstream release during investigation was 8.0.0.

The Plasma layout contained four instances:

```text
panel 5  widget 41
panel 32 widget 42
panel 34 widget 43
panel 36 widget 39
```

Each instance had `hideWidget=true` and `isEnabled=false` in the layout.
That did not disable its DBus helpers because their separate default is true
(`package/contents/config/main.xml:75-79`):

```xml
<entry
    name="enableDBusService"
    type="Bool">
    <default>true</default>
</entry>
```

Each instance creates one service model and two signal monitors when that setting is enabled
(`package/contents/ui/main.qml:2036-2056`):

```qml
DBusServiceModel {
    id: serviceModel
    enabled: plasmoid.configuration.enableDBusService
}

DBusSignalMonitor {
    enabled: plasmoid.configuration.enableDBusService
    method: "property_changed"
}

DBusSignalMonitor {
    enabled: plasmoid.configuration.enableDBusService
    method: "preset_changed"
}
```

The service model launches `service.py`
(`package/contents/ui/DBusServiceModel.qml:8-18`):

```qml
property string serviceUtil: toolsDir + "service.py"
property string pythonExecutable: plasmoid.configuration.pythonExecutable
property string serviceCmd: pythonExecutable + " '" + serviceUtil + "' "
                            + Plasmoid.containment.id + " " + Plasmoid.id

function toggleService() {
    if (enabled)
        runCommand.run(serviceCmd);
    else
        (dbusQuit.call());
}
```

Each signal monitor launches `gdbus_get_signal.sh`
(`package/contents/ui/DBusSignalMonitor.qml:16-18`):

```qml
readonly property string dbusMessageTool: "'" + toolsDir + "gdbus_get_signal.sh'"
readonly property string monitorCmd:
    `${dbusMessageTool} ${busType} ${service} ${iface} ${path} ${method}`
```

That script starts both `gdbus monitor` and `tail -f`
(`package/contents/ui/tools/gdbus_get_signal.sh:7-11`):

```bash
TMPFILE=$(mktemp)
gdbus monitor --"${BUS_TYPE}" --dest "${SERVICE}" >"$TMPFILE" &
PID=$!
exit_code=130
tail -f "$TMPFILE" | while IFS= read -r line; do
```

The live Plasma service tree matched this source shape:
four Python services,
eight `gdbus monitor` processes,
eight `tail -f` processes,
and their shell wrappers were present before removal.

This proves that the apparently disabled widgets still ran helper infrastructure.
It does not prove that those helpers caused the 04:25 panel freeze or original global-input stalls.
No live Plasma stack was captured during the 04:25 episode,
and the removal made same-configuration recurrence unavailable.
The later Plasma-centered episode occurred while the package,
widget references,
helpers,
and live settings were absent.
Panel Colorizer was therefore not required for that later recurrence.

### AMDGPU VM-memory warnings are teardown warnings and remain a watch item

The runtime messages such as:

```text
VM memory stats for proc polypane(...) task polypane:cs0(...) is non-zero when fini
```

come from VM destruction when an accounting check remains non-zero
(`drivers/gpu/drm/amd/amdgpu/amdgpu_vm.c:2904-2912`):

```c
if (!amdgpu_vm_stats_is_zero(vm)) {
    struct amdgpu_task_info *ti = vm->task_info;

    dev_warn(adev->dev,
         "VM memory stats for proc %s(%d) task %s(%d) is non-zero when fini\n",
         ti->process_name, ti->task.pid, ti->task.comm, ti->tgid);
}
```

The local events occurred as Polypane,
KInfoCenter,
Helium,
Floorp,
and Firefox GPU VMs ended.
They were not GPU reset or ring-timeout diagnostics,
and KWin stayed responsive around the measured events.
The same warning has been associated upstream with an AMDGPU accounting leak path,
so recurring warnings remain worth tracking rather than dismissing.

### Encrypted SATA Btrfs corruption is a separate integrity risk

The encrypted SATA filesystem reported:

```text
bdev /dev/mapper/crypt_sda errs: wr 0, rd 0, flush 0, corrupt 405004, gen 0
```

Retained boot `-2` contained 434 visible checksum-failure lines from 2026-08-16 through 2026-08-18.
The kernel also emitted 41 `btrfs_print_data_csum_error` suppression notices
and 41 matching device-stat suppression notices.
The device-stat notices accounted for 404,483 suppressed callbacks,
so the 434 visible lines are only a sample of the persistent counter's increments.
That visible sample covered 59 inode numbers and 358 inode-offset pairs in top-level subvolume 5.

Current inode resolution mapped 52 of those inode numbers:
50 were Steam game or compatibility files,
and two were files in a clean Git checkout with a working public remote.
Seven inode numbers no longer existed,
so their former paths cannot be classified from the current filesystem.
Targeted 4 KiB buffered reads then exercised the recorded logical offsets in every mapped file.
The probe read 232 current ranges without `EIO`;
one additional old offset was beyond the current shorter file length.
The persistent corruption counter remained exactly 405,004 after that probe.

This narrow probe did not reproduce a checksum error.
It is not proof that the original physical extents are sound:
the page cache can satisfy buffered reads,
and CoW updates can place a current inode offset on a different extent.
It also does not verify suppressed offsets or the rest of the 1.42 TiB of allocated data.

The filesystem has one device,
uses `Data,single`,
and uses `Metadata,DUP`.
`btrfs scrub status` reported no prior scrub statistics.
Official [`btrfs-scrub(8)` documentation](https://btrfs.readthedocs.io/en/stable/btrfs-scrub.html)
says scrub can repair only from another known-good replica,
so this layout cannot reconstruct damaged single-profile file data.
SATA SMART reported PASSED with zero reallocated,
uncorrectable,
program/erase,
and CRC errors.
SMART health does not erase the historical Btrfs checksum failures
or rule out corruption outside the drive,
such as memory or data supplied before a write.
No initiating cause has been established.
A full scrub is still required before resetting the persistent counter.
No captured desktop symptom was attributed to this filesystem.

## Verification

### Environment

```text
Operating System: Bazzite 44
KDE Plasma: 6.7.4
KDE Frameworks: 6.29.0
Qt: 6.11.1
Graphics platform: Wayland
Kernel: 7.2.0-ogc6.1.fc44.x86_64
Graphics processor: AMD Radeon RX 7600
Mesa: 26.2.1-4.fc44
Snapper: 0.13.0-3.fc44
Btrfs tools: 7.1-1.fc44
Panel Colorizer before removal: 6.5.0
```

### AMDGPU retained-boot catalog

The authoritative comparison uses per-boot monotonic time:

```sh
# doc/troubleshooting/bazzite-desktop-input-stalls.md
for boot in $(seq -15 0); do
  journalctl --dmesg --boot="$boot" --no-pager --output=short-monotonic \
    | rg 'REG_WAIT.*(dcn32_program_compbuf_size|optc32_disable_crtc)' -
done
```

Clean case:

- Boot `-15` contained no matching timeout.

Observed timeout cases:

- Boots `-14` through `0` contained `dcn32_program_compbuf_size` events within 39.705 seconds of boot.
- Boots `-14` and `-13` also contained `optc32_disable_crtc` events around 39 seconds.
- No retained runtime event matched a user-visible stall.

### Snapper cycle catalog

```sh
# doc/troubleshooting/bazzite-desktop-input-stalls.md
journalctl --dmesg --boot=0 --no-pager --output=short-iso \
  | rg --ignore-case 'qgroup|quota.*rescan|rescan.*quota' -

journalctl --since='2026-08-27 03:59:50' \
  --until='2026-08-27 04:24:00' \
  --no-pager \
  --output=short-iso \
  --unit=snapper-timeline.service \
  --unit=snapperd.service

journalctl --boot=0 \
  --unit=snapper-cleanup.service \
  --no-pager \
  --output=short-iso

systemctl cat snapper-cleanup.timer
```

Clean visible case:

- The 04:00 cycle triggered qgroup rescans and dm-0 activity without a reported stutter.

Clean instrumentation case:

- The 05:00 cycle crossed no observer threshold,
  and Plasma Shell and KWin answered normally at the sampled point.
- The user did not mark a symptom during this cycle,
  so it is not classified as a clean subjective case.

Cleanup-associated cases:

- The 04:25 panel report occurred during the 04:20:34 to 04:29:57 cleanup.
- The 05:25 Plasma and Helium report occurred during the 05:21:32 to 05:34:56 cleanup.
- Both reports followed a snapshot-deletion log.
- No failed Plasma probe,
  I/O-pressure interval,
  or user symptom marker was captured for retained cleanup runs before the watchdog existed.

Unverified case:

- No original global-input episode has a timestamp that can be compared with another rescan or cleanup.

### Plasma event-loop capture

The watchdog measured an ordinary startup range of 4.9 to 6.2 ms,
then used 250 ms as its incident boundary.
Its classifier self-test exercised both slow-success and failed-probe branches before observation.

The first natural failure record was:

```json
{
  "timestamp": "2026-08-27T09:25:25.295Z",
  "plasmaProbe": { "elapsedMs": 1501.350116, "succeeded": false },
  "kwinProbe": { "elapsedMs": 5.808578, "succeeded": true }
}
```

The raw state is in scratch storage:

```text
/var/home/user/temp/agent/plasma-stall-captures/2026-08-27T09-25-25.295Z
```

The second observer-contaminated state is:

```text
/var/home/user/temp/agent/plasma-stall-captures/2026-08-27T09-31-43.612Z
```

KWin's DBus probes succeeded,
but its stack collection failed with `dwfl_linux_proc_report pid 3768: Permission denied`.
The KWin control therefore has latency and procfs wait-channel evidence,
not a userspace stack.

The procfs wait-channel and userspace stack captures were sequential rather than atomic.
For example,
the first main-thread wait channel was `0`,
while the later userspace stack showed `QWaitCondition::wait`.
That difference prevents treating either snapshot as a full interval trace.

`eu-stack` 0.195 attaches to each live thread with `PTRACE_ATTACH`
([`libdwfl/linux-pid-attach.c:73-117`](https://sourceware.org/elfutils/ftp/0.195/elfutils-0.195.tar.bz2)),
which stops that thread while its state is read.
The all-thread collector was removed from the active watchdog after the two captures.
Current incident collection retains only DBus timings and procfs wait channels.

A Helium snapshot taken while scrolling still felt delayed found its browser main loop polling normally
and its GPU-process main thread waiting on a timed condition.
One contextual spot read reported 58% GPU busy and 6,959,525,888 of 8,573,157,376 VRAM bytes used,
or 81.2%.
Those single values have no unchanged-run band and are not attributed to the delay.
No symbols identified an active Helium call path,
so this is not a Helium root-cause capture.

### Panel Colorizer removal verification

Upstream recommends removing the widget and restarting Plasma Shell for troubleshooting
(`README.md:313-325`).
The executed removal followed that boundary:

```text
Removed live widgets:
[{"panelId":5,"widgetId":41},
 {"panelId":32,"widgetId":42},
 {"panelId":34,"widgetId":43},
 {"panelId":36,"widgetId":39}]

kpackagetool6:
Successfully uninstalled .../luisbocanegra.panel.colorizer/
```

Post-restart host verification reported four intact panels:

```text
panel 5:  kickoff, pager, margins separator, system tray, digital clock, task manager
panel 32: task manager
panel 34: task manager
panel 36: task manager
```

The package registry,
package directory,
active Plasma layout,
and process list contained no Panel Colorizer entry.
Plasma Shell remained active and answered its DBus peer ping.

The Plasma restart also cleared unrelated state and caches,
so its resource measurements provide no component attribution or remediation evidence.

A temporary rollback copy was retained at:

```text
/var/home/user/temp/agent/panel-colorizer-backup-before-uninstall-20260827
```

That is scratch storage,
not a durable backup.
The active Panel Colorizer settings directory was removed.

## Verified workarounds

No workaround for the original global-input stalls or the separate panel freeze has been verified.

## Verified local actions

### Remove Panel Colorizer from every panel

This user-requested maintenance action was completed and verified through Plasma's scripting host,
`kpackagetool6`,
and a Plasma Shell restart.
It was not a root-cause finding or a verified incident workaround.

Tradeoffs:

- Panel Colorizer styling and automatic preset behavior are gone.
- Its saved presets are absent from the live configuration.
- No causal or remediation inference follows from removal,
  regardless of what happens during the remaining observation window.
- Removal prevents reproducing the panel freeze under the old four-instance configuration.

### Keep low-rate event-loop and resource monitoring active

The current observation uses one-second procfs and block-stat sampling plus five-second Plasma/KWin DBus probes.
The lower probe rate avoids the earlier four-pings-per-second pattern.
A user-visible original episode should be marked immediately with `now` so the surrounding evidence can be preserved.

Tradeoffs:

- Five-second probes can miss shorter event-loop stalls.
- DBus probes are not perfectly passive.
- Procfs scheduler counters do not detect every blocked or busy event-loop failure.

### Validate the encrypted SATA filesystem before resetting its error counter

Preserve irreplaceable files from `/var/mnt/encrypted`,
then run a full Btrfs scrub and inspect its `Corrected`,
`Uncorrectable`,
and `Unverified` counts.
Only reset `btrfs device stats` after a clean scrub records a trustworthy baseline.
The linked official Btrfs documentation estimates that scrub uses about 80% of idle device bandwidth by default.

Tradeoffs:

- Backup and scrub I/O can contaminate desktop-stall measurements if run during the same window.
- Single-profile file data has no second Btrfs copy from which scrub can repair corruption.
- A throughput limit reduces foreground contention but lengthens the scrub.

The user prioritized integrity verification over preserving the remaining clean desktop observation.
A foreground scrub started around 06:14 local time with:

```sh
# doc/troubleshooting/bazzite-desktop-input-stalls.md
sudo btrfs scrub start -B --limit 100M /var/mnt/encrypted
```

The `--limit` option did not remain active;
the verified live-limit workaround is documented in the "Foreground scrub limit resets before completion" section.
The starting `corruption_errs` value was preserved at 405,004.
Desktop resource measurements after scrub start are workload-contaminated and cannot represent natural idle behavior.
The Plasma and KWin event-loop probes remain useful for detecting service boundaries,
but any overlap with scrub requires explicit classification.

## What does not work

### Foreground scrub limit resets before completion

The installed `btrfs-progs` is version 7.1,
source tag `v7.1` commit `4ab0e80be9e3bb1db2e6038e6d4316d35fb7ba8b`.
The requested `scrub start --limit 100M` did not persist:
a live status showed 531.07 MiB/s,
`btrfs scrub limit` displayed no limit,
and the sysfs value was `0`.

The source saves the old value and writes the requested value
(`cmds/scrub.c:1411-1418`):

```c
sp[i].old_limit = read_scrub_device_limit(fdmnt, devid);
ret = write_scrub_device_limit(fdmnt, devid, throughput_limit);
```

After creating the scrub and progress threads,
it restores the old limit before joining the scrub thread
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

The same ordering remains in upstream commit `6797ce7600556138081382441bbc6104f35736e2`.
No matching open or closed upstream issue or pull request was found using
`scrub limit reset foreground`.

The separate live command applied the requested limit:

```sh
# doc/troubleshooting/bazzite-desktop-input-stalls.md
sudo btrfs scrub limit --all --limit 100M /var/mnt/encrypted
```

`btrfs scrub limit` then reported `100.00MiB`,
the sysfs value became `104857600`,
and subsequent block samples read 98.61 to 102.13 MiB per second.
This workaround leaves the sysfs limit set after scrub completion,
so it must be restored to its prior value of `0`.

### Treating the panel episode as the original stutter

The user explicitly distinguished them.
The panel episode affected all panels while ordinary windows and pointer motion remained normal.
The original episode delays input everywhere.
Combining them would produce the wrong diagnosis.

### Treating early `REG_WAIT` timestamps as proof of harmlessness

The source proves a register failed to reach its expected state within the requested poll count.
It does not prove that the same diagnostic can never matter during a runtime display transition.
The local evidence only shows that retained events occurred early and did not coincide with a captured stall.

### Tuning undocumented AMDGPU parameters first

No local reset,
fault,
ring timeout,
or runtime `REG_WAIT` supports an AMDGPU parameter change.
Changing display-core or power parameters now would add an uncontrolled variable without a matching failure signal.

### Attributing the panel freeze to Panel Colorizer from presence or removal

Panel Colorizer was present on every panel during the 04:25 episode,
and it was later removed at the user's request.
Neither fact establishes cause.
The broad Plasma-centered symptom later recurred while it was absent,
which establishes only that Panel Colorizer was not required for the later event.
That recurrence does not prove whether it contributed to the earlier event.

### Forcing Qt Quick's basic render loop as a presumed fix

The captured process used Qt Quick's threaded render loop without a `QSG_RENDER_LOOP` environment override.
KDE previously
[forced the basic loop on Wayland](https://invent.kde.org/plasma/plasma-workspace/-/commit/9c998d3083f622a1677782248d4c8e238c935dc2),
then
[reverted that change](https://invent.kde.org/plasma/plasma-workspace/-/commit/c97448ebe5987acd08da9475733f92931c074b95)
because the basic loop reused one OpenGL context across windows with incompatible EGL configurations.
A forced-basic session is therefore an untested diagnostic experiment with known tradeoffs,
not a verified fix.

### Calling Snapper the cause from qgroup warnings alone

The warning and rescans are real,
but one fully observed cycle had no visible symptom and no KWin delay.
That is negative evidence against a simple hourly trigger,
not a complete exclusion.

### Claiming the high-rate monitor prevented the bug

The original symptom did not occur while that monitor ran,
but no controlled comparison proved suppression.
The high-rate KWin and AMDGPU probes were removed as possible experimental confounders,
not as a demonstrated cause or cure.

### Filing the separate panel incident as a Panel Colorizer bug

Panel Colorizer issue
[luisbocanegra/plasma-panel-colorizer#100](https://github.com/luisbocanegra/plasma-panel-colorizer/issues/100)
describes taskbar items becoming unclickable and queued or misdirected click regions,
but it concerned version 1.0.0 and a reproducible panel-mask condition.
The workaround was merged in 2024.
The 04:25 episode on 6.5.0 did not capture a stack or panel-mask state.
The later Plasma-centered episode recurred after the package and helpers were absent,
so it adds no evidence for a Panel Colorizer defect.

Issue
[luisbocanegra/plasma-panel-colorizer#556](https://github.com/luisbocanegra/plasma-panel-colorizer/issues/556)
describes lag from repeated full `panelWidgets` configuration writes.
The 04:25 episode had no matching dm-0 or PSI stall,
and the later recurrence had no Panel Colorizer process that could write this setting.
There is no additive evidence for that thread.

## Upstream filing decision

No `.out-of-scope/` entry matches Bazzite,
KWin,
Plasma,
AMDGPU,
Snapper,
Btrfs,
or Panel Colorizer.

### Original global-input episode

1.  **Is it really upstream's fault?**
    Unknown.
    There is no captured failing component.
2.  **Can upstream fix it?**
    Unknown until the failure boundary is identified.
3.  **Are they supporting this use case?**
    The desktop and input path are supported,
    but the responsible project is unknown.
4.  **Would the repository welcome a contribution?**
    No repository can be selected yet.
5.  **Will they likely fix it?**
    Unknown without a project or reproduction.
6.  **Has a minimal compatible fix been prototyped?**
    No.
    There is no diagnosed call path to fix.

Decision:
do not file.
There is no responsible upstream or reproducible report yet.

### Panel Colorizer

1.  **Is it really upstream's fault?**
    No evidence establishes that.
    The later Plasma-centered episode recurred without Panel Colorizer.
2.  **Can upstream fix it?**
    No Panel Colorizer failure path has been identified.
3.  **Are they supporting this use case?**
    Yes.
    The project customizes Plasma panels and documents bug reporting.
4.  **Would the repository welcome a contribution?**
    Yes.
    `CONTRIBUTING.md` and the bug template accept focused reports after duplicate search.
    No AI-assistance prohibition was found.
5.  **Will they likely fix it?**
    Unknown because no defect in their current version is reproduced.
6.  **Has a minimal compatible fix been prototyped?**
    No.
    There is no diagnosed Panel Colorizer call path to change.

Decision:
do not file.
Constraints 1,
2,
5,
and 6 fail.
The upstream template also asks reporters to verify the latest release,
which cannot be done against the removed 6.5.0 configuration.
Existing issues #100 and #556 cover the nearest known behaviors,
but neither receives additive evidence from this investigation.

### Plasma or Qt Quick

KDE bug
[449163](https://bugs.kde.org/show_bug.cgi?id=449163)
describes superficially similar Wayland panel freezes,
but it was closed for an older Qt Wayland root cause.
KDE maintainers explicitly asked reporters to file focused new reports because similar freezes can have different causes.
Qt bug
[QTBUG-37677](https://bugreports.qt.io/browse/QTBUG-37677)
documents input queuing when rendering is blocked,
but concerns Qt 5 on Mir and X11 rather than this Qt 6 Wayland path.
Neither is a demonstrated duplicate.

1.  **Is it really upstream's fault?**
    The failed boundary is inside Plasma and Qt Quick,
    but the initiating Plasma window and underlying trigger remain unknown.
2.  **Can upstream fix it?**
    Possibly after an uncontaminated reproducible trigger identifies the affected window or item.
3.  **Are they supporting this use case?**
    Yes.
    Plasma panels and Qt Quick's Wayland threaded render loop are supported paths.
4.  **Would the repository welcome a contribution?**
    KDE accepts focused plasmashell performance reports,
    and Qt accepts Qt Quick reports.
5.  **Will they likely fix it?**
    Unknown without a repeatable trigger or responsible project boundary.
6.  **Has a minimal compatible fix been prototyped?**
    No.
    Switching render loops was not treated as a fix because Plasma previously reverted a forced-basic workaround after it caused other Wayland rendering failures.

Decision:
do not file yet.
Constraints 1,
5,
and 6 remain incomplete.
The first failed probe and stack are additive evidence.
The second stack is excluded from component attribution because its window was observer-contaminated.
The responsible project and minimal reproduction are not established.

There is therefore no upstream issue or comment draft to preserve yet.
