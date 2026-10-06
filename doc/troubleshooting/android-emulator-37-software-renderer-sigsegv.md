# Android Emulator 37.1.11 on Linux crashes during API 37 headless boot when software rendering is selected

Tool under test:
Android Emulator 37.1.11.0,
build `15917651`,
on Fedora 44.
Surface trigger:
start an API 37 x86_64 AVD headlessly with `-gpu swiftshader_indirect` or `-gpu off`.
Failure mode:
`qemu-system-x86_64-headless` receives `SIGSEGV` before Android finishes booting.

## Symptom

The process reaches the full-startup phase,
never changes from `adb` state `offline` to `device`,
and exits on signal 11.
Pi's process supervisor reported:

```text
Process "android-issue-460-pixel9-disposable-avd" ended after receiving SIGSEGV.
```

`coredumpctl info <pid>` identifies the exact emitter and signal:

```text
Executable: .../emulator/qemu/linux-x86_64/qemu-system-x86_64-headless
Signal: 11 (SEGV)
Message: Process ... (qemu-system-x86) of user 1000 dumped core.
```

The crashing thread enters an invalid executable address from the packaged SwiftShader GLES worker:

```text
Thread 1:
#0  0x000055eb4c48f070 in ?? ()
#1  .../emulator/lib64/gles_swiftshader/libGLESv2.so
#2  .../emulator/lib64/gles_swiftshader/libGLESv2.so
#3  .../emulator/lib64/gles_swiftshader/libGLESv2.so
```

Two alarming startup messages are not sufficient explanations:

```text
ERROR | Setting read-only feature 'GLAsyncSwap' to '0'
pc_memory_init: above 4g size: 40000000
```

The successful `-gpu host` positive control also printed the `pc_memory_init` line,
so that line does not distinguish the crash.
The `GLAsyncSwap` diagnostic appeared on software-renderer runs,
but the stripped build gives no evidence that this feature override caused the invalid call.

## Root cause

The observed boundary is the packaged software GLES renderer.
The exact defective SwiftShader routine is unresolved because Android Emulator 37.1.11 ships a stripped
`qemu-system-x86_64-headless`,
and its package metadata names only build `15917651`,
not a public source commit.

The closest public emulator source inspected was
`aosp-mirror/platform_external_qemu` branch `emu-master-dev` at
`ae9d18d2b6261179fbd57fffec720a04f7bfb053`.
It predates the installed build,
so it establishes the renderer-selection call chain,
not line-for-line identity with 37.1.11.

The GPU setup chooses a software Vulkan implementation when host Vulkan is not selected.
`android/android-ui/modules/aemu-gl-init/src/android/opengl/emugl_config.cpp:1060-1079` says:

```cpp
if (config->use_host_vulkan) {
    system->envSet("ANDROID_EMU_VK_ICD", NULL);
} else if (sGpuOption == "lavapipe") {
    system->envSet("ANDROID_EMU_VK_ICD", "lavapipe");
} else {
    system->envSet("ANDROID_EMU_VK_ICD", "swiftshader");
}
```

The same file adds a non-host backend directory to the dynamic-library search path,
while host mode returns without adding one.
`android/android-ui/modules/aemu-gl-init/src/android/opengl/emugl_config.cpp:1095-1112` says:

```cpp
if (strcmp(config->backend, "host") != 0) {
    std::string dir = sBackendList->getLibDirPath(
            use_swangle ? "angle" : config->backend);
    system->addLibrarySearchDir(dir);
}

if (!strcmp(config->backend, "host")) {
    return;
}
```

The selected renderer then supplies the GLES dispatch table.
`android/android-emu/android/opengles.cpp:258-265` and
`android/android-emu/android/opengles.cpp:409-424` say:

```cpp
sRenderLib->setRenderer(emuglConfig_get_current_renderer());

sRenderer = sRenderLib->initRenderer(width, height, gfxstreamFeatures,
                                     sRendererUsesSubWindow, sEgl2egl);
sGlesv2 = (const GLESv2Dispatch*)sRenderer->getGles2Dispatch();
```

The coredump places the faulting worker in `gles_swiftshader/libGLESv2.so`,
which matches this software-backend path.
The invalid program counter is outside the stripped emulator text addresses and is consistent with generated code,
but it is not proof of a specific JIT defect.
Current SwiftShader source at
`google/swiftshader` commit `694585a05946e1ed49b6bd577ca6537cbb57f025`
contains its JIT implementation under `src/Reactor/LLVMJIT.cpp` and executable-memory implementation under
`src/Reactor/ExecutableMemory.cpp`.
No source-to-binary revision mapping was available,
so attribution stops at the packaged SwiftShader GLES boundary.

