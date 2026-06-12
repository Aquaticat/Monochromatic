# iOS UI/app-shell stack vet for the iPhone X (music-player port and kopia-to-pCloud backup)

Status: source audit and adversarial cite-check complete for all 16 candidates; device gating in
progress. Of 9 distinct gates, 2 are device-verified to render (Capacitor, Flutter); Slint is
disqualified for this device (its iOS backend is iOS 17+, see below); 6 remain. Accessibility is a hard
requirement (owner-stated), which is decisive against Slint here. The UI/app-shell decision is open
(not recorded here); the document records the comparison and the on-device evidence. Date updated:
2026-06-12.

## Context

Two apps define the requirements, both for the owner's iPhone X (`iPhone10,3`, iOS 16.7.16, A11, which
never receives iOS 17):

- The kopia-to-pCloud backup app (the same product as the Android vet,
  `kotlin-android-kopia-pcloud-stack.md`). It runs kopia on the phone and backs up to pCloud without
  staging a second copy. kopia speaks S3, so the app stands up a local S3/HTTP endpoint that kopia
  targets and translates to pCloud, streaming bytes through rather than buffering.
- `packages/desktop-app/music-player`, a Rust plus Slint native player (symphonia plus libopus decode,
  always-on true-peak normalization with an on-disk peak cache, a folder-scanned queue with two-axis
  pagination, session persistence, cpal output) to be ported to iOS.

Hard requirements, owner-stated: accessibility (a11y) is mandatory, and the target is specifically the
iPhone X, which is A11 silicon and never receives iOS 17. Together these are decisive: a framework
whose iOS support assumes iOS 17 APIs cannot be used on this device even if it builds, and a11y cannot
be dropped to dodge an iOS-17 a11y dependency.

Standard: choosing-technology full-verification. Every candidate was cloned, source-audited, and the
load-bearing runtime claims cite a concrete source file or doc; survivors are built and launched on
the physical device, not judged from metadata. The repo is a TypeScript plus Rust monorepo (mise,
pnpm, cargo).

## The three iOS platform walls (every candidate inherits these)

These reshape the criteria, and they are the iOS counterpart to the Android cross-cutting constraints:

1.  No exec of bundled binaries. The Android design (ship kopia as `jniLibs`, exec from
    `nativeLibraryDir`) is illegal on iOS. kopia must be a linked static library (a Go gomobile
    c-archive `.xcframework`, or a Rust staticlib) called over the C ABI. The per-framework test is
    "can it link and call a Go/Rust static lib," not "can it exec a binary."
2.  No JIT and no writable-executable memory for app-process code. Only the out-of-process WKWebView
    WebContent process holds the dynamic-codesigning entitlement. This is the iOS twin of the
    GrapheneOS `DENY_EXECMEM` that disqualified NativeScript on the Pixel 6. The decisive finding of
    this vet is that the wall fires differently on iOS: nothing is JIT-fatal here, because every
    in-app scripting engine already runs jitless on iOS (see below), the exact inverse of Android.
3.  No long-running background. No foreground-service equivalent; only background `URLSession` and
    `BGProcessingTask` (short, idle/charging). A multi-hour kopia snapshot is not expressible the way
    it is on Android and must be restructured around background `URLSession`. Audio playback is the
    exception: it is permitted in the background via `UIBackgroundModes: audio` plus an active
    AVAudioSession, so the music-player can play backgrounded.

The wall-2 inversion, stated plainly because it overturns the Android intuition: NativeScript's V8
runs unconditionally jitless on iOS (its `--jitless` is forced, the inverse of the Android
DENY_EXECMEM death); React Native's Hermes is a no-JIT ahead-of-time bytecode interpreter; Lynx's
PrimJS ships precompiled AArch64; Qt's V4 falls back to its bytecode interpreter; Flutter and the .NET
trio AOT-compile. WKWebView's JIT is the sanctioned out-of-process one. So no candidate is pruned on
source evidence alone; the standard is on-device.

## Decisive result: run on the real device

The 16 frameworks collapse to nine distinct device gates (shared substrate and toolchain). Two are
device-verified to render, Slint is disqualified, and six remain (gate order from the synthesis):

