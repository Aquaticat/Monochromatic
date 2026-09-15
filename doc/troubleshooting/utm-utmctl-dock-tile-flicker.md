# UTM 5.0.5 in-bundle `utmctl` registers as a foreground app, so polling loops make the macOS Dock shuffle

## Symptom

The Dock icons on a MacBook Air (`MacBookAir10,1`,
 Apple M1,
 macOS 27.0 build `26A428`)
jumped sideways and snapped back about every 2.2 seconds.
The user filmed it on a phone and asked why the Mac was "dancing".

Frame analysis of that 4K 29.99 fps video
(OpenCV optical flow on every frame,
 scaled to 1280 px wide):

- The Mac body and the terminal text moved only with the handheld camera.
  Screen content relative to the keyboard had a high-pass standard deviation of 0.25 px (x) and 0.33 px (y),
  so the display was not shaking and the machine was not vibrating.
- Feature points on the Dock icons jumped about 7 px along the Dock axis
  relative to the terminal text at frames 55 to 64,
   119 to 129,
   184 to 193,
   and 249 to 256:
  one event every 65 frames (2.17 s),
   each lasting about 10 frames.
- Zoomed frames show a narrow new slot with a running-app dot opening to the right of
  the last running app,
   then closing.

The unified log on the Mac showed the cadence exactly.
Each `utmctl` process checked in with LaunchServices and exited 2.15 s after the previous one:

```text
# /usr/bin/log show --start '2026-09-14 19:50:15' --end '2026-09-14 19:50:32' --style compact \
#   --predicate 'process == "launchservicesd" AND eventMessage CONTAINS "CHECKIN"'
19:50:16.592 launchservicesd [com.apple.launchservices:cas] CHECKIN:0x0-0x229229 18905 com.utmapp.utmctl
19:50:18.739 launchservicesd [com.apple.launchservices:cas] CHECKIN:0x0-0x22a22a 18908 com.utmapp.utmctl
19:50:20.897 launchservicesd [com.apple.launchservices:cas] CHECKIN:0x0-0x22b22b 18910 com.utmapp.utmctl
19:50:23.039 launchservicesd [com.apple.launchservices:cas] CHECKIN:0x0-0x22c22c 18912 com.utmapp.utmctl
```

In the same window,
 the Dock inserted a tile 9 ms after each check-in
and removed it about 0.62 s later:

```text
# same window, --predicate 'process == "Dock" AND eventMessage CONTAINS "tile"'
19:50:18.748 Dock [com.apple.dock:dock-tiles] Inserting tile: <private> at index: 21
             for reason: -[DockBar _handleLaunchNotification:data:]
19:50:19.366 Dock [com.apple.dock:dock-tiles] Removing tiles identical to: <private>
             for reason: _emptyDeleteList()
19:50:20.906 Dock [com.apple.dock:dock-tiles] Inserting tile: <private> at index: 21
             for reason: -[DockBar _handleLaunchNotification:data:]
19:50:21.511 Dock [com.apple.dock:dock-tiles] Removing tiles identical to: <private>
             for reason: _emptyDeleteList()
```

The caller was a Claude Code session on the Mac driving a Windows guest.
Its helper script pushed a PowerShell script into the guest,
then polled for a completion marker file in a loop that ran `utmctl` by its in-bundle path:

```zsh
U=/Applications/UTM.app/Contents/MacOS/utmctl
# (push and exec lines omitted)
until [ -n "$($U file pull Windows "C:\\Windows\\Temp\\g$id.done" 2>/dev/null)" ] || [ $n -ge $t ]; do sleep 2; n=$((n+2)); done
```

The 2.15 s period is one `utmctl` run plus `sleep 2`.
An outer wrapper reran that script every 60 s,
 so the shuffling came back in bursts.

Which invocations trigger it:

- Subcommands that talk to UTM go through `UTMAPICommand.run()`,
  register as a foreground app,
   and make the Dock insert a tile.
  Measured for `list` and `file pull`;
   the other subcommands share that entry point.
  This happens even when the Apple Event itself fails,
  for example from SSH with `OSStatus error -1743`.
- `utmctl --help` does not register.

## Root cause

### Step 1: every API subcommand sends Apple Events through ScriptingBridge

