# Android runtime vetting: Retrofit, WorkManager + Foreground Service, Compose instrumented test

> Scratch-path note:
> `/tmp/agent` paths in this document are historical.
> Use `~/temp/agent` for current work.

Scope:
 vet three runtime constituents for a Kotlin/Jetpack-Compose Android app that runs
kopia and backs up to pCloud.
 FULL-VERIFICATION standard (choosing-technology skill):
 every
finalist built,
 run on a real device,
 and exercised at the integration boundary.

Date:
 2026-06-07.
 Verification device:
 Pixel 6 (oriole),
 GrapheneOS,
 Android 16 (API 36),
security patch 2026-06-01,
 connected via adb (shared,
 every interaction flock-guarded on
`/tmp/agent/adb-phone.lock`).

## Toolchain (isolated, off tmpfs)

- ANDROID_HOME:
   `/var/tmp/android-vet/sdk` (cmdline-tools 11076708,
   platform-tools 37,
   Android
  platform 35,
   build-tools 35.0.0).
- JDK:
   Temurin 21.0.11 via mise.
- Gradle 8.11.1 (standalone),
   GRADLE_USER_HOME `/var/tmp/android-vet/gradle-home`.
- Build matrix:
   AGP 8.7.3,
   Kotlin 2.1.0,
   compileSdk/targetSdk 35,
   minSdk 26,
   unique
  applicationId `dev.vet.androidruntime.probe0607`.
- Why compileSdk 35 not 36:
   AGP 8.7.3 rejects dependencies compiled against a higher SDK than
  the app,
   so the build pins SDK-35-era androidx.
   targetSdk 35 is the exact threshold that
  activates the Android 15 dataSync foreground-service time cap,
   so the cap demonstration is
  valid.
   Latest versions are reported below for the recommendation;
   the build pins are noted
  where they differ.

## Version audit (latest stable, June 2026)

- Retrofit:
   3.0.0 (Maven Central,
   published 2025-05-15).
   2.12.0 published same day for the
  legacy 2.
  x line.
   Built and verified with 3.0.0.
