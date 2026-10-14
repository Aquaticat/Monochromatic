/**
 Bind the original native CLI without inventing semantic admission.

 @module
 */
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import {
  readSessionDisposalState,
  wrapToolDefinition
} from './bootstrap-dependencies.ts';
import type { NativeHostSessionInput } from './bootstrap-types.ts';
import { createNativeMarkdownParser } from '../../native-index/native-parser.ts';
import { bindNativePolicyRuntime } from '../native-batch/runtime.mjs';
import {
  createNativeCliHost,
  NativeCliHostError
} from './host.mjs';
import {
  askUser,
  createAssessmentSender,
  VERDICT_ENTRY_TYPE
} from '../maintained-policy.mjs';
import { tagged } from '@monochromatic-dev/module-logger/ts';

//region The candidate CLI binds custody without adopting an unqualified semantic policy.

const parser = await createNativeMarkdownParser({
  expectedVersion: '0.10.5'
});
const log = tagged({ tag: 'auto-mode-native-host' });
const permissionBits = 0o777;

function trace(event: string): void {
  const l = tagged({
    tag: trace.name,
    l: log
  });
  l.debug(event);
}

async function designatePolicy({cwd}: {readonly cwd:string}) {
  const relativePath = 'AGENTS.md';
  const info = await stat(join(
    cwd,
    relativePath
  ));
  const requiredMode = info.mode & permissionBits;
  return {
    policy: {
      root: cwd,
      relativePath,
      requiredMode
    },
    authority: {
      tier: 'user' as const,
      scope: 'original-request' as const
    }
  };
}

function sendUnconfiguredAssessment(): never {
  throw new NativeCliHostError('Native CLI semantic assessment has no adopted admission policy');
}

function assessmentClock(): number {
  return performance.now();
}

function readAssessmentCredential(): string | undefined {
  return process.env
    .AUTO_MODE_LLMGATEWAY_API_KEY;
}

function bindSession({
  root,
  lifecycle,
  resource,
  options
}: NativeHostSessionInput) {
  const baseUrl = root.session
    .model
    ?.baseUrl
    ?? 'https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1';
  const endpointBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const endpoint = new URL(`${endpointBase}/chat/completions`).href;
  return bindNativePolicyRuntime({
    root,
    lifecycle,
    policyInput: resource.policyInput,
    endpoint,
    rootDirectory: options.cwd,
    parsePolicy: parser.parse,
    files: [],
    send: sendUnconfiguredAssessment,
    sendWire: createAssessmentSender({
      fetchImpl: globalThis.fetch,
      now: assessmentClock,
      readCredential: readAssessmentCredential
    }),
    now: assessmentClock,
    wrapToolDefinition,
    readSessionDisposalState,
    trace,
    approvalHost() {
      const pi = resource.nativeApi
        .current;
      if (pi === undefined) throw new NativeCliHostError('Native approval API was not captured by this session resource loader');
      return {
        pi,
        ctx: root.session
          .extensionRunner
          .createContext(),
        askUser,
        verdictEntryType: VERDICT_ENTRY_TYPE,
        trace
      };
    },
  });
}

export const nativeHost = createNativeCliHost({
  designatePolicy,
  bindSession
});
export const ownedManagers = nativeHost.managers;
export const createHostResourceLoader = nativeHost.createResourceLoader;
export const createHostSession = nativeHost.createSession;
export const disposeHostSession = nativeHost.disposeSession;

//endregion
