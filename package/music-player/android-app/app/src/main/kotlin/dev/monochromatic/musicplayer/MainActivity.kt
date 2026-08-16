// ============================================================================
// File summary (folds in the old KDoc that sat on the activity and composables)
// ============================================================================
//
// This file is the UI. It has one Android `Activity` (`MainActivity`) plus a
// set of Jetpack Compose UI functions (the `@Composable`-annotated `fun`s).
//
// What Compose is, for a TS reader: a declarative UI toolkit much like React.
// A `@Composable` function is a component; calling it "emits" UI. State is held
// in `remember { mutableStateOf(...) }` (think `useState`), side effects run in
// `LaunchedEffect(key) { ... }` (think `useEffect` with a dependency key), and
// layout is expressed by nesting composables with TRAILING LAMBDAS as their
// "children" (think JSX nesting). `Modifier` chains are the styling/layout
// props. There is no JSX; children are the `{ ... }` block after the call.
//
// The activity itself (`MainActivity`):
//   - The player lives in `PlaybackService` so audio outlives this activity, so
//     the UI BINDS to that service for a direct handle to the service-owned
//     `PlayerController` and drives it (single process, one brain). Binding with
//     `BIND_AUTO_CREATE` also creates the service, which builds the
//     `MediaSession` and goes foreground on play.
//   - A folder picker is registered on the activity (not inside the
//     composition) so it survives the screen leaving composition while the
//     picker round-trip stops the activity.
//
// The composables, folded from their old KDocs:
//   - `appRoot`: the audio-permission gate + library trigger over a bound
//     controller. Requests audio access once, shows `permissionGate` until
//     granted, then signals the service to load and shows `playerScreen`.
//   - `playerScreen`: the desktop's narrow single-column layout (seek bar,
//     volume, control row, settings page, page controls + track list). Page
//     controls default to radios and can switch to multi-row MD1 tabs, segmented
//     buttons, Chromium-like tabs, LED hardware buttons, or the previous rounded buttons.
//     Tap a track to play; tap the playing track to pause/resume.
//   - `startingGate`/`loadingNotice`/`permissionGate`: small placeholder/notice
//     screens. `seekRow`/`volumeRow`/`controlRow`/`radioOption`/`pageTabs`/
//     `settingsPage`/`pageTabs`/`trackPager`/`trackRow`: the pieces of the player screen.
//   - `formatTime`: format a seconds value as `m:ss`.
// ============================================================================

// What:     `package dev.monochromatic.musicplayer` names the namespace everything in
//           this file lives in (the activity is referenced from the Android manifest by
//           `dev.monochromatic.musicplayer.MainActivity`).
// Why:      So the manifest and sibling files can refer to these declarations.
//
// In TS you'd write (pseudocode):
// ```ts
// // No `package` line in TS; the file path is the module identity.
// ```
package dev.monochromatic.musicplayer

// What:     `import android.content.ComponentName` pulls in `ComponentName`, an
//           identifier for an Android component (here a service). The service-connection
//           callbacks receive one.
// Why:      `onServiceConnected`/`onServiceDisconnected` take a `ComponentName?`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { ComponentName } from "android/content";
// ```
import android.content.ComponentName

// What:     `import android.content.Context` pulls in `Context`, Android's app
//           environment handle. We use its `BIND_AUTO_CREATE` flag.
// Why:      `bindService(...)` passes `Context.BIND_AUTO_CREATE`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Context } from "android/content";
// ```
import android.content.Context

// What:     `import android.content.Intent` pulls in `Intent`, Android's "what to do"
//           message object used to start/bind components.
// Why:      We build an `Intent` to bind the service and use its grant flag.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Intent } from "android/content";
// ```
import android.content.Intent

// What:     `import android.content.ServiceConnection` pulls in `ServiceConnection`, the
//           INTERFACE with `onServiceConnected`/`onServiceDisconnected` callbacks for a
//           bound service.
// Why:      `connection` is an anonymous object implementing this interface.
//
// In TS you'd write (pseudocode):
// ```ts
// import { ServiceConnection } from "android/content";
// ```
import android.content.ServiceConnection

// What:     `import android.net.Uri` pulls in `Uri`, Android's parsed URI type.
// Why:      The folder picker yields a tree `Uri`; `pendingRoot` holds one.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Uri } from "android/net";
// ```
import android.net.Uri

// What:     `import android.os.Bundle` pulls in `Bundle`, Android's key/value state bag
//           passed to `onCreate` (for saved instance state).
// Why:      `onCreate(savedInstanceState: Bundle?)` takes one.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Bundle } from "android/os";
// ```
import android.os.Bundle

// What:     `import android.os.Build` exposes current Android API level and named release floors.
// Why:      Dynamic system accent is available only from Android 12 onward.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Build } from "android/os";
// ```
import android.os.Build

// What:     `import android.os.IBinder` pulls in `IBinder`, the interface a bound
//           service hands back; `onServiceConnected` receives one to cast.
// Why:      `onServiceConnected(..., service: IBinder?)` takes an `IBinder?`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { IBinder } from "android/os";
// ```
import android.os.IBinder

// What:     `import android.util.Log` pulls in `Log`, Android's logger (`Log.i`).
// Why:      We log lifecycle and interaction events.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Log } from "android/util";
// ```
import android.util.Log

// What:     `import androidx.activity.ComponentActivity` pulls in `ComponentActivity`,
//           the modern Android base `Activity` class (Compose-friendly).
// Why:      `MainActivity` EXTENDS `ComponentActivity`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { ComponentActivity } from "androidx/activity";
// ```
import androidx.activity.ComponentActivity

// What:     `import androidx.activity.compose.BackHandler` intercepts system Back while
//           a composable-controlled subpage is visible.
// Why:      Back from Settings should return to the library instead of closing the app.
//
// In TS you'd write (pseudocode):
// ```ts
// import { BackHandler } from "androidx/activity/compose";
// ```
import androidx.activity.compose.BackHandler

// What:     `import androidx.activity.compose.rememberLauncherForActivityResult` pulls in
//           the Compose helper that registers an activity-result launcher INSIDE a
//           composition (the permission prompt below uses it).
// Why:      `appRoot` requests the audio permission via this launcher.
//
// In TS you'd write (pseudocode):
// ```ts
// import { rememberLauncherForActivityResult } from "androidx/activity/compose";
// ```
import androidx.activity.compose.rememberLauncherForActivityResult

// What:     `import androidx.activity.compose.setContent` pulls in `setContent`, the
//           bridge that sets an activity's UI to a Compose tree.
// Why:      `onCreate` calls `setContent { ... }` to mount the UI.
//
// In TS you'd write (pseudocode):
// ```ts
// import { setContent } from "androidx/activity/compose";
// ```
import androidx.activity.compose.setContent

// What:     `import androidx.activity.enableEdgeToEdge` pulls in `enableEdgeToEdge()`,
//           which draws the app behind the system bars.
// Why:      `onCreate` calls it for the edge-to-edge layout.
//
// In TS you'd write (pseudocode):
// ```ts
// import { enableEdgeToEdge } from "androidx/activity";
// ```
import androidx.activity.enableEdgeToEdge

// What:     `import androidx.activity.result.contract.ActivityResultContracts` pulls in
//           `ActivityResultContracts`, a namespace of standard result CONTRACTS
//           (`OpenDocumentTree`, `RequestPermission`) that describe a launch+result pair.
// Why:      The folder picker and the permission request each use one of these contracts.
//
// In TS you'd write (pseudocode):
// ```ts
// import { ActivityResultContracts } from "androidx/activity/result/contract";
// ```
import androidx.activity.result.contract.ActivityResultContracts

// What:     `import androidx.compose.foundation.background` pulls in the `background`
//           MODIFIER (a styling extension on `Modifier` that paints a color behind a
//           composable).
// Why:      `trackRow` highlights the current row with `Modifier.background(...)`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { background } from "androidx/compose/foundation";
// ```
import androidx.compose.foundation.background

// What:     `import androidx.compose.foundation.border` pulls in the modifier that draws
//           an outline around a composable.
// Why:      Segmented page controls need joined dividers and a group outline.
//
// In TS you'd write (pseudocode):
// ```ts
// import { border } from "androidx/compose/foundation";
// ```
import androidx.compose.foundation.border

// What:     `import androidx.compose.foundation.clickable` pulls in the `clickable`
//           MODIFIER (makes a composable respond to taps, taking an `onClick` lambda).
// Why:      `radioOption` and `trackRow` make whole rows tappable.
//
// In TS you'd write (pseudocode):
// ```ts
// import { clickable } from "androidx/compose/foundation";
// ```
import androidx.compose.foundation.clickable

// What:     `import androidx.compose.foundation.isSystemInDarkTheme` pulls in
//           `isSystemInDarkTheme()`, a composable that returns whether the device is in
//           dark mode.
// Why:      `onCreate` picks the dark/light color scheme from it.
//
// In TS you'd write (pseudocode):
// ```ts
// import { isSystemInDarkTheme } from "androidx/compose/foundation";
// ```
import androidx.compose.foundation.isSystemInDarkTheme

// What:     `import androidx.compose.foundation.selection.selectable` makes a row one
//           mutually exclusive selection target with radio semantics.
// Why:      Radio labels and indicators should expose one action, not nested click targets.
//
// In TS you'd write (pseudocode):
// ```ts
// import { selectable } from "androidx/compose/foundation/selection";
// ```
import androidx.compose.foundation.selection.selectable

// What:     `import androidx.compose.foundation.selection.selectableGroup` marks children
//           as one mutually exclusive selection group for accessibility services.
// Why:      TalkBack should announce segmented pages as one radio-like choice set.
//
// In TS you'd write (pseudocode):
// ```ts
// import { selectableGroup } from "androidx/compose/foundation/selection";
// ```
import androidx.compose.foundation.selection.selectableGroup

// What:     `import androidx.compose.foundation.layout.Arrangement` pulls in
//           `Arrangement`, the namespace describing how children are spaced inside a
//           `Row`/`Column` (e.g. `Arrangement.spacedBy(8.dp)`).
// Why:      The layouts space their children with `Arrangement.spacedBy(...)`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Arrangement } from "androidx/compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.Arrangement

// What:     `import androidx.compose.foundation.layout.Box` pulls in a stacking container.
// Why:      The MD1 page tab uses a thin Box as its selected underline.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Box } from "androidx/compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.Box

// What:     `import androidx.compose.foundation.layout.BoxWithConstraints` exposes parent
//           width while composing children.
// Why:      Chromium tabs cap pathological labels to available pager width.
//
// In TS you'd write (pseudocode):
// ```ts
// import { BoxWithConstraints } from "androidx/compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.BoxWithConstraints

// What:     `import androidx.compose.foundation.layout.BoxScope` exposes child alignment
//           modifiers inside a `Box`.
// Why:      Extracted Chromium tab decoration still aligns to its owning tab box.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { BoxScope } from "androidx/compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.BoxScope

// What:     `import androidx.compose.foundation.layout.Column` pulls in `Column`, the
//           vertical layout composable (stacks children top to bottom).
// Why:      Several screens lay their content out in a `Column`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Column } from "androidx/compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.Column

// What:     `import androidx.compose.foundation.layout.ColumnScope` pulls in
//           `ColumnScope`, the RECEIVER type for code running inside a `Column`'s
//           children block (it exposes column-only modifiers like `weight`).
// Why:      `trackPager` is declared as an EXTENSION on `ColumnScope` so it can use
//           `Modifier.weight(...)`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { ColumnScope } from "androidx/compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.ColumnScope

// What:     `import androidx.compose.foundation.layout.ExperimentalLayoutApi` pulls in the
//           `ExperimentalLayoutApi` annotation marking unstable layout APIs (`FlowRow`).
// Why:      `@OptIn(ExperimentalLayoutApi::class)` references it where `FlowRow` is used.
//
// In TS you'd write (pseudocode):
// ```ts
// import { ExperimentalLayoutApi } from "androidx/compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.ExperimentalLayoutApi

// What:     `import androidx.compose.foundation.layout.FlowRow` pulls in `FlowRow`, a row
//           that WRAPS its children onto new lines when they overflow.
// Why:      The control row and page-tab grid wrap with `FlowRow`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { FlowRow } from "androidx/compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.FlowRow

// What:     `import androidx.compose.foundation.layout.IntrinsicSize` provides content-based
//           measurement modes for width and height.
// Why:      Each MD1 tab must be only as wide as its padded label.
//
// In TS you'd write (pseudocode):
// ```ts
// import { IntrinsicSize } from "androidx/compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.IntrinsicSize

// What:     `import androidx.compose.foundation.layout.Row` pulls in `Row`, the horizontal
//           layout composable (places children left to right).
// Why:      Many UI pieces lay out horizontally in a `Row`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Row } from "androidx/compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.Row

// What:     `import androidx.compose.foundation.layout.defaultMinSize` adds minimum-size
//           constraints without overriding larger content measurements.
// Why:      Radio rows and MD1 tabs need a 48dp minimum touch target.
//
// In TS you'd write (pseudocode):
// ```ts
// import { defaultMinSize } from "androidx/compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.defaultMinSize

// What:     `import androidx.compose.foundation.layout.fillMaxSize` pulls in the
//           `fillMaxSize` MODIFIER (make a composable occupy all available width AND
//           height).
// Why:      The full-screen surfaces/columns use `Modifier.fillMaxSize()`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { fillMaxSize } from "androidx/compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.fillMaxSize

// What:     `import androidx.compose.foundation.layout.fillMaxWidth` pulls in the
//           `fillMaxWidth` MODIFIER (occupy all available width).
// Why:      Rows and the track list use `Modifier.fillMaxWidth()`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { fillMaxWidth } from "androidx/compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.fillMaxWidth

// What:     `import androidx.compose.foundation.layout.height` fixes a composable's height.
// Why:      The MD1 selected indicator is a 2dp line.
//
// In TS you'd write (pseudocode):
// ```ts
// import { height } from "androidx/compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.height

// What:     `import androidx.compose.foundation.layout.padding` pulls in the `padding`
//           MODIFIER (inner spacing around a composable).
// Why:      Most layouts pad their contents with `Modifier.padding(...)`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { padding } from "androidx/compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.padding

// What:     `import androidx.compose.foundation.layout.offset` translates measured content
//           without changing FlowRow's layout size.
// Why:      A latched LED legend travels 2dp downward with its rigid cap.
//
// In TS you'd write (pseudocode):
// ```ts
// import { offset } from "androidx/compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.offset

// What:     `import androidx.compose.foundation.layout.size` pulls in the `size` MODIFIER
//           (fix a composable's width and height).
// Why:      The loading spinner uses `Modifier.size(20.dp)`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { size } from "androidx/compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.size

// What:     `import androidx.compose.foundation.layout.width` constrains a composable's width.
// Why:      `width(IntrinsicSize.Max)` keeps each MD1 label on one content-width line.
//
// In TS you'd write (pseudocode):
// ```ts
// import { width } from "androidx/compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.width

// What:     `import androidx.compose.foundation.layout.widthIn` caps width without forcing
//           short content to stretch.
// Why:      Chromium labels stay content-width until parent width requires ellipsis.
//
// In TS you'd write (pseudocode):
// ```ts
// import { widthIn } from "androidx/compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.widthIn

// What:     `import androidx.compose.foundation.layout.wrapContentWidth` relaxes an
//           inherited minimum width while retaining the parent's maximum width.
// Why:      The segmented frame should fit its used segments, then wrap at screen width.
//
// In TS you'd write (pseudocode):
// ```ts
// import { wrapContentWidth } from "androidx/compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.wrapContentWidth

// What:     `import androidx.compose.foundation.lazy.LazyColumn` pulls in `LazyColumn`, a
//           SCROLLING column that only composes visible items (like a virtualized list).
// Why:      `trackPager` shows the tabs + tracks in one scrolling `LazyColumn`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { LazyColumn } from "androidx/compose/foundation/lazy";
// ```
import androidx.compose.foundation.lazy.LazyColumn

// What:     `import androidx.compose.foundation.lazy.items` pulls in `items(list) { ... }`,
//           the `LazyListScope` builder that emits one row per list element.
// Why:      `trackPager` lists the page's tracks with `items(...)`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { items } from "androidx/compose/foundation/lazy";
// ```
import androidx.compose.foundation.lazy.items

// What:     `import androidx.compose.material3.Button` pulls in the Material3 `Button`
//           composable (a filled clickable button).
// Why:      Open/transport/active-tab buttons use it.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Button } from "androidx/compose/material3";
// ```
import androidx.compose.material3.Button

// What:     `import androidx.compose.material3.Checkbox` pulls in the Material3 `Checkbox`
//           composable.
// Why:      The repeat-track toggle uses it.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Checkbox } from "androidx/compose/material3";
// ```
import androidx.compose.material3.Checkbox

// What:     `import androidx.compose.material3.CircularProgressIndicator` pulls in the
//           spinner composable.
// Why:      `loadingNotice` shows a `CircularProgressIndicator`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { CircularProgressIndicator } from "androidx/compose/material3";
// ```
import androidx.compose.material3.CircularProgressIndicator

