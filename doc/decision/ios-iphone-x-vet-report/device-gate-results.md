# iOS framework device-gate results (iPhone X)

On-device build-and-run outcomes for the funnel's stage 1,
 recorded as each framework is gated on
the owner's iPhone X (`iPhone10,3`,
 iOS 16.7.16,
 build 20H392,
 UDID
`9057e2a8c2e70162e35b9ea8bf006f736670877b`).
 This is the evidence layer the desk audits cannot
produce:
 a desk audit judges from source,
 a gate judges from a signed app actually rendering its UI and
running on the hardware.
 Launch success alone is not a pass:
 an app can pass `ios-deploy ... run` and
then die at dyld load or panic before drawing a frame.
 Every PASS below is confirmed by an on-device
screenshot plus a few seconds of no-crash runtime,
 not by launch success.
 Read this together with the
per-framework `vet-<framework>.md` reports (source audit) and the synthesis at
`doc/decision/ios-iphone-x-music-player-kopia-stack.md`.

Signing and device path are established and documented separately in
`doc/runbook/ios-iphone-x-codesign-setup.md`;
 this file records only what each framework's own
toolchain does on top of that path.

## The gate mechanism (proven 2026-06-12)

Every gate reuses one provisioned app id,
 `dev.monochromatic.iosvet.hellodevice`,
 so no gate needs
`-allowProvisioningUpdates` (which would need the login keychain that an SSH session cannot reach).
Each framework's generated Xcode project has its bundle id forced to that value,
 and the build is
driven over `ssh m1` with three injected settings plus the vet keychain:

```sh
xcodebuild -project <App>.xcodeproj -scheme <Scheme> \
  -destination 'platform=iOS,id=9057e2a8c2e70162e35b9ea8bf006f736670877b' \
  -configuration Debug -derivedDataPath build \
  DEVELOPMENT_TEAM=HWLVAKDV4F CODE_SIGN_STYLE=Automatic \
  OTHER_CODE_SIGN_FLAGS="--keychain $KC" build
```

Confirmed behavior:
 with the bundle id pinned to the already-provisioned app id and the team set to
`HWLVAKDV4F`,
 automatic signing resolves the existing 7-day profile from disk and signs with no call
to Apple,
 so the gate runs fully unattended over SSH.
 The codesign step uses the vet keychain
(`codesign --force --sign <hash> --keychain ~/ios-vet/vet.keychain-db`),
 and `ios-deploy --justlaunch`
installs and runs it.
 The vet keychain must be unlocked and present in the user search list for the
duration of the build (xcodebuild resolves the identity through the search list,
 not the `--keychain`
flag alone);
 the search list is restored to login-only afterward.

Dual-target gate criterion (owner,
 2026-06-12):
 a framework is not a PASS until it render-verifies on
BOTH the physical iPhone X (iosArm64,
 iOS 16.7) and the latest iOS simulator (iosSimulatorArm64,
 iOS 26.5
on Xcode 26.5),
 from one codebase with no device-only or simulator-only fork.
 The simulator leg is
signing-free and uses `simctl`:
 `xcrun simctl boot <sim-udid>` (headless is fine,
 CoreSimulator renders
offscreen),
 then `xcodebuild ... -sdk iphonesimulator -destination 'platform=iOS Simulator,id=<sim-udid>'
CODE_SIGNING_ALLOWED=NO build` (the same project;
 the embed phase builds the iosSimulatorArm64 slice from
the same source),
 `xcrun simctl install <sim-udid> <App>.app`,
 `xcrun simctl launch <sim-udid>
<bundle-id>`,
 then `xcrun simctl io <sim-udid> screenshot <path>`.
 One quirk:
 CoreSimulator cannot write a
screenshot to the external MacData volume (TCC denies it,
 NSPOSIXErrorDomain code 1),
 so write the PNG to
the Mac's internal `/tmp` and `scp` it off.
 The latest simulator on this Mac is iPhone 17 Pro on iOS 26.5
(`09D9EB9B-8036-4D23-929D-F75ADE9987FA`);
 the device UDID is
`9057e2a8c2e70162e35b9ea8bf006f736670877b`.
 Headless-Impeller caveat:
 a framework that presents frames
through Impeller/Metal and relies on the display link (Flutter is the proven case) may show a black
screenshot on a `simctl`-booted simulator with no Simulator.
app GUI,
 even while the process is alive.
 The
GUI Simulator.
app (unreachable over SSH) renders it normally;
 the headless workaround is to force the
Skia/software path (for Flutter,
 `FLTEnableImpeller=false`).
 Compose/Skiko-Metal and WKWebView capture
fine headlessly,
 so this is renderer-specific,
 not a blanket headless limit.

Two mechanics that bit during setup and will bite again:

- The Mac login shell is zsh,
   which does not word-split unquoted parameter expansions.
   A
  `WS="-project App.xcodeproj"; xcodebuild $WS ...` reaches xcodebuild as one malformed argument and
  triggers the full usage dump.
   Inline the flags;
   do not build them in a variable.
- `tail -n` on a failing `xcodebuild | tail` hides the real error,
   which xcodebuild prints near the
  top.
   When a build "fails with usage text,
  " re-run capturing the head,
   or run `xcodebuild -list`
  first to confirm the scheme.
- Launch is not render.
   `ios-deploy --justlaunch` prints `success` as soon as the process is created
  under lldb,
   before any UI draws,
   and then detaches,
   which kills the app.
   To confirm a gate renders,
  relaunch with `idevicedebug -d run <bundle id>` (which holds the app alive),
   `idevicescreenshot`
  after a few seconds,
   and scan the app stdout plus `idevicecrashreport` for a dyld `Symbol not found`
  or a Rust panic.
   The Slint result below was a launch-success this step caught as a crash.
- The device may be attached over USB or wirelessly (Xcode wireless debugging),
   and the whole chain
  works over wifi (confirmed 2026-06-12 with a wireless screenshot of a live app).
   `xcodebuild`,
  `dotnet`,
   and `ios-deploy` use the network device by default;
   `ios-deploy`'s `-W` only disables wifi.
  The libimobiledevice verify tools need the `-n`/`--network` flag to target the network device:
  `idevicescreenshot -n`,
   `idevicedebug -n run`,
   `idevicecrashreport -n`,
   `ideviceinfo -n`.
   Large AOT
  installs and long debug holds are slower over wifi than USB,
   so USB is the fallback if an install
  stalls,
   but functionally wifi covers install,
   run,
   screenshot,
   and crash-log retrieval.
- A trust drop mimics a framework failure.
   Because every gate reuses one bundle id,
   swapping gates means
  uninstall then install,
   and during that gap the cert has zero installed apps,
   which drops the
  device-wide developer trust.
   The next launch then fails with "invalid code signature,
   inadequate
  entitlements or its profile has not been explicitly trusted by the user,
  " a message that reads like a
  codesign or framework defect but is neither.
   Confirmed 2026-06-12:
   the Uno Release build first failed
  to launch this way,
   the owner re-approved the developer in **Settings ▸ General ▸ VPN & Device
  Management**,
   and the identical build then installed and rendered "Hello Uno Platform!
  " Before blaming
  a framework for a launch failure,
   rule out a trust drop.
   Mitigations (see the codesign runbook):
   a
  permanent anchor app on a distinct bundle id (`dev.monochromatic.iosvet.anchor`) stays installed so the
  cert never reaches zero apps,
   and gate swaps use `ideviceinstaller -n upgrade` (in place) rather than
  uninstall then install.
- An invisible UI mimics a render failure.
   A self-drawing framework (Compose,
   Skia/Skiko-backed,
   and
  likely others) defaults its canvas to dark or transparent,
   so a screenshot of a live,
   non-crashed app
  whose UI uses the framework's default near-black text reads as a pure-black screen,
   indistinguishable
  from "nothing rendered.
  " Confirmed 2026-06-12:
   the first Compose build screenshotted all-black while
  `idevicedebug` reported the process held alive;
   rebuilding the same app with an explicit high-contrast
  background (`Modifier.background(Color(0xFF1565C0))`) and white text rendered correctly.
   Before
  concluding a framework does not render,
   check whether the process is alive (`idevicedebug` holds it,
  no crash report) and gate with an explicit solid background plus contrasting text;
   never rely on a
  framework's default canvas color for screenshot verification.

## Results

### Capacitor: PASS (substrate for the WKWebView group)

Status:
 device + latest-simulator confirmed (device 2026-06-12;
 simulator leg added 2026-06-12).

Simulator leg (dual-target criterion):
 the same `App.xcodeproj` rebuilt with `-sdk iphonesimulator
CODE_SIGNING_ALLOWED=NO`,
 installed and launched on iPhone 17 Pro / iOS 26.5 via `simctl`,
 rendered the
WKWebView page ("Capacitor vet / WKWebView OK").
 One codebase,
 SDK switch only.

A minimal Capacitor app (`~/ios-vet/capgate`,
 one WKWebView page) built and launched on the iPhone X.
Decisive facts from the build log:

- Capacitor 7 generates a plain `App.xcodeproj` driven by Swift Package Manager,
   not CocoaPods.
   It
  pulls `capacitor-swift-pm` 8.4.0 as a remote SPM dependency plus a local `CapApp-SPM` package;
   there
  is no Podfile or `.xcworkspace`.
   This gate therefore proves the SPM signing path,
   not the CocoaPods
  path;
   React Native,
   Flutter,
   Cordova,
   and NativeScript still need their Pods or other integration
  proven on device before they count as gated.
- `cap init capgate dev.monochromatic.iosvet.hellodevice` forced the bundle id into the pbxproj
  (Debug and Release),
   so the existing profile signed it directly.
- Signing identity `Apple Development: little.plan2433@fastmail.com (L3DN5L9CVL)`,
   profile
  `iOS Team Provisioning Profile: dev.monochromatic.iosvet.hellodevice`
  (`b08f51d5-37ba-4462-b098-d1533058bf16`),
   `** BUILD SUCCEEDED **`,
   `ios-deploy ... run` printed
  `success`.
- Render-verified:
   held alive with `idevicedebug -d run` and screenshotted,
   the WebView draws the page
  content (`Capacitor vet` / `WKWebView OK`),
   not a blank or home screen,
   with no dyld error or crash
  report.
   WKWebView a11y is native (WebKit maps ARIA to iOS accessibility),
   so there is no iOS-17 wall.

Because Apache Cordova,
 Ionic,
 Framework7,
 Onsen UI,
 and Quasar all render their UI inside the same
WKWebView the Capacitor (or Cordova) shell hosts,
 this PASS establishes the substrate for all of them.
What remains for those is layer-specific (the JS UI library and the plugin used for the in-app HTTP
server,
 native FFI,
 and background),
 not a fresh substrate gate.
 Cordova still warrants its own
substrate gate only to compare its shell against Capacitor's;
 the four UI layers do not.

### Slint: FAIL, disqualified for the iPhone X (the iOS backend is iOS 17+)

Status:
 device-disproven 2026-06-12.
 An earlier revision of this file recorded a Slint PASS.
 That was
wrong:
 it rested on `ios-deploy ... run` printing `success`,
 which only means the process was created
under lldb.
 Held alive with `idevicedebug -d run` and screenshotted,
 the Slint `energy-monitor` demo
does not render;
 it crashes before drawing.
 The build itself does succeed (`cargo build --target
aarch64-apple-ios`,
 winit plus Skia/Metal,
 prebuilt Skia,
 about a two-minute build,
 signed via the vet
keychain reusing profile `b08f51d5...` through `xcodegen generate --spec ios-project.yml`),
 but the
signed app does not run on iOS 16.7.
 Two independent iOS-17 hard dependencies,
 both verified on the
device:

- Accessibility (a11y,
   a hard requirement here) pulls in `accesskit_ios` (latest 0.1.1),
   which
  references four iOS-17-only UIKit symbols unconditionally,
   with no availability guard or weak
  linking:
   `UIAccessibilityPriorityHigh`/`Low` and `UIAccessibilitySpeechAttributeAnnouncementPriority`
  (announcement priority,
   `accesskit_ios/src/event.rs`) and `UIAccessibilityTraitToggleButton`
  (`accesskit_ios/src/node.rs`).
   On iOS 16.7 dyld cannot resolve them and SIGKILLs the app before any
  UI:
   `dyld: Symbol not found: _UIAccessibilityPriorityHigh`.
   A local accesskit fork patched to drop
  these (post the announcement without the iOS-17 priority;
   expose toggles as plain buttons) clears the
  dyld failure,
   but then the second wall fires.
