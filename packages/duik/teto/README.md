# @monochromatic-dev/duik-teto

Kasane Teto SV character separated into individual SVG body parts for rigging with After Effects Duik.

## Reference

Based on the official Kasane Teto SV (Synthesizer V) character design by Sakauchi Waka,
published by TwinDrill.

## SVG authoring rules

All part SVGs must follow these constraints for correct AE import and Duik rigging:

- **Shared viewBox:** every file uses `viewBox="0 0 800 1200"` so layers align spatially on import
- **One part per file:** each SVG contains only the geometry for that body part, on a transparent background
- **Joint overlap:** extend hidden edges slightly under neighboring parts at joints
  (e.g. upper arm extends under torso, thigh extends under skirt)
  so rotation during animation does not reveal gaps
- **Strokes to fills:** convert strokes to filled paths where possible,
  as AE SVG stroke rendering can be unreliable
- **No embedded raster:** keep everything as vector paths

## Parts inventory

Files live in `parts/`.

**Head group**

- `head_face` -- face, ears, neck stub
- `eyes` -- both eyes with irises, pupils, highlights (separate for blink animation)
- `mouth` -- lips (separate for lip sync)

**Hair group**

- `hair_back` -- hair mass behind head
- `hair_bangs` -- front fringe
- `hair_drill_L` -- left twin drill
- `hair_drill_R` -- right twin drill
- `hair_accessory_L` -- left white horn/ribbon accent
- `hair_accessory_R` -- right white horn/ribbon accent

**Torso group**

- `torso_front` -- jacket body, buttons, collar, collar pin
- `epaulette_L` -- left layered shoulder plate
- `epaulette_R` -- right layered shoulder plate

**Arm group**

- `upper_arm_L` / `upper_arm_R` -- shoulder to elbow, jacket sleeve
- `forearm_L` / `forearm_R` -- elbow to wrist, including black cuff
- `hand_L` / `hand_R`

**Lower body group**

- `skirt_back` -- red underskirt layer (renders behind legs)
- `skirt_front` -- gray panels over red, waistband (renders in front of legs)
- `upper_leg_L` / `upper_leg_R` -- thigh
- `lower_leg_L` / `lower_leg_R` -- calf
- `boot_L` / `boot_R` -- knee-high boots with red trim

## Layer order (back to front)

```
hair_back
torso_front
skirt_back
upper_arm_L
forearm_L
hand_L
upper_arm_R
forearm_R
hand_R
upper_leg_L
lower_leg_L
boot_L
upper_leg_R
lower_leg_R
boot_R
skirt_front
epaulette_L
epaulette_R
head_face
hair_bangs
hair_drill_L
hair_drill_R
hair_accessory_L
hair_accessory_R
eyes
mouth
```

## Joint positions (Duik pin placement)

Coordinates within the `0 0 800 1200` viewBox:

- **Neck:** 400, 225
- **Left shoulder:** 310, 245
- **Right shoulder:** 490, 245
- **Left elbow:** 275, 350
- **Right elbow:** 525, 350
- **Left wrist:** 250, 445
- **Right wrist:** 550, 445
- **Hip center:** 400, 440
- **Left knee:** 348, 700
- **Right knee:** 436, 700
- **Left ankle:** 340, 900
- **Right ankle:** 444, 900

These are also shown as green circles in `_preview_composite.svg`.

## Composite preview

Open `parts/_preview_composite.svg` in a browser to see all layers stacked in the correct order
with joint markers overlaid.

## Color palette

- Dark (boots, cuffs, outlines): `#2a2a2a`
- Mid gray (jacket, skirt panels): `#9a9a9a`
- Light gray (jacket trim, epaulettes): `#c8c4be`
- Skin: `#f0ddd0`
- Red (hair, skirt accents): `#cc2244`
- Dark red (hair shadow): `#a01a35`
- White (hair accessories): `#f0ede8`

## License

CC BY-NC-SA 4.0. See `LICENSE`.
