/**
 Retain original Markdown or native JSON intervals before creating candidate handles. @module
 */
import { createHash } from 'node:crypto';
import { indexPolicyDocument } from '../../policy-index.ts';
import type { PolicyHeading } from '../../policy-index-types.ts';
import { GoverningRuleBindingError } from './binding-error.ts';
import type { GoverningBindingIndex, GoverningBindingInput, GoverningSource } from './binding-types.ts';

/**
 One source cannot exceed the original question binding profile.
 */
const MAX_SOURCE_CLAUSES = 512;

/**
 Source admission preserves the original owner record without interpreting occurrence metadata.

 @param source - original source reader result

 @throws GoverningRuleBindingError for unavailable mutable or nontext source records

 @example assertGoverningSource(source);
 */
export function assertGoverningSource(source: GoverningSource): void {
  if ((source === null) || (source === undefined) || (!Object.isFrozen(source))
    || ((typeof source.content) !== 'string')
    || ((typeof source.sha256) !== 'string')) throw new GoverningRuleBindingError('Governing-source reader returned no owned immutable text occurrence');
}

/**
 Index the original representation without treating native message JSON as Markdown policy.

 @param source - admitted original immutable text occurrence

 @param parse - qualified incumbent Markdown parser

 @returns original structural intervals and coverage state

 @throws GoverningRuleBindingError when indexed bytes differ from the selected occurrence

 @example readGoverningBindingIndex({ source, parse });
 */
export function readGoverningBindingIndex({ source, parse }: Readonly<{
  source: GoverningSource;
  parse: GoverningBindingInput['parse'];
}>): GoverningBindingIndex {
  /**
   Native handler content stays intact as one unclassified JSON span.
   */
  const index: GoverningBindingIndex = (source.kind === 'native-run-handler-message-input') && (source.contentFormat === 'native-content-json')
    ? {
      sourceSha256: createHash('sha256').update(source.content).digest('hex'),
      records: [],
      unclassified: [{ start: 0, end: source.content.length, text: source.content, type: 'native-content-json' }],
      structuralCoverage: 'unclassified-nodes-retained',
    }
    : indexPolicyDocument({ source: source.content, parse });
  if (index.sourceSha256 !== source.sha256) throw new GoverningRuleBindingError('Indexed policy bytes differ from the original selected source');
  return index;
}

/**
 Preserve heading identity when deciding which headings are context versus retained standalone spans.

 @param index - original structural source index

 @returns original headings referenced by retained source intervals

 @throws GoverningRuleBindingError when clauses and orphan headings exceed the declared profile

 @example referencedGoverningHeadings(index);
 */
export function referencedGoverningHeadings(index: GoverningBindingIndex): ReadonlySet<PolicyHeading> {
  /**
   Exact heading objects, rather than equal text, establish contextual membership.
   */
  const referenced = new Set<PolicyHeading>();
  for (const record of [...index.records, ...index.unclassified]) {
    for (const heading of record.headings ?? []) referenced.add(heading);
  }
  /**
   Unreferenced headings consume individual candidate slots.
   */
  const orphanHeadings = (index.headings ?? []).filter(function isUnreferencedHeading(heading) { return !referenced.has(heading); });
  if ((index.records.length + index.unclassified.length + orphanHeadings.length) > MAX_SOURCE_CLAUSES) throw new GoverningRuleBindingError('Policy clause count exceeds the original question binding profile');
  return referenced;
}
