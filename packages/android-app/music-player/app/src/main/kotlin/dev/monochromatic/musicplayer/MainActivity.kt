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
//   - `AppRoot`: the audio-permission gate + library trigger over a bound
//     controller. Requests audio access once, shows `PermissionGate` until
//     granted, then signals the service to load and shows `PlayerScreen`.
//   - `PlayerScreen`: the desktop's narrow single-column layout (seek bar,
//     volume, control row, page tabs + track list). Tap a track to play; tap
//     the playing track to pause/resume.
//   - `StartingGate`/`LoadingNotice`/`PermissionGate`: small placeholder/notice
//     screens. `SeekRow`/`VolumeRow`/`ControlRow`/`ShuffleOption`/`PageTabs`/
//     `TrackPager`/`TrackRow`: the pieces of the player screen.
//   - `formatTime`: format a seconds value as `m:ss`.
// ============================================================================

// What:     `package dev.monochromatic.musicplayer` names the namespace everything in
//           this file lives in (the activity is referenced from the Android manifest by
//           `dev.monochromatic.musicplayer.MainActivity`).
// Why:      So the manifest and sibling files can refer to these declarations.
// TS map:   No 1:1 equivalent — TS module identity is the file path; no `package`.
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
// TS map:   `import { ComponentName } from "android/content";`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { ComponentName } from "android/content";
// ```
import android.content.ComponentName

// What:     `import android.content.Context` pulls in `Context`, Android's app
//           environment handle. We use its `BIND_AUTO_CREATE` flag.
// Why:      `bindService(...)` passes `Context.BIND_AUTO_CREATE`.
// TS map:   `import { Context } from "android/content";`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Context } from "android/content";
// ```
import android.content.Context

// What:     `import android.content.Intent` pulls in `Intent`, Android's "what to do"
//           message object used to start/bind components.
// Why:      We build an `Intent` to bind the service and use its grant flag.
// TS map:   `import { Intent } from "android/content";`.
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
// TS map:   `import { ServiceConnection } from "android/content";` — an interface type.
//
// In TS you'd write (pseudocode):
// ```ts
// import { ServiceConnection } from "android/content";
// ```
import android.content.ServiceConnection

// What:     `import android.net.Uri` pulls in `Uri`, Android's parsed URI type.
// Why:      The folder picker yields a tree `Uri`; `pendingRoot` holds one.
// TS map:   `import { Uri } from "android/net";`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Uri } from "android/net";
// ```
import android.net.Uri

// What:     `import android.os.Bundle` pulls in `Bundle`, Android's key/value state bag
//           passed to `onCreate` (for saved instance state).
// Why:      `onCreate(savedInstanceState: Bundle?)` takes one.
// TS map:   `import { Bundle } from "android/os";`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Bundle } from "android/os";
// ```
import android.os.Bundle

// What:     `import android.os.IBinder` pulls in `IBinder`, the interface a bound
//           service hands back; `onServiceConnected` receives one to cast.
// Why:      `onServiceConnected(..., service: IBinder?)` takes an `IBinder?`.
// TS map:   `import { IBinder } from "android/os";`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { IBinder } from "android/os";
// ```
import android.os.IBinder

// What:     `import android.util.Log` pulls in `Log`, Android's logger (`Log.i`).
// Why:      We log lifecycle and interaction events.
// TS map:   `import { Log } from "android/util";` — `Log.i` ~ `console.info` with a tag.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Log } from "android/util";
// ```
import android.util.Log

// What:     `import androidx.activity.ComponentActivity` pulls in `ComponentActivity`,
//           the modern Android base `Activity` class (Compose-friendly).
// Why:      `MainActivity` EXTENDS `ComponentActivity`.
// TS map:   `import { ComponentActivity } from "androidx/activity";` — a base class.
//
// In TS you'd write (pseudocode):
// ```ts
// import { ComponentActivity } from "androidx/activity";
// ```
import androidx.activity.ComponentActivity

// What:     `import androidx.activity.compose.rememberLauncherForActivityResult` pulls in
//           the Compose helper that registers an activity-result launcher INSIDE a
//           composition (the permission prompt below uses it).
// Why:      `AppRoot` requests the audio permission via this launcher.
// TS map:   `import { rememberLauncherForActivityResult } from "androidx/activity/compose";`
//           — a hook-like helper, think `useActivityResultLauncher(...)`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { rememberLauncherForActivityResult } from "androidx/activity/compose";
// ```
import androidx.activity.compose.rememberLauncherForActivityResult

// What:     `import androidx.activity.compose.setContent` pulls in `setContent`, the
//           bridge that sets an activity's UI to a Compose tree.
// Why:      `onCreate` calls `setContent { ... }` to mount the UI.
// TS map:   `import { setContent } from "androidx/activity/compose";` — like a
//           `ReactDOM.render(<App/>, root)` bridge.
//
// In TS you'd write (pseudocode):
// ```ts
// import { setContent } from "androidx/activity/compose";
// ```
import androidx.activity.compose.setContent

// What:     `import androidx.activity.enableEdgeToEdge` pulls in `enableEdgeToEdge()`,
//           which draws the app behind the system bars.
// Why:      `onCreate` calls it for the edge-to-edge layout.
// TS map:   `import { enableEdgeToEdge } from "androidx/activity";`.
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
// TS map:   `import { ActivityResultContracts } from "androidx/activity/result/contract";`
//           — a namespace of typed request/response descriptors.
//
// In TS you'd write (pseudocode):
// ```ts
// import { ActivityResultContracts } from "androidx/activity/result/contract";
// ```
import androidx.activity.result.contract.ActivityResultContracts

// What:     `import androidx.compose.foundation.background` pulls in the `background`
//           MODIFIER (a styling extension on `Modifier` that paints a color behind a
//           composable).
// Why:      `TrackRow` highlights the current row with `Modifier.background(...)`.
// TS map:   `import { background } from "androidx/compose/foundation";` — a style helper;
//           think a CSS `background-color` prop builder.
//
// In TS you'd write (pseudocode):
// ```ts
// import { background } from "androidx/compose/foundation";
// ```
import androidx.compose.foundation.background

// What:     `import androidx.compose.foundation.clickable` pulls in the `clickable`
//           MODIFIER (makes a composable respond to taps, taking an `onClick` lambda).
// Why:      `ShuffleOption` and `TrackRow` make whole rows tappable.
// TS map:   `import { clickable } from "androidx/compose/foundation";` — like an
//           `onClick` prop helper.
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
// TS map:   `import { isSystemInDarkTheme } from "androidx/compose/foundation";` — like a
//           `usePrefersDarkMode()` hook.
//
// In TS you'd write (pseudocode):
// ```ts
// import { isSystemInDarkTheme } from "androidx/compose/foundation";
// ```
import androidx.compose.foundation.isSystemInDarkTheme

// What:     `import androidx.compose.foundation.layout.Arrangement` pulls in
//           `Arrangement`, the namespace describing how children are spaced inside a
//           `Row`/`Column` (e.g. `Arrangement.spacedBy(8.dp)`).
// Why:      The layouts space their children with `Arrangement.spacedBy(...)`.
// TS map:   `import { Arrangement } from "androidx/compose/foundation/layout";` — like a
//           flexbox `gap`/`justify-content` helper.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Arrangement } from "androidx/compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.Arrangement

// What:     `import androidx.compose.foundation.layout.Column` pulls in `Column`, the
//           vertical layout composable (stacks children top to bottom).
// Why:      Several screens lay their content out in a `Column`.
// TS map:   `import { Column } from "androidx/compose/foundation/layout";` — a
//           `flex-direction: column` container.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Column } from "androidx/compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.Column

// What:     `import androidx.compose.foundation.layout.ColumnScope` pulls in
//           `ColumnScope`, the RECEIVER type for code running inside a `Column`'s
//           children block (it exposes column-only modifiers like `weight`).
// Why:      `TrackPager` is declared as an EXTENSION on `ColumnScope` so it can use
//           `Modifier.weight(...)`.
// TS map:   `import { ColumnScope } from "androidx/compose/foundation/layout";` — a
//           "this is inside a Column" capability marker; no direct TS analogue.
//
// In TS you'd write (pseudocode):
// ```ts
// import { ColumnScope } from "androidx/compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.ColumnScope

// What:     `import androidx.compose.foundation.layout.ExperimentalLayoutApi` pulls in the
//           `ExperimentalLayoutApi` annotation marking unstable layout APIs (`FlowRow`).
// Why:      `@OptIn(ExperimentalLayoutApi::class)` references it where `FlowRow` is used.
// TS map:   No equivalent; a marker that an API is experimental and must be opted into.
//
// In TS you'd write (pseudocode):
// ```ts
// import { ExperimentalLayoutApi } from "androidx/compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.ExperimentalLayoutApi

// What:     `import androidx.compose.foundation.layout.FlowRow` pulls in `FlowRow`, a row
//           that WRAPS its children onto new lines when they overflow.
// Why:      The control row and page-tab grid wrap with `FlowRow`.
// TS map:   `import { FlowRow } from "androidx/compose/foundation/layout";` — `flex-wrap: wrap`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { FlowRow } from "androidx/compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.FlowRow

// What:     `import androidx.compose.foundation.layout.Row` pulls in `Row`, the horizontal
//           layout composable (places children left to right).
// Why:      Many UI pieces lay out horizontally in a `Row`.
// TS map:   `import { Row } from "androidx/compose/foundation/layout";` — `flex-direction: row`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Row } from "androidx/compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.Row

// What:     `import androidx.compose.foundation.layout.fillMaxSize` pulls in the
//           `fillMaxSize` MODIFIER (make a composable occupy all available width AND
//           height).
// Why:      The full-screen surfaces/columns use `Modifier.fillMaxSize()`.
// TS map:   `import { fillMaxSize } from "androidx/compose/foundation/layout";` — like
//           `width: 100%; height: 100%`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { fillMaxSize } from "androidx/compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.fillMaxSize

// What:     `import androidx.compose.foundation.layout.fillMaxWidth` pulls in the
//           `fillMaxWidth` MODIFIER (occupy all available width).
// Why:      Rows and the track list use `Modifier.fillMaxWidth()`.
// TS map:   `import { fillMaxWidth } from "androidx/compose/foundation/layout";` — `width: 100%`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { fillMaxWidth } from "androidx/compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.fillMaxWidth

// What:     `import androidx.compose.foundation.layout.padding` pulls in the `padding`
//           MODIFIER (inner spacing around a composable).
// Why:      Most layouts pad their contents with `Modifier.padding(...)`.
// TS map:   `import { padding } from "androidx/compose/foundation/layout";` — CSS `padding`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { padding } from "androidx/compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.padding

// What:     `import androidx.compose.foundation.layout.size` pulls in the `size` MODIFIER
//           (fix a composable's width and height).
// Why:      The loading spinner uses `Modifier.size(20.dp)`.
// TS map:   `import { size } from "androidx/compose/foundation/layout";` — `width/height`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { size } from "androidx/compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.size

// What:     `import androidx.compose.foundation.lazy.LazyColumn` pulls in `LazyColumn`, a
//           SCROLLING column that only composes visible items (like a virtualized list).
// Why:      `TrackPager` shows the tabs + tracks in one scrolling `LazyColumn`.
// TS map:   `import { LazyColumn } from "androidx/compose/foundation/lazy";` — a
//           virtualized/`react-window`-style list.
//
// In TS you'd write (pseudocode):
// ```ts
// import { LazyColumn } from "androidx/compose/foundation/lazy";
// ```
import androidx.compose.foundation.lazy.LazyColumn

// What:     `import androidx.compose.foundation.lazy.items` pulls in `items(list) { ... }`,
//           the `LazyListScope` builder that emits one row per list element.
// Why:      `TrackPager` lists the page's tracks with `items(...)`.
// TS map:   `import { items } from "androidx/compose/foundation/lazy";` — like
//           `list.map((x) => <Row .../>)` inside a virtualized list.
//
// In TS you'd write (pseudocode):
// ```ts
// import { items } from "androidx/compose/foundation/lazy";
// ```
import androidx.compose.foundation.lazy.items

// What:     `import androidx.compose.material3.Button` pulls in the Material3 `Button`
//           composable (a filled clickable button).
// Why:      Open/transport/active-tab buttons use it.
// TS map:   `import { Button } from "androidx/compose/material3";` — a button component.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Button } from "androidx/compose/material3";
// ```
import androidx.compose.material3.Button

