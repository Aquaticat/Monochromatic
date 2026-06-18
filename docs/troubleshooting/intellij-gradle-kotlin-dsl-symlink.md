# IntelliJ IDEA 2026.2 EAP shows red Gradle Kotlin DSL imports when the repo is opened through a symlinked home path

IntelliJ IDEA 2026.2 EAP Build `IU-262.8117.19` can keep Gradle Kotlin DSL script
classpath state on a different filesystem spelling from the editor file when this repo is opened through
`/home/user/Monochromatic` while Gradle and VCS state canonicalize to
`/var/home/user/Monochromatic`.
In that split state, `packages/linter/kotlin/build.gradle.kts` can show red imports even though Gradle
CLI compilation succeeds.

## Symptom

The user-visible symptoms in this repo were:

- `packages/linter/kotlin/build.gradle.kts` showed
  `Unresolved reference 'CommandLineArgumentProvider'` for
  `org.gradle.process.CommandLineArgumentProvider`.
- After the Gradle API import recovered, the same file still showed red
  `org.jetbrains.kotlin` in `import org.jetbrains.kotlin.gradle.dsl.JvmTarget`.
- The Gradle tool window showed duplicate `kotlin-linter` entries during part of the recovery.
- Running `idea invalidateCaches --help` did not print help.
  It executed cache invalidation, and IDEA restored default configuration.
  The plugin install path then contained only part of the previous plugin set until restored from backup.

The command-line build was not broken.
This command passed before and after the IDE recovery:

```shell
# /var/home/user/Monochromatic
mise run //packages/linter/kotlin:lint
```

```text
BUILD SUCCESSFUL in 3s
4 actionable tasks: 4 up-to-date
```

## Root cause

This machine has `/home` as a symlink into `/var/home`:

```shell
readlink /home
```

```text
var/home
```

That means these path strings name the same files but are not the same string:

```text
/home/user/Monochromatic
/var/home/user/Monochromatic
```

IDEA exposed that split in its own log.
Before the final fix, the editor was opened on the symlink spelling while Gradle and VCS state used the
canonical spelling:

```text
InlinePromptListener is installed to editor=EditorImpl[
  file:///home/user/Monochromatic/packages/linter/kotlin/build.gradle.kts
]
Symlink mapping for VCS is used,
  original file: file:///home/user/Monochromatic/...
  canonical file: file:///var/home/user/Monochromatic/...
```

After reopening the root project with the canonical spelling, the editor and Gradle sync used the same path:

```text
Opening existing project with .idea at /var/home/user/Monochromatic
Gradle project sync
  phase = SCRIPT_MODEL_PHASE
  projectPath = /var/home/user/Monochromatic/packages/linter/kotlin
InlinePromptListener is installed to editor=EditorImpl[
  file:///var/home/user/Monochromatic/packages/linter/kotlin/build.gradle.kts
]
```

The IntelliJ VCS symlink resolver explicitly canonicalizes symlinked virtual files and logs when it does so.
In `JetBrains/intellij-community@8910eed9bf0b991c02c05d06f446ef9691e733d5`,
`platform/vcs-impl/src/com/intellij/vcs/DefaultVcsSymlinkResolver.java:41-45` returns a canonical file when
one exists:

```java
// platform/vcs-impl/src/com/intellij/vcs/DefaultVcsSymlinkResolver.java:41-45
public @Nullable VirtualFile resolveSymlink(@NotNull VirtualFile file) {
  VirtualFile canonicalFile = resolveFile(file);
  if (canonicalFile != null) {
    logSymlinkMappingWasUsed(file, canonicalFile);
  }
```

The same source file logs the exact message seen in the IDEA log:

```java
// platform/vcs-impl/src/com/intellij/vcs/DefaultVcsSymlinkResolver.java:75-78
private void logSymlinkMappingWasUsed(@NotNull VirtualFile file, @NotNull VirtualFile canonicalFile) {
  if (mySymlinkMappingWasUsed) return;
  mySymlinkMappingWasUsed = true;
  LOG.info("Symlink mapping for VCS is used, original file: " + file + ", canonical file: " + canonicalFile);
```

The project opener also logs and operates on the `Path` it was asked to open.
`platform/platform-impl/src/com/intellij/ide/impl/ProjectUtil.kt:187-190` reuses an already opened project for
that path when it finds one:

