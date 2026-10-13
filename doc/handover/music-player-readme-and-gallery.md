# Music player README and gallery

## Status

The desktop gallery in `package/music-player/asset/readme/` is current.
It was retaken on 2026-10-13 from a release binary built at the repository head,
hosted in the nested Wayland compositor through the session helpers of the `desktop-e2e` package.
It holds twelve PNGs of the desktop app:
the two-pane window, Search, Settings and the track menu, each in light and dark,
plus the key hint badges (dark), the narrow player (dark), the narrow folder list (light) and the empty library (light).

There is no Android gallery.
Every earlier Android capture was removed because it predated the focus ring, gray and menu decisions (D117 to D119)
or showed names from a private corpus and a carrier name.
The README says it carries no Android capture of the current build.
Retake the Android gallery only from a final build, with the facts in "Android captures".

Last updated: 2026-10-13.

## Goal

`package/music-player/README.md` is the product and contributor entry point.
The component READMEs keep exhaustive commands and implementation detail.
The gallery shows the current committed applications only, never a Claude Design export,
and it covers every discrete user-visible branch at least once rather than every combination of dimensions.
The README states the availability as under active development, build from source.
It must not imply that the repository extraction in `doc/planning/music-player-repository-extraction.md` has happened.

## Desktop capture method

The capture scripts lived in `${HOME}/temp/agent/readme-shots/`, which is scratch and is not kept.
Rebuild them from this description.

### Library

A small script writes mono 16-bit WAV tones at 22 050 Hz (a sine with its fifth and a slow tremolo) into invented
artist folders, thirty-five files in all:
one artist with two albums (nine tracks), twelve more artist folders of one to three tracks each,
and three loose tracks directly in the root so the virtual letter folders appear.
A second, empty directory serves the empty-library capture.
No real library, name or path is ever used.

### Session and audio

`startSession` in `package/music-player/desktop-e2e/src/session.ts` takes the window size, the color scheme, an
accent, the library and a label.
It starts the nested compositor with the release binary in a transient systemd user unit and returns helpers:
`waitState`, `click`, `tap`, `chord`, `down` and `up`, `type`, `last` and `shot`.
The accent was `4E5E8B`.
Its config names the app directory, the compositor path, the release binary, a scratch root and an output root.
`createNullSink` and `currentRouting` in `src/pipewire.ts` give a private PipeWire null sink and prove that the app's
output streams link only to it.
Check the routing once after starting a track.

### Sequence

Wide window, 1000 by 800 pixels:
wait for the player state, wait about four seconds for the analysis to settle, click a track to play it, click a
folder row, and take the two-pane shot.
Then `Alt+2`, five `Down` taps and `Menu` for the track menu shot, `Escape`, hold `Ctrl` for 900 ms for the badge shot
(dark only), `Ctrl+F` and type a short query for Search, `Escape`, and `Ctrl+Alt+S` for Settings.

Narrow window, 443 by 900 pixels:
play a row for the player shot, then press the folder button for the folder list shot.

Empty library, 1000 by 800 pixels, light only.

Click coordinates were fixed pixels fitted to the layout at capture time, so find them again after a layout change.

### Finishing and limits

Convert each shot with `magick <in> -strip -define png:exclude-chunks=date,time <out>` into
`desktop-<state>-<scheme>.png`, and read every image in full before committing it.

The nested compositor draws no desktop title bar and no KDE taskbar progress,
so those shell-owned states are not in the gallery.
The Slint embedded MCP server returns a black screenshot from a live winit FemtoVG session,
so use compositor screenshots, as recorded in `doc/troubleshooting/slint-mcp-winit-femtovg-screenshot.md`.
Starting and loading indicators do not last long enough for a stable frame and are left out as intermediate frames.

## Android captures

These facts held for the earlier gallery and are the starting point for the next one.

- The SDK lists one AVD, `Pixel_9_Pro_Fold`.
  Emulator 37.1.11 crashes with software rendering during boot, so launch it with host GPU rendering, read-only, with no
  snapshot and disposable state, and never wipe the retained AVD data.
  Details: `doc/troubleshooting/android-emulator-37-software-renderer-sigsegv.md`.
  The generated `hardware-qemu.ini` can record a stale renderer, so pass the verified arguments explicitly.
- The inner display is 2076 by 2152 at density 390 and the cover display is 1080 by 2424.
  `cmd device_state` lists `CLOSED`, `HALF_OPENED`, `OPENED` and `REAR_DISPLAY_MODE`.
  Read it before each fold capture to confirm the posture.
- A synthetic FLAC library of 120 tracks in ten folders was accepted by MediaStore and by the folder grant.
  Remove stale copies in another format first.
- The media notification and the lock screen need `POST_NOTIFICATIONS` granted in the disposable state.
  Crop those captures to the application-owned media cards.
- Crop app captures to exclude the status bar and the navigation bar, which can carry a carrier name.
- The earlier note that unfolded and tabletop looked the same came from an app that ignored the fold.
  The app now reads the fold through WindowManager (D110), so capture both postures again.

## Privacy and capture rules

- Use generated names and audio, disposable app state and storage, and never the user's real library.
- Inspect every region of every image, and mask or remove notifications, account names, host paths, device
  identifiers and unrelated windows.
- Strip image metadata, and do not capture audio.
- Confirm the intended rendered state before each capture: finished input is not a finished frame.
- End the nested compositor units and any emulator processes after the captures.

## Images on GitHub

The PNGs are Git LFS objects stored on the R2 worker, and GitHub cannot render those from a relative link.
The full record is `doc/planning/lfs-readme-image-rendering.md`.

- The raw URL of an R2-only object returns the pointer text, and `media.githubusercontent.com` returns 404.
  The README therefore embeds `https://monochromatic-lfs.aquaticat.workers.dev/<oid>/<repo path>`.
  The host changed from `an1298.workers.dev` on 2026-10-01.
- Write a relative image link and commit.
  The `markdown/autofix` policy of `git-policy-cli` (rule `lfs-image-url` of the markdown linter) puts the Worker URL
  into the committed file, and a replaced image gets its new oid the same way.
  The working tree keeps the relative link until you check the file out again.
- The objects reach R2 on push, so the URLs resolve only afterwards.
  `mise run //package/config/lfs-r2-worker:check:markdown-urls` sends a `HEAD` request for every embedded URL and
  asserts status 200, an image content type, and the pointer's size.
- On 2026-10-13 the oid in each of the twelve README image URLs equals the sha256 of its file.

## Next actions

1. Push, run the URL check task, and open the README on github.com in a logged-out browser to confirm that all twelve
   images load (`naturalWidth` above zero).
2. Retake the Android gallery from a final build, with the facts in "Android captures",
   and add it to the README's Gallery section.
3. Keep the image store of the extracted repository undecided until the extraction plan settles it.

## References

- [MusicBee library navigation elements](https://musicbee.fandom.com/wiki/Library_Navigation_Elements),
  [Roon folder browsing](https://blog.roonlabs.net/folder-browsing/) and
  [foobar2000 Facets](https://www.foobar2000.org/components/view/foo_facets) are the navigation precedent that the
  library design weighed.
- IntelliJ IDEA treats Control twice as Run Anything and Shift twice as Search Everywhere.
  The app's double Shift opens Search, as decided in `package/music-player/design/decisions.md` (D106).