- Slint's own winit iOS backend detects dark/light theme with the iOS-17 `UITrait` system:
  `internal/backends/winit/ios/color_scheme.rs:37` calls `UITraitUserInterfaceStyle::class()` and
  `install_trait_change_observer` (`trait_observer.rs`,
   whose own comment notes
  `registerForTraitChanges:withHandler:` is iOS 17+).
   objc2 resolves the class at runtime and panics on
  iOS 16.7:
   `thread 'main' panicked ... class UITraitUserInterfaceStyle could not be found`
  (`objc2-ui-kit-0.3.2/.../UITrait.rs`).
   This is Slint's own code,
   not a dependency that can be swapped.

So even with the accesskit fork,
 Slint panics on the iPhone X.
 Making Slint run would require forking
both accesskit and Slint's winit iOS backend,
 downporting each iOS-17 API to iOS 16,
 accepting the a11y
fidelity loss above,
 and re-verifying after every Slint bump,
 with no guarantee further iOS-17
dependencies will not surface (this exploration found five distinct iOS-17 API uses across two crates).
The iPhone X is A11 and never receives iOS 17.
 This is the iOS analog of Slint's Android
disqualification (the Android series' `vet-slint-rust.md`:
 dex loading blocked on GrapheneOS):
 best repo
fit on paper,
 does not run on the owner's device on either platform.
 Under the a11y-must rule,
 Slint is
disqualified for this device.
 Every other candidate uses native iOS accessibility (UIKit or WebKit),
which works on iOS 16.7 with no iOS-17 dependency,
 so none of them hit this wall.

### Flutter: PASS (Dart AOT, managed-runtime family)

Status:
 device + latest-simulator confirmed (device 2026-06-12;
 simulator leg added 2026-06-12).

A `flutter create` app built in Release configuration (Dart AOT) launched on the iPhone X.
 Decisive
facts:

- Release config compiles Dart to an AOT snapshot (`libdart_aotruntime`,
   `App.framework`),
   so this is
  the shipping execution model,
   not the JIT debug path.
   It clears wall 2 for the managed-runtime
  family (the iOS twin of the same AOT requirement the .
  NET trio faces).
- Driven through the proven xcodebuild pattern on `ios/Runner.xcworkspace` with overrides
  `PRODUCT_BUNDLE_IDENTIFIER=dev.monochromatic.iosvet.hellodevice DEVELOPMENT_TEAM=HWLVAKDV4F
  CODE_SIGN_STYLE=Automatic`;
   signed with the vet keychain reusing profile `b08f51d5...`,
   no call to
  Apple.
   `** BUILD SUCCEEDED **`,
   `ios-deploy ... run` printed `success`.
- Render-verified:
   held alive with `idevicedebug -d run` and screenshotted,
   the default Flutter counter
  UI draws (`You have pushed the button this many times: 0`,
   the `+` FAB),
   with no dyld error or crash
  report.
   Flutter a11y is native (its semantics tree bridges to UIKit accessibility,
   iOS 12+),
   so there
  is no iOS-17 wall.
- Simulator leg (dual-target criterion):
   the same `flutter create` project,
   built with `flutter build
  ios --simulator --debug` (Flutter supports only debug on the simulator,
   no AOT release) and launched on
  iPhone 17 Pro / iOS 26.5,
   renders the same Material counter UI.
   One important headless-harness gotcha:
  Flutter 3.44 is Impeller-only on iOS,
   and Impeller on a `simctl`-booted simulator with no Simulator.
  app
  GUI never presents a frame,
   so the standalone `simctl launch` screenshotted pure black while the process
  was alive (the os_log showed the app up but no first frame).
   The render captured only after forcing the
  Skia fallback with `FLTEnableImpeller=false` in `Info.plist`.
   This is a headless-capture limitation,
   not
  a Flutter one:
   Impeller renders fine on the real device and in the GUI Simulator.
  app,
   so Flutter works on
  both targets from one codebase;
   the flag is a verification workaround and was removed afterward (the app
  ships with Impeller).
   Any future Impeller/Metal-presenting framework gated headlessly may need the same
  treatment (see the gate-mechanism note).
- Caveat on the CocoaPods claim:
   a plugin-less `flutter create` generates NO `Podfile` (the log shows
  "No Podfile found");
   Flutter integrates its own framework via a generated xcconfig plus a build
  phase,
   not CocoaPods,
   until a plugin pulls pods in.
   So neither Capacitor (SwiftPM) nor this Flutter
  app exercised CocoaPods.
   The CocoaPods + `.xcworkspace` signing path is still unproven and will be
  settled by the React Native gate (or a Flutter app with a plugin).

### .NET / Microsoft.iOS: PASS (substrate + MAUI + Avalonia + Uno all render-verified)

Status:
 substrate,
 MAUI,
 Avalonia,
 and Uno all device + latest-simulator confirmed 2026-06-12.
 The whole
.
NET trio renders on the iPhone X and on iPhone 17 Pro / iOS 26.5 with no iOS-17 wall.
 They differ in
a11y posture by renderer (MAUI native UIKit;
 Avalonia and Uno-Skia self-drawn with their own a11y
bridges);
 see the per-framework notes below.
 The simulator leg,
 including the Rust dual-triple fix it
forced,
 is documented after the substrate FFI discussion.

The .
NET trio (MAUI,
 Avalonia,
 Uno) shares one iOS substrate:
 the Microsoft.
iOS workload's Mono runtime,
AOT-compiled for the device (iOS forbids JIT).
 This gate proves that substrate on the iPhone X with a
minimal Microsoft.
iOS UIKit app (`~/ios-vet/mauigate`,
 `net10.0-ios`,
 `dotnet new ios`,
 bundle id forced
to `dev.monochromatic.iosvet.hellodevice` via `ApplicationId` plus `Info.plist`),
 built and signed over
SSH with the vet keychain reusing profile `b08f51d5...`,
 in both execution models,
 each render-verified:

- Release,
   full AOT (the shipping model):
   `dotnet build -c Release -p:RuntimeIdentifier=ios-arm64`.
  Per-assembly `.aotdata.arm64` files in the bundle (including `System.Private.CoreLib.aotdata.arm64`
  and `aot-instances.aotdata.arm64`) confirm full AOT.
   Held alive with `idevicedebug -n run` and
  screenshotted,
   the app draws a native UIKit `UILabel` reading ".
  NET iOS gate OK / Rust FFI
  returns:
   720".
- Debug,
   interpreter:
   `dotnet build -c Debug -p:MtouchInterpreter=all`.
   The app assembly `mauigate.dll`
  ships with no `mauigate.aotdata.arm64`,
   confirming it runs interpreted,
   not AOT.
   Same render,
   same
  `Rust FFI returns: 720`,
   no crash report.
   The Mono interpreter is a bytecode interpreter that
  allocates no executable memory,
   so it is iOS-legal;
   this confirms even the fully-interpreted path
  clears the execmem wall on 16.7.

The `720` is decisive:
 it is 6!
 computed inside a linked Rust staticlib (`rust/`,
 `crate-type =
["staticlib"]`,
 `rust_gate_answer`) through a heap `Vec` plus an iterator (not a folded constant),
 and
returned across `[DllImport("__Internal")]`.
 `nm` on the signed Mach-O shows `_rust_gate_answer` linked
into the main executable at `0000000100004000 T` (a `NativeReference` with `ForceLoad`),
 so `__Internal`
resolves it.
 The label shows 720 only if the P/Invoke into native Rust actually ran and returned,
 which
means Mono (AOT in Release,
 interpreter in Debug) called into a linked Rust `.a` on iOS 16.7 with no
JIT,
 no `EXC_BAD_ACCESS`,
 and no codesign/execmem kill.
 This is the exact static-lib linkage the
kopia-to-pCloud core (kopia as a gomobile c-archive,
 or a Rust shim) and the music-player Rust core
need:
 managed UI code calling a linked native archive over FFI.

Simulator leg and the Rust dual-triple fix (dual-target criterion,
 2026-06-12):
 all four .
NET apps were
rebuilt with `dotnet build -c Debug -f net10.0-ios -p:RuntimeIdentifier=iossimulator-arm64` and run on
iPhone 17 Pro / iOS 26.5 via `simctl`.
 The substrate (`mauigate`) exposed the central one-codebase issue
for every Rust-linking framework in this vet:
 its `NativeReference` pointed at the device Rust slice
(`rust/target/aarch64-apple-ios/release/librustgate.a`),
 so the simulator build failed at link with `ld:
building for 'iOS-simulator', but linking in object file ... built for 'iOS'`.
 A device arm64 archive and
a simulator arm64 archive are the same CPU arch but different platform triples and cannot be lipo'd into
one fat file;
 the fix is to build the Rust core for both triples and select by RID.
 The Rust core was
built for `aarch64-apple-ios-sim` (`cargo build --release --target aarch64-apple-ios-sim`,
 target already
installed) and the csproj made RID-conditional with one property (same source,
 per-target lib):

```xml
<RustTriple Condition="$(RuntimeIdentifier.StartsWith('iossimulator'))">aarch64-apple-ios-sim</RustTriple>
<RustTriple Condition="'$(RustTriple)' == ''">aarch64-apple-ios</RustTriple>
<!-- ... -->
<NativeReference Include="rust/target/$(RustTriple)/release/librustgate.a" />
```

The device build (already passed) is unchanged because `RustTriple` defaults to `aarch64-apple-ios`.
 The
simulator substrate then rendered ".
NET iOS gate OK / Rust FFI returns:
 720",
 proving the Rust value
crosses on the simulator slice too.
 This dual-triple build is mandatory for the kopia/music-player Rust
cores and for every remaining Rust-linking gate (React Native,
 NativeScript,
 Lynx,
 Qt):
 ship the Rust
core as both `aarch64-apple-ios` and `aarch64-apple-ios-sim` (an XCFramework packages both cleanly),
 not
a single device archive.
 Renders:
 MAUI drew its dotnet-bot/"Hello,
 World!
"/"Click me" XAML,
 Avalonia drew
"Welcome to Avalonia!
" (its SkiaSharp/Metal renderer presents frames headlessly,
 like Compose/Skiko and
unlike Flutter's Impeller),
 and Uno drew "Hello Uno Platform!
".
 All four are device + simulator confirmed.

- Signing:
   `dotnet build` auto-detected identity `1690CF17...` and profile UUID `b08f51d5...` (team
  `HWLVAKDV4F`,
   app id `HWLVAKDV4F.dev.monochromatic.iosvet.hellodevice`) through the vet keychain in
  the search list,
   no call to Apple,
   fully unattended over SSH.
- a11y:
   a UIKit `UILabel` is a native accessibility element (iOS 12+).
   MAUI iOS renders through native
  UIKit handlers,
   so it inherits native a11y with no iOS-17 dependency,
   unlike Slint.
   Avalonia and Uno's
  default Skia renderer self-draw and route a11y through their own bridges (see their notes below);
   none
  of the three depends on an iOS-17 API.

Scope of this PASS,
 and what it does NOT cover:
 it gates the shared Microsoft.
iOS execution substrate
(Mono AOT plus interpreter,
 native FFI,
 a native UIKit render),
 which all of MAUI,
 Avalonia,
 and Uno sit
on.
 It does NOT gate the three frameworks themselves,
 and the Capacitor analogy only goes so far.
 The
six web frameworks run as JS/HTML inside the same WKWebView and ship no native iOS code,
 so the WKWebView
substrate genuinely covers them;
 MAUI,
 Avalonia,
 and Uno each ship substantial native iOS framework code
(handlers/renderers,
 theme and a11y bridges,
 startup) that this bare `dotnet new ios` app never runs.
