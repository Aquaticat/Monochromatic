// Debug-only marker, not a proposed player UI or production keyboard workaround.
package dev.monochromatic.musicplayer

// What:     PixelFormat chooses whether a separate Android window can contain transparency.
// Why:      The marker must reveal both keyboard and app geometry in the same screenshot.
//
// In TS you'd write (pseudocode):
// ```ts
// const windowFormat = "translucent";
// ```
import android.graphics.PixelFormat
// What:     Log records which separate Android window was installed and removed.
// Why:      A screenshot alone cannot distinguish a new window from Compose drawing behind the IME.
//
// In TS you'd write (pseudocode):
// ```ts
// logger.info("debug overlay installed");
// ```
import android.util.Log
// What:     Gravity anchors the marker to the physical display's upper-left origin.
// Why:      Its location must be repeatable when the floating keyboard moves.
//
// In TS you'd write (pseudocode):
// ```ts
// const position = { left: 0, top: displayHeight / 3 };
// ```
import android.view.Gravity
// What:     View supplies the accessibility constant for a noninteractive test marker.
// Why:      This experimental layer must not be mistaken for a playback control.
//
// In TS you'd write (pseudocode):
// ```ts
// marker.ariaHidden = true;
// ```
import android.view.View
// What:     WindowManager creates a separate app-owned window with explicit IME layering flags.
// Why:      A Compose z-index inside the main window cannot test cross-window ordering.
//
// In TS you'd write (pseudocode):
// ```ts
// windowManager.addWindow(marker, options);
// ```
import android.view.WindowManager
// What:     TextView makes the independent window recognizable in a physical screenshot.
// Why:      A visual marker lets us reject a window that accidentally stays behind Gboard.
//
// In TS you'd write (pseudocode):
// ```ts
// const marker = document.createElement("div");
// ```
import android.widget.TextView
// What:     Composable lets the debug-only marker follow one Search candidate's lifetime.
// Why:      The accepted review and all other candidates must remain unchanged.
//
// In TS you'd write (pseudocode):
// ```ts
// function DebugMarker({ active }: { active: boolean }): void {}
// ```
import androidx.compose.runtime.Composable
// What:     DisposableEffect installs and removes a native window with composition lifetime.
// Why:      Leaving an overlay behind would invalidate subsequent comparison captures.
//
// In TS you'd write (pseudocode):
// ```ts
// onMount(() => { install(); return remove; });
// ```
import androidx.compose.runtime.DisposableEffect
// What:     LocalView identifies the activity view whose token owns the attached window.
// Why:      The probe must stay inside this disposable app, without overlay permission.
//
// In TS you'd write (pseudocode):
// ```ts
// const host = currentActivity.view;
// ```
import androidx.compose.ui.platform.LocalView

/**
 * What:     A visible, non-focusable window marker above an input method.
 * Why:      Test whether painting the deck above a floating IME prevents usable typing.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function FoldAboveImeMarker(active: boolean): void {
 *   if (active) installWindow({ focusable: false, touchable: false });
 * }
 * ```
 */
@Composable
internal fun FoldAboveImeMarker(active: Boolean) {
    val host = LocalView.current
    // What:     DisposableEffect scopes a separate window to the active debug candidate.
    // Why:      Changing candidate or leaving Search removes the experimental window.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // useEffect(() => active ? installAndReturnCleanup() : undefined, [active, host]);
    // ```
    DisposableEffect(host, active) {
        if (!active || host.windowToken == null || host.width == 0) {
            // The host has no attached window to probe yet.
            onDispose { }
        } else {
            val manager = host.context.getSystemService(WindowManager::class.java)
            // What:     TextView constructs a visible label without adding a second input field.
            // Why:      The Search editor below must keep focus for the real Gboard key test.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const marker = document.createElement("div");
            // ```
            val marker = TextView(host.context)
            marker.text = "DEBUG ABOVE IME: deck-layer probe"
            marker.setTextColor(0xff101840.toInt())
            marker.setBackgroundColor(0xe0dce5ff.toInt())
            marker.importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
            // What:     LayoutParams makes a half-panel app subwindow that cannot take focus or touches.
            // Why:      The input should remain with Search; cross-UID Gboard taps test Android's rule.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const options = { width: width / 2, height: height / 2,
            //   focusable: false, touchable: false, aboveKeyboard: true };
            // ```
            val options = WindowManager.LayoutParams(
                host.width / 2,
                host.height / 2,
                WindowManager.LayoutParams.TYPE_APPLICATION_PANEL,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.TRANSLUCENT,
            )
            options.token = host.windowToken
            options.gravity = Gravity.TOP or Gravity.START
            options.y = host.height / 3
            manager.addView(marker, options)
            Log.i("SearchLayerProbe", "installed type=${options.type} flags=${options.flags} " +
                "rect=(0,${options.y},${options.width},${options.y + options.height})")
            onDispose {
                manager.removeView(marker)
                Log.i("SearchLayerProbe", "removed")
            }
        }
    }
}
