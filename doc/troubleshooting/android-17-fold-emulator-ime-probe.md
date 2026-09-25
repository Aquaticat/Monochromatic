# Android 17 Fold emulator Gboard opens a physical-keyboard toolbar instead of keys on Search focus

## Symptom

On the Pixel 9 Pro Fold emulator 37.1.11.0, Android 17 SDK 37,
Gboard `versionCode=175753756`, focusing a Compose Search query can report an active
IME while the screenshot contains no on-screen keys.
A later Google Messages Search probe also showed no keys.
Earlier in this design session, Messages did show a split keyboard,
so this is not a demonstrated permanent emulator capability limit.
The focused query and an `input_method` visibility report alone cannot prove
that the playback deck remains visible during software-keyboard use.
A subsequent probe found a **per-editor Gboard workaround**:
open the side toolbar's bottom menu and choose `Show on-screen keyboard`.
Real, floating keys then appeared and a key tap changed the Search query.
This does not yet establish docked or split Gboard behavior.

This is distinct from a separate, confirmed app-layout finding:
under a visible system-managed keyboard, a bottom-anchored Search prototype
covered the lower portion of its playback deck at 200% text.
Do not attribute that layout failure to Gboard.

## Root cause and limits of the diagnosis

The reason Gboard did not draw its keys in these later probes is **unresolved**.
Gboard's implementation is not available in the local Android SDK sources;
we cannot identify which Gboard decision or system state produced the discrepancy.
Changing `show_ime_with_hard_keyboard`, restarting Gboard, recreating Search,
and reproducing in Messages did not establish a cause.
Gboard's `Physical keyboard` preferences were also tested:
`Show on-screen keyboard` changed from off to on, and `Show toolbar` changed
from on to off after temporarily turning the former off.
Neither setting combination, nor a Gboard restart, made keys appear on
fresh Search focus.
The separate **toolbar-menu action** did make keys appear, but the next
fresh-focus probe returned to the side toolbar.
Repeating that action after restoring the original off/on preference switches
again produced the floating keys, so the preference changes were unnecessary
for this workaround.
Do not equate the preference switch with the per-editor action.
Google's [Pixel Tablet keyboard guidance](https://support.google.com/googlepixeltablet/answer/13555948?hl=en)
describes a Gboard toolbar with a physical keyboard and a Floating keyboard
mode; it does not establish which layout this Fold emulator should choose.

Android's public framework does establish why a replacement IME is a valid
occlusion probe.
The local SDK source,
`/home/user/Android/Sdk/sources/android-37.0/android/inputmethodservice/InputMethodService.java:2389-2400`,
checks whether an IME should show its input view:

```java
if (mSettingsObserver.shouldShowImeWithHardKeyboard()) {
    return true;
}
Configuration config = getResources().getConfiguration();
return config.keyboard == Configuration.KEYBOARD_NOKEYS
        || config.hardKeyboardHidden == Configuration.HARDKEYBOARDHIDDEN_YES;
```

This is the framework's *default* decision, not a source trace of Gboard.
At `InputMethodService.java:2347-2357`, the framework shows or hides the
input frame according to the IME's decision and creates its view:

```java
boolean isShown = mShowInputRequested && onEvaluateInputViewShown();
mInputFrame.setVisibility(isShown ? View.VISIBLE : View.GONE);
if (mInputView == null) {
    View v = onCreateInputView();
    if (v != null) {
        setInputView(v);
    }
}
```

The view supplied by the debug IME needs its own measured minimum height.
`InputMethodService.java:2521-2524` supplies a fresh wrap-content parent layout:

```java
public void setInputView(View view) {
    mInputFrame.removeAllViews();
    mInputFrame.addView(view, new FrameLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT));
    mInputView = view;
}
```

Setting only the returned view's parent layout parameters did **not** give
our first probe the requested 300dp height; the rendered window was shorter.
Setting `minimumHeight` on the returned view made the dark input surface fill
approximately 300dp on this 390dpi AVD.
That correction is in throwaway prototype commit `60e01dfab`.

The floating Gboard also explains why the selected deck did not lift in that
probe.
`adb -s emulator-5554 shell dumpsys window` reported a visible IME
`InsetsSource` frame `[0,2152][2076,2152]` and an IME bottom-inset hint
of `0`, despite its separately reported keyboard touchable region.
`/home/user/Android/Sdk/sources/android-37.0/android/view/InsetsSource.java:441-457`
returns no inset without an intersection, and otherwise maps IME intersection
height to a bottom inset:

```java
final boolean hasIntersection = relativeFrame.isEmpty()
        ? getIntersection(frame, relativeFrame, mTmpFrame)
        : mTmpFrame.setIntersect(frame, relativeFrame);
if (!hasIntersection) {
    return Insets.NONE;
}
if (getType() == WindowInsets.Type.ime()) {
    return Insets.of(0, 0, 0, mTmpFrame.height());
}
```

The zero-height server source and the unlifted deck agree for this device
state.