// What:     `import androidx.compose.material3.ColorScheme` names complete Material color roles.
// Why:      Theme helper returns dynamic accent roles with a true-black dark ground.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { ColorScheme } from "androidx/compose/material3";
// ```
import androidx.compose.material3.ColorScheme

// What:     `import androidx.compose.material3.MaterialTheme` pulls in `MaterialTheme`,
//           the theme provider/accessor (its `.colorScheme` gives themed colors).
// Why:      `onCreate` wraps the UI in `MaterialTheme`; rows read its colors.
//
// In TS you'd write (pseudocode):
// ```ts
// import { MaterialTheme } from "androidx/compose/material3";
// ```
import androidx.compose.material3.MaterialTheme

// What:     `import androidx.compose.material3.OutlinedButton` pulls in the outlined
//           (unfilled) button composable.
// Why:      Inactive page tabs use `OutlinedButton`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { OutlinedButton } from "androidx/compose/material3";
// ```
import androidx.compose.material3.OutlinedButton

// What:     `import androidx.compose.material3.RadioButton` pulls in the radio-button
//           composable.
// Why:      `radioOption` shows a `RadioButton`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { RadioButton } from "androidx/compose/material3";
// ```
import androidx.compose.material3.RadioButton

// What:     `import androidx.compose.material3.Scaffold` pulls in `Scaffold`, a Material
//           layout shell that supplies system-bar inset padding to its content lambda.
// Why:      `playerScreen` wraps its content in a `Scaffold`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Scaffold } from "androidx/compose/material3";
// ```
import androidx.compose.material3.Scaffold

// What:     `import androidx.compose.material3.Slider` pulls in the `Slider` composable (a
//           draggable value track).
// Why:      The seek bar and volume control are `Slider`s.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Slider } from "androidx/compose/material3";
// ```
import androidx.compose.material3.Slider

// What:     `import androidx.compose.material3.Surface` pulls in `Surface`, a themed
//           background container.
// Why:      `onCreate` wraps the screen in a full-size `Surface`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Surface } from "androidx/compose/material3";
// ```
import androidx.compose.material3.Surface

// What:     `import androidx.compose.material3.Text` pulls in the `Text` composable
//           (renders a string).
// Why:      Every label/row uses `Text`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Text } from "androidx/compose/material3";
// ```
import androidx.compose.material3.Text

// What:     `import androidx.compose.material3.darkColorScheme` pulls in
//           `darkColorScheme()`, the factory for the dark Material color set.
// Why:      `onCreate` uses it when the device is in dark mode.
//
// In TS you'd write (pseudocode):
// ```ts
// import { darkColorScheme } from "androidx/compose/material3";
// ```
import androidx.compose.material3.darkColorScheme

// What:     `dynamicDarkColorScheme` derives dark Material roles from runtime system accent.
// Why:      Selected LED light follows user accent rather than a hardcoded reference purple.
//
// In TS you'd write (pseudocode):
// ```ts
// import { dynamicDarkColorScheme } from "androidx/compose/material3";
// ```
import androidx.compose.material3.dynamicDarkColorScheme

// What:     `dynamicLightColorScheme` derives light Material roles from runtime system accent.
// Why:      Bright-scene LED light uses the same user-selected accent source.
//
// In TS you'd write (pseudocode):
// ```ts
// import { dynamicLightColorScheme } from "androidx/compose/material3";
// ```
import androidx.compose.material3.dynamicLightColorScheme

// What:     `import androidx.compose.material3.lightColorScheme` pulls in
//           `lightColorScheme()`, the factory for the light Material color set.
// Why:      `onCreate` uses it when the device is in light mode.
//
// In TS you'd write (pseudocode):
// ```ts
// import { lightColorScheme } from "androidx/compose/material3";
// ```
import androidx.compose.material3.lightColorScheme

// What:     `import androidx.compose.runtime.Composable` pulls in the `@Composable`
//           ANNOTATION that marks a function as a Compose UI component.
// Why:      Every UI function below is annotated `@Composable`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Composable } from "androidx/compose/runtime";
// ```
import androidx.compose.runtime.Composable

// What:     `import androidx.compose.runtime.LaunchedEffect` pulls in `LaunchedEffect`,
//           the composable that runs a `suspend` side-effect block tied to a key (re-runs
//           when the key changes; cancels on leave).
// Why:      `appRoot` and `playerScreen` use `LaunchedEffect` for permission requests and
//           position polling.
//
// In TS you'd write (pseudocode):
// ```ts
// import { LaunchedEffect } from "androidx/compose/runtime";
// ```
import androidx.compose.runtime.LaunchedEffect

// What:     `import androidx.compose.runtime.getValue` imports the `getValue` OPERATOR
//           used to READ a `by`-delegated state property (the `var x by remember { ... }`
//           lines).
// Why:      The `by` state declarations below read through it.
//
// In TS you'd write (pseudocode):
// ```ts
// // no import — TS getters don't need an operator function in scope
// ```
import androidx.compose.runtime.getValue

// What:     `import androidx.compose.runtime.mutableDoubleStateOf` imports
//           `mutableDoubleStateOf(x)`, a `Double`-specialized observable state holder (a
//           `mutableStateOf` variant that avoids boxing the number).
// Why:      `playerScreen` holds `position`/`duration` (both `Double`) in it.
//
// In TS you'd write (pseudocode):
// ```ts
// import { mutableDoubleStateOf } from "androidx/compose/runtime";
// ```
import androidx.compose.runtime.mutableDoubleStateOf

// What:     `import androidx.compose.runtime.mutableStateOf` imports `mutableStateOf(x)`,
//           the general observable state holder.
// Why:      `boundController` and `appRoot`'s `hasAudioAccess` use it.
//
// In TS you'd write (pseudocode):
// ```ts
// import { mutableStateOf } from "androidx/compose/runtime";
// ```
import androidx.compose.runtime.mutableStateOf

// What:     `import androidx.compose.runtime.remember` imports `remember { ... }`, the
//           composable that COMPUTES a value once and keeps it across recompositions
//           (until its keys change).
// Why:      State holders are wrapped in `remember { ... }` so they survive recomposition.
//
// In TS you'd write (pseudocode):
// ```ts
// import { remember } from "androidx/compose/runtime";
// ```
import androidx.compose.runtime.remember

// What:     `import androidx.compose.runtime.setValue` imports the `setValue` OPERATOR
//           used to WRITE a `by`-delegated state property.
// Why:      Assigning to the `by` state vars below goes through it.
//
// In TS you'd write (pseudocode):
// ```ts
// // no import — TS setters don't need an operator function in scope
// ```
import androidx.compose.runtime.setValue

// What:     `import androidx.compose.ui.Alignment` pulls in `Alignment`, the namespace of
//           alignment constants (`CenterVertically`, `CenterHorizontally`).
// Why:      Layouts align children with `Alignment.*`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Alignment } from "androidx/compose/ui";
// ```
import androidx.compose.ui.Alignment

// What:     `import androidx.compose.ui.Modifier` pulls in `Modifier`, the chainable
//           styling/layout descriptor passed to composables.
// Why:      Nearly every composable takes a `Modifier` chain.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Modifier } from "androidx/compose/ui";
// ```
import androidx.compose.ui.Modifier

// What:     `import androidx.compose.ui.zIndex` controls sibling painting order without
//           changing measurement or placement.
// Why:      Selected Chromium feet must remain above inactive baselines on both sides.
//
// In TS you'd write (pseudocode):
// ```ts
// import { zIndex } from "androidx/compose/ui";
// ```
import androidx.compose.ui.zIndex

// What:     `import androidx.compose.ui.draw.drawBehind` adds custom pixel drawing before
//           a composable paints its normal content.
// Why:      Chromium feet must paint beyond layout width without enlarging wrapping or touch bounds.
//
// In TS you'd write (pseudocode):
// ```ts
// import { drawBehind } from "androidx/compose/ui/draw";
// ```
import androidx.compose.ui.draw.drawBehind

// What:     `import androidx.compose.ui.draw.clip` clips painting to a supplied shape.
// Why:      Selected segment fills must stay inside the group's rounded outline.
//
// In TS you'd write (pseudocode):
// ```ts
// import { clip } from "androidx/compose/ui/draw";
// ```
import androidx.compose.ui.draw.clip

// What:     `import androidx.compose.ui.geometry.Offset` names a two-dimensional pixel offset.
// Why:      Active label light uses a centered text-shadow glow.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { Offset } from "androidx/compose/ui/geometry";
// ```
import androidx.compose.ui.geometry.Offset

// What:     `import androidx.compose.ui.geometry.Size` names pixel width and height together.
// Why:      Chromium path construction receives the tab body dimensions as one value.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { Size } from "androidx/compose/ui/geometry";
// ```
import androidx.compose.ui.geometry.Size

// What:     `import androidx.compose.ui.graphics.Color` pulls in `Color`, Compose's color
//           type (we use `Color.Transparent`).
// Why:      `trackRow` uses `Color.Transparent` for non-current rows.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Color } from "androidx/compose/ui/graphics";
// ```
import androidx.compose.ui.graphics.Color

// What:     `import androidx.compose.ui.graphics.Path` builds an open contour from move,
//           line, and curve commands.
// Why:      Active Chromium tabs need a silhouette that reaches outside their layout box.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Path } from "androidx/compose/ui/graphics";
// ```
import androidx.compose.ui.graphics.Path

// What:     `import androidx.compose.ui.graphics.drawscope.Stroke` describes outline width
//           instead of a filled path.
// Why:      Chromium's accent contour must follow the same overflowing path as its fill.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Stroke } from "androidx/compose/ui/graphics/drawscope";
// ```
import androidx.compose.ui.graphics.drawscope.Stroke

// What:     `import androidx.compose.foundation.shape.RoundedCornerShape` creates a shape
//           whose four corners use the supplied radius.
// Why:      The segmented group in the supplied reference has one rounded outer frame.
//
// In TS you'd write (pseudocode):
// ```ts
// import { RoundedCornerShape } from "androidx/compose/foundation/shape";
// ```
import androidx.compose.foundation.shape.RoundedCornerShape

// What:     `import androidx.compose.ui.platform.LocalContext` pulls in `LocalContext`, a
//           Compose CompositionLocal whose `.current` gives the current Android `Context`.
// Why:      `appRoot` reads `LocalContext.current` to check the permission.
//
// In TS you'd write (pseudocode):
// ```ts
// import { LocalContext } from "androidx/compose/ui/platform";
// ```
import androidx.compose.ui.platform.LocalContext

// What:     `import androidx.compose.ui.semantics.Role` names accessibility control roles.
// Why:      Generic radio rows should announce themselves as radio buttons.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Role } from "androidx/compose/ui/semantics";
// ```
import androidx.compose.ui.semantics.Role

// What:     `import androidx.compose.ui.text.style.TextOverflow` pulls in `TextOverflow`,
//           the namespace describing how overflowing text is clipped (`Ellipsis`).
// Why:      `trackRow` uses `TextOverflow.Ellipsis`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { TextOverflow } from "androidx/compose/ui/text/style";
// ```
import androidx.compose.ui.text.style.TextOverflow

// What:     `import androidx.compose.ui.text.font.FontWeight` supplies named text weights.
// Why:      Hardware legends use the supplied design's semibold printed ink.
//
// In TS you'd write (pseudocode):
// ```ts
// import { FontWeight } from "androidx/compose/ui/text/font";
// ```
import androidx.compose.ui.text.font.FontWeight

// What:     `import androidx.compose.ui.unit.Dp` names density-independent dimensions.
// Why:      Chromium tab options carry parent width into content-width measurement.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { Dp } from "androidx/compose/ui/unit";
// ```
import androidx.compose.ui.unit.Dp

// What:     `import androidx.compose.ui.unit.dp` imports the `dp` EXTENSION PROPERTY on
//           numbers: writing `24.dp` produces a density-independent-pixel dimension. It
//           is an extension on `Int`/`Float`, so importing it enables the `<number>.dp`
//           syntax.
// Why:      Every spacing/size value uses `.dp` (e.g. `24.dp`, `8.dp`).
// Gotcha:   `24.dp` is calling an extension PROPERTY on the literal `24`; there is no such
//           "number.unit" syntax in TS.
//
// In TS you'd write (pseudocode):
// ```ts
// import { dp } from "androidx/compose/ui/unit"; // 24.dp ~ dp(24)
// ```
import androidx.compose.ui.unit.dp

// What:     `import dev.monochromatic.musicplayer.core.PageEntry` imports the `PageEntry`
//           record (`{ index: Int; name: String }`) from `.core`.
// Why:      `trackRow` takes a `PageEntry`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { PageEntry } from "./core/Page";
// ```
import dev.monochromatic.musicplayer.core.PageEntry

// What:     `import dev.monochromatic.musicplayer.core.ShuffleMode` imports the
//           three-value enum `ShuffleMode` (`OFF`/`WITHIN_PAGE`/`ALL`).
// Why:      `controlRow` compares and sets shuffle modes.
//
// In TS you'd write (pseudocode):
// ```ts
// import { ShuffleMode } from "./core/ShuffleMode";
// ```
import dev.monochromatic.musicplayer.core.ShuffleMode

// What:     `import dev.monochromatic.musicplayer.core.rowDisplay` imports the
//           `rowDisplay(label, name)` FUNCTION that strips a folder tab's `<label>/` prefix
//           from a track's display name (and leaves letter / `#` tab names whole).
// Why:      `trackRow` shows the path BELOW the active folder tab, not the full relative path.
//
// In TS you'd write (pseudocode):
// ```ts
// import { rowDisplay } from "./core/Pagination";
// ```
import dev.monochromatic.musicplayer.core.rowDisplay

// What:     `import kotlinx.coroutines.delay` imports `delay(ms)`, a `suspend` function
//           that pauses the coroutine for the given milliseconds without blocking a
//           thread.
// Why:      `playerScreen`'s polling loop uses `delay(POSITION_POLL_MS)`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { delay } from "kotlinx/coroutines"; // await delay(ms) ~ await sleep(ms)
// ```
import kotlinx.coroutines.delay

// What:     `const val LOG_TAG = "MusicPlayer"` declares a top-level PUBLIC (Kotlin
//           default) compile-time constant. `const` = compile-time + inlined; `val` =
//           never reassigned. No explicit type; Kotlin INFERS `String` from the literal.
// Why:      The shared logcat tag the on-device verification reads back; public and
//           top-level so `PlaybackService` (same package) reuses it.
//
// In TS you'd write (pseudocode):
// ```ts
// export const LOG_TAG = "MusicPlayer";
// ```
/**
 * Defines log tag value for this music-player component; the TypeScript-oriented notes above explain its source
 * and use.
 */
const val LOG_TAG = "MusicPlayer"

// What:     `private const val SECONDS_PER_MINUTE: Int = 60` declares a private
//           compile-time `Int` constant (32-bit; siblings `Long`/`Short`).
// Why:      Used by `formatTime` to split seconds into `m:ss`.
//
// In TS you'd write (pseudocode):
// ```ts
// const SECONDS_PER_MINUTE = 60;
// ```
/**
 * Defines seconds per minute value for this music-player component; the TypeScript-oriented notes above explain
 * its source and use.
 */
private const val SECONDS_PER_MINUTE: Int = 60

// What:     `private const val POSITION_POLL_MS: Long = 200L` declares a private
//           compile-time `Long` constant (64-bit; the `L` suffix forces `Long`, a bare
//           `200` would be `Int`).
// Why:      Position-poll cadence for the seek bar, in milliseconds (the desktop emits
//           every 0.1s); `Long` because `delay(...)` takes a `Long` millisecond count.
// Gotcha:   The `L` makes it a `Long` to match `delay(timeMillis: Long)`.
//
// In TS you'd write (pseudocode):
// ```ts
// const POSITION_POLL_MS = 200;
// ```
/**
 * Defines position poll ms value for this music-player component; the TypeScript-oriented notes above explain
 * its source and use.
 */
private const val POSITION_POLL_MS: Long = 200L

// What:     `class MainActivity : ComponentActivity() { ... }` declares the activity class
//           that EXTENDS `ComponentActivity` (the `: Super()` is the implicit `super()`
//           call). Android instantiates it, so there is no explicit primary constructor.
// Why:      Single-activity host. The player lives in `PlaybackService` so audio outlives
//           this activity; the UI binds to that service for a direct handle to the
//           service-owned `PlayerController` and drives it. Binding with
//           `BIND_AUTO_CREATE` also creates the service, which builds the `MediaSession`
//           and goes foreground on play.
//
// In TS you'd write (pseudocode):
// ```ts
// class MainActivity extends ComponentActivity {
//   // ...fields and lifecycle methods below...
// }
// ```
/**
 * Defines main activity type for this music-player component; the TypeScript-oriented notes above explain its
 * role.
 */