```kotlin
// platform/platform-impl/src/com/intellij/ide/impl/ProjectUtil.kt:187-190
suspend fun openOrImportAsync(file: Path, options: OpenProjectTask = OpenProjectTask()): Project? {
  if (!options.forceOpenInNewFrame) {
    findAndFocusExistingProjectForPath(file)?.let {
      LOG.info("Reusing already opened project $file")
```

When the path is a valid project directory, `ProjectUtil.kt:224-230` opens that path as an existing `.idea`
project:

```kotlin
// platform/platform-impl/src/com/intellij/ide/impl/ProjectUtil.kt:224,226-230
LOG.info("Opening existing project with .idea at $file")
val options = options.copy(
  runConfigurators = true,
  projectRootDir = descriptor.historicalProjectBasePath,
)
return (serviceAsync<ProjectManager>() as ProjectManagerEx).openProjectAsync(file, options)
```

The red imports were path-dependent IDE script-classpath symptoms.
The source path is:

```text
plugins/gradle/tooling-extension-impl/src/com/intellij/gradle/toolingExtension/impl/model/
buildScriptClasspathModel/GradleBuildScriptClasspathModelProvider.java:18-20
```

That source places build-script classpath collection in `SCRIPT_MODEL_PHASE`:

```java
// plugins/gradle/tooling-extension-impl/src/com/intellij/gradle/toolingExtension/impl/model/
// buildScriptClasspathModel/GradleBuildScriptClasspathModelProvider.java:18-20
@Override
public GradleModelFetchPhase getPhase() {
  return GradleModelFetchPhase.SCRIPT_MODEL_PHASE;
```

Kotlin script definitions then derive definition classes and classpaths from project state and module order
entries.
The source path is:

```text
plugins/kotlin/base/scripting/scripting.k2/src/org/jetbrains/kotlin/idea/core/script/k2/definitions/
DefinitionFromDependenciesProvider.kt:47-52
```

That source combines explicit, discovered, and guessed classpath values:

```kotlin
// plugins/kotlin/base/scripting/scripting.k2/src/org/jetbrains/kotlin/idea/core/script/k2/definitions/
// DefinitionFromDependenciesProvider.kt:47-52
override fun getDefinitionsClassPath(): Iterable<File> {
    val settings = ScriptDefinitionSettingsStateComponent.getInstance(project).state
    val explicitClasspath = settings.parsedClasspath
    val discoveredClasspath = ScriptTemplatesFromDependenciesCache.getOrDiscover(project).classpath
    val autoResolvedClasspath = tryToGuessClasspath(settings.parsedClassNames)
    return (explicitClasspath + discoveredClasspath + autoResolvedClasspath).distinct().map { File(it) }
```

The same file reads class roots from order entries at `DefinitionFromDependenciesProvider.kt:113-130`.
That matches the observed behavior: when the editor file and imported Gradle model used different path strings,
script classpath resolution could stay stale for the editor even while Gradle itself compiled the script.

## What fixed it

Use the canonical `/var/home/user/Monochromatic` spelling everywhere IDEA opens this repo.
The successful recovery sequence was:

```shell
# /var/home/user/Monochromatic
rm --recursive --force packages/linter/kotlin/.idea
idea /var/home/user/Monochromatic
```

Then reload the Gradle project from IDEA.
Let IDEA own the Gradle module metadata it writes under `.idea/`.
Do not hand-add duplicate module entries for `packages/linter/kotlin`.

The committed project metadata now keeps the nested Gradle build linked from the root project:

```xml
<!-- .idea/gradle.xml -->
<option name="externalProjectPath" value="$PROJECT_DIR$/packages/linter/kotlin" />
```

The final VCS mapping also records the canonical root, which is the path spelling IDEA used after recovery:

```xml
<!-- .idea/vcs.xml -->
<mapping directory="/var/home/user/Monochromatic" vcs="Git" />
```

The user confirmed the `org.jetbrains.kotlin` import was no longer red after the canonical reopen.

## What did not fix it

Do not replace source imports to work around this symptom before proving the IDE is healthy.
A temporary worktree tested source-side alternatives:

- Removing `JvmTarget` made Gradle report a Kotlin and Java JVM target mismatch.
- Adding `jvmToolchain(17)` failed on this machine because no JDK 17 installation was available.
- A reflection-based workaround compiled, but it only hid the IDE issue and made the build script worse.

