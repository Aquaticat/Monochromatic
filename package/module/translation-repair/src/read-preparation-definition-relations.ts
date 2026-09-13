import { type Logger, tagged, } from '@monochromatic-dev/module-logger/ts';
import type { PreparationDefinitionEvidence, PreparationDefinitionRegistration, } from './preparation-definition-model.ts';
import { projectPreparationDefinitionRelations, } from './project-preparation-definition-relations.ts';
import { readPreparationOccurrence, } from './read-preparation-occurrence.ts';

//region Public receipt-bound definition reader

/**
 * Reconstructs an independently registered occurrence before projecting its definition-only evidence.
 * Caller node tables, aggregates and parent indexes inside receipt data are never adopted.
 * The owning journal still establishes file provenance, registration authority and allowed target transitions.
 * This operation buys no calls and grants no body placement or final writer admission.
 *
 * @param registration - independent occurrence binding and complete current definition domain
 * @param receipt - unknown terminal current-attempt question data
 * @param sourceText - complete source bound by the registration
 * @param targetText - complete current target after the registered deterministic transition
 * @param l - caller logger retaining dependency scope
 * @returns Owned definition-only evidence retaining the exact occurrence that was checked
 * @throws PreparationReceiptError when current documents, parent or terminal receipt differ
 * @throws PreparationQualificationError when definition domain or usable quorum cannot qualify
 * @throws PairingEvidenceError when configured or asked identities are not independent
 * @example
 * ```ts
 * const definitions = readPreparationDefinitionRelations({ registration, receipt, sourceText, targetText, l });
 * ```
 */
export function readPreparationDefinitionRelations({ registration, receipt, sourceText, targetText, l, }: {
  readonly registration: PreparationDefinitionRegistration;
  readonly receipt: unknown;
  readonly sourceText: string;
  readonly targetText: string;
  readonly l: Logger;
},): PreparationDefinitionEvidence {
  /** Snapshot registration before reading any caller-controlled receipt properties. */
  const fixed = structuredClone(registration,);
  /** Public ownership boundary is distinct from internal relation projection. */
  const pl = tagged({ tag: readPreparationDefinitionRelations.name, l, },);
  pl.debug('reconstructing registered receipt occurrence before definition-only projection',);
  /** Full documents and raw receipt produce owned current nodes, interpretation and native outcomes. */
  const occurrence = readPreparationOccurrence({ expected: fixed.occurrence, receipt, sourceText, targetText, l: pl, },);
  return projectPreparationDefinitionRelations({ occurrence, domain: fixed.domain, l: pl, },);
}

//endregion Public receipt-bound definition reader
