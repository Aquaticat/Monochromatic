/**
 * Per-parameter facts every readonly verdict is decided from.
 *
 * Separated from reporting because one of those verdicts is priced differently from the rest.
 * Proving foreign ownership walks the complete backwards caller closure of the whole configured
 * scope, and whether that answer can change anything is a fact about the callable's parameters
 * rather than about one of them. Building every parameter's facts first lets the callable ask at
 * most once, before it has reported anything, so a proof that exhausts the analysis budget fails a
 * callable that has said nothing rather than one that has already reported half its parameters.
 *
 * Nothing here touches the rule context. These are facts about source and semantics only, which is
 * what makes them safe to compute for a parameter that turns out to need no report at all.
 *
 * @module
 */

import type { ParsedMutationContractBlock, } from '@monochromatic-dev/oxlint-plugin-shared/ts';
import type { Type, } from 'typescript/unstable/sync';

import {
  asParameterIndex,
  type ParameterIndex,
} from './effect-slot-identity.ts';
import type { CallableEffectSummary, } from './effect-summary-index.ts';
import type { EffectCallableDeclaration, } from './effect-summary-model.ts';
import { bindingContainsForeignHostCapability, } from './foreign-host-capability-classifier.ts';
import { inputUsageSubject, } from './input-diagnostic-description.ts';
import {
  type UncertaintyBoundaries,
  uncertaintyBoundaries,
} from './opaque-effect-diagnostic.ts';
import {
  classifyReadonlyType,
  type ReadonlyClassification,
} from './readonly-classifier.ts';
import { redundantMarkerApplies, } from './redundant-marker-report.ts';
import { SemanticBridgeError, } from './semantic-bridge-error.ts';

/**
 * Semantic project shape the readonly classifier requires.
 */
type ClassifierProject = Parameters<typeof classifyReadonlyType>[0]['project'];

/**
 * One parameter and everything its verdict reads, apart from foreign ownership.
 */
export type ReadonlyParameterFacts = {
  readonly parameter: EffectCallableDeclaration['parameters'][number];
  readonly parameterIndex: ParameterIndex;
  readonly parameterName: string;
  readonly inputSubject: string;
  readonly affectedNames?: ReadonlySet<string>;
  readonly parameterType: Type;
  readonly classification: ReadonlyClassification;
  readonly parameterBlocks: readonly ParsedMutationContractBlock[];
  readonly opaque: boolean;
  /**
   * Whether this parameter's opacity has a cause a report can ask the reader to resolve.
   *
   * Additive on purpose, leaving `opaque` exactly what it was. Every other verdict reads
   * `opaque`, directly or through `acceptedHostOpacity`, and narrowing it would move the
   * stale-contract gate and the foreign-ownership proof for reasons that have nothing to
   * do with what a message says. False only when a store is the sole recorded cause, so
   * opacity with no provenance at all keeps reporting the unknown it is.
   */
  readonly reportableOpacity: boolean;
  readonly acceptedHostOpacity: boolean;
  readonly affected: boolean;
  readonly mutated: boolean;
  readonly uncertainty: UncertaintyBoundaries;
  readonly foreignHostCapability: boolean;
  /**
   * Whether a proven marker on this parameter would be the redundant kind.
   *
   * False for a parameter something reaches, since a marker that suppresses a live report is
   * doing work, and false for a declared type the report could not name. It answers everything
   * the redundant-marker report decides except whether the marker is actually proven, which is
   * the one part that costs a closure.
   */
  readonly redundantMarkerPossible: boolean;
};

/**
 * Builds facts for one declared parameter position.
 *
 * @param parameter - Declared parameter whose facts are needed.
 *
 * @param declaredPosition - Position the effect index keys this parameter by.
 *
 * @param declaration - Callable owning parameter.
 *
 * @param effectSummary - Whole-project effects for callable.
 *
 * @param project - TypeScript project resolving parameter type and classification.
 *
 * @param targetIndexes - Valid mutation-contract targets by authored name.
 *
 * @param blocksByParameter - Authored mutation blocks grouped by parameter position.
 *
 * @returns complete facts for one parameter.
 *
 * @throws SemanticBridgeError when TypeScript resolves no type for parameter binding.
 */
