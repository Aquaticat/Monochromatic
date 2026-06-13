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

The 16 frameworks collapse to nine distinct device gates (shared substrate and toolchain). Three are now
device-verified to render (Capacitor, Flutter, and the whole .NET trio), Slint is disqualified, and the
rest remain. Two owner directives (2026-06-12) revise the order: defer the six WKWebView frameworks to
the very end, and append Dioxus, SnapKit, UIKit, and SwiftUI just before that web block. Gate status:

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
- .NET trio (rank 3, MAUI/Avalonia/Uno): PASS, all four parts render-verified. The shared Microsoft.iOS
  substrate runs in both Release (full AOT) and Debug (interpreter) and P/Invokes a linked Rust `.a`
  (`[DllImport("__Internal")]`, no execmem kill); then MAUI (native UIKit handlers), Avalonia (own
  SkiaSharp/Metal renderer), and Uno (Skia renderer) each rendered for real. a11y posture: MAUI native;
  Avalonia and Uno-Skia self-draw via their own a11y bridges (stage-2 fidelity check, Uno has a
  native-renderer fallback). The trimming/full-AOT risk flagged in the desk audit did not bite. The
  in-app HTTP/S3 server (ASP.NET Core Kestrel in-process) remains the stage-2 unknown, as for every
  substrate. Evidence in `ios-iphone-x-vet-reports/device-gate-results.md`.
- Compose Multiplatform (rank 5): pending, expected-pass. NEXT to gate.
- React Native (rank 6): pending, expected-pass; also the gate that proves the CocoaPods path.
- NativeScript (rank 7): pending, needs-device (prove jitless V8 plus libffi static trampolines, the
  iOS inverse of its Android disqualification).
- Lynx (rank 8): pending, expected-pass.
- Qt (rank 9): pending, needs-device; must pin Qt 6.5 LTS because Qt 6.11 requires iOS 17, which the
  iPhone X never gets.
- Appended (owner, gate after the above and before the deferred web block): Dioxus (Rust UI, the
  substantive one; historically renders on iOS via `wry`/WKWebView driven by AOT Rust, but verify the
  current backend at gate time, since Dioxus is moving to a native Blitz/WGPU renderer that would make
  a11y a custom bridge rather than WebKit-native), SnapKit (UIKit Auto Layout DSL via SPM), UIKit
  (native), SwiftUI (already render-proven by the HelloDevice canary). The first is a real gate; the
  last three are native/trivial.
- Deferred to the very end (owner): the six WKWebView frameworks (Cordova substrate plus the Ionic,
  Framework7, Onsen, Quasar UI-render notes on the proven Capacitor/WKWebView substrate).

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
verification status now weighs in the ranking. Three candidates are now device-verified to render
(Flutter, the WKWebView substrate, and the .NET trio); the rest are desk "expected-pass" and unconfirmed.
A11y is the separate, still-owed criterion: on-device render is confirmed for all three, but on-device
a11y (VoiceOver) is confirmed for none. a11y strength is so far argued by architecture, descending:
WebKit-native (WKWebView) > native UIKit handlers (Flutter, MAUI) > self-drawn custom bridge (Avalonia,
Uno-Skia, a11y TBD). So "render PASS" is not "a11y cleared"; under a11y-must, a stage-2 VoiceOver pass is
owed on every track, which is exactly what disqualified Slint.

Music-player port: with Slint disqualified, the port to the iPhone X is no longer a UI reuse. Either
maintain a downported Slint fork (high, ongoing maintenance; see the Slint section) or rewrite the UI
while keeping the Rust audio core behind FFI. If rewriting, the ranking is the kopia-stack ranking below
(incumbency no longer applies once the UI is rebuilt); the symphonia plus cpal core reuse holds on every
track.

kopia stack (and the music-player if its UI is rewritten):
Flutter > .NET trio (MAUI) > WKWebView (Capacitor) > Compose Multiplatform > React Native > Qt > Lynx >
NativeScript.

- Flutter over the .NET trio: both are now device-verified with native a11y and link the Rust/Go core
  through a single C-ABI hop (`dart:ffi` / `[DllImport("__Internal")]`, the latter proven on-device by
  the 720 P/Invoke), and both leave the in-app HTTP/S3 server to stage 2. Flutter leads on the more
  mature mobile-and-audio ecosystem and a single first-party framework, where the .NET trio is three UI
  stacks over one runtime (only MAUI gives native a11y; Avalonia and Uno self-draw). The gap is small and
  would close, perhaps invert, if .NET's in-process Kestrel server is device-proven first, since that is
  the kopia app's hardest capability and .NET has the most plausible in-process listening socket of any
  candidate.
