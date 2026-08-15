# Famous parser precedents for cli-git's partial Git argv contract

## Research status

- Status: in progress
- Started: 2026-08-14
- Scope: widely adopted TypeScript-authored parser APIs with native ESM runtimes,
  plus one token-stream semantic control
- Product changes: forbidden by the review request

## Question

Does a widely adopted parser naturally express cli-git's partial Git argv contract,
or is the repository-owned scan necessary because no established API exposes the right information?

This is a broader follow-up to
`doc/audit/tech-cli-git-command-line-argument-parser-replac-vet-2026-08-14.md`.
That audit remains the deciding evidence for Jackspeak,
type-flag,
and Argue.
The present note does not reopen or rescore those packages.

## Technology hard gates

The candidate parser implementation must be authored in TypeScript and publish a native ESM runtime.
A generated ESM build from TypeScript source passes.
A CommonJS-only runtime,
an ESM wrapper around a CommonJS parser,
or JavaScript source supplemented by declaration files fails.
Parser-core runtime dependencies must meet the same condition.
A package may also publish CommonJS as long as cli-git imports its direct ESM build.

This gate excludes Node `util.parseArgs`,
Commander,
minimist,
and Arg from evaluation despite their adoption.
Their implementations are not TypeScript-authored parser packages satisfying the user's constraint.
They may appear only as ecosystem context and are not probed,
rated,
or ranked.

## Frozen contract

A natural fit must expose enough information to derive all of these facts without reparsing raw argv:

- exact declared aliases rather than prefix-normalized aliases;
- occurrence counts and ordered repeated values;
- options after positionals;
- bare `-` as positional and `--` as explicit option termination;
- separated dash-led values for declared string options;
- failure for a declared string option missing its value;
- exact unknown plain and joined option spelling;
- original token order and boundaries;
- a distinction between unknown options and ordinary positionals;
- no diagnostic work for ordinary unmatched pathspecs.

Unknown option arity is not knowable from a partial schema.
cli-git's current contract uses one documented conservative rule:
an unknown plain option tentatively consumes one following non-dash token,
while command-specific consumers may scan known arity separately.
A parser need not know Git's complete grammar,
but it must preserve enough evidence for that rule without another lexical scan.

A small fold over an ordered token stream counts as natural expression.
Inspecting raw argv again to recover prefixes,
termination,
order,
or unknown roles does not.

## Discovery pool

The TypeScript and ESM source-screening pool is bounded to current packages found through the frozen searches:

- `yargs-parser@22.0.0`,
  963,969,688 npm downloads in the last-month window;
- `cac@7.0.0`,
  176,248,671 downloads;
- `citty@0.2.2`,
  111,665,083 downloads;
- `@oclif/core@4.13.5`,
  38,706,824 downloads;
- `clipanion@4.0.0-rc.4`,
  18,970,325 downloads;
- `cleye@2.6.0`,
  1,820,335 downloads;
- `cmd-ts@0.15.0`,
  976,767 downloads;
- `@clerc/core@1.3.1`,
  329,703 downloads;
- `gunshi@0.37.1`,
  261,421 downloads;
- `args-tokens@0.28.1`,
  36,488 downloads.

The npm measurements use the official point-download endpoint,
queried on 2026-08-14.
They establish adoption rather than package quality.
Packages advance to behavioral evaluation only when source confirms the technology hard gates
and their API documents partial,
unknown,
pass-through,
or token-stream parsing.

`@optique/core` is retained only as incumbent-history evidence.
cli-git already replaced it after a measured unmatched-token diagnostic regression,
so it is not a new candidate.
CAC 7 has its own completed audit at
`doc/audit/tech-cli-git-parser-migration-to-cac-vet-2026-08-14-a48b54e2.md`.
Its parser core inlines JavaScript-authored MRI,
so the new technology gate excludes it without reopening that audit.

## Primary-source leads

- CAC completed audit:
  `doc/audit/tech-cli-git-parser-migration-to-cac-vet-2026-08-14-a48b54e2.md`
- yargs-parser documentation and source:
  <https://github.com/yargs/yargs-parser/tree/66f0bb2d2c8a2c9689489784cfe2e5128b0abfc2>
- Citty documentation and source:
  <https://github.com/unjs/citty>
- Clipanion documentation and source:
  <https://github.com/arcanis/clipanion>
- Cleye documentation and source:
  <https://github.com/privatenumber/cleye>
- cmd-ts documentation and source:
  <https://github.com/Schniz/cmd-ts>
- Clerc documentation and source:
  <https://github.com/clercjs/clerc>
- Gunshi documentation and source:
  <https://github.com/kazupon/gunshi>
- args-tokens documentation and source:
  <https://github.com/kazupon/args-tokens>

## Source-screening hypotheses

### yargs-parser

`unknown-options-as-args`,
`short-option-groups: false`,
`nargs-eats-options`,
`populate--`,
and duplicate-array settings appear unusually configurable.

Expected concern:
the result is a key/value object plus positional arrays rather than an ordered token stream.
Alias names may also lose one-dash versus two-dash evidence.

### Full CLI frameworks

Citty,
Clipanion,
Cleye,
cmd-ts,
Clerc,
and Gunshi are source-screened before execution.
A framework exits if its parser core is JavaScript or CommonJS,
if a parser-core dependency fails the technology gate,
or if its documented API only accepts a closed application-owned grammar.

