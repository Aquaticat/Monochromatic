# Black-box E2E UI automation for native Jetpack Compose (Maestro vs Appium vs UiAutomator)

> Scratch-path note:
> `/tmp/agent` paths in this document are historical.
> Use `~/temp/agent` for current work.

Vet date:
 2026-06-07.
Scope:
 the external,
 out-of-process "Playwright for native Android" layer.
A driver that launches the installed app on a real device and drives it (taps,
 reads UI
state,
 asserts) from outside the app process.
In-process Compose testing (createAndroidComposeRule / Espresso) is a separate category,
discussed only where it changes the recommendation.

Device under test:
 Pixel 6 (oriole),
 GrapheneOS,
 Android 16 (API 36),
 arm64-v8a,
 over adb.
Shared device:
 every adb interaction was wrapped in `flock /tmp/agent/adb-phone.lock -c "..."`.
Host build env:
 isolated `ANDROID_HOME=/var/tmp/android-vet/sdk` (android-35,
 build-tools 35.0.0),
Temurin JDK 17 for Gradle,
 Temurin JDK 21 for Maestro,
 Node 26.3.0.

## Verdict up front

Both Maestro and Appium+uiautomator2 actually work,
 end-to-end,
 on this GrapheneOS device,
driving a real native Compose app to "Count:
 2".
For this repo (which uses Playwright for web),
 Maestro is the right Playwright peer for
native Jetpack Compose:
 declarative flows,
 one self-contained binary,
 zero device residue,
and it matched the Compose `testTag` by bare resource-id with no locator gymnastics.
Appium is the heavier,
 more programmable W3C/Selenium-family alternative and is the better
fit only when you need the WebDriver protocol,
 a non-JS client,
 or a shared web+mobile Selenium grid.
UiAutomator (androidx.
test.
uiautomator) is not a peer:
 it is the on-device primitive that both
Maestro and Appium are built on,
 and it runs in-process as an instrumentation test,
 not as an
external driver.

## 1. Ecosystem audit and versions

### How each tool drives Android (verified from source + run logs)

- UiAutomator (androidx.
  test.
  uiautomator),
   the primitive.
  AndroidX Test library,
   Apache-2.0.
   Current stable `2.3.0` (2.4.0 is still alpha/beta on
  Google Maven,
   verified via maven-metadata.
  xml).
   It exposes `UiDevice`/`UiObject2` driving the
  device through the accessibility service.
   It is itself run in-process as an instrumentation test
  (AndroidJUnitRunner) on the device.
   It is the engine,
   not an external orchestrator.

- Maestro (mobile-dev-inc/maestro),
   CLI `2.6.0` (2026-05-21),
   Apache-2.0,
   Kotlin.
  Host-side JVM CLI talks to the device over adb.
   Source:
   `maestro-client/.../drivers/AndroidDriver.kt`
  bundles two APKs as JVM resources (`/maestro-app.apk`,
   `/maestro-server.apk`),
   adb-installs them,
  and starts the on-device server with `am instrument -w ...` (AndroidDriver.
  kt:
  120).
  That server (`maestro-android/src/androidTest/.../dev/mobile/maestro/`) depends on
  `androidx.test.uiautomator:uiautomator:2.3.0` and espresso-core 3.6.1 (libs.
  versions.
  toml:
  13),
  so Maestro's "own driver" is a UiAutomator+Espresso instrumentation server it ships and controls.
  Element matching is host-side over the serialized hierarchy:
   `Filters.kt:101-109` matches the
  bare `resource-id` attribute (exact or regex),
   which is why `id: increment_button` matched the
  raw Compose testTag with no package prefix.
  Important:
   `open()`/`close()` call `uninstallMaestroDriverApp()`/`uninstallMaestroServerApp()`
  (AndroidDriver.
  kt:
  176,179,1124,1147),
   so Maestro removes its driver APKs when done.
  Confirmed empirically:
   after the run,
   `pm list packages -3` showed no `dev.mobile.maestro` residue.