That distinction is load-bearing because of exactly where Slint failed:
 not in its substrate (winit,
Skia,
 Metal were fine) but in its own framework code (`accesskit_ios`'s a11y symbols and
`color_scheme.rs`'s `UITraitUserInterfaceStyle`).
 A bare UIKit app would have falsely passed Slint.
 So
each of MAUI,
 Avalonia,
 and Uno needs its own on-device render gate,
 watched specifically for the Slint
signature (a dyld `Symbol not found`,
 or an objc2/class-not-found panic on an iOS-17 API) before the
screenshot.
 Until those land each framework is substrate-proven but UI-unproven.

MAUI itself:
 PASS (UI render-verified 2026-06-12).
 An actual `dotnet new maui` app (`~/ios-vet/mauiui`,
TFM trimmed to `net10.0-ios`,
 `ApplicationId` forced,
 Release full AOT,
 signed via the vet keychain)
installed and rendered its real XAML UI on the iPhone X:
 the Shell `Home` bar,
 the dotnet-bot image,
"Hello,
 World!
",
 "Welcome to .
NET Multi-platform App UI",
 and a styled "Click me" button,
 all drawn
through MAUI's native UIKit handlers.
 No fresh crash report named the app,
 and the launch showed none of
the Slint signature (no dyld `Symbol not found`,
 no objc2 class-not-found).
 MAUI reads dark/light through
the iOS-12-era `UITraitCollection.userInterfaceStyle` (the screenshot is in the device's dark mode),
 not
Slint's iOS-17 `UITraitUserInterfaceStyle` observer,
 which is exactly why MAUI renders on 16.7 where
Slint does not.
 Native UIKit handlers give native a11y.
 So MAUI is the first trio member gated as a
framework,
 not just on the shared substrate.

Avalonia itself:
 PASS (UI render-verified 2026-06-12).
 An actual `dotnet new avalonia.xplat` iOS head
(`~/ios-vet/avx/avx.iOS`,
 Avalonia 12.0.4,
 `net10.0-ios`,
 CFBundleIdentifier forced,
 Release full AOT,
signed via the vet keychain) installed and rendered "Welcome to Avalonia!
" on the iPhone X,
 drawn by
Avalonia's own SkiaSharp renderer on a Metal/GL layer (not native UIKit controls).
 No fresh crash report,
no Slint signature.
 a11y caveat under the a11y-must rule:
 because Avalonia self-draws,
 its accessibility
goes through Avalonia's own iOS `AutomationPeer`-to-`UIAccessibility` bridge,
 not native UIKit,
 so its
a11y fidelity (does VoiceOver actually read its controls and states?
) is a stage-2 question the render
gate does not answer.
 The render and the absence of any iOS-17 wall are proven;
 the a11y depth is not.

Uno itself:
 PASS (UI render-verified 2026-06-12).
 An actual `dotnet new unoapp -preset blank` app
(`~/ios-vet/unogate`,
 Uno.
Sdk 6.5.
x,
 TFM trimmed to `net10.0-ios`,
 `ApplicationId` forced,
 Release full
AOT,
 signed via the vet keychain) installed and rendered "Hello Uno Platform!
" on the iPhone X.
 The blank
template defaults to `UnoFeatures: SkiaRenderer`,
 so Uno 6 self-draws on Skia like Avalonia (not native
UIKit);
 the same a11y caveat applies (Uno's own automation-to-iOS bridge,
 fidelity is stage-2).
 Uno does
also ship a native-UIKit renderer (legacy Uno.
UI),
 which would give native a11y at the cost of the older
rendering path;
 under the a11y-must rule that native renderer,
 not the Skia default,
 is Uno's a11y-safe
configuration and should be the one re-verified in stage 2.
 No fresh crash report,
 no Slint signature.

So all three frameworks are now gated as frameworks,
 not just on the shared substrate.
 Net a11y posture,
which matters under the a11y-must rule:
 MAUI is strongest (native UIKit handlers,
 native a11y for free);
Avalonia and Uno render fine but their default (self-drawn Skia) a11y rides a custom bridge whose iOS
fidelity is a stage-2 check,
 with Uno's native renderer as its a11y-safe fallback.

Hold the line on what "PASS" means here:
 render is device-confirmed for all three,
 but on-device a11y
(VoiceOver actually reading the controls) is confirmed for none.
 MAUI's native a11y is a strong
architectural inference (native UIKit handlers),
 not yet VoiceOver-tested;
 Avalonia and Uno-Skia are
render-PASS but a11y-TBD.
 "Trio PASS" means "renders on iOS 16.7,
" not "a11y cleared.
" Under the
a11y-must rule a11y is still owed on every track,
 and is the exact criterion that disqualified Slint,
 so
no downstream summary should let a render PASS or a ranking position stand in for a11y confirmation.
 That
VoiceOver pass is a stage-2 task for every surviving framework.

Toolchain notes for reproduction (Homebrew dotnet 10.0.300):
 the prior session's `dotnet workload
install ios` had written only the iOS manifest,
 not the runtime/AOT packs,
 so the first device build
failed `NETSDK1147: workloads must be installed: ios` even though `dotnet --info` listed the workload.
`dotnet workload restore` in the project pulled the missing packs (the `osx-arm64.Cross.ios-arm64` AOT
cross-compiler and the `Mono.ios-arm64` device runtime).
 The Microsoft.
iOS project templates are also
not registered by the workload install under Homebrew dotnet and were added with
`dotnet new install Microsoft.iOS.Templates`.

### Compose Multiplatform: PASS (Kotlin/Native AOT, Skiko/Metal self-renderer)

Status:
 device + latest-simulator confirmed 2026-06-12,
 render screenshots captured on both.

A Compose Multiplatform iOS app built from the JetBrains `compose-multiplatform-ios-android-template`,
trimmed to iOS-only,
 drew a solid-fill UI with text on the iPhone X.
 Decisive facts:

- Version matrix matters and the template's pins are dead on arrival.
   The stock template pins Kotlin
  1.9.21,
   Compose Multiplatform 1.5.11,
   Gradle 8.2.1,
   which fails twice over:
   Gradle 8.2.1 cannot run on
  JDK 21 (needs 8.5+),
   and Kotlin/Native gained Xcode 26 support only in Kotlin 2.2.21,
   so 1.9.21 will
  not link against the Xcode 26.5 iOS SDK.
   The working quad is Kotlin 2.4.0,
   Compose Multiplatform
  1.11.1,
   Gradle 8.14,
   on Temurin JDK 21,
   with Xcode 26.5.
   Kotlin 2.4.0 is certified to Xcode 26.4;
   the
  26.4-to-26.5 point bump linked cleanly (no SDK mismatch),
   confirming the concern did not materialize.
- Trimmed to iOS-only on purpose:
   the Android module was removed (no `androidApp`,
   no `androidTarget`,
   no
  AGP) so the build needs no Android SDK.
   The `:shared` module exposes a static framework
  (`isStatic = true`),
   Kotlin/Native LLVM-AOT,
   so the Compose runtime is statically linked into the app
  binary (no separate `Frameworks/shared.framework`).
   The Konan LLVM/iOS toolchain (~1 GB) and all Gradle
  caches live on MacData (`KONAN_DATA_DIR`,
   `GRADLE_USER_HOME`).
   First `linkDebugFrameworkIosArm64`
  succeeded in 2m 32s.
- Built through the proven xcodebuild pattern on `iosApp/iosApp.xcodeproj`,
   scheme `iosApp`,
   which runs
  the `:shared:embedAndSignAppleFrameworkForXcode` build phase (the embed phase inherits `JAVA_HOME`,
  `GRADLE_USER_HOME`,
   `KONAN_DATA_DIR` from the SSH session).
   Bundle id landed on
  `dev.monochromatic.iosvet.hellodevice` via the xcconfig (`BUNDLE_ID` set,
   `TEAM_ID` left empty so the
  `${BUNDLE_ID}${TEAM_ID}` concat has no suffix) with `DEVELOPMENT_TEAM=HWLVAKDV4F` passed on the
  xcodebuild line.
   Signed with the vet keychain (cert `1690CF17...`),
   reusing profile `b08f51d5...`,
   no
  call to Apple.
   `** BUILD SUCCEEDED **`.
   Installed with `ideviceinstaller -n upgrade` (in place,
   trust
  held by the anchor).
- Render-verified on the device:
   held alive with `idevicedebug -n run` and screenshotted,
   the screen
  shows a solid blue (`0xFF1565C0`) background with white "Compose Gate" and "Compose Multiplatform on
  iOS" text.
   Process held alive,
   no dyld error,
   no crash.
   Skiko/Metal self-rendering works on the A11 /
  iOS 16.7 device.
- Render-verified on the latest simulator (the dual-target criterion):
   the same `iosApp.xcodeproj` and
  `:shared` source,
   rebuilt with `-sdk iphonesimulator CODE_SIGNING_ALLOWED=NO` (the `iosSimulatorArm64`
  slice,
   no signing),
   installed and launched on iPhone 17 Pro / iOS 26.5 via `simctl`,
   drew the identical
  blue UI (`simctl io ... screenshot`,
   written to internal `/tmp`).
   One codebase,
   no device-only or
  simulator-only fork:
   the `:shared` module already declares `iosArm64` and `iosSimulatorArm64` from the
  same `commonMain`/`iosMain` sources,
   and the Xcode project switches only the SDK.
- a11y standing (must,
   not yet exercised on-device):
   Compose Multiplatform bridges its semantics tree to
  iOS `UIAccessibility` (the iOS accessibility integration landed in CMP 1.6 and has matured since),
   so
  its a11y is a native bridge (Avalonia-class,
   not WebKit-clean),
   iOS 14+,
   no iOS-17 wall.
   Render is
  confirmed;
   on-device VoiceOver confirmation is still owed,
   as for every surviving framework.
- In-app HTTP server (for the kopia/pCloud and music-player server needs):
   research-verified from the
  published Gradle module metadata that `ktor-server-cio:3.5.0` ships an `iosArm64ApiElements-published`
  variant,
   so `embeddedServer(CIO)` compiles for the device.
   Caveat:
   Ktor's native server supports only
  the CIO engine and has no built-in HTTPS without a reverse proxy,
   so on-device it is plain HTTP bound to
  localhost.
   Building that server on-device and the Rust `.a` cinterop are stage-2 deep checks,
   not yet
  run;
   the render gate (the must) is passed.

### React Native: PASS render + Hermes + Rust crossing (both legs)

Status:
 render + Hermes + Rust crossing + dual-target device + simulator all confirmed 2026-06-12.
 The
Rust-crossing half (an Objective-C `.m` shim over a C ABI,
 owner-approved deviation) landed:
 a Rust
staticlib value (`rust_gate_answer() = 720`,
 a heap `Vec` + iterator `product`,
 the same `.a` the .
NET
gate used) crossed Rust -> Obj-C -> JS and rendered on both legs.

A React Native 0.86.0 app (`/Volumes/MacData/ios-vet/RnGate`,
 `@react-native-community/cli init`) renders
on both targets from one codebase.
 Decisive facts:

- CocoaPods proven (the path Capacitor's SPM and plugin-less Flutter left unproven):
   `init` generated
  `ios/RnGate.xcworkspace` with an installed `Pods/` tree (`hermes-engine`,
   `React.framework`,
  `ReactNativeDependencies.framework`),
   built through the `.xcworkspace`,
   not a bare `.xcodeproj`.
- Hermes live:
   `App.tsx` reports `global.HermesInternal` is a non-null object,
   and the screen reads
  "Hermes:
   ON" on both targets.
   Built `-configuration Release`,
   which precompiles the JS bundle to Hermes
  bytecode inside the app (`hermesvm.framework` signed into the bundle) and needs no Metro server at
  launch,
   so this is the AOT-bytecode shipping path,
   not the JIT/Metro debug path,
   and it is iOS-legal
  (no executable-memory allocation).
   The Release bundling phase needs node;
   `ios/.xcode.env.local` pins
  `NODE_BINARY` to the real mise node binary so the Xcode build phase resolves it over SSH.
- Device leg (iPhone X,
   iOS 16.7):
   `xcodebuild -workspace ... -scheme RnGate -configuration Release
  -destination generic/platform=iOS` with `DEVELOPMENT_TEAM=HWLVAKDV4F
  PRODUCT_BUNDLE_IDENTIFIER=dev.monochromatic.iosvet.hellodevice CODE_SIGN_STYLE=Automatic`,
   signed with
  the vet keychain reusing profile `b08f51d5...`,
   `** BUILD SUCCEEDED **`,
   upgrade-installed,
   held alive
  with `idevicedebug -n run`,
   screenshot shows blue "RN Gate / Hermes:
   ON",
   no crash.
- Simulator leg (iPhone 17 Pro / iOS 26.5):
   same workspace,
   `-sdk iphonesimulator CODE_SIGNING_ALLOWED=NO`,
  `simctl` install/launch,
   same "RN Gate / Hermes:
   ON".
   One codebase,
   SDK switch only.
- a11y:
   React Native renders to native `UIView`/`UILabel` (it does not self-draw a canvas),
   so a11y is
  native UIKit (iOS 12+),
   no iOS-17 wall.
   On-device VoiceOver confirmation owed (tracked).
- Rust crossing (PASS,
   owner-approved Obj-C deviation):
   a Rust staticlib reached JS through a thin
  Objective-C `.m` NativeModule over a C ABI (no `.c`/`.cpp`/`.mm`,
   no New-Arch C++/JSI TurboModule).
   The
  app screen reads "Rust answer:
   720 / CROSSING OK" (blue only when the value equals 720;
   red otherwise),
  on both the iPhone X (iOS 16.7) and the iPhone 17 Pro / iOS 26.5 simulator,
   from one codebase.
   The path:
  - Packaging:
     the Rust core built for `aarch64-apple-ios` + `aarch64-apple-ios-sim`,
     packed with
    `xcodebuild -create-xcframework` into `RustGate.xcframework` (slices `ios-arm64` + `ios-arm64-simulator`).
    This is the dual-triple rule realized as an XCFramework,
     the same shape the kopia/music-player cores need.
  - Shim:
     `modules/rust-gate/ios/RustGate.m` is the entire Obj-C surface,
     a legacy `RCTBridgeModule` that
    declares `extern int rust_gate_answer(void);` (the only C-ABI line) and returns it via
    `constantsToExport`.
     No app logic,
     no `.c`/`.cpp`/`.mm`.
  - Integration without hand-editing the pbxproj:
     a local pod (`rust-gate.podspec`,
     `source_files` the
    `.m`,
     `vendored_frameworks` the XCFramework) plus an app-root `react-native.config.js` whose
    `dependencies.rust-gate.root` points autolinking at the module.
     `pod install` then compiles the shim and
    links the matching XCFramework slice per platform;
     `Installing rust-gate (0.0.1)` confirmed autolink.
  - New Architecture finding:
     RN 0.86 defaults to the New Architecture (bridgeless),
     yet a legacy Obj-C
    `RCTBridgeModule` + `constantsToExport` still surfaces through the interop layer:
    `NativeModules.RustGate.answer` resolved to 720 on both legs with no `newArchEnabled=false`,
     no
    C++/JSI TurboModule.
     This is the clean answer to "must we write C++ for a New-Arch native module":
     no.
  - x86_64-simulator caveat (RN-specific manifestation of the dual-triple rule):
     a Release sim build
    compiles all simulator archs by default (`ONLY_ACTIVE_ARCH=NO`),
     so it tried to link an x86_64 slice the
    XCFramework does not carry (`ld: library 'rustgate' not found`,
     target `x86_64-apple-ios-simulator`).
     On
    this Apple-silicon Mac the fix is `ARCHS=arm64 ONLY_ACTIVE_ARCH=YES`;
     an Intel-Mac simulator would
    additionally need an `x86_64-apple-ios` Rust slice in the XCFramework (a triple-triple,
     not just dual).
  - The build also compiles RN's own `ReactCodegen` C++ (Fabric/New-Arch glue).
     That is framework-internal
    substrate,
     the same category as Hermes being C++;
     the no-C/C++ rule governs our code,
     and our module is
    pure Obj-C + Rust.
     Worth stating so the C++ in the build log is not mistaken for a rule breach.

### NativeScript: FULL PASS (both legs), jitless V8 survives AMFI, Rust crossing with zero native code

Status:
 render + dual-target + Rust crossing all confirmed 2026-06-12;
 the device leg is the load-bearing
test and it passes.
 Notably the Rust crossing needed no hand-written native code at all (not even the
Obj-C `.m` shim React Native required):
 a C-ABI header declaration,
 a clang modulemap,
 and one linker flag.

NativeScript 9.0.6 CLI,
 `@nativescript/core ~9.0.0`,
 `@nativescript/ios` 9.0.3 runtime (V8 10.3.22),
plain-JS Core template (`ns create nsgate --js`) at `/Volumes/MacData/ios-vet/nsgate`.
 The UI is a blue
full-screen page (`app/main-page.xml`) whose JS view-model computes `[1..6].reduce((a,b)=>a*b,1) = 720`,
so a rendered number proves V8 actually executed the bundle,
 not merely that the process launched.

- The device leg IS the gate.
   The iOS Simulator does not enforce AMFI / the W^X executable-memory
  prohibition,
   so a green simulator cannot answer the jitless-V8 question;
   only the iPhone X can.
   On the
  iPhone X (iOS 16.7) the screen reads "NS Gate / V8 JS:
   720 / render-only" and the runtime log reads
  "Runtime initialization took 58ms (version 9.0.3,
   V8 version 10.3.22)":
   V8 initialized and ran the JS
  on-device with no AMFI execmem kill and no crash report.
   This is the iOS inverse of NativeScript's
  Android `DENY_EXECMEM` death (recorded in the source audit);
   on iOS the jitless V8 (plus
  libffi-static-trampoline native calls) survives.
   Built `-configuration Debug` from the
  NativeScript-generated `platforms/ios/nsgate.xcodeproj` with the proven vet-keychain wrapper (unlock +
  search-list add + `DEVELOPMENT_TEAM=HWLVAKDV4F
  PRODUCT_BUNDLE_IDENTIFIER=dev.monochromatic.iosvet.hellodevice`),
   upgrade-installed,
   held alive with
  `idevicedebug -n run`.
- Simulator leg (iPhone 17 Pro / iOS 26.5):
   same xcodeproj,
   `-sdk iphonesimulator ARCHS=arm64
  ONLY_ACTIVE_ARCH=YES CODE_SIGNING_ALLOWED=NO`,
   same "NS Gate / V8 JS:
   720".
   Satisfies the dual-target
  criterion only;
   it does not (and cannot) validate the AMFI question.
- Build path:
   `ns prepare ios` generates the xcodeproj and runs webpack + metadata,
   then build the
  generated project directly with the keychain wrapper (this sidesteps `ns build`'s own signing logic,
  which would not thread the vet keychain through `OTHER_CODE_SIGN_FLAGS`;
   the search-list addition,
   not
  the flag,
   is what resolves the identity).
   Toolchain snag:
   `ns prepare ios` runs a bare `ruby -e
  "require 'xcodeproj'"` to merge xcconfig,
   and Homebrew's standalone `pod` bundles that gem privately,
   so
  prepare aborts with `LoadError` / exit 127 until `gem install xcodeproj` (1.27.0) puts it on the system
  ruby's gem path.
   `@nativescript/ios` 9.0.3 builds clean on Xcode 26 (no Kotlin/Native-style toolchain
  bump needed,
   and its runtime XCFramework already ships an arm64-simulator slice).
- a11y:
   NativeScript renders to native UIViews (UILabel/UIView),
   so a11y is native UIKit (VoiceOver owed).
- Rust crossing (PASS,
   zero hand-written native code):
   `rust_gate_answer() = 720` crosses Rust -> JS and
  the screen reads "NS Gate / V8 JS:
   720 / Rust:
   720 / CROSSING OK" on both the iPhone X and the iOS 26.5
  simulator.
   The mechanism,
   and the two non-obvious snags it surfaced:
  - Metadata exposure needs a clang module,
     not just a header on the include path.
     A default static-library
    pod exposes `rustgate.h` via `-I` only (no modulemap),
     and NativeScript's `objc-metadata-generator`
    works on clang modules,
     so `rust_gate_answer` was absent from the generated metadata and JS saw
    `undefined`.
     Fix:
     a `module.modulemap` + header in `App_Resources/iOS/src/` (NativeScript's documented
    custom-native hook;
     the generator already has `-I App_Resources/iOS/src` on its command line).
     After
    that the generator's umbrella `#import`s the header and `rust_gate_answer` appears in `metadata-arm64.bin`.
  - The symbol must survive the link.
     Only JS references the function (at runtime,
     via the metadata),
     so
    `-dead_strip` dropped the static-lib member entirely (`nm` showed it absent),
     and NativeScript's
    runtime resolved a null address and aborted (`Assertion failed ... Helpers.mm`,
     signal 9,
     before any
    render).
     Fix:
     `OTHER_LDFLAGS = $(inherited) -u _rust_gate_answer` in `App_Resources/iOS/build.xcconfig`
    keeps it as a dead-strip root;
     the runtime's `-rdynamic` then exports it so the address resolves.
     After
    that `nm` shows `T _rust_gate_answer` and the call returns 720.
  - Linking vs metadata are separate concerns:
     the local pod (`vendored_frameworks`) links the dual-triple
    XCFramework (the same one RN used);
     the `App_Resources/iOS/src` modulemap exposes the symbol to the
    metadata bridge.
     No `.m`/`.c`/`.cpp`/`.mm`,
     no Swift glue:
     only a C-ABI declaration,
     a modulemap,
     and a
    linker flag,
     all config/declarations.
     This is the cleanest Rust crossing of any gate so far.

### Lynx: FULL PASS (both legs), jitless engine survives AMFI, Rust crossing via a pure-ObjC LynxModule

Status:
 render + dual-target + Rust crossing all confirmed 2026-06-12;
 the device leg is the load-bearing
AMFI test and it passes.
 The Rust crossing uses a pure Objective-C `LynxModule` `.m` shim (the
owner-approved thin-bridge deviation),
 not a `.mm`.

Lynx 3.8.1 (`Lynx/Framework` + `PrimJS/quickjs,napi` 3.8.0,
 CocoaPods,
 no devtool) with an
`@lynx-js/rspeedy` 0.14.5 `react-ts` bundle,
 assembled as a hand-built native app (xcodegen project +
CocoaPods workspace) at `/Volumes/MacData/ios-vet/lynxgate`.
 `LynxView` is a genuine UIKit `UIView`
subclass (header-verified `@interface LynxView : UIView`),
 not a WKWebView;
 it renders through native
`LynxUI` text/image/list views.
 The JS bundle computes `[1..6].reduce((a,b)=>a*b,1) = 720`,
 so a rendered
number proves the JS engine executed the bundle,
 not merely that the process launched.

- The device leg IS the gate.
   The iOS Simulator does not enforce AMFI / the W^X executable-memory
  prohibition,
   so only the iPhone X can answer the jitless-engine question.
   On the iPhone X (iOS 16.7) the
  screen reads "Lynx Gate / JS:
   720 / Rust:
   720 / CROSSING OK":
   a jitless JS engine initialized and ran
  the bundle on-device with no AMFI execmem kill and no crash report.
   Engine identity:
   Lynx's iOS build
  ships PrimJS (a QuickJS-derived template interpreter,
   handlers baked into `__TEXT` at build,
   no
  `PROT_EXEC`/`MAP_JIT`) as the lightweight engine and JavaScriptCore as the only alternative;
   V8 is not
  compiled on iOS.
   Both compiled iOS engines are jitless on a non-entitled device,
   so the AMFI-survival
  finding holds regardless of which the background runtime selected.
   The default-engine selection
  (`force_use_lightweight_js_engine`) is not echoed in the device's default-level syslog,
   so this records
  "a jitless engine,
   PrimJS by default" rather than asserting PrimJS specifically from the render alone.
  Built `-configuration Debug` from the xcodegen-generated `LynxGate.xcworkspace` with the proven
  vet-keychain wrapper (unlock + search-list add + `OTHER_CODE_SIGN_FLAGS=--keychain`),
   upgrade-installed,
  held alive with `idevicedebug -n run`.
- Simulator leg (iPhone 17 Pro / iOS 26.5):
   same `.xcworkspace`,
   `-sdk iphonesimulator ARCHS=arm64
  ONLY_ACTIVE_ARCH=YES CODE_SIGNING_ALLOWED=NO` (arm64-only so the arm64-simulator Rust slice links;
   an
  Intel-Mac sim would need an added `x86_64-apple-ios` slice).
   Same "Lynx Gate / JS:
   720 / Rust:
   720 /
  CROSSING OK".
   Satisfies the dual-target criterion only;
   it does not (and cannot) validate the AMFI
  question,
   since the simulator does not enforce AMFI.
- a11y:
   `LynxView` renders native UIKit views,
   so a11y is native UIKit (VoiceOver owed,
   task #7).
- Rust crossing (PASS on device):
   `rust_gate_answer() = 720` crosses Rust -> JS and renders "Rust:
   720 /
  CROSSING OK".
   The native surface is a pure-Objective-C `RustGateModule` implementing the `LynxModule`
  protocol (`+name`,
   `+methodLookup` mapping the JS method `answer` to the `-answer` selector),
   registered
  with `[LynxConfig registerModule:RustGateModule.class]`,
   and called from JS as
  `NativeModules.RustGateModule.answer()`.
   The `-answer` body calls `extern int rust_gate_answer(void)`
  (declaring an extern C function in a `.m` is plain C,
   a strict subset of Objective-C,
   no C++/`.mm`).
  Unlike NativeScript,
   the Rust symbol is referenced by native code (the `-answer` IMP),
   not only by JS at
  runtime,
   so there is no metadata-bridge / dead-strip-of-an-unreferenced-symbol problem.
- Three non-obvious snags this gate surfaced,
   all fixed in CocoaPods/build config (no edits to vendored
  Lynx source):
  - Lynx 3.8.1 and PrimJS 3.8.0 compile each `.cc`/`.m` with a per-file `-Wall -Werror ...`
    `COMPILER_FLAGS`.
     Xcode 26's clang promotes a new strictness warning (`-Wc99-designator` in
    `core/runtime/lepus/vm_context.cc`) that this `-Werror` turns into a hard error (the same Xcode-26
    family as Lynx issues #3157/#3433,
     but a warning they have not yet patched for 3.8.1).
     Fix:
     a Podfile
    `post_install` hook appends `-Wno-error` to the END of every per-file `COMPILER_FLAGS` string (last
    flag wins,
     downgrading `-Werror`),
     plus `GCC_TREAT_WARNINGS_AS_ERRORS = NO`.
     930 files patched.
  - xcodegen's `framework:` dependency for the Rust static-library xcframework did NOT survive CocoaPods
    integration into the app's link phase:
     the project carried the file reference and the `-L`/`-F` search
    paths,
     but the archive was never linked (`-lrustgate` absent),
     so the symbol was left undefined and
    dead-strip dropped the `-answer` IMP while the link still "succeeded".
     Fix:
     link the Rust lib via the
    `rust-gate` local pod (`vendored_frameworks`,
     the same pod RN and NativeScript used) so CocoaPods adds
    `-l"rustgate"`,
     plus `OTHER_LDFLAGS = $(inherited) -u _rust_gate_answer` as a dead-strip-root guarantee
    that doubles as a link-time assertion the lib is actually present.
  - Xcode 16+ `ENABLE_DEBUG_DYLIB`:
     a Debug build splits the app into a thin launcher (`LynxGate`,
     87 KB,
    just loads `@rpath/LynxGate.debug.dylib`) plus `LynxGate.debug.dylib` (49 MB) holding all the real code
    (Lynx statically linked,
     `RustGateModule`,
     `T _rust_gate_answer`).
     An `nm` symbol check on a Debug
    build must target the `.debug.dylib`,
     not the launcher (Release has no split).
     This briefly masked the
    successful link until the dylib was checked directly.
     General note for every future gate's `nm` check.
- Bundle wiring (the silent-failure point:
   a missing bundle renders blank,
   not an error):
   `npm run build`
  emits `dist/main.lynx.bundle` (86 KB),
   shipped flat in the `.app` and loaded by a `TemplateProvider`
  (`pathForResource:@"main.lynx" ofType:@"bundle"`).
   Xcode types the `.bundle` file as `wrapper.cfbundle`
  but copies it intact (verified 85966 bytes inside the built `.app`).
- Build path:
   `npm run build` (rspeedy) for the bundle,
   then xcodegen `generate` + `pod install` for the
  native app,
   then build the `.xcworkspace` with the vet-keychain wrapper.
   There is no Lynx CLI scaffold
  for a signable native app (the LynxExplorer in the repo is the only reference);
   the integration is the
  hand-built pattern above.
   Toolchain installed:
   Node,
   `@lynx-js/rspeedy`/`create-rspeedy`,
   xcodegen,
  CocoaPods,
   xcodeproj gem.

### Qt: CULLED, cannot target the arm64 iOS simulator from prebuilt binaries

Status:
 culled 2026-06-12 at the dual-target prerequisite,
 before any build was attempted.
 Owner rule
(2026-06-12):
 "if we cannot get Qt to run on the arm64 simulator,
 cull Qt.
" Prebuilt Qt cannot,
 and the
only escape hatch is independently blocked by the no-hand-written-C++ rule,
 so Qt is out.

The dual-target blocker (decisive,
 empirical).
 Qt's prebuilt iOS kit ships static libraries for two
platform-arch slices only:
 device `arm64` (Mach-O `LC_BUILD_VERSION` platform 2,
 iphoneos) and simulator
`x86_64` (platform 7,
 iphonesimulator).
 There is no `arm64`-iphonesimulator slice.
 Confirmed by `lipo`
plus `otool -l` on `libQt6Core.a` (Qt 6.5.3) and `QtCore.framework/QtCore` (Qt 6.12.0,
 newest):
 both fat
binaries are `[x86_64 = sim, arm64 = device]`.
 The gap is structural and version-independent:
 two `arm64`
slices (device and simulator) cannot coexist in one fat Mach-O (identical cputype plus subtype),
 which is
the exact reason xcframeworks exist,
 and no Qt kit ships an `.xcframework` (none found anywhere in either
kit).
 aqt exposes a single `ios` arch with no simulator variant.
 The M1's native iOS 26.5 simulator is
`arm64`,
 so it cannot link any prebuilt Qt.

Official corroboration (the community does not conclude Qt is impossible on the simulator,
 only that the
native arm64 simulator is).
 Qt's own iOS docs state it verbatim:
 "The architecture of the Qt for iOS
simulator libraries is x86_64,
 which means the iOS Simulator must run under Rosetta on Apple Silicon
Macs" (doc.
qt.
io/qt-6/ios.
html).
 The tracking ticket QTBUG-101276 "Support arm64 target for builds for
iOS Simulator" is Open with no fix version (created 2022,
 still updated 2026-02).
 Qt's iOS maintainer Tor
