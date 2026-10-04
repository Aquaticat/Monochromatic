# Bundled application fonts

These unmodified upstream font files are imported by `ui/app.slint` and embedded by the Slint build.
JetBrains Mono is the source font.
Inter Regular and SemiBold cover the UI's current weights.
System fonts may still provide glyph fallback outside these fonts' coverage.

## Provenance

Inter files come from [Inter v4.1][inter],
using `extras/ttf/Inter-Regular.ttf` and `extras/ttf/Inter-SemiBold.ttf`.
The archive's `LICENSE.txt` is preserved as `Inter-LICENSE.txt`.

JetBrains Mono comes from [JetBrains Mono v2.304][mono],
using `fonts/ttf/JetBrainsMono-Regular.ttf`.
The archive's `OFL.txt` is preserved as `JetBrainsMono-OFL.txt`.

Both fonts are distributed under SIL Open Font License 1.1.
The original files have not been renamed internally,
subsetted,
or modified.

## Shaping and feature policy

JetBrains Mono's programming ligatures are in `calt`,
not `liga`,
according to the [upstream feature catalog][mono-features].
The source shaper explicitly enables `calt`.
Tests compare actual glyph IDs against a disabled control,
retain the same operator advances,
and verify caret/hit/copy boundaries inside the ligatures.
Optional stylistic sets and character variants are not indiscriminately enabled.

Selection foreground is clipped against source-character selection geometry.
It is not a text brush applied to an entire glyph:
that previously left unselected-colored ink inside a partially selected ligature.
The observed-failing regression selected the middle character of `===`.
The fixed path preserves glyph identities and checks clipping/alpha at fractional scales and origins.

The bundled Inter faces have kerning,
contextual alternates,
discretionary ligatures,
number forms,
and character/style variants.
The [Inter project][inter-site] describes these independent features.
Tests verify default kerning against `kern` disabled,
real 400/600 face selection against the embedded bytes,
and tabular versus proportional numeral controls in the shared Parley/fontique stack.
Slint's current UI path receives family,
weight,
size,
letter spacing,
line-height factor,
and italic through `FontRequest`;
it does not carry an arbitrary OpenType feature list in that interface.
No font-settings panel was added.

All currently bundled files are static faces:
inspection found no `fvar` table.
They do not provide variable `wght`,
`opsz`,
or `slnt` axes.
Do not claim variable-weight or automatic optical-size support from these assets.
Inter's bundled real weights cover the currently used UI weights;
italic source/UI styles are not currently requested.

## SHA-256

- `Inter-Regular.ttf`:
  `40d692fce188e4471e2b3cba937be967878f631ad3ebbbdcd587687c7ebe0c82`.
- `Inter-SemiBold.ttf`:
  `78a843fade9d4612a5567302fb595b56976eb5fcebf4fea5a5912d638bafcde3`.
- `JetBrainsMono-Regular.ttf`:
  `a0bf60ef0f83c5ed4d7a75d45838548b1f6873372dfac88f71804491898d138f`.
- `Inter-LICENSE.txt`:
  `262481e844521b326f5ecd053e59b98c8b2da78c8ee1bdbb6e8174305e54935a`.
- `JetBrainsMono-OFL.txt`:
  `30f0c136e3c88e422d0791acd97238870f9054a9729bc34cf2ff0d4ed8cac4ad`.

[inter]: https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip
[mono]: https://github.com/JetBrains/JetBrainsMono/releases/download/v2.304/JetBrainsMono-2.304.zip
[mono-features]: https://github.com/JetBrains/JetBrainsMono/wiki/OpenType-features
[inter-site]: https://rsms.me/inter/
