/**
 Probe extension for the gated disposable-host verification.

 pi loads this file directly, so it stays dependency-free and reports through JSON
 lines on stderr, which RPC mode reserves for the host protocol on stdout.
 It loads before the built extension so its `session_start` handler sees the catalog
 before filtering, and its `resources_discover` handler sees the catalog after,
 because the probe measured `resources_discover` firing after `session_start`.

 @module
 */

//region Constants

/**
 Provider whose bundled context window the disposable host overrides in `models.json`.
 */
const TARGET_PROVIDER = 'openai-codex';

/**
 Model whose context window proves overrides survive re-registration.
 */
const TARGET_MODEL = 'gpt-6-luna';

/**
 Model the rule retires inside the target provider.
 */
const RETIRED_MODEL = 'gpt-6-sol';

/**
 Model the rule keeps as that family's winner.
 */
const KEEPER_MODEL = 'gpt-6.1-sol';

//endregion Constants

//region Types

/**
 One chat model as the registry reports it.
 */
type ProbeModel = {
  readonly provider: string;
  readonly id: string;
  readonly contextWindow?: number;
  readonly thinkingLevelMap?: Readonly<Record<string, unknown>>;
};

/**
 Registry surface the probe reads.
 */
type ProbeRegistry = {
  readonly getAll: () => readonly ProbeModel[];
  readonly getModelsOfType: (type: string,) => readonly unknown[];
};

/**
 Event context the probe receives.
 */
type ProbeContext = {
  readonly modelRegistry: ProbeRegistry;
};

/**
 Extension API surface the probe registers against.
 */
type ProbeApi = {
  readonly on: (
    event: string,
    handler: (
      payload: unknown,
      ctx: ProbeContext,
    ) => void,
  ) => void;
};

//endregion Types

//region Reporting

/**
 Write one JSON record to stderr.

 @param record - fields to report

 @example
 ```typescript
 emit({ phase: 'factory' });
 ```
 */
function emit(record: Record<string, unknown>,): void {
  process.stderr
    .write(`${JSON.stringify({
      probe: 'model-retirement',
      ...record,
    })}\n`,);
}

/**
 Report one catalog snapshot.

 @param registry - registry the event carried

 @param phase - lifecycle point the snapshot was taken at

 @example
 ```typescript
 snapshot({ registry: ctx.modelRegistry, phase: 'session_start' });
 ```
 */
function snapshot(
  {
    registry,
    phase,
  }: {
    readonly registry: ProbeRegistry;
    readonly phase: string;
  },
): void {
  /**
   Chat models the registry reports at this phase.
   */
  const chat = registry.getAll();
  /**
   Model whose metadata proves overrides and thinking levels survive.
   */
  const target = chat.find(function isTarget(model,) {
    return (model.provider === TARGET_PROVIDER) && (model.id === TARGET_MODEL);
  },);
  emit({
    phase,
    chatCount: chat.length,
    imageCount: registry.getModelsOfType('image',)
      .length,
    classifierCount: registry.getModelsOfType('classifier',)
      .length,
    targetContextWindow: target?.contextWindow ?? (-1),
    targetThinkingLevels: target?.thinkingLevelMap === undefined
      ? 0
      : Object.keys(target.thinkingLevelMap,)
        .length,
    hasRetired: chat.some(function isRetired(model,) {
      return (model.provider === TARGET_PROVIDER) && (model.id === RETIRED_MODEL);
    },),
    hasKeeper: chat.some(function isKeeper(model,) {
      return (model.provider === TARGET_PROVIDER) && (model.id === KEEPER_MODEL);
    },),
  },);
}

//endregion Reporting

//region Entry point

/**
 Register the two snapshot handlers.

 @param pi - extension API the host passes to this factory

 @mutates pi - `pi.on` registers a session-start and a resources-discover handler

 @example
 ```typescript
 // pi --extension src/verify-probe.ts
 ```
 */
export default function verifyProbe(pi: ProbeApi,): void {
  emit({ phase: 'factory', },);
  pi.on(
    'session_start',
    function onSessionStart(
      _payload: unknown,
      ctx: ProbeContext,
    ): void {
      snapshot({
        registry: ctx.modelRegistry,
        phase: 'session_start',
      },);
    },
  );
  pi.on(
    'resources_discover',
    function onResourcesDiscover(
      _payload: unknown,
      ctx: ProbeContext,
    ): void {
      snapshot({
        registry: ctx.modelRegistry,
        phase: 'resources_discover',
      },);
    },
  );
}

//endregion Entry point