Arne Vestbø:
 "we structure our iOS libraries as fat libraries ... arm64 slice for device,
 and x86_64
slice for simulator ... You can't have multiple arm64 slices in a single binary ... Once we move to
xcframeworks we can build the simulator frameworks as universal x86_64+arm64 slices.
" The xcframework
migration (Gerrit qt/qtbase change 515724) is still WIP and unmerged as of 2026-02.
 The owner's bar is
the arm64 simulator,
 which the x86_64-under-Rosetta path does not meet,
 and Rosetta is itself on a clock
(general-purpose Rosetta removed in macOS 28,
 fall 2027).

The only path to the arm64 simulator is a from-source Qt cross-compile (stated as fact,
 not an offer):
build qtbase plus qtdeclarative for `iphonesimulator`/`arm64`,
 a multi-hour build.
 One dated Oct-2025
forum account confirms a qtbase arm64-sim build on M1 / macOS 26 / Qt 6.9.3,
 but no confirmed
qtdeclarative/QML arm64-sim build account exists.
 This is disproportionate for a gate every other
framework cleared with prebuilt tooling,
 and it does not rescue Qt anyway,
 because of the second wall.

Second independent blocker:
 the no-hand-written-C++ rule.
 The only proven iOS path for a Rust-driven Qt
app (CXX-Qt) uses a developer-authored C++ `main.cpp`.
 The one working iOS project (simsapa-ng) and KDAB
