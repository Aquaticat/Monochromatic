import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "dev.monochromatic.musicplayer"
    // compileSdk 37: the current androidx (core-ktx 1.19.1, Compose 1.12.1 from the BOM, Material3 1.5.0-beta01)
    // is compiled against API 37 and AGP rejects compiling against anything lower (checkDebugAarMetadata
    // reports 15 dependencies needing 37 when this is 36). 37.0 is the newest stable platform installed.
    // targetSdk stays 36 (the owner's Pixel 6 API level, the behavior the app opts into): API 37 adds
    // background audio hardening that a music player must be checked against on a device first.
    compileSdk = 37

    defaultConfig {
        applicationId = "dev.monochromatic.musicplayer"
        // minSdk 26: the true floor (#9). The native AAudio output backend is a hard API-26 minimum
        // (the ndk crate's `audio` feature requires API 26, and the engine uses only base AAudio
        // builder/stream functions, all introduced at 26). Lint's NewApi confirms nothing in the
        // Kotlin/manifest surface gates the app higher: the MediaStore VOLUME_EXTERNAL/RELATIVE_PATH
        // (API 29) and READ_MEDIA_AUDIO (API 33) call sites are SDK_INT-guarded, and the becoming-noisy
        // receiver's RECEIVER_NOT_EXPORTED flag goes through ContextCompat (which carries the constant
        // at all levels), so 26 holds. The native .so is built at --platform 26 to match (see mise
        // build:native), so the artifact itself loads on the floor.
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
        // On-device instrumented tests (the offline true-peak decoder needs a real MediaCodec).
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    // One engine, the full-Rust AudioEngine. The media3 and hybrid build flavors
    // existed only to install all three engines side by side for the head-to-head
    // measurement comparison; that comparison is decided (the full-Rust variant
    // won decisively), so the flavor dimension is gone and this is a single app.
    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
            // Sign the release build with the debug key so it installs on the owner's device without a
            // separate keystore. release is not debuggable, so ART optimizes the numeric DSP loops it
            // runs (the true-peak scan), which a debuggable build does not; this is the build the
            // owner actually runs.
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    buildFeatures {
        compose = true
    }

    // Robolectric needs the merged manifest and resources on the unit-test classpath, and ui-test-manifest (below)
    // adds the empty ComponentActivity that createComposeRule launches; without this the rule finds no activity.
    testOptions {
        unitTests {
            isIncludeAndroidResources = true
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlin {
        compilerOptions {
            jvmTarget.set(JvmTarget.JVM_17)
        }
    }
}

// The 1,000,000-track Search and scale tests (D112) hold a whole synthetic library, its index and the old matcher's
// oracle copy in one JVM, which does not fit Gradle's default 512 MiB test heap.
// The serial collector is also chosen on purpose: with the default G1 collector, HotSpot's loop strip mining made every
// short counted loop (a 24-character name scan) cost about 240 ns instead of 12 ns on the development host, which made
// the timings of the index tests measure the collector, not the index.
tasks.withType<Test>().configureEach {
    maxHeapSize = "3g"
    jvmArgs("-XX:+UseSerialGC")
}

// Robolectric runs each wiring test on a real Android framework jar for API 36. By default it downloads that jar
// itself at test time, outside Gradle, into ~/.m2, which needs the network on every fresh home and bypasses Gradle's
// dependency cache. This configuration lets Gradle resolve the jar like any other dependency (so an offline run works
// from a warm Gradle cache), a Sync task copies it under its Maven file name, and the tests read it from there
// through `robolectric.dependency.dir` (see `LegacyDependencyResolver` at tag robolectric-4.17).
val robolectricRuntime: Configuration by configurations.creating {
    isCanBeConsumed = false
    isCanBeResolved = true
}

/** Directory holding the Robolectric framework jar under the file name Robolectric looks for. */
val robolectricRuntimeDir: Provider<Directory> = layout.buildDirectory.dir("robolectric-runtime")

/** Copies the resolved Robolectric framework jar into [robolectricRuntimeDir]. */
val syncRobolectricRuntime by tasks.registering(Sync::class) {
    from(robolectricRuntime)
    into(robolectricRuntimeDir)
}

tasks.withType<Test>().configureEach {
    dependsOn(syncRobolectricRuntime)
    systemProperty("robolectric.dependency.dir", robolectricRuntimeDir.get().asFile.absolutePath)
    // Robolectric reaches internal OpenJDK classes (for example jdk.internal.access.SharedSecrets, which the first
    // run failed on) and the JVM refuses that on Java 17 and later without these flags; the list is the one under
    // "Running with Java 17 and higher" on robolectric.org/getting-started.
    jvmArgs(
        "--add-opens=java.base/java.lang=ALL-UNNAMED",
        "--add-opens=java.base/java.util=ALL-UNNAMED",
        "--add-opens=java.base/java.io=ALL-UNNAMED",
        "--add-opens=java.base/java.net=ALL-UNNAMED",
        "--add-opens=java.base/java.security=ALL-UNNAMED",
        "--add-opens=java.base/java.text=ALL-UNNAMED",
        "--add-opens=java.base/jdk.internal.access=ALL-UNNAMED",
        "--add-opens=java.desktop/java.awt.font=ALL-UNNAMED",
        "--add-opens=jdk.compiler/com.sun.tools.javac.api=ALL-UNNAMED",
    )
}

dependencies {

    val composeBom = platform("androidx.compose:compose-bom:2026.09.00")
    implementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    // Explicit pre-release is required because the Material standard ButtonGroup API first
    // appears in the 1.5.0 line (absent from 1.4.0); the 2026.09.00 stable BOM still resolves
    // Material3 1.4.0. Keep the rest of Compose on the BOM while this one component has no
    // stable release.
    implementation("androidx.compose.material3:material3:1.5.0-beta01")
    implementation("androidx.activity:activity-compose:1.13.0")
    implementation("androidx.core:core-ktx:1.19.1")
    // Jetpack WindowManager reports the window's FoldingFeature (a vertical fold or hinge, its bounds and occlusion),
    // which D110 names as the crease source. The Compose BOM does not manage it. 1.5.0 is the version Compose UI
    // already resolves transitively (see `:app:dependencies --configuration debugRuntimeClasspath`), so this
    // declaration adds no new artifact, and it lets the app call the API without relying on the transitive edge.
    implementation("androidx.window:window:1.5.0")
    debugImplementation("androidx.compose.ui:ui-tooling")

    // Host JVM unit tests for the pure-logic `core` package (ported from the
    // desktop's `_tests.rs` vectors). These run via testDebugUnitTest with no device.
    testImplementation("junit:junit:4.13.2")

    // Host JVM Compose wiring tests (src/test/.../wiring): the real track list pane and player host rendered
    // under Robolectric with the Compose test rule, so the Compose-boundary wiring that no pure function can
    // reach is tested without an emulator. Robolectric is pinned to 4.17, the newest release, because its
    // `DefaultSdkProvider.java` (tag robolectric-4.17) maps API 36, the app's targetSdk, to the runtime jar
    // android-all-instrumented 16-robolectric-13921718-i7 (JDK 21 or newer) and API 37, the compileSdk, to its sibling.
    // The Compose test artifacts take their version from the BOM above; ui-test-manifest is debug-only because it
    // adds a test activity to the manifest that the release APK must not carry.
    testImplementation("org.robolectric:robolectric:4.17")
    // The API 36 framework jar of that release, with the exact version string it derives (Android version,
    // Robolectric build, preinstrumented version 7); resolved through Gradle for the offline-capable run above.
    "robolectricRuntime"("org.robolectric:android-all-instrumented:16-robolectric-13921718-i7")
    testImplementation("androidx.compose.ui:ui-test-junit4")
    debugImplementation("androidx.compose.ui:ui-test-manifest")

    // On-device instrumented tests (the RustEngine and the native decode/true-peak
    // bridge drive real MediaStore content and the native .so, which only exist on a
    // device, so they run with connectedDebugAndroidTest, not the host JVM). runner is
    // pinned >= 1.7.0 because the older runner crashes on Android 15/16
    // (InputManager.getInstance removed); Espresso is deliberately NOT pulled in, so
    // the Compose BOM's transitive Espresso 3.5.0 cannot crash here.
    androidTestImplementation("androidx.test.ext:junit:1.3.0")
    androidTestImplementation("androidx.test:runner:1.7.0")

    // The session layer (MediaSessionService, MediaSession, MediaController) plus
    // media3-common (SimpleBasePlayer): it projects the AudioEngine to the system
    // notification/lockscreen. media3-session api-depends on media3-common, so
    // SimpleBasePlayer comes along transitively. This is the only media3 artifact the
    // app uses; the full-Rust engine never touches ExoPlayer.
    implementation("androidx.media3:media3-session:1.11.1")

    // WorkManager backs the charging+idle background peak sweep (PeakSweepWorker): it
    // pre-measures the library's true peaks so playback rarely hits an uncached track.
    // CoroutineWorker lives in work-runtime; the -ktx artifact has been empty since 2.7.
    implementation("androidx.work:work-runtime:2.12.0")

    // On-device WorkManager test harness: TestListenableWorkerBuilder runs the sweep
    // worker's real doWork against the installed library and cache file (see
    // PeakSweepWorkerTest), the same way the engine is verified on a device.
    androidTestImplementation("androidx.work:work-testing:2.12.0")
}
