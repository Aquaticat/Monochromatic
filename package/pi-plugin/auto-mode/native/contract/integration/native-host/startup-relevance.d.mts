import type {RelevanceCacheInput} from '../../lifecycle/rule-relevance-cache/cache-types.ts';

/** Bind the existing cache to the native host's parser and project identity. */
export function createStartupRelevance(input:Readonly<{
  root:string;
  parse:RelevanceCacheInput['parse'];
}>):Omit<RelevanceCacheInput,'selection'>;
