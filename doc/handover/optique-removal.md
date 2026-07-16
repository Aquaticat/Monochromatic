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
  command: 'compare',
  trailingArguments: ['a.png', 'b.png'],
  provider: 'voyage',
  tags: ['release', 'nightly'],
  json: true,
}
```

The proposed static shape is:

```ts
type CompareArgs = Readonly<{
  command: 'compare';
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
The command alias `cmp` should canonicalize to `command: 'compare'` and remain absent from generated help.

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
- Result cardinality preserves syntax:
  zero-or-one uses `value?: T`,
  zero-or-many uses `values?: readonly [T, ...T[]]`,
  and one-or-many uses `values: readonly [T, ...T[]]`.
- Generated help uses display-only metavars for tail positions and rest values.
  Metavars improve usage and missing-value diagnostics but never become result keys.

## Unresolved result-shape decisions

No known result-shape decision remains open.
Grammar and diagnostic decisions remain open.

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
- mapping parser output into discriminated command unions.

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
- The parser reports supplied values and structural absence.
  It does not choose domain defaults or perform business logic.
- Canonical business-shape conversion uses a consumer-owned Valibot schema to parse the syntax result again:

  ```ts
  const options = v.parse(commandOptionsSchema, parsed.value,);
  ```

  Defaults,
  semantic renaming,
  cross-field policy,
  and domain transformations belong in that second parse.
- The owned parser exposes no Optique-compatible parser-state generic surface.
- Consumer and parser tests cross the same public interface.
- Unknown options are rejected before `--` and preserved after `--`.
- Plain tokens before `--` are valid only while a declared variadic option is consuming values.
- Every argument-bearing command uses a required separated tail;
  named positionals and optional-separator compatibility paths are forbidden.
- Tail metavars are presentation-only metadata.
  Parser output remains `trailingArguments` regardless of displayed role names.
- Hidden aliases parse to canonical command discriminants and do not render in help.

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

Return to duplicate occurrence semantics for zero-or-one options and presence flags.
Compare rejection,
last-wins,
and first-wins behavior with concrete argv,
results,
and diagnostics.
Do not imply that collection-valued output permits repeating its option.
