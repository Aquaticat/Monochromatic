//region Pairing barrel
// Everything that decides WHICH paragraph renders which, which is the input
// every later stage reasons from.
//
// Split out of `pipeline-barrel.ts` when the pairing stage pushed that file past
// its line budget. Grouping by question rather than by stage is what makes it a
// barrel rather than a spill: the sheet that asks, the reader that refuses, the
// round that gathers agreement, and the conversion into the vocabulary the
// grouper already reads all answer one question no other stage can.

export { blockPairingToSteps, } from './pair-blocks-steps.ts';
export {
  type BlockPairingOutcome,
  pairBlocksWithRoster,
} from './pair-blocks-stage.ts';
export {
  type BlockPair,
  BlockPairingError,
  type BlockPairingWire,
  buildBlockPairingMessages,
  isBlockPairingWire,
  type NumberedBlock,
  readBlockPairing,
} from './pair-blocks-wire.ts';

//endregion Pairing barrel
