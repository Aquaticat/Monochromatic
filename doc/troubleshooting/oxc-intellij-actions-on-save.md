# Oxc IntelliJ Plugin 0.0.35 cannot uncheck "Run Oxlint 'Fix All' on Save" in IntelliJ IDEA 2026.2 EAP

> Scratch-path note:
> `/tmp/agent` paths in this document are historical.
> Use `~/temp/agent` for current work.

## Symptom

In IntelliJ IDEA 2026.2 EAP with Oxc IntelliJ Plugin 0.0.35,
Settings > Tools > Actions on Save shows `Run Oxlint 'Fix All' on Save`
as checked,
but clicking the checkbox does not leave it unchecked.
The attempted click logs an IntelliJ platform error instead of changing the
project setting.

The same project setting is stored in `.idea/OxcSettings.xml`:

```xml
<!-- .idea/OxcSettings.xml before local workaround -->
<option
  name='fixAllOnSave'
  value='true'
/>
```

Changing that XML value to `false` while IDEA is closed,
then restarting IDEA,
turns the action off.
That local check proves the persisted setting is valid and narrows the bug to
the Actions on Save UI path.

## Root cause

The Oxc plugin registers the Oxlint settings page under the short configurable
ID `OxlintConfigurable`.
In `oxc-project/oxc-intellij-plugin@a0b6e5cd9854b3350c7066a8d06fc18c26b1b11b`
(tag `v0.0.35`),
`plugin.xml` says:

```xml
<!-- src/main/resources/META-INF/plugin.xml:23-30 -->
<projectConfigurable
        parentId="tools"
        instance="com.github.oxc.project.oxcintellijplugin.oxlint.settings.OxlintConfigurable"
        id="OxlintConfigurable"
        nonDefaultProject="false"
        bundle="messages.OxlintBundle"
        key="oxlint.name"
/>
```

The Oxlint Actions on Save bridge does not pass that registered ID.
It passes `OxlintConfigurable.CONFIGURABLE_ID` into JetBrains'
`ActionOnSaveBackedByOwnConfigurable`:

```kotlin
// src/main/kotlin/com/github/oxc/project/oxcintellijplugin/oxlint/settings/OxlintOnSaveFixAllActionInfo.kt:9-12
class OxlintOnSaveFixAllActionInfo(actionOnSaveContext: ActionOnSaveContext) :
    ActionOnSaveBackedByOwnConfigurable<OxlintConfigurable>(actionOnSaveContext,
        OxlintConfigurable.CONFIGURABLE_ID,
        OxlintConfigurable::class.java) {
```

That constant has a different value:

```kotlin
// src/main/kotlin/com/github/oxc/project/oxcintellijplugin/oxlint/settings/OxlintConfigurable.kt:292-296
companion object {
    const val CONFIGURABLE_ID = "com.github.oxc.project.oxcintellijplugin.settings.OxcSettingsConfigurable"
}
```

The working Oxfmt path shows the intended shape:
its constant and `plugin.xml` ID both use `OxfmtConfigurable`.

```kotlin
// src/main/kotlin/com/github/oxc/project/oxcintellijplugin/oxfmt/settings/OxfmtConfigurable.kt:184-187
companion object {
    const val CONFIGURABLE_ID = "OxfmtConfigurable"
}
```

The JetBrains platform class uses the supplied configurable ID to initialize
the underlying settings page before changing the mirrored checkbox:

```java
// platform/platform-impl/src/com/intellij/ide/actionsOnSave/ActionOnSaveBackedByOwnConfigurable.java:139-145
protected final void updateUiOnOwnPage(@NotNull Consumer<? super Conf> uiUpdater) {
  ensureUiComponentsOnOwnPageInitialized();

  if (myConfigurableWithInitializedUiComponent != null) {
    uiUpdater.accept(myConfigurableWithInitializedUiComponent);
    getSettings().checkModified(myConfigurableId);
  }
```

```java
// platform/platform-impl/src/com/intellij/ide/actionsOnSave/ActionOnSaveBackedByOwnConfigurable.java:149-158
private void ensureUiComponentsOnOwnPageInitialized() {
  if (myConfigurableWithInitializedUiComponent != null) return;

  UnnamedConfigurable configurable = getSettings().getConfigurableWithInitializedUiComponent(myConfigurableId, true);
  if (configurable instanceof ConfigurableWrapper) {
    configurable = ((ConfigurableWrapper)configurable).getRawConfigurable();
  }

  if (configurable == null) {
    LOG.error("Failed to initialize configurable with id=" + myConfigurableId);
```

