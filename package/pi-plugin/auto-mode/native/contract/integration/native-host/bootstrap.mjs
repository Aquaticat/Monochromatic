import { statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  sdk
} from '../current-sdk/paths.ts';
import { createNativeMarkdownParser } from '../../native-index/native-parser.ts';
import { bindNativePolicyRuntime } from '../native-batch/runtime.mjs';
import { readSessionDisposalState } from '../native-batch/generated/agent-session.mjs';
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
const { wrapToolDefinition } = await import(pathToFileURL(join(
  sdk,
  'dist/core/tools/tool-definition-wrapper.js'
))
  .href);
const log = tagged({ tag: 'auto-mode-native-host' });

function trace(event) {
  const l = tagged({
    tag: trace.name,
    l: log
  });
  l.debug(event);
}

function designatePolicy(options) {
  const relativePath = 'AGENTS.md';
  const requiredMode = statSync(join(
    options.cwd,
    relativePath
  ))
    .mode
    & 0o777;
  return {
    policy: {
      root: options.cwd,
      relativePath,
      requiredMode
    },
    authority: {
      tier: 'user',
      scope: 'original-request'
    }
  };
}

function sendUnconfiguredAssessment() {
  throw new NativeCliHostError('Native CLI semantic assessment has no adopted admission policy');
}

function assessmentClock() {
  return performance.now();
}

function readAssessmentCredential() {
  return process.env.AUTO_MODE_LLMGATEWAY_API_KEY;
}

function bindSession({
  root,
  lifecycle,
  resource,
  options
}) {
  const baseUrl = root.session
    .model
    ?.baseUrl
    ?? 'https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1';
  const endpoint = new URL(`${baseUrl.replace(
    /\/$/u,
    ''
  )  }/chat/completions`).href;
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
      if (!pi) throw new NativeCliHostError('Native approval API was not captured by this session resource loader');
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
