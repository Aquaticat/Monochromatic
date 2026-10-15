/** Account for every serialized prose field using the incumbent original contribution records. @module */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import type { RequestDerivationField, RequestDerivationFields } from '../../../../src/request-source-derivation-types.ts';
import type { SourceContributionAssociation } from '../../../../src/source-contribution-types.ts';
import { assertRequestDerivationEnvelope } from './request-derivation-envelope.ts';
import { NativeRequestDerivationError } from './request-derivation-error.ts';
import type { NativeSystemDerivation } from './system-source-derivation.ts';

/** Original contribution occurrences have not yet received their request binding. */
type NativeRequestContribution = {
  readonly contribution: object;
  readonly location: { readonly field: string; readonly ordinal?: number; readonly property?: string };
  readonly association?: SourceContributionAssociation;
  readonly systemDerivation?: NativeSystemDerivation;
};

/** Native sealing diagnostics never include request text or source contents. */
const l = tagged({ tag: 'auto-mode-native-request-source-derivation' });

//region Complete field accounting is separate from source meaning and authority

/**
 Derive every supported serialized message and tool from its original native contribution owners.
 The observer supplies its one parsed JSON value; no request is re-encoded or parsed again.
 @param parsed - original request observer's parsed value
 @param modelId - original selected model identifier
 @param messageCount - native payload message count before callbacks
 @param toolCount - native payload tool count before callbacks
 @param contributions - original sealed source contributions
 @param dataRecord - incumbent ordinary-record profile
 @param denseArray - incumbent dense-array profile
 @returns complete field derivation for this supported native protocol profile
 @throws NativeRequestDerivationError when any serialized field lacks a complete original derivation
 @example
 ```ts
 const fields = deriveNativeRequestSources(originalSerialization);
 ```
 */
export function deriveNativeRequestSources({ parsed, modelId, messageCount, toolCount, contributions,
  dataRecord, denseArray }: {
  readonly parsed: Readonly<Record<string, unknown>>;
  readonly modelId: string;
  readonly messageCount: number;
  readonly toolCount: number;
  readonly contributions: readonly NativeRequestContribution[];
  readonly dataRecord: (value: unknown) => value is Readonly<Record<string, unknown>>;
  readonly denseArray: (value: unknown) => value is readonly unknown[];
}): RequestDerivationFields {
  /** Derivation has its own diagnostic boundary within native sealing. */
  const fl = tagged({ tag: deriveNativeRequestSources.name, l });
  fl.debug('deriving original request fields from existing source contributions');
  assertRequestDerivationEnvelope({ parsed, modelId, messageCount, toolCount });
  if (!denseArray(parsed.messages)) throw new NativeRequestDerivationError('Request messages lack the supported native array shape');
  /** This local index refers to existing contribution records; it owns no message or tool content. */
  const byLocation = new Map<string, NativeRequestContribution[]>();
  for (const contribution of contributions) {
    /** Original ordinal and field select the containing serialized field. */
    const key = `${contribution.location.field}:${String(contribution.location.ordinal)}`;
    /** Each location may contain several partial inputs from one native system derivation. */
    const existing = byLocation.get(key);
    if (existing === undefined) byLocation.set(key, [contribution]);
    else existing.push(contribution);
  }
  /** Only these newly owned field records are frozen. */
  const fields: RequestDerivationField[] = [];
  for (const [ordinal, message] of parsed.messages.entries()) {
    if ((!dataRecord(message)) || (Object.keys(message).length !== 2)
      || (!Object.hasOwn(message, 'role')) || (!Object.hasOwn(message, 'content')))
      throw new NativeRequestDerivationError(`Serialized message ${String(ordinal)} has unaccounted fields`);
    /** Original sealed contributions are already bound to this serialized position and content. */
    const candidates = byLocation.get(`messages:${String(ordinal)}`) ?? [];
    /** Complete message derivation records reference existing contribution occurrences only. */
    const selected: object[] = [];
    if (['system', 'developer'].includes(String(message.role)) && ((typeof message.content) === 'string')) {
      /** System replay must cover every original system input, including section names and generated wrappers. */
      const derivation = candidates.find(function originalSystem(candidate) {
        return candidate.systemDerivation !== undefined;
      })?.systemDerivation;
      if ((derivation === undefined) || (derivation.associations.length === 0))
        throw new NativeRequestDerivationError(`Serialized system message ${String(ordinal)} lacks its complete original input derivation`);
      for (const association of derivation.associations) {
        /** Full replay input edges must reach the same source association consumer as partial contributions. */
        const original = candidates.find(function originalInput(candidate) {
          return (candidate.systemDerivation === derivation) && (candidate.association === association)
            && (association.systemInputPublication !== undefined) && (candidate.location.property === 'content');
        });
        if (original === undefined) throw new NativeRequestDerivationError('Original system derivation input is missing its sealed contribution');
        selected.push(original.contribution);
      }
    } else if ((message.role === 'user') && denseArray(message.content)
      && message.content.every(function textPart(part) {
        return dataRecord(part) && (Object.keys(part).length === 2) && (part.type === 'text') && ((typeof part.text) === 'string');
      })) {
      /** Original handler or expanded-prompt publications own the entire emitted text-part sequence. */
      const original = candidates.find(function originalText(candidate) {
        return (candidate.location.property === 'content') && ((candidate.association?.handlerPublication !== undefined)
          || (candidate.association?.expandedPromptPublication !== undefined));
      });
      if (original === undefined) throw new NativeRequestDerivationError(`Serialized user message ${String(ordinal)} lacks its original full text publication`);
      selected.push(original.contribution);
    } else throw new NativeRequestDerivationError(`Serialized message ${String(ordinal)} has no supported complete native derivation`);
    fields.push(Object.freeze({ field: 'messages', ordinal, contributions: Object.freeze(selected) }));
  }
  for (let ordinal = 0; ordinal < toolCount; ordinal += 1) {
    /** Original tool emissions already compare every serialized declaration field with their owned producer value. */
    const candidates = byLocation.get(`tools:${String(ordinal)}`);
    /** Exactly one original converted declaration owns each serialized tool position. */
    const original = candidates?.[0];
    if ((candidates?.length !== 1) || (original?.association?.toolPublication === undefined))
      throw new NativeRequestDerivationError(`Serialized tool ${String(ordinal)} lacks its original complete declaration emission`);
    fields.push(Object.freeze({ field: 'tools', ordinal, contributions: Object.freeze([original.contribution]) }));
  }
  fl.debug('every supported request prose field retains its original input derivation');
  return Object.freeze({ profile: 'native-text-messages-and-tool-declarations', messageCount, toolCount,
    fields: Object.freeze(fields) });
}

//endregion Complete field accounting is separate from source meaning and authority