// What:     `import androidx.compose.material3.Checkbox` pulls in the Material3 `Checkbox`
//           composable.
// Why:      The repeat-track toggle uses it.
// TS map:   `import { Checkbox } from "androidx/compose/material3";`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Checkbox } from "androidx/compose/material3";
// ```
import androidx.compose.material3.Checkbox

// What:     `import androidx.compose.material3.CircularProgressIndicator` pulls in the
//           spinner composable.
// Why:      `LoadingNotice` shows a `CircularProgressIndicator`.
// TS map:   `import { CircularProgressIndicator } from "androidx/compose/material3";`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { CircularProgressIndicator } from "androidx/compose/material3";
// ```
import androidx.compose.material3.CircularProgressIndicator

// What:     `import androidx.compose.material3.MaterialTheme` pulls in `MaterialTheme`,
//           the theme provider/accessor (its `.colorScheme` gives themed colors).
// Why:      `onCreate` wraps the UI in `MaterialTheme`; rows read its colors.
// TS map:   `import { MaterialTheme } from "androidx/compose/material3";` — a theme
//           context provider, like a styled-components `ThemeProvider`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { MaterialTheme } from "androidx/compose/material3";
// ```
import androidx.compose.material3.MaterialTheme

// What:     `import androidx.compose.material3.OutlinedButton` pulls in the outlined
//           (unfilled) button composable.
// Why:      Inactive page tabs use `OutlinedButton`.
// TS map:   `import { OutlinedButton } from "androidx/compose/material3";`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { OutlinedButton } from "androidx/compose/material3";
// ```
import androidx.compose.material3.OutlinedButton

// What:     `import androidx.compose.material3.RadioButton` pulls in the radio-button
//           composable.
// Why:      `ShuffleOption` shows a `RadioButton`.
// TS map:   `import { RadioButton } from "androidx/compose/material3";`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { RadioButton } from "androidx/compose/material3";
// ```
import androidx.compose.material3.RadioButton

// What:     `import androidx.compose.material3.Scaffold` pulls in `Scaffold`, a Material
//           layout shell that supplies system-bar inset padding to its content lambda.
// Why:      `PlayerScreen` wraps its content in a `Scaffold`.
// TS map:   `import { Scaffold } from "androidx/compose/material3";` — a page shell that
//           hands you safe-area padding.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Scaffold } from "androidx/compose/material3";
// ```
import androidx.compose.material3.Scaffold

// What:     `import androidx.compose.material3.Slider` pulls in the `Slider` composable (a
//           draggable value track).
// Why:      The seek bar and volume control are `Slider`s.
// TS map:   `import { Slider } from "androidx/compose/material3";` — an `<input type="range">`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Slider } from "androidx/compose/material3";
// ```
import androidx.compose.material3.Slider

// What:     `import androidx.compose.material3.Surface` pulls in `Surface`, a themed
//           background container.
// Why:      `onCreate` wraps the screen in a full-size `Surface`.
// TS map:   `import { Surface } from "androidx/compose/material3";` — a themed `<div>`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Surface } from "androidx/compose/material3";
// ```
import androidx.compose.material3.Surface

// What:     `import androidx.compose.material3.Text` pulls in the `Text` composable
//           (renders a string).
// Why:      Every label/row uses `Text`.
// TS map:   `import { Text } from "androidx/compose/material3";` — like a `<span>`/`<Text>`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Text } from "androidx/compose/material3";
// ```
import androidx.compose.material3.Text

// What:     `import androidx.compose.material3.darkColorScheme` pulls in
//           `darkColorScheme()`, the factory for the dark Material color set.
// Why:      `onCreate` uses it when the device is in dark mode.
// TS map:   `import { darkColorScheme } from "androidx/compose/material3";`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { darkColorScheme } from "androidx/compose/material3";
// ```
import androidx.compose.material3.darkColorScheme

// What:     `import androidx.compose.material3.lightColorScheme` pulls in
//           `lightColorScheme()`, the factory for the light Material color set.
// Why:      `onCreate` uses it when the device is in light mode.
// TS map:   `import { lightColorScheme } from "androidx/compose/material3";`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { lightColorScheme } from "androidx/compose/material3";
// ```
import androidx.compose.material3.lightColorScheme

// What:     `import androidx.compose.runtime.Composable` pulls in the `@Composable`
//           ANNOTATION that marks a function as a Compose UI component.
// Why:      Every UI function below is annotated `@Composable`.
// TS map:   No exact analogue; mentally a marker that "this function is a UI component
//           that may call other components and read composition state."
//
// In TS you'd write (pseudocode):
// ```ts
// import { Composable } from "androidx/compose/runtime";
// ```
import androidx.compose.runtime.Composable

// What:     `import androidx.compose.runtime.LaunchedEffect` pulls in `LaunchedEffect`,
//           the composable that runs a `suspend` side-effect block tied to a key (re-runs
//           when the key changes; cancels on leave).
// Why:      `AppRoot` and `PlayerScreen` use `LaunchedEffect` for permission requests and
//           position polling.
// TS map:   `import { LaunchedEffect } from "androidx/compose/runtime";` — like
//           `useEffect(fn, [key])` whose body may await.
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
// TS map:   No TS equivalent — machinery behind a `get` accessor over a signal.
//
// In TS you'd write (pseudocode):
// ```ts
// // no import — TS getters don't need an operator function in scope
// ```
import androidx.compose.runtime.getValue

// What:     `import androidx.compose.runtime.mutableDoubleStateOf` imports
//           `mutableDoubleStateOf(x)`, a `Double`-specialized observable state holder (a
//           `mutableStateOf` variant that avoids boxing the number).
// Why:      `PlayerScreen` holds `position`/`duration` (both `Double`) in it.
// TS map:   `import { mutableDoubleStateOf } from "androidx/compose/runtime";` —
//           `signal<number>(x)`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { mutableDoubleStateOf } from "androidx/compose/runtime";
// ```
import androidx.compose.runtime.mutableDoubleStateOf

// What:     `import androidx.compose.runtime.mutableStateOf` imports `mutableStateOf(x)`,
//           the general observable state holder.
// Why:      `boundController` and `AppRoot`'s `hasAudioAccess` use it.
// TS map:   `import { mutableStateOf } from "androidx/compose/runtime";` — `signal(x)`.
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
// TS map:   `import { remember } from "androidx/compose/runtime";` — like `useMemo`/the
//           cache behind `useState`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { remember } from "androidx/compose/runtime";
// ```
import androidx.compose.runtime.remember

// What:     `import androidx.compose.runtime.setValue` imports the `setValue` OPERATOR
//           used to WRITE a `by`-delegated state property.
// Why:      Assigning to the `by` state vars below goes through it.
// TS map:   No TS equivalent — machinery behind a `set` accessor over a signal.
//
// In TS you'd write (pseudocode):
// ```ts
// // no import — TS setters don't need an operator function in scope
// ```
import androidx.compose.runtime.setValue

// What:     `import androidx.compose.ui.Alignment` pulls in `Alignment`, the namespace of
//           alignment constants (`CenterVertically`, `CenterHorizontally`).
// Why:      Layouts align children with `Alignment.*`.
// TS map:   `import { Alignment } from "androidx/compose/ui";` — `align-items` values.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Alignment } from "androidx/compose/ui";
// ```
import androidx.compose.ui.Alignment

// What:     `import androidx.compose.ui.Modifier` pulls in `Modifier`, the chainable
//           styling/layout descriptor passed to composables.
// Why:      Nearly every composable takes a `Modifier` chain.
// TS map:   `import { Modifier } from "androidx/compose/ui";` — like a builder for
//           style/layout props; `Modifier.fillMaxSize().padding(8.dp)` ~ chained styles.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Modifier } from "androidx/compose/ui";
// ```
import androidx.compose.ui.Modifier

// What:     `import androidx.compose.ui.graphics.Color` pulls in `Color`, Compose's color
//           type (we use `Color.Transparent`).
// Why:      `TrackRow` uses `Color.Transparent` for non-current rows.
// TS map:   `import { Color } from "androidx/compose/ui/graphics";`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Color } from "androidx/compose/ui/graphics";
// ```
import androidx.compose.ui.graphics.Color

// What:     `import androidx.compose.ui.platform.LocalContext` pulls in `LocalContext`, a
//           Compose CompositionLocal whose `.current` gives the current Android `Context`.
// Why:      `AppRoot` reads `LocalContext.current` to check the permission.
// TS map:   `import { LocalContext } from "androidx/compose/ui/platform";` — like a React
//           context whose value you read with `useContext`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { LocalContext } from "androidx/compose/ui/platform";
// ```
import androidx.compose.ui.platform.LocalContext

// What:     `import androidx.compose.ui.text.style.TextOverflow` pulls in `TextOverflow`,
//           the namespace describing how overflowing text is clipped (`Ellipsis`).
// Why:      `TrackRow` uses `TextOverflow.Ellipsis`.
// TS map:   `import { TextOverflow } from "androidx/compose/ui/text/style";` — CSS
//           `text-overflow`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { TextOverflow } from "androidx/compose/ui/text/style";
// ```
import androidx.compose.ui.text.style.TextOverflow

// What:     `import androidx.compose.ui.unit.dp` imports the `dp` EXTENSION PROPERTY on
//           numbers: writing `24.dp` produces a density-independent-pixel dimension. It
//           is an extension on `Int`/`Float`, so importing it enables the `<number>.dp`
//           syntax.
// Why:      Every spacing/size value uses `.dp` (e.g. `24.dp`, `8.dp`).
// TS map:   No extension properties in TS; mentally `dp(24)`. Import as
//           `import { dp } from "androidx/compose/ui/unit";` and read `24.dp` as `dp(24)`.
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
// Why:      `TrackRow` takes a `PageEntry`.
// TS map:   `import { PageEntry } from "./core/Page";`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { PageEntry } from "./core/Page";
// ```
import dev.monochromatic.musicplayer.core.PageEntry

// What:     `import dev.monochromatic.musicplayer.core.ShuffleMode` imports the
//           three-value enum `ShuffleMode` (`OFF`/`WITHIN_PAGE`/`ALL`).
// Why:      `ControlRow` compares and sets shuffle modes.
// TS map:   `import { ShuffleMode } from "./core/ShuffleMode";`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { ShuffleMode } from "./core/ShuffleMode";
// ```
import dev.monochromatic.musicplayer.core.ShuffleMode

// What:     `import dev.monochromatic.musicplayer.core.rowDisplay` imports the
//           `rowDisplay(label, name)` FUNCTION that strips a folder tab's `<label>/` prefix
//           from a track's display name (and leaves letter / `#` tab names whole).
// Why:      `TrackRow` shows the path BELOW the active folder tab, not the full relative path.
// TS map:   `import { rowDisplay } from "./core/Pagination";`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { rowDisplay } from "./core/Pagination";
// ```
import dev.monochromatic.musicplayer.core.rowDisplay

// What:     `import kotlinx.coroutines.delay` imports `delay(ms)`, a `suspend` function
//           that pauses the coroutine for the given milliseconds without blocking a
//           thread.
// Why:      `PlayerScreen`'s polling loop uses `delay(POSITION_POLL_MS)`.
// TS map:   `import { delay } from "kotlinx/coroutines";` — `await sleep(ms)` where
//           `sleep` is a `new Promise((r) => setTimeout(r, ms))`.
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
// TS map:   `export const LOG_TAG = "MusicPlayer";` — Kotlin `const` must be a
//           compile-time literal (stricter than TS `const`).
//
// In TS you'd write (pseudocode):
// ```ts
// export const LOG_TAG = "MusicPlayer";
// ```
const val LOG_TAG = "MusicPlayer"

// What:     `private const val SECONDS_PER_MINUTE: Int = 60` declares a private
//           compile-time `Int` constant (32-bit; siblings `Long`/`Short`).
// Why:      Used by `formatTime` to split seconds into `m:ss`.
// TS map:   `const SECONDS_PER_MINUTE = 60;`.
//
// In TS you'd write (pseudocode):
// ```ts
// const SECONDS_PER_MINUTE = 60;
// ```
private const val SECONDS_PER_MINUTE: Int = 60

