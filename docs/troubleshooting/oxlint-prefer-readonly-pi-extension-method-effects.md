# Pi extension methods change host state without assigning the API input

## Symptom

The project readonly rule originally reported this uncertainty:

```text
The function input named "pi" is used by these calls: pi.appendEntry, pi.registerTool.
```

That message did not say these expressions are method calls.
It also did not explain that a method can change state without assigning a new value to `pi`.

## What the installed API declares

The installed Pi `0.80.6` declaration at
`node_modules/.pnpm/@earendil-works+pi-coding-agent@0.80.6/node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts`
declares the registration and append members with method syntax:

```ts
on(event: "before_agent_start", handler: ExtensionHandler<BeforeAgentStartEvent, BeforeAgentStartEventResult>): void;

registerTool<TParams extends TSchema = TSchema, TDetails = unknown, TState = any>(
  tool: ToolDefinition<TParams, TDetails, TState>,
): void;

appendEntry<T = unknown>(customType: string, data?: T): void;
```

No assignment such as `pi.on = value` or `pi.registerTool = value` is needed for these calls to change state.
Assignment would replace a property on the API object.
Calling a method can instead change data held behind the API capability.

## What the installed implementation changes

The installed extension loader at
`node_modules/.pnpm/@earendil-works+pi-coding-agent@0.80.6/node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/loader.js`
implements `on` by appending the handler to `extension.handlers`:

```js
on(event, handler) {
  runtime.assertActive();
  const list = extension.handlers.get(event) ?? [];
  list.push(handler);
  extension.handlers.set(event, list);
}
```

The same loader implements `registerTool` by updating `extension.tools` and refreshing the tool registry:

```js
registerTool(tool) {
  runtime.assertActive();
  extension.tools.set(tool.name, {
    definition: tool,
    sourceInfo: extension.sourceInfo,
  });
  runtime.refreshTools();
}
```

The same loader delegates `appendEntry` to the active runtime.
The installed agent session at
`node_modules/.pnpm/@earendil-works+pi-coding-agent@0.80.6/node_modules/@earendil-works/pi-coding-agent/dist/core/agent-session.js`
appends a custom session entry and emits an `entry_appended` event:

```js
appendEntry: (customType, data) => {
  const entryId = this.sessionManager.appendCustomEntry(customType, data);
  const entry = this.sessionManager.getEntry(entryId);
  if (entry) {
    this._emit({ type: "entry_appended", entry });
  }
}
```

The installed loader at `dist/core/extensions/loader.js:192` to `213`
also stores commands and message renderers in extension maps:

```js
registerCommand(name, options) {
  extension.commands.set(name, { name, sourceInfo: extension.sourceInfo, ...options });
}
registerMessageRenderer(customType, renderer) {
  extension.messageRenderers.set(customType, renderer);
}
```

The same loader at `dist/core/extensions/loader.js:192` to `213`
stores shortcuts as well as commands and message renderers in extension maps.
The loader at lines `228` to `266`
delegates `sendMessage` to runtime message handling and `setActiveTools` to session tool-state replacement.
By contrast,
`getActiveTools` calls `AgentSession.getActiveToolNames()`.
`dist/core/agent-session.js:591` to `593` returns a newly mapped array of primitive names.

The installed `Theme` implementation at `dist/modes/interactive/theme/theme.js:254` to `267`
reads its color maps in `fg` and delegates primitive text to Chalk in `bold`.
`dist/core/session-manager.js:881` to `890` shows that `SessionManager.getBranch` creates a fresh path array
without changing session state.
`ExtensionCommandContext.waitForIdle` only waits for current streaming to finish.
`dist/modes/interactive/interactive-mode.js:1651` to `1657` binds `ExtensionUIContext.notify`
to `showExtensionNotify`.
That implementation delegates to status,
warning,
or error UI updates at lines `1886` to `1896`.
The same interactive-mode source binds `select`,
`setStatus`,
and `setWidget` to selector and rendered UI state transitions.
`dist/core/agent-session.js:1874` to `1880` shows that `ExtensionContext.abort` invokes active abort handling.
`dist/core/model-registry.js:505` to `527` shows that `getAll` and `find` are registry observations,
while `hasConfiguredAuth` reads supplied model fields without refreshing auth.
`dist/core/model-registry.js:553` to `579` shows that `ModelRegistry.getApiKeyAndHeaders` is effectful
because auth resolution can execute command-backed configuration.
Its reads from the supplied model can also invoke caller-owned accessors or proxy traps,
so the catalog retains the model argument as an affected input.

These methods therefore have different exact effects even though none reassigns the local capability binding.

## Resolution

`packages/oxlint-plugins/prefer-readonly-parameter-type/src/prefer-readonly-parameter-types/pi-package-effect-catalog.ts`
now records exact receiver effects for:

- package `@earendil-works/pi-coding-agent`;
- package major `0`;
- owner type `ExtensionAPI`;
- mutating `ExtensionAPI` members `appendEntry`,
  `on`,
  `registerCommand`,
  `registerMessageRenderer`,
  `registerShortcut`,
  `registerTool`,
  `sendMessage`,
  `setActiveTools`,
  and `setThinkingLevel`;
- observational `ExtensionAPI` members `getActiveTools` and `getThinkingLevel`;
- observational `Theme.bold`,
  `Theme.fg`,
  `SessionManager.getBranch`,
  and `ExtensionCommandContext.waitForIdle`;
- mutating `ExtensionContext.abort`;
- mutating `ExtensionUIContext.notify`,
  `select`,
  `setStatus`,
  and `setWidget`,
  with supplied selector and widget inputs retained when applicable;
