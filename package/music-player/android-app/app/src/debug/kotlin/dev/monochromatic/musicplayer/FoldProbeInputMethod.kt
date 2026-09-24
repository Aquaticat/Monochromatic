// Debug-only IME probe. Never ship this service or use it for private text.
package dev.monochromatic.musicplayer

// What: InputMethodService lets this debug app draw a system-managed text-input window.
// Why: Its window tests real IME occlusion when the emulator's Gboard view is absent.
//
// In TS you'd write (pseudocode):
// ```ts
// import { SystemInputMethodService } from "android";
// ```
import android.inputmethodservice.InputMethodService

// What: Color defines the debug keyboard's dark background and contrasting text.
// Why: A distinct painted IME proves the input window is actually visible in captures.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Color } from "android";
// ```
import android.graphics.Color

// What: View is the Android UI object returned to the system as the keyboard surface.
// Why: The service must provide a visible input view for the inset test.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { View } from "android";
// ```
import android.view.View

// What: Button provides a tap target that inserts a known sample query into the focused editor.
// Why: The captured state must demonstrate text entry while the IME occupies the display.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Button } from "android";
// ```
import android.widget.Button

// What: LinearLayout stacks the probe label and its single sample key.
// Why: A fixed-height pane gives the app a measurable IME obstruction.
//
// In TS you'd write (pseudocode):
// ```ts
// import { LinearLayout } from "android";
// ```
import android.widget.LinearLayout

// What: TextView labels the probe as a test-only keyboard, not the device's Gboard.
// Why: Reviewers must not mistake synthetic occlusion for a Gboard usability check.
//
// In TS you'd write (pseudocode):
// ```ts
// import { TextView } from "android";
// ```
import android.widget.TextView

/**
 * What: A throwaway Android keyboard which always draws a 300dp input view when requested.
 * Why: It exercises system IME insets even with the Fold emulator reporting a hardware keyboard.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * class FoldProbeInputMethod extends SystemInputMethodService {
 *   shouldDisplayInputView(): boolean { return true; }
 *   createInputView(): View { return makeProbeWithSampleKey("cam"); }
 * }
 * ```
 */
class FoldProbeInputMethod : InputMethodService() {
    /**
     * What: Override the input-view decision rather than relying on the hardware-keyboard default.
     * Why: We need to measure Search under a visible software keyboard on this AVD.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * shouldDisplayInputView(): boolean { return true; }
     * ```
     */
    override fun onEvaluateInputViewShown(): Boolean = true

    /**
     * What: Return a native Android view inside the system-controlled IME window.
     * Why: The window must obscure part of the app while a real input connection types a query.
     *
     * In TS you'd write (pseudocode):
     * ```ts
     * createInputView(): View { return makeProbeWithSampleKey("cam"); }
     * ```
     */
    override fun onCreateInputView(): View {
        val heightPx = (300 * resources.displayMetrics.density).toInt()
        val pane = LinearLayout(this)
        pane.orientation = LinearLayout.VERTICAL
        pane.setBackgroundColor(Color.rgb(36, 40, 48))
        pane.layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, heightPx)
        val label = TextView(this)
        label.text = "Debug keyboard probe, 300dp system IME window"
        label.setTextColor(Color.WHITE)
        label.textSize = 20f
        label.setPadding(24, 24, 24, 24)
        pane.addView(label)
        val sampleKey = Button(this)
        sampleKey.text = "Type cam"
        sampleKey.setOnClickListener {
            currentInputConnection?.commitText("cam", 1)
        }
        pane.addView(sampleKey)
        return pane
    }
}
