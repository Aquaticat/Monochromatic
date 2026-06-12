# iOS UI/app-shell framework vet for the iPhone X

Status as of 2026-06-12 (third handover): signing path DONE; source-audit fan-out DONE (16 reports +
synthesis); device gating in progress. Render-verified so far: Capacitor PASS, Flutter PASS, and the
entire .NET trio (the shared Microsoft.iOS substrate plus MAUI, Avalonia, and Uno, each gated as an
actual framework, not just on the substrate). Slint DISQUALIFIED (decisive finding, below). The whole
gate-and-render-verify chain also works over wireless, so no USB cable is needed. Remaining native and
managed gates: Compose, React Native, NativeScript, Lynx, Qt; then the owner-appended set Dioxus,
SnapKit, UIKit, SwiftUI; then the six WKWebView frameworks, deferred to the very end per owner.

## Goal and hard constraints

Vet iOS UI/app-shell frameworks on the owner's real iPhone X to the depth of the Android series
(`docs/decisions/kotlin-android-kopia-pcloud-stack.md`): clone, source-audit, build, and run on the
device, not judged from metadata. Two apps define the requirements: the kopia-to-pCloud backup app
(in-app S3/HTTP server, streaming HTTPS to pCloud, background transfer, kopia as a linked static lib)
and `packages/desktop-app/music-player` (Rust + Slint, to port to iOS).

Owner-stated hard constraints (these decide outcomes):

- Accessibility (a11y) is mandatory. A framework whose a11y needs an iOS-17 API is out.
- The target is the iPhone X specifically: `iPhone10,3`, iOS 16.7.16, UDID
  `9057e2a8c2e70162e35b9ea8bf006f736670877b`. It is A11 silicon and never receives iOS 17, so anything
  that depends on an iOS-17 API cannot run here even if it builds.

## DONE

### Signing and device path

Full procedure: `docs/runbook/ios-iphone-x-codesign-setup.md`. Reusable: build over `ssh m1` with the
bundle id forced to `dev.monochromatic.iosvet.hellodevice`, `DEVELOPMENT_TEAM=HWLVAKDV4F
CODE_SIGN_STYLE=Automatic`, and the vet keychain; no `-allowProvisioningUpdates`. The exact pattern and
the signing details are in `docs/decisions/ios-iphone-x-vet-reports/device-gate-results.md`.

### Toolchains on the Mac

Installed: full Xcode 26.5; `ios-deploy`, `libimobiledevice` (idevicedebug, idevicescreenshot,
idevicecrashreport), `ideviceinstaller`, `xcodegen` (brew); CocoaPods 1.16.2; Flutter 3.44.2 plus its
iOS engine artifacts (`flutter precache --ios` done); Rust iOS targets (`aarch64-apple-ios`, `-sim`).
.NET fully ready (dotnet 10.0.300): the `ios` workload's runtime/AOT packs (the prior session had only
written the manifest; `dotnet workload restore` pulled the `osx-arm64.Cross.ios-arm64` AOT cross-compiler
and `Mono.ios-arm64` device runtime), the `maui-ios` workload, and the `Microsoft.iOS`, Avalonia, and Uno
project templates (`dotnet new install`). Still to install for remaining gates: JDK 17+/Kotlin/KMP
(Compose), React Native community CLI + Watchman/Metro, NativeScript CLI (`ns`) + Homebrew CMake +
xcodeproj gem, Lynx (rspeedy/pnpm), Qt 6.5 LTS for iOS (qt-unified) + CMake; for the appended set, the
`dx` (dioxus-cli) CLI (SnapKit/UIKit/SwiftUI need only the already-installed xcodegen + SPM).

### Source-audit fan-out

A Workflow fan-out (33 agents) source-audited all 16 frameworks against the three iOS walls plus the
functional requirements, adversarially cite-checked, and synthesized a gate plan. Output: 16
`docs/decisions/ios-iphone-x-vet-reports/vet-<fw>.md` (verbatim, not lint-conformed) and the synthesis
`docs/decisions/ios-iphone-x-music-player-kopia-stack.md`. Key synthesis results: 16 frameworks collapse
to 9 distinct gates (WKWebView substrate covers Capacitor/Cordova/Ionic/Framework7/Onsen/Quasar; the
.NET trio MAUI/Avalonia/Uno shares one workload); nothing is JIT-fatal on iOS (every in-app JS engine
runs jitless, the inverse of Android); about 52 deduplicated reports total; the shared Rust/Go core is
the reusable spine; the in-app HTTP/S3 server is the one genuinely uncertain capability (de-risk: embed
it inside the linked staticlib).

