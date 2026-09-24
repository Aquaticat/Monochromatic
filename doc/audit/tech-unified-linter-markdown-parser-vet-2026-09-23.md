# Technology vet: unified linter Markdown parser

Status:
 complete.
Lifecycle phase:
 recommended;
 discovery saturated with three hard-gate-confirmed finalists,
 one validated finalist,
 recommendation Sätteri's Rust crates
 (`satteri-pulldown-cmark` 0.6.3,
 `satteri-arena` 0.3.1,
 `satteri-ast` 0.5.3)
 under the condition and material risks in "Recommendation".
Not adopted:
 no decision record exists and no product code changed.

Subject:
 unified linter Markdown parser.

Decision scope:
 select the Rust crate that parses Markdown and MDX into a positioned syntax tree
 for the Markdown language plugin of the self-maintained unified Rust linter
 ([`doc/handover/unified-linter.md`](../handover/unified-linter.md)),
 replacing npm `satteri` 0.10.5 in `package/cli/markdown-lint`.

Start date:
 2026-09-23.

Last updated:
 2026-09-23.

Governing skill:

- Commit `a05818ad70a40e5769a36de669697ba109891b31`
   (last commit touching `.agents/skills/choosing-technology/SKILL.md`;
   `.claude/skills/choosing-technology/SKILL.md` is an ignored mirror with identical bytes).
- SHA-256 `393eb68c5b2b2f7b16c8f7f90c100fb8be43eefa4501511360cd0572e4ae8087`.

Compatibility fingerprint:
 `e6940e365dc8497b04324b18f35a3f72681f4071b21649b9511b048c517a4142`.
Fingerprint input,
 lock,
 and atomic publish tooling:
 `~/temp/agent/md-parser-vet-2026-09-23/scripts/vet-fingerprint-lock.ts`.

Active audit owner:
 Claude Code session `75bdb615-8f19-477e-94d0-2b3fe90e3c7f` (subagent),
 handing the file write to its parent session.

Prior compatible report:
 none.
No file in `doc/audit/` started with `tech-unified-linter-markdown-parser-vet-` when this audit started.
Related but incompatible:
 [`tech-meow-hcl-front-end-vet-2026-09-17.md`](tech-meow-hcl-front-end-vet-2026-09-17.md)
 selects a parser for a different language and tool.

Process deviations recorded up front:

- The report was written in one pass at the end of the audit,
   not created at threshold crossing and updated per phase.
  Every command and data file it cites is kept in the scratch root,
   and every run is reproducible from the recorded commands.
- The auditing subagent's harness refuses report-file writes from subagents,
   so the subagent returned this text,
   already passed through `markdown-lint` in stdin mode,
   and the parent session writes the file,
   holding the report lock and the atomic rename.
- The skill asks for a commit after each phase;
   the requesting session asked this audit not to commit.

## Context

Measured or read on 2026-09-23.

- The user's decided requirements
   ([`doc/handover/unified-linter.md`](../handover/unified-linter.md),
   rounds 1 to 3):
   Rust only with no Node at run time;
   MDX stays linted with JSX,
   ESM,
   and expressions skipped;
   every current rule behavior survives exactly,
   frozen by the ported tests;
   fixes are byte-exact localized edits;
   Rust fences in Markdown and Markdown inside rustdoc are processed as virtual files.
- The cutover plan (round 2,
   not vetoed):
   port every TypeScript unit test,
   and require identical findings and fixes from old and new over the whole repository,
   with processors off.
- The incumbent parses with npm `satteri` 0.10.5,
   calling `markdownToMdast` or `mdxToMdast` with `{ gfm: true, frontmatter: true }`
   (`package/cli/markdown-lint/src/parse.ts:19-22`,
   `58-85`).
  npm 0.10.5 maps those features to tables,
   strikethrough,
   task lists,
   GFM,
   footnotes,
   YAML and TOML metadata blocks,
   and no math
   (`node_modules/.pnpm/satteri@0.10.5/node_modules/satteri/dist/compile.js:11-13`).
- The rules read these mdast fields:
   `url`,
   `depth`,
   `identifier`,
   `lang`,
   `value`,
   `referenceType`,
   `align`,
   and `position`
   (`rg` over `package/cli/markdown-lint/src`,
   tests excluded);
   and these node types:
   heading,
   image,
   definition,
   text,
   image reference,
   code,
   link reference,
   table,
   strong,
   paragraph,
   link,
   emphasis,
   list item,
   inline code,
   HTML,
   footnote reference,
   footnote definition,
   and delete.
