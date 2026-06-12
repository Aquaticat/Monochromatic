# iPhone X code-signing setup for the iOS framework vet

Manual steps to make Xcode able to install development builds on the owner's iPhone X,
so the iOS framework vet can build and run each candidate on the real device.

## What this proves

After this runbook, `security find-identity -v -p codesigning` reports a valid
`Apple Development` identity, and a freshly built app installs and launches on the iPhone X
(`iPhone10,3`, iOS 16.7.16, UDID `9057e2a8c2e70162e35b9ea8bf006f736670877b`).
Once that holds, every subsequent vet app is built and installed from the CLI without the Xcode GUI.

## Bridges tried (why this needs you)

The Apple ID sign-in is the one action that cannot be automated.
What was tried and why each fails:

- `xcodebuild -allowProvisioningUpdates` needs an Apple ID already in Xcode's account store.
  None is present, so it cannot mint a team. Verified: the device build fails with
  `Signing for "HelloDevice" requires a development team.`
- No supported CLI adds an Apple ID to Xcode. The sign-in is two-factor gated; the session token
  comes from an authenticated login that cannot be reproduced headlessly.
- Driving the sign-in sheet over SSH (`osascript`, `xdotool`) still cannot supply the six-digit
  code (it lands on your trusted devices), and needs the screen unlocked with Accessibility
  granted to the SSH session.

So the Apple ID sign-in is handed to you; everything else was automated (see Setup).

## Setup

Status: DONE

Already done for you on the Mac (`ssh m1`), no action needed:

- Builds point at full Xcode 26.5 via `DEVELOPER_DIR`; its iOS SDK floor is deployment target 12.0,
  so it targets the iPhone X with deployment target 16.0 (no old SDK is needed or installable).
- DeviceSupport symlinks `~/Library/Developer/Xcode/iOS DeviceSupport/16.7*` point at Xcode's
  bundled 16.4 `DeveloperDiskImage.dmg`, covering on-device debug for the 16.7.16 device.
- Installed `ios-deploy`, `libimobiledevice`, `ideviceinstaller`, `xcodegen` via Homebrew.
- Confirmed the Mac is already trusted by the phone, Developer Mode is on, and the device is
  reachable over USB.
- Staged a minimal signing-test project at `~/ios-vet/HelloDevice`; it builds clean for the
  simulator, so only signing remains.

Bring to the steps below:

- The iPhone X plugged into the Mac with a cable, screen unlocked.
- Your Apple ID email and password (a free Apple ID is enough; a paid Developer Program membership
  also works).
- A trusted Apple device or phone number that can receive the six-digit verification code.

## Steps

Status: TODO

1.  Open **Xcode** on the Mac.
2.  Open **Settings** with **Cmd+,**.
3.  Click the **Accounts** tab.
4.  Click **+** at the bottom-left, select **Apple ID**, then click **Continue**.
    Expected: a sign-in sheet appears.
5.  Type your Apple ID email, click **Next**, type your password, click **Next**.
    Expected: a two-factor prompt appears.
6.  Type the **six-digit verification code** from your trusted device.
    Expected: your Apple ID appears in the left list, with a team row beneath it; a free account
    shows `(Personal Team)`.
7.  Stop here and tell me sign-in is done. I run the CLI signing and install
    (`xcodebuild -allowProvisioningUpdates` against the staged project).
    If that cannot create a free-team profile, do steps 8 to 12 in Xcode.

Fallback, only if I report the CLI could not create the profile:

8.  In Xcode, choose **File ▸ Open** and open `~/ios-vet/HelloDevice/HelloDevice.xcodeproj`.
9.  Select the **HelloDevice** target, then open the **Signing & Capabilities** tab.
10. Tick **Automatically manage signing**, then pick your team in the **Team** dropdown.
    Expected: the **Signing Certificate** line reads `Apple Development: <your name>`, with no red error.
11. Pick **iPhone X** as the run destination at the top of the window, then press **Run** with **Cmd+R**.
    Expected: the app installs and launches on the phone showing `iOS vet signing OK`.
12. First free-team install only: if launch is blocked as untrusted, on the iPhone open
    **Settings ▸ General ▸ VPN & Device Management**, tap your Apple ID under **Developer App**,
    tap **Trust**, then reopen the app. Expected: the app launches.

## What to check

Status: TODO

Run on the Mac (`ssh m1`) after the steps; expected exact output:

- `security find-identity -v -p codesigning` prints `1 valid identities found` and a line
  containing `Apple Development:`.
- `ideviceinfo -q com.apple.security.mac.amfi -k DeveloperModeStatus` prints `true`.
- `ideviceinstaller -l` lists `dev.monochromatic.iosvet.hellodevice`.
- The iPhone X home screen shows the **HelloDevice** icon and the app opens to `iOS vet signing OK`.

## Restore

Status: TODO

To undo the test state (the signing identity itself should stay; the vet needs it):

- Remove the test app: `ideviceinstaller -U dev.monochromatic.iosvet.hellodevice`, or long-press
  the **HelloDevice** icon on the phone and remove it.
- Remove the staged project if wanted: `rm -rf ~/ios-vet/HelloDevice`.
- The DeviceSupport symlinks and Homebrew tools are harmless to keep; to remove the symlinks,
  delete `~/Library/Developer/Xcode/iOS DeviceSupport/16.7*`.
- To sign out the Apple ID later: Xcode **Settings ▸ Accounts**, select the account, click **-**.
