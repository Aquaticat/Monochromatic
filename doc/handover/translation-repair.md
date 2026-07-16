# Translation repair session handover

Status:
milestone one in progress.
Tasks 1 (scaffold), 2 (document core), and 3 (issue model and span validation) landed;
task 4 (Synthetic model client) is next.
Update this document at every task completion or design pivot;
it exists so auto-compaction cannot lose session state.

## Goal

`@monochromatic-dev/module-translation-repair`:
a pure fn taking (original zh text, translated en text)
and returning validated issues plus a conservative repaired candidate.
Built for individually unreliable flat-rate models;
no single model output is ever a decision point.

Everything starts as a pure fn (user requirement);
consumers and deployment are deliberately out of scope for now.

## Where work lives

- Worktree `.claude/worktrees/translation-repair`, branch `translation-repair`.
- Use `/usr/bin/git` for commits in this worktree for this session (user authorization):
  the policy shim fails because the `forbidden-strings` scanner is a gitignored Rust build artifact
  (`package/cli/forbidden-strings/target/release/`) absent from fresh worktrees.
- `.env.local.json` copied from main worktree;
  `TRANSLATION_REPAIR_SYNTHETIC_API_KEY` resolves through mise sops (verified by name, never print values).
- Commits on branch:
  `16864f509` scaffold,
  `70aaaf557` catalog remark/MDX parser stack,
  `da689f628` document model and segmentation core,
  `401aa7db8` this handover,
  `411931d21` issue model and deterministic anchor validation.
- Task list lives in the session task tool;
  mirror of current state is in "Task state" below.

## Settled architecture

Deterministic core plus model stages, revised after an adversarial second-model critique (pi, gpt-5.6-sol):

- Stages are pure `(state, responses) -> newState`;
  drivers are the impure shell (functional core, imperative shell).
  Batch driver = `repairTranslation`;
  interactive driver adds human steering as typed operations
  (approve/strike issue, correct alignment, lock wording, force verdict)
  applied to serialized checkpoints at stage boundaries.
  Mid-stage steering = abort in-flight calls (`AbortSignal` on every client call), edit checkpoint, rerun stage.
- Critic fan-out across vendor families;
  refusals handled reactively (schema failure or refusal-shaped valid output -> reroute to another family),
  never predicted or pre-annotated.
- Adjudication by a fixed provenance-blind panel with vote states
  (`supported`/`unsupported`/`ambiguous`/`source-defect`/`abstain`) and quorum.
  Never a variable electorate of non-proposers (selection defect: consensus shrinks the electorate).
- Canaries (planted errors) are calibration probes feeding routing and vote weights only;
  never hard gates; corroborated findings survive a proposer's canary miss.
- Issues keep atomic claims;
  clustering only proposes merges, an adjudicator disposes.
- Editors return patch operations against base hashes inside declared editable envelopes;
  never whole rewritten chunks.
  Deterministic guards check region change; a semantic adjudication call checks issue resolution
  (region changed does not mean issue resolved).
- The unchanged translation always competes in candidate selection;
  selection is lexicographic (integrity, high-severity resolution, no regressions, preservation)
  with pairwise preference only as tie-breaker;
  original returned with unresolved issues when nothing demonstrably beats it.
- Output contract: repaired candidate plus accepted, rejected, and unresolved issues plus completion status;
  never an unqualified "corrected translation".
- Issue states beyond MQM: `suspected-source-error` (blocks correction, preserves safer translation),
  `interpretive-ambiguity`, `alignment-error`, `footnote-conflict`, and a `policy` family
  (editing-guide violations such as suicide-method detail).
- Document dossier (facts only, no instructions): entities, recurring term renderings, quotations, footnote graph.
  Translation policy files are static, human-written, optional inputs;
  never generated per passage (content sensitivity does not correlate with document class).
