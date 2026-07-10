/**
 * Local source-level policy authoring entry for trusted configuration bundling.
 *
 * @module
 */

export {
  defineConfig,
  definePlugin,
  definePolicy,
  definePolicyOptions,
} from './authoring.ts';
export {
  ABSENT_GIT_VALUE,
} from './context-types.ts';
export type {
  AbsentGitValue,
  LazyPolicyGitFacts,
  PushUpdate,
} from './context-types.ts';
export type {
  BuiltInPolicyId,
  CliGitConfig,
  PluginDefinition,
  PluginMap,
  PolicySetting,
} from './config-types.ts';
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
} from './policy-types.ts';
