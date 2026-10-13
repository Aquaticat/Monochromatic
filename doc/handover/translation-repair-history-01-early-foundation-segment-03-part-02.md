# Translation repair history: segment 3.2

Part of the [translation repair history index](translation-repair-history.md).

## Current stop condition

Historical evidence only.
Candidate M failed on 2026-09-01.
No historical next-action list authorizes a corpus run,
model call,
spent-prompt retry,
or successor implementation.

## Continued record

### Preserved chronological continuation

## Settled architecture

Deterministic core plus model stages,
revised after an adversarial second-model critique (pi,
gpt-5.6-sol):

- Stages are pure `(state, responses) -> newState`;
  drivers are the impure shell (functional core,
  imperative shell).
  Batch driver = `repairTranslation`;
  interactive driver adds human steering as typed operations
  (approve/strike issue,
  correct alignment,
  lock wording,
  force verdict)
  applied to serialized checkpoints at stage boundaries.
  Mid-stage steering = abort in-flight calls (`AbortSignal` on every client call),
  edit checkpoint,
  rerun stage.
- Critic fan-out across vendor families;
  refusals handled reactively (schema failure or refusal-shaped valid output -> reroute to another family),
  never predicted or pre-annotated.
- Adjudication by a fixed provenance-blind panel with vote states
  (`supported`/`unsupported`/`ambiguous`/`source-defect`/`abstain`) and quorum.
  Never a variable electorate of non-proposers (selection defect:
  consensus shrinks the electorate).
- Canaries (planted errors) are calibration probes feeding routing and vote weights only;
  never hard gates;
  corroborated findings survive a proposer's canary miss.
- Issues keep atomic claims;
  clustering only proposes merges,
  an adjudicator disposes.
- Editors return patch operations against base hashes inside declared editable envelopes;
  never whole rewritten chunks.
  Deterministic guards check region change;
  a semantic adjudication call checks issue resolution
  (region changed does not mean issue resolved).
- The unchanged translation always competes in candidate selection;
  selection is lexicographic (integrity,
  high-severity resolution,
  no regressions,
  preservation)
  with pairwise preference only as tie-breaker;
  original returned with unresolved issues when nothing demonstrably beats it.
- Output contract:
  repaired candidate plus accepted,
  rejected,
  and unresolved issues plus completion status;
  never an unqualified "corrected translation".
- Issue states beyond MQM:
  `suspected-source-error` (blocks correction,
  preserves safer translation),
  `interpretive-ambiguity`,
  `alignment-error`,
  `footnote-conflict`,
  and a `policy` family
  (editing-guide violations such as suicide-method detail).
- Document dossier (facts only,
  no instructions):
  entities,
  recurring term renderings,
  quotations,
  footnote graph.
  Translation policy files are static,
  human-written,
  optional inputs;
  never generated per passage (content sensitivity does not correlate with document class).
- Verdicts are chunk-level with a document rollup (translation quality varies within one document).
- Scorecard harness gates everything:
  per-model per-role recall/precision/refusal/schema-compliance on seeded errors decides
  panel sizes,
  weights,
  and routing.
  Ensemble recall ceiling is the go/no-go number.

## Provider facts (verified from Synthetic docs and pricing)

- Per pack ($30/mo):
  500 price-weighted requests per 5 hours,
  regenerating 5% per 15 minutes;
  $24/week credits regenerating 2% per ~3.4 hours;
  1 concurrent request per model per pack,
  different models fully parallel
  (same-model excess queues server-side,
  it does not error).
  The user bought 4 more packs on 2026-07-16,
  joining a founder's pack
  worth 1.5 normal packs;
  the live account now shows a 2750-request five-hour ceiling
  (5.5 pack-equivalents at 500 each).
- Never set reasoning effort on Synthetic calls (user directive 2026-07-16):
  non-default values sometimes error,
  sometimes produce low-quality or worse
  output.
  Default only;
  there is no safe latency knob there.
- Run five concurrent streams per model and absorb burst weather with
  retries,
  not gentle dispatch (user directive 2026-07-16).
  Implemented in
  `transient-retry.ts` (commit `eb32173bf`):
  four transport retries on an
  equal-jitter ladder (half fixed,
  half random,
  doubling from 1 s),
  retryable statuses 408/429/500/502/503/504,
  thrown transport failures
  (mid-stream connection resets) retried too,
  caller aborts always
  propagate untouched,
  and the policy is injectable
  (`retryPolicy: { limit, baseMs }`) so tests run on tiny backoffs.
- Refined directive (2026-07-16,
  after the first concurrency-5 run failed):
  probe/bench the fastest dispatch strategy for this plan and use that.
  `bench-dispatch.ts` in the session scratchpad sweeps per-model
  concurrency 1/2/3/5 over identical small-entry critic calls and reports
  ok-per-minute plus forfeits per level;
  the milestone run uses the winner.
- Bench verdict (2026-07-17):
  one stream per model wins by a factor of
  six.
  Level 1:
  7/7 ok,
  71 s wall,
  5.9 ok/min (median call 39 s).
  Levels 2/3/5:
  0.8/1.0/0.6 ok/min,
  with every vendor except zai-org
  stalling to a 5-minute cap while both GLMs completed (slowed 2-4x).
  Aggregate concurrency beyond one-per-model collapses throughput on
  this plan,
  at least during this window;
  pack count does not translate
  into usable same-model parallelism.
  Milestone runs use
  `perModelConcurrency: 1`.
  Full fact base for the provider report:
  `doc/troubleshooting/synthetic-aggregate-concurrency-stall.md`.
