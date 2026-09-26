# cli-git policy platform implementation specification

## Status and authority

This file is the canonical implementation interface for
`doc/decision/cli-git-policies-platform.md`
and `doc/decision/cli-git-concurrent-commits.md`.
The concurrent-commit code map and slice order live in
`package/git-policy/cli/doc/concurrent-commits-implementation-plan.md`.
Runtime code,
public declarations,
tests,
and user documentation must conform to it.
Changing a settled product behavior requires a new decision update rather than an implementation shortcut.

Npm registry publication is not part of this specification.
Issue #358 records that indefinitely deferred action.

## Module seams

The package has these external seams:

- the shadowing `git` executable;
- the side-effect-free authoring and optional-policy exports from `@monochromatic-dev/git-policy-cli`;
- repository-root config artifacts;
- JSONL policy events;
- the per-account exact-snapshot trust registry.

The package has internal seams for filesystem identity,
real-Git execution,
account-home lookup,
clock,
registry storage,
process liveness and birth identity,
lock-holder evidence,
and prompts.
Production adapters own operating-system effects.
Disposable tests replace those adapters without production environment overrides.

Importing authoring or optional-policy exports must not inspect process arguments,
read files,
resolve Git,
resolve external scanner executables,
write output,
register a policy,
or start the executable.

## Single artifact and shipped optional policies

The public cli-git tarball contains exactly one MJS artifact.
That artifact exports authoring declarations and optional repo-owned policies,
and is also the executable named by the `git` bin entry.
Cli-git's own module graph uses static imports and must not emit shared chunks,
secondary MJS entries,
or package-relative dynamic imports.
Bundled library implementations may retain their dynamic imports.
Exact stored MJS configuration execution may use one computed dynamic import so top-level `await` remains supported.
Neither exemption may emit another artifact or load an untrusted package-relative target.
Direct-invocation detection calls CLI startup only when Node executes the artifact as the program entry.
Importing it as a module remains side-effect free.

Repo-owned policy implementations remain in separate workspace source packages for ownership and focused tests.
The cli-git build statically bundles them into the one artifact.
No private workspace policy package may remain as a runtime or declaration dependency of the packed artifact.

Importing an optional policy returns its plugin definition only.
It never changes the built-in registry or enabled policy set.
A consumer enables it by registering the plugin under a chosen namespace in trusted config.
A no-config invocation therefore retains built-ins only.

The root package export includes `repositoryPolicyPlugin` and,
after issue #354 lands,
`forbiddenStringsPlugin`.
The forbidden-strings export bundles its Node adapter but not the Rust scanner binary.
Scanner lookup defaults to `forbidden-strings` on `PATH` only when the enabled policy executes.

## Public authoring declarations

The public package exports the following semantic declarations.
Implementation may split them across source files,
but the package root re-exports them.

```ts
import type * as v from 'valibot';

export type PolicySeverity = 'off' | 'warn' | 'error';

export type ActivePolicySeverity = Exclude<PolicySeverity, 'off'>;

export type PolicyTrigger =
  | 'pre-forward'
  | 'post-commit'
  | 'manual-push'
  | 'direct-check'
  | 'direct-fix';

export type GitObjectId = string;

export declare const ABSENT_GIT_VALUE: unique symbol;

export type AbsentGitValue = typeof ABSENT_GIT_VALUE;

export type RepositoryPath = string;

export type CandidateFileMode =
  | 'regular'
  | 'executable'
  | 'symlink'
  | 'submodule';

export type CandidateChange =
  | 'added'
  | 'modified'
  | 'deleted';

export type CandidateFile = {
  readonly targetId: string;
  readonly path: RepositoryPath;
  readonly revision: GitObjectId | AbsentGitValue;
  readonly mode: CandidateFileMode;
  readonly change: CandidateChange;
  readonly bytes: () => Promise<Uint8Array>;
};

export type TrackedFile = {
  readonly targetId: string;
  readonly path: RepositoryPath;
  readonly revision: GitObjectId;
  readonly mode: CandidateFileMode;
  readonly headRevision: GitObjectId | AbsentGitValue;
  readonly bytes: () => Promise<Uint8Array>;
  readonly headBytes: () => Promise<Uint8Array | AbsentGitValue>;
};

export type PushUpdate = {
  readonly localOid: GitObjectId | AbsentGitValue;
  readonly remoteOid: GitObjectId | AbsentGitValue;
  readonly remoteName: string;
  readonly remoteRef: string;
};

export type PolicyCommandFacts = {
  readonly rawArgs: readonly string[];
  readonly transformedArgs: readonly string[];
  readonly subcommand: string | AbsentGitValue;
  readonly effectiveCwd: string;
  readonly repositoryRoot: string;
  readonly escapedPolicyIds: ReadonlySet<string>;
};

export type LazyPolicyGitFacts = {
  readonly candidates: () => Promise<readonly CandidateFile[]>;
  readonly trackedFiles: (request: Readonly<{ pathspecs: readonly string[] }>) => Promise<readonly TrackedFile[]>;
  readonly headOid: () => Promise<GitObjectId | AbsentGitValue>;
  readonly landedCommitOid: () => Promise<GitObjectId | AbsentGitValue>;
  readonly pushUpdates: () => Promise<readonly PushUpdate[]>;
};

export type PolicyContext = {
  readonly candidateVersion: number;
  readonly canApplyPatches: boolean;
  readonly trigger: PolicyTrigger;
  readonly command: PolicyCommandFacts;
  readonly git: LazyPolicyGitFacts;
  readonly signal: AbortSignal;
};

export type FindingLocation = {
  readonly byteStart: number;
  readonly byteEnd: number;
};

export type PolicyPatch = {
  readonly kind: 'git-unified';
  readonly targetId: string;
  readonly path: RepositoryPath;
  readonly bytes: Uint8Array;
};

export type PolicyFinding = {
  readonly code: string;
  readonly message: string;
  readonly path?: RepositoryPath;
  readonly location?: FindingLocation;
  readonly patch?: PolicyPatch;
};

export type PolicyCheckInput<TOptions> = {
  readonly context: PolicyContext;
  readonly options: Readonly<TOptions>;
};

export type PolicyInput =
  | Readonly<{ kind: 'worktree'; pathspecs: readonly string[]; }>
  | Readonly<{ kind: 'executable'; path: string; }>
  | Readonly<{ kind: 'revision'; rev: string; }>
  | Readonly<{ kind: 'env'; name: string; }>;

export type PolicyInputs =
  | 'unrestricted'
  | Readonly<{ external: readonly PolicyInput[]; }>;

export type PolicyInputsDeclaration<TOptions> =
  | PolicyInputs
  | ((options: Readonly<TOptions>) => PolicyInputs);

export type PolicyDefinition<
  TOptions = undefined,
  TName extends string = string,
> = {
  readonly name: TName;
  readonly defaultSeverity: PolicySeverity;
  readonly warnSafe: boolean;
  readonly triggers: readonly PolicyTrigger[];
  readonly options?: Readonly<v.GenericSchema<unknown, TOptions>>;
  readonly inputs?: PolicyInputsDeclaration<TOptions>;
  readonly check: (input: PolicyCheckInput<TOptions>) => Promise<readonly PolicyFinding[]>;
};

export type PluginDefinition<
  TPolicies extends readonly PolicyDefinition<unknown>[] =
    readonly PolicyDefinition<unknown>[],
  TName extends string = string,
> = {
  readonly name: TName;
  readonly policies: TPolicies;
};

export type PolicySetting<TOptions = unknown> =
  | PolicySeverity
  | readonly [PolicySeverity, TOptions];

export type BuiltInPolicyId =
  | 'require-root'
  | 'linked-worktree-only'
  | 'branch-worktree-only'
  | 'add-explicit';

export type PluginMap = Readonly<Record<string, PluginDefinition>>;

export type CliGitConcurrencyConfig = {
  readonly hooks?: {
    readonly concurrentCommits?: boolean;
  };
  readonly indexLock?: {
    readonly unprovenOwnerTimeoutMs?: number;
  };
  readonly landing?: {
    readonly reserveAfterLostRaces?: number;
  };
};

export type CliGitConfig<TPlugins extends PluginMap = PluginMap> =
  CliGitConcurrencyConfig & {
    readonly plugins?: TPlugins;
    readonly policies?: Readonly<Record<string, PolicySetting>>;
    readonly trust?: {
      readonly children?: boolean;
    };
  };

type CliGitConfigInput = CliGitConcurrencyConfig & {
  readonly plugins?: PluginMap;
  readonly policies?: Readonly<Record<string, unknown>>;
  readonly trust?: {
    readonly children?: boolean;
  };
};

type ConfigPlugins<TConfig extends CliGitConfigInput> =
  TConfig extends { readonly plugins: infer TPlugins extends PluginMap }
    ? TPlugins
    : never;

type ConfigPolicies<TConfig extends CliGitConfigInput> =
  TConfig extends {
    readonly policies: infer TPolicies extends Readonly<Record<string, unknown>>;
  }
    ? TPolicies
    : never;

type PluginPolicyForId<
  TPlugins extends PluginMap,
  TId extends string,
> = TId extends `${infer TNamespace}/${infer TName}`
  ? TNamespace extends keyof TPlugins
    ? Extract<TPlugins[TNamespace]['policies'][number], PolicyDefinition<unknown, TName>>
    : never
  : never;

type AllowedPolicySetting<
  TConfig extends CliGitConfigInput,
  TId extends PropertyKey,
> = TId extends BuiltInPolicyId
  ? PolicySeverity
  : TId extends string
    ? [PluginPolicyForId<ConfigPlugins<TConfig>, TId>] extends [never]
      ? never
      : PluginPolicyForId<ConfigPlugins<TConfig>, TId> extends PolicyDefinition<infer TOptions>
        ? PolicySetting<TOptions>
        : never
    : never;

type CheckedPolicySettings<TConfig extends CliGitConfigInput> = {
  readonly [TId in keyof ConfigPolicies<TConfig>]:
    ConfigPolicies<TConfig>[TId] extends AllowedPolicySetting<TConfig, TId>
      ? ConfigPolicies<TConfig>[TId]
      : never;
};

export declare function definePolicy<
  const TName extends string,
  const TOptions = undefined,
>(
  definition: Readonly<PolicyDefinition<Readonly<TOptions>, TName>>,
): PolicyDefinition<Readonly<TOptions>, TName>;

export declare function definePlugin<
  const TName extends string,
  const TPolicies extends readonly PolicyDefinition<unknown>[],
>(
  definition: PluginDefinition<TPolicies, TName>,
): PluginDefinition<TPolicies, TName>;

export declare function defineConfig<const TConfig extends CliGitConfigInput>(
  config: TConfig
    & CliGitConfig<ConfigPlugins<TConfig>>
    & { readonly policies?: CheckedPolicySettings<TConfig> },
): TConfig;

export declare function definePolicyOptions<const TInput, const TOutput>(
  schema: Readonly<v.GenericSchema<TInput, TOutput>>,
): v.GenericSchema<TInput, TOutput>;
```

### Declaration invariants

- `definePolicy`,
  `definePlugin`,
  `defineConfig`,
  and `definePolicyOptions` return their argument unchanged.
- `defineConfig` derives valid plugin policy IDs and option outputs from the concrete namespace map and preserved policy
  tuple.
  Unknown IDs and wrong option values are TypeScript errors when definitions are statically known.
- Runtime config loading still validates the resulting value rather than trusting TypeScript types.
- Policy and plugin names are non-empty kebab-case identifiers without `/`.
- Consumer namespaces are non-empty kebab-case identifiers without `/`.
- Built-in IDs are their policy names.
- Plugin IDs are `<namespace>/<policy-name>`.
- Duplicate effective IDs are config failures.
- A policy default may be `off`.
- Omitted options become the policy schema's documented default only when the schema supplies one.
  Otherwise omitted required options are a config failure.
- A policy without an option schema receives `undefined`.
- Plugin declaration order is the array order.
- Config namespace order is JavaScript own-string-key insertion order.
- The engine copies returned arrays,
  finding objects,
  sets,
  argument arrays,
  and patch bytes before retaining them.
- `RepositoryPath` values use Git's slash-separated repository-relative form.
  Absolute paths,
  empty paths,
  `.` segments,
  `..` segments,
  NUL,
  and backslash separators are invalid.
- `GitObjectId` is opaque to plugins.
  The engine validates object IDs before invoking Git.
- `targetId` is invocation-local and opaque.
  Plugins must return the exact target ID supplied by a candidate.
- `revision` is `ABSENT_GIT_VALUE` for a mutable candidate and a Git object ID for immutable historical content.
- Deleted and submodule candidates reject `bytes()` with a typed engine-owned unavailable-content error.
- `bytes()` returns a fresh copy on every call.
- Lazy methods memoize success or failure for one `candidateVersion`.
- Any candidate mutation increments `candidateVersion` and creates a new context.
- Inside a commit transaction,
  `headOid()` returns the recorded preparation base,
  or the replay parent during revalidation after a replay,
  and never re-reads live `HEAD`.
  `landedCommitOid()` returns the OID the landing wrote by compare-and-swap.
- Policy cancellation uses `signal`.
  Returning after cancellation is ignored;
  throwing because of cancellation remains an engine event rather than a finding.

### Policy completion

A check completes only after its returned promise resolves and every lazy operation it awaited completed successfully.
An exception,
rejection,
invalid return value,
invalid finding,
or required unavailable candidate is an engine failure.
An empty finding array is a successful clean result.

The engine invokes one policy at a time.
Policy code may use `Promise.all` internally when its own checks are independent.

## Policy inputs and read sets

`inputs` tells the engine what a policy reads outside its `PolicyContext`,
so a replayed commit re-runs only the policies whose inputs could have changed.
Precedent:
Nx task `inputs`,
broad when absent.

- An omitted `inputs` means `'unrestricted'`.
  An unrestricted policy always re-runs after a replay.
- `{ external: [] }` declares that the policy reads only through its context.
- `inputs` may be a static value or a function of the validated policy options,
  so option-dependent inputs such as a configured executable are expressible.
  Config loading calls the function once with the parsed options
  (see "Configuration validation").
- `PolicyInput` kinds and their fingerprints:
  - `worktree`:
    Git pathspecs,
    fingerprinted by the matching tracked and untracked non-ignored paths and their blob OIDs;
    an empty pathspec list is invalid.
  - `executable`:
    a path or `PATH`-resolved name,
    fingerprinted by the resolved path plus no-follow device,
    inode,
    size,
    and modification time.
  - `revision`:
    a Git revision,
    fingerprinted by the object it resolves to,
    or its absence,
    with the private `HEAD` at the preparation base and again at the replay parent.
  - `env`:
    a variable name,
    fingerprinted by its value or absence.
- A thrown `inputs` function or an invalid result is a config failure with exit `2`.

The engine gives each policy its own `PolicyContext` whose `git` member records reads
while delegating to the shared memoized facts,
so memoization is unchanged.
A read set holds:

- the candidate list
  (path,
  mode,
  change,
  and blob OID);
