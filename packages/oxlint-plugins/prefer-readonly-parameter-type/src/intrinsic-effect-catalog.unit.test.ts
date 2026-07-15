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
  hostEffectAuthorityAvailable,
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

/** Auto-mode tool source used for exact Pi predicate provenance. */
const AUTO_MODE_TOOL_SOURCE_PATH = fileURLToPath(new URL(
  '../../../pi-plugins/auto-mode/src/tool-helpers.ts',
  import.meta.url,
),);

/** Auto-mode tool source text containing Pi predicate calls. */
const AUTO_MODE_TOOL_SOURCE = readFileSync(
  AUTO_MODE_TOOL_SOURCE_PATH,
  'utf8',
);

/** Auto-mode runtime source used for exact global timer provenance. */
const AUTO_MODE_RUNTIME_SOURCE_PATH = fileURLToPath(new URL(
  '../../../pi-plugins/auto-mode/src/judge-runtime.ts',
  import.meta.url,
),);

/** Auto-mode runtime source text containing global timer call. */
const AUTO_MODE_RUNTIME_SOURCE = readFileSync(
  AUTO_MODE_RUNTIME_SOURCE_PATH,
  'utf8',
);

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

/** Guardrail source used for exact ignore matcher provenance. */
const GUARDRAIL_SOURCE_PATH = fileURLToPath(new URL(
  '../../../pi-plugins/guardrail/src/path-guard.ts',
  import.meta.url,
),);

