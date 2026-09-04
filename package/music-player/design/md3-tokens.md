# Material Design 3 — verified token values

**Why this file exists.** Three spec numbers were built from memory in phase one and
all three were wrong. Everything below was read from a source. If you need a value
that is not here, read it — do not recall it.

---

## How to read the spec (m3.material.io cannot be fetched)

`m3.material.io` is JavaScript-rendered; fetching it returns only
"This website requires JavaScript." **Google publishes the generated token files in a
public repo instead**, and those files *are* the spec data:

```
repo:  github.com/material-components/material-web
path:  tokens/versions/latest/sass/     ← current values (design system v34.0.21)
       tokens/versions/v0_192/          ← older generation, for reference only
       tokens/_md-comp-*.scss           ← which tokens a component supports
```

The `latest/sass/_md-comp-*.scss` files are plain `$name: value;` declarations. Search
them by token name (for example `container-height`, `handle-width`, `between-space`).
The `v0_192` files wrap values in `if($exclude-hardcoded-values, null, 40px)` — the
second argument is the value.

Second-source cross-checks that proved reliable: the Flutter API docs and
`material-components-android/docs/components/*.md`.

---

## Shape scale (`_md-sys-shape.scss`)

```
corner-extra-small    4px
corner-small          8px
corner-medium        12px
corner-large         16px
corner-extra-large   28px
corner-full        9999px   (pill)
```

---

## Typescale (`_md-sys-typescale.scss`) — rem, at 16px root

```
                    size            line-height     weight
headline-large      2rem     32px   2.5rem   40px   regular
headline-medium     1.75rem  28px   2.25rem  36px   regular
headline-small      1.5rem   24px   2rem     32px   regular
title-large         1.375rem 22px   1.75rem  28px   regular
title-medium        1rem     16px   1.5rem   24px   medium
title-small         0.875rem 14px   1.25rem  20px   medium
body-large          1rem     16px   1.5rem   24px   regular
body-medium         0.875rem 14px   1.25rem  20px   regular
body-small          0.75rem  12px   1rem     16px   regular
label-large         0.875rem 14px   1.25rem  20px   medium
label-medium        0.75rem  12px   1rem     16px   medium
label-small         0.6875rem 11px  1rem     16px   medium
```

There is also an **emphasized** typescale (`_md-sys-typescale-emphasized.scss`) with
the same sizes but heavier weights (body/title/headline → medium, label → bold). Not
used in this project; MD3 baseline was chosen over Expressive.

---

## List item (`_md-comp-list.scss`) — the one that was wrong

```
list-item-one-line-container-height     56px
list-item-two-line-container-height     72px      ← track rows use this
list-item-three-line-container-height   88px
top-space / bottom-space                12px
```

Colour roles: label = on-surface, supporting text = on-surface-variant,
leading/trailing icon = on-surface-variant.

Note: a widely repeated implementation caveat says deviating from these heights makes
an app feel un-native, and explicitly names a music-player track list as the kind of
custom component that may legitimately differ. This project chose to **comply** (72dp)
rather than take that exception.

---

## Slider, updated M3 slider (`_md-comp-slider.scss`) — also was wrong

```
handle-width            4px
handle-height          44px
active-handle-height   44px
active-track-height    16px
inactive-track-height  16px
stop-indicator-size     4px
track corner size      trackHeight / 2  = 8px outer
track inside corner     2px             (the corners either side of the handle)
active track colour    primary
inactive track colour  surfaceContainerHighest
```

Size variants exist: `xsmall` 16px track, `small` 24, `medium` 40, `large` 56,
`xlarge` 96 — all with a 44px handle. This project uses the **default (16px track)**.

**Do not use the v0.192 slider** (4px track, 20×20 round handle) — that is the
previous generation and looks nothing like the current component.

Implementation note for HTML mocks: a 44px handle inside a 16px track means the row
needs to be ~44px tall, with the track pieces 16px inside it, or the handle gets
clipped or collides with neighbours.

---

## Outlined segmented button (`_md-comp-outlined-segmented-button.scss`)

```
container-height        40px      ← visual height (48dp recommended tap target)
outline-width            1px
shape                    corner-full   (radius = height / 2 = 20px)
with-icon-icon-size     18px
label typescale          label-large   (14px / 20px, weight 500)
selected container       secondary-container
selected label / icon    on-secondary-container
unselected label / icon  on-surface
disabled opacity         0.38 (text/icon), 0.12 (outline)
```

**Important status note:** M3 states that the segmented button is **no longer
recommended** and directs you to the **connected button group** instead. This project
chose the connected button group (decisions.md D1) but keeps the segmented version
(candidates/mode-c) as a fallback, because it is what the user’s reference image shows.

---

## Connected button group (`_md-comp-button-group-connected-*.scss`)

The current replacement for the segmented button. Five sizes; this project uses
**medium**:

```
                        xsmall  small  medium  large  xlarge
between-space             2px     2px    2px     2px    2px
container-height           —       —     56px     —      —     (read the file for others)
container shape          corner-full
inner-corner             corner-small (8px)
selected inner-corner    50%
pressed inner-corner     corner-extra-small (4px)
```

Visually: separate buttons with 2px gaps; the outer ends of the group are pills; the
inner corners are only slightly rounded; the selected button’s inner corners go fully
round. When the group wraps to two rows, only the four outer corners of the block
round — the sides stay flush (this is also what the user’s reference image shows).

---

## Colour roles (dark), verified

Read from the bound design system's `tokens/color.css` + `tokens/palette.css`
(values copied verbatim from material-web). Baseline dark scheme:

```
role                        palette step         hex        in candidates before
primary                     primary80            #D0BCFF    ✓ same
on-primary                  primary20            #381E72    ✓ same
secondary-container         secondary30          #4A4458    ✓ same
on-secondary-container      secondary90          #E8DEF8    ✗ was #EADDFF (primary90)
on-surface                  neutral90            #E6E0E9    ✓ same
on-surface-variant          neutral-variant80    #CAC4D0    ✓ same
outline                     neutral-variant60    #938F99    ✗ was #6F6A78 (no source)
outline-variant             neutral-variant30    #49454F    —
error                       error80              #F2B8B5    ✗ was #FFB4AB (that is a dynamic-colour value)
surface (spec)              neutral6             #141218    remapped to #000 by B1/B2 (true black)
surface-container           neutral12            #211F26    remapped, see B2
surface-container-high      neutral17            #2B2930    remapped, see B2
surface-container-highest   neutral22            #36343B    remapped, see B2
```

The three ✗ values are corrected in unf-b/unf-c, cover-c/cover-d and desc-a/b/c.
Older candidates still carry the old hexes. The true-black surface ladder (B2) is a
deliberate project override, not a spec value.

## Scrollbar — Compose Material 3 (`compose/material3/.../Scrollbar.kt`, androidx-main)

MD3 has **no scrollbar spec** on m3.material.io. The only Material source is the
Compose Material3 modifier `Modifier.nonInteractiveScrollbar` (androidx repo,
`NonInteractiveScrollbarDefaults`):

```
thickness               4dp
thumb colour            outline @ 0.7 alpha      (dark: #938F99 → rgba(147,143,153,.7))
track colour            transparent
thumb min length        24dp
thumb max length        0.9 × track
main-axis track inset   2dp   (top/bottom)
cross-axis inset        0dp   (flush to the end edge)
corner radius           thickness / 2 = 2dp
fade                    shown while scrolling; fades out 250ms after 400ms idle
interaction             none — visual only
shown only if           content > viewport
```

Everything above is verbatim from the source. **Desktop needs an interactive bar and
Material has none** — this project's extension (candidate scroll-a B): same
geometry and colour, no fade, a 12dp invisible grab zone at the end edge, thumb widens
4→8dp on hover/drag with an 8% / 10% state layer behind the zone. Slint: its
`material` style ScrollView draws its own bar and pads content beside it (issue #7707);
policy `as-needed | always-off | always-on` exists in the Slint Material components.

## Switch (`_md-comp-switch.scss`)

```
latest:   handle 20 × 20px
v0.192:   unselected handle 16px, selected handle 24px, pressed 28px,
          state-layer-size 40px
```
The Settings mocks use a 52×32 track with a 24px selected handle, which matches the
v0.192 selected-handle figure. Re-check against `latest` if switches become prominent.

---

## Other verified odds and ends

```
checkbox / radio state-layer-size        40px
snackbar single-line container height    48px
progress indicator stop-indicator-size    4px
```

---

## Not yet read — look these up before using them

- ~~Colour role hexes~~ — now read, see "Colour roles (dark), verified" above.
- **State-layer opacities** (hover / focus / pressed) — in `md-sys-state`.
- **Elevation levels** — in `md-sys-elevation`. Barely relevant here: a true-black
  theme leans on outlines rather than shadows.
- **Menu, snackbar, FAB, icon-button and top-app-bar dimensions** — the context menu
  and snackbar mocks use 48px rows and 12px radii by eye, not from tokens.
- **Motion tokens** (durations, easing) — nothing animated has been designed yet.

---

## How this project applies the tokens

```
track row                 72px, two-line, body-large title + body-small supporting
folder row / letter cell  48px minimum (project rule C1, stricter than MD3 in places)
mode control              connected button group, medium (56px, 2px gaps)
seek + volume sliders     4×44 handle on a 16px track, inactive = #22222A
play button               64px circle, primary fill, on-primary glyph
prev / next               48px circles, surface-container-high fill
buttons and chips         40px visual minimum inside a 48px target row
outlines                  1px, #6F6A78
```