- Slint (rank 1): FAIL, disqualified. The `energy-monitor` demo builds and the process launches, but
  held alive and screenshotted it crashes before rendering. Slint's iOS support is iOS 17+ in two
  independent places: `accesskit_ios` (a11y) references four iOS-17 symbols (dyld `Symbol not found:
  _UIAccessibilityPriorityHigh`), and Slint's own winit backend reads dark/light mode through the
  iOS-17 `UITrait` API (panic `class UITraitUserInterfaceStyle could not be found`). The iPhone X never
  gets iOS 17. Evidence in `ios-iphone-x-vet-reports/device-gate-results.md`.
- Capacitor (rank 2, covers Capacitor, Cordova, Ionic, Framework7, Onsen, Quasar): PASS, render-verified
  (the screenshot shows the WebView content). Capacitor 7 uses Swift Package Manager, not CocoaPods;
  WebKit provides native a11y.
- Flutter (rank 4): PASS, render-verified (the Dart AOT Release build draws its UI). Native UIKit a11y.
- .NET MAUI (rank 3, covers the .NET trio): pending, needs-device (prove full-AOT P/Invoke and
  trimming survive).
- Compose Multiplatform (rank 5): pending, expected-pass.
- React Native (rank 6): pending, expected-pass; also the gate that proves the CocoaPods path.
- NativeScript (rank 7): pending, needs-device (prove jitless V8 plus libffi static trampolines, the
  iOS inverse of its Android disqualification).
- Lynx (rank 8): pending, expected-pass.
- Qt (rank 9): pending, needs-device; must pin Qt 6.5 LTS because Qt 6.11 requires iOS 17, which the
  iPhone X never gets.

Every gate used one signing path: a forced bundle id (`dev.monochromatic.iosvet.hellodevice`) plus the
vet keychain, with no `-allowProvisioningUpdates`. The signing proof and the render-vs-launch
verification method (`idevicedebug -d run` plus `idevicescreenshot`, since `ios-deploy --justlaunch`
reports success before any UI draws) are in `ios-iphone-x-vet-reports/device-gate-results.md`.

## Candidate frameworks

### Slint plus Rust (native, the incumbent): DISQUALIFIED for this device

Does not run on the iPhone X. The app builds (one cargo-built `aarch64-apple-ios` binary, winit plus
Skia/Metal) and the process launches, but it crashes before rendering because Slint's iOS support
assumes iOS 17 in two independent places, both verified on the device: the a11y backend `accesskit_ios`
references four iOS-17 symbols unconditionally (dyld load failure), and Slint's own winit iOS backend
reads dark/light mode through the iOS-17 `UITrait` API (runtime panic). The iPhone X is A11 and caps at
iOS 16.7. a11y is a hard requirement, so the first wall cannot be dodged by dropping a11y, and the
second wall is in Slint's own code regardless of a11y.

On paper Slint is the best repo fit (pure Rust, matching the existing Slint desktop apps; kopia links
as a standard static archive via `build.rs` with zero bridge hops; the music-player's symphonia plus
cpal core recompiles unchanged because cpal already ships an iOS CoreAudio backend at
`src/host/coreaudio/ios/mod.rs`; it is the only candidate that is not a full UI rewrite). None of that
applies while it cannot launch on the device. Reviving it requires maintaining a downported fork of
both accesskit and Slint's winit iOS backend, with an iOS-16 a11y fidelity loss and re-verification
after every Slint bump, until upstream availability-guards these APIs (which also needs objc2 to support
weak-linked statics). This is the iOS analog of Slint's Android disqualification (dex loading on
GrapheneOS): does not run on the owner's device on either platform.

### WKWebView substrate (Capacitor and Cordova shells; Ionic, Framework7, Onsen, Quasar UI layers)

Runs on the device. App UI/logic is HTML/CSS/JS in the out-of-process WebContent process; the app
process runs only AOT Swift/ObjC. Every load-bearing capability is delivered by a native plugin
(`CAPPlugin`/`CDVPlugin`) that links a Go c-archive or Rust staticlib and bridges results to the
WebView.

Pros: the web UI suits the repo's TypeScript strength; one substrate covers six candidates; wall 2 is
free (JS JITs only in the sanctioned WebContent process). Cons: a JS-to-Swift-to-Rust double bridge
for every kopia/audio call; the in-app S3 endpoint cannot be a WKWebView `URLSchemeHandler` (that is a
request interceptor, not a listening socket) and must move into the linked staticlib; the music-player
is a full rewrite into web UI; high-frequency audio/queue state pays bridge-marshaling cost.

