# Handover: IntelliJ IDEA Device Manager lost Android virtual devices

Last updated: 2026-07-01.

Purpose: continue investigating why IntelliJ IDEA's Android Device Manager stopped showing existing
Android Virtual Devices in the Monochromatic checkout.
Update this file after every new probe, workaround, or rejected hypothesis.

Suggested skills for the next session:

- `diagnose`, because this is an active external-tool failure.
- `troubleshooting-doc`, because the final diagnosed tool behavior needs a durable
  `doc/troubleshooting/<topic>.md` entry.
- `runbook` only if a future step genuinely needs the user to click through IDEA after CLI bridges fail.

## Current status

The AVD files are present and the real Android SDK can list them.
The user confirmed IntelliJ IDEA's Device Manager now shows `Pixel_9_Pro_Fold`
after the global IntelliJ Android SDK entry was updated from missing Android API 36 paths
to installed Android 37.0 paths.
Editing `.idea/deviceManager.xml` did not help and was not part of the final fix.

AGP incompatibility is a verified Android sync failure,
because `packages/music-player/android-app` uses AGP 9.2.1 and the current IDEA Android plugin reports latest
supported AGP 9.0.0.
That likely explains missing Android model, Android facets, or run-target behavior tied to this project.
It is no longer proven as the sole explanation for an empty Device Manager inventory:
source inspection shows Device Manager's local emulator provider should read AVDs through the SDK-backed
`AvdManagerConnection`, and a scratch probe using IDEA's own Android plugin jars can list the real AVD as valid.
The stale custom Android plugin is now unlikely to be loaded.
`lsof` on the live IDEA process shows Android plugin jars mapped from the current Linux plugin under
`/var/home/user/.local/share/JetBrains/IntelliJIdea2026.2/android`,
and no mapped files under `/var/home/user/.config/JetBrains/IntelliJIdea2026.2/plugins/android`.
A stronger root-cause candidate is now the stale global IntelliJ Android SDK entry:
`jdk.table.xml` pointed IDEA at Android API 36 under `/var/home/user/Android/Sdk/platforms/android-36`,
but this SDK currently has only Android 37.0 and Android CANARY platforms installed.
For IntelliJ IDEA, `AndroidSdksImpl.tryToChooseAndroidSdk()` does not use the saved Android Studio SDK path first;
it falls back to Android SDK entries from `ProjectJdkTable`.
If the only Android SDK entry points at a missing platform,
`AvdManagerConnection.getDefaultAvdManagerConnection()` can end up with no SDK handler even though
`android.sdk.path.xml` and ADB use the real SDK path.

The user closed IDEA and chose to update the SDK entry rather than install Android API 36.
The global IntelliJ SDK table was updated to Android API 37.0,
with a backup saved beside it:

```text
/var/home/user/.config/JetBrains/IntelliJIdea2026.2/options/jdk.table.xml.before-android-37-update-20260701
```

Verification after editing:

```text
xml-ok
Android API 37.0 Platform
additional sdk="android-37.0"
all referenced android-37.0 files exist
no android-36 references remain in jdk.table.xml
```

The user reopened IDEA and confirmed the AVD appeared.
Durable troubleshooting doc:
`doc/troubleshooting/intellij-idea-device-manager-avd-sdk-entry.md`.

Do not use IDEA's Android plugin auto-update as a workaround:
the user already checked the plugin is current,
and auto-update can select a Mac or Windows Android plugin build that does not load here.

## Verified local facts

AVD data is intact:

```sh
# Existing files
/var/home/user/.android/avd/Pixel_9_Pro_Fold.ini
/var/home/user/.android/avd/Pixel_9_Pro_Fold.avd/config.ini
/var/home/user/.android/avd/Pixel_9_Pro_Fold.avd/hardware-qemu.ini
```

The AVD targets Android 37.0 with `google_apis_playstore_ps16k/x86_64`
and device id `pixel_9_pro_fold`.

The real SDK sees the AVD:

```sh
/var/home/user/Android/Sdk/emulator/emulator -list-avds
/var/home/user/Android/Sdk/cmdline-tools/latest/bin/avdmanager list avd
```

The mise-provisioned SDK does not see it correctly:

```sh
ANDROID_HOME=/home/user/.local/share/mise/installs/android-sdk/13.0
ANDROID_SDK_ROOT=/home/user/.local/share/mise/installs/android-sdk/13.0
```

That older `avdmanager` reports:

```text
Google pixel_9_pro_fold no longer exists as a device
```

The real SDK's cmdline-tools 21 has Pixel 9 device profiles.
The mise cmdline-tools 13 install has fewer device profiles and lacks Pixel 9 profiles.
This matches the public `avdmanager` forward-compatibility failure described in
<https://github.com/beeware/briefcase/issues/1688>.

