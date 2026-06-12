# iOS framework device-gate results (iPhone X)

On-device build-and-run outcomes for the funnel's stage 1, recorded as each framework is gated on
the owner's iPhone X (`iPhone10,3`, iOS 16.7.16, build 20H392, UDID
`9057e2a8c2e70162e35b9ea8bf006f736670877b`). This is the evidence layer the desk audits cannot
produce: a desk audit judges from source, a gate judges from a signed app actually rendering its UI and
running on the hardware. Launch success alone is not a pass: an app can pass `ios-deploy ... run` and
then die at dyld load or panic before drawing a frame. Every PASS below is confirmed by an on-device
screenshot plus a few seconds of no-crash runtime, not by launch success. Read this together with the
per-framework `vet-<framework>.md` reports (source audit) and the synthesis at
`docs/decisions/ios-iphone-x-music-player-kopia-stack.md`.

Signing and device path are established and documented separately in
`docs/runbook/ios-iphone-x-codesign-setup.md`; this file records only what each framework's own
toolchain does on top of that path.

## The gate mechanism (proven 2026-06-12)

Every gate reuses one provisioned app id, `dev.monochromatic.iosvet.hellodevice`, so no gate needs
`-allowProvisioningUpdates` (which would need the login keychain that an SSH session cannot reach).
Each framework's generated Xcode project has its bundle id forced to that value, and the build is
driven over `ssh m1` with three injected settings plus the vet keychain:

```sh
xcodebuild -project <App>.xcodeproj -scheme <Scheme> \
  -destination 'platform=iOS,id=9057e2a8c2e70162e35b9ea8bf006f736670877b' \
  -configuration Debug -derivedDataPath build \
  DEVELOPMENT_TEAM=HWLVAKDV4F CODE_SIGN_STYLE=Automatic \
  OTHER_CODE_SIGN_FLAGS="--keychain $KC" build
```

Confirmed behavior: with the bundle id pinned to the already-provisioned app id and the team set to
`HWLVAKDV4F`, automatic signing resolves the existing 7-day profile from disk and signs with no call
to Apple, so the gate runs fully unattended over SSH. The codesign step uses the vet keychain
(`codesign --force --sign <hash> --keychain ~/ios-vet/vet.keychain-db`), and `ios-deploy --justlaunch`
installs and runs it. The vet keychain must be unlocked and present in the user search list for the
duration of the build (xcodebuild resolves the identity through the search list, not the `--keychain`
flag alone); the search list is restored to login-only afterward.

Two mechanics that bit during setup and will bite again:

- The Mac login shell is zsh, which does not word-split unquoted parameter expansions. A
  `WS="-project App.xcodeproj"; xcodebuild $WS ...` reaches xcodebuild as one malformed argument and
  triggers the full usage dump. Inline the flags; do not build them in a variable.
- `tail -n` on a failing `xcodebuild | tail` hides the real error, which xcodebuild prints near the
  top. When a build "fails with usage text," re-run capturing the head, or run `xcodebuild -list`
  first to confirm the scheme.
- Launch is not render. `ios-deploy --justlaunch` prints `success` as soon as the process is created
  under lldb, before any UI draws, and then detaches, which kills the app. To confirm a gate renders,
  relaunch with `idevicedebug -d run <bundle id>` (which holds the app alive), `idevicescreenshot`
  after a few seconds, and scan the app stdout plus `idevicecrashreport` for a dyld `Symbol not found`
  or a Rust panic. The Slint result below was a launch-success this step caught as a crash.
- The device may be attached over USB or wirelessly (Xcode wireless debugging), and the whole chain
  works over wifi (confirmed 2026-06-12 with a wireless screenshot of a live app). `xcodebuild`,
  `dotnet`, and `ios-deploy` use the network device by default; `ios-deploy`'s `-W` only disables wifi.
  The libimobiledevice verify tools need the `-n`/`--network` flag to target the network device:
  `idevicescreenshot -n`, `idevicedebug -n run`, `idevicecrashreport -n`, `ideviceinfo -n`. Large AOT
  installs and long debug holds are slower over wifi than USB, so USB is the fallback if an install
  stalls, but functionally wifi covers install, run, screenshot, and crash-log retrieval.

