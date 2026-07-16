# Optique removal handover

## Status

Planning and user grilling are in progress.
No parser implementation or consumer migration is authorized until the user confirms shared understanding.

Keep this handover current when requirements,
decisions,
evidence,
rejected designs,
or the next action change.

## User intent

- Replace Optique with a repository-owned parser based on Valibot.
- Migrate existing Optique consumers,
  except `package/git-policy/cli/`.
- Include the paused consumer under `package-paused/dev-script/inference-canary/`.
- Do not expand this migration to handwritten parsers that do not use Optique.
- Preserve historical troubleshooting records,
  marking superseded recommendations where appropriate rather than deleting durable evidence.
- Settle observable parser results and grammar before choosing implementation architecture.
- Ask one decision question at a time.
- Demonstrate every concept in an option comparison with a concrete sketch.

## Settled scope

The active workspace has thirteen non-cli-git manifests declaring an Optique dependency.
`package/cli/mutation-test/package.json` has no matching source import and appears to contain stale dependencies.

Current non-cli-git source imports occur in twenty-one TypeScript files across these consumers:

- `package/build-tool/css/`
- `package/claude-code-plugin/source/`
- `package/cli/fy/`
- `package/cli/git-clone-size/`
- `package/cli/mvm/`
- `package/cli/vmsync/`
- `package/dev-script/backup-path/`
- `package/dev-script/task-util/`
- `package/dev-script/watch-restart/`
- `package/module/image-diff/`
- `package/module/token-count/`
- `package/pi-plugin/spawn/`

`package/test-fixture/oxlint-no-restricted-syntax/` also imports Optique as a lint fixture.
The migration must replace that fixture without changing the rule it tests.

`package/git-policy/cli/` is explicitly out of scope,
including concurrent work replacing its parser.
Do not edit,
move,
or absorb that work into this migration.
Optique catalog and lockfile entries may therefore remain while cli-git still needs them.
Success is no Optique dependency or import outside cli-git,
not zero repository-wide string matches.

## Current result-shape proposal

The user prefers a command grammar whose structured options precede a required `--` separator.
Every token after the separator is captured without option interpretation:

```text
image-tool compare
  [-p, --provider voyage|gemini]
  [-t, --tag <TAG> [<TAG> ...]]
  [--json]
  -- <1> <2> [<3> ...]

image-tool cmp ...    hidden alias for compare
```

The proposed successful result is:

```ts
{
  commandPath: ['compare'],
  trailingArguments: ['a.png', 'b.png'],
  provider: 'voyage',
  tags: ['release', 'nightly'],
  json: true,
}
```

The proposed static shape is:

```ts
type CompareArgs = Readonly<{
  commandPath: readonly ['compare'];
  trailingArguments: readonly [string, string, ...string[]];
  provider?: 'voyage' | 'gemini';
  json?: true;
  tags?: readonly [string, ...string[]];
}>;
```

Valibot `1.4.2` can represent the non-empty tuple tail directly:

```ts
const trailingArgumentsSchema = v.tupleWithRest(
  [
    v.string(),
    v.string(),
  ],
  v.string(),
);
```

This proposal deliberately avoids assigning semantic field names to tail positions.
The parser should preserve tail order and accept dash-led values after `--` verbatim.
The command alias `cmp` should canonicalize to `commandPath: ['compare']` and remain absent from generated help.

## Settled result-shape decisions

- `provider` is omitted when `--provider` is absent.
  The parser does not choose a provider or implement the command's business policy.
- `trailingArguments` preserves a schema-constrained tail after `--`.
- Commands accept arguments only through a required `--` separator.
  Options occur before it;
  every later token is preserved as tail data without option interpretation.
- The shared parser has no named-positional feature.
  Commands without arguments require no separator.
- Each command's syntax-level Valibot schema defines its tail cardinality.
- Presence flags use absent-or-`true` rather than always-present booleans.
- Collection-valued option output uses an optional non-empty tuple.
  For example,
  absent `--tag` omits `tags`,
  while one valid occurrence can produce `tags?: readonly [string, ...string[]]`.
- Repeating `--tag` is invalid.
  Output cardinality does not imply repeated option occurrences.
