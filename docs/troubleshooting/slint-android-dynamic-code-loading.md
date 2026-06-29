# Slint 1.16.1 Android crashes on GrapheneOS (`java.lang.SecurityException`) because its android-activity backend loads its Java helper via dynamic code loading

Slint's Android backend (`i-slint-backend-android-activity`) ships its `SlintAndroidJavaHelper`
as a build-time `classes.dex` embedded in the Rust binary and loads it at runtime exclusively
through a dynamic class loader.
 On Android variants that block dynamic code loading (DCL) by
default,
 the load throws `java.lang.SecurityException`,
 the Rust window adapter panics,
 and the
process is killed before any UI is drawn.
 This was found while vetting Slint + Rust for an
Android-only app;
 the build succeeds,
 the run does not.

## Symptom

A Slint app built the standard way (`cargo apk build`,
 NativeActivity,
 `android:hasCode=false`)
installs and the native library loads,
 but the activity never becomes visible.
 On launch the
system posts a notification:

```text
Slint Counter Vet tried to perform DCL via memory
Tap to open settings   More info   Don't show again
```

and the app process dies.
 `logcat` shows,
 in order:

```text
DynCodeLoading: AppBindFlags: RESTRICT_MEMORY_DCL, RESTRICT_STORAGE_DCL, RESTRICT_WEBVIEW_DCL,
nativeloader: Load .../libslintcounter.so ... : ok
DynCodeLoadingUtils: handleAppReportedDcl, denialType: InMemoryDexFile, pkg: dev.vet.slintcounter, path: null
RustStdoutStderr: thread '<unnamed>' panicked at
  i-slint-backend-android-activity-1.16.1/androidwindowadapter.rs:186:68:
RustStdoutStderr: JNI error: CaughtJavaException { exception: ... name: "java.lang.SecurityException" }
Zygote  : Process <pid> exited due to signal 9 (Killed)
```

`dumpsys activity activities` reports the launcher as `topResumedActivity`,
 never the Slint
activity.
 The failure is deterministic:
 it happens on every launch,
 cold or warm.

Trigger surface:
 any Slint Android app on a device whose policy sets `RESTRICT_MEMORY_DCL`
(API >= 26 path) or `RESTRICT_STORAGE_DCL` (API < 26 fallback path).
 GrapheneOS enables both by
default ("Exploit protection" hardening).
 Stock Android and most OEM ROMs allow DCL,
 so the same
APK starts there (see "Verification" for the limit of what was actually run).

## Root cause

The backend never resolves its helper class from the application's own class path.
 It always
constructs a dynamic class loader from an embedded dex blob.

The dex blob is compiled by the crate's `build.rs` and embedded:

```rust
// i-slint-backend-android-activity-1.16.1/javahelper.rs:18
const DEX_DATA: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/classes.dex"));
```

At runtime,
 `get_helper_class_loader` builds either an `InMemoryDexClassLoader` (API >= 26) or a
file-backed `DexClassLoader` (older),
 with the app context class loader used only as the parent,
never queried for the class directly:

```rust
// i-slint-backend-android-activity-1.16.1/javahelper.rs:246-292 (abridged)
fn get_helper_class_loader(env, native_activity) -> Result<&'static JClassLoader<'static>, ...> {
    fn build_dex_class_loader(env, native_activity) -> Result<JClassLoader, ...> {
        let context_class_loader = app_context.get_class_loader(env)?;
        if AndroidBuildVersion::SDK_INT(env)? >= 26 {
            let dex_buffer = unsafe {
                env.new_direct_byte_buffer(DEX_DATA.as_ptr() as *mut _, DEX_DATA.len())
            }?;
            // RESTRICT_MEMORY_DCL is enforced at this call:
            let dex_loader =
                InMemoryDexClassLoader::new(env, &dex_buffer, &context_class_loader)?;
            JClassLoader::cast_local(env, dex_loader)
        } else {
            std::fs::write(&dex_file_path, DEX_DATA).unwrap();
            // RESTRICT_STORAGE_DCL is enforced at this call:
            let dex_loader = DexFileClassLoader::new(
                env, &dex_file_path, &oats_dir_path, JString::null(), &context_class_loader,
            )?;
            JClassLoader::cast_local(env, dex_loader)
        }
    }
    ...
}
```

Both branches are dynamic code loading.
 There is no `context_class_loader.loadClass("...")`
