/**
 * Tests for text marker scanners and error paths of the parsing core.
 * Fixtures are cat-themed invention mirroring corpus structure only.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  buildDocumentNodes,
  buildFootnoteGraph,
  MdxParseError,
  parseMarkdownBody,
  parseMdxBody,
  scanFullwidthMarkers,
  scanGfmReferenceLiterals,
  UnpositionedNodeError,
} from '../dist/final/node/index.mjs';

await describe({
  name: scanFullwidthMarkers.name,
  children: [
    it({
      name: 'finds ASCII-digit markers with slice-local offsets',
      fn: async () => {
        expect(scanFullwidthMarkers({ slice: '猫须考〔1〕与〔23〕', },),).toEqual([
          { identifier: '1', localOffset: 3, },
          { identifier: '23', localOffset: 7, },
        ],);
      },
    },),

    it({
      name: 'normalizes full-width digits to ASCII identifiers',
      fn: async () => {
        expect(scanFullwidthMarkers({ slice: '尾巴〔１２〕', },),).toEqual([
          { identifier: '12', localOffset: 2, },
        ],);
      },
    },),

    it({
      name: 'ignores empty, unterminated, and non-digit brackets',
      fn: async () => {
        expect(scanFullwidthMarkers({ slice: '空〔〕未闭〔12猫〔喵〕', },),).toEqual([],);
      },
    },),
  ],
},);

await describe({
  name: scanGfmReferenceLiterals.name,
  children: [
    it({
      name: 'finds literal references and rejects stopper characters',
      fn: async () => {
        expect(scanGfmReferenceLiterals({ slice: '引用[^7]与[^note]，普通[括号]和[^带 空格]不算', },),)
          .toEqual([
            { identifier: '7', localOffset: 2, },
            { identifier: 'note', localOffset: 7, },
          ],);
      },
    },),

    it({
      name: 'ignores empty and unterminated literals',
      fn: async () => {
        expect(scanGfmReferenceLiterals({ slice: '空[^]和未闭[^12', },),).toEqual([],);
      },
    },),
  ],
},);

await describe({
  name: buildFootnoteGraph.name,
  children: [
    it({
      name: 'collects both conventions and reports only real integrity gaps',
      fn: async () => {
        /**
         * Body pairing a mid-text fullwidth reference with its
         * block-opening definition, a resolved GFM pair, and one
         * never-referenced GFM definition.
         */
        const body =
          '猫的脚注〔1〕与蝴蝶。[^2]\n\n〔1〕关于猫的注释。\n\n[^2]: 关于蝴蝶的注释。\n\n[^3]: 没有人引用的注释。\n';
        const graph = buildFootnoteGraph({
          children: parseMarkdownBody({ body, },).children,
          bodyText: body,
          bodyOffset: 0,
        },);
        expect(
          graph.references.map(function toKey(reference,) {
            return `${reference.convention}/${reference.identifier}`;
          },),
        ).toEqual(['fullwidth-bracket/1', 'gfm/2',],);
        expect(graph.references[0]?.offset,).toBe(body.indexOf('〔1〕',),);
        expect(
          graph.definitions.map(function toKey(definition,) {
            return `${definition.convention}/${definition.identifier}`;
          },),
        ).toEqual(['fullwidth-bracket/1', 'gfm/2', 'gfm/3',],);
        expect(graph.findings,).toHaveLength(1,);
        const [finding,] = graph.findings;
        expect(finding?.kind,).toBe('orphan-definition',);
        expect(finding?.convention,).toBe('gfm',);
        expect(finding?.identifier,).toBe('3',);
        expect(finding?.nodeId,).toContain('block/',);
      },
    },),
    it({
      name: 'reports unresolved references and duplicate definitions',
      fn: async () => {
        /**
         * Body with an undefined GFM reference and one fullwidth
         * identifier defined twice, referenced never.
         */
        const body = '未定义的引用[^9]。\n\n〔2〕第一次定义。\n\n〔2〕第二次定义。\n';
        const graph = buildFootnoteGraph({
          children: parseMarkdownBody({ body, },).children,
          bodyText: body,
          bodyOffset: 0,
        },);

        /**
         * Finding kinds grouped for branch-by-branch assertion.
         */
        const kinds = graph.findings.map(function toKind(finding,) {
          return finding.kind;
        },);
        expect(kinds.filter(function isUnresolved(kind,) {
          return kind === 'unresolved-reference';
        },),).toHaveLength(1,);
        expect(kinds.filter(function isDuplicate(kind,) {
          return kind === 'duplicate-definition';
        },),).toHaveLength(2,);
      },
    },),
  ],
},);

await describe({
  name: parseMarkdownBody.name,
  children: [
    it({
      name: 'parses JSX-hostile text as plain markdown without throwing',
      fn: async () => {
        /**
         * Body that MDX parsing rejects but markdown accepts.
         */
        const root = parseMarkdownBody({ body: '<MaoBox 未闭合的组件\n\n喵。\n', },);
        expect(root.type,).toBe('root',);
        expect(root.children.length,).toBeGreaterThanOrEqual(1,);
      },
    },),
  ],
},);

await describe({
  name: parseMdxBody.name,
  children: [
    it({
      name: 'throws MdxParseError on invalid JSX',
      fn: async () => {
        /** Value caught from parse of unclosed JSX element. */
        let caught: unknown;
        try {
          parseMdxBody({ body: '<MaoBox 未闭合的组件\n\n喵。\n', },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught instanceof MdxParseError,).toBe(true,);
      },
    },),
  ],
},);

await describe({
  name: buildDocumentNodes.name,
  children: [
    it({
      name: 'throws UnpositionedNodeError on constructed trees without positions',
      fn: async () => {
        /** Value caught from node construction over an unpositioned tree. */
        let caught: unknown;
        try {
          buildDocumentNodes({
            children: [{ type: 'paragraph', children: [], },],
            bodyText: '喵。',
            bodyOffset: 0,
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught instanceof UnpositionedNodeError,).toBe(true,);
      },
    },),
  ],
},);
