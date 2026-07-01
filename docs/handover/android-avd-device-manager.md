# Handover: IntelliJ IDEA Device Manager lost Android virtual devices

Last updated: 2026-07-01.

Purpose: continue investigating why IntelliJ IDEA's Android Device Manager stopped showing existing
Android Virtual Devices in the Monochromatic checkout.
Update this file after every new probe, workaround, or rejected hypothesis.

Suggested skills for the next session:

- `diagnose`, because this is an active external-tool failure.
- `troubleshooting-doc`, because the final diagnosed tool behavior needs a durable
  `docs/troubleshooting/<topic>.md` entry.
- `runbook` only if a future step genuinely needs the user to click through IDEA after CLI bridges fail.

## Current status

The AVD files are present and the real Android SDK can list them.
IntelliJ IDEA's project-level Device Manager still does not show them.
Editing `.idea/deviceManager.xml` did not help.

Most likely active hypothesis: IntelliJ IDEA imports the Android package but cannot build its Android model,
because `packages/music-player/android-app` uses AGP 9.2.1 and the current IDEA Android plugin reports latest
supported AGP 9.0.0.
A secondary hypothesis is stale custom Android plugin interference,
but the AGP compatibility error is now the strongest local evidence.

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
User checked Device Manager in the new `android-app` IDEA window.
Result: it still does not show the AVD.
This weakens the hypothesis that root monorepo project recognition alone is the cause.

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

Current leading hypothesis: IntelliJ IDEA 2026.2 EAP `IU-262.8377.35` imports `android-app`,
but Android model import fails because its bundled Android plugin only supports AGP through 9.0.0.
With no successful Android Gradle model,
Device Manager remains unable to surface the AVD even in the package project.

GUI automation was probed with `wmctrl` and `xdotool`, but no IDEA window was visible through X11
on this Wayland session.

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

3.  Decide how to test the AGP mismatch without changing the main worktree.
    Candidate probes:

    - Open the same package in Android Studio or a newer IDEA Android plugin build that supports AGP 9.2.1.
    - Create a disposable worktree and temporarily change only AGP from 9.2.1 to 9.0.0,
      then open that disposable package in IDEA and check whether Device Manager repopulates.

4.  Investigate whether the stale custom Android plugin directory is loaded or ignored.
    If evidence shows it is loaded, move it aside only with a safe backup path and document the exact change.

5.  Check IDEA settings for Android SDK Platform installation.
    Also check whether the Android SDK Updater pane reports a missing platform.
    JetBrains support ties IDEA-308876 to installing or updating Android SDK Platform.

6.  If AGP mismatch remains the explanation,
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