### args-tokens

`parseArgs()` returns ordered source-indexed tokens before schema resolution,
and `resolveArgs()` separately applies an option schema.

Expected concern:
it is not widely adopted,
and its tokenizer may still require raw-argv recovery for exact short tokens or unknown arity.

## Source-screening outcomes

### Advanced to artifact probes

- `yargs-parser@22.0.0` is TypeScript-authored,
  native ESM,
  dependency-free,
  and documents unknown-options-as-args plus configurable short grouping and nargs behavior.
- `@clerc/parser@1.3.1` and `@clerc/utils@1.3.1` are TypeScript-authored native ESM packages.
  The parser explicitly returns parameters,
  post-terminator values,
  normalized unknowns,
  and raw unknown argv.
- `args-tokens@0.28.1` is a dependency-free TypeScript-authored native ESM token parser.
  It advances only as the semantic control because its measured adoption is lower than the famous candidates.

### Exited before artifact probes

- CAC 7 inlines JavaScript-authored MRI in its parser core and fails the technology gate.
- Citty 0.2.2 is TypeScript-authored ESM,
  but `src/_parser.ts` delegates token interpretation to Node `util.parseArgs` and returns no token stream.
  The implementation therefore fails the parser-core TypeScript gate and cannot preserve unknown roles.
- `@oclif/core@4.13.5` publishes a CommonJS runtime and fails native ESM.
- Clipanion exposes parse tokens,
  but ordinary unknown options lead to its unsupported-option error.
  `Option.Proxy` accepts passthrough only by permanently stopping option parsing after proxy mode begins.
- Cleye directly delegates parsing to the already-rejected type-flag iterator and inherits its dash-led value behavior.
- cmd-ts builds ESM from TypeScript,
  but its public parser returns unknown AST nodes as an `Unknown arguments` error.
  The useful tokenizer and AST functions are internal,
  and its parser imports the CommonJS `debug` runtime.
- Gunshi exposes raw argv and args-tokens output to handlers,
  but its parser hardcodes grouped short-option resolution.
  Recovering cli-git's exact generic spelling requires a handler to reclassify raw argv.

## Execution manifest

### Published-artifact semantic probe

Candidates and exact artifacts:

- `yargs-parser@22.0.0`,
  registry integrity
  `sha512-rwu/ClNdSMpkSrUb+d6BRsSkLUq1fmfsY6TOpYzTwvwkg1/NRG85KBy3kq++A8LKQwX6lsu+aWad+2khvuXrqw==`;
- `@clerc/parser@1.3.1`,
  registry integrity
  `sha512-e1rb82ENJNfZYjkf5tR7OcsmwNShINJumxfy7fS9SYypSZNRbQmzHj7k7miQ3u+Mfc08fpBtvpAGqeBWQKQxRQ==`;
- `@clerc/utils@1.3.1`,
  registry integrity
  `sha512-wkK6daYkmTQKnhSADMkunfDhNJI6rRCn2R++7cI2EoEBmOZWYqn7frkk5ac7zsxBi0Mc3UnMVaJiNFU+t6PPWQ==`;
- `args-tokens@0.28.1`,
  registry integrity
  `sha512-2L4pJA8XcdRCqkNb5budSdbifzFP0iXexM1rF27kKLp8tWYfzGDV6BaAeBmrU6YLKct3Gt6Kn0njlAogJAdI6w==`.

Top-level command:

```text
podman run [bounded read-only options] docker.io/library/node:24-slim node /probe/probe.ts
```

Subordinate command tree:

```text
node /probe/probe.ts
```

The native ESM TypeScript module imports each extracted published artifact and runs the same argv catalog.
Node executes it through built-in type stripping.
No package lifecycle script or candidate subprocess runs.

Working directory:
`/probe`.

Environment:

- `HOME=/tmp/home`;
- inherited locale from the image;
- no credentials or repository environment forwarded.

Filesystem effects:

- host inputs mounted read-only;
- container root read-only;
- disposable 64 MiB `/tmp` tmpfs;
- no repository write;
- captured output written only under `~/temp/agent` by the host command.

Network effects:
none during execution because the container uses `--network none`.

Privilege and resource bounds:

- all capabilities dropped;
- no-new-privileges enabled;
- 2 GiB memory;
- 2 CPUs;
- 128 processes;
- 1,024 file descriptors.

Input families:

- ordinary known flag,
  value,
  and positional positive control;
- repeated known flags and values;
- option after positional;
- bare dash and option terminator;
- joined value;
- separated dash-led value;
- missing declared value;
- unknown plain option with following plain token;
- unknown joined option;
- exact-prefix traps `--a` and `-all` against declared `-a` and `--all`.

Expected outputs:
structured JSON containing each candidate's returned result or exact thrown error.

Expected failure modes:

- artifact integrity mismatch before execution;
- import incompatibility with Node 24;
- semantic mismatch visible in returned structure;
- parser-thrown missing-value or unknown-option errors.

State mutation:
none beyond disposable scratch downloads,
artifact extraction,
and probe output.

Rollback:
remove the scratch candidate directories and probe files.

Authentication prerequisites:
none.
