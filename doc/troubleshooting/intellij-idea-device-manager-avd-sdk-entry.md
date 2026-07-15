# IntelliJ IDEA 2026.2 EAP Device Manager hides AVDs when its Android SDK table points at a missing platform

## Symptom

IntelliJ IDEA Ultimate 2026.2 EAP `IU-262.8377.35` opened the Android package,
but the Android Device Manager did not show the existing `Pixel_9_Pro_Fold` AVD.
The real Android SDK could still list it:

```sh
# doc/troubleshooting/intellij-idea-device-manager-avd-sdk-entry.md
/var/home/user/Android/Sdk/emulator/emulator -list-avds
/var/home/user/Android/Sdk/cmdline-tools/latest/bin/avdmanager list avd
```

The affected AVD was present under `~/.android/avd` and used Android 37.0:

```text
/var/home/user/.android/avd/Pixel_9_Pro_Fold.ini
/var/home/user/.android/avd/Pixel_9_Pro_Fold.avd/config.ini
/var/home/user/.android/avd/Pixel_9_Pro_Fold.avd/hardware-qemu.ini
target=android-37.0
image.sysdir.1=system-images/android-37.0/google_apis_playstore_ps16k/x86_64/
hw.device.name=pixel_9_pro_fold
```

A separate Android Gradle sync failure was also present:

```text
The project is using an incompatible version (AGP 9.2.1) of the Android Gradle plugin.
Latest supported version is AGP 9.0.0
```

That AGP mismatch breaks Android project model import,
but it was not the final cause of Device Manager's local AVD inventory being empty.
After the IntelliJ global Android SDK table was corrected,
the user confirmed the AVD appeared.

## Root cause

Device Manager's local emulator list depends on IntelliJ's selected Android SDK,
not only on `android.sdk.path.xml` or the SDK used by the command line.

Current installed IDEA bytecode showed `DeviceManager2ToolWindowFactory` creates a `DeviceManagerPanel`,
which gets `DeviceProvisionerService` from the project.
`LocalEmulatorProvisionerFactory` is enabled and asks `AvdManagerConnection` for AVDs.
The open-source Android plugin path has the same SDK selection shape.
In `android/src/com/android/tools/idea/avdmanager/AvdManagerConnection.java:184` to `188`,
the default AVD connection asks `AndroidSdks` for a handler.
It returns a null connection if that handler has no location:

```java
// android/src/com/android/tools/idea/avdmanager/AvdManagerConnection.java
@NotNull
public static AvdManagerConnection getDefaultAvdManagerConnection() {
  AndroidSdkHandler handler = AndroidSdks.getInstance().tryToChooseSdkHandler();
  if (handler.getLocation() == null) {
    return NULL_CONNECTION;
  }
  return getAvdManagerConnection(handler);
}
```

In `android/src/org/jetbrains/android/sdk/AndroidSdkUtils.java:831` to `847`,
IntelliJ first uses the saved Android Studio SDK path only when running as Android Studio.
Otherwise it scans existing Android SDK entries:

```java
// android/src/org/jetbrains/android/sdk/AndroidSdkUtils.java
@Nullable
public static AndroidSdkData tryToChooseAndroidSdk() {
  if (ourSdkData == null) {
    if (isAndroidStudio()) {
      File path = IdeSdks.getAndroidSdkPath();
      if (path != null) {
        ourSdkData = getSdkData(path.getPath());
        if (ourSdkData != null) {
          return ourSdkData;
        }
      }
    }

    for (String s : getAndroidSdkPathsFromExistingPlatforms()) {
      ourSdkData = getSdkData(s);
      if (ourSdkData != null) {
        break;
      }
    }
  }
  return ourSdkData;
}
```

In `android/src/org/jetbrains/android/sdk/AndroidSdkUtils.java:431` to `447`,
those existing SDK paths come from Android SDK entries in the project JDK table:

```java
// android/src/org/jetbrains/android/sdk/AndroidSdkUtils.java
@NotNull
public static Collection<String> getAndroidSdkPathsFromExistingPlatforms() {
  List<String> result = Lists.newArrayList();
  for (Sdk androidSdk : getAllAndroidSdks()) {
    AndroidPlatform androidPlatform = AndroidPlatform.getInstance(androidSdk);
    if (androidPlatform != null) {
      // Put default platforms in the list before non-default ones so they'll be looked at first.
      String sdkPath = toSystemIndependentName(androidPlatform.getSdkData().getLocation().getPath());
      if (result.contains(sdkPath)) continue;
      if (androidSdk.getName().startsWith(SDK_NAME_PREFIX)) {
        result.add(0, sdkPath);
      }
      else {
        result.add(sdkPath);
      }
    }
  }
  return result;
}
```

In `android/src/org/jetbrains/android/sdk/AndroidSdkUtils.java:451` to `453`,
the Android SDK entries are read from `ProjectJdkTable`:

```java
// android/src/org/jetbrains/android/sdk/AndroidSdkUtils.java
@NotNull
public static List<Sdk> getAllAndroidSdks() {
  List<Sdk> allSdks = ProjectJdkTable.getInstance().getSdksOfType(AndroidSdkType.getInstance());
  return allSdks != null ? allSdks : Collections.<Sdk>emptyList();
}
```

The local `ProjectJdkTable` file was stale.
`/var/home/user/.config/JetBrains/IntelliJIdea2026.2/options/jdk.table.xml` had an Android SDK entry rooted at
`/var/home/user/Android/Sdk`,
but the class roots and additional data pointed at a missing API 36 platform:

```xml
<!-- /var/home/user/.config/JetBrains/IntelliJIdea2026.2/options/jdk.table.xml -->
<name value="Android API 36.0, extension level 17 Platform" />
<homePath value="/var/home/user/Android/Sdk" />
<root url="jar:///var/home/user/Android/Sdk/platforms/android-36/android.jar!/" type="simple" />
<root url="file:///var/home/user/Android/Sdk/sources/android-36" type="simple" />
<additional sdk="android-36" />
```

The SDK itself had no API 36 platform installed:

```text
missing /var/home/user/Android/Sdk/platforms/android-36
missing /var/home/user/Android/Sdk/sources/android-36
exists /var/home/user/Android/Sdk/platforms/android-37.0
```

That stale SDK table entry explains why the CLI SDK could see the AVD while IntelliJ Device Manager could not.
The CLI was given `/var/home/user/Android/Sdk` directly.
IntelliJ Device Manager had to choose an SDK through its global Android SDK table,
whose only Android platform entry referred to files that no longer existed.

Earlier hypotheses that were disproved or downgraded:

- `.idea/deviceManager.xml` was not an inventory source.
  Source inspection showed it stores table UI state such as grouping,
  sorters,
  and collapsed nodes.
- The wrong-OS Android plugin directory was unlikely to be loaded.
  `lsof -p <idea-pid>` showed Android plugin jars mapped from
  `/var/home/user/.local/share/JetBrains/IntelliJIdea2026.2/android`,
  not `/var/home/user/.config/JetBrains/IntelliJIdea2026.2/plugins/android`.
- AGP 9.2.1 incompatibility was real,
  but after the SDK table fix the AVD appeared even though the AGP warning remained.

## Verification

Version under test:

```text
IntelliJ IDEA Ultimate 2026.2 EAP IU-262.8377.35
Android plugin 262.8377.35-linux-x86_64
Real Android SDK /var/home/user/Android/Sdk
AVD Pixel_9_Pro_Fold
```

Failing catalog:

```sh
# doc/troubleshooting/intellij-idea-device-manager-avd-sdk-entry.md
grep --line-number --fixed-strings \
  -e 'Android API 36' \
  -e 'android-36' \
  /var/home/user/.config/JetBrains/IntelliJIdea2026.2/options/jdk.table.xml

for p in \
  /var/home/user/Android/Sdk/platforms/android-36 \
  /var/home/user/Android/Sdk/sources/android-36 \
  /var/home/user/Android/Sdk/platforms/android-37.0; do
  if [ -e "$p" ]; then
    echo "exists $p"
  else
    echo "missing $p"
  fi
done
```

Failing evidence:

```text
<name value="Android API 36.0, extension level 17 Platform" />
<additional sdk="android-36" />
missing /var/home/user/Android/Sdk/platforms/android-36
missing /var/home/user/Android/Sdk/sources/android-36
exists /var/home/user/Android/Sdk/platforms/android-37.0
```

Working catalog after the fix:

```sh
# doc/troubleshooting/intellij-idea-device-manager-avd-sdk-entry.md
python3 - <<'PY'
import xml.etree.ElementTree as ET
ET.parse('/var/home/user/.config/JetBrains/IntelliJIdea2026.2/options/jdk.table.xml')
print('xml-ok')
PY

grep --line-number --fixed-strings \
  -e 'Android API 37.0 Platform' \
  -e 'android-37.0' \
  -e 'android-36' \
  /var/home/user/.config/JetBrains/IntelliJIdea2026.2/options/jdk.table.xml

for p in \
  /var/home/user/Android/Sdk/platforms/android-37.0/android.jar \
  /var/home/user/Android/Sdk/platforms/android-37.0/data/annotations.zip \
  /var/home/user/Android/Sdk/platforms/android-37.0/data/res \
  /var/home/user/Android/Sdk/sources/android-37.0; do
  test -e "$p" && echo "ok $p"
done
```

Working evidence:

```text
xml-ok
Android API 37.0 Platform
additional sdk="android-37.0"
ok /var/home/user/Android/Sdk/platforms/android-37.0/android.jar
ok /var/home/user/Android/Sdk/platforms/android-37.0/data/annotations.zip
ok /var/home/user/Android/Sdk/platforms/android-37.0/data/res
ok /var/home/user/Android/Sdk/sources/android-37.0
```