The real SDK has the AVD's required platform and image installed:

```text
platforms;android-37.0
system-images;android-37.0;google_apis_playstore_ps16k;x86_64
```

IDEA saved SDK path is correct:

```sh
/var/home/user/.config/JetBrains/IntelliJIdea2026.2/options/android.sdk.path.xml
```

It points at `$USER_HOME$/Android/Sdk`.
IDEA logs show ADB initialized from:

```sh
/home/user/Android/Sdk/platform-tools/adb
```

`/home/user` and `/var/home/user` resolve to the same home on this machine.

IntelliJ's global SDK table was stale before the manual update:

```xml
<name value="Android API 36.0, extension level 17 Platform" />
<homePath value="/var/home/user/Android/Sdk" />
<root url="jar:///var/home/user/Android/Sdk/platforms/android-36/android.jar!/" />
<additional sdk="android-36" />
```

The real SDK no longer had that platform directory:

```text
missing /var/home/user/Android/Sdk/platforms/android-36
missing /var/home/user/Android/Sdk/sources/android-36
exists /var/home/user/Android/Sdk/platforms/android-37.0
```

`/var/home/user/Android/Sdk/cmdline-tools/latest/bin/sdkmanager --list` showed `platforms;android-36`
was available to reinstall,
but the user chose to update IntelliJ's SDK entry instead.
The entry now points at installed Android 37.0 paths.

IDEA logs show the emulator previously launched from IDEA on 2026-06-14,
2026-06-25, and 2026-06-28.
Those launches used:

```sh
/var/home/user/Android/Sdk/emulator/emulator \
  -netdelay none \
  -netspeed full \
  -avd Pixel_9_Pro_Fold \
  -qt-hide-window \
  -grpc-use-token \
  -idle-grpc-timeout 300
```

The current IDEA build is:

```text
IntelliJ IDEA 2026.2 EAP IU-262.8377.35
```

Two Android plugin locations were found:

```sh
# Stale custom plugin, wrong platform and older compatibility window
/var/home/user/.config/JetBrains/IntelliJIdea2026.2/plugins/android
version: 262.8117.19-windows-x86_64
compatible only with 262.8117.*

# Current Linux plugin
/var/home/user/.local/share/JetBrains/IntelliJIdea2026.2/android
version: 262.8377.35-linux-x86_64
```

The live IDEA process maps Android plugin jars from the current Linux plugin path:

```text
/var/home/user/.local/share/JetBrains/IntelliJIdea2026.2/android/lib/android.jar
/var/home/user/.local/share/JetBrains/IntelliJIdea2026.2/android/lib/ffmpeg-linux-x64-6.0-1.5.9.jar
/var/home/user/.local/share/JetBrains/IntelliJIdea2026.2/android/lib/javacpp-linux-x64-1.5.9.jar
```

`lsof -p <idea-pid>` showed no mapped files under:

```text
/var/home/user/.config/JetBrains/IntelliJIdea2026.2/plugins/android
```

That makes the stale wrong-OS plugin directory unlikely to be the currently loaded Android plugin.

The opened Monochromatic project currently has no Android facet in the checked `.idea` module files:

```sh
.idea/modules.xml
.idea/monochromatic2024DEC18.iml
```

`.idea/monochromatic2024DEC18.iml` is a `WEB_MODULE`.
No imported Android Gradle module was found in the checked project files.

## External precedent found so far

This is not unique.
Search results and support threads repeatedly point at Android project recognition,
SDK setup, or platform update state as gates for Device Manager visibility.

Relevant public leads:

- [Stack Overflow AVD missing][so-avd-missing] says the Android SDK or AVD manager can depend on opening
  the Android Gradle project as an Android project.
- [JetBrains support 6898947564562][jb-support-window] includes JetBrains staff saying AVD Manager does not
  show without an Android facet.
- [IDEA-299045][idea-299045] is titled around AVD Manager only being available in Android projects after
  IDEA 2022.2.
- [IDEA-308876][idea-308876] is titled around IntelliJ Android Device Manager being disabled.
- JetBrains support for IDEA-308876 says to install or update Android SDK Platform when Device Manager is disabled.
- Android emulator docs say IDEA's `-qt-hide-window -grpc-use-token -idle-grpc-timeout 300` flags are for the
  emulator window inside Android Studio or IntelliJ, not a standalone CLI viewer.

## Attempts and outcomes

Reset `.idea/deviceManager.xml` to the repository baseline.
Result: no visible improvement.

Opened the Android package root as a separate IDEA project after user approval:

```sh
/var/home/user/.local/share/JetBrains/Toolbox/scripts/idea \
  /var/home/user/Monochromatic/packages/music-player/android-app
```

