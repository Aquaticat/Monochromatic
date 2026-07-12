/**
 * Public policy authoring contracts.
 *
 * @module
 */

import type {
  GenericSchema,
} from 'valibot';

import type {
  AbsentGitValue,
  LazyPolicyGitFacts,
} from './context-types.ts';

/**
 * Policy configuration severity. @example `const severity: PolicySeverity = 'error';`
 */
export type PolicySeverity = 'off' | 'warn' | 'error';

/**
 * Enabled policy severity. @example `const severity: ActivePolicySeverity = 'warn';`
 */
export type ActivePolicySeverity = Exclude<PolicySeverity, 'off'>;

/**
 * Policy lifecycle trigger. @example `const trigger: PolicyTrigger = 'direct-check';`
 */
export type PolicyTrigger =
  | 'pre-forward'
  | 'post-commit'
  | 'manual-push'
  | 'direct-check'
  | 'direct-fix';

/**
 * Git object ID. @example `const oid: GitObjectId = 'abc123';`
 */
export type GitObjectId = string;

/**
 * Repository-relative or absolute path named by its surrounding contract. @example `const path: RepositoryPath = 'src/index.ts';`
 */
export type RepositoryPath = string;

/**
 * Candidate Git file mode. @example `const mode: CandidateFileMode = 'regular';`
 */
export type CandidateFileMode = 'regular' | 'executable' | 'symlink' | 'submodule';

/**
 * Candidate change kind. @example `const change: CandidateChange = 'modified';`
 */
export type CandidateChange = 'added' | 'modified' | 'deleted';

/**
 * Committed or mutable candidate. @example `const file = await context.git.candidates().then(files => files[0]);`
 */
export type CandidateFile = Readonly<{
  /**
   * Invocation-local opaque target ID.
   */
  targetId: string;
  /**
   * Repository-relative path.
   */
  path: RepositoryPath;
  /**
   * Revision ID, or shared absence sentinel for mutable content.
   */
  revision: GitObjectId | AbsentGitValue;
  /**
   * Git file mode.
   */
  mode: CandidateFileMode;
  /**
   * Change relative to comparison baseline.
   */
  change: CandidateChange;
  /**
   * Loads fresh exact candidate bytes.
   */
  bytes: () => Promise<Uint8Array>;
}>;

/**
 * Facts about the triggering command. @example `const args = context.command.transformedArgs;`
 */
export type PolicyCommandFacts = Readonly<{
  /**
   * Raw arguments after executable name.
   */
  rawArgs: readonly string[];
  /**
   * Arguments after wrapper transforms.
   */
  transformedArgs: readonly string[];
  /**
   * Parsed subcommand, or absence sentinel for direct operation.
   */
  subcommand: string | AbsentGitValue;
  /**
   * Effective working directory after global `-C` options.
   */
  effectiveCwd: string;
  /**
   * Repository root.
   */
  repositoryRoot: string;
  /**
   * Policy IDs bypassed for this invocation.
   */
  escapedPolicyIds: ReadonlySet<string>;
}>;

/**
 * Complete context supplied to a policy. @example `const version = context.candidateVersion;`
 */
export type PolicyContext = Readonly<{
  /**
   * Monotonic candidate-state version.
   */
  candidateVersion: number;
  /**
   * Current lifecycle trigger.
   */
  trigger: PolicyTrigger;
  /**
   * Command facts.
   */
  command: PolicyCommandFacts;
  /**
   * Lazy Git facts memoized for current version only.
   */
  git: LazyPolicyGitFacts;
  /**
   * Engine cancellation signal.
   */
  signal: AbortSignal;
}>;

/**
 * Byte range within candidate content. @example `const location: FindingLocation = { byteStart: 0, byteEnd: 1 };`
 */
export type FindingLocation = Readonly<{
  /**
   * Inclusive byte start.
   */
  byteStart: number;
  /**
   * Exclusive byte end.
   */
  byteEnd: number;
}>;

/**
 * Single-target Git unified patch. @example `const patch: PolicyPatch = { kind: 'git-unified', targetId: 't1', path: 'a', bytes };`
 */
export type PolicyPatch = Readonly<{
  /**
   * Engine-supported patch format.
   */
  kind: 'git-unified';
  /**
   * Exact candidate target ID.
   */
  targetId: string;
  /**
   * Exact candidate path.
   */
  path: RepositoryPath;
  /**
   * Unified patch bytes.
   */
  bytes: Uint8Array;
}>;

/**
 * Expected policy violation. @example `const finding: PolicyFinding = { code: 'missing', message: 'Missing value' };`
 */
export type PolicyFinding = Readonly<{
  /**
   * Stable policy-specific code.
   */
  code: string;
  /**
   * Human-readable explanation.
   */
  message: string;
  /**
   * Affected path.
   */
  path?: RepositoryPath;
  /**
   * Optional exact byte range.
   */
  location?: FindingLocation;
  /**
   * Optional correction owned by cli-git.
   */
  patch?: PolicyPatch;
}>;

/**
 * Policy implementation input. @example `const check = async ({ context }: PolicyCheckInput) => [];`
 */
export type PolicyCheckInput<TOptions> = Readonly<{
  /**
   * Invocation context.
   */
  context: PolicyContext;
  /**
   * Runtime-validated options.
   */
  options: Readonly<TOptions>;
}>;

/**
 * Minimum policy shape preserved by plugin tuples.
 *
 * @example
 * ```ts
 * const policy: NamedPolicyDefinition = { name: 'check' };
 * ```
 */
export type NamedPolicyDefinition = Readonly<{
  /**
   * Namespace-local policy name.
   */
  name: string;
}>;

/**
 * Runtime policy definition. @example `const policy = definePolicy({ name: 'check', defaultSeverity: 'error', warnSafe: true, triggers: ['direct-check'], check: async () => [] });`
 */
export type PolicyDefinition<
  TOptions = undefined,
  TName extends string = string,
> = Readonly<{
  /**
   * Namespace-local policy name.
   */
  name: TName;
  /**
   * Default severity activated by plugin registration.
   */
  defaultSeverity: PolicySeverity;
  /**
   * Whether warnings preserve enforcement semantics.
   */
  warnSafe: boolean;
  /**
   * Lifecycle triggers checked by policy.
   */
  triggers: readonly PolicyTrigger[];
  /**
   * Optional Valibot options schema.
   */
  options?: Readonly<GenericSchema<unknown, TOptions>>;
  /**
   * Finds every violation for one candidate state.
   */
  check: (input: PolicyCheckInput<TOptions>) => Promise<readonly PolicyFinding[]>;
}>;
