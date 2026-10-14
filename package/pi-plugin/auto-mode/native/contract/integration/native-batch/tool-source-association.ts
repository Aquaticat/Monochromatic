/**
 Keep serialized tools under original emitter custody through the existing request parse boundary. @module
 */
import { isDeepStrictEqual } from 'node:util';
import { tagged } from '@monochromatic-dev/module-logger/ts';
import type { SourceContributionAssociation } from '../../../../src/source-contribution-types.ts';
import type {
  NativeToolAssociation,
  ToolAssociationContribution,
  ToolAssociationDefinition,
  ToolAssociationEmission,
} from './tool-source-association-types.ts';

/**
 Diagnostics omit declaration text and borrowed source records.
 */
const l = tagged({ tag: 'auto-mode-native-tool-source-association' });

/**
 An absent original manager publication cannot be replaced with matching declaration values.
 */
const NO_CAPTURED_TOOL_ORIGIN: unique symbol = Symbol('native tool has no captured manager input publication');

/**
 A second sealing attempt cannot issue another contribution for the same native request.
 */
class NativeToolAssociationError extends Error {
  /**
   Preserve the public Error diagnostic contract across native sealing failures.
   */
  override name = 'NativeToolAssociationError';
}

//region Original tool membership and serialized integrity remain independent of instruction authority

/**
 Bind original tool emissions through existing captured source memberships.
 
 @param sources - captured source and run memberships
 
 @param dataRecord - incumbent ordinary-record profile
 
 @param denseArray - incumbent dense-array profile
 
 @param copyToolData - original bounded copier for callback integrity checks
 
 @param readToolPublication - original manager publication reader
 
 @param readToolEmission - original native serializer emission reader
 
 @returns capture, custody and sealing operations for one request
 
 @example
 ```ts
 const tools = prepareNativeToolAssociation(originalDefinition);
 ```
 */