All subcommands except help go through `UTMAPICommand.run()`,
which creates an `SBApplication` for UTM and then sends events
(`utmctl/UTMCtl.swift:53-74` at tag `v5.0.5`):

```swift
extension UTMAPICommand {
    /// Entry point for all subcommands
    func run() throws {
        guard let app = SBApplication(url: utmAppUrl) else {
            throw UTMCtl.APIError.applicationNotFound
        }
        app.launchFlags = [.defaults, .andHide]
        app.delegate = UTMCtl.EventErrorHandler.shared
        let utmApp = app as UTMScriptingApplication
        // ...
        try run(with: utmApp)
    }
```

`--help` never reaches that method.
In swift-argument-parser 1.2.3 (the version UTM pins in `Package.resolved`),
`ParsableCommand.main` runs whatever command `parseAsRoot` returns
(`Sources/ArgumentParser/Parsable Types/ParsableCommand.swift:139-144`):

```swift
    do {
      var command = try parseAsRoot(arguments)
      try command.run()
    } catch {
      exit(withError: error)
    }
```

For a help request the parser substitutes its own help command
(`Sources/ArgumentParser/Parsing/CommandParser.swift:256-259`):

```swift
    } catch let helpRequest as HelpRequested {
      return .success(HelpCommand(
        commandStack: commandStack,
        visibility: helpRequest.visibility))
```

So `utmctl --help` never creates an `SBApplication`,
 which is why it never registers.

### Step 2: the tool embeds an `Info.plist` with no agent or background-only key

`utmctl` is a `com.apple.product-type.tool` target (`UTM.xcodeproj/project.pbxproj:3251`)
that embeds its `Info.plist` into the binary (`UTM.xcodeproj/project.pbxproj:4791-4793`):

```text
CREATE_INFOPLIST_SECTION_IN_BINARY = YES;
INFOPLIST_FILE = "$(SRCROOT)/utmctl/Info.plist";
PRODUCT_BUNDLE_IDENTIFIER = "$(PRODUCT_BUNDLE_PREFIX:default=com.utmapp).utmctl";
```

`utmctl/Info.plist:4-27` has neither `LSUIElement` nor `LSBackgroundOnly`.
The shipped binary matches.
`launchctl plist __TEXT,__info_plist /Applications/UTM.app/Contents/MacOS/utmctl`
prints 21 keys,
 including `CFBundleIdentifier = "com.utmapp.utmctl"`,
and no `LS*` key other than `LSMinimumSystemVersion`.

### Step 3: run from inside `UTM.app`, the process is classified as a foreground app

UTM ships the tool at `UTM.app/Contents/MacOS/utmctl`.
When a process started from that path sends its first Apple Event,
LaunchServices checks it in against the enclosing bundle.
With no agent key it becomes a regular foreground app.
`lsappinfo list` during a run from SSH:

```text
106) "utmctl" ASN:0x0-0x302302:
    bundleID="com.utmapp.utmctl"
    bundle path="/Applications/UTM.app"
    executable path="/Applications/UTM.app/Contents/MacOS/utmctl"
    pid = 19685 ... type="Foreground" flavor=2 Version="1" Arch=ARM64 sandboxed
```

RunningBoard logs the matching role assertion
(`"foregroundApp:19685"`,
 `name:"RoleUserInteractiveNonFocal"`).
The Dock adds a tile for every foreground launch notification and removes it when the process exits.
Apple documents that the missing key is what keeps an app out of the Dock:
[`LSUIElement`][lsuielement] is "a Boolean value indicating whether the app is an agent app
that runs in the background and doesn't appear in the Dock".

LaunchServices and the Dock are closed source,
so step 3 rests on the behavior matrix in "Verification",
 not on a source trace.

### Readings that were wrong

- "The Mac is physically vibrating or the display is shaking."
  Motion tracking put the body and screen content in rigid motion with the camera;
  only Dock icons moved relative to the rest of the screen.
- "A GUI app is crash-looping."
  The newest entry in `/Library/Logs/DiagnosticReports` was a `QEMULauncher` diagnostic from 26 minutes earlier,
  none named `utmctl` or a Dock app,
  and RunningBoard reported every `utmctl` exit in the window as `termination reported by proc_exit`.
- "Registration happens when the process launches."
  `utmctl --help` launches and passes App Sandbox initialization
  (`secinitd ... AppSandbox request successful`) but logs no `CHECKIN`.
  A probe that creates an `SBApplication` without sending an event also never registers.
