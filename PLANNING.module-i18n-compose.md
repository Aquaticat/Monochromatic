# Plan: build `@monochromatic-dev/module-i18n-compose`

Status: brainstorm captured; no code on disk yet.

Companion documents:

- [`TROUBLESHOOTING.typesafe-i18n-regex-redos.md`](./TROUBLESHOOTING.typesafe-i18n-regex-redos.md): the engine-dependent ReDoS in `typesafe-i18n` 5.27.1 `REGEX_BRACKETS_SPLIT` that motivated revisiting the i18n choice.

## Context

`ssg-test` and previously `paper2vn` used `typesafe-i18n` 5.27.1. The library's parser regex catastrophically backtracks on translations with nested `{}` literals under V8, hanging Chromium e2e tests. The bug is bypassed in `paper2vn` via a `rawString` workaround; `paper2vn` is now frozen and out of consideration.

For `ssg-test` going forward, we decided to stop depending on `typesafe-i18n` and any other off-the-shelf i18n library, and instead own a small composition-based i18n module suitable for the messages a UI actually emits.

The shape of this module is informed by the same decision history as `module/test`: built originally to work around a few bugs and incompatible assumptions in upstream tools, grew to feature-complete and parity over time, has a clear API surface and a definite "done" signal driven by what consumers actually need.

## Decision

Build a workspace module `@monochromatic-dev/module-i18n-compose` at `packages/module/i18n-compose/`. The module exposes a structured, type-safe API for composing UI messages from semantic parts (subject, verb, object, etc.). Each consuming package declares its own vocabulary unions (Subject, Verb, Noun) and one `LocaleSpec` per locale; the lib provides types, the public accessor (`createI18n`), and shared grammar helpers.

Initial scope: en and zh, supporting the message patterns enumerated in §"v1 scope".

`ssg-test` migrates from `typesafe-i18n` to this lib. The `typesafe-i18n` devDependency and code-generation step are removed.

## Alternatives considered

Surveyed in the order they were eliminated.

### Keep `typesafe-i18n` (status quo, with `rawString` workaround)

Rejected. The bug is contained for `paper2vn`, but `ssg-test` should not inherit the engine-dependent ReDoS surface. The codingcommons revival of upstream has shipped only CI/release plumbing since the 2026 revival; no bug-fix commits, so a fix is not assured. Continuing to depend on it means continuing to ship a known sharp edge.

### `i18next`

Rejected. Runtime library (no compile step), but heavier than typesafe-i18n on shipped bytes when bundled. Type safety via `i18next-resources-for-ts` is "less first-class than typesafe-i18n, but workable" — parameter-name and type inference from `{{name}}` placeholders is best-effort template-literal-type magic and known to be incomplete for formatters, plurals, contexts, nested namespaces. For `ssg-test` shipped-size is irrelevant (lib is build-time only), so the disqualifier is the weak type safety, not bundle weight.

### `@inlang/paraglide-js`

Rejected. Best technical fit on type safety (each message becomes a typed TS function via codegen) and per-message tree-shaking, but it requires a compile step (`paraglide-cli compile`). For developer-authored translations the compile step adds build-system surface without buying anything we cannot achieve in plain TS. Also heaviest transitive build deps among candidates (`@inlang/sdk`, `@lix-js/sdk`, `kysely`, `sqlite-wasm-kysely`).

### `@lingui/core`

Rejected. Compile step via `@lingui/cli`. ICU MessageFormat means literal `{` / `}` requires single-quote escaping — same problem the typesafe-i18n decision was trying to escape, in a different shape.

### `typed-locale`

Rejected. Closest match to the "no compile step + type-safe params" middle ground, but the implementation uses recursive template-literal types of the form `T extends \`${string}{{${infer Param}}}${infer Rest}\`` (`packages/typed-locale/src/infer.ts:19`) — exactly the pattern flagged as unreliable in this repo. Also bus-factor 1 (10 GitHub stars, 47 commits, single maintainer, last release Sep 2025) and uses runtime regex at `phrase-builder.ts:8`.

### `@qzlcorp/typed-i18n`

Rejected. Avoids per-message template-literal-type parsing for variables — but at the cost of typing parameters loosely as `Record<string, string | number | boolean>` (`packages/core/src/index.ts:136`). The main reason to reach for a typed i18n lib over plain object lookup is per-message variable safety; without it, the value disappears. Still uses recursive template-literal types for key paths (depth-capped at 9). Bus factor 1, 42 monthly downloads, last release Dec 2025.