Since `myConfigurableId` is the unregistered long string,
IntelliJ cannot initialize the Oxlint configurable,
so Actions on Save has no settings component to update.
The local IDEA log confirms that exact failure on checkbox click:

```text
# ~/.cache/JetBrains/IntelliJIdea2026.2/log/idea.log:26710-26718
2026-06-29 13:54:13,666 [  54300] SEVERE - #c.i.i.a.ActionOnSaveBackedByOwnConfigurable - Failed to initialize configurable with id=com.github.oxc.project.oxcintellijplugin.settings.OxcSettingsConfigurable
java.lang.Throwable: Failed to initialize configurable with id=com.github.oxc.project.oxcintellijplugin.settings.OxcSettingsConfigurable
	at com.intellij.openapi.diagnostic.Logger.error(Logger.java:378)
	at com.intellij.ide.actionsOnSave.ActionOnSaveBackedByOwnConfigurable.ensureUiComponentsOnOwnPageInitialized(ActionOnSaveBackedByOwnConfigurable.java:157)
	at com.intellij.ide.actionsOnSave.ActionOnSaveBackedByOwnConfigurable.updateUiOnOwnPage(ActionOnSaveBackedByOwnConfigurable.java:140)
	at com.intellij.ide.actionsOnSave.ActionOnSaveBackedByOwnConfigurable.setActionOnSaveEnabled(ActionOnSaveBackedByOwnConfigurable.java:236)
	at com.intellij.ide.actionsOnSave.ActionOnSaveColumnInfo.lambda$createActionNamePanel$0(ActionOnSaveColumnInfo.java:94)
```

The setting itself is otherwise ordinary persistent state.
The plugin stores it in `OxcSettings.xml`:

```kotlin
// src/main/kotlin/com/github/oxc/project/oxcintellijplugin/oxlint/settings/OxlintSettings.kt:18-21
@State(name = "OxcSettings", storages = [Storage("OxcSettings.xml")],
    category = SettingsCategory.TOOLS)
class OxlintSettings(private val project: Project) :
    SimplePersistentStateComponent<OxlintSettingsState>(OxlintSettingsState()) {
```

```kotlin
// src/main/kotlin/com/github/oxc/project/oxcintellijplugin/oxlint/settings/OxlintSettingsState.kt:27-28
@get:Attribute("fixAllOnSave")
var fixAllOnSave by property(false)
```

The getter reads that persisted boolean when Oxlint is enabled:

```kotlin
// src/main/kotlin/com/github/oxc/project/oxcintellijplugin/oxlint/settings/OxlintSettings.kt:73-76
var fixAllOnSave: Boolean
    get() = isEnabled() && state.fixAllOnSave
    set(value) {
        state.fixAllOnSave = value
```

That is why editing `.idea/OxcSettings.xml` directly works.
It bypasses the broken configurable lookup and changes the saved state that the
plugin reads on startup.

## Verification

Version under test:

- Oxc IntelliJ Plugin local JAR:

  ```text
  /var/home/user/.local/share/JetBrains/IntelliJIdea2026.2/oxc-intellij-plugin/lib/oxc-intellij-plugin-0.0.35.jar
  ```

- Installed plugin metadata says version `0.0.35`,
  ID `com.github.oxc.project.oxcintellijplugin`,
  and registers `OxcOnSaveInfoProvider` plus `OxlintFixAllOnSaveAction`.
- Upstream source tag `v0.0.35`,
  commit `a0b6e5cd9854b3350c7066a8d06fc18c26b1b11b`.
- JetBrains platform source clone
  `JetBrains/intellij-community@2df9a042f185196facbe3c703e8f45fd840293d8`
  was used for the `ActionOnSaveBackedByOwnConfigurable` call path.
- Local IDEA log records IntelliJ IDEA 2026.2 EAP build `IU-262.8377.35` for the
  failed click.

Installed plugin metadata was extracted with:

```shell
cd /var/home/user/Monochromatic
unzip -p \
  /var/home/user/.local/share/JetBrains/IntelliJIdea2026.2/oxc-intellij-plugin/lib/oxc-intellij-plugin-0.0.35.jar \
  META-INF/plugin.xml \
  > /tmp/agent/oxc-intellij-plugin-0.0.35-plugin.xml
rg --line-number \
  '<version>|<id>|actionOnSave|OxlintFixAllOnSaveAction|OxcOnSaveInfoProvider|idea-version' \
  /tmp/agent/oxc-intellij-plugin-0.0.35-plugin.xml
```

