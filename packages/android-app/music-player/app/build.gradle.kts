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
        // minSdk 36: this is a single-target app for the owner's Pixel 6 (Android 16 / API 36); there
        // is no need to support older releases, so modern platform APIs are used without compat guards.
        minSdk = 36
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
        // On-device instrumented tests (the offline true-peak decoder needs a real MediaCodec).
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    // One app, three interchangeable audio engines selected at build time. Each
    // flavor gets its own applicationId suffix so all three install side by side
    // on the device for the head-to-head measurement comparison.
    flavorDimensions += "engine"
    productFlavors {
        create("media3") {
            dimension = "engine"
            applicationIdSuffix = ".media3"
            versionNameSuffix = "-media3"
        }
        create("hybrid") {
            dimension = "engine"
            applicationIdSuffix = ".hybrid"
            versionNameSuffix = "-hybrid"
        }
        create("rust") {
            dimension = "engine"
            applicationIdSuffix = ".rust"
            versionNameSuffix = "-rust"
        }
    }

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
        // AGP 9 defaults buildConfig off; MainActivity reads BuildConfig.FLAVOR.
        buildConfig = true
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
    // desktop's `_tests.rs` vectors). These run via testMedia3DebugUnitTest with
    // no device.
    testImplementation("junit:junit:4.13.2")

    // On-device instrumented tests. The offline true-peak decoder drives a real
    // MediaExtractor + MediaCodec, which only exist on a device, so its correctness
    // is verified with connectedMedia3DebugAndroidTest, not the host JVM. runner is
    // pinned >= 1.7.0 because the older runner crashes on Android 15/16
    // (InputManager.getInstance removed); Espresso is deliberately NOT pulled in, so
    // the Compose BOM's transitive Espresso 3.5.0 cannot crash here.
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test:runner:1.7.0")

    // The session layer (MediaSessionService, MediaSession, MediaController) plus
    // media3-common (SimpleBasePlayer) is flavor-agnostic: it projects whichever
    // AudioEngine the flavor supplies to the system notification/lockscreen, so it
    // is on every flavor's classpath. media3-session api-depends on media3-common,
    // so SimpleBasePlayer comes along transitively.
    implementation("androidx.media3:media3-session:1.10.1")

    // Media3 flavor only: ExoPlayer with the platform MediaCodec decoders. No
    // media3-decoder-* extension is pulled in; the Pixel 6 decodes Opus and FLAC
    // natively, which this build is meant to prove. The hybrid flavor will add its
    // own ExoPlayer dependency when it lands; the full-Rust flavor never uses it.
    "media3Implementation"("androidx.media3:media3-exoplayer:1.10.1")
}