- Benchmarks are time-boxed (user directive 2026-07-17:
  about 30 minutes
  each,
  or they run too rarely to be useful;
  commit `275f7b6ab`).
  `runCriticBenchmark` takes `runBudgetMs`:
  models work entry queues
  sequentially,
  every attempt and retry is budget-gated,
  exchange
  deadlines cap to the remaining budget,
  and cut attempts record as
  `skipped`.
  The scorecard excludes skipped records from all rates and
  recall denominators and reports `coverage`;
  drivers use
  `runBudgetMs: 25 min` + `perCallTimeoutMs: 5 min` + a 45-minute outer
  signal as safety net only (an outer abort throws away every in-memory
  record),
  and shuffle their entry sample per run so repeated
  budget-bound runs accumulate coverage.
- Deadline placement is load-bearing (commit `7c0e41532`):
  the first
  concurrency-5 run armed every fan-out call's deadline at dispatch while
  the limiter ran five per model,
  so queued calls burned their whole budget
  waiting and 124 of 126 expired in one synchronized wall;
  the mass abort
  then crashed Node via an orphaned HTTP/2 stream error
  (`ERR_HTTP2_STREAM_ERROR`;
  Node 26 fetch speaks h2 to this origin).
  Deadlines now arm inside the client's per-model slot
  (`exchangeTimeoutMs` on `ChatTextRequest`,
  `call-deadline.ts`),
  so only
  the exchange counts.
  Drivers keep a scoped `uncaughtException` guard
  that swallows only `ERR_HTTP2_STREAM_ERROR`.
- 35-stream probe (5 per model,
  tiny prompts):
  the dispatch burst drew 27
  instant 502s that the transport retries fully absorbed,
  but service
  under 35 streams is heavily stalled:
  one-character answers took
  78 to 119 s and 14 of 35 calls missed a 120 s cap.
  Aggregate stream
  count,
  not just per-model entitlement,
  governs real throughput.
- Never set temperature either (user directive 2026-07-16):
  per the user,
  this is less a Synthetic API issue and more their upstream GPU providers
  plus inference pipelines plus the models' inherent issues;
  either way the
  knob is not honored reliably.
  It was removed from `ChatTextRequest`
  entirely so nothing can set it;
  a unit test asserts the wire body carries
  no `temperature` key.
  All calls run on defaults,
  which also means past
  temperature-0 runs never had the determinism the setting promised
  (consistent with the observed completion-vs-ceiling flips on identical
  input).
- Live probe results (2026-07-16,
  after run 4):
  three concurrent tiny GLM-4.7-Flash calls all completed in 2.0 to 2.4 s,
  fully overlapped (no server-side serialization of dispatched requests);
  a real critic call on the smallest entry (DarlinChit,
  1.4 KB translation)
  completed in 28.6 s on GLM-5.2 (6_621 completion tokens,
  9 issues) and in
  35.4 s on gpt-oss-120b (2_246 tokens,
  6 issues).
  Contrast run 4:
  an 8 KB translation drove GLM-5.2 to the 65_536-token
  output ceiling without finishing its JSON,
  and every other call starved
  behind long-running ones.
  Work-unit conclusion:
  critic calls must stay near DarlinChit scale
  (roughly 1 to 4 KB of translation);
  document chunking is mandatory for
  the full pipeline.
- Request weight = model input price / baseline input price (baseline is the provider
  default model,
  currently GLM-5.2 at exactly 1).
  Verified empirically:
  one GLM-4.7-Flash call deducted exactly 0.0714 (1/14) from
  `/quotas` remaining,
  matching `estimateRequestWeight` in `synthetic-catalog.ts`.
- `GET /openai/v1/models` carries per-model pricing,
  context length,
  max output
  (65536 for all),
  and feature flags;
  every catalog model advertises `json_mode` and
  `structured_outputs`.
  Per-model strictness still unverified,
  so client-side validation stays.
- `GET https://api.synthetic.new/v2/quotas` (free,
  does not count against limits);
  live shape verified 2026-07-16:
  `rollingFiveHourLimit {remaining,max,limited,nextTickAt,tickPercent}`,
  `weeklyTokenLimit {percentRemaining,maxCredits,remainingCredits,nextRegenAt,...}`,
  plus `subscription`,
  `search`,
  `freeToolCalls` (unmodeled).
- Models:
  GLM-5.2 (512k),
  GLM-4.7-Flash,
  Qwen3.6-27B,
  Kimi-K2.7-Code,
  MiniMax-M3,
  Nemotron-3-Super-120B,
  gpt-oss-120b;
  six vendor families.
- Chat base URL `https://api.synthetic.new/openai/v1`.
- The client (task 4) provides a per-model `p-limit` semaphore sized by
  `perModelConcurrency` (default 1;
  pass the pack count);
  price-aware role routing belongs to the orchestrator.
- End-to-end boundary check passed:
  real GLM-4.7-Flash `chatJson` round trip returned
  guard-validated JSON and the quota delta matched the estimate.
- Chat calls must stream (user directive:
  the provider is finicky without streaming;
  and the first real benchmark died on fetch's five-minute headers timeout while a
  model was thinking).
  The client always sends `stream: true` with `stream_options.include_usage`;
  the transport drains the whole SSE body to text and `stream-completion.ts`
  reassembles it,
  requiring the `[DONE]` terminator (cut-off streams throw instead
  of returning truncated content) and folding `delta.refusal` into the first-class
  refusal field.
  Do not add an undici dependency for timeout control (user directive);
  streaming makes plain platform fetch sufficient.
- These models think heavily:
  expect 90%+ of output tokens to be thinking tokens
  (user guidance;
  live probe confirmed 35 completion tokens for a 1-token answer).
  Consequences already built into the client:
  reasoning arrives in separate `reasoning`/`reasoning_content` message fields with
  clean `content` (verified live on GLM-4.7-Flash);
  the message carries a first-class `refusal` field which outranks heuristics
  (marker `api-refusal-field`);
  embedded `<think>` blocks are split off before parsing and refusal scanning;
  truncation inside thinking is a distinct schema-mismatch detail;
  `maxTokens` must be generous or omitted;
  budget spend estimates must use thinking-inflated completion counts
  (usage is carried on every `chatJson` outcome for the scorecard).