End-to-end result:

- IDEA was closed before editing `jdk.table.xml`.
- The global Android SDK entry was updated from `android-36` paths to installed `android-37.0` paths.
- IDEA was reopened on `packages/music-player/android-app`.
- The user confirmed `Pixel_9_Pro_Fold` appeared in Device Manager.

## Verified workarounds

### Update IntelliJ's global Android SDK table while IDEA is closed

Back up the file first:

```sh
# doc/troubleshooting/intellij-idea-device-manager-avd-sdk-entry.md
cp --preserve=mode,timestamps \
  /var/home/user/.config/JetBrains/IntelliJIdea2026.2/options/jdk.table.xml \
  /var/home/user/.config/JetBrains/IntelliJIdea2026.2/options/jdk.table.xml.before-android-37-update-20260701
```

Then update the Android SDK entry so its name,
classpath roots,
source root,
and `<additional sdk="..." />` reference an installed platform:

```xml
<!-- /var/home/user/.config/JetBrains/IntelliJIdea2026.2/options/jdk.table.xml -->
<name value="Android API 37.0 Platform" />
<homePath value="/var/home/user/Android/Sdk" />
<root url="jar:///var/home/user/Android/Sdk/platforms/android-37.0/android.jar!/" type="simple" />
<root url="file:///var/home/user/Android/Sdk/platforms/android-37.0/data/res" type="simple" />
<root url="file:///var/home/user/Android/Sdk/sources/android-37.0" type="simple" />
<additional sdk="android-37.0" />
```

Tradeoffs:

- This is a global IDE configuration edit,
  not a project file edit.
- Close IDEA first so it does not overwrite the file on shutdown.
- Keep the backup until IDEA has reopened and Device Manager has been checked.

### Install the missing platform instead

If preserving the existing IntelliJ SDK table entry is preferable,
install the exact platform it references:

```sh
# doc/troubleshooting/intellij-idea-device-manager-avd-sdk-entry.md
/var/home/user/Android/Sdk/cmdline-tools/latest/bin/sdkmanager \
  --sdk_root=/var/home/user/Android/Sdk \
  'platforms;android-36'
```

Tradeoffs:

- This avoids editing IDE config.
- It adds an SDK platform that the project may not otherwise need.
- It should still be followed by reopening IDEA and checking Device Manager.

## What does not work

Resetting `.idea/deviceManager.xml` did not restore the AVD.
That file stores table UI state,
not the AVD inventory.

Using the mise Android SDK for AVD validation is misleading here.
The mise SDK at `/home/user/.local/share/mise/installs/android-sdk/13.0` lacks the emulator and has older
device profiles.
Its `avdmanager` reported:

```text
Google pixel_9_pro_fold no longer exists as a device
```

Updating the Android plugin was not a safe workaround.
The user verified the plugin was current,
and this install had already seen auto-update choose a wrong-platform Android plugin build.

Downgrading AGP may help Android project sync,
but it was not needed for Device Manager inventory once the IntelliJ SDK table was corrected.
AGP 9.2.1 still exceeds this IDEA Android plugin's supported AGP 9.0.0,
so Android model import remains a separate compatibility problem.

## Upstream filing decision

`.out-of-scope/` was checked.
No entry matched IntelliJ IDEA Android Device Manager,
Android SDK table state,
or AVD inventory.

Duplicate search found related public leads,
including JetBrains `IDEA-308876` about disabled Device Manager and support guidance to install or update Android
SDK Platform.
This case adds a local detail:
IntelliJ's global SDK table can reference a missing platform even when the SDK root and CLI tools are correct.
No upstream filing is planned now because the confirmed failure was local stale IDE configuration.

Six-constraint check:

- Is it really upstream's fault?
  No.
  IntelliJ had a stale global SDK entry pointing at a platform no longer installed locally.
- Can upstream fix it?
  Partially.
  IntelliJ could surface a better warning,
  but the immediate recovery is local configuration repair.
- Are they supporting this use case?
  Yes.
  Device Manager and Android SDK Platform management are supported IntelliJ Android plugin features.
- Would the repo welcome our contribution?
  Not evaluated beyond public issue search,
  because constraint one fails.
- Will they likely fix it?
  Not evaluated,
  because constraint one fails.
- Have we prototyped a minimal fix compatible with their architecture?
  No.
  A prototype is not appropriate because the confirmed fix is local configuration repair,
  not an upstream source change.

Upstream filing artifact:

```md
Do not file as-is.

The local issue was resolved by updating IntelliJ IDEA's global Android SDK entry from a missing
android-36 platform to the installed android-37.0 platform. Existing public guidance already points
users toward SDK Platform installation or update for Device Manager failures. This report would not
add an upstream source defect without a separate reproduction showing IntelliJ fails to warn when its
SDK table references a removed platform.
```
