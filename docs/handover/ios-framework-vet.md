# iOS UI/app-shell framework vet for the iPhone X

Status: signing and on-device path DONE; the framework vet itself is not started. The owner asked to
run the vet after a context compaction. Date: 2026-06-12.

## Goal

Vet iOS UI/app-shell frameworks on the owner's real iPhone X, to at least the depth of the Android
series in `docs/decisions/kotlin-android-kopia-pcloud-stack.md` and its
`kotlin-android-kopia-pcloud-vet-reports/`. Each candidate is cloned, source-audited, built, and run on
the device, not judged from metadata (the `choosing-technology` skill standard).

Two apps define the functional requirements the vet must exercise:

- The kopia-to-pCloud backup app (same product as the Android vet): an in-app local HTTP server (S3
  endpoint kopia targets), a streaming HTTPS client to pCloud, background transfer, and kopia itself.
- `packages/desktop-app/music-player`: a Rust + Slint native player (symphonia + libopus decode,
  always-on true-peak normalization with an on-disk peak cache, ad-hoc folder-scanned queue with
  two-axis pagination, session persistence, cpal/CoreAudio output). To be ported to iOS. Prior art for
  the Android port: `docs/decisions/music-player-android-port.md`.

## The candidates (owner's list)

React Native, NativeScript, Flutter, Lynx, .NET MAUI, Avalonia, Uno Platform, Compose Multiplatform,
Qt, Capacitor, Apache Cordova, Ionic Framework, Framework7, Onsen UI, Quasar, Slint. The owner noted
the true number of per-technology vets is far more than 16: each surviving UI framework drags in a full
supporting stack (HTTP server, HTTP client, FFI, background, audio, plus QA tooling: in-process UI
test, black-box e2e, fuzz, mutation, property) across its language ecosystem, mirroring how the Android
effort was 16 vets for only ~4 UI stacks. Realistic deduplicated count: roughly 50 to 80 reports.

Grouping to avoid redundant work:

- WKWebView substrate: Capacitor and Apache Cordova are the two native shells; Ionic, Framework7, Onsen
  UI, and Quasar are UI layers that run inside them. ~2 substrate vets plus UI-layer notes, not 6.
- .NET trio: MAUI, Avalonia, Uno share the .NET-iOS workload and Mono/NativeAOT; vet the runtime once,
  differentiate at the UI layer.

## Three iOS platform walls (inherited by every candidate, reshape the criteria)

1.  No exec of bundled binaries. The Android design (ship kopia as `jniLibs`, exec from
    `nativeLibraryDir`) is illegal on iOS. kopia must be a linked static lib (gomobile c-archive
    `.xcframework`) called via FFI. The per-framework test is "can it link and call a Go/Rust static
    lib," not "can it exec a binary."
2.  No JIT / executable memory for app-process code (only the out-of-process WKWebView gets the JIT
    entitlement). The iOS twin of the GrapheneOS `DENY_EXECMEM` that killed NativeScript on the Pixel 6
    (see `kotlin-android-kopia-pcloud-vet-reports/vet-nativescript.md`). NativeScript's JSC runs
    interpreter-only on iOS (boots, slower); Flutter/.NET/Mono must AOT; Hermes is fine. Reshapes the
    perf story for every managed-runtime candidate.
3.  No long-running background. No foreground-service equivalent; only background `URLSession` and
    `BGProcessingTask` (minutes, idle/charging). A multi-hour kopia snapshot is not expressible the way
    it is on Android; the gateway/backup must be restructured around background `URLSession`.

## Approach (owner chose: funnel, gate then deepen)

1.  Stage 1, device gate: build a minimal app per UI framework (counter UI plus the smallest probe),
    run on the iPhone X, record launch/render/JIT-wall/link/deployment-floor outcome. Prune the dead
    ones with kernel/runtime evidence like the NativeScript report.
2.  Stage 2, deep supporting-stack vets for survivors only: in-app HTTP server, streaming HTTPS client,
    kopia-as-linked-lib FFI, background transfer, audio decode plus output (symphonia/cpal reuse vs
    AVAudioEngine), plus the QA toolchain, each clone plus source-audit plus on-device verification.
3.  Output: a synthesis decision doc at `docs/decisions/ios-iphone-x-music-player-kopia-stack.md`
    mirroring the Android stack doc (context, decisive on-device results, scorecard, ranking with flip
    conditions, cross-cutting iOS constraints), with raw per-tech reports under
    `docs/decisions/ios-iphone-x-vet-reports/`.

Reuse the bundle id `dev.monochromatic.iosvet.hellodevice` for gate apps so the existing profile and
identity sign with no new provisioning (new bundle ids or added entitlements need
`-allowProvisioningUpdates`, which needs the login keychain; avoid them in the gate).

## Signing and device path: DONE (do not redo)

Full procedure and the reusable build-and-run command: `docs/runbook/ios-iphone-x-codesign-setup.md`.
Summary of the working state:

- Device: iPhone X, `iPhone10,3`, iOS 16.7.16, build 20H392, UDID
  `9057e2a8c2e70162e35b9ea8bf006f736670877b`. Developer Mode on, Mac trusted, cert trusted.
- Mac: full Xcode 26.5; `ios-deploy`, `libimobiledevice`, `ideviceinstaller`, `xcodegen` installed;
  DeviceSupport `16.7* -> 16.4` symlink (DDI verified mounting); a dedicated `~/ios-vet/vet.keychain-db`
  holding the `Apple Development` identity (team `HWLVAKDV4F`, cert valid to 2027-06-12). No login
  password on disk; the keychain's throwaway unlock password is only in the repo `.env.local` as
  `XCODE_IDENTITY_SSH_USABLE`.
- Builds run over `ssh m1`; the build pattern unlocks the vet keychain, adds it to the search list for
  the build, signs with `OTHER_CODE_SIGN_FLAGS="--keychain ..."`, installs via `ios-deploy`, then
  restores a login-only search list.
- Auto-renew of the 7-day free-team profile: `~/Library/LaunchAgents/dev.monochromatic.iosvet.profilerenew.plist`
  runs `-allowProvisioningUpdates` daily in the GUI session (verified exit 0); force a renew with
  `ssh m1 'launchctl kickstart -k gui/$(id -u)/dev.monochromatic.iosvet.profilerenew'`. The only owner
  step ever needed again is a rare Apple ID re-auth in Xcode (free-account session expiry).

## Toolchain status (Mac)

- Done: Rust iOS targets (`aarch64-apple-ios`, `-sim`), CocoaPods (gem `--user-install`; confirm `pod`
  on PATH), dotnet 10.0.300 present (no workloads yet).
- To install for the gate: Flutter SDK; `.NET` `ios`/`maui` workloads (`dotnet workload install`); Qt
  for iOS (aqtinstall); React Native/Expo; NativeScript; Lynx; Capacitor/Cordova plus a CLI to scaffold
  Ionic/Framework7/Onsen/Quasar; Compose Multiplatform (Kotlin Native iOS). Track disk (about 80 GiB
  free at start).

## Task list and pointers

Tasks 3 to 6 in the session task list track this (toolchains, Stage 1 gate, Stage 2 deep vets,
synthesis doc). The Android series is being expanded concurrently (a `vet-nativescript.md` for Android
appeared mid-session, external work; do not touch it). Note `ultracode` is currently off, so a
Workflow-orchestrated fan-out for the ~50 to 80 reports would need explicit opt-in; otherwise drive the
funnel directly.
