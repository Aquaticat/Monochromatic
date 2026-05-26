# Grammar fixes for i18n-compose render tests

Plan to remove ungrammatical golden values from the locale render tests.
Six ungrammatical outputs span English, Chinese, and Catalan.
Three are renderer (library) weaknesses; two are deliberately ungrammatical agreement probes that stay
as-is with a justifying comment; one is a renderer bug.

This is a plan only; no edits are applied until an action verb authorizes them.

## Decisions taken

- English gerund and present3s fallbacks become morphologically robust (maximal scope, including heuristic
  consonant-doubling for the gerund).
- The two English third-person-singular agreement tests stay intentionally ungrammatical and gain a comment
  declaring why.
- Chinese spacing follows pangu rules through a single locale-agnostic `joinTokens`, not a Chinese-local
  helper. The rule is consistent across languages, so Latin output is unaffected.
- Catalan elided-article spacing is a genuine renderer bug and gets fixed.

## English: robust morphology fallbacks

The library owns language mechanics, so the spelling fallbacks should derive regular forms instead of naive
concatenation. Genuine irregulars and heuristic misfires stay overridable through explicit verb-entry fields.

Add `packages/module/i18n-compose/src/locales/en/morphology.ts` exporting two named functions, with TSDoc,
no regex (use `endsWith`, `slice`, and a vowel `Set`), and a companion `morphology.unit.test.ts`.

### Gerund fallback (point 1, maximal)

Current: `render-fragment.ts:62` uses `entry.gerund ?? \`${entry.base}ing\``, so `save` yields `saveing`.

Replace the fallback with `entry.gerund ?? englishGerund({ base: entry.base },)`. Rules, applied in order:

1.  Ends in `ie`: drop `ie`, add `ying`. `die` to `dying`, `lie` to `lying`.
2.  Ends in a consonant-vowel-consonant run where the final consonant is not `w`, `x`, or `y`, and the
    vowel is single: double the final consonant, add `ing`. `run` to `running`, `stop` to `stopping`,
    `begin` to `beginning`. Heuristic misfire: `open` to `openning`; correct via explicit `gerund`.
3.  Ends in `e` but not `ee`, `oe`, or `ye`: drop `e`, add `ing`. `save` to `saving`, `make` to `making`.
4.  Otherwise: add `ing`. `want` to `wanting`, `see` to `seeing`, `play` to `playing`, `fix` to `fixing`.

Known 2-letter misfire: `be` falls into rule 3 and yields `bing`; `be` is irregular (`being`) and needs an
explicit `gerund`. Document this in the function TSDoc.

### present3s fallback (point 2, common rules; doubling never applies to `-s`)

Current: `render-vp.ts:126` uses `entry.present3s ?? \`${entry.base}s\``.

Replace with `entry.present3s ?? englishThirdSingular({ base: entry.base },)`. Rules, applied in order:

1.  Ends in `s`, `x`, `z`, `ch`, or `sh`: add `es`. `kiss` to `kisses`, `fix` to `fixes`, `watch` to
    `watches`, `wash` to `washes`, `buzz` to `buzzes`.
2.  Ends in a consonant plus `y`: drop `y`, add `ies`. `try` to `tries`, `fly` to `flies`. A vowel plus `y`
    adds `s`: `play` to `plays`.
3.  Ends in `o`: add `es`. `go` to `goes`, `do` to `does`.
4.  Otherwise: add `s`. `save` to `saves`, `want` to `wants`.

No current test verb hits this fallback (every test verb supplies `present3s`), so this changes no existing
golden; it hardens the library and gets its own unit tests.

### Wiring and tests

- `render-fragment.ts` `nonFiniteSurface` calls `englishGerund` in the fallback position.
- `render-vp.ts` declarative-surface branch calls `englishThirdSingular` in the fallback position.
- `render-en.unit.test.ts` gerund test: golden `saveing` becomes `saving`; rename the case to
  "uses the gerund or derives it from base"; `save` keeps no explicit `gerund`, so it exercises the fallback.
- Add a case proving an explicit `gerund` field overrides the derived form.
- `morphology.unit.test.ts` covers each rule branch for both functions.

## English: intentionally ungrammatical agreement probes (point 3)

`render-en.unit.test.ts` reuses the `they` key with overridden `person: 3, number: 'singular'` to isolate the
present3s and do-support agreement path, because the shared test vocabulary has no he/she/it subject. The
surface stays `they`, so the output is deliberately ungrammatical.

Keep both goldens unchanged:

- `They has 1 cat.` (declarative 3s, line 188)
- `Does they have 1 cat?` (do-support 3s, line 273)

