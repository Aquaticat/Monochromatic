import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import {
  preparationRootParent,
  preparationRootPopulationParent,
  preparationRootProtection,
  sealedNodeIds,
  type ArchiveOriginalSpan,
  type ChunkPair,
  type PreparationRootProtection,
} from '../dist/final/node/index.mjs';

type GeometryCase = {
  readonly name: string;
  readonly emptyTarget: boolean;
  readonly spans: readonly ArchiveOriginalSpan[];
  readonly expected: PreparationRootProtection;
};

// Native outputs captured before moving geometry out of the existing production parent constructor.
// geometry-baseline-weNIba retains the deciding source bytes and consumed built entry identity.
const source: ChunkPair['source'] = {"sliceIndex":2,"nodes":[{"id":"block/0","kind":"paragraph","zone":"body","text":"Cat","startOffset":0,"endOffset":3,"contentHash":"48735c4fae42d1501164976afec76730b9e5fe467f680bdd8daff4bb77674045"},{"id":"block/1","kind":"paragraph","zone":"body","text":"Dog","startOffset":5,"endOffset":8,"contentHash":"0eb129bf94594aaeee66e38361d7be212cd927c3df4dd92e3ded2e0da0c7ad88"}],"startOffset":0,"endOffset":8,"text":"Cat\n\nDog"};
const target: ChunkPair['target'] = {"sliceIndex":4,"nodes":[{"id":"block/10","kind":"paragraph","zone":"body","text":"Cat","startOffset":100,"endOffset":103,"contentHash":"48735c4fae42d1501164976afec76730b9e5fe467f680bdd8daff4bb77674045"},{"id":"block/11","kind":"paragraph","zone":"body","text":"Dog","startOffset":105,"endOffset":108,"contentHash":"0eb129bf94594aaeee66e38361d7be212cd927c3df4dd92e3ded2e0da0c7ad88"},{"id":"block/12","kind":"paragraph","zone":"body","text":"Owl","startOffset":110,"endOffset":113,"contentHash":"72992b75e60c8806d6e7271012d4bb2b66e878a13ee2ab373e972b4306357699"}],"startOffset":100,"endOffset":113,"text":"Cat\n\nDog\n\nOwl"};
const cases: readonly GeometryCase[] = [
  {"name":"none","emptyTarget":false,"spans":[],"expected":{"intersections":[],"sealedTargetNodeIds":[],"straddlingNodeIds":[],"allTargetNodesSealed":false}},
  {"name":"all-sealed","emptyTarget":false,"spans":[{"startOffset":99,"endOffset":114,"note":"Whole cat declaration"}],"expected":{"intersections":[{"startOffset":99,"endOffset":114,"noteHash":"4b8464c9da3ac894fd67e729b05e7aacad8ffef5a53db3a2e00a48dd2bd8ea31"}],"sealedTargetNodeIds":["block/10","block/11","block/12"],"straddlingNodeIds":[],"allTargetNodesSealed":true}},
  {"name":"one-sealed","emptyTarget":false,"spans":[{"startOffset":105,"endOffset":108,"note":"Dog declaration"}],"expected":{"intersections":[{"startOffset":105,"endOffset":108,"noteHash":"16de5ad4a7b494c4a8307566fe4e8f995e661bff279b80f341ddd3f055d13f23"}],"sealedTargetNodeIds":["block/11"],"straddlingNodeIds":[],"allTargetNodesSealed":false}},
  {"name":"straddling-start","emptyTarget":false,"spans":[{"startOffset":101,"endOffset":104,"note":"Cat edge declaration"}],"expected":{"intersections":[{"startOffset":101,"endOffset":104,"noteHash":"01b5acd38e7cea99a84eadbdea7698be120513684b6ad92f8bf3706db2e7d19e"}],"sealedTargetNodeIds":[],"straddlingNodeIds":["block/10"],"allTargetNodesSealed":false}},
  {"name":"straddling-end","emptyTarget":false,"spans":[{"startOffset":109,"endOffset":112,"note":"Owl edge declaration"}],"expected":{"intersections":[{"startOffset":109,"endOffset":112,"noteHash":"3c434f0da1c8a512266a04d0db72646b5100855ca574b729b768cedc41e3c020"}],"sealedTargetNodeIds":[],"straddlingNodeIds":["block/12"],"allTargetNodesSealed":false}},
  {"name":"mixed-roles","emptyTarget":false,"spans":[{"startOffset":99,"endOffset":106,"note":"First cat declaration"},{"startOffset":110,"endOffset":114,"note":"Last owl declaration"}],"expected":{"intersections":[{"startOffset":99,"endOffset":106,"noteHash":"644dd86ceb1dd452ee09dd509768568f393b53db3f3c1781d62f5f16fced088a"},{"startOffset":110,"endOffset":114,"noteHash":"71289965515bfd49a28c99143ffb24144cf011a07e0d3834655f5a1a146b81a5"}],"sealedTargetNodeIds":["block/10","block/12"],"straddlingNodeIds":["block/11"],"allTargetNodesSealed":false}},
  {"name":"touch-start","emptyTarget":false,"spans":[{"startOffset":99,"endOffset":100,"note":"Before target"}],"expected":{"intersections":[],"sealedTargetNodeIds":[],"straddlingNodeIds":[],"allTargetNodesSealed":false}},
  {"name":"touch-end","emptyTarget":false,"spans":[{"startOffset":113,"endOffset":114,"note":"After target"}],"expected":{"intersections":[],"sealedTargetNodeIds":[],"straddlingNodeIds":[],"allTargetNodesSealed":false}},
  {"name":"zero-width-end","emptyTarget":false,"spans":[{"startOffset":113,"endOffset":113,"note":"End declaration"}],"expected":{"intersections":[],"sealedTargetNodeIds":[],"straddlingNodeIds":[],"allTargetNodesSealed":false}},
  {"name":"sealed-precedence","emptyTarget":false,"spans":[{"startOffset":99,"endOffset":114,"note":"Whole declaration"},{"startOffset":101,"endOffset":104,"note":"Partial overlapping declaration"}],"expected":{"intersections":[{"startOffset":99,"endOffset":114,"noteHash":"6d836deca65fd99807c63ad75e9d56cdce722ac4efdf00233d01f497c28a7d90"},{"startOffset":101,"endOffset":104,"noteHash":"d0cb5ac0894cf82d21055f94baf124a165f3eb176c83bf81227f94c876f185fa"}],"sealedTargetNodeIds":["block/10","block/11","block/12"],"straddlingNodeIds":[],"allTargetNodesSealed":true}},
  {"name":"empty-target","emptyTarget":true,"spans":[],"expected":{"intersections":[],"sealedTargetNodeIds":[],"straddlingNodeIds":[],"allTargetNodesSealed":false}},
  {"name":"empty-anchor-overlap","emptyTarget":true,"spans":[{"startOffset":99,"endOffset":101,"note":"Anchor declaration"}],"expected":{"intersections":[{"startOffset":99,"endOffset":101,"noteHash":"ae93b5cefe6c2ca7ccd3cd0027cf1370d6f984a870895d4d5844d833d207086c"}],"sealedTargetNodeIds":[],"straddlingNodeIds":[],"allTargetNodesSealed":false}},
];

await describe({ name: '', children: [
  describe({ name: preparationRootProtection.name, children: cases.map(({ name, emptyTarget, spans, expected }) => it({
    name: `preserves native ${name} geometry`,
    fn: async () => {
      const currentTarget = emptyTarget ? { ...target, nodes: [], startOffset: 100, endOffset: 100, text: '' } : target;
      const protection = preparationRootProtection({ target: currentTarget, spans });
      expect(protection).toEqual(expected);
      expect([...sealedNodeIds({ nodes: currentTarget.nodes, spans })]).toEqual(expected.sealedTargetNodeIds);
      const parent = preparationRootParent({ entryId: 'Cat', pairIndex: 1, pair: { source, target: currentTarget }, spans });
      expect(parent.originalProtection).toEqual(expected);
      const population = preparationRootPopulationParent(parent);
      expect(population.originalProtection).toEqual(expected);
    },
  })) }),
] });