## Corpus facts (verified)

- Memorial corpus:
  `one-among-us/data`,
  `people/<id>/` entries with `info.yml`,
  `page.md` (zh source,
  YAML front matter,
  `##` section headings),
  `page.en.md` (translation under repair),
  `page.zh_hant.md` (script conversion,
  out of scope).
- The data repo is `UNLICENSED` (its `package.json`),
  explicitly all rights reserved:
  corpus content must never be committed to this repository.
- Fixture strategy (task 6,
  done):
  the user cloned the repo to `~/one-among-us/data`;
  `corpus-source.ts` reads it via `git show` at pinned `CORPUS_COMMIT_SHA`
  (`a41fc607ea5a70d8a7625cc67d5ed8c444f53379`,
  upstream `main` on 2026-07-16;
  92 zh/en page pairs,
  footnoted entries include Huasheng and DarlinChit).
  Blob reads use byte-exact `execFile` capture (nano-spawn strips the final newline);
  git resolves through `resolveGit` from `@monochromatic-dev/git-policy-cli/ts`
  (newly exported),
  because PATH exposes the policy shim
  (`node_modules/.bin/git` rejects bulk staging even in throwaway repos).
  Boundary-verified against the real clone:
  listing plus two entries parsed
  cleanly through `parseDocument` with resolved footnote graphs.
- Pages are MDX:
  upstream `scripts/mdx.ts` compiles with `@mdx-js/mdx`
  (Vue pragma,
  `remarkMath` only,
  no `remark-gfm`).
  `[^1]` renders quasi-literally on the live site;
  emitted repairs must preserve the exact textual footnote convention byte-for-byte.
- NOT every entry parses as MDX:
  of twelve sampled zh/en pairs,
  four failed
  `parseDocument` (`interrgned`,
  `windward0032`,
  `XingZ60`,
  `mikaela_khara`),
  at least one on an HTML comment (`<!--`,
  illegal in MDX) at body start.
  Open question how upstream renders those;
  the pipeline needs a skip-or-
  preprocess decision before corpus-wide runs.
  Parse-clean large pairs besides Huasheng/DarlinChit:
  `shihai4h`,
  `aiyysk`,
  `hulicaijia`,
  `NIGHT81473140`,
  `Xu_Yushu`,
  `zhangyubaka`.
