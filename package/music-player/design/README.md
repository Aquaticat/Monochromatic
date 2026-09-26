# Music player design

Design source and decision record for the shared Android and desktop music player interface.
The work targets the Pixel 9 Pro Fold first while preserving one Material Design 3 identity across
Jetpack Compose and Slint.

This package contains exploratory Design Components,
rendered comparisons,
device metrics,
settled decisions,
and the active handover.
It does not describe shipped application behaviour unless a decision explicitly says it has been implemented.

## Start here

Read these files in order:

1. [`HANDOFF.md`](HANDOFF.md)
2. [`review-notes.md`](review-notes.md)
3. [`decisions.md`](decisions.md)
4. [`open-questions.md`](open-questions.md)
5. [`md3-tokens.md`](md3-tokens.md)
6. [`material-3-compliance.md`](material-3-compliance.md)
7. [`device-metrics.md`](device-metrics.md)
8. [`candidates.md`](candidates.md)

## Design questionnaire

The most recent design round applied the standing true-black dark requirement while
following Android dynamic color.
 It preserved accepted option 3B,
 transport 1B,
 strict
adaptive mode behavior,
 and the completed accessibility decisions.
 The native Compose
matrix separated three structural surface reaches from two current-row neutral sources
across six representative Android palette environments at the target's opaque 2076 ×
2152px panel resolution.
 Wallpaper rows were uncontrolled stress inputs,
 not choices.
The user settled the round with R1 stable black structure and C2 generated
`surfaceContainerLow` current row;
 decisions D41 and D42 record the choices.
 The form
prepared a visible answer and directed the user to reply in chat;
 it intentionally has no
clipboard API or copy button.

The folded-cover screen round compared four native subdirectory-picker prototypes:
P1 outlined text field plus floating menu panel, P2 the same field plus in-slot picker,
P3 app-bar title plus floating panel, and P4 title plus in-slot picker.
 D46 selects P4
as a **temporary pre-1.x decision**: it is the current design baseline, but the user
believes a better picker exists.
 Post-decision native P4 captures now cover dark at 200% and accepted L3 light at
100% and 200%, in addition to dark at 100%; the opened-state visuals fit without mode
border clipping.
 A debug-only native interaction study verifies title open/close, Back, same-folder
dismissal, and keyboard focus retained after Back at 200%; TalkBack focus remains
unmeasured.
 The light surface itself is settled by D45 (flat with hairlines
at both seams).
 P4 remains provisional and a better picker may be explored before 1.x,
 without a promised replacement.

D47 replaces the command-bar presentation with a **Search button opening a separate
page**.
 D48 merges Back,
 input and Clear into one baseline MD3 Search header.
D49 corrects the design target:
 every platform follows the Pixel 9 Pro Fold cover
(1080 × 2424px) and unfolded inner display (2076 × 2152px).
 This AVD reports
390dpi on both panels,
 so its native captures represent approximately 443 ×
994dp on the cover and 852 × 883dp on the inner display.
 The older 411 × 923dp
cover estimate was not measured on the AVD.
 The earlier 360,
 480 and 1100px desktop Slint scenes are
not design evidence for these screens.
 The native Compose Search study captured both Fold panels,
 but its unfolded
page placed the Back/query/Clear header above an empty left pane and isolated
results in the right pane.
 The user rejected that composition.
The withdrawn form and its captures remain archived at
`questions/archive/search-rejected-fold-review.html`.
 Its empty connector
passed a superseded geometric guard but did not make the page usable.
D50 additionally requires the unfolded playback deck to stay visible during
Search,
 including with a keyboard in view,
 except for the measured real-Gboard overlays accepted by D53 and D54.
 The user selected A (D51):
 Search stays on the unfolded right,
 and the
bottom-left playback deck rises above the keyboard while typing.
D52 removes the redundant positive-results `Results for “cam”` heading on
both panels.
 The former three-way matrix remains at