```text
3:  <idea-version since-build="252.25557" />
35:  <version>0.0.35</version>
36:  <id>com.github.oxc.project.oxcintellijplugin</id>
51:    <actionOnSaveInfoProvider id="OxcOnSaveInfoProvider" implementation="com.github.oxc.project.oxcintellijplugin.settings.OxcOnSaveInfoProvider" order="after FormatOnSaveInfoProvider, after EsLintOnSaveInfoProvider, before FileWatcherOnSaveInfoProvider, before UploadOnSaveInfoProvider" />
52:    <actionOnSave id="OxlintFixAllOnSaveAction" implementation="com.github.oxc.project.oxcintellijplugin.oxlint.actions.OxlintFixAllOnSaveAction" order="first, before FormatOnSaveAction" />
```

A static harness against the `v0.0.35` source reproduces the root-cause
mismatch:

```shell
cd /tmp/agent/oxc-intellij-plugin-proto-KdNzE2
node -e "const fs = require('node:fs'); const plugin = fs.readFileSync('src/main/resources/META-INF/plugin.xml', 'utf8'); const config = fs.readFileSync('src/main/kotlin/com/github/oxc/project/oxcintellijplugin/oxlint/settings/OxlintConfigurable.kt', 'utf8'); const pluginId = plugin.match(/instance=\"com\\.github\\.oxc\\.project\\.oxcintellijplugin\\.oxlint\\.settings\\.OxlintConfigurable\"[\\s\\S]*?id=\"([^\"]+)\"/)?.[1]; const constantId = config.match(/CONFIGURABLE_ID = \"([^\"]+)\"/)?.[1]; console.log(JSON.stringify({ pluginId, constantId })); if (pluginId !== constantId) { console.error('FAIL: Oxlint CONFIGURABLE_ID does not match plugin.xml projectConfigurable id'); process.exitCode = 1; }"
```

```text
{"pluginId":"OxlintConfigurable","constantId":"com.github.oxc.project.oxcintellijplugin.settings.OxcSettingsConfigurable"}
FAIL: Oxlint CONFIGURABLE_ID does not match plugin.xml projectConfigurable id
```

A disposable prototype changes only the constant.
After that change,
the same harness passes:

```text
{"pluginId":"OxlintConfigurable","constantId":"OxlintConfigurable"}
```

The local workaround changed the project file from `true` to `false` in commit
`4b5001a87299058b0f025f5e36f505c5af70abc8`:

```diff
# .idea/OxcSettings.xml
@@
     <option
       name='fixAllOnSave'
-      value='true'
+      value='false'
     />
```

Manual verification after restarting IDEA confirmed that the Actions on Save
checkbox is unchecked after the XML edit.

Patterns that work cleanly:

- `fixAllOnSave=false` in `.idea/OxcSettings.xml` before IDEA starts:
  IDEA reads the persisted state and shows the action off.
- Oxfmt's analogous Actions on Save bridge:
  its `CONFIGURABLE_ID` and `plugin.xml` project configurable ID match.
- The one-line prototype changing Oxlint's constant to `OxlintConfigurable`:
  the source-level ID harness changes from failure to success.

Patterns that fail:

- Clicking `Run Oxlint 'Fix All' on Save` on the Actions on Save page while
  the saved value is `true`:
  IntelliJ logs `Failed to initialize configurable with id=...OxcSettingsConfigurable`
  and leaves the persisted setting unchanged.
- Any Actions on Save toggle path that depends on
  `OxlintConfigurable.CONFIGURABLE_ID` before an upstream fix:
  the ID still does not resolve to the registered project configurable.

## Verified workarounds

### Edit project XML while IDEA is closed

Close IDEA,
set `.idea/OxcSettings.xml` to:

```xml
<!-- .idea/OxcSettings.xml -->
<project version='4'>
  <component name='OxcSettings'>
    <option
      name='fixAllOnSave'
      value='false'
    />
    <option
      name='typeAware'
      value='true'
    />
  </component>
</project>
```

Restart IDEA.
The checkbox should be unchecked because the plugin reads `state.fixAllOnSave`
from that file during project settings load.

Tradeoffs:

- This changes a checked-in `.idea` project file in this repo.
- This disables the action only for this project configuration.
- Editing while IDEA is open can be overwritten by IDEA's component store save.
- The Actions on Save checkbox remains broken for future toggles until the
  plugin ID mismatch is fixed upstream.

## What does not work