## Results

### Capacitor: PASS (substrate for the WKWebView group)

Status: device-confirmed 2026-06-12.

A minimal Capacitor app (`~/ios-vet/capgate`, one WKWebView page) built and launched on the iPhone X.
Decisive facts from the build log:

- Capacitor 7 generates a plain `App.xcodeproj` driven by Swift Package Manager, not CocoaPods. It
  pulls `capacitor-swift-pm` 8.4.0 as a remote SPM dependency plus a local `CapApp-SPM` package; there
  is no Podfile or `.xcworkspace`. This gate therefore proves the SPM signing path, not the CocoaPods
  path; React Native, Flutter, Cordova, and NativeScript still need their Pods or other integration
  proven on device before they count as gated.
- `cap init capgate dev.monochromatic.iosvet.hellodevice` forced the bundle id into the pbxproj
  (Debug and Release), so the existing profile signed it directly.
- Signing identity `Apple Development: little.plan2433@fastmail.com (L3DN5L9CVL)`, profile
  `iOS Team Provisioning Profile: dev.monochromatic.iosvet.hellodevice`
  (`b08f51d5-37ba-4462-b098-d1533058bf16`), `** BUILD SUCCEEDED **`, `ios-deploy ... run` printed
  `success`.
- Render-verified: held alive with `idevicedebug -d run` and screenshotted, the WebView draws the page
  content (`Capacitor vet` / `WKWebView OK`), not a blank or home screen, with no dyld error or crash
  report. WKWebView a11y is native (WebKit maps ARIA to iOS accessibility), so there is no iOS-17 wall.

Because Apache Cordova, Ionic, Framework7, Onsen UI, and Quasar all render their UI inside the same
WKWebView the Capacitor (or Cordova) shell hosts, this PASS establishes the substrate for all of them.
What remains for those is layer-specific (the JS UI library and the plugin used for the in-app HTTP
server, native FFI, and background), not a fresh substrate gate. Cordova still warrants its own
substrate gate only to compare its shell against Capacitor's; the four UI layers do not.

### Slint: FAIL, disqualified for the iPhone X (the iOS backend is iOS 17+)

Status: device-disproven 2026-06-12. An earlier revision of this file recorded a Slint PASS. That was
wrong: it rested on `ios-deploy ... run` printing `success`, which only means the process was created
under lldb. Held alive with `idevicedebug -d run` and screenshotted, the Slint `energy-monitor` demo
does not render; it crashes before drawing. The build itself does succeed (`cargo build --target
aarch64-apple-ios`, winit plus Skia/Metal, prebuilt Skia, about a two-minute build, signed via the vet
keychain reusing profile `b08f51d5...` through `xcodegen generate --spec ios-project.yml`), but the
signed app does not run on iOS 16.7. Two independent iOS-17 hard dependencies, both verified on the
device:

- Accessibility (a11y, a hard requirement here) pulls in `accesskit_ios` (latest 0.1.1), which
  references four iOS-17-only UIKit symbols unconditionally, with no availability guard or weak
  linking: `UIAccessibilityPriorityHigh`/`Low` and `UIAccessibilitySpeechAttributeAnnouncementPriority`
  (announcement priority, `accesskit_ios/src/event.rs`) and `UIAccessibilityTraitToggleButton`
  (`accesskit_ios/src/node.rs`). On iOS 16.7 dyld cannot resolve them and SIGKILLs the app before any
  UI: `dyld: Symbol not found: _UIAccessibilityPriorityHigh`. A local accesskit fork patched to drop
  these (post the announcement without the iOS-17 priority; expose toggles as plain buttons) clears the
  dyld failure, but then the second wall fires.
