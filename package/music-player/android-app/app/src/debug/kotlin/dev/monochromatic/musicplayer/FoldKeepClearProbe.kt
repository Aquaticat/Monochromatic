// Debug-only probe of a best-effort Android window placement hint.
package dev.monochromatic.musicplayer

// What:     Rect describes one screen region that the app asks floating windows to avoid.
// Why:      The original folder browser and playback deck occupy the left pane.
//
// In TS you'd write (pseudocode):
// ```ts
// type Rect = { left: number; top: number; right: number; bottom: number };
// ```
import android.graphics.Rect
// What:     Build checks the Android API level before using a newer view method.
// Why:      The debug APK can also be installed on older devices than this API 37 Fold.
//
// In TS you'd write (pseudocode):
// ```ts
// if (androidVersion >= 33) askSystemToKeepClear(rect);
// ```
import android.os.Build
// What:     Log records whether the keep-clear request was installed or removed.
// Why:      A static screenshot cannot prove the app sent a window-manager hint.
//
// In TS you'd write (pseudocode):
// ```ts
// logger.info("keep-clear area installed", rect);
// ```
import android.util.Log
// What:     WindowInsets exposes the native navigation-bar height inside this view.
// Why:      The requested rectangle must end before the system navigation strip.
//
// In TS you'd write (pseudocode):
// ```ts
// const bottom = view.height - view.insets.navigationBarBottom;
// ```
import android.view.WindowInsets
// What:     Composable ties the throwaway hint to one debug Search candidate.
// Why:      No accepted UI or production screen should receive this preference.
//
// In TS you'd write (pseudocode):
// ```ts
// function FoldKeepClearProbe(active: boolean): void {}
// ```
import androidx.compose.runtime.Composable
// What:     DisposableEffect removes the window hint when the candidate leaves composition.
// Why:      A later control cannot be compared if this probe's hint leaks into it.
//
// In TS you'd write (pseudocode):
// ```ts
// onMount(() => { install(); return remove; });
// ```
import androidx.compose.runtime.DisposableEffect
// What:     LocalView gives the activity's already attached view the public keep-clear API.
// Why:      Window Manager collects this app window's own preferred clear regions.
//
// In TS you'd write (pseudocode):
// ```ts
// const host = currentActivity.view;
// ```
import androidx.compose.ui.platform.LocalView

/**
 * What:     Ask Android to keep a measured left-pane area clear of floating windows.
 * Why:      Test whether real Gboard honors this best-effort preference on the Fold.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function FoldKeepClearProbe(active: boolean): void {
 *   if (active) currentView.requestKeepClear(leftDeckRect);
 * }
 * ```
 */
@Composable
internal fun FoldKeepClearProbe(active: Boolean) {
    val host = LocalView.current
    // What:     DisposableEffect scopes one rectangle to the enabled fixture.
    // Why:      The no-hint control must not inherit this window-manager request.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // useEffect(() => active ? installAndReturnCleanup() : undefined, [active, host]);
    // ```
    DisposableEffect(host, active) {
        if (!active || Build.VERSION.SDK_INT < 33 || host.width == 0) {
            // No valid on-screen area exists until the attached view is measured.
            onDispose { }
        } else {
            // What:     `?.` and `?:` preserve a zero fallback if native insets are absent.
            // Why:      The app never requests that Gboard move behind system navigation.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const navigationBottom = host.insets?.navigationBarBottom ?? 0;
            // ```
            val navigationBottom = host.rootWindowInsets
                ?.getInsets(WindowInsets.Type.navigationBars())?.bottom ?: 0
            // What:     Rect holds the left half from the measured lower browser to navigation.
            // Why:      This hint covers the actual deck without placing meaning on the crease.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const area = { left: 0, top: height / 3,
            //   right: width / 2, bottom: height - navigationBottom };
            // ```
            val area = Rect(0, host.height / 3, host.width / 2,
                host.height - navigationBottom)
            host.setPreferKeepClearRects(listOf(area))
            Log.i("SearchKeepClearProbe", "requested rect=$area")
            onDispose {
                host.setPreferKeepClearRects(emptyList())
                Log.i("SearchKeepClearProbe", "removed")
            }
        }
    }
}
