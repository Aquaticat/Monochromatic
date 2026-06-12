# iOS framework device-gate results (iPhone X)

On-device build-and-run outcomes for the funnel's stage 1, recorded as each framework is gated on
the owner's iPhone X (`iPhone10,3`, iOS 16.7.16, build 20H392, UDID
`9057e2a8c2e70162e35b9ea8bf006f736670877b`). This is the evidence layer the desk audits cannot
produce: a desk audit judges from source, a gate judges from a signed app actually launching on the
hardware. Read this together with the per-framework `vet-<framework>.md` reports (source audit) and
the synthesis at `docs/decisions/ios-iphone-x-music-player-kopia-stack.md`.

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
  (`b08f51d5-37ba-4462-b098-d1533058bf16`), `** BUILD SUCCEEDED **`, then `ios-deploy ... run` printed
  `success`.

Because Apache Cordova, Ionic, Framework7, Onsen UI, and Quasar all render their UI inside the same
WKWebView the Capacitor (or Cordova) shell hosts, this PASS establishes the substrate for all of them.
What remains for those is layer-specific (the JS UI library and the plugin used for the in-app HTTP
server, native FFI, and background), not a fresh substrate gate. Cordova still warrants its own
substrate gate only to compare its shell against Capacitor's; the four UI layers do not.

### Slint: PASS (native Rust, highest product value)

Status: device-confirmed 2026-06-12.

The in-tree `energy-monitor` demo, built from Slint master, launched on the iPhone X. Decisive facts:

- The app is a Rust binary cross-compiled to `aarch64-apple-ios`, wrapped by an xcodegen
  `ios-project.yml` whose `postCompileScripts` runs `scripts/build_for_ios_with_cargo.bash`
  (`cargo build --target aarch64-apple-ios --bin`, then lipo, dSYM, and codesign). Slint renders on
  iOS through the winit backend plus the Skia renderer on Metal (the femtovg and software renderers
  are not the iOS path).
- The full Slint + Skia iOS build finished in about two minutes (14:41:33 to 14:43:30), because Skia
  resolves prebuilt iOS binaries rather than compiling from source. This is the cargo-built-executable
  signing path (distinct from Capacitor's SwiftPM path), and it works the same way: the build script's
  `codesign --force --sign <hash>` resolves the identity through the vet keychain in the search list,
  and the override `PRODUCT_BUNDLE_IDENTIFIER=dev.monochromatic.iosvet.hellodevice` plus
  `DEVELOPMENT_TEAM=HWLVAKDV4F CODE_SIGN_STYLE=Automatic` on the xcodebuild line let it reuse the
  existing profile (`b08f51d5...`) with no call to Apple.
- `xcodegen generate --spec ios-project.yml` is required because the spec is not named the default
  `project.yml`. `** BUILD SUCCEEDED **`, then `ios-deploy ... run` printed `success`.

So Slint on iOS is real and runs on this exact device today, on master. At the crates.io release it
would not: the iOS build fix (slint-ui/slint#11741) postdates the 1.16 line.

## Music-player iOS port (settled by the Slint gate plus source)

The music-player (`packages/desktop-app/music-player`, Rust + Slint) can be ported to iOS. The Slint
gate proves the UI path on this device; the audio path is confirmed from source. Required changes,
each concrete:

- Renderer: the crate pins `renderer-femtovg` and `renderer-software`; iOS needs `renderer-skia`
  (Metal). Add it under a target cfg.
- Slint revision: the crate pins rev `85e3eb76` (a master rev from about 2026-04-15, for the Flickable
  wheel fix #11338). iOS support needs at least #11741 (merged 2026-05-15, "winit: fix the iOS build
  failure") plus the May safe-area and CADisplayLink fixes. The port must bump the pin to a late-May
  or newer master rev.
- Backend construction: the crate constructs `i-slint-backend-winit` explicitly to set the Wayland
  `app_id` (KDE taskbar). That code is already `cfg(target_os = "linux")`; on iOS, fall back to
  Slint's default backend (do not hand-construct winit).
- Audio core reuse (no AVAudioEngine rewrite): symphonia is pure Rust; opus builds its bundled libopus
  via cmake (cross-compiles for iOS); cpal has an iOS backend (RemoteIO AudioUnit with `objc2-avf-audio`
  AVAudioSession integration). The crate's `cfg(not(target_os = "linux"))` cpal table already includes
  iOS. Background playback is permitted (it is media playback, not arbitrary background execution) but
  needs the app-level `UIBackgroundModes: audio` plus an AVAudioSession playback category.
- The `cfg(any(target_os = "linux", target_os = "macos"))` libc table (thread QoS in `measure.rs`)
  excludes iOS; either add `target_os = "ios"` or drop the QoS lowering there for iOS.
- Filesystem and queue model: this is the real architecture cost. The desktop "scan a folder" queue
  does not map to the iOS sandbox. iOS needs file or folder import through UIDocumentPicker with
  security-scoped bookmarks, or reading from the app's own Documents container (exposed via
  `UIFileSharingEnabled` and the Files app). `rfd`'s iOS file-dialog support is limited, so this likely
  needs a small native shim. The true-peak normalization and on-disk peak cache are plain sandboxed
  file I/O and port unchanged.

## Pending gates

- Flutter (top candidate; proves the Dart-AOT path and Flutter's own iOS integration). Toolchain:
  Flutter 3.44.2 present; needs `flutter precache --ios`.
- React Native (proves the CocoaPods + `.xcworkspace` path and Hermes AOT bytecode).
- .NET trio (MAUI, then Avalonia and Uno) on one `dotnet workload install` of the iOS workload.
- Compose Multiplatform (Kotlin/Native AOT to iOS).
- NativeScript (the iOS twin of the Android DENY_EXECMEM disqualification: confirm jitless interpreter
  behavior on device).
- Qt for iOS (static link; QtMultimedia audio).
- Lynx (PrimJS on iOS; maturity of device support).
- Cordova substrate (comparison against Capacitor only).