class MainActivity : ComponentActivity() {
    // What:     `private val boundController = mutableStateOf<PlayerController?>(null)`
    //           declares a private read-only field holding a Compose MUTABLE-STATE OBJECT
    //           (NOT a `by`-delegated property): `mutableStateOf<PlayerController?>(null)`
    //           creates an observable holder whose VALUE type is the nullable
    //           `PlayerController?` (the `<...>` is the generic type argument). You read/
    //           write the held value through `.value` (see `boundController.value` below).
    // Why:      Service-owned brain, observable so the Compose tree swaps off the loading
    //           state once bound. Held as the state OBJECT (not via `by`) so the activity
    //           can read/write `.value` from lifecycle callbacks AND the composition can
    //           observe it.
    // Gotcha:   This is the state OBJECT itself (accessed via `.value`), unlike the `by`
    //           form used elsewhere where the delegate hides `.value`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private readonly boundController = signal<PlayerController | null>(null);
    // ```
    /**
     * Defines bound controller value for this music-player component; the TypeScript-oriented notes above
     * explain its source and use.
     */
    private val boundController = mutableStateOf<PlayerController?>(null)

    // What:     `private var binder: PlaybackService.LocalBinder? = null` declares a
    //           private, reassignable field of the NULLABLE nested type
    //           `PlaybackService.LocalBinder?` (the binder handle, or null while unbound),
    //           initialised `null`.
    // Why:      Live binder for the post-grant library-load signal; null while unbound.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private binder: PlaybackService.LocalBinder | null = null;
    // ```
    /**
     * Defines binder value for this music-player component; the TypeScript-oriented notes above explain its
     * source and use.
     */
    private var binder: PlaybackService.LocalBinder? = null

    // What:     `private var pendingRoot: Uri? = null` declares a private, reassignable
    //           NULLABLE `Uri?` field, initialised `null`.
    // Why:      A folder picked while the service was unbound, waiting to be applied;
    //           `connection`'s `onServiceConnected` consumes it once the rebind completes.
    //           The picker round-trip stops this activity, which unbinds the service, so
    //           the binder is often null at the moment the pick arrives.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private pendingRoot: Uri | null = null;
    // ```
    /**
     * Defines pending root value for this music-player component; the TypeScript-oriented notes above explain
     * its source and use.
     */
    private var pendingRoot: Uri? = null

    // What:     `private val folderPicker = registerForActivityResult(ActivityResultContracts.OpenDocumentTree()) {
    //           tree -> ... }`
    //           declares a private read-only field by calling `registerForActivityResult`
    //           with a CONTRACT (`OpenDocumentTree()`) and a TRAILING LAMBDA callback
    //           `{ tree -> ... }` (its parameter `tree` is the picked `Uri?`). The call
    //           returns a launcher you `launch(...)` later.
    // Why:      Activity-scoped folder picker, registered on the activity rather than
    //           inside the composition. `registerForActivityResult` must be called
    //           unconditionally while the activity is being created (the API forbids
    //           registering once it is STARTED), so the launcher cannot live inside a
    //           composable that may leave and re-enter composition. Registering on the
    //           activity ties the launcher to the activity lifecycle, so it is still
    //           registered when the picker result arrives and receives the granted tree.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private readonly folderPicker = registerForActivityResult(
    //   new ActivityResultContracts.OpenDocumentTree(),
    //   (tree) => { if (tree !== null) this.onFolderChosen(tree); },
    // );
    // ```
    /**
     * Defines folder picker value for this music-player component; the TypeScript-oriented notes above explain
     * its source and use.
     */
    private val folderPicker = registerForActivityResult(ActivityResultContracts.OpenDocumentTree()) { tree ->
        // What:     `if (tree != null) { onFolderChosen(tree) }` null-checks the picked
        //           `Uri?`. Inside the block `tree` is SMART-CAST to a non-null `Uri`.
        // Why:      A cancelled picker yields null; only act on a real pick.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (tree !== null) this.onFolderChosen(tree);
        // ```
        if (tree != null) {
            // What:     `onFolderChosen(tree)` applies the chosen folder (persist grant +
            //           reload). `tree` is the smart-cast non-null `Uri`.
            // Why:      Make the picked folder the live library.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.onFolderChosen(tree);
            // ```
            onFolderChosen(tree)
        }
    }

    // What:     `private val connection = object : ServiceConnection { ... }` declares a
    //           private field holding an ANONYMOUS OBJECT that IMPLEMENTS the
    //           `ServiceConnection` interface. `object : Interface { ... }` is Kotlin's
    //           inline implementation of an interface (no named class), like a Java
    //           anonymous class or a TS object literal that satisfies an interface.
    // Why:      The service-connection callbacks that wire the bound brain into
    //           `boundController` and clear it on disconnect.
    // Gotcha:   `object : ServiceConnection { ... }` is an anonymous IMPLEMENTING object,
    //           NOT a singleton declaration and NOT a type cast.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private readonly connection: ServiceConnection = {
    //   onServiceConnected: (name, service) => { ... },
    //   onServiceDisconnected: (name) => { ... },
    // };
    // ```
    /**
     * Defines connection value for this music-player component; the TypeScript-oriented notes above explain its
     * source and use.
     */
    private val connection = object : ServiceConnection {
        // What:     `override fun onServiceConnected(name: ComponentName?, service: IBinder?) { ... }`
        //           overrides the interface callback Android calls when the bind completes.
        //           `name` is the bound component (unused); `service` is the raw `IBinder?`.
        // Why:      Capture the binder and publish the brain to the observable state.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // onServiceConnected(name, service) { ... }
        // ```
        /**
         * Defines on service connected behavior for this music-player component; the TypeScript-oriented notes
         * above explain its call shape and effects.
         */
        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
            // What:     `val local = service as PlaybackService.LocalBinder` declares a local
            //           `local` by CASTING the `IBinder?` `service` to the concrete
            //           `PlaybackService.LocalBinder`. `as` is the UNSAFE cast: it throws
            //           `ClassCastException` at runtime if `service` is not actually that
            //           type (and would throw on null here too).
            // Why:      We know our own service hands back a `LocalBinder`, so we narrow to
            //           it to reach `.controller`/`.reloadFromRoot`.
            // Gotcha:   Kotlin `as` is a CHECKED cast that throws on mismatch; TS `as` is
            //           erased and never throws. The safe variant is `as?` (returns null on
            //           mismatch), not used here.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const local = service as PlaybackService.LocalBinder;
            // ```
            /**
             * Defines local value for this music-player component; the TypeScript-oriented notes above explain
             * its source and use.
             */
            val local = service as PlaybackService.LocalBinder
            // What:     `binder = local` stores the binder handle.
            // Why:      Keep it for the post-grant library-load signal.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.binder = local;
            // ```
            binder = local
            // What:     `boundController.value = local.controller` writes the service-owned
            //           brain into the observable state via its `.value` SETTER (this is the
            //           state OBJECT, so `.value` is explicit, not hidden by `by`).
            // Why:      Publishing the controller makes the composition swap off the loading
            //           state and render the player.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.boundController.value = local.controller;
            // ```
            boundController.value = local.controller
            // What:     `Log.i(LOG_TAG, "bound to PlaybackService")` logs the bind.
            // Why:      Trace binding for verification.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // console.info(`[${LOG_TAG}] bound to PlaybackService`);
            // ```
            Log.i(LOG_TAG, "bound to PlaybackService")
            // What:     `val pending = pendingRoot; if (pending != null) { ... } else { local.rescan() }`
            //           reads the nullable `pendingRoot` into a local (smart-cast to non-null in
            //           the `then` branch), then branches on whether a folder pick is waiting.
            // Why:      Runs ONCE per activity, when the single `onCreate` bind connects (the
            //           bind is held until `onDestroy`, so this no longer fires per foreground;
            //           the per-foreground hook is now `onStart` -> `rescan`). Two cases at the
            //           initial connect. (1) A folder was picked before the bind completed
            //           (`pendingRoot` set): apply it now (a full reload that clears selection,
            //           the explicit-Open semantic). (2) Otherwise rescan/reconcile (LIVE
            //           UPDATE). `rescan()` is a no-op before the first load or while a load is
            //           in flight, so during the usual cold start (the service's own `onCreate`
            //           is still running `ensureLibraryLoaded`) it does nothing and cannot
            //           disturb the restore; if the service was already alive and loaded (e.g.
            //           headless playback), it reconciles.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const pending = this.pendingRoot;
            // if (pending !== null) { local.reloadFromRoot(pending); this.pendingRoot = null; }
            // else { local.rescan(); }
            // ```
            /**
             * Defines pending value for this music-player component; the TypeScript-oriented notes above explain
             * its source and use.
             */
            val pending = pendingRoot
            if (pending != null) {
                // What:     `local.reloadFromRoot(pending)` tells the service to load the pending
                //           folder; `pendingRoot = null` clears it so it is not reapplied.
                // Why:      Apply the deferred explicit pick exactly once.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // local.reloadFromRoot(pending); this.pendingRoot = null;
                // ```
                local.reloadFromRoot(pending)
                pendingRoot = null
            } else {
                // What:     `local.rescan()` asks the service to re-scan the current source and
                //           reconcile the queue (live update), preserving the playing track.
                // Why:      The foreground signal: pick up files added/removed/renamed while the
                //           app was away. Safe no-op during the first load (cold-start restore).
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // local.rescan();
                // ```
                local.rescan()
            }
        }

        // What:     `override fun onServiceDisconnected(name: ComponentName?) { ... }`
        //           overrides the callback Android calls when the service connection drops.
        // Why:      Clear our handles so nothing uses a dead connection.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // onServiceDisconnected(name) { ... }
        // ```
        /**
         * Defines on service disconnected behavior for this music-player component; the TypeScript-oriented
         * notes above explain its call shape and effects.
         */
        override fun onServiceDisconnected(name: ComponentName?) {
            // What:     `binder = null` clears the binder handle.
            // Why:      The connection is gone.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.binder = null;
            // ```
            binder = null
            // What:     `boundController.value = null` clears the observable brain (via the
            //           state object's `.value`), which makes the composition show the
            //           starting/loading gate again.
            // Why:      No brain while disconnected.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.boundController.value = null;
            // ```
            boundController.value = null
            // What:     `Log.i(LOG_TAG, "PlaybackService disconnected")` logs the drop.
            // Why:      Trace disconnects for verification.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // console.info(`[${LOG_TAG}] PlaybackService disconnected`);
            // ```
            Log.i(LOG_TAG, "PlaybackService disconnected")
        }
    }

    // What:     `override fun onCreate(savedInstanceState: Bundle?) { ... }` overrides the
    //           activity-creation lifecycle hook. `savedInstanceState` is the saved-state
    //           bag (or null on a fresh start).
    // Why:      Set up edge-to-edge drawing and mount the Compose UI.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // override onCreate(savedInstanceState: Bundle | null): void { ... }
    // ```
    /**
     * Defines on create behavior for this music-player component; the TypeScript-oriented notes above explain
     * its call shape and effects.
     */
    override fun onCreate(savedInstanceState: Bundle?) {
        // What:     `super.onCreate(savedInstanceState)` calls the base class first.
        // Why:      The framework must initialize the activity before we touch it.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // super.onCreate(savedInstanceState);
        // ```
        super.onCreate(savedInstanceState)
        // What:     `Log.i(LOG_TAG, "MainActivity.onCreate")` logs an info line at activity
        //           creation. There is no variant suffix because the current build has one engine
        //           and no `BuildConfig.FLAVOR` constant.
        // Why:      Trace activity launch in logcat, for verification.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // console.info(`[${LOG_TAG}] MainActivity.onCreate`);
        // ```
        Log.i(LOG_TAG, "MainActivity.onCreate")
        // Auto-start the one-time parallel true-peak index (no user action). Legal here because the
        // activity is foregrounded; PeakSweepService self-stops fast if the initial index is done.
        PeakSweepService.startIfNeeded(this)
        // What:     `enableEdgeToEdge()` draws the app behind the system bars. (Folds in the
        //           old inline note: draw edge to edge, the platform default on targetSdk
        //           35+, and let the `Scaffold` apply the system-bar insets.)
        // Why:      Modern full-bleed layout; the `Scaffold` supplies inset padding.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // enableEdgeToEdge();
        // ```
        enableEdgeToEdge()
        // What:     `bindService(Intent(this,
        //           PlaybackService::class.java).setAction(PlaybackService.ACTION_LOCAL_BIND), connection,
        //           Context.BIND_AUTO_CREATE)`
        //           binds to the service ONCE for the activity's whole lifetime (paired with the
        //           single `unbindService` in `onDestroy`). `BIND_AUTO_CREATE` also creates the
        //           service if it is not already running; `connection.onServiceConnected`
        //           publishes the brain into `boundController`.
        // Why:      Hold the binding across `onStop`/`onStart` so the bind-only
        //           `MediaSessionService` is NOT torn down on every background. The bind used to
        //           live in `onStart`/`onStop`, so each app switch dropped the last client, the
        //           service was destroyed, and the next foreground re-created it and re-ran
        //           `ensureLibraryLoaded` (a full ~3.6k-track rescan with a blocking loading
        //           state). Binding once keeps the service, its engine, and the loaded library
        //           alive, so a foreground is a cheap non-blocking reconcile (`onStart` ->
        //           `rescan`). media3 keeps the service foreground while playing, so background
        //           audio is unaffected.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.bindService(
        //   new Intent(this, PlaybackService).setAction(PlaybackService.ACTION_LOCAL_BIND),
        //   this.connection,
        //   Context.BIND_AUTO_CREATE,
        // );
        // ```
        bindService(
            Intent(this, PlaybackService::class.java).setAction(PlaybackService.ACTION_LOCAL_BIND),
            connection,
            Context.BIND_AUTO_CREATE,
        )
        // What:     `setContent { ... }` mounts a Compose UI tree as this activity's
        //           content; the trailing lambda IS the root composable.
        // Why:      Render the app UI.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // setContent(() => {
        //   const colorScheme = isSystemInDarkTheme() ? darkColorScheme() : lightColorScheme();
        //   return <MaterialTheme colorScheme={colorScheme}> ... </MaterialTheme>;
        // });
        // ```
        setContent {
            // What:     `val colorScheme = if (isSystemInDarkTheme()) darkColorScheme() else lightColorScheme()`
            //           declares `colorScheme` from an `if/else` EXPRESSION: dark or light
            //           Material colors based on the device theme (`isSystemInDarkTheme()` is
            //           a composable returning a `Boolean`).
            // Why:      Theme the UI to the system setting.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const colorScheme = isSystemInDarkTheme() ? darkColorScheme() : lightColorScheme();
            // ```
            /**
             * Defines color scheme value for this music-player component; the TypeScript-oriented notes above
             * explain its source and use.
             */
            val colorScheme: ColorScheme = musicPlayerColorScheme()
            // What:     `MaterialTheme(colorScheme = colorScheme) { ... }` calls the
            //           `MaterialTheme` composable with the `colorScheme` named argument and a
            //           TRAILING LAMBDA holding its child UI. Trailing-lambda children are how
            //           Compose nests UI (like JSX children).
            // Why:      Provide the theme to all descendants.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // <MaterialTheme colorScheme={colorScheme}>
            //   <Surface modifier={Modifier.fillMaxSize()}> ... </Surface>
            // </MaterialTheme>
            // ```
            MaterialTheme(colorScheme = colorScheme) {
                // What:     `Surface(modifier = Modifier.fillMaxSize()) { ... }` calls the
                //           `Surface` composable with a `Modifier.fillMaxSize()` chain (occupy
                //           the whole screen) and a trailing-lambda child.
                // Why:      A themed full-screen background to host the content.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // <Surface modifier={Modifier.fillMaxSize()}> ... </Surface>
                // ```
                Surface(modifier = Modifier.fillMaxSize()) {
                    // What:     `val controller = boundController.value` reads the observable
                    //           state's `.value` (a `PlayerController?`). Reading `.value`
                    //           inside a composable SUBSCRIBES this UI to changes, so it
                    //           recomposes when the brain binds/unbinds.
                    // Why:      Decide whether to show the loading gate or the bound app.
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // const controller = this.boundController.value;
                    // ```
                    /**
                     * Defines controller value for this music-player component; the TypeScript-oriented notes
                     * above explain its source and use.
                     */
                    val controller = boundController.value
                    // What:     `if (controller == null) { startingGate() } else { appRoot(...) }`
                    //           branches the UI: no brain yet -> show `startingGate`; bound ->
                    //           show `appRoot` (smart-cast `controller` to non-null in the else).
                    // Why:      Render the right screen for the bind state.
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // if (controller === null) return <startingGate/>;
                    // return (
                    //   <appRoot
                    //     controller={controller}
                    //     onAudioGranted={() => this.binder?.ensureLibraryLoaded()}
                    //     onChooseFolder={() => this.folderPicker.launch(null)}
                    //   />
                    // );
                    // ```
                    if (controller == null) {
                        // What:     `startingGate()` calls the placeholder composable shown
                        //           while binding.
                        // Why:      Show "Starting..." until the service binds.
                        //
                        // In TS you'd write (pseudocode):
                        // ```ts
                        // <startingGate/>
                        // ```
                        startingGate()
                    } else {
                        // What:     `appRoot(controller = controller, onAudioGranted = { binder?.ensureLibraryLoaded()
                        //           }, onChooseFolder = { folderPicker.launch(null) },)`
                        //           calls the `appRoot` composable with named arguments. Two of
                        //           them are LAMBDA callbacks: `onAudioGranted` safe-calls
                        //           `binder?.ensureLibraryLoaded()`; `onChooseFolder` launches the
                        //           folder picker with `folderPicker.launch(null)`.
                        // Why:      Hand the bound brain and the two activity-level actions to the
                        //           permission/library gate.
                        //
                        // In TS you'd write (pseudocode):
                        // ```ts
                        // <appRoot
                        //   controller={controller}
                        //   onAudioGranted={() => this.binder?.ensureLibraryLoaded()}
                        //   onChooseFolder={() => this.folderPicker.launch(null)}
                        // />
                        // ```
                        appRoot(
                            controller = controller,
                            onAudioGranted = { binder?.ensureLibraryLoaded() },
                            onChooseFolder = { folderPicker.launch(null) },
                        )
                    }
                }
            }
        }
    }

    // What:     `override fun onStart() { ... }` overrides the lifecycle hook called when
    //           the activity becomes visible (every foreground, including app switches).
    // Why:      Trigger the foreground LIVE UPDATE. Binding happens once in `onCreate` and is
    //           held until `onDestroy`, so `onStart` does not bind; it just asks the
    //           already-bound service to rescan and reconcile the queue.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // override onStart(): void { this.binder?.rescan(); }
    // ```
    /**
     * Defines on start behavior for this music-player component; the TypeScript-oriented notes above explain its
     * call shape and effects.
     */
    override fun onStart() {
        // What:     `super.onStart()` calls the base class first.
        // Why:      Let the framework run its own start logic.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // super.onStart();
        // ```
        super.onStart()
        // What:     `binder?.rescan()` SAFE-CALLs the service's `rescan` (the live-update entry
        //           point) when the binder is present. On the very first foreground the bind
        //           from `onCreate` may not have completed yet (`binder` null), so this no-ops
        //           and the initial library load is the service's own `onCreate`
        //           (`ensureLibraryLoaded`). On every later foreground the binder is set, so this
        //           re-scans the current source and reconciles the queue WITHOUT a loading state
        //           (`reconcileLibrary`), preserving the playing track.
        // Why:      Pick up files added/removed/renamed while the app was away, non-blockingly
        //           (the desktop "Rescan" analog; see
        //           doc/decision/music-player-live-update-rescan.md). `rescan` itself no-ops
        //           before the first load or while a load is in flight, so a foreground arriving
        //           during the cold-start restore cannot disturb it.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.binder?.rescan();
        // ```
        binder?.rescan()
    }

    // What:     `override fun onStop() { ... }` overrides the lifecycle hook called when the
    //           activity is no longer visible (backgrounded, e.g. an app switch).
    // Why:      Persist the resume position. It does NOT unbind: the binding is held from
    //           `onCreate` to `onDestroy` so the bind-only service is not torn down on a
    //           background (which previously forced a full reload on the next foreground). The
    //           service keeps running, and media3 keeps it foreground while playing, so audio is
    //           unaffected.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // override onStop(): void { this.binder?.saveSession(); }
    // ```
    /**
     * Defines on stop behavior for this music-player component; the TypeScript-oriented notes above explain its
     * call shape and effects.
     */
    override fun onStop() {
        // What:     `super.onStop()` calls the base class first.
        // Why:      Let the framework run its own stop logic.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // super.onStop();
        // ```
        super.onStop()
        // What:     `binder?.saveSession()` SAFE-CALLs the service's `saveSession` while the
        //           binder is valid.
        // Why:      Capture the resume position when the user backgrounds mid-track while
        //           playing: no state-change fires then, so the controller's `onPersist` would
        //           miss it, and `onDestroy` may not run if the process is later killed. Saving
        //           here, on the live service controller, makes the backgrounded position
        //           durable. No-op if the library has not loaded.
        // Note:     We intentionally do NOT `unbindService` here, and we keep `boundController`.
        //           Holding the binding keeps the service, its engine, and the loaded library
        //           alive across the background, so the next foreground is a cheap non-blocking
        //           reconcile (`onStart` -> `rescan`) instead of a destroy + full reload. The
        //           binding is released once, in `onDestroy`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.binder?.saveSession();
        // ```
        binder?.saveSession()
    }

    // What:     `override fun onDestroy() { ... }` overrides the final lifecycle hook, called
    //           when the activity is being destroyed.
    // Why:      Release the binding taken in `onCreate`. This single unbind (held until now) is
    //           what keeps the bind-only `MediaSessionService` alive across `onStop`/`onStart`,
    //           fixing the reload-on-every-app-switch. media3 keeps the service foreground while
    //           playing, so background audio survives the activity's destruction.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // override onDestroy(): void { this.unbindService(this.connection); this.binder = null; }
    // ```
    /**
     * Defines on destroy behavior for this music-player component; the TypeScript-oriented notes above explain
     * its call shape and effects.
     */
    override fun onDestroy() {
        // What:     `super.onDestroy()` calls the base class first.
        // Why:      Let the framework run its own destroy logic.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // super.onDestroy();
        // ```
        super.onDestroy()
        // What:     `unbindService(connection)` releases the connection taken in `onCreate`
        //           (paired one-to-one with that single `bindService`), then `binder = null`
        //           clears the handle.
        // Why:      Drop our reference so the service can be reclaimed when nothing else keeps it
        //           alive (e.g. not playing).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.unbindService(this.connection); this.binder = null;
        // ```
        unbindService(connection)
        binder = null
    }

    // What:     `private fun onFolderChosen(treeUri: Uri) { ... }` declares a private method
    //           taking a tree `Uri`, block body, `Unit`.
    // Why:      Persist read access to a just-picked SAF folder and make it the live
    //           library. Taking a persistable grant lets a later cold start re-read the
    //           folder with no re-pick; the bound service is told to rescan now. Only the
    //           activity can do this: the persistable grant is delivered to the component
    //           that launched the picker.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private onFolderChosen(treeUri: Uri): void { ... }
    // ```
    /**
     * Defines on folder chosen behavior for this music-player component; the TypeScript-oriented notes above
     * explain its call shape and effects.
     */
    private fun onFolderChosen(treeUri: Uri) {
        // What:     `contentResolver.takePersistableUriPermission(treeUri, Intent.FLAG_GRANT_READ_URI_PERMISSION)`
        //           takes a persistable READ grant for the picked tree. `contentResolver` is
        //           the activity's resolver; the flag requests read access that survives
        //           reboots.
        // Why:      So a later cold start can re-read the folder without re-prompting.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.contentResolver.takePersistableUriPermission(treeUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
        // ```
        contentResolver.takePersistableUriPermission(treeUri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        // What:     `LibraryRoot.save(this, treeUri)` persists the chosen folder URI so a
        //           restart remembers it.
        // Why:      Remembering the choice backs a later restart.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // LibraryRoot.save(this, treeUri);
        // ```
        LibraryRoot.save(this, treeUri)
        // What:     `val bound = binder` declares a local `bound` (inferred nullable
        //           `PlaybackService.LocalBinder?`) snapshotting the current binder.
        // Why:      Snapshot lets us branch on bound-vs-unbound and smart-cast below.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const bound = this.binder;
        // ```
        /**
         * Defines bound value for this music-player component; the TypeScript-oriented notes above explain its
         * source and use.
         */
        val bound = binder
        // What:     `if (bound != null) { bound.reloadFromRoot(treeUri) } else { ... }`
        //           branches on whether we are bound. `bound != null` smart-casts `bound` to
        //           non-null in the `then` branch.
        // Why:      If bound, reload immediately; otherwise defer the pick until the rebind.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (bound !== null) bound.reloadFromRoot(treeUri);
        // else this.pendingRoot = treeUri;
        // ```
        if (bound != null) {
            // What:     `bound.reloadFromRoot(treeUri)` tells the bound service to rescan the
            //           picked folder now.
            // Why:      Apply the pick immediately when connected.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // bound.reloadFromRoot(treeUri);
            // ```
            bound.reloadFromRoot(treeUri)
        } else {
            // What:     `pendingRoot = treeUri` stores the pick for later. (Folds in the old
            //           inline note: the picker stopped this activity, which unbound the
            //           service; the pick is applied when the rebind connects, see
            //           `connection`.)
            // Why:      Defer until `onServiceConnected` can apply it.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.pendingRoot = treeUri;
            // ```
            pendingRoot = treeUri
        }
        // What:     `Log.i(LOG_TAG, "folder chosen: $treeUri")` logs the chosen folder.
        // Why:      Trace folder selection for verification.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // console.info(`[${LOG_TAG}] folder chosen: ${treeUri}`);
        // ```
        Log.i(LOG_TAG, "folder chosen: $treeUri")
    }
}