cxx-qt issue #1250 are both device-only,
 both ride on unmerged fork patches to `qt-build-utils` (a `.prl`
path fix,
 a `parse_cflags` suffix strip,
 `flag_if_supported` to `flag`,
 lipo thinning) that no longer
apply to current upstream,
 and both create `QGuiApplication`/`QQmlApplicationEngine` in C++.
 The
Rust-`main` path that would satisfy the rule has zero iOS evidence and likely cannot emit a deployable
bundle (`Info.plist`,
 signing,
 `UIApplicationMain` bootstrap) without Qt's CMake/Xcode integration.
 So Qt
fails two of the owner's hard rules at once (arm64 simulator,
 and no hand-written C/C++),
 with the device
leg itself unproven except via unmerged fork code.

Scope note (do not overclaim).
 No Qt gate app was built or rendered.
 Qt ships an arm64-device slice
(platform 2,
 deploys iOS 14+ on 6.5.3) and would plausibly render on the iPhone X device leg,
 but that
was never built;
 Qt is culled upstream of any render,
 at the dual-target prerequisite.
 The finding is "no
prebuilt arm64-sim slice,
" not "Qt fails on the device.
" Unlike Slint (an AMFI/iOS-17-API death),
 this is
a toolchain-packaging limit.
 The downloaded Qt 6.5.3 device and desktop kits under
`/Volumes/MacData/ios-vet/qt` can be removed.

### Dioxus: FULL PASS (both legs), the structural anti-Qt for dual-target

Status:
 FULL PASS 2026-06-12,
 first of the owner-appended set.
 Dioxus 0.7.9 (`dx` CLI),
 render-verified on
BOTH the iPhone X (iOS 16.7,
 `aarch64-apple-ios`) and the iPhone 17 Pro / iOS 26.5 simulator
(`aarch64-apple-ios-sim`) from one codebase:
 blue "Dioxus Gate / Rust:
 720 / CROSSING OK" on each.

Backend:
 wry/WKWebView (a webview),
 confirmed by the compiled dependency set (`tao`,
 `wry`,
 `objc2_ui_kit`,
`dioxus_desktop`).
 It is NOT the experimental native renderer (`dioxus-native`/Blitz/WGPU),
 which `dx` does
not default to on iOS and which ships no iOS AccessKit adapter (its dep tree carries
`accesskit_macos`/`unix`/`windows`/`winit` only,
 no `accesskit_ios`),
 so the native path would fail
VoiceOver.
 The gate deliberately stays on the webview backend,
 where accessibility is WebKit-native.

Dual-target is structurally clean,
 the exact opposite of the Qt failure.
 Dioxus is pure Rust compiled
per-target:
 `dx bundle --ios --target aarch64-apple-ios-sim` builds the native arm64 simulator slice
(verified `architecture: arm64`;
 installed and rendered on the booted arm64 iOS 26.5 sim),
 and `--target
aarch64-apple-ios` builds the device slice (arm64 iphoneos;
 the wireless `ideviceinstaller -n upgrade` to
the physical iPhone X succeeded,
 which installd permits only for an iphoneos binary).
 There is no prebuilt
fat-binary forcing an x86_64-only simulator the way Qt's kit does;
 one codebase,
 two rustc targets,
 both
native arm64.

Rust crossing is inherent,
 not an FFI shim.
 Because the UI layer itself is Rust (RSX),
 the gate computes
720 in Rust and renders it straight through the RSX into the WKWebView with zero hand-written native code
and no C-ABI boundary.
 This is the cleanest crossing in the funnel (there is no foreign framework to cross
into;
 the framework is Rust),
 and it is why Dioxus is directly relevant to the music-player and kopia Rust
cores.