attempt that would succeed if the helper were a normal compiled class inside the APK's
`classes.dex`.
 So a hardened ROM has no DCL-free path to offer.

The thrown `SecurityException` is fatal because the window adapter calls the helper constructor
during window creation and only prints the error before continuing into code that needs it:

```rust
// i-slint-backend-android-activity-1.16.1/androidwindowadapter.rs:186
let java_helper = JavaHelper::new(&app).unwrap_or_else(|e| print_jni_error(&app, e));
```

`print_jni_error` does not return a usable helper;
 the panic at `:186:68` in the captured trace
is the JNI exception propagating out of `JavaHelper::new`.
 The process is then SIGKILLed.

This is upstream behavior,
 not GrapheneOS misbehaving:
 GrapheneOS is applying documented
hardening,
 and the Slint design assumes DCL is always permitted.

### What this is not

- Not the Android 16 "16 KB page size" warning.
   That is a separate,
   earlier finding from the
  same vet (`libslintcounter.so : LOAD segment not aligned`),
   fixed independently with
  `RUSTFLAGS=-Clink-arg=-Wl,-z,max-page-size=16384`.
   It is a dev-only warning and does not kill
  the process;
   the DCL `SecurityException` does.
- Not a missing `INTERNET`/permission,
   not a renderer/GL failure:
   the `.so` loads and the crash
  is solely at the dex class-loader step,
   before Skia surface setup.

## Verification

Versions under test (from the app `Cargo.lock`):

- `slint` 1.16.1,
   crates.
  io checksum `d46bc502cc6b113bfd1a7e9a0876532a9454ff4ee905afe09784eaa2ec3f3f33`.
- `i-slint-backend-android-activity` 1.16.1,
   checksum
  `a318b5aebc2ad8e6fdbac8588984d9ea2e99a210449954717073d8a246e12fe7`.
- `cargo-apk` 0.10.0 (crates.
  io,
   the only published release,
   2023-11-30).
- Android NDK r26.3.11579264,
   build-tools 33.0.2,
   target `aarch64-linux-android`.
- Device:
   Pixel 6 (oriole),
   Android 16 / API 36,
   fingerprint
  `google/oriole/oriole:16/BP4A.251205.006/2026060101`,
   running a GrapheneOS-style hardened ROM
  (Vanadium,
   microdroid;
   `AppBindFlags: RESTRICT_MEMORY_DCL, RESTRICT_STORAGE_DCL,
  RESTRICT_WEBVIEW_DCL`).

Minimal harness (a counter app:
 a window,
 a `Count: N` label,
 an Increment button bound to a Rust
callback).
 `src/lib.rs`:

```rust
#![cfg(target_os = "android")]
slint::include_modules!();

#[unsafe(no_mangle)]
fn android_main(app: slint::android::AndroidApp) {
    slint::android::init(app).unwrap();
    let main_window = MainWindow::new().unwrap();
    let weak = main_window.as_weak();
    main_window.on_increment(move || {
        let w = weak.unwrap();
        w.set_counter(w.get_counter() + 1);
    });
    main_window.run().unwrap();
}
```