function factsForParameter({
  parameter,
  declaredPosition,
  declaration,
  effectSummary,
  project,
  targetIndexes,
  blocksByParameter,
}: {
  readonly parameter: EffectCallableDeclaration['parameters'][number];
  readonly declaredPosition: number;
  readonly declaration: EffectCallableDeclaration;
  readonly effectSummary: CallableEffectSummary;
  readonly project: ClassifierProject;
  readonly targetIndexes: ReadonlyMap<string, number>;
  readonly blocksByParameter: ReadonlyMap<number, readonly ParsedMutationContractBlock[]>;
},): ReadonlyParameterFacts {
  /**
   * Declared position of this parameter, as the effect index it is compared against.
   */
  const parameterIndex = asParameterIndex(declaredPosition,);
  /**
   * Bindings of this parameter whose own slot carries the opacity.
   *
   * Absent when nothing beneath the parameter is opaque, and then every binding is named, as
   * every report did before per-property attribution. A destructured parameter used to name its
   * primitive siblings in a report about one property, which `ST9` made the ordinary case rather
   * than an unusual one.
   */
  const affectedNames = effectSummary.opaqueBindingsByParameter
    .get(parameterIndex,);
  /**
   * Semantic parameter type.
   */
  const parameterType = project.checker
    .getTypeAtLocation(parameter.name,);
  if (parameterType === undefined) {
    throw new SemanticBridgeError({
      reason: 'node-not-found',
      message: `TypeScript did not resolve parameter type for ${
        parameter.name
          .getText(declaration.getSourceFile(),)
      }.`,
    },);
  }
  /**
   * Whether analyzer found unresolved external effect.
   */
  const opaque = effectSummary.opaqueParameterIndexes
    .has(parameterIndex,);
  /**
   * Provenance for this parameter's opacity, split by cause.
   */
  const uncertainty = uncertaintyBoundaries({
    effectSummary,
    parameterIndex,
  },);
  /**
   * Whether some recorded cause of this opacity is one a report can ask about.
   */
  const { reportable: reportableOpacity, } = uncertainty;
  /**
   * Whether exact marker explicitly authorizes opaque host capability use.
   */
  const foreignHostCapability = bindingContainsForeignHostCapability({
    project,
    name: parameter.name,
  },);
  /**
   * Mutation contracts targeting current parameter.
   */
  const parameterBlocks = blocksByParameter.get(parameterIndex,) ?? [];
  /**
   * Whether explicit host marker and contract bound unresolved behavior.
   */
  const acceptedHostOpacity = opaque
    && foreignHostCapability
    && (parameterBlocks.length > 0);
  /**
   * Whether analyzer found caller-observable or explicitly bounded host effects.
   */
  const affected = effectSummary.mutatedParameterIndexes
    .has(parameterIndex,)
    || acceptedHostOpacity;
  /**
   * Whether analyzer proved or explicit host authority admits referent mutation.
   */
  const mutated = effectSummary.referentMutatedParameterIndexes
    .has(parameterIndex,)
    || acceptedHostOpacity;
  return {
    parameter,
    parameterIndex,
    parameterName: parameter.name
      .getText(declaration.getSourceFile(),),
    inputSubject: inputUsageSubject({
      targetIndexes,
      parameterIndex,
      ...(affectedNames === undefined) ? {} : { affectedNames, },
    },),
    ...(affectedNames === undefined) ? {} : { affectedNames, },
    parameterType,
    classification: classifyReadonlyType({
      checker: project.checker,
      project,
      type: parameterType,
    },),
    parameterBlocks,
    opaque,
    reportableOpacity,
    acceptedHostOpacity,
    affected,
    mutated,
    uncertainty,
    foreignHostCapability,
    /* Guarded by `affected` first, so the classifier runs over a marker's underlying type only
     * for a parameter the report could still be about. */
    redundantMarkerPossible: (!affected)
      && redundantMarkerApplies({
        project,
        parameterType,
      },),
  };
}

/**
 * Builds facts for every declared parameter of one callable.
 *
 * @param declaration - Callable whose parameters are verified.
 *
 * @param effectSummary - Whole-project effects for callable.
 *
 * @param project - TypeScript project resolving parameter types and classifications.
 *
 * @param targetIndexes - Valid mutation-contract targets by authored name.
 *
 * @param blocksByParameter - Authored mutation blocks grouped by parameter position.
 *
 * @returns facts in declared parameter order.
 *
 * @throws SemanticBridgeError when TypeScript resolves no type for a parameter binding.
 *
 * @example
 * ```ts
 * readonlyParameterFacts({ declaration, effectSummary, project, targetIndexes, blocksByParameter });
 * ```
 */
export function readonlyParameterFacts({
  declaration,
  effectSummary,
  project,
  targetIndexes,
  blocksByParameter,
}: {
  readonly declaration: EffectCallableDeclaration;
  readonly effectSummary: CallableEffectSummary;
  readonly project: ClassifierProject;
  readonly targetIndexes: ReadonlyMap<string, number>;
  readonly blocksByParameter: ReadonlyMap<number, readonly ParsedMutationContractBlock[]>;
},): readonly ReadonlyParameterFacts[] {
  return declaration.parameters
    .map(function factsAt(
      parameter,
      declaredPosition,
    ): ReadonlyParameterFacts {
      return factsForParameter({
        parameter,
        declaredPosition,
        declaration,
        effectSummary,
        project,
        targetIndexes,
        blocksByParameter,
      },);
    },);
}

/**
 * Tests whether foreign ownership can change what this parameter reports.
 *
 * Foreign ownership is read by four verdicts and nothing else. Three of them withhold a report
 * that a wider readonly type would otherwise earn, and they only arise for the classifications
 * named here: a parameter already typed `mutable` and already known to be written has no offer
 * left to suppress, and an `opaque-capability` type matches none of them. The fourth runs the
 * other way and needs the answer to be true, but `redundantMarkerPossible` has already decided,
 * from the declared type and the recorded effects alone, whether it could name this parameter.
 *
 * An opaque parameter that no host marker and contract accepted reports its uncertainty and
 * returns before any of the four, so its answer is unread whatever it says.
 *
 * @param facts - Complete facts for one parameter.
 *
 * @returns whether some verdict for this parameter reads foreign ownership.
 *
 * @example
 * ```ts
 * factsNeedForeignProof(facts,);
 * ```
 */
export function factsNeedForeignProof(facts: ReadonlyParameterFacts,): boolean {
  if (facts.opaque && (!facts.acceptedHostOpacity))
    return false;
  /**
   * Declared-type classification deciding which suppressible verdicts exist here.
   */
  const { kind, } = facts.classification;
  return (kind === 'dishonest-readonly')
    || (facts.mutated && (kind === 'honest-readonly'))
    || ((!facts.mutated) && (kind === 'mutable'))
    || facts.redundantMarkerPossible;
}