- the paths whose `bytes()` ran;
- each `trackedFiles` pathspec request with its result entries;
- whether `headOid()` ran.

Blob and commit OIDs are the fingerprints,
so no extra hashing is needed.
Recording stops when the policy completes
(see "Policy completion");
a lazy read after completion is not part of the set.

After a clean replay,
a policy that declares inputs re-runs only when a recorded read or a declared input fingerprint differs
between the preparation state and the replayed state.
Every unrestricted policy re-runs.
Re-run findings and patches follow the ordinary whole-sequence convergence rules
(see "Whole-sequence fixing").

The shipped policies declare:

- `repository/forbidden-root-context` and `repository/dependent-version-bump`:
  `{ external: [] }`;
- `final-newline`:
  `{ external: [] }`;
- `forbidden-strings/forbidden-strings`:
  a function of its options naming the root `forbidden-strings.*.txt` rules files as a `worktree` input,
  `FORBIDDEN_STRINGS_RULES` as an `env` input,
  and the configured scanner as an `executable` input;
  a rules path outside the repository has no `PolicyInput` kind,
  so such a configuration stays `'unrestricted'`;
- `markdown-lint/autofix` and the four command built-ins
  (`require-root`,
  `linked-worktree-only`,
  `branch-worktree-only`,
  `add-explicit`):
  `'unrestricted'`,
  because they read Git or workspace state outside the context.

## Finding and patch validation

`code` is a stable policy-local kebab-case identifier.
The public JSONL code becomes `<policy-id>/<code>`.
`message` is non-empty and contains no terminal-control requirement.
The renderer JSON-escapes it.

A location is a half-open byte range.
It requires `path` and must satisfy
`0 <= byteStart <= byteEnd <= candidateByteLength`.
Character,
line,
and column coordinates are intentionally absent because policies inspect exact bytes.

A patch is valid only when all conditions hold:

- trigger is `pre-forward` or `direct-fix`;
- finding has `path`;
- patch path equals finding path;
- patch target ID identifies the same mutable candidate and path;
- revision is `ABSENT_GIT_VALUE`;
- patch bytes are one textual unified Git diff;
- old and new paths resolve to exactly the candidate path;
- no rename,
  copy,
  mode change,
  submodule,
  binary patch,
  absolute path,
  traversal,
  or second path is present;
- applying with Git three-way semantics changes bytes;
- resulting candidate remains a regular or executable file;
- direct fix preserves the original file mode.

`trackedFiles` lists index entries of the lifecycle's current candidate state that match Git pathspecs,
glob magic included,
with their `HEAD` counterparts;
inside a commit transaction the counterpart is the recorded preparation base,
not live `HEAD`.
Commit transactions read the private commit index,
add and direct lifecycles read their private projection,
and post-commit and manual-push lifecycles return no tracked files.
Bytes load through one lazy batch.

A patch whose target ID names a tracked file that is not a candidate adds that path to the commit.
It is valid only when,
in addition to the candidate rules:

- the lifecycle is a commit transaction outside read-only selection;
- the real index captured at invocation,
  the private commit index,
  and the preparation base hold the same ordinary blob and mode for the path;
- the worktree copy is a regular file whose bytes and executable bit match that blob.

Otherwise the engine exits `2` with `patch-conflict`,
naming the path,
which state differs,
and the remedies:
stage the path so the fix applies to the staged copy,
or restore it to match `HEAD`.
A tracked target naming a candidate path at the candidate's exact revision applies as that candidate.

A patch that applies but produces identical bytes is invalid rather than a convergence change.
Patch validation failure exits `2` and identifies the policy and path without echoing patch bytes.

## Authoring example

This minimal plugin rejects a root context file.

```ts
import {
  defineConfig,
  definePlugin,
  definePolicy,
  type PolicyFinding,
} from '@monochromatic-dev/git-policy-cli';

const forbiddenRootContext = definePolicy({
  name: 'forbidden-root-context',
  defaultSeverity: 'error',
  warnSafe: true,
  triggers: [
    'pre-forward',
    'direct-check',
  ],
  async check({ context, }): Promise<readonly PolicyFinding[]> {
    const candidates = await context.git.candidates();
    const hasRootContext = candidates.some(
      function isRootContext(candidate,): boolean {
        return candidate.path === 'CONTEXT.md'
          && candidate.change !== 'deleted';
      },
    );

    if (!hasRootContext)
      return [];

    return [{
      code: 'root-context-forbidden',
      message: 'Root CONTEXT.md is forbidden; read source directly.',
      path: 'CONTEXT.md',
    },];
  },
});

const repositoryPlugin = definePlugin({
  name: 'repository',
  policies: [forbiddenRootContext,],
});

export default defineConfig({
  plugins: {
    mono: repositoryPlugin,
  },
  policies: {
    'mono/forbidden-root-context': 'error',
  },
  trust: {
    children: true,
  },
});
```

A policy with options passes a Valibot schema directly.

```ts
import * as v from 'valibot';
import {
  definePolicy,
  definePolicyOptions,
  type PolicyFinding,
} from '@monochromatic-dev/git-policy-cli';

const options = definePolicyOptions(v.object({
  marker: v.optional(v.string(), 'forbidden'),
}),);

export const markerPolicy = definePolicy({
  name: 'marker',
  defaultSeverity: 'off',
  warnSafe: true,
  triggers: ['direct-check',],
  options,
  async check({ options: parsedOptions, }): Promise<readonly PolicyFinding[]> {
    return [{
      code: 'configured-marker',
      message: parsedOptions.marker,
    },];
  },
});
```

Consumer-built MJS must bundle the authoring imports away.
A hand-written self-contained MJS artifact may export the equivalent raw object.

## Configuration validation

Config loading performs these steps in order:

1.  Validate top-level object shape.
2.  Validate concurrency keys
    (see "Concurrency configuration").
3.  Validate plugin namespaces and plugin values.
4.  Register built-ins in fixed order.
5.  Register plugins in namespace and declaration order.
6.  Resolve each effective policy ID.
7.  Apply omitted declared defaults.
8.  Parse configured option values through the policy's Valibot schema.
9.  Resolve each enabled policy's `inputs`,
    calling an `inputs` function with the parsed options,
    and validate the result.
10. Emit configuration warnings for explicit unsafe `warn` settings.
11. Validate trust declaration.

Unknown top-level keys,
unknown or mistyped concurrency keys,
unknown policy IDs,
duplicate IDs,
invalid severities,
missing required options,
options supplied to a schema-less policy,
Valibot failures,
and invalid or throwing `inputs` declarations exit `2` before any policy runs.
Valibot issues are rendered into an engine-failure event without serializing arbitrary schema objects.

### Concurrency configuration

Three nested keys tune concurrent commits.
None of them disables the concurrent transaction;
no configuration key or environment variable opts out of it.

- `hooks.concurrentCommits`:
  boolean,
  default `false`.
  `false` serializes preparation hooks and the post-landing `post-commit` hook through the hook lock;
  `true` lets them overlap.
- `indexLock.unprovenOwnerTimeoutMs`:
  non-negative safe integer,
  default `1000`.
  The backoff budget for a foreign `index.lock` whose owner is dead or unproven.
- `landing.reserveAfterLostRaces`:
  positive safe integer,
  default `2`.
  Lost landing races after which a transaction asks for the landing reservation.

Unknown nested keys,
wrong types,
fractional values,
and out-of-range values are config failures.
An absent config uses the defaults.
Startup recovery runs before config loading and always uses the defaults.

## Command facts and classification

`rawArgs` are the exact wrapper arguments after the script name.
`transformedArgs` contain fixed cli-git transforms but no management-only or escape-hatch tokens.
Both arrays are immutable copies.

`subcommand` is the argument-aware parsed Git subcommand after global options and `-C` chains.
`effectiveCwd` is canonicalized after applying Git's ordered `-C` semantics.
`repositoryRoot` is the canonical real-Git toplevel for that effective directory.

Known read-only forms skip config loading.
The classifier source must enumerate its Git documentation version and fixtures.
Mixed commands classify from arguments.
Any unknown alias,
external command,
future command,
or ambiguous form loads trusted config.

Short-circuit global version and help forms preserve real Git behavior and do not load config.
Management dispatch occurs only when the parsed subcommand is exactly `cli-git`.
A pathspec named `cli-git` does not dispatch management.

## Management grammar

The accepted grammar is:

```text
git [<git-global-options>] cli-git (--help | -h)
git [<git-global-options>] cli-git trust [--yes] [(--help | -h)]
git [<git-global-options>] cli-git untrust
git [<git-global-options>] cli-git status
git [<git-global-options>] cli-git check [--policy <id>]... --all
git [<git-global-options>] cli-git check [--policy <id>]... -- <pathspec>...
git [<git-global-options>] cli-git fix [--policy <id>]... --all
git [<git-global-options>] cli-git fix [--policy <id>]... -- <pathspec>...
```

Rules:

- Management parsing uses the internal argv region parser.
- Namespace and trust help write human-readable text to stdout and exit `0`.
- Help returns before resolving real Git,
  recovering transactions,
  discovering repository config,
  building a trust candidate,
  or accessing the trust registry.
- `--help` and `-h` are valid at the namespace and for `trust` only.
- A trust help flag takes precedence over `--yes` and performs no consent operation.
- `--yes` is valid only for `trust`.
- `--policy` is repeatable only for `check` and `fix`.
- Repeated identical policy IDs are deduplicated while preserving first occurrence order.
- `--all` and `-- <pathspec>...` are mutually exclusive and one is required.
- The pathspec form requires at least one token after `--`.
- Tokens after `--` are passed to real Git pathspec expansion without wrapper reinterpretation.
- Unknown management flags and extra positionals are usage errors with exit `2`.
- A usage error never loads repository config.
- `check` and `fix` load trusted config after grammar and scope validation.
- `trust`,
  `untrust`,
  and `status` never execute live repository config during preflight.
- `fix` changes selected worktree files and verifies every real index blob is unchanged.

Non-help trust management emits one compact LF-terminated JSON object on stdout.
These management objects carry `schemaVersion` but no policy-event `sequence`.
Successful help emits human-readable stdout rather than a management object.
Human trust and recursive-authority disclosures remain on stderr.

```ts
export type TrustSummary = {
  readonly schemaVersion: 1;
  readonly type: 'trust-summary';
  readonly configPath: string;
  readonly trusted: true;
};

export type TrustStatus = {
  readonly schemaVersion: 1;
  readonly type: 'trust-status';
  readonly configPresent: boolean;
  readonly trusted: boolean;
  readonly unchanged: boolean;
  readonly configPath?: string;
  readonly filesystemId?: string;
  readonly reason:
    | 'no-config'
    | 'untrusted'
    | 'trusted'
    | 'changed'
    | 'corrupt';
};

export type UntrustSummary = {
  readonly schemaVersion: 1;
  readonly type: 'untrust-summary';
  readonly configPath: string | null;
  readonly removed: boolean;
  readonly affectedRoots: readonly string[];
};
```

`status` inspects exact trust state without executing live config.
`configPath` and `filesystemId` are absent when no supported config is present.
Deleted-config recovery uses `null` for `UntrustSummary.configPath` because no canonical config path remains.
Trust management failures emit one schema-version-one `engine-failure` event on stdout and exit `2`.
A `config-untrusted` event names the affected configuration and gives both recovery commands:
interactive `git cli-git trust` and explicit noninteractive `git cli-git trust --yes`.
A classified `TrustedConfigError` retains its stable code;
an unclassified management or recovery failure uses `trust-failed`.
This schema supersedes the temporary built-in policy inventory from the first policy-engine slice.

## Lifecycle

### Pre-forward

Built-in policies run against raw semantic command facts.
Fixed transforms then produce `transformedArgs`.
Plugin policies run against the predicted candidate set for the transformed command.
`canApplyPatches` authorizes only engine-owned policy patch application,
not arbitrary repository mutation.
It is true only when a private commit transaction or direct-fix operation owns safe patch application.
Applicable normalizer patches then run through whole-sequence convergence.
Other pre-forward commands emit findings without proposing unavailable patches.
Remaining errors block before real Git.

### Linked-worktree ignored-state synchronization

`resolveGitWorktreeIdentity` is the package-wide seam for replaying effective Git selection and classifying canonical
outside,
bare,
main,
and linked identity.
Policy adapters add their own allowlisting after this shared classification.

An applicable source is a forwarded invocation whose shared identity selects a linked worktree or bare repository
and whose subcommand,
after ordinary Git alias resolution,
creates or moves worktrees.
Only applicable sources hold the common-directory settlement lock across real Git and its hooks.
Every other forwarded command,
including every commit preparation,
runs without that lock,
so concurrent commits in linked worktrees never contend on it.
A worktree created by Git invoked through an absolute path from a hook bypasses the wrapper
and therefore gets no ignored-state copy,
matching the documented bypass of everything else.
A hook that runs `git worktree add` through the wrapper is itself an applicable source.

Before forwarding an applicable source,
cli-git captures the common Git directory and linked-worktree administrative identity set.
An invocation targeting the main worktree bypasses administrative observation,
journal recovery,
settlement locking,
and synchronization,
even when real Git creates a linked worktree.
After real Git and its hooks return for an applicable source,
cli-git compares the administrative set again.
Every new identity is a synchronization destination,
regardless of whether argv named `worktree add`,
an ordinary Git alias expanded to it,
or real Git returned nonzero after retaining registration.
A missing or stale pre-existing worktree root does not hide a newly created identity.

For an applicable non-bare invocation,
the source is the invoking linked worktree root after Git and `post-checkout` settle.
Git's standard exclusion stack selects the source paths:
per-directory `.gitignore`,
repository exclude state,
and configured excludes files.
The source set includes ignored regular files,
directories,
and symbolic links.
Ignored sockets,
FIFOs,
and device nodes are selected only to produce a copy failure without opening them.
A bare repository has no source root and synchronizes an empty set.
There is no repository configuration for this behavior.
The wrapper-only flag `--no-worktree-copy` skips synchronization for one invocation.
It is recognized only in flag position after the subcommand and before Git's `--` pathspec separator,
is stripped before real Git runs,
and leaves value-position tokens with the same bytes untouched.
An opted-out invocation performs no journal recovery;
pending journals wait for the next repository invocation without the flag.

Before staging,
exclude every registered worktree root strictly nested under the source.
Private stage names are reserved and excluded at every path component.
Stage each destination separately in a mode-`0700` sibling directory so file cloning stays on the destination filesystem.
Copy regular files with an exclusive copy-on-write request whose unsupported-filesystem behavior falls back to a full
copy.
Preserve directory and regular-file permission bits plus exact symbolic-link target text.
Never follow a symbolic link while classifying source or destination entries.

Build a deterministic parent-first manifest before copying.
After the private stage is complete and modes are applied,
rebuild the source and staged manifests and require exact final equality of selected roots,
entry paths,
types,
modes,
regular-file bytes,
and symbolic-link targets.
Transient source mutations that revert before final comparison are outside the guarantee.
Any remaining difference is source instability and blocks destination mutation.

