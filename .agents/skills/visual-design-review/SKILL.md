---
name: visual-design-review
description: Visual design work. Use before building or reviewing UI design variants, design matrices, HTML review forms, device mockups or frames, Android screen comparisons, or a UI matched to a reference screenshot. Loading it is a required step before the first visual artifact, not an option.
---

# Visual design review

## Review workflow

QVE:
 Start visual review from the accepted design;
 name consequential concerns the user didn't raise and explore them as built variants,
 never a vague approval question.

QVM:
 Design matrix:
 per-variant pros,
 cons,
 analysis,
 full ranking,
 recommended additions;
 end with separable questions whose answers select among visible new variants.

MXQ:
 Size design matrices by consequential independent dimensions and meaningful variants,
 never by a number the user gave only as an example.

HFM:
 Ask visual-design questions via one self-contained,
 verified HTML form:
 built options,
 pros/cons,
 ranking,
 final free-text field.

RVC:
 After a decision,
 review shows only the active design;
 rejected candidates stay in docs,
 compared only on explicit request.

## Building and matching

PFG:
 Minimum padding/spacing is a hard floor:
 test fit there;
 when it fails,
 reflow or truncate permitted content,
 never a below-minimum compact fallback.

PXF:
 Screenshot-driven UI:
 measure reference geometry,
 colors,
 spacing,
 states;
 before completion,
 render result side-by-side at matching scale.
Memory isn't evidence.

M1T:
 Multi-row Material Design 1 tabs:
 each label one content-width line plus horizontal padding;
 wrap whole tabs across rows,
 never text inside a tab.

## Devices and Android

ZDV:
 Device mockups:
 capture at cited physical px,
 display at 100% of cited dp,
 show px,
 dp,
 current scale + reset;
 never upscale a dp-sized bitmap.

BZF:
 Device frames:
 measured opaque chassis,
 bezels,
 hinge + corners;
 screenshot sits inside the screen opening,
 never clipped to reveal page.

ANB:
 Android mocks:
 show status + navigation bars at current target geometry (screen dimensions include them);
 keep app controls out of cutouts and insets.

AVP:
 Android screen comparisons:
 build nonfunctional Compose prototype,
 install on target emulator,
 capture each candidate at panel px,
 then present in HTML.
