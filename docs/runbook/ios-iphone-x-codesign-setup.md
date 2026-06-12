# iPhone X code-signing for the iOS framework vet

How development builds are signed and run on the owner's iPhone X over SSH, with no macOS login
password stored anywhere, and how the 7-day free-team profile auto-renews. The one-time setup is done;
this is the reference for everyday use, renewal, reproduction, and teardown.

## What this proves

Verified end to end on 2026-06-12: a signed build over SSH installs and launches on the iPhone X
(`iPhone10,3`, iOS 16.7.16, build 20H392, UDID `9057e2a8c2e70162e35b9ea8bf006f736670877b`), with the
DeveloperDiskImage mounting and the app running. Identity:
`Apple Development: little.plan2433@fastmail.com`, team `HWLVAKDV4F`.

## Current state

Status: DONE

Permanent artifacts, all surviving reboot:

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

From the repo root on the Linux host (the ssh alias `m1` reaches the Mac). Reuse the bundle id
`dev.monochromatic.iosvet.hellodevice` so the existing profile and identity sign with no new
provisioning:

```sh
PW="$(grep -E '^(export[[:space:]]+)?XCODE_IDENTITY_SSH_USABLE=' .env.local \
  | head -1 | sed -E 's/^[^=]*=//; s/^["'\'']//; s/["'\'']$//' | tr -d '\r\n')"
printf '%s' "$PW" | ssh m1 'set -e
  PW="$(cat)"
  export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
  KC="$HOME/ios-vet/vet.keychain-db"
  security unlock-keychain -p "$PW" "$KC"
  security list-keychains -d user -s "$KC" "$HOME/Library/Keychains/login.keychain-db" >/dev/null
  cd <APP_DIR> && rm -rf build
  xcodebuild -project <APP>.xcodeproj -scheme <SCHEME> \
    -destination "platform=iOS,id=9057e2a8c2e70162e35b9ea8bf006f736670877b" \
    -configuration Debug -derivedDataPath build \
    OTHER_CODE_SIGN_FLAGS="--keychain $KC" build
  ios-deploy --id 9057e2a8c2e70162e35b9ea8bf006f736670877b \
    --bundle build/Build/Products/Debug-iphoneos/<APP>.app --justlaunch --no-wifi
  security list-keychains -d user -s "$HOME/Library/Keychains/login.keychain-db" >/dev/null'
```

Each build reads the throwaway from `.env.local`, pipes it over the encrypted SSH channel (never a
command argument, never echoed), unlocks the vet keychain for that session, adds it to the codesign
search list so xcodebuild can resolve the identity (the `--keychain` flag alone does not satisfy
identity resolution, only the codesign step), signs against it, installs and launches, then resets the
search list to login-only. The reset matters: it keeps the locked vet keychain out of the idle search
list, which is what would otherwise make the daily GUI renewal prompt for the throwaway password. No
GUI **Cmd+R**, no per-build owner action.

## Auto-renew of the 7-day profile

Status: DONE

Facts: the signing certificate is valid one year (to 2027-06-12); only the provisioning profile is
7 days (free personal team). Regenerating the profile needs `xcodebuild -allowProvisioningUpdates`,
which needs the Apple ID session in the login keychain. The SSH session cannot reach the login keychain
(locked for key-auth SSH; `launchctl asuser` into the GUI session is `Operation not permitted` without
sudo), but a LaunchAgent runs inside the GUI login session where the login keychain is already
unlocked, so it renews with no password on disk.

`~/Library/LaunchAgents/dev.monochromatic.iosvet.profilerenew.plist` runs
`xcodebuild -allowProvisioningUpdates` (a generic-destination build of HelloDevice forced to the login
keychain) daily and at load, logging to `~/ios-vet/renew.log`. Verified: its first run exited 0 with
`** BUILD SUCCEEDED **`. It is loaded into the GUI session via `launchctl bootstrap gui/<uid>` and the
plist auto-loads at every login, so it survives reboot. It runs unattended: it signs with the login
keychain (whose key already authorizes codesign from the initial **Cmd+R**), and the build pattern
above leaves a login-only search list, so the locked vet keychain is not present to prompt for.

Behavior and limits:

- Xcode reuses a still-valid profile and only regenerates a fresh 7-day one when the current profile is
  near or past expiry (confirmed: a same-day run did not extend the window). The daily run catches that
  window. Force a renewal at any time:
  `ssh m1 'launchctl kickstart -k gui/$(id -u)/dev.monochromatic.iosvet.profilerenew'` (verified
  exit 0).
- If a device build ever fails as expired, kickstart the agent and rebuild; this needs no owner action.
- The one case that needs the owner: Apple periodically invalidates a free Apple ID session token
  (weeks to months). When that happens the renewal logs a sign-in error; fix it once by opening Xcode,
  **Settings ▸ Accounts**, and re-entering the Apple ID password plus the 2FA code. A paid Apple
  Developer Program membership ($99/yr) removes the 7-day cycle entirely (1-year profiles) if the
  weekly machinery is ever unwanted.

## One-time setup that produced this state

Status: DONE

Reproduce only on a new Mac or a fresh Apple ID.

### Bridges tried, why parts needed the owner

- `xcodebuild -allowProvisioningUpdates` needs an Apple ID already in Xcode; adding one is two-factor
  gated and cannot be scripted headlessly, so the owner signed in.
- SSH-driven `codesign` cannot reach the login keychain (locked for key-auth SSH sessions), so a
  dedicated keychain the agent fully controls is used instead of the login keychain.
- `launchctl asuser` into the GUI session for renewal is `Operation not permitted` without sudo, so a
  LaunchAgent loaded into the GUI session does the renewal.

### What was run

1.  Selected full Xcode 26.5 (`DEVELOPER_DIR`); confirmed deployment target 16.0 builds (SDK floor
    12.0).
2.  Created DeviceSupport 16.7 symlinks to the bundled 16.4 DeveloperDiskImage.
3.  `brew install ios-deploy libimobiledevice ideviceinstaller xcodegen`.
4.  Generated the HelloDevice test project with xcodegen.
5.  Owner enabled Developer Mode on the iPhone and rebooted.
6.  Owner signed the Apple ID into Xcode (**Settings ▸ Accounts**), opened HelloDevice, selected the
    team, pressed **Cmd+R**, and trusted the certificate on the phone
    (**Settings ▸ General ▸ Device Management ▸ Developer App ▸ Trust**).
7.  Owner exported the Apple Development identity to a `.p12` with a throwaway password
    (`security export`) and saved that password to the Linux `.env.local` as
    `XCODE_IDENTITY_SSH_USABLE`.
8.  Agent imported the `.p12` into `~/ios-vet/vet.keychain-db`, set its key partition list
    (`apple-tool:,apple:,codesign:`), added it to the codesign search list, then deleted the `.p12` and
    the Mac password file so only the encrypted keychain remains.
9.  Agent installed the renewal LaunchAgent and bootstrapped it into the GUI session.

## What to check

Status: DONE

- `ssh m1 'security find-identity -v -p codesigning ~/ios-vet/vet.keychain-db'` prints
  `1 valid identities found` and `Apple Development: little.plan2433@...`.
- `ssh m1 'ideviceinfo -q com.apple.security.mac.amfi -k DeveloperModeStatus'` prints `true`.
- The reusable build pattern ends in `** BUILD SUCCEEDED **`, `[100%] Installed package`,
  `Developer disk image mounted successfully`, `success`.
- `ssh m1 'launchctl print gui/$(id -u)/dev.monochromatic.iosvet.profilerenew'` shows the job with
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