- Repeatedly clicking the Actions on Save checkbox does not fix the state.
  The log shows the click reaches `ActionOnSaveColumnInfo`,
  then fails inside `ActionOnSaveBackedByOwnConfigurable` before it can update
  the Oxlint settings component.
- Restarting IDEA without changing `.idea/OxcSettings.xml` does not change a
  persisted `true` value.
  The saved state is valid and will be read again.
- Treating this as an Oxlint LSP or `fixKind` issue is the wrong layer.
  The failing log is emitted before any language-server fix request;
  the failed component is the JetBrains Actions on Save settings bridge.

## Upstream filing decision

No `.out-of-scope/` exemption matched `oxc`,
`oxlint`,
`intellij`,
`JetBrains`,
or plugin issues.

Duplicate search:

- `gh search issues '"fixAllOnSave"' --repo oxc-project/oxc-intellij-plugin`
  found no open or closed issues.
- `gh search prs '"fixAllOnSave"' --repo oxc-project/oxc-intellij-plugin`
  found merged PR `#267`,
  `fix: Change settings to properly store fixAllOnSave element`.
  That was the older attribute-name fix from `configPath` to `fixAllOnSave`,
  not this configurable-ID mismatch.
- `gh search issues '"Run Oxlint" "Fix All"' --repo oxc-project/oxc-intellij-plugin`
  found open issue `#374`,
  but that thread is about applying dangerous or suggested fixes once the save
  action is already enabled.
  It is not about the checkbox failing to toggle.

Constraint check:

- Is it really upstream's fault?
  Yes.
  The Oxc plugin source has an internal ID mismatch:
  `plugin.xml` registers `OxlintConfigurable`,
  while `OxlintConfigurable.CONFIGURABLE_ID` returns the unregistered
  `com.github.oxc.project.oxcintellijplugin.settings.OxcSettingsConfigurable`.
- Can upstream fix it?
  Yes.
  Matching the constant to the registered project configurable ID fixes the
  source-level reproduction.
- Are they supporting this use case?
  Yes.
  The README and plugin metadata advertise automatic Oxlint fixes on save,
  and `plugin.xml` registers both the Actions on Save info provider and the
  Oxlint save action.
- Would the repo welcome our contribution?
  Yes.
  `.github/CONTRIBUTING.md` documents how to run tests,
  `.github/workflows/build.yml` runs on pull requests,
  and no issue template,
  PR template,
  README,
  SECURITY file,
  or repository search found a ban on outside or AI-assisted reports.
- Will they likely fix it?
  Yes.
  The repo has an existing merged settings fix in PR `#267`,
  maintainers respond to save-action issues such as `#374`,
  and no maintainer comment or docs page marks Actions on Save toggling as a
  non-goal.
- Have we prototyped a minimal fix compatible with their architecture?
  Yes.
  A fresh disposable clone at `/tmp/agent/oxc-intellij-plugin-proto-KdNzE2`
  was created from `v0.0.35`,
  its origin was verified as
  `https://github.com/oxc-project/oxc-intellij-plugin.git`,
  and the one-line constant change made the ID harness pass.

Minimal fix prototype:

```diff
# src/main/kotlin/com/github/oxc/project/oxcintellijplugin/oxlint/settings/OxlintConfigurable.kt
diff --git a/src/main/kotlin/com/github/oxc/project/oxcintellijplugin/oxlint/settings/OxlintConfigurable.kt b/src/main/kotlin/com/github/oxc/project/oxcintellijplugin/oxlint/settings/OxlintConfigurable.kt
index d4c0188..d62ed81 100644
--- a/src/main/kotlin/com/github/oxc/project/oxcintellijplugin/oxlint/settings/OxlintConfigurable.kt
+++ b/src/main/kotlin/com/github/oxc/project/oxcintellijplugin/oxlint/settings/OxlintConfigurable.kt
@@ -292,6 +292,6 @@ class OxlintConfigurable(private val project: Project) :
     }
 
     companion object {
-        const val CONFIGURABLE_ID = "com.github.oxc.project.oxcintellijplugin.settings.OxcSettingsConfigurable"
+        const val CONFIGURABLE_ID = "OxlintConfigurable"
     }
 }
```

Fileable upstream issue draft:

~~~md
Title: Cannot toggle "Run Oxlint 'Fix All' on Save" because Oxlint configurable ID does not match plugin.xml

Labels: bug

## Summary

In Oxc IntelliJ Plugin 0.0.35,
clicking `Run Oxlint 'Fix All' on Save` in Settings > Tools > Actions on Save
can fail to change the setting.
IntelliJ logs:

```text
Failed to initialize configurable with id=com.github.oxc.project.oxcintellijplugin.settings.OxcSettingsConfigurable
```

The saved setting itself works.
Editing `.idea/OxcSettings.xml` from `fixAllOnSave=true` to `false` while IDEA
is closed makes the checkbox unchecked after restart.

## Version

- Oxc IntelliJ Plugin 0.0.35
- IntelliJ IDEA 2026.2 EAP,
  observed on build `IU-262.8377.35`
- Upstream source tag `v0.0.35`,
  commit `a0b6e5cd9854b3350c7066a8d06fc18c26b1b11b`

## Reproduction

1. Use a project with `.idea/OxcSettings.xml` containing:

```xml
<component name='OxcSettings'>
  <option name='fixAllOnSave' value='true' />
</component>
```

2. Open Settings > Tools > Actions on Save.
3. Click `Run Oxlint 'Fix All' on Save` to uncheck it.

Expected:

- The checkbox stays unchecked,
  and `fixAllOnSave` is persisted as `false`.

Actual:

- The checkbox does not persist the change.
- IDEA logs:

```text
Failed to initialize configurable with id=com.github.oxc.project.oxcintellijplugin.settings.OxcSettingsConfigurable
	at com.intellij.ide.actionsOnSave.ActionOnSaveBackedByOwnConfigurable.ensureUiComponentsOnOwnPageInitialized(ActionOnSaveBackedByOwnConfigurable.java:157)
	at com.intellij.ide.actionsOnSave.ActionOnSaveBackedByOwnConfigurable.updateUiOnOwnPage(ActionOnSaveBackedByOwnConfigurable.java:140)
	at com.intellij.ide.actionsOnSave.ActionOnSaveBackedByOwnConfigurable.setActionOnSaveEnabled(ActionOnSaveBackedByOwnConfigurable.java:236)
```

## Source trace

`plugin.xml` registers the Oxlint settings page with ID `OxlintConfigurable`:

```xml
<projectConfigurable
        parentId="tools"
        instance="com.github.oxc.project.oxcintellijplugin.oxlint.settings.OxlintConfigurable"
        id="OxlintConfigurable"
        nonDefaultProject="false"
        bundle="messages.OxlintBundle"
        key="oxlint.name"
/>
```

`OxlintOnSaveFixAllActionInfo` passes `OxlintConfigurable.CONFIGURABLE_ID` to
`ActionOnSaveBackedByOwnConfigurable`:

```kotlin
class OxlintOnSaveFixAllActionInfo(actionOnSaveContext: ActionOnSaveContext) :
    ActionOnSaveBackedByOwnConfigurable<OxlintConfigurable>(actionOnSaveContext,
        OxlintConfigurable.CONFIGURABLE_ID,
        OxlintConfigurable::class.java) {
```

That constant is a different,
unregistered ID:

```kotlin
companion object {
    const val CONFIGURABLE_ID = "com.github.oxc.project.oxcintellijplugin.settings.OxcSettingsConfigurable"
}
```

The Oxfmt counterpart uses matching IDs:

```kotlin
companion object {
    const val CONFIGURABLE_ID = "OxfmtConfigurable"
}
```

## Suggested fix

Change the Oxlint configurable constant to match `plugin.xml`:

```diff
diff --git a/src/main/kotlin/com/github/oxc/project/oxcintellijplugin/oxlint/settings/OxlintConfigurable.kt b/src/main/kotlin/com/github/oxc/project/oxcintellijplugin/oxlint/settings/OxlintConfigurable.kt
@@ -292,6 +292,6 @@ class OxlintConfigurable(private val project: Project) :
     }
 
     companion object {
-        const val CONFIGURABLE_ID = "com.github.oxc.project.oxcintellijplugin.settings.OxcSettingsConfigurable"
+        const val CONFIGURABLE_ID = "OxlintConfigurable"
     }
 }
```

I verified the mismatch and prototype with a source-level harness that extracts
the Oxlint `projectConfigurable` ID from `plugin.xml` and compares it to
`OxlintConfigurable.CONFIGURABLE_ID`.
It fails before the diff:

```text
{"pluginId":"OxlintConfigurable","constantId":"com.github.oxc.project.oxcintellijplugin.settings.OxcSettingsConfigurable"}
FAIL: Oxlint CONFIGURABLE_ID does not match plugin.xml projectConfigurable id
```

It passes after the diff:

```text
{"pluginId":"OxlintConfigurable","constantId":"OxlintConfigurable"}
```
~~~
