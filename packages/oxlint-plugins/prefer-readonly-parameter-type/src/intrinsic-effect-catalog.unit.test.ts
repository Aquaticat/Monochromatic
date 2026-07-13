import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';
import { fileURLToPath, } from 'node:url';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  closeSemanticBridge,
  INTRINSIC_EFFECTS,
  intrinsicCallableEffectQuery,
  intrinsicEffect,
  intrinsicEffectQuery,
  intrinsicProvenance,
  NO_INTRINSIC_EFFECT,
  NO_INTRINSIC_PROVENANCE,
  NO_INTRINSIC_QUERY,
  openSemanticFile,
} from '../dist/final/node/index.mjs';
import {
  isIdentifier,
  isPropertyAccessExpression,
} from 'typescript/unstable/ast/is';

/** Intrinsic-provenance source fixture. */
const FIXTURE_PATH = fileURLToPath(new URL(
  '../../../test-fixture/oxlint-no-restricted-syntax/src/valid/typescript-sync-adapter.ts',
  import.meta.url,
),);

/** Disposable fake package installation root. */
type PackageFixture = {
  readonly path: string;
  [Symbol.dispose]: () => void;
};

/**
 * Creates disposable package provenance fixture.
 *
 * @returns disposable package fixture root.
 */
function createPackageFixture(): PackageFixture {
  /** Unique package fixture root. */
  const path = mkdtempSync(join(tmpdir(), 'intrinsic-package-',),);
  return {
    path,
    [Symbol.dispose]: function removePackageFixture(): void {
      rmSync(path, { recursive: true, force: true, },);
    },
  };
}

/** Workspace package source used for manifest provenance. */
const SHARED_SOURCE_PATH = fileURLToPath(new URL(
  '../../shared/src/index.ts',
  import.meta.url,
),);

/** Pi extension source used for exact package method provenance. */
const PI_EXTENSION_SOURCE_PATH = fileURLToPath(new URL(
  '../../../pi-plugins/auto-mode/src/register-propose-trust.ts',
  import.meta.url,
),);

/** Pi extension source text containing audited method calls. */
const PI_EXTENSION_SOURCE = readFileSync(
  PI_EXTENSION_SOURCE_PATH,
  'utf8',
);

/** MCP stdio transport source used for exact writer provenance. */
const MCP_STDIO_SOURCE_PATH = fileURLToPath(new URL(
  '../../../mcp/stdio/src/transport.ts',
  import.meta.url,
),);

/** MCP stdio transport source text containing audited writer call. */
const MCP_STDIO_SOURCE = readFileSync(
  MCP_STDIO_SOURCE_PATH,
  'utf8',
);

/** Current fixture source text. */
const SOURCE = readFileSync(
  FIXTURE_PATH,
  'utf8',
);