`questions/archive/search-three-way-before-a.html`.
`questions/current.html` now shows only the selected design in light/dark
at 100% and 200% text.
The corrected unfolded typing captures keep the **same folder browser** above
the lifted deck;
the user accepts a little crop of that browser in short keyboard viewports
and rejected a substitute `Current folder` caption.
A system-managed 300dp debug keyboard verified bounded bottom-keyboard
occlusion and input routing;
it is not Gboard.
The linked older real-Gboard PNGs predate this browser correction.
Real floating Gboard at 200% text obscured part of the unfolded deck title;
D53 accepts that measured overlap.
On the cover at 100% text,
the floating keyboard obscured both matching result labels while typing;
D55 separately accepts that state while the query remains visible.
The user's A selection is unchanged.
A disposable Fold then verified real split inner and full-width cover Gboard
at 100% and 200% text, with the deck and cover results visible in settled
states.
Its Gboard font-update banner briefly clipped the final inner mode;
D54 accepts that measured brief overlap.
Ordinary settled docked/split keyboards still require the full deck,
and other keyboard states are not verified by those exceptions.
The original AVD's active Gboard was updated versionCode `175981944`,
not the preloaded `175753756`;
updating the disposable Gboard to that same build did not reproduce the
floating layout.
`package/music-player/design/evidence/gboard-geometry.md` indexes sanitized real-keyboard captures
and bounded accepted overlays.
The [selected Search A crease measurement](evidence/selected-search-crease-geometry.md)
records the visible central band and app-node geometry;
it does not choose E2's still-open minimum opposing-information padding.
Selection does not authorize production implementation.
 Desktop implementation inherits
the Fold visual choices even if its own proportions would suggest a different layout.
The rejected command review remains at `questions/archive/command-igr-rejected.html`.
D21's configurable global hotkey and extra Settings row belonged to the command bar;
they do not silently move to Search.
 D25's Ctrl+F reservation remains pending the
whole keyboard-map pass.
 Search result actions/ranking,
 tall-keyboard fit,
 and final empty/error
behavior remain to be designed;
 the
canned captures are a design review,
 not a running search index.
 The live backlog and developer-owned items are in
`open-questions.md` section 0b.

The preceding accessibility review settled pane-by-pane TalkBack traversal (F1) and
structured current-track speech (S1).
 The prototype repairs the adaptive mode control as
one four-item radio list at one row,
 2×2,
 and four rows;
 reduced motion forbids
autonomous or decorative motion.

The preceding accepted scale review covers every font scale exposed by the target Android
Settings UI:
 0.85,
 1.0,
 1.15,
 1.30,
 1.50,
 1.80,
 and 2.0.
 The mode
group uses one content-sized row at 85%,
 2×2 from 100% through 130%,
 and four
rows from 150% through 200%.
 Every segment retains at least 12dp horizontal content
padding.
 The `Shuffle` cell caps longer subdirectory names at rendered `Camellia`
width with a middle ellipsis while retaining the full accessibility name.

Each round embeds its visual evidence,
 option assessments,
 recommendation,
 and answer
controls in one file.
 Questionnaire HTML follows the viewer's light or dark system preference;
never force a light review surface.
 The file is rendered and interaction-checked before it is opened in
Helium.
 Android evidence comes from a non-functional Jetpack Compose prototype
installed on the target emulator,
 not from CSS redraws.
 The active prototype is
preserved on `prototype/music-player-theme-compose`.

After each correction,
answer,
decision,
candidate,
or verification result,
update [`HANDOFF.md`](HANDOFF.md) immediately.
Do not defer the handover update until the end of a session.

## Historical source

The imported archive remains represented by the original root documents,
`candidates/`,
`screenshots/`,
`uploads/`,
and the bound Material Design 3 files under `_ds/`.
Historical candidates remain evidence for prior decisions,
including rejected directions.

## License

Repository-authored work is licensed under the
[GNU Lesser General Public License, version 3 or later](../../../LICENSE).
The imported Material Design 3 recreation documents its source and attribution requirements in
[`_ds/material-design-3-design-system-503c3571-4db9-4b54-8695-7f53861f5059/readme.md`][].

[`_ds/material-design-3-design-system-503c3571-4db9-4b54-8695-7f53861f5059/readme.md`]:
  _ds/material-design-3-design-system-503c3571-4db9-4b54-8695-7f53861f5059/readme.md