export function prepareNativeToolAssociation({
  sources,
  dataRecord,
  denseArray,
  copyToolData,
  readToolPublication,
  readToolEmission,
}: ToolAssociationDefinition): NativeToolAssociation {
  /**
   One request owns its pending emission and custody observations.
   */
  const state: {
    emissions: readonly ToolAssociationEmission[];
    retained: readonly ToolAssociationEmission[];
    capturedArray?: readonly unknown[];
    consumed: boolean
  } = {
      emissions: [],
      retained: [],
      consumed: false
    };
  /**
   Construction diagnostics retain a distinct native request boundary.
   */
  const fl = tagged({
    tag: prepareNativeToolAssociation.name,
    l
  });

  /**
   Resolve only original publication membership, never equal tool names or metadata.
   
   @param tool - original declaration returned by the native producer reader
   
   @returns original source association when the captured run owns its publication
   */
  function originalToolOrigin(tool: unknown): SourceContributionAssociation | typeof NO_CAPTURED_TOOL_ORIGIN {
    /**
     Source membership diagnostics exclude the declaration value.
     */
    const ol = tagged({
      tag: originalToolOrigin.name,
      l: fl
    });
    /**
     Publication identity is read only from the original alias owner.
     */
    const publication = readToolPublication(tool);
    /**
     Current live runs cannot replace this request's captured composition.
     */
    const run = sources.nativeRunComposition;
    if ((publication === undefined) || (run === undefined)) return NO_CAPTURED_TOOL_ORIGIN;
    /**
     Retained source and publication references must be original members.
     */
    const retained = run.retainedMessageOrigins
      ?.find(function originalPublication(origin) {
      return origin.publication === publication;
    });
    /**
     Captured source membership is independently required.
     */
    const source = retained?.source;
    if ((source === undefined) || (retained?.publication === undefined)
      || (!sources.governingSources
        .includes(source))) return NO_CAPTURED_TOOL_ORIGIN;
    ol.debug('matched original tool publication to its captured manager input');
    return Object.freeze({
      source,
      sourceOccurrence: source.occurrence,
      run,
      toolPublication: retained.publication,
      retainedMessageOrigin: retained
    });
  }

  /**
   Capture original array and per-tool emissions before invoking payload callbacks.
   
   @param payload - original native serializer payload
   
   @param origin - original payload-to-transcript observation
   
   @param eligible - original serializer and supported envelope checks already established
   */
  function capture({
    payload,
    origin,
    eligible
  }: {
    readonly payload: unknown;
    readonly origin: unknown;
    readonly eligible: boolean
  }): void {
    /**
     Capture failures remain unresolved contribution observations.
     */
    const cl = tagged({
      tag: capture.name,
      l: fl
    });
    cl.debug('capturing original native tool emission associations');
    if ((!eligible) || (!dataRecord(payload))
      || (!denseArray(payload.tools))
      || (!dataRecord(origin))) return;
    /**
     Array emission identifies the actual native normalized transcript and declarations.
     */
    const serialization = readToolEmission(payload.tools);
    if ((!dataRecord(serialization)) || (serialization.messages !== origin.normalizedMessages)
      || (!denseArray(serialization.tools))) return;
    /**
     Capture the narrowed original declaration array for callbacks without changing its identity.
     */
    const declarations = serialization.tools;
    state.capturedArray = payload.tools;
    state.emissions = payload.tools
      .map(function originalEmission(
        tool,
        ordinal
      ): ToolAssociationEmission {
      /**
       The original map callback identifies this exact converted output.
       */
      const emitted = readToolEmission(tool);
      /**
       Matching the array's declaration position is independent of output value equality.
       */
      const association = dataRecord(emitted) && (emitted.tool === declarations[ordinal]) ? originalToolOrigin(emitted.tool) : NO_CAPTURED_TOOL_ORIGIN;
      if (((typeof association) === 'symbol') || (!dataRecord(emitted))) return {
        original: tool,
        ordinal,
        reason: 'Serialized tool lacks its original native declaration emission and captured manager input'
      };
      try {
        if ((emitted.value === undefined) || (!isDeepStrictEqual(
          copyToolData(tool),
          emitted.value
        )))
          return {
            original: tool,
            ordinal,
            reason: 'Serialized tool data differs from its original native declaration emission'
          };
        return {
          original: tool,
          ordinal,
          association,
          serialization: emitted,
          value: emitted.value
        };
      } catch (error) {
        cl.debug(String(error));
        return {
          original: tool,
          ordinal,
          reason: 'Serialized tool data exceeds the supported original contribution profile'
        };
      }
    });
  }

  /**
   Replace unchanged values with the original producer's owned snapshots after payload callbacks.
   
   @param selected - actual callback-selected payload
   
   @returns selected payload with owned tool values wherever original lineage remains established
   */
  function retain(selected: unknown): unknown {
    /**
     Integrity checks retain caught failures without exposing declaration content.
     */
    const rl = tagged({
      tag: retain.name,
      l: fl
    });
    if ((!dataRecord(selected)) || (!denseArray(selected.tools))) return selected;
    /**
     The selected array is borrowed until all callback changes are checked.
     */
    const selectedTools = selected.tools;
    state.retained = state.emissions
      .map(function retainOriginalEmission(emission): ToolAssociationEmission {
      if ((emission.association === undefined) || (emission.serialization === undefined)) return emission;
      /**
       Position is supplied by the original array emission.
       */
      const original = selectedTools[emission.ordinal];
      try {
        if ((selectedTools === state.capturedArray) && (original === emission.original)
          && (readToolPublication(emission.serialization
            .tool)
            === emission.association
            .toolPublication)
          && isDeepStrictEqual(
            copyToolData(original),
            emission.value
          )) return emission;
      } catch (error) { rl.debug(String(error)); }
      return {
        ordinal: emission.ordinal,
        reason: 'The payload callback removed, replaced or changed an original tool declaration contribution'
      };
    });
    /**
     Only unchanged original contributions receive owned replacements.
     */
    const owned = new Map(state.retained
      .filter(function associated(emission) { return emission.association !== undefined; })
      .map(function ownedTool(emission) { return [
        emission.ordinal,
        emission.value
      ] as const; }));
    if (owned.size === 0) return selected;
    return Object.freeze({
      ...selected,
      tools: Object.freeze(selectedTools.map(function ownedToolAt(
        tool,
        ordinal
      ) {
      return owned.get(ordinal) ?? tool;
    }))
    });
  }

  /**
   Bind the observer's existing parsed request without another parse or serialization.
   
   @param parsed - original observer's JSON validation result
   
   @returns partial source contributions retaining unresolved tool origins
   
   @throws NativeToolAssociationError when the same native request is sealed twice
   */
  function seal(parsed: Readonly<Record<string, unknown>>): readonly ToolAssociationContribution[] {
    /**
     Sealing diagnostics identify the single native observation boundary.
     */
    const sl = tagged({
      tag: seal.name,
      l: fl
    });
    if (state.consumed) throw new NativeToolAssociationError('Native tool contribution was already sealed');
    state.consumed = true;
    /**
     Pending values are released after this one original request observation.
     */
    const expected = state.retained;
    state.emissions = [];
    state.retained = [];
    delete state.capturedArray;
    if (parsed.tools === undefined) return Object.freeze([]);
    /**
     Unsupported non-array tool fields remain visible as unresolved contributions.
     */
    const tools: readonly unknown[] = Array.isArray(parsed.tools) ? parsed.tools : [parsed.tools];
    sl.debug('sealing original native tool contribution observations');
    return Object.freeze(tools.map(function parsedTool(
      tool,
      ordinal
    ): ToolAssociationContribution {
      /**
       Original custody still requires equality with the actual serialized value.
       */
      const emission = expected[ordinal];
      /**
       An existing association alone cannot authenticate changed serialized contents.
       */
      const associated = (emission?.association !== undefined) && isDeepStrictEqual(
        tool,
        emission.value
      );
      return Object.freeze({
        contribution: Object.freeze({}),
        location: Object.freeze({
          field: 'tools' as const,
          ordinal
        }),
        ...(associated ? {
          association: emission.association,
          ...(emission.serialization === undefined ? {} : { serialization: emission.serialization })
        }
          : { reason: emission?.reason ?? 'Serialized tool lacks its original native declaration emission and captured manager input' }),
        coverage: 'partial-original-prompt-input-contribution',
        permission: false
      });
    }));
  }
  return Object.freeze({
    capture,
    retain,
    seal
  });
}

//endregion Original tool membership and serialized integrity remain independent of instruction authority