### Hand-rolled "messages as functions" (single accessor, ~10 lines)

Considered, then escalated past. The shape was: each message is a TS function, `Record<Locale, Messages>` lookup, type safety from each function's signature. Works for `ssg-test`'s current 10 zero-arg UI strings and is what was nearly settled before the brainstorm scope expanded. Limits: doesn't handle structured composition (counted nouns + classifier + plural + conjugation differences between en and zh).

### Hand-rolled structured composition (this plan)

Chosen. Provides the type safety and zero-compile-step properties of the messages-as-functions approach while also handling the grammatical variation between en and zh. Surface is bounded by what UI messages actually emit (see "v1 scope" below); explicit non-goals avoid scope creep into general-purpose natural-language generation.

## Architecture

### Two-tier reduced to one tier

The original brainstorm distinguished Tier 1 (static labels via `Record<Key, () => string>`) from Tier 2 (composition via `Sentence`). The final design merges them: partial sentences are first-class in the composition API, so even "Save" / "保存" goes through the same module. Two-span fallback for non-vocabulary text ("Posted at {time}") is handled by the caller concatenating a lib-emitted noun phrase with an interpolated value — no template-with-holes primitive.

### Module layout

```
packages/module/i18n-compose/
├── mise.toml
├── package.json
├── README.md
├── tsconfig.json
└── src/
    ├── index.ts                   # public API: createI18n + re-exports
    ├── types.ts                   # Sentence, NounPhrase, LocaleSpec, etc.
    ├── core-vocab.ts              # CoreSubject, CoreVerb, CoreNoun defaults
    ├── locales/
    │   ├── en.ts                  # English LocaleSpec
    │   └── zh.ts                  # Chinese LocaleSpec
    └── *.unit.test.ts             # table-driven tests
```

### Public types

```ts
export type CoreSubject = 'I' | 'you' | 'he' | 'she' | 'it' | 'we' | 'they';
export type CoreVerb = 'have' | 'see' | 'like' | 'save' | 'delete' | 'want' | /* extensible per consumer */;
export type CoreNoun = 'cat' | 'dog' | 'person' | 'book' | 'item' | 'message' | /* extensible per consumer */;

export type Mood = 'declarative' | 'interrogative' | 'wh-interrogative' | 'imperative';
export type Tense = 'past' | 'present' | 'future';
export type Terminator = '.' | '?' | '!';
export type WhWord = 'what' | 'where' | 'when' | 'who' | 'why' | 'how';

export type Person = 1 | 2 | 3;
export type GrammaticalNumber = 'singular' | 'plural';

/** Possessor is either a pronoun from the consumer's Subject union, or a literal name (grammatically 'it'). */
export type Possessor<S extends string> =
  | { possessor: S }
  | { possessorName: string };

export type NounPhrase<S extends string = CoreSubject, N extends string = CoreNoun> =
  | N                                          // bare noun: "cat" / "猫"
  | { adj: number; noun: N }                   // counted: "1 cat" / "1 只猫"; "0 messages" / "0 条消息"
  | (Possessor<S> & { noun: N });              // possessed: "my cat" / "我的猫"; "John's cat" / "John 的猫"

/** Inner action for "Do you want to delete X?" shape. */
export type Complement<S extends string, V extends string, N extends string> = {
  verb: V;
  object?: NounPhrase<S, N>;
};

export type Sentence<
  S extends string = CoreSubject,
  V extends string = CoreVerb,
  N extends string = CoreNoun,
> = {
  mood?: Mood;                                 // default 'declarative'
  tense?: Tense;                               // default 'present'
  whWord?: WhWord;                             // required iff mood === 'wh-interrogative'
  subject?: S;                                 // optional iff mood === 'imperative'
  verb: V;
  object?: NounPhrase<S, N>;
  complement?: Complement<S, V, N>;            // for embedded "want to X" form
  adverbial?: NounPhrase<S, N>;                // time/location phrase
  terminator?: Terminator;                     // default deduced from mood
};
```

### LocaleSpec (split into `vocab` / `grammar` / `render`)