// What:     `@Composable` is the ANNOTATION marking the next function as a Compose UI
//           component (it may emit UI and read composition state).
// Why:      `appRoot` is a UI component.
//
// In TS you'd write (pseudocode):
// ```ts
// // (no annotation; a function returning UI is a component)
// ```
@Composable
// What:     `private fun appRoot(controller: PlayerController, onAudioGranted: () -> Unit, onChooseFolder: () -> Unit)
//           { ... }`
//           declares a private composable taking the bound brain plus two FUNCTION-TYPE
//           callbacks (`() -> Unit` = a no-arg void function; TS `() => void`).
// Why:      The audio-permission gate and library trigger over a bound `controller`:
//           request audio access once, show `permissionGate` until granted, and on grant
//           signal the service to load the library; once access is held show
//           `playerScreen`.
//
// In TS you'd write (pseudocode):
// ```ts
// function appRoot(props: {
//   controller: PlayerController;
//   onAudioGranted: () => void;
//   onChooseFolder: () => void;
// }) { ... }
// ```
/**
 * Defines app root behavior for this music-player component; the TypeScript-oriented notes above explain its
 * call shape and effects.
 */
private fun appRoot(controller: PlayerController, onAudioGranted: () -> Unit, onChooseFolder: () -> Unit) {
    // What:     `val context = LocalContext.current` reads the current Android `Context`
    //           from the `LocalContext` CompositionLocal (`.current` is the in-scope value).
    // Why:      Needed to check the audio permission.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const context = useContext(LocalContext);
    // ```
    /**
     * Defines context value for this music-player component; the TypeScript-oriented notes above explain its
     * source and use.
     */
    val context = LocalContext.current
    // What:     `var hasAudioAccess by remember { mutableStateOf(hasAudioPermission(context)) }`
    //           declares a STATE-BACKED local. `remember { ... }` computes the value once and
    //           keeps it across recompositions; `mutableStateOf(...)` is the observable
    //           holder seeded from the current permission; `by` DELEGATES the `hasAudioAccess`
    //           property's get/set to that holder, so reading it subscribes and assigning it
    //           triggers recomposition. (`getValue`/`setValue` are imported for this `by`.)
    // Why:      Track whether audio access is held; flipping it re-renders the gate.
    // Gotcha:   `by remember { mutableStateOf(...) }` is the read/write `useState` idiom; the
    //           `by` hides the `.value` so `hasAudioAccess` reads/writes like a plain var.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const [hasAudioAccess, setHasAudioAccess] = useState(hasAudioPermission(context));
    // ```
    /**
     * Defines has audio access value for this music-player component; the TypeScript-oriented notes above
     * explain its source and use.
     */
    var hasAudioAccess by remember { mutableStateOf(hasAudioPermission(context)) }
    // What:     `val permissionLauncher =
    //           rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission(),) { granted -> ... }`
    //           registers a permission-request launcher inside the composition, with the
    //           `RequestPermission()` contract and a trailing-lambda result callback whose
    //           `granted` parameter is the `Boolean` result.
    // Why:      Lets the gate ask for the audio permission and react to the answer.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const permissionLauncher = useActivityResultLauncher(
    //   new ActivityResultContracts.RequestPermission(),
    //   (granted) => { setHasAudioAccess(granted); },
    // );
    // ```
    /**
     * Defines permission launcher value for this music-player component; the TypeScript-oriented notes above
     * explain its source and use.
     */
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        // What:     `Log.i(LOG_TAG, "audio permission granted=$granted")` logs the result.
        // Why:      Trace the permission outcome for verification.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // console.info(`[${LOG_TAG}] audio permission granted=${granted}`);
        // ```
        Log.i(LOG_TAG, "audio permission granted=$granted")
        // What:     `hasAudioAccess = granted` writes the new access state through the `by`
        //           delegate (triggers recomposition).
        // Why:      Update the gate to the granted/denied result.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // setHasAudioAccess(granted);
        // ```
        hasAudioAccess = granted
    }
    // What:     `LaunchedEffect(Unit) { ... }` runs the trailing `suspend` block once when
    //           this composable first enters (the key `Unit` never changes). (Folds in the
    //           old inline note: ask once on first launch; the gate's button re-asks if the
    //           user declined.)
    // Why:      Prompt for audio access automatically on first show.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // useEffect(() => {
    //   if (!hasAudioAccess) permissionLauncher.launch(audioPermission());
    // }, []);
    // ```
    LaunchedEffect(Unit) {
        // What:     `if (!hasAudioAccess) { permissionLauncher.launch(audioPermission()) }`
        //           prompts only when access is not already held. `!` negates the flag;
        //           `audioPermission()` returns the platform permission string.
        // Why:      Don't re-prompt if access is already granted.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (!hasAudioAccess) permissionLauncher.launch(audioPermission());
        // ```
        if (!hasAudioAccess) {
            // What:     `permissionLauncher.launch(audioPermission())` fires the system
            //           permission prompt for the platform's audio permission.
            // Why:      Ask the user for audio access.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // permissionLauncher.launch(audioPermission());
            // ```
            permissionLauncher.launch(audioPermission())
        }
    }
    // What:     `LaunchedEffect(hasAudioAccess) { ... }` runs the block whenever
    //           `hasAudioAccess` CHANGES (the key is that state). (Folds in the old inline
    //           note: on (re)confirmed access, tell the service to load the library, it owns
    //           the brain + query.)
    // Why:      Trigger the service-side load when access becomes (re)confirmed.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // useEffect(() => {
    //   if (hasAudioAccess) onAudioGranted();
    // }, [hasAudioAccess]);
    // ```
    LaunchedEffect(hasAudioAccess) {
        // What:     `if (hasAudioAccess) { onAudioGranted() }` signals the service only when
        //           access is held.
        // Why:      Load the library once access is confirmed.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (hasAudioAccess) onAudioGranted();
        // ```
        if (hasAudioAccess) {
            // What:     `onAudioGranted()` invokes the callback passed by the caller (which
            //           tells the service to load the library).
            // Why:      Kick off the service-side load.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // onAudioGranted();
            // ```
            onAudioGranted()
        }
    }
    // What:     `if (hasAudioAccess) { playerScreen(...) } else { permissionGate(...) }`
    //           chooses the screen: the player when access is held, otherwise the permission
    //           gate. `playerScreen(controller = controller, onChooseFolder = onChooseFolder)`
    //           and `permissionGate(onGrant = { permissionLauncher.launch(audioPermission()) })`
    //           are composable calls with named args (the gate's `onGrant` is a lambda that
    //           re-asks).
    // Why:      Show the right UI for the access state.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (hasAudioAccess) return <playerScreen controller={controller} onChooseFolder={onChooseFolder}/>;
    // return <permissionGate onGrant={() => permissionLauncher.launch(audioPermission())}/>;
    // ```
    if (hasAudioAccess) {
        // What:     `playerScreen(controller = controller, onChooseFolder = onChooseFolder)`
        //           renders the main player with named args.
        // Why:      Access held -> show the player.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // <playerScreen controller={controller} onChooseFolder={onChooseFolder}/>
        // ```
        playerScreen(controller = controller, onChooseFolder = onChooseFolder)
    } else {
        // What:     `permissionGate(onGrant = { permissionLauncher.launch(audioPermission()) })`
        //           renders the gate, passing an `onGrant` lambda that re-launches the
        //           permission request.
        // Why:      Access not held -> show the gate with a re-ask button.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // <permissionGate onGrant={() => permissionLauncher.launch(audioPermission())}/>
        // ```
        permissionGate(onGrant = { permissionLauncher.launch(audioPermission()) })
    }
}

// What:     `@Composable` marks the next function as a Compose component.
// Why:      `startingGate` is a UI component.
//
// In TS you'd write (pseudocode):
// ```ts
// // (component function)
// ```
@Composable
// What:     `private fun startingGate() { ... }` declares a private no-arg composable.
// Why:      Brief placeholder shown while the activity binds to `PlaybackService`.
//
// In TS you'd write (pseudocode):
// ```ts
// function startingGate() { ... }
// ```
/**
 * Defines starting gate behavior for this music-player component; the TypeScript-oriented notes above explain
 * its call shape and effects.
 */
private fun startingGate() {
    // What:     `Column( modifier = Modifier.fillMaxSize().padding(24.dp), verticalArrangement =
    //           Arrangement.spacedBy(12.dp, Alignment.CenterVertically), horizontalAlignment =
    //           Alignment.CenterHorizontally, ) { ... }`
    //           calls the `Column` layout composable with named args and a trailing-lambda
    //           child. `Modifier.fillMaxSize().padding(24.dp)` is a chained modifier (fill the
    //           screen, then 24dp padding; `24.dp` is the `dp` extension on the literal).
    //           `Arrangement.spacedBy(12.dp, Alignment.CenterVertically)` spaces children 12dp
    //           apart, centered vertically; `Alignment.CenterHorizontally` centers them across.
    // Why:      Center the "Starting..." text on screen.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // <Column
    //   modifier={Modifier.fillMaxSize().padding(dp(24))}
    //   verticalArrangement={Arrangement.spacedBy(dp(12), Alignment.CenterVertically)}
    //   horizontalAlignment={Alignment.CenterHorizontally}
    // >
    //   <Text>Starting Music Player...</Text>
    // </Column>
    // ```
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        // What:     `Text("Starting Music Player...")` renders the placeholder text.
        // Why:      Tell the user the app is starting.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // <Text>Starting Music Player...</Text>
        // ```
        Text("Starting Music Player...")
    }
}