await describe({
  name: intrinsicEffect.name,
  children: [
    it({
      name: 'matches exact ECMAScript owner and member symbols',
      fn: async () => {
        const effect = intrinsicEffect({
          provenance: { kind: 'ecmascript', },
          ownerType: 'Set',
          member: 'add',
        },);
        expect(effect,).not.toBe(NO_INTRINSIC_EFFECT,);
        if (effect === NO_INTRINSIC_EFFECT)
          throw new Error('Expected Set.add intrinsic effect.',);
        expect(effect.targets,).toEqual([{ kind: 'receiver', },],);
      },
    },),
    it({
      name: 'records dependent-signal mutation for AbortSignal.any',
      fn: async () => {
        const effect = intrinsicEffect({
          provenance: { kind: 'dom', },
          ownerType: 'AbortSignal',
          member: 'any',
        },);
        expect(effect,).not.toBe(NO_INTRINSIC_EFFECT,);
        if (effect === NO_INTRINSIC_EFFECT)
          throw new Error('Expected AbortSignal.any intrinsic effect.',);
        expect(effect.targets,).toEqual([{
          kind: 'argument',
          index: 0,
        },],);
      },
    },),
    it({
      name: 'matches audited observational intrinsics with no mutation targets',
      fn: async () => {
        const arrayCheck = intrinsicEffect({
          provenance: { kind: 'ecmascript', },
          ownerType: 'ArrayConstructor',
          member: 'isArray',
        },);
        expect(arrayCheck,).not.toBe(NO_INTRINSIC_EFFECT,);
        if (arrayCheck === NO_INTRINSIC_EFFECT)
          throw new Error('Expected Array.isArray observational effect.',);
        expect(arrayCheck.targets,).toEqual([],);
        expect([
          {
            provenance: { kind: 'dom', } as const,
            ownerType: 'globalThis',
            member: 'getComputedStyle',
          },
          {
            provenance: { kind: 'dom', } as const,
            ownerType: 'CanvasRenderingContext2D',
            member: 'measureText',
          },
        ].every(function domObservation(query,): boolean {
          const effect = intrinsicEffect(query,);
          return (effect !== NO_INTRINSIC_EFFECT)
            && (effect.targets.length === 0);
        },),).toBe(true,);
      },
    },),
    it({
      name: 'does not match method name on another owner',
      fn: async () => {
        expect(intrinsicEffect({
          provenance: { kind: 'ecmascript', },
          ownerType: 'Array',
          member: 'add',
        },),).toBe(NO_INTRINSIC_EFFECT,);
      },
    },),
    it({
      name: 'gates package effects by exact major version',
      fn: async () => {
        expect(intrinsicEffect({
          provenance: {
            kind: 'package',
            packageName: 'typescript',
            major: 7,
          },
          ownerType: 'API',
          member: 'updateSnapshot',
        },),).not.toBe(NO_INTRINSIC_EFFECT,);
        expect(intrinsicEffect({
          provenance: {
            kind: 'package',
            packageName: 'typescript',
            major: 6,
          },
          ownerType: 'API',
          member: 'updateSnapshot',
        },),).toBe(NO_INTRINSIC_EFFECT,);
        const scopeEffect = intrinsicEffect({
          provenance: {
            kind: 'package',
            packageName: '@monochromatic-dev/pi-shared-model-selection',
            major: 0,
          },
          ownerType: 'globalThis',
          member: 'resolveEffectiveScope',
        },);
        expect(scopeEffect,).not.toBe(NO_INTRINSIC_EFFECT,);
        if (scopeEffect === NO_INTRINSIC_EFFECT)
          throw new Error('Expected model-scope capability effect.',);
        expect(scopeEffect.targets,).toEqual([{
          kind: 'argument',
          index: 0,
          propertyNames: ['ctx',],
        },],);
      },
    },),
    it({
      name: 'resolves exact ECMAScript and DOM declaration provenance',
      fn: async () => {
        const session = openSemanticFile({
          fileName: FIXTURE_PATH,
          sourceText: SOURCE,
          hasBOM: false,
        },);
        const queries = [
          'values.add',
          'controller.abort',
          'AbortSignal.any',
          'encoder.encode',
          'Array.isArray',
          'Object.is',
          'inputs.text.trim',
          'Error.isError',
        ].map(function queryMember(memberText,) {
          const memberOffset = SOURCE.indexOf(memberText,) + memberText.lastIndexOf('.',) + 1;
          const memberNode = session.nodeAtOffset(memberOffset,);
          const propertyAccess = memberNode.parent;
          if (!isPropertyAccessExpression(propertyAccess,))
            throw new Error(`Expected property access for ${memberText}.`,);
          const receiverType = session.checker.getTypeAtLocation(propertyAccess.expression,);
          const memberSymbol = session.checker.getSymbolAtLocation(propertyAccess.name,);
          if ((receiverType === undefined) || (memberSymbol === undefined))
            throw new Error(`Expected semantic receiver and member for ${memberText}.`,);
          return intrinsicEffectQuery({
            project: session.project,
            receiverType,
            memberSymbol,
          },);
        },);
        closeSemanticBridge();

        expect(queries,).toEqual([
          {
            provenance: { kind: 'ecmascript', },
            ownerType: 'Set',
            member: 'add',
          },
          {
            provenance: { kind: 'dom', },
            ownerType: 'AbortController',
            member: 'abort',
          },
          {
            provenance: { kind: 'dom', },
            ownerType: 'AbortSignal',
            member: 'any',
          },
          {
            provenance: { kind: 'dom', },
            ownerType: 'TextEncoder',
            member: 'encode',
          },
          {
            provenance: { kind: 'ecmascript', },
            ownerType: 'ArrayConstructor',
            member: 'isArray',
          },
          {
            provenance: { kind: 'ecmascript', },
            ownerType: 'ObjectConstructor',
            member: 'is',
          },
          {
            provenance: { kind: 'ecmascript', },
            ownerType: 'String',
            member: 'trim',
          },
          {
            provenance: { kind: 'ecmascript', },
            ownerType: 'ErrorConstructor',
            member: 'isError',
          },
        ],);
        expect(queries,).not.toContain(NO_INTRINSIC_QUERY,);
      },
    },),
    it({
      name: 'resolves exact imported Node module callable provenance',
      fn: async () => {
        const session = openSemanticFile({
          fileName: FIXTURE_PATH,
          sourceText: SOURCE,
          hasBOM: false,
        },);
        /** Imported join identifier in path observation fixture. */
        const node = session.nodeAtOffset(SOURCE.indexOf('join(path',),);
        if (!isIdentifier(node,))
          throw new Error('Expected node:path join identifier.',);
        const symbol = session.checker.getResolvedSymbol(node,);
        if (symbol === undefined)
          throw new Error('Expected resolved node:path join symbol.',);
        expect(intrinsicCallableEffectQuery({
          project: session.project,
          memberSymbol: symbol,
        },),).toEqual({
          provenance: { kind: 'node', },
          ownerType: 'node:path',
          member: 'join',
        },);
        closeSemanticBridge();
      },
    },),
    it({
      name: 'resolves named type-alias owner for MCP stdout writer',
      fn: async () => {
        const session = openSemanticFile({
          fileName: MCP_STDIO_SOURCE_PATH,
          sourceText: MCP_STDIO_SOURCE,
          hasBOM: false,
        },);
        const memberOffset = MCP_STDIO_SOURCE.lastIndexOf('writer.write',)
          + 'writer.'.length;
        const memberNode = session.nodeAtOffset(memberOffset,);
        const propertyAccess = memberNode.parent;
        if (!isPropertyAccessExpression(propertyAccess,))
          throw new Error('Expected StdoutWriter property access.',);
        const receiverType = session.checker.getTypeAtLocation(propertyAccess.expression,);
        const memberSymbol = session.checker.getSymbolAtLocation(propertyAccess.name,);
        if ((receiverType === undefined) || (memberSymbol === undefined))
          throw new Error('Expected StdoutWriter receiver and member.',);
        expect(intrinsicEffectQuery({
          project: session.project,
          receiverType,
          memberSymbol,
        },),).toEqual({
          provenance: {
            kind: 'package',
            packageName: '@monochromatic-dev/mcp-stdio',
            major: 0,
          },
          ownerType: 'StdoutWriter',
          member: 'write',
        },);
        closeSemanticBridge();
      },
    },),
    it({
      name: 'resolves exact Pi extension API method provenance',
      fn: async () => {
        const session = openSemanticFile({
          fileName: PI_EXTENSION_SOURCE_PATH,
          sourceText: PI_EXTENSION_SOURCE,
          hasBOM: false,
        },);
        const queries = [
          '  pi.registerTool({',
          '        pi.appendEntry(',
        ].map(function piMethodQuery(callText,) {
          const memberOffset = PI_EXTENSION_SOURCE.indexOf(callText,)
            + callText.indexOf('.',)
            + 1;
          const memberNode = session.nodeAtOffset(memberOffset,);
          const propertyAccess = memberNode.parent;
          if (!isPropertyAccessExpression(propertyAccess,))
            throw new Error(`Expected Pi property access for ${callText}.`,);
          const receiverType = session.checker.getTypeAtLocation(propertyAccess.expression,);
          const memberSymbol = session.checker.getSymbolAtLocation(propertyAccess.name,);
          if ((receiverType === undefined) || (memberSymbol === undefined))
            throw new Error(`Expected Pi receiver and member for ${callText}.`,);
          return intrinsicEffectQuery({
            project: session.project,
            receiverType,
            memberSymbol,
          },);
        },);
        closeSemanticBridge();

        expect(queries,).toEqual([
          {
            provenance: {
              kind: 'package',
              packageName: '@earendil-works/pi-coding-agent',
              major: 0,
            },
            ownerType: 'ExtensionAPI',
            member: 'registerTool',
          },
          {
            provenance: {
              kind: 'package',
              packageName: '@earendil-works/pi-coding-agent',
              major: 0,
            },
            ownerType: 'ExtensionAPI',
            member: 'appendEntry',
          },
        ],);
        expect(queries.every(function catalogued(query,): boolean {
          return (query !== NO_INTRINSIC_QUERY)
            && (intrinsicEffect(query,) !== NO_INTRINSIC_EFFECT);
        },),).toBe(true,);
        expect([
          'getActiveTools',
          'getThinkingLevel',
          'on',
          'registerCommand',
          'registerMessageRenderer',
          'sendMessage',
          'setActiveTools',
          'setThinkingLevel',
        ].every(function piMemberCatalogued(member,): boolean {
          return intrinsicEffect({
            provenance: {
              kind: 'package',
              packageName: '@earendil-works/pi-coding-agent',
              major: 0,
            },
            ownerType: 'ExtensionAPI',
            member,
          },) !== NO_INTRINSIC_EFFECT;
        },),).toBe(true,);
        expect([
          { ownerType: 'ExtensionCommandContext', member: 'waitForIdle', },
          { ownerType: 'ExtensionUIContext', member: 'notify', },
          { ownerType: 'ModelRegistry', member: 'getApiKeyAndHeaders', },
          { ownerType: 'SessionManager', member: 'getBranch', },
          { ownerType: 'Theme', member: 'bold', },
          { ownerType: 'Theme', member: 'fg', },
        ].every(function piOwnedMemberCatalogued({ ownerType, member, },): boolean {
          return intrinsicEffect({
            provenance: {
              kind: 'package',
              packageName: '@earendil-works/pi-coding-agent',
              major: 0,
            },
            ownerType,
            member,
          },) !== NO_INTRINSIC_EFFECT;
        },),).toBe(true,);
        expect(intrinsicEffect({
          provenance: {
            kind: 'package',
            packageName: '@monochromatic-dev/module-current-time-context',
            major: 0,
          },
          ownerType: 'globalThis',
          member: 'formatTimeContext',
        },),).not.toBe(NO_INTRINSIC_EFFECT,);
      },
    },),
    it({
      name: 'resolves nearest workspace package manifest provenance',
      fn: async () => {
        const session = openSemanticFile({
          fileName: FIXTURE_PATH,
          sourceText: SOURCE,
          hasBOM: false,
        },);
        expect(intrinsicProvenance({
          project: session.project,
          fileName: SHARED_SOURCE_PATH,
        },),).toEqual({
          kind: 'package',
          packageName: '@monochromatic-dev/config-oxlint-shared',
          major: 0,
        },);
        closeSemanticBridge();
      },
    },),
    it({
      name: 'distinguishes duplicate majors aliases subpaths and missing metadata',
      fn: async () => {
        using fixture = createPackageFixture();
        const session = openSemanticFile({
          fileName: FIXTURE_PATH,
          sourceText: SOURCE,
          hasBOM: false,
        },);
        /** Creates one fake installed package declaration path. */
        function packageDeclarationPath({
          directoryName,
          packageName,
          version,
        }: {
          readonly directoryName: string;
          readonly packageName: string;
          readonly version: string;
        }): string {
          /** Installed package root under disposable node_modules boundary. */
          const packageRoot = join(
            fixture.path,
            directoryName,
            'node_modules',
            directoryName,
          );
          /** Nested declaration directory proving subpath support. */
          const declarationDirectory = join(packageRoot, 'dist', 'subpath',);
          mkdirSync(declarationDirectory, { recursive: true, },);
          writeFileSync(
            join(packageRoot, 'package.json',),
            `${JSON.stringify({ name: packageName, version, },)}\n`,
          );
          return join(declarationDirectory, 'index.d.ts',);
        }
        /** Same package identity installed at major six. */
        const majorSix = packageDeclarationPath({
          directoryName: 'major-six',
          packageName: 'canonical-runtime',
          version: '6.4.0',
        },);
        /** Same package identity installed at major seven. */
        const majorSeven = packageDeclarationPath({
          directoryName: 'major-seven',
          packageName: 'canonical-runtime',
          version: '7.1.0',
        },);
        /** Alias directory whose manifest retains canonical package name. */
        const aliased = packageDeclarationPath({
          directoryName: 'runtime-alias',
          packageName: 'canonical-runtime',
          version: '7.2.0',
        },);
        expect([
          intrinsicProvenance({ project: session.project, fileName: majorSix, },),
          intrinsicProvenance({ project: session.project, fileName: majorSeven, },),
          intrinsicProvenance({ project: session.project, fileName: aliased, },),
        ],).toEqual([
          { kind: 'package', packageName: 'canonical-runtime', major: 6, },
          { kind: 'package', packageName: 'canonical-runtime', major: 7, },
          { kind: 'package', packageName: 'canonical-runtime', major: 7, },
        ],);
        expect(intrinsicProvenance({
          project: session.project,
          fileName: join(fixture.path, 'missing', 'index.d.ts',),
        },),).toBe(NO_INTRINSIC_PROVENANCE,);
        closeSemanticBridge();
      },
    },),
    it({
      name: 'records evidence for every audited entry',
      fn: async () => {
        expect(INTRINSIC_EFFECTS.every(function hasEvidence(entry,): boolean {
          return entry.evidence.length > 0;
        },),).toBe(true,);
      },
    },),
  ],
},);
