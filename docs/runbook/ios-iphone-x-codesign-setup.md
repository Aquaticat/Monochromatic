# iPhone X code-signing for the iOS framework vet

How development builds are signed and run on the owner's iPhone X over SSH, with no macOS login
password stored anywhere, and how the 7-day free-team profile auto-renews. This is written to be
reproducible from zero: a fresh Mac and a person who has never done this. Everyday use is the reusable
pattern; the full procedure rebuilds it from nothing.

The build is driven from a separate Linux host that reaches the Mac through the ssh alias `m1`. On an
all-Mac setup, run the lines marked "Linux host" directly on the Mac and drop the `ssh m1` wrapper.

## What this proves

Verified end to end on 2026-06-12: a signed build over SSH installs and launches on the iPhone X
(`iPhone10,3`, iOS 16.7.16, build 20H392), with the DeveloperDiskImage mounting and the app running.
Identity: `Apple Development: little.plan2433@fastmail.com`, team `HWLVAKDV4F`. These exact values are
this instance; a fresh Mac or Apple ID produces its own, and the procedure shows how to read each one.

## Current state

Status: DONE

Permanent artifacts on this instance, all surviving reboot:

- Mac, signing: `~/ios-vet/vet.keychain-db`, a dedicated keychain holding the Apple Development
  identity (certificate valid to 2027-06-12, plus its private key). It is the only signing secret on
  the Mac and is encrypted; its unlock password is not stored on the Mac.
- Linux host (this repo): the keychain's unlock password lives only in `.env.local` (git-ignored) as
  `XCODE_IDENTITY_SSH_USABLE`, a throwaway protecting the revocable signing key, never the login
  password.
- Mac, device support: `~/Library/Developer/Xcode/iOS DeviceSupport/16.7*` symlinked to Xcode's bundled
  16.4 `DeveloperDiskImage.dmg`, verified mounting on the 16.7.16 device.
- Mac, tools: `ios-deploy`, `libimobiledevice`, `ideviceinstaller`, `xcodegen` (Homebrew).
- Mac, profile: `~/Library/Developer/Xcode/UserData/Provisioning Profiles/*.mobileprovision` for app id
  `dev.monochromatic.iosvet.hellodevice`, scoped to the device. Free-team profiles last 7 days; see
  auto-renew below.
- Mac, auto-renew: `~/Library/LaunchAgents/dev.monochromatic.iosvet.profilerenew.plist`.
- Device: Developer Mode on, this Mac trusted, the Apple Development certificate trusted
  (**Settings ▸ General ▸ Device Management**).

## Build and run any vet app

Status: DONE

From the repo root on the Linux host. Reuse the bundle id `dev.monochromatic.iosvet.hellodevice` so the
existing profile and identity sign with no new provisioning. Set `UDID` to the value from
`idevice_id -l`:

```sh
UDID=9057e2a8c2e70162e35b9ea8bf006f736670877b
PW="$(grep -E '^(export[[:space:]]+)?XCODE_IDENTITY_SSH_USABLE=' .env.local \
  | head -1 | sed -E 's/^[^=]*=//; s/^["'\'']//; s/["'\'']$//' | tr -d '\r\n')"
printf '%s' "$PW" | ssh m1 "set -e
  PW=\$(cat)
  export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
  KC=\$HOME/ios-vet/vet.keychain-db; LOGIN=\$HOME/Library/Keychains/login.keychain-db
  security unlock-keychain -p \"\$PW\" \"\$KC\"
  security list-keychains -d user -s \"\$KC\" \"\$LOGIN\" >/dev/null
  cd <APP_DIR> && rm -rf build
  xcodebuild -project <APP>.xcodeproj -scheme <SCHEME> \
    -destination 'platform=iOS,id=$UDID' -configuration Debug -derivedDataPath build \
    OTHER_CODE_SIGN_FLAGS=\"--keychain \$KC\" build
  ios-deploy --id $UDID --bundle build/Build/Products/Debug-iphoneos/<APP>.app --justlaunch --no-wifi
  security list-keychains -d user -s \"\$LOGIN\" >/dev/null"
```

Each build reads the throwaway from `.env.local`, pipes it over the encrypted SSH channel (never a
command argument, never echoed), unlocks the vet keychain for that session, adds it to the codesign
search list so xcodebuild can resolve the identity (the `--keychain` flag alone satisfies only the
codesign step, not identity resolution), signs, installs and launches, then resets the search list to
login-only. The reset keeps the locked vet keychain out of the idle search list, which is what would
otherwise make the daily GUI renewal prompt for the throwaway. No GUI **Cmd+R**, no per-build owner
action.