- Appium (appium/appium) server `3.5.0` (2026-05-31) + appium-uiautomator2-driver `7.6.0`
  (2026-06-04),
   both Apache-2.0,
   TypeScript.
   The driver implements the W3C WebDriver protocol on the
  host and,
   at session creation,
   adb-installs three APKs and starts a UiAutomator2 instrumentation
  server on the device.
   Verified from the live server log:
  - installs `io.appium.settings`,
     `io.appium.uiautomator2.server`,
    `io.appium.uiautomator2.server.test`,
  - runs `adb shell am instrument -w -e disableAnalytics true
    io.appium.uiautomator2.server.test/androidx.test.runner.AndroidJUnitRunner`,
  - gets `{"message":"UiAutomator2 Server is ready to accept commands","ready":true}`,
  - forwards device port 6790 to host 8200;
     the W3C client talks HTTP to the host,
     which proxies to
    the on-device server over the adb port-forward.
     No INTERNET permission on the app is involved.
  Unlike Maestro,
     Appium leaves the three server APKs installed after the session (manual cleanup needed).

### Compose addressability (the crux for any black-box tool)

Compose has no Android `View` per widget,
 so black-box tools only see what Compose projects into the
accessibility tree.
 The counter app set `Modifier.semantics { testTagsAsResourceId = true }` at the
root plus per-node `Modifier.testTag(...)` and `contentDescription`.
 The Appium page-source dump
proved the projection:

```xml
<android.widget.TextView text="Count: 0" content-desc="counter value" resource-id="counter_text" .../>
<android.view.View resource-id="increment_button" clickable="true" ...>
  <android.view.View content-desc="increment" .../>
```

So `testTag` -> `resource-id` (raw string,
 NO `package:id/` prefix) and `contentDescription` ->
`content-desc`.
 Both are addressable.
 Without `testTagsAsResourceId` the testTag is invisible to
black-box tools;
 you would be left with on-screen text and contentDescription only.

Gotcha found and documented during verification:
 Appium's `using:"id"` strategy auto-qualifies a bare
id to `currentPackage:id/value`,
 so `id=counter_text` returned "no such element" against Compose's
unprefixed resource-id.
 The working Appium locators were `-android uiautomator`
`new UiSelector().resourceId("counter_text")` and `accessibility id` (contentDescription).
Maestro's `id:` matched the bare resource-id directly.
 Net:
 testTagsAsResourceId is necessary but
Appium needs the UiSelector/xpath/accessibility-id route,
 not the plain `id` locator.

### Licenses

- Maestro:
   Apache-2.0.
- Appium + appium-uiautomator2-driver:
   Apache-2.0.
- androidx.
  test.
  uiautomator:
   Apache-2.0.
All three are clean open-source;
   no open-source-default exception needed.

## 2. Maintenance signals (gh)

- Maestro (mobile-dev-inc/maestro):
   14,340 stars,
   Apache-2.0,
   pushed 2026-06-05.
  Issues 393 open / 1018 closed.
   Releases are frequent (CLI 2.6.0,
   2.5.1,
   2.5.0,
   2.4.0 across
  Apr-May 2026).
   Maintainers (proksh,
   Leland-Takamine,
   pedro18x) merge PRs within days;
   a Linear bot
  triages new issues and a contributor (Fishbowler) replies on most threads,
   sometimes tersely and
  with a stale-issue auto-closer.
   Backlog is large but actively worked.
   81 Kotlin test files plus
  a dedicated `maestro-android/src/androidTest` instrumentation suite;
   CI has test.
  yaml,
   test-e2e.
  yaml,
  check-drivers.
  yaml.
   No fuzzing or mutation testing.

- Appium (appium/appium):
   21,612 stars,
   Apache-2.0,
   pushed 2026-06-07.
   Mature (since 2013),
  monorepo with coordinated package releases (appium@3.5.0).
   Active.

