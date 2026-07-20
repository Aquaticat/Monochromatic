/**
 * Audited Pi extension API effects.
 *
 * @module
 */

import type { IntrinsicEffectEntry, } from './intrinsic-effect-catalog.ts';

/**
 * Pi extension methods that change host state through extension capability.
 */
export const PI_PACKAGE_EFFECTS: readonly IntrinsicEffectEntry[] = [
  {
    provenance: {
      kind: 'package',
      packageName: '@earendil-works/pi-coding-agent',
      major: 0,
    },
    ownerType: 'globalThis',
    member: 'isToolCallEventType',
    targets: [],
    auditTier: 'api-contract',
    evidence: '@earendil-works/pi-coding-agent compares primitive tool-name discriminator',
  },
  ...[
    'appendEntry',
    'on',
    'registerCommand',
    'registerFlag',
    'registerMessageRenderer',
    'registerShortcut',
    'registerTool',
    'sendMessage',
    'sendUserMessage',
    'setActiveTools',
    'setThinkingLevel',
  ].map(function piExtensionApiEffect(member,): IntrinsicEffectEntry {
    return {
      provenance: {
        kind: 'package',
        packageName: '@earendil-works/pi-coding-agent',
        major: 0,
      },
      ownerType: 'ExtensionAPI',
      member,
      targets: [{ kind: 'receiver', },],
      auditTier: 'api-contract',
      evidence: '@earendil-works/pi-coding-agent extension loader and agent session state updates',
    };
  },),
  ...[
    'abort',
  ].map(function piCommandContextMutation(member,): IntrinsicEffectEntry {
    return {
      provenance: {
        kind: 'package',
        packageName: '@earendil-works/pi-coding-agent',
        major: 0,
      },
      ownerType: 'ExtensionContext',
      member,
      targets: [{ kind: 'receiver', },],
      auditTier: 'api-contract',
      evidence: '@earendil-works/pi-coding-agent changes active command session state',
    };
  },),
  {
    provenance: {
      kind: 'package',
      packageName: '@earendil-works/pi-coding-agent',
      major: 0,
    },
    ownerType: 'ExtensionContext',
    member: 'getContextUsage',
    targets: [],
    auditTier: 'api-contract',
    evidence: '@earendil-works/pi-coding-agent computes usage from current session entries without host mutation',
  },
  {
    provenance: {
      kind: 'package',
      packageName: '@earendil-works/pi-coding-agent',
      major: 0,
    },
    ownerType: 'ExtensionCommandContext',
    member: 'waitForIdle',
    targets: [],
    auditTier: 'api-contract',
    evidence: '@earendil-works/pi-coding-agent waits for current agent stream completion',
  },
  ...[
    'notify',
    'setStatus',
  ].map(function piUiReceiverMutation(member,): IntrinsicEffectEntry {
    return {
      provenance: {
        kind: 'package',
        packageName: '@earendil-works/pi-coding-agent',
        major: 0,
      },
      ownerType: 'ExtensionUIContext',
      member,
      targets: [{ kind: 'receiver', },],
      auditTier: 'api-contract',
      evidence: '@earendil-works/pi-coding-agent changes rendered extension UI state',
    };
  },),
  {
    provenance: {
      kind: 'package',
      packageName: '@earendil-works/pi-coding-agent',
      major: 0,
    },
    ownerType: 'ExtensionUIContext',
    member: 'select',
    targets: [
      { kind: 'receiver', },
      {
        kind: 'argument',
        index: 1,
      },
      {
        kind: 'argument',
        index: 2,
      },
    ],
    auditTier: 'api-contract',
    evidence: '@earendil-works/pi-coding-agent stores selector state and abort-signal listeners',
  },
  {
    provenance: {
      kind: 'package',
      packageName: '@earendil-works/pi-coding-agent',
      major: 0,
    },
    ownerType: 'ExtensionUIContext',
    member: 'setWidget',
    targets: [
      { kind: 'receiver', },
      {
        kind: 'argument',
        index: 1,
      },
      {
        kind: 'argument',
        index: 2,
      },
    ],
    auditTier: 'api-contract',
    evidence: '@earendil-works/pi-coding-agent stores widget state and invokes supplied component factories',
  },
  {
    provenance: {
      kind: 'package',
      packageName: '@earendil-works/pi-coding-agent',
      major: 0,
    },
    ownerType: 'ModelRegistry',
    member: 'getApiKeyAndHeaders',
    targets: [
      { kind: 'receiver', },
      {
        kind: 'argument',
        index: 0,
      },
    ],
    auditTier: 'api-contract',
    evidence: '@earendil-works/pi-coding-agent resolves auth including command-backed configuration',
  },
  ...[
    'find',
    'getAll',
  ].map(function piModelRegistryObservation(member,): IntrinsicEffectEntry {
    return {
      provenance: {
        kind: 'package',
        packageName: '@earendil-works/pi-coding-agent',
        major: 0,
      },
      ownerType: 'ModelRegistry',
      member,
      targets: [],
      auditTier: 'api-contract',
      evidence: '@earendil-works/pi-coding-agent reads current model registry entries',
    };
  },),
  {
    provenance: {
      kind: 'package',
      packageName: '@earendil-works/pi-coding-agent',
      major: 0,
    },
    ownerType: 'ModelRegistry',
    member: 'hasConfiguredAuth',
    targets: [{
      kind: 'argument',
      index: 0,
    },],
    auditTier: 'api-contract',
    evidence: '@earendil-works/pi-coding-agent reads supplied model fields without refreshing auth',
  },
  ...[
    'getSessionFile',
    'getSessionId',
  ].map(function piSessionIdentityObservation(member,): IntrinsicEffectEntry {
    return {
      provenance: {
        kind: 'package',
        packageName: '@earendil-works/pi-coding-agent',
        major: 0,
      },
      ownerType: 'SessionManager',
      member,
      targets: [],
      auditTier: 'api-contract',
      evidence: '@earendil-works/pi-coding-agent reads primitive session identity fields',
    };
  },),
  {
    provenance: {
      kind: 'package',
      packageName: '@earendil-works/pi-coding-agent',
      major: 0,
    },
    ownerType: 'SessionManager',
    member: 'getBranch',
    targets: [],
    auditTier: 'api-contract',
    evidence: '@earendil-works/pi-coding-agent returns a fresh path array without changing session state',
  },
  ...[
    'bg',
    'bold',
    'fg',
  ].map(function piThemeObservation(member,): IntrinsicEffectEntry {
    return {
      provenance: {
        kind: 'package',
        packageName: '@earendil-works/pi-coding-agent',
        major: 0,
      },
      ownerType: 'Theme',
      member,
      targets: [],
      auditTier: 'api-contract',
      evidence: '@earendil-works/pi-coding-agent theme primitive text formatting',
    };
  },),
  ...[
    'getActiveTools',
    'getFlag',
    'getThinkingLevel',
  ].map(function piExtensionApiObservation(member,): IntrinsicEffectEntry {
    return {
      provenance: {
        kind: 'package',
        packageName: '@earendil-works/pi-coding-agent',
        major: 0,
      },
      ownerType: 'ExtensionAPI',
      member,
      targets: [],
      auditTier: 'api-contract',
      evidence: '@earendil-works/pi-coding-agent agent-session state queries returning owned values',
    };
  },),
];
