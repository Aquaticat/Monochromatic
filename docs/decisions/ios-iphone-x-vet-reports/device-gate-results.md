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

Of the nine distinct device gates the synthesis identified (the 16 frameworks collapse to nine on
shared substrate and toolchain), two are device-verified to render: Capacitor (rank 2, covers six) and
Flutter (rank 4). Slint (rank 1) was gated and FAILED (disqualified, above). Remaining, in the
synthesis gate order, each to be confirmed by render (screenshot) and a few seconds of no-crash
runtime, not by launch success alone:

- .NET MAUI (rank 3, needs-device, covers MAUI/Avalonia/Uno). Build both Release (Mono full-AOT) and
  Debug (interpreter); confirm `[DllImport("__Internal")]` into a linked Rust `.a` returns with no
  JIT exception, no `EXC_BAD_ACCESS`, no codesign/execmem kill. Toolchain: `dotnet workload install
  ios` on the present dotnet 10.0.300.
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
- Apache Cordova substrate (optional, comparison against Capacitor only; the four WKWebView UI layers
  Ionic/Framework7/Onsen/Quasar need no fresh substrate gate, only UI-render notes).

Universal toolchain base every gate already shares: macOS + Xcode + signing + `rustup target add
aarch64-apple-ios` (the Rust core staticlib is the common FFI payload on every track). Each gate adds
only its own SDK/CLI.