Preflight every existing destination manifest entry before creating any path.
Accept an exact match even when the destination does not ignore that path.
Never overwrite or remove a differing destination entry.
Create absent entries exclusively and retain the Git-created worktree on any failure.
Immediate rollback visits only transaction-owned paths in child-first order;
it removes a selected path only when it still exactly matches the private stage,
and removes an unselected scaffold only when it remains empty.
Every path whose ownership cannot be proved remains in place and is named in the diagnostic.

Each destination uses a schema-versioned journal under
`<git-common-dir>/cli-git-worktree-copy/v1`.
Journal writes use a private no-follow temporary file,
file synchronization,
atomic rename,
and parent-directory synchronization where supported.
Persist selected-entry intent before destination mutation.
A completion phase makes stage removal and journal removal recoverable in either crash order.
A process-birth-identity lock serializes installation and recovery,
rejects live contention after bounded acquisition,
and reclaims stale PID reuse safely.

Every later linked-worktree or bare-repository invocation checks for pending journals before forwarding
without taking the settlement lock,
and takes it only to recover when a pending journal exists.
Recovery validates that journal paths remain canonical,
the stage is a private owned directory beside the destination,
the destination still resolves to a linked registration under the same common directory,
and every intended entry exists in the private manifest.
Malformed,
replaced,
missing,
or conflicting state fails closed without deleting the journal or a path outside the validated private stage.
Completed cleanup is resumed without reinstalling entries.

After all newly registered destinations settle successfully,
write exactly one human summary line to stderr.
Copy-only failure exits `2`.
If real Git returned nonzero and synchronization also fails,
preserve Git's numeric status;
use `1` when Git ended by signal without a numeric status.
If Git failed but synchronization succeeds,
preserve its status after writing the successful copy summary.

### Post-commit

After a successful non-dry-run commit lands
and the `post-commit` hook has run
(see "Post-landing"),
use the OID the landing wrote by compare-and-swap.
Never re-read live `HEAD`:
after concurrent landings it can name another invocation's commit.
Run applicable post-commit policies against committed ground truth.
`landedCommitOid()` returns the exact resolved commit;
`candidates()` lazily enumerates its complete recursive tree and reads blobs by object ID rather than worktree path.
Only a clean or warning-only result allows auto-push.
A policy or engine failure leaves the commit intact,
blocks push,
returns `2`,
and emits `commit-landed` after the causal events.
Once the landed OID is known,
repository-root or candidate-fact setup failure emits `content-unavailable` plus the same explicit landed state.

### Auto-push

Auto-push is single-flight per branch.
A per-branch owner lock at `<git-common-dir>/cli-git/push/<encoded-ref>.lock`
and a `last-pushed.json` record
(tip OID,
outcome,
and owner)
coordinate pushes from concurrent landings.
The encoded ref is a filesystem-safe reversible encoding of the branch ref name.

- A landed commit whose OID is an ancestor of an in-flight push's tip joins that push and waits for its outcome.
- Otherwise it takes the lock,
  resolves the current branch tip,
  pushes with the existing argument selection
  (plain `git push` with an upstream,
  `git push --set-upstream origin HEAD` without one),
  and records the pushed tip on success.
- An invocation finishes auto-push once a successful push covers its OID,
  or once the push that would cover it has failed.
- A dead pusher's lock is retired through the owner-liveness check,
  and a waiting joiner takes over.
- A joined commit's own `pre-push` hook does not run separately;
  the joined push ran it once for its tip.
- The existing exit contract holds:
  a failed push,
  whether owned or joined,
  is surfaced with its complete output by every affected invocation,
  leaves the commit local,
  and preserves exit `0`.
- Skips for a detached `HEAD` or a missing remote are unchanged.
- The landing lock is never held while waiting for or running a push.

### Manual push

Resolve actual local and remote updates with Git-native information.
Scan every content-bearing commit or tree state required by enabled policies.
A pure deletion has no content target.
An indeterminate content-bearing range is `content-unavailable` and exits `2`.
Manual push never applies policy patches.

### Direct check

Use worktree bytes selected by explicit pathspecs or `--all`.
Run applicable direct-check policies read-only.
Emit final findings to stdout.

### Direct fix

Use worktree bytes selected by explicit pathspecs or `--all`.
Apply eligible patches to private candidate state through whole-sequence convergence,
then atomically replace only changed selected and added worktree files.
Snapshot the complete real index before and after and fail if any index blob changes.
Hold the landing lock
(see "Locks")
from the first snapshot through worktree installation and the final snapshot,
so a concurrent landing cannot falsify the byte-identical real index check.
Emit final findings and one fix summary to stdout.
A patch targeting an unselected tracked file adds it under the "Added paths" precondition;
its original worktree bytes for the concurrent-change check are the verified `HEAD` blob.

## Policy order and stopping

Each pass runs:

1. built-in policies in fixed order;
2. fixed transforms in fixed order;
3. plugin policies in namespace and declaration order.

The built-in order is
`require-root`,
`linked-worktree-only`,
`branch-worktree-only`,
then `add-explicit`.
The transform order is atomic push,
commit only,
then status hints off.

Without `--cli-git-keep-going`,
the first unpatched error stops the pass.
With the wrapper flag,
later policies run after findings,
but any final error still blocks real Git.
Engine failures always stop immediately.
The wrapper recognizes its flag only before Git's `--` separator and removes it before forwarding.

## Whole-sequence fixing

A pass begins with one exact candidate state.
Later policies see earlier patches.
Any changed candidate makes every finding in that pass provisional and restarts the complete order.

The engine retains up to eight candidate states in private temporary storage.
States serialize as ordered entries of repository path,
mode,
revision identity,
and exact bytes.
No content digest participates.

After each pass:

- exact equality with the preceding state means stable;
- exact equality with any non-adjacent retained state means cycle failure;
- a changed eighth pass means pass-limit failure;
- otherwise start the next pass at the first built-in policy.

Stable warning-only or clean state exits `0` when Git does not run.
Stable state with errors exits `1`.
Cycle and pass-limit failures exit `2`.
Only events derived from the stable pass are emitted as findings.

## JSONL schema version 1

Each event is one compact JSON object followed by LF.
Fields not listed for an event are absent rather than carrying a JSON `null` value.
The in-process `ABSENT_GIT_VALUE` sentinel is never serialized.
Unknown fields may be added only in a backward-compatible schema revision.
New event types,
new optional fields,
new `coreId` values,
and new finding or failure codes are backward-compatible additions under `schemaVersion: 1`.
Consumers must ignore event types,
fields,
and codes they do not recognize.
Removing,
renaming,
or changing field meaning requires a new integer `schemaVersion`.

All policy events share:

```ts
export type EventBase = {
  readonly schemaVersion: 1;
  readonly sequence: number;
  readonly type: string;
};
```

`sequence` starts at `0` for each cli-git invocation and increments by one in emission order.
Trust management objects use the separate schema specified in `Management grammar`.

### Trust warning object

```ts
export type TrustWarningObject = {
  readonly schemaVersion: 1;
  readonly type: 'trust-warning';
  readonly code:
    | 'relaxed-entry-malformed'
    | 'relaxed-entry-filesystem-mismatch'
    | 'typescript-package-import-not-invalidated';
  readonly message: string;
};
```

A trust warning is not a policy event and has no `sequence`.
It is one compact LF-terminated JSON object on stderr.
It may accompany direct-command policy JSONL on stdout without corrupting that stream.

### Finding event

```ts
export type FindingEvent = EventBase & {
  readonly type: 'finding';
  readonly trigger: PolicyTrigger;
  readonly policyId: string;
  readonly severity: ActivePolicySeverity;
  readonly code: string;
  readonly message: string;
  readonly path?: RepositoryPath;
  readonly location?: FindingLocation;
  readonly fix: 'none' | 'available';
};
```

`code` is the complete `<policy-id>/<policy-local-code>` value.
Patch bytes are never emitted.
`available` means the final stable finding still offers a patch that was not applied in this read-only or unsupported
mode.
A policy may instead omit an inapplicable patch and report `none`.
A corrected finding from a provisional pass is not emitted.
Consequently successful autofix emits only `fix-summary`,
not the corrected finding.

### Configuration warning event

```ts
export type ConfigurationWarningEvent = EventBase & {
  readonly type: 'configuration-warning';
  readonly trigger: PolicyTrigger;
  readonly policyId: string;
  readonly code: 'warn-unsafe';
  readonly message: string;
};
```

An explicitly configured warn-unsafe policy emits this non-blocking event even when its check returns no finding.
Configuration warnings share the same JSONL stream and invocation-local sequence as findings and engine failures;
they never write ad hoc prose to the machine stream.

### Core finding event

```ts
export type CoreFindingEvent = EventBase & {
  readonly type: 'core-finding';
  readonly trigger: 'pre-forward';
  readonly coreId:
    | 'commit-only'
    | 'commit-normalization'
    | 'concurrent-commit';
  readonly code:
    | 'commit-only/all-flag'
    | 'commit-only/pathspec-required'
    | 'commit-only/staged-changes-ignored'
    | 'commit-normalization/no-change'
    | 'concurrent-commit/replay-conflict'
    | 'concurrent-commit/head-moved'
    | 'concurrent-commit/branch-switched';
  readonly message: string;
  readonly paths?: readonly RepositoryPath[];
  readonly winningOid?: GitObjectId;
  readonly preparedOid?: GitObjectId;
};
```

Core findings are expected rejections from fixed non-configurable behavior.
They block with exit `1`,
share policy-event sequencing,
and cannot be disabled or assigned a severity through repository config.

- `commit-normalization/no-change`:
  the settled tree equals the preparation base after normalization,
  so no commit is created unless one was explicitly requested.
- `concurrent-commit/replay-conflict`:
  replaying the prepared commit onto the moved target conflicts.
  `paths` lists the conflicting paths in Git path byte order,
  `winningOid` names the earliest commit in `<preparation base>..<current target>` that touches any of them,
  and `preparedOid` names the prepared commit so the user can cherry-pick it.
  The message names all three.
- `concurrent-commit/head-moved`:
  an amend,
  a merge,
  cherry-pick,
  or revert conclusion,
  or a normalization found the target moved since preparation,
  or any commit found that the target no longer names a commit
  (a deleted branch),
  so there is nothing to replay onto.
- `concurrent-commit/branch-switched`:
  the symbolic `HEAD` target differs from the one recorded at invocation.

`paths`,
`winningOid`,
and `preparedOid` are present only for `concurrent-commit/replay-conflict`.
Every `concurrent-commit` finding leaves ref,
real index,
and worktree bytes unchanged by cli-git.

### Fix summary event

```ts
export type FixSummaryEvent = EventBase & {
  readonly type: 'fix-summary';
  readonly trigger: 'pre-forward' | 'direct-fix';
  readonly passes: number;
  readonly changedPaths: readonly RepositoryPath[];
};
```

`changedPaths` are unique and sorted by Git path byte order.
The event is absent when no bytes changed.

### Engine failure event

```ts
export type EngineFailureCode =
  | 'config-invalid'
  | 'config-untrusted'
  | 'config-changed'
  | 'core-incomplete'
  | 'plugin-threw'
  | 'policy-incomplete'
  | 'content-unavailable'
  | 'patch-invalid'
  | 'patch-conflict'
  | 'fix-cycle'
  | 'fix-pass-limit'
  | 'transaction-failed'
  | 'index-lock-unproven-owner'
  | 'trust-consent-unavailable'
  | 'trust-failed';

export type EngineFailureEvent = EventBase & {
  readonly type: 'engine-failure';
  readonly code: EngineFailureCode;
  readonly message: string;
  readonly trigger?: PolicyTrigger;
  readonly policyId?: string;
  readonly path?: RepositoryPath;
};
```

One causal engine-failure event is emitted for an engine exit.
`core-incomplete` means a fixed transform failed unexpectedly rather than producing an expected core finding.
`index-lock-unproven-owner` means a foreign `index.lock` with a dead or unproven owner outlasted
`indexLock.unprovenOwnerTimeoutMs`;
its message lists the collected holder evidence and states that cli-git left the lock in place
(see "Foreign `index.lock` classification").
Nested exception stacks and arbitrary thrown values remain debug logs rather than schema fields.

### Commit replayed event

```ts
export type CommitReplayedEvent = EventBase & {
  readonly type: 'commit-replayed';
  readonly preparedOid: GitObjectId;
  readonly fromBase?: GitObjectId;
  readonly onto: GitObjectId;
  readonly oid: GitObjectId;
};
```

Emitted once per successful replay,
after revalidation,
when the replayed commit is written.
`fromBase` is the preparation base and is absent when the branch was unborn at preparation.
`onto` is the target value the replay used as parent,
and `oid` is the replayed commit the next landing attempt lands,
including any policy patch or hook change revalidation made.
A later lost race can replay the same transaction again with a new event.
The events of each replay follow the settled preparation pass in this order:
`landing-race-lost`,
`commit-replayed`,
`replay-headers-dropped` when it applies,
and then the revalidation pass's own events,
including its `fix-summary` when a revalidation patch changed bytes.

### Replay headers dropped event

```ts
export type ReplayHeadersDroppedEvent = EventBase & {
  readonly type: 'replay-headers-dropped';
  readonly preparedOid: GitObjectId;
  readonly oid: GitObjectId;
  readonly headers: readonly string[];
  readonly message: string;
};
```

A non-blocking warning emitted immediately after the `commit-replayed` event
of a replay that rebuilt a signed commit carrying custom headers
(see "Replay" in "Transaction protocol").
`headers` lists the dropped header names in their order in the prepared commit,
each name once,
and `oid` is the re-signed commit that lacks them.
The event changes no exit code.

### Landing race lost event

```ts
export type LandingRaceLostEvent = EventBase & {
  readonly type: 'landing-race-lost';
  readonly attempt: number;
  readonly winningOid: GitObjectId;
};
```

Emitted each time a landing finds the target ref moved,
either before its compare-and-swap or through a failed compare-and-swap.
`attempt` counts this transaction's lost races from `1`,
and `winningOid` is the target value that won.

### Commit landed event

```ts
export type CommitLandedEvent = EventBase & {
  readonly type: 'commit-landed';
  readonly oid: GitObjectId;
  readonly outcome: 'post-commit-blocked';
  readonly message: string;
};
```

This event is emitted when a commit exists but a post-commit policy or engine failure makes cli-git return `2` after
real Git succeeded.
It follows any causal finding or engine-failure event and is the final policy event.
An ordinary auto-push network or remote rejection is not an engine failure:
cli-git surfaces complete push output,
leaves the commit local,
and preserves the successful commit command's exit code `0`.

### Stream and exit contract

Wrapper policy events use stderr.
Direct `check` and `fix` policy events use stdout.
Trust management summaries,
statuses,
and failures use stdout;
human trust disclosures use stderr.
Real Git inherits normal stdio.
Debug logs must not corrupt the selected JSONL event stream.

When real Git does not run:

- `0` means clean or warnings only;
- `1` means final error findings;
- `2` means usage,
  trust,
  config,
  plugin,
  patch,
  transaction,
  or engine failure.