- "Any ScriptingBridge command-line tool gets a Dock tile."
  The same probe registers as `BackgroundOnly` when its executable sits outside an app bundle,
  and also from a nested `Contents/MacOS/sub/` directory.
  Only an executable directly in some app's `Contents/MacOS/` is classified as `Foreground`.

## Verification

Versions under test:
UTM 5.0.5 (release tag `v5.0.5`,
 commit `b6f7475be54f9cb542c46b131319454b83489ced`),
Developer ID signed by `WDNLXAD4W8`;
macOS 27.0 (`26A428`) on Apple M1.
`lsappinfo list` polling misses short runs,
so the reliable signals are unified-log lines:
the `launchservicesd` `CHECKIN` line,
the RunningBoard assertion label (`foregroundApp:<pid>`,
 `uielement:<pid>`,
 or `backgroundApp:<pid>`),
and the Dock's `Inserting tile` line.

### Harness 1: shipped `utmctl`, in-bundle path vs symlink

This harness runs on the Mac.
From SSH,
 every event fails with `-1743`,
 but registration still happens,
so the Dock effect shows up without Automation permission.

```python
# compare_paths.py <symlink path>; create the link first:
# ln -s /Applications/UTM.app/Contents/MacOS/utmctl <symlink path>
import datetime, re, subprocess, sys, time

link, direct = sys.argv[1], "/Applications/UTM.app/Contents/MacOS/utmctl"
start = datetime.datetime.now() - datetime.timedelta(seconds=1)
for path in (direct, link, direct, link, direct, link):
    subprocess.run([path, "list"], capture_output=True)
    time.sleep(1.2)
end = datetime.datetime.now() + datetime.timedelta(seconds=1)
fmt = "%Y-%m-%d %H:%M:%S"
log = subprocess.run(["/usr/bin/log", "show", "--style", "compact",
    "--start", start.strftime(fmt), "--end", end.strftime(fmt), "--predicate",
    '(process == "launchservicesd" AND eventMessage CONTAINS "com.utmapp.utmctl")'
    ' OR (process == "runningboardd" AND eventMessage CONTAINS "Acquiring assertion"'
    ' AND eventMessage CONTAINS "anon<utmctl>")'
    ' OR (process == "Dock" AND eventMessage CONTAINS "Inserting tile")'],
    capture_output=True, text=True).stdout
ts = lambda l: datetime.datetime.strptime(l[:23], "%Y-%m-%d %H:%M:%S.%f").timestamp()
roles = {int(m[2]): m[1] for m in re.finditer(r'"(\w+):(\d+)"', log)}
inserts = [ts(l) for l in log.splitlines() if "Inserting tile" in l]
for l in log.splitlines():
    if m := re.search(r"CHECKIN:\S+ (\d+) com\.utmapp\.utmctl", l):
        pid = int(m[1])
        print(pid, roles.get(pid), any(0 <= i - ts(l) <= 0.1 for i in inserts))
```

Recorded output with no other `utmctl` caller active
(pid,
 role,
 Dock tile inserted within 100 ms of the check-in):

```text
22264 foregroundApp True
22265 backgroundApp False
22266 foregroundApp True
22267 backgroundApp False
22268 foregroundApp True
22269 backgroundApp False
```

Any concurrent `utmctl` caller adds its own rows.
In an earlier run while the polling loop was active,
extra `foregroundApp True` rows appeared between the harness's own pids.

### Harness 2: ScriptingBridge probe with different embedded plists and locations

Put `probe.swift` in an empty directory and run `python3 probe_matrix.py <that directory>` on the Mac.

```swift
// probe.swift; usage: probe <plain|prohibited|accessory|noevent>
import Foundation
import AppKit
import ScriptingBridge

let mode = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "plain"
if mode == "prohibited" { NSApplication.shared.setActivationPolicy(.prohibited) }
if mode == "accessory" { NSApplication.shared.setActivationPolicy(.accessory) }
guard let app = SBApplication(bundleIdentifier: "com.apple.finder") else { exit(1) }
if mode != "noevent" { _ = (app as AnyObject).value(forKey: "name") }
Thread.sleep(forTimeInterval: 1.5)
```