Build and signing mechanism.
 `dx bundle --ios --package-types ios` emits an unsigned `.app` (verified "code
object is not signed at all");
 `dx`'s own codesign and `devicectl` deploy assume a USB device,
 but the
iPhone X is wireless,
 so the device leg is signed by hand with the vet keychain (embed the
`dev.monochromatic.iosvet.hellodevice` profile as `embedded.mobileprovision`,
 then `codesign --force
--sign` the vet identity with the profile entitlements under the keychain-search-list wrapper) and
installed with `ideviceinstaller -n upgrade`.
 The simulator leg needs no signing (`simctl install`/`launch`).
Deployment target defaults to 13.0 (`dx`),
 well under 16.7.
 No AMFI/execmem question for the app itself:
Rust is AOT,
 and the webview's JS JIT runs under WKWebView's own iOS entitlement,
 not the sandboxed app's,
so there is no jitless-engine gate the way there was for the JS-runtime frameworks.

a11y:
 WebKit-native (VoiceOver reads the web a11y tree),
 same class as Capacitor,
 satisfied only on the
webview backend;
 on-device VoiceOver confirmation is still owed under the retroactive a11y sweep.
 Watch
item for real apps:
 Dioxus issue #4894 (open) reports that scrolling can halt the Dioxus event loop on the
iOS simulator;
 the static gate did not exercise scrolling,
 so confirm scroll behaviour before relying on
it.
 Work dir:
 `/Volumes/MacData/ios-vet/dioxusgate` (hand-rolled minimal `dioxus = { features = ["mobile"]
}` project;
 build with `dx bundle --ios --target <triple>`).
 Toolchain installed:
 `dx` (dioxus-cli) 0.7.9.

### SnapKit: FULL PASS (both legs), the SPM Swift-dependency signing check

Status:
 FULL PASS 2026-06-12,
 second of the owner-appended set.
 SnapKit 5.
x via Swift Package Manager,
render-verified on BOTH the iPhone X (iOS 16.7) and the iPhone 17 Pro / iOS 26.5 simulator from one
codebase (both native arm64):
 "SnapKit Gate / UIKit + SnapKit via SPM / LAYOUT OK",
 the `UIStackView`
centered by SnapKit's `snp.makeConstraints` DSL.

SnapKit is a pure-Swift Auto Layout constraint DSL over UIKit with no custom rendering,
 so the gate is two
checks:
 (1) an SPM Swift dependency resolves,
 compiles,
 and links into a signable app (xcodegen `packages:`
pointing at SnapKit `from: 5.7.0`),
 and (2) the constraint DSL actually lays out (the centered stack is the
proof;
 a resolve or link failure would not have rendered).
 Both pass.
 This is the first SPM dependency gate
in the funnel;
 every prior native-glue gate used CocoaPods.

Build mechanism:
 a plain xcodegen UIKit app (`AppDelegate` plus window plus `ViewController`,
 no Rust).
 The
device leg used the canonical runbook wrapper directly (`xcodebuild ... OTHER_CODE_SIGN_FLAGS="--keychain
$KC"` under the keychain-search-list manipulation),
 signed inline by the vet identity (Apple Development:
little.
plan2433,
 team `HWLVAKDV4F`),
 then `ideviceinstaller -n upgrade`;
 the simulator leg built with
`CODE_SIGNING_ALLOWED=NO`.
 No Rust crossing (pure Swift).
 a11y is native UIKit (VoiceOver works through
UIKit with no bridge);
 on-device VoiceOver confirmation owed under the retroactive sweep.
 Work dir:
`/Volumes/MacData/ios-vet/snapkitgate`.
 Toolchain:
 xcodegen (already installed) plus SPM.

### UIKit: FULL PASS (both legs), the pure-Swift native baseline

Status:
 FULL PASS 2026-06-12,
 third of the owner-appended set.
 A pure-UIKit Swift app (xcodegen,
 native
`NSLayoutConstraint`,
 no third-party deps),
 render-verified on BOTH the iPhone X (iOS 16.7) and the iPhone
17 Pro / iOS 26.5 simulator from one codebase:
 "UIKit Gate / Pure UIKit,
 native a11y / RENDER OK",
 the
stack centered with native Auto Layout anchors.
 UIKit is the iOS-forever native baseline and the substrate
every other gate's views ultimately render through,
 so it trivially passes;
 native a11y (VoiceOver through
UIKit with no bridge).
 Same xcodegen plus runbook-wrapper build path as SnapKit,
 minus the SPM dependency.

Language-rule standing (owner directive 4):
 UIKit app code is 100% Swift,
 a non-allowed language,
 so UIKit
is baseline-only,
 not an implementation candidate.
 Vetted to confirm the native floor renders and as the
a11y reference.
 Work dir:
 `/Volumes/MacData/ios-vet/uikitgate`.

### SwiftUI: FULL PASS (both legs), the canary's framework formally re-confirmed

Status:
 FULL PASS 2026-06-12,
 fourth of the owner-appended set,
 and the formal re-confirm of the framework
the HelloDevice signing canary already proved.
 A SwiftUI App-lifecycle app (xcodegen,
 `@main struct ...:
App`,
 no AppDelegate),
 render-verified on BOTH the iPhone X (iOS 16.7) and the iPhone 17 Pro / iOS 26.5
simulator from one codebase:
 "SwiftUI Gate / SwiftUI,
 native a11y / RENDER OK".
 SwiftUI bridges to native
UIKit accessibility,
 so VoiceOver works with no extra work (the canary already ran it on the device).

Language-rule standing (owner directive 4):
 SwiftUI app code is 100% Swift,
 a non-allowed language,
 so
SwiftUI is baseline-only,
 not an implementation candidate,
 despite being the lightest native path.
 Work
dir:
 `/Volumes/MacData/ios-vet/swiftuigate`.

### Cordova: FULL PASS (both legs), the second WKWebView substrate

Status:
 FULL PASS 2026-06-12,
 the first of the deferred WKWebView block.
 Apache Cordova 13.0.0 CLI with
cordova-ios 8 (Swift Package Manager,
 not CocoaPods:
 the generated `App.xcworkspace` resolves two local SPM
packages,
 `Cordova` and `CordovaPlugins`,
 with no Podfile),
 render-verified on BOTH the iPhone X (iOS 16.7)
and the iPhone 17 Pro / iOS 26.5 simulator from one codebase:
 blue "Cordova Gate / WKWebView OK / JS:
 720"
on each,
 the 720 (6!
 reduced in in-bundle page JS) rendered green only when the JavaScript actually ran,
 so
the number proves the WKWebView executed the bundle,
 not merely that the shell launched.

This is the second WKWebView substrate gate (Capacitor was the first),
 and it exists to compare Cordova's
shell against Capacitor's per the owner directive.
 The comparison is now concrete:
 both host the app in a
WKWebView with WebKit-native a11y and no iOS-17 wall,
 and on current versions both moved to SPM (cordova-ios
8 and Capacitor 7 each generate a plain `App.xcworkspace` with local SPM packages and no Podfile),
 so the
historical "Cordova means CocoaPods,
 Capacitor means SPM" split no longer holds.
 Capacitor stays ahead on
ecosystem and the native-bridge story;
 Cordova passes as a viable but more legacy alternative substrate.

Build mechanism:
 `cordova create cordovagate dev.monochromatic.iosvet.hellodevice CordovaGate` pins the
widget id,
 which lands directly in the pbxproj `PRODUCT_BUNDLE_IDENTIFIER`;
 `cordova platform add ios`
generates the SPM workspace (scheme "App");
 `cordova prepare ios` stages `www/` into the bundle.
 Simulator
leg:
 `xcodebuild -workspace platforms/ios/App.xcworkspace -scheme App -sdk iphonesimulator -destination
'...id=<sim>' CODE_SIGNING_ALLOWED=NO build`,
 then `simctl install/launch/io screenshot`.
 Device leg:
 the
canonical runbook keychain wrapper (`OTHER_CODE_SIGN_FLAGS="--keychain $KC"` under the search-list
manipulation),
 signed inline by the vet identity,
 `ideviceinstaller -n upgrade`,
 held alive with
`idevicedebug -n run`,
 `idevicescreenshot -n`.
 No Rust crossing here (the web shells reach native code
through Cordova/Capacitor plugins,
 a stage-2 concern).
 a11y is WebKit-native (VoiceOver reads the web a11y
tree);
 on-device VoiceOver confirmation is owed under the retroactive sweep.
 Language standing (owner
directive 4):
 the app is HTML,
 CSS,
 and JavaScript (exempt markup plus a scripting runtime that TypeScript,
an allowed language,
 compiles to),
 so the WKWebView shells align with the allowed-language rule.
 Work dir:
`/Volumes/MacData/ios-vet/cordovagate`.
 Toolchain:
 cordova 13.0.0 CLI (npm global).

### Ionic, Framework7, Onsen UI, Quasar: FULL PASS (both legs), the four WKWebView UI layers

Status:
 FULL PASS 2026-06-12,
 the last four of the deferred WKWebView block,
 which closes the entire
initial framework vet.
 Each of the four UI libraries render-verified on BOTH the iPhone X (iOS 16.7) and the
iPhone 17 Pro / iOS 26.5 simulator from one codebase,
 hosted in the already-proven Cordova/WKWebView shell
(the same `cordovagate` App,
 its `www/` swapped per framework,
 rebuilt for each leg),
 with each framework's
real npm distributable bundled in the app (not loaded from a CDN,
 so this is the shipping path),
 and each
computing 6!
 = 720 in page JavaScript,
 rendered green only when the WKWebView actually executed the bundle.
Versions:
 `@ionic/core` 8.8.10,
 `framework7` 9.0.5,
 `onsenui` 2.12.8,
 `quasar` 2.20.0 with `vue` 3.5.38.

The render note is deliberately stronger than text-on-a-page:
 each screenshot shows the framework's own
distinctive components drawing,
 not just a string,
 so a blank or unstyled page would have failed it.

- Ionic:
   the lazy ESM web components actually upgraded under Cordova's `app://localhost` custom scheme.
   The
  `ion-toolbar color="primary"`,
   `ion-card`,
   `ion-card-title`,
   and `ion-button expand="block"` all rendered
  with Ionic's theme (bold iOS typography,
   the primary-blue toolbar and pill button) on both legs,
   which
  proves `ionic.esm.js` fetched its per-component `*.entry.js` chunks from the bundle over the custom scheme
  (the one real risk for a web-component library inside a hybrid shell,
   and it passed).
- Framework7:
   `new Framework7({ theme: 'ios' })` initialized and drew its iOS-theme navbar,
   `block-strong`,
  and `button-large button-fill` on both legs.
- Onsen UI:
   `ons-toolbar`,
   `ons-card`,
   and `ons-button modifier="large"` rendered with Onsen's component
  CSS on both legs (the framework auto-initialized on `init`/`load`).
- Quasar:
   Vue 3 (UMD `vue.global.prod.js`) mounted and `app.use(Quasar)` registered the component set,
   so
  `q-layout`/`q-header`/`q-toolbar-title`/`q-card`/`q-btn` drew Quasar's Material UI on both legs;
   the
  `mounted` hook computed 720,
   proving Vue's lifecycle ran.
   One cosmetic note:
   the `q-header` did not reserve
  the status-bar safe-area inset (it sits under the clock);
   the components themselves rendered correctly.

These four needed no fresh substrate gate:
 they are pure web UI inside the same WKWebView that Capacitor and
Cordova already proved,
 so the gate is whether each component library draws in an iOS WKWebView on both
targets,
 and all four do.
 a11y is WebKit-native for all (VoiceOver reads the web a11y tree,
 the same class
as Capacitor/Cordova/Dioxus),
 no iOS-17 wall;
 on-device VoiceOver confirmation is owed under the retroactive
sweep.
 Language standing (owner directive 4):
 the app code is HTML,
 CSS,
 and JavaScript (Quasar adds a Vue
template,
 which compiles to JS),
 all exempt markup plus a scripting runtime that the allowed language
TypeScript compiles to,
 so all four align with the allowed-language rule.
 Build mechanism:
 one `cordovagate`
shell,
 `www/` replaced from `/Volumes/MacData/ios-vet/webui/<framework>/www` (real dist copied out of
`node_modules`),
 `cordova prepare ios`,
 sim leg `CODE_SIGNING_ALLOWED=NO`,
 device leg the runbook keychain
wrapper,
 `ideviceinstaller -n upgrade`,
 `idevicedebug -n run`,
 `idevicescreenshot -n`.
 Work dirs:
`/Volumes/MacData/ios-vet/cordovagate` (shell) and `/Volumes/MacData/ios-vet/webui` (per-framework `www`).
Toolchain:
 cordova CLI plus the four npm packages.

With these four the deferred web block is finished and every framework in the funnel has been gated:
 the
initial vet is complete.
 The full render-verified set (both legs) is Capacitor,
 the .
NET trio
(substrate/MAUI/Avalonia/Uno),
 Flutter,
 Compose Multiplatform,
 React Native,
 NativeScript,
 Lynx,
 Dioxus,
SnapKit,
 UIKit,
 SwiftUI,
 Cordova,
 Ionic,
 Framework7,
 Onsen UI,
 and Quasar;
 Slint is DISQUALIFIED (iOS-17
a11y death) and Qt is CULLED (no prebuilt arm64-simulator slice).
 What remains is not framework gating but
the second-pass language ranking (owner directive 4),
 the survivors' supporting-stack vets (stage 2),
 and
the on-device VoiceOver a11y sweep.

## Music-player iOS port (the Slint path is blocked on iOS 16.7)

