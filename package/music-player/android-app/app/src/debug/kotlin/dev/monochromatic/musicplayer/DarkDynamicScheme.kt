// This file belongs only to the throwaway design prototype.
// It applies Android's generated dark roles while preserving the project's true-black rule.

// What:     `package` places these helpers in the app's existing Android namespace.
// Why:      The activity can call them without a cross-package import.
//
// In TS you'd write (pseudocode):
// ```ts
// // The source path supplies the module namespace.
// ```
package dev.monochromatic.musicplayer

// What:     `Context` identifies the running Android application and its resolved system resources.
// Why:      Compose reads the current Android dynamic palette through this object.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { AndroidContext } from 'android';
// ```
import android.content.Context

// What:     `Build` exposes the Android platform version running the prototype.
// Why:      Android dynamic color exists only on Android 12 and newer.
//
// In TS you'd write (pseudocode):
// ```ts
// import { androidVersion } from 'android';
// ```
import android.os.Build

// What:     `ColorScheme` stores paired Material colors; `darkColorScheme` supplies a pre-Android-12
//           fallback; `dynamicDarkColorScheme` reads Android-generated roles.
// Why:      Every dark candidate needs one complete Material scheme rather than unrelated literals.
//
// In TS you'd write (pseudocode):
// ```ts
// import { createDarkScheme, readDynamicDarkScheme } from 'material3';
// import type { ColorScheme } from 'material3';
// ```
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme

// What:     `Color` stores one packed ARGB color for Compose drawing.
// Why:      The standing true-black ladder has explicit fixed values in strategy A.
//
// In TS you'd write (pseudocode):
// ```ts
// type Color = number;
// ```
import androidx.compose.ui.graphics.Color

/**
 * What:     `TrueBlack` is a module-visible immutable Compose color.
 * Why:      Every candidate needs the same pure-black canvas required by the standing theme rule.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * const trueBlack: Color = 0xff000000;
 * ```
 */
internal val TrueBlack: Color = Color.Black

/**
 * What:     `Color(...)` wraps one packed ARGB integer as a Compose color value.
 * Why:      The first accepted stable container step must remain byte-exact across wallpapers.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * const stableDarkContainerLow: Color = 0xff0a0a0d;
 * ```
 */
internal val StableDarkContainerLow: Color = Color(0xFF0A0A0D)

/** Later color declaration for the middle stable project-owned container step. */
private val StableDarkContainer: Color = Color(0xFF121216)

/** Later color declaration for the higher stable project-owned container step. */
private val StableDarkContainerHigh: Color = Color(0xFF1A1A1F)

/** Later color declaration for the highest stable project-owned container step. */
private val StableDarkContainerHighest: Color = Color(0xFF22222A)

/**
 * What:     `darkDynamicSchemeFor` is a Kotlin function with typed Android context and candidate
 *           parameters and a typed Material color-scheme return.
 * Why:      It reads Android's current dark dynamic roles and applies only the strategy-specific
 *           true-black override from one ownership boundary.
 *
 * Strategy `stable` keeps Android-generated accents and foregrounds but restores the complete fixed
 * B2 surface ladder. Strategies `zoned` and `tonal` retain Android-generated container roles while
 * overriding the base canvas to pure black.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function darkDynamicSchemeFor(props: {
 *   context: AndroidContext;
 *   candidate: string;
 * }): ColorScheme;
 * ```
 */
internal fun darkDynamicSchemeFor(context: Context, candidate: String): ColorScheme {
    // What:     Kotlin's `if` can return a value, unlike a TypeScript `if` statement.
    // Why:      Android 12+ exposes generated Material roles while older versions need fallback roles.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const generatedScheme = androidVersion >= 12
    //   ? readDynamicDarkScheme(context)
    //   : createDarkScheme();
    // ```
    val generatedScheme = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        dynamicDarkColorScheme(context)
    } else {
        darkColorScheme()
    }
    if (candidate == "dark-stable") {
        // What:     Kotlin data-class `copy` duplicates a value while replacing named properties.
        // Why:      Stable strategy keeps dynamic accents but substitutes the accepted fixed surface ladder.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return { ...generatedScheme, surface: trueBlack, /* fixed container roles */ };
        // ```
        return generatedScheme.copy(
            background = TrueBlack,
            surface = TrueBlack,
            surfaceDim = TrueBlack,
            surfaceContainerLowest = TrueBlack,
            surfaceContainerLow = StableDarkContainerLow,
            surfaceContainer = StableDarkContainer,
            surfaceContainerHigh = StableDarkContainerHigh,
            surfaceContainerHighest = StableDarkContainerHighest,
        )
    }
    // Later data-class copy retains generated containers and replaces only the standing base canvas.
    return generatedScheme.copy(
        background = TrueBlack,
        surface = TrueBlack,
        surfaceDim = TrueBlack,
    )
}
