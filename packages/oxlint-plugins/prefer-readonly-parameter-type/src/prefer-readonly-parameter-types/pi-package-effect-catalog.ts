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
    evidence: '@earendil-works/pi-coding-agent 0.80.6 compares primitive tool-name discriminator',
  },
  ...[
    'appendEntry',
    'on',
    'registerCommand',
    'registerMessageRenderer',
    'registerShortcut',
    'registerTool',
    'sendMessage',
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
      evidence: '@earendil-works/pi-coding-agent 0.80.6 extension loader and agent session state updates',
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
      evidence: '@earendil-works/pi-coding-agent 0.80.6 changes active command session state',
    };
  },),
  {
    provenance: {
      kind: 'package',
      packageName: '@earendil-works/pi-coding-agent',
      major: 0,
    },
    ownerType: 'ExtensionCommandContext',
    member: 'waitForIdle',
    targets: [],
    evidence: '@earendil-works/pi-coding-agent 0.80.6 waits for current agent stream completion',
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
      evidence: '@earendil-works/pi-coding-agent 0.80.6 changes rendered extension UI state',
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
    evidence: '@earendil-works/pi-coding-agent 0.80.6 stores selector state and abort-signal listeners',
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
    evidence: '@earendil-works/pi-coding-agent 0.80.6 stores widget state and invokes supplied component factories',
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
    evidence: '@earendil-works/pi-coding-agent 0.80.6 resolves auth including command-backed configuration',
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
      evidence: '@earendil-works/pi-coding-agent 0.80.6 reads current model registry entries',
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
    evidence: '@earendil-works/pi-coding-agent 0.80.6 reads supplied model fields without refreshing auth',
  },
  {
    provenance: {
      kind: 'package',
      packageName: '@earendil-works/pi-coding-agent',
      major: 0,
    },
    ownerType: 'SessionManager',
    member: 'getBranch',
    targets: [],
    evidence: '@earendil-works/pi-coding-agent 0.80.6 returns a fresh path array without changing session state',
  },
  ...[
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
      evidence: '@earendil-works/pi-coding-agent 0.80.6 theme primitive text formatting',
    };
  },),
  ...[
    'getActiveTools',
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
      evidence: '@earendil-works/pi-coding-agent 0.80.6 agent-session state queries returning owned values',
    };
  },),
];
