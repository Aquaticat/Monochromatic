# iOS UI/app-shell stack vet for the iPhone X (music-player port and kopia-to-pCloud backup)

Status: source audit and adversarial cite-check complete for all 16 candidates; device gating in
progress (3 of 9 distinct gates run and passed). The UI/app-shell decision is open (not recorded
here); the document records the comparison and the on-device evidence. Date updated: 2026-06-12.

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

The 16 frameworks collapse to nine distinct device gates (shared substrate and toolchain). Three are
run and passed; six remain (gate order from the synthesis):

- Slint (rank 1): PASS. The in-tree `energy-monitor` demo, built from Slint master for
  `aarch64-apple-ios`, launched on the iPhone X. Native Rust binary, winit plus Skia/Metal, no managed
  runtime. About a two-minute build (prebuilt Skia).
- Capacitor (rank 2, covers Capacitor, Cordova, Ionic, Framework7, Onsen, Quasar): PASS. A minimal
  WKWebView app launched. Capacitor 7 uses Swift Package Manager, not CocoaPods.
- Flutter (rank 4): PASS. A Release (Dart AOT) build launched, confirming the shipping AOT execution
  model on device.
- .NET MAUI (rank 3, covers the .NET trio): pending, needs-device (prove full-AOT P/Invoke and
  trimming survive).
- Compose Multiplatform (rank 5): pending, expected-pass.
- React Native (rank 6): pending, expected-pass; also the gate that proves the CocoaPods path.
- NativeScript (rank 7): pending, needs-device (prove jitless V8 plus libffi static trampolines, the
  iOS inverse of its Android disqualification).
- Lynx (rank 8): pending, expected-pass.
- Qt (rank 9): pending, needs-device; must pin Qt 6.5 LTS because Qt 6.11 requires iOS 17, which the
  iPhone X never gets.

All three passes used one signing path: a forced bundle id (`dev.monochromatic.iosvet.hellodevice`)
plus the vet keychain, with no `-allowProvisioningUpdates`. The path and its proof are in
`ios-iphone-x-vet-reports/device-gate-results.md`.

## Candidate frameworks

### Slint plus Rust (native, the incumbent)

Runs on the device. The app is one cargo-built `aarch64-apple-ios` binary: Slint's UI is Rust, the
`.slint` markup is AOT-compiled by slint-build at host build time, and iOS rendering is winit plus
Skia on Metal. Slint has a first-class, CI-tested, TestFlight-shipping iOS path.

Pros: best repo fit (pure Rust, matching the existing Slint desktop apps); all three walls collapse to
ordinary Rust-on-iOS work; kopia links as a standard static archive via `build.rs` with zero bridge
hops; the music-player's entire symphonia plus cpal core recompiles unchanged because cpal already
ships an iOS CoreAudio backend (`src/host/coreaudio/ios/mod.rs`). For the music-player it is the only
candidate that is not a full UI rewrite. Cons: Slint iOS is newer than the desktop backends (the
build fix slint-ui/slint#11741 landed 2026-05-15, so the port must bump past the music-player's pinned
April rev and switch `renderer-femtovg` to `renderer-skia`); the in-app S3 server must live in the
linked Rust code, not in Slint.

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

The two apps converge on the same top pick for different reasons, then diverge below it.

Music-player port: Slint, decisively, then everyone else far behind. Every non-Slint candidate is a
full UI rewrite of a working Slint app, and Slint alone reuses the symphonia plus cpal audio core
through a recompile (cpal has an iOS CoreAudio backend). The rest rank only as "if you were starting
the UI from scratch": Flutter, Compose Multiplatform, React Native, the WKWebView substrate, the .NET
trio, Qt, Lynx, NativeScript, in that rough order, because below Slint the deciding factors are FFI
cleanliness and audio-thread behavior, not incumbency.

kopia stack: Slint > Flutter > Compose Multiplatform > WKWebView (Capacitor) > React Native > .NET
trio > Qt > Lynx > NativeScript.

