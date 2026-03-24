# iOS Safari touch event handling: the `touch-action` betrayal

## The problem

iOS Safari claims to support `touch-action: none` (since iOS 13, 2019),
but does not reliably honor it.
The browser can still intercept touch sequences for its own gesture recognition
(scroll, page zoom, context menu, text selection),
firing `pointercancel` and killing the application's pointer event stream mid-gesture.

This means any interactive canvas, drawing surface, map control, or custom gesture handler
that relies on `touch-action: none` to suppress native gestures
**silently breaks on every iPhone and iPad** while working perfectly on every other browser.

## Symptoms

- Tap-to-zoom, drag-to-pan, and other single-pointer gestures do nothing
- Long-press gestures trigger the iOS context menu instead of the application action
- `pointerup` never fires after `pointerdown` -- the browser swallows it via `pointercancel`
- Draw/paint strokes cut off mid-gesture when iOS decides the touch is a scroll
- Everything works on desktop Chrome, Firefox, and Safari; fails only on iOS Safari

## Root cause

WebKit bug [133112](https://bugs.webkit.org/show_bug.cgi?id=133112) tracks `touch-action` support.
The bug was filed in **2014** and resolved as "CONFIGURATION CHANGED" -- not "FIXED".
Only `touch-action: manipulation` and `touch-action: pan-y` were fully implemented.
`touch-action: none` was added later with partial, unreliable behavior.

The W3C Pointer Events specification states that `touch-action: none` must prevent the browser
from consuming touch input for built-in behaviors (scrolling, pinch-zoom, navigation gestures).
When the browser decides to handle a touch natively, it fires `pointercancel` to signal
that the application should abandon the gesture.
WebKit fires `pointercancel` even when `touch-action: none` is set on the target element,
violating the specification.

The result: `touch-action: none` is a CSS property that means "none" on Chromium and Gecko,
and "some, whenever we feel like it" on WebKit.

## The timeline of neglect

- **2014**: WebKit bug 133112 filed requesting `touch-action` support
- **2015**: `touch-action: manipulation` implemented (the easy one -- only disables double-tap zoom)
- **2019**: `touch-action: pan-y` added for iOS 13; `none` partially implemented
- **2022**: Safari 15.5 fixes `setPointerCapture` release bug (WebKit bug that prevented pointer capture from working at all on iOS)
- **2025**: `touch-action: none` still fires `pointercancel` for certain gesture sequences on real devices
- **2026**: Workaround still required. Twelve years after the original bug report.

For comparison, Chrome shipped complete `touch-action` support in **2014** (Chrome 36).
Firefox shipped it in **2017** (Firefox 52).
WebKit has had twelve years and still requires JavaScript workarounds
for a CSS property that every other engine handles correctly.

## The workaround

Three changes are needed. CSS alone is not sufficient.

### 1. `touchstart` and `touchmove` listeners with `preventDefault()`

This is the actual fix.
Preventing default on the native touch events stops iOS from entering gesture recognition
**before** pointer events are generated.
The listeners must be registered with `{ passive: false }` because
iOS Safari defaults touch listeners to passive.

```ts
canvas.addEventListener('touchstart',
  function handleTouchStart(event: TouchEvent): void {
    if (shouldSuppressNativeGestures())
      event.preventDefault();
  }, { passive: false });

canvas.addEventListener('touchmove',
  function handleTouchMove(event: TouchEvent): void {
    if (shouldSuppressNativeGestures())
      event.preventDefault();
  }, { passive: false });
```

Guard the `preventDefault()` behind a condition (e.g. active tool mode)
so that scrolling and native gestures still work when the application does not need to suppress them.

### 2. `event.preventDefault()` on `pointerdown`

Secondary defense.
Prevents iOS from canceling the pointer event sequence after `pointerdown` fires.

```ts
canvas.addEventListener('pointerdown',
  function handlePointerDown(event: PointerEvent): void {
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    // ... gesture logic
  });
```

### 3. `-webkit-touch-callout: none` CSS

Suppresses the iOS long-press context menu (link preview, copy/paste popover)
that fires after ~500ms of holding.
Without this, any long-press gesture (e.g. long-press-to-zoom-out) triggers the
system callout instead.

```css
#my-canvas {
  touch-action: none;               /* still set -- works on every other browser */
  -webkit-touch-callout: none;      /* iOS long-press menu suppression */
}
```

### What does not work

- **`touch-action: none` alone** -- iOS ignores it for certain gesture patterns
- **`event.preventDefault()` on `pointerdown` alone** -- insufficient; iOS intercepts at the touch event level before pointer events
- **`user-scalable=no` in the viewport meta tag** -- suppresses page zoom but does not prevent `pointercancel` from firing on canvas gestures
- **`setPointerCapture` alone** -- Safari had a separate bug (fixed in 15.5) where captured pointers did not receive `pointermove`/`pointerup` if the contact point moved off-element. Even after that fix, capture alone does not prevent `pointercancel`.

## Why this keeps catching people

Every tutorial and MDN page says: "set `touch-action: none` to prevent the browser from handling touch input."
This is correct on Chromium and Gecko. It is a half-truth on WebKit.

Developers write `touch-action: none`, test on desktop browsers, ship,
and then get bug reports from every iPhone user.
The failure is silent -- no console error, no warning, no indication that the CSS property
was not fully honored. The gesture simply does not work.

The WebKit team could fix this by making `touch-action: none` actually mean none.
They have chosen not to for twelve years.

## Verified fix applied in this project

Commit applying the fix: `packages/webapp-productivity/doodle-widget/src/client/pointer-handlers-zoom.ts`
and `packages/webapp-productivity/doodle-widget/src/styles.ts`.

Tested on a physical iPhone running iOS Safari. All three changes are required;
removing any one of them causes the zoom tool to fail on iOS.