```ts
export interface VocabTables<
  S extends string = CoreSubject,
  V extends string = CoreVerb,
  N extends string = CoreNoun,
> {
  pronoun: Record<S, { surface: string; person: Person; number: GrammaticalNumber }>;
  verb: Record<V, (ctx: { person: Person; number: GrammaticalNumber; tense: Tense }) => string>;
  noun: Record<N, {
    base: string;
    classifier?: string;                       // zh measure word: 只, 个, 本, 辆, …
    pluralize?: (n: number) => string;         // en plural form
    adverbialPrep?: string;                    // en: "at" / "in" / "on" — zh: "" or "在"
  }>;
  whWord: Record<WhWord, string>;
}

export interface GrammarHelpers {
  capitalize: (s: string) => string;
  renderTerminator: (t: Terminator) => { particle?: string; punctuation: string };
}

export interface RenderMethods<
  S extends string = CoreSubject,
  V extends string = CoreVerb,
  N extends string = CoreNoun,
> {
  noun: (n: N) => string;
  np: (np: NounPhrase<S, N>) => string;
  vp: (vp: { verb: V; mood?: Mood; tense?: Tense; subject?: S }) => string;
  sentence: (s: Sentence<S, V, N>) => string;
}

export interface LocaleSpec<
  S extends string = CoreSubject,
  V extends string = CoreVerb,
  N extends string = CoreNoun,
> {
  vocab: VocabTables<S, V, N>;
  grammar: GrammarHelpers;
  render: RenderMethods<S, V, N>;
}
```

### Public API

```ts
export function createI18n<
  L extends string,
  S extends string = CoreSubject,
  V extends string = CoreVerb,
  N extends string = CoreNoun,
>(locales: Record<L, LocaleSpec<S, V, N>>): (locale: L) => RenderMethods<S, V, N>;
```

Usage:

```ts
import { createI18n } from '@monochromatic-dev/module-i18n-compose';
import { en } from './locales/en.ts';
import { zh } from './locales/zh.ts';

const t = createI18n({ en, zh });

t('en').sentence({ subject: 'I', verb: 'have', object: { adj: 1, noun: 'cat' } });
//   → "I have 1 cat."
t('zh').sentence({ subject: 'I', verb: 'have', object: { adj: 1, noun: 'cat' } });
//   → "我有 1 只猫。"
```

### Escape hatch: consumer extends the unions

Consumers who need vocabulary beyond the Core defaults declare their own unions and pass them as type parameters to `createI18n`:

```ts
type MySubject = CoreSubject | 'reader';
type MyNoun = CoreNoun | 'post';

const en: LocaleSpec<MySubject, CoreVerb, MyNoun> = { /* must include 'reader' and 'post' in vocab tables */ };
const zh: LocaleSpec<MySubject, CoreVerb, MyNoun> = { /* same */ };

const t = createI18n<'en' | 'zh', MySubject, CoreVerb, MyNoun>({ en, zh });
t('en').np({ possessor: 'reader', noun: 'post' });   // "the reader's post"
```

Pronouns added beyond the Core set are grammatically treated as `it` (3rd-person singular). Their surface form is whatever the consumer puts in the `pronoun` table; their verb conjugation slot follows the `it` rules.

## Render order summary

Per-locale render glue, locked here so per-locale implementations can be checked against the spec.

- **en declarative**: `[Capitalize] subject verb object [adverbialPrep adverbialNP] terminator`
- **en interrogative (yes/no)**: `Do/Does/Did subject verb object [adverbialPrep adverbialNP] terminator`
- **en interrogative (wh)**: `whWord do/does/did subject verb object [adverbialPrep adverbialNP] terminator`
- **en imperative**: `[Capitalize] verb object [adverbialPrep adverbialNP] terminator`
- **zh declarative**: `subject [adverbialPrep adverbialNP] verb object [particle] terminator`
- **zh interrogative (yes/no)**: `subject [adverbialPrep adverbialNP] verb object 吗 terminator`
- **zh interrogative (wh)**: `subject [adverbialPrep wh-positioned-NP] verb object terminator`  (wh-in-situ)
- **zh imperative**: `[adverbialPrep adverbialNP] verb object terminator`

Capitalization rule: applied to the first emitted token only, per mood:

- declarative: subject
- yes/no interrogative: the auxiliary (Do/Does/Did)
- wh interrogative: the wh-word
- imperative: the verb

Terminator default per mood:

- declarative → `.`
- interrogative → `?`
- wh-interrogative → `?`
- imperative → `.` (or `!` if explicitly passed)

## Examples (en + zh)

Cat example (the original spec):

