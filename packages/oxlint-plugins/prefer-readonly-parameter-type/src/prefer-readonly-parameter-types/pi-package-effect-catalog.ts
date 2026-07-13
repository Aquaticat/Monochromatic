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
  ...[
    'appendEntry',
    'on',
    'registerCommand',
    'registerMessageRenderer',
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
  {
    provenance: {
      kind: 'package',
      packageName: '@earendil-works/pi-coding-agent',
      major: 0,
    },
    ownerType: 'ExtensionUIContext',
    member: 'notify',
    targets: [{ kind: 'receiver', },],
    evidence: '@earendil-works/pi-coding-agent 0.80.6 displays host notification state',
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
