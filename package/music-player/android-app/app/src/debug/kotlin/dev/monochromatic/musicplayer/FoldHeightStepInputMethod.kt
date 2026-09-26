// Debug-only height-step IME. It is neither Gboard nor a production keyboard.
package dev.monochromatic.musicplayer

// What: Android's service owns a system keyboard window, not an app overlay.
// Why: Each height step should deliver a real IME inset to the Search activity.
// In TS you'd write (pseudocode): import { InputMethodService } from 'android';
import android.inputmethodservice.InputMethodService

// What: Color gives the debug input view a distinct, opaque surface.
// Why: A capture must not confuse this fixture with Gboard.
// In TS you'd write (pseudocode): import { Color } from 'android';
import android.graphics.Color

// What: View is the Android object returned as the input-method surface.
// Why: The framework measures this surface for its IME window.
// In TS you'd write (pseudocode): import type { View } from 'android';
import android.view.View

// What: Button gives each step an explicit tappable input control.
// Why: ADB can trigger height changes without private keyboard state.
// In TS you'd write (pseudocode): import { Button } from 'android';
import android.widget.Button

// What: LinearLayout stacks the label and controls inside the IME window.
// Why: Its minimum height can be changed while Search stays focused.
// In TS you'd write (pseudocode): import { LinearLayout } from 'android';
import android.widget.LinearLayout

// What: TextView identifies the current simulated height on screen.
// Why: A captured frame needs an independent visible height cue.
// In TS you'd write (pseudocode): import { TextView } from 'android';
import android.widget.TextView

/**
 * What: A throwaway IME that changes its window height in measured steps.
 * Why: D50 needs in-place height growth and shrinkage across the deck's fit boundary.
 * In TS you'd write (pseudocode): class FoldHeightStepInputMethod extends InputMethodService {};
 */
class FoldHeightStepInputMethod : InputMethodService() {
    /**
     * What: Always show the test input view even if the emulator has a physical keyboard.
     * Why: Without a drawn IME, no deck-occlusion measurement is meaningful.
     * In TS you'd write (pseudocode): shouldDisplayInputView(): boolean { return true; }.
     */
    override fun onEvaluateInputViewShown(): Boolean = true

    /**
     * What: Create controls for stepping a native keyboard view through bounded heights.
     * Why: The app can stay focused while the system updates its IME geometry.
     * In TS you'd write (pseudocode): createInputView(): View { return makeSteppedKeyboard(); }.
     */
    override fun onCreateInputView(): View {
        // Fixed test heights bracket the measured banner-fit boundary on this 390dpi Fold.
        val stepsDp = listOf(330, 360, 370, 372, 375, 400, 415)
        var currentStep = 0
        val pane = LinearLayout(this)
        pane.orientation = LinearLayout.VERTICAL
        pane.setBackgroundColor(Color.rgb(36, 40, 48))
        val label = TextView(this)
        label.setTextColor(Color.WHITE)
        label.textSize = 20f
        label.setPadding(24, 24, 24, 24)
        pane.addView(label)
        // A Kotlin lambda puts its parameter before `->`; the closest TS shape is `(index) => { ... }`.
        val showStep = { index: Int ->
            currentStep = index
            val heightDp = stepsDp[index]
            pane.minimumHeight = (heightDp * resources.displayMetrics.density).toInt()
            label.text = "Debug ${heightDp}dp height step, not Gboard"
            pane.requestLayout()
        }
        val sampleKey = Button(this)
        sampleKey.text = "Type cam"
        sampleKey.setOnClickListener {
            currentInputConnection?.commitText("cam", 1)
        }
        pane.addView(sampleKey)
        val increase = Button(this)
        increase.text = "Increase height"
        increase.setOnClickListener {
            showStep(minOf(currentStep + 1, stepsDp.lastIndex))
        }
        pane.addView(increase)
        val decrease = Button(this)
        decrease.text = "Decrease height"
        decrease.setOnClickListener {
            showStep(maxOf(currentStep - 1, 0))
        }
        pane.addView(decrease)
        showStep(0)
        return pane
    }
}
