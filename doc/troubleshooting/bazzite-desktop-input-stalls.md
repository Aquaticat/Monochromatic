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

### Separate Plasma panel episode

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

## Root cause

### Original global-input episode: unknown

There is no red-capable reproduction for the original symptom.
The user-visible event has not coincided with a captured kernel fault,
compositor delay,
resource-pressure interval,
or application stack.
The investigation therefore cannot assign an original root cause.

A direct event-loop watchdog now probes Plasma Shell and KWin every five seconds.
If either fails a measured latency boundary,
it captures both processes' thread wait channels and stacks.
This closes a gap in the initial procfs-only observer,
which could miss a busy event loop with low scheduler wait time.

## Diagnostic interpretation

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

### Snapper triggers full Btrfs qgroup rescans but one observed cycle was symptom-free

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

This single clean cycle weakens Snapper as an immediate trigger.
It does not rule out a timing-dependent interaction during another cycle.
No historical user-visible stutter timestamps exist for comparison with retained rescan windows.

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
It does not prove that those helpers caused the transient panel freeze or original global-input stalls.
No live Plasma stack was captured during the panel episode,
and the removal made same-configuration recurrence unavailable.

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

Retained logs included 434 visible checksum-failure lines and 41 suppression notices.
SATA SMART reported PASSED with zero reallocated,
uncorrectable,
program/erase,
and CRC errors.
SMART health does not erase the recorded Btrfs checksum failures.
Important data on `/var/mnt/encrypted` should be backed up before separate scrub and device testing.
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
```

Clean visible case:

- The 04:00 cycle triggered qgroup rescans and dm-0 activity without a reported stutter.

Unverified case:

- No original global-input episode has a timestamp that can be compared with another rescan.

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

### Back up encrypted SATA data before integrity testing

Back up irreplaceable files from `/var/mnt/encrypted` before running a scrub or extended device test.
Those operations are intentionally separate from the clean desktop observation window.

Tradeoff:
backup and scrub I/O can contaminate desktop-stall measurements if run during the same window.

## What does not work

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

Panel Colorizer was present on every panel during the separate episode,
and it was later removed at the user's request.
Neither fact establishes cause.
Non-recurrence after removal would also be insufficient remediation evidence without a controlled reproduction.

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
The current transient episode on 6.5.0 did not capture a stack or panel-mask state.

Issue
[luisbocanegra/plasma-panel-colorizer#556](https://github.com/luisbocanegra/plasma-panel-colorizer/issues/556)
describes lag from repeated full `panelWidgets` configuration writes.
The current panel episode had no matching dm-0 or PSI stall,
so there is no additive evidence for that thread.

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

### Separate Plasma panel episode

1.  **Is it really upstream's fault?**
    Unconfirmed.
    Four instances were active,
    but no live stack tied the freeze to their code.
2.  **Can upstream fix it?**
    Possibly,
    if a current-version reproduction identifies a panel-mask or helper path.
3.  **Are they supporting this use case?**
    Yes.
    The project customizes Plasma panels and documents bug reporting.
4.  **Would the repository welcome a contribution?**
    Yes.
    `CONTRIBUTING.md` and the bug template accept focused reports after duplicate search.
    No AI-assistance prohibition was found.
5.  **Will they likely fix it?**
    Unknown.
    Similar issue #100 was fixed,
    but this machine used 6.5.0 while upstream had released 8.0.0.
6.  **Has a minimal compatible fix been prototyped?**
    No.
    The installed package was removed before a reproducible current-version failure or source boundary existed.

Decision:
do not file.
Constraints 1,
5,
and 6 fail.
The upstream template also asks reporters to verify the latest release,
which cannot be done against the removed 6.5.0 configuration.
Existing issues #100 and #556 already cover the nearest known behaviors,
and this investigation has no additive stack,
reproduction,
or fix.

There is therefore no upstream issue or comment draft to preserve.
Nothing responsible can be added with the current evidence.
