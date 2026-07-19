/**
 * Side-effect-free cli-git policy authoring source entry.
 *
 * @module
 */

export {
  defineConfig,
  definePlugin,
  definePolicy,
  definePolicyOptions,
} from './api/authoring.ts';
export {
  ABSENT_GIT_VALUE,
} from './api/context-types.ts';
export type {
  AbsentGitValue,
  LazyPolicyGitFacts,
  PushUpdate,
} from './api/context-types.ts';
export type {
  BuiltInPolicyId,
  CliGitConfig,
  PluginDefinition,
  PluginMap,
  PolicySetting,
} from './api/config-types.ts';
export {
  ForbiddenStringsPluginError,
  forbiddenStringsPlugin,
  forbiddenStringsPolicy,
  parseScannerOutput,
  scanCandidates,
} from './optional/forbidden-strings/index.ts';
export type {
  ForbiddenStringsPolicyOptions,
} from './optional/forbidden-strings/index.ts';
export {
  finalNewlinePolicy,
} from './policy-engine/final-newline-policy.ts';
export {
  isFinalNewlineExcluded,
  normalizeFinalNewline,
} from './policy-engine/final-newline-normalize.ts';
export type {
  ChangedFinalNewline,
  FinalNewlineNormalization,
  UnchangedFinalNewline,
} from './policy-engine/final-newline-normalize.ts';
export {
  forbiddenRootContext,
  hasForbiddenRootContext,
  repositoryPolicyPlugin,
} from './optional/repository-policy.ts';
export type {
  ActivePolicySeverity,
  CandidateChange,
  CandidateFile,
  CandidateFileMode,
  FindingLocation,
  GitObjectId,
  NamedPolicyDefinition,
  PolicyCheckInput,
  PolicyCommandFacts,
  PolicyContext,
  PolicyDefinition,
  PolicyFinding,
  PolicyPatch,
  PolicySeverity,
  PolicyTrigger,
  RepositoryPath,
} from './api/policy-types.ts';
