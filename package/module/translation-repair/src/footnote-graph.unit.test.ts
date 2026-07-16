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

import { buildDocumentNodes, UnpositionedNodeError, } from './document-node.ts';
import { scanFullwidthMarkers, scanGfmReferenceLiterals, } from './footnote-graph.ts';
import { MdxParseError, parseMdxBody, } from './parse-mdx.ts';

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
