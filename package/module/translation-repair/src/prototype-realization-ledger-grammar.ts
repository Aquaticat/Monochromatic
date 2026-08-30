// PROTOTYPE ONLY: Candidate G obligation grammar validation.

import { hashContent, } from './document-node.ts';
import {
  MAX_REALIZATION_RELATION_ENDPOINTS,
  MAX_REALIZATION_SOURCE_SPAN_LENGTH,
  type RealizationObligation,
  type RealizationSourceSlot,
  type RealizationSourceSpan,
} from './prototype-realization-model.ts';

//region Ledger grammar

/**
 * Selects normalized text namespace addressed by one source span.
 */
function spanText({
  namespace,
  sourceBody,
  archiveBody,
}: {
  readonly namespace: RealizationSourceSpan['namespace'];
  readonly sourceBody: string;
  readonly archiveBody: string;
}): string {
  if (namespace === 'source-body')
    return sourceBody;
  if (namespace === 'archive-body')
    return archiveBody;
  throw new Error('realization source span namespace is unknown');
}

/**
 * Checks semi-meaningful kind-prefixed three-digit manifest identity.
 */
function obligationIdMatchesKind({ obligation, }: { readonly obligation: RealizationObligation; }): boolean {
  const prefix = `${obligation.kind}-`;
  if (!obligation.id
    .startsWith(prefix,))
    return false;
  const suffix = obligation.id
    .slice(prefix.length,);
  return (suffix.length === 3) && [...suffix,].every(function digit(character,) {
    return (character >= '0') && (character <= '9');
  },);
}

/**
 * Finds unique manifest source slot containing source-body span.
 */
export function sourceSlotForSpan({
  span,
  sourceSlots,
}: {
  readonly span: RealizationSourceSpan;
  readonly sourceSlots: ReadonlyMap<string, RealizationSourceSlot>;
}): RealizationSourceSlot | undefined {
  if (span.namespace !== 'source-body')
    return undefined;
  const matches = [...sourceSlots.values(),].filter(function contains(slot,) {
    return (span.startOffset >= slot.startOffset) && (span.endOffset <= slot.endOffset);
  },);
  return matches.length === 1 ? matches[0] : undefined;
}

/**
 * Enforces kind, authority, cardinality, target-slot, and endpoint grammar.
 */