Do not open the nested package as its own IDEA project while debugging this root project.
That created `packages/linter/kotlin/.idea` and duplicate Gradle entries.
Remove that nested `.idea` directory and link the package Gradle build from the root project instead.

Do not use `idea invalidateCaches --help` to inspect the command.
In this environment it executed cache invalidation rather than printing help, then IDEA restored default settings.
If that happens again, treat it as configuration recovery, not as a Kotlin or Gradle problem.

## Plugin recovery after accidental cache invalidation

The active plugin directory for this install was:

```text
/var/home/user/.local/share/JetBrains/IntelliJIdea2026.2
```

The configuration backup lived at:

```text
/var/home/user/.config/JetBrains/IntelliJIdea2026.2-backup/2026-06-18-14-44
```

Copying configuration files alone did not restore plugins, because IDEA loads plugins from the active plugin
path above.
The successful recovery copied plugin directories from the backup into the active plugin path while IDEA was
closed.
After recovery, this check found 56 plugin directories and confirmed the expected plugins existed:

```shell
# /var/home/user/Monochromatic
find /var/home/user/.local/share/JetBrains/IntelliJIdea2026.2 -mindepth 1 -maxdepth 1 -type d | wc --lines
find /var/home/user/.local/share/JetBrains/IntelliJIdea2026.2 -maxdepth 1 \
  \( -name intellij-rust -o -name pkl-intellij -o -name lsp4ij \) -print
```

Do not touch `/var/home/user/.config/JetBrains` or `/var/home/user/.cache/JetBrains` again without explicit
approval.
Snapshot first if recovery is approved.

## Verification checklist

After recovering IDEA, verify the repo and the nested Gradle build from the command line:

```shell
# /var/home/user/Monochromatic
xmllint --noout .idea/vcs.xml .idea/gradle.xml
mise run //packages/linter/kotlin:lint
git status --short --untracked-files=all
```

Expected results:

- `xmllint` exits successfully.
- Gradle reports `BUILD SUCCESSFUL`.
- `git status --short --untracked-files=all` is clean after committing the metadata and this document.

Also verify the user boundary in IDEA:

- Open `/var/home/user/Monochromatic`, not `/home/user/Monochromatic`.
- Open `packages/linter/kotlin/build.gradle.kts`.
- Confirm `org.gradle.process.CommandLineArgumentProvider` and
  `org.jetbrains.kotlin.gradle.dsl.JvmTarget` are not red.
- Confirm the Gradle tool window shows the linked package build once.

## Upstream filing decision

Do not file an upstream issue from this evidence as-is.
The root recovery was local path hygiene plus IDEA project metadata cleanup, and the remaining `invalidateCaches`
behavior came from invoking a command without documented CLI help semantics.

Duplicate searches against `JetBrains/intellij-community` on GitHub found no matching open or closed issues or
pull requests for these queries:

```shell
gh search issues 'symlink Gradle Kotlin DSL unresolved reference' --repo JetBrains/intellij-community --state open
gh search issues 'symlink Gradle Kotlin DSL unresolved reference' --repo JetBrains/intellij-community --state closed
gh search prs 'symlink Gradle Kotlin DSL unresolved reference' --repo JetBrains/intellij-community --state open
gh search prs 'symlink Gradle Kotlin DSL unresolved reference' --repo JetBrains/intellij-community --state closed
gh search issues '"Symlink mapping for VCS" Gradle' --repo JetBrains/intellij-community --state open
gh search issues '"Symlink mapping for VCS" Gradle' --repo JetBrains/intellij-community --state closed
gh search prs '"Symlink mapping for VCS" Gradle' --repo JetBrains/intellij-community --state open
gh search prs '"Symlink mapping for VCS" Gradle' --repo JetBrains/intellij-community --state closed
```

They returned empty arrays.
The local `.out-of-scope/` exemption directory also had no IntelliJ, JetBrains, Kotlin, or Gradle entry for this
case.

If this recurs after opening the project canonically and after deleting the nested `.idea`, collect a smaller
reproduction before filing upstream:

- exact IDEA build number;
- output of `readlink /home`;
- root path used to launch IDEA;
- `.idea/gradle.xml` and `.idea/vcs.xml`;
- IDEA log lines containing `Opening existing project with .idea`, `Symlink mapping for VCS is used`,
  `SCRIPT_MODEL_PHASE`, and the editor URI for `build.gradle.kts`;
- a Gradle CLI run showing whether the script compiles outside IDEA.
