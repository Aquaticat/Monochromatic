/**
 Bind the original native CLI to its adopted semantic operating policy.

 @module
 */
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { wrapToolDefinition } from './bootstrap-dependencies.ts';
import { createStartupRelevance } from './startup-relevance.mjs';
import { readSessionDisposalState } from './session-disposal.mjs';
import type {
  NativeHostSessionInput,
  NativePolicyDesignation
} from './bootstrap-types.ts';
import type {
  NativeApprovalHost,
  NativePolicyRuntime
} from '../native-batch/runtime-types.ts';
import { createNativeMarkdownParser } from '../../native-index/native-parser.ts';
import { bindNativePolicyRuntime } from '../native-batch/runtime.mjs';
import {
  createNativeCliHost,
  type NativeCliHost,
  NativeCliHostError
} from './host.ts';
import {
  askUser,
  readNativeBypassEnabled,
  createAssessmentSender,
  createNativeSemanticOperatingPolicies,
  VERDICT_ENTRY_TYPE
} from '../maintained-policy.mjs';
import { tagged } from '@monochromatic-dev/module-logger/ts';

//region Original custody and the adopted operating policy remain independent.

/**
 Policy text uses the qualified original Markdown parser.
 */
const parser = await createNativeMarkdownParser({
  expectedVersion: '0.10.5'
});
/**
 Bootstrap diagnostics retain a module-specific tag.
 */
const log = tagged({ tag: 'auto-mode-native-host' });
/**
 File designation retains only original permission bits.
 */
const permissionBits = 0o777;

/**
 Record native lifecycle events without changing their original event text.

 @param event - original runtime event name
 */
function trace(event: string): void {
  /**
   Native trace messages identify their forwarding boundary.
   */
  const l = tagged({
    tag: trace.name,
    l: log
  });
  l.debug(event);
}

/**
 Capture the governing file's original path and permission mode before loading resources.

 @param cwd - original resource directory

 @returns designation consumed by the existing policy owner

 @throws Error when original file metadata cannot be read
 */
async function designatePolicy({cwd}: {readonly cwd:string}): Promise<NativePolicyDesignation> {
  /**
   File inspection has a separate diagnostic boundary.
   */
  const l = tagged({
    tag: designatePolicy.name,
    l: log
  });
  l.debug('capturing original governing policy designation');
  /**
   The existing host policy convention selects the project agent instructions.
   */
  const relativePath = 'AGENTS.md';
  /**
   Capture original metadata before publishing the resource loader.
   */
  const info = await stat(join(
    cwd,
    relativePath
  ));
  /**
   Later policy loading compares this captured permission mode.
   */
  const requiredMode = info.mode & permissionBits;
  return {
    policy: {
      root: cwd,
      relativePath,
      requiredMode,
      relevance:createStartupRelevance({
        root:cwd,
        parse:parser.parse
      })
    },
    authority: {
      tier: 'user' as const,
      scope: 'original-request' as const
    }
  };
}

/**
 Unattributed assessment must never bypass the configured raw-wire path.

 @throws NativeCliHostError whenever the normalized-only assessment path is requested
 */
function rejectUnattributedAssessment(): never {
  throw new NativeCliHostError('Native CLI semantic assessment requires its attributed raw-wire transport');
}

/**
 Read the same monotonic clock used by original judgment performance targets and HTTP requests.

 @returns current monotonic timestamp in milliseconds
 */
function assessmentClock(): number {
  return performance.now();
}

/**
 Read the credential only when the maintained transport starts an authorized attempt.

 @returns unchecked environment value for the transport's existing credential validation
 */
function readAssessmentCredential(): unknown {
  return process.env
    .AUTO_MODE_LLMGATEWAY_API_KEY;
}

/**
 Bind the original constructor-owned session to the adopted interpretation policy.

 @param root - original SDK session and manager

 @param lifecycle - existing native session owner

 @param resource - original policy and approval resource record

 @param options - original session working directory

 @returns existing native policy runtime with its original detachment contract

 @throws NativeCliHostError when native approval lacks its original API
 */
function bindSession({
  root,
  lifecycle,
  resource,
  options
}: NativeHostSessionInput): NativePolicyRuntime {
  /**
   Session binding retains its own diagnostic scope.
   */
  const l = tagged({
    tag: bindSession.name,
    l:log
  });
  l.debug('binding original native session to maintained policy runtime');
  return bindNativePolicyRuntime({
    readBypass() { return readNativeBypassEnabled(root.session
      .extensionRunner
      .createContext()); },
    root,
    lifecycle,
    policyInput: resource.policyInput,
    rootDirectory: options.cwd,
    parsePolicy: parser.parse,
    files: [],
    ...createNativeSemanticOperatingPolicies(),
    send: rejectUnattributedAssessment,
    sendWire: createAssessmentSender({
      fetchImpl: globalThis.fetch,
      now: assessmentClock,
      readCredential: readAssessmentCredential
    }),
    now: assessmentClock,
    wrapToolDefinition,
    readSessionDisposalState,
    trace,
    /**
     Read the latest native approval context after any resource reload.

     @returns original API, context, and maintained requester

     @throws NativeCliHostError when the original API has not been captured
     */
    approvalHost(): NativeApprovalHost {
      /**
       The resource owner refreshes this API during original extension loading.
       */
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

/**
 One bootstrap instance owns native CLI construction and terminal cleanup.
 */
export const nativeHost: NativeCliHost = createNativeCliHost({
  designatePolicy,
  bindSession
});
/**
 Generated CLI code receives only the original host-owned manager constructors.
 */
export const ownedManagers: NativeCliHost['managers'] = nativeHost.managers;
/**
 Generated services await policy designation before receiving their original resource loader.
 */
export const createHostResourceLoader: NativeCliHost['createResourceLoader'] = nativeHost.createResourceLoader;
/**
 Generated services retain original host-owned session construction.
 */
export const createHostSession: NativeCliHost['createSession'] = nativeHost.createSession;
/**
 Generated terminal and replacement paths share original host-owned disposal.
 */
export const disposeHostSession: NativeCliHost['disposeSession'] = nativeHost.disposeSession;

//endregion