```python
# probe_matrix.py <empty work dir containing probe.swift>
import pathlib, plistlib, re, shutil, subprocess, sys, time

root = pathlib.Path(sys.argv[1]).resolve()
host = root / "ProbeHost.app" / "Contents"
(host / "MacOS" / "sub").mkdir(parents=True)
(host / "Info.plist").write_bytes(plistlib.dumps({"CFBundleExecutable": "probe-fg",
    "CFBundleIdentifier": "dev.example.lsprobe.host", "CFBundlePackageType": "APPL"}))
for name, extra in {"fg": {}, "ui": {"LSUIElement": True}, "bg": {"LSBackgroundOnly": True}}.items():
    info = {"CFBundleIdentifier": f"dev.example.lsprobe.{name}", "CFBundleExecutable": "probe", **extra}
    (root / f"{name}.plist").write_bytes(plistlib.dumps(info))
    subprocess.run(["xcrun", "swiftc", "-O", str(root / "probe.swift"), "-o", str(root / f"probe-{name}"),
        "-Xlinker", "-sectcreate", "-Xlinker", "__TEXT", "-Xlinker", "__info_plist",
        "-Xlinker", str(root / f"{name}.plist")], check=True)
    shutil.copy2(root / f"probe-{name}", host / "MacOS" / f"probe-{name}")
    shutil.copy2(root / f"probe-{name}", host / "MacOS" / "sub" / f"probe-{name}")

cases = [("MacOS", "fg", "plain"), ("MacOS", "fg", "noevent"), ("MacOS", "fg", "prohibited"),
    ("MacOS", "fg", "accessory"), ("MacOS", "ui", "plain"), ("MacOS", "bg", "plain"),
    ("MacOS/sub", "fg", "plain"), (None, "fg", "plain")]
for where, variant, mode in cases:
    exe = root / f"probe-{variant}" if where is None else host / where / f"probe-{variant}"
    proc = subprocess.Popen([str(exe), mode])
    time.sleep(0.8)
    listing = subprocess.run(["lsappinfo", "list"], capture_output=True, text=True).stdout
    kinds = [re.search(r'type="([^"]+)"', b) for b in re.split(r"\n(?=\s*\d+\) \")", listing)
        if f"pid = {proc.pid} " in b]
    proc.wait()
    print(where or "outside bundle", variant, mode, kinds[0][1] if kinds and kinds[0] else "not registered")
```

Recorded output:

```text
MacOS fg plain Foreground
MacOS fg noevent not registered
MacOS fg prohibited BackgroundOnly
MacOS fg accessory UIElement
MacOS ui plain UIElement
MacOS bg plain BackgroundOnly
MacOS/sub fg plain BackgroundOnly
outside bundle fg plain BackgroundOnly
```

### Harness 3: UTM's own `utmctl` sources rebuilt with the stock and patched plist

This harness builds `utmctl/UTMCtl.swift` and `Scripting/UTMScripting.swift` from tag `v5.0.5`
outside Xcode,
 as a SwiftPM executable,
