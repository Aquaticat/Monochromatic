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

The music-player APK and test APK installed on that emulator.
The real Android instrumentation runner then executed the migration suite:

```text
dev.monochromatic.musicplayer.SessionStoreTest:..

Time: 0.008

OK (2 tests)
```

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