The music-player is Slint,
 so the natural port would reuse the UI.
 But Slint does not run on the
owner's iPhone X (see the Slint result above:
 the iOS backend is iOS 17+ in two independent places).
 A
direct Slint port therefore targets iOS 17+ only and excludes this device.
 Two ways forward:

- Maintain a downported fork of Slint's iOS support:
   fork accesskit for the four a11y symbols and patch
  Slint's `internal/backends/winit/ios` color-scheme path off the iOS-17 `UITrait` API,
   accept the
  iOS-16 a11y fidelity loss,
   and re-verify after every Slint bump.
   High,
   ongoing maintenance,
   and only
  worthwhile if Slint upstream is unwilling to availability-guard these (which also needs objc2 to
  support weak-linked statics for a clean fix).
- Rewrite the UI in a framework that runs on iOS 16.7 with native a11y (Flutter is the strongest
  device-verified option;
   the WKWebView substrate is the web-UI alternative) while keeping the Rust
  core behind FFI.
   The audio core ports either way and is the larger asset.

The Rust core reuse holds regardless of the UI choice:
 symphonia is pure Rust;
 opus builds its bundled
libopus via cmake (cross-compiles for iOS);
 cpal has an iOS backend (RemoteIO AudioUnit with
`objc2-avf-audio` AVAudioSession integration),
 and the crate's `cfg(not(target_os = "linux"))` cpal
table already includes iOS.
 Background playback is permitted (media playback,
 not arbitrary background
execution) with `UIBackgroundModes: audio` plus an AVAudioSession playback category.
 The
`cfg(any(target_os = "linux", target_os = "macos"))` libc QoS table excludes iOS (add
`target_os = "ios"` or drop the QoS lowering there).
 The real architecture cost is the folder-scanned
queue:
 the desktop "scan a folder" model does not map to the iOS sandbox,
 which needs UIDocumentPicker
with security-scoped bookmarks or the app's own Documents container (`UIFileSharingEnabled` plus the
Files app);
 `rfd`'s iOS support is limited,
 so this needs a small native shim.
 True-peak normalization
and the on-disk peak cache are plain sandboxed file I/O and port unchanged.
 If the Slint UI is kept via
the downported fork,
 it additionally needs `renderer-skia` (iOS uses Skia/Metal,
 not the pinned
femtovg/software),
 a Slint rev past slint-ui/slint#11741 (2026-05-15),
 and cfg-gating the explicit
winit-backend construction (the Wayland `app_id` is Linux-only).

## Stage 2 supporting-stack probes

### In-app HTTP/S3 server in a linked Rust staticlib: FULL PASS (both legs)

Status:
 FULL PASS 2026-06-12.
 This is the stage-2 probe of the one capability the synthesis flagged as
genuinely uncertain across every substrate (the in-app HTTP/S3 endpoint the kopia-to-pCloud app needs):
 can
a sandboxed iOS app bind a listening socket and serve HTTP on loopback?
 On the iPhone X (iOS 16.7) it can.

The probe realizes the synthesis's recommended de-risk literally:
 the server lives inside the linked Rust
staticlib,
 so the capability is framework-independent.
 Two C-ABI functions were added to the proven
`mauigate` Rust `.a` (`rust/src/lib.rs`):
 `rust_server_probe` binds a `std::net::TcpListener` on
`127.0.0.1:0`,
 spawns a thread that accepts one connection and writes an HTTP/1.1 200 with an S3-style
`<ListBucketResult>` XML body,
 then connects back as a client over loopback,
 issues
`GET /probe-bucket/?list-type=2`,
 and reads the response;
 `rust_string_free` releases the result string.
 No
new crates (pure `std::net`),
 so the cross-compile is identical to the proven gate.
 The .
NET substrate calls
it over the existing `[DllImport("__Internal")]` path and renders the result,
 the screen green only when the
full bind/accept/serve/connect/read round-trip succeeds.

- Device leg (the load-bearing test):
   on the iPhone X (iOS 16.7),
   Release/full-AOT,
   signed with the vet
  keychain and run held-alive,
   the screen reads "In-app server probe / Rust FFI:
   720 / S3 SERVER OK
  port=53178" on a green background.
   So a sandboxed,
   non-entitled,
   AOT app process bound a listening TCP
  socket on loopback,
   accepted a connection,
   completed an HTTP exchange,
   and the client read the S3-style
  body back,
   all in-process,
   with no special entitlement and (decisively) no local-network privacy prompt,
  because loopback `127.0.0.1` is exempt from the iOS local-network permission (which gates LAN and Bonjour,
  not loopback).
   The ephemeral port differs per run (sim 57115,
   device 53178),
   confirming a real bind,
   not a
  fixed stub.
- Simulator leg (iPhone 17 Pro / iOS 26.5):
   same source,
   "S3 SERVER OK port=57115".
   The simulator does not
  enforce the device sandbox,
   so as with the AMFI checks the device leg is the one that counts;
   the sim leg
  satisfies the dual-target criterion.

What this proves and what it does not.
 PROVEN:
 the framework-independent in-app server capability (a Rust
staticlib bound to loopback,
 serving HTTP,
 consumed in-process) runs on the real iPhone X,
 which is exactly
how kopia's own repository server and client sit in one linked core.
 This retires the synthesis's single
biggest capability risk for the kopia app,
 and it generalizes to every framework that links the staticlib
(.
NET proven here;
 Flutter `dart:ffi`,
 Compose cinterop,
 the WebView plugins,
 NativeScript,
 Lynx,
 and
Dioxus all link the same kind of `.a`).
 NOT YET PROVEN (smaller,
 owed sub-checks):
 a WKWebView's WebContent
process reaching the loopback server over `http://127.0.0.1` (an App Transport Security question,
 only
relevant if the web UI fetches the endpoint directly rather than the native/kopia client consuming it);
 the
server thread's survival when the app is backgrounded (the iOS background-execution limit,
 a restructuring
concern shared by every framework,
 see wall 3);
 and real kopia/S3 protocol fidelity beyond the shaped
response.
 The bind-and-serve foundation those build on is now device-confirmed.
 Work dir:
`/Volumes/MacData/ios-vet/mauigate` (the probe is additive;
 the original gate sources are backed up as
`rust/src/lib.rs.orig` and `SceneDelegate.cs.orig`).

### cpal CoreAudio output in a linked Rust staticlib: FULL PASS (both legs)

Status:
 FULL PASS 2026-06-12.
 The music-player's load-bearing capability is audio output,
 and its Rust core
uses cpal;
 the open question was whether cpal's iOS CoreAudio (RemoteIO AudioUnit) backend opens the output
device and runs on the iPhone X.
 It does.
 The same `mauigate` Rust `.a` gained `rust_audio_probe`,
 which
opens the cpal default output device,
 builds an output stream whose render callback writes silence only
(zeros,
 so nothing is audible:
 the owner was asleep beside the device,
 HRM),
 plays for about 600 ms,
 and
counts callback invocations;
 a non-zero count means CoreAudio actually pulled buffers,
 so the output path is
live,
 not merely constructed.
 The .
NET app activates an `AVAudioSession` (Playback category,
 the one piece of
iOS glue the synthesis predicted) before calling the probe.

- Device leg (the load-bearing test):
   on the iPhone X (iOS 16.7),
   Release/full-AOT,
   signed and held alive,
  the screen reads "AUDIO OK dev=Default Device sr=48000 ch=2 cb=28":
   cpal opened the 48 kHz stereo CoreAudio
  output device and its render callback fired 28 times in about 600 ms. So cpal's iOS backend builds and runs
  the RemoteIO AudioUnit on the device,
   which means the music-player's symphonia-plus-cpal core needs no
  AVAudioEngine rewrite,
   only the AVAudioSession activation shim (here from C#;
   in a Rust-only stack via
  `objc2-avf-audio`).
- Simulator leg (iPhone 17 Pro / iOS 26.5):
   same source,
   "AUDIO OK ... cb=54".
   Dual-target satisfied.

Build note:
 cpal pulls coreaudio-rs/coreaudio-sys (bindgen),
 which cross-compiled cleanly to both
`aarch64-apple-ios` and `aarch64-apple-ios-sim` with no extra flags;
 the only integration step was declaring
`<Frameworks>AudioToolbox</Frameworks>` on the .
NET `NativeReference`,
 because coreaudio-rs references
AudioToolbox/AudioUnit C symbols the app must link (otherwise the device and sim links fail with undefined
`_AudioUnit*` symbols).
 This is the music-player Rust-core audio path proven on the device,
 writing silence;
producing actual sound is a one-line amplitude change,
 deferred because the device is unattended.
 NOT yet
exercised:
 real decoded PCM through symphonia into the cpal buffer (this probe wrote zeros),
 interruption
handling,
 and background audio with `UIBackgroundModes: audio` (a separate restructuring check).
 The parts
that were uncertain on iOS,
 the output device opening and the render callback firing,
 are device-confirmed.

### ring crypto (rustls's iOS backend) in a linked Rust staticlib: FULL PASS (both legs)

Status:
 FULL PASS 2026-06-12.
 The kopia app streams to pCloud over HTTPS,
 typically via reqwest plus rustls
in the linked Rust core.
 rustls's state machine is pure Rust (no platform risk);
 its only platform-sensitive
part is the crypto backend,
 ring,
 whose assembly must run on iOS arm64.
 The device is in airplane mode,
 so no
live pCloud request is possible,
 but the platform-sensitive question is answerable offline:
 the same
`mauigate` Rust `.a` gained `rust_crypto_probe`,
 which runs an X25519 ephemeral key agreement (the TLS key
exchange) and an AES-256-GCM seal/open round-trip (the TLS bulk cipher) using ring 0.17,
 reporting success
only if both complete and the AEAD recovers the plaintext.

- Device leg:
   on the iPhone X (iOS 16.7),
   Release/full-AOT,
   the screen reads "CRYPTO OK x25519+aesgcm":
   ring
  computed a 32-byte X25519 shared secret and AES-256-GCM sealed then opened a buffer on the device.
   So
  ring's crypto runs on iOS arm64,
   which is the one platform-specific part of an outbound rustls/TLS stack;
  the rest is pure Rust.
- Simulator leg (iPhone 17 Pro / iOS 26.5):
   same "CRYPTO OK".
   ring 0.17.14 cross-compiled cleanly to both
  iOS triples with no extra flags.

This converts the outbound-HTTPS-to-pCloud item from asserted to device-proven at the crypto-core level.
 What
remains for that path is a live TLS handshake and a real pCloud request,
 both needing network (the device is
offline tonight);
 the platform-sensitive crypto they depend on is confirmed.
 So all three Rust-core
capabilities the two apps need (an in-app loopback server,
 CoreAudio output,
 and TLS crypto) now run on the
iPhone X from one linked staticlib,
 with one render:
 "Rust FFI:
 720 / S3 SERVER OK / AUDIO OK / CRYPTO OK".

### Go c-archive (the kopia payload shape) on iOS: runs on device in a non-managed host

Status:
 2026-06-12.
 kopia is pure Go,
 so the kopia-to-pCloud app's payload is a Go c-archive.
 Two findings,
one positive and one integration caveat,
 both device-tested:

- A minimal Go c-archive (`//export GoAnswer` returning 720 through the Go runtime,
   `go build
  -buildmode=c-archive`,
   Go 1.26.4) cross-compiles to BOTH iOS triples with correct Mach-O platform stamps:
  device arm64 (`LC_BUILD_VERSION` platform 2,
   iphoneos,
   minos 13.0) and simulator arm64 (platform 7,
  iossimulator,
   minos 14.0).
   Go derives the simulator platform from the CC's `-mios-simulator-version-min`
  flag,
   so the dual-target slices are clean (unlike Qt's prebuilt kit).
   The device archive signs and links
  into a signable app via the same `NativeReference`/`-force_load` mechanism the Rust `.a` uses.
- In a pure-Swift,
   non-managed host (`gogate`,
   a UIKit app with no second runtime),
   the Go c-archive links
  and its runtime RUNS on the iPhone X (iOS 16.7):
   "Go:
   720 RUNTIME OK" rendered on both the device and the
  iPhone 17 Pro / iOS 26.5 simulator.
   So the Go runtime initializes and a cgo-exported function returns
  through it on the real A11 device;
   the kopia payload is viable on iOS.
- Integration caveat (a real device-only finding):
   co-hosting the SAME Go c-archive inside the .
  NET/Mono
  runtime (the `mauigate` app,
   alongside the Rust probes) builds and renders on the simulator ("Go:
   720"),
  but SIGKILLs at launch on the DEVICE (idevicedebug:
   "Exit due to signal:
   9";
   the app drops back to the home
  screen).
   The Rust staticlib,
   which has no runtime,
   co-hosted with Mono fine;
   Go does not,
   because two
  managed runtimes (Go's scheduler,
   GC,
   and signal handlers versus Mono's) collide in one process on the
  device,
   where the simulator's looser environment tolerates it.
   So the kopia Go payload must NOT be
  co-hosted inside a second managed runtime like Mono/.
  NET;
   a non-managed host (Swift/Objective-C as gomobile
  assumes,
   or the WebView/React Native/Rust hosts whose native side is not a GC runtime) is required.
   This
  rules the .
  NET trio out as the kopia host specifically (it stays render-valid as a UI framework for the
  music-player),
   and is a point in favour of the WebKit/Rust/JS hosts for the kopia app.

So the kopia payload-shape question is answered:
 a Go c-archive runs on the iPhone X,
 subject to the
host-runtime constraint above.
 Building actual kopia (a large Go program) as the c-archive is then an
integration task on this proven mechanism.
 Work dirs:
 `/Volumes/MacData/ios-vet/goprobe` (the Go archive)
and `/Volumes/MacData/ios-vet/gogate` (the Swift host that proved it on device).

## Pending gates

Device-verified to render so far:
 Capacitor (rank 2,
 covers the six web frameworks,
 which genuinely
share its WKWebView),
 Flutter (rank 4),
 the full .
NET trio (rank 3):
 substrate (Mono AOT and
interpreter,
 Rust FFI),
 MAUI,
 Avalonia,
 and Uno,
 Compose Multiplatform (rank 5,
 Kotlin/Native AOT,
Skiko/Metal),
 React Native (rank 6,
 Hermes bytecode,
 native UIViews,
 Rust crossing PASS via a thin
Obj-C shim + dual-triple XCFramework),
 and NativeScript (rank 7,
 jitless V8 10.3.22 survives AMFI on the
iPhone X,
 render both legs,
 Rust crossing PASS with zero hand-written native code),
 and Lynx (rank 8,
native UIKit `LynxView`,
 jitless PrimJS/JSC survives AMFI on the iPhone X,
 render both legs,
 Rust crossing
PASS via a pure-ObjC `LynxModule` shim),
 Dioxus (first of the owner-appended set,
 Rust UI rendering
through wry/WKWebView,
 dual-target structurally clean because it is pure Rust per-target),
 SnapKit
(second appended gate,
 pure-Swift UIKit Auto Layout DSL via SPM,
 the first SPM dependency gate),
 UIKit
(third appended gate,
 pure-Swift native baseline),
 and SwiftUI (fourth appended gate,
 the HelloDevice
canary's framework formally re-confirmed),
 all render-verified,
 above.
 The pure-Swift trio
(SnapKit/UIKit/SwiftUI) is baseline-only under the allowed-language rule (owner directive 4).
 Slint (rank 1) was gated and FAILED (disqualified,
 above),
 and Qt (rank 9) was
CULLED (no prebuilt arm64-simulator slice,
 and the only arm64-sim path also breaks the no-hand-written-C++
rule,
 above).

Dual-target status (owner directive 2026-06-12,
 see the gate mechanism):
 a PASS requires render on BOTH
the device and the latest simulator from one codebase.
 The retroactive sweep is complete:
 Compose
Multiplatform,
 Capacitor,
 Flutter,
 and the full .
NET trio (substrate,
 MAUI,
 Avalonia,
 Uno) are all
confirmed on both legs.
 Two findings the sweep produced,
 both above:
 Flutter's simulator leg needed the
Impeller-off headless workaround,
 and the .
NET Rust-FFI substrate needed the Rust core built for both
`aarch64-apple-ios` and `aarch64-apple-ios-sim` with RID-conditional linking (mandatory for every
remaining Rust-linking gate).
 Every remaining gate must clear both legs up front.

Owner directives (2026-06-12):
 (1) defer the six WKWebView frameworks (the Capacitor and Cordova shells
plus the Ionic,
 Framework7,
 Onsen,
 and Quasar UI layers) to the very end,
 after every native and managed
framework is gated;
 (2) add Dioxus,
 SnapKit,
 UIKit,
 and SwiftUI to the queue,
 positioned just before
that deferred web block;
 (3) no C or C++ is to be written anywhere in this vet,
 including throwaway
experiments;
 (4) implementation languages are constrained to Kotlin,
 TypeScript,
 and Rust,
 and after the
vet completes the chosen framework and the eventual iOS port must minimize Swift and every other
non-allowed language (Objective-C `.m` shims included).
 Directive (4) is a ranking axis on the final
recommendation,
 not a vet gate:
 all frameworks are still gated for completeness,
 but app code authored in
an allowed language is preferred,
 so the pure-Swift UIKit/SwiftUI/SnapKit gates are baseline-only (not
implementation candidates),
 while Dioxus (Rust),
 Compose Multiplatform (Kotlin),
 and the TypeScript
WebView/JS shells (Capacitor,
 React Native,
 NativeScript,
 Lynx) align.
 The thin Objective-C `.m` shims used
for the React Native,
 NativeScript,
 and Lynx Rust crossings are non-allowed-language deviations to minimize
too;
 Dioxus needs none (pure Rust).
 This reshapes the native-glue plans below:
 the Rust-crossing checks for React Native
(done,
 PASS,
 see its section:
 a legacy Obj-C `RCTBridgeModule` surfaced the Rust value even under the New
Architecture,
 so no "C++ JSI/TurboModule" was needed),
 NativeScript,
 Lynx (a `LynxModule` `.mm`),
 and Qt
must use Rust binding crates,
 a C-ABI boundary (Rust `extern "C"` declared in a Swift bridging header,
which is an ABI declaration,
 not hand-written C/C++),
 or Swift glue,
 never a hand-authored
`.c`/`.cpp`/`.mm` file.
 The
gate question stays the same (does a Rust value cross into the framework and render),
 only the FFI
mechanism is constrained.
 Objective-C clarification (owner,
 2026-06-12):
 "no C or C++" is the
language-name ban,
 so a minimal Objective-C `.m` shim is allowed purely to register or call Rust over a C
ABI where a framework has no pure-Swift path (RN old-architecture modules,
 and likely NativeScript/Lynx).
The `.m` must be a thin bridge with no application logic,
 and each use is recorded as a noted deviation;
`.c`,
 `.cpp`,
 and Objective-C++ `.mm` stay banned,
 and RN New-Architecture C++/JSI TurboModules are not
used.
 The remaining order,
 each confirmed by render (screenshot) and a few seconds of
no-crash runtime,
 not by launch success alone:

- React Native (rank 6,
   expected-pass;
   also the gate that proves the CocoaPods + `.xcworkspace` path).
  Confirm `global.HermesInternal` truthy (Hermes AOT-bytecode interpreter live);
   a C++ JSI/TurboModule
  linking a Rust staticlib.
   Toolchain:
   Node,
   RN community CLI,
   CocoaPods,
   Watchman/Metro.
- NativeScript (rank 7,
   needs-device):
   FULL PASS,
   DONE (above).
   The iOS inverse of the Android
  DENY_EXECMEM death is answered (jitless V8 10.3.22 runs on the iPhone X with no AMFI/execmem kill),
   and
  the Rust crossing renders "Rust:
   720 / CROSSING OK" on both legs with zero hand-written native code (a
  C-ABI header + modulemap in `App_Resources/iOS/src` + a `-u` linker flag).
   Toolchain installed:
   Node,
  `ns` CLI 9.0.6,
   Homebrew CMake,
   CocoaPods,
   xcodeproj gem 1.27.0.
- Lynx (rank 8,
   expected-pass):
   FULL PASS,
   DONE (above).
   UI renders as native UIKit (`LynxView : UIView`,
  header-verified,
   no WKWebView);
   a jitless engine (PrimJS default / JSC fallback,
   both jitless on a
  non-entitled device) runs the bundle on the iPhone X with no AMFI/execmem kill,
   render both legs;
   the
  Rust crossing renders "Rust:
   720 / CROSSING OK" on both legs via a pure-Objective-C `LynxModule` `.m`
  shim (not the `.mm` originally assumed) linking the Rust staticlib through the `rust-gate` local pod.
  Toolchain installed:
   Node,
   `@lynx-js/rspeedy`/`create-rspeedy`,
   xcodegen,
   CocoaPods,
   xcodeproj gem.
- Qt (rank 9,
   needs-device):
   CULLED 2026-06-12,
   see the "Qt:
   CULLED" section above.
   Prebuilt Qt has no
  arm64-iphonesimulator slice in any version (device arm64 plus simulator x86_64 only;
   confirmed by
  `lipo`/`otool` on 6.5.3 and 6.12.0,
   corroborated by QTBUG-101276 and the Qt iOS docs),
   so it cannot
  render on the M1's native arm64 iOS 26.5 simulator and fails the dual-target prerequisite.
   The only
  arm64-sim path is a from-source Qt build,
   which independently breaks the no-hand-written-C++ rule (the
  sole proven iOS CXX-Qt path uses a developer-authored C++ `main.cpp` and unmerged fork patches).
   Fails
  two owner hard rules;
   no gate build was attempted.

Appended 2026-06-12 (owner),
 gated after the cross-platform set above and before the deferred web block:

- Dioxus (`dioxuslabs.com`,
   the most substantive of these four;
   Rust,
   so directly relevant to the
  music-player and kopia Rust cores).
   Verify its current iOS rendering backend at gate time,
   do not
  assume:
   historically Dioxus mobile renders through `wry` (a WKWebView wrapped via `tao`) driven by
  AOT-compiled Rust,
   which would make a11y WebKit-native like Capacitor;
   but Dioxus has been moving to a
  native renderer (Blitz/WGPU),
   and if the 2026 iOS path self-draws,
   its a11y is a custom bridge
  (Avalonia-class),
   not WebKit-clean,
   which flips its a11y-must standing.
   Either way Rust is AOT (no JIT
  wall),
   so the gate question is whether the actual Dioxus iOS stack builds and renders on 16.7 and what
  its real a11y path is.
   Toolchain:
   `dx` CLI (dioxus-cli) plus the `aarch64-apple-ios` Rust target
  (already installed);
   build with `dx bundle --platform ios` or a cargo staticlib in an Xcode wrapper.
- SnapKit (`github.com/SnapKit/SnapKit`):
   a pure-Swift Auto Layout constraint DSL over UIKit,
   no custom
  rendering.
   The gate is a UIKit Swift app that lays out with SnapKit constraints,
   pulling SnapKit via
  Swift Package Manager;
   it doubles as the SPM-Swift-dependency signing check.
   Native UIKit a11y;
  expected trivial pass.
   Toolchain:
   xcodegen (already installed) + SPM.
- UIKit:
   Apple's native imperative UI.
   The gate is a pure-UIKit Swift app (xcodegen project like the
  HelloDevice canary,
   but UIKit instead of SwiftUI).
   Native a11y,
   iOS-forever baseline;
   expected trivial
  pass.
   Toolchain:
   xcodegen (already installed).
- SwiftUI:
   Apple's native declarative UI (iOS 13+).
   Effectively already render-proven:
   the HelloDevice
  signing canary (`doc/runbook/ios-iphone-x-codesign-setup.md`,
   Appendix A) is a SwiftUI app that
  rendered "iOS vet signing OK" on this device.
   This queue item is a formal re-confirmation,
   not a new
  unknown.
   Native a11y.
   Toolchain:
   xcodegen (already installed).

Deferred to the very end per the owner directive (the six WKWebView frameworks),
 after every gate above:

- Apache Cordova substrate (comparison against the already-passed Capacitor shell).
- The four WKWebView UI layers Ionic,
   Framework7,
   Onsen,
   and Quasar:
   UI-render notes on top of the
  proven WKWebView substrate,
   no fresh substrate gate.

Universal toolchain base every gate already shares:
 macOS + Xcode + signing + `rustup target add
aarch64-apple-ios` (the Rust core staticlib is the common FFI payload on every track).
 Each gate adds
only its own SDK/CLI.