```ts
t('en').sentence({ subject: 'I', verb: 'have', object: { adj: 1, noun: 'cat' } });
//   → "I have 1 cat."
t('zh').sentence({ subject: 'I', verb: 'have', object: { adj: 1, noun: 'cat' } });
//   → "我有 1 只猫。"
```

Zero-count (replaces syntactic negation):

```ts
t('en').sentence({ subject: 'you', verb: 'have', object: { adj: 0, noun: 'message' } });
//   → "You have 0 messages."
t('zh').sentence({ subject: 'you', verb: 'have', object: { adj: 0, noun: 'message' } });
//   → "你有 0 条消息。"
```

Yes/no question:

```ts
t('en').sentence({ mood: 'interrogative', subject: 'I', verb: 'have', object: { adj: 1, noun: 'cat' } });
//   → "Do I have 1 cat?"
t('zh').sentence({ mood: 'interrogative', subject: 'I', verb: 'have', object: { adj: 1, noun: 'cat' } });
//   → "我有 1 只猫吗?"
```

Tense (past / future):

```ts
t('en').sentence({ tense: 'past', subject: 'I', verb: 'have', object: { adj: 1, noun: 'cat' } });
//   → "I had 1 cat."
t('zh').sentence({ tense: 'past', subject: 'I', verb: 'have', object: { adj: 1, noun: 'cat' } });
//   → "我以前有 1 只猫。"

t('en').sentence({ tense: 'future', subject: 'I', verb: 'have', object: { adj: 1, noun: 'cat' } });
//   → "I will have 1 cat."
t('zh').sentence({ tense: 'future', subject: 'I', verb: 'have', object: { adj: 1, noun: 'cat' } });
//   → "我会有 1 只猫。"
```

Imperative:

```ts
t('en').sentence({ mood: 'imperative', verb: 'save' });             // "Save."
t('zh').sentence({ mood: 'imperative', verb: 'save' });             // "保存。"
```

Wh-question:

```ts
t('en').sentence({ mood: 'wh-interrogative', whWord: 'where', subject: 'I', verb: 'see', object: 'cat' });
//   → "Where do I see a cat?"
t('zh').sentence({ mood: 'wh-interrogative', whWord: 'where', subject: 'I', verb: 'see', object: 'cat' });
//   → "我在哪里看见猫?"
```

Embedded "want to":

```ts
t('en').sentence({
  mood: 'interrogative',
  subject: 'you',
  verb: 'want',
  complement: { verb: 'delete', object: 'item' },
});
//   → "Do you want to delete item?"
t('zh').sentence({
  mood: 'interrogative',
  subject: 'you',
  verb: 'want',
  complement: { verb: 'delete', object: 'item' },
});
//   → "你想删除物品吗?"
```

Possession (pronoun and literal name):

```ts
t('en').np({ possessor: 'I', noun: 'cat' });                        // "my cat"
t('zh').np({ possessor: 'I', noun: 'cat' });                        // "我的猫"
t('en').np({ possessorName: 'John', noun: 'cat' });                 // "John's cat"
t('zh').np({ possessorName: 'John', noun: 'cat' });                 // "John 的猫"
```

Time / location adverbial:

```ts
t('en').sentence({ subject: 'I', verb: 'wake_up', adverbial: { adj: 11, noun: "o'clock" } });
//   → "I wake up at 11 o'clock."
t('zh').sentence({ subject: 'I', verb: 'wake_up', adverbial: { adj: 11, noun: "o'clock" } });
//   → "我 11 点起床。"

t('en').sentence({ subject: 'I', verb: 'work', adverbial: 'office' });
//   → "I work at the office."
t('zh').sentence({ subject: 'I', verb: 'work', adverbial: 'office' });
//   → "我在办公室工作。"
```

Partial sentences (atomic units, for cases where a full sentence is not what the UI wants):

```ts
t('en').noun('cat');                                                // "cat"
t('zh').noun('cat');                                                // "猫"
t('en').np({ adj: 1, noun: 'cat' });                                // "1 cat"
t('zh').np({ adj: 1, noun: 'cat' });                                // "1 只猫"
t('en').vp({ verb: 'save', mood: 'imperative' });                   // "save"
t('zh').vp({ verb: 'save', mood: 'imperative' });                   // "保存"
```

Two-span composition for interpolation (caller concatenates):