### Flutter (Dart AOT plus native UI)

Runs on the device in Release (Dart AOT). kopia links via `dart:ffi` (`ffigen`); cpal output runs
through `RemoteIO`. Single managed-to-native bridge, lighter than the WebView double bridge.

Pros: mature, strong tooling, AOT on device confirmed; one FFI hop. Cons: full Slint-to-Flutter UI
rewrite; Dart mutation testing is weak (QA leans on the shared Rust core); background and audio still
need platform-channel Swift wiring.

### Compose Multiplatform (Kotlin/Native AOT)

Expected to run (Kotlin/Native LLVM-AOT static framework, no VM or JIT by construction). kopia links
via cinterop; `ktor-client-darwin` streams to pCloud.

Pros: AOT by construction; cinterop is a clean C-ABI link; same Compose model the Android vet already
favored if multi-target matters. Cons: full Slint-to-Compose rewrite; whether `embeddedServer(CIO)`
binds on `iosArm64` is unproven (the in-app server likely moves into the staticlib); newest toolchain
of the managed group on iOS.

### React Native (Hermes, jitless AOT bytecode)

Expected to run. Hermes interprets ahead-of-time `.hbc` bytecode (no JIT); kopia links via a C++
JSI/TurboModule. This is also the gate that proves the CocoaPods plus `.xcworkspace` path.

Pros: TypeScript-friendly; JSI is a zero-serialization C++ boundary; Hermes clears wall 2 cleanly.
Cons: full Slint-to-React rewrite; the streaming pump and server belong in native/Rust, with RN as a
launcher; background needs native URLSession bridging.

### .NET trio (MAUI, Avalonia, Uno)

Needs-device. All three ride `Microsoft.iOS` on MonoVM; Release is Mono full-AOT native ARM64 (no
JIT), with the interpreter as a debug-only fallback. kopia links via `[DllImport("__Internal")]`.

Pros: one workload and one P/Invoke pattern covers all three; full-AOT clears wall 2. Cons: trimming
and full-AOT safety are real risks (MAUI is not trimmer-safe; reflection-using deps can crash under
`MtouchLink=Full`); P/Invoke marshaling of Rust structs/callbacks/buffers under AOT is fiddly;
real-time audio callback threads versus the Mono GC need care; full UI rewrite.

### Qt (static, V4 interpreter)

Needs-device, and gate-constrained: pin Qt 6.5 LTS (iOS 14+). Qt 6.11 sets minimum iOS 17, so a 6.11
binary will not install on the A11 iPhone X. kopia links into a static Qt binary via `extern "C"`.

Pros: mature C++ with static linking; QtMultimedia and QTcpServer cover audio and the in-app endpoint.
Cons: the version pin is a hard ceiling; QML/JS logic runs on the V4 bytecode interpreter unless moved
to C++ or qmlcachegen; full UI rewrite; heaviest native toolchain.

### NativeScript (jitless V8, libffi)

Needs-device, and the most interesting wall-2 case: on iOS NativeScript's V8 runs jitless
unconditionally (the inverse of its Android DENY_EXECMEM death), and its ObjC bridge uses libffi
static trampolines. kopia links via `dlsym`/libffi.

Pros: native UI from TypeScript; the Android disqualifier does not apply on iOS. Cons: must prove the
libffi no-codegen path on signed hardware; interpreted-V8 CPU cost for any in-JS hot path; the
streaming pump and server have no JS home (forced into the linked Rust/native code); full UI rewrite;
thin maintenance.

### Lynx (PrimJS, native UIKit)

Expected to run. UI renders as native UIKit (`LynxView : UIView`, no WKWebView); PrimJS ships
precompiled AArch64 and fires jitless; kopia links via a `LynxModule` `.mm`.

Pros: native UIKit from a web-like authoring model; jitless by construction. Cons: youngest ecosystem,
device-support maturity is the open question; full UI rewrite; smallest tooling and test story.

## Ranking (analysis, not a recorded decision)

Slint's disqualification removes the former top pick and the only no-UI-rewrite option, and it carries
a method lesson: Slint was "expected-pass" on the desk audit and crashed on the device, so on-device
verification status now weighs in the ranking. Two candidates are device-verified to render with native
a11y (Flutter and the WKWebView substrate); the rest are desk "expected-pass" and unconfirmed.

