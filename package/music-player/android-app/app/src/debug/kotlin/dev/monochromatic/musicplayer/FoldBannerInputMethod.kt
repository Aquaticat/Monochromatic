// Debug-only height stressor. This is not Gboard or a production input method.
package dev.monochromatic.musicplayer

// What: InputMethodService creates a genuine system-managed inset source.
// Why: A fixed tall IME can replay the measured banner-height constraint.
// In TS you'd write: import { InputMethodService } from "android";
import android.inputmethodservice.InputMethodService

// What: Color distinguishes the synthetic keyboard from Gboard captures.
// Why: Reviewers must identify the simulated height without a separate legend.
// In TS you'd write: import { Color } from "android";
import android.graphics.Color

// What: View is the system-managed keyboard surface.
// Why: The Android input-method host requests a concrete input view.
// In TS you'd write: import type { View } from "android";
import android.view.View

// What: A Button inserts sample text through the focused input connection.
// Why: Query entry still needs to be exercised under the tall system inset.
// In TS you'd write: import { Button } from "android";
import android.widget.Button

// What: LinearLayout owns a measured keyboard window rather than a screen overlay.
// Why: Compose must receive a real inset when this fixture is selected.
// In TS you'd write: import { LinearLayout } from "android";
import android.widget.LinearLayout

// What: TextView labels the fixture and its height at the user boundary.
// Why: A debug capture must not be mistaken for a real Gboard state.
// In TS you'd write: import { TextView } from "android";
import android.widget.TextView

/**
 * What: A disposable 415dp system IME for the observed 200% banner-height study.
 * Why: Fixed height permits repeatable geometry and typing checks without claiming Gboard parity.
 * In TS you'd write: class FoldBannerInputMethod extends InputMethodService {};
 */
class FoldBannerInputMethod : InputMethodService() {
    /**
     * What: Keep the test IME visible on a Fold emulator with a hardware input device.
     * Why: An absent input view would make the layout stress test vacuous.
     * In TS you'd write: shouldDisplayInputView(): boolean { return true; }.
     */
    override fun onEvaluateInputViewShown(): Boolean = true

    /**
     * What: Build one measured system keyboard surface with a real query key.
     * Why: A bottom inset must constrain the app while Search remains editable.
     * In TS you'd write: createInputView(): View { return makeTallInputView(415); }.
     */
    override fun onCreateInputView(): View {
        val heightPx = (415 * resources.displayMetrics.density).toInt()
        val pane = LinearLayout(this)
        pane.orientation = LinearLayout.VERTICAL
        pane.setBackgroundColor(Color.rgb(36, 40, 48))
        pane.minimumHeight = heightPx
        val label = TextView(this)
        label.text = "Debug 415dp height stress, not Gboard"
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