### Device gates (render-verified)

Gate criterion is RENDER, not launch. `ios-deploy ... run` prints `success` once the process is created
under lldb, before any UI draws, and `--justlaunch` then kills the app on detach. To verify a gate:
relaunch with `idevicedebug -d run dev.monochromatic.iosvet.hellodevice` (holds the app alive),
`idevicescreenshot` after about 15 s, and scan the app stdout plus `idevicecrashreport` for a dyld
`Symbol not found` or a Rust panic. Pull screenshots with `scp m1:/tmp/<f>.png /tmp/` and read them.
This step is what caught the false Slint pass; do not skip it for any remaining gate. When the device is
attached wirelessly (Xcode wireless debugging), add `-n`/`--network` to the libimobiledevice tools
(`idevicedebug -n run`, `idevicescreenshot -n`, `idevicecrashreport -n`); `ios-deploy` uses wifi by
default. The whole chain (build, install, run, screenshot, crash logs) is confirmed working over wifi.

- Capacitor (rank 2, covers the six WKWebView members): PASS, renders (`Capacitor vet / WKWebView OK`).
  Capacitor 7 uses Swift Package Manager, not CocoaPods. WebKit gives native a11y. App at
  `~/ios-vet/capgate`.
- Flutter (rank 4): PASS, renders the Dart-AOT Release counter UI. Native UIKit a11y. App at
  `~/ios-vet/flgate` (`flutter build ios --release --config-only` then xcodebuild on
  `ios/Runner.xcworkspace`). Note: a plugin-less Flutter app has no Podfile, so the CocoaPods path is
  still unproven (prove it via the React Native gate).