Add a comment above each local spec explaining the deliberate surface mismatch, that it isolates the agreement
form, and that the shared vocabulary intentionally lacks a third-singular subject. The comment is the contract
that this ungrammatical golden is intended.

## Chinese: pangu spacing through joinTokens (point 4)

Chinese output currently inserts ASCII spaces between adjacent Han characters (`我 有`) because every Chinese
renderer joins constituents with `joinTokens`, which space-joins unconditionally. The space around digits
(`有 1 只`) is correct pangu spacing and stays.

Upgrade `render-helpers.ts` `joinTokens` to apply the pangu rule at token boundaries: insert a space between
two adjacent tokens unless the boundary code points (last of the left token, first of the right token) are
both CJK. The decision is per boundary, never inside a token, so `noun.externalText` interiors and the
`1 只` digit space inside a counted phrase survive verbatim.

Backward compatibility: Latin tokens never form a both-CJK boundary, so English and Catalan joins are
unchanged. The existing `joinTokens(['Do', 'I', 'have', '1 cat'],)` to `Do I have 1 cat` assertion still holds.

CJK detection by Unicode code-point range, no regex:

- CJK Unified Ideographs `U+4E00` to `U+9FFF`
- Extension A `U+3400` to `U+4DBF`
- Compatibility Ideographs `U+F900` to `U+FAFF`
- Extension B and beyond `U+20000` to `U+2FA1F`
- CJK symbols and punctuation `U+3000` to `U+303F`, plus kana `U+3040` to `U+30FF`, for completeness

Implementation keeps O(n) over the small token list: filter empties, then build per-token segments
(`''` or `' '` prefix from the boundary check) and join with `''`, avoiding a growing-string accumulator.

### Golden updates in render-zh.unit.test.ts

1.  Line 131: `我 有 1 只猫。` becomes `我有 1 只猫。`
2.  Line 145: `我 看见了 1 只猫。` becomes `我看见了 1 只猫。`
3.  Line 159: `我 会看见 1 只猫。` becomes `我会看见 1 只猫。`
4.  Line 181: `我 有 1 只猫吗？` becomes `我有 1 只猫吗？`
5.  Line 204: `我 看见 什么？` becomes `我看见什么？`
6.  Line 218: `谁 看见 1 只猫？` becomes `谁看见 1 只猫？`
7.  Line 233: `我 在哪里 看见 1 只猫？` becomes `我在哪里看见 1 只猫？`

The `includes('吗',)` negative assertions and the `endsWith` punctuation tests are unaffected.

### joinTokens coverage and follow-up

Every Chinese join routes through `joinTokens`: `render-sentence.ts` (six sites), `render-fragment.ts`
(one site), `render-vp.ts` (one site). Upgrading `joinTokens` covers them all. Audit the Chinese
`render-fragment.ts` sequence branch for a raw `.join(' ',)`; if present, route it through `joinTokens` too.

Add a Chinese-boundary case to `render-helpers.unit.test.ts`, for example
`joinTokens(['我', '有', '1 只猫',],)` to `我有 1 只猫`, and update the `joinTokens` TSDoc to state the pangu rule.

## Catalan: elided-article spacing (renderer bug)

`render-ca.unit.test.ts` line 84 asserts `l' article`; correct Catalan is `l'article` with no space. The
elided definite article `l'` comes from `caNouns.item.articles.definite.singular`.

Root cause: `render-np.ts` definite and indefinite branches (lines 156 to 162 and 168 to 174) always join
`${article} ${surface}`.

Fix: when the article surface ends in an apostrophe, join with no separator; otherwise keep the space.
Generalize to "article ends in apostrophe" rather than hardcoding `l'`, so real-consumer elisions such as
`d'` also attach correctly. Change the test golden to `l'article`.

## Verification

Run from the package after implementing:

- `mise run //packages/module/i18n-compose:lint:types`
- `mise run //packages/module/i18n-compose:lint:oxlint`
- `mise run //packages/module/i18n-compose:test:unit`

Confirm render-en, render-zh, render-ca, render-helpers, public-api, and the new morphology test are green.

## Suggested commit grouping

- `fix(module-i18n-compose)`: robust English gerund and present3s fallbacks plus new morphology module,
  pangu-aware `joinTokens`, Catalan elided-article spacing.
- `test(module-i18n-compose)`: updated zh and en goldens, the intentional-ungrammaticality comments, and the
  new morphology and joinTokens unit cases.

Combine into one logical unit if preferred, since the renderer changes and their goldens move together.
