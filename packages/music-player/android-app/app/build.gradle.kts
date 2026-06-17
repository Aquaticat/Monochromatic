import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose") version "2.2.10"
}

android {
    namespace = "dev.monochromatic.musicplayer"
    // compileSdk 37: the current androidx (core-ktx 1.19.0, the Compose BOM) is
    // compiled against API 37 and AGP 9 rejects compiling against anything lower.
    // targetSdk stays 36 (the device's API level, the behavior the app opts into).
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

dependencies {

    val composeBom = platform("androidx.compose:compose-bom:2026.05.01")
    implementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.activity:activity-compose:1.13.0")
    implementation("androidx.core:core-ktx:1.19.0")
    debugImplementation("androidx.compose.ui:ui-tooling")

    // Host JVM unit tests for the pure-logic `core` package (ported from the
    // desktop's `_tests.rs` vectors). These run via testDebugUnitTest with no device.
    testImplementation("junit:junit:4.13.2")

    // On-device instrumented tests (the RustEngine and the native decode/true-peak
    // bridge drive real MediaStore content and the native .so, which only exist on a
    // device, so they run with connectedDebugAndroidTest, not the host JVM). runner is
    // pinned >= 1.7.0 because the older runner crashes on Android 15/16
    // (InputManager.getInstance removed); Espresso is deliberately NOT pulled in, so
    // the Compose BOM's transitive Espresso 3.5.0 cannot crash here.
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test:runner:1.7.0")

    // The session layer (MediaSessionService, MediaSession, MediaController) plus
    // media3-common (SimpleBasePlayer): it projects the AudioEngine to the system
    // notification/lockscreen. media3-session api-depends on media3-common, so
    // SimpleBasePlayer comes along transitively. This is the only media3 artifact the
    // app uses; the full-Rust engine never touches ExoPlayer.
    implementation("androidx.media3:media3-session:1.10.1")

    // WorkManager backs the charging+idle background peak sweep (PeakSweepWorker): it
    // pre-measures the library's true peaks so playback rarely hits an uncached track.
    // CoroutineWorker lives in work-runtime; the -ktx artifact has been empty since 2.7.
    implementation("androidx.work:work-runtime:2.11.2")

    // On-device WorkManager test harness: TestListenableWorkerBuilder runs the sweep
    // worker's real doWork against the installed library and cache file (see
    // PeakSweepWorkerTest), the same way the engine is verified on a device.
    androidTestImplementation("androidx.work:work-testing:2.11.2")
}
