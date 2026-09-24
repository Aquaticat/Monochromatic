# Search behavior observed on the Pixel 9 Pro Fold emulator

## Scope and reproduction

These are direct observations of installed Android apps,
 not an inference from
Material diagrams or web screenshots.
 The Pixel_9_Pro_Fold AVD used Android 17,
390dpi on both panels,
 unfolded state `2` at 2076 × 2152 physical px and
folded state `0` at 1080 × 2424px.
 I used `adb -s emulator-5554 shell
cmd device_state base-state 2` or `0`,
 dismissed the keyguard,
 launched each
app,
 drove Search with `adb shell input`,
 and inspected native
`uiautomator dump` bounds together with opaque `screencap -d <display-id> -p`
images.
 The observations were made without signing into an account.

The screenshots stayed in private agent scratch because Maps exposed third-party
place photographs and names,
 and a complete status-bar/media sanitization
was not performed for repository publication.
 The bounds and UI labels recorded
here are enough to repeat the specific comparison;
 do not present the scratch
screenshots as reviewed design candidates.
 Package versions were read with
`adb shell dumpsys package <package>`.

## Google Messages

- Installed `com.google.android.apps.messaging`,
  `messages.android_20260306_02_RC09.phone_dynamic`.
  I selected **Use Messages without an account** and injected only synthetic
  inbound SMS using `adb -s emulator-5554 emu sms send 5550101
  'Coffee at the pier Friday'` and equivalent messages from `5550101` and
  `5550102`.
  No real SMS was sent.
- In the unfolded inbox,
  the conversation list occupies physical x `[0,1038)`;
  the other half prompts **Select a conversation from the list on the left**.
  Search is an action in the left inbox header at `[755,155][872,272]`.
- Opening Search switches to a **single centered Search region**,
  not the
  rejected left-header/right-results split.
  The Back/query field spans
  `[360,156][1726,273]` across the display center as a surface;
  its
  placeholder and cursor are on the left.
  Empty-query category tiles form
  two columns beneath that same header.
  The centered region carries the
  entire Search flow,
  not an empty first pane beside a detached second pane.
- Typing `coffee` adds Clear at `[1609,156][1726,273]` and shows the two
  synthetic conversation hits immediately beneath the query.
  Their text
  nodes are in rows that visually span the center.
  This app's own text may
  approach or cross the crease,
  so its geometry is **not** a substitute for
  our clarified E2 requirement that informational material stay clear.
- Folded to the cover without leaving Search,
  the query occupies
  `[166,172][924,289]` between Back and Clear.
  Hits occupy the same
  full-width column below it;
  supporting excerpts truncate rather than
  forcing a second column.

## Google Maps

- Installed `com.google.android.apps.maps` version `26.14.09.891313448`.
  I skipped account sign-in and kept its theme matched to the device.
- On the unfolded screen,
  Search **and its suggestions use the same left
  area** while the map remains visible to the right.
  Opening the search
  field puts Back at `[29,155][146,272]`,
  query at
  `[146,155][890,272]`,
  and suggestion text for `coffee` starting at
  x `195` in rows on the left.
  It does not put suggestions in the otherwise
  unrelated right map region.
- Submitted search results keep a left-side result panel while the map
  provides spatial context on the right.
  The map may draw place labels near
  the center;
  this is precedent for retaining context,
  **not** proof that
  all its map typography satisfies our information-free connector rule.
- On the cover,
  the same query and result context reflow into a full-width
  map with an overlaid results sheet.
  Its behavior is not a literal model
  for a music library,
  but it demonstrates that a Search destination does
  not have to occupy the entire unfolded display.

## Android DocumentsUI file picker

- Installed `com.google.android.documentsui` version `17`.
  The explicit
  launcher component `com.google.android.documentsui/com.android.documentsui.LauncherActivity`
  opened the Files UI.
- Its unfolded search action opens a continuous Back/query/Clear header:
  query bounds `[197,170][1780,258]` with a centered field surface extending
  across the display.
  The empty/no-match message for the current Downloads
  scope is centered in the same page below it,
  not exiled into a second pane.
- My first `dummy` search said **No matches in Downloads** because I had
  placed the synthetic PNGs under `/sdcard/Pictures/FoldPrecedent/` for
  Photos,
  while Files was searching Downloads.
  I copied the same files to
  `/sdcard/Download/`,
  confirmed the root showed their names,
  restarted
  Files,
  and repeated the query.
  Its result grid then showed the dummy
  images under the same full-width header.
  This is a fixture-scope failure,
  not evidence that Files Search ignores media.
- The unfolded result grid's card surfaces can approach the center while
  their labels sit inside cards.
  On the folded cover the grid uses a
  narrower arrangement with the query still above its results.
  The app's
  visual geometry still needs E2 adaptation rather than direct copying.

## YouTube's near-crease lettering is a warning

The user opened YouTube `com.google.android.youtube` version `20.10.41` on
the unfolded emulator at a `dokibird` result page.
 A row placed a thumbnail
and its duration near the left side of the physical center,
 and a title
beginning immediately to the right.
 I first interpreted the closeness as
safe-placement praise.
 The user's **corrected about 7.5mm visible dent** (superseding an initial
10mm estimate) overturns that reading:
 on the approximately 141.08mm-wide
inner panel,
 the dent spans roughly physical x `[983,1093)`px around center
x 1038.
 In the private
native screenshot,
 the duration's right edge is near x 1000 and OCR placed
a second-line title word start near x 1056;
 both are within that estimated
band.
 OCR positions are approximate,
 but the image is a clear **negative
example for our information-clearance rule**,
 not a positive one.
 Its
thumbnail and row surfaces can cross the center;
 the problem is readable
time/title glyph placement.
 No user screenshot was copied into the repo.

The crease width is physical.
 Converting about 110px to about 45dp is valid
only at the emulator's current 390dpi configuration;
 Android display
scaling changes dp size without changing the physical 7.5mm.
`max(min_padding, crease_width)` describes clearance between informative
material,
 not a blank 45dp surface gutter.

## Apps that did not supply Search evidence

- Google Photos `7.67.0.882706237` showed the generated local PNGs in Photos.
  Its signed-out Search tab still displayed **Turn on backup to improve
  search** and a Settings action,
  not a query UI.
  The user will not sign
  into the emulator;
  no Photos Search result layout was observed.
- YouTube Music `9.10.52` offered **Device files only** without sign-in.
  The local-library screen did not expose Search,
  so it cannot answer this
  page-layout question in that mode.
- Chrome `145.0.7632.218` stopped at first-run consent/sign-in choices.
  I did not accept terms or telemetry choices on the user's behalf,
  and
  did not infer its Search layout.

## Design implications that the observations actually support

Messages demonstrates a continuous unfolded Search destination with query and
hits in one coherent region;
 Maps demonstrates a bounded Search/results
region beside useful context;
 Files demonstrates a full-width query/results
page and adaptive result grid.
 These are **different** possible compositions,
not a vote for one.
 All retain a clear relationship between query and
results.
 None settles the music player's result types,
 whether its other
unfolded region should show player context,
 or how its meaning-bearing text
must be routed around `[414,438)`dp.
 Those remain design questions for native
prototype comparisons under D47,
 D48,
 D49 and clarified E2.
