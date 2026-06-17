// Root build file. The Android Gradle Plugin carries its own Kotlin (KGP 2.2.10)
// since AGP 9, so the standalone `org.jetbrains.kotlin.android` plugin is not
// applied here; only the Compose compiler plugin is layered on in :app.
plugins {
    id("com.android.application") version "9.2.1" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.2.10" apply false
    // Standalone kotlin-jvm for the pure-JVM :detekt-rules module (AGP carries its own
    // KGP for :app); detekt for running the custom require-kdoc rule set on :app.
    id("org.jetbrains.kotlin.jvm") version "2.2.10" apply false
    id("io.gitlab.arturbosch.detekt") version "1.23.8" apply false
}