## Auto-renew of the 7-day profile

Status: DONE

Facts: the signing certificate is valid one year; only the provisioning profile is 7 days (free
personal team). Regenerating the profile needs `xcodebuild -allowProvisioningUpdates`, which needs the
Apple ID session in the login keychain. The SSH session cannot reach the login keychain (locked for
key-auth SSH; `launchctl asuser` into the GUI session is `Operation not permitted` without sudo), but a
LaunchAgent runs inside the GUI login session where the login keychain is already unlocked, so it
renews with no password on disk.

`~/Library/LaunchAgents/dev.monochromatic.iosvet.profilerenew.plist` (Appendix C) runs
`xcodebuild -allowProvisioningUpdates` daily and at load, logging to `~/ios-vet/renew.log`. Verified:
its first run exited 0 with `** BUILD SUCCEEDED **`. It is loaded with `launchctl bootstrap gui/<uid>`
and auto-loads at every login, so it survives reboot. It runs unattended: it signs with the login
keychain (whose key already authorizes codesign from the initial **Cmd+R**), and the build pattern
above leaves a login-only search list, so the locked vet keychain is not present to prompt for.

Behavior and limits:

- Xcode reuses a still-valid profile and only regenerates a fresh 7-day one near or past expiry
  (confirmed: a same-day run did not extend the window). The daily run catches that. Force a renewal:
  `ssh m1 'launchctl kickstart -k gui/$(id -u)/dev.monochromatic.iosvet.profilerenew'` (verified
  exit 0).
- If a device build ever fails as expired, kickstart the agent and rebuild; no owner action.
- The one case that needs the owner: Apple periodically invalidates a free Apple ID session token
  (weeks to months). The renewal then logs a sign-in error; fix it once in Xcode
  **Settings ▸ Accounts** by re-entering the Apple ID password plus 2FA. A paid Apple Developer Program
  membership ($99/yr) removes the 7-day cycle entirely (1-year profiles).

## Full setup from scratch (fresh Mac, fresh person)

Status: DONE on this instance; this section reproduces it on a new machine or Apple ID.

Bring: a Mac on current macOS, the iPhone X and a USB cable, an Apple ID (free is enough) with access
to its two-factor codes, and the build-driver repo checked out (here on a Linux host reached as
`ssh m1`). Run on the Mac unless a step says "Linux host". For brevity each command assumes
`export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer` is set in the shell.

### Why some steps are the owner's, not automatable

- Adding an Apple ID to Xcode is two-factor gated; the session token comes from an authenticated login
  that cannot be reproduced headlessly. The owner signs in.
- SSH-driven `codesign` cannot reach the login keychain (locked for key-auth SSH sessions), so a
  dedicated keychain the build driver fully controls is used instead of the login keychain.
- `launchctl asuser` into the GUI session for renewal is `Operation not permitted` without sudo, so a
  LaunchAgent loaded into the GUI session does the renewal.

### Steps

1.  Install full **Xcode** (not just Command Line Tools): from the **App Store** (search **Xcode**,
    click **Get**), or `xcodes install --latest`. Expected: `/Applications/Xcode.app` exists.
2.  Select it and accept the license:
    ```sh
    sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
    sudo xcodebuild -license accept
    ```
    Expected: `xcodebuild -version` prints `Xcode 26.x`.
3.  Install Homebrew if absent (`https://brew.sh`), then the device tools:
    ```sh
    brew install ios-deploy libimobiledevice ideviceinstaller xcodegen
    ```
    Expected: `which ios-deploy ideviceinfo xcodegen` all resolve.
4.  Plug the iPhone X into the Mac and unlock it. On the phone tap **Trust** on **Trust This Computer?**
    and enter the passcode. Expected: `idevice_id -l` prints a 40-char UDID and
    `ideviceinfo -k DeviceName` prints the device name with no pairing error.
5.  Enable Developer Mode: on the phone open **Settings ▸ Privacy & Security ▸ Developer Mode**, toggle
    it **on**, tap **Restart**, and after reboot confirm **Turn On** with the passcode. Expected:
    `ideviceinfo -q com.apple.security.mac.amfi -k DeveloperModeStatus` prints `true`.
