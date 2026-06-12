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

## Pending gates

- Slint (highest product value: the music-player is already Slint). Built from master, not the
  crates.io release, because the iOS-build fix (slint-ui/slint#11741) postdates 1.16. Toolchain: Rust
  iOS targets plus xcodegen, both present.
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