- The .NET trio over WKWebView: the device-verified .NET trio renders native UIKit (MAUI) with native
  a11y and reaches the Rust/Go core through one P/Invoke hop, versus the WebView's JS-to-Swift-to-Rust
  double bridge, its lack of a real in-WebView listening socket, and bridge-marshaling cost on
  high-frequency audio/queue state. The desk audit's trimming, full-AOT, and marshaling doubts that had
  placed the trio fifth did not bite on the device (full AOT and the interpreter both render and
  P/Invoke). WKWebView keeps its convenience edge (collapses six candidates, suits the repo's TypeScript
  strength) but that does not outweigh cleaner native integration for an app whose hard parts are native.
  This #2 standing rests on MAUI specifically (its native UIKit a11y, still owed a VoiceOver pass);
  Avalonia and Uno are render-PASS but a11y-TBD and would not individually sit at #2 until their custom
  bridges are VoiceOver-confirmed.
- WKWebView over Compose Multiplatform: WKWebView is device-verified and Compose is not, and Compose's
  in-app server story (`embeddedServer(CIO)` on `iosArm64`) is unproven. Compose's cleaner single
  cinterop hop is why it is close; it would rise above WKWebView once its gate renders and the server
  question resolves.
- Compose Multiplatform over React Native: both expected-pass and AOT/jitless-clean, but cinterop is a
  single C-ABI hop versus RN's C++ JSI/TurboModule, and RN's streaming pump and server still land in
  native code under a JS shell.
- React Native over Qt: RN's Hermes is a clean no-JIT interpreter with a zero-copy JSI link and a large
  ecosystem, versus Qt's hard iOS-17 ceiling forcing a 6.5 LTS pin and a heavier C++ toolchain.
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
- If a still-unconfirmed needs-device gate crashes on render (NativeScript's libffi path, a Qt 6.5
  install issue) or an expected-pass gate fails the way Slint did, that track drops accordingly. The
  Slint result is the standing proof that desk "expected-pass" is not device-confirmed. The .NET trio's
  trimming/AOT risk is now retired: it was device-confirmed to render (full AOT and interpreter) and
  P/Invoke a linked Rust `.a`.
- If the in-app S3 endpoint is kept framework-independent by embedding the server inside the linked
  Rust/Go staticlib (the recommended de-risk), every framework's HTTP-server uncertainty disappears.

The pick is a value judgment reserved to the owner; this document records the comparison and the device
evidence, not a selection.

## Second-pass ranking: minimizing non-allowed programming languages (owner directive 4)

