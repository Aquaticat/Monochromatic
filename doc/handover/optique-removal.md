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
  [-t, --tag TAG]...
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
type CompareArgs = {
  readonly command: 'compare';
  readonly trailingArguments: readonly [string, string, ...string[]];
  readonly provider?: 'voyage' | 'gemini';
  readonly json?: true;
  readonly tags: readonly string[];
};
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
- Presence flags use absent-or-`true` rather than always-present booleans.

## Unresolved result-shape decisions

- Decide whether `--` is mandatory for every command with trailing arguments or only for commands that declare a separated tail.
- Decide whether named positionals remain supported for consumers whose positional values have distinct domain roles.
- Decide whether every separated tail has a schema-defined minimum length,
  with the example requiring two,
  rather than a parser-wide minimum.
- Decide whether repeated options always produce arrays,
  including `tags: []` when absent,
  or use an optional non-empty tuple such as `tags?: readonly [string, ...string[]]`.
- Decide how help names tail positions when the result intentionally has only `trailingArguments`.

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

Not every existing behavior must survive unchanged.
The plan must distinguish intentional interface changes from accidental parser regressions.
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
- The owned parser exposes no Optique-compatible parser-state generic surface.
- Consumer and parser tests cross the same public interface.
- Unknown options are rejected before `--` and preserved after `--`.
- Hidden aliases parse to canonical command discriminants and do not render in help.

## Communication-rule commits

- `82d90270c` added `ODM` so option examples must demonstrate every compared concept.
- `ad0153c2a` removed wording that could excuse an omitted sketch.

## Concurrent worktree state

Independent cli-git work is modifying `package/git-policy/cli/` and `pnpm-lock.yaml`.
Treat these as concurrent user-controlled changes under rule `EC1`.
Do not restore,
stash,
revert,
or include them in this migration's commits.

## Next action

Compare repeated-option result shapes:
`tags: readonly string[]` with an empty-array absence sentinel versus
`tags?: readonly [string, ...string[]]` with property absence.
Recommend one shape and ask the user to settle it before resuming other grammar decisions.