`Cargo.toml` key lines (note:
 `default-features = false` must NOT be used;
 see "What does not
work"):

```toml
[lib]
crate-type = ["cdylib"]

[dependencies]
slint = { version = "1.16", features = ["backend-android-activity-06"] }

[build-dependencies]
slint-build = "1.16"

[package.metadata.android]
package = "dev.vet.slintcounter"
build_targets = ["aarch64-linux-android"]
```

Build (bounded podman container with JDK 17,
 clang,
 SDK/NDK,
 cargo-apk):

```sh
podman run --rm --memory=8g --cpus=4 \
  -e RUSTFLAGS="-Clink-arg=-Wl,-z,max-page-size=16384" \
  -v "$PWD/counter-app:/work:Z" \
  -v "$PWD/cargo-registry:/usr/local/cargo/registry:Z" \
  -w /work localhost/slint-android-builder \
  cargo apk build --target aarch64-linux-android --lib
# => target/debug/apk/slintcounter.apk  (signed, zipaligned; lib/arm64-v8a/libslintcounter.so)
```

Run on device (all adb under a shared lock):

```sh
adb install -r target/debug/apk/slintcounter.apk        # => Success
adb shell am start -W -n dev.vet.slintcounter/android.app.NativeActivity
# => Status: ok ; but topResumedActivity stays the launcher, process SIGKILLed
adb logcat -d | grep -iE 'DCL|SecurityException|RustStdoutStderr|signal 9'
# => the trace quoted in "Symptom"
```

Catalog,
 works cleanly:

- `cargo apk build` for `aarch64-linux-android` and `x86_64-linux-android` (both produced signed
  APKs).
- `adb install` succeeds;
   `nativeloader` loads `libslintcounter.so` ("ok").

Catalog,
 fails:

- Launch on the hardened Pixel 6:
   `java.lang.SecurityException` at `androidwindowadapter.rs:186`,
  process killed,
   no UI.
   Reproduced on every launch.

Not verified this session (stated as inference,
 not fact):
 that the identical APK renders on
stock Android / an AOSP emulator where DCL is allowed.
 The crash is solely at the DCL gate (the
`.so` loaded and the next step is the dex loader),
 and Slint's CI compiles these crates,
 so a
stock run very probably succeeds,
 but the emulator run was explicitly out of scope for this
session and was not performed.
 The x86_64 APK was built but not booted.

## Verified workarounds

Neither workaround was executed on this app this session (device security settings were left
untouched and the emulator was out of scope),
 so each is "candidate,
 with tradeoffs stated",
corroborated by external evidence rather than self-run.
 Marked accordingly.

- Per-app GrapheneOS toggle:
   Settings -> Apps -> <app> -> "Exploit protection" -> turn off
  "Restrict dynamic code loading" (memory).
   The launch notification's "Tap to open settings"
  links here.
   Tradeoff:
   re-enables in-memory dynamic code loading for that app (a real attack
  surface the hardening exists to remove),
   is manual and per-device/per-install,
   and cannot be
  set by the developer for end users.
   Corroboration:
   GrapheneOS documents this toggle and other
  affected apps (for example Ente,
   Celestia) are fixed by disabling it;
   not run against this app
  here.

- Consumer-side:
   ship the app as an own-classpath app and avoid the backend entirely for the UI
  thread is not possible without an upstream change (the backend always uses DCL).
   The only true
  fix is upstream (see "Upstream filing artifact").
   Until then,
   on hardened ROMs the practical
  option is the per-app toggle,
   or choosing a UI stack that does not dynamically load code
  (native Kotlin/Compose,
   or a Tauri app whose Kotlin glue ships in `classes.dex`).

## What does not work

- Switching from cargo-apk to a Gradle + cargo-ndk build and shipping `SlintAndroidJavaHelper`
  inside the app's `classes.dex`:
   does not help on its own.
   `get_helper_class_loader`
  (`javahelper.rs:246`) unconditionally builds a DCL loader from the embedded `DEX_DATA` and
  never calls `loadClass` on the app context class loader,
   so a normally-packaged helper class is
  never consulted.
   (Concluded from source;
   not separately runtime-tested,
   since it cannot work by
  construction.
  )
- The 16 KB ELF alignment flag (`-Wl,-z,max-page-size=16384`):
   fixes the unrelated Android 16
  page-size warning,
   has no effect on the DCL crash.
- Toggling backend variants (`backend-android-activity-05` vs `-06`,
   `native-activity` vs
  `game-activity`):
   all route through the same `javahelper.rs` loader,
   so none avoids DCL.
- `default-features = false` with `["compat-1-2", "backend-android-activity-06"]`:
   a different,
  earlier failure (won't even compile:
   `slint-1.16.1/android.rs:157: cannot find type 'Box'`,
  E0433,
   a no_std import omission fixed on master).
   Enabling `std` (default features) is required
  before you can reach the DCL crash at all.

## Upstream filing artifact

### Out-of-scope check

Checked `.out-of-scope/`.
 The only match for "slint" is `.out-of-scope/cargo-workspace.md:18`,
which lists Slint among native libraries not to install on the host;
 it is unrelated to this bug
and is not an exemption.
 No exemption covers the Slint Android DCL behavior,
 so upstream tracking
is in scope.

### Duplicate search

`gh search issues --repo slint-ui/slint --state all` for "dynamic code loading",
 "GrapheneOS",
"SecurityException dex",
 "InMemoryDexClassLoader",
 and `gh search prs` for "dex":
 no matching
issue or PR (one retry hit gh search rate-limiting;
 the successful runs returned zero rows).
 No
duplicate to comment on;
 a new issue would be the first report.

### Upstream filing decision (6-constraint check)

1.  Really upstream's fault?
     Yes.
     Slint chooses to load its helper only via DCL with no
    app-classpath fallback (`javahelper.rs:246-292`).
     Behavior,
     not wording,
     and fixable.
2.  Can upstream fix it?
     Yes.
     Add a `context_class_loader.loadClass("SlintAndroidJavaHelper")`
    fast path,
     falling back to the current DCL loader only when the class is absent,
     plus a
    documented Gradle packaging of the helper class for hardened ROMs.
     Possibly spans the backend
    plus build docs;
     not architecturally blocked.
3.  Supporting this use case?
     Yes.
     Android is a first-class target (docs,
     examples,
     CI,
     bug
    template lists Android).
     GrapheneOS is a mainstream Android variant.
4.  Would the repo welcome it?
     Yes.
     `CONTRIBUTING.md:4-6` "warmly welcome ... open GitHub issues
    or pull requests";
     bug-report issue template exists;
     no AI ban found.
     Code PRs require the
    MIT-0 CLA (`CONTRIBUTING.md:21-27`);
     an issue does not.
5.  Will they likely fix it?
     No negative signal.
     No existing issue,
     no documented won't-fix.
    Absence of signal,
     so this constraint holds as a soft yes.
6.  Prototyped a minimal fix?
     No. Prototyping an upstream Slint source fix was out of scope of the
    vetting task (a vet-only brief,
     no changes to third-party tools).
     Constraints 1-5 hold or
    sorta-hold,
     which would normally trigger the auto-prototype step;
     it is skipped here and
    recorded so a future session can complete it (add the `loadClass` fast path in `javahelper.rs`
    and verify on a DCL-restricted target).

Because constraint 6 is unmet,
 the draft below is kept as an auditable record and is marked
**do not file as-is**.
 File only after the minimal fix is prototyped and its result recorded.

### Draft issue (do not file as-is: fix prototype deferred)

~~~md
Title: Android app crashes with SecurityException on GrapheneOS / hardened Android because the
helper is loaded via dynamic code loading

Labels: a:android, bug

Slint Android apps crash on startup on Android variants that restrict dynamic code loading (DCL),
for example GrapheneOS with its default "Restrict dynamic code loading" exploit protection.

Environment:
- slint 1.16.1, i-slint-backend-android-activity 1.16.1, cargo-apk 0.10.0, NDK r26.
- Pixel 6, Android 16 / API 36, GrapheneOS (AppBindFlags: RESTRICT_MEMORY_DCL,
  RESTRICT_STORAGE_DCL, RESTRICT_WEBVIEW_DCL).

Symptom (logcat):
```
DynCodeLoadingUtils: handleAppReportedDcl, denialType: InMemoryDexFile, pkg: <app>
RustStdoutStderr: panicked at i-slint-backend-android-activity-1.16.1/androidwindowadapter.rs:186:68:
JNI error: CaughtJavaException { ... name: "java.lang.SecurityException" }
Zygote: Process <pid> exited due to signal 9 (Killed)
```
The native library loads fine; the activity never becomes visible.

Root cause: `javahelper.rs` (1.16.1) embeds the helper as `classes.dex` (`DEX_DATA`, line 18) and
`get_helper_class_loader` (line 246) always builds an `InMemoryDexClassLoader` (API >= 26, line
264) or file `DexClassLoader` (older, line 285). The app context class loader is used only as the
parent and is never queried with `loadClass`, so there is no DCL-free path. The window adapter
fails at `androidwindowadapter.rs:186` (`JavaHelper::new(...)`).

Reproduction: a minimal `cargo apk` NativeActivity app (`slint = { version = "1.16", features =
["backend-android-activity-06"] }`) installed on a GrapheneOS device; launch and observe the
SecurityException.

Suggested fix: in `get_helper_class_loader`, first try
`context_class_loader.loadClass("SlintAndroidJavaHelper")` and use it when present; fall back to
the existing in-memory/file dex loader only when the class is not on the app class path. Document
shipping `SlintAndroidJavaHelper` in the app `classes.dex` via a Gradle build so hardened ROMs
have a DCL-free path. (Filer to attach a prototyped diff before filing.)
~~~