Android 17 also exposes a flagged `WindowInsets.getBoundingRects(typeMask)`
API for obscuring regions (`WindowInsets.java:525-553`).
`InsetsState.java:383-391` computes that public map from each source:

```java
final Insets insets = source.calculateInsets(relativeFrame, hostBounds, ignoreVisibility);
final Rect[] boundingRects = source.calculateBoundingRects(relativeFrame, hostBounds,
        ignoreVisibility);
processSourceAsPublicType(source, typeInsetsMap, idSideMap, typeVisibilityMap,
        typeBoundingRectsMap, insets, boundingRects, type);
```

The observed IME source had a zero-height frame and no `boundingRects` or
`insetsBoundingRects` entries in `dumpsys window`.
`InsetsSource.java:595-608` returns no rectangle when those arrays are absent
and the frame does not intersect the app window:

```java
if (mBoundingRects == null && mInsetsBoundingRects == null) {
    return mTmpFrame2.setIntersect(mTmpFrame, relativeFrame)
            ? new Rect[]{
                    new Rect(
                            mTmpFrame2.left - relativeFrame.left,
                            mTmpFrame2.top - relativeFrame.top,
                            mTmpFrame2.right - relativeFrame.left,
                            mTmpFrame2.bottom - relativeFrame.top
                    )
            }
            : EMPTY_RECTS;
}
```

The empty branch is the relevant one for the measured source.
`InsetsSource.java:839-848` prints either array when present, which is why
its absence in the server dump matters.
Thus this **observed IME source** offers neither a bottom inset nor a
floating-keyboard bounding rectangle through these framework paths.
This is not proof that every app-observable keyboard API lacks the geometry
or that floating overlays are impossible to avoid by other means.

## Verification

- Check the installed emulator and Gboard versions:

  ```sh
  /home/user/Android/Sdk/emulator/emulator -version
  adb -s emulator-5554 shell dumpsys package com.google.android.inputmethod.latin
  ```

- The debug-only implementation is on branch
  `prototype/music-player-theme-compose` at
  `package/music-player/android-app/app/src/debug/kotlin/dev/monochromatic/musicplayer/FoldProbeInputMethod.kt`.
  Build and install with
  `ANDROID_SERIAL=emulator-5554 mise run //package/music-player/android-app:prototype:install`
  from that worktree.
  `adb -s emulator-5554 shell ime enable dev.monochromatic.musicplayer/.FoldProbeInputMethod`
  and `adb -s emulator-5554 shell ime set dev.monochromatic.musicplayer/.FoldProbeInputMethod`
  select the probe after launching the activity.
  Selecting the probe **before** `am force-stop dev.monochromatic.musicplayer`
  may revert the selected input method to Gboard because this debug IME
  shares the activity's package.
- With the emulator unfolded at font scale `2.0`, launch
  `dev.monochromatic.musicplayer/.DesignCandidateActivity` with
  `--es candidate search-deck-inner-right-empty-light`, focus the query,
  tap the probe's `Type cam` key, then capture the inner HWC display 0.
  The query becomes `cam`; the result heading, result lines, all playback
  mode labels, transport controls, and the system-managed input pane are
  visible together.
  The mirrored candidate,
  `search-deck-inner-mirrored-empty-light`, also passes this visible-state
  check with Search on the left and the deck on the right.
  The committed
  throwaway matrix task `prototype:capture:choices` captured right,
  mirrored and IME-lifted placements in both schemes at 100% and 200%.
  At 200%, `dumpsys window windows` reported `InputMethod` frame
  `[0,1421][2076,2152]`, or 731px on the 390dpi inner panel.
  The task restored Gboard as the selected method and disabled the probe.
- A separate cover-panel check at 200% inserted `cam` while the same input
  method occupied `[0,1693][1080,2424]`.
  The query and both sample results
  remained visible above its input surface.
  The cover returned to the
  unfolded state and original 100% text setting after this check.
- The previously bottom-anchored right candidate, captured with the same
  initial probe before moving the deck, displayed its lower mode controls
  behind the input window at 200% text.
  Even the first, shorter probe was a positive control for occlusion;
  it was not a valid measurement of a 300dp keyboard.
- With the selected Search study focused on the 2076 × 2152px inner panel,
  the repeatable scratch harness
  `/home/user/temp/agent/probe-fold-gboard.mjs` verified a focused
  `EditText` and reported Gboard touchable regions
  `[19,790,157,1436]` and `[0,2074,2076,2152]`, without a key-sized
  region.
  Opening the side toolbar menu at `(90,1360)` and tapping
  `Show on-screen keyboard` at approximately `(510,1118)` at 100% text
  displayed a real floating Gboard at x `[274,1180)`, y `[288,1059)`.
  A tap on one letter changed the focused query to `x` and produced the
  corresponding no-results state.
  A fresh app launch and focus returned to the toolbar-only state.
  Repeating the toolbar-menu action with Gboard's original off/on physical
  keyboard preferences also produced real floating keys.
