import org.gradle.process.CommandLineArgumentProvider
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

// Standalone Kotlin/JVM build for the monorepo-wide detekt rule set. It compiles the
// custom rules into a plugin jar and runs the detekt CLI over an arbitrary source
// tree, the Kotlin parallel of package/linter/rust (a standalone linter invoked by
// the root `lint:detekt` task over package/). detekt and the CLI resolve from
// mavenCentral; nothing here ships in any application.
plugins {
    kotlin("jvm") version "2.4.0"
}

// detekt 2.0.x is the active upgrade target for the repo's custom Kotlin rule set.
val detektVersion = "2.0.0-alpha.5"

// Holds the detekt CLI and its dependencies, used as the classpath for the
// detektCheck runner. Kept separate from the compile classpath so the runner gets
// detekt-core (which detekt-api alone does not provide).
val detektCli: Configuration by configurations.creating

dependencies {
    // The rule compiles against detekt-api only; detekt-core provides it at analysis
    // time, so it must not be bundled into the plugin jar.
    compileOnly("dev.detekt:detekt-api:$detektVersion")
    detektCli("dev.detekt:detekt-cli:$detektVersion")
    testImplementation("dev.detekt:detekt-test:$detektVersion") {
        // detekt 2.0.0-alpha.5 metadata asks for detekt-api-test-fixtures at runtime,
        // but only the test-fixtures sources variant is published. The lint() helper
        // used here does not need those fixtures, so keep the normal API jar below.
        exclude(group = "dev.detekt", module = "detekt-api")
    }
    testImplementation("dev.detekt:detekt-api:$detektVersion")
    testImplementation("org.junit.jupiter:junit-jupiter:5.10.2")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

// JVM 17 keeps Java and Kotlin targets consistent without a toolchain (only JDK 21
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

// Run detekt with the custom require-kdoc rule set and detekt's default config
// over the tree named by the `detektInput` Gradle property (the root `lint:detekt`
// task passes the repo's package/ dir). Global --excludes drop build output,
// .gradle caches, build scripts (.kts), and test sources before parsing,
// mirroring how require-tsdoc skips .test.ts.
tasks.register<JavaExec>("detektCheck") {
    group = "verification"
    description = "Run detekt with the custom require-kdoc rule set over --input (detektInput property)."
    dependsOn(tasks.jar)
    classpath = detektCli
    mainClass.set("dev.detekt.cli.Main")

    val ruleJar = tasks.jar.flatMap { it.archiveFile }
    inputs.file(ruleJar)
    val inputPath = providers.gradleProperty("detektInput")
        .orElse(layout.projectDirectory.dir("src").asFile.absolutePath)
    val configFile = layout.projectDirectory.file("detekt.yml").asFile.absolutePath

    argumentProviders.add(
        CommandLineArgumentProvider {
            listOf(
                "--input", inputPath.get(),
                "--config", configFile,
                "--build-upon-default-config",
                "--plugins", ruleJar.get().asFile.absolutePath,
                "--excludes",
                "**/build/**,**/.gradle/**,**/node_modules/**,**/*.kts,**/src/test/**,**/src/androidTest/**",
            )
        },
    )
}