- One `--tag` occurrence consumes one or more plain argv tokens until the next option or final `--`.
  A dash-led token ends the collection and is interpreted as an option.
  Dash-led tag values are not supported by this syntax.
- Every declared option may occur at most once,
  regardless of whether repeated occurrences use the same spelling or different aliases.
  Duplicate scalar,
  presence,
  and collection-valued options are usage errors;
  no occurrence silently overrides or merges another.
- Valued options accept only separate value tokens.
  Joined long values such as `--provider=voyage` and attached short values such as `-pvoyage` are unknown options.
  Scalar and variadic options use the same separation rule.
- Short aliases must occupy exact argv tokens.
  Clusters such as `-jq` and `-jqp` are unknown options even when each character names a declared alias.
- Long options match exact declared aliases only.
  Unambiguous prefixes and fuzzy corrections are not accepted syntax;
  they may appear only as non-executing diagnostic suggestions.
- Result cardinality preserves syntax:
  zero-or-one uses `value?: T`,
  zero-or-many uses `values?: readonly [T, ...T[]]`,
  and one-or-many uses `values: readonly [T, ...T[]]`.
- Generated help uses display-only metavars for tail positions and rest values.
  Metavars improve usage and missing-value diagnostics but never become result keys.
- A commandless CLI is a root leaf and has no `commandPath` property.
  The parser never invents a program-name path absent from argv.
- Subcommands may nest to arbitrary declared depth,
  as in `cat calico meow --loud`.
- Intermediate command nodes are routing-only.
  Only the innermost leaf command may declare options or a trailing-argument tail.
- Command-bearing results flatten canonical command tokens into a readonly non-empty `commandPath` tuple.
  Leaf options and `trailingArguments` remain top-level properties.
  A single-level command uses `commandPath: readonly ['compare']`;
  nested syntax can use `commandPath: readonly ['calico', 'meow']`.
- Hidden aliases canonicalize their own path segment before output.
- Each leaf may apply a whole-result Valibot schema after field parsing to validate relationships across supplied options and trailing arguments.
  This schema may transform values while preserving declared field layout,
  but may not rename,
  nest,
  remove,
  merge,
  add,
  or default result fields.
  It may not consult external state.
  Failed relationship checks are parser failures with status 2.
- `--help` and `-h` produce contextual help at the root,
  every intermediate route,
  and every leaf.
  They are exact reserved parser controls and never appear in an application success value or reach the application handler.
- A control-position help spelling is exclusive:
  combining it with an option,
  another command token after it,
  or a trailing-argument separator is a usage error.
  Command tokens before it select the help context and do not count as a combination.
- Literal `--help` and `-h` tokens after the trailing-argument separator remain data under the settled separator rule.
- Contextual help writes to stdout and settles with status 0.
  Parser usage and validation failures write every independently recoverable diagnostic followed by full contextual help to stderr and settle with status 2.
  Grammar issues are ordered by argv token index,
  tail issues follow option-region issues,
  and independent Valibot issues preserve schema order.
  Recovery proceeds only from known token boundaries and never reinterprets input to manufacture cascades.
  Failure help uses the deepest canonically resolved command route,
  even when argv used aliases.
  Neither path invokes the application handler.
  Application failures retain their own status and output policy.

## Unresolved result-shape decisions

No known result-shape decision remains open.
Other grammar and diagnostic decisions remain open.

## Architecture discussion deferred

Three implementation models were demonstrated but not selected:

- CLI descriptors containing Valibot schemas.
- A Valibot result schema plus separate token bindings.
- CLI metadata attached to Valibot schemas.

The user correctly deferred this choice until the grammar and successful result interface are settled.
Do not resume the architecture comparison before resolving the result-shape decisions.

## Existing consumer constraints

Current consumers exercise:

- named and repeated options;
- presence flags and defaulted options;
- required,
  optional,
  and repeated positional arguments;
- subcommands and hidden aliases;
- generated help;
- integer conversion and picklists;
- command-tail forwarding through `--`;
- mapping parser output into discriminated command-path unions.