- At 200% text, the same menu action at approximately `(515,1080)` displayed
  floating Gboard keys over x `[274,1180)`, y `[310,1081)`.
  The deck title `Another Xronixle` occupied
  `[258,1042][781,1145]` in the UI hierarchy.
  Their overlap is x `[274,781)`, y `[1042,1081)`, and the screenshot
  visibly obscured part of the title.
  Dragging the floating keyboard lower moved its region to approximately
  x `[564,1470)`, y `[1245,2016)`, obscuring more controls;
  this was **not** a successful docking test.
  These observations are a counterexample to assuming the selected layout
  meets D50 under every real Gboard mode.
- The cover-panel fresh-focus probe also showed only the toolbar:
  touchable x `[19,157)`, y `[944,1590)` plus the navigation area.
  Its toolbar-menu action exposed real floating keys at approximately
  x `[0,830)`, y `[304,1025)`.
  Tapping the real keys entered `cam` in a focused cover Search field.
  The UI hierarchy placed the matching folder label `Camellia` at
  `[127,374][286,433]` and track title `Another Xronixle` at
  `[127,569][432,628]`, both fully under Gboard's key surface.
  The captured Search screenshot showed the query but no visible result
  data until the floating keyboard was dismissed or moved.
  This is a separate cover Search result-visibility defect,
  not the unfolded deck-title overlap.

The debug input method is deliberately synthetic, **not Gboard**.
Its measured overlap tests bottom-window occlusion and text input integration;
it does not establish Gboard's docked height, split shape, or suggestions.
The later floating-keyboard evidence tests real Gboard, but not its docked
or split layouts.

## Verified workaround

Use the debug-only `FoldProbeInputMethod`, which overrides
`onEvaluateInputViewShown()` to return `true`, gives its view a measured
300dp minimum height, and commits the sample query via
`currentInputConnection.commitText("cam", 1)`.
Capture after verifying the query has changed and the input view is rendered.
The probe uses a generic dark slab and one sample key; it cannot validate
Gboard-specific spacing or user-facing keyboard behavior.

The Gboard side-toolbar menu's `Show on-screen keyboard` action exposes
real keys for the focused editor without switching to the debug IME.
It is a temporary, floating-keyboard action, not a persistent default
or a docked-keyboard geometry test.
At 200% text, it covers part of the selected Search deck;
therefore it is **not** a workaround for D50.

For bottom-keyboard design comparisons, anchor the unfolded deck above a
visible keyboard rather than treating a keyboard-closed capture as D50 evidence.
Do not change the production app based solely on either probe.

## What does not work

- Query focus, a true IME visibility flag, or an XML node alone:
  none proves that an actual keyboard surface occludes app content.
- Toggling `show_ime_with_hard_keyboard` between `0` and `1`, changing
  Gboard's physical-keyboard preference switches, restarting Gboard,
  or trying Messages again: these probes did not restore keys
  reliably on a fresh Search focus.
- Dragging floating Gboard toward the bottom did not dock it in this probe;
  the overlay moved over the deck without generating a bottom keyboard inset.
- Assigning `layoutParams` with a 300dp height to the debug IME's returned
  view: the framework supplies wrap-content parent parameters;
  the first probe appeared shorter than its label.
- The old `capture-search-deck.mjs` screenshots: they were taken before
  the deck-first revisions and have no visible keyboard.

## Upstream filing decision

The `.out-of-scope/` entries do not exempt this Android symptom.
A `gh search issues` query for
`Android emulator Gboard physical keyboard not showing soft keyboard`
returned no matching GitHub issues, but GitHub is not the Gboard issue tracker.
No upstream report is ready:

1. **Upstream fault:** Unknown. The same Gboard build previously drew keys,
   and current behavior has not been isolated from emulator state or app focus.
2. **Fixability:** Unknown without the responsible path.
3. **Supported use case:** Android documents custom IMEs and soft-keyboard use,
   but that does not identify a Gboard regression.
4. **Contribution policy:** Gboard is not an identified public source repository
   with reviewed contribution or AI-assistance policy for this path.
5. **Expected upstream response:** No comparable maintainer signal was established.
6. **Tested upstream fix:** None. The custom IME is a consumer-side measurement
   workaround, not a patch for Gboard.

### Draft, do not file as-is

~~~md
Android 17 Fold emulator: Gboard's physical-keyboard toolbar lacks keys on fresh Search focus

On emulator 37.1.11.0, Pixel 9 Pro Fold, Android 17 SDK 37,
Gboard versionCode 175753756, focusing the music-player debug Search
shows a side toolbar without keys.
The toolbar's Show on-screen keyboard action brings up a usable floating
keyboard, but another fresh focus returns to the toolbar-only state.
At 200% text the floating keyboard obscures the selected player's deck title.
Docked and split Gboard were not established;
no upstream attribution or fix is proposed.
~~~

The [Android IME guide](https://developer.android.com/develop/ui/views/touch-and-input/creating-input-method)
explains the supported input-method extension point used for the probe.
