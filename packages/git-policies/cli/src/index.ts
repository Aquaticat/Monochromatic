#!/usr/bin/env node
/**
 * Side-effect-free cli-git exports and direct executable entry.
 *
 * @module
 */

import { runCliGit, } from './bin.ts';

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
  forbiddenRootContext,
  hasForbiddenRootContext,
  repositoryPolicyPlugin,
} from '@monochromatic-dev/git-policy-repository/ts';
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

// Direct execution runs the wrapper; module import remains inert.
if (import.meta.main)
  await runCliGit();
