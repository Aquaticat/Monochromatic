# TODO: lint cleanup

`mise run //packages/webapp-edu/paper2vn:lint:oxlint` reports 27 errors and 181 warnings as of v0.0.1.
The build, the type check, and the seeded-save lecture flow all pass.

## Resolved in this round

- 22 `typescript-eslint(no-unsafe-type-assertion)` errors -- refactored `screens/settings.ts` to capture typed element refs and `addEventListener` post-creation; added `coerceLocale`/`coerceProviderId` helpers; changed `lecture.ts` timer type to `ReturnType<typeof setTimeout>`. The remaining JSON-parse / pdfjs casts have `oxlint-disable-next-line` directives with justification per AGENTS.md.

## Remaining counts

```
43 tsdoc(require-example)
25 tsdoc(require-param)
24 eslint(no-magic-numbers)
21 tsdoc(require-returns)
18 stylistic(object-property-per-line)
17 tsdoc(require-tsdoc)
 9 eslint(new-cap)
 8 eslint(init-declarations)
 6 eslint-plugin-unicorn(numeric-separators-style)
 5 stylistic(type-property-per-line)
 3 tsdoc(multiline-blocks)
 3 eslint(max-lines)
```

## Categories

### tsdoc(require-example, require-param, require-returns, require-tsdoc) -- 106

Add missing `@example`, `@param`, `@returns` tags and TSDoc blocks. The screen modules and `dom.ts` have most of the gaps. AGENTS.md mandates these on every declaration.

### eslint(no-magic-numbers) -- 24

Lift literals to named constants. Hot spots:

- `state.ts` -- `textSpeed: 40`, `voiceVolume/bgmVolume: 0.3`, `autoAdvanceDelayMs: 1600`, font scale range bounds
- `select-topic.ts` -- random-id seed `1e6`
- `parse/index.ts` -- `30 * 1024 * 1024` byte cap
- `dialogue/generator.ts` -- `60_000` paper text budget
- `tts.ts` -- voice-pick fallbacks
- `settings.ts` -- range bounds (`0.75`, `1.5`, `0.05`, `120`, `5000`, `100`, `5`)

### eslint(new-cap) -- 9

`LL()`, `i18nObject(...)`, `initI18n(...)` factory calls flagged because their names start with uppercase. Either rename in the wrapper or configure `new-cap` to allow these specific identifiers.

### eslint(init-declarations) -- 8

`let foo;` declarations in `state.ts` and `lecture.ts` need explicit initializers (typically `undefined`).

### eslint(max-lines) -- 3

`screens/lecture.ts` and `screens/settings.ts` exceed the line limit. Split into sub-modules:

- `lecture.ts` -> `lecture/runtime.ts` (typewriter + auto), `lecture/toolbar.ts`, `lecture/ask-panel.ts`
- `settings.ts` -> `settings/display.ts`, `settings/provider.ts`

### stylistic -- 23 (`object-property-per-line`, `type-property-per-line`, `tuple-per-line`)

Mostly auto-fixable formatting; `dprint` should handle this once configured for the package.

### Remaining tsdoc/structural issues

- `multiline-blocks` -- some `/** */` comments have layout issues (3)
- `valid-types` -- TSDoc does not allow TypeScript type syntax in tags (2)
- `numeric-separators-style` -- `_` separators on numbers >= 5 digits (6)

## Suggested order

1. Split `lecture.ts` and `settings.ts` to clear `max-lines` first; smaller files lint faster on iteration.
2. Lift magic numbers to named constants: knocks out `no-magic-numbers` and most `numeric-separators-style`.
3. Add missing TSDoc: volume work, but mechanical.
4. Configure `new-cap` allowlist for typesafe-i18n factories.
5. Fix `init-declarations` and stylistic remainder.

## Verification expected after cleanup

- `mise run lint:types` -- already green
- `mise run lint:oxlint` -- 0 errors, 0 warnings
- `mise run build` -- already green; `dist/final/index.html` mounts in a browser
