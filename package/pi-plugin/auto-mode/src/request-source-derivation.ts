/** Consume native complete-field evidence without inferring instruction authority or meaning. @module */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { PolicyInputBindingError } from './policy-input-binding-error.ts';
import type { RequestGoverningUse } from './request-source-derivation-types.ts';
import type { SourceContributionUse } from './source-contribution-result.ts';
import type { ContributionRequestObservation, SourceContribution } from './source-contribution-types.ts';

/** Diagnostics retain field and membership failures without exposing request contents. */
const l = tagged({ tag: 'auto-mode-request-source-derivation' });

//region Native field completeness and original source membership are independent checks

/**
 Consume a native field derivation only after every referenced contribution was accounted for.
 Native integration authenticates these original owners; this consumer does not authenticate fabricated records.
 @param observation - original native request receipt
 @param contributions - exact original contribution list supplied to policy compilation
 @param uses - freshly consumed original source memberships
 @returns represented governing use or an independent unresolved request-use result
 @throws PolicyInputBindingError when field evidence belongs to another request or contribution list
 @example
 ```ts
 const governingUse = inspectRequestSourceDerivation({ observation, contributions, uses });
 ```
 */
export function inspectRequestSourceDerivation({ observation, contributions, uses }: {
  readonly observation: ContributionRequestObservation;
  readonly contributions: readonly SourceContribution[];
  readonly uses: readonly SourceContributionUse[];
}): RequestGoverningUse {
  /** Whole-field derivation is diagnosed separately from partial contribution membership. */
  const fl = tagged({ tag: inspectRequestSourceDerivation.name, l });
  fl.debug('consuming original native request field derivation');
  /**
   Preserve an unresolved use without assigning uniform request authority.
   @param reason - exact missing native coverage or source membership
   @returns owned unresolved use for this original request
   */
  function unresolved(reason: string): RequestGoverningUse {
    /** Failure diagnostics remain scoped to the native request-use consumer. */
    const ul = tagged({ tag: unresolved.name, l: fl });
    ul.debug(reason);
    return Object.freeze({ request: observation.request, state: 'unresolved', permission: false, reason });
  }
  /** The native owner issues field evidence only at its original JSON validation boundary. */
  const derivation = observation.sourceDerivation;
  if (derivation === undefined) return unresolved(observation.sourceDerivationFailure
    ?? 'The original request has no complete native field derivation');
  if ((derivation.request !== observation.request) || (derivation.contributions !== contributions)
    || (observation.sourceContributions !== contributions))
    throw new PolicyInputBindingError('Request field derivation belongs to another original request or contribution list');
  if ((derivation.profile !== 'native-text-messages-and-tool-declarations')
    || (!Number.isSafeInteger(derivation.messageCount)) || (derivation.messageCount <= 0)
    || (!Number.isSafeInteger(derivation.toolCount)) || (derivation.toolCount < 0)
    || (derivation.fields.length !== derivation.messageCount + derivation.toolCount))
    return unresolved('Original native field derivation does not cover its complete supported message and tool cardinalities');
  /** Existing contribution occurrence identities provide the only source lookup. */
  const originals = new Map(contributions.map(function originalContribution(value) {
    return [value.contribution, value] as const;
  }));
  /** These results were just derived from exact original source and run memberships. */
  const accounted = new Map(uses.map(function consumedContribution(value) {
    return [value.contribution, value] as const;
  }));
  if ((originals.size !== contributions.length) || (accounted.size !== contributions.length)
    || uses.some(function unresolvedContribution(use) {
      return (use.state !== 'accounted') || (use.request !== observation.request);
    })) return unresolved('Original request contributions are missing, duplicated or unresolved');
  /** Unique positions prevent a repeated field from standing in for an omitted message or tool. */
  const positions = new Set<string>();
  for (const field of derivation.fields) {
    if ((!['messages', 'tools'].includes(field.field)) || (!Number.isSafeInteger(field.ordinal))
      || (field.ordinal < 0) || (field.ordinal >= (field.field === 'messages' ? derivation.messageCount : derivation.toolCount))
      || (field.contributions.length === 0)) return unresolved('Original request contains an unsupported or unaccounted field position');
    /** This key names a protocol position, never a source identity. */
    const position = `${field.field}:${String(field.ordinal)}`;
    if (positions.has(position)) return unresolved('Original request field derivation repeats a serialized position');
    positions.add(position);
    for (const occurrence of field.contributions) {
      /** Original field and source links must both reach the same consumed occurrence. */
      const original = originals.get(occurrence);
      /** An accounted use from another request cannot substitute for the original contribution. */
      const use = accounted.get(occurrence);
      if ((original === undefined) || (use === undefined) || (original.request !== observation.request)
        || (original.association === undefined) || (use.sourceOccurrence !== original.association.sourceOccurrence))
        return unresolved('Original request field has no matching consumed source occurrence');
      /** Location values remain opaque until the native field proof requires their exact coordinates. */
      const locationField: unknown = Reflect.get(original.location, 'field');
      /** Original ordinals are never inferred from matching content. */
      const locationOrdinal: unknown = Reflect.get(original.location, 'ordinal');
      if ((locationField !== field.field) || (locationOrdinal !== field.ordinal))
        return unresolved('Original request field points to a contribution at another serialized position');
    }
  }
  fl.debug('complete native request content is represented by its original captured inputs');
  return Object.freeze({ request: observation.request, state: 'represented-by-original-inputs', permission: false });
}

//endregion Native field completeness and original source membership are independent checks