// What:     `private const val POSITION_POLL_MS: Long = 200L` declares a private
//           compile-time `Long` constant (64-bit; the `L` suffix forces `Long`, a bare
//           `200` would be `Int`).
// Why:      Position-poll cadence for the seek bar, in milliseconds (the desktop emits
//           every 0.1s); `Long` because `delay(...)` takes a `Long` millisecond count.
// TS map:   `const POSITION_POLL_MS = 200;` — one `number` type, no `L` suffix.
// Gotcha:   The `L` makes it a `Long` to match `delay(timeMillis: Long)`.
//
// In TS you'd write (pseudocode):
// ```ts
// const POSITION_POLL_MS = 200;
// ```
private const val POSITION_POLL_MS: Long = 200L

// What:     `class MainActivity : ComponentActivity() { ... }` declares the activity class
//           that EXTENDS `ComponentActivity` (the `: Super()` is the implicit `super()`
//           call). Android instantiates it, so there is no explicit primary constructor.
// Why:      Single-activity host. The player lives in `PlaybackService` so audio outlives
//           this activity; the UI binds to that service for a direct handle to the
//           service-owned `PlayerController` and drives it. Binding with
//           `BIND_AUTO_CREATE` also creates the service, which builds the `MediaSession`
//           and goes foreground on play.
// TS map:   `class MainActivity extends ComponentActivity { ... }`.
//
// In TS you'd write (pseudocode):
// ```ts
// class MainActivity extends ComponentActivity {
//   // ...fields and lifecycle methods below...
// }
// ```
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
    // TS map:   `private readonly boundController = signal<PlayerController | null>(null);`
    //           — read/write via `boundController.value`.
    // Gotcha:   This is the state OBJECT itself (accessed via `.value`), unlike the `by`
    //           form used elsewhere where the delegate hides `.value`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private readonly boundController = signal<PlayerController | null>(null);
    // ```
    private val boundController = mutableStateOf<PlayerController?>(null)

    // What:     `private var binder: PlaybackService.LocalBinder? = null` declares a
    //           private, reassignable field of the NULLABLE nested type
    //           `PlaybackService.LocalBinder?` (the binder handle, or null while unbound),
    //           initialised `null`.
    // Why:      Live binder for the post-grant library-load signal; null while unbound.
    // TS map:   `private binder: PlaybackService.LocalBinder | null = null;`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private binder: PlaybackService.LocalBinder | null = null;
    // ```
    private var binder: PlaybackService.LocalBinder? = null

    // What:     `private var pendingRoot: Uri? = null` declares a private, reassignable
    //           NULLABLE `Uri?` field, initialised `null`.
    // Why:      A folder picked while the service was unbound, waiting to be applied;
    //           `connection`'s `onServiceConnected` consumes it once the rebind completes.
    //           The picker round-trip stops this activity, which unbinds the service, so
    //           the binder is often null at the moment the pick arrives.
    // TS map:   `private pendingRoot: Uri | null = null;`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private pendingRoot: Uri | null = null;
    // ```
    private var pendingRoot: Uri? = null

    // What:     `private val folderPicker = registerForActivityResult(ActivityResultContracts.OpenDocumentTree()) { tree -> ... }`
    //           declares a private read-only field by calling `registerForActivityResult`
    //           with a CONTRACT (`OpenDocumentTree()`) and a TRAILING LAMBDA callback
    //           `{ tree -> ... }` (its parameter `tree` is the picked `Uri?`). The call
    //           returns a launcher you `launch(...)` later.
    // Why:      Activity-scoped folder picker, registered on the activity rather than
    //           inside the composition. Stopping the activity to show the picker nulls
    //           `boundController`, which disposes the player screen; a launcher hosted
    //           there would be unregistered before its own result arrived, silently
    //           dropping the pick. Registering on the activity ties the launcher to the
    //           activity lifecycle, so it survives the screen leaving composition and still
    //           receives the granted tree.
    // TS map:   `private readonly folderPicker = registerForActivityResult(new OpenDocumentTree(), (tree) => { ... });`
    //           — a registered launcher + result callback.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private readonly folderPicker = registerForActivityResult(
    //   new ActivityResultContracts.OpenDocumentTree(),
    //   (tree) => { if (tree !== null) this.onFolderChosen(tree); },
    // );
    // ```
    private val folderPicker = registerForActivityResult(ActivityResultContracts.OpenDocumentTree()) { tree ->
        // What:     `if (tree != null) { onFolderChosen(tree) }` null-checks the picked
        //           `Uri?`. Inside the block `tree` is SMART-CAST to a non-null `Uri`.
        // Why:      A cancelled picker yields null; only act on a real pick.
        // TS map:   `if (tree !== null) this.onFolderChosen(tree);`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (tree !== null) this.onFolderChosen(tree);
        // ```
        if (tree != null) {
            // What:     `onFolderChosen(tree)` applies the chosen folder (persist grant +
            //           reload). `tree` is the smart-cast non-null `Uri`.
            // Why:      Make the picked folder the live library.
            // TS map:   `this.onFolderChosen(tree);`.
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
    // TS map:   `private readonly connection: ServiceConnection = { onServiceConnected(...) {...}, onServiceDisconnected(...) {...} };`
    //           — an object literal implementing the interface.
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
    private val connection = object : ServiceConnection {
        // What:     `override fun onServiceConnected(name: ComponentName?, service: IBinder?) { ... }`
        //           overrides the interface callback Android calls when the bind completes.
        //           `name` is the bound component (unused); `service` is the raw `IBinder?`.
        // Why:      Capture the binder and publish the brain to the observable state.
        // TS map:   `onServiceConnected(name: ComponentName | null, service: IBinder | null): void { ... }`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // onServiceConnected(name, service) { ... }
        // ```
        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
            // What:     `val local = service as PlaybackService.LocalBinder` declares a local
            //           `local` by CASTING the `IBinder?` `service` to the concrete
            //           `PlaybackService.LocalBinder`. `as` is the UNSAFE cast: it throws
            //           `ClassCastException` at runtime if `service` is not actually that
            //           type (and would throw on null here too).
            // Why:      We know our own service hands back a `LocalBinder`, so we narrow to
            //           it to reach `.controller`/`.reloadFromRoot`.
            // TS map:   `const local = service as PlaybackService.LocalBinder;` — TS's `as`
            //           is a COMPILE-TIME-only assertion (no runtime check), whereas Kotlin's
            //           `as` actually checks and can throw.
            // Gotcha:   Kotlin `as` is a CHECKED cast that throws on mismatch; TS `as` is
            //           erased and never throws. The safe variant is `as?` (returns null on
            //           mismatch), not used here.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const local = service as PlaybackService.LocalBinder;
            // ```
            val local = service as PlaybackService.LocalBinder
            // What:     `binder = local` stores the binder handle.
            // Why:      Keep it for the post-grant library-load signal.
            // TS map:   `this.binder = local;`.
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
            // TS map:   `this.boundController.value = local.controller;`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.boundController.value = local.controller;
            // ```
            boundController.value = local.controller
            // What:     `Log.i(LOG_TAG, "bound to PlaybackService")` logs the bind.
            // Why:      Trace binding for verification.
            // TS map:   `console.info(`[${LOG_TAG}] bound to PlaybackService`);`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // console.info(`[${LOG_TAG}] bound to PlaybackService`);
            // ```
            Log.i(LOG_TAG, "bound to PlaybackService")
            // What:     `pendingRoot?.let { root -> ... }` SAFE-CALLs `.let` on the nullable
            //           `pendingRoot`: when it is non-null, run the trailing lambda with the
            //           non-null value bound to `root`; when null, do nothing. (Folds in the
            //           old inline note: a folder picked while unbound is applied now that the
            //           service is connected.)
            // Why:      If a folder was picked while unbound, apply it now that we are
            //           connected.
            // TS map:   `if (this.pendingRoot !== null) { const root = this.pendingRoot; ... }`
            //           — `?.let { x -> }` is "if non-null, run this block with the value."
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // if (this.pendingRoot !== null) {
            //   const root = this.pendingRoot;
            //   local.reloadFromRoot(root);
            //   this.pendingRoot = null;
            // }
            // ```
            pendingRoot?.let { root ->
                // What:     `local.reloadFromRoot(root)` tells the service to load the
                //           pending folder. `root` is the non-null `Uri` from `.let`.
                // Why:      Apply the deferred pick now.
                // TS map:   `local.reloadFromRoot(root);`.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // local.reloadFromRoot(root);
                // ```
                local.reloadFromRoot(root)
                // What:     `pendingRoot = null` clears the deferred pick.
                // Why:      It has been applied; don't reapply on the next bind.
                // TS map:   `this.pendingRoot = null;`.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // this.pendingRoot = null;
                // ```
                pendingRoot = null
            }
        }

        // What:     `override fun onServiceDisconnected(name: ComponentName?) { ... }`
        //           overrides the callback Android calls when the service connection drops.
        // Why:      Clear our handles so nothing uses a dead connection.
        // TS map:   `onServiceDisconnected(name: ComponentName | null): void { ... }`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // onServiceDisconnected(name) { ... }
        // ```
        override fun onServiceDisconnected(name: ComponentName?) {
            // What:     `binder = null` clears the binder handle.
            // Why:      The connection is gone.
            // TS map:   `this.binder = null;`.
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
            // TS map:   `this.boundController.value = null;`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.boundController.value = null;
            // ```
            boundController.value = null
            // What:     `Log.i(LOG_TAG, "PlaybackService disconnected")` logs the drop.
            // Why:      Trace disconnects for verification.
            // TS map:   `console.info(`[${LOG_TAG}] PlaybackService disconnected`);`
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
    // TS map:   `override onCreate(savedInstanceState: Bundle | null): void { ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // override onCreate(savedInstanceState: Bundle | null): void { ... }
    // ```
    override fun onCreate(savedInstanceState: Bundle?) {
        // What:     `super.onCreate(savedInstanceState)` calls the base class first.
        // Why:      The framework must initialize the activity before we touch it.
        // TS map:   `super.onCreate(savedInstanceState);`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // super.onCreate(savedInstanceState);
        // ```
        super.onCreate(savedInstanceState)
        // What:     `Log.i(LOG_TAG, "MainActivity.onCreate")` logs an info line at activity
        //           creation. (Dropped the old `flavor=${BuildConfig.FLAVOR}` suffix: the
        //           media3/hybrid flavors are gone, so there is one engine and no FLAVOR
        //           constant.)
        // Why:      Trace activity launch in logcat, for verification.
        // TS map:   `console.info(`[${LOG_TAG}] MainActivity.onCreate`);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // console.info(`[${LOG_TAG}] MainActivity.onCreate`);
        // ```
        Log.i(LOG_TAG, "MainActivity.onCreate")
        // What:     `enableEdgeToEdge()` draws the app behind the system bars. (Folds in the
        //           old inline note: draw edge to edge, the platform default on targetSdk
        //           35+, and let the `Scaffold` apply the system-bar insets.)
        // Why:      Modern full-bleed layout; the `Scaffold` supplies inset padding.
        // TS map:   `enableEdgeToEdge();`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // enableEdgeToEdge();
        // ```
        enableEdgeToEdge()
        // What:     `setContent { ... }` mounts a Compose UI tree as this activity's
        //           content; the trailing lambda IS the root composable.
        // Why:      Render the app UI.
        // TS map:   `setContent(() => { ... });` — like `ReactDOM.render(<App/>, root)`.
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
            // TS map:   `const colorScheme = isSystemInDarkTheme() ? darkColorScheme() : lightColorScheme();`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const colorScheme = isSystemInDarkTheme() ? darkColorScheme() : lightColorScheme();
            // ```
            val colorScheme = if (isSystemInDarkTheme()) darkColorScheme() else lightColorScheme()
            // What:     `MaterialTheme(colorScheme = colorScheme) { ... }` calls the
            //           `MaterialTheme` composable with the `colorScheme` named argument and a
            //           TRAILING LAMBDA holding its child UI. Trailing-lambda children are how
            //           Compose nests UI (like JSX children).
            // Why:      Provide the theme to all descendants.
            // TS map:   `<MaterialTheme colorScheme={colorScheme}> ... </MaterialTheme>`.
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
                // TS map:   `<Surface modifier={Modifier.fillMaxSize()}> ... </Surface>`.
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
                    // TS map:   `const controller = this.boundController.value;` (and reading a
                    //           signal subscribes the component).
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // const controller = this.boundController.value;
                    // ```
                    val controller = boundController.value
                    // What:     `if (controller == null) { StartingGate() } else { AppRoot(...) }`
                    //           branches the UI: no brain yet -> show `StartingGate`; bound ->
                    //           show `AppRoot` (smart-cast `controller` to non-null in the else).
                    // Why:      Render the right screen for the bind state.
                    // TS map:   `controller === null ? <StartingGate/> : <AppRoot .../>`.
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // if (controller === null) return <StartingGate/>;
                    // return (
                    //   <AppRoot
                    //     controller={controller}
                    //     onAudioGranted={() => this.binder?.ensureLibraryLoaded()}
                    //     onChooseFolder={() => this.folderPicker.launch(null)}
                    //   />
                    // );
                    // ```
                    if (controller == null) {
                        // What:     `StartingGate()` calls the placeholder composable shown
                        //           while binding.
                        // Why:      Show "Starting..." until the service binds.
                        // TS map:   `<StartingGate/>`.
                        //
                        // In TS you'd write (pseudocode):
                        // ```ts
                        // <StartingGate/>
                        // ```
                        StartingGate()
                    } else {
                        // What:     `AppRoot(controller = controller, onAudioGranted = { binder?.ensureLibraryLoaded() }, onChooseFolder = { folderPicker.launch(null) },)`
                        //           calls the `AppRoot` composable with named arguments. Two of
                        //           them are LAMBDA callbacks: `onAudioGranted` safe-calls
                        //           `binder?.ensureLibraryLoaded()`; `onChooseFolder` launches the
                        //           folder picker with `folderPicker.launch(null)`.
                        // Why:      Hand the bound brain and the two activity-level actions to the
                        //           permission/library gate.
                        // TS map:   `<AppRoot controller={controller} onAudioGranted={() => this.binder?.ensureLibraryLoaded()} onChooseFolder={() => this.folderPicker.launch(null)} />`.
                        //
                        // In TS you'd write (pseudocode):
                        // ```ts
                        // <AppRoot
                        //   controller={controller}
                        //   onAudioGranted={() => this.binder?.ensureLibraryLoaded()}
                        //   onChooseFolder={() => this.folderPicker.launch(null)}
                        // />
                        // ```
                        AppRoot(
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
    //           the activity becomes visible.
    // Why:      Bind to the service so the UI can reach the brain.
    // TS map:   `override onStart(): void { ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // override onStart(): void { ... }
    // ```
    override fun onStart() {
        // What:     `super.onStart()` calls the base class first.
        // Why:      Let the framework run its own start logic.
        // TS map:   `super.onStart();`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // super.onStart();
        // ```
        super.onStart()
        // What:     `val intent = Intent(this, PlaybackService::class.java).setAction(PlaybackService.ACTION_LOCAL_BIND)`
        //           builds the bind `Intent`. `Intent(this, PlaybackService::class.java)`
        //           constructs an explicit intent: `this` is the context;
        //           `PlaybackService::class.java` is the Java `Class` object for the service
        //           (`::class` is the Kotlin `KClass` literal, `.java` converts it to the
        //           Java `Class` the API wants). `.setAction(...)` chains to set the private
        //           bind action and returns the same `Intent`.
        // Why:      Address the bind to our service with the local-bind action.
        // TS map:   `const intent = new Intent(this, PlaybackService.class).setAction(PlaybackService.ACTION_LOCAL_BIND);`
        //           — `::class.java` is Kotlin's way to name the runtime class object.
        // Gotcha:   `PlaybackService::class.java` is the class-reference-to-Java-Class
        //           conversion; `::class` alone is a Kotlin `KClass`, and `.java` adapts it
        //           for the Android API. No TS analogue beyond passing the class itself.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const intent = new Intent(this, PlaybackService).setAction(PlaybackService.ACTION_LOCAL_BIND);
        // ```
        val intent = Intent(this, PlaybackService::class.java).setAction(PlaybackService.ACTION_LOCAL_BIND)
        // What:     `bindService(intent, connection, Context.BIND_AUTO_CREATE)` binds to the
        //           service using our `connection` callbacks; `Context.BIND_AUTO_CREATE`
        //           also CREATES the service if it is not running.
        // Why:      Establish the in-process connection (and start the service) so the brain
        //           becomes reachable.
        // TS map:   `this.bindService(intent, this.connection, Context.BIND_AUTO_CREATE);`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.bindService(intent, this.connection, Context.BIND_AUTO_CREATE);
        // ```
        bindService(intent, connection, Context.BIND_AUTO_CREATE)
    }

    // What:     `override fun onStop() { ... }` overrides the lifecycle hook called when the
    //           activity is no longer visible.
    // Why:      Unbind from the service (without killing it) so audio keeps playing.
    // TS map:   `override onStop(): void { ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // override onStop(): void { ... }
    // ```
    override fun onStop() {
        // What:     `super.onStop()` calls the base class first.
        // Why:      Let the framework run its own stop logic.
        // TS map:   `super.onStop();`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // super.onStop();
        // ```
        super.onStop()
        // What:     `unbindService(connection)` detaches our connection from the service.
        //           (Folds in the old inline note: unbind only; the service stays alive on
        //           its own, foreground while playing, so audio keeps going. Never release
        //           the controller here: it belongs to the service, not this activity.)
        // Why:      Stop observing while invisible without stopping playback.
        // TS map:   `this.unbindService(this.connection);`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.unbindService(this.connection);
        // ```
        unbindService(connection)
        // What:     `binder = null` clears the binder handle.
        // Why:      We are unbound now.
        // TS map:   `this.binder = null;`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.binder = null;
        // ```
        binder = null
        // What:     `boundController.value = null` clears the observable brain so a later
        //           re-show starts from the gate.
        // Why:      No live brain while unbound.
        // TS map:   `this.boundController.value = null;`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.boundController.value = null;
        // ```
        boundController.value = null
    }

    // What:     `private fun onFolderChosen(treeUri: Uri) { ... }` declares a private method
    //           taking a tree `Uri`, block body, `Unit`.
    // Why:      Persist read access to a just-picked SAF folder and make it the live
    //           library. Taking a persistable grant lets a later cold start re-read the
    //           folder with no re-pick; the bound service is told to rescan now. Only the
    //           activity can do this: the persistable grant is delivered to the component
    //           that launched the picker.
    // TS map:   `private onFolderChosen(treeUri: Uri): void { ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private onFolderChosen(treeUri: Uri): void { ... }
    // ```
    private fun onFolderChosen(treeUri: Uri) {
        // What:     `contentResolver.takePersistableUriPermission(treeUri, Intent.FLAG_GRANT_READ_URI_PERMISSION)`
        //           takes a persistable READ grant for the picked tree. `contentResolver` is
        //           the activity's resolver; the flag requests read access that survives
        //           reboots.
        // Why:      So a later cold start can re-read the folder without re-prompting.
        // TS map:   `this.contentResolver.takePersistableUriPermission(treeUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.contentResolver.takePersistableUriPermission(treeUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
        // ```
        contentResolver.takePersistableUriPermission(treeUri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        // What:     `LibraryRoot.save(this, treeUri)` persists the chosen folder URI so a
        //           restart remembers it.
        // Why:      Remembering the choice backs a later restart.
        // TS map:   `LibraryRoot.save(this, treeUri);`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // LibraryRoot.save(this, treeUri);
        // ```
        LibraryRoot.save(this, treeUri)
        // What:     `val bound = binder` declares a local `bound` (inferred nullable
        //           `PlaybackService.LocalBinder?`) snapshotting the current binder.
        // Why:      Snapshot lets us branch on bound-vs-unbound and smart-cast below.
        // TS map:   `const bound = this.binder; // LocalBinder | null`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const bound = this.binder;
        // ```
        val bound = binder
        // What:     `if (bound != null) { bound.reloadFromRoot(treeUri) } else { ... }`
        //           branches on whether we are bound. `bound != null` smart-casts `bound` to
        //           non-null in the `then` branch.
        // Why:      If bound, reload immediately; otherwise defer the pick until the rebind.
        // TS map:   `if (bound !== null) bound.reloadFromRoot(treeUri); else this.pendingRoot = treeUri;`.
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
            // TS map:   `bound.reloadFromRoot(treeUri);`.
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
            // TS map:   `this.pendingRoot = treeUri;`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.pendingRoot = treeUri;
            // ```
            pendingRoot = treeUri
        }
        // What:     `Log.i(LOG_TAG, "folder chosen: $treeUri")` logs the chosen folder.
        // Why:      Trace folder selection for verification.
        // TS map:   `console.info(`[${LOG_TAG}] folder chosen: ${treeUri}`);`
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
// Why:      `AppRoot` is a UI component.
// TS map:   No exact analogue; mentally "this function is a React-style component."
//
// In TS you'd write (pseudocode):
// ```ts
// // (no annotation; a function returning UI is a component)
// ```
@Composable
// What:     `private fun AppRoot(controller: PlayerController, onAudioGranted: () -> Unit, onChooseFolder: () -> Unit) { ... }`
//           declares a private composable taking the bound brain plus two FUNCTION-TYPE
//           callbacks (`() -> Unit` = a no-arg void function; TS `() => void`).
// Why:      The audio-permission gate and library trigger over a bound `controller`:
//           request audio access once, show `PermissionGate` until granted, and on grant
//           signal the service to load the library; once access is held show
//           `PlayerScreen`.
// TS map:   `function AppRoot({ controller, onAudioGranted, onChooseFolder }: { controller: PlayerController; onAudioGranted: () => void; onChooseFolder: () => void; }) { ... }`.
//
// In TS you'd write (pseudocode):
// ```ts
// function AppRoot(props: {
//   controller: PlayerController;
//   onAudioGranted: () => void;
//   onChooseFolder: () => void;
// }) { ... }
// ```
private fun AppRoot(controller: PlayerController, onAudioGranted: () -> Unit, onChooseFolder: () -> Unit) {
    // What:     `val context = LocalContext.current` reads the current Android `Context`
    //           from the `LocalContext` CompositionLocal (`.current` is the in-scope value).
    // Why:      Needed to check the audio permission.
    // TS map:   `const context = useContext(LocalContext);`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const context = useContext(LocalContext);
    // ```
    val context = LocalContext.current
    // What:     `var hasAudioAccess by remember { mutableStateOf(hasAudioPermission(context)) }`
    //           declares a STATE-BACKED local. `remember { ... }` computes the value once and
    //           keeps it across recompositions; `mutableStateOf(...)` is the observable
    //           holder seeded from the current permission; `by` DELEGATES the `hasAudioAccess`
    //           property's get/set to that holder, so reading it subscribes and assigning it
    //           triggers recomposition. (`getValue`/`setValue` are imported for this `by`.)
    // Why:      Track whether audio access is held; flipping it re-renders the gate.
    // TS map:   `const [hasAudioAccess, setHasAudioAccess] = useState(hasAudioPermission(context));`
    //           — `var x by remember { mutableStateOf(init) }` ~ `useState(init)`.
    // Gotcha:   `by remember { mutableStateOf(...) }` is the read/write `useState` idiom; the
    //           `by` hides the `.value` so `hasAudioAccess` reads/writes like a plain var.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const [hasAudioAccess, setHasAudioAccess] = useState(hasAudioPermission(context));
    // ```
    var hasAudioAccess by remember { mutableStateOf(hasAudioPermission(context)) }
    // What:     `val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission(),) { granted -> ... }`
    //           registers a permission-request launcher inside the composition, with the
    //           `RequestPermission()` contract and a trailing-lambda result callback whose
    //           `granted` parameter is the `Boolean` result.
    // Why:      Lets the gate ask for the audio permission and react to the answer.
    // TS map:   `const permissionLauncher = useActivityResultLauncher(new RequestPermission(), (granted) => { ... });`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const permissionLauncher = useActivityResultLauncher(
    //   new ActivityResultContracts.RequestPermission(),
    //   (granted) => { setHasAudioAccess(granted); },
    // );
    // ```
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        // What:     `Log.i(LOG_TAG, "audio permission granted=$granted")` logs the result.
        // Why:      Trace the permission outcome for verification.
        // TS map:   `console.info(`[${LOG_TAG}] audio permission granted=${granted}`);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // console.info(`[${LOG_TAG}] audio permission granted=${granted}`);
        // ```
        Log.i(LOG_TAG, "audio permission granted=$granted")
        // What:     `hasAudioAccess = granted` writes the new access state through the `by`
        //           delegate (triggers recomposition).
        // Why:      Update the gate to the granted/denied result.
        // TS map:   `setHasAudioAccess(granted);`.
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
    // TS map:   `useEffect(() => { ... }, []);` — empty-dependency effect (runs once).
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
        // TS map:   `if (!hasAudioAccess) permissionLauncher.launch(audioPermission());`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (!hasAudioAccess) permissionLauncher.launch(audioPermission());
        // ```
        if (!hasAudioAccess) {
            // What:     `permissionLauncher.launch(audioPermission())` fires the system
            //           permission prompt for the platform's audio permission.
            // Why:      Ask the user for audio access.
            // TS map:   `permissionLauncher.launch(audioPermission());`.
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
    // TS map:   `useEffect(() => { if (hasAudioAccess) onAudioGranted(); }, [hasAudioAccess]);`.
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
        // TS map:   `if (hasAudioAccess) onAudioGranted();`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (hasAudioAccess) onAudioGranted();
        // ```
        if (hasAudioAccess) {
            // What:     `onAudioGranted()` invokes the callback passed by the caller (which
            //           tells the service to load the library).
            // Why:      Kick off the service-side load.
            // TS map:   `onAudioGranted();`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // onAudioGranted();
            // ```
            onAudioGranted()
        }
    }
    // What:     `if (hasAudioAccess) { PlayerScreen(...) } else { PermissionGate(...) }`
    //           chooses the screen: the player when access is held, otherwise the permission
    //           gate. `PlayerScreen(controller = controller, onChooseFolder = onChooseFolder)`
    //           and `PermissionGate(onGrant = { permissionLauncher.launch(audioPermission()) })`
    //           are composable calls with named args (the gate's `onGrant` is a lambda that
    //           re-asks).
    // Why:      Show the right UI for the access state.
    // TS map:   `return hasAudioAccess ? <PlayerScreen .../> : <PermissionGate .../>;`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (hasAudioAccess) return <PlayerScreen controller={controller} onChooseFolder={onChooseFolder}/>;
    // return <PermissionGate onGrant={() => permissionLauncher.launch(audioPermission())}/>;
    // ```
    if (hasAudioAccess) {
        // What:     `PlayerScreen(controller = controller, onChooseFolder = onChooseFolder)`
        //           renders the main player with named args.
        // Why:      Access held -> show the player.
        // TS map:   `<PlayerScreen controller={controller} onChooseFolder={onChooseFolder}/>`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // <PlayerScreen controller={controller} onChooseFolder={onChooseFolder}/>
        // ```
        PlayerScreen(controller = controller, onChooseFolder = onChooseFolder)
    } else {
        // What:     `PermissionGate(onGrant = { permissionLauncher.launch(audioPermission()) })`
        //           renders the gate, passing an `onGrant` lambda that re-launches the
        //           permission request.
        // Why:      Access not held -> show the gate with a re-ask button.
        // TS map:   `<PermissionGate onGrant={() => permissionLauncher.launch(audioPermission())}/>`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // <PermissionGate onGrant={() => permissionLauncher.launch(audioPermission())}/>
        // ```
        PermissionGate(onGrant = { permissionLauncher.launch(audioPermission()) })
    }
}

// What:     `@Composable` marks the next function as a Compose component.
// Why:      `StartingGate` is a UI component.
// TS map:   No annotation in TS; a function returning UI is a component.
//
// In TS you'd write (pseudocode):
// ```ts
// // (component function)
// ```
@Composable
// What:     `private fun StartingGate() { ... }` declares a private no-arg composable.
// Why:      Brief placeholder shown while the activity binds to `PlaybackService`.
// TS map:   `function StartingGate() { ... }`.
//
// In TS you'd write (pseudocode):
// ```ts
// function StartingGate() { ... }
// ```
private fun StartingGate() {
    // What:     `Column( modifier = Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterVertically), horizontalAlignment = Alignment.CenterHorizontally, ) { ... }`
    //           calls the `Column` layout composable with named args and a trailing-lambda
    //           child. `Modifier.fillMaxSize().padding(24.dp)` is a chained modifier (fill the
    //           screen, then 24dp padding; `24.dp` is the `dp` extension on the literal).
    //           `Arrangement.spacedBy(12.dp, Alignment.CenterVertically)` spaces children 12dp
    //           apart, centered vertically; `Alignment.CenterHorizontally` centers them across.
    // Why:      Center the "Starting..." text on screen.
    // TS map:   `<Column modifier={...} verticalArrangement={...} horizontalAlignment={...}> ... </Column>`.
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
        // TS map:   `<Text>Starting Music Player...</Text>`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // <Text>Starting Music Player...</Text>
        // ```
        Text("Starting Music Player...")
    }
}

// What:     `@Composable` marks the next function as a Compose component.
// Why:      `PlayerScreen` is the main UI component.
// TS map:   No annotation in TS.
//
// In TS you'd write (pseudocode):
// ```ts
// // (component function)
// ```
@Composable
// What:     `fun PlayerScreen(controller: PlayerController, onChooseFolder: () -> Unit) { ... }`
//           declares a PUBLIC (Kotlin default) composable taking the brain and an
//           `onChooseFolder` callback (`() -> Unit`).
// Why:      The player screen, the desktop's narrow (single-column) layout: a seek bar, a
//           volume slider, a wrapping control row (open / shuffle / transport / repeat),
//           then the page tabs and the selected page's track list. No title bar, matching
//           the desktop's plain window. Tap a track to play it; tap the playing track to
//           pause or resume.
// TS map:   `function PlayerScreen({ controller, onChooseFolder }: { controller: PlayerController; onChooseFolder: () => void; }) { ... }`.
//
// In TS you'd write (pseudocode):
// ```ts
// function PlayerScreen(props: { controller: PlayerController; onChooseFolder: () => void; }) { ... }
// ```
fun PlayerScreen(controller: PlayerController, onChooseFolder: () -> Unit) {
    // What:     `val state = controller.uiState` reads the brain's Compose-observable
    //           snapshot. Reading the `uiState` (a Compose state) here SUBSCRIBES this
    //           composable, so it recomposes when the brain swaps in a new snapshot.
    // Why:      Render from the current UI snapshot.
    // TS map:   `const state = controller.uiState; // reading the signal subscribes`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const state = controller.uiState;
    // ```
    val state = controller.uiState
    // What:     `var position by remember { mutableDoubleStateOf(0.0) }` declares a
    //           state-backed `Double` local via the `useState` idiom: `remember` keeps it
    //           across recompositions, `mutableDoubleStateOf(0.0)` is the (number-specialized)
    //           observable holder seeded `0.0`, and `by` delegates get/set. `0.0` is a
    //           `Double` literal.
    // Why:      Holds the live playback position for the seek bar, updated by the poll loop.
    // TS map:   `const [position, setPosition] = useState(0);`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const [position, setPosition] = useState(0);
    // ```
    var position by remember { mutableDoubleStateOf(0.0) }
    // What:     `var duration by remember { mutableDoubleStateOf(0.0) }` declares another
    //           state-backed `Double` local (same `by remember { mutableDoubleStateOf(...) }`
    //           idiom) seeded `0.0`.
    // Why:      Holds the live track duration for the seek bar.
    // TS map:   `const [duration, setDuration] = useState(0);`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const [duration, setDuration] = useState(0);
    // ```
    var duration by remember { mutableDoubleStateOf(0.0) }

    // What:     `LaunchedEffect(Unit) { ... }` runs the trailing `suspend` block once on
    //           first entry (key `Unit`).
    // Why:      Start the position/duration polling loop.
    // TS map:   `useEffect(() => { startPolling(); return stop; }, []);`.
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
    // }, []);
    // ```
    LaunchedEffect(Unit) {
        // What:     `while (true) { ... }` is an infinite loop (it runs until the effect is
        //           cancelled when the composable leaves).
        // Why:      Continuously poll the engine while the screen is shown.
        // TS map:   `while (alive) { ... }` (the effect cleanup stops it).
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
            // TS map:   `setPosition(controller.positionSec());`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // setPosition(controller.positionSec());
            // ```
            position = controller.positionSec()
            // What:     `duration = controller.durationSec()` writes the latest duration
            //           through the `by` delegate.
            // Why:      Update the seek bar's total duration.
            // TS map:   `setDuration(controller.durationSec());`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // setDuration(controller.durationSec());
            // ```
            duration = controller.durationSec()
            // What:     `delay(POSITION_POLL_MS)` SUSPENDS the loop for the poll interval
            //           (without blocking a thread).
            // Why:      Poll at the configured cadence (200ms).
            // TS map:   `await delay(POSITION_POLL_MS);`.
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
    // TS map:   `<Scaffold>{(innerPadding) => ( ... )}</Scaffold>`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // <Scaffold>{(innerPadding) => (
    //   <Column modifier={...}> ... </Column>
    // )}</Scaffold>
    // ```
    Scaffold { innerPadding ->
        // What:     `Column( modifier = Modifier.fillMaxSize().padding(innerPadding).padding(horizontal = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp), ) { ... }`
        //           lays the screen out vertically. The modifier chain fills the screen, then
        //           applies the scaffold `innerPadding`, then 12dp horizontal padding (named
        //           `horizontal = 12.dp`). Children are spaced 8dp apart.
        // Why:      Stack the player controls with consistent spacing inside the safe area.
        // TS map:   `<Column modifier={Modifier.fillMaxSize().padding(innerPadding).padding({horizontal: dp(12)})} verticalArrangement={Arrangement.spacedBy(dp(8))}> ... </Column>`.
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
            // What:     `SeekRow(position = position, duration = duration, onSeek = { controller.seek(it) })`
            //           renders the seek bar. `onSeek` is a lambda using the implicit `it`
            //           (the seeked-to seconds) to call `controller.seek(it)`.
            // Why:      Show and drive the position scrubber.
            // TS map:   `<SeekRow position={position} duration={duration} onSeek={(sec) => controller.seek(sec)}/>`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // <SeekRow position={position} duration={duration} onSeek={(sec) => controller.seek(sec)}/>
            // ```
            SeekRow(position = position, duration = duration, onSeek = { controller.seek(it) })
            // What:     `VolumeRow(volume = state.volume, onVolume = { controller.setVolume(it) })`
            //           renders the volume slider; `onVolume`'s lambda uses `it` (the new gain).
            // Why:      Show and drive the volume control.
            // TS map:   `<VolumeRow volume={state.volume} onVolume={(v) => controller.setVolume(v)}/>`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // <VolumeRow volume={state.volume} onVolume={(v) => controller.setVolume(v)}/>
            // ```
            VolumeRow(volume = state.volume, onVolume = { controller.setVolume(it) })
            // What:     `ControlRow(state = state, controller = controller, onOpen = onChooseFolder)`
            //           renders the open/shuffle/transport/repeat row.
            // Why:      Show the main control buttons.
            // TS map:   `<ControlRow state={state} controller={controller} onOpen={onChooseFolder}/>`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // <ControlRow state={state} controller={controller} onOpen={onChooseFolder}/>
            // ```
            ControlRow(state = state, controller = controller, onOpen = onChooseFolder)
            // What:     `TrackPager(state = state, controller = controller)` renders the page
            //           tabs + track list. (Folds in the old inline note: page tabs and the
            //           track list share one scroll area, the desktop's narrow layout: a library
            //           with many folder pages would otherwise let the wrapping tab bar fill the
            //           column and leave the list no room, so the tabs scroll together with the
            //           tracks as one column.)
            // Why:      Show the browsable, scrollable track list.
            // TS map:   `<TrackPager state={state} controller={controller}/>`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // <TrackPager state={state} controller={controller}/>
            // ```
            TrackPager(state = state, controller = controller)
        }
    }
}

// What:     `@Composable` marks the next function as a Compose component.
// Why:      `SeekRow` is a UI component.
// TS map:   No annotation in TS.
//
// In TS you'd write (pseudocode):
// ```ts
// // (component function)
// ```
@Composable
// What:     `private fun SeekRow(position: Double, duration: Double, onSeek: (Double) -> Unit) { ... }`
//           declares a private composable. `onSeek: (Double) -> Unit` is a function type
//           "takes a `Double`, returns void" (TS `(n: number) => void`).
// Why:      Seek bar: elapsed time, a position slider over the track duration, and total
//           time.
// TS map:   `function SeekRow({ position, duration, onSeek }: { position: number; duration: number; onSeek: (n: number) => void; }) { ... }`.
//
// In TS you'd write (pseudocode):
// ```ts
// function SeekRow(props: { position: number; duration: number; onSeek: (n: number) => void; }) { ... }
// ```
private fun SeekRow(position: Double, duration: Double, onSeek: (Double) -> Unit) {
    // What:     `val maxValue = if (duration > 0.0) duration.toFloat() else 1.0f` declares
    //           `maxValue` from an `if/else` EXPRESSION. `duration.toFloat()` converts the
    //           `Double` to a `Float` (32-bit; the Slider API takes `Float`). `1.0f` is a
    //           `Float` literal (the `f` suffix; a bare `1.0` would be a `Double` and would
    //           not match). Type INFERRED as `Float`.
    // Why:      The slider needs a positive `Float` max; before a duration is known, fall
    //           back to `1.0f` to avoid a zero-length range.
    // TS map:   `const maxValue = duration > 0 ? duration : 1;` — TS has one `number`, so no
    //           `.toFloat()` and no `f` suffix.
    // Gotcha:   `1.0f` is a `Float` literal; the `f` is load-bearing because the branch type
    //           must match `duration.toFloat()` (a `Float`). `Double` and `Float` are
    //           distinct Kotlin types.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const maxValue = duration > 0 ? duration : 1;
    // ```
    val maxValue = if (duration > 0.0) duration.toFloat() else 1.0f
    // What:     `Row(verticalAlignment = Alignment.CenterVertically) { ... }` lays the seek
    //           controls out horizontally, vertically centered.
    // Why:      Put elapsed time, slider, and total time on one line.
    // TS map:   `<Row verticalAlignment={Alignment.CenterVertically}> ... </Row>`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // <Row verticalAlignment={Alignment.CenterVertically}> ... </Row>
    // ```
    Row(verticalAlignment = Alignment.CenterVertically) {
        // What:     `Text(formatTime(position))` shows the elapsed time as `m:ss` via
        //           `formatTime`.
        // Why:      Display the current position.
        // TS map:   `<Text>{formatTime(position)}</Text>`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // <Text>{formatTime(position)}</Text>
        // ```
        Text(formatTime(position))
        // What:     `Slider( value = position.toFloat().coerceIn(0.0f, maxValue), onValueChange = { onSeek(it.toDouble()) }, valueRange = 0.0f..maxValue, modifier = Modifier.weight(1.0f).padding(horizontal = 8.dp), )`
        //           renders the scrubber. `position.toFloat()` converts the `Double` to a
        //           `Float`; `.coerceIn(0.0f, maxValue)` CLAMPS it into range. `onValueChange`
        //           is a lambda using `it` (the new `Float`), converted back with
        //           `it.toDouble()`. `valueRange = 0.0f..maxValue` is a `ClosedFloatingPointRange`
        //           built with the `..` RANGE operator (a Kotlin range literal). The modifier
        //           gives it `weight(1.0f)` (take the remaining row width) plus horizontal
        //           padding.
        // Why:      A draggable position control spanning the row between the time labels.
        // TS map:   `<Slider value={clamp(position, 0, maxValue)} onValueChange={(v) => onSeek(v)} min={0} max={maxValue} .../>`
        //           — `0.0f..maxValue` is a `[0, maxValue]` range; `.weight(1.0f)` is `flex: 1`.
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
        // TS map:   `<Text>{formatTime(duration)}</Text>`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // <Text>{formatTime(duration)}</Text>
        // ```
        Text(formatTime(duration))
    }
}

// What:     `@Composable` marks the next function as a Compose component.
// Why:      `VolumeRow` is a UI component.
// TS map:   No annotation in TS.
//
// In TS you'd write (pseudocode):
// ```ts
// // (component function)
// ```
@Composable
// What:     `private fun VolumeRow(volume: Float, onVolume: (Float) -> Unit) { ... }`
//           declares a private composable taking a `Float` gain and an `(Float) -> Unit`
//           callback.
// Why:      Volume row: a "Volume" label and a 0..1 gain slider.
// TS map:   `function VolumeRow({ volume, onVolume }: { volume: number; onVolume: (n: number) => void; }) { ... }`.
//
// In TS you'd write (pseudocode):
// ```ts
// function VolumeRow(props: { volume: number; onVolume: (n: number) => void; }) { ... }
// ```
private fun VolumeRow(volume: Float, onVolume: (Float) -> Unit) {
    // What:     `Row(verticalAlignment = Alignment.CenterVertically) { ... }` lays out the
    //           label and slider on one centered line.
    // Why:      Put "Volume" next to its slider.
    // TS map:   `<Row verticalAlignment={Alignment.CenterVertically}> ... </Row>`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // <Row verticalAlignment={Alignment.CenterVertically}> ... </Row>
    // ```
    Row(verticalAlignment = Alignment.CenterVertically) {
        // What:     `Text("Volume")` shows the label.
        // Why:      Label the slider.
        // TS map:   `<Text>Volume</Text>`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // <Text>Volume</Text>
        // ```
        Text("Volume")
        // What:     `Slider( value = volume, onValueChange = onVolume, valueRange = 0.0f..1.0f, modifier = Modifier.weight(1.0f).padding(start = 8.dp), )`
        //           renders the gain slider. `value = volume` is the current `Float` gain;
        //           `onValueChange = onVolume` forwards the callback directly (no wrapping
        //           lambda needed); `valueRange = 0.0f..1.0f` is the `[0, 1]` `Float` range via
        //           `..`; the modifier weights it to fill and pads its start (leading) edge.
        // Why:      A 0..1 gain control filling the row after the label.
        // TS map:   `<Slider value={volume} onValueChange={onVolume} min={0} max={1} modifier={Modifier.weight(1).padding({ start: dp(8) })}/>`.
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
// Why:      `ControlRow` uses `FlowRow`, which is marked experimental.
// TS map:   No clean analogue; mentally a `// @ts-expect-error`-style acknowledgement,
//           except typed and intentional. `::class` has no TS equivalent.
//
// In TS you'd write (pseudocode):
// ```ts
// // @OptIn(ExperimentalLayoutApi) — acknowledge experimental FlowRow
// ```
@OptIn(ExperimentalLayoutApi::class)
// What:     `@Composable` marks the next function as a Compose component.
// Why:      `ControlRow` is a UI component.
// TS map:   No annotation in TS.
//
// In TS you'd write (pseudocode):
// ```ts
// // (component function)
// ```
@Composable
// What:     `private fun ControlRow(state: PlayerUiState, controller: PlayerController, onOpen: () -> Unit) { ... }`
//           declares a private composable taking the UI snapshot, the brain, and an
//           `onOpen` callback.
// Why:      Wrapping control row, in the desktop's order: Open (the folder picker), the
//           three-state shuffle radios, the transport buttons, and repeat-track.
// TS map:   `function ControlRow({ state, controller, onOpen }: { state: PlayerUiState; controller: PlayerController; onOpen: () => void; }) { ... }`.
//
// In TS you'd write (pseudocode):
// ```ts
// function ControlRow(props: { state: PlayerUiState; controller: PlayerController; onOpen: () => void; }) { ... }
// ```
private fun ControlRow(state: PlayerUiState, controller: PlayerController, onOpen: () -> Unit) {
    // What:     `FlowRow( horizontalArrangement = Arrangement.spacedBy(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp), ) { ... }`
    //           lays children left-to-right, WRAPPING to new lines on overflow, with 16dp
    //           horizontal and 8dp vertical gaps.
    // Why:      The controls wrap gracefully on narrow screens.
    // TS map:   `<FlowRow horizontalArrangement={...} verticalArrangement={...}> ... </FlowRow>` (flex-wrap).
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
        // What:     `Button(onClick = onOpen) { Text("Open") }` renders the Open button; its
        //           trailing lambda `{ Text("Open") }` is the button's CONTENT (label).
        // Why:      Launch the folder picker.
        // TS map:   `<Button onClick={onOpen}><Text>Open</Text></Button>`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // <Button onClick={onOpen}><Text>Open</Text></Button>
        // ```
        Button(onClick = onOpen) { Text("Open") }
        // What:     `Row(verticalAlignment = Alignment.CenterVertically) { ... }` groups the
        //           shuffle label and its three radios.
        // Why:      Keep "Shuffle" and its options together.
        // TS map:   `<Row verticalAlignment={Alignment.CenterVertically}> ... </Row>`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // <Row verticalAlignment={Alignment.CenterVertically}> ... </Row>
        // ```
        Row(verticalAlignment = Alignment.CenterVertically) {
            // What:     `Text("Shuffle")` labels the shuffle group.
            // Why:      Name the radios.
            // TS map:   `<Text>Shuffle</Text>`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // <Text>Shuffle</Text>
            // ```
            Text("Shuffle")
            // What:     `ShuffleOption("Off", state.shuffle == ShuffleMode.OFF) { controller.setShuffle(ShuffleMode.OFF) }`
            //           renders the "Off" radio. The second arg `state.shuffle == ShuffleMode.OFF`
            //           is its selected `Boolean` (enum value equality); the trailing lambda is
            //           its `onSelect` action setting the mode to `OFF`.
            // Why:      Let the user turn shuffle off.
            // TS map:   `<ShuffleOption label="Off" selected={state.shuffle === ShuffleMode.OFF} onSelect={() => controller.setShuffle(ShuffleMode.OFF)}/>`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // <ShuffleOption label="Off" selected={state.shuffle === ShuffleMode.OFF} onSelect={() => controller.setShuffle(ShuffleMode.OFF)}/>
            // ```
            ShuffleOption("Off", state.shuffle == ShuffleMode.OFF) { controller.setShuffle(ShuffleMode.OFF) }
            // What:     `ShuffleOption("Within page", state.shuffle == ShuffleMode.WITHIN_PAGE) { controller.setShuffle(ShuffleMode.WITHIN_PAGE) }`
            //           renders the "Within page" radio (selected when the mode is
            //           `WITHIN_PAGE`; its action sets that mode).
            // Why:      Let the user shuffle within the current page only.
            // TS map:   `<ShuffleOption label="Within page" selected={state.shuffle === ShuffleMode.WITHIN_PAGE} onSelect={() => controller.setShuffle(ShuffleMode.WITHIN_PAGE)}/>`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // <ShuffleOption label="Within page" selected={state.shuffle === ShuffleMode.WITHIN_PAGE} onSelect={() => controller.setShuffle(ShuffleMode.WITHIN_PAGE)}/>
            // ```
            ShuffleOption("Within page", state.shuffle == ShuffleMode.WITHIN_PAGE) {
                controller.setShuffle(ShuffleMode.WITHIN_PAGE)
            }
            // What:     `ShuffleOption("All", state.shuffle == ShuffleMode.ALL) { controller.setShuffle(ShuffleMode.ALL) }`
            //           renders the "All" radio (selected when the mode is `ALL`; its action
            //           sets that mode).
            // Why:      Let the user shuffle the whole queue.
            // TS map:   `<ShuffleOption label="All" selected={state.shuffle === ShuffleMode.ALL} onSelect={() => controller.setShuffle(ShuffleMode.ALL)}/>`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // <ShuffleOption label="All" selected={state.shuffle === ShuffleMode.ALL} onSelect={() => controller.setShuffle(ShuffleMode.ALL)}/>
            // ```
            ShuffleOption("All", state.shuffle == ShuffleMode.ALL) { controller.setShuffle(ShuffleMode.ALL) }
        }
        // What:     `Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) { ... }`
        //           groups the transport buttons with 8dp gaps.
        // Why:      Keep Prev/Play/Next together.
        // TS map:   `<Row verticalAlignment={Alignment.CenterVertically} horizontalArrangement={Arrangement.spacedBy(dp(8))}> ... </Row>`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // <Row verticalAlignment={Alignment.CenterVertically} horizontalArrangement={Arrangement.spacedBy(dp(8))}> ... </Row>
        // ```
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            // What:     `Button(onClick = { controller.prev() }) { Text("Prev") }` renders the
            //           Prev button; the `onClick` lambda calls `controller.prev()`; the trailing
            //           lambda is the label.
            // Why:      Skip to the previous track.
            // TS map:   `<Button onClick={() => controller.prev()}><Text>Prev</Text></Button>`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // <Button onClick={() => controller.prev()}><Text>Prev</Text></Button>
            // ```
            Button(onClick = { controller.prev() }) { Text("Prev") }
            // What:     `Button(onClick = { controller.togglePlay() }) { Text(if (state.playing) "Pause" else "Play") }`
            //           renders the play/pause button. The content `Text(...)` takes an
            //           `if/else` EXPRESSION choosing the label "Pause" vs "Play" from
            //           `state.playing`.
            // Why:      Toggle play/pause, showing the matching label.
            // TS map:   `<Button onClick={() => controller.togglePlay()}><Text>{state.playing ? "Pause" : "Play"}</Text></Button>`.
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
            // TS map:   `<Button onClick={() => controller.next()}><Text>Next</Text></Button>`.
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
        // TS map:   `<Row verticalAlignment={Alignment.CenterVertically}> ... </Row>`.
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
            // TS map:   `<Checkbox checked={state.repeatTrack} onCheckedChange={(on) => controller.setRepeatTrack(on)}/>`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // <Checkbox checked={state.repeatTrack} onCheckedChange={(on) => controller.setRepeatTrack(on)}/>
            // ```
            Checkbox(checked = state.repeatTrack, onCheckedChange = { controller.setRepeatTrack(it) })
            // What:     `Text("Repeat track")` labels the checkbox.
            // Why:      Name the toggle.
            // TS map:   `<Text>Repeat track</Text>`.
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
// Why:      `ShuffleOption` is a UI component.
// TS map:   No annotation in TS.
//
// In TS you'd write (pseudocode):
// ```ts
// // (component function)
// ```
@Composable
// What:     `private fun ShuffleOption(label: String, selected: Boolean, onSelect: () -> Unit) { ... }`
//           declares a private composable for one shuffle radio.
// Why:      One shuffle radio: a Material3 radio and its label, the whole pair clickable.
// TS map:   `function ShuffleOption({ label, selected, onSelect }: { label: string; selected: boolean; onSelect: () => void; }) { ... }`.
//
// In TS you'd write (pseudocode):
// ```ts
// function ShuffleOption(props: { label: string; selected: boolean; onSelect: () => void; }) { ... }
// ```
private fun ShuffleOption(label: String, selected: Boolean, onSelect: () -> Unit) {
    // What:     `Row( verticalAlignment = Alignment.CenterVertically, modifier = Modifier.clickable { onSelect() }, ) { ... }`
    //           lays out the radio and label, with `Modifier.clickable { onSelect() }` making
    //           the WHOLE row tappable (the trailing lambda is the click handler).
    // Why:      Allow tapping anywhere on the radio+label pair to select it.
    // TS map:   `<Row verticalAlignment={Alignment.CenterVertically} modifier={Modifier.clickable(() => onSelect())}> ... </Row>`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // <Row
    //   verticalAlignment={Alignment.CenterVertically}
    //   modifier={Modifier.clickable(() => onSelect())}
    // > ... </Row>
    // ```
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.clickable { onSelect() },
    ) {
        // What:     `RadioButton(selected = selected, onClick = onSelect)` renders the radio
        //           dot; `selected` shows its filled state; `onClick = onSelect` forwards the
        //           selection action.
        // Why:      Show and drive the radio.
        // TS map:   `<RadioButton selected={selected} onClick={onSelect}/>`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // <RadioButton selected={selected} onClick={onSelect}/>
        // ```
        RadioButton(selected = selected, onClick = onSelect)
        // What:     `Text(label)` shows the option's label.
        // Why:      Name the radio.
        // TS map:   `<Text>{label}</Text>`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // <Text>{label}</Text>
        // ```
        Text(label)
    }
}

// What:     `@OptIn(ExperimentalLayoutApi::class)` acknowledges the experimental `FlowRow`
//           used by `PageTabs` (see the same annotation on `ControlRow`).
// Why:      `PageTabs` uses `FlowRow`.
// TS map:   No clean analogue; an intentional experimental-API opt-in.
//
// In TS you'd write (pseudocode):
// ```ts
// // @OptIn(ExperimentalLayoutApi)
// ```
@OptIn(ExperimentalLayoutApi::class)
// What:     `@Composable` marks the next function as a Compose component.
// Why:      `PageTabs` is a UI component.
// TS map:   No annotation in TS.
//
// In TS you'd write (pseudocode):
// ```ts
// // (component function)
// ```
@Composable
// What:     `private fun PageTabs(state: PlayerUiState, onSelectPage: (Int) -> Unit) { ... }`
//           declares a private composable taking the snapshot and an `(Int) -> Unit`
//           page-select callback.
// Why:      Page-tab grid: one button per page, the active page filled, the rest outlined.
// TS map:   `function PageTabs({ state, onSelectPage }: { state: PlayerUiState; onSelectPage: (n: number) => void; }) { ... }`.
//
// In TS you'd write (pseudocode):
// ```ts
// function PageTabs(props: { state: PlayerUiState; onSelectPage: (n: number) => void; }) { ... }
// ```
private fun PageTabs(state: PlayerUiState, onSelectPage: (Int) -> Unit) {
    // What:     `FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp)) { ... }` lays the
    //           tab buttons left-to-right, wrapping, with 4dp gaps.
    // Why:      A wrapping grid of page tabs.
    // TS map:   `<FlowRow horizontalArrangement={Arrangement.spacedBy(dp(4))}> ... </FlowRow>`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // <FlowRow horizontalArrangement={Arrangement.spacedBy(dp(4))}> ... </FlowRow>
    // ```
    FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        // What:     `state.pageLabels.forEachIndexed { page, label -> ... }` iterates the page
        //           labels WITH their indices. `forEachIndexed { page, label -> ... }` is a
        //           trailing lambda whose two parameters are the index `page` (an `Int`) and the
        //           element `label` (a `String`), written before `->`.
        // Why:      Emit one tab button per page, knowing each page's index.
        // TS map:   `state.pageLabels.forEach((label, page) => { ... });` — Kotlin's
        //           `forEachIndexed` passes `(index, value)`, the OPPOSITE order of JS's
        //           `forEach((value, index))`.
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
            // TS map:   `page === state.selectedPage ? <Button onClick={() => onSelectPage(page)}><Text>{label}</Text></Button> : <OutlinedButton .../>`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // if (page === state.selectedPage)
            //   return <Button onClick={() => onSelectPage(page)}><Text>{label}</Text></Button>;
            // return <OutlinedButton onClick={() => onSelectPage(page)}><Text>{label}</Text></OutlinedButton>;
            // ```
            if (page == state.selectedPage) {
                // What:     `Button(onClick = { onSelectPage(page) }) { Text(label) }` renders the
                //           active (filled) tab.
                // Why:      Highlight the current page.
                // TS map:   `<Button onClick={() => onSelectPage(page)}><Text>{label}</Text></Button>`.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // <Button onClick={() => onSelectPage(page)}><Text>{label}</Text></Button>
                // ```
                Button(onClick = { onSelectPage(page) }) { Text(label) }
            } else {
                // What:     `OutlinedButton(onClick = { onSelectPage(page) }) { Text(label) }`
                //           renders an inactive (outlined) tab.
                // Why:      Show the other selectable pages.
                // TS map:   `<OutlinedButton onClick={() => onSelectPage(page)}><Text>{label}</Text></OutlinedButton>`.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // <OutlinedButton onClick={() => onSelectPage(page)}><Text>{label}</Text></OutlinedButton>
                // ```
                OutlinedButton(onClick = { onSelectPage(page) }) { Text(label) }
            }
        }
    }
}

// What:     `@Composable` marks the next function as a Compose component.
// Why:      `TrackPager` is a UI component.
// TS map:   No annotation in TS.
//
// In TS you'd write (pseudocode):
// ```ts
// // (component function)
// ```
@Composable
// What:     `private fun ColumnScope.TrackPager(state: PlayerUiState, controller: PlayerController) { ... }`
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
// TS map:   TS has no extension functions; mentally a `TrackPager` component that must be
//           rendered inside a `Column` (so it can use `weight`). Picture
//           `function TrackPager(this: ColumnScope, props: {...})`.
// Gotcha:   The `ColumnScope.` receiver is what grants `Modifier.weight(...)`; calling this
//           outside a `Column` would not compile.
//
// In TS you'd write (pseudocode):
// ```ts
// // must be rendered inside a <Column>; uses column-only weight()
// function TrackPager(props: { state: PlayerUiState; controller: PlayerController; }) { ... }
// ```
private fun ColumnScope.TrackPager(state: PlayerUiState, controller: PlayerController) {
    // What:     `if (state.queueSize == 0) { ... }` checks for an empty queue (`==` integer
    //           equality).
    // Why:      An empty queue shows either a loading notice or a "no music" message, then
    //           nothing else.
    // TS map:   `if (state.queueSize === 0) { ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (state.queueSize === 0) { ... }
    // ```
    if (state.queueSize == 0) {
        // What:     `if (state.loading) { LoadingNotice() } else { Text("No music found in your audio library.") }`
        //           branches the empty-queue UI. (Folds in the old inline note: an empty queue
        //           means "no music" only once loading has finished; during a scan, a chosen
        //           folder can take seconds, show a loading notice instead of the
        //           failure-sounding message.)
        // Why:      Distinguish "still scanning" from "truly empty".
        // TS map:   `state.loading ? <LoadingNotice/> : <Text>No music found in your audio library.</Text>`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (state.loading) return <LoadingNotice/>;
        // return <Text>No music found in your audio library.</Text>;
        // ```
        if (state.loading) {
            // What:     `LoadingNotice()` renders the spinner + loading line.
            // Why:      Show progress during a scan.
            // TS map:   `<LoadingNotice/>`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // <LoadingNotice/>
            // ```
            LoadingNotice()
        } else {
            // What:     `Text("No music found in your audio library.")` renders the empty
            //           message.
            // Why:      Tell the user no tracks were found once loading finished.
            // TS map:   `<Text>No music found in your audio library.</Text>`.
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
        // TS map:   `return;`.
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
    // TS map:   `<LazyColumn modifier={Modifier.fillMaxWidth().weight(1, { fill: true })}> ... </LazyColumn>`
    //           — `.weight(1)` is `flex: 1`.
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
        // TS map:   `if (state.pageLabels.length > 0) { ... }`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (state.pageLabels.length > 0) { ... }
        // ```
        if (state.pageLabels.isNotEmpty()) {
            // What:     `item { PageTabs(state = state, onSelectPage = { controller.selectPage(it) }) }`
            //           emits ONE list item (`item { ... }` is the `LazyListScope` builder for a
            //           single row) holding the `PageTabs`. Its `onSelectPage` lambda uses `it`
            //           (the chosen page index).
            // Why:      Make the tab bar the first scrolling row.
            // TS map:   `<ListItem><PageTabs state={state} onSelectPage={(p) => controller.selectPage(p)}/></ListItem>`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // item(() => (
            //   <PageTabs state={state} onSelectPage={(p) => controller.selectPage(p)}/>
            // ));
            // ```
            item {
                // What:     `PageTabs(state = state, onSelectPage = { controller.selectPage(it) })`
                //           renders the tab bar; `it` is the page index passed to `selectPage`.
                // Why:      Show the page tabs.
                // TS map:   `<PageTabs state={state} onSelectPage={(p) => controller.selectPage(p)}/>`.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // <PageTabs state={state} onSelectPage={(p) => controller.selectPage(p)}/>
                // ```
                PageTabs(state = state, onSelectPage = { controller.selectPage(it) })
            }
        }
        // What:     `items(state.pageItems) { item -> ... }` emits one list row per element of
        //           `state.pageItems`. `items(list) { item -> ... }` is the `LazyListScope`
        //           builder; the trailing lambda's `item` parameter is one `PageEntry`.
        // Why:      Render the visible page's tracks as scrolling rows.
        // TS map:   `state.pageItems.map((item) => <TrackRow item={item} .../>)` inside the
        //           virtualized list.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // items(state.pageItems, (item) => (
        //   <TrackRow item={item} state={state} controller={controller}/>
        // ));
        // ```
        items(state.pageItems) { item ->
            // What:     `TrackRow(item = item, state = state, controller = controller)` renders
            //           one track row from the page entry.
            // Why:      Show and drive a single track row.
            // TS map:   `<TrackRow item={item} state={state} controller={controller}/>`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // <TrackRow item={item} state={state} controller={controller}/>
            // ```
            TrackRow(item = item, state = state, controller = controller)
        }
    }
}

// What:     `@Composable` marks the next function as a Compose component.
// Why:      `TrackRow` is a UI component.
// TS map:   No annotation in TS.
//
// In TS you'd write (pseudocode):
// ```ts
// // (component function)
// ```
@Composable
// What:     `private fun TrackRow(item: PageEntry, state: PlayerUiState, controller: PlayerController) { ... }`
//           declares a private composable for one track row, taking the entry, the snapshot,
//           and the brain.
// Why:      One track row: its path relative to the loaded root, highlighted when it is the
//           current track. Tap a row to play it; tap the current row to toggle play/pause.
// TS map:   `function TrackRow({ item, state, controller }: { item: PageEntry; state: PlayerUiState; controller: PlayerController; }) { ... }`.
//
// In TS you'd write (pseudocode):
// ```ts
// function TrackRow(props: { item: PageEntry; state: PlayerUiState; controller: PlayerController; }) { ... }
// ```
private fun TrackRow(item: PageEntry, state: PlayerUiState, controller: PlayerController) {
    // What:     `val isCurrent = item.index == state.currentIndex` declares a `Boolean`
    //           `isCurrent` comparing this row's load-order `index` (an `Int`) to the
    //           snapshot's `currentIndex` (an `Int?`). `==` is null-safe value equality (a
    //           null `currentIndex` simply is not equal).
    // Why:      Decide whether to highlight this row as the playing track.
    // TS map:   `const isCurrent = item.index === state.currentIndex;`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const isCurrent = item.index === state.currentIndex;
    // ```
    val isCurrent = item.index == state.currentIndex
    // What:     `val rowBackground = if (isCurrent) MaterialTheme.colorScheme.primary else Color.Transparent`
    //           picks the row background from an `if/else` EXPRESSION: the theme primary when
    //           current, otherwise transparent.
    // Why:      Visually mark the current track.
    // TS map:   `const rowBackground = isCurrent ? MaterialTheme.colorScheme.primary : Color.Transparent;`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const rowBackground = isCurrent ? MaterialTheme.colorScheme.primary : Color.Transparent;
    // ```
    val rowBackground = if (isCurrent) MaterialTheme.colorScheme.primary else Color.Transparent
    // What:     `val rowColor = if (isCurrent) { MaterialTheme.colorScheme.onPrimary } else { MaterialTheme.colorScheme.onSurface }`
    //           picks the text color from an `if/else` EXPRESSION: the on-primary color when
    //           current (readable on the highlight), otherwise the on-surface color.
    // Why:      Keep the text readable against whichever background is used.
    // TS map:   `const rowColor = isCurrent ? MaterialTheme.colorScheme.onPrimary : MaterialTheme.colorScheme.onSurface;`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const rowColor = isCurrent
    //   ? MaterialTheme.colorScheme.onPrimary
    //   : MaterialTheme.colorScheme.onSurface;
    // ```
    val rowColor = if (isCurrent) {
        // What:     `MaterialTheme.colorScheme.onPrimary` is the `then`-branch value: the color
        //           meant to sit on top of the primary color.
        // Why:      Readable text over the highlighted background.
        // TS map:   `MaterialTheme.colorScheme.onPrimary` (ternary true arm).
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
        // TS map:   `MaterialTheme.colorScheme.onSurface` (ternary false arm).
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
    // TS map:   `const rowLabel = state.pageLabels[state.selectedPage] ?? "";`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const rowLabel = state.pageLabels[state.selectedPage] ?? "";
    // ```
    val rowLabel: String = state.pageLabels.getOrNull(state.selectedPage).orEmpty()
    // What:     `val rowText: String = rowDisplay(rowLabel, item.name)` declares a read-only
    //           `String`: the text to SHOW. `rowDisplay` strips the `<rowLabel>/` folder prefix
    //           on folder tabs, or returns the whole name on letter / `#` tabs (see
    //           `Pagination.kt`).
    // Why:      A folder tab already names its folder, so the row shows only the path below it.
    // TS map:   `const rowText = rowDisplay(rowLabel, item.name);`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const rowText = rowDisplay(rowLabel, item.name);
    // ```
    val rowText: String = rowDisplay(rowLabel, item.name)
    // What:     `Text( text = rowText, color = rowColor, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.fillMaxWidth().background(rowBackground).clickable { ... }.padding(horizontal = 8.dp, vertical = 8.dp), )`
    //           renders the row as a single `Text`. Named args: `text` is the trimmed display
    //           name (`rowText`); `color` is `rowColor`; `maxLines = 1` and
    //           `overflow = TextOverflow.Ellipsis` clip long names with an ellipsis. The
    //           `modifier` chain fills the width, paints `rowBackground`, makes the row
    //           `clickable { ... }` (the trailing lambda is the tap handler), then pads it.
    // Why:      Show the track name (folder-tab prefix trimmed), highlight it when current, and
    //           handle taps.
    // TS map:   `<Text style={{ color: rowColor }} numberOfLines={1} ellipsizeMode="tail" modifier={Modifier.fillMaxWidth().background(rowBackground).clickable(onTap).padding(...)}>{rowText}</Text>`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // <Text
    //   color={rowColor}
    //   maxLines={1}
    //   overflow={TextOverflow.Ellipsis}
    //   modifier={Modifier.fillMaxWidth().background(rowBackground).clickable(onTap).padding({ horizontal: dp(8), vertical: dp(8) })}
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
                // TS map:   `console.info(`[${LOG_TAG}] tap row ${item.index} (current=${state.currentIndex})`);`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // console.info(`[${LOG_TAG}] tap row ${item.index} (current=${state.currentIndex})`);
                // ```
                Log.i(LOG_TAG, "tap row ${item.index} (current=${state.currentIndex})")
                // What:     `if (item.index == state.currentIndex) { controller.togglePlay() } else { controller.playIndex(item.index) }`
                //           branches the tap: tapping the CURRENT row toggles play/pause; tapping
                //           another row plays that track. `==` is null-safe value equality.
                // Why:      Tap-to-play, with the current row acting as play/pause.
                // TS map:   `item.index === state.currentIndex ? controller.togglePlay() : controller.playIndex(item.index);`.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // if (item.index === state.currentIndex) controller.togglePlay();
                // else controller.playIndex(item.index);
                // ```
                if (item.index == state.currentIndex) {
                    // What:     `controller.togglePlay()` toggles play/pause on the current track.
                    // Why:      Tapping the playing row pauses/resumes it.
                    // TS map:   `controller.togglePlay();`.
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
                    // TS map:   `controller.playIndex(item.index);`.
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
// Why:      `LoadingNotice` is a UI component.
// TS map:   No annotation in TS.
//
// In TS you'd write (pseudocode):
// ```ts
// // (component function)
// ```
@Composable
// What:     `private fun LoadingNotice() { ... }` declares a private no-arg composable.
// Why:      Shown while a library load or folder scan runs: a spinner and a short loading
//           line.
// TS map:   `function LoadingNotice() { ... }`.
//
// In TS you'd write (pseudocode):
// ```ts
// function LoadingNotice() { ... }
// ```
private fun LoadingNotice() {
    // What:     `Row( verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.padding(vertical = 12.dp), ) { ... }`
    //           lays the spinner and text on one centered line, 12dp apart, with vertical
    //           padding.
    // Why:      Put the spinner next to its label.
    // TS map:   `<Row verticalAlignment={...} horizontalArrangement={...} modifier={Modifier.padding({ vertical: dp(12) })}> ... </Row>`.
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
        // TS map:   `<CircularProgressIndicator modifier={Modifier.size(dp(20))}/>`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // <CircularProgressIndicator modifier={Modifier.size(dp(20))}/>
        // ```
        CircularProgressIndicator(modifier = Modifier.size(20.dp))
        // What:     `Text("Loading your library…")` shows the loading line.
        // Why:      Tell the user the library is loading.
        // TS map:   `<Text>Loading your library…</Text>`.
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
// TS map:   `function formatTime(seconds: number): string { ... }`.
//
// In TS you'd write (pseudocode):
// ```ts
// function formatTime(seconds: number): string { ... }
// ```
private fun formatTime(seconds: Double): String {
    // What:     `val total = seconds.toInt()` declares `total` (inferred `Int`) by converting
    //           the `Double` to an `Int` with `.toInt()`, which TRUNCATES toward zero (drops
    //           the fraction).
    // Why:      Work in whole seconds for the `m:ss` split.
    // TS map:   `const total = Math.trunc(seconds);` — `.toInt()` truncates, like `Math.trunc`.
    // Gotcha:   `.toInt()` truncates (does not round); `3.9` becomes `3`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const total = Math.trunc(seconds);
    // ```
    val total = seconds.toInt()
    // What:     `val minutes = total / SECONDS_PER_MINUTE` declares `minutes` (inferred `Int`)
    //           via INTEGER DIVISION: `Int / Int` discards the remainder (so `127 / 60` is
    //           `2`).
    // Why:      The minutes part of `m:ss`.
    // TS map:   `const minutes = Math.trunc(total / SECONDS_PER_MINUTE);` — JS `/` is float
    //           division, so you must truncate to mimic Kotlin's integer `/`.
    // Gotcha:   Kotlin `Int / Int` is INTEGER division (truncates); JS `/` is always float, so
    //           the TS equivalent needs `Math.trunc`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const minutes = Math.trunc(total / SECONDS_PER_MINUTE);
    // ```
    val minutes = total / SECONDS_PER_MINUTE
    // What:     `val secs = total % SECONDS_PER_MINUTE` declares `secs` (inferred `Int`) via
    //           the MODULO operator `%` (the remainder after dividing by 60).
    // Why:      The seconds part of `m:ss`.
    // TS map:   `const secs = total % SECONDS_PER_MINUTE;` — `%` works the same on integers.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const secs = total % SECONDS_PER_MINUTE;
    // ```
    val secs = total % SECONDS_PER_MINUTE
    // What:     `return "%d:%02d".format(minutes, secs)` formats and returns the result.
    //           `"%d:%02d".format(...)` is a method ON the `String` literal: `%d` is an
    //           integer, `%02d` is an integer zero-padded to width 2 (so `7` becomes `07`).
    // Why:      Produce `m:ss` like `3:07`.
    // TS map:   `return `${minutes}:${String(secs).padStart(2, "0")}`;` — Kotlin's
    //           `String.format` printf-style placeholders become manual padding in TS.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return `${minutes}:${String(secs).padStart(2, "0")}`;
    // ```
    return "%d:%02d".format(minutes, secs)
}

// What:     `@Composable` marks the next function as a Compose component.
// Why:      `PermissionGate` is a UI component.
// TS map:   No annotation in TS.
//
// In TS you'd write (pseudocode):
// ```ts
// // (component function)
// ```
@Composable
// What:     `private fun PermissionGate(onGrant: () -> Unit) { ... }` declares a private
//           composable taking an `onGrant` callback (`() -> Unit`).
// Why:      Shown until audio access is granted: a one-line rationale and a button that
//           re-requests the permission, so a user who declined the first prompt still has a
//           way back in.
// TS map:   `function PermissionGate({ onGrant }: { onGrant: () => void; }) { ... }`.
//
// In TS you'd write (pseudocode):
// ```ts
// function PermissionGate(props: { onGrant: () => void; }) { ... }
// ```
private fun PermissionGate(onGrant: () -> Unit) {
    // What:     `Column( modifier = Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterVertically), horizontalAlignment = Alignment.CenterHorizontally, ) { ... }`
    //           centers the rationale and button (same layout shape as `StartingGate`).
    // Why:      Present the access rationale and grant button centered on screen.
    // TS map:   `<Column modifier={...} verticalArrangement={...} horizontalAlignment={...}> ... </Column>`.
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
        // TS map:   `<Text>Music Player needs access to your audio library to list your music.</Text>`.
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
        // TS map:   `<Button onClick={onGrant}><Text>Grant access</Text></Button>`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // <Button onClick={onGrant}><Text>Grant access</Text></Button>
        // ```
        Button(onClick = onGrant) { Text("Grant access") }
    }
}
