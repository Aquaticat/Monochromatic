import org.jetbrains.kotlin.gradle.dsl.JvmTarget

// Pure Kotlin/JVM module producing the custom detekt rule set consumed by :app via
// detektPlugins. Not an Android module: detekt rules run inside detekt's JVM at
// build time, never ship in the APK. Repositories are inherited from
// settings.gradle.kts (FAIL_ON_PROJECT_REPOS forbids declaring them here).
plugins {
    kotlin("jvm")
}

// detekt 1.23.8 is the current stable line (2.x is still alpha as of 2026-06). The
// rule compiles against detekt-api only (compileOnly): detekt-core supplies the API
// at analysis time, so it must not be bundled into the plugin jar.
dependencies {
    compileOnly("io.gitlab.arturbosch.detekt:detekt-api:1.23.8")
    testImplementation("io.gitlab.arturbosch.detekt:detekt-test:1.23.8")
    testImplementation("org.junit.jupiter:junit-jupiter:5.10.2")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

// JVM 17 matches the app's compileOptions; the rule jar loads fine on the
// mise-provisioned JDK 21 that runs detekt. Java target is pinned to 17 too so the
// Kotlin/Java JVM-target consistency check passes without a toolchain (only JDK 21
// is provisioned, so jvmToolchain(17) would force an unwanted JDK download).
java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

tasks.withType<Test>().configureEach {
    useJUnitPlatform()
}
