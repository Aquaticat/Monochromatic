import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';
import type { JsonSchemaResponseFormat, } from './chat-contract.ts';
import {
  buildBlockPairingMessages,
  type NumberedBlock,
} from './pair-blocks-wire.ts';

//region Block-pairing protocol
// Preparation acquisition and receipt planning share actual messages and schema, not parallel reconstructions.

/**
 * Existing structured response contract, unchanged by moving its construction.
 * Each handoff receives its own copy so recording code cannot mutate future questions.
 */
const PAIRING_RESPONSE_FORMAT: JsonSchemaResponseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'block_pairing',
    schema: {
      type: 'object',
      properties: {
        pairs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              source: { type: 'integer', },
              target: { type: 'integer', },
            },
            required: [
              'source',
              'target',
            ],
          },
        },
      },
      required: ['pairs',],
    },
  },
};

/**
 * Model-neutral payload supplied by the actual block-pairing stage.
 * Provider bodies, completion caps, rosters and attempt provenance remain separate receipt bindings.
 *
 * @example
 * ```ts
 * const protocol = blockPairingProtocol({ sourceBlocks, targetBlocks, });
 * ```
 */
export type BlockPairingProtocol = {
  /**
   * Exact ordered messages, including the existing content-sensitive listing fence.
   */
  readonly messages: readonly ChatMessage[];
  /**
   * Existing schema name and shape, without adding strictness or changing response semantics.
   */
  readonly responseFormat: JsonSchemaResponseFormat;
};

/**
 * Constructs the model-neutral protocol shared by production acquisition and receipt planning.
 * Definition-order exemptions affect local interpretation, not this emitted message contract.
 *
 * @param sourceBlocks - current original blocks in their emitted numbering
 *
 * @param targetBlocks - current archive blocks in their emitted numbering
 *
 * @returns Actual messages and owned schema, without creating providers or purchasing evidence
 *
 * @example
 * ```ts
 * const { messages, responseFormat, } = blockPairingProtocol({ sourceBlocks, targetBlocks, });
 * ```
 */
export function blockPairingProtocol({
  sourceBlocks,
  targetBlocks,
}: {
  readonly sourceBlocks: readonly NumberedBlock[];
  readonly targetBlocks: readonly NumberedBlock[];
},): BlockPairingProtocol {
  return {
    messages: buildBlockPairingMessages({
      sourceBlocks,
      targetBlocks,
    },),
    responseFormat: structuredClone(PAIRING_RESPONSE_FORMAT,),
  };
}

//endregion Block-pairing protocol