Music-player port: with Slint disqualified, the port to the iPhone X is no longer a UI reuse. Either
maintain a downported Slint fork (high, ongoing maintenance; see the Slint section) or rewrite the UI
while keeping the Rust audio core behind FFI. If rewriting, the ranking is the kopia-stack ranking below
(incumbency no longer applies once the UI is rebuilt); the symphonia plus cpal core reuse holds on every
track.

kopia stack (and the music-player if its UI is rewritten):
Flutter > WKWebView (Capacitor) > Compose Multiplatform > React Native > .NET trio > Qt > Lynx >
NativeScript.

- Flutter over WKWebView: both are device-verified with native a11y, but Flutter links the Rust/Go core
  through a single `dart:ffi` hop and renders native UIKit, versus the WebView's JS-to-Swift-to-Rust
  double bridge, its lack of a real in-WebView listening socket, and bridge-marshaling cost on
  high-frequency audio/queue state. WKWebView's edge (collapses six candidates, suits the repo's
  TypeScript strength) does not outweigh the cleaner core integration for an app whose hard parts are
  native.
- WKWebView over Compose Multiplatform: WKWebView is device-verified and Compose is not, and Compose's
  in-app server story (`embeddedServer(CIO)` on `iosArm64`) is unproven. Compose's cleaner single
  cinterop hop is why it is close; it would rise above WKWebView once its gate renders and the server
  question resolves.
- Compose Multiplatform over React Native: both expected-pass and AOT/jitless-clean, but cinterop is a
  single C-ABI hop versus RN's C++ JSI/TurboModule, and RN's streaming pump and server still land in
  native code under a JS shell.
- React Native over the .NET trio: Hermes is a clean no-JIT interpreter with a zero-copy JSI link,
  versus full-AOT plus trimming risk and AOT P/Invoke marshaling in the .NET trio.
- .NET trio over Qt: one workload covers three UIs and full-AOT is proven on iOS generally, versus Qt's
  hard iOS-17 ceiling forcing a 6.5 LTS pin and a heavier C++ toolchain.
- Qt over Lynx: Qt is mature with a known static-link and audio story, versus Lynx's unproven device
  maturity.
- Lynx over NativeScript: both are jitless native-UI-from-JS, but Lynx is native UIKit by construction
  with no codegen risk, while NativeScript must prove its libffi static-trampoline path on hardware and
  carries the thinnest maintenance.

Flip conditions:

- The big one is Slint: if the team will maintain a downported fork of accesskit and Slint's winit iOS
  backend (or upstream availability-guards the iOS-17 APIs and objc2 gains weak-linked statics), Slint
  returns as the top pick for both apps on repo fit and zero-bridge core integration. Until then it does
  not run on the device, so it is out under the a11y-must rule.
- If a needs-device gate crashes on render (the .NET trio's trimming/AOT, NativeScript's libffi path, a
  Qt 6.5 install issue) or an expected-pass gate fails the way Slint did, that track drops accordingly.
  The Slint result is the standing proof that desk "expected-pass" is not device-confirmed.
- If the in-app S3 endpoint is kept framework-independent by embedding the server inside the linked
  Rust/Go staticlib (the recommended de-risk), every framework's HTTP-server uncertainty disappears.

The pick is a value judgment reserved to the owner; this document records the comparison and the device
evidence, not a selection.

## Per-technology scorecard (the shared spine)

The synthesis estimates roughly 52 deduplicated reports because the hard parts are shared and written
once, then reused across every surviving framework. What varies per framework is narrow: the
FFI-bridge marshaling vet, the UI re-author (every candidate now rewrites the Slint UI, since Slint is
disqualified on this device), and the framework-specific in-process UI-test and e2e harness.

- Shared Rust/Go core (identical on every track): the music-player symphonia plus cpal core (decode,
  true-peak normalization, peak cache, queue, pagination, persistence) and the kopia c-archive or Rust
  staticlib. Reused as-is; cpal already targets iOS CoreAudio, so no AVAudioEngine rewrite.
- kopia as a linked static lib (wall 1): a Go gomobile c-archive `.xcframework` or a Rust staticlib,
  linked and called over the C ABI. The mechanism differs per framework (Slint `build.rs` static link;
  Flutter `dart:ffi`; Compose cinterop; RN C++ JSI/TurboModule; .NET `[DllImport("__Internal")]`;
  WKWebView `CAPPlugin`/`CDVPlugin`; NativeScript `dlsym`/libffi; Lynx `LynxModule`; Qt `extern "C"`),
  but the payload is the same archive.