- OkHttp (Retrofit's HTTP engine):
   Retrofit 3.0.0 resolves OkHttp 4.12.0 (stable) transitively,
  plus Okio 3.6.0.
   OkHttp 5.
  x is still alpha (5.0.0-alpha.
  16),
   so Retrofit 3 correctly defaults
  to the 4.12.0 stable line.
- converter-kotlinx-serialization:
   3.0.0 (tracks Retrofit).
   kotlinx-serialization-json resolves
  to 1.8.1.
- androidx WorkManager:
   latest stable 2.11.2 (2.11.0/2.11.1/2.11.2 plus a dense 2.10.0..2.10.5
  patch line).
   Built and verified with work-runtime-ktx 2.10.0 (SDK-35-compatible under AGP
  8.7.3).
   FGS behavior is identical across 2.9..2.11;
   `Service.onTimeout` is a platform API,
   not
  a WorkManager feature,
   so the version pin does not affect the cap.
- Compose:
   built with compose-bom 2024.12.01 (Compose 1.7.6) under Kotlin 2.1.0.
   Latest BOM is
  2026.05.01.
- androidx.
  test for instrumented tests:
   espresso-core 3.7.0,
   runner 1.7.0,
   core 1.7.0,
   monitor
  1.8.0,
   ext:
  junit 1.2.1 (see 3c for why the bump is mandatory on API 35+).

## Android 15+ dataSync foreground-service time cap (critical for long backups)

Source:
 developer.
android.
com foreground-service timeouts and Android 15 behavior changes.

- Apps targeting Android 15 (API 35) or higher:
   `dataSync` and `mediaProcessing` foreground
  services are allowed a total of 6 hours of runtime in a 24-hour period.
- The 6-hour budget is tracked per type and shared across all instances of that type in the app.
  Example from the docs:
   a dataSync service that ran 1 hour leaves 5 hours for dataSync,
   but a
  full 6 hours remain for mediaProcessing.
- At the limit the system calls `Service.onTimeout(int, int)` (added in Android 15).
   The service
  is no longer a foreground service at that point and has a few seconds to call
  `Service.stopSelf()`.
- If it does not stop:
   `android.app.RemoteServiceException` ("A foreground service of type
  [type] did not stop within its timeout").
   Starting a new one after the budget is exhausted
  throws `ForegroundServiceStartNotAllowedException` ("Time limit already exhausted for
  foreground service type dataSync").
- Reset:
   bringing the app to the foreground resets the timer to a full 6 hours.
- Google's recommended alternatives for data transfer:
   WorkManager,
   and specifically
  user-initiated data transfer (UIDT) jobs for long transfers.

Implication for kopia -> pCloud:
 a single dataSync FGS cannot back up more than 6 hours of
work per 24h while the app stays backgrounded.
 Large first-time snapshots will exceed that.
Design consequences:
 (a) make backups chunked and resumable so any 6h window makes forward
progress and `onTimeout` can checkpoint then stop cleanly;
 (b) prefer a user-initiated data
transfer job for the bulk upload path (the Android-15-sanctioned long-transfer API);
 (c) the
foreground-reset escape hatch (user opens the app) is a UX crutch,
 not a backup strategy.

## Maintenance signals (gh)

Retrofit (square/retrofit):
- 43,892 stars,
   Apache-2.0,
   not archived.
   Repo last pushed 2026-06-01 (active).
- Releases:
   3.0.0 and 2.12.0 on 2025-05-15;
   prior 2.11.0 (2024-03-28) and 2.10.0 (2024-03-18).
  Cadence is a few releases per year,
   typical of a mature,
   low-churn HTTP library.
- Recent commits (May 2026) are mostly Renovate dependency bumps plus maintainer upkeep,
   and the
  project itself tracks the bleeding edge (it builds on Gradle 9.4 / AGP 9.1).
   Open issues+PRs
  ~170;
   issues are triaged on GitHub.
   Maintained by Square/Block (JakeWharton,
   swankjesse).
- State:
   active releases,
   mature surface,
   slow-but-steady.
   No abandonment signal.

WorkManager (androidx,
 work-runtime):
- Part of the androidx/androidx AOSP monorepo (Apache-2.0,
   not archived,
   pushed 2026-06-06).
- work/ commit cadence is high:
   commits on 2026-06-01,
   05-29,
   05-28,
   05-14,
   05-01,
   04-29,
  including real behavior fixes ("Do not cancel work that has been rescheduled",
   "Add experimental
  method to disable greedy scheduler",
   WorkMetricsInfo APIs).
- Releases:
   dense 2.10.
  x patch stream (2.10.0..2.10.5) plus the 2.11.
  x line to 2.11.2.
- Bug tracking is on issuetracker.
  google.
  com (Google IssueTracker),
   not GitHub;
   GitHub changes
  land via Gerrit.
   Maintained by the Google Android team.
- State:
   actively maintained first-party library,
   fast patch cadence.

## FULL VERIFICATION on the Pixel 6 (commands + output)

Build:
 `gradle :app:assembleDebug` -> BUILD SUCCESSFUL,
 `app-debug.apk` 10,743,688 bytes.

### 3a. Retrofit typed API against a live endpoint

Typed interface `JsonPlaceholderApi.todo(@Path id): Todo` (kotlinx.
serialization data class),
baseUrl `https://jsonplaceholder.typicode.com/`.
 INTERNET granted (GrapheneOS per-app),
 launched
the retrofit action,
 read logcat,
 revoked INTERNET.

Commands:
```text
adb shell pm grant dev.vet.androidruntime.probe0607 android.permission.INTERNET
adb shell am start -n dev.vet.androidruntime.probe0607/dev.vet.androidruntime.probe.MainActivity --es action retrofit
adb logcat -d -s RuntimeVet:* | grep RETROFIT_
adb shell pm revoke dev.vet.androidruntime.probe0607 android.permission.INTERNET
```

Output (parsed response asserted,
 id == 1):
```text
RETROFIT_OK id=1 userId=1 completed=false title=delectus aut autem
```
INTERNET state after revoke:
 `granted=false`.

Result:
 PASS.
 Retrofit 3.0.0 + OkHttp 4.12.0 + kotlinx.
serialization converter performed a real
HTTPS GET on the device and deserialized JSON into the typed model.

### 3b. WorkManager Worker -> dataSync Foreground Service, persists in background

Button/intent enqueues a `OneTimeWorkRequest<BackupWorker>`;
 the Worker calls
`startForegroundService(BackupForegroundService)`;
 the service calls
`ServiceCompat.startForeground(..., FOREGROUND_SERVICE_TYPE_DATA_SYNC)` with an ongoing
notification and writes progress for ~30s,
 then self-stops.
 App was sent to background with HOME
after the FGS started.

Commands:
```text
adb shell am start -n .../MainActivity --es action startBackup
adb shell dumpsys activity services <pkg>        # foreground
adb shell input keyevent KEYCODE_HOME            # background
adb shell dumpsys activity services <pkg>        # still running
adb logcat -d -s RuntimeVet:* | grep -E 'WORKER_|FGS_'
```

dumpsys while app was in the FOREGROUND:
```text
* ServiceRecord{... dev.vet.androidruntime.probe.BackupForegroundService ...}
  isForeground=true foregroundId=42 types=0x00000001 foregroundNoti=Notification(channel=backup_channel ...)
  createTime=-3s611ms
```
After `KEYCODE_HOME` (focus moved to `app.lawnchair.../LawnchairLauncher`),
 dumpsys while
BACKGROUNDED showed the SAME record still `isForeground=true types=0x00000001`
(0x1 = FOREGROUND_SERVICE_TYPE_DATA_SYNC),
 notification flags now `ONGOING_EVENT|NO_CLEAR`.

Ordered lifecycle log (progress steps 5..30 ran after the app was backgrounded):
```text
WORKER_ENQUEUED id=0b6d0639-...
WORKER_RUN starting dataSync foreground service
WORKER_DONE foreground service start requested
FGS_STARTED type=dataSync startId=1
FGS_PROGRESS step=1/30 ... FGS_PROGRESS step=30/30
FGS_COMPLETE wrote /data/user/0/dev.vet.androidruntime.probe0607/files/backup_progress.txt
FGS_DESTROYED
```
Service record after completion:
 `(nothing)`.
 Progress file content:
 `progress=30/30`.

Result:
 PASS.
 WorkManager started a dataSync FGS that kept running and making progress for ~25s
while the app was in the background,
 then cleanly self-stopped.
 The service also overrides
`onTimeout(startId, fgsType)` to stopSelf,
 the correct handling for the 6h cap.

### 3c. Compose instrumented UI test on device (connectedDebugAndroidTest)

`createAndroidComposeRule<MainActivity>()`;
 clicks the Increment button via
`onNodeWithText("Increment").performClick()` and asserts the counter via
`onNodeWithText("Count: 1").assertIsDisplayed()` (and Count:
 2).

First run FAILED with a real environment incompatibility:
```text
java.lang.NoSuchMethodException: android.hardware.input.InputManager.getInstance []
  at androidx.test.espresso.Espresso.onIdle
```
Root cause:
 compose-bom 2024.12.01 drags in espresso-core 3.5.0,
 which reflectively calls
`InputManager.getInstance()`,
 a method removed in Android 15/16.
 Fix (not a Robolectric
fallback):
 force the androidx.
test stack to espresso-core 3.7.0 / runner 1.7.0 / core 1.7.0
(monitor 1.8.0).
 Re-run:
```text
> Task :app:connectedDebugAndroidTest
Starting 1 tests on Pixel 6 - 16
Finished 1 tests on Pixel 6 - 16
BUILD SUCCESSFUL in 17s
```
JUnit XML:
```text
<testsuite name="dev.vet.androidruntime.probe.CounterUiTest" tests="1" failures="0" errors="0" skipped="0" time="1.825">
  <testcase name="clickingIncrementBumpsCounter" classname="..." time="0.881" />
```

Result:
 PASS on the real device.
 Note the on-device caveat:
 the androidx.
test stack must be
pinned to >= 3.7.0 / 1.7.0 on Android 15/16,
 otherwise the older Espresso transitively pulled by
the Compose BOM crashes during input/idle sync.

Cleanup:
 connectedDebugAndroidTest auto-uninstalls the app and test APKs;
 final
`pm list packages` shows no residual `dev.vet.androidruntime` records,
 no leftover service,
INTERNET left revoked.

## Alternatives and rejection reasons

Retrofit vs raw OkHttp vs Ktor client:
- Raw OkHttp:
   it is the layer Retrofit already sits on (verified:
   Retrofit 3.0.0 pulls OkHttp
  4.12.0).
   Using it directly means hand-writing URL building,
   request/response mapping,
   and
  serialization wiring for every kopia/pCloud endpoint.
   Rejected:
   Retrofit adds typed interfaces
  and a converter pipeline over the same engine for near-zero cost;
   dropping to raw OkHttp
  re-implements that boilerplate.
- Ktor client:
   capable and multiplatform,
   but it brings its own engine and coroutine/serialization
  stack with no benefit for a single-platform Android app,
   and it is a second networking
  framework next to OkHttp (which WorkManager and the wider Android ecosystem already assume).
  Rejected:
   redundant surface and larger unfamiliar dependency for an Android-only target.
- Chosen:
   Retrofit 3.0.0 over OkHttp 4.12.0 with the kotlinx.
  serialization converter.

WorkManager vs AlarmManager vs JobScheduler:
- AlarmManager:
   only schedules wakeups;
   it does not run,
   constrain,
   retry,
   or survive process
  death for actual work,
   and exact alarms are restricted on modern Android.
   Rejected:
   wrong
  abstraction for a constrained,
   retryable backup job.
- JobScheduler:
   the right primitive,
   but it is the low-level platform API that WorkManager wraps;
  using it directly means hand-managing constraints,
   backoff,
   persistence across reboot,
   and the
  foreground/expedited and Android-15 transfer-job nuances.
   Rejected:
   WorkManager is the
  Google-recommended layer over exactly this,
   and it is the documented alternative to a raw
  dataSync FGS for the time-cap problem.
- Chosen:
   WorkManager 2.11.2 (built/verified 2.10.0) coordinating a dataSync FGS,
   with UIDT jobs
  to be evaluated for the bulk-transfer path.

Instrumented (androidx Compose) test vs Espresso vs Robolectric:
- Espresso (View-based):
   targets the legacy View hierarchy,
   not Compose semantics;
   it cannot
  address composables by `onNodeWithText`.
   It survives here only as Compose's transitive input
  engine,
   and that engine is what forced the 3.7.0 bump.
   Rejected as the test API for a Compose UI.
- Robolectric (host JVM):
   fast and useful as a fallback,
   but it simulates the framework on the
  JVM and does not exercise the real device,
   real input dispatch,
   or GrapheneOS/Android-16
  behavior.
   The whole point of this vet was on-device truth.
   Rejected as the primary path;
  retained as the documented fallback (not needed,
   since the device run passed).
- Chosen:
   androidx Compose instrumented test via `createAndroidComposeRule`,
   run with
  `connectedDebugAndroidTest`,
   androidx.
  test pinned to >= 3.7.0 / 1.7.0.

## Verdicts

- Retrofit 3.0.0 over OkHttp 4.12.0:
   ADOPT.
   Verified on-device,
   actively maintained,
   mature.
- WorkManager + dataSync Foreground Service:
   ADOPT,
   with the explicit design constraint that the
  dataSync 6h/24h cap forces chunked/resumable backups and `onTimeout` checkpointing,
   and that
  the bulk upload should use a user-initiated data transfer job.
   Verified on-device.
- androidx Compose instrumented test:
   ADOPT,
   with the mandatory environment note that the
  androidx.
  test stack must be pinned to espresso-core 3.7.0 / runner 1.7.0 / core 1.7.0 on
  Android 15/16.
   Verified passing on-device.
