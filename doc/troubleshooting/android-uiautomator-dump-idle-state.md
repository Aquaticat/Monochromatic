# Android UI Automator dump can reject an actively loading screen

## Symptom

Immediately after `am start -W`,
a hierarchy capture can fail:

```txt
ERROR: could not get idle state.
adb: error: failed to stat remote object '/sdcard/window.xml': No such file or directory
```

The first diagnostic is emitted by Android's `uiautomator dump` command.
The later `adb pull` failure is consequential:
the dump command did not create the requested device file.

In the observed music-player run,
a screenshot taken at that point still showed `Loading your library…` and an animated progress indicator.
A later dump succeeded after the page controls rendered.

## Handling

Do not treat `am start -W` as proof that application content reached its final rendered state.
It reports Activity launch completion,
not completion of application loading and Compose rendering.

Use a deterministic readiness signal when the app exposes one,
such as a log event or expected accessibility node.
If no such signal exists:

1.  Capture the current frame.
2.  Inspect it for the intended stable content.
3.  Retry the hierarchy dump after the loading state has ended.
4.  Perform scripted input only against coordinates or nodes from that stable state.
5.  Capture again and verify the selected rendered state before accepting the artifact.

Do not continue to `adb pull` after `uiautomator dump` fails,
and do not accept a loading or transitional screenshot as final evidence.

## Music-player verification

For the Pixel 6 LED scene,
the successful hierarchy included the `32ki` legend and its owning checkable bounds.
After tapping those stable bounds,
a second hierarchy showed `checked="true"` for the LED control.
Only then was the light-scene screenshot accepted.
The device was restored to night mode after capture.