- Deletion seeds can break the seeded MDX parse when the deleted sentence
  holds half of a paired construct (seen live:
  acorn "Unterminated string
  constant" after a seed removed the closing half of an `{'...'}` expression).
  `deriveOmissionSeeds` therefore skips delimiter-bearing sentences
  (commit `735e1b34e`),
  and the driver preflights `parseDocument` over the
  seeded text before spending quota.
- `page.en.md` files are plausibly Google-Translate seeded
  (`google-translate-api-x` plus a `translate` script upstream) with uneven human editing.
- Some memorial texts carry footnotes (`[^1]`,
  definitions `[^1]:[text](url)` link-wrapped);
  the archive class (Lu Xun,
  later) uses plain-text `〔N〕` markers.
- Editing guides are the policy files:
  `one-among-us/about-site` `content/{zh-Hans,en}/docs/memorial.md`.
  Deterministically checkable rules:
  「」/『』 quote conventions in zh,
  curly quotes in en.
  Hard content rules:
  soften suicide methods,
  never drug names or doses;
  third person;
  `ta`/`they` for unstated pronouns;
  archive links for external references.
- Real error seed bank from corpus inspection:
  fabricated year ("November 13th,
  2023" where source has no year;
  timeline implies 2019),
  meaning inversion ("never taught anything about gender" vs 接触过...相关概念),
  load-bearing omission (father's 「就像你们女孩子总希望找到一个强壮的男朋友保护自己」),
  flattened irony (心灵干洗机 -> "spiritual baptism"),
  policy-violating addition ("her committing suicide" for 她的离开 in the lxy entry).
- Quoted misgendering is content to preserve (narration she/her,
  father's 「儿子」「他」 stays);
  terminology-consistency guards need quoted-speech exemptions.
- Archive texts contain transcription errors against canonical editions
  (缘愁似棍长 for 缘愁似个长,
  春秋焚梁传 for 穀梁传,
  一九三三月三月十五日):
  `suspected-source-error` must be able to block "corrections" toward corruption.

## Repo idioms and traps learned this session

- micromark emits `footnoteReference` nodes only when a matching definition exists;
  an undefined `[^n]` survives as literal text.
  `scanGfmReferenceLiterals` in `footnote-graph.ts` turns exactly those literals into
  unresolved-reference findings.
- `prefer-readonly-parameter-types`:
  mdast-typed parameters need
  `ForeignBorrowed<...>` (from `@monochromatic-dev/ownership-marker-foreign-borrowed/ts`)
  at the ownership boundary;
  never repeat the marker on descendants.
  Error constructors passing `cause` to `super` need an
  `@mutates cause - ...getter or proxy trap...` TSDoc line (idiom from `package/module/fs-id/src/errors.ts`).
- `unicorn/custom-error-definition` wants literal `this.name = 'ClassName';` strings.
- `no-restricted-syntax/no-nullish-union`:
  model absence with optional properties plus conditional spread
  (`exactOptionalPropertyTypes`),
  never `T | undefined`.
- `eslint/init-declarations`:
  no `let` plus try-assign;
  extract a throwing helper returning the value.
- `prefer-describe-function-ref-name`:
  `describe` name must be `fnUnderTest.name`.
- Test harness:
  `await describe({ name, children: [it({ name, fn, },),], },)`
  from `@monochromatic-dev/module-test/ts`;
  matchers include `toBe`,
  `toEqual`,
  `toStrictEqual`,
  `toContain`,
  `toHaveLength`,
  `toThrow`.
- mise task wrappers swallow findings into inherited stdio:
  capture full output to a scratchpad file and `rg` it;
  tails alone mislead.
- **Ghostty windows cannot be launched while the screen is locked**,
  which is
  most of the time an overnight session runs.
  `ghostty -e <command>` starts a
  live process that never spawns the command:
  the pty child is created on the
  first GLArea resize,
  and a locked compositor never maps the window.
  There is
  no error anywhere.
  Full diagnosis,
  the positive control that found it,
  and the
  source citations:
  `doc/troubleshooting/ghostty-locked-session-no-command.md`.
  So an interactive sol review in a visible window is something to launch while
  the user is AWAKE;
  overnight,
  run `pi --print` into a file and read the file.
- **A background command's exit code reports its LAST stage,
  not the task's.**
  A verification pipeline ending in `... | rg 'FAIL' || echo 'no failures'`
  exits 0 whether the suite passed or the lint failed,
  because `rg` finding
  nothing and `echo` succeeding are what the shell reports.
  Measured rather than suspected:
  commit `e7f635e0d` was made on exactly that
  reading and carried THREE type errors
  (`artifact-build.ts` reading two fields its own parameter type did not
  declare,
  and a benchmark test stub missing them),
  found the next morning by
  opening the captured output instead of the notification.
  Read the captured file for the `Found N warnings and N errors` line and the
  suite's own FAIL count;
  never accept the wrapper's exit code as the verdict.
- **`test:unit` alone tests the PREVIOUS BUILD,
  and `lint:types` reads it too.**
  Every `*.unit.test.ts` here imports `../dist/final/node/index.mjs`,
  the built
  bundle,
  not the source beside it.
  `lint:types` DOES check the test files;
  it checks them against the DECLARATIONS OF THAT SAME STALE BUNDLE,
  which is
  the trap rather than an exemption.
  (An earlier version of this note said the type-check skipped test files
  entirely.
  It does not.
  Later evidence:
  adding an export and running
  `lint:types` before rebuilding reported
  `Module "../dist/final/node/index.mjs" has no exported member`,
  from a test
  file.
  The practical rule is unchanged;
  where you look when a test disagrees
  with the source in front of you is not.)
  So a green `test:unit` straight after a source edit is evidence about the
  build from before that edit,
  and a test calling a function without a newly required argument passes both
  tasks until the bundle is rebuilt.
  Always use `mise run //package/module/translation-repair:buildAndTest`.
  Measured rather than suspected:
  two green `test:unit` runs were collected in the 2026-08-09 session before
  this was noticed,
  and neither had executed a line of the new code;
  the first `buildAndTest` after it failed immediately on a real assertion.
- Run `pnpm install` after every `package.json` dependency edit (TS2307 otherwise).
- Fixtures must never contain real-person data or recognizable source content;
  cat-themed invention mirroring structure only (user corrected this twice;
  treat as hard rule).
- Parser deps all from the pnpm catalog:
  `unified`,
  `remark-parse`,
  `remark-mdx`,
  `remark-gfm`,
  `yaml`,
  `@types/mdast`.
  `remark-math` is not in the catalog;
  math survives as text nodes (accepted milestone-one gap).
- `no-mixed-operators` idioms:
  parenthesize comparisons under `&&`/`||`,
  `(typeof value) !== 'string'`,
  and `index === (-1)` for indexOf non-existence
  (`unicorn/consistent-existence-index-check` simultaneously demands `=== -1`).
- `chain-per-line`:
  chains of two or more member steps plus a call split one step per
  line (`claim` / `.spans` / `.map(...)`);
  extract consts for chained conditions.
- `typescript/no-unsafe-type-assertion` bans narrowing casts:
  replace with `find` over the closed list plus `nonNullishOrThrow`.
- `isolatedDeclarations`:
  exported consts need explicit type annotations;
  `as const satisfies ...` alone fails TS9010.

## Task state

1. Scaffold package:
   done.
2. Document model and segmentation core:
   done
   (`parse-document.ts`,
   `document-node.ts`,
   `footnote-graph.ts`,
   `footnote-model.ts`,
   `front-matter.ts`,
   `parse-mdx.ts`;
   20 tests;
   zero lint findings).
3. Issue model and span/anchor validation:
   done
   (`issue-taxonomy.ts`:
   closed MQM-derived category union with `policy` and
   `extension` families,
   severities including `neutral`,
   runtime guards;
   `issue-model.ts`:
   `SpanAnchor` with side/nodeId/nodeHash/absolute offsets/exact
   quote,
   zero-width insertion anchors,
   atomic multi-span `IssueClaim`,
   deterministic `computeIssueClaimId` over canonical serialization;
   `validate-issue.ts`:
   rejection-as-data `validateIssueClaim` with kinds
   anchorless-issue,
   malformed-offset,
   inverted-span,
   unknown-node,
   stale-node-hash,
   span-outside-node,
   quote-mismatch;
   fail-fast per span,
   all spans reported independently;
   adversarial tests over parsed cat-themed fixtures).
   Claims carry no proposer provenance;
   the shell tracks that outside the claim.
4. Synthetic model client:
   done
   (`synthetic-catalog.ts` verified catalog and request-weight estimator;
   `synthetic-transport.ts` injectable transport seam,
   fetch receives only
   locally owned values plus a dependent signal;
   `synthetic-quota.ts` typed `/v2/quotas` snapshots;
   `completion-shape.ts` protocol parsing with first-class `refusal` field;
   `refusal.ts` deterministic opening-window marker scan;
   `chat-contract.ts` request/outcome types;
   `model-content.ts` fence and think-block handling,
   tolerant JSON parse;
   `synthetic-client.ts` `createSyntheticClient` with per-model `p-limit(1)`,
   mandatory `AbortSignal`,
   outcome-as-data `chatJson`;
   boundary-verified against the live API twice).
5. Seeded-error benchmark harness and scorecard (exit criterion of milestone one):
   code landed (`4cd25ae95`),
   first real run in progress.
   `seeded-error.ts` (deterministic planting,
   region tracking,
   hit tolerance 30),
   `derive-seeds.ts` (runtime omission derivation from longest unique sentences,
   min 40 chars,
   so no UNLICENSED content is committed),
   `critic-wire.ts` (quote-based wire format,
   `CRITIC_RESPONSE_FORMAT` JSON schema,
   quote-to-anchor resolution failing closed on absent/ambiguous/cross-block
   quotes,
   final `validateIssueClaim` gate),
   `critic-prompt.ts` (strict system prompt with closed vocabularies),
   `scorecard.ts` (pure aggregation;
   per-model schema-ok,
   refusal,
   effective
   seeded recall;
   `ensembleRecall` over the entry+seed universe is the go/no-go
   number;
   precision is deliberately not graded against seeded truth because the
   MT-seeded corpus carries genuine errors),
   `benchmark.ts` (`runCriticBenchmark`:
   entries and models parallel,
   HTTP failures as attempt data,
   aborts propagate,
   and one
   fresh-deadline second attempt per transient-shaped failure via
   `attempt-retry.ts`).
   First real run:
   entries Huasheng and DarlinChit,
   2 derived omission seeds each,
   all 7 models;
   driver script `run-benchmark.ts` in the session scratchpad;
   results land in `benchmark-result.json` there and must be copied into this doc.
6. Pinned-SHA corpus reads from the user's local clone:
   done (`corpus-source.ts`;
   see corpus facts).
7. Section chunking with total automatic alignment:
   done
   (`chunk-document.ts`,
   commit `2f9b2c8af`).
8. Tolerant parsing:
   done (commit `5762f4748`).
9. Xu_Yushu polish loop:
   done (see status narrative).
10. Truncation-shaped retry:
    done (`attempt-retry.ts`).
11. Claim aggregation into merge-proposal clusters:
    done
    (`aggregate-claims.ts`,
    commit `8818f27fd`:
    dedupe by
    `computeIssueClaimId`,
    transitive same-family span-overlap clustering
    via work-stack walk,
    zero-width anchors expand by
    `CLUSTER_ANCHOR_TOLERANCE` 30,
    deterministic cluster ids over sorted
    member ids,
    clusters in document order;
    nine unit tests,
    lint 0/0.
    `format:oxlint` is the auto-fixer for the vertical stylistic rules;
    run it instead of hand-splitting arguments).
12. Adjudication panel with vote states and quorum:
    blocked by 11.
13. Patch-operation model,
    envelopes,
    deterministic apply:
    parallel-ready.
14. Editor stage (patch-op wire):
    blocked by 12 and 13.
15. Resolution check,
    no-regression gate,
    candidate selection:
    blocked by 14.
16. `repairTranslation` end-to-end:
    blocked by 15.
17. Milestone-two benchmark (seeded repair rate):
    blocked by 16.

## Deliberately open

- Output consumer (wiki PRs,
  files,
  UI):
  deferred until after the pure fn proves itself.
- User possesses the policy files;
  the system must function without them.
- Benchmark focuses on memorial texts first (user decision).
- Unrelated text pairs (user probe:
  zh cat story vs "Meow meow meow"):
  `accuracy/non-translation` is in the taxonomy (commit `d4dabc283`) and
  the critic prompt reports one critical instance for wholly unrelated
  pairs.
  Verified live on the invented pair:
  GLM-5.2,
  gpt-oss-120b,
  and
  Qwen3.6-27B each emitted exactly one accuracy/non-translation/critical
  issue.
  Qwen's failed to ANCHOR (degenerate repetitive gibberish makes
  every short quote ambiguous),
  so the future rollup must treat
  non-translation as a document-level verdict where wire-level ensemble
  agreement suffices and anchoring is best-effort;
  ensemble-agreed
  critical non-translation blocks repair and returns the input unchanged.
- Model-driven input fixing (user:
  parse phase may "optionally" use LLMs to
  fix source and translations before continuing):
  deferred by evidence,
  not
  rejected.
  Deterministic tolerance (comment masking + markdown fallback)
  covers every document in the pinned corpus with zero fallbacks needed;
  `RepairDocument.parseFindings` is the designed trigger seam.
  Build the
  LLM fixer only when a corpus commit produces a document whose findings
  show real damage (an `mdx-downgraded` finding is the signal to watch),
  and gate any fixed text on a strict re-parse plus a content-preservation
  check before it replaces the input.
- Document chunking (zh-to-en aligned sections) LANDED
  (commit `2f9b2c8af`:
  `chunk-document.ts`,
  `alignDocumentSections`
  pairing mirrored structures by index,
  degrading to proportional
  monotone merging with findings,
  never refusing).
  Motivation stands:
  run 4 proved whole large documents exceed the 65_536-token output
  ceiling on thinking models,
  and small units complete in ~30 s.
- Band FILTERING in `corpus-pass.ts` (skip bands already at the ~10 quota so no
  run spends ~75 min settling a band that is already full):
  REJECTED as
  redundant,
  not as wrong in intent.
  `rankWithinBands` already offsets each
  band's rank by `countSettledPerBand`,
  so a band that is ahead is
  automatically deprioritized by exactly its lead.
  Verified against live
  counts at 7 small / 8 medium / 7 large:
  medium's first pending entry ranks 8
  while small's and large's rank 7,
  so medium cannot be started until the other
  two catch up.
  Confirmed in flight rather than only on paper,
  since run 017
  picked MTF_0615 (5229 B,
  LARGE),
  a band that is behind.
  Adding a filter on
  top would be a second mechanism for one invariant and a place for the two to
  disagree.
  The one path that DOES bypass the offset is resume-first,
  which is
  intended:
  finishing a cached large document beats starting a fresh anything.
- Grading sheet CLOBBER HAZARD found and fixed (2026-07-27,
  commit
  `e26d13ff5`),
  before it fired.
  `draw-sample.ts` wrote the gate sheet to a
  fixed `grading-sheet.md`,
  which is the same file the user graded round one in,
  IN PLACE.
  24 of those 50 items carry free-text rationale
  (`rg --count-matches '^### \d+\. grade: [YN]\S'`),
  and `gate-verdict.md`
  preserves only the Y/N tally,
  not the reasoning that drove fixes A-F.
  So
  drawing round two would have destroyed the evidence base for round one's
  conclusions,
  through a routine command,
  with no prompt.
  Round one's graded sheet is archived at
  `node_modules/.monochromatic/translation-repair-runs/grading-sheet-round-one-graded.md`.
  Still OUTSIDE git and still never committable:
  it quotes UNLICENSED corpus.
  The fix is two independent defenses in `corpus-run/sheet-path.ts`,
  because
  either alone still loses data.
  Sheets are named after the draw seed
  (`grading-sheet-<seed>.md`),
  so two rounds cannot target one path;
  and a
  `--final` draw throws `GradedSheetExistsError` when its target exists,
  so a
  repeated draw inside ONE round cannot clobber grading already done.
  Preliminary sheets are deliberately exempt and stay redrawable as the pool
  grows.
  Round two therefore writes
  `grading-sheet-milestone-three-precision-round-two.md` and can never reach
  round one's file.
  Verified at the CLI boundary on a throwaway runs dir,
  not by reading the code:
  first `--final` draw writes,
  second refuses with the sheet intact,
  two
  preliminary draws both succeed.
  GENERAL LESSON,
  worth applying past this one file:
  an output path that is a
  CONSTANT is a hazard whenever a human writes into the artifact,
  because the
  file silently changes owner from the program to the person.
  Look for the same
  shape anywhere else a runner writes a fixed name a human then edits.
- RUNS DIR SITS INSIDE THE `rm -rf` BLAST RADIUS (found 2026-07-27,
  mitigated,
  root cause still open).
  `resolveRunsDir` defaults under
  `node_modules/.monochromatic/translation-repair-runs/`,
  and the repo ships
  `//:fix:reinstall`,
  whose body is literally
  `rmSync('node_modules', { recursive: true, force: true })` followed by
  `pnpm install`.
  One invocation of a task described only as "Clean reinstall to
  work around registry or resolution issues" destroys round one's graded sheet
  and its free-text rationale,
  `gate-verdict.md`,
  every settled artifact,
  the
  attempts map,
  and the slice cache.
  "Outside git" was the actual requirement;
  "inside node_modules" was never implied by it.
  MITIGATION IN PLACE:
  the whole runs dir (12 MB) is copied to
  `${HOME}/.local/share/monochromatic/translation-repair-runs-backup`,
  mode 700,
  outside the repo entirely.
  Refresh it after any batch of entries settles.
  It
  quotes UNLICENSED corpus,
  so it is never committable,
  wherever it lives.
  ROOT CAUSE DELIBERATELY NOT FIXED YET:
  changing the `resolveRunsDir` default
  mid-accumulation would point the next launch at an empty directory,
  which
  reads as zero settled entries and silently re-runs the entire corpus.
  Relocate
  only between runs,
  by moving the directory AND setting
  `TRANSLATION_REPAIR_RUNS_DIR` together,
  never by editing the default alone.
- `--final` IS NOW ONE-SHOT by design,
  so do not fire it early.
  The first
  `--final` draw freezes round two's sheet,
  and a later draw refuses even if
  more entries have settled since.
  Use the preliminary path for every validation
  draw and run `--final` exactly once,
  after accumulation is done.
  When the
  refusal appears,
  the correct response is to rename the existing sheet
  deliberately,
  never to reach for a force-shaped workaround:
  the refusal is the
  feature.
- COHORT-SPLIT PROMISE RETRACTED (2026-07-27,
  `run-config.ts`).
  The stamp's
  docblock claimed precision could be split by call-timing cohort at analysis
  time,
  making the mixed pool "a number rather than an unknown".
  It cannot.
  At
  the coverage bar the pool is about 30 entries split near evenly,
  so 50 graded
  items give roughly 25 per cohort and a standard error near 8 points;
  the
  binding constraint is human grading effort,
  not compute,
  so the several
  hundred per cohort that would resolve a meaningful difference is unavailable.
  Report the mixed pool QUALITATIVELY alongside the panel-coverage sub-rates.
  Note this weakens the stated basis of the user's twice-made "keep the settled
  entries" decision,
  so it is surfaced rather than quietly adjusted;
  it does not
  change what to do,
  since discarding the compute was rejected both times.
- UNGRADED OBSERVATION,
  first quantitative sign fixes A-F changed behavior at
  all:
  accepted issues per entry fell from 99 (round one,
  2871 over 29 entries)
  to 75 (round two,
  1731 over 23),
  a 24 percent drop,
  in the direction the fixes
  intended.
  NOT EVIDENCE OF PRECISION and must not be recorded as such:
  nothing
  here is graded,
  fewer accepted issues is equally consistent with the fixes
  suppressing true positives,
  and the two pools cover different entries.
  It
  earns a mention only because it is measurable now and the graded answer is not.
- HEADLINE PRECISION IS BAND-BALANCED,
  NOT POOL-WEIGHTED (found 2026-07-27,
  before the round-two draw).
  `drawStratifiedSample` splits the 50 slots about
  evenly across bands (round one drew 17 small / 17 medium / 16 large),
  but the
  bands do NOT hold even shares of the accepted-issue pool.
  Measured at 25
  settled entries:
  small 175 accepted (9.2 percent),
  medium 667 (34.9),
  large
  1070 (56.0).
  So a small-band issue is roughly 3.6 times likelier to be sampled
  than its share of the population,
  and the raw sample proportion estimates the
  AVERAGE OF PER-BAND PRECISIONS rather than the precision of the accepted-issue
  population.
  Size of the discrepancy,
  using round one's per-band precisions (small 0.60,
  medium 0.57,
  large 0.73) against round two's pool shares:
  band-balanced 0.635,
  pool-weighted 0.665.
  Round one failed at 0.56 to 0.68 under every reading,
  so
  the distinction could not change that verdict.
  Against a 0.9 bar it can.
  RESOLUTION,
  adopted because it costs nothing and sacrifices nothing:
  report
  BOTH numbers from the SAME 50 grades.
  Band-balanced stays the headline,
  since
  that is what round one reported and comparability with the baseline is the
  whole point of round two.
  Pool-weighted is reported beside it,
  because "accepted-issue
  precision" read plainly means "of the issues the pipeline accepts,
  how many
  are real",
  which is the pool-weighted quantity.
  No extra grading is needed:
  per-band counts plus pool shares give both.
  The only genuine decision is which number faces the bar IF they straddle 0.9,
  and that is the user's call.
  Do not pre-empt it;
  if both clear or both fail,
  it never needs asking.
  Related caution:
  round one's verdict called precision "roughly flat across
  bands" on 0.60 / 0.57 / 0.73.
  At 15 graded items per band the standard error
  is about 0.12,
  so those are not distinguishable,
  but "flat" overstates what
  n=15 per band can show.
  The band comparison is underpowered in the same way
  the timing-cohort split is;
  say "not distinguishable",
  never "flat".
- DETACHED LAUNCH CONFIRMED AS THE FIX for the run kills (2026-07-27).
  Run 017,
  launched with `setsid nohup mise run ... > log 2>&1 < /dev/null & disown`,
  ran
  4.79 hours and exited NORMALLY on its own soft budget
  (`DONE processed=4 of pending=71; artifacts=25/92 elapsed=17247028ms`).
  The two
  runs before it,
  launched as harness background tasks,
  were killed by signal at
  2h38m and about 2 minutes with the signature
  `sh exited with non-zero status: no exit status` and no OOM evidence.
  A run
  that survives 4.79 hours in its own session,
  after two died in the harness
  session at unrelated ages,
  is what the process-group explanation predicts.
  Keep launching this way;
  do NOT chain a launch with a commit in one call,
  which is what made an earlier kill look like a failed commit task.
- NIGHT81473140 (12301 B,
  LARGE,
  the biggest entry attempted so far) hit the
  90 min per-entry hard cap in run 017 with 26 slices cached,
  so it did not
  settle.
  Recoverable exactly as Dethelly and Futajuhuacha were:
  resume-first
  ordering picks it up next run and slice progress is monotone.
  It needs ONE further run,
  not several,
  and that is measured rather than
  inferred from its size.
  Run 017 logged the entry as `10 chunk pairs, 41
  slices`,
  and it finished 26 of those 41 from a COLD start inside the 90 min
  cap,
  so 3.46 min/slice.
  The 15 remaining come to about 52 minutes,
  well inside
  one cap.
  General lesson:
  the pipeline prints its slice count when an entry
  starts,
  so "how many more runs does this need" is a log lookup and a division,
  never a guess from byte size.
  An earlier draft of this note guessed from the
  12 KB figure and got it wrong.
- BAND ORDERING IS COMPUTED ONCE PER RUN,
  so a long run can overshoot a band.
  `rankWithinBands` and `resumableIds` are both evaluated at run START and the
  `pending` array is sorted once;
  nothing re-ranks as entries settle DURING the
  run.
  Observed in run 018,
  which started at 8 small / 9 medium / 8 large and
  settled five entries:
  by the time it picked MocaKawai (medium),
  the live
  counts were 10 / 10 / 9 and a large entry should have led,
  but the frozen
  ordering still had medium ahead.
  Result was 10 / 11 / 9 instead of 10 / 10
  / 10.
  Same cause,
  second symptom:
  an entry that a run leaves partly cached does NOT
  resume later in that SAME run,
  because `resumableIds` predates its cache
  directory.
  Susiethegamer aborted at the hard cap with 12 of 17 slices,
  and run
  018 went on to other entries rather than returning to it.
  NOT WORTH FIXING for this milestone,
  and the reason is not laziness:
  the
  ordering self-corrects on the next launch,
  both symptoms cost at most one
  entry of drift,
  and re-ranking mid-loop would make the processing order depend
  on completion times,
  which is a new nondeterminism in the thing that decides
  what gets measured.
  Prefer the stale-but-deterministic order.
  Revisit only if
  runs get long enough that intra-run drift exceeds one entry per band.
- COVERAGE BAR REACHED 2026-07-27:
  31 settled entries,
  10 small / 11 medium /
  10 large,
  against the stratified ~10/10/10 target.
  Accumulation was then
  STOPPED DELIBERATELY (run 019 killed mid-entry) so the pool is fixed and the
  sheet's provenance is unambiguous rather than drifting under the draw.
  Accepted-issue pool at the draw:
  2257 over 31 entries.
  Per band:
  small 238
  (10.5 percent),
  medium 745 (33.0),
  large 1274 (56.4).
  ROUND-TWO SHEET DRAWN to
  `node_modules/.monochromatic/translation-repair-runs/grading-sheet-milestone-three-precision-round-two.md`,
  50 items,
  17 small / 17 medium / 16 large,
  seed
  `milestone-three-precision-round-two`,
  corpus pin unchanged.
  Validated before handing over:
  the sheet spreads across 30 of the 31 settled
  entries,
  so no single entry dominates it,
  and its 50 (entry,
  claim) pairs have
  ZERO overlap with round one's graded 50.
  That check matters because scoring a
  round on items already used to calibrate it would read better than the
  pipeline is;
  the seed rule alone was not treated as proof.
- SLICE-RATE PROJECTION CORRECTED.
  The rule recorded earlier ("a log lookup and
  a division") is right about WHERE the numbers come from and wrong about how
  far one rate projects.
  Susiethegamer had 5 of 17 slices left at a cold-portion
  rate of 7.5 min/slice,
  so 37 minutes was projected;
  it took 80.9.
  The resume's
  five slice cycles ran 7.2,
  8.7,
  about 28,
  12.9,
  and 14.6 minutes,
  so per-slice
  cost varies roughly fourfold WITHIN one entry.
  NIGHT81473140's projection
  landed (52 projected,
  50.6 actual) only because 15 remaining slices averaged
  that variance out.
  So:
  project from remaining slices only when MANY remain,
  and treat a
  small-remainder estimate as an order of magnitude,
  never a schedule.
  Same
  small-sample lesson as the timing cohorts and the panel-coverage sub-rates,
  arriving for the third time in one session through a different door.
  One unexplained observation left in place rather than explained away:
  between
  the panel stage at 16:12:01Z and the next critic stage at 16:40:20Z there is a
  28 minute gap with no editor or checker line logged,
  though the panel had
  issued 11 issues.
  Cause not established;
  do not assume it is provider latency.
- ROUND-TWO GATE VERDICT:
  FAILED at 0.74 / 0.787 / 0.80 (strict / partials
  excluded / ceiling),
  against round one's 0.56 / 0.64 / 0.68.
  37 clear Y,
  10
  clear N,
  3 ungradable of 50.
  Bar needs 45 of 50.
  Full analysis in
  `node_modules/.monochromatic/translation-repair-runs/gate-verdict-round-two.md`
  (outside git,
  quotes UNLICENSED corpus).
  Fixes A-F did real work (+0.18 strict,
  clear false positives 16 -> 10) and the
  direction is right,
  but the gate is not close.
  The band-balanced (0.788) and pool-weighted (0.794) readings agree to within a
  point,
  so the weighting question flagged before the draw did not need the
  user's decision.
  Record that it was computed,
  not skipped.
- NATURALNESS GAP CONFIRMED,
  both architecturally and empirically.
  The user
  suspected paragraph-level rewriting for English naturalness was not
  implemented;
  it is not.
  Architecturally:
  repairs are ISSUE-DRIVEN.
  `edit-prompt.ts` already tells the
  editor that "Emotional completeness and naturalness outrank word-for-word
  correspondence" and may "recast wording,
  sentence boundaries,
  and clause order
  freely",
  but the editor only ever touches a region an accepted issue already
  covers.
  A paragraph that is accurate,
  complete,
  and grammatical but stilted is
  never visited,
  because nothing generates an issue for it.
  Empirically,
  over all 2257 accepted issues:
  accuracy 77.4 percent (omission
  31.6,
  mistranslation 23.3,
  addition 21.8),
  style 13.6 (emotional-flattening
  8.9,
  awkward-phrasing 4.5,
  register 0.1),
  fluency 4.0,
  terminology 3.0,
  policy 1.4.
  Paragraph-level naturalness work is 4.6 percent of output.
  The grading confirms the harm is active,
  not merely absent:
  3 of the 10 clear
  false positives are literalism FIGHTING fluency (poetry judged literally,
  总是 forced to "always",
  conjunctions counted as additions when they are what
  makes the English read well).
- SYNTHETIC ROSTER CHANGED UNDER US (measured 2026-08-05 against the live
  `GET https://api.synthetic.new/openai/v1/models`,
  not from memory).
  TWO OF THE SEVEN ROSTER MODELS ARE GONE:
  `hf:moonshotai/Kimi-K2.7-Code` and
  `hf:MiniMaxAI/MiniMax-M3` both return HTTP 404
  `"... is no longer supported. Try using a different model, like
  hf:zai-org/GLM-5.2"`.
  Both were live during run 017,
  so this landed in the
  days since.
  404 is NOT in `transient-retry.ts`'s retry set (408,
  429,
  500,
  502,
  503,
  504),
  so each is a non-transient throw:
  the stage loses that voice immediately with
  no retry and the run continues DEGRADED.
  Unchanged,
  every stage would now run
  at 5 of 7 voices,
  permanently and quietly.
  THE ALIAS TRAP,
  which is the part worth reading twice:
  the endpoint lists 10
  ids but only SIX are distinct models.
  `syn:large:text` is GLM-5.2,
  `syn:large:vision` is Kimi-K3,
  `syn:small:text` is GLM-4.7-Flash,
  and
  `syn:small:vision` is Qwen3.6-27B,
  each confirmed by the `hugging_face_id`
  field.
  Restoring a 7-voice panel by adding a `syn:` alias would put the SAME
  model on the panel twice,
  and the voting stages would count one model's
  opinion as two independent confirmations.
  Never select roster members by id
  alone;
  dedupe on `hugging_face_id`.
  Distinct models now available,
  with context lengths:
  GLM-5.2 (524288),
  Kimi-K3 (524288,
  NEW,
  text+image),
  Qwen3.6-27B (262144,
  text+image),
  Nemotron-3-Super-120B (262144),
  GLM-4.7-Flash (196608),
  gpt-oss-120b (131072).
  So the panel can hold at most SIX independent voices,
  down from seven,
  unless
  Kimi-K3 counts as the replacement for Kimi-K2.7-Code and MiniMax-M3 goes
  unreplaced.
  Quorum thresholds and cross-round comparability both depend on
  this;
  decide it explicitly rather than letting the roster silently shrink.
- NEW USER INSTRUCTION (2026-08-05):
  before handing over a grading sheet,
  pre-resolve the unambiguous Y/N items and hand over only genuinely contested
  ones.
  This revives task 31 (judge crosscheck) as the mechanism.
  MUST be calibrated before it is trusted:
  if the agent resolves items,
  the
  reported precision partly reflects the agent's judgement rather than the
  user's,
  which is the measurement the gate exists to protect.
  The user has now
  graded 100 items across two rounds,
  which is exactly the calibration set.
  Measure agreement against those 100 BEFORE pre-resolving anything,
  and report
  the agreement rate alongside the next sheet.
