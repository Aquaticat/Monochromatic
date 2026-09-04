# Device metrics — Pixel 9 Pro Fold

**Do not invent these numbers, and do not put invented ones into question options.**
Both mistakes were made in phase one (see review-notes.md #2).

---

## Published hardware figures

| | Cover screen | Inner (unfolded) |
|---|---|---|
| Diagonal | 6.3 in | 8.0 in |
| Resolution | 1080 × 2424 px | 2076 × 2152 px |
| Aspect | 20:9 | 1:1 (square) |
| Density | ~422 ppi | ~373 ppi |
| Panel | OLED, 120Hz | LTPO OLED, 1–120Hz |

Physical: **155.2 × 150.2 × 5.1 mm unfolded**, **155.2 × 77.1 × 10.5 mm folded**, 257 g.

---

## Converted to dp (what you design against)

```
Cover screen   1080 / 2.625  ×  2424 / 2.625   =   ~411 × 923 dp   (density 420dpi)
Inner display  2076 / 2.4375 ×  2152 / 2.4375  =   ~852 × 883 dp   (density ~390dpi)
```

The density buckets are inferred from the panel ppi in the usual Android way; if you
need exactness, read `Configuration.densityDpi` on the device. The **shape** is what
matters for layout and it is not in doubt.

## Questionnaire frame geometry

Google's current hardware specification confirms an 8-inch inner display at
2076 × 2152px and an unfolded body measuring 150.2 × 155.2mm in width-first order.
The questionnaire frame uses those figures rather than treating the active display as
the outside of the phone.

Distributing the 203.2mm display diagonal by the panel's pixel aspect gives an active
area of approximately 141.08 × 146.24mm. Applying the body-to-active-area ratios to
the 852 × 883dp design surface gives 907.09 × 937.08. The reusable frame therefore
uses these coordinates at 100%:

- 907 × 937 CSS px for the complete unfolded body.
- 852 × 883 CSS px for the active screen content.
- 27px start, 28px end, and 27px block-axis chassis insets.
- 454 × 937 CSS px for a crop from the fold centre through the right body edge.
- 8px of seam-facing screen context, 418px of right-pane content, and 28px of outer
  chassis in that crop.

The user supplied eight current product references on 2026-09-04. The straight-on
`google-pixel-9-pro-fold-1.jpg` reference is 629 × 650px, an outer ratio of 0.9677.
Google's 150.2 × 155.2mm body is 0.9678. Measurements from that reference set the
current approximately 72dp outer corner, 42dp screen corner, 28dp inner-camera cutout,
and 44dp hinge cap. The other supplied views confirm that the inner camera is at the
top-right, the centre fold has hinge hardware only at the outer edges, and a right-half
study has no independent rounded left chassis.

The JPEG references carry a visible publisher watermark and are not embedded in the
questionnaire. They were used only for measurement and side-by-side inspection. The
CSS frame is opaque vector geometry; each source PNG remains rectangular screen
content placed inside its opening.

Source: [Google Pixel phone hardware tech specs][pixel-hardware-specs].

[pixel-hardware-specs]: https://support.google.com/pixelphone/answer/7158570?hl=en

---

## Layout implications (these are the point)

1. **The inner display is essentially square and slightly taller than wide.** It is
   not a landscape tablet. Every mockup drawn at 924×600 was wrong in structure.
2. **The hinge is vertical in portrait**, so the inner display splits into two halves
   of roughly **418dp × 883dp** with a 16dp seam gutter between them. Each half is
   narrow and tall — closer to a phone column than a pane.
3. **Nothing interactive may cross the crease** (decisions.md E2). A full-width
   transport row puts the play button on the fold; this is why the deck sits inside
   one half.
4. **The cover screen is taller and narrower than a normal phone frame** (411×923
   versus the 390×844 that was wrongly assumed). At 72dp rows, roughly six track rows
   fit under a full deck.
5. **Tabletop posture** is detectable on Android only (decisions.md E3).

---

## Viewport sizes to design and test at

```
411 × 923    cover screen (folded)
852 × 883    inner display (unfolded)
418 × 883    one half of the inner display
1280 × 800   a reasonable desktop window (not yet specified by the user)
```

Set these as the Design Component preview size so the file is always judged at the
right dimensions.

---

## For context: other book-style foldables

Useful only if the target ever changes. The Pixel 9 Pro Fold’s inner panel is squarer
than most; the original Pixel Fold was 1840×2208 px and physically wider (158.7 mm
across unfolded, versus 150.2 mm). Galaxy Z Fold 6 and OnePlus Open are also
near-square but slightly wider than tall. Do not carry any of these numbers into the
design without re-deriving them.
