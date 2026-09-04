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