Current unseparated positional syntax will not survive unchanged.
The repository controls these contracts and rejects named positionals as a parser design.
Do not add compatibility shims for existing positional forms.
The plan must distinguish this intentional interface change from accidental parser regressions.
Before migration,
each in-scope CLI needs executable grammar fixtures for accepted input,
rejected input,
help,
`--`,
repetition,
defaults,
and output shape.

## Durable design principles

- Parsing is pure and does not read or mutate `process`.
- Help and failures are structured parse outcomes before rendering.
- Process argv access,
  stream writes,
  and exit-code policy sit at an entrypoint adapter.
- Valibot owns runtime validation and output typing.
- Syntax-level Valibot schemas may transform values and change their runtime representation.
  For example,
  `cpus: '4'` may become `cpus: 4` while retaining the same field in the syntax result.
  Invalid transformed values remain parser failures with status 2.
- The parser reports schema outputs and structural absence.
  Every absent option is omitted from the syntax result.
  CLI-layer schemas may not supply defaults,
  and the parser may not add `undefined`,
  empty collections,
  or false sentinels for absence.
  Effective defaults belong to consumer-owned shape conversion or application logic.
  The parser does not choose domain defaults or perform business logic.
- Canonical business-shape conversion uses a consumer-owned Valibot schema to parse the syntax result again:

  ```ts
  const options = v.parse(commandOptionsSchema, parsed.value,);
  ```

  The second parse is for invasive shape changes such as semantic renaming,
  rearranging tuple elements into named fields,
  changing nesting,
  or otherwise reorganizing the parser result.
  Routine value conversion does not require a second parse.
- Leaf-level whole-result validation may enforce CLI-contract relationships before application dispatch.
  It preserves syntax-derived shape and cannot perform external-state or business-policy checks.
- The owned parser exposes no Optique-compatible parser-state generic surface.
- Consumer and parser tests cross the same public interface.
- Unknown options are rejected before `--` and preserved after `--`.
- Plain tokens before `--` are valid only while a declared variadic option is consuming values.
- Option occurrence identity is canonical across aliases,
  so `-p` followed by `--provider` is a duplicate.
- Option tokens contain one exact declared spelling only;
  values always occupy following argv tokens,
  short aliases never cluster,
  and long aliases never abbreviate or autocorrect.
- Every argument-bearing command uses a required separated tail;
  named positionals and optional-separator compatibility paths are forbidden.
- Tail metavars are presentation-only metadata.
  Parser output remains `trailingArguments` regardless of displayed role names.
- Hidden aliases parse to canonical command-path segments and do not render in help.
- Intermediate subcommands own no options or arguments;
  only the innermost command is a leaf parser.
- Root leaves omit `commandPath`;
  command paths exist only for command tokens supplied in argv.
- Nested subcommand grammar is required and cannot have a fixed depth limit.
- Command results are flat:
  `commandPath` preserves routing syntax while leaf options and trailing arguments stay at the result root.
- Help and parser failures are handled before application dispatch.
  The application receives neither controls nor parser-failure outcomes as business input.
- Parser controls use stdout and status 0;
  parser failures use stderr and status 2.
  Every parser failure appends full contextual help after the diagnostic rather than printing a separate help-command hint.
  Application status 1 remains distinguishable from invalid invocation.
- Parser failures aggregate all independently provable issues.
  Diagnostics have deterministic argv order,
  full help renders once,
  and recovery-safe scanning must not create secondary interpretations.
- `--help` and `-h` are valid at every route only when no other control-position syntax accompanies them.
  After `--`, the same tokens are ordinary trailing data.

## Communication-rule commits

- `82d90270c` added `ODM` so option examples must demonstrate every compared concept.
- `ad0153c2a` removed wording that could excuse an omitted sketch.
- `53903e603` added `OCG` so result cardinality cannot silently determine option occurrence grammar.

## Concurrent worktree state

Independent cli-git work is modifying `package/git-policy/cli/` and `pnpm-lock.yaml`.
Treat these as concurrent user-controlled changes under rule `EC1`.
Do not restore,
stash,
revert,
or include them in this migration's commits.

## Next action

Decide whether syntax parsing supports synchronous Valibot schemas only or also async schemas.
Compare a synchronous parser boundary,
an always-async parser,
and separate sync/async interfaces.
Respect the settled ban on external-state checks inside parsing.
