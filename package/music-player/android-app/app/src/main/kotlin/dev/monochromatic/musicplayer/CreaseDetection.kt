// What:     `package dev.monochromatic.musicplayer` places the crease check beside the other player composables.
// Why:      The wide Settings page needs to know whether the device has a crease, which only the platform can say.
//
// In TS you'd write (pseudocode):
// ```ts
// // Module identity comes from the file path.
// ```
package dev.monochromatic.musicplayer

// What:     Imports from `androidx.compose.runtime` and `android.content` bring in the remembered value and
//           the context.
// Why:      The answer is a property of the device, so it is read once per composition from the system.
//
// In TS you'd write (pseudocode):
// ```ts
// import { useMemo } from "react";
// ```
import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext

// What:     `private const val HINGE_ANGLE_FEATURE: String` names the system feature of a device with a hinge.
// Why:      Android declares `android.hardware.sensor.hinge_angle` (`PackageManager.FEATURE_SENSOR_HINGE_ANGLE`) on a
//           device whose body bends at a hinge; flat tablets and slab phones do not declare it. The Jetpack
//           WindowManager `FoldingFeature` is the richer source, but `androidx.window` is not a declared dependency
//           of this module, so the check uses the platform feature that needs nothing new.
//
// In TS you'd write (pseudocode):
// ```ts
// const HINGE_ANGLE_FEATURE = "android.hardware.sensor.hinge_angle";
// ```
/** Name of the system feature that a device with a hinge declares. */
private const val HINGE_ANGLE_FEATURE: String = "android.hardware.sensor.hinge_angle"

// What:     `internal fun deviceHasCrease(context: Context): Boolean` asks the platform whether the device has a hinge.
// Why:      D110 spaces the wide Settings panes and its text around a crease only on a device that has one.
//
// In TS you'd write (pseudocode):
// ```ts
// const deviceHasCrease = (context: Context): boolean => context.packageManager.hasSystemFeature(HINGE_ANGLE_FEATURE);
// ```
/** Whether the device declares a hinge, which is the signal that its screen has a crease. */
internal fun deviceHasCrease(context: Context): Boolean =
    context.packageManager.hasSystemFeature(HINGE_ANGLE_FEATURE)

// What:     `@Composable fun rememberCreaseWidthPx(): Float?` gives the crease width, or null without a crease.
// Why:      The platform feature reports that a hinge exists but not its width, so a device with one reports a width
//           of zero and the physical 7.5 mm floor of E2 sets the clearance.
//
// In TS you'd write (pseudocode):
// ```ts
// function useCreaseWidthPx(): number | null { return deviceHasCrease(ctx) ? 0 : null; }
// ```
/** Crease width in physical pixels as the platform reports it (zero when only its presence is known), or null. */
@Composable
fun rememberCreaseWidthPx(): Float? {
    /** Context whose package manager answers the feature query. */
    val context: Context = LocalContext.current
    return remember(context) { if (deviceHasCrease(context)) 0f else null }
}