- Verdicts are chunk-level with a document rollup (translation quality varies within one document).
- Scorecard harness gates everything:
  per-model per-role recall/precision/refusal/schema-compliance on seeded errors decides
  panel sizes, weights, and routing.
  Ensemble recall ceiling is the go/no-go number.

## Provider facts (verified from Synthetic docs and pricing)

- Per pack ($30/mo): 500 price-weighted requests per 5 hours, regenerating 5% per 15 minutes;
  $24/week credits regenerating 2% per ~3.4 hours;
  1 concurrent request per model, different models fully parallel.
  Up to 5 packs (user willing).
- Request cost scales by model price; `GLM-4.7-Flash` documented at ~0.1 units.
- `response_format` (JSON schema) supported at API level;
  per-model strictness unverified, so client-side validation and retry stays regardless.
- `/quotas` endpoint exists (response shape unverified); free embedding model does not count against quota.
- Models: GLM-5.2 (512k), GLM-4.7-Flash, Qwen3.6-27B, Kimi-K2.7-Code, MiniMax-M3,
  Nemotron-3-Super-120B, gpt-oss-120b; six vendor families.
- Orchestrator needs per-model semaphore(1) and price-aware role routing.

## Corpus facts (verified)

- Memorial corpus: `one-among-us/data`, `people/<id>/` entries with `info.yml`,
  `page.md` (zh source, YAML front matter, `##` section headings),
  `page.en.md` (translation under repair), `page.zh_hant.md` (script conversion, out of scope).
- The data repo is `UNLICENSED` (its `package.json`), explicitly all rights reserved:
  corpus content must never be committed to this repository.
  Fixture strategy: fetch selected entries at a pinned commit SHA into a gitignored cache (task 6).
- Pages are MDX: upstream `scripts/mdx.ts` compiles with `@mdx-js/mdx`
  (Vue pragma, `remarkMath` only, no `remark-gfm`).
  `[^1]` renders quasi-literally on the live site;
  emitted repairs must preserve the exact textual footnote convention byte-for-byte.
- `page.en.md` files are plausibly Google-Translate seeded
  (`google-translate-api-x` plus a `translate` script upstream) with uneven human editing.
- Some memorial texts carry footnotes (`[^1]`, definitions `[^1]:[text](url)` link-wrapped);
  the archive class (Lu Xun, later) uses plain-text `〔N〕` markers.
- Editing guides are the policy files:
  `one-among-us/about-site` `content/{zh-Hans,en}/docs/memorial.md`.
  Deterministically checkable rules: 「」/『』 quote conventions in zh, curly quotes in en.
  Hard content rules: soften suicide methods, never drug names or doses;
  third person; `ta`/`they` for unstated pronouns; archive links for external references.