When real Git runs,
preserve its exit code except for a landed commit followed by a post-commit policy or engine failure,
which returns `2`.
An ordinary failed auto-push preserves the successful commit result and exits `0` after surfacing the push failure.

For a commit transaction,
the native `git commit` that runs during private preparation is the real Git run:

- a failed preparation
  (a hook,
  the editor,
  signing,
  or Git itself)
  preserves its exit code and lands nothing;
- a `pre-commit` hook that fails when re-run after a replay exits `1`,
  like native Git's hook rejection,
  and lands nothing;
- a `concurrent-commit` core finding exits `1`;
- a landing,
  replay,
  or lock failure that is not a core finding exits `2` with an engine-failure event;
- a landed commit exits `0` unless post-commit policies block,
  which returns `2` as above.

## Trust registry schema version 1

### Account-derived root

Production registry roots are:

- Linux and macOS:
  `<os-account-home>/.local/state/cli-git/trust/v1`;
- Windows:
  `<os-account-home>/AppData/Local/cli-git/trust/v1`.

The account home comes from an operating-system account adapter,
not `HOME`,
`USERPROFILE`,
XDG,
AppData,
or repository environment variables.
Failure to resolve the account home is a trust failure.
Tests inject the complete registry root through an internal adapter unavailable from config or production environment.
The account-derived or injected root must be lexically identical to its native real path;
any symlink or junction in its ancestor chain fails closed.

### Reversible record path

A trust identity is:

```ts
export type TrustIdentity = {
  readonly filesystemId: string;
  readonly canonicalConfigPath: string;
};
```

Encode each UTF-8 identity field with unpadded base64url.
Do not hash it.
The record path is:

```text
<root>/records/<base64url-filesystem-id>/path/<path-chunk-0>/<path-chunk-1>/.../record.json
```

Split encoded canonical path into fixed 120-character chunks;
only the last chunk may be shorter.
An empty encoded value is invalid.
Decoding every segment must reproduce the exact identity stored in `record.json`.
A mismatch is corruption and fails closed.
This reversible hierarchy avoids filesystem component limits while preserving the complete identity.

### Record metadata

`record.json` is UTF-8 JSON with this shape:

```ts
export type TrustSourceRecord = {
  readonly canonicalPath: string;
  readonly snapshotFile: string;
  readonly size: string;
  readonly mtimeNanoseconds: string;
};

export type TrustRecord = {
  readonly schemaVersion: 1;
  readonly identity: TrustIdentity;
  readonly repositoryRoot: string;
  readonly format: 'mjs' | 'typescript';
  readonly sources: readonly TrustSourceRecord[];
  readonly executableSnapshotFile: string;
  readonly executableSize: string;
  readonly recursiveChildren: boolean;
  readonly authorizingRoots: readonly TrustIdentity[];
  readonly recordedAt: string;
};
```

Sizes and nanosecond values are decimal strings to avoid JSON integer precision loss.
`recordedAt` is an RFC 3339 UTC audit timestamp and never participates in trust equality.
Source order is canonical config entry first,
then canonical relative-module path byte order.
Authorizing roots use canonical path byte order and contain no duplicates.

Snapshot file paths are slash-separated record-relative names beneath `snapshots/`.
They cannot be absolute or contain empty,
`.` ,
or `..` segments.
MJS executes its stored source snapshot.
TypeScript executes its stored one-chunk ESM bundle.
No metadata field contains a digest or hash.

### Atomicity and permissions

Write a complete sibling temporary record directory,
fsync its files and directories where supported,
validate it by reopening with no-follow semantics,
then atomically exchange or rename it into place.
Interrupted temporary directories are ignored and recoverable.
Readers never follow symlinks or reparse-point substitutions inside the registry.

On POSIX:

- registry and record directories are mode `0700`;
- metadata and snapshots are mode `0600`;
- every registry-owned directory and file belongs to current effective account;
- unexpected ownership or group or other permission bits fail closed.

On Windows,
the registry adapter disables inheritance and applies an ACL limited to the current account and system administrators
to every registry directory,
metadata file,
and snapshot.
Every read independently verifies the protected ACL and required principals.
Failure to apply or verify protection fails closed.

### MJS self-containment

MJS preflight decodes strict UTF-8 and parses ECMAScript module syntax without execution.
Static imports,
re-exports,
and literal dynamic imports may name only Node built-ins.
Local paths,
package names,
computed dynamic imports,
and additional artifact assets are rejected.
These checks constrain declared artifact module edges,
not ambient authority after consent:
trusted code can still use Node built-ins such as filesystem,
module,
or process APIs to access live state.

### Exact comparison and execution

MJS candidate capture opens the canonical config with no-follow semantics before resolving filesystem identity.
On Linux,
identity resolution targets `/proc/<pid>/fd/<fd>` without resolving that descriptor link first,
so mount identity comes from the opened object.
On hosts without a process-addressable descriptor path,
identity resolution remains path-based but is bracketed by same-handle metadata before and after reading,
final live-path device and inode agreement,
and exact byte length.
Degraded filesystem identity remains explicit in the trust disclosure rather than writing logger text into JSONL event streams.

Strict MJS trust compares live entry bytes to the stored executable snapshot.
Strict TypeScript trust compares every tracked live source byte sequence to its stored source snapshot and does not
rebuild during ordinary Git commands.
Comparison streams bytes and does not compute a digest.
After source equality,
execution opens the already validated stored executable snapshot.
The live entry path is never imported.
This closes entry-file compare-then-swap only.
Trusted code retains ambient Node authority and can deliberately read or dynamically load other live files;
self-containment validation does not sandbox or intercept that behavior.

For TypeScript,
explicit trust always builds a candidate bundle before consent.
Only explicit trust or a relaxed metadata-triggered rebuild compares candidate bundle bytes to the stored bundle for
disclosure and replacement.
Ordinary strict execution never rebuilds or claims to derive expected bundle bytes.
Persistent replacement occurs only after both consent stages and config validation succeed.

## Trust consent protocol

Root preflight safely reads bytes and metadata but does not execute config.
It emits a human-readable disclosure to stderr containing every item required by the decision.
Interactive approval accepts only an explicit affirmative response.
Empty or invalid completed input declines without installing a new record.
When stdin or stderr is not a terminal,
or input ends before a response,
cli-git emits `trust-consent-unavailable`
and recommends `git cli-git trust --yes` after review.
The failed attempt installs or replaces no record;
a previous record remains unchanged.

Root approval authorizes execution of the candidate stored artifact in temporary registry state.
Validation failure deletes temporary state.
If config does not declare child authority,
validated root state is installed atomically.

If config declares `trust.children: true`,
a second disclosure names the canonical repository root and states that current and future descendant mounts inherit
authority.
Declining the second stage installs ordinary root trust with `recursiveChildren: false`.
Unavailable consent during the second stage installs or replaces no record;
a previous record remains unchanged.
Accepting installs it with `recursiveChildren: true`.
`--yes` prints and accepts every applicable disclosure.

## Recursive enrollment and revocation

A recursive root authorizes config paths whose canonical repository roots are strict descendants of the authorized
canonical root.
The path test is component-aware,
not string-prefix matching.
Filesystem identity does not restrict inheritance:
recursive authority intentionally covers same-filesystem and mounted-volume descendants.
Before authorizing a new enrollment,
every covering recursive root must retain its exact trusted identity and bytes.
A missing,
changed,
or mount-replaced root cannot authorize new records.

First descendant encounter builds or validates config in private state,
stores exact snapshots,
and records every currently authorizing recursive root.
It does not prompt.
An auto-enrolled descendant may itself retain `recursiveChildren: true` without another prompt because its authority stays
inside an already consented outer subtree;
removing that inherited outer authority cascades through the nested root.
A mount replacement at the same canonical path has a different filesystem identity and cannot reuse the previous
record.
If an unchanged outer root still authorizes the path,
the replacement receives a new exact auto-enrollment.
Later byte changes fail closed and require explicit trust.

Explicitly trusting a descendant adds an independent self-authorizer that survives outer-root removal.
Record updates are provenance transactions across all affected record directories.

For `untrust`:

1. Resolve the exact current identity without executing config.
2. Compute every inherited descendant record affected by that identity.
3. If the target is a recursive root nested beneath authorizing recursive roots,
   include those outer roots and their inherited descendants.
4. Print the complete affected recursive-root list.
5. Acquire deterministic registry locks in encoded identity byte order.
6. Write the complete new provenance state privately.
7. Atomically install every new record or removal journal.
8. Fsync changed record parents and the private journal directory before transaction completion.
9. Recover interrupted transactions before any later trust operation.

Journals use no-follow private-file validation and reject symbolic links,
non-files,
unsafe ownership,
unsafe modes,
and unsafe Windows ACLs.
When the target config was deleted,
`untrust` resolves the canonical repository root and revokes its sole matching stored record without executing code.

A descendant with an independent explicit authorizer remains installed after inherited authorizers are removed.

## Relaxed-mode parser

The raw value is a comma-separated sequence.
A percent escape is exactly `%25` for percent or `%2C` for comma,
accepted case-insensitively on decode and emitted uppercase on encode.
No other percent escape is valid.
Decode each entry,
then split on the first colon.
Both fields must be non-empty.
Filesystem ID must satisfy the fs-id module's colon-free validated output grammar.
Canonical path must equal platform canonicalization of the config under consideration.

Malformed entries emit one prominent warning per raw entry and are ignored.
A well-formed entry naming the current path with a nonmatching filesystem ID emits a suspicious-entry warning and is
ignored.
Well-formed entries for other paths remain quiet even when their volume is absent.
No entry waives first trust.

For a previously trusted MJS identity with an exact matching entry,
compare stored and live size plus modification time.
A metadata change copies live bytes into a private candidate snapshot,
reruns self-containment checks,
executes and validates that private stored candidate,
then atomically installs it and uses the validated config value for the invocation.
Failure exits `2` and retains the previous record without executing it for that invocation.
When metadata is unchanged,
relaxed mode intentionally continues executing the previous stored snapshot even if an attacker preserved metadata while
changing live bytes.

For a previously trusted TypeScript identity with an exact matching entry,
compare stored and live size plus modification time for tracked sources.
Any metadata change triggers a private rebuild.
A successful rebuild executes and validates the private stored candidate,
then atomically replaces source and executable snapshots and uses that validated config value.
Failure exits `2` and retains the previous record without executing it for that invocation.

## TypeScript build contract

Lazily import Rolldown only when a TypeScript trust build is required.
Invoke its public `rolldown()` interface with:

- Node platform;
- ESM format;
- one output chunk;
- dependencies bundled by default;
- `codeSplitting: false`;
- `tsconfig: false` so no consumer TypeScript project configuration is read;
- in-memory generation in the private build directory.

Close the disposable bundle after generation,
including failure paths,
so native workers and the async runtime cannot retain the process.
Accept exactly one JavaScript chunk and no asset,
source-map,
native binary,
or additional chunk.
Reject unresolved imports except Node built-ins.
Reject nonliteral dynamic imports whose targets cannot be bundled.

Resolve cli-git's package root and `/ts` subpath to the dedicated authoring source entry in the running installed
artifact.
For every other bare import from the entry or a tracked relative source,
use bundled consumer resolution first.
When that resolution is absent,
derive the unscoped package's first segment or the scoped package's first two segments and fall back to the installed
artifact only when that package name occurs in cli-git's packed runtime dependencies.
Do not expose unrelated packages from the installation prefix.

Extract the tracked relative-local source graph from Rolldown chunk module metadata and canonicalize every path.
The graph must include the entry.
Modules outside the repository root,
symlink escapes,
and missing graph entries fail trust.
Bare package modules are bundled but excluded from source invalidation and produce a trust warning.
After bundle generation completes,
re-capture the entry identity and every tracked source;
identity,
exact bytes,
size,
and mtime must still match build inputs before trust can proceed.

Relaxed-entry parser warnings use distinct stable codes for malformed entries and current-path filesystem-identity
mismatches.
A TypeScript rebuild that bundles package imports emits `typescript-package-import-not-invalidated`.
Concurrent relaxed rebuilds may serialize successfully or one may fail closed on the per-record writer lock;
a later invocation must load the complete winning record without repair.

## Transaction protocol

### Scope and phases

Several `git commit` invocations against the same worktree and branch run at the same time,
and each lands as its own sequential commit.
The behavior is on in every repository the wrapper runs in;
no configuration key or environment variable opts out of it.

The production transaction supports explicit-path and `--no-only` commits,
pathspec files including stdin and NUL forms,
selected deletions and untracked files,
`commit -a`,
clean commits that no policy patches,
amend,
allow-empty,
and merge,
cherry-pick,
or revert conclusions.
Every non-dry-run commit runs through it.
The wrapper forwards native `git commit` only for dry runs and short-circuit forms,
because native `git commit` keeps `index.lock` on disk through hooks and the editor.

Each transaction passes through four phases:

1.  Capture:
    at invocation,
    record the transaction facts and snapshot the commit's content.
2.  Preparation:
    in parallel with other transactions and without the real index lock,
    evaluate policies and run native `git commit` against private state.
3.  Landing:
    serially under the landing lock and the real `index.lock`,
    advance the target ref by compare-and-swap and install the real index.
4.  Post-landing:
    outside both locks,
    complete worktree copies,
    run `post-commit` once,
    run post-commit policies,
    and auto-push.

### Invocation capture

At invocation,
before any Git mutation,
the transaction records:

- the preparation base:
  the target's commit OID,
  or unborn;
- the symbolic `HEAD` target:
  a ref name,
  or detached;
- the target ref for compare-and-swap:
  the branch,
  or `HEAD` itself when detached;
- the mode:
  explicit-path or index;
- the conclusion kind:
  none,
  amend,
  merge,
  cherry-pick,
  or revert;
- the repository root,
  common Git directory,
  and real index path,
  honoring a caller-set `GIT_INDEX_FILE`,
  `GIT_DIR`,
  `GIT_WORK_TREE`,
  and global `--git-dir` and `--work-tree`;
- the selected paths;
- the reflog nonce;
- the invocation start time.

Explicit-path commits capture the selected worktree bytes at invocation;
index commits capture the real index at invocation.
Every later read of `HEAD` inside the transaction uses the recorded preparation base or the landed OID,
never live `HEAD`.
Cli-git never re-prepares a commit from current worktree bytes.

