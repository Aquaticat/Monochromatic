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