- Real error seed bank from corpus inspection:
  fabricated year ("November 13th, 2023" where source has no year; timeline implies 2019),
  meaning inversion ("never taught anything about gender" vs 接触过...相关概念),
  load-bearing omission (father's 「就像你们女孩子总希望找到一个强壮的男朋友保护自己」),
  flattened irony (心灵干洗机 -> "spiritual baptism"),
  policy-violating addition ("her committing suicide" for 她的离开 in the lxy entry).
- Quoted misgendering is content to preserve (narration she/her, father's 「儿子」「他」 stays);
  terminology-consistency guards need quoted-speech exemptions.
- Archive texts contain transcription errors against canonical editions
  (缘愁似棍长 for 缘愁似个长, 春秋焚梁传 for 穀梁传, 一九三三月三月十五日):
  `suspected-source-error` must be able to block "corrections" toward corruption.

## Repo idioms and traps learned this session

- micromark emits `footnoteReference` nodes only when a matching definition exists;
  an undefined `[^n]` survives as literal text.
  `scanGfmReferenceLiterals` in `footnote-graph.ts` turns exactly those literals into
  unresolved-reference findings.
- `prefer-readonly-parameter-types`: mdast-typed parameters need
  `ForeignBorrowed<...>` (from `@monochromatic-dev/ownership-marker-foreign-borrowed/ts`)
  at the ownership boundary; never repeat the marker on descendants.
  Error constructors passing `cause` to `super` need an
  `@mutates cause - ...getter or proxy trap...` TSDoc line (idiom from `package/module/fs-id/src/errors.ts`).
- `unicorn/custom-error-definition` wants literal `this.name = 'ClassName';` strings.
- `no-restricted-syntax/no-nullish-union`: model absence with optional properties plus conditional spread
  (`exactOptionalPropertyTypes`), never `T | undefined`.
- `eslint/init-declarations`: no `let` plus try-assign; extract a throwing helper returning the value.
- `prefer-describe-function-ref-name`: `describe` name must be `fnUnderTest.name`.
- Test harness: `await describe({ name, children: [it({ name, fn, },),], },)`
  from `@monochromatic-dev/module-test/ts`;
  matchers include `toBe`, `toEqual`, `toStrictEqual`, `toContain`, `toHaveLength`, `toThrow`.
- mise task wrappers swallow findings into inherited stdio:
  capture full output to a scratchpad file and `rg` it; tails alone mislead.
- Run `pnpm install` after every `package.json` dependency edit (TS2307 otherwise).
- Fixtures must never contain real-person data or recognizable source content;
  cat-themed invention mirroring structure only (user corrected this twice; treat as hard rule).
- Parser deps all from the pnpm catalog: `unified`, `remark-parse`, `remark-mdx`, `remark-gfm`,
  `yaml`, `@types/mdast`.
  `remark-math` is not in the catalog; math survives as text nodes (accepted milestone-one gap).
- `no-mixed-operators` idioms: parenthesize comparisons under `&&`/`||`,
  `(typeof value) !== 'string'`, and `index === (-1)` for indexOf non-existence
  (`unicorn/consistent-existence-index-check` simultaneously demands `=== -1`).
- `chain-per-line`: chains of two or more member steps plus a call split one step per
  line (`claim` / `.spans` / `.map(...)`); extract consts for chained conditions.
- `typescript/no-unsafe-type-assertion` bans narrowing casts:
  replace with `find` over the closed list plus `nonNullishOrThrow`.
- `isolatedDeclarations`: exported consts need explicit type annotations;
  `as const satisfies ...` alone fails TS9010.

## Task state

1. Scaffold package: done.
2. Document model and segmentation core: done
   (`parse-document.ts`, `document-node.ts`, `footnote-graph.ts`, `footnote-model.ts`,
   `front-matter.ts`, `parse-mdx.ts`; 20 tests; zero lint findings).
3. Issue model and span/anchor validation: done
   (`issue-taxonomy.ts`: closed MQM-derived category union with `policy` and
   `extension` families, severities including `neutral`, runtime guards;
   `issue-model.ts`: `SpanAnchor` with side/nodeId/nodeHash/absolute offsets/exact
   quote, zero-width insertion anchors, atomic multi-span `IssueClaim`,
   deterministic `computeIssueClaimId` over canonical serialization;
   `validate-issue.ts`: rejection-as-data `validateIssueClaim` with kinds
   anchorless-issue, malformed-offset, inverted-span, unknown-node,
   stale-node-hash, span-outside-node, quote-mismatch;
   fail-fast per span, all spans reported independently;
   adversarial tests over parsed cat-themed fixtures).
   Claims carry no proposer provenance; the shell tracks that outside the claim.
4. Synthetic model client: next.
   Injected, typed via `@monochromatic-dev/module-llm-type/ts`;
   schema validation, refusal detection, per-model semaphore(1), price-weighted budget,
   `/quotas` polling, `AbortSignal` on every call.
5. Seeded-error benchmark harness and scorecard (exit criterion of milestone one).
6. Pinned-SHA corpus fixture fetching into gitignored cache.

## Deliberately open

- Output consumer (wiki PRs, files, UI): deferred until after the pure fn proves itself.
- User possesses the policy files; the system must function without them.
- Benchmark focuses on memorial texts first (user decision).