`idea.log` then showed a new `Project(name=android-app, ...)`,
project root `/var/home/user/Monochromatic/packages/music-player/android-app`,
ADB status retrieval from the Android plugin, and Gradle project sync updates for that path.
User checked Device Manager in the new `android-app` IDEA window before the SDK table fix.
Result then: it still did not show the AVD.
This weakened the hypothesis that root monorepo project recognition alone was the cause.

Immediately after that check, `idea.log` showed a stronger cause:

```text
The project is using an incompatible version (AGP 9.2.1) of the Android Gradle plugin.
Latest supported version is AGP 9.0.0
```

The package declares AGP 9.2.1 here:

```kotlin
// packages/music-player/android-app/build.gradle.kts
plugins {
    id("com.android.application") version "9.2.1" apply false
}
```

AGP mismatch remains a real problem:
IntelliJ IDEA 2026.2 EAP `IU-262.8377.35` imports `android-app`,
but Android model import fails because its bundled Android plugin only supports AGP through 9.0.0.
With no successful Android Gradle model,
project features that depend on the Android model should be expected to fail.

However, source and SDK probes now weaken AGP mismatch as the sole Device Manager inventory cause.
`DeviceManager2ToolWindowFactory` constructs `DeviceManagerPanel` unconditionally.
`DeviceManagerPanel` gets `DeviceProvisionerService` from the project.
`DeviceProvisionerService` creates provisioners from extension point
`com.android.tools.idea.deviceProvisioner`.
`LocalEmulatorProvisionerFactory` is always enabled and calls:

```kotlin
AvdManagerConnection.getDefaultAvdManagerConnection().getAvds(true)
```

`AvdManagerConnection` chooses an SDK via `AndroidSdks.getInstance().tryToChooseSdkHandler()`.
For IntelliJ IDEA, `AndroidSdksImpl` falls back to existing Android SDK entries in `jdk.table.xml`.
This install has an Android SDK entry rooted at `/var/home/user/Android/Sdk`.

A scratch Java probe compiled against IDEA's Android plugin jars and Toolbox app jars used:

```text
AndroidSdkHandler(/var/home/user/Android/Sdk, ~/.android)
DeviceManager.createInstance(handler, logger)
AvdManager.createInstance(handler, ~/.android/avd, deviceManager, logger)
manager.reloadAvds()
```

It returned:

```text
all=1
valid=1
AVD name=Pixel_9_Pro_Fold
status=OK
target=android-37.0
image=system-images/android-37.0/google_apis_playstore_ps16k/x86_64/
device=Google pixel_9_pro_fold
version=API 37.0
abi=x86_64
```

The probe emitted only this compatibility warning:

```text
This version only understands SDK XML versions up to 3 but an SDK XML file of version 4 was encountered.
```

That warning did not prevent the bundled sdklib from listing the AVD.
The probe bypassed IntelliJ's `AndroidSdksImpl` selection path by providing the SDK root directly.
The stale `jdk.table.xml` Android API 36 entry can still break the actual IDE path that chooses an SDK handler.
The next investigation should therefore distinguish two surfaces:

- the Device Manager tool window inventory, which source suggests should list the AVD independently of Gradle sync;
- Android run target selection or Android project features, which the AGP 9.2.1 compatibility failure can break.

GUI automation was probed with `wmctrl` and `xdotool`, but no IDEA window was visible through X11
on this Wayland session.

Do not update the Android plugin during this investigation.
The user checked that the Android plugin is already the latest available version.
The user also reported that IDEA's plugin auto-update path can select a Mac or Windows Android plugin build,
which does not load on this Linux install.
One attempted `idea update org.jetbrains.android` command made no change,
because IDEA refused to run it while an IDEA instance was already active.

Source check of the Android plugin showed why this was unlikely to fix AVD inventory:

```sh
javap -classpath /var/home/user/.local/share/JetBrains/IntelliJIdea2026.2/android/lib/android.jar \
  -c -p com.android.tools.idea.devicemanagerv2.DeviceTablePersistentStateComponent

javap -classpath /var/home/user/.local/share/JetBrains/IntelliJIdea2026.2/android/lib/adt-ui.jar:\
/var/home/user/.local/share/JetBrains/IntelliJIdea2026.2/android/lib/android.jar \
  -c -p com.android.tools.adtui.categorytable.CategoryTableState
```

The persisted state only contains table UI state:

- `groupByAttributes`
- `columnSorters`
- `collapsedNodes`

It does not contain the virtual-device inventory.

Standalone CLI launch works but the native emulator window glitches with host GPU rendering:

```sh
ANDROID_HOME=/var/home/user/Android/Sdk \
ANDROID_SDK_ROOT=/var/home/user/Android/Sdk \
/var/home/user/Android/Sdk/emulator/emulator -avd Pixel_9_Pro_Fold
```