// What:     `musicPlayerColorScheme` resolves runtime accent and page-level dark ground.
// Why:      Hardware light follows system accent while every dark page starts from true black.
//
// In TS you'd write (pseudocode):
// ```ts
// function musicPlayerColorScheme(): ColorScheme { ... }
// ```
/** Returns dynamic Material roles with true-black dark background and surface. */
@Composable
private fun musicPlayerColorScheme(): ColorScheme {
    /** Records system appearance for scene and ground selection. */
    val dark: Boolean = isSystemInDarkTheme()
    /** Supplies Android context required by dynamic-color APIs. */
    val context: Context = LocalContext.current
    /** Uses runtime system accent where platform supports dynamic color. */
    val scheme: ColorScheme = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        if (dark) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
    } else {
        if (dark) darkColorScheme() else lightColorScheme()
    }
    if (!dark) {
        return scheme
    }
    return scheme.copy(background = Color.Black, surface = Color.Black)
}

// What:     `pageSceneColor` selects LED reference ground or standard app background.
// Why:      LED hardware follows true-black dark and low-glare light scenes without recoloring other styles.
//
// In TS you'd write (pseudocode):
// ```ts
// function pageSceneColor(style: PageControlStyle): Color { ... }
// ```
/** Returns page ground for current control style and ambient theme. */
@Composable
private fun pageSceneColor(style: PageControlStyle): Color {
    if (isSystemInDarkTheme()) {
        return Color.Black
    }
    if (style != PageControlStyle.LED_SEGMENTED_BUTTONS) {
        return MaterialTheme.colorScheme.background
    }
    /** Holds updated reference's low-glare bright-scene ground. */
    val lightGround: Color = Color(0xFFECEEF1)
    return lightGround
}

// What:     `@Composable` marks the next function as a Compose component.
// Why:      `playerScreen` is the main UI component.
//
// In TS you'd write (pseudocode):
// ```ts
// // (component function)
// ```
@Composable
// What:     `fun playerScreen(controller: PlayerController, onChooseFolder: () -> Unit) { ... }`
//           declares a PUBLIC (Kotlin default) composable taking the brain and an
//           `onChooseFolder` callback (`() -> Unit`).
// Why:      The player screen, the desktop's narrow (single-column) layout: a seek bar, a
//           volume slider, a wrapping control row (settings / open / shuffle / transport / repeat),
//           then settings or the selected page's controls and track list. No title bar, matching
//           the desktop's plain window. Tap a track to play it; tap the playing track to
//           pause or resume.
//
// In TS you'd write (pseudocode):
// ```ts
// function playerScreen(props: { controller: PlayerController; onChooseFolder: () => void; }) { ... }
// ```
/**
 * Defines player screen behavior for this music-player component; the TypeScript-oriented notes above explain
 * its call shape and effects.
 */
fun playerScreen(controller: PlayerController, onChooseFolder: () -> Unit) {
    // What:     `val state = controller.uiState` reads the brain's Compose-observable
    //           snapshot. Reading the `uiState` (a Compose state) here SUBSCRIBES this
    //           composable, so it recomposes when the brain swaps in a new snapshot.
    // Why:      Render from the current UI snapshot.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const state = controller.uiState;
    // ```
    /**
     * Defines state value for this music-player component; the TypeScript-oriented notes above explain its
     * source and use.
     */
    val state = controller.uiState
    // What:     `val context = LocalContext.current` reads the current Android context.
    // Why:      The page-control preference is loaded and saved through SessionStore.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const context = useContext(LocalContext);
    // ```
    /** Holds the current Android context for preference persistence. */
    val context = LocalContext.current
    // What:     `pageControlStyle` is remembered observable UI state seeded from storage.
    // Why:      Changing a setting immediately recomposes the page selector.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const [pageControlStyle, setPageControlStyle] = useState(SessionStore.loadPageControlStyle(context));
    // ```
    /** Holds the selected page-control treatment. */
    var pageControlStyle by remember { mutableStateOf(SessionStore.loadPageControlStyle(context)) }
    // What:     `showingSettings` is remembered observable navigation state.
    // Why:      The Settings button swaps the library area for the settings page.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const [showingSettings, setShowingSettings] = useState(false);
    // ```
    /** Tracks whether the settings page is visible. */
    var showingSettings by remember { mutableStateOf(false) }
    // What:     `BackHandler(enabled = showingSettings)` handles system Back only on Settings.
    // Why:      Return to the library before allowing Back to close the activity.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // useBackHandler(showingSettings, () => setShowingSettings(false));
    // ```
    BackHandler(enabled = showingSettings) { showingSettings = false }
    // What:     `var position by remember { mutableDoubleStateOf(0.0) }` declares a
    //           state-backed `Double` local via the `useState` idiom: `remember` keeps it
    //           across recompositions, `mutableDoubleStateOf(0.0)` is the (number-specialized)
    //           observable holder seeded `0.0`, and `by` delegates get/set. `0.0` is a
    //           `Double` literal.
    // Why:      Holds the live playback position for the seek bar, updated by the poll loop.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const [position, setPosition] = useState(0);
    // ```
    /**
     * Defines position value for this music-player component; the TypeScript-oriented notes above explain its
     * source and use.
     */
    var position by remember { mutableDoubleStateOf(0.0) }
    // What:     `var duration by remember { mutableDoubleStateOf(0.0) }` declares another
    //           state-backed `Double` local (same `by remember { mutableDoubleStateOf(...) }`
    //           idiom) seeded `0.0`.
    // Why:      Holds the live track duration for the seek bar.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const [duration, setDuration] = useState(0);
    // ```
    /**
     * Defines duration value for this music-player component; the TypeScript-oriented notes above explain its
     * source and use.
     */
    var duration by remember { mutableDoubleStateOf(0.0) }

    // What:     `LaunchedEffect(controller) { ... }` runs the trailing `suspend` block,
    //           restarting it whenever the `controller` instance changes (its key): Compose
    //           cancels the old loop and launches a fresh one on a swap.
    // Why:      Start the position/duration polling loop, and re-target it at the live brain
    //           if the bound controller is replaced (e.g. the service was recreated on a
    //           rebind, then republished by `onServiceConnected`). Keying on `controller`
    //           (not `Unit`) keeps the loop from polling a stale, released controller after
    //           such a swap, which would otherwise freeze the seek bar at 0.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // useEffect(() => {
    //   let alive = true;
    //   (async () => {
    //     while (alive) {
    //       setPosition(controller.positionSec());
    //       setDuration(controller.durationSec());
    //       await delay(POSITION_POLL_MS);
    //     }
    //   })();
    //   return () => { alive = false; };
    // }, [controller]);
    // ```
    LaunchedEffect(controller) {
        // What:     `while (true) { ... }` is an infinite loop (it runs until the effect is
        //           cancelled when the composable leaves).
        // Why:      Continuously poll the engine while the screen is shown.
        // Gotcha:   This loop never exits on its own; Compose cancels the `LaunchedEffect`
        //           coroutine when the composable leaves, which ends it.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // while (alive) { ... }
        // ```
        while (true) {
            // What:     `position = controller.positionSec()` writes the latest position
            //           through the `by` delegate (triggers recompose of the seek bar).
            // Why:      Update the seek bar's elapsed position.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // setPosition(controller.positionSec());
            // ```
            position = controller.positionSec()
            // What:     `duration = controller.durationSec()` writes the latest duration
            //           through the `by` delegate.
            // Why:      Update the seek bar's total duration.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // setDuration(controller.durationSec());
            // ```
            duration = controller.durationSec()
            // What:     `delay(POSITION_POLL_MS)` SUSPENDS the loop for the poll interval
            //           (without blocking a thread).
            // Why:      Poll at the configured cadence (200ms).
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // await delay(POSITION_POLL_MS);
            // ```
            delay(POSITION_POLL_MS)
        }
    }

    // What:     `Scaffold { innerPadding -> ... }` calls the `Scaffold` composable with a
    //           trailing lambda whose parameter `innerPadding` is the system-bar inset
    //           padding the scaffold computes for its content.
    // Why:      Provide a layout shell that hands us safe-area padding for the content.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // <Scaffold>{(innerPadding) => (
    //   <Column modifier={...}> ... </Column>
    // )}</Scaffold>
    // ```
    Scaffold(containerColor = pageSceneColor(pageControlStyle)) { innerPadding ->
        // What:     `Column( modifier = Modifier.fillMaxSize().padding(innerPadding).padding(horizontal = 12.dp),
        //           verticalArrangement = Arrangement.spacedBy(8.dp), ) { ... }`
        //           lays the screen out vertically. The modifier chain fills the screen, then
        //           applies the scaffold `innerPadding`, then 12dp horizontal padding (named
        //           `horizontal = 12.dp`). Children are spaced 8dp apart.
        // Why:      Stack the player controls with consistent spacing inside the safe area.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // <Column
        //   modifier={Modifier.fillMaxSize().padding(innerPadding).padding({ horizontal: dp(12) })}
        //   verticalArrangement={Arrangement.spacedBy(dp(8))}
        // > ... </Column>
        // ```
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            // What:     `seekRow(position = position, duration = duration, onSeek = { controller.seek(it) })`
            //           renders the seek bar. `onSeek` is a lambda using the implicit `it`
            //           (the seeked-to seconds) to call `controller.seek(it)`.
            // Why:      Show and drive the position scrubber.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // <seekRow position={position} duration={duration} onSeek={(sec) => controller.seek(sec)}/>
            // ```
            seekRow(position = position, duration = duration, onSeek = { controller.seek(it) })
            // What:     `volumeRow(volume = state.volume, onVolume = { controller.setVolume(it) })`
            //           renders the volume slider; `onVolume`'s lambda uses `it` (the new gain).
            // Why:      Show and drive the volume control.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // <volumeRow volume={state.volume} onVolume={(v) => controller.setVolume(v)}/>
            // ```
            volumeRow(volume = state.volume, onVolume = { controller.setVolume(it) })
            // What:     `controlRow(state = state, controller = controller, onOpen = onChooseFolder)`
            //           renders the open/shuffle/transport/repeat row.
            // Why:      Show the main control buttons.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // <controlRow state={state} controller={controller} onOpen={onChooseFolder}/>
            // ```
            controlRow(
                state = state,
                controller = controller,
                onSettings = { showingSettings = true },
                onOpen = onChooseFolder,
            )
            // What:     The settings/library branch renders one page in the remaining space.
            // Why:      Settings replaces the page selector and tracks until the user returns.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return showingSettings ? <settingsPage .../> : <trackPager .../>;
            // ```
            if (showingSettings) {
                settingsPage(
                    style = pageControlStyle,
                    onSelectStyle = { style ->
                        pageControlStyle = style
                        SessionStore.savePageControlStyle(context, style)
                        Log.i(LOG_TAG, "page control style=${style.name}")
                    },
                    onBack = { showingSettings = false },
                )
            } else {
                // What:     `trackPager(state = state, controller = controller)` renders the page
            //           tabs + track list. (Folds in the old inline note: page tabs and the
            //           track list share one scroll area, the desktop's narrow layout: a library
            //           with many folder pages would otherwise let the wrapping tab bar fill the
            //           column and leave the list no room, so the tabs scroll together with the
            //           tracks as one column.)
            // Why:      Show the browsable, scrollable track list.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // <trackPager state={state} controller={controller}/>
            // ```
                trackPager(
                    state = state,
                    controller = controller,
                    pageControlStyle = pageControlStyle,
                )
            }
        }
    }
}

// What:     `@Composable` marks the next function as a Compose component.
// Why:      `seekRow` is a UI component.
//
// In TS you'd write (pseudocode):
// ```ts
// // (component function)
// ```
@Composable
// What:     `private fun seekRow(position: Double, duration: Double, onSeek: (Double) -> Unit) { ... }`
//           declares a private composable. `onSeek: (Double) -> Unit` is a function type
//           "takes a `Double`, returns void" (TS `(n: number) => void`).
// Why:      Seek bar: elapsed time, a position slider over the track duration, and total
//           time.
//
// In TS you'd write (pseudocode):
// ```ts
// function seekRow(props: { position: number; duration: number; onSeek: (n: number) => void; }) { ... }
// ```
/**
 * Defines seek row behavior for this music-player component; the TypeScript-oriented notes above explain its
 * call shape and effects.
 */
private fun seekRow(position: Double, duration: Double, onSeek: (Double) -> Unit) {
    // What:     `val maxValue = if (duration > 0.0) duration.toFloat() else 1.0f` declares
    //           `maxValue` from an `if/else` EXPRESSION. `duration.toFloat()` converts the
    //           `Double` to a `Float` (32-bit; the Slider API takes `Float`). `1.0f` is a
    //           `Float` literal (the `f` suffix; a bare `1.0` would be a `Double` and would
    //           not match). Type INFERRED as `Float`.
    // Why:      The slider needs a positive `Float` max; before a duration is known, fall
    //           back to `1.0f` to avoid a zero-length range.
    // Gotcha:   `1.0f` is a `Float` literal; the `f` is load-bearing because the branch type
    //           must match `duration.toFloat()` (a `Float`). `Double` and `Float` are
    //           distinct Kotlin types.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const maxValue = duration > 0 ? duration : 1;
    // ```
    /**
     * Defines max value value for this music-player component; the TypeScript-oriented notes above explain its
     * source and use.
     */
    val maxValue = if (duration > 0.0) duration.toFloat() else 1.0f
    // What:     `Row(verticalAlignment = Alignment.CenterVertically) { ... }` lays the seek
    //           controls out horizontally, vertically centered.
    // Why:      Put elapsed time, slider, and total time on one line.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // <Row verticalAlignment={Alignment.CenterVertically}> ... </Row>
    // ```
    Row(verticalAlignment = Alignment.CenterVertically) {
        // What:     `Text(formatTime(position))` shows the elapsed time as `m:ss` via
        //           `formatTime`.
        // Why:      Display the current position.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // <Text>{formatTime(position)}</Text>
        // ```
        Text(formatTime(position))
        // What:     `Slider( value = position.toFloat().coerceIn(0.0f, maxValue), onValueChange = {
        //           onSeek(it.toDouble()) }, valueRange = 0.0f..maxValue, modifier =
        //           Modifier.weight(1.0f).padding(horizontal = 8.dp), )`
        //           renders the scrubber. `position.toFloat()` converts the `Double` to a
        //           `Float`; `.coerceIn(0.0f, maxValue)` CLAMPS it into range. `onValueChange`
        //           is a lambda using `it` (the new `Float`), converted back with
        //           `it.toDouble()`. `valueRange = 0.0f..maxValue` is a `ClosedFloatingPointRange`
        //           built with the `..` RANGE operator (a Kotlin range literal). The modifier
        //           gives it `weight(1.0f)` (take the remaining row width) plus horizontal
        //           padding.
        // Why:      A draggable position control spanning the row between the time labels.
        // Gotcha:   `0.0f..maxValue` uses the `..` range operator (no TS equivalent; it builds
        //           a range object). The `f` literals are `Float`s to match the Slider API.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // <Slider
        //   value={clamp(position, 0, maxValue)}
        //   onValueChange={(v) => onSeek(v)}
        //   min={0}
        //   max={maxValue}
        //   modifier={Modifier.weight(1).padding({ horizontal: dp(8) })}
        // />
        // ```
        Slider(
            value = position.toFloat().coerceIn(0.0f, maxValue),
            onValueChange = { onSeek(it.toDouble()) },
            valueRange = 0.0f..maxValue,
            modifier = Modifier
                .weight(1.0f)
                .padding(horizontal = 8.dp),
        )
        // What:     `Text(formatTime(duration))` shows the total time as `m:ss`.
        // Why:      Display the track duration.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // <Text>{formatTime(duration)}</Text>
        // ```
        Text(formatTime(duration))
    }
}

// What:     `@Composable` marks the next function as a Compose component.
// Why:      `volumeRow` is a UI component.
//
// In TS you'd write (pseudocode):
// ```ts
// // (component function)
// ```
@Composable
// What:     `private fun volumeRow(volume: Float, onVolume: (Float) -> Unit) { ... }`
//           declares a private composable taking a `Float` gain and an `(Float) -> Unit`
//           callback.
// Why:      Volume row: a "Volume" label and a 0..1 gain slider.
//
// In TS you'd write (pseudocode):
// ```ts
// function volumeRow(props: { volume: number; onVolume: (n: number) => void; }) { ... }
// ```
/**
 * Defines volume row behavior for this music-player component; the TypeScript-oriented notes above explain its
 * call shape and effects.
 */