This is a re-vet of the survivors on a different axis from the capability ranking above. Owner directive 4
(2026-06-12) constrains implementation languages to Kotlin, TypeScript, and Rust, and asks that the chosen
framework and the eventual port minimize Swift and every other non-allowed programming language (Objective-C
`.m` shims, C, C++, Dart, C#). Non-programming languages are exempt: HTML, CSS, the Vue and QML markup
templates, YAML, JSON, TOML, and XML do not count against a framework. This is a ranking axis, not a vet
gate: every framework was still gated for completeness (all 16 render-verified both legs), but a framework
whose app code is authored in an allowed language is preferred. The two axes point in different directions,
which is the whole reason to record this one separately: the capability ranking favours Flutter and the
.NET trio, whereas those two author the app in Dart and C# and so fall on this axis.

Each survivor's language footprint, from the device gates:

- Dioxus: app code is Rust (RSX). No FFI shim and, for the music-player, no FFI boundary at all, because the
  UI is itself Rust and links the Rust audio core directly. Non-allowed programming languages: zero.
- Compose Multiplatform: app code is Kotlin. The Rust core is reached through a single cinterop hop, whose
  surface is a C-ABI `.def` declaration, not hand-written C. Non-allowed: zero.
- NativeScript: app code is TypeScript. Its Rust crossing was the only JS shell that needed zero
  hand-written native code (a C-ABI header plus a `module.modulemap` plus a `-u` linker flag, all
  declarations and config). Non-allowed: zero.
- The WKWebView shells (Capacitor and Cordova substrates; Ionic, Framework7, Onsen, Quasar UI layers): app
  code is TypeScript or JavaScript plus exempt HTML and CSS (Quasar adds a Vue template, which is exempt
  markup compiled to JS). Non-allowed in the app: zero. The only place a non-allowed language can enter is a
  bespoke native plugin (Capacitor `CAPPlugin` or Cordova `CDVPlugin`), which in pure form is Swift or
  Objective-C; the universal de-risk (the in-app server and core inside the linked Rust staticlib, reached
  through an existing plugin) keeps even that out, so the non-allowed surface is minimizable to zero.
- React Native: app code is TypeScript, but the proven Rust crossing used a thin Objective-C `.m`
  `RCTBridgeModule` (the owner-approved minimal-shim deviation). Non-allowed: one thin `.m` shim.
- Lynx: app code is TypeScript, but the proven Rust crossing used a pure Objective-C `.m` `LynxModule`
  shim. Non-allowed: one thin `.m` shim.
- The .NET trio (MAUI, Avalonia, Uno): app code is C#, a non-allowed language, for the entire app. It does
  cleanly avoid C and C++ (the Rust P/Invoke is a declaration), but the app language itself is non-allowed.
- Flutter: app code is Dart, a non-allowed language, for the entire app.
- The Swift trio (SnapKit, UIKit, SwiftUI): app code is 100% Swift, a non-allowed language. Already
  baseline-only, listed here for completeness, not an implementation candidate.

Language-axis ranking (best to worst at minimizing non-allowed programming languages):

Dioxus > Compose Multiplatform = NativeScript > WKWebView shells > React Native = Lynx > .NET trio >
Flutter > Swift trio.

- Dioxus over everything else: it is the only candidate that authors the app in an allowed language (Rust)
  AND needs no FFI boundary to the Rust core, so for the music-player it is zero non-allowed code end to
  end. The others authored in an allowed language still cross a C-ABI boundary to reach the Rust core;
  Dioxus does not have one to cross.
- Compose Multiplatform and NativeScript are tied on this axis: both author the app in an allowed language
  (Kotlin, TypeScript) and reach the Rust core with zero hand-written non-allowed code (a cinterop `.def`
  for Compose, a C-ABI header plus modulemap for NativeScript). The tie breaks on secondary, non-language
  factors only: Compose's Kotlin is a compiled, strongly typed allowed language that the repo already runs
  on Android, where NativeScript carries the thinnest maintenance of any candidate, so for a real build
  Compose is the safer of the two equals.
- Compose and NativeScript over the WKWebView shells: all three keep non-allowed app code at zero, but the
  shells carry a latent Swift/Objective-C risk in any bespoke native plugin, where Compose's cinterop and
  NativeScript's metadata bridge keep the native boundary inside declarations and config. The shells are
  one conditional deviation behind; the gap closes to zero if the in-staticlib server de-risk holds.
- The WKWebView shells over React Native and Lynx: the shells need no hand-written native shim to render
  (and only a conditional one for a custom plugin), whereas React Native and Lynx each needed a real,
  hand-written Objective-C `.m` shim to surface the Rust value in the gate. A proven `.m` file outranks (as
  worse) a merely possible one.
- React Native and Lynx are tied: each authors the app in TypeScript and each needed exactly one thin
  Objective-C `.m` shim for the Rust crossing; neither has a pure-allowed-language path proven on device.
- React Native and Lynx over the .NET trio: a TypeScript app with one thin Objective-C shim has far less
  non-allowed code than an entire app authored in C#.
- The .NET trio over Flutter: a tie on "entire app in a non-allowed language," broken because C# at least
  reaches native through pure P/Invoke declarations with no C/C++, and the trio includes MAUI's native
  UIKit a11y, whereas Dart is equally non-allowed with no offsetting language advantage.
- Flutter over the Swift trio: both author the app in a non-allowed language, but Flutter is at least a
  cross-platform option, where the Swift trio is Apple-only and already baseline-only.

What this reshapes. On directive 4 the implementation shortlist is Dioxus first (Rust, and uniquely
zero-boundary for the music-player's Rust core), then Compose Multiplatform (Kotlin) and the
TypeScript stacks (NativeScript, then the WKWebView shells), with React Native and Lynx one minimal shim
behind. Flutter and the .NET trio, which lead the capability ranking, are demoted here because Dart and C#
are non-allowed; they return to contention only if their capability lead proves decisive, most plausibly if
one of them is the first to device-prove the in-app HTTP/S3 server (the one capability the capability
ranking still flags as uncertain). The owner weighs the two axes; this section supplies the language axis.

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