6.  Capture device facts and symlink DeviceSupport to the newest bundled image (Xcode 26 ships up to
    16.4; the iPhone X is 16.7.x, and the 16.4 disk image mounts on it):
    ```sh
    VER=$(ideviceinfo -k ProductVersion); BUILD=$(ideviceinfo -k BuildVersion)
    DEV="/Applications/Xcode.app/Contents/Developer/Platforms/iPhoneOS.platform/DeviceSupport"
    NEAR=$(ls "$DEV" | sort -V | tail -1)
    mkdir -p "$HOME/Library/Developer/Xcode/iOS DeviceSupport"
    ln -sfn "$DEV/$NEAR" "$HOME/Library/Developer/Xcode/iOS DeviceSupport/$VER ($BUILD)"
    ```
    Expected: the symlink lists under that directory.
7.  Generate the HelloDevice signing-test project from the files in Appendix A:
    ```sh
    mkdir -p ~/ios-vet/HelloDevice/Sources && cd ~/ios-vet/HelloDevice
    # write project.yml, Sources/App.swift, Sources/ContentView.swift from Appendix A
    xcodegen generate
    xcodebuild -project HelloDevice.xcodeproj -scheme HelloDevice -sdk iphonesimulator \
      -destination 'generic/platform=iOS Simulator' build
    ```
    Expected: the simulator build ends `** BUILD SUCCEEDED **` (no signing needed yet).
8.  Sign in the Apple ID: open **Xcode ▸ Settings (Cmd+,) ▸ Accounts**, click **+**, choose
    **Apple ID**, enter email and password, then the **six-digit code**. Expected: the account appears
    with a team row (a free account shows `(Personal Team)`).
9.  First signed run and trust: open `~/ios-vet/HelloDevice/HelloDevice.xcodeproj`, select the
    **HelloDevice** target ▸ **Signing & Capabilities**, tick **Automatically manage signing**, pick
    your **Team**, choose the **iPhone X** destination, press **Run (Cmd+R)**. On the phone's
    **Untrusted Developer** block, open **Settings ▸ General ▸ VPN & Device Management** (labeled
    **Device Management** on some builds), tap your Apple ID under **Developer App**, tap **Trust**.
    Expected: the app launches showing `iOS vet signing OK`; `security find-identity -v -p codesigning`
    lists `Apple Development: <you>`.
10. Export the identity for headless signing, in a local Mac terminal:
    ```sh
    mkdir -p ~/ios-vet
    printf 'pick a throwaway .p12 password: '; stty -echo; read -r P; stty echo; echo
    security export -k "$HOME/Library/Keychains/login.keychain-db" -t identities -f pkcs12 \
      -P "$P" -o "$HOME/ios-vet/vet-identity.p12"
    unset P
    ```
    Approve any keychain dialog. Then on the Linux host add the SAME password to the repo `.env.local`
    (git-ignored): a line `XCODE_IDENTITY_SSH_USABLE=<that password>`. Expected:
    `~/ios-vet/vet-identity.p12` exists and `.env.local` has the key.
11. Build the self-managed vet keychain. From the Linux host (pipes the password so it is never
    echoed):
    ```sh
    PW="$(grep -E '^(export[[:space:]]+)?XCODE_IDENTITY_SSH_USABLE=' .env.local | head -1 \
      | sed -E 's/^[^=]*=//; s/^["'\'']//; s/["'\'']$//' | tr -d '\r\n')"
    printf '%s' "$PW" | ssh m1 'set -e; PW="$(cat)"; KC="$HOME/ios-vet/vet.keychain-db"
      rm -f "$KC"
      security create-keychain -p "$PW" "$KC"
      security set-keychain-settings "$KC"
      security unlock-keychain -p "$PW" "$KC"
      security import "$HOME/ios-vet/vet-identity.p12" -k "$KC" -P "$PW" \
        -T /usr/bin/codesign -T /usr/bin/security
      security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$PW" "$KC" >/dev/null
      security find-identity -v -p codesigning "$KC"
      rm -f "$HOME/ios-vet/vet-identity.p12"'
    ```
    Expected: `1 valid identities found`. The `.p12` is deleted; the keychain (encrypted) is the only
    signing secret left on the Mac.
12. Install the renewal LaunchAgent from Appendix C at
    `~/Library/LaunchAgents/dev.monochromatic.iosvet.profilerenew.plist` (edit the absolute
    `/Users/<you>` paths), then load it:
    ```sh
    plutil -lint ~/Library/LaunchAgents/dev.monochromatic.iosvet.profilerenew.plist
    launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/dev.monochromatic.iosvet.profilerenew.plist
    ```
    Expected: lint prints `OK`; after a minute `~/ios-vet/renew.log` ends `** BUILD SUCCEEDED **` and
    `launchctl print gui/$(id -u)/dev.monochromatic.iosvet.profilerenew` shows `last exit code = 0`.