```ts
`${t('en').noun('posted_at')} ${formatTime(time)}`;                  // "Posted at 3:45 PM"
`${t('zh').noun('posted_at')} ${formatTime(time)}`;                  // "发布于 3:45 PM"
```

## v1 scope

In scope:

- Static labels via partial-sentence primitives (`noun`, `np`, `vp`).
- Counted nouns with en plural + zh classifier (`{adj: number, noun: N}`).
- Yes/no questions (en Do-support + subject-verb inversion; zh `吗` particle).
- Wh-questions (en wh-fronting; zh wh-in-situ).
- Imperatives, neutral form (no 请 politeness particle in zh).
- Tense: past, present, future. en uses verb-form tables; zh uses aspect markers (`了`, `会`, defaults locked per-verb in the verb table).
- Possession via `Possessor<S>` tagged variant; literal names treated grammatically as `it`.
- Time / location adverbials via `adverbial` slot + per-noun `adverbialPrep` field.
- Embedded "want to X" via `complement` field, single nesting level only.
- Zero-count as the negation idiom: "No items selected" → `{verb: 'select', tense: 'past', object: {adj: 0, noun: 'item'}}` → "Selected 0 items" / "选择了 0 个物品".

Out of scope for v1:

- Syntactic negation (`polarity` field). Use zero-count instead.
- Articles in en (`a`, `an`, `the`). Examples ("Do you want to delete X?", "Do you want to delete 1 photo?") read fine without explicit article handling.
- Politeness particles (`请`, formal vs informal pronouns).
- Coordination (`X and Y`, `X or Y`). Caller uses `Intl.ListFormat` for list-shaped content.
- Subordinate clauses beyond the `complement` field's single-verb embedding.
- Adjective stacking on nouns (`adj` slot currently only holds a quantity number; word adjectives would need a separate field).
- Adverbs of manner (`quickly`, `always`).
- Number rendering localisation. v1 always emits Arabic digits — `1`, `11`, `0` — even in zh. CJK-character digits (`一`, `十一`, `零`) deliberately skipped to save LOC; not ungrammatical in zh, just less idiomatic.
- Time-reference formatting (`3 minutes ago`, `Yesterday`). Consumers use `Intl.RelativeTimeFormat` directly.
- Languages other than en + zh. Each new locale is a new `LocaleSpec`.
- Russian noun cases, Arabic dual number, Slavic plural categories beyond `Intl.PluralRules` defaults. Add to noun-entry shape only when an actual locale needs them.

## Locked implementation details

- **Package location**: `packages/module/i18n-compose/`.
- **Always digits**: noun-entry `pluralize` operates on the number value but the surface number is always rendered via plain JS `String(n)`. No locale-specific number rendering in v1.
- **One default surface per verb for past/future in zh**: e.g. `verb.have(_, _, 'past')` returns `'以前有'` (selected over `曾经有` / `有过`). Documented in the verb table; not per-call configurable in v1.
- **Capitalization**: applied to the first emitted token only, per mood (see "Render order summary"). The pronoun `I` is always uppercase regardless of position (the en pronoun table stores `surface: 'I'`).
- **Spacing rule** between Latin digits and Chinese characters: a single ASCII space (`"1 只猫"`), following W3C CJK typography guidance for legibility. Locked.
- **No template-with-holes primitive**: B-style messages (`"Posted at {time}"`) are caller-concatenated from lib-emitted partials and external values.
- **Possessor type**: tagged variants (`{possessor: S}` for pronouns, `{possessorName: string}` for literals). Single-field unions ruled out.

## Risks and mitigations

- **Scope creep**. The `module/test` pattern is "started as a few bugfixes, grew to Vitest parity over time." Same shape applies here: vocabulary tables grow, grammar constructs grow, and the lib starts to look like a small natural-language-generation engine.
  - Mitigation: every extension of `Sentence` / `LocaleSpec` / `VocabTables` shape requires a documented UI-message use case that needs it. No speculative additions.
  - Hard ceiling: if the lib's `src/` exceeds ~500 LOC excluding vocab tables and tests, re-evaluate against paraglide and accept migration cost.
- **Bus factor 1 (you)**. No external reviewers, no upstream maintenance.
  - Mitigation: fuzzing, property-based testing, mutation testing as already mandated for all packages in the workspace. Per AGENTS.md: "Everything must have fuzzing, property-based testing, environmental robustness, mutation testing setup."
  - Tests must include table-driven cases covering every render-order branch (mood × tense × presence/absence of adverbial × presence/absence of complement) for en and zh.