private fun volumeRow(volume: Float, onVolume: (Float) -> Unit) {
    // What:     `Row(verticalAlignment = Alignment.CenterVertically) { ... }` lays out the
    //           label and slider on one centered line.
    // Why:      Put "Volume" next to its slider.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // <Row verticalAlignment={Alignment.CenterVertically}> ... </Row>
    // ```
    Row(verticalAlignment = Alignment.CenterVertically) {
        // What:     `Text("Volume")` shows the label.
        // Why:      Label the slider.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // <Text>Volume</Text>
        // ```
        Text("Volume")
        // What:     `Slider( value = volume, onValueChange = onVolume, valueRange = 0.0f..1.0f, modifier =
        //           Modifier.weight(1.0f).padding(start = 8.dp), )`
        //           renders the gain slider. `value = volume` is the current `Float` gain;
        //           `onValueChange = onVolume` forwards the callback directly (no wrapping
        //           lambda needed); `valueRange = 0.0f..1.0f` is the `[0, 1]` `Float` range via
        //           `..`; the modifier weights it to fill and pads its start (leading) edge.
        // Why:      A 0..1 gain control filling the row after the label.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // <Slider
        //   value={volume}
        //   onValueChange={onVolume}
        //   min={0}
        //   max={1}
        //   modifier={Modifier.weight(1).padding({ start: dp(8) })}
        // />
        // ```
        Slider(
            value = volume,
            onValueChange = onVolume,
            valueRange = 0.0f..1.0f,
            modifier = Modifier
                .weight(1.0f)
                .padding(start = 8.dp),
        )
    }
}

// What:     `@OptIn(ExperimentalLayoutApi::class)` is an ANNOTATION acknowledging the use
//           of an EXPERIMENTAL API (`FlowRow`). `ExperimentalLayoutApi::class` is a CLASS
//           REFERENCE (`::class` names the class as a value); without the opt-in the
//           compiler refuses the experimental `FlowRow`.
// Why:      `controlRow` uses `FlowRow`, which is marked experimental.
//
// In TS you'd write (pseudocode):
// ```ts
// // @OptIn(ExperimentalLayoutApi) — acknowledge experimental FlowRow
// ```
@OptIn(ExperimentalLayoutApi::class)
// What:     `@Composable` marks the next function as a Compose component.
// Why:      `controlRow` is a UI component.
//
// In TS you'd write (pseudocode):
// ```ts
// // (component function)
// ```
@Composable
// What:     `private fun controlRow(...)` declares a private composable taking the UI
//           snapshot, controller, Settings callback, and Open callback.
// Why:      Wrapping control row, in the desktop's order: Settings, Open, the
//           three-state shuffle radios, the transport buttons, and repeat-track.
//
// In TS you'd write (pseudocode):
// ```ts
// function controlRow(props: { state: PlayerUiState; controller: PlayerController; onOpen: () => void; }) { ... }
// ```
/**
 * Defines control row behavior for this music-player component; the TypeScript-oriented notes above explain its
 * call shape and effects.
 */
private fun controlRow(
    state: PlayerUiState,
    controller: PlayerController,
    onSettings: () -> Unit,
    onOpen: () -> Unit,
) {
    // What:     `FlowRow( horizontalArrangement = Arrangement.spacedBy(16.dp), verticalArrangement =
    //           Arrangement.spacedBy(8.dp), ) { ... }`
    //           lays children left-to-right, WRAPPING to new lines on overflow, with 16dp
    //           horizontal and 8dp vertical gaps.
    // Why:      The controls wrap gracefully on narrow screens.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // <FlowRow
    //   horizontalArrangement={Arrangement.spacedBy(dp(16))}
    //   verticalArrangement={Arrangement.spacedBy(dp(8))}
    // > ... </FlowRow>
    // ```
    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        // What:     `Button(onClick = onSettings)` renders Settings immediately before Open.
        // Why:      Open the page-control preference screen from the main controls.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // <Button onClick={onSettings}>Settings</Button>
        // ```
        Button(onClick = onSettings) { Text("Settings") }
        // What:     `Button(onClick = onOpen) { Text("Open") }` renders the Open button; its
        //           trailing lambda `{ Text("Open") }` is the button's CONTENT (label).
        // Why:      Launch the folder picker.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // <Button onClick={onOpen}><Text>Open</Text></Button>
        // ```
        Button(onClick = onOpen) { Text("Open") }
        // What:     `Row(verticalAlignment = Alignment.CenterVertically) { ... }` groups the
        //           shuffle label and its three radios.
        // Why:      Keep "Shuffle" and its options together.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // <Row verticalAlignment={Alignment.CenterVertically}> ... </Row>
        // ```
        Row(verticalAlignment = Alignment.CenterVertically) {
            // What:     `Text("Shuffle")` labels the shuffle group.
            // Why:      Name the radios.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // <Text>Shuffle</Text>
            // ```
            Text("Shuffle")
            // What:     `radioOption("Off", state.shuffle == ShuffleMode.OFF) {
            //           controller.setShuffle(ShuffleMode.OFF) }`
            //           renders the "Off" radio. The second arg `state.shuffle == ShuffleMode.OFF`
            //           is its selected `Boolean` (enum value equality); the trailing lambda is
            //           its `onSelect` action setting the mode to `OFF`.
            // Why:      Let the user turn shuffle off.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // <radioOption label="Off" selected={state.shuffle === ShuffleMode.OFF} onSelect={() =>
            // controller.setShuffle(ShuffleMode.OFF)}/>
            // ```
            radioOption("Off", state.shuffle == ShuffleMode.OFF) { controller.setShuffle(ShuffleMode.OFF) }
            // What:     `radioOption("Within page", state.shuffle == ShuffleMode.WITHIN_PAGE) {
            //           controller.setShuffle(ShuffleMode.WITHIN_PAGE) }`
            //           renders the "Within page" radio (selected when the mode is
            //           `WITHIN_PAGE`; its action sets that mode).
            // Why:      Let the user shuffle within the current page only.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // <radioOption label="Within page" selected={state.shuffle === ShuffleMode.WITHIN_PAGE} onSelect={() =>
            // controller.setShuffle(ShuffleMode.WITHIN_PAGE)}/>
            // ```
            radioOption("Within page", state.shuffle == ShuffleMode.WITHIN_PAGE) {
                controller.setShuffle(ShuffleMode.WITHIN_PAGE)
            }
            // What:     `radioOption("All", state.shuffle == ShuffleMode.ALL) {
            //           controller.setShuffle(ShuffleMode.ALL) }`
            //           renders the "All" radio (selected when the mode is `ALL`; its action
            //           sets that mode).
            // Why:      Let the user shuffle the whole queue.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // <radioOption label="All" selected={state.shuffle === ShuffleMode.ALL} onSelect={() =>
            // controller.setShuffle(ShuffleMode.ALL)}/>
            // ```
            radioOption("All", state.shuffle == ShuffleMode.ALL) { controller.setShuffle(ShuffleMode.ALL) }
        }
        // What:     `Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement =
        //           Arrangement.spacedBy(8.dp)) { ... }`
        //           groups the transport buttons with 8dp gaps.
        // Why:      Keep Prev/Play/Next together.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // <Row verticalAlignment={Alignment.CenterVertically} horizontalArrangement={Arrangement.spacedBy(dp(8))}> ...
        // </Row>
        // ```
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            // What:     `Button(onClick = { controller.prev() }) { Text("Prev") }` renders the
            //           Prev button; the `onClick` lambda calls `controller.prev()`; the trailing
            //           lambda is the label.
            // Why:      Skip to the previous track.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // <Button onClick={() => controller.prev()}><Text>Prev</Text></Button>
            // ```
            Button(onClick = { controller.prev() }) { Text("Prev") }
            // What:     `Button(onClick = { controller.togglePlay() }) { Text(if (state.playing) "Pause" else "Play")
            //           }`
            //           renders the play/pause button. The content `Text(...)` takes an
            //           `if/else` EXPRESSION choosing the label "Pause" vs "Play" from
            //           `state.playing`.
            // Why:      Toggle play/pause, showing the matching label.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // <Button onClick={() => controller.togglePlay()}>
            //   <Text>{state.playing ? "Pause" : "Play"}</Text>
            // </Button>
            // ```
            Button(onClick = { controller.togglePlay() }) { Text(if (state.playing) "Pause" else "Play") }
            // What:     `Button(onClick = { controller.next() }) { Text("Next") }` renders the
            //           Next button.
            // Why:      Skip to the next track.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // <Button onClick={() => controller.next()}><Text>Next</Text></Button>
            // ```
            Button(onClick = { controller.next() }) { Text("Next") }
        }
        // What:     `Row(verticalAlignment = Alignment.CenterVertically) { ... }` groups the
        //           repeat-track checkbox and its label.
        // Why:      Keep the checkbox next to its text.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // <Row verticalAlignment={Alignment.CenterVertically}> ... </Row>
        // ```
        Row(verticalAlignment = Alignment.CenterVertically) {
            // What:     `Checkbox(checked = state.repeatTrack, onCheckedChange = { controller.setRepeatTrack(it) })`
            //           renders the repeat-track checkbox. `checked` is the current flag;
            //           `onCheckedChange`'s lambda uses `it` (the new `Boolean`).
            // Why:      Toggle "repeat track".
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // <Checkbox checked={state.repeatTrack} onCheckedChange={(on) => controller.setRepeatTrack(on)}/>
            // ```
            Checkbox(checked = state.repeatTrack, onCheckedChange = { controller.setRepeatTrack(it) })
            // What:     `Text("Repeat track")` labels the checkbox.
            // Why:      Name the toggle.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // <Text>Repeat track</Text>
            // ```
            Text("Repeat track")
        }
    }
}

// What:     `@Composable` marks the next function as a Compose component.
// Why:      `radioOption` is a UI component.
//
// In TS you'd write (pseudocode):
// ```ts
// // (component function)
// ```
@Composable
// What:     `private fun radioOption(label: String, selected: Boolean, onSelect: () -> Unit) { ... }`
//           declares a private composable for one reusable radio option.
// Why:      Shuffle, settings, and page navigation share one accessible radio row.
//
// In TS you'd write (pseudocode):
// ```ts
// function radioOption(props: { label: string; selected: boolean; onSelect: () => void; }) { ... }
// ```
/**
 * Defines a reusable radio option; the TypeScript-oriented notes above explain
 * its call shape and effects.
 */
private fun radioOption(label: String, selected: Boolean, onSelect: () -> Unit) {
    // One 48dp row owns the selection semantics and action.
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .defaultMinSize(minHeight = 48.dp)
            .selectable(
                selected = selected,
                role = Role.RadioButton,
                onClick = onSelect,
            ),
    ) {
        // The indicator is display-only because the parent row owns the one action.
        RadioButton(selected = selected, onClick = null)
        Text(text = label, modifier = Modifier.padding(end = 8.dp))
    }
}

// What:     `settingsPage` is a weighted Column child showing every page-control
//           choice and a route back to the library.
// Why:      The Settings button needs a dedicated page where the preference is explicit.
//
// In TS you'd write (pseudocode):
// ```ts
// function SettingsPage(props: SettingsProps) { ... }
// ```
/** Displays page-control preferences in place of the music library. */
@Composable
private fun ColumnScope.settingsPage(
    style: PageControlStyle,
    onSelectStyle: (PageControlStyle) -> Unit,
    onBack: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .weight(1.0f, fill = true),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(text = "Page controls", style = MaterialTheme.typography.headlineSmall)
        Text("Choose how library pages are shown.")
        radioOption(
            label = "Radio controls",
            selected = style == PageControlStyle.RADIO,
            onSelect = { onSelectStyle(PageControlStyle.RADIO) },
        )
        radioOption(
            label = "Multi-row MD1 tabs",
            selected = style == PageControlStyle.MD1_TABS,
            onSelect = { onSelectStyle(PageControlStyle.MD1_TABS) },
        )
        radioOption(
            label = "Rounded buttons",
            selected = style == PageControlStyle.ROUNDED_BUTTONS,
            onSelect = { onSelectStyle(PageControlStyle.ROUNDED_BUTTONS) },
        )
        radioOption(
            label = "Segmented buttons",
            selected = style == PageControlStyle.SEGMENTED_BUTTONS,
            onSelect = { onSelectStyle(PageControlStyle.SEGMENTED_BUTTONS) },
        )
        radioOption(
            label = "Super fun LED segmented buttons",
            selected = style == PageControlStyle.LED_SEGMENTED_BUTTONS,
            onSelect = { onSelectStyle(PageControlStyle.LED_SEGMENTED_BUTTONS) },
        )
        radioOption(
            label = "Chromium-like tabs",
            selected = style == PageControlStyle.CHROMIUM_TABS,
            onSelect = { onSelectStyle(PageControlStyle.CHROMIUM_TABS) },
        )
        Button(onClick = onBack) { Text("Back to library") }
    }
}

// What:     `md1PageTab` renders a flat text tab with a selected underline.
// Why:      This recreates the Material Design 1 tab visual while FlowRow supplies
//           the requested multi-row layout.
//
// In TS you'd write (pseudocode):
// ```ts
// function Md1PageTab(props: TabProps) { ... }
// ```
/** Displays one flat Material Design 1 page tab. */
@Composable
private fun md1PageTab(label: String, selected: Boolean, onSelect: () -> Unit) {
    /** Holds the selected underline color, or transparent for an inactive tab. */
    val indicatorColor: Color = if (selected) MaterialTheme.colorScheme.primary else Color.Transparent
    /** Holds accent text for the active tab and regular surface text otherwise. */
    val labelColor: Color = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .width(IntrinsicSize.Max)
            .defaultMinSize(minHeight = 48.dp)
            .clickable { onSelect() },
    ) {
        Text(
            text = label,
            color = labelColor,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 12.dp),
        )
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(2.dp)
                .background(indicatorColor),
        )
    }
}

// What:     `ChromiumTabColors` groups accent tint and neutral tab colors.
// Why:      Active tab follows theme accent while inactive decoration stays neutral.
//
// In TS you'd write (pseudocode):
// ```ts
// type ChromiumTabColors = {
//   active: Color;
//   activeOutline: Color;
//   divider: Color;
//   ink: Color;
// };
// ```
/** Holds colors used by Chromium-like page tabs. */
private data class ChromiumTabColors(
    /** Fills selected tab with translucent accent tint. */
    val active: Color,
    /** Draws stronger accent contour around selected tab. */
    val activeOutline: Color,
    /** Draws neutral inactive baselines and separators. */
    val divider: Color,
    /** Draws tab labels. */
    val ink: Color,
)

// What:     `chromiumTabColors` derives active tint from Material theme accent.
// Why:      Selected tab follows user theme without painting inactive backgrounds.
//
// In TS you'd write (pseudocode):
// ```ts
// function chromiumTabColors(): ChromiumTabColors { ... }
// ```
/** Stores active Chromium surface alpha. */
private const val CHROMIUM_ACTIVE_ALPHA: Float = 0.20f

/** Stores active Chromium contour alpha. */
private const val CHROMIUM_ACTIVE_OUTLINE_ALPHA: Float = 0.65f

/** Stores inactive Chromium divider alpha. */
private const val CHROMIUM_DIVIDER_ALPHA: Float = 0.25f

/** Returns accent-tinted Chromium-like tab colors. */
@Composable
private fun chromiumTabColors(): ChromiumTabColors = ChromiumTabColors(
    active = MaterialTheme.colorScheme.primary.withOklchAlpha(CHROMIUM_ACTIVE_ALPHA),
    activeOutline = MaterialTheme.colorScheme.primary.withOklchAlpha(CHROMIUM_ACTIVE_OUTLINE_ALPHA),
    divider = MaterialTheme.colorScheme.onBackground.withOklchAlpha(CHROMIUM_DIVIDER_ALPHA),
    ink = MaterialTheme.colorScheme.onBackground,
)

/**
 * What:     `chromiumTabVisibleHeight` stores Android's 48dp visible-control minimum.
 * Why:      Chromium styling must remain visibly touchable rather than adding transparent hit padding.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * const chromiumTabVisibleHeight = dp(48);
 * ```
 */
private val chromiumTabVisibleHeight: Dp = 48.dp

/**
 * What:     `chromiumTabStripInset` stores Chromium's 6dp space above the visible contour.
 * Why:      Enlarging the Android face must preserve the source strip-to-tab relationship.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * const chromiumTabStripInset = dp(6);
 * ```
 */
private val chromiumTabStripInset: Dp = 6.dp

/**
 * What:     `chromiumTabShoulder` scales Chromium's 12-of-35 shoulder ratio to visible height.
 * Why:      Enlarged Android tabs retain Chromium's contour proportions and matching edge gutters.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * const chromiumTabShoulder = chromiumTabVisibleHeight * 12 / 35;
 * ```
 */
private val chromiumTabShoulder: Dp = chromiumTabVisibleHeight * 12f / 35f

/**
 * What:     `chromiumTabPath` traces an open path around Chromium's rounded top and
 *           outward feet. `Size` supplies body bounds while `shoulder` supplies pixel reach.
 * Why:      Open contour fills across its baseline but leaves the stroked baseline absent,
 *           matching Chromium while both feet paint outside content and touch bounds.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function chromiumTabPath(size: Size, shoulder: number): Path { ... }
 * ```
 *
 * @param size Content-body width and logical tab height in pixels.
 * @param shoulder Foot reach beyond each body edge in pixels.
 * @return Open fill-and-outline contour for one active tab.
 */