## Verification

Installed version:

```text
Pkg.Revision=37.1.11
Pkg.BuildId=15917651
```

The release is Android Emulator 37.1.11 Stable from July 30,
 2026,
according to the [official release notes][emulator-releases].

### Failing catalog

Each software-renderer run reached `offline`,
then exited with `SIGSEGV` before `sys.boot_completed` became `1`.
The Pixel 9 Pro Fold command was retried after the user approved the emulator's OpenSnitch request;
it still produced the same `SIGSEGV`:

```bash
emulator -avd Pixel_9_Pro_Fold \
  -read-only -no-snapshot -no-window -no-audio -no-boot-anim \
  -gpu swiftshader_indirect
```

```bash
emulator -avd Pixel_9_Pro_Fold \
  -read-only -no-snapshot -no-window -no-audio -no-boot-anim \
  -gpu off -camera-back none -camera-front none
```

A fresh Pixel 9 AVD under a disposable `ANDROID_AVD_HOME` failed the same way:

```bash
ANDROID_AVD_HOME="$HOME/temp/agent/issue460-avd-home" \
  emulator -avd Issue460Pixel9 \
  -wipe-data -no-cache -no-snapshot -no-window -no-audio -no-boot-anim \
  -gpu swiftshader_indirect -camera-back none -camera-front none
```

On 2026-09-23,
 the same installed Fold AVD also crashed on SIGSEGV with the emulator's
implicit software renderer when started as follows:

```bash
emulator -avd Pixel_9_Pro_Fold -no-window -no-audio
```

The process logged `Graphics Adapter Android Emulator OpenGL ES Translator (Google SwiftShader)`;
`coredumpctl info 3324401` recorded signal 11 from `qemu-system-x86_64-headless` before
`adb` became ready.
 This additional invocation supports the failing catalog but does
not isolate `-no-window` itself as the cause.

### Working catalog

The installed Pixel 9 Pro Fold AVD booted read-only with host GPU rendering:

```bash
emulator -avd Pixel_9_Pro_Fold \
  -read-only -no-snapshot -no-window -no-audio -no-boot-anim \
  -gpu host -camera-back none -camera-front none
```

A disposable Pixel 9 AVD also booted with host GPU rendering:

```bash
ANDROID_AVD_HOME="$HOME/temp/agent/issue460-avd-home" \
  emulator -avd Issue460Pixel9 \
  -wipe-data -no-cache -no-snapshot -no-window -no-audio -no-boot-anim \
  -gpu host -camera-back none -camera-front none
```

The end-user probe returned:

```text
emulator-5554 device product:sdk_gphone16k_x86_64
boot_completed=1
```

On 2026-09-23,
 the existing Fold AVD also reached `sys.boot_completed=1` and exposed
`cmd device_state` with a windowed host-GPU invocation:

```bash
emulator -avd Pixel_9_Pro_Fold -no-audio -gpu host -no-snapshot-load
```

This comparison changes renderer and window mode together;
 the prior read-only
headless `-gpu host` positive control is the evidence that a window is not required for
host-GPU success on this host.
 The music-player APK and test APK installed on that emulator.
The real Android instrumentation runner then executed the migration suite:

```text
dev.monochromatic.musicplayer.SessionStoreTest:..

Time: 0.008

OK (2 tests)
```

## Separate incident: mid-session SIGSEGV under llvmpipe in a container (2026-10-05)

This is recorded here as the nearest topic.
It is not shown to be the SwiftShader boot crash:
the emulator version,
renderer and timing all differ.

Android Emulator 37.2.12.0 (build_id 16428233) ran an owned Pixel 9 Pro Fold
AVD copy headlessly under Xvfb in `podman run --memory=6g --cpus=2`,
with `-gpu host -feature -Vulkan -memory 4096 -cores 2`.
Startup reported:

```text
# Android Emulator startup diagnostic
ERROR        | Your GPU cannot be used for hardware rendering. Consider using software rendering.
INFO         | Graphics Adapter Android Emulator OpenGL ES Translator (llvmpipe (LLVM 20.1.2, 256 bits))
```

The guest booted and worked for about 16 minutes,
through 24 screenshot captures,
then the emulator crashed during scripted touch input.
The container's shell printed `Segmentation fault (core dumped)` and the
emulator command returned `139`.
`coredumpctl info` names the emitter and signal:

```text
# coredumpctl info 2301587
Executable: .../emulator/qemu/linux-x86_64/qemu-system-x86_64-headless
Signal: 11 (SEGV)
Stack trace of thread 229:
#0  0x00007fc75dd89adc n/a (/usr/lib/x86_64-linux-gnu/libc.so.6 + 0x19badc)
```

Only that frame was resolved,
so the faulting emulator code is not identified.
The owner log's last lines before the fault were repeated
`gles_v2_imp.cpp:... error null ctx` messages from the GL translator.
An earlier visit with the same command that completed normally logged the
same message,
so those lines do not distinguish the crash.
Host load averaged about 40 to 50 at the time;
no out-of-memory event was looked for.

The same container command completed whole visits before and after this
crash,
so it is intermittent on this host.
No workaround was verified;
the visit was repeated.
A crash leaves the guest's changed settings and the AVD's lock in place;
see [the lock recurrence](android-emulator-37-disposable-avd-lock-after-hard-stop.md).

### Second occurrence the same day

The same container command crashed again later on 2026-10-05,
about a quarter of an hour after its start,
after twelve first-run study states had been captured.
The emulator's output again ended with `Segmentation fault (core dumped)`
and the owner exited with status 1.
`coredumpctl list --since 19:00` reported `No coredumps found`,
so no stack was read this time.
The host's one-minute load average had risen from under 1 to between 70
and 96 during the visit,
driven by other work on the host.
That both crashes came under heavy load is an observation,
not an established cause.

The next boot's first reading of `font_scale` was `2.0`,
the value the capture had set before the crash,
so a crash leaves the last written guest setting on disk.
The remedy that was used is not a fix for the crash:
the capture now keeps each finished state in one cohort folder and a later
boot continues from the first missing state,
with each view naming the boot that made it.

### Third occurrence the same day

A third crash followed that evening,
a few minutes into a visit,
after five views of another study.
Three of those views had the system keyboard open,
which the earlier crashed visits never did.
The emulator's output again ended with `Segmentation fault (core dumped)`.
The host's load average was between 21 and 30 this time,
well under the earlier two,
so heavy load is not required for the crash.
Whether the keyboard matters is not known from one case.

After this one,
visits are repeated by a bounded driver until the cohort is complete:
at most eight visits,
each in the same 6 GiB,
2 CPU container,
stopping early if two visits in a row add no view.
After each crash it checks for owners and moves the stale locks to a backup,
as [the lock record](android-emulator-37-disposable-avd-lock-after-hard-stop.md)
prescribes.

### Fourth and fifth occurrences the same day

Two more visits under that driver ended the same way,
each with `Segmentation fault (core dumped)` as the emulator's last line:
one after 19 views,
with a load average near 27 read a few minutes after it,
and one after 18 views,
with a load average of 53 read a few minutes after it.
During the second of these,
the agent was also running a browser check in a separate 2 CPU container.
Between them,
one visit captured 32 views and shut down without a crash.

So on this host the crash came after 5,
19 and 18 views in three visits and not at all in a fourth of 32 views.
That is too few visits to say whether load,
the keyboard or the number of views decides it.
The driver's answer stays the same:
keep every finished view,
record the crash,
move the stale locks after the owner checks,
and boot again.

### A visit that was killed, not a segmentation fault

Later that night a visit ended differently.
After 59 views in about 25 minutes,
the emulator's guest process was `Killed` and its command returned `137`.
The output has no segmentation fault line.
`podman events` for that container reports its end and no out-of-memory event,
and the kernel log could not be read without privileges.
So the cause is not established:
the 6 GiB bound of the container is a candidate and nothing more.
The stale locks it left were moved the same way and the next visit booted.
It is counted here because it interrupts a capture exactly as the crash does,
and must not be reported as one.

### After a reboot of the host

On 2026-10-06,
after the host had been restarted,
the first visit of a new capture ended with `Segmentation fault (core dumped)` after 25 views.
The host's load average read about 35 to 60 during that hour,
from other work on the machine.
The next visit lost no view to a crash but ended when one guest command exceeded its 60 second bound,
and the third completed the cohort and shut down cleanly.
A fresh boot of the host therefore did not stop the crash.

## Verified workarounds

Use `-gpu host` for this Linux host.
This bypassed the packaged SwiftShader GLES worker and booted both the installed Pixel 9 Pro Fold AVD and a
disposable Pixel 9 AVD from the installed API 37 x86_64 system image.