with swift-argument-parser 1.2.3 (the version pinned in UTM's `Package.resolved`).
It embeds the plist into `__TEXT,__info_plist`,
the section Xcode's `CREATE_INFOPLIST_SECTION_IN_BINARY` fills.
Put `Package.swift` in an empty directory and run
`python3 utmctl_rebuild.py <UTM v5.0.5 checkout> <that directory>` on the Mac.

```swift
// swift-tools-version:5.9
// Package.swift
import Foundation
import PackageDescription

let plist = ProcessInfo.processInfo.environment["UTM_PLIST"] ?? "Info.orig.rendered.plist"

let package = Package(
    name: "utmctl",
    platforms: [.macOS(.v11)],
    dependencies: [
        .package(url: "https://github.com/apple/swift-argument-parser.git", exact: "1.2.3"),
    ],
    targets: [
        .executableTarget(
            name: "utmctl",
            dependencies: [.product(name: "ArgumentParser", package: "swift-argument-parser")],
            linkerSettings: [
                .unsafeFlags(["-Xlinker", "-sectcreate", "-Xlinker", "__TEXT", "-Xlinker", "__info_plist", "-Xlinker", plist]),
            ]
        ),
    ]
)
```

The test binaries must sit directly in some app's `Contents/MacOS/` (Harness 2),
but `utmAppUrl` (`utmctl/UTMCtl.swift:95-103`) targets whichever `.app` encloses the executable.
Unedited,
 the rebuilt tool targets the host bundle,
aborts with `failed to get scripting definition`,
 and never sends an event.
The script therefore applies a harness-only edit so the lookup falls back to `/Applications/UTM.app`.
That edit is not part of the proposed fix.

```python
# utmctl_rebuild.py <UTM v5.0.5 checkout> <empty work dir containing Package.swift>
import datetime, pathlib, plistlib, re, shutil, subprocess, sys, time

utm, root = pathlib.Path(sys.argv[1]).resolve(), pathlib.Path(sys.argv[2]).resolve()
src = root / "Sources" / "utmctl"
src.mkdir(parents=True)
shutil.copy2(utm / "Scripting" / "UTMScripting.swift", src)
ctl = (utm / "utmctl" / "UTMCtl.swift").read_text()
# HARNESS ONLY: UtmctlHost.app encloses the test binaries, so fall back to /Applications/UTM.app.
old = 'if utmURL.pathExtension == "app" {'
assert ctl.count(old) == 1
(src / "UTMCtl.swift").write_text(ctl.replace(old, old[:-2] + ' && utmURL.lastPathComponent == "UTM.app" {'))

stock = plistlib.loads((utm / "utmctl" / "Info.plist").read_bytes())
subst = {"$(DEVELOPMENT_LANGUAGE)": "en", "$(EXECUTABLE_NAME)": "utmctl",
    "$(PRODUCT_BUNDLE_IDENTIFIER)": "dev.example.utmctlprobe", "$(PRODUCT_NAME)": "utmctl",
    "$(MARKETING_VERSION)": "5.0.5"}
rendered = {k: subst.get(v, v) for k, v in stock.items() if v != "$(PRODUCT_BUNDLE_PACKAGE_TYPE)"}
host = root / "UtmctlHost.app" / "Contents"
(host / "MacOS").mkdir(parents=True)
(host / "Info.plist").write_bytes(plistlib.dumps({"CFBundleExecutable": "host",
    "CFBundleIdentifier": "dev.example.utmctlprobe.host", "CFBundlePackageType": "APPL"}))
for variant, extra in {"stock": {}, "patched": {"LSUIElement": True}}.items():
    plist = root / f"Info.{variant}.plist"
    plist.write_bytes(plistlib.dumps({**rendered, **extra}))
    subprocess.run(["swift", "build", "-c", "release", "--package-path", str(root),
        "--scratch-path", str(root / f".build-{variant}")], check=True,
        env={**__import__("os").environ, "UTM_PLIST": str(plist)})
    shutil.copy2(root / f".build-{variant}" / "release" / "utmctl", host / "MacOS" / f"utmctl-{variant}")

start = datetime.datetime.now() - datetime.timedelta(seconds=1)
pids = {}
for variant in ("stock", "patched", "stock", "patched", "stock", "patched"):
    proc = subprocess.Popen([str(host / "MacOS" / f"utmctl-{variant}"), "list"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    pids[proc.pid] = variant
    proc.wait()
    time.sleep(1.2)
end = datetime.datetime.now() + datetime.timedelta(seconds=1)
fmt = "%Y-%m-%d %H:%M:%S"
log = subprocess.run(["/usr/bin/log", "show", "--style", "compact", "--start", start.strftime(fmt),
    "--end", end.strftime(fmt), "--predicate",
    '(process == "launchservicesd" AND eventMessage CONTAINS "dev.example.utmctlprobe")'
    ' OR (process == "runningboardd" AND eventMessage CONTAINS "Acquiring assertion"'
    ' AND eventMessage CONTAINS "utmctl-")'
    ' OR (process == "Dock" AND (eventMessage CONTAINS "Inserting tile"'
    ' OR eventMessage CONTAINS "foreground type key"))'], capture_output=True, text=True).stdout
ts = lambda l: datetime.datetime.strptime(l[:23], "%Y-%m-%d %H:%M:%S.%f").timestamp()
roles = {int(m[2]): m[1] for m in re.finditer(r'"(\w+):(\d+)"', log)}
dock = [(ts(l), "tile inserted" if "Inserting tile" in l else "no foreground type")
    for l in log.splitlines() if "Dock" in l[:40]]
for l in log.splitlines():
    if (m := re.search(r"CHECKIN:\S+ (\d+) dev\.example\.utmctlprobe", l)) and int(m[1]) in pids:
        pid = int(m[1])
        near = [what for t, what in dock if 0 <= t - ts(l) <= 0.1]
        print(pids[pid], pid, roles.get(pid), near or ["no Dock reaction"])
```

Recorded output (both builds also print one `FileHandle: TextOutputStream` retroactive-conformance warning):

```text
stock 23196 foregroundApp ['tile inserted']
patched 23201 uielement ['no foreground type']
stock 23202 foregroundApp ['tile inserted']
patched 23205 uielement ['no foreground type']
stock 23206 foregroundApp ['tile inserted']
patched 23209 uielement ['no foreground type']
```

`no foreground type` is the Dock's `Launch notification lack value for foreground type key` line.

### Patterns that add a Dock tile

- Shipped `utmctl <api subcommand>` run by `/Applications/UTM.app/Contents/MacOS/utmctl`:
  `foregroundApp` role,
   Dock `Inserting tile` within 100 ms of `CHECKIN`
  (Harness 1,
   3 of 3 runs,
   plus every run of the polling loop).
- Probe with the plain plist directly in `ProbeHost.app/Contents/MacOS/`:
   `type="Foreground"`.
- Rebuilt `utmctl` with the stock plist in the host bundle:
  `"foregroundApp:<pid>"` / `RoleUserInteractiveNonFocal`,
   followed by Dock `Inserting tile ... _handleLaunchNotification`
  (3 of 3 runs).

### Patterns that do not add a Dock tile

- Shipped `utmctl list` run through a symlink outside the bundle:
  `backgroundApp` / `RoleNonUserInteractive`,
   no Dock insert (Harness 1,
   3 of 3 runs).
- `utmctl --help` by the in-bundle path:
   no `CHECKIN` at all.
- Rebuilt `utmctl` with `LSUIElement` in the host bundle:
  `"uielement:<pid>"` / `RoleUserInteractive`;
   the Dock logs
  `Launch notification lack value for foreground type key` and inserts nothing (3 of 3 runs).
- Probe in the bundle with `LSUIElement`:
   `type="UIElement"`.
- Probe in the bundle with `LSBackgroundOnly`:
   `type="BackgroundOnly"`.
- Probe in the bundle with `setActivationPolicy(.prohibited)`:
   `type="BackgroundOnly"`.
- Probe in the bundle with `setActivationPolicy(.accessory)`:
   `type="UIElement"`.
- Probe that creates `SBApplication` but sends no event:
   not registered.
- Probe outside any bundle,
   or in `Contents/MacOS/sub/`:
   `type="BackgroundOnly"`.

## Verified workarounds

### Call `utmctl` through a symlink outside `UTM.app`

```zsh
ln -s /Applications/UTM.app/Contents/MacOS/utmctl "${HOME}/.local/bin/utmctl"
U="${HOME}/.local/bin/utmctl"
```

This is also the install method UTM's [scripting documentation][utm-scripting] recommends
(`sudo ln -sf /Applications/UTM.app/Contents/MacOS/utmctl /usr/local/bin/utmctl`).
Only scripts that call the in-bundle path directly hit the Dock shuffle.
`utmAppUrl` resolves symlinks before locating UTM (`utmctl/UTMCtl.swift:96`),
so the symlinked tool still targets the real app.

Tradeoffs:

- Verified only at the LaunchServices and Dock log level,
   from SSH,
   where events fail with `-1743`.
  A full `file pull` from a GUI terminal through the symlink was not run in this session,
  so whether the existing Automation permission applies unchanged is unverified.
  The executed binary and its signing identifier (`com.utmapp.utmctl`) are the same file.
- It depends on macOS classifying the process by the path it was started from.
  That is observed behavior,
   not documented behavior.
- A symlink breaks if UTM moves.
  A renamed `UTM.app` still works because the lookup follows the symlink target.

### Poll less often

Each API invocation by the in-bundle path produces exactly one Dock insert and removal
(Harness 1 and the incident log),
 so the shuffle rate equals the invocation rate.
Changing the polling interval from `sleep 2` to `sleep 15` cuts it by the same factor.

Tradeoffs:
the Dock still shuffles,
 and completion is detected up to one interval later.

## What does not work

### `utmctl --hide`

`--hide` only turns off UTM's auto-terminate and closes UTM's main window
(`utmctl/UTMCtl.swift:62-72`).
It does not change how the `utmctl` process itself registers.

### Copying the signed `utmctl` binary outside the bundle

`cp /Applications/UTM.app/Contents/MacOS/utmctl <dir>/utmctl` followed by `<dir>/utmctl list`
exited with status 133 (`SIGTRAP`) before any `CHECKIN` for its pid.
The cause was not traced,
 because the symlink already avoids the bundle association
without duplicating a signed vendor binary.

### Replacing the poll loop with one blocking `utmctl exec` (untested)

`utmctl exec` already waits for the guest process and captures output
(`utmctl/UTMCtl.swift:466-470`):

```swift
let process = vm.executeAt!(path, withArguments: args, withEnvironment: env, usingInput: data.base64EncodedString(), base64Encoding: true, outputCapturing: true)
var result: [AnyHashable: Any]
repeat {
    result = process.getResult!()
} while result["hasExited"] as? Bool == false
```

That would turn many short Dock tiles into one tile that stays for the whole command.
The `repeat` loop has no delay between `getResult` events.
Whether a long guest command survives ScriptingBridge's event timeout was not tested.

### Dock auto-hide (untested)

Hiding the Dock would hide the tile churn while the Dock is hidden.
It changes the user's Dock for every app,
 and it was not applied,
 because verification must not
mutate the user's real settings.

## Upstream filing artifact

### Upstream filing decision

`.out-of-scope/` has no entry for UTM,
 `utmctl`,
 or macOS Dock behavior
(files checked:
 `bun-install.md`,
 `cargo-workspace.md`,
 `claude-code-upstream-bugs.md`,
 `codex-harness.md`,
`jsr.md`,
 `lightningcss.md`,
 `low-impact-typescript-formatting.md`,
 `module-es-monolith.md`,
`pi-gpt55-long-context.md`,
 `terminal-title-fork-parity-tests.md`,
 `typescript-project-references.md`).

Duplicate search on `utmapp/UTM`,
 open and closed:
`gh search issues "utmctl"` (every title read),
`gh search issues "dock icon"`,
`gh search issues "utmctl flicker OR bounce OR \"appears in dock\""`,
`gh search prs "LSUIElement"`.
No match.
Nearest neighbors,
 both distinct:
[#7848][issue-7848] (the main UTM app's "Show dock icon" setting ignored when launched via `open`)
and [#7014][issue-7014] (Dock stops accepting icons after an upgrade;
 maintainer could not reproduce).

1.  **Is it really upstream's fault?**
    Yes.
    UTM decides where `utmctl` ships and what its embedded plist contains.
    macOS behaves as documented for an app without `LSUIElement`.
2.  **Can upstream fix it?**
    Yes,
     with a plist key (prototype in constraint 6).
3.  **Are they supporting this use case?**
    Yes.
    The [scripting documentation][utm-scripting] presents `utmctl` as UTM's command-line automation interface,
    and #7848 shows users building headless automation around `utmctl start`.
4.  **Would the repo welcome our contribution?**
    Yes for an issue.
    `CONTRIBUTING.md` "AI Contribution Guidelines" accepts AI-assisted contributions.
    For pull requests it requires a human to reproduce the bug,
     apply the fix,
     observe it fixed,
    and add an `Assisted-by:` trailer.
    The macOS issue template asks reporters to search first.
    No ban on AI-assisted issues was found.
    The draft discloses assistance.
    A pull request stays blocked until the user builds UTM and observes the fix in the Dock.
5.  **Will they likely fix it?**
    No won't-fix signal.
    `utmctl/UTMCtl.swift` was last changed on 2026-08-20 (`a11e968`,
     snapshot commands),
    so the tool is maintained.
    `utmctl/Info.plist` has not changed since 2022-12-15 (`8839b60`).
6.  **Have we prototyped a minimal fix compatible with their architecture?**
    Yes.
    Disposable clone at `v5.0.5`
    (`b6f7475be54f9cb542c46b131319454b83489ced`,
     origin `https://github.com/utmapp/UTM.git`):

    ```diff
    --- a/utmctl/Info.plist
    +++ b/utmctl/Info.plist
    @@ -22,6 +22,8 @@
     	<string>1</string>
     	<key>ITSAppUsesNonExemptEncryption</key>
     	<false/>
    +	<key>LSUIElement</key>
    +	<true/>
     	<key>NSHumanReadableCopyright</key>
     	<string>Copyright © 2022 osy. All rights reserved.</string>
     </dict>
    ```

    Harness 3 with the stock plist gave `foregroundApp` plus a Dock `Inserting tile` on 3 of 3 runs.
    With the patched plist it gave `uielement` plus `Launch notification lack value for foreground type key`,
    and no tile,
     on 3 of 3 runs.
    Limits:
     built with SwiftPM rather than Xcode,
     ad-hoc signed without App Sandbox,
    with the harness-only `utmAppUrl` edit,
     and observed through logs rather than on screen.
    `LSUIElement` keeps `utmctl` in a user-interactive RunningBoard role (`RoleUserInteractive`),
    while the symlink path's `backgroundApp` classification drops it to `RoleNonUserInteractive`;
    Harness 2 shows `LSBackgroundOnly` also avoids the Dock.
    Neither key was tested against the first-run Automation consent prompt.

All six hold,
 so the draft is fileable.
Filing is an external publication and waits for the user's go-ahead.

### Draft issue

~~~md
Title: utmctl adds a Dock tile on every call, so polling scripts make the Dock shuffle

**Describe the issue**
`utmctl` subcommands that talk to UTM (measured: `list`, `file pull`; all go through `UTMAPICommand.run()`)
register with LaunchServices as a regular foreground app when run as
`/Applications/UTM.app/Contents/MacOS/utmctl`. The Dock inserts a tile for it and removes the tile
when it exits. A script that polls, for example `utmctl file pull` every 2 seconds while waiting
for a guest command, makes the Dock icons jump sideways every 2 seconds. I noticed it by eye
and filmed it.

Unified log for one poll cycle:

```
launchservicesd CHECKIN:0x0-0x22a22a 18908 com.utmapp.utmctl
runningboardd   "foregroundApp:18908" RoleUserInteractiveNonFocal
Dock            Inserting tile: <private> at index: 21 for reason: -[DockBar _handleLaunchNotification:data:]
Dock            Removing tiles identical to: <private> for reason: _emptyDeleteList()
```

`utmctl --help` does not register. Running the same binary through a symlink outside the bundle
(as the scripting docs suggest) registers as `backgroundApp` and adds no tile.

**Cause**
`utmctl/Info.plist` (embedded via `CREATE_INFOPLIST_SECTION_IN_BINARY`) has no `LSUIElement`
or `LSBackgroundOnly`. Started from inside `UTM.app/Contents/MacOS`, the process is checked in
against the app bundle as a normal app once ScriptingBridge sends its first event
(`UTMAPICommand.run()` in `utmctl/UTMCtl.swift`).

**Suggested fix**
Add `LSUIElement` = true to `utmctl/Info.plist`. I rebuilt `UTMCtl.swift` + `UTMScripting.swift`
from v5.0.5 with SwiftPM, embedded the stock and patched plist, and ran each from inside an app
bundle: stock gave `foregroundApp` plus a Dock tile insert on 3/3 runs; patched gave `uielement`,
the Dock logged `Launch notification lack value for foreground type key`, and no tile appeared on
3/3 runs. Not yet verified: an Xcode/sandboxed build, and whether the Automation consent prompt
still appears normally for an agent-type utmctl.

**Configuration**
* UTM Version: 5.0.5
* macOS Version: 27.0 (26A428)
* Mac Chip: M1 (MacBookAir10,1)

**Workaround**
Call utmctl through a symlink outside UTM.app, e.g.
`ln -s /Applications/UTM.app/Contents/MacOS/utmctl ~/.local/bin/utmctl`.

This report was prepared with AI assistance (Claude Code). The Dock behavior was observed by me
on my Mac; the log correlation, source trace, and SwiftPM prototype were run by the assistant on
the same machine.
~~~

[lsuielement]: https://developer.apple.com/documentation/bundleresources/information-property-list/lsuielement
[utm-scripting]: https://docs.getutm.app/scripting/scripting/
[issue-7848]: https://github.com/utmapp/UTM/issues/7848
[issue-7014]: https://github.com/utmapp/UTM/issues/7014