/** Guardrail source text containing audited matcher calls. */
const GUARDRAIL_SOURCE = readFileSync(
  GUARDRAIL_SOURCE_PATH,
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
      name: 'records workspace TOML observation and value uncertainty',
      fn: async () => {
        const getValue = intrinsicEffect({
          provenance: {
            kind: 'package',
            packageName: '@monochromatic-dev/module-toml-edit',
            major: 0,
          },
          ownerType: 'globalThis',
          member: 'tomlGetValue',
        },);
        const setValue = intrinsicEffect({
          provenance: {
            kind: 'package',
            packageName: '@monochromatic-dev/module-toml-edit',
            major: 0,
          },
          ownerType: 'globalThis',
          member: 'tomlSet',
        },);
        expect(getValue,).not.toBe(NO_INTRINSIC_EFFECT,);
        expect(setValue,).not.toBe(NO_INTRINSIC_EFFECT,);
        if ((getValue === NO_INTRINSIC_EFFECT) || (setValue === NO_INTRINSIC_EFFECT))
          throw new Error('Expected workspace TOML effects.',);
        expect(getValue.targets,).toEqual([],);
        expect(setValue.targets,).toEqual([],);
        expect(setValue.opaqueTargets,).toEqual([{
          kind: 'argument',
          index: 0,
          propertyNames: ['value',],
        },],);
      },
    },),
    it({
      name: 'records DataView integer reads and writes',
      fn: async () => {
        [
          'getUint16',
          'getUint32',
        ].forEach(function dataViewRead(member,) {
          const effect = intrinsicEffect({
            provenance: { kind: 'ecmascript', },
            ownerType: 'DataView',
            member,
          },);
          expect(effect,).not.toBe(NO_INTRINSIC_EFFECT,);
          if (effect === NO_INTRINSIC_EFFECT)
            throw new Error(`Expected DataView.${member} effect.`,);
          expect(effect.targets,).toEqual([],);
        },);
        [
          'setUint16',
          'setUint32',
        ].forEach(function dataViewWrite(member,) {
          const effect = intrinsicEffect({
            provenance: { kind: 'ecmascript', },
            ownerType: 'DataView',
            member,
          },);
          expect(effect,).not.toBe(NO_INTRINSIC_EFFECT,);
          if (effect === NO_INTRINSIC_EFFECT)
            throw new Error(`Expected DataView.${member} effect.`,);
          expect(effect.targets,).toEqual([{ kind: 'receiver', },],);
        },);
      },
    },),
    it({
      name: 'records TypedArray observation and callback effects',
      fn: async () => {
        const subarray = intrinsicEffect({
          provenance: { kind: 'ecmascript', },
          ownerType: 'Uint8Array',
          member: 'subarray',
        },);
        expect(subarray,).not.toBe(NO_INTRINSIC_EFFECT,);
        if (subarray === NO_INTRINSIC_EFFECT)
          throw new Error('Expected Uint8Array.subarray intrinsic effect.',);
        expect(subarray.targets,).toEqual([],);
        expect(subarray.receiverValuesReachResult,).toBe(true,);
        const every = intrinsicEffect({
          provenance: { kind: 'ecmascript', },
          ownerType: 'Uint8Array',
          member: 'every',
        },);
        expect(every,).not.toBe(NO_INTRINSIC_EFFECT,);
        if (every === NO_INTRINSIC_EFFECT)
          throw new Error('Expected Uint8Array.every intrinsic effect.',);
        expect(every.targets,).toEqual([],);
        expect(every.opaqueTargets,).toEqual([{
          kind: 'argument',
          index: 1,
        },],);
        expect(every.callbacks,).toEqual([{
          argumentIndex: 0,
          receiverParameterIndexes: [0, 2,],
        },],);
      },
    },),
    it({
      name: 'records Node buffer and Stats observations',
      fn: async () => {
        const concat = intrinsicEffect({
          provenance: { kind: 'node', declarationMajor: 26, },
          ownerType: 'BufferConstructor',
          member: 'concat',
        },);
        const isUtf8 = intrinsicEffect({
          provenance: { kind: 'node', declarationMajor: 26, },
          ownerType: 'node:buffer',
          member: 'isUtf8',
        },);
        expect(concat,).not.toBe(NO_INTRINSIC_EFFECT,);
        expect(isUtf8,).not.toBe(NO_INTRINSIC_EFFECT,);
        if ((concat === NO_INTRINSIC_EFFECT) || (isUtf8 === NO_INTRINSIC_EFFECT))
          throw new Error('Expected Node Buffer observation effects.',);
        expect(concat.targets,).toEqual([],);
        expect(isUtf8.targets,).toEqual([],);
        expect([
          'readInt32LE',
          'readUInt16LE',
          'toString',
        ].every(function bufferObservation(member,): boolean {
          const effect = intrinsicEffect({
            provenance: { kind: 'node', declarationMajor: 26, },
            ownerType: 'Buffer',
            member,
          },);
          return (effect !== NO_INTRINSIC_EFFECT)
            && (effect.targets.length === 0);
        },),).toBe(true,);
        const copy = intrinsicEffect({
          provenance: { kind: 'node', declarationMajor: 26, },
          ownerType: 'Buffer',
          member: 'copy',
        },);
        expect(copy,).not.toBe(NO_INTRINSIC_EFFECT,);
        if (copy === NO_INTRINSIC_EFFECT)
          throw new Error('Expected Buffer.copy intrinsic effect.',);
        expect(copy.targets,).toEqual([{ kind: 'argument', index: 0, },],);
        const isDirectory = intrinsicEffect({
          provenance: { kind: 'node', declarationMajor: 26, },
          ownerType: 'StatsBase',
          member: 'isDirectory',
        },);
        expect(isDirectory,).not.toBe(NO_INTRINSIC_EFFECT,);
        if (isDirectory === NO_INTRINSIC_EFFECT)
          throw new Error('Expected StatsBase.isDirectory intrinsic effect.',);
        expect(isDirectory.targets,).toEqual([],);
      },
    },),
    it({
      name: 'records exact Object hooks and Array copy or callback effects',
      fn: async () => {
        expect([
          'entries',
          'hasOwn',
          'keys',
          'values',
        ].every(function hasObjectHookEffect(member,): boolean {
          const effect = intrinsicEffect({
            provenance: { kind: 'ecmascript', },
            ownerType: 'ObjectConstructor',
            member,
          },);
          return (effect !== NO_INTRINSIC_EFFECT)
            && (effect.targets.length === 1)
            && (effect.targets[0]?.kind === 'argument')
            && (effect.targets[0].index === 0);
        },),).toBe(true,);
        const arrayWith = intrinsicEffect({
          provenance: { kind: 'ecmascript', },
          ownerType: 'ReadonlyArray',
          member: 'with',
        },);
        expect(arrayWith,).not.toBe(NO_INTRINSIC_EFFECT,);
        if (arrayWith === NO_INTRINSIC_EFFECT)
          throw new Error('Expected ReadonlyArray.with intrinsic effect.',);
        expect(arrayWith.targets,).toEqual([],);
        const arrayReduce = intrinsicEffect({
          provenance: { kind: 'ecmascript', },
          ownerType: 'Array',
          member: 'reduce',
        },);
        expect(arrayReduce,).not.toBe(NO_INTRINSIC_EFFECT,);
        if (arrayReduce === NO_INTRINSIC_EFFECT)
          throw new Error('Expected Array.reduce intrinsic effect.',);
        expect(arrayReduce.callbacks,).toEqual([{
          argumentIndex: 0,
          receiverParameterIndexes: [
            1,
            3,
          ],
        },],);
      },
    },),
    it({
      name: 'records dependent-signal relation uncertainty for AbortSignal.any',
      fn: async () => {
        const effect = intrinsicEffect({
          provenance: { kind: 'dom', },
          ownerType: 'AbortSignal',
          member: 'any',
        },);
        expect(effect,).not.toBe(NO_INTRINSIC_EFFECT,);
        if (effect === NO_INTRINSIC_EFFECT)
          throw new Error('Expected AbortSignal.any intrinsic effect.',);
        expect(effect.targets,).toEqual([],);
        expect(effect.opaqueTargets,).toEqual([{
          kind: 'argument',
          index: 0,
        },],);
        const timeoutEffect = intrinsicEffect({
          provenance: { kind: 'dom', },
          ownerType: 'AbortSignal',
          member: 'timeout',
        },);
        expect(timeoutEffect,).not.toBe(NO_INTRINSIC_EFFECT,);
        if (timeoutEffect === NO_INTRINSIC_EFFECT)
          throw new Error('Expected AbortSignal.timeout intrinsic effect.',);
        expect(timeoutEffect.targets,).toEqual([],);
        expect(timeoutEffect.opaqueTargets,).toBe(undefined,);
      },
    },),
    it({
      name: 'records audited canvas receiver effects',
      fn: async () => {
        expect([
          { ownerType: 'HTMLCanvasElement', member: 'getContext', },
          { ownerType: 'OffscreenCanvas', member: 'getContext', },
          { ownerType: 'CanvasRect', member: 'clearRect', },
          { ownerType: 'CanvasDrawImage', member: 'drawImage', },
          { ownerType: 'CanvasRect', member: 'fillRect', },
          { ownerType: 'CanvasText', member: 'fillText', },
          { ownerType: 'CanvasText', member: 'strokeText', },
          { ownerType: 'CanvasState', member: 'save', },
          { ownerType: 'CanvasState', member: 'restore', },
          { ownerType: 'CanvasTransform', member: 'rotate', },
          { ownerType: 'CanvasTransform', member: 'translate', },
          { ownerType: 'CanvasDrawPath', member: 'beginPath', },
          { ownerType: 'CanvasDrawPath', member: 'stroke', },
          { ownerType: 'CanvasPath', member: 'lineTo', },
          { ownerType: 'CanvasPath', member: 'moveTo', },
        ].every(function canvasMutation(query,): boolean {
          const effect = intrinsicEffect({
            provenance: { kind: 'dom', },
            ...query,
          },);
          if (effect === NO_INTRINSIC_EFFECT)
            return false;
          if (effect.targets.length !== 1)
            return false;
          return effect.targets[0]?.kind === 'receiver';
        },),).toBe(true,);
      },
    },),
    it({
      name: 'records audited Fetch effects',
      fn: async () => {
        expect([
          'json',
          'text',
        ].every(function bodyConsumption(member,): boolean {
          const effect = intrinsicEffect({
            provenance: { kind: 'dom', },
            ownerType: 'Body',
            member,
          },);
          if (effect === NO_INTRINSIC_EFFECT)
            return false;
          if (effect.targets.length !== 1)
            return false;
          return effect.targets[0]?.kind === 'receiver';
        },),).toBe(true,);
        expect([
          { ownerType: 'globalThis', member: 'fetch', },
          { ownerType: 'Response', member: 'json', },
        ].every(function fetchBoundary(query,): boolean {
          const effect = intrinsicEffect({
            provenance: { kind: 'dom', },
            ...query,
          },);
          if (effect === NO_INTRINSIC_EFFECT)
            return false;
          return effect.opaqueTargets?.length === 2;
        },),).toBe(true,);
        expect([
          'get',
          'has',
        ].every(function headersObservation(member,): boolean {
          const effect = intrinsicEffect({
            provenance: { kind: 'dom', },
            ownerType: 'Headers',
            member,
          },);
          return (effect !== NO_INTRINSIC_EFFECT)
            && (effect.targets.length === 0);
        },),).toBe(true,);
        const headersSet = intrinsicEffect({
          provenance: { kind: 'dom', },
          ownerType: 'Headers',
          member: 'set',
        },);
        if (headersSet === NO_INTRINSIC_EFFECT)
          throw new Error('Expected Headers.set intrinsic effect.',);
        expect(headersSet.targets,).toEqual([{ kind: 'receiver', },],);
      },
    },),
    it({
      name: 'records audited File API effects',
      fn: async () => {
        expect([
          { ownerType: 'Blob', member: 'text', },
          { ownerType: 'FileList', member: 'item', },
        ].every(function fileObservation(query,): boolean {
          const effect = intrinsicEffect({
            provenance: { kind: 'dom', },
            ...query,
          },);
          if (effect === NO_INTRINSIC_EFFECT)
            return false;
          return effect.targets.length === 0;
        },),).toBe(true,);
        const objectUrl = intrinsicEffect({
          provenance: { kind: 'dom', },
          ownerType: 'URL',
          member: 'createObjectURL',
        },);
        if (objectUrl === NO_INTRINSIC_EFFECT)
          throw new Error('Expected URL.createObjectURL intrinsic effect.',);
        expect(objectUrl.opaqueTargets,).toEqual([{ kind: 'argument', index: 0, },],);
      },
    },),
    it({
      name: 'records audited DOM element effects',
      fn: async () => {
        const appendEffect = intrinsicEffect({
          provenance: { kind: 'dom', },
          ownerType: 'ParentNode',
          member: 'append',
        },);
        if (appendEffect === NO_INTRINSIC_EFFECT)
          throw new Error('Expected ParentNode.append intrinsic effect.',);
        expect(appendEffect.targets,).toEqual([
          { kind: 'receiver', },
          { kind: 'arguments-from', startIndex: 0, },
        ],);
        expect([
          { ownerType: 'Element', member: 'closest', },
          { ownerType: 'ParentNode', member: 'querySelector', },
          { ownerType: 'ParentNode', member: 'querySelectorAll', },
          { ownerType: 'Element', member: 'getBoundingClientRect', },
          { ownerType: 'URLSearchParams', member: 'get', },
        ].every(function elementObservation(query,): boolean {
          const effect = intrinsicEffect({
            provenance: { kind: 'dom', },
            ...query,
          },);
          if (effect === NO_INTRINSIC_EFFECT)
            return false;
          return effect.targets.length === 0;
        },),).toBe(true,);
        expect([
          { ownerType: 'Element', member: 'setAttribute', },
          { ownerType: 'DOMTokenList', member: 'toggle', },
          { ownerType: 'HTMLElement', member: 'hidePopover', },
        ].every(function elementMutation(query,): boolean {
          const effect = intrinsicEffect({
            provenance: { kind: 'dom', },
            ...query,
          },);
          if (effect === NO_INTRINSIC_EFFECT)
            return false;
          if (effect.targets.length !== 1)
            return false;
          return effect.targets[0]?.kind === 'receiver';
        },),).toBe(true,);
      },
    },),
    it({
      name: 'records dispatch listener uncertainty for receiver and event',
      fn: async () => {
        const effect = intrinsicEffect({
          provenance: { kind: 'dom', },
          ownerType: 'EventTarget',
          member: 'dispatchEvent',
        },);
        if (effect === NO_INTRINSIC_EFFECT)
          throw new Error('Expected EventTarget.dispatchEvent intrinsic effect.',);
        expect(effect.opaqueTargets,).toEqual([
          { kind: 'receiver', },
          { kind: 'argument', index: 0, },
        ],);
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
        [
          'toLocaleDateString',
          'toLocaleString',
        ].forEach(function localeDateEffect(member,) {
          const localizedDate = intrinsicEffect({
            provenance: { kind: 'ecmascript', },
            ownerType: 'Date',
            member,
          },);
          expect(localizedDate,).not.toBe(NO_INTRINSIC_EFFECT,);
          if (localizedDate === NO_INTRINSIC_EFFECT)
            throw new Error(`Expected Date.${member} observational effect.`,);
          expect(localizedDate.targets,).toEqual([],);
          expect(localizedDate.opaqueTargets,).toEqual([
            { kind: 'argument', index: 0, },
            { kind: 'argument', index: 1, },
          ],);
        },);
        const textDecoder = intrinsicEffect({
          provenance: { kind: 'dom', },
          ownerType: 'TextDecoder',
          member: 'decode',
        },);
        expect(textDecoder,).not.toBe(NO_INTRINSIC_EFFECT,);
        if (textDecoder === NO_INTRINSIC_EFFECT)
          throw new Error('Expected TextDecoder.decode receiver effect.',);
        expect(textDecoder.targets,).toEqual([{ kind: 'receiver', },],);
        expect([
          {
            provenance: { kind: 'dom', } as const,
            ownerType: 'globalThis',
            member: 'getComputedStyle',
          },
          {
            provenance: { kind: 'dom', } as const,
            ownerType: 'CanvasText',
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
        const usageEffect = intrinsicEffect({
          provenance: {
            kind: 'package',
            packageName: '@monochromatic-dev/agent-harnesses-shared-usage-projection',
            major: 0,
          },
          ownerType: 'globalThis',
          member: 'formatRateLimitStatus',
        },);
        expect(usageEffect,).not.toBe(NO_INTRINSIC_EFFECT,);
        if (usageEffect === NO_INTRINSIC_EFFECT)
          throw new Error('Expected shared usage formatting effect.',);
        expect(usageEffect.targets,).toEqual([],);
        expect(usageEffect.invokedArgumentProperties,).toEqual([{
          argumentIndex: 0,
          propertyNames: ['style',],
        },],);
        const loggerEffect = intrinsicEffect({
          provenance: {
            kind: 'package',
            packageName: '@monochromatic-dev/module-logger',
            major: 0,
          },
          ownerType: 'Logger',
          member: 'debug',
        },);
        expect(loggerEffect,).not.toBe(NO_INTRINSIC_EFFECT,);
        if (loggerEffect === NO_INTRINSIC_EFFECT)
          throw new Error('Expected logger capability effect.',);
        expect(loggerEffect.targets,).toEqual([{ kind: 'receiver', },],);
        const ignoreTestEffect = intrinsicEffect({
          provenance: {
            kind: 'package',
            packageName: 'ignore',
            major: 7,
          },
          ownerType: 'Ignore',
          member: 'test',
        },);
        expect(ignoreTestEffect,).not.toBe(NO_INTRINSIC_EFFECT,);
        if (ignoreTestEffect === NO_INTRINSIC_EFFECT)
          throw new Error('Expected ignore matcher cache effect.',);
        expect(ignoreTestEffect.targets,).toEqual([{ kind: 'receiver', },],);
      },
    },),
    it({
      name: 'resolves exact ignore matcher owner and package provenance',
      fn: async () => {
        const session = openSemanticFile({
          fileName: GUARDRAIL_SOURCE_PATH,
          sourceText: GUARDRAIL_SOURCE,
          hasBOM: false,
        },);
        const memberOffsets = [
          GUARDRAIL_SOURCE.indexOf('matcher.add',) + 'matcher.'.length,
          GUARDRAIL_SOURCE.indexOf(
            '.test(relativePath',
            GUARDRAIL_SOURCE.indexOf('ruleMatcher.ignore',),
          ) + 1,
        ];
        const queries = memberOffsets.map(function matcherQuery(offset,) {
          const memberNode = session.nodeAtOffset(offset,);
          const propertyAccess = memberNode.parent;
          if (!isPropertyAccessExpression(propertyAccess,))
            throw new Error('Expected ignore matcher property access.',);
          const receiverType = session.checker.getTypeAtLocation(propertyAccess.expression,);
          const memberSymbol = session.checker.getSymbolAtLocation(propertyAccess.name,);
          if ((receiverType === undefined) || (memberSymbol === undefined))
            throw new Error('Expected ignore matcher semantic identity.',);
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
              packageName: 'ignore',
              major: 7,
            },
            ownerType: 'Ignore',
            member: 'add',
          },
          {
            provenance: {
              kind: 'package',
              packageName: 'ignore',
              major: 7,
            },
            ownerType: 'Ignore',
            member: 'test',
          },
        ],);
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
          'AbortSignal.timeout',
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
            ownerType: 'AbortSignal',
            member: 'timeout',
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
      name: 'resolves exact global timer provenance and deferred callback effect',
      fn: async () => {
        const session = openSemanticFile({
          fileName: AUTO_MODE_RUNTIME_SOURCE_PATH,
          sourceText: AUTO_MODE_RUNTIME_SOURCE,
          hasBOM: false,
        },);
        const node = session.nodeAtOffset(AUTO_MODE_RUNTIME_SOURCE.indexOf('setTimeout(',),);
        if (!isIdentifier(node,))
          throw new Error('Expected global setTimeout identifier.',);
        const symbol = session.checker.getResolvedSymbol(node,);
        if (symbol === undefined)
          throw new Error('Expected resolved global setTimeout symbol.',);
        const query = intrinsicCallableEffectQuery({
          project: session.project,
          memberSymbol: symbol,
        },);
        expect(query,).toEqual({
          provenance: { kind: 'dom', },
          ownerType: 'globalThis',
          member: 'setTimeout',
        },);
        if (query === NO_INTRINSIC_QUERY)
          throw new Error('Expected global setTimeout intrinsic query.',);
        const effect = intrinsicEffect(query,);
        if (effect === NO_INTRINSIC_EFFECT)
          throw new Error('Expected global setTimeout intrinsic effect.',);
        expect(effect.targets,).toEqual([],);
        expect(effect.forwardedCallbacks,).toEqual([{
          callbackArgumentIndex: 0,
          sourceArgumentStartIndex: 2,
        },],);
        expect(effect.invokedArgumentIndexes,).toEqual([0,],);
        closeSemanticBridge();
      },
    },),
    it({
      name: 'resolves exact Pi tool-event predicate provenance',
      fn: async () => {
        const session = openSemanticFile({
          fileName: AUTO_MODE_TOOL_SOURCE_PATH,
          sourceText: AUTO_MODE_TOOL_SOURCE,
          hasBOM: false,
        },);
        const offset = AUTO_MODE_TOOL_SOURCE.indexOf(
          'isToolCallEventType(',
          AUTO_MODE_TOOL_SOURCE.indexOf('function buildApprovalFingerprintIdentity',),
        );
        const node = session.nodeAtOffset(offset,);
        if (!isIdentifier(node,))
          throw new Error('Expected Pi isToolCallEventType identifier.',);
        const symbol = session.checker.getResolvedSymbol(node,);
        if (symbol === undefined)
          throw new Error('Expected resolved Pi isToolCallEventType symbol.',);
        const query = intrinsicCallableEffectQuery({
          project: session.project,
          memberSymbol: symbol,
        },);
        expect(query,).toEqual({
          provenance: {
            kind: 'package',
            packageName: '@earendil-works/pi-coding-agent',
            major: 0,
          },
          ownerType: 'globalThis',
          member: 'isToolCallEventType',
        },);
        if (query === NO_INTRINSIC_QUERY)
          throw new Error('Expected Pi tool-event predicate query.',);
        const effect = intrinsicEffect(query,);
        if (effect === NO_INTRINSIC_EFFECT)
          throw new Error('Expected Pi tool-event predicate effect.',);
        expect(effect.targets,).toEqual([],);
        closeSemanticBridge();
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
          provenance: { kind: 'node', declarationMajor: 26, },
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
        /**
         * Audited caught-value conversion effect.
         */
        const caughtValueEffect = intrinsicEffect({
          provenance: {
            kind: 'package',
            packageName: '@monochromatic-dev/module-caught-value',
            major: 0,
          },
          ownerType: 'globalThis',
          member: 'caughtValueText',
        },);
        if (caughtValueEffect === NO_INTRINSIC_EFFECT)
          throw new Error('Expected caught-value formatter intrinsic effect.',);
        expect(caughtValueEffect.targets,).toEqual([{
          kind: 'argument',
          index: 0,
        },],);
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
      name: 'records authoritative evidence for every audited host entry',
      fn: async () => {
        expect(INTRINSIC_EFFECTS.every(function hasEvidence(entry,): boolean {
          return entry.evidence.length > 0;
        },),).toBe(true,);
        expect(INTRINSIC_EFFECTS
          .filter(function isHostEntry(entry,): boolean {
            return entry.provenance.kind !== 'package';
          },)
          .every(function hasAuthority(entry,): boolean {
            if (entry.authority === undefined)
              return false;
            return hostEffectAuthorityAvailable(entry.authority,);
          },),).toBe(true,);
        expect(intrinsicEffect({
          provenance: { kind: 'node', declarationMajor: 26, },
          ownerType: 'node:path',
          member: 'join',
        },),).not.toBe(NO_INTRINSIC_EFFECT,);
        expect(intrinsicEffect({
          provenance: { kind: 'node', declarationMajor: 25, },
          ownerType: 'node:path',
          member: 'join',
        },),).toBe(NO_INTRINSIC_EFFECT,);
        expect(hostEffectAuthorityAvailable({
          kind: 'standard-algorithm',
          standard: 'ECMA-262',
          revision: 'unrecognized',
          sourceDigest: 'unrecognized',
          algorithm: 'Set.prototype.add',
        },),).toBe(false,);
        expect(hostEffectAuthorityAvailable({
          kind: 'standard-algorithm',
          standard: 'ECMA-262',
          revision: '1355a23e48aaf2b1d7b6cbfad0fb98bce999cfd1',
          sourceDigest: '313826a4ff419145470a9d688b8da21e326374afb2a9c73aa9183fbc57162845',
          algorithm: 'sec-not-a-real-algorithm',
        },),).toBe(false,);
        expect(hostEffectAuthorityAvailable({
          kind: 'node-builtin-source',
          nodeVersion: '0.0.0',
          module: 'path',
          sourceDigest: 'unrecognized',
          definitionMarkers: [],
          relatedSources: [],
        },),).toBe(false,);
        expect(hostEffectAuthorityAvailable({
          kind: 'node-builtin-source',
          nodeVersion: process.versions.node,
          module: 'path',
          sourceDigest: 'unrecognized',
          definitionMarkers: [{
            text: '\n  join(',
            occurrenceCount: 2,
          },],
          relatedSources: [],
        },),).toBe(false,);
        expect(hostEffectAuthorityAvailable({
          kind: 'node-builtin-source',
          nodeVersion: process.versions.node,
          module: 'path',
          sourceDigest: 'dd326ecdc2d6ad2025c4991f4b480d76a9f1d52b7f6d0988a5dc0a1d02de5209',
          definitionMarkers: [{
            text: 'not an exported definition',
            occurrenceCount: 1,
          },],
          relatedSources: [],
        },),).toBe(false,);
      },
    },),
  ],
},);
