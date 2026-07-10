/**
 * Side-effect-free cli-git policy authoring API.
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