export function assertObligationGrammar({
  obligation,
  obligations,
  sourceSlots,
}: {
  readonly obligation: RealizationObligation;
  readonly obligations: ReadonlyMap<string, RealizationObligation>;
  readonly sourceSlots: ReadonlyMap<string, RealizationSourceSlot>;
}): void {
  const knownKinds: readonly RealizationObligation['kind'][] = [
    'clause',
    'relation',
    'identity',
    'link',
    'media',
    'format',
    'archive-authority',
  ];
  const knownAuthorities: readonly RealizationObligation['authority'][] = [
    'source',
    'archive-allowed',
    'shell-locked',
  ];
  const knownCardinalities: readonly RealizationObligation['targetCardinality'][] = [
    'one-or-more',
    'shell-owned',
  ];
  if ((!knownKinds.includes(obligation.kind,))
    || (!knownAuthorities.includes(obligation.authority,))
    || (!knownCardinalities.includes(obligation.targetCardinality,)))
    throw new Error('realization obligation vocabulary is unknown');
  if (!obligationIdMatchesKind({ obligation, }))
    throw new Error('realization obligation id differs from kind namespace');
  if ((obligation.allowedTargetSlotKeys
    .length
    === 0)
    || (obligation.allowedTargetSlotKeys
      .length
      > MAX_REALIZATION_RELATION_ENDPOINTS)
    || (new Set(obligation.allowedTargetSlotKeys,).size
      !== obligation.allowedTargetSlotKeys
      .length)
    || obligation.allowedTargetSlotKeys
    .some(function unknown(key,) { return !sourceSlots.has(key,); }))
    throw new Error('realization allowed target slots differ from source shell');
  const shellOwned = obligation.targetCardinality === 'shell-owned';
  if (shellOwned !== (obligation.authority === 'shell-locked'))
    throw new Error('realization shell ownership and authority differ');
  if ((obligation.authority === 'source')
    && obligation.sourceSpans
    .some(function archive(span,) { return span.namespace !== 'source-body'; }))
    throw new Error('realization source authority cites non-source namespace');
  if ((obligation.authority === 'archive-allowed')
    && (obligation.sourceSpans
      .length
      === 0))
    throw new Error('realization archive authority has no evidence span');
  if ((!shellOwned) && (obligation.sourceSpans
    .length
    === 0))
    throw new Error('realization model-owned obligation has no evidence span');
  if (shellOwned && (!([
    'link',
    'media',
    'format',
  ] as const).includes(
    obligation.kind as 'link' | 'media' | 'format',
  )))
    throw new Error('realization shell-owned obligation kind differs');
  if ((obligation.kind === 'archive-authority')
    && ((obligation.authority !== 'archive-allowed')
      || (!obligation.sourceSpans
        .some(function archive(span,) { return span.namespace === 'archive-body'; }))))
    throw new Error('realization archive obligation authority differs');
  if (obligation.kind === 'relation') {
    const endpoints = obligation.relationEndpoints;
    if ((endpoints.length < 2)
      || (new Set(endpoints,).size !== endpoints.length)
      || endpoints.includes(obligation.id,)
      || endpoints.some(function nonClause(endpoint,) { return obligations.get(endpoint,)
        ?.kind
        !== 'clause'; }))
      throw new Error('realization relation endpoints differ from distinct clause obligations');
    if (obligation.targetCardinality !== 'one-or-more')
      throw new Error('realization relation needs explicit target anchor');
    const endpointSlots = [...new Set(endpoints.flatMap(function endpointSlots(endpoint,) {
      return obligations.get(endpoint,)
        ?.allowedTargetSlotKeys
        ?? [];
    },),),].toSorted();
    if (JSON.stringify(obligation.allowedTargetSlotKeys
      .toSorted(),) !== JSON.stringify(endpointSlots,))
      throw new Error('realization relation target slots differ from endpoints');
    return;
  }
  if (obligation.relationEndpoints
    .length
    > 0)
    throw new Error('realization non-relation carries relation endpoints');
  if (obligation.kind === 'clause') {
    if ((obligation.authority !== 'source')
      || (obligation.targetCardinality !== 'one-or-more')
      || (obligation.sourceSpans
        .length
        !== 1))
      throw new Error('realization clause authority or cardinality differs');
    const clauseSpan = obligation.sourceSpans[0];
    if (clauseSpan === undefined)
      throw new Error('realization clause source span is absent');
    const sourceSlot = sourceSlotForSpan({
      span: clauseSpan,
      sourceSlots,
    });
    if ((sourceSlot === undefined)
      || (obligation.allowedTargetSlotKeys
        .length
        !== 1)
      || (obligation.allowedTargetSlotKeys[0] !== sourceSlot.slotKey))
      throw new Error('realization clause target slot differs from source ownership');
  }
}

/**
 * Validates one source span against namespace text and fixed bounds.
 */
export function assertSourceSpan({
  span,
  sourceBody,
  archiveBody,
}: {
  readonly span: RealizationSourceSpan;
  readonly sourceBody: string;
  readonly archiveBody: string;
}): void {
  const text = spanText({
    namespace: span.namespace,
    sourceBody,
    archiveBody,
  });
  const length = span.endOffset - span.startOffset;
  if ((!Number.isInteger(span.startOffset,))
    || (!Number.isInteger(span.endOffset,))
    || (span.startOffset < 0)
    || (length <= 0)
    || (length > MAX_REALIZATION_SOURCE_SPAN_LENGTH)
    || (span.endOffset > text.length))
    throw new Error('realization source span is outside bounded half-open namespace');
  if (span.digest !== hashContent({ content: text.slice(
    span.startOffset,
    span.endOffset,
  ), }))
    throw new Error('realization source span digest differs');
}

//endregion Ledger grammar