- Slint over Flutter: Slint links the Go/Rust core as an ordinary static archive via `build.rs` with
  zero bridge hops and keeps the gateway in first-class Rust matching the repo, versus Flutter's single
  `dart:ffi` hop and a full UI build. Both AOT and both run on device; Slint wins on architecture fit.
- Flutter over Compose Multiplatform: one proven AOT bridge (`dart:ffi`, gate passed) versus a newer
  Kotlin/Native track with an unproven in-app server story on `iosArm64`.
- Compose Multiplatform over WKWebView: cinterop is a single clean C-ABI hop, versus the WebView's
  JS-to-Swift-to-Rust double bridge and the lack of a real in-WebView listening socket.
- WKWebView over React Native: both are JS, both clear wall 2, but the WebView substrate collapses six
  candidates and suits the repo's web strength, while RN's advantage (JSI) still lands the gateway in
  native code under a JS shell; close call, repo fit breaks it.
- React Native over the .NET trio: Hermes is a clean no-JIT interpreter with a zero-copy JSI link,
  versus full-AOT plus trimming risk and AOT P/Invoke marshaling in the .NET trio.
- .NET trio over Qt: one workload covers three UIs and full-AOT is proven on iOS, versus Qt's hard iOS
  17 version ceiling forcing a 6.5 LTS pin and a heavier C++ toolchain.
- Qt over Lynx: Qt is mature with a known static-link and audio story, versus Lynx's unproven device
  maturity.
- Lynx over NativeScript: both are jitless native-UI-from-JS, but Lynx is native UIKit by construction
  with no codegen risk, while NativeScript must prove its libffi static-trampoline path on hardware and
  carries the thinnest maintenance.

Flip conditions:

- If the in-app S3 endpoint is kept framework-independent by embedding the server inside the linked
  Rust/Go staticlib (the recommended de-risk), every framework's HTTP-server uncertainty disappears
  and the ranking is driven purely by FFI cleanliness and UI cost, which only strengthens Slint.
- If the team wants the UI in TypeScript and accepts the music-player rewrite, the WKWebView substrate
  rises above Flutter for the kopia app on repo fit.
- If a needs-device gate fails (the .NET trio's trimming/AOT, NativeScript's libffi path, or a Qt 6.5
  install issue), that track drops below the expected-pass tracks beneath it.

The pick is a value judgment reserved to the owner; this document records the comparison and the
device evidence, not a selection.

## Per-technology scorecard (the shared spine)

The synthesis estimates roughly 52 deduplicated reports because the hard parts are shared and written
once, then reused across every surviving framework. What varies per framework is narrow: the
FFI-bridge marshaling vet, the Slint-UI re-author (every non-Slint candidate rewrites the UI), and the
framework-specific in-process UI-test and e2e harness.

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
- Device ceiling: the iPhone X is A11 and caps at iOS 16.7, so any framework with a minimum deployment
  of iOS 17 (Qt 6.11) cannot install; pin to an LTS that supports iOS 14 to 16.
- Signing for on-device dev: a free personal team gives a 1-year certificate and 7-day profiles; the
  vet reuses one provisioned bundle id so gates need no `-allowProvisioningUpdates`. See
  `ios-iphone-x-vet-reports/device-gate-results.md` and `../runbook/ios-iphone-x-codesign-setup.md`.

## Evidence

Sixteen per-framework source audits were run on 2026-06-12 by a parallel fan-out, each cite-checking
its load-bearing wall claims against a concrete source, followed by an adversarial cite-check and a
synthesis. The raw per-framework reports (verbatim structured output, not lint-conformed) and the
on-device gate results are persisted alongside this doc under `ios-iphone-x-vet-reports/`:

- On-device gates: `device-gate-results.md` (the signing mechanism, plus Slint, Capacitor, and Flutter
  passes with exact build evidence).
- Native: `vet-slint.md`.
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