The log selects AMD RADV host Vulkan and `gfxstream`.
IDEA's earlier launch hid the native Qt window and used the embedded JetBrains `EmulatorView` over gRPC,
which is a different display path.

CLI workaround for standalone display:

```sh
QT_QPA_PLATFORM=xcb \
ANDROID_HOME=/var/home/user/Android/Sdk \
ANDROID_SDK_ROOT=/var/home/user/Android/Sdk \
/var/home/user/Android/Sdk/emulator/emulator @Pixel_9_Pro_Fold \
  -gpu swiftshader \
  -no-snapshot-load
```

## Things not to chase without new evidence

Do not treat `~/.android/avd` as missing.
It is present.

Do not treat `/home/user` versus `/var/home/user` as the cause.
They resolve to the same home.

Do not expect `.idea/deviceManager.xml` to restore devices by adding entries.
The plugin stores only Device Manager table UI state there.

Do not use the mise Android SDK to validate AVD visibility.
It is older, lacks the relevant Pixel 9 device profile, and lacks `emulator`.
Use `/var/home/user/Android/Sdk` for AVD commands.

Do not run destructive AVD cleanup on the real AVD as a test.
If data wipe or recreation is needed, use a disposable AVD or ask first.

## Next investigation steps

1.  Check current IDEA logs immediately after opening Device Manager.
    Look for `DeviceManager2`, `AvdManagerConnection`, `DeviceProvisioner`,
    `Android.DeviceManager`, `AndroidFacet`, and Android SDK warnings.

2.  Confirm whether IDEA currently sees any Android facet or imported Android Gradle project.
    Search workspace model caches and `.idea` files for Android module entities,
    Android Gradle paths, or facet entries.

3.  Clarify the user-visible surface.
    If the empty list is the Device Manager tool window,
    focus on runtime provider/UI state in IDEA.
    If the empty list is the run target selector,
    the AGP 9.2.1 sync failure remains a strong explanation.

4.  If still testing AGP mismatch,
    do it without changing the main worktree.
    Candidate probes:

    - Open the same package in Android Studio Quail 1 or newer,
      because Android Studio's published compatibility table supports AGP 9.2.
    - Create a disposable worktree or fixture with an IDEA-supported Android model,
      then open that disposable project in IDEA and check whether the affected surface repopulates.

5.  Treat stale custom Android plugin interference as unlikely unless new evidence appears.
    The live process maps the current Linux plugin jars from `.local/share`,
    and no files from the stale `.config/.../plugins/android` directory.
    If future evidence shows that stale directory is loaded after restart,
    move it aside only with a safe backup path and document the exact change.

6.  No further Device Manager inventory recovery is needed unless the AVD disappears again.
    The confirmed fix was updating the global IntelliJ Android SDK table entry to installed Android 37.0 paths.

7.  If Android project model features are still needed in this IDEA build,
    prepare a JetBrains issue bundle or local workaround note:

    - IDEA build number
    - Android plugin versions and paths
    - sanitized `idea.log` excerpt
    - `emulator -list-avds` output from `/var/home/user/Android/Sdk`
    - proof that root project has no Android facet but package project does or does not

## Useful commands

List AVDs through the real SDK:

```sh
/var/home/user/Android/Sdk/emulator/emulator -list-avds
/var/home/user/Android/Sdk/cmdline-tools/latest/bin/avdmanager list avd
```

Search IDEA logs:

```sh
rg --line-number --ignore-case \
  'DeviceManager2|Device Manager|AvdManagerConnection|DeviceProvisioner|AndroidFacet|emulator|Pixel_9_Pro_Fold' \
  /var/home/user/.cache/JetBrains/IntelliJIdea2026.2/log/idea*.log
```

Check the real SDK path IDEA saved:

```sh
cat /var/home/user/.config/JetBrains/IntelliJIdea2026.2/options/android.sdk.path.xml
```

Check whether the root project has Android facet metadata:

```sh
rg --line-number --ignore-case \
  'android|facet|gradle' \
  .idea modules.xml packages/music-player/android-app
```

Launch standalone emulator with software rendering:

```sh
QT_QPA_PLATFORM=xcb \
ANDROID_HOME=/var/home/user/Android/Sdk \
ANDROID_SDK_ROOT=/var/home/user/Android/Sdk \
/var/home/user/Android/Sdk/emulator/emulator @Pixel_9_Pro_Fold \
  -gpu swiftshader \
  -no-snapshot-load
```

[so-avd-missing]: https://stackoverflow.com/q/37850250
[jb-support-window]: https://intellij-support.jetbrains.com/hc/en-us/community/posts/6898947564562
[idea-299045]: https://youtrack.jetbrains.com/issue/IDEA-299045
[idea-308876]: https://youtrack.jetbrains.com/issue/IDEA-308876
