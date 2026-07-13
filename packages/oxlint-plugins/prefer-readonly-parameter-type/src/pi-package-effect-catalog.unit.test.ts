import { readFileSync, } from 'node:fs';
import { fileURLToPath, } from 'node:url';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { isPropertyAccessExpression, } from 'typescript/unstable/ast/is';

import {
  closeSemanticBridge,
  intrinsicEffect,
  intrinsicEffectQuery,
  NO_INTRINSIC_EFFECT,
  NO_INTRINSIC_QUERY,
  openSemanticFile,
} from '../dist/final/node/index.mjs';

/**
 * Real Advisor call used to verify exact Pi declaration identity.
 */
type PiCallProbe = {
  readonly relativePath: string;
  readonly callText: string;
  readonly ownerType: string;
  readonly member: string;
  readonly targets: readonly unknown[];
};

/**
 * Advisor source probes covering each added Pi owner and effect class.
 */
const PROBES: readonly PiCallProbe[] = [
  {
    relativePath: 'index.ts',
    callText: 'pi.registerMessageRenderer',
    ownerType: 'ExtensionAPI',
    member: 'registerMessageRenderer',
    targets: [{ kind: 'receiver', },],
  },
  {
    relativePath: 'commands.ts',
    callText: '.registerCommand(',
    ownerType: 'ExtensionAPI',
    member: 'registerCommand',
    targets: [{ kind: 'receiver', },],
  },
  {
    relativePath: 'command-message.ts',
    callText: 'pi.sendMessage',
    ownerType: 'ExtensionAPI',
    member: 'sendMessage',
    targets: [{ kind: 'receiver', },],
  },
  {
    relativePath: 'commands.ts',
    callText: 'pi.getActiveTools',
    ownerType: 'ExtensionAPI',
    member: 'getActiveTools',
    targets: [],
  },
  {
    relativePath: 'commands.ts',
    callText: 'pi.setActiveTools',
    ownerType: 'ExtensionAPI',
    member: 'setActiveTools',
    targets: [{ kind: 'receiver', },],
  },
  {
    relativePath: 'rendering.ts',
    callText: 'theme.bold',
    ownerType: 'Theme',
    member: 'bold',
    targets: [],
  },
  {
    relativePath: 'rendering.ts',
    callText: 'theme.fg',
    ownerType: 'Theme',
    member: 'fg',
    targets: [],
  },
  {
    relativePath: 'commands.ts',
    callText: '.ui\n        .notify(',
    ownerType: 'ExtensionUIContext',
    member: 'notify',
    targets: [{ kind: 'receiver', },],
  },
  {
    relativePath: 'commands.ts',
    callText: 'ctx.waitForIdle',
    ownerType: 'ExtensionCommandContext',
    member: 'waitForIdle',
    targets: [],
  },
  {
    relativePath: 'advisor-client.ts',
    callText: '.modelRegistry\n    .getApiKeyAndHeaders',
    ownerType: 'ModelRegistry',
    member: 'getApiKeyAndHeaders',
    targets: [
      { kind: 'receiver', },
      {
        kind: 'argument',
        index: 0,
      },
    ],
  },
  {
    relativePath: 'tool.ts',
    callText: '.sessionManager\n      .getBranch',
    ownerType: 'SessionManager',
    member: 'getBranch',
    targets: [],
  },
];

await describe({
  name: 'Pi package effect catalog',
  children: [
    it({
      name: 'resolves audited Advisor calls through exact Pi owners and targets',
      fn: async () => {
        const results = PROBES.map(function resolveProbe(probe,) {
          /**
           * Real Advisor source path containing current call.
           */
          const fileName = fileURLToPath(new URL(
            `../../../pi-plugins/advisor/src/${probe.relativePath}`,
            import.meta.url,
          ),);
          /**
           * Current Advisor source text.
           */
          const sourceText = readFileSync(fileName, 'utf8',);
          /**
           * Start offset for authored call expression.
           */
          const callOffset = sourceText.lastIndexOf(probe.callText,);
          if (callOffset === (-1))
            throw new Error(`Missing Pi call probe ${probe.callText}.`,);
          /**
           * Semantic session for exact Advisor source.
           */
          const session = openSemanticFile({
            fileName,
            sourceText,
            hasBOM: false,
          },);
          /**
           * Callable member node offset after final access delimiter.
           */
          const memberOffset = callOffset + probe.callText.lastIndexOf('.',) + 1;
          /**
           * Semantic node at callable member text.
           */
          const memberNode = session.nodeAtOffset(memberOffset,);
          /**
           * Property access containing callable member.
           */
          const propertyAccess = isPropertyAccessExpression(memberNode,)
            ? memberNode
            : memberNode.parent;
          if ((propertyAccess === undefined) || (!isPropertyAccessExpression(propertyAccess,)))
            throw new Error(`Expected Pi property access for ${probe.callText}.`,);
          /**
           * Semantic receiver and callable member identities.
           */
          const receiverType = session.checker.getTypeAtLocation(propertyAccess.expression,);
          const memberSymbol = session.checker.getSymbolAtLocation(propertyAccess.name,);
          if ((receiverType === undefined) || (memberSymbol === undefined))
            throw new Error(`Expected Pi symbols for ${probe.callText}.`,);
          const query = intrinsicEffectQuery({
            project: session.project,
            receiverType,
            memberSymbol,
          },);
          const effect = query === NO_INTRINSIC_QUERY
            ? NO_INTRINSIC_EFFECT
            : intrinsicEffect(query,);
          if (effect === NO_INTRINSIC_EFFECT)
            throw new Error(`Expected catalog effect for ${probe.callText}.`,);
          return {
            query,
            targets: effect.targets,
          };
        },);
        closeSemanticBridge();
        expect(results,).toEqual(PROBES.map(function expected(probe,) {
          return {
            query: {
              provenance: {
                kind: 'package',
                packageName: '@earendil-works/pi-coding-agent',
                major: 0,
              },
              ownerType: probe.ownerType,
              member: probe.member,
            },
            targets: probe.targets,
          };
        },),);
      },
    },),
  ],
},);