- Slint's own winit iOS backend detects dark/light theme with the iOS-17 `UITrait` system:
  `internal/backends/winit/ios/color_scheme.rs:37` calls `UITraitUserInterfaceStyle::class()` and
  `install_trait_change_observer` (`trait_observer.rs`, whose own comment notes
  `registerForTraitChanges:withHandler:` is iOS 17+). objc2 resolves the class at runtime and panics on
  iOS 16.7: `thread 'main' panicked ... class UITraitUserInterfaceStyle could not be found`
  (`objc2-ui-kit-0.3.2/.../UITrait.rs`). This is Slint's own code, not a dependency that can be swapped.

So even with the accesskit fork, Slint panics on the iPhone X. Making Slint run would require forking
both accesskit and Slint's winit iOS backend, downporting each iOS-17 API to iOS 16, accepting the a11y
fidelity loss above, and re-verifying after every Slint bump, with no guarantee further iOS-17
dependencies will not surface (this exploration found five distinct iOS-17 API uses across two crates).
The iPhone X is A11 and never receives iOS 17. This is the iOS analog of Slint's Android
disqualification (the Android series' `vet-slint-rust.md`: dex loading blocked on GrapheneOS): best repo
fit on paper, does not run on the owner's device on either platform. Under the a11y-must rule, Slint is
disqualified for this device. Every other candidate uses native iOS accessibility (UIKit or WebKit),
which works on iOS 16.7 with no iOS-17 dependency, so none of them hit this wall.

### Flutter: PASS (Dart AOT, managed-runtime family)

Status: device-confirmed 2026-06-12.

A `flutter create` app built in Release configuration (Dart AOT) launched on the iPhone X. Decisive
facts:

- Release config compiles Dart to an AOT snapshot (`libdart_aotruntime`, `App.framework`), so this is
  the shipping execution model, not the JIT debug path. It clears wall 2 for the managed-runtime
  family (the iOS twin of the same AOT requirement the .NET trio faces).
- Driven through the proven xcodebuild pattern on `ios/Runner.xcworkspace` with overrides
  `PRODUCT_BUNDLE_IDENTIFIER=dev.monochromatic.iosvet.hellodevice DEVELOPMENT_TEAM=HWLVAKDV4F
  CODE_SIGN_STYLE=Automatic`; signed with the vet keychain reusing profile `b08f51d5...`, no call to
  Apple. `** BUILD SUCCEEDED **`, `ios-deploy ... run` printed `success`.
- Render-verified: held alive with `idevicedebug -d run` and screenshotted, the default Flutter counter
  UI draws (`You have pushed the button this many times: 0`, the `+` FAB), with no dyld error or crash
  report. Flutter a11y is native (its semantics tree bridges to UIKit accessibility, iOS 12+), so there
  is no iOS-17 wall.
- Caveat on the CocoaPods claim: a plugin-less `flutter create` generates NO `Podfile` (the log shows
  "No Podfile found"); Flutter integrates its own framework via a generated xcconfig plus a build
  phase, not CocoaPods, until a plugin pulls pods in. So neither Capacitor (SwiftPM) nor this Flutter
  app exercised CocoaPods. The CocoaPods + `.xcworkspace` signing path is still unproven and will be
  settled by the React Native gate (or a Flutter app with a plugin).

### .NET / Microsoft.iOS: PASS (substrate + MAUI + Avalonia + Uno all render-verified)

Status: substrate, MAUI, Avalonia, and Uno all device-confirmed 2026-06-12. The whole .NET trio renders
on the iPhone X with no iOS-17 wall. They differ in a11y posture by renderer (MAUI native UIKit; Avalonia
and Uno-Skia self-drawn with their own a11y bridges); see the per-framework notes below.

The .NET trio (MAUI, Avalonia, Uno) shares one iOS substrate: the Microsoft.iOS workload's Mono runtime,
AOT-compiled for the device (iOS forbids JIT). This gate proves that substrate on the iPhone X with a
minimal Microsoft.iOS UIKit app (`~/ios-vet/mauigate`, `net10.0-ios`, `dotnet new ios`, bundle id forced
to `dev.monochromatic.iosvet.hellodevice` via `ApplicationId` plus Info.plist), built and signed over
SSH with the vet keychain reusing profile `b08f51d5...`, in both execution models, each render-verified:

- Release, full AOT (the shipping model): `dotnet build -c Release -p:RuntimeIdentifier=ios-arm64`.
  Per-assembly `.aotdata.arm64` files in the bundle (including `System.Private.CoreLib.aotdata.arm64`
  and `aot-instances.aotdata.arm64`) confirm full AOT. Held alive with `idevicedebug -n run` and
  screenshotted, the app draws a native UIKit `UILabel` reading ".NET iOS gate OK / Rust FFI
  returns: 720".
- Debug, interpreter: `dotnet build -c Debug -p:MtouchInterpreter=all`. The app assembly `mauigate.dll`
  ships with no `mauigate.aotdata.arm64`, confirming it runs interpreted, not AOT. Same render, same
  `Rust FFI returns: 720`, no crash report. The Mono interpreter is a bytecode interpreter that
  allocates no executable memory, so it is iOS-legal; this confirms even the fully-interpreted path
  clears the execmem wall on 16.7.

The `720` is decisive: it is 6! computed inside a linked Rust staticlib (`rust/`, `crate-type =
["staticlib"]`, `rust_gate_answer`) through a heap `Vec` plus an iterator (not a folded constant), and
returned across `[DllImport("__Internal")]`. `nm` on the signed Mach-O shows `_rust_gate_answer` linked
into the main executable at `0000000100004000 T` (a `NativeReference` with `ForceLoad`), so `__Internal`
resolves it. The label shows 720 only if the P/Invoke into native Rust actually ran and returned, which
means Mono (AOT in Release, interpreter in Debug) called into a linked Rust `.a` on iOS 16.7 with no
JIT, no `EXC_BAD_ACCESS`, and no codesign/execmem kill. This is the exact static-lib linkage the
kopia-to-pCloud core (kopia as a gomobile c-archive, or a Rust shim) and the music-player Rust core
need: managed UI code calling a linked native archive over FFI.

- Signing: `dotnet build` auto-detected identity `1690CF17...` and profile UUID `b08f51d5...` (team
  `HWLVAKDV4F`, app id `HWLVAKDV4F.dev.monochromatic.iosvet.hellodevice`) through the vet keychain in
  the search list, no call to Apple, fully unattended over SSH.
- a11y: a UIKit `UILabel` is a native accessibility element (iOS 12+). MAUI iOS renders through native
  UIKit handlers, so it inherits native a11y with no iOS-17 dependency, unlike Slint. Avalonia and Uno's
  default Skia renderer self-draw and route a11y through their own bridges (see their notes below); none
  of the three depends on an iOS-17 API.

Scope of this PASS, and what it does NOT cover: it gates the shared Microsoft.iOS execution substrate
(Mono AOT plus interpreter, native FFI, a native UIKit render), which all of MAUI, Avalonia, and Uno sit
on. It does NOT gate the three frameworks themselves, and the Capacitor analogy only goes so far. The
six web frameworks run as JS/HTML inside the same WKWebView and ship no native iOS code, so the WKWebView
substrate genuinely covers them; MAUI, Avalonia, and Uno each ship substantial native iOS framework code
(handlers/renderers, theme and a11y bridges, startup) that this bare `dotnet new ios` app never runs.
That distinction is load-bearing because of exactly where Slint failed: not in its substrate (winit,
Skia, Metal were fine) but in its own framework code (`accesskit_ios`'s a11y symbols and
`color_scheme.rs`'s `UITraitUserInterfaceStyle`). A bare UIKit app would have falsely passed Slint. So
each of MAUI, Avalonia, and Uno needs its own on-device render gate, watched specifically for the Slint
signature (a dyld `Symbol not found`, or an objc2/class-not-found panic on an iOS-17 API) before the
screenshot. Until those land each framework is substrate-proven but UI-unproven.

MAUI itself: PASS (UI render-verified 2026-06-12). An actual `dotnet new maui` app (`~/ios-vet/mauiui`,
TFM trimmed to `net10.0-ios`, `ApplicationId` forced, Release full AOT, signed via the vet keychain)
installed and rendered its real XAML UI on the iPhone X: the Shell `Home` bar, the dotnet-bot image,
"Hello, World!", "Welcome to .NET Multi-platform App UI", and a styled "Click me" button, all drawn
through MAUI's native UIKit handlers. No fresh crash report named the app, and the launch showed none of
the Slint signature (no dyld `Symbol not found`, no objc2 class-not-found). MAUI reads dark/light through
the iOS-12-era `UITraitCollection.userInterfaceStyle` (the screenshot is in the device's dark mode), not
Slint's iOS-17 `UITraitUserInterfaceStyle` observer, which is exactly why MAUI renders on 16.7 where
Slint does not. Native UIKit handlers give native a11y. So MAUI is the first trio member gated as a
framework, not just on the shared substrate.

Avalonia itself: PASS (UI render-verified 2026-06-12). An actual `dotnet new avalonia.xplat` iOS head
(`~/ios-vet/avx/avx.iOS`, Avalonia 12.0.4, `net10.0-ios`, CFBundleIdentifier forced, Release full AOT,
signed via the vet keychain) installed and rendered "Welcome to Avalonia!" on the iPhone X, drawn by
Avalonia's own SkiaSharp renderer on a Metal/GL layer (not native UIKit controls). No fresh crash report,
no Slint signature. a11y caveat under the a11y-must rule: because Avalonia self-draws, its accessibility
goes through Avalonia's own iOS `AutomationPeer`-to-`UIAccessibility` bridge, not native UIKit, so its
a11y fidelity (does VoiceOver actually read its controls and states?) is a stage-2 question the render
gate does not answer. The render and the absence of any iOS-17 wall are proven; the a11y depth is not.

Uno itself: PASS (UI render-verified 2026-06-12). An actual `dotnet new unoapp -preset blank` app
(`~/ios-vet/unogate`, Uno.Sdk 6.5.x, TFM trimmed to `net10.0-ios`, `ApplicationId` forced, Release full
AOT, signed via the vet keychain) installed and rendered "Hello Uno Platform!" on the iPhone X. The blank
template defaults to `UnoFeatures: SkiaRenderer`, so Uno 6 self-draws on Skia like Avalonia (not native
UIKit); the same a11y caveat applies (Uno's own automation-to-iOS bridge, fidelity is stage-2). Uno does
also ship a native-UIKit renderer (legacy Uno.UI), which would give native a11y at the cost of the older
rendering path; under the a11y-must rule that native renderer, not the Skia default, is Uno's a11y-safe
configuration and should be the one re-verified in stage 2. No fresh crash report, no Slint signature.

So all three frameworks are now gated as frameworks, not just on the shared substrate. Net a11y posture,
which matters under the a11y-must rule: MAUI is strongest (native UIKit handlers, native a11y for free);
Avalonia and Uno render fine but their default (self-drawn Skia) a11y rides a custom bridge whose iOS
fidelity is a stage-2 check, with Uno's native renderer as its a11y-safe fallback.

Toolchain notes for reproduction (Homebrew dotnet 10.0.300): the prior session's `dotnet workload
install ios` had written only the iOS manifest, not the runtime/AOT packs, so the first device build
failed `NETSDK1147: workloads must be installed: ios` even though `dotnet --info` listed the workload.
`dotnet workload restore` in the project pulled the missing packs (the `osx-arm64.Cross.ios-arm64` AOT
cross-compiler and the `Mono.ios-arm64` device runtime). The Microsoft.iOS project templates are also
not registered by the workload install under Homebrew dotnet and were added with
`dotnet new install Microsoft.iOS.Templates`.

## Music-player iOS port (the Slint path is blocked on iOS 16.7)

The music-player is Slint, so the natural port would reuse the UI. But Slint does not run on the
owner's iPhone X (see the Slint result above: the iOS backend is iOS 17+ in two independent places). A
direct Slint port therefore targets iOS 17+ only and excludes this device. Two ways forward:

- Maintain a downported fork of Slint's iOS support: fork accesskit for the four a11y symbols and patch
  Slint's `internal/backends/winit/ios` color-scheme path off the iOS-17 `UITrait` API, accept the
  iOS-16 a11y fidelity loss, and re-verify after every Slint bump. High, ongoing maintenance, and only
  worthwhile if Slint upstream is unwilling to availability-guard these (which also needs objc2 to
  support weak-linked statics for a clean fix).
- Rewrite the UI in a framework that runs on iOS 16.7 with native a11y (Flutter is the strongest
  device-verified option; the WKWebView substrate is the web-UI alternative) while keeping the Rust
  core behind FFI. The audio core ports either way and is the larger asset.

The Rust core reuse holds regardless of the UI choice: symphonia is pure Rust; opus builds its bundled
libopus via cmake (cross-compiles for iOS); cpal has an iOS backend (RemoteIO AudioUnit with
`objc2-avf-audio` AVAudioSession integration), and the crate's `cfg(not(target_os = "linux"))` cpal
table already includes iOS. Background playback is permitted (media playback, not arbitrary background
execution) with `UIBackgroundModes: audio` plus an AVAudioSession playback category. The
`cfg(any(target_os = "linux", target_os = "macos"))` libc QoS table excludes iOS (add
`target_os = "ios"` or drop the QoS lowering there). The real architecture cost is the folder-scanned
queue: the desktop "scan a folder" model does not map to the iOS sandbox, which needs UIDocumentPicker
with security-scoped bookmarks or the app's own Documents container (`UIFileSharingEnabled` plus the
Files app); `rfd`'s iOS support is limited, so this needs a small native shim. True-peak normalization
and the on-disk peak cache are plain sandboxed file I/O and port unchanged. If the Slint UI is kept via
the downported fork, it additionally needs `renderer-skia` (iOS uses Skia/Metal, not the pinned
femtovg/software), a Slint rev past slint-ui/slint#11741 (2026-05-15), and cfg-gating the explicit
winit-backend construction (the Wayland `app_id` is Linux-only).

## Pending gates

Device-verified to render so far: Capacitor (rank 2, covers the six web frameworks, which genuinely
share its WKWebView), Flutter (rank 4), and the full .NET trio (rank 3): substrate (Mono AOT and
interpreter, Rust FFI), MAUI, Avalonia, and Uno all render-verified, above. Slint (rank 1) was gated and
FAILED (disqualified, above).

Owner directives (2026-06-12): (1) defer the six WKWebView frameworks (the Capacitor and Cordova shells
plus the Ionic, Framework7, Onsen, and Quasar UI layers) to the very end, after every native and managed
framework is gated; (2) add Dioxus, SnapKit, UIKit, and SwiftUI to the queue, positioned just before
that deferred web block. The remaining order, each confirmed by render (screenshot) and a few seconds of
no-crash runtime, not by launch success alone:

- Compose Multiplatform (rank 5, expected-pass). Kotlin/Native LLVM-AOT static framework; a cinterop
  link of a Rust `.a`; check whether `embeddedServer(CIO)` binds on iosArm64. Toolchain: JDK 17+,
  Kotlin/Gradle, KMP (Kotlin/Native downloads its own LLVM/iOS toolchain).
- React Native (rank 6, expected-pass; also the gate that proves the CocoaPods + `.xcworkspace` path).
  Confirm `global.HermesInternal` truthy (Hermes AOT-bytecode interpreter live); a C++ JSI/TurboModule
  linking a Rust staticlib. Toolchain: Node, RN community CLI, CocoaPods, Watchman/Metro.
- NativeScript (rank 7, needs-device). The iOS inverse of the Android DENY_EXECMEM death: confirm V8
  runs jitless and a Rust value returns via `dlsym`/libffi with no AMFI/codesign/execmem kill.
  Toolchain: Node, `ns` CLI, Homebrew CMake, CocoaPods, xcodeproj gem.
- Lynx (rank 8, expected-pass). UI renders as native UIKit (`LynxView : UIView`, no WKWebView in the
  hierarchy); PrimJS fires jitless; a `LynxModule` `.mm` links a Rust staticlib. Toolchain: Node, pnpm
  (rspeedy/ReactLynx), CocoaPods, Ruby/Bundler.
- Qt (rank 9, needs-device). Hard constraint: pin Qt 6.5 LTS (iOS 14+). Qt 6.11 sets minimum iOS 17;
  the iPhone X (A11) caps at iOS 16.7, so a 6.11 binary will not install. Confirm a QML screen
  animates (V4 bytecode interpreter, no execmem kill) and a linked Rust value prints. Toolchain: Qt
  for iOS prebuilt static libs (qt-unified) + CMake.

Appended 2026-06-12 (owner), gated after the cross-platform set above and before the deferred web block:

- Dioxus (`dioxuslabs.com`, the most substantive of these four; Rust, so directly relevant to the
  music-player and kopia Rust cores). On iOS, Dioxus mobile renders its UI through `wry` (a WKWebView
  wrapped via `tao`), driven by AOT-compiled Rust, so it is a Rust-driven WKWebView, not native UIKit:
  expected-pass on the substrate (WKWebView is already gated; Rust is AOT, no JIT wall) but it must be
  device-confirmed that the Dioxus + `wry` stack builds and renders on iOS 16.7. a11y is WebKit-native
  (same posture as Capacitor). Toolchain: `dx` CLI (dioxus-cli) plus the `aarch64-apple-ios` Rust target
  (already installed); build with `dx bundle --platform ios` or a cargo staticlib in an Xcode wrapper.
- SnapKit (`github.com/SnapKit/SnapKit`): a pure-Swift Auto Layout constraint DSL over UIKit, no custom
  rendering. The gate is a UIKit Swift app that lays out with SnapKit constraints, pulling SnapKit via
  Swift Package Manager; it doubles as the SPM-Swift-dependency signing check. Native UIKit a11y;
  expected trivial pass. Toolchain: xcodegen (already installed) + SPM.
- UIKit: Apple's native imperative UI. The gate is a pure-UIKit Swift app (xcodegen project like the
  HelloDevice canary, but UIKit instead of SwiftUI). Native a11y, iOS-forever baseline; expected trivial
  pass. Toolchain: xcodegen (already installed).
- SwiftUI: Apple's native declarative UI (iOS 13+). Effectively already render-proven: the HelloDevice
  signing canary (`docs/runbook/ios-iphone-x-codesign-setup.md`, Appendix A) is a SwiftUI app that
  rendered "iOS vet signing OK" on this device. This queue item is a formal re-confirmation, not a new
  unknown. Native a11y. Toolchain: xcodegen (already installed).

Deferred to the very end per the owner directive (the six WKWebView frameworks), after every gate above:

- Apache Cordova substrate (comparison against the already-passed Capacitor shell).
- The four WKWebView UI layers Ionic, Framework7, Onsen, and Quasar: UI-render notes on top of the
  proven WKWebView substrate, no fresh substrate gate.

Universal toolchain base every gate already shares: macOS + Xcode + signing + `rustup target add
aarch64-apple-ios` (the Rust core staticlib is the common FFI payload on every track). Each gate adds
only its own SDK/CLI.