Every private index copy and every index install carries the source index's access and modification times
(`index-file-timestamps.ts`):
Git re-hashes a cached entry only when its mtime is not older than the index file's mtime,
so a fresh timestamp would hide same-size edits made in the second Git cached their stat
(`doc/troubleshooting/git-racy-index-copy.md`,
 #544).

### Transaction directory and journal

Transactions live under `<git-dir>/cli-git-transactions/`,
where `<git-dir>` is the worktree's own Git directory.
Each transaction owns `<root>/<transaction-id>/`,
named by a random UUID.
The directory is built under a reserved staging name and published by rename
only after `owner.json` is complete,
so every published transaction names its owner.
Enumeration ignores staging names;
an unpublished staging directory never blocks recovery and remains for diagnosis.

```text
<git-dir>/cli-git-transactions/
  landing.lock/            landing owner lock
  reservation.lock/        landing reservation owner lock
  <transaction-id>/
    owner.json             PID, process-birth identity, schema version, invocation start time
    preparing.json         invocation capture facts
    prepared.json          shadow repository path, prepared OID, signed flag, intended tree, read sets
    reservation-request    empty marker written when the transaction asks for the reservation
    index-lock-<n>.json    identity of the real index.lock attempt <n> created, written right after creating it
    landing-<n>.json       one per landing attempt inside the critical section
    ref-updated.json       exact landed OID
    index-installed        empty completion marker
    hooks/                 hook dispatcher shim: dispatch.mjs, plan.json, and one entry per preparation event
    captured.index         real index at invocation
    commit.index           private commit index native preparation commits
    pre-landing-<n>.index  exact copy of the real index attempt <n> computed against
    post-<n>.index         post-index attempt <n> installs
    install-<n>.index      post-index hard link attempt <n> renames over the real index
    candidate-<k>.state, patch-<k>.diff   convergence snapshots and patch files
    replay-<r>/            replay <r>: commit.index of the replayed tree, candidate-*.state, patch-*.diff
    replay-message-<r>     exact message bytes a signed replay passes to git commit-tree -F

<git-common-dir>/cli-git/shadow/
  <transaction-id>/        shadow repository (see "Private preparation")
```

The shadow repository path is derived from the transaction ID,
so recovery finds it even before `prepared.json` exists.
A shadow repository is created only after its transaction directory is published,
and is removed before its transaction directory,
so no shadow repository outlives the journal that names it.
It is created right after `preparing.json`,
before the private index exists
(see "Private preparation").

State files are created exclusively and never rewritten,
so a crash leaves the newest complete state readable.
Journal records use schema version 2.
Directories are mode `0700`,
files are mode `0600`,
and every read uses no-follow checks that reject symbolic links,
non-regular files,
and unsafe ownership.

`landing-<n>.json` records the expected old OID,
the new OID
(prepared or replayed),
the exact pre-landing real index snapshot identity,
the post-index artifact identity,
the real `index.lock` device and inode,
the migrated pack name
(see "Object migration"),
and the added-path and selected-worktree records.

The legacy single-journal `<git-dir>/cli-git-transaction` directory is recovered read-only
until no retained legacy directory can exist.

### Private preparation

Preparation never mutates the real index,
the worktree,
the target ref,
any other real ref,
or shared reflogs.
It uses:

- a private commit index at `<tx>/commit.index`;
- a shadow repository at `<git-common-dir>/cli-git/shadow/<transaction-id>`
  (see "Shadow repository layout"),
  whose own `HEAD` is the private `HEAD`
  (see "Private `HEAD` shape")
  and whose own object store receives every object preparation writes.

The shadow repository is created right after `preparing.json`,
before the private index is built.
Every cli-git Git command that writes or reads the private index's objects
(`read-tree`,
`add`,
`add --patch`,
`apply --cached --3way`,
`write-tree`,
`diff --cached`,
and the `cat-file --batch` candidate reads)
runs in the owning worktree with `GIT_OBJECT_DIRECTORY=<shadow>/objects`,
whose `info/alternates` names the real object store,
so every blob and tree preparation writes lands in the shadow store.
A real `git gc --prune=now` during preparation therefore cannot delete a staged blob,
which the `gc-prune-during-commits` scenario of the container suite exercises.
Worktree completions after landing read their pre-correction or pre-hook blobs through the same store,
because those blobs never migrate.
Native Git and replay run with `--git-dir=<shadow>` instead;
cli-git's own plumbing keeps the real repository's refs and config.

The shadow repository is a separate repository rather than a registered worktree,
so `git worktree list` never shows it,
and preparation creates no ref in the real repository.
The shadow object store protects the prepared commit until landing:
a real `git prune` or `git gc` never sees the shadow's objects,
so it cannot delete them,
and the shadow reaches real objects only through `objects/info/alternates`,
so a prune run inside the shadow cannot delete real objects.

After policy evaluation settles,
preparation runs native `git commit` with inherited stdio as:

```text
git --git-dir=<shadow> --work-tree=<worktree root>
    -c core.hooksPath=<tx>/hooks
    -c hook.pre-commit.enabled=false -c hook.prepare-commit-msg.enabled=false
    -c hook.commit-msg.enabled=false -c hook.post-commit.enabled=false
    commit <private commit args>
```

with `GIT_INDEX_FILE=<tx>/commit.index`.
`--work-tree` names the same absolute worktree root as the shadow's `core.worktree`;
the command-line value takes precedence for this process,
and `core.worktree` covers a Git process that a hook starts with the shadow as `GIT_DIR`
but without `GIT_WORK_TREE`.
The child environment drops a caller-set `GIT_DIR`,
`GIT_WORK_TREE`,
`GIT_COMMON_DIR`,
and `GIT_OBJECT_DIRECTORY`,
so every object native Git writes lands in the shadow store.
The private commit args drop the user's `--git-dir` and `--work-tree`,
pathspecs,
and the internal `--only`,
because the private index is the complete intended tree.
Git therefore owns hooks,
the editor,
templates,
message cleanup,
and signing.
Native `commit -a` updates only the private index copy.
After Git succeeds,
the prepared OID is the value of the shadow `HEAD`,
and preparation records `prepared.json`.
A commit hook may change the private index while it runs,
as a lint-staged-style formatter rewrites and re-stages files;
native `git commit` commits whatever the hook staged,
and so does the transaction:
the prepared tree is accepted even when it differs from the policy-settled intended tree
(see "Hook-staged changes").
A preparation failure removes the shadow repository and then the transaction directory,
and leaves real index,
worktree,
and real ref bytes unchanged.
Do not invoke Git with a lock path as `GIT_INDEX_FILE`.

#### Shadow repository layout

The shadow repository holds these private entries:

- The ref store:
  `HEAD`,
  `refs`,
  `packed-refs`,
  `reftable`,
  and `logs`.
  It contains the private `HEAD`,
  a snapshot of every real ref taken at invocation
  (`git for-each-ref` in the owning worktree,
  symbolic refs recreated with `git symbolic-ref`),
  and a private copy of the target branch ref at the preparation base
  that replaces the snapshot's entry for that ref.
  Hooks therefore resolve tags,
  other branches,
  and remote-tracking refs as they stood at invocation.
  With the files backend,
  cli-git writes the snapshot as one `packed-refs` file
  (header `# pack-refs with: sorted `,
  with the trailing space Git's own writer emits and older readers require)
  and writes the private target ref as a loose ref through `git --git-dir=<shadow> update-ref`,
  which takes precedence over the packed entry.
  With the reftable backend,
  cli-git writes the snapshot through one `git --git-dir=<shadow> update-ref --stdin` transaction.
  Measured with the files backend
  (Git 2.55.0,
  7 runs each):
  a `packed-refs` snapshot took a median 3.5 ms for this repository's 105 refs
  and 12.2 ms for 20,001 refs,
  while creating loose refs through `update-ref --stdin` took 34.3 ms and 4166.9 ms.
- `objects`,
  a private object store whose `objects/info/alternates` names the absolute real object directory
  resolved at invocation
  (`git rev-parse --git-path objects` in the owning worktree).
- `config`,
  written by cli-git
  (see the config layout in this subsection).
- `config.worktree`,
  copied from the owning worktree's Git directory when present.
- `COMMIT_EDITMSG`,
  which native `git commit` rewrites during every commit,
  so concurrent preparations never share one message file.
- The copied conclusion state
  (see "Sequencer conclusion state").
- `cli-git`,
  which is never linked,
  because the real one contains the shadow directory itself.

Every other entry of the real common Git directory,
such as `info`,
`hooks`,
`rr-cache`,
`lfs`,
and `modules`,
is a symbolic link to the real entry by default.
A per-worktree entry that Git resolves in the owning worktree's Git directory,
such as a linked worktree's `info/sparse-checkout`,
is copied;
a directory that mixes shared and per-worktree entries becomes a private directory
whose shared entries are linked individually.
The shadow has no `index`;
`GIT_INDEX_FILE` names the private commit index.

The shadow `config` has this layout:

```ini
; <git-common-dir>/cli-git/shadow/<transaction-id>/config
[core]
  repositoryformatversion = <copied value>
  hooksPath = <git-common-dir>/hooks
[extensions]
  ; every extensions.* key of the real repository, copied with its value
[include]
  path = <git-common-dir>/config
[core]
  worktree = <worktree root>
[gc]
  auto = 0
[maintenance]
  auto = false
```

- `core.repositoryformatversion` and every `extensions.*` key are copied explicitly,
  because Git does not apply them from an included file.
- `core.hooksPath` precedes the include,
  so a real `core.hooksPath` from the included config still overrides it.
- `core.worktree` follows the include,
  so the real config cannot redirect the shadow's worktree.
- `gc.auto` and `maintenance.auto` follow the include,
  so native `git commit`'s automatic maintenance
  (`run_auto_maintenance` in Git's `builtin/commit.c`)
  never runs in the shadow.

Cli-git writes the file itself,
quoting every path value under git-config value syntax at the final interpolation.

#### Private `HEAD` shape

A prototype in disposable repositories with Git 2.55.0 chose the shadow repository
("Private `HEAD` shape:
 shadow repository with alternates" in `doc/decision/cli-git-concurrent-commits.md`).
It ran a `pre-commit` hook that reads the branch name,
the upstream,
and an `includeIf "onbranch:"` value,
and rejects commits to `main`.

- For a symbolic target,
  the shadow `HEAD` is symbolic to the target branch's own ref name,
  which names the private copy at the preparation base,
  or no ref when the branch was unborn.
  Native `git commit` advances only that private copy.
- For a detached target,
  the shadow `HEAD` is detached at the preparation base.
- `--amend` and merge,
  cherry-pick,
  and revert conclusions read the preparation base through the shadow `HEAD`,
  so they produce native parents and messages.
- No window leaves a prepared commit unprotected:
  it exists only in the shadow store until landing migrates it into a kept pack
  (see "Object migration").

Hooks running during preparation observe:

- the real branch name through `git symbolic-ref HEAD`,
  `git rev-parse --abbrev-ref HEAD`,
  and `git branch --show-current`;
- the branch's upstream through `@{upstream}`,
  because the `branch.<name>.*` config arrives through the include
  and the private upstream copy holds the real value;
- `includeIf "onbranch:<pattern>"` sections matching the real branch,
  so a hook that rejects commits to a protected branch still rejects them;
- the shadow as `git rev-parse --git-dir`
  and the private commit index as `GIT_INDEX_FILE`;
- the shadow ref store's snapshot of every real ref at invocation,
  so tags,
  other branches,
  and remote-tracking refs resolve as they stood at invocation;
- a private `refs/stash`,
  so a hook's `git stash` never touches the real stash list,
  although it still rewrites shared worktree files.

Culled shapes,
with the prototype evidence:

- Detached private `HEAD` with a pending or per-worktree ref:
  hooks see no branch and no upstream,
  so the "reject `main`" hook is bypassed.
- Symbolic `HEAD` naming a pending ref under `refs/cli-git/`:
  the same hook bypass.
  It remains the fallback only if the shadow repository hits a blocker.
- `GIT_REFERENCE_BACKEND` with a private ref store:
  Git passes it into submodules,
  `git -C` from a hook sees the private refs,
  and pseudorefs must be kept in two places.
- A shadow repository using `GIT_OBJECT_DIRECTORY` instead of alternates:
  a prune inside the shadow deleted objects reachable only from real refs.

Residual risk:
a Git-directory-derived path that is neither linked nor copied points into the shadow.
The container end-to-end suite covers LFS,
submodules,
sparse checkout,
reftable,
and SHA-256 repositories
(see "Container end-to-end suite").

#### Hook dispatcher shim

Hooks run through a dispatcher shim passed with `-c core.hooksPath=<tx>/hooks`
plus `-c hook.<event>.enabled=false` for each event.
`hook.<event>.enabled=false` suppresses config-based hooks but not the hookdir hook,
and `core.hooksPath` alone does not disable config-based hooks
(`doc/troubleshooting/git-hook-disable-switches.md`),
so both are required.

- The shim is a runtime-generated Node program,
  not a shell script,
  and nothing new ships in the tarball.
  `<tx>/hooks/dispatch.mjs` holds the program text,
  and `<tx>/hooks/plan.json` holds the dispatch plan,
  encoded with `JSON.stringify` at the final interpolation.
- `<tx>/hooks/pre-commit`,
  `prepare-commit-msg`,
  and `commit-msg` are executable files whose first line is `#!<process.execPath>`
  and whose body imports `dispatch.mjs` by absolute file URL with the event name.
  `post-commit` is intentionally absent,
  so it never runs during preparation.
- The plan records the repository's own `core.hooksPath`
  (absent means `<git-common-dir>/hooks`;
  a relative value resolves against the worktree root),
  the events the user disabled through `hook.<event>.enabled`,
  the config parameters native Git would hand its hooks or their absence,
  the real Git path,
  the absolute worktree root,
  the preparation lease,
  the hook lock path,
  and whether the hook lock is skipped.
  The config parameters are the caller's inherited `GIT_CONFIG_PARAMETERS` followed by the caller's global `-c` options,
  each quoted in Git's `sq_quote` form
  (`'` and `!` close and reopen the quote);
  they are absent when the caller had neither,
  so cli-git's own `core.hooksPath` and `hook.<event>.enabled` overrides never reach a hook.
- The program restores those config parameters,
  exports `GIT_WORK_TREE` as the absolute worktree root
  (Git otherwise rewrites it to `.` for hooks,
  `doc/troubleshooting/git-private-admin-dir-hook-environment.md`),
  skips user-disabled events,
  takes the hook lock
  (see "Hook lock"),
  runs
  `git -c hook.<event>.enabled=true -c core.hooksPath=<original> hook run --ignore-missing <event> -- <args>`,
  releases the hook lock,
  and propagates the exit status.
- The program exports `CLI_GIT_PREPARATION_LEASE`.
  A nested wrapper invocation that inherits a valid lease skips startup transaction recovery and hook-lock acquisition,
  and an index writer whose `GIT_INDEX_FILE` names the transaction's private index
  never takes the landing lock.

The shebang form for Windows,
where Git for Windows parses shebangs itself,
and for a `process.execPath` containing spaces is pending verification.

Hooks observe the branch state listed in "Private `HEAD` shape".
A `pre-commit` hook that runs `git stash` writes its entry to the shadow's private `refs/stash`
but still transiently touches the shared worktree;
the hook lock serializes only cli-git's own hook runs.

#### Hook lock

The hook lock is an owner lock at `<git-common-dir>/cli-git/hook.lock`.
The dispatcher shim takes it around each preparation hook event,
so an open message editor never holds it.
The re-run of `pre-commit` after a replay goes through the same shim,
so the shim takes it there too,
and cli-git takes it around the post-landing `post-commit`.
It is skipped when `hooks.concurrentCommits` is `true`
and when a valid preparation lease is inherited.

### Policy evaluation during preparation

Preparation constructs candidate facts from the private index,
validates one-target ordinary text patches,
applies them sequentially through `git apply --cached --3way`,
and restarts the whole ordered policy sequence after exact candidate changes.
Only the final unchanged pass emits findings.
Each policy's read set is recorded in `prepared.json`
(see "Policy inputs and read sets").
Policy exceptions,
patch conflicts,
and failed Git hooks discard private state without changing real index,
worktree,
or shared ref bytes.

Interactive and patch selection runs through native Git once against the copied private index;
include selection stages into that private index.
Policies receive the exact chosen candidate but cannot apply automatic patches.
Warning findings allow the settled private index to commit;
error findings block with direct-fix guidance.
Unmerged indexes block automatic correction.

#### Index commit

For ordinary index semantics:

1.  Copy the real index captured at invocation.
2.  Apply selected patches to the copy with `git apply --cached --3way`.
3.  Run native `git commit` privately with the copied index.
4.  Record `prepared.json`.

The real index is computed at landing
(see "Real index at landing").

#### Explicit-path commit

For injected commit-only semantics:

1.  Build a commit index from the preparation base.
2.  Add exact selected worktree paths to that index using Git pathspec semantics.
3.  Apply policy patches to the commit index.
4.  Remove pathspecs and internal `--only` before invoking native Git
    because the private index is the complete intended tree.
5.  Record `prepared.json`.

Merge,
cherry-pick,
and revert conclusions use index-commit semantics only.

#### Added paths

Paths added by policy patches join the candidate paths of every later pass,
the explicit-path post-index selection,
and the prepared journal,
which records each path's mode,
original blob,
and intended blob.
After the landing installs the real index and writes `index-installed`,
and before cleanup,
each added path's worktree copy is compared with both blobs:
intended bytes are left alone,
original bytes are replaced through a same-directory temporary file and rename with the recorded mode,
and any other bytes are kept with a warning,
because the commit has landed and overwriting would discard a concurrent edit.
Unsupported interactive/include modes use read-only checks and direct-fix guidance when needed.

Direct fix admits added paths under the same precondition,
`HEAD`,
real index,
private index,
and worktree all holding the target blob,
through `createAddedPathTracker`,
which commit transactions share.
It has no journal or index step:
converged bytes of added paths join the direct-fix worktree installation.
Precondition failures are `patch-conflict` with direct-fix remedies
(select the path,
 or restore it to `HEAD`).

#### Hook-staged changes

A `pre-commit` hook that edits files and re-stages them,
as lint-staged does,
changes the private index native Git commits.
The transaction keeps that tree,
as native Git keeps it,
and diffs the policy-settled tree against the committed tree
(`git diff-tree -r --raw --no-renames`)
to learn the hook's paths:

- Explicit-path commits reset each hook path outside the selection in the post-index to the landed entry
  only while its real index entry still equals the one captured at invocation;
  an entry restaged since then is kept,
  with a warning naming the path.
  Selected paths are reset as always.
- Index commits need nothing extra:
  the landed index is the hook's private index,
  and the per-path merge of "Real index at landing" already takes landed entries only for unchanged paths.
- A path modified in place as an ordinary file joins the worktree completions of `prepared.json`
  with its pre-hook blob as the original and its committed blob as the intended bytes,
  under the "Added paths" comparison:
  a worktree copy still holding the pre-hook bytes receives the committed bytes,
  one already holding them is left alone,
  and any other bytes are kept with a warning.

A `pre-commit` re-run after a replay is handled the same way
(see "Revalidation after replay").

### Landing

Commits land in preparation completion order.
One landing attempt runs these steps:

1.  Wait while a live reservation owned by another transaction exists
    (see "Starvation reservation").
2.  Acquire the landing lock,
    then the real `index.lock` under the foreign-lock rules
    (see "Foreign `index.lock` classification"),
    and write cli-git's own owner PID file in Git's `core.lockfilePid` format.
3.  Fail with `concurrent-commit/branch-switched` when `git symbolic-ref -q HEAD`
    differs from the recorded symbolic `HEAD` target.
4.  Read the target ref.
    When it still equals the expected old value
    (the preparation base,
    or the parent of the latest replay),
    the new OID is the prepared or replayed commit;
    a prepared commit keeps its exact bytes and signature.
    When it moved and the commit is an amend,
    a conclusion,
    or a normalization,
    or when the target no longer names a commit,
    fail with `concurrent-commit/head-moved`.
    When it moved otherwise,
    record a lost race,
    emit `landing-race-lost`,
    release both locks,
    replay and revalidate outside the locks
    (see "Replay" and "Revalidation after replay"),
    and restart at step 1.
5.  Migrate the new commit's shadow-only objects into the real object store as a kept pack
    (see "Object migration").
6.  Copy the current real index,
    compute the post-index against it
    (see "Real index at landing"),
    and write `landing-<n>.json`,
    which records the migrated pack name.
7.  Advance the target by compare-and-swap:
    `git update-ref -m <reflog message> <target> <new> <old>`,
    with the all-zero OID as `<old>` for an unborn target
    and `--no-deref` on `HEAD` for a detached target.
    `<target>` is the branch ref itself,
    `refs/heads/<branch>`,
    never `HEAD`,
    so a `reference-transaction` hook sees exactly one committed update of the branch ref,
    and Git still writes the `HEAD` reflog because `HEAD` is symbolic to it.
    `<old>` is the expected old value of step 4.
    A compare-and-swap failure removes the migrated pack's `.keep`,
    counts as a lost race,
    and continues as in step 4.
8.  Write `ref-updated.json`,
    remove the migrated pack's `.keep`,
    install the post-index through the held lock with an owner-preserving hard link,
    write `index-installed`,
    reproduce native conclusion-state cleanup in the owning worktree's Git directory
    (see "Sequencer conclusion state"),
    and release both locks.

Every real-repository Git command in a landing,
including the compare-and-swap,
runs in the owning worktree's context as captured at invocation:
its working directory and environment,
never `--git-dir`,
and never a `GIT_DIR` naming the common directory or the shadow.
Only then does `git update-ref` on the branch also write the real `HEAD` reflog.

The reflog message is `commit (cli-git <nonce>): <subject>`.
After a landing,
the target reflog,
and the `HEAD` reflog when `HEAD` is symbolic,
each contain the nonce entry exactly once;
a disposable fixture verifies that the chosen `update-ref` form writes both.

The landing critical section never runs hooks,
the editor,
signing,
network operations,
or the hook lock.
Every landing-lock acquisition first recovers dead transactions that hold a landing record
(see "Recovery"),
so a crashed landing is resolved before another landing moves the ref or index.

#### Real index at landing

The real index is always computed against the then-current real index,
never against the invocation-time copy,
so a landing never erases another invocation's staging
and never stages a revert of landed content.

- Explicit-path:
  the current real index with the committed paths,
  including policy-added paths,
  reset to the landed tree.
- Index mode:
  when no replay happened and the current real index is byte-identical to the one captured at invocation,
  the post-index is the private index native preparation committed,
  exactly what native Git would leave.
  Otherwise,
  for each path the landed tree changes relative to the preparation base or to the tree of the captured index,
  take the landed entry only when the current real index entry still equals the captured one;
  otherwise keep the current entry,
  because it was restaged after invocation.
  After a replay the landed entries come from the replayed private index,
  and the wholesale copy is never used,
  because an index read from a tree carries no stat data,
  skip-worktree bits,
  or intent-to-add entries.
- Hook-staged paths follow "Hook-staged changes".

Every copy and install keeps the source index timestamps.

#### Object migration

Before the compare-and-swap,
landing copies every object the new commit reaches that exists only in the shadow store
into the real object store:

```text
git --git-dir=<shadow> pack-objects --revs --local --stdout
  | git index-pack --stdin --keep=<keep message>
```

- `pack-objects` reads `<new>` and,
  unless the expected old value is unborn,
  `^<old>` on standard input,
  where `<old>` is the expected old value of "Landing" step 4:
  the preparation base,
  or the replay parent.
  `--local` skips every object borrowed through `objects/info/alternates`,
  so the pack holds only shadow-store objects.
- `index-pack` runs in the owning worktree's context,
  so it writes into the real `objects/pack`.
  `--keep` creates the `.keep` file before the pack and its index become visible
  (`final` in Git's `builtin/index-pack.c`),
  so neither `git prune` nor a concurrent repack can drop the objects
  between migration and the compare-and-swap.
  The line it prints
  (`keep`,
  a tab,
  and the pack hash)
  names the pack,
  which `landing-<n>.json` records.
- The keep message is `cli-git <transaction-id>`,
  so recovery finds a `.keep` even when a crash preceded `landing-<n>.json`.

The `.keep` is removed once `ref-updated.json` is written,
after a failed compare-and-swap,
and by recovery.
A pack whose compare-and-swap failed stays as unreachable objects until `gc` expires them;
the shadow store still holds the same objects for the next attempt.

#### Replay

A lost race replays the prepared commit onto the current target outside both locks,
because signing can prompt.
Replay runs in the shadow
(`git --git-dir=<shadow>`),
so every object it writes stays in the shadow store until the next migration;
the current target's objects resolve through the alternates.
Every replay starts again from the prepared commit and the preparation base,
whichever earlier replay lost its race.

- The tree comes from
  `git merge-tree --write-tree --name-only -z --merge-base=<base> <current> <prepared>`,
  run with the worktree root as its working directory so conflicted paths are reported from the repository root.
  `<base>` is the preparation base,
  or for a branch that was unborn at preparation a root commit of the empty tree
  that cli-git writes into the shadow store,
  because Git 2.40 accepts only a commit as `--merge-base`
  (`object ... is a tree, not a commit`,
   measured 2026-09-26).
  The output is the tree ID and a NUL;
  on a conflict,
  each conflicted path NUL-terminated follows,
  then an empty record and the informational messages.
  Exit `1` is a conflict even though a tree ID prints;
  an exit above `1` is a replay failure.
- The replayed tree is revalidated
  (see "Revalidation after replay")
  before any commit object is written,
  so a signed commit is re-signed once per replay.
- An unsigned prepared commit is rebuilt by rewriting its raw object:
  cli-git reads `git cat-file commit <prepared>` as bytes,
  replaces only the `tree` line with the revalidated tree
  and the `parent` line with `<current>`
  (inserting a `parent` line after `tree` when the preparation base was unborn),
  and writes the result with `git hash-object -t commit -w --stdin`.
  Every other header,
  continuation lines included,
  and the message bytes stay exact,
  including `encoding`,
  the author and committer identities and dates,
  and custom headers.
  `git replay` and plain `git commit-tree` both transcoded non-UTF-8 messages and dropped custom headers in the prototype.
- A signed prepared commit,
  one carrying a `gpgsig` or `gpgsig-sha256` header,
  is rebuilt with
  `git <caller global options> -c i18n.commitEncoding=<encoding> commit-tree <tree> -p <current> -S[<key id>] -F <tx>/replay-message-<r>`,
  where `<encoding>` is the prepared commit's `encoding` header value or `utf8` when absent,
  `<key id>` is the key the invocation passed to `-S` or `--gpg-sign` when one was given,
  `replay-message-<r>` holds the exact message bytes,
  and `GIT_AUTHOR_NAME`,
  `GIT_AUTHOR_EMAIL`,
  `GIT_AUTHOR_DATE`,
  and the committer triple come from the prepared commit's raw identity lines
  (dates as `@<seconds> <zone>`).
  No Git primitive re-signs a raw object,
  so any header other than `tree`,
  `parent`,
  `author`,
  `committer`,
  `encoding`,
  `gpgsig`,
  and `gpgsig-sha256` is dropped,
  and cli-git emits `replay-headers-dropped`.
  Native `git commit` writes no such header on an ordinary commit,
  so through the wrapper this happens only for objects a hook or another tool built.
- A successful replay emits `commit-replayed`.

A conflict fails without landing as `concurrent-commit/replay-conflict`
with exit `1`
and leaves ref,
real index,
and worktree bytes unchanged.
`winningOid` is the first line of
`git rev-list --reverse <current> ^<base> -- <conflicting paths>`
(without `^<base>` when the base was unborn),
or `<current>` when that lists nothing.
Before the shadow repository is removed,
cli-git migrates the prepared commit into the real object store as a pack without `.keep`
(the "Object migration" command without `--keep`,
with the preparation base as the excluded revision),
so the prepared commit survives until `gc` expires unreachable objects
and the user can cherry-pick it.
Any other replay or revalidation failure,
such as a failed `merge-tree` or signing,
is a `transaction-failed` engine failure with exit `2`.
Path-level replay and automatic re-preparation are not used.

#### Revalidation after replay

After a clean merge,
revalidation runs outside both locks
in a private directory `<tx>/replay-<r>/`:

1.  `git read-tree <merged tree>` into `replay-<r>/commit.index`,
    in the shadow store.
2.  Move the shadow `HEAD` target
    (the branch ref,
     or detached `HEAD`)
    to `<current>`,
    so policies and hooks see the parent the commit will have.
3.  Re-run every cli-git policy against the paths the replayed tree changes relative to `<current>`.
    Until policy read sets exist,
    every policy is treated as unrestricted.
    Patches converge under the ordinary pass-limit and cycle rules,
    and policy-added paths follow "Added paths",
    checked against the real index captured at invocation.
    A blocking finding or engine failure lands nothing and returns that result.
4.  When the tree after policies differs from the tree `pre-commit` last approved
    (the prepared tree at the first replay)
    and the invocation did not pass `--no-verify` or `-n`,
    re-run `pre-commit` against `replay-<r>/commit.index`:
    `git <caller global options> --git-dir=<shadow> --work-tree=<worktree root> -c core.hooksPath=<tx>/hooks`
    with every commit event's `hook.<event>.enabled=false`,
    `hook run --ignore-missing pre-commit`,
    `GIT_INDEX_FILE` naming the replayed index,
    and `GIT_EDITOR=:`,
    as native Git runs `pre-commit` when no editor is used.
    The dispatcher shim takes the hook lock and runs the repository's hooks.
    `prepare-commit-msg` and `commit-msg` do not re-run,
    because the message is fixed.
    A failing `pre-commit` lands nothing,
    removes the shadow repository and the transaction,
    and exits `1` without a JSONL event,
    like native Git's hook rejection.
    Changes the hook staged are kept
    (see "Hook-staged changes").
5.  Build the replayed commit from the prepared commit on the resulting tree
    (see "Replay").

Worktree completions of preparation are pointed at the blobs the replayed tree holds;
a path the replayed tree no longer holds as the same ordinary file drops its completion.
Landing then retries from step 1 of "Landing"
with the replayed commit,
`<current>` as the expected old value,
the union of the selected and revalidated paths as the committed paths,
and `replay-<r>/commit.index` as the landed index.
The loop ends when the commit lands,
its replay conflicts,
revalidation rejects it,
or the target cannot take it.
The reservation after `landing.reserveAfterLostRaces` lost races plugs in before each landing attempt
(see "Starvation reservation");
until it exists,
a commit replays after every lost race.

#### Amend, conclusions, and branch switches

- `--amend`,
  merge,
  cherry-pick,
  and revert conclusions fail with `concurrent-commit/head-moved` when the target moved.
- Every commit fails with `concurrent-commit/branch-switched`
  when the symbolic `HEAD` target changed since invocation.
- A detached `HEAD` lands by compare-and-swap on `HEAD` itself.
- Concurrency covers one worktree and branch;
  Git refuses to check out one branch in two worktrees.

#### Sequencer conclusion state

Merge,
cherry-pick,
and revert conclusions run under private preparation.
In the prototype,
copying the per-worktree state into the shadow produced commits byte-identical to native Git
("Conclusions and replay" in `doc/decision/cli-git-concurrent-commits.md`).

At preparation,
cli-git copies each present entry of the owning worktree's conclusion state into the shadow:
`MERGE_HEAD`,
`MERGE_MSG`,
`MERGE_MODE`,
`SQUASH_MSG`,
`AUTO_MERGE`,
`CHERRY_PICK_HEAD`,
`REVERT_HEAD`,
`MERGE_RR`,
and `sequencer/`.
In a reftable repository,
`AUTO_MERGE`,
`CHERRY_PICK_HEAD`,
and `REVERT_HEAD` live in the ref store rather than as files
(only `FETCH_HEAD` and `MERGE_HEAD` stay files,
`is_pseudo_ref` in Git's `refs.c`),
so cli-git reads them with `git rev-parse --verify --quiet`
and writes them into the shadow with `git update-ref`.

Native `git commit` then cleans up inside the shadow.
Its `rerere` step writes the recorded resolution's postimage into `rr-cache` during preparation,
through the linked real `rr-cache`,
and updates the shadow's private `MERGE_RR`.

At landing step 8,
cli-git reproduces native cleanup in the owning worktree's Git directory:

- It removes each of `AUTO_MERGE`,
  `MERGE_HEAD`,
  `MERGE_MODE`,
  `MERGE_MSG`,
  `SQUASH_MSG`,
  `CHERRY_PICK_HEAD`,
  and `REVERT_HEAD` that native Git removed from the shadow.
  `SQUASH_MSG` joins the list the prototype observed because native `git commit` unlinks it too
  (`builtin/commit.c`).
  A reftable repository deletes store-held entries with `git update-ref -d <name> <copied value>`
  instead of removing files.
- An entry is removed only while it still holds the bytes or value copied at preparation;
  a changed entry was written by another command after invocation and is kept.
- It copies the shadow's `MERGE_RR` back.
- It keeps `ORIG_HEAD`.
- It leaves `sequencer/` as native Git leaves it:
  removed only when native Git removed the shadow copy after the last pick
  (`sequencer_post_commit_cleanup` in Git's `sequencer.c`),
  otherwise untouched.

### Post-landing

After both locks are released:

1.  Complete added-path worktree copies
    (see "Added paths"),
    remove the shadow repository,
    and then remove the transaction directory.
2.  Run `post-commit` once through `git hook run post-commit` in the real worktree,
    under the hook lock unless `hooks.concurrentCommits` is `true`,
    with native-equivalent `GIT_INDEX_FILE`,
    `GIT_AUTHOR_NAME`,
    `GIT_AUTHOR_EMAIL`,
    `GIT_AUTHOR_DATE`,
    and `GIT_EDITOR=:`.
    Its exit status is ignored,
    as in native Git.
3.  Run post-commit policies with the landed OID
    (see "Post-commit").
4.  Auto-push
    (see "Auto-push").

### Starvation reservation

A transaction that has lost `landing.reserveAfterLostRaces` races writes `reservation-request`
and asks for the landing reservation.
The reservation is an owner lock at `<git-dir>/cli-git-transactions/reservation.lock` holding the transaction ID.

- Reservations are granted oldest invocation first:
  a free reservation goes to the live requesting transaction with the earliest recorded invocation start time,
  with ties broken by transaction ID byte order.
- While a live reservation owned by another transaction exists,
  a transaction may prepare,
  replay,
  and revalidate,
  but waits before landing.
- The holder releases the reservation after it lands or fails.
- A dead owner's reservation and request are retired through the owner-liveness check.

### Locks

Cli-git's own locks are rename-published owner-lock directories carrying process-birth identity,
the mechanism the worktree-copy settlement lock already uses.
A lock whose owner is dead,
including PID reuse,
is retired by the next acquirer.

- Landing lock,
  `<git-dir>/cli-git-transactions/landing.lock`:
  unbounded wait while its owner lives.
- Reservation lock,
  `<git-dir>/cli-git-transactions/reservation.lock`:
  unbounded wait while its owner lives.
- Hook lock,
  `<git-common-dir>/cli-git/hook.lock`:
  unbounded wait while its owner lives.
- Push locks,
  `<git-common-dir>/cli-git/push/<encoded-ref>.lock`:
  unbounded wait while their owner lives.
- Worktree-copy settlement lock:
  unchanged bounded acquisition,
  held only by applicable sources
  (see "Linked-worktree ignored-state synchronization").

An owner is alive only while its PID names a running process with the recorded birth identity.
On Linux a process in state `Z`
(exited but not reaped)
or `X` counts as exited:
a zombie keeps its PID and start time,
and inside a container whose PID 1 does not reap orphans,
such as a Node process,
the zombies a `SIGKILL`ed process group leaves are never reaped,
so treating them as alive made every later acquirer wait forever.
The hook dispatcher shim applies the same rule to the hook lock.
A hook process orphaned by a killed wrapper but still running keeps the hook lock until it exits:
it may still rewrite worktree files,
which is what the lock serializes.

Lock order is reservation check,
landing lock,
then real `index.lock`.
No process takes the hook lock or a push lock while holding the landing lock.

Cli-git never deletes a foreign lock.
Recovery removes a real `index.lock` only when a journal proves a dead transaction owner created it,
by the recorded device and inode.

#### Lock PID injection

Cli-git injects `core.lockfilePid=true` into every forwarded and spawned Git
by appending it through `GIT_CONFIG_COUNT`,
`GIT_CONFIG_KEY_<n>`,
and `GIT_CONFIG_VALUE_<n>` while preserving existing entries,
so native Git leaves an owner PID file beside each lock
and the shim's restoration of `GIT_CONFIG_PARAMETERS` does not remove the setting.
The wrapper installs the entry into its own environment at startup,
so every Git it forwards or spawns inherits it.
Nothing is appended when the last numbered `core.lockfilePid` entry already reads as true,
or when `GIT_CONFIG_COUNT` is malformed,
so Git still reports the caller's error.
Git reads the numbered entries before `GIT_CONFIG_PARAMETERS`,
so a caller's explicit `-c core.lockfilePid=false` still wins.
`core.lockfilePid` first shipped in Git 2.54.0;
an older Git ignores the unknown key and produces no PID evidence.

#### Foreign `index.lock` classification

Before cli-git creates the real `index.lock`,
and before it forwards an index writer,
it classifies an existing lock from evidence re-read on every attempt:

- the lock's device,
  inode,
  and ctime;
- the Git PID file and whether that process is alive and started no later than the lock's ctime,
  allowing for the start time's clock resolution
  (20 ms on Linux,
  from start ticks and `/proc/uptime`;
  1 s on macOS,
  from `ps -o lstart=`);
  a zombie counts as exited,
  and a process started later means the PID was reused;
- open holders matched by device and inode,
  never by path:
  `/proc/<pid>/fd` on Linux,
  `lsof` on macOS,
  and a Restart Manager query on Windows,
  where the `DELETE`-access probe is never used because it can delay Git's own rename.
  `lsof` and Restart Manager are spawned only while a foreign lock is present.
  Unreadable processes are recorded as partial evidence.

The verdict is proven alive,
dead,
or evidence-free:

- A proven-alive owner gets an unbounded wait with one human-readable stderr line naming the holder.
- A dead or evidence-free owner gets Git-style quadratic backoff with jitter up to
  `indexLock.unprovenOwnerTimeoutMs`,
  then `index-lock-unproven-owner` with exit `2`,
  listing the evidence,
  leaving the lock in place,
  and forwarding nothing.

An absent open holder does not prove abandonment:
native `git commit` keeps `index.lock` on disk without an open descriptor through its hooks and editor.

The open-holder scan runs only when the PID file does not already prove a live owner.
The unproven budget counts all time spent in attempts without a proven owner,
evidence gathering included,
because a Linux `/proc` scan over about 1000 processes took 59 to 106 ms on the development host.
While a proven-alive owner holds the lock,
polls are capped at 100 ms when a PID file proves it
and at 500 ms when only an open descriptor does,
because each of those polls repeats the scan.

#### Index-writer coordination

Forwarded index writers coordinate with landings through the landing lock.
Cli-git classifies them from parsed arguments:
`add`,
`rm`,
`mv`,
`restore --staged`,
`reset` except `--soft`,
`stash`,
`checkout`,
`switch`,
`merge`,
`rebase`,
`cherry-pick`,
`revert`,
`apply --cached` and `apply --index`,
`update-index`,
`read-tree`,
`am`,
`pull`,
and `sparse-checkout`.
Classification uses the command after ordinary alias resolution,
and long options match in full or as the abbreviations Git accepts for them.
A writer is against the real index when `git rev-parse --git-path index` names `<git-dir>/index`,
so a writer redirected by `GIT_INDEX_FILE`,
such as a hook of a private preparation,
is not coordinated.
For a classified writer against the real index,
cli-git takes the landing lock,
pre-waits for a foreign `index.lock` under the classification rules,
forwards the command,
and releases the landing lock after real Git returns.
Cli-git does not capture Git's stderr to detect a lock failure and re-forward,
because capturing stderr changes Git's color and progress output.
A residual race remains only with processes that bypass the wrapper.

The forwarded Git receives `CLI_GIT_LANDING_LEASE` naming the held landing lock and its owner token.
Hooks and `rebase --exec` commands of that Git can invoke the wrapper again;
a nested invocation whose inherited lease names the same,
still-held landing lock proceeds without taking the landing lock or pre-waiting for `index.lock`,
exactly as native Git would run,
instead of waiting for its own ancestor.
A nested commit transaction lands under the ancestor's landing lock the same way.

`git cli-git fix` holds the landing lock as described in "Direct fix".

### Recovery

At wrapper startup,
before config loading or forwarding,
recovery enumerates every published transaction under `<git-dir>/cli-git-transactions/`
and the legacy directory.
Management help returns before recovery.

- An owner that is alive with a matching birth identity is skipped at debug log level;
  its transaction is not an error.
  PID reuse counts as a dead owner.
- A dead owner without a landing record:
  remove every `.keep` in the real `objects/pack` whose message is `cli-git <transaction-id>`,
  retire any reservation or reservation request it owns,
  remove the shadow repository,
  and then remove the transaction directory.
  The real index and real refs were never touched.
- A dead owner with a landing record is recovered only while holding the landing lock,
  so recovery never races a live lander.
  Recovery removes the transaction's `.keep` files as for an owner without a landing record,
  then either discards an unlanded attempt,
  installs the recorded post-index for a landed commit whose index install was interrupted,
  or recognizes a completed install.
  For a landed commit it also completes the conclusion-state cleanup from the shadow
  (see "Sequencer conclusion state")
  and added-path worktree copies with the "Added paths" comparison.
  It then removes the shadow repository and the transaction.
- A published directory without a valid owner record,
  or with malformed state,
  fails closed with the path named and preserves its contents.

Recovery validates the expected old OID,
the landed OID,
the pre-landing and intended index snapshots,
and the recorded artifact and lock identities without hashes.
Before the exact `ref-updated.json` marker exists,
a landing counts as landed only when the target ref's reflog contains the transaction's nonce entry
with the recorded new OID;
recovery searches the whole reflog,
because other landings can follow a crashed one.
Missing nonce evidence,
or a real index that no longer matches the recorded pre-landing snapshot,
fails closed rather than guessing.
Recovery stabilizes exact artifacts through verified same-filesystem hard links,
installs only through an owner-preserving hard link rather than the mutable lock pathname,
refuses unsafe or replaced filesystem artifacts,
and preserves conflicting evidence after unrelated ref or index movement.

### Compatibility and degradation

Cli-git declares a minimum Git version covering `git hook run --ignore-missing`
and `git merge-tree --write-tree --merge-base`.
A Git below that minimum fails commit transactions with `transaction-failed` naming the missing feature.
Missing optional features degrade per feature:
without `core.lockfilePid`,
foreign locks have no PID evidence;
without replay plumbing,
a moved target fails the commit without landing with `transaction-failed`,
the fail-fast behavior that predates replay.

### Required disposable fixtures

Existing transaction behavior,
each run through private preparation:

- ordinary staged commit;
- explicit-path commit;
- explicit `--no-only`;
- clean commit that no policy patches;
- `commit -a` with `--no-enforce-only`;
- partial staging with unstaged tail;
- unrelated staged paths;
- deletion;
- untracked selected path;
- `--pathspec-from-file` from ordinary files,
  standard input,
  and NUL form;
- amend;
- allow-empty;
- merge conclusion;
- cherry-pick conclusion;
- revert conclusion;
- commit hook failure before ref update;
- real-Git failure;
- patch conflict;
- invalid patch;
- read-only administrative filesystem failure and healthy next invocation;
- hk duplicate-separator regression bytes;
- policy-added path in explicit-path,
  `--no-only`,
  and amend commits,
  with committed,
  indexed,
  and worktree bytes and clean status;
- policy-added path blocked by unstaged worktree changes and by staged changes;
- policy-added path refused under `--include` selection;
- policy-added path in merge,
  cherry-pick,
  and revert conclusions;
- racily clean same-size edit kept visible through direct fix,
  explicit-path and `--no-only` commits that apply a fix,
  a landing index install,
  and a recovery index install;
- policy-added path in direct fix:
  clean unselected path rewritten in the worktree with exact real index bytes,
  dirty unselected path refused,
  and the same path fixed once selected.

Private preparation:

- hookdir and config-based hooks each run once;
- a hook that changes into a subdirectory sees the correct top level and an absolute `GIT_WORK_TREE`;
- `post-commit` does not run during preparation;
- shared `HEAD`,
  branch,
  every other real ref,
  reflogs,
  and real index bytes stay unchanged during preparation;
- a `pre-commit` hook sees the real branch name,
  the upstream,
  and a matching `includeIf "onbranch:"` value,
  and a hook that rejects commits to `main` rejects one;
- a real `git prune --expire=now` and `gc --prune=now` during preparation keep the prepared commit,
  and `git prune --expire=now` inside the shadow keeps objects reachable only from real refs;
- a real `core.hooksPath`,
  `extensions.worktreeConfig` with `config.worktree`,
  and a real `gc.auto` or `maintenance.auto` setting each take the effect "Shadow repository layout" states;
- two concurrent preparations never share a `COMMIT_EDITMSG`;
- preparation in LFS,
  submodule,
  sparse-checkout,
  reftable,
  and SHA-256 repositories,
  and in a linked worktree;
- SSH-signed preparation stays signed;
- `--amend`,
  `--allow-empty`,
  and merge,
  cherry-pick,
  and revert conclusions produce native parents and messages,
  byte-identical to native Git for the conclusions;
- shim plan with `core.hooksPath` absent,
  relative,
  and absolute,
  user-disabled events,
  caller `GIT_CONFIG_PARAMETERS` present and absent,
  and adversarial paths with quotes,
  newlines,
  and spaces;
- `git worktree list` output unchanged by the shadow repository;
- a preparation failure leaves no shadow repository.

Landing and replay:

- disjoint explicit-path commits land in completion order with native parents;
- non-overlapping hunks in one file replay cleanly;
- overlapping hunks fail with `concurrent-commit/replay-conflict` and leave ref,
  real index,
  and worktree exact,
  and the named prepared commit can be cherry-picked after the shadow repository is gone;
- the migrated pack keeps its `.keep` until the compare-and-swap succeeds or fails,
  a real `git prune --expire=now` and `git repack -a -d` between migration and compare-and-swap keep the objects,
  and no `cli-git` `.keep` remains afterwards;
- the real `HEAD` reflog receives the landing entry when `update-ref` runs in the owning worktree's context,
  checked in the main worktree and a linked worktree;
- a signed commit landing without replay keeps its exact bytes;
  a replayed signed commit is re-signed with an SSH key generated in the fixture;
- an unsigned replayed commit keeps its `encoding` header,
  exact identity and date lines,
  and a custom header;
- a signed replayed commit with a custom header drops it and emits `replay-headers-dropped`;
- merge,
  cherry-pick,
  and revert conclusions leave the owning worktree's Git directory as native Git does:
  the removed state files,
  `MERGE_RR`,
  `ORIG_HEAD`,
  and `sequencer/`
  after the last pick and mid-sequence,
  in files and reftable repositories;
- a conclusion-state entry rewritten by another command after invocation survives landing;
- another invocation's staged path survives a landing;
- amend,
  merge,
  cherry-pick,
  and revert with a moved target fail with `concurrent-commit/head-moved`;
- a branch switch between preparation and landing fails with `concurrent-commit/branch-switched`;
- a detached `HEAD` lands by compare-and-swap on `HEAD`;
- two concurrent initial commits on an unborn branch;
- the target reflog and the `HEAD` reflog each contain the nonce entry exactly once;
- a non-UTF-8 `i18n.commitEncoding` commit replays with its encoding header and exact message bytes,
  signed and unsigned;
- `post-commit` runs once with `GIT_INDEX_FILE`,
  `GIT_AUTHOR_*`,
  and `GIT_EDITOR=:`;
- `pre-commit` re-runs against the replayed tree,
  is skipped under `--no-verify`,
  and a failing re-run lands nothing;
- policies re-run against the replayed tree and a revalidation patch lands;
- 2,
  3,
  and 8 commits started together each land exactly once with their captured bytes;
- a `pre-commit` hook that stages another path,
  rewrites and re-stages a selected file,
  or stages a formatted blob without touching the worktree lands what it staged,
  with the real index and worktree reconciled,
  and a worktree edit or real-index restage made after the hook ran is kept;
- a staged blob is absent from the real object store while the commit is held in `pre-commit`,
  and a real `gc --prune=now` then keeps the commit whole;
- missing replay plumbing fails a moved-target commit with `transaction-failed`.

Policy inputs and read sets:

- each lazy method records exactly its read,
  memoized second calls still record per policy,
  and a policy reading nothing records an empty set;
- context-only policies skip after a disjoint replay,
  unrestricted policies re-run,
  and a declared `worktree`,
  `executable`,
  `revision`,
  or `env` input changed by the winning commit forces a re-run;
- an option-derived `inputs` function receives the parsed options;
- invalid `inputs` shapes,
  an unknown kind,
  an empty pathspec list,
  and a throwing `inputs` function are config failures.

Reservation,
locks,
and configuration:

- the reservation is requested after the configured lost races,
  granted oldest invocation first,
  blocks other landings while held,
  and is released when a holder is killed;
- two preparations serialize their hooks by default and overlap with `hooks.concurrentCommits: true`;
- an open message editor does not hold the hook lock;
- concurrency config defaults,
  each valid value,
  zero,
  negative,
  fractional,
  string,
  and unknown nested keys;
- `core.lockfilePid` injection preserves an existing `GIT_CONFIG_COUNT`,
  and a real `git add` blocked in a hook leaves its PID file;
- foreign `index.lock` with a live PID-file owner,
  a PID file naming an exited process,
  a PID file naming a process started after the lock's ctime,
  no PID file,
  and a lock held open by a child process;
- a lock whose owner is a zombie is retired by the owner-lock acquirer,
  the hook dispatcher shim,
  and the transaction-owner liveness check;
- an unbounded wait released when the holder exits,
  and a leftover lock from a killed Git producing `index-lock-unproven-owner` after the timeout with the lock retained;
- a concurrent `git add` during a landing waits and then succeeds;
- `git cli-git fix` concurrent with a landing keeps its real index check valid;
- concurrent commits in a linked worktree never contend on the settlement lock,
  and `git worktree add` through the wrapper from a hook still synchronizes ignored state.

Recovery:

- `git status` succeeds while another commit's hook runs;
- two prepared and one landing transaction with dead owners recover in one startup;
- a live owner is skipped while a dead one beside it recovers;
- a crashed landing followed by another landing is recognized through the reflog nonce search;
- interruption at every journal state:
  before native Git,
  after preparation,
  after the reservation request,
  after object migration and before `landing-<n>.json`,
  inside the landing before and after compare-and-swap,
  before conclusion-state cleanup,
  after the index install,
  and before added-path worktree completion,
  each leaving no shadow repository and no `.keep` carrying the transaction's keep message after recovery;
- a legacy `cli-git-transaction` directory still recovers.

Auto-push:

- several landings produce fewer pushes than commits and the remote contains every landed OID;
- a joined push failure is reported by every joiner with exit `0`;
- a killed pusher is taken over after the liveness check;
- detached `HEAD` and missing-remote skips are unchanged.

Each fixture asserts exact ref,
reflog,
real index,
and worktree bytes before and after.
Deterministic interleaving uses Node hook programs that write a readiness marker and wait for a release file;
shell hooks are not used.
State-mutating verification uses disposable repositories only.

### Container end-to-end suite

Concurrent mutation of shared Git state is verified only by running it concurrently against real repositories.
Unit and packed shadow-bin fixtures cannot show interleavings,
crash recovery,
or lock contention,
so this suite is an inherent part of the transaction protocol.

- A mise task packs the npm tarball and runs a consumer script inside `podman` with stated memory and CPU bounds,
  following the `test:built:trust` precedent.
- The image provides every Git version under test:
  the declared minimum and the current release.
  Distribution images that ship an older Git do not qualify.
- Each run creates new repositories and a local bare remote inside the container,
  never touching host repositories.
- Workloads come from two sources:
  - commit-shape traces mined from this repository's own history
    (files per commit,
    path overlap,
    sizes,
    additions,
    deletions,
    renames,
    and binary files)
    with synthesized content;
  - a scenario catalog of concurrent agent behavior:
    shared-file edits with overlapping and non-overlapping hunks,
    interleaved index writers,
    hookdir and config-based hooks,
    lint-staged-style stash hooks,
    `commit-msg` and `post-commit` hooks,
    SSH signing,
    amend attempts,
    branch switches,
    foreign `index.lock` holders,
    `gc --prune=now` during preparation,
    and `SIGKILL` injected at every transaction phase followed by recovery.
- Runs are seeded;
  a failing seed replays deterministically.
- Landing phases that have no hook are reached through a test-only phase marker:
  `CLI_GIT_TEST_ONLY_PHASE_SIGNAL=<phase>:kill[:<directory>]` makes the wrapper `SIGKILL` itself at the phase,
  and `<phase>:pause:<directory>` writes `<directory>/<phase>.reached` and waits for `<directory>/<phase>.release`.
  The phases are `preparation-done`,
  `landing-locked`,
  `objects-migrated`,
  `ref-updated`,
  and `index-installed`.
  Only this explicitly test-named variable arms a marker;
  a malformed value fails the invocation.
- Every run checks these invariants:
  - each commit that exited `0` appears exactly once with exactly its captured bytes;
  - no worktree edit is lost;
  - the real index never stages a revert of landed content;
  - the remote contains every landed OID;
  - no shadow repository,
    transaction directory,
    `cli-git` `.keep` file,
    or lock remains;
  - `git fsck` is clean;
  - exit codes match the JSONL events.

## Policy-specific parity

### Built-ins

The configurable core policies preserve every accepted and rejected command fixture through the unified policy engine.
Their fixed order is `require-root`,
`linked-worktree-only`,
`branch-worktree-only`,
`add-explicit`,
then `final-newline`.
`final-newline` defaults to `warn`;
the other built-ins default to `error`.
`branch-worktree-only` and `final-newline` are warn-safe.
Unsafe warn configuration emits a `configuration-warning` JSONL event but still forwards when only warning findings
remain.
Generic `--no-enforce-<policy-id>` escapes and the legacy safeguard aliases skip the complete policy lifecycle and are
stripped before real Git.
Escape-looking option values and pathspecs remain ordinary Git arguments.
The legacy fixed-rule implementations no longer participate in dispatch.

### Forbidden root context

Reject root `CONTEXT.md` for commit candidates and direct check.
Do not reject nested files with that basename.
Deleted root candidates are clean.

### Forbidden strings

Use candidate bytes rather than incidental worktree bytes.
Post-commit scan uses landed commit ground truth.
Manual push runs a private Git `--dry-run --verify` pre-push probe,
parses Git's pre-push update records,
and validates negotiated remote OIDs with `git ls-remote --refs` before policy evaluation.
Do not infer destination state from cached tracking refs,
push output,
or hand-written refspec interpretation.
Scan each newly reachable commit's own delta against its parents:
every parent for merges,
the whole tree only for parentless commits,
and deletions publish no content and are skipped.
Directly pushed annotated-tag,
tree,
and blob targets scan their complete content.
Deduplicate exact candidate identities across updates.
Load unique Git blobs through one `git cat-file --batch` process per evaluation.
Materialize scanner files with no more than 64 concurrent lanes.
Wrapper-added latency for every forwarded real Git command must remain strictly less than `2,000 ms`.
Explicit dry runs bypass manual-push policies.
Pure ref deletion is clean.
Indeterminate required content exits `2` with `content-unavailable`.

Default scanner resolution uses `forbidden-strings` from `PATH`.
An explicit policy option may choose another executable.
Always invoke the scanner with an argument array and no shell.
Before explicit temporary-file scanning,
apply the scanner's path-anchored `--all` exclusions for its configured rules file and canonical self-match sources.
Do not exclude unrelated nested files sharing those basenames.
Exit `1` is parsed as redacted findings;
the scanner must not expose matched bytes.
Missing executable,
unexpected non-finding status,
process interruption,
malformed output,
and scanner-owned materialized-file read failure throw from the plugin.
A thrown plugin callback emits `plugin-threw` and exits `2`;
invalid completed plugin output emits `policy-incomplete`.
The policy defaults to error and is warn-unsafe.
Preserve the independent SLSA-attested CI invocation.

### Final newline

`final-newline` is a core policy enabled at warning severity by default.
An explicit error override restores blocking enforcement.
Selected non-empty text ends with exactly one LF.
Remove every terminal LF before adding one.
Empty and binary-looking bytes stay unchanged.
A file with CRLF content receives one terminal LF without normalizing interior line endings.

Preserve these exclusion families exactly:

```text
package/fuzz/forbidden-strings/seeds/**
package/rust-module/forbidden-regex.fuzz/seeds/**
package/test-fixture/toml-edit/src/**
**/dist/final/node/**
**/bundle/node/**
```

Patch-capable commit transactions automatically normalize would-be-committed bytes.
At default warning severity,
read-only commit selection and other pre-forward commands,
including `git add`,
warn and continue without offering an inapplicable patch.
An explicit error override makes those findings blocking.
Direct fix affects selected worktree bytes only.
Every real index entry remains exact during direct fix.

## Benchmark method

Issue #356 records measured budgets;
this specification does not invent numeric thresholds.

The benchmark harness uses built production artifacts and disposable repositories.
Each scenario has a paired direct-real-Git baseline using the same executable,
repository,
command,
filesystem cache state,
and stdio sink.
Network operations use a local bare remote.
Scanner and plugin fixtures are deterministic and local.

Measure these scenarios separately:

- no config forwarded command;
- known read-only command;
- strict trusted MJS;
- strict trusted cached TypeScript;
- relaxed TypeScript rebuild;
- built-in validator;
- external scanner;
- normalizer clean path;
- normalizer changed path;
- post-commit policy and local auto-push;
- concurrent commits at concurrency levels 1,
  2,
  4,
  and 8 with disjoint paths;
- same-file non-overlapping replays;
- conflicting pairs;
- a slow hook with `hooks.concurrentCommits` set to `false` and to `true`;
- a sweep of `landing.reserveAfterLostRaces` that confirms or replaces the default by tail completion time.

Concurrent scenarios also report per-commit completion time,
landing lock hold time,
real `index.lock` hold time,
lost races per commit,
and a paired serialized baseline.
Because every non-dry-run commit now prepares privately,
the lifecycle baseline is re-measured and stored as a new dated `perf/lifecycle-latency-<date>.json`.
Timing comparisons first measure the run-to-run band on one unchanged build.

For each scenario:

1. Record platform,
   Node,
   Git,
   filesystem,
   CPU,
   and build revision.
2. Run isolated warm-up samples until the harness-defined stable warm-up rule is met.
3. Collect at least 30 successful measured samples.
4. Report median,
   p95,
   median absolute deviation,
   direct-Git baseline,
   and wrapper-added delta.
5. Keep stdout and stderr destinations identical between paired runs.
6. Exclude failed samples only with a recorded failure reason;
   any systematic failure fails the benchmark.
7. Store raw samples as CI artifacts.

A performance budget is accepted only after at least one measured baseline on each enforced operating system.
CI compares like-for-like scenarios and reports both absolute and relative regression.

## Package and user-boundary verification

Before release readiness:

- package README exists and matches this interface;
- lint has zero warnings;
- type checks pass;
- every exported code path has a test;
- built artifacts contain the Node shebang;
- `npm pack` contains only intended runtime,
  declarations,
  README,
  licenses,
  and package metadata;
- a disposable non-workspace project installs the tarball;
- that project imports every authoring helper without CLI side effects;
- its PATH resolves the packaged `git` first;
- wrapper and all management commands run through the built shim;
- MJS and TypeScript trust execute stored artifacts;
- direct fix proves index preservation;
- the container end-to-end suite
  (see "Container end-to-end suite")
  passes on the declared minimum Git and the current release;
- Linux,
  macOS,
  and Windows trust adapters have real-host evidence.

No step uploads to npm.

## Contract fixture verification

Issue #341 verifies the declarations and authoring examples in a disposable TypeScript consumer.
It also parses every management command form with a management parser fixture and rejects the mutually exclusive or missing
scope forms.
Runtime slices must replace those contract fixtures with built-package user-boundary tests rather than relying on the
document-only evidence.
