/**
 Original native judgment source binding preserves handoff and current collection identity. @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { JudgmentConstructionError } from './judgment-error.ts';
import type { JudgmentPreparationSources } from './judgment-preparation-types.ts';
import type {
  JudgmentSourcesInput,
  JudgmentSources,
  JudgmentSourceBinding
} from './judgment-source-types.ts';

/**
 Source ownership diagnostics omit request bodies and original file contents.
 */
const l = tagged({ tag: 'auto-mode-judgment-sources' });

//region Source handoff precedes request authentication while publication retains original identity.
/**
 Bind observer source handoff to the original request and shared prepared-source collection.

 @param input - original observer, request, cancellation, and freshness capabilities

 @returns original request and current source collection operations

 @throws JudgmentConstructionError when source handoff names a different original request

 @example createJudgmentSources(input);
 */
export function createJudgmentSources(input: JudgmentSourcesInput): JudgmentSources {
  /**
   Factory diagnostics precede the original observer and request boundaries.
   */
  const rl = tagged({
    tag: createJudgmentSources.name,
    l
  });
  rl.debug('binding original judgment sources');
  /**
   Original callbacks remain distinct so their invocation order stays observable.
   */
  const {
    observer,
    response,
    readOriginalRequest,
    signal,
    collector,
    assertDependenciesCurrent
  } = input;
  /**
   Native preparation handoff takes precedence over the legacy binding callback.
   */
  const sourceBinding = observer.beginJudgmentSources ? observer.beginJudgmentSources(response) : observer.bindJudgmentSources?.(response);
  /**
   The request is authenticated only after the source handoff returns.
   */
  const receipt = readOriginalRequest();
  /**
   Shared collection changes only when original preparation publishes its sealed sources.
   */
  const state = { sources: sourceBinding?.sources ?? receipt.sources };
  if (sourceBinding && (sourceBinding.request !== receipt)) throw new JudgmentConstructionError('Judgment sources do not belong to the original request receipt');
  /**
   Return the current original collection without asserting live eligibility.

   @returns current original source collection by reference
   */
  function readSourceSnapshot(): JudgmentPreparationSources {
    return state.sources;
  }
  /**
   Publish the original preparation owner's sealed collection for later consumers.

   @param sources - original sealed source collection after receipt authentication
   */
  function publishJudgmentSources(sources: JudgmentPreparationSources): void {
    state.sources = sources;
  }
  /**
   Capture the current original collection only for the original judgment cancellation signal.

   @param options - original dependency facade capture input

   @returns current original source collection after freshness observation

   @throws JudgmentConstructionError when dependency capture supplies foreign cancellation
   */
  function capture(options: Readonly<{ signal: AbortSignal }>): JudgmentPreparationSources {
    if (options.signal !== signal) throw new JudgmentConstructionError('Dependency sources require original judgment cancellation');
    collector.assertObservedFresh(state.sources);
    return state.sources;
  }
  /**
   Authenticate the currently assessed collection before invoking its freshness observer.

   @param snapshot - original dependency collection retained by its native handle

   @throws JudgmentConstructionError when dependency collection identity has changed
   */
  function assertObservedFresh(snapshot: JudgmentPreparationSources): void {
    if (snapshot !== state.sources) throw new JudgmentConstructionError('Dependencies require the original assessed source collection');
    collector.assertObservedFresh(snapshot);
  }
  /**
   Return original request and source identities only after complete dependency authentication.

   @returns frozen binding containing current original identities
   */
  function readCurrentSourceBinding(): JudgmentSourceBinding {
    assertDependenciesCurrent();
    return Object.freeze({
      request: receipt,
      sources: state.sources
    });
  }
  return {
    receipt,
    collector: Object.freeze({
      capture,
      assertObservedFresh
    }),
    readSourceSnapshot,
    publishJudgmentSources,
    readCurrentSourceBinding
  };
}
//endregion