- Slint (rank 1): DISQUALIFIED. See next section.
- .NET trio (rank 3, MAUI/Avalonia/Uno): PASS, all four parts gated. The shared Microsoft.iOS/Mono
  substrate renders in both Release (full AOT) and Debug (`MtouchInterpreter=all`) and P/Invokes a linked
  Rust `.a` (a value computed in Rust, 6!=720 via a heap `Vec`, crosses `[DllImport("__Internal")]`), no
  JIT/`EXC_BAD_ACCESS`/execmem kill (`~/ios-vet/mauigate`, with a `rust/` staticlib). Then each framework
  rendered for real: MAUI (`~/ios-vet/mauiui`, native UIKit handlers), Avalonia (`~/ios-vet/avx`, its own
  SkiaSharp/Metal renderer), Uno (`~/ios-vet/unogate`, Uno 6 Skia renderer). The substrate gate alone
  would have falsely passed (it runs none of the frameworks' own UI/a11y code, exactly where Slint died),
  so each framework was rendered, not inferred. a11y posture (matters under a11y-must): MAUI strongest
  (native UIKit a11y); Avalonia and Uno-Skia self-draw via their own a11y bridges, fidelity is a stage-2
  check, with Uno's native-UIKit renderer as its a11y-safe fallback. Full evidence in
  `device-gate-results.md`.

## The Slint disqualification (decisive)

Slint builds and the process launches, but it crashes before rendering on iOS 16.7. Its iOS support is
iOS 17+ in two independent places, both verified on the device:

1.  a11y: `accesskit_ios` (latest 0.1.1) references four iOS-17 symbols unconditionally, no availability
    guard or weak link: `UIAccessibilityPriorityHigh`/`Low` and
    `UIAccessibilitySpeechAttributeAnnouncementPriority` (`accesskit_ios/src/event.rs`) and
    `UIAccessibilityTraitToggleButton` (`accesskit_ios/src/node.rs`). dyld `Symbol not found:
    _UIAccessibilityPriorityHigh`, SIGKILL before UI.
2.  Slint's own winit iOS backend reads dark/light via the iOS-17 `UITrait` API:
    `internal/backends/winit/ios/color_scheme.rs:37` calls `UITraitUserInterfaceStyle::class()` /
    `install_trait_change_observer`. Runtime panic: `class UITraitUserInterfaceStyle could not be found`.

A local accesskit fork patched past all four a11y symbols (on the Mac at `~/ios-vet/accesskit_ios-patched`,
wired via `[patch.crates-io]` in `~/ios-vet/slint-gate/Cargo.toml`) cleared the dyld wall; then wall 2
(Slint's own UITrait code) fired. So even forking accesskit is not enough; the second wall is in Slint.
Making Slint run needs a maintained downport fork of both accesskit and Slint's winit iOS backend, with
an iOS-16 a11y fidelity loss, re-verified every Slint bump; five distinct iOS-17 API uses surfaced, so
more may lurk. This is the iOS analog of Slint's Android disqualification. Every other candidate uses
native iOS a11y (UIKit/WebKit) and does not hit this wall. Full evidence in `device-gate-results.md`.

## Scope and the music-player decision

The owner confirmed (2026-06-12) that the Slint disqualification does NOT narrow the vet scope: it just
removes Slint from contention. Continue the full funnel with Slint marked out; do not settle on one
framework or skip gates. Two further owner directives the same day: (1) defer the six WKWebView
frameworks to the very end, after every native and managed framework; (2) append Dioxus, SnapKit, UIKit,
and SwiftUI to the queue, positioned just before that deferred web block. The current remaining order is
in "Remaining gates" below.

Separately, the music-player UI choice is an open owner decision informed by the gate results: maintain
a downported Slint fork (keep the UI, accept the fork burden), or rewrite the UI in a device-verified
native-a11y framework keeping the Rust audio core via FFI (symphonia/opus/cpal port unchanged; cpal has
an iOS CoreAudio backend). Device-verified native-a11y options now include both Flutter and MAUI (MAUI
keeps the Rust core via `[DllImport("__Internal")]`, proven above); the Dioxus result, once gated, would
add a Rust-native UI option. Not blocking; the funnel continues regardless.

## Remaining gates (synthesis order)

Each must be render-verified (not just launched), and each adds only its own SDK/CLI on the shared base
(Xcode + signing + `rustup target add aarch64-apple-ios`).

.NET trio (rank 3) is DONE (PASS, above). Remaining, in order:

- Compose Multiplatform (rank 5, expected-pass): Kotlin/Native AOT; cinterop a Rust `.a`; check
  `embeddedServer(CIO)` on iosArm64. NEXT in line.
- React Native (rank 6, expected-pass; also proves CocoaPods): Hermes `global.HermesInternal`; C++
  JSI/TurboModule linking a Rust staticlib.
- NativeScript (rank 7, needs-device): prove jitless V8 + libffi static trampolines return a Rust value
  with no AMFI/execmem kill (iOS inverse of its Android DENY_EXECMEM death).
- Lynx (rank 8, expected-pass): native UIKit (`LynxView : UIView`, no WKWebView); PrimJS jitless;
  `LynxModule` `.mm` linking a Rust staticlib.
- Qt (rank 9, needs-device): pin Qt 6.5 LTS (6.11 needs iOS 17, will not install on the iPhone X);
  QML V4 interpreter renders; linked Rust value prints.
- Owner-appended set (gate after the above, before the web block): Dioxus (Rust UI; on iOS renders via
  `wry`/WKWebView driven by AOT Rust, the substantive one, needs `dx` CLI), SnapKit (UIKit Auto Layout
  DSL via SPM, trivial), UIKit (pure native, trivial), SwiftUI (already render-proven by the HelloDevice
  canary; formal re-confirm).
- Deferred to the very end per owner: the six WKWebView frameworks (Cordova substrate plus the Ionic,
  Framework7, Onsen, Quasar UI-render notes on the already-proven Capacitor/WKWebView substrate).

After gates: stage 2 deep supporting-stack vets (the ~52-report roadmap, enumerated inside each
`vet-*.md`), then keep the synthesis doc current.

## Mac artifacts (not in the repo)

`~/ios-vet/`: `vet.keychain-db` (signing), `HelloDevice/` (canary), `capgate/` (Capacitor),
`flgate/` (Flutter), `slint-gate/` (Slint clone + the `[patch]`'d Cargo.toml), `accesskit_ios-patched/`
(the a11y fork), `mauigate/` (.NET/Microsoft.iOS substrate + the `rust/` FFI staticlib), `mauiui/`
(MAUI), `avx/` (Avalonia xplat, iOS head `avx.iOS`), `unogate/` (Uno), `renew.log`, the renewal
LaunchAgent. Screenshots and logs land in `/tmp` (ephemeral). The throwaway keychain password is only in
the repo `.env.local` as `XCODE_IDENTITY_SSH_USABLE`.

## Notes / gotchas

- The Mac login shell is zsh: it does not word-split unquoted variable expansions, so inline xcodebuild
  flags (do not build them in a `$WS` variable).
- `set -e` plus `ios-deploy ... | tail` or a non-zero ios-deploy exit can abort a script before the
  verification step; capture full logs and avoid `set -e` around the render check.
- ultracode is ON this session (Workflow orchestration used for the source-audit fan-out).