From here, the reusable build pattern at the top signs any app for the device.

## What to check

Status: DONE

- `ssh m1 'security find-identity -v -p codesigning ~/ios-vet/vet.keychain-db'` prints
  `1 valid identities found` and `Apple Development: <you>`.
- `ssh m1 'ideviceinfo -q com.apple.security.mac.amfi -k DeveloperModeStatus'` prints `true`.
- The reusable build pattern ends in `** BUILD SUCCEEDED **`, `[100%] Installed package`,
  `Developer disk image mounted successfully`, `success`.
- `ssh m1 'launchctl print gui/$(id -u)/dev.monochromatic.iosvet.profilerenew'` shows
  `last exit code = 0`; `tail ~/ios-vet/renew.log` ends in `** BUILD SUCCEEDED **`.
- HelloDevice launches on the phone showing `iOS vet signing OK`.

## Restore

Status: DONE

- Remove the test app: `ssh m1 'ideviceinstaller -U dev.monochromatic.iosvet.hellodevice'`, or
  long-press the icon and remove.
- Stop auto-renew: `ssh m1 'launchctl bootout gui/$(id -u)/dev.monochromatic.iosvet.profilerenew; rm ~/Library/LaunchAgents/dev.monochromatic.iosvet.profilerenew.plist'`.
- Tear down signing: `ssh m1 'rm ~/ios-vet/vet.keychain-db; security list-keychains -d user -s ~/Library/Keychains/login.keychain-db'`; remove `XCODE_IDENTITY_SSH_USABLE` from `.env.local`; in
  Xcode **Settings ▸ Accounts** remove the Apple ID.
- DeviceSupport symlinks and Homebrew tools are harmless to keep; remove the symlinks with
  `rm ~/Library/Developer/Xcode/iOS\ DeviceSupport/16.7*`.
- `rm -rf ~/ios-vet` drops the keychain, test project, and logs.

## Appendix A: HelloDevice project files

`project.yml`:

```yaml
name: HelloDevice
options:
  deploymentTarget:
    iOS: "16.0"
targets:
  HelloDevice:
    type: application
    platform: iOS
    sources: [Sources]
    settings:
      base:
        PRODUCT_BUNDLE_IDENTIFIER: dev.monochromatic.iosvet.hellodevice
        GENERATE_INFOPLIST_FILE: YES
        INFOPLIST_KEY_UILaunchScreen_Generation: YES
        MARKETING_VERSION: "1.0"
        CURRENT_PROJECT_VERSION: "1"
        TARGETED_DEVICE_FAMILY: "1"
        CODE_SIGN_STYLE: Automatic
        SWIFT_VERSION: "5.0"
```

`Sources/App.swift`:

```swift
import SwiftUI

@main
struct HelloDeviceApp: App {
    var body: some Scene {
        WindowGroup { ContentView() }
    }
}
```

`Sources/ContentView.swift`:

```swift
import SwiftUI

struct ContentView: View {
    var body: some View {
        VStack(spacing: 16) {
            Text("HelloDevice").font(.largeTitle)
            Text("iOS vet signing OK")
        }.padding()
    }
}
```

## Appendix C: renewal LaunchAgent

`~/Library/LaunchAgents/dev.monochromatic.iosvet.profilerenew.plist` (replace `/Users/user` with the
real home):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>dev.monochromatic.iosvet.profilerenew</string>
  <key>ProgramArguments</key>
  <array>
    <string>/Applications/Xcode.app/Contents/Developer/usr/bin/xcodebuild</string>
    <string>-project</string>
    <string>/Users/user/ios-vet/HelloDevice/HelloDevice.xcodeproj</string>
    <string>-scheme</string>
    <string>HelloDevice</string>
    <string>-destination</string>
    <string>generic/platform=iOS</string>
    <string>-allowProvisioningUpdates</string>
    <string>-derivedDataPath</string>
    <string>/Users/user/ios-vet/HelloDevice/build-renew</string>
    <string>OTHER_CODE_SIGN_FLAGS=--keychain /Users/user/Library/Keychains/login.keychain-db</string>
    <string>build</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>DEVELOPER_DIR</key>
    <string>/Applications/Xcode.app/Contents/Developer</string>
  </dict>
  <key>StartInterval</key>
  <integer>86400</integer>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/Users/user/ios-vet/renew.log</string>
  <key>StandardErrorPath</key>
  <string>/Users/user/ios-vet/renew.log</string>
</dict>
</plist>
```