private fun chromiumTabPath(size: Size, shoulder: Float): Path {
    /** Holds Chromium's 10dp upper corner relative to 35dp tab height. */
    val radius: Float = size.height * 10f / 35f
    /** Owns mutable contour commands returned after construction. */
    val path: Path = Path()
    path.moveTo(-shoulder, size.height)
    path.cubicTo(
        -shoulder / 2f,
        size.height,
        0f,
        size.height - shoulder / 2f,
        0f,
        size.height - shoulder,
    )
    path.lineTo(0f, radius)
    path.cubicTo(0f, radius / 2f, radius / 2f, 0f, radius, 0f)
    path.lineTo(size.width - radius, 0f)
    path.cubicTo(size.width - radius / 2f, 0f, size.width, radius / 2f, size.width, radius)
    path.lineTo(size.width, size.height - shoulder)
    path.cubicTo(
        size.width,
        size.height - shoulder / 2f,
        size.width + shoulder / 2f,
        size.height,
        size.width + shoulder,
        size.height,
    )
    return path
}

/**
 * What:     `chromiumActiveTabBackground` extends `Modifier` with overflowing custom paint.
 * Why:      Draw phase may exceed layout bounds, so active feet protrude without changing
 *           content width, FlowRow wrapping, semantics, or hit targets.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function chromiumActiveTabBackground(modifier: Modifier, colors: Colors): Modifier { ... }
 * ```
 *
 * @param colors Accent-derived active fill and outline colors.
 * @return Modifier that paints active silhouette before tab content.
 */
private fun Modifier.chromiumActiveTabBackground(colors: ChromiumTabColors): Modifier = drawBehind {
    /** Converts logical shoulder reach to current screen-density pixels. */
    val shoulder: Float = chromiumTabShoulder.toPx()
    /** Builds body-aligned contour with one shoulder outside each horizontal edge. */
    val path: Path = chromiumTabPath(size = size, shoulder = shoulder)
    drawPath(path = path, color = colors.active)
    drawPath(
        path = path,
        color = colors.activeOutline,
        style = Stroke(width = 1.dp.toPx()),
    )
}

// What:     `ChromiumPageTabOptions` groups inputs for one browser-style tab.
// Why:      Tab function receives one named options boundary instead of positional values.
//
// In TS you'd write (pseudocode):
// ```ts
// type ChromiumPageTabOptions = {
//   label: string;
//   selected: boolean;
//   showDivider: boolean;
//   maximumWidth: Dp;
//   onSelect: () => void;
// };
// ```
/** Holds rendering state and selection behavior for one Chromium-like tab. */
private data class ChromiumPageTabOptions(
    /** Holds one-line page label. */
    val label: String,
    /** Records whether this page is visible. */
    val selected: Boolean,
    /** Records whether this inactive tab needs a trailing separator. */
    val showDivider: Boolean,
    /** Caps pathological labels to available pager width. */
    val maximumWidth: Dp,
    /** Selects this page when invoked. */
    val onSelect: () -> Unit,
)

// What:     `ChromiumPageTabPresentation` groups state with measured colors.
// Why:      Extracted tab decoration receives one named rendering boundary.
//
// In TS you'd write (pseudocode):
// ```ts
// type ChromiumPageTabPresentation = {
//   options: ChromiumPageTabOptions;
//   colors: ChromiumTabColors;
// };
// ```
/** Holds all values needed to paint Chromium tab contents. */
private data class ChromiumPageTabPresentation(
    /** Holds tab state and selection behavior. */
    val options: ChromiumPageTabOptions,
    /** Holds appearance-aware contour colors. */
    val colors: ChromiumTabColors,
)

// What:     `chromiumPageTabContent` paints label, baseline, and separator.
// Why:      Geometry and inner decoration remain independently readable and lint-sized.
//
// In TS you'd write (pseudocode):
// ```ts
// function ChromiumPageTabContent(presentation: ChromiumPageTabPresentation) { ... }
// ```
/** Paints inner decoration for one Chromium-like tab. */
@Composable
private fun BoxScope.chromiumPageTabContent(presentation: ChromiumPageTabPresentation) {
    /** Holds tab state for concise decoration bindings. */
    val options: ChromiumPageTabOptions = presentation.options
    /** Holds measured colors for concise decoration bindings. */
    val colors: ChromiumTabColors = presentation.colors
    Text(
        text = options.label,
        color = colors.ink,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
        style = MaterialTheme.typography.bodyMedium,
        modifier = Modifier.padding(horizontal = 20.dp),
    )
    if (options.selected) {
        Box(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .fillMaxWidth()
                .height(1.dp)
                .background(colors.active),
        )
    } else {
        Box(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .fillMaxWidth()
                .height(1.dp)
                .background(colors.divider),
        )
    }
    if (!options.selected && options.showDivider) {
        Box(
            modifier = Modifier
                .align(Alignment.CenterEnd)
                .width(2.dp)
                .height(16.dp)
                .background(colors.divider),
        )
    }
}

// What:     `chromiumPageTab` renders one measured browser-style tab.
// Why:      Selected page needs Chromium's outlined top contour and outward shoulders.
//
// In TS you'd write (pseudocode):
// ```ts
// function ChromiumPageTab(options: ChromiumPageTabOptions) { ... }
// ```
/** Displays one selectable Chromium-like page tab. */
@Composable
private fun chromiumPageTab(options: ChromiumPageTabOptions) {
    /** Holds measured dark or light Chromium colors. */
    val colors: ChromiumTabColors = chromiumTabColors()
    /** Paints active overflow while leaving inactive tabs on parent background. */
    val stateModifier: Modifier = if (options.selected) {
        Modifier.chromiumActiveTabBackground(colors)
    } else {
        Modifier
    }
    Box(
        modifier = Modifier
            // Makes both visible face and owned target meet Android's minimum size.
            .widthIn(min = chromiumTabVisibleHeight, max = options.maximumWidth)
            .width(IntrinsicSize.Max)
            .height(chromiumTabVisibleHeight + chromiumTabStripInset)
            // Keeps both overflowing feet above neighboring inactive baselines.
            .zIndex(if (options.selected) 1f else 0f)
            .selectable(
                selected = options.selected,
                role = Role.Tab,
                onClick = options.onSelect,
            ),
    ) {
        Box(
            contentAlignment = Alignment.CenterStart,
            modifier = Modifier
                // Places the visibly 48dp face after Chromium's source-derived strip inset.
                .align(Alignment.TopStart)
                .offset(y = chromiumTabStripInset)
                .fillMaxWidth()
                .height(chromiumTabVisibleHeight)
                .then(stateModifier),
        ) {
            chromiumPageTabContent(
                ChromiumPageTabPresentation(
                    options = options,
                    colors = colors,
                ),
            )
        }
    }
}

// What:     `segmentedPageButton` renders one content-width rectangular section.
// Why:      Adjacent sections form the joined control shown in the supplied reference.
//
// In TS you'd write (pseudocode):
// ```ts
// function SegmentedPageButton(props: SegmentProps) { ... }
// ```
/** Displays one selectable section inside a segmented page-control group. */
@Composable
private fun segmentedPageButton(label: String, selected: Boolean, onSelect: () -> Unit) {
    /** Holds selected or unselected segment fill. */
    val containerColor: Color = if (selected) {
        MaterialTheme.colorScheme.primary
    } else {
        MaterialTheme.colorScheme.surfaceVariant
    }
    /** Holds text color contrasting with this segment's fill. */
    val labelColor: Color = if (selected) {
        MaterialTheme.colorScheme.onPrimary
    } else {
        MaterialTheme.colorScheme.onSurfaceVariant
    }
    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier
            .defaultMinSize(minHeight = 48.dp)
            .background(containerColor)
            .border(0.5.dp, MaterialTheme.colorScheme.outline)
            .selectable(
                selected = selected,
                role = Role.RadioButton,
                onClick = onSelect,
            ),
    ) {
        Text(
            text = label,
            color = labelColor,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
        )
    }
}

// What:     `segmentedPageControls` renders content-width segments in one rounded frame.
// Why:      A separate overlay keeps the shared border visible over child backgrounds.
//
// In TS you'd write (pseudocode):
// ```ts
// function SegmentedPageControls(props: PageControlsProps) { ... }
// ```
/** Displays a wrapped, mutually exclusive segmented page-control group. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun segmentedPageControls(state: PlayerUiState, onSelectPage: (Int) -> Unit) {
    /** Holds the shared outer shape for clipping and border drawing. */
    val groupShape: RoundedCornerShape = RoundedCornerShape(12.dp)
    Box(
        modifier = Modifier
            .wrapContentWidth(align = Alignment.Start)
            .clip(groupShape),
    ) {
        FlowRow(modifier = Modifier.selectableGroup()) {
            state.pageLabels.forEachIndexed { page, label ->
                /** Records whether this page is currently visible. */
                val selected: Boolean = page == state.selectedPage
                segmentedPageButton(
                    label = label,
                    selected = selected,
                    onSelect = { onSelectPage(page) },
                )
            }
        }
        Box(
            modifier = Modifier
                .matchParentSize()
                .border(2.dp, MaterialTheme.colorScheme.outline, groupShape),
        )
    }
}

// What:     `@OptIn(ExperimentalLayoutApi::class)` acknowledges the experimental `FlowRow`
//           used by `pageTabs` (see the same annotation on `controlRow`).
// Why:      `pageTabs` uses `FlowRow`.
//
// In TS you'd write (pseudocode):
// ```ts
// // @OptIn(ExperimentalLayoutApi)
// ```
@OptIn(ExperimentalLayoutApi::class)
// What:     `@Composable` marks the next function as a Compose component.
// Why:      `pageTabs` is a UI component.
//
// In TS you'd write (pseudocode):
// ```ts
// // (component function)
// ```
@Composable
// What:     `private fun pageTabs(state: PlayerUiState, onSelectPage: (Int) -> Unit) { ... }`
//           declares a private composable taking the snapshot and an `(Int) -> Unit`
//           page-select callback.
// Why:      Page-tab grid: one button per page, the active page filled, the rest outlined.
//
// In TS you'd write (pseudocode):
// ```ts
// function pageTabs(props: { state: PlayerUiState; onSelectPage: (n: number) => void; }) { ... }
// ```
/**
 * Defines page tabs behavior for this music-player component; the TypeScript-oriented notes above explain its
 * call shape and effects.
 */
private fun pageTabs(
    state: PlayerUiState,
    pageControlStyle: PageControlStyle,
    onSelectPage: (Int) -> Unit,
) {
    // What:     `FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp)) { ... }` lays the
    //           tab buttons left-to-right, wrapping, with 4dp gaps.
    // Why:      A wrapping grid of page tabs.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // <FlowRow horizontalArrangement={Arrangement.spacedBy(dp(4))}> ... </FlowRow>
    // ```
    if (pageControlStyle == PageControlStyle.SEGMENTED_BUTTONS) {
        segmentedPageControls(state = state, onSelectPage = onSelectPage)
        return
    }
    if (pageControlStyle == PageControlStyle.LED_SEGMENTED_BUTTONS) {
        ledPageControls(LedPageControlsOptions(state = state, onSelectPage = onSelectPage))
        return
    }
    BoxWithConstraints {
        /** Holds pager width before entering nested FlowRow scope. */
        val pageMaximumWidth: Dp = maxWidth
        /** Reserves paint-only edge room for Chromium feet without spacing adjacent tab bodies. */
        val chromiumPaintGutter: Dp = if (pageControlStyle == PageControlStyle.CHROMIUM_TABS) {
            chromiumTabShoulder
        } else {
            0.dp
        }
        /** Caps tab bodies to width remaining inside optional paint gutters. */
        val pageContentMaximumWidth: Dp = pageMaximumWidth - chromiumPaintGutter * 2
        FlowRow(
            modifier = Modifier.padding(horizontal = chromiumPaintGutter),
            horizontalArrangement = Arrangement.spacedBy(
            if (
                pageControlStyle == PageControlStyle.MD1_TABS ||
                pageControlStyle == PageControlStyle.CHROMIUM_TABS
            ) {
                0.dp
            } else {
                4.dp
            },
        ),
    ) {
        // What:     `state.pageLabels.forEachIndexed { page, label -> ... }` iterates the page
        //           labels WITH their indices. `forEachIndexed { page, label -> ... }` is a
        //           trailing lambda whose two parameters are the index `page` (an `Int`) and the
        //           element `label` (a `String`), written before `->`.
        // Why:      Emit one tab button per page, knowing each page's index.
        // Gotcha:   Argument order is `(index, value)` here, flipped from JS `forEach`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // state.pageLabels.forEach((label, page) => { ... });
        // ```
        state.pageLabels.forEachIndexed { page, label ->
            // What:     `if (page == state.selectedPage) { Button(...) } else { OutlinedButton(...) }`
            //           branches on whether this tab is the active page (`==` integer equality):
            //           the active tab is a filled `Button`, the rest are `OutlinedButton`s. Each
            //           `onClick` lambda calls `onSelectPage(page)`; the trailing lambda is the
            //           label.
            // Why:      Visually mark the active page and make every tab selectable.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // if (page === state.selectedPage)
            //   return <Button onClick={() => onSelectPage(page)}><Text>{label}</Text></Button>;
            // return <OutlinedButton onClick={() => onSelectPage(page)}><Text>{label}</Text></OutlinedButton>;
            // ```
            /** Records whether this page is currently visible. */
            val selected: Boolean = page == state.selectedPage
            if (pageControlStyle == PageControlStyle.RADIO) {
                radioOption(label = label, selected = selected, onSelect = { onSelectPage(page) })
            } else if (pageControlStyle == PageControlStyle.MD1_TABS) {
                md1PageTab(label = label, selected = selected, onSelect = { onSelectPage(page) })
            } else if (pageControlStyle == PageControlStyle.CHROMIUM_TABS) {
                chromiumPageTab(
                    ChromiumPageTabOptions(
                        label = label,
                        selected = selected,
                        showDivider = page < state.pageLabels.lastIndex && page + 1 != state.selectedPage,
                        maximumWidth = pageContentMaximumWidth,
                        onSelect = { onSelectPage(page) },
                    ),
                )
            } else if (selected) {
                Button(onClick = { onSelectPage(page) }) { Text(label) }
            } else {
                OutlinedButton(onClick = { onSelectPage(page) }) { Text(label) }
            }
        }
    }
    }
}

// What:     `@Composable` marks the next function as a Compose component.
// Why:      `trackPager` is a UI component.
//
// In TS you'd write (pseudocode):
// ```ts
// // (component function)
// ```
@Composable
// What:     `private fun ColumnScope.trackPager(state: PlayerUiState, controller: PlayerController) { ... }`
//           declares a private composable that is an EXTENSION on `ColumnScope`: the
//           `ColumnScope.` receiver prefix means this function can only be called inside a
//           `Column`'s child block and may use column-only modifiers like `Modifier.weight`.
// Why:      The page tabs and the selected page's track rows in one shared scroll area,
//           matching the desktop's narrow (phone) layout: the page-tab bar scrolls together
//           with the tracks rather than sitting fixed above them. A wrapping tab bar over a
//           many-folder library (every top-level folder under the loaded root is its own
//           page) would otherwise consume the whole column and collapse a separate weighted
//           list to zero height, the "cannot scroll" failure. Folding the tabs into the same
//           `LazyColumn` as its first item lets a long tab bar and a long track list share
//           the available space and a single scroll gesture.
// Gotcha:   The `ColumnScope.` receiver is what grants `Modifier.weight(...)`; calling this
//           outside a `Column` would not compile.
//
// In TS you'd write (pseudocode):
// ```ts
// // must be rendered inside a <Column>; uses column-only weight()
// function trackPager(props: { state: PlayerUiState; controller: PlayerController; }) { ... }
// ```
/**
 * Defines track pager behavior for this music-player component; the TypeScript-oriented notes above explain its
 * call shape and effects.
 */