- **Onboarding friction**. Future contributors must learn the `Sentence`/`NounPhrase` shape rather than "we use paraglide."
  - Mitigation: `README.md` at the package root walks through the four named builders with the cat example, the zero-count example, and the embedded "want to" example.
- **Translation labor scaling to more locales**. en + zh today. Adding a third locale means a full new `LocaleSpec` plus translations of every vocab entry.
  - Mitigation: AI-assisted translation for bulk initial passes; native-speaker review per locale before merging. Out of scope until a third locale is actually requested.

## Migration plan for `ssg-test`

`ssg-test` currently has 10 zero-arg UI strings (`siteName`, `chooseALang`, `noResults`, etc.) wired through `typesafe-i18n`'s `LL()` accessor pattern with auto-generated `i18n-types.ts`, `i18n-util.ts`, etc.

Migration sequence (single PR, no behaviour change at user boundary):

1. Land `@monochromatic-dev/module-i18n-compose` (new package; no `ssg-test` changes yet).
2. In `ssg-test`, register the 10 UI strings in vocab tables (likely as nouns: `siteName`, `noResults`, etc. with `base` set to the locale-appropriate text).
3. Add `ssg-test`'s `LocaleSpec` per locale at `src/i18n/locales/{ca,en,zh}.ts`.
4. Replace `ll.siteName()` call sites with `t('en').noun('siteName')` (or equivalent). 10 mechanical edits.
5. Delete `src/i18n/{i18n-types.ts, i18n-util.ts, i18n-util.sync.ts, i18n-util.async.ts, formatters.ts}` (typesafe-i18n generator output) and the `typesafe-i18n` devDependency.
6. Remove the `typesafe-i18n --no-watch` step from `mise.toml`.

Acceptance: `mise run //packages/webapp-content/ssg-test:buildAndTest` green; visual diff on rendered HTML shows no string changes.

`paper2vn` is frozen and not migrated.

## Open items for the reviewer

Items intentionally left open for the friend reviewing this plan:

- The `Sentence` shape currently has eight optional fields and one required (`verb`). Is there a clearer factoring (e.g. discriminated union over `mood`, where each variant has its own required fields)?
- The `complement` field supports a single embedded verb only. Real UI rarely needs deeper, but `"Are you sure you want to delete X?"` is a common confirmation pattern (`be-sure (want-to (delete X))`). Should the spec extend complement to be recursively `Sentence`-shaped, or accept that `"Do you want to delete X?"` is the form we ship and leave the `Are you sure` framing to consumer-side composition?
- Wh-question rendering in zh is wh-in-situ. The current `whWord` field is sentence-level, but in zh the wh-word appears in the syntactic position of whatever it's replacing (subject, object, adverbial). Should `whWord` move into the slot it occupies (e.g. `object: { whWord: 'what' }` instead of a sentence-top-level `whWord`)?
- Verb conjugation in en currently uses a function per verb (`verb.have(ctx)`). For irregular verbs this is fine; for the dozens of regular verbs that just append `-s`/`-ed`, this duplicates logic. Worth a default-conjugation helper that regular-verb entries can opt into?
- Capitalization rule excludes the pronoun `I` (which stays uppercase regardless of position). Are there other tokens with similar capitalisation invariants we should document upfront (proper nouns from `possessorName`, days of week, months, language names)?

## Decision history (this brainstorm)

- Drop article handling. UI examples (`"Do you want to delete \"I love being a cat poem\""`, `"Do you want to delete 1 photo?"`) read fine without explicit article logic.
- Capitalize the first emitted token only, per mood.
- One default surface per zh verb for past/future. No per-call surface selection.
- Adverbial slot added; per-noun `adverbialPrep` carries the en preposition or zh `在`-prefix.
- Negation reframed as zero-count; `polarity` field dropped.
- Wh-questions in scope. Embedded "want to X" in scope (single nesting).
- Time references not in scope; consumers use `Intl.RelativeTimeFormat` directly.
- Imperatives without politeness markers.
- `K` (lists), `J` (time references) handled by `Intl.ListFormat` / `Intl.RelativeTimeFormat` outside this lib.

## Files this plan does NOT touch yet

No package skeleton created. No `packages/module/i18n-compose/` directory. No `ssg-test` changes. Plan-only.
