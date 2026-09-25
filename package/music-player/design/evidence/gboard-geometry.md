# Real Gboard geometry on selected Fold Search A

## Purpose and boundary

D51 keeps Search and results on the right of the unfolded Pixel 9 Pro Fold,
with the playback deck at bottom-left.
D50 requires that deck to remain visible even while typing.
The active review at `package/music-player/design/questions/current.html` still shows a debug-only 300dp
system-managed input method,
not Gboard.
The captures linked here test selected A with real Gboard.
They are design evidence,
not production implementation or a new choice between A,
B and C.

## Fixture and comparison limits

Both AVDs used Android Emulator 37.1.11.0,
Android 17 API 37,
390dpi,
an inner panel of 2076 × 2152px and a cover panel of 1080 × 2424px.
The installed debug Search APK had SHA-256
`d895072b4f232181c1f24d9db0bfd6b3afae2e25f869cbe21b0039e81f53`
on both AVDs.
The original `Pixel_9_Pro_Fold` AVD's active updated Gboard was
`18.2.7.969776716-release-x86_64`,
versionCode `175981944`.
Its hidden preloaded package was versionCode `175753756`;
the earlier troubleshooting reading mistook that for the active build.
The original floating screenshots were captured after its recorded
September 24 update.

The disposable `Fold_No_Hardware_Probe` AVD initially ran the preloaded
Gboard versionCode `175753756`.
Installing the original AVD's updated APK splits into the disposable AVD
changed its active versionCode to `175981944`,
but its settled split/full-width geometry remained the same.
This comparison **does not isolate a cause** for the original floating mode:
user data,
Gboard preferences and device settings differ.
The disposable AVD's `hw.keyboard=no` config also did not remove the guest's
`AT Translated Set 2 keyboard`;
Window Manager still reported `qwerty/v/v`.
Do not call it hardware-keyboard-free.

The disposable emulator booted under a 6 GiB RAM and 2 CPU container limit,
using a read-only copy of the host ADB **public** key,
`-skip-adb-auth`,
and clean disposable guest data.
No host private key,
production source or active AVD setting was changed.
See `doc/troubleshooting/android-17-fold-emulator-ime-probe.md`
for the failed lower-memory and ADB-auth probes.

## Settled Gboard typing that fits

- [Inner split keyboard at 100% light][inner-100]:
  real key taps entered `cam`.
  Its IME began at y `1352`;
  the complete deck and both right-side results remained readable.
- [Inner split keyboard at 200% light][inner-200]:
  `Shuffle all folders` ended at y `1313`,
  39px before the keyboard began at y `1352`.
  Its full 131px target height remained visible.
- [Inner split keyboard at 200% dark][inner-dark-200]
  and [after updating disposable Gboard][inner-updated-200]:
  real `cam` input and the same measured final-mode bounds remained visible.
- [Cover full-width keyboard at 100% light][cover-100]
  and [200% light][cover-200]:
  real key taps entered `cam`;
  both result labels remained above the keyboard beginning at y `1605`.
- [Cover full-width keyboard at 200% dark][cover-dark-200]
  and [after updating disposable Gboard][cover-updated-200]:
  the same result-visibility check passed.
  At 200%,
  `Camellia` occupied `[127,350][410,453]` and
  `Another Xronixle` occupied `[127,584][667,687]`.

On the disposable cover,
Android Back dismissed Gboard without clearing `cam` or its results.
Tapping the field reopened the keyboard.
Clear removed the query while retaining focus,
and real-key retyping restored both results.
These are bounded observations of the selected debug Search study,
not proof of result activation or rank behavior.

## Measured failures that remain

- [Original AVD floating Gboard at 200% inner][floating-inner]:
  its touchable key region x `[274,1180)`,
   y `[310,1081)` overlapped the
  playback title `[258,1042][781,1145]`.
  Moving that floating keyboard lower covered more controls.
  The public IME source reported a zero-height bottom inset in this state.
- [Original AVD floating Gboard at 100% cover][floating-cover]:
  real key taps entered `cam`,
  but its x `[0,830)`,
   y `[304,1025)` key surface covered both result labels.
