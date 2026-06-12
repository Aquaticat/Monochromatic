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
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
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

    // Media3 flavor only: ExoPlayer with the platform MediaCodec decoders. No
    // media3-decoder-* extension is pulled in; the Pixel 6 decodes Opus and FLAC
    // natively, which this build is meant to prove. media3-session lands the
    // MediaSessionService later.
    "media3Implementation"("androidx.media3:media3-exoplayer:1.10.1")
    "media3Implementation"("androidx.media3:media3-session:1.10.1")
}