- In-app HTTP/S3 endpoint: the single genuinely uncertain capability across substrates. WKWebView's
  `URLSchemeHandler` is not a listening socket, and Compose's `embeddedServer(CIO)` on `iosArm64` is
  unproven. Universal de-risk: embed the server inside the linked Rust/Go staticlib (kopia's own
  server, or `hyper`/`tiny_http` bound to `127.0.0.1`), making the endpoint framework-independent.
- HTTPS streaming to pCloud: `reqwest` plus `rustls` (or the Go client) inside the linked core, or a
  background `URLSession` bridge for transfers that must survive suspension.
- Background transfer (wall 3): background `URLSession` plus `BGProcessingTask`, the snapshot chunked
  and resumable; identical restructuring work on every track.
- Audio output: cpal CoreAudio/`RemoteIO` plus an AVAudioSession activation shim and
  `UIBackgroundModes: audio`; the one piece of unavoidable iOS glue on any framework.
- Testing: in-process UI test is framework-specific (Slint testing backend, runComposeUiTest,
  `flutter_test`, XCUITest, and so on); black-box e2e is XCUITest or Maestro/Appium; fuzz, mutation,
  and property testing run once on the shared Rust core (cargo-fuzz, cargo-mutants, proptest) plus a
  thin per-framework bridge/boundary fuzz.

## Cross-cutting iOS constraints (any framework)

- No exec of bundled binaries; kopia is a linked static archive, not an exec'd CLI.
- No app-process JIT/executable memory; the WKWebView WebContent process is the only JIT surface.
  Nothing here is JIT-fatal on iOS, because every in-app scripting engine runs jitless (the inverse of
  the Android DENY_EXECMEM result that disqualified NativeScript and Slint's dex path there).
- No long-running background; restructure the snapshot around background `URLSession` and
  `BGProcessingTask`. Audio playback is permitted backgrounded with `UIBackgroundModes: audio`.
- Device ceiling: the iPhone X is A11 and caps at iOS 16.7, so any framework that depends on an iOS-17
  API cannot run here. This disqualifies Slint (its accesskit a11y backend and its own winit
  color-scheme code both reference iOS-17 symbols) and forces Qt to the 6.5 LTS pin (6.11 sets a 17
  minimum). Verify on the device, not at build time: Slint built and launched yet crashed at dyld load
  and again at the first trait-collection change.
- Signing for on-device dev: a free personal team gives a 1-year certificate and 7-day profiles; the
  vet reuses one provisioned bundle id so gates need no `-allowProvisioningUpdates`. See
  `ios-iphone-x-vet-reports/device-gate-results.md` and `../runbook/ios-iphone-x-codesign-setup.md`.

## Evidence

Sixteen per-framework source audits were run on 2026-06-12 by a parallel fan-out, each cite-checking
its load-bearing wall claims against a concrete source, followed by an adversarial cite-check and a
synthesis. The raw per-framework reports (verbatim structured output, not lint-conformed) and the
on-device gate results are persisted alongside this doc under `ios-iphone-x-vet-reports/`:

- On-device gates: `device-gate-results.md` (the signing mechanism, the render-vs-launch verification,
  the Capacitor and Flutter render passes, and the Slint disqualification, with exact evidence).
- Native (disqualified on device): `vet-slint.md`.
- WKWebView substrate: `vet-capacitor.md`, `vet-cordova.md`, `vet-ionic.md`, `vet-framework7.md`,
  `vet-onsen.md`, `vet-quasar.md`.
- Managed/AOT: `vet-flutter.md`, `vet-dotnet-maui.md`, `vet-avalonia.md`, `vet-uno.md`,
  `vet-compose-mp.md`.
- Jitless JS, native UI: `vet-react-native.md`, `vet-nativescript.md`, `vet-lynx.md`.
- C++ static: `vet-qt.md`.

The deeper supporting-stack vets (the shared Rust core, kopia packaging, in-app server, HTTPS
streaming, background, audio, and per-framework bridge plus test harnesses, roughly 52 reports total)
are stage 2 and not yet run; the inventory is enumerated per framework inside each `vet-*.md`.

## Out of scope (owner-decided)

Running kopia on iOS, the pCloud native API, and whether the custom S3 gateway is necessary are
product and architecture decisions made by the owner and are not assessed here.