- `parse.ts` still corrects offsets after astral characters although npm 0.10.x already reports UTF-16,
   so offsets after an astral character are shifted twice
   (GitHub issue #559).
  "E1" and "E4" measure its reach as side results.
- Tracked Markdown:
   1,264 `.md` and `.mdx` files,
   36 of them MDX,
   18 with astral characters,
   none with a byte-order mark,
   none over 5 MiB
   (`git ls-files`,
   read-only).
- Repository toolchain:
   Rust nightly through mise (`mise.toml`,
   `rust = { version = "nightly", ... }`),
   active `rustc 1.100.0-nightly (1303417c4 2026-09-21)`.
  The Rust linter crates use edition 2024 and no `rust-version`.
- The existing Rust linter's `Cargo.lock` has 98 packages and no `cc`;
   ten other repository lockfiles already carry `cc`.
- The linter's release profile is `lto = true`,
   `codegen-units = 1`,
   `opt-level = 3`,
   `strip = true`
   (`package/linter/rust/Cargo.toml`,
   `file-enforcer.config.ts` `CARGO_PROFILE_LINTER`);
   repository `lint:rust` tasks build in the dev profile.

## Classification

Base category:
 inspectable open-source local technology.

Overlays:

- incumbent dependency replacement
   (npm `satteri` behind `package/cli/markdown-lint`);
- human auditability,
   because the parser runs inside the cli-git commit hook and agent sessions;
- native,
   Wasm,
   prebuilt binary,
   or generated-code boundary,
   because candidates compile native code with build scripts and procedural macros,
   and the incumbent is a prebuilt napi binary.

Not applied:

- sensitive data:
   the parser reads repository text only,
   with no credentials or network;
- multi-platform claim:
   no platform beyond x86_64 Linux is stated for the linter,
   and every finalist is portable Rust,
   so no other platform was exercised.

## Frozen hard constraints

Frozen from the task statement and the handover before candidate evidence was gathered.

- HC1:
   pure Rust library usable with no Node at run time.
- HC2:
   MDX nodes:
   ESM,
   flow and text expressions,
   JSX flow and text elements.
- HC3:
   GFM tables,
   autolink literals,
   strikethrough,
   task lists,
   and footnotes.
- HC4:
   YAML and TOML frontmatter.
- HC5:
   per-node source positions that convert to exact byte offsets in the linted file.
- HC6:
   license compatible with distribution inside an LGPL-3.0-or-later binary.
- HC7:
   exposes definition,
   link reference,
   image reference,
   footnote,
   and HTML nodes with the identifier,
   reference type,
   and position the 13 rules read.
- HC8:
   every current rule behavior survives exactly:
   the 137 frozen unit tests and a whole-repository differential give identical findings and fixes.
- HC9:
   inspectable source at the audited revision with the published archive mapped to a commit.

## Frozen soft criteria and weights

Frozen before any rating.
The only explicit user preference is exact parity
 ("Everything",
 round 1);
 every other criterion has weight 1,
 as the skill requires for unspecified priorities.

- SC1,
   weight 5:
   parity margin beyond HC8
   (tree-level identity with the incumbent on the corpus and on synthetic boundary cases,
   which predicts rule parity on documents not yet written).
- SC2,
   weight 1:
   robustness on adversarial input
   (panics,
   stack overflow,
   super-linear time),
   because the parser runs in a commit hook.
- SC3,
   weight 1:
   maintenance activity and maintainer concentration.
- SC4,
   weight 1:
   security disclosure handling.
- SC5,
   weight 1:
   dependency surface and human auditability.
- SC6,
   weight 1:
   build cost:
   clean compile time,
   binary size,
   and build-time toolchain needs.
- SC7,
   weight 1:
   API stability and upgrade cost.
- SC8,
   weight 1:
   parse speed on the repository corpus.
- SC9,
   weight 1:
   integration effort for the Rust port.

Maximum points:

```text
# doc/audit/tech-unified-linter-markdown-parser-vet-2026-09-23.md
5 * 4 + 8 * (1 * 4) = 52
```

## Unresolved preferences

These change a hard constraint or adoption authority,
so they are asked rather than decided here.

- Build-time C toolchain.
   `satteri-ast` depends on `stacker` on every non-Wasm target
   (`satteri-ast-0.5.3/Cargo.toml:108`),
   and `stacker`'s `psm` dependency assembles `src/arch/x86_64.s` with `cc`
   (`psm-0.1.32/build.rs:38`).
  This audit reads HC1 ("pure Rust library usable with no Node at run time") as satisfied,
   because the parser and every dependency are Rust crates built by Cargo,
   and the incumbent's prebuilt binary already contains the same code.
  If the user means "no C or assembly compiled at build time",
   Sätteri fails HC1,
   no finalist survives,
   and the terminal result becomes "no validated finalist".
- Exactness versus an owned patch.
   `markdown` (markdown-rs) 1.0.0 fails HC8 on one frozen test and two repository MDX files
   ("E3" and "E4").
  If the user would accept a repository-maintained patch set as meeting "exact",
   markdown-rs re-enters as a finalist with the divergence classes in "E2" to patch,
   and the ranking must be recomputed.
- Dependency risk tolerance.
   Sätteri has one dominant maintainer
   and two private vulnerability reports that went unacknowledged until a public issue (bruits/satteri#306).
  Whether the repository vendors or forks the three crates at adoption is an adoption-time choice,
   not a ranking input.

## Discovery protocol

### Frozen query schedule

Source class 1,
 crates.io API (`/api/v1/crates`,
 User-Agent `monochromatic-vet-research`,
 100 per page,
 following `next_page` until null):

- `q=markdown parser`,
   `q=mdx`,
   `q=mdast`,
   `q=commonmark`,
   `q=gfm`,
   `q=markdown ast`,
   `q=markdown frontmatter`,
   `q=satteri`,
   `q=jsx markdown`;
- `keyword=markdown`,
   `keyword=mdx`,
   `keyword=commonmark`,
   `keyword=mdast`,
   `keyword=gfm`;
- `category=parser-implementations&q=markdown`,
   `category=text-processing&q=markdown`.

Source class 2,
 GitHub search API through `gh api` (100 per page,
 until exhaustion or the 1,000-result cap):

- repositories:
   `mdx parser language:rust`,
   `markdown parser language:rust`,
   `mdast language:rust`,
   `commonmark language:rust`,
   `topic:mdx language:rust`,
   `topic:markdown-parser language:rust`,
   `topic:commonmark language:rust`,
   `satteri`;
- code:
   `mdxJsxFlowElement language:rust`,
   `MdxjsEsm language:rust`,
   `MdxFlowExpression language:rust`;
- forks of `wooorm/markdown-rs` (`repos/wooorm/markdown-rs/forks`,
   paginated).

Source class 3,
 web search (WebSearch provider,
 one result page per query,
 no pagination offered):

- `Rust crate MDX parser mdast JSX ESM expressions`;
- `Rust Markdown parser with MDX support`;
- `satteri alternative Rust markdown parser`;
- `markdown-rs vs comrak vs pulldown-cmark comparison source positions`;
- `Rust markdown linter mdx support which parser crate`;
- `oxc markdown parser MDX Rust crate`;
- `mdast Rust crate syntax tree markdown positions frontmatter toml yaml`;
- `Biome markdown parser crate biome_markdown_parser MDX support status 2026`;
- `tree-sitter mdx grammar Rust bindings`;
- `new Rust MDX parser crate 2026 JSX expressions ESM mdast compatible`;
- `lossless markdown CST parser Rust byte spans GFM footnotes frontmatter`.

Source class 4,
 this repository:
 `rg` for `comrak`,
 `pulldown-cmark`,
 `markdown-rs`,
 and `markdown-it` over tracked files;
 the incumbent package;
 `doc/handover/markdown-lint-satteri-benchmark.md`;
 `doc/troubleshooting/satteri-offsets.md`;
 `doc/research/unified-linter-eslint-model.md`;
 prior vet reports in `doc/audit/`.

### Recorded queries

Raw records:
 `data/crates-initial.jsonl`,
 `data/crates-expansion.jsonl`,
 `data/github-initial.jsonl`,
 `data/github-expansion.jsonl`,
 all under the scratch root.
"MDX signal" means the crate name,
 description,
 or crates.io README mentions MDX,
 JSX,
 or ESM.

crates.io,
 initial round,
 accessed 2026-09-24 UTC:

- `q=mdx`,
   relevance:
   2 pages,
   196 results,
   53 MDX signal,
   53 new;
   every later serious alternative first appeared here.
- `q=mdast`,
   relevance:
   1 page,
   21 results,
   8 MDX signal,
   0 new.
- `q=commonmark`,
   relevance:
   5 pages,
   412 results,
   14 MDX signal,
   2 new.
- `q=gfm`,
   relevance:
   5 pages,
   402 results,
   17 MDX signal,
   1 new.
- `q=markdown ast`,
   relevance:
   8 pages,
   797 results,
   21 MDX signal,
   0 new.
- `q=markdown frontmatter`,
   relevance:
   10 pages,
   931 results,
   11 MDX signal,
   1 new.
- `q=satteri`,
   relevance:
   1 page,
   9 results,
   6 MDX signal,
   0 new.
- `q=jsx markdown`,
   relevance:
   2 pages,
   188 results,
   11 MDX signal,
   0 new.
- `keyword=markdown`:
   17 pages,
   1,682 results,
   28 MDX signal,
   0 new.
- `keyword=mdx`:
   1 page,
   31 results,
   26 MDX signal,
   0 new.
- `keyword=commonmark`:
   1 page,
   100 results,
   6 MDX signal,
   0 new.
- `keyword=mdast`:
   1 page,
   4 results,
   1 MDX signal,
   0 new.
- `keyword=gfm`:
   1 page,
   22 results,
   2 MDX signal,
   0 new.
- `category=parser-implementations&q=markdown`,
   relevance:
   5 pages,
   483 results,
   12 MDX signal,
   0 new.
- `q=markdown parser`,
   relevance:
   capped;
   crates.io answered HTTP 400 for page 11 after 1,000 results.
  Rerun with `sort=new`,
   whose `next_page` is a seek cursor:
   20 pages,
   1,925 results (the reported total),
   24 MDX signal,
   1 new.
- `category=text-processing&q=markdown`:
   relevance capped the same way;
   rerun with `sort=new`:
   13 pages,
   1,255 results,
   24 MDX signal,
   0 new.

Union after both rounds:
 5,661 distinct crates.
Screening by metadata
 (`scripts/screen-crates.ts`,
 README fetched for every crate whose name or description names a Markdown parser):

- 4,186 not Markdown crates (category mismatch);
- 1,100 Markdown consumers,
   renderers,
   or tools without a parser signal (category mismatch);
- 317 Markdown parsers whose description and README never mention MDX,
   JSX,
   or ESM (HC2 exit by metadata,
   confirmed from source for the two best-known,
   comrak and pulldown-cmark);
- 58 with an MDX signal,
   each screened by hand in "Discovery ledger".

What the README filter can hide:
 a parser that supports MDX without saying so in its description or README.
The GitHub code searches for mdast MDX node names in Rust source are the independent check for that case.

GitHub,
 initial round,
 accessed 2026-09-24 UTC:

- repositories `mdx parser language:rust`:
   11 results,
   exhausted.
- repositories `markdown parser language:rust`:
   338,
   4 pages,
   exhausted.
- repositories `mdast language:rust`:
   6,
   exhausted.
- repositories `commonmark language:rust`:
   88,
   exhausted.
- repositories `topic:mdx language:rust`:
   24,
   exhausted.
- repositories `topic:markdown-parser language:rust`:
   31,
   exhausted.
- repositories `topic:commonmark language:rust`:
   44,
   exhausted.
- repositories `satteri`:
   43,
   exhausted
   (plugins and reproductions for the npm package).
- code `mdxJsxFlowElement language:rust`:
   reported 386,
   returned 329 in 4 pages,
   151 repositories.
- code `MdxjsEsm language:rust`:
   reported 252,
   returned 243 in 3 pages,
   121 repositories.
- code `MdxFlowExpression language:rust`:
   reported 323,
   returned 319 in 4 pages,
   154 repositories.
- forks of `wooorm/markdown-rs`:
   94,
   none with more than one star,
   none publishing a crate or release.

The code-search union is 164 repositories
 (`data/github-code-union.txt`).
GitHub code search returns fewer items than its reported total,
 which is an estimate;
 each query ended with a short final page,
 so the provider reported exhaustion.
Almost all hits consume `markdown` (markdown-rs) or `mdxjs` types,
 or vendor a copy of markdown-rs;
 the independent implementations are in "Discovery ledger".

Web,
 accessed 2026-09-24 UTC:
 each query returned one page of about 10 results.
New names:
 `oxc-markdown-parser`,
 `omni-mdx`,
 `mdx2md`,
 `ferromark`,
 `markdown-syntax`,
 `panache`,
 `rumdl`,
 `mdbook-lint`,
 `markdownlint-rs`,
 `tree-sitter-mdx`,
 Biome's Markdown parser,
 `dinja-core`,
 `ox_content_ast`.
Every published crate among them also appeared through crates.io.

Repository:
 `doc/research/unified-linter-eslint-model.md` records the Sätteri Rust crate API and names markdown-rs,
 comrak,
 and pulldown-cmark as fallbacks;
 `pulldown-cmark` appears only in two unrelated `Cargo.lock` files.
No hand-rolled Markdown parser exists in the repository.

### Discovery ledger

#### Sätteri Rust crates

`satteri-pulldown-cmark` 0.6.3,
 `satteri-arena` 0.3.1,
 `satteri-ast` 0.5.3
 (one component;
 the three are released together from `bruits/satteri` commit `5df21fc0cead783853a8959c641d9c241d0037b6`).
Source:
 crates.io `q=mdx` and `q=satteri`;
 the incumbent.
Base category:
 inspectable open-source local technology.
Screening:
 serious alternative,
 then hard-gate confirmed,
 then validated.
The high-level `satteri` 0.2.13 wrapper
 (published from `f2eb29a`)
 and the retired `satteri-mdast` 0.1.0 and `satteri-hast` 0.1.0 add nothing a linter needs.

#### `markdown` (markdown-rs) 1.0.0

Source:
 crates.io `q=mdx`,
 GitHub code search,
 web.
Screening:
 serious alternative,
 hard-gate confirmed at targeted evidence,
 exit at validation on HC8.

#### `markdown-syntax` 0.2.0

Source:
 crates.io `q=mdx` (README),
 web.
Screening:
 serious alternative,
 hard-gate confirmed at targeted evidence,
 exit at validation on HC5 and HC8.

#### Keep the incumbent

npm `satteri` 0.10.5 through Node.
Exit:
 HC1,
 because it needs Node at run time.
It remains the parity oracle.

#### `comrak` 0.55.0 and `pulldown-cmark` 0.13.4

Source:
 crates.io,
 web,
 repository research.
Exit:
 HC2;
 zero matches for `\bmdx\b` or `\bjsx\b` in `comrak/src` (clone `a28e394`)
 and `pulldown-cmark/pulldown-cmark/src` (clone `c51a2a4`).

#### `oxc-markdown-parser` 0.0.2

Source:
 crates.io,
 web.
Exit at targeted evidence:
 HC2 and HC4.
A `TODO` doc comment at `crates/oxc_markdown_parser/src/options.rs:109` (commit `816650b`)
 marks the MDX option as not usable yet because the `mdx_*` constructs are unimplemented,
 and the crate has no frontmatter construct.

#### `ox_content_parser` 3.2.8

Source:
 crates.io,
 GitHub code search (`ubugeeei-prod/ox-content`).
Exit at targeted evidence:
 HC4 and HC7.
The published archive has no frontmatter,
 YAML,
 or TOML construct,
 and no link-reference or image-reference node.

#### `ferromark` 2.1.1

Source:
 crates.io,
 GitHub code search,
 web.
Exit at targeted evidence:
 HC7.
References resolve into `Link` with a URL and no reference kind
 (`src/ast/nodes.rs:387-395`).

#### `dmc-parser` 0.3.6 and `dmc-lexer` 0.3.6

Source:
 crates.io `q=mdx`,
 GitHub (`gentleeduck/duck-mc`).
Exit at targeted evidence:
 HC7;
 no definition,
 link-reference,
 or image-reference node in `src/ast/node.rs`.

#### `unifast-core` 0.0.10

Source:
 crates.io,
 GitHub (`kenzo-pj/unifast`).
Exit at targeted evidence:
 HC7;
 the mdast enum in `src/ast/mdast/nodes.rs` has no link-reference or image-reference variant.

#### `ptdgrp-markdown` 1.1.4

Exit at targeted evidence:
 HC2;
 "JSX-like components" only,
 no ESM or expressions.

#### `omni-mdx` 1.1.0

Exit at targeted evidence:
 HC2 and HC4;
 pulldown-cmark plus a JSX side lexer,
 with no ESM,
 expression,
 or frontmatter node in `src/ast.rs`.

#### `mdx` 0.0.4

Exit at targeted evidence:
 HC2,
 HC3,
 and HC4;
 a 2021 prototype with headings,
 paragraphs,
 and thematic breaks only.

#### GitHub-only MDX parsers

- `futurepaul/hypernote-mdx` (`3530268`,
   2026-03-17):
   HC6,
   no license file or license field;
   also HC3 and HC4 (no tables,
   footnotes,
   or TOML).
- `mdxor/compiler` (last push 2022-01-19):
   HC3 and HC4.
- `kyle-mccarthy/mdx-rs` (last push 2022-04-25):
   HC2 and HC4 (no ESM,
   no TOML).
- `icyJoseph/mdx2md`:
   category mismatch,
   an MDX-to-Markdown converter with no positioned tree API.
- Application-internal parsers found by code search
   (`feigeCode/navop` `crates/markdown-source`,
   others):
   category mismatch,
   not published libraries.

#### Wrappers and consumers of a finalist

`mdxjs` 1.0.4,
 `mq-markdown` 0.9.0,
 `dinja-core` 0.5.0 (also Deno V8),
 `rumdl` 0.2.77,
 `web-infra-dev/mdx-rs`,
 `turbopack-mdx`,
 and 94 personal forks of markdown-rs:
 category mismatch;
 they add no parser beyond markdown-rs.
`amiss-md` 0.34.0 also fails HC6 (FSL-1.1).
`rumdl` is evidence that a Rust Markdown linter pairs markdown-rs with an `oxc` ESM callback for MDX.

#### Other MDX-signal crates

MDict dictionary readers (`mdict-parser`,
 `mdict-rs`,
 `mdictlib`,
 `readmdict`,
 `rs-mdict`,
 `wodix`),
 Warcraft 3 model tools (`War3Mdlx`,
 `whiteoutlib`),
 `mdx-rust*`,
 `mdx-cli`,
 `mdxtree`,
 `neon_nlp`,
 `sff`,
 `prepyrus`,
 `fallow-extract`,
 `hyalo-core`,
 `typedoc_json_to_md`,
 `markdown-rs-cli`,
 `md2ast` (pulldown-cmark 0.12),
 `mordant` (no MDX),
 `mdx-gen` (comrak),
 `cosmic-ext-nib-markdown` (pulldown-cmark),
 `dioxus-mdx`,
 `rscx-mdx`,
 `yew-mdx`,
 `markdown_view_leptos`,
 `optative-script-mdx`,
 `turbopack-mdx` 0.0.0,
 `dx` 0.0.0,
 `unifast-bindings-*`:
 category mismatch or HC2.
`tree-sitter-markdown-text` and `tree-sitter-mdx`:
 HC1,
 generated C parsers.
Biome's Markdown parser:
 not published on crates.io and without MDX (web evidence,
 biomejs/biome#11551).

### Expansion round

Taxonomy terms added after the initial round:
 micromark,
 lossless,
 CST,
 span,
 lint,
 remark,
 pulldown-cmark fork,
 tree-sitter.

- crates.io,
   all `sort=new`:
   `q=micromark` (2),
   `q=lossless markdown` (231),
   `q=markdown cst` (49),
   `q=markdown span` (938),
   `q=markdown lint` (1,142),
   `q=remark` (347),
   `q=pulldown-cmark fork` (30),
   `q=tree-sitter markdown` (556),
   `keyword=markdown-parser` (1),
   `keyword=micromark` (0),
   `keyword=jsx` (70),
   `keyword=frontmatter` (70);
   0 new MDX-signal crates.
- GitHub:
   repositories `micromark language:rust` (0),
   `markdown linter language:rust` (49,
   45 new,
   all linters built on comrak,
   pulldown-cmark,
   tree-sitter,
   or markdown-rs),
   `topic:markdown language:rust parser` (83,
   0 new);
   code `mdxTextExpression language:rust` (156 repositories,
   4 new)
   and `"mdx_jsx" language:rust` (97 repositories,
   39 new,
   mostly vendored Next.js `turbopack-mdx`);
   0 new independent parsers.
- Web:
   `micromark Rust port MDX parser crate alternative to markdown-rs`,
   `markdown-syntax crate plimeor Rust MDX parser`,
   `rumdl MDX parsing markdown-rs oxc ESM parser`;
   0 new names.

The schedule is frozen after this round.

### Terminal discovery result

Saturated with three hard-gate-confirmed survivors:
 Sätteri's Rust crates,
 markdown-rs,
 and markdown-syntax.
Every required source class finished its frozen schedule;
 the two capped crates.io queries were completed through seek pagination.

## Execution manifest

Every build,
 test,
 probe,
 fuzz run,
 and suite ran in a Podman container through `scripts/run-box.ts` (Rust image)
 or `scripts/run-node-box.ts` (Node image),
 which record image,
 digest,
 bounds,
 network,
 command,
 status,
 and elapsed time in `data/logs/executions.jsonl`,
 with a full log per run in `data/logs/`.

- Images:
   `docker.io/library/rust:slim`,
   digest `sha256:a2de23e559fd8afd260d22beb00f3987073ea0dcc2ba2646cccdaeda6a62a095`;
   `docker.io/library/node:26-slim`,
   digest `sha256:7400141a84821c75c81651e9af3d087895e63b8daa51322f7a734c48ecaddc52`;
   `localhost/md-parser-vet-rust:1`,
   image `fd15dfff87e7`,
   which is `rust:slim` plus Debian `libssl-dev`,
   `pkg-config`,
   and `g++`,
   built from `lab/image/Containerfile` for markdown-rs's workspace tests and the libFuzzer builds.
- Bounds on every run:
   `--memory=2g --cpus=2 --pids-limit=512 --ulimit nofile=4096:4096`.
- Network:
   `slirp4netns` only for dependency fetches
   (`cargo fetch`,
   `cargo generate-lockfile`,
   `rustup toolchain install`,
   `npm install --global pnpm@11.10.0`,
   `pnpm install --frozen-lockfile --ignore-scripts`)
   and the derived image build;
   `none` for every build,
   test,
   probe,
   and fuzz run,
   with `CARGO_NET_OFFLINE=true`.
- Mounts:
   scratch root read-write;
   Cargo target root read-write;
   toolchain read-only;
   for the Node image,
   the repository read-only at its own path.
  No credentials,
   no real home directory,
   `HOME` and `TMPDIR` inside scratch.
- Toolchains:
   repository nightly `nightly-2026-09-22` (`rustc 1.100.0-nightly`);
   stable 1.98.1;
   Sätteri's pinned 1.95.0 and markdown-rs's release-era stable 1.86.0,
   installed with `rustup` into scratch.
- Wall-clock bounds:
   `timeout 120` inside the container only where a hang is the behavior under test (fuzz replays);
   libFuzzer's own `-timeout` and `-max_total_time` for fuzzing.
- Build scripts inspected before the first build:
   `satteri-pulldown-cmark` (`build.rs` generates spec tests only under the `gen-tests` feature),
   `psm` (assembles `src/arch/x86_64.s` with `cc`),
   `stacker`,
   `libc`,
   `num-traits`,
   `object`,
   `proc-macro2`,
   `quote`,
   `serde`,
   `serde_core`,
   `serde_json`,
   `thiserror`,
   `zmij`,
   `dragonbox_ecma`,
   `icu_locale_fallback_data`,
   `icu_segmenter_data`
   (Sätteri tree);
   none in the markdown-rs or markdown-syntax library trees;
   `libfuzzer-sys` compiles libFuzzer C++ with `cc` for the fuzz harness only.
- Procedural macros in Sätteri's tree:
   `oxc_ast_macros`,
   `oxc-miette-derive`,
   `phf_macros`,
   `serde_derive`,
   `seq-macro`,
   `rustversion`,
   `displaydoc`,
   `thiserror-impl`,
   `yoke-derive`,
   `zerofrom-derive`,
   `zerovec-derive`.

Undeclared behavior found during execution,
 each handled by stop,
 inspect,
 continue:

- `cargo clippy --all-features` on Sätteri enables `gen-tests`,
   whose `build.rs` rewrites `crates/satteri-pulldown-cmark/tests/suite/*.rs` in the clone;
   the regenerated files matched the committed ones (`git status` clean afterwards).
- markdown-rs commits no `Cargo.lock`;
   a lockfile resolved on 2026-09-24 fails to compile the dev-dependency `swc_common` 8.1.1 against `serde` 1.0.229
   (`unresolved import serde::__private`).
  The CI path was rerun with `cargo generate-lockfile -Zunstable-options --publish-time 2025-04-24T00:00:00Z`,
   the dependency set as of the 1.0.0 release.
- markdown-rs's `--workspace` includes the `generate` crate,
   whose `reqwest` pulls `openssl-sys`,
   which needs OpenSSL headers;
   the derived image supplies them.
  The `generate` binary itself,
   which downloads Unicode data,
   was never run.
- The Sätteri JavaScript install used `--ignore-scripts`;
   CI allows lifecycle builds for `@parcel/watcher`,
   `esbuild`,
   `sharp`,
   and `workerd`,
   which the `packages/satteri` tests do not load.
- The host `cargo-fuzz` 0.13.2 is a static musl binary that defaults to the musl target;
   every fuzz run passes `--target x86_64-unknown-linux-gnu`.

## Evidence records

Scratch root:
 `~/temp/agent/md-parser-vet-2026-09-23/`
 (paths in this section are relative to it unless they name a crate archive).
Host:
 Linux 7.2.0 x86_64,
 16 CPUs,
 Fedora 44 Silverblue.
Audited archives
 (SHA-256 equals the crates.io index checksum for each;
 `data/crate-archives.jsonl`):

- `satteri-pulldown-cmark` 0.6.3:
   `fcd3c0c0af2c48cf770383ba4bb3f45fa37fe3162bee7febd955c562d5af27e1`,
   `.cargo_vcs_info.json` commit `5df21fc0cead783853a8959c641d9c241d0037b6`.
- `satteri-arena` 0.3.1:
   `7bca9f633e57593d92bee58e50ea8dca66b7ae8070f41545bdec4ef425bea715`,
   same commit.
- `satteri-ast` 0.5.3:
   `e18ee64b49df1b3c85d246a80c0381084de34b8dc833e7152ccad40f5f93b15e`,
   same commit.
- `markdown` 1.0.0:
   `a5cab8f2cadc416a82d2e783a1946388b31654d391d1c7d92cc1f03e295b1deb`,
   commit `1506572f9b406431402928f3a8b3df0b4ae2d8f5`.
- `markdown-syntax` 0.2.0:
   archive in `clones/crates/`,
   repository `plimeor/markdown-syntax`.

npm `satteri` 0.10.5 was released from `b3d38e1` on 2026-08-19;
 `git diff --stat 5df21fc b3d38e1 -- crates/` touches only `satteri-mdxjs-rs`,
 `satteri-napi-binding`,
 and `satteri` manifests,
 so the parser sources behind npm 0.10.5 and behind the three crates are identical.

### E1: tree parity

Claim:
 how closely each finalist's tree matches the incumbent's,
 node by node.
Gates and criteria:
 HC5,
 HC8,
 SC1.

Corpus (`data/corpus.jsonl`,
 `scripts/build-corpus.ts`):

- every distinct parse input from the 137 unit tests,
   captured by running all 20 test files under a Node resolve hook that records each `markdownToMdast`
   or `mdxToMdast` call
   (`lab/capture/`;
   175 calls,
   136 distinct inputs,
   7 of them MDX;
   all 20 files passed);
- all 1,264 tracked `.md` and `.mdx` files,
   including the 18 with astral characters
   (19,548,894 bytes).

Method:

- Reference:
   raw npm `satteri` 0.10.5 with `{ gfm: true, frontmatter: true }`,
   imported from the package's own resolution and bypassing `parse.ts`
   (`lab/parity/ref-npm.mjs`);
   UTF-16 offsets converted to UTF-8 byte offsets.
- Finalists:
   release probe binaries in the Rust image,
   network off
   (`lab/probe-*`).
  Sätteri with the npm-equivalent flags
   (tables,
   strikethrough,
   task lists,
   GFM,
   footnotes,
   YAML and pluses metadata blocks,
   plus `ENABLE_MDX` for MDX,
   no math).
  markdown-rs with `Constructs::gfm()` plus frontmatter,
   and for MDX `Constructs::mdx()` plus the GFM constructs plus frontmatter,
   with an ESM callback returning `MdxSignal::Ok`.
  markdown-syntax with the GFM constructs plus frontmatter,
   `relaxed_autolinks` off,
   and for MDX its MDX preset plus the same GFM constructs,
   through an adapter to mdast node names
   (merging text,
   escape,
   character-reference,
   and soft-break runs into one `text`).
- Comparison (`lab/parity/compare.mjs`):
   children aligned by a longest-common-subsequence over child types;
   counts of matched nodes,
   nodes only one side has,
   parents whose child lists differ ("nesting sites"),
   start or end offset differences,
   and differences in the rule-relevant fields.
  "Visible" excludes nodes inside MDX subtrees,
   which the incumbent's walker skips.

Controls:

- Negative:
   the reference compared with itself:
   1,400 of 1,400 documents identical.
- Positive:
   `parse.ts` output compared with the raw reference:
   exactly the 18 astral-bearing repository files differ,
   10,854 nodes with shifted offsets,
   no structural or field difference.
  This proves the comparator detects offset drift,
   and measures the reach of issue #559.

Results (619,729 reference nodes):

- Sätteri's Rust crates:
   1,400 of 1,400 documents identical;
   0 structural differences,
   0 offset differences,
   0 field differences;
   the one document npm rejects (an invalid MDX JSX tag from `src/run.unit.test.ts`) also yields a Sätteri MDX error.
- markdown-rs:
   219 of 1,400 documents identical
   (128 of 136 unit inputs,
   91 of 1,264 repository files);
   10 documents with structural differences
   (35 nesting sites,
   131 reference-only nodes,
   196 markdown-rs-only nodes);
   1,176 documents with offset differences
   (24,170 nodes:
   1,286 starts,
   23,002 ends);
   17 documents with field differences (43 nodes).
  By node type,
   list items account for 12,010 end differences,
   lists for 10,977,
   list and list-item starts for 505 and 544,
   and paragraph starts for 231.
- markdown-syntax:
   85 of 1,400 documents identical;
   110 with structural differences (509 nesting sites);
   1,313 with offset differences (356,387 nodes);
   1,256 with field differences;
   the invalid MDX document is accepted instead of rejected.

Logs:
 `data/parity-satteri.json`,
 `data/parity-markdown-rs.json`,
 `data/parity-markdown-syntax.json`,
 `data/parity-control-self.json`,
 `data/parity-control-parse-ts.json`;
 probe runs in `data/logs/run-probe-*.log`.

### E2: synthetic boundary cases

Twenty hand-written cases chosen from the E1 divergences and from the rules' offset-sensitive paths
 (`scripts/build-synthetic.ts`,
 per-case output `data/parity-synthetic.json`).
Sätteri matched the reference on 19 of 20,
 markdown-rs on 14,
 and markdown-syntax on 3.

The divergence classes,
 with the case that shows each:

- Byte-order mark (`bom-heading`).
   npm Sätteri and the Rust crates both report offsets relative to the source with the BOM stripped
   (`satteri-pulldown-cmark-0.6.3/src/utils.rs:21-23`,
   `arena_build.rs:50`);
   slicing the original string at npm's heading offsets yields `"﻿# Titl"`.
  The Rust port must add 3 bytes when a BOM is present;
   Sätteri's one differing case is this shift under the audit's unit conversion,
   not a disagreement between the two Sätteri builds.
  markdown-rs keeps absolute offsets (`src/construct/partial_bom.rs`);
   markdown-syntax reads the BOM as text and turns the heading into a paragraph.
  No tracked file has a BOM.
- Nested autolink inside a link (markdown-rs;
   `data/adhoc-angle.jsonl`):
   `[https://e.com](<https://e.com>)` parses as a link containing a second link,
   in Markdown and in MDX;
   Sätteri and the reference keep one link.
  This causes the E3 failure and the E4 differences.
- Heading content starting with `#` (markdown-rs,
   `heading-hash-content`):
   `### #97 closed` yields text `97 closed`,
   dropping the `#`.
- Label containing a line ending (markdown-rs,
   `label-with-newline`):
   `[the\ndocs]` normalizes to identifier `thedocs`;
   the reference gives `the docs`.
- Escape at the start of a table cell (markdown-rs,
   `table-cell-escape`):
   the text node starts after the backslash,
   one byte later than the reference;
   `no-pipe-tables` slices cell source at these offsets.
- HTML block inside a list item (markdown-rs,
   `html-comment-in-list`):
   the reference's `html` value and end include the trailing line ending;
   markdown-rs's do not.
- ESM containing a blank line (markdown-rs,
   `mdx-esm-blank-line`):
   with a callback that accepts every block,
   ESM ends at the first blank line and the rest becomes a paragraph.
  Matching Sätteri needs a JavaScript parser in the callback:
   markdown-rs `src/construct/mdx_esm.rs:50` requires `mdx_esm_parse`,
   and `src/configuration.rs:264` says ESM is otherwise read as Markdown.
- Inline offsets after the first line (markdown-syntax,
   five cases):
   every inline node on a continuation line,
   in a block quote,
   in a list item,
   in a table cell,
   or after CRLF is shifted,
   and table cells carry no span.
  Cause:
   `markdown-syntax-0.2.0/src/parse.rs:3647` joins paragraph lines after `trim_ascii_start`,
   and `parse.rs:3655` passes the joined string to `parse_inlines` with the paragraph start as base offset,
   so offsets count bytes of a string that is not the source.
- Markdown inside JSX (markdown-syntax,
   `mdx-markdown-inside-jsx`):
   JSX blocks are raw strings with no children or name,
   so the incumbent's "skip the JSX subtree" behavior has nothing to skip.
- Invalid MDX (markdown-syntax,
   `mdx-invalid-jsx`):
   `a <https://e.com> b` is accepted as an autolink,
   where the reference raises an MDX error that the linter reports as `markdown-lint-error`.

### E3: consumer boundary with the 137 unit tests

Claim:
 whether the frozen tests pass when each finalist is the parser.
Gate:
 HC8.
Method:
 all 20 test files run in the Node image with the repository read-only,
 under a resolve hook that serves `satteri` from a shim
 (`lab/boundary/`).
The shim runs the finalist's probe on the source and rebuilds the tree as npm hands it to `parse.ts`:
 UTF-16 offsets,
 1-based line and UTF-16 column derived from the offset,
 and absent optional fields as `null`.
`parse.ts` and every rule run unchanged.

Results:

- npm (control):
   137 of 137 pass.
- Sätteri's Rust crates:
   137 of 137 pass.
- markdown-rs:
   136 of 137;
   `MD034 no-bare-urls` "fix uses an inline link in MDX and is idempotent" fails
   (`expected 1 to equal +0`,
   `md034-no-bare-urls.unit.test.ts:79`),
   because the fixed text `[url](<url>)` parses as a link nesting an autolink.
- markdown-syntax:
   126 of 137;
   11 tests fail across `parse.unit.test.ts`,
   `no-pipe-tables.unit.test.ts`,
   and `run.unit.test.ts`.

The markdown-rs failure also proves the hook is live.
Logs:
 `data/unit-tests-*.json`,
 `data/logs/unit-*.log`.

### E4: consumer boundary with the whole repository

Claim:
 whether findings and fixes over every tracked Markdown file stay identical.
Gate:
 HC8,
 the cutover plan's differential with processors off.
Method:
 `runRules` with all 13 rules and `fixSource` over the 1,264 files,
 per engine,
 in the Node image
 (`lab/boundary/lint-corpus.mjs`,
 `compare-lint.mjs`).
Two passes:
 with `parse.ts` unchanged,
 and with its second astral correction replaced by a no-op (`PROBE_FIX_559=1`),
 which is the behavior a Rust port with byte offsets has.
`lfs-image-url` is inert without LFS context in both.

With the #559 correction removed
 (reference:
 51,902 findings,
 157 files changed by fixes):

- Sätteri's Rust crates:
   identical findings in 1,264 of 1,264 files,
   identical fixed output in 1,264 of 1,264.
- markdown-rs:
   identical findings and fixed output in 1,262 of 1,264.
  `package/ssg/aquati.cat/src/content/ca/magicbread.mdx` and its `en` sibling gain 8 `MD034` findings between them,
   on links written as `[https://g.co/kgs/b78JSyY](<https://g.co/kgs/b78JSyY>)`,
   and their fix loop ends in markdown-rs MDX errors
   (at `122:81` in `ca` and `129:81` in `en`,
   "Unexpected character `/` (U+002F) before local name").

With `parse.ts` unchanged (reference 51,242 findings):
 Sätteri gives identical findings for 1,264 files and identical fixed output for 1,263.
The one difference,
 `package-paused/module/es/TODO.typeguard-refactor.md`,
 is a harness artifact:
 the incumbent's double-corrected fix splits a surrogate pair,
 and a lone surrogate cannot cross into a Rust `&str`.
Side result:
 issue #559 changes 660 findings across the repository
 (51,902 without it,
 51,242 with it).

Logs:
 `data/lint-*.jsonl`,
 `data/lint-compare.json`,
 `data/lint-compare-no559.json`.

### E5: upstream CI-equivalent suites

Sätteri at `5df21fc`
 (`.github/workflows/ci.yml`:
 lint job `cargo fmt -- --check`,
 `cargo clippy --all-features -- -D warnings`,
 codegen check,
 and oxlint;
 test job `cargo test`,
 TypeScript build,
 typecheck,
 napi debug build,
 and `pnpm test` with `SKIP_FUZZ=1`):

- Pinned toolchain 1.95.0:
   `cargo fmt -- --check` pass (3.3 s);
   `cargo clippy --all-features -- -D warnings` pass (27.4 s);
   `cargo test --locked` pass (75.4 s).
- Stable 1.98.1:
   fmt pass;
   clippy fails on 4 newer style lints in consumed source
   (`map_or_identity` at `firstpass.rs:2902`,
   `byte_char_slices` at `firstpass.rs:5874`,
   `question_mark` at `mdx.rs:644`,
   `useless_borrows_in_formatting` at `tree.rs:272`),
   none a correctness lint;
   `cargo test` 2,082 passed,
   0 failed,
   55 test binaries (74.2 s).
- Repository nightly:
   `cargo test` 2,082 passed,
   0 failed (82.9 s).
- JavaScript test job (stable 1.98.1,
   Node 26.10.0,
   pnpm 11.10.0):
   install 15.8 s,
   `build:ts` pass,
   `build:binary:native:debug` pass (50.6 s),
   `pnpm test` 51 files,
   3,114 passed,
   22 expected failures,
   1 skipped (20.5 s).
- Omitted from the default path:
   `pnpm codegen:check`,
   which regenerates layout code and diffs it,
   a generated-file freshness check (the regenerated test files matched the commit);
   and `pnpm oxlint`,
   which lints TypeScript the Rust port does not consume.

markdown-rs at `1506572`
 (`.github/workflows/main.yml`:
 `cargo fmt --check`,
 `cargo clippy --all-features --all-targets --workspace`,
 `cargo test --all-features --workspace`;
 coverage with tarpaulin is a separate job):

- With a lockfile resolved today:
   the tests do not compile (`swc_common` 8.1.1 against `serde` 1.0.229),
   so the upstream CI would fail if run now.
- Release-era lockfile,
   stable 1.86.0:
   fmt pass;
   clippy pass (53.5 s);
   tests 198 passed,
   0 failed,
   11 ignored doctests,
   74 test binaries (123.6 s).
- Release-era lockfile,
   stable 1.98.1:
   clippy fails because `#![deny(clippy::pedantic)]` (`src/lib.rs:26`) meets the newer `manual_assert_eq` lint
   at `src/tokenizer.rs:532`;
   tests 198 passed (139.5 s).
- Release-era lockfile,
   repository nightly:
   tests 198 passed (109.6 s).
- Omitted:
   the tarpaulin coverage job,
   which measures coverage of the same tests and uploads it.

markdown-syntax:
 not run;
 it failed HC5 in E2 with a source-level cause,
 so no suite result could restore it.

### E6: fuzzing and adversarial input

Sätteri's JavaScript differential fuzz suite against remark
 (`packages/satteri/test/conformance/fuzz/`:
 Markdown,
 MDX,
 frontmatter,
 autolink,
 and math properties with fast-check,
 skipped in CI because seeds come from the clock):
 8 files,
 359 passed,
 8 expected failures,
 0 unexpected failures (13.7 s).

libFuzzer targets written for this audit with the linter's option sets
 (`lab/fuzzproj/fuzz/fuzz_targets/`),
 each parsing every UTF-8 input in Markdown mode and in MDX mode,
 seeded with 356 corpus documents,
 `-max_len=8192 -timeout=10 -rss_limit_mb=1536`,
 AddressSanitizer,
 repository nightly.
A first run per target stopped at its first crash;
 four 600-second runs followed in fork mode with `-ignore_crashes=1`,
 in cargo-fuzz's default mode (optimized with debug assertions and overflow checks,
 as a dev-profile build checks)
 and with `-O` (release semantics).
All 93 artifacts were replayed and grouped by site (`scripts/fuzz-triage.ts`,
 `data/fuzz-triage.jsonl`):

- markdown-rs:
   292,991 executions with debug assertions,
   30 crashes,
   5 sites
   (`construct/list_item.rs:444` subtract overflow,
   `to_mdast.rs:193`,
   `to_mdast.rs:216`,
   `to_mdast.rs:1277`,
   `to_mdast.rs:1817`);
   279,207 executions in release,
   23 crashes,
   5 sites
   (the four `to_mdast.rs` sites and `util/skip.rs:56` index out of bounds);
   6 distinct sites,
   no timeouts.
  The first-run crash,
   YAML frontmatter followed by NUL bytes and a list,
   panics in release at `util/skip.rs:56:26`.
- Sätteri:
   332,075 executions with debug assertions,
   12 crashes,
   all the `debug_assert!(false, ...)` at `post_passes.rs:1544`
   ("build_raw_map failed to reconstruct a text value from its source span"),
   whose release output equals npm's;
   335,887 executions in release,
   2 crashes at `firstpass.rs:863`
   (a string slice in MDX ESM scanning);
   24 timeouts across both runs.

Every Sätteri finding was replayed in Markdown and in MDX mode through the release probes and through npm 0.10.5
 (`scripts/replay-findings.ts`,
 `data/fuzz-replay/results.jsonl`,
 at most 120 s each):

- Markdown mode:
   all 13 inputs parse in at most 1 ms in every engine.
- MDX mode,
   inputs of 1.2 KiB to 3.9 KiB,
   all invalid MDX:
   Sätteri needs over 5 s on 11 of 13,
   where 9 end in an MDX error after 5.6 to 80.6 s and 2 do not finish within 120 s;
   the other 2 panic at `firstpass.rs:863` within 0.2 s,
   which a Rust caller can catch.
  npm 0.10.5 shows the same shape:
   over 5 s on 10 of 13,
   2 of them not finishing within 120 s,
   and a Node process abort (exit 134) on the 2 panic inputs.
  markdown-rs returns an MDX error on each in about 0.1 s.

Known upstream panic reports replayed through the release probes
 (`scripts/build-stress.ts`,
 `data/stress-results.jsonl`):

- markdown-rs panics on 8 of 9 inputs from open reports
   (pull requests #208 to #211 and #219):
   `to_mdast.rs:193:44` on four setext shapes,
   `subtokenize.rs:149:57` on two link shapes,
   and `to_mdast.rs:1277:9` on two MDX setext headings with unclosed JSX.
  Issue #213's input panics only with overflow checks,
   which the repository's dev-profile `lint:rust` builds have.
- Sätteri:
   0 panics on the same 9 inputs;
   the two MDX inputs return MDX errors.
- markdown-syntax:
   0 panics.

Super-linear time (in-process parse time of the release probe):

- 1 MiB of GFM tables:
   Sätteri 14 ms,
   markdown-rs 34,944 ms (matching wooorm/markdown-rs#218),
   markdown-syntax 69 ms.
- 256 KiB of tables:
   4 ms,
   2,390 ms,
   and 20 ms.
- 100,000 `[`:
   7 ms,
   2,605 ms,
   and 15,916 ms.

Deep nesting,
 through the minimal binaries,
 which do not recurse in the consumer,
 at an 8 MiB stack (`scripts/stack-attribution.ts`):

- Sätteri parses a 100,000-deep block quote,
   a 50,000-deep list,
   100,000 `*` around one word,
   and 20,000 nested JSX elements,
   each within 5 s of container wall time.
- markdown-rs parses all four but needs 115.6 s,
   369.4 s,
   and 182.5 s on the first three.
- markdown-syntax overflows its stack and aborts on the first three.

The parity probes' own recursive JSON builders overflowed on these inputs,
 so the aborts in the first stress pass belong to the probes,
 not to Sätteri or markdown-rs.

### E7: build size, compile time, and MSRV

Minimal binaries (`lab/min-*`):
 read stdin,
 parse with the linter's options,
 print a count;
 repository release profile and nightly;
 a clean target directory per build;
 three release rounds and one dev build,
 nothing else running
 (`scripts/build-matrix.ts`,
 `data/builds.jsonl`).

- Baseline without a parser:
   release 1.8 s (1.76 to 1.88),
   299,952 bytes;
   dev 0.3 s.
- markdown-rs:
   release 5.0 s (4.96 to 5.03),
   924,936 bytes (625 KB over baseline);
   dev 1.2 s.
- markdown-syntax:
   release 7.7 to 9.1 s,
   650,240 bytes (350 KB over baseline);
   dev 1.4 s.
- Sätteri:
   release 37.5 to 40.3 s,
   1,703,376 bytes (1.40 MB over baseline);
   dev 28.5 s,
   40,499,624 bytes unstripped;
   needs a C toolchain for `psm`.

MSRV:

- Sätteri's crates declare no `rust-version`;
   edition 2024 needs 1.85,
   and upstream pins 1.95.0 in `rust-toolchain.toml`.
- markdown-rs declares `rust-version = "1.56"`;
   the consumed library built on 1.86.0,
   1.98.1,
   and the repository nightly.
- markdown-syntax declares 1.82.
- Every finalist builds on the repository nightly,
   the only toolchain the linter uses.

### E8: parse speed

Each release probe parsed the whole 19.5 MB corpus five times;
 the sum of in-process parse times per run,
 JSON output excluded (`scripts/timing.ts`,
 `data/timing.jsonl`):

- Sätteri:
   141 to 223 ms.
- markdown-syntax:
   1,791 to 3,381 ms.
- markdown-rs:
   3,328 to 3,506 ms.

The bands do not overlap,
 so the ordering is outside run-to-run noise;
 the absolute numbers come from a 2-CPU container.

### E9: license, dependency surface, and human auditability

- Sätteri:
   MIT (repository `LICENSE`,
   Copyright 2026 Bruits;
   `satteri-pulldown-cmark` also carries pulldown-cmark's MIT notice).
  The `satteri-arena` and `satteri-ast` archives ship no license file,
   only `license = "MIT"`,
   so adoption carries the repository notice.
  Compatible with LGPL-3.0-or-later.
  Consumed source:
   32,635 code lines in 55 files (largest file 5,268 lines).
  Compiled closure of the minimal binary:
   94 third-party crates on normal edges,
   100 with build dependencies;
   602,515 Rust code lines plus 1,243 lines of GNU assembly across `psm`'s architectures;
   16 build scripts,
   11 procedural macros,
   `oxc_*` 0.121.0 for MDX ESM and expression parsing,
   and `icu_segmenter` data.
  Same-author crates:
   `satteri-property-info`.
- markdown-rs:
   MIT (`license` file,
   Copyright 2022 Titus Wormer).
  Consumed source:
   27,891 code lines in 80 files (largest file 9,371 lines).
  Compiled closure:
   `markdown` plus `unicode-id`,
   29,529 code lines,
   no build script,
   no procedural macro.
- markdown-syntax:
   MIT OR Apache-2.0;
   15,060 code lines in 17 files,
   `parse.rs` alone 8,239 lines;
   no dependencies.
- `unsafe` mentions in consumed source:
   Sätteri 6,
   markdown-rs 3,
   markdown-syntax 0.

Advisories (RustSec `advisory-db` `crates/` directory and the GitHub advisory API,
 2026-09-24):
 none for any finalist;
 `RUSTSEC-2022-0044` concerns the retired `markdown` 0.3 line and was withdrawn on 2025-04-28.

### E10: maintenance, bus factor, and security disclosure

Method:
 issues created or updated since 2025-09-23
 (all when at most 20,
 else the 10 most recently updated),
 maintainer comments counted apart from maintainer actions;
 the 10 most recently updated pull requests;
 releases;
 `git shortlog` on full clones
 (`scripts/maintenance.ts`,
 `data/maintenance.jsonl`).

Sätteri (`bruits/satteri`,
 created 2026-03-22):

- 94 issues in the window,
   30 open.
  Sample of 10:
   maintainer comments on 6,
   maintainer closures on 2;
   one maintainer account (Princesseuh).
- Pull requests:
   4 of 10 merged,
   latency 0.2 to 15.3 days,
   including two external fixes merged after approval;
   open are three maintainer pull requests,
   two external fixes,
   and release pull request #287,
   open since 2026-08-24.
- Releases:
   75 GitHub releases across the workspace's packages,
   the last batch 48 tags on 2026-08-18 and 2026-08-19,
   none since;
   `satteri-pulldown-cmark` has 27 versions since 2026-04-05.
  Four commits touching the parser crates are unreleased
   (`af7e7ed`,
   `d4be776`,
   `4171b78`,
   `5a49ee3`).
- Concentration:
   252 of 339 non-merge commits by one person (commit names Princesseuh and Erika,
   one GitHub account),
   47 by a release bot,
   and 40 by 18 other people;
   since 2026-06-23,
   90 of 125.
- Security:
   `SECURITY.md` promises acknowledgement within 48 working hours.
  Issue #306 (2026-09-19) reports two private advisories
   (`GHSA-7hg6-666q-rcf7`,
   `GHSA-hx2j-xq45-6xpw`)
   left unacknowledged after a follow-up;
   the maintainer answered the same day that notifications were not reaching her.
  No advisory is published,
   so the affected component is unknown.

markdown-rs (`wooorm/markdown-rs`):

- 16 issues in the window,
   8 open;
   maintainer comments on 13,
   closure actions on 6;
   maintainers wooorm,
   ChristianMurphy,
   and kwonoj.
- Pull requests:
   0 of 10 merged,
   including 4 maintainer regression tests for panics,
   one approved external change,
   and a panic fix (#219).
- Releases:
   1.0.0 on 2025-04-23,
   none since;
   the last commit is the release commit.
- Concentration:
   545 of 577 non-merge commits by Titus Wormer;
   32 commits in the last 24 months.
- Open robustness reports:
   quadratic tables (#218),
   panics (#139,
   #213,
   #208 to #211).

markdown-syntax (`plimeor/markdown-syntax`):
 17 commits by one author from 2026-06-20 to 2026-07-05,
 no issues,
 no stars.

### E11: API churn and pinning

- Sätteri:
   `satteri-pulldown-cmark` 27 versions across 6 minor lines in 4.5 months,
   `satteri-ast` 24 across 5,
   `satteri-arena` 10 across 3;
   pre-1.0,
   so each minor line may break the API;
   no stated Rust API stability policy.
  The tree is a flat arena with typed decoders for node data
   (`satteri-ast-0.5.3/src/mdast/codec.rs`),
   not an mdast struct tree.
  It depends on `oxc_*` 0.121.0 while `oxc_parser` is at 0.151.0,
   so an `oxc` fix reaches the linter only through a Sätteri release.
- Pinning strategy for Sätteri:
   exact `=` requirements on all three crates,
   upgraded together because they release from one commit;
   `Cargo.lock` pins the transitive tree;
   an upgrade lands only after the E1,
   E3,
   and E4 harness reports zero differences against the previous pin.
- markdown-rs:
   stable 1.0.0 API,
   no release in 17 months.

## Hard-gate outcomes

- Sätteri's Rust crates:
   HC1 pass (Rust crates,
   no Node;
   see "Unresolved preferences" for the assembled `psm` shim);
   HC2 to HC4 pass (node types in `satteri-ast-0.5.3/src/mdast/generated/node_types.rs`,
   exercised in E1);
   HC5 pass with one adapter duty,
   adding the BOM length;
   HC6 pass;
   HC7 pass;
   HC8 pass (E3 137 of 137,
   E4 1,264 of 1,264);
   HC9 pass.
- markdown-rs:
   HC1 to HC7 pass,
   HC2 only with a consumer-supplied ESM callback;
   HC9 pass;
   HC8 fail (E3 136 of 137,
   E4 2 files).
- markdown-syntax:
   HC1 to HC4,
   HC6,
   HC7,
   and HC9 pass;
   HC5 fail (E2);
   HC8 fail (E3 126 of 137).
- Every other candidate exits in "Discovery ledger".

## Finalist validation

- Sätteri:
   validated.
  Default CI green on its pinned toolchain,
   Rust tests green on stable and nightly,
   JavaScript test and fuzz suites green,
   and the consumer boundary identical.
  Open items on the consumed surface,
   carried into scoring and risks rather than rejection,
   because the incumbent shares each of them:
   the release panic at `firstpass.rs:863` and the slow MDX error paths (E6).
  The debug assertion at `post_passes.rs:1544` fires only in builds with debug assertions.
- markdown-rs:
   validation complete,
   rejected on HC8 at the consumer boundary.
- markdown-syntax:
   rejected on HC5 and HC8.

## Score arithmetic

Only Sätteri is a validated finalist,
 so only Sätteri is scored.

- SC1 (weight 5):
   4,
   high;
   no difference on 1,420 inputs,
   one known adapter duty (the BOM).
- SC2 (weight 1):
   low-signal range 1 to 2,
   midpoint 1.5;
   no panic on Markdown input in release,
   linear on large tables and deep nesting,
   but MDX error paths take seconds to minutes on 1 to 4 KiB inputs,
   one release panic site,
   and one debug-assertion site.
- SC3 (weight 1):
   2,
   medium;
   frequent merges,
   one maintainer.
- SC4 (weight 1):
   1,
   medium;
   two private reports unacknowledged until a public issue.
- SC5 (weight 1):
   1,
   high;
   about 600,000 lines and 94 crates compiled.
- SC6 (weight 1):
   2,
   medium;
   about 38 s of clean release build on 2 CPUs,
   1.4 MB,
   and a C toolchain.
- SC7 (weight 1):
   1,
   high;
   27 releases and 6 breaking lines in 4.5 months.
- SC8 (weight 1):
   4,
   high;
   141 to 223 ms for the corpus.
- SC9 (weight 1):
   2,
   medium;
   byte offsets and node data are available,
   but the port needs its own typed view over the arena and the BOM adjustment.

```text
# doc/audit/tech-unified-linter-markdown-parser-vet-2026-09-23.md
earned  = 5 * 4 + 1.5 + 2 + 1 + 1 + 2 + 1 + 4 + 2 = 34.5
maximum = 52
score   = 34.5 / 52 * 100 = 66.3
range   = 34 / 52 = 65.4 (SC2 at 1) to 35 / 52 = 67.3 (SC2 at 2)
```

## Sensitivity

With one scored finalist no weight or rating change can reorder finalists;
 every other position in the ranking comes from a hard-gate result,
 which no weight reaches.
The one-at-a-time matrix moves only Sätteri's own score:

- Raising one weight-1 criterion to 5 (maximum 68):
   SC8 74.3;
   SC3,
   SC6,
   or SC9 62.5;
   SC2 59.6;
   SC4,
   SC5,
   or SC7 56.6.
- Moving one medium-confidence rating one step (SC3,
   SC4,
   SC6,
   or SC9):
   64.4 or 68.3.
- SC2 range endpoints:
   65.4 and 67.3.

Aggregate range over the one-at-a-time tests:
 56.6 to 74.3.
Stability does not cover simultaneous multi-input changes.

## Pros and cons

### Sätteri's Rust crates

Pros:

- The only candidate that meets HC8:
   zero differences from the incumbent in 619,729 nodes,
   137 of 137 tests,
   and 1,264 of 1,264 repository files.
- It is the incumbent's own engine,
   so the port changes the host language and not the Markdown semantics.
- Linear on the table,
   bracket,
   and deep-nesting inputs where markdown-rs is quadratic or takes minutes.
- No panic on the markdown-rs panic reproductions.
- About 15 to 25 times faster than markdown-rs on the corpus.
- Upstream tests are extensive (2,082 Rust tests,
   3,114 JavaScript tests,
   359 differential fuzz properties)
   and green on the pinned toolchain.

Cons:

- Invalid MDX of a few KiB can take up to minutes and one site panics;
   the incumbent has the same behavior,
   so parity carries it into the port.
- One maintainer writes about 86% of human commits.
- Two private vulnerability reports went unacknowledged until a public issue,
   and their content is unknown.
- About 600,000 compiled lines,
   94 crates,
   11 procedural macros,
   and an assembled `psm` shim,
   for a parser whose own source is about 33,000 lines;
   about 38 s of clean release build.
- Pre-1.0 churn:
   a breaking line roughly every three weeks,
   and `oxc` 0.121 lagging 30 minor versions.
- Offsets are relative to a BOM-stripped source.
- The arena API is lower level than an mdast tree.

### markdown-rs

Pros:

- Two crates and about 30,000 compiled lines,
   no build script,
   no procedural macro,
   5 s of clean release build.
- Stable 1.0 API;
   a direct mdast enum with byte offsets;
   absolute offsets with a BOM.
- Fast MDX error reporting on the inputs that slow Sätteri down.
- Maintainers respond on the tracker.

Cons:

- Fails HC8:
   one frozen test and two repository MDX files,
   caused by nesting an autolink inside a link.
- 1,176 of 1,400 documents differ from the incumbent in offsets,
   mostly list and list-item ends,
   so future documents can change findings.
- Eight reachable panics from open reports,
   6 more distinct panic sites found in 20 minutes of fuzzing,
   quadratic tables (35 s for 1 MiB),
   and minutes on deep nesting.
- No release or merged pull request in 17 months;
   today's dependency resolution breaks its own test build.
- ESM needs a JavaScript parser in the callback to match Sätteri.

### markdown-syntax

Pros:

- No dependencies,
   15,060 lines,
   MIT OR Apache-2.0.
- Covers MDX,
   GFM,
   YAML,
   and TOML in one tolerant parser.

Cons:

- Inline offsets are wrong after the first line of a paragraph and inside containers,
   and table cells have no span (HC5).
- JSX is a raw string with no children.
- 11 of 137 frozen tests fail.
- Stack overflow aborts on deep nesting.
- One author,
   17 commits over two weeks,
   no users on the tracker.

## Complete ranking

1.  Sätteri's Rust crates
    (`satteri-pulldown-cmark` 0.6.3,
    `satteri-arena` 0.3.1,
    `satteri-ast` 0.5.3).
2.  `markdown` (markdown-rs) 1.0.0.
3.  `markdown-syntax` 0.2.0.
4.  npm `satteri` 0.10.5 kept through Node.
5.  One capability gate failed at targeted evidence:
    `ferromark` 2.1.1,
    `dmc-parser` 0.3.6,
    `unifast-core` 0.0.10 (HC7);
    `ptdgrp-markdown` 1.1.4 (HC2).
6.  Two gates failed at targeted evidence:
    `ox_content_parser` 3.2.8,
    `oxc-markdown-parser` 0.0.2,
    `omni-mdx` 1.1.0,
    `kyle-mccarthy/mdx-rs`,
    `mdxor/compiler`.
7.  Three gates failed at targeted evidence:
    `mdx` 0.0.4,
    `hypernote-mdx`.
8.  HC2 exits by metadata:
    `comrak` 0.55.0,
    `pulldown-cmark` 0.13.4,
    and 315 other parsers.
9.  Category mismatches.

Reasons for each adjacent order:

- 1 over 2:
   both passed HC1 to HC7 and HC9 and received the same validation;
   Sätteri passes HC8 and markdown-rs fails it.
- 2 over 3:
   both fail HC8,
   markdown-rs on 1 test and 2 files,
   markdown-syntax on 11 tests;
   markdown-syntax also fails HC5 with offsets that are wrong at source level.
- 3 over 4:
   markdown-syntax is a Rust library that can run in the port;
   the incumbent fails HC1 by needing Node,
   the requirement that starts this work.
- 4 over 5:
   both fail one gate,
   but the incumbent's failure is its runtime,
   while its behavior defines HC8;
   group 5 lacks node kinds or MDX constructs the rules need and was never validated.
- 5 over 6:
   one failed gate against two.
- 6 over 7:
   two failed gates against three.
- 7 over 8:
   group 7's failures are confirmed from source after an MDX signal;
   group 8 has no MDX construct at all.
- 8 over 9:
   group 9 is not a Markdown parser.

Members within groups 5 to 9 fail comparable gates and are unordered.

## Confidence and evidence limits

- The consumer-boundary runs replace npm Sätteri under the TypeScript rules;
   the Rust port will reimplement the rules,
   so HC8 here proves the parser side of parity,
   not the port.
- Line and column in the shim come from offsets,
   so a finalist's own line and column fields were not tested;
   the port computes them from byte offsets anyway.
- Sätteri's two private advisories are unknown in content and component.
- The corpus is this repository's Markdown plus the unit inputs and 20 synthetic cases;
   syntax absent from it is covered only by upstream tests and fuzzing.
- Fuzzing ran 10 minutes per target and mode,
   single seeds,
   with AddressSanitizer;
   crash counts are lower bounds.
- markdown-rs was configured with an accepting ESM callback;
   an `oxc`-based callback would remove one divergence class,
   not the HC8 failure.
- The incumbent's prebuilt napi binary was not re-audited for provenance,
   because the port replaces it with a source build.
- The web source class offers no pagination;
   it served as corroboration,
   and every published crate it named also came through crates.io.
- Timing numbers come from a 2-CPU container and are relative,
   not absolute.

## Recommendation

Recommend Sätteri's Rust crates:
 `satteri-pulldown-cmark` 0.6.3,
 `satteri-arena` 0.3.1,
 and `satteri-ast` 0.5.3,
 all from `bruits/satteri` commit `5df21fc0cead783853a8959c641d9c241d0037b6`,
 pinned with `=`.
The recommendation holds only if the user accepts the build-time `cc` assembly of `psm`
 (see "Unresolved preferences");
 if not,
 no candidate is recommendable.

Material risks,
 each accepted by choosing this candidate:

- Security disclosure:
   two private reports sat unacknowledged (bruits/satteri#306).
  Before adoption,
   confirm with upstream whether `GHSA-7hg6-666q-rcf7` or `GHSA-hx2j-xq45-6xpw` touches the three crates,
   or vendor them;
   contacting upstream needs the user's authorization.
- Hook hangs on malformed MDX:
   invalid MDX of 1 to 4 KiB can take seconds to minutes (E6),
   as it does in the incumbent today.
  Parse MDX under a time budget the linter controls,
   for example in a child process the hook can stop.
- Panics:
   one release panic site in MDX ESM scanning (`firstpass.rs:863`),
   which the incumbent turns into a Node process abort;
   in Rust,
   parse inside `catch_unwind` with `panic = "unwind"` (the linter profile's default)
   and report a `markdown-lint-error` finding.
  Builds with debug assertions,
   such as the dev-profile `lint:rust` tasks,
   also panic at `post_passes.rs:1544`,
   so hooks should run the release build.
- Maintenance concentration and churn:
   one maintainer,
   a breaking line about every three weeks,
   and `oxc` 0.121 frozen behind Sätteri's releases.
- Dependency surface:
   about 600,000 compiled lines for about 33,000 lines of parser.

Integration notes for the Markdown language plugin:

- Build the flags explicitly:
   `ENABLE_TABLES | ENABLE_STRIKETHROUGH | ENABLE_TASKLISTS | ENABLE_GFM | ENABLE_FOOTNOTES`
   `| ENABLE_YAML_STYLE_METADATA_BLOCKS | ENABLE_PLUSES_DELIMITED_METADATA_BLOCKS`,
   plus `ENABLE_MDX` for `.mdx`.
  Never use `DEFAULT_OPTIONS`,
   which enables math and omits TOML (`arena_build.rs:33-41`).
- Treat a non-empty MDX error list from `parse` as the processing failure npm throws,
   reported as `markdown-lint-error`.
- Offsets are UTF-8 bytes relative to the BOM-stripped source:
   add 3 when the file starts with U+FEFF,
   and do not port `correct-astral-offsets.ts`.
- Compute line and UTF-16 column from byte offsets in the linter,
   matching the columns the incumbent reports.
- Read node data through the `satteri_ast::mdast` decoders
   (`decode_heading_data`,
   `decode_code_data`,
   `decode_reference_data`,
   and the rest)
   behind the plugin's own typed view over the arena.
- Keep the parity harness as the upgrade gate:
   corpus tree parity,
   the ported unit tests,
   and the whole-repository differential against the previous pin
   (`lab/parity/` and `lab/boundary/` in the scratch root are the starting point).
- Fallback if Sätteri stalls:
   markdown-rs 1.0.0 with the E2 divergence classes and the E6 panic sites patched,
   which would need the user's answer on "Exactness versus an owned patch".

## Adoption boundary

This evaluation wrote only this report.
It changed no product code,
 dependency,
 configuration,
 or decision record.
A later action request that adopts a candidate authorizes the decision document,
 which should record the pins,
 the integration notes and material risks in "Recommendation",
 the parity harness as the upgrade gate,
 and markdown-rs with its E2 divergence list as the fallback.