- [Disposable inner Gboard font-update banner at 200%][font-banner]:
  immediately after a font-scale change,
  `Keyboard font size updated` raised the IME top to y `1140`.
  The final mode occupied only `[73,1076][965,1140]`,
  a visible height of 64px instead of the measured 117px minimum for 48dp.
  Tapping `OK` returned the settled IME top to y `1352`
  and restored the full mode.
  Automatic dismissal and recurrence were not established.

The split/full-width passes do **not** cancel the floating or banner failures.
D50 has not been met for every observed typing state,
and D51's A selection has not changed.
Do not narrow “never hidden” to docked keyboards without a user decision.

## Banner-height fit bound, not a proposed fix

At 200% font scale,
the settled light capture first paints the deck at y `281` and the
keyboard begins at y `1352`.
That deck takes 1071px.
The banner capture first paints it at y `175`,
just after the 136px status inset and a 16dp,
approximately 39px divider.
With the banner IME beginning at y `1140`,
the safe vertical area from status inset to keyboard is 1004px.
The current divider plus deck needs 1110px,
a 106px shortfall;
the screenshot and final-mode bounds show the resulting clip.

In prototype commit `36f8a8b8e`,
`package/music-player/android-app/app/src/debug/kotlin/dev/monochromatic/musicplayer/DesignCandidateActivity.kt:982-999`
keeps that divider even when Search hides the folder browser.
`TransportBlock` at the same file's lines 1472 to 1501 also applies
16dp vertical outer padding.
Removing the now-unneeded divider would save about 39px but leave about
67px of the measured shortfall.
Reducing outer padding from 16dp to 8dp on both edges would save about
39px more but still leave about 28px **if the other components kept their
settled heights**.
These are before-state arithmetic,
not a built variant or after-state fit proof.
Do not implement a partial compact fallback,
shrink a 48dp target,
undercut the accepted 8dp group spacing or 12dp horizontal mode padding,
or hide controls to silence this diagnostic.
Any viable reflow needs a debug-only Compose build and a real keyboard check
before another design question.

## Evidence and regeneration

Each linked PNG is a full physical-panel capture,
with the left status area replaced by a generic `9:41` clock and image metadata
stripped.
The right status icons,
app content and navigation handle were inspected;
they carry no account,
path,
notification text or other personal identifier in these samples.
Each same-stem JSON file in `package/music-player/design/questions/evidence/` contains only whitelisted
synthetic app labels,
focused-field state,
node bounds,
keyboard bounds,
APK hash and AVD/version provenance.
Full raw UI hierarchies and screenshots remain in private agent scratch,
not the repository.

`package/music-player/design/gboard-evidence.mjs` owns the sanitizer and geometry checks.
Regenerate only with the private raw capture directory set as
`MUSIC_PLAYER_GBOARD_INPUT` and run
`mise run //package/music-player/design:evidence:gboard`.
The committed outputs validate without private inputs through
`mise run //package/music-player/design:lint:gboard:evidence`.
Disposable negative controls confirmed that validator rejects a clipped
settled mode,
a falsely passing banner,
result labels moved outside the floating keyboard,
and an unmasked status-corner pixel;
the original records passed after each restoration.

App-delivered IME insets and any other public bounding-rectangle APIs were
not directly measured inside Compose.
The system `InsetsSource` path is traced in
`doc/troubleshooting/android-17-fold-emulator-ime-probe.md`.
A design response to movable keyboards and system-owned transient overlays,
plus long result names and scrolling,
remains open.

[inner-100]: ../questions/evidence/gboard-inner-split-light-s100.png
[inner-200]: ../questions/evidence/gboard-inner-split-light-s200.png
[inner-dark-200]: ../questions/evidence/gboard-inner-split-dark-s200.png
[inner-updated-200]: ../questions/evidence/gboard-inner-updated-split-dark-s200.png
[cover-100]: ../questions/evidence/gboard-cover-full-light-s100.png
[cover-200]: ../questions/evidence/gboard-cover-full-light-s200.png
[cover-dark-200]: ../questions/evidence/gboard-cover-full-dark-s200.png
[cover-updated-200]: ../questions/evidence/gboard-cover-updated-full-dark-s200.png
[floating-inner]: ../questions/evidence/gboard-inner-floating-overlap-light-s200.png
[floating-cover]: ../questions/evidence/gboard-cover-floating-overlap-light-s100.png
[font-banner]: ../questions/evidence/gboard-inner-font-banner-light-s200.png