Tradeoffs:

- Host rendering depends on a usable host GPU and driver stack.
- Results are less renderer-independent than SwiftShader software rendering.
- This does not prove every host or headless CI worker can expose host GPU rendering.
- Keep AVD state disposable with a temporary `ANDROID_AVD_HOME` or `-datadir`;
  `-gpu host` does not itself isolate emulator state.

## What does not work

- `-gpu off` does not avoid the failing software stack for this image.
  The emulator reported Lavapipe plus SwANGLE,
  and the coredump still ended in `gles_swiftshader/libGLESv2.so`.
- Disabling both cameras did not prevent the crash.
- `-no-snapshot` and a fresh `-wipe-data` directory did not prevent the crash.
- `-read-only` was not the cause.
  A writable disposable Pixel 9 AVD also crashed under SwiftShader.
- Changing from Pixel 9 Pro Fold to Pixel 9 did not prevent the software-renderer crash.
- Approving the emulator's network request in OpenSnitch did not prevent the software-renderer crash.
  A host-GPU boot had already succeeded before approval,
  and the software command still received `SIGSEGV` after approval.
- Lowering requested RAM did not help the Fold AVD.
  The emulator raised it to its 4096 MB minimum.
- Treating `pc_memory_init: above 4g size: 40000000` as the cause was rejected by a positive control:
  the successful host-GPU boot printed the same line.

## Upstream filing decision

No `.out-of-scope/` entry covers Android Emulator or SwiftShader.
Searches for
`Android Emulator 37.1.11 SwiftShader SIGSEGV Linux`,
`libGLESv2.so SIGSEGV SwiftShader Linux headless`,
and
`software renderer segmentation fault 37.1`
found no issue that matched this version,
stack,
and host-GPU workaround.

1. **Really upstream's fault:**
    not established.
   The crashing code is packaged with Android Emulator,
   but the exact 37.1.11 source revision and the role of Fedora 44's host stack are unknown.
2. **Upstream can fix it:**
    yes if the defect reproduces in Google's matching build environment.
   They can update SwiftShader or alter software-renderer selection.
3. **Supported use case:**
    yes.
   The emulator help advertises `-no-window` and `swiftshader_indirect`,
   and the release notes describe Linux software rendering.
4. **Contribution welcome:**
    bug reports are welcome.
   The [Android bug-report guide][report-bugs] requests emulator version,
   host CPU,
   device configuration,
   diagnostics,
   and reproduction steps.
   No AI-assistance ban was found in the public mirror's `README.md` or the reporting guide.
5. **Likely fix:**
    unknown.
   No matching tracker signal was found.
6. **Minimal fix prototyped:**
    no.
   The installed binary is stripped,
   public emulator source predates build `15917651`,
   and no source revision maps to the crashing packaged SwiftShader library.
   A source patch would therefore target an unverified candidate rather than this incident.

Decision:
do not file the draft as-is.
Constraint 1 is unresolved and constraint 6 cannot pass the candidate-fix applicability gate.
The verified consumer-side workaround is enough to complete local emulator testing.

### New-issue draft, do not file as-is

~~~md
Title: Android Emulator 37.1.11 SIGSEGV in packaged SwiftShader GLES during Linux headless API 37 boot

Component: Android Emulator

Android Emulator 37.1.11.0, build 15917651, crashes on Fedora 44 before boot completes when an API 37
x86_64 AVD is started headlessly with `-gpu swiftshader_indirect` or `-gpu off`.

Reproduction:

```bash
emulator -avd Issue460Pixel9 \
  -wipe-data -no-cache -no-snapshot -no-window -no-audio -no-boot-anim \
  -gpu swiftshader_indirect -camera-back none -camera-front none
```

Observed:

- `adb devices` reaches only `offline`.
- `qemu-system-x86_64-headless` exits on SIGSEGV.
- The crashing thread's top library frames are in
  `emulator/lib64/gles_swiftshader/libGLESv2.so`.

Expected:

- The emulator reaches `sys.boot_completed=1`.

Workaround:

- `-gpu host` boots the same disposable Pixel 9 AVD and API 37 image.

Please advise which symbols or diagnostic bundle are needed to map build 15917651's stripped SwiftShader stack.
~~~

[emulator-releases]: https://developer.android.com/studio/releases/emulator#37.1.11
[report-bugs]: https://developer.android.com/studio/report-bugs#emulator-bugs
