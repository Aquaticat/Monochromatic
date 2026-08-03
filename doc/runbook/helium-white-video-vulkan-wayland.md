# Resolve white videos in Helium on Wayland

## What this proves

This procedure removes a persisted experimental Vulkan override from Helium on Linux Wayland.
It verifies that videos render and that Helium stops emitting the shared-image errors associated with white video surfaces.

The command-line bridge was validated first against a disposable Helium profile:

```console
${HOME}/AppImages/helium.appimage --disable-features=Vulkan
```

That override rendered local and remote H.264 video correctly on Wayland.
Running the same profile with Vulkan enabled produced a white video surface and both target errors.
The bridge was not applied to the active profile because the durable setting belongs to Helium's flags UI and the browser must restart.

## Setup

Status:
TODO

Use this procedure when all of these conditions hold:

- Helium runs on Linux in a Wayland session.
- Videos play audio or advance their timeline but appear as white rectangles.
- **Experimental Vulkan** was enabled in `chrome://flags`.

Save any unsent form content before continuing.
The **Relaunch** action restarts every Helium window.

## Steps

Status:
TODO

1. Focus Helium's address bar with **Ctrl+L**.
   The current address becomes selected.
2. Type `chrome://flags/#enable-vulkan` and press **Enter**.
   The **Experimental Vulkan** entry appears highlighted.
3. Open the dropdown beside **Experimental Vulkan**.
   The dropdown shows **Default**, **Enabled**, and **Disabled**.
4. Select **Default**.
   The entry changes from **Enabled** to **Default**, and **Relaunch** appears.
5. Click **Relaunch**.
   Every Helium window closes and reopens with Vulkan omitted from the GPU feature list.
6. Open a page containing a video.
   The page displays its video player.
7. Press the player's **Play** button.
   Moving video frames replace the white rectangle.

## What to check

Status:
TODO

Confirm all of these outcomes:

- The video picture moves while its timeline advances.
- The video surface is not a solid white rectangle.
- `chrome://flags/#enable-vulkan` shows **Default**.
- This command prints no matching lines while the video plays:

```console
journalctl --user --since '5 minutes ago' --no-pager \
  | grep --extended-regexp 'Could not find or create a backing for stream kSkia|Trying to produce a Skia representation from an incompatible backing'
```

## Restore

Status:
TODO

Restoring the previous state deliberately recreates the unsupported configuration and can restore the white-video failure.
Only use these steps when reproducing the problem for diagnosis.

1. Focus Helium's address bar with **Ctrl+L**.
   The current address becomes selected.
2. Type `chrome://flags/#enable-vulkan` and press **Enter**.
   The **Experimental Vulkan** entry appears highlighted.
3. Open the dropdown beside **Experimental Vulkan**.
   The dropdown shows **Default**, **Enabled**, and **Disabled**.
4. Select **Enabled**.
   The entry changes to **Enabled**, and **Relaunch** appears.
5. Click **Relaunch**.
   Every Helium window closes and reopens with Vulkan enabled again.