- observational `ModelRegistry.find` and `ModelRegistry.getAll`;
- model-input effects for `ModelRegistry.hasConfiguredAuth`;
- receiver and model-input effects for `ModelRegistry.getApiKeyAndHeaders`,
  because auth resolution can inspect that supplied object and run command-backed configuration;
- observational package callable `isToolCallEventType`.

Imported callable catalog targets can name exact option fields.
The shared model-selection entries target only `ctx` for `resolveEffectiveScope`
and `scope` plus `modelRegistry` for `resolveRequestedModel`.
They do not mark unrelated values stored in either options bag.

`packages/pi-plugins/auto-mode/src/register-propose-trust.ts` documents the known state changes with:

```ts
@mutates pi - `pi.registerTool` changes registered tools; deferred `pi.appendEntry` calls append accepted trust state.
```

`packages/pi-plugins/current-time-context/src/index.ts` documents its registration effect with:

```ts
@mutates pi - `pi.on` stores the `before_agent_start` event registration in the Pi host
```

`packages/pi-plugins/thinking-defaults/src/index.ts` documents registration and active-level updates,
without inventing a mutation effect for `getThinkingLevel`:

```ts
@mutates pi - `pi.on` registers lifecycle handlers and `pi.setThinkingLevel` changes active host state
```

Unknown method calls now receive a method-specific diagnostic.
It states that methods can change data in their object or controlled system without assigning to the input.
The diagnostic lists every supported remediation:

1. remove or rewrite the call;
2. include repository source in the nearest TypeScript project;
3. audit the exact external call and add a tested catalogue entry;
4. document every possibly changed input with `@mutates` in the current or a dedicated function.

## Verification

The following checks passed:

```text
mise run //packages/oxlint-plugins/prefer-readonly-parameter-type:lint:types
mise run //packages/oxlint-plugins/prefer-readonly-parameter-type:lint:oxlint
mise run //packages/oxlint-plugins/prefer-readonly-parameter-type:build:js:node
mise run //packages/oxlint-plugins/prefer-readonly-parameter-type:test:unit
mise run //packages/pi-plugins/current-time-context:lint:oxlint
mise run //packages/pi-plugins/current-time-context:test:unit
mise run //packages/pi-plugins/current-time-context:verify:extension
mise run //packages/pi-shared/model-selection:lint:oxlint
mise run //packages/pi-shared/model-selection:test:unit
mise run //packages/pi-plugins/advisor:lint:oxlint
mise run //packages/pi-plugins/advisor:test:unit
mise run //packages/pi-plugins/advisor:verify:extension
mise run //packages/pi-plugins/auto-mode:lint:types
mise run //packages/pi-plugins/auto-mode:lint:oxlint
mise run //packages/pi-plugins/auto-mode:build:js:node
mise run //packages/pi-plugins/auto-mode:test:unit
```

The intrinsic test resolves `appendEntry` and `registerTool` through real Pi declaration provenance.
`packages/oxlint-plugins/prefer-readonly-parameter-type/src/pi-package-effect-catalog.unit.test.ts`
opens real Advisor sources through the TypeScript bridge and verifies exact package provenance,
owner,
member,
and targets for every added Pi method.
The rule-level invalid fixture also proves that direct callback invocation without a contract
reports the missing callback contract.
Package-local Oxlint accepts the documented effects in current-time-context,
Advisor,
shared model selection,
and auto-mode.

The subsequent root `mise run lint:oxlint` sweep completed its Oxlint run in `259.1` seconds.
It returned status `1` because the repository still had `3,803` warnings and `1,714` errors across all rules,
not because the semantic bridge crashed.
The replacement rule reported `1,049` migration diagnostics,
no semantic bridge failure marker,
and no remaining Advisor or shared model-selection diagnostic.

## Verified workarounds

Use `ForeignBorrowed<T>` for Pi-owned capabilities without claiming immutability.
Pair every mutating or effectful exact call with `@mutates` at each forwarding boundary.
Use `ReadonlyDeep<T>` only for structural message and result data whose nested projection remains assignable.

This keeps host callback and registration effects visible.
Its tradeoff is contract propagation through local wrappers that forward the same capability.

## What does not work

- `ReadonlyDeep<ExtensionAPI>` retains mutating methods and therefore makes a dishonest immutability claim.
- Treating every method as observational misses registration,
  message,
  UI,
  active-tool,
  and command-backed-auth effects.
- Treating every method as mutating creates false contracts for `getActiveTools`,
  `getBranch`,
  `waitForIdle`,
  and primitive theme formatting.
- Treating direct callback invocation as observational misses changes to captured state,
  invoked capabilities,
  and deferred work.
- Keeping direct callback invocation opaque rejects a verified local wrapper even after its exact relation
  to supplied callback capability is documented.
- Checking only method names can match unrelated owners.
  Exact package major,
  owner type,
  member,
  and implementation evidence are all required.

## Upstream filing artifact

### Upstream filing decision

1. **Is it really upstream's fault?
   ** No.
   Pi methods are behaving according to their host-capability roles.
2. **Can upstream fix it?
   ** No applicable Pi defect was found.
3. **Are they supporting this use case?
   ** Pi supports extensions and exposes the methods needed by these plugins.
4. **Would the repo welcome our contribution?
   ** Not applicable because no upstream defect is present.
5. **Will they likely fix it?
   ** Not applicable because no behavior change is requested.
6. **Have we prototyped a minimal fix compatible with their architecture?
   ** Yes.
   The project-owned exact effect catalog and `ForeignBorrowed<T>` contracts pass package tests.

Nothing should be filed upstream.
