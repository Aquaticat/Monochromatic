// PROTOTYPE ONLY: Candidate H evidence-family identity.

import type { RosterModelId, } from './roster-id.ts';

/** Model lineage used only to avoid claiming same-family independence. */
export type BoundedModelFamily =
  | 'deepseek'
  | 'gemma'
  | 'glm'
  | 'kimi'
  | 'minimax'
  | 'openai'
  | 'qwen';

/** Maps frozen roster identity to conservative model family. */
export function boundedModelFamily({ modelId, }: {
  readonly modelId: RosterModelId;
}): BoundedModelFamily {
  if (modelId.startsWith('deepseek-',))
    return 'deepseek';
  if (modelId.startsWith('gemma-',))
    return 'gemma';
  if (modelId.includes('/GLM-',))
    return 'glm';
  if (modelId.includes('/Kimi-',))
    return 'kimi';
  if (modelId.startsWith('minimax-',))
    return 'minimax';
  if (modelId.includes('/gpt-oss-',))
    return 'openai';
  if (modelId.includes('/Qwen',))
    return 'qwen';
  throw new Error(`bounded verdict model family is unknown: ${modelId}`);
}
