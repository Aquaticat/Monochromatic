/**
 Retain original system inputs across native transcript replay without another source inventory. @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import type { SourceContributionAssociation } from '../../../../src/source-contribution-types.ts';
import type { ToolAssociationSources } from './tool-source-association-types.ts';

/**
 Missing original inputs cannot be reconstructed from rendered system text.
 */
export type NativeSystemDerivation = {
  readonly associations: readonly SourceContributionAssociation[];
  readonly matches: () => boolean;
};

/**
 Missing input derivation cannot be inferred from equal serialized text.
 */
export const NO_ORIGINAL_SYSTEM_DERIVATION: unique symbol = Symbol('system replay lacks original captured inputs');

/**
 Diagnostics exclude borrowed system content.
 */
const l = tagged({ tag: 'auto-mode-native-system-source-derivation' });

//region Native replay input edges retain original source memberships

/**
 Retain every original system input supplied to the native transcript normalizer.
 This authenticates replay inputs only; the original serializer must bind the normalized output separately.
 
 @param sources - existing captured source and run memberships
 
 @param messages - original transcript passed to the native serializer
 
 @param dataRecord - incumbent ordinary-record profile
 
 @param denseArray - incumbent dense-array profile
 
 @param readSystemPublication - original manager's current system publication reader
 
 @returns input derivation and its integrity check, or missing-original-input sentinel
 
 @example
 ```ts
 const derivation = captureNativeSystemDerivation(originalInputs);
 ```
 */
export function captureNativeSystemDerivation({
  sources,
  messages,
  dataRecord,
  denseArray,
  readSystemPublication
}: {
  readonly sources: ToolAssociationSources;
  readonly messages: unknown;
  readonly dataRecord: (value: unknown) => value is Readonly<Record<string, unknown>>;
  readonly denseArray: (value: unknown) => value is readonly unknown[];
  readonly readSystemPublication: (value: unknown) => unknown;
}): NativeSystemDerivation | typeof NO_ORIGINAL_SYSTEM_DERIVATION {
  /**
   Replay capture diagnostics have their own boundary.
   */
  const fl = tagged({
    tag: captureNativeSystemDerivation.name,
    l
  });
  fl.debug('capturing native system replay input memberships');
  /**
   The captured run owns these sources independently of their emitted transport role.
   */
  const run = sources.nativeRunComposition;
  if ((run === undefined) || (!denseArray(messages))) return NO_ORIGINAL_SYSTEM_DERIVATION;
  /**
   This explicit narrowed reference is the actual original transcript, not a copied inventory.
   */
  const transcript: readonly unknown[] = messages;
  /**
   Each edge refers to an existing native input and source publication.
   */
  const edges: {
    readonly message: object;
    readonly ordinal: number;
    readonly association: SourceContributionAssociation
  }[] = [];
  for (const [ordinal, message] of transcript.entries()) {
    if (!dataRecord(message)) return NO_ORIGINAL_SYSTEM_DERIVATION;
    if (message.role !== 'system') continue;
    /**
     Only the original input owner can authenticate this current message.
     */
    const publication = readSystemPublication(message);
    if (publication === undefined) return NO_ORIGINAL_SYSTEM_DERIVATION;
    /**
     Membership is checked against the captured run, never a later live composition.
     */
    const retained = run.retainedMessageOrigins
      ?.find(function originalSystemInput(origin) {
      return origin.publication === publication;
    });
    /**
     The existing source budget already owns the complete selected system data.
     */
    const source = retained?.source;
    if ((source === undefined) || (retained?.publication === undefined)
      || (!sources.governingSources
        .includes(source))) return NO_ORIGINAL_SYSTEM_DERIVATION;
    edges.push(Object.freeze({
      message,
      ordinal,
      association: Object.freeze({
        source,
        sourceOccurrence: source.occurrence,
        run,
        systemInputPublication: retained.publication,
        retainedMessageOrigin: retained
      })
    }));
  }
  if (edges.length === 0) return NO_ORIGINAL_SYSTEM_DERIVATION;
  /**
   Reject removed, inserted, replaced or changed system inputs before retaining the actual native output.
   
   @returns whether every original system input remains the same captured publication
   */
  function matches(): boolean {
    /**
     Currentness checks never log borrowed source values.
     */
    const ml = tagged({
      tag: matches.name,
      l: fl
    });
    ml.debug('checking original system replay input integrity');
    if ((!denseArray(transcript)) || (!transcript.every(dataRecord))) return false;
    if (transcript.filter(function systemMessage(message) {
      return message.role === 'system';
    })
      .length
      !== edges.length)
      return false;
    return edges.every(function originalEdge(edge) {
      return (transcript[edge.ordinal] === edge.message)
        && (readSystemPublication(edge.message)
          === edge.association
          .systemInputPublication);
    });
  }
  return Object.freeze({
    associations: Object.freeze(edges.map(function originalAssociation(edge) {
    return edge.association;
  })),
    matches
  });
}

//endregion Native replay input edges retain original source memberships
