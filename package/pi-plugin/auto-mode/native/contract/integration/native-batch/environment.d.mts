/**
 Owner declaration for the built native batch environment implementation.

 The declaration mirrors the emitted `environment.mjs` interface; SDK,
 session-root, and parser types are the owners' published contracts rather than
 caller-authored substitutes. @module
 */
import type { defineTool, ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { ManagerConstructorInput } from '../../lifecycle/runtime-custody/manager-types.ts';
import type { NativeMarkdownParser } from '../../native-index/native-parser-types.ts';
import type { NativeForwardedFunction } from './runtime-types.ts';
import type {
  RootSessionDefinition,
  RootSessionOptions,
  RootSessionSdkFactory
} from './session-root-types.ts';

/**
 Environment construction input; every fixture knob carries its own default.
 */
export type NativeBatchEnvironmentInput = Readonly<{
  createRelevance?: (input: Readonly<{
    root: string;
    parse: NativeMarkdownParser['parse'];
  }>) => unknown;
  agentsFilesOverride?: NativeForwardedFunction;
  appendSystemPromptOverride?: NativeForwardedFunction;
  promptTemplateText?: string;
  extensionModuleText?: string;
  additionalExtensionPaths?: readonly string[];
  expectedBlockedNetworkUrls?: readonly string[];
  extensionFactories?: readonly ((api: ExtensionAPI) => void)[];
  customPromptAuthority?: NativeForwardedFunction;
  discoveredSystemText?: string;
  omitHostPrompt?: boolean;
  hostPrompt?: string;
  appendPrompts?: readonly string[];
  useNativeProvider?: boolean;
  policyText?: string;
}>;

/**
 Session options emitted by the environment plus its harness-owned fields.
 */
export type NativeBatchEnvironmentOptions = RootSessionOptions & Readonly<{
  cwd: string;
  agentDir: string;
  modelRuntime: unknown;
  resourceLoader: unknown;
  resourceInputBinding: unknown;
}>;

/**
 Emitted environment surface consumed by the fixture session and runtime.
 */
export type NativeBatchEnvironment = Readonly<{
  packageRoot: string;
  createAgentSession: RootSessionSdkFactory;
  SessionManager: ManagerConstructorInput;
  readNativeExtensionToolInputs: NativeForwardedFunction;
  readNativeExtensionToolOrigin: NativeForwardedFunction;
  createReadToolDefinition: NativeForwardedFunction;
  wrapToolDefinition: NativeForwardedFunction;
  defineTool: typeof defineTool;
  parser: NativeMarkdownParser;
  policyInput: unknown;
  readRootOccurrence: RootSessionDefinition<RootSessionOptions>['readRootOccurrence'];
  readActiveSessionManager: RootSessionDefinition<RootSessionOptions>['readActiveSessionManager'];
  readSessionDisposalState: RootSessionDefinition<RootSessionOptions>['readSessionDisposalState'];
  readActiveSessionBaseComposition: NativeForwardedFunction;
  readActiveSessionRunComposition: NativeForwardedFunction;
  options: NativeBatchEnvironmentOptions;
  drain: () => Promise<void>;
}>;

/**
 Build one isolated fixture environment over the real native policy loader.

 @param input - fixture knobs; omitted for the implementation defaults

 @returns environment surface carrying the original SDK construction owners
 */
export declare function createEnvironment(input?: NativeBatchEnvironmentInput): Promise<NativeBatchEnvironment>;