- appium-uiautomator2-driver:
   846 stars,
   Apache-2.0,
   latest v7.6.0 (2026-06-04),
   with a steady
  release train (v7.2-v7.6 across May-Jun 2026).
   Issues 21 open / 94 closed.
   Maintainers
  mykola-mokhnach and KazuCocoa respond same-day (issue #1008 answered the day it was filed).
  Tests:
   7 unit specs + 25 functional/e2e mocha specs;
   CI unit-test.
  yml + functional-test.
  yml.
  No fuzzing or mutation testing.

Both ecosystems are healthy and responsive;
 neither is a maintenance risk.

## 3. Full verification (commands + output)

### 3.0 Build + install the native Compose counter app

Project at `/var/tmp/android-e2e-vet` (AGP 8.7.3,
 Kotlin 2.0.21,
 compose-bom 2024.12.01,
Gradle 8.11.1,
 compileSdk 35).
 applicationId `dev.monochromatic.androide2evet`.

```txt
$ gradle --no-daemon :app:assembleDebug
BUILD SUCCESSFUL in 1m 5s
$ aapt dump badging app-debug.apk | grep package
package: name='dev.monochromatic.androide2evet' versionCode='1' ... compileSdkVersion='35'
$ flock /tmp/agent/adb-phone.lock -c "adb install -r app-debug.apk"
Performing Streamed Install
Success
```

### 3.a Maestro (PASS)

Flow `/var/tmp/android-e2e-vet/counter.flow.yaml`:

```yaml
appId: dev.monochromatic.androide2evet
---
- launchApp:
    clearState: true
- assertVisible: "Count: 0"
- tapOn:
    id: "increment_button"
- assertVisible: "Count: 1"
- tapOn:
    id: "increment_button"
- assertVisible: "Count: 2"
```

Command + output:

```txt
$ flock /tmp/agent/adb-phone.lock -c "maestro test counter.flow.yaml"
Running on 1C171FDF600KWW
 > Flow counter.flow
Launch app "dev.monochromatic.androide2evet" with clear state... COMPLETED
Assert that "Count: 0" is visible... COMPLETED
Tap on id: increment_button... COMPLETED
Assert that "Count: 1" is visible... COMPLETED
Tap on id: increment_button... COMPLETED
Assert that "Count: 2" is visible... COMPLETED
### EXIT=0
```

Maestro installed its UiAutomator instrumentation server,
 drove the app,
 and uninstalled the server
afterward (no residue).
 It resolved the button by the Compose testTag (`id: increment_button`) directly.

### 3.b Appium + uiautomator2 (PASS)

Server:
 `appium server --port 4723 --log-timestamp` (loaded uiautomator2@7.6.0,
 /status ready).
Client `/var/tmp/appium-vet/drive-counter.mjs` (Node fetch,
 raw W3C protocol).

Command + output:

```txt
$ flock /tmp/agent/adb-phone.lock -c "node /var/tmp/appium-vet/drive-counter.mjs"
Appium /status ready: true
Created session: 2353c69b-... | deviceModel: Pixel 6
NOTE: bare using:"id" value:"counter_text" found element? false (expected false: uiautomator2 prepends package)
ASSERT initial: "Count: 0" expect 'Count: 0' -> PASS
ASSERT after tap#1 (button by resource-id): "Count: 1" expect 'Count: 1' -> PASS
ASSERT after tap#2 (button by accessibility-id): "Count: 2" expect 'Count: 2' -> PASS
RESULT: PASS — Appium/uiautomator2 drove the Compose counter to 'Count: 2' via resource-id and accessibility-id
session deleted
### EXIT=0
```

Found the button by `-android uiautomator` resourceId for tap #1 and by accessibility-id
(contentDescription) for tap #2;
 read the counter by resource-id and accessibility-id.

### GrapheneOS friction

None blocking.
 The two specific worries did not materialize:

- Dynamic code loading (DCL):
   GrapheneOS's "restrict dynamic code loading" hardening targets an app
  loading executable code from writable storage at runtime in its own process.
   It does NOT block the
  adb-driven install of a test/instrumentation APK or `am instrument`.
   Both Maestro's
  `maestro-server.apk` and Appium's `io.appium.uiautomator2.server.test` installed and ran via
  `am instrument` successfully (logs above).
- INTERNET permission (default-off on GrapheneOS):
   irrelevant here.
   Both tools talk to the device
  over the adb transport (USB/localhost port-forward),
   not over the network,
   and the app under test
  needs no INTERNET permission.
   Nothing had to be granted.

The only adb-side action either tool took beyond install was Appium adding its packages to the Doze
whitelist via `dumpsys deviceidle whitelist`,
 which succeeded and was reversed by uninstalling them.
If a project shipped a real app that itself needs network during the test,
 you would have to grant
that app INTERNET on GrapheneOS,
 but that is the app's permission,
 not the test driver's.

## 4. Comparison and when to prefer each

### Maestro vs Appium vs UiAutomator as the Playwright analog

- Ergonomics.
   Maestro:
   declarative YAML,
   one command,
   implicit waits,
   the closest feel to a
  high-level Playwright script;
   the counter flow is 9 lines.
   Appium:
   imperative W3C/WebDriver client
  in your language of choice (JS/Python/Java/etc.);
   more boilerplate (capabilities,
   session,
   explicit
  finds) but full programmatic control.
   UiAutomator:
   not an external driver;
   you write a JVM
  instrumentation test compiled into the app's test APK.
- Flakiness.
   Maestro builds in ret/wait semantics and hides the instrumentation lifecycle;
   fewer
  foot-guns for simple flows.
   Appium is robust but you own waits and the locator strategy (the bare
  `id` gotcha above is exactly the kind of sharp edge Maestro avoids).
- CI fit.
   Maestro:
   single binary,
   Maestro Cloud option,
   trivial to invoke;
   needs a JDK.
   Appium:
  needs a running server process plus a client;
   standard in existing Selenium/Appium grids and device
  clouds (BrowserStack,
   Sauce Labs,
   LambdaTest).
   If you already run a Selenium grid,
   Appium slots in.
- Compose-semantics handling.
   Both depend entirely on the accessibility tree;
   both need
  `testTagsAsResourceId` (or contentDescription) to see testTags.
   Maestro matches bare resource-id
  out of the box;
   Appium needs UiSelector/xpath/accessibility-id rather than the plain `id` strategy.
  Neither understands Compose semantics natively the way the in-process matcher does.

### Black-box vs in-process createAndroidComposeRule

Prefer in-process createAndroidComposeRule / Espresso (the separate category) when you want to assert
on Compose semantics directly (`onNodeWithTag`,
 merged semantics,
 state),
 get millisecond feedback,
control time/clock,
 and stay hermetic;
 it sees the real semantics tree,
 not a lossy accessibility
projection,
 and needs no `testTagsAsResourceId`.
 Prefer black-box (Maestro/Appium) for true E2E:
multi-app flows,
 permission dialogs,
 deep links,
 push,
 exercising the actually-installed release
artifact,
 cross-framework apps (Compose + Views + WebView),
 and device-cloud runs.
 They are
complementary layers,
 not competitors;
 createAndroidComposeRule is the unit/component layer,
 Maestro
or Appium is the system layer.

### Two alternatives rejected as the external Playwright peer, with reasons

- UiAutomator (androidx.
  test.
  uiautomator) standalone:
   rejected as the peer because it is in-process
  instrumentation,
   not an out-of-process driver;
   it is the engine Maestro and Appium already wrap.
  Using it directly means writing JVM tests bundled into a test APK,
   which is neither declarative nor
  external.
   Right tool for low-level cross-app system tests,
   wrong shape for "Playwright for Compose".
- Appium as the default:
   rejected as default (kept as the alternative) because it requires a running
  server plus a client and W3C boilerplate,
   leaves driver APKs on the device,
   and tripped on the bare
  Compose resource-id with its `id` strategy.
   It wins only when you need the WebDriver protocol,
   a
  non-JVM client,
   or an existing Selenium/Appium grid or device cloud.

## Cleanup performed

- Uninstalled `dev.monochromatic.androide2evet` (the counter app).
- Uninstalled the three Appium server packages
  (`io.appium.uiautomator2.server`,
   `io.appium.uiautomator2.server.test`,
   `io.appium.settings`);
  Maestro left nothing to remove.
   `pm list packages` confirmed a clean device.
- Stopped the Appium server process.
- No device permissions were granted,
   so none needed revoking (the app needs no permissions and both
  tools use adb transport,
   not INTERNET).
- Build artifacts and clones live under `/var/tmp/android-e2e-vet`,
   `/var/tmp/appium-vet`,
  `/var/tmp/maestro-dl`,
   `/tmp/agent/maestro-vet-20260607`,
   `/tmp/agent/uia2drv-vet-20260607`
  (no repo changes,
   no commits).
</content>