private fun ColumnScope.trackPager(
    state: PlayerUiState,
    controller: PlayerController,
    pageControlStyle: PageControlStyle,
) {
    // What:     `if (state.queueSize == 0) { ... }` checks for an empty queue (`==` integer
    //           equality).
    // Why:      An empty queue shows either a loading notice or a "no music" message, then
    //           nothing else.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (state.queueSize === 0) { ... }
    // ```
    if (state.queueSize == 0) {
        // What:     `if (state.loading) { loadingNotice() } else { Text("No music found in your audio library.") }`
        //           branches the empty-queue UI. (Folds in the old inline note: an empty queue
        //           means "no music" only once loading has finished; during a scan, a chosen
        //           folder can take seconds, show a loading notice instead of the
        //           failure-sounding message.)
        // Why:      Distinguish "still scanning" from "truly empty".
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (state.loading) return <loadingNotice/>;
        // return <Text>No music found in your audio library.</Text>;
        // ```
        if (state.loading) {
            // What:     `loadingNotice()` renders the spinner + loading line.
            // Why:      Show progress during a scan.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // <loadingNotice/>
            // ```
            loadingNotice()
        } else {
            // What:     `Text("No music found in your audio library.")` renders the empty
            //           message.
            // Why:      Tell the user no tracks were found once loading finished.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // <Text>No music found in your audio library.</Text>
            // ```
            Text("No music found in your audio library.")
        }
        // What:     `return` exits the composable early (nothing more to render for an empty
        //           queue). Bare `return`, `Unit`.
        // Why:      Skip the list when there are no tracks.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return;
        // ```
        return
    }
    // What:     `LazyColumn( modifier = Modifier.fillMaxWidth().weight(1.0f, fill = true), ) { ... }`
    //           renders the scrolling list. The modifier fills the width and uses
    //           `weight(1.0f, fill = true)` (a column-only modifier from the `ColumnScope`
    //           receiver) to take all remaining vertical space. `1.0f` is a `Float` weight;
    //           `fill = true` is a named argument.
    // Why:      One scroll area sharing the available height for tabs + tracks.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // <LazyColumn modifier={Modifier.fillMaxWidth().weight(1, { fill: true })}> ... </LazyColumn>
    // ```
    LazyColumn(
        modifier = Modifier
            .fillMaxWidth()
            .weight(1.0f, fill = true),
    ) {
        // What:     `if (state.pageLabels.isNotEmpty()) { ... }` adds the tab bar only when
        //           there are pages. `isNotEmpty()` is the list "has elements" predicate.
        //           (Folds in the old inline note: the tab bar is the first scrolling item, so
        //           it scrolls away with the list, not pinned; this is the desktop's
        //           shared-scrollbar narrow behavior.)
        // Why:      Don't emit an empty tab bar.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (state.pageLabels.length > 0) { ... }
        // ```
        if (state.pageLabels.isNotEmpty()) {
            // What:     `item { pageTabs(state = state, onSelectPage = { controller.selectPage(it) }) }`
            //           emits ONE list item (`item { ... }` is the `LazyListScope` builder for a
            //           single row) holding the `pageTabs`. Its `onSelectPage` lambda uses `it`
            //           (the chosen page index).
            // Why:      Make the tab bar the first scrolling row.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // item(() => (
            //   <pageTabs state={state} onSelectPage={(p) => controller.selectPage(p)}/>
            // ));
            // ```
            item {
                // What:     `pageTabs(state = state, onSelectPage = { controller.selectPage(it) })`
                //           renders the tab bar; `it` is the page index passed to `selectPage`.
                // Why:      Show the page tabs.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // <pageTabs state={state} onSelectPage={(p) => controller.selectPage(p)}/>
                // ```
                pageTabs(
                    state = state,
                    pageControlStyle = pageControlStyle,
                    onSelectPage = { controller.selectPage(it) },
                )
            }
        }
        // What:     `items(state.pageItems) { item -> ... }` emits one list row per element of
        //           `state.pageItems`. `items(list) { item -> ... }` is the `LazyListScope`
        //           builder; the trailing lambda's `item` parameter is one `PageEntry`.
        // Why:      Render the visible page's tracks as scrolling rows.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // items(state.pageItems, (item) => (
        //   <trackRow item={item} state={state} controller={controller}/>
        // ));
        // ```
        items(state.pageItems) { item ->
            // What:     `trackRow(item = item, state = state, controller = controller)` renders
            //           one track row from the page entry.
            // Why:      Show and drive a single track row.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // <trackRow item={item} state={state} controller={controller}/>
            // ```
            trackRow(item = item, state = state, controller = controller)
        }
    }
}

// What:     `@Composable` marks the next function as a Compose component.
// Why:      `trackRow` is a UI component.
//
// In TS you'd write (pseudocode):
// ```ts
// // (component function)
// ```
@Composable
// What:     `private fun trackRow(item: PageEntry, state: PlayerUiState, controller: PlayerController) { ... }`
//           declares a private composable for one track row, taking the entry, the snapshot,
//           and the brain.
// Why:      One track row: its path relative to the loaded root, highlighted when it is the
//           current track. Tap a row to play it; tap the current row to toggle play/pause.
//
// In TS you'd write (pseudocode):
// ```ts
// function trackRow(props: { item: PageEntry; state: PlayerUiState; controller: PlayerController; }) { ... }
// ```
/**
 * Defines track row behavior for this music-player component; the TypeScript-oriented notes above explain its
 * call shape and effects.
 */
private fun trackRow(item: PageEntry, state: PlayerUiState, controller: PlayerController) {
    // What:     `val isCurrent = item.index == state.currentIndex` declares a `Boolean`
    //           `isCurrent` comparing this row's load-order `index` (an `Int`) to the
    //           snapshot's `currentIndex` (an `Int?`). `==` is null-safe value equality (a
    //           null `currentIndex` simply is not equal).
    // Why:      Decide whether to highlight this row as the playing track.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const isCurrent = item.index === state.currentIndex;
    // ```
    /**
     * Defines is current value for this music-player component; the TypeScript-oriented notes above explain its
     * source and use.
     */
    val isCurrent = item.index == state.currentIndex
    // What:     `val rowBackground = if (isCurrent) MaterialTheme.colorScheme.primary else Color.Transparent`
    //           picks the row background from an `if/else` EXPRESSION: the theme primary when
    //           current, otherwise transparent.
    // Why:      Visually mark the current track.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const rowBackground = isCurrent ? MaterialTheme.colorScheme.primary : Color.Transparent;
    // ```
    /**
     * Defines row background value for this music-player component; the TypeScript-oriented notes above explain
     * its source and use.
     */
    val rowBackground = if (isCurrent) MaterialTheme.colorScheme.primary else Color.Transparent
    // What:     `val rowColor = if (isCurrent) { MaterialTheme.colorScheme.onPrimary } else {
    //           MaterialTheme.colorScheme.onSurface }`
    //           picks the text color from an `if/else` EXPRESSION: the on-primary color when
    //           current (readable on the highlight), otherwise the on-surface color.
    // Why:      Keep the text readable against whichever background is used.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const rowColor = isCurrent
    //   ? MaterialTheme.colorScheme.onPrimary
    //   : MaterialTheme.colorScheme.onSurface;
    // ```
    /**
     * Defines row color value for this music-player component; the TypeScript-oriented notes above explain its
     * source and use.
     */
    val rowColor = if (isCurrent) {
        // What:     `MaterialTheme.colorScheme.onPrimary` is the `then`-branch value: the color
        //           meant to sit on top of the primary color.
        // Why:      Readable text over the highlighted background.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // MaterialTheme.colorScheme.onPrimary
        // ```
        MaterialTheme.colorScheme.onPrimary
    } else {
        // What:     `MaterialTheme.colorScheme.onSurface` is the `else`-branch value: the color
        //           meant to sit on top of the default surface.
        // Why:      Readable text over the transparent (surface) background.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // MaterialTheme.colorScheme.onSurface
        // ```
        MaterialTheme.colorScheme.onSurface
    }
    // What:     `val rowLabel: String = state.pageLabels.getOrNull(state.selectedPage).orEmpty()`
    //           declares a read-only `String` holding the ACTIVE tab's caption.
    //           `getOrNull(i)` returns the label or `null` for an out-of-range index (no
    //           throw); `.orEmpty()` turns a `null` into the empty string `""`.
    // Why:      `rowDisplay` needs the current page's folder label to know which prefix to trim
    //           from this row; `state.pageItems` are exactly that page's entries.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const rowLabel = state.pageLabels[state.selectedPage] ?? "";
    // ```
    /**
     * Defines row label value for this music-player component; the TypeScript-oriented notes above explain its
     * source and use.
     */
    val rowLabel: String = state.pageLabels.getOrNull(state.selectedPage).orEmpty()
    // What:     `val rowText: String = rowDisplay(rowLabel, item.name)` declares a read-only
    //           `String`: the text to SHOW. `rowDisplay` strips the `<rowLabel>/` folder prefix
    //           on folder tabs, or returns the whole name on letter / `#` tabs (see
    //           `Pagination.kt`).
    // Why:      A folder tab already names its folder, so the row shows only the path below it.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const rowText = rowDisplay(rowLabel, item.name);
    // ```
    /**
     * Defines row text value for this music-player component; the TypeScript-oriented notes above explain its
     * source and use.
     */
    val rowText: String = rowDisplay(rowLabel, item.name)
    // What:     `Text( text = rowText, color = rowColor, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier =
    //           Modifier.fillMaxWidth().background(rowBackground).clickable { ... }.padding(horizontal = 8.dp, vertical
    //           = 8.dp), )`
    //           renders the row as a single `Text`. Named args: `text` is the trimmed display
    //           name (`rowText`); `color` is `rowColor`; `maxLines = 1` and
    //           `overflow = TextOverflow.Ellipsis` clip long names with an ellipsis. The
    //           `modifier` chain fills the width, paints `rowBackground`, makes the row
    //           `clickable { ... }` (the trailing lambda is the tap handler), then pads it.
    // Why:      Show the track name (folder-tab prefix trimmed), highlight it when current, and
    //           handle taps.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // <Text
    //   color={rowColor}
    //   maxLines={1}
    //   overflow={TextOverflow.Ellipsis}
    //   modifier={Modifier.fillMaxWidth().background(rowBackground).clickable(onTap).padding({ horizontal: dp(8),
    //   vertical: dp(8) })}
    // >{rowText}</Text>
    // ```
    Text(
        text = rowText,
        color = rowColor,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
        modifier = Modifier
            .fillMaxWidth()
            .background(rowBackground)
            .clickable {
                // What:     `Log.i(LOG_TAG, "tap row ${item.index} (current=${state.currentIndex})")`
                //           logs the tap with this row's index and the current index.
                // Why:      Trace row taps for verification.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // console.info(`[${LOG_TAG}] tap row ${item.index} (current=${state.currentIndex})`);
                // ```
                Log.i(LOG_TAG, "tap row ${item.index} (current=${state.currentIndex})")
                // What:     `if (item.index == state.currentIndex) { controller.togglePlay() } else {
                //           controller.playIndex(item.index) }`
                //           branches the tap: tapping the CURRENT row toggles play/pause; tapping
                //           another row plays that track. `==` is null-safe value equality.
                // Why:      Tap-to-play, with the current row acting as play/pause.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // if (item.index === state.currentIndex) controller.togglePlay();
                // else controller.playIndex(item.index);
                // ```
                if (item.index == state.currentIndex) {
                    // What:     `controller.togglePlay()` toggles play/pause on the current track.
                    // Why:      Tapping the playing row pauses/resumes it.
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // controller.togglePlay();
                    // ```
                    controller.togglePlay()
                } else {
                    // What:     `controller.playIndex(item.index)` plays the tapped (non-current)
                    //           track by its load-order index.
                    // Why:      Tapping another row starts that track.
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // controller.playIndex(item.index);
                    // ```
                    controller.playIndex(item.index)
                }
            }
            .padding(horizontal = 8.dp, vertical = 8.dp),
    )
}

// What:     `@Composable` marks the next function as a Compose component.
// Why:      `loadingNotice` is a UI component.
//
// In TS you'd write (pseudocode):
// ```ts
// // (component function)
// ```
@Composable
// What:     `private fun loadingNotice() { ... }` declares a private no-arg composable.
// Why:      Shown while a library load or folder scan runs: a spinner and a short loading
//           line.
//
// In TS you'd write (pseudocode):
// ```ts
// function loadingNotice() { ... }
// ```
/**
 * Defines loading notice behavior for this music-player component; the TypeScript-oriented notes above explain
 * its call shape and effects.
 */
private fun loadingNotice() {
    // What:     `Row( verticalAlignment = Alignment.CenterVertically, horizontalArrangement =
    //           Arrangement.spacedBy(12.dp), modifier = Modifier.padding(vertical = 12.dp), ) { ... }`
    //           lays the spinner and text on one centered line, 12dp apart, with vertical
    //           padding.
    // Why:      Put the spinner next to its label.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // <Row
    //   verticalAlignment={Alignment.CenterVertically}
    //   horizontalArrangement={Arrangement.spacedBy(dp(12))}
    //   modifier={Modifier.padding({ vertical: dp(12) })}
    // > ... </Row>
    // ```
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        modifier = Modifier.padding(vertical = 12.dp),
    ) {
        // What:     `CircularProgressIndicator(modifier = Modifier.size(20.dp))` renders a 20dp
        //           spinner.
        // Why:      Show indeterminate progress.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // <CircularProgressIndicator modifier={Modifier.size(dp(20))}/>
        // ```
        CircularProgressIndicator(modifier = Modifier.size(20.dp))
        // What:     `Text("Loading your library…")` shows the loading line.
        // Why:      Tell the user the library is loading.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // <Text>Loading your library…</Text>
        // ```
        Text("Loading your library…")
    }
}

// What:     `private fun formatTime(seconds: Double): String { ... }` declares a private
//           helper taking a `Double` seconds value and returning a `String`, block body.
//           This is a PLAIN function (no `@Composable`): pure formatting, no UI.
// Why:      Format a seconds value as `m:ss` (e.g. `3:07`).
//
// In TS you'd write (pseudocode):
// ```ts
// function formatTime(seconds: number): string { ... }
// ```
/**
 * Defines format time behavior for this music-player component; the TypeScript-oriented notes above explain its
 * call shape and effects.
 */
private fun formatTime(seconds: Double): String {
    // What:     `val total = seconds.toInt()` declares `total` (inferred `Int`) by converting
    //           the `Double` to an `Int` with `.toInt()`, which TRUNCATES toward zero (drops
    //           the fraction).
    // Why:      Work in whole seconds for the `m:ss` split.
    // Gotcha:   `.toInt()` truncates (does not round); `3.9` becomes `3`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const total = Math.trunc(seconds);
    // ```
    /**
     * Defines total value for this music-player component; the TypeScript-oriented notes above explain its
     * source and use.
     */
    val total = seconds.toInt()
    // What:     `val minutes = total / SECONDS_PER_MINUTE` declares `minutes` (inferred `Int`)
    //           via INTEGER DIVISION: `Int / Int` discards the remainder (so `127 / 60` is
    //           `2`).
    // Why:      The minutes part of `m:ss`.
    // Gotcha:   Kotlin `Int / Int` is INTEGER division (truncates); JS `/` is always float, so
    //           the TS equivalent needs `Math.trunc`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const minutes = Math.trunc(total / SECONDS_PER_MINUTE);
    // ```
    /**
     * Defines minutes value for this music-player component; the TypeScript-oriented notes above explain its
     * source and use.
     */
    val minutes = total / SECONDS_PER_MINUTE
    // What:     `val secs = total % SECONDS_PER_MINUTE` declares `secs` (inferred `Int`) via
    //           the MODULO operator `%` (the remainder after dividing by 60).
    // Why:      The seconds part of `m:ss`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const secs = total % SECONDS_PER_MINUTE;
    // ```
    /**
     * Defines secs value for this music-player component; the TypeScript-oriented notes above explain its source
     * and use.
     */
    val secs = total % SECONDS_PER_MINUTE
    // What:     `return "%d:%02d".format(minutes, secs)` formats and returns the result.
    //           `"%d:%02d".format(...)` is a method ON the `String` literal: `%d` is an
    //           integer, `%02d` is an integer zero-padded to width 2 (so `7` becomes `07`).
    // Why:      Produce `m:ss` like `3:07`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return `${minutes}:${String(secs).padStart(2, "0")}`;
    // ```
    return "%d:%02d".format(minutes, secs)
}

// What:     `@Composable` marks the next function as a Compose component.
// Why:      `permissionGate` is a UI component.
//
// In TS you'd write (pseudocode):
// ```ts
// // (component function)
// ```
@Composable
// What:     `private fun permissionGate(onGrant: () -> Unit) { ... }` declares a private
//           composable taking an `onGrant` callback (`() -> Unit`).
// Why:      Shown until audio access is granted: a one-line rationale and a button that
//           re-requests the permission, so a user who declined the first prompt still has a
//           way back in.
//
// In TS you'd write (pseudocode):
// ```ts
// function permissionGate(props: { onGrant: () => void; }) { ... }
// ```
/**
 * Defines permission gate behavior for this music-player component; the TypeScript-oriented notes above explain
 * its call shape and effects.
 */
private fun permissionGate(onGrant: () -> Unit) {
    // What:     `Column( modifier = Modifier.fillMaxSize().padding(24.dp), verticalArrangement =
    //           Arrangement.spacedBy(12.dp, Alignment.CenterVertically), horizontalAlignment =
    //           Alignment.CenterHorizontally, ) { ... }`
    //           centers the rationale and button (same layout shape as `startingGate`).
    // Why:      Present the access rationale and grant button centered on screen.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // <Column
    //   modifier={Modifier.fillMaxSize().padding(dp(24))}
    //   verticalArrangement={Arrangement.spacedBy(dp(12), Alignment.CenterVertically)}
    //   horizontalAlignment={Alignment.CenterHorizontally}
    // > ... </Column>
    // ```
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        // What:     `Text("Music Player needs access to your audio library to list your music.")`
        //           shows the rationale.
        // Why:      Explain why access is needed.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // <Text>Music Player needs access to your audio library to list your music.</Text>
        // ```
        Text("Music Player needs access to your audio library to list your music.")
        // What:     `Button(onClick = onGrant) { Text("Grant access") }` renders the re-ask
        //           button; `onClick = onGrant` re-launches the permission request; the trailing
        //           lambda is the label.
        // Why:      Give a declined user a way to re-request access.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // <Button onClick={onGrant}><Text>Grant access</Text></Button>
        // ```
        Button(onClick = onGrant) { Text("Grant access") }
    }
}
